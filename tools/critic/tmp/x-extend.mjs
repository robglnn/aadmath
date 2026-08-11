/** Can a learner defeat the 15–25 minute constraint? Extend, extend, extend. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const OUT = path.resolve('shots/xcrit-extend'); await mkdir(OUT, { recursive: true });
const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
const logs = []; p.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); }); p.on('pageerror', (e) => logs.push('pageerror ' + e.message));
await p.goto('http://127.0.0.1:4611', { waitUntil: 'networkidle' });
await p.evaluate(() => localStorage.clear()); await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await p.evaluate(() => document.getElementById('boot')?.classList.add('gone'));
await p.waitForFunction(() => document.querySelector('.ses-charter.show'), null, { timeout: 60000 });
await p.click('.sc-go');
const S = () => p.evaluate(() => { const s = window.__ascent.state().session; return { phase: s.phase, tears: s.run?.tears, target: s.run?.target, focus: Math.round(s.run?.focus || 0), index: s.run?.index, ext: s.run?.extension }; });
for (let round = 0; round < 4; round++) {
  for (let i = 0; i < 200; i++) {
    const s = await S(); if (s.phase !== 'work') break;
    if (!(await p.evaluate(() => !!window.__ascent.panel.open))) {
      await p.evaluate(() => { const a = window.__ascent; const n = a.nextObjective(); a.teleportTo(n?.skill || n?.id); });
      await p.waitForTimeout(250); await p.keyboard.press('KeyE'); await p.waitForTimeout(600);
      if (!(await p.evaluate(() => !!window.__ascent.panel.open))) continue;
    }
    await p.evaluate(() => { const a = window.__ascent; a.enter(a.panel.item.answer); });
    await p.waitForTimeout(1100);
  }
  await p.waitForTimeout(1500);
  console.log('round', round, JSON.stringify(await S()));
  console.log('  close says', JSON.stringify(await p.evaluate(() => document.querySelector('.ses-close .sx-in')?.innerText?.split('\n').slice(0, 6).join(' | '))));
  const more = await p.evaluate(() => { const el = document.querySelector('.ses-close .sx-more'); if (!el) return null; const txt = el.innerText; el.click(); return txt; });
  console.log('  clicked', JSON.stringify(more));
  await p.waitForTimeout(1800);
  console.log('  after extend', JSON.stringify(await S()));
  await p.screenshot({ path: path.join(OUT, `extend-${round}.png`) });
}
console.log('logs', logs.slice(0, 5));
await b.close();
