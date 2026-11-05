import * as THREE from 'three';
// Original reusable Z-up geometry. Dimensions are scene units, not inferred engineering tolerances.
export const vec = a => new THREE.Vector3(...a);
const positive=(name,...xs)=>{if(xs.some(x=>!Number.isFinite(x)||x<=0))throw Error(`${name}: expected positive finite dimensions`);};
export function solid(geometry,material){const m=new THREE.Mesh(geometry,material);m.castShadow=true;m.receiveShadow=true;return m;}
export function box(size,material,position=[0,0,0]){positive('box',...size);const m=solid(new THREE.BoxGeometry(...size),material);m.position.fromArray(position);return m;}
export function beam(a,b,width,depth,material){const d=vec(b).sub(vec(a));positive('beam',d.length(),width,depth);const m=box([width,depth,d.length()],material);m.position.copy(vec(a).add(vec(b)).multiplyScalar(.5));m.quaternion.setFromUnitVectors(new THREE.Vector3(0,0,1),d.normalize());return m;}
// Native CylinderGeometry is +Y. Endpoints own the direction; radiusEnd belongs to b.
export function cylinderBetween(a,b,radius,material,{radiusEnd=radius,segments=48,openEnded=false}={}){
 if(![a,b].every(p=>Array.isArray(p)&&p.length===3&&p.every(Number.isFinite)))throw Error('cylinderBetween: finite endpoints required');
 const start=vec(a),end=vec(b),direction=end.clone().sub(start),length=direction.length();
 positive('cylinderBetween',length,radius,radiusEnd);
 if(!Number.isInteger(segments)||segments<3||segments>512)throw Error('cylinderBetween: segments must be 3..512');
 const mesh=solid(new THREE.CylinderGeometry(radiusEnd,radius,length,segments,1,openEnded),material);
 mesh.position.copy(start.add(end).multiplyScalar(.5));
 mesh.quaternion.setFromUnitVectors(new THREE.Vector3(0,1,0),direction.normalize());
 return mesh;
}
export function slabGeometry({outline,holes=[],thickness,bevel=0}){
 positive('slab',thickness);if(outline.length<3||!Number.isFinite(bevel)||bevel<0)throw Error('slab: invalid outline/bevel');
 const shape=new THREE.Shape(outline.map(p=>new THREE.Vector2(...p)));
 for(const h of holes)shape.holes.push(new THREE.Path(h.map(p=>new THREE.Vector2(...p))));
 // Outline describes the final boundary at bevel=0. With bevel>0 bevel expands it; choose clearances explicitly.
 return new THREE.ExtrudeGeometry(shape,{depth:thickness,bevelEnabled:bevel>0,bevelSize:bevel,bevelThickness:bevel,bevelSegments:2,curveSegments:24,steps:1});
}
export function softenedBox(size,bevel,material){positive('softenedBox',...size);if(bevel<=0)return box(size,material);if(bevel>=Math.min(...size)/3)throw Error('softenedBox: bevel too large');const [w,d,h]=size,r=bevel,g=slabGeometry({outline:[[-w/2+r,-d/2+r],[w/2-r,-d/2+r],[w/2-r,d/2-r],[-w/2+r,d/2-r]],thickness:h-2*r,bevel:r});g.translate(0,0,-h/2+r);return solid(g,material);}
export function latheShell({profile,wall,segments=64}){
 positive('latheShell',wall);if(profile.length<2||segments<8)throw Error('latheShell: insufficient profile/segments');
 for(let i=0;i<profile.length;i++){const [z,r]=profile[i];if(!Number.isFinite(z)||!Number.isFinite(r)||r<=wall||(i&&z<=profile[i-1][0]))throw Error('latheShell: z must increase and radius must exceed wall');}
 const outer=profile.map(([z,r])=>new THREE.Vector2(r,z)),inner=[...profile].reverse().map(([z,r])=>new THREE.Vector2(r-wall,z));
 return new THREE.LatheGeometry([...outer,...inner,outer[0]],segments).rotateX(Math.PI/2);
}
// Closed, simple [z,r] cross-section around +Z. Radial cuts have separate flat-normal faces.
// Positive radii only: this helper represents annular sections, not axis-collapsed solid tips.
export function revolvedSection({section,start=0,arc=Math.PI*2,segments=64}){
 const tau=Math.PI*2;
 if(!Array.isArray(section)||section.length<3||!Number.isFinite(start)||!Number.isFinite(arc)||arc<=0||arc>tau||!Number.isInteger(segments)||segments<8)throw Error('revolvedSection: invalid section or arc');
 let profile=section.map(p=>{if(!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite)||p[1]<=0)throw Error('revolvedSection: expected [z,positive radius]');return [...p];});
 const area=profile.reduce((sum,p,i)=>{const q=profile[(i+1)%profile.length];if(Math.hypot(p[0]-q[0],p[1]-q[1])<1e-9)throw Error('revolvedSection: duplicate adjacent point');return sum+p[1]*q[0]-q[1]*p[0];},0);
 if(Math.abs(area)<1e-10)throw Error('revolvedSection: degenerate section');if(area<0)profile.reverse();
 const vertices=[],indices=[],count=profile.length,steps=Math.max(8,Math.ceil(segments*arc/tau));
 for(let j=0;j<=steps;j++){const a=start+arc*j/steps;for(const [z,r]of profile)vertices.push(r*Math.cos(a),r*Math.sin(a),z);}
 for(let j=0;j<steps;j++)for(let k=0;k<count;k++){const a=j*count+k,b=j*count+(k+1)%count,c=(j+1)*count+(k+1)%count,d=(j+1)*count+k;indices.push(a,d,b,b,d,c);}
 const capRanges=[];
 if(arc<tau-1e-8){
  const triangles=THREE.ShapeUtils.triangulateShape(profile.map(([z,r])=>new THREE.Vector2(r,z)),[]);
  for(let end=0;end<2;end++){const offset=vertices.length/3,a=start+arc*end;for(const [z,r]of profile)vertices.push(r*Math.cos(a),r*Math.sin(a),z);
   for(const f of triangles)indices.push(...(end?[f[2],f[1],f[0]]:f).map(i=>i+offset));capRanges.push({offset,count});
  }
 }
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(vertices,3));g.setIndex(indices);g.computeVertexNormals();
 if(!capRanges.length){const normals=g.attributes.normal,a=new THREE.Vector3(),b=new THREE.Vector3();for(let i=0;i<count;i++){a.fromBufferAttribute(normals,i);b.fromBufferAttribute(normals,steps*count+i);a.add(b).normalize();normals.setXYZ(i,...a.toArray());normals.setXYZ(steps*count+i,...a.toArray());}}
 g.userData={kind:'revolvedSection',start,arc,capRanges};return g;
}
export function flange({outerRadius,boreRadius,thickness,boltCircle,boltRadius,boltCount=8},material){
 positive('flange',outerRadius,boreRadius,thickness,boltCircle,boltRadius);if(boreRadius>=boltCircle-boltRadius||boltCircle+boltRadius>=outerRadius||boltCount<3)throw Error('flange: holes must fit annulus');
 const s=new THREE.Shape();s.absarc(0,0,outerRadius,0,Math.PI*2,false);const bore=new THREE.Path();bore.absarc(0,0,boreRadius,0,Math.PI*2,true);s.holes.push(bore);
 for(let i=0;i<boltCount;i++){const a=i*Math.PI*2/boltCount,h=new THREE.Path();h.absarc(Math.cos(a)*boltCircle,Math.sin(a)*boltCircle,boltRadius,0,Math.PI*2,true);s.holes.push(h);}
 const m=solid(new THREE.ExtrudeGeometry(s,{depth:thickness,bevelEnabled:false,curveSegments:32}),material);m.userData.boreRadius=boreRadius;m.userData.boltHoles=boltCount;return m;
}
export function sweptTube({points,radii,wall=.02,segments=80,sides=16}){
 if(!Array.isArray(points)||!Array.isArray(radii)||points.length<2||points.length!==radii.length||points.some(p=>!Array.isArray(p)||p.length!==3||!p.every(Number.isFinite)))throw Error('sweptTube: one radius per finite control point');
 if(!Number.isInteger(segments)||segments<2||!Number.isInteger(sides)||sides<3)throw Error('sweptTube: invalid tessellation');
 positive('sweptTube',wall,...radii);if(Math.min(...radii)<=wall)throw Error('sweptTube: wall exceeds bore');
 const ps=points.map(vec);for(let i=1;i<ps.length;i++)if(ps[i].distanceTo(ps[i-1])<1e-6)throw Error('sweptTube: repeated adjacent control point');
 const curve=new THREE.CatmullRomCurve3(ps,false,'centripetal');
 // Radius belongs to its actual control-point location on the curve, not the shorter chord polyline.
 const subdivisions=Math.max(64,Math.ceil(256/(ps.length-1)));curve.arcLengthDivisions=subdivisions*(ps.length-1);
 const arcLengths=curve.getLengths(),lengths=ps.map((_,i)=>arcLengths[i*subdivisions]),frames=curve.computeFrenetFrames(segments,false);
 const total=lengths.at(-1),v=[],idx=[];const radiusAt=t=>{const d=t*total;let k=1;while(k<lengths.length-1&&lengths[k]<d)k++;return THREE.MathUtils.lerp(radii[k-1],radii[k],(d-lengths[k-1])/(lengths[k]-lengths[k-1]));};
 // Interpolate radius along sampled curve arc length. Tight bends still need mesh clearance checks.
 for(let inner=0;inner<2;inner++)for(let i=0;i<=segments;i++){const c=curve.getPointAt(i/segments),r=radiusAt(i/segments)-inner*wall;for(let j=0;j<sides;j++){const a=j/sides*Math.PI*2,p=c.clone().addScaledVector(frames.normals[i],Math.cos(a)*r).addScaledVector(frames.binormals[i],Math.sin(a)*r);v.push(...p.toArray());}}
 const stride=(segments+1)*sides;
 for(let inner=0;inner<2;inner++)for(let i=0;i<segments;i++)for(let j=0;j<sides;j++){const a=inner*stride+i*sides+j,b=inner*stride+i*sides+(j+1)%sides,c=a+sides,d=b+sides;if(inner)idx.push(a,c,b,b,c,d);else idx.push(a,b,c,b,d,c);}
 for(let j=0;j<sides;j++){let a=j,b=(j+1)%sides;idx.push(a,a+stride,b,b,a+stride,b+stride);a=segments*sides+j;b=segments*sides+(j+1)%sides;idx.push(a,b,a+stride,b,b+stride,a+stride);}
 const g=new THREE.BufferGeometry();g.setAttribute('position',new THREE.Float32BufferAttribute(v,3));g.setIndex(idx);g.computeVertexNormals();g.userData={wall,radii:[...radii],kind:'sweptTube'};return g;
}
export function seeded(seed=1){let s=seed>>>0;return()=>{s=(1664525*s+1013904223)>>>0;return s/4294967296;};}

// Constant wire radius as the axial length changes; shared geometry stays valid for outline shells.
export function coilSpring({radius=.25,wireRadius=.035,turns=5,length=1.4,segments=160,sides=8},material){
 positive('coilSpring',radius,wireRadius,turns,length);
 if(radius<=wireRadius||!Number.isInteger(segments)||segments<16||!Number.isInteger(sides)||sides<3)throw Error('coilSpring: invalid tessellation or radius');
 const minLength=2*wireRadius*(turns+1);
 class Helix extends THREE.Curve{constructor(h){super();this.h=h;}getPoint(t,target=new THREE.Vector3()){const a=t*turns*Math.PI*2;return target.set(radius*Math.cos(a),radius*Math.sin(a),this.h*t);}}
 const geometry=h=>{if(!Number.isFinite(h)||h<=minLength)throw Error('coilSpring: turns would overlap');return new THREE.TubeGeometry(new Helix(h),segments,wireRadius,sides,false);};
 const mesh=solid(geometry(length),material);mesh.userData.edges=false;let previous=length;
 return {mesh,setLength(h){if(h===previous)return;const next=geometry(h);for(const name of ['position','normal']){mesh.geometry.attributes[name].array.set(next.attributes[name].array);mesh.geometry.attributes[name].needsUpdate=true;}mesh.geometry.computeBoundingBox();mesh.geometry.computeBoundingSphere();next.dispose();previous=h;},minimumLength:minLength};
}
