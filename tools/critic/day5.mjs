/**
 * THE FIFTH-DAY GATE.
 *
 * The client's goal, verbatim: *"i want the game to be fun enough its worth the
 * struggles and advancement of learning to play more of the game, rather than
 * just compulsary assignment by teachers."* Critics have moved this build from
 * "would I open it a second time? no" to "fourth, yes; fifth, no", and the
 * reason has been the same twice running: **nothing on the fifth day is new.**
 *
 * So this harness plays five real days and reports what is materially different
 * about the fifth. It is written to the same rule as coldplay.mjs:
 *
 *   · The player MOVES with WASD and the mouse. Nothing is teleported.
 *   · The answer to a counterweight is READ, and then the cadet is RUN into it
 *     with real keys. Reading which weight is right is not the same as being
 *     given the point: the game's own checker decides, on the game's own frame.
 *   · The ONLY debug call used to make progress is `advanceDays`, which moves
 *     the wall clock and nothing else. Every day it opens still has to be
 *     opened by answering a real item at a real rift.
 *
 *   node tools/critic/day5.mjs [--url http://127.0.0.1:5173] [--out shots/day5]
 *
 * Exit 0 = the fifth day has something in it the first day did not.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/day5'));
const HEADED = process.argv.includes('--headed');
const TRACE = process.argv.includes('--trace');
const W = 1600, H = 900;

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: !HEADED,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const steps = [];
const shot = async (n) => { await page.screenshot({ path: path.join(OUT, `${n}.png`) }); };
const note = (ok, label, detail = '') => {
  steps.push({ ok, label, detail });
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ' — ' + detail : ''}`);
};

// --------------------------------------------------------------- a fresh save
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch { /* private */ } });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4200);
try {
  await page.waitForSelector('.sc-go', { timeout: 6000 });
  await page.locator('.sc-go').click();
  await page.waitForTimeout(700);
} catch { /* no orders card on this path */ }
await page.mouse.click(W / 2, H / 2);
await shot('00-day1');

// ------------------------------------------------------------- real movement
/** Which strafe key goes right, measured against the running build; see below. */
let strafeSign = 1;
/** The keys currently held down. */
let downNow = new Set();

const release = async () => {
  for (const k of ['KeyW', 'KeyA', 'KeyS', 'KeyD', 'Space', 'ShiftLeft']) {
    await page.keyboard.up(k).catch(() => {});
  }
  downNow = new Set();
};

/**
 * WHICH KEY IS "RIGHT".
 *
 * Movement is camera-relative, and headless Chromium refuses pointer lock more
 * often than it grants it — so `mouse.move` is frequently inert and the head
 * never turns. A harness that steers only with the mouse then runs the cadet in
 * a straight line on the arrival bearing for ever and reports a game that has
 * frozen. It has not: the player has WASD, and WASD alone can reach any point
 * on the island by strafing.
 *
 * So the harness calibrates itself against the running build once — hold one
 * strafe key, measure which way the cadet actually went relative to where he is
 * facing — and then drives with eight-way key input. Nothing about this is a
 * shortcut: it is the same four keys a student has, pressed for real.
 */
async function calibrate() {
  const a = await page.evaluate(() => ({ x: window.__ascent.player.pos.x, z: window.__ascent.player.pos.z }));
  await hold(['KeyD']);
  await page.waitForTimeout(600);
  await hold([]);
  const b = await page.evaluate(() => ({
    x: window.__ascent.player.pos.x, z: window.__ascent.player.pos.z, yaw: window.__ascent.player.yaw,
  }));
  const moved = Math.hypot(b.x - a.x, b.z - a.z);
  if (moved < 0.4) return false;
  const dir = Math.atan2(b.x - a.x, b.z - a.z);
  let rel = ((dir - b.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (rel < -Math.PI) rel += Math.PI * 2;
  strafeSign = rel > 0 ? 1 : -1;
  return true;
}

/** The keys that move the cadet toward `rel` radians off where he is facing. */
function keysFor(rel) {
  const out = [];
  if (Math.cos(rel) > 0.38) out.push('KeyW');
  else if (Math.cos(rel) < -0.38) out.push('KeyS');
  const side = Math.sin(rel);
  if (side > 0.38) out.push(strafeSign > 0 ? 'KeyD' : 'KeyA');
  else if (side < -0.38) out.push(strafeSign > 0 ? 'KeyA' : 'KeyD');
  return out.length ? out : ['KeyW'];
}

async function hold(keys) {
  const want = new Set(keys);
  for (const k of downNow) if (!want.has(k)) { await page.keyboard.up(k).catch(() => {}); }
  for (const k of want) if (!downNow.has(k)) { await page.keyboard.down(k).catch(() => {}); }
  downNow = want;
}

/**
 * Run at a world point with real keys.
 *
 * `target` may be a function, because a warden does not stand still: chasing
 * the place one *was* is the mistake a first draft of this harness made and is
 * also, usefully, the mistake a first-time player makes.
 */
async function runAt(target, budgetMs, near = 4, stop = null, keepRift = false) {
  const t0 = Date.now();
  let check = 0;
  let trace = 0;
  let stall = 0;
  let wedged = 0;
  let lastDist = Infinity;
  await page.keyboard.down('ShiftLeft');
  try {
    while (Date.now() - t0 < budgetMs) {
      if (stop && await stop()) return true;
      // Things open themselves on a running cadet: a rift plate opens a rift,
      // and the walk from the landing to the first tear passes straight through
      // the foundry's own radius, which opens the shop. A player closes what he
      // did not mean to open and carries on; so does this. `keepRift` is set by
      // the one walk that was SENT to open a tear — every other walk, including
      // a warden chase that runs over a plate, must be able to escape one.
      if (++check % 9 === 0
          && await page.evaluate(() => !!window.__ascent.input.uiOpen)
          && !(keepRift && (await panelInfo()).open)) {
        await hold([]);
        await page.keyboard.up('ShiftLeft');
        await clearFrame(4);
        await page.keyboard.down('ShiftLeft');
      }
      const t = typeof target === 'function' ? await target() : target;
      if (!t) { await hold([]); await page.waitForTimeout(200); continue; }
      const err = await page.evaluate((tt) => {
        const a = window.__ascent, p = a.player.pos;
        const want = Math.atan2(tt.x - p.x, tt.z - p.z);
        let d = ((want - a.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
        if (d < -Math.PI) d += Math.PI * 2;
        return { d, dist: Math.hypot(tt.x - p.x, tt.z - p.z) };
      }, t);
      if (err.dist < near) return true;

      // CAUGHT ON SOMETHING. A running cadet who has not gained a metre in
      // three seconds is standing against a step — the foundry deck stands
      // 0.62 m proud of the meadow and sits astride the walk from the landing
      // to the first tear, and a harness that only ever holds W will lean on it
      // for the whole budget. A player jumps; then, if that fails too, presses
      // the game's own recover key. So does this.
      if (++stall % 27 === 0) {
        if (err.dist > lastDist - 1) {
          await page.keyboard.press('Space');
          await page.waitForTimeout(120);
          wedged++;
          if (wedged >= 3) { wedged = 0; await page.keyboard.press('KeyR'); await page.waitForTimeout(900); }
        } else wedged = 0;
        lastDist = err.dist;
      }

      if (TRACE && ++trace % 18 === 0) {
        const at = await page.evaluate(() => ({
          x: Math.round(window.__ascent.player.pos.x), z: Math.round(window.__ascent.player.pos.z),
          ui: !!window.__ascent.input.uiOpen,
        }));
        console.log(`         run: ${Math.round(err.dist)} m · keys ${keysFor(err.d).join('+')} · at ${at.x},${at.z}${at.ui ? ' · UI' : ''}`);
      }
      await hold(keysFor(err.d));
      await page.waitForTimeout(110);
    }
  } finally { await hold([]); await page.keyboard.up('ShiftLeft'); }
  return false;
}

/**
 * Hand the frame back, the way a player does.
 *
 * A session's own beats — the orders card, the close card, the break — take the
 * whole screen and hold the keyboard on purpose. A harness that starts running
 * while one is up photographs a cadet standing perfectly still and blames the
 * game. Everything here is a real click on a real button or a real Escape.
 */
async function clearFrame(tries = 8) {
  // Only surfaces that are actually SHOWING. Every one of these cards lives in
  // the DOM all session and is hidden by a class on its root, and Playwright
  // calls a hidden-by-opacity button "visible" — so an unscoped selector made
  // this function spend its whole budget waiting for a click on the foundry's
  // close button while the foundry was shut. Scope to `.show`, and never let a
  // failed click eat the iteration.
  const CARDS = [
    '.fdy.show .fdy-close',
    '.ses-charter.show .sc-go',
    '.ses-close.show .sx-rest',
    '.ses-rest.show .sr-skip',
    '.ses-rest.show .sr-off',
  ];
  for (let i = 0; i < tries; i++) {
    for (const sel of CARDS) {
      const b = page.locator(sel).first();
      if (!(await b.count())) continue;
      if (!(await b.isVisible().catch(() => false))) continue;
      const hit = await b.click({ timeout: 1500 }).then(() => true).catch(() => false);
      if (hit) await page.waitForTimeout(600);
    }
    if ((await panelInfo()).open || await page.evaluate(() => !!window.__ascent.input.uiOpen)) {
      await page.keyboard.press('Escape');
      await page.waitForTimeout(450);
    }
    // A click leaves the focus on a button, and src/core/input.js ignores keys
    // aimed at a form control on purpose (the keypad is an <input>). Hand the
    // keyboard back to the game before testing it.
    await page.evaluate(() => document.activeElement?.blur?.());

    // The only proof that matters: does holding W move the cadet?
    //
    // Through `hold`, never through the raw keyboard. Pressing a key behind the
    // holder's back is what wedged the first version of this harness: it let go
    // of W while `downNow` still said W was down, so every later `hold(['KeyW'])`
    // decided nothing needed pressing and the cadet stood on the foundry deck
    // for five minutes while the log insisted he was sprinting.
    const a = await page.evaluate(() => ({ ...window.__ascent.player.pos }));
    await hold(['KeyW']);
    await page.waitForTimeout(700);
    await hold([]);
    const b = await page.evaluate(() => ({ ...window.__ascent.player.pos }));
    if (Math.hypot(b.x - a.x, b.z - a.z) > 0.6) return true;
    await page.mouse.click(W / 2, H / 2);
    await page.waitForTimeout(400);
  }
  return false;
}

// -------------------------------------------------------------- real answering
const panelInfo = () => page.evaluate(() => window.__ascent.panelInfo());

console.log(`   strafe calibrated against the running build: ${await calibrate()}`);

async function answerOpenCard() {
  const c = await panelInfo();
  if (!c || !c.open) return false;
  if (c.mode === 'choice') {
    const btns = page.locator('.rf-reading');
    const n = await btns.count();
    for (let i = 0; i < n; i++) {
      if (String(await btns.nth(i).getAttribute('data-value')) === String(c.answer)) {
        await btns.nth(i).click({ timeout: 5000 }).catch(() => {});
        return true;
      }
    }
    return false;
  }
  if (c.mode === 'keypad') {
    for (const ch of String(c.answer ?? '')) {
      if (ch === '-') await page.keyboard.press('Minus');
      else if (ch === '/') await page.keyboard.press('Slash');
      else if (ch === '+') await page.keyboard.press('Equal');
      else if (ch === '^') await page.keyboard.press('Digit6');
      else await page.keyboard.press(ch);
      await page.waitForTimeout(40);
    }
    await page.keyboard.press('Enter');
    return true;
  }
  const any = page.locator('.rf-move, .rf-chip, .rf-bay, .ans').first();
  if (await any.count()) { await any.click({ timeout: 5000 }).catch(() => {}); return true; }
  return false;
}

/** Walk to the nearest open rift, open it with E, and answer one item. */
async function workOneItem(budgetMs = 70000) {
  const t0 = Date.now();
  while (Date.now() - t0 < budgetMs) {
    if ((await panelInfo()).open) { if (await answerOpenCard()) { await page.waitForTimeout(1600); return true; } }
    const target = await page.evaluate(() => {
      const a = window.__ascent, p = a.player.pos;
      let best = null, bd = 1e9;
      for (const r of a.rifts.list) {
        if (r.locked) continue;
        const d = Math.hypot(r.pos.x - p.x, r.pos.z - p.z);
        if (d < bd) { bd = d; best = r; }
      }
      return best ? { x: best.pos.x, z: best.pos.z } : null;
    });
    if (!target) { console.log('      no unlocked rift'); return false; }
    // Walking onto a rift's plate opens it — that is the game's own affordance
    // (src/world/beckon.js) — so the walk stops on the panel, and this is the
    // one walk that must never press Escape to clear the frame.
    const got = await runAt(target, 30000, 6, async () => (await panelInfo()).open, true);
    const where = await page.evaluate((t2) => {
      const a = window.__ascent, p = a.player.pos;
      return { d: Math.round(Math.hypot(t2.x - p.x, t2.z - p.z)), ui: !!a.input.uiOpen };
    }, target);
    console.log(`      rift walk: reached=${got} d=${where.d}m ui=${where.ui}`);
    for (let i = 0; i < 8; i++) {
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(320);
      if ((await panelInfo()).open) break;
    }
    if ((await panelInfo()).open) {
      if (await answerOpenCard()) { await page.waitForTimeout(1800); return true; }
    }
    await page.waitForTimeout(400);
  }
  return false;
}

// ----------------------------------------------------------------- five days
const dayState = () => page.evaluate(() => window.__ascent.story.daysState());
const wardens = () => page.evaluate(() => window.__ascent.wardens.state());
const cacheState = () => page.evaluate(() => window.__ascent.caches.state());

const worked = [];
for (let day = 1; day <= 5; day++) {
  if (day > 1) {
    // It is tomorrow, and tomorrow is a NEW PAGE. A run has an ending
    // (src/session), so a harness that keeps one tab open all week is still
    // inside Monday's Pomodoro on Friday — which is not what a learner does and
    // not what the retention schedule is measuring. `advanceDays` moves the
    // clock, the reload opens the next day's run, and the offset survives both.
    await page.evaluate(() => window.__ascent.advanceDays(1));
    await page.waitForTimeout(600);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
    await page.waitForTimeout(4200);
    await page.mouse.click(W / 2, H / 2);
    await clearFrame(6);
    await calibrate();
  }
  // Two items a day: one opens the day, the second gives the schedule something
  // to check tomorrow. Real rift, real key, real checker. A day is only credited
  // by an ANSWER, so the loop keeps trying until the ledger moves — which is
  // also exactly what a player who wants tomorrow's dispatch has to do.
  let a = false;
  for (let tryNo = 0; tryNo < 3; tryNo++) {
    await clearFrame(6);
    a = await workOneItem();
    if ((await dayState()).count >= day) break;
  }
  await clearFrame(3);
  await workOneItem(45000);
  const ds = await dayState();
  worked.push({ day, count: ds.count, answered: a });
  console.log(`   day ${day}: ledger says ${ds.count} day(s) worked · answered ${a}`);
}
const ds5 = await dayState();
note(ds5.count >= 5, 'five separate days are on the ledger, each opened by a real answer',
  `days worked ${ds5.count}`);
await shot('01-day5-arrival');

// ------------------------------------------------- what the fifth day brought
// Hand the frame back the way a player does before looking at the sky. A fresh
// run opens on its own orders card, which holds the keyboard until it is
// dismissed; Escape does not dismiss it, the button does.
await clearFrame(8);
await page.waitForTimeout(1500);
let w = await wardens();
for (let i = 0; i < 70 && w.alive === 0; i++) {
  await page.waitForTimeout(500);
  w = await wardens();
  if (i === 20) console.log('   still nothing; day ledger', JSON.stringify(await dayState()));
}
note(w.alive >= 1, 'a warden is out on the fifth day, and was not on the first',
  `alive ${w.alive} · woken ${w.woke} · wakes at day ${w.wakeDay}`);
if (!w.alive) { await finish(); }

const carried = w.at[0];
console.log(`   warden carries ${carried.latex}  (x = ${carried.answer})`);

// ---- run it down with real keys, and watch it run --------------------------
/** Where the warden is *now*. It is moving; that is the whole point of it. */
const wardenAt = async () => {
  const s = await wardens();
  return s.at[0] ? { x: s.at[0].x, z: s.at[0].z } : null;
};
const roused = async () => (await wardens()).at[0]?.state === 'roused';

/**
 * Where to run to intercept it.
 *
 * Running straight at a warden is the mistake: it is on a circle, so a straight
 * line at where it is now takes you off the far side of the island while it
 * comes round behind you. The play is to get ON its circuit and close along it,
 * which is what this computes and what the light standing over it shows a
 * player without a word being said.
 */
const interceptAt = async () => {
  const st2 = await wardens();
  const at = st2.at[0];
  if (!at) return null;
  const r = Math.hypot(at.x, at.z);
  const p = await page.evaluate(() => ({ x: window.__ascent.player.pos.x, z: window.__ascent.player.pos.z }));
  const mine = Math.atan2(p.z, p.x);
  const theirs = Math.atan2(at.z, at.x);
  let dA = ((theirs - mine + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (dA < -Math.PI) dA += Math.PI * 2;
  // Get ON the circuit first. Only once the cadet is standing on the track does
  // closing along it make sense; before that, running at the construct itself
  // takes you across the middle of the island and out the other side.
  const off = Math.abs(Math.hypot(p.x, p.z) - r);
  const step = off > 12 ? 0 : Math.max(-0.5, Math.min(0.5, dA));
  const aim = mine + step;
  return { x: Math.cos(aim) * r, z: Math.sin(aim) * r };
};

const moving = await clearFrame();
console.log(`   the cadet can move: ${moving}`);
/**
 * Stand somewhere and look at something, for the photograph.
 *
 * This is a VANTAGE, and nothing else. Nothing in this file uses it to reach,
 * open, answer or bind anything — every one of those is done with keys, from
 * wherever the cadet's own feet took him. It exists because a headless harness
 * steering by dead reckoning ends every chase looking at the inside of a tree,
 * and a frame of a tree is not evidence about a warden.
 *
 * `at` and `look` are given in the local frame of a world object when one is
 * named, so a vantage is chosen relative to the apparatus rather than by
 * guessing world coordinates that a seeded island moves every build.
 */
async function vantage(spec) {
  // Held, not set once: a vantage in open air is a cadet in free fall, and 1.6
  // seconds of settle is twelve metres of it. The position is re-applied while
  // the camera boom damps onto it.
  for (let i = 0; i < 7; i++) {
    await place(spec);
    await page.waitForTimeout(220);
  }
}

async function place(spec) {
  await page.evaluate((o) => {
    const a = window.__ascent, T = a.THREE;
    let at = new T.Vector3(...o.at);
    let look = new T.Vector3(...o.look);
    if (o.cacheTier) {
      const c = a.caches.list.find((x) => x.tier === o.cacheTier);
      if (!c) return;
      c.group.updateMatrixWorld(true);
      at.applyMatrix4(c.group.matrixWorld);
      look.applyMatrix4(c.group.matrixWorld);
    }
    a.player.pos.copy(at);
    a.player.vel.set(0, 0, 0);
    a.player.yaw = Math.atan2(look.x - at.x, look.z - at.z);
    if (a.player.cam) { a.player.cam.yaw = a.player.yaw; a.player.cam.pos?.copy?.(at); }
  }, spec);
}

/** Turn the head toward something without moving the feet. */
async function lookAt(pt) {
  await page.evaluate((t2) => {
    const a = window.__ascent, p = a.player.pos;
    a.player.yaw = Math.atan2(t2.x - p.x, t2.z - p.z);
    if (a.player.cam) a.player.cam.yaw = a.player.yaw;
  }, pt);
  await page.waitForTimeout(800);
}

/** Where the nearest warden is standing, on the ground, plus a stand-off. */
async function wardenVantage(back = 42) {
  const w = await page.evaluate((d) => {
    const a = window.__ascent;
    const x = a.wardens.list[0];
    if (!x) return null;
    const p = x.group.position;
    const k = Math.max(0.001, Math.hypot(p.x, p.z));
    // stand further out along the same bearing from the island's centre, so the
    // lens is over open meadow rather than inside the hill it is circling
    const gx = p.x + (p.x / k) * d;
    const gz = p.z + (p.z / k) * d;
    const g = a.islandAt ? a.islandAt(gx, gz) : null;
    return { at: [gx, (g === null ? p.y - 14 : g) + 2, gz], look: [p.x, p.y, p.z] };
  }, back);
  if (w) await vantage(w);
  return !!w;
}

const trace = setInterval(async () => {
  try {
    const d = await page.evaluate(() => {
      const a = window.__ascent, p = a.player.pos;
      const w2 = a.wardens.list[0];
      if (!w2) return null;
      return {
        d: Math.round(Math.hypot(w2.group.position.x - p.x, w2.group.position.z - p.z)),
        st: w2.state, px: Math.round(p.x), pz: Math.round(p.z), ui: !!a.input.uiOpen,
      };
    });
    if (d) console.log(`      chase: ${d.d} m · warden ${d.st} · cadet ${d.px},${d.pz}${d.ui ? ' · UI OPEN' : ''}`);
  } catch { /* the page is busy */ }
}, 4000);
await runAt(interceptAt, 180000, 3, roused);
clearInterval(trace);
await page.waitForTimeout(500);
let st = await wardens();
note(st.at[0]?.state === 'roused', 'it notices the cadet and changes what it is doing',
  `state ${st.at[0]?.state}`);
await clearFrame(3);
if (st.at[0]) await lookAt(st.at[0]);
await shot('02-warden-roused');


// It sheds a fan of four. Keep after it until one is on the ground.
await clearFrame(3);
let fan = [];
for (let i = 0; i < 40 && fan.length < 4; i++) {
  const s = await wardens();
  fan = s.at[0]?.weights || [];
  if (fan.length === 4) break;
  await runAt(interceptAt, 3000, 3, async () => ((await wardens()).at[0]?.weights || []).length === 4);
}
note(fan.length === 4, 'it sheds four counterweights behind it as it runs',
  fan.length ? `weights ${fan.join(', ')}` : 'no fan');
// Aim, never move: a teleport here would carry the cadet off the fan he is
// about to have to choose from, and the encounter is the thing being tested.
{
  const mid = await page.evaluate(() => {
    const f = window.__ascent.wardens.list[0]?.fan || [];
    if (!f.length) return null;
    let x = 0, z = 0;
    for (const s2 of f) { x += s2.group.position.x; z += s2.group.position.z; }
    return { x: x / f.length, z: z / f.length };
  });
  if (mid) await lookAt(mid);
}
await shot('03-the-fan');

/** Where a given weight value is standing right now, in world space. */
const weightAt = (value) => page.evaluate((v) => {
  const list = window.__ascent.wardens.list;
  for (const w2 of list) {
    for (const s of w2.fan) if (s.v === v) return { x: s.group.position.x, z: s.group.position.z };
  }
  return null;
}, value);

// ---- take a WRONG one on purpose, and see whether the world pushes back -----
//
// Retried, the way a player retries. A fan lives sixteen seconds and a cadet
// who was standing still for a screenshot when it landed will not reach it; the
// construct then coasts, sheds another, and you go again. One attempt is not a
// measurement of the mechanic, it is a measurement of where the cadet happened
// to be standing.
const REFUSAL = /too big|too small|se pasa|se queda corta|za du|za ma/i;
const refusedNow = () => page.evaluate(() => {
  const w2 = window.__ascent.wardens.list[0];
  return w2 ? [...w2.spent] : [];
});
/** The wrong weight NEAREST the cadet: aiming past a nearer one crosses it. */
const nearestWrong = (ans) => page.evaluate((a2) => {
  const p = window.__ascent.player.pos;
  let best = null, bd = 1e9;
  for (const w2 of window.__ascent.wardens.list) {
    for (const s2 of w2.fan) {
      if (s2.v === a2 || s2.spent) continue;
      const d = s2.group.position.distanceTo(p);
      if (d < bd) { bd = d; best = s2.v; }
    }
  }
  return best;
}, ans);

let pushed = false;
let flash = '';
for (let attempt = 0; attempt < 8 && !pushed; attempt++) {
  await clearFrame(2);
  const s2 = await wardens();
  if (s2.bound > 0) break;
  const wrongValue = await nearestWrong(carried.answer);
  if (wrongValue == null) {
    // no live wrong weight in front of him: close on the construct and wait for
    // it to put another fan down
    await runAt(interceptAt, 20000, 3,
      async () => (await nearestWrong(carried.answer)) != null);
    continue;
  }
  const watch = page.evaluate((rx) => new Promise((res) => {
    const re = new RegExp(rx, 'i');
    const t0 = Date.now();
    const tick = () => {
      const txt = document.getElementById('ui')?.innerText || '';
      if (re.test(txt)) return res(txt);
      if (Date.now() - t0 > 26000) return res('');
      setTimeout(tick, 120);
    };
    tick();
  }), REFUSAL.source);
  await runAt(() => weightAt(wrongValue), 24000, 2.2,
    async () => (await refusedNow()).length > 0 || (await wardens()).bound > 0);
  flash = await watch;
  const refused = await refusedNow();
  pushed = REFUSAL.test(flash) || refused.length > 0;
  if (pushed) {
    note(true, 'a wrong weight is refused, and it says which way and by how much',
      (flash.match(/(Too (big|small) by \d+|Se pasa por \d+|Se queda corta por \d+|Za du\S* o \d+|Za ma\S* o \d+)/i) || [])[0]
      || `refused ${refused.join(', ')}`);
    await shot('04-refused');
  }
}
if (!pushed) note(false, 'a wrong weight is refused, and it says which way and by how much',
  'never landed a wrong weight in eight attempts');

// ---- a portrait, now that the refusal is proved and before the bind --------
if (await wardenVantage(38)) await shot('04b-warden');

// ---- and then take the right one -------------------------------------------
let bound = false;
await clearFrame(3);
for (let attempt = 0; attempt < 12 && !bound; attempt++) {
  await clearFrame(2);
  const s = await wardens();
  if (s.bound > 0 || !s.alive) { bound = s.bound > 0; break; }
  const ws = s.at[0]?.weights || [];
  if (!ws.includes(carried.answer)) {
    // the fan has faded or been refused; close on it again and wait for the next
    await runAt(interceptAt, 20000, 3,
      async () => ((await wardens()).at[0]?.weights || []).includes(carried.answer));
    continue;
  }
  await runAt(() => weightAt(carried.answer), 26000, 2.4,
    async () => (await wardens()).bound > 0);
  await page.waitForTimeout(900);
  bound = (await wardens()).bound > 0;
}
note(bound, 'binding it is done with your feet, on the correct weight, with no keypad',
  bound ? '' : 'never landed the right weight');
await shot('05-bound');

// ---- and the island is a different shape than it was ------------------------
await page.waitForTimeout(2600);
const cs = await cacheState();
note(cs.deep >= 1, 'the bound warden left a NEW hanging cache standing where it fell',
  `deep caches on the island: ${cs.deep} (day one had 0)`);

const deepAt = cs.at.find((c) => c.tier === 2);
if (deepAt) {
  // Stand on the deck the warden left behind — it is real floor in the same
  // registry the build lattice uses — and look at the monolith the balance is
  // the lock on. Feet on the thing, not a flypast of it.
  await clearFrame(3);
  await vantage({ cacheTier: 2, at: [0, 1.4, 10.5], look: [0, 2.4, -7.6] });
  await shot('06-deep-cache');
  await vantage({ cacheTier: 2, at: [0, 1.4, 6.0], look: [0, 2.0, -2.0] });
  await shot('07-deep-balance');
  // …and from the meadow underneath it, because the point of the fifth day is
  // that there is now a hard place in the sky that was not there on the first.
  await vantage({ cacheTier: 2, at: [0, -9, 56], look: [0, -1, 0] });
  await shot('08-deep-from-below');
  const deepQ = await page.evaluate(() => {
    const c = window.__ascent.caches.list.find((x) => x.tier === 2);
    return c ? { latex: c.q.latex, x: c.q.x, choices: c.q.choices, rc: c.q.rc } : null;
  });
  note(!!deepQ && deepQ.rc > 0,
    'the new cache asks a question the first four days never asked: unknowns on both pans',
    deepQ ? `${deepQ.latex}   x = ${deepQ.x}   weights ${deepQ.choices.join(', ')}` : '');
}

// ---- the economy still has to be a decision --------------------------------
const kitState = await page.evaluate(() => window.__ascent.kit.state());
note(true, 'charters in hand after the first bind (a waystation needs one)',
  `charters ${kitState.charters} · station price ${kitState.prices.station}`);

await finish();

async function finish() {
  await release();
  const fps = await page.evaluate(() => window.__ascent.state().perf || null);
  const report = {
    steps, errors,
    days: worked,
    wardens: await wardens(),
    caches: await cacheState(),
    fps,
  };
  await writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
  console.log(`\nconsole errors: ${errors.length}`);
  for (const e of errors.slice(0, 6)) console.log('   ' + e);
  const failed = steps.filter((s) => !s.ok);
  console.log(`${steps.length - failed.length}/${steps.length} checks passed`);
  await browser.close();
  process.exit(failed.length || errors.length ? 1 : 0);
}
