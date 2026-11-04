import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {mountPreviewUI,transportContainer,transportRule,timelineBlock} from './preview-ui.js';

const $=id=>document.getElementById(id);
try {
const model=await (await fetch('./scene.json')).json();
const stage=$('stage'), scene=new THREE.Scene();
scene.background=new THREE.Color('#fafafa');
const camera=new THREE.PerspectiveCamera(34,1,.05,100); camera.up.set(0,0,1);
camera.position.set(-6,-7.5,5.3);
const renderer=new THREE.WebGLRenderer({antialias:true});
renderer.setPixelRatio(Math.min(devicePixelRatio,2)); renderer.shadowMap.enabled=true;
renderer.shadowMap.type=THREE.PCFShadowMap; renderer.outputColorSpace=THREE.SRGBColorSpace;
renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;
renderer.setClearColor('#fafafa'); stage.append(renderer.domElement);
renderer.domElement.setAttribute('aria-label','可旋转的离心泵三维模型');
const controls=new OrbitControls(camera,renderer.domElement); controls.target.set(-.1,0,1.25);
controls.enableDamping=true; controls.minDistance=3;controls.maxDistance=18;controls.maxPolarAngle=Math.PI*.88;
scene.add(new THREE.HemisphereLight('#f6faf7','#8b9e9d',2.4));
const key=new THREE.DirectionalLight('#fff6e7',3.2);key.position.set(-3,-5,8);key.castShadow=true;
Object.assign(key.shadow.camera,{left:-6,right:6,top:6,bottom:-6});key.shadow.mapSize.set(2048,2048);key.shadow.bias=-.0003;scene.add(key);
const fill=new THREE.DirectionalLight('#dbf3ff',1.2);fill.position.set(3,4,3);scene.add(fill);
const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.MeshStandardMaterial({color:'#f3f4f5',roughness:1}));ground.position.z=.005;ground.receiveShadow=true;scene.add(ground);
const groups=new Map(), meshes=new Map();
for(const g of model.groups){const o=new THREE.Group();o.name=g.id;o.position.fromArray(g.rest);scene.add(o);groups.set(g.id,o);}
for(const p of model.parts){
 const geometry=new THREE.BufferGeometry();geometry.setAttribute('position',new THREE.Float32BufferAttribute(p.mesh.vertices.flat(),3));geometry.setIndex(p.mesh.faces.flat());geometry.computeVertexNormals();
 const material=new THREE.MeshStandardMaterial({color:p.color,roughness:.43,metalness:.25,flatShading:!p.smooth});
 const mesh=new THREE.Mesh(geometry,material);mesh.name=p.id;mesh.userData.part=p;mesh.position.fromArray(p.pos);mesh.rotation.set(...p.rotation,'ZYX');mesh.castShadow=true;mesh.receiveShadow=true;groups.get(p.group).add(mesh);meshes.set(p.id,mesh);
}
const flowRoot=new THREE.Group();scene.add(flowRoot);
const flowPath=new THREE.CatmullRomCurve3(model.flow.map(p=>new THREE.Vector3(...p)),false,'centripetal');
const pathMesh=new THREE.Mesh(new THREE.TubeGeometry(flowPath,80,.015,6,false),new THREE.MeshBasicMaterial({color:'#3dafa8',transparent:true,opacity:.45,depthTest:false}));pathMesh.renderOrder=2;flowRoot.add(pathMesh);
const markers=[];for(let i=0;i<9;i++){const m=new THREE.Mesh(new THREE.SphereGeometry(.042,10,8),new THREE.MeshBasicMaterial({color:'#117e7a',depthTest:false}));m.renderOrder=3;flowRoot.add(m);markers.push(m);}
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
const state={explode:0,phase:0,speed:1,playing:!reduced.matches,cutaway:true,flow:true,selected:'hub'};
for(const p of model.parts){const o=document.createElement('option');o.value=p.id;o.textContent=p.label;$('component').append(o);}
function select(id){state.selected=id;$('component').value=id;const p=meshes.get(id).userData.part;$('part-title').textContent=p.label;$('part-note').textContent=p.note;for(const [key,m]of meshes)m.material.emissive.set(key===id?'#503016':'#000000');}
function apply(){
 for(const g of model.groups){const o=groups.get(g.id);o.position.set(...g.rest).addScaledVector(new THREE.Vector3(...g.explode),state.explode);o.visible=!(g.cover&&state.cutaway);if(g.spin)o.rotation[g.spin]=state.phase*Math.PI*2;}
 flowRoot.visible=state.flow&&state.explode<.001;
 markers.forEach((m,i)=>m.position.copy(flowPath.getPointAt((state.phase*.45+i/markers.length)%1)));
 $('phase').textContent=String(Math.round((state.phase%1)*360)%360);$('explode-value').value=`${Math.round(state.explode*100)}%`;
 $('flow-note').textContent=state.explode>0?'拆解中：流向已隐藏，避免表示断开的管路仍然连通。':'流线仅解释路径，不代表流速或压力。';
 // Read-only diagnostics in DOM; same state that positions the actual model.
 stage.dataset.state=JSON.stringify({parts:meshes.size,explode:state.explode,phase:state.phase,playing:state.playing,flowVisible:flowRoot.visible,coverVisible:groups.get('cover').visible,selected:state.selected,groupPositions:Object.fromEntries([...groups].map(([id,o])=>[id,o.position.toArray()]))});
}
function setPlay(value){state.playing=value;$('play').textContent=value?'暂停':'播放';}
$('explode').addEventListener('input',e=>{state.explode=Number(e.target.value)/100;apply();});
$('cutaway').addEventListener('change',e=>{state.cutaway=e.target.checked;apply();});
$('flow').addEventListener('change',e=>{state.flow=e.target.checked;apply();});
$('component').addEventListener('change',e=>select(e.target.value));
$('speed').addEventListener('input',e=>{state.speed=Number(e.target.value);$('speed-value').value=`${state.speed.toFixed(2)}×`;});
$('play').addEventListener('click',()=>setPlay(!state.playing));
$('front').addEventListener('click',()=>{camera.position.set(-9,0,1.6);controls.target.set(-.1,0,1.25);controls.update();});
$('back').addEventListener('click',()=>{camera.position.set(7,8,5);controls.target.set(-.1,0,1.25);controls.update();});
$('reset').addEventListener('click',()=>{Object.assign(state,{explode:0,phase:0,speed:1,cutaway:true,flow:true});$('explode').value=0;$('speed').value=1;$('speed-value').value='1.0×';$('cutaway').checked=true;$('flow').checked=true;camera.position.set(-6,-7.5,5.3);controls.target.set(-.1,0,1.25);setPlay(!reduced.matches);select('hub');apply();});
let down=null;const raycaster=new THREE.Raycaster();
renderer.domElement.addEventListener('pointerdown',e=>{down=[e.clientX,e.clientY];});
renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const r=renderer.domElement.getBoundingClientRect();raycaster.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,-(e.clientY-r.top)/r.height*2+1),camera);const hits=raycaster.intersectObjects([...meshes.values()].filter(m=>m.parent.visible));if(hits[0])select(hits[0].object.name);});
new ResizeObserver(()=>{const w=stage.clientWidth,h=stage.clientHeight;renderer.setSize(w,h);camera.aspect=w/h;camera.updateProjectionMatrix();}).observe(stage);
let visible=true;new IntersectionObserver(e=>{visible=e[0].isIntersecting;}).observe(stage);
let last=null;function tick(now){const dt=last===null?0:Math.max(0,Math.min((now-last)/1000,.06));last=now;if(visible&&!document.hidden){if(state.playing)state.phase=(state.phase+dt*state.speed*.18)%20;apply();controls.update();renderer.render(scene,camera);}requestAnimationFrame(tick);}
const transport=transportContainer();transport.append($('play'),transportRule(),timelineBlock(document.querySelector('label[for=speed]'),$('speed')),$('phase-readout'));
mountPreviewUI({tabs:[{id:'structure',label:'结构',element:$('assembly-section')},{id:'components',label:'部件',element:$('components-section')},{id:'about',label:'说明',element:$('about-section')}],views:[$('reset'),$('front'),$('back')],transport,kind:'pump',sceneLabel:'机械结构',sceneIndex:'01 / CENTRIFUGAL PUMP',panelTitle:'探索结构',pickControl:$('component'),pickTab:'components'});
setPlay(state.playing);select('hub');apply();requestAnimationFrame(tick);
} catch(e) {$('error').hidden=false;$('error').textContent='模型加载失败：'+e.message;console.error(e);}
