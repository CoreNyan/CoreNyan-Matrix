import { IMAGE_TYPES, isBinaryFile } from '../../contracts/file-types.js';
import { TRASH_PREVIEW } from '../../contracts/constants.js';
import { termText, termHtml, termTextTemplate, termHtmlTemplate } from '../../contracts/terminology.js';
import {chatPrivatePath} from './chat-private-path.mjs';
import fs from 'node:fs';
import path from 'node:path';
import { randomUUID } from 'node:crypto';

export const TRASH_DIR = '.corenyan-trash';
const ID = /^[0-9a-f-]{36}$/;
// Reject symlink/junction traversal and reserved paths before any filesystem mutation.
export function checkedPath(root, relative, reserved = false) {
  const base = fs.realpathSync(root);
  const target = path.resolve(base, relative);
  if(chatPrivatePath(target))throw Error('CHAT 私有数据只能通过聊天接口访问');
  if (target === base || !target.startsWith(base + path.sep)) throw Error('禁止操作根目录或越界路径');
  const segments = path.relative(base, target).split(path.sep);
  if (!reserved && segments.some(segment => segment.toLowerCase() === TRASH_DIR)) throw Error(termText("{{file.trash.zh}}只能通过专用接口操作"));
  let current = base;
  for (const segment of segments) {
    current = path.join(current, segment);
    try { if (fs.lstatSync(current).isSymbolicLink()) throw Error('禁止通过符号链接操作文件'); }
    catch (error) { if (error.code !== 'ENOENT') throw error; }
  }
  return target;
}

function entryPath(root, id) {
  if (!ID.test(id)) throw Error(termText("非法{{file.trash.zh}}记录"));
  return checkedPath(root, `${TRASH_DIR}/${id}`, true);
}

export function trashList(root) {
  if (!fs.existsSync(root)) return [];
  const bin = checkedPath(root, TRASH_DIR, true);
  if (!fs.existsSync(bin)) return [];
  return fs.readdirSync(bin).filter(id => ID.test(id)).flatMap(id => {
    const entry = entryPath(root, id);
    if (!fs.existsSync(path.join(entry, 'payload'))) return [];
    const meta = JSON.parse(fs.readFileSync(path.join(entry, 'meta.json'), 'utf8'));
    return [{ ...meta, id }];
  }).sort((a, b) => b.deletedAt - a.deletedAt);
}

export function trashMove(root, relative) {
  const target = checkedPath(root, relative);
  const stat = fs.lstatSync(target);
  const id = randomUUID(), entry = entryPath(root, id);
  fs.mkdirSync(entry, { recursive: true });
  const meta = { id, path: path.relative(fs.realpathSync(root), target).replace(/\\/g, '/'), isDir: stat.isDirectory(), size: stat.size, deletedAt: Date.now() };
  // Metadata is durable before the same-volume atomic rename; no automatic purge.
  fs.writeFileSync(path.join(entry, 'meta.json'), JSON.stringify(meta), { flag: 'wx' });
  fs.renameSync(target, path.join(entry, 'payload'));
  return meta;
}

export function trashRestore(root, id) {
  const entry = entryPath(root, id);
  const meta = JSON.parse(fs.readFileSync(path.join(entry, 'meta.json'), 'utf8'));
  const destination = checkedPath(root, meta.path);
  if (fs.existsSync(destination)) throw Error('原路径已存在同名文件，请先重命名或移动后再还原');
  const payload = checkedPath(root, `${TRASH_DIR}/${id}/payload`, true);
  fs.mkdirSync(path.dirname(destination), { recursive: true });
  fs.renameSync(payload, destination);
  fs.unlinkSync(path.join(entry, 'meta.json'));
  fs.rmdirSync(entry);
  return meta;
}

export function trashPurge(root, ids) {
  // Only explicitly reviewed IDs; items added after the confirmation are retained.
  const entries = ids.map(id => entryPath(root, id));
  for (const entry of entries) fs.rmSync(entry, { recursive: true, force: true });
  return entries.length;
}

export function trashPayload(root, id, relative = '') {
  const entry = entryPath(root, id);
  const metaFile = checkedPath(root, `${TRASH_DIR}/${id}/meta.json`, true);
  const meta = JSON.parse(fs.readFileSync(metaFile, 'utf8'));
  const payload = checkedPath(root, `${TRASH_DIR}/${id}/payload`, true);
  if (typeof relative !== 'string' || path.isAbsolute(relative) || relative.split(/[\\/]/).includes('..')) throw Error('回收站预览路径越界');
  const target = relative ? checkedPath(payload, relative, true) : payload;
  const stat = fs.lstatSync(target);
  if (!stat.isDirectory() && !stat.isFile()) throw Error('不支持预览此文件类型');
  return { target, stat, meta, relative, name: relative || meta.path };
}

export async function trashRead(root, id, relative = '') {
  const { target, stat, meta, name } = trashPayload(root, id, relative);
  const result = { id, path: meta.path, relative, name, size: stat.size, deletedAt: meta.deletedAt };
  if (stat.isDirectory()) {
    const entries = await fs.promises.readdir(target, { withFileTypes: true });
    const visible = entries.filter(item => !item.isSymbolicLink() && item.name !== TRASH_DIR)
      .sort((a,b) => Number(b.isDirectory()) - Number(a.isDirectory()) || a.name.localeCompare(b.name));
    return { ...result, kind: 'directory', truncated: visible.length > TRASH_PREVIEW.maxEntries,
      entries: visible.slice(0, TRASH_PREVIEW.maxEntries).map(item => ({ name: item.name, isDir: item.isDirectory(),
        path: relative ? relative + '/' + item.name : item.name })) };
  }
  const extension = path.extname(name).toLowerCase();
  if (IMAGE_TYPES[extension]) return { ...result, kind: 'image', mime: IMAGE_TYPES[extension] };
  if (isBinaryFile(name) || /\.(docx?|xlsx?|pptx?|7z|rar|sqlite|db)$/i.test(name)) return { ...result, kind: 'binary' };
  const file = await fs.promises.open(target, 'r');
  try {
    const buffer = Buffer.alloc(Math.min(stat.size, TRASH_PREVIEW.maxTextBytes));
    const { bytesRead } = await file.read(buffer, 0, buffer.length, 0);
    const bytes = buffer.subarray(0, bytesRead);
    if (bytes.includes(0)) return { ...result, kind: 'binary' };
    const truncated = stat.size > bytesRead;
    let content;
    try { content = new TextDecoder('utf-8', { fatal: true }).decode(bytes, { stream: truncated }); }
    catch { return { ...result, kind: 'binary', note: '不是 UTF-8 文本，无法安全预览。' }; }
    return { ...result, kind: 'text', content, truncated };
  } finally { await file.close(); }
}
