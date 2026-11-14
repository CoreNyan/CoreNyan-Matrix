import {DOODLE_TOTAL} from './constants.js';
import {nextDoodle} from './random-doodle.js';
import {reveal} from './ui-motion.js';

let configuration,previousTitle='',previousDoodle=0;
function greetings(){
 return configuration??=fetch('/contracts/chat-welcome.json',{cache:'no-cache',signal:AbortSignal.timeout(5000)})
  .then(response=>{if(!response.ok)throw Error('WELCOME_CONFIG_UNAVAILABLE');return response.json();})
  .then(config=>{const entries=Array.isArray(config.greetings)?config.greetings.filter(item=>typeof item?.title==='string'&&item.title.trim()&&typeof item.subtitle==='string'):[];if(!entries.length)throw Error('WELCOME_CONFIG_EMPTY');return entries;})
  .catch(()=>[{title:'小可在，慢慢说。',subtitle:'今天想聊些什么？'}]);
}

// A welcome is selected only when entering an empty view, never by background polling.
export function createChatWelcome(){
 const node=document.createElement('div');node.className='chat-welcome';node.hidden=true;
 void greetings().then(entries=>{
  const alternatives=entries.filter(item=>item.title!==previousTitle),pool=alternatives.length?alternatives:entries;
  const entry=pool[Math.floor(Math.random()*pool.length)];previousTitle=entry.title;
  previousDoodle=nextDoodle(previousDoodle,DOODLE_TOTAL);
  const image=document.createElement('img'),title=document.createElement('h2'),subtitle=document.createElement('p');
  image.src=`/assets/doodle/doodle_${previousDoodle}.png`;image.alt='小可';image.decoding='async';
  title.textContent=entry.title;subtitle.textContent=entry.subtitle;
  node.append(image,title,subtitle);node.hidden=false;if(node.isConnected)reveal(node);
 });
 return node;
}
