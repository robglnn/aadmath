/** Independent critic probe: earn, spend, ladder past seal 6. */
import { chromium } from 'playwright';

const URL = process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url') + 1] : 'http://127.0.0.1:4788';
const ITEMS = Number(process.env.ITEMS || 260);

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2500);

const st = () => page.evaluate(() => {
  const A = window.__ascent; const s = A.state();
  return { shards: s.shards, kit: A.kit.state(), drift: { ...A.drift.stats } };
});

// ---------------------------------------------------------------- 1. JOGGING
await page.evaluate(() => {
  const A = window.__ascent;
  A.player.pos.set(0, (A.islandAt(0, 30) ?? 8) + 1.2, 30);
  A.player.vel.set(0, 0, 0);
});
await page.mouse.click(640, 400);
await page.waitForTimeout(500);

async function jog(secs, arc) {
  const a = (await st()).shards;
  await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
  for (let i = 0; i < secs * 2; i++) {
    await page.evaluate((k) => {
      const A = window.__ascent; A.player.yaw = k; if (A.player.cam) A.player.cam.yaw = k;
    }, (i / (secs * 2)) * Math.PI * arc + 0.6);
    await page.waitForTimeout(500);
  }
  await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
  const b = (await st()).shards;
  return b - a;
}
const jog1 = await jog(60, 2.4);
const jog2 = await jog(60, 2.4);   // same route again: is a hillside farmable?

// ------------------------------------------------------------------ 2. CACHE
const cache = await page.evaluate(async () => {
  const A = window.__ascent;
  const c = A.caches.list.find((x) => !x.opened);
  if (!c) return null;
  const s0 = A.state().shards; const col0 = A.drift.columns.length;
  A.player.pos.set(c.x, c.y + 2, c.z); A.player.vel.set(0, 0, 0);
  const right = c.stones.find((s) => s.v === c.q.x);
  const p = new A.THREE.Vector3(); right.group.getWorldPosition(p);
  await new Promise((r) => setTimeout(r, 300));
  A.player.pos.set(p.x, p.y, p.z);
  await new Promise((r) => setTimeout(r, 900));
  return { opened: c.opened, gained: A.state().shards - s0, columns: A.drift.columns.length - col0, latex: c.q.latex };
});

// ------------------------------------------------------- 3. THE LEARNING LOOP
const log = [];
const landed = {};
let prevHeld = new Set((await st()).kit.held);
const tStart = Date.now();
let shardsAtLoopStart = (await st()).shards;

for (let i = 1; i <= ITEMS; i++) {
  const ok = await page.evaluate(async () => {
    const A = window.__ascent;
    try { A.panel.close(); } catch { /* */ }
    const task = A.nextObjective();
    if (!task) return null;
    const sid = task.id || task.skill;
    const opened = A.openRiftById(sid);
    if (!opened) return { skipped: sid || 'noskill' };
    await new Promise((r) => setTimeout(r, 60));
    if (!A.panel.open) return { skipped: sid || 'noskill' };
    const ans = A.panel.item.answer;
    const kind = A.panel.opts?.kind ?? null;
    A.enter(ans);
    await new Promise((r) => setTimeout(r, 120));
    A.kit.sync();
    const s = A.state();
    return { skill: sid, kind, shards: s.shards, kit: A.kit.state() };
  });
  if (!ok || ok.skipped || !ok.kit) { log.push({ i, skipped: ok?.skipped || 'none' }); continue; }
  const held = new Set(ok.kit.held);
  for (const h of held) if (!prevHeld.has(h)) landed[h] = { item: i, lines: ok.kit.lines, depth: ok.kit.depth, temper: ok.kit.temper };
  prevHeld = held;
  log.push({ i, skill: ok.skill, kind: ok.kind, shards: ok.shards, lines: ok.kit.lines, temper: ok.kit.temper, depth: ok.kit.depth, next: ok.kit.next });
}
const loopSecs = (Date.now() - tStart) / 1000;
const afterLoop = await st();

// --------------------------------------------------------------- 4. SPENDING
const spend = await page.evaluate(async () => {
  const A = window.__ascent;
  try { A.panel.close(); } catch { /* */ }
  const out = {};
  out.prices = A.kit.prices();
  out.before = A.state().shards;
  out.hasBeacon = A.kit.has('beacon');
  const col0 = A.drift.columns.length;
  A.player.pos.set(6, (A.islandAt(6, 24) ?? 8) + 1.2, 24);
  const okB = A.kit.beacon();
  out.beaconPlanted = okB; out.afterBeacon = A.state().shards;
  out.columnsGained = A.drift.columns.length - col0;
  const okF = A.kit.flare();
  out.flareLit = okF; out.afterFlare = A.state().shards;
  return out;
});

// what a full-priced spend costs in minutes of each earn route
console.log(JSON.stringify({
  errors,
  jog60_first: jog1, jog60_second_sameRoute: jog2,
  cache,
  loop: {
    items: ITEMS, seconds: Math.round(loopSecs),
    shardsEarned: afterLoop.shards - shardsAtLoopStart,
    finalLines: afterLoop.kit.lines, finalTemper: afterLoop.kit.temper, finalDepth: afterLoop.kit.depth,
    held: afterLoop.kit.held, next: afterLoop.kit.next,
  },
  landed,
  spend,
  trail: log.filter((r) => r.i % 10 === 0 || r.i <= 30),
}, null, 1));

await browser.close();
