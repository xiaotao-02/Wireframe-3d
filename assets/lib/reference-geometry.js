import * as T from 'three';

const vector=a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite);
export function referenceView(value){
  if(!value||!vector(value.direction)||!vector(value.up))throw Error('Reference view needs direction and up vectors');
  const d=new T.Vector3(...value.direction),u=new T.Vector3(...value.up);
  if(d.lengthSq()<1e-12||u.lengthSq()<1e-12||d.clone().normalize().cross(u.clone().normalize()).lengthSq()<1e-8)throw Error('Reference view direction and up must be nonparallel');
  if((value.center!==undefined||value.span!==undefined)&&(!vector(value.center)||!Number.isFinite(value.span)||value.span<=0))throw Error('Fixed framing requires center and positive vertical span');
  return {...value,direction:d.normalize().toArray(),up:u.normalize().toArray()};
}
export function fitReferenceView(camera,controls,bounds,config,width,height){
  const v=referenceView(config);if(!(width>0&&height>0)||bounds.isEmpty())throw Error('Invalid reference viewport/bounds');
  const center=v.center?new T.Vector3(...v.center):bounds.getCenter(new T.Vector3()),diag=Math.max(bounds.getSize(new T.Vector3()).length(),.001);
  camera.up.fromArray(v.up);camera.position.copy(center).addScaledVector(new T.Vector3(...v.direction),diag*4);camera.zoom=1;camera.lookAt(center);camera.updateMatrixWorld(true);
  let span=v.span;
  if(!span){const points=[];for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])points.push(new T.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse));
    span=Math.max(...points.map(p=>Math.abs(p.y)*2),...points.map(p=>Math.abs(p.x)*2*height/width)) * 1.08;}
  camera.left=-span*width/height/2;camera.right=-camera.left;camera.top=span/2;camera.bottom=-span/2;camera.near=Math.max(.00001,diag/10000);camera.far=diag*10;camera.updateProjectionMatrix();
  if(controls){controls.target.copy(center);controls.update();}
  return {projection:'orthographic',center:center.toArray(),direction:v.direction,up:v.up,span,framing:v.span?'fixed':'auto-fit',width,height};
}
function meshVertices(root,visit){
  root.updateWorldMatrix(true,true);const v=new T.Vector3(),instance=new T.Matrix4(),world=new T.Matrix4();
  function walk(o){if(!o.visible||o.userData.auditIgnore||o.userData.isIllustrationDecoration)return;
    if(o.isMesh){if(o.isSkinnedMesh||o.morphTargetInfluences?.length)throw Error('Evaluated deformation is required for reference measurements');
      const pos=o.geometry.getAttribute('position');if(!pos)throw Error('Mesh has no positions');
      const indices=o.geometry.index?new Set(o.geometry.index.array):Array.from({length:pos.count},(_,i)=>i);
      for(let n=0;n<(o.isInstancedMesh?o.count:1);n++){world.copy(o.matrixWorld);if(o.isInstancedMesh){o.getMatrixAt(n,instance);world.multiply(instance);}
        for(const i of indices){v.fromBufferAttribute(pos,i).applyMatrix4(world);if(!v.toArray().every(Number.isFinite))throw Error('Non-finite mesh vertex');visit(v,o);}}
    }for(const c of o.children)walk(c);
  }walk(root);
}
export function measuredBounds(root){const b=new T.Box3();let vertices=0;meshVertices(root,v=>{b.expandByPoint(v);vertices++;});if(!vertices)throw Error('No measured mesh vertices');return {bounds:b,vertices};}
export function dimensionReport(model,checks=[]){
  const results=checks.map(c=>{
    if(!['x','y','z'].includes(c.axis)||!['size','min','max'].includes(c.measure)||!Number.isFinite(c.expected)||!Number.isFinite(c.tolerance)||c.tolerance<0)throw Error('Invalid dimension constraint: '+c.id);
    const roots=c.parts?.length?c.parts.map(id=>{const part=model.parts.find(p=>p.id===id);if(!part)throw Error('Unknown dimension part: '+id);return part.node;}):[model.root];
    const b=new T.Box3();let vertices=0;for(const root of roots){const r=measuredBounds(root);b.union(r.bounds);vertices+=r.vertices;}
    const actual=(c.measure==='size'?b.getSize(new T.Vector3()):b[c.measure])[c.axis],error=actual-c.expected;
    return {id:c.id,actual,expected:c.expected,tolerance:c.tolerance,error,vertices,status:Math.abs(error)<=c.tolerance?'pass':'fail'};
  });return {status:results.length?(results.some(r=>r.status==='fail')?'fail':'pass'):'unconfigured',results,scope:'Declared dimensions of visible, index-referenced mesh vertices in world coordinates; not reference fidelity.'};
}
export function projectProbes(model,probes,camera){
  model.root.updateWorldMatrix(true,true);camera.updateMatrixWorld(true);
  return Object.fromEntries(Object.entries(probes||{}).map(([id,spec])=>{
    const part=model.parts.find(p=>p.id===spec.part);if(!part)throw Error('Unknown probe part: '+spec.part);
    const matches=[];part.node.traverse(o=>{if(o.isMesh&&o.name===spec.mesh)matches.push(o);});
    if(matches.length!==1)throw Error('Probe needs one uniquely named mesh: '+id);const mesh=matches[0],pos=mesh.geometry.getAttribute('position');
    if(mesh.isSkinnedMesh||mesh.morphTargetInfluences?.length)throw Error('Probe requires evaluated deformation');
    if(!Number.isInteger(spec.vertex)||spec.vertex<0||spec.vertex>=pos.count||mesh.geometry.index&&!mesh.geometry.index.array.includes(spec.vertex))throw Error('Probe must address a rendered vertex');
    const world=mesh.matrixWorld.clone();if(mesh.isInstancedMesh){if(!Number.isInteger(spec.instance)||spec.instance<0||spec.instance>=mesh.count)throw Error('Invalid probe instance');const instance=new T.Matrix4();mesh.getMatrixAt(spec.instance,instance);world.multiply(instance);}
    const p=new T.Vector3().fromBufferAttribute(pos,spec.vertex).applyMatrix4(world),n=p.clone().project(camera);
    return [id,{world:p.toArray(),uv:[(n.x+1)/2,(1-n.y)/2],inFrame:Math.abs(n.x)<=1&&Math.abs(n.y)<=1&&Math.abs(n.z)<=1}];
  }));
}
