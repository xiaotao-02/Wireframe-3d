import * as T from 'three';

// Explicit opt-in for one semantic group's direct, static mesh children. Does not dispose source geometry.
export function batchStaticChildren(group,{keep=[]}={}){
 if(!group?.isObject3D)throw Error('Batching requires one semantic group');
 const protectedMeshes=new Set(keep),bins=new Map(),skipped=[];
 for(const mesh of [...group.children]){
  const g=mesh.geometry,m=mesh.material;
  if(!mesh.isMesh||mesh.isInstancedMesh||mesh.isSkinnedMesh||mesh.children.length||!mesh.visible||Array.isArray(m)||m?.transparent||m?.transmission>0||mesh.morphTargetInfluences?.length||protectedMeshes.has(mesh)||mesh.userData.keepSeparate||mesh.userData.dynamicGeometry||mesh.userData.auditTarget||mesh.userData.referenceProbe||!g?.attributes.position||g.groups.length||g.morphAttributes.position||g.drawRange.start||g.drawRange.count<(g.index?.count??g.attributes.position.count)){skipped.push(mesh.name);continue;}
  mesh.updateMatrix();if(mesh.matrix.determinant()<=0){skipped.push(mesh.name);continue;}
  const attributes=Object.entries(g.attributes).sort(([a],[b])=>a.localeCompare(b));
  if(attributes.some(([,a])=>a.isInterleavedBufferAttribute||a.isInstancedBufferAttribute)){skipped.push(mesh.name);continue;}
  const signature=attributes.map(([n,a])=>`${n}:${a.itemSize}:${a.array.constructor.name}:${a.normalized}`).join('|');
  const key=[m.uuid,signature,mesh.castShadow,mesh.receiveShadow,mesh.renderOrder,mesh.layers.mask].join('/');
  if(!bins.has(key))bins.set(key,[]);bins.get(key).push(mesh);
 }
 const batches=[];let removedMeshes=0;
 for(const meshes of bins.values()){
  if(meshes.length<2)continue;
  const geometries=meshes.map(m=>{const g=m.geometry.index?m.geometry.toNonIndexed():m.geometry.clone();g.applyMatrix4(m.matrix);return g;});
  const merged=new T.BufferGeometry();
  for(const [name,first]of Object.entries(geometries[0].attributes)){
   const array=new first.array.constructor(geometries.reduce((n,g)=>n+g.attributes[name].array.length,0));let offset=0;
   for(const g of geometries){array.set(g.attributes[name].array,offset);offset+=g.attributes[name].array.length;}
   merged.setAttribute(name,new T.BufferAttribute(array,first.itemSize,first.normalized));
  }
  merged.computeBoundingBox();merged.computeBoundingSphere();
  const first=meshes[0],mesh=new T.Mesh(merged,first.material);mesh.name=`batch:${group.name||'group'}:${batches.length}`;mesh.castShadow=first.castShadow;mesh.receiveShadow=first.receiveShadow;mesh.renderOrder=first.renderOrder;mesh.layers.mask=first.layers.mask;
  mesh.userData.sourceNames=meshes.map(x=>x.name);mesh.userData.staticBatch=true;
  for(const m of meshes)m.removeFromParent();group.add(mesh);removedMeshes+=meshes.length-1;batches.push(mesh);for(const g of geometries)g.dispose();
 }
 return {batches,removedMeshes,skipped,scope:'Only direct compatible static children; retain/protect all meshes referenced by animation, probes and audits.'};
}
