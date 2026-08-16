/**
 * THE BUILD VERB, PROVED BY HAND.
 *
 * A cold critic could not close a square in ten walls and five minutes, said
 * the 90° turn between placements landed twice in eight attempts, photographed
 * a raw butt joint at the one corner he did get, and stood beside his own wall
 * with the lens inside it. This is the rig that has to disagree with him in
 * pixels rather than in prose.
 *
 * THE RULE, WITHOUT EXCEPTION. Nothing here places, turns, selects or clears a
 * piece except a real DOM key event or a real mouse press. `page.evaluate` is
 * allowed to do exactly three things:
 *   1. read facts back out of the running game;
 *   2. find flat ground to walk to (a fact about the island);
 *   3. in the section marked PHOTOGRAPHY — and only there — move the lens over
 *      structure that a real click already committed.
 * The debug API has hidden false fixes here three separate times. It builds
 * nothing in this file.
 *
 * WHY THE BODY IS TURNED WITH A DRAG. Pointer lock is refused in every headless
 * Chromium and, tested on this machine, in a headed one driven by Playwright
 * too ("the root document of this element is not valid for pointer lock"), so
 * `movementX` on a locked pointer cannot be exercised at all. The drag path
 * writes to the *same* accumulator, `input.look.x` (src/core/input.js), so this
 * turns the cadet exactly the way a mouse turns him, with events the browser
 * generates rather than state this script pokes.
 *
 * WHAT IT PROVES
 *   1. a 90° turn lands EVERY time, over sixteen consecutive attempts, by body
 *      and by the rotate key, and each one moves the slot to the next face;
 *   2. four walls close a square, and it is timed on the game's own clock;
 *   3. a click at a wall that is already there says so — it does not build a
 *      chimney over your head;
 *   4. a wall meets a floor, and a ramp meets a floor, both built by hand;
 *   5. the lens is never inside the cadet's own structure, from 40 bearings;
 *   6. every joint above, photographed close enough to see a centimetre, with
 *      the interface hidden and the pieces settled.
 *
 *   node tools/critic/handproof.mjs --url http://127.0.0.1:4399 --out shots/handproof
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4399');
const OUT = path.resolve(arg('out', 'shots/handproof'));
/**
 * Which structures to build. `square` skips the two long walks across the
 * plaza, which is the slowest part of the run by a factor of ten and the only
 * part that competes with another builder's capture for the same processor.
 */
const ONLY = arg('only', 'all');
await mkdir(OUT, { recursive: true });

const W = 1600, H = 900;
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({
  viewport: { width: W, height: H }, deviceScaleFactor: 2, hasTouch: true,
});
const page = await ctx.newPage();
const cdp = await ctx.newCDPSession(page);
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
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 45000 });
await page.waitForTimeout(4500);

// ------------------------------------------------------------- facts only
const facts = () => page.evaluate(() => {
  const a = window.__ascent, b = a.builder;
  const live = [];
  for (const k of Object.keys(b.lattice.live)) {
    for (const p of b.lattice.live[k]) {
      if (!p.dead) {
        live.push({ kind: p.kind, door: !!p.door, x: +p.x.toFixed(2), z: +p.z.toFixed(2),
          y: +p.y.toFixed(3), base: +p.base.toFixed(3), turn: p.turn, tms: p.tms, grow: p.grow });
      }
    }
  }
  const tg = b.target();
  const cp = a.camera.position;
  return {
    pos: { x: +a.player.pos.x.toFixed(2), y: +a.player.pos.y.toFixed(2), z: +a.player.pos.z.toFixed(2) },
    yaw: +a.player.yaw.toFixed(4), pitch: +a.player.pitch.toFixed(3),
    slot: b.slot, turn: b.turn, handOut: b.handOut, charge: Math.round(b.charge),
    ghost: { kind: tg.kind, x: tg.x, z: tg.z, base: +tg.base.toFixed(3), turn: tg.turn,
      valid: tg.valid, reason: tg.reason, seals: !!tg.seals },
    boxed: !!b.player.boxed,
    why: document.querySelector('.axiom-why.show')?.textContent || '',
    camInside: b.solids.contains(cp.x, cp.y, cp.z, 0.10),
    camPos: { x: +cp.x.toFixed(2), y: +cp.y.toFixed(2), z: +cp.z.toFixed(2) },
    fps: Math.round(a.engine.fps || 0),
    pieces: live,
  };
});

// --------------------------------------------------------- real input only
const CANDIDATES = [[1180, 520], [420, 560], [1300, 300], [300, 260], [1120, 700], [800, 330]];
const worldPoint = () => page.evaluate((pts) => {
  const TAGS = 'button,a[href],input,select,textarea,summary,label,[role="button"],[role="tab"]';
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

/** Clear whatever card the run has raised, with the real button or real Escape. */
async function clearUI() {
  for (let i = 0; i < 5; i++) {
    if (!(await page.evaluate(() => window.__ascent.input.uiOpen))) return true;
    const btn = page.locator('button:visible').filter({
      hasText: /BEGIN THE RUN|GOT IT|CLOSE|CONTINUE|COMENZAR|ENTENDIDO|ZACZNIJ|ROZUMIEM/i,
    }).first();
    if (await btn.count().catch(() => 0)) await btn.click().catch(() => {});
    else await page.keyboard.press('Escape');
    await page.waitForTimeout(700);
  }
  return !(await page.evaluate(() => window.__ascent.input.uiOpen));
}
const click = async () => {
  await clearUI();
  const first = await worldPoint();
  const order = first ? [first, ...CANDIDATES.filter((p) => p !== first)] : CANDIDATES;
  for (const pt of order) {
    await page.mouse.move(pt[0], pt[1]);
    await page.mouse.down(); await page.waitForTimeout(50); await page.mouse.up();
    await page.waitForTimeout(120);
    if (!(await page.evaluate(() => window.__ascent.input.pointerOnUI))) {
      await page.waitForTimeout(300); return pt;
    }
    await page.waitForTimeout(260);
  }
  return null;
};
const press = async (k, ms = 320) => { await clearUI(); await page.keyboard.press(k); await page.waitForTimeout(ms); };
const walk = async (k, ms) => {
  await clearUI();
  await page.keyboard.down(k); await page.waitForTimeout(ms);
  await page.keyboard.up(k); await page.waitForTimeout(340);
};
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const sens = () => page.evaluate(() => window.__ascent.input.sensitivity || 1);

/** Turn the body with a real drag — the same accumulator a mouse writes to. */
async function dragYaw(rad) {
  const k = 0.0052 * (await sens());
  const px = -rad / k;                       // dragging right lowers yaw
  const y0 = (await facts()).yaw;
  const x0 = 1150 - px / 2, y = 320, steps = 14;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y, id: 1 }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ x: x0 + (px * i) / steps, y, id: 1 }],
    });
    await page.waitForTimeout(20);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(380);
  const y1 = (await facts()).yaw;
  if (process.env.HANDPROOF_DEBUG) {
    const el = await page.evaluate((q) => {
      const e = document.elementFromPoint(q[0], q[1]);
      return e ? e.tagName + '.' + (e.className || '') : 'none';
    }, [x0, y]);
    console.log(`    drag x ${x0.toFixed(0)}->${(x0 + px).toFixed(0)} over ${el}`
      + `  yaw ${y0} -> ${y1}  ui=${await page.evaluate(() => window.__ascent.input.uiOpen)}`);
  }
  return wrap(y1 - y0);
}
/**
 * Turn the body a quarter turn.
 *
 * THE RUN RAISES CARDS ON ITS OWN CLOCK, and while one is up the world takes no
 * input at all — which is correct, and is also the one thing that can make a
 * turn "not land" in an unattended script. A card can arrive between clearing
 * the last one and starting the drag. A person sees the card, dismisses it, and
 * turns; so this reports both numbers: whether the drag landed first time, and
 * whether the interface was up when it did not.
 */
async function turnBody(rad) {
  await clearUI();
  const got = await dragYaw(rad);
  if (Math.abs(wrap(got - rad)) <= 0.10) return { got, blocked: false, retried: false };
  const blocked = await page.evaluate(() => window.__ascent.input.uiOpen
    || !!document.querySelector('.card.show, .comms.show, .orders.show'));
  await clearUI();
  const again = await dragYaw(rad);
  return { got: again, blocked, retried: true };
}

/** Raise or lower the gaze with a real drag — input.look.y, as a mouse writes it. */
async function tiltBody(rad) {
  await clearUI();
  const k = 0.0052 * (await sens());
  const px = -rad / k;                       // dragging up raises the gaze
  const x = 1150, y0 = 380 - px / 2, steps = 14;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y: y0, id: 1 }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ x, y: y0 + (px * i) / steps, id: 1 }],
    });
    await page.waitForTimeout(20);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(380);
  return (await facts()).pitch;
}

/** Is this set of four walls a closed square? Pure geometry on the facts. */
function squareOf(walls) {
  if (walls.length !== 4) return { closed: false, why: `${walls.length} walls, not 4` };
  const base = walls[0].base;
  if (walls.some((w) => Math.abs(w.base - base) > 0.02)) {
    return { closed: false, why: `walls on ${new Set(walls.map((w) => w.base)).size} levels` };
  }
  const N = new Map();
  for (const w of walls) {
    const [c, s] = [[1, 0], [0, 1], [-1, 0], [0, -1]][w.turn % 4];
    for (const k of [1, -1]) {
      const key = `${(w.x + c * 2 * k).toFixed(2)},${(w.z - s * 2 * k).toFixed(2)}`;
      N.set(key, (N.get(key) || 0) + 1);
    }
  }
  const shared = [...N.entries()].filter(([, n]) => n === 2);
  if (N.size !== 4 || shared.length !== 4) {
    return { closed: false, why: `${N.size} nodes, ${shared.length} shared — not a ring` };
  }
  const xs = shared.map(([k]) => +k.split(',')[0]);
  const zs = shared.map(([k]) => +k.split(',')[1]);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...zs) - Math.min(...zs);
  return { closed: Math.abs(w - 4) < 0.02 && Math.abs(h - 4) < 0.02,
    why: `${w}x${h} m footprint`, corners: shared.map(([k]) => k), base };
}

/** Flat, clear cells to build on, sorted best first. Reads the island only. */
const flatCells = (near) => page.evaluate((q) => {
  const a = window.__ascent;
  const c = (v) => Math.floor(v / 4 + 0.5) * 4;
  const out = [];
  for (let i = -8; i <= 8; i++) {
    for (let j = -8; j <= 8; j++) {
      const x = c(q.x) + i * 4, z = c(q.z) + j * 4;
      let lo = Infinity, hi = -Infinity, bad = false;
      for (const [dx, dz] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, -2], [2, -2],
        [-2, 2], [6, 0], [-6, 0], [0, 6], [0, -6]]) {
        const h = a.islandAt(x + dx, z + dz);
        if (h === null) { bad = true; break; }
        lo = Math.min(lo, h); hi = Math.max(hi, h);
      }
      // Anything already standing near the cell — the plaza's own colliders as
      // well as the cadet's pieces — puts a boulder in the middle of a joint
      // photograph. A close-up of a corner with a rock in front of it proves
      // nothing about the corner.
      const clutter = a.builder.solids.all.filter((p) => Math.hypot(p.x - x, p.z - z) < 16).length;
      // Props are drawn, not collided, so the collider list does not see them.
      // The scene does: anything with real geometry standing within 16 m and
      // more than a metre tall is in shot.
      let props = 0;
      a.scene.traverseVisible?.((o) => {
        if (!o.isMesh || o.userData?.noCamBlock) return;
        const wp = o.getWorldPosition(new a.THREE.Vector3());
        if (Math.abs(wp.y - (a.islandAt(x, z) ?? wp.y)) > 26) return;
        if (Math.hypot(wp.x - x, wp.z - z) < 15) props++;
      });
      if (!bad) {
        out.push({ x, z, span: +(hi - lo).toFixed(3), clutter, props, d: Math.hypot(x - q.x, z - q.z) });
      }
    }
  }
  return out
    .filter((s) => s.d > 10)
    .sort((u, v) => (u.span - v.span) || (u.clutter - v.clutter) || (u.props - v.props) || (u.d - v.d))
    .slice(0, 40);
}, near);

const KEYS = ['KeyW', 'KeyS', 'KeyA', 'KeyD'];
/**
 * Walk there on W/A/S/D, the way a person does — including when something is
 * in the way. The greedy "press whichever key points most at the target" walk
 * cannot thread a doorway: it runs at the target, catches a jamb four
 * centimetres wide, and presses the same key into the same jamb for ever.
 * A person sidesteps. So does this: a step that gains nothing retires its key
 * for the next attempt and the next-best one is tried instead.
 */
async function walkTo(tx, tz, tol = 0.8, tries = 40) {
  let barred = null;
  for (let i = 0; i < tries; i++) {
    const f = await facts();
    const dx = tx - f.pos.x, dz = tz - f.pos.z, d = Math.hypot(dx, dz);
    if (d <= tol) return true;
    const fx = Math.sin(f.yaw), fz = Math.cos(f.yaw);
    const dir = { KeyW: [fx, fz], KeyS: [-fx, -fz], KeyA: [fz, -fx], KeyD: [-fz, fx] };
    const ranked = KEYS
      .map((k) => ({ k, s: (dir[k][0] * dx + dir[k][1] * dz) / d }))
      .sort((u, v) => v.s - u.s)
      .filter((r) => r.k !== barred);
    const best = ranked[0].k;
    await walk(best, Math.min(430, Math.max(110, d * 55)));
    const g = (await facts()).pos;
    barred = Math.hypot(g.x - f.pos.x, g.z - f.pos.z) < 0.18 ? best : null;
  }
  return false;
}
/**
 * …and when even that fails, press the key the game prints for exactly this.
 * R is the recovery: it puts the cadet back on solid ground clear of whatever
 * he is on or wedged against. A player who has built himself onto a deck and
 * wants to be somewhere else presses it. So does this, and then walks again.
 */
async function walkOrRecover(tx, tz, tol = 2.2, tries = 26) {
  if (await walkTo(tx, tz, tol, tries)) return true;
  await press('KeyR', 1600);
  return walkTo(tx, tz, tol, tries);
}

// The run opens with an ORDERS card. A player presses the button on it.
for (let i = 0; i < 3; i++) {
  const btn = page.locator('button:visible', { hasText: /BEGIN THE RUN|COMENZAR|ZACZNIJ/i }).first();
  if (await btn.count().catch(() => 0)) { await btn.click().catch(() => {}); await page.waitForTimeout(900); }
  else break;
}
await clearUI();
const f0 = await facts();
console.log(`spawn ${JSON.stringify(f0.pos)} · harness renderer at ${f0.fps} fps`);
const sites = await flatCells(f0.pos);
const far = (a, b) => Math.hypot(a.x - b.x, a.z - b.z) > 16;
console.log('  best sites: ' + sites.slice(0, 6)
  .map((s) => `(${s.x},${s.z}) span ${s.span} near ${s.clutter}/${s.props} d ${s.d.toFixed(0)}`).join(' · '));
const SQ = sites[0];
const DECK = sites.find((s) => far(s, SQ));
const RAMP = sites.find((s) => far(s, SQ) && DECK && far(s, DECK));
if (!DECK || !RAMP) { console.log('no three clear sites 16 m apart on this island'); process.exit(1); }
console.log(`sites — square ${SQ.x},${SQ.z} · deck ${DECK.x},${DECK.z} · ramp ${RAMP.x},${RAMP.z}`);

await walkTo(SQ.x, SQ.z);
await press('Digit1');
const armed = await facts();
ok(armed.handOut && armed.slot === 0, 'the hand comes out on 1, holding a wall');

// =========================================================================
// 1. THE 90 DEGREE TURN, SIXTEEN TIMES, BOTH WAYS
// =========================================================================
console.log('\n== the 90 degree turn: sixteen by the body, eight by the key');
const bodyTurns = [];
for (let i = 0; i < 16; i++) {
  const b = await facts();
  const r = await turnBody(Math.PI / 2);
  const a2 = await facts();
  bodyTurns.push({ ...r, moved: `${a2.ghost.x},${a2.ghost.z}` !== `${b.ghost.x},${b.ghost.z}`,
    perp: a2.ghost.turn !== b.ghost.turn });
}
const badBody = bodyTurns.filter((t) => Math.abs(wrap(t.got - Math.PI / 2)) > 0.10);
const noMove = bodyTurns.filter((t) => !t.moved || !t.perp);
const carded = bodyTurns.filter((t) => t.retried);
console.log('  ' + bodyTurns.map((t) => t.got.toFixed(3) + (t.retried ? '*' : '')).join(' '));
if (carded.length) {
  console.log(`  * ${carded.length} turn(s) needed a card dismissed first `
    + `(interface up: ${carded.filter((t) => t.blocked).length} of ${carded.length})`);
}
ok(badBody.length === 0, '16 of 16 body turns land within 0.10 rad of a right angle',
  `${16 - badBody.length}/16 · worst ${Math.max(...bodyTurns.map((t) => Math.abs(wrap(t.got - Math.PI / 2)))).toFixed(4)} rad`);
ok(noMove.length === 0, 'and every one of them moves the slot to the perpendicular face',
  `${16 - noMove.length}/16`);
ok(carded.every((t) => t.blocked),
  'a turn only ever misses because a card was up, which a player dismisses',
  `${carded.length} retried, ${carded.filter((t) => t.blocked).length} with the interface up`);

const keyTurns = [];
for (let i = 0; i < 8; i++) {
  const b = await facts();
  await press('KeyF', 300);
  const a2 = await facts();
  keyTurns.push({ moved: `${a2.ghost.x},${a2.ghost.z}` !== `${b.ghost.x},${b.ghost.z}`,
    perp: a2.ghost.turn !== b.ghost.turn, quarter: (a2.turn - b.turn + 4) % 4 === 1 });
}
ok(keyTurns.every((t) => t.moved && t.perp && t.quarter),
  '8 of 8 taps of the rotate key give the next face of the same cell',
  `${keyTurns.filter((t) => t.moved && t.perp && t.quarter).length}/8`);

// =========================================================================
// 2. FOUR WALLS, A CLOSED SQUARE, TIMED
// =========================================================================
console.log('\n== four walls, a closed square, timed on the game\'s own clock');
// ONE UNBROKEN GESTURE, AND NOTHING IN THE MIDDLE OF IT.
//
// This is the measurement, so nothing between the button going down and the
// button coming up is allowed to be the harness: no screenshot, no read, no
// question asked of node. The waits are a person's — a flick of the wrist
// between quarter turns. What is timed is `piece.tms`, the `performance.now()`
// the piece became real on, taken out of the running game afterwards. A
// stopwatch held against a software rasteriser measures the rasteriser.
await clearUI();
const gp = (await worldPoint()) || CANDIDATES[0];
await page.mouse.move(gp[0], gp[1]);
await page.evaluate(() => {
  window.__down = [];
  addEventListener('mousedown', () => window.__down.push(performance.now()), true);
});
const wallT0 = Date.now();
await page.mouse.down();
for (let i = 0; i < 3; i++) {
  await page.waitForTimeout(130);        // a human quarter-turn flick
  await page.keyboard.press('KeyF');
}
await page.waitForTimeout(320);
await page.mouse.up();
const wallWall = Date.now() - wallT0;
await page.waitForTimeout(500);
const fSq = await facts();
const walls = fSq.pieces.filter((p) => p.kind === 'wall');
const sq = squareOf(walls);
const gameMs = walls.length === 4 ? walls[3].tms - walls[0].tms : NaN;
const downAt = await page.evaluate(() => window.__down.slice());
const react = walls.length && downAt.length ? walls[0].tms - downAt[0] : NaN;
console.log(`  walls: ${walls.map((w) => `(${w.x},${w.z})@${w.base}`).join(' ')}`);
console.log(`  TIME: ${Math.round(gameMs)} ms in the game's own clock, first wall to fourth`
  + ` — ONE mouse press and three taps of F, at ${fSq.fps} fps`);
console.log(`  button down -> first wall real: ${Math.round(react)} ms`
  + ` · whole gesture in harness wall-clock: ${(wallWall / 1000).toFixed(2)} s`);
ok(walls.length === 4, 'ONE held press and three flicks of F set four walls',
  `${walls.length} walls`);
ok(sq.closed, 'FOUR WALLS BY HAND MAKE A CLOSED SQUARE', sq.why);
ok(gameMs < 2500, 'four walls take SECONDS, not minutes', `${Math.round(gameMs)} ms`);
ok(react >= 0 && react < 60, 'a piece is real on the frame the button goes down',
  `${Math.round(react)} ms`);
ok(Math.abs(fSq.pos.y - armed.pos.y) < 0.9, 'and it never lifts him onto his own wall',
  `y ${armed.pos.y} -> ${fSq.pos.y}`);
ok(!fSq.why.match(/shut you in|encerrad|zamurow/i), 'nothing is refused for being a room',
  `chip "${fSq.why}"`);
ok(walls.filter((w) => w.door).length === 1, 'the wall that closes the room carries a doorway',
  `${walls.filter((w) => w.door).length} door(s)`);
ok(!fSq.boxed, 'and he is therefore not shut in');

// =========================================================================
// 3. A SECOND CLICK AT A WALL THAT IS ALREADY THERE
// =========================================================================
console.log('\n== a click at a wall that is already there');
const beforeSpam = (await facts()).pieces.length;
const chips = [];
for (let i = 0; i < 5; i++) { await click(); chips.push((await facts()).why); }
const afterSpam = await facts();
const levels = [...new Set(afterSpam.pieces.filter((p) => p.kind === 'wall').map((p) => p.base))];
ok(afterSpam.pieces.length === beforeSpam, 'five more clicks at the same face build NOTHING',
  `${beforeSpam} -> ${afterSpam.pieces.length} pieces`);
ok(levels.length === 1, 'no chimney: every wall is still on one level', JSON.stringify(levels));
ok(chips.some((c) => c.length > 0), 'and the game says why, in words', `"${chips.find((c) => c) || ''}"`);
// …but a second storey is still ONE gesture: look up at the head of the wall.
const upPitch = await tiltBody(0.62);
const beforeUpper = (await facts()).pieces.length;
await click();
const upper = await facts();
const upperWalls = upper.pieces.filter((p) => p.kind === 'wall');
const storeys = [...new Set(upperWalls.map((p) => p.base))].sort((a2, b2) => a2 - b2);
ok(upper.pieces.length === beforeUpper + 1,
  'but LOOK UP at the head of the wall and one click sets the second storey',
  `pitch ${upPitch.toFixed(2)} rad · ${beforeUpper} -> ${upper.pieces.length} pieces`);
ok(storeys.length === 2 && Math.abs(storeys[1] - storeys[0] - 4) < 0.01,
  'and it lands exactly one storey up, not a guess', JSON.stringify(storeys));
await tiltBody(-0.62);

// =========================================================================
// 4. THE LENS AND HIS OWN WALLS
// =========================================================================
console.log('\n== the lens, from forty bearings inside and outside his own room');
let buried = 0, samples = 0;
const sample = async (why) => {
  const s = await facts();
  samples++;
  if (s.camInside) { buried++; console.log(`    INSIDE ${why} yaw ${s.yaw} ${JSON.stringify(s.camPos)}`); }
};
for (let i = 0; i < 16; i++) { await turnBody(Math.PI / 8); await sample('orbit inside'); }
for (const k of ['KeyW', 'KeyD', 'KeyS', 'KeyA']) {
  await walk(k, 700); await sample(`hugging after ${k}`);
  for (let i = 0; i < 4; i++) { await turnBody(Math.PI / 2); await sample(`hugging turn after ${k}`); }
  await walk(k === 'KeyW' ? 'KeyS' : k === 'KeyS' ? 'KeyW' : k === 'KeyA' ? 'KeyD' : 'KeyA', 700);
}
// OUT OF THE DOOR. The doorway is 1.6 m wide in one face of a 4 m room, so
// "press W and see" is a coin toss on whichever way the body happens to be
// pointing. A player walks at the hole he can see. So this aims at the door's
// own outward normal and uses the same step-by-step walk the rest of the script
// uses to cross the plaza.
const door = (await facts()).pieces.find((p) => p.door);
let out = false;
if (door) {
  const nx = Math.sign(door.x - SQ.x), nz = Math.sign(door.z - SQ.z);
  out = await walkTo(SQ.x + nx * 9, SQ.z + nz * 9, 2.4, 26);
}
const outPos = (await facts()).pos;
ok(out && Math.hypot(outPos.x - SQ.x, outPos.z - SQ.z) > 3.4,
  'he walks out of the room he just closed, through the doorway',
  `${JSON.stringify(outPos)} · ${Math.hypot(outPos.x - SQ.x, outPos.z - SQ.z).toFixed(1)} m from the middle`);
for (let i = 0; i < 8; i++) { await turnBody(Math.PI / 4); await sample('outside'); }
ok(buried === 0, 'THE LENS IS NEVER INSIDE THE CADET\'S OWN STRUCTURE',
  `${buried} of ${samples} samples buried`);

// =========================================================================
// 5. A RAMP MEETING A FLOOR
// =========================================================================
let rmp = null, deckAtHead = null, dk = [], onDeck = [], deckTop = 0;
if (ONLY === 'all') {
console.log('\n== a ramp meeting a floor, by hand');
const gotRamp = await walkOrRecover(RAMP.x, RAMP.z);
ok(gotRamp, 'he walks to clear ground for the ramp', `${RAMP.x}, ${RAMP.z}`);
await press('Digit2', 380);            // ramp
await click();
await page.waitForTimeout(400);
rmp = (await facts()).pieces.find((p) => p.kind === 'ramp');
ok(!!rmp, 'a click sets a ramp', rmp ? `at ${rmp.x},${rmp.z} base ${rmp.base}` : 'none');
// run up it on W alone
const beforeUp = (await facts()).pos.y;
for (let i = 0; i < 5; i++) await walk('KeyW', 380);
const onHead = await facts();
ok(onHead.pos.y > beforeUp + 2.0, 'the cadet runs UP the ramp he set, on W alone',
  `y ${beforeUp.toFixed(2)} -> ${onHead.pos.y.toFixed(2)}`);
await press('Digit3', 380);            // floor at the head
await click();
await page.waitForTimeout(500);
const fRF = await facts();
deckAtHead = fRF.pieces.filter((p) => p.kind === 'floor')
  .find((p) => rmp && Math.abs(p.base - (rmp.base + 4)) < 0.01);
ok(!!deckAtHead, 'a click from the ramp head lays a deck EXACTLY one storey up — the head IS the deck',
  rmp ? `ramp ${rmp.base} + 4 = ${rmp.base + 4}, deck ${deckAtHead ? deckAtHead.base : 'none'}` : '');

// =========================================================================
// 6. A WALL MEETING A FLOOR
// =========================================================================
console.log('\n== a wall meeting a floor, by hand');
// A closed room now stands between him and open ground, so the crossing takes
// more steps than a straight line does: he has to walk round his own building.
const gotDeck = await walkOrRecover(DECK.x, DECK.z);
ok(gotDeck, 'he walks clear of the room to open ground', `${DECK.x}, ${DECK.z}`);
await press('Digit3', 380);            // floor
ok((await facts()).slot === 2, 'the hand takes a floor on 3');
await click();                         // deck 1
await turnBody(Math.PI / 2);
await click();                         // deck 2, alongside
await press('Digit1', 380);            // wall
dk = (await facts()).pieces.filter((p) => p.kind === 'floor');
ok(dk.length >= 2, 'two decks go down side by side', `${dk.length} decks`);
ok(dk.length >= 2 && new Set(dk.map((d) => d.base)).size === 1,
  'and they share exactly one level', JSON.stringify([...new Set(dk.map((d) => d.base))]));
// stand on a deck and raise a wall off its edge
await walkTo(dk[0].x, dk[0].z, 1.4);
await click();
await turnBody(Math.PI / 2);
await click();
const fWF = await facts();
const wfWalls = fWF.pieces.filter((p) => p.kind === 'wall');
deckTop = dk[0].base;
onDeck = wfWalls.filter((w) => Math.abs(w.base - deckTop) < 0.01);
ok(onDeck.length >= 2, 'two walls stand on the deck', `${onDeck.length} of ${wfWalls.length}`);
ok(onDeck.length >= 2, 'and their feet land EXACTLY on the deck surface',
  `deck ${deckTop} · wall bases ${JSON.stringify([...new Set(onDeck.map((w) => w.base))])}`);
}

const fEnd = await facts();
console.log(`\nrenderer ${fEnd.fps} fps · ${fEnd.pieces.length} pieces standing`);

// =========================================================================
// PHOTOGRAPHY. Everything above is committed by a real click. Nothing below
// places, removes or selects anything — it only moves the lens and hides the
// interface, so a joint can be judged instead of guessed at.
// =========================================================================
await page.evaluate(() => {
  const a = window.__ascent, b = a.builder;
  a.player.root.visible = false;
  // Every panel, not just #ui: the touch pad and the stick are appended to the
  // body and sat in the corner of every close-up of the last round. The canvas
  // lives inside a wrapper, so anything that CONTAINS it has to stay — hiding
  // by tag name alone hid the game and photographed a black rectangle.
  const cv = document.querySelector('canvas');
  for (const el of document.body.children) {
    if (el !== cv && !el.contains(cv)) el.style.display = 'none';
  }
  window.__lens = {
    /** A tripod, re-pinned every frame — gravity owns the cadet otherwise. */
    look(fx, fy, fz, tx, ty, tz, fov) {
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
      // THE AMBER "YOU ARE AIMING AT THIS" HIGHLIGHT IS NOT PART OF THE JOINT.
      // It swings a whole panel's inlay from cyan to amber, which in a close-up
      // of a corner reads as two walls built out of different material. It is a
      // selection, and a photograph of a selection is not a photograph of a
      // mitre — so it is cleared here, in the marked section, on structure that
      // is already committed.
      // ORDER MATTERS HERE. `_aim` runs every frame the builder is active and
      // re-marks whatever the crosshair is on, so zeroing the marks and *then*
      // switching the builder off leaves one more frame in which the wall being
      // photographed marks itself again — which is how the last set of corner
      // frames came back with one panel amber and its neighbour cyan, and read
      // as two walls built out of different metal. Off first, then clear.
      b.setActive(false);
      if (b._aimed) { b._aimed.want = 0; b._aimed = null; }
      for (const q of b.solids.all) { q.want = 0; q.sel = 0; }
      if (fov) { a.camera.fov = fov; a.camera.updateProjectionMatrix(); }
    },
    project(x, y, z) {
      const v = new a.THREE.Vector3(x, y, z).project(a.camera);
      return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight };
    },
  };
});
const lens = (...q) => page.evaluate((r) => window.__lens.look(...r), q);
/** A window of real pixels around a world point, at deviceScaleFactor 2. */
const zoom = async (name, pt, size = 420, ms = 900) => {
  await page.waitForTimeout(ms);
  const p = await page.evaluate((q) => window.__lens.project(q[0], q[1], q[2]), pt);
  const half = size / 2;
  await page.screenshot({
    path: path.join(OUT, `${name}.png`),
    clip: { x: Math.max(0, Math.min(W - size, Math.round(p.x - half))),
      y: Math.max(0, Math.min(H - size, Math.round(p.y - half))), width: size, height: size },
  });
  console.log(`  shot ${name}`);
};
const wide = async (name, ms = 900) => {
  await page.waitForTimeout(ms);
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(`  shot ${name}`);
};

console.log('\n== photography: every joint, close up, settled, interface hidden');
// --- the square's four corners
if (sq.corners) {
  for (let i = 0; i < sq.corners.length; i++) {
    const [nx, nz] = sq.corners[i].split(',').map(Number);
    const ox = nx - SQ.x, oz = nz - SQ.z, m = Math.hypot(ox, oz) || 1;
    // outside the corner, level with the middle of the wall, on a short boom
    await lens(nx + (ox / m) * 5.6, sq.base + 2.0, nz + (oz / m) * 5.6, nx, sq.base + 2.0, nz, 30);
    await zoom(`10-corner${i + 1}-mid`, [nx, sq.base + 2.0, nz], 460);
    await lens(nx + (ox / m) * 5.2, sq.base + 3.9, nz + (oz / m) * 5.2, nx, sq.base + 3.7, nz, 30);
    await zoom(`11-corner${i + 1}-head`, [nx, sq.base + 3.8, nz], 460);
    await lens(nx + (ox / m) * 5.2, sq.base + 0.55, nz + (oz / m) * 5.2, nx, sq.base + 0.25, nz, 30);
    await zoom(`12-corner${i + 1}-foot`, [nx, sq.base + 0.2, nz], 460);
  }
  await lens(SQ.x + 11, sq.base + 12, SQ.z - 11, SQ.x, sq.base + 1.6, SQ.z, 45);
  await wide('13-square-from-above');
}
// --- the wall/floor joint
if (onDeck.length && dk.length) {
  const w0 = onDeck[0], d0 = dk[0];
  const ox = w0.x - d0.x, oz = w0.z - d0.z, m = Math.hypot(ox, oz) || 1;
  await lens(w0.x + (ox / m) * 5.4, deckTop + 1.1, w0.z + (oz / m) * 5.4, w0.x, deckTop + 0.25, w0.z, 30);
  await zoom('20-wall-foot-on-deck', [w0.x, deckTop + 0.15, w0.z], 480);
  await lens(d0.x + 8, deckTop + 4.6, d0.z - 8, w0.x, deckTop + 1.2, w0.z, 42);
  await wide('21-wall-on-deck');
}
// --- the deck/deck seam
if (dk.length >= 2) {
  const jx = (dk[0].x + dk[1].x) / 2, jz = (dk[0].z + dk[1].z) / 2;
  await lens(jx + 3.0, deckTop + 1.7, jz + 3.0, jx, deckTop, jz, 30);
  await zoom('22-deck-deck-seam', [jx, deckTop, jz], 480);
}
// --- the ramp/floor joint: the one traversal depends on
if (rmp && deckAtHead) {
  const T = rmp.base + 4;
  const dx = Math.sign(deckAtHead.x - rmp.x), dz = Math.sign(deckAtHead.z - rmp.z);
  const jx = (rmp.x + deckAtHead.x) / 2, jz = (rmp.z + deckAtHead.z) / 2;
  for (const [i, s] of [[1, 1], [2, -1]]) {
    await lens(jx + dz * s * 4.4, T + 1.0, jz + dx * s * 4.4, jx, T - 0.2, jz, 30);
    await zoom(`30-${i}-ramp-meets-floor`, [jx, T - 0.1, jz], 500);
  }
  await lens(jx - dx * 5.0, T + 1.4, jz - dz * 5.0, jx + dx * 2.0, T, jz + dz * 2.0, 34);
  await wide('31-ramp-floor-along');
  await lens(rmp.x - dx * 9, rmp.base + 3.2, rmp.z - dz * 9, jx, T - 0.4, jz, 40);
  await wide('32-ramp-whole');
}

await writeFile(path.join(OUT, 'handproof.json'), JSON.stringify({
  checks, errors, gameMs, wallWall, bodyTurns, keyTurns, square: sq,
  pieces: fEnd.pieces, fps: fEnd.fps,
}, null, 2));

await browser.close();
const bad = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - bad.length}/${checks.length} checks passed · ${errors.length} console errors`);
if (errors.length) console.log(errors.slice(0, 6));
process.exit(bad.length || errors.length ? 1 : 0);
