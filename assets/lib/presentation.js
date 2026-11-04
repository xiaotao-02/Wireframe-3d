import * as THREE from 'three';
// Current visible geometry only: hidden effects and outline helpers must not expand framing.
export function visibleGeometryBounds(root) {
 const result=new THREE.Box3(),instance=new THREE.Matrix4(),world=new THREE.Matrix4();
 root.updateWorldMatrix(true,true);
 function walk(node){
  if(!node.visible||node.userData.noFrame||node.userData.auditIgnore||node.userData.isIllustrationDecoration)return;
  if(node.isMesh){
   if(node.isSkinnedMesh||node.morphTargetInfluences?.length)throw Error('Deformed mesh framing needs evaluated bounds');
   node.geometry.computeBoundingBox();
   for(let i=0;i<(node.isInstancedMesh?node.count:1);i++){
    world.copy(node.matrixWorld);if(node.isInstancedMesh){node.getMatrixAt(i,instance);world.multiply(instance);}
    result.union(node.geometry.boundingBox.clone().applyMatrix4(world));
   }
  }
  for(const child of node.children)walk(child);
 }
 walk(root);return result;
}
export function palette(style='technical'){
 const m=(color,roughness=.8,metalness=0,extra={})=>new THREE.MeshStandardMaterial({color,roughness,metalness,...extra});
 return {body:m(style==='architectural'?'#ded6bd':'#d7dce0'),stone:m('#918d79'),frame:m('#614936',.58),glass:m('#89a4a2',.23,.18,{transparent:true,opacity:.33,depthWrite:false}),steel:m('#9ba6b0',.34,.5),dark:m('#3d4850',.6,.1),accent:m('#b37448',.5,.2),land:m('#a6ad8a',1),water:m('#648e88',.27,.15),wood:m('#a38a60',.8)};
}
export function studioLighting(scene,renderer,bounds,style='technical'){
 const warm=style==='architectural';scene.background=new THREE.Color(warm?'#eeede6':'#f5f6f7');renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1;renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFShadowMap;
 const rig=new THREE.Group(),center=bounds.getCenter(new THREE.Vector3()),size=bounds.getSize(new THREE.Vector3()),r=Math.max(...size.toArray())*.8;
 rig.add(new THREE.HemisphereLight('#ffffff',warm?'#b8b09c':'#a8adb4',1.25));
 const key=new THREE.DirectionalLight(warm?'#fff2db':'#ffffff',3);key.position.copy(center).add(new THREE.Vector3(-r,-r,r*1.8));key.target.position.copy(center);key.castShadow=true;Object.assign(key.shadow.camera,{left:-r,right:r,top:r,bottom:-r,near:.05,far:r*6});key.shadow.mapSize.set(2048,2048);key.shadow.normalBias=r*.001;rig.add(key,key.target);
 const fill=new THREE.DirectionalLight('#dce6ed',.65);fill.position.copy(center).add(new THREE.Vector3(r,r,r));rig.add(fill);scene.add(rig);return rig;
}
export function fitOrthographic(camera,controls,bounds,{width,height,direction=[1,-1.4,.95],insets={top:70,right:26,bottom:100,left:26}}){
 if(bounds.isEmpty())throw Error('fitOrthographic: empty bounds');const center=bounds.getCenter(new THREE.Vector3()),diag=bounds.getSize(new THREE.Vector3()).length();camera.up.set(0,0,1);camera.position.copy(center).add(new THREE.Vector3(...direction).normalize().multiplyScalar(diag*3));camera.lookAt(center);camera.zoom=1;camera.updateMatrixWorld(true);
 const ps=[];for(const x of [bounds.min.x,bounds.max.x])for(const y of [bounds.min.y,bounds.max.y])for(const z of [bounds.min.z,bounds.max.z])ps.push(new THREE.Vector3(x,y,z).applyMatrix4(camera.matrixWorldInverse));
 const xs=ps.map(p=>p.x),ys=ps.map(p=>p.y),usableW=Math.max(width*.35,width-insets.left-insets.right),usableH=Math.max(height*.35,height-insets.top-insets.bottom),unit=Math.max((Math.max(...xs)-Math.min(...xs))/usableW,(Math.max(...ys)-Math.min(...ys))/usableH)*1.04;
 const dx=(insets.left-insets.right)*unit/2,dy=(insets.top-insets.bottom)*unit/2;camera.left=-width*unit/2-dx;camera.right=width*unit/2-dx;camera.top=height*unit/2+dy;camera.bottom=-height*unit/2+dy;camera.near=Math.max(.001,diag/1000);camera.far=diag*10;camera.updateProjectionMatrix();if(controls){controls.target.copy(center);controls.update();}return {center:center.toArray(),direction:[...direction],height:height*unit,insets};
}
export function surfaceDetail(baseColor,{repeat=1,seed=5,amplitude=8}={}){
 // Optional subtle microtexture; never substitutes for masonry relief, joints, openings or silhouette.
 const c=document.createElement('canvas');c.width=c.height=128;const ctx=c.getContext('2d'),im=ctx.createImageData(128,128),color=new THREE.Color(baseColor).convertLinearToSRGB();let s=seed>>>0;
 for(let i=0;i<im.data.length;i+=4){s=(1664525*s+1013904223)>>>0;const n=(s/4294967296-.5)*amplitude;im.data[i]=Math.max(0,Math.min(255,color.r*255+n));im.data[i+1]=Math.max(0,Math.min(255,color.g*255+n));im.data[i+2]=Math.max(0,Math.min(255,color.b*255+n));im.data[i+3]=255;}ctx.putImageData(im,0,0);const texture=new THREE.CanvasTexture(c);texture.colorSpace=THREE.SRGBColorSpace;texture.wrapS=texture.wrapT=THREE.RepeatWrapping;texture.repeat.set(repeat,repeat);return texture;
}
