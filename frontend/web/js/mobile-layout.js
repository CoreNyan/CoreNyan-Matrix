import {DASHBOARD_UI as D} from '../../../contracts/dashboard-ui.js';
import {MOBILE_UI as C} from './mobile-layout-config.js';
import {EXPLORER} from './explorer-model.js';
import {reveal} from './ui-motion.js';
export function mountMobileLayout(registry){
 const state=registry.state,compact=matchMedia(C.query),nav=document.getElementById('mainNav'),slot=document.createComment('desktop navigation');nav.before(slot);
 const dock=document.createElement('div');dock.className='mobile-dock';document.body.append(dock);
 const svg=path=>'<svg viewBox="0 0 24 24" aria-hidden="true"><path d="'+path+'"/></svg>';
 for(const button of nav.querySelectorAll('[data-view]')){const [label,icon]=C.nav[button.dataset.view];button.querySelector('.tab-text').textContent=label;button.setAttribute('aria-label',label+' · '+D.navigation[button.dataset.view].description);const face=document.createElement('span');face.className='mobile-nav-face';face.innerHTML=svg(icon);face.append(document.createTextNode(label));button.append(face);}
 for(const [id,label,icon] of [['btnSettings',C.settings,C.icons.settings]]){const button=document.getElementById(id),face=document.createElement('span'),desktop=document.createElement('span');desktop.className='desktop-toolbar-label';desktop.append(...button.childNodes);button.append(desktop);face.className='mobile-toolbar-face';face.innerHTML=svg(icon);button.append(face);button.setAttribute('aria-label',label);button.title=label;}
 state.mobile={workspaceOpen:false,editorOpen:false};
 const sidebar=document.querySelector('.fm-module-sidebar'),editor=document.querySelector('.cortex-preview-column'),workbench=document.querySelector('.cortex-workbench-grid');
 const workspace=document.createElement('button');workspace.type='button';workspace.className='mobile-workspace-toggle';workspace.setAttribute('aria-label',C.workspace);sidebar.prepend(workspace);
 const back=document.createElement('button');back.type='button';back.className='mobile-editor-back';back.innerHTML=svg(C.icons.back);back.append(document.createTextNode(C.backFiles));editor.prepend(back);
 const resume=document.createElement('button');resume.type='button';resume.className='mobile-editor-resume';resume.textContent=C.openFile;document.querySelector('.cortex-TopToolbar').append(resume);
 workspace.onclick=()=>{state.mobile.workspaceOpen=!state.mobile.workspaceOpen;};
 back.onclick=()=>{state.mobile.editorOpen=false;};resume.onclick=()=>{state.mobile.editorOpen=true;};
 function render(){
  const active=state.fm.activeFile;workbench.classList.toggle('mobile-editor-open',compact.matches&&state.mobile.editorOpen);
  sidebar.classList.toggle('mobile-workspace-open',state.mobile.workspaceOpen);
  workspace.textContent=(EXPLORER.modules.find(m=>m.id===state.fm.module)?.label||state.fm.module||C.workspace)+'  '+(state.mobile.workspaceOpen?'−':'+');workspace.setAttribute('aria-expanded',String(state.mobile.workspaceOpen));
  resume.hidden=!active||state.mobile.editorOpen;back.setAttribute('aria-label',C.backFiles);
 }
 registry.subscribe(['mobile','fm.module','fm.activeFile'],render);
 registry.subscribe(['fm.activeFile.path'],()=>{if(compact.matches)state.mobile.editorOpen=!!state.fm.activeFile;if(state.fm.activeFile&&compact.matches){requestAnimationFrame(()=>{editor.scrollIntoView({block:'start',behavior:'smooth'});window.dispatchEvent(new Event('resize'));});}render();});
 registry.subscribe(['fm.currentScope'],()=>{state.mobile.workspaceOpen=false;state.mobile.editorOpen=false;});
 registry.subscribe(['mobile.editorOpen'],()=>{if(compact.matches&&state.mobile.editorOpen){reveal(editor);window.dispatchEvent(new Event('resize'));}});
 function layout(){
  document.body.classList.toggle('mobile-layout',compact.matches);
  if(compact.matches)dock.append(nav);else slot.after(nav);
  render();window.dispatchEvent(new Event('resize'));
 }
 compact.addEventListener('change',layout);layout();
}
