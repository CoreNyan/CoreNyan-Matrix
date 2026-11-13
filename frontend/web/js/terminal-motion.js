// Coordinated surface choreography. Native shells wait for the returned duration.
const OPEN_MS=1080,CLOSE_MS=680;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let overlay,timer,animations=[],enabled=true;
function clear(){clearTimeout(timer);animations.forEach(a=>a.cancel());animations=[];overlay?.remove();overlay=null;}
function onScreen(element){const r=element.getBoundingClientRect();return r.width>0&&r.height>0&&r.bottom>0&&r.top<innerHeight;}
function surfaces(){
 const main=document.querySelector('body > main');
 const active=main?.querySelector('.chapter-view.active');
 let panels=[];
 if(active){
  // Use independent cards rather than moving the whole dashboard as one sheet.
  panels=[...active.querySelectorAll('.bento-cell,.chat-sidebar,.chat-main')].filter(onScreen);
  if(!panels.length)panels=[...active.children].filter(onScreen);
 }else if(main){
  // Login: brand, heading and fields arrive independently inside the panel.
  panels=[...main.querySelectorAll(':scope > .brand,:scope > h1,:scope > p:not(:empty),:scope > form > label,:scope > form > button')].filter(onScreen);
 }
 panels=panels.filter(e=>!panels.some(other=>other!==e&&other.contains(e))).slice(0,10);
 return {main,panels,chrome:[...document.querySelectorAll('body > .editorial-topbar,body > .editorial-footer-ticker')].filter(onScreen)};
}
function motion(element,frames,duration,delay=0,easing='cubic-bezier(.22,.8,.22,1)'){
 if(element)animations.push(element.animate(frames,{duration,delay,fill:'both',easing}));
}
function play(closing=false){
 // Preserve the visible frame when a user closes during startup.
 const {main,panels,chrome}=surfaces(),nodes=[main,...panels,...chrome].filter(Boolean);
 const current=new Map(nodes.map(e=>{const s=getComputedStyle(e);return [e,{opacity:s.opacity,translate:s.translate,scale:s.scale,rotate:s.rotate}];}));
 clear();if(reduced.matches||!enabled)return 0;
 const duration=closing?CLOSE_MS:OPEN_MS;
 overlay=document.createElement('div');overlay.className='terminal-shutter';overlay.setAttribute('aria-hidden','true');
 overlay.innerHTML='<div class="terminal-veil"></div>';
 document.documentElement.append(overlay);
 if(typeof overlay.showPopover==='function'){overlay.setAttribute('popover','manual');overlay.showPopover();}
 // Darkness follows the surfaces; it never cuts off their departure.
 motion(overlay.firstElementChild,closing?[{opacity:0},{opacity:0,offset:.58},{opacity:1}]:[{opacity:1},{opacity:0,offset:.24},{opacity:0}],duration,0,'linear');
 if(main)motion(main,closing?[
  {...current.get(main)},{opacity:0,scale:'.976',translate:'0 8px',rotate:'none'}
 ]:[{opacity:0,scale:'.976',translate:'0 8px'},{opacity:1,scale:'1',translate:'0 0'}],closing?duration:840,0,closing?'cubic-bezier(.4,0,.7,1)':'cubic-bezier(.16,1,.3,1)');
 panels.forEach((panel,index)=>{
  const delay=closing?Math.min(panels.length-1-index,5)*34:100+Math.min(index,7)*48;
  motion(panel,closing?[
   {...current.get(panel)},{opacity:0,translate:'0 22px',scale:'.95',rotate:'1 0 0 -3deg'}
  ]:[
   {opacity:0,translate:'0 34px',scale:'.958',rotate:'1 0 0 5deg'},
   {opacity:1,translate:'0 -1px',scale:'1.003',rotate:'1 0 0 -.25deg',offset:.74},
   {opacity:1,translate:'0 0',scale:'1',rotate:'none'}
  ],closing?duration-delay-90:duration-delay,delay,closing?'cubic-bezier(.4,0,.6,1)':'cubic-bezier(.16,1,.3,1)');
 });
 chrome.forEach((element,index)=>motion(element,closing?[
  {...current.get(element)},{opacity:0,translate:'0 -10px'}
 ]:[{opacity:0,translate:'0 -14px'},{opacity:1,translate:'0 0'}],closing?duration-120:680,closing?100:index*60));
 // Native exit can happen while a dialog occupies the browser top layer.
 if(closing)for(const dialog of document.querySelectorAll('dialog[open]'))motion(dialog,[{opacity:1,scale:'1'},{opacity:0,scale:'.96',translate:'0 16px'}],duration-100);
 timer=setTimeout(()=>{if(closing){overlay?.classList.add('is-closed');animations.forEach(a=>a.cancel());animations=[];}else clear();},duration);
 return duration;
}
Object.defineProperty(window,'MatrixTerminal',{value:Object.freeze({close:()=>play(true),open:()=>play(),setEnabled(value){enabled=Boolean(value);if(!enabled)clear();}})});
reduced.addEventListener('change',()=>{if(reduced.matches)clear();});
addEventListener('pagehide',clear);
if(document.documentElement.hasAttribute('data-terms-pending')){
 const ready=new MutationObserver(()=>{if(!document.documentElement.hasAttribute('data-terms-pending')){ready.disconnect();play();}});
 ready.observe(document.documentElement,{attributes:true,attributeFilter:['data-terms-pending']});
 addEventListener('pagehide',()=>ready.disconnect(),{once:true});
}else play();
