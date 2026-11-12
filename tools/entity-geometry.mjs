// Offline geometry authoring. No geometry generation runs on the browser thread.
import {ENTITY,ENTITY_MODELS,ENTITY_FLEET,ENTITY_COMMAND} from '../frontend/web/js/constants.js';
const TAU=Math.PI*2,add=(a,b)=>a.map((v,i)=>v+b[i]),sub=(a,b)=>a.map((v,i)=>v-b[i]),mul=(a,k)=>a.map(v=>v*k);
const dot=(a,b)=>a.reduce((s,v,i)=>s+v*b[i],0),cross=(a,b)=>[a[1]*b[2]-a[2]*b[1],a[2]*b[0]-a[0]*b[2],a[0]*b[1]-a[1]*b[0]];
const unit=a=>mul(a,1/Math.max(1e-9,Math.hypot(...a)));
class Yard {
 constructor(){this.faces=[];this.edges=[];this.panelIndex=0;}
 tri(a,b,c,ink=.8){const n=cross(sub(b,a),sub(c,a)),area=Math.hypot(...n)/2;if(area>1e-8)this.faces.push({a,b,c,n:unit(n),area,ink});}
 quad(a,b,c,d,ink=.8){this.tri(a,b,c,ink);this.tri(a,c,d,ink);}
 line(a,b,ink=1){this.edges.push({a,b,ink});}
 box(c,size,ink=.75){
  const [x,y,z]=size.map(v=>v/2),v=[[-x,-y,-z],[x,-y,-z],[x,y,-z],[-x,y,-z],[-x,-y,z],[x,-y,z],[x,y,z],[-x,y,z]].map(p=>add(p,c));
  for(const f of [[0,3,2,1],[4,5,6,7],[0,1,5,4],[3,7,6,2],[0,4,7,3],[1,2,6,5]]){this.quad(...f.map(i=>v[i]),ink);for(let i=0;i<4;i++)this.line(v[f[i]],v[f[(i+1)%4]],.9);}
 }
 // Inset, extruded armor plates are geometry: seams are actual gaps with recessed machinery.
 panel(a,b,c,d,ink=.8){
  const width=(Math.hypot(...sub(b,a))+Math.hypot(...sub(c,d)))/2;
  const height=(Math.hypot(...sub(d,a))+Math.hypot(...sub(c,b)))/2;
  if(width*height<.055){this.quad(a,b,c,d,ink);return;}
  const normal=unit(cross(sub(b,a),sub(d,a)));
  const cols=Math.max(1,Math.ceil(width/.22)),rows=Math.max(1,Math.ceil(height/.32));
  const at=(u,v,depth=0)=>add(add(mul(a,(1-u)*(1-v)),add(mul(b,u*(1-v)),add(mul(c,u*v),mul(d,(1-u)*v)))),mul(normal,depth));
  for(let i=0;i<cols;i++)for(let j=0;j<rows;j++){
   const serial=this.panelIndex++,inset=.045,u0=(i+inset)/cols,u1=(i+1-inset)/cols,v0=(j+inset)/rows,v1=(j+1-inset)/rows;
   const raised=.008+(serial%4)*.006;
   const p=[at(u0,v0,raised),at(u1,v0,raised),at(u1,v1,raised),at(u0,v1,raised)];
   const base=[at(u0,v0),at(u1,v0),at(u1,v1),at(u0,v1)];
   if(serial%13===0&&width/cols>.12&&height/rows>.15){
    // An open equipment well with visible cross-bracing inside.
    const center=at((u0+u1)/2,(v0+v1)/2,-.025);
    for(let k=0;k<4;k++){this.line(p[k],p[(k+1)%4]);this.beam(p[k],center,.007);}
    this.pipe(at((u0+u1)/2,v0,-.02),at((u0+u1)/2,v1,-.02),.016,.016,.7,8);
   }else{
    this.quad(...p,ink);
    for(let k=0;k<4;k++){this.quad(base[k],p[k],p[(k+1)%4],base[(k+1)%4],.5);if(serial%3===0)this.line(p[k],p[(k+1)%4],.9);}
    if(serial%7===0)this.line(at(u0+(u1-u0)*.18,v0+(v1-v0)*.18,raised+.006),at(u1-(u1-u0)*.18,v0+(v1-v0)*.18,raised+.006),1);
   }
  }
 }
 dome(c,r,h,axis='y'){
  for(let j=0;j<7;j++){const a=j*Math.PI/14,b=(j+1)*Math.PI/14;
   const point=(t,v)=>{const p=[Math.cos(t)*Math.cos(v)*r,Math.sin(v)*h,Math.sin(t)*Math.cos(v)*r];return add(c,axis==='z'?[p[0],p[2],p[1]]:p);};
   for(let i=0;i<20;i++){const t=i*TAU/20,t2=(i+1)*TAU/20;this.quad(point(t,a),point(t2,a),point(t2,b),point(t,b),.8);}
  }
 }
 manifold(c,l=.6,axis='z'){
  for(let i=0;i<3;i++){
   const offset=(i-1)*.08,a=add(c,axis==='y'?[offset,-l/2,0]:[offset,0,-l/2]),b=add(c,axis==='y'?[offset,l/2,0]:[offset,0,l/2]);
   this.pipe(a,b,.018,.018,.8,8);
   for(let j=0;j<4;j++)this.ring(add(c,axis==='y'?[offset,-l/2+j*l/3,0]:[offset,0,-l/2+j*l/3]),.024,.008,axis);
  }
 }

 // Variable octagonal cross-sections create stepped armor, chamfered hulls and real recesses.
 hull(sections,{axis='z',center=[0,0,0],ink=.8,caps=true}={}){
  const map=([x,y,z])=>add(axis==='y'?[x,z,y]:axis==='x'?[z,y,x]:[x,y,z],center);
  const rings=sections.map(([z,w,h,shift=0,shiftX=0])=>[[-w*.34,-h*.5], [w*.34,-h*.5],[w*.5,-h*.28],[w*.5,h*.28],[w*.34,h*.5],[-w*.34,h*.5],[-w*.5,h*.28],[-w*.5,-h*.28]].map(([x,y])=>map([x+shiftX,y+shift,z])));
  for(let k=0;k<rings.length-1;k++)for(let i=0;i<8;i++){const j=(i+1)%8;this.panel(rings[k][i],rings[k+1][i],rings[k+1][j],rings[k][j],ink);this.line(rings[k][i],rings[k+1][i]);this.line(rings[k][i],rings[k][j]);}
  if(caps)for(const k of [0,rings.length-1]){const middle=mul(rings[k].reduce(add,[0,0,0]),1/8);for(let i=0;i<8;i++)this.tri(middle,rings[k][i],rings[k][(i+1)%8],ink);}
 }
 pipe(a,b,r=.08,r2=r,ink=.8,segments=16){
  const d=unit(sub(b,a)),u=unit(cross(d,Math.abs(d[1])>.9?[1,0,0]:[0,1,0])),v=cross(d,u);
  const p=(c,rad,t)=>add(c,add(mul(u,rad*Math.cos(t)),mul(v,rad*Math.sin(t))));
  for(let i=0;i<segments;i++){const t=i*TAU/segments,t2=(i+1)*TAU/segments;this.quad(p(a,r,t),p(a,r,t2),p(b,r2,t2),p(b,r2,t),ink);}
 }
 ring(c,r,tube,axis='z',start=0,end=TAU){
  const map=([x,y,z])=>add(axis==='y'?[x,z,y]:axis==='x'?[z,y,x]:[x,y,z],c),rows=64,cols=8;
  const p=(a,b)=>map([(r+tube*Math.cos(b))*Math.cos(a),(r+tube*Math.cos(b))*Math.sin(a),tube*Math.sin(b)]);
  for(let i=0;i<rows;i++)for(let j=0;j<cols;j++){const a=start+(end-start)*i/rows,a2=start+(end-start)*(i+1)/rows,b=j*TAU/cols,b2=(j+1)*TAU/cols;this.quad(p(a,b),p(a2,b),p(a2,b2),p(a,b2),.85);}
 }
 beam(a,b,w=.04){this.pipe(a,b,w,w,.65,4);}
 truss(a,b,width=.24,steps=8){
  const d=unit(sub(b,a)),n=mul(unit(cross(d,Math.abs(d[1])>.9?[1,0,0]:[0,1,0])),width/2);
  this.beam(add(a,n),add(b,n),.025);this.beam(sub(a,n),sub(b,n),.025);
  for(let i=0;i<steps;i++){const p=add(a,mul(sub(b,a),i/steps)),q=add(a,mul(sub(b,a),(i+1)/steps));this.beam(add(p,mul(n,i%2?1:-1)),add(q,mul(n,i%2?-1:1)),.018);}
 }
 nozzle(c,r=.22){
  const [x,y,z]=c;
  this.pipe([x,y,z-.32],[x,y,z],r*.65,r,.8,24);
  this.pipe([x,y,z-.17],[x,y,z+.02],r*.55,r*.85,.65,24);
  this.ring([x,y,z],r,.025);this.ring([x,y,z-.32],r*.65,.018);
  for(let i=0;i<12;i++){const a=i*TAU/12;this.beam([x+Math.cos(a)*r*.66,y+Math.sin(a)*r*.66,z-.3],[x+Math.cos(a)*r,y+Math.sin(a)*r,z],.012);}
 }
 antenna(c,height=.7){
  // Short solid fairing replaces the thin mast/crossbars that appeared as detached dots.
  this.module(add(c,[0,.035,0]),.13,.07,.2);
 }
 radiator(c,w,l,rows=10){
  for(let i=0;i<rows;i++)this.box([c[0],c[1],c[2]-l/2+(i+.5)*l/rows],[w,.045,l/rows*.55],.6);
  this.line([c[0]-w/2,c[1],c[2]-l/2],[c[0]-w/2,c[1],c[2]+l/2]);
  this.line([c[0]+w/2,c[1],c[2]-l/2],[c[0]+w/2,c[1],c[2]+l/2]);
 }

 // Hollow rectangular portal, with a visible inner lip and back wall set well inside the hull.
 bay(c,width,height,depth,axis='x'){
  const along=axis==='x'?0:2,across=axis==='x'?2:0,at=(u,v,w)=>{const p=[...c];p[across]+=u;p[1]+=v;p[along]+=w;return p;};
  const b=(u,v,w,sizes)=>{const size=axis==='x'?[sizes[2],sizes[1],sizes[0]]:sizes;this.box(at(u,v,w),size,.7);};
  b(0,-height/2,0,[width,.07,depth]);b(0,height/2,0,[width,.07,depth]);
  for(const side of [-1,1])b(side*width/2,0,0,[.07,height,depth]);
  const inside=-depth*.38;
  b(0,0,inside,[width*.88,height*.78,.035]);
  for(const side of [-1,1]){
   this.beam(at(side*width*.45,-height*.4,depth*.48),at(side*width*.45,height*.4,depth*.48),.018);
   this.beam(at(side*width*.45,-height*.4,depth*.48),at(side*width*.32,-height*.25,inside),.016);
  }
  for(let i=0;i<4;i++)b(-width*.32+i*width*.21,-height*.35,depth*.1,[.045,.03,depth*.55]);
 }
 turbine(c,r,length){
  const [x,y,z]=c;
  this.pipe([x,y,z-length],[x,y,z-length*.65],r*.58,r*.84,.8,32);
  this.pipe([x,y,z-length*.65],[x,y,z],r*.84,r,.8,32);
  this.pipe([x,y,z-length*.2],[x,y,z+.015],r*.47,r*.83,.55,32);
  for(const t of [0,.32,.66,1])this.ring([x,y,z-length*t],r*(1-t*.4),.018);
  for(let i=0;i<16;i++){
   const a=i*TAU/16,p=(rad,dz)=>[x+Math.cos(a)*rad,y+Math.sin(a)*rad,z+dz];
   this.beam(p(r,-.025),p(r*.65,-length*.85),.014);
   this.beam(p(r*.55,-length*.23),p(r*.18,-length*.28),.012);
  }
  this.pipe([x,y,z-length*.25],[x,y,z-length*.45],r*.17,r*.24,.7,16);
 }
 rail(c,length,width=.15){
  for(const side of [-1,1]){
   this.box(add(c,[side*width,0,0]),[.035,.055,length]);
   for(let i=0;i<6;i++)this.box(add(c,[side*width,.055,-length*.4+i*length*.16]),[.07,.06,.045],.7);
  }
  this.box(add(c,[0,-.04,0]),[width*2,.025,length],.55);
 }

 module(c,w,h,l){
  this.hull([[-l/2,w*.7,h*.7],[-l*.35,w,h],[l*.35,w,h],[l/2,w*.7,h*.7]],{center:c});
 }
}

function command(s){
 const layout=ENTITY_COMMAND;
 // A long keel joins the split launch prow to a stepped command citadel and engine block.
 s.hull([[layout.prowTip,.04,.09],[-6.2,.3,.22],[-4.5,.55,.35],[-2.4,.7,.45],[1.4,.85,.55],[4.4,.82,.5],[layout.sternTip,.3,.25]],{center:[0,-.65,0]});
 s.hull([[-4.8,.12,.1],[-3.5,.4,.2],[3.8,.4,.25],[5.1,.15,.12]],{center:[0,-.96,0]});
 for(const side of [-1,1]){
  // Long split prow, with an uncovered launch channel between armored blades.
  s.hull([[-7,.03,.07],[-6.25,.24,.16],[-4.8,.48,.28],[-3.4,.6,.38],[-1.8,.42,.28]],{center:[side*.58,-.06,0]});
  s.hull([[-6.2,.04,.04],[-4.6,.23,.13],[-3.2,.32,.2],[-2,.22,.12]],{center:[side*.57,.27,0]});
  s.rail([side*.38,-.25,-4.3],layout.launchLength,.07);
  // Long internal structural rails are exposed between individual armor islands.
  s.truss([side*.82,-.4,-3.3],[side*.82,-.4,4.6],.22,30);
  s.hull([[-3.3,.22,.18],[-2.7,.65,.38],[1.8,.7,.44],[4.4,.6,.35],[5.1,.22,.15]],{center:[side*.85,-.3,0]});
  for(const z of layout.shoulderStations){
   s.hull([[-.52,.18,.1],[-.32,.52,.26],[.35,.55,.29],[.6,.26,.14]],{center:[side*.86,.42,z]});
   s.truss([side*.45,-.6,z],[side*1.72,-.3,z],.18,6);
   s.truss([side*.84,.26,z],[side*1.64,.06,z+.15],.12,5);
   s.manifold([side*.98,.14,z],.65);
  }
  // Five separate hangar portals per flank, recessed behind a segmented armored lip.
  for(const z of layout.hangarStations){
   s.hull([[-.46,.16,.1],[-.26,.42,.2],[.32,.42,.2],[.46,.16,.1]],{center:[side*1.58,.22,z]});
   mount(s,[side*1.62,-.15,z],1,side>0?0:Math.PI,t=>t.bay([0,0,0],.72,.4,.52,'x'));
   s.box([side*1.75,-.4,z],[.65,.06,.8],.65);
   s.rail([side*1.83,-.34,z],.56,.11);
   mount(s,[side*1.8,-.26,z],.28,side*Math.PI/2,fighter);
   s.truss([side*1.3,.18,z-.34],[side*1.99,.18,z-.34],.08,4);
   s.pipe([side*1.91,.18,z-.34],[side*1.91,-.12,z-.34],.014,.014);
   // Blast doors, recessed vents and servicing gantries give each bay physical depth.
   for(let j=0;j<4;j++)s.box([side*1.65,.31,z-.24+j*.16],[.32,.045,.055],.6);
   s.box([side*1.99,-.12,z+.36],[.045,.3,.07],.8);
  }
  // Two visibly separated power cores, with coolant loops beneath narrow armor covers.
  for(const z of layout.reactorStations){
   s.pipe([side*1.12,-.12,z-.4],[side*1.12,-.12,z+.4],.2,.2,.7,20);
   for(let j=0;j<5;j++)s.ring([side*1.12,-.12,z-.34+j*.17],.22,.018);
   s.hull([[-.42,.18,.06],[0,.35,.14],[.42,.18,.06]],{center:[side*1.12,.18,z]});
   s.manifold([side*1.38,-.16,z],.72);
  }
  // Aft nacelles connect through skeletal pylons, not a solid full-width slab.
  const e=layout.engineCenter;
  s.truss([side*.85,-.3,e-.7],[side*1.95,-.25,e],.22,8);
  s.hull([[-1.05,.18,.2],[-.55,.62,.65],[.65,.68,.7],[1.15,.5,.5]],{center:[side*1.95,-.25,e]});
  s.hull([[-.8,.15,.09],[0,.44,.22],[.8,.26,.12]],{center:[side*1.95,.2,e]});
  for(const y of [-.46,-.08])s.turbine([side*1.95,y,e+1.4],.23,.85);
  s.turbine([side*.65,-.48,layout.sternTip],.3,1);
  s.radiator([side*2.18,-.06,e-.45],.38,1.35,18);
  s.manifold([side*1.65,-.26,e],1.6);
  for(let j=0;j<8;j++)s.box([side*1.95,.39,e-.6+j*.16],[.33,.05,.07],.6);
  // Ventral docking sockets and independent attitude thrusters along the keel.
  for(const z of [-3.2,-.7,1.8,4.3]){
   s.module([side*.53,-.73,z],.28,.2,.48);
   s.nozzle([side*.53,-.73,z+.28],.09);
   s.truss([side*.7,-.4,z],[side*.53,-.73,z],.09,3);
  }
  for(const z of layout.missileStations){
   s.box([side*1.47,.12,z],[.35,.07,.55]);
   mount(s,[side*1.47,.2,z],.68,side*.15,missileBank);
  }
 }
 // Low four-deck citadel occupies the aft third, preserving a long exposed foredeck.
 s.hull([[-1,.32,.12],[-.5,.9,.25],[1.5,1.02,.32],[2.3,.5,.2]],{center:[0,.35,1.5]});
 s.hull([[-.5,.4,.12],[0,.8,.22],[1.25,.72,.26],[1.8,.3,.13]],{center:[0,.63,1.7]});
 s.hull([[0,.3,.1],[.35,.64,.22],[1.1,.6,.2],[1.4,.24,.12]],{center:[0,.86,1.8]});
 s.hull([[.2,.2,.07],[.45,.48,.13],[1.05,.4,.13]],{center:[0,1.06,1.8]});
 for(let j=0;j<9;j++)s.box([-.3+j*.075,.86,1.5],[.045,.04,.025],1);
 for(const side of [-1,1]){
  for(let j=0;j<9;j++)s.box([side*.39,.77,1.8+j*.13],[.025,.04,.065],1);
  s.module([side*.46,.57,3.5],.23,.2,.3);
  s.dome([side*.28,1.1,2.5],.1,.07);
 }
 // Command spine comprises separate computer vaults and maintenance recesses.
 for(const z of layout.spineStations){
  s.hull([[-.34,.15,.08],[-.12,.38,.21],[.26,.34,.18],[.4,.14,.08]],{center:[0,.08,z]});
  for(const side of [-1,1]){
   s.pipe([side*.2,-.03,z-.4],[side*.2,-.03,z+.4],.045,.045);
   s.radiator([side*.34,.06,z],.12,.45,6);
  }
 }
 s.rail([0,-.12,-4.6],layout.launchLength,.13);
 for(let j=0;j<14;j++)s.box([0,-.07,-6.55+j*.28],[.11,.035,.07],.65);
 // Every gun is carried by a visible armored pedestal and cross-member.
 for(const gun of ENTITY_FLEET.command.turrets){
  const [x,y,z]=gun.position;
  s.hull([[-.2,.12,.05],[0,.27,.1],[.2,.12,.05]],{center:[x,y-.08,z]});
  const footY=x===0?-.08:Math.min(.1,y-.2);
  s.truss([x-.16,footY,z],[x,y-.09,z],.05,3);
  s.truss([x+.16,footY,z],[x,y-.09,z],.05,3);
 }
 // Sloped breakwaters integrate the hangar mouths into the long carrier silhouette.
 for(const side of [-1,1]){
  s.hull([[-3.3,.05,.04],[-2.4,.26,.09],[.4,.28,.11],[2.8,.2,.07],[3.4,.03,.03]],{center:[side*1.48,.28,0]});
  for(const z of [-4.7,-3.8]){
   s.truss([side*.4,-.28,z],[side*.7,.05,z],.08,4);
   s.pipe([side*.52,-.18,z-.25],[side*.52,-.18,z+.25],.065,.065,.65,12);
   s.ring([side*.52,-.18,z],.08,.012);
  }
 }
 // Stern recovery dock: paired gantries, a docked tender and open launch supports.
 s.truss([-.6,-.5,4.6],[.6,-.5,4.6],.16,6);
 s.rail([0,-.45,4.55],1.25,.22);
 mount(s,[0,-.34,4.6],.38,Math.PI,fighter);
 for(const side of [-1,1]){
  s.truss([side*.58,-.6,4.1],[side*.58,.25,4.1],.11,5);
  s.truss([side*.58,.25,4.1],[side*.22,.25,4.7],.09,4);
 }
}

function sensor(s){
 // Deep forward receiver arms, a large dish and asymmetric instrument outriggers.
 s.hull([[-1.4,.65,.28],[-.5,1.15,.55],[.8,1.25,.7],[1.8,.8,.45]],{center:[0,0,1.3]});
 for(const side of [-1,1]){
  s.truss([side*.8,0,1.5],[side*1.3,0,-3.25],.24,17);
  s.hull([[-3.4,.12,.13],[-2.8,.25,.22],[-.8,.38,.34],[.7,.48,.4]],{center:[side*1.1,-.12,0]});
  for(let i=0;i<7;i++)s.module([side*1.28,.14,-2.6+i*.45],.25,.17,.24);
  s.pipe([side*1.18,0,-3.3],[side*1.18,0,-4.05],.055,.025);
  s.ring([side*1.18,0,-3.55],.1,.016);
  s.nozzle([side*.45,-.15,3.3],.27);
  s.truss([0,-.1,1.2],[side*1.3,-.1,.5],.15,4);
 }
 s.pipe([0,.25,1.5],[0,1.25,1.5],.12,.09);
 // Paraboloid formed from sparse structural ribs and three disjoint concentric rims.
 for(const radius of [.36,.75,1.15])s.ring([0,1.05+radius*radius*.3,1.5],radius,.018,'y');
 for(let i=0;i<24;i++){const a=i*TAU/24;for(let j=0;j<10;j++){const r=j*.115,r2=(j+1)*.115;s.beam([Math.cos(a)*r,1.05+r*r*.3,1.5+Math.sin(a)*r],[Math.cos(a)*r2,1.05+r2*r2*.3,1.5+Math.sin(a)*r2],.012);}}
 s.antenna([0,1.05,1.5],1.25);
 s.truss([-.5,0,1.5],[-2.05,.15,1.5],.15,6);s.radiator([-2.1,.15,1.5],.65,1.9,16);
 s.module([1.75,.05,1.55],.55,.4,1);s.truss([.6,0,1.4],[1.75,0,1.4],.2,4);
 s.antenna([1.8,.25,1.5],.65);
}
function courier(s){
 // Swept multi-part wings and two separated propulsion nacelles around a needle fuselage.
 s.hull([[-3,.06,.08],[-1.6,.38,.28],[-.4,.62,.5],[1.4,.5,.38],[2,.25,.2]],{});
 s.hull([[-1.4,.12,.06],[-.65,.34,.22],[.2,.32,.18]],{center:[0,.28,0],ink:.55});
 for(const side of [-1,1]){
  const a=[side*.25,0,-1.2],b=[side*3.6,.1,1.55],c=[side*.7,-.05,1.3],d=[side*2.5,0,2.2];
  // Open slotted wing: the gap between the leading spar and trailing panels remains visible.
  s.truss(a,b,.12,15);
  s.quad([side*.4,0,-.4],b,d,c,.65);
  s.quad([side*.4,-.09,-.4],c,d.map((v,i)=>v+(i===1?-.09:0)),b.map((v,i)=>v+(i===1?-.09:0)),.65);
  for(let i=0;i<10;i++){const x=.6+i*.27,z=.05+x*.45;s.line([side*x,.03,z-.15],[side*x,.03,z+.4]);s.box([side*x,.06,z+.18],[.12,.06,.25],.6);}
  s.truss([side*.55,-.15,.6],[side*1.1,-.15,1.5],.15,5);
  s.hull([[-.5,.25,.22],[0,.4,.4],[1.2,.4,.4],[1.55,.25,.28]],{center:[side*.9,-.18,.6]});
  s.nozzle([side*.9,-.18,2.35],.26);
  s.radiator([side*.9,.05,1.3],.3,.8,9);
  s.hull([[-.5,.12,.12],[.4,.17,.2],[1,.06,.06]],{center:[side*2.8,-.1,1.4]});
  s.pipe([side*2.8,-.1,.9],[side*2.8,-.1,.2],.025,.015);
  const tail=[[side*.25,.1,1],[side*.8,1.1,1.8],[side*.3,.1,1.9]];s.tri(...tail);s.line(tail[0],tail[1]);s.line(tail[1],tail[2]);
 }
 s.module([0,-.3,.7],.22,.16,.65);
}
function relay(s){
 // Hammerhead communications cruiser: wide receiver bow and a long armored bus.
 s.hull([[-2.3,.55,.34],[-1.5,.72,.55],[.9,.8,.65],[2.3,.55,.45],[2.8,.35,.3]],{center:[0,0,.2]});
 s.hull([[-1.8,.2,.18],[-1.3,.42,.4],[-.65,.5,.5],[.65,.5,.5],[1.3,.42,.4],[1.8,.2,.18]],{axis:'x',center:[0,.05,-1.9]});
 s.hull([[-.65,.4,.2],[.6,.6,.4],[1,.4,.25]],{center:[0,.48,.5]});
 for(const side of [-1,1]){
  // Apertures and nested antenna plates occupy the full transverse bow.
  for(let i=0;i<8;i++){
   const x=side*(.3+i*.18);
   s.box([x,.18,-2.15],[.1,.08,.22],.6);
   s.pipe([x,0,-2.05],[x,0,-2.45],.045,.065,.8,12);
   s.ring([x,0,-2.45],.065,.012);
  }
  for(let i=0;i<5;i++){
   const z=-.9+i*.65;
   s.hull([[-.22,.28,.25],[0,.4,.4],[.22,.25,.25]],{center:[side*.7,-.04,z]});
   s.truss([side*.28,-.1,z],[side*.65,-.1,z],.12,3);
   s.manifold([side*.85,.1,z],.35);
   s.box([side*.92,0,z],[.055,.35,.25],.6);
  }
  s.truss([side*.55,-.15,-1.5],[side*.55,-.15,2.3],.13,18);
  s.hull([[-.8,.2,.2],[.1,.45,.45],[.8,.36,.36]],{center:[side*.7,-.18,1.8]});
  s.nozzle([side*.7,-.18,2.95],.24);
  // Swept relay wings have narrow slots, not orbital wheel geometry.
  s.tri([side*.55,.05,.3],[side*1.6,-.12,1.5],[side*.7,.02,1.8],.7);
  s.truss([side*.55,.05,.3],[side*1.6,-.12,1.5],.1,6);
  s.radiator([side*1.2,-.05,1.5],.35,.6,8);
 }
 s.dome([0,.74,.6],.23,.18);
 s.antenna([0,.75,1.1],.5);
 s.pipe([0,.1,.7],[0,.1,2.1],.22,.25,.8,24);
 for(let i=0;i<7;i++)s.ring([0,.1,.7+i*.2],.26,.02);
 s.module([0,-.37,-.5],.4,.2,1.2);
}

function ark(s){
 // An industrial carrier built around an open drydock, not a filled rectangular slab.
 for(const side of [-1,1]){
  s.hull([[-3.2,.2,.3],[-2.65,.62,.62],[-1.5,.8,.7],[1.5,.85,.7],[2.4,.65,.55],[2.8,.4,.4]],{center:[side*1.15,0,0]});
  for(let i=0;i<8;i++){
   const z=-2.25+i*.62;
   s.module([side*1.72,-.02,z],.32,.45,.43);
   s.module([side*.95,.42,z],.28,.2,.4);
   s.truss([side*1.15,-.2,z],[side*1.65,-.85,z],.13,3);
   s.box([side*1.6,-.9,z],[.52,.09,.34],.65);
  }
  s.truss([side*.65,.1,-2.7],[side*.65,.1,2.35],.16,22);
  s.truss([side*1.6,-.85,-2.4],[side*1.6,-.85,2.25],.14,18);
  for(const y of [-.2,.25])s.nozzle([side*1.12,y,3.15],.24);
  s.radiator([side*1.8,.1,1.65],.4,1.1,12);
 }
 // Cross-frame portals preserve the longitudinal launch bay.
 for(const z of [-1.9,-.5,1.4]){
  s.truss([-1.1,.2,z],[-.75,1.05,z],.15,4);
  s.truss([-.75,1.05,z],[.75,1.05,z],.18,6);
  s.truss([.75,1.05,z],[1.1,.2,z],.15,4);
 }
 s.box([0,-.25,2.05],[1.6,.22,.6],.6);
 s.module([0,0,2.1],.85,.35,.65);
 s.hull([[-.55,.45,.35],[.45,.75,.5]],{center:[1.1,.9,.8]});
 s.hull([[-.45,.6,.15],[.4,.8,.2]],{center:[1.1,1.3,.7]});
 s.antenna([1.3,1.4,.85],.65);
 s.box([1.1,1.3,.23],[.55,.065,.02],1);
 // Tiny docked shuttles establish scale within the open bay.
 for(const z of [-1.5,-.5,.5])s.hull([[-.24,.03,.03],[.12,.2,.1],[.25,.14,.08]],{center:[0,-.12,z],ink:.7});
}
function finishing(s,kind){
 if(kind==='sensor'){
  // Three telescopic receiver clusters with nested focusing rings.
  for(const side of [-1,1]){
   for(let j=0;j<5;j++){s.ring([side*1.18,0,-3.3-j*.1],.1-j*.01,.012);}
   s.manifold([side*.48,.4,1.35],1.1);
   s.dome([side*.5,.4,2],.25,.25);
   s.hull([[-.5,.3,.2],[0,.45,.35],[.5,.3,.2]],{center:[side*.75,-.3,1.4]});
   for(let z=.5;z<2.4;z+=.2)s.box([side*.78,-.45,z],[.12,.055,.1],.65);
  }
  s.hull([[-.55,.6,.2],[.1,.85,.32],[.5,.5,.2]],{center:[0,.45,2]});
  for(let i=0;i<12;i++){const a=i*TAU/12;s.pipe([Math.cos(a)*.3,.75,1.5+Math.sin(a)*.3],[Math.cos(a)*.52,1.1,1.5+Math.sin(a)*.52],.018,.018);}
 }
 if(kind==='courier'){
  for(const side of [-1,1]){
   // Armor flaps and multilayer leading-edge spars.
   for(let i=0;i<9;i++){
    const x=.7+i*.27,z=-.65+x*.7;
    s.hull([[-.22,.18,.055],[.12,.22,.1],[.36,.09,.03]],{center:[side*x,.045,z]});
    s.pipe([side*x,-.11,z+.1],[side*x,-.11,z+.35],.025,.025);
   }
   s.manifold([side*.9,.04,.7],.8);
   s.hull([[-.4,.13,.16],[.2,.27,.3],[.8,.14,.18]],{center:[side*1.4,-.23,.6]});
   s.ring([side*.9,-.18,.1],.24,.025);
   s.ring([side*.9,-.18,.15],.19,.018);
   for(let j=0;j<8;j++)s.box([side*.9,.05,.3+j*.15],[.32,.025,.06],.7);
  }
  s.hull([[-1.6,.08,.04],[-.8,.28,.18],[.1,.3,.18]],{center:[0,.29,0],ink:.6});
 }
 if(kind==='relay'){
  for(const side of [-1,1]){
   s.hull([[-.3,.18,.12],[.3,.28,.2]],{center:[side*1.25,.35,-1.9]});
   s.antenna([side*1.25,.45,-1.9],.35);
   for(let i=0;i<4;i++)s.pipe([side*.45,.15,-.4+i*.35],[side*.8,.2,-.4+i*.35],.02,.02);
  }
 }
 if(kind==='ark'){
  for(const side of [-1,1]){
   // Recessed hangar mouths, maintenance gantries and gantry cranes.
   for(let i=0;i<6;i++){
    const z=-2.05+i*.78;
    s.hull([[-.22,.18,.17],[0,.3,.27],[.22,.2,.2]],{center:[side*1.72,-.08,z],ink:.65});
    s.box([side*1.86,.18,z],[.035,.06,.36]);
    s.box([side*1.86,-.28,z],[.035,.06,.36]);
    for(let j=0;j<5;j++)s.pipe([side*1.87,-.2+j*.08,z-.16],[side*1.87,-.2+j*.08,z+.16],.009,.009);
    s.truss([side*1.5,.25,z],[side*1.9,.75,z],.1,3);
    s.truss([side*1.9,.75,z],[side*.7,.75,z],.1,5);
    s.line([side*.7,.75,z],[side*.7,.25,z]);
   }
   s.manifold([side*1.48,-.23,.9],1.3);
   for(let i=0;i<12;i++)s.hull([[-.18,.13,.1],[.13,.2,.16]],{center:[side*1.12,.42,-2.1+i*.36],ink:.65});
  }
  s.hull([[-.65,.5,.22],[-.4,.9,.36],[.35,1.05,.45],[.7,.5,.25]],{center:[1.05,1.55,.45]});
  s.hull([[-.65,.5,.12],[.3,.7,.15]],{center:[1.05,1.85,.45]});
  for(let i=0;i<8;i++)s.box([.72+i*.09,1.78,-.18],[.05,.055,.025],1);
  s.dome([1.1,1.99,.5],.17,.12);
  s.antenna([1.15,1.95,.55],.4);
  // Lower keel and suspended docking reactor.
  s.hull([[-2,.1,.15],[-1.3,.28,.3],[1.4,.3,.35],[2,.15,.2]],{center:[0,-.6,0]});
  for(const z of [-1.5,-.4,.7,1.8]){s.truss([-1,-.2,z],[0,-.6,z],.1,4);s.truss([1,-.2,z],[0,-.6,z],.1,4);}
 }
}


function mount(yard,center,scale,yaw,build){
 const local=new Yard();build(local);const c=Math.cos(yaw),s=Math.sin(yaw);
 const rotate=p=>[p[0]*c+p[2]*s,p[1],-p[0]*s+p[2]*c];
 const map=p=>add(center,mul(rotate(p),scale));
 for(const face of local.faces)yard.faces.push({...face,a:map(face.a),b:map(face.b),c:map(face.c),n:rotate(face.n),area:face.area*scale*scale});
 for(const edge of local.edges)yard.edges.push({...edge,a:map(edge.a),b:map(edge.b)});
}
function fighter(s){
 s.hull([[-.65,.025,.04],[-.3,.17,.12],[.15,.24,.17],[.48,.15,.12]],{});
 s.hull([[-.28,.06,.04],[.05,.13,.1],[.2,.08,.05]],{center:[0,.11,0]});
 for(const side of [-1,1]){
  s.panel([side*.06,.01,-.27],[side*.45,.015,.22],[side*.32,.01,.43],[side*.08,.01,.27],.8);
  s.hull([[-.25,.075,.09],[.22,.12,.12],[.4,.06,.06]],{center:[side*.16,-.07,.13]});
  s.nozzle([side*.16,-.07,.58],.07);
  s.pipe([side*.31,0,.23],[side*.31,0,-.25],.018,.012,.9,8);
  s.tri([side*.1,.05,.2],[side*.23,.24,.45],[side*.16,.05,.47]);
 }
}
function funnel(s){
 s.hull([[-.55,.035,.035],[-.2,.17,.18],[.23,.23,.23],[.42,.13,.13]],{});
 for(const side of [-1,1]){
  s.panel([side*.1,0,-.2],[side*.31,.015,.17],[side*.23,.015,.36],[side*.08,0,.28],.8);
  s.pipe([side*.045,.025,-.1],[side*.045,.025,-.64],.018,.013,.9,8);
  s.box([side*.14,.13,.14],[.045,.025,.24]);
 }
 s.nozzle([0,0,.48],.08);
}
function turret(s,barrels=2){
 s.pipe([0,-.05,0],[0,.07,0],.19,.19,.8,16);
 s.hull([[-.24,.2,.13],[-.1,.34,.2],[.2,.32,.2],[.27,.18,.12]],{center:[0,.15,0]});
 for(let i=0;i<barrels;i++){
  const x=(i-(barrels-1)/2)*.12;
  s.pipe([x,.16,-.12],[x,.16,-.58],.027,.022,.9,12);
  s.hull([[-.12,.055,.055],[.05,.075,.075]],{center:[x,.16,-.57]});
  s.box([x,.17,.13],[.07,.025,.12]);
 }
 s.box([0,.27,.05],[.12,.025,.1]);
}
function missileBank(s){
 s.module([0,0,0],.34,.15,.46);
 for(let x=0;x<2;x++)for(let z=0;z<3;z++){
  const c=[-.09+x*.18,.085,-.14+z*.14];s.box(c,[.12,.025,.1]);s.line(add(c,[-.04,.014,0]),add(c,[.04,.014,0]));
 }
}
function arsenal(s,kind){
 const definition=ENTITY_FLEET[kind];
 for(const item of definition.escorts)mount(s,item.position,item.scale,item.yaw,fighter);
 for(const item of definition.funnels)mount(s,item.position,item.scale,item.yaw,funnel);
 for(const item of definition.turrets)mount(s,item.position,item.scale,item.yaw,t=>turret(t,item.barrels));
 if(kind==='command'){return;}else if(kind==='sensor'){
  for(const side of [-1,1]){
   s.module([side*.85,.15,.9],.35,.17,.7);
   s.pipe([side*1.12,.22,-2],[side*1.12,.22,-1.25],.055,.045,.8,16);
   mount(s,[side*.65,.32,2.2],.7,side*.22,missileBank);
  }
 }else if(kind==='courier'){
  for(const side of [-1,1]){
   s.hull([[-.4,.07,.08],[0,.18,.18],[.5,.08,.07]],{center:[side*1.85,-.2,.55]});
   s.pipe([side*1.85,-.2,.1],[side*1.85,-.2,-.45],.025,.018);
   mount(s,[side*1.4,-.12,.7],.65,0,missileBank);
  }
 }else if(kind==='relay'){
  for(const side of [-1,1]){
   s.hull([[-.3,.16,.13],[.3,.25,.22]],{center:[side*.65,.32,.6]});
   s.manifold([side*.66,.46,.6],.45);
   mount(s,[side*.7,.25,1.8],.7,0,missileBank);
  }
 }else if(kind==='ark'){
  for(const side of [-1,1]){
   s.box([side*1.9,-.05,.4],[.36,.06,1.6]);
   for(let z=-.2;z<1.1;z+=.4)mount(s,[side*1.9,.02,z],.65,0,missileBank);
   s.truss([side*1.1,-.2,-1.5],[side*1.9,-.2,-1.5],.12,5);
  }
 }
}


function specialistDetails(s,kind){
 if(kind==='sensor'){
  for(const side of [-1,1]){
   s.pipe([side*1.1,.1,-3.25],[side*1.1,.1,-3.65],.12,.14,.75,24);
   s.pipe([side*1.1,.1,-3.26],[side*1.1,.1,-3.64],.07,.11,.6,24);
   s.ring([side*1.1,.1,-3.65],.14,.018);
   for(let j=0;j<6;j++)s.box([side*1.25,.13,-2.65+j*.39],[.24,.05,.08],.7);
   s.bay([side*.6,-.04,1.3],.65,.22,.18,'x');
  }
  s.module([0,.42,2.2],.55,.18,.55);
 }else if(kind==='courier'){
  for(const side of [-1,1]){
   s.rail([side*1.9,.07,.8],.55,.04);
   for(let j=0;j<4;j++)s.box([side*1.9,.09,.65+j*.1],[.13,.035,.05],.65);
   s.turbine([side*.9,-.18,2.35],.26,.42);
  }
 }else if(kind==='relay'){
  for(const side of [-1,1]){
   s.bay([side*.85,0,.8],.48,.24,.18,'x');
   s.box([side*1.25,.25,-1.9],[.4,.045,.18],.65);
   s.turbine([side*.7,-.18,2.95],.24,.4);
  }
 }else if(kind==='ark'){
  for(const side of [-1,1]){
   for(const z of [-1.4,.2,1.8])s.bay([side*1.75,-.03,z],.45,.25,.18,'x');
   s.rail([side*.45,-.17,-.65],2.3,.06);
   s.turbine([side*1.12,-.2,3.15],.24,.4);
  }
 }
}

export function buildGeometry(kind){
 const yard=new Yard();({command,sensor,courier,relay,ark}[kind]||ark)(yard);finishing(yard,kind);arsenal(yard,kind);specialistDetails(yard,kind);
 let min=[Infinity,Infinity,Infinity],max=[-Infinity,-Infinity,-Infinity];
 for(const f of yard.faces)for(const p of [f.a,f.b,f.c])for(let i=0;i<3;i++){min[i]=Math.min(min[i],p[i]);max[i]=Math.max(max[i],p[i]);}
 const middle=min.map((v,i)=>(v+max[i])/2),scale=4.8/Math.max(...max.map((v,i)=>v-min[i])),point=p=>mul(sub(p,middle),scale);
 const faces=yard.faces.map(f=>({...f,a:point(f.a),b:point(f.b),c:point(f.c),area:f.area*scale*scale}));
 const area=faces.reduce((v,f)=>v+f.area,0),spacing=Math.sqrt(area/((ENTITY_FLEET[kind]?.pointBudget||ENTITY.maxPoints)*.78));
 const out=[],bins=new Map(),cell=spacing*.68,minimum2=cell*cell;
 const key=(x,y,z)=>((x+1024)*2048+y+1024)*2048+z+1024;
 function put(p,n,ink){
  const x=Math.floor(p[0]/cell),y=Math.floor(p[1]/cell),z=Math.floor(p[2]/cell);
  for(let dx=-1;dx<=1;dx++)for(let dy=-1;dy<=1;dy++)for(let dz=-1;dz<=1;dz++){
   const bucket=bins.get(key(x+dx,y+dy,z+dz));
   if(bucket)for(const q of bucket)if((p[0]-q[0])**2+(p[1]-q[1])**2+(p[2]-q[2])**2<minimum2)return;
  }
  const k=key(x,y,z);if(!bins.has(k))bins.set(k,[]);bins.get(k).push(p);out.push(...p,...n,ink);
 }
 // Retain structural contours first; nearby armor points cannot bury the edges.
 for(const e of yard.edges){
  const a=point(e.a),b=point(e.b),d=sub(b,a),count=Math.ceil(Math.hypot(...d)/spacing);
  for(let i=0;i<=count;i++)put(add(a,mul(d,count?i/count:0)),[0,0,0],1.1);
 }
 // Equal-spacing triangular lattices; no random points, no per-face minimum quotas.
 for(const f of faces){
  const ab=sub(f.b,f.a),u=unit(ab),v=unit(cross(f.n,u)),length=Math.hypot(...ab);
  const ac=sub(f.c,f.a),cx=dot(ac,u),cy=dot(ac,v),rowStep=spacing*Math.sqrt(3)/2;
  const rows=Math.floor(cy/rowStep);
  for(let row=0;row<=rows;row++){
   const y=(row+.35)*rowStep;if(y>=cy)continue;
   const fraction=y/cy,start=cx*fraction,end=length+(cx-length)*fraction;
   for(let x=Math.ceil(start/spacing-.5*(row%2))*spacing+.5*(row%2)*spacing;x<end;x+=spacing){
    if(x<start)continue;put(add(f.a,add(mul(u,x),mul(v,y))),f.n,f.ink);
   }
  }
 }
 const points=new Float32Array(out);
 return {kind,points,count:out.length/7,spacing,surfaceCount:faces.length,bounds:{min:min.map((v,i)=>(v-middle[i])*scale),max:max.map((v,i)=>(v-middle[i])*scale)}};
}
