import {applyCors,trustedRequestOrigin,allowedOrigins} from './cors.mjs';
import {createSessionStore,SESSION_POLICY} from './auth-sessions.mjs';
import {createAccountStore} from './account-store.mjs';
import {scrypt,randomBytes,timingSafeEqual,createHash} from 'node:crypto';
import {promisify} from 'node:util';
import fs from 'node:fs';
const derive=promisify(scrypt);
const COOKIE='__Host-corenyan_session';
const SESSION_MS=SESSION_POLICY.ttlMs,WINDOW_MS=15*60*1000,MAX_FAILURES=8;
const escape=s=>String(s).replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export async function passwordHash(password,salt){return (await derive(password,salt,64)).toString('hex');}
export function createAuth({credentialFile,secure=true,now=Date.now,accounts=createAccountStore(credentialFile)}){
 const sessions=createSessionStore(credentialFile+'.sessions.json',{now});
 const invalidate=id=>sessions.invalidate(id);
 const attempts=new Map();let verifying=0,globalAttempts=[];
 const json=(res,status,error)=>{res.writeHead(status,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store'});res.end(JSON.stringify({ok:false,error}));};
 const cookie=(token,age)=>COOKIE+'='+token+'; Path=/; HttpOnly; SameSite=Strict; '+(secure?'Secure; ':'')+'Max-Age='+age;
 const redirect=(res,to,token)=>{res.writeHead(303,{'Location':to,'Cache-Control':'no-store',...(token!==undefined?{'Set-Cookie':cookie(token,token?SESSION_MS/1000:0)}:{})});res.end();};
 const nextPath=value=>{try{const u=new URL(value,'https://local');return u.origin==='https://local'&&!u.pathname.startsWith('/auth')&&!u.pathname.startsWith('/login')?u.pathname+u.search:'/';}catch{return '/';}};
 function page(res,{account=false,error='',next='/'}={}){
  redirect(res,'/login?'+new URLSearchParams({next:account?'/':nextPath(next),...(error?{error}:{})}));
 }
 async function form(req){
  let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>4096)throw Error('表单过大');}
  return new URLSearchParams(raw);
 }
 async function matches(password,credential){
  if(!credential){await passwordHash(String(password||'').slice(0,256),'corenyan-unknown-account');return false;}
  if(typeof password!=='string'||password.length>256)return false;
  const hash=Buffer.from(await passwordHash(password,credential.salt),'hex');
  return timingSafeEqual(hash,Buffer.from(credential.passwordHash,'hex'));
 }
 return async function authorize(req,res){
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');
  if(applyCors(req,res,{secure}))return true;
  const url=new URL(req.url,(secure?'https':'http')+'://'+req.headers.host);
  if(url.pathname==='/healthz'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end('{"ok":true}');return true;}
  const time=now();
  for(const [ip,a] of attempts)if(a.until<=time)attempts.delete(ip);
  const bearer=/^Bearer ([A-Za-z0-9_-]{43})$/.exec(req.headers.authorization||'')?.[1];
  const token=bearer||String(req.headers.cookie||'').split(';').map(x=>x.trim()).find(x=>x.startsWith(COOKIE+'='))?.slice(COOKIE.length+1);
  const stored=sessions.find(token),credential=stored?accounts.find(stored.accountId):null;
  const session=sessions.get(token,credential),authenticated=!!session;
  if(authenticated){req.auth={...accounts.publicAccount(credential),expiresAt:session.expiresAt};req.sessionKey=createHash('sha256').update(token).digest('hex');}
  if(!['GET','HEAD'].includes(req.method)){
   if(!trustedRequestOrigin(req,secure)||(!bearer&&req.headers['sec-fetch-site']==='cross-site'&&url.pathname!=='/auth/login')){json(res,403,'请从当前控制台页面提交操作');return true;}
  }
  if(authenticated&&await sessions.renew(token)){if(!bearer)res.setHeader('Set-Cookie',cookie(token,SESSION_MS/1000));req.auth.expiresAt=session.expiresAt;}
  if(url.pathname==='/login'&&req.method==='GET'){if(authenticated)redirect(res,nextPath(url.searchParams.get('next')));else page(res,{next:url.searchParams.get('next')});return true;}
  if(url.pathname==='/auth/login'&&req.method==='POST'){
   const ip=req.socket.remoteAddress||'unknown',a=attempts.get(ip)||{count:0,until:time+WINDOW_MS};
   globalAttempts=globalAttempts.filter(t=>t>time-60000);
   if(a.count>=MAX_FAILURES||verifying>=2||globalAttempts.length>=40){res.setHeader('Retry-After','900');json(res,429,'登录尝试过多，请稍后重试');return true;}
   a.count++;attempts.set(ip,a);globalAttempts.push(time);verifying++;
   try{
    const f=await form(req),credential=accounts.byName(f.get('username')),valid=await matches(f.get('password'),credential);
    const apiLogin=req.headers['x-matrix-client']==='pages'&&allowedOrigins.has(req.headers.origin);
    if(!valid){if(apiLogin)json(res,401,'账号或密码错误');else page(res,{error:'账号或密码错误',next:f.get('next')});return true;}
    attempts.delete(ip);const id=await sessions.create(credential,token);
    if(apiLogin){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({ok:true,token:id,expiresAt:time+SESSION_MS}));}else redirect(res,nextPath(f.get('next')),id);return true;
   }catch{json(res,400,'登录请求无效');return true;}finally{verifying--;}
  }
  if(!authenticated){
   if(url.pathname.startsWith('/api/')||url.pathname.startsWith('/auth/'))json(res,401,'请先登录管理控制台');
   else redirect(res,'/login?next='+encodeURIComponent(nextPath(req.url)));
   return true;
  }
  if(url.pathname==='/auth/logout'&&req.method==='POST'){await sessions.remove(token);if(bearer){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({ok:true}));}else redirect(res,'/login','');return true;}
  if(url.pathname==='/api/auth/check'&&req.method==='GET'){res.writeHead(204,{'Cache-Control':'no-store'});res.end();return true;}
  if(url.pathname==='/api/auth/session'&&req.method==='GET'){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({ok:true,...req.auth,website:accounts.website()}));return true;}
  if(url.pathname==='/api/preferences'){
   try{
    let preferences;
    if(req.method==='GET')preferences=accounts.preferences(credential.id);
    else if(req.method==='PATCH'){
     let raw='';for await(const chunk of req){raw+=chunk;if(Buffer.byteLength(raw)>16000)throw Error('请求过大');}
     preferences=accounts.preferences(credential.id,JSON.parse(raw));
    }else{json(res,405,'METHOD_NOT_ALLOWED');return true;}
    res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({ok:true,...preferences}));
   }catch(error){json(res,error.status||400,error.message);}return true;
  }
  if(url.pathname.startsWith('/api/accounts')||url.pathname==='/api/website'){
   try{
    const body=async()=>{let raw='';for await(const b of req){raw+=b;if(Buffer.byteLength(raw)>900000)throw Error('请求过大');}return JSON.parse(raw||'{}');};
    const ok=result=>{res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({ok:true,...result}));};
    if(url.pathname==='/api/website'){if(req.method==='GET')ok({website:accounts.website()});else if(req.method==='PATCH')ok({website:accounts.website(await body())});else json(res,405,'METHOD_NOT_ALLOWED');return true;}
    if(url.pathname==='/api/accounts'&&req.method==='GET'){ok({accounts:credential.role==='owner'?accounts.list():[accounts.publicAccount(credential)]});return true;}
    if(url.pathname==='/api/accounts'&&req.method==='POST'){
     if(credential.role!=='owner'){json(res,403,'只有主管理员可以创建账号');return true;}
     if(verifying>=2){json(res,429,'请稍后重试');return true;}verifying++;try{ok({account:await accounts.create(await body(),passwordHash)});}finally{verifying--;}return true;
    }
    const id=url.pathname.split('/')[3];
    if(!accounts.find(id)||credential.role!=='owner'&&id!==credential.id){json(res,403,'无权管理此账号');return true;}
    if(req.method==='PATCH'){const changes=await body();if(changes.linkedQQ!==undefined&&credential.role!=='owner'){json(res,403,'只有主管理员可以关联 QQ 身份');return true;}ok({account:accounts.update(id,changes)});return true;}
    if(req.method==='DELETE'){accounts.remove(id);await invalidate(id);ok({});return true;}
    json(res,405,'METHOD_NOT_ALLOWED');return true;
   }catch(e){json(res,400,e.message);return true;}
  }
  if(url.pathname==='/account'&&req.method==='GET'){page(res,{account:true});return true;}
  if(url.pathname==='/auth/password'&&req.method==='POST'){
   const ip=req.socket.remoteAddress||'unknown',a=attempts.get(ip)||{count:0,until:time+WINDOW_MS};
   if(a.count>=MAX_FAILURES||verifying>=2){json(res,429,'尝试过多，请稍后重试');return true;}
   a.count++;attempts.set(ip,a);verifying++;
   try{
    const f=await form(req),p=f.get('password')||'';
    if(!await matches(f.get('current'),credential)){if(req.headers.accept?.includes('application/json'))json(res,400,'当前密码错误');else page(res,{account:true,error:'当前密码错误'});return true;}
    if(p.length<16||p.length>256||p!==f.get('confirm')){if(req.headers.accept?.includes('application/json'))json(res,400,'新密码需为 16–256 位，且两次输入一致');else page(res,{account:true,error:'新密码需为 16–256 位，且两次输入一致'});return true;}
    const salt=randomBytes(24).toString('hex');accounts.password(credential.id,salt,await passwordHash(p,salt));
    await invalidate(credential.id);attempts.delete(ip);if(req.headers.accept?.includes('application/json')){res.writeHead(200,{'Content-Type':'application/json','Cache-Control':'no-store','Set-Cookie':cookie('',0)});res.end(JSON.stringify({ok:true}));}else redirect(res,'/login','');return true;
   }catch{json(res,500,'密码保存失败');return true;}finally{verifying--;}
  }
  res.setHeader('Cache-Control','no-store');return false;
 };
}
