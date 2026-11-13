import {PRESET_EDITOR} from './constants.js';
import {mountPresetOrder} from './preset-order.js';
import {mountModelPicker} from './preset-model-picker.js';

// Keep the existing wire format; the editor has a single ordered source of truth.
export function readModelIds(settings){
 const ids=[settings.model??'',...(settings.fallback_models||[])];
 for(const legacy of [settings.fast_model,settings.fallback_model]){
  if(typeof legacy==='string'&&legacy.trim()&&!ids.some(id=>id.trim()===legacy.trim()))ids.push(legacy.trim());
 }
 return ids;
}
export function writeModelIds(settings,ids){
 settings.model=ids[0]??'';settings.fallback_models=ids.slice(1);
 delete settings.fast_model;delete settings.fallback_model;
}
export function validateModelIds(settings){
 const ids=readModelIds(settings);
 if(ids.length>PRESET_EDITOR.maxModelIds)throw Error('模型 ID 最多添加 '+PRESET_EDITOR.maxModelIds+' 个。');
 if(ids.some(id=>typeof id!=='string'||!id.trim()||id.length>200))throw Error('请填写每一项模型 ID，长度不超过 200 字符。');
 if(new Set(ids.map(id=>id.trim())).size!==ids.length)throw Error('模型 ID 不能重复。');
}
export function mountModelList(host,{settings,change,canStart,loadModels}){
 let serial=0,rows=readModelIds(settings).map(value=>({key:String(serial++),value})),picker;
 host.innerHTML='<div class="preset-model-heading"><strong>模型 ID</strong><small>第一项为主选，其余依次尝试</small></div><ol class="preset-model-list" aria-label="模型调用顺序"></ol><div class="preset-model-toolbar"><button type="button" data-add-model>＋ 添加模型</button></div><div data-model-picker></div>';
 const list=host.querySelector('ol'),add=host.querySelector('[data-add-model]');
 const emit=()=>change(rows.map(row=>row.value));
 const refreshControls=()=>{add.disabled=!canStart()||rows.length>=PRESET_EDITOR.maxModelIds;for(const button of list.querySelectorAll('button'))button.disabled=!canStart()||(button.hasAttribute('data-remove-model')&&rows.length===1);picker?.refresh();};
 function render(focusKey){
  list.replaceChildren(...rows.map((entry,index)=>{
   const row=document.createElement('li');row.dataset.modelRow=entry.key;
   const handle=document.createElement('button');handle.type='button';handle.dataset.modelDrag='';handle.className='preset-drag-handle';handle.title='拖动排序，也可用方向键上下移动';handle.setAttribute('aria-label','移动第 '+(index+1)+' 个模型');handle.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="M8 5h.01M16 5h.01M8 12h.01M16 12h.01M8 19h.01M16 19h.01"/></svg>';
   const label=document.createElement('label'),badge=document.createElement('span'),input=document.createElement('input');badge.className='preset-model-position';badge.textContent=index===0?'主选':'备用 '+index;input.type='text';input.value=entry.value;input.maxLength=200;input.autocomplete='off';input.spellcheck=false;input.dataset.modelId='';input.setAttribute('aria-label',(index===0?'主选':'备用 '+index)+'模型 ID');input.placeholder='输入模型 ID';label.append(badge,input);
   const remove=document.createElement('button');remove.type='button';remove.dataset.removeModel='';remove.setAttribute('aria-label','移除第 '+(index+1)+' 个模型');remove.title='移除模型';remove.innerHTML='<svg viewBox="0 0 24 24" aria-hidden="true"><path d="m7 7 10 10M17 7 7 17"/></svg>';
   input.oninput=()=>{entry.value=input.value;emit();};
   remove.onclick=()=>{if(rows.length<2)return;rows=rows.filter(r=>r!==entry);emit();render(rows[Math.min(index,rows.length-1)].key);};
   handle.onkeydown=e=>{const delta=e.key==='ArrowUp'?-1:e.key==='ArrowDown'?1:0;if(!delta)return;e.preventDefault();const target=index+delta;if(target<0||target>=rows.length||!canStart())return;[rows[index],rows[target]]=[rows[target],rows[index]];emit();render();list.querySelector('[data-model-row="'+entry.key+'"] [data-model-drag]').focus();};
   row.append(handle,label,remove);return row;
  }));refreshControls();if(focusKey!==undefined)list.querySelector('[data-model-row="'+focusKey+'"] input')?.focus();
 }
 add.onclick=()=>{if(!canStart()||rows.length>=PRESET_EDITOR.maxModelIds)return;const entry={key:String(serial++),value:''};rows.push(entry);emit();render(entry.key);};
 const order=mountPresetOrder(list,{rowSelector:'[data-model-row]',handleSelector:'[data-model-drag]',key:'modelRow',canStart,commit:keys=>{rows=keys.map(key=>rows.find(row=>row.key===key));emit();render();},cancel:()=>render()});
 picker=mountModelPicker(host.querySelector('[data-model-picker]'),{actions:host.querySelector('.preset-model-toolbar'),loadModels,canStart,currentIds:()=>rows.map(row=>row.value),available:()=>PRESET_EDITOR.maxModelIds-rows.filter(row=>row.value.trim()).length,append:ids=>{const existing=new Set(rows.map(row=>row.value.trim()));const additions=ids.filter(id=>!existing.has(id));if(!additions.length)return;rows=rows.filter(row=>row.value.trim());rows.push(...additions.map(value=>({key:String(serial++),value})));emit();render();}});
 render();return {refreshControls,invalidateDiscovery:()=>picker.invalidate(),destroy:()=>{order.destroy();picker.destroy();}};
}
