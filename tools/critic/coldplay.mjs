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

// --- 5. A player who walks off the edge gets back ---------------------------
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
{
  const CATCH_S = 6;              // seconds allowed between leaving and landing
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
      await page.waitForTimeout(250);
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
      if (onSolid(f)) { back = true; saved++; break; }
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

  await shot('04-edge');
  // A GATE THAT PROVED NOTHING MUST NOT PASS. If no direction reached open air,
  // the assertion under it never ran, and reporting that as a pass is precisely
  // the shape of every false fix this defect has already survived.
  note(left >= 1, 'a cold player can actually walk off this shard',
    left >= 1 ? `${left} of ${runs.length} directions reach open air, ${wedges} wedge on the way`
      : 'never left the world in any direction — the test below proved nothing');
  note(!lost && saved > 0, 'a player who walks off the edge gets back',
    lost || `${saved} recoveries (${left} falls, ${wedges} wedges), all onto solid ground inside ${CATCH_S}s`);
}

// --- 6. Console health ------------------------------------------------------
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
