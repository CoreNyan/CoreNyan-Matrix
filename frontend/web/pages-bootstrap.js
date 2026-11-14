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
  stage='preferences';boot?.begin(stage);
  if(check.ok){
   const [{validatePreferences},response]=await Promise.all([
    import('/contracts/preference-schema.js'),
    fetch('/api/preferences',{cache:'no-store',signal:AbortSignal.timeout(15000)})
   ]);
   if(response.status===401){location.replace('/login');await new Promise(()=>{});}
   if(!response.ok)throw Error('账号设置同步失败，请重新连接');
   const data=await response.json();
   if(!data.ok||!Number.isSafeInteger(data.revision))throw Error('账号设置返回不完整，请重新连接');
   const values=validatePreferences(data.values),root=document.documentElement;
   window.matrixInitialPreferences={revision:data.revision,values};
   root.dataset.textSize=values.textSize;root.classList.toggle('motion-disabled',!values.motion);document.body.classList.toggle('motion-off',!values.motion);
   if(values.displayScale!=='auto')root.style.setProperty('--ui-scale',String(Number(values.displayScale)/100));
   window.MatrixTheme?.complete(values.theme);
   boot?.done(stage);
  }else{window.MatrixTheme?.complete(window.MatrixTheme.mode);boot?.skip(stage);}
 }catch(error){boot?.fail(stage,error);window.MatrixTheme?.complete(window.MatrixTheme.mode);throw error;}
})();
window.matrixReady.catch(error=>{const target=document.querySelector('#error');if(target)target.textContent=error.message;});
