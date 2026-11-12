const query=new URLSearchParams(location.search);document.querySelector('#error').textContent=query.get('error')||'';try{const next=new URL(query.get('next')||'/',location.origin);if(next.origin===location.origin&&!/^\/(auth|login)/.test(next.pathname))document.querySelector('[name=next]').value=next.pathname+next.search;}catch{}

const form=document.querySelector('form'),button=form.querySelector('button');
button.disabled=true;
Promise.resolve(window.matrixReady).then(()=>{
 button.disabled=false;
 if(!window.matrixPages)return;
 const doodles=Array.from({length:8},(_,i)=>'/assets/doodle/doodle_'+(i+1)+'.png');
 const picture=document.querySelector('[data-login-doodle]');picture.src=doodles[Math.floor(Math.random()*doodles.length)];picture.onerror=()=>{picture.onerror=null;picture.src=doodles[0];};
 form.addEventListener('submit',async event=>{
  event.preventDefault();if(button.disabled)return;button.disabled=true;
  try{const response=await fetch('/auth/login',{method:'POST',body:new URLSearchParams(new FormData(form)),headers:{'Content-Type':'application/x-www-form-urlencoded'}});const data=await response.json();if(!response.ok||!data.ok)throw Error(data.error||'登录失败');location.assign(form.elements.next.value||'/');}
  catch(error){document.querySelector('#error').textContent=error.message;button.disabled=false;}
 });
}).catch(error=>{document.querySelector('#error').textContent=error.message;});
