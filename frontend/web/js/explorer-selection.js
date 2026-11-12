import {EXPLORER_SELECTION as C} from './constants.js';
export function mountExplorerSelection({list,getSelection,setSelection,select,open,closeMenu}){
 let gesture=null,suppressClick=false,timer,frame;
 const rows=()=>[...list.querySelectorAll(C.row)].filter(e=>e.getClientRects().length);
 const target=row=>({relPath:row.dataset.relPath,isDir:row.dataset.isDir==='1',name:row.dataset.name});
 const rowAt=e=>e.target.closest(C.row);
 const clear=()=>{clearTimeout(timer);cancelAnimationFrame(frame);gesture?.box?.remove();list.classList.remove('file-selecting');gesture=null;};
 function update(){
  const g=gesture;if(!g?.mode)return;
  const rect=list.getBoundingClientRect();
  if(g.y<rect.top+C.edge)list.scrollTop-=C.scrollStep;else if(g.y>rect.bottom-C.edge)list.scrollTop+=C.scrollStep;
  const selected=new Set(g.base);
  if(g.mode==='sweep'){
   for(const r of rows()){const b=r.getBoundingClientRect();if(g.x>=b.left&&g.x<=b.right&&g.y>=b.top&&g.y<=b.bottom)g.visited.add(r.dataset.relPath);}
   for(const id of g.visited)selected.add(id);
  }else{
   const startY=g.startY-(list.scrollTop-g.scroll),left=Math.min(g.startX,g.x),top=Math.min(startY,g.y),right=Math.max(g.startX,g.x),bottom=Math.max(startY,g.y);
   // Overlay is fixed in viewport coordinates; CSS zoom is compensated at its host.
   Object.assign(g.box.style,{left:left+'px',top:top+'px',width:(right-left)+'px',height:(bottom-top)+'px'});
   for(const r of rows()){const b=r.getBoundingClientRect();if(b.right>left&&b.left<right&&b.bottom>top&&b.top<bottom)selected.add(r.dataset.relPath);}
  }
  const current=getSelection();if(current.size!==selected.size||[...selected].some(id=>!current.has(id)))setSelection(selected);frame=requestAnimationFrame(update);
 }
 list.addEventListener('pointerdown',e=>{
  if(e.button!==0||e.pointerType!=='mouse')return;clear();closeMenu();suppressClick=false;
  if(e.target.closest('button,input,a'))return;
  const row=rowAt(e);gesture={id:e.pointerId,row,startX:e.clientX,startY:e.clientY,x:e.clientX,y:e.clientY,scroll:list.scrollTop,base:new Set(e.ctrlKey||e.metaKey||row?getSelection():[]),visited:new Set(),mode:null};
  if(row)timer=setTimeout(()=>{if(!gesture)return;gesture.mode='sweep';gesture.visited.add(row.dataset.relPath);list.classList.add('file-selecting');suppressClick=true;update();},C.holdMs);
 });
 document.addEventListener('pointermove',e=>{
  const g=gesture;if(!g||g.id!==e.pointerId)return;g.x=e.clientX;g.y=e.clientY;
  if(!g.mode&&Math.hypot(g.x-g.startX,g.y-g.startY)>=C.dragThreshold){
   clearTimeout(timer);if(g.row)return;
   g.mode='box';g.box=document.createElement('div');g.box.className='file-selection-box';g.box.style.zoom=String(1/(Number(getComputedStyle(document.documentElement).zoom)||1));document.body.append(g.box);list.classList.add('file-selecting');suppressClick=true;update();
  }
  if(g.mode)e.preventDefault();
 });
 list.addEventListener('dragstart',e=>{if(gesture?.mode){e.preventDefault();e.stopImmediatePropagation();}else clear();},true);
 document.addEventListener('pointerup',()=>{clear();if(suppressClick)setTimeout(()=>suppressClick=false,0);});
 document.addEventListener('pointercancel',clear);window.addEventListener('blur',clear);
 list.addEventListener('click',e=>{
  closeMenu();if(suppressClick){e.preventDefault();e.stopImmediatePropagation();return;}
  const row=rowAt(e);if(!row){if(!e.target.closest('button,input,a'))setSelection(new Set());return;}
  if(e.target.closest('button,input,a'))return;e.stopPropagation();select(target(row),e);
  if(e.ctrlKey||e.metaKey||e.shiftKey)return;
  if(e.pointerType==='touch'||e.pointerType==='pen'||target(row).isDir&&e.target.closest('.tree-caret'))void open(target(row),e);
 });
 list.addEventListener('dblclick',e=>{const row=rowAt(e);if(row&&!e.ctrlKey&&!e.metaKey&&!e.shiftKey&&!e.target.closest('.tree-caret')){e.preventDefault();void open(target(row),e);}});
 return {clear};
}
