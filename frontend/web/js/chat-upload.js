export async function readUploadChunk(blob,{Reader=globalThis.FileReader,timeoutMs=30000}={}){
 let timer;try{return await Promise.race([
  typeof blob.arrayBuffer==='function'?blob.arrayBuffer():new Promise((resolve,reject)=>{const reader=new Reader();reader.onload=()=>resolve(reader.result);reader.onerror=()=>reject(Error('无法读取所选文件，请重新选择本机文件'));reader.onabort=()=>reject(Error('文件读取已取消'));reader.readAsArrayBuffer(blob);}),
  new Promise((_,reject)=>{timer=setTimeout(()=>reject(Error('读取文件超时，请先将网盘文件下载到本机后再选择')),timeoutMs);})
 ]);}catch(e){if(['NotReadableError','NotFoundError','SecurityError'].includes(e?.name))throw Error('无法读取所选文件，请重新从系统文件管理器选择本机文件');throw e;}finally{clearTimeout(timer);}
}
export async function uploadChatFile(file,{write,url,chunkBytes,maxBytes,onProgress=()=>{}}){
 if(!file||!Number.isSafeInteger(file.size)||file.size<0)throw Error('无法读取这个文件的大小，请重新选择');
 if(file.size>maxBytes)throw Error('文件超过 64 MB：'+file.name);
 onProgress(0);
 const request=async(endpoint,body)=>{const controller=new AbortController(),timer=setTimeout(()=>controller.abort(),45000);try{return await write(endpoint,body,controller.signal);}catch(e){if(e.name==='AbortError')throw Error('上传超时，请检查网络后重新选择文件');throw e;}finally{clearTimeout(timer);}};
 const begin=await request(url+'/files/begin',{name:file.name,bytes:file.size});
 for(let offset=0;offset<file.size;offset+=chunkBytes){
  const bytes=new Uint8Array(await readUploadChunk(file.slice(offset,offset+chunkBytes)));if(!bytes.length)throw Error('所选文件无法读取，请先保存到本机再上传');
  let binary='';for(let i=0;i<bytes.length;i+=8192)binary+=String.fromCharCode(...bytes.subarray(i,i+8192));
  await request(url+'/files/chunk',{id:begin.file.id,offset,base64:btoa(binary)});onProgress(Math.min(100,Math.round((offset+bytes.length)/file.size*100)));
 }
 return (await request(url+'/files/finish',{id:begin.file.id})).file;
}
