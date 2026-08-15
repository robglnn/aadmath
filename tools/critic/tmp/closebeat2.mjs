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
await page.mouse.move(800, 450); await page.mouse.click(800, 450);
const st = () => page.evaluate(() => ({ phase: window.__ascent.state().session.phase, charter: !!document.querySelector('.ses-charter.show'), close: !!document.querySelector('.ses-close.show'), rest: !!document.querySelector('.ses-rest.show') }));
for (let i = 0; i < 70; i++) {
  const s = await st();
  if (s.charter) {
    console.log('CHARTER (returning player):\n' + (await page.evaluate(() => document.querySelector('.ses-charter.show').innerText.replace(/\n+/g, ' | '))));
    await page.screenshot({ path: path.join(OUT, 'charter-return.png') });
    await page.keyboard.press('Enter'); await page.waitForTimeout(1500); break;
  }
  if (s.phase === 'work') break;
  await page.waitForTimeout(1000);
}
console.log('phase now', (await st()).phase);
for (let i = 0; i < 5; i++) {
  const id = await page.evaluate(() => {
    const a = window.__ascent, p = a.player.pos;
    const r = a.rifts.list.filter((x) => !x.locked && !x.sealed);
    let b = null, bd = 1e9; for (const x of r) { const d = Math.hypot(x.pos.x - p.x, x.pos.z - p.z); if (d < bd) { bd = d; b = x; } }
    return b?.id;
  });
  if (!id) break;
  await page.evaluate((i2) => window.__ascent.teleportTo(i2), id);
  await page.waitForTimeout(600); await page.keyboard.press('KeyE'); await page.waitForTimeout(900);
  for (let j = 0; j < 6; j++) {
    if (!(await page.evaluate(() => !!window.__ascent.panel?.open))) break;
    await page.evaluate(() => window.__ascent.enter(window.__ascent.panel.item.answer));
    await page.waitForTimeout(700);
  }
  if (await page.evaluate(() => !!window.__ascent.panel?.open)) { await page.keyboard.press('Escape'); await page.waitForTimeout(500); }
}
console.log('phase before close', (await st()).phase);
console.log('skipToClose ->', await page.evaluate(() => window.__ascent.session.skipToClose()));
for (let i = 0; i < 25; i++) {
  const c = await page.evaluate(() => { const e = document.querySelector('.ses-close'); return e && e.classList.contains('show') ? e.innerText.replace(/\n+/g, ' | ') : null; });
  if (c) { console.log('RESOLUTION CARD:\n' + c); await page.screenshot({ path: path.join(OUT, 'resolution.png') }); break; }
  await page.waitForTimeout(600);
}
await page.keyboard.press('Enter'); await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(OUT, 'after-resolution.png') });
const rest = await page.evaluate(() => { const r = document.querySelector('.ses-rest'); return r && r.classList.contains('show') ? r.innerText.replace(/\n+/g, ' | ') : null; });
console.log('REST CARD:', rest);
await page.screenshot({ path: path.join(OUT, 'rest.png') });
await page.waitForTimeout(6000);
await page.screenshot({ path: path.join(OUT, 'rest-later.png') });
console.log('final', JSON.stringify(await st()));
await ctx.close();
