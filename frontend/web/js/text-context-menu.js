import {platformClipboard} from './platform.js';
import {icon} from './ui-icons.js';
import {TEXT_MENU as C} from './constants.js';
export function mountTextContextMenu({onError=()=>{}}={}){
 const menu=document.createElement('div');menu.className='text-context-menu';menu.setAttribute('role','menu');menu.setAttribute('popover','manual');document.body.append(menu);let session=null;
 const close=()=>{if(session?.terminal)session.terminal.dataset.contextMenuOpen='false';if(menu.matches(':popover-open'))menu.hidePopover();menu.hidden=true;session=null;};close();
 document.addEventListener('contextmenu',e=>{
  const wrapper=e.target.closest('.CodeMirror'),cm=wrapper?.CodeMirror,terminal=e.target.closest('#neuralLogTerminal');if(!cm&&!terminal)return;
  e.preventDefault();e.stopPropagation();close();
  const selection=document.getSelection(),text=cm?cm.getSelection():selection&&terminal.contains(selection.anchorNode)?selection.toString():'';
  session={cm,terminal,text,selections:cm?.listSelections(),doc:cm?.getDoc(),value:cm?.getValue(),readOnly:!cm||Boolean(cm.getOption('readOnly'))};
  const actions=cm?['undo','redo','cut','copy','paste','selectAll','find','replace']:['copy','copyAll','selectAll'];
  if(terminal)terminal.dataset.contextMenuOpen='true';menu.replaceChildren();
  for(const id of actions){const b=document.createElement('button');b.type='button';b.setAttribute('role','menuitem');b.dataset.action=id;b.innerHTML=icon(id==='copyAll'?'copy':id)+'<span>'+C.labels[id]+'</span>';
   b.disabled=(['cut','paste','undo','redo','replace'].includes(id)&&session.readOnly)||(['cut','copy'].includes(id)&&!text)||(id==='undo'&&!cm.historySize().undo)||(id==='redo'&&!cm.historySize().redo);
   b.onclick=()=>void execute(id);menu.append(b);
  }
  (e.target.closest('dialog[open]')||document.body).append(menu);menu.hidden=false;menu.showPopover();const scale=Number(getComputedStyle(document.documentElement).zoom)||1;menu.style.zoom=String(1/scale);
  menu.style.left=Math.max(C.inset,Math.min(e.clientX,innerWidth-menu.getBoundingClientRect().width-C.inset))+'px';menu.style.top=Math.max(C.inset,Math.min(e.clientY,innerHeight-menu.getBoundingClientRect().height-C.inset))+'px';
 },true);
 async function execute(id){const s=session;if(!s)return;close();try{
  const editable=()=>{if(!s.cm||s.cm.getDoc()!==s.doc||s.cm.getValue()!==s.value||s.cm.getOption('readOnly'))throw Error(C.changed);s.cm.setSelections(s.selections);s.cm.focus();};
  if(id==='copy'||id==='copyAll')await platformClipboard.writeText(id==='copy'?s.text:s.terminal.innerText);
  else if(id==='cut'){await platformClipboard.writeText(s.text);editable();s.cm.replaceSelection('','around','+delete');}
  else if(id==='paste'){const text=await platformClipboard.readText();editable();s.cm.replaceSelection(text,'end','+input');}
  else if(id==='selectAll'){if(s.cm){s.cm.focus();s.cm.execCommand('selectAll');}else{const range=document.createRange();range.selectNodeContents(s.terminal);const sel=document.getSelection();sel.removeAllRanges();sel.addRange(range);}}
  else{s.cm.focus();s.cm.execCommand(id);}
 }catch(e){onError(e.name==='NotAllowedError'?C.clipboardDenied:e.message);}}
 menu.addEventListener('pointerdown',e=>e.preventDefault());
 document.addEventListener('pointerdown',e=>{if(!menu.contains(e.target))close();},true);
 document.addEventListener('keydown',e=>{if(!session)return;if(e.key==='Escape'){e.preventDefault();close();}else if(['ArrowDown','ArrowUp'].includes(e.key)){e.preventDefault();const buttons=[...menu.querySelectorAll('button:not(:disabled)')],index=buttons.indexOf(document.activeElement);buttons[(index+(e.key==='ArrowDown'?1:buttons.length-1)+buttons.length)%buttons.length]?.focus();}else if(e.key!=='Enter'&&e.key!=='Tab')close();},true);
 document.addEventListener('wheel',e=>{if(!menu.contains(e.target))close();},{capture:true,passive:true});window.addEventListener('resize',close);window.addEventListener('blur',close);
 return {close};
}
