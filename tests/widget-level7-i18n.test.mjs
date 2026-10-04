import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const source = fs.readFileSync(new URL('../assets/whale-widget.js', import.meta.url), 'utf8');
const catalogs = Object.fromEntries(['zh-CN', 'en'].map(locale => [locale,
  Object.assign({}, ...['widget', 'widget-level7'].map(name => JSON.parse(fs.readFileSync(new URL(`../locales/${name}.${locale}.json`, import.meta.url))))),
]));
function renderHarness() {
  let locale = 'zh-CN';
  const bindings = [], money = [];
  const element = () => ({ style: {} });
  const context = vm.createContext({
    restoreBubbleLines() {}, labelEl: element(), amountEl: element(), hintEl: element(),
    window: { WhaleI18n: { number: n => new Intl.NumberFormat(locale).format(n), message: value => value } },
    wt(key, params = {}) { return String(catalogs[locale][key] ?? key).replace(/\{(\w+)\}/g, (_, name) => params[name]); },
    wb(el, prop, factory) { bindings.push(() => { el[prop] = factory(); }); el[prop] = factory(); },
    WhaleMoney: { bind(el, factory) { money.push({ el, factory }); el.textContent = factory(); } },
    fmt: (amount, currency) => `${currency} ${amount.toFixed(6)}`,
  });
  const start = source.indexOf('    function bubbleRenderCost(');
  const end = source.indexOf('    function bubblePickChoiceStep(', start);
  vm.runInContext(source.slice(start, end), context);
  return { context, money, change(next) { locale = next; for (const bind of bindings) bind(); } };
}

test('Level7 widget translations have identical keys and interpolation fields', () => {
  assert.deepEqual(Object.keys(catalogs.en).sort(), Object.keys(catalogs['zh-CN']).sort());
  for (const key of Object.keys(catalogs.en)) {
    assert.ok(catalogs.en[key].trim(), key);
    const fields = value => (value.match(/\{[A-Za-z_][A-Za-z0-9_]*\}/g) || []).sort();
    assert.deepEqual(fields(catalogs.en[key]), fields(catalogs['zh-CN'][key]), key);
  }
});

test('account spend and explanatory titles change language without claiming a conversation cost', () => {
  const h = renderHarness();
  h.context.bubbleRenderCost(0.0005, { noticeType: 'account', labelKey: 'widgetLevel7.accountSpend',
    noteKey: 'widgetLevel7.accountSpendNote', amount: 0.0005, currency: 'USD', tokens: null, concurrent: true, costState: 'observed' });
  assert.equal(h.context.labelEl.textContent, '账户新增消耗');
  assert.match(h.context.hintEl.textContent, /含并行任务/);
  h.change('en');
  assert.equal(h.context.labelEl.textContent, 'New account spend');
  assert.equal(h.context.hintEl.textContent, 'Small charges included · Since last notice · Concurrent tasks');
  assert.match(h.context.amountEl.title, /not attributed to a single conversation/);
  assert.equal(h.context.hintEl.title, h.context.amountEl.title);
  assert.equal(h.context.amountEl.textContent, 'USD 0.000500');
});

test('unconfirmed conversation costs show tokens, not an invented amount, in both languages', () => {
  const h = renderHarness();
  h.context.bubbleRenderCost(null, { label: 'Usage', conversationRef: 'abcdef1234567890', completionKind: 'failed',
    amount: null, tokens: 2048, costState: 'unknown', note: 'Provider data is not yet available.' });
  assert.equal(h.context.labelEl.textContent, '对话 abcdef123456 · 失败\nUsage');
  assert.equal(h.context.amountEl.textContent, '2,048 tokens');
  assert.equal(h.context.hintEl.textContent, '本轮费用未单独确认');
  h.change('en');
  assert.equal(h.context.labelEl.textContent, 'Chat abcdef123456 · Failed\nUsage');
  assert.equal(h.context.hintEl.textContent, 'Turn cost not confirmed');
  assert.equal(h.context.labelEl.style.whiteSpace, 'pre-line');
  assert.equal(h.context.amountEl.style.whiteSpace, 'nowrap');
  assert.equal(h.context.amountEl.style.maxWidth, '100%');
});

test('live currency formatting remains bound to its own buffer element', () => {
  const h = renderHarness();
  h.context.bubbleRenderCost(12345, { amount: 12345, currency: 'USD', label: 'Spend', tokens: 10, costState: 'confirmed', note: '' });
  const original = h.context.amountEl;
  h.context.amountEl = { style: {} };
  h.money[0].factory();
  assert.match(original.style.fontSize, /calc/);
  assert.equal(h.context.amountEl.style.fontSize, undefined);
});
