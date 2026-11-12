import fs from 'node:fs';
import path from 'node:path';
import {buildGeometry} from './entity-geometry.mjs';
import {ENTITY,ENTITY_MODELS,ENTITY_FLEET} from '../frontend/web/js/constants.js';
const out=path.resolve(process.argv[2]||'frontend/web/assets/entity');
fs.mkdirSync(out,{recursive:true});
const manifest={version:Number(process.argv[3]||ENTITY.assetVersion),models:{}};
for(const kind of Object.keys(ENTITY_MODELS)){
 const m=buildGeometry(kind);
 const scale=3/32767,packed=Buffer.alloc(16+m.count*10);
 packed.write('CNPC',0);packed.writeUInt32LE(1,4);packed.writeUInt32LE(m.count,8);packed.writeFloatLE(scale,12);
 for(let i=0;i<m.count;i++){const src=i*7,dst=16+i*10;for(let j=0;j<3;j++)packed.writeInt16LE(Math.round(m.points[src+j]/scale),dst+j*2);for(let j=0;j<3;j++)packed.writeInt8(Math.round(m.points[src+3+j]*127),dst+6+j);packed.writeUInt8(Math.min(255,Math.round(m.points[src+6]*127)),dst+9);}
 fs.writeFileSync(path.join(out,kind+'.bin'),packed);
 manifest.models[kind]={count:m.count,spacing:m.spacing,surfaceCount:m.surfaceCount,bounds:m.bounds,equipment:{escorts:ENTITY_FLEET[kind].escorts.length,funnels:ENTITY_FLEET[kind].funnels.length,turrets:ENTITY_FLEET[kind].turrets.length}};
 console.log(kind,m.count,'points;',m.surfaceCount,'faces;',m.spacing.toFixed(4),'spacing');
}
fs.writeFileSync(path.join(out,'manifest.json'),JSON.stringify(manifest,null,2));
