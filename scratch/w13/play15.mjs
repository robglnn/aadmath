/**
 * FIFTEEN MINUTES, PLAYED — with hands.
 *
 * The debug surface is READ here and never driven: `panelInfo()` says what is on
 * the card and what the answer is, exactly as `tools/critic/realsession.mjs`
 * does, and every single thing that moves the cadet or opens a tear is a real
 * `keyboard.down` or `mouse.move`. Nothing calls `teleportTo` or
 * `openRiftById`. That distinction is the whole reason this file exists: the
 * debug API has hidden three false fixes in this repo.
 *
 * It answers the four questions the critic's report asks:
 *   1. how many times did the player CHOOSE to travel;
 *   2. how many items ran per arrival, and did any arrival ever exceed three;
 *   3. what a five-minute roam contains now;
 *   4. and it photographs minute 1 and minute 8 from comparable ground.
 *
 *   node scratch/w13/play15.mjs --url http://127.0.0.1:4890 --minutes 15
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/w13-play'));
const MINUTES = Number(arg('minutes', 15));
const W = 1600, H = 900;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(5200);

const T0 = Date.now();
const el = () => (Date.now() - T0) / 1000;
const clock = () => { const s = Math.round(el()); return `${String(Math.floor(s / 60)).padStart(2, '0')}:${String(s % 60).padStart(2, '0')}`; };
const log = [];
const say = (s) => { log.push(`${clock()}  ${s}`); console.log(`${clock()}  ${s}`); };

const facts = () => page.evaluate(() => {
  const a = window.__ascent, p = a.player.pos;
  return {
    x: p.x, y: p.y, z: p.z,
    open: !!a.panel.open, ui: !!a.input.uiOpen,
    stint: a.stint?.state?.() || null,
    survey: a.errand?.state?.() || null,
    bearing: (() => { const b = a.errand?.bearing?.(); return b ? { id: b.id, name: b.name, x: b.pos.x, y: b.pos.y, z: b.pos.z } : null; })(),
    drift: { ...a.drift.stats },
    held: [...a.mastery.state.values()].filter((s) => s.mastered).length,
    motes: a.wallet?.count?.() ?? null,
    guide: a.story?.guide?.() || null,
  };
});
const panelOpen = () => page.evaluate(() => !!window.__ascent.panel?.open);
const card = async () => { const c = await page.evaluate(() => window.__ascent.panelInfo()); return c && c.open ? c : null; };

// fps meter
await page.evaluate(() => {
  window.__fps = [];
  let last = performance.now();
  const tick = (n) => { window.__fps.push(1000 / Math.max(1, n - last)); last = n; requestAnimationFrame(tick); };
  requestAnimationFrame(tick);
});

// ------------------------------------------------------------ real answering
async function answer(c) {
  if (c.mode === 'choice') {
    const btns = page.locator('.rf-reading');
    const n = await btns.count();
    if (!n) return false;
    let want = 0;
    for (let i = 0; i < n; i++) {
      if (String(await btns.nth(i).getAttribute('data-value')) === String(c.answer)) { want = i; break; }
    }
    await btns.nth(want).click({ timeout: 5000 }).catch(() => {});
    return true;
  }
  if (c.mode === 'keypad') {
    const s = String(c.answer ?? '');
    if (!s) return false;
    for (const ch of s) {
      if (ch === '-') await page.keyboard.press('Minus');
      else if (ch === '/') await page.keyboard.press('Slash');
      else if (ch === '+') await page.keyboard.press('Equal');
      else if (ch === '^') await page.keyboard.press('Digit6');
      else await page.keyboard.press(ch);
      await page.waitForTimeout(35);
    }
    await page.keyboard.press('Enter');
    return true;
  }
  const any = page.locator('.rf-move, .rf-chip, .rf-bay, .ans').first();
  if (await any.count()) { await any.click({ timeout: 5000 }).catch(() => {}); return true; }
  return false;
}

// -------------------------------------------------------------- real walking
let fwd = false;
const forward = async (on) => { if (on !== fwd) { fwd = on; if (on) await page.keyboard.down('KeyW'); else await page.keyboard.up('KeyW'); } };
let mx = W / 2;

/**
 * THE ONE THING THAT MADE EVERY EARLIER RUN OF THIS HARNESS A LIE.
 *
 * `src/core/input.js` turns the view from `movementX` **only while the pointer
 * is locked**. Opening a rift calls `document.exitPointerLock()`, and nothing
 * gives it back on its own — so a harness that clicks once at the start and
 * then only calls `mouse.move` is turning nothing at all from the first card
 * onward. Two runs of this file reported "sixty seconds to cover thirty
 * metres" and a cadet who walked 206 m, then 254, then 272 AWAY from a marker,
 * and both were this: the hands were moving and the head was not.
 *
 * With no lock the game's own documented gesture is a DRAG — press, pull,
 * release — and this uses exactly that, because it is what a player does when
 * the mouse does nothing.
 */
async function turn(dx) {
  const locked = await page.evaluate(() => !!window.__ascent.input.locked);
  if (locked) {
    mx = Math.max(6, Math.min(W - 6, mx + dx));
    await page.mouse.move(mx, H / 2, { steps: 2 });
    if (mx <= 12 || mx >= W - 12) { mx = W / 2; await page.mouse.move(mx, H / 2); }
    return;
  }
  // Try to get the lock back the way a player does — one click on the world.
  await page.mouse.click(W / 2, H / 2);
  if (await page.evaluate(() => !!window.__ascent.input.locked)) return;
  // Refused: drag instead. Same handler, same sensitivity, real buttons.
  const from = Math.max(60, Math.min(W - 60, W / 2 - dx / 2));
  const to = Math.max(20, Math.min(W - 20, from + dx));
  await page.mouse.move(from, H / 2);
  await page.mouse.down();
  await page.mouse.move(to, H / 2, { steps: 6 });
  await page.mouse.up();
}

/** Turn toward a world point. Closed loop: measured, turned, measured again. */
async function faceTo(tx, tz) {
  const err = async () => page.evaluate(([x, z]) => {
    const a = window.__ascent, p = a.player.pos;
    let e = ((Math.atan2(x - p.x, z - p.z) - a.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (e < -Math.PI) e += Math.PI * 2;
    return e;
  }, [tx, tz]);
  const d = await err();
  if (Math.abs(d) > 0.04) await turn(-d * 200);
  return Math.abs(d);
}

/** Walk (optionally with the wing out) to a point. Real keys only. */
async function travel(tx, tz, budget = 45000, { glide = false, reach = 6, knock = false } = {}) {
  const t0 = Date.now();
  let last = Infinity, stalls = 0;
  await page.keyboard.down('ShiftLeft');
  if (glide) await page.keyboard.down('Space');
  try {
    while (Date.now() - t0 < budget) {
      if (await panelOpen()) return 'card';
      await tick();
      await faceTo(tx, tz);
      await forward(true);
      await page.waitForTimeout(170);
      if (knock) await page.keyboard.press('KeyE');
      const f = await page.evaluate(([x, z]) => {
        const a = window.__ascent, p = a.player.pos;
        return { d: Math.hypot(p.x - x, p.z - z), y: p.y };
      }, [tx, tz]);
      if (f.d < reach) return 'there';
      if (f.d > last - 0.25) stalls++; else stalls = 0;
      last = f.d;
      if (stalls > 12) {
        // What a person does at a rock: step round it. Pressing Recover puts
        // the cadet back at the plaza and restarts the whole walk, which is how
        // a harness reports "sixty seconds to cover thirty metres".
        const side = (Math.floor(Date.now() / 4000) % 2) ? 'KeyA' : 'KeyD';
        await page.keyboard.down(side);
        await page.keyboard.press('Space');
        await page.waitForTimeout(900);
        await page.keyboard.up(side);
        stalls = 0; last = Infinity;
      }
    }
  } finally {
    await forward(false);
    await page.keyboard.up('ShiftLeft').catch(() => {});
    if (glide) await page.keyboard.up('Space').catch(() => {});
  }
  return 'timeout';
}

// ------------------------------------------------------------------ the play
await page.mouse.click(W / 2, H / 2);
try {
  await page.waitForSelector('.sc-go', { timeout: 12000 });
  await page.locator('.sc-go').click();
  await page.waitForTimeout(900);
} catch { /* no orders card in this path */ }
await page.mouse.click(W / 2, H / 2);

let shotsDone = { one: false, eight: false };
/** The two frames the report needs, taken on the clock rather than on the loop. */
async function tick() {
  if (!shotsDone.one && el() > 58) {
    shotsDone.one = true;
    const f = await facts();
    await page.screenshot({ path: path.join(OUT, 'minute-01.png') });
    say(`FRAME minute 1 — standing at (${f.x.toFixed(0)}, ${f.z.toFixed(0)}) y=${f.y.toFixed(0)}`);
  }
  if (!shotsDone.eight && el() > 470) {
    shotsDone.eight = true;
    const f = await facts();
    await page.screenshot({ path: path.join(OUT, 'minute-08.png') });
    say(`FRAME minute 8 — standing at (${f.x.toFixed(0)}, ${f.z.toFixed(0)}) y=${f.y.toFixed(0)}`);
  }
}

const arrivals = [];    // { rift, items, at }
const finds = [];
const missed = new Map();   // marks these scripted hands could not close on
const said = [];        // what the world told the player to do, verbatim
let travels = 0;

/** Whatever the HUD flashed, so the report quotes the game and not the script. */
async function heard() {
  const s = await page.evaluate(() => {
    const n = document.querySelector('#toast');
    return n && n.classList.contains('show') ? n.textContent.trim() : null;
  });
  if (s && s !== said[said.length - 1]) said.push(s);
  return s;
}

/** Standing at a tear: work every card until the stint hands the world back. */
async function workHere(riftId) {
  const cur = { rift: riftId, items: 0, at: clock() };
  arrivals.push(cur);
  const t0 = Date.now();
  let sig = '';
  let stuck = 0;
  /**
   * A chained card arrives 460 ms after the last one shut. A harness that
   * treats the first closed frame as "the stint is over" reports one item per
   * arrival for a loop that is actually running three — so stand still for a
   * moment and see, which is exactly what a player does.
   */
  const stillGoing = async () => {
    const t1 = Date.now();
    while (Date.now() - t1 < 1600) {
      if (await panelOpen()) return true;
      await page.waitForTimeout(180);
    }
    return false;
  };
  while (Date.now() < deadline && Date.now() - t0 < 180000) {
    await tick();
    if (!(await panelOpen()) && !(await stillGoing())) break;
    const c = await card();
    if (!c) { await page.waitForTimeout(200); continue; }
    if (c.settled) { await page.waitForTimeout(300); continue; }
    const now = `${c.skill}|${c.form}|${c.answer}|${c.mode}`;
    if (now === sig) {
      // The same card is still on the surface: these hands could not work this
      // surface (a balance, a sort, a plot — they take a drag, not a click).
      // Do NOT count it again, and after three tries leave the way a player
      // would, with the key the panel actually binds.
      stuck++;
      if (stuck >= 3) {
        say(`  (left a "${c.mode}" card these scripted hands cannot work — pressed Escape)`);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(900);
        break;
      }
    } else { sig = now; stuck = 0; cur.items++; }
    await answer(c);
    await page.waitForTimeout(1500);
    const t1 = Date.now();
    while (Date.now() - t1 < 4500) {
      if (!(await panelOpen())) break;
      const cc = await card();
      if (cc && !cc.settled) break;
      await page.waitForTimeout(250);
    }
  }
  await page.waitForTimeout(1400);
  const f = await facts();
  const h = await heard();
  say(`STINT ENDED at "${riftId}" after ${cur.items} item(s) — the card is gone.`
    + (h ? `  The world says: "${h}"` : '')
    + (f.bearing ? `  [mark lit: ${f.bearing.name}]` : ''));
  return cur;
}

/** Walk to the nearest live tear and press the key. Returns its id, or null. */
async function goToTear() {
  await page.mouse.click(W / 2, H / 2);   // the lock, back, the way a player takes it
  const near = await page.evaluate(() => {
    const a = window.__ascent, p = a.player.pos;
    const live = a.rifts.list.filter((r) => !r.locked && !r.mastered)
      .map((r) => ({ id: r.id, d: Math.hypot(p.x - r.foot.x, p.z - r.foot.z), x: r.foot.x, z: r.foot.z }))
      .sort((u, v) => u.d - v.d);
    return live[0] || null;
  });
  if (!near) return null;
  travels++;
  say(`TRAVEL ${travels} · walked to the tear "${near.id}", ${Math.round(near.d)} m`);
  await travel(near.x, near.z, 60000, { reach: 4.5, knock: true });
  if (!(await panelOpen())) { await page.keyboard.press('KeyE'); await page.waitForTimeout(900); }
  return (await panelOpen()) ? near.id : null;
}

/** Go and claim the lit survey mark. Returns true if it was claimed. */
async function goToMark(b) {
  await page.mouse.click(W / 2, H / 2);
  travels++;
  const f0 = await facts();
  const d0 = Math.round(Math.hypot(f0.x - b.x, f0.z - b.z));
  say(`TRAVEL ${travels} · walked to the survey mark "${b.name}", ${d0} m`);
  const held0 = f0.survey.held;
  const m0 = f0.drift.motes;
  const s0 = f0.drift.surges;
  const r0 = f0.drift.reads;
  const l0 = f0.drift.lifts;
  await travel(b.x, b.z, 75000, { glide: true, reach: 7 });
  for (let i = 0; i < 8; i++) {
    const g = await facts();
    if (g.survey.held > held0) break;
    // a mark can hang forty metres up: hold the wing, keep pushing in
    await page.keyboard.down('Space');
    await forward(true);
    await faceTo(b.x, b.z);
    await page.waitForTimeout(1100);
    await forward(false);
    await page.keyboard.up('Space');
  }
  const g = await facts();
  const got = g.survey.held > held0;
  if (got) {
    finds.push(b.name);
    const h = await heard();
    say(`FOUND "${b.name}" — ${g.survey.held}/${g.survey.total} marks.`
      + `  crystals on the way: ${g.drift.motes - m0} · updrafts ridden: ${g.drift.lifts - l0}`
      + ` · surges taken: ${g.drift.surges - s0} · surges read: ${g.drift.reads - r0}`
      + (h ? `  The world says: "${h}"` : ''));
  } else {
    say(`could not close on "${b.name}" (y=${g.y.toFixed(0)}); it stays lit`);
  }
  return got;
}

const deadline = T0 + MINUTES * 60000;
// The shape of a real sitting, and deliberately the shape the critic played:
// follow the game, then take a long roam in the middle, then come back to work.
const ROAM_FROM = MINUTES * 60000 * 0.40;
const ROAM_TO = MINUTES * 60000 * 0.73;

while (Date.now() < deadline) {
  const f = await facts();

  await tick();

  if (f.open) { await workHere(f.stint?.riftId || 'unknown'); continue; }

  const inRoam = (Date.now() - T0) > ROAM_FROM && (Date.now() - T0) < ROAM_TO;

  // Two honest attempts at a mark, then get on with the roam: a harness that
  // beats its head against a forty-metre crown for five minutes measures the
  // harness, not the island.
  if (inRoam && f.bearing && (missed.get(f.bearing.id) || 0) < 2) {
    const got = await goToMark(f.bearing);
    if (!got) missed.set(f.bearing.id, (missed.get(f.bearing.id) || 0) + 1);
    continue;
  }
  if (inRoam) {
    // Nothing lit and the roam window is open: cross the island, the way the
    // critic did, and count what is out there.
    const a2 = Math.random() * 6.28;
    const m0 = f.drift.motes, s0 = f.drift.surges, l0 = f.drift.lifts;
    await travel(f.x + Math.cos(a2) * 130, f.z + Math.sin(a2) * 130, 26000, { glide: true, reach: 10 });
    const g = await facts();
    say(`ROAM leg — crystals ${g.drift.motes - m0}, updrafts ${g.drift.lifts - l0}, `
      + `surges taken ${g.drift.surges - s0}, motes now ${g.motes}`);
    continue;
  }

  const id = await goToTear();
  if (id) { say(`ARRIVED at "${id}" — a card is up`); continue; }
  await page.waitForTimeout(800);
}

await forward(false);
const end = await facts();
await page.screenshot({ path: path.join(OUT, 'minute-15.png') });
const fps = await page.evaluate(() => {
  const v = window.__fps.slice(60).sort((a, b) => a - b);
  return v.length ? Math.round(v[Math.floor(v.length / 2)]) : null;
});

const worst = Math.max(0, ...arrivals.map((a2) => a2.items));
say('---');
say(`chose to travel .......... ${travels}`);
say(`arrivals at a tear ....... ${arrivals.length}  (items each: ${arrivals.map((a2) => a2.items).join(', ')})`);
say(`longest single arrival ... ${worst} items`);
say(`items answered ........... ${arrivals.reduce((a2, b2) => a2 + b2.items, 0)}`);
say(`lines held ............... ${end.held}`);
say(`survey marks found ....... ${end.survey.held}/${end.survey.total} — ${finds.join(', ') || 'none'}`);
say(`crystals run through ..... ${end.drift.motes}   veins emptied: ${end.drift.spent}`);
say(`updrafts ridden .......... ${end.drift.lifts}`);
say(`surges taken ............. ${end.drift.surges}   surges READ (paid): ${end.drift.reads}`);
say(`motes in the wallet ...... ${end.motes}`);
say(`median fps ............... ${fps}`);
say(`console errors ........... ${errors.length}`);
if (errors.length) say(errors.slice(0, 6).join(' | '));

await writeFile(path.join(OUT, 'play.log'), log.join('\n') + '\n');
await browser.close();
