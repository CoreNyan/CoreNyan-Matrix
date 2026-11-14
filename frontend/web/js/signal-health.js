import {TIMING} from './constants.js';
// Shared telemetry history is owned by health-details; this view never samples separately.
const METRICS=[{key:'cpu',label:'CPU / 负载',kind:'bars'},{key:'memory',label:'MEMORY / 内存',kind:'line'}];
const WIDTH=240,HEIGHT=76,LIMIT=48;
const valid=value=>typeof value==='number'&&Number.isFinite(value);
export function signalPoints(history,key){
 const samples=history.slice(-LIMIT);if(!samples.length)return [];
 const start=samples[0].time,end=samples.at(-1).time,span=Math.max(1,end-start);
 const points=[];let previous;for(const s of samples){if(previous!=null&&s.time-previous>TIMING.poll*2.5)points.push(null);points.push(valid(s.values?.[key])?{x:8+(end===start?1:(s.time-start)/span)*(WIDTH-16),y:HEIGHT-8-Math.max(0,Math.min(100,s.values[key]))/100*(HEIGHT-16),value:s.values[key]}:null);previous=s.time;}return points;
}
export function mountSignalHealth(container,registry){
 if(!container)return;
 container.innerHTML='<div class="signal-health-heading"><span>RESOURCE STUDY</span><span data-signal-state>等待采样</span></div><div class="signal-health-grid">'+METRICS.map(m=>`<button type="button" class="signal-metric" data-signal-metric="${m.key}" aria-label="查看${m.key==='cpu'?'CPU 负载':'内存占用'}趋势详情"><span class="signal-metric-heading"><span>${m.label}</span><strong>—</strong></span><svg viewBox="0 0 ${WIDTH} ${HEIGHT}" aria-hidden="true"><path class="signal-chart-grid" d="M8 8H232M8 38H232M8 68H232"/><path class="signal-chart-area"/><path class="signal-chart-line"/><g class="signal-chart-bars"></g><circle class="signal-chart-tip" r="2.5"/></svg><span class="signal-metric-range">暂无数据</span></button>`).join('')+'</div>';
 container.querySelectorAll('[data-signal-metric]').forEach(button=>button.onclick=()=>{registry.state.healthDetail=button.dataset.signalMetric;});
 return registry.subscribe(['healthHistory','telemetryError'],state=>{
  const history=state.healthHistory||[],latest=history.at(-1),stale=Boolean(state.telemetryError);
  container.dataset.stale=String(stale);
  container.querySelector('[data-signal-state]').textContent=stale?'连接中断 · 保留上次采样':latest?new Date(latest.time).toLocaleTimeString('zh-CN',{hour12:false}):'等待采样';
  for(const m of METRICS){
   const button=container.querySelector('[data-signal-metric="'+m.key+'"]'),points=signalPoints(history,m.key),present=points.filter(Boolean),current=latest?.values?.[m.key];
   button.querySelector('strong').textContent=valid(current)?Math.round(current)+'%':'—';
   button.querySelector('.signal-metric-range').textContent=present.length>1?'最近 '+present.length+' 次 · '+Math.round(Math.min(...present.map(p=>p.value)))+'–'+Math.round(Math.max(...present.map(p=>p.value)))+'%':present.length?'等待更多采样':'暂无数据';
   let line='',area='',segment=[];
   const flush=()=>{if(!segment.length)return;const d=segment.map((p,i)=>(i?'L':'M')+p.x.toFixed(2)+' '+p.y.toFixed(2)).join(' ');line+=d+' ';if(segment.length>1)area+=d+' L'+segment.at(-1).x.toFixed(2)+' 68 L'+segment[0].x.toFixed(2)+' 68 Z ';segment=[];};
   for(const p of points){if(p)segment.push(p);else flush();}flush();
   button.querySelector('.signal-chart-line').setAttribute('d',m.kind==='line'?line:'');
   button.querySelector('.signal-chart-area').setAttribute('d',m.kind==='line'?area:'');
   const bars=button.querySelector('.signal-chart-bars');bars.replaceChildren();
   if(m.kind==='bars')for(const p of present){const rect=document.createElementNS('http://www.w3.org/2000/svg','rect');const w=Math.max(2,Math.min(12,190/Math.max(1,points.length)));rect.setAttribute('x',p.x-w/2);rect.setAttribute('y',p.y);rect.setAttribute('width',w);rect.setAttribute('height',Math.max(1,68-p.y));rect.setAttribute('rx','1');bars.append(rect);}
   const tip=button.querySelector('.signal-chart-tip'),last=points.at(-1);tip.style.display=last?'':'none';if(last){tip.setAttribute('cx',last.x);tip.setAttribute('cy',last.y);}
  }
 });
}
