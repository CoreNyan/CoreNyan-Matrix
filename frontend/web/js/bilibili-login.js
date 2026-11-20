import qrcode from '../vendor/qrcode.js';
export function mountBilibiliLogin(registry){
 const panel=document.createElement('section');panel.className='onebot-login-panel';panel.hidden=true;
 panel.innerHTML='<div class="onebot-login-heading"><strong>哔哩哔哩账号</strong><p role="status"></p></div><div data-code></div><button class="wire-action-btn" data-start>扫码登录</button> <button class="wire-action-btn" data-check hidden>检查登录状态</button>';
 document.querySelector('#neuralLogTerminal').before(panel);
 const label=panel.querySelector('p'),code=panel.querySelector('[data-code]'),start=panel.querySelector('[data-start]'),check=panel.querySelector('[data-check]');let generation=0,timer,expiry,busy=false;
 function render(s){
  clearTimeout(expiry);code.replaceChildren();panel.dataset.status=s.status||'unavailable';
  const messages={unconfigured:'尚未登录小可的 B 站账号。',unverified:'已保存账号，请检查登录是否有效。',qr:'用小可的 B 站账号扫码，并在手机上确认登录。',scanned:'已扫码，请在手机上确认。',verifying:'扫码确认成功，正在验证账号。',expired:'二维码已过期，请重新生成。'};
  if(s.ok===false){label.textContent=s.error==='OWNER_REQUIRED'?'仅主管理员可登录账号。':s.error==='BILI_LOGIN_BUSY'?'登录操作正在处理，请稍候。':s.error==='BILI_LOGIN_INVALID'?'登录已失效，请重新扫码。':'登录暂时不可用，请重试。';start.hidden=s.error==='OWNER_REQUIRED';check.hidden=true;return;}
  start.hidden=false;start.textContent=['qr','scanned','expired'].includes(s.status)?'重新生成二维码':s.status==='online'?'切换账号':'扫码登录';check.hidden=!['online','unverified'].includes(s.status);
  label.textContent=s.status==='online'?`已验证登录 · ${s.account.name} · UID ${s.account.uid}${s.enabled?'':' · B 站工具尚未启用'}`:messages[s.status]||'登录状态不可用。';
  if(['qr','scanned'].includes(s.status)&&s.expiresAt>Date.now()){
   let url;try{url=new URL(s.url);}catch{return;}
   if(!['https://passport.bilibili.com','https://account.bilibili.com'].includes(url.origin))return;
   const qr=qrcode(0,'M');qr.addData(s.url);qr.make();
   const container=document.createElement('div');container.className='terminal-block-image';container.innerHTML=qr.createSvgTag({cellSize:4,margin:16,scalable:true});const svg=container.querySelector('svg');svg.setAttribute('role','img');svg.setAttribute('aria-label','哔哩哔哩登录二维码');svg.style.cssText='width:240px;max-width:100%;height:auto;background:white';code.append(container);
   expiry=setTimeout(()=>{code.replaceChildren();label.textContent='二维码已过期，请重新生成。';clearTimeout(timer);},s.expiresAt-Date.now());
  }
 }
 async function request(action='status'){
  if(busy)return;busy=true;const current=generation;start.disabled=check.disabled=true;clearTimeout(timer);
  try{
   const response=await fetch('/api/bilibili/login',{method:action==='status'?'GET':'POST',cache:'no-store',...(action==='status'?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify({action})}),signal:AbortSignal.timeout(32000)});
   const state=await response.json();if(current!==generation)return;render(state);
   if(['qr','scanned','verifying'].includes(state.status)||state.error==='BILI_LOGIN_BUSY')timer=setTimeout(()=>request('poll'),3000);
  }catch{if(current===generation){code.replaceChildren();label.textContent='登录服务暂时不可用，请重试。';}}
  finally{busy=false;start.disabled=check.disabled=false;if(current!==generation&&!panel.hidden)void request();}
 }
 start.onclick=()=>request('start');check.onclick=()=>request('check');
 function update(){generation++;clearTimeout(timer);clearTimeout(expiry);code.replaceChildren();panel.hidden=document.hidden||registry.state.activeView!=='neural'||registry.state.logs.organ!=='corenyan-gateway';if(!panel.hidden)void request();}
 registry.subscribe(['activeView','logs.organ'],update);document.addEventListener('visibilitychange',update);update();
}
