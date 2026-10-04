import test from 'node:test';
import assert from 'node:assert/strict';
import { sanitizeGptAppearance } from '../lib/gpt-appearance.mjs';
import { usageDefaults } from '../runtime/ledger.mjs';

const oldImage = { type: 'image', imgId: 'bimg_yue_money', imgScale: .3 };
test('legacy image retirement preserves reminders, custom content and input', () => {
  const input = { alert: { below: 5, msg: '{currency}{below}', ttlSec: 6, lines: [
    { type: 'text', text: '{currency}{below}', bold: true }, oldImage,
    { type: 'image', imgId: 'user-custom' },
  ] } };
  const before = structuredClone(input), result = sanitizeGptAppearance(input);
  assert.deepEqual(input, before);
  assert.deepEqual(result.alert, { ...input.alert, lines: [input.alert.lines[0], input.alert.lines[2]] });
  assert.ok(!JSON.stringify(usageDefaults()).includes('bimg_yue_money'));
});
test('nested choice bubbles and library modules avoid empty frames without erasing deliberate blanks', () => {
  const result = sanitizeGptAppearance({ v: 1, items: [{ kind: 'choice', options: [{ w: 50, item: {
    kind: 'custom', modules: [oldImage],
  } }] }, { kind: 'custom', modules: [] }], lib: [{ id: 'saved', module: oldImage }] });
  assert.equal(result.items[0].options[0].w, 50);
  assert.equal(result.items[0].options[0].item.modules[0].type, 'text');
  assert.ok(result.items[0].options[0].item.modules[0].text.length);
  assert.deepEqual(result.items[1].modules, []);
  assert.equal(result.lib[0].module.type, 'text');
  assert.deepEqual(sanitizeGptAppearance(result), result);
  assert.equal(sanitizeGptAppearance(null), null);
});

test('image-only legacy alert retains its formatted amount message', () => {
  const input = { alert: { msg: '余额不足 {currency}{below}', below: 5, lines: [oldImage] } };
  const result = sanitizeGptAppearance(input);
  assert.equal(result.alert.lines[0].text, input.alert.msg);
  assert.equal(result.alert.below, 5);
});
