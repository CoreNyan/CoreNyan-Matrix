import {createFrameBudget,visualActive,observeVisualActivity} from './render-budget.js';
import {VIEW} from './constants.js';
import {waveProfile} from './waveform.js';
const BANDS=['δ','θ','α','β','γ'];
const STATES={SLEEPING:{label:'SLEEPING',weights:[.85,.5,.22,.06,.02]},THINKING:{label:'THINKING',weights:[.12,.28,.38,.9,.62]},DRAWING:{label:'DRAWING',weights:[.15,.62,.78,.5,.34]},SURFING:{label:'ACTIVE',weights:[.2,.38,.72,.55,.25]}};
// State-driven visual synthesis, never a measured respiratory/EEG medical reading.
export function bioProfile(payload){
 const life=payload?.vitals;if(!life||!Number.isFinite(life.energy)||!Number.isFinite(life.mood))return null;
 const energy=Math.max(0,Math.min(100,life.energy))/100,mood=Math.max(0,Math.min(100,life.mood))/100,state=STATES[life.mode]||{label:'ACTIVE',weights:[.2,.35,.6,.4,.2]};
 const bands=state.weights.map((w,i)=>w*(.55+energy*(i>2?.8:.25))*(i===2?.6+mood*.4:1)),sum=bands.reduce((a,b)=>a+b,0);
 return {rate:waveProfile({vitals:life}).respirationHz,depth:.5+energy*.5,bands:bands.map(v=>v/sum),label:state.label};
}
export function mountSignalHealth(container,registry){
 if(!container)return;
 const grid='<path class="bio-grid" d="M8 12H232M8 48H232M8 84H232"/>';
 container.innerHTML='<div class="signal-health-heading"><span>BIOSIGNALS</span><span data-bio-state>AWAITING SIGNAL</span></div><div class="signal-health-grid"><figure class="bio-card"><figcaption><span>RESPIRATION</span><strong data-breath-phase>—</strong></figcaption><svg class="breath-chart" viewBox="0 0 240 96" role="img" aria-label="呼吸节律仿生图">'+grid+'<path class="bio-breath-area"/><path class="bio-breath-line"/><circle class="bio-breath-tip" r="2.5"/></svg><div class="bio-card-foot"><span>IN</span><span class="bio-breath-track"><i></i></span><span>OUT</span></div></figure><figure class="bio-card"><figcaption><span>NEURAL SPECTRUM</span><strong data-brain-band>—</strong></figcaption><svg class="brain-chart" viewBox="0 0 240 96" role="img" aria-label="脑电波频谱仿生图">'+grid+'<g class="bio-spectrum"></g><path class="bio-spectrum-envelope"/></svg><div class="bio-band-labels">'+BANDS.map(b=>'<span>'+b+'</span>').join('')+'</div></figure></div>';
 const bars=container.querySelector('.bio-spectrum'),ns='http://www.w3.org/2000/svg',rects=[];
 for(let i=0;i<45;i++){const r=document.createElementNS(ns,'rect');r.setAttribute('x',String(8+i*5));r.setAttribute('width','3');r.setAttribute('rx','1');bars.append(r);rects.push(r);}
 const line=container.querySelector('.bio-breath-line'),area=container.querySelector('.bio-breath-area'),tip=container.querySelector('.bio-breath-tip'),envelope=container.querySelector('.bio-spectrum-envelope');
 const phaseText=container.querySelector('[data-breath-phase]'),bandText=container.querySelector('[data-brain-band]'),status=container.querySelector('[data-bio-state]'),reduce=matchMedia('(prefers-reduced-motion: reduce)');
 const budget=createFrameBudget(20);let handle=0,last=0,time=0,phase=0,target=null,current=null,intersecting=false;
 const running=()=>intersecting&&registry.state.activeView===VIEW.VITALS&&visualActive()&&registry.state.motionEnabled&&!reduce.matches&&!registry.state.telemetryError&&current;
 const breath=p=>{p=((p%1)+1)%1;const t=p<.42?p/.42:1-(p-.42)/.58;return t*t*(3-2*t);};
 function draw(now){
  handle=0;const dt=last?Math.min((now-last)/1000,.08):0;last=now;
  if(!target||!current)return;
  const blend=dt?1-Math.exp(-dt/1.2):running()?0:1;current.rate+=(target.rate-current.rate)*blend;current.depth+=(target.depth-current.depth)*blend;current.bands=current.bands.map((v,i)=>v+(target.bands[i]-v)*blend);
  if(running()){time+=dt;phase=(phase+current.rate*dt)%1;}
  const level=breath(phase),amplitude=24+current.depth*30;let d='';
  for(let i=0;i<=74;i++){const x=8+i*3,y=84-breath(phase-(74-i)*3/224*1.8)*amplitude;d+=(i?' L':'M')+x+' '+y.toFixed(2);}
  line.setAttribute('d',d);area.setAttribute('d',d+' L230 84 L8 84 Z');tip.setAttribute('cx','230');tip.setAttribute('cy',String(84-level*amplitude));
  phaseText.textContent=phase<.42?'INHALE':'EXHALE';container.style.setProperty('--breath-expansion',String(level));
  let peak=0;for(let i=1;i<5;i++)if(current.bands[i]>current.bands[peak])peak=i;
  bandText.textContent=BANDS[peak];container.querySelectorAll('.bio-band-labels span').forEach((e,i)=>e.dataset.active=String(i===peak));
  let contour='';rects.forEach((r,i)=>{const x=i/44*4;let power=0;for(let b=0;b<5;b++)power+=current.bands[b]*Math.exp(-Math.pow((x-b)/.4,2)/2);const modulation=.88+.08*Math.sin(time*1.4+i*.47)+.04*Math.sin(time*2.1-i*.63),h=3+Math.min(1,power*2.3)*65*modulation;r.setAttribute('y',(84-h).toFixed(2));r.setAttribute('height',h.toFixed(2));contour+=(i?' L':'M')+(9.5+i*5)+' '+(80-h).toFixed(2);});envelope.setAttribute('d',contour);
  container.dataset.bioReady='true';
  if(running())handle=budget.request(draw);else last=0;
 }
 function wake(){budget.cancel(handle);handle=0;last=0;
  target=bioProfile(registry.state.lastVitalsPayload);if(target&&!current)current={...target,bands:[...target.bands]};
  container.dataset.stale=String(Boolean(registry.state.telemetryError));container.dataset.empty=String(!target);
  status.textContent=registry.state.telemetryError?'OFFLINE':target?target.label:'AWAITING SIGNAL';
  if(!target){phaseText.textContent='—';bandText.textContent='—';return;}
  if(intersecting&&registry.state.activeView===VIEW.VITALS)draw(performance.now());
 }
 const observer=new IntersectionObserver(entries=>{intersecting=entries[0].isIntersecting;wake();});observer.observe(container);
 const off=registry.subscribe(['lastVitalsPayload','telemetryError','motionEnabled','activeView'],wake),offActivity=observeVisualActivity(wake);
 reduce.addEventListener('change',wake);
 return()=>{budget.cancel(handle);observer.disconnect();off();offActivity();reduce.removeEventListener('change',wake);};
}
