import * as T from 'three';
import {box,solid,softenedBox,latheShell,slabGeometry,coilSpring,sweptTube} from './lib/geometry.js';
import {illustrationPalette} from './lib/illustration.js';
import {port,assemblyPart} from './lib/assembly.js';

// Original Three.js geometry; mechanism inspired by Anatomy/examples/push-button.
// No electrical ratings inferred. A rigid bridge makes contact only at full stroke.
export function buildScene({gap=.6}={}) {
 if(!Number.isFinite(gap)||gap<.4||gap>.7)throw Error('contact-switch: illustrative gap must be .4–.7 units');
 const root=new T.Group(),parts=[],m=illustrationPalette(),relations=[],features=[];
 const group=(id,label,description,explode)=>{const node=new T.Group();node.name=id;root.add(node);const p=assemblyPart({id,node,label,description,explode,ports:[],source:'Original educational Three.js reconstruction'});parts.push(p);return p;};
 const add=(p,o)=>{p.node.add(o);return o;};
 const cylinder=(r,h,mat,pos,n=48)=>{const o=solid(new T.CylinderGeometry(r,r,h,n).rotateX(Math.PI/2),mat);o.position.fromArray(pos);return o;};
 const ring=(p,at,ro,ri,h)=>{const o=solid(latheShell({profile:[[0,ro],[h,ro]],wall:ro-ri}),m.metal);o.position.fromArray(at);return add(p,o);};
 const screw=(p,x,y,z)=>{add(p,cylinder(.085,.055,m.metal,[x,y,z+.0275],6));add(p,box([.09,.012,.004],m.dark,[x,y,z+.058]));};
 const P=(p,id,position,normal=[0,0,1],node=p.node)=>{p.ports.push(port(node,{id,position,normal}));};
 const mate=(id,a,b,type='support',extra={})=>relations.push({id,type,a,b,tolerance:.001,...extra});
 const base=group('base','底板与绝缘座','四点支承、固定螺钉和绝缘座；保持触点与底板隔离。',[0,0,0]);
 const bed=softenedBox([7,4.3,.22],.055,m.base);bed.position.z=.19;add(base,bed);
 for(const x of [-3.05,3.05])for(const y of [-1.7,1.7]){add(base,cylinder(.16,.08,m.dark,[x,y,.04]));screw(base,x,y,.30);}
 add(base,box([2.6,1.9,.18],m.body,[-1.5,0,.39]));
 for(const x of [-2.55,-.45])for(const y of [-.7,.7])screw(base,x,y,.48);
 for(let i=0;i<=24;i++)add(base,box([.012,i%5===0?.14:.07,.004],m.dark,[-2.85+i*.13,-1.8,.303]));
 for(const [id,position] of [['frame',[-1.5,0,.48]],['contacts',[-1.5,0,.48]],['power',[1.65,-.85,.30]],['lamp',[1.65,.95,.30]]])P(base,id,position);
 const frame=group('frame','导向架与衬套','双立柱承托横梁；压杆穿过真实导向孔。',[0,.6,.7]);
 for(const x of [-2.55,-.45]){add(frame,box([.14,.26,2.35],m.body,[x,.32,1.655]));ring(frame,[x,.32,.48],.19,.07,.10);screw(frame,x,.32,2.85);}
 const shape=new T.Shape([new T.Vector2(-1.3,-.48),new T.Vector2(1.3,-.48),new T.Vector2(1.3,.48),new T.Vector2(-1.3,.48)]),hole=new T.Path();hole.absarc(0,0,.15,0,2*Math.PI,true);shape.holes.push(hole);
 const head=solid(new T.ExtrudeGeometry(shape,{depth:.14,bevelEnabled:false,curveSegments:32}),m.body);head.position.set(-1.5,0,2.78);add(frame,head);
 const guide=ring(frame,[-1.5,0,2.72],.23,.14,.28);
 P(frame,'base',[-1.5,0,.48],[0,0,-1]);P(frame,'axis',[-1.5,0,2.78]);mate('frame-support','base.frame','frame.base');
 features.push({id:'guide-real-hole',type:'bore',mesh:guide,frame:port(guide,{id:'bore',position:[0,0,.28]}),depth:.28,expectedDiameter:.28,tolerance:.002});
 const contacts=group('contacts','固定触点与端子','两只固定触点分别连向电源与灯座；中间保留开路。',[0,-.8,.15]);
 for(const x of [-2.18,-.82]){add(contacts,cylinder(.17,.55,m.body,[x,0,.755]));add(contacts,cylinder(.18,.10,m.metal,[x,0,1.08])).name='contact:'+x;add(contacts,box([.28,.55,.07],m.metal,[x,-.23,.57]));screw(contacts,x,-.41,.605);}
 P(contacts,'base',[-1.5,0,.48],[0,0,-1]);mate('contact-support','base.contacts','contacts.base');
 const actuator=group('actuator','按钮、压杆与桥接触片','按钮带动同一压杆与铜桥；完全按下时桥接两只触点。',[0,0,1.35]);
 const moving=new T.Group();add(actuator,moving);const bridgeBottom=1.13+gap;
 const bridge=box([1.78,.38,.09],m.accent,[-1.5,0,bridgeBottom+.045]);bridge.name='contact-bridge';moving.add(bridge);
 moving.add(cylinder(.10,2.05,m.metal,[-1.5,0,bridgeBottom+.09+1.025]));
 const cap=solid(latheShell({profile:[[0,.43],[.12,.43],[.18,.37]],wall:.06}),m.body);cap.position.set(-1.5,0,bridgeBottom+2.14);moving.add(cap);moving.add(cylinder(.37,.05,m.accent,[-1.5,0,bridgeBottom+2.31]));
 P(actuator,'guide',[-1.5,0,bridgeBottom+.09],[0,0,1],moving);
 mate('guided-button','frame.axis','actuator.guide','slider',{travel:[1.22-2.78,bridgeBottom+.09-2.78]});
 const springPart=group('spring','复位弹簧','线径保持不变，螺距随按钮行程缩短；回位力只作机制示意。',[-.7,0,.75]);
 const springBottom=.56,restLength=bridgeBottom-springBottom-.04;
 ring(springPart,[-1.5,0,.48],.36,.12,.08);
 const spring=coilSpring({radius:.25,wireRadius:.028,turns:5,length:restLength},m.metal);spring.mesh.position.set(-1.5,0,springBottom);add(springPart,spring.mesh);
 ring(springPart,[-1.5,0,bridgeBottom-.04],.32,.12,.04).name='upper-seat';
 P(springPart,'base',[-1.5,0,.48],[0,0,-1]);P(base,'spring',[-1.5,0,.48]);mate('spring-support','base.spring','spring.base');
 const battery=group('power','电源与支架','独立电池、端帽、夹持座与两个引线端子；不标定电压、电流。',[1,0,.25]);
 add(battery,box([1.2,1.15,.12],m.body,[1.65,-.85,.36]));
 add(battery,cylinder(.40,1.62,m.body,[1.65,-.85,1.23]));
 for(const z of [.42,1.95])ring(battery,[1.65,-.85,z],.415,.38,.08);
 add(battery,cylinder(.14,.08,m.metal,[1.65,-.85,2.08]));
 for(const x of [1.18,2.12]){add(battery,box([.08,.3,.45],m.metal,[x,-.85,.645]));screw(battery,x,-1.25,.42);}
 P(battery,'base',[1.65,-.85,.30],[0,0,-1]);mate('power-support','base.power','power.base');
 const lamp=group('lamp','灯座、玻壳与灯丝','灯丝仅在实际闭合且整体装配时点亮；拆开即显示断路。',[1,0,.65]);
 add(lamp,box([1.1,1,.12],m.body,[1.65,.95,.36]));add(lamp,cylinder(.34,.35,m.body,[1.65,.95,.595]));
 for(let i=0;i<5;i++)ring(lamp,[1.65,.95,.58+i*.055],.36,.30,.018);
 const glass=solid(new T.SphereGeometry(.46,48,32),m.glass);glass.position.set(1.65,.95,1.12);glass.scale.z=1.2;add(lamp,glass);
 const lightMat=new T.MeshBasicMaterial({color:'#b88643',toneMapped:false});
 const filament=solid(new T.TorusGeometry(.115,.022,8,32,Math.PI*1.6),lightMat);filament.rotation.x=Math.PI/2;filament.position.set(1.65,.95,1.10);filament.userData.noStyle=true;add(lamp,filament);
 for(const x of [1.55,1.75])add(lamp,box([.015,.015,.32],m.metal,[x,.95,.94]));
 for(const x of [1.22,2.08])screw(lamp,x,1.30,.42);
 P(lamp,'base',[1.65,.95,.30],[0,0,-1]);mate('lamp-support','base.lamp','lamp.base');
 const terminals={};
 function terminal(part,id,at){
   const mesh=add(part,cylinder(.085,.08,m.metal,[at[0],at[1],at[2]-.04]));
   ring(part,[at[0],at[1],at[2]-.08],.11,.045,.025);P(part,id,at);
   terminals[id]={at,part};features.push({id:'terminal-face:'+id,type:'surface',mesh,frame:part.ports.at(-1),points:[[.045,0],[-.045,0]],reach:.02,tolerance:.001});
 }
 terminal(contacts,'switch-in',[-2.18,-.41,.74]);terminal(contacts,'switch-out',[-.82,-.41,.74]);
 terminal(battery,'positive',[1.65,-.85,2.20]);terminal(battery,'negative',[2.12,-.85,.95]);
 terminal(lamp,'lamp-in',[1.22,.70,.50]);terminal(lamp,'lamp-out',[2.08,.70,.50]);
 const wiring=group('wires','三段导线与端接','六个管口使用实际端子的坐标生成；电源 → 触点 → 灯座 → 电源，拆解时回路断开。',[0,-.45,.22]);
 const links=[
   ['positive','switch-in',[[1.65,-.85,2.36],[1.8,-1.6,2.30],[2.55,-1.7,.85],[2.55,-1.7,.62],[2.30,-1.7,.50],[1.5,-1.7,.50],[-1.5,-1.5,.50],[-2.18,-1.5,.62],[-2.18,-.85,.90]]],
   ['switch-out','lamp-in',[[-.82,-.41,.92],[-.82,-1.10,.83],[.45,-1.1,.48],[.65,.7,.49],[1.22,.70,.67]]],
   ['lamp-out','negative',[[2.08,.7,.68],[2.70,.70,.48],[2.70,-.85,.50],[2.12,-.85,1.13]]]
 ];
 for(const [from,to,via] of links){
   const a=terminals[from],b=terminals[to],lift=at=>[at[0],at[1],at[2]+.12],route=[a.at,lift(a.at),...via,lift(b.at),b.at];
   const wire=add(wiring,solid(sweptTube({points:route,radii:route.map(()=>.035),wall:.012,segments:160,sides:10}),m.dark));
   relations.push({id:'wire-to-base:'+from,type:'clearance',a:wire,b:bed,minGap:.025});
   for(const id of [from,to]){const t=terminals[id];P(wiring,id,t.at,[0,0,-1]);mate('wire-terminal:'+id,t.part.id+'.'+id,'wires.'+id,'mate');features.push({id:'wire-mouth:'+id,type:'surface',mesh:wire,frame:wiring.ports.at(-1),points:[[.029,0],[-.029,0],[0,.029],[0,-.029]],reach:.015,tolerance:.002});}
 }
 const setPose=({stroke=0,explode=0})=>{
   const travel=stroke*gap; moving.position.z=-travel; spring.setLength(restLength-travel);
   springPart.node.getObjectByName('upper-seat').position.z=bridgeBottom-.04-travel;
   const contactGap=Math.max(0,gap-travel),closed=explode===0&&contactGap<1e-7;
   lightMat.color.set(closed?'#ff9f18':'#978a76');m.glass.color.set(closed?'#ffd28a':'#d2e2e6');m.glass.opacity=closed?.24:.16;
   return {phase:explode>0?'拆解 · 回路断开':closed?'触点闭合 · 灯丝点亮':'触点分离 · 回路断开',contactGap,closed,stroke,readout:`${Math.round(stroke*100)}% 行程 · ${closed?'闭合':'断开'}`};
 };
 return {root,parts,setPose,assembly:{root,parts,relations,features,grounded:['base']},
 title:'弹簧按钮 · 触点与回路',description:'按下按钮，铜桥接触两端，灯丝点亮；松开后弹簧复位。机制参考 Anatomy，三维几何为独立教学重建；非电气工程模型。',
 renderStyle:'anatomy-light',direction:[.8,-1.3,.95],style:'technical',strokeLabel:'按钮行程',
 cycleAt:t=>{const p=t%4;return p<1?p:p<2?1:p<3?3-p:0;}};
}
