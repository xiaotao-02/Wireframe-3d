import {register} from 'node:module';
import {pathToFileURL} from 'node:url';
import {resolve,dirname} from 'node:path';
import {writeFile,mkdir} from 'node:fs/promises';
import assert from 'node:assert/strict';
const args=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,all)=>v.startsWith('--')?[...a,[v.slice(2),all[i+1]]]:a,[]));
if(!args.three)throw Error('Use --three /path/to/three [--report file.json]');
const url=pathToFileURL(resolve(args.three,'build/three.module.js')).href;
register('data:text/javascript,'+encodeURIComponent(`export async function resolve(s,c,n){if(s==='three')return {url:${JSON.stringify(url)},shortCircuit:true};return n(s,c)}`),import.meta.url);
const T=await import(url),{surfaceMaps,productMaterials}=await import('../assets/lib/materials.js'),{batchStaticChildren}=await import('../assets/lib/static-batching.js'),{meshAnchor,auditMeshAnchors}=await import('../assets/lib/mesh-anchors.js');
const checks=[];function test(name,run){try{run();checks.push({name,status:'pass'});}catch(e){checks.push({name,status:'fail',reason:e.stack});}}
test('Color/data maps use distinct color spaces and deterministic seeded pixels',()=>{
 const a=surfaceMaps('carbon',{seed:7}),b=surfaceMaps('carbon',{seed:7}),c=surfaceMaps('carbon',{seed:8});
 assert.equal(a.color.colorSpace,T.SRGBColorSpace);assert.equal(a.bump.colorSpace,T.NoColorSpace);assert.equal(a.roughness.colorSpace,T.NoColorSpace);
 assert.deepEqual(a.color.image.data,b.color.image.data);assert.notDeepEqual(a.color.image.data,c.color.image.data);for(const x of [a,b,c])x.dispose();
});
test('Product materials actually bind maps, and texture-free construction stays valid',()=>{
 const kit=productMaterials(),plain=productMaterials({textures:false});assert.equal(kit.materials.carbon.map,kit.maps.carbon.color);assert.equal(kit.materials.rubber.bumpMap,kit.maps.rubber.bump);assert.ok(kit.materials.paint.clearcoat>0);assert.equal(plain.materials.carbon.map,null);
 let disposed=0;kit.maps.carbon.color.addEventListener('dispose',()=>disposed++);kit.dispose();plain.dispose();assert.equal(disposed,1);
});
test('Invalid map size/repeat is rejected',()=>{assert.throws(()=>surfaceMaps('carbon',{size:3}));assert.throws(()=>surfaceMaps('rubber',{repeat:[0,1]}));});
const material=new T.MeshStandardMaterial(),geometry=()=>new T.SphereGeometry(.4,12,8),mesh=()=>new T.Mesh(geometry(),material);
test('Batching preserves transformed world bounds, normals and semantic parent',()=>{
 const root=new T.Group(),group=new T.Group();root.add(group);group.position.set(2,3,4);group.rotation.z=.3;const a=mesh(),b=mesh();a.position.set(-1,0,0);b.position.set(1,.3,0);b.scale.set(1,2,.5);group.add(a,b);root.updateMatrixWorld(true);
 const before=new T.Box3().setFromObject(group,true),r=batchStaticChildren(group),after=new T.Box3().setFromObject(group,true);assert.equal(r.removedMeshes,1);assert.equal(r.batches[0].parent,group);assert.ok(before.min.distanceTo(after.min)<1e-6);assert.ok(before.max.distanceTo(after.max)<1e-6);
 const n=r.batches[0].geometry.attributes.normal;for(let i=0;i<n.count;i++)assert.ok(Math.abs(new T.Vector3().fromBufferAttribute(n,i).length()-1)<1e-6);
 assert.ok(a.geometry.attributes.position,'Source geometry must remain owned by caller');
});
test('Batching preserves protected, animated, transparent, mirrored and nested meshes',()=>{
 const group=new T.Group(),list=Array.from({length:7},mesh);list[0].userData.auditTarget=true;list[1].userData.dynamicGeometry=true;list[2].material=material.clone();list[2].material.transparent=true;list[3].scale.x=-1;list[4].add(new T.Group());list[5].userData.referenceProbe=true;group.add(...list);batchStaticChildren(group,{keep:[list[6]]});for(const m of list)assert.equal(m.parent,group);
});
test('Actual anchors include parent transforms and moved geometry fails independently',()=>{
 const root=new T.Group(),a=mesh(),b=mesh();root.add(a,b);root.position.set(9,2,3);b.position.x=.1;const pair={id:'gap',a:{mesh:a,vertex:0},b:{mesh:b,vertex:0},expectedDistance:.1,tolerance:1e-6};assert.equal(auditMeshAnchors(root,[pair]).status,'pass');b.geometry.attributes.position.setX(0,.8);assert.equal(auditMeshAnchors(root,[pair]).status,'fail');
});
test('Detached/proxy/deformed anchors cannot claim pass; unconfigured is distinct',()=>{
 const root=new T.Group(),m=mesh();assert.throws(()=>meshAnchor(root,{mesh:m,vertex:0}),/outside/);root.add(m);m.userData.auditRole='proxy';assert.throws(()=>meshAnchor(root,{mesh:m,vertex:0}),/proxy/);delete m.userData.auditRole;m.userData.auditDeformation=true;assert.throws(()=>meshAnchor(root,{mesh:m,vertex:0}),/evaluated/);assert.equal(auditMeshAnchors(root,[]).status,'unconfigured');
});
test('Instanced anchors use the selected live instance transform',()=>{
 const root=new T.Group(),m=new T.InstancedMesh(geometry(),material,2);root.add(m);m.setMatrixAt(0,new T.Matrix4());m.setMatrixAt(1,new T.Matrix4().makeTranslation(3,0,0));const a=meshAnchor(root,{mesh:m,vertex:0,instance:0}),b=meshAnchor(root,{mesh:m,vertex:0,instance:1});assert.ok(Math.abs(a.distanceTo(b)-3)<1e-6);assert.throws(()=>meshAnchor(root,{mesh:m,vertex:0,instance:2}),/live/);
});
// Only the canvas drawing API is stubbed here. Browser rendering is a separate verification.
globalThis.document={createElement:()=>({width:128,height:128,getContext:()=>({createRadialGradient:()=>({addColorStop(){}}),fillRect(){}})})};
const {mountIllustration}=await import('../assets/lib/illustration.js');
test('Clay review hides surface decals and restores materials and presentation settings',()=>{
 const root=new T.Group(),base=mesh(),decal=mesh();decal.userData.isSurfaceDecal=true;decal.userData.auditIgnore=true;root.add(base,decal);const scene=new T.Scene();scene.background=new T.Color('#123456');const renderer={toneMapping:T.NeutralToneMapping,getSize(v){v.set(800,600);}},original=decal.material;
 const style=mountIllustration(root,{scene,renderer,bounds:new T.Box3().setFromObject(root)});style.setEnabled(false);assert.equal(scene.background.getHexString(),'123456');assert.equal(renderer.toneMapping,T.NeutralToneMapping);style.setClay(true);assert.equal(decal.material.colorWrite,false);style.setClay(false);assert.equal(decal.material,original);style.dispose();assert.equal(base.material,material);
});
const report={status:checks.some(x=>x.status==='fail')?'fail':'pass',checks,scope:'Numerical construction and lifecycle checks; no visual fidelity or GPU-performance assessment.'};
if(args.report){await mkdir(dirname(resolve(args.report)),{recursive:true});await writeFile(resolve(args.report),JSON.stringify(report,null,2));}console.log(JSON.stringify(report,null,2));if(report.status==='fail')process.exitCode=1;
