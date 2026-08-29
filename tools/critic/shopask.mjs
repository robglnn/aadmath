/**
 * THE SHOP ASKS. It does not answer.
 *
 * One behaviour, proved twice, with real input only:
 *
 *   1. WALK ONTO THE DECK and stand there. The panel must NOT open. The hail
 *      must go loud instead — that is the whole trade: the shop stops taking
 *      the frame and starts being impossible to miss.
 *   2. PRESS THE KEY that the hail is printing. The panel must open at once.
 *
 * It exists because the old behaviour opened the counter on contact, and a cold
 * critic met it three times in one session — "once mid-sprint, once mid-build".
 * The foundry stands thirteen metres from the spawn, on the flattest ground on
 * the plateau, which is to say on the route to everywhere; crossing it is not a
 * request to go shopping.
 *
 * Nothing here calls `foundry.open()`, or any other debug entry point. The
 * cadet walks with KeyW and buys with KeyE, and the only thing read back off
 * `__ascent` is where the shop is standing, so the script knows which way to
 * point the camera — the same thing a player reads off the light in the sky.
 *
 *   node tools/critic/shopask.mjs --url http://127.0.0.1:5173
 *
 * Exit 0 = the shop waited to be asked, and answered when it was.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { findings } from '../_findings.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/shopask'));
const W = 1600, H = 900;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const steps = [];
const note = (ok, label, detail = '') => {
  steps.push({ ok, label, detail });
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ' — ' + detail : ''}`);
};
const shot = (n) => page.screenshot({ path: path.join(OUT, n + '.png') }).catch(() => {});

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4500);

const open = () => page.evaluate(() => !!document.querySelector('.fdy.show'));
const dist = () => page.evaluate(() => window.__ascent.kit.state().foundry.d);
const hail = () => page.evaluate(() => {
  const el = document.querySelector('.hail');
  return { show: !!el?.classList.contains('show'), here: !!el?.classList.contains('here') };
});

// --- walk to the shop with keys only ----------------------------------------
// Aim at it the way a player does — it is the lit thing off the right shoulder
// at the landing — then hold W.
// Turn with the ARROW KEYS, not with the mouse. A headless browser is never
// granted pointer lock, and the game says so on its own controls card — "the
// mouse cannot turn the view here". Steering with `mouse.move` here would move
// nothing at all and the probe would report that it could not reach a shop
// thirteen metres from the spawn.
const cx = Math.round(W / 2);
const turn = async (code, ms) => {
  await page.keyboard.down(code);
  await page.waitForTimeout(ms);
  await page.keyboard.up(code);
};
let reached = false;
let walking = false;
const go = async (on) => {
  if (on === walking) return;
  walking = on;
  if (on) await page.keyboard.down('KeyW'); else await page.keyboard.up('KeyW');
};
for (let i = 0; i < 90 && !reached; i++) {
  const seen = await page.evaluate(() => {
    const a = window.__ascent;
    const p = a.kit.state().foundry.at;
    const v = new a.THREE.Vector3(p[0], a.player.pos.y, p[1]).project(a.camera);
    return { x: (v.x * 0.5 + 0.5) * innerWidth, behind: v.z > 1 };
  });
  const off = seen.x - cx;
  if (seen.behind || Math.abs(off) > 60) {
    await go(false);
    await turn(seen.behind ? 'ArrowRight' : (off > 0 ? 'ArrowRight' : 'ArrowLeft'),
      seen.behind ? 260 : Math.min(240, 40 + Math.abs(off) * 0.2));
  } else {
    await go(true);
    await page.waitForTimeout(160);
  }
  if ((await dist()) < 4.6) reached = true;
}
await go(false);
await page.waitForTimeout(900);

const d = await dist();
note(reached && d < 6.4, 'the cadet can WALK onto the shop deck with keys alone',
  `standing ${d.toFixed(1)} m from the crucible`);

// --- 1. standing on it must not open it -------------------------------------
await page.waitForTimeout(2500);          // dwell: the old build opened here
const openedItself = await open();
await shot('01-on-the-deck');
note(!openedItself, 'STANDING ON THE DECK DOES NOT OPEN THE SHOP',
  openedItself ? 'the panel took the frame with no input at all' : 'the frame is still the world’s');

// --- 2. …and the hail says so, loudly ---------------------------------------
const h = await hail();
note(h.show && h.here, 'the hail is up and in its LOUD state instead',
  `show=${h.show} here=${h.here}`);

// --- 3. the key the hail prints opens it, at once ---------------------------
await page.keyboard.press('KeyE');
await page.waitForTimeout(700);
const openedOnKey = await open();
await shot('02-after-the-key');
note(openedOnKey, 'pressing the key on the hail opens the shop',
  openedOnKey ? '' : 'the shop did not answer the key it advertises');

// --- 4. …and it can be left ------------------------------------------------
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
const closed = !(await open());
note(closed, 'Escape closes it again');

// --- 5. walking off and back on still does not open it ----------------------
await page.keyboard.down('KeyS');
await page.waitForTimeout(2200);
await page.keyboard.up('KeyS');
await page.waitForTimeout(500);
await page.keyboard.down('KeyW');
await page.waitForTimeout(2400);
await page.keyboard.up('KeyW');
await page.waitForTimeout(1200);
const reopened = await open();
note(!reopened, 'walking off the deck and back on STILL does not open it',
  reopened ? 'contact re-opened the panel' : `back at ${(await dist()).toFixed(1)} m, frame untouched`);

note(errors.length === 0, 'no console errors', errors.slice(0, 3).join(' | '));

const passed = steps.filter((s) => s.ok).length;
console.log(`\n${passed}/${steps.length} passed  ->  ${OUT}`);
await browser.close();
/* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs. */
findings('check:shopask', { scope: 'route' })
  .route(steps.filter((s) => !s.ok).map((s) => `${s.label || s.what || 'step'}${s.detail ? ` (${s.detail})` : ''}`)).done();
