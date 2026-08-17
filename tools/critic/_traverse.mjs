/**
 * TRAVERSAL PROBE — real keys, real mouse, no debug API for anything that is
 * being proved. The game is driven exactly the way a hand drives it: keydown,
 * keyup, mousemove, mousedown. `__ascent.player.loco` is only ever *read*.
 *
 *   node tools/critic/_traverse.mjs --url http://127.0.0.1:4487 --out shots/flow
 */
import { chromium } from 'playwright';
import { mkdirSync, writeFileSync } from 'node:fs';

const arg = (k, d) => {
  const i = process.argv.indexOf(k);
  return i > 0 ? process.argv[i + 1] : d;
};
const URL = arg('--url', 'http://127.0.0.1:5173');
const OUT = arg('--out', 'shots/traverse');
mkdirSync(OUT, { recursive: true });

const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 800 } });
const p = await ctx.newPage();
const errors = [];
p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
p.on('pageerror', (e) => errors.push(String(e)));
await p.addInitScript(() => { try { localStorage.clear(); } catch { /* private */ } });
await p.goto(URL, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await p.waitForTimeout(3000);

// Get to the run the way a player does: click the world, and if any card owns
// the screen, close it with the key the card itself prints.
for (let i = 0; i < 6; i++) {
  const open = await p.evaluate(() => !!window.__ascent.input?.uiOpen);
  if (!open) break;
  await p.keyboard.press('Escape');
  await p.waitForTimeout(500);
}
await p.mouse.click(640, 400);
await p.waitForTimeout(800);
if (await p.evaluate(() => !!window.__ascent.input?.uiOpen)) {
  await p.keyboard.press('Escape');
  await p.waitForTimeout(600);
}

const snap = () => p.evaluate(() => {
  const L = window.__ascent.player.loco;
  const P = window.__ascent.player;
  return {
    x: +L.pos.x.toFixed(2), y: +L.pos.y.toFixed(2), z: +L.pos.z.toFixed(2),
    vy: +L.vel.y.toFixed(2), speed: +L.speed.toFixed(2),
    flow: +(L.flow ?? 0).toFixed(2), state: L.state,
    glideSpeed: +(L.glideSpeed ?? 0).toFixed(2),
    fov: +window.__ascent.camera.fov.toFixed(1),
    grounded: L.grounded, stuck: !!P.stuck, fps: window.__ascent.state().fps,
  };
});

const shots = [];
let n = 0;
const shot = async (tag) => {
  const f = `${OUT}/${String(++n).padStart(2, '0')}-${tag}.png`;
  await p.screenshot({ path: f });
  shots.push(f);
};

const log = [];
const note = async (tag) => {
  const s = await snap();
  log.push({ tag, ...s });
  return s;
};

const down = (k) => p.keyboard.down(k);
const up = (k) => p.keyboard.up(k);
const wait = (ms) => p.waitForTimeout(ms);

// ---------------------------------------------------------------- 1. sprint
await note('rest');
await down('KeyW'); await down('ShiftLeft');
await wait(2600);
const sprintPeak = await note('sprint');
await shot('sprint');

// ---------------------------------------------------------------- 2. dash jump
// Dash, then jump one beat later: the dash must not eat the jump.
await p.keyboard.press('KeyC');
await wait(90);
await p.keyboard.press('Space');
await wait(120);
const dj = await note('dashjump');
await shot('dashjump');
let djPeakY = dj.y, djTop = dj.speed;
for (let i = 0; i < 12; i++) {
  await wait(60);
  const s = await note('dashjump-air');
  if (s.y > djPeakY) djPeakY = s.y;
  if (s.speed > djTop) djTop = s.speed;
}
await wait(900);

// ---------------------------------------------------------------- 3. build a ramp and run off it
await up('KeyW'); await up('ShiftLeft');
await wait(600);
// Pick the ramp off the rack (digit 2) and set a stair of them.
await p.keyboard.press('Digit2');
await wait(300);
await shot('ramp-ghost');
const rampFrames = [];
for (let i = 0; i < 4; i++) {
  await p.mouse.down();
  await wait(120);
  await p.mouse.up();
  await wait(180);
  await down('KeyW'); await wait(420); await up('KeyW');
  await wait(160);
  rampFrames.push(await note(`ramp-${i}`));
}
await shot('ramp-built');
const built = await p.evaluate(() => window.__ascent.builder?.placedCount ?? -1);

// back off, then sprint up it and off the head
await down('KeyS'); await wait(1400); await up('KeyS');
await wait(500);
const footY = (await note('ramp-foot')).y;
await down('KeyW'); await down('ShiftLeft');
let launchVy = -99, launchTop = 0, peakY = -999, onRampSpeed = 0;
for (let i = 0; i < 42; i++) {
  await wait(55);
  const s = await note('launch');
  if (!s.grounded && s.vy > launchVy) launchVy = s.vy;
  if (s.y > peakY) peakY = s.y;
  if (s.speed > launchTop) launchTop = s.speed;
  if (s.grounded && s.y > footY + 1 && s.speed > onRampSpeed) onRampSpeed = s.speed;
  if (i === 22) await shot('launch');
}
await shot('launch-air');
await up('ShiftLeft'); await up('KeyW');
await wait(1600);

// ---------------------------------------------------------------- 4. glide off a launch
await down('KeyW'); await down('ShiftLeft');
await wait(2200);
await p.keyboard.press('Space');       // jump
await wait(220);
await p.keyboard.press('Space');       // double jump
await wait(320);
await p.keyboard.press('Space');       // out of jumps: this press is the wing
await wait(700);
const g0 = await note('glide-open');
await shot('glide');
let glideTop = g0.glideSpeed;
for (let i = 0; i < 30; i++) {
  await wait(90);
  const s = await note('glide');
  if (s.glideSpeed > glideTop) glideTop = s.glideSpeed;
}
await shot('glide-late');
await up('ShiftLeft'); await up('KeyW');
await wait(2500);
const end = await note('end');
await shot('end');

const fps = await p.evaluate(() => window.__ascent.state().perf);

const summary = {
  errors: errors.slice(0, 8),
  sprintPeakSpeed: sprintPeak.speed,
  dashJump: { peakY: +djPeakY.toFixed(2), topSpeed: +djTop.toFixed(2), startY: +dj.y.toFixed(2) },
  rampsPlaced: built,
  launch: {
    peakVy: +launchVy.toFixed(2), peakY: +peakY.toFixed(2),
    topSpeed: +launchTop.toFixed(2), onRampSpeed: +onRampSpeed.toFixed(2),
    footY: +footY.toFixed(2),
  },
  glideTopSpeed: +glideTop.toFixed(2),
  maxFlow: Math.max(...log.map((l) => l.flow)),
  maxFov: Math.max(...log.map((l) => l.fov)),
  stuckEver: log.some((l) => l.stuck),
  endState: end,
  perf: fps,
  shots,
};
writeFileSync(`${OUT}/traverse.json`, JSON.stringify({ summary, log }, null, 1));
console.log(JSON.stringify(summary, null, 1));
await b.close();
if (errors.length) process.exit(1);
