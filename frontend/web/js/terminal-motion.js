// A terminal session: real startup work -> shared handoff -> a reversible shutdown.
const OPEN_MS=1180,SHRINK_MS=600,FADE_MS=300,CLOSE_MS=SHRINK_MS+FADE_MS,root=document.documentElement;
const reduce=matchMedia('(prefers-reduced-motion: reduce)'),boot=window.MatrixBoot;
let phase='loading',enabled=true,animations=[],finishTimer,generation=0,preparing=false,exitMask=null,exitField=null,bootEdges=null,exitEdges=null,edgeFrame=0;
const session=()=>document.querySelector('.terminal-session');
const setPhase=value=>{phase=value;root.dataset.terminalPhase=value;};
function aperture(size){
 const a=(1-size)*50,b=100-a;
 return `polygon(evenodd,0% 0%,100% 0%,100% 100%,0% 100%,0% 0%,${a}% ${a}%,${a}% ${b}%,${b}% ${b}%,${b}% ${a}%,${a}% ${a}%)`;
}
function closingMask(){
 if(!exitMask){exitMask=document.createElement('div');exitMask.className='terminal-exit-mask';exitMask.setAttribute('aria-hidden','true');exitMask.setAttribute('popover','manual');exitField=document.createElement('div');exitField.className='terminal-exit-field';exitField.style.clipPath=aperture(1);exitMask.append(exitField);document.body.append(exitMask);}
 if(!exitMask.matches(':popover-open'))exitMask.showPopover();if(!exitEdges)exitEdges=createEdgeGlitch(exitMask);return exitMask;
}
const allowed=()=>enabled&&!reduce.matches;
const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
const settled=step=>step&&['done','skipped'].includes(step.status);
const onScreen=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight;};
function cancel(){clearTimeout(finishTimer);cancelAnimationFrame(edgeFrame);edgeFrame=0;bootEdges?.clear();exitEdges?.clear();for(const a of animations)a.cancel();animations=[];}
function animate(e,frames,duration,delay=0,easing='cubic-bezier(.22,.75,.22,1)'){
 if(!e)return;const animation=e.animate(frames,{duration,delay,fill:'both',easing});animations.push(animation);return animation;
}
// Edge-only fragments and point scatter; no fullscreen flicker or idle animation.
function createEdgeGlitch(host){
 const canvas=document.createElement('canvas');canvas.className='terminal-edge-glitch';canvas.setAttribute('aria-hidden','true');host.append(canvas);
 const ctx=canvas.getContext('2d');let seed=crypto.getRandomValues(new Uint32Array(1))[0]||1,lastTime=0,lastSize=0,timer=0;
 const random=()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};
 const clear=()=>{clearTimeout(timer);ctx?.clearRect(0,0,canvas.width,canvas.height);canvas.dataset.active='false';};
 function paint(size){
  const now=performance.now();if(!ctx||!allowed()||document.hidden||size<=.001||size>=.999){clear();lastSize=size;return;}
  if(now-lastTime<36)return;
  const speed=Math.abs(size-lastSize)/Math.max(.016,(now-lastTime)/1000);lastTime=now;lastSize=size;
  const width=innerWidth,height=innerHeight;if(canvas.width!==width||canvas.height!==height){canvas.width=width;canvas.height=height;}
  clear();const fade=Math.min(1,size/.07,(1-size)/.07),spread=(5+Math.min(1,speed)*13)*fade;
  const x=(1-size)*width/2,y=(1-size)*height/2,w=width*size,h=height*size;
  ctx.fillStyle='#fff';
  for(let edge=0;edge<4;edge++){
   const horizontal=edge<2,length=horizontal?w:h,fixed=horizontal?(edge===0?y:y+h):(edge===2?x:x+w),start=horizontal?x:y;
   for(let n=0;n<9;n++){
    const along=random()*length,normal=(random()-.5)*spread*2,segment=Math.min(length-along,8+random()*64),thickness=1+Math.floor(random()*3);
    ctx.globalAlpha=(.28+random()*.65)*fade;
    if(horizontal)ctx.fillRect(Math.round(start+along),Math.round(fixed+normal),segment,thickness);
    else ctx.fillRect(Math.round(fixed+normal),Math.round(start+along),thickness,segment);
   }
   for(let n=0;n<18;n++){
    const along=random()*length,normal=(random()-.5)*spread*3,dot=random()>.75?2:1;ctx.globalAlpha=(.2+random()*.65)*fade;
    ctx.fillRect(Math.round(horizontal?start+along:fixed+normal),Math.round(horizontal?fixed+normal:start+along),dot,dot);
   }
  }
  ctx.globalAlpha=1;canvas.dataset.active='true';timer=setTimeout(clear,130);
 }
 return {paint,clear,dispose(){clear();canvas.remove();}};
}
function capture(e){const s=getComputedStyle(e);return{opacity:s.opacity,transform:s.transform,clipPath:s.clipPath};}
function collect(){
 const surfaces=[...document.body.children].filter(e=>e!==session()&&e!==exitMask&&!e.hasAttribute('data-native-chrome')&&!['SCRIPT','STYLE','LINK'].includes(e.tagName)&&onScreen(e));
 const view=document.querySelector('.chapter-view.active')||document.querySelector('body>main');
 const candidates=view?[...view.querySelectorAll('.signal-health,.cell-topline,.identity-heading-row,.hero-manifesto,.subconscious-diary-box,.hero-bottom-bar,.signal-loom-stage,.loom-cognitive-matrix,.loom-footer-bar,.health-dials,.ledger-block,.chat-header,.chat-sidebar>header,.chat-sidebar>label,.chat-sidebar>nav,.chat-messages,.chat-bottom,.entity-flight,.entity-stage,:scope>.brand,:scope>h1,:scope>form')].filter(onScreen):[];
 const details=candidates.filter(e=>!candidates.some(other=>other!==e&&other.contains(e))).slice(0,24);
 return {surfaces,details};
}
function finish(closing){
 setPhase(closing?'closed':'open');root.removeAttribute('data-terminal-boot');
 for(const e of document.querySelectorAll('[data-terminal-surface]')){e.inert=closing;if(!closing)e.removeAttribute('data-terminal-surface');}
 if(closing&&exitMask){exitField.style.clipPath='inset(0)';exitMask.style.opacity='1';}
 cancel();
 if(!closing&&exitMask){if(exitMask.matches(':popover-open'))exitMask.hidePopover();exitEdges?.dispose();exitEdges=null;exitMask.remove();exitMask=null;exitField=null;}
 const panel=session();if(panel){panel.hidden=true;panel.inert=true;panel.dataset.mode='idle';}
 dispatchEvent(new CustomEvent('matrix-terminal-settled',{detail:{closing}}));
}
function play(closing=false){
 if(closing&&['closing','closed'].includes(phase))return phase==='closing'?CLOSE_MS:0;
 if(!closing&&['opening','open'].includes(phase))return 0;
 const previous=phase,initial=phase==='loading',panel=session(),{surfaces,details}=collect();
 const nodes=[...surfaces,...details,...(panel?[panel,...panel.children,panel.querySelector('.terminal-doodle')].filter(Boolean):[])];
 const current=new Map(nodes.map(e=>[e,capture(e)]));
 const maskCurrent=exitMask?{...capture(exitMask),clipPath:getComputedStyle(exitField).clipPath}:null;
 generation++;cancel();if(maskCurrent&&exitField)exitField.style.clipPath=maskCurrent.clipPath;setPhase(closing?'closing':'opening');
 // Fill states are installed in this same task, before the hidden boot state is released.
 for(const e of surfaces){e.setAttribute('data-terminal-surface','');e.inert=true;}
 root.removeAttribute('data-terminal-boot');
 if(!panel||!allowed()){finish(closing);return 0;}
 if(closing){
  // Preserve the current view. The outer white field consumes the central aperture.
  const mask=closingMask();
  const ticket=generation,shrink=animate(exitField,[{clipPath:maskCurrent?.clipPath||aperture(1),opacity:1},{clipPath:aperture(0),opacity:1}],SHRINK_MS,0,'cubic-bezier(.4,0,.2,1)');
  shrink.finished.then(()=>{if(ticket===generation&&phase==='closing'){exitField.style.clipPath='inset(0)';shrink.cancel();cancelAnimationFrame(edgeFrame);edgeFrame=0;exitEdges.clear();}}).catch(()=>{});
  const edgeTick=()=>{if(ticket!==generation||phase!=='closing')return;const points=getComputedStyle(exitField).clipPath.match(/[\d.]+(?=%)/g);if(points?.length>10)exitEdges.paint(1-Number(points[10])/50);edgeFrame=requestAnimationFrame(edgeTick);};edgeFrame=requestAnimationFrame(edgeTick);
  if(!panel.hidden){animate(panel,[current.get(panel),current.get(panel)],CLOSE_MS);for(const child of panel.children)animate(child,[current.get(child),current.get(child)],CLOSE_MS);}
  for(const e of [...surfaces,...details])animate(e,[current.get(e),current.get(e)],CLOSE_MS);
  // Keep the frame white while the existing Windows/Android host fades its window.
  finishTimer=setTimeout(()=>finish(true),CLOSE_MS);return CLOSE_MS;
 }
 if(previous==='closed'||previous==='closing'){
  panel.hidden=true;
  if(exitMask)animate(exitMask,[{opacity:maskCurrent.opacity},{opacity:0}],FADE_MS,0,'ease-out');
  for(const e of surfaces)animate(e,[current.get(e),{opacity:1,transform:'none',clipPath:'none'}],FADE_MS);
  for(const e of details)animate(e,[current.get(e),{opacity:1,transform:'none',clipPath:'none'}],FADE_MS);
  finishTimer=setTimeout(()=>finish(false),FADE_MS);return FADE_MS;
 }
 panel.hidden=false;panel.inert=false;panel.dataset.mode='handoff';
 panel.querySelector('[data-boot-status]').textContent='神经已接入';
 const duration=OPEN_MS;
 const core=panel.querySelector('.terminal-core');
 const doodle=panel.querySelector('.terminal-doodle');
  animate(panel,[initial?{opacity:1}:current.get(panel),{opacity:1,offset:.15},{opacity:0}],duration);
  // Keep the completed drawing intact: a small greeting, then the whole scene recedes.
  animate(core,[initial?{opacity:1,transform:'none'}:current.get(core),{opacity:1,transform:'translateY(-4px) scale(.995)',offset:.3},{opacity:0,transform:'translateY(-25px) scale(.96)'}],duration);
  if(doodle)animate(doodle,[current.get(doodle),{transform:'translateY(-9px) rotate(-5deg) scale(1.045)',offset:.3},{transform:'translateY(2px) rotate(2deg) scale(.99)',offset:.52},{transform:'translateY(0) rotate(0deg) scale(1)'}],Math.min(820,duration));
 surfaces.forEach((e,i)=>{
  const start=initial?{opacity:0,transform:'translateY(14px)',clipPath:'inset(0 0 0 0)'}:current.get(e);
  const delay=90+Math.min(i,4)*35;
  animate(e,[start,{opacity:1,transform:'none',clipPath:'inset(0 0 0 0)'}],duration-delay,delay);
 });
 details.forEach(e=>{
  const r=e.getBoundingClientRect(),order=Math.min(1,(r.top/innerHeight*.65+r.left/innerWidth*.35));
  const delay=150+order*220;
  const start=initial?{opacity:0,transform:'translateY(18px)',clipPath:'inset(0 0 12% 0)'}:current.get(e);
  animate(e,[start,{opacity:1,transform:'none',clipPath:'inset(0 0 0 0)'}],duration-delay,delay);
 });
 finishTimer=setTimeout(()=>finish(false),duration);
 return duration;
}
function bounded(promise,ms,message){
 let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error(message)),ms);})]).finally(()=>clearTimeout(timer));
}
function waitForCanvas(canvas,attribute){
 if(canvas.hasAttribute(attribute))return Promise.resolve();
 return new Promise((resolve,reject)=>{
  const done=error=>{clearTimeout(timer);observer.disconnect();error?reject(error):resolve();};
  const observer=new MutationObserver(()=>{if(canvas.dataset.transition==='error')done(Error('模型未能加载，请重试'));else if(canvas.hasAttribute(attribute))done();});
  const timer=setTimeout(()=>done(Error('首屏画面准备超时，请重试')),15000);
  observer.observe(canvas,{attributes:true});
 });
}
async function prepare(){
 if(preparing||phase!=='loading')return;
 const state=boot?.snapshot();
 if(state&&!['config','connection','interface','content'].every(id=>settled(state.steps.find(s=>s.id===id))))return;
 preparing=true;const ticket=generation;boot?.begin('assets');
 try{
  await boot?.doodleReady?.();
  await bounded(document.fonts.ready,10000,'字体加载超时，请重新连接');
  // Only images needed in the first viewport gate entry; offscreen galleries remain lazy.
  const images=[...document.images].filter(onScreen);
  const results=await bounded(Promise.allSettled(images.map(i=>i.decode())),10000,'首屏图片加载超时，请重试或先进入界面');
  if(results.some(r=>r.status==='rejected'))throw Error('部分首屏图片未能加载，可重试或先进入界面');
  boot?.done('assets');
 }catch(error){boot?.fail('assets',error);preparing=false;return;}
 await prepareFrame(ticket);
}
async function prepareFrame(ticket=generation){
 if(phase!=='loading'||ticket!==generation)return;
 boot?.begin('frame');
 try{
  const wave=document.querySelector('#view-vitals.active #ecgCanvas');
  if(wave&&root.hasAttribute('data-vitals-ready'))await waitForCanvas(wave,'data-signal-ready');
  const entity=document.querySelector('#view-entity.active canvas');
  if(entity)await waitForCanvas(entity,'data-first-frame');
  await frame();await frame();
  if(phase!=='loading'||ticket!==generation)return;
  boot?.done('frame');
  // Finish the bounded stroke transition before handing off; no synthetic progress.
  await boot?.visualReady?.(!allowed());await frame();if(phase==='loading'&&ticket===generation)play();
 }catch(error){boot?.fail('frame',error);}
}
function onProgress(state){
 if(phase!=='loading')return;
 if(settled(state.steps.find(s=>s.id==='assets'))&&!preparing){preparing=true;void prepareFrame();return;}
 if(!preparing)void prepare();
}
Object.defineProperty(window,'MatrixTerminal',{value:Object.freeze({
 close:()=>play(true),open:()=>phase==='loading'?0:play(),ready:()=>prepare(),
 setEnabled(value){enabled=Boolean(value);if(!allowed()){bootEdges?.clear();exitEdges?.clear();if(!['loading','closed'].includes(phase))finish(phase==='closing');}}
})});
setPhase('loading');if(session())bootEdges=createEdgeGlitch(session());boot?.onVisual?.(value=>{if(phase==='loading')bootEdges?.paint(value);else bootEdges?.clear();});boot?.subscribe(onProgress);
if(!boot)void prepare();
reduce.addEventListener('change',()=>{if(reduce.matches){bootEdges?.clear();exitEdges?.clear();if(!['loading','closed'].includes(phase))finish(phase==='closing');}});
addEventListener('pagehide',()=>{generation++;cancel();});
addEventListener('pageshow',e=>{if(e.persisted){setPhase('closed');play();}});
// Show the native window as soon as the real connection console has painted.
void (async()=>{await frame();dispatchEvent(new Event('matrix-terminal-present'));})();
