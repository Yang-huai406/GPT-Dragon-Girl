import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { sanitizeGptContent } from '../lib/gpt-content.mjs';
const source = fs.readFileSync(new URL('../assets/whale-widget.js', import.meta.url), 'utf8');
const catalogs = Object.fromEntries(['zh-CN', 'en'].map(locale => [locale, JSON.parse(fs.readFileSync(new URL(`../locales/widget.${locale}.json`, import.meta.url)))]));
function helpers() {
  let locale = 'zh-CN'; const bindings = new Map();
  const box = { window: { WhaleI18n: { t(key) { return catalogs[locale][key] ?? key; }, bind(el,prop,factory) {bindings.set(el,{prop,factory});el[prop]=factory();} } } };
  vm.createContext(box);
  vm.runInContext(source.slice(source.indexOf('  function wt('), source.indexOf('  // Canvas and native color inputs')), box);
  return { box, change(next) {locale=next;for(const [el,{prop,factory}] of bindings)el[prop]=factory();} };
}
test('widget catalogs have matching keys and placeholders', () => {
  assert.deepEqual(Object.keys(catalogs.en).sort(), Object.keys(catalogs['zh-CN']).sort());
  for (const key of Object.keys(catalogs.en)) {
    assert.ok(catalogs.en[key].trim());
    const tokens = value => (value.match(/\{[a-zA-Z_]+\}/g)||[]).sort();
    assert.deepEqual(tokens(catalogs.en[key]), tokens(catalogs['zh-CN'][key]),key);
  }
});
test('semantic labels update through a factory without altering an input draft', () => {
  const {box,change}=helpers();box.label={};box.input={value:'My draft',placeholder:''};
  vm.runInContext("var builtIn = wm('widget.apiBalance'); wb(label,'textContent',function(){return builtIn}); wb(input,'placeholder',function(){return wm('widget.textContent')});",box);
  assert.equal(box.label.textContent,'当前 API 余额'); change('en'); assert.equal(box.label.textContent,'API balance');assert.equal(box.input.value,'My draft');change('zh-CN');assert.equal(box.label.textContent,'当前 API 余额');
});
test('default click sequence has no legacy random dialogue', () => {
  const {box}=helpers();box.gptThemeColor=()=> '#776c87';
  const begin=source.indexOf('    function bubbleDefaultFirstModules()');const end=source.indexOf('    function bubbleKindLabel(');
  vm.runInContext(source.slice(begin,end),box);const queue=JSON.parse(vm.runInContext('JSON.stringify(bubbleDefaultQueue())',box));
  assert.equal(queue.length,2);assert.equal(queue[0].modules[0].i18nKey,'widget.apiBalance');assert.equal(queue[1].modules[0].imgId,'bimg_petpet');assert.equal(JSON.stringify(queue).includes('"random"'),false);
});
test('legacy migration retires shipped content and preserves custom lines/settings', () => {
  const old={items:[{kind:'random'},{kind:'custom',modules:[{type:'random',size:8,lines:[{t:'好模型...↓',w:10},{t:'好女孩...↓',w:10},{t:'哦鲸鲸...',w:10},{t:'My own line',w:2}]}]}],extra:{keep:true}};
  const migrated=sanitizeGptContent(old);assert.equal(migrated.items[0].modules[0].type,'balance');assert.deepEqual(migrated.items[1].modules[0].lines,[{t:'My own line',w:2}]);assert.deepEqual(migrated.extra,{keep:true});assert.equal(old.items[0].kind,'random');
  const custom={type:'text',text:'My own words'};assert.deepEqual(sanitizeGptContent(custom),custom);
  assert.equal(sanitizeGptContent({type:'text',text:'当前 API 余额'}).i18nKey,'widget.apiBalance');
});
