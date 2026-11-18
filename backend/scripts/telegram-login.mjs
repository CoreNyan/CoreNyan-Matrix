import {readFile} from 'node:fs/promises';
import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
const validRows=rows=>Array.isArray(rows)&&rows.length>0&&rows.length<=50&&rows.every(row=>typeof row==='string'&&/^[ ▀▄█]{21,100}$/.test(row)&&row.length===rows[0].length);
export async function readTelegramLogin(policy,inspect=()=>run('docker',['exec','corenyan-telegram','cat','/tmp/telegram-bot-status.json'],{timeout:2500,maxBuffer:32768}),owner=false){
 let enabled;
 try{
  enabled=JSON.parse(await readFile(policy,'utf8')).modules?.telegram===true;
  if(!enabled&&!owner)return {status:'disabled'};
  const {stdout}=await inspect(),state=JSON.parse(stdout),age=Date.now()-state.updatedAt;
  if(state.mode==='user'){
   if(!owner)return {mode:'user',status:'owner_only'};
   if(!Number.isFinite(age)||age<0||age>20000)return {mode:'user',status:'unavailable'};
   if(state.status==='qr'&&validRows(state.rows)&&state.expiresAt>Date.now()&&state.expiresAt<=Date.now()+120000)return {mode:'user',status:'qr',rows:state.rows,expiresAt:state.expiresAt};
   if(state.status==='online'&&/^\d{1,20}$/.test(state.accountId))return {mode:'user',status:'online',accountId:state.accountId,username:/^\w{1,32}$/.test(state.username)?state.username:''};
   return {mode:'user',status:['connecting','password','unconfigured','disconnected'].includes(state.status)?state.status:'unavailable'};
  }
  if(!enabled)return {status:'disabled'};
  if(!Number.isFinite(age)||age<0||age>20000)return {status:'unavailable'};
  if(state.online!==true)return {status:'disconnected'};
  if(!/^[A-Za-z0-9_]{5,32}$/.test(state.username)||!validRows(state.rows))return {status:'unavailable'};
  return {status:'online',username:state.username,rows:state.rows};
 }catch{return {status:enabled===false?'disabled':'unavailable'};}
}
