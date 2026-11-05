import * as T from 'three';
import {surfaceFrame,trimmedPatchGeometry,normalizeUVContour} from './surface-patches.js';

// Reparameterize before tessellation: 32 samples means 32 across this region, not the whole skin.
export function surfaceRegion(surface,{u=[0,1],v=[0,1],offset=0,reverse=false}={}){
 if(![u,v].every(r=>Array.isArray(r)&&r.length===2&&r.every(Number.isFinite)&&r[0]>=0&&r[1]<=1&&r[0]<r[1])||!Number.isFinite(offset))throw Error('surfaceRegion: increasing ranges inside [0,1] required');
 const mapUV=(s,t)=>{if(![s,t].every(x=>Number.isFinite(x)&&x>=0&&x<=1))throw Error('surfaceRegion: local UV outside [0,1]');return [T.MathUtils.lerp(u[0],u[1],s),T.MathUtils.lerp(v[0],v[1],t)];};
 return {mapUV,point(s,t){const [a,b]=mapUV(s,t);if(offset)return surfaceFrame(surface,a,b,{offset,reverse}).point;const p=surface.point(a,b);return p?.isVector3?p.clone():new T.Vector3(...p);}};
}

// Textures remain local to the selected region. Flip texture UVs without reflecting the geometry.
export function surfaceDecalGeometry(surface,{u=[0,1],v=[0,1],offset=.001,uSegments=32,vSegments=16,reverse=false,flipU=false,flipV=false}={}){
 const g=gridSurfaceGeometry(surfaceRegion(surface,{u,v,offset,reverse}),{uSegments,vSegments,reverse}),uv=g.attributes.uv;
 for(let i=0;i<uv.count;i++)uv.setXY(i,flipU?1-uv.getX(i):uv.getX(i),flipV?1-uv.getY(i):uv.getY(i));
 return g;
}

// Inspect the indexed output, not its intended controls. Open boundaries are allowed.
export function auditSurfaceGeometry(g,{minNormalDot=.05,relativeAreaEpsilon=1e-14}={}){
 if(!Number.isFinite(minNormalDot)||minNormalDot < -1||minNormalDot>1||!Number.isFinite(relativeAreaEpsilon)||relativeAreaEpsilon<0)throw Error('Invalid surface audit thresholds');
 const p=g.attributes.position,n=g.attributes.normal,ix=g.index;
 if(!p||!n||p.count!==n.count)throw Error('Surface audit needs position and normal attributes');
 const count=ix?ix.count:p.count;
 if(count%3)throw Error('Surface audit needs triangles');
 const bounds=new T.Box3(),seen=new Set();
 for(let i=0;i<count;i++){const id=ix?ix.getX(i):i;if(seen.has(id)||id<0||id>=p.count)continue;seen.add(id);const point=new T.Vector3().fromBufferAttribute(p,id);if(point.toArray().every(Number.isFinite))bounds.expandByPoint(point);}
 const scale=bounds.isEmpty()?0:bounds.getSize(new T.Vector3()).lengthSq(),bad=[],failures={nonfinite:0,degenerate:0,reversed:0};let minimumDot=1;
 for(let i=0;i<count;i+=3){
  const ids=[0,1,2].map(k=>ix?ix.getX(i+k):i+k),ps=ids.map(k=>new T.Vector3().fromBufferAttribute(p,k)),ns=ids.map(k=>new T.Vector3().fromBufferAttribute(n,k));let reason;
  if(ids.some(k=>k<0||k>=p.count)||[...ps,...ns].some(a=>!a.toArray().every(Number.isFinite)))reason='nonfinite';
  else {const face=ps[1].clone().sub(ps[0]).cross(ps[2].clone().sub(ps[0])),normal=ns.reduce((a,b)=>a.add(b),new T.Vector3());
   if(face.length()<=scale*relativeAreaEpsilon||normal.lengthSq()<1e-20)reason='degenerate';
   else {const dot=face.normalize().dot(normal.normalize());minimumDot=Math.min(minimumDot,dot);if(dot<minNormalDot)reason='reversed';}
  }
  if(reason){failures[reason]++;if(bad.length<20)bad.push({triangle:i/3,reason});}
 }
 return {status:count>0&&!Object.values(failures).some(Boolean)?'pass':'fail',triangles:count/3,failures,minimumDot,samples:bad,scope:'Local triangle validity and orientation only; not self-intersection, silhouette, or watertightness'};
}

// Skin, wall and back share the exact sampled opening boundary from the displayed skin.
// The back is a triangulated inset lid; use back:false for a through opening.
export function recessedOpeningGeometries(surface,{outline,hole,depth,uSegments=48,vSegments=24,reverse=false,back=true}={}){
 if(!Number.isFinite(depth)||depth<=0)throw Error('Opening depth must be positive');
 const contour=normalizeUVContour(hole),skin=trimmedGridGeometry(surface,{outline,holes:[contour],uSegments,vSegments,reverse}),uv=skin.attributes.uv,ix=skin.index,edges=new Map();
 for(let i=0;i<ix.count;i+=3)for(let j=0;j<3;j++){
  const a=ix.getX(i+j),b=ix.getX(i+(j+1)%3),key=a<b?`${a}:${b}`:`${b}:${a}`;
  if(edges.has(key))edges.get(key).count++;else edges.set(key,{a,b,count:1});
 }
 const onSegment=(p,a,b)=>{const d=[b[0]-a[0],b[1]-a[1]],q=[p[0]-a[0],p[1]-a[1]],len=Math.hypot(...d);return Math.abs(d[0]*q[1]-d[1]*q[0])<len*1.5e-7&&q[0]*d[0]+q[1]*d[1]>=-1.5e-7&&q[0]*d[0]+q[1]*d[1]<=len*len+1.5e-7;};
 const point=i=>[uv.getX(i),uv.getY(i)],rim=[...edges.values()].filter(e=>e.count===1&&contour.some((a,i)=>onSegment(point(e.a),a,contour[(i+1)%contour.length])&&onSegment(point(e.b),a,contour[(i+1)%contour.length])));
 const next=new Map(rim.map(e=>[e.a,e.b]));
 if(rim.length<3||next.size!==rim.length)throw Error('Opening boundary is not a single sampled loop');
 const ids=[rim[0].a];while(next.get(ids.at(-1))!==ids[0]){const id=next.get(ids.at(-1));if(id===undefined||ids.includes(id))throw Error('Broken opening boundary');ids.push(id);}
 if(ids.length!==rim.length)throw Error('Opening has disconnected boundary');
 const positions=[],wallUV=[],indices=[],bottom=[];
 for(const id of ids){const top=new T.Vector3().fromBufferAttribute(skin.attributes.position,id),normal=new T.Vector3().fromBufferAttribute(skin.attributes.normal,id),low=top.clone().addScaledVector(normal,-depth);positions.push(...top.toArray(),...low.toArray());bottom.push(...low.toArray());wallUV.push(...point(id),...point(id));}
 for(let i=0;i<ids.length;i++){const a=i*2,b=((i+1)%ids.length)*2;indices.push(a,a+1,b,b,a+1,b+1);}
 const wall=new T.BufferGeometry();wall.setAttribute('position',new T.Float32BufferAttribute(positions,3));wall.setAttribute('uv',new T.Float32BufferAttribute(wallUV,2));wall.setIndex(indices);wall.computeVertexNormals();
 let cap=null;
 if(back){const points=ids.map(point),faces=T.ShapeUtils.triangulateShape(points.map(p=>new T.Vector2(...p)),[]);
  cap=new T.BufferGeometry();cap.setAttribute('position',new T.Float32BufferAttribute(bottom,3));cap.setAttribute('uv',new T.Float32BufferAttribute(points.flat(),2));
  for(const f of faces){const [a,b,c]=f.map(i=>points[i]),area=(b[0]-a[0])*(c[1]-a[1])-(b[1]-a[1])*(c[0]-a[0]);if((area<0)!==reverse)f.reverse();}
  cap.setIndex(faces.flat());cap.computeVertexNormals();
 }
 return {skin,wall,back:cap,boundaryUV:ids.map(point)};
}

// Clip the constrained UV triangulation into bounded cells before mapping it to a curved skin.
// Uniformly subdividing long, skinny Earcut fans preserves their poor aspect ratios.
export function trimmedGridGeometry(surface,{outline,holes=[],uSegments=80,vSegments=40,reverse=false}={}){
 if(![uSegments,vSegments].every(n=>Number.isInteger(n)&&n>0&&n<=512))throw Error('Trimmed grid segments must be 1..512');
 const flat=trimmedPatchGeometry({point:(u,v)=>new T.Vector3(u,v,0)},{outline,holes,subdivisions:0}),a=flat.attributes.uv,ids=flat.index;
 const positions=[],normals=[],uvs=[],indices=[],cache=new Map();
 function vertex(p){const key=p.map(x=>x.toFixed(7)).join(',');if(cache.has(key))return cache.get(key);const q=key.split(',').map(Number),f=surfaceFrame(surface,q[0],q[1],{reverse}),index=uvs.length/2;positions.push(...f.point.toArray());normals.push(...f.normal.toArray());uvs.push(...q);cache.set(key,index);return index;}
 function clip(poly,axis,bound,positive){const out=[];for(let i=0;i<poly.length;i++){const p=poly[i],q=poly[(i+1)%poly.length],pin=positive?p[axis]>=bound:p[axis]<=bound,qin=positive?q[axis]>=bound:q[axis]<=bound;if(pin)out.push(p);if(pin!==qin){const t=(bound-p[axis])/(q[axis]-p[axis]),v=[T.MathUtils.lerp(p[0],q[0],t),T.MathUtils.lerp(p[1],q[1],t)];v[axis]=bound;out.push(v);}}return out;}
 for(let f=0;f<ids.count;f+=3){const tri=[0,1,2].map(k=>[a.getX(ids.getX(f+k)),a.getY(ids.getX(f+k))]),minX=Math.max(0,Math.floor(Math.min(...tri.map(p=>p[0]))*uSegments)),maxX=Math.min(uSegments-1,Math.floor(Math.max(...tri.map(p=>p[0]))*uSegments)),minY=Math.max(0,Math.floor(Math.min(...tri.map(p=>p[1]))*vSegments)),maxY=Math.min(vSegments-1,Math.floor(Math.max(...tri.map(p=>p[1]))*vSegments));
  for(let i=minX;i<=maxX;i++)for(let j=minY;j<=maxY;j++){
   let p=clip(tri,0,i/uSegments,true);p=clip(p,0,(i+1)/uSegments,false);p=clip(p,1,j/vSegments,true);p=clip(p,1,(j+1)/vSegments,false);if(p.length<3)continue;
   for(let k=1;k<p.length-1;k++){const q=[p[0],p[k],p[k+1]],area=(q[1][0]-q[0][0])*(q[2][1]-q[0][1])-(q[1][1]-q[0][1])*(q[2][0]-q[0][0]);if(Math.abs(area)<1e-10)continue;const face=q.map(vertex);if(new Set(face).size<3)continue;if((area<0)!==reverse)face.reverse();indices.push(...face);}
  }
 }
 flat.dispose();const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(positions,3));g.setAttribute('normal',new T.Float32BufferAttribute(normals,3));g.setAttribute('uv',new T.Float32BufferAttribute(uvs,2));g.setIndex(indices);g.userData.uvTessellation={uSegments,vSegments,quantization:1e-7,minTriangleArea:1e-10};return g;
}

// PCHIP: separate shape rails without the overshoot of unconstrained Catmull-Rom values.
export function monotoneProfile(points){
 if(!Array.isArray(points)||points.length<2||points.some((p,i)=>p.length!==2||!p.every(Number.isFinite)||(i&&p[0]<=points[i-1][0])))throw Error('Profile needs increasing finite stations');
 const n=points.length,h=[],d=[],m=[];
 for(let i=0;i<n-1;i++){h[i]=points[i+1][0]-points[i][0];d[i]=(points[i+1][1]-points[i][1])/h[i];}
 m[0]=d[0];m[n-1]=d[n-2];
 for(let i=1;i<n-1;i++){if(d[i-1]*d[i]<=0)m[i]=0;else {const a=2*h[i]+h[i-1],b=h[i]+2*h[i-1];m[i]=(a+b)/(a/d[i-1]+b/d[i]);}}
 return x=>{if(!Number.isFinite(x))throw Error('Nonfinite profile input');if(x<=points[0][0])return points[0][1];if(x>=points[n-1][0])return points[n-1][1];let i=0;while(x>points[i+1][0])i++;if(d[i]===0)return points[i][1];const t=(x-points[i][0])/h[i];return (2*t**3-3*t*t+1)*points[i][1]+(t**3-2*t*t+t)*h[i]*m[i]+(-2*t**3+3*t*t)*points[i+1][1]+(t**3-t*t)*h[i]*m[i+1];};
}
export function gridSurfaceGeometry(surface,{uSegments=48,vSegments=24,reverse=false}={}){
 if(![uSegments,vSegments].every(n=>Number.isInteger(n)&&n>=1&&n<=512))throw Error('Surface segments must be 1..512');
 const p=[],normal=[],uv=[],index=[];
 for(let i=0;i<=uSegments;i++)for(let j=0;j<=vSegments;j++){const u=i/uSegments,v=j/vSegments,f=surfaceFrame(surface,u,v,{reverse});p.push(...f.point.toArray());normal.push(...f.normal.toArray());uv.push(u,v);}
 for(let i=0;i<uSegments;i++)for(let j=0;j<vSegments;j++){const a=i*(vSegments+1)+j,b=a+vSegments+1;index.push(...(reverse?[a,a+1,b,b,a+1,b+1]:[a,b,a+1,b,b+1,a+1]));}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(p,3));g.setAttribute('normal',new T.Float32BufferAttribute(normal,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(index);return g;
}
// Rounds the caller's contour in its own coordinates; no screen-space tracing or shape inference.
export function roundedContour(points,{fraction=.12,segments=4}={}){
 if(!(fraction>0&&fraction<.5)||!Number.isInteger(segments)||segments<1)throw Error('Invalid contour rounding');
 return points.flatMap((p,i)=>{const a=points[(i+points.length-1)%points.length],b=points[(i+1)%points.length],start=p.map((x,k)=>T.MathUtils.lerp(x,a[k],fraction)),end=p.map((x,k)=>T.MathUtils.lerp(x,b[k],fraction));return Array.from({length:segments+1},(_,j)=>{const t=j/segments;return p.map((x,k)=>(1-t)**2*start[k]+2*(1-t)*t*x+t*t*end[k]);});});
}
// A visible shoulder into a real opening. Scale is contour homothety, not constant wall thickness.
export function openingBevelGeometry(surface,outline,{innerScale=.92,depth=.025,segments=4,direction=null}={}){
 if(!(innerScale>0&&innerScale<1)||!(depth>0)||!Number.isInteger(segments)||segments<1)throw Error('Invalid opening bevel');
 const axis=direction?new T.Vector3(...direction):null;if(axis&&(!axis.toArray().every(Number.isFinite)||axis.lengthSq()<1e-20))throw Error('Invalid opening direction');axis?.normalize();
 const center=outline.reduce((a,p)=>[a[0]+p[0]/outline.length,a[1]+p[1]/outline.length],[0,0]),inner=outline.map(p=>p.map((v,k)=>T.MathUtils.lerp(center[k],v,innerScale))),pos=[],uv=[],idx=[];
 for(let j=0;j<=segments;j++)for(let i=0;i<=outline.length;i++){const k=i%outline.length,t=j/segments,u=T.MathUtils.lerp(outline[k][0],inner[k][0],t),v=T.MathUtils.lerp(outline[k][1],inner[k][1],t),f=surfaceFrame(surface,u,v,{offset:axis?0:-depth*t});if(axis)f.point.addScaledVector(axis,depth*t);pos.push(...f.point.toArray());uv.push(i/outline.length,t);}
 const cw=T.ShapeUtils.isClockWise(outline.map(p=>new T.Vector2(...p)));
 for(let j=0;j<segments;j++)for(let i=0;i<outline.length;i++){const a=j*(outline.length+1)+i,b=a+outline.length+1;idx.push(...(cw?[a,b,a+1,b,b+1,a+1]:[a,a+1,b,b,a+1,b+1]));}
 const g=new T.BufferGeometry();g.setAttribute('position',new T.Float32BufferAttribute(pos,3));g.setAttribute('uv',new T.Float32BufferAttribute(uv,2));g.setIndex(idx);g.computeVertexNormals();return {geometry:g,inner};
}

