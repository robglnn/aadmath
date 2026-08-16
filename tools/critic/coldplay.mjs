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

// --- 6. THE SCHOOL LAPTOP: the browser refuses the pointer lock -------------
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

  // 6b. It says so, in words, on the card — and the card stops advertising a
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

  // 6c. The arrow keys turn the camera. No mouse is touched.
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

  // 6d. …and so does a click-drag, which is what a hand tries first.
  const yB = await yaw();
  await p2.mouse.move(800, 450);
  await p2.mouse.down();
  await p2.mouse.move(300, 450, { steps: 16 });
  await p2.mouse.up();
  await p2.waitForTimeout(250);
  const turnedDrag = Math.abs((await yaw()) - yB);
  note(turnedDrag > 0.5, 'CLICK-DRAG turns the view with no pointer lock',
    `${turnedDrag.toFixed(2)} rad over 500px`);

  // 6e. THE WHOLE POINT: face a rift you were told about, reach it, seal it —
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
  await p2.screenshot({ path: path.join(OUT, '05-nolock-rift.png') });
  note(arrived && opened2,
    'with NO pointer lock, a player can turn, reach a rift and open it',
    target ? `${target.id}, ${target.dist.toFixed(0)}m away, arrows only` : 'no unlocked rift');

  // 6f. …and finish a piece of mathematics inside it. Reading the answer off
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
  await p2.screenshot({ path: path.join(OUT, '06-nolock-item.png') });
  note(sealed, 'with NO pointer lock, a player can complete an item',
    sealed ? 'answered and registered' : 'the item never registered an attempt');

  await ctx2.close();
}

// --- 7. Console health ------------------------------------------------------
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
