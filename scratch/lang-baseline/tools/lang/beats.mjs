/**
 * The four beats the language pass has to be judged on, in one locale.
 *
 *   node tools/lang/beats.mjs --url http://127.0.0.1:4791 --out shots/x --loc pl
 *
 *   1  the opening — the first words anybody reads
 *   2  the menu card — "what to do next", which is now where the word "rift"
 *      is defined, and the only always-reachable statement of the next action
 *   3  a rift, answered WRONG — the error surface, which has to be unambiguous
 *   4  the echo the miss buys — the explanation surface
 *
 * Everything happens through real key and mouse events. `window.__ascent` is
 * used only to read state and to reach a rift quickly; nothing here grants
 * progress, and the wrong answer is typed on the real keypad.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4791');
const OUT = path.resolve(arg('out', 'shots/beats'));
const LOC = arg('loc', 'en');

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(String(e)));

await page.addInitScript((loc) => {
  try { localStorage.clear(); localStorage.setItem('ascent.locale', loc); } catch { /* private mode */ }
}, LOC);
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}-${LOC}.png`) });

// 1 — the opening, caught mid-speech while Marlow is still talking.
await page.mouse.click(800, 450);
await page.waitForTimeout(1200);
await page.keyboard.press('KeyW');
await page.waitForTimeout(5200);
await shot('01-opening');

// 2 — the menu, on the card that says what to do next.
await page.keyboard.press('Escape');
await page.waitForTimeout(900);
await shot('02-what-to-do');
await page.keyboard.press('Escape');
await page.waitForTimeout(600);

// 3 — a rift, answered wrong on the real keypad.
await page.evaluate(() => window.__ascent.openRiftById?.('var-meaning'));
await page.waitForTimeout(1600);
const surface = await page.evaluate(() => window.__ascent.panel?.mode || '');
if (surface === 'keypad' || surface === 'narrow') {
  // A value that cannot be the answer to a Level 1 item.
  for (const k of ['Digit9', 'Digit9', 'Digit7']) { await page.keyboard.press(k); await page.waitForTimeout(120); }
  await page.keyboard.press('Enter');
} else {
  // Choice, sort, area, balance: take the first offered thing, which the item
  // generator guarantees is not always right.
  const box = await page.locator('#rf-body button, #rf-body [role="button"]').first().boundingBox();
  if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
  await page.waitForTimeout(400);
  await page.keyboard.press('Enter');
}
await page.waitForTimeout(1800);
await shot('03-wrong');

// 4 — the echo the miss just bought.
const hint = await page.locator('#rf-hint').first();
if (await hint.count()) { await hint.click(); await page.waitForTimeout(1600); }
await shot('04-echo');

console.log(`${LOC}: surface ${surface || 'unknown'} · console errors ${errors.length}`);
if (errors.length) console.log(errors.slice(0, 3).join('\n'));
await browser.close();
