import { chromium } from 'playwright';
const W = 1600, H = 900;
const NEEDLE = { en: 'Stand this close to an open rift', es: 'Estar tan cerca de una grieta abierta', pl: 'Otwarta wyrwa oddaje ciosy' };
const loc = process.argv[3] || 'en';
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--disable-gpu-vsync'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
await ctx.addInitScript((l) => { try { localStorage.clear(); localStorage.setItem('ascent.locale', l); } catch { /**/ } }, loc);
const p = await ctx.newPage();
await p.goto(process.argv[2], { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await p.waitForTimeout(2600);
await p.mouse.move(W / 2, H / 2); await p.mouse.click(W / 2, H / 2);
for (let i = 0; i < 200; i++) {
  const g = await p.evaluate(() => window.__ascent.story?.guide?.() || null);
  if (g && g.metres <= 14) break;
  const t = { ahead: 0, left: -190, right: 190, behind: 320 }[g?.where] ?? 0;
  if (t) { await p.mouse.move(W / 2 + t, H / 2, { steps: 3 }); await p.waitForTimeout(80); }
  await p.keyboard.down('KeyW'); await p.keyboard.down('ShiftLeft'); await p.waitForTimeout(340);
  await p.keyboard.up('ShiftLeft'); await p.keyboard.up('KeyW');
}
let found = null;
for (let i = 0; i < 420; i++) {
  await p.waitForTimeout(500);
  const txt = await p.evaluate(() => document.body.innerText.replace(/\s+/g, ' '));
  const k = txt.indexOf(NEEDLE[loc]);
  if (k >= 0) { found = txt.slice(k, k + 340); await p.screenshot({ path: `shots/vocab-surge/${loc}-surge-line.png` }); break; }
}
console.log(loc, '->', found || 'NOT SHOWN');
await b.close();
