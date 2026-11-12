import {mountExplorerSelection} from './explorer-selection.js';
import {mountTextContextMenu} from './text-context-menu.js';
import {nextDoodle} from './random-doodle.js';
import {mountApiRecords} from './api-records.js';
import {platformClipboard,copyImage,notifyReply,notificationPermission} from './platform.js';
const editorShortcutLabel=id=>binding('files.'+id).replace('Mod',/Mac/.test(navigator.platform)?'⌘':'Ctrl');
import {shortcut,editorKeys,onPreferences,binding} from './preferences.js';
import {mountExplorerDrag} from './explorer-drag.js';
import {closeDialog,setOverlayVisible,setMotionEnabled,reveal,dismissToast} from './ui-motion.js';
import {mountMobileLayout} from './mobile-layout.js';
import {mountChat} from './chat.js';
import {mountOnebotLogin} from './onebot-login.js';
import {mountSettings} from './settings.js';
import {createTerminalView} from './terminal-view.js';
import {SERVICE_CONTROL,sessionImpact} from './organ-control-policy.js';
import {mountModelPresets} from './model-presets.js';
import {evidenceChannel,renderEvidenceText,mountEvidenceImages} from './evidence-media.js';
import {terminalBlockSegments,renderTerminalBlocks} from './terminal-blocks.js';
import {mountLayerEditor} from './layer-editor.js';
import {mountWorkspaceSearch} from './workspace-search.js';
import { normalizeEditorText, isFileDirty, fileLineEnding, serializedFileContent } from './file-draft.js';
import { createNavigation } from './navigation.js';
import { bondPage } from './bond-list.js';
import { configureExplorer, moduleScopes, EXPLORER, isImageFile, isBinaryFile, scopeModule, configScope } from './explorer-model.js';
import { termText, termHtml, termTextTemplate, termHtmlTemplate, applyStaticTerminology } from './terminology.js';
import { mountRecycleBin } from './recycle-bin.js';
import { ONEBOT_LOGIN, MODEL_PRESETS, TRASH_PREVIEW, DOODLE_TOTAL, CHAPTER_META, TIMING, UI, EDITOR, API, LIFE_MODE_LABELS, ANSI_CLASSES, VIEW, FILE_VIEW, RECORD_TYPE, ORGAN, FILTER, TELEMETRY, LANGUAGE_EXTENSIONS, INSPECT_LABELS, MOTION, FILE_ICONS } from './constants.js';
import { StateRegistry, frameDebounce } from './state-registry.js';
import { mountWaveform } from './waveform.js';
import { mountHealthDials, renderHealthDials } from './health-dials.js';
import { mountHealthDetails, healthValues } from './health-details.js';
import { mountAmbientEffects } from './ambient-effects.js';
import { mountEntityView } from './entity-view.js';
import { entityPreview } from './entity-models.js';
/**
 * ============================================================================
 * CORENYAN // ANATOMICAL BIOSIGNAL CONSOLE (SWISS TELEMETRY EDITION V10.0)
 * Architecture: Single Source of Truth (SSOT) State Machine + Non-Blocking UI
 * Theme: Black canvas, white ink and hand-drawn instruments
 * ============================================================================
 */
(() => {
  'use strict';
  let inspectedKey = null;
  let inspectAnimation = null;
  let terminalView;

  // Single Source of Truth (SSOT) State
  const registry = new StateRegistry({
    activeView: VIEW.VITALS,
    busyOrgan: null,
    entityLayer: 'corenyan-brain',
    motionEnabled: !matchMedia('(prefers-reduced-motion: reduce)').matches,
    doodleIdx: nextDoodle(0, DOODLE_TOTAL),
    vitalsFilter: FILTER.ALL, // FILTER.ALL | FILTER.BONDS | FILTER.ARTWORKS
    lastVitalsPayload: null,
    healthDetail: null,
    healthHistory: [],
    trash: { open: false, scope: TRASH_PREVIEW.allScope, scopes: [], items: [], loading: false, busy: false, error: '', confirmIds: [], selected: [], query: '', preview: null, previewKey: '', previewLoading: false },
    bondsHash: '',
    artworksHash: '',
    organsHash: '',
    diaryHash: '',
    selectedRecord: null, // { type: RECORD_TYPE.BOND | RECORD_TYPE.ARTWORK, id: string }
    bondDetailCache: new Map(),

    // Lightbox State
    lightbox: {
      files: null,
      open: false,
      index: 0,
      zoom: 1,
      panX: 0,
      panY: 0,
      dragging: false,
      startX: 0,
      startY: 0
    },

    // File Manager & Coding IDE State
    fm: {
      scopes: [],
      module: EXPLORER.brain,
      selection: new Set(),
      currentScope: UI.defaultScope,
      viewMode: FILE_VIEW.TREE, // FILE_VIEW.TREE (LIST TREE inline expand/collapse) | FILE_VIEW.GRID (ICON GRID folder page)
      treeData: [],
      expandedDirs: new Set(),
      gridDir: '',
      gridItems: [],
      filterQuery: '',
      activeFile: null, // { scope, path, content, originalContent, size, mtime, lang }
      validationError: '',
      mdPreviewOpen: true,
      selected: null,
      clipboard: null, // { scope, sources: string[], mode: 'copy' | 'cut' }
      ctxTarget: null  // { relPath, isDir, name }
    },

    bondList: { page: 1, query: '' },

    // Neural Logs State
    logs: {
      organ: UI.defaultOrgan,
      lines: UI.logLines,
      filter: '',
      autoRefresh: true,
      rawText: ''
    },

    // Endocrine Brain Config State
    endocrine: {
      rawText: '',
      originalText: '',
      dirty: false
    },

    // Dialog Callback
    dialogResolver: null,
    dialog: null,
    dossier: { open: false, id: '', bond: null, error: '' },
    contextMenu: { open: false, x: 0, y: 0 },
    telemetryError: '',
  });
  const state = registry.state;
  const requests = { vitals: null, files: 0, file: 0, logs: 0, config: 0 };
  let fmEditorView, configEditorView, layerEditor, workspaceSearch;
  const syncingEditors = new WeakSet();
  const historyDrafts = new Map();
  const navigation = createNavigation({ snapshot: navigationSnapshot, restore: restoreNavigation, flush: () => registry.flush(), onError: error => showToast(error.message, true), invalidate: () => { ++requests.file; ++requests.files; ++requests.logs; } });

  function navigationSnapshot() {
    const art = state.lightbox.open ? getCurrentLightboxArtwork() : null;
    return { view: state.activeView, scope: state.fm.currentScope, dir: state.fm.gridDir, mode: state.fm.viewMode,
      file: state.fm.activeFile?.scope === state.fm.currentScope ? state.fm.activeFile.path : '',
      chatThread:state.chat?.threadId||'', organ: state.logs.organ, entityLayer: state.entityLayer, image: art?.path || art?.name || '', imageScope: art?.scope || '', bond: state.dossier.open ? state.dossier.id : '', bondPage: state.bondList.page, bondQuery: state.bondList.query };
  }

  async function restoreNavigation(route, isCurrent) {
    ++requests.file; ++requests.files; ++requests.logs;
    const active = state.fm.activeFile;
    if (isFileDirty(active)) historyDrafts.set(active.scope + ':' + active.path, { ...active });
    else if (active) historyDrafts.delete(active.scope + ':' + active.path);
    state.lightbox.open = false; state.dossier.open = false; state.contextMenu.open = false;
    state.activeView = route.view;
    if(state.chat)state.chat.threadId=route.chatThread||'';
    state.entityLayer = route.entityLayer || 'corenyan-brain';
    state.bondList.page = route.bondPage; state.bondList.query = route.bondQuery;
    $('bondSearchInput').value = route.bondQuery;
    if (route.view === VIEW.MEMORY) {
      if (!state.fm.scopes.length) await loadFileScopes(false);
      if (!isCurrent()) return;
      const scope = state.fm.scopes.some(item => item.id === route.scope) ? route.scope : UI.defaultScope;
      state.fm.viewMode = route.mode;
      const sameFile = active?.scope === scope && active?.path === route.file;
      if (state.fm.currentScope !== scope || !sameFile) await selectFileScope(scope, false);
      if (!isCurrent()) return;
      state.fm.gridDir = route.dir;
      if (scope !== EXPLORER.configScope) await refreshCurrentScopeFiles();
      if (!isCurrent()) return;
      if (route.file && scope !== EXPLORER.configScope) {
        route.file.split('/').slice(0,-1).reduce((parent, part) => { const path = parent ? parent + '/' + part : part; state.fm.expandedDirs.add(path); return path; }, '');
        if (!sameFile) await openCortexFile(scope, route.file, false);
        else state.fm.activeFile = active;
        if (!isCurrent()) return;
        state.fm.selected = { scope, relPath: route.file, name: route.file.split('/').pop(), isDir: false };
        state.fm.selection.add(route.file);
      }
    }
    if (route.view === VIEW.NEURAL) {
      const available = [...$('logOrganSelect').options].map(option => option.value);
      state.logs.organ = available.includes(route.organ) ? route.organ : UI.defaultOrgan;
      await fetchNeuralLogs();
    }
    if (!isCurrent()) return;
    if (route.bond) await openBondDossierModal(route.bond);
    if (!isCurrent()) return;
    if (route.image) {
      if (route.imageScope && state.fm.scopes.some(scope => scope.id === route.imageScope)) {
        await openCortexFile(route.imageScope, route.image, false);
        if (!isCurrent()) return;
        if (state.fm.activeFile?.lang === 'image') openCortexImage();
      } else {
        const index = (state.lastVitalsPayload?.artworks || []).findIndex(art => art.name === route.image);
        if (index >= 0) openArtworkLightbox(index);
      }
    }
  }


  const $ = (id) => document.getElementById(id);

  function createEditor(id, onChange, onSave, cursorId) {
    const textarea = $(id);
    const surface = textarea.closest('.ide-code-surface');
    surface.querySelector('.ide-gutter')?.remove();
    surface.querySelector('.ide-highlight-layer')?.remove();
    const view = CodeMirror.fromTextArea(textarea, {
      lineNumbers: true, lineWrapping: false, indentUnit: EDITOR.indent,
      gutters: [...EDITOR.gutters], foldGutter: true,
      foldOptions: {rangeFinder: CodeMirror.fold.brace},
      tabSize: EDITOR.indent, mode: EDITOR.modes.txt,
      extraKeys: editorKeys(onSave),
    });
    onPreferences(()=>view.setOption('extraKeys',editorKeys(onSave)));
    view.on('change', cm => { if (!syncingEditors.has(cm)) onChange(cm.getValue()); });
    view.on('cursorActivity', frameDebounce(() => {
      const cursor = view.getCursor();
      $(cursorId).textContent = `LN ${cursor.line + 1}, COL ${cursor.ch + 1}`;
    }));
    const observer = new ResizeObserver(frameDebounce(() => view.refresh()));
    observer.observe(surface);
    return view;
  }

  function syncEditor(view, content, lang, readOnly = false) {
    if (!view) return;
    // Never reset the document/cursor/undo stack for ordinary typing.
    const normalized = normalizeEditorText(content);
    if (view.getValue() !== normalized) {
      syncingEditors.add(view);
      try { view.setValue(normalized); } finally { syncingEditors.delete(view); }
    }
    const mode = EDITOR.modes[lang] || EDITOR.modes.txt;
    if (view.getOption('mode') !== mode) view.setOption('mode', mode);
    if (view.getOption('readOnly') !== readOnly) view.setOption('readOnly', readOnly);
  }

  function renderFileEditor() {
    const active = state.fm.activeFile;
    $('fmFileTimes').classList.toggle('is-hidden', !active);
    for (const [id, value] of [['fmCreatedTime', active?.birthtime], ['fmModifiedTime', active?.mtime]]) {
      const date = Number.isFinite(value) && value > 0 ? new Date(value) : null;
      $(id).textContent = date ? date.toLocaleString(UI.locale, {hour12:false}) : '未知';
      if (date) $(id).dateTime = date.toISOString(); else $(id).removeAttribute('datetime');
    }
    const image = active?.lang === 'image';
    $('fmImagePreview').classList.toggle('is-hidden', !image);
    $('fmEditorBodyWrap').classList.toggle('is-hidden', image);
    if (image) { $('fmPreviewImage').src = previewUrl(active.scope, active.path); $('fmPreviewMeta').textContent = `${active.path} · ${formatBytes(active.size)}`; }
    else $('fmPreviewImage').removeAttribute('src');
    syncEditor(fmEditorView, active?.lang === 'binary' ? '二进制文件 · 可下载、复制、移动或重命名，不能作为文本编辑。' : active?.content ?? '', active?.lang, !active || image || active?.lang === 'binary');
    $('fmEditorPath').textContent = active ? `${active.scope} :: ${active.path}` : termText("NO {{concept.file.en}} SELECTED");
    $('fmLangBadge').textContent = active?.lang.toUpperCase() || 'IDLE';
    for (const id of ['fmBtnSaveFile', 'fmBtnDeleteFile', 'fmBtnDownloadCurrent']) $(id).disabled = !active;
    const canSave = isFileDirty(active) && !active.saving;
    $('fmBtnSaveFile').disabled = !canSave;
    $('fmBtnSaveFile').classList.toggle('primary-bone', canSave);
    $('fmEditorPath').dataset.dirty = String(isFileDirty(active));
    if (isFileDirty(active)) $('fmEditorPath').textContent += ' ●';
    $('fmCursorMeta').classList.toggle('is-hidden', image);
    $('fmBtnFormatJson').classList.toggle('is-hidden', active?.lang !== 'json');
    $('fmBtnToggleMdPreview').classList.toggle('is-hidden', active?.lang !== 'md');
    updateFmDirtyIndicator();
    syncMarkdownSplitPane();
  }

  function initSubscriptions() {
    registry.subscribe(['activeView', 'fm.currentScope', 'fm.gridDir', 'fm.viewMode', 'fm.activeFile.path', 'logs.organ', 'entityLayer', 'chat.threadId', 'lightbox.open', 'lightbox.index', 'dossier.open', 'dossier.id', 'bondList'], () => navigation.commit(), false);
    registry.subscribe(['bondList'], () => { renderBondsLedger(state.lastVitalsPayload?.topBonds || []); reconcileLedgerSelection(); });
    registry.subscribe(['activeView'], () => {
      document.querySelectorAll('.chapter-tab').forEach(btn => {
        const active = btn.dataset.view === state.activeView;
        btn.classList.toggle('active', active);
        btn.setAttribute('aria-current', active ? 'page' : 'false');
      });
      document.querySelectorAll('.chapter-view').forEach(section => section.classList.toggle('active', section.id === `view-${state.activeView}`));
      const meta = CHAPTER_META[state.activeView];
      $('stageHeaderChapter').textContent = meta.code;
      $('stageHeaderTitle').textContent = meta.title;
      $('stageHeaderSub').textContent = meta.sub;
      document.body.classList.toggle('entity-active', state.activeView === VIEW.ENTITY);
      document.body.classList.toggle('chat-active', state.activeView === VIEW.CHAT);
      fmEditorView?.refresh(); configEditorView?.refresh();
    });
    registry.subscribe(['motionEnabled'], () => {
      document.body.classList.toggle('motion-off', !state.motionEnabled);
      setMotionEnabled(state.motionEnabled);
      document.body.classList.toggle('entity-active', state.activeView === VIEW.ENTITY);
      if (!state.motionEnabled) inspectAnimation?.cancel();




    });
    registry.subscribe(['doodleIdx'], () => {
      const src = `/assets/doodle/doodle_${state.doodleIdx}.png`;
      $('spineAvatarImg').src = src; $('vitalAvatarImg').src = src;
      $('doodleIndexTag').textContent = `#${pad2(state.doodleIdx)}`;
      $('heroDoodleBadge').textContent = termTextTemplate`{{concept.doodle.en}} #${pad2(state.doodleIdx)} ↻`;
    });
    registry.subscribe(['lastVitalsPayload'], renderVitals);
    registry.subscribe(['telemetryError'], () => {
      $('telemetryStatus').textContent = state.telemetryError ? `连接中断 · ${state.telemetryError}` : termText("LIVE {{concept.telemetry.en}}");
      $('telemetryStatus').classList.toggle('danger-text', Boolean(state.telemetryError));
    });
    registry.subscribe(['selectedRecord', 'bondDetailCache', 'lastVitalsPayload'], renderSelectedRecord);
    registry.subscribe(['vitalsFilter'], () => {
      document.querySelectorAll('#vitalsSubFilterTabs .ledger-filter-btn').forEach(btn => btn.classList.toggle('active', btn.dataset.section === state.vitalsFilter));
      $('ledgerBlockBonds').classList.toggle('is-hidden', state.vitalsFilter === FILTER.ARTWORKS);
      $('ledgerBlockArtworks').classList.toggle('is-hidden', state.vitalsFilter === FILTER.BONDS);

    });
    registry.subscribe(['lightbox'], () => {
      setOverlayVisible($('artLightboxBackdrop'), Boolean(state.lightbox.open));
      if (state.lightbox.open) { syncLightboxView(); applyLightboxTransform(); }
    });
    registry.subscribe(['dossier'], renderBondDossier);
    let previousDialog;
    registry.subscribe(['dialog'], () => {
      const dialog = state.dialog;
      setOverlayVisible($('wireDialogBackdrop'), Boolean(dialog));
      if (dialog) {
        $('wireDialogTitle').textContent = dialog.title;
        $('wireDialogMessage').textContent = dialog.message;
        const input = $('wireDialogInput');
        input.classList.toggle('is-hidden', !dialog.input);
        input.value = dialog.value; input.placeholder = dialog.placeholder;
        if (previousDialog !== dialog) {
          if (dialog.input) { input.focus(); input.select(); }
          else $('wireDialogConfirmBtn').focus();
        }
      }
      previousDialog = dialog;
    });
    registry.subscribe(['contextMenu', 'fm.clipboard', 'fm.currentScope'], () => {
      const menu = $('fmContextMenu');
      setOverlayVisible(menu,state.contextMenu.open,'menu');
      const target = state.fm.ctxTarget;
      if (target) $('ctxMenuTargetName').textContent = `${target.isDir ? 'DIR' : 'FILE'} // ${target.name}`;
      const disabled = !state.fm.clipboard || state.fm.clipboard.scope !== state.fm.currentScope;
      $('ctxMenuPasteBtn').disabled = disabled; $('fmBtnPasteRoot').disabled = disabled;
      menu.style.left = `${Math.max(UI.viewportInset, Math.min(state.contextMenu.x, innerWidth - UI.menuWidth))}px`;
      menu.style.top = `${Math.max(UI.viewportInset, Math.min(state.contextMenu.y, innerHeight - UI.menuHeight))}px`;
    });
    registry.subscribe(['fm.scopes', 'fm.currentScope', 'fm.module'], () => {
      renderScopeTabs();
      const config = state.fm.currentScope === EXPLORER.configScope;
      $('fmConfigPanel').classList.toggle('is-hidden', !config);
      $('fmFilePanel').classList.toggle('is-hidden', config);
      document.querySelector('.cortex-explorer-pane').classList.toggle('is-hidden', config);
      document.querySelector('.cortex-workbench-grid').classList.toggle('config-open', config);
      configEditorView?.refresh();
      const scope = moduleScopes(state.fm.scopes, state.fm.module).find(s => s.id === state.fm.currentScope);
      if (scope) $('fmCurrentScopeDesc').textContent = `${scope.label.toUpperCase()} // ROOT: ${scope.sub}`;
    });
    registry.subscribe(['fm.viewMode', 'fm.treeData', 'fm.gridItems', 'fm.gridDir', 'fm.filterQuery', 'fm.expandedDirs', 'fm.activeFile.path'], () => {
      $('fmBtnViewTree').classList.toggle('active', state.fm.viewMode === FILE_VIEW.TREE);
      $('fmBtnViewGrid').classList.toggle('active', state.fm.viewMode === FILE_VIEW.GRID);
      $('fmBtnExpandAll').textContent = state.fm.expandedDirs.size ? '[-]' : '[+]';
      renderFileExplorer();
    });
    registry.subscribe(['fm.activeFile', 'fm.mdPreviewOpen', 'fm.validationError'], renderFileEditor);
    registry.subscribe(['logs'], () => {
      terminalView.update(ansiToHtml(state.logs.rawText, state.logs.filter), state.logs.organ+'|'+state.logs.filter+'|'+state.logs.lines);
      $('logOrganSelect').value = state.logs.organ; $('logLinesSelect').value = String(state.logs.lines);
      $('logAutoRefreshCheck').checked = state.logs.autoRefresh;
      const sourceLabel=`SOURCE: ${state.logs.source || state.logs.organ}`;
      if($('logSourceStatus').textContent!==sourceLabel)$('logSourceStatus').textContent=sourceLabel;
    });
    registry.subscribe(['logs.organ','lastVitalsPayload','busyOrgan','fm.scopes'],renderLogControls);
    registry.subscribe(['endocrine.rawText', 'endocrine.originalText'], () => {
      syncEditor(configEditorView, state.endocrine.rawText, 'json');
      refreshEndocrineIde();
    });
  }

  // ==========================================================================
  // 1. UTILITY & FORMATTING HELPERS
  // ==========================================================================
  function escapeHtml(str) {
    return String(str ?? '')
      .replace(/&/g, '&amp;')
      .replace(/</g, '&lt;')
      .replace(/>/g, '&gt;')
      .replace(/"/g, '&quot;');
  }

  function formatBytes(bytes) {
    const n = Number(bytes) || 0;
    if (n < 1024) return `${n} B`;
    if (n < 1024 * 1024) return `${(n / 1024).toFixed(1)} KB`;
    if (n < 1024 * 1024 * 1024) return `${(n / (1024 * 1024)).toFixed(1)} MB`;
    return `${(n / (1024 * 1024 * 1024)).toFixed(1)} GB`;
  }

  function formatUptime(sec) {
    const s = Math.max(0, Math.floor(Number(sec) || 0));
    const d = Math.floor(s / 86400);
    const h = Math.floor((s % 86400) / 3600);
    const m = Math.floor((s % 3600) / 60);
    if (d > 0) return `${d}d ${h}h`;
    if (h > 0) return `${h}h ${m}m`;
    return `${m}m ${s % 60}s`;
  }

  function formatTimeAgo(ts) {
    if (!ts) return 'NEVER';
    const diff = Math.max(0, Date.now() - Number(ts));
    const sec = Math.floor(diff / 1000);
    if (sec < 10) return 'JUST NOW';
    if (sec < 60) return `${sec}S AGO`;
    const min = Math.floor(sec / 60);
    if (min < 60) return `${min}M AGO`;
    const hr = Math.floor(min / 60);
    if (hr < 24) return `${hr}H AGO`;
    return `${Math.floor(hr / 24)}D AGO`;
  }

  function pad2(n) {
    return String(n ?? 0).padStart(2, '0');
  }

  function showToast(msg, isDanger = false) {
    const box = $('toastContainer');
    if (!box) return;
    const item = document.createElement('div');
    item.className = `wire-toast${isDanger ? ' toast-danger' : ''}`;
    item.textContent = `[${new Date().toLocaleTimeString(UI.locale, { hour12: false })}] ${msg}`;
    box.appendChild(item);reveal(item);
    setTimeout(() => dismissToast(item), TIMING.toast);
  }

  async function apiFetch(url, options = {}) {
    const opts = { ...options };
    if (opts.body && typeof opts.body === 'object' && !(opts.body instanceof FormData)) {
      opts.headers = { 'Content-Type': 'application/json', ...(opts.headers || {}) };
      opts.body = JSON.stringify(opts.body);
    }
    const res = await fetch(url, opts);
    if(res.status===401){location.assign('/login?next='+encodeURIComponent(location.pathname+location.search));throw Error('会话已过期，请重新登录');}
    const contentType = res.headers.get('content-type') || '';
    if (contentType.includes('application/json')) {
      const data = await res.json();
      if (!res.ok || data.ok === false) {
        throw new Error(data.error || `HTTP ${res.status}`);
      }
      return data;
    }
    if (!res.ok) throw new Error(`HTTP ${res.status}`);
    return res;
  }

  function openWireDialog({ title = 'SYSTEM PROMPT', message = '', defaultValue = null, placeholder = '' }) {
    if (state.dialogResolver) state.dialogResolver(false);
    return new Promise(resolve => {
      state.dialog = { title, message, value: defaultValue ?? '', input: defaultValue !== null, placeholder };
      state.dialogResolver = confirmed => {
        const result = confirmed ? (state.dialog.input ? state.dialog.value.trim() : true) : null;
        state.dialog = null;
        state.dialogResolver = null;
        resolve(result);
      };
    });
  }

  // ==========================================================================
  // 2. ARCHITECTURAL CHROME: CLOCK & DOODLE CYCLER
  // ==========================================================================
  function initEditorialChrome() {
    // 1. Live Shanghai Clock
    const tickClock = () => {
      const el = $('topbarLiveClock');
      if (!el) return;
      const now = new Date();
      el.textContent = now.toLocaleTimeString(UI.locale, { hour12: false, timeZone: UI.timezone });
    };
    tickClock();
    setInterval(tickClock, TIMING.clock);


    const cycleDoodle = () => { state.doodleIdx = nextDoodle(state.doodleIdx, DOODLE_TOTAL); };
    $('spineAvatarFrame')?.addEventListener('click', cycleDoodle);
    $('heroDoodleTrigger')?.addEventListener('click', cycleDoodle);
    document.querySelectorAll('.chapter-tab').forEach(btn => {
      btn.addEventListener('click', () => switchChapter(btn.dataset.view));
    });
    $('brandHomeTrigger')?.addEventListener('click', e => { e.preventDefault(); switchChapter(VIEW.VITALS); });
    $('btnHeroJumpCortex')?.addEventListener('click', () => switchChapter(VIEW.MEMORY));
    $('btnQuickViewLogs')?.addEventListener('click', () => switchChapter(VIEW.NEURAL));

    $('btnQuickRestartBrain')?.addEventListener('click', async () => {
      const ok = await openWireDialog({
        title: termText("RESTART {{organ.brain.en}}"),
        message: termText("确认向{{character.name}}{{organ.brain.zh}} (corenyan-brain) 发送热重启脉冲吗？")
      });
      if (!ok) return;
      await triggerOrganAction(ORGAN.BRAIN, 'restart');
    });



    // Expose switchChapter for cross-module jumps

  }

  // ==========================================================================
  // 3. DUAL-TRACE ECG / EEG OSCILLOSCOPE CANVAS (CHAPTER 01 FIG. 01)
  // ==========================================================================
  function switchChapter(viewId) {
    if (viewId === VIEW.ENDOCRINE) { switchChapter(VIEW.MEMORY); selectFileScope(EXPLORER.configScope); return; }
    if (!CHAPTER_META[viewId]) return;
    navigation.userNavigation();
    state.lightbox.open = false; state.dossier.open = false;
    state.activeView = viewId;
    if (viewId === VIEW.MEMORY && !state.fm.scopes.length) loadFileScopes();
    else if (viewId === VIEW.NEURAL) fetchNeuralLogs();
    else if (viewId === VIEW.ENDOCRINE && !state.endocrine.rawText) loadBrainConfig();
  }

  // ==========================================================================
  // 4. VITALS TELEMETRY POLLING, LEDGER, LIVE INSPECTOR & BRAIN MATRIX
  // ==========================================================================
  async function pollVitals() {
    if (requests.vitals) return requests.vitals;
    requests.vitals = (async () => {
      try { state.lastVitalsPayload = await apiFetch(API.VITALS); state.telemetryError = ''; }
      catch (err) { state.telemetryError = err.message; }
      finally { requests.vitals = null; }
    })();
    return requests.vitals;
  }

  function renderVitals() {
      const data = state.lastVitalsPayload;
      if (!data) return;
      const { host = {}, vitals = {}, organs = [], models = {}, counts = {}, topBonds = [], artworks = [] } = data;

      if ($('topCpuVal')) $('topCpuVal').textContent = `${host.cpuPercent ?? 0}%`;
      if ($('topMemVal')) $('topMemVal').textContent = `${host.memPercent ?? 0}%`;
      if ($('topDiskVal')) $('topDiskVal').textContent = `${host.diskPercent ?? 0}%`;
      if ($('topNetVal')) $('topNetVal').textContent = `↓${formatBytes(host.netRxRate)}/s ↑${formatBytes(host.netTxRate)}/s`;
      if ($('topUptimeVal')) $('topUptimeVal').textContent = formatUptime(host.uptimeSeconds);
      if ($('spineBpmValue')) $('spineBpmValue').textContent = `${vitals.bpm ?? TELEMETRY.bpm} BPM`;

      if ($('spineLifeStatusText')) {
        $('spineLifeStatusText').textContent = LIFE_MODE_LABELS[vitals.mode] || `ACTIVE · ${vitals.mode || 'ONLINE'}`;
      }

      if ($('hostPlatformTag')) $('hostPlatformTag').textContent = `${host.hostname || termText("{{brand.display}}")} // ${host.platform || 'LINUX'}`;
      if ($('vitalMoodText')) $('vitalMoodText').textContent = termTextTemplate`{{health.mood.en}}: ${Math.round(vitals.mood ?? TELEMETRY.mood)}%`;
      if ($('vitalActivityText')) $('vitalActivityText').textContent = `MODE: ${vitals.mode || 'SURFING'}`;
      if ($('vitalPuddingText')) $('vitalPuddingText').textContent = termTextTemplate`{{health.energy.en}}: ${Math.round(vitals.energy ?? TELEMETRY.energy)}%`;
      if ($('lastHeartbeatTag')) $('lastHeartbeatTag').textContent = `HEARTBEAT: ${formatTimeAgo(vitals.lastHeartbeat)}`;

      const logs = Array.isArray(vitals.recentLogs) ? vitals.recentLogs : [];
      if (logs.length > 0 && $('thoughtBubbleText')) {
        const latest = logs[logs.length - 1];
        const latestText = typeof latest === 'string' ? latest : (latest?.text || latest?.msg || latest?.summary || JSON.stringify(latest));
        $('thoughtBubbleText').textContent = `“${latestText}”`;
      }

      const nextDiaryHash = JSON.stringify(logs.slice(-TELEMETRY.diaryEntries));
      if (nextDiaryHash !== state.diaryHash) {
        state.diaryHash = nextDiaryHash;
        renderSubconsciousDiary(logs);
      }

      if ($('ecgWaveMode')) $('ecgWaveMode').textContent = vitals.mode || 'SINUS-ALPHA';
      if ($('ecgSyncTime')) $('ecgSyncTime').textContent = new Date(data.timestamp || Date.now()).toLocaleTimeString(UI.locale, { hour12: false });
      if ($('modelCognitionVal')) $('modelCognitionVal').textContent = models.cognition || '--';
      if ($('modelVisionVal')) $('modelVisionVal').textContent = models.vision || '--';
      if ($('modelPainterVal')) $('modelPainterVal').textContent = models.painter || '--';
      if ($('statCountsSummary')) {
        $('statCountsSummary').textContent = `${counts.memories ?? 0}M / ${counts.skills ?? 0}S / ${counts.bonds ?? 0}B`;
      }
      if ($('hostCpuModel')) {
        $('hostCpuModel').textContent = `${host.cpuModel || termText("{{chapter.memory.en}} CPU")} (${host.cpuCores || TELEMETRY.cpuCores} CORES)`;
      }

      if ($('marqueeStatLlm')) $('marqueeStatLlm').textContent = termTextTemplate`{{chapter.memory.en}} LLM: ${models.cognition || 'ONLINE'}`;
      if ($('marqueeStatLlmDup')) $('marqueeStatLlmDup').textContent = termTextTemplate`{{concept.vision.en}} LLM: ${models.vision || 'ONLINE'}`;
      if ($('marqueeStatPainter')) $('marqueeStatPainter').textContent = termTextTemplate`{{concept.artwork.en}} {{concept.painter.en}}: ${models.painter || 'READY'}`;
      if ($('marqueeStatPainterDup')) $('marqueeStatPainterDup').textContent = termTextTemplate`{{concept.specimens.en}}: ${counts.artworks ?? 0} ARCHIVED`;
      if ($('marqueeStatNet')) $('marqueeStatNet').textContent = `NET BUS: ↓${formatBytes(host.netRxRate)}/s ↑${formatBytes(host.netTxRate)}/s`;

      const metrics = healthValues(data);
      const { mood: moodPct, energy: energyPct, curiosity: curiosityPct } = metrics;
      if ($('vitalHappinessVal')) $('vitalHappinessVal').textContent = `${moodPct}%`;
      if ($('vitalEnergyVal')) $('vitalEnergyVal').textContent = `${energyPct}%`;
      if ($('vitalCuriosityVal')) $('vitalCuriosityVal').textContent = `${curiosityPct}%`;

      const load1m = Array.isArray(host.loadAvg) ? host.loadAvg[0] : 0;
      if ($('gaugeCpuLoadText')) $('gaugeCpuLoadText').textContent = `1m: ${load1m ?? 0}`;
      if ($('gaugeCpuPct')) $('gaugeCpuPct').textContent = `${host.cpuPercent ?? 0}%`;

      if ($('gaugeMemDetailText')) $('gaugeMemDetailText').textContent = `${formatBytes(host.memUsed)} / ${formatBytes(host.memTotal)}`;
      if ($('gaugeMemPct')) $('gaugeMemPct').textContent = `${host.memPercent ?? 0}%`;

      if ($('gaugeDiskDetailText')) $('gaugeDiskDetailText').textContent = `${formatBytes(host.diskUsed)} / ${formatBytes(host.diskTotal)}`;
      if ($('gaugeDiskPct')) $('gaugeDiskPct').textContent = `${host.diskPercent ?? 0}%`;

      renderHealthDials(metrics);

      if (!state.selectedRecord) {
        const brainOrgan = organs.find((o) => (o.key || o.id) === ORGAN.BRAIN);
        const qqOrgan = organs.find((o) => (o.key || o.id) === ORGAN.QQ);
        if ($('vitalBrainText')) $('vitalBrainText').textContent = brainOrgan ? `${brainOrgan.stateCode} (${brainOrgan.stateLabel})` : 'ONLINE';
        if ($('vitalQqText')) $('vitalQqText').textContent = qqOrgan ? `${qqOrgan.stateCode} (${qqOrgan.stateLabel})` : 'ONLINE';
        if ($('sysOsSummary')) $('sysOsSummary').textContent = host.platform || '--';
        if ($('sysMemSummary')) $('sysMemSummary').textContent = `${formatBytes(host.memUsed)} (${host.memPercent ?? 0}%)`;
      }

      const totalRecords = (topBonds?.length || 0) + (artworks?.length || 0);
      if ($('filterCountAll')) $('filterCountAll').textContent = pad2(totalRecords);
      if ($('bondsCountBadge')) $('bondsCountBadge').textContent = pad2(counts.bonds ?? topBonds.length);
      if ($('artworksCountBadge')) $('artworksCountBadge').textContent = pad2(counts.artworks ?? artworks.length);

      const nextOrgansHash = JSON.stringify(organs);
      if (nextOrgansHash !== state.organsHash) {
        state.organsHash = nextOrgansHash;
        renderMiniOrganStrip(organs);
        renderOrgansMatrix(organs);
        const selected=state.logs.organ;
        $('logOrganSelect').innerHTML=organs.map(o=>`<option value="${escapeHtml(o.id)}">${escapeHtml(o.name)} · ${escapeHtml(o.id)}</option>`).join('')+'<option value="corenyan-brain-file">Brain · app.log</option>';
        state.logs.organ = organs.some(o=>o.id===selected) || selected==='corenyan-brain-file' ? selected : (organs[0]?.id || UI.defaultOrgan);
        $('logOrganSelect').value=state.logs.organ;
      }

      const nextBondsHash = JSON.stringify(topBonds);
      if (nextBondsHash !== state.bondsHash) {
        state.bondsHash = nextBondsHash;
        renderBondsLedger(topBonds);
      }

      const nextArtHash = JSON.stringify(artworks);
      if (nextArtHash !== state.artworksHash) {
        state.artworksHash = nextArtHash;
        renderArtworksGallery(artworks);
      }

      reconcileLedgerSelection();
  }

  function renderSubconsciousDiary(logs) {
    const box = $('subconsciousLogList');
    if (!box) return;
    if (!Array.isArray(logs) || logs.length === 0) {
      box.innerHTML = termHtmlTemplate`<div class="diary-item"><span class="diary-dot"></span><span>[AUTONOMIC] {{concept.subconscious.zh}}回路平稳运行中，等待新的环境刺激与群聊脉冲...</span></div>`;
      return;
    }
    const recent = logs.slice(-TELEMETRY.diaryEntries).reverse();
    box.innerHTML = recent.map((entry) => {
      if (typeof entry === 'string') {
        return `<div class="diary-item"><span class="diary-dot"></span><span>${escapeHtml(entry)}</span></div>`;
      }
      const timeStr = entry.at || entry.time
        ? new Date(entry.at || entry.time).toLocaleTimeString(UI.locale, { hour12: false })
        : 'LIVE';
      const content = entry.text || entry.msg || entry.action || entry.thought || JSON.stringify(entry);
      return `<div class="diary-item"><span class="diary-dot"></span><span><strong>[${escapeHtml(timeStr)}]</strong> ${escapeHtml(content)}</span></div>`;
    }).join('');
  }

  function renderMiniOrganStrip(organs) {
    const strip = $('vitalOrgansStrip');
    if (!strip) return;
    strip.innerHTML = organs.map((o) => `
      <div class="organ-mini-pill ${o.online ? 'online' : ''}" title="${escapeHtml(o.sub)}">
        <span>${escapeHtml(o.name)}</span>
        <span style="display:inline-flex;align-items:center;gap:5px;">
          <span>${o.online ? 'ON' : 'OFF'}</span>
          <span class="pill-dot"></span>
        </span>
      </div>
    `).join('');
  }

  function renderBondsLedger(bonds) {
    const list = $('bondsListContainer');
    if (!list) return;
    const page = bondPage(bonds, state.bondList.page, state.bondList.query);
    $('bondPageStatus').textContent = `${page.total ? page.offset + 1 : 0}–${page.offset + page.items.length} / ${page.total} · ${page.current}/${page.pages} 页`;
    $('bondPrevPage').disabled = page.current <= 1;
    $('bondNextPage').disabled = page.current >= page.pages;
    bonds = page.items;
    if (!bonds.length) {
      list.innerHTML = termHtmlTemplate`<div class="fm-empty-notice">NO {{concept.bond.en}} FOUND IN AFFECTIONS VAULT</div>`;
      return;
    }

    list.innerHTML = bonds.map((b, idx) => {
      const isSelected = state.selectedRecord?.type === RECORD_TYPE.BOND && state.selectedRecord?.id === b.id;
      const fav = Math.max(0, Math.min(100, Math.round(b.affection ?? 0)));
      const fam = Math.max(0, Math.min(100, Math.round(b.familiarity ?? 0)));
      const qqStr = Array.isArray(b.qqList) && b.qqList.length ? `QQ:${b.qqList[0]}` : '';
      const mcStr = Array.isArray(b.mcNames) && b.mcNames.length ? `MC:${b.mcNames[0]}` : '';
      const subId = [qqStr, mcStr].filter(Boolean).join(' · ') || b.id;

      return termHtmlTemplate`
        <div class="bond-row ${isSelected ? 'selected' : ''}" data-bond-id="${escapeHtml(b.id)}" data-idx="${idx + 1}">
          <span class="bond-no">${pad2(page.offset + idx + 1)}</span>
          <div class="bond-entity-cell">
            <div class="bond-name">${escapeHtml(b.name || b.id)}</div>
            <div class="bond-sub-id">${escapeHtml(subId)}</div>
          </div>
          <div class="bond-role-cell" title="${escapeHtml(b.impression || b.stage || '')}">
            <strong>[${escapeHtml(b.stage || 'BOND')}]</strong> ${escapeHtml(b.impression || termText("正在建立印象..."))}
          </div>
          <div class="bond-metrics-cell">
            <div>♥ ${fav} / ◇ ${fam}</div>
            <div class="bond-mini-bar"><div class="bond-mini-fill" style="width:${fav}%"></div></div>
          </div>
          <div class="bond-sync-cell">
            <button type="button" class="bond-open-tag" data-open-dossier="${escapeHtml(b.id)}">{{concept.dossier.en}} →</button>
          </div>
        </div>
      `;
    }).join('');

    list.querySelectorAll('.bond-row').forEach((row) => {
      const bondId = row.getAttribute('data-bond-id');
      row.addEventListener('click', (e) => {
        if (e.target?.closest?.('[data-open-dossier]')) {
          openBondDossierModal(bondId);
          return;
        }
        selectLedgerRecord(RECORD_TYPE.BOND, bondId, false);
      });
      row.addEventListener('dblclick', () => {
        openBondDossierModal(bondId);
      });
    });
  }

  function renderArtworksGallery(artworks) {
    const gallery = $('artworksGalleryContainer');
    if (!gallery) return;


    if (!artworks.length) {
      gallery.innerHTML = termHtmlTemplate`<div class="fm-empty-notice">NO GENERATED {{concept.artwork.en}} {{concept.specimens.en}} FOUND</div>`;
      return;
    }

    gallery.innerHTML = artworks.map((art, idx) => {
      const isInspect = state.selectedRecord?.type === RECORD_TYPE.ARTWORK && state.selectedRecord?.id === art.name;
      const imgUrl = `${API.ARTWORK}${encodeURIComponent(art.name)}`;
      return `
        <div class="art-card ${isInspect ? 'selected' : ''}" data-art-name="${escapeHtml(art.name)}" data-art-idx="${idx}">
          <div class="art-thumb-wrap">
            <img src="${imgUrl}" alt="${escapeHtml(art.name)}" class="art-thumb-img" loading="lazy" />
          </div>
          <div class="art-meta-bar">
            <span class="art-name" title="${escapeHtml(art.name)}">${escapeHtml(art.name)}</span>
            <span class="art-size">${formatBytes(art.size)}</span>
          </div>
        </div>
      `;
    }).join('');

    gallery.querySelectorAll('.art-card').forEach((card) => {
      const name = card.getAttribute('data-art-name');
      const idx = Number(card.getAttribute('data-art-idx')) || 0;

      card.addEventListener('click', (e) => {
        if (e.target?.closest?.('.art-check-wrap')) return;
        selectLedgerRecord(RECORD_TYPE.ARTWORK, name, false);
      });

      card.querySelector('.art-thumb-wrap')?.addEventListener('click', (e) => {
        e.stopPropagation();
        selectLedgerRecord(RECORD_TYPE.ARTWORK, name, false);
        openArtworkLightbox(idx);
      });
    });
  }


  function reconcileLedgerSelection() {
    const payload = state.lastVitalsPayload;
    const bonds = state.vitalsFilter === FILTER.ARTWORKS ? [] : bondPage(payload?.topBonds || [], state.bondList.page, state.bondList.query).items;
    const artworks = state.vitalsFilter === FILTER.BONDS ? [] : payload?.artworks || [];
    const selected = state.selectedRecord;
    const valid = selected?.type === RECORD_TYPE.BOND
      ? bonds.some(item => item.id === selected.id)
      : selected?.type === RECORD_TYPE.ARTWORK && artworks.some(item => item.name === selected.id);
    if (valid) return;
    if (bonds.length) selectLedgerRecord(RECORD_TYPE.BOND, bonds[0].id);
    else if (artworks.length) selectLedgerRecord(RECORD_TYPE.ARTWORK, artworks[0].name);
    else state.selectedRecord = null;
  }

  function selectLedgerRecord(type, id, openModalImmediately = false) {
    state.selectedRecord = { type, id };
    if (type === RECORD_TYPE.BOND) getBondDetail(id).catch(() => {});
    if (openModalImmediately && type === RECORD_TYPE.BOND) openBondDossierModal(id);
  }

  function renderSelectedRecord() {
    const selected = state.selectedRecord;
    $('inspectMediaStage').classList.toggle('is-hidden', !selected);
    $('inspectKvGrid').classList.toggle('is-hidden', !selected);
    $('inspectActionsBar').classList.toggle('is-hidden', !selected);
    if (!selected) {
      $('inspectRecordIndex').textContent = '[00 / 00]';
      $('inspectKicker').textContent = 'NO RECORD SELECTED';
      $('inspectTitle').textContent = '当前分类暂无记录';
      $('inspectDesc').textContent = '选择其他分类查看羁绊或画作。';
      return;
    }
    const { type, id } = selected;
    $('btnManageArtworks').classList.toggle('is-hidden', type !== RECORD_TYPE.ARTWORK);
    const labels = INSPECT_LABELS[type];
    const key = `${type}:${id}`;
    const selectionChanged = inspectedKey !== key;
    if (selectionChanged) {
      inspectedKey = key;
      inspectAnimation?.cancel();
      if (state.motionEnabled) inspectAnimation = $('ledgerInspectPane').animate(MOTION.previewFrames, MOTION.previewOptions);
    }
    $('inspectKvGrid').querySelectorAll('.kv-k').forEach((el, index) => { el.textContent = labels[index]; });

    document.querySelectorAll('.bond-row').forEach((r) => {
      r.classList.toggle('selected', type === RECORD_TYPE.BOND && r.getAttribute('data-bond-id') === id);
    });
    document.querySelectorAll('.art-card').forEach((c) => {
      const artName = c.getAttribute('data-art-name');
      c.classList.toggle('selected', (type === RECORD_TYPE.ARTWORK && artName === id));
    });

    if (selectionChanged) {
      const selectedRow = type === RECORD_TYPE.BOND
        ? [...document.querySelectorAll('.bond-row')].find(row => row.dataset.bondId === id)
        : [...document.querySelectorAll('.art-card')].find(row => row.dataset.artName === id);
      const pane = document.querySelector('.ledger-main-pane');
      if (selectedRow && pane) {
        const rowBounds = selectedRow.getBoundingClientRect();
        const paneBounds = pane.getBoundingClientRect();
        if (rowBounds.top < paneBounds.top || rowBounds.bottom > paneBounds.bottom) {
          pane.scrollTop += rowBounds.top - paneBounds.top - pane.clientHeight / 2 + rowBounds.height / 2;
        }
      }
    }
    const payload = state.lastVitalsPayload || {};
    const topBonds = payload.topBonds || [];
    const artworks = payload.artworks || [];

    if (type === RECORD_TYPE.BOND) {
      const idx = topBonds.findIndex((b) => b.id === id);
      const summary = topBonds[idx] || { id, name: id, affection: 0, familiarity: 0, stage: 'BOND' };
      const doodleNum = ((Math.abs(hashCode(id)) % DOODLE_TOTAL) + 1);

      if ($('inspectRecordIndex')) $('inspectRecordIndex').textContent = `[BOND #${pad2(idx + 1)} / ${pad2(topBonds.length)}]`;
      if ($('inspectPreviewImg')) $('inspectPreviewImg').src = `/assets/doodle/doodle_${doodleNum}.png`;
      if ($('inspectStageBadge')) $('inspectStageBadge').textContent = `STAGE // ${summary.stage || 'BOND'}`;
      if ($('inspectKicker')) $('inspectKicker').textContent = termTextTemplate`{{concept.bond.en}} {{concept.dossier.en}} // ${id}`;
      if ($('inspectTitle')) $('inspectTitle').textContent = summary.name || id;
      if ($('inspectDesc')) $('inspectDesc').textContent = summary.impression || termText("正在同步该{{concept.bond.zh}}的深层{{concept.cortex.zh}}{{concept.dossier.zh}}...");

      if ($('vitalBrainText')) $('vitalBrainText').textContent = `FAV ♥ ${summary.affection ?? 0} / FAM ◇ ${summary.familiarity ?? 0}`;
      if ($('vitalQqText')) $('vitalQqText').textContent = (summary.qqList && summary.qqList.length) ? summary.qqList.join(', ') : 'UNLINKED';
      if ($('sysOsSummary')) $('sysOsSummary').textContent = (summary.mcNames && summary.mcNames.length) ? summary.mcNames.join(', ') : 'NONE';
      if ($('sysMemSummary')) $('sysMemSummary').textContent = summary.updatedAt ? formatTimeAgo(summary.updatedAt) : 'ACTIVE';

      if ($('btnInspectPrimary')) {
        $('btnInspectPrimary').textContent = termText("OPEN FULL {{concept.dossier.en}} →");
        $('btnInspectPrimary').onclick = () => openBondDossierModal(id);
      }
      if ($('btnInspectSecondary')) {
        $('btnInspectSecondary').textContent = termText("EDIT IN {{chapter.memory.en}} IDE →");
        $('btnInspectSecondary').classList.remove('is-hidden');
        $('btnInspectSecondary').onclick = async () => {
          switchChapter(VIEW.MEMORY);
          await selectFileScope('affections');
          await openCortexFile('affections', `${id}.json`);
        };
      }

      const detail = state.bondDetailCache.get(id);
      if (detail) {
        const impression = detail.impression || detail.impressions?.at(-1) || '暂无深层性格侧写';
        const topics = (detail.topics || []).slice(0, TELEMETRY.topicCount).join(' / ');
        $('inspectDesc').textContent = topics ? `${impression} · 常聊话题: [${topics}]` : impression;
      }

    } else if (type === RECORD_TYPE.ARTWORK) {
      const idx = artworks.findIndex((a) => a.name === id);
      const art = artworks[idx] || { name: id, size: 0, mtime: Date.now() };
      const imgUrl = `${API.ARTWORK}${encodeURIComponent(art.name)}`;

      if ($('inspectRecordIndex')) $('inspectRecordIndex').textContent = termTextTemplate`[{{concept.specimen.en}} #${pad2(idx + 1)} / ${pad2(artworks.length)}]`;
      if ($('inspectPreviewImg')) $('inspectPreviewImg').src = imgUrl;
      if ($('inspectStageBadge')) $('inspectStageBadge').textContent = termTextTemplate`{{concept.artwork.en}} // ${formatBytes(art.size)}`;
      if ($('inspectKicker')) $('inspectKicker').textContent = termTextTemplate`GENERATED ARTWORK {{concept.specimen.en}}`;
      if ($('inspectTitle')) $('inspectTitle').textContent = art.name;
      if ($('inspectDesc')) {
        $('inspectDesc').textContent = termTextTemplate`{{character.name}}的生成画作。创建时间: ${new Date(art.mtime || Date.now()).toLocaleString(UI.locale, { hour12: false })}。`;
      }

      if ($('vitalBrainText')) $('vitalBrainText').textContent = state.lastVitalsPayload?.models?.painter || 'gpt-image';
      if ($('vitalQqText')) $('vitalQqText').textContent = formatBytes(art.size);
      if ($('sysOsSummary')) $('sysOsSummary').textContent = formatTimeAgo(art.mtime);
      if ($('sysMemSummary')) $('sysMemSummary').textContent = termText("PNG / RASTER {{concept.specimen.en}}");

      if ($('btnInspectPrimary')) {
        $('btnInspectPrimary').textContent = 'OPEN OPTICAL LENS →';
        $('btnInspectPrimary').onclick = () => openArtworkLightbox(Math.max(0, idx));
      }
      if ($('btnInspectSecondary')) {
        $('btnInspectSecondary').textContent = termText("DOWNLOAD {{concept.specimen.en}} →");
        $('btnInspectSecondary').classList.remove('is-hidden');
        $('btnInspectSecondary').onclick = () => downloadArtworkFile(art.name);
      }

    }
  }

  function hashCode(str) {
    let h = 0;
    const s = String(str || '');
    for (let i = 0; i < s.length; i++) {
      h = ((h << 5) - h) + s.charCodeAt(i);
      h |= 0;
    }
    return h;
  }

  async function getBondDetail(bondId) {
    if (state.bondDetailCache.has(bondId)) {
      return state.bondDetailCache.get(bondId);
    }
    const res = await apiFetch(`${API.BONDS}${encodeURIComponent(bondId)}`);
    if (res.bond) {
      state.bondDetailCache.set(bondId, res.bond);
    }
    return res.bond;
  }

  async function openBondDossierModal(bondId) {
    state.dossier = { open: true, id: bondId, bond: null, error: '' };
    const dossier = state.dossier;
    try {
      const bond = await getBondDetail(bondId);
      if (state.dossier !== dossier || !dossier.open) return;
      dossier.bond = bond;
    } catch (err) { if (state.dossier === dossier) dossier.error = err.message; }
  }

  function renderBondDossier() {
    const { open, id, bond, error } = state.dossier;
    setOverlayVisible($('bondModalBackdrop'), Boolean(open));
    if (!open) return;
    $('bondModalIdTag').textContent = termTextTemplate`BOND {{concept.dossier.en}} // ${id}`;
    $('bondModalTitle').textContent = bond ? `${bond.name || bond.id} · [${bond.stage || 'BOND'}]` : termText("LOADING {{concept.neural.en}} {{concept.dossier.en}}...");
    const body = $('bondModalBody');
    if (!bond || error) {
      body.innerHTML = `<div class="fm-empty-notice">${error ? escapeHtml(error) : termHtml('SYNCHRONIZING {{concept.bond.en}} {{chapter.neural.en}}...')}</div>`;
      return;
    }

      const qqPills = (bond.qqList || []).map((q) => `<span class="meta-chip">QQ: ${escapeHtml(q)}</span>`).join('') || '<span class="meta-chip">UNLINKED</span>';
      const mcPills = (bond.mcNames || []).map((m) => `<span class="meta-chip">MC: ${escapeHtml(m)}</span>`).join('') || '<span class="meta-chip">NONE</span>';
      const stylePills = (bond.styles || []).map((s) => `<span class="meta-chip">${escapeHtml(s)}</span>`).join('') || '<span class="meta-chip">OBSERVING</span>';
      const topicPills = (bond.topics || []).map((t) => `<span class="meta-chip">#${escapeHtml(t)}</span>`).join('') || '<span class="meta-chip">GENERAL</span>';
      const impressionsHtml = `<p style="color:var(--ink-bone);">${escapeHtml(bond.impression || bond.impressions?.at(-1) || '暂无深层文字侧写')}</p>`;

      const evidenceHtml = (bond.recentEvidence || []).length
        ? bond.recentEvidence.map((ev) => {
            const dt = ev.at ? new Date(ev.at).toLocaleString(UI.locale, { hour12: false }) : 'RECORD';
            const deltaStr = Number(ev.delta) > 0 ? `+${ev.delta}` : `${ev.delta || 0}`;
            return `
              <div class="evidence-item">
                <div class="evidence-head">
                  <span>${escapeHtml(dt)} · [${escapeHtml(ev.role || ev.type || 'EVENT')}]</span>
                  <span>DELTA: ${escapeHtml(deltaStr)}</span>
                </div>
                <div class="evidence-channel">${escapeHtml(evidenceChannel(ev.conversationId))}</div>
                <div class="evidence-content">${renderEvidenceText(ev.text)}</div>
                ${ev.assistantContext ? termHtmlTemplate`<div style="color:var(--ink-muted);font-size:11px;margin-top:4px;">↳ {{character.name}}回应: ${renderEvidenceText(ev.assistantContext)}</div>` : ''}
              </div>
            `;
          }).join('')
        : `<div class="fm-empty-notice">NO RECENT INTERACTION EVIDENCE</div>`;

      body.innerHTML = termHtmlTemplate`
        <div class="dossier-grid">
          <div class="dossier-cell">
            <span class="kv-k">FAVORABILITY (好感度)</span>
            <span class="kv-v">♥ ${bond.affection ?? 0} / 100</span>
          </div>
          <div class="dossier-cell">
            <span class="kv-k">FAMILIARITY (熟稔度)</span>
            <span class="kv-v">◇ ${bond.familiarity ?? 0} / 100</span>
          </div>
          <div class="dossier-cell">
            <span class="kv-k">CANONICAL KEY</span>
            <span class="kv-v">${escapeHtml(bond.canonicalKey || bond.id)}</span>
          </div>
          <div class="dossier-cell">
            <span class="kv-k">LAST INTERACTION</span>
            <span class="kv-v">${bond.lastInteractionAt ? formatTimeAgo(bond.lastInteractionAt) : 'RECENT'}</span>
          </div>
        </div>

        <div class="dossier-sec-title">IDENTITY MAPPINGS (QQ &amp; MINECRAFT XUID/NAMES)</div>
        <div class="dossier-chips" style="margin-bottom:14px;">${qqPills} ${mcPills}</div>

        <div class="dossier-sec-title">COGNITIVE IMPRESSIONS ({{concept.cortex.zh}}主观印象)</div>
        <div style="margin-bottom:14px;padding:10px 12px;border:1px solid var(--line-hair);background:var(--bg-void);">${impressionsHtml}</div>

        <div class="dossier-sec-title">COMMUNICATION STYLES &amp; TOPICS (交互风格与高频话题)</div>
        <div class="dossier-chips" style="margin-bottom:16px;">${stylePills} ${topicPills}</div>

        <div class="dossier-sec-title">RECENT {{concept.memory.en}} EVIDENCE (最近交流记录)</div>
        <div class="evidence-list">${evidenceHtml}</div>
      `;
  }

  function renderOrgansMatrix(organs) {
    const grid = $('organsGridContainer');
    if (!grid) return;

    grid.innerHTML = organs.map((o) => `
      <article class="organ-card ${o.online ? '' : 'dormant'}" data-organ-id="${escapeHtml(o.id)}" tabindex="0" role="link" aria-label="${escapeHtml(o.name)} · 打开控制台">
        <span class="corner-mark tl">+</span><span class="corner-mark tr">+</span>
        <span class="corner-mark bl">+</span><span class="corner-mark br">+</span>

        <div class="organ-card-top">
          <span class="organ-code">${escapeHtml(o.organCode || o.id)}</span>
          <span class="organ-state-badge ${o.online ? 'online' : ''}">
            ● ${escapeHtml(o.stateCode || (o.online ? 'ACTIVE' : 'DORMANT'))} · ${escapeHtml(o.stateLabel || '')}
          </span>
        </div>

        <div class="organ-banner-stage">
          <img src="${o.doodle ? '/'+escapeHtml(o.doodle) : entityPreview(o)}" alt="${escapeHtml(o.name)}" class="organ-banner-img" />
        </div>

        <div class="organ-info-block">
          <div class="organ-title-row">
            <h3 class="organ-name">${escapeHtml(o.name)}</h3>
            <span class="organ-port">${o.port ? `PORT :${o.port}` : termHtml("DAEMON // {{chapter.memory.en}}")}</span>
          </div>
          <div class="organ-sub">${escapeHtml(o.sub)}</div>
          <p class="organ-desc">${escapeHtml(o.desc)}</p>
        </div>

        <div class="organ-card-footer">
          <span class="organ-uptime">STATUS: ${escapeHtml(o.uptime || 'UNKNOWN')}</span>
          <div class="organ-actions">
            <button type="button" class="wire-action-btn" data-edit-layer="${escapeHtml(o.key || o.id)}">${termHtml("{{action.edit}}")}</button>
            ${o.kind==='directory'?'':o.online ? `
              <button type="button" class="wire-action-btn primary-bone" data-organ-act="restart" data-organ="${escapeHtml(o.id)}">RESTART →</button>
              <button type="button" class="wire-action-btn danger-accent" data-organ-act="stop" data-organ="${escapeHtml(o.id)}">SLEEP →</button>
            ` : `
              <button type="button" class="wire-action-btn primary-bone" data-organ-act="start" data-organ="${escapeHtml(o.id)}">AWAKEN →</button>
            `}
          </div>
        </div>
      </article>
    `).join('');

    grid.querySelectorAll('[data-edit-layer]').forEach(button=>button.addEventListener('click',()=>layerEditor.open(button.dataset.editLayer)));
    grid.querySelectorAll('[data-organ-act]').forEach((btn) => {
      btn.addEventListener('click', async () => {
        const organId = btn.getAttribute('data-organ');
        const action = btn.getAttribute('data-organ-act');
        await triggerOrganAction(organId, action);
      });
    });

    grid.querySelectorAll('[data-organ-id]').forEach(card => {
      const open = () => { state.logs.organ = card.dataset.organId; switchChapter(VIEW.NEURAL); };
      card.addEventListener('click', event => { if (!event.target.closest('button, a, input')) open(); });
      card.addEventListener('keydown', event => { if (event.target === card && ['Enter', ' '].includes(event.key)) { event.preventDefault(); open(); } });
    });
  }

  async function triggerOrganAction(organId, action) {
    if(state.busyOrgan)return;
    const layer=state.lastVitalsPayload?.organs?.find(o=>o.id===organId);
    if(!layer||layer.kind!=='container')return;
    state.busyOrgan=organId;
    try {
      const affected=sessionImpact(layer,action);
      if(action!=='start'){
        const message=affected
          ? '此操作会中断 QQ 接入端的连接，可能导致掉线并需要重新扫码。仅在确实需要停止服务或更新配置时执行。确认继续？'
          : layer.containerName===SERVICE_CONTROL.web
            ? '此操作会中断当前管理网页。关闭后需要从服务器启动，重启后请等待恢复。确认继续？'
            : '确认'+(action==='stop'?'关闭':'重启')+' '+layer.name+'？服务会短暂中断。';
        if(!await openWireDialog({title:action==='stop'?'关闭服务':'重启服务',message}))return;
      }
      showToast('正在执行 '+layer.name+' · '+action.toUpperCase());
      const res=await apiFetch(API.ORGANS_CONTROL,{method:'POST',body:{organId,action,confirmSessionImpact:affected}});
      showToast(layer.name+' · '+action.toUpperCase()+' 执行成功 ('+(res.output||'OK')+')');
      await pollVitals();
      if(state.activeView===VIEW.NEURAL)await fetchNeuralLogs();
    } catch(err) {
      showToast(layer.containerName===SERVICE_CONTROL.web
        ? '管理网页连接中断，操作结果待确认；重启后请刷新，若已关闭需从服务器启动。'
        : '服务控制失败：'+err.message,true);
    } finally {state.busyOrgan=null;}
  }

  function initVitalsLedgerControls() {
    $('bondPrevPage').addEventListener('click', () => { state.bondList.page = bondPage(state.lastVitalsPayload?.topBonds || [], state.bondList.page, state.bondList.query).current - 1; });
    $('bondNextPage').addEventListener('click', () => { state.bondList.page = bondPage(state.lastVitalsPayload?.topBonds || [], state.bondList.page, state.bondList.query).current + 1; });
    $('bondSearchInput').addEventListener('input', frameDebounce(event => { state.bondList.query = event.target.value; state.bondList.page = 1; }));
    const inspectImage = $('inspectPreviewImg');
    const inspect = () => {
      if (state.selectedRecord?.type === RECORD_TYPE.ARTWORK) openArtworkLightbox((state.lastVitalsPayload?.artworks || []).findIndex(art => art.name === state.selectedRecord.id));
    };
    inspectImage.tabIndex = 0; inspectImage.setAttribute('role', 'button'); inspectImage.setAttribute('aria-label', '查看图片详情');
    inspectImage.addEventListener('click', inspect);
    inspectImage.addEventListener('keydown', event => { if (event.key === 'Enter' || event.key === ' ') { event.preventDefault(); inspect(); } });
    $('bondModalCloseBtn').addEventListener('click', closeBondDossier);
    $('bondModalBackdrop').addEventListener('click', event => { if (event.target === $('bondModalBackdrop')) closeBondDossier(); });

    document.querySelectorAll('#vitalsSubFilterTabs .ledger-filter-btn').forEach((btn) => {
      btn.addEventListener('click', () => {
        const sec = btn.getAttribute('data-section') || FILTER.ALL;
        state.vitalsFilter = sec;
        reconcileLedgerSelection();
      });
    });

    $('lightboxBtnClose')?.addEventListener('click', closeArtworkLightbox);
    $('artLightboxBackdrop')?.addEventListener('click', (e) => {
      if (e.target === $('artLightboxBackdrop')) closeArtworkLightbox();
    });
    $('lightboxBtnPrev')?.addEventListener('click', () => stepLightbox(-1));
    $('lightboxBtnNext')?.addEventListener('click', () => stepLightbox(1));
    $('lightboxBtnZoomIn')?.addEventListener('click', () => adjustLightboxZoom(UI.zoomStep));
    $('lightboxBtnZoomOut')?.addEventListener('click', () => adjustLightboxZoom(-UI.zoomStep));
    $('lightboxBtnZoomReset')?.addEventListener('click', () => resetLightboxTransform());

    $('lightboxBtnDownload')?.addEventListener('click', () => {
      const art = getCurrentLightboxArtwork();
      if (art?.scope) { const a = document.createElement('a'); a.href = `${API.FS_DOWNLOAD}?scope=${encodeURIComponent(art.scope)}&path=${encodeURIComponent(art.path)}`; a.download = art.name; a.click(); }
      else if (art) downloadArtworkFile(art.name);
    });

    $('lightboxBtnCopyImg')?.addEventListener('click', async () => {
      const art = getCurrentLightboxArtwork();
      if (!art) return;
      try {
        const res = await fetch(art.url || `${API.ARTWORK}${encodeURIComponent(art.name)}`);
        const blob = await res.blob();
        await copyImage(blob);
        showToast('标本图像已复制到系统剪贴板');
      } catch (err) {
        showToast(`复制图像失败 (${err.message})`, true);
      }
    });



    const stage = $('lightboxStage');
    stage?.addEventListener('wheel', (e) => {
      if (!state.lightbox.open) return;
      e.preventDefault();
      const delta = e.deltaY < 0 ? UI.wheelStep : -UI.wheelStep;
      adjustLightboxZoom(delta);
    }, { passive: false });

    stage?.addEventListener('pointerdown', (e) => {
      if (!state.lightbox.open || e.button !== 0) return;
      state.lightbox.dragging = true;
      state.lightbox.startX = e.clientX - state.lightbox.panX;
      state.lightbox.startY = e.clientY - state.lightbox.panY;
      stage.setPointerCapture?.(e.pointerId);
    });

    stage?.addEventListener('pointermove', (e) => {
      if (!state.lightbox.dragging) return;
      state.lightbox.panX = e.clientX - state.lightbox.startX;
      state.lightbox.panY = e.clientY - state.lightbox.startY;

    });

    stage?.addEventListener('pointercancel', () => { state.lightbox.dragging = false; });
    stage?.addEventListener('lostpointercapture', () => { state.lightbox.dragging = false; });
    stage?.addEventListener('pointerup', () => {
      state.lightbox.dragging = false;
    });
  }

  function lightboxFiles() { return state.lightbox.files || state.lastVitalsPayload?.artworks || []; }

  function getCurrentLightboxArtwork() {
    const list = lightboxFiles();
    return list[state.lightbox.index] || null;
  }

  function openArtworkLightbox(index) {
    state.lightbox.files = null;
    const list = lightboxFiles();
    if (!list.length) return;
    state.lightbox.open = true;
    state.lightbox.index = Math.max(0, Math.min(list.length - 1, index));
    resetLightboxTransform();

  }

  function closeArtworkLightbox() {
    if (navigation.dismiss('image')) return;
    state.lightbox.open = false;

  }

  function stepLightbox(dir) {
    const list = lightboxFiles();
    if (!list.length) return;
    state.lightbox.index = (state.lightbox.index + dir + list.length) % list.length;
    resetLightboxTransform();

  }

  function resetLightboxTransform() {
    state.lightbox.zoom = 1;
    state.lightbox.panX = 0;
    state.lightbox.panY = 0;

  }

  function adjustLightboxZoom(delta) {
    state.lightbox.zoom = Math.max(UI.zoomMin, Math.min(UI.zoomMax, Number((state.lightbox.zoom + delta).toFixed(2))));

  }

  function applyLightboxTransform() {
    const img = $('lightboxImg');
    if (img) {
      img.style.transform = `translate(${state.lightbox.panX}px, ${state.lightbox.panY}px) scale(${state.lightbox.zoom})`;
    }
    const art = getCurrentLightboxArtwork();
    if ($('lightboxFileDetails') && art) {
      const list = lightboxFiles();
      $('lightboxFileDetails').textContent = `[${state.lightbox.index + 1}/${list.length}] · ${formatBytes(art.size)} · ZOOM ${Math.round(state.lightbox.zoom * 100)}%`;
    }
  }

  function syncLightboxView() {
    const art = getCurrentLightboxArtwork();
    if (!art) return;
    if ($('lightboxFileName')) $('lightboxFileName').textContent = art.name;
    if ($('lightboxImg')) $('lightboxImg').src = art.url || `${API.ARTWORK}${encodeURIComponent(art.name)}`;

  }

  function downloadArtworkFile(name) {
    const a = document.createElement('a');
    a.href = `${API.ARTWORK}${encodeURIComponent(name)}?download=1`;
    a.download = name;
    document.body.appendChild(a);
    a.click();
    a.remove();
  }

  // ==========================================================================
  // 7. SINGLE-PASS SYNTAX HIGHLIGHTER ENGINE (JSON / JS / MD / YAML / SH)
  // ==========================================================================
  function detectLanguageFromPath(filePath) {
    const ext = (String(filePath || '').split('.').pop() || '').toLowerCase();
    return Object.entries(LANGUAGE_EXTENSIONS).find(([, extensions]) => extensions.includes(ext))?.[0] || 'txt';
  }

  async function loadFileScopes(selectDefault = true) {
    try {
      const res = await apiFetch(API.FS_SCOPES);
      configureExplorer(res.scopes || [], res.modules);
      state.fm.scopes = res.scopes?.some(s=>s.id===EXPLORER.configScope) ? res.scopes : [...(res.scopes || []), configScope()];
      state.fm.module = scopeModule(state.fm.currentScope);

      if (selectDefault && state.fm.scopes.length > 0) {
        const defaultScope = state.fm.scopes.find((s) => s.id === state.fm.currentScope)?.id || state.fm.scopes[0].id;
        await selectFileScope(defaultScope);
      }
    } catch (err) {
      showToast(`加载解剖分区失败: ${err.message}`, true);
    }
  }

  function renderScopeTabs() {
    $('fmModuleNav').innerHTML = EXPLORER.modules.map(module => `<button class="fm-module-button ${module.id === state.fm.module ? 'active' : ''}" data-module="${module.id}" aria-pressed="${module.id === state.fm.module}">${escapeHtml(module.label)}</button>`).join('');
    $('fmModuleNav').querySelectorAll('[data-module]').forEach(button => button.addEventListener('click', () => selectFileScope(EXPLORER.modules.find(module => module.id === button.dataset.module).defaultScope)));
    $('fmScopeTabs').innerHTML = moduleScopes(state.fm.scopes, state.fm.module).map(scope => `<button type="button" class="scope-tab-btn ${scope.id === state.fm.currentScope ? 'active' : ''}" data-scope="${escapeHtml(scope.id)}" aria-current="${scope.id === state.fm.currentScope ? 'page' : 'false'}"><span>${escapeHtml(scope.label)}</span><small>${escapeHtml(scope.sub)}</small></button>`).join('');
    $('fmScopeTabs').querySelectorAll('[data-scope]').forEach(button => button.addEventListener('click', () => selectFileScope(button.dataset.scope)));
  }

  function previewUrl(scope, path) { return `${EXPLORER.previewApi}?scope=${encodeURIComponent(scope)}&path=${encodeURIComponent(path)}`; }

  async function confirmFileDiscard() {
    const active = state.fm.activeFile;
    if (!isFileDirty(active)) { if (active) historyDrafts.delete(active.scope + ':' + active.path); return true; }
    const discard = await openWireDialog({ title: '尚未保存', message: '当前文件已修改，放弃未保存的修改并切换吗？' });
    if (!discard) return false;
    historyDrafts.delete(active.scope + ':' + active.path);
    return true;
  }

  async function selectFileScope(scopeId, confirmDiscard = true) {
    if (confirmDiscard && !await confirmFileDiscard()) return;
    ++requests.file;
    state.fm.module = scopeModule(scopeId);
    state.fm.currentScope = scopeId;
    state.fm.selection.clear();
    state.fm.activeFile = null;
    state.fm.filterQuery = ''; $('fmFilterInput').value = '';
    state.fm.treeData = []; state.fm.gridItems = [];
    state.fm.selected = null;
    state.fm.gridDir = '';
    state.fm.expandedDirs.clear();
    if (scopeId === EXPLORER.configScope) { ++requests.files; if (!state.endocrine.rawText) await loadBrainConfig(); return; }
    await refreshCurrentScopeFiles();
    const entry=state.fm.scopes.find(s=>s.id===scopeId)?.entryFile;
    if(entry)await openCortexFile(scopeId,entry,false);
  }

  async function refreshCurrentScopeFiles() {
    const scope = state.fm.currentScope;
    const request = ++requests.files;
    if (!scope || scope === EXPLORER.configScope) return;
    try {
      if (state.fm.viewMode === FILE_VIEW.TREE) {
        const res = await apiFetch(`${API.FS_TREE}?scope=${encodeURIComponent(scope)}`);
        if (request !== requests.files) return;
        state.fm.treeData = res.tree || [];

      } else {
        const res = await apiFetch(`${API.FS_LIST}?scope=${encodeURIComponent(scope)}&dir=${encodeURIComponent(state.fm.gridDir || '')}`);
        if (request !== requests.files) return;
        state.fm.gridItems = res.items || [];

      }
    } catch (err) {
      showToast(`读取目录失败: ${err.message}`, true);
    }
  }

  function renderFileExplorer() {
    const container = $('fmFileList');
    const navBar = $('fmGridNavBar');
    if (!container) return;

    const savedScroll = container.scrollTop;
    const isGrid = state.fm.viewMode === FILE_VIEW.GRID;

    if (navBar) {
      navBar.classList.toggle('is-hidden', !isGrid);
    }
    if ($('fmBtnExpandAll')) {
      $('fmBtnExpandAll').classList.toggle('is-hidden', isGrid);
    }

    if (isGrid) {
      renderIconGridFolderPage(container);
    } else {
      renderListTreeInline(container);
    }

    container.scrollTop = savedScroll;
  }

  // REQUIREMENT 3A: LIST MODE -> Clicking a folder expands/collapses inline (never opens a separate folder page)
  function renderListTreeInline(container) {
    const query = (state.fm.filterQuery || '').trim().toLowerCase();

    const filterNodes = (nodes) => {
      if (!query) return nodes;
      const out = [];
      for (const n of nodes) {
        if (n.isDir) {
          const filteredChildren = filterNodes(n.children || []);
          if (n.name.toLowerCase().includes(query) || filteredChildren.length > 0) {
            out.push({ ...n, children: filteredChildren, _forceExpand: true });
          }
        } else if (n.name.toLowerCase().includes(query) || n.relPath.toLowerCase().includes(query)) {
          out.push(n);
        }
      }
      return out;
    };

    const visibleTree = filterNodes(state.fm.treeData || []);
    if (!visibleTree.length) {
      container.innerHTML = termHtmlTemplate`<div class="fm-empty-notice">NO {{concept.files.en}} MATCHING IN THIS {{chapter.memory.en}} PARTITION</div>`;
      return;
    }

    const buildBranchHtml = (nodes) => {
      return nodes.map((item) => {
        if (item.isDir) {
          const isExpanded = Boolean(item._forceExpand || state.fm.expandedDirs.has(item.relPath));
          const childCount = Array.isArray(item.children) ? item.children.length : 0;
          return `
            <div class="tree-branch" data-branch-path="${escapeHtml(item.relPath)}">
              <div class="tree-node-row" draggable="true" data-rel-path="${escapeHtml(item.relPath)}" data-is-dir="1" data-name="${escapeHtml(item.name)}">
                <div class="tree-node-left">
                  <span class="tree-caret ${isExpanded ? 'expanded' : ''}">▸</span>
                  <span class="tree-icon">${FILE_ICONS.folder}</span>
                  <span class="tree-label" title="${escapeHtml(item.relPath)}">${escapeHtml(item.name)}</span>
                </div>
                <span class="tree-meta">${childCount}</span>
              </div>
              <div class="tree-children ${isExpanded ? '' : 'is-hidden'}">
                ${childCount > 0 ? buildBranchHtml(item.children) : `<div class="fm-empty-notice" style="padding:6px 10px;text-align:left;">(EMPTY FOLDER)</div>`}
              </div>
            </div>
          `;
        }

        const isActive = state.fm.activeFile?.scope === state.fm.currentScope && state.fm.activeFile?.path === item.relPath;
        const ext = (item.name.split('.').pop() || '').toLowerCase();
        const icon = isImageFile(item.name) ? 'IMG' : ext === 'md' ? 'MD' : (ext === 'json' ? '{}' : 'TXT');
        return `
          <div class="tree-node-row ${isActive ? 'active' : ''}" draggable="true" data-rel-path="${escapeHtml(item.relPath)}" data-is-dir="0" data-name="${escapeHtml(item.name)}">
            <div class="tree-node-left">
              <span class="tree-caret" style="opacity:0.2">·</span>
              <span class="tree-icon">${escapeHtml(icon)}</span>
              <span class="tree-label" title="${escapeHtml(item.relPath)}">${escapeHtml(item.name)}</span>
            </div>
            <span class="tree-meta">${formatBytes(item.size)}</span>
          </div>
        `;
      }).join('');
    };

    container.innerHTML = buildBranchHtml(visibleTree);

    // Bind inline folder expand/collapse & file selection
    container.querySelectorAll('.tree-node-row').forEach((row) => {
      const relPath = row.getAttribute('data-rel-path') || '';
      const isDir = row.getAttribute('data-is-dir') === '1';
      const name = row.getAttribute('data-name') || '';

      row.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openFmContextMenu(e.clientX, e.clientY, { relPath, isDir, name });
      });
    });
  }

  // REQUIREMENT 3B: ICON MODE -> Clicking a folder opens a dedicated folder page with breadcrumbs & UP navigation
  function renderIconGridFolderPage(container) {
    const upBtn = $('fmBtnGridUp');
    const crumbsBox = $('fmGridBreadcrumbs');
    const curDir = state.fm.gridDir || '';

    if (upBtn) {
      upBtn.disabled = !curDir;
    }

    if (crumbsBox) {
      const parts = curDir ? curDir.split('/').filter(Boolean) : [];
      let accum = '';
      let html = `<button type="button" class="crumb-seg ${parts.length === 0 ? 'active' : ''}" data-grid-dir="">ROOT (${escapeHtml(state.fm.currentScope)})</button>`;
      parts.forEach((seg, idx) => {
        accum = accum ? `${accum}/${seg}` : seg;
        const isLast = idx === parts.length - 1;
        html += `<span class="crumb-sep">/</span><button type="button" class="crumb-seg ${isLast ? 'active' : ''}" data-grid-dir="${escapeHtml(accum)}">${escapeHtml(seg)}</button>`;
      });
      crumbsBox.innerHTML = html;
      crumbsBox.querySelectorAll('.crumb-seg').forEach((btn) => {
        btn.addEventListener('click', () => {
          navigateIconGridFolder(btn.getAttribute('data-grid-dir') || '');
        });
      });
    }

    const query = (state.fm.filterQuery || '').trim().toLowerCase();
    const items = (state.fm.gridItems || []).filter((it) => !query || it.name.toLowerCase().includes(query));

    if (!items.length) {
      container.innerHTML = `<div class="fm-empty-notice">THIS DIRECTORY PAGE IS EMPTY</div>`;
      return;
    }

    const getCardSvg = (item) => {
      if (item.isDir) {
        return FILE_ICONS.folder;
      }
      const ext = (item.name.split('.').pop() || '').toLowerCase();
      if (ext === 'md') {
        return `
          <svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="1.4">
            <rect x="6" y="4" width="24" height="28"/>
            <text x="10" y="22" fill="currentColor" font-size="9" font-family="monospace" font-weight="bold">MD</text>
          </svg>`;
      }
      if (ext === 'json') {
        return `
          <svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="1.4">
            <rect x="6" y="4" width="24" height="28"/>
            <text x="9" y="22" fill="currentColor" font-size="8.5" font-family="monospace" font-weight="bold">{}</text>
          </svg>`;
      }
      return `
        <svg viewBox="0 0 36 36" fill="none" stroke="currentColor" stroke-width="1.4">
          <path d="M8 4 H22 L28 10 V32 H8 Z"/>
          <polyline points="22,4 22,10 28,10"/>
          <line x1="12" y1="17" x2="24" y2="17"/>
          <line x1="12" y1="22" x2="22" y2="22"/>
        </svg>`;
    };

    container.innerHTML = `
      <div class="fm-icon-grid">
        ${items.map((item) => {
          const isActive = !item.isDir && state.fm.activeFile?.scope === state.fm.currentScope && state.fm.activeFile?.path === item.relPath;
          return `
            <div class="grid-slice-card ${isActive ? 'active' : ''}" draggable="true" data-rel-path="${escapeHtml(item.relPath)}" data-is-dir="${item.isDir ? '1' : '0'}" data-name="${escapeHtml(item.name)}">
              <div class="grid-slice-icon">${!item.isDir && isImageFile(item.name) ? `<img src="${previewUrl(state.fm.currentScope, item.relPath)}" alt="" loading="lazy" />` : getCardSvg(item)}</div>
              <div class="grid-slice-name" title="${escapeHtml(item.name)}">${escapeHtml(item.name)}</div>
              <div class="grid-slice-sub">${item.isDir ? 'OPEN FOLDER →' : formatBytes(item.size)}</div>
            </div>
          `;
        }).join('')}
      </div>
    `;

    container.querySelectorAll('.grid-slice-card').forEach((card) => {
      const relPath = card.getAttribute('data-rel-path') || '';
      const isDir = card.getAttribute('data-is-dir') === '1';
      const name = card.getAttribute('data-name') || '';

      card.addEventListener('contextmenu', (e) => {
        e.preventDefault();
        e.stopPropagation();
        openFmContextMenu(e.clientX, e.clientY, { relPath, isDir, name });
      });
    });
  }

  async function navigateIconGridFolder(targetDir) {
    if (!await confirmFileDiscard()) return;
    ++requests.file;
    state.fm.selected = null;
    state.fm.selection.clear(); state.fm.activeFile = null;
    state.fm.gridDir = targetDir || '';
    await refreshCurrentScopeFiles();
  }

  async function openCortexFile(scopeId, relPath, confirmDiscard = true) {
    if (state.fm.activeFile?.scope === scopeId && state.fm.activeFile?.path === relPath) { if(state.mobile)state.mobile.editorOpen=true; return; }
    if (confirmDiscard && !await confirmFileDiscard()) return;
    const request = ++requests.file;
    try {
      const res = await apiFetch(`${API.FS_READ}?scope=${encodeURIComponent(scopeId)}&path=${encodeURIComponent(relPath)}`);
      if (request !== requests.file) return;
      const lang = isImageFile(relPath) ? 'image' : res.binary || isBinaryFile(relPath) ? 'binary' : detectLanguageFromPath(relPath);
      const draft = historyDrafts.get(scopeId + ':' + relPath);
      state.fm.activeFile = draft || {
        scope: scopeId,
        path: relPath,
        content: normalizeEditorText(res.content),
        originalContent: normalizeEditorText(res.content),
        lineEnding: fileLineEnding(res.content),
        saving: false,
        size: res.size || 0,
        mtime: res.mtime ?? null,
        birthtime: res.birthtime ?? null,
        lang
      };
      state.fm.validationError = '';

      if (lang === 'md') state.fm.mdPreviewOpen = true;
    } catch (err) {
      showToast(termTextTemplate`打开{{concept.file.zh}}失败: ${err.message}`, true);
    }
  }

  function syncMarkdownSplitPane() {
    const active = state.fm.activeFile;
    const isMd = active?.lang === 'md';
    const showSplit = Boolean(isMd && state.fm.mdPreviewOpen);

    const wrap = $('fmEditorBodyWrap');
    const pane = $('fmMdPreviewPane');
    const toggleBtn = $('fmBtnToggleMdPreview');
    const previewBody = $('fmMdPreviewBody');
    const wordCount = $('fmMdWordCount');

    if (wrap) wrap.classList.toggle('md-split-open', showSplit);
    if (pane) pane.classList.toggle('is-hidden', !showSplit);
    if (toggleBtn) {
      toggleBtn.textContent = showSplit ? 'MD SPLIT PREVIEW: ON' : 'MD SPLIT PREVIEW: OFF';
      toggleBtn.classList.toggle('primary-bone', showSplit);
    }

    if (showSplit && previewBody) {
      const raw = state.fm.activeFile?.content || '';
      if (wordCount) wordCount.textContent = `${raw.length} CHARS`;
      if (window.marked && typeof window.marked.parse === 'function') {
        try {
          previewBody.innerHTML = DOMPurify.sanitize(window.marked.parse(raw, { breaks: true, gfm: true }));
          previewBody.querySelectorAll('pre code').forEach(code => {
            const language = [...code.classList].find(name => name.startsWith('language-'))?.slice(9);
            const mode = EDITOR.modes[language] || EDITOR.modes.txt;
            const text = code.textContent;
            code.classList.add('cm-s-default');
            CodeMirror.runMode(text, mode, code);
          });
        } catch {
          previewBody.innerHTML = `<pre>${escapeHtml(raw)}</pre>`;
        }
      } else {
        previewBody.innerHTML = `<pre>${escapeHtml(raw)}</pre>`;
      }
    }
  }

  function updateFmDirtyIndicator() {
    const statusEl = $('fmEditorStatus');
    if (!statusEl) return;
    if (!state.fm.activeFile) {
      statusEl.textContent = 'IDLE';
      statusEl.className = 'ide-dirty-tag';
      return;
    }
    if (state.fm.validationError) {
      statusEl.textContent = 'JSON ERROR';
      statusEl.className = 'ide-dirty-tag error';
      return;
    }
    const isDirty = isFileDirty(state.fm.activeFile);
    statusEl.textContent = isDirty ? 'MODIFIED ●' : 'SAVED ✓';
    statusEl.className = `ide-dirty-tag ${isDirty ? 'dirty' : ''}`;
  }

  async function saveCurrentCortexFile() {
    const active = state.fm.activeFile;
    const editor = $('fmCodeEditor');
    if (!editor || !isFileDirty(active) || active.saving) return;

    const nextContent = normalizeEditorText(active.content);
    const writeContent = serializedFileContent(active);
    if (active.lang === 'json') {
      try {
        JSON.parse(nextContent);
      } catch (err) {
        showToast(`JSON 语法校验未通过: ${err.message}`, true);
        state.fm.validationError = err.message;
        return;
      }
    }

    try {
      active.saving = true;
      const saved = await apiFetch(API.FS_WRITE, {
        method: 'POST',
        body: {
          scope: active.scope,
          path: active.path,
          content: writeContent
        }
      });
      active.originalContent = nextContent;
      active.mtime = saved.mtime ?? active.mtime;
      active.birthtime = saved.birthtime ?? null;
      active.size = saved.size ?? active.size;
      if (isFileDirty(active)) historyDrafts.set(active.scope + ':' + active.path, { ...active, saving: false });
      else historyDrafts.delete(active.scope + ':' + active.path);
      showToast(termTextTemplate`已保存{{concept.file.zh}}: ${active.path}`);
    } catch (err) {
      showToast(`保存失败: ${err.message}`, true);
    } finally { active.saving = false; }
  }

  function openCortexImage() {
    const file = state.fm.activeFile;
    if (file?.lang !== 'image') return;
    const flatten = nodes => nodes.flatMap(item => item.isDir ? flatten(item.children || []) : [item]);
    const nodes = state.fm.viewMode === FILE_VIEW.GRID ? state.fm.gridItems : flatten(state.fm.treeData);
    const images = nodes.filter(item => !item.isDir && isImageFile(item.relPath)).map(item => ({ name: item.name, path: item.relPath, scope: file.scope, size: item.size, url: previewUrl(file.scope, item.relPath) }));
    if (!images.some(image => image.path === file.path)) images.push({ name: file.path.split('/').pop(), path: file.path, scope: file.scope, size: file.size, url: previewUrl(file.scope, file.path) });
    state.lightbox.files = images;
    state.lightbox.index = images.findIndex(image => image.path === file.path);
    state.lightbox.open = true;
    resetLightboxTransform();
  }

  function closeBondDossier() {
    if (navigation.dismiss('bond')) return;
    state.dossier.open = false;
  }

  function initFileManagerAndIde() {
    $('fmPreviewImage').tabIndex = 0; $('fmPreviewImage').setAttribute('role', 'button'); $('fmPreviewImage').setAttribute('aria-label', '查看图片详情');
    $('fmPreviewImage').addEventListener('click', openCortexImage);
    $('fmPreviewImage').addEventListener('keydown', event => { if (['Enter', ' '].includes(event.key)) { event.preventDefault(); openCortexImage(); } });

    $('fmSelectAll').addEventListener('click', selectAllFiles);
    $('fmClearSelection').addEventListener('click', () => state.fm.selection.clear());
    $('fmDeleteSelection').addEventListener('click', deleteSelectedFiles);
    $('fmDownloadSelection').addEventListener('click', () => {
      const scope = state.fm.currentScope;
      [...state.fm.selection].forEach((path, index) => setTimeout(() => { const a = document.createElement('a'); a.href = API.FS_DOWNLOAD + '?scope=' + encodeURIComponent(scope) + '&path=' + encodeURIComponent(path); a.download = path.split('/').pop(); a.click(); }, index * TIMING.downloadStagger));
    });
    $('btnManageArtworks').addEventListener('click', async () => { if (!state.fm.scopes.length) await loadFileScopes(); switchChapter(VIEW.MEMORY); await selectFileScope(EXPLORER.artworkScope); });
    // View Mode Switch: LIST TREE vs ICON GRID
    $('fmBtnViewTree')?.addEventListener('click', () => {
      if (state.fm.viewMode === FILE_VIEW.TREE) return;
      state.fm.viewMode = FILE_VIEW.TREE;

      refreshCurrentScopeFiles();
    });

    $('fmBtnViewGrid')?.addEventListener('click', () => {
      if (state.fm.viewMode === FILE_VIEW.GRID) return;
      state.fm.viewMode = FILE_VIEW.GRID;

      refreshCurrentScopeFiles();
    });

    // Icon Grid UP button
    $('fmBtnGridUp')?.addEventListener('click', () => {
      if (!state.fm.gridDir) return;
      const parts = state.fm.gridDir.split('/').filter(Boolean);
      parts.pop();
      navigateIconGridFolder(parts.join('/'));
    });

    // Filter slices
    $('fmFilterInput')?.addEventListener('input', (e) => {
      state.fm.filterQuery = e.target.value || '';

    });

    // Expand / Collapse All in List Tree mode
    $('fmBtnExpandAll')?.addEventListener('click', () => {
      const collectDirs = (nodes, arr = []) => {
        for (const n of nodes) {
          if (n.isDir) {
            arr.push(n.relPath);
            if (n.children) collectDirs(n.children, arr);
          }
        }
        return arr;
      };
      const allDirs = collectDirs(state.fm.treeData || []);
      if (state.fm.expandedDirs.size >= allDirs.length && allDirs.length > 0) {
        state.fm.expandedDirs.clear();

      } else {
        allDirs.forEach((d) => state.fm.expandedDirs.add(d));

      }

    });

    $('fmBtnRefresh')?.addEventListener('click', () => refreshCurrentScopeFiles());

    // Create New Folder / New File
    $('fmBtnNewFolder')?.addEventListener('click', () => promptCreateSlice(true, getActiveTargetDir()));
    $('fmBtnNewFile')?.addEventListener('click', () => promptCreateSlice(false, getActiveTargetDir()));
    $('fmBtnPasteRoot')?.addEventListener('click', () => pasteClipboardInto(getActiveTargetDir()));

    fmEditorView = createEditor('fmCodeEditor', value => {
      if (state.fm.activeFile && !['image', 'binary'].includes(state.fm.activeFile.lang)) state.fm.activeFile.content = value;
      state.fm.validationError = '';
    }, saveCurrentCortexFile, 'fmCursorMeta');
    $('fmBtnSaveFile')?.addEventListener('click', saveCurrentCortexFile);
    $('fmBtnFormatJson')?.addEventListener('click', () => {
      if (state.fm.activeFile?.lang !== 'json') return;
      try { state.fm.activeFile.content = JSON.stringify(JSON.parse(state.fm.activeFile.content), null, EDITOR.indent); }
      catch (err) { showToast(`JSON 格式错误: ${err.message}`, true); }
    });

    $('fmBtnToggleMdPreview')?.addEventListener('click', () => {
      state.fm.mdPreviewOpen = !state.fm.mdPreviewOpen;

    });

    $('fmBtnDownloadCurrent')?.addEventListener('click', () => {
      const active = state.fm.activeFile;
      if (!active) return;
      const a = document.createElement('a');
      a.href = `${API.FS_DOWNLOAD}?scope=${encodeURIComponent(active.scope)}&path=${encodeURIComponent(active.path)}`;
      a.download = active.path.split('/').pop() || 'slice.txt';
      document.body.appendChild(a);
      a.click();
      a.remove();
    });

    $('fmBtnDeleteFile')?.addEventListener('click', async () => {
      const active = state.fm.activeFile;
      if (!active) return;
      await deleteSliceTarget(active.path, false, active.scope);
    });

    // Context Menu Actions
    initFmContextMenu();
  }

  function selectAllFiles() {
    const rows = [...$('fmFileList').querySelectorAll('[data-rel-path]')].filter(row => row.getClientRects().length);
    state.fm.selection.clear(); rows.forEach(row => state.fm.selection.add(row.dataset.relPath));
    const row = rows[0]; if (row) state.fm.selected = { scope: state.fm.currentScope, relPath: row.dataset.relPath, name: row.dataset.name, isDir: row.dataset.isDir === '1' };
  }

  async function deleteSelectedFiles() {
    const paths = [...state.fm.selection], scope = state.fm.currentScope;
    if (!paths.length) return;
    if (!await openWireDialog({ title: termText('移入{{file.trash.zh}}'), message: termTextTemplate`将选中的 ${paths.length} 项移入{{file.trash.zh}}？可在{{file.trash.zh}}中还原。` })) return;
    try {
      await apiFetch(API.FS_DELETE, { method: 'POST', body: { scope, paths } });
      if (state.fm.activeFile?.scope === scope && paths.some(path => state.fm.activeFile.path === path || state.fm.activeFile.path.startsWith(path + '/'))) { ++requests.file; state.fm.activeFile = null; }
      state.fm.selection.clear(); state.fm.selected = null;
      await refreshCurrentScopeFiles(); await pollVitals();
    } catch (error) { showToast(error.message, true); }
  }

  function getActiveTargetDir() {
    if (state.fm.viewMode === FILE_VIEW.GRID) {
      return state.fm.gridDir || '';
    }
    if (state.fm.activeFile?.path) {
      const parts = state.fm.activeFile.path.split('/');
      parts.pop();
      return parts.join('/');
    }
    return '';
  }

  async function promptCreateSlice(isFolder, parentDir = '') {
    const scope = state.fm.currentScope;
    const prefix = parentDir ? `${parentDir}/` : '';
    const entry = await openWireDialog({
      title: isFolder ? termText("CREATE {{chapter.memory.en}} DIRECTORY") : termText("CREATE {{concept.file.en}}"),
      message: isFolder ? `在 [${state.fm.currentScope}/${parentDir || ''}] 下新建目录：` : `在 [${state.fm.currentScope}/${parentDir || ''}] 下新建文件（如 note.md / config.json）：`,
      defaultValue: '',
      placeholder: isFolder ? 'folder_name' : 'memory_note.md'
    });
    if (!entry) return;
    const name = prefix + entry;

    try {
      if (isFolder) {
        await apiFetch(API.FS_MKDIR, {
          method: 'POST',
          body: { scope, path: name }
        });
        state.fm.expandedDirs.add(name);
        showToast(`目录已创建: ${name}`);
        await refreshCurrentScopeFiles();
      } else {
        const ext = (name.split('.').pop() || '').toLowerCase();
        const initial = ext === 'json' ? '{\n  \n}\n' : (ext === 'md' ? `# ${name.split('/').pop()}\n\n` : '');
        await apiFetch(API.FS_WRITE, {
          method: 'POST',
          body: { scope, path: name, content: initial }
        });
        if (parentDir) state.fm.expandedDirs.add(parentDir);
        showToast(`文件已创建: ${name}`);
        await refreshCurrentScopeFiles();
        if (state.fm.currentScope === scope) await openCortexFile(scope, name);
      }
    } catch (err) {
      showToast(`新建失败: ${err.message}`, true);
    }
  }

  async function deleteSliceTarget(relPath, isDir = false, scope = state.fm.currentScope) {
    const restoreListFocus = document.activeElement === $('fmFileList');
    const ok = await openWireDialog({
      title: termText("移入{{file.trash.zh}}"),
      message: termTextTemplate`确认将${isDir ? '目录及其所有子内容' : '文件'} [${relPath}] 移入{{file.trash.zh}}？可以还原，{{file.trash.zh}}需要手动清理。`
    });
    if (restoreListFocus) $('fmFileList').focus({ preventScroll: true });
    if (!ok) return;

    try {
      ++requests.file;
      await apiFetch(API.FS_DELETE, {
        method: 'POST',
        body: { scope, path: relPath }
      });
      if (state.fm.activeFile?.scope === scope && (state.fm.activeFile.path === relPath || (isDir && state.fm.activeFile.path.startsWith(`${relPath}/`)))) {
        state.fm.activeFile = null;

      }
      state.fm.selected = null;
      state.fm.selection.clear();
      if (state.fm.gridDir === relPath || state.fm.gridDir.startsWith(`${relPath}/`)) state.fm.gridDir = relPath.split('/').slice(0, -1).join('/');
      showToast(termTextTemplate`已移入{{file.trash.zh}}: ${relPath}`);
      await refreshCurrentScopeFiles();
      await pollVitals();
    } catch (err) {
      showToast(`删除失败: ${err.message}`, true);
    }
  }

  function selectExplorerTarget(target, event = {}) {
    const rows = [...$('fmFileList').querySelectorAll('[data-rel-path]')].filter(row => row.getClientRects().length);
    if (event.shiftKey && state.fm.selected) {
      const a = rows.findIndex(row => row.dataset.relPath === state.fm.selected.relPath), b = rows.findIndex(row => row.dataset.relPath === target.relPath);
      if (a >= 0 && b >= 0) rows.slice(Math.min(a,b), Math.max(a,b)+1).forEach(row => state.fm.selection.add(row.dataset.relPath));
    } else if (event.ctrlKey || event.metaKey) {
      state.fm.selection.has(target.relPath) ? state.fm.selection.delete(target.relPath) : state.fm.selection.add(target.relPath);
    } else { state.fm.selection.clear(); state.fm.selection.add(target.relPath); }
    state.fm.selected = { ...target, scope: state.fm.currentScope };
    $('fmFileList').focus({ preventScroll: true });
  }

  function initFileDragging(){
    mountExplorerDrag({
      list:$('fmFileList'),breadcrumbs:$('fmGridBreadcrumbs'),
      getScope:()=>state.fm.currentScope,getSelection:()=>state.fm.selection,select:selectExplorerTarget,onStart:closeFmContextMenu,
      onError:error=>showToast('移动失败：'+error.message,true),
      onMove:async payload=>{
        if(state.fm.activeFile?.saving)throw Error('文件正在保存，请完成后再移动。');
        ++requests.file;
        const result=await apiFetch(API.FS_MOVE,{method:'POST',body:payload});
        const remap=value=>{
          const item=result.moved.find(m=>value===m.source||value.startsWith(m.source+'/'));
          return item?item.destination+value.slice(item.source.length):value;
        };
        // Keep dirty contents and cached drafts, only their filesystem identity changes.
        for(const [key,draft] of [...historyDrafts]){
          if(draft.scope!==payload.scope)continue;
          const next=remap(draft.path);if(next===draft.path)continue;
          historyDrafts.delete(key);draft.path=next;historyDrafts.set(draft.scope+':'+next,draft);
        }
        const active=state.fm.activeFile;
        if(active?.scope===payload.scope)active.path=remap(active.path);
        const clip=state.fm.clipboard;
        if(clip?.scope===payload.scope)clip.sources=clip.sources.map(remap);
        if(state.fm.currentScope===payload.scope){
          state.fm.selection=new Set(result.moved.map(m=>m.destination));state.fm.selected=null;
          state.fm.expandedDirs.add(payload.targetDir);
          await refreshCurrentScopeFiles();
        }
        showToast(result.moved.length?'已移动 '+result.moved.length+' 项至 /'+payload.targetDir:'文件已在目标文件夹中');
      }
    });
  }

  function initFileShortcuts() {
    const list = $('fmFileList');
    list.tabIndex = 0;
    list.setAttribute('aria-label', '文件列表');
    registry.subscribe(['fm.selection', 'fm.selected', 'fm.treeData', 'fm.gridItems', 'fm.expandedDirs', 'fm.viewMode', 'fm.activeFile.path', 'fm.filterQuery', 'fm.gridDir'], () => {
      list.querySelectorAll('[data-rel-path]').forEach(row => row.classList.toggle('file-selected', state.fm.selection.has(row.dataset.relPath)));
      $('fmSelectionCount').textContent = `${state.fm.selection.size} 项已选`;
      $('fmDeleteSelection').disabled = $('fmDownloadSelection').disabled = !state.fm.selection.size;
    });
    list.addEventListener('keydown', async event => {
      if (event.target !== list || state.dialog || state.trash.open || event.repeat) return;
      const selected = state.fm.selected?.scope === state.fm.currentScope ? state.fm.selected : null;
      const key = event.key.toLowerCase(), modifier = event.ctrlKey || event.metaKey;
      if (shortcut(event,'files.selectAll')) { event.preventDefault(); selectAllFiles(); }
      else if ((shortcut(event,'files.copy') || shortcut(event,'files.cut')) && selected) {
        event.preventDefault();
        state.fm.clipboard = { scope: selected.scope, sources: [...state.fm.selection], mode: shortcut(event,'files.cut') ? 'cut' : 'copy' };
        showToast(`${shortcut(event,'files.cut') ? '剪切' : '复制'}: ${selected.name}`);
      } else if (shortcut(event,'files.paste')) {
        event.preventDefault();
        const dir = selected ? (selected.isDir ? selected.relPath : selected.relPath.split('/').slice(0, -1).join('/')) : state.fm.gridDir;
        await pasteClipboardInto(dir);
      } else if (shortcut(event,'files.delete') && selected) {
        event.preventDefault(); await deleteSelectedFiles();
      } else if (shortcut(event,'files.rename') && selected) {
        event.preventDefault(); state.fm.ctxTarget = selected;
        document.querySelector('[data-ctx="rename"]').click();
      } else if (shortcut(event,'files.down') || shortcut(event,'files.up')) {
        event.preventDefault();
        const rows = [...list.querySelectorAll('.tree-node-row, .grid-slice-card')].filter(row => row.getClientRects().length);
        const current = rows.findIndex(row => row.dataset.relPath === selected?.relPath);
        const index = Math.max(0, Math.min(rows.length - 1, current + (shortcut(event,'files.down') ? 1 : -1)));
        const row = rows[index];
        if (row) { selectExplorerTarget({ relPath: row.dataset.relPath, isDir: row.dataset.isDir === '1', name: row.dataset.name }); row.scrollIntoView({ block: 'nearest' }); }
      } else if (shortcut(event,'files.open') && selected) {
        event.preventDefault(); state.fm.ctxTarget = selected; document.querySelector('[data-ctx="open"]').click();
      }
    });
  }

  function openFmContextMenu(x, y, target) {
    if (!state.fm.selection.has(target.relPath)) selectExplorerTarget(target);
    else { state.fm.selected = { ...target, scope: state.fm.currentScope }; $('fmFileList').focus({ preventScroll: true }); }
    state.fm.ctxTarget = target;
    state.contextMenu = { open: true, x, y };
  }

  function closeFmContextMenu() { state.contextMenu.open = false; }

  async function pasteClipboardInto(targetDir) {
    const clip = state.fm.clipboard;
    if (!clip || clip.scope !== state.fm.currentScope || !clip.sources?.length) return;
    try {
      const res = await apiFetch(API.FS_PASTE, {
        method: 'POST',
        body: {
          scope: state.fm.currentScope,
          sources: clip.sources,
          targetDir: targetDir || '',
          mode: clip.mode
        }
      });
      if (clip.mode === 'cut') {
        const active = state.fm.activeFile;
        clip.sources.forEach((source, index) => {
          if (active?.scope === clip.scope && res.pasted?.[index] && (active.path === source || active.path.startsWith(`${source}/`))) {
            active.path = res.pasted[index] + active.path.slice(source.length);
          }
        });
        state.fm.selected = null;
        state.fm.clipboard = null;

      }
      showToast(`已粘贴 ${res.pasted?.length || 1} 项至 /${targetDir || ''}`);
      await refreshCurrentScopeFiles();
    } catch (err) {
      showToast(`粘贴失败: ${err.message}`, true);
    }
  }

  function initFmContextMenu() {
    // Capture runs even when file rows stop the bubbling click.
    window.addEventListener('pointerdown', event => {
      if (event.button === 0 && !event.target.closest('#fmContextMenu')) closeFmContextMenu();
    }, {capture:true});
    window.addEventListener('click', event => {
      if (!event.target.closest('#fmContextMenu')) closeFmContextMenu();
    }, {capture:true});

    document.querySelectorAll('#fmContextMenu .ctx-item').forEach((btn) => {
      btn.addEventListener('click', async (e) => {
        e.stopPropagation();
        const act = btn.getAttribute('data-ctx');
        const t = state.fm.ctxTarget;
        closeFmContextMenu();
        if (!t) return;

        const baseDir = t.isDir ? t.relPath : t.relPath.split('/').slice(0, -1).join('/');

        if (act === 'open') {
          if (t.isDir) {
            if (state.fm.viewMode === FILE_VIEW.GRID) {
              await navigateIconGridFolder(t.relPath);
            } else {
              if (state.fm.expandedDirs.has(t.relPath)) state.fm.expandedDirs.delete(t.relPath);
              else state.fm.expandedDirs.add(t.relPath);

            }
          } else {
            await openCortexFile(state.fm.currentScope, t.relPath);
          }
        } else if (act === 'new-file') {
          await promptCreateSlice(false, baseDir);
        } else if (act === 'new-folder') {
          await promptCreateSlice(true, baseDir);
        } else if (act === 'rename') {
          const nextPath = await openWireDialog({
            title: termText("RENAME {{chapter.memory.en}} {{concept.file.en}}"),
            message: `重命名或移动路径 [${t.relPath}]：`,
            defaultValue: t.relPath
          });
          if (!nextPath || nextPath === t.relPath) return;
          const scope = state.fm.currentScope;
          try {
            await apiFetch(API.FS_RENAME, {
              method: 'POST',
              body: { scope, oldPath: t.relPath, newPath: nextPath }
            });
            const active = state.fm.activeFile;
            if (active?.scope === scope && (active.path === t.relPath || active.path.startsWith(`${t.relPath}/`))) {
              active.path = nextPath + active.path.slice(t.relPath.length);
              active.lang = isImageFile(active.path) ? 'image' : isBinaryFile(active.path) ? 'binary' : detectLanguageFromPath(active.path);
            }
            state.fm.selection.clear(); state.fm.selection.add(nextPath);
            state.fm.selected = { scope, relPath: nextPath, name: nextPath.split('/').pop(), isDir: t.isDir };
            $('fmFileList').focus({ preventScroll: true });
            showToast(`已重命名: ${nextPath}`);
            await refreshCurrentScopeFiles();
          } catch (err) {
            showToast(`重命名失败: ${err.message}`, true);
          }
        } else if (act === 'copy' || act === 'cut') {
          state.fm.clipboard = {
            scope: state.fm.currentScope,
            sources: [...state.fm.selection],
            mode: act
          };

          showToast(`${act === 'cut' ? '剪切' : '复制'}: ${t.name}`);
        } else if (act === 'paste') {
          await pasteClipboardInto(baseDir);
        } else if (act === 'download') {
          if (t.isDir) {
            showToast(termText("文件夹请进入后下载单个{{concept.file.zh}}"), true);
            return;
          }
          const a = document.createElement('a');
          a.href = `${API.FS_DOWNLOAD}?scope=${encodeURIComponent(state.fm.currentScope)}&path=${encodeURIComponent(t.relPath)}`;
          a.download = t.name;
          document.body.appendChild(a);
          a.click();
          a.remove();
        } else if (act === 'delete') {
          if (state.fm.selection.size > 1) await deleteSelectedFiles();
          else await deleteSliceTarget(t.relPath, t.isDir);
        }
      });
    });
  }

  // ==========================================================================
  // 9. CHAPTER 04: SYNAPSE STREAM (ANSI TELEMETRY TERMINAL)
  // ==========================================================================
  function ansiToHtml(rawText, filterStr = '') {
    // Only the live login panel can establish QR freshness; console history cannot.
    if(registry.state.logs.organ===ONEBOT_LOGIN.layer){
      return ansiTextToHtml(terminalBlockSegments(rawText).filter(segment=>!segment.rows).map(segment=>segment.text).join('\n'),filterStr);
    }
    // Pixel blocks are terminal cells, not typographic text. Render before line filtering.
    if(!filterStr.trim()){
      const segments=terminalBlockSegments(rawText);
      if(segments.some(s=>s.rows)||String(rawText).includes('[QQ LOGIN]'))return segments.map(segment=>segment.rows?renderTerminalBlocks(segment.rows):ansiTextToHtml(segment.text)).join('');
    }
    return ansiTextToHtml(rawText,filterStr);
  }

  function ansiTextToHtml(rawText, filterStr = '') {
    const lines = String(rawText || '').split(/\r?\n/);
    const q = (filterStr || '').trim().toLowerCase();

    const filtered = q
      ? lines.filter((l) => l.replace(/\x1b\[[0-9;]*m/g, '').toLowerCase().includes(q))
      : lines;

    if (!filtered.length) {
      return termHtmlTemplate`<div class="log-line ansi-gray">[FILTER] 无匹配的{{concept.neural.zh}}脉冲记录...</div>`;
    }

    return filtered.map((line) => {
      // Check if line contains ANSI codes
      if (line.includes('\x1b[')) {
        const parts = line.split(/(\x1b\[[0-9;]*m)/g);
        let activeClasses = [];
        let html = '';
        for (const p of parts) {
          const m = p.match(/^\x1b\[([0-9;]*)m$/);
          if (m) {
            const codes = (m[1] || '0').split(';');
            for (const c of codes) {
              if (c === '0' || c === '') activeClasses = [];
              else if (c === '39') activeClasses = activeClasses.filter(name => name === 'ansi-bold' || name === 'ansi-dim');
              else if (c === '22') activeClasses = activeClasses.filter(name => name !== 'ansi-bold' && name !== 'ansi-dim');
              else if (ANSI_CLASSES[c]) {
                if (Number(c) >= 30) activeClasses = activeClasses.filter(name => name === 'ansi-bold' || name === 'ansi-dim');
                activeClasses.push(ANSI_CLASSES[c]);
              }
            }
          } else if (p) {
            if (activeClasses.length) {
              html += `<span class="${activeClasses.join(' ')}">${escapeHtml(p)}</span>`;
            } else {
              html += escapeHtml(p);
            }
          }
        }
        return `<div class="log-line">${html}</div>`;
      }

      // Semantic log highlighting when plain text
      let cls = '';
      if (/\b(ERROR|FATAL|ERR|Exception|Unhandled)\b/i.test(line)) cls = 'ansi-red';
      else if (/\b(WARN|WARNING)\b/i.test(line)) cls = 'ansi-yellow';
      else if (/\b(INFO|READY|CONNECTED|SUCCESS|OK)\b/i.test(line)) cls = 'ansi-green';
      else if (/\b(DEBUG|TRACE)\b/i.test(line)) cls = 'ansi-cyan';

      return `<div class="log-line ${cls}">${escapeHtml(line)}</div>`;
    }).join('');
  }

  async function fetchNeuralLogs() {
    const request = ++requests.logs;
    const { organ, lines } = state.logs;
    if (state.logs.sourceOrgan !== organ) {
      state.logs.rawText = `[INFO] 正在读取 ${organ}…`;
      state.logs.source = organ;
    }
    state.logs.loading = true;
    try {
      const res = await apiFetch(`${API.LOGS}?organ=${encodeURIComponent(organ)}&lines=${encodeURIComponent(lines)}`);
      if (request === requests.logs) {
        state.logs.rawText = res.text || '';
        state.logs.source = res.source || organ;
        state.logs.sourceOrgan = organ;
      }
    } catch (err) { if (request === requests.logs) state.logs.rawText = `[ERROR] ${organ}: ${err.message}`; }
    finally { if (request === requests.logs) state.logs.loading = false; }
  }

  function currentLogLayer(){
    const id=state.logs.organ===SERVICE_CONTROL.brainFile?SERVICE_CONTROL.brain:state.logs.organ;
    return state.lastVitalsPayload?.organs?.find(o=>o.id===id);
  }
  function renderLogControls(){
    $('btnBrainRequests').hidden=!['corenyan-brain',SERVICE_CONTROL.brainFile].includes(state.logs.organ);
    const layer=currentLogLayer(),busy=Boolean(state.busyOrgan),controllable=layer?.kind==='container';
    $('btnLogPower').textContent=layer?.online?'关闭 ■':'启动 ▷';
    $('btnLogPower').disabled=!controllable||busy;
    $('btnLogRestart').disabled=!controllable||!layer?.online||busy;
    $('btnLogCortex').disabled=!EXPLORER.modules.some(m=>m.id===layer?.id);
    $('logServiceState').textContent=layer
      ? layer.name+' · '+(busy&&state.busyOrgan===layer.id?'操作中…':layer.stateLabel||layer.stateCode)
      : '读取进程状态…';
    const started=$('logServiceStarted'),date=new Date(layer?.startedAt||NaN);
    started.hidden=!Number.isFinite(date.getTime());
    if(!started.hidden){started.dateTime=date.toISOString();started.textContent='上次启动 · '+date.toLocaleString(UI.locale,{timeZone:UI.timezone,hour12:false});}
  }
  async function openLogRoot(){
    const layer=currentLogLayer(),module=EXPLORER.modules.find(m=>m.id===layer?.id);
    if(!module||!await confirmFileDiscard())return;
    switchChapter(VIEW.MEMORY);
    await selectFileScope(module.defaultScope,false);
  }

  function initNeuralTerminal() {
    mountApiRecords({button:$('btnBrainRequests'),apiFetch});
    terminalView=createTerminalView($('neuralLogTerminal'),{onDeferred:paused=>{
      $('logSelectionStatus').textContent=paused?'选区已保留 · 取消选择后显示最新日志':'';
    }});
    $('btnLogPower').addEventListener('click',()=>{const layer=currentLogLayer();if(layer)triggerOrganAction(layer.id,layer.online?'stop':'start');});
    $('btnLogRestart').addEventListener('click',()=>{const layer=currentLogLayer();if(layer)triggerOrganAction(layer.id,'restart');});
    $('btnLogCortex').addEventListener('click',openLogRoot);

    $('logOrganSelect')?.addEventListener('change', e => { state.logs.organ = e.target.value; fetchNeuralLogs(); });
    $('logLinesSelect')?.addEventListener('change', e => { state.logs.lines = Number(e.target.value); fetchNeuralLogs(); });
    $('logFilterInput')?.addEventListener('input', e => { state.logs.filter = e.target.value; });
    $('logAutoRefreshCheck')?.addEventListener('change', e => { state.logs.autoRefresh = e.target.checked; });
    $('btnScrollLogBottom')?.addEventListener('click', () => { const term = $('neuralLogTerminal'); term.scrollTop = term.scrollHeight; });
    $('btnFetchLogsNow')?.addEventListener('click', fetchNeuralLogs);
  }

  // ==========================================================================
  // 10. CHAPTER 05: ENDOCRINE RECEPTORS (BRAIN CONFIG JSON IDE)
  // ==========================================================================
  async function loadBrainConfig() {
    const editor = $('brainConfigEditor');
    if (!editor) return;
    const request = ++requests.config;
    const priorText = state.endocrine.rawText;
    try {
      const res = await apiFetch(API.BRAIN_CONFIG);
      if (request !== requests.config || state.endocrine.rawText !== priorText) return;
      const formatted = JSON.stringify(res.config || {}, null, EDITOR.indent);
      state.endocrine.rawText = formatted;
      state.endocrine.originalText = formatted;
      state.endocrine.dirty = false;

    } catch (err) {
      showToast(termTextTemplate`读取{{concept.endocrine.zh}}配置失败: ${err.message}`, true);
    }
  }

  function updateEndocrineSummaryCards(cfg) {
    if ($('endoModelPrimary')) $('endoModelPrimary').textContent = cfg?.llm?.model || cfg?.model_presets?.text || '--';
    if ($('endoModelVision')) $('endoModelVision').textContent = cfg?.llm?.vision_model || cfg?.model_presets?.vision || '--';
    if ($('endoModelPainter')) $('endoModelPainter').textContent = cfg?.image_llm?.model || cfg?.model_presets?.image || '--';
    if ($('endoPainterSize')) $('endoPainterSize').textContent = cfg?.image_llm?.size || 'auto';
  }

  function refreshEndocrineIde() {
    const editor = $('brainConfigEditor');
    const statusEl = $('brainCfgStatus');
    if (!editor) return;

    const isDirty = state.endocrine.rawText !== state.endocrine.originalText;
    state.endocrine.dirty = isDirty;

    try {
      const parsed = JSON.parse(state.endocrine.rawText || '{}');
      updateEndocrineSummaryCards(parsed);
      if (statusEl) {
        statusEl.textContent = isDirty ? 'MODIFIED ●' : 'VALID JSON ✓';
        statusEl.className = `ide-dirty-tag ${isDirty ? 'dirty' : ''}`;
      }
    } catch {
      if (statusEl) {
        statusEl.textContent = 'SYNTAX ERROR !';
        statusEl.className = 'ide-dirty-tag error';
      }
    }
  }

  async function saveBrainConfig() {
    const editor = $('brainConfigEditor');
    if (!editor) return;
    const savingText = state.endocrine.rawText;
    let parsed;
    try {
      parsed = JSON.parse(savingText);
    } catch (err) {
      showToast(termTextTemplate`JSON 语法错误，无法写入{{concept.brainCore.zh}}配置: ${err.message}`, true);
      return;
    }

    try {
      await apiFetch(API.BRAIN_CONFIG, {
        method: 'POST',
        body: { config: parsed }
      });
      const clean = JSON.stringify(parsed, null, EDITOR.indent);

      state.endocrine.originalText = clean;
      if (state.endocrine.rawText === savingText) state.endocrine.rawText = clean;

      showToast(termText("{{concept.endocrine.zh}}{{concept.receptor.zh}}配置 (config.json) 已原子写入生效"));
      await pollVitals();
    } catch (err) {
      showToast(termTextTemplate`保存{{concept.brainCore.zh}}配置失败: ${err.message}`, true);
    }
  }

  function initEndocrineIde() {
    configEditorView = createEditor('brainConfigEditor', value => { state.endocrine.rawText = value; }, saveBrainConfig, 'brainCfgCursorMeta');
    $('btnFormatBrainCfg')?.addEventListener('click', () => {
      try { state.endocrine.rawText = JSON.stringify(JSON.parse(state.endocrine.rawText), null, EDITOR.indent); }
      catch (err) { showToast(`JSON 语法错误: ${err.message}`, true); }
    });
    $('btnReloadBrainCfg')?.addEventListener('click', () => loadBrainConfig());
    $('btnSaveBrainCfg')?.addEventListener('click', () => saveBrainConfig());
  }

  // ==========================================================================
  // 11. GLOBAL KEYBOARD SHORTCUTS, DIALOG WIRING & BOOTSTRAP
  // ==========================================================================
  function initGlobalShortcutsAndDialogs() {
    $('wireDialogInput')?.addEventListener('input', e => { if (state.dialog) state.dialog.value = e.target.value; });
    $('wireDialogConfirmBtn')?.addEventListener('click', () => {
      if (state.dialogResolver) state.dialogResolver(true);
    });
    $('wireDialogCancelBtn')?.addEventListener('click', () => {
      if (state.dialogResolver) state.dialogResolver(false);
    });
    $('wireDialogInput')?.addEventListener('keydown', (e) => {
      if (e.key === 'Enter' && state.dialogResolver) {
        e.preventDefault();
        state.dialogResolver(true);
      } else if (e.key === 'Escape' && state.dialogResolver) {
        e.preventDefault();
        state.dialogResolver(false);
      }
    });

    window.addEventListener('keydown', (e) => {
      if (e.key === 'Escape') {
        if(document.querySelector('dialog[open]'))return;
        if (state.dialogResolver) {
          state.dialogResolver(false);
          return;
        }
        if (state.lightbox.open) {
          closeArtworkLightbox();
          return;
        }
        if (state.dossier.open) closeBondDossier();
        closeFmContextMenu();
      } else if (state.lightbox.open) {
        if (shortcut(e,'images.previous')) stepLightbox(-1);
        else if (shortcut(e,'images.next')) stepLightbox(1);
      }
    });
  }

  async function bootstrap() {
    applyStaticTerminology();
    mountHealthDials($('healthDials'));
    initEditorialChrome();

    initVitalsLedgerControls();
    initFileManagerAndIde();
    initNeuralTerminal();
    initEndocrineIde();
    initGlobalShortcutsAndDialogs();
    initSubscriptions();
    mountEvidenceImages($('bondModalBody'));
    mountWaveform($('ecgCanvas'), registry);
    mountEntityView($('view-entity'), registry, () => state.lastVitalsPayload?.organs || []);
    mountHealthDetails(registry);
    mountAmbientEffects(registry);
    initFileShortcuts();
    onPreferences(()=>{for(const id of ['open','rename','copy','cut','paste','delete']){const label=document.querySelector('[data-ctx="'+id+'"] span:last-child');if(label)label.textContent=editorShortcutLabel(id);}});
    mountExplorerSelection({list:$('fmFileList'),getSelection:()=>state.fm.selection,select:selectExplorerTarget,closeMenu:closeFmContextMenu,
      setSelection:paths=>{state.fm.selection=new Set(paths);const row=[...$('fmFileList').querySelectorAll('[data-rel-path]')].find(row=>paths.has(row.dataset.relPath));state.fm.selected=row?{scope:state.fm.currentScope,relPath:row.dataset.relPath,name:row.dataset.name,isDir:row.dataset.isDir==='1'}:null;},
      open:async(target,event)=>{if(target.isDir){if(state.fm.viewMode===FILE_VIEW.GRID)await navigateIconGridFolder(target.relPath);else{if(state.fm.expandedDirs.has(target.relPath))state.fm.expandedDirs.delete(target.relPath);else state.fm.expandedDirs.add(target.relPath);}}else{await openCortexFile(state.fm.currentScope,target.relPath);if(event.target.closest('.grid-slice-icon')?.querySelector('img'))openCortexImage();}}
    });
    mountTextContextMenu({onError:message=>showToast(message,true)});
    initFileDragging();
    mountRecycleBin(registry, apiFetch, refreshCurrentScopeFiles);
    layerEditor=mountLayerEditor(apiFetch,async()=>{await loadFileScopes(false);await pollVitals();});
    mountChat($('view-chat'),registry);
    mountMobileLayout(registry);
    mountOnebotLogin(registry,message=>showToast(message,true));
    mountSettings(registry,{openSystemConfig:async entry=>{
      if(!await confirmFileDiscard())return false;
      await loadFileScopes(false);
      switchChapter(VIEW.MEMORY);
      await selectFileScope(entry.scope,false);
      if(entry.file)await openCortexFile(entry.scope,entry.file,false);
      return true;
    }});
    mountModelPresets(apiFetch,{createEditor,syncEditor,onApplied:async()=>{await pollVitals();if(!state.endocrine.dirty)await loadBrainConfig();},openDirectory:async()=>{
      closeDialog(document.getElementById('settingsDialog'));
      await loadFileScopes(false);
      switchChapter(VIEW.MEMORY);
      await selectFileScope(MODEL_PRESETS.scope);
      requestAnimationFrame(()=>{document.querySelector('[data-scope="'+MODEL_PRESETS.scope+'"]')?.scrollIntoView({block:'nearest'});$('view-memory')?.scrollIntoView({block:'start'});});
    }});

    $('btnAddLayer').addEventListener('click',()=>layerEditor.open());
    workspaceSearch=mountWorkspaceSearch(apiFetch,async item=>{
      if(!await confirmFileDiscard())return false;
      switchChapter(VIEW.MEMORY);
      await selectFileScope(item.scope,false);
      await openCortexFile(item.scope,item.path,false);
      if(state.fm.activeFile?.path!==item.path)return false;
      if(item.line){const pos={line:item.line-1,ch:0};fmEditorView.setCursor(pos);fmEditorView.scrollIntoView(pos,120);}
      return true;
    },()=>state.fm.scopes);
    $('fmBtnSearch').addEventListener('click',()=>workspaceSearch.open());
    window.addEventListener('keydown',event=>{
      if(shortcut(event,'workspace.search')&&state.activeView===VIEW.MEMORY&&!document.querySelector('dialog[open]')){
        event.preventDefault();workspaceSearch.open();
      }
    });
    await loadFileScopes(false);

    await pollVitals();
    await navigation.start();

    // Non-blocking periodic background telemetry
    setInterval(() => {
      if (document.hidden) return;
      pollVitals();
      if (state.activeView === VIEW.NEURAL && state.logs.autoRefresh) {
        fetchNeuralLogs();
      }
    }, TIMING.poll);
  }

  if (document.readyState === 'loading') {
    document.addEventListener('DOMContentLoaded', bootstrap);
  } else {
    bootstrap();
  }
})();
