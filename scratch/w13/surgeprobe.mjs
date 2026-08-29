/**
 * DOES THE HAZARD STILL EXIST, AND DOES IT STILL BILL?
 *
 * The critic paid 15 motes "for the crime of wandering". Three things have to be
 * true now and this proves all three by playing:
 *   1. crossing the island past an open tear costs nothing at all;
 *   2. LOITERING inside a tear's field still throws pressure at you;
 *   3. and when it hits, the wallet does not move.
 *
 * The line is sealed by answering real items at a real rift — surges do not
 * start until one line is held — and then the cadet stands in the field and
 * waits, with the mote count sampled every 200 ms.
 */
import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto(arg('url', 'http://127.0.0.1:4996'), { waitUntil: 'networkidle' });
await p.evaluate(() => { try { localStorage.clear(); } catch {} });
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await p.waitForTimeout(4800);
await p.mouse.click(640, 360);
try { await p.waitForSelector('.sc-go', { timeout: 10000 }); await p.locator('.sc-go').click(); } catch {}
await p.waitForTimeout(800);
await p.mouse.click(640, 360);

const st = () => p.evaluate(() => {
  const a = window.__ascent, q = a.player.pos;
  const live = a.rifts.list.filter((r) => !r.locked && !r.mastered)
    .map((r) => ({ id: r.id, d: Math.hypot(q.x - r.foot.x, q.z - r.foot.z), x: r.foot.x, z: r.foot.z }))
    .sort((u, v) => u.d - v.d);
  return {
    x: q.x, y: q.y, z: q.z, open: !!a.panel.open,
    motes: a.wallet.count(), drift: { ...a.drift.stats },
    held: [...a.mastery.state.values()].filter((s) => s.mastered).length,
    live,
  };
});
const panelOpen = () => p.evaluate(() => !!window.__ascent.panel?.open);
const card = async () => { const c = await p.evaluate(() => window.__ascent.panelInfo()); return c && c.open ? c : null; };
async function answer(c) {
  if (c.mode === 'choice') {
    const bt = p.locator('.rf-reading'); const n = await bt.count(); let w = 0;
    for (let i = 0; i < n; i++) if (String(await bt.nth(i).getAttribute('data-value')) === String(c.answer)) { w = i; break; }
    if (n) await bt.nth(w).click({ timeout: 4000 }).catch(() => {});
  } else if (c.mode === 'keypad') {
    for (const ch of String(c.answer ?? '')) { if (ch === '-') await p.keyboard.press('Minus'); else await p.keyboard.press(ch); await p.waitForTimeout(30); }
    await p.keyboard.press('Enter');
  } else { await p.keyboard.press('Escape'); }
}
async function drag(dx) {
  const from = Math.max(80, Math.min(1200, 640 - dx / 2));
  await p.mouse.move(from, 360); await p.mouse.down({ button: 'right' });
  await p.mouse.move(from + dx, 360, { steps: 8 }); await p.mouse.up({ button: 'right' });
}
async function goto(tx, tz, budget, stopAt = 5) {
  const t0 = Date.now();
  await p.keyboard.down('ShiftLeft'); await p.keyboard.down('KeyW');
  while (Date.now() - t0 < budget) {
    if (await panelOpen()) break;
    const e = await p.evaluate(([x, z]) => {
      const a = window.__ascent, q = a.player.pos;
      let d = ((Math.atan2(x - q.x, z - q.z) - a.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (d < -Math.PI) d += Math.PI * 2;
      return { d, dist: Math.hypot(q.x - x, q.z - z) };
    }, [tx, tz]);
    if (Math.abs(e.d) > 0.06) { await p.keyboard.up('KeyW'); await drag(-e.d * 330); await p.keyboard.down('KeyW'); }
    await p.waitForTimeout(180);
    if (e.dist < stopAt) break;
  }
  await p.keyboard.up('KeyW'); await p.keyboard.up('ShiftLeft');
}

// ---- 1. seal one line, so the world is allowed to push back ----------------
let s = await st();
console.log(`start · motes ${s.motes} · lines held ${s.held}`);
const first = s.live[0];
await goto(first.x, first.z, 60000, 4);
const t0 = Date.now();
while (Date.now() - t0 < 300000) {
  s = await st();
  if (s.held >= 1) break;
  if (await panelOpen()) {
    const c = await card();
    if (c && !c.settled) { await answer(c); await p.waitForTimeout(1600); } else await p.waitForTimeout(300);
  } else { await p.keyboard.press('KeyE'); await p.waitForTimeout(900); }
}
s = await st();
console.log(`one line held · motes ${s.motes} · the world may now surge`);

// ---- 2. LOITER in an open tear's field, 25 m out ---------------------------
const tear = s.live[0];
if (!tear) { console.log('no unsealed tear left to loiter beside'); await b.close(); process.exit(0); }
// stand about 25 m off it: inside the field (34 m), outside the doorstep (15 m)
const ang = Math.atan2(s.z - tear.z, s.x - tear.x);
await goto(tear.x + Math.cos(ang) * 25, tear.z + Math.sin(ang) * 25, 40000, 3);
for (let i = 0; i < 4; i++) { await p.keyboard.press('Escape'); await p.waitForTimeout(250); }
const before = await st();
console.log(`loitering ${Math.round(before.live[0]?.d ?? 0)} m off "${tear.id}" · motes ${before.motes}`);
const JUMP = process.argv.includes('--jump');
const t1 = Date.now();
let lowest = before.motes, highest = before.motes;
while (Date.now() - t1 < 75000) {
  await p.waitForTimeout(200);
  // With --jump the cadet reads the ground: the gathering ring says how far the
  // pressure will reach and how long there is, so he holds the wing and is off
  // his feet when it arrives. That is the skill the hazard is now asking for.
  // A TAP, not a hold: hold opens the wing and carries the cadet out of the
  // tear's field entirely, which dodges the ring by leaving rather than by
  // reading it. A tap is a jump on the spot, which is the verb being tested.
  if (JUMP) await p.keyboard.press('Space');
  const g = await st();
  if (g.open) { await p.keyboard.press('Escape'); continue; }
  lowest = Math.min(lowest, g.motes); highest = Math.max(highest, g.motes);
}
const after = await st();
console.log(`after 75 s of loitering:`);
console.log(`  surges thrown at me and taken: ${after.drift.surges - before.drift.surges}`);
console.log(`  surges read (jumped/glided):   ${after.drift.reads - before.drift.reads}`);
console.log(`  motes ${before.motes} -> ${after.motes}   (lowest seen ${lowest}, highest ${highest})`);
console.log(`  crystals picked up meanwhile:  ${after.drift.motes - before.drift.motes}`);
await b.close();
