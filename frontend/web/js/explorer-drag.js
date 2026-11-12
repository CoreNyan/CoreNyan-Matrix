import {EXPLORER_DRAG} from './constants.js';
export function mountExplorerDrag({list,breadcrumbs,getScope,getSelection,select,onMove,onError,onStart}){
 let session=null,target=null,busy=false;
 const clearTarget=()=>{target?.classList.remove('file-drop-target');target=null;};
 const clear=()=>{clearTarget();session=null;list.classList.remove('file-dragging');list.querySelectorAll('.file-drag-source').forEach(e=>e.classList.remove('file-drag-source'));};
 const rowOf=e=>e.target.closest(EXPLORER_DRAG.row);
 function destination(event){
  const folder=event.target.closest(EXPLORER_DRAG.folder);
  if(folder&&list.contains(folder))return {element:folder,path:folder.dataset.relPath};
  const crumb=event.target.closest('[data-grid-dir]');
  if(crumb&&breadcrumbs?.contains(crumb))return {element:crumb,path:crumb.dataset.gridDir};
  return null;
 }
 function valid(dest){return !busy&&session&&session.scope===getScope()&&dest&&!session.sources.some(p=>dest.path===p||dest.path.startsWith(p+'/'));}
 list.addEventListener('dragstart',event=>{
  const row=rowOf(event);if(!row||busy){event.preventDefault();return;}
  onStart?.();
  const path=row.dataset.relPath;
  if(!getSelection().has(path))select({relPath:path,isDir:row.dataset.isDir==='1',name:row.dataset.name});
  const selected=[...getSelection()];
  session={scope:getScope(),sources:selected.filter(p=>!selected.some(parent=>p!==parent&&p.startsWith(parent+'/')))};
  event.dataTransfer.effectAllowed='move';event.dataTransfer.setData(EXPLORER_DRAG.mime,JSON.stringify(session));
  event.dataTransfer.setData('text/plain',session.sources.join('\n'));
  list.classList.add('file-dragging');
  for(const element of list.querySelectorAll(EXPLORER_DRAG.row))element.classList.toggle('file-drag-source',session.sources.includes(element.dataset.relPath));
 });
 for(const host of [list,breadcrumbs].filter(Boolean)){
  host.addEventListener('dragover',event=>{const dest=destination(event);clearTarget();if(!valid(dest)){if(session)event.dataTransfer.dropEffect='none';return;}event.preventDefault();event.dataTransfer.dropEffect='move';target=dest.element;target.classList.add('file-drop-target');});
  host.addEventListener('dragleave',event=>{if(target&&!target.contains(event.relatedTarget))clearTarget();});
  host.addEventListener('drop',async event=>{
   const dest=destination(event);if(!valid(dest)){clear();return;}
   event.preventDefault();event.stopPropagation();const payload={...session,targetDir:dest.path};clear();busy=true;list.setAttribute('aria-busy','true');
   try{await onMove(payload);}catch(error){onError(error);}finally{busy=false;list.setAttribute('aria-busy','false');}
  });
 }
 list.addEventListener('dragend',clear);
 window.addEventListener('blur',clear);
 return {clear};
}
