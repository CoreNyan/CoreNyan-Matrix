// A terminal session: real startup work -> shared handoff -> a reversible shutdown.
const OPEN_MS=1180,CLOSE_MS=980,root=document.documentElement;
const reduce=matchMedia('(prefers-reduced-motion: reduce)'),boot=window.MatrixBoot;
let phase='loading',enabled=true,animations=[],finishTimer,generation=0,preparing=false;
const session=()=>document.querySelector('.terminal-session');
const setPhase=value=>{phase=value;root.dataset.terminalPhase=value;};
const allowed=()=>enabled&&!reduce.matches;
const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
const settled=step=>step&&['done','skipped'].includes(step.status);
const onScreen=e=>{const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight;};
function cancel(){clearTimeout(finishTimer);for(const a of animations)a.cancel();animations=[];}
function animate(e,frames,duration,delay=0,easing='cubic-bezier(.22,.75,.22,1)'){
 if(e)animations.push(e.animate(frames,{duration,delay,fill:'both',easing}));
}
function capture(e){const s=getComputedStyle(e);return{opacity:s.opacity,transform:s.transform,clipPath:s.clipPath};}
function collect(){
 const surfaces=[...document.body.children].filter(e=>e!==session()&&!['SCRIPT','STYLE','LINK'].includes(e.tagName)&&onScreen(e));
 const view=document.querySelector('.chapter-view.active')||document.querySelector('body>main');
 const candidates=view?[...view.querySelectorAll('.cell-topline,.identity-heading-row,.hero-manifesto,.subconscious-diary-box,.hero-bottom-bar,.signal-loom-stage,.loom-cognitive-matrix,.loom-footer-bar,.health-dials,.ledger-block,.chat-header,.chat-sidebar>header,.chat-sidebar>label,.chat-sidebar>nav,.chat-messages,.chat-bottom,.entity-flight,.entity-stage,:scope>.brand,:scope>h1,:scope>form')].filter(onScreen):[];
 const details=candidates.filter(e=>!candidates.some(other=>other!==e&&other.contains(e))).slice(0,24);
 return {surfaces,details};
}
function finish(closing){
 setPhase(closing?'closed':'open');root.removeAttribute('data-terminal-boot');
 for(const e of document.querySelectorAll('[data-terminal-surface]')){e.inert=closing;if(!closing)e.removeAttribute('data-terminal-surface');}
 cancel();
 const panel=session();if(panel){panel.hidden=!closing;panel.inert=!closing;panel.dataset.mode=closing?'closing':'idle';}
 dispatchEvent(new CustomEvent('matrix-terminal-settled',{detail:{closing}}));
}
function play(closing=false){
 if(closing&&['closing','closed'].includes(phase))return phase==='closing'?CLOSE_MS:0;
 if(!closing&&['opening','open'].includes(phase))return 0;
 const previous=phase,initial=phase==='loading',panel=session(),{surfaces,details}=collect();
 const nodes=[...surfaces,...details,...(panel?[panel,...panel.children,panel.querySelector('.terminal-doodle')].filter(Boolean):[])];
 const current=new Map(nodes.map(e=>[e,capture(e)]));
 generation++;cancel();setPhase(closing?'closing':'opening');
 // Fill states are installed in this same task, before the hidden boot state is released.
 for(const e of surfaces){e.setAttribute('data-terminal-surface','');e.inert=true;}
 root.removeAttribute('data-terminal-boot');
 if(!panel||!allowed()){finish(closing);return 0;}
 panel.hidden=false;panel.inert=false;panel.dataset.mode=closing?'closing':'handoff';panel.dataset.interrupted=String(closing&&(previous==='loading'||previous==='opening'));
 panel.querySelector('[data-boot-heading]').textContent=closing?'CLOSING':'CONNECTED';
 panel.querySelector('[data-boot-title]').textContent=closing?'终端休眠':'接入神经';
 panel.querySelector('[data-boot-status]').textContent=closing?'正在关闭本地界面':'连接完成，欢迎回来';
 panel.querySelector('[data-boot-footer]').textContent=closing?'云端任务继续运行':'服务已连接';
 const duration=closing?CLOSE_MS:OPEN_MS;
 const core=panel.querySelector('.terminal-core'),rail=panel.querySelector('.terminal-rail'),foot=panel.querySelector('.terminal-foot'),coordinate=panel.querySelector('.terminal-coordinate'),scan=panel.querySelector('.terminal-scan');
 const doodle=panel.querySelector('.terminal-doodle');
 if(closing){
  const interrupted=previous==='loading'||previous==='opening';
  animate(panel,[interrupted?current.get(panel):{opacity:0},{opacity:1,offset:.68},{opacity:1}],duration);
  animate(core,[interrupted?current.get(core):{opacity:0,transform:'translateY(12px)'},{opacity:1,transform:'translateY(0)',clipPath:'inset(0 0 0 0)',offset:.44},{opacity:0,transform:'translateY(-8px)',clipPath:'inset(0 0 0 0)'}],duration);
  animate(rail,[interrupted?current.get(rail):{opacity:0,transform:'scaleY(1)'},{opacity:.7,transform:'scaleY(1)',offset:.3},{opacity:0,transform:'scaleY(0)'}],duration);
  animate(foot,[interrupted?current.get(foot):{opacity:0},{opacity:.7,offset:.4},{opacity:0}],duration);
  animate(coordinate,[interrupted?current.get(coordinate):{opacity:0},{opacity:.6,offset:.4},{opacity:0}],duration);
  if(doodle)animate(doodle,[current.get(doodle),{transform:'translateY(3px) rotate(7deg) scale(.97)',offset:.5},{transform:'translateY(12px) rotate(10deg) scale(.92)'}],duration);
 }else{
  animate(panel,[initial?{opacity:1}:current.get(panel),{opacity:1,offset:.15},{opacity:0}],duration);
  // Keep the completed drawing intact: a small greeting, then the whole scene recedes.
  animate(core,[initial?{opacity:1,transform:'none'}:current.get(core),{opacity:1,transform:'translateY(-4px) scale(.995)',offset:.3},{opacity:0,transform:'translateY(-25px) scale(.96)'}],duration);
  if(doodle)animate(doodle,[current.get(doodle),{transform:'translateY(-9px) rotate(-5deg) scale(1.045)',offset:.3},{transform:'translateY(2px) rotate(2deg) scale(.99)',offset:.52},{transform:'translateY(0) rotate(0deg) scale(1)'}],Math.min(820,duration));
  animate(rail,[{opacity:1,transform:'scaleY(1)'},{opacity:0,transform:'scaleY(1) translateX(-12px)'}],duration);
  animate(foot,[{opacity:.8},{opacity:0}],560);
  animate(coordinate,[{opacity:.8},{opacity:0}],560);
  animate(scan,[{opacity:0,transform:'translateX(-2vw)'},{opacity:.22,offset:.23},{opacity:0,transform:'translateX(102vw)'}],duration);
 }
 surfaces.forEach((e,i)=>{
  const start=initial&&!closing?{opacity:0,transform:'translateY(14px)',clipPath:'inset(0 0 0 0)'}:current.get(e);
  const delay=closing?0:90+Math.min(i,4)*35;
  animate(e,[start,{opacity:closing?0:1,transform:closing?'translateY(-10px)':'none',clipPath:'inset(0 0 0 0)'}],closing?600:duration-delay,delay);
 });
 details.forEach(e=>{
  const r=e.getBoundingClientRect(),order=Math.min(1,(r.top/innerHeight*.65+r.left/innerWidth*.35));
  const delay=closing?(1-order)*110:150+order*220;
  const start=initial&&!closing?{opacity:0,transform:'translateY(18px)',clipPath:'inset(0 0 12% 0)'}:current.get(e);
  animate(e,[start,{opacity:closing?0:1,transform:closing?'translateY(-10px)':'none',clipPath:'inset(0 0 0 0)'}],closing?470:duration-delay,delay);
 });
 finishTimer=setTimeout(()=>finish(closing),duration);
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
  // Allow the real 100% state to paint; no artificial minimum loading duration.
  await frame();if(phase==='loading'&&ticket===generation)play();
 }catch(error){boot?.fail('frame',error);}
}
function onProgress(state){
 if(phase!=='loading')return;
 if(settled(state.steps.find(s=>s.id==='assets'))&&!preparing){preparing=true;void prepareFrame();return;}
 if(!preparing)void prepare();
}
Object.defineProperty(window,'MatrixTerminal',{value:Object.freeze({
 close:()=>play(true),open:()=>phase==='loading'?0:play(),ready:()=>prepare(),
 setEnabled(value){enabled=Boolean(value);if(!allowed()&&!['loading','closed'].includes(phase))finish(phase==='closing');}
})});
setPhase('loading');boot?.subscribe(onProgress);
if(!boot)void prepare();
reduce.addEventListener('change',()=>{if(reduce.matches&&!['loading','closed'].includes(phase))finish(phase==='closing');});
addEventListener('pagehide',()=>{generation++;cancel();});
addEventListener('pageshow',e=>{if(e.persisted){setPhase('closed');play();}});
// Show the native window as soon as the real connection console has painted.
void (async()=>{await frame();dispatchEvent(new Event('matrix-terminal-present'));})();
