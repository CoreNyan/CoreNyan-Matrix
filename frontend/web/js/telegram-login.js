import {renderTerminalBlocks} from './terminal-blocks.js';
export function mountTelegramLogin(registry){
 const panel=document.createElement('section');panel.className='onebot-login-panel';panel.hidden=true;
 panel.innerHTML='<div class="onebot-login-heading"><strong>Telegram Bot</strong><p role="status"></p></div><div data-qr></div>';
 document.querySelector('#neuralLogTerminal').before(panel);
 const label=panel.querySelector('p'),code=panel.querySelector('[data-qr]');let generation=0,timer;
 function update(){
  clearTimeout(timer);const current=++generation;
  panel.hidden=document.hidden||registry.state.activeView!=='neural'||registry.state.logs.organ!=='corenyan-telegram';
  code.replaceChildren();if(panel.hidden)return;
  label.textContent='正在读取连接状态…';
  async function refresh(){
   let state={};try{const response=await fetch('/api/telegram/login',{cache:'no-store',signal:AbortSignal.timeout(5000)});if(response.ok)state=await response.json();}catch{}
   if(current!==generation)return;
   code.replaceChildren();panel.dataset.status=state.status||'unavailable';
   label.textContent=state.status==='online'?`已连接 · @${state.username} · 扫码打开聊天（不是账号登录码）`:state.status==='disabled'?'Telegram 模块未启用':state.status==='disconnected'?'Bot 已认证，消息轮询尚未连通':'无法确认 Bot 状态，请检查通信服务与配置';
   if(state.status==='online')code.innerHTML=renderTerminalBlocks(state.rows);
   timer=setTimeout(refresh,5000);
  }
  void refresh();
 }
 registry.subscribe(['activeView','logs.organ'],update);document.addEventListener('visibilitychange',update);update();
}
