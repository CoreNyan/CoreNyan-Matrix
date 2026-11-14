// Runs before application modules. Progress counts completed work, never elapsed time.
(()=>{
 const definitions=[['config','配置连接'],['connection','连接服务'],['interface','构建界面'],['content','同步内容'],['assets','准备资源'],['frame','绘制画面']];
 const steps=definitions.map(([id,label])=>({id,label,status:'pending',detail:''})),listeners=new Set();
 const snapshot=()=>({steps:steps.map(s=>({...s})),percent:Math.floor(100*steps.filter(s=>['done','skipped'].includes(s.status)).length/steps.length)});
 function update(id,status,detail=''){const step=steps.find(s=>s.id===id);if(!step||['done','skipped'].includes(step.status))return;Object.assign(step,{status,detail:String(detail)});for(const listener of listeners)listener(snapshot());}
 let doodleReady=Promise.resolve(),visualReady=()=>Promise.resolve(),visualValue=0;
 const visualListeners=new Set();
 const boot={snapshot,doodleReady:()=>doodleReady,visualReady:immediate=>visualReady(immediate),onVisual(listener){visualListeners.add(listener);listener(visualValue);return()=>visualListeners.delete(listener);},begin:id=>update(id,'running'),done:id=>update(id,'done'),fail:(id,error)=>update(id,'failed',error?.message||error),skip:id=>update(id,'skipped'),subscribe(listener){listeners.add(listener);listener(snapshot());return()=>listeners.delete(listener);}};
 Object.defineProperty(window,'MatrixBoot',{value:Object.freeze(boot)});
 function mount(){
  if(!document.body||document.querySelector('.terminal-session'))return;
  const panel=document.createElement('aside');panel.className='terminal-session';panel.setAttribute('aria-label','连接 CoreNyan');
  panel.innerHTML='<div class="terminal-core"><div class="terminal-brand-pair"><div class="terminal-wordmark"><svg viewBox="0 0 310 182" role="img" aria-label="CoreNyan"><g fill="currentColor" fill-rule="evenodd"><path d="M64 0H14L0 14V68L14 82H64V65H20V17H64Z"/><path d="M88 0H132L146 14V68L132 82H88L74 68V14ZM94 17V65H126V17Z"/><path d="M158 0H211L226 15V43L215 54L230 82H208L191 55H176V82H158ZM176 17V39H205V17Z"/><path d="M240 0H304V17H258V32H295V49H258V65H304V82H240Z"/><g transform="translate(0 100)"><path d="M0 82V0H18L49 48V0H67V82H49L18 34V82Z"/><path d="M80 0H100L116 30L132 0H152L125 47V82H107V47Z"/><path d="M158 82L180 0H205L229 82H209L204 63H180L175 82ZM184 47H200L192 17Z"/><path d="M240 82V0H258L289 48V0H307V82H289L258 34V82Z"/></g></g></svg></div><figure class="terminal-illustration"><div class="terminal-doodle terminal-progress" role="progressbar" aria-label="小可线稿绘制进度" aria-valuemin="0" aria-valuemax="100" aria-valuenow="0"><svg viewBox="-8 -8 245 230" aria-hidden="true"><g class="terminal-doodle-ink"></g><circle class="terminal-doodle-pen" r="2.5" cx="0" cy="0"/></svg></div></figure></div><div class="terminal-status-row"><span class="terminal-status" role="status" aria-live="polite" data-boot-status>接入神经</span><span class="terminal-percentage" aria-hidden="true"><b data-boot-percent>0</b><small>%</small></span></div><div class="terminal-actions" hidden><button type="button" data-boot-retry>重新连接 ↗</button><button type="button" data-boot-continue hidden>先进入界面 →</button></div></div>';
  panel.querySelector('[data-boot-retry]').onclick=()=>location.reload();
  panel.querySelector('[data-boot-continue]').onclick=()=>{for(const step of steps)if(step.status==='failed'&&['content','assets'].includes(step.id))boot.skip(step.id);};
  document.body.append(panel);
  const drawing=mountDoodleProgress(panel);visualReady=immediate=>drawing.settled(immediate);
  doodleReady=loadDoodle(panel).then(()=>drawing.refresh());
  doodleReady.catch(()=>drawing.refresh()); // The asset stage displays the error and recovery actions.
  boot.subscribe(state=>{
   if(['opening','open','closing','closed'].includes(document.documentElement.dataset.terminalPhase))return;
   const failed=state.steps.find(s=>s.status==='failed');
   panel.dataset.failed=String(Boolean(failed));drawing.update(state.percent/100);
   panel.querySelector('[data-boot-status]').textContent=failed?failed.detail:'接入神经';
   panel.querySelector('.terminal-actions').hidden=!failed;
   panel.querySelector('[data-boot-continue]').hidden=!failed||!state.steps.some(s=>s.id==='interface'&&s.status==='done')||state.steps.some(s=>!['content','assets'].includes(s.id)&&s.status==='failed');
  });
 }
// One bounded visual timeline follows actual completed work; never advances past it.
 function mountDoodleProgress(panel){
  const host=panel.querySelector('.terminal-doodle'),pen=host.querySelector('.terminal-doodle-pen'),percent=panel.querySelector('[data-boot-percent]');
  const reduce=matchMedia('(prefers-reduced-motion: reduce)'),assemble=mountWordmark(panel);
  let paths=[],lengths=[],total=0,value=0,target=0,raf=0,last=0,disposed=false,ready=false;
  const waiters=new Set();
  function notify(){for(const resolve of waiters)resolve();waiters.clear();}
  function paint(){
   let remaining=value*total,active=-1;
   paths.forEach((path,i)=>{const fraction=Math.min(1,Math.max(0,remaining/lengths[i]));path.style.strokeDashoffset=String(1-fraction);path.style.visibility=fraction>0?'visible':'hidden';if(fraction>0&&fraction<1){active=i;const point=path.getPointAtLength(lengths[i]*fraction);pen.setAttribute('cx',point.x);pen.setAttribute('cy',point.y);}remaining-=lengths[i];});
   pen.style.visibility=active>=0&&Math.abs(value-target)>.0001?'visible':'hidden';
   host.dataset.drawn=String(value);host.setAttribute('aria-valuenow',String(Math.floor(value*100)));
   percent.textContent=String(Math.floor(value*100));panel.style.setProperty('--display-progress',String(value));panel.style.setProperty('--reveal-inset',((1-value)*50)+'%');panel.toggleAttribute('data-reveal-started',value>0);assemble(value);visualValue=value;for(const listener of visualListeners)listener(value);
  }
  function tick(now){
   raf=0;if(disposed)return;
   const dt=last?Math.min(40,now-last):16;last=now;
   const diff=target-value;
   value=reduce.matches||document.documentElement.classList.contains('motion-disabled')||diff<.0005?target:value+Math.min(dt/1800,diff*(1-Math.exp(-dt/120)));
   paint();if(value<target)raf=requestAnimationFrame(tick);else{last=0;notify();}
  }
  function stop(){cancelAnimationFrame(raf);raf=0;last=0;pen.style.visibility='hidden';}
  function update(progress){
   target=Math.max(target,Math.min(1,progress));host.dataset.target=String(target);
   if(disposed||!ready)return;
   if(reduce.matches||document.documentElement.classList.contains('motion-disabled')){stop();value=target;paint();notify();}
   else if(!raf&&value<target)raf=requestAnimationFrame(tick);
  }
  function refresh(){ready=true;paths=[...host.querySelectorAll('[data-doodle-stroke]')];lengths=paths.map(p=>Math.max(.001,p.getTotalLength()));total=lengths.reduce((a,b)=>a+b,0);paint();update(target);}
  function settled(immediate=false){if(immediate){stop();value=target;paint();notify();}return disposed||value===target?Promise.resolve():new Promise(resolve=>waiters.add(resolve));}
  reduce.addEventListener('change',()=>update(target));
  addEventListener('matrix-terminal-settled',()=>{stop();notify();});
  addEventListener('pagehide',()=>{disposed=true;stop();notify();},{once:true});
  paint();return {update,refresh,settled};
 }
 // Each letter consists of two interlocking pieces. Their offsets collapse with progress.
 function mountWordmark(panel){
  const svg=panel.querySelector('.terminal-wordmark svg'),ns='http://www.w3.org/2000/svg',pieces=[];
  const defs=document.createElementNS(ns,'defs');svg.prepend(defs);
  const letters=[...svg.querySelectorAll('path')];
  letters.forEach((path,i)=>{
   const box=path.getBBox();path.setAttribute('opacity','.1');path.dataset.logoGuide='';
   for(let half=0;half<2;half++){
    const clip=document.createElementNS(ns,'clipPath'),rect=document.createElementNS(ns,'rect'),group=document.createElementNS(ns,'g'),copy=path.cloneNode();
    clip.id='terminal-letter-'+i+'-'+half;clip.setAttribute('clipPathUnits','userSpaceOnUse');
    rect.setAttribute('x',box.x-1);rect.setAttribute('y',box.y+box.height*half/2);rect.setAttribute('width',box.width+2);rect.setAttribute('height',box.height/2+.05);clip.append(rect);defs.append(clip);
    copy.removeAttribute('opacity');delete copy.dataset.logoGuide;group.append(copy);group.setAttribute('clip-path','url(#'+clip.id+')');path.parentNode.append(group);
    pieces.push({group,dx:(half?-1:1)*(7+i%3*2),dy:(half?1:-1)*(5+i%2*3)});
   }
  });
  return progress=>{const t=1-progress,spread=t*t*(3-2*t);for(const letter of letters)letter.setAttribute('opacity',progress===1?'1':'.1');for(const {group,dx,dy} of pieces){group.style.visibility=progress===1?'hidden':'visible';group.setAttribute('transform','translate('+(dx*spread).toFixed(3)+' '+(dy*spread).toFixed(3)+')');}};
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
