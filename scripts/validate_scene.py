"""Check mesh/semantic invariants; this does not certify mechanism or visual quality."""
import argparse
from collections import Counter
import json
import math
from pathlib import Path


def validate(data):
    assert data['schema']=='anatomy-3d/1','Unsupported schema'
    def vec(values,n=3):
        assert len(values)==n and all(isinstance(x,(int,float)) and math.isfinite(x) for x in values),'Non-finite vector'
    groups={g['id']:g for g in data['groups']}
    assert len(groups)==len(data['groups']),'Duplicate group ID'
    for g in groups.values():vec(g['rest']);vec(g['explode'])
    ids=set();tris=0;volumes={}
    for p in data['parts']:
        assert p['id'] not in ids,'Duplicate part ID';ids.add(p['id'])
        assert p['group'] in groups,'Orphan part'
        vec(p['pos']);vec(p['rotation'])
        verts=p['mesh']['vertices'];faces=p['mesh']['faces'];assert verts and faces
        for v in verts:vec(v)
        # Weld coordinates only for validation, preserving shading splits in output.
        keys=[tuple(round(v,8) for v in point) for point in verts]
        edges=Counter();volume=0
        for face in faces:
            assert len(face)==3 and all(isinstance(i,int) and 0<=i<len(verts) for i in face),'Invalid triangle'
            a,b,c=[verts[i] for i in face]
            u=[b[i]-a[i] for i in range(3)];v=[c[i]-a[i] for i in range(3)]
            cross=[u[1]*v[2]-u[2]*v[1],u[2]*v[0]-u[0]*v[2],u[0]*v[1]-u[1]*v[0]]
            assert sum(x*x for x in cross)>1e-18,('Degenerate face',p['id'])
            volume += sum(a[i]*cross[i] for i in range(3))/6
            for i,j in zip(face,face[1:]+face[:1]):edges[tuple(sorted((keys[i],keys[j])))]+=1
        assert all(n==2 for n in edges.values()),('Not a closed two-manifold mesh',p['id'])
        assert volume>0,('Non-positive signed volume / winding',p['id'],volume)
        volumes[p['id']]=round(volume,8);tris+=len(faces)
    for point in data['flow']:vec(point)
    assert len(data['flow'])>=2
    return {'groups':len(groups),'parts':len(ids),'triangles':tris,'finite':True,'closed_manifold':True,'positive_volume':True,'volumes':volumes}


if __name__=='__main__':
    parser=argparse.ArgumentParser();parser.add_argument('scene',type=Path);parser.add_argument('--report',type=Path)
    args=parser.parse_args();result=validate(json.loads(args.scene.read_text(encoding='utf-8')))
    if args.report:args.report.write_text(json.dumps(result,indent=2),encoding='utf-8')
    print(json.dumps({k:v for k,v in result.items() if k!='volumes'}))
