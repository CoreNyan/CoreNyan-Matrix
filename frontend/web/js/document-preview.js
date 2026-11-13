import {CHAT_FILES as C, DOCUMENT_READER as R} from '/contracts/chat-files.js';

// Page positions exist for the entire document; only nearby images are decoded.
export function mountDocumentPreview({stage,tools,file,url}){
 const element=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
 const button=(text,label)=>{const b=element('button','',text);b.type='button';b.title=label;b.setAttribute('aria-label',label);return b;};
 const previous=button('‹','上一页'),next=button('›','下一页'),minus=button('−','缩小'),plus=button('+','放大'),fit=button('适宽','适合宽度'),zoomLabel=element('span','','100%');
 const pageInput=element('input'),pageTotal=element('span','','/ …'),pageControl=element('label','document-page-control'),zoomControl=element('div','document-zoom-control'),pagesHost=element('div','document-pages');
 pageInput.type='number';pageInput.min='1';pageInput.value='1';pageInput.setAttribute('aria-label','跳转页码');pageInput.dataset.previewPage='';pageTotal.dataset.previewTotal='';
 previous.dataset.previewPrevious='';next.dataset.previewNext='';minus.dataset.previewZoomOut='';plus.dataset.previewZoomIn='';fit.dataset.previewFit='';
 pageControl.append(pageInput,pageTotal);zoomControl.append(minus,zoomLabel,plus,fit);tools.append(previous,pageControl,next,zoomControl);
 stage.classList.add('is-document');stage.tabIndex=0;stage.setAttribute('aria-label',file.name+'，连续页面预览');stage.append(pagesHost);
 let disposed=false,pages=0,current=1,zoom=1,active=null,tick=0,wanted=new Set(),ratio=R.initialRatio,clock=0,navigationTarget=0;
 const slots=[];
 function addPage(number){
  const node=element('section','document-page'),image=element('img'),message=element('p','document-page-status','第 '+number+' 页'),retry=button('重试','重新加载第 '+number+' 页');
  node.dataset.page=String(number);node.setAttribute('aria-label','第 '+number+' 页');node.style.aspectRatio=String(ratio);image.alt=file.name+' · 第 '+number+' 页';image.draggable=false;image.hidden=true;retry.hidden=true;node.append(image,message,retry);pagesHost.append(node);
  const item={number,node,image,message,retry,state:'idle',used:0};retry.onclick=()=>{item.state='idle';item.retry.hidden=true;wanted.add(number);pump(number);};slots.push(item);return item;
 }
 function controls(){pageInput.max=String(pages||1);pageInput.disabled=!pages;if(document.activeElement!==pageInput)pageInput.value=String(current);pageTotal.textContent='/ '+(pages||'…');previous.disabled=!pages||current<=1;next.disabled=!pages||current>=pages;minus.disabled=zoom<=R.minZoom;plus.disabled=zoom>=R.maxZoom;zoomLabel.textContent=Math.round(zoom*100)+'%';}
 function schedule(){if(!disposed&&!tick)tick=requestAnimationFrame(scan);}
 function scan(){
  tick=0;if(disposed)return;
  const viewport=stage.getBoundingClientRect(),center=viewport.top+R.pageGap*2;let nearest=Infinity;wanted=new Set();
  for(const item of slots){const r=item.node.getBoundingClientRect();if(r.bottom>viewport.top-viewport.height*R.prefetchScreens&&r.top<viewport.bottom+viewport.height*R.prefetchScreens)wanted.add(item.number);const distance=center<r.top?r.top-center:center>r.bottom?center-r.bottom:0;if(distance<nearest){nearest=distance;current=item.number;}}
  if(stage.scrollTop<=1)current=1;else if(stage.scrollTop+stage.clientHeight>=stage.scrollHeight-2)current=pages||1;
  if(navigationTarget){const r=slots[navigationTarget-1].node.getBoundingClientRect();if(r.bottom>viewport.top&&r.top<viewport.bottom)current=navigationTarget;else navigationTarget=0;}
  controls();pump();
 }
 function evict(){
  const loaded=slots.filter(s=>s.state==='ready').sort((a,b)=>b.used-a.used);
  for(const item of loaded.slice(R.maxDecodedPages)){if(wanted.has(item.number))continue;item.image.removeAttribute('src');item.image.hidden=true;item.message.hidden=false;item.state='idle';}
 }
 async function load(item){
  const controller=new AbortController();active={item,controller};item.state='loading';item.node.setAttribute('aria-busy','true');item.message.textContent='正在读取第 '+item.number+' 页…';item.message.hidden=false;item.retry.hidden=true;
  const timeout=setTimeout(()=>controller.abort(),C.previewTimeoutMs);
  try{
   const request=new URL(url,location.href);request.searchParams.set('page',String(item.number));request.searchParams.set('format','json');
   const response=await fetch(request,{credentials:'same-origin',cache:'no-store',signal:controller.signal});
   if(response.status===401||response.status===403)throw Error('登录已失效，请重新登录后预览。');
   const data=await response.json();if(!response.ok)throw Error(data.error==='PDF_PAGE_OUT_OF_RANGE'?'文档没有这一页。':'这一页未能加载，请重试。');
   if(data.page!==item.number||!Number.isSafeInteger(data.pages)||data.pages<item.number||data.pages>R.maxPages||pages&&data.pages!==pages||data.mime!=='image/jpeg'||!data.base64)throw Error('预览返回了错误的页码，请重试。');
   const decoded=new Image();decoded.src='data:image/jpeg;base64,'+data.base64;await decoded.decode();if(disposed)return;
   const anchor=slots[current-1],offset=anchor?.node.getBoundingClientRect().top,scale=stage.getBoundingClientRect().height/stage.offsetHeight||1;
   item.node.style.aspectRatio=String(decoded.naturalWidth/decoded.naturalHeight);item.image.src=decoded.src;item.image.hidden=false;item.message.hidden=true;item.state='ready';item.used=++clock;
   if(!pages){pages=data.pages;ratio=decoded.naturalWidth/decoded.naturalHeight;for(let number=2;number<=pages;number++)addPage(number);}
   if(anchor&&offset!==undefined)stage.scrollTop+=(anchor.node.getBoundingClientRect().top-offset)/scale;
   controls();evict();
  }catch(error){if(!disposed){item.state='error';item.message.textContent=error.name==='AbortError'?'读取超时，请重试。':error.message;item.retry.hidden=false;}}
  finally{clearTimeout(timeout);item.node.removeAttribute('aria-busy');active=null;if(!disposed)schedule();}
 }
 function pump(priority){if(disposed||active)return;const candidates=slots.filter(s=>s.state==='idle'&&(wanted.has(s.number)||s.number===priority)).sort((a,b)=>Math.abs(a.number-(priority||current))-Math.abs(b.number-(priority||current)));if(candidates[0])void load(candidates[0]);}
 function go(value){const number=Number(value);if(!Number.isInteger(number)||number<1||number>pages){pageInput.value=String(current);return;}current=number;navigationTarget=number;const r=stage.getBoundingClientRect(),target=slots[number-1].node.getBoundingClientRect(),scale=r.height/stage.offsetHeight||1;stage.scrollTop+=(target.top-r.top)/scale-R.pageGap;pageInput.value=String(number);wanted.add(number);controls();pump(number);schedule();}
 function setZoom(value){
  const anchor=slots[current-1],before=anchor.node.getBoundingClientRect(),viewport=stage.getBoundingClientRect(),fraction=(viewport.top-before.top)/before.height;
  zoom=Math.max(R.minZoom,Math.min(R.maxZoom,Math.round(value*100)/100));pagesHost.style.setProperty('--document-zoom',String(zoom));
  const after=anchor.node.getBoundingClientRect(),scale=viewport.height/stage.offsetHeight||1;stage.scrollTop+=(after.top+fraction*after.height-viewport.top)/scale;controls();schedule();
 }
 previous.onclick=()=>go(current-1);next.onclick=()=>go(current+1);pageInput.onchange=()=>go(pageInput.value);pageInput.onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();go(pageInput.value);pageInput.blur();}};
 minus.onclick=()=>setZoom(zoom-R.zoomStep);plus.onclick=()=>setZoom(zoom+R.zoomStep);fit.onclick=()=>setZoom(1);
 const manual=()=>{navigationTarget=0;};const manualEvents=['wheel','touchstart','pointerdown','keydown'];for(const event of manualEvents)stage.addEventListener(event,manual,{passive:true});
 const resize=new ResizeObserver(schedule);resize.observe(stage);stage.addEventListener('scroll',schedule,{passive:true});
 addPage(1);controls();void load(slots[0]);
 return ()=>{disposed=true;active?.controller.abort();cancelAnimationFrame(tick);resize.disconnect();stage.removeEventListener('scroll',schedule);for(const event of manualEvents)stage.removeEventListener(event,manual);for(const item of slots)item.image.removeAttribute('src');};
}
