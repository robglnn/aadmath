/**
 * Does what you build actually hold you up?
 *
 * This drives the real game with real key presses and reads the real player
 * position — no mocks, no engine internals beyond the same `window.__ascent`
 * surface a critic uses. It answers four questions that a screenshot cannot:
 *
 *   1. a ramp you set is a ramp you can run up,
 *   2. a floor you set over open air is a bridge you can walk across,
 *   3. a wall you set stops you,
 *   4. a piece you clear stops being solid in the same frame.
 *
 *   node tools/build-probe.mjs --url http://127.0.0.1:4173
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/build-probe'));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
page.on('pageerror', (e) => logs.push(e.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(2200);
await page.evaluate(() => document.getElementById('boot')?.classList.add('gone'));

const results = [];
const ok = (name, pass, detail) => { results.push({ name, pass, detail }); console.log(`${pass ? 'PASS' : 'FAIL'}  ${name}  ${detail}`); };

const place = (opts) => page.evaluate((o) => {
  const a = window.__ascent;
  if (o.at) { a.player.pos.set(o.at[0], o.at[1], o.at[2]); a.player.vel.set(0, 0, 0); }
  if (o.yaw !== undefined) a.player.yaw = o.yaw;
  if (o.pitch !== undefined) a.player.pitch = o.pitch;
  if (o.slot !== undefined) { a.builder.setSlot(o.slot); a.input.slot = o.slot; }
  return a.build();
}, opts);

const state = () => page.evaluate(() => {
  const a = window.__ascent, p = a.player;
  const isl = a.islandAt(p.pos.x, p.pos.z);
  return {
    x: p.pos.x, y: p.pos.y, z: p.pos.z, grounded: p.grounded, speed: p.speed,
    // height above the island itself: the only honest measure of what the
    // lattice gave you, on ground that is nowhere flat
    agl: isl === null ? null : p.pos.y - isl,
  };
});

/** Hold a key and sample the cadet the whole way, so a run that climbs and
 *  then walks off the far end is not scored as a run that never climbed. */
async function walk(ms, key = 'KeyW') {
  await page.keyboard.down(key);
  const trace = [];
  const steps = Math.max(1, Math.round(ms / 90));
  for (let i = 0; i < steps; i++) {
    await page.waitForTimeout(90);
    trace.push(await state());
  }
  await page.keyboard.up(key);
  await page.waitForTimeout(200);
  trace.push(await state());
  trace.peakY = Math.max(...trace.map((s) => s.y));
  trace.peakAgl = Math.max(...trace.map((s) => s.agl ?? -99));
  trace.last = trace[trace.length - 1];
  return trace;
}

// ---------------------------------------------------------------- 1. ramp
await page.evaluate(() => { window.__ascent.builder.clearAll(); window.__ascent.builder.charge = 120; });
const start = await page.evaluate(() => {
  const a = window.__ascent;
  const g = a.player.groundAt(0, 24) ?? 12;
  a.player.pos.set(0, g + 0.2, 24); a.player.vel.set(0, 0, 0);
  a.player.yaw = 0; a.player.pitch = -0.05;
  return { y: g };
});
await page.waitForTimeout(400);
const r1 = await place({ slot: 1 });
await page.waitForTimeout(500);
const before = await state();
const climb = await walk(1500);
ok('ramp is climbable', climb.peakAgl > 3.0,
  `${climb.peakAgl.toFixed(2)} m above the island (placed ${r1.ok})`);
await page.screenshot({ path: path.join(OUT, 'probe-01-ramp.png') });

// The ramp rush, exactly as a hand does it: hold the button, hold forward, and
// let the repeat lay a flight of stairs under your own boots.
await page.evaluate(() => {
  const a = window.__ascent;
  a.builder.clearAll(); a.builder.charge = 120;
  const g = a.player.groundAt(0, 24) ?? 12;
  a.player.pos.set(0, g + 0.2, 24); a.player.vel.set(0, 0, 0);
  a.player.yaw = 0; a.player.pitch = -0.05;
});
await page.waitForTimeout(400);
await page.mouse.move(800, 450);
await page.mouse.down();
await page.keyboard.down('KeyW');
let peak = -99;
for (let i = 0; i < 50; i++) {
  await page.waitForTimeout(90);
  const s = await state();
  if (s.agl !== null) peak = Math.max(peak, s.agl);
}
await page.keyboard.up('KeyW');
await page.mouse.up();
const built = await page.evaluate(() => window.__ascent.builder.solids.count);
ok('a held button rushes a staircase', peak > 11,
  `${built} ramps, ${peak.toFixed(2)} m above the island`);
await page.screenshot({ path: path.join(OUT, 'probe-02-chain.png') });

// ---------------------------------------------------------------- 2. floor
const deck = await page.evaluate(() => {
  const a = window.__ascent;
  a.builder.charge = 120; a.builder.setSlot(2); a.input.slot = 2;
  const y0 = a.player.pos.y;
  return { ok: a.build().ok, y0 };
});
await page.waitForTimeout(400);
const onDeck = await walk(650);
ok('a deck bridges out from where you stand',
  onDeck.last.grounded && onDeck.last.agl > 5,
  `y ${deck.y0.toFixed(2)} -> ${onDeck.last.y.toFixed(2)}, ${onDeck.last.agl.toFixed(1)} m above the island, grounded ${onDeck.last.grounded}`);
await page.screenshot({ path: path.join(OUT, 'probe-03-deck.png') });

// ---------------------------------------------------------------- 3. wall
await page.evaluate(() => {
  const a = window.__ascent;
  a.builder.clearAll(); a.builder.charge = 120;
  const g = a.player.groundAt(0, 24) ?? 12;
  a.player.pos.set(0, g + 0.2, 24); a.player.vel.set(0, 0, 0);
  a.player.yaw = 0; a.player.pitch = -0.05;
  a.builder.setSlot(0); a.input.slot = 0;
});
await page.waitForTimeout(400);
const w1 = await page.evaluate(() => window.__ascent.build());
await page.waitForTimeout(420);
const beforeWall = await state();
const run = await walk(1800);
const travelled = Math.hypot(run.last.x - beforeWall.x, run.last.z - beforeWall.z);
ok('a wall stops you', w1.ok && travelled < 5.4, `travelled ${travelled.toFixed(2)} m into it`);
await page.screenshot({ path: path.join(OUT, 'probe-04-wall.png') });

// ---------------------------------------------------------------- 4. clear
const cleared = await page.evaluate(() => {
  const a = window.__ascent;
  const piece = a.builder.lattice.live.wall.filter((q) => !q.dead).pop();
  const wasSolid = a.surfaceAt(piece.x, piece.z);
  a.builder.remove(piece);
  return { wasSolid, nowSolid: a.surfaceAt(piece.x, piece.z), count: a.builder.solids.count };
});
ok('clearing removes the collision', cleared.wasSolid !== null && cleared.nowSolid === null,
  `${cleared.wasSolid} -> ${cleared.nowSolid}, ${cleared.count} left`);

// ---------------------------------------------------------------- 5. rift apparatus
const man = await page.evaluate(() => {
  const a = window.__ascent;
  const r = a.rifts.list[0];
  a.builder.clearAll();
  a.builder.charge = 120;
  a.player.pos.set(r.pos.x + 2, (a.player.groundAt(r.pos.x + 2, r.pos.z + 8) ?? r.pos.y) + 0.3, r.pos.z + 8);
  a.player.vel.set(0, 0, 0);
  a.player.yaw = Math.PI; a.player.pitch = -0.05;
  a.builder.setSlot(3); a.input.slot = 3;
  const res = a.build();
  return { placed: res.ok, apparatus: a.builder.man.items.length };
});
await page.waitForTimeout(700);
ok('a beam at a rift becomes a balance', man.placed && man.apparatus > 0,
  `${man.apparatus} apparatus attached`);
await page.screenshot({ path: path.join(OUT, 'probe-05-balance.png') });

console.log(`\nconsole errors: ${logs.length}`);
logs.slice(0, 8).forEach((l) => console.log('  ! ' + l.split('\n')[0]));
await browser.close();
process.exit(results.every((r) => r.pass) && !logs.length ? 0 : 3);
