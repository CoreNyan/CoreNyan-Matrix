import {termText} from './terminology.js';
import {showDialog,closeDialog,reveal} from './ui-motion.js';
import {WORKSPACE_API,ENTITY} from './constants.js';
import {entityPreview} from './entity-models.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function mountLayerEditor(apiFetch,onSaved){
 const dialog=document.createElement('dialog');dialog.id='layerEditorDialog';dialog.className='workspace-dialog';dialog.dataset.navigationIndependent='';
 dialog.setAttribute('aria-labelledby','layerEditorTitle');document.body.append(dialog);
 let draft,revision,busy=false,version=0;
 const close=()=>{if(!busy){version++;closeDialog(dialog);}};
 // File inputs bubble their own cancel event when the native picker is dismissed.
 // Only a cancel targeted at this dialog (Escape) should close the editor.
 dialog.addEventListener('cancel',e=>{
  if(e.target!==dialog)return;
  e.preventDefault();close();
 });
 function rows(){
  dialog.querySelector('[data-shortcuts]').innerHTML=draft.shortcuts.map((s,i)=>`<div class="layer-shortcut" data-shortcut="${i}"><input aria-label="快捷名称" data-short-field="label" value="${esc(s.label)}"><input aria-label="快捷ID" data-short-field="id" value="${esc(s.id)}"><input aria-label="相对路径" data-short-field="path" value="${esc(s.path)}"><select aria-label="入口类型" data-short-field="kind"><option value="directory" ${s.kind==='directory'?'selected':''}>目录</option><option value="file" ${s.kind==='file'?'selected':''}>文件</option>${s.kind==='config'?'<option value="config" selected>配置面板</option>':''}</select><button type="button" class="wire-action-btn" data-remove-short="${i}">移除</button></div>`).join('');
 }
 function render(){
  const field=(key,label,type='text')=>`<label>${label}<input type="${type}" data-layer-field="${key}" value="${esc(draft[key])}"></label>`;
  dialog.innerHTML=`<header><h2 id="layerEditorTitle">${draft.key?termText('{{action.edit}}'):termText('{{action.createLayer}}')}</h2><button type="button" class="wire-action-btn" data-layer-close>关闭 ×</button></header><form><div class="layer-fields">${field('name','层名称')}${field('id','层 ID')}${field('organCode','横幅标题 / 分类')}<label>类型<select data-layer-field="kind"><option value="container" ${draft.kind==='container'?'selected':''}>容器层</option><option value="directory" ${draft.kind==='directory'?'selected':''}>文件层</option></select></label>${field('containerName','Docker 容器名称')}${field('port','端口（可空）','number')}${field('directory','云端目录（/opt/corenyan/ 下的绝对路径）')}${field('sub','副标题')}<label class="wide">简介<textarea data-layer-field="desc" rows="3">${esc(draft.desc)}</textarea></label><label class="wide">横幅图片<input type="file" accept="image/png,image/jpeg,image/webp,image/gif" data-layer-upload><img class="layer-banner-preview" src="${draft.doodle?'/'+esc(draft.doodle):entityPreview(draft)}" alt="横幅预览"><button type="button" class="wire-action-btn" data-layer-clear-banner>使用模型侧视图</button></label></div><div class="layer-shortcut-header"><h3>快捷目录与文件</h3><button type="button" class="wire-action-btn" data-add-short>添加快捷入口</button></div><p class="workspace-hint">路径相对于本层主目录；目录 ID 在所有层中保持唯一。</p><div data-shortcuts></div><p role="status" data-layer-status></p><footer><button class="wire-action-btn primary-bone" type="submit" data-layer-save>保存层配置</button></footer></form>`;
  rows();
 }
 async function open(key){
  const token=++version;
  try{
   const data=await apiFetch(WORKSPACE_API.layers);if(token!==version)return;revision=data.revision;
   const existing=key?data.layers.find(l=>l.key===key):null;
   if(key&&!existing)throw Error('层已不存在，请刷新');
   draft=structuredClone(existing||{id:'',name:'',kind:'container',containerName:'',organCode:'CONTAINER LAYER',directory:'/opt/corenyan/',sub:'',desc:'',doodle:'',entityModel:ENTITY.layerModels['corenyan-web'],port:null,shortcuts:[]});
   render();showDialog(dialog);
  }catch(e){alert(e.message);}
 }
 dialog.addEventListener('input',e=>{
  if(e.target.dataset.layerField)draft[e.target.dataset.layerField]=e.target.value;
  if(e.target.dataset.shortField)draft.shortcuts[Number(e.target.closest('[data-shortcut]').dataset.shortcut)][e.target.dataset.shortField]=e.target.value;
 });
 dialog.addEventListener('change',async e=>{
  if(!e.target.matches('[data-layer-upload]'))return;
  const file=e.target.files[0];if(!file)return;
  const status=dialog.querySelector('[data-layer-status]');
  if(file.size>4*1024*1024){status.textContent='图片大小不能超过4MB';return;}
  busy=true;dialog.querySelector('[data-layer-save]').disabled=true;
  try{
   const base64=await new Promise((resolve,reject)=>{const reader=new FileReader();reader.onload=()=>resolve(reader.result.split(',')[1]);reader.onerror=reject;reader.readAsDataURL(file);});
   const result=await apiFetch(WORKSPACE_API.banner,{method:'POST',body:{data:base64}});
   draft.doodle=result.path;dialog.querySelector('img').src='/'+result.path;status.textContent='图片已上传，保存配置后应用。';
  }catch(error){status.textContent=error.message;}
  finally{busy=false;dialog.querySelector('[data-layer-save]').disabled=false;}
 });
 dialog.addEventListener('click',e=>{
  if(busy)return;
  const button=e.target.closest('button');if(!button)return;
  if(button.hasAttribute('data-layer-close'))close();
  if(button.hasAttribute('data-layer-clear-banner')){draft.doodle='';dialog.querySelector('.layer-banner-preview').src=entityPreview(draft);}
  if(button.hasAttribute('data-add-short')){draft.shortcuts.push({id:'shortcut_'+crypto.randomUUID().slice(0,8),label:'',path:'',kind:'directory'});rows();}
  if(button.hasAttribute('data-remove-short')){draft.shortcuts.splice(Number(button.dataset.removeShort),1);rows();}
 });
 dialog.addEventListener('submit',async e=>{
  e.preventDefault();if(busy)return;busy=true;dialog.querySelector('[data-layer-save]').disabled=true;
  try{
   await apiFetch(WORKSPACE_API.layers,{method:'POST',body:{revision,originalKey:draft.key,layer:draft}});
   await onSaved();busy=false;close();
  }catch(error){dialog.querySelector('[data-layer-status]').textContent=error.message;}
  finally{busy=false;dialog.querySelector('[data-layer-save]').disabled=false;}
 });
 return {open};
}
