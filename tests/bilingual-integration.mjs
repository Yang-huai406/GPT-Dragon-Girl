import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createBrowserHarness } from './browser-harness.mjs';
const output=path.resolve(process.argv[2]);
const h=await createBrowserHarness(output);
const checks=[];
try {
  const p=h.page;
  await p.waitForFunction(()=>window.__whaleRenderTest?.status().balance===12.3456);
  await p.evaluate(()=>{__whaleRenderTest.scale(1.3);__whaleRenderTest.place(300,450,false);document.querySelector('.dshwv-menu-btn').click();});
  await p.locator('[data-page="settings"]').click();
  await p.locator('#whale-language').selectOption('en');
  await p.waitForFunction(()=>document.documentElement.lang==='en');
  assert.equal(await p.evaluate(()=>localStorage.getItem('dshw-locale')),'en');
  await p.screenshot({path:path.join(output,'settings-en.png')});
  const labels=await p.locator('.whale-menu-group>summary').allTextContents();
  assert.equal(labels.length,3);assert.ok(labels.every(x=>!/[\u3400-\u9fff]/.test(x)));
  checks.push('language selector updates real settings groups without moving controls');
  const state=await p.evaluate(()=>fetch('/api/ui-state').then(r=>r.json()));
  // The isolated desktop bridge asynchronously persists into this fixture only.
  await p.waitForFunction(()=>fetch('/api/ui-state').then(r=>r.json()).then(v=>v.values['dshw-locale']==='en'));
  await p.reload();await p.waitForFunction(()=>window.__whaleRenderTest?.status().balance===12.3456);
  assert.equal(await p.evaluate(()=>WhaleI18n.locale),'en');checks.push('language selection survives page restart with isolated storage');
  const failures=await p.evaluate(()=>{
    const n=WhaleTurnNotice.snapshot({outcome:'failed',failureKind:'high-demand',tokens:12,amount:null,costState:'pending'});
    return {label:n.label,off:WhaleTurnNotice.enabled(n,{},false),on:WhaleTurnNotice.enabled(n,{},true),tokens:n.tokens};
  });
  assert.equal(failures.off,false);assert.equal(failures.on,true);assert.equal(failures.tokens,12);assert.doesNotMatch(failures.label,/busy|high demand|挤|繁忙/i);
  checks.push('high-demand failure has only ordinary consumption text and respects the switch');
  const error=await p.evaluate(()=>fetch('/api/display-mode',{method:'POST',headers:{'Content-Type':'application/json'},body:JSON.stringify({mode:'invalid'})}).then(r=>r.json()));
  assert.ok(!/[\u3400-\u9fff]/.test(error.error));assert.ok(error.errorKey);checks.push('backend validation returns localized text plus a stable error key');
  await p.evaluate(()=>{__whaleRenderTest.scale(1.3);__whaleRenderTest.place(300,450,false);__whaleRenderTest.open();});
  await p.waitForFunction(()=>!__whaleRenderTest.status().switching&&__whaleRenderTest.status().shown);
  await p.waitForTimeout(400);await p.screenshot({path:path.join(output,'bubble-en.png')});
  await p.evaluate(()=>WhaleI18n.setLocale('zh-CN'));await p.waitForTimeout(400);await p.screenshot({path:path.join(output,'bubble-zh.png')});
  assert.deepEqual(h.errors,[]);
  fs.writeFileSync(path.join(output,'integration.json'),JSON.stringify({ok:true,checks,failures},null,2));
  console.log(JSON.stringify({ok:true,checks}));
} finally {await h.close();}
