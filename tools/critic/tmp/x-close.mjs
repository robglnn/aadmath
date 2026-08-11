/**
 * Reproduce the close/rest beat deterministically on the two ordinary endings:
 *   A. the last answer of the run is CORRECT
 *   B. the last answer of the run is WRONG (≈1 run in 3 at the measured accuracy)
 * and check whether the rift surface is still live underneath the break.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const W = +arg('w', 1600), H = +arg('h', 900);
const OUT = path.resolve(arg('out', 'shots/xcrit-close'));
const LAST = arg('last', 'wrong');
const LOC = arg('loc', 'en');
await mkdir(OUT, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: W < 700, hasTouch: W < 700 });
const p = await ctx.newPage();
const logs = [];
p.on('console', (m) => { if (m.type() === 'error') logs.push(m.type() + ': ' + m.text()); });
p.on('pageerror', (e) => logs.push('pageerror: ' + e.message));
await p.goto(arg('url', 'http://127.0.0.1:4611'), { waitUntil: 'networkidle' });
await p.evaluate(() => { localStorage.clear(); });
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
if (LOC !== 'en') { await p.evaluate((l) => window.__ascent.setLocale(l), LOC); await p.waitForTimeout(1500); await p.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 }); }
await p.evaluate(() => document.getElementById('boot')?.classList.add('gone'));
await p.waitForFunction(() => document.querySelector('.ses-charter.show'), null, { timeout: 60000 });
await p.screenshot({ path: path.join(OUT, 'a-orders.png') });
await p.click('.sc-go');
await p.waitForTimeout(800);

const S = () => p.evaluate(() => { const s = window.__ascent.state().session; return { phase: s.phase, tears: s.run?.tears, target: s.run?.target }; });
let g = 0;
for (;;) {
  const s = await S();
  if (s.phase !== 'work') break;
  if (g++ > 300) break;
  const open = await p.evaluate(() => !!window.__ascent.panel.open);
  if (!open) {
    await p.evaluate(() => { const a = window.__ascent; const n = a.nextObjective(); a.teleportTo(n?.skill || n?.id); });
    await p.waitForTimeout(350);
    await p.keyboard.press('KeyE');
    await p.waitForTimeout(700);
    if (!(await p.evaluate(() => !!window.__ascent.panel.open))) { await p.waitForTimeout(800); continue; }
  }
  const last = s.tears >= s.target - 1;
  const wantCorrect = last ? (LAST === 'correct') : true;
  await p.evaluate((c) => {
    const a = window.__ascent; const it = a.panel.item;
    a.enter(c ? it.answer : (typeof it.answer === 'number' ? it.answer + 1 : String(it.answer) + '1'));
  }, wantCorrect);
  await p.waitForTimeout(1400);
}
await p.waitForTimeout(1600);
await p.screenshot({ path: path.join(OUT, 'b-close.png') });
console.log('close-state', JSON.stringify(await p.evaluate(() => ({
  panelOpen: !!window.__ascent.panel.open,
  riftVisible: !!document.querySelector('.rift.open, .rift.show, #rift.open'),
  riftRect: (() => { const e = document.querySelector('.rift, #rift'); return e ? e.getBoundingClientRect().width : null; })(),
}))));
await p.evaluate(() => document.querySelector('.ses-close .sx-rest')?.click());
await p.waitForTimeout(2200);
await p.screenshot({ path: path.join(OUT, 'c-rest.png') });
// is the maths surface still there under the break, and can it be clicked?
const probe = await p.evaluate(() => {
  const r = document.querySelector('.rift') || document.querySelector('#rift');
  const vis = r && getComputedStyle(r).display !== 'none' && r.getBoundingClientRect().width > 0;
  const key = [...document.querySelectorAll('.rift button, #rift button')].find((b) => /^(7|8|9|5)$/.test(b.textContent.trim()));
  let hitTop = null;
  if (key) { const q = key.getBoundingClientRect(); const el = document.elementFromPoint(q.x + q.width / 2, q.y + q.height / 2); hitTop = el && (el.className.baseVal || el.className || el.tagName); }
  return { riftInDom: !!r, riftVisible: !!vis, keyFound: !!key, topElementOverKey: String(hitTop) };
});
console.log('rest-probe', JSON.stringify(probe));
await p.waitForTimeout(45000);
await p.screenshot({ path: path.join(OUT, 'd-rest-late.png') });
console.log('rest-late-text', JSON.stringify(await p.evaluate(() => document.querySelector('.ses-rest')?.innerText)));
// skip to the end of the break
await p.evaluate(() => document.querySelector('.ses-rest .sr-skip')?.click());
await p.waitForTimeout(2500);
await p.screenshot({ path: path.join(OUT, 'e-rest-end.png') });
console.log('end-text', JSON.stringify(await p.evaluate(() => document.querySelector('.ses-rest')?.innerText)));
console.log('logs', JSON.stringify(logs.slice(0, 6)));
await b.close();
