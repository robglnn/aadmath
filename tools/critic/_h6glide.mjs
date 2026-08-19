/** Does the wing actually open when you hold Space? */
import { chromium } from 'playwright';
const URL = process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url') + 1] : 'http://127.0.0.1:4777';
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4000);
// earn the wing
await page.evaluate(async () => {
  const A = window.__ascent;
  for (let i = 0; i < 60; i++) {
    const o = A.nextObjective(); if (!o) break;
    if (!A.openRiftById(o.id)) break;
    const inf = A.panelInfo(); if (!inf.open) break;
    A.enter(inf.answer); await new Promise((r) => setTimeout(r, 20));
    try { A.panel.close?.(); } catch {}
    await new Promise((r) => setTimeout(r, 12));
  }
});
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4000);
for (let i = 0; i < 6; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
await page.evaluate(() => document.activeElement?.blur?.());
await page.mouse.click(640, 360); await page.waitForTimeout(500);
console.log('kit', JSON.stringify(await page.evaluate(() => { const k = window.__ascent.kit.state(); return { held: k.held, move: k.move }; })));
console.log('loco keys', await page.evaluate(() => Object.keys(window.__ascent.player).join(',')));

// run, jump, hold space, sample
await page.keyboard.down('ShiftLeft'); await page.keyboard.down('KeyW');
await page.waitForTimeout(2500);
await page.keyboard.press('Space');
await page.waitForTimeout(300);
await page.keyboard.down('Space');
const rows = [];
for (let i = 0; i < 60; i++) {
  rows.push(await page.evaluate(() => {
    const A = window.__ascent, p = A.player;
    const L = p.loco || p.locomotion || p;
    return { y: +p.pos.y.toFixed(1), vy: +(L.vel?.y ?? p.vel?.y ?? 0).toFixed(1), gliding: !!L.gliding, state: L.state, air: +(L.airTime ?? 0).toFixed(2), g: !!p.grounded };
  }));
  await page.waitForTimeout(120);
}
await page.keyboard.up('Space'); await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
console.log(JSON.stringify(rows.filter((_, i) => i % 3 === 0)));
await browser.close();
