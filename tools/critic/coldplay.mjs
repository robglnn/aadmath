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

  // ---- 5c. …and the way out is a way OUT ----------------------------------
  //
  // The other half of the critic's four minutes: *"R (Recover) returns you to
  // 10 m still standing in it."* Recover only moved the cadet when the game had
  // already worked out that something had hold of him — and the whole problem
  // with a state nobody predicted is that nobody predicted it. From anywhere
  // the game thought was fine, the documented way out put him down on the exact
  // square metre he pressed it from, three times running, and he wrote it down
  // as a dead key. He was right to.
  //
  // Nobody presses Recover from a place they are happy in. Pressing it IS the
  // report. So it now always lands the cadet somewhere else, on ground he can
  // stand on (src/player/controller.js), and this is that promise measured with
  // the real key from three different kinds of place — including, deliberately,
  // the ring the defect lived in.
  const spots = [];
  const rec = await page.evaluate(() => {
    const a = window.__ascent;
    const r = a.rifts.list.find((x) => !x.locked) || a.rifts.list[0];
    return { x: r.foot.x, z: r.foot.z };
  });
  let moved = 0, tried = 0, stillSolid = 0;
  for (const rad of [10, 9.5, 24]) {
    // Stand where the defect was, then use nothing but the key a player has.
    const ok = await page.evaluate(({ rec: c, rad: d }) => {
      const a = window.__ascent;
      const x = c.x + d, z = c.z;
      const h = a.islandAt(x, z);
      if (h === null) return false;
      a.player.pos.set(x, h + 0.55, z);
      a.player.vel.set(0, 0, 0);
      return true;
    }, { rec, rad });
    if (!ok) continue;
    await page.waitForTimeout(700);
    await handBack();
    const before = await page.evaluate(() => {
      const p = window.__ascent.player;
      return { x: p.pos.x, z: p.pos.z, n: p.recoveries | 0 };
    });
    await page.keyboard.press('KeyR');
    await page.waitForTimeout(1100);
    const after = await page.evaluate(() => {
      const a = window.__ascent, p = a.player;
      return {
        x: p.pos.x, z: p.pos.z, n: p.recoveries | 0,
        ground: a.islandAt(p.pos.x, p.pos.z), grounded: !!p.grounded,
      };
    });
    tried++;
    const d = Math.hypot(after.x - before.x, after.z - before.z);
    spots.push(`${rad}m:${d.toFixed(1)}m`);
    if (after.n > before.n && d > 2) moved++;
    if (after.ground !== null) stillSolid++;
  }
  note(tried > 0 && moved === tried && stillSolid === tried,
    'Recover always visibly moves you, onto ground you can stand on',
    `${moved}/${tried} moved (${spots.join(', ')}), ${stillSolid}/${tried} onto solid ground`);
  await handBack();
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
      ui: !!a.input.uiOpen,
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
  // browser, so the camera cannot be turned — but movement is camera-relative
  // and the yaw is fixed at the arrival bearing, so these key combinations are
  // genuinely different directions off the shard, walked with nothing but the
  // keys a player has. The names are the compass; the keycaps are an accident
  // of which way the cadet happens to be facing when he lands.
  const runs = [
    { keys: ['KeyW'], label: 'straight ahead, at the gulf', glide: true },
    { keys: ['KeyW', 'KeyA'], label: 'ahead and to your left', glide: false },
    { keys: ['KeyW', 'KeyD'], label: 'ahead and to your right', glide: true },
    { keys: ['KeyA'], label: 'to your left', glide: false },
    { keys: ['KeyS'], label: 'back the way you came', glide: false },
  ];

  let left = 0, saved = 0, wedges = 0, lost = null;
  // The margin, in seconds, printed on the pass. A gate that says "ok" over a
  // number nobody can see is how this step stayed marginal for so long.
  const took = [];
  for (const run of runs) {
    await release();
    await handBack();
    // Start each attempt from solid ground, using the game's own verb.
    await page.keyboard.press('KeyR');
    await page.waitForTimeout(1000);
    await page.mouse.click(800, 450);

    await page.keyboard.down('ShiftLeft');
    for (const k of run.keys) await page.keyboard.down(k);

    let off = false, offAt = 0, back = false, wedged = false;
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
          if (g.recoveries > b.recoveries && !g.stuck && onSolid(g)) { saved++; break; }
          lost = lost || `${run.label}: wedged, and R did not free the cadet `
            + `(recoveries ${b.recoveries}->${g.recoveries}, stuck=${g.stuck}, grounded=${g.grounded})`;
          break;
        }
        if (f.ground === null && f.surface === null) {
          off = true; offAt = el; left++;
          // …and now the input that broke the last three fixes.
          if (run.glide) await page.keyboard.down('Space');
        } else if (el > REACH_S) break;
        continue;
      }
      if (onSolid(f)) { back = true; saved++; took.push(el - offAt); break; }
      if (el - offAt > CATCH_S) {
        lost = lost || `${run.label}: still out of the world `
          + `${(el - offAt).toFixed(1)}s after leaving it, at ${Math.hypot(f.x, f.z).toFixed(0)}m out, y=${f.y.toFixed(0)}`;
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
  note(!lost && saved > 0, 'a player who walks off the edge gets back',
    lost || `${saved} recoveries (${left} falls, ${wedges} wedges), all onto solid ground`
      + (took.length ? `; slowest fall ${worst.toFixed(2)}s of ${CATCH_S}s allowed `
        + `(${took.map((x) => x.toFixed(2)).join(', ')})` : ''));
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
