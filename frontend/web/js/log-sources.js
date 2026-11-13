import {SERVICE_CONTROL} from './organ-control-policy.js';
const rendered=new WeakMap();
export function renderLogSources(select,layers,selected){
 const sources=layers.filter(layer=>layer.id!==SERVICE_CONTROL.brainFile).slice().sort((a,b)=>Number(Boolean(b.online))-Number(Boolean(a.online)));
 const signature=JSON.stringify(sources.map(layer=>[layer.id,layer.name,Boolean(layer.online)]));
 if(rendered.get(select)!==signature){
  select.replaceChildren(...sources.map(layer=>{const option=new Option(layer.name+' · '+layer.id,layer.id);option.classList.toggle('log-source-offline',!layer.online);return option;}));
  rendered.set(select,signature);
 }
 const id=selected===SERVICE_CONTROL.brainFile?SERVICE_CONTROL.brain:selected;
 const next=sources.find(layer=>layer.id===id)||sources[0];
 select.value=next?.id||'';select.classList.toggle('log-source-offline',Boolean(next&&!next.online));
 return next?.id||SERVICE_CONTROL.brain;
}
