// The account store remains the authority. No browser session or cached role is
// used to recover already accepted tasks; deleted accounts are never scheduled.
export function startChatRecovery({accounts,recover,logger=console.warn,intervalMs=15000}){
 let running=false,closed=false;
 const tick=async()=>{
  if(running||closed)return;running=true;
  try{
   for(const account of accounts.list()){
    if(closed)break;
    const current=accounts.find(account.id);if(!current)continue;
    try{await recover(accounts.publicAccount(current));}
    catch(error){logger('[CHAT] background recovery unavailable: '+String(error.code||error.message||'UNAVAILABLE').slice(0,100));break;}
   }
  }finally{running=false;}
 };
 const timer=setInterval(()=>void tick(),intervalMs);timer.unref?.();queueMicrotask(()=>void tick());
 return {tick,close(){closed=true;clearInterval(timer);}};
}
