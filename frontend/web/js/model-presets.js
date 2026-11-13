import {mountModelList,readModelIds,writeModelIds,validateModelIds} from './preset-model-list.js';
import {mountPresetOrder} from './preset-order.js';
import {decorateSettings} from './ui-icons.js';
import {createAutosave} from './preset-autosave.js';
import {showDialog,closeDialog,setPanelVisible,reveal} from './ui-motion.js';
import {StateRegistry} from './state-registry.js';
import {MODEL_PRESETS,PRESET_EDITOR} from './constants.js';
const esc=value=>String(value??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const pretty=value=>JSON.stringify(value,null,2);
const readPath=(object,path)=>path.split('.').reduce((v,k)=>v?.[k],object);
function writePath(object,path,value){
 const parts=path.split('.'),key=parts.pop();let target=object;
 for(const part of parts)target=target[part]??={};
 if(value===undefined)delete target[key];else target[key]=value;
 if(object.retry&&Object.keys(object.retry).length===0)delete object.retry;
}
function documentOf(item,kind){
 const settings={...(item?.settings||MODEL_PRESETS.defaults[kind]),api_key:null};
 delete settings.fallback_preset;delete settings.fallback_presets;
 writeModelIds(settings,readModelIds(settings));
 return {version:PRESET_EDITOR.version,kind,name:item?.name||'',settings};
}
const fingerprint=draft=>{try{return JSON.stringify([draft.id,JSON.parse(draft.raw)]);}catch{return JSON.stringify([draft.id,draft.raw]);}};
export function mountModelPresets(api,{onApplied=()=>{},openDirectory=()=>{},createEditor,syncEditor}={}){
 const host=document.getElementById('modelPresetSection'),dialog=document.createElement('dialog');
 dialog.id='modelPresetDialog';dialog.className='preset-dialog';dialog.setAttribute('aria-labelledby','presetTitle');
 dialog.innerHTML=`<header class="preset-header"><div><small>模型配置</small><h2 id="presetTitle">大模型预设</h2></div><div class="preset-header-actions"><span data-autosave role="status" aria-live="polite">已保存</span><button type="button" data-refresh hidden>读取云端版本</button><button type="button" data-close aria-label="关闭预设管理">×</button></div></header>
 <nav class="preset-kind-tabs" role="tablist" aria-label="模型类型">${MODEL_PRESETS.kinds.map((kind,i)=>`<button type="button" role="tab" id="presetTab-${kind}" aria-controls="presetKindPanel" data-kind="${kind}"><span>0${i+1}</span><strong>${MODEL_PRESETS.labels[kind]}</strong><small>${PRESET_EDITOR.descriptions[kind]}</small><b data-kind-count="${kind}">0</b></button>`).join('')}</nav>
 <section id="presetKindPanel" role="tabpanel" class="preset-kind-panel">
 <p data-status role="status" aria-live="polite"></p>
 <div class="preset-workspace"><aside><button type="button" data-routing>调用顺序 <span>↗</span></button><div class="preset-list-head"><strong data-library-title>预设库</strong><button type="button" data-new>＋ 新建</button></div><nav data-list aria-label="本类预设"></nav><button type="button" data-folder>在文件管理器中打开 ↗</button></aside>
 <section class="preset-route" hidden><header class="preset-route-heading"><small>预设轮换</small><h3>调用顺序</h3><p>失败时依次切换预设，一轮用尽后继续轮换，直到成功或达到次数与时间上限。</p></header><div class="preset-route-columns"><label><span data-primary-label>主预设</span><select data-primary aria-label="当前主预设"></select></label><fieldset class="preset-backup-fieldset"><legend>备用预设 · 按顺序尝试</legend><ol data-backups></ol><div class="preset-backup-add"><select data-backup-choice aria-label="添加备用预设"></select><button type="button" data-add-backup>＋ 添加备用</button></div></fieldset></div><div class="preset-route-footer"><p data-route-summary></p></div></section>
 <form data-form novalidate><header class="preset-editor-heading"><div><small data-file-label>预设文件</small><h3 data-editor-title>选择预设</h3></div><div class="preset-mode-tabs" role="tablist" aria-label="编辑模式"><button type="button" role="tab" data-mode="form" aria-controls="presetFormPanel">表单编辑</button><button type="button" role="tab" data-mode="json" aria-controls="presetJsonPanel">完整 JSON</button></div></header>
 <label class="preset-id-field">预设文件路径<input data-field="id" maxlength="320" placeholder="例如 text/local 或 text-primary" autocomplete="off"><small>支持子目录路径，例如 text/local；保存为 text/local.json。</small></label>
 <section id="presetFormPanel" role="tabpanel" data-form-panel><div data-fields></div>
 <fieldset class="preset-retry-fieldset"><legend>按错误类型设置重试次数</legend><div data-retry-rules></div><button type="button" data-add-retry>＋ 添加错误规则</button></fieldset>
 </section>
 <section id="presetJsonPanel" role="tabpanel" class="preset-json" data-json-panel hidden><div class="preset-json-toolbar"><strong>完整预设文件</strong><button type="button" data-format>格式化</button><span id="presetCursorMeta">LN 1, COL 1</span></div><p class="preset-help">包括 version、kind、name 和全部 settings。api_key: null 保留现有密钥；填入新值可替换，空字符串清除。</p><div class="ide-code-surface preset-json-surface"><textarea id="presetJsonEditor" spellcheck="false" aria-label="完整预设 JSON"></textarea></div></section>
 <footer class="preset-editor-footer"><span data-dirty></span><button type="button" data-discard hidden>放弃草稿</button><button type="button" data-rename-preset>${PRESET_EDITOR.actions.rename}</button><button type="button" data-clone>${PRESET_EDITOR.actions.clone}</button><button type="submit" data-save>${PRESET_EDITOR.actions.create}</button><button type="button" data-delete>删除预设</button></footer></form></div></section>
 <div class="preset-confirm" hidden><p data-confirm-text></p><label data-rename-label hidden>源文件名称<input data-rename-path maxlength="325" autocomplete="off" spellcheck="false"><small>可填写子目录路径；文件扩展名保持为 .json。</small></label><p data-rename-error role="alert"></p><button type="button" data-cancel>取消</button><button type="button" data-confirm>确认</button></div>`;
 document.body.append(dialog);decorateSettings(dialog);
 const q=selector=>dialog.querySelector(selector),drafts=new Map();
 const registry=new StateRegistry({catalog:null,kind:'text',draft:null,mode:'form',primary:'',backups:[],busy:false,error:'',notice:'',screen:'editor',saveState:'saved'});
 const state=registry.state;
 let confirmation=null,renameSource=null,editor,modelList,connectionRevision=0;
 const isDirty=d=>d&&fingerprint(d)!==d.original;
 function nextId(){let i=1;while(state.catalog?.items.some(p=>p.id===state.kind+'/'+PRESET_EDITOR.newFilePrefix+'-'+i))i++;return state.kind+'/'+PRESET_EDITOR.newFilePrefix+'-'+i;}
 function validateDraft(d){const doc=parseDraft(d);const missing=PRESET_EDITOR.requiredFields.filter(([key])=>!String(key==='id'?d.id:readPath(doc,key)||'').trim());if(missing.length){const error=Error('请填写'+missing.map(([,label])=>label).join('、')+'，草稿已保留。');error.field=missing[0][0];throw error;}try{validateModelIds(doc.settings);}catch(error){error.field='settings.model';throw error;}writeModelIds(doc.settings,readModelIds(doc.settings).map(id=>id.trim()));return doc;}
 const dirtyDrafts=()=>[...drafts.values()].filter(isDirty);
 const routeDirty=()=>state.catalog&&(state.primary!==state.catalog.bindings[state.kind]||JSON.stringify(state.backups)!==JSON.stringify(state.catalog.fallbacks?.[state.kind]||[]));
 const dirty=()=>dirtyDrafts().length>0||routeDirty();
 function parseDraft(draft=state.draft){
  let doc;try{doc=JSON.parse(draft.raw);}catch{throw Error('完整 JSON 语法错误，请修正后再切换表单或保存。');}
  if(!doc||Array.isArray(doc)||typeof doc!=='object'||doc.version!==PRESET_EDITOR.version||doc.kind!==draft.kind||typeof doc.name!=='string'||!doc.settings||Array.isArray(doc.settings)||typeof doc.settings!=='object')throw Error('预设必须包含 version: 1、当前类型 kind、name 和 settings 对象。');
  if(Object.keys(doc).some(key=>!['version','kind','name','settings'].includes(key)))throw Error('预设顶层仅支持 version、kind、name、settings；文件路径使用上方输入框。');
  if('fallback_preset' in doc.settings||'fallback_presets' in doc.settings)throw Error('备用预设请在上方本类调用配置中设置，不属于单个预设 JSON。');
  if(doc.settings.model!==undefined&&typeof doc.settings.model!=='string'||doc.settings.fallback_models!==undefined&&(!Array.isArray(doc.settings.fallback_models)||doc.settings.fallback_models.some(id=>typeof id!=='string')))throw Error('模型 ID 必须为文本，备用列表必须为文本数组。');
  if(doc.settings.retry!==undefined&&(!doc.settings.retry||Array.isArray(doc.settings.retry)||typeof doc.settings.retry!=='object'))throw Error('retry 必须是对象。');
  if(doc.settings.retry?.retries_by_error!==undefined&&(!doc.settings.retry.retries_by_error||Array.isArray(doc.settings.retry.retries_by_error)||typeof doc.settings.retry.retries_by_error!=='object'))throw Error('retries_by_error 必须是对象。');
  return doc;
 }
 function mutate(fn){try{const doc=parseDraft();fn(doc);state.draft.raw=pretty(doc);state.error='';state.notice='';autosave.schedule();}catch(e){state.error=e.message;}}
 const ask=(message,action)=>{renameSource=null;q('[data-rename-label]').hidden=true;q('[data-rename-error]').textContent='';confirmation=action;q('[data-confirm-text]').textContent=message;setPanelVisible(q('.preset-confirm'),true);q('[data-confirm]').focus();};
 function discardAll(){drafts.clear();state.primary=state.catalog?.bindings[state.kind]||'';state.backups=[...(state.catalog?.fallbacks?.[state.kind]||[])];selectPreset(state.draft?.selected);}
 const guard=async action=>{if(!dirty()&&state.saveState!=='saving')return action();if(await autosave.flush())return action();ask('修改还没有保存。继续编辑，或确认放弃这些未保存的内容。',()=>{discardAll();action();});};
 function close(){if(!state.busy)guard(()=>closeDialog(dialog));}
 q('[data-close]').onclick=close;dialog.addEventListener('cancel',e=>{if(e.target!==dialog)return;e.preventDefault();close();});
 q('[data-cancel]').onclick=()=>{confirmation=null;renameSource=null;setPanelVisible(q('.preset-confirm'),false);};
 q('[data-confirm]').onclick=()=>{if(renameSource){void renamePreset();return;}const action=confirmation;confirmation=null;setPanelVisible(q('.preset-confirm'),false);action?.();};
 editor=createEditor('presetJsonEditor',value=>{if(state.draft){connectionRevision++;state.draft.raw=value;state.error='';state.notice='';autosave.schedule();}},()=>q('[data-form]').requestSubmit(),'presetCursorMeta');
 function selectPreset(id){
  connectionRevision++;
  const item=state.catalog?.items.find(p=>p.id===id&&p.kind===state.kind);
  const key=item?.id||'new:'+state.kind;
  let draft=drafts.get(key);
  if(!draft){draft={id:item?.id||nextId(),selected:item?.id||null,kind:state.kind,revision:item?.revision,raw:pretty(documentOf(item,state.kind))};draft.original=fingerprint(draft);}
  state.draft=draft;drafts.set(key,state.draft);state.screen='editor';
  state.error='';state.notice='';renderForm();renderLibrary();renderControls();q('[data-form-panel]').scrollTop=0;q('[data-json-panel]').scrollTop=0;
 }
 function candidates(){return state.catalog?.items.filter(p=>p.kind===state.kind)||[];}
 function references(id){return Object.values(state.catalog?.bindings||{}).includes(id)||Object.values(state.catalog?.fallbacks||{}).some(ids=>ids.includes(id));}
 function renderLibrary(){
  const items=candidates();
  q('[data-library-title]').textContent=MODEL_PRESETS.labels[state.kind]+'预设库';
  q('[data-list]').replaceChildren(...items.map(item=>{
   const button=document.createElement('button');button.type='button';button.dataset.preset=item.id;
   const name=document.createElement('strong'),detail=document.createElement('small'),draft=drafts.get(item.id);
   name.textContent=item.name;detail.textContent=item.id+(state.catalog.bindings[state.kind]===item.id?' · 主预设':'')+(isDirty(draft)?' · 未保存':'');
   button.append(name,detail);button.classList.toggle('active',state.screen==='editor'&&state.draft?.selected===item.id);button.onclick=()=>{if(!state.busy)guard(()=>selectPreset(item.id));};return button;
  }));
  if(!items.length){const empty=document.createElement('p');empty.textContent='本类暂无预设，点击新建。';q('[data-list]').append(empty);}
  for(const kind of MODEL_PRESETS.kinds){
   const tab=q('[data-kind="'+kind+'"]'),active=state.kind===kind;tab.setAttribute('aria-selected',String(active));tab.tabIndex=active?0:-1;
   q('[data-kind-count="'+kind+'"]').textContent=state.catalog?.items.filter(p=>p.kind===kind).length||0;
  }
  q('#presetKindPanel').setAttribute('aria-labelledby','presetTab-'+state.kind);
  q('[data-primary-label]').textContent=MODEL_PRESETS.labels[state.kind]+' · 当前主预设';
  const primary=q('[data-primary]');primary.replaceChildren(new Option('选择本类主预设',''));
  for(const p of items)primary.add(new Option(p.name+' · '+p.settings.model,p.id));
  primary.value=state.primary;renderBackups();renderRouteSummary();
 }
 function renderRouteSummary(){
  const primary=state.catalog?.items.find(p=>p.id===state.primary);
  q('[data-route-summary]').textContent=primary?'调用顺序：'+[primary.id,...state.backups].map(id=>state.catalog.items.find(p=>p.id===id)?.name||id).join(' → '):'先新建一份预设，再选择为主预设。';
 }
 function renderForm(){
  if(!state.draft)return;
  q('[data-field=id]').value=state.draft.id;
  let doc;try{doc=parseDraft();}catch{state.mode='json';return;}
  const fields=PRESET_EDITOR.fields.filter(f=>!f.kinds||f.kinds.includes(state.kind)||readPath(doc.settings,f.path)!==undefined);
  modelList?.destroy();modelList=null;
  function field(f){
   if(f.type==='model-list')return '<div class="wide preset-models" data-model-list></div>';
   const value=readPath(doc.settings,f.path);
   const attrs=' data-setting="'+f.path+'"'+(f.min!==undefined?' min="'+f.min+'"':'')+(f.max!==undefined?' max="'+f.max+'"':'')+(f.step?' step="'+f.step+'"':'');
   let control;
   if(f.type==='select'||f.type==='boolean'){
    const options=f.type==='boolean'?[['true','启用'],['false','关闭']]:f.options;
    control='<select'+attrs+'><option value="">使用默认</option>'+options.map(([v,label])=>'<option value="'+v+'"'+(String(value)===v?' selected':'')+'>'+label+'</option>').join('')+'</select>';
   }else control='<input type="'+f.type+'"'+attrs+' value="'+esc(value??'')+'" autocomplete="'+(f.type==='password'?'new-password':'off')+'"'+(f.required?' required':'')+'>';
   return '<label class="'+(f.wide?'wide':'')+'">'+f.label+control+(f.path==='api_key'?'<small data-key-note></small><button type="button" data-keep-key>保留服务器现有密钥</button>':'')+'</label>';
  }
  q('[data-fields]').innerHTML='<fieldset><legend>预设信息</legend><label>名称<input data-field="name" maxlength="100" required value="'+esc(doc.name)+'"></label></fieldset>'+PRESET_EDITOR.groups.map(g=>{
   const selected=fields.filter(f=>f.group===g.id);return selected.length?'<fieldset><legend>'+g.label+'</legend><div class="preset-fields">'+selected.map(field).join('')+'</div></fieldset>':'';
  }).join('');
  modelList=mountModelList(q('[data-model-list]'),{settings:doc.settings,change:ids=>mutate(doc=>writeModelIds(doc.settings,ids)),canStart:()=>!state.busy,loadModels:async()=>{const revision=connectionRevision,doc=parseDraft();const result=await api(MODEL_PRESETS.api+PRESET_EDITOR.discovery.path,{method:'POST',body:{id:state.draft.selected,base_url:doc.settings.base_url,api_key:doc.settings.api_key}});if(revision!==connectionRevision)throw Error('连接信息已修改，请重新获取模型列表。');return result;}});
  renderRetryRules();renderKeyNote();
 }
 function renderKeyNote(){const note=q('[data-key-note]');if(!note)return;try{const key=parseDraft().settings.api_key;note.textContent=key==null?'密钥不回显；保存时保留服务器现有值。':key===''?'保存时将清除密钥。':'保存时将替换密钥。';}catch{}}
 function renderBackups(){
  const ids=state.backups;
  const list=q('[data-backups]');list.replaceChildren(...ids.map((id,i)=>{
   const row=document.createElement('li');row.dataset.backup=id;
   const text=document.createElement('span'),item=state.catalog.items.find(p=>p.id===id);text.textContent=(i+1)+'. '+(item?.name||id)+' · '+id;
   const handle=document.createElement('button');handle.type='button';handle.dataset.backupDrag='';handle.className='preset-drag-handle';handle.setAttribute('aria-label','拖动排序 '+(item?.name||id));handle.title='拖动更换顺序';handle.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h.01M16 5h.01M8 12h.01M16 12h.01M8 19h.01M16 19h.01"/></svg>';row.append(handle,text);
   const actions=document.createElement('div');actions.className='preset-backup-actions';row.append(actions);
   for(const [action,label,disabled] of [...(i===0?[['swap','与主预设对调',!state.primary]]:[]),['up','↑',i===0],['down','↓',i===ids.length-1],['remove','移除',false]]){
    const b=document.createElement('button');b.type='button';b.dataset.backupAction=action;b.dataset.index=i;b.textContent=label;b.disabled=disabled||state.busy;b.setAttribute('aria-label',(action==='swap'?'与主预设对调':action==='up'?'上移':action==='down'?'下移':'移除')+'备用 '+id);actions.append(b);
   }return row;
  }));
  if(!ids.length){const empty=document.createElement('li');empty.className='preset-empty';empty.textContent='尚未添加备用预设';list.append(empty);}
  const choice=q('[data-backup-choice]');choice.replaceChildren(new Option('选择本类其他预设',''));
  for(const item of candidates())if(item.id!==state.primary&&!ids.includes(item.id))choice.add(new Option(item.name+' · '+item.id,item.id));
 }
 function renderRetryRules(){
  let doc;try{doc=parseDraft();}catch{return;}
  q('[data-retry-rules]').innerHTML=Object.entries(doc.settings.retry?.retries_by_error||{}).map(([key,value],index)=>'<div class="preset-retry-row"><input data-retry-key="'+index+'" aria-label="错误类型" value="'+esc(key)+'"><input type="number" min="0" max="20" data-retry-value="'+index+'" aria-label="该错误的重试次数" value="'+esc(value)+'"><button type="button" data-remove-retry="'+index+'">移除</button></div>').join('');
 }
 function renderControls(){
  if(!state.draft)return;
  const d=state.draft,item=state.catalog?.items.find(p=>p.id===d.selected);
  q('[data-status]').textContent=state.error||state.notice;q('[data-status]').classList.toggle('preset-error',Boolean(state.error));
  q('[data-file-label]').textContent=(d.id||'新预设')+'.json';
  try{q('[data-editor-title]').textContent=parseDraft().name||'新建'+MODEL_PRESETS.labels[state.kind]+'预设';}catch{}
  q('[data-form-panel]').hidden=state.mode!=='form';q('[data-json-panel]').hidden=state.mode!=='json';
  for(const button of dialog.querySelectorAll('[data-mode]'))button.setAttribute('aria-selected',String(button.dataset.mode===state.mode));
  syncEditor(editor,d.raw,'json',state.busy);
  q('[data-dirty]').textContent=d.selected?'修改自动保存 · 下次调用生效':'填写文件路径、名称与连接信息后自动创建';
  if(dirtyDrafts().length>1)q('[data-dirty]').textContent+=' · 另有 '+(dirtyDrafts().length-1)+' 份草稿';
  for(const control of dialog.querySelectorAll('button,input,select,textarea'))control.disabled=state.busy;
  q('[data-field=id]').disabled=state.busy||Boolean(d.selected)||state.saveState==='saving';
  q('[data-save]').hidden=false;q('[data-save]').textContent=state.saveState==='error'?PRESET_EDITOR.actions.retry:d.selected?PRESET_EDITOR.actions.save:PRESET_EDITOR.actions.create;
  q('[data-clone]').disabled=state.busy||!item||state.saveState==='saving';q('[data-rename-preset]').disabled=state.busy||!item||state.saveState==='saving';
  q('[data-discard]').hidden=!isDirty(d);
  q('[data-save]').disabled=state.busy||state.saveState==='saving'||Boolean(d.selected&&!isDirty(d));q('[data-discard]').disabled=state.busy||state.saveState==='saving';
  q('[data-delete]').disabled=state.busy||!item||references(item.id);
  q('[data-autosave]').textContent=state.busy?'加载中…':!d.selected&&state.saveState==='saved'?'待创建':({pending:'等待保存…',saving:'保存中…',saved:'已保存',error:'未保存'})[state.saveState];
  q('[data-refresh]').hidden=state.saveState!=='error';
  q('.preset-route').hidden=state.screen!=='routing';q('[data-form]').hidden=state.screen!=='editor';q('[data-routing]').classList.toggle('active',state.screen==='routing');
  const ids=state.backups;
  q('[data-add-backup]').disabled=state.busy||!q('[data-backup-choice]').value||ids.length>=PRESET_EDITOR.maxBackups;
  for(const b of dialog.querySelectorAll('[data-backup-action]'))b.disabled=state.busy||(b.dataset.backupAction==='swap'&&!state.primary)||(b.dataset.backupAction==='up'&&Number(b.dataset.index)===0)||(b.dataset.backupAction==='down'&&Number(b.dataset.index)===ids.length-1);
  for(const button of q('[data-list]').querySelectorAll('[data-preset]')){
   const id=button.dataset.preset;
   button.querySelector('small').textContent=id+(state.catalog.bindings[state.kind]===id?' · 主预设':'')+(isDirty(drafts.get(id))?' · 未保存':'');
  }
  modelList?.refreshControls();renderKeyNote();
 }
 registry.subscribe(['draft','mode','busy','error','notice','primary','backups','screen','saveState'],renderControls,false);
 async function refresh(preferred=state.draft?.selected){
  const c=await api(MODEL_PRESETS.api);state.catalog=c;state.primary=c.bindings[state.kind]||'';state.backups=[...(c.fallbacks?.[state.kind]||[])];
  updateSummary(c);
  selectPreset(preferred&&c.items.some(p=>p.id===preferred&&p.kind===state.kind)?preferred:state.primary||c.items.find(p=>p.kind===state.kind)?.id);
  state.error=[c.configError,...c.errors.map(e=>e.id+': '+e.error)].filter(Boolean).join('；');
 }
 function updateSummary(c){
  const summary=host.querySelector('[data-preset-summary]');summary.replaceChildren();summary.classList.add('preset-overview');
  for(const kind of MODEL_PRESETS.kinds){const preset=c.items.find(p=>p.id===c.bindings[kind]),button=document.createElement('button'),label=document.createElement('strong'),name=document.createElement('span'),meta=document.createElement('span');button.type='button';label.textContent=MODEL_PRESETS.labels[kind];name.textContent=preset?.name||'未配置';meta.className='preset-overview-meta';meta.textContent=(c.fallbacks?.[kind]||[]).length+' 个备用  ↗';button.append(label,name,meta);button.onclick=async()=>{await open();switchKind(kind);};summary.append(button);}

 }
 async function run(action){if(state.busy)return;state.busy=true;state.error='';state.notice='';try{await action();}catch(e){state.error=e.message;}finally{state.busy=false;}}
 function switchKind(kind){
  if(state.busy||kind===state.kind)return;
  const change=()=>{state.kind=kind;state.primary=state.catalog?.bindings[kind]||'';state.backups=[...(state.catalog?.fallbacks?.[kind]||[])];selectPreset(state.primary||candidates()[0]?.id);reveal(q('#presetKindPanel'));};
  guard(change);
 }
 for(const b of dialog.querySelectorAll('[data-kind]'))b.onclick=()=>switchKind(b.dataset.kind);
 q('.preset-kind-tabs').onkeydown=e=>{if(!['ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const kinds=MODEL_PRESETS.kinds,index=kinds.indexOf(state.kind),next=e.key==='Home'?kinds[0]:e.key==='End'?kinds.at(-1):kinds[(index+(e.key==='ArrowRight'?1:kinds.length-1))%kinds.length];switchKind(next);q('[data-kind="'+next+'"]').focus();};
 q('[data-new]').onclick=()=>guard(()=>selectPreset(null));
 q('[data-routing]').onclick=()=>guard(()=>{state.screen='routing';renderLibrary();});
 q('[data-primary]').onchange=e=>{
  if(state.backups.includes(e.target.value)){e.target.value=state.primary;state.error='该预设已在备用列表，请先移除再选为主预设。';return;}
  state.primary=e.target.value;state.error='';renderBackups();renderRouteSummary();autosave.schedule();
 };
 q('[data-backup-choice]').onchange=renderControls;
 q('[data-add-backup]').onclick=()=>{const id=q('[data-backup-choice]').value;if(!id||state.backups.includes(id)||id===state.primary)return;state.backups=[...state.backups,id];renderBackups();renderRouteSummary();autosave.schedule();};
 mountPresetOrder(q('[data-backups]'),{canStart:()=>!state.busy&&state.saveState!=='saving',commit:ids=>{if(ids.length!==state.backups.length||ids.some(id=>!state.backups.includes(id))){renderBackups();return;}if(JSON.stringify(ids)!==JSON.stringify(state.backups)){state.backups=ids;renderBackups();renderRouteSummary();autosave.schedule();}else renderBackups();},cancel:renderBackups});
 q('[data-backups]').onclick=e=>{const b=e.target.closest('[data-backup-action]');if(!b)return;const ids=[...state.backups],i=Number(b.dataset.index);if(b.dataset.backupAction==='swap'){if(i!==0||!state.primary)return;const original=state.primary;state.primary=ids[0];ids[0]=original;}else if(b.dataset.backupAction==='remove')ids.splice(i,1);else{const j=i+(b.dataset.backupAction==='up'?-1:1);[ids[i],ids[j]]=[ids[j],ids[i]];}state.backups=ids;renderLibrary();autosave.schedule();};
 q('[data-fields]').addEventListener('input',e=>{
  if(e.target.dataset.field==='name')mutate(doc=>{doc.name=e.target.value;});
  else if(e.target.dataset.setting){
   if(['base_url','api_key'].includes(e.target.dataset.setting)){connectionRevision++;modelList?.invalidateDiscovery();}
   const f=PRESET_EDITOR.fields.find(f=>f.path===e.target.dataset.setting),raw=e.target.value;
   const value=f.type==='password'?raw:raw===''?undefined:f.type==='number'?Number(raw):f.type==='boolean'?raw==='true':raw;
   mutate(doc=>writePath(doc.settings,f.path,value));
  }
 });
 q('[data-fields]').onclick=e=>{if(e.target.closest('[data-keep-key]')){connectionRevision++;modelList?.invalidateDiscovery();mutate(doc=>{doc.settings.api_key=null;});q('[data-setting=api_key]').value='';}};
 q('[data-field=id]').oninput=e=>{state.draft.id=e.target.value;autosave.schedule();};
 q('[data-add-retry]').onclick=()=>{mutate(doc=>{const rules=doc.settings.retry??={};const entries=rules.retries_by_error??={};let key='error';while(Object.hasOwn(entries,key))key+='_';entries[key]=1;});renderRetryRules();};
 q('[data-retry-rules]').addEventListener('change',e=>{
  const key=e.target.dataset.retryKey,value=e.target.dataset.retryValue;
  if(key===undefined&&value===undefined)return;
  const index=Number(key??value);mutate(doc=>{const entries=Object.entries(doc.settings.retry.retries_by_error);if(key!==undefined){const next=e.target.value.trim();if(!next||entries.some(([k],i)=>i!==index&&k===next))throw Error('错误类型不能为空或重复');entries[index][0]=next;}else entries[index][1]=Number(e.target.value);doc.settings.retry.retries_by_error=Object.fromEntries(entries);});renderRetryRules();
 });
 q('[data-retry-rules]').onclick=e=>{const b=e.target.closest('[data-remove-retry]');if(!b)return;mutate(doc=>{const entries=Object.entries(doc.settings.retry.retries_by_error);entries.splice(Number(b.dataset.removeRetry),1);doc.settings.retry.retries_by_error=Object.fromEntries(entries);});renderRetryRules();};
 for(const b of dialog.querySelectorAll('[data-mode]'))b.onclick=()=>{
  if(b.dataset.mode==='form'){try{parseDraft();renderForm();}catch(e){state.error=e.message;return;}}
  state.mode=b.dataset.mode;renderControls();if(state.mode==='json')requestAnimationFrame(()=>editor.refresh());reveal(q(state.mode==='json'?'[data-json-panel]':'[data-form-panel]'));
 };
 q('[data-format]').onclick=()=>{try{state.draft.raw=pretty(parseDraft());state.error='';autosave.schedule();}catch(e){state.error=e.message;}};
 q('[data-discard]').onclick=()=>ask('撤销当前预设的未保存修改？',()=>{const key=state.draft.selected||'new:'+state.kind;drafts.delete(key);selectPreset(state.draft.selected);});
 const autosave=createAutosave(async()=>{
  for(const d of dirtyDrafts()){
   const doc=validateDraft(d),id=d.id.trim();
   const sent=fingerprint(d),key=d.selected||'new:'+d.kind;
   const result=await api(MODEL_PRESETS.api,{method:'POST',body:{id,revision:d.revision,preset:doc}});
   d.revision=result.preset.revision;d.selected=id;
   if(fingerprint(d)===sent){d.id=id;if(doc.settings.api_key!=null){doc.settings.api_key=null;d.raw=pretty(doc);}d.original=fingerprint(d);}
   else d.original=sent;
   drafts.delete(key);drafts.set(id,d);
   const items=state.catalog.items.filter(p=>p.id!==id);state.catalog={...state.catalog,items:[...items,result.preset]};
   // Do not rebuild the form, reset scroll, replace typed input, or lock controls.
   if(state.draft===d&&doc.settings.api_key!=null&&parseDraft(d).settings.api_key==null){const input=q('[data-setting=api_key]');if(input)input.value='';}
  }
  if(routeDirty()){
   if(!state.primary)throw Error('请选择主模型，修改尚未保存。');
   const c=await api(MODEL_PRESETS.api+'/bindings',{method:'POST',body:{kind:state.kind,primary:state.primary,fallbacks:[...state.backups],revision:state.catalog.configRevision}});
   state.catalog=c;
  }
  renderLibrary();updateSummary(state.catalog);void Promise.resolve(onApplied()).catch(()=>{});
 },{delay:PRESET_EDITOR.autosaveMs,onState:(value,error)=>{state.saveState=value;state.error=error?.message||'';}});
 q('[data-form]').onsubmit=e=>{e.preventDefault();try{validateDraft(state.draft);}catch(error){state.error=error.message;state.saveState='error';const selector=error.field==='id'?'[data-field=id]':error.field==='name'?'[data-field=name]':error.field==='settings.model'?'[data-model-id]':error.field?'[data-setting="'+error.field.replace('settings.','')+'"]':null;const input=selector&&q(selector);if(input&&!input.closest('[hidden]')){input.scrollIntoView({block:'center'});input.focus();}return;}void autosave.flush();};
 q('[data-rename-preset]').onclick=()=>guard(()=>{
  const item=state.catalog.items.find(p=>p.id===state.draft.selected);if(!item)return;
  ask('重命名源文件后，主预设和备用预设的引用会同步更新。',null);
  renameSource={source:item.id,revision:item.revision,configRevision:state.catalog.configRevision};
  q('[data-rename-label]').hidden=false;const input=q('[data-rename-path]');input.value=item.id+'.json';input.focus();input.setSelectionRange(item.id.lastIndexOf('/')+1,item.id.length);
 });
 q('[data-rename-path]').onkeydown=e=>{if(e.key==='Enter'){e.preventDefault();void renamePreset();}};
 async function renamePreset(){
  if(!renameSource||state.busy)return;const target=q('[data-rename-path]').value.trim().replace(/\.json$/i,'');
  if(!target){q('[data-rename-error]').textContent='请填写文件名称。';q('[data-rename-path]').focus();return;}
  state.busy=true;q('[data-rename-error]').textContent='';
  try{const source=renameSource.source;const result=await api(MODEL_PRESETS.api+'/rename',{method:'POST',body:{...renameSource,target}});drafts.delete(source);drafts.delete(result.preset.id);await refresh(result.preset.id);renameSource=null;setPanelVisible(q('.preset-confirm'),false);state.notice='源文件已重命名为 '+result.preset.id+'.json';}
  catch(error){q('[data-rename-error]').textContent=error.message;}
  finally{state.busy=false;}
 }
 q('[data-clone]').onclick=()=>guard(()=>run(async()=>{const source=state.draft.selected;if(!source)return;const item=state.catalog.items.find(p=>p.id===source);const result=await api(MODEL_PRESETS.api+'/clone',{method:'POST',body:{source,revision:item.revision}});await refresh(result.preset.id);state.notice='已克隆为 '+result.preset.id+'.json';}));
 q('[data-delete]').onclick=()=>{const id=state.draft.selected,item=state.catalog.items.find(p=>p.id===id);if(!item)return;ask('删除预设「'+item.name+'」及其当前草稿？',()=>run(async()=>{if(!await autosave.flush())throw Error('请先处理未保存的修改，再删除预设。');const current=state.catalog.items.find(p=>p.id===id);await api(MODEL_PRESETS.api,{method:'DELETE',body:{id,revision:current.revision}});drafts.delete(id);await refresh();state.notice='预设已删除。';}));};
 q('[data-folder]').onclick=()=>guard(()=>{closeDialog(dialog);openDirectory();});
 async function open(){showDialog(dialog);if(!state.catalog||!dirty()&&state.saveState!=='saving')await run(()=>refresh());else renderControls();if(state.mode==='json')requestAnimationFrame(()=>editor.refresh());}
 host.querySelector('[data-manage-presets]').onclick=open;
 host.querySelector('[data-preset-folder]').onclick=()=>guard(openDirectory);
 const reload=()=>ask('读取云端版本会放弃当前未保存的修改，确认继续？',()=>{drafts.clear();state.saveState='saved';run(()=>refresh());});
 q('[data-refresh]').onclick=reload;host.querySelector('[data-reload-presets]').hidden=true;
 window.addEventListener('beforeunload',e=>{if(dirty()){e.preventDefault();e.returnValue='';}});
 run(()=>refresh());
 return {open};
}
