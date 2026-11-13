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
   const interval=1000/(typeof fps==='function'?fps():fps);
   // Sleep between frames instead of waking at the monitor's refresh rate.
   handle.timer=setTimeout(()=>{
    if(handle.cancelled)return;
    handle.frame=requestAnimationFrame(now=>{
     if(handle.cancelled)return;
     last=now;callback(now);
    });
   },Math.max(0,interval-(performance.now()-last)));
   return handle;
  },
  cancel(handle){
   if(!handle)return;
   handle.cancelled=true;clearTimeout(handle.timer);cancelAnimationFrame(handle.frame);
  }
 };
}
