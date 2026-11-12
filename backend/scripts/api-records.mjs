import fs from 'node:fs/promises';
import path from 'node:path';
const valid=id=>/^[a-f0-9-]{36}$/.test(id);
export function createApiRecords(root){
 async function read(id){if(!valid(id))throw Error('INVALID_RECORD_ID');const p=path.join(root,id+'.json'),s=await fs.lstat(p);if(!s.isFile()||s.isSymbolicLink()||s.size>40*1024*1024)throw Error('RECORD_UNAVAILABLE');return JSON.parse(await fs.readFile(p,'utf8'));}
 async function list({q='',kind='',before=Infinity}={}){const [time,id='']=String(before).split(':');const boundary=Number(time)||Infinity;let names=[];try{names=await fs.readdir(root);}catch(e){if(e.code!=='ENOENT')throw e;}const rows=[];for(const name of names){if(!name.endsWith('.meta')||!valid(name.slice(0,-5)))continue;try{const p=path.join(root,name),stat=await fs.lstat(p);if(!stat.isFile()||stat.isSymbolicLink()||stat.size>65536)continue;const r=JSON.parse(await fs.readFile(p,'utf8'));if(r.startedAt>boundary||(r.startedAt===boundary&&(!id||r.id<=id))||kind&&r.kind!==kind)continue;const row={id:r.id,startedAt:r.startedAt,kind:r.kind,purpose:r.purpose||r.name,model:r.model,status:r.status,httpStatus:r.httpStatus,durationMs:r.durationMs,requestId:r.requestId,attempt:r.attempt,error:r.error};if(q&&!JSON.stringify(row).toLowerCase().includes(q.toLowerCase().slice(0,200)))continue;rows.push(row);}catch{}}
 rows.sort((a,b)=>b.startedAt-a.startedAt||a.id.localeCompare(b.id));return {records:rows.slice(0,40),nextBefore:rows.length>40?rows[39].startedAt+':'+rows[39].id:null,retention:'最近 7 天 / 最多 1000 条 / 512 MiB',redacted:true};}
 return {read,list};
}
