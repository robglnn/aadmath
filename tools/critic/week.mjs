/**
 * THE RETURNING PLAYER'S WEEK — fifteen mornings, real keys, real page loads.
 *
 * The client's goal, verbatim: *"i want the game to be fun enough its worth the
 * struggles and advancement of learning to play more of the game, rather than
 * just compulsary assignment by teachers."* Blind critics moved this build from
 * "would I open it a second time? no" to "fourth, yes; fifth, no", and then to
 * the sentence this harness exists to answer:
 *
 *   "by then I would hold all six grants, shards would be confetti, and the
 *    island would still be scenery with pickups on it"
 *   "day 15 is the same ten lines and a station price that went up"
 *
 * So it plays the week and reports, per morning, **what is materially different
 * from the morning before**. A morning with nothing in it prints NOTHING, in
 * capitals, because that is the finding.
 *
 * THE RULES IT PLAYS BY — the same ones coldplay.mjs and day5.mjs play by:
 *
 *   · Every morning is a REAL PAGE LOAD against the same origin, with the wall
 *     clock shifted before the bundle runs. Everything decided at boot — the
 *     day ledger, the gap, the greeting, the day's assay, the standing mark —
 *     is therefore decided the way it is decided for a real returning player.
 *     A harness that never restarts the page never tests any of it.
 *   · The cadet MOVES with WASD and answers with the real answer surfaces.
 *     Nothing is teleported and no answer is fabricated.
 *   · The ONLY debug calls used are `session.chargeTo`, which winds the
 *     session's twenty-five minute work clock and nothing else, and `state`
 *     readers. Neither makes progress: every item is still answered, every day
 *     is still opened by playing.
 *
 * It screenshots the close card on days 1, 5 and 15, which are the three the
 * client asked to see side by side.
 *
 *   node tools/critic/week.mjs [--url http://127.0.0.1:4488] [--out shots/week]
 *
 * Exit 0 = no morning in the week is empty, and no console errors.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4488');
const OUT = path.resolve(arg('out', 'shots/week'));
const DAYS = Number(arg('days', 15));
const SHOT_DAYS = (arg('shots', '1,5,15')).split(',').map(Number);
const ITEMS = Number(arg('items', 4));
/** Milliseconds one walk to one tear may take before the harness gives up. */
const REACH_MS = Number(arg('reach', 22000));
const W = 1600, H = 900;
const DAY = 86400000;

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: !process.argv.includes('--headed'),
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
const errors = [];
const rows = [];

for (let d = 0; d < DAYS; d++) {
  const day = d + 1;
  const began = Date.now();
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(`d${day}: ${e.message}`));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(`d${day}: ${m.text()}`); });
  await page.addInitScript((ms) => { const real = Date.now; Date.now = () => real() + ms; }, d * DAY);
  if (d === 0) await page.addInitScript(() => { try { localStorage.clear(); } catch { /* private */ } });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.waitForTimeout(3600);

  const K = keys(page);

  /* THE ORDERS CARD IS READ BEFORE THE FRAME IS CLEARED, because clearing the
     frame is what dismisses it. A first draft called `clearFrame` first and
     then went looking for the card it had just clicked away, and reported that
     the game never greets a returning player. The card can take a moment to
     arrive — the session holds it behind the cold open — so it is waited for
     rather than sampled. */
  await page.waitForSelector('.ses-charter.show', { timeout: 16000 }).catch(() => {});
  const opening = await page.evaluate(() => {
    const el = document.querySelector('.ses-charter.show');
    return el ? { back: el.querySelector('.sc-back')?.innerText || '', mark: el.classList.contains('mark') } : null;
  });
  if (SHOT_DAYS.includes(day)) await page.screenshot({ path: path.join(OUT, `d${String(day).padStart(2, '0')}-a-orders.png`) });

  await K.clearFrame(3);
  await K.calibrate();

  // ---- real work: walk to tears and answer them with real input ----------
  let answered = 0;
  for (let i = 0; i < ITEMS; i++) {
    if (await K.workOneRift()) answered++;
    else break;
  }

  // ---- the close, off the real clock -------------------------------------
  // `chargeTo` is the session's own critic hook: twenty-five minutes is
  // twenty-five minutes and a harness cannot sit through it. It winds the work
  // clock; `shouldClose()` and everything the card says are the real thing
  // reacting to it. No answer, no seal and no day is fabricated by it.
  await page.evaluate(() => { window.__ascent.session.chargeTo(26); });
  await page.waitForSelector('.ses-close.show', { timeout: 12000 }).catch(() => {});
  await page.waitForTimeout(1200);
  const card = await page.evaluate(() => {
    const el = document.querySelector('.ses-close.show');
    if (!el) return null;
    return {
      kick: el.querySelector('.sx-kick')?.innerText || '',
      title: el.querySelector('.sx-title')?.innerText || '',
      tally: el.querySelector('.sx-tally')?.innerText.replace(/\n/g, ' ') || '',
      blocks: ['held', 'open', 'next'].map((b) => ({
        label: el.querySelector('.sx-' + b + ' h3')?.innerText || '',
        rows: [...el.querySelectorAll('.sx-' + b + ' li')].map((li) => li.innerText.replace(/\n/g, ' — ')),
      })),
      sign: el.querySelector('.sx-sign')?.innerText || '',
    };
  });
  if (SHOT_DAYS.includes(day)) {
    await page.screenshot({ path: path.join(OUT, `d${String(day).padStart(2, '0')}-b-close.png`) });
  }

  const s = await page.evaluate(() => {
    const A = window.__ascent, st = A.story.state(), k = A.kit.state();
    return {
      rank: st.rank, chapter: st.chapter, nights: st.nights, days: st.days,
      depth: k.depth, lines: k.lines, grants: (k.held || []).slice(),
      charters: k.charters, stations: k.stations, price: k.prices.station,
      shards: A.state().shards, mark: !!k.mark, kept: st.order?.kept ?? 0,
      order: st.order?.order?.skill ?? null,
      fps: A.state().perf?.fps ?? null,
    };
  });
  rows.push({ day, answered, opening, card, secs: Math.round((Date.now() - began) / 1000), ...s });
  console.log(`day ${String(day).padStart(2)}  ${String(s.rank).padEnd(9)} ch${s.chapter}  n${String(s.nights).padStart(2)}  depth ${String(s.depth).padStart(3)}  grants ${String(s.grants.length).padStart(2)}  chart ${s.charters}  stn ${s.stations}  price ${String(s.price).padStart(4)}  shards ${String(s.shards).padStart(6)}  marks kept ${String(s.kept).padStart(2)}  mark ${s.mark ? 'UP' : '--'}  answered ${answered}  ${Math.round((Date.now() - began) / 1000)}s`);
  await page.close();
}

// ---------------------------------------------------------------- the verdict
console.log('\n--- what is materially different, morning by morning ---');
const empty = [];
for (let i = 1; i < rows.length; i++) {
  const a = rows[i - 1], b = rows[i];
  const diff = [];
  if (b.rank !== a.rank) diff.push(`RANK -> ${b.rank}`);
  if (b.chapter !== a.chapter) diff.push(`CHAPTER -> ${b.chapter}`);
  const got = b.grants.filter((g) => !a.grants.includes(g));
  if (got.length) diff.push(`NEW VERB: ${got.join(', ')}`);
  if (b.kept !== a.kept) diff.push(`MARK CLEARED (${a.kept} -> ${b.kept})`);
  if (b.charters !== a.charters) diff.push(`CHARTER (${a.charters} -> ${b.charters})`);
  if (b.stations !== a.stations) diff.push(`WAYSTATION RAISED (${a.stations} -> ${b.stations})`);
  if (b.lines !== a.lines) diff.push(`LINES ${a.lines} -> ${b.lines}`);
  if (!diff.length) empty.push(b.day);
  console.log(`  day ${String(b.day).padStart(2)}: ${diff.length ? diff.join(' · ') : 'NOTHING'}`);
}

console.log('\n--- the close card, on the three days the client asked for ---');
for (const d of SHOT_DAYS) {
  const r = rows.find((x) => x.day === d);
  if (!r || !r.card) { console.log(`  day ${d}: NO CLOSE CARD`); continue; }
  console.log(`\n  DAY ${d} — ${r.card.kick} · ${r.card.title} · ${r.card.tally}`);
  if (r.opening?.back) console.log(`    opened with: ${r.opening.back}`);
  for (const b of r.card.blocks) {
    console.log(`    ${b.label}`);
    for (const line of b.rows) console.log(`      · ${line}`);
  }
}

await writeFile(path.join(OUT, 'report.json'), JSON.stringify({ rows, errors, empty }, null, 2));
console.log(`\nempty mornings: ${empty.length}${empty.length ? ' -> ' + empty.join(', ') : ''}`);
console.log(`console errors: ${errors.length}`);
for (const e of errors.slice(0, 8)) console.log('   ' + e);
await browser.close();
process.exit(errors.length || empty.length ? 1 : 0);

// ---------------------------------------------------------------------------
// Real input. Lifted wholesale from day5.mjs, which is the standard this repo
// holds day-based claims to: eight-way WASD calibrated against the running
// build, because headless Chromium refuses pointer lock more often than it
// grants it and a harness that steers only with the mouse never turns at all.
// ---------------------------------------------------------------------------
function keys(page) {
  let strafeSign = 1;
  let downNow = new Set();

  const hold = async (want) => {
    const w = new Set(want);
    for (const k of downNow) if (!w.has(k)) await page.keyboard.up(k).catch(() => {});
    for (const k of w) if (!downNow.has(k)) await page.keyboard.down(k).catch(() => {});
    downNow = w;
  };

  const keysFor = (rel) => {
    const out = [];
    if (Math.cos(rel) > 0.38) out.push('KeyW');
    else if (Math.cos(rel) < -0.38) out.push('KeyS');
    const side = Math.sin(rel);
    if (side > 0.38) out.push(strafeSign > 0 ? 'KeyD' : 'KeyA');
    else if (side < -0.38) out.push(strafeSign > 0 ? 'KeyA' : 'KeyD');
    return out.length ? out : ['KeyW'];
  };

  const panelInfo = () => page.evaluate(() => window.__ascent.panelInfo());

  async function clearFrame(tries = 6) {
    const CARDS = ['.fdy.show .fdy-close', '.ses-charter.show .sc-go', '.ses-close.show .sx-rest',
      '.ses-rest.show .sr-skip', '.ses-rest.show .sr-off'];
    for (let i = 0; i < tries; i++) {
      for (const sel of CARDS) {
        const b = page.locator(sel).first();
        if (!(await b.count())) continue;
        if (!(await b.isVisible().catch(() => false))) continue;
        if (await b.click({ timeout: 1500 }).then(() => true).catch(() => false)) await page.waitForTimeout(500);
      }
      if ((await panelInfo()).open || await page.evaluate(() => !!window.__ascent.input.uiOpen)) {
        await page.keyboard.press('Escape');
        await page.waitForTimeout(400);
      }
      await page.evaluate(() => document.activeElement?.blur?.());
      const a = await page.evaluate(() => ({ ...window.__ascent.player.pos }));
      await hold(['KeyW']); await page.waitForTimeout(650); await hold([]);
      const b2 = await page.evaluate(() => ({ ...window.__ascent.player.pos }));
      if (Math.hypot(b2.x - a.x, b2.z - a.z) > 0.6) return true;
      await page.mouse.click(W / 2, H / 2);
      await page.waitForTimeout(350);
    }
    return false;
  }

  async function calibrate() {
    const a = await page.evaluate(() => ({ x: window.__ascent.player.pos.x, z: window.__ascent.player.pos.z }));
    await hold(['KeyD']); await page.waitForTimeout(600); await hold([]);
    const b = await page.evaluate(() => ({
      x: window.__ascent.player.pos.x, z: window.__ascent.player.pos.z, yaw: window.__ascent.player.yaw,
    }));
    if (Math.hypot(b.x - a.x, b.z - a.z) < 0.4) return false;
    let rel = ((Math.atan2(b.x - a.x, b.z - a.z) - b.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (rel < -Math.PI) rel += Math.PI * 2;
    strafeSign = rel > 0 ? 1 : -1;
    return true;
  }

  /** Walk to the nearest open tear with real keys, open it, and answer once. */
  async function workOneRift() {
    // The rift objects carry their position on `pos`, not on the rift itself —
    // reading `x.x` gives undefined and steers the cadet at the origin, which
    // is how a first draft of this harness photographed a game that had frozen.
    const target = await page.evaluate(() => {
      const a = window.__ascent;
      const r = (a.rifts?.list || []).filter((x) => !x.locked);
      if (!r.length) return null;
      const p = a.player.pos;
      let best = null, bd = 1e9;
      for (const x of r) {
        const d = Math.hypot(x.pos.x - p.x, x.pos.z - p.z);
        if (d < bd) { bd = d; best = x; }
      }
      return best ? { id: best.id, x: best.pos.x, z: best.pos.z } : null;
    });
    if (!target) return false;
    const t0 = Date.now();
    let stall = 0, wedged = 0, lastDist = Infinity;
    await page.keyboard.down('ShiftLeft');
    try {
      while (Date.now() - t0 < REACH_MS) {
        if ((await panelInfo()).open) break;
        const err = await page.evaluate((tt) => {
          const a = window.__ascent, p = a.player.pos;
          let d = ((Math.atan2(tt.x - p.x, tt.z - p.z) - a.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
          if (d < -Math.PI) d += Math.PI * 2;
          return { d, dist: Math.hypot(tt.x - p.x, tt.z - p.z) };
        }, target);
        if (err.dist < 4.5) { await hold([]); await page.keyboard.press('KeyE'); await page.waitForTimeout(900); break; }

        /* CAUGHT ON SOMETHING — the correction day5.mjs already carries and a
           first draft of this file did not. A running cadet who has not gained
           a metre in three seconds is standing against a step; a player jumps,
           and then presses the game's own Recover key. Without this the harness
           leans on a hillside for its whole budget and then reports a day on
           which the learner answered nothing, which is a photograph of the
           harness rather than of the game. */
        if (++stall % 27 === 0) {
          if (err.dist > lastDist - 1) {
            await page.keyboard.press('Space');
            await page.waitForTimeout(120);
            if (++wedged >= 3) { wedged = 0; await page.keyboard.press('KeyR'); await page.waitForTimeout(900); }
          } else wedged = 0;
          lastDist = err.dist;
        }

        await hold(keysFor(err.d));
        await page.waitForTimeout(110);
      }
    } finally { await hold([]); await page.keyboard.up('ShiftLeft'); }

    // …and answer it, on the real surface, with the game's own checker deciding.
    for (let i = 0; i < 3; i++) {
      const c = await panelInfo();
      if (!c || !c.open) break;
      if (c.mode === 'choice') {
        const btns = page.locator('.rf-reading');
        const n = await btns.count();
        let hit = false;
        for (let j = 0; j < n; j++) {
          if (String(await btns.nth(j).getAttribute('data-value')) === String(c.answer)) {
            await btns.nth(j).click({ timeout: 4000 }).catch(() => {}); hit = true; break;
          }
        }
        if (!hit) break;
      } else if (c.mode === 'keypad') {
        for (const ch of String(c.answer ?? '')) {
          if (ch === '-') await page.keyboard.press('Minus');
          else if (ch === '/') await page.keyboard.press('Slash');
          else if (ch === '+') await page.keyboard.press('Equal');
          else if (ch === '^') await page.keyboard.press('Digit6');
          else await page.keyboard.press(ch);
          await page.waitForTimeout(35);
        }
        await page.keyboard.press('Enter');
      } else {
        const any = page.locator('.rf-move, .rf-chip, .rf-bay, .ans').first();
        if (!(await any.count())) break;
        await any.click({ timeout: 4000 }).catch(() => {});
      }
      await page.waitForTimeout(1100);
      return true;
    }
    return false;
  }

  return { hold, calibrate, clearFrame, workOneRift, panelInfo };
}
