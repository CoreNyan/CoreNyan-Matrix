import path from 'node:path';
// Private conversation storage is served only through the account-scoped CHAT API.
export function chatPrivatePath(file){const p=path.resolve(file).replace(/\\/g,'/');return /\/data\/api-records(?:\/|$)/i.test(p)||/(?:^|\/)(?:chat\.sqlite(?:-wal|-shm)?|\.chat-requests|\.state-requests|\.tool-requests)(?:\/|$)/i.test(p)||/\/workspace\/attachments\/chat(?:\/|$)/i.test(p);}
