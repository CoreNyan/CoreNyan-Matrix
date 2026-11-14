import {isIP} from 'node:net';

export const ENV_TTL=15*60*1000;
export function weatherKind(symbol=''){
 if(symbol.includes('thunder'))return ['thunder','雷雨'];
 if(/snow|sleet/.test(symbol))return ['snow','雨雪'];
 if(symbol.includes('rain'))return ['rain','有雨'];
 if(symbol.includes('fog'))return ['fog','有雾'];
 if(symbol.startsWith('clearsky')||symbol.startsWith('fair'))return ['clear','晴'];
 return ['cloudy','多云'];
}
export function coordinates(input){
 const {latitude,longitude,accuracy}=input||{};
 if(typeof latitude!=='number'||!Number.isFinite(latitude)||Math.abs(latitude)>90||typeof longitude!=='number'||!Number.isFinite(longitude)||Math.abs(longitude)>180)throw Error('INVALID_LOCATION');
 return {latitude:Math.round(latitude*100)/100,longitude:Math.round(longitude*100)/100,accuracy:typeof accuracy==='number'&&Number.isFinite(accuracy)&&accuracy>=0?Math.round(accuracy):null,precision:'约 1 公里（坐标已取整）',source:'device-reported'};
}
export function createUserEnvironment({fetcher=fetch,now=Date.now}={}){
 const sessions=new Map(),cache=new Map(),pending=new Map();
 const key=req=>req.auth?.id&&req.sessionKey?req.auth.id+':'+req.sessionKey:null;
 const put=(map,k,value)=>{map.delete(k);map.set(k,value);while(map.size>256)map.delete(map.keys().next().value);};
 async function weather(location){
  const k=location.latitude+','+location.longitude,cached=cache.get(k);
  if(cached&&cached.expiresAt>now())return cached;
  if(pending.has(k))return pending.get(k);
  if(pending.size>=4)throw Error('WEATHER_BUSY');
  const job=(async()=>{
   const response=await fetcher(`https://api.met.no/weatherapi/locationforecast/2.0/compact?lat=${location.latitude}&lon=${location.longitude}`,{headers:{'User-Agent':'CoreNyan/0.1 (+https://corenyan.fun)'},signal:AbortSignal.timeout(9000),redirect:'error'});
   if(!response.ok){await response.body?.cancel();throw Error('WEATHER_UNAVAILABLE');}
   let length=0;const chunks=[];
   for await(const chunk of response.body){length+=chunk.length;if(length>512*1024)throw Error('WEATHER_RESPONSE_LIMIT');chunks.push(chunk);}
   const data=JSON.parse(Buffer.concat(chunks).toString()),series=data.properties?.timeseries;
   const point=series?.find(p=>Math.abs(Date.parse(p.time)-now())<90*60*1000),details=point?.data?.instant?.details;
   if(!details||!Number.isFinite(details.air_temperature))throw Error('WEATHER_DATA_UNAVAILABLE');
   const symbol=(point.data.next_1_hours||point.data.next_6_hours)?.summary?.symbol_code;
   if(!symbol)throw Error('WEATHER_DATA_UNAVAILABLE');
   const [kind,label]=weatherKind(symbol),value={kind,label,temperature:details.air_temperature,humidity:details.relative_humidity,windSpeed:details.wind_speed,windUnit:'m/s',forecastAt:point.time,fetchedAt:now(),expiresAt:now()+ENV_TTL,source:'MET Norway',sourceUrl:'https://www.met.no/en',isForecast:true};
   put(cache,k,value);return value;
  })();pending.set(k,job);try{return await job;}finally{pending.delete(k);}
 }
 function snapshot(req){
  const id=key(req),entry=id?sessions.get(id):null,valid=entry&&entry.expiresAt>now();
  if(entry&&!valid)sessions.delete(id);
  const raw=String(req.headers['x-matrix-client-ip']||'').replace(/^::ffff:/,''),ip=isIP(raw)?raw:null;
  return {accountId:req.auth?.id,capturedAt:now(),expiresAt:valid?entry.expiresAt:now()+ENV_TTL,ip,ipSource:ip?'connection-egress':null,location:valid?entry.location:null,weather:valid&&entry.weather?.expiresAt>now()?entry.weather:null,locationStatus:valid?'available':'not_shared',weatherStatus:valid?entry.weatherStatus:'location_required',timezone:valid?entry.timezone:null,notice:'IP 是连接出口，可能属于 VPN/代理；设备位置由用户授权上报，不能据此推断精确住址。'};
 }
 async function handle(req,res,url){
  if(url.pathname!=='/api/user-environment')return false;
  const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(data));return true;};
  const id=key(req);if(!id)return reply(401,{ok:false,error:'AUTH_REQUIRED'});
  if(req.method==='GET')return reply(200,{ok:true,environment:snapshot(req)});
  if(req.method==='DELETE'){sessions.delete(id);return reply(200,{ok:true,environment:snapshot(req)});}
  if(req.method!=='POST')return reply(405,{ok:false,error:'METHOD_NOT_ALLOWED'});
  try{
   let size=0,parts=[];for await(const chunk of req){size+=chunk.length;if(size>4096)return reply(413,{ok:false,error:'REQUEST_TOO_LARGE'});parts.push(chunk);}
   const input=JSON.parse(Buffer.concat(parts).toString());if(input.consent!==true)throw Error('LOCATION_CONSENT_REQUIRED');
   const location=coordinates(input),previous=sessions.get(id);let timezone=null;
   if(typeof input.timezone==='string'&&input.timezone.length<80){try{new Intl.DateTimeFormat('en',{timeZone:input.timezone});timezone=input.timezone;}catch{}}
   if(previous&&now()-previous.updatedAt<30000)return reply(200,{ok:true,environment:snapshot(req)});
   const entry={location,timezone,updatedAt:now(),expiresAt:now()+ENV_TTL,weather:null,weatherStatus:'unavailable'};put(sessions,id,entry);
   try{entry.weather=await weather(location);entry.weatherStatus='available';}catch{entry.weatherStatus='temporarily_unavailable';}
   return reply(200,{ok:true,environment:snapshot(req)});
  }catch{return reply(400,{ok:false,error:'INVALID_LOCATION_REQUEST'});}
 }
 return {handle,snapshot};
}
