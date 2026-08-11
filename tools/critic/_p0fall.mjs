/** Fall-through probe: with the lattice hand DRAWN, no click on the interface may build. */
import { chromium } from 'playwright';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4399');
const OUT = path.resolve(arg('out', '/Users/harrison/dev/aadmath/shots/p0fall'));
await mkdir(OUT, { recursive: true });
const W = 1600, H = 900;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
page.on('pageerror', (e) => logs.push('pageerror ' + e.message));
await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent);
await page.waitForTimeout(16000);

const owned = () => page.evaluate(() => window.__ascent.builder.solids.owned);
// draw the hand deliberately, the way a player does
await page.keyboard.press('Digit2');
await page.waitForTimeout(400);
console.log('handOut', await page.evaluate(() => window.__ascent.builder.handOut));

const targets = [
  ['hotbar slot', '#buildbar .slot'],
  ['lang pill', '.langs button'],
  ['progress launcher', '.rp-launch'],
  ['kit chip', '.kit-chip'],
  ['controls card', '.fc-card'],
  ['controls got-it', '.fc-x'],
  ['comms card', '.meta-comms'],
  ['quest card', '.meta-card'],
  ['objective card', '[class*="obj"]'],
];
const res = [];
for (const [name, sel] of targets) {
  const box = await page.evaluate((s) => {
    const n = [...document.querySelectorAll(s)].find((x) => {
      const r = x.getBoundingClientRect(); const cs = getComputedStyle(x);
      return r.width > 8 && r.height > 8 && cs.display !== 'none' && +cs.opacity > 0.3;
    });
    return n ? n.getBoundingClientRect().toJSON() : null;
  }, sel);
  if (!box) { res.push([name, 'absent']); continue; }
  const b4 = await owned();
  await page.mouse.click(box.x + box.width / 2, box.y + Math.min(box.height / 2, 14));
  await page.waitForTimeout(500);
  const af = await owned();
  res.push([name, af > b4 ? `BUILT (${b4}->${af})` : 'clean']);
  // re-show the controls card if we dismissed it
  await page.keyboard.press('Slash');
  await page.waitForTimeout(200);
}
// and a real world click SHOULD build
const b4 = await owned();
await page.keyboard.press('Escape');
await page.mouse.click(W / 2, H / 2);
await page.waitForTimeout(600);
await page.mouse.click(W / 2, H / 2 + 60);
await page.waitForTimeout(700);
console.log(JSON.stringify(res));
console.log('world click builds:', b4, '->', await owned());
console.log('errors:', logs);
await page.screenshot({ path: path.join(OUT, 'end.png') });
await browser.close();
