import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const execute=promisify(execFile);
export async function containerStarts(ids,{run=execute}={}){
 if(!ids.length)return new Map();
 const {stdout}=await run('docker',['inspect','--format','{{.Id}}|{{.State.StartedAt}}',...ids],{timeout:3500,maxBuffer:128*1024});
 return new Map(stdout.trim().split('\n').map(line=>{
  const [id,value]=line.split('|'),date=new Date(value);
  return [id.slice(0,12),Number.isFinite(date.getTime())&&date.getUTCFullYear()>1970?date.toISOString():null];
 }));
}
