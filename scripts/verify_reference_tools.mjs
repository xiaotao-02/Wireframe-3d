import {register} from 'node:module';
import {pathToFileURL} from 'node:url';
import {resolve,dirname} from 'node:path';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const args=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,all)=>v.startsWith('--')?[...a,[v.slice(2),all[i+1]]]:a,[]));
if(!args.three)throw Error('Use --three /path/to/node_modules/three [--report report.json]');
const url=pathToFileURL(resolve(args.three,'build/three.module.js')).href;
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return {url:${JSON.stringify(url)},shortCircuit:true};return n(s,c)}`),import.meta.url);
const T=await import(url),P=await import('../assets/lib/surface-patches.js'),R=await import('../assets/lib/reference-geometry.js');
const checks=[];
function test(name,run){try{run();checks.push({name,status:'pass'});}catch(e){checks.push({name,status:'fail',error:e.stack});}}
const near=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`);
const plane={point:(u,v)=>new T.Vector3(u,v,0)};
test('Coons patch follows four boundaries and responds to edited controls',()=>{
 const bottom=[[0,0,0],[1/3,0,0],[2/3,0,0],[1,0,0]];
 const s=P.coonsPatch({bottom:P.cubicBoundary(bottom),top:u=>[u,1,0],left:v=>[0,v,0],right:v=>[1,v,0]});
 near(s.point(.3,.7).distanceTo(new T.Vector3(.3,.7,0)),0);bottom[1][2]=1;assert.ok(s.point(.3,0).z>.4);near(s.point(.3,1).z,0);
 assert.throws(()=>P.coonsPatch({bottom:u=>[u,0,0],top:u=>[u,1,0],left:v=>[0,v,1],right:v=>[1,v,0]}),/corners/);
});
test('Trimmed patch has a real hole and preserved surface normals',()=>{
 const geometry=P.trimmedPatchGeometry(plane,{holes:[[[.3,.3],[.7,.3],[.7,.7],[.3,.7]]],subdivisions:2});
 const mesh=new T.Mesh(geometry,new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.updateMatrixWorld();
 const ray=new T.Raycaster(new T.Vector3(.5,.5,1),new T.Vector3(0,0,-1));assert.equal(ray.intersectObject(mesh).length,0);
 ray.ray.origin.set(.1,.1,1);assert.ok(ray.intersectObject(mesh).length>0);
 for(let i=0;i<geometry.attributes.normal.count;i++)near(geometry.attributes.normal.getZ(i),1);
 const reversed=P.trimmedPatchGeometry(plane,{reverse:true});near(reversed.attributes.normal.getZ(0),-1);
});
test('Invalid holes and collapsed surfaces are rejected',()=>{
 assert.throws(()=>P.trimmedPatchGeometry(plane,{holes:[[[.2,.2],[.8,.8],[.2,.8],[.8,.2]]]}),/intersect/);
 assert.throws(()=>P.trimmedPatchGeometry(plane,{holes:[[[0,0],[.3,0],[.3,.3]]]}),/inside/);
 assert.throws(()=>P.trimmedPatchGeometry({point:()=>[0,0,0]}),/Degenerate/);
});
test('Cavity walls have requested depth and inward normals',()=>{
 const g=P.openingWallGeometry(plane,[[.3,.3],[.7,.3],[.7,.7],[.3,.7]],{depth:.2,segments:2});g.computeBoundingBox();near(g.boundingBox.min.z,-.2);near(g.boundingBox.max.z,0);
 const p=new T.Vector3().fromBufferAttribute(g.attributes.position,0),n=new T.Vector3().fromBufferAttribute(g.attributes.normal,0);
 assert.ok(n.dot(new T.Vector3(.5,.5,0).sub(p))>0,'Cavity normal points away from opening');
});
test('Attachment follows position and normal after shape change',()=>{
 let height=.2;const s={point:(u,v)=>new T.Vector3(u,v,height*u*u)},o=new T.Object3D();
 P.placeOnSurface(o,s,{u:.5,v:.3,offset:.1});const initial=o.position.clone();height=.8;const frame=P.placeOnSurface(o,s,{u:.5,v:.3,offset:.1});
 assert.ok(o.position.distanceTo(initial)>.1);near(new T.Vector3(0,0,1).applyQuaternion(o.quaternion).dot(frame.normal),1);
});
test('Dimensions measure transformed geometry, all axes, and instances',()=>{
 const root=new T.Group(),node=new T.Group(),mesh=new T.Mesh(new T.BoxGeometry(1,2,3));root.add(node);node.add(mesh);node.position.set(4,0,0);node.scale.set(2,1,1);
 const model={root,parts:[{id:'part',node}]},checks=['x','y','z'].map((axis,i)=>({id:axis,measure:'size',axis,expected:[2,2,3][i],tolerance:1e-6}));
 assert.equal(R.dimensionReport(model,checks).status,'pass');mesh.scale.z=1.1;assert.equal(R.dimensionReport(model,checks).results[2].status,'fail');
 const instances=new T.InstancedMesh(new T.BoxGeometry(1,1,1),new T.MeshBasicMaterial(),2);instances.setMatrixAt(1,new T.Matrix4().makeTranslation(3,0,0));near(R.measuredBounds(instances).bounds.getSize(new T.Vector3()).x,4);
});
test('Unused vertices do not enlarge measured physical bounds',()=>{
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute([0,0,0,1,0,0,0,1,0,100,100,100],3));g.setIndex([0,1,2]);
 near(R.measuredBounds(new T.Mesh(g)).bounds.max.x,1);
});
test('Fixed camera retains scale while geometry changes',()=>{
 const cam=new T.OrthographicCamera(),box=new T.Box3(new T.Vector3(-1,-1,-1),new T.Vector3(1,1,1));
 const spec={direction:[0,0,1],up:[0,1,0],center:[0,0,0],span:4};
 const first=R.fitReferenceView(cam,null,box,spec,800,600);const a=new T.Vector3(1,0,0).project(cam);
 R.fitReferenceView(cam,null,box.clone().expandByScalar(2),spec,800,600);near(new T.Vector3(1,0,0).project(cam).x,a.x);assert.equal(first.framing,'fixed');
 assert.throws(()=>R.referenceView({direction:[0,0,1],up:[0,0,1]}),/nonparallel/);
});
test('Projected probes follow real transformed vertices',()=>{
 const node=new T.Group(),mesh=new T.Mesh(new T.PlaneGeometry(1,1));mesh.name='panel';node.add(mesh);const model={root:node,parts:[{id:'p',node}]};
 const camera=new T.OrthographicCamera();R.fitReferenceView(camera,null,R.measuredBounds(node).bounds,{direction:[0,0,1],up:[0,1,0],center:[0,0,0],span:2},800,800);
 const probes={corner:{part:'p',mesh:'panel',vertex:0}},before=R.projectProbes(model,probes,camera);mesh.position.x=.2;
 const after=R.projectProbes(model,probes,camera);near(after.corner.uv[0]-before.corner.uv[0],.1);
});
const report={status:checks.every(c=>c.status==='pass')?'pass':'fail',checks,scope:'Synthetic geometry and camera regressions; not a held-out reconstruction or visual-quality score'};
if(args.report){await mkdir(dirname(resolve(args.report)),{recursive:true});await writeFile(args.report,JSON.stringify(report,null,2));}
console.log(JSON.stringify(report,null,2));if(report.status==='fail')process.exitCode=1;
