/**
 * THE REPORT CONSISTENCY GATE.
 *
 * Every other report tool measures how the screen LOOKS. This one measures
 * whether the numbers on it can all be true at the same time.
 *
 * It exists because a cold critic opened one session and found four figures
 * that contradicted each other on the same card:
 *
 *   · "4 min THIS SESSION" at wall-clock minute 16;
 *   · "TESTED OUT · this line proved out on first contact" printed above
 *     "QUESTIONS HERE 12" and "SOLVED UNAIDED 83%";
 *   · a confidence percentage on a line with zero attempts;
 *   · a wallet counter labelled "left" that only ever went up.
 *
 * None of those is a rendering bug. Each one is two true-ish numbers put beside
 * each other with no rule saying they have to agree. So this file is that rule,
 * written down and executed.
 *
 * HOW IT DRIVES
 *
 * With the keyboard and the mouse, from a cleared save, exactly as
 * tools/critic/coldplay.mjs does and for the same reason: three rounds of
 * agents "fixed" this game through `window.__ascent` and verified the path a
 * player never walks. `__ascent` is read here — never driven — and only to
 * learn the answer a student who knew the algebra would already have, and to
 * read the learner model back at the end so the screen can be checked against
 * it.
 *
 *   node tools/critic/repcheck.mjs [--url http://127.0.0.1:5173] [--headed]
 *                                  [--out shots/repcheck] [--minutes 17]
 *
 * Exit 0 = every figure on the report agrees with every other figure and with
 * the learner model underneath it. Exit 1 = it does not, and the violation is
 * named.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { auditReport, auditLedgerStrip, fmt } from './_repassert.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/repcheck'));
const HEADED = process.argv.includes('--headed');
/** How long the drive runs before the last checkpoint, in wall-clock minutes. */
const MINUTES = Number(arg('minutes', '17'));

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: !HEADED,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, locale: 'en-US' });
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

const sleep = (ms) => page.waitForTimeout(ms);
const checkpoints = [];
const violations = [];
const fail = (where, msg) => { violations.push(`${where}: ${msg}`); console.log(`  VIOLATION  ${where}: ${msg}`); };

// --- a cleared save, and the wall clock starts here --------------------------
await page.goto(URL, { waitUntil: 'load' });
await page.evaluate(() => { try { localStorage.clear(); } catch { /* private */ } });
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
const T0 = Date.now();
await sleep(4500);

// ---------------------------------------------------------------------------
// Real input
// ---------------------------------------------------------------------------

/** Aim at a world point the way a hand does, then hold W. Reads position only. */
async function walkToNearestRift(maxSteps = 260) {
  const target = await page.evaluate(() => {
    const a = window.__ascent;
    const r = (a.rifts?.list || []).filter((x) => !x.locked);
    if (!r.length) return null;
    const p = a.player.pos;
    let best = null; let bd = 1e9;
    for (const x of r) {
      const d = Math.hypot(x.pos.x - p.x, x.pos.z - p.z);
      if (d < bd) { bd = d; best = x; }
    }
    return best ? { id: best.id, x: best.pos.x, z: best.pos.z, dist: bd } : null;
  });
  if (!target) return false;
  await page.mouse.move(720, 450);
  await page.mouse.click(720, 450);
  await sleep(250);
  let held = false;
  for (let i = 0; i < maxSteps; i++) {
    if (await panelOpen()) break;
    const err = await page.evaluate((tg) => {
      const a = window.__ascent; const p = a.player.pos;
      const want = Math.atan2(tg.x - p.x, tg.z - p.z);
      let d = ((want - a.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (d < -Math.PI) d += Math.PI * 2;
      return { d, dist: Math.hypot(tg.x - p.x, tg.z - p.z) };
    }, target);
    if (Math.abs(err.d) > 0.06) await page.mouse.move(720 - err.d * 240, 450, { steps: 2 });
    if (!held) { await page.keyboard.down('KeyW'); held = true; }
    await sleep(110);
    if (err.dist < 4) break;
  }
  if (held) await page.keyboard.up('KeyW');
  for (const key of ['KeyE', 'KeyF', 'Enter', 'Space']) {
    if (await panelOpen()) break;
    await page.keyboard.press(key);
    await sleep(420);
  }
  return panelOpen();
}

const panelOpen = () => page.evaluate(() => !!window.__ascent.panel?.open);

/**
 * Answer the item on screen with the keyboard and the mouse.
 *
 * The answer itself is read off the item — this stands in for a student who
 * knows the algebra — but every keystroke and click below is real, so the
 * commit path being exercised is the player's.
 */
async function answerOnce(correct = true) {
  const info = await page.evaluate(() => {
    const p = window.__ascent.panel;
    if (!p?.open || !p.item || p._settled) return null;
    const wrong = (p.item.distractors || [])[0];
    return {
      mode: p.mode,
      answer: String(p.item.answer),
      wrong: wrong ? String(wrong.value ?? wrong.v ?? '') : '',
    };
  });
  if (!info) return null;
  const want = correct ? info.answer : (info.wrong || info.answer + '9');

  if (info.mode === 'keypad') {
    // The socket accepts digits, a sign, a slash, a plus, a caret and the
    // variable. Type it a character at a time, then commit with Enter.
    for (const ch of want.split('')) {
      if (ch === ' ') continue;
      await page.keyboard.press(ch === '^' ? '^' : ch);
      await sleep(35);
    }
    await page.keyboard.press('Enter');
  } else if (info.mode === 'choice') {
    const sel = `.rf-reading[data-value="${cssEscape(want)}"]`;
    const has = await page.locator(sel).count();
    if (has) await page.locator(sel).first().click();
    else await page.locator('.rf-reading').first().click();
  } else {
    // A surface this driver has no hand for. Fall back to the panel's own
    // hand — still the real commit path, just not the real pointer. Recorded,
    // so the coverage of this gate is never overstated.
    const ok = await page.evaluate((c) => window.__ascent.panel.demo(c ? 'right' : 'wrong'), correct);
    if (!ok) return null;
    handed.add(info.mode);
  }
  await sleep(650);
  return info.mode;
}
const handed = new Set();
const cssEscape = (s) => s.replace(/["\\]/g, '\\$&');

/**
 * The session's own beats take the floor and must be answered before the world
 * comes back: the orders card at the top of a run, the close card when the goal
 * lands, the rest beat after it. A player clicks through them, so this clicks
 * through them — with the real pointer, on the real buttons. A driver that
 * cannot get past the close card measures the first three minutes of the game
 * and calls it a session, which is how the last run stopped at minute three.
 */
async function clearTakeovers() {
  // Wedged in the scenery. The card names its own key, so press it.
  if (await page.locator('.fcs.show').count().catch(() => 0)) {
    await page.keyboard.press('KeyR');
    await sleep(800);
    return true;
  }
  for (const sel of ['.sc-go', '.sx-more', '.sr-again', '.sr-skip']) {
    const el = page.locator(sel).first();
    if (!(await el.count().catch(() => 0))) continue;
    if (!(await el.isVisible().catch(() => false))) continue;
    // A real pointer at the real coordinates, rather than Playwright's
    // actionability click: these cards live inside their own scroll container
    // and a strict click waits for ever on a parent that "intercepts pointer
    // events", which killed a seventeen-minute drive at minute nine.
    const box = await el.boundingBox().catch(() => null);
    if (box) await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2).catch(() => {});
    else await el.click({ force: true, timeout: 3000 }).catch(() => {});
    await sleep(900);
    return true;
  }
  return false;
}

/** Close a sealed rift and walk to the next one, with keys. */
async function advance() {
  if (await panelOpen()) {
    await page.keyboard.press('Escape');
    await sleep(500);
  }
  if (await clearTakeovers()) return panelOpen().then((o) => o || walkToNearestRift());
  return walkToNearestRift();
}

// ---------------------------------------------------------------------------
// The report, opened the way a player opens it: the P key.
// ---------------------------------------------------------------------------
async function openReport() {
  for (let i = 0; i < 30; i++) {
    if (await page.evaluate(() => !!document.querySelector('.rp-scrim.show'))) return true;
    if (await panelOpen()) { await page.keyboard.press('Escape'); await sleep(400); }
    await clearTakeovers();
    await page.keyboard.press('KeyP');
    await sleep(500);
  }
  return false;
}
async function closeReport() {
  for (let i = 0; i < 6; i++) {
    if (!await page.evaluate(() => !!document.querySelector('.rp-scrim.show'))) return;
    await page.keyboard.press('Escape');
    await sleep(350);
  }
}

/**
 * One checkpoint: the screen, the numbers the screen printed, the data behind
 * them and the learner model underneath that.
 */
async function checkpoint(tag) {
  const opened = await openReport();
  if (!opened) { fail(tag, 'the report never opened on the P key'); return null; }
  await sleep(500);
  await page.screenshot({ path: path.join(OUT, `${tag}-report.png`) });

  // Open every skill row so the evidence cards are on screen and in the text.
  await page.evaluate(() => {
    for (const r of document.querySelectorAll('.rp-skill .rp-row')) {
      if (r.getAttribute('aria-expanded') !== 'true') r.click();
    }
  });
  await sleep(600);
  await page.screenshot({ path: path.join(OUT, `${tag}-evidence.png`), fullPage: true });

  const cap = await page.evaluate(() => {
    const a = window.__ascent;
    const card = document.querySelector('.rp-card');
    const rowText = (el) => (el?.innerText || '').replace(/\s+/g, ' ').trim();
    return {
      wallNow: Date.now(),
      text: card?.innerText || '',
      strip: [...document.querySelectorAll('.rp-strip .rp-strip-i')].map(rowText),
      next: rowText(document.querySelector('.rp-nx-why')),
      tiles: [...document.querySelectorAll('.rp-stats .rp-tile')].map((d) => ({
        lab: d.querySelector('.rp-t-lab')?.textContent || '',
        val: (d.querySelector('.rp-t-val b')?.textContent || '') + ' ' + (d.querySelector('.rp-t-val i')?.textContent || ''),
        note: d.querySelector('.rp-t-note')?.textContent || '',
      })),
      rows: [...document.querySelectorAll('.rp-skill')].map((art) => ({
        state: art.dataset.state,
        name: art.querySelector('.rp-name')?.textContent || '',
        tag: art.querySelector('.rp-tag')?.textContent || '',
        road: art.querySelector('.rp-road')?.textContent || '',
        pct: art.querySelector('.rp-pct')?.textContent || '',
        facts: [...art.querySelectorAll('.rp-detail .rp-facts dt')].map((dt, i) => ({
          k: dt.textContent,
          v: art.querySelectorAll('.rp-detail .rp-facts dd')[i]?.textContent || '',
        })),
        evidence: [...art.querySelectorAll('.rp-ev-row')].map((li) => ({
          lab: li.querySelector('.rp-ev-lab')?.textContent || '',
          val: li.querySelector('.rp-ev-val')?.textContent || '',
          note: li.querySelector('.rp-ev-note')?.textContent || '',
        })),
        sum: art.querySelector('.rp-ev-sum')?.textContent || '',
      })),
      snapshot: a.report.snapshot(),
      ledger: JSON.parse(localStorage.getItem('ascent.report') || 'null'),
      save: JSON.parse(localStorage.getItem('ascent.save') || 'null'),
      model: a.mastery.save().skills,
      session: a.session.state(),
      wallet: a.state().shards,
      ledgerLog: a.ledger?.() || null,
    };
  });
  cap.tag = tag;
  cap.wallMs = cap.wallNow - T0;
  checkpoints.push(cap);
  console.log(`\n--- ${tag} · wall clock ${fmt.mins(cap.wallMs)} ---`);
  console.log('  strip: ' + cap.strip.join('  |  '));
  for (const v of auditReport(cap)) fail(tag, v);
  await closeReport();
  return cap;
}

// ---------------------------------------------------------------------------
// The drive
// ---------------------------------------------------------------------------
console.log('walking to the first rift with the keyboard…');
const reached = await walkToNearestRift();
if (!reached) fail('drive', 'a cold player could not reach and open the first rift with keys alone');

let answered = 0;
let stalled = 0;
/** Steps the world refused. Reported, never fatal — see the loop below. */
const hiccups = [];
const marks = [
  { at: 3 * 60_000, tag: 't1-early', done: false },
  { at: 9 * 60_000, tag: 't2-mid', done: false },
  { at: MINUTES * 60_000, tag: 't3-late', done: false },
];
// A fourth checkpoint that is not on the clock: the instant the first line is
// held. This is the exact screen a cold reader photographed — one line held,
// the next line named as what comes next, and that next line untouched. It is
// the only moment in a session when an UNLOCKED, UNANSWERED line is on screen,
// and it is where "Evaluating expressions · OPEN · 80%" was printed for a skill
// with zero attempts. A clock-driven drive walks straight past it.
let firstClaimDone = false;

while (Date.now() - T0 < MINUTES * 60_000 + 20_000) {
  if (!firstClaimDone) {
    const held = await page.evaluate(() => Object.values(window.__ascent.mastery.save().skills)
      .filter((s) => s.mastered).length).catch(() => 0);
    if (held > 0) { firstClaimDone = true; await checkpoint('t0-firstclaim'); }
  }
  const due = marks.find((m) => !m.done && Date.now() - T0 >= m.at);
  if (due) { due.done = true; await checkpoint(due.tag); }
  if (marks.every((m) => m.done)) break;

  // The world is allowed to misbehave — a card that will not take a click, a
  // ring that never opens. None of that is a reason to stop the clock, because
  // the clock is what this gate measures. Every step is guarded and the drive
  // keeps walking; only the checkpoints and the assertions can fail this tool.
  try {
    if (!await panelOpen()) {
      const ok = await advance();
      if (!ok) { stalled += 1; await sleep(1500); if (stalled > 90) break; continue; }
      stalled = 0;
    }
    // A real learner is not a metronome: every seventh item is genuinely wrong.
    const mode = await answerOnce(answered % 7 !== 6);
    if (mode == null) { await sleep(700); continue; }
    answered += 1;
    await sleep(500);
  } catch (e) {
    hiccups.push(String(e.message || e).slice(0, 120));
    await sleep(1200);
  }
}
for (const m of marks) if (!m.done) { m.done = true; await checkpoint(m.tag); }

// ---------------------------------------------------------------------------
// The ledger strip: a counter has to count what its label says.
// ---------------------------------------------------------------------------
const strip = await page.evaluate(() => window.__ascent.ledger?.() || null);
for (const v of auditLedgerStrip(strip)) fail('ledger', v);

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------
if (errors.length) fail('console', `${errors.length} console error(s): ${errors.slice(0, 3).join(' | ')}`);

await writeFile(path.join(OUT, 'repcheck.json'),
  JSON.stringify({ answered, minutes: (Date.now() - T0) / 60000, handedModes: [...handed], hiccups, violations, errors, checkpoints }, null, 2));

console.log(`\nanswered ${answered} items over ${fmt.mins(Date.now() - T0)}`);
if (handed.size) console.log(`surfaces driven through the panel rather than the pointer: ${[...handed].join(', ')}`);
if (hiccups.length) console.log(`${hiccups.length} step(s) the world refused (not failures): ${hiccups[0]}`);
console.log(violations.length
  ? `\n${violations.length} figure(s) on the report contradict something else:\n  - ` + violations.join('\n  - ')
  : '\nEvery figure on the report agrees with every other figure and with the learner model.');
await browser.close();
process.exit(violations.length ? 1 : 0);
