import * as T from 'three';
import assert from 'node:assert/strict';
import {buildScene} from './subject.js';
import {createSceneRuntime} from './lib/scene-runtime.js';
import {auditAssembly,measureBore} from './lib/assembly.js';
import {auditExplosion} from './lib/explosion.js';
import {auditMeshAnchors} from './lib/mesh-anchors.js';
const checks=[],samples=[];
const check=(name,fn)=>{try{fn();checks.push({name,status:'pass'});}catch(e){checks.push({name,status:'fail',reason:e.message});}};
try {
 const model=await buildScene(),runtime=createSceneRuntime(model);
 const transforms=()=>{const a=[];model.root.traverse(o=>a.push([...o.position.toArray(),...o.quaternion.toArray(),...o.scale.toArray(),o.visible]));return a;};
 const amounts=[...new Set([.25,.5,1,...(model.explosionChecks||[]).flatMap(r=>r.at||[1])])].sort((a,b)=>a-b);
 const poseList=[...Array.from({length:9},(_,i)=>({amount:0,stroke:model.setPose?i/8:0})),...amounts.map(amount=>({amount,stroke:0}))];
 for(const pose of poseList){
   runtime.apply(pose);const record={...pose,snapshot:runtime.snapshot()};
   check(`finite real geometry ${JSON.stringify(pose)}`,()=>{
     model.root.traverse(o=>{assert.ok(o.matrixWorld.elements.every(Number.isFinite),o.name);if(o.isMesh){const a=o.geometry?.attributes.position;assert.ok(a?.count>0,'Empty mesh');for(let i=0;i<a.array.length;i++)assert.ok(Number.isFinite(a.array[i]),'Nonfinite vertex');}});
     for(const part of model.parts)assert.ok(!new T.Box3().setFromObject(part.node).isEmpty(),'Empty semantic part: '+part.id);
   });
   check(`idempotent pose ${JSON.stringify(pose)}`,()=>{const before=runtime.snapshot(),nested=transforms();runtime.apply(pose);assert.deepEqual(runtime.snapshot(),before);assert.deepEqual(transforms(),nested);});
   if(model.assembly){record.audit=auditAssembly(model.assembly,{assembled:pose.amount===0});check(`declared assembly ${JSON.stringify(pose)}`,()=>assert.equal(record.audit.status,'pass',JSON.stringify(record.audit.results.filter(r=>r.status==='fail'||r.status==='unverified'))));}
   else record.audit={status:'unconfigured'};
   record.anchors=auditMeshAnchors(model.root,model.meshAnchorChecks);
   if(model.meshAnchorChecks?.length)check(`declared real mesh anchors ${JSON.stringify(pose)}`,()=>assert.equal(record.anchors.status,'pass',JSON.stringify(record.anchors.results)));
   record.explosion=auditExplosion(model,{amount:pose.amount});
   if(model.explosionChecks?.length)check(`declared exploded separation ${JSON.stringify(pose)}`,()=>assert.notEqual(record.explosion.status,'fail',JSON.stringify(record.explosion.results)));
   if(model.root.getObjectByName('contact-bridge'))check(`contact readout agrees with actual meshes ${JSON.stringify(pose)}`,()=>{
     const top=new T.Box3().setFromObject(model.root.getObjectByName('contact:-2.18')).max.z;
     const bottom=new T.Box3().setFromObject(model.root.getObjectByName('contact-bridge')).min.z;
     if(pose.amount===0){assert.ok(Math.abs(bottom-top-record.snapshot.telemetry.contactGap)<1e-6);assert.equal(record.snapshot.telemetry.closed,pose.stroke===1);}
     else assert.equal(record.snapshot.telemetry.closed,false);
   });
   samples.push(record);
 }
 runtime.apply({amount:0,stroke:0});const rest=runtime.snapshot(),restTransforms=transforms();runtime.apply({amount:1});runtime.apply({stroke:1});runtime.apply({amount:0,stroke:0});
 check('reset after mixed pose history',()=>{assert.deepEqual(runtime.snapshot(),rest);assert.deepEqual(transforms(),restTransforms);});
 if(model.assembly?.relations?.some(r=>r.id.startsWith('wire-to-base:')))check('negative control: wire penetrating the real base is detected',()=>{
   const rule=model.assembly.relations.find(r=>r.id.startsWith('wire-to-base:')),geometry=rule.a.geometry;
   rule.a.geometry=geometry.clone().translate(0,0,-.5);
   try{assert.equal(auditAssembly(model.assembly).results.find(r=>r.id===rule.id).status,'fail');}finally{rule.a.geometry.dispose();rule.a.geometry=geometry;}
 });
 if(model.assembly?.features?.some(f=>f.type==='bore'))check('negative control: actual undersized bore is detected',()=>{
   const feature=model.assembly.features.find(f=>f.type==='bore'),geometry=feature.mesh.geometry;
   feature.mesh.geometry=geometry.clone().scale(.5,.5,.5);
   try{assert.equal(measureBore(feature).status,'fail');}finally{feature.mesh.geometry.dispose();feature.mesh.geometry=geometry;}
 });
 const status=checks.some(c=>c.status==='fail')?'fail':'pass';
 console.log(JSON.stringify({status,checks,samples,scope:'Discrete numerical checks on real geometry and declared interfaces only.',visual:'NOT_RUN',referenceFidelity:'NOT_RUN',continuousClearance:'NOT_PROVEN'},null,2));
 if(status==='fail')process.exitCode=1;
}catch(e){console.log(JSON.stringify({status:'fail',error:e.stack,checks,samples}));process.exitCode=1;}
