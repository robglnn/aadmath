/** The four beats, settled (no fade-in frames), at a given size and locale. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const W = +arg('w', 414), H = +arg('h', 896);
const OUT = path.resolve(arg('out', 'shots/xcrit-beats'));
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
if (LOC !== 'en') { await p.evaluate((l) => window.__ascent.setLocale(l), LOC); await p.waitForTimeout(1600); await p.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 }); }
await p.evaluate(() => document.getElementById('boot')?.classList.add('gone'));
await p.waitForFunction(() => document.querySelector('.ses-charter.show'), null, { timeout: 60000 });
await p.waitForTimeout(4000);           // fully settled
await p.screenshot({ path: path.join(OUT, `orders-${LOC}.png`) });
console.log('charter opacity/bg', JSON.stringify(await p.evaluate(() => {
  const c = document.querySelector('.ses-charter .sc-card'); const d = document.querySelector('.ses-charter .sc-dim');
  const cs = getComputedStyle(c), ds = d && getComputedStyle(d);
  return { cardOpacity: cs.opacity, cardBg: cs.backgroundColor, cardBackdrop: cs.backdropFilter, dimBg: ds?.backgroundColor, dimOpacity: ds?.opacity, rect: c.getBoundingClientRect().toJSON() };
})));
await p.click('.sc-go');
await p.waitForTimeout(1400);
await p.screenshot({ path: path.join(OUT, `band-${LOC}.png`) });
// one item, then straight to the close and the break
await p.evaluate(() => { const a = window.__ascent; const n = a.nextObjective(); a.teleportTo(n?.skill || n?.id); });
await p.waitForTimeout(400); await p.keyboard.press('KeyE'); await p.waitForTimeout(900);
await p.screenshot({ path: path.join(OUT, `item-${LOC}.png`) });
await p.evaluate(() => { const a = window.__ascent; a.enter(a.panel.item.answer); });
await p.waitForTimeout(2200);
await p.screenshot({ path: path.join(OUT, `band2-${LOC}.png`) });
console.log('band', JSON.stringify(await p.evaluate(() => document.querySelector('.ses-band')?.innerText)));
await p.evaluate(() => { window.__ascent.panel.close?.(); });
await p.waitForTimeout(700);
await p.evaluate(() => window.__ascent.session.skipToClose());
await p.waitForTimeout(2500);
await p.screenshot({ path: path.join(OUT, `close-${LOC}.png` ) });
await p.evaluate(() => document.querySelector('.ses-close .sx-rest')?.click());
await p.waitForTimeout(3000);
await p.screenshot({ path: path.join(OUT, `rest-${LOC}.png`) });
await p.waitForTimeout(42000);
await p.evaluate(() => document.querySelector('.ses-rest .sr-skip')?.click());
await p.waitForTimeout(2600);
await p.screenshot({ path: path.join(OUT, `restend-${LOC}.png`) });
console.log('LOGS', JSON.stringify(logs.slice(0, 8)));
await b.close();
