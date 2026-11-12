import fs from 'node:fs';
import path from 'node:path';
import {randomUUID} from 'node:crypto';
import {termText} from '../../contracts/terminology.js';
import {ENTITY,ENTITY_MODELS} from '../../contracts/constants.js';
import {SYSTEM_CONFIG} from '../../contracts/system-config.js';
const ID=/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/;
const assert=(ok,message)=>{if(!ok)throw Error(message);};
export function createLayerRegistry({file,workspace,roots,externalRoots=[]}) {
 const known=(name,rootScope,nameTerm,en,desc,doodle,port,directory)=>({key:name,id:name,rootScope,name:termText(nameTerm),organCode:termText(en),sub:desc,desc,doodle,port,kind:'container',containerName:name,directory,shortcuts:[],entityModel:ENTITY.layerModels[name]||'ark'});
 const defaults=[
 known('corenyan-brain','brain_src','{{organ.brain.zh}}','{{organ.brain.en}} // 01','认知与自我决策','',null,roots.brain),
 known('corenyan-gateway','gateway_src','{{organ.gateway.zh}}','{{organ.gateway.en}} // 02','进行事物的感知和表达','',8089,roots.gateway),
 known('onebot-qq','onebot_src','{{organ.qq.zh}}','{{organ.qq.en}} // 03','SnowLuma · OneBot 11','',5099,roots.onebot||path.join(workspace,'snowluma-data')),
 known('corenyan-redis','redis_src','{{organ.redis.zh}}','{{organ.redis.en}} // 04','各层级的通信工具','',6379,roots.redis),
 known('corenyan-web','web_src','CoreNyan-Matrix','CONTAINER LAYER // 05','前端与管理控制台','',25999,roots.web)
 ];
 defaults[2].containerName='snowluma-qq';defaults[4].containerName='corenyan-matrix-api';
 defaults[0].shortcuts=[['memory','{{scope.memory}}','memory-vault'],['skills','{{scope.skills}}','skills'],['prompts','{{scope.prompts}}','prompts'],['model_presets','大模型预设','model-presets'],['affections','{{scope.affections}}','affections'],['artworks','{{concept.retinaArt.zh}}','images/generated'],['endocrine','{{chapter.endocrine.en}}','config.json']].map(([id,label,relative])=>({id,label:termText(label),path:relative,kind:id==='endocrine'?'config':'directory'}));
 // Preserve original descriptions on first migration.
 defaults[0].desc='小可的核心，只负责思考。';defaults[1].desc='负责处理冲浪时接收到的信息';defaults[2].desc='小可冲浪使用的QQ。';defaults[3].desc='承载事件广播、RPC 回路与状态同步';
 function atomic(data){fs.mkdirSync(path.dirname(file),{recursive:true});const tmp=file+'.'+randomUUID()+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2)+'\n');fs.renameSync(tmp,file);}
 if(!fs.existsSync(file))atomic({version:1,revision:1,layers:defaults});
 function read(){const data=JSON.parse(fs.readFileSync(file,'utf8'));assert(data.version===1&&Array.isArray(data.layers),'层配置格式错误');return data;}
 function safeDirectory(raw,allowFile=false){
  assert(typeof raw==='string'&&path.isAbsolute(raw),'目录必须是云端绝对路径');
  const target=path.resolve(raw),work=fs.realpathSync(workspace);
  const external=externalRoots.filter(p=>fs.existsSync(p)).map(p=>fs.realpathSync(p));
  const base=[work,...external].find(p=>target.startsWith(p+path.sep)||p!==work&&target===p);
  assert(base,'目录必须位于项目工作区或已配置的独立服务目录');
  const relative=path.relative(base,target);assert(!relative.split(path.sep).includes('.corenyan-trash'),'回收站不是工作区目录');
  let current=base;
  for(const part of relative.split(path.sep)){current=path.join(current,part);if(fs.existsSync(current))assert(!fs.lstatSync(current).isSymbolicLink(),'目录不允许符号链接');}
  if(fs.existsSync(target))assert(allowFile?fs.statSync(target).isFile():fs.statSync(target).isDirectory(),'目录/文件类型不匹配');
  return target;
 }
 function normalize(input,old){
  assert(input&&typeof input==='object','层信息为空');
  const text=(field,max=300)=>{const v=String(input[field]??'').trim();assert(v.length<=max,field+'过长');return v;};
  const id=text('id',80);assert(ID.test(id),'层 ID 只能包含字母、数字、下划线和短横线');
  assert(id!==SYSTEM_CONFIG.id&&id!=='corenyan-shared','系统配置通过设置管理，不属于业务层');
  const name=text('name',100);assert(name,'请填写层名称');
  const kind=input.kind==='directory'?'directory':'container';
  const containerName=text('containerName',80);assert(kind==='directory'||ID.test(containerName),'容器名格式不正确');
  const directory=safeDirectory(text('directory',1000));
  assert(fs.existsSync(directory),'目录不存在，请选择已有目录');
  const doodle=text('doodle',300);
  assert(!doodle || /^assets\/(?:doodle|uploads)\/[a-zA-Z0-9_.-]+\.(?:png|jpg|jpeg|gif|webp)$/.test(doodle),'横幅只能使用本地图片');
  if(doodle)assert(fs.existsSync(doodle.startsWith('assets/uploads/')?path.join(roots.web,'backend/data/uploads',path.basename(doodle)):path.join(roots.web,'frontend/web',doodle)),'横幅图片不存在');
  const entityModel=Object.hasOwn(ENTITY_MODELS,input.entityModel)?input.entityModel:(old?.entityModel||ENTITY.layerModels[old?.key||id]||'ark');
  const key=old?.key||randomUUID(), rootScope=old?.rootScope||'layer_'+key.replaceAll('-','');
  const shortcuts=(Array.isArray(input.shortcuts)?input.shortcuts:[]).map(s=>{
   assert(ID.test(s.id),'快捷目录 ID 格式不正确');
   const rel=String(s.path||'').trim().replaceAll('\\','/');assert(rel&&!path.isAbsolute(rel)&&!rel.split('/').includes('..'),'快捷路径必须位于层目录下');
   const type=['config','file'].includes(s.kind)?s.kind:'directory';assert(type!=='config'||(old?.key==='corenyan-brain'&&s.id==='endocrine'&&rel==='config.json'),'配置编辑器入口仅用于 Brain config.json');
   safeDirectory(path.join(directory,rel),type!=='directory');
   const label=String(s.label||'').trim();assert(label&&label.length<=100,'快捷目录名称为空或过长');
   return {id:s.id,label,path:rel,kind:type};
  });
  assert(shortcuts.length<=40,'快捷入口最多40个');
  const port=input.port===''||input.port==null?null:Number(input.port);assert(port===null||(Number.isInteger(port)&&port>0&&port<=65535),'端口无效');
  return {key,id,rootScope,name,kind,containerName:kind==='container'?containerName:'',directory,organCode:text('organCode',100),sub:text('sub',200),desc:text('desc',2000),doodle,port,shortcuts,entityModel};
 }
 function save({revision,originalKey,layer}){
  const data=read();assert(revision===data.revision,'配置已被其他窗口修改，请重新打开后编辑');
  const old=originalKey?data.layers.find(l=>l.key===originalKey):null;assert(!originalKey||old,'原层不存在');
  const next=normalize(layer,old),layers=old?data.layers.map(l=>l.key===old.key?next:l):[...data.layers,next];
  assert(layers.length<=60,'层数量最多60个');
  assert(new Set(layers.map(l=>l.id)).size===layers.length,'层 ID 重复');
  const ids=[SYSTEM_CONFIG.scope,...layers.flatMap(l=>[l.rootScope,...l.shortcuts.map(s=>s.id)])];
  assert(new Set(ids).size===ids.length,'快捷目录 ID 与现有目录重复');
  atomic({version:1,revision:data.revision+1,layers});
  return read();
 }
 function scopes(){
  const data=read(),result=Object.create(null);
  result[SYSTEM_CONFIG.scope]={id:SYSTEM_CONFIG.scope,label:SYSTEM_CONFIG.label,sub:SYSTEM_CONFIG.directory,root:path.join(workspace,SYSTEM_CONFIG.directory),moduleId:SYSTEM_CONFIG.id,isRoot:true};
  for(const l of data.layers){
   result[l.rootScope]={id:l.rootScope,label:termText('{{file.root.zh}}')+' · '+l.name,sub:l.directory,root:l.directory,moduleId:l.id,isRoot:true};
   for(const s of l.shortcuts)if(s.kind!=='config')result[s.id]={id:s.id,label:s.label,sub:s.path,root:s.kind==='file'?path.dirname(path.join(l.directory,s.path)):path.join(l.directory,s.path),entryFile:s.kind==='file'?path.basename(s.path):null,moduleId:l.id};
  }return result;
 }
 function catalog(){
  const data=read();return {...data,modules:[...data.layers.map(l=>({id:l.id,label:l.name,defaultScope:l.rootScope})),{id:SYSTEM_CONFIG.id,label:SYSTEM_CONFIG.label,defaultScope:SYSTEM_CONFIG.scope}],
   scopes:[...Object.values(scopes()).map(({root,...s})=>({...s,exists:fs.existsSync(root)})),...data.layers.flatMap(l=>l.shortcuts.filter(s=>s.kind==='config').map(s=>({id:s.id,label:s.label,sub:s.path,moduleId:l.id,kind:s.kind,exists:fs.existsSync(path.join(l.directory,s.path))})))]};
 }
 return {read,save,scopes,catalog};
}
