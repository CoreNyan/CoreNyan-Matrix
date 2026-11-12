// Shared by the authenticated server and browser. Action IDs are protocol constants.
export const PREFERENCES = Object.freeze({api:'/api/preferences',version:1,saveDelay:350,pollMs:30000,chatPollMs:3000,chatBackgroundPollMs:10000,toastMs:7000});
export const SHORTCUTS = Object.freeze([
 ...[['send','发送消息','Enter'],['newline','换行','Shift+Enter'],['copy','复制文字','Mod+C'],['cut','剪切文字','Mod+X'],['paste','粘贴文字','Mod+V'],['selectAll','全选文字','Mod+A'],['undo','撤销','Mod+Z'],['redo','重做','Mod+Shift+Z']].map(([key,label,defaultKey])=>({id:'chat.'+key,scope:'chat',group:'聊天消息输入',label,defaultKey})),
 ...[['copy','复制对话','Mod+C'],['paste','粘贴对话','Mod+V'],['rename','重命名','F2'],['delete','删除对话','Delete']].map(([key,label,defaultKey])=>({id:'threads.'+key,scope:'threads',group:'聊天对话列表',label,defaultKey})),
 ...[['selectAll','全选','Mod+A'],['copy','复制','Mod+C'],['cut','剪切','Mod+X'],['paste','粘贴','Mod+V'],['delete','移入回收站','Delete'],['rename','重命名','F2'],['open','打开','Enter'],['up','上一项','ArrowUp'],['down','下一项','ArrowDown']].map(([key,label,defaultKey])=>({id:'files.'+key,scope:'files',group:'文件管理',label,defaultKey})),
 ...[['save','保存','Mod+S'],['find','搜索','Mod+F'],['replace','替换','Mod+H'],['replaceAll','全部替换','Mod+Shift+H'],['fold','折叠 / 展开','Mod+Q'],['copy','复制','Mod+C'],['cut','剪切','Mod+X'],['paste','粘贴','Mod+V'],['selectAll','全选','Mod+A'],['undo','撤销','Mod+Z'],['redo','重做','Mod+Shift+Z']].map(([key,label,defaultKey])=>({id:'editor.'+key,scope:'editor',group:'文本编辑器',label,defaultKey})),
 {id:'workspace.search',scope:'workspace',group:'全局文件搜索',label:'搜索文件与内容',defaultKey:'Mod+Shift+F'},
 ...[['previous','上一张','ArrowLeft'],['next','下一张','ArrowRight']].map(([key,label,defaultKey])=>({id:'images.'+key,scope:'images',group:'图片查看',label,defaultKey})),
 ...[['left','向左旋转','ArrowLeft'],['right','向右旋转','ArrowRight'],['up','向上旋转','ArrowUp'],['down','向下旋转','ArrowDown'],['zoomIn','放大','='],['zoomOut','缩小','-']].map(([key,label,defaultKey])=>({id:'entity.'+key,scope:'entity',group:'三维模型',label,defaultKey}))
]);
export const DEFAULT_PREFERENCES = Object.freeze({displayScale:'auto',textSize:'standard',motion:true,autoPoll:true,notifications:true,shortcuts:{}});
export function normalizeChord(value){
 if(typeof value!=='string'||value.length>50)throw Error('快捷键格式无效');
 if(value==='')return '';
 const pieces=value.split('+'),key=pieces.pop(),mods=pieces;
 if(new Set(mods).size!==mods.length||mods.some(x=>!['Mod','Alt','Shift'].includes(x))||!(/^[A-Z0-9]$/.test(key)||/^(F([1-9]|1[0-2])|Enter|Delete|Backspace|Arrow(Up|Down|Left|Right)|Home|End|PageUp|PageDown|Space|=|-)$/ .test(key)))throw Error('不支持这个组合键');
 if(!mods.length&&/^[A-Z0-9]$/.test(key))throw Error('字母与数字快捷键需要组合键');
 const chord=['Mod','Alt','Shift'].filter(x=>mods.includes(x)).concat(key).join('+');
 if(['Mod+W','Mod+T','Mod+N','Mod+R','Mod+L','Mod+Shift+T','Mod+Shift+N','Alt+F4','F5','F11','F12'].includes(chord))throw Error('这个组合由浏览器或系统保留');
 return chord;
}
export function validatePreferences(input){
 if(!input||typeof input!=='object'||Array.isArray(input))throw Error('偏好格式无效');
 if(Object.keys(input).some(k=>!Object.hasOwn(DEFAULT_PREFERENCES,k)))throw Error('未知偏好字段');
 const p={...DEFAULT_PREFERENCES,...input};
 if(!['auto','100','110','120','125','150'].includes(p.displayScale)||!['standard','large'].includes(p.textSize)||typeof p.motion!=='boolean'||typeof p.autoPoll!=='boolean'||typeof p.notifications!=='boolean')throw Error('偏好值无效');
 if(!p.shortcuts||typeof p.shortcuts!=='object'||Array.isArray(p.shortcuts))throw Error('快捷键格式无效');
 const shortcuts={};for(const [id,value] of Object.entries(p.shortcuts)){if(!SHORTCUTS.some(a=>a.id===id))throw Error('未知快捷键');shortcuts[id]=normalizeChord(value);}
 const used=new Map();for(const a of SHORTCUTS){const value=shortcuts[a.id]??a.defaultKey;if(!value)continue;const key=a.scope+':'+value;if(used.has(key))throw Error(a.label+' 与 '+used.get(key)+' 的快捷键冲突');used.set(key,a.label);}
 const search=shortcuts['workspace.search']??'Mod+Shift+F';if(search&&SHORTCUTS.some(a=>['editor','files'].includes(a.scope)&&(shortcuts[a.id]??a.defaultKey)===search))throw Error('全局搜索与文件管理快捷键冲突');
 return {...p,shortcuts};
}
