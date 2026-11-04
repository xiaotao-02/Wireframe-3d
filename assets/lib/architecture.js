import * as THREE from 'three';
import {box,solid,seeded} from './geometry.js';
// Wall local axes: X width, Y thickness, Z height. Openings are [x0,z0,x1,z1].
export function masonryWall({width,height,thickness=.32,course=.22,gap=.012,relief=.045,openings=[],seed=7},material){
 if(Math.min(width,height,thickness,course)<=0||gap<0||gap>=course||relief<0)throw Error('masonryWall: invalid dimensions');
 for(const [a,b,c,d] of openings)if(a<-width/2||c>width/2||b<0||d>height||a>=c||b>=d)throw Error('masonryWall: opening outside wall');
 const root=new THREE.Group(),rand=seeded(seed),blocks=[],levels=[0,height,...openings.flatMap(o=>[o[1],o[3]])];for(let z=course;z<height;z+=course)levels.push(z);levels.sort((a,b)=>a-b);
 for(let l=0;l<levels.length-1;l++){const z0=levels[l],z1=levels[l+1];if(z1-z0<1e-7)continue;let spans=[[-width/2,width/2]];
  for(const [x0,y0,x1,y1]of openings)if(z0<y1-1e-7&&z1>y0+1e-7)spans=spans.flatMap(([a,b])=>x1<=a||x0>=b?[[a,b]]:[[a,Math.max(a,x0)],[Math.min(b,x1),b]].filter(([u,v])=>v-u>1e-7));
  for(const [a,b]of spans){root.add(box([b-a,thickness,z1-z0],material,[(a+b)/2,0,(z0+z1)/2]));let x=a;while(x<b-.001){const w=Math.min(b-x,course*(1.4+rand()*2.2)),h=z1-z0;if(w>gap&&h>gap)for(const side of [-1,1]){const d=relief*(.6+rand()*.8);blocks.push({p:[x+w/2,side*(thickness/2+d/2),(z0+z1)/2],s:[w-gap,d,h-gap],shade:.78+rand()*.2});}x+=w;}}
 }
 if(blocks.length){const inst=new THREE.InstancedMesh(new THREE.BoxGeometry(1,1,1),material,blocks.length),matrix=new THREE.Matrix4(),q=new THREE.Quaternion(),color=new THREE.Color();blocks.forEach((b,i)=>{matrix.compose(new THREE.Vector3(...b.p),q,new THREE.Vector3(...b.s));inst.setMatrixAt(i,matrix);inst.setColorAt(i,color.setRGB(b.shade,b.shade,b.shade));});inst.castShadow=inst.receiveShadow=true;root.add(inst);}
 root.userData={kind:'masonryWall',openings,blockCount:blocks.length};return root;
}
export function framedWindow({width,height,frame=.045,depth=.065,columns=3,rows=2},frameMaterial,glassMaterial){
 if(Math.min(width,height,frame,depth)<=0||2*frame>=Math.min(width,height)||columns<1||rows<1)throw Error('framedWindow: invalid dimensions');const g=new THREE.Group();
 for(const x of [-width/2+frame/2,width/2-frame/2])g.add(box([frame,depth,height],frameMaterial,[x,0,height/2]));for(const z of [frame/2,height-frame/2])g.add(box([width,depth,frame],frameMaterial,[0,0,z]));
 for(let i=1;i<columns;i++)g.add(box([frame*.6,depth*.8,height-frame*2],frameMaterial,[-width/2+i*width/columns,0,height/2]));for(let i=1;i<rows;i++)g.add(box([width-frame*2,depth*.8,frame*.6],frameMaterial,[0,0,i*height/rows]));
 g.add(box([width-2*frame,.012,height-2*frame],glassMaterial,[0,0,height/2]));return g;
}
export function riverSite({width=18,depth=14,resolution=64,center=y=>Math.sin(y*.25)*.9,halfWidth=1.1,waterLevel=y=>-.08,bankHeight=.55,bankSlope=2.7,baseDepth=.45},landMaterial,waterMaterial){
 if(Math.min(width,depth,resolution,halfWidth,bankSlope,baseDepth)<=0)throw Error('riverSite: invalid dimensions');
 const heightAt=(x,y)=>{const distance=Math.abs(x-center(y));const t=THREE.MathUtils.smoothstep(distance,halfWidth,halfWidth+bankSlope);return waterLevel(y)-.16+t*(bankHeight+.16);};
 const v=[],indices=[],n=resolution;for(let j=0;j<=n;j++)for(let i=0;i<=n;i++){const x=(i/n-.5)*width,y=(j/n-.5)*depth;v.push(x,y,heightAt(x,y));}for(let j=0;j<n;j++)for(let i=0;i<n;i++){const a=j*(n+1)+i,b=a+1,c=a+n+1,d=c+1;indices.push(a,b,c,b,d,c);}
 const border=[];for(let i=0;i<n;i++)border.push(i);for(let j=0;j<n;j++)border.push(j*(n+1)+n);for(let i=n;i>0;i--)border.push(n*(n+1)+i);for(let j=n;j>0;j--)border.push(j*(n+1));
 const bottom=Math.min(...border.map(i=>v[i*3+2]))-baseDepth,start=v.length/3;for(const i of border)v.push(v[i*3],v[i*3+1],bottom);
 for(let k=0;k<border.length;k++){const kk=(k+1)%border.length;indices.push(border[k],start+k,border[kk],border[kk],start+k,start+kk);}const bc=v.length/3;v.push(0,0,bottom);for(let k=0;k<border.length;k++)indices.push(bc,start+(k+1)%border.length,start+k);
 const geom=new THREE.BufferGeometry();geom.setAttribute('position',new THREE.Float32BufferAttribute(v,3));geom.setIndex(indices);geom.computeVertexNormals();const group=new THREE.Group();group.add(solid(geom,landMaterial));
 const w=[],wi=[];for(let j=0;j<=n;j++){const y=(j/n-.5)*depth;for(const s of [-1,1])w.push(center(y)+s*halfWidth*1.03,y,waterLevel(y));if(j<n){const a=j*2;wi.push(a,a+1,a+2,a+1,a+3,a+2);}}
 const wg=new THREE.BufferGeometry();wg.setAttribute('position',new THREE.Float32BufferAttribute(w,3));wg.setIndex(wi);wg.computeVertexNormals();const water=solid(wg,waterMaterial);water.castShadow=false;group.add(water);group.userData.kind='riverSite';return {group,heightAt,center,waterLevel};
}

