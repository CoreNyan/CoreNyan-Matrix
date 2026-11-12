import fs from 'node:fs';
import path from 'node:path';
import {createHash,randomBytes} from 'node:crypto';

export const SESSION_POLICY=Object.freeze({ttlMs:90*24*60*60*1000,renewMs:24*60*60*1000,maxSessions:512,maxPerAccount:16});
const digest=value=>createHash('sha256').update(value).digest('hex');
const credentialVersion=account=>digest(account.salt+':'+account.passwordHash);

// The private file contains token hashes only. One API process owns this store.
export function createSessionStore(file,{now=Date.now}={}){
 const records=new Map();let writes=Promise.resolve();
 if(fs.existsSync(file)){
  const saved=JSON.parse(fs.readFileSync(file,'utf8'));
  if(saved.version!==1||!Array.isArray(saved.sessions))throw Error('Invalid session store');
  for(const [id,s] of saved.sessions){
   if(!/^[a-f0-9]{64}$/.test(id)||!s.accountId||!Number.isFinite(s.expiresAt)||!Number.isFinite(s.renewedAt)||!/^[a-f0-9]{64}$/.test(s.credentialVersion))throw Error('Invalid session record');
   if(s.expiresAt>now())records.set(id,s);
  }
 }
 function persist(){
  const write=async()=>{
   await fs.promises.mkdir(path.dirname(file),{recursive:true});
   const temp=file+'.tmp',handle=await fs.promises.open(temp,'w',0o600);
   try{await handle.writeFile(JSON.stringify({version:1,sessions:[...records]}));await handle.sync();}finally{await handle.close();}
   await fs.promises.chmod(temp,0o600);await fs.promises.rename(temp,file);
  };
  writes=writes.then(write,write);return writes;
 }
 function get(token,account){
  if(!token||!account)return null;
  const record=records.get(digest(token));
  return record&&record.accountId===account.id&&record.expiresAt>now()&&record.credentialVersion===credentialVersion(account)?record:null;
 }
 function find(token){return token?records.get(digest(token)):null;}
 async function create(account,previous){
  const time=now();for(const [id,s] of records)if(s.expiresAt<=time)records.delete(id);
  if(previous)records.delete(digest(previous));
  const owned=[...records].filter(([,s])=>s.accountId===account.id).sort((a,b)=>a[1].renewedAt-b[1].renewedAt);
  while(owned.length>=SESSION_POLICY.maxPerAccount)records.delete(owned.shift()[0]);
  while(records.size>=SESSION_POLICY.maxSessions){const oldest=[...records].sort((a,b)=>a[1].renewedAt-b[1].renewedAt)[0];records.delete(oldest[0]);}
  const token=randomBytes(32).toString('base64url');records.set(digest(token),{accountId:account.id,credentialVersion:credentialVersion(account),expiresAt:time+SESSION_POLICY.ttlMs,renewedAt:time});await persist();return token;
 }
 async function renew(token){
  const s=find(token);if(!s||now()-s.renewedAt<SESSION_POLICY.renewMs)return false;
  s.renewedAt=now();s.expiresAt=s.renewedAt+SESSION_POLICY.ttlMs;await persist();return true;
 }
 async function remove(token){if(token&&records.delete(digest(token)))await persist();}
 async function invalidate(accountId){let changed=false;for(const [id,s] of records)if(s.accountId===accountId){records.delete(id);changed=true;}if(changed)await persist();}
 return {find,get,create,renew,remove,invalidate};
}
