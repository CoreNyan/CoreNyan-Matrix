import path from 'node:path';
// Private conversation storage is served only through the account-scoped CHAT API.
export function chatPrivatePath(file){const p=path.resolve(file).replace(/\\/g,'/');return /\/data\/(?:api-records|private-diaries|office|telegram|bilibili)(?:\/|$)/i.test(p)||/(?:^|\/)(?:(?:chat|channels-inbox|platform-inbox)\.sqlite(?:-wal|-shm)?|\.chat-requests|\.state-requests|\.tool-requests|\.video-jobs)(?:\/|$)/i.test(p)||/\/workspace\/attachments\/(?:chat|telegram|bilibili)(?:\/|$)/i.test(p);}
