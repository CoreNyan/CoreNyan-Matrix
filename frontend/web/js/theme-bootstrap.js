// A paint hint only. Authenticated account preferences replace this cache after connection.
(()=>{
 const root=document.documentElement,system=matchMedia('(prefers-color-scheme: light)');
 let mode='dark';try{const cached=localStorage.getItem('corenyan.appearance');if(['light','dark','system'].includes(cached))mode=cached;}catch{}
 let release;const ready=new Promise(resolve=>{release=resolve;});
 function complete(value){
  apply(value);const pending=root.hasAttribute('data-theme-pending');
  // Fade an opaque cover, never the root: root opacity exposes the browser's white canvas.
  if(pending&&!matchMedia('(prefers-reduced-motion: reduce)').matches&&!root.classList.contains('motion-disabled')){root.setAttribute('data-theme-handoff','');setTimeout(()=>root.removeAttribute('data-theme-handoff'),200);}
  root.removeAttribute('data-theme-pending');if(pending)dispatchEvent(new Event('matrix-appearance-ready'));
  release();
 }
 const resolve=value=>value==='system'?(window.MatrixSystemTheme||(system.matches?'light':'dark')):value;
 function apply(value){mode=value;root.dataset.theme=resolve(value);root.dataset.themeMode=value;try{localStorage.setItem('corenyan.appearance',value);}catch{}dispatchEvent(new CustomEvent('matrix-theme-applied',{detail:{mode,effective:root.dataset.theme}}));}
 Object.defineProperty(window,'MatrixTheme',{value:Object.freeze({apply,complete,ready,resolve,get mode(){return mode;},system})});apply(mode);if(!root.hasAttribute('data-theme-pending'))release();
 system.addEventListener('change',()=>{if(mode==='system')dispatchEvent(new Event('matrix-system-theme'));});
 addEventListener('matrix-system-theme',()=>{if(!window.MatrixThemeTransition&&mode==='system')apply(mode);});
 function nativeAppearance(){
  if(root.hasAttribute('data-theme-pending')||!window.MatrixNative?.setAppearance)return;
  const phase=root.dataset.terminalPhase||'loading',inverse=['loading','closing','closed'].includes(phase);
  const light=(root.dataset.theme==='light')!==inverse;
  void window.MatrixNative.setAppearance(light?'light':'dark').catch(()=>{});
 }
 addEventListener('matrix-native-ready',()=>{if(mode==='system')apply(mode);nativeAppearance();});
 addEventListener('matrix-appearance-ready',nativeAppearance);addEventListener('matrix-theme-applied',nativeAppearance);addEventListener('matrix-terminal-transition',nativeAppearance);
})();
