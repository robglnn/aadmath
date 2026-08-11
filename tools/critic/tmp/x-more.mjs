/**
 * The remaining beats: a learner who is struggling (nothing held, goal missed),
 * the break's own ending, and the whole shape at 414×896 and in ES / PL.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const W = +arg('w', 1600), H = +arg('h', 900);
const OUT = path.resolve(arg('out', 'shots/xcrit-more'));
const LOC = arg('loc', 'en');
const MODE = arg('mode', 'struggle'); // struggle | win
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
await p.screenshot({ path: path.join(OUT, '1-orders.png') });
console.log('ORDERS', JSON.stringify(await p.evaluate(() => document.querySelector('.ses-charter .sc-card')?.innerText)));
await p.click('.sc-go');
await p.waitForTimeout(900);
await p.screenshot({ path: path.join(OUT, '2-band.png') });

const S = () => p.evaluate(() => { const s = window.__ascent.state().session; return { phase: s.phase, tears: s.run?.tears, target: s.run?.target }; });
const N = MODE === 'struggle' ? 10 : 400;
for (let i = 0; i < N; i++) {
  const s = await S(); if (s.phase !== 'work') break;
  const open = await p.evaluate(() => !!window.__ascent.panel.open);
  if (!open) {
    await p.evaluate(() => { const a = window.__ascent; const n = a.nextObjective(); a.teleportTo(n?.skill || n?.id); });
    await p.waitForTimeout(300); await p.keyboard.press('KeyE'); await p.waitForTimeout(700);
    if (!(await p.evaluate(() => !!window.__ascent.panel.open))) { await p.waitForTimeout(700); continue; }
  }
  await p.evaluate((c) => {
    const a = window.__ascent; const it = a.panel.item;
    a.enter(c ? it.answer : (typeof it.answer === 'number' ? it.answer + 1 : String(it.answer) + '1'));
  }, MODE !== 'struggle');
  await p.waitForTimeout(1300);
  if (i === 4) { await p.screenshot({ path: path.join(OUT, '3-midwork.png') }); }
}
if (MODE === 'struggle') {
  console.log('after 10 misses', JSON.stringify(await S()));
  await p.screenshot({ path: path.join(OUT, '4-band-after-misses.png') });
  // close the panel the way a learner would, then run the clock out
  await p.evaluate(() => window.__ascent.panel.close?.());
  await p.waitForTimeout(900);
  await p.evaluate(() => window.__ascent.session.skipToClose());
  await p.waitForTimeout(2000);
}
await p.waitForTimeout(1500);
await p.screenshot({ path: path.join(OUT, '5-close.png') });
console.log('CLOSE', JSON.stringify(await p.evaluate(() => document.querySelector('.ses-close .sx-in')?.innerText)));
await p.evaluate(() => document.querySelector('.ses-close .sx-rest')?.click());
await p.waitForTimeout(2000);
await p.screenshot({ path: path.join(OUT, '6-rest.png') });
await p.waitForTimeout(43000);
await p.evaluate(() => document.querySelector('.ses-rest .sr-skip')?.click());
await p.waitForTimeout(2500);
await p.screenshot({ path: path.join(OUT, '7-rest-end.png') });
console.log('REST-END', JSON.stringify(await p.evaluate(() => document.querySelector('.ses-rest')?.innerText)));
// close the channel — the real ending
await p.evaluate(() => document.querySelector('.ses-rest .sr-off')?.click());
await p.waitForTimeout(2500);
await p.screenshot({ path: path.join(OUT, '8-channel-closed.png') });
console.log('CLOSED', JSON.stringify(await p.evaluate(() => document.querySelector('.ses-rest')?.innerText)));
console.log('LOGS', JSON.stringify(logs.slice(0, 8)));
await b.close();
