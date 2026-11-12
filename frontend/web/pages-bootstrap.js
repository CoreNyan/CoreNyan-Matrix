// Pages and native clients use the same UI; only transport setup differs.
window.matrixReady=(async()=>{
 const response=await fetch('/contracts/product.json',{cache:'no-cache'});
 if(!response.ok)throw Error('无法加载连接配置');
 const product=await response.json();
 const remote=location.origin!==new URL(product.serverUrl).origin&&(product.webOrigins||[]).includes(location.origin);
 window.matrixPages=remote;
 if(!remote)return;
 if(!('serviceWorker' in navigator)||!isSecureContext)throw Error('请使用 HTTPS 打开 CoreNyan');
 await navigator.serviceWorker.register('/matrix-sw.js',{scope:'/',updateViaCache:'none'});
 await navigator.serviceWorker.ready;
 if(!navigator.serviceWorker.controller)await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(Error('连接初始化超时，请刷新页面')),15000);
  navigator.serviceWorker.addEventListener('controllerchange',()=>{clearTimeout(timer);resolve();},{once:true});
  if(navigator.serviceWorker.controller){clearTimeout(timer);resolve();}
 });
 if(!/^\/login(?:\/|\.html|$)/.test(location.pathname)){
  const check=await fetch('/api/auth/check',{cache:'no-store'});
  if(check.status===401){location.replace('/login/?next='+encodeURIComponent(location.pathname+location.search));await new Promise(()=>{});}
  if(!check.ok)throw Error('暂时无法连接小可，请稍后重试');
 }
})();
window.matrixReady.catch(error=>{const target=document.querySelector('#error');if(target)target.textContent=error.message;});
