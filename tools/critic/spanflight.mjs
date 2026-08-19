/**
 * THE SPAN FLIGHT — can a cadet actually GET to the archipelago, and solve one?
 *
 * Everything else that looks at src/world/span.js places a camera. This plays.
 * It is forbidden, exactly as tools/critic/coldplay.mjs is, from using
 * `window.__ascent` to make progress: it never sets a position, never opens a
 * site, never grants a capability. It reads the world to work out which way to
 * point — the same thing a player does with their eyes — and then presses keys.
 *
 * The run:
 *   1. from a cleared save, run to the launch ridge the first span is measured
 *      against, on foot, with W and Shift;
 *   2. jump off it and open the wing, and steer out over the gulf to the span;
 *   3. land on the deck, walk into a WRONG stack, and photograph the shortfall;
 *   4. walk into the true one, and photograph the ground going solid;
 *   5. photograph the road that is now standing where there was open air, and
 *      then WALK it — outbound to the second span, which no glide can reach.
 *
 *   node tools/critic/spanflight.mjs [--url http://127.0.0.1:5173] [--out dir]
 *
 * Exit 0 = the archipelago is reachable and solvable by hand.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/spanflight'));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('page: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

const steps = [];
const note = (ok, label, detail = '') => {
  steps.push({ ok, label, detail });
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ' — ' + detail : ''}`);
};
const shot = async (n, w = 700) => { await page.waitForTimeout(w); await page.screenshot({ path: path.join(OUT, `${n}.png`) }); };

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(3500);
await page.mouse.move(800, 450);
await page.mouse.click(800, 450);
await page.waitForTimeout(400);

// ---- read-only: where the world says these things are ----------------------
const world = await page.evaluate(() => {
  const A = window.__ascent;
  const s = A.spans.list.map((c) => ({ i: c.i, x: c.x, y: c.y, z: c.z, need: c.plot.length }));
  return { spans: s, road: A.spans.state().roadPlates };
});
console.log('spans:', JSON.stringify(world.spans));

// Deliberately light: this is read once per steering frame, and pulling the
// whole of `state()` through it made the loop slower than the game.
const at = () => page.evaluate(() => {
  const A = window.__ascent, p = A.player;
  return {
    x: p.pos.x, y: p.pos.y, z: p.pos.z,
    grounded: !!p.grounded, gliding: !!p.gliding,
  };
});

/**
 * STEERING, WITH THE ARROW KEYS.
 *
 * Headless Chromium refuses pointer lock, so `mouse.move` turns nothing at all:
 * the first run of this harness walked due north in a dead straight line for two
 * minutes and reported that the island was unclimbable. The game already knows
 * about this — it detects the refusal and offers ARROWS · DRAG, and
 * tools/critic/coldplay.mjs turns with arrows for exactly this reason. So does
 * this. Everything below is a key a player has.
 */
const yawErr = (tx, tz) => page.evaluate((t) => {
  const A = window.__ascent, q = A.player.pos;
  let e = ((Math.atan2(t.x - q.x, t.z - q.z) - A.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (e < -Math.PI) e += Math.PI * 2;
  return { e, x: q.x, y: q.y, z: q.z, grounded: !!A.player.grounded, gliding: !!A.player.gliding };
}, { x: tx, z: tz });

/** One correction: hold an arrow for as long as the error is worth. */
async function steer(e, cap = 320) {
  if (Math.abs(e) < 0.06) return;
  const key = e > 0 ? 'ArrowLeft' : 'ArrowRight';
  await page.keyboard.down(key);
  await page.waitForTimeout(Math.min(cap, Math.max(40, Math.abs(e) / 2.6 * 1000)));
  await page.keyboard.up(key);
}

async function face(tx, tz) {
  for (let i = 0; i < 16; i++) {
    const s = await yawErr(tx, tz);
    if (Math.abs(s.e) < 0.06) return true;
    await steer(s.e);
  }
  return false;
}

/** Run at a point on foot. Real keys, steering every frame or so. */
async function runTo(tx, tz, within, budgetMs) {
  const t0 = Date.now();
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyW');
  let best = 1e9, stall = 0, lastD = 1e9;
  while (Date.now() - t0 < budgetMs) {
    const s = await yawErr(tx, tz);
    const d = Math.hypot(tx - s.x, tz - s.z);
    best = Math.min(best, d);
    if (d < within) break;
    await steer(s.e, 220);
    // A JUMP IS FOR BEING STUCK, NOT FOR TRAVELLING. Jumping every frame keeps
    // the sprint curve at zero and, with jump held, opens the wing — the first
    // run of this harness crossed 17 m in two minutes and blamed the island.
    if (d > lastD - 0.35) stall++; else stall = 0;
    lastD = d;
    if (stall > 6 && s.grounded) { await page.keyboard.press('Space'); stall = 0; }
    await page.waitForTimeout(120);
  }
  await page.keyboard.up('KeyW');
  await page.keyboard.up('ShiftLeft');
  return best;
}

// ---- 1. THE RIDGE ----------------------------------------------------------
// The launch point is read off the world, not written into this file: it is the
// highest ground under the arc, which is what the span is measured against.
const ridge = await page.evaluate(() => {
  const A = window.__ascent;
  const c = A.spans.list[0];
  const ang = Math.atan2(c.z, c.x);
  let best = { x: 0, z: 0, h: -1e9 };
  for (let r = 128; r < 162; r += 4) {
    const x = Math.cos(ang) * r, z = Math.sin(ang) * r;
    const h = A.islandAt(x, z);
    if (h !== null && h > best.h) best = { x, z, h };
  }
  return best;
});
console.log('ridge:', JSON.stringify(ridge));

const gotRidge = await runTo(ridge.x, ridge.z, 9, 150000);
let p = await at();
note(gotRidge < 12, 'a cadet can run to the launch coast on foot',
  `closest ${gotRidge.toFixed(1)} m, standing at y=${p.y.toFixed(1)}`);
await shot('01-on-the-ridge');

// ---- 2. THE GLIDE ----------------------------------------------------------
const span0 = world.spans[0];
await face(span0.x, span0.z);
await shot('02-what-you-see-from-the-ridge');

// Run off the top, jump, and hold the wing open. Nothing here is bought: the
// wing a cadet lands with is the wing this flight uses.
await page.keyboard.down('KeyW');
await page.waitForTimeout(900);

// OPEN THE WING FIRST, AND ONLY THEN FLY IT. Folding the wing press into the
// steering loop meant it went in whenever the loop came round — sometimes after
// three hundred milliseconds of free fall, sometimes after a second — and the
// same flight arrived twelve metres over the deck or twelve metres under it
// from one run to the next. A player opens it as he leaves the edge.
for (let i = 0; i < 14; i++) {
  const s = await yawErr(span0.x, span0.z);
  if (s.gliding) break;
  if (!s.grounded) await page.keyboard.press('Space');
  await page.waitForTimeout(90);
}

let landed = false, minD = 1e9, glided = false, dive = false;
const gt0 = Date.now();
while (Date.now() - gt0 < 100000) {
  const s = await yawErr(span0.x, span0.z);
  if (s.gliding) glided = true;
  // THE WING IS A PRESS, NOT A HOLD. Jump, jump, and the third press — once the
  // jumps are spent — opens it. That is what the controls card says and it is
  // what a player does; the first run of this harness held the key instead and
  // fell seventy metres with the wing shut.
  if (!s.gliding && !s.grounded) await page.keyboard.press('Space');
  const d = Math.hypot(span0.x - s.x, span0.z - s.z);
  minD = Math.min(minD, d);
  if (s.grounded && Math.abs(s.y - span0.y) < 5 && d < 9) { landed = true; break; }
  // OVER THE DECK AND STILL ELEVEN METRES UP. A wing that holds two metres a
  // second of sink will circle a twenty-metre deck for ever. The game's own
  // answer is the dive — hold sprint and the canopy pitches over — so that is
  // what this does, exactly as a player lining up a landing would.
  // DIVE ONLY WHEN THERE IS HEIGHT TO SPEND. The dive is a forty-degree drop
  // and the wing's own sink is seven and a half degrees, so diving whenever the
  // deck is below you burns thirty-five metres over a forty-metre run and
  // arrives underneath it. Dive when the surplus is more than the glide will
  // spend getting there, and not before.
  const surplus = s.y - span0.y;
  // Dive LATE and dive CLOSED-LOOP. Opening the dive sixty metres out spent
  // fifty-five metres of height on a flight that only had twenty-five to give,
  // and arrived under the deck every time. The wing's own sink is about one
  // metre in seven and a half; dive only inside twenty-six metres, only while
  // there is more height in hand than the wing will spend getting there, and
  // stop the moment there is not.
  const diving = d < 44 && surplus > 0.13 * d + 5;
  if (diving && !dive) { await page.keyboard.down('ShiftLeft'); dive = true; }
  if (!diving && dive) { await page.keyboard.up('ShiftLeft'); dive = false; }
  // No wing-closing key here, deliberately. The dash DOES close the wing — and
  // it is a dash: twenty-five metres a second of it, straight off the far edge
  // of a twenty-metre deck. The cadet touched down and left again in the same
  // second, four runs running. The dive is the landing control; that is all.
  await steer(s.e, 170);
  // below the deck and still short: nothing more a wing can do
  if (s.y < span0.y - 26 && d > 20) break;
  await page.waitForTimeout(110);
}
await page.keyboard.up('KeyW');
if (dive) await page.keyboard.up('ShiftLeft');
// A touchdown is not a landing until it has held for a second: the first
// version called a frame's contact with the deck rail a landing and then
// photographed the cadet falling past it.
await page.waitForTimeout(1200);
p = await at();
landed = landed && p.grounded && Math.abs(p.y - span0.y) < 3;
note(glided && landed, 'and glide from it to the first span, with nothing bought',
  `wing opened=${glided}, closest ${minD.toFixed(1)} m, ended y=${p.y.toFixed(1)} vs deck ${span0.y}`);
await shot('03-standing-on-the-span');

// ---- 3. A WRONG STACK ------------------------------------------------------
// Which stack is which is read, not chosen: the harness has to walk into a
// named one to photograph what being wrong looks like.
const stacks = await page.evaluate(() => {
  const A = window.__ascent, c = A.spans.list[0];
  return c.stacks.map((s, k) => {
    const v = new A.THREE.Vector3();
    s.group.getWorldPosition(v);
    return { k, n: s.n, x: v.x, y: v.y, z: v.z, right: s.n === c.plot.length };
  });
});
const wrong = stacks.find((s) => !s.right && s.n < span0.need) || stacks.find((s) => !s.right);
const right = stacks.find((s) => s.right);

/**
 * Walk into a stack, on a twenty-metre deck with a hole in it.
 *
 * Holding W for sixteen seconds and steering as you go is how you cross an
 * island; on a deck it is how you run off the far edge at eight metres a second,
 * which is what the first version of this did — twelve metres from the target,
 * sixty metres past it, and falling. So this walks the way a person does in a
 * small room: aim first with the key released, then a step no longer than the
 * distance left, then look again.
 */
async function walkInto(s, budget = 20000) {
  const t0 = Date.now();
  while (Date.now() - t0 < budget) {
    const q = await yawErr(s.x, s.z);
    const d = Math.hypot(s.x - q.x, s.z - q.z);
    if (d < 1.2) return true;
    if (!q.grounded) return false;
    if (Math.abs(q.e) > 0.1) { await steer(q.e, 200); continue; }
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(Math.min(420, Math.max(70, d * 55)));
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(90);
  }
  return false;
}

console.log('stacks:', JSON.stringify(stacks));
console.log('standing:', JSON.stringify(await at()));
if (wrong) {
  await walkInto(wrong);
  console.log('after walk:', JSON.stringify(await at()), 'arm=',
    await page.evaluate(() => +(window.__ascent.spans.list[0].arm || 0).toFixed(2)));
  // Watch it, rather than glancing at it: the slabs go down, sit for a beat and
  // are taken back up again, and a single read half a second later can easily
  // land after the plot has already cleared itself.
  let short = { filled: 0, need: span0.need, opened: false };
  for (let i = 0; i < 22; i++) {
    const r = await page.evaluate(() => {
      const c = window.__ascent.spans.list[0];
      return { filled: c.filled | 0, need: c.plot.length, opened: !!c.opened };
    });
    if (r.filled > short.filled) short = r;
    if (r.opened) { short.opened = true; break; }
    await page.waitForTimeout(120);
  }
  note(!short.opened && short.filled === wrong.n && short.filled < short.need,
    'a wrong stack leaves the ground visibly short, and does not open it',
    `laid ${short.filled} of ${short.need}`);
  await shot('04-short-by-the-difference');
  await page.waitForTimeout(2400);
}

// ---- 4. THE TRUE STACK -----------------------------------------------------
await walkInto(right, 22000);
await page.waitForTimeout(900);
const after = await page.evaluate(() => window.__ascent.state().spans);
note(after.opened >= 1 && after.roadPlates > 0,
  'the true stack covers the ground exactly, and the span pays a road',
  `${after.opened} span(s) open, ${after.roadPlates} road plates standing`);
await shot('05-covered-and-open');

// ---- 5. THE ROAD -----------------------------------------------------------
const span1 = world.spans[1];
await shot('06-the-road-that-was-not-there');
// A ROAD IS FOUR METRES WIDE. Sprinting down it with the key held and steering
// as you go puts you off the side; a person walks a bridge in steps, looking up
// between them, which is what `walkInto` does and what this reuses.
// FOLLOW THE ROAD, DO NOT AIM THROUGH IT. A road is a thing you can see, and
// what a player does with one is put his feet on it and follow it round. Aiming
// straight at the far span instead walks off the side of every bend. The plate
// positions are read the way its shape is read — with the eyes — and then it is
// walked, plate by plate, on the keys.
const plates = await page.evaluate(() => window.__ascent.spans.road.map((r) => ({ x: r.x, y: r.y, z: r.z })));
let gotSpan1 = 1e9, stoodOn1 = false;
{
  const t0 = Date.now();
  while (Date.now() - t0 < 180000) {
    const q = await yawErr(span1.x, span1.z);
    const dq = Math.hypot(span1.x - q.x, span1.z - q.z);
    gotSpan1 = Math.min(gotSpan1, dq);
    // ARRIVING IS STANDING ON IT. Nearest-approach alone counts a cadet who
    // sailed past the deck and is on his way down as having got there.
    if (dq < 14 && q.grounded && Math.abs(q.y - span1.y) < 5) { stoodOn1 = true; break; }
    if (dq < 4) break;
    // the next plate along: the nearest one that is closer to the goal than we are
    const here = Math.hypot(span1.x - q.x, span1.z - q.z);
    let step = null, bestD = 1e9;
    for (const pl of plates) {
      const toGoal = Math.hypot(span1.x - pl.x, span1.z - pl.z);
      if (toGoal > here - 1.5) continue;
      const d = Math.hypot(pl.x - q.x, pl.z - q.z);
      if (d < bestD) { bestD = d; step = pl; }
    }
    const tgt = step || span1;
    const e = await yawErr(tgt.x, tgt.z);
    if (Math.abs(e.e) > 0.09) { await steer(e.e, 200); continue; }
    await page.keyboard.down('KeyW');
    await page.waitForTimeout(240);
    await page.keyboard.up('KeyW');
    await page.waitForTimeout(140);
    const r = await yawErr(span1.x, span1.z);
    if (!r.grounded) { await page.keyboard.press('Space'); await page.waitForTimeout(300); }
  }
}
p = await at();
// STANDING STILL IS THE TEST, not a frame that happened to agree. The walker
// samples between steps, so the one frame inside fourteen metres can easily be
// one where a boot is off the plate. Let him stop, and then look.
let arrived = stoodOn1;
for (let i = 0; i < 20 && !arrived; i++) {
  await page.waitForTimeout(300);
  p = await at();
  arrived = p.grounded && Math.hypot(span1.x - p.x, span1.z - p.z) < 15
    && Math.abs(p.y - span1.y) < 6;
}
note(arrived,
  'and the second span, which no glide from the coast reaches, is now WALKED to',
  `closest ${gotSpan1.toFixed(1)} m, standing at y=${p.y.toFixed(1)} vs deck ${span1.y}, grounded=${p.grounded}`);
await shot('07-walked-to-the-second-span');

note(errors.length === 0, 'no console errors', errors.slice(0, 4).join(' | '));

const pass = steps.filter((s) => s.ok).length;
console.log(`\n${pass}/${steps.length} passed  ->  ${OUT}`);
await browser.close();
process.exit(pass === steps.length ? 0 : 1);
