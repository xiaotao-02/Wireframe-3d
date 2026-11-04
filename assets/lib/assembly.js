import * as T from 'three';
// Original assembly contracts. Scene units are chosen by the caller; tolerances must use those units.
const V=a=>new T.Vector3(...a), finite=a=>Array.isArray(a)&&a.length===3&&a.every(Number.isFinite);
const eps=1e-9, probeMaterial=new T.MeshBasicMaterial({side:T.DoubleSide});
export function port(node,{id,position=[0,0,0],normal=[0,0,1],up=[1,0,0],diameter=null,pattern=null}={}){
 if(!node?.isObject3D||!id||!finite(position)||!finite(normal)||!finite(up)||V(normal).length()<eps||V(normal).cross(V(up)).length()<eps)throw Error('Invalid interface frame: '+id);
 if(diameter!==null&&(!Number.isFinite(diameter)||diameter<=0))throw Error('Invalid interface diameter');
 if(pattern&&(!Number.isInteger(pattern.count)||pattern.count<1||!Number.isFinite(pattern.circle)||pattern.circle<=0))throw Error('Invalid bolt pattern');
 return {id,node,position:[...position],normal:V(normal).normalize().toArray(),up:V(up).normalize().toArray(),diameter,pattern};
}
export function worldPort(p){
 port(p.node,p); // Revalidate mutable descriptors before measuring, not only when created.
 p.node.updateWorldMatrix(true,false);const m=p.node.matrixWorld,normal=V(p.normal).applyMatrix3(new T.Matrix3().getNormalMatrix(m)).normalize();
 const up=V(p.up).transformDirection(m).addScaledVector(normal,-V(p.up).transformDirection(m).dot(normal)).normalize();
 const s=new T.Vector3().setFromMatrixScale(m);if(![...m.elements].every(Number.isFinite)||Math.min(s.x,s.y,s.z)<eps||m.determinant()<=0||Math.max(s.x,s.y,s.z)-Math.min(s.x,s.y,s.z)>1e-6)throw Error('Interface node needs positive uniform world scale: '+p.id);
 return {position:V(p.position).applyMatrix4(m),normal,up,diameter:p.diameter===null?null:p.diameter*s.x,scale:s.x,pattern:p.pattern};
}
export function assemblyPart({id,node,ports=[],source='original',...rest}){
 if(!id||!node?.isObject3D||new Set(ports.map(p=>p.id)).size!==ports.length)throw Error('Invalid part or duplicate interface: '+id);
 for(const p of ports){let n=p.node;while(n&&n!==node)n=n.parent;if(!n)throw Error(`Interface ${id}.${p.id} is outside its part`);}
 return {id,node,ports,source,...rest};
}
function meshes(object){
 if(!object?.isObject3D)throw Error('Expected actual Object3D geometry');
 const out=[];out.unsupported=[];object.updateWorldMatrix(true,true);
 // Traverse explicitly so an ignored helper parent also excludes all of its children.
 function visit(o){
  if(o.userData.auditIgnore)return;
  if(o.userData.auditRole==='proxy'){out.unsupported.push('Audit proxy is not display geometry');return;}
  if(o.isMesh&&o.geometry?.attributes.position){
   const g=o.geometry,n=g.index?.count??g.attributes.position.count;
   if(o.isSkinnedMesh||o.morphTexture||o.morphTargetInfluences?.some(x=>x!==0)||o.userData.auditDeformation){out.unsupported.push('Deformation must be baked to actual triangles before measuring');return;}
   if(g.drawRange.start!==0||g.drawRange.count<n){out.unsupported.push('Partial drawRange must be baked before measuring');return;}
   if(o.isInstancedMesh){const m=new T.Matrix4();for(let i=0;i<o.count;i++){o.getMatrixAt(i,m);const p=new T.Mesh(g,probeMaterial);p.matrixWorld.multiplyMatrices(o.matrixWorld,m);out.push(p);}}
   else {const p=new T.Mesh(g,probeMaterial);p.matrixWorld.copy(o.matrixWorld);out.push(p);}
  }
  for(const child of o.children)visit(child);
 }
 visit(object);return out;
}
const unsupported=ps=>ps.unsupported.length?{status:'unverified',reason:[...new Set(ps.unsupported)].join('; ')}:null;
function rayHit(proxies,origin,direction,max=Infinity){return new T.Raycaster(origin,direction.normalize(),0,max).intersectObjects(proxies,false);}
function triangles(proxies){const result=[];for(const p of proxies){const g=p.geometry,a=g.attributes.position,idx=g.index,n=idx?idx.count:a.count;
 for(let i=0;i<n;i+=3){const vs=[0,1,2].map(k=>new T.Vector3().fromBufferAttribute(a,idx?idx.getX(i+k):i+k).applyMatrix4(p.matrixWorld));const tri=new T.Triangle(...vs);if(tri.getArea()>eps)result.push({tri,box:new T.Box3().setFromPoints(vs)});}}
 return result;}
const bboxDistanceSq=(a,b)=>['x','y','z'].reduce((s,k)=>s+Math.max(0,a.min[k]-b.max[k],b.min[k]-a.max[k])**2,0);
function segmentDistanceSq(p1,q1,p2,q2){const d1=q1.clone().sub(p1),d2=q2.clone().sub(p2),r=p1.clone().sub(p2),a=d1.dot(d1),e=d2.dot(d2),f=d2.dot(r);let s=0,t=0;
 if(a<=eps&&e<=eps)return p1.distanceToSquared(p2);if(a<=eps)t=T.MathUtils.clamp(f/e,0,1);else{const c=d1.dot(r);if(e<=eps)s=T.MathUtils.clamp(-c/a,0,1);else{const b=d1.dot(d2),den=a*e-b*b;s=den?T.MathUtils.clamp((b*f-c*e)/den,0,1):0;t=(b*s+f)/e;if(t<0){t=0;s=T.MathUtils.clamp(-c/a,0,1);}else if(t>1){t=1;s=T.MathUtils.clamp((b-c)/a,0,1);}}}
 return p1.clone().addScaledVector(d1,s).distanceToSquared(p2.clone().addScaledVector(d2,t));
}
function triDistanceSq(a,b){const av=[a.a,a.b,a.c],bv=[b.a,b.b,b.c],tmp=new T.Vector3();let best=Infinity;
 for(const p of av)best=Math.min(best,p.distanceToSquared(b.closestPointToPoint(p,tmp)));for(const p of bv)best=Math.min(best,p.distanceToSquared(a.closestPointToPoint(p,tmp)));
 for(let i=0;i<3;i++){for(const [vs,other] of [[av,b],[bv,a]]){const d=vs[(i+1)%3].clone().sub(vs[i]),len=d.length();if(len>eps){const hit=new T.Ray(vs[i],d.divideScalar(len)).intersectTriangle(other.a,other.b,other.c,false,tmp);if(hit&&hit.distanceTo(vs[i])<=len+eps)return 0;}}
 for(let j=0;j<3;j++)best=Math.min(best,segmentDistanceSq(av[i],av[(i+1)%3],bv[j],bv[(j+1)%3]));}return best;
}
function inside(point,proxies){const hits=rayHit(proxies,point,new T.Vector3(.721,.411,.557)),ds=[];for(const h of hits)if(h.distance>1e-7&&(!ds.length||Math.abs(h.distance-ds.at(-1))>1e-6))ds.push(h.distance);return ds.length%2===1;}
export function meshClearance(a,b,{minGap=0,maxPairs=180000,closedA=true,closedB=true}={}){
 if(!Number.isFinite(minGap)||minGap<0)throw Error('Clearance needs a nonnegative gap');
 if(!Number.isSafeInteger(maxPairs)||maxPairs<0)throw Error('Clearance needs a nonnegative integer pair budget');
 const pa=meshes(a),pb=meshes(b);if(unsupported(pa)||unsupported(pb))return unsupported(pa)||unsupported(pb);
 const ta=triangles(pa),tb=triangles(pb);if(!ta.length||!tb.length)return {status:'unverified',reason:'Missing actual triangle geometry'};
 const ba=new T.Box3(),bb=new T.Box3();for(const t of ta)ba.union(t.box);for(const t of tb)bb.union(t.box);const lower=Math.sqrt(bboxDistanceSq(ba,bb));if(lower>minGap+eps)return {status:'pass',lowerBound:lower,method:'world mesh bounds lower bound',pairs:0};
 // Surface distance alone misses one solid contained within another. Odd/even tests assume closed shells.
 if((closedA&&inside(tb[0].tri.a,pa))||(closedB&&inside(ta[0].tri.a,pb)))return {status:'fail',distance:0,reason:'Solid containment',method:'actual mesh ray parity',pairs:0};
 let best=Infinity,pairs=0;for(const x of ta)for(const y of tb){if(bboxDistanceSq(x.box,y.box)>Math.min(best,(minGap+1e-7)**2))continue;
 if(++pairs>maxPairs)return {status:'unverified',reason:'Triangle pair budget exceeded',pairs,truncated:true};best=Math.min(best,triDistanceSq(x.tri,y.tri));if(best<=minGap**2+1e-14)return {status:'fail',distance:Math.sqrt(best),method:'actual triangle distance/intersection',pairs};}
 return {status:'pass',lowerBound:minGap,method:'all candidate triangle pairs exceed required gap',pairs};
}
export function measureBore({mesh,frame,depth,expectedDiameter,tolerance=.001,samples=8}){
 if(!Number.isFinite(depth)||depth<=0||!Number.isFinite(expectedDiameter)||expectedDiameter<=0||!Number.isFinite(tolerance)||tolerance<0||!Number.isInteger(samples)||samples<3)throw Error('Invalid bore measurement parameters');
 const f=worldPort(frame),axis=f.normal,radial=f.up,side=axis.clone().cross(radial),center=f.position.clone().addScaledVector(axis,-depth*f.scale/2),ps=meshes(mesh),radii=[];
 if(unsupported(ps))return unsupported(ps);
 // Offset radial probes from tessellation seams, where Float32 shared-edge rounding can lose an exact-cardinal ray.
 for(let i=0;i<samples;i++){const a=2*Math.PI*(i+.173)/samples,d=radial.clone().multiplyScalar(Math.cos(a)).addScaledVector(side,Math.sin(a)),hit=rayHit(ps,center,d,expectedDiameter*f.scale*2)[0];if(!hit)return {status:'fail',reason:'Bore wall not found',sample:i};radii.push(hit.distance);}
 const diameters=radii.map(r=>2*r),expected=expectedDiameter*f.scale,through=rayHit(ps,f.position.clone().addScaledVector(axis,depth*f.scale*.1),axis.clone().negate(),depth*f.scale*1.2).length===0;
 return {status:through&&diameters.every(d=>Math.abs(d-expected)<=tolerance*f.scale)?'pass':'fail',diameters,expected,through,method:'actual mesh radial and axial rays',reason:through?'':'Bore center blocked'};
}
export function measureSurface({mesh,frame,points=[[0,0]],reach=.03,tolerance=.001}){
 if(!points.length||points.some(p=>!Array.isArray(p)||p.length!==2||!p.every(Number.isFinite))||!Number.isFinite(reach)||reach<=0||!Number.isFinite(tolerance)||tolerance<0)throw Error('Invalid surface measurement parameters');
 const f=worldPort(frame),side=f.normal.clone().cross(f.up),ps=meshes(mesh),errors=[];
 if(unsupported(ps))return unsupported(ps);
 for(const [u,v] of points){const target=f.position.clone().addScaledVector(f.up,u*f.scale).addScaledVector(side,v*f.scale),h=rayHit(ps,target.clone().addScaledVector(f.normal,reach*f.scale),f.normal.clone().negate(),2*reach*f.scale)[0];errors.push(h?Math.abs(h.distance-reach*f.scale):null);}
 return {status:errors.every(e=>e!==null&&e<=tolerance*f.scale)?'pass':'fail',errors,method:'actual mesh interface surface rays'};
}
function angle(a,b){return Math.acos(T.MathUtils.clamp(a.dot(b),-1,1))*180/Math.PI;}
export function auditAssembly({root,parts,relations=[],features=[],grounded=[]},{assembled=true}={}){
 if(!root?.isObject3D||!Array.isArray(parts))throw Error('Assembly needs a root and semantic parts');
 const within=(node,parent)=>{for(let n=node;n;n=n.parent)if(n===parent)return true;return false;};
 for(const p of parts)if(!p.node?.isObject3D||p.node===root||!within(p.node,root))throw Error('Semantic part is outside declared root: '+p.id);
 const actual=node=>{
  if(!node?.isObject3D||!within(node,root)||!parts.some(p=>within(node,p.node)))throw Error('Measurement target is outside semantic display parts');
  for(let n=node;n;n=n.parent){if(n.userData.auditIgnore||n.userData.auditRole==='proxy')throw Error('Measurement target is an ignored helper or audit proxy');if(n===root)break;}
 };
 for(const p of parts)assemblyPart(p); // Detect ports appended/reparented after part construction.
 if(new Set([...relations,...features].map(r=>r.id)).size!==relations.length+features.length)throw Error('Duplicate check id');
 root.updateWorldMatrix(true,true);const results=[],byId=new Map(parts.map(p=>[p.id,p]));if(byId.size!==parts.length)throw Error('Duplicate part id');
 if(grounded.some(id=>!byId.has(id)))throw Error('Unknown grounded part');
 const get=ref=>{const [id,name]=ref.split('.'),p=byId.get(id)?.ports?.find(p=>p.id===name);if(!p)throw Error('Unknown interface '+ref);return worldPort(p);};
 const graph=new Map(parts.map(p=>[p.id,new Set()]));const link=(a,b)=>{graph.get(a)?.add(b);graph.get(b)?.add(a);};
 for(const r of relations){if(!r.id)throw Error('Relation needs id');if(r.when!=='always'&&!assembled){results.push({id:r.id,status:'not-applicable',reason:'Released for exploded presentation'});continue;}
 try{let out;if(r.type==='clearance'){actual(r.a);actual(r.b);out=meshClearance(r.a,r.b,r);}
 else{const a=get(r.a),b=get(r.b),delta=b.position.clone().sub(a.position),axial=delta.dot(a.normal),radial=delta.clone().addScaledVector(a.normal,-axial).length(),tol=r.tolerance??.001,angleError=angle(a.normal,r.opposed===false?b.normal:b.normal.clone().negate());
 if(!Number.isFinite(tol)||tol<0||!Number.isFinite(r.angleTolerance??.5)||(r.angleTolerance??.5)<0)throw Error('Invalid relation tolerance');
 if(r.type==='slider'&&(!Array.isArray(r.travel)||r.travel.length!==2||!r.travel.every(Number.isFinite)||r.travel[0]>r.travel[1]))throw Error('Invalid slider travel');
 if(r.type==='mate'||r.type==='support'){
 const positionError=delta.length(),diameterError=a.diameter!==null&&b.diameter!==null?Math.abs(a.diameter-b.diameter):null;let patternError=null;
 if(a.pattern||b.pattern){if(!a.pattern||!b.pattern||a.pattern.count!==b.pattern.count)patternError=Infinity;else{const count=a.pattern.count,step=360/count,roll=angle(a.up,b.up)%step;patternError=Math.min(roll,step-roll);if(Math.abs(a.pattern.circle*a.scale-b.pattern.circle*b.scale)>tol)patternError=Infinity;}}
 out={status:positionError<=tol&&angleError<=(r.angleTolerance??.5)&&(diameterError===null||diameterError<=tol)&&(patternError===null||patternError<=(r.angleTolerance??.5))?'pass':'fail',positionError,angleError,diameterError,patternError};
 }else if(r.type==='coaxial'||r.type==='slider'){const axisError=Math.min(angleError,180-angleError),within=r.type!=='slider'||(axial>=r.travel[0]-tol&&axial<=r.travel[1]+tol);out={status:radial<=tol&&axisError<=(r.angleTolerance??.5)&&within?'pass':'fail',radialError:radial,angleError:axisError,axial,withinTravel:within};}
 else throw Error('Unsupported constraint '+r.type);
 if(out.status==='pass'&&r.carries!==false)link(r.a.split('.')[0],r.b.split('.')[0]);}
 results.push({id:r.id,type:r.type,...out});}catch(e){results.push({id:r.id,status:'fail',reason:e.message});}}
 for(const f of features){try{if(f.type==='bore'||f.type==='surface'){actual(f.mesh);actual(f.frame?.node);}const out=f.type==='bore'?measureBore(f):f.type==='surface'?measureSurface(f):{status:'unverified',reason:'Unknown mesh feature'};results.push({id:f.id,type:f.type,...out});}catch(e){results.push({id:f.id,status:'fail',reason:e.message});}}
 if(assembled&&grounded.length){const reached=new Set(grounded),queue=[...grounded];while(queue.length)for(const n of graph.get(queue.shift())??[])if(!reached.has(n)){reached.add(n);queue.push(n);}for(const p of parts)if(p.requiresSupport!==false)results.push({id:'support-path:'+p.id,type:'support-path',status:reached.has(p.id)?'pass':'fail',reason:reached.has(p.id)?'Connected through passed declared interfaces':'No passed connection path to a declared base'});}
 const count=s=>results.filter(x=>x.status===s).length;return {status:count('fail')?'fail':count('unverified')?'unverified':results.some(x=>x.status==='pass')?'pass':'unconfigured',passed:count('pass'),failed:count('fail'),unverified:count('unverified'),notApplicable:count('not-applicable'),results,scope:'Declared relationships and actual mesh features only. Support graph is connectivity, not structural strength. Discrete samples do not prove continuous clearance.'};
}
