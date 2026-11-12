import {emptyRules,validateRules} from './notification-rules.js';
export const PRESET_LIMITS=Object.freeze({count:12,name:60,bodyBytes:350000});
export const emptyRuleConfig=()=>({presets:[],channels:{system:{mode:'all',combine:'any',ids:[]},email:{mode:'all',combine:'any',ids:[]}}});
export function migrateRuleConfig(row){
 if(row?.ruleConfig)return structuredClone(row.ruleConfig);
 const result=emptyRuleConfig(),rules=row?.rules;
 if(rules&&(rules.enabled||rules.root?.children?.length||rules.root?.value)){
  result.presets.push({id:'legacy',name:'原有规则',rules:structuredClone(rules)});
  for(const channel of Object.values(result.channels)){channel.ids=['legacy'];channel.mode=rules.enabled?'selected':'all';}
 }
 return result;
}
export function validateRuleConfig(input){
 const fail=message=>{throw Object.assign(Error(message),{status:400});};
 if(!input||Object.keys(input).some(k=>!['presets','channels'].includes(k))||!Array.isArray(input.presets)||input.presets.length>PRESET_LIMITS.count)fail('条件预设最多保存 12 个');
 const ids=new Set(),names=new Set();
 const presets=input.presets.map(p=>{
  if(!p||Object.keys(p).some(k=>!['id','name','rules'].includes(k))||typeof p.id!=='string'||! /^[a-z0-9-]{1,64}$/.test(p.id)||ids.has(p.id))fail('预设 ID 无效或重复');
  if(typeof p.name!=='string'||!p.name.trim()||p.name.length>PRESET_LIMITS.name||names.has(p.name.trim().toLowerCase()))fail('预设名称需为 1～60 个字符，且不能重复');
  ids.add(p.id);names.add(p.name.trim().toLowerCase());return {id:p.id,name:p.name.trim(),rules:validateRules(p.rules??emptyRules())};
 });
 if(!input.channels||Object.keys(input.channels).some(k=>!['system','email'].includes(k)))fail('通知渠道配置无效');
 const channels={};
 for(const key of ['system','email']){
  const c=input.channels[key];if(!c||Object.keys(c).some(k=>!['mode','combine','ids'].includes(k))||!['all','selected'].includes(c.mode)||!['any','all'].includes(c.combine)||!Array.isArray(c.ids)||c.ids.length>PRESET_LIMITS.count||new Set(c.ids).size!==c.ids.length||c.ids.some(id=>!ids.has(id)))fail('通知引用了不存在的条件预设');
  channels[key]={mode:c.mode,combine:c.combine,ids:[...c.ids]};
 }
 return {presets,channels};
}
