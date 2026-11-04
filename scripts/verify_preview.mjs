// Node >=22, local Chrome/Chromium, no npm dependency. Inspects our own preview hook.
// This captures real WebGL frames; it does not score artistic or reference fidelity.
import {spawn} from 'node:child_process';
import {mkdtemp,readFile,writeFile,mkdir,rm,access} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve,dirname,basename} from 'node:path';
import assert from 'node:assert/strict';
import {createHash} from 'node:crypto';
const args=Object.fromEntries(process.argv.slice(2).reduce((a,v,i,all)=>{if(v.startsWith('--'))a.push([v.slice(2),all[i+1]]);return a;},[]));
if(!args.url||!args.out)throw Error('Usage: node scripts/verify_preview.mjs --url http://127.0.0.1:PORT/ --out PATH [--chrome PATH] [--part ID]');
const url=new URL(args.url);if(!['127.0.0.1','localhost','[::1]'].includes(url.hostname)||!['http:','https:'].includes(url.protocol))throw Error('Use a loopback preview URL');
const out=resolve(args.out);await mkdir(out,{recursive:true});
const report={status:'running',url:url.href,checks:[],shots:[],errors:[],visualReview:'NOT_RUN',referenceFidelity:'NOT_RUN',performance:'NOT_MEASURED',startedAt:new Date().toISOString()};
const delay=ms=>new Promise(r=>setTimeout(r,ms));
async function until(fn,timeout=15000){const end=Date.now()+timeout;while(Date.now()<end){const r=await fn();if(r)return r;await delay(60);}throw Error('Timed out waiting for preview condition');}
let browser,socket,profile,nextId=0;const pending=new Map();
async function send(method,params={}){return new Promise((resolve,reject)=>{const id=++nextId,timer=setTimeout(()=>{pending.delete(id);reject(Error('CDP timeout '+method));},20000);pending.set(id,{resolve,reject,timer});socket.send(JSON.stringify({id,method,params}));});}
async function evaluate(expression){const r=await send('Runtime.evaluate',{expression,awaitPromise:true,returnByValue:true});if(r.exceptionDetails)throw Error(r.exceptionDetails.exception?.description||r.exceptionDetails.text);return r.result.value;}
const state=()=>evaluate('window.__wireframe.snapshot()');
const settledFrame=()=>evaluate('new Promise(resolve=>requestAnimationFrame(()=>requestAnimationFrame(()=>resolve(true))))');
let viewport={width:1440,height:1000};
const sha256=bytes=>createHash('sha256').update(bytes).digest('hex');
async function metrics(width,height){
 viewport={width,height};await send('Emulation.setDeviceMetricsOverride',{width,height,deviceScaleFactor:1,mobile:false});
 await until(()=>evaluate(`innerWidth===${width} && innerHeight===${height}`));
}
async function shot(name){
 await settledFrame();
 const page=await evaluate('({url:location.href,width:innerWidth,height:innerHeight,dpr:devicePixelRatio,visibility:document.visibilityState})');
 assert.equal(page.url,url.href,'Screenshot target navigated away');assert.equal(page.width,viewport.width);assert.equal(page.height,viewport.height);
 const before=await state();assert.ok(before.paused||(!before.cycling&&before.settled),'Capture a fixed pose');
 const drawn=await evaluate('JSON.parse(document.getElementById("stage").dataset.state)');assert.deepEqual(drawn.pose,before.pose,'Pose was not yet rendered');assert.equal(drawn.style,before.style);
 const r=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true}),png=Buffer.from(r.data,'base64');
 assert.equal(png.readUInt32BE(16),viewport.width);assert.equal(png.readUInt32BE(20),viewport.height);
 const after=await state();assert.deepEqual(after.pose,before.pose,'Pose changed during screenshot');
 assert.deepEqual(after.camera,before.camera,'Camera changed during screenshot');
 await writeFile(join(out,name+'.png'),png);report.shots.push({file:name+'.png',sha256:sha256(png),targetId:report.targetId,page,state:after});
}
async function test(name,fn){try{await fn();report.checks.push({name,status:'pass'});}catch(e){report.checks.push({name,status:'fail',reason:e.message});throw e;}}
try {
 let chrome=args.chrome||process.env.CHROME_PATH;
 if(!chrome){for(const path of ['C:/Program Files/Google/Chrome/Application/chrome.exe','C:/Program Files (x86)/Microsoft/Edge/Application/msedge.exe','/usr/bin/google-chrome','/usr/bin/chromium','/Applications/Google Chrome.app/Contents/MacOS/Google Chrome']){try{await access(path);chrome=path;break;}catch{}}}
 if(!chrome)throw Error('Chrome not found; set --chrome or CHROME_PATH');
 profile=await mkdtemp(join(tmpdir(),'wireframe-chrome-'));
 browser=spawn(chrome,['--headless=new','--remote-debugging-port=0',`--user-data-dir=${profile}`,'--no-first-run','--no-default-browser-check','--disable-background-networking','--enable-unsafe-swiftshader','--ignore-gpu-blocklist','about:blank'],{windowsHide:true,stdio:'ignore'});
 let spawnError;browser.on('error',e=>spawnError=e);
 const port=await until(async()=>{if(spawnError)throw spawnError;try{return (await readFile(join(profile,'DevToolsActivePort'),'utf8')).split('\n')[0];}catch{return false;}});
 const target=await (await fetch(`http://127.0.0.1:${port}/json/new?about:blank`,{method:'PUT'})).json();
 report.targetId=target.id;
 socket=new WebSocket(target.webSocketDebuggerUrl);
 await new Promise((res,rej)=>{socket.addEventListener('open',res,{once:true});socket.addEventListener('error',rej,{once:true});});
 socket.addEventListener('message',e=>{const m=JSON.parse(e.data);if(m.id){const p=pending.get(m.id);if(p){clearTimeout(p.timer);pending.delete(m.id);m.error?p.reject(Error(JSON.stringify(m.error))):p.resolve(m.result);}}
   else if(m.method==='Runtime.exceptionThrown')report.errors.push(m.params.exceptionDetails.exception?.description||m.params.exceptionDetails.text);
   else if(m.method==='Runtime.consoleAPICalled'&&m.params.type==='error')report.errors.push(m.params.args.map(a=>a.value||a.description).join(' '));});
 await send('Runtime.enable');await send('Page.enable');await send('Network.enable');await send('Network.setCacheDisabled',{cacheDisabled:true});report.browser=await send('Browser.getVersion');
 await metrics(1440,1000);
 await send('Page.navigate',{url:url.href});
 await until(async()=>{const err=await evaluate('document.querySelector("#error:not([hidden])")?.textContent');if(err)throw Error(err);return evaluate('Boolean(window.__wireframe && window.__wireframe.snapshot().frames>1)');});
 await test('served code matches current build and expected preview',async()=>{
  const base=new URL('./',url),response=await fetch(new URL('preview-manifest.json',base));assert.equal(response.status,200,'Regenerate preview with current prepare_web.py');
  const manifest=await response.json();assert.equal((await state()).buildId,manifest.id);
  if(args['expect-build'])assert.equal(manifest.id,args['expect-build'],'Wrong/stale preview build');
  for(const [path,expected]of Object.entries(manifest.files)){
   const asset=new URL(path,base);assert.equal(asset.origin,base.origin);assert.ok(asset.pathname.startsWith(base.pathname));
   const r=await fetch(asset);assert.equal(r.status,200,path);assert.equal(sha256(Buffer.from(await r.arrayBuffer())),expected,'Changed served file: '+path);
  }
  report.build=manifest;
 });
 await test('actual WebGL render',async()=>{const s=await state();assert.ok(s.drawCalls>0&&s.triangles>0);report.render={drawCalls:s.drawCalls,triangles:s.triangles};});
 if(args.reference==='true'){
   const response=await fetch(new URL('reference.json',url));assert.equal(response.status,200,'Prepare with --reference');
   const reference=await response.json();assert.ok(Object.keys(reference.views).length,'Annotate at least one reference view');
   report.referenceAudits=[];report.captureScope='Fixed-view reference capture; appearance still needs image review';
   let sequence=0;
   for(const [name,spec]of Object.entries(reference.views)){
     const source=reference.sources.find(s=>s.id===spec.source);assert.ok(source,'Missing source');
     const size=spec.region?spec.region.slice(2):source.size,scale=Math.min(1,1600/size[0],1200/size[1]);
     await metrics(Math.max(1,Math.round(size[0]*scale)),Math.max(1,Math.round(size[1]*scale)));
     for(const mode of ['clay','material']){
       await evaluate(`__wireframe.review(${JSON.stringify({view:name,camera:spec.camera,mode})})`);
       await shot(`${String(++sequence).padStart(2,'0')}-${name.replace(/[^a-zA-Z0-9_-]/g,'_')}-${mode}`);
       const audit=await evaluate(`__wireframe.referenceAudit(${JSON.stringify(spec)},${JSON.stringify(reference.dimensions)})`);
       report.referenceAudits.push({view:name,mode,source:source.id,sourceHash:source.sha256,...audit});
     }
   }
   await test('reference mode exits and restores controls',async()=>{
     await evaluate('__wireframe.review({enabled:false})');await settledFrame();assert.equal((await state()).review.enabled,false);
     assert.equal(await evaluate('document.body.classList.contains("reference-capture")'),false);
   });
   await metrics(1400,900);await send('Page.navigate',{url:new URL('review.html',url).href});
   await until(()=>evaluate('Boolean(window.__referenceReview?.ready)'));
   await test('comparison page preserves source region aspect ratio',async()=>{
     const value=await evaluate('(()=>{const c=document.querySelector("#source"),r=c.getBoundingClientRect(),f=document.querySelector("#model").getBoundingClientRect();return {source:c.width/c.height,display:r.width/r.height,render:f.width/f.height,build:window.__referenceReview.buildId};})()');
     assert.ok(Math.abs(value.source-value.display)<.01);assert.ok(Math.abs(value.source-value.render)<.01);assert.equal(value.build,report.build.id);
   });
   const reviewShot=await send('Page.captureScreenshot',{format:'png',captureBeyondViewport:false,fromSurface:true}),reviewBytes=Buffer.from(reviewShot.data,'base64');
   await writeFile(join(out,'review-page.png'),reviewBytes);report.comparisonPage={file:'review-page.png',sha256:sha256(reviewBytes),state:await evaluate('window.__referenceReview')};
   if(report.referenceAudits.some(a=>a.dimensions.status==='fail'||a.landmarks.some(m=>['fail','unconfigured'].includes(m.status))))throw Error('Declared reference dimensions or landmarks failed; inspect captured evidence');
 }else{
 await evaluate('__wireframe.sample({explode:0,stroke:0})');const rest=(await state()).pose;await shot('01-assembled');
 for(const amount of [.5,1]){await evaluate(`__wireframe.sample({explode:${amount}})`);await test(`explode ${amount}`,async()=>assert.equal((await state()).amount,amount));await shot(amount===.5?'02-half':'03-exploded');}
 const operational=await evaluate('!document.getElementById("operation").hidden');
 if(operational){
   await test('arming and pause freeze',async()=>{
     await evaluate('__wireframe.cycle(true)');let s=await state();assert.equal(s.armed,true);assert.equal(s.time,0);assert.equal(s.paused,false);
     await until(async()=>{const s=await state();return s.amount===0&&s.time>.1;});
     await evaluate('__wireframe.pause(true)');const before=await state();await delay(180);const after=await state();assert.deepEqual(after.pose,before.pose);assert.equal(after.time,before.time);
   });
   await evaluate('__wireframe.sample({stroke:1})');await shot('04-operating');
   await test('manual input controls same rendered stroke',async()=>{
     await evaluate('document.getElementById("stroke").focus()');
     await send('Input.dispatchKeyEvent',{type:'keyDown',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});await send('Input.dispatchKeyEvent',{type:'keyUp',key:'ArrowLeft',code:'ArrowLeft',windowsVirtualKeyCode:37});
     assert.equal((await state()).stroke,.99);assert.equal((await state()).cycling,false);
   });
 }
 await test('reset restores actual model pose',async()=>{await evaluate('__wireframe.reset()');assert.deepEqual((await state()).pose,rest);});
 await test('orbit is retained while exploding',async()=>{
   const rect=await evaluate('(()=>{const r=document.querySelector("#stage canvas").getBoundingClientRect();return {x:r.x+r.width*.5,y:r.y+r.height*.5};})()');
   await send('Input.dispatchMouseEvent',{type:'mousePressed',x:rect.x,y:rect.y,button:'left',buttons:1,clickCount:1});
   await send('Input.dispatchMouseEvent',{type:'mouseMoved',x:rect.x+65,y:rect.y+20,button:'left',buttons:1});
   await send('Input.dispatchMouseEvent',{type:'mouseReleased',x:rect.x+65,y:rect.y+20,button:'left',buttons:0,clickCount:1});
   await delay(700);
   const direction=s=>{const a=s.camera.position.map((n,i)=>n-s.camera.target[i]),length=Math.hypot(...a);return a.map(n=>n/length);};
   const before=direction(await state());await evaluate('__wireframe.explode(1); __wireframe.pause(false)');
   await until(async()=>{const s=await state();return s.amount===1;});const after=direction(await state());
   assert.ok(before.reduce((sum,n,i)=>sum+n*after[i],0)>.995,'Orbit snapped to preset');await evaluate('__wireframe.reset()');
 });
 await evaluate('__wireframe.sample({}); __wireframe.view("back")');await shot('05-back');
 await evaluate('__wireframe.view("top")');await shot('06-top');
 await evaluate('__wireframe.view("hero")');
 await test('render styles use the same pose and switch back',async()=>{
  const pose=(await state()).pose;
  await evaluate('(()=>{const s=document.getElementById("render-style");s.value="studio";s.dispatchEvent(new Event("change"));})()');await settledFrame();
  assert.equal((await state()).style,'studio');assert.deepEqual((await state()).pose,pose);await shot('07-studio');
  await evaluate('(()=>{const s=document.getElementById("render-style");s.value="anatomy-light";s.dispatchEvent(new Event("change"));})()');await settledFrame();assert.equal((await state()).style,'anatomy-light');assert.deepEqual((await state()).pose,pose);
 });
 if(args.part){await evaluate(`__wireframe.select(${JSON.stringify(args.part)},{isolate:true})`);await shot('07-detail');await evaluate('__wireframe.reset()');}
 await test('declared assembly in browser',async()=>{const r=await evaluate('__wireframe.audit()');report.assembly=r;assert.ok(['pass','unconfigured'].includes(r.status),JSON.stringify(r));});
 await metrics(390,844);await settledFrame();
 await test('narrow layout has no horizontal overflow',async()=>assert.ok(await evaluate('document.documentElement.scrollWidth <= innerWidth+1')));await shot('08-mobile');
 await send('Emulation.setEmulatedMedia',{features:[{name:'prefers-reduced-motion',value:'reduce'}]});
 await until(()=>evaluate('__wireframe.snapshot().reduced'));await evaluate('__wireframe.reset(); __wireframe.explode(.5)');
 await test('reduced motion preserves manual operation',async()=>{assert.equal((await state()).amount,.5);await evaluate('__wireframe.explode(0)');if(operational){await evaluate('__wireframe.stroke(.6)');assert.equal((await state()).stroke,.6);assert.equal(await evaluate('document.getElementById("cycle").disabled'),true);}});
 await shot('09-reduced');
 }
 await test('no runtime or shader errors',()=>assert.deepEqual(report.errors,[]));
 report.status='pass';
}catch(e){report.status='fail';report.failure=e.stack;process.exitCode=1;}
finally {
 report.finishedAt=new Date().toISOString();
 await writeFile(join(out,'browser-report.json'),JSON.stringify(report,null,2));
 if(socket?.readyState===1){try{await send('Browser.close');}catch{}socket.close();}
 if(browser&&browser.exitCode===null){await Promise.race([new Promise(r=>browser.once('exit',r)),delay(1500)]);if(browser.exitCode===null)browser.kill();}
 if(profile&&dirname(resolve(profile))===resolve(tmpdir())&&basename(profile).startsWith('wireframe-chrome-'))await rm(resolve(profile),{recursive:true,force:true,maxRetries:4,retryDelay:250}).catch(()=>{});
 console.log(`${report.status.toUpperCase()}: ${join(out,'browser-report.json')}`);
}
