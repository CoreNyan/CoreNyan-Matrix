// Runs before application modules. Progress counts completed work, never elapsed time.
(()=>{
 const definitions=[['config','配置连接'],['connection','连接服务'],['interface','构建界面'],['content','读取首屏'],['assets','准备资源'],['frame','绘制画面']];
 const steps=definitions.map(([id,label])=>({id,label,status:'pending',detail:''})),listeners=new Set();
 const snapshot=()=>({steps:steps.map(s=>({...s})),percent:Math.floor(100*steps.filter(s=>['done','skipped'].includes(s.status)).length/steps.length)});
 function update(id,status,detail=''){const step=steps.find(s=>s.id===id);if(!step||['done','skipped'].includes(step.status))return;Object.assign(step,{status,detail:String(detail)});for(const listener of listeners)listener(snapshot());}
 const boot={snapshot,begin:id=>update(id,'running'),done:id=>update(id,'done'),fail:(id,error)=>update(id,'failed',error?.message||error),skip:id=>update(id,'skipped'),subscribe(listener){listeners.add(listener);listener(snapshot());return()=>listeners.delete(listener);}};
 Object.defineProperty(window,'MatrixBoot',{value:Object.freeze(boot)});
 function mount(){
  if(!document.body||document.querySelector('.terminal-session'))return;
  const panel=document.createElement('aside');panel.className='terminal-session';panel.setAttribute('aria-label','连接 CoreNyan');
  panel.innerHTML='<div class="terminal-coordinate" aria-hidden="true"><span class="terminal-cross">+</span> CORENYAN / TERMINAL</div><div class="terminal-rail" aria-hidden="true"><div class="terminal-rail-fill"></div></div><div class="terminal-core"><div class="terminal-intro"><div class="terminal-kicker"><span class="terminal-led"></span><span data-boot-heading>CONNECTING</span></div><h1 class="terminal-title" data-boot-title>终端接入</h1><ol class="terminal-stages"></ol></div><div class="terminal-display"><div class="terminal-wordmark"><svg viewBox="0 0 310 182" role="img" aria-label="CoreNyan"><g fill="currentColor" fill-rule="evenodd"><path d="M64 0H14L0 14V68L14 82H64V65H20V17H64Z"/><path d="M88 0H132L146 14V68L132 82H88L74 68V14ZM94 17V65H126V17Z"/><path d="M158 0H211L226 15V43L215 54L230 82H208L191 55H176V82H158ZM176 17V39H205V17Z"/><path d="M240 0H304V17H258V32H295V49H258V65H304V82H240Z"/><g transform="translate(0 100)"><path d="M0 82V0H18L49 48V0H67V82H49L18 34V82Z"/><path d="M80 0H100L116 30L132 0H152L125 47V82H107V47Z"/><path d="M158 82L180 0H205L229 82H209L204 63H180L175 82ZM184 47H200L192 17Z"/><path d="M240 82V0H258L289 48V0H307V82H289L258 34V82Z"/></g></g></svg></div><div class="terminal-status" role="status" aria-live="polite" data-boot-status>正在建立连接</div><div class="terminal-actions" hidden><button type="button" data-boot-retry>重新连接 ↗</button><button type="button" data-boot-continue hidden>先进入界面 →</button></div></div><div class="terminal-progress-block"><div class="terminal-progress-meta"><div><span data-boot-stage>配置连接</span><span class="terminal-counter" data-boot-count>00 / 06</span></div><span class="terminal-percentage"><b data-boot-percent>0</b><small>%</small></span></div><div class="terminal-progress" role="progressbar" aria-label="启动准备进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><div class="terminal-progress-fill"></div><div class="terminal-progress-cursor"></div></div><div class="terminal-ruler" aria-hidden="true"><span>0</span><span>25</span><span>50</span><span>75</span><span>100</span></div></div></div><div class="terminal-foot"><span data-boot-footer>等待连接</span><span aria-hidden="true">CORENYAN</span></div><div class="terminal-scan" aria-hidden="true"></div>';
  const list=panel.querySelector('.terminal-stages');
  for(const step of steps){const item=document.createElement('li');item.dataset.bootStep=step.id;item.innerHTML='<i aria-hidden="true">'+String(steps.indexOf(step)+1).padStart(2,'0')+'</i><span></span><em aria-hidden="true"></em>';item.querySelector('span').textContent=step.label;list.append(item);}
  panel.querySelector('[data-boot-retry]').onclick=()=>location.reload();
  panel.querySelector('[data-boot-continue]').onclick=()=>{for(const step of steps)if(step.status==='failed'&&['content','assets'].includes(step.id))boot.skip(step.id);};
  document.body.append(panel);
  boot.subscribe(state=>{
   if(['opening','open','closing','closed'].includes(document.documentElement.dataset.terminalPhase))return;
   const failed=state.steps.find(s=>s.status==='failed'),active=failed||state.steps.find(s=>s.status==='running')||state.steps.find(s=>s.status==='pending');
   panel.dataset.failed=String(Boolean(failed));panel.style.setProperty('--boot-progress',String(state.percent/100));
   panel.querySelector('.terminal-progress').setAttribute('aria-valuenow',String(state.percent));
   panel.querySelector('[data-boot-percent]').textContent=String(state.percent);
   panel.querySelector('[data-boot-count]').textContent=String(state.steps.filter(s=>['done','skipped'].includes(s.status)).length).padStart(2,'0')+' / 06';
   panel.querySelector('[data-boot-heading]').textContent=failed?'CONNECTION PAUSED':state.percent===100?'CONNECTED':'CONNECTING';
   panel.querySelector('[data-boot-status]').textContent=failed?failed.detail:active?'正在'+active.label:'准备就绪';
   panel.querySelector('[data-boot-stage]').textContent=active?.label||'准备完成';
   panel.querySelector('[data-boot-footer]').textContent=failed?'连接尚未完成':state.steps.find(s=>s.id==='connection').status==='done'?'服务已连接':'正在连接服务';
   panel.querySelector('.terminal-actions').hidden=!failed;
   panel.querySelector('[data-boot-continue]').hidden=!failed||!state.steps.some(s=>s.id==='interface'&&s.status==='done')||state.steps.some(s=>!['content','assets'].includes(s.id)&&s.status==='failed');
   for(const step of state.steps)panel.querySelector('[data-boot-step="'+step.id+'"]').dataset.status=step.status;
  });
 }
 const observer=new MutationObserver(()=>{if(document.body){mount();observer.disconnect();}});observer.observe(document.documentElement,{childList:true});mount();
})();
