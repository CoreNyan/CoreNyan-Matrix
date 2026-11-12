'use strict';
// Keep API/media URLs same-origin for the UI. No responses or private files are cached.
const DB='corenyan-pages-auth',STORE='session';
const config=fetch('/contracts/product.json',{cache:'no-store'}).then(r=>{if(!r.ok)throw Error('CONFIG_UNAVAILABLE');return r.json();});
function session(value){return new Promise((resolve,reject)=>{
 const request=indexedDB.open(DB,1);request.onupgradeneeded=()=>request.result.createObjectStore(STORE);
 request.onerror=()=>reject(request.error);request.onsuccess=()=>{
  const db=request.result,tx=db.transaction(STORE,value===undefined?'readonly':'readwrite'),store=tx.objectStore(STORE);
  const op=value===undefined?store.get('current'):value===null?store.delete('current'):store.put(value,'current');
  let result;op.onsuccess=()=>{result=op.result;};tx.oncomplete=()=>{db.close();resolve(result);};tx.onerror=()=>{db.close();reject(tx.error);};
 };
});}
self.addEventListener('install',event=>event.waitUntil(self.skipWaiting()));
self.addEventListener('activate',event=>event.waitUntil(self.clients.claim()));
const apiPath=p=>/^\/(api|auth)\//.test(p)||p==='/healthz'||p.startsWith('/assets/uploads/');
async function proxy(request,url){
 const product=await config,target=new URL(product.serverUrl);
 if(target.protocol!=='https:'||target.username||target.password)throw Error('INVALID_API_ENDPOINT');
 const headers=new Headers();for(const name of ['content-type','accept','range','if-range'])if(request.headers.has(name))headers.set(name,request.headers.get(name));
 headers.set('X-Matrix-Client','pages');headers.set('Accept','application/json');
 const current=await session();if(current?.token)headers.set('Authorization','Bearer '+current.token);
 const method=request.method;
 const response=await fetch(target.origin+url.pathname+url.search,{method,headers,body:['GET','HEAD'].includes(method)?undefined:await request.arrayBuffer(),credentials:'omit',cache:'no-store',redirect:'error'});
 if(url.pathname==='/auth/login'){
  const data=await response.json();
  if(response.ok&&data.token){await session({token:data.token});delete data.token;}
  return Response.json(data,{status:response.status,headers:{'Cache-Control':'no-store'}});
 }
 if(response.status===401||url.pathname==='/auth/logout'&&response.ok||url.pathname==='/auth/password'&&response.ok)await session(null);
 if(url.pathname==='/auth/logout'&&request.mode==='navigate'&&response.ok)return Response.redirect(self.location.origin+'/login/',303);
 const outputHeaders=new Headers(response.headers);outputHeaders.delete('set-cookie');outputHeaders.set('Cache-Control','no-store');
 return new Response(response.body,{status:response.status,statusText:response.statusText,headers:outputHeaders});
}
self.addEventListener('fetch',event=>{
 const url=new URL(event.request.url);if(url.origin!==self.location.origin)return;
 if(apiPath(url.pathname))event.respondWith(proxy(event.request,url).catch(()=>Response.json({ok:false,error:'无法连接小可，请检查网络后重试。'},{status:503})));
 else if(event.request.mode==='navigate'&&/^\/(?:VITALS|LAYERS|CORTEX|SYNAPSE|ENTITY|CHAT)(?:\/|$)/i.test(url.pathname))event.respondWith(fetch('/index.html',{cache:'no-cache'}));
});
