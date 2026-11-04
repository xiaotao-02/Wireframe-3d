import * as T from 'three';
import assert from 'node:assert/strict';
import {createSceneRuntime} from './lib/scene-runtime.js';
import {auditExplosion,meshProjection} from './lib/explosion.js';
import {visibleGeometryBounds,fitOrthographic} from './lib/presentation.js';
import {createMotion} from './lib/motion.js';
const checks=[],check=(name,fn)=>{try{fn();checks.push({name,status:'pass'});}catch(e){checks.push({name,status:'fail',reason:e.stack});}};
function fixture(){
 const root=new T.Group(),parts=[];
 function part(id,x,offset,range){const node=new T.Group();node.position.x=x;node.add(new T.Mesh(new T.BoxGeometry(2,2,2),new T.MeshBasicMaterial()));root.add(node);const p={id,node,explode:offset,explodeRange:range};parts.push(p);return p;}
 const a=part('left',-1.2,[-4,0,0],[.3,1]),b=part('right',1.2,[4,0,0],[.3,1]),cover=part('cover',0,[0,0,4],[0,.3]),flow=part('stream',0,[0,0,0]);flow.hideOnExplode=true;
 const hidden=new T.Mesh(new T.BoxGeometry(.1,.1,.1),new T.MeshBasicMaterial());hidden.visible=false;a.node.add(hidden);
 const moving=new T.Group();b.node.add(moving);const nested=new T.Mesh(new T.BoxGeometry(.2,.2,.2),new T.MeshBasicMaterial());nested.userData.hideOnExplode=true;moving.add(nested);
 const model={root,parts,explosionChecks:[{id:'left-to-right',a:'left',b:'right',axis:[1,0,0],minGap:1,at:[.5,1]}],setPose({stroke}){a.node.position.x=-1.2;moving.rotation.z=stroke;flow.node.visible=true;return {stroke};}};
 return {model,a,b,cover,flow,hidden,nested};
}
check('Absolute callbacks cannot erase explosion offsets; existing un-staged parts remain linear',()=>{
 const f=fixture(),runtime=createSceneRuntime(f.model);runtime.apply({amount:1,stroke:1});assert.equal(f.a.node.position.x,-5.2);assert.equal(runtime.snapshot().pose.stroke,0);
 delete f.cover.explodeRange;runtime.apply({amount:.25});assert.equal(f.cover.node.position.z,1);
});
check('Cover opens before axial parts; repeated and mixed history restores every nested transform and visibility',()=>{
 const f=fixture(),runtime=createSceneRuntime(f.model);runtime.apply({stroke:.6});const before=runtime.snapshot(),rotation=f.b.node.children.at(-1).rotation.z;
 runtime.apply({amount:.2});assert.equal(f.a.node.position.x,-1.2);assert.ok(f.cover.node.position.z>2);assert.equal(f.flow.node.visible,false);assert.equal(f.nested.visible,false);
 runtime.apply({amount:1});runtime.apply({stroke:.6});assert.deepEqual(runtime.snapshot(),before);assert.equal(f.b.node.children.at(-1).rotation.z,rotation);assert.equal(f.hidden.visible,false);assert.equal(f.nested.visible,true);
});
check('Declared projected gaps use actual transformed vertices and detect a deliberately overlapped module',()=>{
 const f=fixture(),runtime=createSceneRuntime(f.model);for(const amount of [.5,1]){runtime.apply({amount});assert.equal(auditExplosion(f.model,{amount}).status,'pass');}
 f.b.node.position.x=f.a.node.position.x;assert.equal(auditExplosion(f.model,{amount:1}).status,'fail');runtime.apply({amount:1});assert.equal(auditExplosion(f.model,{amount:1}).status,'pass');
 assert.equal(auditExplosion(f.model,{amount:0}).status,'not-applicable');assert.equal(auditExplosion({...f.model,explosionChecks:[]},{amount:1}).status,'unconfigured');
});
check('Unmeasured axes, invalid stages and unsupported deformation are rejected',()=>{
 const f=fixture();f.a.explodeRange=[.7,.2];assert.throws(()=>createSceneRuntime(f.model));assert.throws(()=>meshProjection(f.a.node,[0,0,0]));
 f.a.node.children[0].morphTargetInfluences=[.5];assert.throws(()=>meshProjection(f.a.node,[1,0,0]),/dedicated/);
});
check('Framing excludes hidden subtrees and decorations while retaining instances',()=>{
 const root=new T.Group(),mesh=new T.InstancedMesh(new T.BoxGeometry(2,2,2),new T.MeshBasicMaterial(),2);root.add(mesh);mesh.setMatrixAt(0,new T.Matrix4().makeTranslation(-4,0,0));mesh.setMatrixAt(1,new T.Matrix4().makeTranslation(4,0,0));
 const hidden=new T.Group(),huge=new T.Mesh(new T.BoxGeometry(1000,1000,1000));hidden.add(huge);hidden.visible=false;root.add(hidden);
 const helper=huge.clone();helper.userData.auditIgnore=true;root.add(helper);const bounds=visibleGeometryBounds(root);assert.deepEqual(bounds.min.toArray(),[-5,-1,-1]);assert.deepEqual(bounds.max.toArray(),[5,1,1]);
 const range=meshProjection(mesh,[1,0,0]);assert.equal(range.min,-5);assert.equal(range.max,5);
});
check('Expanded geometry fits mobile and desktop safe areas at front and back angles',()=>{
 const f=fixture(),runtime=createSceneRuntime(f.model);
 for(const amount of [0,.5,1]){runtime.apply({amount});const b=visibleGeometryBounds(f.model.root);
  for(const [width,height]of [[1400,800],[390,430]])for(const direction of [[1,-1,1],[-1,1,.7]]){const camera=new T.OrthographicCamera(),insets={top:55,bottom:85,left:24,right:24};camera.zoom=4;fitOrthographic(camera,null,b,{width,height,direction,insets});
   for(const x of [b.min.x,b.max.x])for(const y of [b.min.y,b.max.y])for(const z of [b.min.z,b.max.z]){const p=new T.Vector3(x,y,z).project(camera),sx=(p.x+1)*width/2,sy=(1-p.y)*height/2;assert(sx>=24-1e-6&&sx<=width-24+1e-6&&sy>=55-1e-6&&sy<=height-85+1e-6);}
  }
 }
});
check('Cycle waits for real reassembly; pause freezes the return and process time',()=>{
 const motion=createMotion();motion.explode(1,{immediate:true});motion.cycle(true);for(let i=0;i<5;i++)motion.step(.016);assert.equal(motion.snapshot().time,0);assert.equal(motion.snapshot().armed,true);
 motion.setPaused(true);const paused=motion.snapshot();for(let i=0;i<20;i++)motion.step(.016);assert.deepEqual(motion.snapshot(),paused);
 motion.setPaused(false);for(let i=0;i<400;i++)motion.step(.016);assert.equal(motion.snapshot().amount,0);assert.ok(motion.snapshot().time>0);
});
const status=checks.some(c=>c.status==='fail')?'fail':'pass';console.log(JSON.stringify({status,checks,visual:'NOT_RUN',continuousClearance:'NOT_PROVEN'},null,2));if(status==='fail')process.exitCode=1;
