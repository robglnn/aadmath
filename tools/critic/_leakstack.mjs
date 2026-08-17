/**
 * Leak provenance probe — WHO is registering the listeners and creating the
 * DOM nodes that a fifteen-minute session accumulates.
 *
 * sustain.mjs proves the growth exists and names the counter. It cannot name
 * the line. This wraps addEventListener/removeEventListener and the DOM
 * insertion path with a stack capture, plays for a couple of minutes, and
 * prints the call sites ranked by how many live registrations each one is
 * still holding. Diagnostic only; not a gate.
 *
 *   node tools/critic/_leakstack.mjs --url http://127.0.0.1:5173 --seconds 120
 */
import { chromium } from 'playwright';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const SECONDS = Number(arg('seconds', 120));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });

await ctx.addInitScript(() => {
  const site = (skip) => {
    const lines = (new Error().stack || '').split('\n').slice(skip);
    for (const l of lines) {
      if (/addEventListener|removeEventListener|__leak/.test(l)) continue;
      const m = l.match(/(\/[^\s):]+\.js[^\s):]*:\d+:\d+)/);
      if (m) return m[1].replace(/^.*\/(src|assets)\//, '$1/');
    }
    return lines[0] || '?';
  };
  window.__leak = { add: new Map(), rm: new Map(), nodes: new Map(), n: 0 };
  const bump = (map, key, by = 1) => map.set(key, (map.get(key) || 0) + by);

  const A = EventTarget.prototype.addEventListener;
  const R = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (t, f, o) {
    window.__leak.n++;
    bump(window.__leak.add, site(2) + '  [' + t + ']');
    return A.call(this, t, f, o);
  };
  EventTarget.prototype.removeEventListener = function (t, f, o) {
    bump(window.__leak.rm, site(2) + '  [' + t + ']');
    return R.call(this, t, f, o);
  };
  // Who is putting elements into the document and leaving them there.
  for (const name of ['appendChild', 'insertBefore', 'append', 'prepend']) {
    const orig = Node.prototype[name] || Element.prototype[name];
    if (!orig) continue;
    const target = Node.prototype[name] ? Node.prototype : Element.prototype;
    target[name] = function (...a) {
      if (this.isConnected) bump(window.__leak.nodes, site(2));
      return orig.apply(this, a);
    };
  }
});

const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[err]', e.message.slice(0, 120)));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4000);

const snap = () => page.evaluate(() => ({
  add: [...window.__leak.add], rm: [...window.__leak.rm], nodes: [...window.__leak.nodes],
  dom: document.getElementsByTagName('*').length,
  scene: (() => { let n = 0; window.__ascent.engine.scene.traverse(() => n++); return n; })(),
  draws: window.__ascent.engine.renderer.info.render.calls,
}));

const before = await snap();
console.log(`baseline: dom ${before.dom} scene ${before.scene} draws ${before.draws}\n`);

// Real play: walk, open rifts, answer, build. Same shape as sustain.mjs.
const t0 = Date.now();
await page.mouse.click(800, 450);
while (Date.now() - t0 < SECONDS * 1000) {
  await page.keyboard.down('KeyW');
  await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(1500);
  await page.keyboard.down('ArrowRight');
  await page.waitForTimeout(300);
  await page.keyboard.up('ArrowRight');
  await page.waitForTimeout(1200);
  await page.keyboard.up('KeyW');
  await page.keyboard.up('ShiftLeft');
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(400);
  await page.keyboard.press('Escape');
  for (let k = 0; k < 4; k++) { await page.mouse.click(700 + k * 80, 430).catch(() => {}); await page.waitForTimeout(120); }
  await page.keyboard.press('KeyG');
  await page.keyboard.press('KeyF');
  await page.waitForTimeout(300);
  await page.keyboard.press('Escape');
}

const after = await snap();
const diff = (a, b) => {
  const m = new Map(b);
  for (const [k, v] of a) m.set(k, (m.get(k) || 0) - v);
  return [...m].filter(([, v]) => v > 0).sort((x, y) => y[1] - x[1]);
};
const net = new Map(diff(before.add, after.add));
for (const [k, v] of diff(before.rm, after.rm)) if (net.has(k)) net.set(k, net.get(k) - v);

console.log(`after ${SECONDS}s: dom ${after.dom} (+${after.dom - before.dom})  `
  + `scene ${after.scene} (+${after.scene - before.scene})  draws ${after.draws} (+${after.draws - before.draws})\n`);
console.log('NET LISTENERS ADDED AND NEVER REMOVED (top 18):');
for (const [k, v] of [...net].sort((a, b) => b[1] - a[1]).slice(0, 18)) if (v > 0) console.log(`  +${String(v).padStart(5)}  ${k}`);
console.log('\nDOM INSERTIONS INTO THE LIVE DOCUMENT (top 12):');
for (const [k, v] of diff(before.nodes, after.nodes).slice(0, 12)) console.log(`  +${String(v).padStart(5)}  ${k}`);

await browser.close();
