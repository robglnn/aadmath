/**
 * Twenty items, played with the keyboard, from a cleared save.
 *
 * The template-diversity gate in tools/validate-items.mjs simulates a session
 * against the real MasteryEngine. That is the right thing to gate a build on —
 * fast, deterministic, six abilities — but it never loads the game, so it
 * cannot prove the thing a learner actually plays serves the same sequence.
 *
 * So this walks in. Cleared localStorage, WASD and the arrows to a rift, KeyE
 * to open it, the answer typed on the keypad or clicked on the option that
 * carries it, and then out again and on to the next rift — because one rift is
 * one item, and walking between them is the loop. No `openRiftById`, no
 * injected item, no debug shortcut anywhere in the sequence. `window.__ascent`
 * is read after each item to find out what was served, which is reading a fact
 * back rather than driving the game with it.
 *
 *   node tools/critic/templatewalk.mjs [--url …] [--items 20] [--locale es]
 *
 * It prints the template of every item in the order a cadet met them and fails
 * if two consecutive items share one, if any appears more than twice inside six
 * consecutive items, or more than five times across the twenty — the same three
 * bars the item gate holds the simulated session to.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/templatewalk'));
const WANT = Number(arg('items', 20));
const LOCALE = arg('locale', null);
const WINDOW = 6, WINDOW_CAP = 2, SESSION_CAP = 5;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate((loc) => {
  try { localStorage.clear(); if (loc) localStorage.setItem('ascent.locale', loc); } catch { /* private mode */ }
}, LOCALE);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(3500);

const look = () => page.evaluate(() => ({
  open: !!window.__ascent.panel?.open,
  ui: !!window.__ascent.input?.uiOpen,
  seed: window.__ascent.panel?.item?.seed ?? null,
}));

/** A story beat has the frame. Give it back the way a player does. */
async function handBack() {
  for (const k of ['Escape', 'Enter', 'Space']) {
    await page.keyboard.press(k);
    await page.waitForTimeout(180);
    if (!(await page.evaluate(() => !!window.__ascent.input?.uiOpen))) return true;
  }
  return false;
}

/**
 * Walk to the nearest unlocked rift and open it — W held the whole way, the
 * arrows for steering, KeyE at the door. Nothing here knows any coordinates
 * the player cannot see, and nothing here opens a rift by calling anything.
 */
async function walkToARift() {
  const target = await page.evaluate(() => {
    const a = window.__ascent;
    const r = a.rifts?.list?.filter((x) => !x.locked) ?? [];
    const p = a.player.pos;
    let best = null, bd = 1e9;
    for (const x of r) {
      const d = Math.hypot(x.pos.x - p.x, x.pos.z - p.z);
      if (d < bd) { bd = d; best = x; }
    }
    return best ? { id: best.id, x: best.pos.x, z: best.pos.z } : null;
  });
  if (!target) return null;
  let held = false, opened = false;
  for (let i = 0; i < 260 && !opened; i++) {
    const st = await look();
    if (st.open) { opened = true; break; }
    if (st.ui) {
      if (held) { await page.keyboard.up('KeyW'); held = false; }
      await handBack();
      continue;
    }
    const err = await page.evaluate((t) => {
      const a = window.__ascent, p = a.player.pos;
      const want = Math.atan2(t.x - p.x, t.z - p.z);
      let d = ((want - a.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (d < -Math.PI) d += Math.PI * 2;
      return { d, dist: Math.hypot(t.x - p.x, t.z - p.z) };
    }, target);
    if (!held) { await page.keyboard.down('KeyW'); held = true; }
    if (Math.abs(err.d) > 0.10) {
      const key = err.d > 0 ? 'ArrowLeft' : 'ArrowRight';
      await page.keyboard.down(key);
      await page.waitForTimeout(Math.min(400, Math.max(60, Math.abs(err.d) / 2.0 * 1000)));
      await page.keyboard.up(key);
    } else {
      await page.waitForTimeout(120);
    }
    if (await page.evaluate(() => !!window.__ascent.panel?.open)) { opened = true; break; }
    if (err.dist < 5) {
      if (held) { await page.keyboard.up('KeyW'); held = false; }
      for (const k of ['KeyE', 'Enter']) {
        await page.keyboard.press(k);
        await page.waitForTimeout(400);
        if (await page.evaluate(() => !!window.__ascent.panel?.open)) { opened = true; break; }
      }
    }
  }
  if (held) await page.keyboard.up('KeyW');
  return opened ? target.id : null;
}

const seq = [];
let walks = 0, lastSeed = null;
for (let n = 0; n < WANT; n++) {
  // Reach an item that is not the one just answered.
  let live = null;
  for (let t = 0; t < 16 && !live; t++) {
    const id = await walkToARift();
    if (id) walks++;
    const it = await page.evaluate(() => {
      const x = window.__ascent.panel?.item;
      return x ? {
        skill: x.skill, form: x.form, rep: x.rep, skeleton: x.skeleton,
        act: (window.__ascent.formsBySkill[x.skill] || []).find((f) => f.id === x.form)?.act || null,
        answer: String(x.answer), d: x.difficulty, seed: x.seed,
      } : null;
    });
    if (it && it.seed !== lastSeed && (await page.evaluate(() => !!window.__ascent.panel?.open))) live = it;
    else await page.waitForTimeout(400);
  }
  if (!live) break;
  seq.push(live);
  lastSeed = live.seed;

  // Two in five deliberately wrong, so the schedule sees a real learner rather
  // than a machine that never misses: the bands move, proving runs open and
  // close, and the sequence is the one a person would actually be given.
  //
  // A miss does not end the item. The rift answers it — a reason, a worked
  // echo, and often the surface NARROWING to three readings to choose between —
  // and the item is not done until the panel lets go of it. So the harness
  // keeps resolving whatever is on screen, by the same two acts a player has
  // (click the reading, or press Enter), until the panel closes or moves on.
  const wrong = n % 5 === 2 || n % 5 === 4;
  const want = live.answer.replace(/\s+/g, '');
  let first = true;
  for (let t = 0; t < 16; t++) {
    const st = await look();
    if (!st.open || st.seed !== live.seed) break;
    // Only the readings a hand could actually press. Once the item is answered
    // the rift leaves them on screen and disables them, and a harness that
    // clicks one of those is waiting for something that will never happen.
    const opts = [];
    for (const o of await page.$$('.rf-reading, .rf-opt, .rf-choice button, .rf-choices button')) {
      if (await o.isEnabled().catch(() => false)) opts.push(o);
    }
    if (opts.length) {
      let idx = 0;
      for (let i = 0; i < opts.length; i++) {
        if ((await opts[i].innerText()).replace(/\s+/g, '') === want) { idx = i; break; }
      }
      // The deliberate miss is spent once, on the first attempt. After that the
      // cadet is trying, which is what a real one does.
      await opts[first && wrong ? (idx + 1) % opts.length : idx].click({ timeout: 4000 }).catch(() => {});
    } else if (first && /^-?\d+$/.test(want)) {
      const typed = wrong ? String(Number(want) + 1) : want;
      for (const ch of typed) {
        if (ch === '-') await page.keyboard.press('Minus');
        else await page.keyboard.press(ch);
        await page.waitForTimeout(35);
      }
      await page.keyboard.press('Enter');
    } else {
      await page.keyboard.press('Enter');
    }
    first = false;
    await page.waitForTimeout(750);
  }
}
await page.screenshot({ path: path.join(OUT, 'session.png') });

console.log(`${seq.length} items played on the keyboard, walking to ${walks} rift(s), from a cleared save`
  + `${LOCALE ? ` (locale ${LOCALE})` : ''}:\n`);
seq.forEach((it, i) => {
  console.log(`  ${String(i + 1).padStart(2)}  ${it.skill.padEnd(13)} d${it.d}  ${String(it.form).padEnd(16)} `
    + `${String(it.skeleton).padEnd(20)} ${it.act || ''}`);
});

/* THE ACT, WHICH IS THE GRAIN THE COMPLAINT WAS COUNTED AT.
   A player counted "6 of 14 items were 'substitute a value into a
   monomial/binomial'" while every skeleton bar below was green, because
   `eval-expr` files four notations for one substitution under four different
   skeletons. So the same three bars are held at the act grain too, and the act
   bars are the ones that must not give: see `actOf` in src/learn/generators.js
   and the DEFAULT_MASTERY block in src/learn/mastery.js. */
const acts = new Map();
for (const it of seq) if (it.act) acts.set(it.act, (acts.get(it.act) || 0) + 1);
if (acts.size) {
  console.log(`\n  ${acts.size} distinct ACTS over ${seq.length} items`);
  console.log('  ' + [...acts.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} x${v}`).join('   '));
}

const total = new Map();
for (const it of seq) total.set(it.skeleton, (total.get(it.skeleton) || 0) + 1);
console.log(`\n  ${total.size} distinct templates over ${seq.length} items`);
console.log('  ' + [...total.entries()].sort((a, b) => b[1] - a[1]).map(([k, v]) => `${k} ×${v}`).join('   '));

const problems = [];
for (let i = 1; i < seq.length; i++) {
  if (seq[i].skeleton === seq[i - 1].skeleton) problems.push(`items ${i} and ${i + 1} are both "${seq[i].skeleton}"`);
  if (seq[i].act && seq[i].act === seq[i - 1].act) {
    problems.push(`items ${i} and ${i + 1} ask the learner to do the same thing: "${seq[i].act}"`);
  }
}
for (let a = 0; a + WINDOW <= seq.length; a++) {
  const c = new Map();
  for (let b = a; b < a + WINDOW; b++) if (seq[b].act) c.set(seq[b].act, (c.get(seq[b].act) || 0) + 1);
  for (const [k, v] of c) if (v > WINDOW_CAP) problems.push(`"${k}" asked ${v} times inside items ${a + 1}-${a + WINDOW}`);
}
for (let a = 0; a + WINDOW <= seq.length; a++) {
  const c = new Map();
  for (let b = a; b < a + WINDOW; b++) c.set(seq[b].skeleton, (c.get(seq[b].skeleton) || 0) + 1);
  for (const [k, v] of c) if (v > WINDOW_CAP) problems.push(`"${k}" ${v} times inside items ${a + 1}-${a + WINDOW}`);
}
for (const [k, v] of total) if (v > SESSION_CAP) problems.push(`"${k}" ${v} times in ${seq.length} items`);
if (seq.length < WANT) problems.push(`only ${seq.length} of ${WANT} items were played`);
for (const e of errors.slice(0, 3)) problems.push(`console error: ${e}`);

console.log(errors.length ? `\n  ${errors.length} console errors` : '\n  0 console errors');
await browser.close();
if (problems.length) {
  console.error('\nFAIL — the running game repeats a template:');
  problems.forEach((p) => console.error('  ' + p));
  process.exit(1);
}
console.log('\nPASS — no template twice running, none more than twice in six, none more than five in twenty\n');
