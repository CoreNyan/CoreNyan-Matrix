import {loadWelcomeConfig} from './chat-welcome.js';
import {welcomeContext,selectWelcome,expandWelcome} from './chat-welcome-rules.js';
import {environmentFor} from './user-environment.js';

const fallback={running:{titles:['让本姑娘想想…'],subtitles:['把这件事慢慢理清楚。']},queued:{titles:['这条也记下啦'],subtitles:['前面的事情处理完，就轮到这条。']}};
let configuration;
const copies=new Map(),previous={running:{},queued:{}};
export function loadThinkingConfig(){
 return configuration??=Promise.all([
  loadWelcomeConfig(),
  fetch('/contracts/chat-thinking.json',{cache:'no-cache',signal:AbortSignal.timeout(5000)}).then(r=>{if(!r.ok)throw Error('THINKING_CONFIG_UNAVAILABLE');return r.json();}).catch(()=>({}))
 ]).then(([base,config])=>({...config,timezone:config?.timezone||base.timezone,timePresets:{...base.timePresets,...config?.timePresets},weatherPresets:{...base.weatherPresets,...config?.weatherPresets},locationPresets:{...base.locationPresets,...config?.locationPresets}}));
}
function captionFor(tasks,identity){
 const task=tasks.find(t=>t.status==='running')||tasks[0],phase=task?.status==='running'?'running':'queued';
 const key=JSON.stringify([identity.accountId,identity.username,task?.id,task?.attempt,phase]);
 if(!copies.has(key)){
  const environment=environmentFor(identity.username||'');
  const pending=loadThinkingConfig().then(config=>{
   const context=welcomeContext(config,{username:identity.username||'',environment});
   const entries=phase==='running'?config:config.queued;
   const title=selectWelcome(entries?.titles,context,previous[phase].title)||fallback[phase].titles[0];
   const subtitle=selectWelcome(entries?.subtitles,context,previous[phase].subtitle)||fallback[phase].subtitles[0];
   previous[phase]={title,subtitle};return {title:expandWelcome(title,context),subtitle:expandWelcome(subtitle,context)};
  });
  copies.set(key,pending);if(copies.size>32)copies.delete(copies.keys().next().value);
 }
 return copies.get(key);
}
const el=(tag,cls,text)=>{const node=document.createElement(tag);node.className=cls;if(text!==undefined)node.textContent=text;return node;};
export function createThinkingPanel(tasks,identity={}){
 const running=tasks.some(task=>task.status==='running');
 const panel=el('section','chat-task-list'+(running?' is-thinking':''));
 panel.setAttribute('role','status');panel.setAttribute('aria-live','polite');panel.setAttribute('aria-label','正在处理的任务');
 const header=el('div','thought-header'),symbol=el('div','thought-symbol');symbol.setAttribute('aria-hidden','true');
 symbol.innerHTML='<svg viewBox="0 0 64 64" fill="none"><path class="thought-brackets" d="M16 6H6v10m42-10h10v10M6 48v10h10m42-10v10H48"/><g class="thought-fold thought-fold-a"><rect x="17" y="17" width="30" height="30" rx="5"/></g><g class="thought-fold thought-fold-b"><rect x="21" y="21" width="22" height="22" rx="3"/></g><path class="thought-thread" pathLength="100" d="M8 32h12l7-10 10 20 7-10h12"/><path class="thought-pencil" d="m30 30 4 4m-4 0 4-4"/></svg>';
 const defaults=fallback[running?'running':'queued'],caption=el('div','thought-caption'),title=el('strong','chat-task-heading',defaults.titles[0]),subtitle=el('span','thought-caption-note',defaults.subtitles[0]);caption.append(title,subtitle);
 void captionFor(tasks,identity).then(copy=>{title.textContent=copy.title;subtitle.textContent=copy.subtitle;});
 header.append(symbol,caption);panel.append(header);
 const list=el('ul','thought-tasks');
 for(const task of tasks){
  const row=el('li','chat-task'+(task.status==='running'?' is-thinking':' is-queued')),indicator=el('span','chat-task-indicator'),detail=el('span','chat-task-detail');indicator.setAttribute('aria-hidden','true');
  row.append(indicator,el('span','chat-task-state',task.status==='running'?'正在处理':'等待处理'),detail);
  const request=task.text?.trim()||('处理附件：'+(task.files||[]).map(file=>file.name).join('、'));
  detail.textContent=request.slice(0,180);if(request.length>180)detail.title=request;list.append(row);
 }
 panel.append(list);return panel;
}
