import {UI_MOTION} from './constants.js';
const states=new WeakMap(),running=new Set();
let enabled=true;
const reduce=matchMedia('(prefers-reduced-motion: reduce)');
const allowed=()=>enabled&&!reduce.matches;
export function setMotionEnabled(value){enabled=Boolean(value);document.documentElement.classList.toggle('motion-disabled',!enabled);window.MatrixTerminal?.setEnabled(enabled);if(!allowed())for(const state of [...running])state.finish?.();}
reduce.addEventListener('change',()=>setMotionEnabled(enabled));
function stateOf(element){let state=states.get(element);if(!state){state={desired:null,version:0,animations:[],finish:null};states.set(element,state);}return state;}
function transition(element,target,visible,commit,kind='dialog'){
 const state=stateOf(element);
 if(state.desired===visible)return state.promise||Promise.resolve(true);
 const previous=state.desired;
 const style=previous!==null&&!element.classList.contains('is-hidden')?getComputedStyle(target):null;
 const from=style?{opacity:style.opacity,transform:style.transform}:null;
 state.version++;const version=state.version;state.desired=visible;
 state.resolve?.(false);state.animations.forEach(a=>a.cancel());state.animations=[];
 running.delete(state);state.finish=null;
 element.style.setProperty('--motion-enter',UI_MOTION[kind].openMs+'ms');element.style.setProperty('--motion-exit',UI_MOTION[kind].closeMs+'ms');
 element.inert=!visible;element.dataset.motionPhase=visible?'opening':'closing';element.classList.add('motion-surface');
 state.promise=new Promise(resolve=>{state.resolve=resolve;});
 const finish=()=>{
  if(state.version!==version||state.finish!==finish)return;
  state.animations.forEach(a=>a.cancel());state.animations=[];running.delete(state);state.finish=null;
  element.dataset.motionPhase=visible?'open':'closed';element.inert=!visible;commit();
  state.resolve(true);state.resolve=null;
 };
 state.finish=finish;
 if(!allowed()){finish();return state.promise;}
 const frames=visible?[from&&previous===false?from:UI_MOTION[kind].enter,{opacity:1,transform:'translate3d(0,-3px,0) scale(1.012)',offset:.74},{opacity:1,transform:'none'}]:[from||{opacity:1,transform:'none'},UI_MOTION[kind].exit];
 const animation=target.animate(frames,{duration:visible?UI_MOTION[kind].openMs:UI_MOTION[kind].closeMs,easing:visible?UI_MOTION.enterEase:UI_MOTION.exitEase,fill:'both'});
 state.animations.push(animation);running.add(state);
 if(element!==target)state.animations.push(element.animate(visible?[{opacity:0},{opacity:1}]:[{opacity:1},{opacity:0}],{duration:visible?UI_MOTION[kind].openMs:UI_MOTION[kind].closeMs,fill:'both'}));
 animation.finished.then(finish,()=>{if(state.version===version)finish();});
 return state.promise;
}
const registered=new WeakSet();
export function showDialog(dialog){
 if(!registered.has(dialog)){
  registered.add(dialog);
  dialog.addEventListener('cancel',event=>{if(event.target!==dialog)return;if(event.defaultPrevented)return;event.preventDefault();closeDialog(dialog);});
 }
 const state=stateOf(dialog);
 if(dialog.open&&state.desired===true)return state.promise||Promise.resolve(true);
 dialog.inert=false;if(!dialog.open)dialog.showModal();
 return transition(dialog,dialog,true,()=>{});
}
export function closeDialog(dialog,value){
 if(!dialog?.open)return Promise.resolve(true);
 return transition(dialog,dialog,false,()=>{dialog.inert=false;dialog.close(value);});
}
export function setOverlayVisible(element,visible,kind='dialog'){
 const state=stateOf(element);
 if(state.desired===null&&!visible){state.desired=false;element.classList.add('is-hidden');element.inert=true;return Promise.resolve(true);}
 if(visible){element.classList.remove('is-hidden');element.inert=false;}
 const target=element.querySelector('.modal-card,.lightbox-frame')||element;
 return transition(element,target,visible,()=>{element.classList.toggle('is-hidden',!visible);},kind);
}
export function reveal(element){
 if(!allowed()||!element)return;
 const animation=element.animate(UI_MOTION.panel.frames,{duration:UI_MOTION.panel.duration,easing:UI_MOTION.enterEase});
 const state={finish(){animation.cancel();running.delete(state);}};running.add(state);
 animation.finished.then(()=>running.delete(state),()=>running.delete(state));
}
export function dismissToast(element){return transition(element,element,false,()=>element.remove(),'menu');}

export function setPanelVisible(element,visible){
 const state=stateOf(element);
 if(state.desired===null&&!visible){state.desired=false;element.hidden=true;return Promise.resolve(true);}
 if(visible)element.hidden=false;
 return transition(element,element,visible,()=>{element.hidden=!visible;},'menu');
}
