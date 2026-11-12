import {readFile,stat} from 'node:fs/promises';
export async function readOnebotLogin(file,now=Date.now()){
 try{
  if((await stat(file)).size>32768)throw Error('STATE_SIZE');
  const state=JSON.parse(await readFile(file,'utf8'));
  if(state.version!==1||!Number.isFinite(state.updatedAt)||state.updatedAt>now+5000||!Number.isFinite(state.expiresAt)||state.expiresAt<=now||now-state.updatedAt>30000)return {status:'stale',message:'登录状态暂未更新，正在等待二维码助手恢复。',rows:null};
  if(!['starting','online','waiting','qr','expired','capture_error'].includes(state.status))throw Error('STATE_INVALID');
  const rows=state.status==='qr'?state.rows:null;
  if(rows&&(!Array.isArray(rows)||rows.length<10||rows.length>80||!rows.every(r=>typeof r==='string'&&/^[ ▀▄█]{20,160}$/.test(r)&&r.length===rows[0].length)))throw Error('QR_INVALID');
  const lifecycle=Object.fromEntries(['clientStartedAt','lastOfflineAt'].map(key=>[key,Number.isFinite(state.lifecycle?.[key])&&state.lifecycle[key]>0&&state.lifecycle[key]<=now?state.lifecycle[key]:null]));
  return {status:state.status,message:String(state.message||'').slice(0,180),updatedAt:state.updatedAt,expiresAt:state.expiresAt,rows,lifecycle,account:state.status==='online'&&/^[1-9][0-9]{4,14}$/.test(String(state.account?.qq||''))?{qq:String(state.account.qq),nickname:String(state.account.nickname||'QQ').slice(0,80)}:null};
 }catch{return {status:'unavailable',message:'二维码助手尚未就绪，请稍候。QQ 不会因此重启。',rows:null};}
}
