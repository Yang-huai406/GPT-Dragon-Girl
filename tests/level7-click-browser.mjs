// Isolated renderer proof only. Playwright drives headless Edge in a workspace
// profile with fixture data; this does NOT test native OS click-through/regions.
import fs from 'node:fs';
import path from 'node:path';
import assert from 'node:assert/strict';
import { fileURLToPath } from 'node:url';
import { createBrowserHarness } from './browser-harness.mjs';

const root = path.resolve(fileURLToPath(new URL('..', import.meta.url)));
const output = path.resolve(process.argv[2] || path.join(root, '../../qa/click'));
const report = { ok: false, scope: 'Headless Edge renderer input and Alpha geometry only; no native window, OS mouse injection or installed plugin.',
  configuration: 'Fixture-only bubbles disabled to isolate repeated character press handling from balloon buttons covering its upper edge; sound disabled by fixture.', scenarios: [] };
let harness;
try {
  harness = await createBrowserHarness(output, { viewport: { width: 1100, height: 850 } });
  const { page } = harness;
  // Use the supported persisted option in the isolated fixture, not a CSS
  // override or a replacement input handler. Bubbles have their own legitimate
  // click routing and can cover the upper edge used by this geometry test.
  const saved = await harness.dispatcher.dispatch('/dsh-whale/size.json', { method: 'PUT', body: Buffer.from(JSON.stringify({ bubbleOn: false })) });
  assert.equal(saved.status, 200); await page.reload();
  await page.waitForFunction(() => window.__whaleRenderTest?.status().hitCache.decodes > 0 && window.WhaleRendering?.petInteraction);
  await page.waitForTimeout(500);
  await page.evaluate(() => {
    window.__level7ClickTrace = [];
    for (const type of ['pointerdown', 'pointerup', 'click']) document.addEventListener(type, event => {
      const img = document.querySelector('.dshwv-img'), root = document.querySelector('.dshwv-root');
      window.__level7ClickTrace.push({ type, trusted: event.isTrusted, x: event.clientX, y: event.clientY, tag: event.target?.tagName, target: String(event.target?.className?.baseVal || event.target?.className || ''),
        alpha: WhaleRendering.hitCache.hit(img, event.clientX, event.clientY, WhaleRendering.mirrorScale(root) < 0),
        guarded: WhaleRendering.petInteraction.hit(img, root, event.clientX, event.clientY),
        phase: WhaleRendering.petInteraction.state?.phase || null,
        pointerId: event.pointerId, input: __whaleInputTest.status() });
    }, true);
  });
  async function burst(point, count, interval) {
    await page.evaluate(() => { window.__level7ClickTrace = []; });
    await page.mouse.move(point.x, point.y);
    for (let i = 0; i < count; i++) {
      await page.mouse.click(point.x, point.y, { delay: 40 });
      await page.waitForTimeout(interval);
    }
    const trace = await page.evaluate(() => window.__level7ClickTrace);
    assert.ok(trace.every(e => e.trusted), 'renderer events must come from Playwright mouse, not dispatchEvent');
    assert.equal(trace.filter(e => e.type === 'pointerdown').length, count, 'every press reaches the renderer');
    assert.equal(trace.filter(e => e.type === 'pointerup').length, count, 'every release reaches the renderer');
    return trace;
  }
  for (const [scale, flip, interval] of [[.6, false, 20], [.6, true, 50], [1.2, false, 100], [1.2, true, 20], [2, false, 50], [2, true, 100]]) {
    const label = `edge-${scale}-${flip ? 'mirrored' : 'normal'}-${interval}ms`;
    await page.evaluate(({ scale, flip }) => {
      __whaleRenderTest.close(); __whaleRenderTest.scale(scale); __whaleRenderTest.place(flip ? 120 : 520, 150, flip);
    }, { scale, flip });
    await page.waitForTimeout(400);
    // Commit this test-only pose through the real drag handler. The render test
    // hook sets presentation only; a real drag aligns its remembered anchor.
    const grip = await page.evaluate(() => {
      const img = document.querySelector('.dshwv-img'), root = document.querySelector('.dshwv-root'), r = img.getBoundingClientRect();
      let best, distance = Infinity;
      for (let y = Math.ceil(r.top + 3); y < r.bottom - 3; y += 2) for (let x = Math.ceil(r.left + 3); x < r.right - 3; x += 2) {
        if (!WhaleRendering.petInteraction.hit(img, root, x, y)) continue;
        const d = (x - (r.left + r.right) / 2) ** 2 + (y - (r.top + r.bottom) / 2) ** 2;
        if (d < distance) { distance = d; best = { x, y }; }
      }
      if (!best) throw Error('No opaque drag grip'); return best;
    });
    await page.mouse.move(grip.x, grip.y); await page.mouse.down();
    await page.mouse.move(grip.x + 8, grip.y + 8, { steps: 3 }); await page.mouse.up();
    await page.waitForTimeout(600);
    assert.equal(await page.evaluate(() => __whaleRenderTest.status().flip), flip, 'drag must preserve selected orientation');
    const point = await page.evaluate(() => {
      const img = document.querySelector('.dshwv-img'), root = document.querySelector('.dshwv-root'), body = document.querySelector('.dshwv-body');
      const r = img.getBoundingClientRect(), b = body.getBoundingClientRect(), flipped = WhaleRendering.mirrorScale(root) < 0, cx = (b.left + b.right) / 2;
      const menu = document.querySelector('.dshwv-menu-btn').getBoundingClientRect();
      const pressed = { left: cx + (r.left - cx) * 1.05, top: b.bottom - (b.bottom - r.top) * .88, width: r.width * 1.05, height: r.height * .88 };
      pressed.right = pressed.left + pressed.width; pressed.bottom = pressed.top + pressed.height;
      const hit = (x, y, rect) => WhaleRendering.hitCache.hit(img, x, y, flipped, rect);
      for (let y = Math.ceil(r.top + 2); y < r.bottom - 2; y += 2) for (let x = Math.ceil(r.left + 2); x < r.right - 2; x += 2) {
        if (x >= menu.left - 2 && x <= menu.right + 2 && y >= menu.top - 2 && y <= menu.bottom + 2) continue;
        if (hit(x, y) && hit(x - 1, y) && hit(x + 1, y) && hit(x, y - 1) && hit(x, y + 1) && !hit(x, y, pressed)) return { x, y, predictedAlphaLost: true };
      }
      throw Error('No opaque edge that moves out of the press footprint');
    });
    const trace = await burst(point, 20, interval);
    const downs = trace.filter(e => e.type === 'pointerdown'), ups = trace.filter(e => e.type === 'pointerup');
    const row = { label, scale, flip, count: 20, interval, point, acceptedDown: downs.filter(e => e.phase === 'held' && e.guarded).length,
      protectedAlphaLoss: ups.filter(e => !e.alpha && e.guarded).length, trace };
    report.scenarios.push(row);
    assert.equal(row.acceptedDown, 20, 'all presses must enter the application gesture, including rebound clicks');
    assert.ok(ups.every(e => e.guarded), 'the stable alpha footprint must remain valid on every release');
    if (scale === 2) await page.screenshot({ path: path.join(output, `gpt-edge-${flip ? 'mirrored' : 'normal'}.png`) });
    await page.evaluate(() => __whaleRenderTest.close()); await page.waitForTimeout(500);
    const transparent = await page.evaluate(() => {
      const img = document.querySelector('.dshwv-img'), root = document.querySelector('.dshwv-root'), r = img.getBoundingClientRect();
      // A transparent pixel inside the image rectangle is stronger evidence
      // than merely clicking outside the widget's rectangular bounds.
      for (let y = Math.ceil(r.top + 2); y < r.bottom - 2; y += 2) for (let x = Math.ceil(r.left + 2); x < r.right - 2; x += 2) {
        if (!WhaleRendering.petInteraction.hit(img, root, x, y) && !__whaleInputTest.hit({ x, y })) return { x, y, insideImageRect: true };
      }
      throw Error('No transparent control pixel inside image bounds');
    });
    const control = await burst(transparent, 3, 50);
    assert.ok(control.filter(e => e.type === 'pointerdown').every(e => !e.guarded && e.phase !== 'held' && !e.input.interactive), 'transparent pixels must not enter widget gesture handling');
    row.transparentControl = { point: transparent, count: 3, rejectedDown: 3, trace: control };
  }
  report.alphaLostEvents = report.scenarios.reduce((sum, row) => sum + row.protectedAlphaLoss, 0);
  assert.ok(report.alphaLostEvents > 0, 'a real press animation must move visible alpha away while the stable hit remains valid');
  assert.deepEqual(harness.errors, [], 'no renderer exceptions');
  report.ok = true;
} catch (error) {
  report.error = error.stack;
  process.exitCode = 1;
} finally {
  report.errors = harness?.errors || [];
  fs.mkdirSync(output, { recursive: true });
  fs.writeFileSync(path.join(output, 'level7-click-browser.json'), JSON.stringify(report, null, 2));
  await harness?.close();
}
console.log(JSON.stringify({ ok: report.ok, scenarios: report.scenarios.length, alphaLostEvents: report.alphaLostEvents,
  reportFile: path.join(output, 'level7-click-browser.json'), error: report.error }));
