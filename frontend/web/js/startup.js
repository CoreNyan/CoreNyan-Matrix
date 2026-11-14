// Surface invalid JSON/missing terms instead of leaving a partially initialized UI.
Promise.resolve(window.matrixReady).then(()=>{window.MatrixBoot?.begin('interface');return import('./app.js?v=10.6');}).catch(error => {
  if(!window.MatrixBoot?.snapshot().steps.some(s=>s.status==='failed'))window.MatrixBoot?.fail('interface',error);
  console.error(error);
});
