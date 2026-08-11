/**
 * Pixels for the reward economy: the orders card that used to print a rep
 * count, the kit strip in a thumb zone, the hanging cache from both bands a
 * player can act from, and a spent vein re-lighting.
 *
 *   node tools/critic/econ-shots.mjs --url http://127.0.0.1:5173 --out shots/econ
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/econ'));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const errors = [];

async function open(w, h, mobile) {
  const ctx = await browser.newContext({
    viewport: { width: w, height: h }, deviceScaleFactor: 2,
    hasTouch: !!mobile, isMobile: !!mobile,
    userAgent: mobile ? 'Mozilla/5.0 (iPhone; CPU iPhone OS 17_0 like Mac OS X) AppleWebKit/605.1.15 (KHTML, like Gecko) Version/17.0 Mobile/15E148 Safari/604.1' : undefined,
  });
  const page = await ctx.newPage();
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  return page;
}

const shot = (page, name, ms = 400) => page.waitForTimeout(ms)
  .then(() => page.screenshot({ path: path.join(OUT, name + '.png') }));

// --- 1. the orders card: named as a capability, never as a quota ------------
{
  const page = await open(1600, 900);
  await page.evaluate(() => {
    // a returning learner, so the card opens on the fast path
    const A = window.__ascent;
    const m = A.mastery;
    let n = 0;
    for (const s of m.state.values()) { if (n++ < 2) { s.mastered = true; s.everMastered = true; s.pL = 0.97; } }
    A.session.reset?.();
    A.kit.sync();
  });
  await page.waitForTimeout(600);
  await page.evaluate(() => window.__ascent.session.begin());
  await page.waitForFunction(() => document.querySelector('.ses-charter.show'), null, { timeout: 40000 });
  console.log('orders:', await page.evaluate(() => document.querySelector('.sc-goal')?.textContent));
  await shot(page, '01-orders-en', 900);
  await page.evaluate(() => window.__ascent.setLocale('es'));
  await shot(page, '02-orders-es', 700);
  await page.evaluate(() => window.__ascent.setLocale('pl'));
  await shot(page, '03-orders-pl', 700);
  await page.close();
}

// --- 2. the cache, from both bands -----------------------------------------
{
  const page = await open(1600, 900);
  await page.waitForTimeout(2500);
  const aim = async (dist, up) => page.evaluate(({ dist, up }) => {
    const A = window.__ascent;
    const c = A.caches.list.find((x) => !x.opened);
    // stand on the perch beside the counterweights, or hang back off the rig
    const f = new A.THREE.Vector3(0, 0, 1).applyQuaternion(c.group.quaternion);
    A.player.pos.set(c.x + f.x * dist, c.y + up, c.z + f.z * dist);
    A.player.vel.set(0, 0, 0);
    const yaw = Math.atan2(-f.x, -f.z);
    A.player.yaw = yaw;
    if (A.player.cam) { A.player.cam.yaw = yaw; A.player.cam.pitch = 0.06; }
    return { x: c.x, y: c.y, z: c.z, latex: c.q.latex };
  }, { dist, up });
  const c = await aim(6, 1.2);
  await shot(page, '04-cache-perch', 900);
  await aim(20, 2);
  await shot(page, '05-cache-back-20m', 900);
  await aim(38, 3);
  await shot(page, '06-cache-back-40m', 900);
  console.log('cache at', c);
  await page.close();
}

// --- 3. the kit strip on a phone, against the thumb zone -------------------
{
  const page = await open(390, 844, true);
  await page.waitForTimeout(2600);
  await shot(page, '07-phone-kit-locked');
  await page.evaluate(() => {
    const A = window.__ascent;
    let n = 0;
    for (const s of A.mastery.state.values()) { if (n++ < 8) { s.mastered = true; s.everMastered = true; s.pL = 0.97; } }
    A.kit.sync();
  });
  await page.waitForTimeout(1200);
  await shot(page, '08-phone-kit-verbs', 900);
  const box = await page.evaluate(() => {
    const els = [...document.querySelectorAll('.kit-chip')].filter((e) => e.style.display !== 'none');
    return els.map((e) => { const r = e.getBoundingClientRect(); return { id: e.dataset.id, x: Math.round(r.x), y: Math.round(r.y), b: Math.round(r.bottom) }; });
  });
  console.log('phone chips', JSON.stringify(box), 'viewport 390x844');
  await page.close();
}

// --- 4. the drift: a vein standing, and the same vein spent -----------------
{
  const page = await open(1600, 900);
  await page.waitForTimeout(2500);
  const aim = await page.evaluate(() => {
    const A = window.__ascent;
    // the drift's own veins, found through the world rather than through a mock
    const f = A.drift.field();
    const g = A.scene.getObjectByName('drift');
    return f;
  });
  console.log('field', JSON.stringify(aim));
  // stand a few metres off a lit vein and look at it
  await page.evaluate(() => {
    const A = window.__ascent;
    const m = A.drift.__motes || null;
    return m;
  });
  await page.evaluate(() => {
    const A = window.__ascent;
    const v = A.drift.veinAt ? A.drift.veinAt(0) : null;
    if (!v) return null;
    A.player.pos.set(v.x, (A.islandAt(v.x, v.z) ?? 8) + 1.4, v.z + 14);
    A.player.vel.set(0, 0, 0);
    const yaw = Math.PI;
    A.player.yaw = yaw;
    if (A.player.cam) A.player.cam.yaw = yaw;
    return [v.x, v.z];
  });
  await shot(page, '09-vein-lit', 1200);
  // walk through it: four crystals, then the vein is dark for five minutes
  await page.evaluate(async () => {
    const A = window.__ascent;
    const v = A.drift.veinAt(0);
    for (const m of v.motes) {
      A.player.pos.set(m.x, m.y - 0.6, m.z);
      await new Promise((r) => setTimeout(r, 180));
    }
    A.player.pos.set(v.x, (A.islandAt(v.x, v.z) ?? 8) + 1.4, v.z + 14);
  });
  await shot(page, '10-vein-spent', 1400);
  console.log('after harvest', JSON.stringify(await page.evaluate(() => window.__ascent.drift.field())));
  await page.close();
}

console.log('console errors:', errors.length);
for (const e of errors.slice(0, 5)) console.log('  ', e);
await browser.close();
process.exit(errors.length ? 1 : 0);
