import {ENTITY,ENTITY_MODELS} from './constants.js';
import {buildEntityModel,rotatePoint} from './entity-assets.js';
const vertex=`attribute vec3 aPosition;attribute vec3 aNormal;attribute float aIndex;
uniform vec2 uAngle;uniform float uZoom;uniform float uAspect;uniform float uPoint;uniform float uDpr;uniform float uReveal;uniform float uFocus;uniform float uScatter;uniform float uFit;uniform float uScatterFit;uniform float uCount;
varying float vInk;varying float vReveal;
void main(){
 float cy=cos(uAngle.x),sy=sin(uAngle.x),cp=cos(uAngle.y),sp=sin(uAngle.y);
 // Particle identity survives model changes. The cloud uses view-space
 // coordinates, so model framing, normals and camera pose cannot move it.
 vec3 seed=vec3(aIndex+1.,aIndex+17.,aIndex+47.);
 vec3 direction=fract(sin(seed*vec3(12.9898,39.3468,73.156))*43758.5453)*2.-1.;
 float radius=pow(fract(sin((aIndex+101.)*93.231)*43758.5453),.333333);
 vec3 cloud=direction/max(length(direction),.0001)*radius*uScatter;
 vec3 p=vec3(aPosition.x*cy+aPosition.z*sy,aPosition.y,-aPosition.x*sy+aPosition.z*cy);
 p=vec3(p.x,p.y*cp-p.z*sp,p.y*sp+p.z*cp);
 p=mix(cloud,p,uFocus);
 float framing=mix(uScatterFit,uFit,uFocus);
 float d=7.-p.z;
 gl_Position=vec4(p.x*2.05*uZoom*framing/uAspect,p.y*2.05*uZoom*framing,(21./19.)*d-40./19.,d);
 bool edge=length(aNormal)<.1;
 vec3 n=vec3(aNormal.x*cy+aNormal.z*sy,aNormal.y,-aNormal.x*sy+aNormal.z*cy);
 n=vec3(n.x,n.y*cp-n.z*sp,n.y*sp+n.z*cp);
 float facing=edge?1.:abs(n.z);
 float depth=clamp(.48+p.z*.17,.12,1.);
 vInk=mix(.85,(edge?1.:.66+.34*facing)*clamp(depth+.2,0.,1.),uFocus);
 vReveal=uReveal*(aIndex<uCount?1.:1.-uFocus);
 gl_PointSize=clamp(uPoint*uDpr*7./d,1.,7.);
}`;
const fragment=`precision mediump float;varying float vInk;varying float vReveal;void main(){
 float radius=length(gl_PointCoord-.5);if(radius>.48||vReveal<=0.)discard;
 gl_FragColor=vec4(vec3(vInk),vReveal);
}`;
export function createEntityRenderer(canvas,{fallback}={}){
 const gl=canvas.getContext('webgl',{alpha:true,antialias:false,powerPreference:'low-power',preserveDrawingBuffer:true});
 const ctx=gl?null:canvas.getContext('2d');
 let model,program,buffer,indexBuffer,uniforms,attributes,width=1,height=1,dpr=1,fit=1,disposed=false,lost=false,drawCalls=0,generation=0,fitPose=null;
 function initialize(){
  if(!gl)return;
  const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;};
  const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);
  program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('点云渲染器初始化失败');
  gl.deleteShader(vs);gl.deleteShader(fs);buffer=gl.createBuffer();gl.useProgram(program);
  uniforms=Object.fromEntries(['uAngle','uZoom','uAspect','uPoint','uDpr','uReveal','uFocus','uScatter','uFit','uScatterFit','uCount'].map(name=>[name,gl.getUniformLocation(program,name)]));
  attributes=[['aPosition',3,0],['aNormal',3,12]].map(([name,size,offset])=>({at:gl.getAttribLocation(program,name),size,offset})).filter(a=>a.at>=0);
  indexBuffer=gl.createBuffer();gl.bindBuffer(gl.ARRAY_BUFFER,indexBuffer);
  gl.bufferData(gl.ARRAY_BUFFER,Float32Array.from({length:ENTITY.transitionPoints},(_,i)=>i),gl.STATIC_DRAW);
  const index=gl.getAttribLocation(program,'aIndex');gl.enableVertexAttribArray(index);gl.vertexAttribPointer(index,1,gl.FLOAT,false,4,0);
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
 }
 function upload(){if(!gl||!model||lost)return;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);const points=new Float32Array(ENTITY.transitionPoints*7);
  for(let offset=0;offset<points.length;offset+=model.points.length)points.set(model.points.subarray(0,Math.min(model.points.length,points.length-offset)),offset);
  gl.bufferData(gl.ARRAY_BUFFER,points,gl.STATIC_DRAW);for(const a of attributes){gl.enableVertexAttribArray(a.at);gl.vertexAttribPointer(a.at,a.size,gl.FLOAT,false,28,a.offset);}}
 function calculateFit(){
  if(!model)return;const info=fitPose||ENTITY_MODELS[model.kind];let x=0,y=0;
  for(let i=0;i<model.points.length;i+=7){const p=rotatePoint(model.points[i],model.points[i+1],model.points[i+2],info.yaw,info.pitch),k=1.025*height/(7-p[2]);x=Math.max(x,Math.abs(p[0]*k));y=Math.max(y,Math.abs(p[1]*k));}
  fit=Math.min(width*.44/Math.max(1,x),height*.42/Math.max(1,y));
 }
 async function setModel(kind,{isCurrent=()=>true}={}){
  const ticket=++generation;canvas.dataset.loading='true';const next=await buildEntityModel(kind);if(disposed||ticket!==generation||!isCurrent())return null;
  if(next.count>ENTITY.transitionPoints)throw Error('模型点数超过连续过渡容量');
  model=next;fitPose=null;upload();calculateFit();canvas.dataset.loading='false';canvas.dataset.model=kind;canvas.dataset.pointCount=String(model.count);return model;
 }
 function resize(w,h){width=Math.max(1,w);height=Math.max(1,h);dpr=Math.min(devicePixelRatio||1,ENTITY.maxDpr);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);if(gl&&!lost)gl.viewport(0,0,canvas.width,canvas.height);calculateFit();}
 function draw({yaw,pitch,zoom,pointSize,reveal=1,focus=ENTITY.defaultFocus}){
  if(disposed||lost||!model)return;
  if(gl){
   gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
   gl.uniform2f(uniforms.uAngle,yaw,pitch);gl.uniform1f(uniforms.uZoom,zoom);gl.uniform1f(uniforms.uAspect,width/height);
   gl.uniform1f(uniforms.uPoint,pointSize);gl.uniform1f(uniforms.uDpr,dpr);gl.uniform1f(uniforms.uReveal,reveal);gl.uniform1f(uniforms.uFocus,focus);gl.uniform1f(uniforms.uScatter,ENTITY.scatterRadius);gl.uniform1f(uniforms.uFit,fit);gl.uniform1f(uniforms.uScatterFit,ENTITY.scatterFit);gl.uniform1f(uniforms.uCount,model.count);
   gl.drawArrays(gl.POINTS,0,focus===1?model.count:ENTITY.transitionPoints);
  }else if(ctx){
   ctx.clearRect(0,0,canvas.width,canvas.height);
   const stride=Math.max(1,Math.ceil(ENTITY.transitionPoints/ENTITY.fallbackPoints));
   const framing=ENTITY.scatterFit*(1-focus)+fit*focus;
   for(let index=0;index<ENTITY.transitionPoints;index+=stride){
    const opacity=reveal*.85*(index<model.count?1:1-focus);if(opacity<=0)continue;
    const i=(index%model.count)*7,p=rotatePoint(model.points[i],model.points[i+1],model.points[i+2],yaw,pitch);
    const noise=(n,f)=>{const value=Math.sin(n*f)*43758.5453;return value-Math.floor(value);};
    const dx=noise(index+1,12.9898)*2-1,dy=noise(index+17,39.3468)*2-1,dz=noise(index+47,73.156)*2-1;
    const radius=Math.cbrt(noise(index+101,93.231))*ENTITY.scatterRadius*(1-focus)/Math.max(.0001,Math.hypot(dx,dy,dz));
    p[0]=p[0]*focus+dx*radius;p[1]=p[1]*focus+dy*radius;p[2]=p[2]*focus+dz*radius;
    const k=height*1.025*zoom*framing/(7-p[2])*dpr;ctx.fillStyle='rgba(255,255,255,'+opacity+')';ctx.fillRect(canvas.width/2+p[0]*k,canvas.height/2-p[1]*k,pointSize*dpr,pointSize*dpr);
   }
  }
  canvas.dataset.drawCalls=String(++drawCalls);canvas.dataset.focus=String(focus);
 }
 const onLost=event=>{event.preventDefault();lost=true;fallback?.('显卡上下文暂时中断，正在等待恢复。');};
 const onRestored=()=>{lost=false;initialize();upload();resize(width,height);canvas.dispatchEvent(new Event('entity-renderer-restored'));fallback?.('');};
 canvas.addEventListener('webglcontextlost',onLost);canvas.addEventListener('webglcontextrestored',onRestored);initialize();
 function dispose(){disposed=true;generation++;canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestored);if(gl){gl.deleteBuffer(buffer);gl.deleteBuffer(indexBuffer);gl.deleteProgram(program);}}
 return {setModel,resize,draw,dispose,framePose(yaw,pitch){fitPose={yaw,pitch};calculateFit();},get gpu(){return Boolean(gl);}};
}
