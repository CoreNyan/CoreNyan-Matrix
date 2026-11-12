import fs from 'node:fs';import path from 'node:path';import {randomUUID,createHash} from 'node:crypto';
import {SOUNDS,defaultSounds,normalizeSoundSettings,validateSoundSettings} from '../../contracts/sounds.js';
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
export function validateSoundWave(b){
 if(b.length<46||b.length>SOUNDS.maxBytes||b.toString('ascii',0,4)!=='RIFF'||b.readUInt32LE(4)!==b.length-8||b.toString('ascii',8,12)!=='WAVE'||b.toString('ascii',12,16)!=='fmt '||b.readUInt32LE(16)!==16||b.readUInt16LE(20)!==1||b.readUInt16LE(22)!==1||b.readUInt32LE(24)!==SOUNDS.sampleRate||b.readUInt32LE(28)!==SOUNDS.sampleRate*2||b.readUInt16LE(32)!==2||b.readUInt16LE(34)!==16||b.toString('ascii',36,40)!=='data'||b.readUInt32LE(40)!==b.length-44||(b.length-44)%2)fail('音频格式无效，请重新选择音效文件');
 return (b.length-44)/(SOUNDS.sampleRate*2);
}
export function createSounds({directory,accounts}){
 const file=path.join(directory,'sound-settings.json'),root=path.join(directory,'sounds');fs.mkdirSync(root,{recursive:true,mode:0o700});
 let state=fs.existsSync(file)?JSON.parse(fs.readFileSync(file,'utf8')):{version:1,accounts:{}};if(state.version!==1||!state.accounts)throw Error('INVALID_SOUND_STORE');let queue=Promise.resolve();
 const empty=()=>({revision:0,settings:defaultSounds(),assets:[]});
 const row=id=>state.accounts[id]||empty();
 const view=id=>structuredClone({...row(id),settings:normalizeSoundSettings(row(id).settings)});
 const accountDir=id=>path.join(root,createHash('sha256').update(id).digest('hex'));
 const assetPath=(id,asset)=>path.join(accountDir(id),asset+'.wav');
 const save=async next=>{const temp=file+'.'+randomUUID()+'.tmp';try{await fs.promises.writeFile(temp,JSON.stringify(next),{mode:0o600});await fs.promises.rename(temp,file);state=next;}finally{await fs.promises.unlink(temp).catch(()=>{});}};
 function serialize(work){const run=queue.then(work);queue=run.catch(()=>{});return run;}
 function check(id,revision){if(!accounts.find(id))fail('请先登录',401);if(revision!==row(id).revision)fail('其他设备已更新音效设置，请读取云端后再试',409);}
 async function update(id,{revision,settings}){return serialize(async()=>{check(id,revision);const current=row(id),next={...current,revision:current.revision+1,settings:validateSoundSettings(settings,current.assets)};await save({...state,accounts:{...state.accounts,[id]:next}});return view(id);});}
 async function upload(id,revision,name,bytes){
  const duration=validateSoundWave(bytes);name=String(name||'自定义音效').replace(/[\x00-\x1f\x7f]/g,'').trim().slice(0,80)||'自定义音效';
  return serialize(async()=>{check(id,revision);const current=row(id);if(current.assets.length>=SOUNDS.maxFiles)fail('最多保存 20 个自定义音效，请先移除不用的音效');const asset={id:randomUUID(),name,duration,bytes:bytes.length},target=assetPath(id,asset.id);await fs.promises.mkdir(accountDir(id),{recursive:true,mode:0o700});await fs.promises.writeFile(target,bytes,{flag:'wx',mode:0o600});
   try{check(id,revision);await save({...state,accounts:{...state.accounts,[id]:{...current,revision:current.revision+1,assets:[...current.assets,asset]}}});}catch(e){await fs.promises.unlink(target).catch(()=>{});throw e;}return view(id);
  });
 }
 async function remove(id,revision,assetId){return serialize(async()=>{check(id,revision);const current=row(id);if(!current.assets.some(a=>a.id===assetId))fail('音效不存在',404);const settings=structuredClone(current.settings);for(const key of Object.keys(settings.events))if(settings.events[key]==='custom:'+assetId)settings.events[key]='none';await save({...state,accounts:{...state.accounts,[id]:{revision:current.revision+1,settings,assets:current.assets.filter(a=>a.id!==assetId)}}});await fs.promises.unlink(assetPath(id,assetId)).catch(()=>{});return view(id);});}
 async function read(id,assetId){if(!accounts.find(id))fail('请先登录',401);if(!row(id).assets.some(a=>a.id===assetId))fail('音效不存在',404);return fs.promises.readFile(assetPath(id,assetId));}
 async function handle(req,res,url){
  if(url.pathname!==SOUNDS.api&&!url.pathname.startsWith(SOUNDS.api+'/'))return false;
  const json=(status,data)=>{res.writeHead(status,{'Content-Type':'application/json','Cache-Control':'no-store'});res.end(JSON.stringify(data));};
  try{const id=req.auth?.id;if(!id||!accounts.find(id))fail('请先登录',401);
   const body=async max=>{let size=0,chunks=[];for await(const chunk of req){size+=chunk.length;if(size>max)fail('音效文件或设置过大',413);chunks.push(chunk);}return Buffer.concat(chunks);};
   if(url.pathname===SOUNDS.api&&req.method==='GET')json(200,{ok:true,...view(id)});
   else if(url.pathname===SOUNDS.api&&req.method==='PATCH')json(200,{ok:true,...await update(id,JSON.parse((await body(10000)).toString('utf8')))});
   else if(url.pathname===SOUNDS.api+'/files'&&req.method==='POST')json(201,{ok:true,...await upload(id,Number(url.searchParams.get('revision')),url.searchParams.get('name'),await body(SOUNDS.maxBytes))});
   else if(url.pathname.startsWith(SOUNDS.api+'/files/')){const assetId=url.pathname.slice((SOUNDS.api+'/files/').length);if(!/^[a-f0-9-]{36}$/.test(assetId))fail('音效不存在',404);
    if(req.method==='GET'){const bytes=await read(id,assetId);res.writeHead(200,{'Content-Type':'audio/wav','Content-Length':bytes.length,'Cache-Control':'private, no-store','X-Content-Type-Options':'nosniff'});res.end(bytes);}
    else if(req.method==='DELETE')json(200,{ok:true,...await remove(id,Number(url.searchParams.get('revision')),assetId)});else fail('不支持的音效操作',405);
   }else fail('音效接口不存在',404);
  }catch(e){json(e.status||400,{ok:false,error:e.status?e.message:'音效暂不可用，请稍后再试'});}return true;
 }
 return {handle,view,update,upload,remove,read};
}
