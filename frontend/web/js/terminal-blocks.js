import {TERMINAL_BLOCKS} from './constants.js';
const strip=line=>line.replace(/\x1b\[[0-9;]*m/g,'');
export function terminalBlockSegments(text){
 const lines=String(text||'').split(/\r?\n/),segments=[];
 for(let i=0;i<lines.length;){
  const clean=strip(lines[i]);
  if(!/^[ ▀▄█]+$/.test(clean)||!/[▀▄█]/.test(clean)){segments.push({text:lines[i++]});continue;}
  const rows=[];let j=i;
  while(j<lines.length&&/^[ ▀▄█]+$/.test(strip(lines[j]))&&strip(lines[j]).length===clean.length){rows.push(strip(lines[j++]));}
  if(rows.length>=TERMINAL_BLOCKS.minRows&&clean.length>=TERMINAL_BLOCKS.minColumns&&clean.length<=TERMINAL_BLOCKS.maxColumns&&rows.length<=TERMINAL_BLOCKS.maxRows){
   segments.push({rows});i=j;
  }else segments.push({text:lines[i++]});
 }
 // QQ login logs are append-only, but only the latest live code is scannable.
 // A partial tail can begin inside a QR block; discard that block once a newer
 // QQ login state is present too.
 let latest=-1;
 for(let i=0;i<segments.length;i++)if(segments[i].text?.startsWith('[QQ LOGIN]')&&/请用|已过期|登录成功/.test(segments[i].text))latest=i;
 if(latest>=0)return segments.filter((segment,i)=>!segment.rows||i>latest);
 return segments;
}
export function blockPixels(rows){
 const width=rows[0].length;
 return rows.flatMap(row=>[Array.from(row,c=>c==='█'||c==='▀'?1:0),Array.from(row,c=>c==='█'||c==='▄'?1:0)]).map(row=>row.slice(0,width));
}
export function renderTerminalBlocks(rows){
 const pixels=blockPixels(rows),pad=TERMINAL_BLOCKS.quietZone,width=rows[0].length+pad*2,height=pixels.length+pad*2;
 let cells='';
 for(let y=0;y<pixels.length;y++)for(let x=0;x<pixels[y].length;x++)if(!pixels[y][x])cells+=`M${x+pad} ${y+pad}h1v1h-1z`;
 return `<div class="terminal-block-image"><svg xmlns="http://www.w3.org/2000/svg" role="img" aria-label="日志中的二维码" viewBox="0 0 ${width} ${height}" width="${width*TERMINAL_BLOCKS.scale}" height="${height*TERMINAL_BLOCKS.scale}" shape-rendering="crispEdges"><rect width="${width}" height="${height}" fill="#fff"/><path d="${cells}" fill="#000"/></svg></div>`;
}
