/**
 * Growth probe — what accumulates during a real session (GPU, frozen build).
 *   node tools/critic/_growth.mjs --minutes 8 --url http://127.0.0.1:4611
 */
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4611');
const MIN = Number(arg('minutes', 8));

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
await ctx.addInitScript(() => {
  window.__L = { add: 0, rm: 0, t: {} };
  const A = EventTarget.prototype.addEventListener, R = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (t, f, o) { window.__L.add++; window.__L.t[t] = (window.__L.t[t] || 0) + 1; return A.call(this, t, f, o); };
  EventTarget.prototype.removeEventListener = function (t, f, o) { window.__L.rm++; window.__L.t[t] = (window.__L.t[t] || 0) - 1; return R.call(this, t, f, o); };
  window.__TO = { set: 0, clear: 0 };
  const ST = window.setTimeout, SI = window.setInterval;
  window.setInterval = function (...a) { window.__TO.set++; return SI.apply(window, a); };
});
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[err]', e.message.slice(0, 160)));
page.on('console', (m) => { if (m.type() === 'error') console.log('[cerr]', m.text().slice(0, 160)); });

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4500);
await page.evaluate(() => {
  window.__f = [];
  const push = () => { window.__f.push(performance.now()); if (window.__f.length > 3000) window.__f.splice(0, 1500); requestAnimationFrame(push); };
  requestAnimationFrame(push);
});

const alive = () => page.evaluate(() => !!window.__ascent).catch(() => false);

const sample = () => page.evaluate(() => {
  const a = window.__ascent;
  if (!a) return null;
  const info = a.engine.renderer.info;
  const cls = {}; let objs = 0; const mats = new Set(), geos = new Set();
  a.engine.scene.traverse((o) => {
    objs++; cls[o.type] = (cls[o.type] || 0) + 1;
    if (o.material) (Array.isArray(o.material) ? o.material : [o.material]).forEach((m) => m && mats.add(m.uuid));
    if (o.geometry) geos.add(o.geometry.uuid);
  });
  const f = window.__f || [], d = [];
  for (let i = Math.max(1, f.length - 900); i < f.length; i++) d.push(f[i] - f[i - 1]);
  d.sort((x, y) => x - y);
  const q = (p) => d.length ? d[Math.min(d.length - 1, Math.floor(d.length * p))] : 0;
  const st = a.state();
  return {
    t: performance.now() / 1000,
    fps: q(0.5) ? 1000 / q(0.5) : 0, p95: q(0.95), p99: q(0.99),
    tier: st.fxTier, dpr: a.engine.renderer.getPixelRatio(), cap: st.perf.pixelCap,
    geometries: info.memory.geometries, textures: info.memory.textures,
    programs: info.programs?.length ?? 0, calls: info.render.calls, tris: info.render.triangles,
    sceneObjects: objs, materials: mats.size, geoUnique: geos.size,
    topClasses: Object.entries(cls).sort((x, y) => y[1] - x[1]).slice(0, 8),
    domNodes: document.getElementsByTagName('*').length,
    listeners: window.__L.add - window.__L.rm,
    listenTop: Object.entries(window.__L.t).sort((x, y) => y[1] - x[1]).slice(0, 6),
    intervals: window.__TO.set,
    updaters: a.engine.updaters.size,
    pieces: a.builder?.pieces?.size ?? 0,
    solids: a.builder?.solids?.size ?? a.builder?.solids?.list?.length ?? null,
    beacons: st.kit?.beacons ?? null,
    motes: st.drift ? JSON.stringify(st.drift).slice(0, 80) : null,
    heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
  };
});

const rows = [];
const t0 = Date.now();
await page.mouse.click(800, 450);
let i = 0, lastLog = 0;
while ((Date.now() - t0) / 60000 < MIN) {
  i++;
  if (!(await alive())) { console.log('!! page lost __ascent'); break; }
  try {
    // hand the frame back
    for (let k = 0; k < 3; k++) {
      if (!(await page.evaluate(() => !!window.__ascent.input.uiOpen))) break;
      await page.keyboard.press('Escape'); await page.waitForTimeout(300);
    }
    // sprint around, turning
    await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
    for (let k = 0; k < 10; k++) { await page.mouse.move(800 + (k % 3 - 1) * 160, 450, { steps: 2 }); await page.waitForTimeout(180); }
    await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
    // jump/dash
    await page.keyboard.press('Space');
    // build: a few walls
    for (let k = 0; k < 4; k++) { await page.mouse.click(700 + k * 60, 430 + (k % 2) * 40); await page.waitForTimeout(120); }
    // plant a beacon / use verbs
    await page.keyboard.press('KeyG'); await page.waitForTimeout(150);
    await page.keyboard.press('KeyF'); await page.waitForTimeout(150);
    // open whatever is near and answer
    await page.keyboard.press('KeyE'); await page.waitForTimeout(600);
    const ans = await page.evaluate(() => { const p = window.__ascent.panel; return (p?.open && p.item) ? String(p.item.answer) : ''; });
    if (ans) {
      const opts = await page.$$('.rf-opt, .rf-choice button, .rf-choices button');
      if (opts.length) await opts[0].click().catch(() => {});
      else { for (const ch of ans) await page.keyboard.press(ch === '-' ? 'Minus' : ch === '/' ? 'Slash' : ch === '.' ? 'Period' : ch).catch(() => {}); await page.keyboard.press('Enter'); }
      await page.waitForTimeout(900);
    }
  } catch (e) { console.log('[loop]', String(e).slice(0, 120)); }

  if ((Date.now() - t0) - lastLog > 45000) {
    lastLog = Date.now() - t0;
    const s = await sample();
    if (!s) break;
    rows.push(s);
    console.log(`${(s.t / 60).toFixed(1)}m fps ${s.fps.toFixed(1)} p95 ${s.p95.toFixed(1)} tier ${s.tier} dpr ${s.dpr.toFixed(2)}`
      + ` | geo ${s.geometries} tex ${s.textures} prog ${s.programs} scene ${s.sceneObjects} mat ${s.materials}`
      + ` | calls ${s.calls} tris ${(s.tris / 1000).toFixed(0)}k dom ${s.domNodes} lis ${s.listeners} upd ${s.updaters}`
      + ` | pieces ${s.pieces} solids ${s.solids} beacons ${s.beacons} heap ${s.heapMB}`);
  }
}

if (rows.length > 1) {
  const a = rows[0], b = rows[rows.length - 1];
  console.log('\n=== GROWTH first -> last ===');
  for (const k of ['fps', 'p95', 'geometries', 'textures', 'programs', 'calls', 'tris', 'sceneObjects', 'materials', 'domNodes', 'listeners', 'updaters', 'pieces', 'solids', 'beacons', 'heapMB'])
    console.log(k.padEnd(14), String(a[k]).padStart(10), '->', String(b[k]).padStart(10));
  console.log('classes first', JSON.stringify(a.topClasses));
  console.log('classes last ', JSON.stringify(b.topClasses));
  console.log('listeners    ', JSON.stringify(b.listenTop));
}
await writeFile('/tmp/growth.json', JSON.stringify(rows, null, 2));
await browser.close();
