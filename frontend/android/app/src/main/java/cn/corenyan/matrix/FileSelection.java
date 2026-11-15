package cn.corenyan.matrix;
import android.app.Activity;import android.content.*;import android.net.Uri;import java.util.*;
final class FileSelection {
 // Stage selected providers on a worker thread. WebView receives stable, app-owned metadata/bytes.
 static Uri[] stage(Context context,Uri[] selected)throws Exception {
  if(selected.length>12)throw new java.io.IOException("每次最多选择 12 个文件");
  java.io.File root=new java.io.File(context.getCacheDir(),"uploads");root.mkdirs();
  java.io.File[] old=root.listFiles();long existing=0;
  if(old!=null)for(java.io.File folder:old){if(!folder.getName().matches("[a-f0-9-]{36}")||!folder.isDirectory())continue;java.io.File payload=new java.io.File(folder,"payload"),meta=new java.io.File(folder,"meta.json");if(System.currentTimeMillis()-folder.lastModified()>86400000L){payload.delete();meta.delete();folder.delete();}else existing+=payload.length();}
  ArrayList<Uri> result=new ArrayList<>();ArrayList<java.io.File> created=new ArrayList<>();long total=0;
  try{for(Uri uri:selected){
   String name="附件";try(android.database.Cursor cursor=context.getContentResolver().query(uri,new String[]{android.provider.OpenableColumns.DISPLAY_NAME},null,null,null)){if(cursor!=null&&cursor.moveToFirst()&&!cursor.isNull(0))name=cursor.getString(0);}
   if(name.length()>180)name=name.substring(0,180);String mime=context.getContentResolver().getType(uri);if(mime==null)mime="application/octet-stream";
   String id=UUID.randomUUID().toString();java.io.File folder=new java.io.File(root,id);if(!folder.mkdir())throw new java.io.IOException("无法准备上传文件");created.add(folder);java.io.File payload=new java.io.File(folder,"payload");long bytes=0;
   try(java.io.InputStream in=context.getContentResolver().openInputStream(uri);java.io.OutputStream out=new java.io.FileOutputStream(payload)){if(in==null)throw new java.io.IOException("无法读取所选文件");byte[] buffer=new byte[65536];int n;while((n=in.read(buffer))!=-1){bytes+=n;total+=n;if(bytes>64L*1024*1024)throw new java.io.IOException("单个文件不能超过 64 MB");if(existing+total>256L*1024*1024)throw new java.io.IOException("上传缓存已满，请稍后重试");if(Thread.currentThread().isInterrupted())throw new java.io.IOException("文件准备已取消");out.write(buffer,0,n);}}
   org.json.JSONObject meta=new org.json.JSONObject().put("name",name).put("mime",mime);try(java.io.Writer out=new java.io.OutputStreamWriter(new java.io.FileOutputStream(new java.io.File(folder,"meta.json")),java.nio.charset.StandardCharsets.UTF_8)){out.write(meta.toString());}
   result.add(new Uri.Builder().scheme("content").authority(context.getPackageName()+".uploads").appendPath(id).build());
  }return result.toArray(new Uri[0]);}catch(Exception e){for(java.io.File folder:created){new java.io.File(folder,"payload").delete();new java.io.File(folder,"meta.json").delete();folder.delete();}throw e;}
 }

 static Uri[] parse(int result,Intent data){
  if(result!=Activity.RESULT_OK||data==null)return null;
  LinkedHashSet<Uri> found=new LinkedHashSet<>();
  if(data.getClipData()!=null)for(int i=0;i<data.getClipData().getItemCount();i++)add(found,data.getClipData().getItemAt(i).getUri());
  add(found,data.getData());return found.isEmpty()?null:found.toArray(new Uri[0]);
 }
 private static void add(Set<Uri> set,Uri uri){if(uri!=null&&"content".equals(uri.getScheme()))set.add(uri);}
}
