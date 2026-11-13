export function mountModelPicker(host,{actions,loadModels,currentIds,append,available,canStart}){
 let models=[],selected=new Set(),loading=false,disposed=false,renderedSignature='';
 const button=document.createElement('button');button.type='button';button.dataset.fetchModels='';button.textContent='获取模型列表';actions.append(button);
 host.innerHTML='<section class="preset-model-picker" hidden><label>搜索模型<input type="search" data-model-filter placeholder="输入模型 ID" autocomplete="off"></label><div data-model-options role="group" aria-label="可用模型"></div><button type="button" data-append-models>添加所选模型</button></section><p data-model-fetch-status role="status" aria-live="polite"></p>';
 const q=s=>host.querySelector(s),panel=q('section'),filter=q('input'),options=q('[data-model-options]'),add=q('[data-append-models]'),status=q('[data-model-fetch-status]');
 function controls(){const existing=new Set(currentIds().map(id=>id.trim()));for(const check of options.querySelectorAll('input'))check.disabled=existing.has(check.value)||!canStart();button.disabled=loading||!canStart();button.textContent=loading?'获取中…':'获取模型列表';add.disabled=!canStart()||!selected.size||selected.size>available();add.textContent=selected.size?'添加所选模型（'+selected.size+'）':'添加所选模型';}
 function render(){
  renderedSignature=JSON.stringify([currentIds(),canStart()]);
  const existing=new Set(currentIds().map(id=>id.trim()));selected=new Set([...selected].filter(id=>!existing.has(id)));
  const shown=models.filter(id=>id.toLowerCase().includes(filter.value.trim().toLowerCase()));
  options.replaceChildren(...shown.map(id=>{const label=document.createElement('label'),check=document.createElement('input'),text=document.createElement('span');check.type='checkbox';check.value=id;check.checked=selected.has(id);check.disabled=existing.has(id)||!canStart();text.textContent=id+(existing.has(id)?' · 已添加':'');check.onchange=()=>{if(check.checked)selected.add(id);else selected.delete(id);status.textContent=selected.size>available()?'当前最多还能添加 '+available()+' 个模型。':'';controls();};label.append(check,text);return label;}));
  if(!shown.length){const empty=document.createElement('p');empty.textContent=models.length?'没有匹配的模型':'该端点没有返回可用模型';options.append(empty);}
  controls();
 }
 button.onclick=async()=>{if(loading||!canStart())return;loading=true;selected.clear();models=[];panel.hidden=true;status.textContent='';controls();try{const result=await loadModels();if(disposed)return;models=result.models;filter.value='';panel.hidden=false;render();}catch(e){if(!disposed)status.textContent=e.message;}finally{loading=false;if(!disposed)controls();}};
 filter.oninput=render;
 add.onclick=()=>{if(!canStart()||selected.size>available())return;append(models.filter(id=>selected.has(id)));selected.clear();render();status.textContent='已添加到模型列表，可拖动调整主选和顺序。';};
 controls();return {refresh:()=>{controls();if(!panel.hidden&&renderedSignature!==JSON.stringify([currentIds(),canStart()]))render();},invalidate:()=>{selected.clear();models=[];panel.hidden=true;status.textContent='';controls();},destroy:()=>{disposed=true;}};
}
