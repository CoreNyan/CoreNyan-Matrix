import {ENTITY,ENTITY_MODELS,ENTITY_PREVIEW} from './constants.js';
const cache=new Map();
export function entityKind(layer){return Object.hasOwn(ENTITY_MODELS,layer?.entityModel)?layer.entityModel:ENTITY.layerModels[layer?.key]||ENTITY.layerModels[layer?.id]||'ark';}
export function entityPreview(layer){return ENTITY_PREVIEW.root+entityKind(layer)+'.png?v='+ENTITY_PREVIEW.version;}
export function rotatePoint(x,y,z,yaw,pitch){
 const a=x*Math.cos(yaw)+z*Math.sin(yaw),b=-x*Math.sin(yaw)+z*Math.cos(yaw);
 return [a,y*Math.cos(pitch)-b*Math.sin(pitch),y*Math.sin(pitch)+b*Math.cos(pitch)];
}
export function buildEntityModel(kind){
 if(!Object.hasOwn(ENTITY_MODELS,kind))kind='ark';
 if(!cache.has(kind)){
  const promise=fetch(ENTITY.assetRoot+kind+'.bin?v='+ENTITY.assetVersion).then(response=>{if(!response.ok)throw Error('模型加载失败：'+response.status);return response.arrayBuffer();}).then(buffer=>{
   const data=new DataView(buffer);
   if(buffer.byteLength<16||data.getUint32(0,true)!==0x43504e43||data.getUint32(4,true)!==1)throw Error('模型点阵格式不正确');
   const count=data.getUint32(8,true),scale=data.getFloat32(12,true);
   if(count>250000||count===0||buffer.byteLength!==16+count*10||!Number.isFinite(scale)||scale<=0)throw Error('模型点阵长度不正确');
   const points=new Float32Array(count*7);
   for(let i=0;i<count;i++){const src=16+i*10,dst=i*7;for(let j=0;j<3;j++)points[dst+j]=data.getInt16(src+j*2,true)*scale;for(let j=0;j<3;j++)points[dst+3+j]=data.getInt8(src+6+j)/127;points[dst+6]=data.getUint8(src+9)/127;}
   return {kind,points,count};
  }).catch(error=>{cache.delete(kind);throw error;});
  cache.set(kind,promise);
 }
 return cache.get(kind);
}
