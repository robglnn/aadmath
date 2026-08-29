/**
 * WHERE IS THE HARD BLACK COMING FROM?
 *
 * The critic's complaint is a claim about pixels — "roughly 35% of the frame
 * covered in hard black stair-stepped shadow acne" — so this measures pixels,
 * and then takes the frame apart a term at a time until the black moves.
 *
 * Two numbers per frame:
 *   crushed   fraction of the frame at or below luminance 12/255. Not "dark":
 *             a night sky is dark. This is *crushed* — no detail survives.
 *   staircase fraction of pixels that are a one-pixel dark notch between two
 *             much brighter neighbours in x or y. That is what an aliased edge
 *             looks like to a counter, and what a genuinely dark object does
 *             not do.
 *
 * Every configuration is photographed from the SAME camera, so the only thing
 * that can move the numbers is the term being switched.
 *
 *   node scratch/perf/acne.mjs --url http://127.0.0.1:5173 --out shots/acne
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/acne'));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
         '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('  ! ' + e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(4000);

/* THE SESSION OPENS ON A CARD, AND THE CARD IS NOT THE FRAME.
   The first version of this probe photographed the Orders panel nine times and
   reported 0.8% crushed black with great confidence — a number about a piece of
   UI. Dismiss whatever is on screen with real input, the way a player would,
   and only then photograph the world. */
for (let i = 0; i < 6; i++) {
  const btn = await page.$('button:visible, .ord-go:visible, [data-go]:visible');
  const open = await page.evaluate(() => {
    const el = document.querySelector('.ord, .charter, .rift, .meta-open, .session-card');
    return !!(el && getComputedStyle(el).display !== 'none' && el.offsetParent !== null);
  }).catch(() => false);
  if (!open) break;
  if (btn) await btn.click().catch(() => {});
  else await page.keyboard.press('Enter');
  await page.waitForTimeout(900);
}
await page.keyboard.press('Escape').catch(() => {});
await page.waitForTimeout(600);
await page.mouse.click(800, 450);
await page.waitForTimeout(1200);
// and prove it: if a panel still covers the middle of the screen, say so rather
// than quietly measuring it
const covered = await page.evaluate(() => {
  const el = document.elementFromPoint(innerWidth / 2, innerHeight * 0.62);
  return el ? (el.tagName.toLowerCase() + '.' + (el.className || '').toString().split(' ')[0]) : '?';
});
console.log(`what is under the middle of the frame: ${covered}`);

/* Cameras chosen for what they put on screen, not for prettiness: ground in
   the near field (where the contact term is clamped wide open), a cliff face
   turned away from a 22-degree sun, and the plaza the perf pass measures. */
const CAMS = {
  plaza:  { x: 0,  z: 26,  yaw: Math.PI, pitch: -0.14 },
  ground: { x: 0,  z: 26,  yaw: Math.PI, pitch: -0.55 },
  shade:  { x: 0,  z: 26,  yaw: 0.35,    pitch: -0.22 },
};

/** Terms that can be switched from outside the shader, and nothing else. */
const SETUPS = {
  'as-shipped':     {},
  'no-contact':     { uContact: 0 },
  'no-vignette':    { uVignette: 0 },
  'no-blackpoint':  { uBlackPoint: 0 },
  'no-contrast':    { uContrast: 0 },
};

async function frame(label, cam, tier, cap, over) {
  await page.evaluate(async ({ cam, tier, cap, over }) => {
    const a = window.__ascent;
    a.engine.quality.enabled = false;             // hold the knobs still for the photograph
    a.player.pos.set(cam.x, (a.player.groundAt(cam.x, cam.z) ?? 12) + 0.4, cam.z);
    a.player.vel.set(0, 0, 0); a.player.yaw = cam.yaw; a.player.pitch = cam.pitch;
    a.fx.setTier(tier);
    a.engine.quality.cap = cap;
    a.engine.applyPixelRatio();
    window.__save = window.__save || {};
    const u = a.fx.passes.grade.uniforms;
    for (const k of Object.keys(over)) { if (!(k in window.__save)) window.__save[k] = u[k].value; }
    // put everything back first, so setups do not stack
    for (const k of Object.keys(window.__save)) u[k].value = window.__save[k];
    for (const [k, v] of Object.entries(over)) u[k].value = v;
    await new Promise((r) => setTimeout(r, 1400));
  }, { cam, tier, cap, over });
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(OUT, `${label}.png`) });
  const s = await page.evaluate(() => {
    const c = document.querySelector('canvas');
    const w = 800, h = 450;
    const cv = document.createElement('canvas'); cv.width = w; cv.height = h;
    const x = cv.getContext('2d');
    x.drawImage(c, 0, 0, w, h);
    const d = x.getImageData(0, 0, w, h).data;
    const L = (i) => 0.2126 * d[i] + 0.7152 * d[i + 1] + 0.0722 * d[i + 2];
    let crushed = 0, stair = 0, n = 0;
    for (let y = 1; y < h - 1; y++) for (let px = 1; px < w - 1; px++) {
      const i = (y * w + px) * 4; const l = L(i); n++;
      if (l <= 12) crushed++;
      const a1 = L(i - 4), a2 = L(i + 4), b1 = L(i - w * 4), b2 = L(i + w * 4);
      if ((a1 - l > 26 && a2 - l > 26) || (b1 - l > 26 && b2 - l > 26)) stair++;
    }
    const a = window.__ascent;
    return { crushed: crushed / n, stair: stair / n, tier: a.state().fxTier,
             pr: a.engine.renderer.getPixelRatio() };
  });
  console.log(`${label.padEnd(34)} tier ${s.tier.padEnd(6)} pr ${s.pr.toFixed(2)}  `
    + `crushed ${(s.crushed * 100).toFixed(1).padStart(5)}%  staircase ${(s.stair * 100).toFixed(2).padStart(5)}%`);
  return { label, ...s };
}

const rows = [];
console.log('\n-- the two ends of the resolution cap, as shipped --');
for (const [cn, cam] of Object.entries(CAMS)) {
  for (const [tier, cap] of [['high', 1.5], ['high', 0.72], ['low', 0.72]]) {
    rows.push(await frame(`${cn}--${tier}-cap${cap}`, cam, tier, cap, {}));
  }
}
console.log('\n-- which term owns the black? (ground camera, degraded end) --');
for (const [name, over] of Object.entries(SETUPS)) {
  rows.push(await frame(`attribution--${name}`, CAMS.ground, 'low', 0.72, over));
}
await writeFile(path.join(OUT, 'acne.json'), JSON.stringify(rows, null, 2));
await browser.close();
