import {createFrameBudget,visualActive,observeVisualActivity} from './render-budget.js';
import {shortcut,preferences} from './preferences.js';
import {ENTITY,ENTITY_MODELS,RENDER_BUDGET} from './constants.js';
import {entityKind,buildEntityModel} from './entity-assets.js';
import {createEntityRenderer} from './entity-point-renderer.js';
import {mountEntityTelemetry} from './entity-telemetry.js';
export function mountEntityView(root,registry,layers=()=>[]){
 const canvas=root.querySelector('canvas'),status=root.querySelector('[data-entity-status]');
 const renderer=createEntityRenderer(canvas,{fallback:message=>status.textContent=message});
 const renderTelemetry=mountEntityTelemetry(root.querySelector('.entity-flight'));
 const camera={yaw:ENTITY.defaultYaw,pitch:ENTITY.defaultPitch,zoom:ENTITY.defaultZoom,pointSize:ENTITY.pointSize,focus:ENTITY.defaultFocus,reveal:1};
 let focusTarget=ENTITY.defaultFocus,transition=null;
 const pointers=new Map();
 let frame=0,last=0,dirty=true,disposed=false,kind='',layerKey='',tabsSignature='',rotSpeed=ENTITY.rotSpeed,lastClock='';
 const text=(selector,value)=>root.querySelector(selector).textContent=value;
 const budget=createFrameBudget(()=>preferences().fpsLimit);
 const visible=()=>!document.hidden&&registry.state.activeView==='entity'&&(visualActive()||!canvas.hasAttribute('data-first-frame'));
 function wake(){if(!frame&&!disposed&&visible()){last=0;frame=budget.request(draw);}}
 function draw(now){
  frame=0;if(disposed||!visible())return;
  const dt=last?Math.min(.05,(now-last)/1000):0;last=now;
  if(transition&&!transition.prepared)return;
  const wantsRotation=registry.state.motionEnabled&&rotSpeed>0&&!pointers.size,auto=wantsRotation&&!transition;
  if(auto)camera.yaw+=rotSpeed*dt;
  let focusing=Math.abs(camera.focus-focusTarget)>.001;
  camera.focus=focusing&&registry.state.motionEnabled?camera.focus+(focusTarget-camera.focus)*(1-Math.exp(-dt*1000/ENTITY.focusEaseMs)):focusTarget;
  let phase='idle',progress=0;
  const t=transition;
  if(t){
   t.elapsed+=dt*1000;
   const duration=t.phase==='scatter'?ENTITY.scatterMs:ENTITY.assembleMs;
   const amount=registry.state.motionEnabled?Math.min(1,t.elapsed/duration):1;
   const eased=amount*amount*(3-2*amount);
   phase=t.phase;progress=eased;
   if(t.phase==='scatter'&&amount===1&&t.ready&&!t.swapping){
    t.swapping=true;
    renderer.setModel(t.kind,{isCurrent:()=>transition===t&&!disposed}).then(async model=>{
     if(!model||transition!==t||disposed)return;
     text('[data-entity-points]',model.count.toLocaleString());status.textContent='';
     camera.yaw=ENTITY_MODELS[t.kind].yaw;camera.pitch=ENTITY_MODELS[t.kind].pitch;camera.reveal=1;
     if(!t.hasSource){t.prepared=false;await renderer.beginTransition(camera,{isCurrent:()=>transition===t&&!disposed});t.prepared=true;}
     if(transition!==t||disposed)return;
     t.phase='assemble';t.elapsed=0;t.swapping=false;canvas.dataset.transition='assemble';dirty=true;wake();
    }).catch(error=>failTransition(t,error));
   }else if(t.phase==='assemble'&&amount===1){transition=null;phase='idle';progress=0;canvas.dataset.transition='idle';}
  }
  if(dirty||auto||focusing||t){renderer.draw({...camera,phase,progress});dirty=false;if(canvas.dataset.model&&!transition)canvas.setAttribute('data-first-frame','');}
  if(wantsRotation&&!transition||focusing||transition&&!transition.swapping&&(transition.ready||transition.elapsed<ENTITY.scatterMs))frame=budget.request(draw);
 }
 function resize(){const rect=canvas.getBoundingClientRect();if(rect.width&&rect.height){renderer.resize(rect.width,rect.height);dirty=true;wake();}}
 const observer=new ResizeObserver(resize);observer.observe(canvas);
 function failTransition(t,error){if(transition!==t||disposed)return;status.textContent=error.message;transition=null;kind=canvas.dataset.model||'';canvas.dataset.transition='error';canvas.dataset.loading='false';dirty=true;wake();}
 function select(key){registry.state.entityLayer=key;}
 function sync(){
  if(registry.state.activeView!=='entity'){budget.cancel(frame);frame=0;return;}
  const list=layers();if(!list.length)return;
  const signature=JSON.stringify(list.map(l=>[l.key,l.name]));
  if(signature!==tabsSignature){
   tabsSignature=signature;const tabs=root.querySelector('[data-entity-tabs]');tabs.replaceChildren();
   list.forEach((layer,i)=>{const button=document.createElement('button'),index=document.createElement('span');button.type='button';button.dataset.layerKey=layer.key;index.textContent=String(i+1).padStart(2,'0');button.append(index,document.createTextNode(layer.name));button.addEventListener('click',()=>select(layer.key));tabs.append(button);});
  }
  const layer=list.find(l=>l.key===registry.state.entityLayer)||list[0],nextKind=entityKind(layer),info=ENTITY_MODELS[nextKind];
  if(nextKind!==kind){
   kind=nextKind;status.textContent='正在加载实体点阵…';
   const t={kind:nextKind,phase:'scatter',elapsed:canvas.dataset.model?0:ENTITY.scatterMs,hasSource:false,prepared:false,ready:false,swapping:false};transition=t;canvas.dataset.transition='scatter';
   renderer.beginTransition(camera,{isCurrent:()=>transition===t&&!disposed}).then(hasSource=>{if(transition!==t||disposed)return;t.hasSource=hasSource;t.prepared=true;dirty=true;wake();}).catch(error=>failTransition(t,error));
   buildEntityModel(kind).then(()=>{
    if(transition!==t||disposed)return;t.ready=true;dirty=true;wake();
   }).catch(error=>failTransition(t,error));
  }
  if(layer.key!==layerKey){layerKey=layer.key;dirty=true;}
  text('[data-entity-name]',layer.name);text('[data-entity-code]',layer.organCode||'');
  text('[data-entity-sub]',layer.sub||'');text('[data-entity-description]',layer.desc||'');
  text('[data-entity-model]',info.code);text('[data-entity-index]',String(list.indexOf(layer)+1).padStart(2,'0')+' / '+String(list.length).padStart(2,'0'));
  
  root.querySelectorAll('[data-layer-key]').forEach(button=>{button.classList.toggle('active',button.dataset.layerKey===layerKey);button.setAttribute('aria-pressed',String(button.dataset.layerKey===layerKey));});
  renderTelemetry(layer);
  const clock=new Date().toLocaleTimeString('zh-CN',{hour12:false,timeZone:'Asia/Shanghai'});if(clock!==lastClock){text('#entityClock',clock);lastClock=clock;}
  if(visible())wake();else{budget.cancel(frame);frame=0;}
 }
 const unsubscribe=registry.subscribe(['activeView','motionEnabled','lastVitalsPayload','entityLayer'],sync);
 function cycle(delta){const list=layers();if(!list.length)return;const i=list.findIndex(l=>l.key===layerKey);select(list[(i+delta+list.length)%list.length].key);}
 root.querySelector('[data-entity-prev]').addEventListener('click',()=>cycle(-1));
 root.querySelector('[data-entity-next]').addEventListener('click',()=>cycle(1));
 function update(){camera.pitch=Math.max(-1.3,Math.min(1.3,camera.pitch));camera.zoom=Math.max(ENTITY.zoomMin,Math.min(ENTITY.zoomMax,camera.zoom));text('[data-entity-zoom]',Math.round(camera.zoom*100)+'%');dirty=true;wake();}
 for(const [selector,delta] of [['[data-entity-zoom-in]',ENTITY.zoomStep],['[data-entity-zoom-out]',-ENTITY.zoomStep]])root.querySelector(selector).addEventListener('click',()=>{camera.zoom+=delta;update();});
 root.querySelector('[data-entity-reset]').addEventListener('click',()=>{Object.assign(camera,{yaw:ENTITY_MODELS[kind]?.yaw??ENTITY.defaultYaw,pitch:ENTITY_MODELS[kind]?.pitch??ENTITY.defaultPitch,zoom:ENTITY.defaultZoom});update();});
 const focusInput=root.querySelector('[data-entity-focus]');focusInput.value=String(focusTarget);
 const syncFocus=()=>{text('[data-entity-focus-value]',Math.round(focusTarget*100)+'%');focusInput.setAttribute('aria-valuetext',Math.round(focusTarget*100)+'%');update();};
 focusInput.addEventListener('input',()=>{focusTarget=Math.max(0,Math.min(1,Number(focusInput.value)));syncFocus();});
 root.querySelector('[data-entity-reset]').addEventListener('click',()=>{focusTarget=ENTITY.defaultFocus;focusInput.value=String(focusTarget);syncFocus();});
 const pointInput=root.querySelector('[data-entity-point-size]');pointInput.value=String(camera.pointSize);
 pointInput.addEventListener('input',()=>{camera.pointSize=Number(pointInput.value);update();});
 const rotationInput=root.querySelector('[data-entity-rotation]');rotationInput.value=String(rotSpeed);
 rotationInput.addEventListener('input',()=>{rotSpeed=Number(rotationInput.value);update();});
 const gridInput=root.querySelector('[data-entity-grid]');gridInput.value=String(ENTITY.gridGain);
 gridInput.addEventListener('input',()=>root.style.setProperty('--entity-grid-gain',gridInput.value));
 function distance(){const [a,b]=[...pointers.values()];return a&&b?Math.hypot(b.x-a.x,b.y-a.y):0;}
 canvas.addEventListener('pointerdown',event=>{canvas.setPointerCapture(event.pointerId);pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});});
 canvas.addEventListener('pointermove',event=>{
  const previous=pointers.get(event.pointerId);if(!previous)return;
  const before=distance();pointers.set(event.pointerId,{x:event.clientX,y:event.clientY});
  if(pointers.size===1){camera.yaw+=(event.clientX-previous.x)*.008;camera.pitch+=(event.clientY-previous.y)*.008;}
  else if(before>0)camera.zoom*=distance()/before;
  update();
 });
 const release=event=>{pointers.delete(event.pointerId);wake();};
 canvas.addEventListener('pointerup',release);canvas.addEventListener('pointercancel',release);canvas.addEventListener('lostpointercapture',release);
 canvas.addEventListener('wheel',event=>{event.preventDefault();camera.zoom*=Math.exp(-event.deltaY*.001);update();},{passive:false});
 canvas.addEventListener('keydown',event=>{
  if(shortcut(event,'entity.left'))camera.yaw-=.1;else if(shortcut(event,'entity.right'))camera.yaw+=.1;
  else if(shortcut(event,'entity.up'))camera.pitch+=.1;else if(shortcut(event,'entity.down'))camera.pitch-=.1;
  else if(shortcut(event,'entity.zoomIn'))camera.zoom+=ENTITY.zoomStep;else if(shortcut(event,'entity.zoomOut'))camera.zoom-=ENTITY.zoomStep;else return;
  event.preventDefault();update();
 });
 canvas.addEventListener('entity-renderer-restored',()=>{dirty=true;wake();});
 const onVisibility=()=>{if(!visualActive()){budget.cancel(frame);frame=0;}else{dirty=true;wake();}};
 const offActivity=observeVisualActivity(onVisibility);
 update();resize();
 return {setLayer:select,dispose(){disposed=true;budget.cancel(frame);unsubscribe();observer.disconnect();offActivity();renderer.dispose();}};
}
