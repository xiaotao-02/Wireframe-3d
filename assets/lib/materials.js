import * as T from 'three';

// Deterministic material maps; color and data maps deliberately have separate color spaces.
export function surfaceMaps(kind='carbon',{size=128,repeat=[1,1],seed=23}={}){
 if(!['carbon','rubber','brushed','grain'].includes(kind)||!Number.isInteger(size)||size<16||size>1024||!Array.isArray(repeat)||repeat.length!==2||repeat.some(x=>!Number.isFinite(x)||x<=0))throw Error('Invalid surface map options');
 const pixels=new Uint8Array(size*size*4),height=new Uint8Array(pixels.length),rough=new Uint8Array(pixels.length);let state=seed>>>0;
 for(let y=0;y<size;y++)for(let x=0;x<size;x++){
  state=(Math.imul(state,1664525)+1013904223)>>>0;const noise=state/4294967296;
  let c,h,r;
  if(kind==='carbon'){const cell=Math.max(4,size/16),ix=Math.floor(x/cell),iy=Math.floor(y/cell),horizontal=(ix+iy)%4<2,t=(horizontal?y:x)%cell/cell;
   const ridge=Math.sin(Math.PI*t),filament=.5+.5*Math.sin((horizontal?y:x)*Math.PI);c=40+ridge*37+filament*7+noise*5;h=95+ridge*45;r=140-ridge*30;
  }else if(kind==='rubber'){c=40+noise*15;h=105+noise*40;r=210+noise*35;}
  else if(kind==='brushed'){c=150+18*Math.sin(y*1.7)+noise*15;h=100+20*Math.sin(y*1.7)+noise*20;r=125+noise*45;}
  else {c=210+noise*30;h=118+noise*20;r=210+noise*35;}
  const i=(y*size+x)*4;for(let k=0;k<3;k++){pixels[i+k]=c;height[i+k]=h;rough[i+k]=r;}pixels[i+3]=height[i+3]=rough[i+3]=255;
 }
 const texture=(data,colorSpace)=>{const t=new T.DataTexture(data,size,size,T.RGBAFormat);t.colorSpace=colorSpace;t.wrapS=t.wrapT=T.RepeatWrapping;t.repeat.fromArray(repeat);t.magFilter=T.LinearFilter;t.minFilter=T.LinearMipmapLinearFilter;t.generateMipmaps=true;t.needsUpdate=true;t.name=`${kind}-${colorSpace===T.SRGBColorSpace?'color':'data'}`;return t;};
 const result={color:texture(pixels,T.SRGBColorSpace),bump:texture(height,T.NoColorSpace),roughness:texture(rough,T.NoColorSpace)};
 result.dispose=()=>{result.color.dispose();result.bump.dispose();result.roughness.dispose();};return result;
}

export function productMaterials({textures=true,textureRepeat=6}={}){
 const maps=textures?{carbon:surfaceMaps('carbon',{repeat:[textureRepeat,textureRepeat]}),rubber:surfaceMaps('rubber',{repeat:[12,3]}),metal:surfaceMaps('brushed',{repeat:[2,2]})}:{};
 const defined=p=>Object.fromEntries(Object.entries(p).filter(([,v])=>v!==undefined));
 const physical=p=>new T.MeshPhysicalMaterial(defined(p)),standard=p=>new T.MeshStandardMaterial(defined(p));
 const materials={
  paint:physical({color:'#c50014',metalness:.25,roughness:.27,clearcoat:.9,clearcoatRoughness:.18}),
  white:physical({color:'#f0f1ed',metalness:.12,roughness:.27,clearcoat:.8,clearcoatRoughness:.2}),
  carbon:physical({color:maps.carbon?'#ffffff':'#14161a',map:maps.carbon?.color,bumpMap:maps.carbon?.bump,bumpScale:.00022,roughnessMap:maps.carbon?.roughness,roughness:.62,metalness:.25,clearcoat:.55,clearcoatRoughness:.3}),
  rubber:standard({color:'#17191b',bumpMap:maps.rubber?.bump,bumpScale:.0003,roughnessMap:maps.rubber?.roughness,roughness:1,metalness:0}),
  metal:standard({color:'#9ca1a6',metalness:.88,roughness:.35,bumpMap:maps.metal?.bump,bumpScale:.00008}),
  darkMetal:standard({color:'#282c31',metalness:.8,roughness:.32}),
  cavity:standard({color:'#080a0d',roughness:.86}),
  glass:physical({color:'#455962',metalness:.08,roughness:.12,transparent:true,opacity:.42,depthWrite:false,clearcoat:1,clearcoatRoughness:.08,side:T.DoubleSide}),
  redLens:physical({color:'#a4000a',roughness:.22,metalness:.15,clearcoat:1}),
  redLight:standard({color:'#e70012',emissive:'#ff0011',emissiveIntensity:1.7,roughness:.3}),
  whiteLight:standard({color:'#eff9ff',emissive:'#bbddff',emissiveIntensity:1.4,roughness:.2}),
  brake:standard({color:'#b91616',metalness:.35,roughness:.32})
 };
 for(const [name,m]of Object.entries(materials)){m.name=name;m.userData.materialRole=name;}
 return {materials,maps,dispose(){for(const m of Object.values(materials))m.dispose();for(const m of Object.values(maps))m.dispose();}};
}

// A reusable lighting environment, generated locally. The returned target belongs to the caller.
export function studioEnvironment(renderer,{intensity=1,blur=.035,background='#707781'}={}){
 const scene=new T.Scene();scene.background=new T.Color(background);
 const source=[];
 const panel=(position,size,color)=>{const material=new T.MeshBasicMaterial({color,side:T.DoubleSide}),geometry=new T.PlaneGeometry(...size),mesh=new T.Mesh(geometry,material);mesh.position.fromArray(position);mesh.lookAt(0,0,0);scene.add(mesh);source.push(mesh);};
 panel([0,3,5],[8,2],new T.Color(4,4,4));panel([-4,-2,2],[3,5],new T.Color(2.4,2.5,2.7));panel([4,1,2],[2,5],new T.Color(2.2,2.1,2));panel([0,-5,1],[8,.8],new T.Color(1.5,1.5,1.5));
 const generator=new T.PMREMGenerator(renderer),target=generator.fromScene(scene,blur,.1,40);generator.dispose();for(const p of source){p.geometry.dispose();p.material.dispose();}
 target.texture.name='procedural-studio-environment';return {texture:target.texture,intensity,dispose:()=>target.dispose()};
}
