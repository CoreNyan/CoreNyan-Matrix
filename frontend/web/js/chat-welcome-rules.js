const minute=value=>typeof value==='string'&&/^(?:[01]\d|2[0-3]):[0-5]\d$/.test(value)?Number(value.slice(0,2))*60+Number(value.slice(3)):null;
export function welcomeContext(config,{username='',date=new Date(),weather=null}={}){
 const timezone=config.timezone||Intl.DateTimeFormat().resolvedOptions().timeZone;
 let parts;try{parts=Object.fromEntries(new Intl.DateTimeFormat('en-CA',{timeZone:timezone,year:'numeric',month:'2-digit',day:'2-digit',hour:'2-digit',minute:'2-digit',hourCycle:'h23'}).formatToParts(date).map(p=>[p.type,p.value]));}catch{return welcomeContext({...config,timezone:'UTC'},{username,date,weather});}
 const {year,month,day,hour,minute:min}=parts,minutes=Number(hour)*60+Number(min),times=[];
 for(const [name,p] of Object.entries(config.timePresets||{})){
  const start=minute(p?.from),end=minute(p?.to);if(start===null||end===null)continue;
  if(start===end||(start<end?minutes>=start&&minutes<end:minutes>=start||minutes<end))times.push(name);
 }
 const weekday=new Date(`${year}-${month}-${day}T12:00:00Z`).getUTCDay()||7,period=config.timePresets?.[times[0]],weatherNames=[];
 const fresh=weather&&Number.isFinite(weather.expiresAt)&&weather.expiresAt>date.getTime()?weather:null;
 if(fresh)for(const [name,p] of Object.entries(config.weatherPresets||{})){
  if(!p||typeof p!=='object'||Object.keys(p).some(k=>!['kinds','minTemperature','maxTemperature','minWindSpeed'].includes(k)))continue;
  if(p.kinds&&(!Array.isArray(p.kinds)||!p.kinds.includes(fresh.kind)))continue;
  if(p.minTemperature!==undefined&&!(Number.isFinite(p.minTemperature)&&fresh.temperature>=p.minTemperature))continue;
  if(p.maxTemperature!==undefined&&!(Number.isFinite(p.maxTemperature)&&fresh.temperature<=p.maxTemperature))continue;
  if(p.minWindSpeed!==undefined&&!(Number.isFinite(p.minWindSpeed)&&fresh.windSpeed>=p.minWindSpeed))continue;
  weatherNames.push(name);
 }
 return {times,weatherNames,weekday,month:Number(month),date:`${year}-${month}-${day}`,vars:{user:username,greeting:period?.greeting||'你好',period:period?.label||'',time:`${hour}:${min}`,date:`${year}-${month}-${day}`,year,month:Number(month),day:Number(day),weekday:'星期'+['','一','二','三','四','五','六','日'][weekday],...(fresh?{weather:fresh.label,temperature:fresh.temperature,humidity:fresh.humidity,windSpeed:fresh.windSpeed}:{})}};
}
export function matches(when,context){
 if(when===undefined)return true;
 if(!when||typeof when!=='object'||Array.isArray(when)||Object.keys(when).some(k=>!['time','weather','dates','weekdays','months'].includes(k)))return false;
 return Object.entries(when).every(([key,values])=>{
  if(!Array.isArray(values)||!values.length)return false;
  if(key==='time')return values.some(v=>context.times.includes(v));
  if(key==='weather')return values.some(v=>context.weatherNames.includes(v));
  if(key==='dates')return values.every(v=>typeof v==='string'&&/^(?:\d{4}-)?\d{2}-\d{2}$/.test(v))&&values.some(v=>v===context.date||v===context.date.slice(5));
  if(key==='weekdays')return values.every(v=>Number.isInteger(v)&&v>=1&&v<=7)&&values.includes(context.weekday);
  return values.every(v=>Number.isInteger(v)&&v>=1&&v<=12)&&values.includes(context.month);
 });
}
export function eligible(entries,context){
 return (Array.isArray(entries)?entries:[]).map(e=>typeof e==='string'?{text:e}:e).filter(e=>e&&typeof e.text==='string'&&e.text.trim()&&matches(e.when,context)&&[...e.text.matchAll(/\{([^{}]+)\}/g)].every(m=>context.vars[m[1]]!==undefined&&context.vars[m[1]]!==null)).map(e=>({text:e.text,weight:Number.isFinite(e.weight)&&e.weight>0?Math.min(e.weight,100):1}));
}
export function selectWelcome(entries,context,previous='',random=Math.random){
 const all=eligible(entries,context),other=all.filter(e=>e.text!==previous),pool=other.length?other:all;
 let remaining=random()*pool.reduce((sum,e)=>sum+e.weight,0);
 for(const e of pool){remaining-=e.weight;if(remaining<0)return e.text;}
 return pool.at(-1)?.text||'';
}
export const expandWelcome=(text,context)=>text.replace(/\{([^{}]+)\}/g,(_,key)=>String(context.vars[key]??''));
