// One writer: edits made during a request are saved after that request completes.
export function createAutosave(save,{delay,onState=()=>{}}){
 let timer,running,wanted=false;
 function schedule(){wanted=true;clearTimeout(timer);onState('pending');timer=setTimeout(flush,delay);}
 async function flush(){
  clearTimeout(timer);wanted=true;
  if(running)return running;
  running=(async()=>{
   try{while(wanted){wanted=false;onState('saving');await save();}onState('saved');return true;}
   catch(e){wanted=false;onState('error',e);return false;}
   finally{running=null;}
  })();
  return running;
 }
 return {schedule,flush,cancel(){clearTimeout(timer);wanted=false;return running||Promise.resolve();}};
}
