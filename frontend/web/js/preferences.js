import {platformClipboard,copyImage,notifyReply,notificationPermission} from './platform.js';
import {PREFERENCES,DEFAULT_PREFERENCES,SHORTCUTS,validatePreferences,normalizeChord} from './preference-schema.js';
export {SHORTCUTS,normalizeChord};
let values=structuredClone(DEFAULT_PREFERENCES),revision=0,ready=false,busy=false,timer,dirty={},listeners=new Set();
// The authenticated startup request is the single initial snapshot, not a second fetch.
if(window.matrixInitialPreferences){values=validatePreferences(window.matrixInitialPreferences.values);revision=window.matrixInitialPreferences.revision;ready=true;delete window.matrixInitialPreferences;}
export const preferences=()=>values;
export const preferencesReady=()=>ready;
export const binding=id=>values.shortcuts[id]??SHORTCUTS.find(a=>a.id===id)?.defaultKey??'';
export function chord(event){if(event.isComposing||['Control','Meta','Alt','Shift'].includes(event.key))return '';return [event.ctrlKey||event.metaKey?'Mod':'',event.altKey?'Alt':'',event.shiftKey?'Shift':'',event.key===' '?'Space':event.key.length===1?event.key.toUpperCase():event.key].filter(Boolean).join('+');}
export const shortcut=(event,id)=>!event.isComposing&&!!binding(id)&&chord(event)===binding(id);
export const onPreferences=fn=>{listeners.add(fn);fn(values);return()=>listeners.delete(fn);};
function notify(message){for(const fn of listeners)fn(values);document.dispatchEvent(new CustomEvent('corenyan:preferences',{detail:{ready,message}}));}
async function request(method,body){const r=await fetch(PREFERENCES.api,{method,headers:{'Content-Type':'application/json'},...(body?{body:JSON.stringify(body)}:{})});const data=await r.json();if(!r.ok){const error=Error(data.error||'同步失败');error.status=r.status;throw error;}return data;}
function merge(base,patch){const next={...base,shortcuts:{...base.shortcuts}};for(const [key,value] of Object.entries(patch)){if(key.startsWith('shortcuts.'))next.shortcuts[key.slice(10)]=value;else next[key]=value;}return validatePreferences(next);}
export function updatePreferences(patch){if(!ready)throw Error('正在读取账号设置');const next=merge(values,patch);values=next;Object.assign(dirty,patch);notify('正在同步…');clearTimeout(timer);timer=setTimeout(syncPreferences,PREFERENCES.saveDelay);}
export async function syncPreferences(){
 if(busy)return;busy=true;
 try{
  if(!ready||!Object.keys(dirty).length){const d=await request('GET');revision=d.revision;values=merge(d.values,dirty);ready=true;notify(Object.keys(dirty).length?'正在同步…':'已同步到账号');}
  let conflicts=0;
  while(Object.keys(dirty).length){
   const pending={...dirty},next=merge(values,pending);
   try{const d=await request('PATCH',{revision,values:next});revision=d.revision;for(const [key,value] of Object.entries(pending))if(dirty[key]===value)delete dirty[key];values=merge(d.values,dirty);notify(Object.keys(dirty).length?'正在同步…':'已同步到账号');}
   catch(error){if(error.status!==409||++conflicts>3)throw error;const fresh=await request('GET');revision=fresh.revision;values=merge(fresh.values,dirty);}
  }
 }catch(error){notify('尚未同步：'+error.message+'；稍后自动重试');}finally{busy=false;}
}
export function mountPreferences(registry){
 const state=registry.state;state.website={displayScale:'auto',textSize:'standard'};
 onPreferences(p=>{state.website={displayScale:p.displayScale,textSize:p.textSize};state.motionEnabled=p.motion;state.logs.autoRefresh=p.autoPoll;document.documentElement.dataset.textSize=p.textSize;if(p.displayScale==='auto')document.documentElement.style.removeProperty('--ui-scale');else document.documentElement.style.setProperty('--ui-scale',String(Number(p.displayScale)/100));});
 registry.subscribe(['website','motionEnabled','logs.autoRefresh'],()=>{if(!ready)return;const next={...state.website,motion:state.motionEnabled,autoPoll:state.logs.autoRefresh},patch={};for(const [key,value] of Object.entries(next))if(value!==values[key])patch[key]=value;if(Object.keys(patch).length)updatePreferences(patch);});
 if(!ready)void syncPreferences();else notify('已同步到账号');setInterval(()=>{if(!document.hidden)void syncPreferences();},PREFERENCES.pollMs);
 document.addEventListener('visibilitychange',()=>{if(!document.hidden)void syncPreferences();});
 window.addEventListener('beforeunload',e=>{if(Object.keys(dirty).length){e.preventDefault();e.returnValue='';}});
}
export function editorKeys(onSave){
 const keys={Tab:cm=>cm.replaceSelection(' '.repeat(cm.getOption('indentUnit')))},names=value=>{const mod=/Mac|iPhone|iPad/.test(navigator.platform)?'Cmd':'Ctrl';return value.replace('Mod',mod).replaceAll('+','-').replace('Arrow','').replace('Space','Space');};
 for(const a of SHORTCUTS.filter(a=>a.scope==='editor'))keys[names(a.defaultKey)]=()=>{};
 const commands={save:onSave,find:'findPersistent',replace:'replace',replaceAll:'replaceAll',fold:cm=>cm.foldCode(cm.getCursor()),selectAll:'selectAll',undo:'undo',redo:'redo',copy:cm=>{void platformClipboard.writeText(cm.getSelection()).catch(()=>{});},cut:cm=>{const text=cm.getSelection(),from=cm.getCursor('from'),to=cm.getCursor('to');void platformClipboard.writeText(text).then(()=>{if(cm.getRange(from,to)===text)cm.replaceRange('',from,to);}).catch(()=>{});},paste:cm=>{void platformClipboard.readText().then(text=>cm.replaceSelection(text,'end')).catch(()=>{});}};
 for(const a of SHORTCUTS.filter(a=>a.scope==='editor')){const key=binding(a.id);if(key)keys[names(key)]=commands[a.id.split('.')[1]];}
 // Preserve trusted native clipboard events for the platform defaults.
 for(const id of ['copy','cut','paste'])if(binding('editor.'+id)===SHORTCUTS.find(a=>a.id==='editor.'+id).defaultKey)delete keys[names(binding('editor.'+id))];
 return keys;
}
export function textShortcut(event,input){
 for(const action of ['copy','cut','paste','selectAll','undo','redo'])if(shortcut(event,'chat.'+action)){
  if(binding('chat.'+action)===SHORTCUTS.find(a=>a.id==='chat.'+action).defaultKey)return false;
  event.preventDefault();input.focus();
  if(action==='selectAll')input.select();
  else if(action==='paste')void platformClipboard.readText().then(text=>{input.setRangeText(text,input.selectionStart,input.selectionEnd,'end');input.dispatchEvent(new Event('input',{bubbles:true}));}).catch(()=>{});
  else document.execCommand(action);
  return true;
 }
 return false;
}
