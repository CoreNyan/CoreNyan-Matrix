// Polling may batch messages which the server delivered seconds apart. Preserve
// those gaps for live arrivals; opening history or resuming a tab is immediate.
export function createChatArrivals({onChange,now=()=>performance.now(),schedule=setTimeout,cancel=clearTimeout}={}){
 const due=new Map();let last=null,timer=null;
 const visible=message=>!due.has(message.id)||due.get(message.id)<=now();
 function clear(){if(timer!==null)cancel(timer);timer=null;due.clear();last=null;}
 function arm(){
  if(timer!==null)cancel(timer);timer=null;
  const next=Math.min(...[...due.values()].filter(at=>at>now()));
  if(Number.isFinite(next))timer=schedule(()=>{timer=null;onChange();arm();},Math.max(1,next-now()));
 }
 function ingest(messages,{immediate=false}={}){
  if(immediate)clear();
  const ids=new Set(messages.map(m=>m.id));for(const id of due.keys())if(!ids.has(id))due.delete(id);
  // A new user message must not overtake earlier bubbles still awaiting display.
  const userIndex=messages.findLastIndex(m=>m.role==='user'&&!due.has(m.id));
  if(userIndex>=0){for(const message of messages.slice(0,userIndex+1))due.set(message.id,now());last=null;}
  for(const message of messages){
   if(message.role!=='assistant'||message.status==='withdrawn'){due.set(message.id,now());continue;}
   if(due.has(message.id))continue;
   const created=Number(message.created),gap=last?Math.min(5000,Math.max(0,created-last.created)):0;
   const at=immediate?now():Math.max(now(),last?last.at+gap:now());
   due.set(message.id,at);if(!immediate)last={created,at};
  }
  arm();
 }
 return {ingest,visible,clear};
}
