import {DOODLE_TOTAL} from './constants.js';
import {nextDoodle} from './random-doodle.js';
import {welcomeContext,selectWelcome,expandWelcome} from './chat-welcome-rules.js';
import {environmentFor,environmentControls,onEnvironment} from './user-environment.js';
import {reveal} from './ui-motion.js';

let configuration,previousTitle='',previousSubtitle='',previousDoodle=0;
const welcomes=new WeakMap();
const strings=value=>Array.isArray(value)?[...new Set(value.filter(item=>typeof item==='string'&&item.trim()||item&&typeof item.text==='string'))]:[];
function greetings(){
 return configuration??=fetch('/contracts/chat-welcome.json',{cache:'no-cache',signal:AbortSignal.timeout(5000)})
  .then(response=>{if(!response.ok)throw Error('WELCOME_CONFIG_UNAVAILABLE');return response.json();})
  .catch(()=>({}))
  .then(config=>{
   const legacy=Array.isArray(config?.greetings)?config.greetings:[];
   const titles=strings(config?.titles??legacy.map(item=>item?.title)),subtitles=strings(config?.subtitles??legacy.map(item=>item?.subtitle));
   return {...config,titles:titles.length?titles:['小可在，慢慢说。'],subtitles:subtitles.length?subtitles:['{user}，今天想聊些什么？']};
  });
}
function render(node){
 const state=welcomes.get(node);if(!state?.entry||!state.username)return;
 const context=welcomeContext(state.config,{username:state.username,weather:environmentFor(state.username)?.weather});
 const expand=text=>expandWelcome(text,context);
 node.querySelector('h2').textContent=expand(state.entry.title);node.querySelector('p').textContent=expand(state.entry.subtitle);
 if(node.hidden){node.hidden=false;if(node.isConnected)reveal(node);}
}
export function updateChatWelcome(node,username){
 const state=welcomes.get(node);if(!state)return;
 state.username=typeof username==='string'?username:'';render(node);
}

// A welcome is selected only when entering an empty view, never by background polling.
export function createChatWelcome(username=''){
 const node=document.createElement('div');node.className='chat-welcome';node.hidden=true;
 const state={username,entry:null,weatherKind:null};welcomes.set(node,state);
 void greetings().then(config=>{
  state.config=config;const context=welcomeContext(config,{username:state.username,weather:environmentFor(state.username)?.weather});
  const entry={title:selectWelcome(config.titles,context,previousTitle)||'小可在，慢慢说。',subtitle:selectWelcome(config.subtitles,context,previousSubtitle)||'{user}，今天想聊些什么？'};
  previousTitle=entry.title;previousSubtitle=entry.subtitle;state.entry=entry;
  previousDoodle=nextDoodle(previousDoodle,DOODLE_TOTAL);
  const image=document.createElement('img'),title=document.createElement('h2'),subtitle=document.createElement('p');
  image.src=`/assets/doodle/doodle_${previousDoodle}.png`;image.alt='小可';image.decoding='async';
  node.append(image,title,subtitle,environmentControls());render(node);
  const unsubscribe=onEnvironment(()=>{
   if(!node.isConnected){unsubscribe();return;}
   const next=welcomeContext(config,{username:state.username,weather:environmentFor(state.username)?.weather});
   const kind=environmentFor(state.username)?.weather?.kind||null;
   if(kind===state.weatherKind){render(node);return;}state.weatherKind=kind;
   state.entry={title:selectWelcome(config.titles,next,previousTitle)||entry.title,subtitle:selectWelcome(config.subtitles,next,previousSubtitle)||entry.subtitle};
   previousTitle=state.entry.title;previousSubtitle=state.entry.subtitle;
   render(node);if(!matchMedia('(prefers-reduced-motion: reduce)').matches&&!document.documentElement.classList.contains('motion-disabled'))reveal(node);
  });
 });
 return node;
}
