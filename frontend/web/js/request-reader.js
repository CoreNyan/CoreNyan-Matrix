const node = (tag, cls, text) => { const el=document.createElement(tag); if(cls)el.className=cls;if(text!==undefined)el.textContent=text;return el; };
export function embeddedJson(value) {
 if(typeof value!=='string')return null;
 const trimmed=value.trim();if(!/^[\[{]/.test(trimmed))return null;
 try {const parsed=JSON.parse(trimmed);return parsed && typeof parsed==='object'?parsed:null;}catch{return null;}
}
export function streamEvents(value) {
 if(typeof value!=='string'||!/^data:/m.test(value))return null;
 const events=value.split(/\r?\n\r?\n/).map(block=>block.split(/\r?\n/).filter(line=>line.startsWith('data:')).map(line=>line.slice(5).trimStart()).join('\n')).filter(Boolean);
 if(!events.length)return null;
 return events.map(data=>{try{return JSON.parse(data);}catch{return data;}});
}
// Only JSON.parse decodes escapes. Prose/backslashes and the raw record are never rewritten.
export function renderRequestTree(value, {copy=()=>{}}={}) {
 function field(key, value, depth=0) {
  const complex=value!==null&&typeof value==='object',long=typeof value==='string'&&(value.length>180||value.includes('\n'));
  if(!complex&&!long){const row=node('div','request-field');row.append(node('span','request-key',key),node('span',typeof value==='string'?'request-string':'request-scalar',typeof value==='string'?value:JSON.stringify(value)));return row;}
  const details=node('details','request-node'),summary=node('summary');
  const hint=complex?(Array.isArray(value)?`${value.length} 项`:`${Object.keys(value).length} 个字段${typeof value.role==='string'?' · '+value.role:''}`):`${value.length.toLocaleString()} 字符 · ${value.split('\n').length} 行`;
  summary.append(node('span','request-key',key),node('span','request-hint',hint));
  if(long)summary.append(node('span','request-preview',value.slice(0,110).replace(/\s+/g,' ')+'…'));
  details.append(summary);let loaded=false;
  const populate=()=>{if(loaded)return;loaded=true;const body=node('div','request-children');details.append(body);
   if(complex){const entries=Object.entries(value);let offset=0;const more=node('button','','再显示 50 项');more.type='button';const next=()=>{more.remove();for(const [k,v] of entries.slice(offset,offset+50))body.append(field(k,v,depth+1));offset+=50;if(offset<entries.length)body.append(more);};more.onclick=next;next();}
   else {const actions=node('div','request-text-actions'),button=node('button','','复制文本');button.type='button';button.onclick=()=>copy(value);actions.append(button);body.append(actions);
    const parsed=embeddedJson(value),events=parsed?null:streamEvents(value);if(parsed||events){const child=field(parsed?'展开内嵌 JSON':'展开 SSE 事件（按接收顺序）',parsed||events,depth+1);body.append(child);}
    const pre=node('pre','request-text',value.slice(0,12000));body.append(pre);let offset=12000;
    if(value.length>offset){const more=node('button','','继续显示文本（每次 12,000 字符）');more.type='button';more.onclick=()=>{pre.append(document.createTextNode(value.slice(offset,offset+12000)));offset+=12000;if(offset>=value.length)more.remove();};body.append(more);}
   }
  };
  details.addEventListener('toggle',()=>{if(details.open)populate();});
  if(complex&&depth<2){details.open=true;populate();}return details;
 }
 const root=node('div','request-tree'),metadata={};
 const labels={request:'请求 · request',response:'响应 · response',outcome:'处理结果 · outcome',error:'错误 · error',context:'会话上下文 · context'};
 for(const [key,label] of Object.entries(labels))if(Object.hasOwn(value??{},key)&&value[key]!=null)root.append(field(label,value[key]));
 for(const [key,v] of Object.entries(value??{}))if(!Object.hasOwn(labels,key))metadata[key]=v;
 if(Object.keys(metadata).length)root.append(field('记录信息（ID、时间、模型等）',metadata,2));
 return root;
}
