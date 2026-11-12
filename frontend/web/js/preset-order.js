import {PRESET_EDITOR} from './constants.js';
// Pointer capture stays on the list while rows move, including touch drags.
export function mountPresetOrder(list,{canStart,commit,cancel}){
 let drag=null,frame;
 const rows=()=>[...list.querySelectorAll('[data-backup]')];
 function finish(save){if(!drag)return;const g=drag;drag=null;cancelAnimationFrame(frame);g.row.classList.remove('preset-dragging');list.classList.remove('preset-reordering');if(list.hasPointerCapture(g.id))list.releasePointerCapture(g.id);if(save)commit(rows().map(r=>r.dataset.backup));else cancel();}
 function update(){
  if(!drag)return;const g=drag;if(!g.row.isConnected||!canStart()){finish(false);return;}
  const viewport=g.scroll.getBoundingClientRect(),limit=PRESET_EDITOR.reorder;
  if(g.y<viewport.top+limit.edge)g.scroll.scrollTop-=limit.scrollStep;else if(g.y>viewport.bottom-limit.edge)g.scroll.scrollTop+=limit.scrollStep;
  const before=rows().filter(r=>r!==g.row).find(r=>{const b=r.getBoundingClientRect();return g.y<b.top+b.height/2;});
  if(g.row.nextElementSibling!==before&&(before||g.row!==list.lastElementChild))list.insertBefore(g.row,before||null);
  frame=requestAnimationFrame(update);
 }
 list.addEventListener('pointerdown',e=>{const handle=e.target.closest('[data-backup-drag]');if(!handle||e.button!==0||!canStart()||rows().length<2)return;e.preventDefault();finish(false);const row=handle.closest('[data-backup]');drag={id:e.pointerId,row,y:e.clientY,scroll:list.closest('.preset-route')||list};row.classList.add('preset-dragging');list.classList.add('preset-reordering');list.setPointerCapture(e.pointerId);frame=requestAnimationFrame(update);});
 list.addEventListener('pointermove',e=>{if(drag?.id===e.pointerId){drag.y=e.clientY;e.preventDefault();}});
 list.addEventListener('pointerup',e=>{if(drag?.id===e.pointerId)finish(true);});
 list.addEventListener('pointercancel',()=>finish(false));list.addEventListener('lostpointercapture',()=>finish(false));
 window.addEventListener('blur',()=>finish(false));document.addEventListener('keydown',e=>{if(drag&&e.key==='Escape'){e.preventDefault();e.stopPropagation();finish(false);}},true);
 return {cancel:()=>finish(false)};
}
