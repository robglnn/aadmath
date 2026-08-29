/**
 * Name the owners of everything that accumulates.
 *
 * Plays the real game with real keys (never the debug API to make progress),
 * and takes an inventory every 30 s of:
 *
 *   - every DOM element alive, bucketed by tag + class, with the JS stack of
 *     whatever inserted it
 *   - every compiled shader program, by three's own `cacheKey`, so a program
 *     that appears mid-session names the material that asked for it
 *   - every net-live event listener, bucketed by type + the stack that added it
 *
 * Run against the DEV server so the stacks carry real function and file names.
 *
 *   node scratch/perf/leakprobe.mjs --minutes 6 [--url http://127.0.0.1:5173]
 */
import { chromium } from 'playwright';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const MINUTES = Number(arg('minutes', 6));
const EVERY = Number(arg('every', 30));

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
         '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });

await ctx.addInitScript(() => {
  const site = (skip = 3) => {
    const s = (new Error().stack || '').split('\n').slice(skip);
    // first frame that is our own source, not a wrapper and not the framework
    for (const l of s) {
      if (/\/src\//.test(l) && !/leakprobe/.test(l)) return l.trim().replace(/^at\s+/, '');
    }
    for (const l of s) if (l.includes('http')) return l.trim().replace(/^at\s+/, '');
    return '?';
  };
  window.__probe = { sites: new Map() };
  const note = (map, key) => map.set(key, (map.get(key) || 0) + 1);

  // ---- listeners, net of removals, attributed to the adding site ----------
  window.__L = { add: 0, rm: 0, by: new Map() };
  const A = EventTarget.prototype.addEventListener, R = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (t, f, o) {
    window.__L.add++;
    const k = t + ' @ ' + site();
    note(window.__L.by, k);
    try { (f && typeof f === 'object' ? f : this).__site = k; } catch { /* frozen */ }
    if (f) { try { f.__site = k; } catch { /* native */ } }
    return A.call(this, t, f, o);
  };
  EventTarget.prototype.removeEventListener = function (t, f, o) {
    window.__L.rm++;
    const k = (f && f.__site) || (t + ' @ ?');
    note(window.__L.by, k === '?' ? k : k);
    window.__L.by.set(k, (window.__L.by.get(k) || 0) - 2); // undo the +1 we just did, then -1
    return R.call(this, t, f, o);
  };

  // ---- DOM insertions, attributed to the inserting site -------------------
  window.__D = new WeakMap();
  const tag = (n) => {
    if (!n || n.nodeType !== 1) return null;
    const c = (n.className && typeof n.className === 'string') ? '.' + n.className.trim().split(/\s+/).slice(0, 2).join('.') : '';
    return n.tagName.toLowerCase() + c;
  };
  for (const m of ['appendChild', 'insertBefore', 'replaceChild']) {
    const orig = Node.prototype[m];
    Node.prototype[m] = function (...a) {
      const s = site();
      const r = orig.apply(this, a);
      try { if (a[0] && a[0].nodeType === 1) window.__D.set(a[0], s); } catch { /* ignore */ }
      return r;
    };
  }
  for (const m of ['append', 'prepend', 'before', 'after', 'insertAdjacentHTML']) {
    const orig = Element.prototype[m];
    if (!orig) continue;
    Element.prototype[m] = function (...a) {
      const s = site();
      const r = orig.apply(this, a);
      try { for (const x of a) if (x && x.nodeType === 1) window.__D.set(x, s); } catch { /* ignore */ }
      return r;
    };
  }
  const ih = Object.getOwnPropertyDescriptor(Element.prototype, 'innerHTML');
  Object.defineProperty(Element.prototype, 'innerHTML', {
    ...ih,
    set(v) {
      const s = site();
      ih.set.call(this, v);
      try { for (const el of this.querySelectorAll('*')) window.__D.set(el, s); } catch { /* ignore */ }
    },
  });

  // ---- timers and animations: the two things that accumulate WITHOUT moving
  // any counter the gate watches. A CSS animation left running on a hidden
  // element costs the compositor every frame and the DOM node count never
  // changes; an interval nobody cleared costs the main thread forever.
  window.__T = { timeouts: 0, intervals: 0 };
  {
    const st = window.setTimeout, ct = window.clearTimeout;
    const si = window.setInterval, ci = window.clearInterval;
    const live = new Set(), liveI = new Set();
    window.setTimeout = function (f, d, ...a) {
      const id = st.call(window, function (...x) { live.delete(id); window.__T.timeouts = live.size; return f && f.apply(this, x); }, d, ...a);
      live.add(id); window.__T.timeouts = live.size; return id;
    };
    window.clearTimeout = function (id) { live.delete(id); window.__T.timeouts = live.size; return ct.call(window, id); };
    window.setInterval = function (f, d, ...a) { const id = si.call(window, f, d, ...a); liveI.add(id); window.__T.intervals = liveI.size; return id; };
    window.clearInterval = function (id) { liveI.delete(id); window.__T.intervals = liveI.size; return ci.call(window, id); };
  }

  /** Time each engine updater and the post stack separately, once the game exists. */
  window.__armCost = () => {
    const e = window.__ascent.engine;
    if (e.__costArmed) return;
    e.__costArmed = true;
    const each = [...e.updaters];
    e.updaters.clear();
    e.__updCost = new Float64Array(each.length);
    each.forEach((fn, i) => e.updaters.add((dt, t) => {
      const s = performance.now(); fn(dt, t); e.__updCost[i] += performance.now() - s;
    }));
    e.__cost = { post: 0, fxupd: 0 };
    const post = e.postFX, or = post.render, ou = post.update;
    post.render = function (...x) { const s = performance.now(); const r = or.apply(this, x); e.__cost.post += performance.now() - s; return r; };
    post.update = function (...x) { const s = performance.now(); const r = ou.apply(this, x); e.__cost.fxupd += performance.now() - s; return r; };
  };

  window.__inventory = () => {
    const dom = new Map();
    for (const el of document.getElementsByTagName('*')) {
      const k = tag(el) + '  <-  ' + (window.__D.get(el) || 'boot/parse');
      dom.set(k, (dom.get(k) || 0) + 1);
    }
    const a = window.__ascent;
    const info = a.engine.renderer.info;
    const progs = [];
    if (info.programs) for (const p of info.programs) progs.push((p.name || '?') + ' #' + (p.cacheKey || '').length + ':' + String(p.cacheKey || '').slice(0, 90));
    let sceneObjects = 0; const byType = new Map();
    a.engine.scene.traverse((o) => {
      sceneObjects++;
      const k = o.type + (o.name ? ' "' + o.name + '"' : '');
      byType.set(k, (byType.get(k) || 0) + 1);
    });
    return {
      t: performance.now(),
      fps: null,
      tier: a.state().fxTier, pixelCap: a.state().perf.pixelCap,
      domNodes: document.getElementsByTagName('*').length,
      programs: info.programs ? info.programs.length : 0,
      geometries: info.memory.geometries, textures: info.memory.textures,
      updaters: a.engine.updaters.size,
      sceneObjects,
      animations: document.getAnimations ? document.getAnimations().length : null,
      timeouts: window.__T.timeouts, intervals: window.__T.intervals,
      drawCalls: info.render.calls, tris: info.render.triangles,
      listeners: window.__L.add - window.__L.rm,
      heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
      dom: [...dom.entries()],
      progs,
      scene: [...byType.entries()],
      lsites: [...window.__L.by.entries()].filter(([, n]) => n > 0),
    };
  };
});

const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message + '\n' + (e.stack || '')));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
try {
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
} catch (e) {
  console.log('the game never booted under the probe. page errors:');
  errs.slice(0, 10).forEach((x) => console.log('  ! ' + x.split('\n').slice(0, 4).join('\n    ')));
  throw e;
}
await page.waitForTimeout(3000);
await page.evaluate(() => window.__armCost());

/** Median fps on a fixed camera, same protocol shoot.mjs uses. */
const measure = () => page.evaluate(async () => {
  const a = window.__ascent;
  a.player.pos.set(0, (a.player.groundAt(0, 26) ?? 12) + 0.4, 26);
  a.player.vel.set(0, 0, 0); a.player.yaw = Math.PI; a.player.pitch = -0.14;
  // Long enough for the grass field to finish repacking after the jump and for
  // the shadow volume to settle. 900 ms was not, and a repack landing inside
  // the sample window is worth 20 fps of noise on its own.
  await new Promise((r) => setTimeout(r, 2500));
  const e = a.engine;
  e.__updCost.fill(0); e.__cost.post = 0; e.__cost.fxupd = 0;
  const dts = []; let last = performance.now();
  await new Promise((res) => { let n = 0; const step = () => { const t = performance.now(); dts.push(t - last); last = t; if (++n < 240) requestAnimationFrame(step); else res(); }; requestAnimationFrame(step); });
  const s = dts.slice(40).sort((x, y) => x - y);
  const N = dts.length;
  const inv = window.__inventory();
  inv.fps = 1000 / s[Math.floor(s.length * 0.5)];
  inv.frameMs = s[Math.floor(s.length * 0.5)];
  inv.postMs = +(e.__cost.post / N).toFixed(3);
  inv.fxUpdMs = +(e.__cost.fxupd / N).toFixed(3);
  inv.updMs = [...e.__updCost].map((v) => +(v / N).toFixed(3));
  inv.updTotal = +([...e.__updCost].reduce((x, y) => x + y, 0) / N).toFixed(3);
  return inv;
});

const W = 1600, H = 900;
async function playFor(seconds) {
  const t0 = Date.now();
  let laps = 0;
  await page.mouse.click(W / 2, H / 2);
  while (Date.now() - t0 < seconds * 1000) {
    await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
    await page.waitForTimeout(2200);
    const turn = laps % 2 ? 'ArrowRight' : 'ArrowLeft';
    await page.keyboard.down(turn); await page.waitForTimeout(260); await page.keyboard.up(turn);
    await page.waitForTimeout(1600);
    await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
    await page.keyboard.press('KeyE');
    await page.waitForTimeout(450);
    const ans = await page.evaluate(() => {
      const p = window.__ascent.panel;
      return (p?.open && p.item) ? String(p.item.answer) : null;
    }).catch(() => null);
    if (ans) {
      for (const ch of ans) {
        if (ch === '-') await page.keyboard.press('Minus');
        else if (ch === '/') await page.keyboard.press('Slash');
        else if (ch === '.') await page.keyboard.press('Period');
        else await page.keyboard.press(ch).catch(() => {});
        await page.waitForTimeout(30);
      }
      await page.keyboard.press('Enter');
      await page.waitForTimeout(1100);
    }
    laps++;
  }
}

const snaps = [];
snaps.push({ min: 0, ...await measure() });
for (let s = EVERY; s <= MINUTES * 60; s += EVERY) {
  await playFor(EVERY);
  snaps.push({ min: +(s / 60).toFixed(1), ...await measure() });
  const a = snaps[0], b = snaps[snaps.length - 1];
  console.log(`min ${String(b.min).padStart(4)}  fps ${b.fps.toFixed(1).padStart(6)} (${b.frameMs.toFixed(2)}ms)  tier ${b.tier.padEnd(6)} cap ${b.pixelCap.toFixed(2)}  `
    + `dom ${b.domNodes}  prog ${b.programs}  list ${b.listeners}  geo ${b.geometries}  tex ${b.textures}  upd ${b.updaters}  scene ${b.sceneObjects}  `
    + `anim ${b.animations}  timers ${b.timeouts}/${b.intervals}  draws ${b.drawCalls}  heap ${b.heapMB}`);
  console.log(`         frame split: post ${b.postMs.toFixed(2)}  fx-update ${b.fxUpdMs.toFixed(2)}  updaters ${b.updTotal.toFixed(2)}  `
    + `rest ${(b.frameMs - b.postMs - b.fxUpdMs - b.updTotal).toFixed(2)}   per-updater [${b.updMs.join(' ')}]`);
}

const A = snaps[0], B = snaps[snaps.length - 1];
const diff = (name, a, b) => {
  const ma = new Map(a), mb = new Map(b);
  const out = [];
  for (const [k, n] of mb) { const o = ma.get(k) || 0; if (n - o !== 0) out.push([n - o, k, o, n]); }
  for (const [k, n] of ma) if (!mb.has(k)) out.push([-n, k, n, 0]);
  out.sort((x, y) => y[0] - x[0]);
  if (!out.length) return;
  console.log(`\n=== ${name}: what changed between minute 0 and minute ${B.min} ===`);
  for (const [d, k, o, n] of out.slice(0, 25)) console.log(`  ${d > 0 ? '+' : ''}${d}\t(${o} -> ${n})\t${k}`);
};
diff('DOM', A.dom, B.dom);
diff('SCENE GRAPH', A.scene, B.scene);
diff('LISTENERS (net, by add-site)', A.lsites, B.lsites);

const pa = new Set(A.progs);
const added = B.progs.filter((p) => !pa.has(p));
const pb = new Set(B.progs);
const gone = A.progs.filter((p) => !pb.has(p));
console.log(`\n=== SHADER PROGRAMS: ${A.programs} -> ${B.programs} ===`);
console.log('added:'); added.forEach((p) => console.log('  + ' + p));
console.log('released:'); gone.forEach((p) => console.log('  - ' + p));
console.log('\npage errors: ' + errs.length);
errs.slice(0, 10).forEach((e) => console.log('  ! ' + e.split('\n')[0]));

await browser.close();
