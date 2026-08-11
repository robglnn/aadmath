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

// land squarely on perch 1 and look at the apparatus
const info = await page.evaluate(() => {
  const a = window.__ascent;
  const c = a.caches.state().at[1];
  const p = a.player;
  p.pos.set(c.x, c.y + 1.2, c.z + 4); p.vel.set(0,0,0); p.yaw = Math.PI; p.pitch = -0.02;
  return { c, top: a.surfaceAt(c.x, c.z + 4) };
});
console.log('perch', JSON.stringify(info));
await page.waitForTimeout(2000);
const st = await page.evaluate(() => { const p = window.__ascent.player; return { y: p.pos.y, grounded: p.loco?.grounded, state: p.loco?.state }; });
console.log('after 2s on perch:', JSON.stringify(st));
await page.screenshot({ path: 'shots/critic-cache/03-perch.png' });

// find the counterweight world positions from the live scene
const stones = await page.evaluate(() => {
  const a = window.__ascent;
  const out = [];
  a.scene.getObjectByName('caches').updateMatrixWorld(true);
  a.scene.getObjectByName('caches').traverse(o => {
    if (o.isMesh && o.geometry?.type === 'OctahedronGeometry' && o.material?.emissive && o.material.emissive.getHex() === 0x7a5bff) {
      const v = new a.THREE.Vector3(); o.getWorldPosition(v); out.push([+v.x.toFixed(1), +v.y.toFixed(1), +v.z.toFixed(1)]);
    }
  });
  return out;
});
console.log('counterweights:', JSON.stringify(stones));

// walk into each weight with real feet
const res = await page.evaluate(async (stones) => {
  const a = window.__ascent, p = a.player;
  const sleep = ms => new Promise(r => setTimeout(r, ms));
  const c = a.caches.state().at[1];
  const near = stones.filter(s => Math.hypot(s[0]-c.x, s[2]-c.z) < 30);
  const log = [];
  for (const s of near) {
    const b = a.caches.state().opened;
    p.pos.set(s[0], s[1] - 0.2, s[2] + 3.2); p.vel.set(0,0,0);
    await sleep(300);
    // walk in, 0.25 m/step
    for (let i = 0; i < 24; i++) { p.pos.z -= 0.25; await sleep(45); }
    await sleep(1400);
    const st = a.caches.state();
    log.push({ stone: s, opened: st.opened, shards: a.state().shards });
    if (st.opened > b) return { log, won: true };
  }
  return { log, won: false };
}, stones);
console.log('walk result:', JSON.stringify(res).slice(0, 900));
await page.waitForTimeout(1200);
await page.screenshot({ path: 'shots/critic-cache/04-result.png' });
const fin = await page.evaluate(() => ({ caches: window.__ascent.caches.state().opened, shards: window.__ascent.state().shards, drift: window.__ascent.drift.stats }));
console.log('final:', JSON.stringify(fin));
console.log('errors', errs.length, errs.slice(0,4));
await browser.close();
