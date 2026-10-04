import test from 'node:test';
import assert from 'node:assert/strict';
import { createRequire } from 'node:module';
import { createI18n } from './i18n-fixture.mjs';
import { localizeResponse } from '../lib/i18n-response.mjs';
const { loadCatalogs, translate } = createRequire(import.meta.url)('../lib/i18n.cjs');
const catalogs = loadCatalogs();
test('all locale keys and named placeholders have paired translations', () => {
  assert.deepEqual(Object.keys(catalogs.en).sort(), Object.keys(catalogs['zh-CN']).sort());
  const placeholders = value => [...new Set(value.match(/\{[A-Za-z]\w*\}/g) || [])].sort();
  for (const [key, value] of Object.entries(catalogs.en)) {
    assert.ok(value.trim(), key); assert.deepEqual(placeholders(value), placeholders(catalogs['zh-CN'][key]), key);
  }
});
test('explicit bindings switch in place and preserve unrelated form drafts', () => {
  const i18n = createI18n();
  const button = { textContent:'', isConnected:true }, input={value:'unsaved custom text'};
  i18n.bind(button,'textContent',()=>i18n.t('native.close'));
  assert.equal(button.textContent,'关闭'); assert.equal(i18n.setLocale('en'),true); assert.equal(button.textContent,'Close');
  assert.equal(input.value,'unsaved custom text'); assert.equal(i18n.setLocale('fr'),false);
  assert.equal(i18n.setLocale('zh-CN'),true); assert.equal(button.textContent,'关闭');
});
test('response localization preserves custom content and stable metadata', () => {
  const input={error:'API 地址无效',amount:1.234567,currency:'CNY',text:'用户自定义内容',name:'用户角色'};
  const result=localizeResponse(input,'en',catalogs);
  assert.equal(result.error,'Invalid API URL'); assert.equal(result.errorKey,'backend.m007');
  assert.equal(input.error,'API 地址无效');assert.equal(result.amount,input.amount);assert.equal(result.currency,'CNY');
  assert.equal(result.text,input.text);assert.equal(result.name,input.name);
  assert.equal(translate(catalogs,'en','backend.m056',{currency:'CNY ',below:5}),'Balance is below CNY 5');
});
