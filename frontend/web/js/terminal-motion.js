// Terminal power sequence transforms the actual interface, then restores layout.
const OPEN_MS=1120,CLOSE_MS=720;
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
 animate(part('veil'),closing?[{opacity:0},{opacity:0,offset:.74},{opacity:1}]:[{opacity:1},{opacity:0,offset:.18},{opacity:0}],duration);
 animate(part('phosphor'),closing?[{opacity:0},{opacity:.7,offset:.72},{opacity:0}]:[{opacity:0},{opacity:.6,offset:.24},{opacity:0,offset:.76},{opacity:0}],duration);
 animate(part('beam'),closing?[
  {opacity:0,transform:'scaleX(.92)'},{opacity:0,transform:'scaleX(.92)',offset:.5},{opacity:1,transform:'scaleX(.92)',offset:.74},{opacity:.8,transform:'scaleX(.04)',offset:.92},{opacity:0,transform:'scaleX(0)'}
 ]:[{opacity:0,transform:'scaleX(.01)'},{opacity:1,transform:'scaleX(.92)',offset:.24},{opacity:0,transform:'scaleX(.92)',offset:.68},{opacity:0}],duration);
 animate(part('raster'),closing?[{opacity:0},{opacity:.6,offset:.4},{opacity:0}]:[{opacity:.6},{opacity:.4,offset:.65},{opacity:0}],duration);
 const shape=closing?[
  {transform:'scale(1,1)',opacity:0},{transform:'scale(.97,.94)',opacity:.65,offset:.24},{transform:'scale(.94,.006)',opacity:.8,offset:.74},{transform:'scale(.02,.002)',opacity:0}
 ]:[{transform:'scale(.02,.002)',opacity:0},{transform:'scale(.94,.006)',opacity:.8,offset:.24},{transform:'scale(.97,.94)',opacity:.5,offset:.72},{transform:'scale(1,1)',opacity:0}];
 animate(part('reticle'),shape,duration,{easing:'cubic-bezier(.4,0,.2,1)'});
 // A viewport-centered origin also works when closing a scrolled document.
 const body=document.body,box=body.getBoundingClientRect(),zoom=box.width/body.offsetWidth||1;
 const origin=((innerWidth/2-box.left)/zoom)+'px '+((innerHeight/2-box.top)/zoom)+'px';
 animate(body,closing?[
  {scale:'1 1',opacity:1,transformOrigin:origin},{scale:'.97 .94',opacity:1,transformOrigin:origin,offset:.24},{scale:'.94 .006',opacity:.7,transformOrigin:origin,offset:.74},{scale:'.02 .002',opacity:0,transformOrigin:origin}
 ]:[{scale:'.02 .002',opacity:0,transformOrigin:origin},{scale:'.94 .006',opacity:.7,transformOrigin:origin,offset:.24},{scale:'.97 .94',opacity:1,transformOrigin:origin,offset:.72},{scale:'1 1',opacity:1,transformOrigin:origin}],duration,{easing:'cubic-bezier(.4,0,.2,1)'});
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
