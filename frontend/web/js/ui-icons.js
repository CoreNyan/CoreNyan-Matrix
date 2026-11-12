import {MOBILE_UI} from './mobile-layout-config.js';
const paths={
 models:'M4 4h16v16H4z M8 1v6m8-6v6M8 17v6m8-6v6M1 8h6m10 0h6M1 16h6m10 0h6',
 account:'M16 21v-2a4 4 0 0 0-4-4H6a4 4 0 0 0-4 4v2 M17 4a4 4 0 0 1 0 8m3 4a4 4 0 0 1 2 4 M13 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
 assistant:MOBILE_UI.nav.neural[1],
 system:'M3 3h18v7H3z M3 14h18v7H3z M7 6h.01M7 17h.01m5-11h6m-6 11h6',
 profile:'M20 21a8 8 0 0 0-16 0 M16 7a4 4 0 1 1-8 0 4 4 0 0 1 8 0',
 website:'M12 3a9 9 0 1 0 9 9c0-2-2-3-4-2s-3-1-2-3-1-4-3-4 M7 9h.01M7 14h.01M11 17h.01',
 shortcuts:'M2 5h20v14H2z M6 9h.01M10 9h.01M14 9h.01M18 9h.01M6 13h.01M10 13h8',
 notifications:'M5 17h14l-2-4V9a5 5 0 0 0-10 0v4z M10 21h4',sounds:'M4 9h4l5-4v14l-5-4H4z M17 8a6 6 0 0 1 0 8m3-11a10 10 0 0 1 0 14',
 copy:'M9 9h12v12H9z M5 15H3V3h12v2',cut:'m9 8 12 13M9 16 21 3 M9 6a3 3 0 1 1-6 0 3 3 0 0 1 6 0 M9 18a3 3 0 1 1-6 0 3 3 0 0 1 6 0',paste:'M8 5H4v16h16V5h-4 M8 3h8v5H8z',
 undo:'M8 4 3 9l5 5 M3 9h11a7 7 0 0 1 0 14',redo:'m16 4 5 5-5 5 M21 9H10a7 7 0 0 0 0 14',selectAll:'M3 8V3h5m8 0h5v5m0 8v5h-5m-8 0H3v-5 M8 8h8v8H8z',find:'M16 10a6 6 0 1 1-12 0 6 6 0 0 1 12 0m-2 4 7 7',replace:'m3 7 3-3 3 3M6 4v12h7m8 1-3 3-3-3m3 3V8h-7',
 upload:'M12 16V3m-5 5 5-5 5 5M3 16v5h18v-5',reset:'M3 10a9 9 0 1 1 2 8M3 3v7h7',play:'m8 4 12 8-12 8z',add:'M12 4v16M4 12h16',delete:'M3 6h18M9 6V3h6v3M5 6l1 15h12l1-15M10 10v7m4-7v7',logout:'M9 3H3v18h6m5-13 5 4-5 4m-5-4h10',lock:'M5 10h14v11H5z M8 10V7a4 4 0 0 1 8 0v3',folder:'M3 5h7l2 3h9v13H3z'
};
export const icon=name=>`<svg class="ui-icon" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.6" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="${paths[name]||paths.system}"/></svg>`;
export function decorateSettings(root){
 const actions={'[data-rule-copy],[data-clone]':'copy','[data-reset],[data-reset-shortcuts],[data-reload],[data-sound-reload],.shortcut-reset':'reset','[data-sound-upload],[data-avatar-upload]':'upload','[data-system-test],[data-mail-test],[data-sound-preview],[data-rule-test]':'play','[data-new],[data-add-backup],[data-add-retry],[data-rule-add],.account-create button':'add','[data-delete],[data-remove-retry],[data-rule-delete]':'delete','[data-password-form] button':'lock','.settings-signout button':'logout','[data-system-settings]':'system','[data-grant]':'notifications','[data-folder],[data-preset-folder]':'folder'};
 const render=()=>{for(const [selector,name] of Object.entries(actions))for(const button of root.querySelectorAll(selector))if(!button.querySelector('.ui-icon'))button.insertAdjacentHTML('afterbegin',icon(name));};
 render();new MutationObserver(render).observe(root,{childList:true,subtree:true});
}
