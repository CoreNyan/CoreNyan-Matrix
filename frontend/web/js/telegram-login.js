import {renderTerminalBlocks} from './terminal-blocks.js';
export function mountTelegramLogin(registry){
 const panel=document.createElement('section');panel.className='onebot-login-panel';panel.hidden=true;
 panel.innerHTML='<div class="onebot-login-heading"><strong>Telegram Bot</strong><p role="status"></p></div><div data-qr></div>';
 document.querySelector('#neuralLogTerminal').before(panel);
 const label=panel.querySelector('p'),heading=panel.querySelector('strong'),code=panel.querySelector('[data-qr]');let generation=0,timer,expiry;
 function update(){
  clearTimeout(timer);clearTimeout(expiry);const current=++generation;
  panel.hidden=document.hidden||registry.state.activeView!=='neural'||registry.state.logs.organ!=='corenyan-telegram';
  code.replaceChildren();if(panel.hidden)return;
  label.textContent='正在读取连接状态…';
  async function refresh(){
   let state={};try{const response=await fetch('/api/telegram/login',{cache:'no-store',signal:AbortSignal.timeout(5000)});if(response.ok)state=await response.json();}catch{}
   if(current!==generation)return;
   clearTimeout(expiry);code.replaceChildren();panel.dataset.status=state.status||'unavailable';
   heading.textContent=state.mode==='user'?'Telegram 普通账号':state.status==='disabled'?'Telegram':'Telegram Bot';
   if(state.mode==='user'){
    const labels={qr:'用将要登录的 Telegram 账号打开「设置 → 设备 → 连接桌面设备」扫码',password:'需要两步验证：在服务器交互终端运行 docker exec -it corenyan-telegram python user_login.py password',connecting:'正在连接 Telegram…',owner_only:'只有主管理员可查看普通账号登录状态',unconfigured:'尚未配置 Telegram API ID / Hash',disconnected:'普通账号已断开'};
    label.textContent=state.status==='online'?`已登录 · ${state.username?'@'+state.username+' · ':''}ID ${state.accountId}（仅登录，不读取聊天）`:labels[state.status]||'登录状态不可用，正在等待刷新';
    if(state.status==='qr'&&state.expiresAt>Date.now()){
     code.innerHTML=renderTerminalBlocks(state.rows);
     expiry=setTimeout(()=>{code.replaceChildren();label.textContent='二维码已过期，正在刷新…';},state.expiresAt-Date.now());
    }
   }else{
   label.textContent=state.status==='online'?`已连接 · @${state.username} · 扫码打开聊天（不是账号登录码）`:state.status==='disabled'?'Telegram 模块未启用。普通账号扫码需在通信服务配置 TELEGRAM_MODE=user、API ID 和 API Hash 后启动。':state.status==='disconnected'?'Bot 已认证，消息轮询尚未连通':'无法确认 Bot 状态，请检查通信服务与配置';
   if(state.status==='online')code.innerHTML=renderTerminalBlocks(state.rows);
   }
   timer=setTimeout(refresh,5000);
  }
  void refresh();
 }
 registry.subscribe(['activeView','logs.organ'],update);document.addEventListener('visibilitychange',update);update();
}
