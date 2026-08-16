/**
 * HOW FAST IS THE BUILD VERB, AND DOES A RAMP MEET A FLOOR.
 *
 * `handbuild.mjs` proves a square can be closed by hand. It does not say how
 * long that took, and it never photographs the one joint traversal actually
 * depends on: the top of a ramp arriving at the edge of a floor. A ramp that
 * lands a hand's breadth under the deck it was built to reach is a staircase
 * with a kerb at the top, and you find that out by falling off it.
 *
 * The same absolute rule as handbuild.mjs: **nothing here places, selects,
 * turns or clears a piece except a real DOM key event or a real mouse press.**
 * `page.evaluate` reads facts, and — in the clearly marked photography section
 * at the end — moves the lens over structure that is already committed.
 *
 * WHAT IT MEASURES, AND WHY IN THE PAGE'S OWN CLOCK.
 * This runs on a software rasteriser at a handful of frames a second, so a
 * stopwatch held against the harness measures the harness. Every piece carries
 * the `performance.now()` at which it became real (src/build/builder.js), so
 * the elapsed time between the first wall and the fourth is read out of the
 * running game and is the number a player would feel.
 *
 *   node tools/critic/buildtime.mjs --out shots/buildtime [--url …]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/buildtime'));
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

const checks = [];
const ok = (pass, what, detail = '') => {
  checks.push({ pass, what, detail });
  console.log(`  ${pass ? 'OK  ' : 'BAD '} ${what}${detail ? ' — ' + detail : ''}`);
};
const shot = async (name, ms = 260) => {
  await page.waitForTimeout(ms);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
};

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch { /* private */ } });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4200);

/** Facts only. Never a verb. */
const facts = () => page.evaluate(() => {
  const a = window.__ascent, b = a.builder;
  const live = [];
  // `k` is the RENDER BATCH, NOT THE KIND. A wall with a doorway cut into it
  // draws from its own batch (`door`) because a hole is different geometry. It
  // is still a wall to the collider and to every count here. Reading the batch
  // as the kind is why this script spent a whole round reporting "three walls
  // and the fourth never lands" about a box that was closed, and "0 doors"
  // about the doorway that closed it.
  for (const k of Object.keys(b.lattice.live)) {
    void k;
    for (const p of b.lattice.live[k]) {
      if (!p.dead) {
        live.push({ kind: p.kind, door: !!p.door, x: p.x, y: p.y, z: p.z,
          base: p.base, turn: p.turn, tms: p.tms });
      }
    }
  }
  const tg = b.target();
  return {
    pos: { x: a.player.pos.x, y: a.player.pos.y, z: a.player.pos.z },
    yaw: a.player.yaw, slot: b.slot, turn: b.turn, handOut: b.handOut,
    charge: Math.round(b.charge), owned: b.solids.owned,
    ghostKind: tg.kind, ghostAt: [tg.x, tg.z], ghostBase: tg.base,
    ghostValid: tg.valid, ghostSeals: !!tg.seals,
    boxed: !!b.player.boxed,
    whyRaw: document.querySelector('.axiom-why')?.textContent || '',
    toast: document.querySelector('.toast.show')?.textContent || '',
    pieces: live.sort((u, v) => (u.tms || 0) - (v.tms || 0)),
    now: performance.now(),
  };
});

/** How many frames the game is actually managing, so timings can be read honestly. */
const fps = () => page.evaluate(() => new Promise((res) => {
  let n = 0; const t0 = performance.now();
  const tick = () => { n++; if (performance.now() - t0 < 1000) requestAnimationFrame(tick); else res(n); };
  requestAnimationFrame(tick);
}));

const CANDIDATES = [[1180, 520], [420, 560], [1320, 300], [300, 250], [1120, 700], [800, 300]];
const worldPoint = () => page.evaluate((pts) => {
  const TAGS = 'button,a[href],input,select,textarea,summary,label,[role="button"],'
    + '[role="tab"],[role="switch"],[role="menuitem"],[contenteditable="true"]';
  const uiHit = (el) => {
    let hit = false;
    for (let n = el; n && n.nodeType === 1 && n !== document.documentElement; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.opacity === '0' || cs.visibility === 'hidden' || cs.display === 'none') return false;
      if (!hit && (n.matches?.(TAGS) || cs.cursor === 'pointer')) hit = true;
    }
    return hit;
  };
  for (const p of pts) {
    const el = document.elementFromPoint(p[0], p[1]);
    if (el && !uiHit(el)) return p;
  }
  return null;
}, CANDIDATES);

const click = async () => {
  const first = await worldPoint();
  const order = first ? [first, ...CANDIDATES.filter((p) => p !== first)] : CANDIDATES;
  for (const pt of order) {
    await page.mouse.click(pt[0], pt[1]);
    await page.waitForTimeout(90);
    const onUI = await page.evaluate(() => window.__ascent.input.pointerOnUI);
    if (!onUI) { await page.waitForTimeout(220); return pt; }
    await page.waitForTimeout(300);
  }
  return null;
};

async function pressUntil(key, want, tries = 4) {
  for (let i = 0; i < tries; i++) {
    await page.keyboard.press(key);
    for (const w of [280, 420, 700]) {
      await page.waitForTimeout(w);
      const f = await facts();
      if (want(f)) return { f, presses: i + 1 };
    }
  }
  return { f: await facts(), presses: tries, failed: true };
}

const KEYS = ['KeyW', 'KeyS', 'KeyA', 'KeyD'];
const dirOf = (yaw) => {
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  return { KeyW: [fx, fz], KeyS: [-fx, -fz], KeyA: [fz, -fx], KeyD: [-fz, fx] };
};
async function walkTo(tx, tz, tol = 0.7, tries = 26) {
  for (let i = 0; i < tries; i++) {
    const f = await facts();
    const dx = tx - f.pos.x, dz = tz - f.pos.z;
    const d = Math.hypot(dx, dz);
    if (d <= tol) return true;
    const dir = dirOf(f.yaw);
    let best = null, bs = -Infinity;
    for (const k of KEYS) {
      const s = (dir[k][0] * dx + dir[k][1] * dz) / d;
      if (s > bs) { bs = s; best = k; }
    }
    await page.keyboard.down(best);
    await page.waitForTimeout(Math.min(420, Math.max(90, d * 55)));
    await page.keyboard.up(best);
    await page.waitForTimeout(220);
  }
  return false;
}

const f0 = await facts();
const HZ = await fps();
console.log(`spawn ${JSON.stringify(f0.pos)} yaw ${f0.yaw.toFixed(3)} — harness renderer at ${HZ} fps`);

const flatCells = await page.evaluate((q) => {
  const a = window.__ascent;
  const c = (v) => Math.floor(v / 4 + 0.5) * 4;
  const cx0 = c(q.x), cz0 = c(q.z);
  const out = [];
  for (let i = -7; i <= 7; i++) {
    for (let j = -7; j <= 7; j++) {
      const x = cx0 + i * 4, z = cz0 + j * 4;
      let lo = Infinity, hi = -Infinity, bad = false;
      for (const [dx, dz] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, -2], [2, -2], [-2, 2],
        [6, 0], [-6, 0], [0, 6], [0, -6]]) {
        const h = a.islandAt(x + dx, z + dz);
        if (h === null) { bad = true; break; }
        lo = Math.min(lo, h); hi = Math.max(hi, h);
      }
      // Clear of the plaza's own fixed furniture. And, separately, whether a
      // lattice anchor stands over it: an anchor's halo and plumb line are a
      // column of additive light that lands straight across whatever joint is
      // photographed beneath it — the first clean run put the ramp head four
      // metres from anchor one and the seam came back as a white blank. The
      // joint has to avoid that. A box does not, so it is kept separate rather
      // than thrown away, which pushed the box thirty metres onto a hillside.
      const clutter = a.builder.solids.all.some((p) => p.fixed && Math.hypot(p.x - x, p.z - z) < 9);
      const lit = a.anchors().at.some((p) => Math.hypot(p[0] - x, p[2] - z) < 13);
      if (!bad) out.push({ x, z, span: +(hi - lo).toFixed(3), clutter, lit, d: Math.hypot(x - q.x, z - q.z) });
    }
  }
  return out.sort((u, v) => (u.clutter - v.clutter) || (u.span - v.span) || (u.d - v.d)).slice(0, 16);
}, f0.pos);

const near = (c, o, lo, hi) => {
  const d = Math.hypot(c.x - o.x, c.z - o.z);
  return d >= lo && d <= hi;
};
const rampSite = flatCells.find((c) => !c.clutter && !c.lit) || flatCells[0];
const boxSite = flatCells.find((c) => !c.clutter && c.span < 0.2 && near(c, rampSite, 11, 21))
  || flatCells.find((c) => !c.clutter && near(c, rampSite, 9, 26))
  || flatCells[1];
console.log(`  ramp site (${rampSite.x}, ${rampSite.z}); box site (${boxSite.x}, ${boxSite.z})`);

// =========================================================================
// 1. A RAMP MEETING A FLOOR. The joint traversal is made of.
// =========================================================================
console.log('\n== a ramp meets a floor');
// The joint goes up FIRST, on untouched ground. Built after the box, it kept
// finding one of the box's own walls between the cadet and the ramp head — a
// harness problem, but the sort that quietly turns a joint proof into a
// photograph of nothing.
await walkTo(rampSite.x, rampSite.z, 1.0, 44);
const atSite = await facts();
ok(Math.hypot(atSite.pos.x - rampSite.x, atSite.pos.z - rampSite.z) < 2.2,
  'stood in a clear flat cell to set the ramp in',
  `${rampSite.x}, ${rampSite.z} — ground spans ${rampSite.span} m`);
await pressUntil('Digit2', (f) => f.slot === 1);
const preRamp = await facts();
await click();
const rampF = await facts();
const ramp = rampF.pieces.find((p) => p.kind === 'ramp');
ok(!!ramp && rampF.owned === preRamp.owned + 1, 'a click sets a ramp',
  ramp ? `ramp at ${ramp.x},${ramp.z} base ${ramp.base} turn ${ramp.turn}` : 'none');
await shot('10-ramp-set');

let floor = null;
let climbed = null;
if (ramp) {
  // Run up it. The top of a ramp is exactly one storey above its base, so a
  // cadet who arrives at the far edge should be standing at base + 4 and not a
  // step under it. Uphill is the ramp's own local +z (src/build/pieces.js:
  // `surfaceAt` climbs with `lz`), which in world terms is the inverse of the
  // quarter turn the piece was set on.
  const [rc, rs] = [[1, 0], [0, 1], [-1, 0], [0, -1]][((ramp.turn % 4) + 4) % 4];
  const up = { x: rs, z: rc };             // world direction of the climb
  const topX = ramp.x + up.x * 1.6, topZ = ramp.z + up.z * 1.6;
  await walkTo(topX, topZ, 0.9, 30);
  climbed = await facts();
  ok(climbed.pos.y > ramp.base + 2.5,
    'the cadet runs up the ramp he set — it is traversal, not decoration',
    `stood at y ${climbed.pos.y.toFixed(2)}, ramp base ${ramp.base}, top ${ramp.base + 4} — `
    + `${(climbed.pos.y - ramp.base).toFixed(2)} m gained on W alone, no jump`);
  await shot('11-on-the-ramp');

  await pressUntil('Digit3', (f) => f.slot === 2);
  const pre = await facts();
  await click();
  const ff = await facts();
  floor = ff.pieces.find((p) => p.kind === 'floor');
  ok(!!floor && ff.owned === pre.owned + 1, 'a click from the ramp head lays a floor',
    floor ? `floor at ${floor.x},${floor.z} base ${floor.base}` : 'none');
  if (floor) {
    ok(Math.abs(floor.base - (ramp.base + 4)) < 1e-9,
      'the floor is founded EXACTLY one storey above the ramp — the ramp head IS the deck',
      `ramp base ${ramp.base} + 4 = ${ramp.base + 4}, floor base ${floor.base}, `
      + `difference ${(floor.base - ramp.base - 4).toExponential(2)} m`);
    // …and the boots agree. Sample the collider along the line the cadet walks,
    // from the middle of the ramp, over the joint, onto the deck.
    const walkLine = await page.evaluate((q) => {
      const a = window.__ascent;
      const out = [];
      for (let s = -3.4; s <= 3.4; s += 0.34) {
        const x = q.jx + q.dx * s, z = q.jz + q.dz * s;
        out.push({ s: +s.toFixed(2), top: a.surfaceAt(x, z) });
      }
      return out;
    }, {
      jx: (ramp.x + floor.x) / 2, jz: (ramp.z + floor.z) / 2,
      dx: Math.sign(floor.x - ramp.x), dz: Math.sign(floor.z - ramp.z),
    });
    let worst = 0, at = 0;
    for (let i = 1; i < walkLine.length; i++) {
      const a0 = walkLine[i - 1].top, a1 = walkLine[i].top;
      if (a0 === null || a1 === null) continue;
      const step = Math.abs(a1 - a0);
      if (step > worst) { worst = step; at = walkLine[i].s; }
    }
    ok(worst < 0.42,
      'and the boots find one unbroken surface across the joint — no kerb at the top',
      `largest step in the collider along the walk line: ${worst.toFixed(3)} m at s=${at}`);
    console.log('  collider along the walk line:',
      walkLine.map((p) => (p.top === null ? 'air' : p.top.toFixed(2))).join(' '));

    // Walk from the ramp onto the floor without jumping. If there is a kerb,
    // this is where a player finds it.
    await walkTo(floor.x, floor.z, 0.9, 24);
    const onDeck = await facts();
    ok(Math.abs(onDeck.pos.y - floor.base) < 0.3,
      'the cadet steps off the ramp onto the deck without a jump',
      `stood at y ${onDeck.pos.y.toFixed(3)}, deck top ${floor.base}`);
    await shot('12-stepped-onto-the-deck');
  }
}


// =========================================================================
// 2. THE SWEEP. One held trigger, three quarter turns, four walls.
//
// This is the Fortnite gesture and it is the one that has to be fast: the
// trigger goes down once and stays down while the piece is turned under it.
// Nothing here waits on the harness's own polling — the mouse goes down, the
// three turns are flicked in at a human pace, the mouse comes up, and the
// times are read afterwards off the pieces themselves.
// =========================================================================
console.log('\n== the sweep: one held trigger, three flicks of F, four walls');
// Far enough from the ramp that neither structure is standing in the other's
// way — a box is built around the cadet, and it wants four clear faces.
await walkTo(boxSite.x, boxSite.z, 1.0, 60);
const atBox = await facts();
ok(Math.hypot(atBox.pos.x - boxSite.x, atBox.pos.z - boxSite.z) < 2.2,
  'stood in a clear flat cell to build the box in',
  `${boxSite.x}, ${boxSite.z} — ground spans ${boxSite.span} m`);
await pressUntil('Digit1', (f) => f.slot === 0);
// WAIT FOR THE RESERVE, THE WAY THE CHIP TELLS YOU TO.
//
// The reserve is a real cost (src/build/builder.js: MAX_CHARGE, REGEN) and the
// ramp and the deck above already spent most of it. Sweeping a box on the
// remains got three walls and a refusal, and this script read that as "the
// fourth wall does not land" — a bug in the measurement, not in the verb. A
// player reads "Build charge spent. Wait for it to refill." and waits. So does
// this, and the sweep it then measures is a sweep with the reserve behind it.
for (let i = 0; i < 40; i++) {
  const f = await facts();
  if (f.charge >= 74) break;
  await page.waitForTimeout(500);
}
console.log(`  reserve before the sweep: ${(await facts()).charge}`);
const pt = await worldPoint() || CANDIDATES[0];
await page.mouse.move(pt[0], pt[1]);
await page.evaluate(() => {
  window.__down = [];
  addEventListener('mousedown', () => window.__down.push(performance.now()), true);
  // A PASSIVE FLIGHT RECORDER. Reads only, on the page's own frames, so the
  // measurement below is not interrupted by a round trip to node. It exists
  // because "the fourth wall did not land" is a claim that needs the slot the
  // fourth column actually resolved to, and asking for it mid-gesture would
  // change the gesture.
  window.__trace = [];
  const a = window.__ascent, b = a.builder;
  const tick = () => {
    const tg = b.target();
    window.__trace.push({ t: Math.round(performance.now()), turn: b.turn,
      cell: `${Math.round(a.player.pos.x / 4) * 4},${Math.round(a.player.pos.z / 4) * 4}`,
      pos: `${a.player.pos.x.toFixed(2)},${a.player.pos.z.toFixed(2)}`,
      slot: `${tg.x},${tg.z}`, base: tg.base, valid: tg.valid, why: tg.reason,
      charge: Math.round(b.charge) });
    window.__traceId = requestAnimationFrame(tick);
  };
  tick();
});
// ONE UNBROKEN GESTURE, AND NOTHING IN THE MIDDLE OF IT.
//
// This used to be a hold, three flicks of F, and then two more deliberate
// presses — because the wall that closed the room was refused once and had to
// be confirmed. It is not refused any more: it goes down with a doorway cut
// into it (src/build/builder.js, `place`). So the gesture is now exactly what
// a player would do: press, turn, turn, turn, release. Four walls, one press.
//
// The two extra presses that used to confirm the room are gone, and they had
// to go: with the box already closed they were two more clicks at a face that
// was already built, which is how this script used to end with five walls on
// three levels and call it a failure of the fourth.
//
// The waits below are a person's: a flick of the wrist between quarter turns.
// Nothing here takes a screenshot or asks node a question, because a full-page
// capture at two times scale costs about a second and would land in the middle
// of the measurement. The photographs are taken afterwards, off the finished box.
await page.mouse.down();
for (let i = 0; i < 3; i++) {
  await page.waitForTimeout(120);          // a human quarter-turn flick
  await page.keyboard.press('KeyF');
}
await page.waitForTimeout(300);
await page.mouse.up();
await page.waitForTimeout(420);
const swept = await facts();
const sw = swept.pieces.filter((p) => p.kind === 'wall');
const span = sw.length >= 2 ? sw[sw.length - 1].tms - sw[0].tms : NaN;
const levels = [...new Set(sw.map((p) => p.base))];
console.log(`  walls down: ${sw.length}  gaps(ms): ${sw.map((p, i) => i ? Math.round(p.tms - sw[i - 1].tms) : 0).slice(1).join(', ')}`);
console.log(`  faces: ${[...new Set(sw.map((p) => `${p.x},${p.z}`))].join(' | ')}  levels: ${JSON.stringify(levels)}`);
const tr = await page.evaluate(() => { cancelAnimationFrame(window.__traceId); const t = window.__trace; const out = []; for (const r of t) { const k = r.turn + '|' + r.slot + '|' + r.valid + '|' + r.why + '|' + r.cell; if (!out.length || out[out.length - 1].k !== k) out.push({ k, ...r }); } return out; });
for (const r of tr) console.log(`    t${r.turn} cell ${r.cell} at ${r.pos} -> slot ${r.slot} base ${r.base} valid=${r.valid} ${r.why} charge ${r.charge}`);
console.log(`  reserve after: ${swept.charge}  chip: "${await page.evaluate(() => document.querySelector('.axiom-why')?.textContent || '')}"`);
ok(sw.length === 4, 'ONE held trigger and three flicks of F close the whole box',
  `${sw.length} walls from ONE mouse press and 3 taps of F`);
// THE CHIMNEY. One hold used to answer the same face over and over, finding the
// top of the wall it had just set as the next level up: nine walls, six storeys,
// the whole reserve, in 570 ms, none of it asked for.
ok(levels.length === 1, 'and it does not climb — one hold never stacks a second storey',
  `levels touched: ${JSON.stringify(levels)}`);
ok(sw.length === 4 && span < 1600, 'and the whole sweep lands inside one and a half seconds',
  `${Math.round(span)} ms from the first wall to the last, in the game's own clock, at ${HZ} fps`);

const closed = swept;
const cw = sw;
const t4 = cw.length === 4 ? cw[3].tms - cw[0].tms : NaN;
ok(cw.length === 4 && new Set(cw.map((p) => p.base)).size === 1,
  'all four walls founded on exactly one level',
  JSON.stringify([...new Set(cw.map((p) => p.base))]));
// THE LATENCY. How long after the button goes down does the piece exist?
const lat = await page.evaluate(() => window.__down.slice());
const lastWall = cw[cw.length - 1];
const react = lat.length && lastWall ? cw[0].tms - lat[0] : NaN;
console.log(`  TIME TO A CLOSED BOX: ${Math.round(t4)} ms of the game's own clock — `
  + '4 walls, 1 mouse hold + 3 taps of F');
console.log(`  button down → piece real: ${Math.round(react)} ms`);
ok(react >= 0 && react < 60, 'a piece is real on the frame the button goes down',
  `${Math.round(react)} ms from mousedown to the piece existing in the collider`);
ok(t4 < 2500, 'four walls and a closed box inside two and a half seconds, by hand',
  `${Math.round(t4)} ms`);
// NOT SHUT IN, AND THAT IS THE POINT. The sealing wall carries a doorway, so
// the room he just closed is a room and not a trap. `boxed` is the flag that
// sends the recovery key outside the walls; it must be FALSE, because there is
// nothing to recover from.
const doors = cw.filter((p) => p.door);
ok(doors.length === 1, 'the wall that closed the room carries a doorway',
  `${doors.length} door(s)`);
ok(!closed.boxed, 'so he is not shut in, and needs no rescue', `boxed ${closed.boxed}`);
await shot('01-box-closed');

// Out again, so the ramp can be built on clean ground.
await pressUntil('KeyQ', (f) => !f.boxed);
await page.waitForTimeout(300);

const after = await facts();
await writeFile(path.join(OUT, 'buildtime.json'), JSON.stringify({
  hz: HZ, sweepMs: span, boxMs: t4, checks, errors,
  pieces: after.pieces,
}, null, 2));

// -------------------------------------------------------------------------
// PHOTOGRAPHY. Everything above is committed. Nothing below places, removes
// or selects anything — it only moves the lens.
// -------------------------------------------------------------------------
await page.evaluate(() => {
  const a = window.__ascent, b = a.builder;
  a.player.root.visible = false;
  window.__lens = {
    /**
     * A TRIPOD, NOT A HAND — AND IT HAS TO BE BOLTED DOWN.
     *
     * The lens is the cadet with the camera on its boom behind him, so moving
     * it means moving him. Setting the position once is not enough when the
     * joint being photographed is four metres up: gravity has him by the next
     * frame, and half a second later the shot is of the plaza floor with the
     * structure somewhere overhead. Every close-up of the ramp head came back
     * like that. So the position is re-pinned every frame until the next look.
     */
    look(fx, fy, fz, tx, ty, tz) {
      if (window.__pin) cancelAnimationFrame(window.__pin);
      const hold = () => {
        a.player.pos.set(fx, fy, fz);
        a.player.vel.set(0, 0, 0);
        window.__pin = requestAnimationFrame(hold);
      };
      hold();
      a.player.yaw = Math.atan2(tx - fx, tz - fz);
      a.player.pitch = Math.atan2(ty - fy, Math.hypot(tx - fx, tz - fz));
      b._armT = 0; b._held = false; b.ghostView.visible = false;
      // the amber "you are aiming at this" highlight is a selection, not a
      // joint, and it reads as a different piece in a close-up
      if (b._aimed) { b._aimed.want = 0; b._aimed = null; }
      b.setActive(false);
      document.getElementById('ui').style.display = 'none';
    },
    project(x, y, z) {
      const v = new a.THREE.Vector3(x, y, z).project(a.camera);
      return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
    },
  };
});
const lens = (fx, fy, fz, tx, ty, tz) =>
  page.evaluate((q) => window.__lens.look(...q), [fx, fy, fz, tx, ty, tz]);
const zoom = async (name, pt, size = 480, ms = 480) => {
  await page.waitForTimeout(ms);
  const p = await page.evaluate((q) => window.__lens.project(q[0], q[1], q[2]), pt);
  const half = size / 2;
  await page.screenshot({
    path: path.join(OUT, `${name}.png`),
    clip: {
      x: Math.max(0, Math.min(1600 - size, Math.round(p.x - half))),
      y: Math.max(0, Math.min(900 - size, Math.round(p.y - half))),
      width: size, height: size,
    },
  });
};

if (ramp && floor) {
  const T = ramp.base + 4;                    // the level the joint is on
  const dx = Math.sign(floor.x - ramp.x), dz = Math.sign(floor.z - ramp.z);
  const jx = (ramp.x + floor.x) / 2, jz = (ramp.z + floor.z) / 2;   // the seam
  // Side on and level with the joint: the one line of sight that shows daylight
  // if there is any. Both sides, so nothing in the plaza can hide it. The lens
  // is a tripod on a three-and-a-half metre boom, so standing two metres off the
  // seam puts the camera about five metres back — close enough to read a
  // centimetre, far enough not to be inside the ramp.
  for (const [i, s] of [[1, 1], [2, -1]]) {
    await lens(jx + dz * s * 2.1, T + 0.85, jz + dx * s * 2.1, jx, T - 0.25, jz);
    await shot(`20-${i}-ramp-floor-side`, 620);
    await zoom(`20z-${i}-ramp-meets-floor`, [jx, T - 0.12, jz], 560);
  }
  // Right down on the seam: the height a boot arrives at it.
  await lens(jx + dz * 1.7, T + 0.34, jz + dx * 1.7, jx, T - 0.04, jz);
  await shot('21-ramp-floor-seam', 620);
  await zoom('21z-ramp-floor-seam', [jx, T - 0.02, jz], 560);
  // Down the walk line, from over the ramp, at the height of a cadet's eye.
  await lens(jx - dx * 2.4, T + 1.05, jz - dz * 2.4, jx + dx * 2.0, T, jz + dz * 2.0);
  await shot('22-ramp-floor-along', 620);
  await zoom('22z-ramp-floor-along', [jx, T + 0.02, jz], 560);
  // And from above, so the two footprints read as two cells sharing one edge.
  await lens(jx + dz * 2.6, T + 4.2, jz + dx * 2.6, jx, T, jz);
  await shot('23-ramp-floor-above', 620);
  // Straight down the deck's own surface at the seam. Every angle at eye level
  // is at the mercy of whatever the plaza has parked in front of it; this one
  // line of sight cannot be blocked, and it is the line that says whether the
  // ramp's head and the deck's top are one plane or two.
  await lens(floor.x, T + 7.0, floor.z, jx, T, jz);
  await shot('24-seam-from-over', 640);
  await zoom('24z-seam-from-over', [jx, T, jz], 600);
}

console.log(`\nconsole errors: ${errors.length}${errors.length ? ' — ' + errors.slice(0, 3).join(' | ') : ''}`);
const bad = checks.filter((c) => !c.pass);
console.log(bad.length ? `\nFAILING: ${bad.length}` : '\nevery timing and joint check passes');
await browser.close();
process.exit(bad.length || errors.length ? 1 : 0);
