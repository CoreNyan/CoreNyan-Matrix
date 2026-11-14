// Runs before application modules. Progress counts completed work, never elapsed time.
(()=>{
 const definitions=[['config','配置连接'],['connection','连接服务'],['interface','构建界面'],['content','读取首屏'],['assets','准备资源'],['frame','绘制画面']];
 const steps=definitions.map(([id,label])=>({id,label,status:'pending',detail:''})),listeners=new Set();
 const snapshot=()=>({steps:steps.map(s=>({...s})),percent:Math.floor(100*steps.filter(s=>['done','skipped'].includes(s.status)).length/steps.length)});
 function update(id,status,detail=''){const step=steps.find(s=>s.id===id);if(!step||['done','skipped'].includes(step.status))return;Object.assign(step,{status,detail:String(detail)});for(const listener of listeners)listener(snapshot());}
 let doodleReady=Promise.resolve();
 const boot={snapshot,doodleReady:()=>doodleReady,begin:id=>update(id,'running'),done:id=>update(id,'done'),fail:(id,error)=>update(id,'failed',error?.message||error),skip:id=>update(id,'skipped'),subscribe(listener){listeners.add(listener);listener(snapshot());return()=>listeners.delete(listener);}};
 Object.defineProperty(window,'MatrixBoot',{value:Object.freeze(boot)});
 function mount(){
  if(!document.body||document.querySelector('.terminal-session'))return;
  const panel=document.createElement('aside');panel.className='terminal-session';panel.setAttribute('aria-label','连接 CoreNyan');
  panel.innerHTML='<div class="terminal-core"><div class="terminal-brand-pair"><div class="terminal-wordmark"><svg viewBox="0 0 310 182" role="img" aria-label="CoreNyan"><g fill="currentColor" fill-rule="evenodd"><path d="M64 0H14L0 14V68L14 82H64V65H20V17H64Z"/><path d="M88 0H132L146 14V68L132 82H88L74 68V14ZM94 17V65H126V17Z"/><path d="M158 0H211L226 15V43L215 54L230 82H208L191 55H176V82H158ZM176 17V39H205V17Z"/><path d="M240 0H304V17H258V32H295V49H258V65H304V82H240Z"/><g transform="translate(0 100)"><path d="M0 82V0H18L49 48V0H67V82H49L18 34V82Z"/><path d="M80 0H100L116 30L132 0H152L125 47V82H107V47Z"/><path d="M158 82L180 0H205L229 82H209L204 63H180L175 82ZM184 47H200L192 17Z"/><path d="M240 82V0H258L289 48V0H307V82H289L258 34V82Z"/></g></g></svg></div><figure class="terminal-illustration"><div class="terminal-doodle terminal-progress" role="progressbar" aria-label="小可线稿绘制进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><svg viewBox="-8 -8 245 230" aria-hidden="true"><g class="terminal-doodle-ink"></g><circle class="terminal-doodle-pen" r="2.5" cx="0" cy="0"/></svg></div></figure></div><div class="terminal-status-row"><span class="terminal-status" role="status" aria-live="polite" data-boot-status>接入神经</span><span class="terminal-percentage" aria-hidden="true"><b data-boot-percent>0</b><small>%</small></span></div><div class="terminal-actions" hidden><button type="button" data-boot-retry>重新连接 ↗</button><button type="button" data-boot-continue hidden>先进入界面 →</button></div></div>';
  panel.querySelector('[data-boot-retry]').onclick=()=>location.reload();
  panel.querySelector('[data-boot-continue]').onclick=()=>{for(const step of steps)if(step.status==='failed'&&['content','assets'].includes(step.id))boot.skip(step.id);};
  document.body.append(panel);
  let drawing;
  doodleReady=loadDoodle(panel).then(()=>{drawing=mountDoodleProgress(panel);drawing.update(boot.snapshot().percent/100);});
  doodleReady.catch(()=>{}); // The asset stage displays the error and recovery actions.
  boot.subscribe(state=>{
   if(['opening','open','closing','closed'].includes(document.documentElement.dataset.terminalPhase))return;
   const failed=state.steps.find(s=>s.status==='failed'),active=failed||state.steps.find(s=>s.status==='running')||state.steps.find(s=>s.status==='pending');
   panel.dataset.failed=String(Boolean(failed));drawing?.update(state.percent/100);
   panel.querySelector('.terminal-progress').setAttribute('aria-valuenow',String(state.percent));
   panel.querySelector('[data-boot-percent]').textContent=String(state.percent);
   panel.querySelector('[data-boot-status]').textContent=failed?failed.detail:active?'接入神经 · '+active.label:'神经已接入';
   panel.querySelector('.terminal-actions').hidden=!failed;
   panel.querySelector('[data-boot-continue]').hidden=!failed||!state.steps.some(s=>s.id==='interface'&&s.status==='done')||state.steps.some(s=>!['content','assets'].includes(s.id)&&s.status==='failed');
  });
 }
// Stroke-distance progress: no image masks, alpha reveal or synthetic progress timer.
 function mountDoodleProgress(panel){
  const host=panel.querySelector('.terminal-doodle'),pen=host.querySelector('.terminal-doodle-pen');
  const paths=[...host.querySelectorAll('[data-doodle-stroke]')];
  const measured=paths.map(p=>p.getTotalLength()),lengths=measured,total=lengths.reduce((a,b)=>a+b,0),reduce=matchMedia('(prefers-reduced-motion: reduce)');
  let value=0,target=0,raf=0,last=0,disposed=false;
  function paint(){
   let remaining=value*total,active=-1;
   paths.forEach((path,i)=>{const fraction=Math.min(1,Math.max(0,remaining/lengths[i]));path.style.strokeDashoffset=String(1-fraction);path.style.visibility=fraction>0?'visible':'hidden';if(fraction>0&&fraction<1){active=i;const point=path.getPointAtLength(measured[i]*fraction);pen.setAttribute('cx',point.x);pen.setAttribute('cy',point.y);}remaining-=lengths[i];});
   pen.style.visibility=active>=0&&Math.abs(value-target)>.0001?'visible':'hidden';
   host.dataset.drawn=String(value);
  }
  function tick(now){
   raf=0;if(disposed)return;
   const dt=last?Math.min(64,now-last):16;last=now;
   value=reduce.matches||document.documentElement.classList.contains('motion-disabled')?target:Math.min(target,value+dt/650);paint();
   if(value<target)raf=requestAnimationFrame(tick);else last=0;
  }
  function stop(){cancelAnimationFrame(raf);raf=0;last=0;pen.style.visibility='hidden';}
  function update(progress){
   target=Math.max(target,Math.min(1,progress));
   if(disposed)return;
   if(reduce.matches||document.documentElement.classList.contains('motion-disabled')){stop();value=target;paint();}
   else if(!raf&&value<target)raf=requestAnimationFrame(tick);
  }
  reduce.addEventListener('change',()=>update(target));
  addEventListener('matrix-terminal-settled',stop);
  addEventListener('pagehide',()=>{disposed=true;stop();},{once:true});
  paint();return {update};
 }

 async function loadDoodle(panel){
  // One selection per document; progress and shutdown keep the same character.
  const id=1+Math.floor(crypto.getRandomValues(new Uint32Array(1))[0]/4294967296*37);
  const host=panel.querySelector('.terminal-doodle');host.dataset.doodleId=String(id);
  const response=await fetch('/assets/terminal-doodles/doodle_'+id+'.json',{signal:AbortSignal.timeout(10000)});
  if(!response.ok)throw Error('加载小可线稿失败，可重试或先进入界面');
  const data=await response.json();
  if(data.viewBox!=='-8 -8 245 230'||!Array.isArray(data.strokes)||!data.strokes.length||data.strokes.length>500)throw Error('线稿数据不完整');
  const ink=host.querySelector('.terminal-doodle-ink'),fragment=document.createDocumentFragment();
  for(const stroke of data.strokes){
   if(typeof stroke.d!=='string'||stroke.d.length>20000||!/^M[MLQ0-9., \-]+$/.test(stroke.d))throw Error('线稿路径无效');
   const path=document.createElementNS('http://www.w3.org/2000/svg','path');path.setAttribute('d',stroke.d);path.setAttribute('pathLength','1');path.setAttribute('data-doodle-stroke','');fragment.append(path);
  }
  ink.replaceChildren(fragment);host.dataset.doodleReady='true';
 }
 const observer=new MutationObserver(()=>{if(document.body){mount();observer.disconnect();}});observer.observe(document.documentElement,{childList:true});mount();
})();
