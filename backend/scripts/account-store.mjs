import {validatePreferences,DEFAULT_PREFERENCES} from '../../contracts/preference-schema.js';
import fs from 'node:fs';
import path from 'node:path';
import {randomUUID,randomBytes} from 'node:crypto';
export function createAccountStore(file){
 let data=JSON.parse(fs.readFileSync(file,'utf8'));
 const save=()=>{const tmp=file+'.'+randomUUID()+'.tmp';fs.writeFileSync(tmp,JSON.stringify(data,null,2),{mode:0o600});fs.renameSync(tmp,file);};
 if(!data.accounts){if(!data.username||!data.salt||!/^[a-f0-9]{128}$/.test(data.passwordHash))throw Error('Invalid Web credentials');data={version:2,accounts:[{...data,id:randomUUID(),role:'owner',createdAt:Date.now()}],website:{}};save();}
 if(data.version!==2||!Array.isArray(data.accounts)||!data.accounts.some(a=>a.role==='owner'))throw Error('Invalid account store');
 const publicAccount=a=>({id:a.id,username:a.username,role:a.role,avatar:a.avatar||'',linkedQQ:a.linkedQQ||'',createdAt:a.createdAt});
 const find=id=>data.accounts.find(a=>a.id===id);
 function name(value,id){const n=String(value||'').trim();if(!n||n.length>80||/[\x00-\x1f\x7f]/.test(n))throw Error('账号名需为 1–80 个字符');if(data.accounts.some(a=>a.id!==id&&a.username.toLowerCase()===n.toLowerCase()))throw Error('账号名已存在');return n;}
 function avatar(value){if(value==='')return '';if(typeof value!=='string'||value.length>800000||!/^data:image\/(?:png|jpeg|webp);base64,[A-Za-z0-9+/]+=*$/.test(value))throw Error('头像仅支持 PNG、JPEG、WebP，最大 600 KB');const b=Buffer.from(value.split(',')[1],'base64');if(!(b.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10]))||b[0]===255&&b[1]===216&&b[2]===255||b.toString('ascii',0,4)==='RIFF'&&b.toString('ascii',8,12)==='WEBP'))throw Error('头像文件格式无效');return value;}
 return {find,byName:n=>data.accounts.find(a=>a.username.toLowerCase()===String(n).toLowerCase()),list:()=>data.accounts.map(publicAccount),publicAccount,
  async create(a,hash){if(data.accounts.length>=50)throw Error('最多创建 50 个管理员账号');const username=name(a.username);if(typeof a.password!=='string'||a.password.length<16||a.password.length>256)throw Error('密码需为 16–256 位');const salt=randomBytes(24).toString('hex'),passwordHash=await hash(a.password,salt);name(username);const account={id:randomUUID(),username,salt,passwordHash,role:'admin',createdAt:Date.now()};data.accounts.push(account);save();return publicAccount(account);},
  update(id,a){const current=find(id);if(!current)throw Error('账号不存在');const next={...current};if(a.username!==undefined)next.username=name(a.username,id);if(a.avatar!==undefined)next.avatar=avatar(a.avatar);
   if(a.linkedQQ!==undefined){const qq=String(a.linkedQQ).trim();if(!/^[1-9]\d{4,15}$/.test(qq))throw Error('请输入有效的 QQ 号');if(current.linkedQQ&&current.linkedQQ!==qq)throw Error('已有身份关联不能直接更换，请先核对合并档案');if(data.accounts.some(x=>x.id!==id&&x.linkedQQ===qq))throw Error('该 QQ 已关联其他账号');next.linkedQQ=qq;}
   const previous=data.accounts;data.accounts=data.accounts.map(x=>x.id===id?next:x);try{save();}catch(error){data.accounts=previous;throw error;}return publicAccount(next);},
  password(id,salt,passwordHash){const a=find(id);if(!a)throw Error('账号不存在');Object.assign(a,{salt,passwordHash});save();},
  remove(id){const a=find(id);if(!a||a.role==='owner')throw Error('不能删除主管理员');data.accounts=data.accounts.filter(x=>x.id!==id);save();},
  preferences(id, update){
   const account=find(id);if(!account)throw Error('账号不存在');
   const current=account.preferences||{revision:0,values:{...DEFAULT_PREFERENCES}};
   if(update!==undefined){
    if(!update||Object.keys(update).some(k=>!['revision','values'].includes(k))||!Number.isSafeInteger(update.revision))throw Error('偏好更新格式无效');
    if(update.revision!==current.revision){const error=Error('其他设备已更新设置，请重试');error.status=409;throw error;}
    const next={revision:current.revision+1,values:validatePreferences(update.values)};
    account.preferences=next;try{save();}catch(error){account.preferences=current;throw error;}
   }
   return structuredClone(account.preferences||current);
  },
  website(a){if(a){data.website={...data.website,assistantAvatar:avatar(a.assistantAvatar)};save();}return data.website||{};}
 };
}
