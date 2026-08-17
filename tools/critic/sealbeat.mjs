/**
 * THE SEAL BEAT, photographed.
 *
 * The one moment this whole product is built around: a hard question answered,
 * the statement written across the sky, and the world agreeing with it. Two
 * systems have to arrive on the same frame — `Stings.seal()` in src/audio and
 * `fx.seal()` in src/fx — and nothing in this repo could see whether they did.
 *
 * So: a cold start, a walk to a tear on real keys, a real click or real
 * keystrokes on the real card, and then a burst of screenshots across the two
 * seconds after the answer lands. Nothing is teleported and no rift is opened
 * through the debug API. The only thing read out of the game is what the
 * expected answer is, so the script knows which key a hand would press.
 *
 *   node tools/critic/sealbeat.mjs --url http://127.0.0.1:5173 --out shots/seal
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/seal'));
const WRONG = process.argv.includes('--wrong');
await mkdir(OUT, { recursive: true });

const W = 1600, H = 900;
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch { /* private */ } });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(3500);

try {
  await page.waitForSelector('.sc-go', { timeout: 6000 });
  await page.locator('.sc-go').click();
  await page.waitForTimeout(700);
} catch { /* no charter card on this path */ }

const panelOpen = () => page.evaluate(() => !!window.__ascent.panelInfo?.().open);

/** Walk with real keys and knock with the real interact key. */
async function walkAndKnock(budgetMs = 60000) {
  const t0 = Date.now();
  await page.mouse.click(W / 2, H / 2);
  await page.waitForTimeout(250);
  await page.keyboard.press('KeyE');
  if (await panelOpen()) return true;
  let held = false;
  const forward = async (on) => {
    if (on === held) return;
    held = on;
    if (on) await page.keyboard.down('KeyW'); else await page.keyboard.up('KeyW');
  };
  let mx = W / 2;
  try {
    while (Date.now() - t0 < budgetMs) {
      const w = await page.evaluate(() => {
        const mark = document.querySelector('.gd-mark');
        if (!mark || !mark.classList.contains('show')) return null;
        const r = mark.getBoundingClientRect();
        return { x: r.left + r.width / 2, edge: mark.classList.contains('edge') };
      });
      if (w) {
        const off = w.x - W / 2;
        if (Math.abs(off) > 40 || w.edge) {
          const step = Math.max(-160, Math.min(160, off * (w.edge ? 1.6 : 0.7))) || 120;
          mx = Math.max(4, Math.min(W - 4, mx + step));
          await page.mouse.move(mx, H / 2);
          if (mx <= 8 || mx >= W - 8) mx = W / 2;
        }
      }
      await forward(true);
      for (let j = 0; j < 4; j++) {
        await page.waitForTimeout(150);
        await page.keyboard.press('KeyE');
        if (await panelOpen()) { await forward(false); return true; }
      }
      if (!w) { mx = mx > W / 2 ? W / 2 - 150 : W / 2 + 150; await page.mouse.move(mx, H / 2); }
    }
  } finally { await forward(false); }
  return false;
}

if (!(await walkAndKnock())) {
  console.log('FAIL: could not reach and open a tear on real keys');
  await browser.close();
  process.exit(1);
}
await page.waitForTimeout(1200);
await page.screenshot({ path: path.join(OUT, '00-card.png') });

const c = await page.evaluate(() => window.__ascent.panelInfo());
console.log('card:', c.mode, 'skill', c.skill || '?');

/** Deliver the answer with real input, and return the instant it was given. */
async function deliver() {
  if (c.mode === 'choice') {
    const btns = page.locator('.rf-reading');
    const n = await btns.count();
    for (let i = 0; i < n; i++) {
      const v = await btns.nth(i).getAttribute('data-value');
      if ((String(v) === String(c.answer)) !== WRONG) { await btns.nth(i).click({ timeout: 5000 }); return true; }
    }
    return false;
  }
  if (c.mode === 'keypad') {
    let s = String(c.answer ?? '');
    if (WRONG) s = /^-?\d+$/.test(s) ? String(Number(s) + 1) : s + '1';
    if (!s) return false;
    for (const ch of s) {
      if (ch === '-') await page.keyboard.press('Minus');
      else if (ch === '/') await page.keyboard.press('Slash');
      else if (ch === '+') await page.keyboard.press('Equal');
      else if (ch === '^') await page.keyboard.press('Digit6');
      else await page.keyboard.press(ch);
      await page.waitForTimeout(40);
    }
    await page.keyboard.press('Enter');
    return true;
  }
  const any = page.locator('.rf-move, .rf-chip, .rf-bay, .ans').first();
  if (await any.count()) { await any.click({ timeout: 5000 }); return true; }
  return false;
}

// Watch the seal uniform itself across the beat, sampled off the live material,
// so the picture and the number come from the same frames.
await page.evaluate(() => {
  window.__seal = [];
  const g = window.__ascent.fx.passes.grade.uniforms;
  const t0 = performance.now();
  const tick = () => {
    window.__seal.push([+(performance.now() - t0).toFixed(0), +g.uSeal.value.toFixed(3), +g.uFocusBlend.value.toFixed(3)]);
    if (performance.now() - t0 < 4000) requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

// The world, not the card. The rift's own surface owns the middle of the frame
// at this moment by design, so the evidence for a light beat has to come off
// the parts of the island the card is not standing in front of.
const STRIP = { x: 0, y: 0, width: 470, height: 900 };
await page.screenshot({ path: path.join(OUT, 'world-ref.png'), clip: STRIP });

if (!(await deliver())) { console.log('FAIL: no way to answer this card'); await browser.close(); process.exit(1); }

// The burst. 0.20 s is the downbeat the chord lands on and the frame the light
// is supposed to peak on.
const marks = [60, 200, 400, 800, 1500, 2600];
let last = 0;
for (const ms of marks) {
  await page.waitForTimeout(ms - last);
  last = ms;
  const tag = String(ms).padStart(4, '0');
  await page.screenshot({ path: path.join(OUT, `world-${tag}ms.png`), clip: STRIP });
  await page.screenshot({ path: path.join(OUT, `seal-${tag}ms.png`) });
}

const trace = await page.evaluate(() => window.__seal);
const peak = trace.reduce((a, b) => (b[1] > a[1] ? b : a), [0, 0, 0]);
console.log('uSeal peak', peak[1], 'at', peak[0], 'ms of the trace');
console.log('focus at peak', peak[2]);
await writeFile(path.join(OUT, 'seal.json'), JSON.stringify({ card: c.mode, peak, trace, errors }, null, 2));
console.log(errors.length ? `CONSOLE ERRORS: ${errors.length}\n${errors.slice(0, 3).join('\n')}` : 'no console errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
