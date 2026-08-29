/**
 * THE SCAFFOLD-HONESTY GATE — can a learner get through without the maths?
 *
 * WHY THIS EXISTS
 *
 * A cold critic played this game and found four ways to answer a rift without
 * doing any algebra, all of them in the SUPPORT rather than in the questions:
 *
 *   1. the narrowed field greyed out a wrong reading and left the rest live,
 *      so three readings were a guaranteed seal in at most three clicks;
 *   2. the sorting bays painted the chips the same two colours as the two bay
 *      headers, so the whole board could be filed by matching hue;
 *   3. ESC WORDS promised "a proving run gives no help" and the proving run
 *      then handed over a whisper, a four-layer echo and a drop to multiple
 *      choice, under a chip still reading PROVING RUN · 2 OF 3;
 *   4. the pressure gauge read `STILL OPEN ▮▮▮▮▮ 100` from the first frame to
 *      the seal — a two-state flag wearing a hundred graduations.
 *
 * None of those is visible to a content check, because none of them is a
 * defect in an item. They live in the surface, and the only way to see them is
 * to PLAY. So this plays: it clears the save, walks to a rift with W and the
 * mouse, presses E, and types every answer on the real keypad or clicks it on
 * the real button.
 *
 * `window.__ascent` is read for facts — what the scheduler served, what the
 * answer is so it can be typed — and is never used to make anything happen.
 * Every state change below comes from a key or a click, because the path a
 * builder verifies through the debug API is never the path that is broken.
 *
 * The companion gate is `tools/critic/choiceaudit.mjs`, which proves the same
 * class statistically over thousands of generated option sets (the answer's
 * position is uniform; a wrong pick spends the whole field). This one proves
 * it once, by hand, in the running game.
 *
 *   node tools/critic/scaffoldhonesty.mjs --url http://127.0.0.1:5173
 *   tools/critic/snapshot.sh … then point --url at the frozen build
 *
 * Exit 0 = no scaffold on this rig answers the question for the learner.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { findings } from '../_findings.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/scaffold'));
const HEADED = process.argv.includes('--headed');
await mkdir(OUT, { recursive: true });

const steps = [];
const note = (ok, what, detail = '') => {
  steps.push({ ok, what, detail });
  console.log(`  ${ok ? ' ok  ' : 'FAIL '} ${what}${detail ? ' — ' + detail : ''}`);
};
/**
 * A surface the scheduler did not put in front of us this run.
 *
 * Which rift comes next is the adaptive engine's decision, and it is a
 * DIFFERENT decision for every save — that is the product working. This gate
 * is forbidden from reaching past that with the debug API, because a builder
 * who opens the surface by hand is verifying a path no player takes. So a
 * surface that never came up is reported, loudly, and is not counted as a
 * defect in it. Silence would be the wrong answer; so would a red build.
 */
const skip = (what, detail = '') => {
  steps.push({ skipped: true, what, detail });
  console.log(`  skip  ${what}${detail ? ' — ' + detail : ''}`);
};

const browser = await chromium.launch({ headless: !HEADED, args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const shot = (n) => page.screenshot({ path: path.join(OUT, n + '.png') }).catch(() => {});
const wait = (ms) => page.waitForTimeout(ms);

// ---- a cleared save, cold ---------------------------------------------------
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
await wait(4000);
await page.evaluate(() => document.querySelector('.fc-x')?.click());
await wait(600);
await page.mouse.click(800, 450);                       // hand the frame over
await wait(250);

/** Walk to the nearest open rift with W and the mouse, then press E. */
async function walkAndOpen() {
  const target = await page.evaluate(() => {
    const a = window.__ascent, p = a.player.pos;
    const list = (a.rifts?.list || []).filter((x) => !x.locked && !x.sealed);
    let best = null, bd = 1e9;
    for (const r of list) { const d = Math.hypot(r.pos.x - p.x, r.pos.z - p.z); if (d < bd) { bd = d; best = r; } }
    return best ? { x: best.pos.x, z: best.pos.z } : null;
  }).catch(() => null);
  if (!target) return false;
  let held = false, opened = false;
  for (let i = 0; i < 300 && !opened; i++) {
    const err = await page.evaluate((t) => {
      const a = window.__ascent, p = a.player.pos;
      const want = Math.atan2(t.x - p.x, t.z - p.z);
      let d = ((want - a.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (d < -Math.PI) d += Math.PI * 2;
      return { d, dist: Math.hypot(t.x - p.x, t.z - p.z) };
    }, target);
    // Turn the way a person turns: yaw error becomes mouse travel.
    if (Math.abs(err.d) > 0.06) await page.mouse.move(800 - err.d * 240, 450, { steps: 2 });
    if (!held) { await page.keyboard.down('KeyW'); held = true; }
    await wait(105);
    opened = await page.evaluate(() => !!window.__ascent.panel?.open);
    if (err.dist < 4.5) break;
  }
  if (held) await page.keyboard.up('KeyW');
  for (const k of ['KeyE', 'KeyF', 'Enter']) {
    if (opened) break;
    await page.keyboard.press(k); await wait(420);
    opened = await page.evaluate(() => !!window.__ascent.panel?.open);
  }
  return opened;
}

/** What the surface is showing. Read only; nothing here drives anything. */
const surface = () => page.evaluate(() => {
  const p = window.__ascent.panel;
  return {
    open: !!p.open, mode: p.mode, settled: !!p._settled,
    answer: String(p.item?.answer ?? ''), taskKind: p.opts?.kind || '',
    kind: document.getElementById('rf-kind').textContent.trim(),
    hintHidden: document.getElementById('rf-hint').hidden,
    echoRows: document.querySelectorAll('#rf-echo > *').length,
    strata: document.querySelectorAll('.rf-stratum.cut').length,
    gaugeHidden: document.getElementById('rf-gauge-box').hidden,
    gaugeNum: document.getElementById('rf-gauge-num').textContent,
    narrowLead: document.querySelector('.rf-narrow-lead')?.textContent || null,
    narrow: [...document.querySelectorAll('.rf-narrow .rf-reading')].map((b) => ({ v: b.dataset.value, disabled: b.disabled })),
    // WHAT A DETERMINED READER COULD GET OUT OF THE MARKUP ALONE.
    //
    // The test is not "are there attributes" — a drag system marks everything
    // it can pick up with `data-rf-drag="1"`, and a marker every chip carries
    // equally tells a reader nothing. The test is whether any attribute
    // DISTINGUISHES one loose chip from another, because that is what
    // `data-kind="var"` did. So each chip is fingerprinted by its full
    // name=value set and the fingerprints must all be identical. `class` is
    // left out here only because the skin fingerprint below already covers it.
    chipMarks: [...new Set([...document.querySelectorAll('.rf-tray .rf-chip')]
      .map((c) => [...c.attributes].filter((a) => a.name !== 'class')
        .map((a) => `${a.name}=${a.value}`).sort().join(' ')))],
    chipSkins: new Set([...document.querySelectorAll('.rf-tray .rf-chip')]
      .map((c) => getComputedStyle(c).backgroundImage + '|' + getComputedStyle(c).color + '|' + c.className)).size,
    // Same question for the area field: does a cell say what it is worth?
    cellMarks: [...new Set([...document.querySelectorAll('.rf-cell')]
      .map((c) => [...c.attributes].filter((a) => a.name !== 'class' && a.name !== 'style')
        .map((a) => `${a.name}=${a.value}`).sort().join(' ')))],
    help: document.getElementById('rf-help').textContent.trim().slice(0, 160),
  };
});

/** Type a value on the REAL keypad, key by key, then Enter. */
async function type(v) {
  for (const ch of String(v)) {
    if (ch === '-') await page.keyboard.press('Minus');
    else if (ch === '/') await page.keyboard.press('Slash');
    else if (/[0-9]/.test(ch)) await page.keyboard.press('Digit' + ch);
    else await page.keyboard.press(ch);
    await wait(40);
  }
  await page.keyboard.press('Enter');
  await wait(650);
}

/** Solve whatever is up, with real input. False when this surface is not handled. */
async function solve(st) {
  if (st.mode === 'keypad') { await type(st.answer); return true; }
  if (st.mode === 'choice') {
    const i = await page.evaluate((a) => [...document.querySelectorAll('.rf-readings .rf-reading')]
      .findIndex((b) => b.dataset.value === a), st.answer);
    if (i < 0) return false;
    await page.locator('.rf-readings .rf-reading').nth(i).click({ timeout: 5000 }).catch(() => {});
    return true;
  }
  if (st.mode === 'sort') {
    for (let k = 0; k < 12; k++) {
      const chip = await page.evaluate(() => {
        const c = document.querySelector('.rf-chip:not(.placed)');
        return c ? c.textContent.replace(/\s+/g, '') : null;
      });
      if (!chip) break;
      // Filed on the MATHEMATICS — a term with a letter in it is a term in the
      // unknown — because the surface offers nothing else to file it on.
      const isVar = /[a-zA-Z]/.test(chip);
      await page.locator('.rf-chip:not(.placed)').first().click({ timeout: 5000 }).catch(() => {});
      await wait(150);
      await page.locator('.rf-bay').nth(isVar ? 0 : 1).click({ timeout: 5000 }).catch(() => {});
      await wait(300);
    }
    return true;
  }
  return false;
}

// ======================================================== 1. keypad + field ==
let opened = await walkAndOpen();
note(opened, 'a cold player walks to a rift with W and the mouse and opens it with E');

let s = await surface();
for (let i = 0; i < 6 && opened && s.mode !== 'keypad'; i++) {
  await page.keyboard.press('Escape'); await wait(500);
  opened = await walkAndOpen(); s = await surface();
}
note(s.mode === 'keypad', 'a keypad rift is on the surface', `mode=${s.mode}`);

note(s.gaugeHidden, 'GIVEAWAY 4 — no 100-point meter on a surface that asks for one action',
  `gauge hidden=${s.gaugeHidden}`);
await shot('01-keypad-no-gauge');

const key = s.answer;
await type('987654');
note(!(await surface()).narrowLead, 'one miss does not narrow the field');
await type('765432');
const narrowed = await surface();
note(!!narrowed.narrowLead && narrowed.narrow.length >= 2,
  'two misses narrow the field, and the lead counts what is on screen',
  `${narrowed.narrow.length} readings · "${narrowed.narrowLead}"`);
const at = narrowed.narrow.findIndex((o) => o.v === key);
note(at >= 0, 'the key is among the readings', `answer "${key}" at slot ${at + 1} of ${narrowed.narrow.length}`);
await shot('02-narrowed');

const wrongIdx = narrowed.narrow.findIndex((o) => o.v !== key);
if (wrongIdx >= 0) {
  await page.locator('.rf-narrow .rf-reading').nth(wrongIdx).click({ timeout: 5000 }).catch(() => {});
  await wait(350);
}
const spent = await surface();
note(spent.narrow.length > 0 && spent.narrow.every((o) => o.disabled),
  'GIVEAWAY 1 — a wrong reading spends the WHOLE field; the list cannot be walked down',
  `${spent.narrow.filter((o) => o.disabled).length}/${spent.narrow.length} readings closed`);
await shot('03-field-spent');
await wait(1200);
note(!(await surface()).narrowLead, 'the field stands down and the keypad comes back');

await type(key);
note(await page.evaluate(() => !!window.__ascent.panel._settled),
  'and the correct value, typed, still seals the rift', `answer "${key}"`);
await shot('04-sealed');
await wait(3200);

// ========================================================= 2. proving run ==
// Played, not posed: real answers until the scheduler serves a gate item.
let proving = null, played = 0, sorted = false, fielded = false;

/** The bays and the area field, checked whenever one comes past. */
async function inspect(st) {
  if (st.mode === 'sort' && !sorted) {
    sorted = true;
    note(st.chipSkins === 1, 'GIVEAWAY 2 — every loose chip is one material; the board cannot be filed by hue',
      `${st.chipSkins} distinct chip skin(s)`);
    note(st.chipMarks.length <= 1, 'and no attribute tells one loose chip from another',
      `${st.chipMarks.length} distinct fingerprint(s): [${st.chipMarks.join('] [')}]`);
    note(!st.gaugeHidden, 'the gauge IS drawn here, because here it counts something', `reads ${st.gaugeNum}`);
    const before = st.gaugeNum;
    const chip = await page.evaluate(() => document.querySelector('.rf-tray .rf-chip')?.textContent.replace(/\s+/g, '') || '');
    await page.locator('.rf-tray .rf-chip').first().click({ timeout: 5000 }).catch(() => {});
    await wait(200);
    await page.locator('.rf-bay').nth(/[a-zA-Z]/.test(chip) ? 0 : 1).click({ timeout: 5000 }).catch(() => {});
    await wait(700);
    const after = await surface();
    note(Number(after.gaugeNum) < Number(before), 'and it MOVES when a term is filed — a real count, not a flag',
      `${before} -> ${after.gaugeNum} after filing "${chip}" by hand`);
    await shot('07-sorter');
  }
  if (st.mode === 'area' && !fielded) {
    fielded = true;
    note(st.cellMarks.length <= 1 && st.cellMarks.every((m) => m === ''),
      'the area field does not carry what each cell is worth in its markup',
      `cell fingerprints: [${st.cellMarks.join('] [')}]`);
    await shot('08-area');
  }
}

for (let i = 0; i < 60 && !proving; i++) {
  if (!(await page.evaluate(() => !!window.__ascent.panel?.open).catch(() => false))) {
    if (!(await walkAndOpen())) break;
  }
  const st = await surface();
  if (!st.open) break;
  if (st.taskKind === 'check') { proving = st; break; }
  await inspect(st);
  played++;
  if (!(await solve(st))) { await page.keyboard.press('Escape'); await wait(400); continue; }
  await wait(3600);
}

if (proving) {
  note(true, 'the scheduler served a PROVING RUN of its own accord', `after ${played} rifts · chip reads "${proving.kind}"`);
  note(proving.hintHidden, 'GIVEAWAY 3 — no ECHO button while the run is live', `hint hidden=${proving.hintHidden}`);
  note(proving.echoRows === 0 && proving.strata === 0, 'no whisper, no echo, no stratum cut',
    `echo rows=${proving.echoRows}, strata cut=${proving.strata}`);
  await shot('05-proving-live');

  if (proving.mode === 'keypad') {
    const pk = proving.answer;
    await type('987654');
    const m1 = await surface();
    note(!m1.hintHidden, 'after the first miss the item leaves the run and the help comes back', `hint hidden=${m1.hintHidden}`);
    // The CLAIM has to go, not the noun: no live "n of m" counter promising no
    // help. Naming the run it has left is the only intelligible way to say it.
    note(!/\d+\s*(of|de|z)\s*\d+/i.test(m1.kind) && m1.kind.length > 0 && m1.kind !== proving.kind,
      'and the chip stops claiming a live proving run', `"${proving.kind}" -> "${m1.kind}"`);
    note(m1.help.length > 0, 'the cadet is told why, in words', `"${m1.help}"`);
    await shot('06-proving-released');
    await type(pk);
    await wait(2600);
  } else {
    note(true, `the gate item was a ${proving.mode} surface; the help lock held`);
  }
} else {
  skip('the proving run', `the scheduler did not open one inside ${played} rifts`);
}

// ---- and the surfaces the proving run may have arrived before --------------
for (let i = 0; i < 25 && !(sorted && fielded); i++) {
  if (!(await page.evaluate(() => !!window.__ascent.panel?.open).catch(() => false))) {
    if (!(await walkAndOpen())) break;
  }
  const st = await surface();
  if (!st.open) break;
  await inspect(st);
  if (!(await solve(st))) { await page.keyboard.press('Escape'); await wait(400); continue; }
  await wait(3400);
}
if (!sorted) skip('the sorting bays, in play', 'the scheduler did not serve one this run');
if (!fielded) skip('the area field, in play', 'the scheduler did not serve one this run');

// ---- the sorting bays, POSED, in all three languages ----------------------
//
// Which skill the scheduler serves is its own decision, and a cold save on a
// short run often never reaches the bays at all — so the check above is a
// skip, not a pass. But GIVEAWAY 2 is a property of the SURFACE, not of the
// interaction: does a loose chip say, in colour or in markup, which bay it
// belongs in? That can be read off a card the harness poses, and it must hold
// in every language, because the bay headers are translated and the chips are
// not. `showItem` is the documented critic hook and it builds the item through
// the real bank and mounts the real panel; nothing here is asserted about
// anything a hand would have to do.
await page.evaluate(() => window.__ascent.panel.close());
await wait(500);
for (const loc of ['en', 'es', 'pl']) {
  await page.evaluate((l) => window.__ascent.setLocale?.(l), loc);
  await wait(400);
  const got = await page.evaluate(() => {
    try { window.__ascent.showItem('like-terms', { difficulty: 3, seed: 20260816 }); } catch { return null; }
    return window.__ascent.panel.mode;
  });
  if (got !== 'sort') { skip(`the sorting bays in ${loc}`, `the bank drew a ${got} surface`); continue; }
  await wait(1200);
  const st = await surface();
  const bayColours = await page.evaluate(() => [...document.querySelectorAll('.rf-bay .name')].map((n) => getComputedStyle(n).color));
  note(st.chipSkins === 1 && st.chipMarks.length <= 1,
    `GIVEAWAY 2 [${loc}] — one material, one fingerprint: a loose chip cannot be filed by hue`,
    `${st.chipSkins} chip skin(s), ${st.chipMarks.length} markup fingerprint(s) [${st.chipMarks.join('] [')}], `
    + `bay headers ${bayColours.join(' vs ')}`);
  // Only photograph the rig if the rig is what is on screen. A session break
  // beat can take the frame between the mount and the shutter, and a picture
  // of the world filed under `sorter-pl` is worse than no picture at all.
  if (await page.evaluate(() => document.querySelector('.rift')?.classList.contains('show'))) {
    await page.locator('.rift').screenshot({ path: path.join(OUT, `09-sorter-${loc}.png`) }).catch(() => {});
  }
  await page.evaluate(() => window.__ascent.panel.close());
  await wait(400);
}
await page.evaluate(() => window.__ascent.setLocale?.('en'));

note(errors.length === 0, 'no console errors through the whole play', errors.slice(0, 3).join(' | '));

const checked = steps.filter((x) => !x.skipped);
const failed = checked.filter((x) => !x.ok);
const skipped = steps.filter((x) => x.skipped);
console.log(`\n${checked.length - failed.length}/${checked.length} checks passed`
  + (skipped.length ? `, ${skipped.length} surface(s) not served this run` : '')
  + `  ->  ${OUT}`);
await writeFile(path.join(OUT, 'scaffold.json'), JSON.stringify({ steps, errors }, null, 2));
if (failed.length) {
  console.log('\nA scaffold on this rig answers the question for the learner. Blocking:');
  for (const x of failed) console.log(`  - ${x.what}${x.detail ? ' (' + x.detail + ')' : ''}`);
}
await browser.close();
/* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs. */
findings('check:scaffold', { scope: 'route' })
  .route(failed.map((x) => `${x.what || x.label}${x.detail ? ` (${x.detail})` : ''}`)).done();
