/**
 * The pause menu's way out, driven with real keys and real clicks.
 *
 *  1. Walk off the shard with WASD.
 *  2. While out of the world, press Escape and read what the menu offers.
 *  3. Click Recover. Assert the cadet is standing on solid ground.
 *  4. Press R while the menu is open — the key must work from any state.
 *  5. Look at Start over, and its confirmation.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/p0menu'));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4500);
await page.mouse.click(800, 450);

const facts = () => page.evaluate(() => {
  const a = window.__ascent, p = a.player.pos;
  return {
    r: +Math.hypot(p.x, p.z).toFixed(1), y: +p.y.toFixed(1),
    ground: a.islandAt(p.x, p.z), grounded: !!a.player.grounded,
    menu: !!a.menu?.open, ui: a.input.uiOpen, n: a.player.recoveries | 0,
  };
});
const ok = (b, s, d = '') => console.log(`${b ? '  ok  ' : ' FAIL '} ${s}${d ? ' — ' + d : ''}`);

// 1. off the shard, on ordinary keys
await page.keyboard.down('ShiftLeft');
await page.keyboard.down('KeyW');
let off = false;
for (let i = 0; i < 200 && !off; i++) {
  await page.waitForTimeout(200);
  const f = await facts();
  if (f.ui) { await page.keyboard.up('KeyW'); await page.keyboard.press('Escape'); await page.waitForTimeout(400); await page.mouse.click(800, 450); await page.keyboard.down('KeyW'); }
  if (f.ground === null && f.y < 12) off = true;
}
await page.keyboard.up('KeyW');
await page.keyboard.up('ShiftLeft');
ok(off, 'walked off the shard on ordinary WASD', JSON.stringify(await facts()));

// 2. Escape, while out of the world
await page.keyboard.press('Escape');
await page.waitForTimeout(700);
const menuText = await page.evaluate(() => document.querySelector('.mnu-card')?.innerText || '');
const menuOpen = await page.evaluate(() => !!window.__ascent.menu?.open);
await page.screenshot({ path: path.join(OUT, 'menu.png') });
ok(menuOpen, 'Escape opens the pause menu while out of the world');
console.log('--- what the menu says ---\n' + menuText.replace(/\n{2,}/g, '\n') + '\n---');

// 3. the Recover button
const hasRecover = await page.locator('.mnu-recover').isVisible();
const hasRestart = await page.locator('.mnu-restart').isVisible();
ok(hasRecover && hasRestart, 'the menu offers Recover and Start over');
await page.locator('.mnu-recover').click();
await page.waitForTimeout(1400);
const after = await facts();
ok(after.ground !== null && after.grounded && !after.menu,
  'the menu Recover button puts the cadet back on solid ground', JSON.stringify(after));

// 4. R from inside the menu
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
const before2 = await facts();
await page.keyboard.press('KeyR');
await page.waitForTimeout(900);
const after2 = await facts();
ok(after2.n > before2.n && after2.ground !== null && after2.grounded,
  'R still recovers while the pause menu owns the frame',
  `recoveries ${before2.n}->${after2.n}, menu=${after2.menu}`);

// 5. Start over asks first
await page.evaluate(() => { if (!window.__ascent.menu.open) window.__ascent.menu.show(); });
await page.waitForTimeout(400);
await page.locator('.mnu-restart').click();
await page.waitForTimeout(400);
const asks = await page.locator('.mnu-confirm').isVisible();
await page.screenshot({ path: path.join(OUT, 'restart-confirm.png') });
ok(asks, 'Start over asks before it throws a run away');
await page.locator('.mnu-no').click();
await page.waitForTimeout(300);

console.log('console errors:', errors.length, errors.slice(0, 3).join(' | '));
await browser.close();
