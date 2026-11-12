import http from 'node:http';
import { PROCESS_TELEMETRY } from '../../contracts/constants.js';
export function normalizeStats(stats) {
 const cpu=stats.cpu_stats||{},prev=stats.precpu_stats||{};
 const used=(cpu.cpu_usage?.total_usage||0)-(prev.cpu_usage?.total_usage||0);
 const system=(cpu.system_cpu_usage||0)-(prev.system_cpu_usage||0);
 const cores=cpu.online_cpus||cpu.cpu_usage?.percpu_usage?.length||1;
 const memory=stats.memory_stats||{},cache=memory.stats?.inactive_file??memory.stats?.total_inactive_file??0;
 const memoryBytes=Math.max(0,(memory.usage||0)-cache),memoryLimitBytes=memory.limit||0;
 const network=Object.values(stats.networks||{}).reduce((a,n)=>({rx:a.rx+(n.rx_bytes||0),tx:a.tx+(n.tx_bytes||0)}),{rx:0,tx:0});
 const io=(stats.blkio_stats?.io_service_bytes_recursive||[]).reduce((a,n)=>{const op=String(n.op).toLowerCase();if(op==='read'||op==='write')a[op]+=n.value||0;return a;},{read:0,write:0});
 return {available:true,sampledAt:Date.parse(stats.read)||Date.now(),cpuPercent:system>0&&used>=0?used/system*cores*100:null,memoryBytes,memoryLimitBytes,memoryPercent:memoryLimitBytes?memoryBytes/memoryLimitBytes*100:null,pids:stats.pids_stats?.current??null,networkRxBytes:network.rx,networkTxBytes:network.tx,blockReadBytes:io.read,blockWriteBytes:io.write};
}
function readStats(name){
 return new Promise((resolve,reject)=>{
  const request=http.get({socketPath:PROCESS_TELEMETRY.socketPath,path:'/containers/'+encodeURIComponent(name)+'/stats?stream=false'},response=>{
   let body='';response.setEncoding('utf8');response.on('data',chunk=>{body+=chunk;if(body.length>PROCESS_TELEMETRY.maxResponseBytes)request.destroy(Error('stats response too large'));});
   response.on('end',()=>{if(response.statusCode!==200)return reject(Error('stats unavailable'));try{resolve(normalizeStats(JSON.parse(body)));}catch(error){reject(error);}});
  });
  const deadline=setTimeout(()=>request.destroy(Error('stats timeout')),PROCESS_TELEMETRY.timeoutMs);
  request.on('close',()=>clearTimeout(deadline));request.on('error',reject);
 });
}
export function createMetricsSampler(read=readStats,now=Date.now){
 const cache=new Map();
 return function sample(name){
  const cached=cache.get(name);if(cached&&(cached.pending||now()-cached.at<PROCESS_TELEMETRY.cacheMs))return cached.pending||Promise.resolve(cached.value);
  const entry={at:now(),value:null,pending:null};cache.set(name,entry);
  entry.pending=Promise.resolve().then(()=>read(name)).catch(()=>({available:false,reason:'unavailable',sampledAt:now()})).then(value=>{entry.value=value;entry.at=now();entry.pending=null;return value;});
  return entry.pending;
 };
}
