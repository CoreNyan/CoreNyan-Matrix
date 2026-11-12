import {UI} from './constants.js';
// Keep selected DOM intact while polling continues to update the latest snapshot.
export function createTerminalView(element,{onDeferred=()=>{}}={}){
 let latest=null,renderedHtml=null,renderedKey=null,dragging=false;
 const doc=element.ownerDocument;
 const selected=()=>{const s=doc.getSelection();return s&&!s.isCollapsed&&(element.contains(s.anchorNode)||element.contains(s.focusNode));};
 function flush(){
  if(!latest)return;
  const {html,key}=latest;
  if(key!==renderedKey){if(selected())doc.getSelection().removeAllRanges();dragging=false;}
  else if(dragging||selected()||element.dataset.contextMenuOpen==='true'){onDeferred(html!==renderedHtml);return;}
  onDeferred(false);
  if(html===renderedHtml&&key===renderedKey)return;
  const bottom=element.scrollHeight-element.scrollTop-element.clientHeight<UI.logBottomThreshold;
  const template=doc.createElement('template');template.innerHTML=html;
  const old=[...element.childNodes],next=[...template.content.childNodes];
  let prefix=0,suffix=0;
  while(prefix<old.length&&prefix<next.length&&old[prefix].isEqualNode(next[prefix]))prefix++;
  while(suffix<old.length-prefix&&suffix<next.length-prefix&&old[old.length-1-suffix].isEqualNode(next[next.length-1-suffix]))suffix++;
  const anchor=suffix?old[old.length-suffix]:null;
  for(let i=prefix;i<old.length-suffix;i++)old[i].remove();
  for(let i=prefix;i<next.length-suffix;i++)element.insertBefore(next[i],anchor);
  renderedHtml=html;renderedKey=key;
  if(bottom)element.scrollTop=element.scrollHeight;
 }
 element.addEventListener('pointerdown',()=>{dragging=true;});
 doc.addEventListener('pointerup',()=>{dragging=false;flush();});
 doc.addEventListener('pointercancel',()=>{dragging=false;flush();});
 doc.addEventListener('selectionchange',flush);
 return {update(html,key){latest={html,key};flush();}};
}
