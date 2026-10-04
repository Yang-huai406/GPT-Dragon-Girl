import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createBrowserHarness } from './browser-harness.mjs';
const output = path.resolve(process.argv[2] || '../../qa/panels');
const harness = await createBrowserHarness(output);
const { page } = harness;
const checks = [];
try {
  await page.waitForFunction(() => window.WhaleI18n && window.WhaleFeedback && document.querySelector('#whale-language'));
  const initial = await page.evaluate(() => ({ locale:WhaleI18n.locale, time:performance.timeOrigin }));
  await page.evaluate(() => window.dispatchEvent(new Event('whale-open-settings')));
  await page.locator('#settings-dialog').waitFor({state:'visible'});
  await page.evaluate(() => {
    const f=document.querySelector('#settings-form');
    window.__settingsDraft={input:f.elements.namedItem('priceModel'),details:f.elements.namedItem('priceModel').closest('details')};
    __settingsDraft.input.value='private-draft-model'; __settingsDraft.details.open=true;
    __settingsDraft.input.focus(); __settingsDraft.input.setSelectionRange(3,8);
    WhaleI18n.setLocale('en');
  });
  const settings=await page.evaluate(() => {
    const f=document.querySelector('#settings-form'),input=f.elements.namedItem('priceModel');
    return { text:f.innerText, same:input===__settingsDraft.input, value:input.value, open:__settingsDraft.details.open,
      focus:document.activeElement===input, start:input.selectionStart, end:input.selectionEnd,
      label:f.querySelector('[data-reset-field=baseUrl]').getAttribute('aria-label'),
      hOverflow:f.scrollWidth>f.clientWidth+2 };
  });
  assert.equal(/[\u4e00-\u9fff]/.test(settings.text),false,settings.text);
  assert.deepEqual([settings.same,settings.value,settings.open,settings.focus,settings.start,settings.end],[true,'private-draft-model',true,true,3,8]);
  assert.match(settings.label,/API base URL/); assert.equal(settings.hOverflow,false);
  checks.push('API settings translate in place while preserving draft, focus, selection and expanded details');
  await page.screenshot({path:path.join(output,'api-settings-en.png')});
  await page.evaluate(() => document.querySelector('#settings-dialog').close());
  await page.evaluate(() => {
    WhaleFeedback.open();
    const d=document.querySelector('dialog.whale-v3-dialog[open]');
    window.__feedbackDraft={dialog:d,feel:d.querySelector('select'),volume:d.querySelector('input[type=range]')};
    __feedbackDraft.feel.value='soft';__feedbackDraft.feel.dispatchEvent(new Event('change'));
    __feedbackDraft.volume.value='.37';__feedbackDraft.volume.dispatchEvent(new Event('input'));
    WhaleI18n.setLocale('zh-CN');WhaleI18n.setLocale('en');
  });
  const feedback=await page.evaluate(() => {
    const d=document.querySelector('dialog.whale-v3-dialog[open]');
    return {text:d.innerText,same:d===__feedbackDraft.dialog,feel:__feedbackDraft.feel.value,volume:__feedbackDraft.volume.value,fields:d.querySelectorAll('fieldset').length,overflow:d.scrollWidth>d.clientWidth+2};
  });
  assert.equal(/[\u4e00-\u9fff]/.test(feedback.text),false,feedback.text);
  assert.deepEqual([feedback.same,feedback.feel,feedback.volume,feedback.fields,feedback.overflow],[true,'soft','0.37',4,false]);
  checks.push('Feedback dialog keeps unsaved values and four supported events through both language switches');
  await page.screenshot({path:path.join(output,'feedback-en.png')});
  await page.evaluate(() => document.querySelector('dialog.whale-v3-dialog[open]').close());
  await page.evaluate(() => [...document.querySelectorAll('button')].find(b=>b.textContent==='Local workshop').click());
  const workshop=page.locator('dialog.whale-v3-dialog[open]');
  await workshop.waitFor({state:'visible'});
  await page.evaluate(() => {WhaleI18n.setLocale('zh-CN');WhaleI18n.setLocale('en');});
  await page.locator('.workshop-file-picker input').setInputFiles({name:'custom-pack.json',mimeType:'application/json',buffer:Buffer.from(JSON.stringify({schema:'api-balance-whale-workshop',version:1,roles:[],images:[],fragments:[],groups:[]}))});
  await page.evaluate(() => {WhaleI18n.setLocale('zh-CN');WhaleI18n.setLocale('en');});
  assert.equal(await page.locator('.workshop-file-picker span').innerText(),'custom-pack.json');
  assert.equal(await workshop.getByRole('button',{name:'Import selected pack'}).isEnabled(),true);
  const workshopText=await workshop.innerText();assert.equal(/[\u4e00-\u9fff]/.test(workshopText),false,workshopText);
  checks.push('Workshop steps and asset controls translate without reopening the dialog');
  await page.screenshot({path:path.join(output,'workshop-en.png')});
  await page.evaluate(() => document.querySelector('dialog.whale-v3-dialog[open]').close());
  await page.evaluate(async () => {await WhaleAccountView.setMode('subscription');window.dispatchEvent(new Event('whale-open-insights'));});
  await page.waitForFunction(() => {const d=document.querySelector('dialog.whale-v3-dialog[open]');return d && !d.textContent.includes('Loading…');});
  await page.evaluate(() => {WhaleI18n.setLocale('zh-CN');WhaleI18n.setLocale('en');});
  const insights=await page.locator('dialog.whale-v3-dialog[open]').innerText();
  assert.equal(/[\u4e00-\u9fff]/.test(insights),false,insights);
  checks.push('Subscription details and live snapshot labels translate without refetching on language change');
  assert.equal(await page.evaluate(() => performance.timeOrigin),initial.time,'Language switching must not reload the page');
  assert.deepEqual(harness.errors,[]);
  fs.writeFileSync(path.join(output,'panels-results.json'),JSON.stringify({ok:true,checks,errors:harness.errors},null,2)+'\n');
  console.log(JSON.stringify({ok:true,checks,output}));
} finally { await harness.close(); }
