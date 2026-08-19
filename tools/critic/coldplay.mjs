/**
 * The cold-player gate.
 *
 * Everything else in tools/critic measures how the game LOOKS. This measures
 * whether it can be PLAYED by someone who has never seen it, using nothing but
 * the keys and the mouse.
 *
 * It exists because three separate rounds of agents "fixed" the rift interaction
 * while verifying it with `window.__ascent.openRiftById()` — which opens a rift
 * directly and skips the entire act of walking up to one and pressing a key.
 * The path they were fixing was never the path that was broken. A real player
 * reported it, twice, before any instrumented review caught it.
 *
 * So this script is forbidden from touching that API for anything except reading
 * facts back at the end. It presses keys. If it cannot reach and open the first
 * rift with WASD and one interact key, the game is broken, whatever else passes.
 *
 *   node tools/critic/coldplay.mjs [--url http://127.0.0.1:5173] [--headed]
 *
 * Exit 0 = a stranger can start playing. Exit 1 = they cannot.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/coldplay'));
const HEADED = process.argv.includes('--headed');

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: !HEADED,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const steps = [];
const shot = async (name) => { await page.screenshot({ path: path.join(OUT, `${name}.png`) }); };
const note = (ok, label, detail = '') => {
  steps.push({ ok, label, detail });
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ' — ' + detail : ''}`);
};

// ===========================================================================
// THE ESCAPE INSTRUMENT
//
// THIS EXISTS BECAUSE THE GATE CERTIFIED THE DEFECT.
//
// The old assertion under the Recover key read, in full:
//
//     'Recover always visibly moves you, onto ground you can stand on'
//     -> 3/3 moved (10m:3.5m, 9.5m:3.5m, 24m:3.6m)
//
// and it passed on every build, including the ones a cold player could not get
// out of. He wrote the refutation himself: *"Moving 3.5 m inside a hill is
// still inside the hill; the gate measures displacement, not escape."* It also
// measured "solid ground" as `islandAt(x, z) !== null`, which is the exact
// question the broken code was asking itself — so the gate and the defect
// agreed, and both were wrong about the same thing.
//
// Displacement is a proxy. Escape is the promise, and it is five facts:
//
//   1. THE BOOTS ARE ON A SURFACE. The heightfield or the built lattice answers
//      here, the cadet is standing on that surface, and `grounded` is true.
//   2. HE IS NOT INSIDE ANY COLLIDER. Not under the terrain, not through a
//      panel of his own lattice, and not in the middle of a drawn solid.
//   3. THE LENS IS NOT INSIDE GEOMETRY EITHER.
//   4. THE VIEW IS NOT OCCLUDED. Most of the frame is not a wall at arm's
//      length, and a real share of it reaches actual distance.
//   5. THE LENS IS NOT IN HIS SHOULDER.
//
// None of that is asked of the player module. It is measured off the world
// heightfield, the real three.js camera's world transform, and raycasts through
// the scene graph the player is looking at — plus, for the "black mush" the
// report is actually about, the shipped pixels.
//
// ONE THING IN HERE IS LOAD-BEARING AND EASY TO GET WRONG. A ray leaving the
// inside of a closed mesh hits only BACK faces, and a front-side raycast is
// blind to those, so a naive probe stands in the middle of the cathedral,
// looks straight through its own walls and reports open country. Every material
// on the probe list is flipped to `DoubleSide` for the measurement and put back
// before anything is drawn. Without that line this instrument is another proxy.
// ===========================================================================
const ESCAPE_JS = `(() => {
  const a = window.__ascent, T = a.THREE, cam = a.camera;
  const p = a.player.pos;
  const eye = new T.Vector3(); cam.getWorldPosition(eye);
  const aim = new T.Vector3(p.x, p.y + 1.46, p.z);

  // Everything drawn and solid EXCEPT the cadet's own hardware and the island
  // shell. The shell is answered exactly, and far more cheaply, by marching the
  // heightfield; it is also the one mesh big enough for raycasting to matter.
  const mine = new Set(); a.player.root.traverse((o) => mine.add(o));
  const list = [];
  a.scene.traverse((o) => {
    if (!o.isMesh || !o.visible || mine.has(o) || o.userData.noCamBlock) return;
    const m = o.material; if (!m) return;
    const mats = Array.isArray(m) ? m : [m];
    if (mats.some((q) => !q || q.transparent || q.depthWrite === false || q.wireframe)) return;
    const g = o.geometry; if (!g) return;
    const tris = (g.index ? g.index.count : (g.attributes.position?.count || 0)) / 3;
    if (!tris || tris > 30000) return;
    list.push(o);
  });
  const was = [];
  for (const o of list) {
    const ms = Array.isArray(o.material) ? o.material : [o.material];
    for (const q of ms) { was.push(q, q.side); q.side = T.DoubleSide; }
  }
  const ray = new T.Raycaster();
  const cast = (from, dir, far) => {
    ray.near = 0.02; ray.far = far; ray.set(from, dir);
    const h = ray.intersectObjects(list, false);
    return h.length ? h[0].distance : far;
  };
  // The island's own version of "you cannot see out this way".
  const wall = (x, y, z, d, far) => {
    if (d.y > 0.35) return false;
    for (let s = 2; s <= far; s += 2.5) {
      const h = a.islandAt(x + d.x * s, z + d.z * s);
      if (h !== null && h > y + d.y * s + 0.5) return true;
    }
    return false;
  };
  const DIRS = [];
  for (let i = 0; i < 12; i++) { const t = (i / 12) * Math.PI * 2;
    DIRS.push(new T.Vector3(Math.cos(t), 0, Math.sin(t))); }
  for (let i = 0; i < 4; i++) { const t = (i / 4) * Math.PI * 2 + 0.4, c = Math.cos(0.5);
    DIRS.push(new T.Vector3(Math.cos(t) * c, Math.sin(0.5), Math.sin(t) * c)); }
  DIRS.push(new T.Vector3(0, 1, 0));
  const AX = [[1,0,0],[-1,0,0],[0,1,0],[0,-1,0],[0,0,1],[0,0,-1]]
    .map((v) => new T.Vector3(v[0], v[1], v[2]));

  const openness = (x, y, z) => {
    let n = 0;
    const from = new T.Vector3(x, y, z);
    for (const d of DIRS) {
      if (cast(from, d, 22) < 22) continue;
      if (wall(x, y, z, d, 22)) continue;
      n++;
    }
    return n / DIRS.length;
  };
  // Inside a boulder, every way out is short.
  const insideSolid = (x, y, z, r) => {
    const from = new T.Vector3(x, y, z);
    for (const d of AX) if (cast(from, d, r) >= r) return false;
    return true;
  };

  // What the frame is actually full of: a 9x7 grid through the real lens, each
  // ray stopped by whichever comes first — a drawn solid or the island.
  const v2 = new T.Vector2();
  let short = 0, far = 0, n = 0, minD = Infinity;
  for (let iy = 0; iy < 7; iy++) for (let ix = 0; ix < 9; ix++) {
    v2.set((ix / 8) * 1.9 - 0.95, (iy / 6) * 1.9 - 0.95);
    ray.near = 0.02; ray.far = 900; ray.setFromCamera(v2, cam);
    const h = ray.intersectObjects(list, false);
    let d = h.length ? h[0].distance : 900;
    const dir = ray.ray.direction;
    for (let s = 1; s < Math.min(d, 220); s += 1.5) {
      const hh = a.islandAt(eye.x + dir.x * s, eye.z + dir.z * s);
      if (hh !== null && hh > eye.y + dir.y * s) { d = Math.min(d, s); break; }
    }
    n++;
    // A WALL IS NOT A FLOOR, and this line is the difference between a gate
    // that measures occlusion and one that fails every shot taken on a slope.
    // The ground under the cadet's own boots is three metres from the lens on
    // any real hillside and fills the bottom of the frame — that is what a
    // third-person camera looks like, not what being buried looks like. So a
    // ray only counts as a wall when it stops short AT OR NEAR THE HEIGHT OF
    // THE EYE. Everything below knee height is the world he is standing on.
    if (d < 3 && eye.y + dir.y * d > eye.y - 1.3) short++;
    if (d > 25) far++;
    if (d < minD) minD = d;
  }

  const camOpen = openness(eye.x, eye.y, eye.z);
  const bodyOpen = openness(p.x, p.y + 1.46, p.z);
  const inSolid = insideSolid(p.x, p.y + 0.9, p.z, 1.1);
  const camInSolid = insideSolid(eye.x, eye.y, eye.z, 0.8);
  for (let i = 0; i < was.length; i += 2) was[i].side = was[i + 1];

  const gh = a.islandAt(p.x, p.z);
  const sh = a.surfaceAt(p.x, p.z);
  const surf = sh !== null && (gh === null || sh > gh) ? sh : gh;
  const camG = a.islandAt(eye.x, eye.z);
  const S = a.builder && a.builder.solids;
  const inWall = !!(S && S.count && (S.contains(p.x, p.y + 0.3, p.z, 0.25)
    || S.contains(p.x, p.y + 1.0, p.z, 0.25) || S.contains(p.x, p.y + 1.7, p.z, 0.25)));
  const camInWall = !!(S && S.count && S.contains(eye.x, eye.y, eye.z, 0.2));

  return {
    x: +p.x.toFixed(1), y: +p.y.toFixed(1), z: +p.z.toFixed(1),
    ground: surf,
    // 1
    onGround: surf !== null && !!a.player.grounded && Math.abs(p.y - surf) < 0.7,
    // 2
    inTerrain: surf !== null && p.y < surf - 0.2,
    inWall, inSolid,
    // 3
    camInTerrain: camG !== null && eye.y < camG + 0.05,
    camInWall, camInSolid,
    // 4
    short: +(short / n).toFixed(3), seeFar: +(far / n).toFixed(3),
    minD: +minD.toFixed(2), open: +bodyOpen.toFixed(3), camOpen: +camOpen.toFixed(3),
    // 5
    boom: +eye.distanceTo(aim).toFixed(2),
    vy: +a.player.vel.y.toFixed(2),
    recoveries: a.player.recoveries | 0, caught: a.player.caught | 0,
    stuck: !!a.player.stuck, ui: !!a.input.uiOpen || !!a.panel.open,
  };
})()`;

const look = () => page.evaluate(ESCAPE_JS);

/**
 * The verdict on a recovery, read the way the promise is worded.
 *
 * "Recover puts you back on solid ground" is a statement about WHERE IT PUTS
 * YOU. This island does not then hold still: there are standing updrafts, drift
 * surges that throw a cadet seven metres a second straight up, and at least one
 * site that carries him steadily skyward the moment he stands on it. Reading
 * the verdict two seconds later photographs whichever of those got to him and
 * files it under "Recover failed", which would be this gate inventing a defect
 * with the same carelessness it used to certify one.
 *
 * So two frames are taken. The FIRST, immediately, is where the verb actually
 * set him down — the lens is re-founded rather than flown after a recovery, so
 * that frame is already the shot the player sees. The SECOND is the first one
 * he is settled and standing on in the next four seconds. He has escaped if
 * either says so, and if they disagree the reason is printed, because "the
 * island carried him off afterwards" is a true and useful thing to know and is
 * not the same finding as "the key does nothing".
 */
const recoveryVerdict = async (handBack) => {
  await page.waitForTimeout(180);
  const spot = await look();
  await page.waitForTimeout(420);
  const drift = await look();
  // ---- IS THE ISLAND CARRYING HIM? ----------------------------------------
  //
  // At one site on this shard — around (−87.5, 67.3) — something world-side
  // takes hold of a cadet who stands on the ground there and lifts him at about
  // fourteen metres a second, for ever: `vel.y` stays NEGATIVE the whole way, so
  // it is not physics, it is a system writing `pos.y` directly. Recover puts him
  // down at 38.3 m on ground that is at 37.8, exactly as promised, and two
  // seconds later he is at 89 m and climbing.
  //
  // A gate that reads the verdict two seconds after the key files that under
  // "Recover left the cadet not standing on a surface", which is false, blames
  // the wrong module, and is the same carelessness that certified the original
  // defect — measuring what happened NEAR the thing instead of what the thing
  // did. So a cadet rising while his own velocity says he should be falling is
  // named for what he is: being carried. Every other clause of escape is still
  // enforced on the frame the verb produced.
  const carried = !spot.onGround && !drift.onGround
    && drift.y - spot.y > 1.0 && drift.vy <= 0.2;
  if (carried) {
    return {
      spot, after: drift, carried: true,
      why: notFree({ ...spot, onGround: true }),
      note: `the island carried him upward from the spot Recover chose `
        + `(${spot.y.toFixed(1)}m -> ${drift.y.toFixed(1)}m in 0.4s with vel.y ${drift.vy}) `
        + '— world-side, not the recovery',
    };
  }
  let settled = drift;
  for (let k = 0; k < 10 && !settled.onGround; k++) {
    await page.waitForTimeout(320);
    if (handBack) await handBack();
    settled = await look();
  }
  const whySpot = notFree(spot);
  const whySettled = notFree(settled);
  return {
    spot,
    after: settled,
    // Free on the frame the verb produced, or free once he stopped moving.
    why: (whySpot && whySettled) ? whySettled : '',
    carried: false,
    note: (!whySpot && whySettled) ? 'the island moved him off the spot afterwards' : '',
  };
};

/**
 * ESCAPE, as one predicate. Returns **the reason he has not escaped**, or the
 * empty string when he has — so the reason a run failed is always printed, and
 * a caller can never accidentally read a truthy explanation as a pass.
 *
 * Every bar here was set off measurements of this build at places that were
 * captured and looked at by eye — see shots/coldplay/wedge-*.png. The wedged
 * frames the critic reported sit at open 0.18, short 0.76, minD 1.3; open
 * ground on the plaza sits at open 0.88, short 0.00, minD 4.0; the tightest
 * legitimate standing place found anywhere on the island — the foot of a steep
 * bank under tree cover — sits at open 0.41, short 0.14. So the bars are drawn
 * between those two populations, not around one build's numbers.
 */
const notFree = (f) => {
  if (!f.onGround) return `not standing on a surface (ground=${f.ground}, y=${f.y})`;
  if (f.inTerrain) return `inside the terrain (${(f.ground - f.y).toFixed(1)}m under the surface)`;
  if (f.inWall) return 'inside a panel of his own lattice';
  if (f.inSolid) return 'inside a drawn solid — a rock, a hoodoo, a landmark';
  if (f.camInTerrain) return 'the lens is under the heightfield';
  if (f.camInWall) return 'the lens is inside the built lattice';
  if (f.camInSolid) return 'the lens is inside a drawn solid';
  if (f.short > 0.40) return `the view is a wall: ${(f.short * 100) | 0}% of the frame stops inside 3m`;
  if (f.seeFar < 0.06) return `nothing in the frame reaches 25m (seeFar=${f.seeFar})`;
  if (f.open < 0.30) return `walled in: only ${(f.open * 100) | 0}% of the directions around him are open`;
  if (f.boom < 2.2) return `the lens is in his shoulder (boom ${f.boom}m)`;
  return '';
};

/**
 * …AND WHAT THE PLAYER ACTUALLY SEES, off the shipped pixels.
 *
 * The report is "black mush", so one instrument reads black mush. A tile is
 * mush when it is dark AND has no detail in it at all — shade under a tree is
 * dark and full of structure, the inside of an arch is dark and perfectly flat,
 * and that difference is the whole measurement. Reported alongside every
 * verdict; it is corroboration, not the bar, because a legitimately dark
 * hillside can reach a third of the frame.
 */
const mush = async (name) => {
  const buf = await page.screenshot(name ? { path: path.join(OUT, `${name}.png`) } : {});
  return page.evaluate(async (d) => {
    const img = new Image(); img.src = 'data:image/png;base64,' + d; await img.decode();
    const W = 192, H = 108;
    const c = document.createElement('canvas'); c.width = W; c.height = H;
    const g = c.getContext('2d', { willReadFrequently: true });
    g.drawImage(img, 0, 0, W, H);
    const px = g.getImageData(0, 0, W, H).data;
    const L = new Float64Array(W * H);
    for (let i = 0; i < W * H; i++) {
      L[i] = 0.2126 * px[i * 4] + 0.7152 * px[i * 4 + 1] + 0.0722 * px[i * 4 + 2];
    }
    const TX = 16, TY = 9, tw = W / TX, th = H / TY;
    let bad = 0;
    for (let ty = 0; ty < TY; ty++) for (let tx = 0; tx < TX; tx++) {
      let s = 0, ss = 0, k = 0;
      for (let y = ty * th; y < (ty + 1) * th; y++) {
        for (let x = tx * tw; x < (tx + 1) * tw; x++) {
          const q = L[y * W + x]; s += q; ss += q * q; k++;
        }
      }
      const m = s / k, sd = Math.sqrt(Math.max(0, ss / k - m * m));
      if (m < 34 && sd < 7) bad++;
    }
    return +(bad / (TX * TY)).toFixed(3);
  }, buf.toString('base64'));
};

// A fresh install, every time.
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4000);
await shot('00-arrival');

// --- 1. Does the game tell a stranger how to move, early? -------------------
const earlyText = await page.evaluate(() => document.getElementById('ui')?.innerText || '');
const teachesMovement = /\bW\b|\bWASD\b|\bA\s*S\s*D\b|move|mover|ruch|poruszan/i.test(earlyText);
note(teachesMovement, 'controls are on screen within ~4s',
  teachesMovement ? '' : 'no movement hint found in the HUD text');

// --- 2. Does a first click wreck the view? ----------------------------------
const beforeClick = await page.evaluate(() => window.__ascent.state?.() ?? {});
await page.mouse.click(800, 450);
await page.waitForTimeout(600);
const built = await page.evaluate(() => (window.__ascent.builder?.pieces?.size ?? 0));
note(built === 0, 'a first left-click does not build a wall in your face',
  built ? `${built} piece(s) placed by one click` : '');
await shot('01-after-first-click');

// --- 3. Walk to the first rift using ONLY keys ------------------------------
// Aim the camera at the nearest unlocked rift by turning with the mouse the way
// a person would, then hold W. No teleporting, no coordinates written in.
const target = await page.evaluate(() => {
  const a = window.__ascent;
  const r = a.rifts?.list?.filter((x) => !x.locked) ?? [];
  if (!r.length) return null;
  const p = a.player.pos;
  let best = null, bd = 1e9;
  for (const x of r) {
    const d = Math.hypot(x.pos.x - p.x, x.pos.z - p.z);
    if (d < bd) { bd = d; best = x; }
  }
  return best ? { id: best.id, x: best.pos.x, y: best.pos.y, z: best.pos.z, dist: bd } : null;
});
note(!!target, 'an unlocked rift exists to walk to', target ? `${target.id} at ${target.dist.toFixed(0)}m` : 'none');

let reached = false, opened = false;
let held = false;
if (target) {
  await page.mouse.move(800, 450);
  await page.mouse.click(800, 450); // pointer lock
  await page.waitForTimeout(300);

  for (let attempt = 0; attempt < 220 && !reached; attempt++) {
    // turn toward the target the way a player would: yaw error -> mouse dx
    const err = await page.evaluate((t) => {
      const a = window.__ascent, p = a.player.pos;
      const want = Math.atan2(t.x - p.x, t.z - p.z);
      let d = ((want - a.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (d < -Math.PI) d += Math.PI * 2;
      return { d, dist: Math.hypot(t.x - p.x, t.z - p.z), y: p.y };
    }, target);

    if (Math.abs(err.d) > 0.06) await page.mouse.move(800 - err.d * 240, 450, { steps: 2 });

    // Hold the key down and steer while running, the way a person does.
    // Tapping W for 120ms and releasing never lets the acceleration curve build,
    // so the cadet shuffles at walking pace and the gate blames the game.
    if (!held) { await page.keyboard.down('KeyW'); held = true; }
    await page.waitForTimeout(120);

    // Arriving is either standing next to it OR the ring opening on contact —
    // and contact STOPS the player, so a distance test alone reports failure at
    // the exact moment the game did the right thing.
    opened = await page.evaluate(() => !!window.__ascent.panel?.open);
    if (err.dist < 5 || opened) reached = true;
  }
  if (held) { await page.keyboard.up('KeyW'); held = false; }
  await shot('02-at-the-rift');
  note(reached, 'a stranger can WALK to the first rift with WASD alone',
    reached ? (opened ? 'the ring opened on contact' : '') : 'never got within 5m using only W and the mouse');

  // --- 4. Try every reasonable way a person opens a thing -------------------
  for (const key of ['KeyE', 'KeyF', 'Enter', 'Space', 'KeyR']) {
    await page.keyboard.press(key);
    await page.waitForTimeout(500);
    opened = await page.evaluate(() => !!window.__ascent.panel?.open);
    if (opened) { note(true, `walking up and pressing ${key} opens the rift`); break; }
  }
  if (!opened) {
    // last resort: the instinct everyone has — walk into it
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(900);
    await page.keyboard.up('KeyW');
    opened = await page.evaluate(() => !!window.__ascent.panel?.open);
    if (opened) note(true, 'walking bodily into the ring opens the rift');
  }
  if (!opened) note(false, 'the rift can be opened at all by a cold player',
    'tried E, F, Enter, Space, R and walking into it');
  await shot('03-rift-open');
}

// --- 5. THE CARD NEVER GOES SILENT -----------------------------------------
//
// THIS STEP EXISTS BECAUSE THE GAME LOST FOUR MINUTES OF A SESSION TO A
// TWO-METRE RING OF GROUND.
//
// A cold critic walked toward the first rift and, somewhere around ten metres
// out, the game stopped having an opinion:
//
//   "at 10-11 m the objective card replaces the direction label with YOU ARE
//    STANDING IN IT. No rift ring is present, no 'Open the rift' prompt
//    appears, E is a silent no-op, and R returns you to 10 m still 'standing in
//    it'. Probed w/a/s/d from that spot: 11m->21m 'BEHIND YOU', 11m 'TO YOUR
//    RIGHT', 10m 'STANDING IN IT', 10m 'STANDING IN IT'. Reproduced three
//    separate times."
//
// Two surfaces held two different numbers for one question. The objective card
// called a rift "in hand" inside eleven metres; the key that opens one works
// inside nine (src/world/rifts.js). Between them was a ring around EVERY rift
// on the island in which the player was offered no direction to walk and no
// action to take, and — because the waypoint also stood down at eleven metres —
// nothing on screen anywhere pointed at anything.
//
// So this is the promise, and it is checked on every frame of every approach:
//
//   THE OBJECTIVE ALWAYS OFFERS EITHER A DIRECTION OR AN ACTION THAT WORKS.
//   NEVER NEITHER. "You are standing in it" is only ever said with a live
//   prompt beside it.
//
// It is checked twice, deliberately.
//
// 5a walks the ring with the keyboard, out and back in on eight bearings, which
//    is the critic's own w/a/s/d probe run sixteen times. Nothing here is
//    teleported and nothing is asked of the debug API: the cadet turns with the
//    arrow keys and walks with W, and the card is read off the DOM at 8 Hz all
//    the way in, through the exact band that swallowed him.
//
// 5b then sweeps EVERY rift on the island at every radius across the boundary,
//    from eight bearings, by standing the cadet at each point. That half cannot
//    prove an interaction and does not claim to — 5a does that. What it proves
//    is a property of the *card*, which is a pure function of where the boots
//    are: that there is nowhere on this island, beside any tear, where it goes
//    quiet. Ten rifts × thirteen radii × eight bearings is a thousand places no
//    walk could visit inside a gate's budget.
{

  const handBack = async () => {
    for (let i = 0; i < 6; i++) {
      if (!(await page.evaluate(() => !!window.__ascent.input.uiOpen))) return;
      let hit = false;
      for (const sel of ['.sc-go', '.ses-charter button', '.ses-rest button', '.rf-x']) {
        const b = await page.$(sel);
        if (b && await b.isVisible()) { await b.click().catch(() => {}); hit = true; break; }
      }
      if (!hit) await page.keyboard.press('Escape');
      await page.waitForTimeout(500);
    }
  };
  await handBack();

  // ---- 5a. the critic's own probe, walked, on the keys ---------------------
  //
  // THE KEYS ARE PRESSED FROM OUT HERE; THE CARD IS READ FROM IN THERE.
  //
  // The first cut of this read the card over the wire once every 110 ms, which
  // is both too slow to be thorough — a cadet crosses the whole two-metre ring
  // in about a fifth of a second at a run — and, at some sixty round trips per
  // approach, heavy enough that on a loaded machine the browser fell over
  // mid-step and took the gate down with it.
  //
  // So a sampler rides inside the page on the frame loop and records EVERY
  // frame of the walk, and the harness collects it once per approach. Nothing
  // about the input changes: the cadet still turns with the arrow keys and
  // walks with W, and the sampler is a pure read of `story.guide()`, which is
  // itself a read of the painted card. It is roughly sixty times the evidence
  // for a thirtieth of the traffic.
  await page.evaluate(() => {
    const a = window.__ascent;
    const R = { on: false, tag: '', n: 0, ring: 0, bad: [], minM: 1e9 };
    window.__ring = R;
    const tick = () => {
      try {
        if (R.on && !a.input.uiOpen && !a.panel?.open) {
          const g = a.story?.guide?.();
          if (g) {
            R.n++;
            if (g.metres != null && g.metres < R.minM) R.minM = g.metres;
            // Inside fourteen metres is "in the ring": it brackets the nine
            // metre reach and the eleven the card used to claim, so the count
            // proves the walk went through the band that swallowed the critic.
            if (g.metres != null && g.metres <= 14) R.ring++;
            // THE INVARIANT. Neither a key nor a bearing is the defect; and
            // "you are standing in it" with no key on screen is the lie.
            if (g.offers === 'nothing') {
              R.bad.push(`${R.tag}: ${g.metres} m from ${g.skill}, card said "${g.dir}" with no prompt`);
            } else if (g.here && !g.prompt) {
              R.bad.push(`${R.tag}: "standing in it" at ${g.metres} m with no prompt (nearest ${g.nearId})`);
            }
          }
        }
      } catch { /* a frame mid-teardown is not evidence */ }
      requestAnimationFrame(tick);
    };
    requestAnimationFrame(tick);
  });

  const home = await page.evaluate(() => {
    const g = window.__ascent.story?.guide?.();
    const r = window.__ascent.rifts.list.find((x) => x.id === g?.skill)
      || window.__ascent.rifts.list.find((x) => !x.locked);
    return r ? { id: r.id, x: r.foot.x, z: r.foot.z } : null;
  });

  /** Face a compass bearing using ARROW KEYS ONLY — no pointer lock needed. */
  const faceYaw = async (want) => {
    for (let i = 0; i < 14; i++) {
      const d = await page.evaluate((w) => {
        let e = ((w - window.__ascent.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
        if (e < -Math.PI) e += Math.PI * 2;
        return e;
      }, want);
      if (Math.abs(d) < 0.14) return true;
      const key = d > 0 ? 'ArrowLeft' : 'ArrowRight';
      await page.keyboard.down(key);
      await page.waitForTimeout(Math.min(400, Math.max(60, Math.abs(d) / 2.6 * 1000)));
      await page.keyboard.up(key);
    }
    return false;
  };

  const arm = (tag) => page.evaluate((t) => { window.__ring.tag = t; window.__ring.on = true; }, tag);
  const disarm = () => page.evaluate(() => { window.__ring.on = false; return { ...window.__ring, bad: window.__ring.bad.slice(0, 3) }; });
  const spot = () => page.evaluate(() => ({
    x: window.__ascent.player.pos.x, z: window.__ascent.player.pos.z,
    ui: !!window.__ascent.input.uiOpen, panel: !!window.__ascent.panel?.open,
  }));

  // A BUDGET, so the step cannot run away on a loaded machine. Eight bearings
  // is what it wants; it asserts on however many it got, and refuses to pass on
  // fewer than three, because a walk that never happened proves nothing.
  const RING_BUDGET_MS = 130000;
  const ringT0 = Date.now();
  let bearings = 0, samples = 0, inRing = 0, worst = null;
  if (home) {
    for (let b = 0; b < 8 && !worst; b++) {
      if (Date.now() - ringT0 > RING_BUDGET_MS) break;
      await handBack();
      // OUT: face away from the tear and walk until well clear of the ring.
      await faceYaw((b / 8) * Math.PI * 2);
      await arm(`bearing ${b} outbound`);
      await page.keyboard.down('KeyW');
      for (let i = 0; i < 12; i++) {
        await page.waitForTimeout(280);
        const s = await spot();
        if (s.ui) { await page.keyboard.up('KeyW'); await handBack(); await page.keyboard.down('KeyW'); continue; }
        if (Math.hypot(s.x - home.x, s.z - home.z) > 17) break;
      }
      await page.keyboard.up('KeyW');
      let r = await disarm();
      samples += r.n; inRing += r.ring;
      if (r.bad.length) worst = r.bad[0];
      await page.waitForTimeout(200);

      // BACK IN: turn round and walk at it, the card sampled every frame.
      const s0 = await spot();
      if (Math.hypot(s0.x - home.x, s0.z - home.z) < 12) continue;
      await faceYaw(Math.atan2(home.x - s0.x, home.z - s0.z));
      await arm(`bearing ${b} inbound`);
      await page.keyboard.down('KeyW');
      let touched = false;
      for (let i = 0; i < 14; i++) {
        await page.waitForTimeout(260);
        const s = await spot();
        if (s.panel || s.ui) { touched = true; break; }
        if (Math.hypot(s.x - home.x, s.z - home.z) < 5) { touched = true; break; }
      }
      await page.keyboard.up('KeyW');
      r = await disarm();
      samples += r.n; inRing += r.ring;
      if (!worst && r.bad.length) worst = r.bad[0];
      bearings++;
      // …and where the card says the key works, the key has to work.
      if (touched && !(await page.evaluate(() => !!window.__ascent.panel?.open))) {
        await page.keyboard.press('KeyE');
        await page.waitForTimeout(500);
      }
      await handBack();
    }
  }
  await shot('04-objective-ring');
  note(!!home && bearings >= 3 && inRing > 0 && !worst,
    'walking in on every bearing, the objective never offers nothing',
    worst || `${samples} frames over ${bearings} walked approaches, `
      + `${inRing} of them inside 14 m, every one offering a bearing or a key`);

  // ---- 5b. every rift, every radius across the boundary, eight bearings ----
  const sweep = await page.evaluate(async () => {
    const a = window.__ascent;
    const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
    // An earlier step leaves a rift panel open. The loop below skips any sample
    // taken while a panel is up, so without this the sweep silently measures
    // NOTHING and still reports a tidy "0 places checked" — a vacuous pass
    // dressed as a real one. Close it first, and assert we actually sampled.
    //
    // Closing it ONCE is not enough, and that is the whole trap. The sweep
    // teleports the cadet across the rift's own plate on its way round, the
    // plate opens the tear exactly as it is supposed to, and from that sample
    // on every remaining place is skipped: 1019 places measured collapses to 4.
    // So the panel is put away before EVERY sample, not just the first.
    const settle = async () => {
      if (a.panel?.open) { a.panel.close?.(); await sleep(90); }
      a.input.uiOpen = false;
    };
    await settle();
    await sleep(400);
    const keep = { x: a.player.pos.x, y: a.player.pos.y, z: a.player.pos.z };
    const bad = [];
    let n = 0;
    // Radii chosen to straddle the reach boundary densely: the defect lived
    // between 9 and 11 and a coarser sweep would have walked straight over it.
    const RADII = [4, 6, 7.5, 8.5, 8.9, 9, 9.1, 9.5, 10, 10.5, 11, 12, 16];
    for (const r of a.rifts.list) {
      for (const rad of RADII) {
        for (let b = 0; b < 8; b++) {
          const th = (b / 8) * Math.PI * 2;
          const x = r.foot.x + Math.cos(th) * rad, z = r.foot.z + Math.sin(th) * rad;
          const h = a.islandAt(x, z);
          if (h === null) continue;
          await settle();
          a.player.pos.set(x, h + 0.55, z);
          a.player.vel.set(0, 0, 0);
          await sleep(34);
          if (a.input.uiOpen || a.panel?.open) continue;
          const g = a.story?.guide?.();
          if (!g) continue;
          n++;
          if (g.offers === 'nothing' || (g.here && !g.prompt)) {
            bad.push(`${r.id} @${rad}m/${b}: "${g.dir}" prompt=${g.prompt}`);
          }
        }
      }
    }
    a.player.pos.set(keep.x, keep.y, keep.z);
    return { n, bad: bad.slice(0, 5), total: bad.length };
  });
  note(sweep.n > 200 && sweep.total === 0,
    'and from a thousand standing places beside every rift, it never does either',
    sweep.total ? sweep.bad.join(' | ') : `${sweep.n} places checked across ${13} radii, 8 bearings`);
  await handBack();

  // ---- 5c. …and the way out is a way OUT, not a way ALONG -----------------
  //
  // WHAT THIS STEP USED TO SAY, AND WHY IT WAS WORSE THAN NOTHING:
  //
  //     'Recover always visibly moves you, onto ground you can stand on'
  //     -> 3/3 moved (10m:3.5m, 9.5m:3.5m, 24m:3.6m)
  //
  // It stood over three teleports to flat ground beside a rift, pressed R, and
  // checked two things: that the cadet's x/z had changed by more than two
  // metres, and that `islandAt` still answered under him. Both were true of
  // every build, including the ones a cold player could not get out of, because
  // **neither of them is the promise.** The player who found it said it in one
  // line: *"Moving 3.5 m inside a hill is still inside the hill; the gate
  // measures displacement, not escape."*
  //
  // Worse than that: `islandAt(x, z) !== null` is the *same question the broken
  // code was asking itself*. Collision on this island is a heightfield plus the
  // built lattice, and every landmark, monolith, arch and boulder is drawn with
  // no collider at all — so the heightfield cheerfully reports "solid ground"
  // from the middle of a sixty-metre mesh. The gate and the defect agreed, and
  // they were wrong about the same thing. That is the fourth time in this
  // project a gate has certified a defect by measuring a proxy.
  //
  // ---------------------------------------------------------------------------
  // SO THIS STEP DOES TWO THINGS THE OLD ONE DID NOT.
  //
  // FIRST IT GETS THE CADET GENUINELY STUCK, and it does it by walking. Flat
  // ground beside a rift is not the reported state; a gate that presses R from
  // somewhere fine proves only that R works from somewhere fine. So the sites
  // are found by asking the scene which drawn solids are big enough to stand
  // inside of, the cadet is set down on the ground SIXTEEN METRES OUTSIDE one,
  // it is checked that he can see out from there, and then he WALKS IN on the W
  // key until the instrument says the frame is a wall. Nothing about the wedge
  // is arranged: the walk either buries him or it does not.
  //
  // AND IF NO SITE BURIES HIM, THIS STEP FAILS. A run in which the stuck state
  // never occurred has tested nothing, and reporting that as a pass is exactly
  // the shape of every false fix this defect has already survived.
  //
  // SECOND, THE ASSERTION IS ESCAPE. `notFree()` at the top of this file: on a
  // surface, not inside terrain, not inside his own lattice, not inside a drawn
  // solid, lens outside all three, most of the frame not a wall at arm's
  // length, some of it reaching real distance, and the lens off his shoulder.
  // The same predicate has to say NOT ESCAPED before the key and ESCAPED after
  // it, which is this step's self-test: an instrument that cannot see the
  // reported failure is not allowed to certify the fix for it.
  //
  // The verb is exercised both ways a player can reach it — the R key, and the
  // RECOVER button on the Esc card, which is the other thing the critic tried.
  {
    // Drawn solids on the island big enough for a cadet to be inside of. Found
    // by asking the scene, not written down, so a world team reshaping the
    // island cannot silently empty this test.
    const sites = await page.evaluate(() => {
      const a = window.__ascent, T = a.THREE;
      const out = []; const c = new T.Vector3(), s = new T.Vector3();
      a.scene.traverse((o) => {
        if (!o.isMesh || !o.visible || o.userData.noCamBlock || o.isInstancedMesh) return;
        const m = o.material; if (!m) return;
        const ms = Array.isArray(m) ? m : [m];
        if (ms.some((q) => !q || q.transparent || q.depthWrite === false)) return;
        const g = o.geometry; if (!g) return;
        const tris = (g.index ? g.index.count : (g.attributes.position?.count || 0)) / 3;
        if (!tris || tris > 30000) return;
        if (!g.boundingSphere) g.computeBoundingSphere();
        const bs = g.boundingSphere; if (!bs) return;
        o.updateWorldMatrix(true, false);
        s.setFromMatrixScale(o.matrixWorld);
        const r = bs.radius * Math.max(s.x, s.y, s.z);
        if (r < 10 || r > 120) return;
        c.copy(bs.center).applyMatrix4(o.matrixWorld);
        if (Math.hypot(c.x, c.z) > 190) return;
        if (a.islandAt(c.x, c.z) === null) return;
        out.push({ x: +c.x.toFixed(1), z: +c.z.toFixed(1), r: +r.toFixed(1) });
      });
      return out;
    });

    const release = async () => {
      for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft']) {
        await page.keyboard.up(k).catch(() => {});
      }
    };

    let wedges = 0, freed = 0, byKey = 0, byButton = 0, healed = 0;
    let lost = null;
    const marks = [];
    let firstWedgeShot = false;

    // Site × approach. One bearing per landmark was enough to bury the cadet
    // twice on this build, and "enough on this build" is how a gate becomes
    // flaky: an island reshaped by the world team could leave the one bearing
    // tried facing a cliff and quietly empty the test. Three approaches each.
    const runsIn = [];
    for (const s of sites) for (const b of [0, 3, 6]) runsIn.push({ s, b });

    for (const { s, b: b0 } of runsIn) {
      if (wedges >= 6) break;
      await release();
      await handBack();

      // Set him down OUTSIDE it, on ground he can see out from, and check that
      // he can — a "wedge" that was already a wedge before he walked proves
      // nothing about walking into one.
      const start = await page.evaluate(({ t, b0: first }) => {
        const a = window.__ascent;
        for (let k = 0; k < 8; k++) {
          const b = (first + k) % 8;
          const ang = (b / 8) * Math.PI * 2;
          const x = t.x + Math.cos(ang) * 16, z = t.z + Math.sin(ang) * 16;
          const h = a.islandAt(x, z);
          if (h === null) continue;
          a.player.pos.set(x, h + 0.55, z);
          a.player.vel.set(0, 0, 0);
          a.player.yaw = Math.atan2(t.x - x, t.z - z);
          return b;
        }
        return -1;
      }, { t: s, b0 });
      if (start !== b0) continue;   // this approach does not exist; try the next
      await page.waitForTimeout(800);
      await handBack();
      const out0 = await look();
      if (notFree(out0)) continue;          // he started in trouble: not a walk

      // ---- the walk in ----
      await page.mouse.click(800, 450);
      await page.keyboard.down('KeyW');
      let wedged = null;
      for (let i = 0; i < 40; i++) {
        await page.waitForTimeout(160);
        const f = await look();
        if (f.ui) {
          await page.keyboard.up('KeyW');
          await handBack();
          await page.mouse.click(800, 450);
          await page.keyboard.down('KeyW');
          continue;
        }
        const why = notFree(f);
        // Only a REAL wedge counts: the frame is a wall and nothing in it
        // reaches distance. Being merely close to something is not the report.
        if (why && f.short > 0.40 && f.seeFar < 0.12) { wedged = { f, why, i }; break; }
      }
      await release();
      if (!wedged) continue;
      // …AND IT HAS TO STILL BE TRUE WHEN HE STOPS PUSHING.
      //
      // The report is ninety seconds long. A frame that is a wall for a fifth of
      // a second while the lens is mid-solve is not that, and holding Recover
      // responsible for one would be the same error in the other direction —
      // a gate failing a build over a state the player never experiences. So
      // the stick goes down, the lens is given a full second to do its own job,
      // and only a wedge that is still a wedge afterwards is one.
      await page.waitForTimeout(1200);
      const before = await look();
      if (!notFree(before)) { healed++; continue; }
      wedges++;
      const beforeMush = await mush(firstWedgeShot ? null : '05c-wedged');
      firstWedgeShot = true;
      {
        // Alternate the two doors a player has: the key, and the card's button.
        const useButton = wedges % 2 === 0;
        if (useButton) {
          // The critic clicked this one too. It is the same verb behind the
          // same call (src/ui/menu.js -> player.recover), and a card that names
          // the escape hatch has to BE one.
          await page.keyboard.press('Escape');
          await page.waitForTimeout(650);
          const btn = await page.$('.mnu-recover');
          if (btn && await btn.isVisible()) { await btn.click(); byButton++; }
          else { await page.keyboard.press('Escape'); await page.keyboard.press('KeyR'); byKey++; }
        } else {
          await page.keyboard.press('KeyR');
          byKey++;
        }
        const v = await recoveryVerdict(handBack);
        const after = v.spot;
        const afterMush = await mush(`05c-freed-${wedges}`);
        const why = v.why;
        const moved = Math.hypot(after.x - before.x, after.z - before.z);
        marks.push(`${useButton ? 'button' : 'R'}@${s.x},${s.z}: `
          + `open ${before.open}->${after.open}, wall ${before.short}->${after.short}, `
          + `mush ${beforeMush}->${afterMush}, boom ${after.boom}m, moved ${moved.toFixed(1)}m`
          + (v.note ? ' [' + v.note + ']' : ''));
        if (why) {
          lost = lost || `${useButton ? 'the RECOVER button' : 'the R key'} at ${s.x},${s.z} `
            + `left the cadet ${why} (he moved ${moved.toFixed(1)}m — which is precisely `
            + `the number the old assertion was satisfied by)`;
        } else if (after.recoveries <= before.recoveries) {
          lost = lost || 'escaped, but the recovery counter never moved — that is the world '
            + 'letting go by itself, not the verb working';
        } else {
          freed++;
        }
      }
      if (lost) break;
    }

    await release();
    await handBack();

    // A GATE THAT PROVED NOTHING MUST NOT PASS.
    //
    // One is the bar and not two, deliberately. One cadet who walked himself
    // into a frame he could not see out of is the whole existence proof this
    // step needs, and the number varies run to run because the island does —
    // wardens move, drift plants columns, and a loaded machine walks him fewer
    // metres in the same six seconds. A bar set at the count a good run happens
    // to produce is a bar that fails builds for being measured on a busy
    // laptop, which is its own kind of instrument error. Zero still fails, and
    // fails loudly, because zero is a run that tested nothing.
    note(wedges >= 1, 'a cold player can walk himself into a state he cannot see out of',
      wedges >= 1 ? `${wedges} wedges walked into, out of ${runsIn.length} approaches `
        + `at ${sites.length} drawn solids (${healed} more healed themselves once he stopped pushing)`
        : `NO wedge reproduced in ${runsIn.length} approaches at ${sites.length} solids — `
        + 'the escape test below proved nothing');

    // THE MARKS ARE PRINTED ON THE FAILURE TOO, and they used to be printed
    // only on the pass. A failing run therefore reported one sentence about one
    // recovery and threw away the measurements of every recovery in the run,
    // including the one that failed — so "left the cadet walled in: only 29%"
    // arrived with no `open` before-and-after, no boom, no distance moved, and
    // the next agent had to reproduce the whole run to learn what the number
    // even applied to. A gate that hides its evidence when it fails is a gate
    // that gets argued with instead of acted on.
    note(wedges >= 1 && !lost && freed === wedges,
      'Recover ESCAPES: on solid ground, outside every collider, lens clear, view open',
      (lost || `${freed}/${wedges} freed (${byKey} by the R key, ${byButton} by the card's button)`)
        + (marks.length ? ' — ' + marks.join(' | ') : ''));
    await handBack();

    // ---- and the card's button is not a decoration ------------------------
    //
    // The critic pressed R three times AND clicked this. It reached the same
    // verb — and then fell through a clause the key did not: the search only
    // stepped a ring out for a reason on a list, and `'menu'` was not on the
    // list, so from anywhere the game thought was fine the button put the cadet
    // down on the exact square metre he was standing on. From where he was
    // sitting that is a dead button, which is what he wrote down. Pressed from
    // somewhere perfectly ordinary, on purpose: pressing it IS the report, and
    // it has to answer.
    {
      const b = await look();
      await page.keyboard.press('Escape');
      await page.waitForTimeout(650);
      const btn = await page.$('.mnu-recover');
      const visible = !!(btn && await btn.isVisible());
      if (visible) await btn.click();
      const v = await recoveryVerdict(handBack);
      const a2 = v.after;
      const moved = Math.hypot(a2.x - b.x, a2.z - b.z);
      const why = v.why;
      note(visible && moved > 2 && a2.recoveries > b.recoveries && !why,
        'the RECOVER button on the Esc card moves you, from a place the game thinks is fine',
        !visible ? 'the card has no RECOVER button on it'
          : why || `moved ${moved.toFixed(1)}m, recoveries ${b.recoveries}->${a2.recoveries}, `
            + `open ${b.open}->${a2.open}, boom ${a2.boom}m` + (v.note ? ' [' + v.note + ']' : ''));
      await handBack();
    }
  }

  // ---- 5d. …and out of a box the player built himself ----------------------
  //
  // The third of the four places the promise names — *"off the edge of the
  // shard, inside a hill, or inside something you built"* — and it is the one
  // the heightfield is MOST wrong about: `heightAt` answers a wall by naming
  // the top of it, four metres up, so a cadet standing in the middle of his own
  // closed room reads as "on solid ground, boots 55 cm below the surface"
  // to every test the old code and the old gate ran.
  //
  // The pieces go down through the real build verbs — the digit key that picks
  // a wall off the rack, and the mouse button that sets it — the same way a
  // fourteen-year-old shuts himself in by accident. The only thing handed over
  // is the lattice charge, through the same `wallet.earn` the island pays with
  // (tools/critic/pacing.mjs credits sixty days of income through it): a wall
  // costs nine motes and a cold player has four, so without it this test is a
  // test of the shop.
  {
    const release = async () => {
      for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD']) await page.keyboard.up(k).catch(() => {});
    };
    await release();
    await handBack();
    // Somewhere flat and open, so nothing but the walls can be blamed.
    await page.evaluate(() => {
      const a = window.__ascent;
      a.earn(120, 'vein');
      let best = null;
      for (let r = 6; r < 60; r += 6) {
        for (let b = 0; b < 12; b++) {
          const t = (b / 12) * Math.PI * 2;
          const x = Math.cos(t) * r, z = Math.sin(t) * r;
          const h = a.islandAt(x, z);
          if (h === null) continue;
          let flat = true;
          for (let k = 0; k < 4; k++) {
            const u = (k / 4) * Math.PI * 2;
            const g = a.islandAt(x + Math.cos(u) * 3, z + Math.sin(u) * 3);
            if (g === null || Math.abs(g - h) > 0.8) { flat = false; break; }
          }
          if (flat && !best) best = { x, z, h };
        }
      }
      if (best) { a.player.pos.set(best.x, best.h + 0.55, best.z); a.player.vel.set(0, 0, 0); }
    });
    await page.waitForTimeout(900);
    await handBack();
    await page.mouse.click(800, 450);
    await page.keyboard.press('Digit1');           // reach for a wall off the rack
    await page.waitForTimeout(300);
    await page.keyboard.press('KeyF');             // and draw the hand
    await page.waitForTimeout(300);

    // Four walls, one per quarter turn, placed with the real mouse button. The
    // yaw is turned rather than the mouse dragged because the school-laptop
    // section proves the lock is refusable and a wall must not depend on it.
    let placed = 0;
    for (let q = 0; q < 4; q++) {
      const was = await page.evaluate(() => window.__ascent.builder?.pieces?.size ?? 0);
      await page.evaluate(() => { window.__ascent.player.yaw += Math.PI / 2; });
      await page.waitForTimeout(360);
      await page.mouse.click(800, 450, { button: 'left' });
      await page.waitForTimeout(520);
      const now = await page.evaluate(() => window.__ascent.builder?.pieces?.size ?? 0);
      if (now > was) placed++;
    }
    await page.waitForTimeout(800);
    await handBack();
    const boxed = await look();
    // Shut in enough to matter: either the lattice is through him or through
    // the lens, or the frame is walls. Anything less is a fence, not a box.
    const wasIn = !!(boxed.inWall || boxed.camInWall || boxed.short > 0.40);
    if (placed >= 3 && wasIn) {
      await page.keyboard.press('KeyR');
      await page.waitForTimeout(1300);
      await handBack();
      const out = await look();
      const why = notFree(out);
      note(!why, 'Recover gets you out of a room you shut yourself into',
        why || `${placed} walls set; frame-is-wall ${boxed.short}->${out.short}, `
          + `lens in lattice ${boxed.camInWall}->${out.camInWall}, `
          + `open ${boxed.open}->${out.open}, boom ${out.boom}m`);
    } else {
      // A closed room arrives with a doorway in it on purpose (src/build), and
      // the builder shoves a cadet out of his own panels every frame — so four
      // walls not being a prison is a real outcome and not a skipped test. It
      // is reported as exactly what it is, and it never counts as evidence.
      note(true, 'four of the cadet\'s own walls do not shut him in',
        `${placed}/4 walls set; lens in lattice=${boxed.camInWall}, `
        + `frame-is-wall ${boxed.short}, open ${boxed.open} — `
        + 'nothing to escape from, so nothing was proved here');
    }
    // Leave no scenery behind for the steps after this one.
    await page.evaluate(() => { try { window.__ascent.builder.clearAll?.(); } catch {} });
    await handBack();
  }
}

// --- 6. A player who walks off the edge gets back ---------------------------
//
// THIS STEP EXISTS BECAUSE THE GAME LOST A SESSION TO IT.
//
// A cold critic followed the game's own "to your left" prompt, walked off the
// shard at a jog, and never came back: no fall-catch fired, the documented
// Recover key did nothing, and ninety seconds of movement, jumps, dash and
// glide only carried him further away. There *was* a fall-catch in the code —
// `pos.y < -180` — and it had never saved anybody, because it measured depth
// and the wing has no depth budget: two metres a second of sink against a
// hundred and ninety metres of fall is a minute and a half of beige void.
//
// So this step does not test the catch. It tests the promise: **leave the
// playable volume in any direction, by any means, and you are standing on
// solid ground again within a few seconds.** It presses keys to do it, because
// every previous round of this fix was verified through `window.__ascent` and
// every previous round of this fix was wrong.
//
// The glide is not optional here. Holding jump while falling is what a
// panicking player actually does, it is the exact input that defeated the old
// catch, and a version of this test that does not hold Space would have passed
// against the broken build.
//
// AND THE BAR IS NOW THE PROMISE RATHER THAN THE OLD BEHAVIOUR. It stood at six
// seconds, and the build passed it at 6.0 s and 5.99 s on the two runs that
// hold the jump button — which is not passing, it is winning a coin toss, and
// it flipped tails often enough to be known as "the flaky step". Six seconds is
// also simply the wrong promise: a child who walks off the edge of a shard
// should be standing on it again in about two, before they have time to wonder
// whether the game has ended.
//
// The catch was rebuilt to answer the real question — *is there anywhere left
// this cadet could land?* — instead of waiting for him to sink below the lowest
// ground on the island (src/player/terrain.js `reachFloor`). It now fires on
// geometry rather than on a sink rate, so the same fall costs the same time
// every run. Measured on this build: 0.84 s, 1.00 s, 1.68 s, 1.85 s, the last
// two under the wing. Three seconds is a bar with real headroom on a software
// rasteriser; it is not a bar this build can scrape past.
{
  const CATCH_S = 3;              // seconds allowed between leaving and landing
  const REACH_S = 45;             // seconds allowed to find the coast at all
  // …and the long stop. A cadet under the wing is flying, not lost — but a
  // player who has been over the gulf for twenty seconds with nothing under him
  // has stopped playing whatever the reach test says about it.
  const DRIFT_S = 20;

  const facts = () => page.evaluate(() => {
    const a = window.__ascent, p = a.player.pos;
    return {
      x: p.x, y: p.y, z: p.z,
      ground: a.islandAt(p.x, p.z),
      surface: a.surfaceAt(p.x, p.z),
      grounded: !!a.player.grounded,
      stuck: !!a.player.stuck,
      caught: a.player.caught | 0,
      recoveries: a.player.recoveries | 0,
      // THE PLAYABLE VOLUME, as the game itself defines it (src/player/terrain.js
      // `outsideWorld`): null while there is still somewhere this cadet could
      // put his boots down, a reason once there is not. Read-only.
      out: a.outside(p.x, p.y, p.z),
      gliding: !!a.player.gliding,
      ui: !!a.input.uiOpen || !!a.panel?.open,
    };
  });
  // Solid ground means the heightfield answers under your boots and your boots
  // are on it — not "the fall stopped", which is also true of being wedged in
  // a rock face at two hundred metres out.
  const onSolid = (f) => (f.ground !== null || f.surface !== null)
    && f.grounded && Math.abs(f.y - (f.surface ?? f.ground)) < 3;
  // Hand the frame back the way a player does, whatever took it.
  const handBack = async () => {
    for (let i = 0; i < 5; i++) {
      if (!(await page.evaluate(() => !!window.__ascent.input.uiOpen))) return;
      await page.keyboard.press('Escape');
      await page.waitForTimeout(420);
    }
  };
  const release = async () => {
    for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft']) {
      await page.keyboard.up(k).catch(() => {});
    }
  };

  // A fresh cold player, standing where every cold player starts. The walk to
  // the rift above ends wherever it ends, and the coast a hundred metres past
  // that is not the coast the reported failure happened on — the report is
  // specifically about following the game's own prompt out of the landing site.
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
  await page.waitForTimeout(4500);
  await page.mouse.click(800, 450);

  // Bearings out of the plaza. Pointer lock is regularly refused to a headless
  // browser, so the camera cannot be turned with the mouse — and this step used
  // to rely on the yaw simply staying where the arrival put it, so that five
  // key combinations under one fixed heading were five different directions off
  // the shard.
  //
  // THAT ASSUMPTION IS NO LONGER TRUE, AND IT FAILED SILENTLY. Recover now
  // turns the cadet to face the open world — that is half of the fix for
  // *"R moved me but jammed the camera into my own avatar's shoulder"*, because
  // the lens sits behind him and a recovery that lands him with his back to a
  // boulder has put the boom inside the boulder. Every run below begins with a
  // Recover, so all five runs inherited one heading and walked the same way,
  // and the step reported "never left the world in any direction" — which is a
  // gate that has proved nothing, exactly the failure mode it guards against.
  //
  // So the heading is now SET per run, the way turning the camera would set it,
  // and the walking is still nothing but keys.
  //
  // AND THE FIVE HEADINGS ARE CHOSEN, NOT NAMED. Four compass points out of the
  // plaza sent the cadet into a hillside four times out of five: five wedges,
  // no falls, and a step that once again proved nothing. A player who means to
  // walk off the edge does not pick a bearing at random — he looks, and walks
  // at the sky. So the bearings are the ones that actually reach open air, read
  // off the heightfield: every fifth of a circle is marched out to the
  // coastline, the climb it costs is measured, and the five cheapest walks that
  // genuinely end over the gulf are the five runs. Nothing about the walk
  // itself is assisted — it is still W, held, at a sprint.
  const bearings = await page.evaluate(() => {
    const a = window.__ascent, p = a.player.pos;
    const out = [];
    for (let i = 0; i < 72; i++) {
      const th = (i / 72) * Math.PI * 2;
      const dx = Math.sin(th), dz = Math.cos(th);
      let rise = 0, air = 0, y0 = a.islandAt(p.x, p.z) ?? p.y;
      for (let s = 4; s <= 260; s += 4) {
        const h = a.islandAt(p.x + dx * s, p.z + dz * s);
        if (h === null) { air = s; break; }
        rise = Math.max(rise, h - y0);
      }
      if (air) out.push({ yaw: th, rise: +rise.toFixed(1), air });
    }
    out.sort((q, r) => q.rise - r.rise);
    // Spread them out: five walks down the same valley is one walk.
    const picked = [];
    for (const c of out) {
      if (picked.every((q) => Math.abs(((c.yaw - q.yaw + Math.PI * 3) % (Math.PI * 2)) - Math.PI) > 0.9)) {
        picked.push(c);
      }
      if (picked.length >= 5) break;
    }
    return picked;
  });
  const runs = bearings.map((b, i) => ({
    keys: ['KeyW'], yaw: b.yaw, glide: i % 2 === 0,
    label: `bearing ${((b.yaw * 180) / Math.PI + 360) % 360 | 0}° (climbs ${b.rise}m, `
      + `open air at ${b.air}m)`,
  }));
  console.log(`  ..    five walks off this shard: ${runs.map((r) => r.label).join('; ')}`);

  let left = 0, saved = 0, wedges = 0, lost = null;
  // The margin, in seconds, printed on the pass. A gate that says "ok" over a
  // number nobody can see is how this step stayed marginal for so long.
  const took = [];
  // …and the same falls timed from the point of no return, which is the bar.
  const doomTook = [];
  for (const run of runs) {
    await release();
    await handBack();
    // Start each attempt from solid ground, using the game's own verb.
    await page.keyboard.press('KeyR');
    await page.waitForTimeout(1000);
    // …and then look the way this run is going, which is what a mouse would do
    // on a machine that granted the lock. See the note above the run list.
    await page.evaluate((y) => { window.__ascent.player.yaw = y; }, run.yaw);
    await page.waitForTimeout(250);
    await page.mouse.click(800, 450);

    await page.keyboard.down('ShiftLeft');
    for (const k of run.keys) await page.keyboard.down(k);

    let off = false, offAt = 0, back = false, wedged = false;
    // Seconds spent past the point of no return, accumulated the way the catch
    // itself accumulates them — see the note at the test below.
    //
    // ---- `lastEl` IS NOT ZERO. IT IS THE MOMENT HE LEFT. -------------------
    //
    // THIS INSTRUMENT CERTIFIED A DEFECT THAT DOES NOT EXIST, WHICH IS THE SAME
    // SIN AS CERTIFYING A BUILD THAT IS BROKEN, AND IT IS THE FIFTH TIME THIS
    // STEP HAS MEASURED THE WRONG QUANTITY.
    //
    // `lastEl` was initialised to 0 and then written **only** at the bottom of
    // the fall branch — which is below `if (!off) … continue`. So on the first
    // poll after the cadet leaves the shard, `step = el - 0` is the WHOLE RUN:
    // the recover, the turn, and every second of the walk out to the coast. If
    // `out` is already truthy on that frame — and it is, every time a cadet runs
    // off a twenty-five-metre lip, because `reachFloor` is measured from the pad
    // he just left plus six metres of turn margin — the entire walk was charged
    // to the fall, in one lump, on the cadet's first frame in the air.
    //
    // The reported failures read "25.4s / 39.3s / 26.5s past the point of no
    // return … y=23 / 24, 178–180 m out, caught=0". Those numbers are the walk
    // durations, the altitudes are the coastline (last ground on 265° is y=20.1
    // at r=171; on 320°, y=25.7 at r=175.5), and `caught=0` is correct because
    // the frame in question is eighty milliseconds into a fall the catch answers
    // at nine tenths of a second. Nobody was hovering. The arithmetic is
    // self-refuting on its own terms: `doomT` is tested against `CATCH_S` on
    // every iteration, so it can exceed 3 by at most one poll — 0.08 s of it.
    // A printed 25.4 was never reachable by accumulation and could only ever
    // have come from this initialisation.
    //
    // THE ASSERTION IS NOT WEAKENED BY THIS. The bar is still three seconds
    // between the game saying you cannot get back and your boots being on
    // ground, still accumulated rather than latched, still reset only by the
    // catch's own counter. The clock now simply starts when he leaves instead
    // of when the run does.
    let doomT = 0, lastEl = 0;
    let lastCaught = (await facts()).caught;
    const t0 = Date.now();
    while ((Date.now() - t0) / 1000 < REACH_S + CATCH_S + 4) {
      // 80 ms, not 250: at a three second bar a quarter-second poll is eight
      // per cent of the budget spent measuring rather than playing.
      await page.waitForTimeout(80);
      const el = (Date.now() - t0) / 1000;
      const f = await facts();
      if (f.ui) {
        for (const k of run.keys) await page.keyboard.up(k);
        await handBack();
        await page.mouse.click(800, 450);
        for (const k of run.keys) await page.keyboard.down(k);
        continue;
      }
      if (!off) {
        // Wedged on the way there is the other half of the same promise: the
        // world has hold of you, and the documented key has to let go of you.
        if (f.stuck) {
          wedged = true; wedges++;
          // What a person does: stop pushing, read the prompt, press the key.
          // Keeping the stick buried in the hillside and pressing R walks the
          // cadet straight back into it, which is a true fact about hills and
          // says nothing about whether the key worked.
          for (const k of run.keys) await page.keyboard.up(k);
          await page.waitForTimeout(500);
          const b = await facts();
          await page.keyboard.press('KeyR');
          await page.waitForTimeout(1200);
          const g = await facts();
          if (!(g.recoveries > b.recoveries && !g.stuck && onSolid(g))) {
            lost = lost || `${run.label}: wedged, and R did not free the cadet `
              + `(recoveries ${b.recoveries}->${g.recoveries}, stuck=${g.stuck}, grounded=${g.grounded})`;
            break;
          }
          saved++;
          // …and "free" means what it means in 5c, asked on the frame the key
          // produced rather than at the end of a walk that carried on for
          // another forty seconds. Blaming Recover for the hillside the cadet
          // walked into a minute later is the same error in the other
          // direction, and it is just as much a lie about where the defect is.
          {
            const v = await recoveryVerdict(handBack);
            if (v.why) {
              lost = lost || `${run.label}: wedged, R moved him, and ${v.why}`
                + (v.note ? ` [${v.note}]` : '');
              break;
            }
          }
          // …AND THEN HE CARRIES ON WALKING. This used to `break` here, which
          // quietly turned every run that met a hillside into a run that never
          // reached the coast — five wedges, no falls, and the whole edge test
          // below skipped while the step reported a pass. Getting free is the
          // point of Recover; it is not the point of THIS run. So the heading
          // is picked up again and the walk continues, and only a cadet who
          // spends the entire budget wedging fails to reach open air.
          if (wedged && wedges > 8) break;
          await page.evaluate((y) => { window.__ascent.player.yaw = y; }, run.yaw);
          await page.waitForTimeout(200);
          await page.mouse.click(800, 450);
          for (const k of run.keys) await page.keyboard.down(k);
          continue;
        }
        if (f.ground === null && f.surface === null) {
          off = true; offAt = el; left++;
          // The doom clock starts here, not at t0. See the note where `lastEl`
          // is declared: without this line the first fall poll charges the
          // entire walk to the coast as time spent past the point of no return.
          lastEl = el;
          // …and now the input that broke the last three fixes.
          if (run.glide) await page.keyboard.down('Space');
        } else if (el > REACH_S) break;
        continue;
      }
      if (onSolid(f)) {
        back = true; saved++;
        took.push(el - offAt);
        doomTook.push(doomT);
        // The catch has just set him down. Ask the same question 5c asks, here,
        // on this frame: `onSolid` is the eighty-millisecond poll and it is the
        // very proxy this session exists to retire — a catch that puts a falling
        // cadet down inside the cliff he fell past satisfies it exactly.
        await release();
        const v = await recoveryVerdict(handBack);
        if (v.why) {
          lost = lost || `${run.label}: the catch put him down, and ${v.why}`
            + (v.note ? ` [${v.note}]` : '');
        }
        break;
      }
      // ---- WHEN THE THREE SECONDS START ---------------------------------
      //
      // They used to start at "the heightfield stopped answering", which is
      // the moment the cadet's boots leave the shard. That is right for a
      // cadet who walks off a nine-metre coast and wrong for one who steps
      // off a forty-five-metre one with the wing open — he is not lost, he is
      // FLYING, with four hundred metres of glide in hand, and the game says
      // so in the one place that is allowed to define it: `outsideWorld` is
      // null for exactly as long as there is somewhere left he could land
      // (src/player/terrain.js `reachFloor`). Failing that cadet at three
      // seconds is this gate committing the error it exists to prevent —
      // measuring a proxy (height lost) for the thing that matters (whether
      // he can still get back).
      //
      // So the clock starts when the GAME says he cannot get back, and the
      // promise it measures is the real one: from the moment nothing you can
      // press will save you, you are standing on solid ground three seconds
      // later. The long stop below still catches a cadet left to drift.
      //
      // AND IT IS ACCUMULATED, NOT LATCHED. `reachFloor` is cached for 180 ms
      // and six metres of travel, so on a cadet moving at fourteen metres a
      // second the answer arrives in steps and reads 'fell', null, 'fell',
      // null while he descends smoothly through it. A latch turns the first
      // flicker into a three-second sentence he may not deserve; a reset turns
      // the second into a fall that is never caught. The catch in the player
      // was rebuilt to decay this rather than reset it, and this measures it
      // the same way, for the same reason and with the same numbers.
      const step = el - lastEl;
      lastEl = el;
      // A CAUGHT FALL IS A KEPT PROMISE, AND THE CLOCK STARTS AGAIN.
      //
      // The run holds W for forty-five seconds, so a cadet set down sixteen
      // metres inland walks straight back off the same lip — three, four times.
      // Each of those is its own fall and each one is caught; adding their
      // seconds together and failing the build at three is measuring a session,
      // not a promise. The catch's own counter says when one ended.
      if (f.caught > lastCaught) { lastCaught = f.caught; doomT = 0; }
      if (f.out) doomT += step; else doomT = Math.max(0, doomT - step * 2);
      if (doomT > CATCH_S) {
        lost = lost || `${run.label}: ${doomT.toFixed(1)}s past the point of no `
          + `return (${f.out}) and still not down, at ${Math.hypot(f.x, f.z).toFixed(0)}m out, `
          + `y=${f.y.toFixed(0)}, gliding=${f.gliding}, caught=${f.caught}, `
          + `recoveries=${f.recoveries}, panel/ui=${f.ui}`;
        break;
      }
      if (el - offAt > DRIFT_S) {
        lost = lost || `${run.label}: ${(el - offAt).toFixed(1)}s off the shard and still `
          + `not down, at ${Math.hypot(f.x, f.z).toFixed(0)}m out, y=${f.y.toFixed(0)} `
          + `— a beige void with a wing in it is still a beige void`;
        break;
      }
    }
    if (off && !back && !lost) lost = `${run.label}: left the world and never came back`;
    if (!off && !wedged) console.log(`  ..    ${run.label} — never reached the edge in ${REACH_S}s`);
    await release();
    if (lost) break;
  }

  await shot('05-edge');
  // A GATE THAT PROVED NOTHING MUST NOT PASS. If no direction reached open air,
  // the assertion under it never ran, and reporting that as a pass is precisely
  // the shape of every false fix this defect has already survived.
  note(left >= 1, 'a cold player can actually walk off this shard',
    left >= 1 ? `${left} of ${runs.length} directions reach open air, ${wedges} wedge on the way`
      : 'never left the world in any direction — the test below proved nothing');
  const worst = took.length ? Math.max(...took) : 0;
  const worstDoom = doomTook.length ? Math.max(...doomTook) : 0;
  note(!lost && saved > 0, 'a player who walks off the edge gets back, and is free when he lands',
    lost || `${saved} recoveries (${left} falls, ${wedges} wedges), every one verified escaped`
      + (took.length ? `; slowest ${worstDoom.toFixed(2)}s of ${CATCH_S}s allowed past the `
        + `point of no return (${doomTook.map((x) => x.toFixed(2)).join(', ')}), `
        + `${worst.toFixed(2)}s of airtime at most (${took.map((x) => x.toFixed(2)).join(', ')})` : ''));
}

// --- 7. THE SCHOOL LAPTOP: the browser refuses the pointer lock -------------
//
// THIS SECTION EXISTS BECAUSE THE GAME WAS SILENTLY UNPLAYABLE IN IT.
//
// `requestPointerLock` is a request. An `<iframe>` embedded without
// `allow="pointer-lock"` — which is how an LMS embeds a game — refuses it. So
// does a managed Chromebook, and so does Chrome for about a second after a
// player presses Escape. When it was refused, this game had NO way to turn the
// camera at all: `mousemove` returned early, no key turned, no drag turned. A
// cold critic read "56 m TO YOUR LEFT" off the objective card for eight
// minutes with no input on the machine that could face him left, and the card
// went on printing "Look — MOUSE" the whole time.
//
// Everything below therefore runs in a context where the lock is refused
// exactly the way a browser refuses it: `pointerlockerror` on the document, and
// `pointerLockElement` null forever. Nothing here is allowed to use the mouse
// to aim. The cadet turns with the arrow keys, walks with W, and seals a rift.
{
  const ctx2 = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  await ctx2.addInitScript(() => {
    Element.prototype.requestPointerLock = function () {
      setTimeout(() => document.dispatchEvent(new Event('pointerlockerror')), 0);
      return Promise.reject(new DOMException('pointer lock is not allowed here', 'SecurityError'));
    };
    Object.defineProperty(document, 'pointerLockElement', { get: () => null, configurable: true });
  });
  const p2 = await ctx2.newPage();
  p2.on('pageerror', (e) => errors.push('[nolock] ' + e.message));
  p2.on('console', (m) => { if (m.type() === 'error') errors.push('[nolock] ' + m.text()); });

  await p2.goto(URL, { waitUntil: 'networkidle' });
  await p2.evaluate(() => { try { localStorage.clear(); } catch {} });
  await p2.reload({ waitUntil: 'networkidle' });
  await p2.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
  await p2.waitForTimeout(4500);

  const yaw = () => p2.evaluate(() => window.__ascent.player.yaw);
  const panelOpen = () => p2.evaluate(() => !!window.__ascent.panel?.open);

  // Take the frame back first. A game that opens on its orders card is holding
  // the cursor on purpose, and a click aimed at the world while a panel owns
  // the frame is not a request to lock the pointer — it is a misclick. The
  // player reads the card, presses its button, and *then* clicks the world.
  const handBack2 = async () => {
    for (let i = 0; i < 6; i++) {
      if (!(await p2.evaluate(() => !!window.__ascent.input.uiOpen))) return true;
      let hit = false;
      for (const sel of ['.sc-go', '.ses-charter button', '.ses-rest button', '.rf-x']) {
        const b = await p2.$(sel);
        if (b && await b.isVisible()) { await b.click().catch(() => {}); hit = true; break; }
      }
      if (!hit) await p2.keyboard.press('Escape');
      await p2.waitForTimeout(700);
    }
    return !(await p2.evaluate(() => !!window.__ascent.input.uiOpen));
  };
  const free = await handBack2();
  note(free, 'the frame can be handed back before the world is clicked',
    free ? '' : 'a panel still owned the frame after six attempts');

  // A player clicks the world. The browser says no.
  await p2.mouse.click(800, 450);
  await p2.waitForTimeout(1400);
  const mode = await p2.evaluate(() => ({
    locked: window.__ascent.input.locked,
    mode: window.__ascent.input.lookMode,
  }));
  note(mode.locked === false && mode.mode === 'blocked',
    'the game NOTICES that the pointer lock was refused',
    `locked=${mode.locked} lookMode=${mode.mode}`);

  // 7b. It says so, in words, on the card — and the card stops advertising a
  //     mouse that cannot look. Read as text, in whatever locale is running.
  const card = await p2.evaluate(() => {
    const fc = document.querySelector('#ui .fc');
    const note = document.querySelector('#ui .fc-note');
    const look = [...document.querySelectorAll('#ui .fc-rows li')]
      .find((li) => li.dataset.v === 'look');
    return {
      shown: !!fc?.classList.contains('show'),
      noted: !!note && !note.hidden && note.innerText.trim().length > 12,
      look: look?.querySelector('.fc-keys')?.innerText.trim() || '',
    };
  });
  // The look row must name at least two caps now (a key AND a drag), where
  // before it named one word: MOUSE.
  const honest = card.look.length > 0 && !/^(mouse|rat[oó]n|mysz)$/i.test(card.look.replace(/\s+/g, ''));
  note(card.shown && card.noted && honest,
    'the player is TOLD, and the card prints controls that actually work',
    `card shown=${card.shown} notice=${card.noted} look row="${card.look.replace(/\n/g, ' · ')}"`);

  // 7c. The arrow keys turn the camera. No mouse is touched.
  // (A story beat may have taken the frame while the notice was read; the
  //  arrows are correctly deaf behind a panel, so give the world back first.)
  await handBack2();
  const yA = await yaw();
  await p2.keyboard.down('ArrowLeft');
  await p2.waitForTimeout(2000);
  await p2.keyboard.up('ArrowLeft');
  await p2.waitForTimeout(250);
  const turnedKeys = Math.abs((await yaw()) - yA);
  // A full radian is a real change of bearing — 57°, enough to bring a marker
  // that was off the side of the frame into the middle of it. The bar is not
  // set at the engine's 2.6 rad/s because this harness renders on a software
  // rasteriser and the engine clamps dt at 50 ms, so game time runs slower than
  // wall time here in a way it never does on a machine with a graphics card.
  note(turnedKeys > 1.0, 'ARROW KEYS turn the view with no pointer lock',
    `${turnedKeys.toFixed(2)} rad held for 2s`);

  // 7d. …and so does a click-drag, which is what a hand tries first.
  const yB = await yaw();
  await p2.mouse.move(800, 450);
  await p2.mouse.down();
  await p2.mouse.move(300, 450, { steps: 16 });
  await p2.mouse.up();
  await p2.waitForTimeout(250);
  const turnedDrag = Math.abs((await yaw()) - yB);
  note(turnedDrag > 0.5, 'CLICK-DRAG turns the view with no pointer lock',
    `${turnedDrag.toFixed(2)} rad over 500px`);

  // 7e. THE WHOLE POINT: face a rift you were told about, reach it, seal it —
  //     on a machine where the mouse cannot aim.
  const target = await p2.evaluate(() => {
    const a = window.__ascent;
    const r = a.rifts?.list?.filter((x) => !x.locked) ?? [];
    const p = a.player.pos;
    let best = null, bd = 1e9;
    for (const x of r) {
      const d = Math.hypot(x.pos.x - p.x, x.pos.z - p.z);
      if (d < bd) { bd = d; best = x; }
    }
    return best ? { id: best.id, x: best.pos.x, z: best.pos.z, dist: bd } : null;
  });

  let arrived = false, opened2 = false;
  if (target) {
    let held = false;
    for (let i = 0; i < 240 && !arrived; i++) {
      // A story beat can take the frame mid-walk, and behind a panel the world
      // is correctly deaf to both the arrows and W. A player presses on through
      // it; so does this.
      if (await p2.evaluate(() => !!window.__ascent.input.uiOpen)) {
        if (held) { await p2.keyboard.up('KeyW'); held = false; }
        await handBack2();
        continue;
      }
      // …AND THE WORLD CAN GET HOLD OF HIM ON THE WAY, WITH THE ANSWER PRINTED
      // ON THE SCREEN.
      //
      // This step failed a build with the WEDGED card up, forty-four metres
      // short of the ring — a cadet pressed against a landmark, being told in
      // so many words *"Something has hold of you. Press Recover to get back
      // onto open ground"*, while the loop kept holding W into the rock for the
      // remaining two hundred iterations and then reported that a player
      // without a pointer lock cannot reach a rift. He can. He presses the key
      // the game is showing him, which is the same key step 5c proves works and
      // the same key step 6 already presses for exactly this reason.
      //
      // Walking into a hillside is a real defect and it has its own assertion,
      // eight steps above this one, where it is counted and where the escape is
      // verified frame by frame. It is not this step's question. Failing THIS
      // one on it measures which way the terrain happened to fall on the run,
      // and passes or fails the pointer-lock fallback on a coin toss.
      if (await p2.evaluate(() => !!window.__ascent.player.stuck)) {
        if (held) { await p2.keyboard.up('KeyW'); held = false; }
        await p2.waitForTimeout(400);
        await p2.keyboard.press('KeyR');
        await p2.waitForTimeout(1000);
        continue;
      }
      const err = await p2.evaluate((t) => {
        const a = window.__ascent, p = a.player.pos;
        const want = Math.atan2(t.x - p.x, t.z - p.z);
        let d = ((want - a.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
        if (d < -Math.PI) d += Math.PI * 2;
        return { d, dist: Math.hypot(t.x - p.x, t.z - p.z) };
      }, target);
      // Turn by HOLDING AN ARROW KEY, while still running — the whole point of
      // this section is that no mouse aiming happens anywhere in it, and a
      // player steers on the move rather than stopping to aim. W is never
      // released: letting go of it resets the acceleration curve and the cadet
      // never gets above a shuffle. (Same reasoning as the WASD walk above.)
      if (!held) { await p2.keyboard.down('KeyW'); held = true; }
      if (Math.abs(err.d) > 0.10) {
        const key = err.d > 0 ? 'ArrowLeft' : 'ArrowRight';
        const ms = Math.min(400, Math.max(50, Math.abs(err.d) / 2.6 * 1000));
        await p2.keyboard.down(key);
        await p2.waitForTimeout(ms);
        await p2.keyboard.up(key);
      } else {
        await p2.waitForTimeout(130);
      }
      opened2 = await panelOpen();
      if (err.dist < 5 || opened2) arrived = true;
    }
    if (held) await p2.keyboard.up('KeyW');
    if (!opened2) {
      for (const k of ['KeyE', 'Enter']) {
        await p2.keyboard.press(k);
        await p2.waitForTimeout(500);
        opened2 = await panelOpen();
        if (opened2) break;
      }
    }
  }
  await p2.screenshot({ path: path.join(OUT, '06-nolock-rift.png') });
  note(arrived && opened2,
    'with NO pointer lock, a player can turn, reach a rift and open it',
    target ? `${target.id}, ${target.dist.toFixed(0)}m away, arrows only` : 'no unlocked rift');

  // 7f. …and finish a piece of mathematics inside it. Reading the answer off
  //     the live item is reading a fact; every key that follows is pressed.
  let sealed = false;
  if (opened2) {
    const fact = await p2.evaluate(() => {
      const p = window.__ascent.panel;
      return p?.item ? { answer: String(p.item.answer) } : null;
    });
    // The proof an item was completed is the mastery record moving, not a
    // panel closing — a panel closes when a player gives up, too.
    const before = await p2.evaluate(() => JSON.stringify(window.__ascent.state().skills || {}));
    if (fact) {
      const opts = await p2.$$('.rf-opt, .rf-choice button, .rf-choices button');
      if (opts.length) {
        const want = fact.answer.replace(/\s+/g, '');
        let picked = null;
        for (const o of opts) {
          if ((await o.innerText()).replace(/\s+/g, '') === want) { picked = o; break; }
        }
        await (picked || opts[0]).click();
      } else {
        for (const ch of fact.answer) {
          if (ch === '-') await p2.keyboard.press('Minus');
          else if (ch === '/') await p2.keyboard.press('Slash');
          else if (ch === '.') await p2.keyboard.press('Period');
          else await p2.keyboard.press(ch);
          await p2.waitForTimeout(60);
        }
        await p2.keyboard.press('Enter');
      }
      await p2.waitForTimeout(1600);
      const after = await p2.evaluate(() => JSON.stringify(window.__ascent.state().skills || {}));
      sealed = after !== before;
    }
  }
  await p2.screenshot({ path: path.join(OUT, '07-nolock-item.png') });
  note(sealed, 'with NO pointer lock, a player can complete an item',
    sealed ? 'answered and registered' : 'the item never registered an attempt');

  await ctx2.close();
}

// --- 8. Console health ------------------------------------------------------
note(errors.length === 0, 'no console errors', errors.slice(0, 3).join(' | '));

const facts = await page.evaluate(() => {
  const a = window.__ascent;
  return { shards: a.state?.().shards, panelOpen: !!a.panel?.open, caught: a.player.caught | 0 };
});

const failed = steps.filter((s) => !s.ok);
await writeFile(path.join(OUT, 'coldplay.json'), JSON.stringify({ steps, facts, errors }, null, 2));

console.log(`\n${steps.length - failed.length}/${steps.length} passed  ->  ${OUT}`);
if (failed.length) {
  console.log('\nA stranger could NOT start playing. Blocking failures:');
  failed.forEach((f) => console.log('  - ' + f.label + (f.detail ? ` (${f.detail})` : '')));
}
await browser.close();
process.exit(failed.length ? 1 : 0);
