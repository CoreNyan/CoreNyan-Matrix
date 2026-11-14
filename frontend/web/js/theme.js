import {onPreferences,preferencesReady,updatePreferences} from './preferences.js';
const theme=window.MatrixTheme,root=document.documentElement;
let mounted=false,anchor=null,transition=null,serial=0;
const sun='<circle cx="12" cy="12" r="4"/><path d="M12 2v2m0 16v2M2 12h2m16 0h2M5 5l1.4 1.4m11.2 11.2L19 19M5 19l1.4-1.4M17.6 6.4 19 5"/>';
const moon='<path d="M20.3 14.1A8.6 8.6 0 0 1 9.9 3.7a8.7 8.7 0 1 0 10.4 10.4Z"/>';
function buttonState(){const b=document.getElementById('btnTheme');if(!b)return;const light=root.dataset.theme==='light';b.querySelector('svg').innerHTML=light?sun:moon;b.setAttribute('aria-label',light?'切换黑夜主题':'切换白日主题');b.title=light?'白日 · 切换黑夜':'黑夜 · 切换白日';}
async function reveal(mode,origin){
 if(!theme)return;const target=theme.resolve(mode);if(target===root.dataset.theme&&mode===theme.mode)return;const ticket=++serial;
 transition?.skipTransition();transition=null;
 const animate=root.dataset.terminalPhase==='open'&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&!document.body.classList.contains('motion-off');
 if(target===root.dataset.theme||!animate||!document.startViewTransition){theme.apply(mode);return;}
 const rect=(origin||document.getElementById('btnTheme'))?.getBoundingClientRect();
 const x=rect?rect.left+rect.width/2:innerWidth/2,y=rect?rect.top+rect.height/2:innerHeight/2;
 const radius=Math.hypot(Math.max(x,innerWidth-x),Math.max(y,innerHeight-y));
 // Both snapshots already contain the untouched media. No inversion veil passes over photos.
 const active=document.startViewTransition(()=>theme.apply(mode));transition=active;
 try{await active.ready;if(ticket!==serial){active.skipTransition();return;}
  await root.animate({clipPath:[`circle(0px at ${x}px ${y}px)`,`circle(${radius}px at ${x}px ${y}px)`]}, {duration:620,easing:'cubic-bezier(.2,.65,.2,1)',pseudoElement:'::view-transition-new(root)'}).finished;
 }catch{theme.apply(mode);}finally{if(ticket===serial)transition=null;}
}
export function chooseTheme(mode,source){anchor=source;try{updatePreferences({theme:mode});}finally{anchor=null;}}
export function mountTheme(){if(mounted)return;mounted=true;window.MatrixThemeTransition=true;
 const button=document.getElementById('btnTheme');if(button){button.disabled=!preferencesReady();button.onclick=()=>{try{chooseTheme(root.dataset.theme==='light'?'dark':'light',button);}catch(error){button.title=error.message;}};}
 buttonState();addEventListener('matrix-theme-applied',buttonState);
 onPreferences(p=>{if(preferencesReady())void reveal(p.theme,anchor);});
 document.addEventListener('corenyan:preferences',e=>{if(button)button.disabled=!e.detail.ready;});
 addEventListener('matrix-system-theme',()=>{if(theme?.mode==='system')void reveal('system');});
}
