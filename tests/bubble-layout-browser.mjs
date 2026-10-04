import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createBrowserHarness } from './browser-harness.mjs';

const output=path.resolve(process.env.WHALE_BROWSER_OUTPUT || '../../qa/layout');
const harness=await createBrowserHarness(output);
const {page,errors}=harness;
const checks=[];
const custom='A long custom message with a VeryLongUnbrokenIdentifier0123456789 and more detail for the full message view. '.repeat(15);
const active='.dshwv-frame[aria-hidden="false"]';
const stable=()=>page.waitForFunction(()=>window.__whaleRenderTest?.status().shown&&!__whaleRenderTest.status().switching);
async function geometry(){return page.evaluate(()=>{
  const content=document.querySelector('.dshwv-frame[aria-hidden="false"]');
  const pop=document.querySelector('.dshwv-pop').getBoundingClientRect();
  return {...WhaleBubbleLayout.inspect(content),summary:content.dataset.bubbleSummary,text:content.innerText,fonts:[...content.querySelectorAll('.dshwv-trow,.dshwv-label,.dshwv-amount,.dshwv-hint')].filter(e=>getComputedStyle(e).display!=='none'&&!e.closest('.dshwv-fit-suppressed')).map(e=>parseFloat(getComputedStyle(e).fontSize)),pop:{left:pop.left,top:pop.top,right:pop.right,bottom:pop.bottom}};
});}
try{
  await page.waitForFunction(()=>window.__whaleRenderTest?.status().balance===12.3456&&window.WhaleBubbleLayout);
  for(const viewport of [{width:1100,height:850},{width:320,height:480},{width:800,height:300}]){
    await page.setViewportSize(viewport);
    for(const scale of [.3,1,2.5])for(const locale of ['zh-CN','en'])for(const message of ['normal','long','gif']){
      await page.evaluate(({scale,locale,message,custom})=>{
        WhaleI18n.setLocale(locale);__whaleRenderTest.close();__whaleRenderTest.scale(scale);__whaleRenderTest.place(innerWidth-130,innerHeight-130,locale==='en');
        const modules=message==='gif'?[{type:'image',imgId:'bimg_petpet'}]:message==='long'?[{type:'text',text:custom,size:8},{type:'balance',size:14}]:[{type:'text',text:locale==='en'?'API balance':'API余额',size:7},{type:'balance',size:14},{type:'today',size:5}];
        __whaleRenderTest.scene(modules,60000);
      },{scale,locale,message,custom});
      await stable();await page.waitForTimeout(500);
      const info=await geometry();const name=`${viewport.width}x${viewport.height}-${scale}-${locale}-${message}`;
      assert.equal(info.overflow,false,name+' '+JSON.stringify(info));
      assert.ok(info.fonts.every(n=>n>=12),name+' min readable font');
      assert.ok(info.pop.left>=7&&info.pop.top>=7&&info.pop.right<=viewport.width-7&&info.pop.bottom<=viewport.height-7,name+' viewport '+JSON.stringify(info.pop));
      if(message==='normal')assert.match(info.text,/12\.35/,name+' complete amount');
      checks.push({name,summary:info.summary,pass:true});
      if(viewport.width===1100&&scale===1)await page.screenshot({path:path.join(output,`${locale}-${message}.png`)});
    }
  }
  await page.setViewportSize({width:1100,height:850});
  await page.evaluate(custom=>{WhaleI18n.setLocale('en');__whaleRenderTest.scale(.3);__whaleRenderTest.place(100,220,false);__whaleRenderTest.scene([{type:'text',text:custom},{type:'balance',size:14}],60000);},custom);
  await stable();await page.waitForTimeout(500);
  await page.locator(active+' .dshwv-details-link').click();
  assert.ok((await page.locator('.dshwv-message-details-text').textContent()).includes(custom));
  await page.screenshot({path:path.join(output,'full-message.png')});
  await page.locator('.dshwv-message-details button').click();
  checks.push({name:'details preserve full custom text',pass:true});
  const before=await page.evaluate(()=>{window.savedFront=document.querySelector('.dshwv-frame[aria-hidden="false"]');return __whaleRenderTest.status().epoch;});
  await page.evaluate(()=>WhaleI18n.setLocale('zh-CN'));await page.waitForTimeout(100);
  assert.equal(await page.evaluate(()=>savedFront===document.querySelector('.dshwv-frame[aria-hidden="false"]')),true);
  assert.equal(await page.evaluate(()=>__whaleRenderTest.status().epoch),before);
  assert.equal((await geometry()).overflow,false);
  checks.push({name:'locale relayout preserves existing frame and notice epoch',pass:true});
  const changed=await page.evaluate(async()=>{
    const row=savedFront.querySelector('[data-bubble-module="balance"]');
    row.textContent='$1,234,567,890.12';await new Promise(r=>setTimeout(r,100));
    return {same:savedFront===document.querySelector('.dshwv-frame[aria-hidden="false"]'),overflow:WhaleBubbleLayout.inspect(savedFront).overflow,text:row.textContent};
  });
  assert.equal(changed.same,true);assert.equal(changed.overflow,false);assert.equal(changed.text,'$1,234,567,890.12');
  checks.push({name:'money text changes relayout without changing frame',pass:true});
  // Show the complete companion at a normal placement as well as the preceding
  // deliberately off-edge placement used to stress balloon viewport clamping.
  for(const locale of ['zh-CN','en']){
    await page.evaluate(locale=>{WhaleI18n.setLocale(locale);__whaleRenderTest.scale(1.5);__whaleRenderTest.place(560,300,false);__whaleRenderTest.queue([{kind:'normal'}]);__whaleRenderTest.open();},locale);
    await stable();await page.waitForTimeout(550);
    await page.screenshot({path:path.join(output,`companion-${locale}.png`)});
  }
  await page.evaluate(()=>{const label=WhaleI18n.t('widget.editBubbles');[...document.querySelectorAll('button')].find(e=>e.textContent===label)?.click();});
  await page.locator('.dshwv-bubmask .dshwv-bubchip').first().click();
  await page.waitForFunction(()=>document.querySelector('.dshwv-bubprev .dshwv-fit-content'));
  await page.waitForTimeout(200);
  const previews=await page.evaluate(()=>[...document.querySelectorAll('.dshwv-bubprev .dshwv-fit-content')].filter(e=>e.getBoundingClientRect().width>0).map(e=>WhaleBubbleLayout.inspect(e)));
  assert.ok(previews.length>0);assert.ok(previews.every(p=>!p.overflow));
  await page.screenshot({path:path.join(output,'editor-preview-en.png')});
  checks.push({name:'editor preview uses the same safe-area layout',pass:true});
  assert.deepEqual(errors,[]);
  fs.writeFileSync(path.join(output,'report.json'),JSON.stringify({passed:checks.length,checks,errors},null,2));
  console.log(JSON.stringify({passed:checks.length,output}));
}finally{await harness.close();}
