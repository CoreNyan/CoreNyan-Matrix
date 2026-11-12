export function attachmentHeaders(file,download=false){
 const inline=/^(image\/(png|jpeg|webp|gif)|audio\/(mpeg|wav|ogg)|video\/(mp4|webm))$/.test(file.mime);
 const safeName=String(file.name||'attachment').replace(/[\x00-\x1f\x7f"\\/]/g,'_'),ascii=safeName.replace(/[^\x20-\x7e]/g,'_');
 return {'Content-Type':file.mime||'application/octet-stream','Content-Disposition':(inline&&!download?'inline':'attachment')+'; filename="'+ascii+'"; filename*=UTF-8\'\''+encodeURIComponent(safeName),'X-Content-Type-Options':'nosniff','Content-Security-Policy':"default-src 'none'; sandbox allow-downloads",'Cache-Control':'private, no-store'};
}
