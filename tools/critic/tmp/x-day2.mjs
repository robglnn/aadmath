/** Day two: what does a returning learner actually get on load? */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const OUT = path.resolve('shots/xcrit-day2'); await mkdir(OUT, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const p = await ctx.newPage();
const logs = []; p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); }); p.on('pageerror', (e) => logs.push('pageerror ' + e.message));
await p.goto('http://127.0.0.1:4611', { waitUntil: 'networkidle' });
await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await p.evaluate(() => document.getElementById('boot')?.classList.add('gone'));
await p.waitForFunction(() => document.querySelector('.ses-charter.show'), null, { timeout: 60000 });
await p.click('.sc-go');
const S = () => p.evaluate(() => { const s = window.__ascent.state().session; return { phase: s.phase, tears: s.run?.tears, target: s.run?.target }; });
for (let i = 0; i < 200; i++) {
  const s = await S(); if (s.phase !== 'work') break;
  if (!(await p.evaluate(() => !!window.__ascent.panel.open))) {
    await p.evaluate(() => { const a = window.__ascent; const n = a.nextObjective(); a.teleportTo(n?.skill || n?.id); });
    await p.waitForTimeout(250); await p.keyboard.press('KeyE'); await p.waitForTimeout(600);
    if (!(await p.evaluate(() => !!window.__ascent.panel.open))) continue;
  }
  await p.evaluate(() => { const a = window.__ascent; a.enter(a.panel.item.answer); });
  await p.waitForTimeout(1000);
}
await p.waitForTimeout(1500);
// stand down, ride the break out, close the channel — a clean stopping point
await p.evaluate(() => document.querySelector('.ses-close .sx-rest')?.click());
await p.waitForTimeout(43000);
await p.evaluate(() => document.querySelector('.ses-rest .sr-skip')?.click());
await p.waitForTimeout(2000);
await p.evaluate(() => document.querySelector('.ses-rest .sr-off')?.click());
await p.waitForTimeout(2500);
await p.screenshot({ path: path.join(OUT, '0-channel-closed.png') });
console.log('day1 end state', JSON.stringify(await p.evaluate(() => { const s = window.__ascent.state(); return { phase: s.session.phase, ending: s.session.ending, integrity: s.integrity, skills: Object.entries(s.skills).filter(([, v]) => v.mastered).map(([k]) => k) }; })));
// --- next day ---
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await p.evaluate(() => document.getElementById('boot')?.classList.add('gone'));
await p.waitForTimeout(4000);
await p.screenshot({ path: path.join(OUT, '1-day2-load.png') });
console.log('day2 t4', JSON.stringify(await S()));
await p.waitForFunction(() => document.querySelector('.ses-charter.show'), null, { timeout: 90000 });
await p.waitForTimeout(3000);
await p.screenshot({ path: path.join(OUT, '2-day2-orders.png') });
console.log('day2 orders', JSON.stringify(await p.evaluate(() => document.querySelector('.ses-charter .sc-card')?.innerText)));
console.log('day2 plan', JSON.stringify(await p.evaluate(() => { const r = window.__ascent.state().session.run; return { index: r.index, target: r.target, minutes: r.minutes, seams: r.seams }; })));
console.log('logs', logs.slice(0, 5));
await b.close();
