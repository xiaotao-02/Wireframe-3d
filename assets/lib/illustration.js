import * as T from 'three';
// Theme values extracted from the MIT upstream light tokens. Rendering is an original Three.js implementation.
export const LIGHT_THEME=Object.freeze({paper:'#fbfbfa',background:'#f2f2ef',face:'#ffffff',shade:['#dcdcd9','#e5e5e2','#ededea','#f4f4f1'],ink:'#727276',faint:'#b4b4b8',accent:'#e88a46',blue:'#456f9c',red:'#c65348',lineWidth:.65});
export function materialRole(role='structure',color='#ffffff'){
 const m=new T.MeshStandardMaterial({color,roughness:.85,metalness:role==='metal'?.12:0});m.userData.anatomyRole=role;return m;
}
export function illustrationPalette(){return {body:materialRole('subject'),frame:materialRole('structure'),base:materialRole('base','#ecece9'),metal:materialRole('metal','#d8dadb'),dark:materialRole('dark','#9b9c9c'),accent:materialRole('accent',LIGHT_THEME.accent),blue:materialRole('blue',LIGHT_THEME.blue),red:materialRole('red',LIGHT_THEME.red),glass:new T.MeshBasicMaterial({color:'#d2e2e6',transparent:true,opacity:.16,depthWrite:false})};}
const vertex=`varying vec3 vN;varying vec3 vPosition;varying vec3 vTint;
#include <common>
#include <normal_pars_vertex>
void main(){
 #include <beginnormal_vertex>
 #include <defaultnormal_vertex>
 vN=normalize(transformedNormal);
 vTint=vec3(1.);
 #ifdef USE_INSTANCING_COLOR
 vTint*=instanceColor.rgb;
 #endif
 #if defined(USE_COLOR) || defined(USE_COLOR_ALPHA)
 vTint*=color.rgb;
 #endif
 vec3 transformed=position;
 #include <project_vertex>
 vPosition=mvPosition.xyz;
}`;
function inkMaterial(role,original,instanceColor){
 const accent=!['structure','subject','base','metal'].includes(role)||!!instanceColor||original.vertexColors;
 const base=original.color?.clone()||new T.Color('#ffffff');
 const mat=new T.ShaderMaterial({uniforms:{uBase:{value:base},uLow:{value:new T.Color(LIGHT_THEME.shade[0])},uHigh:{value:new T.Color('#ffffff')},uAccent:{value:accent?1:0},uLift:{value:role==='base'?-.035:role==='metal'?-.015:0},uClay:{value:0}},vertexShader:vertex,fragmentShader:`
 varying vec3 vN;varying vec3 vPosition;varying vec3 vTint;uniform vec3 uBase;uniform vec3 uLow;uniform vec3 uHigh;uniform float uAccent;uniform float uLift;uniform float uClay;
 void main(){vec3 n=normalize((vec4(vN,0.)*viewMatrix).xyz);float facing=dot(n,normalize(vec3(-.45,-.4,1.2)));float shade=clamp(facing+.1,0.,1.);vec3 neutral=mix(uLow,uHigh,clamp(shade+uLift,0.,1.));vec3 pigment=mix(uBase*.78,uBase,shade)*vTint;gl_FragColor=vec4(mix(neutral,pigment,uAccent*(1.-uClay)),1.);
 #include <colorspace_fragment>
 }`,vertexColors:!!original.vertexColors,toneMapped:false,side:original.side});mat.name='Anatomy light / '+role;return mat;
}
const hullVertex=`uniform vec2 uResolution;uniform float uWidth;void main(){vec3 p=position;vec3 n=normal;
 #ifdef USE_INSTANCING
 p=(instanceMatrix*vec4(p,1.)).xyz;mat3 im=mat3(instanceMatrix);n/=vec3(dot(im[0],im[0]),dot(im[1],im[1]),dot(im[2],im[2]));n=im*n;
 #endif
 vec4 clip=projectionMatrix*modelViewMatrix*vec4(p,1.);vec3 vn=normalize(normalMatrix*n);vec2 sn=(projectionMatrix*vec4(vn,0.)).xy;float len=length(sn);if(len>.0001)clip.xy+=sn/len*(uWidth*2./uResolution)*clip.w;gl_Position=clip;}`;
function halo(bounds){const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),g=ctx.createRadialGradient(64,64,4,64,64,63);g.addColorStop(0,'rgba(88,88,76,.14)');g.addColorStop(.6,'rgba(88,88,76,.08)');g.addColorStop(1,'rgba(88,88,76,0)');ctx.fillStyle=g;ctx.fillRect(0,0,128,128);const tex=new T.CanvasTexture(c),s=bounds.getSize(new T.Vector3()),ctr=bounds.getCenter(new T.Vector3());const m=new T.Mesh(new T.PlaneGeometry(s.x*1.4,s.y*1.5),new T.MeshBasicMaterial({map:tex,transparent:true,depthWrite:false,toneMapped:false}));m.position.set(ctr.x,ctr.y,bounds.min.z-.003);m.userData.auditIgnore=true;return m;}
export function mountIllustration(root,{renderer,scene,bounds,preset='anatomy-light'}={}){
 const studioBackground=scene.background?.clone?.()??scene.background,studioToneMapping=renderer.toneMapping;
 const decals=new Map(),hiddenDecal=new T.MeshBasicMaterial({transparent:true,opacity:0,depthWrite:false,colorWrite:false});
 root.traverse(o=>{if(o.isMesh&&o.userData.isSurfaceDecal)decals.set(o,o.material);});
 const originals=new Map(),decor=[],materials=new Map(),hulls=[],creases=[],size=new T.Vector2(),nodes=[];root.traverse(o=>{if(o.isMesh&&!o.userData.noStyle&&!o.userData.auditIgnore)nodes.push(o);});
 const hullMat=new T.ShaderMaterial({uniforms:{uResolution:{value:new T.Vector2(1000,700)},uWidth:{value:LIGHT_THEME.lineWidth},uInk:{value:new T.Color(LIGHT_THEME.ink)}},vertexShader:hullVertex,fragmentShader:'uniform vec3 uInk;void main(){gl_FragColor=vec4(uInk,1.);\n#include <colorspace_fragment>\n}',side:T.BackSide,depthWrite:true,toneMapped:false});
 const edgeMat=new T.LineBasicMaterial({color:LIGHT_THEME.faint,transparent:true,opacity:.68,depthWrite:false,toneMapped:false}),lineMaterials=new Map([[1,{hull:hullMat,edge:edgeMat}]]);
 for(const o of nodes){const list=[o.material].flat();originals.set(o,{material:o.material,color:o.instanceColor});if(list.some(m=>m.transparent)){continue;}
 const converted=list.map(m=>{const role=o.userData.role||m.userData.anatomyRole||'structure',key=role+':'+m.uuid+':'+!!o.instanceColor;if(!materials.has(key))materials.set(key,inkMaterial(role,m,o.instanceColor));return materials.get(key);});o.userData.illustrationMaterial=Array.isArray(o.material)?converted:converted[0];
 const weight=o.userData.lineWeight??1;if(!Number.isFinite(weight)||weight<0||weight>2)throw Error('lineWeight must be in [0,2]');if(weight===0)continue;
 if(!lineMaterials.has(weight)){const h=hullMat.clone(),e=edgeMat.clone();h.uniforms.uWidth.value=LIGHT_THEME.lineWidth*weight;e.opacity*=Math.min(1,weight);lineMaterials.set(weight,{hull:h,edge:e});}
 const line=lineMaterials.get(weight);
 if(!o.userData.thinSurface&&!list.some(m=>m.side===T.DoubleSide)){
 let hull;if(o.isInstancedMesh){hull=new T.InstancedMesh(o.geometry,line.hull,o.instanceMatrix.count);hull.instanceMatrix=o.instanceMatrix;hull.count=o.count;}else hull=new T.Mesh(o.geometry,line.hull);
 hull.userData.auditIgnore=true;hull.userData.isIllustrationDecoration=true;hull.raycast=()=>{};hull.renderOrder=-1;o.add(hull);decor.push(hull);hulls.push({source:o,hull});
 }
 if(!o.isInstancedMesh&&o.userData.edges!==false&&!o.userData.dynamicGeometry){const edges=new T.LineSegments(new T.EdgesGeometry(o.geometry,35),line.edge);edges.userData.auditIgnore=true;edges.userData.isIllustrationDecoration=true;edges.raycast=()=>{};edges.renderOrder=1;o.add(edges);decor.push(edges);creases.push({source:o,edges,geometry:o.geometry,version:o.geometry.attributes.position.version});}
 }
 const contact=halo(bounds);scene.add(contact);let active=true,clay=false,focus=false,exploded=false;const white=new T.MeshStandardMaterial({color:'#deded9',roughness:.9});
 function refresh(){for(const [o,old] of originals){o.material=active?(o.userData.illustrationMaterial||old.material):(clay?white:old.material);if(o.isInstancedMesh)o.instanceColor=!active&&clay?null:old.color;}for(const [o,material]of decals)o.material=clay?hiddenDecal:material;for(const m of materials.values())m.uniforms.uClay.value=clay?1:0;for(const d of decor)d.visible=active;contact.visible=active&&!focus&&!exploded;scene.background=active?new T.Color(LIGHT_THEME.paper):studioBackground;renderer.toneMapping=active?T.NoToneMapping:studioToneMapping;}
 function update(){renderer.getSize(size);for(const m of lineMaterials.values())m.hull.uniforms.uResolution.value.copy(size);
  for(const {source,hull} of hulls){hull.geometry=source.geometry;if(source.isInstancedMesh){hull.instanceMatrix=source.instanceMatrix;hull.count=source.count;hull.boundingBox=null;hull.boundingSphere=null;}}
  for(const c of creases){const g=c.source.geometry,v=g.attributes.position.version;if(c.geometry!==g||c.version!==v){c.edges.geometry.dispose();c.edges.geometry=new T.EdgesGeometry(g,35);c.geometry=g;c.version=v;}}
 }
 refresh();return {setEnabled(value){active=value;refresh();},setClay(value,style){clay=value;white.color.set(style?.color||'#deded9');white.roughness=style?.roughness??.9;refresh();},setFocus(value){if(focus!==value){focus=value;refresh();}},setExploded(value){if(exploded!==value){exploded=value;refresh();}},update,metadata:{preset,theme:LIGHT_THEME,source:'Anatomy light tokens; original smooth normal shading + depth-tested silhouette and crease implementation',limitations:'Contact halo is illustrative, not a light transport simulation. Instances share synchronized hulls; thin/double-sided surfaces omit hulls; dynamicGeometry opts out of crease rebuilding.'},dispose(){for(const [o,old]of originals){o.material=old.material;if(o.isInstancedMesh)o.instanceColor=old.color;delete o.userData.illustrationMaterial;}for(const [o,m]of decals)o.material=m;hiddenDecal.dispose();for(const d of decor)d.removeFromParent();for(const c of creases)c.edges.geometry.dispose();contact.removeFromParent();contact.geometry.dispose();contact.material.map.dispose();contact.material.dispose();for(const m of lineMaterials.values()){m.hull.dispose();m.edge.dispose();}for(const m of materials.values())m.dispose();white.dispose();}};
}
