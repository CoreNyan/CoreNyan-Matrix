export const SOUNDS=Object.freeze({api:'/api/sounds',saveMs:800,pollMs:30000,maxFiles:20,maxSourceBytes:4*1024*1024,maxSeconds:10,sampleRate:22050,maxBytes:441044,clickGapMs:100,eventGapMs:350,
 events:[{id:'message',name:'收到消息',detail:'应用内收到小可的新回复'},{id:'send',name:'发送成功',detail:'消息已提交'},{id:'upload',name:'附件就绪',detail:'本次附件全部上传完成'},{id:'error',name:'操作失败',detail:'聊天发送或附件上传失败'},{id:'click',name:'UI 点击',detail:'按钮与导航操作'}],
 presets:[{id:'pixel',name:'PIXEL · 像素叮咚',wave:'square',notes:[[660,.08],[880,.12]]},{id:'coin',name:'COIN · 拾取金币',wave:'square',notes:[[988,.07],[1319,.15]]},{id:'bubble',name:'BUBBLE · 电子气泡',wave:'triangle',notes:[[440,.06],[660,.06],[880,.1]]},{id:'tap',name:'TAP · 轻触',wave:'triangle',notes:[[960,.035]]},{id:'descending',name:'DOWN · 下降音',wave:'square',notes:[[440,.08],[330,.08],[220,.13]]}]});
export const SOUND_PARAMETERS=Object.freeze({volume:{min:0,max:1,step:.01,default:1},pitch:{min:-12,max:12,step:.1,default:0},jitter:{min:0,max:3,step:.1,default:.3}});
export const defaultEventSound=()=>Object.fromEntries(Object.entries(SOUND_PARAMETERS).map(([key,value])=>[key,value.default]));
export const soundEventOptions=(settings,event)=>({...defaultEventSound(),...settings.eventOptions?.[event]});
export const normalizeSoundSettings=settings=>({...settings,eventOptions:Object.fromEntries(SOUNDS.events.map(({id})=>[id,soundEventOptions(settings,id)]))});
export const defaultSounds=()=>normalizeSoundSettings({enabled:true,volume:.3,events:{message:'pixel',send:'none',upload:'none',error:'none',click:'none'}});
// One pitch variation per playback keeps the intervals of a multi-note preset intact.
export function soundPlayback(settings,event,random=Math.random){const options=soundEventOptions(settings,event);return {volume:settings.volume*options.volume,rate:2**((options.pitch+(random()*2-1)*options.jitter)/12)};}
export function validateSoundSettings(input,assets=[]){
 const fail=()=>{throw Object.assign(Error('音效设置无效，请检查音量与所选音效'),{status:400});};
 if(!input||Object.keys(input).some(k=>!['enabled','volume','events','eventOptions'].includes(k))||typeof input.enabled!=='boolean'||typeof input.volume!=='number'||!Number.isFinite(input.volume)||input.volume<0||input.volume>1||!input.events||Object.keys(input.events).length!==SOUNDS.events.length)fail();
 const ids=new Set(['none',...SOUNDS.presets.map(p=>p.id),...assets.map(a=>'custom:'+a.id)]),events={};
 for(const {id} of SOUNDS.events){if(!ids.has(input.events[id]))fail();events[id]=input.events[id];}
 if(input.eventOptions!==undefined){
  if(!input.eventOptions||Array.isArray(input.eventOptions)||Object.keys(input.eventOptions).some(key=>!SOUNDS.events.some(e=>e.id===key)))fail();
  for(const options of Object.values(input.eventOptions)){
   if(!options||Array.isArray(options)||typeof options!=='object'||Object.keys(options).some(key=>!Object.hasOwn(SOUND_PARAMETERS,key)))fail();
   for(const [key,value] of Object.entries(options)){const bounds=SOUND_PARAMETERS[key];if(typeof value!=='number'||!Number.isFinite(value)||value<bounds.min||value>bounds.max)fail();}
  }
 }
 return normalizeSoundSettings({enabled:input.enabled,volume:input.volume,events,eventOptions:input.eventOptions});
}
