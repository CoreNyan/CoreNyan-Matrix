import {PRESET_EDITOR} from './constants.js';
// Rows retain their DOM positions during a gesture; transforms handle following and yielding.
export function mountPresetOrder(list,{canStart,commit,cancel,rowSelector='[data-backup]',handleSelector='[data-backup-drag]',key='backup'}){
 const controller=new AbortController(),listen=(target,event,fn,options={})=>target.addEventListener(event,fn,{...options,signal:controller.signal});
 const limit=PRESET_EDITOR.reorder;
 let drag=null,frame=null;
 const rows=()=>[...list.querySelectorAll(rowSelector)];
 const schedule=()=>{if(frame===null&&drag?.phase==='moving')frame=requestAnimationFrame(update);};
 function complete(g,save){
  if(drag!==g)return;drag=null;cancelAnimationFrame(frame);frame=null;g.animation?.cancel();
  if(list.hasPointerCapture(g.id))list.releasePointerCapture(g.id);
  if(save)for(const item of g.order)list.append(item.row);
  for(const item of g.items){item.row.style.transform=item.transform;item.row.style.transition=item.transition;item.row.classList.remove('preset-sort-item','preset-dragging');}
  list.classList.remove('preset-reordering');list.style.removeProperty('--preset-sort-ms');
  if(save){commit(g.order.map(item=>item.key));rows().find(row=>row.dataset[key]===g.item.key)?.querySelector(handleSelector)?.focus({preventScroll:true});}else cancel();
 }
 function paint(g,time,scroll=true){
  const viewport=g.scroll.getBoundingClientRect(),scale=g.scale;
  const elapsed=Math.min(limit.maxFrameMs,Math.max(0,time-g.lastTime));g.lastTime=time;
  const edge=limit.edge*scale;
  const direction=g.y<viewport.top+edge?-Math.min(1,(viewport.top+edge-g.y)/edge):g.y>viewport.bottom-edge?Math.min(1,(g.y-viewport.bottom+edge)/edge):0;
  const previousScroll=g.scroll.scrollTop;
  if(scroll&&direction)g.scroll.scrollTop+=direction*limit.scrollPixelsPerSecond*elapsed/1000;
  const top=list.getBoundingClientRect().top;
  const local=Math.max(g.items[0].start,Math.min(g.height-g.item.height,g.y-g.grab-top));
  const others=g.items.filter(item=>item!==g.item),center=g.y-g.grab-top+g.item.height/2;
  const index=others.filter(item=>center>item.start+item.height/2).length;
  g.order=[...others.slice(0,index),g.item,...others.slice(index)];
  let cursor=g.items[0].start;
  for(const item of g.order){
   const offset=(cursor-item.start)/scale;
   if(item===g.item){g.target=offset;item.row.style.transform='translate3d(0,'+(local-item.start)/scale+'px,0)';}
   else item.row.style.transform='translate3d(0,'+offset+'px,0)';
   cursor+=item.height+g.gap;
  }
  return previousScroll!==g.scroll.scrollTop;
 }
 function update(time){
  frame=null;const g=drag;if(!g||g.phase!=='moving')return;
  if(!g.item.row.isConnected||!canStart()){complete(g,false);return;}
  if(paint(g,time))schedule();
 }
 function finish(save){
  const g=drag;if(!g)return;
  if(!save){complete(g,false);return;}if(g.phase!=='moving')return;
  if(!g.item.row.isConnected||!canStart()){complete(g,false);return;}
  paint(g,performance.now(),false);g.phase='settling';cancelAnimationFrame(frame);frame=null;
  const target='translate3d(0,'+g.target+'px,0)',from=g.item.row.style.transform;
  g.item.row.style.transform=target;
  if(g.reduced||from===target){complete(g,true);return;}
  g.animation=g.item.row.animate([{transform:from},{transform:target}],{duration:limit.settleMs,easing:limit.easing});
  g.animation.finished.then(()=>{if(drag===g)complete(g,g.item.row.isConnected&&canStart());}).catch(()=>{});
 }
 listen(list,'pointerdown',e=>{
  const handle=e.target.closest(handleSelector);if(drag||!handle||e.button!==0||!canStart())return;
  const elements=rows();if(elements.length<2)return;
  e.preventDefault();const bounds=list.getBoundingClientRect(),rectangles=elements.map(row=>row.getBoundingClientRect());
  const items=elements.map((row,i)=>({row,key:row.dataset[key],start:rectangles[i].top-bounds.top,height:rectangles[i].height,transform:row.style.transform,transition:row.style.transition}));
  const item=items.find(item=>item.row===handle.closest(rowSelector));if(!item)return;
  const reduced=matchMedia('(prefers-reduced-motion: reduce)').matches||document.body.classList.contains('motion-off');
  drag={id:e.pointerId,item,items,order:items,phase:'moving',y:e.clientY,grab:e.clientY-(bounds.top+item.start),scale:bounds.width/list.offsetWidth,height:bounds.height,gap:Math.max(0,items[1].start-items[0].start-items[0].height),scroll:list.closest('.preset-route,[data-form-panel]')||list,lastTime:performance.now(),reduced};
  list.style.setProperty('--preset-sort-ms',(reduced?0:limit.yieldMs)+'ms');
  for(const entry of items){entry.row.classList.add('preset-sort-item');entry.row.style.transition=entry===item?'none':'transform var(--preset-sort-ms) '+limit.easing;}
  item.row.classList.add('preset-dragging');list.classList.add('preset-reordering');list.setPointerCapture(e.pointerId);schedule();
 });
 listen(list,'pointermove',e=>{if(drag?.id===e.pointerId&&drag.phase==='moving'){drag.y=e.clientY;e.preventDefault();schedule();}});
 listen(list,'pointerup',e=>{if(drag?.id===e.pointerId){drag.y=e.clientY;finish(true);}});
 listen(list,'pointercancel',()=>finish(false));listen(list,'lostpointercapture',()=>{if(drag?.phase==='moving')finish(false);});
 listen(window,'blur',()=>finish(false));listen(window,'resize',()=>finish(false));
 listen(document,'keydown',e=>{if(drag&&e.key==='Escape'){e.preventDefault();e.stopPropagation();finish(false);}},{capture:true});
 return {get active(){return Boolean(drag);},cancel:()=>finish(false),destroy:()=>{finish(false);controller.abort();}};
}
