import {AVATAR_CROP as C} from './constants.js';
import {showDialog,closeDialog} from './ui-motion.js';
export async function cropAvatar(file){
 if(!file||!C.types.includes(file.type)||file.size>C.maxBytes)throw Error(C.invalidFile);
 let bitmap;try{bitmap=await createImageBitmap(file);}catch{throw Error(C.invalidImage);}
 const dialog=document.createElement('dialog');dialog.className='avatar-crop-dialog';dialog.setAttribute('aria-labelledby','avatarCropTitle');dialog.dataset.noParticles='';
 dialog.innerHTML=`<header><h2 id="avatarCropTitle">${C.title}</h2><button type="button" data-cancel aria-label="${C.cancel}"><svg viewBox="0 0 24 24"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><div class="avatar-crop-body"><div class="avatar-crop-stage"><canvas tabindex="0" role="img" aria-label="${C.canvasLabel}"></canvas><div class="avatar-crop-grid" aria-hidden="true"></div></div><div class="avatar-crop-zoom"><button type="button" data-less aria-label="${C.zoomOut}"><svg viewBox="0 0 24 24"><path d="M5 12h14"/></svg></button><input type="range" min="1" max="${C.maxZoom}" step="${C.zoomStep}" value="1" aria-label="${C.zoom}"><button type="button" data-more aria-label="${C.zoomIn}"><svg viewBox="0 0 24 24"><path d="M5 12h14M12 5v14"/></svg></button><output>100%</output></div><button type="button" class="avatar-crop-reset" data-reset>${C.reset}</button></div><footer><button type="button" data-cancel>${C.cancel}</button><button type="button" class="avatar-crop-save" data-save>${C.apply}</button></footer>`;
 const canvas=dialog.querySelector('canvas'),slider=dialog.querySelector('input'),output=dialog.querySelector('output'),ctx=canvas.getContext('2d');
 if(!ctx){bitmap.close();throw Error(C.invalidImage);}
 canvas.width=canvas.height=C.previewSize;
 let zoom=1,cx=bitmap.width/2,cy=bitmap.height/2,frame=0,closing=false,gesture=null;
 const pointers=new Map(),minimum=Math.min(bitmap.width,bitmap.height),side=()=>minimum/zoom;
 function clamp(){const h=side()/2;cx=Math.max(h,Math.min(bitmap.width-h,cx));cy=Math.max(h,Math.min(bitmap.height-h,cy));}
 function paint(){frame=0;clamp();ctx.clearRect(0,0,canvas.width,canvas.height);ctx.drawImage(bitmap,cx-side()/2,cy-side()/2,side(),side(),0,0,canvas.width,canvas.height);}
 function render(){clamp();slider.value=zoom;output.value=Math.round(zoom*100)+'%';if(!frame)frame=requestAnimationFrame(paint);}
 function scale(value){zoom=Math.max(1,Math.min(C.maxZoom,value));render();}
 const point=e=>{const r=canvas.getBoundingClientRect();return {x:(e.clientX-r.left)/r.width,y:(e.clientY-r.top)/r.height};};
 function measure(){const p=[...pointers.values()];return {x:p.reduce((n,v)=>n+v.x,0)/p.length,y:p.reduce((n,v)=>n+v.y,0)/p.length,d:p.length>1?Math.hypot(p[0].x-p[1].x,p[0].y-p[1].y):0};}
 function begin(){gesture=pointers.size?{...measure(),cx,cy,zoom,side:side()}:null;}
 canvas.onpointerdown=e=>{if(e.button!==0||closing)return;e.preventDefault();canvas.focus({preventScroll:true});canvas.setPointerCapture(e.pointerId);pointers.set(e.pointerId,point(e));begin();};
 canvas.onpointermove=e=>{if(!pointers.has(e.pointerId)||!gesture)return;pointers.set(e.pointerId,point(e));const p=measure();zoom=Math.max(1,Math.min(C.maxZoom,gesture.zoom*(gesture.d>0?p.d/gesture.d:1)));cx=gesture.cx+(gesture.x-.5)*gesture.side-(p.x-.5)*side();cy=gesture.cy+(gesture.y-.5)*gesture.side-(p.y-.5)*side();render();};
 const end=e=>{pointers.delete(e.pointerId);begin();};canvas.onpointerup=end;canvas.onpointercancel=end;canvas.onlostpointercapture=end;
 canvas.addEventListener('wheel',e=>{e.preventDefault();scale(zoom*Math.exp(-e.deltaY*C.wheelScale));},{passive:false});
 canvas.onkeydown=e=>{const delta=side()*C.panStep;if(e.key==='ArrowLeft')cx-=delta;else if(e.key==='ArrowRight')cx+=delta;else if(e.key==='ArrowUp')cy-=delta;else if(e.key==='ArrowDown')cy+=delta;else if(e.key==='+'||e.key==='=')scale(zoom+C.buttonStep);else if(e.key==='-')scale(zoom-C.buttonStep);else return;e.preventDefault();render();};
 slider.oninput=()=>scale(Number(slider.value));dialog.querySelector('[data-less]').onclick=()=>scale(zoom-C.buttonStep);dialog.querySelector('[data-more]').onclick=()=>scale(zoom+C.buttonStep);
 dialog.querySelector('[data-reset]').onclick=()=>{cx=bitmap.width/2;cy=bitmap.height/2;scale(1);};
 return new Promise(resolve=>{
  async function finish(value){if(closing)return;closing=true;await closeDialog(dialog);cancelAnimationFrame(frame);bitmap.close();dialog.remove();resolve(value);}
  for(const b of dialog.querySelectorAll('[data-cancel]'))b.onclick=()=>void finish(null);
  dialog.addEventListener('cancel',e=>{e.preventDefault();void finish(null);});
  dialog.querySelector('[data-save]').onclick=()=>{if(closing)return;clamp();const result=document.createElement('canvas');result.width=result.height=C.outputSize;result.getContext('2d').drawImage(bitmap,cx-side()/2,cy-side()/2,side(),side(),0,0,C.outputSize,C.outputSize);void finish(result.toDataURL('image/png'));};
  document.body.append(dialog);paint();showDialog(dialog);
 });
}
