import fs from 'node:fs';
import path from 'node:path';
import {randomBytes,createCipheriv,createDecipheriv,randomUUID} from 'node:crypto';
import nodemailer from 'nodemailer';
import {emptyRules,validateRules,RULE_LIMITS} from '../../contracts/notification-rules.js';
import {migrateRuleConfig,validateRuleConfig,PRESET_LIMITS} from '../../contracts/notification-presets.js';
import {evaluateRules,evaluatePresetRules} from './notification-rule-engine.mjs';
import {NOTIFICATIONS as C,DEFAULT_EMAIL,MAIL_SECRETS} from '../../contracts/notifications.js';
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
const email=v=>typeof v==='string'&&v.length<=254&&/^[^\s<>@,;]+@[^\s<>@,;]+\.[^\s<>@,;]+$/.test(v);
export function validateEmail(input,previous=DEFAULT_EMAIL){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!Object.hasOwn(DEFAULT_EMAIL,k)))fail('邮件配置格式无效');
 const n={...DEFAULT_EMAIL,...previous,...input};
 for(const k of MAIL_SECRETS)if(input[k]===null)n[k]=previous[k]||'';
 for(const [k,v] of Object.entries(n))if(!['enabled','port'].includes(k)&&(typeof v!=='string'||v.length>(MAIL_SECRETS.includes(k)?8192:500)||/[\r\n\0]/.test(v)))fail('邮件配置包含无效字符');
 if(typeof n.enabled!=='boolean'||!C.providers.some(p=>p.id===n.provider)||!['tls','starttls'].includes(n.security)||!['password','oauth2'].includes(n.authMode)||!Number.isInteger(n.port)||n.port<1||n.port>65535)fail('请检查邮件连接设置');
 if(n.host&&!/^[a-z0-9.-]+$/i.test(n.host))fail('SMTP 地址只需填写主机名，不含 http 或路径');
 for(const k of ['from','to'])if(n[k]&&!email(n[k]))fail('请填写有效的发件与收件邮箱');
 if(n.tokenUrl){let u;try{u=new URL(n.tokenUrl);}catch{fail('OAuth2 Token 地址无效');}if(u.protocol!=='https:'||u.username||u.password)fail('OAuth2 Token 地址必须使用 HTTPS');}
 if(n.enabled)requireReady(n);
 return n;
}
function requireReady(n){if(!n.host||!email(n.from)||!email(n.to)||!n.user||(n.authMode==='password'?!n.password:!n.accessToken&&!(n.clientId&&n.refreshToken)))fail('请先填写 SMTP、邮箱和完整的登录凭据');}
export function mailError(e){const code=String(e.code||'SMTP_FAILED');return {code:/^[A-Z_0-9]+$/.test(code)?code:'SMTP_FAILED',message:code==='EAUTH'?'邮箱认证失败，请检查授权码或 OAuth2，并确认 SMTP 已开启。':code==='ETIMEDOUT'?'连接邮箱超时，请检查地址、端口与服务器网络。':code==='ECONNREFUSED'?'邮箱服务器拒绝连接，请核对 SMTP 端口。':/CERT|TLS|SSL/.test(code)?'邮箱 TLS 证书校验失败，请核对主机名和加密方式。':code==='EENVELOPE'?'邮箱服务器未接受发件人或收件人，请检查邮箱地址。':'邮件未确认发送成功，请检查 SMTP 配置；为避免重复，系统不会自动重发。'};}
export function createNotifications({directory,accounts,listThreads,readReply,createTransport=nodemailer.createTransport,now=Date.now,logger=console.log}){
 fs.mkdirSync(directory,{recursive:true,mode:0o700});
 const file=path.join(directory,'notifications.json'),keyFile=path.join(directory,'notifications.key');
 if(!fs.existsSync(keyFile))fs.writeFileSync(keyFile,randomBytes(32),{flag:'wx',mode:0o600});
 const key=fs.readFileSync(keyFile);if(key.length!==32)throw Error('INVALID_NOTIFICATION_KEY');
 let state=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{version:1,accounts:{}};
 if(state.version!==1||!state.accounts)throw Error('INVALID_NOTIFICATION_STORE');
 const persist=()=>{const tmp=file+'.'+randomUUID()+'.tmp';fs.writeFileSync(tmp,JSON.stringify(state),{mode:0o600});fs.renameSync(tmp,file);};
 function seal(value){const iv=randomBytes(12),cipher=createCipheriv('aes-256-gcm',key,iv);return {iv:iv.toString('base64'),tag:null,data:Buffer.concat([cipher.update(JSON.stringify(value)),cipher.final()]).toString('base64'),...{tag:cipher.getAuthTag().toString('base64')}};}
 function unpack(row){if(!row)return {...DEFAULT_EMAIL};const d=createDecipheriv('aes-256-gcm',key,Buffer.from(row.secret.iv,'base64'));d.setAuthTag(Buffer.from(row.secret.tag,'base64'));return JSON.parse(Buffer.concat([d.update(Buffer.from(row.secret.data,'base64')),d.final()]).toString());}
 function view(id){const row=state.accounts[id],config=unpack(row),hasSecrets={};for(const k of MAIL_SECRETS){hasSecrets[k]=!!config[k];config[k]=null;}return {revision:row?.revision||0,email:config,ruleConfig:migrateRuleConfig(row),rules:structuredClone(row?.rules||emptyRules()),hasSecrets,lastResult:row?.lastResult||null};}
 function update(id,{revision,email:input,rules:ruleInput,ruleConfig:configInput}){
  if(!accounts.find(id))fail('账号不存在',403);const row=state.accounts[id];if(revision!==(row?.revision||0))fail('其他设备已修改通知设置，请重新读取后再试',409);
  const previous=unpack(row),config=validateEmail(input??{},previous),rules=validateRules(ruleInput??row?.rules??emptyRules()),time=now();
  if(ruleInput!==undefined&&row?.ruleConfig&&configInput===undefined)fail('条件已升级为预设，请刷新页面后再修改',409);
  const ruleConfig=configInput===undefined?(row?.ruleConfig||undefined):validateRuleConfig(configInput);
  const next={...row,ruleConfig,rules,revision:(row?.revision||0)+1,secret:seal(config),since:config.enabled&&!previous.enabled?time:row?.since||time,cursors:row?.cursors||{},lastResult:row?.lastResult||null};
  const prior=state.accounts[id];state.accounts[id]=next;try{persist();}catch(e){if(prior)state.accounts[id]=prior;else delete state.accounts[id];throw e;}return view(id);
 }
 async function matches(id,ref,channel='system'){
  if(!['system','email'].includes(channel))fail('通知渠道无效');
  const row=state.accounts[id],config=migrateRuleConfig(row),choice=config.channels[channel];if(choice.mode==='all')return true;
  const selected=choice.ids.map(id=>config.presets.find(p=>p.id===id)?.rules);if(!selected.length||selected.some(r=>!r))return false;
  const account=accounts.find(id);if(!account)fail('请先登录',401);
  if(!readReply)fail('消息内容暂不可用',503);
  const event=await readReply(account,ref);
  if(!event)return false;
  const matched=await evaluatePresetRules(selected,choice.combine,event);
  // A concurrent settings edit invalidates this decision.
  return state.accounts[id]===row&&matched;
 }
 const active=new Set(),lastTest=new Map();let polling=false;
 async function send(id,config,{test=false,threads=[]}={}){
  requireReady(config);if(active.has(id)||active.size>=C.maxConcurrent)fail('通知正在发送，请稍后再试',429);
  if(test){if(now()-(lastTest.get(id)||0)<C.testCooldownMs)fail('测试发送过于频繁，请稍后再试',429);lastTest.set(id,now());}
  active.add(id);let transport;
  try{
   const auth=config.authMode==='password'?{user:config.user,pass:config.password}:{type:'OAuth2',user:config.user,clientId:config.clientId,clientSecret:config.clientSecret||undefined,refreshToken:config.refreshToken||undefined,accessToken:config.accessToken||undefined,accessUrl:config.tokenUrl,customParams:config.provider==='outlook'?{scope:'https://outlook.office.com/SMTP.Send offline_access'}:undefined};
   transport=createTransport({host:config.host,port:config.port,secure:config.security==='tls',requireTLS:true,auth,tls:{rejectUnauthorized:true},connectionTimeout:8000,greetingTimeout:8000,socketTimeout:C.smtpTimeoutMs,disableFileAccess:true,disableUrlAccess:true,logger:false,debug:false});
   const result=await transport.sendMail({from:{name:'CoreNyan',address:config.from},to:config.to,subject:test?C.testTitle:C.subject,text:test?C.testBody:threads.map(t=>(t.title||'对话')+'\n'+(t.lastAssistant.text||'小可发来了附件')).join('\n\n')});
   if(result.accepted?.length===0)throw Object.assign(Error('rejected'),{code:'EENVELOPE'});
   const status={at:now(),ok:true,test,message:'邮箱服务器已接受邮件，请检查收件箱或垃圾邮件。'};if(state.accounts[id]){state.accounts[id].lastResult=status;persist();}return status;
  }catch(e){const error=mailError(e),status={at:now(),ok:false,test,...error};if(state.accounts[id]){state.accounts[id].lastResult=status;persist();}logger('[Notifications] mail_failed '+error.code);throw Object.assign(Error(error.message),{status:502,code:error.code});}
  finally{active.delete(id);transport?.close();}
 }
 async function poll(){
  if(polling)return;polling=true;
  try{for(const [id,row] of Object.entries(state.accounts)){
   const account=accounts.find(id);if(!account){delete state.accounts[id];persist();continue;}const config=unpack(row);if(!config.enabled||active.has(id)||active.size>=C.maxConcurrent)continue;
   let threads;try{threads=(await listThreads(account)).threads;}catch{continue;}
   if(state.accounts[id]!==row)continue;
   const pending=threads.filter(t=>t.lastAssistant&&t.lastAssistant.created>=row.since&&t.lastAssistant.sequence>(row.cursors[t.id]||0)).slice(0,20);if(!pending.length)continue;
   const selected=[];let matchFailed=false;
   for(const t of pending){try{if(await matches(id,{threadId:t.id,messageId:t.lastAssistant.id,sequence:t.lastAssistant.sequence},'email'))selected.push(t);}catch(e){matchFailed=true;row.lastResult={at:now(),ok:false,message:e.status?e.message:'消息匹配暂不可用，本次未发送通知'};break;}}
   if(state.accounts[id]!==row)continue;
   if(matchFailed){persist();continue;}
   // Persist reservation before SMTP. Ambiguous acceptance is never auto-retried.
   row.cursors=Object.fromEntries(threads.map(t=>[t.id,row.cursors[t.id]||0]));
   for(const t of pending)row.cursors[t.id]=t.lastAssistant.sequence;
   if(selected.length)row.lastResult={at:now(),ok:false,message:'邮件正在发送；若发送中断，不会自动重复发送。'};persist();
   if(selected.length)try{await send(id,config,{threads:selected});}catch{}
  }}finally{polling=false;}
 }
 const timer=setInterval(()=>void poll().catch(()=>logger('[Notifications] poll_failed')),C.pollMs);timer.unref();
 async function handle(req,res,url){
  if(!url.pathname.startsWith(C.api))return false;
  const reply=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  try{
   const id=req.auth?.id;if(!id||!accounts.find(id))fail('请先登录',401);
   const body=async()=>{let raw='';for await(const b of req){raw+=b;if(Buffer.byteLength(raw)>PRESET_LIMITS.bodyBytes)fail('请求过大',413);}return JSON.parse(raw);};
   if(url.pathname===C.api&&req.method==='GET')reply(200,{ok:true,...view(id)});
   else if(url.pathname===C.api&&req.method==='PATCH')reply(200,{ok:true,...update(id,await body())});
   else if(url.pathname===C.api+'/rules/test'&&req.method==='POST'){const a=await body();reply(200,{ok:true,matched:await evaluateRules(a.rules,{text:a.text,title:a.title})});}
   else if(url.pathname===C.api+'/rules/check'&&req.method==='POST')reply(200,{ok:true,matched:await matches(id,await body())});
   else if(url.pathname===C.api+'/email/test'&&req.method==='POST')reply(200,{ok:true,result:await send(id,unpack(state.accounts[id]),{test:true})});
   else fail('通知接口不存在',404);
  }catch(e){reply(e.status||400,{ok:false,error:e.status?e.message:'通知配置暂不可用'});}return true;
 }
 return {handle,poll,view,update,matches,test:id=>send(id,unpack(state.accounts[id]),{test:true}),close:()=>clearInterval(timer)};
}
