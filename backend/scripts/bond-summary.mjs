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
