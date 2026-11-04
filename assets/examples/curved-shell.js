// Original development fixture: curved panel, real trimmed opening, cavity wall and surface-mounted insert.
// This is not a reconstruction benchmark or a vehicle model.
import * as T from 'three';
import {cubicBoundary,coonsPatch,trimmedPatchGeometry,openingWallGeometry,placeOnSurface} from './lib/surface-patches.js';
export function buildScene(){
  const root=new T.Group(),shell=new T.Group(),insert=new T.Group();root.add(shell,insert);
  const patch=coonsPatch({
    bottom:cubicBoundary([[-1,-.6,0],[-1/3,-.6,.4],[1/3,-.6,.4],[1,-.6,0]]),
    top:cubicBoundary([[-1,.6,0],[-1/3,.6,.4],[1/3,.6,.4],[1,.6,0]]),
    left:cubicBoundary([[-1,-.6,0],[-1,-.2,.15],[-1,.2,.15],[-1,.6,0]]),
    right:cubicBoundary([[1,-.6,0],[1,-.2,.15],[1,.2,.15],[1,.6,0]])
  });
  const hole=[[.4,.4],[.6,.4],[.6,.6],[.4,.6]];
  const skin=new T.Mesh(trimmedPatchGeometry(patch,{holes:[hole],subdivisions:4}),new T.MeshStandardMaterial({color:'#a32d37',roughness:.3,metalness:.25,side:T.DoubleSide}));skin.name='skin';shell.add(skin);
  shell.add(new T.Mesh(openingWallGeometry(patch,hole,{depth:.15,segments:16}),new T.MeshStandardMaterial({color:'#343a40',roughness:.65,side:T.DoubleSide})));
  const marker=new T.Mesh(new T.BoxGeometry(.12,.08,.025),new T.MeshStandardMaterial({color:'#d2a75d',roughness:.3,metalness:.6}));
  marker.name='surface-marker';insert.add(marker);placeOnSurface(marker,patch,{u:.2,v:.3,offset:.025});
  return {root,title:'曲面工具验证 · 开口面板',description:'原创工具试件：分片曲面、贯通开口、内壁与贴附构件；不是参考复刻验收。',renderStyle:'studio',style:'technical',direction:[1,-1.6,1.6],
    parts:[{id:'shell',label:'曲面与开口',description:'共享边界控制的曲面片，孔洞来自真实三角网格裁切。',node:shell,explode:[0,0,0]},
      {id:'insert',label:'贴附构件',description:'位置和朝向来自主体曲面的局部坐标。',node:insert,explode:[0,0,.6]}],
    referenceProbes:{corner:{part:'shell',mesh:'skin',vertex:0}}};
}
