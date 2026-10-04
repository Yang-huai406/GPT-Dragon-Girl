import test from 'node:test';
import assert from 'node:assert/strict';
import fs from 'node:fs';
import vm from 'node:vm';

const widget = fs.readFileSync(new URL('../assets/whale-widget.js', import.meta.url), 'utf8');
const begin = widget.indexOf('    function playTaskEndSound()');
const finish = widget.indexOf('    function playTaskEndGroupClick(', begin);
const startNotice = widget.indexOf('          var notice = WhaleTurnNotice.snapshot(d, state.currency);');
const endNotice = widget.indexOf('        }).catch(', startNotice);
assert.ok(begin >= 0 && finish > begin && startNotice >= 0 && endNotice > startNotice);

function fixture({ mode = 'api', kind = 'success', enabled = true, sound = true, turnCost = true, slots = [] } = {}) {
  const calls = [], value = { completionKind: kind, failureKind: kind === 'failed' ? 'high-demand' : null };
  const context = {
    window: { WhaleFeedback: { play: (...args) => calls.push(['sound', ...args]) }, WhaleAccountView: { mode, notice: () => calls.push(['subscription']) }, dispatchEvent() {} },
    CustomEvent: class {}, WhaleTurnNotice: { snapshot: () => value }, d: {}, state: {}, turnCostOn: turnCost,
    usageSet: { taskEnd: { on: enabled, sel: 'grp:duck' } }, soundOn: sound, soundVol: .3,
    audioGroupSlotEmpty: (_, slot) => slots.includes(slot), showCostBubble: () => calls.push(['bubble']),
    taskEndSel: {}, encodeURIComponent
  };
  vm.runInNewContext(widget.slice(begin, finish) + '\n(function(){\n' + widget.slice(startNotice, endNotice) + '\n})();', context);
  return calls;
}

test('API and subscription successes use the same complete task group before their display branches', () => {
  for (const mode of ['api', 'subscription']) {
    const calls = fixture({ mode });
    assert.equal(calls[0][0], 'sound'); assert.equal(calls[0][1], 'success');
    assert.deepEqual(Array.from(calls[0][2]), ['/dsh-whale/sound/press.mp3?set=duck', '/dsh-whale/sound/release.mp3?set=duck']);
    assert.equal(calls[0][3], .3);
    assert.equal(calls[1][0], mode === 'api' ? 'bubble' : 'subscription');
  }
});

test('task notifications honor switches and never restore the removed failed sound', () => {
  for (const mode of ['api', 'subscription']) for (const kind of ['success', 'cancelled', 'failed']) {
    assert.equal(fixture({ mode, kind, enabled: false }).filter(v => v[0] === 'sound').length, 0);
    const muted = fixture({ mode, kind, sound: false }).filter(v => v[0] === 'sound');
    assert.ok(muted.length === 0 || muted.every(v => v[3] === 0));
    assert.equal(fixture({ mode, kind }).filter(v => v[0] === 'sound').length, kind === 'failed' ? 0 : 1);
  }
});

test('optional cancellation feedback uses the selected event and shared master volume', () => {
  for (const mode of ['api', 'subscription']) {
    const sounds = fixture({ mode, kind: 'cancelled' }).filter(v => v[0] === 'sound');
    assert.equal(sounds.length, 1); assert.equal(sounds[0][1], 'cancelled'); assert.equal(sounds[0][3], .3);
  }
});

test('subscription notices honor the common turn-cost display switch independently of sound', () => {
  for (const kind of ['success', 'cancelled', 'failed']) {
    const calls = fixture({ mode: 'subscription', kind, turnCost: false });
    assert.equal(calls.filter(v => v[0] === 'subscription').length, 0);
    assert.equal(calls.filter(v => v[0] === 'sound').length, kind === 'success' ? 1 : 0);
  }
});

test('task group success preserves intentional empty slots', () => {
  const calls = fixture({ slots: ['press'] });
  assert.deepEqual(Array.from(calls[0][2]), ['/dsh-whale/sound/release.mp3?set=duck']);
});
