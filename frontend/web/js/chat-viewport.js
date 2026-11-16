// Following new replies is a reading choice, not a side effect of each render.
export function createChatViewport(container,button){
 let following=true,frame=0,anchor=null,lastTop=container.scrollTop,unseen=new Set();
 const nearBottom=()=>container.scrollHeight-container.clientHeight-container.scrollTop<=24;
 function capture(){const top=container.getBoundingClientRect().top;const node=[...container.querySelectorAll('[data-message]')].find(n=>n.getBoundingClientRect().bottom>top);return node?{id:node.dataset.message,offset:node.getBoundingClientRect().top-top,top:container.scrollTop}:{top:container.scrollTop};}
 function update(){button.hidden=following||!unseen.size;button.textContent='有新消息 · 回到底部 ↓';}
 function pause(){following=false;cancelAnimationFrame(frame);frame=0;anchor=capture();update();}
 function settle(){cancelAnimationFrame(frame);frame=requestAnimationFrame(()=>{frame=0;if(following){container.scrollTop=container.scrollHeight;unseen.clear();}else if(anchor){const node=[...container.querySelectorAll('[data-message]')].find(n=>n.dataset.message===anchor.id);container.scrollTop=node?container.scrollTop+node.getBoundingClientRect().top-container.getBoundingClientRect().top-anchor.offset:anchor.top;}lastTop=container.scrollTop;update();});}
 container.addEventListener('wheel',e=>{if(e.deltaY<0)pause();},{passive:true});
 let touchY;container.addEventListener('touchstart',e=>{touchY=e.touches[0]?.clientY;},{passive:true});
 container.addEventListener('touchmove',e=>{const y=e.touches[0]?.clientY;if(y>touchY)pause();touchY=y;},{passive:true});
 container.addEventListener('keydown',e=>{if(['ArrowUp','PageUp','Home'].includes(e.key))pause();});
 container.addEventListener('scroll',()=>{const top=container.scrollTop;if(top<lastTop-1)pause();else if(top>lastTop&&nearBottom()){following=true;unseen.clear();}lastTop=top;if(!following)anchor=capture();update();},{passive:true});
 const observer=new ResizeObserver(settle);
 observer.observe(container);
 button.onclick=()=>{following=true;unseen.clear();anchor=null;settle();};
 return {
  before(){const saved=capture();if(!following)anchor=saved;return saved;},
  after({added=[],restore}={}){if(restore){following=false;anchor=restore;}if(!following)for(const id of added)unseen.add(id);observer.disconnect();observer.observe(container);for(const n of container.children)observer.observe(n);settle();},
  reset(){cancelAnimationFrame(frame);frame=0;following=true;anchor=null;unseen.clear();lastTop=0;update();},
  get following(){return following;}
 };
}
