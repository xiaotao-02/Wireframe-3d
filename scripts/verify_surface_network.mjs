import {register} from 'node:module';
import {pathToFileURL} from 'node:url';
import {resolve,dirname} from 'node:path';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const args=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,all)=>v.startsWith('--')?[...a,[v.slice(2),all[i+1]]]:a,[]));
if(!args.three)throw Error('Use --three /path/to/three [--report file.json]');
const url=pathToFileURL(resolve(args.three,'build/three.module.js')).href;
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return {url:${JSON.stringify(url)},shortCircuit:true};return n(s,c)}`),import.meta.url);
const T=await import(url),S=await import('../assets/lib/surface-network.js'),P=await import('../assets/lib/surface-patches.js');
const checks=[],test=(name,fn)=>{try{fn();checks.push({name,status:'pass'});}catch(e){checks.push({name,status:'fail',error:e.stack});}};
const near=(a,b,e=1e-6)=>assert.ok(Math.abs(a-b)<e,`${a} != ${b}`),plane={point:(u,v)=>new T.Vector3(u,v,0)};
test('Millimetre surfaces keep a unit frame; zero-area surfaces still fail',()=>{
 for(const scale of [1,.001,.00001]){const f=P.surfaceFrame({point:(u,v)=>new T.Vector3(u*scale,v*scale,0)},.5,.5);near(f.normal.z,1);near(f.tangent.length(),1);}
 assert.throws(()=>P.surfaceFrame({point:(u,v)=>new T.Vector3(u+v,0,0)},.5,.5),/Degenerate/);
});
test('Profile follows controls, remains within each interval, preserves exact plateaus',()=>{
 const pts=[[0,0],[.2,2],[.5,2],[.7,-1],[1,1]],f=S.monotoneProfile(pts);for(const [x,y]of pts)near(f(x),y);
 for(let i=0;i<pts.length-1;i++)for(let j=0;j<=200;j++){const y=f(T.MathUtils.lerp(pts[i][0],pts[i+1][0],j/200));assert.ok(y>=Math.min(pts[i][1],pts[i+1][1])-1e-12&&y<=Math.max(pts[i][1],pts[i+1][1])+1e-12);}
 assert.equal(f(.33333),2);assert.throws(()=>S.monotoneProfile([[0,1],[0,2]]));assert.throws(()=>f(NaN));
});
test('Trimmed grid retains physical hole, UV area and bounded triangle spans',()=>{
 const g=S.trimmedGridGeometry(plane,{holes:[[[.3,.3],[.7,.3],[.7,.7],[.3,.7]]],uSegments:17,vSegments:13}),p=g.attributes.position,uv=g.attributes.uv,ix=g.index;let area=0;
 for(let i=0;i<ix.count;i+=3){const ids=[0,1,2].map(k=>ix.getX(i+k)),pts=ids.map(k=>new T.Vector3().fromBufferAttribute(p,k));area+=pts[1].sub(pts[0]).cross(pts[2].sub(pts[0])).length()/2;for(const [axis,span]of [['X',1/17],['Y',1/13]]){const v=ids.map(k=>uv['get'+axis](k));assert.ok(Math.max(...v)-Math.min(...v)<=span+1e-6);}}
 near(area,.84);const mesh=new T.Mesh(g,new T.MeshBasicMaterial({side:T.DoubleSide}));mesh.updateMatrixWorld();const ray=new T.Raycaster(new T.Vector3(.5,.5,1),new T.Vector3(0,0,-1));assert.equal(ray.intersectObject(mesh).length,0);ray.ray.origin.x=.1;assert.ok(ray.intersectObject(mesh).length>0);
});
test('Curved clipped mesh follows the surface with matching face orientation',()=>{
 const curved={point:(u,v)=>new T.Vector3(u,v,.3*Math.sin(u*Math.PI)*Math.sin(v*Math.PI))},g=S.trimmedGridGeometry(curved,{uSegments:24,vSegments:24}),p=g.attributes.position,n=g.attributes.normal,uv=g.attributes.uv,ix=g.index;
 for(let i=0;i<p.count;i++)assert.ok(new T.Vector3().fromBufferAttribute(p,i).distanceTo(curved.point(uv.getX(i),uv.getY(i)))<1e-6);
 for(let i=0;i<ix.count;i+=3){const ids=[0,1,2].map(k=>ix.getX(i+k)),v=ids.map(k=>new T.Vector3().fromBufferAttribute(p,k)),face=v[1].sub(v[0]).cross(v[2].sub(v[0])).normalize(),normal=ids.reduce((a,k)=>a.add(new T.Vector3().fromBufferAttribute(n,k)),new T.Vector3()).normalize();assert.ok(face.dot(normal)>.98);}
});
test('Reverse changes both face winding and lighting normals',()=>{
 for(const make of [S.gridSurfaceGeometry,S.trimmedGridGeometry]){const g=make(plane,{uSegments:3,vSegments:3,reverse:true}),p=g.attributes.position,ix=g.index,v=[0,1,2].map(i=>new T.Vector3().fromBufferAttribute(p,ix.getX(i)));assert.ok(v[1].sub(v[0]).cross(v[2].sub(v[0])).z<0);near(g.attributes.normal.getZ(0),-1);}
});
test('Invalid counts and invalid hole boundaries are rejected',()=>{
 for(const n of [0,-1,1.5,513])assert.throws(()=>S.trimmedGridGeometry(plane,{uSegments:n}));
 assert.throws(()=>S.trimmedGridGeometry(plane,{holes:[[[.2,.2],[.8,.8],[.2,.8],[.8,.2]]]}),/intersect/);
});
test('Rounded contour remains finite inside the original rectangle',()=>{
 const c=S.roundedContour([[0,0],[2,0],[2,1],[0,1]],{fraction:.2,segments:6});assert.equal(c.length,28);for(const [x,y]of c){assert.ok(x>=0&&x<=2&&y>=0&&y<=1);}assert.throws(()=>S.roundedContour([[0,0],[1,0],[0,1]],{fraction:.5}));
});
test('Normal and fixed-axis opening returns have requested inward displacement',()=>{
 const outline=[[.2,.2],[.8,.2],[.8,.8],[.2,.8]];
 for(const direction of [null,[1,0,-1]]){const {geometry:g,inner}=S.openingBevelGeometry(plane,outline,{depth:.04,segments:3,direction}),p=g.attributes.position,axis=direction?new T.Vector3(...direction).normalize():new T.Vector3(0,0,-1);for(let i=0;i<outline.length;i++){const a=new T.Vector3().fromBufferAttribute(p,i),b=new T.Vector3().fromBufferAttribute(p,3*5+i),expected=plane.point(...inner[i]).addScaledVector(axis,.04);near(a.distanceTo(plane.point(...outline[i])),0);near(b.distanceTo(expected),0);}}
 assert.throws(()=>S.openingBevelGeometry(plane,outline,{direction:[0,0,0]}));
});
const report={status:checks.every(c=>c.status==='pass')?'pass':'fail',checks,scope:'Synthetic surface regressions, including the small-patch failure and actual hole raycasts; not a vehicle likeness score or watertight-solid proof.'};
if(args.report){await mkdir(dirname(resolve(args.report)),{recursive:true});await writeFile(args.report,JSON.stringify(report,null,2));}console.log(JSON.stringify(report,null,2));if(report.status==='fail')process.exitCode=1;
