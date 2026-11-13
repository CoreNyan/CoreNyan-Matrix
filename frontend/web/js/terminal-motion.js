// Bounded compositor motion: light ignition, interface settling, phosphor decay.
// Close fits the existing native 500 ms deadline; no native update is required.
const OPEN_MS=980,CLOSE_MS=480;
const reduced=matchMedia('(prefers-reduced-motion: reduce)');
let overlay,timer,animations=[],enabled=true;
function clear(){clearTimeout(timer);animations.forEach(a=>a.cancel());animations=[];overlay?.remove();overlay=null;}
function animate(element,frames,duration,options={}){
 if(element)animations.push(element.animate(frames,{duration,fill:'both',easing:'linear',...options}));
}
function play(closing=false){
 clear();if(reduced.matches||!enabled)return 0;
 const duration=closing?CLOSE_MS:OPEN_MS;
 overlay=document.createElement('div');overlay.className='terminal-shutter';overlay.setAttribute('aria-hidden','true');
 overlay.innerHTML='<div class="terminal-veil"></div><div class="terminal-phosphor"></div><div class="terminal-raster"></div><div class="terminal-beam"></div><div class="terminal-reticle"><i></i><i></i><i></i><i></i></div>';
 document.documentElement.append(overlay);
 if(typeof overlay.showPopover==='function'){overlay.setAttribute('popover','manual');overlay.showPopover();}
 const part=name=>overlay.querySelector('.terminal-'+name);
 animate(part('veil'),closing?[
  {opacity:0},{opacity:.38,offset:.38},{opacity:1}
 ]:[{opacity:1},{opacity:.96,offset:.12},{opacity:.22,offset:.48},{opacity:0}],duration,{easing:'cubic-bezier(.4,0,.2,1)'});
 animate(part('phosphor'),closing?[
  {opacity:0,transform:'scale(1.1,.7)'},{opacity:.35,transform:'scale(.7,.12)',offset:.5},{opacity:0,transform:'scale(.015,.015)'}
 ]:[{opacity:0,transform:'scale(.08,.02)'},{opacity:.45,transform:'scale(.85,.25)',offset:.25},{opacity:.12,transform:'scale(1.25,1)',offset:.6},{opacity:0,transform:'scale(1.4,1.1)'}],duration);
 animate(part('beam'),closing?[
  {opacity:0,transform:'translateY(15vh) scaleX(.9)'},{opacity:.6,transform:'translateY(0) scaleX(.7)',offset:.52},{opacity:.25,transform:'translateY(0) scaleX(.12)',offset:.82},{opacity:0,transform:'translateY(0) scaleX(0)'}
 ]:[{opacity:0,transform:'translateY(0) scaleX(.02)'},{opacity:.7,transform:'translateY(0) scaleX(.8)',offset:.22},{opacity:.22,transform:'translateY(18vh) scaleX(1)',offset:.55},{opacity:0,transform:'translateY(42vh) scaleX(1.1)'}],duration);
 animate(part('raster'),closing?[{opacity:0},{opacity:.22,offset:.35},{opacity:0}]:[{opacity:0},{opacity:.24,offset:.28},{opacity:0}],duration);
 animate(part('reticle'),closing?[
  {opacity:0,transform:'scale(1)'},{opacity:.35,transform:'scale(.99)',offset:.25},{opacity:0,transform:'scale(.94)'}
 ]:[{opacity:0,transform:'scale(.96)'},{opacity:.5,transform:'scale(.99)',offset:.3},{opacity:0,transform:'scale(1)'}],duration);
 // Individual scale/translate leave existing view transitions and layout intact.
 const surfaces=document.querySelectorAll('body > main,body > .editorial-topbar,body > .editorial-footer-ticker');
 surfaces.forEach((surface,index)=>{
  const delay=closing?0:160+Math.min(index,2)*60;
  animate(surface,closing?[
   {opacity:1,scale:'1',translate:'0 0'},{opacity:.45,scale:'.994',translate:'0 2px',offset:.45},{opacity:0,scale:'.98',translate:'0 6px'}
  ]:[{opacity:0,scale:'.985',translate:'0 10px'},{opacity:1,scale:'1',translate:'0 0'}],duration-delay,{delay,easing:closing?'cubic-bezier(.4,0,.2,1)':'cubic-bezier(.22,1,.36,1)'});
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
