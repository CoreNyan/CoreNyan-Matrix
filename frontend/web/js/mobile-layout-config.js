import {DASHBOARD_UI as D} from '../../../contracts/dashboard-ui.js';
export const MOBILE_UI=Object.freeze({
 query:'(max-width:700px), (max-width:950px) and (max-height:500px) and (pointer:coarse)',
 nav:Object.freeze({vitals:[D.navigation.vitals.label,'M2 12h4l3-8 5 16 3-8h5'],organs:[D.navigation.organs.label,'m12 3 10 5-10 5L2 8zM2 12l10 5 10-5M2 16l10 5 10-5'],memory:[D.navigation.memory.label,'M3 5h7l2 3h9v12H3z'],neural:[D.navigation.neural.label,'m5 6 5 5-5 5M13 17h6'],entity:[D.navigation.entity.label,'m12 2 9 5v10l-9 5-9-5V7zM3 7l9 5 9-5M12 12v10'],chat:[D.navigation.chat.label,'M4 4h16v13H9l-5 4z']}),
 backFiles:D.backFiles,workspace:D.workspace,openFile:D.openFile,settings:D.settings,refresh:D.refresh,
 icons:Object.freeze({back:'m15 5-7 7 7 7',settings:'M9 3h6l1 4 4 2v6l-4 2-1 4H9l-1-4-4-2V9l4-2zM12 9a3 3 0 1 0 0 6 3 3 0 0 0 0-6',refresh:'M20 7v5h-5M4 17v-5h5M6.1 6.1A8 8 0 0 1 20 12M4 12a8 8 0 0 0 13.9 5.9'})
});
