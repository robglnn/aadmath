/**
 * THE TRAVERSE GATE — the corridor between two tears, walked, from every
 * approach bearing there is.
 *
 * WHY IT EXISTS, in the words of the report it was written from:
 *
 *   "In the corridor between the landing plaza and the Evaluating expressions
 *    rift, ORDINARY FORWARD RUNNING drives the camera and player INSIDE the
 *    terrain. The objective card kept reading 88 m AHEAD while the player could
 *    not move at all — twice, for 95 seconds and 85 seconds."
 *
 * It was reproduced before it was theorised about, and it turned out to be two
 * separate faults sharing one symptom:
 *
 *  1. THE ISLAND YOU SAW WAS NOT THE ISLAND YOU WALKED ON. Collision was the
 *     analytic heightfield; the mesh was a 200-sector polar sampling of it.
 *     Measured over 8,773 points they differed by −14.4 m to +15.1 m, and at
 *     the exact spot the walk wedged the drawn hillside stood 11.07 m over the
 *     cadet's head. See `src/world/terrain.js`, `lattice`.
 *  2. 3.82% OF THE ISLAND IS ONE-WAY GROUND — you can walk in and not out.
 *     See `src/world/paths.js`.
 *
 * So this gate measures the three things that were true of the failure and
 * cannot be true of a working build:
 *
 *   HELD     more than four seconds of holding a movement key, with no card on
 *            screen, and under a metre and a half of ground covered.
 *   INSIDE   the drawn island standing over the lens or over the cadet.
 *   BLIND    the camera boom crushed under two metres for more than three
 *            seconds — the full-screen beige wash in the report's screenshot.
 *
 * IT DRIVES THE GAME WITH KEYS. The first approach is walked the whole way from
 * the landing plaza with W and the arrow keys and nothing else. The bearing
 * sweep places the cadet on a ring around the tear first — that is the starting
 * condition, exactly as tools/critic/coldplay.mjs arranges its own — and every
 * metre after that is on the keys.
 *
 *   node tools/critic/traverse.mjs [--url …] [--out shots/traverse]
 *   node tools/critic/traverse.mjs --self-test
 *
 * Exit 0 = the corridor is walkable from everywhere. Exit 1 = it is not.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { findings } from '../_findings.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/traverse'));
const SELFTEST = process.argv.includes('--self-test');
const BEARINGS = Number(arg('bearings', 8));
const RING = Number(arg('ring', 78));
const BUDGET_S = Number(arg('budget', 55));

/** Seconds of asking to move and going nowhere that counts as being held. */
const HELD_S = 4.0;
/** Seconds of a crushed boom that counts as a frame full of the inside of a hill. */
const BLIND_S = 3.0;
/** Metres of ground that counts as having got somewhere. */
const MOVED_M = 1.5;

await mkdir(OUT, { recursive: true });
const fails = [];
const notes = [];
const note = (ok, label, detail = '') => {
  notes.push({ ok, label, detail });
  if (!ok) fails.push(`${label}${detail ? ' — ' + detail : ''}`);
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ' — ' + detail : ''}`);
};

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.evaluate(() => { try { localStorage.clear(); } catch { /* private mode */ } });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2200);

const clear = () => page.evaluate(() => {
  const s = window.__ascent?.session;
  s?.charter?.hide?.(); s?.resolution?.hide?.(); s?.rest?.hide?.();
  for (const el of document.querySelectorAll('.ses-charter,.ses-close,.ses-rest')) el.classList.remove('show');
  document.getElementById('ui')?.classList.remove('ses-cine', 'ses-resting');
  document.getElementById('boot')?.classList.add('gone');
}).catch(() => {});
await clear();

// ---------------------------------------------------------------------------
// THE INSTRUMENT. It rides the frame loop inside the page, because the failure
// is measured in continuous seconds and a poll over the wire at 9 Hz is both
// too coarse to see it and heavy enough to change it.
//
// `hold` is advanced ONLY on frames where no card owns the screen. Attributing
// a minute spent on a question as a minute spent wedged is the instrument bug
// that cost this project a wave, and it is not repeated here.
// ---------------------------------------------------------------------------
await page.evaluate(() => {
  const a = window.__ascent, T = a.THREE;
  const S = {
    on: false, keyed: false, lastT: performance.now(),
    heldRun: 0, held: 0, blindRun: 0, blind: 0,
    insideCam: 0, insidePlayer: 0, frames: 0,
    markX: 0, markZ: 0, at: null, worstAt: null,
  };
  window.__TV = S;
  const cam = new T.Vector3();
  const tick = (now) => {
    const dt = Math.min(0.2, (now - S.lastT) / 1000); S.lastT = now;
    try {
      if (S.on) {
        S.frames++;
        const p = a.player.pos;
        const ui = !!(a.panel?.open || a.input.uiOpen);
        a.camera.getWorldPosition(cam);
        const gp = a.islandAt(p.x, p.z);
        const gc = a.islandAt(cam.x, cam.z);
        // The drawn island standing over the cadet, and over the lens. Since
        // the mesh and the heightfield are one surface this is exactly the
        // question "is the picture full of the inside of a hill".
        if (gp !== null && gp - (p.y + 1.5) > S.insidePlayer) S.insidePlayer = gp - (p.y + 1.5);
        if (gc !== null && gc - cam.y > S.insideCam) S.insideCam = gc - cam.y;
        const hit = a.player.cam && typeof a.player.cam._hit === 'number' ? a.player.cam._hit : 99;
        S.blindRun = (hit < 2.2 && !ui) ? S.blindRun + dt : 0;
        if (S.blindRun > S.blind) S.blind = S.blindRun;
        if (!S.keyed || ui) { S.markX = p.x; S.markZ = p.z; S.heldRun = 0; }
        else if (Math.hypot(p.x - S.markX, p.z - S.markZ) > 1.5) { S.markX = p.x; S.markZ = p.z; S.heldRun = 0; }
        else {
          S.heldRun += dt;
          if (S.heldRun > S.held) {
            S.held = S.heldRun;
            S.worstAt = [+p.x.toFixed(1), +p.y.toFixed(1), +p.z.toFixed(1)];
          }
        }
      }
    } catch { /* a frame mid-teardown is not evidence */ }
    requestAnimationFrame(tick);
  };
  requestAnimationFrame(tick);
});

const arm = (keyed) => page.evaluate((k) => {
  const a = window.__ascent, S = window.__TV;
  S.on = true; S.keyed = k;
  S.heldRun = 0; S.held = 0; S.blindRun = 0; S.blind = 0;
  S.insideCam = 0; S.insidePlayer = 0; S.frames = 0; S.worstAt = null;
  S.markX = a.player.pos.x; S.markZ = a.player.pos.z; S.lastT = performance.now();
}, keyed);
const readout = () => page.evaluate(() => { const S = window.__TV; S.on = false; return { ...S }; });
/**
 * Tell the instrument whether a movement key is down.
 *
 * IDEMPOTENT, AND THAT IS THE WHOLE OF A BUG THAT MADE THE HELD ASSERTION
 * MEASURE NOTHING. The walking loop below calls this once per iteration — every
 * 1.2 to 2 seconds — and the first cut of it restarted the clock and moved the
 * mark on every call. `heldRun` could therefore never exceed one iteration of
 * the harness's own aiming loop, so a gate whose bar is four seconds reported
 * "worst 1.7 s" against a walk that had, on the same run, twelve seconds of
 * holding W and covering 1.4 metres. The instrument was measuring the harness.
 *
 * Now the clock restarts only when the key state actually changes.
 */
const keyed = (k) => page.evaluate((v) => {
  const a = window.__ascent, S = window.__TV;
  if (S.keyed === v) return;
  S.keyed = v; S.markX = a.player.pos.x; S.markZ = a.player.pos.z; S.heldRun = 0;
}, k);

const facts = () => page.evaluate(() => {
  const a = window.__ascent;
  return {
    x: a.player.pos.x, y: a.player.pos.y, z: a.player.pos.z,
    yaw: a.player.yaw, ui: !!(a.panel?.open || a.input.uiOpen),
    stuck: !!a.player.stuck, recoveries: a.player.recoveries | 0,
  };
});

/** Face a bearing with ARROW KEYS ONLY — no pointer lock, no mouse deltas. */
const faceYaw = async (want) => {
  for (let i = 0; i < 16; i++) {
    const d = await page.evaluate((w) => {
      let e = ((w - window.__ascent.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (e < -Math.PI) e += Math.PI * 2;
      return e;
    }, want);
    if (Math.abs(d) < 0.12) return true;
    const k = d > 0 ? 'ArrowLeft' : 'ArrowRight';
    await page.keyboard.down(k);
    await page.waitForTimeout(Math.min(400, Math.max(50, (Math.abs(d) / 2.6) * 1000)));
    await page.keyboard.up(k);
  }
  return false;
};

const sites = await page.evaluate(() => {
  const a = window.__ascent;
  return {
    spawn: { x: a.player.pos.x, z: a.player.pos.z },
    rifts: a.rifts.list.map((r) => ({
      id: r.id, x: r.foot ? r.foot.x : r.pos.x, z: r.foot ? r.foot.z : r.pos.z, locked: !!r.locked,
    })),
  };
});
const first = sites.rifts.find((r) => !r.locked) || sites.rifts[0];
// "the corridor between the landing plaza and Evaluating expressions" — the
// second tear on the shipping lattice, and whatever stands second on any other.
const target = sites.rifts.find((r) => r.id === 'eval-expr') || sites.rifts[1] || first;
console.log(`  ..    corridor: plaza (${sites.spawn.x.toFixed(0)}, ${sites.spawn.z.toFixed(0)})`
  + ` -> ${first.id} -> ${target.id} (${target.x.toFixed(0)}, ${target.z.toFixed(0)})`);

// ---------------------------------------------------------------------------
// 1. THE WORLD'S OWN ANSWER: is there a walkable line at all?
// ---------------------------------------------------------------------------
{
  const w = await page.evaluate((t) => {
    const a = window.__ascent, W = a.world;
    if (!W || typeof W.routeFrom !== 'function') return { missing: true };
    const stats = W.routeStats();
    const legs = [];
    const list = a.rifts.list.map((r) => ({ id: r.id, x: r.foot ? r.foot.x : r.pos.x, z: r.foot ? r.foot.z : r.pos.z }));
    const from = [{ id: 'plaza', x: 0, z: 0 }, ...list];
    for (const f of from) {
      for (const g of list) {
        if (f.id === g.id) continue;
        const r = W.routeFrom(f.x, f.z, g.x, g.z);
        legs.push({ a: f.id, b: g.id, ok: !!r, m: r ? Math.round(r.metres) : null,
          straight: Math.round(Math.hypot(g.x - f.x, g.z - f.z)) });
      }
    }
    return { stats, legs, t };
  }, target.id);
  if (w.missing) note(false, 'the world can answer "is there a walkable line from here to there"', 'src/world/paths.js is not wired');
  else {
    const bad = w.legs.filter((l) => !l.ok);
    note(bad.length === 0, 'every tear is joined to every other by a line a cadet can walk',
      bad.length ? `${bad.length}/${w.legs.length} legs have no route: ${bad.slice(0, 4).map((l) => l.a + '->' + l.b).join(', ')}`
        : `${w.legs.length} legs, median detour ${(() => {
          const r = w.legs.map((l) => l.m / Math.max(1, l.straight)).sort((p, q) => p - q);
          return r[Math.floor(r.length / 2)].toFixed(2);
        })()}x straight line`);
    const s = w.stats;
    console.log(`  ..    island: ${s.ground} cells of ground at ${s.step} m, `
      + `${s.oneWay} one-way (${(s.oneWayShare * 100).toFixed(2)}%)`);
  }
}

// ---------------------------------------------------------------------------
// 1b. IS THE ISLAND YOU SEE THE ISLAND YOU WALK ON?
//
// THE ASSERTION THAT WOULD HAVE CAUGHT THE ORIGINAL DEFECT, and the only one
// here that does not ask the game a question the game already believes it knows
// the answer to. Everything else in this file reads the heightfield — which is
// exactly what the boots read, so the two agreed with each other while both
// disagreed with the triangles. This one fires a ray down at the DRAWN MESH and
// compares the point it hits with the height the boots would stand at.
//
// Measured on the build the report was written against: −14.4 m to +15.1 m,
// with the drawn hillside standing 11.07 m over the cadet's head at the exact
// spot a walk wedged.
// ---------------------------------------------------------------------------
{
  const m = await page.evaluate(() => {
    const a = window.__ascent, T = a.THREE;
    let island = null;
    a.scene.traverse((o) => { if (o.name === 'island') island = o; });
    if (!island) return { missing: true };
    const ray = new T.Raycaster();
    ray.near = 0.01; ray.far = 900;
    const down = new T.Vector3(0, -1, 0), from = new T.Vector3();
    const ds = []; let overhead = 0; let worst = null;
    for (let i = 0; i < 3000; i++) {
      const t = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 155;
      const x = Math.cos(t) * r, z = Math.sin(t) * r;
      const h = a.islandAt(x, z);
      if (h === null) continue;
      from.set(x, 320, z); ray.set(from, down);
      const hit = ray.intersectObject(island, false);
      if (!hit.length) continue;
      const d = hit[0].point.y - h;
      ds.push(d);
      // the drawn ground standing over a standing cadet's head
      if (d > 1.4) overhead++;
      if (!worst || Math.abs(d) > Math.abs(worst.d)) worst = { x: +x.toFixed(1), z: +z.toFixed(1), d: +d.toFixed(2) };
    }
    ds.sort((p2, q) => p2 - q);
    return { n: ds.length, min: ds[0], max: ds[ds.length - 1], overhead, worst };
  });
  if (m.missing) note(false, 'the drawn island exists to be measured', 'no mesh named "island" in the scene');
  else {
    note(m.overhead === 0, 'the island you SEE is the island you WALK ON',
      m.overhead
        ? `${m.overhead}/${m.n} samples draw the ground a body or more over the cadet — worst ${m.worst.d} m at ${m.worst.x}, ${m.worst.z}`
        : `${m.n} rays, worst disagreement ${Math.max(Math.abs(m.min), Math.abs(m.max)).toFixed(2)} m`);
  }
}

// ---------------------------------------------------------------------------
// 1c. DOES THE GAME EVER POINT A PLAYER AT A FACE HIS OWN BOOTS REFUSE?
//
// THE ASSERTION THAT NAMES THE DEFECT RATHER THAN ITS SYMPTOM, and the one this
// whole file was rewritten around the second time.
//
// `_blocked` in src/player/locomotion.js refuses any point whose gradient,
// measured with a central difference over ±0.7 m, is over `P.slopeLimit` = 1.5.
// The route planner used to answer a completely different question — a rise
// rule between cell centres THREE METRES APART, which looks at nothing in
// between — so the card could print a bearing straight into a four-metre lip
// two metres wide and be, by its own rule, correct. Measured on the shipped
// legs: 643 of 5,457 routed samples over the boots' limit, up to 15.7 m of
// continuous wall on one line.
//
// This measures the gradient ITSELF, off `islandAt` — the world's own
// heightfield, the one the boots read — rather than asking the planner to
// confirm its own tables. Every leg a player is actually sent down, walked at
// 35 cm.
// ---------------------------------------------------------------------------
{
  const m = await page.evaluate(() => {
    const a = window.__ascent, W = a.world;
    const E = 0.7, LIMIT = 1.5;
    const grad = (x, z) => {
      const h = a.islandAt(x, z);
      if (h === null) return null;
      const r = a.islandAt(x + E, z), l = a.islandAt(x - E, z);
      const u = a.islandAt(x, z + E), d = a.islandAt(x, z - E);
      return Math.hypot(((r === null ? h : r) - (l === null ? h : l)) / (2 * E),
        ((u === null ? h : u) - (d === null ? h : d)) / (2 * E));
    };
    const list = a.rifts.list.map((r) => ({ id: r.id, x: r.foot ? r.foot.x : r.pos.x, z: r.foot ? r.foot.z : r.pos.z }));
    const ends = [{ id: 'plaza', x: 0, z: 0 }, ...list];
    let total = 0, over = 0, legs = 0, noRoute = 0, metres = 0;
    let worstRun = 0, at = null, worstLeg = null;
    // …and the other half of "the line is walkable", which the first cut of
    // this gate never asked: a route may not step off a roof either. The boots
    // do not refuse a drop — a cadet can always fall — so a steep DESCENT is
    // not a wedge and must not be counted as one, or the rule stops being the
    // boots' rule. It is still bad advice, so it gets its own number.
    let drop = 0, dropAt = null, dropLeg = null;
    for (const f of ends) {
      for (const g of list) {
        if (f.id === g.id) continue;
        legs++;
        const r = W.routeFrom(f.x, f.z, g.x, g.z);
        if (!r || !r.cells.length) { noRoute++; continue; }
        let run = 0;
        for (let i = 1; i < r.cells.length; i++) {
          const [x0, , z0] = r.cells[i - 1], [x1, , z1] = r.cells[i];
          const L = Math.hypot(x1 - x0, z1 - z0);
          metres += L;
          const h0 = a.islandAt(x0, z0), h1 = a.islandAt(x1, z1);
          if (h0 !== null && h1 !== null && h0 - h1 > drop) {
            drop = h0 - h1; dropAt = [+x1.toFixed(1), +z1.toFixed(1)]; dropLeg = f.id + '->' + g.id;
          }
          const n = Math.max(1, Math.ceil(L / 0.35));
          let ph = a.islandAt(x0, z0);
          for (let k = 1; k <= n; k++) {
            const t = k / n, x = x0 + (x1 - x0) * t, z = z0 + (z1 - z0) * t;
            total++;
            const gg = grad(x, z);
            const h = a.islandAt(x, z);
            // THE BOOTS' OWN CONDITION, verbatim, from `_blocked` in
            // src/player/locomotion.js: a point is a wall only when he is
            // RISING into it (`if (rise <= 0.03) return false;`) and the
            // gradient there is over `P.slopeLimit`.
            const rising = h !== null && ph !== null && h - ph > 0.02;
            ph = h;
            if (rising && gg !== null && gg > LIMIT) {
              over++; run += L / n;
              if (run > worstRun) { worstRun = run; at = [+x.toFixed(1), +z.toFixed(1), +gg.toFixed(2)]; worstLeg = f.id + '->' + g.id; }
            } else run = 0;
          }
        }
      }
    }
    return { total, over, legs, noRoute, worstRun, at, worstLeg, drop, dropAt, dropLeg, metres };
  });
  note(m.noRoute === 0, 'the world has a walkable line for every leg a player is sent down',
    m.noRoute ? `${m.noRoute}/${m.legs} legs have no route` : `${m.legs} legs, ${Math.round(m.metres)} m of routed line`);
  note(m.over === 0, 'no routed line asks the boots for a face they refuse',
    m.over
      ? `${m.over}/${m.total} samples rise into gradient over 1.5 — worst run ${m.worstRun.toFixed(1)} m on ${m.worstLeg} at ${(m.at || []).join(', ')}`
      : `${m.total} samples over ${m.legs} legs, none rising into a face over gradient 1.5`);
  // THE BAR IS TWELVE, AND IT IS MEASURED RATHER THAN CHOSEN.
  //
  // This island has a cut through it, and on the plaza→eval-expr corridor the
  // shortest line the boots can take steps down **8.92 m** at (−4.6, −66.2) —
  // a drop a cadet lands from with a hard landing and nothing else. There is no
  // route on this terrain that avoids it without going a long way round, which
  // is the other complaint. Twelve leaves that alone and still refuses a ledge:
  // with a linear fall charge instead of the one `stepCost` now uses, the same
  // legs routed off a **20.05 m** face, and this line names it.
  note(m.drop <= 12, 'and no routed line steps off a ledge',
    `biggest single step down ${m.drop.toFixed(2)} m${m.dropLeg ? ` on ${m.dropLeg} at ${(m.dropAt || []).join(', ')}` : ''} (bar 12 m)`);
}

// ---------------------------------------------------------------------------
// 1d. CAN A CADET STANDING ANYWHERE FLAT GET A USABLE ANSWER TO "WHICH WAY"?
//
// The other half of the same defect, and the one that is a fact about the whole
// island rather than about ten legs. A player does not only stand at tears: he
// stands wherever he stopped. So every place on this island a cadet could be
// STANDING STILL — gentle enough that the ground is not shedding him — has to
// have a line home, and the first steps of that line have to be steps his boots
// will take. Sampled at random, with the gradient measured off `islandAt` and
// not off the planner's own tables.
// ---------------------------------------------------------------------------
{
  const s = await page.evaluate(() => {
    const a = window.__ascent, W = a.world;
    const E = 0.7, LIMIT = 1.5, STAND = 1.3;
    const grad = (x, z) => {
      const h = a.islandAt(x, z);
      if (h === null) return null;
      const r = a.islandAt(x + E, z), l = a.islandAt(x - E, z);
      const u = a.islandAt(x, z + E), d = a.islandAt(x, z - E);
      return Math.hypot(((r === null ? h : r) - (l === null ? h : l)) / (2 * E),
        ((u === null ? h : u) - (d === null ? h : d)) / (2 * E));
    };
    let tried = 0, noLine = 0, intoWall = 0;
    const bad = [];
    for (let i = 0; i < 40000 && tried < 400; i++) {
      const t = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * 156;
      const x = Math.cos(t) * rr, z = Math.sin(t) * rr;
      const g = grad(x, z);
      if (g === null || g > STAND) continue;
      if (Math.hypot(x, z) < 24) continue;      // already home
      tried++;
      const r = W.routeFrom(x, z, 0, 0);
      if (!r || r.cells.length < 2) { noLine++; bad.push([+x.toFixed(0), +z.toFixed(0), 'no line']); continue; }
      // the first ten metres of it, at 35 cm
      // ---- WALKED, NOT SAMPLED ------------------------------------------
      //
      // Two instrument errors were made here before this line was right, and
      // both are worth keeping written down.
      //
      // The first was leaving out the boots' own rise condition — `_blocked`
      // returns false the moment a step is not a climb — so a steep DESCENT
      // was counted as a wall: 24 of 400 places reported broken that were not.
      //
      // The second was subtler and is the reason this now WALKS. A single
      // sample over the slope limit is not a wall: at (−97.7, −50.1) the route
      // crosses a bump that rises **four centimetres** at gradient 1.70 on a
      // step that descends 1.2 m, and the boots resolve that one axis at a time
      // and slide straight past it. A point test called it a wall and blamed
      // seventy-three of the eighty standable places around (−102, −57) for it.
      //
      // So the first ten metres are walked the way the boots walk them —
      // sliding, and scrambling where the world has hold of him — and the
      // question is the one that matters: did he get anywhere.
      const scr = !W.escapable(x, z);
      const blocked = (bx, bz, py) => {
        const h = a.islandAt(bx, bz);
        if (h === null) return true;                    // off the island
        if (h - py <= 0.03) return false;
        if (h - py > (scr ? 1.35 : 0.55)) return true;
        if (scr) return false;
        const g = grad(bx, bz);
        return g !== null && g > LIMIT;
      };
      // aim at the first routed cell more than two metres off, which is what
      // `headingTo` hands a player, then walk it
      let aim = null, run0 = 0;
      for (let k = 1; k < r.cells.length; k++) {
        const c = r.cells[k];
        run0 = Math.hypot(c[0] - x, c[2] - z);
        aim = c;
        if (run0 > 2) break;
      }
      let px = x, pz = z, py = a.islandAt(x, z);
      if (aim) {
        const yaw = Math.atan2(aim[0] - x, aim[2] - z);
        const dxs = Math.sin(yaw) * 0.05, dzs = Math.cos(yaw) * 0.05;
        for (let k = 0; k < 200; k++) {
          let nx2 = px + dxs, nz2 = pz + dzs;
          if (blocked(nx2, nz2, py)) {
            if (!blocked(px + dxs, pz, py)) { nx2 = px + dxs; nz2 = pz; }
            else if (!blocked(px, pz + dzs, py)) { nx2 = px; nz2 = pz + dzs; }
            else { nx2 = px; nz2 = pz; }
          }
          px = nx2; pz = nz2;
          const h = a.islandAt(px, pz);
          if (h !== null) py = h;
        }
      }
      const got = Math.hypot(px - x, pz - z);
      if (got < 4) { intoWall++; bad.push([+x.toFixed(0), +z.toFixed(0), `only ${got.toFixed(1)} m in ten`]); }
    }
    // …and the places the game itself sends people to stand had better not be
    // ground it calls one-way: the boots scramble there, the lens behaves
    // differently there, and after fourteen seconds the controller picks the
    // cadet up and moves him (src/player/controller.js `_ledgeT`).
    const held = [];
    if (!W.escapable(0, 0)) held.push('plaza');
    for (const rr of a.rifts.list) {
      const rx = rr.foot ? rr.foot.x : rr.pos.x, rz = rr.foot ? rr.foot.z : rr.pos.z;
      if (!W.escapable(rx, rz)) held.push(rr.id);
    }
    for (const g of (a.waygates?.list || [])) if (!W.escapable(g.x, g.z)) held.push('waygate@' + Math.round(g.x));
    return { tried, noLine, intoWall, bad: bad.slice(0, 5), held, st: W.routeStats() };
  });
  const st = s.st;
  console.log(`  ..    walk graph: ${st.ground} cells at ${st.step} m off a ${st.fine} m field, `
    + `${st.oneWay} one-way (${(st.oneWayShare * 100).toFixed(2)}%), `
    + `${st.trapped} of ${st.stand} standable cells trapped (${(st.trappedShare * 100).toFixed(3)}%)`);
  note(s.noLine === 0, 'every place a cadet can stand still is joined to the landing by a line',
    s.noLine ? `${s.noLine}/${s.tried} sampled places have none` : `${s.tried} places sampled`);
  note(s.intoWall === 0, 'and the first ten metres of that line are ten metres he can walk',
    s.intoWall
      ? `${s.intoWall}/${s.tried} go under 4 m when the first stretch is walked: ${s.bad.map((b) => b.join(' ')).join(' · ')}`
      : `${s.tried} places walked, every one covered 4 m or more`);
  note(s.held.length === 0, 'nowhere the game sends a cadet to stand is ground it calls one-way',
    s.held.length ? s.held.join(', ') : 'the landing, every tear and every gate lead home');
  note(st.trappedShare < 0.01, 'almost no flat ground on this island is a trap',
    `${st.trapped}/${st.stand} standable cells cannot walk home (${(st.trappedShare * 100).toFixed(3)}%, bar 1%)`);
}

// ---------------------------------------------------------------------------
// 1e. THE NEEDLE ON THE SCREEN, READ OFF THE SCREEN.
//
// Everything above measures what the WORLD believes. This measures what the
// player is actually shown: the rotation the compass needle is drawn at
// (`.afd-needle`, src/world/afford.js), turned back into a world bearing with
// the camera's own yaw, and then walked. If the thing the arrow points at is a
// face his boots refuse inside the next dozen metres, the arrow is the defect
// whatever the tables underneath it say — and it was, on this build: the trace
// on the ground was laid on the walk graph and the needle over it was still
// drawn straight at the tear.
//
// Sampled from a ring of standing places round the tear, facing every quarter,
// so the reading is not one lucky frame.
//
// THE OBJECTIVE CARD IS HIDDEN FIRST, and that is a starting condition rather
// than a cheat: `afford.js` draws the compass only when the card is not up
// (`chrome = !objSpoken && !guideUp`), so the needle is the surface a player
// steers by exactly when the card is not there — a phone in portrait, a card
// faded out between beats, the seconds after a seal. Hiding the card is how you
// get the compass on screen at all; nothing here presses a key or moves him.
//
// It also says something the report should carry: the card, not the needle, is
// the primary bearing surface, and the card's bucket is still measured off the
// straight line (`relative(aim.pos)`, src/meta/guide.js — another lane).
// ---------------------------------------------------------------------------
{
  /* TAKE THE STANDING CARD FIRST, THE WAY A PLAYER DOES.
     By the time this leg runs, this page has been open for the better part of
     ten minutes and the run's ORDERS card is up: measured, on a cold boot left
     alone, `session.blocking()` and `input.uiOpen` both go true at t = 38 s and
     stay true until somebody takes the card. A card owning the frame is
     precisely when the compass is SUPPOSED to stand down (`isBusy`,
     src/world/afford.js), so without this the leg reports "the compass was on
     screen to be read: 4 readings" — which is a true statement about the ORDERS
     card and says nothing whatever about the compass. It read 4 of 24 with the
     card up and 24 of 24 with it taken. Nothing here moves the cadet; it
     presses the button the card asks for, which is the one thing a player has
     to do before any of this leg's subject exists. */
  {
    const t0 = Date.now();
    const buttons = ['.ses-charter.show .sc-go', '.ses-close.show .sx-rest', '.ses-rest.show .sr-again',
      '.ses-rest.show .sr-skip', '.fdy.show .fdy-close'];
    while (Date.now() - t0 < 12000) {
      if (!(await page.evaluate(() => !!window.__ascent.input?.uiOpen).catch(() => false))) break;
      let pressed = false;
      for (const sel of buttons) {
        const el = page.locator(sel).first();
        if (await el.count() && await el.isVisible().catch(() => false)) {
          await el.click({ timeout: 3000, force: true }).catch(() => {});
          pressed = true;
          break;
        }
      }
      if (!pressed) await page.keyboard.press('Escape');
      await page.waitForTimeout(600);
    }
  }
  await page.evaluate(() => {
    const c = document.querySelector('.gd-card');
    if (c) c.style.display = 'none';
  });
  const spots = [];
  for (let b = 0; b < 6; b++) {
    const th = (b / 6) * Math.PI * 2;
    spots.push({ x: target.x + Math.cos(th) * 62, z: target.z + Math.sin(th) * 62 });
  }
  const rows = [];
  let hidden = 0;
  for (const s of spots) {
    const placed = await page.evaluate((q) => {
      const a = window.__ascent;
      const h = a.islandAt(q.x, q.z);
      if (h === null) return false;
      a.player.pos.set(q.x, h + 0.4, q.z);
      a.player.vel.set(0, 0, 0);
      return true;
    }, s);
    if (!placed) continue;
    for (const face of [0, Math.PI / 2, Math.PI, -Math.PI / 2]) {
      await page.evaluate((y) => { window.__ascent.player.yaw = y; }, face);
      await page.waitForTimeout(220);
      const r = await page.evaluate(() => {
        const a = window.__ascent, T = a.THREE, W = a.world;
        const el = document.querySelector('.afd-needle');
        const head = document.querySelector('.afd-head');
        if (!el || !head || !head.classList.contains('show')) return null;
        const m = /(-?[\d.]+)deg/.exec(el.style.rotate || '');
        if (!m) return null;
        const rel = Number(m[1]) * Math.PI / 180;       // …the way afford.js writes it
        const fwd = new T.Vector3();
        a.camera.getWorldDirection(fwd);
        fwd.y = 0; fwd.normalize();
        const camYaw = Math.atan2(fwd.x, fwd.z);
        // afford.js writes `rotate: ang` where ang = turn(fwd, dir) =
        // atan2(fwd × dir, fwd · dir) and that quantity is (camera yaw −
        // bearing), so the bearing comes back by SUBTRACTING it.
        //
        // THE MINUS SIGN THAT USED TO BE ON THIS LINE. It read `-Number(m[1])`,
        // because afford.js used to write `rotate: -ang` — which is the second
        // handedness inversion this project shipped: the needle was drawn
        // mirrored about the screen's vertical axis and pointed left for a rift
        // on the right. afford.js now writes the number itself, so this reads
        // the number itself. Two minus signs cancelling made the WORLD bearing
        // recovered here correct while the PIXELS were wrong, which is exactly
        // why tools/critic/handed.mjs measures the drawn rotation against the
        // glyph, and this gate does not.
        //
        // The first cut of this added rather than subtracted, which mirrors the
        // needle about the camera axis: sixteen of twenty readings still landed
        // on walkable ground by luck and four did not, and the gate reported the
        // game as pointing at a wall from (16, −111) where the world's own
        // bearing covers 10.2 m of the next 14. The instrument was the defect.
        const yaw = camYaw - rel;
        // …and now walk it, the boots' way, off islandAt.
        const p = a.player.pos, E = 0.7, LIMIT = 1.5;
        const grad = (x, z) => {
          const h = a.islandAt(x, z);
          if (h === null) return null;
          const rr = a.islandAt(x + E, z), l = a.islandAt(x - E, z);
          const u = a.islandAt(x, z + E), d = a.islandAt(x, z - E);
          return Math.hypot(((rr === null ? h : rr) - (l === null ? h : l)) / (2 * E),
            ((u === null ? h : u) - (d === null ? h : d)) / (2 * E));
        };
        // …and a face is only a WALL when the boots cannot get past it. The
        // move is resolved one axis at a time (`_integrate`, src/player), so a
        // cadet who walks at a rock a metre from his shoulder slides along it
        // and carries on — which is why this walks the bearing the way the
        // boots walk it, sliding, and asks whether he is still going anywhere
        // twelve metres later.
        // …and where the world has hold of him the boots SCRAMBLE, which is the
        // one place they are allowed to take a face they would otherwise
        // refuse (`P.scrambleSlope`, src/player/locomotion.js). A model that
        // leaves that out reports a cadet pinned on the Spine's south-west
        // face at (40, −88) — gradient 15.9, one-way ground, with the way out
        // six metres away and seventy-one metres up — as a defect in the arrow
        // pointing him at it. It is not: it is the only way off.
        const scr = !W.escapable(p.x, p.z);
        const blocked = (bx, bz, py) => {
          const h = a.islandAt(bx, bz);
          if (h === null) return false;                 // the coast, not a wall
          if (h - py <= 0.03) return false;
          if (h - py > (scr ? 1.35 : 0.55)) return true;
          if (scr) return false;
          const g = grad(bx, bz);
          return g !== null && g > LIMIT;
        };
        let px = p.x, pz = p.z, py = a.islandAt(p.x, p.z), hit = null;
        // FIVE CENTIMETRES A STEP, because the boots move about thirteen at a
        // frame and `_blocked` compares the ground where the foot lands with
        // the height the cadet is standing at RIGHT NOW. Walking this in 35 cm
        // strides asks whether he can take a 6 m riser in one go, which he
        // cannot, and reports a cadet who is climbing perfectly well as pinned.
        const dx = Math.sin(yaw) * 0.05, dz = Math.cos(yaw) * 0.05;
        for (let k = 1; k <= 280; k++) {
          let nx = px + dx, nz = pz + dz;
          if (blocked(nx, nz, py)) {
            if (Math.abs(dx) > 0.02 && !blocked(px + dx, pz, py)) { nx = px + dx; nz = pz; }
            else if (Math.abs(dz) > 0.02 && !blocked(px, pz + dz, py)) { nx = px; nz = pz + dz; }
            else { nx = px; nz = pz; }
          }
          px = nx; pz = nz;
          const h = a.islandAt(px, pz);
          if (h !== null) py = h;
        }
        const got = Math.hypot(px - p.x, pz - p.z);
        if (got < 3) hit = { d: +got.toFixed(1), g: 0, x: +px.toFixed(1), z: +pz.toFixed(1) };
        return { yaw: +yaw.toFixed(2), hit, at: [+p.x.toFixed(0), +p.z.toFixed(0)] };
      });
      if (r) rows.push(r); else hidden++;
    }
  }
  await page.evaluate(() => {
    const c = document.querySelector('.gd-card');
    if (c) c.style.display = '';
  });
  const blind = rows.filter((r) => r.hit);
  // The compass stands down while the objective's OWN plate is on the glass
  // (`objSpoken`), which is most bearings that face the tear — so a fair
  // sample is the ones that faced away from it, and there are three of those
  // per place by construction.
  note(rows.length >= 6, 'the compass was on screen to be read',
    `${rows.length} readings, ${hidden} bearings where the tear's own plate had the frame instead`);
  note(blind.length === 0, 'the needle never points at a face the boots refuse',
    blind.length
      ? `${blind.length}/${rows.length} readings go under 3 m in fourteen metres of walking it — e.g. from ${blind[0].at.join(', ')} the cadet covers ${blind[0].hit.d} m`
      : `${rows.length} readings from 6 places, facing four ways each`);
}

// ---------------------------------------------------------------------------
// 2. THE WALK FROM THE PLAZA. No teleport anywhere in this one.
// ---------------------------------------------------------------------------
async function walkTo(t, budgetMs) {
  const t0 = Date.now();
  let held = false;
  let last = 1e9;
  const fwd = async (on) => { if (on === held) return; held = on; if (on) await page.keyboard.down('KeyW'); else await page.keyboard.up('KeyW'); };
  try {
    for (;;) {
      const f = await facts();
      const d = Math.hypot(t.x - f.x, t.z - f.z);
      last = d;
      if (d < 7) return { ok: true, d };
      if (Date.now() - t0 > budgetMs) return { ok: false, d };
      if (f.ui) { await fwd(false); await keyed(false); await page.keyboard.press('Escape'); await clear(); await page.waitForTimeout(250); continue; }
      // Aim where the world says to walk — the routed heading if it has one,
      // the straight line if it does not, which is what the card used to give.
      const want = await page.evaluate((tt) => {
        const a = window.__ascent, W = a.world, p = a.player.pos;
        if (W && typeof W.headingTo === 'function') return W.headingTo(p.x, p.z, tt.x, tt.z).yaw;
        return Math.atan2(tt.x - p.x, tt.z - p.z);
      }, t);
      // The key stays DOWN through the turn. A harness that stops to aim spends
      // a third of its budget standing still and then blames the world for the
      // distance it did not cover — and it is not what a hand does either.
      await keyed(true); await fwd(true);
      await faceYaw(want);
      await page.waitForTimeout(900);
    }
  } finally { await fwd(false); await keyed(false); return { ok: last < 7, d: last }; }
}

/** What the world says the walk is: metres on foot, against the straight line. */
const legOf = (fx, fz, t) => page.evaluate(([a, b, c, tt]) => {
  const A = window.__ascent, W = A.world;
  if (!W || typeof W.routeFrom !== 'function') return null;
  const r = W.routeFrom(a, b, tt.x, tt.z);
  if (!r) return null;
  // THE LINE A CADET HAS TO TRAVEL INCLUDES THE HEIGHT, and comparing a walk
  // against the horizontal line alone is how this gate came to call a descent
  // a hike. Its own ring placement at 315° lands at (49.9, −111.8) — h 139.6,
  // the Spine's summit — and the tear is at h 42.7. That is 84 m across and
  // **97 m down**: a 222 m walk off a mountain, which the horizontal rule
  // scored 2.65x and the line the cadet actually travels scores 1.73x. The
  // rule was measuring the mountain.
  const ha = A.islandAt(a, b), hb = A.islandAt(tt.x, tt.z);
  const flat = Math.hypot(tt.x - a, tt.z - b);
  const dy = (ha === null || hb === null) ? 0 : (hb - ha);
  return { metres: r.metres, straight: flat, line: Math.hypot(flat, dy), drop: dy };
}, [fx, fz, 0, t]);

{
  await arm(false);
  const okFirst = (await walkTo(first, 70000)).ok;
  const okSecond = okFirst ? (await walkTo(target, 90000)).ok : false;
  const r = await readout();
  await page.screenshot({ path: path.join(OUT, 'plaza-walk.png') });
  note(okFirst && okSecond, 'the corridor can be walked from the plaza on the keys alone',
    okFirst ? (okSecond ? '' : `never reached ${target.id}`) : `never reached ${first.id}`);
  note(r.held < HELD_S, 'nothing on that walk held the cadet',
    `worst ${r.held.toFixed(1)}s${r.worstAt ? ' at ' + r.worstAt.join(', ') : ''} (bar ${HELD_S}s)`);
  note(r.insideCam <= 0.05 && r.insidePlayer <= 0.05, 'the drawn island never stood over the cadet or the lens',
    `cadet ${r.insidePlayer.toFixed(2)} m, lens ${r.insideCam.toFixed(2)} m`);
  note(r.blind < BLIND_S, 'the frame never filled with the inside of a hill',
    `worst ${r.blind.toFixed(1)}s of a crushed boom (bar ${BLIND_S}s)`);
}

// ---------------------------------------------------------------------------
// 3. EVERY APPROACH BEARING. Placed on the ring, then walked in on the keys.
// ---------------------------------------------------------------------------
const rows = [];
for (let b = 0; b < BEARINGS; b++) {
  const th = (b / BEARINGS) * Math.PI * 2;
  const deg = Math.round((th * 180) / Math.PI);
  const start = { x: target.x + Math.cos(th) * RING, z: target.z + Math.sin(th) * RING };
  // AN APPROACH STARTS SOMEWHERE A CADET COULD BE STANDING.
  //
  // Not a weakening — the opposite. A point on the ring can land on one-way
  // ground: a ledge the island lets you drop onto and not climb off. Timing a
  // *walk* from there measures the climb out, not the corridor, and the climb
  // is deliberately slow. So the walk is started from the nearest ground that
  // leads home, and the ledge itself is tested separately and harder, below —
  // a promise that did not exist at all before this gate.
  const placed = await page.evaluate((s) => {
    const a = window.__ascent, W = a.world;
    let x = s.x, z = s.z, oneWay = false;
    if (a.islandAt(x, z) === null) return null;
    if (W && typeof W.escapable === 'function' && !W.escapable(x, z)) {
      oneWay = true;
      let best = null;
      for (let r = 4; r <= 40 && !best; r += 4) {
        for (let k = 0; k < 16; k++) {
          const t = (k / 16) * Math.PI * 2;
          const cx = x + Math.cos(t) * r, cz = z + Math.sin(t) * r;
          if (a.islandAt(cx, cz) !== null && W.escapable(cx, cz)) { best = [cx, cz]; break; }
        }
      }
      if (best) { x = best[0]; z = best[1]; }
    }
    const h = a.islandAt(x, z);
    if (h === null) return null;
    a.player.pos.set(x, h + 0.3, z);
    a.player.vel.set(0, 0, 0);
    return { x, z, oneWay };
  }, start);
  if (!placed) { console.log(`  ..    ${deg}° starts off the island — no approach exists from there`); continue; }
  if (placed.oneWay) console.log(`  ..    ${deg}° began on one-way ground; the walk starts from the nearest ground that leads home`);
  start.x = placed.x; start.z = placed.z;
  await page.waitForTimeout(500);
  // THE BUDGET IS THE WALK, NOT A ROUND NUMBER. A bearing whose honest route
  // round a massif is two hundred metres cannot be failed for taking forty
  // seconds; a gate that does that is measuring the island's shape and calling
  // it a defect. The detour itself is asserted separately, below.
  const leg = await legOf(start.x, start.z, target);
  // The budget is the walk plus, where the ring lands on ground the island
  // only lets you leave by climbing, the climb. A scramble is capped at 4.5 m
  // of height a second on purpose (src/player/locomotion.js `scrambleClimb`) —
  // that is what makes it read as hauling yourself up a face rather than
  // walking up it — so charging a bearing forty seconds for a sixty-metre climb
  // is measuring the cap, not the corridor. The assertions about being HELD,
  // being INSIDE and being BLIND are unchanged and are the ones that failed.
  const climb = placed.oneWay ? 30000 : 0;
  const budget = Math.max(40000, Math.min(BUDGET_S * 1000 + climb, ((leg?.metres || RING) / 4.2) * 1000 + 18000 + climb));
  await arm(false);
  const got = await walkTo(target, budget);
  const r = await readout();
  const row = { deg, reached: got.ok, endM: +got.d.toFixed(1), held: +r.held.toFixed(1), blind: +r.blind.toFixed(1),
    routeM: leg ? Math.round(leg.metres) : null, straightM: leg ? Math.round(leg.straight) : null,
    lineM: leg ? Math.round(leg.line) : null, dropM: leg ? Math.round(leg.drop) : null,
    budgetS: Math.round(budget / 1000),
    insideCam: +r.insideCam.toFixed(2), insidePlayer: +r.insidePlayer.toFixed(2), at: r.worstAt };
  rows.push(row);
  const bad = !got.ok || r.held >= HELD_S || r.blind >= BLIND_S || r.insideCam > 0.05 || r.insidePlayer > 0.05;
  console.log(`  ..    ${String(deg).padStart(3)}°  ${got.ok ? 'arrived' : `NEVER ARRIVED (${row.endM} m short)`}`
    + `  route ${row.routeM}m for a ${row.lineM}m line (${row.straightM}m across, ${row.dropM}m down) in ${row.budgetS}s`
    + `  held ${row.held}s  blind ${row.blind}s  inside ${row.insidePlayer}/${row.insideCam} m`);
  if (bad) await page.screenshot({ path: path.join(OUT, `bearing-${deg}.png`) });
}

note(rows.length >= 5, 'the tear was approached from at least five bearings', `${rows.length} walked`);
const never = rows.filter((r) => !r.reached);
note(never.length === 0, 'every approach bearing arrives at the tear',
  never.length ? `${never.length} did not: ${never.map((r) => `${r.deg}° (${r.endM} m short of ${r.straightM} m, route ${r.routeM} m, ${r.budgetS}s)`).join(', ')}`
    : `${rows.length}/${rows.length}`);
// …and the walk itself is not a hike. A corridor whose honest route is three
// times the line across it is the other half of the same report: "88 m between
// rifts and nothing corrects a player walking the wrong way."
const detours = rows.filter((r) => r.routeM && r.lineM && r.routeM / r.lineM > 2.4);
note(detours.length === 0, 'no approach is more than 2.4x the line a cadet has to travel',
  detours.length ? detours.map((r) => `${r.deg}°: ${r.routeM}m for a ${r.lineM}m line`).join(' · ')
    : `worst ${Math.max(...rows.map((r) => (r.routeM && r.lineM ? r.routeM / r.lineM : 1))).toFixed(2)}x`);
const stuckRows = rows.filter((r) => r.held >= HELD_S);
note(stuckRows.length === 0, 'no approach bearing holds the cadet',
  stuckRows.length ? stuckRows.map((r) => `${r.deg}°: ${r.held}s at ${(r.at || []).join(', ')}`).join(' · ')
    : `worst ${Math.max(0, ...rows.map((r) => r.held)).toFixed(1)}s (bar ${HELD_S}s)`);
const insideRows = rows.filter((r) => r.insideCam > 0.05 || r.insidePlayer > 0.05);
note(insideRows.length === 0, 'no approach bearing puts the cadet or the lens inside the island',
  insideRows.length ? insideRows.map((r) => `${r.deg}°: ${r.insidePlayer}/${r.insideCam} m`).join(' · ') : '');
const blindRows = rows.filter((r) => r.blind >= BLIND_S);
note(blindRows.length === 0, 'no approach bearing fills the frame with rock',
  blindRows.length ? blindRows.map((r) => `${r.deg}°: ${r.blind}s`).join(' · ') : '');

// ---------------------------------------------------------------------------
// 3b. DROPPED ON ONE-WAY GROUND. The promise the report is really about.
//
// 3.82% of this island, measured at two metres, is ground a cadet can walk onto
// and not walk off (`src/world/paths.js`). The corridor failure was a cadet
// standing in one of those for ninety-five seconds. So: put him in the worst
// ones there are, hold W, and require the world to let go of him.
// ---------------------------------------------------------------------------
{
  const spots = await page.evaluate(() => {
    const a = window.__ascent, W = a.world;
    if (!W || typeof W.escapable !== 'function') return [];
    const out = [];
    for (let i = 0; i < 4000 && out.length < 6; i++) {
      const t = Math.random() * Math.PI * 2, r = Math.sqrt(Math.random()) * 150;
      const x = Math.cos(t) * r, z = Math.sin(t) * r;
      if (a.islandAt(x, z) === null || W.escapable(x, z)) continue;
      if (out.some((q) => Math.hypot(q[0] - x, q[1] - z) < 12)) continue;
      out.push([+x.toFixed(1), +z.toFixed(1)]);
    }
    return out;
  });
  const OUT_S = 30;
  const freed = [];
  for (const [x, z] of spots) {
    await page.evaluate(([sx, sz]) => {
      const a = window.__ascent, W = a.world;
      const h = a.islandAt(sx, sz);
      a.player.pos.set(sx, h + 0.4, sz);
      a.player.vel.set(0, 0, 0);
      const w = W.wayOut(sx, sz);
      if (w) a.player.yaw = w.yaw;
    }, [x, z]);
    await page.waitForTimeout(600);
    const t0 = Date.now();
    await page.keyboard.down('KeyW');
    let took = null;
    while ((Date.now() - t0) / 1000 < OUT_S) {
      await page.waitForTimeout(220);
      const ok = await page.evaluate(() => {
        const a = window.__ascent, p = a.player.pos;
        return a.world.escapable(p.x, p.z) || a.islandAt(p.x, p.z) === null;
      });
      if (ok) { took = (Date.now() - t0) / 1000; break; }
    }
    await page.keyboard.up('KeyW');
    freed.push({ x, z, took });
  }
  const stuckOn = freed.filter((f) => f.took === null);
  // An island with none of it left needs no sites and passes; an island that
  // has some must be tested on some. The bar is coverage, not a round number.
  const oneWay = await page.evaluate(() => {
    const W = window.__ascent.world;
    return (W && typeof W.routeStats === 'function') ? W.routeStats().oneWay : -1;
  });
  note(oneWay === 0 || spots.length >= 1, 'one-way ground was found to test on',
    `${spots.length} sites out of ${oneWay} one-way cells`);
  note(stuckOn.length === 0, 'a cadet dropped on one-way ground walks off it',
    stuckOn.length ? `${stuckOn.length}/${freed.length} never got off: ${stuckOn.map((f) => `${f.x},${f.z}`).join(' · ')}`
      : `${freed.length}/${freed.length} free, worst ${Math.max(0, ...freed.map((f) => f.took)).toFixed(1)}s (bar ${OUT_S}s)`);
}

// ---------------------------------------------------------------------------
// 4. THE SELF-TEST. The gate has to be able to fail.
// ---------------------------------------------------------------------------
if (SELFTEST) {
  console.log('\n  ..    self-test: putting the defect back');
  let caught = 0, planted = 0;

  // (a) HELD. Pin the cadet where he stands for eight seconds while the keys
  // are down. The instrument must see it; a real wedge looks exactly like this.
  planted++;
  await page.evaluate(() => {
    const a = window.__ascent;
    const p = a.player.pos.clone();
    window.__pin = setInterval(() => { a.player.pos.copy(p); a.player.vel.set(0, 0, 0); }, 8);
  });
  await arm(true);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(8000);
  await page.keyboard.up('KeyW');
  const held = await readout();
  await page.evaluate(() => { clearInterval(window.__pin); });
  if (held.held >= HELD_S) { caught++; console.log(`  ok    the HELD assertion fires (${held.held.toFixed(1)}s)`); }
  else console.log(`  FAIL  the HELD assertion did not fire (${held.held.toFixed(1)}s)`);

  // (b) INSIDE. Drop the cadet six metres under the surface he is standing on.
  planted++;
  await arm(false);
  // The spot is PINNED, not read back off the player each tick: the recovery
  // moves him the instant it notices, and a plant that follows him is a plant
  // that stops being under the ground it was measured against. The first cut of
  // this self-test did exactly that and reported the assertion as not firing.
  // THE DEFECT, PUT BACK AS IT ACTUALLY WAS. Sinking the cadet does not work
  // and the reason is worth writing down: the game corrects it inside one frame
  // — `_finish` snaps him back onto the surface, the fall-catch digs him out —
  // so an instrument that plants a sunk cadet measures the repair, not the
  // fault. The real fault was never a cadet in the wrong place. It was the
  // DRAWN ISLAND standing over a cadet who was exactly where he should be, and
  // that is planted by making the island answer six metres high.
  await page.evaluate(() => {
    const a = window.__ascent;
    window.__isl = a.islandAt;
    a.islandAt = (x, z) => { const h = window.__isl(x, z); return h === null ? null : h + 6; };
  });
  await page.waitForTimeout(1200);
  const inside = await readout();
  await page.evaluate(() => { window.__ascent.islandAt = window.__isl; });
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(900);
  if (inside.insidePlayer > 0.05 || inside.insideCam > 0.05) {
    caught++; console.log(`  ok    the INSIDE assertion fires (cadet ${inside.insidePlayer.toFixed(2)} m)`);
  } else console.log(`  FAIL  the INSIDE assertion did not fire`);

  // (c) A LINE THAT GOES THROUGH A WALL. The defect this file was rewritten
  // for, put back where it was: a planner that answers "yes, walk that way"
  // about ground the boots refuse. The plant bends every route it returns over
  // the steepest face on the island, which is exactly what a rise rule between
  // three-metre cell centres used to do on its own.
  planted++;
  {
    const fired = await page.evaluate(() => {
      const a = window.__ascent, W = a.world;
      const E = 0.7, LIMIT = 1.5;
      const grad = (x, z) => {
        const h = a.islandAt(x, z);
        if (h === null) return null;
        const r = a.islandAt(x + E, z), l = a.islandAt(x - E, z);
        const u = a.islandAt(x, z + E), d = a.islandAt(x, z - E);
        return Math.hypot(((r === null ? h : r) - (l === null ? h : l)) / (2 * E),
          ((u === null ? h : u) - (d === null ? h : d)) / (2 * E));
      };
      // find the steepest place there is, and route everything over it
      let worst = null, wg = 0;
      for (let i = 0; i < 4000; i++) {
        const t = Math.random() * Math.PI * 2, rr = Math.sqrt(Math.random()) * 150;
        const x = Math.cos(t) * rr, z = Math.sin(t) * rr;
        const g = grad(x, z);
        if (g !== null && g > wg) { wg = g; worst = [x, z]; }
      }
      if (!worst || wg <= LIMIT) return { skipped: true, wg };
      // The plant has to be a CLIMB, because that is what the boots refuse.
      // Step four metres down the fall line from the steepest place there is,
      // and route through that point and then up into it: the line now rises
      // into a face at gradient `wg`, which is exactly the defect.
      const hw = a.islandAt(worst[0], worst[1]);
      const E2 = 0.7;
      const gx = ((a.islandAt(worst[0] + E2, worst[1]) ?? hw) - (a.islandAt(worst[0] - E2, worst[1]) ?? hw));
      const gz = ((a.islandAt(worst[0], worst[1] + E2) ?? hw) - (a.islandAt(worst[0], worst[1] - E2) ?? hw));
      const gm = Math.hypot(gx, gz) || 1;
      const low = [worst[0] - (gx / gm) * 4, worst[1] - (gz / gm) * 4];
      const hl = a.islandAt(low[0], low[1]);
      const real = W.routeFrom;
      const bent = (ax, az, bx, bz) => {
        const r = real(ax, az, bx, bz);
        if (!r) return r;
        const cells = [r.cells[0],
          [low[0], hl === null ? 0 : hl, low[1]],
          [worst[0], hw === null ? 0 : hw, worst[1]],
          ...r.cells.slice(1)];
        return { points: r.points, cells, metres: r.metres };
      };
      // …and measure the same way section 1c does, through the plant
      const list = a.rifts.list.map((rr2) => ({ id: rr2.id, x: rr2.foot ? rr2.foot.x : rr2.pos.x, z: rr2.foot ? rr2.foot.z : rr2.pos.z }));
      let over = 0, total = 0;
      for (const g2 of list.slice(0, 3)) {
        const r = bent(0, 0, g2.x, g2.z);
        if (!r) continue;
        for (let i = 1; i < r.cells.length; i++) {
          const [x0, , z0] = r.cells[i - 1], [x1, , z1] = r.cells[i];
          const L = Math.hypot(x1 - x0, z1 - z0);
          const n = Math.max(1, Math.ceil(L / 0.35));
          let ph = a.islandAt(x0, z0);
          for (let k = 1; k <= n; k++) {
            const t2 = k / n, x = x0 + (x1 - x0) * t2, z = z0 + (z1 - z0) * t2;
            total++;
            const gg = grad(x, z);
            const h = a.islandAt(x, z);
            const rising = h !== null && ph !== null && h - ph > 0.02;
            ph = h;
            if (rising && gg !== null && gg > LIMIT) over++;
          }
        }
      }
      return { over, total, wg: +wg.toFixed(2), at: [+worst[0].toFixed(0), +worst[1].toFixed(0)] };
    });
    if (fired.skipped) console.log(`  ..    no face over 1.5 on this island to plant on (worst ${fired.wg})`);
    if (fired.over > 0) {
      caught++;
      console.log(`  ok    the ROUTED-INTO-A-WALL assertion fires (${fired.over}/${fired.total} samples over 1.5, `
        + `planted on a gradient-${fired.wg} face at ${(fired.at || []).join(', ')})`);
    } else console.log('  FAIL  the ROUTED-INTO-A-WALL assertion did not fire on a route bent over the steepest face there is');
  }

  note(caught === planted, 'the gate fails when the defect is put back', `${caught}/${planted} planted defects caught`);
}

note(errors.length === 0, 'the running game logged nothing', errors.slice(0, 2).join(' | '));

await writeFile(path.join(OUT, 'traverse.json'), JSON.stringify({ target: target.id, rows, notes, errors }, null, 1));
await browser.close();
console.log(fails.length ? `\nFAILED (${fails.length})` : '\nPASSED');
/* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs. The corridor between two tears is walked with no query string, so every
   finding here is one a learner meets today. */
findings('check:traverse', { scope: 'route' }).route(fails.map(String)).done();
