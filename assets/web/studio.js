import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {buildScene} from './subject.js';
import {fitOrthographic,studioLighting,visibleGeometryBounds} from './lib/presentation.js';
import {mountPreviewUI,transportContainer} from './preview-ui.js';
import {mountIllustration} from './lib/illustration.js';
import {auditAssembly} from './lib/assembly.js';
import {createMotion} from './lib/motion.js';
import {createSceneRuntime} from './lib/scene-runtime.js';
import {auditExplosion} from './lib/explosion.js';
import buildInfo from './build-info.js';
import {referenceView,fitReferenceView,dimensionReport,projectProbes} from './lib/reference-geometry.js';
import {auditMeshAnchors} from './lib/mesh-anchors.js';
const $=id=>document.getElementById(id);
try {
 const model=await buildScene(),runtime=createSceneRuntime(model),{root,parts}=model;
 const reduced=matchMedia('(prefers-reduced-motion: reduce)'),motion=createMotion({reduced:reduced.matches,cycleAt:model.cycleAt});
 document.title=model.title;$('title').textContent=model.title;$('intro').textContent=model.description;$('description').textContent=model.description;
 const stage=$('stage'),scene=new THREE.Scene();scene.add(root);runtime.apply();
 const renderer=new THREE.WebGLRenderer({antialias:true});renderer.setPixelRatio(Math.min(devicePixelRatio,1.7));stage.prepend(renderer.domElement);renderer.domElement.setAttribute('aria-label',model.title+'三维模型');
 const camera=new THREE.OrthographicCamera();camera.up.set(0,0,1);
 const controls=new OrbitControls(camera,renderer.domElement);controls.enableDamping=true;controls.minZoom=.3;controls.maxZoom=15;
 const restBox=visibleGeometryBounds(root);if(restBox.isEmpty())throw Error('场景没有可取景的可见实体');const lightRig=studioLighting(scene,renderer,restBox,model.style);
 model.configurePresentation?.({scene,renderer,camera,controls,bounds:restBox,lightRig});
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(1000,1000),new THREE.ShadowMaterial({opacity:.12}));ground.position.z=restBox.min.z-.035;ground.receiveShadow=true;scene.add(ground);
 const ink=mountIllustration(root,{renderer,scene,bounds:restBox});
 let selected=parts[0].id,view='hero',focus=false,frames=0,frame=0,last=null,rendering=false,visible=true;
 let recipe={},audit=null,auditKey=null,telemetry={},lastAmount=-1,lastStroke=-1,manualCamera=false,lastPhase='';
 let motionBox=restBox.clone();
 const directions={hero:model.direction||[1,-1.4,1],back:(model.direction||[1,-1.4,1]).map((v,i)=>i<2?-v:v),top:[.001,-.001,1]};
 const referenceViews={front:{direction:[1,0,0],up:[0,0,1]},rear:{direction:[-1,0,0],up:[0,0,1]},side:{direction:[0,1,0],up:[0,0,1]},opposite:{direction:[0,-1,0],up:[0,0,1]},top:{direction:[0,0,1],up:[0,-1,0]},...(model.referenceViews||{})};
 for(const spec of Object.values(referenceViews))referenceView(spec);
 let reviewMode={enabled:false},beforeReview=null;
 const reviewCSS=document.createElement('style');reviewCSS.textContent='.reference-capture{height:100vh;min-height:0;overflow:hidden}.reference-capture .app-header,.reference-capture #panel,.reference-capture #stage>:not(canvas):not(#error){display:none!important}.reference-capture .preview-layout{display:block!important;position:fixed;inset:0;margin:0!important;padding:0!important;width:100vw!important;height:100vh!important;max-width:none!important}.reference-capture #stage{width:100%!important;height:100%!important;min-height:0!important;border:0!important;border-radius:0!important}.reference-capture #stage canvas{width:100%!important;height:100%!important}';document.head.append(reviewCSS);
 $('render-style').value=model.renderStyle==='studio'?'studio':'anatomy-light';ink.setEnabled($('render-style').value==='anatomy-light');
 $('operation').hidden=!model.setPose;$('stroke-label').textContent=model.strokeLabel||'机构行程';$('stroke').setAttribute('aria-label',model.strokeLabel||'机构行程');$('connection-check').hidden=!model.assembly&&!model.explosionChecks?.length&&!model.meshAnchorChecks?.length;
 const phaseLive=document.createElement('span');phaseLive.className='sr-only';phaseLive.setAttribute('aria-live','polite');stage.append(phaseLive);
 const play=document.createElement('button');play.id='play';play.textContent='暂停';
 const status=document.createElement('span');status.id='status';const dock=transportContainer();dock.append(play,status);
 function bounds(){let b=visibleGeometryBounds(focus?parts.find(p=>p.id===selected).node:root);if(b.isEmpty())b=visibleGeometryBounds(root);if(!focus&&!reviewMode.enabled&&motion.snapshot().amount===0)b.union(motionBox);return b.isEmpty()?restBox:b;}
 function fit(preserve=false){
   const w=stage.clientWidth,h=stage.clientHeight;if(!w||!h)return;
   const direction=preserve?camera.position.clone().sub(controls.target).toArray():directions[view];
   ground.visible=!focus&&$('render-style').value==='studio';ink.setFocus(focus);renderer.setSize(w,h);ink.update();
   if(reviewMode.enabled){ground.visible=false;recipe=fitReferenceView(camera,controls,bounds(),reviewMode.camera,w,h);}
   else if(!directions[view]&&referenceViews[view]&&!preserve)recipe=fitReferenceView(camera,controls,bounds(),referenceViews[view],w,h);
   else recipe=fitOrthographic(camera,controls,bounds(),{width:w,height:h,direction,insets:{top:Math.min(65,h*.16),bottom:Math.min(105,h*.23),left:24,right:24}});
 }
 function select(id){const p=parts.find(p=>p.id===id);if(!p)throw Error('Unknown part: '+id);selected=id;$('component').value=id;$('part-title').textContent=p.label;$('part-note').textContent=p.description;}
 function apply(){
   const s=motion.snapshot(),key=JSON.stringify([s.amount,s.stroke,s.time]);
   if(auditKey!==null&&key!==auditKey){audit=null;auditKey=null;$('connection-result').textContent='模型状态已改变，请重新检查当前连接。';}
   telemetry=runtime.apply(s);for(const p of parts)p.node.visible=p.node.visible&&(!$('isolate').checked||p.id===selected);
   ink.setExploded(s.amount>0);
   $('amount').value=Math.round(s.amount*100)+'%';$('explode').value=s.goal*100;$('apart').textContent=s.goal>.5?'合拢结构':'展开结构';
   $('stroke-value').textContent=Math.round(s.stroke*100)+'%';$('stroke').disabled=s.amount>0||s.goal>0;$('stroke').value=s.stroke*100;
   $('explode').style.setProperty('--range-progress',`${s.goal*100}%`);$('stroke').style.setProperty('--range-progress',`${s.stroke*100}%`);
   $('cycle').textContent=s.reduced?'减少动态效果：手动调节行程':s.armed?'正在合拢 · 等待启动':s.cycling?'停止机构':'运行机构';$('cycle').disabled=s.reduced;
   play.textContent=s.paused?'播放':'暂停';status.textContent=telemetry.readout||parts.length+' 组构件 · 真实三维';
   const phase=telemetry.phase||({assembling:'正在合拢',exploded:'已展开',moving:'正在拆装',running:'正在运行',ready:'已装配'})[s.phase];
   if(phase!==lastPhase){if(lastPhase)phaseLive.textContent=phase;lastPhase=phase;}
   if(Math.abs(s.amount-lastAmount)>.0001){fit(manualCamera);lastAmount=s.amount;}
   // Expand automatic framing when a moving part leaves the known envelope. Do not
   // fight a user's orbit/zoom, move a fixed comparison camera, or shrink each cycle.
   if(s.stroke!==lastStroke){
    lastStroke=s.stroke;
    if(s.amount===0&&!focus&&!reviewMode.enabled){const current=visibleGeometryBounds(root);if(!motionBox.containsBox(current)){motionBox.union(current);if(!manualCamera)fit();}}
   }
 }
 function snapshot(){const s=motion.snapshot();return {version:'wireframe-preview/2',buildId:buildInfo.id,subject:model.title,...s,telemetry,selected,isolated:$('isolate').checked,style:$('render-style').value,clay:$('clay').checked,audit,review:reviewMode,parts:parts.length,pose:runtime.snapshot(),camera:{position:camera.position.toArray(),target:controls.target.toArray(),up:camera.up.toArray(),zoom:camera.zoom,recipe},frames,drawCalls:renderer.info.render.calls,triangles:renderer.info.render.triangles};}
 function appearance(){
   const materials=new Map();root.traverseVisible(o=>{if(!o.isMesh||o.userData.isIllustrationDecoration)return;for(const m of [o.material].flat()){if(!materials.has(m.uuid))materials.set(m.uuid,{name:m.name,type:m.type,role:m.userData.materialRole,meshes:0,roughness:m.roughness,metalness:m.metalness,clearcoat:m.clearcoat,maps:{}});const entry=materials.get(m.uuid);entry.meshes++;for(const key of ['map','bumpMap','roughnessMap'])if(m[key]){const t=m[key],im=t.image;entry.maps[key]={name:t.name,colorSpace:t.colorSpace,width:im?.width,height:im?.height};}}});
   return {buildId:buildInfo.id,style:$('render-style').value,clay:$('clay').checked,environment:scene.environment?.name||null,environmentIntensity:scene.environmentIntensity,materials:[...materials.values()],scope:'Materials currently assigned to visible display meshes; appearance quality still requires image review.'};
 }
 function wake(){if(!frame&&!rendering&&visible&&!document.hidden){last=null;frame=requestAnimationFrame(tick);}}
 function tick(now){
   frame=0;rendering=true;const dt=last===null?0:Math.max(0,(now-last)/1000);last=now;
   motion.step(dt);apply();const changed=controls.update();ink.update();renderer.render(scene,camera);frames++;
   stage.dataset.state=JSON.stringify(snapshot());rendering=false;
   const s=motion.snapshot();if(visible&&!document.hidden&&((!s.paused&&!s.reduced&&(!s.settled||s.cycling))||changed))frame=requestAnimationFrame(tick);
 }
 function change(fn,{refit=false}={}){fn();apply();if(refit)fit(manualCamera);wake();}
 function check(){
   apply();const s=motion.snapshot(),assembly=model.assembly?auditAssembly(model.assembly,{assembled:s.amount===0}):{status:'unconfigured'},explosion=auditExplosion(model,{amount:s.amount});
   const anchors=auditMeshAnchors(root,model.meshAnchorChecks),statuses=[assembly.status,explosion.status,anchors.status];
   audit={...assembly,assembly,explosion,anchors,status:statuses.includes('fail')?'fail':statuses.includes('unverified')?'unverified':statuses.includes('pass')?'pass':'unconfigured'};
   auditKey=JSON.stringify([s.amount,s.stroke,s.time]);
   const labels={pass:'已配置项通过',fail:'发现问题','not-applicable':'当前姿态不适用',unconfigured:'未配置'};
   $('connection-result').textContent=`装配：${labels[assembly.status]||'有未核验项'}；展开间距：${labels[explosion.status]||'有未核验项'}；几何锚点：${labels[anchors.status]||'有未核验项'}`;wake();return audit;
 }
 function reset(){motion.reset();motionBox.copy(restBox);lastStroke=-1;selected=parts[0].id;view='hero';focus=manualCamera=false;$('isolate').checked=false;$('clay').checked=false;ink.setClay(false);select(selected);apply();fit();wake();}
 function setView(value){if(!directions[value]&&!referenceViews[value])throw Error('Unknown view');view=value;manualCamera=false;if(reviewMode.enabled)reviewMode.camera=referenceView(referenceViews[value]||{direction:directions[value],up:[0,0,1]});fit();wake();}
 function setReview({enabled=true,view:requested='front',camera:custom,mode='clay'}={}){
   if(!['clay','material'].includes(mode))throw Error('Review mode must be clay or material');
   const spec=enabled?referenceView(custom||referenceViews[requested]):null;
   if(enabled&&!reviewMode.enabled)beforeReview={style:$('render-style').value,clay:$('clay').checked,view};
   reviewMode=enabled?{enabled:true,view:requested,mode,camera:spec}:{enabled:false};
   document.body.classList.toggle('reference-capture',enabled);controls.enabled=!enabled;manualCamera=false;
   if(enabled){motion.sample({explode:0,stroke:0,time:0});focus=false;$('isolate').checked=false;$('render-style').value='studio';$('clay').checked=mode==='clay';}
   else if(beforeReview){$('render-style').value=beforeReview.style;$('clay').checked=beforeReview.clay;view=beforeReview.view;beforeReview=null;}
   ink.setEnabled($('render-style').value==='anatomy-light');ink.setClay($('clay').checked,enabled?{color:'#969da6',roughness:.35}:undefined);apply();fit();wake();return snapshot();
 }
 function referenceAudit(spec,dimensions=[]){
   const probes=projectProbes(model,model.referenceProbes,camera),expectedCamera=referenceView(spec.camera);
   const sameCamera=['direction','up','center'].every(key=>expectedCamera[key]?.every((n,i)=>Math.abs(n-recipe[key]?.[i])<1e-8))&&Math.abs(expectedCamera.span-recipe.span)<1e-8;
   const comparable=reviewMode.enabled&&spec.calibrated===true&&spec.projection==='orthographic'&&recipe.framing==='fixed'&&sameCamera;
   const landmarks=(spec.landmarks||[]).map(mark=>{
     const actual=probes[mark.probe];if(!actual)return {probe:mark.probe,status:'unconfigured'};
     const error=Math.hypot(actual.uv[0]-mark.uv[0],actual.uv[1]-mark.uv[1]);
     return {probe:mark.probe,...actual,expected:mark.uv,error,tolerance:mark.tolerance,status:comparable?(actual.inFrame&&error<=mark.tolerance?'pass':'fail'):'not-comparable'};
   });return {dimensions:dimensionReport(model,dimensions),landmarks,visualReview:'NOT_RUN',scope:'Declared real-mesh dimensions and projected vertices; no automatic appearance verdict'};
 }
 for(const p of parts){const o=document.createElement('option');o.value=p.id;o.textContent=p.label;$('component').append(o);}
 $('component').onchange=e=>change(()=>select(e.target.value),{refit:focus});
 $('explode').oninput=e=>change(()=>motion.explode(Number(e.target.value)/100));
 $('apart').onclick=()=>change(()=>motion.explode(motion.snapshot().goal>.5?0:1));
 $('stroke').oninput=e=>change(()=>motion.setStroke(Number(e.target.value)/100));
 $('cycle').onclick=()=>change(()=>motion.cycle(!motion.snapshot().cycling));
 play.onclick=()=>change(()=>motion.setPaused(!motion.snapshot().paused));
 $('render-style').onchange=e=>change(()=>{ink.setEnabled(e.target.value==='anatomy-light');ground.visible=e.target.value==='studio'&&!focus;});
 $('clay').onchange=e=>change(()=>ink.setClay(e.target.checked));
 $('isolate').onchange=()=>change(()=>{focus=$('isolate').checked;},{refit:true});
 $('focus-part').onclick=()=>change(()=>{focus=true;},{refit:true});
 $('check-connections').onclick=()=>{try{check();}catch(e){$('connection-result').textContent=e.message;console.error(e);}};
 const views=['复位','背面','俯视'].map((label,i)=>{const b=document.createElement('button');b.textContent=label;b.onclick=()=>i?setView(['hero','back','top'][i]):reset();return b;});
 mountPreviewUI({tabs:[{id:'structure',label:'结构',element:$('structure')},{id:'components',label:'部件',element:$('components')},{id:'about',label:'说明',element:$('about')}],views,transport:dock,kind:'structure',sceneLabel:model.style==='architectural'?'建筑构造':'机械结构',sceneIndex:'WIREFRAME / 3D',pickControl:$('component'),pickTab:'components'});
 let down;const ray=new THREE.Raycaster();renderer.domElement.addEventListener('pointerdown',e=>down=[e.clientX,e.clientY]);
 renderer.domElement.addEventListener('pointerup',e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>5)return;const r=renderer.domElement.getBoundingClientRect();ray.setFromCamera(new THREE.Vector2((e.clientX-r.left)/r.width*2-1,1-(e.clientY-r.top)/r.height*2),camera);const hit=ray.intersectObjects(parts.filter(p=>p.node.visible).map(p=>p.node),true)[0];if(hit){let o=hit.object;while(o&&!o.userData.partId)o=o.parent;if(o)change(()=>select(o.userData.partId));}});
 controls.addEventListener('start',()=>manualCamera=true);controls.addEventListener('change',wake);
 reduced.addEventListener('change',()=>change(()=>motion.setReduced(reduced.matches)));
 const visibility=()=>{motion.setVisible(visible&&!document.hidden);if(visible&&!document.hidden)wake();else if(frame){cancelAnimationFrame(frame);frame=0;last=null;}};
 document.addEventListener('visibilitychange',visibility);
 new IntersectionObserver(entries=>{visible=entries.at(-1).isIntersecting;visibility();},{rootMargin:'120px 0px'}).observe(stage);
 new ResizeObserver(()=>{fit(manualCamera);wake();}).observe(stage);
 // Tools and human controls share exactly the same state/pose path.
 window.__wireframe={version:1,snapshot,appearance,
   sample(pose){change(()=>motion.sample(pose),{refit:true});return snapshot();},
   explode(value){change(()=>motion.explode(value));},stroke(value){change(()=>motion.setStroke(value));},
   cycle(value=true){change(()=>motion.cycle(value));},pause(value=true){change(()=>motion.setPaused(value));},
   select(id,{isolate=false}={}){change(()=>{select(id);$('isolate').checked=isolate;focus=isolate;},{refit:true});},
   view:setView,reset,audit:check,review:setReview,referenceAudit,referenceViews};
 select(selected);apply();fit();wake();
}catch(e){$('error').hidden=false;$('error').textContent='场景加载失败：'+e.message;console.error(e);}
