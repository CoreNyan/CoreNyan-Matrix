import {CHAT_FILES as C} from '/contracts/chat-files.js';
// A page is committed only after both the API and image decoder succeed.
export function mountDocumentPreview({stage,tools,file,url}){
 const element=(tag,text)=>{const n=document.createElement(tag);if(text)n.textContent=text;return n;};
 const previous=element('button','上一页'),next=element('button','下一页'),label=element('span','正在读取页数…'),retry=element('button','重试'),message=element('p'),image=element('img');
 previous.type=next.type=retry.type='button';previous.dataset.previewPrevious='';next.dataset.previewNext='';label.dataset.previewPage='';
 image.alt=file.name;image.hidden=true;message.className='chat-preview-status';message.setAttribute('role','status');retry.hidden=true;
 tools.append(previous,label,next);stage.classList.add('is-document');stage.append(image,message,retry);
 let page=0,pages=0,busy=false,disposed=false,failedPage=1,controller;
 const update=()=>{previous.disabled=busy||page<=1;next.disabled=busy||!pages||page>=pages;stage.setAttribute('aria-busy',String(busy));};
 async function load(target){
  if(disposed||busy)return;busy=true;failedPage=target;retry.hidden=true;message.hidden=false;message.textContent='正在读取第 '+target+' 页…';update();
  controller=new AbortController();const timeout=setTimeout(()=>controller.abort(),C.previewTimeoutMs);
  try{
   const request=new URL(url,location.href);request.searchParams.set('page',String(target));request.searchParams.set('format','json');
   const response=await fetch(request,{credentials:'same-origin',cache:'no-store',signal:controller.signal});
   if(response.status===401||response.status===403)throw Error('登录已失效，请重新登录后预览。');
   const data=await response.json();if(!response.ok)throw Error(data.error==='PDF_PAGE_OUT_OF_RANGE'?'文档没有这一页。':'这一页未能加载，请重试。');
   if(data.page!==target||!Number.isSafeInteger(data.pages)||data.pages<target||data.mime!=='image/jpeg'||!data.base64)throw Error('预览返回了错误的页码，请重试。');
   const decoded=new Image();decoded.src='data:image/jpeg;base64,'+data.base64;await decoded.decode();if(disposed)return;
   image.src=decoded.src;image.hidden=false;page=target;pages=data.pages;label.textContent='第 '+page+' / '+pages+' 页';message.hidden=true;
  }catch(error){if(!disposed){message.textContent=error.name==='AbortError'?'读取超时，请重试。':error.message;retry.hidden=false;if(!page)label.textContent='尚未加载';}}
  finally{clearTimeout(timeout);busy=false;if(!disposed)update();}
 }
 previous.onclick=()=>void load(page-1);next.onclick=()=>void load(page+1);retry.onclick=()=>void load(failedPage);update();void load(1);
 return ()=>{disposed=true;controller?.abort();image.removeAttribute('src');};
}
