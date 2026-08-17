/**
 * How long does a fall actually take to resolve? Real keys, fine-grained clock.
 */
import { chromium } from 'playwright';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4500);

const handBack = async () => {
  for (let i = 0; i < 8; i++) {
    if (!(await page.evaluate(() => !!window.__ascent.input.uiOpen))) return;
    let hit = false;
    for (const sel of ['.sc-go', '.ses-charter button', '.ses-rest button', '.rf-x']) {
      const b = await page.$(sel);
      if (b && await b.isVisible()) { await b.click().catch(() => {}); hit = true; break; }
    }
    if (!hit) await page.keyboard.press('Escape');
    await page.waitForTimeout(600);
  }
};
await handBack();

const info = await page.evaluate(() => {
  const a = window.__ascent;
  return { lowest: a.player.__lowest ?? null, rim: a.rifts ? 1 : 0 };
});
console.log('info', info);

const runs = [
  { keys: ['KeyW'], label: 'straight ahead', glide: true },
  { keys: ['KeyW', 'KeyA'], label: 'ahead-left', glide: false },
  { keys: ['KeyW', 'KeyD'], label: 'ahead-right', glide: true },
  { keys: ['KeyA'], label: 'left', glide: false },
  { keys: ['KeyS'], label: 'back', glide: false },
];

const facts = async () => {
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
  return page.evaluate(() => {
  const a = window.__ascent, p = a.player.pos;
  return {
    x: p.x, y: p.y, z: p.z,
    ground: a.islandAt(p.x, p.z), surface: a.surfaceAt(p.x, p.z),
    grounded: !!a.player.grounded, stuck: !!a.player.stuck,
    caught: a.player.caught | 0, recoveries: a.player.recoveries | 0,
    ui: !!a.input.uiOpen, gliding: !!a.player.gliding,
  };
});
};
const onSolid = (f) => (f.ground !== null || f.surface !== null) && f.grounded
  && Math.abs(f.y - (f.surface ?? f.ground)) < 3;

for (const run of runs) {
  for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft']) await page.keyboard.up(k).catch(() => {});
  await handBack();
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(900);
  await page.mouse.click(800, 450);
  await page.keyboard.down('ShiftLeft');
  for (const k of run.keys) await page.keyboard.down(k);

  let off = false, offAt = 0, done = false, yAtExit = 0;
  const t0 = Date.now();
  while ((Date.now() - t0) / 1000 < 60) {
    await page.waitForTimeout(100);
    const el = (Date.now() - t0) / 1000;
    const f = await facts();
    if (f.ui) { await handBack(); continue; }
    if (!off) {
      if (f.stuck) { console.log(`${run.label}: WEDGED at ${el.toFixed(1)}s`); break; }
      if (f.ground === null && f.surface === null) {
        off = true; offAt = el; yAtExit = f.y;
        if (run.glide) await page.keyboard.down('Space');
      } else if (el > 45) { console.log(`${run.label}: never reached the edge`); break; }
      continue;
    }
    if (onSolid(f)) {
      console.log(`${run.label}: OFF at y=${yAtExit.toFixed(1)} -> back in ${(el - offAt).toFixed(2)}s`
        + ` (glide=${run.glide})`);
      done = true; break;
    }
    if (el - offAt > 25) {
      console.log(`${run.label}: LOST ${(el - offAt).toFixed(1)}s, y=${f.y.toFixed(1)}, gliding=${f.gliding}`);
      break;
    }
  }
  if (!off && !done) { /* nothing */ }
  for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft']) await page.keyboard.up(k).catch(() => {});
}

const low = await page.evaluate(() => {
  // measure the lowest ground the way the player module does
  let lo = Infinity;
  const R = 200;
  for (let x = -R; x <= R; x += 4) for (let z = -R; z <= R; z += 4) {
    const h = window.__ascent.islandAt(x, z);
    if (typeof h === 'number' && h < lo) lo = h;
  }
  return lo;
});
console.log('lowest ground on the island:', low, '=> deck at', low - 3);

await browser.close();
