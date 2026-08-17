/**
 * Honest frame benchmark: one page, one GPU, a scripted play loop.
 * Reports median ms, p95 ms, implied median fps and the 1% low.
 *
 * IT NOW REPORTS THE NUMBER TWICE, AND THE SECOND ONE IS THE REAL ONE.
 *
 * Every frame-rate figure this repo ever quoted came from the block below: load
 * the page, wait three seconds, teleport to four fixed spots, sprint on the
 * spot for 2.6 s at each. That is a measurement of a scene at SECOND FIVE — one
 * that has never had a card opened in it, never had a shader compiled for a
 * biome it has not reached, and never had a quality controller make a decision
 * about it. It is the cheapest this game will ever be, and it is not a number
 * any player ever sees.
 *
 * A player reported the other one: "after 18 minutes of real play the game had
 * auto-degraded to fxTier 'low' at 44.9 fps on an M4, not the 91.7 the
 * benchmark reports." Both numbers were true. The benchmark was measuring the
 * wrong minute, and because the standard capture never looked past second five,
 * a controller that sank to its floor at minute two and stayed there for the
 * next thirteen minutes was invisible to every gate in the repo.
 *
 * So the run is now: measure the four spots cold, PLAY for --minutes (default
 * 15) with real keys, then measure THE SAME FOUR SPOTS AGAIN. Identical camera,
 * identical scene, identical work — the only difference is that a session
 * happened in between, so the delta is the session and nothing else. The cold
 * number is kept and labelled, because it is still the right way to compare two
 * GPUs; it is simply not the right way to describe the game.
 *
 *   node tools/critic/bench.mjs                 # cold + minute 15
 *   node tools/critic/bench.mjs --minutes 3     # a quicker look
 *   node tools/critic/bench.mjs --cold-only     # the old behaviour
 *
 * Exits non-zero if the sustained pass is more than --decay (default 25%) below
 * the cold pass, or if the effect tier ended below where it started.
 */
import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const MINUTES = Number(arg('minutes', 15));
const DECAY = Number(arg('decay', 0.25));
const COLD_ONLY = process.argv.includes('--cold-only');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[err]', e.message.slice(0, 160)));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(3500);

await page.evaluate(() => {
  window.__frames = [];
  const push = () => { window.__frames.push(performance.now()); requestAnimationFrame(push); };
  requestAnimationFrame(push);
});

const spots = [
  ['plaza',  () => { const a = window.__ascent; a.player.pos.set(0, (a.player.groundAt(0, 26) ?? 12) + 0.4, 26); a.player.vel.set(0,0,0); a.player.yaw = Math.PI; a.player.pitch = -0.14; }],
  ['sunward',() => { const a = window.__ascent, s = a.world.sunDir; a.player.pos.set(-18, (a.player.groundAt(-18,30) ?? 12) + 0.4, 30); a.player.vel.set(0,0,0); a.player.yaw = Math.atan2(s.x, s.z); a.player.pitch = 0.12; }],
  ['vista',  () => { const a = window.__ascent; a.player.pos.set(0, 62, 120); a.player.vel.set(0,0,0); a.player.yaw = Math.PI; a.player.pitch = -0.30; }],
  ['grove',  () => { const a = window.__ascent; a.player.pos.set(40, (a.player.groundAt(40,-30) ?? 12) + 0.4, -30); a.player.vel.set(0,0,0); a.player.yaw = 0.9; a.player.pitch = -0.05; }],
];

/**
 * One sweep of the four spots. Called twice — cold, and again after a session —
 * so the two numbers differ by the session and by nothing else.
 */
async function sweep(label) {
  console.log(`\n--- ${label} ---`);
  const rows = [];
  for (const [name, fn] of spots) {
    await page.evaluate(fn);
    await page.waitForTimeout(900);
    await page.evaluate(() => { window.__frames.length = 0; });
    // sprint on the spot so grass/dust/animation are all live
    await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
    await page.waitForTimeout(2600);
    await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
    const r = await page.evaluate(() => {
      const f = window.__frames; const d = [];
      for (let i = 1; i < f.length; i++) d.push(f[i] - f[i - 1]);
      d.sort((a, b) => a - b);
      const q = (p) => d[Math.min(d.length - 1, Math.floor(d.length * p))];
      const a = window.__ascent, info = a.engine.renderer.info;
      let objs = 0; a.engine.scene.traverse(() => { objs++; });
      return {
        n: d.length, med: q(0.5), p95: q(0.95), p99: q(0.99),
        scale: a.fx.renderScale, dpr: a.engine.renderer.getPixelRatio(),
        tier: a.state().fxTier, cap: a.state().perf.pixelCap,
        objs, geo: info.memory.geometries, tex: info.memory.textures,
        draws: info.render.calls, dom: document.getElementsByTagName('*').length,
        listeners: window.__L ? window.__L.add - window.__L.rm : null,
      };
    });
    rows.push([name, r]);
    console.log(name.padEnd(9),
      'median', r.med.toFixed(2) + 'ms', '=', (1000 / r.med).toFixed(1) + 'fps  ',
      'p95', r.p95.toFixed(1) + 'ms  ',
      '1%low', (1000 / r.p99).toFixed(1) + 'fps  ',
      'scale', r.scale.toFixed(2), 'dpr', r.dpr.toFixed(2));
  }
  const all = rows.map(([, r]) => r.med);
  const med = all.reduce((a, b) => a + b) / all.length;
  const last = rows[rows.length - 1][1];
  console.log(`MEDIAN ACROSS SPOTS: ${med.toFixed(2)}ms = ${(1000 / med).toFixed(1)}fps  `
    + `tier ${last.tier} cap ${last.cap.toFixed(2)}  scene ${last.objs} geo ${last.geo} `
    + `tex ${last.tex} draws ${last.draws} dom ${last.dom} listeners ${last.listeners}`);
  return { med, fps: 1000 / med, rows, state: last };
}

const cold = await sweep('COLD — second five (what this benchmark used to report, and only this)');

if (COLD_ONLY) { await browser.close(); process.exit(0); }

/* ------------------------------------------------------------ the session
   Real keys, no teleport. The camera work above is allowed to teleport because
   it is deliberately measuring one fixed frame twice; the PLAY between the two
   measurements must not, because teleporting past the world is exactly how a
   session avoids accumulating the thing we are trying to measure. */
console.log(`\nplaying for ${MINUTES} minutes…`);
const t0 = Date.now();
let laps = 0;
await page.mouse.click(800, 450);
while (Date.now() - t0 < MINUTES * 60000) {
  await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(2200);
  const turn = laps % 2 ? 'ArrowRight' : 'ArrowLeft';
  await page.keyboard.down(turn); await page.waitForTimeout(260); await page.keyboard.up(turn);
  await page.waitForTimeout(1800);
  await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
  // open whatever is in reach, answer it if it opened, and hand the game back
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(500);
  const ans = await page.evaluate(() => {
    const p = window.__ascent.panel;
    return (p?.open && p.item) ? String(p.item.answer) : null;
  });
  if (ans) {
    for (const ch of ans) {
      if (ch === '-') await page.keyboard.press('Minus');
      else if (ch === '/') await page.keyboard.press('Slash');
      else if (ch === '.') await page.keyboard.press('Period');
      else await page.keyboard.press(ch).catch(() => {});
      await page.waitForTimeout(35);
    }
    await page.keyboard.press('Enter');
    await page.waitForTimeout(1200);
  }
  for (let i = 0; i < 3; i++) {
    if (!(await page.evaluate(() => !!window.__ascent.input.uiOpen))) break;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
  }
  laps++;
  if ((Date.now() - t0) % 60000 < 4500) {
    const s = await page.evaluate(() => {
      const a = window.__ascent; let o = 0; a.engine.scene.traverse(() => { o++; });
      return { m: 0, tier: a.state().fxTier, cap: a.state().perf.pixelCap, o,
               draws: a.engine.renderer.info.render.calls, dom: document.getElementsByTagName('*').length };
    });
    console.log(`  ${((Date.now() - t0) / 60000).toFixed(1)}m  tier ${String(s.tier).padEnd(6)} `
      + `cap ${s.cap.toFixed(2)}  scene ${s.o} draws ${s.draws} dom ${s.dom}`);
  }
}
for (const k of ['KeyW', 'ShiftLeft', 'ArrowLeft', 'ArrowRight']) await page.keyboard.up(k).catch(() => {});

const warm = await sweep(`SUSTAINED — minute ${MINUTES}, same four spots, same camera`);

// ------------------------------------------------------------------ verdict
const RANK = ['low', 'medium', 'high'];
const decay = (cold.fps - warm.fps) / cold.fps;
console.log('\n================ THE NUMBER THIS GAME ACTUALLY RUNS AT ================');
console.log(`  cold (second 5) : ${cold.fps.toFixed(1)} fps   tier ${cold.state.tier} cap ${cold.state.cap.toFixed(2)}`);
console.log(`  after ${String(MINUTES).padStart(2)} minutes: ${warm.fps.toFixed(1)} fps   tier ${warm.state.tier} cap ${warm.state.cap.toFixed(2)}`);
console.log(`  decay           : ${(decay * 100).toFixed(1)}%  (allowance ${(DECAY * 100) | 0}%)`);
console.log(`  accumulated     : scene ${cold.state.objs}->${warm.state.objs}  geo ${cold.state.geo}->${warm.state.geo}  `
  + `draws ${cold.state.draws}->${warm.state.draws}  dom ${cold.state.dom}->${warm.state.dom}`);

const fails = [];
if (decay > DECAY) {
  fails.push(`the frame rate decayed ${(decay * 100).toFixed(1)}% between second five and minute ${MINUTES} `
    + `(${cold.fps.toFixed(1)} -> ${warm.fps.toFixed(1)} fps) on the SAME four camera positions`);
}
if (RANK.indexOf(warm.state.tier) >= 0 && RANK.indexOf(warm.state.tier) < RANK.indexOf(cold.state.tier)) {
  fails.push(`the effect tier auto-degraded from '${cold.state.tier}' to '${warm.state.tier}' during play`);
}
if (fails.length) {
  console.log('\nSUSTAINED BENCHMARK FAILED:');
  fails.forEach((f) => console.log('  - ' + f));
} else {
  console.log('\nthe number at minute ' + MINUTES + ' is the number at second five.');
}
await browser.close();
process.exit(fails.length ? 1 : 0);
