/**
 * The wallet strip, read off the running game with real input.
 *
 * A cold player watched this strip read 2 left, 6 left, 10 left, 13 left,
 * 39 left and wrote *"a number called 'left' that only goes up is not a
 * number."* This walks to a rift with the keyboard, answers until the strip
 * prints, and photographs what the noun says now.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
import { auditLedgerStrip } from '../tools/critic/_repassert.mjs';

const URL = process.argv[2] || 'http://127.0.0.1:4477';
const OUT = path.resolve('shots/repledger');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const sleep = (ms) => page.waitForTimeout(ms);

await page.goto(URL, { waitUntil: 'load' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await sleep(4000);

const target = await page.evaluate(() => {
  const a = window.__ascent;
  const r = (a.rifts?.list || []).filter((x) => !x.locked);
  const p = a.player.pos;
  let best = null; let bd = 1e9;
  for (const x of r) { const d = Math.hypot(x.pos.x - p.x, x.pos.z - p.z); if (d < bd) { bd = d; best = x; } }
  return best ? { x: best.pos.x, z: best.pos.z } : null;
});
await page.mouse.click(720, 450);
await sleep(250);
await page.keyboard.down('KeyW');
for (let i = 0; i < 240; i++) {
  const err = await page.evaluate((t) => {
    const a = window.__ascent; const p = a.player.pos;
    const want = Math.atan2(t.x - p.x, t.z - p.z);
    let d = ((want - a.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (d < -Math.PI) d += Math.PI * 2;
    return { d, dist: Math.hypot(t.x - p.x, t.z - p.z), open: !!a.panel?.open };
  }, target);
  if (err.open) break;
  if (Math.abs(err.d) > 0.06) await page.mouse.move(720 - err.d * 240, 450, { steps: 2 });
  await sleep(110);
}
await page.keyboard.up('KeyW');
for (const k of ['KeyE', 'KeyF', 'Enter']) {
  if (await page.evaluate(() => !!window.__ascent.panel?.open)) break;
  await page.keyboard.press(k); await sleep(400);
}

// Answer with real keys until the strip has printed a few movements.
const seen = [];
for (let n = 0; n < 14; n++) {
  const info = await page.evaluate(() => {
    const p = window.__ascent.panel;
    if (!p?.open || !p.item || p._settled) return null;
    return { mode: p.mode, answer: String(p.item.answer) };
  });
  if (info?.mode === 'keypad') {
    for (const ch of info.answer.split('')) { if (ch !== ' ') await page.keyboard.press(ch); await sleep(30); }
    await page.keyboard.press('Enter');
  } else if (info?.mode === 'choice') {
    await page.locator(`.rf-reading[data-value="${info.answer.replace(/["\\]/g, '\\$&')}"]`).first()
      .click().catch(() => page.locator('.rf-reading').first().click().catch(() => {}));
  } else if (info) {
    await page.evaluate(() => window.__ascent.panel.demo('right'));
  } else {
    await page.keyboard.press('Escape'); await sleep(400);
    await page.keyboard.down('KeyW'); await sleep(1400); await page.keyboard.up('KeyW');
    for (const k of ['KeyE', 'KeyF']) { await page.keyboard.press(k); await sleep(350); }
    continue;
  }
  await sleep(700);
  const rows = await page.evaluate(() => [...document.querySelectorAll('.led-row')]
    .map((r) => (r.innerText || '').replace(/\s+/g, ' ').trim()));
  if (rows.length) {
    seen.push(rows);
    await page.screenshot({ path: path.join(OUT, `strip-${String(seen.length).padStart(2, '0')}.png`) });
    if (seen.length >= 4) break;
  }
}

console.log('strip lines seen, newest last:');
for (const r of seen) console.log('  ' + r.join('   ||   '));
const log = await page.evaluate(() => window.__ascent.ledger());
console.log('\nledger log (newest first):', JSON.stringify(log.slice(0, 8)));
const v = auditLedgerStrip(log);
console.log(v.length ? 'VIOLATIONS: ' + v.join(' | ') : 'the running figure is the balance, and it moves both ways');
console.log('console errors:', errors.length);
await browser.close();
