import {CHAT_FILES as C} from '/contracts/chat-files.js';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
export const documentPreview=file=>C.previewExtensions.includes(String(file.name||'').split('.').pop().toLowerCase());
export const textPreview=file=>C.textExtensions.includes(String(file.name||'').split('.').pop().toLowerCase())||/^text\//i.test(file.mime||'');
export async function downloadChatFile(file,url){
 const absolute=new URL(url,location.href);if(absolute.origin!==location.origin)throw Error(C.downloadError);
 if(globalThis.MatrixNative?.download)return MatrixNative.download({url:absolute.href,name:file.name,mime:file.mime||'application/octet-stream'});
 const response=await fetch(absolute.href,{credentials:'same-origin',cache:'no-store'});
 if(response.status===401||response.status===403)throw Error(C.sessionExpired);
 if(!response.ok)throw Error(C.downloadError);
 const blob=await response.blob();if(file.bytes&&blob.size!==file.bytes)throw Error('文件传输不完整，请重新下载');
 const objectUrl=URL.createObjectURL(blob),a=document.createElement('a');a.href=objectUrl;a.download=file.name;a.hidden=true;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(objectUrl),C.revokeAfterMs);
}
export function createChatFileCard(file,{url,open,onError}){
 const card=el('div','chat-file'),isImage=file.mime?.startsWith('image/'),isDocument=documentPreview(file),isText=textPreview(file),isMedia=/^(audio|video)\//.test(file.mime||'');
 if(isImage||isDocument||isText){
  const button=el('button',isDocument||isText?'chat-document-open':'chat-image-open'),img=el('img'),note=el('span','chat-document-state',isText?'打开文本预览':C.loading),source=isDocument?url+'/preview?page=1':url;
  button.type='button';button.setAttribute('aria-label',(isText?'预览文本':isDocument?C.previewLabel:'预览图片')+' '+file.name);
  if(isText){button.append(el('span','chat-text-file-icon',(String(file.name||'TXT').split('.').pop()||'TXT').slice(0,5).toUpperCase()),note);button.onclick=()=>open(file,url,'text');}
  else{img.alt=file.name;img.loading='lazy';img.decoding='async';let ready=false;const load=()=>{ready=false;img.hidden=false;note.hidden=false;note.textContent=C.loading;img.src=source;};img.onload=()=>{ready=true;note.hidden=true;};img.onerror=()=>{ready=false;img.hidden=true;note.hidden=false;note.textContent=C.unavailable;};button.append(img);if(isDocument)button.append(note);button.onclick=()=>ready?open(file,source,isDocument?'document':'image'):load();load();}
  card.append(button);
 }else if(isMedia){const button=el('button','chat-media-open',file.mime.startsWith('audio')?'打开音频':'打开视频');button.type='button';button.onclick=()=>open(file,url,'media');card.append(button);}
 const info=el('div','chat-file-info'),a=el('a','chat-file-download',file.name+' ↓');a.href=url+'?download=1';a.download=file.name;
 a.onclick=async event=>{event.preventDefault();if(a.getAttribute('aria-busy')==='true')return;a.setAttribute('aria-busy','true');try{await downloadChatFile(file,a.href);}catch(error){onError(error.message);}finally{a.removeAttribute('aria-busy');}};
 info.append(a,el('small','',(file.bytes/1024).toFixed(1)+' KB'));card.append(info);return card;
}
