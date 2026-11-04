import assert from 'node:assert/strict';
import * as T from 'three';
import {cycleTime,inCycleWindow,createProcessSampler,buildStations,auditMaterialOwners} from './lib/factory-process.js';
import {factoryProjectionFrame,checkProjectionLandmarks} from './lib/source-frame.js';
import {mountIllustration,materialRole} from './lib/illustration.js';
import {createSceneRuntime} from './lib/scene-runtime.js';
import {buildScene} from './subject.js';
const checks=[],test=(name,fn)=>{try{fn();checks.push({name,status:'pass'});}catch(e){checks.push({name,status:'fail',error:e.stack});}};
test('source offsets keep negative cycles and exact wrap',()=>{assert.deepEqual(cycleTime(0,32,16),{cycle:-1,local:16});assert.deepEqual(cycleTime(16,32,16),{cycle:0,local:0});assert.equal(cycleTime(48,32,16).local,0);});
test('independent track periods and HOME gate at boundaries',()=>{
 const run=createProcessSampler([{id:'a',period:32,offset:16,sample:t=>t},{id:'b',period:7,windows:[[5,1]],sample:t=>t+10,home:()=>-1}]);
 assert.equal(run(16).a.value,0);assert.equal(run(16).b.local,2);assert.equal(run(16).b.value,-1);assert.equal(run(5).b.value,15);assert.equal(run(7).b.value,10);assert.equal(run(8).b.value,-1);
});
test('bad schedules cannot silently become finite HOME motion',()=>{assert.throws(()=>cycleTime(NaN,32));assert.throws(()=>cycleTime(0,0));assert.throws(()=>cycleTime(Number.MAX_VALUE,32,-Number.MAX_VALUE));assert.throws(()=>cycleTime(1,Number.MIN_VALUE));assert.throws(()=>createProcessSampler([{id:'a',period:5,windows:[[1,1]],sample:()=>0,home:()=>0}]));assert.throws(()=>createProcessSampler([{id:'a',period:5,windows:[[1,2]],sample:()=>0}]));assert.equal(inCycleWindow(0,[0,5],5),true);assert.equal(inCycleWindow(2,[1,2],5),false);});
test('unknown devices and shared objects rejected; IDs remain distinct',()=>{
 const defs=[{id:'P1',kind:'press'},{id:'P2',kind:'scan'}];assert.throws(()=>buildStations(defs,{press:()=>new T.Group()}),/Unmapped/);
 const g=new T.Group();assert.throws(()=>buildStations(defs,{press:()=>g,scan:()=>g}),/own Object3D/);assert.throws(()=>buildStations([defs[0],defs[0]],{press:()=>new T.Group()}),/duplicate/);
 const map=buildStations(defs,{press:()=>new T.Group(),scan:()=>new T.Group()});assert.equal(map.get('P2').userData.stationKind,'scan');
});
test('negative controls: duplicated, missing and nonfinite visible loads',()=>{
 const a={id:'tray1',owner:'robot',position:[1,2,3]},b={...a,owner:'conveyor'};
 assert.equal(auditMaterialOwners([a],{expectedIds:['tray1']}).status,'pass');assert.equal(auditMaterialOwners([a,b]).status,'fail');assert.equal(auditMaterialOwners([],{expectedIds:['tray1']}).status,'fail');assert.equal(auditMaterialOwners([{...a,position:[NaN,0,0]}]).status,'fail');
});
test('actual camera matches independent source projection; wrong handedness fails',()=>{
 const A=.6,E=.45,k=100,width=800,height=600,frame=factoryProjectionFrame(A,E),root=new T.Group();root.applyMatrix4(frame.matrix);
 const camera=new T.OrthographicCamera(-4,4,3,-3,.1,100);camera.up.set(0,0,1);camera.position.fromArray(frame.direction).normalize().multiplyScalar(20);camera.lookAt(0,0,0);
 const landmarks=[[0,0,0],[1,0,0],[0,1,0],[0,0,1],[2,-1,.5]].map(point=>{const[x,y,z]=point;return {point,screen:[width/2+(x*Math.sin(A)-y*Math.cos(A))*k,height/2+((x*Math.cos(A)+y*Math.sin(A))*Math.sin(E)-z*Math.cos(E))*k]};});
 const args={camera,root,landmarks,width,height,tolerance:.001};assert.equal(checkProjectionLandmarks(args).status,'pass');root.scale.set(1,1,1);root.quaternion.identity();assert.equal(checkProjectionLandmarks(args).status,'fail');assert.throws(()=>checkProjectionLandmarks({...args,landmarks:[...Array(4)].map(()=>landmarks[0])}),/noncoplanar/);
});
// Canvas stub is only for material/object bookkeeping. A real browser must compile and render the shaders.
globalThis.document={createElement:()=>({getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})};
test('semantic colours, material slots and instance colours survive illustration',()=>{
 const root=new T.Group(),orange=materialRole('process','#df853a'),teal=materialRole('process','#468b8f');
 const a=new T.Mesh(new T.BoxGeometry(),orange),b=new T.Mesh(new T.BoxGeometry(),teal),mixed=new T.Mesh(new T.BoxGeometry(),[orange,teal]);
 const inst=new T.InstancedMesh(new T.BoxGeometry(),materialRole('subject'),3);inst.setColorAt(0,new T.Color('#ff0000'));const colours=inst.instanceColor;root.add(a,b,mixed,inst);
 const ink=mountIllustration(root,{renderer:{getSize:v=>v.set(800,600)},scene:new T.Scene(),bounds:new T.Box3(new T.Vector3(-1,-1,-1),new T.Vector3(1,1,1))});
 assert.equal(a.material.uniforms.uBase.value.getHexString(),'df853a');assert.equal(b.material.uniforms.uBase.value.getHexString(),'468b8f');assert.notEqual(mixed.material[0],mixed.material[1]);assert.equal(inst.instanceColor,colours);
 ink.setClay(true);assert.equal(a.material.uniforms.uClay.value,1);ink.setClay(false);ink.setEnabled(false);assert.equal(a.material,orange);ink.setEnabled(true);assert.equal(inst.instanceColor,colours);ink.dispose();assert.equal(a.material,orange);assert.equal(inst.children.length,0);
});
test('dynamic instance counts/matrices and deformed crease geometry follow actual meshes',()=>{
 const root=new T.Group(),m=materialRole(),inst=new T.InstancedMesh(new T.BoxGeometry(),m,4),mesh=new T.Mesh(new T.BoxGeometry(),m);inst.count=1;mesh.userData.lineWeight=.3;root.add(inst,mesh);
 const ink=mountIllustration(root,{renderer:{getSize:v=>v.set(800,600)},scene:new T.Scene(),bounds:new T.Box3(new T.Vector3(-1,-1,-1),new T.Vector3(1,1,1))});
 const hull=inst.children[0],edge=mesh.children.find(o=>o.isLineSegments),old=edge.geometry;
 for(const count of [4,0,2]){inst.count=count;inst.setMatrixAt(0,new T.Matrix4().makeTranslation(count,0,0));ink.update();assert.equal(hull.count,count);assert.equal(hull.instanceMatrix,inst.instanceMatrix);}
 mesh.geometry.translate(0,0,1);ink.update();assert.notEqual(edge.geometry,old);assert.equal(mesh.children[0].material.uniforms.uWidth.value,.65*.3);ink.dispose();
});
test('fixture uses three equipment types and one pose path; no duplicate cargo',()=>{
 const model=buildScene(),runtime=createSceneRuntime(model),kinds=new Set();model.root.traverse(o=>{if(o.userData.stationKind)kinds.add(o.userData.stationKind);});assert.equal(kinds.size,3);
 for(let i=0;i<=96;i++){const pose={stroke:i/96,time:0},telemetry=runtime.apply(pose),before=runtime.snapshot();runtime.apply(pose);assert.deepEqual(runtime.snapshot(),before);assert.equal(telemetry.materialAudit.status,'pass');model.root.traverse(o=>assert.ok(o.matrixWorld.elements.every(Number.isFinite)));}
 assert.equal(runtime.apply({amount:1,stroke:1}).bufferCount,0);
});
const status=checks.some(c=>c.status==='fail')?'fail':'pass';console.log(JSON.stringify({status,checks,scope:'Numerical and object-state regression; shader compilation and visual fidelity require browser evidence.'},null,2));if(status==='fail')process.exitCode=1;
