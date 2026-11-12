import { termText, termHtml, termTextTemplate, termHtmlTemplate } from '../../contracts/terminology.js';
import { open, readdir } from 'node:fs/promises';
import path from 'node:path';

export const LOG_SOURCE = Object.freeze({ brain: 'corenyan-brain', file: 'corenyan-brain-file', maxBytes: 65536, timeout: 4000 });

async function readTail(file, lines) {
  const handle = await open(file, 'r');
  try {
    const stat = await handle.stat();
    const start = Math.max(0, stat.size - LOG_SOURCE.maxBytes);
    const buffer = Buffer.alloc(Math.min(stat.size, LOG_SOURCE.maxBytes));
    const { bytesRead } = await handle.read(buffer, 0, buffer.length, start);
    let text = buffer.subarray(0, bytesRead).toString('utf8');
    if (start) text = text.slice(text.indexOf('\n') + 1);
    return text.trimEnd().split(/\r?\n/).slice(-lines).join('\n');
  } finally { await handle.close(); }
}

export async function readNeuralLog(organId, lines, { organs, brainRoot, exec, tail = readTail }) {
  const count = Math.max(20, Math.min(500, Number(lines) || 120));
  if (organId !== LOG_SOURCE.file && !organs.some(organ => organ.id === organId)) throw Error('未知日志模块');
  const result = (source, text, status = 'ok') => ({ organId, source, text, status });
  const fileLog = async fallback => {
    try {
      const names=(await readdir(path.join(brainRoot,'logs'))).filter(n=>/^\d{4}-\d{2}-\d{2}(?:-\d+)?\.jsonl$/.test(n)).sort();
      if(!names.length)throw Error('LOG_UNAVAILABLE');
      const file=names.at(-1),raw=await tail(path.join(brainRoot,'logs',file),count);
      const colors={error:31,warn:33,info:33,success:92};
      const text=raw.split('\n').map(line=>{try{const e=JSON.parse(line);return `\x1b[${colors[e.level]||33}m[${e.time}] [${e.module}] ${e.message}\x1b[0m`;}catch{return line;}}).join('\n');
      return result('brain/logs/'+file, `${fallback?'[WARN] 容器日志不可用，显示本地日志。\n':''}${text}`);
    } catch { return result('brain/logs', '[WARN] 暂无可读取的本地日志。', 'unavailable'); }
  };
  if (organId === LOG_SOURCE.file) return fileLog(false);
  const layer=organs.find(o=>o.id===organId);
  const container=layer?.containerName||organId;
  if(layer?.kind==='directory')return result('directory','[INFO] 文件层没有容器日志。','unavailable');
  if(!/^[a-zA-Z0-9][a-zA-Z0-9_-]{0,79}$/.test(container))throw Error('容器名无效');
  try {
    // Merge at the process boundary: concatenating separately captured streams
    // moves every stderr warning after stdout and breaks chronological order.
    const { stdout } = await exec(`docker logs --tail ${count} ${container} 2>&1`, { timeout: LOG_SOURCE.timeout });
    return result(`docker:${organId}`, (stdout || '').trim() || `[INFO] ${organId} 当前没有日志`);
  } catch {
    if (organId === LOG_SOURCE.brain) return fileLog(true);
    return result(`docker:${organId}`, `[WARN] ${organId} 日志不可用：请检查 Docker 服务及该容器是否存在。`, 'unavailable');
  }
}
