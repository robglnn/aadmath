import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const OUT = '/tmp/critic-pad';
await mkdir(OUT, { recursive: true });
const URL = 'http://127.0.0.1:4791';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push('E:' + m.text()); });
page.on('pageerror', (e) => logs.push('PE:' + e.message));
await page.addInitScript(() => {
  window.__pad = {
    id: 'Critic Pad (STANDARD GAMEPAD)', index: 0, connected: true, mapping: 'standard', timestamp: 0,
    axes: [0, 0, 0, 0],
    buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })),
  };
  navigator.getGamepads = () => [window.__pad, null, null, null];
});
await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
await page.waitForTimeout(3000);
await page.mouse.click(640, 360);
await page.waitForTimeout(2500);
const set = (o) => page.evaluate((o) => {
  const p = window.__pad;
  p.timestamp = performance.now();
  if (o.axes) o.axes.forEach((v, i) => p.axes[i] = v);
  if (o.buttons) for (const [i, v] of Object.entries(o.buttons)) { p.buttons[i].pressed = v > 0.5; p.buttons[i].value = v; }
}, o);

// wake the pad: move the stick
await set({ axes: [0, -0.9, 0, 0] });
await page.waitForTimeout(1200);
console.log('source', await page.evaluate(() => window.__ascent.input.source));
await set({ axes: [0, 0, 0, 0] });
await page.waitForTimeout(400);

const slotBefore = await page.evaluate(() => ({ slot: window.__ascent.builder.slot, kind: window.__ascent.builder.kind }));
// try every button and d-pad to see if any changes the piece kind
const tried = {};
for (const i of [4, 5, 6, 8, 9, 10, 11, 12, 13, 14, 15, 16]) {
  await set({ buttons: { [i]: 1 } });
  await page.waitForTimeout(260);
  await set({ buttons: { [i]: 0 } });
  await page.waitForTimeout(200);
  tried[i] = await page.evaluate(() => window.__ascent.builder.kind);
}
console.log('slotBefore', JSON.stringify(slotBefore), 'after each button', JSON.stringify(tried));

// place with RT
const n0 = await page.evaluate(() => window.__ascent.buildTarget().placed);
await set({ buttons: { 7: 1 } });
await page.waitForTimeout(900);
await set({ buttons: { 7: 0 } });
await page.waitForTimeout(400);
const n1 = await page.evaluate(() => window.__ascent.buildTarget().placed);
console.log('placed via RT', n0, '->', n1);
await page.screenshot({ path: path.join(OUT, 'pad.png') });
console.log('LOGS', logs.length, logs.join(' | '));
await browser.close();
