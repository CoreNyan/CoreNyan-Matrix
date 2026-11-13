// One-shot shutter motion. No framebuffer copies or perpetual full-screen loop.
const OPEN_MS=560,CLOSE_MS=340;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let overlay,timer,animations=[],enabled=true;
function clear(){clearTimeout(timer);animations.forEach(a=>a.cancel());animations=[];overlay?.remove();overlay=null;}
function play(closing=false){
 clear();if(reduced.matches||!enabled)return 0;
 const duration=closing?CLOSE_MS:OPEN_MS;
 overlay=document.createElement('div');overlay.className='terminal-shutter';overlay.setAttribute('aria-hidden','true');
 overlay.innerHTML='<i class="terminal-shutter-top"></i><i class="terminal-shutter-bottom"></i><b class="terminal-scanline"></b>';
 document.documentElement.append(overlay);
 if(typeof overlay.showPopover==='function'){overlay.setAttribute('popover','manual');overlay.showPopover();}
 for(const element of overlay.querySelectorAll('i'))animations.push(element.animate(closing?[
  {transform:'scaleY(0)'},{transform:'scaleY(1)',offset:.72},{transform:'scaleY(1)'}
 ]:[{transform:'scaleY(1)'},{transform:'scaleY(1)',offset:.18},{transform:'scaleY(0)'}],{duration,easing:'cubic-bezier(.76,0,.24,1)',fill:'both'}));
 animations.push(overlay.querySelector('b').animate(closing?[
  {transform:'scaleX(1)',opacity:0},{transform:'scaleX(1)',opacity:.65,offset:.72},{transform:'scaleX(0)',opacity:0}
 ]:[{transform:'scaleX(0)',opacity:0},{transform:'scaleX(1)',opacity:.65,offset:.18},{transform:'scaleX(1)',opacity:0,offset:.45},{opacity:0}],{duration,fill:'both'}));
 timer=setTimeout(()=>{if(closing){animations.forEach(a=>a.cancel());animations=[];overlay?.classList.add('is-closed');}else clear();},duration);
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
