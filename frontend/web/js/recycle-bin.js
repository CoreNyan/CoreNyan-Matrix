import {showDialog,closeDialog,setPanelVisible} from './ui-motion.js';
import { termText } from './terminology.js';
import { API, UI, TRASH_PREVIEW } from './constants.js';

export function mountRecycleBin(registry, apiFetch, refreshFiles) {
  const state = registry.state, t = state.trash;
  const dialog = document.createElement('dialog');
  dialog.id = 'recycleBinDialog'; dialog.className = 'recycle-window';
  dialog.setAttribute('aria-labelledby', 'trashTitle');
  dialog.setAttribute('data-navigation-independent', '');
  dialog.innerHTML = `<header class="trash-header"><div><h2 id="trashTitle"></h2><p>按分区找回文件 · 预览不会修改原文件</p></div><button class="wire-action-btn" data-trash-close autofocus>关闭 ×</button></header>
    <div class="trash-toolbar"><label>分区 <select data-trash-scope aria-label="回收站分区"></select></label><input type="search" data-trash-search placeholder="搜索路径或分区" aria-label="搜索回收站"><button class="wire-action-btn" data-trash-refresh>刷新</button></div>
    <p class="trash-status" role="status"></p><div class="trash-confirm-host"></div>
    <div class="trash-actions"><label><input type="checkbox" data-trash-select-all> 全选当前结果</label><span data-trash-count></span><button class="wire-action-btn" data-trash-restore-selected>还原所选</button><button class="wire-action-btn" data-trash-purge-selected>清理所选</button><button class="wire-action-btn" data-trash-empty>清空当前结果</button></div>
    <div class="trash-panes"><ul class="trash-list" aria-label="回收站文件"></ul><section class="trash-preview" aria-label="回收站预览"></section></div>`;
  document.body.append(dialog);
  dialog.querySelector('#trashTitle').textContent = termText('{{file.trash.zh}}');
  const $ = selector => dialog.querySelector(selector);
  const esc = value => String(value ?? '').replace(/[&<>"']/g, c => ({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
  const key = item => item.scope + ':' + item.id;
  const visible = () => t.items.filter(item => (item.path + ' ' + item.scopeLabel + ' ' + item.scope).toLowerCase().includes(t.query.toLowerCase()));
  let loadVersion = 0, previewVersion = 0, returnFocus;
  function resetPreview() { ++previewVersion; t.previewKey = ''; t.preview = null; t.previewLoading = false; }
  async function load() {
    const version = ++loadVersion;
    t.loading = true; t.error = '';
    try {
      const data = await apiFetch(API.FS_TRASH + '?' + new URLSearchParams({scope:t.scope}));
      if (version !== loadVersion) return;
      t.items = data.items || []; t.scopes = data.scopes || [];
      t.selected = t.selected.filter(id => t.items.some(item => key(item) === id));
      if (!t.items.some(item => key(item) === t.previewKey)) resetPreview();
      t.error = (data.errors || []).map(e => (e.scopeLabel || e.scope) + ': ' + e.error).join('；');
    } catch (error) { if (version === loadVersion) t.error = error.message; }
    finally { if (version === loadVersion) t.loading = false; }
  }
  async function preview(id, relative = '') {
    const item = t.items.find(item => key(item) === id);
    if (!item) return;
    const version = ++previewVersion;
    t.previewKey = id; t.preview = null; t.previewLoading = true;
    try {
      const data = await apiFetch(API.FS_TRASH_READ + '?' + new URLSearchParams({scope:item.scope,id:item.id,path:relative}));
      if (version === previewVersion) t.preview = {...data,scope:item.scope,id:item.id};
    } catch (error) { if (version === previewVersion) t.preview = {error:error.message}; }
    finally { if (version === previewVersion) t.previewLoading = false; }
  }
  function close() {
    if (t.busy) return;
    ++loadVersion; resetPreview(); t.confirmIds = []; t.loading = false; t.open = false;
  }
  async function operate(ids, purge) {
    if (t.busy || !ids.length) return;
    const targets = t.items.filter(item => ids.includes(key(item)));
    t.busy = true; t.confirmIds = [];
    const errors = [], affected = new Set();
    try {
      if (purge) {
        for (const scope of new Set(targets.map(item => item.scope))) {
          try {
            await apiFetch(API.FS_PURGE,{method:'POST',body:{scope,ids:targets.filter(item=>item.scope===scope).map(item=>item.id)}});
            affected.add(scope);
          } catch (error) { errors.push(scope + ': ' + error.message); }
        }
      } else {
        for (const item of targets) {
          try { await apiFetch(API.FS_RESTORE,{method:'POST',body:{scope:item.scope,id:item.id}}); affected.add(item.scope); }
          catch (error) { errors.push(item.path + ': ' + error.message); }
        }
      }
      await load();
      if (affected.has(state.fm.currentScope)) await refreshFiles();
      t.error = [t.error,...errors].filter(Boolean).join('；');
    } finally { t.busy = false; }
  }
  document.getElementById('fmBtnTrash').addEventListener('click', () => {
    returnFocus = document.activeElement; t.open = true; t.confirmIds = []; load();
  });
  dialog.addEventListener('cancel', event => { event.preventDefault(); close(); });
  $('[data-trash-search]').addEventListener('input', event => { t.query = event.target.value; t.confirmIds = []; });
  $('[data-trash-scope]').addEventListener('change', event => {
    t.scope = event.target.value; t.selected = []; t.confirmIds = []; resetPreview(); load();
  });
  dialog.addEventListener('change', event => {
    if (t.busy) return;
    if (event.target.matches('[data-trash-select]')) {
      const id = event.target.dataset.trashSelect;
      t.selected = event.target.checked ? [...new Set([...t.selected,id])] : t.selected.filter(value=>value!==id);
    }
    if (event.target.matches('[data-trash-select-all]')) {
      const ids = visible().map(key);
      t.selected = event.target.checked ? [...new Set([...t.selected,...ids])] : t.selected.filter(id=>!ids.includes(id));
    }
  });
  dialog.addEventListener('click', event => {
    const button = event.target.closest('button');
    if (!button || t.busy) return;
    if (button.hasAttribute('data-trash-close')) return close();
    if (button.hasAttribute('data-trash-refresh')) { t.confirmIds = []; return load(); }
    if (button.hasAttribute('data-trash-preview')) return preview(button.dataset.trashPreview);
    if (button.hasAttribute('data-trash-child')) return preview(t.previewKey,button.dataset.trashChild);
    if (button.hasAttribute('data-trash-restore')) return operate([button.dataset.trashRestore],false);
    if (button.hasAttribute('data-trash-restore-selected')) return operate([...t.selected],false);
    if (button.hasAttribute('data-trash-purge')) t.confirmIds = [button.dataset.trashPurge];
    if (button.hasAttribute('data-trash-purge-selected')) t.confirmIds = [...t.selected];
    if (button.hasAttribute('data-trash-empty')) t.confirmIds = visible().map(key);
    if (button.hasAttribute('data-trash-cancel')) t.confirmIds = [];
    if (button.hasAttribute('data-trash-confirm')) return operate([...t.confirmIds],true);
  });
  registry.subscribe(['trash'], () => {
    if (!t.open) { if (dialog.open) { closeDialog(dialog).then(closed=>{if(closed&&!dialog.open)returnFocus?.focus();}); } return; }
    const blocked = t.busy || t.loading, items = visible(), disabled = blocked ? 'disabled' : '';
    const scopeOptions = [{id:TRASH_PREVIEW.allScope,label:'全部分区'},...t.scopes];
    const select = $('[data-trash-scope]');
    const html = scopeOptions.map(scope=>`<option value="${esc(scope.id)}">${esc(scope.label)}</option>`).join('');
    if (select.innerHTML !== html) select.innerHTML = html;
    select.value = t.scope; select.disabled = blocked;
    $('[data-trash-search]').disabled = t.busy;
    $('[data-trash-close]').disabled = t.busy;
    $('[data-trash-refresh]').disabled = blocked;
    $('.trash-status').textContent = t.error || (t.loading ? '正在加载…' : items.length + ' 项 · 删除后保留，手动清理才会永久移除');
    $('.trash-status').classList.toggle('has-error',Boolean(t.error));
    $('[data-trash-count]').textContent = '已选 ' + t.selected.length + ' 项';
    $('[data-trash-select-all]').checked = items.length > 0 && items.every(item=>t.selected.includes(key(item)));
    $('[data-trash-select-all]').indeterminate = items.some(item=>t.selected.includes(key(item))) && !items.every(item=>t.selected.includes(key(item)));
    $('[data-trash-select-all]').disabled = blocked || !items.length;
    for (const selector of ['[data-trash-restore-selected]','[data-trash-purge-selected]']) $(selector).disabled = blocked || !t.selected.length;
    $('[data-trash-empty]').disabled = blocked || !items.length;
    const confirmHost=$('.trash-confirm-host');
    if(t.confirmIds.length)confirmHost.innerHTML = `<div class="trash-confirm" role="alert"><p>永久清理已选定的 ${t.confirmIds.length} 项？清理后无法还原；之后新加入的文件会保留。</p><button class="wire-action-btn" data-trash-cancel ${disabled}>取消</button><button class="wire-action-btn" data-trash-confirm ${disabled}>确认永久清理</button></div>`;
    setPanelVisible(confirmHost,Boolean(t.confirmIds.length));
    const focused = document.activeElement;
    const focusAttribute = ['data-trash-select','data-trash-preview','data-trash-restore','data-trash-purge'].find(name => focused?.hasAttribute(name));
    const focusValue = focusAttribute ? focused.getAttribute(focusAttribute) : '';
    $('.trash-list').innerHTML = items.map(item=>{
      const id = esc(key(item));
      return `<li class="${t.previewKey===key(item)?'is-previewed':''}"><input type="checkbox" data-trash-select="${id}" aria-label="选择 ${esc(item.path)}" ${t.selected.includes(key(item))?'checked':''} ${disabled}><button class="trash-file" data-trash-preview="${id}"><strong>${esc(item.path)}</strong><small>${esc(item.scopeLabel || item.scope)} · ${item.isDir?'文件夹':'文件'} · ${esc(new Date(item.deletedAt).toLocaleString(UI.locale))}</small></button><div class="trash-row-actions"><button class="wire-action-btn" data-trash-restore="${id}" ${disabled}>还原</button><button class="wire-action-btn" data-trash-purge="${id}" ${disabled}>永久删除</button></div></li>`;
    }).join('') || '<li class="trash-empty">此处没有已删除的文件</li>';
    if (focusAttribute) {
      const replacement = [...dialog.querySelectorAll('[' + focusAttribute + ']')].find(node => node.getAttribute(focusAttribute) === focusValue);
      replacement?.focus({preventScroll:true});
    }
    const p = t.preview;
    let body = '<p class="trash-empty">选择文件，快速预览</p>';
    if (t.previewLoading) body = '<p class="trash-empty">正在读取预览…</p>';
    else if (p?.error) body = '<p role="alert">' + esc(p.error) + '</p>';
    else if (p) {
      body = `<header><strong>${esc(p.name)}</strong><small>${esc(p.scope)} · ${Number(p.size||0).toLocaleString(UI.locale)} B</small></header>`;
      if (p.relative) body += `<button class="wire-action-btn" data-trash-child="${esc(p.relative.split('/').slice(0,-1).join('/'))}">↑ 上一级</button>`;
      if (p.kind === 'text') body += '<pre>' + esc(p.content) + '</pre>';
      if (p.kind === 'image') body += `<img alt="${esc(p.name)}" src="${API.FS_TRASH_PREVIEW}?${esc(new URLSearchParams({scope:p.scope,id:p.id,path:p.relative||''}))}">`;
      if (p.kind === 'directory') body += '<div class="trash-children">' + p.entries.map(entry=>`<button data-trash-child="${esc(entry.path)}">${entry.isDir?'▱':'↳'} ${esc(entry.name)}</button>`).join('') + '</div>';
      if (p.kind === 'binary') body += '<p>此格式暂不支持快速预览，恢复后可使用对应应用打开。</p>';
      if (p.truncated) body += '<p>内容较长，仅显示开头部分。</p>';
    }
    // Preserve scroll position and decoded images when unrelated selection changes.
    const pane = $('.trash-preview');
    if (pane.innerHTML !== body) pane.innerHTML = body;
    showDialog(dialog);
  });
}
