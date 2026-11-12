import {chatPrivatePath} from './chat-private-path.mjs';
import fs from 'node:fs/promises';
import path from 'node:path';
import {isBinaryFile} from '../../contracts/file-types.js';
export const SEARCH_LIMITS=Object.freeze({maxResults:200,maxFiles:30000,maxBytes:2*1024*1024,totalBytes:96*1024*1024,maxMs:12000,skip:['node_modules','.git','.review','.corenyan-trash','backups','cache','logs']});
export async function searchFiles(scopes,query,{signal,limits=SEARCH_LIMITS}={}){
 const q=String(query||'').trim().toLocaleLowerCase();if(!q||q.length>200)throw Error('搜索词需为1至200个字符');
 const result={items:[],scanned:0,skipped:0,truncated:false,errors:[],limits};
 const seen=new Set(),start=Date.now();let bytes=0;
 const stopped=()=>signal?.aborted||result.items.length>=limits.maxResults||result.scanned>=limits.maxFiles||Date.now()-start>limits.maxMs;
 async function walk(scope,dir,relative=''){
  if(stopped()){result.truncated=true;return;}
  let entries;try{entries=await fs.readdir(dir,{withFileTypes:true});}catch{result.errors.push(scope.label+': '+(relative||'/')+' 无法读取');return;}
  for(const entry of entries){
   if(stopped()){result.truncated=true;break;}
   if(entry.isSymbolicLink()||limits.skip.includes(entry.name)){result.skipped++;continue;}
   const target=path.join(dir,entry.name),rel=relative?relative+'/'+entry.name:entry.name;
   if(chatPrivatePath(target)){result.skipped++;continue;}
   if(entry.isDirectory()){await walk(scope,target,rel);continue;}
   if(!entry.isFile()||seen.has(target))continue;seen.add(target);result.scanned++;
   const nameMatch=rel.toLocaleLowerCase().includes(q);let line=null,snippet='',contentMatch=false;
   try{
    const stat=await fs.lstat(target);
    if(!stat.isFile()||stat.isSymbolicLink())continue;
    if(!isBinaryFile(rel)&&stat.size<=limits.maxBytes&&bytes+stat.size<=limits.totalBytes){
     bytes+=stat.size;const raw=await fs.readFile(target);
     if(!raw.includes(0)){
      let content;try{content=new TextDecoder('utf-8',{fatal:true}).decode(raw);}catch{result.skipped++;}
      if(content!==undefined){
       const at=content.toLocaleLowerCase().indexOf(q);if(at>=0){contentMatch=true;line=content.slice(0,at).split('\n').length;const begin=content.lastIndexOf('\n',at)+1;snippet=content.slice(begin,Math.max(begin+180,at+q.length)).split('\n')[0].slice(0,240);}
      }
     }else result.skipped++;
    }else {result.skipped++;if(!isBinaryFile(rel)&&stat.size<=limits.maxBytes&&bytes+stat.size>limits.totalBytes)result.truncated=true;}
   }catch{result.errors.push(scope.label+': '+rel+' 无法读取');}
   if(nameMatch||contentMatch)result.items.push({scope:scope.id,scopeLabel:scope.label,path:rel,name:entry.name,line,snippet,match:nameMatch&&contentMatch?'both':contentMatch?'content':'name'});
  }
 }
 for(const scope of scopes){await walk(scope,scope.root);if(stopped())break;}
 return result;
}
