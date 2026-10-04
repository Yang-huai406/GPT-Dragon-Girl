// Workspace-only real-page checks. Uses headless Edge and synthetic ledgers;
// never launches Electron, the desktop follower, or an installed plugin.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { createBrowserHarness } from './browser-harness.mjs';

const output = path.resolve(process.argv[2] || process.env.WHALE_BROWSER_OUTPUT || '../../qa/account');
const harness = await createBrowserHarness(output, { viewport: { width: 1100, height: 850 } });
const { page, dispatcher, errors } = harness;
const service = dispatcher.whale;
const checks = [], requests = [], geometry = [], commits = [];
const originalDispatch = dispatcher.dispatch;
let failAck = false;
const delay = ms => new Promise(resolve => setTimeout(resolve, ms));
async function waitFor(predicate, label, timeout = 9000) {
  const start = Date.now();
  while (Date.now() - start < timeout) { if (await predicate()) return; await delay(60); }
  throw Error('Timed out: ' + label);
}
const ready = () => page.waitForFunction(() => window.__whaleRenderTest && window.WhaleBubbleLayout && document.querySelector('.dshwv-img')?.naturalWidth > 0);
async function instrument() {
  await page.evaluate(() => {
    window.__accountCommits = []; window.__accountSounds = [];
    const open = WhaleRendering.BubbleRenderer.prototype.open;
    WhaleRendering.BubbleRenderer.prototype.open = async function (...args) {
      const committed = await open.apply(this, args);
      const text = this.front.root.textContent;
      if (committed && /账户新增消耗|New account spend/.test(text)) __accountCommits.push({ text, at: Date.now(), locale: WhaleI18n.locale });
      return committed;
    };
    if (window.WhaleFeedback) {
      const play = WhaleFeedback.play;
      WhaleFeedback.play = function (...args) { __accountSounds.push(args[0]); return play.apply(this, args); };
    }
    __whaleRenderTest.scale(1); __whaleRenderTest.place(320, 350, false); __whaleRenderTest.close();
  });
}
const shown = amount => page.waitForFunction(amount => {
  const status = __whaleRenderTest.status(), front = document.querySelector('.dshwv-frame[aria-hidden="false"]');
  return status.shown && !status.switching && /账户新增消耗|New account spend/.test(front?.textContent || '') && front.textContent.includes(amount);
}, amount, { timeout: 10000 });
const acknowledged = () => waitFor(() => service.accountNotices().notices.length === 0, 'account acknowledgement');
async function capture(name, amount, label) {
  await page.waitForTimeout(250);
  const info = await page.evaluate(() => {
    const front = document.querySelector('.dshwv-frame[aria-hidden="false"]'), pop = document.querySelector('.dshwv-pop').getBoundingClientRect();
    return { text: front.innerText, ...WhaleBubbleLayout.inspect(front), pop: pop.toJSON(), viewport: { width: innerWidth, height: innerHeight } };
  });
  assert.ok(info.text.includes(label), name + ' localized label');
  assert.ok(info.text.includes(amount), name + ' full amount');
  assert.equal(info.overflow, false, name + ' ' + JSON.stringify(info));
  assert.ok(info.pop.left >= 7 && info.pop.top >= 7 && info.pop.right <= info.viewport.width - 7 && info.pop.bottom <= info.viewport.height - 7, name + ' within viewport');
  geometry.push({ name, ...info });
  await page.screenshot({ path: path.join(output, name + '.png') });
}
async function expense(enabled) {
  await page.evaluate(enabled => {
    const title = WhaleI18n.t('widget.showTheObservedCostAfterEachTurn');
    const toggle = [...document.querySelectorAll('.dshwv-menu input[type="checkbox"]')].find(el => el.title === title);
    if (!toggle) throw Error('Expense toggle was not found');
    toggle.checked = enabled; toggle.dispatchEvent(new Event('change', { bubbles: true }));
  }, enabled);
  await page.waitForTimeout(180);
}
dispatcher.dispatch = async (url, options = {}) => {
  if (url === '/api/account-notices/ack') {
    const ids = JSON.parse(Buffer.from(options.body).toString()).ids;
    const visual = await page.evaluate(() => ({ status: __whaleRenderTest.status(), text: document.querySelector('.dshwv-frame[aria-hidden="false"]')?.textContent || '', seen: JSON.parse(localStorage.getItem('dshw-account-notices-shown') || '{}') }));
    requests.push({ method: 'ACK', ids, visual, failed: failAck });
    if (failAck) return { status: 503, headers: { 'content-type': 'application/json' }, body: Buffer.from(JSON.stringify({ ok: false, error: 'Synthetic acknowledgement failure' })) };
  }
  const result = await originalDispatch(url, options);
  if (url === '/api/account-notices') requests.push({ method: 'GET', ...JSON.parse(result.body.toString()) });
  return result;
};
try {
  assert.equal(dispatcher.watcher, null);
  assert.deepEqual(service.config.resolve().setting.models, {});
  await ready(); await page.waitForTimeout(500); await instrument();
  await page.evaluate(() => WhaleI18n.setLocale('zh-CN'));
  await service.getBalance({ force: true });
  assert.equal(service.accountNotices().notices.length, 0);

  const a = { id: 'fixture-A:turn', sessionId: 'fixture-A', turnId: 'turn' };
  const b = { id: 'fixture-B:turn', sessionId: 'fixture-B', turnId: 'turn' };
  service.beginTurn(a); await service.turns.get(a.id).start;
  service.beginTurn(b); await service.turns.get(b.id).start;
  service.provider.amount = 12.0956; await service.getBalance({ force: true });
  await shown('0.25'); await acknowledged(); await capture('parallel-025-zh', '0.25', '账户新增消耗');
  assert.match(geometry.at(-1).text, /含并行任务/);
  const firstAck = requests.find(row => row.method === 'ACK');
  assert.ok(firstAck); assert.equal(firstAck.visual.status.switching, false); assert.equal(firstAck.visual.status.shown, true);
  assert.ok(Object.values(firstAck.visual.seen).includes(firstAck.ids[0]), 'visual receipt persists before ACK');
  checks.push('Parallel account +0.25 commits once with concurrency indicator; persisted seen ID precedes ACK');

  const epoch = await page.evaluate(() => __whaleRenderTest.status().epoch);
  await page.evaluate(() => WhaleI18n.setLocale('en')); await capture('parallel-025-en', '0.25', 'New account spend');
  assert.equal(await page.evaluate(() => __whaleRenderTest.status().epoch), epoch, 'language change retains notice lifetime');
  assert.equal(await page.evaluate(() => __accountCommits.length), 1, 'translation does not replay account notice');
  checks.push('Visible account notification changes Chinese/English in place without replay or overflow');

  await service.finishTurn({ ...b, outcome: 'failed', statusNotify: false, byModel: {} });
  await service.finishTurn({ ...a, outcome: 'completed', notify: false, byModel: {} });
  await page.evaluate(() => __whaleRenderTest.close()); await service.getBalance({ force: true }); await delay(1250);
  assert.equal(await page.evaluate(() => __accountCommits.length), 1);
  assert.equal(service.accountNotices().notices.length, 0);
  checks.push('Unchanged balance and completion of both A/B do not duplicate the account charge');

  failAck = true; service.provider.amount = 11.9956; await service.getBalance({ force: true });
  await shown('0.10'); await waitFor(() => requests.some(row => row.method === 'ACK' && row.failed), 'lost ACK');
  await capture('lost-ack-010-en', '0.10', 'New account spend');
  const second = service.accountNotices().notices[0]; assert.equal(second.amount, 0.1); assert.notEqual(second.id, firstAck.ids[0]);
  commits.push(...await page.evaluate(() => __accountCommits));
  assert.deepEqual(await page.evaluate(() => __accountSounds), []);
  await page.reload(); await ready(); await instrument(); failAck = false;
  await acknowledged(); await delay(1250);
  assert.equal(await page.evaluate(() => __accountCommits.length), 0);
  assert.ok(requests.some(row => row.method === 'ACK' && row.ids[0] === second.id && !row.failed));
  checks.push('Reload after a lost ACK retries acknowledgement of +0.10 without replaying the amount');

  await expense(false);
  const getsBefore = requests.filter(row => row.method === 'GET').length;
  service.provider.amount = 11.7956; await service.getBalance({ force: true });
  service.provider.amount = 11.6456; await service.getBalance({ force: true });
  await delay(1250);
  assert.equal(requests.filter(row => row.method === 'GET').length, getsBefore, 'disabled expense UI does not consume account notices');
  assert.equal(service.accountNotices().notices[0].amount, 0.35);
  assert.equal(await page.evaluate(() => __accountCommits.length), 0);
  await expense(true); await shown('0.35'); await acknowledged(); await capture('reenabled-035-en', '0.35', 'New account spend');
  checks.push('Disabled expense switch retains two debits; re-enabling presents their +0.35 aggregate once');

  await page.setViewportSize({ width: 320, height: 480 }); await page.evaluate(() => { __whaleRenderTest.scale(.3); __whaleRenderTest.place(190, 330, false); });
  await capture('small-035-en', '0.35', 'New account spend');
  await page.evaluate(() => WhaleI18n.setLocale('zh-CN')); await capture('small-035-zh', '0.35', '账户新增消耗');
  checks.push('Small 320x480 viewport and minimum character scale keep bilingual account text inside the bubble');
  await page.evaluate(() => __whaleRenderTest.close()); await page.setViewportSize({ width: 1100, height: 850 });

  const historyScope = 'b'.repeat(24) + '-CNY';
  service.ledger.observe(historyScope, { totalUsed: 1 }); service.ledger.observe(historyScope, { totalUsed: 3 });
  service.ledger.append(historyScope, { id: 'synthetic-old', ts: Date.now(), outcome: 'failed', tokens: 42, source: 'shared-key-interval', amount: 2, cost: 2, currency: 'CNY' });
  await page.evaluate(() => { WhaleI18n.setLocale('en'); document.querySelector('[data-action="usage-history"]').click(); });
  const dialog = page.locator('.whale-history-dialog');
  await dialog.waitFor({ state: 'visible' });
  await page.waitForFunction(scope => [...document.querySelector('.whale-history-dialog select').options].some(option => option.value === scope), historyScope);
  await dialog.locator('select').selectOption(historyScope);
  await page.waitForFunction(() => document.querySelector('.whale-history-dialog')?.innerText.includes('CNY 2.00'));
  assert.match(await dialog.innerText(), /Account history/);
  assert.match(await dialog.innerText(), /Turn cost Unknown/);
  assert.match(await dialog.innerText(), /Account interval charges: CNY 2.00/);
  await page.screenshot({ path: path.join(output, 'history-en.png') });
  await page.evaluate(() => WhaleI18n.setLocale('zh-CN')); await delay(100);
  assert.equal(await dialog.locator('select').inputValue(), historyScope, 'language preserves selected historical ledger');
  assert.match(await dialog.locator('h2').innerText(), /历史/);
  const overflow = await dialog.evaluate(el => ({ width: el.scrollWidth > el.clientWidth + 1, body: document.documentElement.scrollWidth > innerWidth + 1 }));
  assert.deepEqual(overflow, { width: false, body: false });
  await page.screenshot({ path: path.join(output, 'history-zh.png') });
  await dialog.locator('button').click();
  checks.push('Historical anonymous account opens in a real dialog, retains selection during language switch, and separates legacy interval charges from unknown turn cost');

  commits.push(...await page.evaluate(() => __accountCommits));
  assert.equal(commits.length, 3); assert.deepEqual(await page.evaluate(() => __accountSounds), []); assert.deepEqual(errors, []);
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ ok: true, passed: checks.length, checks, commits, geometry, requests, errors }, null, 2));
  console.log(JSON.stringify({ ok: true, passed: checks.length, output }));
} catch (error) {
  await page.screenshot({ path: path.join(output, 'failure.png') }).catch(() => {});
  fs.writeFileSync(path.join(output, 'report.json'), JSON.stringify({ ok: false, error: error.stack, checks, commits, geometry, requests, errors }, null, 2));
  throw error;
} finally {
  dispatcher.dispatch = originalDispatch;
  await harness.close();
}
