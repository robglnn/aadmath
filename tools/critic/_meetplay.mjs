/**
 * THE MEET, PLAYED — real key events only.
 *
 * `window.__ascent` is READ for facts (where a plot is, where a cell is, what
 * the beam is holding) and is never used to make the game do anything at the
 * site. The only place it drives is the labelled SETUP block, which plays the
 * real scheduler forward to earn KITE TRIM — the kit rung MEET 2 is tiered
 * against — exactly as `tools/critic/_h6fly.mjs` does. Nothing about the
 * walking, the rail, the beam or the claim goes through it.
 *
 *   node tools/critic/_meetplay.mjs --url http://127.0.0.1:4733 --out shots/meet
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4733');
const OUT = path.resolve(arg('out', 'shots/meet'));
const ONLY = arg('only', '');
const W = 1600, H = 900;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-unsafe-swiftshader'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1.5 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });
const log = [];
const say = (s) => { console.log(s); log.push(String(s)); };
const shot = async (n) => { await page.screenshot({ path: path.join(OUT, `${n}.png`) }); say(`  shot ${n}`); };

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch { /* private */ } });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
await page.waitForTimeout(4200);

// --------------------------------------------------------------- key driving
let downNow = new Set();
async function hold(keys) {
  const want = new Set(keys);
  for (const k of downNow) if (!want.has(k)) await page.keyboard.up(k).catch(() => {});
  for (const k of want) if (!downNow.has(k)) await page.keyboard.down(k).catch(() => {});
  downNow = want;
}
const P = () => page.evaluate(() => {
  const p = window.__ascent.player.pos;
  return { x: p.x, y: p.y, z: p.z, g: !!window.__ascent.player.grounded };
});
const panelOpen = () => page.evaluate(() => !!window.__ascent.panelInfo?.().open);

async function clearFrame(tries = 8) {
  const CARDS = ['.fdy.show .fdy-close', '.ses-charter.show .sc-go', '.ses-close.show .sx-rest',
    '.ses-rest.show .sr-skip', '.ses-rest.show .sr-off', '.meta-rite.show .rite-go'];
  for (let i = 0; i < tries; i++) {
    for (const sel of CARDS) {
      const b = page.locator(sel).first();
      if (!(await b.count())) continue;
      if (!(await b.isVisible().catch(() => false))) continue;
      if (await b.click({ timeout: 1200 }).then(() => true).catch(() => false)) await page.waitForTimeout(420);
    }
    if (await panelOpen() || await page.evaluate(() => !!window.__ascent.input.uiOpen)) {
      await page.keyboard.press('Escape'); await page.waitForTimeout(350);
    }
    await page.evaluate(() => document.activeElement?.blur?.());
    const a = await P();
    await hold(['KeyW']); await page.waitForTimeout(500); await hold([]);
    const b = await P();
    if (Math.hypot(b.x - a.x, b.z - a.z) > 0.6) return true;
    await page.mouse.click(W / 2, H / 2); await page.waitForTimeout(260);
  }
  return false;
}
await clearFrame(10);
await page.mouse.click(W / 2, H / 2);

async function faceYaw(want) {
  for (let i = 0; i < 22; i++) {
    const d = await page.evaluate((w) => {
      let e = ((w - window.__ascent.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (e < -Math.PI) e += Math.PI * 2; return e;
    }, want);
    if (Math.abs(d) < 0.08) return true;
    const key = d > 0 ? 'ArrowLeft' : 'ArrowRight';
    await page.keyboard.down(key);
    await page.waitForTimeout(Math.min(320, Math.max(40, (Math.abs(d) / 2.6) * 1000)));
    await page.keyboard.up(key);
  }
  return false;
}
const bearingTo = (from, to) => Math.atan2(to.x - from.x, to.z - from.z);
const delta = (a, b) => { let d = ((b - a + Math.PI) % (Math.PI * 2)) - Math.PI; return d < -Math.PI ? d + Math.PI * 2 : d; };

let strafeSign = 1;
async function calibrate() {
  const a = await P();
  await hold(['KeyD']); await page.waitForTimeout(600); await hold([]);
  const b = await P();
  const yaw = await page.evaluate(() => window.__ascent.player.yaw);
  strafeSign = delta(yaw, Math.atan2(b.x - a.x, b.z - a.z)) > 0 ? 1 : -1;
  say(`  strafe calibrated: D is ${strafeSign > 0 ? 'clockwise' : 'anticlockwise'} of the look`);
}

await calibrate();

/** Move toward a world point WITHOUT turning the camera. */
async function driveTo(tx, tz, ms = 700) {
  const p = await P();
  const yaw = await page.evaluate(() => window.__ascent.player.yaw);
  const rel = delta(yaw, bearingTo(p, { x: tx, z: tz }));
  const keys = [];
  if (Math.cos(rel) > 0.3) keys.push('KeyW');
  else if (Math.cos(rel) < -0.3) keys.push('KeyS');
  const lat = Math.sin(rel) * strafeSign;
  if (lat > 0.3) keys.push('KeyD');
  else if (lat < -0.3) keys.push('KeyA');
  if (!keys.length) keys.push('KeyW');
  await hold(keys); await page.waitForTimeout(ms); await hold([]);
}

/** Walk to a world point on foot. Real keys, nothing else. */
async function walkTo(tx, tz, { near = 1.6, legs = 120, sprint = false, jump = 0 } = {}) {
  for (let leg = 0; leg < legs; leg++) {
    const p = await P();
    const d = Math.hypot(tx - p.x, tz - p.z);
    if (d < near) return true;
    await faceYaw(bearingTo(p, { x: tx, z: tz }));
    if (sprint && d > 14) await page.keyboard.down('ShiftLeft');
    await hold(['KeyW']);
    await page.waitForTimeout(d > 20 ? 520 : 190);
    await hold([]);
    if (sprint) await page.keyboard.up('ShiftLeft');
    if (jump && leg % jump === jump - 1) await page.keyboard.press('Space');
    if (await page.evaluate(() => !!window.__ascent.input.uiOpen)) await clearFrame(3);
  }
  return false;
}

/** Open the wing and fly at a plot. Real keys, arrows for the bank. */
async function glideTo(m, { at = -1, tag = '', air = false } = {}) {
  let p = await P();
  await faceYaw(bearingTo(p, m));
  if (!air) {
    await page.keyboard.down('ShiftLeft');
    await hold(['KeyW']); await page.waitForTimeout(1100);
    await page.keyboard.up('ShiftLeft');
  }
  await page.keyboard.down('Space');
  let ok = false;
  for (let i = 0; i < 400; i++) {
    const q = await P();
    const d = Math.hypot(m.x - q.x, m.z - q.z);
    if (d < 16 && q.g && Math.abs(q.y - m.y) < 3) { ok = true; break; }
    if (q.y < m.y - 40) break;
    const yaw = await page.evaluate(() => window.__ascent.player.yaw);
    const err = delta(yaw, bearingTo(q, m));
    // a light hand: every correction costs the wing speed, and a wing sawed
    // left and right the whole way down arrives nowhere
    if (Math.abs(err) > 0.3) {
      const key = err > 0 ? 'ArrowLeft' : 'ArrowRight';
      await page.keyboard.down(key); await page.waitForTimeout(40); await page.keyboard.up(key);
    } else await page.waitForTimeout(80);
    if (at >= 0 && i === at) await shot(tag);
  }
  await page.keyboard.up('Space'); await hold([]);
  p = await P();
  say(`  ${ok ? 'landed on' : 'MISSED'} ${m.key}: (${p.x.toFixed(1)}, ${p.z.toFixed(1)}) y ${p.y.toFixed(1)} — deck ${m.y}`);
  return ok;
}

/** Step off the rail onto the deck beside it — the claim, and the only one. */
async function stepOff(m, cell) {
  const off = offCell(m, cell[0], cell[1]);
  if (!off) { say('  no deck cell beside ' + JSON.stringify(cell)); return false; }
  const w = cellXZ(m, off[0], off[1]);
  for (let i = 0; i < 18; i++) {
    const p = await P();
    if (p.y - m.y < 0.4 && Math.hypot(w.x - p.x, w.z - p.z) < 2.2) return true;
    await faceYaw(bearingTo(p, w));
    await hold(['KeyW']); await page.waitForTimeout(170); await hold([]);
  }
  return false;
}

// --------------------------------------------------------------- plot facts
const meets = () => page.evaluate(() => window.__ascent.state().meets);
const site = async (key) => (await meets()).at.find((m) => m.key === key);
const cellXZ = (m, gx, gz) => ({
  x: m.origin.x + m.ex.x * gx + m.ez.x * gz,
  z: m.origin.z + m.ex.z * gx + m.ez.z * gz,
});
const onRibbon = (m, gx, gz) => m.ribbon.some((c) => c[0] === gx && c[1] === gz);
/** A cell beside this one that the rail does not hold — where you step off to. */
function offCell(m, gx, gz) {
  const cand = [[1, 0], [0, 1], [-1, 0], [0, -1], [1, 1], [-1, -1], [1, -1], [-1, 1]];
  for (const [dx, dz] of cand) {
    const ax = gx + dx, az = gz + dz;
    if (ax < 0 || az < 0 || ax >= m.plot || az >= m.plot) continue;
    if (onRibbon(m, ax, az)) continue;
    return [ax, az];
  }
  return null;
}

let m1 = await site('m1');
say(`MEET 1 at (${m1.x}, ${m1.z}) deck ${m1.y}  ${JSON.stringify(m1.eqA)} | ${JSON.stringify(m1.eqB)}  crossing ${JSON.stringify(m1.solution)}`);
say(`  rail readings ${JSON.stringify(m1.rail)}`);
say(`  ribbon ${m1.ribbon.length} cells`);

// -------------------------------------------------- 1 · run to the headland
if (!ONLY || ONLY === 'm1') {
  say('--- the launch: the walk-reachable headland at (74, 136), 70.6 m ---');
  await walkTo(40, 96, { sprint: true, near: 10, legs: 60, jump: 7 });
  await walkTo(62, 132, { sprint: true, near: 6, legs: 60, jump: 7 });
  await walkTo(74, 136, { sprint: true, near: 4, legs: 50, jump: 9 });
  let p = await P();
  say(`  standing at (${p.x.toFixed(0)}, ${p.z.toFixed(0)}) at ${p.y.toFixed(1)} m, grounded=${p.g}`);
  await faceYaw(bearingTo(p, m1));
  await shot('01-launch');

  // ---------------------------------------------- 2 · the flight, base wing
  say('--- the flight: base wing, cleared save, 48 m of gulf ---');
  const landed = await glideTo(m1, { at: 26, tag: '02-inbound' });
  say(`  on the deck = ${landed}`);
  await page.waitForTimeout(900);
  await shot('03-on-the-plot');

  // ------------------------------------------------- 3 · walk the rail
  say('--- the rail: walking the solution set of statement one ---');
  m1 = await site('m1');
  const ribbon = m1.ribbon;
  const rail = m1.rail;
  const sol = m1.solution;

  /** Get onto the rail: walk into it and let the boots pull up the metre. */
  async function ontoRail(m, gx, gz) {
    const w = cellXZ(m, gx, gz);
    for (let i = 0; i < 46; i++) {
      const p3 = await P();
      const d = Math.hypot(w.x - p3.x, w.z - p3.z);
      if (d < 1.5 && p3.y - m.y > 0.6) return true;
      await faceYaw(bearingTo(p3, w));
      await hold(['KeyW']); await page.waitForTimeout(d > 8 ? 340 : 150); await hold([]);
    }
    return false;
  }
  const read = async (k) => page.evaluate((kk) => {
    const m = window.__ascent.state().meets.at.find((x) => x.key === kk);
    return { stood: m.stood, left: m.left, right: m.right, roll: m.roll,
      spent: m.spent.length, chain: m.chain, arm: m.arm, opened: m.opened,
      walked: m.walked.length, road: m.road };
  }, k);
  /** Walk ALONG the rail to a cell, cell by cell, reading the beam. */
  async function railTo(m, target, { quiet = false, level = false } = {}) {
    void level;
    const i0 = ribbon.findIndex(async () => false);
    void i0;
    const here = await read(m.key);
    let from = here.stood ? ribbon.findIndex((c) => c[0] === here.stood[0] && c[1] === here.stood[1]) : -1;
    const to = ribbon.findIndex((c) => c[0] === target[0] && c[1] === target[1]);
    if (to < 0) return false;
    if (from < 0) { await ontoRail(m, ribbon[0][0], ribbon[0][1]); from = 0; }
    const step = to >= from ? 1 : -1;
    for (let i = from; i !== to + step; i += step) {
      const cell = ribbon[i];
      const w = cellXZ(m, cell[0], cell[1]);
      for (let k = 0; k < 16; k++) {
        const p5 = await P();
        if (Math.hypot(w.x - p5.x, w.z - p5.z) < 1.5 && p5.y - m.y > 0.6) break;
        await faceYaw(bearingTo(p5, w));
        await hold(['KeyW']); await page.waitForTimeout(150); await hold([]);
      }
      await page.waitForTimeout(340);
      const r = await read(m.key);
      if (!quiet && r.stood) {
        say(`   at ${JSON.stringify(r.stood)}  pans ${r.left} against ${r.right}  beam ${(r.roll * 57.3).toFixed(1)} deg  armed ${r.chain}/${r.arm}`);
      }
    }
    return true;
  }
  const lookAtBalance = async (m) => {
    const p = await P();
    await faceYaw(bearingTo(p, cellXZ(m, (m.plot - 1) / 2, m.plot + 3)));
  };

  say(`  onto the rail at ${JSON.stringify(ribbon[0])}`);
  await ontoRail(m1, ribbon[0][0], ribbon[0][1]);
  await page.waitForTimeout(800);
  const a = await read('m1');
  say('  ' + JSON.stringify(a));
  await lookAtBalance(m1);
  await page.waitForTimeout(600);
  await shot('04-rail-one-way');

  say('  walking the rail, reading the beam at every cell');
  await railTo(m1, m1.solution, { level: true });
  await lookAtBalance(m1);
  await page.waitForTimeout(1400);
  say('  ON THE CROSSING: ' + JSON.stringify(await read('m1')));
  await shot('05-rail-level');
  await railTo(m1, ribbon[ribbon.length - 1]);
  await lookAtBalance(m1);
  await page.waitForTimeout(700);
  await shot('06-rail-other-way');
  const b = await read('m1');
  say(`  BOTH SIGNS: ${(a.roll * 57.3).toFixed(1)} deg at one end, ${(b.roll * 57.3).toFixed(1)} deg at the other`);
  say(`  claims made while walking the whole rail end to end: ${b.spent}`);

  // --------------------------------------- 4 · a WRONG answer, on purpose
  const wrong = rail.find((c) => Math.abs(c[0] - sol[0]) >= 3) || rail[0];
  say(`--- a wrong answer: walking back and stepping off at ${JSON.stringify(wrong)} ---`);
  await railTo(m1, wrong, { quiet: true });
  await page.waitForTimeout(500);
  say('  standing on it: ' + JSON.stringify(await read('m1')));
  await lookAtBalance(m1);            // frame the balance FIRST
  {
    const off = offCell(m1, wrong[0], wrong[1]);
    const w = cellXZ(m1, off[0], off[1]);
    for (let i = 0; i < 10; i++) {
      const p = await P();
      if (p.y - m1.y < 0.4) break;
      await driveTo(w.x, w.z, 220);
    }
  }
  await page.waitForTimeout(500);      // inside HOLD: the refused reading, held
  await shot('07-wrong-answer');
  say('  ' + JSON.stringify(await read('m1')));

  // -------------------------------------------------- 5 · the right answer
  say(`--- the crossing: walking back to ${JSON.stringify(sol)} and stepping off ---`);
  await page.waitForTimeout(2000);
  await ontoRail(m1, wrong[0], wrong[1]);
  await railTo(m1, sol, { quiet: true });
  await page.waitForTimeout(600);
  say('  standing on it: ' + JSON.stringify(await read('m1')));
  await lookAtBalance(m1);
  await page.waitForTimeout(400);
  await shot('08-standing-on-the-crossing');
  await lookAtBalance(m1);
  {
    const off = offCell(m1, sol[0], sol[1]);
    const w = cellXZ(m1, off[0], off[1]);
    for (let i = 0; i < 10; i++) {
      const p = await P();
      if (p.y - m1.y < 0.4) break;
      await driveTo(w.x, w.z, 220);
    }
  }
  await page.waitForTimeout(1500);
  await shot('09-sealed');
  say('  ' + JSON.stringify(await read('m1')));
  await page.waitForTimeout(3800);
  await lookAtBalance(m1);
  await shot('10-the-road');
  const after = await site('m1');
  say(`  after: opened=${after.opened} road plates=${after.road}`);
}

// ---------------------------------------------------------------- MEET 2
if (!ONLY || ONLY === 'm2') {
  say('--- SETUP ONLY: five real days of the real scheduler, to earn KITE TRIM ---');
  for (const d of [1, 2, 3, 4]) {
    await page.evaluate(async () => {
      const A = window.__ascent;
      for (let i = 0; i < 70; i++) {
        const o = A.nextObjective(); if (!o) break;
        if (!A.openRiftById(o.id)) break;
        const info = A.panelInfo(); if (!info.open) break;
        A.enter(info.answer);
        await new Promise((r) => setTimeout(r, 22));
        try { A.panel.close?.(); } catch { /* closed already */ }
        await new Promise((r) => setTimeout(r, 14));
      }
    });
    await page.evaluate(() => window.__ascent.advanceDays(1));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
    await page.waitForTimeout(3600);
  }
  await clearFrame(10);
  const kit = await page.evaluate(() => window.__ascent.state().kit);
  say('  kit: ' + JSON.stringify(kit).slice(0, 300));

  const m2 = await site('m2');
  const m1b = await site('m1');
  say(`MEET 2 at (${m2.x}, ${m2.z}) deck ${m2.y}  ${JSON.stringify(m2.eqA)} | ${JSON.stringify(m2.eqB)}  kind=${m2.kind}`);
  say("--- the route the archipelago intends: MEET 1's own deck, and a flare ---");
  await walkTo(40, 96, { sprint: true, near: 10, legs: 60, jump: 7 });
  await walkTo(62, 132, { sprint: true, near: 6, legs: 60, jump: 7 });
  await walkTo(74, 136, { sprint: true, near: 4, legs: 50, jump: 9 });
  await glideTo(m1b);
  let p = await P();
  await shot('20-first-plot-as-a-launch');
  // F: a column of rising air under your own boots, bought with motes. A
  // player verb on a real key — the SITE still reads nothing but position.
  await page.keyboard.press('KeyF');
  let top = p.y;
  for (let i = 0; i < 90; i++) {
    await page.waitForTimeout(120);
    const q = await P();
    if (q.y > top) top = q.y;
    if (q.y > m2.y + 24) break;
  }
  p = await P();
  say(`  the flare carried us to ${p.y.toFixed(1)} m (peak ${top.toFixed(1)}) — MEET 2's deck is at ${m2.y}`);
  await shot('21-riding-the-flare');
  await glideTo(m2, { at: 26, tag: '21b-inbound', air: true });
  await page.waitForTimeout(900);
  await shot('22-on-the-second-plot');

  const read2 = async () => page.evaluate(() => {
    const m = window.__ascent.state().meets.at.find((x) => x.key === 'm2');
    return { stood: m.stood, left: m.left, right: m.right, roll: m.roll,
      walked: m.walked.length, chain: m.chain, arm: m.arm, opened: m.opened, road: m.road };
  });
  const look2 = async () => {
    const q = await P();
    await faceYaw(bearingTo(q, cellXZ(m2, (m2.plot - 1) / 2, m2.plot + 3)));
  };
  say('--- the walk with nothing at the end of it: every reading on the rail ---');
  const rib2 = m2.ribbon;
  for (const cell of rib2) {
    const w = cellXZ(m2, cell[0], cell[1]);
    for (let i = 0; i < 30; i++) {
      const p3 = await P();
      const d = Math.hypot(w.x - p3.x, w.z - p3.z);
      if (d < 1.5 && p3.y - m2.y > 0.6) break;
      await faceYaw(bearingTo(p3, w));
      await hold(['KeyW']); await page.waitForTimeout(d > 8 ? 330 : 150); await hold([]);
    }
    await page.waitForTimeout(340);
    const r = await read2();
    say(`   at ${JSON.stringify(r.stood)}  pans ${r.left} against ${r.right}  beam ${(r.roll * 57.3).toFixed(1)} deg  armed ${r.chain}/${r.arm}`);
    if (cell === rib2[Math.floor(rib2.length / 2)]) {
      await look2();
      await shot('23-the-beam-does-not-move');
    }
  }
  say('  walked the whole rail: ' + JSON.stringify(await read2()));
  const end = m2.rail[m2.rail.length - 1];
  await look2();
  {
    const off = offCell(m2, end[0], end[1]);
    const w = cellXZ(m2, off[0], off[1]);
    for (let i = 0; i < 10; i++) {
      const p = await P();
      if (p.y - m2.y < 0.4) break;
      await driveTo(w.x, w.z, 220);
    }
  }
  await page.waitForTimeout(1500);
  await shot('24-no-solution');
  say('  ' + JSON.stringify(await read2()));
  await page.waitForTimeout(3800);
  await look2();
  await shot('25-sealed-and-unpaid');
  // …and the image the whole site is for: stand at the end the roads leave by
  // and look out along them. Two statements that never meet, running away over
  // the sea beside each other, for ever.
  {
    const corner = cellXZ(m2, m2.rail[m2.rail.length - 1][0] - 1, m2.rail[m2.rail.length - 1][1] + 1);
    for (let i = 0; i < 30; i++) {
      const q = await P();
      if (Math.hypot(corner.x - q.x, corner.z - q.z) < 2.2) break;
      await faceYaw(bearingTo(q, corner));
      await hold(['KeyW']); await page.waitForTimeout(190); await hold([]);
    }
    const out = cellXZ(m2, m2.rail[m2.rail.length - 1][0] + 9, m2.rail[m2.rail.length - 1][1] - 9);
    const q = await P();
    await faceYaw(bearingTo(q, out));
    await page.waitForTimeout(700);
    await shot('26-two-rails-side-by-side');
  }
  const after2 = await site('m2');
  say(`  after: opened=${after2.opened} road plates=${after2.road}`);
}

say(`console errors: ${errors.length}`);
for (const e of errors.slice(0, 12)) say('  ' + e);
await writeFile(path.join(OUT, 'log.txt'), log.join('\n'));
await browser.close();
process.exit(errors.length ? 2 : 0);
