import fs from 'node:fs';
const product=JSON.parse(fs.readFileSync(new URL('../../contracts/product.json',import.meta.url),'utf8'));
export const allowedOrigins=new Set(product.webOrigins||[]);
export function applyCors(req,res,{secure=true}={}){
 const origin=req.headers.origin;
 const sameOrigin=origin===(secure?'https://':'http://')+req.headers.host;
 if(origin&&!sameOrigin&&!allowedOrigins.has(origin)){res.writeHead(403,{'Content-Type':'application/json'});res.end(JSON.stringify({ok:false,error:'ORIGIN_DENIED'}));return true;}
 if(origin&&allowedOrigins.has(origin)){
  res.setHeader('Access-Control-Allow-Origin',origin);res.setHeader('Vary','Origin');
  res.setHeader('Access-Control-Expose-Headers','Content-Disposition, Content-Length, Content-Range, Accept-Ranges');
 }
 if(req.method==='OPTIONS'){
  if(!origin||!sameOrigin&&!allowedOrigins.has(origin)){res.writeHead(403);res.end();return true;}
  res.writeHead(204,{'Access-Control-Allow-Methods':'GET, HEAD, POST, PUT, PATCH, DELETE, OPTIONS','Access-Control-Allow-Headers':'Authorization, Content-Type, Accept, Range, X-Matrix-Client','Access-Control-Max-Age':'600'});res.end();return true;
 }
 return false;
}
export function trustedRequestOrigin(req,secure=true){return req.headers.origin===(secure?'https://':'http://')+req.headers.host||allowedOrigins.has(req.headers.origin);}
