// One-shot interface motion; no CRT scanlines or non-uniform screen scaling.
const OPEN_MS=820,CLOSE_MS=460;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let overlay,timer,animations=[],enabled=true;
function clear(){clearTimeout(timer);animations.forEach(a=>a.cancel());animations=[];overlay?.remove();overlay=null;}
function animate(element,frames,duration,options={}){
 if(element)animations.push(element.animate(frames,{duration,fill:'both',easing:'cubic-bezier(.22,1,.36,1)',...options}));
}
function play(closing=false){
 clear();if(reduced.matches||!enabled)return 0;
 const duration=closing?CLOSE_MS:OPEN_MS;
 overlay=document.createElement('div');overlay.className='terminal-shutter';overlay.setAttribute('aria-hidden','true');
 overlay.innerHTML='<div class="terminal-veil"></div>';
 document.documentElement.append(overlay);
 if(typeof overlay.showPopover==='function'){overlay.setAttribute('popover','manual');overlay.showPopover();}
 animate(overlay.firstElementChild,closing?[{opacity:0},{opacity:0,offset:.35},{opacity:1}]:[{opacity:1},{opacity:0,offset:.42},{opacity:0}],duration,{easing:'cubic-bezier(.4,0,.2,1)'});
 // Translate independent layout sections: the header and content settle at
 // different times. Keep body and canvas coordinate systems untransformed.
 const surfaces=[...document.querySelectorAll('body > .editorial-topbar,body > main,body > .editorial-footer-ticker')];
 surfaces.forEach((surface,index)=>{
  const isMain=surface.tagName==='MAIN',delay=closing?0:index*65;
  animate(surface,closing?[
   {opacity:1,translate:'0 0'},{opacity:0,translate:isMain?'0 -28px':'0 -12px'}
  ]:[{opacity:0,translate:isMain?'0 44px':'0 -18px'},{opacity:1,translate:'0 0'}],duration-delay,{delay,easing:closing?'cubic-bezier(.55,0,1,.45)':'cubic-bezier(.16,1,.3,1)'});
  // Restrained overshoot on the content panel gives the arrival some weight.
  if(isMain)animate(surface,closing?[{scale:'1'},{scale:'.965'}]:[{scale:'.94'},{scale:'1.006',offset:.7},{scale:'1'}],duration-delay,{delay});
 });
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
