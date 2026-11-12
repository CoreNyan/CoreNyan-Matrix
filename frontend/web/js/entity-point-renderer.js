import {ENTITY,ENTITY_MODELS} from './constants.js';
import {buildEntityModel,rotatePoint} from './entity-assets.js';
const vertex=`attribute vec3 aPosition;attribute vec3 aNormal;attribute float aInk;
uniform vec2 uAngle;uniform float uZoom;uniform float uAspect;uniform float uPoint;uniform float uDpr;uniform float uReveal;uniform float uFocus;uniform float uScatter;
varying float vInk;varying float vReveal;
void main(){
 float cy=cos(uAngle.x),sy=sin(uAngle.x),cp=cos(uAngle.y),sp=sin(uAngle.y);
 vec3 seed=vec3(dot(aPosition,vec3(12.9898,78.233,37.719)),dot(aPosition,vec3(39.3468,11.135,83.155)),dot(aPosition,vec3(73.156,52.235,9.151)));
 vec3 direction=fract(sin(seed)*43758.5453)*2.-1.;
 float radius=pow(fract(sin(dot(aPosition,vec3(93.231,47.137,23.731)))*43758.5453),.333333);
 vec3 cloud=direction/max(length(direction),.0001)*radius*uScatter;
 vec3 source=mix(cloud,aPosition,uFocus);
 vec3 p=vec3(source.x*cy+source.z*sy,source.y,-source.x*sy+source.z*cy);
 p=vec3(p.x,p.y*cp-p.z*sp,p.y*sp+p.z*cp);
 float d=7.-p.z;
 gl_Position=vec4(p.x*2.05*uZoom/uAspect,p.y*2.05*uZoom,(21./19.)*d-40./19.,d);
 bool edge=length(aNormal)<.1;
 vec3 n=vec3(aNormal.x*cy+aNormal.z*sy,aNormal.y,-aNormal.x*sy+aNormal.z*cy);
 n=vec3(n.x,n.y*cp-n.z*sp,n.y*sp+n.z*cp);
 float facing=edge?1.:abs(n.z);
 float depth=clamp(.48+p.z*.17,.12,1.);
 vInk=(edge?1.:.66+.34*facing)*clamp(depth+.2,0.,1.);
 vReveal=uReveal;
 gl_PointSize=clamp(uPoint*uDpr*7./d,1.,7.);
}`;
const fragment=`precision mediump float;varying float vInk;varying float vReveal;void main(){
 float radius=length(gl_PointCoord-.5);if(radius>.48)discard;
 gl_FragColor=vec4(vec3(vInk),vReveal);
}`;
export function createEntityRenderer(canvas,{fallback}={}){
 const gl=canvas.getContext('webgl',{alpha:true,antialias:false,powerPreference:'low-power',preserveDrawingBuffer:true});
 const ctx=gl?null:canvas.getContext('2d');
 let model,program,buffer,uniforms,attributes,width=1,height=1,dpr=1,fit=1,disposed=false,lost=false,drawCalls=0,generation=0,fitPose=null;
 function initialize(){
  if(!gl)return;
  const compile=(type,source)=>{const shader=gl.createShader(type);gl.shaderSource(shader,source);gl.compileShader(shader);if(!gl.getShaderParameter(shader,gl.COMPILE_STATUS))throw Error(gl.getShaderInfoLog(shader));return shader;};
  const vs=compile(gl.VERTEX_SHADER,vertex),fs=compile(gl.FRAGMENT_SHADER,fragment);
  program=gl.createProgram();gl.attachShader(program,vs);gl.attachShader(program,fs);gl.linkProgram(program);
  if(!gl.getProgramParameter(program,gl.LINK_STATUS))throw Error('点云渲染器初始化失败');
  gl.deleteShader(vs);gl.deleteShader(fs);buffer=gl.createBuffer();gl.useProgram(program);
  uniforms=Object.fromEntries(['uAngle','uZoom','uAspect','uPoint','uDpr','uReveal','uFocus','uScatter'].map(name=>[name,gl.getUniformLocation(program,name)]));
  attributes=[['aPosition',3,0],['aNormal',3,12],['aInk',1,24]].map(([name,size,offset])=>({at:gl.getAttribLocation(program,name),size,offset})).filter(a=>a.at>=0);
  gl.enable(gl.DEPTH_TEST);gl.depthFunc(gl.LEQUAL);gl.enable(gl.BLEND);gl.blendFunc(gl.SRC_ALPHA,gl.ONE_MINUS_SRC_ALPHA);
 }
 function upload(){if(!gl||!model||lost)return;gl.bindBuffer(gl.ARRAY_BUFFER,buffer);gl.bufferData(gl.ARRAY_BUFFER,model.points,gl.STATIC_DRAW);for(const a of attributes){gl.enableVertexAttribArray(a.at);gl.vertexAttribPointer(a.at,a.size,gl.FLOAT,false,28,a.offset);}}
 function calculateFit(){
  if(!model)return;const info=fitPose||ENTITY_MODELS[model.kind];let x=0,y=0;
  for(let i=0;i<model.points.length;i+=7){const p=rotatePoint(model.points[i],model.points[i+1],model.points[i+2],info.yaw,info.pitch),k=1.025*height/(7-p[2]);x=Math.max(x,Math.abs(p[0]*k));y=Math.max(y,Math.abs(p[1]*k));}
  fit=Math.min(width*.44/Math.max(1,x),height*.42/Math.max(1,y));
 }
 async function setModel(kind,{isCurrent=()=>true}={}){
  const ticket=++generation;canvas.dataset.loading='true';const next=await buildEntityModel(kind);if(disposed||ticket!==generation||!isCurrent())return null;
  model=next;fitPose=null;upload();calculateFit();canvas.dataset.loading='false';canvas.dataset.model=kind;canvas.dataset.pointCount=String(model.count);return model;
 }
 function resize(w,h){width=Math.max(1,w);height=Math.max(1,h);dpr=Math.min(devicePixelRatio||1,ENTITY.maxDpr);canvas.width=Math.round(width*dpr);canvas.height=Math.round(height*dpr);if(gl&&!lost)gl.viewport(0,0,canvas.width,canvas.height);calculateFit();}
 function draw({yaw,pitch,zoom,pointSize,reveal=1,focus=ENTITY.defaultFocus}){
  if(disposed||lost||!model)return;
  if(gl){
   gl.viewport(0,0,canvas.width,canvas.height);gl.clearColor(0,0,0,0);gl.clear(gl.COLOR_BUFFER_BIT|gl.DEPTH_BUFFER_BIT);gl.useProgram(program);
   gl.uniform2f(uniforms.uAngle,yaw,pitch);gl.uniform1f(uniforms.uZoom,zoom*fit);gl.uniform1f(uniforms.uAspect,width/height);
   gl.uniform1f(uniforms.uPoint,pointSize);gl.uniform1f(uniforms.uDpr,dpr);gl.uniform1f(uniforms.uReveal,reveal);gl.uniform1f(uniforms.uFocus,focus);gl.uniform1f(uniforms.uScatter,ENTITY.scatterRadius);
   gl.drawArrays(gl.POINTS,0,model.count);
  }else if(ctx){
   ctx.clearRect(0,0,canvas.width,canvas.height);
   const stride=Math.max(1,Math.ceil(model.count/ENTITY.fallbackPoints))*7;
   for(let i=0;i<model.points.length;i+=stride){const x=model.points[i],y=model.points[i+1],z=model.points[i+2],noise=(a,b,c)=>{const n=Math.sin(x*a+y*b+z*c)*43758.5453;return n-Math.floor(n);},dx=noise(12.9898,78.233,37.719)*2-1,dy=noise(39.3468,11.135,83.155)*2-1,dz=noise(73.156,52.235,9.151)*2-1,r=Math.cbrt(noise(93.231,47.137,23.731))*ENTITY.scatterRadius*(1-focus)/Math.max(.0001,Math.hypot(dx,dy,dz)),p=rotatePoint(x*focus+dx*r,y*focus+dy*r,z*focus+dz*r,yaw,pitch),k=height*1.025*zoom*fit/(7-p[2])*dpr;ctx.fillStyle='rgba(255,255,255,'+reveal*.75+')';ctx.fillRect(canvas.width/2+p[0]*k,canvas.height/2-p[1]*k,pointSize*dpr,pointSize*dpr);}
  }
  canvas.dataset.drawCalls=String(++drawCalls);canvas.dataset.focus=String(focus);
 }
 const onLost=event=>{event.preventDefault();lost=true;fallback?.('显卡上下文暂时中断，正在等待恢复。');};
 const onRestored=()=>{lost=false;initialize();upload();resize(width,height);canvas.dispatchEvent(new Event('entity-renderer-restored'));fallback?.('');};
 canvas.addEventListener('webglcontextlost',onLost);canvas.addEventListener('webglcontextrestored',onRestored);initialize();
 function dispose(){disposed=true;generation++;canvas.removeEventListener('webglcontextlost',onLost);canvas.removeEventListener('webglcontextrestored',onRestored);if(gl){gl.deleteBuffer(buffer);gl.deleteProgram(program);}}
 return {setModel,resize,draw,dispose,framePose(yaw,pitch){fitPose={yaw,pitch};calculateFit();},get gpu(){return Boolean(gl);}};
}
