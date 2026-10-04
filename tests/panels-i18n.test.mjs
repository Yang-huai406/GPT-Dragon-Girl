import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';
import { withI18n } from './i18n-fixture.mjs';

function feedbackRuntime() {
  class Element {
    constructor(tag) { this.tagName = tag; this.children = []; this.attributes = {}; this.value = ''; this._text = ''; this.isConnected = false; }
    set textContent(value) { this._text = String(value); this.children = []; }
    get textContent() { return this._text + this.children.map(child => child.textContent || '').join(''); }
    append(...children) { this.children.push(...children); for (const child of children) { child.parent = this; child.isConnected = this.isConnected; } }
    add(child) { this.append(child); }
    setAttribute(key, value) { this.attributes[key] = value; }
    addEventListener(type, fn) { this['on' + type] = fn; }
    showModal() { this.open = true; }
    close() { this.open = false; this.onclose?.(); }
    remove() { this.isConnected = false; if (this.parent) this.parent.children = this.parent.children.filter(child => child !== this); }
  }
  const body = new Element('body'); body.isConnected = true;
  const storage = new Map([['dshw-v3-feedback', JSON.stringify({feel:'balanced',events:{failed:{preset:'pearl',volume:1}}})]]);
  const context = {
    document: { body, createElement: tag => new Element(tag) },
    Option: class extends Element { constructor(text, value) { super('option'); this.textContent = text; this.value = value; } },
    localStorage: { getItem: key => storage.get(key), setItem: (key, value) => storage.set(key, value) },
    WhaleAudio: { play() {}, stop() {} },
  };
  context.window = context;
  withI18n(context);
  vm.runInNewContext(fs.readFileSync(new URL('../desktop/ui/preferences-v3.js', import.meta.url), 'utf8'), context);
  const all = (root, tag) => root.children.flatMap(child => [...(child.tagName === tag ? [child] : []), ...all(child, tag)]);
  return { ...context, body, storage, all };
}

test('changing language preserves the feedback dialog, draft controls and selected options', () => {
  const r = feedbackRuntime(); r.WhaleFeedback.open();
  const dialog = r.body.children[0], selects = r.all(dialog, 'select'), sliders = r.all(dialog, 'input');
  assert.equal(r.all(dialog, 'fieldset').length, 4);
  selects[0].value = 'soft'; selects[0].onchange();
  sliders[0].value = '.37'; sliders[0].oninput();
  const originalChildren = [...dialog.children], originalOptions = [...selects[0].children];
  r.WhaleI18n.setLocale('en');
  assert.equal(dialog.textContent.includes('Sound and interaction'), true);
  assert.equal(dialog.textContent.includes('Press response'), true);
  assert.equal(/[\u4e00-\u9fff]/.test(dialog.textContent), false);
  assert.deepEqual(dialog.children, originalChildren);
  assert.deepEqual(selects[0].children, originalOptions);
  assert.equal(selects[0].value, 'soft'); assert.equal(sliders[0].value, '.37');
  assert.equal(selects[0].children[2].textContent, 'Soft · 85/155ms');
  r.WhaleI18n.setLocale('zh-CN');
  assert.equal(dialog.textContent.includes('按压手感'), true);
  const save = r.all(dialog, 'button').find(el => el.className === 'primary'); save.onclick();
  const saved = JSON.parse(r.storage.get('dshw-v3-feedback'));
  assert.equal(saved.feel, 'soft'); assert.equal(saved.events.press.volume, .37);
  assert.equal(Object.hasOwn(saved.events, 'failed'), false);
  assert.equal(r.WhaleFeedback.play('failed', '/ignored'), false);
});

test('English account labels and token plurals use the shared catalogs and preserve unknown user labels', () => {
  const box = withI18n({ module: { exports: {} } }, 'en');
  vm.runInNewContext(fs.readFileSync(new URL('../desktop/ui/account-view.js', import.meta.url), 'utf8'), box);
  const api = box.module.exports;
  assert.equal(api.quotaLabel({ windowDurationMins: 300 }), '5-hour quota');
  assert.equal(api.tokenText(1), '1 token'); assert.equal(api.tokenText(1200), '1,200 tokens');
  assert.equal(api.quotaLabel({ windowDurationMins: 60, label: '自定义窗口' }), '自定义窗口');
  assert.equal(api.noticeText({ failureKind: 'high-demand', tokens: 7 }), 'Observed on this device this turn: 7 tokens');
  box.WhaleI18n.setLocale('zh-CN');
  assert.equal(api.quotaLabel({ windowDurationMins: 300 }), '5 小时额度');
  assert.equal(api.tokenText(1200), '1,200 token');
});

test('language changes do not change money, precision, currency or rate state', async () => {
  const box = withI18n({ module: { exports: {} }, Intl, Date });
  vm.runInNewContext(fs.readFileSync(new URL('../desktop/ui/money.js', import.meta.url), 'utf8'), box);
  const money = box.module.exports.createMoneyState({ loadQuote: async () => ({ usdCny: 7.1234, date: '2026-10-04', retrievedAt: '2026-10-04T08:00:00Z' }) });
  await money.ready(); await money.setDisplayCurrency('CNY');
  const before = money.formatMoney(1.23456, 'USD'), rate = money.state().quote.usdCny;
  box.WhaleI18n.setLocale('en');
  assert.equal(money.unit(), 'Chinese yuan'); assert.equal(money.formatMoney(Infinity), 'Unlimited');
  assert.equal(money.formatMoney(1.23456, 'USD'), before);
  assert.equal(money.state().quote.usdCny, rate); assert.equal(money.state().displayCurrency, 'CNY');
});
