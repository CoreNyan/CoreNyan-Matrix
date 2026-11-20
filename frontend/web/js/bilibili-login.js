import qrcode from '../vendor/qrcode.js';
export function mountBilibiliLogin(registry,{host,isActive,onState=()=>{}}){
 const panel=document.createElement('section');panel.className='onebot-login-panel';panel.hidden=true;
 panel.innerHTML='<div class="onebot-login-heading"><strong>哔哩哔哩账号</strong><p role="status"></p><label>登录环境 <select class="wire-select" data-site aria-label="登录环境"><option value="domestic">国内版</option><option value="international">国际版（bilibili.com）</option></select></label></div><div data-code></div><button class="wire-action-btn" data-start>扫码登录</button> <button class="wire-action-btn" data-check hidden>检查登录状态</button>';
 host.append(panel);
 const label=panel.querySelector('p'),code=panel.querySelector('[data-code]'),start=panel.querySelector('[data-start]'),check=panel.querySelector('[data-check]'),site=panel.querySelector('[data-site]');let generation=0,timer,expiry,busy=false;
 function render(s){
  onState(s);
  clearTimeout(expiry);code.replaceChildren();panel.dataset.status=s.status||'unavailable';
  if(['domestic','international'].includes(s.site))site.value=s.site;
  const messages={unconfigured:'尚未登录小可的 B 站账号。',unverified:'已保存账号，请检查登录是否有效。',qr:'用小可的 B 站账号扫码，并在手机上确认登录。',scanned:'已扫码，请在手机上确认。',verifying:'扫码确认成功，正在验证账号。',expired:'二维码已过期，请重新生成。'};
  if(s.ok===false){const reasons={OWNER_REQUIRED:'仅主管理员可登录账号。',BILI_LOGIN_BUSY:'登录操作正在处理，请稍候。',BILI_LOGIN_INVALID:'登录已失效，请重新扫码。',BILI_CREDENTIALS_REQUIRED:'扫码结果缺少登录凭据，请重新扫码。',BILI_LOGIN_NETWORK_UNAVAILABLE:'服务器连接 B 站失败，请重试。',BILI_LOGIN_REDIRECT_INVALID:'扫码确认后的登录地址无法解析。',BILI_ACCOUNT_MISMATCH:'扫码账号与返回的登录账号不一致。',BILI_LOGIN_STORAGE_UNAVAILABLE:'服务器未能保存登录状态。',BILI_LOGIN_API_48007:'该账号不支持当前登录环境，请选择国际版后重新扫码。'};label.textContent=reasons[s.error]||'登录未完成。';if(/^BILI_[A-Z0-9_-]+$/.test(s.error||''))label.textContent+='（'+s.error+'）';start.hidden=s.error==='OWNER_REQUIRED';start.textContent='重新扫码';check.hidden=true;return;}
  start.hidden=false;start.textContent=['qr','scanned','expired'].includes(s.status)?'重新生成二维码':s.status==='online'?'切换账号':'扫码登录';check.hidden=!['online','unverified'].includes(s.status);
  label.textContent=s.status==='online'?'登录有效':messages[s.status]||'登录状态不可用。';
  if(['qr','scanned'].includes(s.status)&&s.expiresAt>Date.now()){
   let url;try{url=new URL(s.url);}catch{return;}
   if(!['https://passport.bilibili.com','https://account.bilibili.com'].includes(url.origin))return;
   const qr=qrcode(0,'M');qr.addData(s.url);qr.make();
   const container=document.createElement('div');container.className='terminal-block-image';container.innerHTML=qr.createSvgTag({cellSize:4,margin:16,scalable:true});const svg=container.querySelector('svg');svg.setAttribute('role','img');svg.setAttribute('aria-label','哔哩哔哩登录二维码');svg.style.cssText='width:240px;max-width:100%;height:auto;background:white';code.append(container);
   expiry=setTimeout(()=>{code.replaceChildren();label.textContent='二维码已过期，请重新生成。';clearTimeout(timer);},s.expiresAt-Date.now());
  }
 }
 async function request(action='status'){
  if(busy)return;busy=true;const current=generation;start.disabled=check.disabled=site.disabled=true;clearTimeout(timer);
  try{
   const response=await fetch('/api/bilibili/login',{method:action==='status'?'GET':'POST',cache:'no-store',...(action==='status'?{}:{headers:{'Content-Type':'application/json'},body:JSON.stringify({action,...(action==='start'?{site:site.value}:{})})}),signal:AbortSignal.timeout(32000)});
   const state=await response.json();if(current!==generation)return;render(state);
   if(['qr','scanned','verifying'].includes(state.status)||state.error==='BILI_LOGIN_BUSY')timer=setTimeout(()=>request('poll'),3000);
  }catch{if(current===generation){onState({status:'unavailable'});code.replaceChildren();label.textContent='登录服务暂时不可用，请重试。';}}
  finally{busy=false;start.disabled=check.disabled=site.disabled=false;if(current!==generation&&!panel.hidden)void request();}
 }
 start.onclick=()=>request('start');check.onclick=()=>request('check');
 site.onchange=()=>{clearTimeout(timer);clearTimeout(expiry);code.replaceChildren();label.textContent='已选择'+(site.value==='international'?'国际版':'国内版')+'，点击扫码登录生成新二维码。';start.textContent='扫码登录';};
 function update(){generation++;clearTimeout(timer);clearTimeout(expiry);code.replaceChildren();panel.hidden=document.hidden||!isActive();if(!panel.hidden)void request();}
 document.addEventListener('visibilitychange',update);update();return {update,refresh:()=>request()};
}
