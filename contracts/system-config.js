export const SYSTEM_CONFIG=Object.freeze({
 id:'system-config',label:'系统配置',scope:'shared_src',directory:'shared',
 entries:Object.freeze([
  {label:'全局模块与身份',description:'模块开关、管理身份和通信参数',scope:'shared_src',file:'architecture.json'},
  {label:'工具注册表',description:'工具归属与读写属性',scope:'shared_src',file:'tool-registry.json'},
  {label:'Gateway 执行配置',description:'允许的系统命令、媒体限制和服务探测',scope:'gateway_src',file:'runtime-policy.json'},
  {label:'Gateway 文案',description:'网关运行提示与回复文案',scope:'gateway_src',file:'lang/runtime.yml'},
  {label:'Brain 文案',description:'大脑运行提示与回复文案',scope:'brain_src',file:'lang/runtime.yml'},
  {label:'共享运行时目录',description:'通信契约、日志与通用基础代码',scope:'shared_src',file:''}
 ])
});
