/**
 * THE HAND-BUILT PROOF.
 *
 * `tools/critic/joints.mjs` proves the *lattice* can close a corner: it drives
 * the aiming code directly, standing the cadet on exact cell centres at exact
 * quarter turns and calling `place()`. Every check in it passed while a judge,
 * playing with a keyboard and a mouse, could not close a single square in three
 * attempts and shut himself inside his own walls twice. A rig that only ever
 * asks the question the way the code likes it asked will never find that.
 *
 * So this script has one rule and it is absolute: **nothing here places a piece,
 * selects a piece, turns a piece or clears a piece except a real DOM key event
 * or a real mouse click.** No `builder.place()`, no `setSlot()`, no `rotate()`,
 * no teleporting, no `__joint` harness. `page.evaluate` is used for two things
 * only — reading facts back to assert on, and, in the final section and clearly
 * marked, moving the lens to photograph a structure that was already committed.
 *
 * What it proves, in order:
 *   1. the hotbar highlight follows the digit keys (the reported state bug);
 *   2. `F` turns the piece, and the preview says which cell and which face;
 *   3. four real clicks close a real square, corner posts and all;
 *   4. the last wall of a box you are standing in warns before it goes down;
 *   5. `Q` cuts you out of a box, and `R` puts you outside one;
 *   6. a wall founded on a deck lands exactly on the deck's surface.
 *
 *   node tools/critic/handbuild.mjs --out shots/handbuild [--url …]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/handbuild'));
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

// ---------------------------------------------------------------- arrival
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch { /* private */ } });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4200);

/** Facts only. Never a verb. */
const facts = () => page.evaluate(() => {
  const a = window.__ascent, b = a.builder;
  const bar = [...document.querySelectorAll('#buildbar .slot[data-slot]')];
  const live = [];
  for (const k of Object.keys(b.lattice.live)) {
    for (const p of b.lattice.live[k]) {
      if (!p.dead) live.push({ kind: k, x: p.x, y: p.y, z: p.z, base: p.base, turn: p.turn });
    }
  }
  const tg = b.target();
  return {
    pos: { x: a.player.pos.x, y: a.player.pos.y, z: a.player.pos.z },
    yaw: a.player.yaw,
    slot: b.slot, turn: b.turn, handOut: b.handOut, charge: Math.round(b.charge),
    barOn: bar.findIndex((s) => s.classList.contains('on')),
    barLabel: bar.find((s) => s.classList.contains('on'))?.querySelector('span')?.textContent || '',
    ghostKind: tg.kind, ghostAt: [tg.x, tg.z], ghostBase: tg.base,
    ghostValid: tg.valid, ghostSeals: !!tg.seals, ghostNodes: tg.nodes.slice(),
    groundHere: a.islandAt(a.player.pos.x, a.player.pos.z),
    groundAtSlot: a.islandAt(tg.x, tg.z),
    gridOn: !!b.ghostView.grid?.visible,
    boxed: !!b.player.boxed,
    outPrompt: !!document.querySelector('.axiom-out.show'),
    reason: b._reason || '',
    whyChip: document.querySelector('.axiom-why.show')?.textContent || '',
    whyRaw: document.querySelector('.axiom-why')?.textContent || '',
    toast: document.querySelector('.toast.show')?.textContent || '',
    posts: b.lattice.nodes.count,
    pieces: live.sort((u, v) => u.kind.localeCompare(v.kind) || u.x - v.x || u.z - v.z),
    owned: b.solids.owned,
  };
});

// A click has to land on the world, not on a panel. Right of the crosshair,
// clear of the hotbar at the foot and the language pills at the top.
/**
 * WHERE TO CLICK.
 *
 * A click only builds if it lands on the world rather than on the interface —
 * `Input.worldPointer` decides that, and pointer lock (which would make every
 * event target the canvas) is refused in a headless browser. The interface here
 * is a stack of full-bleed layers with world-space tags drifting across them, so
 * a fixed pixel is a coin toss: one run in three, the third click of the square
 * landed on a cache label and silently did nothing. A person does not have this
 * problem because they can see the label. So the script looks, the same way, and
 * clicks the first candidate that is honestly empty sky.
 */
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

const probe = () => page.evaluate(() => {
  const a = window.__ascent, b = a.builder;
  return {
    onUI: a.input.pointerOnUI, grace: +(a.input._grace || 0).toFixed(3),
    uiOpen: a.input.uiOpen, panel: !!a.panel?.open, active: b.active,
    sealArm: +(b._sealArm || 0).toFixed(2), charge: Math.round(b.charge),
    toast: document.querySelector('.toast.show')?.textContent || '',
  };
});
/**
 * Click on the world, and *check that the world got it*.
 *
 * `elementFromPoint` is only a first guess: world-space labels drift across the
 * frame between the guess and the press. So the press is verified against the
 * game's own verdict (`input.pointerOnUI`, written in a capture-phase listener)
 * and re-aimed if the interface ate it — which is what a person does when they
 * click a label by mistake and nothing happens.
 */
const click = async () => {
  const first = await worldPoint();
  const order = first ? [first, ...CANDIDATES.filter((p) => p !== first)] : CANDIDATES;
  for (const pt of order) {
    await page.mouse.click(pt[0], pt[1]);
    await page.waitForTimeout(90);
    const onUI = await page.evaluate(() => window.__ascent.input.pointerOnUI);
    if (!onUI) { await page.waitForTimeout(220); return pt; }
    await page.waitForTimeout(300);   // let the interface's grace window lapse
  }
  return null;
};
const press = async (k, ms = 260) => { await page.keyboard.press(k); await page.waitForTimeout(ms); };

/**
 * Press a key until the game shows it landed.
 *
 * Not a way of papering over a missed binding — the number of presses is
 * reported, and one is the only passing answer for the checks that matter. It
 * exists because this runs on a software rasteriser at four or five frames a
 * second, and CDP occasionally drops a synthetic keydown into a frame the
 * renderer is still painting. A dropped keystroke in the harness is not a
 * finding about the game; a keystroke the game *ignores* would show up here as
 * four presses and a failure, which is exactly what we want it to look like.
 */
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
const walk = async (key, ms) => {
  await page.keyboard.down(key);
  await page.waitForTimeout(ms);
  await page.keyboard.up(key);
  await page.waitForTimeout(320);
};

const f0 = await facts();
console.log('spawn', JSON.stringify(f0.pos), 'yaw', f0.yaw.toFixed(3));
await shot('00-arrival');

/**
 * Walk to a spot with the movement keys and nothing else.
 *
 * Pointer lock is refused in a headless browser, so the mouse cannot turn the
 * cadet here — which is exactly why the rotate key had to exist. Yaw is
 * therefore fixed, and each of W/A/S/D maps to one fixed world direction; the
 * script works out which by asking where the cadet is looking, the way a player
 * works it out by looking at the screen.
 */
const KEYS = ['KeyW', 'KeyS', 'KeyA', 'KeyD'];
const dirOf = (yaw) => {
  const fx = Math.sin(yaw), fz = Math.cos(yaw);
  return {                       // matches src/player/controller.js's basis
    KeyW: [fx, fz], KeyS: [-fx, -fz], KeyA: [fz, -fx], KeyD: [-fz, fx],
  };
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

// Stand in the middle of a flat cell. The spawn sits exactly on a cell face —
// where the wall in front of you would land through you — and the plaza rolls,
// so a room built on the first square metre you see is a room on a slope. A
// person picks the flat bit by looking at it; this reads the same heightfield.
const CELL = 4;
const flatCells = await page.evaluate((q) => {
  const a = window.__ascent;
  const c = (v) => Math.floor(v / 4 + 0.5) * 4;
  const cx0 = c(q.x), cz0 = c(q.z);
  const out = [];
  for (let i = -6; i <= 6; i++) {
    for (let j = -6; j <= 6; j++) {
      const x = cx0 + i * 4, z = cz0 + j * 4;
      let lo = Infinity, hi = -Infinity, bad = false;
      for (const [dx, dz] of [[0, 0], [2, 0], [-2, 0], [0, 2], [0, -2], [2, 2], [-2, -2], [2, -2], [-2, 2],
        [6, 0], [-6, 0], [0, 6], [0, -6]]) {
        const h = a.islandAt(x + dx, z + dz);
        if (h === null) { bad = true; break; }
        lo = Math.min(lo, h); hi = Math.max(hi, h);
      }
      // …and clear of the plaza's own fixed furniture, which is what a lens at
      // eye level keeps ending up inside of.
      const clutter = window.__ascent.builder.solids.all
        .some((p) => p.fixed && Math.hypot(p.x - x, p.z - z) < 9);
      if (!bad) {
        out.push({ x, z, span: +(hi - lo).toFixed(3), clutter,
          d: Math.hypot(x - q.x, z - q.z) });
      }
    }
  }
  return out.sort((u, v) => (u.clutter - v.clutter) || (u.span - v.span) || (u.d - v.d))
    .slice(0, 14);
}, f0.pos);
console.log('flattest cells near spawn:', JSON.stringify(flatCells.slice(0, 4)));
const home = flatCells[0];
const homeX = home.x, homeZ = home.z;
const arrived = await walkTo(homeX, homeZ);
const fh = await facts();
console.log(`walked to flat cell (${homeX}, ${homeZ}) span ${home.span}m:`,
  arrived ? 'yes' : 'no', JSON.stringify(fh.pos));
ok(arrived, 'the cadet walks to the build site on W/A/S/D alone',
  `${homeX}, ${homeZ} — ground spans ${home.span} m across the cell`);

// ------------------------------------------------- 1. the hotbar state bug
//
// THE REPORTED BUG, EXACTLY AS REPORTED. "Pressing 1 or 3 changes the ghost and
// never moves the highlight — `.slot on` stayed on Ramp through both presses."
// So the assertion is not "the builder's slot changed": it is that the piece in
// the ghost and the lit tile on the hotbar are the same piece, after every one
// of the four digits, in both directions.
console.log('\n== the hotbar highlight follows the digit keys');
const KIND = ['wall', 'ramp', 'floor', 'beam'];
const LABEL = ['01-press-1-wall', '02-press-2-ramp', '02-press-3-floor', '02-press-4-beam'];
for (const n of [0, 2, 1, 3, 0, 2]) {
  const r = await pressUntil(`Digit${n + 1}`, (f) => f.slot === n);
  const s = r.f;
  ok(s.slot === n && s.barOn === n && s.ghostKind === KIND[n] && r.presses === 1,
    `press ${n + 1} — ghost AND highlight both land on ${KIND[n]}`,
    `slot ${s.slot}, lit tile ${s.barOn} (${s.barLabel}), ghost ${s.ghostKind}, ${r.presses} press(es)`);
  await shot(LABEL[n]);
}

// -------------------------------------------------------- 2. aim: the grid
await pressUntil('Digit1', (f) => f.slot === 0);
const g0 = await facts();
ok(g0.gridOn, 'the lattice grid is up under the preview');
ok(Math.abs(g0.ghostNodes[0] - g0.ghostNodes[2]) > 3.9 || Math.abs(g0.ghostNodes[1] - g0.ghostNodes[3]) > 3.9,
  'the preview names the two corner nodes this wall will end on',
  `(${g0.ghostNodes[0]}, ${g0.ghostNodes[1]}) → (${g0.ghostNodes[2]}, ${g0.ghostNodes[3]})`);
await shot('03-grid-and-face');

// ------------------------------------------------------- 3. F turns the piece
console.log('\n== F turns the piece a quarter turn, without turning the player');
const seen = [];
let turnPresses = 0;
for (let i = 0; i < 4; i++) {
  const f = await facts();
  seen.push({ turn: f.turn, at: f.ghostAt.join(','), yaw: +f.yaw.toFixed(4) });
  await shot(`04-turn-${i}`);
  const want = (f.turn + 1) % 4;
  const r = await pressUntil('KeyF', (q) => q.turn === want);
  turnPresses = Math.max(turnPresses, r.presses);
}
const faces = new Set(seen.map((s) => s.at));
ok(faces.size === 4, 'four presses of F offer four different faces',
  seen.map((s) => `t${s.turn}:${s.at}`).join(' | '));
ok(new Set(seen.map((s) => s.yaw)).size === 1,
  'and the cadet never turned — the piece did', `yaw stayed ${seen[0].yaw}`);

// ------------------------------------------- 4. four clicks close a square
console.log('\n== four real mouse clicks close a real square');
const built = [];
for (let i = 0; i < 3; i++) {
  const b4 = await facts();
  await click();
  const f = await facts();
  const pr = await probe();
  built.push({ placed: f.owned - b4.owned, at: f.pieces.map((p) => `${p.x},${p.z}`) });
  ok(f.owned === b4.owned + 1, `click ${i + 1} sets a wall`,
    `turn ${b4.turn} aimed ${b4.ghostAt} base ${b4.ghostBase} valid ${b4.ghostValid} `
    + `seals ${b4.ghostSeals} | feet y ${b4.pos.y.toFixed(4)} ground ${b4.groundHere} `
    + `slotGround ${b4.groundAtSlot} → owned ${f.owned} charge ${pr.charge}`);
  await shot(`05-wall-${i + 1}`);
  const want = (f.turn + 1) % 4;
  const r = await pressUntil('KeyF', (q) => q.turn === want);
  console.log(`     F: turn ${f.turn} -> ${r.f.turn} (${r.presses} press)`);
}

// The fourth is the one that shuts him in. It must say so and refuse once.
const beforeLast = await facts();
ok(beforeLast.ghostSeals, 'the preview knows the fourth wall would shut him in',
  `whyChip "${beforeLast.whyChip}"`);
await shot('06-fourth-wall-warned');
await click();
const warned = await facts();
ok(warned.owned === beforeLast.owned,
  'the first click on it is refused, and spends itself saying why',
  `owned ${warned.owned}, chip "${warned.whyRaw}" reason ${warned.reason}`);
await shot('07-fourth-wall-refused');

const arm = await probe();
console.log(`  (confirm window left: ${arm.sealArm}s)`);
await click();
const closed = await facts();
ok(closed.owned === beforeLast.owned + 1, 'a second, deliberate click closes the square',
  `owned ${closed.owned}`);

const walls = closed.pieces.filter((p) => p.kind === 'wall');
const faceSet = [...new Set(walls.map((p) => `${p.x},${p.z}`))].sort();
const bases = [...new Set(walls.map((p) => p.base))];
const cx = walls.length ? walls.reduce((a, p) => a + p.x, 0) / walls.length : NaN;
const cz = walls.length ? walls.reduce((a, p) => a + p.z, 0) / walls.length : NaN;
const wantFaces = [`${cx - 2},${cz}`, `${cx + 2},${cz}`, `${cx},${cz - 2}`, `${cx},${cz + 2}`].sort();
ok(walls.length === 4, 'four walls stand', `${walls.length}`);
ok(faceSet.join(' | ') === wantFaces.join(' | '),
  'on the four faces of ONE cell', faceSet.join(' | '));
ok(bases.length === 1, 'all four founded on exactly one level', JSON.stringify(bases));
ok(closed.posts === 4, 'a corner post stands at each of the four nodes', `${closed.posts}`);
await shot('08-square-closed');

// --------------------------------------------- 5. and he is not trapped in it
console.log('\n== and he is not trapped inside it');
ok(closed.boxed && closed.outPrompt,
  'the way out is on screen the moment the lattice closes',
  `boxed ${closed.boxed}, prompt ${closed.outPrompt}`);
await shot('09-boxed-prompt');

// Q cuts a hole from inside, whether or not the crosshair is on anything.
const beforeCut = (await facts()).owned;
const cutR = await pressUntil('KeyQ', (f) => f.owned === beforeCut - 1);
await page.waitForTimeout(420);          // let the box state settle a frame
const cut = await facts();
void cutR;
ok(cut.pieces.filter((p) => p.kind === 'wall').length === 3 && !cut.boxed,
  'Q cuts a way out of the box, and the warning goes with it',
  `${cut.pieces.filter((p) => p.kind === 'wall').length} walls left, boxed ${cut.boxed}`);
await shot('10-cut-out');

// Put the fourth wall back — F until the preview is on the empty face again.
let refound = false;
for (let i = 0; i < 5 && !refound; i++) {
  const f = await facts();
  const here = `${f.ghostAt[0]},${f.ghostAt[1]}`;
  if (f.ghostValid && !f.pieces.some((p) => `${p.x},${p.z}` === here)) { refound = true; break; }
  const want = (f.turn + 1) % 4;
  await pressUntil('KeyF', (q) => q.turn === want);
}
ok(refound, 'F finds the open face again — the gap you can see is the gap you can aim at');
await click();          // warned
await click();          // meant it
const reclosed = await facts();
ok(reclosed.pieces.filter((p) => p.kind === 'wall').length === 4 && reclosed.boxed,
  'the square closes again by hand',
  `${reclosed.pieces.filter((p) => p.kind === 'wall').length} walls, boxed ${reclosed.boxed}`);

// R must put him OUTSIDE, not back in the middle of the same room.
const inCell = { x: cx, z: cz };
const recR = await pressUntil('KeyR',
  (f) => Math.hypot(f.pos.x - cx, f.pos.z - cz) > 2.4);
const rec = recR.f;
const outByR = Math.hypot(rec.pos.x - inCell.x, rec.pos.z - inCell.z) > 2.4;
ok(outByR, 'R (recover) puts him outside his own walls, not back in the middle',
  `${Math.hypot(rec.pos.x - inCell.x, rec.pos.z - inCell.z).toFixed(2)}m from the room centre`);
ok(rec.pieces.filter((p) => p.kind === 'wall').length === 4,
  'and the square he built is still standing, all four walls',
  `${rec.pieces.filter((p) => p.kind === 'wall').length}`);
await shot('10b-recovered-outside');

// ------------------------------------------ 6. a wall founded on a deck
console.log('\n== a wall founded on a deck lands on the deck');
// Walk to another flat cell clear of the square, lay a deck, stand on it, wall
// its edge.
const site = flatCells.find((c) => !c.clutter
  && Math.hypot(c.x - homeX, c.z - homeZ) > 11
  && Math.hypot(c.x - homeX, c.z - homeZ) < 26)
  || flatCells.find((c) => Math.hypot(c.x - homeX, c.z - homeZ) > 9)
  || flatCells[1];
console.log(`deck site (${site.x}, ${site.z}) span ${site.span}m`);
await walkTo(site.x, site.z, 1.0, 40);
await pressUntil('Digit3', (f) => f.slot === 2);
const preDeck = await facts();
console.log(`  at ${JSON.stringify(preDeck.pos)} aiming ${preDeck.ghostAt}`);
await click();
const deckF = await facts();
const deck = deckF.pieces.find((p) => p.kind === 'floor');
ok(!!deck && deckF.owned === preDeck.owned + 1, 'a click lays a deck',
  deck ? `floor at ${deck.x},${deck.z} base ${deck.base}` : 'none');

let wallOnDeckOK = false;
if (deck) {
  // step up onto it — a deck is 37 cm of lip, well inside the step height
  await walkTo(deck.x, deck.z, 0.9, 22);
  let onDeck = await facts();
  if (Math.abs(onDeck.pos.y - deck.base) > 0.3) {
    // a 37 cm lip is inside the step height, but a cadet who arrived against
    // the edge rather than over it gets the thing every player does: a jump
    await press('Space', 260);
    await walkTo(deck.x, deck.z, 0.6, 8);
    onDeck = await facts();
  }
  await pressUntil('Digit1', (f) => f.slot === 0);
  ok(Math.abs(onDeck.pos.y - deck.base) < 0.35, 'the cadet walks up onto the deck he laid',
    `stood at y ${onDeck.pos.y.toFixed(3)}, deck top ${deck.base}, `
    + `${Math.hypot(onDeck.pos.x - deck.x, onDeck.pos.z - deck.z).toFixed(2)}m from its centre`);
  await shot('11-standing-on-deck');
  await click();
  const wf = await facts();
  const newWalls = wf.pieces.filter((p) => p.kind === 'wall' && Math.abs(p.base - deck.base) < 1e-9);
  wallOnDeckOK = newWalls.length > 0;
  ok(wallOnDeckOK, 'a wall set from the deck is founded EXACTLY on the deck surface',
    `deck top ${deck.base}, wall bases ${JSON.stringify(
      wf.pieces.filter((p) => p.kind === 'wall').map((p) => p.base))}`);
  await shot('12-wall-on-deck');
}

const after = await facts();
await writeFile(path.join(OUT, 'handbuild.json'),
  JSON.stringify({ checks, facts: after, errors }, null, 2));

// -------------------------------------------------------------------------
// PHOTOGRAPHY. Everything above is committed. Nothing below places, removes or
// selects anything — it moves the lens, exactly as tools/critic/joints.mjs does
// for its close-ups, so that a joint a few centimetres wide can be judged.
// -------------------------------------------------------------------------
await page.evaluate(() => {
  const a = window.__ascent, b = a.builder;
  a.player.root.visible = false;
  window.__lens = {
    look(fx, fy, fz, tx, ty, tz) {
      a.player.pos.set(fx, fy, fz);
      a.player.vel.set(0, 0, 0);
      a.player.yaw = Math.atan2(tx - fx, tz - fz);
      a.player.pitch = Math.atan2(ty - fy, Math.hypot(tx - fx, tz - fz));
      b._armT = 0; b._held = false; b.ghostView.visible = false;
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
const zoom = async (name, pt, size = 460, ms = 460) => {
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

const L = bases[0];
// The lens is a tripod, not a hand: `look` puts the cadet somewhere and points
// him, and the camera boom does the rest — so to photograph a corner from
// outside it, stand on the corner's own outward diagonal a few metres back.
const diag = async (sx, sz, name, zname) => {
  const nx = cx + sx * 2, nz = cz + sz * 2;         // the lattice node itself
  await lens(nx + sx * 2.6, L + 1.5, nz + sz * 2.6, nx, L + 2.0, nz);
  await shot(name, 520);
  await zoom(`${zname}-head`, [nx, L + 3.85, nz], 480);
  await zoom(`${zname}-mid`, [nx, L + 2.0, nz], 480);
  await lens(nx + sx * 2.2, L + 0.55, nz + sz * 2.2, nx, L + 0.2, nz);
  await shot(`${name}-foot`, 520);
  await zoom(`${zname}-foot`, [nx, L + 0.12, nz], 520);
};

// the room from above, so the square reads as a square
await lens(cx + 8, L + 11.0, cz - 8, cx, L + 1.6, cz);
await shot('20-square-from-above', 560);
// each of two opposite corners, from outside, along its own diagonal
await diag(1, 1, '21-corner-NE', '21z-NE');
await diag(-1, -1, '23-corner-SW', '23z-SW');

const deckShot = after.pieces.find((p) => p.kind === 'floor');
// The wall standing on THIS deck: on one of the deck cell's own four faces, at
// the deck's own level. Matching on level alone picks the first wall of the
// square, which is a fine corner and the wrong photograph.
const onFace = deckShot ? [[2, 0], [-2, 0], [0, 2], [0, -2]]
  .map(([ox, oz]) => `${deckShot.x + ox},${deckShot.z + oz}`) : [];
const wallOnDeck = deckShot && after.pieces.find((p) => p.kind === 'wall'
  && Math.abs(p.base - deckShot.base) < 1e-9 && onFace.includes(`${p.x},${p.z}`));
if (deckShot && wallOnDeck) {
  const D = deckShot.base;
  // Two opposite high diagonals. The plaza is full of pillars and raised kerbs
  // and a lens at head height regularly ends up inside one; a steep look-down
  // clears all of it, and shooting the joint from both sides means no single
  // obstruction can hide a gap.
  for (const [i, sgn] of [[1, 1], [2, -1]]) {
    await lens(wallOnDeck.x + sgn * 4.6, D + 4.4, wallOnDeck.z + sgn * 4.6,
      wallOnDeck.x, D + 0.5, wallOnDeck.z);
    await shot(`24-${i}-wall-on-deck`, 560);
    await zoom(`24z-${i}-wall-foot-on-deck`, [wallOnDeck.x, D + 0.06, wallOnDeck.z], 520);
    await zoom(`24z-${i}-wall-deck-seam`,
      [wallOnDeck.x + (wallOnDeck.x === deckShot.x ? 1.4 : 0),
        D + 0.06,
        wallOnDeck.z + (wallOnDeck.z === deckShot.z ? 1.4 : 0)], 520);
  }
  // THE SEAM ITSELF, from over the deck. Every eye-level angle onto this joint
  // is at the mercy of whatever the plaza has parked in front of it; straight
  // down the deck's own surface is the one line of sight nothing can block, and
  // it is the line that shows whether the wall's foot and the deck's top are
  // one plane or two.
  const px = (deckShot.x + wallOnDeck.x) / 2, pz = (deckShot.z + wallOnDeck.z) / 2;
  await lens(deckShot.x, D + 7.5, deckShot.z, px, D, pz);
  await shot('26-deck-from-over', 560);
  await zoom('26z-wall-meets-deck', [px, D, pz], 560);
  await lens(deckShot.x + (deckShot.x - wallOnDeck.x) * 0.7, D + 3.2,
    deckShot.z + (deckShot.z - wallOnDeck.z) * 0.7, px, D + 0.15, pz);
  await shot('27-deck-along', 560);
  await zoom('27z-wall-foot-seam', [px, D + 0.04, pz], 560);
}

console.log(`\nconsole errors: ${errors.length}${errors.length ? ' — ' + errors.slice(0, 3).join(' | ') : ''}`);
const bad = checks.filter((c) => !c.pass);
console.log(bad.length ? `\nFAILING: ${bad.length}` : '\nevery hand-built check passes');
await browser.close();
process.exit(bad.length || errors.length ? 1 : 0);
