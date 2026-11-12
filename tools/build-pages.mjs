import fs from 'node:fs';
import path from 'node:path';
import {fileURLToPath} from 'node:url';
import {ENTITY,ENTITY_PREVIEW} from '../contracts/constants.js';
const root=path.resolve(path.dirname(fileURLToPath(import.meta.url)),'..'),output=path.join(root,'.build/pages');
if(output!==path.join(root,'.build','pages'))throw Error('Invalid build output');
fs.rmSync(output,{recursive:true,force:true});
fs.mkdirSync(output,{recursive:true});
// Explicit public inputs only. Backend config, uploads and server credentials never enter this tree.
for(const [source,destination] of [['frontend/web',''],['contracts','contracts']]){
 const copy=(src,dst)=>{fs.mkdirSync(dst,{recursive:true});for(const e of fs.readdirSync(src,{withFileTypes:true})){if(e.isSymbolicLink())throw Error('Symlink excluded from Pages: '+e.name);if(e.isDirectory()&&path.basename(src)==='assets'&&/^entity/.test(e.name)&&![path.basename(ENTITY.assetRoot),path.basename(ENTITY_PREVIEW.root)].includes(e.name))continue;const a=path.join(src,e.name),b=path.join(dst,e.name);if(e.isDirectory())copy(a,b);else if(!/\.(?:crt|pem|key|bak|log|tmp)$/.test(e.name))fs.copyFileSync(a,b);}};
 copy(path.join(root,source),path.join(output,destination));
}
const product=JSON.parse(fs.readFileSync(path.join(root,'contracts/product.json')));
fs.writeFileSync(path.join(output,'CNAME'),new URL(product.webUrl).hostname+'\n');fs.writeFileSync(path.join(output,'.nojekyll'),'');
for(const route of ['login','VITALS','LAYERS','CORTEX','SYNAPSE','ENTITY','CHAT']){const dir=path.join(output,route);fs.mkdirSync(dir,{recursive:true});fs.copyFileSync(path.join(output,route==='login'?'login.html':'index.html'),path.join(dir,'index.html'));}
fs.copyFileSync(path.join(output,'index.html'),path.join(output,'404.html'));
console.log('Pages site built from frontend/web + public contracts');
