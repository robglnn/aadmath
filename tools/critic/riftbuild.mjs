/**
 * The lattice at a rift: a beam becomes the balance, a floor becomes the area
 * model. Both pieces changed shape when the lattice was rebuilt, so both rigs
 * have to be photographed on the real geometry rather than trusted.
 *
 *   node tools/critic/riftbuild.mjs --out shots/riftbuild [--url …]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/riftbuild'));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch { /* private */ } });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(2800);

const setup = await page.evaluate(() => {
  const a = window.__ascent, b = a.builder;
  b.drawHand(); b.clearAll();
  b.charge = 1e6; b.maxCharge = 1e6;
  document.getElementById('boot')?.classList.add('gone');
  const r = a.rifts.list.find((x) => !x.locked) || a.rifts.list[0];
  window.__rb = {
    rift: r,
    stand(dx, dz, yaw) {
      const g = a.islandAt(r.pos.x + dx, r.pos.z + dz);
      a.player.pos.set(r.pos.x + dx, (g === null ? r.pos.y : g) + 0.1, r.pos.z + dz);
      a.player.vel.set(0, 0, 0);
      a.player.yaw = yaw; a.player.pitch = -0.08;
    },
    set(kind) {
      const n = ['wall', 'ramp', 'floor', 'beam', 'vault'].indexOf(kind);
      b.setSlot(n); a.input.slot = n;
      b.charge = 1e6;
      return a.build();
    },
    look(dx, dy, dz, yaw, pitch) {
      const g = a.islandAt(r.pos.x + dx, r.pos.z + dz);
      a.player.pos.set(r.pos.x + dx, (g === null ? r.pos.y : g) + dy, r.pos.z + dz);
      a.player.vel.set(0, 0, 0);
      a.player.yaw = yaw; a.player.pitch = pitch;
      b._armT = 0; b.ghostView.visible = false;
    },
    rigs: () => b.man.items.map((m) => ({ kind: m.kind, tags: m.tags.length, load: m.load.length })),
  };
  return { rift: r.id, at: [r.pos.x, r.pos.y, r.pos.z] };
});
console.log('rift', setup.rift, setup.at);

const shot = async (name, ms = 700) => {
  await page.waitForTimeout(ms);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
};

// --- the beam becomes the balance ------------------------------------------
const beam = await page.evaluate(() => {
  window.__rb.stand(0, 7, Math.PI);
  const r = window.__rb.set('beam');
  return { placed: r.ok, reason: r.reason || '', rigs: window.__rb.rigs() };
});
console.log('beam ->', JSON.stringify(beam));
await page.evaluate(() => window.__rb.look(6.5, 1.6, 8.5, -2.5, -0.02));
await shot('01-balance');

// --- the floor becomes the area model --------------------------------------
const floor = await page.evaluate(() => {
  window.__ascent.builder.clearAll();
  window.__rb.stand(0, 9, Math.PI);
  const r = window.__rb.set('floor');
  return { placed: r.ok, reason: r.reason || '', rigs: window.__rb.rigs() };
});
console.log('floor ->', JSON.stringify(floor));
await page.evaluate(() => window.__rb.look(0, 5.2, 11.5, Math.PI, -0.42));
await shot('02-area-model');

const ok = beam.rigs.some((r) => r.kind === 'balance') && floor.rigs.some((r) => r.kind === 'area');
console.log('console errors:', errors.length, errors.slice(0, 3).join(' | '));
await writeFile(path.join(OUT, 'riftbuild.json'), JSON.stringify({ beam, floor, errors }, null, 2));
console.log(ok ? 'both manipulatives attached' : 'MANIPULATIVE MISSING');
await browser.close();
process.exit(ok && !errors.length ? 0 : 1);
