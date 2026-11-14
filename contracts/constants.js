import { termText, termHtml, termTextTemplate, termHtmlTemplate } from './terminology.js';
'use strict';

// Runtime configuration and protocol identifiers. Styling tokens live in CSS.
function freeze(value) {
  if (value && typeof value === 'object') {
    Object.values(value).forEach(freeze);
    Object.freeze(value);
  }
  return value;
}

export const ANSI_CLASSES = freeze({
  "1": "ansi-bold",
  "2": "ansi-dim",
  "30": "ansi-gray",
  "31": "ansi-red",
  "32": "ansi-green",
  "33": "ansi-yellow",
  "34": "ansi-blue",
  "35": "ansi-magenta",
  "36": "ansi-cyan",
  "90": "ansi-gray",
  "91": "ansi-red",
  "92": "ansi-green",
  "93": "ansi-yellow",
  "94": "ansi-blue",
  "95": "ansi-magenta",
  "96": "ansi-cyan"
});

export const API = freeze({
  "ARTWORK": "/api/artwork/",
  "ARTWORK_BATCH_DELETE": "/api/artwork/batch-delete",
  "BONDS": "/api/bonds/",
  "BRAIN_CONFIG": "/api/brain-config",
  "FS_TRASH": "/api/fs/trash",
  "FS_TRASH_READ": "/api/fs/trash/read",
  "FS_TRASH_PREVIEW": "/api/fs/trash/preview",
  "FS_RESTORE": "/api/fs/trash/restore",
  "FS_PURGE": "/api/fs/trash/purge",
  "FS_DELETE": "/api/fs/delete",
  "FS_DOWNLOAD": "/api/fs/download",
  "FS_LIST": "/api/fs/list",
  "FS_MKDIR": "/api/fs/mkdir",
  "FS_PASTE": "/api/fs/paste",
  "FS_MOVE": "/api/fs/move",
  "FS_READ": "/api/fs/read",
  "FS_RENAME": "/api/fs/rename",
  "FS_SCOPES": "/api/fs/scopes",
  "FS_TREE": "/api/fs/tree",
  "FS_WRITE": "/api/fs/write",
  "LOGS": "/api/logs",
  "ORGANS_CONTROL": "/api/organs/control",
  "VITALS": "/api/vitals"
});

export const CHAPTER_META = freeze({
  vitals: {code: termText("CHAPTER 01 // {{chapter.vitals.en}}"), title: termText("{{chapter.vitals.zh}}"), sub: termText("{{chapter.vitals.en}}")},
  organs: {code: termText("CHAPTER 02 // {{chapter.organs.en}}"), title: termText("{{chapter.organs.zh}}"), sub: termText("{{chapter.organs.en}}")},
  memory: {code: termText("CHAPTER 03 // {{chapter.memory.en}}"), title: termText("{{chapter.memory.zh}}"), sub: termText("{{chapter.memory.en}}")},
  neural: {code: termText("CHAPTER 04 // {{chapter.neural.en}}"), title: termText("{{chapter.neural.zh}}"), sub: termText("{{chapter.neural.en}}")},
  entity: {code: termText("CHAPTER 05 // {{chapter.entity.en}}"), title: termText("{{chapter.entity.zh}}"), sub: termText("{{chapter.entity.en}}")},
  chat: {code: termText("CHAPTER 06 // {{chapter.chat.en}}"), title: termText("{{chapter.chat.zh}}"), sub: termText("{{chapter.chat.en}}")},
  endocrine: {code: "CONFIGURATION", title: "运行配置", sub: "BRAIN CONFIG"}
});

export const DOODLE_TOTAL = freeze(37);

export const EDITOR = freeze({
  "indent": 2,
  "gutters": ["CodeMirror-linenumbers", "CodeMirror-foldgutter"],
  "foldKey": "Ctrl-Q",
  "modes": {
    "json": "application/json",
    "js": "javascript",
    "md": "markdown",
    "yaml": "yaml",
    "html": "htmlmixed",
    "css": "css",
    "sh": "shell",
    "txt": "text/plain"
  }
});

export const LIFE_MODE_LABELS = freeze({
  "SURFING": "ACTIVE · 冲浪巡游中",
  "SLEEPING": "SLEEP · 深度休眠中",
  "DRAWING": termText("PAINTING · 创作中"),
  "THINKING": "THINKING · 深度推演中"
});

export const TIMING = freeze({
  "poll": 3000,
  "clock": 1000,
  "toast": 3200,
  "toastExit": 260,
  "downloadStagger": 180
});

export const UI = freeze({
  "locale": "zh-CN",
  "timezone": "Asia/Shanghai",
  "defaultOrgan": "corenyan-brain",
  "defaultScope": "brain_src",
  "logLines": 150,
  "logBottomThreshold": 48,
  "menuWidth": 210,
  "menuHeight": 270,
  "viewportInset": 8,
  "zoomMin": 0.25,
  "zoomMax": 6,
  "zoomStep": 0.25,
  "wheelStep": 0.2
});

export const WAVE = freeze({
  "seed": 18,
  "sampleRate": 120,
  "historySeconds": 30,
  "pixelsPerSecond": 58,
  "headInset": 12,
  "bpmMin": 35,
  "bpmMax": 180,
  "ecgAmplitude": 48,
  "respirationAmplitude": 17,
  "respirationHz": 0.24,
  "noiseAmplitude": 1.2,
  "intervalVariation": 0.12,
  "amplitudeVariation": 0.36,
  "widthVariation": 0.16,
  "shapeVariation": 0.26,
  "baselineDrift": 2.4,
  "activityGain": 0.002,
  "pulseShape": [
    { "center": 0.18, "width": 0.028, "amplitude": 0.12 },
    { "center": 0.365, "width": 0.009, "amplitude": -0.16 },
    { "center": 0.4, "width": 0.011, "amplitude": 1 },
    { "center": 0.435, "width": 0.012, "amplitude": -0.27 },
    { "center": 0.67, "width": 0.055, "amplitude": 0.25 }
  ],
  "maxDeltaMs": 50,
  "maxDpr": 2,
  "gridStep": 28,
  "gridColor": "rgba(255,255,255,0.06)",
  "traces": [
    {
      "baseline": 0.3,
      "color": "#777777",
      "width": 1.2,
      "channel": "respiration"
    },
    {
      "baseline": 0.68,
      "color": "#f4f4f4",
      "width": 1.8,
      "channel": "ecg"
    }
  ]
});

export const VIEW = freeze({
  "VITALS": "vitals",
  "ORGANS": "organs",
  "MEMORY": "memory",
  "NEURAL": "neural",
  "ENDOCRINE": "endocrine",
  "ENTITY": "entity", "CHAT": "chat"
});

export const ENTITY_PREVIEW = freeze({ yaw: -Math.PI / 2, pitch: Math.PI / 2, root: '/assets/entity-top-v1/', version: 1 });

export const ENTITY_MODELS = freeze({
  command: { code: 'CMD', name: 'COMMAND CRUISER', subtitle: 'DECISION LAYER', description: '指挥旗舰：纵向分段舰体、十座侧舷机库、长轴发射轨与护航编队。', sideYaw: 1.05, previewYaw: ENTITY_PREVIEW.yaw, previewPitch: ENTITY_PREVIEW.pitch, yaw: 1.08, pitch: -.48 },
  sensor: { code: 'SEN', name: 'SENSOR FORK', subtitle: 'PERCEPTION LAYER', description: '分叉式探测舰：接收臂、雷达盘与前端探针。', sideYaw: 1.05, previewYaw: ENTITY_PREVIEW.yaw, previewPitch: ENTITY_PREVIEW.pitch, yaw: -.9, pitch: -.5 },
  courier: { code: 'QQ', name: 'SWALLOW COURIER', subtitle: 'COMMUNICATION LAYER', description: '信使艇：宽展掠翼、尖锐舰首与双引擎。', sideYaw: .55, previewYaw: ENTITY_PREVIEW.yaw, previewPitch: ENTITY_PREVIEW.pitch, yaw: -.4, pitch: -.55 },
  relay: { code: 'RED', name: 'RELAY CRUISER', subtitle: 'LINKING LAYER', description: '锤头通信舰：横向接收阵列、分布式交换舱与双引擎。', sideYaw: 1.05, previewYaw: ENTITY_PREVIEW.yaw, previewPitch: ENTITY_PREVIEW.pitch, yaw: -.65, pitch: -.45 },
  ark: { code: 'WEB', name: 'HEAVY ARK', subtitle: 'CONTAINER LAYER', description: '重型方舟：层叠甲板、侧舱与四台推进器。', sideYaw: 1.05, previewYaw: ENTITY_PREVIEW.yaw, previewPitch: ENTITY_PREVIEW.pitch, yaw: -.9, pitch: -.55 }
});
export const ENTITY = freeze({
  layerModels: { 'corenyan-brain':'command', 'corenyan-gateway':'sensor', 'onebot-qq':'courier', 'corenyan-redis':'relay', 'corenyan-web':'ark' },
  assetVersion: 9, assetRoot: '/assets/entity-v9/', surfaceDensity: 2200, maxPoints: 75000, fallbackPoints: 5200, maxDpr: 2,
  defaultYaw: -1.05, defaultPitch: -.38, defaultZoom: 1, zoomMin: .38, zoomMax: 8, zoomStep: .18,
  transitionPoints: 150000, snapshotBatch: 8192, defaultFocus: 1, focusSpread: 1.6, switchSpread: 1.5, scatterStretch: .4, scatterFlow: .22, scatterCurl: .3, outwardDrift: .22, scatterDepth: .12, cloudAlpha: .55, defocusAlpha: .55, edgeFadeStart: .8, focusEaseMs: 180, scatterMs: 430, assembleMs: 680, pointSize: 1.25, rotSpeed: .045, revealMs: 650, gridGain: .32
});
export const FILE_VIEW = freeze({
  "TREE": "tree",
  "GRID": "grid"
});

export const RECORD_TYPE = freeze({
  "BOND": "bond",
  "ARTWORK": "artwork"
});

export const ORGAN = freeze({
  "BRAIN": "corenyan-brain",
  "GATEWAY": "corenyan-gateway",
  "QQ": "onebot-qq",
  "REDIS": "corenyan-redis"
});

export const FILTER = freeze({ ALL: 'all', BONDS: 'bonds', ARTWORKS: 'artworks' });
export const TELEMETRY = freeze({ bpm: 72, mood: 80, energy: 85, cpuCores: 4, diaryEntries: 12, topicCount: 4, curiosityFloor: 30, moodWeight: 0.55, energyWeight: 0.45 });
export const LANGUAGE_EXTENSIONS = freeze({ json: ['json'], css: ['css'], md: ['md', 'markdown'], js: ['js', 'mjs', 'cjs', 'ts', 'jsx', 'tsx'], yaml: ['yml', 'yaml', 'toml', 'ini', 'conf'], html: ['html', 'htm', 'xml', 'svg'], sh: ['sh', 'bash', 'zsh', 'bat', 'ps1'] });

export const DIAL = freeze({ min: 0, max: 100, startAngle: 45, sweepAngle: 270 });
export const HEALTH_DIALS = freeze([
  { key: 'cpu', label: 'CPU', unit: 'PROCESSING', valueId: 'gaugeCpuPct', detailId: 'gaugeCpuLoadText', detail: '等待主机数据', icon: '<rect x="5" y="5" width="14" height="14" rx="3"/><path d="M9 1v4m6-4v4M9 19v4m6-4v4M1 9h4m-4 6h4m14-6h4m-4 6h4"/><rect x="9" y="9" width="6" height="6" rx="1"/>' },
  { key: 'memory', label: termText("{{concept.memory.en}}"), unit: 'WORKING SPACE', valueId: 'gaugeMemPct', detailId: 'gaugeMemDetailText', detail: '等待主机数据', icon: '<rect x="2" y="5" width="20" height="12" rx="2"/><path d="M6 9h4v4H6zm8 0h4v4h-4zM5 17v4m5-4v4m5-4v4m5-4v4"/>' },
  { key: 'disk', label: termText("{{health.storage.en}}"), unit: 'ARCHIVE', valueId: 'gaugeDiskPct', detailId: 'gaugeDiskDetailText', detail: '等待主机数据', icon: '<ellipse cx="12" cy="5" rx="8" ry="3"/><path d="M4 5v13c0 4 16 4 16 0V5M4 11c0 4 16 4 16 0"/>' },
  { key: 'mood', label: termText("{{health.mood.en}} / {{health.mood.zh}}"), unit: termText("{{health.mood.unit}}"), valueId: 'vitalHappinessVal', detailId: 'gaugeMoodDetail', detail: '此刻的情绪浓度', icon: '<circle cx="12" cy="12" r="9"/><path d="M8 9h.01M16 9h.01M7 14q5 7 10 0"/>' },
  { key: 'energy', label: termText("{{health.energy.en}} / {{health.energy.zh}}"), unit: 'RESERVE', valueId: 'vitalEnergyVal', detailId: 'gaugeEnergyDetail', detail: termText("保持{{health.curiosity.zh}}的燃料"), icon: '<path d="M13 2 5 14h6l-1 8 9-13h-6z"/>' },
  { key: 'curiosity', label: termText("{{health.curiosity.en}} / {{health.curiosity.zh}}"), unit: 'ESTIMATE', valueId: 'vitalCuriosityVal', detailId: 'gaugeCuriosityDetail', detail: termText("由情绪与{{health.energy.zh}}估算"), icon: '<path d="m12 2 2.5 7.5L22 12l-7.5 2.5L12 22l-2.5-7.5L2 12l7.5-2.5z"/>' }
]);

export const INSPECT_LABELS = freeze({
  bond: ['FAVORABILITY / FAMILIARITY', 'QQ', 'MINECRAFT', 'LAST UPDATED'],
  artwork: ['MODEL', 'FILE SIZE', 'CREATED', 'FORMAT']
});
export const MOTION = freeze({
  previewFrames: [
    { opacity: 0, transform: 'translateX(18px) scale(.98)' },
    { opacity: 1, transform: 'translateX(-2px) scale(1.003)', offset: 0.75 },
    { opacity: 1, transform: 'none' }
  ],
  previewOptions: { duration: 460, easing: 'cubic-bezier(.22,1,.36,1)' }
});

export const HEALTH = freeze({
  historyLimit: 1200, changeLimit: 30, chartWidth: 720, chartHeight: 180,
  titles: { cpu: 'CPU / 算力详情', memory: termText("{{concept.memory.en}} / {{health.memory.zh}}详情"), disk: termText("{{health.storage.en}} / {{health.storage.zh}}详情"), mood: termText("{{health.mood.en}} / {{health.mood.zh}}变化"), energy: termText("{{health.energy.en}} / {{health.energy.zh}}变化"), curiosity: termText("{{health.curiosity.en}} / {{health.curiosity.zh}}变化") },
  historyNote: '本页打开后的采样记录，最多保留 1 小时；刷新页面后清空。',
  missing: '暂无数据'
});
export const EFFECTS = freeze({
  excludedRegions: '[data-no-particles], .synapse-terminal-frame, .CodeMirror, .cm-editor, .monaco-editor, input, textarea, select, [contenteditable="true"], [role="textbox"], [role="menu"], .context-menu, .fm-context-menu, .chat-menu, .chat-composer, button, [role="button"]',
  maxDpr: 1.5, frameMs: 1000 / 30, maxDelta: 0.05,
  orbitCount: 3, particleLimit: 48,
  ink: '238,238,238'
});

export const WAVE_HEALTH = freeze({
  smoothingSeconds: 1.2, pressureWeights: { cpu: .6, memory: .25, disk: .15 },
  modeRate: { SLEEPING: .72, THINKING: 1, SURFING: 1.04, DRAWING: .96 },
  pressureBpm: 12, moodBpm: 8, amplitudeBase: .55, energyAmplitude: .55,
  intervalBase: .045, pressureVariation: .12, moodVariation: .08,
  respirationBase: .16, pressureRespiration: .14, energyRespiration: .04
});
export const DOODLE_PARTICLES = freeze({
  shapes: ['star'],
  lifetime: .6, burstCount: 8, speedMin: 190, speedMax: 350,
  gravity: 380, drag: 1.4, sizeMin: 5, sizeMax: 11, spin: 4,
  backgroundAlpha: .13
});

export const FILE_ICONS = freeze({ folder: '<svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="1.5" aria-hidden="true"><path d="M4 9 H14 L17 13 H32 V29 H4 Z"/><line x1="4" y1="15" x2="32" y2="15" opacity="0.5"/></svg>' });

export const TRASH_PREVIEW = freeze({ allScope: 'all', maxTextBytes: 65536, maxEntries: 200 });

export const WORKSPACE_API = freeze({layers:'/api/layers',banner:'/api/layers/banner',search:'/api/fs/search'});
export const FILE_SEARCH = freeze({delayMs:300,all:'all',maxQuery:200});

export const TERMINAL_BLOCKS=freeze({minRows:8,minColumns:21,maxRows:200,maxColumns:200,quietZone:4,scale:6});

export const EVIDENCE_UI=freeze({
 channels:{qq_group_:'QQ 群聊',qq_priv_:'QQ 私聊',mc_public:'Minecraft 公屏',mc_priv_:'Minecraft 私聊'},
 unknown:'交流途径未记录',imageUnavailable:'图片无法加载，原链接可能已过期或不可访问。'
});

export const PROCESS_TELEMETRY=freeze({socketPath:'/var/run/docker.sock',timeoutMs:2600,cacheMs:2500,maxResponseBytes:1048576,historyLimit:40,units:['B','KiB','MiB','GiB']});

export const ENTITY_FLEET=freeze({"command":{"pointBudget":245000,"escorts":[{"position":[-2.9,-0.22,-4],"scale":0.8,"yaw":-0.08},{"position":[2.9,-0.22,-4],"scale":0.8,"yaw":0.08},{"position":[-3.1,-0.12,1.6],"scale":0.7,"yaw":-0.08},{"position":[3.1,-0.12,1.6],"scale":0.7,"yaw":0.08}],"funnels":[{"position":[-2.6,0.3,-3],"scale":0.65,"yaw":-0.12},{"position":[-2.6,0.3,-0.2],"scale":0.65,"yaw":-0.12},{"position":[-2.6,0.3,2.6],"scale":0.65,"yaw":-0.12},{"position":[2.6,0.3,-3],"scale":0.65,"yaw":0.12},{"position":[2.6,0.3,-0.2],"scale":0.65,"yaw":0.12},{"position":[2.6,0.3,2.6],"scale":0.65,"yaw":0.12}],"turrets":[{"position":[-0.86,0.65,-3.2],"scale":0.72,"yaw":-0.4,"barrels":3},{"position":[-0.86,0.65,-0.5],"scale":0.72,"yaw":-0.4,"barrels":3},{"position":[-0.86,0.65,2.8],"scale":0.72,"yaw":-0.4,"barrels":3},{"position":[-0.58,0.25,-5.1],"scale":0.36,"yaw":-0.4,"barrels":2},{"position":[-0.58,0.25,-3.8],"scale":0.36,"yaw":-0.4,"barrels":2},{"position":[-1.2,0.2,-1.5],"scale":0.36,"yaw":-0.4,"barrels":2},{"position":[-1.2,0.2,1],"scale":0.36,"yaw":-0.4,"barrels":2},{"position":[-1.2,0.2,3.5],"scale":0.36,"yaw":-0.4,"barrels":2},{"position":[-1.2,0.2,4.65],"scale":0.36,"yaw":-0.4,"barrels":2},{"position":[0.86,0.65,-3.2],"scale":0.72,"yaw":0.4,"barrels":3},{"position":[0.86,0.65,-0.5],"scale":0.72,"yaw":0.4,"barrels":3},{"position":[0.86,0.65,2.8],"scale":0.72,"yaw":0.4,"barrels":3},{"position":[0.58,0.25,-5.1],"scale":0.36,"yaw":0.4,"barrels":2},{"position":[0.58,0.25,-3.8],"scale":0.36,"yaw":0.4,"barrels":2},{"position":[1.2,0.2,-1.5],"scale":0.36,"yaw":0.4,"barrels":2},{"position":[1.2,0.2,1],"scale":0.36,"yaw":0.4,"barrels":2},{"position":[1.2,0.2,3.5],"scale":0.36,"yaw":0.4,"barrels":2},{"position":[1.2,0.2,4.65],"scale":0.36,"yaw":0.4,"barrels":2},{"position":[0,0.2,-5.8],"scale":0.65,"yaw":0,"barrels":3},{"position":[0,0.35,-4.6],"scale":0.65,"yaw":0,"barrels":3},{"position":[0,0.4,-3.5],"scale":0.65,"yaw":0,"barrels":3},{"position":[0,0.4,-2.4],"scale":0.65,"yaw":0,"barrels":3},{"position":[0,0.4,-1.3],"scale":0.65,"yaw":0,"barrels":3},{"position":[0,0.5,3.8],"scale":0.65,"yaw":0,"barrels":3}]},"sensor":{"pointBudget":80000,"escorts":[{"position":[-2.65,-0.1,-0.5],"scale":0.7,"yaw":-0.12,"barrels":2},{"position":[2.45,-0.1,-0.5],"scale":0.7,"yaw":0.12,"barrels":2}],"funnels":[],"turrets":[{"position":[-0.65,0.3,1.8],"scale":0.65,"yaw":-0.4,"barrels":2},{"position":[0.65,0.3,1.8],"scale":0.65,"yaw":0.4,"barrels":2}]},"courier":{"pointBudget":80000,"escorts":[],"funnels":[{"position":[-1.65,0.1,-0.45],"scale":0.65,"yaw":-0.15,"barrels":2},{"position":[1.65,0.1,-0.45],"scale":0.65,"yaw":0.15,"barrels":2}],"turrets":[{"position":[-0.9,0.16,1],"scale":0.55,"yaw":-0.1,"barrels":2},{"position":[0.9,0.16,1],"scale":0.55,"yaw":0.1,"barrels":2}]},"relay":{"pointBudget":85000,"escorts":[],"funnels":[{"position":[-1.4,0.1,-0.3],"scale":0.75,"yaw":-0.3,"barrels":2},{"position":[1.4,0.1,-0.3],"scale":0.75,"yaw":0.3,"barrels":2}],"turrets":[{"position":[-0.85,0.3,-1.9],"scale":0.6,"yaw":-0.3,"barrels":2},{"position":[0.85,0.3,-1.9],"scale":0.6,"yaw":0.3,"barrels":2},{"position":[0,0.5,1.3],"scale":0.7,"yaw":0,"barrels":2}]},"ark":{"pointBudget":85000,"escorts":[{"position":[0,0.15,-3.35],"scale":0.8,"yaw":0,"barrels":2},{"position":[-2.5,-0.3,0.6],"scale":0.7,"yaw":-0.2,"barrels":2}],"funnels":[],"turrets":[{"position":[-1.16,0.44,-1.7],"scale":0.65,"yaw":-0.3,"barrels":2},{"position":[-1.16,0.44,1.7],"scale":0.65,"yaw":-0.3,"barrels":2},{"position":[1.16,0.44,-1.7],"scale":0.65,"yaw":0.3,"barrels":2},{"position":[1.16,0.44,1.7],"scale":0.65,"yaw":0.3,"barrels":2}]}});

export const ENTITY_COMMAND=freeze({"prowTip":-7.2,"sternTip":5.8,"launchLength":4.4,"engineCenter":4.25,"hangarStations":[-2.1,-0.95,0.2,1.35,2.5],"shoulderStations":[-2.7,-1.5,-0.3,0.9,2.1,3.3],"reactorStations":[-1.5,1.1],"missileStations":[-3,3.25],"spineStations":[-3.3,-2.35,-1.4,-0.45]});

export const MODEL_PRESETS=freeze({
 api:'/api/model-presets',scope:'model_presets',
 kinds:['text','vision','image','video'],labels:{text:'文字',vision:'视觉',image:'生图',video:'视频'},
 defaults:{
  text:{base_url:'',model:'',temperature:.8,max_tokens:3000,timeout_ms:90000},
  vision:{base_url:'',model:'',temperature:.1,max_tokens:1200,timeout_ms:25000},
  image:{base_url:'',model:'',enabled:true,api_mode:'images',size:'auto',timeout_ms:120000},
  video:{base_url:'',model:'',enabled:true,api_mode:'workbuddy',seconds:5,timeout_ms:30000}
 }
});

export const SETTINGS=freeze({storageKey:'corenyan.website.v1',textSizes:['standard','large'],displayScales:['auto','100','110','120','125','150'],accountApi:'/api/auth/session'});

export const UI_MOTION=freeze({
 enterEase:'cubic-bezier(.2,.9,.25,1)',exitEase:'cubic-bezier(.4,0,.7,1)',
 dialog:{openMs:460,closeMs:240,enter:{opacity:0,transform:'translate3d(0,42px,0) scale(.92)'},exit:{opacity:0,transform:'translate3d(0,28px,0) scale(.95)'}},
 menu:{openMs:220,closeMs:150,enter:{opacity:0,transform:'translate3d(0,10px,0) scale(.94)'},exit:{opacity:0,transform:'translate3d(0,6px,0) scale(.97)'}},
 panel:{duration:300,frames:[{opacity:0,transform:'translateY(14px)'},{opacity:1,transform:'none'}]}
});

export const PRESET_EDITOR=freeze({
 autosaveMs:900,reorder:{edge:36,scrollPixelsPerSecond:480,maxFrameMs:32,yieldMs:180,settleMs:180,easing:'cubic-bezier(.2,.8,.2,1)'},
 actions:{create:'创建预设',save:'保存修改',retry:'重试保存',clone:'克隆预设',rename:'重命名文件',copySuffix:'副本'},newFilePrefix:'new-preset',
 requiredFields:[['id','文件路径'],['name','名称'],['settings.base_url','请求地址'],['settings.model','模型标识']],
 version:1,maxBackups:15,maxModelIds:16,storageKey:'corenyan.preset-editor.kind',modes:{form:'表单编辑',json:'完整 JSON'},
 discovery:{path:'/models',timeoutMs:12000,maxBytes:1048576,maxItems:2000,maxConcurrent:4,maxRedirects:2},
 descriptions:{text:'对话、推理与工具决策',vision:'图片理解与参考图分析',image:'图像生成与参考图编辑',video:'文字或参考图生成视频'},
 groups:[{id:'connection',label:'模型配置'},{id:'timeouts',label:'超时与重试'},{id:'image',label:'媒体生成'}],
 fields:[
  {path:'base_url',label:'接口完整请求地址',type:'url',group:'connection',required:true,wide:true},
  {path:'api_key',label:'接口密钥',type:'password',group:'connection',wide:true},
  {path:'model',label:'模型 ID',type:'model-list',group:'connection',wide:true},
  {path:'temperature',label:'随机程度',type:'number',min:0,max:2,step:.05,group:'connection',kinds:['text','vision']},
  {path:'max_tokens',label:'最大输出词元数',type:'number',min:1,max:1000000,group:'connection',kinds:['text','vision']},
  {path:'enabled',label:'启用生成',type:'boolean',group:'image',kinds:['image','video']},
  {path:'api_mode',label:'接口模式',type:'select',options:[['auto','自动'],['chat','对话接口'],['images','图像接口'],['workbuddy','WorkBuddy 视频接口'],['videos','OpenAI 视频接口']],group:'image',kinds:['image','video']},
  {path:'size',label:'图片尺寸',type:'text',group:'image',kinds:['image']},
  {path:'seconds',label:'视频时长（秒）',type:'number',min:1,max:60,group:'image',kinds:['video']},
  {path:'resolution',label:'视频分辨率',type:'text',group:'image',kinds:['video']},
  {path:'aspect_ratio',label:'视频宽高比',type:'text',group:'image',kinds:['video']},
  {path:'enable_audio',label:'生成视频声音',type:'boolean',group:'image',kinds:['video']},
  {path:'character_reference_path',label:'角色参考图路径',type:'text',wide:true,group:'image',kinds:['image']},
  {path:'timeout_ms',label:'请求超时（毫秒）',type:'number',min:100,max:900000,group:'timeouts'},
  {path:'fast_timeout_ms',label:'快速请求超时（毫秒）',type:'number',min:100,max:900000,group:'timeouts',kinds:['text']},
  {path:'attention_timeout_ms',label:'注意力判断超时（毫秒）',type:'number',min:100,max:900000,group:'timeouts',kinds:['text']},
  {path:'retry.max_total_attempts',label:'调用总尝试次数',type:'number',min:1,max:21,group:'timeouts'},
  {path:'retry.delay_ms',label:'重试间隔（毫秒）',type:'number',min:0,max:60000,group:'timeouts'},
  {path:'non_owner_cooldown_seconds',label:'普通用户冷却（秒）',type:'number',min:0,max:86400,group:'image',kinds:['image']},
  {path:'non_owner_hourly_limit',label:'普通用户每小时上限',type:'number',min:0,max:100000,group:'image',kinds:['image']},
  {path:'group_cooldown_seconds',label:'群冷却（秒）',type:'number',min:0,max:86400,group:'image',kinds:['image']}
 ]
});

export const EXPLORER_DRAG=freeze({mime:'application/x-corenyan-files',row:'.tree-node-row,.grid-slice-card',folder:'[data-rel-path][data-is-dir="1"]'});

export const CHAT_UI=freeze({api:'/api/v1/chat',assistantName:termText('{{character.name}}'),avatar:'/assets/doodle/doodle_1.png',pollMs:1500,searchMs:250,chunkBytes:262144,maxFileBytes:67108864,maxFiles:12,attachmentExitMs:160,fileTypes:{document:['doc','docx','odt','rtf','pdf','txt','md'],spreadsheet:['xls','xlsx','ods','csv'],presentation:['ppt','pptx','odp'],archive:['zip','7z','rar','tar','gz'],audio:['mp3','wav','ogg','flac','m4a'],video:['mp4','webm','mov','mkv']}});

export const ONEBOT_LOGIN=freeze({api:'/api/onebot/login',layer:'onebot-qq',pollMs:2000,backgroundPollMs:15000,offlineNotice:'QQ 已离线，请到 SYNAPSE → 交流层-QQ 查看登录状态。'});

export const AVATAR_CROP=freeze({types:["image/png","image/jpeg","image/webp"],maxBytes:10*1024*1024,previewSize:512,outputSize:256,maxZoom:5,zoomStep:.01,buttonStep:.25,wheelScale:.0015,panStep:.025,title:"裁剪头像",cancel:"取消",apply:"使用头像",reset:"恢复居中",zoom:"缩放",zoomIn:"放大",zoomOut:"缩小",canvasLabel:"头像裁剪区域，可拖动或使用方向键调整位置",invalidFile:"请选择小于 10 MB 的 PNG、JPEG 或 WebP",invalidImage:"图片无法读取，请换一张图片"});

export const EXPLORER_SELECTION=freeze({row:'.tree-node-row,.grid-slice-card',holdMs:280,dragThreshold:6,edge:30,scrollStep:8});
export const TEXT_MENU=freeze({inset:8,labels:{undo:'撤销',redo:'重做',cut:'剪切',copy:'复制',paste:'粘贴',selectAll:'全选',copyAll:'复制全部日志',find:'查找',replace:'替换'},changed:'编辑内容已变化，请重新选择后操作。',clipboardDenied:'无法访问剪贴板，请允许剪贴板权限，或使用键盘快捷键。'});

export const RENDER_BUDGET=freeze({ambientMaxDpr:1,ambientFps:15,pointerFps:60,waveFps:30,entityMaxDpr:1.5});
