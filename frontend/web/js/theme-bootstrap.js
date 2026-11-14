// A paint hint only. Authenticated account preferences replace this cache after connection.
(()=>{
 const root=document.documentElement,system=matchMedia('(prefers-color-scheme: light)');
 let mode='dark';try{const cached=localStorage.getItem('corenyan.appearance');if(['light','dark','system'].includes(cached))mode=cached;}catch{}
 const resolve=value=>value==='system'?(window.MatrixSystemTheme||(system.matches?'light':'dark')):value;
 function apply(value){mode=value;root.dataset.theme=resolve(value);root.dataset.themeMode=value;try{localStorage.setItem('corenyan.appearance',value);}catch{}dispatchEvent(new CustomEvent('matrix-theme-applied',{detail:{mode,effective:root.dataset.theme}}));}
 Object.defineProperty(window,'MatrixTheme',{value:Object.freeze({apply,resolve,get mode(){return mode;},system})});apply(mode);
 system.addEventListener('change',()=>{if(mode==='system')dispatchEvent(new Event('matrix-system-theme'));});
 addEventListener('matrix-system-theme',()=>{if(!window.MatrixThemeTransition&&mode==='system')apply(mode);});
 function nativeAppearance(){
  if(!window.MatrixNative?.setAppearance)return;
  const phase=root.dataset.terminalPhase||'loading',inverse=['loading','closing','closed'].includes(phase);
  const light=(root.dataset.theme==='light')!==inverse;
  void window.MatrixNative.setAppearance(light?'light':'dark').catch(()=>{});
 }
 addEventListener('matrix-native-ready',()=>{if(mode==='system')apply(mode);nativeAppearance();});
 addEventListener('matrix-theme-applied',nativeAppearance);addEventListener('matrix-terminal-transition',nativeAppearance);
})();
