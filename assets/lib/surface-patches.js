import * as T from 'three';

// Editable surface tools. Patch boundaries are shared design curves, not inferred from images.
const vec = p => {
  const a = p?.isVector3 ? p.toArray() : p;
  if (!Array.isArray(a) || a.length !== 3 || !a.every(Number.isFinite)) throw Error('Surface point must contain three finite coordinates');
  return new T.Vector3(...a);
};
const unit = n => { if (!Number.isFinite(n) || n < 0 || n > 1) throw Error('Surface coordinates must be in [0,1]'); return n; };
export function cubicBoundary(controls) {
  if (controls.length !== 4) throw Error('A cubic boundary needs four control points');
  return t => {
    unit(t); const s = 1-t, weights=[s*s*s,3*s*s*t,3*s*t*t,t*t*t], result=new T.Vector3();
    controls.forEach((p,i)=>result.addScaledVector(vec(p),weights[i])); return result;
  };
}
export function coonsPatch({bottom, top, left, right, tolerance=1e-7}) {
  if (![bottom,top,left,right].every(f=>typeof f==='function') || !(tolerance>0)) throw Error('Four boundary functions and positive tolerance required');
  function corners() {
    const p=[vec(bottom(0)),vec(bottom(1)),vec(top(0)),vec(top(1))];
    const q=[vec(left(0)),vec(right(0)),vec(left(1)),vec(right(1))];
    if(p.some((x,i)=>x.distanceTo(q[i])>tolerance))throw Error('Patch boundary corners do not meet'); return p;
  }
  corners();
  return {point(u,v) {
    unit(u);unit(v);const [a,b,c,d]=corners();
    const bilinear=a.multiplyScalar((1-u)*(1-v)).addScaledVector(b,u*(1-v)).addScaledVector(c,(1-u)*v).addScaledVector(d,u*v);
    return vec(bottom(u)).multiplyScalar(1-v).addScaledVector(vec(top(u)),v)
      .addScaledVector(vec(left(v)),1-u).addScaledVector(vec(right(v)),u).sub(bilinear);
  }};
}
export function surfaceFrame(surface,u,v,{offset=0,reverse=false}={}) {
  unit(u);unit(v);if(!Number.isFinite(offset))throw Error('Invalid surface offset');
  const h=1e-5,point=vec(surface.point(u,v));
  const tangent=vec(surface.point(Math.min(1,u+h),v)).sub(vec(surface.point(Math.max(0,u-h),v)));
  const across=vec(surface.point(u,Math.min(1,v+h))).sub(vec(surface.point(u,Math.max(0,v-h))));
  // Test angular degeneracy after normalization: a millimetre-scale patch is not degenerate
  // merely because finite-difference cross products contain h^2 and model-unit factors.
  if(tangent.lengthSq()<1e-24 || across.lengthSq()<1e-24)throw Error('Degenerate surface tangent');
  tangent.normalize();across.normalize();
  const normal=new T.Vector3().crossVectors(tangent,across);
  if(normal.lengthSq()<1e-20)throw Error('Degenerate surface tangent');
  normal.normalize().multiplyScalar(reverse?-1:1);
  const bitangent=new T.Vector3().crossVectors(normal,tangent).normalize();
  return {point:point.addScaledVector(normal,offset),normal,tangent,bitangent,
    quaternion:new T.Quaternion().setFromRotationMatrix(new T.Matrix4().makeBasis(tangent,bitangent,normal))};
}
export function placeOnSurface(object,surface,{u,v,offset=0,spin=0,reverse=false}) {
  if(!Number.isFinite(spin))throw Error('Invalid attachment spin');
  const f=surfaceFrame(surface,u,v,{offset,reverse});object.position.copy(f.point);object.quaternion.copy(f.quaternion);
  object.rotateZ(spin);return f; // Object + surface use the same parent/local frame. Reapply after shape edits.
}
const cross=(a,b,c)=>(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);
const on=(a,b,p)=>Math.abs(cross(a,b,p))<1e-10&&p[0]>=Math.min(a[0],b[0])-1e-10&&p[0]<=Math.max(a[0],b[0])+1e-10&&p[1]>=Math.min(a[1],b[1])-1e-10&&p[1]<=Math.max(a[1],b[1])+1e-10;
function intersects(a,b,c,d){return (cross(a,b,c)*cross(a,b,d)<0&&cross(c,d,a)*cross(c,d,b)<0)||on(a,b,c)||on(a,b,d)||on(c,d,a)||on(c,d,b);}
function inside(p,poly){let yes=false;for(let i=0,j=poly.length-1;i<poly.length;j=i++){
  const a=poly[i],b=poly[j];if(on(a,b,p))return false;
  if((a[1]>p[1])!==(b[1]>p[1])&&p[0]<(b[0]-a[0])*(p[1]-a[1])/(b[1]-a[1])+a[0])yes=!yes;
}return yes;}
function loop(points){
  if(!Array.isArray(points)||points.length<3)throw Error('Contour needs at least three UV points');
  const p=points.map(x=>{if(!Array.isArray(x)||x.length!==2)throw Error('Invalid UV point');return x.map(unit);});
  for(let i=0;i<p.length;i++){
    if(Math.hypot(p[i][0]-p[(i+1)%p.length][0],p[i][1]-p[(i+1)%p.length][1])<1e-10)throw Error('Duplicate contour vertex');
    for(let j=i+1;j<p.length;j++)if(j!==i+1&&!(i===0&&j===p.length-1)&&intersects(p[i],p[(i+1)%p.length],p[j],p[(j+1)%p.length]))throw Error('Self-intersecting contour');
  }
  if(Math.abs(p.reduce((a,x,i)=>a+x[0]*p[(i+1)%p.length][1]-x[1]*p[(i+1)%p.length][0],0))<1e-12)throw Error('Zero area contour');
  return p;
}
function loopsTouch(a,b){return a.some((x,i)=>b.some((y,j)=>intersects(x,a[(i+1)%a.length],y,b[(j+1)%b.length])));}
export function trimmedPatchGeometry(surface,{outline=[[0,0],[1,0],[1,1],[0,1]],holes=[],subdivisions=3,reverse=false}={}) {
  if(!Number.isInteger(subdivisions)||subdivisions<0||subdivisions>6)throw Error('subdivisions must be an integer from 0 to 6');
  const outer=loop(outline),cuts=holes.map(loop);
  for(let i=0;i<cuts.length;i++){
    if(!cuts[i].every(p=>inside(p,outer))||loopsTouch(outer,cuts[i]))throw Error('Hole must be strictly inside the patch');
    for(let j=0;j<i;j++)if(loopsTouch(cuts[i],cuts[j])||inside(cuts[i][0],cuts[j])||inside(cuts[j][0],cuts[i]))throw Error('Overlapping or nested holes');
  }
  const uv=[outer,...cuts].flat().map(p=>[...p]);
  let faces=T.ShapeUtils.triangulateShape(outer.map(p=>new T.Vector2(...p)),cuts.map(c=>c.map(p=>new T.Vector2(...p))));
  if(!faces.length)throw Error('Empty surface triangulation');
  for(let s=0;s<subdivisions;s++){
    const cache=new Map(),mid=(a,b)=>{const k=a<b?`${a}:${b}`:`${b}:${a}`;if(!cache.has(k)){cache.set(k,uv.length);uv.push([(uv[a][0]+uv[b][0])/2,(uv[a][1]+uv[b][1])/2]);}return cache.get(k);};
    faces=faces.flatMap(([a,b,c])=>{const ab=mid(a,b),bc=mid(b,c),ca=mid(c,a);return [[a,ab,ca],[ab,b,bc],[ca,bc,c],[ab,bc,ca]];});
  }
  const positions=[],normals=[];
  for(const [u,v]of uv){const f=surfaceFrame(surface,u,v,{reverse});positions.push(...f.point.toArray());normals.push(...f.normal.toArray());}
  for(const face of faces){if(cross(...face.map(i=>uv[i]))<0)[face[1],face[2]]=[face[2],face[1]];if(reverse)[face[1],face[2]]=[face[2],face[1]];
    const [a,b,c]=face.map(i=>new T.Vector3().fromArray(positions,i*3));if(new T.Vector3().crossVectors(b.sub(a),c.sub(a)).lengthSq()<1e-24)throw Error('Degenerate mapped triangle');}
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv.flat(),2));g.setIndex(faces.flat());return g;
}
export function openingWallGeometry(surface,outline,{depth,segments=8}={}) {
  const p=loop(outline);if(!(depth>0)||!Number.isFinite(depth)||!Number.isInteger(segments)||segments<1||segments>128)throw Error('Positive depth and 1..128 edge segments required');
  // Clockwise hole boundary: wall normals point into the cavity.
  if(T.ShapeUtils.isClockWise(p.map(q=>new T.Vector2(...q)))===false)p.reverse();
  const positions=[],uv=[],indices=[];
  for(let e=0;e<p.length;e++)for(let i=0;i<=segments;i++){
    const t=i/segments,a=p[e],b=p[(e+1)%p.length],u=T.MathUtils.lerp(a[0],b[0],t),v=T.MathUtils.lerp(a[1],b[1],t);
    const f=surfaceFrame(surface,u,v);positions.push(...f.point.toArray(),...f.point.clone().addScaledVector(f.normal,-depth).toArray());uv.push(t,0,t,1);
    if(i<segments){const n=2*(e*(segments+1)+i);indices.push(n,n+1,n+2,n+2,n+1,n+3);}
  }
  const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(indices);g.computeVertexNormals();return g;
}
