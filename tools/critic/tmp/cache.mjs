import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const URL = process.argv[2] || 'http://127.0.0.1:4877';
await mkdir('shots/critic-cache', { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent);
await page.evaluate(() => localStorage.removeItem('ascent.save'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent);
await page.waitForTimeout(3000);
await page.mouse.move(800,450); await page.mouse.click(800,450); await page.waitForTimeout(300);

const cs = await page.evaluate(() => window.__ascent.caches.state());
console.log('caches:', JSON.stringify(cs.at));

// stand on the nearest perch and look at the apparatus
const c = cs.at[1];
await page.evaluate((c) => { const p = window.__ascent.player;
  p.pos.set(c.x, c.y + 2.0, c.z + 12); p.vel.set(0,0,0); p.yaw = 0; p.pitch = -0.08; }, c);
await page.waitForTimeout(1600);
await page.screenshot({ path: 'shots/critic-cache/01-perch.png' });
const st1 = await page.evaluate(() => ({ y: window.__ascent.player.pos.y, grounded: window.__ascent.player.loco?.grounded, state: window.__ascent.player.loco?.state }));
console.log('standing on perch?', JSON.stringify(st1));

// walk into the correct weight, the way a foot does
const res = await page.evaluate(async () => {
  const a = window.__ascent, p = a.player;
  const before = a.state().shards;
  const cc = a.caches;
  // find the live cache object nearest us and its stones through the scene graph
  const grp = a.scene.getObjectByName('caches');
  const info = [];
  grp.traverse(o => { if (o.geometry?.type === 'OctahedronGeometry' && o.material?.emissive) info.push(o); });
  return { before, stoneMeshes: info.length };
});
console.log('shards before', res.before, 'octahedron meshes in caches group:', res.stoneMeshes);

// drive the feet: walk toward each of the three weights in turn
const walk = await page.evaluate(async (c) => {
  const a = window.__ascent, p = a.player;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const log = [];
  // stones sit at local (k-1)*3.6, 1.5, 3.0 relative to the cache group origin
  for (let k = 0; k < 3; k++) {
    const before = a.caches.state();
    p.pos.set(c.x + (k - 1) * 3.6, c.y + 2.2, c.z + 3.0);
    p.vel.set(0,0,0);
    await sleep(700);
    const after = a.caches.state();
    log.push({ k, shards: a.state().shards, opened: after.opened });
    if (after.opened > before.opened) break;
  }
  return log;
}, c);
console.log('walking into weights ->', JSON.stringify(walk));
await page.waitForTimeout(1500);
await page.screenshot({ path: 'shots/critic-cache/02-after.png' });
const fin = await page.evaluate(() => ({ caches: window.__ascent.caches.state(), shards: window.__ascent.state().shards, drift: window.__ascent.drift.stats }));
console.log('final:', JSON.stringify(fin).slice(0,600));
console.log('errors', errs.length, errs.slice(0,4));
await browser.close();
