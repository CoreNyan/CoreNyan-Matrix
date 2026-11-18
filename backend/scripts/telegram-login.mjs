import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
export async function readTelegramLogin(policy,inspect=()=>run('docker',['exec','corenyan-telegram','cat','/tmp/telegram-bot-status.json'],{timeout:2500,maxBuffer:32768})){
 try{
  if(JSON.parse(await readFile(policy,'utf8')).modules?.telegram!==true)return {status:'disabled'};
  const {stdout}=await inspect(),state=JSON.parse(stdout),age=Date.now()-state.updatedAt;
  if(!Number.isFinite(age)||age<0||age>20000)return {status:'unavailable'};
  if(state.online!==true)return {status:'disconnected'};
  if(!/^[A-Za-z0-9_]{5,32}$/.test(state.username)||!Array.isArray(state.rows)||!state.rows.length||state.rows.length>50||!state.rows.every(row=>typeof row==='string'&&/^[ ▀▄█]{21,100}$/.test(row)&&row.length===state.rows[0].length))return {status:'unavailable'};
  return {status:'online',username:state.username,rows:state.rows};
 }catch{return {status:'unavailable'};}
}
