// One lifecycle owns first paint, data readiness and native exit. No opaque shutter.
const OPEN_MS=820,CLOSE_MS=620,READY_LIMIT_MS=2200;
const root=document.documentElement,reduced=matchMedia('(prefers-reduced-motion: reduce)');
let phase='loading',enabled=true,animations=[],completion,readyTimer,loader,preparing=false,timedOut=false;
const allowed=()=>enabled&&!reduced.matches;
const setPhase=value=>{phase=value;root.dataset.terminalPhase=value;};
const frame=()=>new Promise(resolve=>requestAnimationFrame(resolve));
function cancel(){clearTimeout(completion);animations.forEach(a=>a.cancel());animations=[];}
function onScreen(e){const r=e.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight;}
function surfaces(){
 const main=document.querySelector('body > main'),active=main?.querySelector('.chapter-view.active');
 let panels=active?[...active.querySelectorAll('.bento-cell,.chat-sidebar,.chat-main')]:[...main?.querySelectorAll(':scope > .brand,:scope > h1,:scope > p:not(:empty),:scope > form > label,:scope > form > button')||[]];
 if(active&&!panels.length)panels=[...active.children];
 panels=panels.filter(onScreen).filter(e=>!panels.some(other=>other!==e&&other.contains(e))).slice(0,10);
 return {main,panels,chrome:[...document.querySelectorAll('body > .editorial-topbar,body > .telemetry-overline-strip,body > .editorial-footer-ticker')].filter(onScreen)};
}
function motion(element,frames,duration,delay=0,easing='cubic-bezier(.22,.75,.25,1)'){
 if(element)animations.push(element.animate(frames,{duration,delay,fill:'both',easing}));
}
function removeLoader(){loader?.remove();loader=null;}
function finish(closing){
 // Commit the same terminal opacity BEFORE cancelling the animation's fill.
 setPhase(closing?'closed':'open');root.removeAttribute('data-terminal-boot');
 cancel();removeLoader();
 dispatchEvent(new CustomEvent('matrix-terminal-settled',{detail:{closing}}));
}
function play(closing=false){
 if(closing&&(phase==='closing'||phase==='closed'))return phase==='closing'?CLOSE_MS:0;
 if(!closing&&(phase==='opening'||phase==='open'))return 0;
 clearTimeout(readyTimer);
 const previous=phase,{main,panels,chrome}=surfaces();
 const dialogs=[...document.querySelectorAll('dialog[open],body > .modal-backdrop:not(.is-hidden),body > .lightbox-backdrop:not(.is-hidden)')];
 const nodes=[main,...panels,...chrome,...dialogs,loader].filter(Boolean);
 const current=new Map(nodes.map(e=>{const s=getComputedStyle(e);return[e,{opacity:s.opacity,translate:s.translate,scale:s.scale}];}));
 cancel();setPhase(closing?'closing':'opening');root.removeAttribute('data-terminal-boot');
 if(!closing)dispatchEvent(new Event('matrix-terminal-present'));
 if(!allowed()){finish(closing);return 0;}
 const duration=closing?CLOSE_MS:OPEN_MS;
 const fresh=previous==='loading';
 const from=(e,start)=>fresh&&!closing?start:current.get(e);
 motion(main,[from(main,{opacity:0,translate:'0 12px',scale:'.992'}),{opacity:closing?0:1,translate:closing?'0 10px':'0 0',scale:closing?'.992':'1'}],duration);
 panels.forEach((panel,index)=>{
  const delay=closing?Math.min(panels.length-1-index,5)*20:Math.min(index,6)*35;
  motion(panel,[from(panel,{opacity:0,translate:'0 16px',scale:'1'}),{opacity:closing?0:1,translate:closing?'0 8px':'0 0',scale:'1'}],duration-delay,delay);
 });
 chrome.forEach(e=>motion(e,[from(e,{opacity:0,translate:'0 5px',scale:'1'}),{opacity:closing?0:1,translate:'0 0',scale:'1'}],duration));
 if(loader)motion(loader,[current.get(loader),{opacity:0,translate:'0 -6px',scale:'1'}],Math.min(300,duration));
 dialogs.forEach(e=>motion(e,[current.get(e),{opacity:closing?0:1,translate:closing?'0 10px':'0 0',scale:closing?'.99':'1'}],duration));
 completion=setTimeout(()=>finish(closing),duration);
 return duration;
}
async function ready(){
 if(preparing||phase!=='loading'||root.hasAttribute('data-terms-pending'))return;preparing=true;
 // Decode visible portraits and settle fonts/layout, with a bounded wait.
 const images=[...document.images].filter(onScreen);
 let deadline;
 await Promise.race([Promise.allSettled([document.fonts?.ready,...images.map(i=>i.decode?.())]),new Promise(r=>{deadline=setTimeout(r,500);})]);
 clearTimeout(deadline);await frame();await frame();
 if(phase==='loading')play();
}
Object.defineProperty(window,'MatrixTerminal',{value:Object.freeze({close:()=>play(true),open:()=>play(),ready,setEnabled(value){enabled=Boolean(value);if(!allowed()&&phase!=='loading')finish(phase==='closing'||phase==='closed');}})});
reduced.addEventListener('change',()=>{if(reduced.matches&&phase!=='loading')finish(phase==='closing'||phase==='closed');});
addEventListener('matrix-app-ready',ready);
const termsObserver=new MutationObserver(()=>{if(!root.hasAttribute('data-terms-pending')){termsObserver.disconnect();if(timedOut||root.hasAttribute('data-app-ready'))ready();}});
if(root.hasAttribute('data-terms-pending'))termsObserver.observe(root,{attributes:true,attributeFilter:['data-terms-pending']});
addEventListener('pagehide',()=>{clearTimeout(readyTimer);termsObserver.disconnect();cancel();removeLoader();});
addEventListener('pageshow',event=>{if(event.persisted){setPhase('closed');play();}});
setPhase('loading');
loader=document.createElement('div');loader.className='terminal-loading';loader.setAttribute('role','status');loader.textContent='正在连接小可';document.body.append(loader);
// Slow/offline requests must not imprison navigation behind a loading screen.
readyTimer=setTimeout(()=>{timedOut=true;ready();},READY_LIMIT_MS);
if(!root.hasAttribute('data-terminal-app')||root.hasAttribute('data-app-ready'))ready();
