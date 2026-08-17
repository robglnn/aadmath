/**
 * THE SUSTAINED-FRAME GATE — fps at minute fifteen, not at second five.
 *
 * WHY THIS EXISTS
 *
 * `tools/critic/bench.mjs` reports ~112 fps and it is not lying. It is
 * measuring the wrong thing. It loads the page, waits three seconds, teleports
 * the camera to four fixed spots and sprints on the spot for 2.6 s at each. A
 * scene that has never had a wall placed in it, never had a beacon planted in
 * it, never opened a learning card and never sealed a rift is the *cheapest*
 * this game will ever be. Every number the repo has quoted about frame rate
 * has been a number about second five.
 *
 * A real player reported the other number:
 *
 *   "after 18 minutes of real play the game had auto-degraded to fxTier 'low'
 *    at 44.9 fps on an M4, not the 91.7 the benchmark reports."
 *
 * That is not a rendering defect that a screenshot can show. It is a *slope*,
 * and a slope is only visible if you play long enough for it to appear. So this
 * script plays. For fifteen minutes it walks between rifts with WASD, turns
 * with the arrow keys, answers the mathematics with the number row, builds
 * lattice, plants beacons, and never once teleports. It samples frame-time
 * percentiles every thirty seconds off `performance.now()` deltas — not off the
 * engine's own log, which the engine's own quality controller is a party to.
 *
 * WHAT IT ASSERTS  (all four must hold, or the gate fails)
 *
 *   1. the median frame rate over the final minutes is >= --fps (default 55)
 *   2. the end is no worse than 25% below the start — a game that opens at 140
 *      and ends at 60 has a leak even though 60 clears the floor. Both ends are
 *      the median of three thirty-second windows, so neither is one unlucky
 *      half-minute; see `ends`
 *   3. the effect tier at the end is the tier it reached at minute one: the
 *      reported failure is specifically an *auto-degrade*, and a controller
 *      that quietly spends the image to hold the frame rate has hidden the
 *      defect rather than fixed it
 *   4. nothing the session accumulates grows without bound — scene objects,
 *      live geometries, textures, shader programs, DOM nodes and net event
 *      listeners are all sampled, and any of them ending more than --growth
 *      (default 25%) above its minute-one value is a failure with a name
 *
 * The debug API is read ONLY, for facts: where the rifts are, what the answer
 * on the card is, what the counters say. Every input is a real key or a real
 * mouse press, from a cleared save. Same rule as coldplay.mjs, same reason.
 *
 *   node tools/critic/sustain.mjs --minutes 15
 *   tools/critic/sustain.sh shots/sustain --minutes 15      # frozen build
 *   node tools/critic/sustain.mjs --self-test
 *
 * Exit 0 = the game is still the game a quarter of an hour in.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const flag = (k) => process.argv.includes('--' + k);
const URL = arg('url', 'http://127.0.0.1:5173');
const MINUTES = Number(arg('minutes', 15));
const FPS_FLOOR = Number(arg('fps', 55));
const DROP_MAX = Number(arg('drop', 0.25));
const GROWTH_MAX = Number(arg('growth', 0.25));
const OUT = path.resolve(arg('out', 'shots/sustain'));
const SAMPLE_S = 30;

/** Counters that must not run away. name -> how it is described when it does. */
const BOUNDED = {
  sceneObjects: 'objects in the scene graph',
  geometries: 'live GPU geometries',
  textures: 'live GPU textures',
  programs: 'compiled shader programs',
  domNodes: 'DOM elements',
  listeners: 'net event listeners (added minus removed)',
  updaters: 'per-frame updaters registered on the engine',
  drawCalls: 'draw calls per frame',
};

// --------------------------------------------------------------- self test
//
// A gate that cannot fail is not a gate. The self-test at the bottom of this
// section runs `verdict` over fabricated sample sets — a healthy run, a run
// that decays, a run that holds its frame rate by burning the image down to
// 'low', a run that dips and recovers, and a run that leaks scene objects —
// and asserts it says the right thing about each.
/**
 * The two ends of the run, taken as the MEDIAN of three windows rather than as
 * one window each.
 *
 * A single thirty-second window is a real measurement of thirty seconds and a
 * poor measurement of a session: the last one in particular lands wherever the
 * play loop happened to stop, which may be mid-sprint through a dense biome
 * with a card opening. Taking the median of the first three and of the last
 * three costs nothing, removes that, and cannot hide a slope — a slope is
 * exactly what survives a median.
 */
function ends(samples) {
  const mid = (rows) => rows.slice().sort((a, b) => a.fps - b.fps)[Math.floor(rows.length / 2)];
  const n = Math.min(3, Math.max(1, Math.floor(samples.length / 3)));
  return { first: mid(samples.slice(0, n)), last: mid(samples.slice(-n)) };
}

function verdict(samples, { fpsFloor = FPS_FLOOR, dropMax = DROP_MAX, growthMax = GROWTH_MAX } = {}) {
  const fails = [];
  if (samples.length < 2) return { ok: false, fails: ['fewer than two samples: the run proved nothing'] };
  const { first, last } = ends(samples);
  // The tier and the cap are read off the very last window regardless: what
  // the player is looking at when they stop playing is not an average.
  const final = samples[samples.length - 1];

  if (last.fps < fpsFloor) {
    fails.push(`median fps in the final minutes is ${last.fps.toFixed(1)}, below the ${fpsFloor} floor`);
  }
  const RANK = ['low', 'medium', 'high'];
  const ti = (t) => RANK.indexOf(t);
  /* WHY THE ALLOWANCE IS A QUARTER AND NOT A TENTH.
     A session does not stand still. It starts on an empty landing plaza and by
     minute fifteen it is somewhere with a biome, a warden, three rifts and the
     player's own lattice in frame, and that frame is legitimately dearer than
     the first one — the fixed-camera benchmark reports a number no session can
     hold precisely because it never goes anywhere. A quarter is what walking
     into the expensive parts of this island costs. Losing two fifths of the
     frame rate, which is what the reported session did, is not a location.

     AND WHY IT DOES NOT APPLY TO A GAME THAT GOT BETTER LOOKING.
     Frame rate is only comparable between two frames drawing the same picture.
     A run that opens at 'low' on a machine that was briefly busy, recovers to
     'high' by minute nine and holds it is drawing a far dearer frame at the end
     than at the start, and its fps is *supposed* to be lower — that is the
     controller spending recovered headroom on the image, which is its job. So
     the decay bar is skipped when the quality state ENDS ABOVE where it began.
     Nothing is let through by this: a leak still trips the bounded counters, a
     genuinely slow game still trips the floor, and a degrade is already a
     failure two lines below. */
  const richer = ti(final.tier) > ti(first.tier) || final.pixelCap > first.pixelCap + 0.05;
  const drop = (first.fps - last.fps) / first.fps;
  if (drop > dropMax && !richer) {
    fails.push(`frame rate decayed ${(drop * 100).toFixed(0)}% over the session `
      + `(${first.fps.toFixed(1)} -> ${last.fps.toFixed(1)} fps), over the ${(dropMax * 100) | 0}% allowance`);
  }
  if (ti(final.tier) >= 0 && ti(first.tier) >= 0 && ti(final.tier) < ti(first.tier)) {
    fails.push(`the effect tier auto-degraded from '${first.tier}' to '${final.tier}' during play`);
  }
  /* The resolution cap is allowed to MOVE — that is the whole job of the
     controller, and a cap that never moves is a controller that is asleep.
     What is not allowed is for it to end pinned at its floor, which is the
     controller saying it has spent everything it has and still cannot hold the
     frame. That is the state the reported session was in for thirteen straight
     minutes. */
  const floor = Math.min(...samples.map((s) => s.pixelCap));
  if (final.pixelCap <= floor + 0.01 && final.pixelCap < first.pixelCap - 0.05) {
    fails.push(`the resolution cap ended pinned at its floor (${final.pixelCap.toFixed(2)}, from `
      + `${first.pixelCap.toFixed(2)}): the frame rate is being held by shrinking the image`);
  }
  for (const [k, label] of Object.entries(BOUNDED)) {
    const a = first[k], b = last[k];
    if (!Number.isFinite(a) || !Number.isFinite(b) || a <= 0) continue;
    const g = (b - a) / a;
    if (g > growthMax) fails.push(`${label} grew ${(g * 100).toFixed(0)}% (${a} -> ${b}) — unbounded accumulation`);
  }
  return { ok: fails.length === 0, fails };
}

if (flag('self-test')) {
  const base = { tier: 'high', pixelCap: 1.5, sceneObjects: 700, geometries: 210, textures: 17, programs: 125, domNodes: 1500, listeners: 160, updaters: 9, drawCalls: 140 };
  const cases = [
    ['a healthy run passes', [{ ...base, fps: 120 }, { ...base, fps: 114 }], true],
    ['a decaying run fails', [{ ...base, fps: 120 }, { ...base, fps: 70 }], false],
    ['a run that dips and comes back passes',
      [{ ...base, fps: 120 }, { ...base, fps: 62 }, { ...base, fps: 118 }], true],
    ['fps paid for a BETTER picture is not decay',
      [{ ...base, fps: 126, tier: 'low', pixelCap: 0.96 }, { ...base, fps: 92, tier: 'high', pixelCap: 1.5 }], true],
    ['…but the floor still applies to it',
      [{ ...base, fps: 126, tier: 'low', pixelCap: 0.96 }, { ...base, fps: 41, tier: 'high', pixelCap: 1.5 }], false],
    ['…and so do the counters',
      [{ ...base, fps: 126, tier: 'low', pixelCap: 0.96 }, { ...base, fps: 92, tier: 'high', pixelCap: 1.5, listeners: 2600 }], false],
    ['a run below the floor fails', [{ ...base, fps: 58 }, { ...base, fps: 44.9 }], false],
    ['a silent tier degrade fails even at good fps',
      [{ ...base, fps: 120 }, { ...base, fps: 118, tier: 'low' }], false],
    ['ending pinned at the resolution floor fails',
      [{ ...base, fps: 120 }, { ...base, fps: 118, pixelCap: 0.72 }], false],
    ['a cap that moves and recovers passes',
      [{ ...base, fps: 120 }, { ...base, fps: 100, pixelCap: 0.9 }, { ...base, fps: 118 }], true],
    ['a scene-graph leak fails', [{ ...base, fps: 120 }, { ...base, fps: 118, sceneObjects: 4200 }], false],
    ['a listener leak fails', [{ ...base, fps: 120 }, { ...base, fps: 118, listeners: 2600 }], false],
    ['one sample is not a run', [{ ...base, fps: 120 }], false],
  ];
  let bad = 0;
  for (const [name, s, want] of cases) {
    const got = verdict(s).ok;
    console.log(`${got === want ? '  ok  ' : ' FAIL '} ${name}`);
    if (got !== want) bad++;
  }
  console.log(bad ? `\nself-test FAILED (${bad})` : '\nself-test passed');
  process.exit(bad ? 1 : 0);
}

// ------------------------------------------------------------------ the run
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });

// Listener bookkeeping is installed before a line of the game runs, so nothing
// it does can hide a registration from the count.
await ctx.addInitScript(() => {
  window.__L = { add: 0, rm: 0 };
  const A = EventTarget.prototype.addEventListener, R = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (t, f, o) { window.__L.add++; return A.call(this, t, f, o); };
  EventTarget.prototype.removeEventListener = function (t, f, o) { window.__L.rm++; return R.call(this, t, f, o); };
});

const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.stack ? e.stack.split('\n').slice(0, 3).join(' | ') : e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4500);

// Frame times are taken from the page's own rAF cadence, independent of the
// engine's log — the engine's log is an input to the controller under test.
await page.evaluate(() => {
  window.__fr = [];
  const push = (t) => { window.__fr.push(t); if (window.__fr.length > 20000) window.__fr.splice(0, 10000); requestAnimationFrame(push); };
  requestAnimationFrame(push);
});

const facts = () => page.evaluate(() => {
  const a = window.__ascent;
  const p = a.player.pos;
  return {
    x: p.x, y: p.y, z: p.z, yaw: a.player.yaw,
    ui: !!a.input.uiOpen,
    panel: !!a.panel?.open,
    answer: (a.panel?.open && a.panel.item) ? String(a.panel.item.answer) : null,
    stuck: !!a.player.stuck,
  };
});

const nearestRift = () => page.evaluate(() => {
  const a = window.__ascent, p = a.player.pos;
  const r = (a.rifts?.list || []).filter((x) => !x.locked);
  let best = null, bd = 1e9;
  for (const x of r) {
    const d = Math.hypot(x.pos.x - p.x, x.pos.z - p.z);
    if (d < bd) { bd = d; best = x; }
  }
  return best ? { id: best.id, x: best.pos.x, z: best.pos.z, dist: bd } : null;
});

const measure = () => page.evaluate((SAMPLE_S) => {
  const a = window.__ascent;
  const info = a.engine.renderer.info;
  let objs = 0;
  a.engine.scene.traverse(() => { objs++; });
  const fr = window.__fr;
  const cut = performance.now() - SAMPLE_S * 1000;
  const d = [];
  for (let i = fr.length - 1; i > 0 && fr[i] > cut; i--) d.push(fr[i] - fr[i - 1]);
  d.sort((x, y) => x - y);
  const q = (p) => d.length ? d[Math.min(d.length - 1, Math.floor(d.length * p))] : 0;
  const st = a.state();
  return {
    t: performance.now() / 1000,
    frames: d.length,
    fps: q(0.5) ? 1000 / q(0.5) : 0,
    fps1Low: q(0.99) ? 1000 / q(0.99) : 0,
    p95: q(0.95),
    tier: st.fxTier,
    pixelCap: st.perf.pixelCap,
    pixelRatio: a.engine.renderer.getPixelRatio(),
    sceneObjects: objs,
    geometries: info.memory.geometries,
    textures: info.memory.textures,
    programs: info.programs ? info.programs.length : 0,
    drawCalls: info.render.calls,
    triangles: info.render.triangles,
    domNodes: document.getElementsByTagName('*').length,
    listeners: window.__L.add - window.__L.rm,
    updaters: a.engine.updaters.size,
    pieces: a.builder?.pieces?.size ?? 0,
    beacons: st.kit?.beacons ?? 0,
    heapMB: performance.memory ? +(performance.memory.usedJSHeapSize / 1048576).toFixed(1) : null,
  };
}, SAMPLE_S);

const release = async () => {
  for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'ShiftLeft', 'ArrowLeft', 'ArrowRight', 'Space']) {
    await page.keyboard.up(k).catch(() => {});
  }
};
const handBack = async () => {
  for (let i = 0; i < 5; i++) {
    if (!(await page.evaluate(() => !!window.__ascent.input.uiOpen))) return true;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(320);
  }
  return false;
};

/** Answer whatever card is up, with the keys a player has. */
async function answer() {
  const f = await facts();
  if (!f.panel || !f.answer) return false;
  const opts = await page.$$('.rf-opt, .rf-choice button, .rf-choices button');
  if (opts.length) {
    const want = f.answer.replace(/\s+/g, '');
    let pick = null;
    for (const o of opts) { if ((await o.innerText()).replace(/\s+/g, '') === want) { pick = o; break; } }
    await (pick || opts[0]).click().catch(() => {});
  } else {
    for (const ch of f.answer) {
      if (ch === '-') await page.keyboard.press('Minus');
      else if (ch === '/') await page.keyboard.press('Slash');
      else if (ch === '.') await page.keyboard.press('Period');
      else await page.keyboard.press(ch).catch(() => {});
      await page.waitForTimeout(35);
    }
    await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(1400);
  return true;
}

/** Walk to a rift with W and the arrow keys. No teleport, no mouse aiming. */
async function walkTo(target, budgetMs) {
  const t0 = Date.now();
  let held = false;
  while (Date.now() - t0 < budgetMs) {
    const f = await facts();
    if (f.panel) { if (held) { await page.keyboard.up('KeyW'); held = false; } return 'panel'; }
    if (f.ui) { if (held) { await page.keyboard.up('KeyW'); held = false; } await handBack(); continue; }
    if (f.stuck) { await release(); await page.keyboard.press('KeyR'); await page.waitForTimeout(800); held = false; continue; }
    const dx = target.x - f.x, dz = target.z - f.z;
    const dist = Math.hypot(dx, dz);
    if (dist < 5) { if (held) { await page.keyboard.up('KeyW'); held = false; } return 'arrived'; }
    let d = ((Math.atan2(dx, dz) - f.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (d < -Math.PI) d += Math.PI * 2;
    if (!held) { await page.keyboard.down('KeyW'); held = true; }
    if (Math.abs(d) > 0.10) {
      const key = d > 0 ? 'ArrowLeft' : 'ArrowRight';
      await page.keyboard.down(key);
      await page.waitForTimeout(Math.min(380, Math.max(50, Math.abs(d) / 2.6 * 1000)));
      await page.keyboard.up(key);
    } else {
      await page.keyboard.down('ShiftLeft');
      await page.waitForTimeout(160);
    }
  }
  if (held) await page.keyboard.up('KeyW');
  return 'timeout';
}

console.log(`playing for ${MINUTES} minutes at ${URL}\n`);
const samples = [];
const t0 = Date.now();
let nextSample = SAMPLE_S * 1000;
let items = 0, walks = 0, builds = 0;

await page.mouse.click(800, 450);
await handBack();

while (Date.now() - t0 < MINUTES * 60000) {
  const elapsed = () => Date.now() - t0;

  if (elapsed() > nextSample) {
    const s = await measure();
    samples.push(s);
    nextSample += SAMPLE_S * 1000;
    const m = (s.t / 60);
    console.log(`  ${m.toFixed(1).padStart(5)}m  ${s.fps.toFixed(1).padStart(6)} fps median  `
      + `1%low ${s.fps1Low.toFixed(1).padStart(5)}  tier ${String(s.tier).padEnd(6)} cap ${s.pixelCap.toFixed(2)}  `
      + `scene ${String(s.sceneObjects).padStart(5)} geo ${String(s.geometries).padStart(4)} tex ${String(s.textures).padStart(3)} `
      + `prog ${String(s.programs).padStart(3)} dom ${String(s.domNodes).padStart(5)} lis ${String(s.listeners).padStart(5)} `
      + `draws ${String(s.drawCalls).padStart(4)}  pieces ${s.pieces} beacons ${s.beacons} heap ${s.heapMB}`);
    if (Math.abs(m - 1) < 0.5 || Math.abs(m - 8) < 0.5 || m > MINUTES - 1)
      await page.screenshot({ path: path.join(OUT, `min-${Math.round(m)}.png`) }).catch(() => {});
  }

  await handBack();
  const target = await nearestRift();
  if (!target) { await page.waitForTimeout(500); continue; }

  const got = await walkTo(target, 45000);
  walks++;
  if (got === 'arrived') {
    for (const k of ['KeyE', 'Enter']) {
      await page.keyboard.press(k);
      await page.waitForTimeout(450);
      if (await page.evaluate(() => !!window.__ascent.panel?.open)) break;
    }
  }
  await release();

  // Three items per arrival is the game's own rhythm (src/session/stint.js).
  for (let n = 0; n < 3; n++) {
    if (!(await page.evaluate(() => !!window.__ascent.panel?.open))) break;
    if (await answer()) items++; else break;
    await page.waitForTimeout(500);
  }
  await handBack();

  // What a player does between rifts: build a little, plant a beacon, look
  // around. Every one of these leaves something behind in the world, which is
  // the whole point of a gate that measures minute fifteen.
  await page.mouse.click(800, 450).catch(() => {});
  for (let k = 0; k < 5; k++) {
    await page.mouse.click(640 + k * 90, 420 + (k % 2) * 60).catch(() => {});
    builds++;
    await page.waitForTimeout(140);
  }
  await page.keyboard.press('KeyG');   // plant a beacon
  await page.waitForTimeout(200);
  await page.keyboard.press('KeyF');   // flare
  await page.waitForTimeout(200);
  await handBack();
}

await release();
const final = await measure();
samples.push(final);
await page.screenshot({ path: path.join(OUT, 'final.png') }).catch(() => {});

const v = verdict(samples);
const { first, last } = ends(samples);
const at = (m) => samples.reduce((a, b) => (Math.abs(b.t / 60 - m) < Math.abs(a.t / 60 - m) ? b : a));
console.log(`\nplayed ${walks} approaches, ${items} items, ${builds} build presses`);
for (const m of [1, 8, MINUTES]) {
  const s = at(m);
  console.log(`  minute ${String(m).padStart(2)}: ${s.fps.toFixed(1).padStart(6)} fps median, `
    + `1% low ${s.fps1Low.toFixed(1)}, tier ${s.tier}, cap ${s.pixelCap.toFixed(2)}`);
}
console.log(`  start/end (median of ${Math.min(3, Math.max(1, Math.floor(samples.length / 3)))} windows each): `
  + `${first.fps.toFixed(1)} -> ${last.fps.toFixed(1)} fps`);
if (errors.length) console.log(`\n${errors.length} console error(s):`, errors.slice(0, 4).join('\n  '));

await writeFile(path.join(OUT, 'sustain.json'),
  JSON.stringify({ url: URL, minutes: MINUTES, samples, verdict: v, errors, items, walks }, null, 2));

if (!v.ok) {
  console.log('\nTHE GAME IS NOT THE GAME IT WAS AT SECOND FIVE:');
  v.fails.forEach((f) => console.log('  - ' + f));
} else {
  console.log('\nsustained: the frame rate, the tier and every accumulating counter held.');
}
if (errors.length) console.log('  - ' + errors.length + ' console error(s) during play');
await browser.close();
process.exit(v.ok && errors.length === 0 ? 0 : 1);
