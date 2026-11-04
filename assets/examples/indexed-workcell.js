// Original development fixture: explicit devices, process windows, semantic colours and live buffer counts.
import * as T from 'three';
import {box,beam,solid,flange} from './lib/geometry.js';
import {illustrationPalette,materialRole} from './lib/illustration.js';
import {buildStations,createProcessSampler,cycleTime,auditMaterialOwners} from './lib/factory-process.js';
export function buildScene(){
 const root=new T.Group(),parts=[],m=illustrationPalette(),orange=materialRole('process','#df853a'),teal=materialRole('process','#468b8f');
 const add=(g,o)=>{g.add(o);return o;},cyl=(r,h,mat,p)=>{const o=solid(new T.CylinderGeometry(r,r,h,24).rotateX(Math.PI/2),mat);o.position.fromArray(p);return o;};
 const part=(id,label,node,explode=[0,0,0])=>{root.add(node);parts.push({id,label,node,explode,description:'原创工艺开发例；按稳定 ID 建模与驱动，尺寸为示意。'});};
 const base=new T.Group();add(base,box([12,5,.22],m.base,[0,0,0]));part('base','底座与设备分区',base);
 for(const x of [-4,-2,0,2,4]){const g=add(base,box([.015,4.8,.008],m.metal,[x,0,.115]));g.userData.lineWeight=0;}
 let ram,scanner,buffer;
 const builders={
  rack(d){const g=new T.Group();for(const x of [-.65,.65])for(const y of [-.5,.5])add(g,box([.07,.07,1.9],m.frame,[x,y,1.06]));for(const z of [.3,.9,1.5])add(g,box([1.4,1.1,.07],m.metal,[0,0,z]));
   if(d.id==='outfeed'){buffer=new T.InstancedMesh(new T.BoxGeometry(1,.65,.16),m.body,3);for(let i=0;i<3;i++){buffer.setMatrixAt(i,new T.Matrix4().makeTranslation(0,0,.45+i*.6));buffer.setColorAt(i,new T.Color(['#df853a','#468b8f','#7c8bba'][i]));}buffer.instanceMatrix.needsUpdate=true;g.add(buffer);}g.position.set(d.x,1.25,.12);return g;},
  press(d){const g=new T.Group();add(g,box([2,1.8,.2],m.body,[0,0,.22]));for(const x of [-.75,.75])for(const y of [-.65,.65])add(g,cyl(.085,2.5,m.metal,[x,y,1.6]));
   add(g,box([2,1.75,.3],m.frame,[0,0,2.88]));const housing=add(g,flange({outerRadius:.38,boreRadius:.14,thickness:.25,boltCircle:.27,boltRadius:.035,boltCount:6},m.body));housing.position.set(0,0,3.04);
   ram=new T.Group();add(ram,cyl(.12,1.2,m.metal,[0,0,2.62]));add(ram,box([1.25,.95,.20],m.body,[0,0,2.02]));add(ram,box([.65,.65,.4],orange,[0,0,1.72]));g.add(ram);
   add(g,box([1.25,1,.2],teal,[0,0,.64]));for(const x of [-.46,.46])add(g,box([.13,.7,.20],m.metal,[x,0,.84]));g.position.x=d.x;return g;},
  scanner(d){const g=new T.Group();for(const y of [-.72,.72]){add(g,box([.22,.22,2.2],m.body,[0,y,1.25]));add(g,box([.5,.4,.12],m.metal,[0,y,.20]));}add(g,box([.35,1.8,.2],m.frame,[0,0,2.45]));
   scanner=new T.Group();add(scanner,box([.48,.28,.38],teal,[0,0,2.15]));add(scanner,cyl(.17,.14,orange,[0,0,1.9]));g.add(scanner);const glass=add(g,box([.025,1.4,1.6],m.glass,[.43,0,1.3]));glass.userData.edges=false;
   g.position.x=d.x;return g;}
 };
 const definitions=[{id:'infeed',kind:'rack',x:-4.5},{id:'press-01',kind:'press',x:-1.6},{id:'scan-01',kind:'scanner',x:2},{id:'outfeed',kind:'rack',x:4.5}];
 const stations=buildStations(definitions,builders);
 for(const d of definitions)part(d.id,{rack:'缓存料架',press:'导柱压装工位',scanner:'光学检测门架'}[d.kind],stations.get(d.id),[0,d.kind==='rack'?.8:0,d.kind==='press'?1:0]);
 const conveyor=new T.Group();for(let i=0;i<40;i++){const roller=add(conveyor,cyl(.055,1.15,m.metal,[-5+i*.26,-.05,.98]));roller.rotation.x=Math.PI/2;roller.userData.lineWeight=.25;roller.userData.edges=false;}for(const y of [-.66,.66]){const rail=add(conveyor,box([10.7,.06,.10],m.body,[0,y,.91]));rail.userData.lineWeight=.4;}part('conveyor','辊道与导向',conveyor,[0,-.5,-.2]);
 const cargo=new T.Group(),pallet=add(cargo,box([1.05,.85,.1],m.metal,[0,0,1.08])),payload=add(cargo,box([.72,.53,.28],orange,[0,0,1.27]));part('cargo','载具与在制品',cargo,[0,-1,1.1]);
 const utilities=new T.Group();for(let x=-5;x<=5;x++){const pole=add(utilities,box([.035,.035,2.5],m.frame,[x,2,1.36]));pole.userData.lineWeight=.25;}const line=add(utilities,beam([-5,2,2.6],[5,2,2.6],.035,.035,m.metal));line.userData.lineWeight=.25;part('utilities','弱线背景管架',utilities);
 const sample=createProcessSampler([
  {id:'press',period:12,windows:[[2,5]],sample:t=>Math.sin((t-2)/3*Math.PI)*.11,home:()=>0},
  {id:'scanner',period:12,windows:[[7,9]],sample:t=>Math.sin((t-7)*Math.PI)*.5,home:()=>0},
  {id:'signal',period:8,offset:1,windows:[[0,2]],sample:()=>true,home:()=>false}
 ]);
 function setPose({stroke=0,explode=0}){
  const time=stroke*24,s=sample(time),t=cycleTime(time,12).local;
  const x=t<2?-4.5+t/2*2.9:t<5?-1.6:t<7?-1.6+(t-5)/2*3.6:t<9?2:t<11?2+(t-9)/2*2.5:4.5;
  ram.position.z=-s.press.value;scanner.position.y=s.scanner.value;cargo.position.x=x;
  payload.visible=explode===0&&t<11.5;buffer.count=explode>0?0:1+Math.floor(t/4);
  const owner=s.press.active?'press-01':s.scanner.active?'scan-01':'conveyor';payload.userData.owner=owner;
  const items=payload.visible?[{id:'part-'+cycleTime(time,12).cycle,owner:payload.userData.owner,position:[x,0,1.27]}]:[];
  const audit=auditMaterialOwners(items);
  return {phase:explode>0?'拆解 · 物流停止':s.press.active?'压装':s.scanner.active?'检测':'转运',readout:`${time.toFixed(1)} s · 缓存 ${buffer.count}/3 · ${s.signal.value?'信号亮':'信号灭'}`,materialAudit:audit,process:s,bufferCount:buffer.count};
 }
 return {root,parts,setPose,cycleAt:t=>cycleTime(t,24).local/24,renderStyle:'anatomy-light',direction:[1,-1,1],title:'压装与检测 · 工艺迁移开发例',description:'原创示意工位，验证设备映射、独立时钟、窗口回位、工艺配色和动态缓存轮廓；不是既有工厂案例的复刻或工业节拍。',strokeLabel:'工艺循环',style:'technical'};
}
