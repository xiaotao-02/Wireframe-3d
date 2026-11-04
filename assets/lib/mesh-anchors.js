import * as T from 'three';

// Anchors address actual displayed vertices; they are not separate idealized proxy coordinates.
export function meshAnchor(root,{mesh,vertex,instance}={}){
 if(!root?.isObject3D||!mesh?.isMesh)throw Error('Anchor requires actual display mesh');
 let n=mesh;for(;n&&n!==root;n=n.parent)if(n.userData.auditIgnore||n.userData.auditRole==='proxy')throw Error('Anchor cannot use a proxy/helper');
 if(n!==root)throw Error('Anchor mesh is outside display root');
 if(mesh.isSkinnedMesh||mesh.morphTargetInfluences?.length||mesh.userData.auditDeformation)throw Error('Anchor needs evaluated geometry');
 const g=mesh.geometry,p=g.attributes.position,count=g.index?.count??p.count;
 if(g.drawRange.start||g.drawRange.count<count)throw Error('Anchor needs complete evaluated draw range');
 if(!Number.isInteger(vertex)||vertex<0||vertex>=p.count||(g.index&&!g.index.array.includes(vertex)))throw Error('Anchor vertex is not rendered');
 mesh.updateWorldMatrix(true,false);const matrix=mesh.matrixWorld.clone();
 if(mesh.isInstancedMesh){if(!Number.isInteger(instance)||instance<0||instance>=mesh.count)throw Error('Anchor needs a live instance');const local=new T.Matrix4();mesh.getMatrixAt(instance,local);matrix.multiply(local);}
 const position=new T.Vector3().fromBufferAttribute(p,vertex).applyMatrix4(matrix);if(!position.toArray().every(Number.isFinite))throw Error('Nonfinite anchor');return position;
}
export function auditMeshAnchors(root,checks=[]){
 const results=checks.map(c=>{try{
  if(!c.id||!Number.isFinite(c.expectedDistance)||c.expectedDistance<0||!Number.isFinite(c.tolerance)||c.tolerance<0)throw Error('Anchor check requires independent expected distance and tolerance');
  const a=meshAnchor(root,c.a),b=meshAnchor(root,c.b),distance=a.distanceTo(b),error=Math.abs(distance-c.expectedDistance);
  return {id:c.id,status:error<=c.tolerance?'pass':'fail',distance,expected:c.expectedDistance,error,a:a.toArray(),b:b.toArray()};
 }catch(e){return {id:c.id,status:'unverified',reason:e.message};}});
 return {status:results.some(x=>x.status==='fail')?'fail':results.some(x=>x.status==='unverified')?'unverified':results.length?'pass':'unconfigured',results,scope:'Declared pairs of real vertices only; no general surface contact, strength or collision claim.'};
}
