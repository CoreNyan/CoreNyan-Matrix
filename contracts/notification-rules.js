export const RULE_LIMITS=Object.freeze({nodes:40,depth:5,pattern:512,text:32000,workerMs:1000,workers:2,bodyBytes:80000});
export const emptyRules=()=>({enabled:false,root:{op:'all',negate:false,children:[]}});
export const newCondition=()=>({op:'contains',field:'text',value:'',ignoreCase:true,negate:false});
export function validateRules(input){
 const fail=message=>{throw Object.assign(Error(message),{status:400});};
 if(!input||typeof input.enabled!=='boolean'||Object.keys(input).some(k=>!['enabled','root'].includes(k)))fail('通知规则格式无效');
 let count=0;
 function node(n,depth){
  if(!n||typeof n!=='object'||Array.isArray(n)||++count>RULE_LIMITS.nodes||depth>RULE_LIMITS.depth)fail('规则最多 40 项、5 层，请简化组合');
  if(typeof n.negate!=='boolean')fail('请选择规则是否取反');
  if(['all','any'].includes(n.op)){
   if(Object.keys(n).some(k=>!['op','negate','children'].includes(k))||!Array.isArray(n.children))fail('条件组格式无效');
   if(input.enabled&&!n.children.length)fail('启用前，请填写每个条件组');
   return {op:n.op,negate:n.negate,children:n.children.map(c=>node(c,depth+1))};
  }
  if(!['contains','regex'].includes(n.op)||!['text','title'].includes(n.field)||typeof n.value!=='string'||typeof n.ignoreCase!=='boolean'||Object.keys(n).some(k=>!['op','negate','field','value','ignoreCase'].includes(k)))fail('匹配条件格式无效');
  if(n.value.length>RULE_LIMITS.pattern||input.enabled&&!n.value.length)fail('匹配内容需为 1～512 个字符');
  if(n.op==='regex'&&n.value){try{new RegExp(n.value,n.ignoreCase?'iu':'u');}catch{fail('正则表达式格式无效，请检查括号或转义符');}}
  return {op:n.op,negate:n.negate,field:n.field,value:n.value,ignoreCase:n.ignoreCase};
 }
 return {enabled:input.enabled,root:node(input.root,1)};
}
// Run only inside the bounded worker, never on the UI/server event loop.
export function matchRules(rules,event){
 if(!rules.enabled)return true;
 function visit(n){let matched;
  if(n.op==='all')matched=n.children.every(visit);
  else if(n.op==='any')matched=n.children.some(visit);
  else {const value=String(event[n.field]||'').slice(0,RULE_LIMITS.text);matched=n.op==='regex'?new RegExp(n.value,n.ignoreCase?'iu':'u').test(value):n.ignoreCase?value.toLowerCase().includes(n.value.toLowerCase()):value.includes(n.value);}
  return n.negate?!matched:matched;
 }
 return visit(rules.root);
}
