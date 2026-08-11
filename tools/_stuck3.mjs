import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4321');
const OUT = arg('out', 'shots/stuck3');
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent);
await page.waitForTimeout(3500);
const R = {};
const shot = async (n, ms = 200) => { await page.waitForTimeout(ms); await page.screenshot({ path: `${OUT}/${n}.png` }); };
/** A screen point where the canvas is genuinely the top element. */
async function canvasPoint() {
  return page.evaluate(() => {
    for (const [x, y] of [[300, 240], [1350, 700], [200, 760], [1450, 300], [800, 200]]) {
      const el = document.elementFromPoint(x, y);
      // the same question the game asks: is this a control, or a pane of glass?
      if (el && window.__ascent.input.worldPointer({ target: el })) return [x, y];
    }
    return [300, 240];
  });
}
const st = () => page.evaluate(() => {
  const go = document.querySelector('.ses-charter.show .sc-go');
  if (go) go.click();                       // a player would; keeps the run moving
  const a = window.__ascent;
  return {
    stuck: a.player.stuck, prompt: !!document.querySelector('.fcs.show'),
    p: a.player.pos.toArray().map((n) => +n.toFixed(1)), sp: +a.player.speed.toFixed(2),
    ui: a.input.uiOpen,
  };
});

// ---- A. build a wall with real input, then walk into it ---------------------
const cp = await canvasPoint();
R.canvasPoint = cp;
await page.mouse.move(cp[0], cp[1]);
await page.mouse.click(cp[0], cp[1]);
await page.keyboard.press('Digit1');
await page.waitForTimeout(250);
R.handOut = await page.evaluate(() => window.__ascent.builder.handOut);
const o0 = await page.evaluate(() => window.__ascent.builder.solids.owned);
for (let i = 0; i < 6; i++) {
  await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up();
  await page.waitForTimeout(200);
}
R.wallPieces = (await page.evaluate(() => window.__ascent.builder.solids.owned)) - o0;
await shot('01-wall', 300);

// face the wall we just set, and shove
await page.evaluate(() => {
  const a = window.__ascent;
  const w = a.builder.lattice.live.wall.find((p) => !p.dead);
  if (w) a.player.yaw = Math.atan2(w.x - a.player.pos.x, w.z - a.player.pos.z);
});
await page.keyboard.down('KeyW');
const trace = [];
for (let i = 0; i < 24; i++) {
  await page.waitForTimeout(350);
  const s = await st(); trace.push(s);
  if (s.stuck) break;
}
R.wedgeTrace = trace.slice(-4);
R.wedged = trace.some((s) => s.stuck);
R.wedgePrompt = trace.some((s) => s.prompt);
await shot('02-wedged', 300);
await page.keyboard.up('KeyW');
await page.waitForTimeout(1200);
R.wedgePromptStillUp = await page.evaluate(() => !!document.querySelector('.fcs.show'));
if (R.wedged) {
  const p0 = await page.evaluate(() => window.__ascent.player.pos.toArray());
  await page.click('.fcs button');                 // the on-screen way out
  await page.waitForTimeout(900);
  const p1 = await page.evaluate(() => window.__ascent.player.pos.toArray());
  R.wedgeRecoverMoved = +Math.hypot(p1[0] - p0[0], p1[1] - p0[1], p1[2] - p0[2]).toFixed(1);
  R.wedgeCleared = await page.evaluate(() => !window.__ascent.player.stuck && !document.querySelector('.fcs.show'));
  await shot('03-recovered', 400);
}

// ---- B. off the island ------------------------------------------------------
await page.evaluate(() => {
  const a = window.__ascent;
  let dir = 0, best = -1;
  for (let i = 0; i < 64; i++) {
    const th = (i / 64) * Math.PI * 2;
    let r = 0;
    for (; r < 260; r += 5) if (a.islandAt(a.player.pos.x + Math.sin(th) * r, a.player.pos.z + Math.cos(th) * r) === null) break;
    if (best < 0 || r < best) { best = r; dir = th; }
  }
  a.player.yaw = dir;
});
await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
const t2 = [];
for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(320);
  const s = await st(); t2.push(s);
  if (s.stuck && s.prompt) break;
}
await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
R.voidTrace = t2.slice(-4);
R.voidStuck = t2.some((s) => s.stuck);
R.voidPrompt = t2.some((s) => s.prompt);
await shot('04-void', 200);
if (R.voidStuck) {
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(900);
  R.voidAfter = await st();
  R.voidOnGround = await page.evaluate(() => window.__ascent.islandAt(window.__ascent.player.pos.x, window.__ascent.player.pos.z) !== null);
  await shot('05-void-recovered', 400);
  const q0 = await page.evaluate(() => window.__ascent.player.pos.toArray());
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
  const q1 = await page.evaluate(() => window.__ascent.player.pos.toArray());
  R.movesAfterRecovery = +Math.hypot(q1[0] - q0[0], q1[2] - q0[2]).toFixed(1);
}

// ---- C. drive into real terrain, the way the critic did --------------------
await page.evaluate(() => {
  const a = window.__ascent;
  let best = null;
  for (let i = 0; i < 360; i++) {
    const th = (i / 360) * Math.PI * 2;
    for (let r = 12; r < 70; r += 4) {
      const x = a.player.pos.x + Math.sin(th) * r, z = a.player.pos.z + Math.cos(th) * r;
      const h = a.islandAt(x, z); if (h === null) continue;
      const g = h - (a.islandAt(a.player.pos.x, a.player.pos.z) ?? 0);
      if (!best || g / r > best.k) best = { th, k: g / r };
    }
  }
  if (best) a.player.yaw = best.th;
});
await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
const t3 = [];
for (let i = 0; i < 60; i++) {
  await page.waitForTimeout(330);
  const s = await st(); t3.push(s);
  if (s.stuck) break;
}
R.terrainStuck = t3.some((s) => s.stuck);
R.terrainTrace = t3.slice(-3);
await page.waitForTimeout(900);
R.terrainPrompt = await page.evaluate(() => !!document.querySelector('.fcs.show'));
await shot('06-terrain-wedge', 200);
await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
if (R.terrainStuck) {
  const a0 = await page.evaluate(() => window.__ascent.player.pos.toArray());
  await page.keyboard.press('KeyR');
  await page.waitForTimeout(900);
  const a1 = await page.evaluate(() => window.__ascent.player.pos.toArray());
  R.terrainRecoverMoved = +Math.hypot(a1[0] - a0[0], a1[1] - a0[1], a1[2] - a0[2]).toFixed(1);
  R.terrainCleared = await page.evaluate(() => !window.__ascent.player.stuck);
  await shot('07-terrain-recovered', 400);
  const c0 = await page.evaluate(() => window.__ascent.player.pos.toArray());
  await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
  const c1 = await page.evaluate(() => window.__ascent.player.pos.toArray());
  R.terrainMovesAfter = +Math.hypot(c1[0] - c0[0], c1[2] - c0[2]).toFixed(1);
}

R.console = errs;
console.log(JSON.stringify(R, null, 1));
await browser.close();
