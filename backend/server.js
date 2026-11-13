import {discoverPresetModels} from './scripts/preset-model-discovery.mjs';
import {createApiRecords} from './scripts/api-records.mjs';
import {createSounds} from './scripts/sounds.mjs';
import './scripts/runtime-log.mjs';
import {createAccountStore} from './scripts/account-store.mjs';
import {createNotifications} from './scripts/notifications.mjs';
import {readOnebotLogin} from './scripts/onebot-login.mjs';
import {chatPrivatePath} from './scripts/chat-private-path.mjs';
import {createChatApi} from './scripts/chat-api.mjs';
import {moveFiles} from './scripts/file-move.mjs';
import {createAuth} from './scripts/web-auth.mjs';
import {trustedRequestOrigin} from './scripts/cors.mjs';
import {runOrganControl} from './scripts/organ-control.mjs';
import {createRequire} from 'node:module';
import {createMetricsSampler} from './scripts/container-metrics.mjs';
import {containerStarts} from './scripts/container-starts.mjs';
import {createLayerRegistry} from './scripts/layer-registry.mjs';
import {searchFiles} from './scripts/file-search.mjs';
import {minecraftNames} from './scripts/bond-summary.mjs';
import {randomUUID} from 'node:crypto';
import { TRASH_PREVIEW } from '../contracts/constants.js';
import { IMAGE_TYPES, isBinaryFile } from '../contracts/file-types.js';
import { termText, termHtml, termTextTemplate, termHtmlTemplate } from '../contracts/terminology.js';
import { TRASH_DIR, checkedPath, trashList, trashMove, trashRestore, trashPurge, trashPayload, trashRead } from './scripts/recycle-bin.mjs';
import { readNeuralLog } from './scripts/log-source.mjs';
import http from 'http';
import fs from 'fs';
import path from 'path';
import os from 'os';
import { exec } from 'child_process';
import { promisify } from 'util';
import { fileURLToPath } from 'url';

const execAsync = promisify(exec);
const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

const configPath = path.join(__dirname, 'config', 'config.json');
const config = fs.existsSync(configPath) ? JSON.parse(fs.readFileSync(configPath, 'utf8')) : {};

function resolveRoot(configuredPath, fallbackRel) {
  const candidates = [
    configuredPath ? path.resolve(__dirname, configuredPath) : null,
    fallbackRel ? path.resolve(__dirname, fallbackRel) : null,
    fallbackRel ? path.resolve('/opt/corenyan', path.basename(fallbackRel)) : null,
    fallbackRel ? path.resolve('/opt/corenyan', path.basename(fallbackRel).toLowerCase()) : null
  ].filter(Boolean);
  for (const c of candidates) {
    if (fs.existsSync(c)) return c;
  }
  return candidates[0] || __dirname;
}

const BRAIN_ROOT = resolveRoot(config.paths?.brainRoot, '../../corenyan-brain');
const apiRecords=createApiRecords(path.join(BRAIN_ROOT,'data/api-records'));
const GATEWAY_ROOT = resolveRoot(config.paths?.gatewayRoot, '../../corenyan-gateway');
const WEB_ROOT = path.resolve(__dirname,'..');
const REDIS_ROOT = resolveRoot(config.paths?.redisRoot, '../../Redis');
const ONEBOT_ROOT = config.paths?.onebotRoot || path.join(path.dirname(WEB_ROOT),'snowluma-data');
const MAX_BODY_BYTES = 16 * 1024 * 1024;
const require=createRequire(import.meta.url);
const {createConfigReader}=require(path.join(BRAIN_ROOT,'src/config/model-presets.cjs'));
const modelReader=createConfigReader(BRAIN_ROOT);
const presetStore=modelReader.store;


// CPU usage delta sampling
let lastCpuInfo = os.cpus();
function sampleCpuPercent() {
  const current = os.cpus();
  let idleDiff = 0;
  let totalDiff = 0;
  for (let i = 0; i < current.length; i++) {
    const prev = lastCpuInfo[i] || current[i];
    const prevTotal = Object.values(prev.times).reduce((a, b) => a + b, 0);
    const currTotal = Object.values(current[i].times).reduce((a, b) => a + b, 0);
    totalDiff += currTotal - prevTotal;
    idleDiff += current[i].times.idle - prev.times.idle;
  }
  lastCpuInfo = current;
  if (totalDiff <= 0) return 8;
  return Math.max(1, Math.min(100, Math.round(((totalDiff - idleDiff) / totalDiff) * 100)));
}

// Network rx/tx bytes delta sampling
let lastNetSample = { time: Date.now(), rx: 0, tx: 0 };
function sampleNetworkRate() {
  try {
    if (fs.existsSync('/proc/net/dev')) {
      const raw = fs.readFileSync('/proc/net/dev', 'utf8');
      let rx = 0, tx = 0;
      for (const line of raw.split('\n').slice(2)) {
        const parts = line.trim().split(/[:\s]+/);
        if (parts.length > 9 && parts[0] !== 'lo') {
          rx += Number(parts[1]) || 0;
          tx += Number(parts[9]) || 0;
        }
      }
      const now = Date.now();
      const dt = Math.max(0.5, (now - lastNetSample.time) / 1000);
      const rxRate = lastNetSample.rx > 0 ? Math.max(0, Math.round((rx - lastNetSample.rx) / dt)) : 0;
      const txRate = lastNetSample.tx > 0 ? Math.max(0, Math.round((tx - lastNetSample.tx) / dt)) : 0;
      lastNetSample = { time: now, rx, tx };
      return { rxBytesPerSec: rxRate, txBytesPerSec: txRate, totalRx: rx, totalTx: tx };
    }
  } catch {}
  return { rxBytesPerSec: 2048, txBytesPerSec: 1024, totalRx: 0, totalTx: 0 };
}

// Disk usage sampling
async function getDiskUsage() {
  try {
    if (process.platform !== 'win32') {
      const { stdout } = await execAsync('df -B1 / | tail -n 1', { timeout: 2500 });
      const parts = stdout.trim().split(/\s+/);
      if (parts.length >= 5) {
        const total = Number(parts[1]) || 1;
        const used = Number(parts[2]) || 0;
        return { total, used, percent: Math.round((used / total) * 100) };
      }
    } else {
      const stats = fs.statfsSync(__dirname);
      const total = stats.bsize * stats.blocks;
      const free = stats.bsize * stats.bfree;
      const used = total - free;
      return { total, used, percent: Math.round((used / Math.max(1, total)) * 100) };
    }
  } catch {}
  return { total: 40 * 1024 * 1024 * 1024, used: 14 * 1024 * 1024 * 1024, percent: 35 };
}

function parseBondSummary(fileId, rawObj) {
  const p = rawObj.profile || rawObj || {};
  const identities = p.identities || {};
  const qqSet = new Set();
  if (p.qq) (Array.isArray(p.qq) ? p.qq : [p.qq]).forEach(x => x && qqSet.add(String(x)));
  if (Array.isArray(identities.qq)) identities.qq.forEach(x => x && qqSet.add(String(x)));
  if (Array.isArray(p.migration?.legacyQQ)) p.migration.legacyQQ.forEach(x => x && qqSet.add(String(x)));
  if (Array.isArray(rawObj.aliases)) {
    rawObj.aliases.forEach(a => {
      const m = String(a).match(/^QQ_(\d+)$/i) || String(a).match(/^qq:(\d+)$/i);
      if (m) qqSet.add(m[1]);
    });
  }

  const mcNames = minecraftNames(p, rawObj.aliases || []);

  return {
    id: fileId,
    name: p.displayName || p.name || p.nickname || p.mcName || fileId,
    nickname: p.nickname || null,
    affection: Math.round((Number(p.affection) || 0) * 100) / 100,
    familiarity: Math.round((Number(p.familiarity || p.relationship?.weight) || 0) * 100) / 100,
    impression: p.impression || '未知个体',
    qqList: [...qqSet],
    playerNames: mcNames,
    mcNames,
    uuid: p.uuid || identities.playerUuid || null,
    accountId: identities.accountId || null
  };
}

function getCoreNyanBioState() {
  const lifeFile = path.join(BRAIN_ROOT, 'life_state.json');
  const brainCfgFile = path.join(BRAIN_ROOT, 'config.json');
  const affDir = path.join(BRAIN_ROOT, 'affections');
  const genDir = path.join(BRAIN_ROOT, 'images', 'generated');
  const memDir = path.join(BRAIN_ROOT, 'memory-vault');
  const skillDir = path.join(BRAIN_ROOT, 'skills');

  let life = {
    energy: 88,
    mood: 82,
    mode: 'SURFING',
    modeEnteredAt: Date.now() - 3600000,
    lastHeartbeat: Date.now(),
    recentLogs: []
  };
  try {
    if (fs.existsSync(lifeFile)) {
      life = { ...life, ...JSON.parse(fs.readFileSync(lifeFile, 'utf8')) };
    }
  } catch {}

  life.recentLogs = [];
  try { const thoughts = JSON.parse(fs.readFileSync(path.join(BRAIN_ROOT, 'data', 'recent-thoughts.json'), 'utf8')); if (Array.isArray(thoughts.entries)) life.recentLogs = thoughts.entries.slice(-80).map(({at,text}) => ({at,text})); } catch {}

  if(life.mode==='GAMING')life.mode='SURFING';
  let brainConfig = {};
  try {
    if (fs.existsSync(brainCfgFile)) {
      brainConfig = modelReader.getConfig();
    }
  } catch {}

  let affectionCount = 0;
  const topBonds = [];
  try {
    if (fs.existsSync(affDir)) {
      const files = fs.readdirSync(affDir).filter(f => f.endsWith('.json') && !f.startsWith('.'));
      affectionCount = files.length;
      for (const f of files) {
        try {
          const d = JSON.parse(fs.readFileSync(path.join(affDir, f), 'utf8'));
          topBonds.push(parseBondSummary(f.replace(/\.json$/, ''), d));
        } catch {
          const id = f.replace(/\.json$/, '');
          topBonds.push({ id, name: id, affection: null, familiarity: null, impression: '档案无法解析，请在文件管理器中检查 JSON', invalid: true });
        }
      }
      topBonds.sort((a, b) => b.affection - a.affection);
    }
  } catch {}

  let artworks = [];
  let totalArtworksCount = 0;
  try {
    if (fs.existsSync(genDir)) {
      const allArt = fs.readdirSync(genDir)
        .filter(f => /\.(png|jpe?g|webp)$/i.test(f))
        .map(f => {
          const st = fs.statSync(path.join(genDir, f));
          return { name: f, size: st.size, mtime: st.mtimeMs };
        })
        .sort((a, b) => b.mtime - a.mtime);
      totalArtworksCount = allArt.length;
      artworks = allArt.slice(0, 24);
    }
  } catch {}

  const countFiles = (dir) => {
    let count = 0;
    try {
      if (!fs.existsSync(dir)) return 0;
      for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
        if (entry.name.startsWith('.')) continue;
        if (entry.isDirectory()) count += countFiles(path.join(dir, entry.name));
        else count++;
      }
    } catch {}
    return count;
  };

  return {
    life,
    models: {
      cognition: brainConfig.llm?.model || 'deepseek-v4.1-flash-1017',
      vision: brainConfig.vision_llm?.model || 'deepseek-v4.1-flash-1017',
      painter: brainConfig.image_llm?.model || 'gpt-image-2.5-web',
      painterFallback: brainConfig.image_llm?.fallback_model || 'gpt-image-2.6-web',
      painterSize: brainConfig.image_llm?.size || 'auto'
    },
    counts: {
      bonds: affectionCount,
      memories: countFiles(memDir),
      skills: countFiles(skillDir),
      artworks: totalArtworksCount
    },
    topBonds,
    artworks
  };
}

const layerRegistry=createLayerRegistry({file:path.join(__dirname,'config/layers.json'),workspace:path.dirname(WEB_ROOT),roots:{brain:BRAIN_ROOT,gateway:GATEWAY_ROOT,web:WEB_ROOT,redis:REDIS_ROOT,onebot:ONEBOT_ROOT},externalRoots:config.paths?.onebotRoot?[ONEBOT_ROOT]:[]});
const getOrgans=()=>layerRegistry.read().layers;
const sampleContainerMetrics=createMetricsSampler();
// Local dev state simulation when Docker is not present
const localOrganStates = new Map([
  ['corenyan-brain', true],
  ['corenyan-gateway', true],
  ['onebot-qq', true],
  ['corenyan-redis', true]
]);

async function getOrganStatuses() {
  const statusMap = new Map();
  let dockerAvailable = false;
  try {
    const { stdout } = await execAsync('docker ps -a --format "{{.Names}}|{{.State}}|{{.Status}}|{{.ID}}"', { timeout: 3500 });
    for (const line of stdout.trim().split('\n')) {
      if (!line) continue;
      const [name, state, status, id] = line.split('|');
      if (name) {
        dockerAvailable = true;
        statusMap.set(name.trim(), { state: state.trim(), status: status.trim(), containerId: id.trim() });
      }
    }
  } catch {
    // Fallback if running on local Windows without docker daemon
  }
  let starts=new Map();
  try{starts=await containerStarts([...statusMap.values()].map(info=>info.containerId));}catch{}

  return Promise.all(getOrgans().map(async o => {
    if(o.kind==='directory')return {...o,online:fs.existsSync(o.directory),stateCode:'DIRECTORY',stateLabel:'文件层',uptime:'FILES',containerId:null};
    const info = statusMap.get(o.containerName);
    if (info) {
      const isRunning = info.state === 'running';
      return {
        ...o,
        online: isRunning,
        stateLabel: isRunning ? '活跃中' : '休眠中',
        stateCode: isRunning ? 'ACTIVE' : 'DORMANT',
        uptime: info.status,
        containerId: info.containerId,
        startedAt: starts.get(info.containerId)||null,
        metrics: isRunning ? await sampleContainerMetrics(o.containerName) : {available:false,reason:'stopped'}
      };
    }
    const simOnline = dockerAvailable ? false : (localOrganStates.get(o.id) !== false);
    return {
      ...o,
      online: simOnline,
      stateLabel: simOnline ? '活跃中' : '休眠中',
      stateCode: simOnline ? 'ACTIVE' : 'DORMANT',
      uptime: simOnline ? 'LOCAL ACTIVE' : 'EXITED (DORMANT)',
      containerId: 'local',metrics:{available:false,reason:'unavailable'}
    };
  }));
}

async function controlOrgan(organId,action,confirmSessionImpact=false){
 return runOrganControl(getOrgans().find(o=>o.id===organId),action,confirmSessionImpact);
}

async function getNeuralLogs(organId = 'corenyan-brain', lines = 120) {
  return readNeuralLog(organId, lines, { organs: getOrgans(), brainRoot: BRAIN_ROOT, exec: execAsync });
}

function getFileScopes() { return layerRegistry.scopes(); }

function safeResolveInScope(scopeId, relPath = '') {
  const scopes = getFileScopes();
  const scope = scopes[scopeId];
  if (!scope) throw new Error('未知解剖分区');
  const base = path.resolve(scope.root);
  const target = path.resolve(base, String(relPath || '').replace(/^[/\\]+/, ''));
  if (target !== base && !target.startsWith(base + path.sep)) {
    throw new Error('路径越界拦截');
  }
  if(chatPrivatePath(target))throw Error('CHAT 私有数据只能通过聊天接口访问');
  if (target !== base) checkedPath(base, path.relative(base, target));
  return { scope, base, target };
}

function listFilesInScope(scopeId, subDir = '') {
  const { base, target } = safeResolveInScope(scopeId, subDir);
  if (!fs.existsSync(target)) return [];
  const entries = fs.readdirSync(target, { withFileTypes: true });
  const skipDirs = new Set(['node_modules', '.git', '.review', 'test-results', 'cache', 'logs', TRASH_DIR]);
  const out = [];
  for (const e of entries) {
    if (skipDirs.has(e.name)) continue;
    const full = path.join(target, e.name);
    if(chatPrivatePath(full))continue;
    const rel = path.relative(base, full).replace(/\\/g, '/');
    let stat = null;
    try { stat = fs.statSync(full); } catch { continue; }
    out.push({
      name: e.name,
      relPath: rel,
      isDir: e.isDirectory(),
      size: e.isDirectory() ? 0 : stat.size,
      mtime: stat.mtimeMs
    });
  }
  out.sort((a, b) => Number(b.isDir) - Number(a.isDir) || a.name.localeCompare(b.name));
  return out;
}

function buildTreeInScope(scopeId, subDir = '', depth = 0, maxDepth = 6) {
  if (depth > maxDepth) return [];
  const items = listFilesInScope(scopeId, subDir);
  return items.map(item => {
    if (item.isDir) {
      return {
        ...item,
        children: buildTreeInScope(scopeId, item.relPath, depth + 1, maxDepth)
      };
    }
    return item;
  });
}

function resolveUniqueTargetPath(destDir, baseName) {
  const ext = path.extname(baseName);
  const stem = ext ? baseName.slice(0, -ext.length) : baseName;
  let candidate = path.join(destDir, baseName);
  let counter = 1;
  while (fs.existsSync(candidate)) {
    candidate = path.join(destDir, `${stem}_copy${counter > 1 ? counter : ''}${ext}`);
    counter++;
  }
  return candidate;
}

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.js': 'application/javascript; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.jpeg': 'image/jpeg',
  '.gif': 'image/gif',
  '.webp': 'image/webp',
  '.svg': 'image/svg+xml'
};

function sendJson(res, status, data) {
  if (res.headersSent || res.destroyed) return;
  res.writeHead(status, {
    'Content-Type': 'application/json; charset=utf-8',
    'Cache-Control': 'no-store',
    
    'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
    'Access-Control-Allow-Headers': 'Content-Type, Authorization'
  });
  res.end(JSON.stringify(data));
}

async function readJsonBody(req) {
  let body = '';
  for await (const chunk of req) {
    body += chunk;
    if (Buffer.byteLength(body) > MAX_BODY_BYTES) throw new Error('请求载荷超限');
  }
  return body ? JSON.parse(body) : {};
}

const securityDirectory=(process.env.MATRIX_SECURITY_DIR||process.env.CORENYAN_WEB_SECURITY_DIR);
if(!securityDirectory)throw Error('CORENYAN_WEB_SECURITY_DIR is required; refusing unprotected startup');
const chatApi=createChatApi({sharedRoot:path.join(path.dirname(WEB_ROOT),'shared'),gatewayRoot:GATEWAY_ROOT});
const credentialFile=path.join(securityDirectory,'credentials.json');
const accounts=createAccountStore(credentialFile);
const authorize=createAuth({credentialFile,accounts});
const notifications=createNotifications({directory:securityDirectory,accounts,listThreads:chatApi.listForAccount,readReply:chatApi.readNotificationReply});
const sounds=createSounds({directory:securityDirectory,accounts});
const server = http.createServer(async (req, res) => {
  try { if(await authorize(req,res))return; } catch {res.writeHead(400);res.end('Invalid request');return;}
  const url = new URL(req.url, `https://${req.headers.host || 'localhost'}`);
  const pathname = url.pathname;
  if(await sounds.handle(req,res,url))return;
  if(await notifications.handle(req,res,url))return;
  if(await chatApi(req,res,url))return;

  if (req.method === 'OPTIONS') {
    res.writeHead(204, {
      
      'Access-Control-Allow-Methods': 'GET, POST, PUT, DELETE, OPTIONS',
      'Access-Control-Allow-Headers': 'Content-Type, Authorization'
    });
    res.end();
    return;
  }

  try {
    if (pathname === '/api/model-presets' || pathname === '/api/model-presets/bindings' || pathname === '/api/model-presets/clone' || pathname === '/api/model-presets/rename' || pathname === '/api/model-presets/models') {
      try {
        if(req.method!=='GET'&&req.headers.origin&&!trustedRequestOrigin(req)) return sendJson(res,403,{ok:false,error:'请从当前管理页面操作'});
        if(pathname==='/api/model-presets/models'&&req.method==='POST')return sendJson(res,200,{ok:true,...await discoverPresetModels(await readJsonBody(req),presetStore)});
        if(pathname==='/api/model-presets'&&req.method==='GET')return sendJson(res,200,{ok:true,...presetStore.catalog()});
        if(pathname==='/api/model-presets'&&req.method==='POST')return sendJson(res,200,{ok:true,preset:presetStore.save(await readJsonBody(req))});
        if(pathname==='/api/model-presets/rename'&&req.method==='POST')return sendJson(res,200,{ok:true,...presetStore.rename(await readJsonBody(req))});
        if(pathname==='/api/model-presets/clone'&&req.method==='POST')return sendJson(res,200,{ok:true,preset:presetStore.clone(await readJsonBody(req))});
        if(pathname==='/api/model-presets'&&req.method==='DELETE')return sendJson(res,200,{ok:true,...presetStore.remove(await readJsonBody(req))});
        if(pathname==='/api/model-presets/bindings'&&req.method==='POST')return sendJson(res,200,{ok:true,...presetStore.bind(await readJsonBody(req))});
        return sendJson(res,405,{ok:false,error:'不支持的请求方法'});
      }catch(error){return sendJson(res,error.status||400,{ok:false,error:error.status?error.message:'预设读取或保存失败，请检查 JSON 和文件权限'});}
    }
    // 1. Vital Signs & Full Bio-Telemetry API
    if (pathname === '/api/vitals' && req.method === 'GET') {
      const cpuPercent = sampleCpuPercent();
      const totalMem = os.totalmem();
      const freeMem = os.freemem();
      const usedMem = totalMem - freeMem;
      const memPercent = Math.round((usedMem / Math.max(1, totalMem)) * 100);
      const loadAvg = os.loadavg();
      const [disk, organs, netRate] = await Promise.all([
        getDiskUsage(),
        getOrganStatuses(),
        Promise.resolve(sampleNetworkRate())
      ]);
      const bio = getCoreNyanBioState();
      const bpm = Math.round(62 + (cpuPercent * 0.45) + ((100 - (bio.life.energy || 80)) * 0.15));

      return sendJson(res, 200, {
        ok: true,
        timestamp: Date.now(),
        host: {
          hostname: os.hostname(),
          platform: `${os.type()} ${os.release()} (${os.arch()})`,
          uptimeSeconds: Math.floor(os.uptime()),
          cpuCores: os.cpus().length,
          cpuModel: os.cpus()[0]?.model || 'Virtual Cortex Core',
          cpuPercent,
          loadAvg: loadAvg.map(n => Number(n.toFixed(2))),
          memTotal: totalMem,
          memUsed: usedMem,
          memPercent,
          diskTotal: disk.total,
          diskUsed: disk.used,
          diskPercent: disk.percent,
          netRxRate: netRate.rxBytesPerSec,
          netTxRate: netRate.txBytesPerSec
        },
        vitals: {
          bpm,
          energy: Number((bio.life.energy ?? 85).toFixed(1)),
          mood: Number((bio.life.mood ?? 80).toFixed(1)),
          mode: bio.life.mode || 'SURFING',
          lastHeartbeat: bio.life.lastHeartbeat || Date.now(),
          recentLogs: bio.life.recentLogs || []
        },
        organs,
        models: bio.models,
        counts: bio.counts,
        topBonds: bio.topBonds,
        artworks: bio.artworks
      });
    }

    // 2. Detailed Soul Bond Inspector API
    if (pathname.startsWith('/api/bonds/') && req.method === 'GET') {
      const bondId = path.basename(decodeURIComponent(pathname.slice('/api/bonds/'.length)));
      const affFile = path.join(BRAIN_ROOT, 'affections', `${bondId}.json`);
      if (!fs.existsSync(affFile)) return sendJson(res, 404, { ok: false, error: termText("未找到该{{concept.bond.zh}}{{concept.dossier.zh}}") });
      const raw = JSON.parse(fs.readFileSync(affFile, 'utf8'));
      const summary = parseBondSummary(bondId, raw);
      const p = raw.profile || raw || {};
      const styles = (p.behavior?.styles || [])
        .map(s => (typeof s === 'string' ? s : s?.value))
        .filter(Boolean);
      const topics = (p.behavior?.topics || [])
        .map(t => (typeof t === 'string' ? t : t?.value))
        .filter(Boolean);
      const recentEvidence = (p.behavior?.recentEvidence || [])
        .slice(-15)
        .reverse()
        .map(ev => ({
          at: ev.at,
          role: ev.role,
          type: ev.type,
          text: ev.text || '',
          assistantContext: ev.assistantContext || '',
          delta: ev.delta ?? 0,
          conversationId: ev.conversationId || ''
        }));
      const impressions = p.relationship?.impressions || (p.impression ? [p.impression] : []);

      return sendJson(res, 200, {
        ok: true,
        bond: {
          ...summary,
          aliases: raw.aliases || [],
          canonicalKey: p.canonicalKey || p.key || bondId,
          verified: Boolean(p.identities?.verified),
          source: p.identities?.source || 'unknown',
          styles,
          topics,
          impressions,
          recentEvidence,
          lastInteractionAt: p.behavior?.lastEvidenceAt || p.relationship?.lastAssessmentAt || null
        }
      });
    }

    // 3. Organ Module Control API (start / stop / restart)
    if (pathname === '/api/organs/control' && req.method === 'POST') {
      const { organId, action, confirmSessionImpact } = await readJsonBody(req);
      console.info('[Service Control] requested',JSON.stringify({organId,action,accountId:req.auth?.id,confirmSessionImpact:confirmSessionImpact===true}));
      const result = await controlOrgan(organId, action, confirmSessionImpact);
      console.info('[Service Control] completed',JSON.stringify({organId,action,ok:result.ok}));
      return sendJson(res, result.ok ? 200 : 500, result);
    }

    // 4. Neural Pulse Logs API (Preserves ANSI color codes for frontend renderer)
    if(pathname==='/api/brain/requests'||pathname.startsWith('/api/brain/requests/')){
      if(req.auth?.role!=='owner')return sendJson(res,403,{ok:false,error:'完整调用记录仅主管理员可查看'});
      if(req.method!=='GET')return sendJson(res,405,{ok:false,error:'METHOD_NOT_ALLOWED'});
      res.setHeader('Cache-Control','no-store');
      if(pathname==='/api/brain/requests')return sendJson(res,200,{ok:true,...await apiRecords.list({q:url.searchParams.get('q')||'',kind:url.searchParams.get('kind')||'',before:url.searchParams.get('before')||Infinity})});
      try{return sendJson(res,200,{ok:true,record:await apiRecords.read(pathname.split('/').at(-1))});}catch{return sendJson(res,404,{ok:false,error:'记录不存在或已过保留期'});}
    }
    if(pathname==='/api/onebot/login'&&req.method==='GET')return sendJson(res,200,{ok:true,...await readOnebotLogin(path.join(ONEBOT_ROOT,'data/qq-login-state.json'))});
    if (pathname === '/api/logs' && req.method === 'GET') {
      const organId = url.searchParams.get('organ') || 'corenyan-brain';
      const lines = Number(url.searchParams.get('lines') || 120);
      const log = await getNeuralLogs(organId, lines);
      return sendJson(res, 200, { ok: true, ...log });
    }

    // 5. Anatomical File Manager API
    if (pathname === '/api/fs/scopes' && req.method === 'GET') return sendJson(res,200,{ok:true,...layerRegistry.catalog()});
    if (pathname === '/api/layers' && req.method === 'GET') return sendJson(res,200,{ok:true,...layerRegistry.catalog()});
    if (pathname === '/api/layers' && req.method === 'POST') {
      const result=layerRegistry.save(await readJsonBody(req));
      return sendJson(res,200,{ok:true,...result});
    }
    if (pathname === '/api/layers/banner' && req.method === 'POST') {
      const {data}=await readJsonBody(req);
      if(typeof data!=='string'||data.length>6*1024*1024||! /^[A-Za-z0-9+/]*={0,2}$/.test(data))throw Error('图片大小不能超过4MB');
      const bytes=Buffer.from(data,'base64');
      if(bytes.length>4*1024*1024)throw Error('图片大小不能超过4MB');
      let ext;
      if(bytes.subarray(0,8).equals(Buffer.from([137,80,78,71,13,10,26,10])))ext='png';
      else if(bytes[0]===255&&bytes[1]===216&&bytes[2]===255)ext='jpg';
      else if(/^GIF8[79]a$/.test(bytes.subarray(0,6).toString()))ext='gif';
      else if(bytes.subarray(0,4).toString()==='RIFF'&&bytes.subarray(8,12).toString()==='WEBP')ext='webp';
      if(!ext)throw Error('仅支持PNG、JPEG、GIF、WebP图片');
      const relative='assets/uploads/'+randomUUID()+'.'+ext;
      fs.mkdirSync(path.join(__dirname,'data/uploads'),{recursive:true});
      fs.writeFileSync(path.join(__dirname,'data/uploads',path.basename(relative)),bytes,{flag:'wx'});
      return sendJson(res,200,{ok:true,path:relative});
    }
    if (pathname === '/api/fs/search' && req.method === 'GET') {
      const scopes=getFileScopes(),scopeId=url.searchParams.get('scope')||'all';
      if(scopeId!=='all'&&!scopes[scopeId])throw Error('未知分区');
      const selected=scopeId==='all'?Object.values(scopes).filter(s=>s.isRoot):[scopes[scopeId]];
      const controller=new AbortController();res.on('close',()=>controller.abort());
      const result=await searchFiles(selected,url.searchParams.get('q'),{signal:controller.signal});
      if(!res.destroyed)return sendJson(res,200,{ok:true,...result});
      return;
    }

    if (pathname === '/api/fs/list' && req.method === 'GET') {
      const scopeId = url.searchParams.get('scope') || 'memory';
      const dir = url.searchParams.get('dir') || '';
      const items = listFilesInScope(scopeId, dir);
      return sendJson(res, 200, { ok: true, scope: scopeId, dir, items });
    }

    if (pathname === '/api/fs/tree' && req.method === 'GET') {
      const scopeId = url.searchParams.get('scope') || 'memory';
      const tree = buildTreeInScope(scopeId, '', 0, 5);
      return sendJson(res, 200, { ok: true, scope: scopeId, tree });
    }

    if (pathname === '/api/fs/preview' && req.method === 'GET') {
      const { target } = safeResolveInScope(url.searchParams.get('scope'), url.searchParams.get('path'));
      const mime = IMAGE_TYPES[path.extname(target).toLowerCase()];
      if (!mime || !fs.existsSync(target) || !fs.statSync(target).isFile()) return sendJson(res, 404, { error: '无法预览此文件' });
      res.writeHead(200, { 'Content-Type': mime, 'Cache-Control': 'no-store', 'X-Content-Type-Options': 'nosniff', 'Content-Security-Policy': "sandbox; default-src 'none'; style-src 'unsafe-inline'" });
      fs.createReadStream(target).pipe(res); return;
    }
    if (pathname === '/api/fs/read' && req.method === 'GET') {
      const scopeId = url.searchParams.get('scope') || 'memory';
      const fileRel = url.searchParams.get('path') || '';
      const { target } = safeResolveInScope(scopeId, fileRel);
      if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
        return sendJson(res, 404, { ok: false, error: termText("目标{{concept.slice.zh}}不存在") });
      }
      const stat = fs.statSync(target);
      if (isBinaryFile(target)) return sendJson(res, 200, { ok: true, path: fileRel, size: stat.size, mtime: stat.mtimeMs, birthtime: stat.birthtimeMs > 0 ? stat.birthtimeMs : null, binary: true });
      if (stat.size > 2 * 1024 * 1024) {
        return sendJson(res, 413, { ok: false, error: '文件大于 2MB，禁止直接在线解码' });
      }
      const content = fs.readFileSync(target, 'utf8');
      return sendJson(res, 200, { ok: true, path: fileRel, size: stat.size, mtime: stat.mtimeMs, birthtime: stat.birthtimeMs > 0 ? stat.birthtimeMs : null, content });
    }

    if (pathname === '/api/fs/download' && req.method === 'GET') {
      const scopeId = url.searchParams.get('scope') || 'memory';
      const fileRel = url.searchParams.get('path') || '';
      const { target } = safeResolveInScope(scopeId, fileRel);
      if (!fs.existsSync(target) || fs.statSync(target).isDirectory()) {
        return sendJson(res, 404, { ok: false, error: '目标文件不存在或为目录' });
      }
      const fileName = path.basename(target);
      res.writeHead(200, {
        'Content-Type': 'application/octet-stream',
        'Content-Disposition': `attachment; filename*=UTF-8''${encodeURIComponent(fileName)}`
      });
      fs.createReadStream(target).pipe(res);
      return;
    }

    if (pathname === '/api/fs/write' && req.method === 'POST') {
      const { scope, path: fileRel, content } = await readJsonBody(req);
      if (!fileRel) return sendJson(res, 400, { ok: false, error: '路径为空' });
      const { target } = safeResolveInScope(scope || 'memory', fileRel);
      if (isBinaryFile(target)) return sendJson(res, 415, { error: '二进制文件不能作为文本写入' });
      presetStore.validateWrite(target,String(content));
      fs.mkdirSync(path.dirname(target), { recursive: true });
      const tmp = `${target}.tmp-${Date.now()}`;
      fs.writeFileSync(tmp, String(content ?? ''), 'utf8');
      fs.renameSync(tmp, target);
      const stat = fs.statSync(target);
      return sendJson(res, 200, { ok: true, path: fileRel, size: stat.size, mtime: stat.mtimeMs, birthtime: stat.birthtimeMs > 0 ? stat.birthtimeMs : null });
    }

    if (pathname === '/api/fs/mkdir' && req.method === 'POST') {
      const { scope, path: dirRel } = await readJsonBody(req);
      if (!dirRel) return sendJson(res, 400, { ok: false, error: '目录路径为空' });
      const { target } = safeResolveInScope(scope || 'memory', dirRel);
      fs.mkdirSync(target, { recursive: true });
      return sendJson(res, 200, { ok: true, path: dirRel });
    }

    if (pathname === '/api/fs/rename' && req.method === 'POST') {
      const { scope, oldPath, newPath } = await readJsonBody(req);
      if (!oldPath || !newPath) return sendJson(res, 400, { ok: false, error: '原路径或新路径为空' });
      const src = safeResolveInScope(scope || 'memory', oldPath);
      const dst = safeResolveInScope(scope || 'memory', newPath);
      if (src.target === src.base) return sendJson(res, 400, { ok: false, error: '禁止重命名根组织' });
      if (!fs.existsSync(src.target)) return sendJson(res, 404, { ok: false, error: '原路径不存在' });
      if (fs.existsSync(dst.target) && src.target.toLowerCase() !== dst.target.toLowerCase()) {
        return sendJson(res, 409, { ok: false, error: '目标名称已存在' });
      }
      fs.mkdirSync(path.dirname(dst.target), { recursive: true });
      presetStore.move(src.target,dst.target);
      return sendJson(res, 200, { ok: true, oldPath, newPath });
    }

    if (pathname === '/api/fs/move' && req.method === 'POST') {
      try{
        const guard={...presetStore,validateMove:(target,destination)=>{
          if(Object.values(getFileScopes()).some(scope=>path.resolve(scope.root)===target||path.resolve(scope.root).startsWith(target+path.sep)))throw Error('不能移动文件分区根目录');
          presetStore.validateMove(target,destination);
        }};
        const moved=moveFiles(await readJsonBody(req),safeResolveInScope,guard);
        return sendJson(res,200,{ok:true,moved});
      }catch(error){return sendJson(res,error.status||400,{ok:false,error:error.message});}
    }

    if (pathname === '/api/fs/paste' && req.method === 'POST') {
      const { scope, sources, targetDir, mode } = await readJsonBody(req);
      const scopeId = scope || 'memory';
      const srcList = Array.isArray(sources) ? sources : [];
      if (!srcList.length) return sendJson(res, 400, { ok: false, error: '剪贴板为空' });
      const dstDirResolved = safeResolveInScope(scopeId, targetDir || '');
      fs.mkdirSync(dstDirResolved.target, { recursive: true });

      const pasted = [];
      for (const rel of srcList) {
        const srcResolved = safeResolveInScope(scopeId, rel);
        if (!fs.existsSync(srcResolved.target) || srcResolved.target === srcResolved.base) continue;
        const baseName = path.basename(srcResolved.target);
        let finalDest = path.join(dstDirResolved.target, baseName);

        // Prevent moving/copying a folder into itself
        if (finalDest === srcResolved.target || finalDest.startsWith(srcResolved.target + path.sep)) {
          if (mode === 'cut') continue;
          finalDest = resolveUniqueTargetPath(dstDirResolved.target, baseName);
        } else if (fs.existsSync(finalDest)) {
          finalDest = resolveUniqueTargetPath(dstDirResolved.target, baseName);
        }

        if (mode === 'cut') {
          presetStore.move(srcResolved.target,finalDest);
        } else {
          if(fs.statSync(srcResolved.target).isFile())presetStore.validateCopy(srcResolved.target,finalDest);
          fs.cpSync(srcResolved.target, finalDest, { recursive: true });
        }
        pasted.push(path.relative(dstDirResolved.base, finalDest).replace(/\\/g, '/'));
      }
      return sendJson(res, 200, { ok: true, pasted });
    }

    if (pathname === '/api/fs/trash' && req.method === 'GET') {
      const requested = url.searchParams.get('scope') || 'memory';
      const scopes = getFileScopes();
      if (requested !== TRASH_PREVIEW.allScope && !scopes[requested]) return sendJson(res, 400, { error: '未知分区' });
      const items = [], errors = [];
      const uniqueScopes=[...new Map(Object.values(scopes).map(scope=>[path.resolve(scope.root),scope])).values()];
      for (const scope of requested === TRASH_PREVIEW.allScope ? uniqueScopes : [scopes[requested]]) {
        try { items.push(...trashList(scope.root).map(item => ({ ...item, scope: scope.id, scopeLabel: scope.label }))); }
        catch { errors.push({ scope: scope.id, error: '该分区回收站读取失败' }); }
      }
      items.sort((a,b) => b.deletedAt - a.deletedAt);
      return sendJson(res, 200, { ok: true, items, errors, scopes: Object.values(scopes).map(s => ({id:s.id,label:s.label})) });
    }
    if (pathname === '/api/fs/trash/read' && req.method === 'GET') {
      const { base } = safeResolveInScope(url.searchParams.get('scope'));
      return sendJson(res, 200, { ok: true, ...await trashRead(base, url.searchParams.get('id'), url.searchParams.get('path') || '') });
    }
    if (pathname === '/api/fs/trash/preview' && req.method === 'GET') {
      const { base } = safeResolveInScope(url.searchParams.get('scope'));
      const {target, stat, name} = trashPayload(base, url.searchParams.get('id'), url.searchParams.get('path') || '');
      const mime = IMAGE_TYPES[path.extname(name).toLowerCase()];
      if (!stat.isFile() || !mime) return sendJson(res, 400, {error:'此文件不能作为图片预览'});
      res.writeHead(200, {'Content-Type':mime,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Content-Security-Policy':"sandbox; default-src 'none'; style-src 'unsafe-inline'"});
      fs.createReadStream(target).on('error', () => res.destroy()).pipe(res); return;
    }
    if (['/api/fs/trash/restore', '/api/fs/trash/purge'].includes(pathname) && req.method === 'POST') {
      const body = await readJsonBody(req);
      const { base } = safeResolveInScope(body.scope || 'memory');
      if (pathname.endsWith('/restore')) return sendJson(res, 200, { ok: true, item: trashRestore(base, body.id) });
      if (!Array.isArray(body.ids) || !body.ids.length) return sendJson(res, 400, { ok: false, error: termText("请选择{{file.trash.zh}}记录") });
      return sendJson(res, 200, { ok: true, deletedCount: trashPurge(base, body.ids) });
    }
    if (pathname === '/api/fs/delete' && req.method === 'POST') {
      const body = await readJsonBody(req);
      const scopeId = body.scope || 'memory';
      const { base } = safeResolveInScope(scopeId);
      const paths = Array.isArray(body.paths) ? body.paths : (body.path ? [body.path] : []);
      if (!paths.length) return sendJson(res, 400, { ok: false, error: '路径为空' });
      // Validate the complete request before moving anything; collapse child duplicates.
      const targets = [...new Set(paths.map(item => checkedPath(base, item)))];
      const top = targets.filter(target => !targets.some(parent => parent !== target && target.startsWith(parent + path.sep)));
      const protectedRoots = Object.values(getFileScopes()).map(scope => path.resolve(scope.root));
      for (const target of top) {
        if (protectedRoots.some(root => root === target || root.startsWith(target + path.sep))) throw Error('禁止删除文件分区根目录');
        presetStore.protectRemoval(target);
        fs.lstatSync(target);
      }
      const items = top.map(target => trashMove(base, path.relative(base, target)));
      return sendJson(res, 200, { ok: true, deletedCount: items.length, items });
    }

    // 6. Serve & Delete CoreNyan Generated Artworks
    if (pathname === '/api/artwork/batch-delete' && req.method === 'POST') {
      const { names } = await readJsonBody(req);
      const list = Array.isArray(names) ? names : [];
      const genDir = path.resolve(BRAIN_ROOT, 'images', 'generated');
      const deleted = [];
      for (const rawName of list) {
        const name = path.basename(String(rawName || ''));
        if (!name || !/\.(png|jpe?g|webp)$/i.test(name)) continue;
        const file = path.resolve(genDir, name);
        if (file.startsWith(genDir + path.sep) && fs.existsSync(file)) {
          fs.unlinkSync(file);
          deleted.push(name);
        }
      }
      return sendJson(res, 200, { ok: true, deleted });
    }

    if (pathname.startsWith('/api/artwork/') && req.method === 'GET') {
      const name = path.basename(decodeURIComponent(pathname.slice('/api/artwork/'.length)));
      const file = path.join(BRAIN_ROOT, 'images', 'generated', name);
      if (fs.existsSync(file) && fs.statSync(file).isFile()) {
        const headers = { 'Content-Type': mimeTypes[path.extname(file).toLowerCase()] || 'image/png' };
        if (url.searchParams.get('download') === '1') {
          headers['Content-Disposition'] = `attachment; filename*=UTF-8''${encodeURIComponent(name)}`;
        }
        res.writeHead(200, headers);
        fs.createReadStream(file).pipe(res);
        return;
      }
      return sendJson(res, 404, { error: '画作不存在' });
    }

    if (pathname.startsWith('/api/artwork/') && req.method === 'DELETE') {
      const name = path.basename(decodeURIComponent(pathname.slice('/api/artwork/'.length)));
      if (!name || !/\.(png|jpe?g|webp)$/i.test(name)) {
        return sendJson(res, 400, { ok: false, error: '非法画作文件名' });
      }
      const genDir = path.resolve(BRAIN_ROOT, 'images', 'generated');
      const file = path.resolve(genDir, name);
      if (!file.startsWith(genDir + path.sep)) {
        return sendJson(res, 400, { ok: false, error: '路径越界拦截' });
      }
      if (!fs.existsSync(file)) {
        return sendJson(res, 404, { ok: false, error: '画作标本不存在' });
      }
      fs.unlinkSync(file);
      return sendJson(res, 200, { ok: true, deleted: name });
    }

    // 7. CoreNyan Brain Config Read / Save API
    if (pathname === '/api/brain-config' && req.method === 'GET') {
      const layer=getOrgans().find(l=>l.shortcuts.some(s=>s.id==='endocrine'&&s.kind==='config'));
      if(!layer)throw Error('配置面板快捷入口已移除');
      const cfgFile = checkedPath(layer.directory,layer.shortcuts.find(s=>s.id==='endocrine').path);
      if (!fs.existsSync(cfgFile)) return sendJson(res, 404, { ok: false, error: termText("未找到{{concept.brainCore.zh}}配置") });
      const raw = JSON.parse(fs.readFileSync(cfgFile, 'utf8'));
      return sendJson(res, 200, { ok: true, config: raw });
    }

    if (pathname === '/api/brain-config' && req.method === 'POST') {
      const { config: nextCfg } = await readJsonBody(req);
      if (!nextCfg || typeof nextCfg !== 'object') return sendJson(res, 400, { ok: false, error: '无效配置对象' });
      const layer=getOrgans().find(l=>l.shortcuts.some(s=>s.id==='endocrine'&&s.kind==='config'));
      if(!layer)throw Error('配置面板快捷入口已移除');
      const cfgFile = checkedPath(layer.directory,layer.shortcuts.find(s=>s.id==='endocrine').path);
      presetStore.validateWrite(cfgFile,JSON.stringify(nextCfg));
      const tmp = `${cfgFile}.tmp-${Date.now()}`;
      fs.writeFileSync(tmp, JSON.stringify(nextCfg, null, 4), 'utf8');
      fs.renameSync(tmp, cfgFile);
      return sendJson(res, 200, { ok: true });
    }

    // User uploads are backend-owned runtime data, never packaged into application assets.
    if(req.method==='GET'&&/^\/assets\/uploads\/[a-zA-Z0-9_.-]+\.(png|jpg|jpeg|gif|webp)$/.test(pathname)){
      const file=path.join(__dirname,'data/uploads',path.basename(pathname));
      if(fs.existsSync(file)){res.writeHead(200,{'Content-Type':mimeTypes[path.extname(file)]||'application/octet-stream','Cache-Control':'private, no-cache'});fs.createReadStream(file).pipe(res);return;}
    }
    sendJson(res, 404, { error: termTextTemplate`未找到{{concept.neural.zh}}端点: ${pathname}` });
  } catch (err) {
    console.error('[CORENYAN-VITAL-SERVER]', err);
    sendJson(res, 500, { ok: false, error: err.message || termText("内部{{concept.neural.zh}}异常") });
  }
});

const PORT = Number(process.env.MATRIX_API_PORT || 26000);
const HOST = process.env.MATRIX_API_HOST || '127.0.0.1';
server.listen(PORT, HOST, () => {
  console.log(`[CORENYAN-MATRIX-API] Listening on http://${HOST === '0.0.0.0' ? '127.0.0.1' : HOST}:${PORT}`);
});
