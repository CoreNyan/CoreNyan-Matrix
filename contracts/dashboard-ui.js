import {term} from './terminology.js';
export const DASHBOARD_UI=Object.freeze({
 navigation:Object.freeze(Object.fromEntries(['vitals','organs','memory','neural','entity','chat'].map(id=>[id,Object.freeze({label:term('chapter.'+id+'.en'),description:term('chapter.'+id+'.zh')})]))),
 settings:term('settings.title'),global:term('settings.group.global'),personal:term('settings.group.personal'),
 settingsTabs:Object.freeze(['models','account','assistant','system','profile','website','shortcuts','notifications','sounds'].map(id=>Object.freeze([id,term('settings.'+id+'.label'),term('settings.'+id+'.detail')]))),
 backFiles:term('action.backFiles'),workspace:term('action.workspace'),openFile:term('action.resumeEdit'),refresh:term('action.refresh')
});
