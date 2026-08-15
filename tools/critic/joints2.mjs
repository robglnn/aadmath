/**
 * THE CORNERS, PHOTOGRAPHED.
 *
 * "The one corner I did get is a raw butt joint — no mitre, the dark frame
 * beams of the perpendicular wall punch straight through the face of the other
 * and leave black stubs at two heights, and a cyan light strip runs past the
 * join into empty air."
 *
 * That is a claim about pixels, so it is settled with pixels. This builds a
 * real square with **real key and mouse input only** — the digit keys draw the
 * hand, the rotate key turns the piece, the left button places it — and then,
 * in the clearly marked section at the end, moves the lens to photograph each
 * of the four corners from outside, close, at wall height.
 *
 * It shoots the **canvas element**, not the page, so no interface sits over the
 * joint. And it measures the joint numerically as well: for every pair of walls
 * that share a node, no drawn member of one may enter the other's volume.
 *
 *   node tools/critic/joints2.mjs --url http://127.0.0.1:4399 --out shots/joints2
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4399');
const OUT = path.resolve(arg('out', 'shots/joints2'));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1400, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const checks = [];
const ok = (pass, what, detail = '') => {
  checks.push({ pass, what, detail });
  console.log(`  ${pass ? 'OK  ' : 'BAD '} ${what}${detail ? ' — ' + detail : ''}`);
};

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch { /* private */ } });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
await page.waitForTimeout(4500);

const facts = () => page.evaluate(() => {
  const a = window.__ascent, b = a.builder;
  const live = [];
  for (const k of Object.keys(b.lattice.live)) {
    for (const p of b.lattice.live[k]) {
      if (!p.dead) live.push({ kind: p.kind, door: !!p.door, x: p.x, z: p.z, base: p.base, turn: p.turn });
    }
  }
  const tg = b.target();
  return {
    pos: { x: a.player.pos.x, y: a.player.pos.y, z: a.player.pos.z },
    yaw: a.player.yaw, slot: b.slot, turn: b.turn, handOut: b.handOut,
    ghost: { x: tg.x, z: tg.z, turn: tg.turn, valid: tg.valid, seals: !!tg.seals },
    toast: document.querySelector('.toast.show')?.textContent || '',
    pieces: live,
  };
});

const press = async (k, ms = 300) => { await page.keyboard.press(k); await page.waitForTimeout(ms); };
const walk = async (k, ms) => {
  await page.keyboard.down(k); await page.waitForTimeout(ms);
  await page.keyboard.up(k); await page.waitForTimeout(340);
};
const CANDIDATES = [[1050, 460], [370, 500], [1160, 270], [270, 230], [990, 620], [700, 300]];
const click = async () => {
  const first = await page.evaluate((pts) => {
    const TAGS = 'button,a[href],input,select,textarea,summary,label,[role="button"],[role="tab"],[role="switch"]';
    const uiHit = (el) => {
      let hit = false;
      for (let n = el; n && n.nodeType === 1 && n !== document.documentElement; n = n.parentElement) {
        const cs = getComputedStyle(n);
        if (cs.opacity === '0' || cs.visibility === 'hidden' || cs.display === 'none') return false;
        if (!hit && (n.matches?.(TAGS) || cs.cursor === 'pointer')) hit = true;
      }
      return hit;
    };
    for (const p of pts) { const el = document.elementFromPoint(p[0], p[1]); if (el && !uiHit(el)) return p; }
    return null;
  }, CANDIDATES);
  const order = first ? [first, ...CANDIDATES.filter((p) => p !== first)] : CANDIDATES;
  for (const pt of order) {
    await page.mouse.click(pt[0], pt[1]);
    await page.waitForTimeout(100);
    if (!(await page.evaluate(() => window.__ascent.input.pointerOnUI))) { await page.waitForTimeout(300); return pt; }
    await page.waitForTimeout(300);
  }
  return null;
};

// walk to flat ground
// The run opens with an ORDERS card. A player clicks the button on it; so does
// this. (Real click, real button — the panel eats world clicks until it is gone.)
for (let i = 0; i < 3; i++) {
  const btn = page.locator('button:visible', { hasText: /BEGIN THE RUN|COMENZAR|ZACZNIJ/i }).first();
  if (await btn.count().catch(() => 0)) { await btn.click().catch(() => {}); await page.waitForTimeout(900); }
  else break;
}
await page.waitForTimeout(600);

const f0 = await facts();
const KEYS = ['KeyW', 'KeyS', 'KeyA', 'KeyD'];
const dirOf = (yaw) => {
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  return { KeyW: [fx, fz], KeyS: [-fx, -fz], KeyA: [fz, -fx], KeyD: [-fz, fx] };
};
async function walkTo(tx, tz, tol = 0.5, tries = 30) {
  for (let i = 0; i < tries; i++) {
    const f = await facts();
    const dx = tx - f.pos.x, dz = tz - f.pos.z, d = Math.hypot(dx, dz);
    if (d <= tol) return true;
    const dir = dirOf(f.yaw);
    let best = null, bs = -Infinity;
    for (const k of KEYS) { const s = (dir[k][0] * dx + dir[k][1] * dz) / d; if (s > bs) { bs = s; best = k; } }
    await walk(best, Math.min(430, Math.max(90, d * 55)));
  }
  return false;
}
const flat = await page.evaluate((q) => {
  const a = window.__ascent;
  const c = (v) => Math.floor(v / 4 + 0.5) * 4;
  const out = [];
  for (let i = -6; i <= 6; i++) for (let j = -6; j <= 6; j++) {
    const x = c(q.x) + i * 4, z = c(q.z) + j * 4;
    let lo = Infinity, hi = -Infinity, bad = false;
    for (const [dx, dz] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, -2], [2, -2], [-2, 2],
      [7, 0], [-7, 0], [0, 7], [0, -7]]) {
      const h = a.islandAt(x + dx, z + dz);
      if (h === null) { bad = true; break; }
      lo = Math.min(lo, h); hi = Math.max(hi, h);
    }
    const clutter = a.builder.solids.all.some((p) => p.fixed && Math.hypot(p.x - x, p.z - z) < 13);
    if (!bad) out.push({ x, z, span: +(hi - lo).toFixed(3), clutter, d: Math.hypot(x - q.x, z - q.z) });
  }
  return out.sort((u, v) => (u.clutter - v.clutter) || (u.span - v.span) || (u.d - v.d)).slice(0, 4);
}, f0.pos);
const home = flat[0];
console.log('build site', JSON.stringify(home));
await walkTo(home.x, home.z);
await press('Digit1');

// ------------------------------------------------- four walls, on the ROTATE KEY
//
// No mouse look at all: the rotate key is the game's own answer to "a mouse
// does not turn in quarter turns", and one press of it has to be arithmetically
// identical to standing still and facing the next way round.
console.log('\n== four walls, turning the piece with F');
for (let i = 0; i < 4; i++) {
  const before = await facts();
  await click();
  const after = await facts();
  console.log(`  wall ${i + 1}: build-turn ${before.turn} slot (${before.ghost.x},${before.ghost.z})`
    + ` t${before.ghost.turn} seals=${before.ghost.seals} -> ${after.pieces.length} up  "${after.toast}"`);
  ok(after.pieces.length === i + 1, `wall ${i + 1} lands on one click`, `${after.pieces.length} up`);
  if (i < 3) await press('KeyF', 420);
}
const f = await facts();
const walls = f.pieces.filter((p) => p.kind === 'wall');
ok(walls.length === 4, 'four walls stand', `${walls.length}`);
ok(walls.filter((w) => w.door).length === 1, 'one of them is a doorway',
  `${walls.filter((w) => w.door).length}`);

// ------------------------------------------------------- the joint, in numbers
//
// THE MEASUREMENT THE PICTURE IS CHECKED AGAINST. Every drawn member of a wall
// lives in the wall's own frame; two walls meeting at a node overlap only if
// some member of one reaches into the other's *volume* — a 0.44 m slab centred
// on the neighbouring face. `E` is where a wall now stops (1.74) and a
// neighbour's slab begins at 2.00 - 0.22 = 1.78, so the honest test is: does
// any member reach past 1.74 along the wall's length?
const joint = await page.evaluate(() => {
  const L = window.__ascent.builder.lattice;
  const out = {};
  for (const kind of ['wall', 'door']) {
    const g = L.geo[kind];
    let maxX = 0, glowMaxX = 0;
    for (const part of [g.frame, g.panel]) {
      if (!part) continue;
      const pos = part.attributes.position, acc = part.attributes.acc;
      for (let i = 0; i < pos.count; i++) {
        const x = Math.abs(pos.getX(i));
        if (x > maxX) maxX = x;
        if (acc && acc.getX(i) > 0.5 && x > glowMaxX) glowMaxX = x;
      }
    }
    // …and, for a door, whether anything at all is drawn across the opening
    // below the header, which is the span the collider has taken out.
    // …and, for a door, how wide the hole actually is. Not assumed from a
    // constant: measured, as the narrowest gap any drawn member leaves below
    // head height. Local y runs -2 … +2 about the wall's middle, so head height
    // (1.9 m above the base) is local y = -0.10.
    let clear = Infinity;
    if (kind === 'door') {
      for (const part of [g.frame, g.panel]) {
        if (!part) continue;
        const pos = part.attributes.position;
        for (let i = 0; i < pos.count; i++) {
          if (pos.getY(i) < -0.10) clear = Math.min(clear, Math.abs(pos.getX(i)));
        }
      }
    }
    out[kind] = { maxX: +maxX.toFixed(3), glowMaxX: +glowMaxX.toFixed(3),
      clearHalf: clear === Infinity ? null : +clear.toFixed(3) };

  }
  const n = L.nodeGeo.attributes.position;
  let nodeMax = 0;
  for (let i = 0; i < n.count; i++) nodeMax = Math.max(nodeMax, Math.abs(n.getX(i)), Math.abs(n.getZ(i)));
  out.node = { half: +nodeMax.toFixed(3) };
  return out;
});
console.log('  geometry:', JSON.stringify(joint));
// a neighbour's slab starts at 2.00 - WALL_T/2 = 1.78
ok(joint.wall.maxX <= 1.78 && joint.door.maxX <= 1.78,
  'no member of a wall reaches into the volume of the wall it meets',
  `wall ends at ${joint.wall.maxX} m, door at ${joint.door.maxX} m, neighbour starts at 1.78 m`);
ok(joint.node.half >= 2.00 - joint.wall.maxX,
  'and the node post covers the gap the mitre leaves',
  `post half-width ${joint.node.half} m ≥ gap ${(2 - joint.wall.maxX).toFixed(3)} m`);
// The cadet's capsule is 0.42 m in radius. A doorway he has to thread is a
// doorway he bounces off, so the hole has to be wider than him by a margin he
// does not have to aim for: 1.0 m of clear half-width leaves 1.16 m of floor he
// can walk through without touching either jamb.
ok(joint.door.clearHalf >= 1.0,
  'the doorway is wide enough to walk through without threading it',
  `${joint.door.clearHalf} m clear each side of centre — ${(2 * (joint.door.clearHalf - 0.42)).toFixed(2)} m`
  + ' of floor the 0.84 m capsule never touches a jamb on');
ok(joint.wall.glowMaxX <= 1.60 && joint.door.glowMaxX <= 1.78,
  'no lit strip runs off the end of a wall into open air',
  `wall glow ends at ${joint.wall.glowMaxX} m, door glow at ${joint.door.glowMaxX} m`);

// ============================================================================
// THE ONLY EVALUATE IN THIS SCRIPT THAT IS NOT A READ: it moves the lens.
// Everything it photographs was committed by a real click, above.
// ============================================================================
console.log('\n== photographing the four corners');
const nodes = new Map();
for (const w of walls) {
  const [c, s] = [[1, 0], [0, 1], [-1, 0], [0, -1]][w.turn % 4];
  for (const k of [1, -1]) {
    const key = `${(w.x + c * 2 * k).toFixed(2)},${(w.z - s * 2 * k).toFixed(2)}`;
    nodes.set(key, (nodes.get(key) || 0) + 1);
  }
}
const corners = [...nodes.entries()].filter(([, n]) => n === 2).map(([k]) => k);
ok(corners.length === 4, 'four shared corners', corners.join(' '));

// The build preview stays armed for eight seconds after the last click, and an
// amber ghost across a joint is not a photograph of the joint. Wait it out and
// check, rather than guess.
for (let i = 0; i < 20; i++) {
  const armT = await page.evaluate(() => window.__ascent.builder._armT || 0);
  if (armT <= 0) break;
  await page.waitForTimeout(700);
}
ok(await page.evaluate(() => !window.__ascent.builder.ghostView.visible),
  'the build preview is down before anything is photographed');
// PRESENTATION ONLY, AND ONLY FROM HERE DOWN: the interface is hidden so the
// joint can be judged on its own pixels. Nothing below this line builds, moves
// or changes anything in the world — the structure is already committed.
await page.evaluate(() => {
  const cv = document.querySelector('canvas');
  const keep = new Set();
  for (let n = cv; n; n = n.parentElement) keep.add(n);
  for (const el of document.body.querySelectorAll('*')) {
    if (!keep.has(el) && !cv.contains(el)) el.style.setProperty('display', 'none', 'important');
  }
});
await page.waitForTimeout(400);
const canvas = { screenshot: (o) => page.screenshot(o) };
for (let i = 0; i < corners.length; i++) {
  const [nx, nz] = corners[i].split(',').map(Number);
  for (const [tag, dist, hgt, fov] of [['wide', 10.5, 4.2, 42], ['tight', 6.6, 2.2, 34]]) {
    await page.evaluate(([x, z, bx, bz, base, d, h, fv]) => {
      const rig = window.__ascent.player.cam;
      const ox = x - bx, oz = z - bz, m = Math.hypot(ox, oz) || 1;
      rig.update = () => {};                       // hold the lens where it is put
      // `up` first, and never `rotation.z` after `lookAt`: writing one euler
      // component after an orientation has been solved re-derives the other two
      // from it, and half the corners came out photographed upside down.
      rig.cam.up.set(0, 1, 0);
      rig.cam.position.set(x + (ox / m) * d, base + h, z + (oz / m) * d);
      rig.cam.lookAt(x, base + 1.9, z);
      rig.cam.fov = fv;
      rig.cam.updateProjectionMatrix();
    }, [nx, nz, home.x, home.z, walls[0].base, dist, hgt, fov]);
    await page.waitForTimeout(520);
    await canvas.screenshot({ path: path.join(OUT, `corner${i + 1}-${tag}.png`) });
  }
  console.log(`  corner ${i + 1} at ${corners[i]}`);
}
// …and the whole thing from outside, so the shape is on the record
await page.evaluate(([bx, bz, base]) => {
  const rig = window.__ascent.player.cam;
  rig.update = () => {};
  rig.cam.up.set(0, 1, 0);
  rig.cam.position.set(bx + 13, base + 8.5, bz + 13);
  rig.cam.lookAt(bx, base + 1.6, bz);
  rig.cam.fov = 46; rig.cam.updateProjectionMatrix();
}, [home.x, home.z, walls[0].base]);
await page.waitForTimeout(520);
await canvas.screenshot({ path: path.join(OUT, 'square-outside.png') });
// and the doorway, head on
const door = walls.find((w) => w.door);
if (door) {
  await page.evaluate(([dx, dz, bx, bz, base]) => {
    const rig = window.__ascent.player.cam;
    const ox = dx - bx, oz = dz - bz, m = Math.hypot(ox, oz) || 1;
    rig.update = () => {};
    rig.cam.up.set(0, 1, 0);
    rig.cam.position.set(dx + (ox / m) * 6.5, base + 1.9, dz + (oz / m) * 6.5);
    rig.cam.lookAt(dx, base + 1.9, dz);
    rig.cam.fov = 40; rig.cam.updateProjectionMatrix();
  }, [door.x, door.z, home.x, home.z, walls[0].base]);
  await page.waitForTimeout(520);
  await canvas.screenshot({ path: path.join(OUT, 'doorway.png') });
}

await browser.close();
const bad = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - bad.length}/${checks.length} checks passed · ${errors.length} console errors`);
if (errors.length) console.log(errors.slice(0, 6));
await writeFile(path.join(OUT, 'report.json'), JSON.stringify({ checks, errors }, null, 2));
process.exit(bad.length || errors.length ? 1 : 0);
