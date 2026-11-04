const $=id=>document.getElementById(id),frame=$('model');
const response=await fetch('reference.json',{cache:'no-store'});if(!response.ok)throw Error('Missing reference.json');
const record=await response.json();let revision=0,lastImage;
const wait=ms=>new Promise(r=>setTimeout(r,ms));
async function ready(){for(let i=0;i<200;i++){const api=frame.contentWindow?.__wireframe;if(api?.snapshot().frames>0)return api;const error=frame.contentDocument?.querySelector('#error:not([hidden])')?.textContent;if(error)throw Error(error);await wait(100);}throw Error('Preview did not become ready');}
function draw(canvas,image,region){canvas.width=region[2];canvas.height=region[3];canvas.getContext('2d').drawImage(image,...region,0,0,canvas.width,canvas.height);}
async function update(){
  const token=++revision;try{
    const view=record.views[$('view').value],source=record.sources.find(s=>s.id===view.source);if(!source)throw Error('Missing source');
    const image=new Image();image.src=source.path;await image.decode();if(token!==revision)return;
    const region=view.region||[0,0,...source.size];document.documentElement.style.setProperty('--ratio',String(region[2]/region[3]));
    draw($('source'),image,region);draw($('overlay-image'),image,region);lastImage=image;
    $('overlay-image').hidden=!$('overlay').checked;$('overlay-image').style.opacity=$('opacity').value;
    const api=await ready();if(token!==revision)return;
    api.review({view:$('view').value,camera:view.camera,mode:$('mode').value});
    await new Promise(r=>requestAnimationFrame(()=>requestAnimationFrame(r)));
    $('notice').textContent=view.calibrated?'已声明固定尺度与配准依据；仍须检查轮廓、曲面与局部特征。':'投影或尺度尚未配准：当前对照仅供观察，不能据此认定尺寸或还原度通过。';
    $('audit').textContent=JSON.stringify(api.referenceAudit(view,record.dimensions),null,2);$('error').textContent='';
    window.__referenceReview={ready:true,view:$('view').value,source:source.id,region,buildId:api.snapshot().buildId,visualReview:'NOT_RUN'};
  }catch(e){$('error').textContent=e.message;console.error(e);}
}
for(const key of Object.keys(record.views)){const option=document.createElement('option');option.value=key;option.textContent=key;$('view').append(option);}
if(!$('view').options.length){$('notice').textContent='参考记录尚未标注视图；先填写 views、来源区域与相机方向。';}
else await update();
$('view').onchange=update;$('mode').onchange=update;
$('overlay').onchange=()=>{$('overlay-image').hidden=!$('overlay').checked;};
$('opacity').oninput=()=>{$('overlay-image').style.opacity=$('opacity').value;};
