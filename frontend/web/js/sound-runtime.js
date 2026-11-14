import {SOUNDS,defaultSounds,soundPlayback,normalizeSoundSettings} from '../../../contracts/sounds.js';
let state={revision:0,settings:defaultSounds(),assets:[]},context,loading,initialized=false,syncPaused=false;
const listeners=new Set(),buffers=new Map(),last=new Map();let voices=0;
const warming=new Map();
export const soundState=()=>structuredClone(state);
export const pauseSoundSync=value=>{syncPaused=value;};
export const onSounds=fn=>{listeners.add(fn);fn(soundState());return()=>listeners.delete(fn);};
export function acceptSounds(next){state={...next,settings:normalizeSoundSettings(next.settings)};for(const id of buffers.keys())if(!state.assets.some(a=>a.id===id))buffers.delete(id);for(const fn of listeners)fn(soundState());void warmLifecycle();}
export async function soundRequest(url,options={}){const res=await fetch(url,options),data=await res.json();if(!res.ok||!data.ok)throw Error(data.error||'音效设置暂不可用');return data;}
export async function loadSounds(force=false){if(syncPaused&&!force)return soundState();if(loading)return loading;loading=soundRequest(SOUNDS.api).then(data=>{if(!syncPaused||force)acceptSounds(data);return data;}).finally(()=>loading=null);return loading;}
function audio(){const C=globalThis.AudioContext||globalThis.webkitAudioContext;if(!C)throw Error('当前设备不支持音效');return context??=new C();}
async function warmLifecycle(){
 if(!state.settings.enabled)return;
 await Promise.allSettled(['startup','shutdown'].map(async event=>{
  const id=state.settings.events[event]?.replace(/^custom:/,'');if(!state.settings.events[event]?.startsWith('custom:')||buffers.has(id)||!state.assets.some(a=>a.id===id))return;
  if(!warming.has(id))warming.set(id,(async()=>{try{const res=await fetch(SOUNDS.api+'/files/'+encodeURIComponent(id),{signal:AbortSignal.timeout(5000)});if(res.ok){const data=await audio().decodeAudioData(await res.arrayBuffer());if(state.assets.some(a=>a.id===id))buffers.set(id,data);}}finally{warming.delete(id);}})());
  await warming.get(id);
 }));
}
export async function playSound(event,{preview=false,id,settings=state.settings}={}){
 if(!preview&&(!state.settings.enabled||document.hidden||!document.hasFocus()))return false;
 const lifecycle=event==='startup'||event==='shutdown',maxDuration=event==='shutdown'&&!preview ? .72 : Infinity;
 id??=settings.events[event];const {volume,rate}=soundPlayback(settings,event);if(!id||id==='none'||volume<=0)return false;
 const now=performance.now(),gap=event==='click'?SOUNDS.clickGapMs:SOUNDS.eventGapMs;if(!preview&&now-(last.get(event)??-Infinity)<gap)return false;
 const ctx=audio();if(ctx.state!=='running'){if(preview||lifecycle&&(window.MatrixNative||navigator.userActivation?.hasBeenActive))await ctx.resume();else return false;}if(voices>=4)return false;last.set(event,now);
 const preset=SOUNDS.presets.find(p=>p.id===id);
 if(preset){let start=ctx.currentTime;for(const [frequency,duration] of preset.notes){const o=ctx.createOscillator(),g=ctx.createGain();o.type=preset.wave;o.frequency.value=frequency*rate;g.gain.setValueAtTime(0,start);g.gain.linearRampToValueAtTime(volume*.18,start+.005);g.gain.setValueAtTime(volume*.18,start+duration*.65);g.gain.linearRampToValueAtTime(0,start+duration);o.connect(g).connect(ctx.destination);voices++;o.onended=()=>{voices--;o.disconnect();g.disconnect();};o.start(start);o.stop(start+duration+.005);start+=duration;}return true;}
 const assetId=id.slice(7);if(!id.startsWith('custom:')||!state.assets.some(a=>a.id===assetId))throw Error('自定义音效已不存在');
 let buffer=buffers.get(assetId);if(!buffer){const res=await fetch(SOUNDS.api+'/files/'+encodeURIComponent(assetId));if(!res.ok)throw Error('音效下载失败');buffer=await ctx.decodeAudioData(await res.arrayBuffer());buffers.set(assetId,buffer);}
 if(voices>=4||!preview&&(document.hidden||!document.hasFocus()))return false;
 const source=ctx.createBufferSource(),gain=ctx.createGain();source.buffer=buffer;source.playbackRate.value=rate;gain.gain.value=volume*.65;source.connect(gain).connect(ctx.destination);voices++;source.onended=()=>{voices--;source.disconnect();gain.disconnect();};if(Number.isFinite(maxDuration)){const duration=Math.min(maxDuration,buffer.duration/rate),end=ctx.currentTime+duration;gain.gain.setValueAtTime(volume*.65,ctx.currentTime);gain.gain.setValueAtTime(volume*.65,Math.max(ctx.currentTime,end-.08));gain.gain.linearRampToValueAtTime(0,end);source.start();source.stop(end);}else source.start();return true;
}
export const emitSound=event=>void playSound(event).catch(()=>{});
export function initSounds(){if(initialized)return;initialized=true;
 let loaded=false,startupDeadline=0,startupPlayed=false,starting=false;
 const startup=async()=>{if(!loaded||startupPlayed||starting||performance.now()>startupDeadline)return;starting=true;try{startupPlayed=await playSound('startup');}catch{}finally{starting=false;}};
 addEventListener('matrix-terminal-transition',e=>{if(e.detail.phase==='opening'&&e.detail.previous==='loading'){startupDeadline=performance.now()+3000;void startup();}else if(e.detail.phase==='closing')emitSound('shutdown');});
 addEventListener('matrix-native-ready',()=>void startup());
 document.addEventListener('pointerdown',()=>{void startup();},{passive:true});
 void loadSounds().then(async()=>{await warmLifecycle();loaded=true;void startup();}).catch(()=>{});

 const unlock=e=>{if(!e.isTrusted)return;try{const ctx=audio();if(ctx.state==='suspended')void ctx.resume().catch(()=>{});}catch{}};
 document.addEventListener('pointerdown',unlock,{capture:true,passive:true});document.addEventListener('keydown',unlock,{capture:true});
 document.addEventListener('click',e=>{if(!e.isTrusted||e.defaultPrevented||e.target.closest('[data-sound-preview],.CodeMirror,.cm-editor,[contenteditable=true]'))return;const button=e.target.closest('button,a[href],[role=button]');if(button&&!button.disabled)emitSound('click');});
 void loadSounds().catch(()=>{});setInterval(()=>{if(!document.hidden)void loadSounds().catch(()=>{});},SOUNDS.pollMs);window.addEventListener('focus',()=>void loadSounds().catch(()=>{}));
}
export async function normalizeSound(file){
 if(!file.size||file.size>SOUNDS.maxSourceBytes)throw Error('请选择 4 MB 以内的音频文件');
 const ctx=audio();let decoded;try{decoded=await ctx.decodeAudioData(await file.arrayBuffer());}catch{throw Error('无法读取这段音频，请尝试 MP3、WAV 或 OGG');}
 if(!decoded.duration||decoded.duration>SOUNDS.maxSeconds)throw Error('音效最长 10 秒，请先裁剪后再上传');
 const count=Math.max(1,Math.floor(decoded.duration*SOUNDS.sampleRate)),offline=new OfflineAudioContext(1,count,SOUNDS.sampleRate),source=offline.createBufferSource();source.buffer=decoded;source.connect(offline.destination);source.start();const mono=(await offline.startRendering()).getChannelData(0),bytes=new ArrayBuffer(44+count*2),v=new DataView(bytes);
 const str=(offset,text)=>{for(let i=0;i<text.length;i++)v.setUint8(offset+i,text.charCodeAt(i));};str(0,'RIFF');v.setUint32(4,bytes.byteLength-8,true);str(8,'WAVE');str(12,'fmt ');v.setUint32(16,16,true);v.setUint16(20,1,true);v.setUint16(22,1,true);v.setUint32(24,SOUNDS.sampleRate,true);v.setUint32(28,SOUNDS.sampleRate*2,true);v.setUint16(32,2,true);v.setUint16(34,16,true);str(36,'data');v.setUint32(40,count*2,true);
 for(let i=0;i<count;i++)v.setInt16(44+i*2,Math.max(-1,Math.min(1,mono[i]))*32767,true);
 return bytes;
}
