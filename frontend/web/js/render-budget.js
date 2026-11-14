// Decorative animation never competes with the app the user is working in.
export const visualActive=()=>!document.hidden&&document.hasFocus();
export function observeVisualActivity(wake){
 const update=()=>{document.documentElement.classList.toggle('visuals-paused',!visualActive());wake();};
 window.addEventListener('focus',update);window.addEventListener('blur',update);document.addEventListener('visibilitychange',update);update();
 return ()=>{window.removeEventListener('focus',update);window.removeEventListener('blur',update);document.removeEventListener('visibilitychange',update);};
}
export function createFrameBudget(fps){
 let last=-Infinity;
 return {
  request(callback){
   const handle={timer:0,frame:0,cancelled:false};
   const tick=now=>{
    if(handle.cancelled)return;
    const limit=typeof fps==='function'?fps():fps,interval=limit?1000/limit:0,elapsed=now-last;
    if(!interval||elapsed>=interval-.25){last=Number.isFinite(elapsed)&&interval?last+interval*Math.max(1,Math.floor((elapsed+.25)/interval)):now;callback(now);}
    else handle.frame=requestAnimationFrame(tick);
   };
   handle.frame=requestAnimationFrame(tick);
   return handle;
  },
  cancel(handle){
   if(!handle)return;
   handle.cancelled=true;clearTimeout(handle.timer);cancelAnimationFrame(handle.frame);
  }
 };
}
