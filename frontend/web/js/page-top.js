export function mountPageTop(){
 if(document.getElementById('pageTopButton'))return;
 const button=document.createElement('button');button.id='pageTopButton';button.className='page-top-button';button.type='button';button.title='回到顶部';button.setAttribute('aria-label','回到页面顶部');button.inert=true;button.tabIndex=-1;
 // A roof line, ascending chevron and two short trails form the return-to-top symbol.
 button.innerHTML='<svg viewBox="0 0 32 32" fill="none" aria-hidden="true"><path class="page-top-roof" d="M7 6h18"/><g class="page-top-arrow"><path d="m9 17 7-7 7 7M16 11v13"/><path class="page-top-trails" d="M11 25v2m10-2v2"/></g></svg>';
 (document.querySelector('main')||document.body).append(button);
 let frame=0;const update=()=>{frame=0;const visible=window.scrollY>280;button.dataset.visible=String(visible);button.inert=!visible;button.tabIndex=visible?0:-1;};
 const schedule=()=>{if(!frame)frame=requestAnimationFrame(update);};
 addEventListener('scroll',schedule,{passive:true});addEventListener('resize',schedule,{passive:true});
 button.onclick=()=>{const motion=!matchMedia('(prefers-reduced-motion: reduce)').matches&&!document.documentElement.classList.contains('motion-disabled');window.scrollTo({top:0,behavior:motion?'smooth':'instant'});document.getElementById('brandHomeTrigger')?.focus({preventScroll:true});};
 update();return()=>{removeEventListener('scroll',schedule);removeEventListener('resize',schedule);cancelAnimationFrame(frame);button.remove();};
}
