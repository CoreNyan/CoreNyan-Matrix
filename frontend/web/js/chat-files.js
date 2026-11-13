import {CHAT_FILES as C} from '/contracts/chat-files.js';
const el=(tag,cls,text)=>{const n=document.createElement(tag);if(cls)n.className=cls;if(text)n.textContent=text;return n;};
export const documentPreview=file=>C.previewExtensions.includes(String(file.name||'').split('.').pop().toLowerCase());
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
 const card=el('div','chat-file'),isImage=file.mime?.startsWith('image/'),isDocument=documentPreview(file);
 if(isImage||isDocument){
  const button=el('button',isDocument?'chat-document-open':'chat-image-open'),img=el('img'),note=el('span','chat-document-state',C.loading),source=isDocument?url+'/preview?page=1':url;
  button.type='button';button.setAttribute('aria-label',(isDocument?C.previewLabel:'预览图片')+' '+file.name);img.alt=file.name;img.loading='lazy';img.decoding='async';
  let ready=false;const load=()=>{ready=false;img.hidden=false;note.hidden=false;note.textContent=C.loading;img.src=source;};
  img.onload=()=>{ready=true;note.hidden=true;};img.onerror=()=>{ready=false;img.hidden=true;note.hidden=false;note.textContent=C.unavailable;};button.append(img);if(isDocument)button.append(note);button.onclick=()=>ready?open(file,source):load();load();card.append(button);
 }else if(/^(audio|video)\//.test(file.mime)){const media=el(file.mime.startsWith('audio')?'audio':'video');media.src=url;media.controls=true;media.preload='metadata';card.append(media);}
 const info=el('div','chat-file-info'),a=el('a','chat-file-download',file.name+' ↓');a.href=url+'?download=1';a.download=file.name;
 a.onclick=async event=>{event.preventDefault();if(a.getAttribute('aria-busy')==='true')return;a.setAttribute('aria-busy','true');try{await downloadChatFile(file,a.href);}catch(error){onError(error.message);}finally{a.removeAttribute('aria-busy');}};
 info.append(a,el('small','',(file.bytes/1024).toFixed(1)+' KB'));card.append(info);return card;
}
