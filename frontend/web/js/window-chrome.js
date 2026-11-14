// Only the full-viewport Windows shell exposes this capability. Old shells keep their native caption.
export async function mountWindowChrome(){
 const native=window.MatrixNative,root=document.documentElement;
 if(!native?.windowControls||document.querySelector('.window-chrome'))return;
 const style=document.createElement('link');style.rel='stylesheet';style.href='/css/window-chrome.css';
 const loaded=new Promise((resolve,reject)=>{style.onload=resolve;style.onerror=reject;});document.head.append(style);await loaded;
 const chrome=document.createElement('div');chrome.className='window-chrome';chrome.dataset.nativeChrome='';
 chrome.innerHTML=`<div class="window-drag"></div><div class="window-actions"><button type="button" data-window="minimize" aria-label="最小化" title="最小化"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="M6 16h12"/></svg></button><button type="button" data-window="maximize" aria-label="最大化" title="最大化"><svg viewBox="0 0 24 24" aria-hidden="true"><path class="window-expand" d="M5 11V5h6m2 14h6v-6"/><path class="window-restore" d="M10 5h9v9M5 10h9v9H5z"/></svg></button><button type="button" data-window="close" aria-label="关闭" title="关闭"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg></button></div>`;
 const edges=document.createElement('div');edges.className='window-resize';edges.dataset.nativeChrome='';edges.setAttribute('aria-hidden','true');
 for(const side of ['n','s','e','w','ne','nw','se','sw']){const edge=document.createElement('div');edge.dataset.resize=side;edges.append(edge);}
 // Keep window operations usable above modal previews, including their inert backdrop.
 function place(host){
  for(const layer of [chrome,edges]){
   if(layer.parentElement===host&&layer.matches(':popover-open'))continue;
   if(layer.matches(':popover-open'))layer.hidePopover();
   layer.setAttribute('popover','manual');host.append(layer);layer.showPopover();
  }
 }
 function modalHost(preferred){
  const dialogs=[...document.querySelectorAll('dialog[open]')];
  place(preferred?.matches('dialog[open]')?preferred:dialogs.at(-1)||document.body);
 }
 modalHost();root.dataset.windowChrome='true';
 document.addEventListener('toggle',e=>{if(e.target.tagName==='DIALOG')modalHost(e.target);},true);
 new MutationObserver(()=>{if(!chrome.isConnected||chrome.closest('dialog:not([open])'))modalHost();}).observe(document.body,{childList:true,subtree:true,attributes:true,attributeFilter:['open']});
 const report=()=>{chrome.querySelectorAll('button').forEach(b=>{b.disabled=false;});};
 chrome.querySelector('.window-drag').addEventListener('pointerdown',e=>{
  if(e.button!==0)return;e.preventDefault();void native.windowAction(e.detail===2?'maximize':'drag').catch(report);
 });
 edges.addEventListener('pointerdown',e=>{if(e.button!==0||!e.target.dataset.resize)return;e.preventDefault();void native.windowAction('resize',e.target.dataset.resize).catch(report);});
 chrome.addEventListener('click',async e=>{
  const button=e.target.closest('button');if(!button||button.disabled)return;
  button.disabled=true;
  if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&!document.body.classList.contains('motion-off')){
   await button.animate([{transform:'scale(.86)'},{transform:'scale(1)'}],{duration:140,easing:'cubic-bezier(.2,.8,.2,1)'}).finished.catch(()=>{});
  }
  try{await native.windowAction(button.dataset.window);}catch{report();}finally{button.disabled=false;}
 });
 function windowState(state){
  const maximized=Boolean(state?.maximized);root.dataset.windowMaximized=String(maximized);
  const button=chrome.querySelector('[data-window=maximize]'),label=maximized?'还原':'最大化';button.setAttribute('aria-label',label);button.title=label;
 }
 window.addEventListener('matrix-window-state',e=>windowState(e.detail));
 windowState(await native.windowAction('ready'));
}
