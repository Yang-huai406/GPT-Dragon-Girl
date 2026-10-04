import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createHash } from 'node:crypto';
import { ROOT } from '../runtime/paths.mjs';
const delay=ms=>new Promise(r=>setTimeout(r,ms));

export async function verifyDesktop({app,window,screen,setHost,setTestCursor,dataDir,errors}) {
 const output=process.env.WHALE_DESKTOP_VERIFY_DIR,phase=process.env.WHALE_GPT_PHASE,checks=[],details={};
 const ev=code=>window.webContents.executeJavaScript(code),api='window.__whaleRenderTest';
 const wait=async(code,label)=>{for(let i=0;i<100;i++){if(await ev(code))return;await delay(60);}throw Error('Timed out: '+label);};
 const capture=async name=>{await delay(300);fs.writeFileSync(path.join(output,'gpt-'+phase+'-'+name+'.png'),(await window.webContents.capturePage()).toPNG());};
 const bytes=async url=>Buffer.from(await ev(`fetch(${JSON.stringify(url)}).then(async r=>{if(!r.ok)throw Error(r.status);return Array.from(new Uint8Array(await r.arrayBuffer()))})`));
 const digest=b=>createHash('sha256').update(b).digest('hex');
 try {
  window.setIgnoreMouseEvents(true,{forward:false});
  const area=screen.getPrimaryDisplay().workArea;
  await setHost({hostAlive:true,hostPid:123456,window:'0',visible:true,attached:true,bounds:screen.dipToScreenRect(null,{x:area.x+20,y:area.y+20,width:1000,height:760})});
  await wait(`${api}?.status().balance===12.3456 && document.querySelector('.dshwv-img')?.naturalWidth>0 && !${api}.status().busy`,'renderer ready');
  const src=await ev("document.querySelector('.dshwv-img').src");
  assert.equal(digest(await bytes(src)),digest(fs.readFileSync(path.join(ROOT,'assets/gpt-chibi.png'))));
  const imgs=await ev("fetch('/dsh-whale/bubble-imgs.json').then(r=>r.json())");details.library=imgs;
  assert.ok(!JSON.stringify(imgs).includes('bimg_yue_money'),'removed image not offered in library');
  for(const url of ['/dsh-whale/rua.gif','/dsh-whale/bubble-img.png?id=bimg_petpet']) assert.equal(digest(await bytes(url)),digest(fs.readFileSync(path.join(ROOT,'assets/gpt-petpet.gif'))));
  const cfg=await ev("fetch('/dsh-whale/bubble.json').then(r=>r.json())");details.config=cfg;
  assert.ok(!JSON.stringify(cfg).includes('bimg_yue_money'),'old config migrated without obsolete image');
  if(phase==='legacy')assert.match(JSON.stringify(cfg),/余额提醒/,'legacy text retained');
  checks.push('actual PNG and both GIF routes match GPT files byte-for-byte; removed image absent in library and config');
  await ev(`${api}.place(80,80,false);${api}.scale(2)`);await delay(500);
  for(const [name,bg] of [['light','#fffdfd'],['dark','#24212b']]){
   await ev(`document.documentElement.style.setProperty('background',${JSON.stringify(bg)},'important');document.body.style.setProperty('background',${JSON.stringify(bg)},'important')`);
   for(const size of [1,2,3]){await ev(`${api}.scale(${size})`);await delay(450);await ev(`${api}.place(300,80,false)`);await capture(name+'-'+size);}
  }
  await ev(`${api}.scale(2);document.querySelector('.dshwv-menu-btn').click()`);await delay(450);
  details.theme=await ev("(()=>{const e=document.querySelector('.dshwv-menu');const s=getComputedStyle(e);return {background:s.backgroundColor,color:s.color,border:s.borderColor,radius:s.borderRadius}})()");
  assert.equal(details.theme.background,'rgb(255, 253, 253)');await capture('menu');
  await ev("document.querySelector('.dshwv-menu-btn').click()");
  await ev(`${api}.scene([{type:'image',imgId:'bimg_petpet'}],0)`);await wait(`!${api}.status().switching`,'GIF scene');
  await wait("[...document.querySelectorAll('.dshwv-mimg')].some(i=>i.naturalWidth===128)",'GIF decode');await capture('gif');
  checks.push('GIF decodes in real Electron bubble; light/dark screenshots at three scales and menu captured');
  await ev(`${api}.scene([{type:'text',text:'第一帧'}],0)`);await wait(`!${api}.status().switching`,'first frame');await delay(450);
  details.frames=await ev(`new Promise(resolve=>{const frames=[];${api}.scene([{type:'image',imgId:'bimg_petpet'}],0);function sample(){const layers=[...document.querySelectorAll('.dshwv-frame')].map(e=>({opacity:+getComputedStyle(e).opacity,images:[...e.querySelectorAll('img')].map(i=>({ready:i.complete&&i.naturalWidth>0}))}));frames.push({layers,imageReady:document.querySelector('.dshwv-img').naturalWidth>0});if(frames.length<40)requestAnimationFrame(sample);else resolve(frames)}sample()})`);
  for(const f of details.frames){assert.ok(f.imageReady);assert.ok(f.layers.reduce((s,l)=>s+l.opacity,0)>=0.98,'no empty bubble buffer');for(const l of f.layers)if(l.opacity>0.01)assert.ok(l.images.every(i=>i.ready),'visible images decoded');}
  checks.push('40 real animation frames keep decoded body and nonempty bubble buffers during text-to-GIF switch');
  await ev(`${api}.close()`);await delay(500);window.focus();await wait('document.hasFocus()','focus');
  const p=await ev("(()=>{const r=document.querySelector('.dshwv-img').getBoundingClientRect();return{x:Math.round(r.x+r.width*.5),y:Math.round(r.y+r.height*.6)}})()");setTestCursor(p);
  window.webContents.sendInputEvent({type:'mouseMove',...p});await delay(100);
  window.webContents.sendInputEvent({type:'mouseDown',button:'left',clickCount:1,...p});await delay(45);window.webContents.sendInputEvent({type:'mouseUp',button:'left',clickCount:1,...p});
  await wait(`${api}.status().shown&&!${api}.status().switching`,'real click opens bubble');checks.push('actual Electron mouse press/release still opens complete bubble');
  await ev(`(() => {const img=document.querySelector('.dshwv-img');img.dispatchEvent(new Event('error'));})()`);
  await wait("document.querySelector('.dshwv-img').src.startsWith('data:image/png;base64,') && document.querySelector('.dshwv-img').naturalWidth === 128",'embedded GPT fallback');
  checks.push('default artwork failure uses decoded embedded GPT fallback, never legacy whale');
  assert.equal(errors.length,0,JSON.stringify(errors));
  fs.writeFileSync(path.join(output,'gpt-'+phase+'.json'),JSON.stringify({ok:true,checks,details,dataDir},null,2));await setHost({hostAlive:false});
 }catch(error){fs.writeFileSync(path.join(output,'gpt-'+phase+'.json'),JSON.stringify({ok:false,checks,details,dataDir,error:error.stack,errors},null,2));app.exit(1);}
}
