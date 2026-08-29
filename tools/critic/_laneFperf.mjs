/**
 * WHAT ACCUMULATES — with a name, or with a refutation.
 *
 *   tools/critic/_laneFfrozen.sh tools/critic/_laneFperf.mjs --minutes 6
 *
 * The open defect says *"something accumulates"* and a confident answer to it
 * has already been wrong once, so this is built to DISPROVE first:
 *
 *  1. **The frame rate is measured with the drawing buffer PINNED**, identically
 *     at every sample. The quality controller raises and lowers the resolution
 *     on its own; comparing an unpinned minute-one sample with an unpinned
 *     minute-fifteen one is comparing two different numbers of pixels, and that
 *     mistake has already been made in this repo (see MEASURE_CAP in
 *     tools/critic/shoot.mjs).
 *  2. **There is a control.** At the end, a second page in the SAME browser at
 *     the SAME instant, which has accumulated nothing, is measured the same
 *     way — and then the played page is measured again. If the fresh page is
 *     not faster, the slope is the machine and not the build. (This is the
 *     finding tools/critic/sustain.mjs already recorded once; it is repeated
 *     here rather than assumed.)
 *  3. **The frame is broken down.** Every function on `engine.updaters` is
 *     wrapped with a timer, so if the frame gets more expensive the answer is a
 *     LIST OF NAMES rather than a shrug. Draw calls, triangles, live
 *     geometries, textures, programs, DOM nodes and the JS heap are read at
 *     every sample too.
 *
 * Play is real keys from a cleared save. Nothing is teleported.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/laneF-perf'));
const MINUTES = Number(arg('minutes', 6));
const EVERY_S = Number(arg('every', 20));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit', '--js-flags=--expose-gc'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.evaluate(() => { try { localStorage.clear(); } catch { /* private */ } });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(3000);

/**
 * Wrap every per-frame updater with a timer.
 *
 * `engine.updaters` is a Set of functions the engine calls once a frame. The
 * wrapper is installed ONCE, and re-installed whenever the set grows, so an
 * updater registered at minute nine is timed from minute nine.
 */
const INSTRUMENT = () => page.evaluate(() => {
  const a = window.__ascent;
  const eng = a.engine;
  const T = { ms: new Map(), n: new Map(), name: new WeakMap(), wrap: new Map() };
  window.__T = T;
  let anon = 0;
  const nameOf = (fn) => fn.name || ('anon#' + (++anon));
  const mk = (fn) => {
    const name = nameOf(fn);
    T.name.set(fn, name);
    const w = (...args) => {
      const t0 = performance.now();
      try { return fn(...args); } finally {
        const d = performance.now() - t0;
        T.ms.set(name, (T.ms.get(name) || 0) + d);
        T.n.set(name, (T.n.get(name) || 0) + 1);
      }
    };
    T.wrap.set(fn, w);
    return w;
  };
  /**
   * A Set that times what it holds AND STILL UNREGISTERS. `engine.add()` hands
   * its caller `() => updaters.delete(fn)` with the ORIGINAL function, so an
   * instrument that swaps wrappers into a plain Set silently breaks every
   * unsubscribe in the game — and then reports the updaters it has leaked as
   * the thing that accumulates. That is the shape of measurement error this
   * whole probe exists to avoid, so the mapping is kept and `delete` honours it.
   */
  class Timed extends Set {
    add(fn) {
      if (typeof fn !== 'function' || T.wrap.has(fn)) return super.add(T.wrap.get(fn) || fn);
      return super.add(mk(fn));
    }
    delete(fn) {
      const w = T.wrap.get(fn);
      if (w) { T.wrap.delete(fn); return super.delete(w); }
      return super.delete(fn);
    }
    has(fn) { return super.has(T.wrap.get(fn) || fn); }
  }
  const old = Array.from(eng.updaters);
  const t = new Timed();
  for (const fn of old) t.add(fn);
  eng.updaters = t;
  return { wrapped: t.size, was: old.length };
});

/** One measurement, with the buffer pinned so two samples are the same pixels. */
const sample = () => page.evaluate(async () => {
  const a = window.__ascent;
  const T = window.__T;
  const chosenCap = a.state().perf.pixelCap;
  const chosenTier = a.state().fxTier;
  const wasEnabled = a.engine.quality.enabled;
  a.engine.quality.enabled = false;
  a.engine.quality.cap = 1.0;
  a.engine.applyPixelRatio();
  await new Promise((r) => setTimeout(r, 1200));
  const dts = []; let last = performance.now();
  await new Promise((res) => {
    let n = 0;
    const step = () => {
      const t = performance.now(); dts.push(t - last); last = t;
      if (++n < 110) requestAnimationFrame(step); else res();
    };
    requestAnimationFrame(step);
  });
  const s = dts.slice(20).sort((x, y) => x - y);
  const q = (p) => s[Math.min(s.length - 1, Math.floor(s.length * p))];
  const info = a.engine.renderer.info;
  a.engine.quality.cap = chosenCap;
  a.engine.quality.enabled = wasEnabled;
  a.engine.applyPixelRatio();
  let sceneObjects = 0; a.engine.scene.traverse(() => { sceneObjects++; });
  // per-updater cost since the last sample, in ms per frame
  const top = [];
  if (T) {
    for (const [k, v] of T.ms) {
      const n = T.n.get(k) || 1;
      top.push([k, +(v / n).toFixed(3), n]);
    }
    T.ms.clear(); T.n.clear();
  }
  top.sort((p, q2) => q2[1] - p[1]);
  return {
    t: Date.now(),
    fps: 1000 / q(0.5), p95: q(0.95),
    tier: chosenTier, chosenCap,
    draws: info.render.calls, tris: info.render.triangles,
    geometries: info.memory.geometries, textures: info.memory.textures,
    programs: info.programs ? info.programs.length : 0,
    updaters: a.engine.updaters.size,
    sceneObjects, domNodes: document.getElementsByTagName('*').length,
    heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
    top: top.slice(0, 10),
  };
});

await page.evaluate(() => { document.getElementById('boot')?.classList.add('gone'); });
await INSTRUMENT();

const rows = [];
const t0 = Date.now();
const END = t0 + MINUTES * 60000;
let i = 0;
rows.push({ ...(await sample()), at: 0 });
console.log(`  t=0s  fps ${rows[0].fps.toFixed(1)}  draws ${rows[0].draws}  tris ${rows[0].tris}  geo ${rows[0].geometries}  tex ${rows[0].textures}  prog ${rows[0].programs}  upd ${rows[0].updaters}  dom ${rows[0].domNodes}  heap ${rows[0].heapMB}`);

// ---- real play: walk, turn, sprint, jump. No teleports. -------------------
const keys = ['KeyW', 'KeyW', 'KeyW', 'KeyA', 'KeyW', 'KeyD', 'KeyW', 'Space'];
while (Date.now() < END) {
  const until = Math.min(END, Date.now() + EVERY_S * 1000);
  while (Date.now() < until) {
    const k = keys[(i++) % keys.length];
    await page.keyboard.down('ShiftLeft').catch(() => {});
    await page.keyboard.down(k).catch(() => {});
    await page.waitForTimeout(700);
    await page.keyboard.up(k).catch(() => {});
    await page.keyboard.up('ShiftLeft').catch(() => {});
    const turn = (i % 3) === 0 ? 'ArrowLeft' : 'ArrowRight';
    await page.keyboard.down(turn).catch(() => {});
    await page.waitForTimeout(240);
    await page.keyboard.up(turn).catch(() => {});
    // close anything the world opened, with the real key
    if ((i % 7) === 0) await page.keyboard.press('Escape').catch(() => {});
  }
  const r = await sample();
  r.at = Math.round((Date.now() - t0) / 1000);
  rows.push(r);
  console.log(`  t=${r.at}s  fps ${r.fps.toFixed(1)}  cap ${r.chosenCap?.toFixed?.(2)}  tier ${r.tier}  draws ${r.draws}  tris ${r.tris}  geo ${r.geometries}  tex ${r.textures}  prog ${r.programs}  upd ${r.updaters}  obj ${r.sceneObjects}  dom ${r.domNodes}  heap ${r.heapMB}`);
  console.log(`         top updaters: ${r.top.map(([k, v]) => `${k} ${v}ms`).join('  ')}`);
}

// ---- THE CONTROL: a page that has accumulated nothing, right now ----------
const p2 = await ctx.newPage();
await p2.goto(URL, { waitUntil: 'networkidle' });
await p2.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await p2.waitForTimeout(4000);
const controlSample = await p2.evaluate(async () => {
  const a = window.__ascent;
  a.engine.quality.enabled = false;
  a.engine.quality.cap = 1.0;
  a.engine.applyPixelRatio();
  await new Promise((r) => setTimeout(r, 1500));
  const dts = []; let last = performance.now();
  await new Promise((res) => {
    let n = 0;
    const step = () => { const t = performance.now(); dts.push(t - last); last = t;
      if (++n < 110) requestAnimationFrame(step); else res(); };
    requestAnimationFrame(step);
  });
  const s = dts.slice(20).sort((x, y) => x - y);
  const info = a.engine.renderer.info;
  return { fps: 1000 / s[s.length >> 1], draws: info.render.calls, tris: info.render.triangles };
});
await p2.close();
const after = await sample();

const first = rows[0], last = rows[rows.length - 1];
console.log(`\ncontrol (a page with nothing accumulated, same browser, same second): ${controlSample.fps.toFixed(1)} fps, ${controlSample.draws} draws`);
console.log(`played page re-measured after the control:                            ${after.fps.toFixed(1)} fps`);
console.log(`\nstart ${first.fps.toFixed(1)} fps -> end ${last.fps.toFixed(1)} fps  `
  + `(${(((last.fps - first.fps) / first.fps) * 100).toFixed(1)}%)`);
console.log('what moved, first -> last:');
for (const k of ['draws', 'tris', 'geometries', 'textures', 'programs', 'updaters', 'sceneObjects', 'domNodes', 'heapMB']) {
  const a = first[k], b = last[k];
  if (a == null || b == null) continue;
  const g = a ? ((b - a) / a) * 100 : 0;
  console.log(`  ${k.padEnd(13)} ${String(a).padStart(9)} -> ${String(b).padStart(9)}   ${g >= 0 ? '+' : ''}${g.toFixed(1)}%`);
}

await writeFile(path.join(OUT, 'perf.json'), JSON.stringify({ url: URL, minutes: MINUTES, rows, control: controlSample, after, errors }, null, 1));
console.log(`\n${errors.length} console error(s)`);
if (errors.length) console.log(errors.slice(0, 4).join('\n'));
await browser.close();
