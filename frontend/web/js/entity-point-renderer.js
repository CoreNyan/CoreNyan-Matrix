import {ENTITY,ENTITY_MODELS} from './constants.js';
import {buildEntityModel,rotatePoint} from './entity-assets.js';
const vertex=`attribute vec3 aPosition;attribute vec3 aNormal;attribute float aIndex;attribute vec2 aOffset;
attribute vec4 aFrom;attribute vec2 aStyle;attribute vec3 aCloud;
uniform vec2 uAngle;uniform float uZoom;uniform float uAspect;uniform float uPoint;uniform float uDpr;uniform float uReveal;uniform float uFocus;uniform float uFit;uniform float uCount;uniform float uPhase;uniform float uProgress;uniform float uCloudAlpha;uniform float uDefocusAlpha;uniform float uEdgeFade;uniform float uCurl;
varying float vInk;varying float vReveal;
void main(){
 float cy=cos(uAngle.x),sy=sin(uAngle.x),cp=cos(uAngle.y),sp=sin(uAngle.y);
 vec3 p=vec3(aPosition.x*cy+aPosition.z*sy,aPosition.y,-aPosition.x*sy+aPosition.z*cy);
 p=vec3(p.x,p.y*cp-p.z*sp,p.y*sp+p.z*cp);
 float d=7.-p.z;
 // Focus displaces each projected point; it never scales the model or its framing.
 vec3 target=vec3(p.xy*2.05*uFit/d+aOffset*(1.-uFocus),(21./19.)-40./(19.*d));
 bool edge=length(aNormal)<.1;
 vec3 n=vec3(aNormal.x*cy+aNormal.z*sy,aNormal.y,-aNormal.x*sy+aNormal.z*cy);
 n=vec3(n.x,n.y*cp-n.z*sp,n.y*sp+n.z*cp);
 float facing=edge?1.:abs(n.z);
 float depth=clamp(.48+p.z*.17,.12,1.);
 float ink=mix(.85,(edge?1.:.66+.34*facing)*clamp(depth+.2,0.,1.),uFocus);
 float alpha=aIndex<uCount?mix(uDefocusAlpha,1.,uFocus):0.;float size=7./d;
 if((uPhase==1.&&uProgress>=1.)||(uPhase==2.&&uProgress<=0.)){target=aCloud;ink=.85;alpha=uCloudAlpha;size=1.;}
 else if(uPhase==1.){target=mix(aFrom.xyz,aCloud,uProgress);vec2 delta=aCloud.xy-aFrom.xy;target.xy+=vec2(-delta.y,delta.x)*sin(uProgress*3.14159265)*uCurl;ink=mix(aFrom.w,.85,uProgress);alpha=mix(aStyle.x,uCloudAlpha,uProgress);size=mix(aStyle.y,1.,uProgress);}
 else if(uPhase==2.&&uProgress<1.){vec2 delta=target.xy-aCloud.xy;target=mix(aCloud,target,uProgress);target.xy+=vec2(-delta.y,delta.x)*sin(uProgress*3.14159265)*uCurl;ink=mix(.85,ink,uProgress);alpha=mix(uCloudAlpha,alpha,uProgress);size=mix(1.,size,uProgress);}
 gl_Position=vec4(target.x*uZoom/uAspect,target.y*uZoom,target.z,1.);
 vec2 edgeFade=1.-smoothstep(vec2(uEdgeFade),vec2(1.),abs(gl_Position.xy));
 vInk=ink;vReveal=uReveal*alpha*edgeFade.x*edgeFade.y;gl_PointSize=clamp(uPoint*uDpr*size,1.,7.);
}`;
const fragment=`precision mediump float;varying float vInk;varying float vReveal;void main(){
 float radius=length(gl_PointCoord-.5);if(radius>.48||vReveal<=0.)discard;
 gl_FragColor=vec4(vec3(vInk),vReveal);
}`;
const mix=(a,b,t)=>t<=0?a:t>=1?b:a+(b-a)*t;
const clamp=(v,lo,hi)=>Math.max(lo,Math.min(hi,v));
function randomStream(){let seed=crypto.getRandomValues(new Uint32Array(1))[0]||1;return()=>{seed^=seed<<13;seed^=seed>>>17;seed^=seed<<5;return(seed>>>0)/4294967296;};}
export function createEntityRenderer(canvas,{fallback}={}){
 const gl=canvas.getContext('webgl',{alpha:true,antialias:false,powerPreference:'low-power',preserveDrawingBuffer:true});
 const ctx=gl?null:canvas.getContext('2d');
 const capacity=ENTITY.transitionPoints,indices=Float32Array.from({length:capacity},(_,i)=>i);
 let model,program,uniforms,buffers={},width=1,height=1,dpr=1,fit=1,disposed=false,lost=false,drawCalls=0,generation=0,captureGeneration=0,fitPose=null,lastFrame=null,transitionCurl=0;
 let offsets=new Float32Array(capacity*2),from=new Float32Array(capacity*6),cloud=new Float32Array(capacity*3);
 function bind(name,data,layout,stride){
  if(!gl||lost)return;const buffer=buffers[name]??=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,data,gl.STATIC_DRAW);
  for(const [attribute,size,offset] of layout){const at=gl.getAttribLocation(program,attribute);if(at<0)continue;gl.enableVertexAttribArray(at);gl.vertexAttribPointer(at,size,gl.FLOAT,false,stride*4,offset*4);}
 }
 function initialize(){
  if(!gl)return;
  const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;};
  const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);
  program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('点云渲染器初始化失败');
  gl.deleteShader(vs);gl.deleteShader(fs);gl.useProgram(program);buffers={};
  uniforms=Object.fromEntries(['uAngle','uZoom','uAspect','uPoint','uDpr','uReveal','uFocus','uFit','uCount','uPhase','uProgress','uCloudAlpha','uDefocusAlpha','uEdgeFade','uCurl'].map(name=>[name,gl.getUniformLocation(program,name)]));
  bind('index',indices,[['aIndex',1,0]],1);uploadTransition();
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
 }
 function upload(){if(!model)return;const points=new Float32Array(capacity*7);
  for(let offset=0;offset<points.length;offset+=model.points.length)points.set(model.points.subarray(0,Math.min(model.points.length,points.length-offset)),offset);
  bind('model',points,[['aPosition',3,0],['aNormal',3,3]],7);bind('offset',offsets,[['aOffset',2,0]],2);
 }
 function uploadTransition(){bind('from',from,[['aFrom',4,0],['aStyle',2,4]],6);bind('cloud',cloud,[['aCloud',3,0]],3);}
 function calculateFit(){
  if(!model)return;const info=fitPose||ENTITY_MODELS[model.kind];let x=0,y=0;
  for(let i=0;i<model.points.length;i+=7){const p=rotatePoint(model.points[i],model.points[i+1],model.points[i+2],info.yaw,info.pitch),k=1.025*height/(7-p[2]);x=Math.max(x,Math.abs(p[0]*k));y=Math.max(y,Math.abs(p[1]*k));}
  fit=Math.min(width*.44/Math.max(1,x),height*.42/Math.max(1,y));
 }
 async function setModel(kind,{isCurrent=()=>true}={}){
  const ticket=++generation;canvas.dataset.loading='true';const next=await buildEntityModel(kind);if(disposed||ticket!==generation||!isCurrent())return null;
  if(next.count>capacity)throw Error('模型点数超过连续过渡容量');
  model=next;fitPose=null;const random=randomStream();
  // One field per installed model: dragging focus is stable, but new models do not reuse a preset cloud.
  for(let i=0;i<offsets.length;i+=2){const angle=random()*Math.PI*2,radius=Math.sqrt(random())*ENTITY.focusSpread;offsets[i]=Math.cos(angle)*radius;offsets[i+1]=Math.sin(angle)*radius;}
  upload();calculateFit();canvas.dataset.loading='false';canvas.dataset.model=kind;canvas.dataset.pointCount=String(model.count);return model;
 }
 function resize(w,h){width=Math.max(1,w);height=Math.max(1,h);dpr=Math.min(devicePixelRatio||1,ENTITY.maxDpr);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);if(gl&&!lost)gl.viewport(0,0,canvas.width,canvas.height);calculateFit();}
 function pose(frame){return {...frame,fit,cy:Math.cos(frame.yaw),sy:Math.sin(frame.yaw),cp:Math.cos(frame.pitch),sp:Math.sin(frame.pitch)};}
 // Mirrors projected shader coordinates for interruption snapshots and the 2D fallback.
 // Called once per switch on WebGL, never on its animation frames.
 function sample(index,f,out){
  const i=(index%model.count)*7,points=model.points,x=points[i]*f.cy+points[i+2]*f.sy,z=-points[i]*f.sy+points[i+2]*f.cy,y=points[i+1]*f.cp-z*f.sp,depth=points[i+1]*f.sp+z*f.cp,d=7-depth;
  out[0]=x*2.05*f.fit/d+offsets[index*2]*(1-f.focus);out[1]=y*2.05*f.fit/d+offsets[index*2+1]*(1-f.focus);out[2]=21/19-40/(19*d);
  const nx=points[i+3],ny=points[i+4],nz=points[i+5],edge=nx*nx+ny*ny+nz*nz<.01,facing=edge?1:Math.abs(ny*f.sp+(-nx*f.sy+nz*f.cy)*f.cp);
  out[3]=mix(.85,(edge?1:.66+.34*facing)*clamp(clamp(.48+depth*.17,.12,1)+.2,0,1),f.focus);out[4]=index<model.count?mix(ENTITY.defocusAlpha,1,f.focus):0;out[5]=7/d;
  const a=index*6,c=index*3,t=f.progress;
  const curve=t>0&&t<1?Math.sin(t*Math.PI)*transitionCurl:0,dx=f.phase==='scatter'?cloud[c]-from[a]:out[0]-cloud[c],dy=f.phase==='scatter'?cloud[c+1]-from[a+1]:out[1]-cloud[c+1];
  if(f.phase==='scatter'){for(let k=0;k<3;k++)out[k]=mix(from[a+k],cloud[c+k],t);out[3]=mix(from[a+3],.85,t);out[4]=mix(from[a+4],ENTITY.cloudAlpha,t);out[5]=mix(from[a+5],1,t);}
  else if(f.phase==='assemble'){for(let k=0;k<3;k++)out[k]=mix(cloud[c+k],out[k],t);out[3]=mix(.85,out[3],t);out[4]=mix(ENTITY.cloudAlpha,out[4],t);out[5]=mix(1,out[5],t);}
  if(f.phase==='scatter'||f.phase==='assemble'){out[0]-=dy*curve;out[1]+=dx*curve;}
  return out;
 }
 async function beginTransition(camera,{isCurrent=()=>true}={}){
  if(!model)return false;
  const ticket=++captureGeneration;
  const f=pose(lastFrame||{...camera,phase:'idle',progress:0}),nextFrom=new Float32Array(capacity*6),nextCloud=new Float32Array(capacity*3),random=randomStream(),point=new Float64Array(6);
  const angleField=random()*Math.PI*2,cx=Math.cos(angleField),sx=Math.sin(angleField),stretch=1+(random()*2-1)*ENTITY.scatterStretch,flow=ENTITY.scatterFlow*(random()*2-1),curl=ENTITY.scatterCurl*(random()*2-1);
  for(let index=0;index<capacity;index++){
   if(index%ENTITY.snapshotBatch===0){
    if(disposed||ticket!==captureGeneration||!isCurrent())return false;
    if(index){if(globalThis.scheduler?.yield)await globalThis.scheduler.yield();else await new Promise(resolve=>setTimeout(resolve,0));}
   }
   sample(index,f,point);nextFrom.set(point,index*6);
   // Start at each particle's actual position. Fresh outward motion has no common convergence centre.
   const angle=random()*Math.PI*2,radius=ENTITY.switchSpread*(.35+.65*Math.sqrt(random())),c=index*3;
   const dx=Math.cos(angle)*radius*stretch,dy=Math.sin(angle)*radius/stretch;
   nextCloud[c]=point[0]*(1+ENTITY.outwardDrift)+dx*cx-dy*sx+flow*cx;
   nextCloud[c+1]=point[1]*(1+ENTITY.outwardDrift)+dx*sx+dy*cx+flow*sx;
   nextCloud[c+2]=clamp(point[2]+(random()-.5)*ENTITY.scatterDepth,-.95,.99);
  }
  if(disposed||ticket!==captureGeneration||!isCurrent())return false;
  from=nextFrom;cloud=nextCloud;transitionCurl=curl;uploadTransition();lastFrame={...camera,phase:'scatter',progress:0};return true;
 }
 function draw({yaw,pitch,zoom,pointSize,reveal=1,focus=ENTITY.defaultFocus,phase='idle',progress=0}){
  if(disposed||lost||!model)return;
  lastFrame={yaw,pitch,zoom,pointSize,reveal,focus,phase,progress};
  if(gl){
   gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
   gl.uniform2f(uniforms.uAngle,yaw,pitch);
   for(const [key,value] of Object.entries({uZoom:zoom,uAspect:width/height,uPoint:pointSize,uDpr:dpr,uReveal:reveal,uFocus:focus,uFit:fit,uCount:model.count,uPhase:phase==='scatter'?1:phase==='assemble'?2:0,uProgress:progress,uCloudAlpha:ENTITY.cloudAlpha,uDefocusAlpha:ENTITY.defocusAlpha,uEdgeFade:ENTITY.edgeFadeStart,uCurl:transitionCurl}))gl.uniform1f(uniforms[key],value);
   gl.drawArrays(gl.POINTS,0,phase==='idle'?model.count:capacity);
  }else if(ctx){
   ctx.clearRect(0,0,canvas.width,canvas.height);const stride=Math.max(1,Math.ceil(capacity/ENTITY.fallbackPoints)),f=pose(lastFrame),point=new Float64Array(6);
   for(let index=0;index<capacity;index+=stride){sample(index,f,point);if(point[4]<=0)continue;const fade=value=>{const t=clamp((Math.abs(value)-ENTITY.edgeFadeStart)/(1-ENTITY.edgeFadeStart),0,1);return 1-t*t*(3-2*t);};const edge=fade(point[0]*zoom/(width/height))*fade(point[1]*zoom),ink=Math.round(point[3]*255);ctx.fillStyle=`rgba(${ink},${ink},${ink},${point[4]*reveal*edge})`;const size=clamp(pointSize*dpr*point[5],1,7);ctx.fillRect(canvas.width/2+point[0]*height*zoom*dpr/2,canvas.height/2-point[1]*height*zoom*dpr/2,size,size);}
  }
  canvas.dataset.drawCalls=String(++drawCalls);canvas.dataset.focus=String(focus);canvas.dataset.transitionProgress=String(progress);
 }
 const onLost=event=>{event.preventDefault();lost=true;fallback?.('显卡上下文暂时中断，正在等待恢复。');};
 const onRestored=()=>{lost=false;initialize();upload();resize(width,height);canvas.dispatchEvent(new Event('entity-renderer-restored'));fallback?.('');};
 canvas.addEventListener('webglcontextlost',onLost);canvas.addEventListener('webglcontextrestored',onRestored);initialize();
 function dispose(){disposed=true;generation++;canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestored);if(gl){for(const buffer of Object.values(buffers))gl.deleteBuffer(buffer);gl.deleteProgram(program);}}
 return {setModel,beginTransition,resize,draw,dispose,framePose(yaw,pitch){fitPose={yaw,pitch};calculateFit();},get gpu(){return Boolean(gl);}};
}
