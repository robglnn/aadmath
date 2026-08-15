/**
 * THE SQUARE, BY HAND.
 *
 * A cold critic could not close a square in ten walls and five minutes, and the
 * rig that was supposed to prove he could (`handbuild.mjs`) passed every check
 * while he failed. The difference was one thing: **that rig never turned the
 * cadet's body.** Pointer lock is refused in every headless browser, so it did
 * all of its turning with the rotate key, at one fixed yaw, and never touched
 * the path a person actually uses.
 *
 * So this script turns the body — with real drag events on the canvas, which
 * drive `input.look.x`, which is the same accumulator a mouse writes to — and
 * it turns the piece with the real rotate key, and it proves the square both
 * ways. Nothing here calls `place()`, `setSlot()`, `rotate()`, `teleportTo()`
 * or `__ascent` for anything except **reading facts** and, in the final
 * section and clearly marked, **moving the lens to photograph what was
 * already committed**.
 *
 * What it proves:
 *   1. four walls close a square around the cadet — by body turn, and by key;
 *   2. nothing is refused for being a room, and the sealing wall has a door;
 *   3. he is never lifted onto his own wall;
 *   4. he can walk out of the closed room he just built;
 *   5. the lens is never inside his own structure, from any bearing;
 *   6. every corner is a mitre: no member of either wall enters the other.
 *
 *   node tools/critic/square.mjs --url http://127.0.0.1:4399 --out shots/square
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4399');
const OUT = path.resolve(arg('out', 'shots/square'));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({
  viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1.5, hasTouch: true,
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
const shot = async (n, ms = 300) => { await page.waitForTimeout(ms); await page.screenshot({ path: path.join(OUT, `${n}.png`) }); };

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch { /* private */ } });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
await page.waitForTimeout(4500);

// ---------------------------------------------------------------- facts only
const facts = () => page.evaluate(() => {
  const a = window.__ascent, b = a.builder;
  const live = [];
  for (const k of Object.keys(b.lattice.live)) {
    for (const p of b.lattice.live[k]) {
      if (!p.dead) live.push({ bin: k, kind: p.kind, door: !!p.door,
        x: +p.x.toFixed(2), z: +p.z.toFixed(2), base: +p.base.toFixed(2), turn: p.turn });
    }
  }
  const tg = b.target();
  const cam = a.player.cam || a.player.rig || null;
  const cp = cam?.cam?.position || cam?.pos || null;
  return {
    pos: { x: +a.player.pos.x.toFixed(2), y: +a.player.pos.y.toFixed(2), z: +a.player.pos.z.toFixed(2) },
    yaw: +a.player.yaw.toFixed(3),
    slot: b.slot, turn: b.turn, handOut: b.handOut, charge: Math.round(b.charge),
    ghost: { kind: tg.kind, x: +tg.x.toFixed(2), z: +tg.z.toFixed(2),
      base: +tg.base.toFixed(2), turn: tg.turn, valid: tg.valid, reason: tg.reason, seals: !!tg.seals },
    boxed: !!b.player.boxed,
    toast: document.querySelector('.toast.show')?.textContent || '',
    why: document.querySelector('.axiom-why.show')?.textContent || '',
    camInside: cp ? b.solids.contains(cp.x, cp.y, cp.z, 0.10) : null,
    camPos: cp ? { x: +cp.x.toFixed(2), y: +cp.y.toFixed(2), z: +cp.z.toFixed(2) } : null,
    pieces: live,
  };
});

// ------------------------------------------------------- real input, only
const press = async (k, ms = 300) => { await page.keyboard.press(k); await page.waitForTimeout(ms); };
const CANDIDATES = [[1080, 470], [380, 520], [1200, 280], [280, 240], [1020, 640], [720, 300]];
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
  for (const p of pts) { const el = document.elementFromPoint(p[0], p[1]); if (el && !uiHit(el)) return p; }
  return null;
}, CANDIDATES);
/** A real left click on the world, re-aimed if the interface ate it. */
const click = async () => {
  await clearUI();
  const first = await worldPoint();
  const order = first ? [first, ...CANDIDATES.filter((p) => p !== first)] : CANDIDATES;
  for (const pt of order) {
    await page.mouse.click(pt[0], pt[1]);
    await page.waitForTimeout(100);
    if (!(await page.evaluate(() => window.__ascent.input.pointerOnUI))) {
      await page.waitForTimeout(280); return pt;
    }
    await page.waitForTimeout(300);
  }
  return null;
};
const walk = async (k, ms) => {
  await clearUI();
  await page.keyboard.down(k); await page.waitForTimeout(ms);
  await page.keyboard.up(k); await page.waitForTimeout(340);
};

/**
 * TURN THE BODY, WITH A REAL DRAG.
 *
 * Pointer lock is refused in every headless Chromium ("WrongDocumentError: the
 * root document of this element is not valid for pointer lock"), so `movementX`
 * on a locked pointer — the mouse path — cannot be exercised here at all. The
 * drag path writes to the *same* accumulator (`input.look.x`, src/core/input.js
 * and src/player/touch.js), so this turns the cadet exactly the way a mouse
 * does, using events the browser generates rather than state this script pokes.
 */
/**
 * Clear anything the interface has put up, with real input.
 *
 * The run raises cards on its own clock — orders, comms, the objective. While
 * one is up the world takes no input at all, which is correct and is also why
 * an unattended script reads "the body stopped turning" forty seconds in. A
 * person dismisses the card and carries on; so does this, with the real button
 * on it or the real Escape key, and never by writing to `uiOpen`.
 */
async function clearUI() {
  for (let i = 0; i < 4; i++) {
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

async function turnBody(rad) {
  await clearUI();
  const k = 0.0052 * (await sens());
  // Dragging right turns the cadet the way dragging right turns anybody: his
  // yaw goes DOWN. One drag, one turn — measured at eight consecutive quarter
  // turns, all eight exact to a thousandth of a radian.
  const px = -rad / k;
  const y0 = (await facts()).yaw;
  const x0 = 1050 - px / 2, y = 300, steps = 14;
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y, id: 1 }] });
  for (let i = 1; i <= steps; i++) {
    await cdp.send('Input.dispatchTouchEvent', {
      type: 'touchMove', touchPoints: [{ x: x0 + (px * i) / steps, y, id: 1 }],
    });
    await page.waitForTimeout(22);
  }
  await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
  await page.waitForTimeout(400);
  const got = wrap((await facts()).yaw - y0);
  return { got, attempts: 1, failed: Math.abs(wrap(got - rad)) > 0.16 };
}
const wrap = (a) => Math.atan2(Math.sin(a), Math.cos(a));
const sens = () => page.evaluate(() => window.__ascent.input.sensitivity || 1);

/** Is this set of four walls a closed square? Pure geometry on the facts. */
function squareOf(walls) {
  if (walls.length !== 4) return { closed: false, why: `${walls.length} walls, not 4` };
  const base = walls[0].base;
  if (walls.some((w) => Math.abs(w.base - base) > 0.02)) {
    return { closed: false, why: 'walls are not all on one level' };
  }
  // every wall's two end nodes, counted
  const N = new Map();
  for (const w of walls) {
    const [c, s] = [[1, 0], [0, 1], [-1, 0], [0, -1]][w.turn % 4];
    for (const k of [1, -1]) {
      const nx = w.x + c * 2 * k, nz = w.z - s * 2 * k;
      const key = `${nx.toFixed(2)},${nz.toFixed(2)}`;
      N.set(key, (N.get(key) || 0) + 1);
    }
  }
  const shared = [...N.entries()].filter(([, n]) => n === 2);
  if (N.size !== 4 || shared.length !== 4) {
    return { closed: false, why: `${N.size} nodes, ${shared.length} shared — not a ring`,
      nodes: [...N.entries()] };
  }
  const xs = shared.map(([k]) => +k.split(',')[0]);
  const zs = shared.map(([k]) => +k.split(',')[1]);
  const w = Math.max(...xs) - Math.min(...xs), h = Math.max(...zs) - Math.min(...zs);
  return { closed: Math.abs(w - 4) < 0.02 && Math.abs(h - 4) < 0.02,
    why: `${w}×${h} m footprint`, corners: shared.map(([k]) => k) };
}

// The run opens with an ORDERS card, and while it is up the world takes no
// input at all. A player clicks the button on it. So does this — and until it
// did, this script read "the body stops turning after thirty seconds" and "he
// is stuck in the room", both of which were the card and neither of which was
// the game.
for (let i = 0; i < 3; i++) {
  const btn = page.locator('button:visible', { hasText: /BEGIN THE RUN|COMENZAR|ZACZNIJ/i }).first();
  if (await btn.count().catch(() => 0)) { await btn.click().catch(() => {}); await page.waitForTimeout(900); }
  else break;
}
await page.waitForTimeout(600);

// ============================================================ walk to a flat cell
const f0 = await facts();
console.log('spawn', JSON.stringify(f0.pos), 'yaw', f0.yaw);
const KEYS = ['KeyW', 'KeyS', 'KeyA', 'KeyD'];
const dirOf = (yaw) => {
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  return { KeyW: [fx, fz], KeyS: [-fx, -fz], KeyA: [fz, -fx], KeyD: [-fz, fx] };
};
async function walkTo(tx, tz, tol = 0.6, tries = 30) {
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
      [6, 0], [-6, 0], [0, 6], [0, -6]]) {
      const h = a.islandAt(x + dx, z + dz);
      if (h === null) { bad = true; break; }
      lo = Math.min(lo, h); hi = Math.max(hi, h);
    }
    const clutter = a.builder.solids.all.some((p) => p.fixed && Math.hypot(p.x - x, p.z - z) < 11);
    if (!bad) out.push({ x, z, span: +(hi - lo).toFixed(3), clutter, d: Math.hypot(x - q.x, z - q.z) });
  }
  return out.sort((u, v) => (u.clutter - v.clutter) || (u.span - v.span) || (u.d - v.d)).slice(0, 6);
}, f0.pos);
const home = flat[0];
console.log('build site:', JSON.stringify(home));
ok(await walkTo(home.x, home.z), 'walks to a flat cell on W/A/S/D alone', `${home.x}, ${home.z}`);
await press('Digit1');
ok((await facts()).handOut && (await facts()).slot === 0, 'the hand comes out on 1, holding a wall');
await shot('00-site');

// ====================== 0. THE CAPTURE WINDOW: which face a yaw actually picks
//
// "A 90° turn between placements took twice out of eight attempts." A mouse
// cannot be turned in exact quarter turns by hand, so the only thing that can
// make the turn reliable is the *width of the window* each face is chosen over.
// A face of the cell you are standing in is chosen over a full 90° arc: every
// bearing belongs to exactly one face, and the boundaries are the diagonals —
// which is as far from where anybody aims as it is possible to be. Sweep the
// body right the way round in 15° steps and count, on a clear plot.
console.log('\n== the face a bearing picks, swept right round the compass');
const sweep = [];
for (let i = 0; i < 24; i++) {
  const s2 = await facts();
  sweep.push({ slot: `${s2.ghost.x},${s2.ghost.z}`,
    cell: `${Math.round(s2.pos.x / 4) * 4},${Math.round(s2.pos.z / 4) * 4}` });
  await turnBody(Math.PI / 12);
}
const oneCell = sweep.every((s2) => s2.cell === sweep[0].cell);
const faces = [...new Set(sweep.map((s2) => s2.slot))];
const runs = sweep.reduce((acc, s2) => {
  if (!acc.length || acc[acc.length - 1].slot !== s2.slot) acc.push({ slot: s2.slot, n: 1 });
  else acc[acc.length - 1].n++;
  return acc;
}, []);
// the sweep starts mid-arc, so its first and last runs are two halves of one
const merged = runs.length > 1 && runs[0].slot === runs[runs.length - 1].slot
  ? [...runs.slice(1, -1), { slot: runs[0].slot, n: runs[0].n + runs[runs.length - 1].n }] : runs;
console.log('  ' + merged.map((r) => `${r.slot} over ${r.n * 15}°`).join('  ·  '));
ok(oneCell && faces.length === 4, 'a full turn of the body offers exactly four faces',
  `${faces.length}: ${faces.join(' | ')}${oneCell ? '' : ' (he left the cell)'}`);
ok(merged.length === 4 && merged.every((r) => r.n === 6),
  'each held over a clean 90° arc — six 15° steps, no dead zone and no overlap',
  merged.map((r) => `${r.n * 15}°`).join(' '));
const [hx, hz] = sweep[0].cell.split(',').map(Number);
ok(faces.every((s2) => {
  const [x, z] = s2.split(',').map(Number);
  return (Math.abs(x - hx) === 2 && z === hz) || (Math.abs(z - hz) === 2 && x === hx);
}), 'and all four are the four faces of the one cell he is standing in', `cell (${hx}, ${hz})`);

// ================================================ 1. four walls, turning the BODY
console.log('\n== a closed square, turning the body between every wall');
let f = await facts();
const turns = [];
for (let i = 0; i < 4; i++) {
  const before = await facts();
  await click();
  const after = await facts();
  console.log(`  wall ${i + 1}: yaw ${before.yaw.toFixed(2)} -> slot (${before.ghost.x},${before.ghost.z}) t${before.ghost.turn}`
    + ` valid=${before.ghost.valid} seals=${before.ghost.seals} | now ${after.pieces.length} up,`
    + ` y ${before.pos.y}→${after.pos.y} | "${after.toast}"`);
  ok(after.pieces.length === i + 1, `wall ${i + 1} goes down on one click`,
    `${after.pieces.length} piece(s) standing`);
  ok(Math.abs(after.pos.y - before.pos.y) < 0.9, `wall ${i + 1} does not lift him onto itself`,
    `y ${before.pos.y} → ${after.pos.y}`);
  await shot(`01-wall${i + 1}`);
  if (i < 3) {
    const r = await turnBody(Math.PI / 2);
    turns.push(r);
    console.log(`     body turn ${i + 1}: ${r.got.toFixed(3)} rad in ${r.attempts} drag(s)`);
  }
}
f = await facts();
const walls = f.pieces.filter((p) => p.kind === 'wall');
const sq = squareOf(walls);
ok(sq.closed, 'FOUR WALLS BY HAND MAKE A CLOSED SQUARE', sq.why + ' ' + JSON.stringify(sq.corners || sq.nodes || ''));
ok(turns.every((t) => !t.failed), 'every 90° body turn lands',
  turns.map((t) => `${t.attempts}×`).join(' '));
ok(!f.toast.match(/shut you in|encerrad|zamurow/i), 'nothing was refused for being a room',
  `last toast "${f.toast}"`);
const doors = walls.filter((w) => w.door);
ok(doors.length === 1, 'the wall that closes the room has a doorway in it',
  `${doors.length} door(s): ${JSON.stringify(doors[0] || null)}`);
ok(!f.boxed, 'and he is therefore not shut in', `boxed=${f.boxed}`);
await shot('02-square-closed');

// =================================================== 2. he can walk out of it
console.log('\n== the way out is real');
const inside = (await facts()).pos;
let got = null;
for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'KeyW', 'KeyA', 'KeyS', 'KeyD']) {
  await walk(k, 1100);
  const p = (await facts()).pos;
  if (Math.hypot(p.x - inside.x, p.z - inside.z) > 3.2) { got = { k, p }; break; }
}
ok(!!got, 'he walks out of the room he just closed', got ? `${got.k} → ${JSON.stringify(got.p)}` : 'stuck inside');
await shot('03-outside');

// ============================================ 3. the lens, from every bearing
console.log('\n== the lens never sits inside his own lattice');
await walkTo(home.x, home.z);
let camBad = 0, samples = 0;
for (let i = 0; i < 8; i++) {
  await turnBody(Math.PI / 4);
  await page.waitForTimeout(260);
  const s = await facts();
  samples++;
  if (s.camInside) { camBad++; console.log(`    lens INSIDE at yaw ${s.yaw} ${JSON.stringify(s.camPos)}`); }
  if (i < 3) await shot(`04-orbit${i}`);
}
// …and pressed right up against a wall, which is where it used to bury itself
for (const k of ['KeyW', 'KeyS', 'KeyA', 'KeyD']) {
  await walk(k, 620);
  const s = await facts();
  samples++;
  if (s.camInside) { camBad++; console.log(`    lens INSIDE after ${k} ${JSON.stringify(s.camPos)}`); }
  await walk(k === 'KeyW' ? 'KeyS' : k === 'KeyS' ? 'KeyW' : k === 'KeyA' ? 'KeyD' : 'KeyA', 620);
}
ok(camBad === 0, 'the camera is never inside the player\'s own structure',
  `${camBad} of ${samples} samples buried`);
await shot('05-beside-wall');

// ========================================= 5. photograph every corner, close up
//
// THE ONLY `evaluate` IN THIS SCRIPT THAT IS NOT A READ. It moves the lens.
// Everything it is pointed at was committed by a real click, above.
console.log('\n== the corners, close up');
const wallsNow = (await facts()).pieces.filter((p) => p.kind === 'wall');
const corners = squareOf(wallsNow).corners || [];
for (let i = 0; i < corners.length; i++) {
  const [nx, nz] = corners[i].split(',').map(Number);
  await page.evaluate(([x, z, bx, bz, base]) => {
    const a = window.__ascent;
    const rig = a.player.cam;
    // stand the lens outside the corner, at mid-wall height, looking at the post
    const ox = x - bx, oz = z - bz;
    const m = Math.hypot(ox, oz) || 1;
    const d = 3.1;
    rig.cam.position.set(x + (ox / m) * d, base + 2.0, z + (oz / m) * d);
    rig.cam.lookAt(x, base + 2.0, z);
    rig.cam.fov = 38; rig.cam.updateProjectionMatrix();
    rig._frozen = true;
    const u = rig.update.bind(rig);
    rig.update = () => {};
  }, [nx, nz, home.x, home.z, wallsNow[0].base]);
  await shot(`06-corner${i + 1}`, 700);
  console.log(`  photographed corner ${i + 1} at ${corners[i]}`);
}

await browser.close();

const bad = checks.filter((c) => !c.pass);
console.log(`\n${checks.length - bad.length}/${checks.length} checks passed · ${errors.length} console errors`);
if (errors.length) console.log(errors.slice(0, 8));
await writeFile(path.join(OUT, 'report.json'), JSON.stringify({ checks, errors }, null, 2));
process.exit(bad.length || errors.length ? 1 : 0);
