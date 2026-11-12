// Run in a workstation with Playwright and Edge installed; assets/camera settings come from the cloud SSOT.
import {chromium} from 'playwright';
import fs from 'node:fs/promises';
import path from 'node:path';
const base=process.argv[2]||'http://127.0.0.1:26000',out=process.argv[3]||'.review/entity-thumbnails';
const browser=await chromium.launch({headless:true,channel:'msedge'});
try{
 const page=await browser.newPage({viewport:{width:900,height:480},deviceScaleFactor:2});
 await page.route('**/entity-render-fixture',r=>r.fulfill({contentType:'text/html',body:'<body style="margin:0;background:#080808"><canvas style="width:900px;height:480px"></canvas>'}));
 await page.goto(base+'/entity-render-fixture');
 const kinds=await page.evaluate(async()=>{
  window.entityConfig=await import('/js/constants.js');const {createEntityRenderer}=await import('/js/entity-point-renderer.js');
  window.renderer=createEntityRenderer(document.querySelector('canvas'));renderer.resize(900,480);
  return Object.keys(entityConfig.ENTITY_MODELS);
 });
 await fs.mkdir(out,{recursive:true});
 for(const kind of kinds){
  await page.evaluate(async kind=>{
   await renderer.setModel(kind);const {previewYaw:yaw,previewPitch:pitch}=entityConfig.ENTITY_MODELS[kind];
   renderer.framePose(yaw,pitch);renderer.draw({yaw,pitch,zoom:1,pointSize:.95});
  },kind);
  await page.screenshot({path:path.join(out,kind+'.png')});
 }
 console.log('Rendered '+kinds.length+' previews from configured per-model cameras.');
}finally{await browser.close();}
