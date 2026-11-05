import {register} from 'node:module';
import {pathToFileURL} from 'node:url';
import {resolve,dirname} from 'node:path';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const args=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,all)=>v.startsWith('--')?[...a,[v.slice(2),all[i+1]]]:a,[]));
if(!args.three)throw Error('Use --three /path/to/three [--report file.json]');
const url=pathToFileURL(resolve(args.three,'build/three.module.js')).href;
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return {url:${JSON.stringify(url)},shortCircuit:true};return n(s,c)}`),import.meta.url);
const T=await import(url),S=await import('../assets/lib/surface-network.js'),P=await import('../assets/lib/surface-patches.js'),G=await import('../assets/lib/geometry.js');
const checks=[],test=(name,fn)=>{try{fn();checks.push({name,status:'pass'});}catch(e){checks.push({name,status:'fail',error:e.stack});}};
const near=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`),plane={point:(u,v)=>new T.Vector3(u,v,0)},hole=[[.23,.31],[.76,.31],[.76,.69],[.23,.69]];
test('Endpoint cylinders occupy the requested segment on X/Y/Z and an oblique axis',()=>{
 for(const b of [[2,0,0],[0,-2,0],[0,0,2],[1,2,3]]){
  const a=[-.1,.2,.3],m=G.cylinderBetween(a,b,.1,new T.MeshBasicMaterial()),start=new T.Vector3(...a),axis=new T.Vector3(...b).sub(start),length=axis.length();axis.normalize();m.updateMatrixWorld();
  const p=m.geometry.attributes.position,values=[];for(let i=0;i<p.count;i++)values.push(new T.Vector3().fromBufferAttribute(p,i).applyMatrix4(m.matrixWorld).sub(start).dot(axis));
  near(Math.min(...values),0);near(Math.max(...values),length);
 }
 assert.throws(()=>G.cylinderBetween([0,0,0],[0,0,0],.1,null));
});
test('Closing vertex is normalized once without modifying the caller or losing the hole',()=>{
 const closed=[...hole,hole[0]],saved=JSON.stringify(closed),p=P.normalizeUVContour(closed);assert.equal(p.length,4);assert.equal(JSON.stringify(closed),saved);
 for(const h of [hole,closed]){const g=P.trimmedPatchGeometry(plane,{holes:[h]}),mesh=new T.Mesh(g,new T.MeshBasicMaterial());mesh.updateMatrixWorld();assert.equal(new T.Raycaster(new T.Vector3(.5,.5,1),new T.Vector3(0,0,-1)).intersectObject(mesh).length,0);}
 assert.throws(()=>P.normalizeUVContour([[0,0],[0,0],[1,0],[0,1]]),/Duplicate/);
});
test('Local window sampling covers the selected domain with the full requested resolution',()=>{
 const s=S.surfaceRegion(plane,{u:[.49,.51],v:[.2,.3],offset:.02}),g=S.gridSurfaceGeometry(s,{uSegments:32,vSegments:24});
 g.computeBoundingBox();near(g.boundingBox.min.x,.49);near(g.boundingBox.max.x,.51);near(g.boundingBox.min.y,.2);near(g.boundingBox.max.y,.3);near(g.boundingBox.min.z,.02);assert.equal(g.attributes.position.count,33*25);assert.deepEqual(s.mapUV(.5,.5),[.5,.25]);
 assert.throws(()=>S.surfaceRegion(plane,{u:[.4,.2]}));assert.throws(()=>s.point(-.1,.5));
});
test('Recess skin is open, back is visible from outside and shares the requested inset',()=>{
 for(const reverse of [false,true]){
  const {skin,wall,back}=S.recessedOpeningGeometries(plane,{hole,depth:.15,uSegments:19,vSegments:13,reverse}),sign=reverse?-1:1,ray=new T.Raycaster(new T.Vector3(.5,.5,sign),new T.Vector3(0,0,-sign));
  const mesh=g=>{const m=new T.Mesh(g,new T.MeshBasicMaterial());m.updateMatrixWorld();return m;};
  assert.equal(ray.intersectObject(mesh(skin)).length,0);const hits=ray.intersectObject(mesh(back));assert.ok(hits.length);near(hits[0].point.z,-sign*.15);
  for(let i=0;i<wall.attributes.position.count;i+=2)near(new T.Vector3().fromBufferAttribute(wall.attributes.position,i).distanceTo(new T.Vector3().fromBufferAttribute(wall.attributes.position,i+1)),.15);
 }
 assert.equal(S.recessedOpeningGeometries(plane,{hole,depth:.1,back:false}).back,null);
});
test('Curved opening wall and lid use the exact displayed skin rim including grid intersections',()=>{
 const s={point:(u,v)=>new T.Vector3(u,v,.2*Math.sin(Math.PI*u)*Math.sin(Math.PI*v))},o=S.recessedOpeningGeometries(s,{hole,depth:.07,uSegments:23,vSegments:17}),p=o.wall.attributes.position,b=o.back.attributes.position,skin=o.skin.attributes.position;
 for(let i=0;i<p.count;i+=2){const top=new T.Vector3().fromBufferAttribute(p,i),low=new T.Vector3().fromBufferAttribute(p,i+1);let error=Infinity;for(let k=0;k<skin.count;k++)error=Math.min(error,top.distanceTo(new T.Vector3().fromBufferAttribute(skin,k)));near(error,0,1e-8);near(low.distanceTo(new T.Vector3().fromBufferAttribute(b,i/2)),0,1e-8);near(top.distanceTo(low),.07);}
 assert.equal(S.auditSurfaceGeometry(o.skin).status,'pass');
});
test('Decal flips affect texture orientation while preserving geometry and winding',()=>{
 const a=S.surfaceDecalGeometry(plane,{}),b=S.surfaceDecalGeometry(plane,{flipU:true,flipV:true});assert.deepEqual(a.attributes.position.array,b.attributes.position.array);assert.deepEqual(a.index.array,b.index.array);
 for(let i=0;i<a.attributes.uv.count;i++){near(a.attributes.uv.getX(i)+b.attributes.uv.getX(i),1);near(a.attributes.uv.getY(i)+b.attributes.uv.getY(i),1);}
});
test('Clipped-grid intersections weld before Float32 conversion instead of collapsing triangles',()=>{
 const s={point:(u,v)=>new T.Vector3(2.2*(u-.5),1.3*(v-.5),.28+.17*Math.sin(Math.PI*u)*Math.sin(Math.PI*v))};
 const g=S.trimmedGridGeometry(s,{holes:[[[.33,.28],[.72,.28],[.72,.72],[.33,.72]]],uSegments:48,vSegments:32});
 const r=S.auditSurfaceGeometry(g);assert.equal(r.status,'pass',JSON.stringify(r));
});
test('Actual reversed, collapsed and nonfinite triangles fail the surface audit',()=>{
 const g=S.gridSurfaceGeometry(plane,{uSegments:3,vSegments:3});assert.equal(S.auditSurfaceGeometry(g).status,'pass');
 const reversed=g.clone(),ix=reversed.index;[ix.array[0],ix.array[1]]=[ix.array[1],ix.array[0]];assert.equal(S.auditSurfaceGeometry(reversed).failures.reversed,1);
 const collapsed=g.clone(),p=collapsed.attributes.position;p.setXYZ(collapsed.index.getX(1),p.getX(0),p.getY(0),p.getZ(0));assert.ok(S.auditSurfaceGeometry(collapsed).failures.degenerate>0);
 const nan=g.clone();nan.attributes.position.setX(0,NaN);assert.ok(S.auditSurfaceGeometry(nan).failures.nonfinite>0);
});
test('Inward offset across an unsmoothed mirror cusp exposes real folded triangles',()=>{
 const cusp={point:(u,v)=>new T.Vector3(u,v,-.5*Math.abs(v-.5))};
 const g=S.gridSurfaceGeometry(S.surfaceRegion(cusp,{offset:-.05}),{uSegments:4,vSegments:100});
 assert.equal(S.auditSurfaceGeometry(g).status,'fail');assert.ok(S.auditSurfaceGeometry(g).failures.reversed>0);
});
const report={status:checks.every(c=>c.status==='pass')?'pass':'fail',checks,scope:'Actual-mesh unit regressions and deliberate geometry faults; independent generated cases and visual review are separate.'};
if(args.report){await mkdir(dirname(resolve(args.report)),{recursive:true});await writeFile(args.report,JSON.stringify(report,null,2));}console.log(JSON.stringify(report,null,2));if(report.status==='fail')process.exitCode=1;
