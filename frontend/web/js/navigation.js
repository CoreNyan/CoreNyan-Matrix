import { UI } from './constants.js';
import { EXPLORER, scopeModule } from './explorer-model.js';

// Stable URLs are protocol identifiers; configurable display terms do not rename links.
export const PAGE_PATHS = Object.freeze({ vitals: '/VITALS', organs: '/LAYERS', memory: '/CORTEX', neural: '/SYNAPSE', entity: '/ENTITY', chat: '/CHAT' });
export const isPageRoute = pathname => /^\/(?:VITALS|LAYERS|ORGANS|CORTEX|SYNAPSE|ENTITY|CHAT)(?:\/[^\s]*)?\/?$/i.test(pathname);
export function readRoute(input) {
  const url = new URL(input, 'http://localhost');
  const parts = url.pathname.split('/').filter(Boolean).map(part => decodeURIComponent(part));
  const view = Object.keys(PAGE_PATHS).find(key => PAGE_PATHS[key].slice(1) === parts[0]?.toUpperCase()) || (parts[0]?.toUpperCase() === 'ORGANS' ? 'organs' : 'vitals');
  const module = EXPLORER.modules.find(module => module.id === parts[1]);
  return {
    view, scope: view === 'memory' ? parts[2] || module?.defaultScope || UI.defaultScope : null,
    dir: url.searchParams.get('dir') || '', file: url.searchParams.get('file') || '',
    mode: url.searchParams.get('mode') === 'grid' ? 'grid' : 'tree',
    organ: view === 'neural' ? parts[1] || 'corenyan-brain' : null,
    chatThread: view === 'chat' ? parts[1] || '' : '',
    entityLayer: view === 'entity' ? parts[1] || 'corenyan-brain' : null,
    image: url.searchParams.get('image') || '', imageScope: url.searchParams.get('imageScope') || '',
    bond: url.searchParams.get('bond') || '', bondPage: Math.max(1, parseInt(url.searchParams.get('bondPage'), 10) || 1), bondQuery: url.searchParams.get('bondQuery') || ''
  };
}
export function routeUrl(route) {
  let path = PAGE_PATHS[route.view] || PAGE_PATHS.vitals;
  const query = new URLSearchParams();
  if (route.view === 'memory') {
    path += `/${encodeURIComponent(scopeModule(route.scope || UI.defaultScope))}/${encodeURIComponent(route.scope || UI.defaultScope)}`;
    if (route.mode === 'grid') query.set('mode', 'grid');
    if (route.dir) query.set('dir', route.dir);
    if (route.file) query.set('file', route.file);
  }
  if (route.view === 'neural') path += '/' + encodeURIComponent(route.organ || 'corenyan-brain');
  if (route.view === 'chat' && route.chatThread) path += '/' + encodeURIComponent(route.chatThread);
  if (route.view === 'entity') path += '/' + encodeURIComponent(route.entityLayer || 'corenyan-brain');
  if (route.view === 'vitals') {
    if (route.bondPage > 1) query.set('bondPage', String(route.bondPage));
    if (route.bondQuery) query.set('bondQuery', route.bondQuery);
  }
  if (route.image) { query.set('image', route.image); if (route.imageScope) query.set('imageScope', route.imageScope); }
  if (route.bond) query.set('bond', route.bond);
  return path + (query.size ? '?' + query : '');
}

export function createNavigation({ snapshot, restore, flush, onError, invalidate = () => {} }, browser = window) {
  let ready = false, restoring = false, queue = Promise.resolve(), generation = 0;
  const current = () => browser.location.pathname + browser.location.search;
  function commit(replace = false) {
    if (!ready || restoring) return;
    const next = routeUrl(snapshot());
    if (next !== current() || replace) {
      browser.history[replace ? 'replaceState' : 'pushState']({ corenyan: true, from: replace ? null : current() }, '', next);
    }
  }
  function restoreLocation() {
    const input = browser.location.href;
    const ticket = ++generation;
    restoring = true;
    invalidate();
    queue = queue.then(async () => {
      if (ticket !== generation) return;
      try { await restore(readRoute(input), () => ticket === generation); flush(); }
      catch (error) { onError(error); }
    }).finally(() => {
      if (ticket === generation) { restoring = false; ready = true; }
    });
    return queue;
  }
  browser.addEventListener('popstate', restoreLocation);
  const interrupt = event => {
    if (event.target?.closest?.('[data-navigation-independent]')) return;
    if (!restoring) return;
    generation++; invalidate(); restoring = false; ready = true;
  };
  browser.addEventListener('pointerdown', interrupt, { capture: true, passive: true });
  browser.addEventListener('keydown', interrupt, { capture: true });
  return {
    commit,
    userNavigation() { if (!ready && !restoring) ready = true; },
    async start() { if (!ready) await restoreLocation(); commit(true); },
    get restoring() { return restoring; },
    // Close an overlay by returning to its opener when this page created the entry.
    dismiss(key) {
      const route = snapshot(); route[key] = '';
      if (key === 'image') route.imageScope = '';
      const destination = routeUrl(route);
      if (browser.history.state?.corenyan && browser.history.state.from === destination) {
        browser.history.back(); return true;
      }
      browser.history.replaceState({ corenyan: true }, '', destination);
      return false;
    }
  };
}
