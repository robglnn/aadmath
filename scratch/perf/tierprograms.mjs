/**
 * Does changing the effect tier compile a shader?
 *
 * three keeps a compiled program per material per program-cache-key and only
 * releases them when the material is disposed, so a `#define` that the quality
 * controller moves during play is a program the session never gets back — and
 * the compile itself is a main-thread stall that lands in the p95 the same
 * controller is reading. Walk the tiers and count.
 *
 *   node scratch/perf/tierprograms.mjs --url http://127.0.0.1:5311
 */
import { chromium } from 'playwright';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');

const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 } });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await p.waitForTimeout(4000);

const walk = await p.evaluate(async () => {
  const a = window.__ascent;
  a.engine.quality.enabled = false;          // we are driving the tier, not it
  const count = () => a.engine.renderer.info.programs.length;
  const frame = () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r)));
  // Wait for the WORLD to stop compiling before blaming the tier for anything.
  // Materials compile the first time something is drawn, and the island is
  // still finding things to draw several seconds after the game says it is up;
  // a baseline taken at four seconds credits the tier with thirty programs the
  // island was going to compile anyway.
  let last = -1, still = 0, waited = 0;
  while (still < 40 && waited < 1200) {
    await frame(); waited++;
    const n = count();
    still = (n === last) ? still + 1 : 0;
    last = n;
  }
  const out = [];
  const start = count();
  // Two full round trips of the ladder, which is roughly what a bad ten
  // minutes used to do to a session.
  for (const t of ['medium', 'low', 'medium', 'high', 'low', 'high']) {
    a.fx.setTier(t);
    for (let i = 0; i < 6; i++) await frame();
    out.push([t, count()]);
  }
  return { start, out, tier: a.state().fxTier };
});

console.log(`programs at rest: ${walk.start}`);
for (const [t, n] of walk.out) console.log(`  -> ${t.padEnd(7)} ${n}${n > walk.start ? `   (+${n - walk.start})` : ''}`);
const end = walk.out[walk.out.length - 1][1];
const firstLap = walk.out[2][1];        // after high -> medium -> low
const total = end - walk.start;
// The bar is not "compiles nothing ever" — the grade material legitimately
// keeps a second program because the bottom tier turns FXAA off, which makes
// it the pass that writes to the screen rather than to a linear target, and
// three compiles per output colour space. The bar is that it is BOUNDED: once
// the ladder has been walked once, walking it again must cost nothing, because
// a session walks it many times and every program is held for good.
const unbounded = end - firstLap;
console.log(`\nfirst walk down the ladder: +${firstLap - walk.start}   every walk after that: +${unbounded}`);
console.log(unbounded === 0
  ? `ok   the tier ladder is bounded (total +${total} and it stops)`
  : `FAIL the tier ladder keeps compiling: +${unbounded} more on the second walk`);
errs.slice(0, 5).forEach((e) => console.log('  ! ' + e));
await b.close();
process.exit(unbounded === 0 && !errs.length ? 0 : 1);
