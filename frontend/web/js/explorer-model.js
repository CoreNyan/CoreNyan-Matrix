import { UI } from './constants.js';
import { termText } from './terminology.js';

let catalogModules=null, catalogScopes=[];
export function configureExplorer(scopes,modules){catalogScopes=scopes;catalogModules=modules?.length?modules:null;}
export const EXPLORER = Object.freeze({
  brain: 'corenyan-brain', gateway: 'corenyan-gateway', web: 'corenyan-web', redis: 'corenyan-redis',
  artworkScope: 'artworks', configScope: 'endocrine', previewApi: '/api/fs/preview',
  get modules(){return catalogModules||Object.freeze([
    { id: 'corenyan-brain', label: 'corenyan-brain', defaultScope: UI.defaultScope },
    { id: 'corenyan-gateway', label: 'corenyan-gateway', defaultScope: 'gateway_src' },
    { id: 'corenyan-web', label: 'CoreNyan-Matrix', defaultScope: 'web_src' },
    { id: 'corenyan-redis', label: 'Redis', defaultScope: 'redis_src' }
  ]);}
});
export {IMAGE_TYPES,isImageFile,isBinaryFile} from '../../../contracts/file-types.js';
export const scopeModule = scope => catalogScopes.find(s=>s.id===scope)?.moduleId || ({ gateway_src: EXPLORER.gateway, web_src: EXPLORER.web, redis_src: EXPLORER.redis })[scope] || EXPLORER.brain;
export const configScope = () => ({ id: EXPLORER.configScope, label: termText('{{chapter.endocrine.en}}'), sub: 'config.json' });


// Root is the existing module scope, displayed once before its shortcut children.
// Stable scope IDs keep old bookmarks and recycle-bin ownership intact.
export function moduleScopes(scopes, moduleId) {
  const module = EXPLORER.modules.find(item => item.id === moduleId);
  if (!module) return [];
  const root = scopes.find(scope => scope.id === module.defaultScope);
  const children = scopes.filter(scope => scopeModule(scope.id) === moduleId && scope.id !== module.defaultScope);
  return [...(root ? [{...root, label: termText('{{file.root.zh}}'), sub: termText('{{file.root.description}}')}] : []), ...children];
}
