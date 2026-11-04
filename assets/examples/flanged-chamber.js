import * as THREE from 'three';
import {box,solid,latheShell,sweptTube,flange,softenedBox} from './lib/geometry.js';
import {palette} from './lib/presentation.js';
export function buildScene(){
 const root=new THREE.Group(),parts=[],m=palette();
 const part=(id,label,description,explode)=>{const node=new THREE.Group();root.add(node);parts.push({id,label,description,explode,node});return node;};
 const base=part('base','底座与支脚','基础、支脚与筒体接触；底座按真实尺寸生成小倒角。',[0,0,0]);const plate=softenedBox([3.6,2,.16],.035,m.dark);plate.position.z=.08;base.add(plate);for(const x of [-.48,.48])base.add(box([.17,.7,.44],m.steel,[x,0,.38]));
 const housing=part('housing','带壁厚的回转壳体','回转截面保留内壁和端部环面，顶端可以观察内部空间。',[0,0,.3]);housing.position.z=.6;housing.add(solid(latheShell({profile:[[0,.65],[.18,.7],[1.2,.7],[1.55,.5]],wall:.07}),m.body));
 const fp={outerRadius:.67,boreRadius:.43,thickness:.1,boltCircle:.56,boltRadius:.035,boltCount:8};const collar=flange(fp,m.steel);collar.position.z=1.5;housing.add(collar);
 const rotor=part('rotor','轴与内部示意件','原创结构试件，用于验证拆解、真实空腔和尺寸关系，不代表指定设备工作原理。',[0,0,.95]);rotor.position.z=.6;const shaft=solid(new THREE.CylinderGeometry(.075,.075,1.48,32).rotateX(Math.PI/2),m.steel);shaft.position.z=.74;rotor.add(shaft);for(const z of [.3,.8]){const disk=solid(new THREE.CylinderGeometry(.38,.38,.08,48).rotateX(Math.PI/2),m.accent);disk.position.z=z;rotor.add(disk);for(let i=0;i<6;i++){const fin=box([.32,.06,.19],m.accent,[Math.cos(i*Math.PI/3)*.2,Math.sin(i*Math.PI/3)*.2,z+.13]);fin.rotation.z=i*Math.PI/3;rotor.add(fin);}}
 const cover=part('cover','上盖与紧固件','法兰使用真实中心孔与八个螺栓孔；螺栓沿同一孔距圆分布。',[0,0,1.65]);cover.position.z=2.2;const lid=flange(fp,m.body);cover.add(lid);const dome=solid(latheShell({profile:[[.1,.43],[.22,.32],[.34,.15]],wall:.055}),m.body);cover.add(dome);for(let i=0;i<8;i++){const a=i*Math.PI/4,b=solid(new THREE.CylinderGeometry(.048,.048,.055,6).rotateX(Math.PI/2),m.dark);b.position.set(Math.cos(a)*.56,Math.sin(a)*.56,.13);cover.add(b);}
 const pipe=part('pipe','变径空心管路','曲线路径与沿程半径独立配置；不把半径数组平均成同粗细管。',[.2,-.65,.35]);pipe.add(solid(sweptTube({points:[[0,0,2.48],[0,-.5,2.65],[.6,-.8,2.65],[1.3,-.8,2.5]],radii:[.14,.14,.1,.1],wall:.025}),m.steel));
 return {root,parts,renderStyle:'studio',title:'法兰筒体 · 构件验证',style:'technical',description:'原创机械结构试件；验证回转内腔、变径管、法兰孔和组装关系。不是压力容器或制造设计。',direction:[1,-1.7,1],detailPart:'cover'};
}
