import {showDialog,closeDialog,reveal} from './ui-motion.js';
import {WORKSPACE_API,FILE_SEARCH} from './constants.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountWorkspaceSearch(apiFetch,openFile,getScopes){
 const dialog=document.createElement('dialog');dialog.id='workspaceSearchDialog';dialog.className='workspace-dialog workspace-search';dialog.dataset.navigationIndependent='';
 dialog.setAttribute('aria-labelledby','fileSearchTitle');
 dialog.innerHTML='<header><h2 id="fileSearchTitle">搜索文件与内容</h2><button class="wire-action-btn" data-search-close>关闭 ×</button></header><div class="workspace-search-bar"><input data-search-query type="search" placeholder="文件名或文件内的文字…" aria-label="全局搜索词"><select data-search-scope aria-label="搜索范围"></select></div><p role="status" data-search-status>输入文字开始搜索</p><div data-search-results></div>';
 document.body.append(dialog);
 let timer,controller,version=0,items=[];
 const query=dialog.querySelector('[data-search-query]'),scope=dialog.querySelector('[data-search-scope]'),status=dialog.querySelector('[data-search-status]'),results=dialog.querySelector('[data-search-results]');
 const close=()=>{clearTimeout(timer);controller?.abort();version++;closeDialog(dialog);};
 async function search(){
  clearTimeout(timer);controller?.abort();const ticket=++version,q=query.value.trim();
  items=[];results.innerHTML='';
  if(!q){status.textContent='输入文字开始搜索';return;}
  controller=new AbortController();status.textContent='搜索中…';
  try{
   const data=await apiFetch(WORKSPACE_API.search+'?'+new URLSearchParams({scope:scope.value,q}),{signal:controller.signal});
   if(ticket!==version)return;items=data.items;
   status.textContent=`找到 ${items.length} 项 · 扫描 ${data.scanned} 个文件${data.skipped?' · 跳过 '+data.skipped+' 个二进制、大文件或缓存项':''}${data.truncated?' · 已达到搜索上限，请缩小范围或关键词':''}${data.errors?.length?' · '+data.errors.length+' 个路径无法读取':''}`;
   results.innerHTML=items.map((item,i)=>`<button class="workspace-search-result" data-search-result="${i}"><strong>${esc(item.path)}</strong><small>${esc(item.scopeLabel)} · ${item.match==='name'?'文件名匹配':'内容匹配'+(item.line?' · 第 '+item.line+' 行':'')}</small>${item.snippet?'<pre>'+esc(item.snippet)+'</pre>':''}</button>`).join('')||'<p>没有匹配结果</p>';
  }catch(e){if(ticket===version&&e.name!=='AbortError')status.textContent=e.message;}
 }
 function open(){
  const old=scope.value;scope.innerHTML='<option value="all">全部层（全局）</option>'+getScopes().filter(s=>s.kind!=='config').map(s=>`<option value="${esc(s.id)}">${esc(s.label)} · ${esc(s.sub)}</option>`).join('');
  if([...scope.options].some(o=>o.value===old))scope.value=old;
  showDialog(dialog);query.focus();if(query.value)search();
 }
 query.maxLength=FILE_SEARCH.maxQuery;query.addEventListener('input',()=>{clearTimeout(timer);controller?.abort();version++;timer=setTimeout(search,FILE_SEARCH.delayMs);});
 query.addEventListener('keydown',e=>{if(e.key==='Enter'){e.preventDefault();search();}});
 scope.addEventListener('change',search);
 dialog.querySelector('[data-search-close]').addEventListener('click',close);
 dialog.addEventListener('cancel',e=>{e.preventDefault();close();});
 results.addEventListener('click',async e=>{
  const button=e.target.closest('[data-search-result]');if(!button)return;
  const item=items[Number(button.dataset.searchResult)];close();
  if(!await openFile(item))showDialog(dialog);
 });
 return {open};
}
