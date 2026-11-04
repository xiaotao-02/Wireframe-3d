import * as T from 'three';
import {box,solid,beam,slabGeometry,latheShell,flange,sweptTube,softenedBox} from './lib/geometry.js';
import {illustrationPalette} from './lib/illustration.js';
import {port,assemblyPart} from './lib/assembly.js';
// Original illustrative press. One scene unit represents 100 mm; no load/pressure rating is implied.
export function buildScene({columnSpacing=3.4,travel=.65}={}){
 if(columnSpacing<3.1||columnSpacing>3.8||travel<=0||travel>.65)throw Error('Press fixture range: spacing 3.1–3.8; travel (0,.65]');
 const root=new T.Group(),parts=[],m=illustrationPalette(),relations=[],features=[],sx=columnSpacing/2;
 const make=(id,label,description,explode)=>{const node=new T.Group();root.add(node);const p=assemblyPart({id,node,ports:[],source:'Original educational geometry; 1 scene unit = 100 mm',label,description,explode});parts.push(p);return p;};
 const add=(p,o)=>{p.node.add(o);return o;},cyl=(r,h,mat,pos,sides=48)=>{const o=solid(new T.CylinderGeometry(r,r,h,sides).rotateX(Math.PI/2),mat);o.position.fromArray(pos);return o;};
 const P=(p,id,position,normal,diameter=null,node=p.node)=>{const o=port(node,{id,position,normal,diameter});p.ports.push(o);return o;};
 const mate=(id,a,b,type='mate',extra={})=>relations.push({id,type,a,b,tolerance:.002,angleTolerance:.4,...extra});
 const ring=(p,x,y,z,ro,ri,h,mat=m.metal)=>add(p,(()=>{const o=solid(latheShell({profile:[[0,ro],[h,ro]],wall:ro-ri,segments:64}),mat);o.position.set(x,y,z);return o;})());
 const screw=(p,x,y,z,r=.045)=>{add(p,cyl(r*1.2,.018,m.metal,[x,y,z]));const head=add(p,cyl(r,.043,m.metal,[x,y,z+.026],6));add(p,box([r,.012,.003],m.dark,[x,y,z+.049]));return head;};
 const rect=(w,d)=>[[-w/2,-d/2],[w/2,-d/2],[w/2,d/2],[-w/2,d/2]],circle=(x,y,r,n=48)=>Array.from({length:n},(_,i)=>[x+Math.cos(-i/n*Math.PI*2)*r,y+Math.sin(-i/n*Math.PI*2)*r]);
 const plate=(p,w,d,z,h,holes=[],mat=m.body,cy=.4)=>{const mesh=solid(slabGeometry({outline:rect(w,d),holes,thickness:h}),mat);mesh.position.set(0,cy,z);return add(p,mesh);};
 const base=make('base','底座 · 地脚与 T 型槽','四点支承、带槽工作台和固定安装面。尺寸为教学示意。',[0,0,0]);
 // Real recessed T-section slots: narrow mouth, wider undercut and continuous lower bed.
 const bed=add(base,new T.Group());bed.position.set(.25,.25,0);
 for(const [z,h,width] of [[.14,.08,0],[.22,.08,.14],[.30,.06,.065]]){
  const holes=width?[-.85,0,.85].map(x=>rect(width,1.5).map(([u,v])=>[u+x-.25,v-.4])):[];
  const layer=solid(slabGeometry({outline:rect(5.4,3.1),holes,thickness:h}),m.base);layer.position.z=z;bed.add(layer);
 }
 for(const x of [-2,2.45])for(const y of [-.85,1.35]){add(base,cyl(.18,.14,m.dark,[x,y,.07]));ring(base,x,y,.135,.20,.07,.025);screw(base,x,y,.36,.06);}
 for(const x of [-.85,0,.85])features.push({id:'actual-slot-floor:'+x,type:'surface',mesh:bed,frame:port(bed,{id:'slot-floor:'+x,position:[x-.25,-.4,.22],normal:[0,0,1]}),points:[[0,-.4],[0,.4]],reach:.18,tolerance:.001});
 for(const x of [-2.15,2.65])for(let i=0;i<14;i++)add(base,box([.018,i%5===0?.12:.06,.004],m.dark,[x,-.9+i*.16,.364]));
 P(base,'frame',[0,.4,.36],[0,0,1]);P(base,'fixture',[0,.4,.36],[0,0,1]);P(base,'air',[2.45,1.05,.36],[0,0,1]);
 const frame=make('frame','机架 · 双导柱与横梁','双导柱穿过真实导套孔；横梁开孔供压杆通过。',[0,0,.55]);
 for(const x of [-sx,sx]){plate(frame,.62,.65,.36,.09,[],m.body,.4).position.x=x;ring(frame,x,.4,.45,.19,.09,.13);add(frame,cyl(.09,3.55,m.metal,[x,.4,.58+3.55/2]));ring(frame,x,.4,3.91,.18,.091,.10);for(const dx of [-.22,.22])for(const dy of [-.23,.23])screw(frame,x+dx,.4+dy,.46);}
 const head=plate(frame,columnSpacing+.78,1.7,4.10,.18,[circle(0,0,.135)],m.body);
 for(const x of [-sx,sx]){ring(frame,x,.4,4.28,.15,.09,.05);screw(frame,x,.4,4.35,.105);}
 for(const x of [-sx-.23,sx+.23])for(const y of [-.27,1.07])screw(frame,x,y,4.29,.045);
 P(frame,'base',[0,.4,.36],[0,0,-1]);P(frame,'cylinder',[0,.4,4.28],[0,0,1]);P(frame,'guideL',[-sx,.4,.58],[0,0,1]);P(frame,'guideR',[sx,.4,.58],[0,0,1]);mate('base-to-frame','base.frame','frame.base','support');
 const cylinder=make('cylinder','执行缸 · 缸筒、端盖与气口','空心缸筒、端盖和穿杆孔。活塞按示意行程运动，不给出压力或载荷。',[0,0,1.1]);
 const fp={outerRadius:.66,boreRadius:.12,thickness:.12,boltCircle:.55,boltRadius:.045,boltCount:8};
 const lower=add(cylinder,flange(fp,m.body));lower.position.set(0,.4,4.28);
 const barrel=add(cylinder,solid(latheShell({profile:[[0,.48],[1.10,.48]],wall:.08,segments:96}),m.body));barrel.position.set(0,.4,4.40);
 const upper=add(cylinder,flange({...fp,boreRadius:.07,thickness:.13},m.body));upper.position.set(0,.4,5.5);
 for(let i=0;i<8;i++){const a=i*Math.PI/4,x=Math.cos(a)*.55,y=.4+Math.sin(a)*.55;add(cylinder,cyl(.026,1.35,m.metal,[x,y,4.96]));screw(cylinder,x,y,5.65,.047);screw(cylinder,x,y,4.27,.047);}
 for(const z of [4.43,5.44])ring(cylinder,0,.4,z,.485,.475,.025,m.metal);
 const inlet=ring(cylinder,0,.4,5.63,.11,.07,.20,m.metal);ring(cylinder,0,.4,5.64,.15,.11,.05,m.metal);ring(cylinder,0,.4,5.78,.125,.11,.03,m.dark);
 P(cylinder,'mount',[0,.4,4.28],[0,0,-1]);P(cylinder,'axis',[0,.4,4.28],[0,0,-1],.2);P(cylinder,'air',[0,.4,5.83],[0,0,1],.14);mate('frame-to-cylinder','frame.cylinder','cylinder.mount');
 features.push({id:'actual-barrel-bore',type:'bore',mesh:barrel,frame:port(barrel,{id:'bore',position:[0,0,1.1],normal:[0,0,1]}),depth:1.1,expectedDiameter:.8,tolerance:.003},{id:'actual-air-inlet',type:'bore',mesh:inlet,frame:port(inlet,{id:'bore',position:[0,0,.2],normal:[0,0,1]}),depth:.2,expectedDiameter:.14,tolerance:.001});
 const slide=make('slide','滑台 · 导套、压杆与活塞','导套与双导柱同轴；压杆和活塞随滑台同步运动，保持真实行程。',[0,-1,.25]);
 const moving=plate(slide,columnSpacing+.48,.88,2.10,.20,[circle(-sx,0,.11),circle(sx,0,.11)],m.body);
 for(const x of [-sx,sx]){const b=ring(slide,x,.4,2.07,.18,.10,.30,m.metal);ring(slide,x,.4,2.30,.22,.10,.05,m.body);features.push({id:'actual-guide-bore:'+x,type:'bore',mesh:b,frame:port(b,{id:'bore',position:[0,0,.30],normal:[0,0,1]}),depth:.30,expectedDiameter:.20,tolerance:.001});for(const dx of [-.26,.26])screw(slide,x+dx,.4,2.32,.038);}
 add(slide,cyl(.10,2.84,m.metal,[0,.4,2.30+2.84/2]));ring(slide,0,.4,2.30,.19,.10,.13,m.body);
 const piston=add(slide,cyl(.36,.16,m.metal,[0,.4,5.12]));ring(slide,0,.4,5.03,.365,.34,.025,m.dark);
 P(slide,'guideL',[-sx,.4,2.22],[0,0,1]);P(slide,'guideR',[sx,.4,2.22],[0,0,1]);P(slide,'rod',[0,.4,2.30],[0,0,1],.2);P(slide,'tool',[0,.4,2.10],[0,0,-1]);
 for(const side of ['L','R'])mate('guide-slide-'+side,'frame.guide'+side,'slide.guide'+side,'slider',{travel:[1.64-travel,1.64]});mate('rod-axis','cylinder.axis','slide.rod','coaxial');
 relations.push({id:'piston-to-barrel-clearance',type:'clearance',a:piston,b:barrel,minGap:.025,maxPairs:160000});
 const tool=make('tool','压头 · 夹持与工作端','压头与滑台固定连接；末端和夹具保留演示间隙。',[0,-1.3,-.10]);
 ring(tool,0,.4,1.98,.30,.11,.12,m.body);add(tool,cyl(.12,.48,m.metal,[0,.4,1.74]));const tip=add(tool,cyl(.31,.12,m.body,[0,.4,1.44]));for(let i=0;i<4;i++){const a=i*Math.PI/2;screw(tool,Math.cos(a)*.23,.4+Math.sin(a)*.23,2.10,.034);}
 P(tool,'mount',[0,.4,2.10],[0,0,1]);mate('slide-to-tool','slide.tool','tool.mount');
 const fixture=make('fixture','夹具 · 定位块与工件','可见定位块、台阶与压紧螺钉；末端接触只表示演示位置。',[0,-.3,-.10]);
 add(fixture,box([1.6,.95,.16],m.body,[0,.4,.44]));const workpiece=add(fixture,box([.8,.55,.18],m.accent,[0,.4,.61]));
 for(const x of [-.57,.57]){add(fixture,box([.20,.72,.23],m.metal,[x,.4,.635]));screw(fixture,x,.14,.77,.05);screw(fixture,x,.66,.77,.05);}
 P(fixture,'base',[0,.4,.36],[0,0,-1]);mate('base-to-fixture','base.fixture','fixture.base','support');relations.push({id:'tool-workpiece-gap',type:'clearance',a:tip,b:workpiece,minGap:.025});
 const air=make('air','气源组件 · 过滤、调压与仪表','侧置支架承托过滤杯、调压旋钮和表盘；数字不表示真实压力。',[.7,0,.15]);
 add(air,box([.55,.65,.10],m.body,[2.45,1.05,.41]));add(air,box([.12,.30,2.8],m.body,[2.55,1.25,1.86]));add(air,box([.70,.62,.12],m.body,[2.55,1.05,3.22]));
 const block=add(air,softenedBox([.52,.5,.38],.025,m.body));block.position.set(2.55,.95,3.5);
 const bowl=add(air,solid(latheShell({profile:[[0,.16],[.10,.22],[.69,.22]],wall:.035,segments:64}),m.body));bowl.position.set(2.55,.95,2.42);ring(air,2.55,.95,3.09,.25,.18,.13,m.metal);add(air,cyl(.08,.13,m.metal,[2.55,.95,2.36]));
 for(let i=0;i<20;i++){const a=i*Math.PI*2/20;add(air,box([.015,.015,.22],m.dark,[2.55+Math.cos(a)*.20,.95+Math.sin(a)*.20,3.82]));}add(air,cyl(.2,.23,m.body,[2.55,.95,3.82]));
 const outlet=ring(air,2.55,.95,3.94,.11,.07,.16,m.metal);
 const gauge=add(air,cyl(.26,.10,m.metal,[2.55,.65,3.53]));gauge.rotation.x=Math.PI/2;const face=add(air,cyl(.225,.012,m.body,[2.55,.59,3.53]));face.rotation.x=Math.PI/2;
 for(let i=0;i<=12;i++){const a=(i/12*1.5+.25)*Math.PI,r=.18;const mark=add(air,box([.013,.012,i%3===0?.052:.029],m.dark,[2.55+Math.cos(a)*r,.578,3.53+Math.sin(a)*r]));mark.rotation.y=Math.PI/2-a;}
 add(air,beam([2.55,.567,3.53],[2.42,.567,3.64],.017,.014,m.dark));add(air,cyl(.035,.015,m.dark,[2.55,.567,3.53])).rotation.x=Math.PI/2;
 for(const x of [2.28,2.62])for(const y of [.83,1.27])screw(air,x,y,.48,.04);
 P(air,'base',[2.45,1.05,.36],[0,0,-1]);P(air,'out',[2.55,.95,4.10],[0,0,1],.14);mate('base-to-air','base.air','air.base','support');
 features.push({id:'actual-air-outlet',type:'bore',mesh:outlet,frame:port(outlet,{id:'bore',position:[0,0,.16],normal:[0,0,1]}),depth:.16,expectedDiameter:.14,tolerance:.001});
 const hose=make('hose','气管 · 两端接头与避让','从两个已声明的气口生成端点；沿后侧布管，避免穿过横梁。',[.5,.6,.4]);
 const start=cylinder.ports.find(p=>p.id==='air').position,end=air.ports.find(p=>p.id==='out').position;
 const route=[start,[0,.4,6.02],[.35,1.45,6.12],[1.9,1.55,5.95],[2.65,1.4,5.05],[2.55,.95,4.35],end];
 const tube=add(hose,solid(sweptTube({points:route,radii:route.map(()=>.10),wall:.03,segments:140,sides:20}),m.metal));
 for(const at of [start,end]){ring(hose,at[0],at[1],at[2]+.015,.14,.10,.065,m.body);ring(hose,at[0],at[1],at[2]+.085,.12,.10,.045,m.dark);}
 P(hose,'in',start,[0,0,-1],.14);P(hose,'out',end,[0,0,-1],.14);mate('cylinder-air-hose','cylinder.air','hose.in');mate('regulator-air-hose','air.out','hose.out');relations.push({id:'hose-crosshead-clearance',type:'clearance',a:tube,b:head,minGap:.03,maxPairs:100000});
 // Mesh surface probes verify the interfaces were not placed on imaginary faces.
 for(const [id,mesh,frame,points] of [['bed-contact',bed,base.ports[0],[[.45,.15],[-.45,.15]]],['cylinder-foot',lower,cylinder.ports[0],[[.3,.0],[-.3,0]]],['tool-seat',moving,slide.ports.at(-1),[[.2,0],[-.2,0]]]])features.push({id:'surface:'+id,type:'surface',mesh,frame,points,reach:.025,tolerance:.002});
 const setPose=({stroke=0})=>{const dz=-T.MathUtils.clamp(stroke,0,1)*travel;slide.node.position.z+=dz;tool.node.position.z+=dz;};
 const assembly={root,parts,relations,features,grounded:['base']};
 return {root,parts,assembly,setPose,title:'气动压装台 · 连接与行程',description:'双导柱、执行缸、压头与气源回路。原创教学模型，尺寸以场景单位表达；不提供压力或载荷结论。',style:'technical',renderStyle:'anatomy-light',direction:[1,-1,.8165],units:'1 unit = 100 mm',strokeLabel:'压装行程',strokeRange:travel};
}
