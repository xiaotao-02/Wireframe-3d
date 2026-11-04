import * as THREE from 'three';

// Oriented beam convention adapted from Senthee Wu / Factory Anatomy (MIT).
// nv specifies section roll. Provenance: references/source-render-porting.md.
export function sourceBeamMatrix(a,b,nv,width,depth,target=new THREE.Matrix4()) {
  for(const p of [a,b,nv])if(!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite))throw Error('sourceBeam: expected finite triples');
  if(![width,depth].every(v=>Number.isFinite(v)&&v>0))throw Error('sourceBeam: positive width/depth required');
  const A=new THREE.Vector3(...a),B=new THREE.Vector3(...b),u=B.clone().sub(A),length=u.length();
  if(length<1e-9)throw Error('sourceBeam: coincident endpoints');
  u.divideScalar(length);
  const ref=new THREE.Vector3(...nv);if(ref.length()<1e-9)throw Error('sourceBeam: zero section normal');
  const m=u.clone().cross(ref.normalize());if(m.length()<1e-9)throw Error('sourceBeam: section normal parallel to axis');
  m.normalize();const n=m.clone().cross(u).normalize();
  return target.makeBasis(n,m,u).scale(new THREE.Vector3(width,depth,length)).setPosition(A.add(B).multiplyScalar(.5));
}

export function sourceBeam(a,b,nv,width,depth,material) {
  const mesh=new THREE.Mesh(new THREE.BoxGeometry(1,1,1),material);
  sourceBeamMatrix(a,b,nv,width,depth).decompose(mesh.position,mesh.quaternion,mesh.scale);
  mesh.castShadow=true;mesh.receiveShadow=true;return mesh;
}

// Only for the Factory SVG formula documented in reference-fidelity.md. Not a universal Y flip.
export function factoryProjectionFrame(azimuth,elevation){
 if(![azimuth,elevation].every(Number.isFinite)||Math.abs(elevation)>=Math.PI/2)throw Error('Invalid projection angles');
 return {matrix:new THREE.Matrix4().makeScale(1,-1,1),direction:[Math.cos(azimuth),-Math.sin(azimuth),Math.tan(elevation)]};
}
export function checkProjectionLandmarks({camera,root,landmarks,width,height,tolerance=1}){
 if(!camera?.isCamera||!root?.isObject3D||!Array.isArray(landmarks)||landmarks.length<4||![width,height,tolerance].every(v=>Number.isFinite(v)&&v>0))throw Error('Projection check requires camera, root, four noncoplanar landmarks and positive viewport/tolerance');
 const points=landmarks.map(l=>{
  if(!Array.isArray(l.point)||l.point.length!==3||!l.point.every(Number.isFinite)||!Array.isArray(l.screen)||l.screen.length!==2||!l.screen.every(Number.isFinite))throw Error('Invalid landmark');
  return new THREE.Vector3(...l.point);
 });
 let independent=false;const origin=points[0],scale=Math.max(...points.map(p=>p.distanceTo(origin)));
 for(let i=1;i<points.length&&!independent;i++)for(let j=i+1;j<points.length&&!independent;j++)for(let k=j+1;k<points.length;k++){
  if(Math.abs(points[i].clone().sub(origin).dot(points[j].clone().sub(origin).cross(points[k].clone().sub(origin))))>scale**3*1e-8){independent=true;break;}
 }
 if(!independent)throw Error('Projection landmarks must be noncoplanar');
 root.updateWorldMatrix(true,true);camera.updateWorldMatrix(true,false);camera.updateProjectionMatrix();
 const errors=points.map((p,i)=>{const q=p.applyMatrix4(root.matrixWorld).project(camera),actual=[(q.x+1)*width/2,(1-q.y)*height/2];return {id:landmarks[i].id??String(i),actual,expected:landmarks[i].screen,error:Math.hypot(actual[0]-landmarks[i].screen[0],actual[1]-landmarks[i].screen[1])};});
 const maxError=Math.max(...errors.map(e=>e.error));return {status:Number.isFinite(maxError)&&maxError<=tolerance?'pass':'fail',maxError,tolerance,errors,scope:'Projection registration only; not model fidelity.'};
}
