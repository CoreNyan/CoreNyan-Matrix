import {PROCESS_TELEMETRY} from './constants.js';
const bytes=value=>{if(!Number.isFinite(value))return '—';const i=Math.min(3,Math.floor(Math.log(Math.max(1,value))/Math.log(1024)));return (value/1024**i).toFixed(i?1:0)+' '+PROCESS_TELEMETRY.units[i];};
const percent=value=>Number.isFinite(value)?value.toFixed(1)+'%':'—';
export function mountEntityTelemetry(host){
 host.innerHTML='<header><span>FLIGHT SYSTEMS</span></header><div class="flight-ident"><strong data-flight="name"></strong><small data-flight="container"></small></div><div class="flight-dials">'+['cpu','memory'].map(key=>'<div class="flight-dial"><svg viewBox="0 0 120 100" aria-hidden="true"><path class="flight-track" d="M24 86 A46 46 0 1 1 96 86" pathLength="100"/><path data-flight-ring="'+key+'" class="flight-fill" d="M24 86 A46 46 0 1 1 96 86" pathLength="100"/><path class="flight-ticks" d="M60 4v6M12 38l6 3M102 41l6-3M24 86l5-5M91 81l5 5"/></svg><strong data-flight="'+key+'">—</strong><small>'+key.toUpperCase()+'</small></div>').join('')+'</div><p class="flight-memory" data-flight="memoryDetail"></p><div class="flight-trace"><span>CPU · RECENT SAMPLES</span><svg viewBox="0 0 240 45" preserveAspectRatio="none" aria-hidden="true"><path d="M0 44H240M0 22H240" class="flight-grid"/><polyline data-flight-trace points="" fill="none"/></svg></div><dl>'+[['state','STATUS'],['pids','TASKS / PIDS'],['rx','NET RX · TOTAL'],['tx','NET TX · TOTAL'],['read','DISK READ · TOTAL'],['write','DISK WRITE · TOTAL']].map(([key,label])=>'<div><dt>'+label+'</dt><dd data-flight="'+key+'">—</dd></div>').join('')+'</dl><footer><span data-flight="sample"></span><small>CPU 100% = 1 核 · RAM 扣除文件缓存</small></footer>';
 const history=new Map(),text=(key,value)=>host.querySelector('[data-flight="'+key+'"]').textContent=value;
 return function render(layer){
  if(!layer)return;const m=layer.metrics||{},valid=m.available&&layer.online;
  text('name',layer.name);text('container',layer.kind==='directory'?'DIRECTORY LAYER':layer.containerName||layer.id);
  text('cpu',valid?percent(m.cpuPercent):'—');text('memory',valid?percent(m.memoryPercent):'—');
  for(const [key,value]of [['cpu',m.cpuPercent],['memory',m.memoryPercent]])host.querySelector('[data-flight-ring="'+key+'"]').style.strokeDasharray=(valid&&Number.isFinite(value)?Math.max(0,Math.min(100,value)):0)+' 100';
  text('memoryDetail',valid?bytes(m.memoryBytes)+' / '+bytes(m.memoryLimitBytes)+' · 内存额度':'暂无容器用量数据');
  text('state',layer.kind==='directory'?'文件层 · 无进程':!layer.online?'STOPPED':valid?'ONLINE':'采样暂不可用');
  text('pids',valid?String(m.pids??'—'):'—');
  for(const [key,field]of [['rx','networkRxBytes'],['tx','networkTxBytes'],['read','blockReadBytes'],['write','blockWriteBytes']])text(key,valid?bytes(m[field]):'—');
  text('sample',valid?'SAMPLED '+new Date(m.sampledAt).toLocaleTimeString('zh-CN',{hour12:false}):'WAITING FOR TELEMETRY');
  const key=layer.key||layer.id,samples=history.get(key)||[];
  if(valid&&Number.isFinite(m.cpuPercent)&&samples.at(-1)?.time!==m.sampledAt){samples.push({time:m.sampledAt,value:m.cpuPercent});if(samples.length>PROCESS_TELEMETRY.historyLimit)samples.shift();history.set(key,samples);}
  const max=Math.max(100,...samples.map(s=>s.value)),points=samples.map((s,i)=>[i*240/(PROCESS_TELEMETRY.historyLimit-1),44-s.value/max*42].join(',')).join(' ');
  host.querySelector('[data-flight-trace]').setAttribute('points',points);host.dataset.layer=key;host.dataset.available=String(Boolean(valid));
 };
}
