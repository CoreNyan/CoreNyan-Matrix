// Pages and native clients share readiness; only authenticated transport differs.
window.matrixReady=(async()=>{
 const boot=window.MatrixBoot;
 const deadline=(promise,ms=15000)=>{let timer;return Promise.race([promise,new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('连接超时，请检查网络后重试')),ms);})]).finally(()=>clearTimeout(timer));};
 let stage='config';boot?.begin(stage);
 try{
  const response=await fetch('/contracts/product.json',{cache:'no-cache',signal:AbortSignal.timeout(15000)});
  if(!response.ok)throw Error('无法加载连接配置');
  const product=await response.json();boot?.done(stage);
  stage='connection';boot?.begin(stage);
  const pageOrigin=location.protocol==='http:'?'https://'+location.host:location.origin;
  const remote=pageOrigin!==new URL(product.serverUrl).origin&&(product.webOrigins||[]).includes(pageOrigin);
  window.matrixPages=remote;
  if(remote){
   if(location.protocol!=='https:'){location.replace('https://'+location.host+location.pathname+location.search+location.hash);await new Promise(()=>{});}
   if(!('serviceWorker' in navigator)||!isSecureContext)throw Error('请使用 HTTPS 打开 CoreNyan');
   await deadline(navigator.serviceWorker.register('/matrix-sw.js',{scope:'/',updateViaCache:'none'}));
   await deadline(navigator.serviceWorker.ready);
   if(!navigator.serviceWorker.controller)await new Promise((resolve,reject)=>{
    const changed=()=>{if(navigator.serviceWorker.controller){cleanup();resolve();}};
    const cleanup=()=>{clearTimeout(timer);navigator.serviceWorker.removeEventListener('controllerchange',changed);};
    const timer=setTimeout(()=>{cleanup();reject(Error('连接初始化超时，请重新连接'));},15000);
    navigator.serviceWorker.addEventListener('controllerchange',changed);changed();
   });
  }
  const login=/^\/login(?:\/|\.html|$)/.test(location.pathname);
  const check=await fetch('/api/auth/check',{cache:'no-store',signal:AbortSignal.timeout(15000)});
  if(check.status===401&&!login){location.replace('/login?next='+encodeURIComponent(location.pathname+location.search));await new Promise(()=>{});}
  if(!check.ok&&!(login&&check.status===401))throw Error('暂时无法连接小可，请检查网络后重试');
  boot?.done(stage);
 }catch(error){boot?.fail(stage,error);throw error;}
})();
window.matrixReady.catch(error=>{const target=document.querySelector('#error');if(target)target.textContent=error.message;});
