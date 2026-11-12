export const SERVICE_CONTROL=Object.freeze({
 actions:Object.freeze(['start','stop','restart']),qqContainer:'onebot-qq',
 qqContainers:Object.freeze(['onebot-qq','snowluma-qq']),
 brainFile:'corenyan-brain-file',brain:'corenyan-brain',web:'corenyan-web',
 timeoutMs:45000,stopTimeoutSeconds:15
});
export function sessionImpact(layer,action){
 return SERVICE_CONTROL.qqContainers.includes(layer?.containerName)&&['stop','restart'].includes(action);
}
export function validateControl(layer,action,confirmation=false){
 if(!layer)throw Error('未知层');
 if(layer.kind!=='container'||!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(layer.containerName))throw Error('该层没有可控制的容器');
 if(!SERVICE_CONTROL.actions.includes(action))throw Error('非法控制指令');
 if(sessionImpact(layer,action)&&confirmation!==true)throw Error('QQ 接入端操作可能导致 QQ 掉线，必须明确确认；日志轮询和普通刷新不会重启它');
}
