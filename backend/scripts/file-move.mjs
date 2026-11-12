import fs from 'node:fs';
import path from 'node:path';
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
export function moveFiles({scope,sources,targetDir},resolve,presets,rename=fs.renameSync){
 if(!Array.isArray(sources)||!sources.length||sources.length>500)fail('请选择 1–500 个文件');
 const dest=resolve(scope,targetDir||'');
 if(!fs.statSync(dest.target).isDirectory())fail('目标必须是文件夹');
 const all=[...new Set(sources)].map(source=>({source,...resolve(scope,source)}));
 const roots=all.filter(item=>!all.some(parent=>parent!==item&&item.target.startsWith(parent.target+path.sep)));
 const reserved=new Set(),plan=[];
 for(const item of roots){
  if(item.target===item.base)fail('不能移动分区根目录');
  if(!fs.existsSync(item.target))fail('源文件不存在',404);
  if(dest.target===item.target||dest.target.startsWith(item.target+path.sep))fail('不能将文件夹拖入自身或子目录');
  const target=path.join(dest.target,path.basename(item.target));
  if(target===item.target)continue;
  if(fs.existsSync(target)||reserved.has(target))fail('目标存在同名文件：'+path.basename(target),409);
  reserved.add(target);if(presets.validateMove)presets.validateMove(item.target,target);else{presets.protectRemoval(item.target);presets.validateCopy(item.target,target);}
  plan.push({source:item.source,path:item.target,target,destination:path.relative(dest.base,target).split(path.sep).join('/')});
 }
 const relocate=presets.move||rename;
 const completed=[];
 try{for(const item of plan){relocate(item.path,item.target);completed.push(item);}}
 catch(error){
  let rollbackFailed=false;
  for(const item of completed.reverse())try{relocate(item.target,item.path);}catch{rollbackFailed=true;}
  if(rollbackFailed)fail('移动失败且部分回滚未完成，请刷新文件列表核对',500);
  throw error;
 }
 return plan.map(({source,destination})=>({source,destination}));
}
