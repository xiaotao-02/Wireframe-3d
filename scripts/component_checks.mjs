import * as T from 'three';
import assert from 'node:assert/strict';
import {slabGeometry,latheShell,revolvedSection,sweptTube,flange,softenedBox,coilSpring} from './lib/geometry.js';
import {masonryWall,riverSite,framedWindow} from './lib/architecture.js';
import {fitOrthographic,palette} from './lib/presentation.js';
import {sourceBeamMatrix} from './lib/source-frame.js';
import {mountIllustration} from './lib/illustration.js';
import {buildScene as buildArchitecture} from './river-pavilion.js';
import {buildScene as buildMechanical} from './flanged-chamber.js';
const checks=[],m=palette(),test=(name,f)=>{try{f();checks.push({name,passed:true});}catch(e){checks.push({name,passed:false,reason:e.message});}};
function hit(o,origin,direction){o.updateMatrixWorld(true);return new T.Raycaster(new T.Vector3(...origin),new T.Vector3(...direction)).intersectObject(o,true);}
function finite(g){const a=g.attributes.position.array;assert([...a].every(Number.isFinite));g.computeBoundingBox();assert(!g.boundingBox.isEmpty());}
function volume(g){let sum=0,a=new T.Vector3(),b=new T.Vector3(),c=new T.Vector3(),p=g.attributes.position;const n=g.index?g.index.count:p.count;for(let i=0;i<n;i+=3){a.fromBufferAttribute(p,g.index?g.index.getX(i):i);b.fromBufferAttribute(p,g.index?g.index.getX(i+1):i+1);c.fromBufferAttribute(p,g.index?g.index.getX(i+2):i+2);sum+=a.dot(b.cross(c))/6;}return sum;}
test('Slab opening passes a ray; adjacent slab is solid',()=>{const g=slabGeometry({outline:[[-2,-2],[2,-2],[2,2],[-2,2]],holes:[[[-.5,-.5],[-.5,.5],[.5,.5],[.5,-.5]]],thickness:.2}),o=new T.Mesh(g,m.body);finite(g);assert.equal(hit(o,[0,0,3],[0,0,-1]).length,0);assert(hit(o,[1,0,3],[0,0,-1]).length>0);});
test('Lathe has open bore, positive volume and requested inner radius',()=>{const g=latheShell({profile:[[0,1],[2,1]],wall:.1});finite(g);assert(Math.abs(volume(g)-Math.PI*(1-.9**2)*2)<.015);const o=new T.Mesh(g,m.body);assert.equal(hit(o,[0,0,3],[0,0,-1]).length,0);assert(hit(o,[.95,0,3],[0,0,-1]).length>0);});
test('Variable tube retains taper, wall and positive volume',()=>{const g=sweptTube({points:[[0,0,0],[0,0,1],[0,0,2]],radii:[.4,.3,.2],wall:.05});finite(g);assert(volume(g)>0);const o=new T.Mesh(g,m.body);assert.equal(hit(o,[0,0,3],[0,0,-1]).length,0);assert(Math.abs(g.boundingBox.max.x-.4)<.01);});
test('Flange has bore and individual bolt holes',()=>{const o=flange({outerRadius:1,boreRadius:.4,thickness:.12,boltCircle:.7,boltRadius:.06,boltCount:8},m.body);assert.equal(hit(o,[0,0,2],[0,0,-1]).length,0);assert.equal(hit(o,[.7,0,2],[0,0,-1]).length,0);assert(hit(o,[.9,0,2],[0,0,-1]).length>0);});
test('Invalid wall and intersecting flange ring rejected',()=>{assert.throws(()=>latheShell({profile:[[0,.1],[1,.1]],wall:.2}));assert.throws(()=>flange({outerRadius:1,boreRadius:.8,thickness:.1,boltCircle:.8,boltRadius:.1},m.body));});
test('Softened box has intended dimensions at two scales',()=>{for(const s of [1,10]){const o=softenedBox([2*s,3*s,.4*s],.03*s,m.body),b=new T.Box3().setFromObject(o).getSize(new T.Vector3());assert(b.distanceTo(new T.Vector3(2*s,3*s,.4*s))<1e-4);}});
test('Masonry opening removes core and both faces',()=>{const o=masonryWall({width:4,height:3,openings:[[-.6,.8,.6,2.2]]},m.stone);assert.equal(hit(o,[0,-3,1.4],[0,1,0]).length,0);assert(hit(o,[1.3,-3,1.4],[0,1,0]).length>0);});
test('Masonry seed gives deterministic block transforms',()=>{const a=masonryWall({width:3,height:2,seed:9},m.stone).children.at(-1),b=masonryWall({width:3,height:2,seed:9},m.stone).children.at(-1);assert.deepEqual(a.instanceMatrix.array,b.instanceMatrix.array);});
test('Window dimensions preserve frame and glazing depth',()=>{const o=framedWindow({width:2,height:1.5},m.frame,m.glass),b=new T.Box3().setFromObject(o).getSize(new T.Vector3());assert(b.distanceTo(new T.Vector3(2,.065,1.5))<1e-5);});
test('River shares bed/water rule and banks rise gradually',()=>{const s=riverSite({width:12,depth:10,center:()=>0,waterLevel:()=>0,halfWidth:1,bankSlope:2},m.land,m.water);assert(s.heightAt(0,0)<s.waterLevel(0));assert(s.heightAt(2,0)>s.heightAt(1,0));assert(s.heightAt(3,0)>s.heightAt(2,0));s.group.traverse(o=>{if(o.isMesh)finite(o.geometry);});});
for(const [name,build]of [['architecture',buildArchitecture],['mechanical',buildMechanical]])test(name+' fixture semantic parts and finite geometry',()=>{const a=build(),ids=new Set();for(const p of a.parts){assert(!ids.has(p.id));ids.add(p.id);assert(p.node.parent===a.root);assert(p.explode.every(Number.isFinite));}a.root.updateMatrixWorld(true);a.root.traverse(o=>{if(o.isMesh)finite(o.geometry);});assert(!new T.Box3().setFromObject(a.root).isEmpty());});
test('Orthographic assembled/exploded fit respects UI insets on desktop and mobile',()=>{const model=buildArchitecture();for(const e of [0,.5,1]){for(const p of model.parts){p.node.userData.rest??=p.node.position.clone();p.node.position.copy(p.node.userData.rest).addScaledVector(new T.Vector3(...p.explode),e);}const b=new T.Box3().setFromObject(model.root);for(const [width,height]of [[1400,900],[370,340]]){const camera=new T.OrthographicCamera(),insets={left:24,right:24,top:50,bottom:75};fitOrthographic(camera,null,b,{width,height,direction:[1,-1.4,1],insets});camera.updateMatrixWorld(true);for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const p=new T.Vector3(x,y,z).project(camera),sx=(p.x+1)*width/2,sy=(1-p.y)*height/2;assert(sx>=insets.left-1e-4&&sx<=width-insets.right+1e-4);assert(sy>=insets.top-1e-4&&sy<=height-insets.bottom+1e-4);}}}});
test('Spring compression preserves wire radius and geometry identity',()=>{
 const spring=coilSpring({radius:.25,wireRadius:.03,turns:5,length:1.8,segments:80,sides:8},m.steel),geometry=spring.mesh.geometry;
 for(const length of [1.8,.5,1.2,1.8]){spring.setLength(length);assert.equal(spring.mesh.geometry,geometry);finite(geometry);const a=geometry.attributes.position;
  for(let ring=0;ring<=80;ring++){const center=new T.Vector3();for(let j=0;j<8;j++)center.add(new T.Vector3().fromBufferAttribute(a,ring*9+j));center.divideScalar(8);
   assert(Math.abs(center.z-length*ring/80)<1e-6);for(let j=0;j<8;j++)assert(Math.abs(new T.Vector3().fromBufferAttribute(a,ring*9+j).distanceTo(center)-.03)<1e-6);
  }
 }
 assert.throws(()=>spring.setLength(.2),/overlap/);
});
test('Source beam preserves endpoints, section roll and right handedness at bent poses',()=>{
 for(const [a,b,nv]of [[[0,0,0],[0,0,3],[1,0,0]],[[1,2,3],[-2,4,8],[0,1,0]],[[0,0,0],[2,0,0],[0,0,1]]]){
  const matrix=sourceBeamMatrix(a,b,nv,.4,.7),A=new T.Vector3(...a),B=new T.Vector3(...b),u=B.clone().sub(A).normalize(),n=new T.Vector3(...nv).addScaledVector(u,-new T.Vector3(...nv).dot(u)).normalize();
  assert(new T.Vector3(0,0,-.5).applyMatrix4(matrix).distanceTo(A)<1e-8);assert(new T.Vector3(0,0,.5).applyMatrix4(matrix).distanceTo(B)<1e-8);
  const x=new T.Vector3().setFromMatrixColumn(matrix,0),y=new T.Vector3().setFromMatrixColumn(matrix,1);assert(Math.abs(x.length()-.4)<1e-8);assert(Math.abs(y.length()-.7)<1e-8);assert(x.normalize().dot(n)>1-1e-8);assert(matrix.determinant()>0);
 }
 assert.throws(()=>sourceBeamMatrix([0,0,0],[0,0,0],[1,0,0],1,1));assert.throws(()=>sourceBeamMatrix([0,0,0],[0,0,1],[0,0,1],1,1));
});
test('Bent swept tube retains control-point radii, inner wall and rejects invalid samples',()=>{
 const points=[[0,0,0],[0,0,3],[1,0,3],[1,4,3]],radii=[.2,.35,.12,.25],segments=1000,sides=16,wall=.04;
 const g=sweptTube({points,radii,segments,sides,wall}),a=g.attributes.position,stride=(segments+1)*sides;
 for(let k=0;k<points.length;k++){
  const target=new T.Vector3(...points[k]);let best={distance:Infinity};
  for(let i=0;i<=segments;i++){const c=new T.Vector3();for(let j=0;j<sides;j++)c.add(new T.Vector3().fromBufferAttribute(a,i*sides+j));c.divideScalar(sides);const distance=c.distanceTo(target);if(distance<best.distance)best={distance,c,i};}
  const outer=new T.Vector3().fromBufferAttribute(a,best.i*sides).distanceTo(best.c),inner=new T.Vector3().fromBufferAttribute(a,stride+best.i*sides).distanceTo(best.c);
  assert(best.distance<.01);assert(Math.abs(outer-radii[k])<.002);assert(Math.abs(outer-inner-wall)<1e-5);
 }
 assert.throws(()=>sweptTube({points:[[0,0,0],[NaN,1,2]],radii:[1,1]}));assert.throws(()=>sweptTube({points,radii,segments:0}));
});
test('Carrier child follows parent rotation and one explicit projection transform',()=>{
 const root=new T.Group(),carrier=new T.Group(),load=new T.Object3D();root.add(carrier);carrier.add(load);carrier.position.set(3,4,2);load.position.set(1,0,0);carrier.rotation.z=Math.PI/2;
 assert(load.getWorldPosition(new T.Vector3()).distanceTo(new T.Vector3(3,5,2))<1e-8);
 const A=.6,E=.45,camera=new T.OrthographicCamera(-10,10,10,-10,.1,100);camera.up.set(0,0,1);camera.position.set(Math.cos(A),-Math.sin(A),Math.tan(E)).normalize().multiplyScalar(30);camera.lookAt(0,0,0);camera.updateMatrixWorld(true);
 root.scale.y=-1;root.updateMatrixWorld(true);
 for(const p of [[0,0,0],[1,0,0],[0,1,0],[0,0,1],[2,3,4]]){const actual=new T.Vector3(...p).applyMatrix4(root.matrixWorld).project(camera);const [x,y,z]=p;assert(Math.abs(actual.x*10-(x*Math.sin(A)-y*Math.cos(A)))<1e-8);assert(Math.abs(-actual.y*10-((x*Math.cos(A)+y*Math.sin(A))*Math.sin(E)-z*Math.cos(E)))<1e-8);}
});
test('Illustration hull follows live instance count, matrices and geometry without ghost copies',()=>{
 const previous=globalThis.document;
 globalThis.document={createElement:()=>({getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})};
 let ink;
 try{
  const root=new T.Group(),source=new T.InstancedMesh(new T.BoxGeometry(),m.body,5),scene=new T.Scene();root.add(source);scene.add(root);
  ink=mountIllustration(root,{renderer:{getSize:v=>v.set(800,600)},scene,bounds:new T.Box3(new T.Vector3(-1,-1,-1),new T.Vector3(1,1,1))});
  const hull=source.children.find(o=>o.isInstancedMesh);assert(hull);
  for(const count of [1,0,5]){source.count=count;source.instanceMatrix=source.instanceMatrix.clone();ink.update();assert.equal(hull.count,count);assert.equal(hull.instanceMatrix,source.instanceMatrix);}
  source.geometry=new T.CylinderGeometry(.3,.3,2);ink.update();assert.equal(hull.geometry,source.geometry);
 }finally{ink?.dispose();if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});
test('Partial revolution has positive volume for either winding and flat outward cut normals',()=>{
 const profile=[[0,1],[2,1],[2,.8],[0,.8]];
 for(const section of [profile,[...profile].reverse()])for(const arc of [2.2,4.8,Math.PI*2]){
  const start=.3,g=revolvedSection({section,start,arc,segments:128});finite(g);assert(Math.abs(volume(g)-arc*(1-.8**2))<.003);
  for(const [end,range]of g.userData.capRanges.entries()){const a=start+arc*end,expected=new T.Vector3(end?-Math.sin(a):Math.sin(a),end?Math.cos(a):-Math.cos(a),0);for(let i=range.offset;i<range.offset+range.count;i++)assert(new T.Vector3().fromBufferAttribute(g.attributes.normal,i).dot(expected)>.9999);}
 }
 assert.throws(()=>revolvedSection({section:profile,arc:7}));assert.throws(()=>revolvedSection({section:[[0,0],[1,1],[0,1]]}));
});
test('Thin surfaces keep both sides without black hulls; dynamicGeometry omits crease rebuilding',()=>{
 const previous=globalThis.document;
 globalThis.document={createElement:()=>({getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})};
 let ink;
 try{
  const root=new T.Group(),front=new T.Mesh(new T.BoxGeometry(1,1,1),new T.MeshStandardMaterial()),thin=new T.Mesh(new T.PlaneGeometry(1,1),new T.MeshStandardMaterial({side:T.DoubleSide})),dynamic=front.clone();
  thin.userData.thinSurface=true;dynamic.userData.dynamicGeometry=true;root.add(front,thin,dynamic);
  ink=mountIllustration(root,{renderer:{getSize:v=>v.set(800,600)},scene:new T.Scene(),bounds:new T.Box3().setFromObject(root)});
  assert.equal(thin.material.side,T.DoubleSide);assert.equal(front.material.side,T.FrontSide);assert.equal(thin.children.filter(o=>o.isMesh).length,0);assert.equal(dynamic.children.filter(o=>o.isLineSegments).length,0);assert.ok(front.children.some(o=>o.isMesh));
 }finally{ink?.dispose();if(previous===undefined)delete globalThis.document;else globalThis.document=previous;}
});
const status=checks.some(c=>!c.passed)?'fail':'pass';
console.log(JSON.stringify({status,checks,scope:'Numerical geometry and camera invariants only; no visual, collision, engineering or Blender certification.'}));
if(status==='fail')process.exitCode=1;
