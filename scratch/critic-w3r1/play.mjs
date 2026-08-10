import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const OUT = '/tmp/critic-play';
await mkdir(OUT, { recursive: true });
const URL = 'http://127.0.0.1:4791';
const W = Number(process.argv[2] || 1280), H = Number(process.argv[3] || 720);
const TAG = process.argv[4] || `${W}x${H}`;
const MOBILE = W < 500;

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
    '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({
  viewport: { width: W, height: H }, deviceScaleFactor: 2,
  hasTouch: MOBILE, isMobile: MOBILE,
  userAgent: MOBILE ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined,
});
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push('console.error: ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message + '\n' + (e.stack || '')));

await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
await page.waitForTimeout(3000);
await page.mouse.click(W / 2, H / 2);
await page.waitForTimeout(1500);
const shot = async (n, ms = 500) => { await page.waitForTimeout(ms); await page.screenshot({ path: path.join(OUT, `${TAG}-${n}.png`) }); };

// 1. arm the builder the way a player does: press 2 (ramp)
await page.keyboard.press('Digit2');
await page.waitForTimeout(400);
await shot('a-ghost-ramp');

// ghost validity report
const g1 = await page.evaluate(() => window.__ascent.buildTarget());
console.log('ghost ramp', JSON.stringify(g1));

// 2. actually walk + build a stair of three ramps by holding W and clicking
async function walkBuild(n) {
  const res = [];
  for (let i = 0; i < n; i++) {
    res.push(await page.evaluate(() => window.__ascent.build()));
    await page.waitForTimeout(260);
    // run up the ramp
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(950);
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(420);
  }
  return res;
}
const stair = await walkBuild(4);
console.log('stair', JSON.stringify(stair.map(r => r.ok ? r.kind : r)));
await shot('b-stair');

// did we actually gain height by standing on it?
const climb = await page.evaluate(() => {
  const A = window.__ascent;
  const p = A.player.pos;
  return {
    playerY: p.y, islandY: A.islandAt(p.x, p.z), surface: A.surfaceAt(p.x, p.z),
    grounded: A.player.grounded ?? A.player.onGround ?? null,
    vy: A.player.vel.y,
  };
});
console.log('climb', JSON.stringify(climb));

// 3. floor out over the edge and stand on it
await page.keyboard.press('Digit3');
await page.waitForTimeout(300);
await shot('c-ghost-floor');
const fl = [];
for (let i = 0; i < 3; i++) {
  fl.push(await page.evaluate(() => window.__ascent.build()));
  await page.waitForTimeout(250);
  await page.keyboard.down('KeyW'); await page.waitForTimeout(700); await page.keyboard.up('KeyW');
  await page.waitForTimeout(500);
}
console.log('floors', JSON.stringify(fl.map(r => r.ok ? r.kind : r)));
await page.waitForTimeout(1200);
const stand = await page.evaluate(() => {
  const A = window.__ascent;
  const p = A.player.pos;
  return { y: p.y, island: A.islandAt(p.x, p.z), surface: A.surfaceAt(p.x, p.z), vy: A.player.vel.y };
});
console.log('standing on floor', JSON.stringify(stand));
await shot('d-floor-stand');

// 4. invalid placement -> red ghost + refusal text
await page.evaluate(() => { window.__ascent.builder.charge = 0; });
await page.waitForTimeout(400);
await shot('e-no-charge');
const bad = await page.evaluate(() => window.__ascent.build());
console.log('bad build', JSON.stringify(bad));
await shot('e2-refusal', 300);

// 5. locale sweep of the build UI
for (const loc of ['es', 'pl']) {
  await page.evaluate((l) => window.__ascent.setLocale(l), loc);
  await page.waitForTimeout(700);
  await page.evaluate(() => { window.__ascent.builder.charge = 0; window.__ascent.build(); });
  await shot(`f-build-${loc}`, 600);
}
await page.evaluate(() => window.__ascent.setLocale('en'));

// 6. overflow audit across the whole DOM
const overflow = await page.evaluate(() => {
  const bad = [];
  document.querySelectorAll('body *').forEach((el) => {
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity === 0) return;
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return;
    const clipped = el.scrollWidth > el.clientWidth + 2 || el.scrollHeight > el.clientHeight + 2;
    const off = r.right > innerWidth + 1 || r.left < -1 || r.bottom > innerHeight + 1 || r.top < -1;
    if ((clipped || off) && el.textContent.trim())
      bad.push({ cls: el.className?.toString?.().slice(0, 60), tag: el.tagName, clipped, off,
        sw: el.scrollWidth, cw: el.clientWidth, sh: el.scrollHeight, ch: el.clientHeight,
        rect: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)],
        text: el.textContent.trim().slice(0, 50) });
  });
  return bad;
});
console.log('OVERFLOW', JSON.stringify(overflow, null, 1));

// 7. english leakage in the DOM while in polish
await page.evaluate(() => window.__ascent.setLocale('pl'));
await page.waitForTimeout(600);
await shot('g-pl-hud');
const perf = await page.evaluate(() => window.__ascent.state().perf);
console.log('PERF', JSON.stringify(perf));
console.log('LOGS', logs.length); logs.forEach(l => console.log(l));
await browser.close();
