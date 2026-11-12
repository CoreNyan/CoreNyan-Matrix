import {emptyRuleConfig,PRESET_LIMITS} from '../../../contracts/notification-presets.js';
import {emptyRules} from '../../../contracts/notification-rules.js';
import {mountRuleEditor} from './notification-rules.js';
const el=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
export function mountRulePresets(host,{channels,change,request}){
 let value=emptyRuleConfig(),selected='',editor;
 host.innerHTML='<section class="settings-card notification-card preset-rules"><header><div><small>CONDITION PRESETS</small><h4>条件预设</h4></div></header><div class="notification-fields"><label>编辑预设<select data-rule-preset></select></label><label>预设名称<input data-rule-name maxlength="60" placeholder="给条件取个名字"></label></div><div class="notification-actions"><button type="button" data-rule-add>＋ 新建</button><button type="button" data-rule-copy>复制</button><button type="button" data-rule-delete>删除</button></div><p role="status" data-preset-status></p><div data-preset-editor></div></section>';
 const q=s=>host.querySelector(s),current=()=>value.presets.find(p=>p.id===selected);
 function stash(){if(editor&&current())current().rules=editor.get();}
 function drawChannels(){for(const [key,container] of Object.entries(channels)){
  container.replaceChildren();container.className='channel-rule-choice';const c=value.channels[key];
  const mode=el('select');for(const [id,name] of [['all','全部新回复'],['selected','使用条件预设']]){const o=el('option',name);o.value=id;mode.append(o);}mode.value=c.mode;mode.setAttribute('aria-label',key==='system'?'系统通知筛选':'邮箱通知筛选');mode.dataset.channelMode=key;
  mode.onchange=()=>{c.mode=mode.value;drawChannels();change();};container.append(el('h4','通知条件'),mode);
  if(c.mode==='selected'){
   const list=el('div');list.className='preset-choice-list';
   for(const p of value.presets){const label=el('label'),box=el('input');box.type='checkbox';box.value=p.id;box.checked=c.ids.includes(p.id);box.onchange=()=>{c.ids=box.checked?[...c.ids,p.id]:c.ids.filter(id=>id!==p.id);change();};label.append(box,el('span',p.name+(p.rules.enabled?'':' · 未启用')));list.append(label);}
   if(!value.presets.length)list.append(el('p','先在上方新建条件预设。'));container.append(list);
   const combine=el('select');for(const [id,name] of [['any','或 · 任一所选预设命中'],['all','且 · 全部所选预设命中']]){const o=el('option',name);o.value=id;combine.append(o);}combine.value=c.combine;combine.setAttribute('aria-label','多个预设的关系');combine.onchange=()=>{c.combine=combine.value;change();};container.append(combine,el('p','未选择预设时不通知；未启用的预设不会命中。'));
  }
 }}
 function options(){const select=q('[data-rule-preset]');select.replaceChildren();for(const p of value.presets){const o=el('option',p.name);o.value=p.id;select.append(o);}select.value=selected;select.disabled=!value.presets.length;}
 function render(){options();const p=current();q('[data-rule-name]').value=p?.name||'';for(const s of ['[data-rule-name]','[data-rule-copy]','[data-rule-delete]'])q(s).disabled=!p;q('[data-rule-add]').disabled=value.presets.length>=PRESET_LIMITS.count;
  const target=q('[data-preset-editor]');target.replaceChildren();editor=null;if(p){editor=mountRuleEditor(target,{request,preset:true,change:()=>{stash();drawChannels();change();}});editor.set(p.rules);}else target.append(el('p','还没有条件预设。系统和邮箱可分别选择自己的通知条件。'));drawChannels();
 }
 function name(){for(let i=1;;i++){const n='条件预设 '+i;if(!value.presets.some(p=>p.name===n))return n;}}
 function add(copy=false){stash();if(value.presets.length>=PRESET_LIMITS.count)return;const p={id:crypto.randomUUID(),name:name(),rules:copy&&current()?structuredClone(current().rules):emptyRules()};value.presets.push(p);selected=p.id;render();change();}
 q('[data-rule-add]').onclick=()=>add();q('[data-rule-copy]').onclick=()=>add(true);
 q('[data-rule-preset]').onchange=e=>{stash();selected=e.target.value;render();};
 q('[data-rule-name]').oninput=e=>{if(current()){current().name=e.target.value;options();drawChannels();change();}};
 q('[data-rule-delete]').onclick=()=>{const p=current();if(!p)return;const used=Object.entries(value.channels).filter(([,c])=>c.ids.includes(p.id)).map(([k])=>k==='system'?'系统通知':'邮箱通知');if(!confirm('删除“'+p.name+'”？'+(used.length?'将移除'+used.join('、')+'中的引用；若没有其他所选预设，该渠道将不再通知。':'')))return;value.presets=value.presets.filter(x=>x.id!==p.id);for(const c of Object.values(value.channels))c.ids=c.ids.filter(id=>id!==p.id);selected=value.presets[0]?.id||'';render();change();};
 render();return {get:()=>{stash();return structuredClone(value);},set:config=>{value=structuredClone(config||emptyRuleConfig());if(!current())selected=value.presets[0]?.id||'';render();}};
}
