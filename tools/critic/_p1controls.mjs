/**
 * P1 — DOES THE CONTROLS CARD ACTUALLY LEAVE?
 *
 * The critic: "The controls card never auto-dismisses even after every verb is
 * ticked; it holds ~300x200 px of screen for the whole session."
 *
 * The first attempt to measure this pressed Escape to tidy up, which is
 * `hide(byHand)` — it sets `dismissed` and makes the card go away for a reason
 * that has nothing to do with the fix. This one never presses Escape and never
 * touches the pill. It performs the five core verbs with real keys and a real
 * mouse, reads the odometers in src/core/input.js to prove each one actually
 * registered, and then watches the card.
 *
 *   node tools/critic/_p1controls.mjs [--url ...] [--out shots/p1/controls]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/p1/controls'));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: !process.argv.includes('--headed'),
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) });

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4500);

const card = () => page.evaluate(() => {
  const el = document.querySelector('.fc');
  const s = getComputedStyle(el);
  const rows = [...document.querySelectorAll('.fc-rows li')]
    .map((li) => `${li.dataset.v}${li.classList.contains('done') ? '=done' : ''}`);
  return {
    show: el.classList.contains('show'), away: el.classList.contains('away'),
    opacity: +s.opacity, rows,
    pill: document.querySelector('.fc-pill')?.classList.contains('show') ?? null,
  };
});
const odo = () => page.evaluate(() => {
  const i = window.__ascent.input;
  return {
    locked: !!i.locked, moveTime: +i.moveTime.toFixed(2),
    lookTravel: +i.lookTravel.toFixed(2), ever: { ...i.ever },
  };
});

await shot('00-card-on-arrival');
console.log('on arrival        ', JSON.stringify(await card()));

// ---- LOOK. Pointer lock first, then real mouse movement. -------------------
await page.mouse.click(720, 460);
await page.waitForTimeout(500);
for (let i = 0; i < 90; i++) {
  await page.mouse.move(720 + (i % 2 ? 90 : -90), 460 + (i % 3 ? 30 : -30));
  await page.waitForTimeout(20);
}
console.log('after looking     ', JSON.stringify(await odo()));

// ---- MOVE, JUMP, GLIDE -----------------------------------------------------
await page.keyboard.down('KeyW');
await page.waitForTimeout(2000);
await page.keyboard.press('Space');            // jump
await page.waitForTimeout(300);
await page.keyboard.down('Space');             // hold to glide
await page.waitForTimeout(1500);
await page.keyboard.up('Space');
await page.waitForTimeout(600);
await page.keyboard.up('KeyW');
console.log('after moving      ', JSON.stringify(await odo()));

// ---- INTERACT. Walk to a rift and press the key; never Escape. -------------
const target = await page.evaluate(() => {
  const a = window.__ascent, p = a.player.pos;
  const r = (a.rifts?.list ?? []).filter((x) => !x.locked);
  let best = null, bd = 1e9;
  for (const x of r) { const d = Math.hypot(x.pos.x - p.x, x.pos.z - p.z); if (d < bd) { bd = d; best = x; } }
  return best ? { x: best.pos.x, z: best.pos.z } : null;
});
if (target) {
  await page.keyboard.down('KeyW');
  for (let i = 0; i < 150; i++) {
    const e = await page.evaluate((t) => {
      const a = window.__ascent, p = a.player.pos;
      const want = Math.atan2(t.x - p.x, t.z - p.z);
      let d = ((want - a.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (d < -Math.PI) d += Math.PI * 2;
      return { d, dist: Math.hypot(t.x - p.x, t.z - p.z), open: !!a.panel?.open };
    }, target);
    if (Math.abs(e.d) > 0.06) await page.mouse.move(720 - e.d * 240, 460, { steps: 2 });
    await page.waitForTimeout(110);
    if (e.open || e.dist < 5) break;
  }
  await page.keyboard.up('KeyW');
  await page.keyboard.press('KeyE');
  await page.waitForTimeout(900);
}
// Leave the tear by its own X button, not by Escape — Escape also closes the
// controls card by hand, which is the confound that hid this defect before.
const x = await page.$('#rf-close, .rf-x');
if (x && await x.isVisible()) { await x.click().catch(() => {}); await page.waitForTimeout(900); }

/* ---------------------------------------------------------------------------
   THE ONE SIGNAL A HARNESS CANNOT PRODUCE.

   `look` ticks off `input.lookTravel`, which only accumulates while the pointer
   is LOCKED — and src/core/input.js says so itself, in a comment about this
   exact situation: "Chrome ... rejects it when the document is not allowed to
   lock the pointer (a sandboxed iframe, a headless run)." Measured here,
   `locked` is false in headless AND in headed Playwright, so no amount of
   `mouse.move` will ever move that odometer, and three of the five core verbs
   are downstream of being able to aim.

   The defect being measured is NOT in how a verb ticks. It is in `update()`,
   which cleared and re-armed its own 1500 ms retreat on every frame, so the
   timer could never reach 1500 ms. That code path is identical whichever way
   the fifth verb arrived.

   So the harness writes the ONE hardware value it cannot generate — the same
   odometer, in the same units, that a real mouse would have written — and
   everything downstream of it stays real: the real ControlsCard, its real
   `update()` on the real engine tick, the real timer. This is a substituted
   INPUT, not a substituted RESULT, and it is reported as such. Nothing here
   calls `show`, `hide` or any other method on the card.
   --------------------------------------------------------------------------- */
const substituted = [];
let odoNow = await odo();
if (!odoNow.locked && odoNow.lookTravel === 0) {
  substituted.push('input.lookTravel (pointer lock refused to automation)');
  await page.evaluate(() => { window.__ascent.input.lookTravel = 1.4; });
}
if (!odoNow.ever.glide) {
  substituted.push('input.ever.glide');
  await page.evaluate(() => { window.__ascent.input.ever.glide = true; });
}
if (!odoNow.ever.interact) {
  substituted.push('input.ever.interact');
  await page.evaluate(() => { window.__ascent.input.ever.interact = true; });
}
await page.waitForTimeout(600);

const after = await odo();
const atTick = await card();
if (substituted.length) {
  console.log('substituted inputs', substituted.join(', '));
}
console.log('after interacting ', JSON.stringify(after));
console.log('card at that point', JSON.stringify(atTick));
await shot('10-all-core-verbs-ticked');

// ---- WATCH. The documented retreat is 1.5 s; give it twenty times over. -----
const samples = [];
for (let i = 0; i < 20; i++) {
  await page.waitForTimeout(1500);
  const c = await card();
  samples.push({ at: `${((i + 1) * 1.5).toFixed(1)}s`, show: c.show, opacity: c.opacity, away: c.away });
}
const final = await card();
await shot('20-thirty-seconds-later');

const core = ['move', 'look', 'jump', 'glide', 'interact'];
const ticked = core.filter((v) => atTick.rows.includes(`${v}=done`));
const allCore = ticked.length === core.length;
// The card is gone when it is not painting, however it got there.
const gone = final.opacity < 0.02 || !final.show;

console.log('\nverbs ticked      ', ticked.join(', ') || 'none', `(${ticked.length}/5)`);
console.log('rows              ', atTick.rows.join(' '));
console.log('card 30 s later   ', JSON.stringify(final));
console.log('samples           ', samples.map((s) => `${s.at}:${s.show ? 'shown' : 'gone'}@${s.opacity}`).join(' '));
console.log('\nerrors            ', errors.length ? errors.slice(0, 3) : 'none');

await writeFile(path.join(OUT, 'controls.json'),
  JSON.stringify({ atTick, final, samples, odo: after, ticked, allCore, gone, substituted, errors }, null, 2));

if (!allCore) {
  console.log(`\nINCONCLUSIVE — only ${ticked.length}/5 core verbs registered, so the`);
  console.log('retreat was never allowed to arm. This is a harness problem, not a verdict.');
  process.exit(2);
}
if (substituted.length) {
  console.log(`\nNOTE — ${substituted.length} input(s) were written by the harness because an`);
  console.log('automated browser cannot produce them. Everything downstream stayed real.');
}
console.log(gone ? '\nPASS — every core verb ticked and the card retired on its own.'
                 : '\nFAIL — every core verb ticked and the card is still holding the frame.');
await browser.close();
process.exit(gone ? 0 : 1);
