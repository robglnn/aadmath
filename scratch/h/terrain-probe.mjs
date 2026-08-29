import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2000);

const out = await page.evaluate(() => {
  const a = window.__ascent;
  const H = (x, z) => a.islandAt(x, z);
  // profile along the walk that got stuck: from (36,-88) toward (-10.4,-52.5)
  const from = { x: 36.0, z: -88.3 }, to = { x: -10.4, z: -52.5 };
  const d = Math.hypot(to.x - from.x, to.z - from.z);
  const ux = (to.x - from.x) / d, uz = (to.z - from.z) / d;
  const prof = [];
  for (let s = -6; s <= 40; s += 1) {
    const x = from.x + ux * s, z = from.z + uz * s;
    prof.push([s, +x.toFixed(1), +z.toFixed(1), H(x, z)]);
  }
  // gradient map around the stuck point
  const grid = [];
  for (let dz = -8; dz <= 8; dz += 2) {
    const row = [];
    for (let dx = -8; dx <= 8; dx += 2) {
      const h = H(from.x + dx, from.z + dz);
      row.push(h === null ? 'X' : h.toFixed(1));
    }
    grid.push(row.join(' '));
  }
  return { prof, grid };
});
console.log('PROFILE s, x, z, h');
for (const p of out.prof) console.log(p[0], p[1], p[2], p[3] === null ? 'null' : p[3].toFixed(2));
console.log('\nGRID (dz rows -8..8, dx cols -8..8, step 2)');
for (const r of out.grid) console.log(r);
await browser.close();
