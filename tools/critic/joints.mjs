/**
 * THE JOINT RIG.
 *
 * Builds the exact structures a player complained about — a closed square of
 * four walls, a wall meeting a floor, a floor meeting a floor, a ramp meeting a
 * floor, a ramp meeting a wall — by *playing the real aiming code*: it moves the
 * cadet, points him, and calls the same `place()` a click calls. Nothing is
 * teleported into the collider behind the builder's back, so if the aim picks
 * the wrong slot this rig reports it rather than hiding it.
 *
 * Then it photographs every joint close enough to see a millimetre, and prints
 * the numbers the pictures are supposed to agree with.
 *
 *   node tools/critic/joints.mjs --out shots/joints [--url …]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/joints'));
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
await page.waitForTimeout(3000);

// The rig drives the game; these helpers are the only things it adds.
await page.evaluate(() => {
  const a = window.__ascent;
  a.player.root.visible = false;              // keep the cadet out of the shot
  const b = a.builder;
  b.drawHand();
  window.__joint = {
    reset() {
      b.clearAll();
      b.lattice.update(1, 0); b.lattice.update(1, 0);
      b.charge = 1e6; b.maxCharge = 1e6;
      b.allowed = new Set(['wall', 'ramp', 'floor', 'beam', 'vault']);
    },
    /** Stand somewhere, face a way, and set a piece the way a click would. */
    set(kind, x, y, z, yaw) {
      const n = ['wall', 'ramp', 'floor', 'beam', 'vault'].indexOf(kind);
      b.setSlot(n); a.input.slot = n;   // main.js re-syncs the slot from input
      a.player.pos.set(x, y, z);
      a.player.vel.set(0, 0, 0);
      a.player.yaw = yaw;
      a.player.pitch = -0.1;
      b.charge = 1e6;
      const tg = b.target();
      const r = b.place();
      return { ok: r.ok, reason: r.reason || '', kind,
        at: [tg.x, tg.z], base: tg.base, turn: tg.turn };
    },
    /**
     * Look at a point from a point, both heights measured off the plaza floor.
     * The camera boom puts the lens a little behind and above the cadet.
     */
    look(fx, fy, fz, tx, ty, tz) {
      const g = a.islandAt(0, 0);
      a.player.pos.set(fx, g + fy, fz);
      a.player.vel.set(0, 0, 0);
      a.player.yaw = Math.atan2(tx - fx, tz - fz);
      a.player.pitch = Math.atan2((ty - fy), Math.hypot(tx - fx, tz - fz));
      // The preview is a hard-light hologram of the *next* piece; leaving it up
      // in a joint photograph is photographing the ghost, not the joint.
      b._armT = 0;
      b._held = false;
      b.ghostView.visible = false;
      document.getElementById('ui').style.display = 'none';
    },
    pieces() {
      const out = [];
      // `k` is the RENDER batch, not the kind. A wall that has had a doorway
      // cut into it draws from its own batch (`door`) because a hole is a
      // different geometry — it is still, to the collider and to every check
      // here, a wall. Reporting the batch as the kind made a closed square look
      // like three walls and one missing one.
      for (const k of Object.keys(b.lattice.live)) {
        void k;
        for (const p of b.lattice.live[k]) {
          if (!p.dead) {
            out.push({ kind: p.kind, door: !!p.door, x: p.x, y: p.y, z: p.z,
              base: p.base, turn: p.turn });
          }
        }
      }
      return out.sort((u, v) => u.kind.localeCompare(v.kind) || u.x - v.x || u.z - v.z);
    },
    ground: (x, z) => a.islandAt(x, z),
    nodes: () => b.lattice.nodes.count,
    /** Where a world point lands on the screen, in CSS pixels. */
    project(x, y, z) {
      const v = new a.THREE.Vector3(x, a.islandAt(0, 0) + y, z).project(a.camera);
      return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
    },
  };
});

const G = await page.evaluate(() => window.__joint.ground(0, 0));
console.log('plaza ground', G);

const report = [];
const shot = async (name, ms = 420) => {
  await page.waitForTimeout(ms);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
};
/**
 * The zoom. A joint is a few centimetres wide in a 1600-pixel frame, so judging
 * one from a wide shot is judging a rumour. This projects the joint's own world
 * point onto the screen and clips real pixels around it — at deviceScaleFactor
 * 2 a 420-pixel window is an 840-pixel photograph of half a metre of metal.
 */
const zoom = async (name, pt, size = 420, ms = 420) => {
  await page.waitForTimeout(ms);
  const p = await page.evaluate((q) => window.__joint.project(q[0], q[1], q[2]), pt);
  const half = size / 2;
  const clip = {
    x: Math.max(0, Math.min(1600 - size, Math.round(p.x - half))),
    y: Math.max(0, Math.min(900 - size, Math.round(p.y - half))),
    width: size, height: size,
  };
  await page.screenshot({ path: path.join(OUT, `${name}.png`), clip });
};
const run = async (label, fn, nodesWanted = null) => {
  const r = await page.evaluate(fn);
  // The node posts are computed by the renderer, so give it a frame to run
  // before asking how many corners it closed.
  await page.waitForTimeout(300);
  if (nodesWanted !== null) {
    const n = await page.evaluate(() => window.__joint.nodes());
    r.checks.push({ what: `posts at ${nodesWanted} nodes, one per corner`,
      ok: n === nodesWanted, detail: `${n}` });
  }
  report.push({ label, ...r });
  console.log(`\n== ${label}`);
  for (const s of r.set) {
    console.log(`   ${s.ok ? 'set ' : 'REFUSED'} ${s.kind.padEnd(5)} at ${JSON.stringify(s.at)} base ${s.base}${s.ok ? '' : ' — ' + s.reason}`);
  }
  if (r.checks) for (const c of r.checks) console.log(`   ${c.ok ? 'OK  ' : 'BAD '} ${c.what}: ${c.detail}`);
  return r;
};

// --------------------------------------------------------------- 1. a room
await run('a closed square of four walls', () => {
  const J = window.__joint;
  J.reset();
  const g = J.ground(0, 0);
  const set = [];
  for (const yaw of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
    set.push(J.set('wall', 0, g, 0, yaw));
  }
  const ps = J.pieces().filter((p) => p.kind === 'wall');
  const faces = ps.map((p) => `${p.x},${p.z}`).sort();
  const bases = [...new Set(ps.map((p) => p.base))];
  return {
    set,
    checks: [
      { what: 'four walls stand', ok: ps.length === 4, detail: `${ps.length}` },
      { what: 'on the four faces of one cell', ok: faces.join(' | ') === '-2,0 | 0,-2 | 0,2 | 2,0',
        detail: faces.join(' | ') },
      { what: 'all four share one level exactly', ok: bases.length === 1, detail: JSON.stringify(bases) },
    ],
  };
}, 4);
await page.evaluate(() => window.__joint.look(11, 12.4, -11, 0, 1.6, 0));
await shot('01-room-from-above');
await page.evaluate(() => window.__joint.look(6.4, 1.2, -6.4, 2.0, 1.4, 2.0));
await shot('02-room-corner-close');
await zoom('02z-room-corner-head', [2.0, 3.9, 2.0], 420);
await zoom('02z-room-corner-mid', [2.0, 2.0, 2.0], 420);
await page.evaluate(() => window.__joint.look(3.4, 0.35, -3.4, 2.0, 0.2, 2.0));
await shot('03-room-corner-foot');
await zoom('03z-room-corner-foot', [2.0, 0.15, 2.0], 460);

// -------------------------------------------------------- 2. wall on a floor
await run('a wall and a floor meeting at a corner', () => {
  const J = window.__joint;
  J.reset();
  const g = J.ground(0, 0);
  const set = [];
  // two decks side by side, then two walls standing on the near one's edges
  set.push(J.set('floor', 0, g, -4.4, 0));
  set.push(J.set('floor', 4, g, -4.4, 0));
  const deck = J.pieces().find((p) => p.kind === 'floor');
  const L = deck ? deck.base : g;
  set.push(J.set('wall', 0, L, 0, 0));
  set.push(J.set('wall', 0, L, 0, Math.PI / 2));
  const ps = J.pieces();
  const walls = ps.filter((p) => p.kind === 'wall');
  const decks = ps.filter((p) => p.kind === 'floor');
  return {
    set,
    checks: [
      { what: 'two decks share one level', ok: new Set(decks.map((d) => d.base)).size === 1,
        detail: JSON.stringify(decks.map((d) => [d.x, d.z, d.base])) },
      { what: 'wall feet land exactly on the deck surface',
        ok: walls.length === 2 && walls.every((w) => w.base === L),
        detail: `deck top ${L}, wall bases ${JSON.stringify(walls.map((w) => w.base))}` },
    ],
  };
});
await page.evaluate(() => window.__joint.look(7.2, 3.0, -7.2, 1.6, 0.6, 1.6));
await shot('04-wall-on-floor');
await page.evaluate(() => window.__joint.look(3.6, 0.75, -4.2, 1.4, 0.38, 0.4));
await shot('05-wall-floor-seam');
// the foot of the wall, standing on the deck it was founded on
await zoom('05z-wall-foot-on-deck', [0.6, 0.40, 1.9], 460);
// the seam between two decks, from just above it
await page.evaluate(() => window.__joint.look(2.0, 2.6, -6.6, 2.0, 0.38, -0.6));
await shot('06-floor-floor-seam');
await zoom('06z-floor-floor-seam', [2.0, 0.38, -0.4], 460);

// ------------------------------------------------------- 3. a ramp to a deck
await run('a ramp arriving at a floor', () => {
  const J = window.__joint;
  J.reset();
  const g = J.ground(0, 0);
  const set = [];
  set.push(J.set('ramp', 0, g, -4.6, 0));            // climbs cell (0,0), +z
  const ramp = J.pieces().find((p) => p.kind === 'ramp');
  const L = ramp ? ramp.base : g;
  // stand on the ramp's head and lay the deck it arrives at
  set.push(J.set('floor', 0, L + 4, 1.8, 0));
  set.push(J.set('wall', 0, L + 4, 1.8, Math.PI / 2));
  const ps = J.pieces();
  const deck = ps.find((p) => p.kind === 'floor');
  return {
    set,
    checks: [
      { what: 'the deck sits in the cell the ramp arrives in',
        ok: !!deck && deck.x === 0 && deck.z === 4, detail: deck ? `${deck.x},${deck.z}` : 'none' },
      { what: 'ramp head height === deck surface',
        ok: !!deck && Math.abs((L + 4) - deck.base) < 1e-9,
        detail: `ramp head ${L + 4}, deck ${deck ? deck.base : '—'}` },
    ],
  };
});
await page.evaluate(() => window.__joint.look(9.5, 5.6, -6.0, 1.0, 3.4, 2.4));
await shot('07-ramp-to-floor');
await page.evaluate(() => window.__joint.look(5.2, 5.2, -0.6, 0.6, 4.0, 2.4));
await shot('08-ramp-floor-lip');
// where the ramp's head becomes the deck: these two surfaces must be one plane
await zoom('08z-ramp-head', [0.0, 4.0, 2.0], 460);
await page.evaluate(() => window.__joint.look(6.4, 0.9, -3.4, 0.4, 0.3, -1.7));
await shot('09-ramp-foot');
await zoom('09z-ramp-foot', [0.0, 0.06, -2.0], 460);

// ------------------------------------------------- 4. a straight run of walls
await run('a straight run of walls, and a storey on top', () => {
  const J = window.__joint;
  J.reset();
  const g = J.ground(0, 0);
  const set = [];
  for (const x of [-4, 0, 4]) set.push(J.set('wall', x, g, 0, 0));
  set.push(J.set('floor', 0, g + 4, 0, 0));
  const ps = J.pieces();
  const walls = ps.filter((p) => p.kind === 'wall');
  const deck = ps.find((p) => p.kind === 'floor');
  return {
    set,
    checks: [
      { what: 'three walls, collinear, one level',
        ok: walls.length === 3 && new Set(walls.map((w) => `${w.z}|${w.base}`)).size === 1,
        detail: JSON.stringify(walls.map((w) => [w.x, w.z, w.base])) },
      { what: 'the deck caps the wall head exactly',
        ok: !!deck && Math.abs(deck.base - (walls[0].base + 4)) < 1e-9,
        detail: deck ? `${deck.base} vs ${walls[0].base + 4}` : 'no deck' },
    ],
  };
}, 4);
await page.evaluate(() => window.__joint.look(-6.0, 2.2, -8.5, 2.0, 2.0, 0.0));
await shot('10-wall-run-seam');
// the node post where two collinear panels butt: one post, not two
await zoom('10z-wall-run-node', [2.0, 2.0, 2.0], 460);
await zoom('10z-wall-run-node-head', [2.0, 3.85, 2.0], 460);
await page.evaluate(() => window.__joint.look(7.0, 6.4, -7.0, 0.0, 3.6, 0.6));
await shot('11-wall-run-capped');
await zoom('11z-deck-on-wall-head', [2.0, 4.0, 2.0], 460);

// ---------------------------------------- 5. every kind, in one structure
await run('a two-storey redoubt: ramp, decks, walls, rail', () => {
  const J = window.__joint;
  J.reset();
  const g = J.ground(0, 0);
  const set = [];
  // a ramp up out of cell (0,0), a deck at the top of it, and a room on the deck
  set.push(J.set('ramp', 0, g, -4.6, 0));
  // the ramp's own base, not the raw terrain sample: the lattice quantises the
  // level on the way in, and comparing against the unquantised height is the
  // test being wrong rather than the joint
  const ramp = J.pieces().find((p) => p.kind === 'ramp');
  const L = (ramp ? ramp.base : g) + 4;
  set.push(J.set('floor', 0, L, 1.8, 0));           // deck in cell (0,4)
  set.push(J.set('floor', 0, L, 4.0, Math.PI / 2)); // deck in cell (4,4)
  set.push(J.set('wall', 0, L, 4.0, 0));            // far face of (0,4)
  set.push(J.set('wall', 4, L, 4.0, 0));            // far face of (4,4)
  set.push(J.set('wall', 4, L, 4.0, Math.PI / 2));  // right face of (4,4)
  set.push(J.set('beam', 0, L, 4.0, Math.PI));      // a rail along the near edge
  const ps = J.pieces();
  const levels = [...new Set(ps.filter((p) => p.kind !== 'ramp').map((p) => p.base))];
  return {
    set,
    checks: [
      { what: 'every piece above the ramp shares one storey', ok: levels.length === 1,
        detail: JSON.stringify(levels) },
      { what: 'the storey is exactly the ramp head', ok: levels.length === 1 && levels[0] === L,
        detail: `${levels[0]} vs ${L}` },
      { what: 'the rail sits on the same storey as the decks',
        ok: ps.some((p) => p.kind === 'beam' && p.base === L),
        detail: JSON.stringify(ps.filter((p) => p.kind === 'beam').map((p) => p.base)) },
    ],
  };
}, 4);
await page.evaluate(() => window.__joint.look(13, 6.0, -7.0, 2.0, 4.6, 3.0));
await shot('12-redoubt');
await page.evaluate(() => window.__joint.look(-9, 7.5, -6.0, 1.0, 4.4, 3.5));
await shot('13-redoubt-far');
await zoom('12z-redoubt-corner', [6.0, 5.6, 6.0], 520);
await zoom('12z-redoubt-deck', [2.0, 4.0, 2.4], 520);

// ------------------------------------------------ 6. a ramp inside a wall
await run('a ramp running up against a wall', () => {
  const J = window.__joint;
  J.reset();
  const g = J.ground(0, 0);
  const set = [];
  set.push(J.set('ramp', 0, g, -4.6, 0));               // climbs cell (0,0)
  const ramp = J.pieces().find((p) => p.kind === 'ramp');
  const L = ramp ? ramp.base : g;
  set.push(J.set('wall', 4, L, 0, -Math.PI / 2));       // the ramp cell's right face
  set.push(J.set('wall', -4, L, 0, Math.PI / 2));       // and its left face
  const walls = J.pieces().filter((p) => p.kind === 'wall');
  return {
    set,
    checks: [
      { what: 'both walls stand on the ramp cell\'s side faces',
        ok: walls.length === 2 && walls.every((w) => Math.abs(w.x) === 2 && w.z === 0),
        detail: JSON.stringify(walls.map((w) => [w.x, w.z])) },
      { what: 'the walls are founded on the ramp\'s own level',
        ok: walls.every((w) => w.base === L), detail: `${L} vs ${JSON.stringify(walls.map((w) => w.base))}` },
    ],
  };
}, 4);
await page.evaluate(() => window.__joint.look(9.5, 3.4, -8.0, 0.6, 1.6, 0.0));
await shot('14-ramp-in-a-slot');
await zoom('14z-ramp-wall-foot', [2.0, 0.5, -1.4], 520);
await zoom('14z-ramp-wall-head', [2.0, 3.6, 1.6], 520);

const nodes = await page.evaluate(() => window.__joint.nodes());
console.log('\nnode posts standing:', nodes);
console.log('console errors:', errors.length, errors.slice(0, 3).join(' | '));
await writeFile(path.join(OUT, 'joints.json'), JSON.stringify({ report, errors }, null, 2));

const bad = report.flatMap((r) => (r.checks || []).filter((c) => !c.ok));
console.log(`\n${bad.length ? 'FAILING CHECKS: ' + bad.length : 'all lattice checks pass'}`);
await browser.close();
process.exit(bad.length || errors.length ? 1 : 0);
