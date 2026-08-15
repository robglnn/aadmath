import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const OUT = path.resolve(process.argv[2] || 'shots/fun-close');
await mkdir(OUT, { recursive: true });
const ctx = await chromium.launchPersistentContext('/tmp/ascent-profile', { args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--disable-gpu-vsync'], viewport: { width: 1600, height: 900 } });
const page = ctx.pages()[0] || await ctx.newPage();
page.on('console', (m) => { if (m.type() === 'error') console.log('ERR', m.text()); });
await page.goto('http://127.0.0.1:4577', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(3000);
await page.evaluate(() => window.__ascent.advanceDays(1));
await page.waitForTimeout(1500);
await page.mouse.move(800, 450); await page.mouse.click(800, 450); await page.waitForTimeout(400);
// work a few rifts so the run has something to report
for (let i = 0; i < 6; i++) {
  const id = await page.evaluate(() => {
    const a = window.__ascent, p = a.player.pos;
    const r = a.rifts.list.filter((x) => !x.locked && !x.sealed);
    let b = null, bd = 1e9; for (const x of r) { const d = Math.hypot(x.pos.x - p.x, x.pos.z - p.z); if (d < bd) { bd = d; b = x; } }
    return b?.id;
  });
  if (!id) break;
  await page.evaluate((i2) => window.__ascent.teleportTo(i2), id);
  await page.waitForTimeout(600); await page.keyboard.press('KeyE'); await page.waitForTimeout(800);
  for (let j = 0; j < 6; j++) {
    if (!(await page.evaluate(() => !!window.__ascent.panel?.open))) break;
    await page.evaluate(() => window.__ascent.enter(window.__ascent.panel.item.answer));
    await page.waitForTimeout(700);
  }
  if (await page.evaluate(() => !!window.__ascent.panel?.open)) { await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
}
await page.evaluate(() => window.__ascent.session.skipToClose());
for (let i = 0; i < 20; i++) {
  const s = await page.evaluate(() => {
    const c = document.querySelector('.ses-close');
    return c && c.classList.contains('show') ? (c.innerText || '').replace(/\n+/g, ' | ') : null;
  });
  if (s) { console.log('RESOLUTION CARD:\n' + s); await page.screenshot({ path: path.join(OUT, 'resolution.png') }); break; }
  await page.waitForTimeout(700);
}
await page.screenshot({ path: path.join(OUT, 'after.png') });
// walk the card
for (const k of ['Enter', 'Enter']) { await page.keyboard.press(k); await page.waitForTimeout(2000); await page.screenshot({ path: path.join(OUT, 'step-' + k + '-' + Date.now() + '.png') }); }
const rest = await page.evaluate(() => { const r = document.querySelector('.ses-rest'); return r && r.classList.contains('show') ? r.innerText.replace(/\n+/g, ' | ') : null; });
console.log('REST CARD:', rest);
await page.screenshot({ path: path.join(OUT, 'rest.png') });
await ctx.close();
