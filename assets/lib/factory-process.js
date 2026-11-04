// Explicit source scheduling and device mapping. No physics or inferred equipment types.
const finite=(v,label)=>{if(!Number.isFinite(v))throw Error(label+' must be finite');return v;};
export function cycleTime(time,period,offset=0){
 finite(time,'time');finite(offset,'offset');if(!Number.isFinite(period)||period<=0)throw Error('period must be positive');
 const shifted=finite(time-offset,'shifted time'),cycle=Math.floor(shifted/period);finite(cycle,'cycle');
 return {cycle,local:((shifted%period)+period)%period};
}
function validateWindow(w,period){
 if(!Array.isArray(w)||w.length!==2||!w.every(Number.isFinite)||w.some(v=>v<0||v>period)||w[0]===period||w[0]===w[1])throw Error('window requires distinct endpoints within its period');
}
export function inCycleWindow(local,window,period){
 cycleTime(0,period);validateWindow(window,period);finite(local,'local');if(local<0||local>=period)throw Error('local outside cycle');
 const [start,end]=window;return start<end?local>=start&&local<end:local>=start||local<end;
}
export function createProcessSampler(tracks){
 if(!Array.isArray(tracks)||!tracks.length)throw Error('tracks required');
 const ids=new Set(),defs=tracks.map(track=>{
  const t={...track,windows:track.windows?.map(w=>[...w])};
  if(typeof t.id!=='string'||!t.id||ids.has(t.id))throw Error('unique track id required');ids.add(t.id);
  cycleTime(0,t.period,t.offset??0);
  if(typeof t.sample!=='function')throw Error('track sample function required: '+t.id);
  if(t.windows){if(!t.windows.length||typeof t.home!=='function')throw Error('windowed tracks require windows and explicit HOME: '+t.id);t.windows.forEach(w=>validateWindow(w,t.period));}
  return t;
 });
 return time=>Object.fromEntries(defs.map(t=>{const {local,cycle}=cycleTime(time,t.period,t.offset??0);
  const active=!t.windows||t.windows.some(w=>inCycleWindow(local,w,t.period));
  return [t.id,{local,cycle,active,value:(active?t.sample:t.home)(local,cycle)}];
 }));
}
export function buildStations(definitions,builders){
 if(!Array.isArray(definitions)||!definitions.length)throw Error('station definitions required');
 const byId=new Map(),nodes=new Set();
 for(const d of definitions){
  if(!d?.id||typeof d.id!=='string'||byId.has(d.id))throw Error('duplicate or missing station id: '+d?.id);
  if(!Object.hasOwn(builders,d.kind)||typeof builders[d.kind]!=='function')throw Error('Unmapped station '+d.id+': '+d.kind);
  const node=builders[d.kind](d);
  if(!node?.isObject3D||nodes.has(node))throw Error('Each station needs its own Object3D: '+d.id);
  node.userData.stationId=d.id;node.userData.stationKind=d.kind;nodes.add(node);byId.set(d.id,node);
 }
 return byId;
}
// Pass the carriers actually drawn in this frame, including fixtures and robot-held loads.
export function auditMaterialOwners(items,{expectedIds}={}){
 const errors=[],seen=new Set();
 for(const item of items){
  if(!item||typeof item.id!=='string'||!item.id){errors.push('missing material id');continue;}
  if(seen.has(item.id))errors.push('duplicate material: '+item.id);seen.add(item.id);
  if(typeof item.owner!=='string'||!item.owner)errors.push('missing owner: '+item.id);
  if(!Array.isArray(item.position)||item.position.length!==3||!item.position.every(Number.isFinite))errors.push('invalid position: '+item.id);
 }
 if(expectedIds){const expected=new Set(expectedIds);if(expected.size!==expectedIds.length)errors.push('duplicate expected material id');for(const id of expected)if(!seen.has(id))errors.push('missing material: '+id);for(const id of seen)if(!expected.has(id))errors.push('unexpected material: '+id);}
 return {status:errors.length?'fail':'pass',items:seen.size,errors,scope:'Declared visible material ownership only; no collision or throughput proof.'};
}
