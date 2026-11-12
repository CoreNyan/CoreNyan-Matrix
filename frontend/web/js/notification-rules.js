import {emptyRules,newCondition,RULE_LIMITS,validateRules} from '../../../contracts/notification-rules.js';
import {NOTIFICATIONS} from '../../../contracts/notifications.js';
const el=(tag,text)=>{const e=document.createElement(tag);if(text)e.textContent=text;return e;};
export function mountRuleEditor(host,{change,request,preset=false}){
 let value=emptyRules();
 host.innerHTML='<section class="settings-card notification-card rule-card"><header><div><small>匹配条件</small><h4>通知匹配规则</h4></div><label class="wire-check-label"><input type="checkbox" data-rule-enabled>启用筛选</label></header><p class="notification-note">同时用于邮箱和系统回复提醒。关闭筛选时，所有新回复都可通知。修改后自动保存。</p><div data-rule-tree></div><div class="rule-preview"><h4>试一条消息</h4><label>对话标题<input data-rule-title maxlength="120" placeholder="例如：寝室电费"></label><label>消息内容<textarea data-rule-text rows="3" maxlength="32000" placeholder="例如：寝室余额剩 2 元，记得充值呀"></textarea></label><div class="notification-actions"><button type="button" data-rule-test>测试匹配</button><span data-rule-result role="status"></span></div><p class="notification-note">这里只测试当前规则，不会发送通知。邮箱、系统的发送测试不受规则筛选。</p></div></section>';
 if(preset){host.querySelector('h4').textContent='预设条件';host.querySelector('header label').lastChild.textContent='启用预设';host.querySelector('.notification-note').textContent='编辑条件后，在系统通知或邮箱通知中勾选此预设。';}
 const q=s=>host.querySelector(s),changed=()=>{q('[data-rule-result]').textContent='';change();};
 function label(text,control){const l=el('label');l.append(el('span',text),control);return l;}
 function select(options,current,set){const s=el('select');for(const [id,name] of options){const o=el('option',name);o.value=id;s.append(o);}s.value=current;s.onchange=()=>{set(s.value);changed();};return s;}
 function check(text,current,set){const c=el('input');c.type='checkbox';c.checked=current;c.onchange=()=>{set(c.checked);changed();};const l=label(text,c);l.className='rule-check';return l;}
 function button(text,fn){const b=el('button',text);b.type='button';b.onclick=fn;return b;}
 function draw(n,parent,depth){
  const group=['all','any'].includes(n.op),box=el('div');box.className=group?'rule-group':'rule-condition';const head=el('div');head.className='rule-row';
  if(group)head.append(label('组内关系',select([['all','且 · 全部满足'],['any','或 · 任一满足']],n.op,v=>n.op=v)));
  else{
   head.append(label('匹配字段',select([['text','消息内容'],['title','对话标题']],n.field,v=>n.field=v)),label('匹配方式',select([['contains','包含文字'],['regex','正则表达式']],n.op,v=>{n.op=v;render();})));
  }
  head.append(check('非 · 取反',n.negate,v=>n.negate=v));
  if(parent){const remove=button('移除',()=>{parent.children.splice(parent.children.indexOf(n),1);render();changed();});remove.className='rule-remove';remove.setAttribute('aria-label',group?'移除条件组':'移除条件');head.append(remove);}
  box.append(head);
  if(group){
   const items=el('div');items.className='rule-children';for(const c of n.children)items.append(draw(c,n,depth+1));box.append(items);
   const actions=el('div');actions.className='notification-actions';
   function add(child){let count=0;const walk=x=>{count++;x.children?.forEach(walk);};walk(value.root);if(count>=RULE_LIMITS.nodes||depth>=RULE_LIMITS.depth){q('[data-rule-result]').textContent='最多 40 项、5 层，请先精简规则';return;}n.children.push(child);render();changed();}
   actions.append(button('＋ 条件',()=>add(newCondition())),button('＋ 条件组',()=>add({op:'any',negate:false,children:[]})));box.append(actions);
  }else{
   const input=el('input');input.type='text';input.maxLength=RULE_LIMITS.pattern;input.value=n.value;input.placeholder=n.op==='regex'?'例如：余额.*[0-9]+（不加 / 分隔符）':'输入需要包含的文字';input.setAttribute('aria-label','匹配内容');input.oninput=()=>{n.value=input.value;changed();};
   box.append(input,check('忽略英文大小写',n.ignoreCase,v=>n.ignoreCase=v));
  }
  return box;
 }
 function render(){q('[data-rule-enabled]').checked=value.enabled;q('[data-rule-tree]').replaceChildren(draw(value.root,null,1));}
 q('[data-rule-enabled]').onchange=e=>{value.enabled=e.target.checked;changed();};
 q('[data-rule-test]').onclick=async()=>{const b=q('[data-rule-test]');b.disabled=true;try{const rules=validateRules(value),d=await request(NOTIFICATIONS.api+'/rules/test',{method:'POST',body:JSON.stringify({rules,title:q('[data-rule-title]').value,text:q('[data-rule-text]').value})});q('[data-rule-result]').textContent=!rules.enabled?'筛选已关闭：所有新回复均可通知':d.matched?'命中规则 · 会通知':'未命中规则 · 不通知';}catch(e){q('[data-rule-result]').textContent=e.message;}finally{b.disabled=false;}};
 render();return {get:()=>structuredClone(value),set:rules=>{value=structuredClone(rules||emptyRules());render();}};
}
