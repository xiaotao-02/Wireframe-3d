import * as THREE from 'three';
import {box,beam,solid,slabGeometry,softenedBox,seeded} from './lib/geometry.js';
import {masonryWall,framedWindow,riverSite} from './lib/architecture.js';
import {palette} from './lib/presentation.js';
export function buildScene(){
 const root=new THREE.Group(),parts=[],m=palette('architectural');
 const part=(id,label,description,explode)=>{const node=new THREE.Group();root.add(node);parts.push({id,label,description,explode,node});return node;};
 const site=part('site','河谷与基础','原创构造测试：河床、水面与缓坡共用一条河道函数。不是流水别墅复刻。',[0,0,0]);
 const river=riverSite({width:18,depth:13,center:y=>3.7+Math.sin(y*.3)*.45,halfWidth:1.05,bankHeight:.45,bankSlope:2.4,baseDepth:.32},m.land,m.water);site.add(river.group);
 for(const x of [-5.6,-.3])for(const y of [-2,1.7])site.add(box([.38,.42,.52],m.stone,[x,y,.58]));
 const rand=seeded(91);for(let i=0;i<24;i++){const y=(rand()-.5)*12,x=river.center(y)+(i%2?1:-1)*(1.2+rand()*.6),r=.12+rand()*.16,rock=solid(new THREE.IcosahedronGeometry(r,1),m.stone);rock.position.set(x,y,river.heightAt(x,y)+r*.3);rock.scale.set(1.4,1,.55);site.add(rock);}
 const lower=part('lower','首层 · 露台与起居','带洞楼板、石墙真实窗洞、薄窗框、室内座椅。建筑以水平板与竖向核心区分轻重。',[0,0,.45]);lower.position.z=.84;
 const outline=[[-6.2,-3.2],[1.8,-3.2],[1.8,.6],[-.8,.6],[-.8,2.6],[-6.2,2.6]],stair=[[-5.3,.45],[-4.3,.45],[-4.3,1.85],[-5.3,1.85]];
 lower.add(solid(slabGeometry({outline,holes:[stair],thickness:.22,bevel:.015}),m.body));
 const wall=masonryWall({width:5.6,height:2.65,thickness:.3,course:.19,relief:.035,openings:[[-1.2,.65,1.2,2.1]],seed:19},m.stone);wall.position.set(-3,1.9,.22);lower.add(wall);
 const win=framedWindow({width:2.4,height:1.45,columns:3,rows:2},m.frame,m.glass);win.position.set(-3,1.89,.87);lower.add(win);
 const side=masonryWall({width:3.7,height:2.65,thickness:.3,course:.19,seed:8},m.stone);side.rotation.z=Math.PI/2;side.position.set(-5.8,.05,.22);lower.add(side);
 const glazing=framedWindow({width:5.3,height:2.4,columns:6,rows:2,frame:.04},m.frame,m.glass);glazing.position.set(-2.9,-1.9,.22);lower.add(glazing);
 for(const x of [-5.6,-.25])lower.add(box([.09,.09,2.65],m.frame,[x,-1.9,1.545]));
 for(const x of [-4.2,-2.9]){const seat=softenedBox([1.1,.7,.24],.04,m.wood);seat.position.set(x,.4,.55);lower.add(seat);lower.add(box([1.1,.1,.48],m.wood,[x,.7,.78]));}lower.add(softenedBox([1.1,.75,.08],.02,m.wood));lower.children.at(-1).position.set(-3.5,-.6,.7);
 for(let i=0;i<7;i++)lower.add(box([.9,.2,.14],m.body,[-4.8,1.75-i*.19,.15+i*.12]));
 for(const x of [-5.9,1.5])for(const y of [-3.05,-1.95])lower.add(box([.035,.035,.8],m.frame,[x,y,.65]));lower.add(beam([-5.9,-3.05,1.05],[1.5,-3.05,1.05],.035,.035,m.frame));
 const upper=part('upper','二层 · 退台与书房','上部体量缩小并后退；楼板厚度保持小于墙高，窗后保留空间深度。',[0,0,1.45]);upper.position.z=3.71;
 upper.add(solid(slabGeometry({outline:[[-6.25,-2.35],[.25,-2.35],[.25,2.6],[-6.25,2.6]],thickness:.2,bevel:.015}),m.body));
 const core=masonryWall({width:3.2,height:2.3,thickness:.3,course:.19,seed:19},m.stone);core.position.set(-4.1,1.9,.2);upper.add(core);
 const uw=framedWindow({width:3.2,height:2.2,columns:4,rows:2},m.frame,m.glass);uw.position.set(-4.1,-.9,.2);upper.add(uw);
 for(const x of [-5.7,-2.5]){upper.add(box([.12,2.9,2.3],m.body,[x,.5,1.35]));}upper.add(box([1.6,.65,.08],m.wood,[-4,.7,.95]));
 const roof=part('roof','屋面 · 薄板与压顶','屋面独立拆解；安装状态与墙顶接触，展开状态只改变装配组位置。',[0,0,2.3]);roof.position.z=6.21;roof.add(solid(slabGeometry({outline:[[-6,-1.2],[-2.2,-1.2],[-2.2,2.25],[-6,2.25]],thickness:.17,bevel:.012}),m.body));
 return {root,parts,renderStyle:'studio',title:'河谷观景亭 · 构造验证',style:'architectural',description:'原创测试场景，用于检验建筑构件与跨题材预览入口；不是流水别墅原工程。',direction:[1.1,-1.6,1],detailPart:'lower'};
}
