import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
import {SERVICE_CONTROL,validateControl} from '../../contracts/organ-control-policy.js';
const execute=promisify(execFile);
const active=new Set();
export async function runOrganControl(layer,action,confirmation,{run=execute}={}){
 validateControl(layer,action,confirmation);
 if(active.has(layer.containerName))throw Error('该容器已有控制操作正在执行');
 active.add(layer.containerName);
 try{
  const args=[action,...(action==='start'?[]:['--timeout',String(SERVICE_CONTROL.stopTimeoutSeconds)]),layer.containerName];
  const {stdout,stderr}=await run('docker',args,{timeout:SERVICE_CONTROL.timeoutMs,maxBuffer:128*1024});
  return {ok:true,organId:layer.id,action,output:(stdout||stderr||'OK').trim()};
 }finally{active.delete(layer.containerName);}
}
