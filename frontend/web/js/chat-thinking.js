const el=(tag,cls,text)=>{const node=document.createElement(tag);node.className=cls;if(text!==undefined)node.textContent=text;return node;};
export function createThinkingPanel(tasks){
 const running=tasks.some(task=>task.status==='running');
 const panel=el('section','chat-task-list'+(running?' is-thinking':''));
 panel.setAttribute('role','status');panel.setAttribute('aria-live','polite');panel.setAttribute('aria-label','正在处理的任务');
 const header=el('div','thought-header'),symbol=el('div','thought-symbol');symbol.setAttribute('aria-hidden','true');
 symbol.innerHTML='<svg viewBox="0 0 64 64" fill="none"><path class="thought-brackets" d="M16 6H6v10m42-10h10v10M6 48v10h10m42-10v10H48"/><g class="thought-fold thought-fold-a"><rect x="17" y="17" width="30" height="30" rx="5"/></g><g class="thought-fold thought-fold-b"><rect x="21" y="21" width="22" height="22" rx="3"/></g><path class="thought-thread" pathLength="100" d="M8 32h12l7-10 10 20 7-10h12"/><path class="thought-pencil" d="m30 30 4 4m-4 0 4-4"/></svg>';
 const caption=el('div','thought-caption');caption.append(el('strong','chat-task-heading',running?'小可正在思考中':'小可记下啦，稍等一下'),el('span','thought-caption-note',running?'把思路慢慢拼起来…':'前面的事情处理完，就轮到这条。'));
 header.append(symbol,caption);panel.append(header);
 const list=el('ul','thought-tasks');
 for(const task of tasks){
  const row=el('li','chat-task'+(task.status==='running'?' is-thinking':' is-queued')),indicator=el('span','chat-task-indicator'),detail=el('span','chat-task-detail');indicator.setAttribute('aria-hidden','true');
  row.append(indicator,el('span','chat-task-state',task.status==='running'?'正在处理':'等待处理'),detail);
  const request=task.text?.trim()||('处理附件：'+(task.files||[]).map(file=>file.name).join('、'));
  detail.textContent=request.slice(0,180);if(request.length>180)detail.title=request;list.append(row);
 }
 panel.append(list);return panel;
}
