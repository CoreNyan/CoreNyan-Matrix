import {PRESET_EDITOR} from '../../contracts/constants.js';
const limits=PRESET_EDITOR.discovery;
const fail=(message,status=400)=>{throw Object.assign(Error(message),{status});};
let active=0;
export function modelsEndpoint(value){
 let url;try{url=new URL(value);}catch{fail('请先填写有效的模型端点。');}
 if(!['http:','https:'].includes(url.protocol)||url.username||url.password)fail('模型端点只支持不含账号密码的 HTTP 或 HTTPS 地址。');
 url.hash='';url.search='';
 let pathname=url.pathname.replace(/\/+$/,'').replace(/\/(chat\/completions|completions|responses|images\/(generations|edits)|messages)$/i,'');
 if(!pathname)pathname='/v1';
 url.pathname=pathname.endsWith('/models')?pathname:pathname+'/models';return url;
}
export async function discoverPresetModels(input,store,{fetchFn=fetch}={}){
 if(!input||typeof input.base_url!=='string'||input.base_url.length>4096)fail('请先填写模型端点。');
 let url=modelsEndpoint(input.base_url),key=input.api_key;
 if(key===null){key=input.id?store.get(input.id).settings.api_key:'';}
 if(typeof key!=='string'||key.length>8192||/[\r\n]/.test(key))fail('API Key 格式不正确。');
 if(active>=limits.maxConcurrent)fail('正在获取其他模型列表，请稍后再试。',429);
 const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),limits.timeoutMs);active++;
 try{
  let response;
  for(let redirects=0;redirects<=limits.maxRedirects;redirects++){
   response=await fetchFn(url,{method:'GET',headers:{Accept:'application/json',...(key?{Authorization:'Bearer '+key}:{})},redirect:'manual',signal:controller.signal});
   if(![301,302,303,307,308].includes(response.status))break;
   const location=response.headers.get('location');await response.body?.cancel();
   if(!location)fail('模型接口返回了无效跳转。',502);
   const next=new URL(location,url),upgrade=url.protocol==='http:'&&next.protocol==='https:'&&next.hostname===url.hostname&&(!url.port||url.port==='80')&&(!next.port||next.port==='443');
   if(next.username||next.password||next.origin!==url.origin&&!upgrade)fail('模型接口跳转到了其他地址，请直接填写最终 HTTPS 端点后重试。',502);
   if(redirects===limits.maxRedirects)fail('模型接口跳转次数过多，请检查端点。',502);
   url=next;
  }
  if(!response.ok){await response.body?.cancel();const hint=[401,403].includes(response.status)?'请检查 API Key 和渠道权限。':response.status===404?'该端点未提供模型列表，可继续手动填写模型 ID。':'请稍后重试或手动填写模型 ID。';fail('获取模型列表失败（HTTP '+response.status+'），'+hint,502);}
  if(Number(response.headers.get('content-length'))>limits.maxBytes){await response.body?.cancel();fail('模型列表响应过大。',502);}
  const reader=response.body?.getReader();if(!reader)fail('模型接口返回了空响应。',502);
  const chunks=[];let size=0;
  while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limits.maxBytes){await reader.cancel();fail('模型列表响应过大。',502);}chunks.push(value);}
  let data;try{data=JSON.parse(Buffer.concat(chunks).toString('utf8'));}catch{fail('模型接口未返回有效 JSON，请检查端点是否为 API 地址。',502);}
  const items=Array.isArray(data)?data:data?.data;
  if(!Array.isArray(items))fail('该端点未返回兼容的模型列表，可继续手动填写模型 ID。',502);
  const models=[...new Set(items.map(item=>typeof item==='string'?item:item?.id).filter(id=>typeof id==='string'&&id.trim()&&id.length<=200).map(id=>id.trim()))].slice(0,limits.maxItems);
  return {models};
 }catch(error){if(error.status)throw error;if(controller.signal.aborted)fail('获取模型列表超时，请稍后重试。',504);fail('无法连接模型接口，请检查端点和网络后重试。',502);}
 finally{clearTimeout(timer);active--;}
}
