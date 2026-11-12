import {Worker} from 'node:worker_threads';
import {RULE_LIMITS,validateRules} from '../../contracts/notification-rules.js';
let active=0;
export async function evaluateRules(input,event){
 const rules=validateRules(input);if(!rules.enabled)return true;
 return run({rules},event);
}
export async function evaluatePresetRules(input,combine,event){
 if(!input.length)return false;
 return run({list:input.map(validateRules),combine},event);
}
async function run(payload,event){
 if(active>=RULE_LIMITS.workers)throw Object.assign(Error('规则匹配繁忙，请稍后再试'),{status:429});
 active++;
 try{return await new Promise((resolve,reject)=>{
  const worker=new Worker(new URL('./notification-rule-worker.mjs',import.meta.url),{workerData:{...payload,event:{text:String(event.text||'').slice(0,RULE_LIMITS.text),title:String(event.title||'').slice(0,120)}},resourceLimits:{maxOldGenerationSizeMb:24}});
  let done=false;
  const finish=(error,value)=>{if(done)return;done=true;clearTimeout(timer);void worker.terminate().finally(()=>{if(error)reject(Object.assign(Error(error),{status:400}));else resolve(value);});};
  const timer=setTimeout(()=>finish('正则匹配超时，请简化表达式；本次不会发送通知'),RULE_LIMITS.workerMs);
  worker.once('message',m=>finish(m.error?'规则匹配失败':null,m.matched));worker.once('error',()=>finish('规则匹配失败'));worker.once('exit',()=>{if(!done)finish('规则匹配已中断');});
 });}finally{active--;}
}
