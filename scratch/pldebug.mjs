import { chromium } from 'playwright';
const W = 1600, H = 900;
const loc = process.argv[3] || 'pl';
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
const lines = new Set();
for (let i = 0; i < 200; i++) {
  await p.waitForTimeout(400);
  const r = await p.evaluate(() => {
    const n = document.querySelector('.mw, .marlow, [class*="marlow"], [class*="mw-"]');
    return {
      taught: window.__ascent.story?.guide?.()?.taught || [],
      say: n ? n.textContent.replace(/\s+/g, ' ').trim().slice(0, 160) : null,
      dist: window.__ascent.story?.guide?.()?.metres,
    };
  });
  if (r.say) lines.add(r.say);
  if (i % 25 === 0) console.log(i, r.dist, JSON.stringify(r.taught));
}
console.log('--- lines seen ---');
[...lines].forEach((l) => console.log('*', l));
await b.close();
