import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import path from 'node:path';
import os from 'node:os';
import { createRequire } from 'node:module';
import { createDispatcher } from '../runtime/dispatcher.mjs';
import { localizeResponse } from '../lib/i18n-response.mjs';
import { usageDefaults } from '../runtime/ledger.mjs';
const { loadCatalogs } = createRequire(import.meta.url)('../lib/i18n.cjs');
const catalogs = loadCatalogs();

function setup(t) {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'gpt-level7-i18n-'));
  const service = { config: { resolve: () => ({ setting: {} }) }, close: async () => {},
    usageScopes: () => ({ ok: true, scopes: [{ scope: 'a'.repeat(24) + '-USD', label: '匿名账户 aaaaaaaa · USD', labelKey: 'backend.level7.anonymousAccount', labelArgs: { account: 'aaaaaaaa', currency: 'USD' } }] }) };
  const dispatcher = createDispatcher({ dataDir: dir, service, monitor: false, autoRefresh: false });
  t.after(async () => {
    await dispatcher.close();
    assert.ok(path.resolve(dir).startsWith(path.resolve(os.tmpdir()) + path.sep) && path.basename(dir).startsWith('gpt-level7-i18n-'));
    fs.rmSync(dir, { recursive: true, force: true });
  });
  return { dir, request: async (route, locale = 'en', method = 'GET', body) => {
    const result = await dispatcher.dispatch(route, { method, body, headers: { 'x-whale-locale': locale } });
    return { status: result.status, data: JSON.parse(result.body) };
  } };
}

test('Level7 response fields translate without changing account/currency or arbitrary user names', () => {
  const source = { label: '匿名账户 aaaaaaaa · USD', labelKey: 'backend.level7.anonymousAccount', labelArgs: { account: 'aaaaaaaa', currency: 'USD' },
    note: catalogs['zh-CN']['backend.level7.unattributedCost'], name: 'GPT小龙娘·摸摸头', currency: 'USD', amount: 1e-10 };
  const english = localizeResponse(source, 'en', catalogs);
  assert.equal(english.label, 'Anonymous account aaaaaaaa · USD');
  assert.equal(english.note, catalogs.en['backend.level7.unattributedCost']);
  assert.equal(english.name, source.name); assert.equal(english.amount, source.amount); assert.equal(english.currency, source.currency);
  assert.equal(localizeResponse(english, 'zh-CN', catalogs).label, source.label);
});

test('builtin media names expose stable keys; custom names identical to builtin text stay user-authored', async t => {
  const { dir, request } = setup(t);
  const roleDir = path.join(dir, 'whale-roles'); fs.mkdirSync(roleDir);
  fs.writeFileSync(path.join(roleDir, 'roles.json'), JSON.stringify({ version: 1, roles: [{ id: 'default', name: '小鲸鱼' }, { id: 'user_sample', name: 'GPT小龙娘' }] }));
  const roles = (await request('/dsh-whale/roles.json')).data.roles;
  assert.equal(roles.find(x => x.id === 'default').name, 'GPT Dragon Girl');
  assert.equal(roles.find(x => x.id === 'default').nameKey, 'backend.m206');
  assert.equal(roles.find(x => x.id === 'user_sample').name, 'GPT小龙娘');
  assert.equal(roles.find(x => x.id === 'user_sample').nameKey, undefined);
  const pictures = (await request('/dsh-whale/bubble-imgs.json')).data.images;
  assert.deepEqual(pictures.map(x => x.id), ['bimg_petpet']);
  assert.equal(pictures[0].name, 'GPT Dragon Girl · Petting');
  assert.equal((await request('/dsh-whale/bubble-imgs.json', 'zh-CN')).data.images[0].name, 'GPT小龙娘·摸摸头');
  const audio = (await request('/dsh-whale/audio.json')).data;
  assert.ok(JSON.stringify(audio).includes('Duck · Press'));
  assert.equal((await request('/api/usage-scopes')).data.scopes[0].label, 'Anonymous account aaaaaaaa · USD');
});

test('English bubble conflict preserves newest saved content and both GPT sanitizers', async t => {
  const { request } = setup(t);
  const initial = (await request('/dsh-whale/bubble.json')).data;
  const first = await request('/dsh-whale/bubble.json', 'en', 'PUT', { v: 1, items: [], lib: [{ id: 'sample', modules: [{ type: 'image', imgId: 'bimg_yue_money' }, { type: 'text', text: 'Custom text' }] }], expectedRevision: initial.revision });
  assert.equal(first.status, 200); assert.ok(!JSON.stringify(first.data.config).includes('bimg_yue_money'));
  const stale = await request('/dsh-whale/bubble.json', 'en', 'PUT', { v: 1, items: [], lib: [], expectedRevision: initial.revision });
  assert.equal(stale.status, 409); assert.equal(stale.data.error, catalogs.en['backend.level7.bubbleConflict']);
  assert.deepEqual((await request('/dsh-whale/bubble.json')).data.config, first.data.config);
  assert.ok(!JSON.stringify(usageDefaults()).includes('bimg_yue_money'));
});
