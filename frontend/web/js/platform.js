// One interface for browser, Windows and Android; business data stays on the server.
export const platform=()=>globalThis.MatrixNative?.platform||'web';
let nativePermission=null;
export const notificationPermission=()=>nativePermission||globalThis.MatrixNative?.notificationPermission||globalThis.Notification?.permission||'unsupported';
export async function readNotificationPermission(){if(globalThis.MatrixNative?.getNotificationPermission)nativePermission=await MatrixNative.getNotificationPermission();return notificationPermission();}
export async function requestNotifications(){if(globalThis.MatrixNative?.requestNotifications){const result=await MatrixNative.requestNotifications();if(typeof result==='string')nativePermission=result;return readNotificationPermission();}if(globalThis.MatrixNative)return readNotificationPermission();return globalThis.Notification?.requestPermission()||'unsupported';}
export async function openNotificationSettings(){if(globalThis.MatrixNative?.openNotificationSettings)return MatrixNative.openNotificationSettings();throw Error('请在浏览器的网站权限或系统设置中打开通知。');}
export const platformClipboard={
 writeText:text=>globalThis.MatrixNative?MatrixNative.writeClipboard(String(text)):navigator.clipboard.writeText(String(text)),
 readText:()=>globalThis.MatrixNative?MatrixNative.readClipboard():navigator.clipboard.readText()
};
export async function copyImage(blob){if(globalThis.MatrixNative?.writeImage){if(blob.size>8*1024*1024)throw Error('图片超过剪贴板大小限制，请下载原图');const bytes=new Uint8Array(await blob.arrayBuffer());let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));return MatrixNative.writeImage(btoa(binary));}return navigator.clipboard.write([new ClipboardItem({[blob.type||'image/png']:blob})]);}
export async function notifyReply({title,body,icon,tag,route,onClick}){
 if(globalThis.MatrixNative?.notify){const accepted=await MatrixNative.notify({title,body,route});if(accepted===false)throw Error('系统未允许通知，请检查通知权限和通知频道。');return true;}
 if(globalThis.Notification?.permission!=='granted')throw Error('尚未获得系统通知权限。');
 const notification=new Notification(title,{body,icon,tag});notification.onclick=()=>{notification.close();onClick?.();};
 return await new Promise((resolve,reject)=>{const timer=setTimeout(()=>reject(Error('系统没有确认通知显示，请检查浏览器通知权限。')),8000);notification.onshow=()=>{clearTimeout(timer);resolve(true);};notification.onerror=()=>{clearTimeout(timer);reject(Error('系统通知未能显示。'));};});
}
function apply(){document.documentElement.dataset.platform=platform();document.dispatchEvent(new Event('matrix:platform-ready'));}
window.addEventListener('matrix-native-ready',apply);apply();
