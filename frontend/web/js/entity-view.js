import {shortcut} from './preferences.js';
import {ENTITY,ENTITY_MODELS} from './constants.js';
import {entityKind,buildEntityModel} from './entity-assets.js';
import {createEntityRenderer} from './entity-point-renderer.js';
import {mountEntityTelemetry} from './entity-telemetry.js';
export function mountEntityView(root,registry,layers=()=>[]){
 const canvas=root.querySelector('canvas'),status=root.querySelector('[data-entity-status]');
 const renderer=createEntityRenderer(canvas,{fallback:message=>status.textContent=message});
 const renderTelemetry=mountEntityTelemetry(root.querySelector('.entity-flight'));
 const camera={yaw:ENTITY.defaultYaw,pitch:ENTITY.defaultPitch,zoom:ENTITY.defaultZoom,pointSize:ENTITY.pointSize,reveal:1};
 const pointers=new Map();
 let frame=0,last=0,dirty=true,disposed=false,kind='',layerKey='',tabsSignature='',rotSpeed=ENTITY.rotSpeed,lastClock='',warmed=false;
 const text=(selector,value)=>root.querySelector(selector).textContent=value;
 const visible=()=>!document.hidden&&registry.state.activeView==='entity';
 function wake(){if(!frame&&!disposed&&visible()){last=0;frame=requestAnimationFrame(draw);}}
 function draw(now){
  frame=0;if(disposed||!visible())return;
  const dt=last?Math.min(.05,(now-last)/1000):0;last=now;
  const auto=registry.state.motionEnabled&&rotSpeed>0&&!pointers.size;
  if(auto)camera.yaw+=rotSpeed*dt;
  const revealing=camera.reveal<1;
  camera.reveal=registry.state.motionEnabled?Math.min(1,camera.reveal+dt*1000/ENTITY.revealMs):1;
  if(dirty||revealing||auto){renderer.draw(camera);dirty=false;}
  if(auto||camera.reveal<1)frame=requestAnimationFrame(draw);
 }
 function resize(){const rect=canvas.getBoundingClientRect();if(rect.width&&rect.height){renderer.resize(rect.width,rect.height);dirty=true;wake();}}
 const observer=new ResizeObserver(resize);observer.observe(canvas);
 function select(key){registry.state.entityLayer=key;}
 function sync(){
  const list=layers();if(!list.length)return;
  const signature=JSON.stringify(list.map(l=>[l.key,l.name]));
  if(signature!==tabsSignature){
   tabsSignature=signature;const tabs=root.querySelector('[data-entity-tabs]');tabs.replaceChildren();
   list.forEach((layer,i)=>{const button=document.createElement('button'),index=document.createElement('span');button.type='button';button.dataset.layerKey=layer.key;index.textContent=String(i+1).padStart(2,'0');button.append(index,document.createTextNode(layer.name));button.addEventListener('click',()=>select(layer.key));tabs.append(button);});
  }
  const layer=list.find(l=>l.key===registry.state.entityLayer)||list[0],nextKind=entityKind(layer),info=ENTITY_MODELS[nextKind];
  if(nextKind!==kind){
   kind=nextKind;status.textContent='正在加载实体点阵…';
   renderer.setModel(kind).then(model=>{
    if(!model)return;
    status.textContent='';text('[data-entity-points]',model.count.toLocaleString());
    if(!warmed){warmed=true;setTimeout(()=>{for(const item of layers())if(entityKind(item)!==kind)buildEntityModel(entityKind(item)).catch(()=>{});},300);}
    camera.reveal=registry.state.motionEnabled?0:1;dirty=true;wake();
   }).catch(error=>{if(kind===nextKind){status.textContent=error.message;kind='';}});
  }
  if(layer.key!==layerKey){layerKey=layer.key;camera.yaw=info.yaw;camera.pitch=info.pitch;dirty=true;}
  text('[data-entity-name]',layer.name);text('[data-entity-code]',layer.organCode||'');
  text('[data-entity-sub]',layer.sub||'');text('[data-entity-description]',layer.desc||'');
  text('[data-entity-model]',info.code);text('[data-entity-index]',String(list.indexOf(layer)+1).padStart(2,'0')+' / '+String(list.length).padStart(2,'0'));
  
  root.querySelectorAll('[data-layer-key]').forEach(button=>{button.classList.toggle('active',button.dataset.layerKey===layerKey);button.setAttribute('aria-pressed',String(button.dataset.layerKey===layerKey));});
  renderTelemetry(layer);
  const clock=new Date().toLocaleTimeString('zh-CN',{hour12:false,timeZone:'Asia/Shanghai'});if(clock!==lastClock){text('#entityClock',clock);lastClock=clock;}
  if(visible())wake();else{cancelAnimationFrame(frame);frame=0;}
 }
 const unsubscribe=registry.subscribe(['activeView','motionEnabled','lastVitalsPayload','entityLayer'],sync);
 function cycle(delta){const list=layers();if(!list.length)return;const i=list.findIndex(l=>l.key===layerKey);select(list[(i+delta+list.length)%list.length].key);}
 root.querySelector('[data-entity-prev]').addEventListener('click',()=>cycle(-1));
 root.querySelector('[data-entity-next]').addEventListener('click',()=>cycle(1));
 function update(){camera.pitch=Math.max(-1.3,Math.min(1.3,camera.pitch));camera.zoom=Math.max(ENTITY.zoomMin,Math.min(ENTITY.zoomMax,camera.zoom));text('[data-entity-zoom]',Math.round(camera.zoom*100)+'%');dirty=true;wake();}
 for(const [selector,delta] of [['[data-entity-zoom-in]',ENTITY.zoomStep],['[data-entity-zoom-out]',-ENTITY.zoomStep]])root.querySelector(selector).addEventListener('click',()=>{camera.zoom+=delta;update();});
 root.querySelector('[data-entity-reset]').addEventListener('click',()=>{Object.assign(camera,{yaw:ENTITY_MODELS[kind]?.yaw??ENTITY.defaultYaw,pitch:ENTITY_MODELS[kind]?.pitch??ENTITY.defaultPitch,zoom:ENTITY.defaultZoom});update();});
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
 const onVisibility=()=>{if(document.hidden){cancelAnimationFrame(frame);frame=0;}else{dirty=true;wake();}};
 document.addEventListener('visibilitychange',onVisibility);
 update();resize();
 return {setLayer:select,dispose(){disposed=true;cancelAnimationFrame(frame);unsubscribe();observer.disconnect();document.removeEventListener('visibilitychange',onVisibility);renderer.dispose();}};
}
