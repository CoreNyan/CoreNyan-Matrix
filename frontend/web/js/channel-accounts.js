import {showDialog,closeDialog} from './ui-motion.js';
import {mountOnebotLogin} from './onebot-login.js';
import {mountTelegramLogin} from './telegram-login.js';
import {mountBilibiliLogin} from './bilibili-login.js';

const channels=[
 {id:'qq',name:'QQ',caption:'即时消息',mark:'Q',description:'查看 QQ 连接状态与登录二维码。'},
 {id:'telegram',name:'Telegram',caption:'纸飞机',mark:'↗',description:'Bot 通过令牌连接；普通账号在启用该模式后扫码登录。'},
 {id:'bilibili',name:'Bilibili',caption:'哔哩哔哩',mark:'B',description:'管理小可的 B 站账号，支持国内版和国际版登录。'}
];
const labels={online:'已登录',qr:'等待扫码',scanned:'等待确认',verifying:'验证中',expired:'二维码过期',disabled:'模块关闭',disconnected:'连接断开',starting:'启动中',waiting:'等待登录',connecting:'连接中',unconfigured:'未登录',unverified:'待验证',password:'需要两步验证',owner_only:'仅主管理员',error:'登录失败',stale:'状态未更新',capture_error:'二维码不可用',unavailable:'暂不可用'};

export function mountChannelAccounts(registry,onOffline){
 const entry=document.createElement('section');entry.className='channel-account-entry';entry.hidden=true;
 entry.innerHTML='<div class="channel-entry-mark" aria-hidden="true">⌘</div><div><span class="channel-eyebrow">GATEWAY / ACCOUNTS</span><h3>渠道账号</h3><p>QQ · Telegram · Bilibili</p></div><button class="wire-action-btn" data-channel-open>管理账号 <span aria-hidden="true">↗</span></button>';
 document.querySelector('#neuralLogTerminal').before(entry);
 const dialog=document.createElement('dialog');dialog.className='channel-accounts-window';dialog.setAttribute('aria-labelledby','channelAccountsTitle');dialog.setAttribute('data-navigation-independent','');
 dialog.innerHTML='<header class="channel-window-header"><div><h2 id="channelAccountsTitle">渠道账号</h2><p>Gateway</p></div><button class="wire-action-btn" data-channel-close aria-label="关闭渠道账号">关闭 ×</button></header><div class="channel-window-body"><nav class="channel-account-list" aria-label="渠道账号列表"></nav><section class="channel-account-detail" aria-label="账号详情"><div class="channel-detail-heading"><h3 data-channel-title></h3><p data-channel-description></p></div><div data-channel-panels></div></section></div><footer class="channel-window-footer"><span data-channel-summary role="status">正在读取账号状态</span><button class="wire-action-btn" data-channel-refresh>刷新全部</button></footer>';
 document.body.append(dialog);
 const cards=new Map(),panels=new Map(),states=new Map(),controllers=[];let opened=false,selected='qq';
 const openButton=entry.querySelector('[data-channel-open]'),list=dialog.querySelector('.channel-account-list'),hosts=dialog.querySelector('[data-channel-panels]');
 for(const channel of channels){
  const card=document.createElement('button');card.type='button';card.className='channel-account-card';card.dataset.channel=channel.id;card.setAttribute('aria-controls','channel-panel-'+channel.id);
  card.innerHTML='<span class="channel-account-avatar"><span aria-hidden="true"></span><img alt="" hidden referrerpolicy="no-referrer"></span><span class="channel-account-copy"><span class="channel-account-platform"></span><strong></strong><span class="channel-account-id"></span><span class="channel-account-handle"></span><span class="channel-account-badges"><span class="channel-account-status"></span><span class="channel-account-module" hidden>工具未启用</span></span></span>';
  card.querySelector('.channel-account-avatar span').textContent=channel.mark;card.querySelector('.channel-account-platform').textContent=channel.name;card.querySelector('strong').textContent='读取中';card.querySelector('.channel-account-status').textContent='等待状态';
  list.append(card);cards.set(channel.id,card);const host=document.createElement('div');host.id='channel-panel-'+channel.id;host.dataset.channelPanel=channel.id;host.hidden=true;hosts.append(host);panels.set(channel.id,host);
  card.onclick=()=>select(channel.id,true);
 }
 function select(id,navigate=false){selected=id;const channel=channels.find(c=>c.id===id);for(const [key,card] of cards){card.setAttribute('aria-pressed',String(key===id));panels.get(key).hidden=key!==id;}
  dialog.querySelector('[data-channel-title]').textContent=channel.name+' · 登录管理';dialog.querySelector('[data-channel-description]').textContent=channel.description;
 }
 function receive(id,state){
  states.set(id,state);const card=cards.get(id),account=state.account||{};
  const uid=id==='qq'?account.qq:id==='telegram'?state.accountId:account.uid;
  const name=id==='qq'?account.nickname:id==='telegram'?(state.name||state.username):account.name;
  let avatar=id==='qq'&&uid?'https://q1.qlogo.cn/g?b=qq&nk='+encodeURIComponent(uid)+'&s=100':id==='telegram'?state.avatar:account.avatar;
  if(avatar&&!/^(https:\/\/(?:[^/]+\.)?(?:hdslb\.com|qlogo\.cn)\/|data:image\/(?:jpeg|png|webp);base64,)/.test(avatar))avatar='';
  const img=card.querySelector('img');if(img.dataset.source!==(avatar||'')){img.dataset.source=avatar||'';img.hidden=!avatar;if(avatar){img.onerror=()=>{img.hidden=true;};img.onload=()=>{img.hidden=false;};img.src=avatar;}else img.removeAttribute('src');}
  card.querySelector('strong').textContent=name||(state.status==='online'?'已登录账号':'尚未登录');card.querySelector('.channel-account-id').textContent=uid?'UID '+uid:'—';const handle=card.querySelector('.channel-account-handle');handle.hidden=!state.username;handle.textContent=state.username?'@'+state.username:'';
  const extra=id==='telegram'?state.mode==='user'?'普通账号':'Bot':id==='bilibili'?state.site==='international'?'国际版':'国内版':'';
  card.querySelector('.channel-account-platform').textContent=channels.find(c=>c.id===id).name+(extra?' / '+extra:'');
  card.dataset.status=state.status||'unavailable';card.querySelector('.channel-account-status').textContent=labels[state.status]||'暂不可用';card.querySelector('.channel-account-module').hidden=!(id==='bilibili'&&state.enabled===false);
  const online=[...states.values()].filter(s=>s.status==='online').length;dialog.querySelector('[data-channel-summary]').textContent=`${online} / ${channels.length} 个渠道已登录`;
 }
 const options=id=>({host:panels.get(id),isActive:()=>opened,onState:s=>receive(id,s)});
 controllers.push(mountOnebotLogin(registry,onOffline,options('qq')),mountTelegramLogin(registry,options('telegram')),mountBilibiliLogin(registry,options('bilibili')));
 function close(){opened=false;controllers.forEach(c=>c.update());void closeDialog(dialog).then(()=>{if(!opened)openButton.focus();});}
 openButton.onclick=()=>{opened=true;select(selected);void showDialog(dialog);controllers.forEach(c=>c.update());};
 dialog.querySelector('[data-channel-close]').onclick=close;dialog.addEventListener('cancel',e=>{e.preventDefault();close();});dialog.addEventListener('click',e=>{if(e.target===dialog){const r=dialog.getBoundingClientRect();if(e.clientX<r.left||e.clientX>r.right||e.clientY<r.top||e.clientY>r.bottom)close();}});
 dialog.querySelector('[data-channel-refresh]').onclick=()=>controllers.forEach(c=>c.refresh());
 function update(){entry.hidden=registry.state.activeView!=='neural'||registry.state.logs.organ!=='corenyan-gateway';if(entry.hidden&&opened)close();}
 registry.subscribe(['activeView','logs.organ'],update);select(selected);update();
}
