export function minecraftNames(profile,aliases=[]){
 const identities=profile.identities||{};
 const explicit=Array.isArray(identities.playerNames);
 const names=explicit?[...identities.playerNames]:[profile.mcName,...(Array.isArray(profile.mcNames)?profile.mcNames:[])];
 if(!explicit&&!identities.qq?.length&&!profile.qq){
  if(/^[A-Za-z0-9_]{1,16}$/.test(profile.name||''))names.push(profile.name);
  for(const alias of aliases)if(/^[A-Za-z0-9_]{1,16}$/.test(alias)&&!/^QQ_/i.test(alias)&&!/^\d+$/.test(alias))names.push(alias);
 }
 return [...new Set(names.filter(n=>typeof n==='string'&&n.trim()).map(n=>n.trim()))];
}

// Assessments enrich an incoming turn; they are not another user activity.
// Keep the underlying Brain audit log untouched, including unmatched assessments.
export function recentInteractions(evidence=[],limit=15){
 const rows=[],byId=new Map(),seen=new Set();
 for(const ev of evidence){
  if(!ev||ev.id&&seen.has(ev.id))continue;
  if(ev.id)seen.add(ev.id);
  const row={id:ev.id||'',turnId:ev.turnId||'',at:ev.at,role:ev.role,type:ev.type,text:ev.text||'',assistantContext:ev.assistantContext||'',delta:Number(ev.delta)||0,conversationId:ev.conversationId||''};
  rows.push(row);if(row.id)byId.set(row.id,row);
 }
 const merged=new Set();
 for(const row of rows){
  if(row.type!=='assessment'||!row.turnId)continue;
  const parent=byId.get(row.turnId);
  if(!parent||parent===row||parent.type==='assessment')continue;
  parent.delta=Math.round((parent.delta+row.delta)*10000)/10000;
  parent.assistantContext=row.assistantContext||parent.assistantContext;
  parent.conversationId=parent.conversationId||row.conversationId;
  parent.assessedAt=row.at;
  merged.add(row);
 }
 return rows.filter(row=>!merged.has(row)).sort((a,b)=>(Number(b.at)||0)-(Number(a.at)||0)).slice(0,limit);
}
