import {execFile} from 'node:child_process';
import {promisify} from 'node:util';
const run=promisify(execFile);
const actions=new Set(['status','start','poll','check']);
export async function callBilibiliLogin(action){
 if(!actions.has(action))throw Error('BILI_LOGIN_ACTION_INVALID');
 try{const {stdout}=await run('docker',['exec','corenyan-gateway','node','src/modules/bilibili/login.cjs',action],{timeout:30000,maxBuffer:16384});return JSON.parse(stdout);}
 catch(error){try{const result=JSON.parse(error.stdout);if(result.ok===false&&/^BILI_[A-Z0-9_-]+$/.test(result.error))return result;}catch{}return {ok:false,error:'BILI_LOGIN_UNAVAILABLE'};}
}
export async function handleBilibiliLogin(req,res,{readBody,send,trustedOrigin,call=callBilibiliLogin}){
 res.setHeader('Cache-Control','private, no-store');
 if(req.auth?.role!=='owner')return send(res,403,{ok:false,error:'OWNER_REQUIRED'});
 if(!['GET','POST'].includes(req.method))return send(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'});
 if(req.method==='POST'&&!trustedOrigin(req))return send(res,403,{ok:false,error:'ORIGIN_DENIED'});
 const action=req.method==='GET'?'status':(await readBody(req)).action;
 if(!actions.has(action))return send(res,400,{ok:false,error:'BILI_LOGIN_ACTION_INVALID'});
 const result=await call(action);return send(res,result.ok===false?502:200,result);
}
