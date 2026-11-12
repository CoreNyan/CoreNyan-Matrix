import {showDialog,closeDialog,reveal} from './ui-motion.js';
import {EVIDENCE_UI} from './constants.js';
const esc=v=>String(v??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function evidenceChannel(id){
 const value=String(id||'');
 for(const [prefix,label] of Object.entries(EVIDENCE_UI.channels)){
  if(value===prefix)return label;
  if(prefix.endsWith('_')&&value.startsWith(prefix))return label+' · '+value.slice(prefix.length);
 }
 return value?'其他途径 · '+value:EVIDENCE_UI.unknown;
}
export function imageSource(value){
 try{const url=new URL(value);return ['https:','http:'].includes(url.protocol)&&!url.username&&!url.password?url.href:null;}catch{return null;}
}
export function evidenceParts(value){
 const text=String(value||''),parts=[];
 const pattern=/\[图片[:：]\s*([^\]]+)\]|!\[[^\]]*\]\((https?:\/\/[^\s)]+)\)|\[CQ:image,([^\]]+)\]/g;
 let start=0,match;
 while((match=pattern.exec(text))){
  let raw=match[1]||match[2];
  if(match[3]){const fields=Object.fromEntries(match[3].split(',').map(p=>{const at=p.indexOf('=');return [p.slice(0,at),p.slice(at+1)];}));raw=fields.url||fields.file;}
  raw=String(raw||'').replace(/&amp;/g,'&').replace(/&#91;/g,'[').replace(/&#93;/g,']').replace(/&#44;/g,',').trim();
  const src=imageSource(raw);
  if(!src)continue;
  if(match.index>start)parts.push({text:text.slice(start,match.index)});
  parts.push({src});start=pattern.lastIndex;
 }
 if(start<text.length)parts.push({text:text.slice(start)});
 return parts;
}
export function renderEvidenceText(text){
 return evidenceParts(text).map(part=>part.src?`<figure class="evidence-image"><button type="button" data-evidence-image="${esc(part.src)}" aria-label="放大交流记录中的图片"><img src="${esc(part.src)}" alt="交流记录图片" loading="lazy" decoding="async" referrerpolicy="no-referrer"></button><figcaption hidden>${esc(EVIDENCE_UI.imageUnavailable)}</figcaption></figure>`:`<span class="evidence-text">${esc(part.text)}</span>`).join('');
}
export function mountEvidenceImages(root){
 const dialog=document.createElement('dialog');dialog.className='evidence-image-dialog';dialog.id='evidenceImageDialog';dialog.dataset.navigationIndependent='';
 dialog.setAttribute('aria-label','交流图片预览');
 dialog.innerHTML='<button type="button" class="wire-action-btn" data-evidence-close>关闭 ×</button><img alt="交流图片放大预览" referrerpolicy="no-referrer"><p hidden></p>';
 document.body.append(dialog);
 const close=()=>{closeDialog(dialog).then(closed=>{if(closed&&!dialog.open)dialog.querySelector('img').removeAttribute('src');});};
 dialog.querySelector('button').addEventListener('click',close);
 dialog.addEventListener('cancel',e=>{if(e.target!==dialog)return;e.preventDefault();close();});
 dialog.addEventListener('keydown',e=>{if(e.key==='Escape')e.stopPropagation();});
 dialog.addEventListener('click',e=>{if(e.target===dialog)close();});
 root.addEventListener('error',e=>{
  const figure=e.target.closest?.('.evidence-image');if(!figure||e.target.tagName!=='IMG')return;
  e.target.hidden=true;figure.querySelector('figcaption').hidden=false;
  const button=figure.querySelector('button');
  button.setAttribute('aria-label','重试打开交流图片');
  if(!button.querySelector('span')){const label=document.createElement('span');label.textContent='重试查看图片';button.append(label);}
 },true);
 dialog.querySelector('img').addEventListener('error',()=>{
  dialog.querySelector('img').hidden=true;dialog.querySelector('p').hidden=false;dialog.querySelector('p').textContent=EVIDENCE_UI.imageUnavailable;
 });
 root.addEventListener('click',e=>{
  const button=e.target.closest('[data-evidence-image]');if(!button)return;
  const src=imageSource(button.dataset.evidenceImage);if(!src)return;
  const img=dialog.querySelector('img');img.hidden=false;dialog.querySelector('p').hidden=true;img.src=src;showDialog(dialog);
 });
}
