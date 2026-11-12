import {icon,decorateSettings} from './ui-icons.js';
import {mountSoundSettings} from './sound-settings.js';
import {DASHBOARD_UI as D} from '../../../contracts/dashboard-ui.js';
import {MOBILE_UI} from './mobile-layout-config.js';
import {mountNotificationSettings} from './notification-settings.js';
import {mountAccounts} from './accounts.js';
import {showDialog,closeDialog,reveal} from './ui-motion.js';
import {SYSTEM_CONFIG} from './system-config.js';
import {mountPreferences,onPreferences,updatePreferences,syncPreferences,preferences,SHORTCUTS,binding,chord,normalizeChord} from './preferences.js';
export function mountSettings(registry,{openSystemConfig=async()=>false}={}){
 const dialog=document.createElement('dialog');dialog.id='settingsDialog';dialog.className='settings-dialog';
 const tabs=D.settingsTabs;
 dialog.innerHTML=`<header><button data-settings-back type="button" aria-label="返回设置列表"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m15 5-7 7 7 7"/></svg></button><div><small>偏好与管理</small><h2>${D.settings}</h2></div><button data-close type="button" aria-label="关闭设置"><svg viewBox="0 0 24 24" aria-hidden="true"><path d="m6 6 12 12M18 6 6 18"/></svg></button></header><div class="settings-layout"><nav aria-label="设置模块" role="tablist">${tabs.map(([id,label,detail],i)=>`${i===0?'<span class="settings-nav-label">'+D.global+'</span>':i===4?'<span class="settings-nav-label">'+D.personal+'</span>':''}<button id="settings-${id}-tab" role="tab" aria-controls="settings-${id}" data-tab="${id}">${icon(id)}<strong>${label}</strong><span>${detail}</span></button>`).join('')}</nav><div class="settings-content">${tabs.map(([id,label,detail],i)=>`<section id="settings-${id}" role="tabpanel" aria-labelledby="settings-${id}-tab" data-panel="${id}" hidden><header class="settings-panel-heading"><div><small>${i<4?D.global:D.personal}</small><h3>${label}</h3></div><span class="settings-scope">${i<4?'所有账号共用':'仅我的账号'}</span></header><div data-content="${id}"></div></section>`).join('')}</div></div>`;
 const q=s=>dialog.querySelector(s),content=id=>q('[data-content="'+id+'"]');
 content('models').innerHTML='<div class="settings-card" data-model-host></div>';
 content('account').innerHTML='<div data-account-list></div><p data-account-status role="status"></p>';
 content('assistant').innerHTML='<div class="settings-card" data-assistant-host></div><p data-global-status role="status"></p>';
 content('system').innerHTML='<div class="system-config-links" data-system-links></div><p data-system-status role="status"></p>';
 content('profile').innerHTML=`<div class="settings-card" data-profile-host></div><form class="settings-card" data-password-form><h4>修改密码</h4><div class="settings-form-grid"><label>当前密码<input name="current" type="password" autocomplete="current-password" maxlength="256" required></label><label>新密码<input name="password" type="password" autocomplete="new-password" minlength="16" maxlength="256" required></label><label>确认新密码<input name="confirm" type="password" autocomplete="new-password" minlength="16" maxlength="256" required></label></div><div class="settings-card-actions"><small>至少 16 位 · 修改后需重新登录</small><button type="submit">更新密码</button></div></form><p data-profile-status role="status"></p><form class="settings-signout" method="post" action="/auth/logout"><span>当前账号 <strong data-username>…</strong></span><button type="submit">退出登录</button></form>`;
 content('website').innerHTML=`<div class="settings-card"><h4>界面显示</h4><label class="settings-row"><span>界面比例</span><select data-display-scale><option value="auto">自动</option>${[100,110,120,125,150].map(v=>`<option value="${v}">${v}%</option>`).join('')}</select></label><label class="settings-row"><span>文字大小</span><select data-text-size><option value="standard">标准</option><option value="large">大字</option></select></label><label class="settings-row"><span>界面动效</span><input data-motion type="checkbox"></label></div><div class="settings-card"><h4>控制台</h4><label class="settings-row"><span>自动刷新日志</span><input data-poll type="checkbox"></label></div><div class="settings-card-actions"><p data-site-status role="status">正在读取账号设置…</p><button type="button" data-reset>恢复默认显示</button></div>`;
 content('shortcuts').innerHTML='<div class="settings-card-actions"><p data-shortcut-status role="status">点击组合键修改，Esc 取消</p><button data-reset-shortcuts>恢复默认</button></div><div data-shortcuts></div>';
 const soundSettings=mountSoundSettings(content('sounds'));
 dialog.querySelector('[data-tab=sounds]').addEventListener('click',()=>void soundSettings.load());
 const notificationSettings=mountNotificationSettings(content('notifications'));
 dialog.querySelector('[data-tab=notifications]').addEventListener('click',()=>void notificationSettings.load());
 document.body.append(dialog);mountAccounts(dialog);decorateSettings(dialog);
 let passwordBusy=false,mobileDetail=false,selectedTab='website';const compact=matchMedia(MOBILE_UI.query);
 function listView(){mobileDetail=false;dialog.classList.remove('settings-detail');q('h2').textContent=D.settings;if(dialog.open)reveal(q('nav'));for(const b of dialog.querySelectorAll('[data-tab]'))b.tabIndex=0;}
 q('[data-settings-back]').onclick=()=>{listView();q('[data-tab="'+selectedTab+'"]').focus({preventScroll:true});};
 compact.addEventListener('change',()=>{listView();if(!compact.matches)select(selectedTab);});
 const dirty=()=>[...dialog.querySelectorAll('[data-password-form] input,.account-create input')].some(e=>e.value);
 async function close(){if(passwordBusy)return;if(!await notificationSettings.flush()||!await soundSettings.flush())return;if(dirty()&&!confirm('表单尚未提交，放弃填写并关闭？'))return;q('[data-password-form]').reset();q('.account-create')?.reset();closeDialog(dialog);}
 q('[data-close]').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();if(compact.matches&&mobileDetail)listView();else close();});
 function select(tab){selectedTab=tab;mobileDetail=compact.matches;dialog.classList.toggle('settings-detail',mobileDetail);q('h2').textContent=mobileDetail?tabs.find(t=>t[0]===tab)[1]:D.settings;q('.settings-content').scrollTop=0;for(const b of dialog.querySelectorAll('[data-tab]')){b.setAttribute('aria-selected',String(b.dataset.tab===tab));b.tabIndex=b.dataset.tab===tab?0:-1;}for(const panel of dialog.querySelectorAll('[data-panel]')){const hidden=panel.dataset.panel!==tab,wasHidden=panel.hidden;panel.hidden=hidden;if(wasHidden&&!hidden)reveal(panel);}}
 for(const b of dialog.querySelectorAll('[data-tab]'))b.onclick=()=>select(b.dataset.tab);
 q('nav').addEventListener('keydown',e=>{if(!['ArrowDown','ArrowUp','ArrowLeft','ArrowRight','Home','End'].includes(e.key))return;e.preventDefault();const tabs=[...q('nav').querySelectorAll('[data-tab]')],i=tabs.indexOf(document.activeElement),n=e.key==='Home'?0:e.key==='End'?tabs.length-1:(i+(['ArrowDown','ArrowRight'].includes(e.key)?1:tabs.length-1))%tabs.length;select(tabs[n].dataset.tab);tabs[n].focus();});
 select('website');
 document.getElementById('btnSettings').onclick=()=>{if(compact.matches)listView();showDialog(dialog);void syncPreferences();};
 for(const entry of SYSTEM_CONFIG.entries){const b=document.createElement('button');b.type='button';const name=document.createElement('strong'),desc=document.createElement('span'),arrow=document.createElement('i');name.textContent=entry.label;desc.textContent=entry.description;arrow.textContent='↗';b.append(name,desc,arrow);b.onclick=async()=>{if(passwordBusy)return;if(dirty()&&!confirm('表单尚未提交，放弃填写并打开配置？'))return;q('[data-password-form]').reset();q('.account-create')?.reset();await closeDialog(dialog);try{await openSystemConfig(entry);}catch(error){showDialog(dialog);select('system');q('[data-system-status]').textContent=error.message;}};q('[data-system-links]').append(b);}
 const host=document.getElementById('modelPresetSection');q('[data-model-host]').append(host);host.hidden=false;
 host.querySelector('[data-preset-folder]').addEventListener('click',()=>closeDialog(dialog));
 document.addEventListener('click',e=>{if(e.target.closest('#modelPresetDialog [data-folder]')&&!document.getElementById('modelPresetDialog').open)closeDialog(dialog);});
 const set=patch=>{try{updatePreferences(patch);}catch(e){q('[data-site-status]').textContent=e.message;}};
 q('[data-display-scale]').onchange=e=>set({displayScale:e.target.value});q('[data-text-size]').onchange=e=>set({textSize:e.target.value});q('[data-motion]').onchange=e=>set({motion:e.target.checked});q('[data-poll]').onchange=e=>set({autoPoll:e.target.checked});
 q('[data-reset]').onclick=()=>set({displayScale:'auto',textSize:'standard',motion:true,autoPoll:true});
 const groups=new Map();let capturing=null;
 for(const a of SHORTCUTS){let group=groups.get(a.group);if(!group){group=document.createElement('div');group.className='settings-card shortcut-group';const h=document.createElement('h4');h.textContent=a.group;group.append(h);q('[data-shortcuts]').append(group);groups.set(a.group,group);}const row=document.createElement('div');row.className='shortcut-row';const name=document.createElement('span');name.textContent=a.label;const key=document.createElement('button'),reset=document.createElement('button');key.dataset.shortcut=a.id;key.setAttribute('aria-label',a.group+' '+a.label);reset.textContent='重置';reset.className='shortcut-reset';reset.onclick=()=>{try{setKey(a.id,a.defaultKey);}catch(error){q('[data-shortcut-status]').textContent=error.message;}};key.onclick=()=>{if(capturing)renderKeys();capturing=key;key.textContent='按下组合键…';};key.onkeydown=e=>{if(capturing!==key)return;e.preventDefault();e.stopPropagation();if(e.key==='Escape'){capturing=null;renderKeys();return;}if(['Control','Meta','Alt','Shift'].includes(e.key))return;try{setKey(a.id,normalizeChord(chord(e)));capturing=null;renderKeys();}catch(error){q('[data-shortcut-status]').textContent=error.message;}};key.onblur=()=>{if(capturing===key){capturing=null;renderKeys();}};row.append(name,key,reset);group.append(row);}
 function setKey(id,value){updatePreferences({['shortcuts.'+id]:value});q('[data-shortcut-status]').textContent='快捷键已更新';}
 function renderKeys(){for(const b of dialog.querySelectorAll('[data-shortcut]'))if(b!==capturing)b.textContent=binding(b.dataset.shortcut).replace('Mod',/Mac|iPhone|iPad/.test(navigator.platform)?'⌘':'Ctrl')||'未绑定';}
 q('[data-reset-shortcuts]').onclick=()=>{try{updatePreferences(Object.fromEntries(SHORTCUTS.map(a=>['shortcuts.'+a.id,a.defaultKey])));q('[data-shortcut-status]').textContent='已恢复默认快捷键';}catch(e){q('[data-shortcut-status]').textContent=e.message;}};
 onPreferences(p=>{q('[data-display-scale]').value=p.displayScale;q('[data-text-size]').value=p.textSize;q('[data-motion]').checked=p.motion;q('[data-poll]').checked=p.autoPoll;renderKeys();});
 document.addEventListener('corenyan:preferences',e=>{q('[data-site-status]').textContent=e.detail.message;for(const el of dialog.querySelectorAll('[data-panel=website] input,[data-panel=website] select,[data-reset],[data-shortcut],[data-reset-shortcuts],[data-notifications]'))el.disabled=!e.detail.ready;});
 mountPreferences(registry);
 q('[data-password-form]').onsubmit=async e=>{
  e.preventDefault();if(passwordBusy)return;const f=e.currentTarget,status=q('[data-profile-status]');
  if(f.elements.password.value!==f.elements.confirm.value){status.textContent='两次新密码不一致';return;}
  passwordBusy=true;f.querySelector('button').disabled=true;status.textContent='正在修改…';
  try{const response=await fetch('/auth/password',{method:'POST',headers:{'Accept':'application/json','Content-Type':'application/x-www-form-urlencoded'},body:new URLSearchParams(new FormData(f))});const data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||'密码修改失败');f.reset();location.assign('/login');}catch(error){status.textContent=error.message;}finally{passwordBusy=false;f.querySelector('button').disabled=false;}
 };
 window.addEventListener('beforeunload',e=>{if(dirty()){e.preventDefault();e.returnValue='';}});
 return {close};
}
