/**
 * Material-identity probe for the axiom lattice (build area, scratch tool).
 *
 * Places one ramp + one floor + one wall on the plaza and photographs them from
 * four viewing conditions — full sun, shade, backlit against the sky, and far
 * enough away for aerial perspective to bite. Then it decodes each frame and
 * reports the mean hue/value of the piece's own pixels, so "would a player name
 * the same material" is answered by numbers as well as by eyes.
 *
 *   node tools/critic/_buildmat.mjs --url http://127.0.0.1:4321 --out shots/mat
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 ? process.argv[i + 1] : d;
};
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/mat'));
const W = 1280, H = 760;

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => logs.push({ type: m.type(), text: m.text() }));
page.on('pageerror', (e) => logs.push({ type: 'pageerror', text: e.message }));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(2600);
await page.evaluate(() => {
  document.getElementById('boot')?.classList.add('gone');
  // the probe is about the pieces, not the chrome
  const s = document.createElement('style');
  s.textContent = '#ui{display:none!important}#boot{display:none!important}';
  document.head.appendChild(s);
});

// --- plant a specimen of every kind on flat-ish ground -----------------------
const site = await page.evaluate(() => {
  const a = window.__ascent;
  const b = a.builder;
  // the flattest 24 m patch near the spawn, so the specimens sit level
  let gx = 0, gz = 0, best = 1e9;
  for (let x = -60; x <= 60; x += 6) {
    for (let z = -60; z <= 60; z += 6) {
      const h = a.islandAt(x, z);
      if (h === null) continue;
      let dev = 0, n = 0, ok = true;
      for (const [ox, oz] of [[-10, 0], [10, 0], [0, -6], [0, 6], [18, 0], [-18, 0]]) {
        const q = a.islandAt(x + ox, z + oz);
        if (q === null) { ok = false; break; }
        dev += Math.abs(q - h); n++;
      }
      if (!ok) continue;
      const d = dev / n;
      if (d < best) { best = d; gx = x; gz = z; }
    }
  }
  const g = a.islandAt(gx, gz) ?? 12;
  const mk = (kind, x, z, yaw, base) => {
    const sp = { wall: 2.0, floor: 0.0, beam: 2.2, ramp: 0.0 }[kind];
    const p = {
      kind, x, z, yaw, base, y: base + sp,
      onGround: true, grow: 0, fade: 0, sel: 0, want: 0, tone: 0, dead: false,
      id: ++b.placedCount,
    };
    b.lattice.add(p); b.solids.add(p);
    return p;
  };
  mk('ramp', gx, gz, 0, g);
  mk('floor', gx + 8, gz, 0, g + 0.2);
  mk('wall', gx - 8, gz, 0, g);
  mk('beam', gx + 16, gz, 0, g + 2.0);
  a.player.pos.set(gx, g + 2, gz + 14);
  return { gx, gz, g };
});
// let the grow-in finish
await page.waitForTimeout(1400);

const SUN = { x: -0.740, z: -0.500 };
const L = Math.hypot(SUN.x, SUN.z);
const sx = SUN.x / L, sz = SUN.z / L;

/** Look at a target point from a bearing offset. */
async function look(name, dx, dz, dy, pitch) {
  await page.evaluate(({ dx, dz, dy, pitch, s }) => {
    const a = window.__ascent;
    const px = s.gx + dx, pz = s.gz + dz;
    a.player.pos.set(px, s.g + dy, pz);
    a.player.vel.set(0, 0, 0);
    // forward is (sin yaw, cos yaw): aim at the specimen row's middle
    a.player.yaw = Math.atan2(s.gx + 4 - px, s.gz - pz);
    a.player.pitch = pitch;
  }, { dx, dz, dy, pitch, s: site });
  // the cadet is subject to gravity: re-pin the camera each frame for a beat,
  // or the shot you take is of wherever he fell to
  await page.evaluate(({ dx, dz, dy, pitch, s }) => new Promise((res) => {
    const a = window.__ascent;
    const px = s.gx + dx, pz = s.gz + dz;
    let n = 0;
    const hold = () => {
      a.player.pos.set(px, s.g + dy, pz);
      a.player.vel.set(0, 0, 0);
      a.player.yaw = Math.atan2(s.gx + 4 - px, s.gz - pz);
      a.player.pitch = pitch;
      if (++n < 48) requestAnimationFrame(hold); else res();
    };
    hold();
  }), { dx, dz, dy, pitch, s: site });
  const f = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: f });
  // …and the same frame with the lattice hidden, so the measurement below can
  // mask exactly the pixels the pieces own rather than averaging the island.
  await page.evaluate(() => {
    window.__ascent.scene.getObjectByName('axiom-lattice').visible = false;
  });
  await page.waitForTimeout(120);
  const bg = path.join(OUT, `_bg-${name}.png`);
  await page.screenshot({ path: bg });
  await page.evaluate(() => {
    window.__ascent.scene.getObjectByName('axiom-lattice').visible = true;
  });
  await page.waitForTimeout(260);
  return f;
}

const shots = [];
// sunward: camera stands where the sun is, so we see the lit faces
shots.push(await look('a-sunlit', sx * 21 + 4, sz * 21, 6.5, -0.19));
// shade: camera opposite the sun, ramp's lit face away from us
shots.push(await look('b-shade', -sx * 21 + 4, -sz * 21, 6.5, -0.19));
// backlit: looking roughly into the sun across the pieces
shots.push(await look('c-backlit', -sx * 26 + 4, -sz * 26, 3.2, -0.05));
// far: aerial perspective at range
shots.push(await look('d-far', sz * 46 + 4, -sx * 46, 14, -0.22));
// close, standing on the deck of the ramp
shots.push(await look('e-close', 2.0, 9.0, 2.6, -0.10));

// --- decode + measure --------------------------------------------------------
const measure = await ctx.newPage();
await measure.goto('about:blank');
const stats = {};
const { readFile } = await import('node:fs/promises');
for (const f of shots) {
  const name = path.basename(f, '.png');
  const a64 = (await readFile(f)).toString('base64');
  const b64 = (await readFile(path.join(OUT, `_bg-${name}.png`))).toString('base64');
  stats[name] = await measure.evaluate(async ([da, db]) => {
    const load = async (s) => {
      const im = new Image(); im.src = 'data:image/png;base64,' + s; await im.decode();
      const c = document.createElement('canvas');
      c.width = im.width; c.height = im.height;
      c.getContext('2d').drawImage(im, 0, 0);
      return c.getContext('2d').getImageData(0, 0, c.width, c.height);
    };
    const A = await load(da), B = await load(db);
    let n = 0, sr = 0, sg = 0, sb = 0, sv = 0;
    const hues = new Array(12).fill(0);
    for (let i = 0; i < A.data.length; i += 4) {
      const dr = A.data[i] - B.data[i], dg = A.data[i + 1] - B.data[i + 1],
        db2 = A.data[i + 2] - B.data[i + 2];
      if (Math.abs(dr) + Math.abs(dg) + Math.abs(db2) < 26) continue;  // not ours
      const r = A.data[i] / 255, gg = A.data[i + 1] / 255, bb = A.data[i + 2] / 255;
      const mx = Math.max(r, gg, bb), mn = Math.min(r, gg, bb);
      if (mx < 0.03) continue;
      n++; sr += r; sg += gg; sb += bb; sv += mx;
      const sat = (mx - mn) / mx;
      let h = 0;
      if (mx !== mn) {
        if (mx === r) h = ((gg - bb) / (mx - mn) + 6) % 6;
        else if (mx === gg) h = (bb - r) / (mx - mn) + 2;
        else h = (r - gg) / (mx - mn) + 4;
        h *= 60;
      }
      if (sat > 0.10) hues[Math.floor(h / 30) % 12]++;
    }
    const m = Math.max(1, n);
    return {
      px: n,
      mean: [+(sr / m).toFixed(3), +(sg / m).toFixed(3), +(sb / m).toFixed(3)],
      value: +(sv / m).toFixed(3),
      hueHist: hues.map((v) => +(v / m).toFixed(3)),
    };
  }, [a64, b64]);
}

const errors = logs.filter((l) => l.type === 'error' || l.type === 'pageerror');
await writeFile(path.join(OUT, 'mat.json'), JSON.stringify({ stats, errors }, null, 2));
console.log(JSON.stringify(stats, null, 1));
console.log('console errors:', errors.length);
errors.slice(0, 6).forEach((e) => console.log('  !', e.text.split('\n')[0]));

// --- the critic's own test: one ramp, three hours ----------------------------
// The game has exactly one hour of the day, so the honest way to run "would a
// player name the same material at dawn, noon and dusk" is to move the light
// and leave everything else alone. These frames are a probe, not a feature.
const HOURS = [
  ['dawn', 0x6d8cff, 2.2, 0x8fb2e0, 1.10],
  ['noon', 0xffffff, 6.4, 0xd8e6ff, 0.55],
  ['dusk', 0xff7a2e, 4.6, 0x5a4a6e, 0.50],
];
await page.evaluate(({ dx, dz, dy, pitch, s }) => {
  const a = window.__ascent;
  const px = s.gx + dx, pz = s.gz + dz;
  a.player.pos.set(px, s.g + dy, pz);
  a.player.vel.set(0, 0, 0);
  a.player.yaw = Math.atan2(s.gx - px, s.gz - pz);
  a.player.pitch = pitch;
}, { dx: 1.5, dz: 11, dy: 2.6, pitch: -0.10, s: site });

for (const [name, key, ki, sky, hi] of HOURS) {
  await page.evaluate(({ key, ki, sky, hi, hold }) => new Promise((res) => {
    const a = window.__ascent;
    a.scene.traverse((o) => {
      if (o.isDirectionalLight && o.intensity > 2) { o.color.setHex(key); o.intensity = ki; }
      if (o.isHemisphereLight) { o.color.setHex(sky); o.intensity = hi; }
    });
    let n = 0;
    const step = () => {
      a.player.pos.set(hold.x, hold.y, hold.z);
      a.player.vel.set(0, 0, 0);
      if (++n < 40) requestAnimationFrame(step); else res();
    };
    step();
  }), {
    key, ki, sky, hi,
    hold: { x: site.gx + 1.5, y: site.g + 2.6, z: site.gz + 11 },
  });
  await page.screenshot({ path: path.join(OUT, `hour-${name}.png`) });
}

await browser.close();
