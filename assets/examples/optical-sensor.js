// Complete original teaching object: curved optical sensor cover with a recessed window.
// Study the shared surface/opening/attachment construction; replace its shape for a new subject.
import * as T from 'three';
import {box,solid,slabGeometry,cylinderBetween,placeInFrame} from './lib/geometry.js';
import {placeOnSurface} from './lib/surface-patches.js';
import {recessedOpeningGeometries,surfaceDecalGeometry,surfaceRegion,trimmedGridGeometry,auditSurfaceGeometry} from './lib/surface-network.js';

export function buildScene(){
 const root=new T.Group(),parts=[];
 const group=(id,label,description,explode)=>{const node=new T.Group();node.name=id;root.add(node);parts.push({id,label,description,node,explode});return node;};
 const base=group('base','壳体与底脚','带真实贯通窗口的下壳，承接上盖与光学组件。',[0,0,0]);
 const cover=group('cover','曲面上盖','共享开口边界，孔壁与背板没有独立猜测位置。',[0,0,.65]);
 const glass=group('window','内凹窗口','局部域采样，玻璃随上盖曲率变化。',[0,0,1.1]);
 const fittings=group('fittings','连接与铭牌','旋钮按端点定位；指示标记贴附主体曲面。',[0,.5,.25]);
 const paint=new T.MeshStandardMaterial({color:'#c2ccd0',metalness:.28,roughness:.32});
 const dark=new T.MeshStandardMaterial({color:'#202b32',metalness:.2,roughness:.5});
 const metal=new T.MeshStandardMaterial({color:'#9fadb7',metalness:.78,roughness:.27});
 const windowMaterial=new T.MeshPhysicalMaterial({color:'#5fabbc',metalness:.08,roughness:.13,transparent:true,opacity:.68,depthWrite:false});
 const skinSurface={point:(u,v)=>new T.Vector3(2.2*(u-.5),1.3*(v-.5),.28+.17*Math.sin(Math.PI*u)*Math.sin(Math.PI*v))};
 const hole=[[.33,.28],[.72,.28],[.72,.72],[.33,.72]],xy=p=>skinSurface.point(...p).toArray().slice(0,2);
 base.add(solid(slabGeometry({outline:[[-1.1,-.65],[1.1,-.65],[1.1,.65],[-1.1,.65]],holes:[hole.map(xy)],thickness:.28}),dark));
 for(const x of [-.88,.88])for(const y of [-.46,.46])base.add(cylinderBetween([x,y,-.09],[x,y,0],.095,dark));
 const opening=recessedOpeningGeometries(skinSurface,{hole,depth:.14,uSegments:48,vSegments:32});
 const skin=solid(opening.skin,paint);skin.name='skin';cover.add(skin,solid(opening.wall,dark),solid(opening.back,dark));
 const region=surfaceRegion(skinSurface,{u:[.34,.71],v:[.29,.71],offset:-.035});
 const windowMesh=solid(trimmedGridGeometry(region,{uSegments:32,vSegments:24}),windowMaterial);windowMesh.name='window-glass';glass.add(windowMesh);
 const led=box([.075,.035,.018],new T.MeshStandardMaterial({color:'#f3ac38',emissive:'#a3530b',emissiveIntensity:.35}));
 placeOnSurface(led,skinSurface,{u:.19,v:.5,offset:.009});fittings.add(led);
 // Native LatheGeometry revolves around +Y; anchor is its local axial midpoint.
 const knobProfile=[[0,0],[.075,0],[.10,.025],[.10,.115],[.075,.14],[0,.14]].map(p=>new T.Vector2(...p));
 for(const y of [-.28,.28])fittings.add(placeInFrame(solid(new T.LatheGeometry(knobProfile,40),metal),{
  origin:[1.17,y,.14],x:[0,1,0],y:[1,0,0],anchor:[0,.07,0]
 }));
 for(const [u,v] of [[.08,.13],[.92,.13],[.08,.87],[.92,.87]]){
  const screw=cylinderBetween([0,0,-.012],[0,0,.012],.025,metal,{segments:12});placeOnSurface(screw,skinSurface,{u,v,offset:.01});cover.add(screw);
 }
 // Texture UVs can flip independently of the geometry when the visible reading direction changes.
 if(typeof document!=='undefined'){
  const canvas=document.createElement('canvas');canvas.width=512;canvas.height=128;
  const c=canvas.getContext('2d');c.fillStyle='#172730';c.fillRect(0,0,512,128);c.fillStyle='#e9f1f3';c.font='bold 55px sans-serif';c.textAlign='center';c.textBaseline='middle';c.fillText('OPTIC 01',256,67);
  const texture=new T.CanvasTexture(canvas);texture.colorSpace=T.SRGBColorSpace;
  fittings.add(new T.Mesh(surfaceDecalGeometry(skinSurface,{u:[.33,.72],v:[.11,.23],offset:.002,uSegments:24,vSegments:8}),new T.MeshStandardMaterial({map:texture,roughness:.6})));
 }
 const surfaceChecks={skin:auditSurfaceGeometry(opening.skin),window:auditSurfaceGeometry(windowMesh.geometry)};
 if(Object.values(surfaceChecks).some(r=>r.status!=='pass'))throw Error('Development example surface check failed');
 return {root,parts,title:'曲面光学传感器 · 构造示例',description:'原创开发示例：局部曲面、真实凹腔、同源孔壁与背板、局部窗口采样、端点轴件和贴花。不是参考图复刻或独立评测。',renderStyle:'studio',style:'technical',direction:[1,-1.5,1.6],surfaceChecks};
}
