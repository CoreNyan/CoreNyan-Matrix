import {attachmentHeaders} from './attachment-headers.mjs';
import fs from 'node:fs';
import path from 'node:path';
import {createRequire} from 'node:module';
import {randomUUID} from 'node:crypto';
const require=createRequire(import.meta.url);
export function createChatApi({sharedRoot,gatewayRoot}){
 const shared=require(path.join(sharedRoot,'index.js')),{CHAT,uuid}=require(path.join(sharedRoot,'chat-contract.cjs'));
 const bus=new shared.RedisBus({getConfig:()=>{const cfg=JSON.parse(fs.readFileSync(path.join(gatewayRoot,'corenyan-config.json'),'utf8'));return {redis:{...cfg.redis,host:process.env.REDIS_HOST||'corenyan-redis'}};},logger:(...a)=>console.log('[CHAT]',...a)});
 const client=shared.createRpcClient({bus,requestChannel:shared.channel('chat:request'),responseChannel:shared.channel('chat:response'),timeoutMs:CHAT.requestMs});bus.connect();
 const json=(res,status,value)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify(value));};
 async function body(req,max=2*CHAT.chunkBytes){let size=0,parts=[];for await(const b of req){size+=b.length;if(size>max)throw Error('CHAT_REQUEST_TOO_LARGE');parts.push(b);}return JSON.parse(Buffer.concat(parts).toString('utf8')||'{}');}
 const handle=async(req,res,url)=>{
  if(!url.pathname.startsWith(CHAT.api))return false;
  try{
   if(!req.auth)throw Error('CHAT_AUTH_REQUIRED');if(!shared.enabled('chat'))throw Error('CHAT_DISABLED');
   const c={platform:'chat',authenticated:true,accountId:req.auth.id,username:req.auth.username,role:req.auth.role,linkedQQ:req.auth.linkedQQ||''},parts=url.pathname.slice(CHAT.api.length).split('/').filter(Boolean);
   const call=(op,a={},id=randomUUID())=>client.call(op,a,c,{id});
   if(parts[0]==='capabilities'&&req.method==='GET'){json(res,200,{ok:true,version:CHAT.version,maxFileBytes:CHAT.maxFileBytes,maxFiles:CHAT.maxFiles,chunkBytes:CHAT.chunkBytes,identity:req.auth});return true;}
   if(parts[0]==='conversations'){
    if(!parts[1]){
     if(req.method==='GET')json(res,200,{ok:true,...await call('list',{query:url.searchParams.get('q')||''})});
     else if(req.method==='POST')json(res,201,{ok:true,thread:await call('create',await body(req))});else throw Error('CHAT_METHOD_NOT_ALLOWED');return true;
    }
    c.threadId=uuid(parts[1]);
    if(parts[2]==='files'){
     if(parts[3]&&req.method==='GET'){
      const id=uuid(parts[3]),m=await call('file.metadata',{id});if(parts[4]==='preview'&&parts.length===5){const image=await call('file.preview',{id}),bytes=Buffer.from(image.base64,'base64');res.writeHead(200,{'Content-Type':'image/jpeg','Content-Length':bytes.length,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});res.end(bytes);return true;}if(parts.length!==4)throw Error('CHAT_NOT_FOUND');
      const range=req.headers.range;let start=0,end=m.bytes-1;if(range){const match=/^bytes=(\d+)-(\d*)$/.exec(range);if(!match||Number(match[1])>=m.bytes) {res.writeHead(416,{'Content-Range':'bytes */'+m.bytes});res.end();return true;}start=Number(match[1]);end=match[2]?Math.min(Number(match[2]),end):end;if(end<start)throw Error('CHAT_INVALID_RANGE');}
      res.writeHead(range?206:200,{...attachmentHeaders(m,url.searchParams.has('download')),'Content-Length':Math.max(0,end-start+1),'Accept-Ranges':'bytes',...(range?{'Content-Range':`bytes ${start}-${end}/${m.bytes}`} : {})});
      for(let offset=start;offset<=end;){if(res.destroyed)break;const chunk=await call('file.read',{id,offset}),bytes=Buffer.from(chunk.base64,'base64').subarray(0,end-offset+1);if(!bytes.length)break;if(!res.write(bytes))await new Promise(resolve=>{res.once('drain',resolve);res.once('close',resolve);});offset+=bytes.length;}res.end();return true;
     }
     if(req.method!=='POST')throw Error('CHAT_METHOD_NOT_ALLOWED');const a=await body(req),op=parts[3]||'begin';if(!['begin','chunk','finish'].includes(op))throw Error('UNKNOWN_CHAT_OPERATION');json(res,200,{ok:true,file:await call('file.'+op,a)});return true;
    }
    if(parts[2]==='messages'&&parts[3]){
     const messageId=uuid(parts[3]),a=await body(req),requestId=uuid(a.requestId);
     const op=parts.length===4&&req.method==='PATCH'?'edit':parts.length===4&&req.method==='DELETE'?'withdraw':parts.length===5&&parts[4]==='retry'&&req.method==='POST'?'retry':null;
     if(!op)throw Error('CHAT_METHOD_NOT_ALLOWED');if(!Number.isSafeInteger(a.revision)||a.revision<1)throw Error('CHAT_MESSAGE_VERSION_CONFLICT');
     json(res,200,{ok:true,message:await call('message.'+op,{messageId,revision:a.revision,...(op==='edit'?{text:a.text}:{})},requestId)});return true;
    }
    if(parts[2]==='messages'&&parts.length===3&&req.method==='POST'){const a=await body(req);uuid(a.id);if(!Array.isArray(a.files)||a.files.length>CHAT.maxFiles)throw Error('CHAT_FILE_LIMIT');json(res,202,{ok:true,message:await call('send',a,a.id)});return true;}
    if(['clone','stop','clear'].includes(parts[2])&&req.method==='POST'){json(res,200,{ok:true,thread:await call(parts[2],await body(req))});return true;}
    if(!parts[2]){if(req.method==='GET')json(res,200,{ok:true,...await call('messages',{before:url.searchParams.get('before')||''})});else if(req.method==='PATCH')json(res,200,{ok:true,thread:await call('update',await body(req))});else if(req.method==='DELETE')json(res,200,{ok:true,...await call('delete')});else throw Error('CHAT_METHOD_NOT_ALLOWED');return true;}
   }
   if(parts[0]==='groups'&&req.method==='POST'){json(res,200,{ok:true,...await call('folder',await body(req))});return true;}
   throw Error('CHAT_NOT_FOUND');
  }catch(e){if(res.headersSent){res.destroy();return true;}const error=/^[A-Z0-9_: -]{1,100}$/.test(e.message)?e.message:'CHAT_SERVICE_UNAVAILABLE';json(res,/NOT_FOUND/.test(error)?404:/CONFLICT/.test(error)?409:/AUTH|DENIED/.test(error)?403:/RPC|UNAVAILABLE/.test(error)?503:400,{ok:false,error});return true;}
 };
 handle.listForAccount=account=>client.call('list',{}, {platform:'chat',authenticated:true,accountId:account.id,username:account.username,role:account.role,linkedQQ:account.linkedQQ||''});
 handle.readNotificationReply=async(account,ref)=>{
  const threadId=uuid(ref.threadId),messageId=uuid(ref.messageId);
  if(!Number.isSafeInteger(ref.sequence)||ref.sequence<1)throw Error('INVALID_MESSAGE_SEQUENCE');
  const d=await client.call('messages',{before:String(ref.sequence+1)},{platform:'chat',authenticated:true,accountId:account.id,username:account.username,role:account.role,linkedQQ:account.linkedQQ||'',threadId});
  const message=d.messages.find(m=>m.id===messageId&&m.sequence===ref.sequence&&m.role==='assistant'&&m.status!=='withdrawn');
  return message?{text:message.text,title:d.thread.title}:null;
 };
 return handle;
}
