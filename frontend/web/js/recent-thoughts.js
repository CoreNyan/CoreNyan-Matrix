import {showDialog,closeDialog} from './ui-motion.js';
import {TELEMETRY,UI} from './constants.js';

export function mountRecentThoughts({trigger,inline}){
 const dialog=document.createElement('dialog');dialog.className='thoughts-dialog';dialog.setAttribute('aria-labelledby','recentThoughtsTitle');
 dialog.innerHTML='<header><div><small>RECENT THOUGHTS</small><h2 id="recentThoughtsTitle">最近在想</h2></div><span data-thought-count></span><button type="button" data-thought-close aria-label="关闭最近在想">×</button></header><div class="thoughts-reader" tabindex="0" aria-label="最近的想法"></div>';
 document.body.append(dialog);const reader=dialog.querySelector('.thoughts-reader');let entries=[];
 const close=()=>closeDialog(dialog);
 dialog.querySelector('[data-thought-close]').onclick=close;
 dialog.addEventListener('cancel',event=>{event.preventDefault();close();});
 dialog.addEventListener('click',event=>{if(event.target===dialog){const r=dialog.getBoundingClientRect();if(event.clientX<r.left||event.clientX>r.right||event.clientY<r.top||event.clientY>r.bottom)close();}});
 function render(target,items){
  const scroll=target.scrollTop,oldHeight=target.scrollHeight;
  const nodes=items.map(entry=>{
   const article=document.createElement('article');article.className='thought-entry';
   const content=typeof entry==='string'?entry:entry?.text||entry?.msg||entry?.summary||entry?.action||entry?.thought||'';
   const date=new Date(entry?.at||entry?.time||NaN);
   if(Number.isFinite(date.getTime())){const time=document.createElement('time');time.dateTime=date.toISOString();time.textContent=date.toLocaleString(UI.locale,{timeZone:UI.timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',second:'2-digit',hour12:false});article.append(time);}
   const text=document.createElement('p');text.textContent=String(content);article.append(text);return article;
  });
  if(!nodes.length){const empty=document.createElement('p');empty.className='thoughts-empty';empty.textContent='还没有新的想法。';nodes.push(empty);}
  target.replaceChildren(...nodes);if(scroll>0)target.scrollTop=Math.max(0,scroll+target.scrollHeight-oldHeight);
 }
 trigger.onclick=()=>{render(reader,entries);dialog.querySelector('[data-thought-count]').textContent=entries.length+' 条';showDialog(dialog);};
 return {update(logs){entries=(Array.isArray(logs)?logs:[]).slice().reverse();render(inline,entries.slice(0,TELEMETRY.diaryEntries));if(dialog.open){render(reader,entries);dialog.querySelector('[data-thought-count]').textContent=entries.length+' 条';}}};
}
