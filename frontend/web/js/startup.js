// Surface invalid JSON/missing terms instead of leaving a partially initialized UI.
Promise.resolve(window.matrixReady).then(()=>import('./app.js?v=10.6')).catch(error => {
  document.documentElement.removeAttribute('data-terms-pending');
  const message = document.createElement('pre');
  message.style.cssText = 'padding:32px;color:#eee;background:#111;white-space:pre-wrap';
  message.textContent = `页面暂时无法加载。\n${error.message}`;
  document.body.replaceChildren(message);
  console.error(error);
});
