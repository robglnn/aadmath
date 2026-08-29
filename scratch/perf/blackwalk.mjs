/**
 * Is there ANY frame of real play with a third of it in hard black?
 *
 * Three fixed cameras can always be accused of not looking where the fault is.
 * So this walks the island with real keys for a few minutes, photographs the
 * frame every fifteen seconds wherever the cadet happens to be, and reports the
 * WORST frame it found — at the top of the quality ladder and at the bottom of
 * it, because the claim is specifically that the fault worsens as the tier
 * degrades.
 *
 *   node scratch/perf/blackwalk.mjs --url … --out shots/blackwalk --minutes 3
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/blackwalk'));
const MIN = Number(arg('minutes', 3));
await mkdir(OUT, { recursive: true });

const W = 1600, H = 900;
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
         '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(4000);

// Dismiss the opening card with real input; the card is not the frame.
for (let i = 0; i < 6; i++) {
  const open = await page.evaluate(() => {
    const el = document.querySelector('.ord, .charter, .rift, .meta-open');
    return !!(el && el.offsetParent !== null);
  }).catch(() => false);
  if (!open) break;
  const btn = await page.$('button:visible');
  if (btn) await btn.click().catch(() => {}); else await page.keyboard.press('Enter');
  await page.waitForTimeout(800);
}
await page.mouse.click(W / 2, H / 2);

const shots = [];
async function grab(tag) {
  const f = path.join(OUT, `${tag}.png`);
  await page.screenshot({ path: f });
  const st = await page.evaluate(() => {
    const a = window.__ascent;
    const s = a.state();
    return { tier: s.fxTier, cap: s.perf.pixelCap, pr: a.engine.renderer.getPixelRatio(),
             panel: !!(a.panel && a.panel.open) };
  });
  shots.push({ f, tag, ...st });
}

async function walk(seconds, tag) {
  const t0 = Date.now(); let n = 0, laps = 0;
  while (Date.now() - t0 < seconds * 1000) {
    await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
    await page.waitForTimeout(2400);
    const turn = laps % 3 === 0 ? 'ArrowRight' : 'ArrowLeft';
    await page.keyboard.down(turn); await page.waitForTimeout(300 + (laps % 4) * 120); await page.keyboard.up(turn);
    await page.waitForTimeout(1400);
    await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
    await page.waitForTimeout(400);
    // do not photograph a card; the card is UI, and UI is not shadow acne
    const onCard = await page.evaluate(() => !!(window.__ascent.panel && window.__ascent.panel.open));
    if (!onCard) await grab(`${tag}-${String(++n).padStart(2, '0')}`);
    laps++;
  }
}

console.log('walking at the top of the ladder…');
await walk(MIN * 30, 'top');
// …and pinned at the bottom of it, which is where the complaint says it is worst
await page.evaluate(() => {
  const a = window.__ascent;
  a.engine.quality.enabled = false;
  a.fx.setTier('low');
  a.engine.quality.cap = a.engine.quality.floor;
  a.engine.applyPixelRatio();
});
console.log('walking pinned at the bottom of the ladder…');
await walk(MIN * 30, 'floor');
await browser.close();

console.log(`\n${shots.length} frames -> ${OUT}`);
for (const s of shots) console.log(`  ${s.tag}  tier ${s.tier}  cap ${s.cap.toFixed(2)}  pr ${s.pr.toFixed(2)}`);
console.log('\nnow: node scratch/perf/blackcount.mjs ' + OUT);
