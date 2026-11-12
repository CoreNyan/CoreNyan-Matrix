import http from 'node:http';
import https from 'node:https';
import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {randomInt} from 'node:crypto';
const directory=path.dirname(fileURLToPath(import.meta.url));
const types={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.json':'application/json; charset=utf-8','.css':'text/css; charset=utf-8','.png':'image/png','.jpg':'image/jpeg','.jpeg':'image/jpeg','.webp':'image/webp','.gif':'image/gif','.svg':'image/svg+xml','.woff2':'font/woff2','.ico':'image/x-icon','.crt':'application/x-pem-file'};
export function createFrontend({webRoot=path.join(directory,'web'),contractsRoot=path.resolve(directory,'../contracts'),backendUrl='http://127.0.0.1:26000',securityDirectory,plainHttp=false}={}){
 const upstream=new URL(backendUrl);
 if(!['http:','https:'].includes(upstream.protocol)||upstream.username||upstream.password)throw Error('Invalid API upstream');
 const transport=upstream.protocol==='https:'?https:http;
 const doodles=fs.readdirSync(path.join(webRoot,'assets/doodle'),{withFileTypes:true}).filter(entry=>entry.isFile()&&/^doodle_\d+\.png$/.test(entry.name)).map(entry=>'/assets/doodle/'+entry.name);
 if(!doodles.length)throw Error('Login doodle assets missing');
 const publicDoodles=new Set(doodles);
 const fail=(res,status,message)=>{if(res.headersSent){res.destroy();return;}res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify({ok:false,error:message}));};
 function request(req,pathname,method=req.method){return transport.request({hostname:upstream.hostname,port:upstream.port,path:pathname,method,headers:{...req.headers,host:req.headers.host,'x-forwarded-proto':'https'},timeout:120000});}
 function proxy(req,res){const forward=request(req,req.url);forward.on('response',r=>{res.writeHead(r.statusCode,r.headers);r.pipe(res);});forward.on('timeout',()=>forward.destroy(Error('timeout')));forward.on('error',()=>fail(res,502,'Matrix 后端暂不可用'));req.on('aborted',()=>forward.destroy());res.on('close',()=>{if(!res.writableEnded)forward.destroy();});req.pipe(forward);}
 async function authenticated(req,res){return new Promise(resolve=>{const check=request(req,'/api/auth/check','GET');check.removeHeader('content-length');check.removeHeader('transfer-encoding');check.setTimeout(10000,()=>check.destroy());check.on('response',r=>{if(r.statusCode===204&&r.headers['set-cookie'])res.setHeader('Set-Cookie',r.headers['set-cookie']);r.resume();resolve(r.statusCode);});check.on('error',()=>resolve(502));check.end();});}
 const handler=async(req,res)=>{
  res.setHeader('X-Content-Type-Options','nosniff');res.setHeader('X-Frame-Options','DENY');res.setHeader('Referrer-Policy','same-origin');
  try{
   if(!req.url.startsWith('/')||req.url.startsWith('//'))return fail(res,400,'Invalid path');
   const url=new URL(req.url,'https://matrix.local'),pathname=decodeURIComponent(url.pathname);
   if(/^\/(api|auth)\//.test(pathname)||pathname==='/healthz'||pathname.startsWith('/assets/uploads/'))return proxy(req,res);
   if(!['GET','HEAD'].includes(req.method))return fail(res,405,'METHOD_NOT_ALLOWED');
   const publicAsset=['/contracts/product.json','/pages-bootstrap.js','/login','/login.js','/css/login.css','/assets/favicon.ico','/assets/app-icon.png'].includes(pathname)||publicDoodles.has(pathname);
   if(!publicAsset){const status=await authenticated(req,res);if(status===401){res.writeHead(303,{Location:'/login?next='+encodeURIComponent(url.pathname+url.search),'Cache-Control':'no-store'});res.end();return;}if(status!==204)return fail(res,502,'Matrix 登录服务暂不可用');}
   const isContract=pathname.startsWith('/contracts/'),base=path.resolve(isContract?contractsRoot:webRoot);
   const relative=pathname==='/login'?'login.html':pathname==='/'||/^\/(VITALS|LAYERS|ORGANS|CORTEX|SYNAPSE|ENTITY|CHAT)(?:\/|$)/i.test(pathname)?'index.html':isContract?pathname.slice('/contracts/'.length):pathname.slice(1);
   const file=path.resolve(base,relative);
   if(!file.startsWith(base+path.sep)||!fs.existsSync(file)||!fs.statSync(file).isFile()||!fs.realpathSync(file).startsWith(fs.realpathSync(base)+path.sep))return fail(res,404,'NOT_FOUND');
   if(pathname==='/login'){
    const html=(await fs.promises.readFile(file,'utf8')).replace(/(data-login-doodle src=")[^"]+"/,'$1'+doodles[randomInt(doodles.length)]+'"');
    res.writeHead(200,{'Content-Type':types['.html'],'Cache-Control':'no-store'});res.end(req.method==='HEAD'?undefined:html);return;
   }
   res.writeHead(200,{'Content-Type':types[path.extname(file)]||'application/octet-stream','Cache-Control':'no-cache'});if(req.method==='HEAD')res.end();else fs.createReadStream(file).pipe(res);
  }catch{fail(res,400,'Invalid request');}
 };
 if(plainHttp)return http.createServer(handler);
 const keyFile=path.join(securityDirectory,'server.key'),certFile=path.join(securityDirectory,'server.crt');
 const tls=()=>({key:fs.readFileSync(keyFile),cert:fs.readFileSync(certFile)}),server=https.createServer(tls(),handler);
 let reload;const changed=()=>{clearTimeout(reload);reload=setTimeout(()=>{try{server.setSecureContext(tls());console.log('[Matrix TLS] Certificate reloaded');}catch{console.error('[Matrix TLS] Renewal files incomplete; retaining current certificate');}},1000);reload.unref();};
 fs.watchFile(keyFile,{persistent:false,interval:30000},changed);fs.watchFile(certFile,{persistent:false,interval:30000},changed);
 server.on('close',()=>{clearTimeout(reload);fs.unwatchFile(keyFile,changed);fs.unwatchFile(certFile,changed);});return server;
}
if(process.argv[1]&&path.resolve(process.argv[1])===fileURLToPath(import.meta.url)){
 const port=Number(process.env.MATRIX_PORT||25999),host=process.env.MATRIX_HOST||'0.0.0.0';
 createFrontend({backendUrl:process.env.MATRIX_API_URL||'http://127.0.0.1:26000',securityDirectory:process.env.MATRIX_TLS_DIR||process.env.CORENYAN_WEB_SECURITY_DIR}).listen(port,host,()=>console.log('[Matrix Frontend] HTTPS listening on '+port));
}
