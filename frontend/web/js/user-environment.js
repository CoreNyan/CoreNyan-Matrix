let snapshot=null,inflight=null,owner='',epoch=0,lastAttempt=0;
const listeners=new Set(),preference=()=>`corenyan.location.${owner}`;
const enabled=()=>{try{return localStorage.getItem(preference())==='enabled';}catch{return false;}};
const emit=()=>{for(const listener of listeners)listener(snapshot);};
export function environmentFor(username){if(owner!==username){owner=username;epoch++;snapshot=null;inflight=null;lastAttempt=0;}return snapshot;}
export function onEnvironment(listener){listeners.add(listener);return ()=>listeners.delete(listener);}
export async function refreshEnvironment(interactive=false){
 if(!owner||(!interactive&&!enabled()))return snapshot;
 if(inflight)return inflight;
 if(!interactive&&Date.now()-lastAttempt<5*60*1000)return snapshot;
 const current=epoch;lastAttempt=Date.now();
 const job=(async()=>{
  if(!navigator.geolocation)throw Error('当前设备不支持定位');
  if(!interactive&&navigator.permissions){const p=await navigator.permissions.query({name:'geolocation'}).catch(()=>null);if(p?.state==='denied'){try{localStorage.removeItem(preference());}catch{}snapshot=null;emit();void fetch('/api/user-environment',{method:'DELETE'}).catch(()=>{});throw Error('定位权限已关闭');}if(p?.state==='prompt')return snapshot;}
  const position=await new Promise((resolve,reject)=>navigator.geolocation.getCurrentPosition(resolve,e=>reject(Error(e.code===1?'定位未授权，仍可使用时间问候':'暂时无法定位，可稍后再试')),{enableHighAccuracy:false,maximumAge:5*60*1000,timeout:10000}));
  if(current!==epoch)return snapshot;
  const {latitude,longitude,accuracy}=position.coords;
  const response=await fetch('/api/user-environment',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({consent:true,latitude,longitude,accuracy,timezone:Intl.DateTimeFormat().resolvedOptions().timeZone}),signal:AbortSignal.timeout(12000)});
  if(!response.ok)throw Error('天气暂时没有连上，可稍后再试');
  const data=await response.json();if(current!==epoch)return snapshot;
  snapshot=data.environment;try{localStorage.setItem(preference(),'enabled');}catch{}emit();return snapshot;
 })();inflight=job;try{return await job;}finally{if(inflight===job)inflight=null;}
}
export async function disableEnvironment(){
 const prior=inflight;epoch++;snapshot=null;inflight=null;try{localStorage.removeItem(preference());}catch{}emit();
 if(prior)await prior.catch(()=>{});
 await fetch('/api/user-environment',{method:'DELETE',signal:AbortSignal.timeout(5000)}).catch(()=>{});
}
// Refresh only while CHAT is actually visible, without interrupting typing or asking again.
setInterval(()=>{const shell=document.querySelector('.chat-shell');if(!document.hidden&&shell?.getClientRects().length)void refreshEnvironment().catch(()=>{});},60000);
export function environmentControls(){
 const wrap=document.createElement('div');wrap.className='chat-environment';
 const button=document.createElement('button');button.type='button';
 const source=document.createElement('a');source.href='https://www.met.no/en';source.target='_blank';source.rel='noopener noreferrer';source.textContent='MET Norway';
 const status=document.createElement('span');status.setAttribute('role','status');
 const paint=()=>{button.textContent=enabled()?'关闭位置共享':'启用位置与天气';button.title='向小可共享此设备的约略位置，用于天气问候；可随时关闭';source.hidden=!snapshot?.weather;status.textContent=snapshot?.weather?`${snapshot.weather.label} · ${snapshot.weather.temperature}°C`:snapshot?.location?'天气暂不可用':'';};
 button.onclick=async()=>{button.disabled=true;try{if(enabled())await disableEnvironment();else{status.textContent='正在获取位置…';await refreshEnvironment(true);}paint();}catch(e){status.textContent=e.message;}finally{button.disabled=false;}};
 wrap.append(button,status,source);paint();
 const unlisten=onEnvironment(()=>{if(wrap.isConnected)paint();else unlisten();});
 const observer=new IntersectionObserver(entries=>{if(entries.some(e=>e.isIntersecting)){observer.disconnect();void refreshEnvironment().then(paint).catch(()=>{});}});observer.observe(wrap);
 return wrap;
}
