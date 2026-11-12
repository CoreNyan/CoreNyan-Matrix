import {ONEBOT_LOGIN as C,UI} from './constants.js';
import {renderTerminalBlocks} from './terminal-blocks.js';
export function mountOnebotLogin(registry,onOffline=()=>{}){
 const panel=document.createElement('section');panel.className='onebot-login-panel';panel.hidden=true;
 panel.innerHTML='<div class="onebot-login-heading"><strong>QQ 登录</strong><p data-login-message role="status"></p></div><div class="onebot-account-card" data-login-account hidden><img data-login-avatar alt="QQ 头像"><div><span class="onebot-online-badge">已登录</span><strong data-login-name></strong><span data-login-qq></span></div></div><div data-login-code></div><button class="wire-action-btn" type="button">刷新状态</button>';
 document.querySelector('#neuralLogTerminal')?.before(panel);
 const history=document.createElement('p');history.className='onebot-lifecycle';panel.append(history);
 let wasOnline=false,lastNotice=0;
 const label=panel.querySelector('[data-login-message]'),code=panel.querySelector('[data-login-code]'),button=panel.querySelector('button');let timer,expiry,active=false,inflight=false,signature='';
 const clear=()=>{code.replaceChildren();signature='';};
 async function refresh(){
  if(inflight)return;inflight=true;
  try{const r=await fetch(C.api,{cache:'no-store'});if(!r.ok)throw Error('STATE_UNAVAILABLE');const state=await r.json();
   if(state.status==='online')wasOnline=true;
   else if(wasOnline&&state.lifecycle?.lastOfflineAt>lastNotice){lastNotice=state.lifecycle.lastOfflineAt;wasOnline=false;onOffline(C.offlineNotice);}
   if(!active)return;
   history.textContent=[['客户端启动',state.lifecycle?.clientStartedAt],['上次离线',state.lifecycle?.lastOfflineAt]].filter(([,v])=>v).map(([label,v])=>label+' · '+new Date(v).toLocaleString(UI.locale,{timeZone:UI.timezone,hour12:false})).join('　/　');history.hidden=!history.textContent;
   clearTimeout(expiry);label.textContent=state.message;panel.dataset.status=state.status;const card=panel.querySelector('[data-login-account]'),identity=state.status==='online'&&state.account;card.hidden=!identity;panel.querySelector('.onebot-login-heading').hidden=!!identity;if(identity){panel.querySelector('[data-login-name]').textContent=identity.nickname;panel.querySelector('[data-login-qq]').textContent='QQ '+identity.qq;const img=panel.querySelector('[data-login-avatar]'),src='https://q1.qlogo.cn/g?b=qq&nk='+encodeURIComponent(identity.qq)+'&s=100';if(img.dataset.qq!==identity.qq){img.dataset.qq=identity.qq;img.referrerPolicy='no-referrer';img.src=src;img.onerror=()=>{img.onerror=null;img.src='/assets/doodle/doodle_1.png';};}}
   if(state.status==='qr'&&state.rows&&state.expiresAt>Date.now()){
    const next=JSON.stringify(state.rows);if(next!==signature){code.innerHTML=renderTerminalBlocks(state.rows);signature=next;}
    expiry=setTimeout(()=>{clear();label.textContent='二维码状态已过期，正在获取最新画面…';},state.expiresAt-Date.now());
   }else clear();
  }catch{if(active){clear();panel.querySelector('[data-login-account]').hidden=true;panel.querySelector('.onebot-login-heading').hidden=false;panel.dataset.status='unavailable';label.textContent='暂时无法读取登录状态，稍后自动重试。';}}
  finally{inflight=false;}
 }
 function update(){clearInterval(timer);const next=registry.state.activeView==='neural'&&registry.state.logs.organ===C.layer;panel.hidden=!next;active=next;
  void refresh();timer=setInterval(()=>{if(!document.hidden)void refresh();},active?C.pollMs:C.backgroundPollMs);if(!active){clearTimeout(expiry);clear();}
 }
 button.onclick=()=>void refresh();registry.subscribe(['activeView','logs.organ'],update);document.addEventListener('visibilitychange',()=>{if(!document.hidden)void refresh();});update();
}
