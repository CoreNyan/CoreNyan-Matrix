(()=>{
 if(window.top!==window||location.origin!==__MATRIX_ORIGIN__)return;
 let sequence=0;const pending=new Map();
 chrome.webview.addEventListener('message',({data})=>{const request=pending.get(data.id);if(request){pending.delete(data.id);clearTimeout(request.timer);data.error?request.reject(Error(data.error)):request.resolve(data.value);}});
 const call=(action,value)=>new Promise((resolve,reject)=>{const id=String(++sequence);const timer=setTimeout(()=>{pending.delete(id);reject(Error('本地操作超时'));},30000);pending.set(id,{resolve,reject,timer});chrome.webview.postMessage({id,action,value});});
 Object.defineProperty(window,'MatrixNative',{value:Object.freeze({platform:'windows',notificationPermission:'granted',getNotificationPermission:()=>call('getNotificationPermission'),openNotificationSettings:()=>call('openNotificationSettings'),writeClipboard:text=>call('writeClipboard',text),readClipboard:()=>call('readClipboard'),writeImage:base64=>call('writeImage',base64),notify:value=>call('notify',value)})});
 dispatchEvent(new Event('matrix-native-ready'));
})();
