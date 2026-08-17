/**
 * THE HOLLOW-CLAIM VERIFICATION — real keys, real mouse, cleared save.
 *
 * A cold reader opened the live engine and found four things wrong at once:
 *
 *   1. "Reading a variable — HELD — SHORT ROAD — 99%" over
 *      `formsSeen['vm-table'] = {seen: 3, correct: 0}`;
 *   2. three figures about that one line — the posterior 0.999, the session
 *      planner's seam confidence 0.667, and the 99% on the row — of which the
 *      screen printed the largest;
 *   3. an item from the distributive property served while the same session's
 *      report listed the distributive property as LOCKED;
 *   4. an ORDERS card promising "Seal 16 rifts" over a plan of 24 items.
 *
 * `tools/simulate.mjs --self-test` proves all four are fixed IN THE ENGINE.
 * This proves the same four things are true OF THE RUNNING GAME, driven the way
 * a player drives it: the save is cleared, the cadet WALKS to the first rift on
 * WASD, opens it with E, and answers with the mouse. The debug API is used for
 * exactly one thing — reading state back to compare against what is on screen —
 * and never to put the game into a state a player could not reach.
 *
 *   node tools/critic/_p0hollow.mjs [--url http://127.0.0.1:5173] [--headed]
 *
 * Exit 0 = the running game tells the truth about what it has proved.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/p0hollow-verify'));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: !process.argv.includes('--headed'),
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const steps = [];
const note = (ok, label, detail = '') => {
  steps.push({ ok, label, detail });
  console.log(`  ${ok ? ' ok ' : 'FAIL'}  ${label}${detail ? ' — ' + detail : ''}`);
};
const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) });

// A fresh install. Nothing below is reached from a state a player cannot reach.
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch { /* private mode */ } });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4500);

// ---- 1. THE ORDERS CARD QUOTES THE WORK, NOT ONLY THE GOAL -----------------
// The card is the real one: it opens on its own, before any mathematics, and it
// is read off the DOM rather than off the plan object.
{
  const card = await page.waitForSelector('.ses-charter.show .sc-go', { timeout: 60000 }).catch(() => null);
  await shot('01-orders');
  const read = await page.evaluate(() => ({
    goal: document.querySelector('.ses-charter .sc-goal')?.textContent || '',
    work: document.querySelector('.ses-charter .sc-work')?.textContent || '',
    run: window.__ascent.session?.state?.().run || null,
  }));
  const r = read.run;
  // Two numbers off the screen, two off the plan, and they have to agree.
  const quoted = (read.work.match(/\d+/g) || []).map(Number);
  const inRange = r && quoted.length >= 2
    && quoted[0] === r.itemsLow && quoted[1] === r.itemsHigh
    && r.itemsLow <= r.plannedItems && r.plannedItems <= r.itemsHigh
    && r.itemsLow >= r.target;
  note(!!card && !!read.work.trim() && inRange,
    'the ORDERS card states the workload the engine actually planned',
    r ? `goal ${r.target} rifts · card says ${quoted.join('-')} questions · plan ${r.plannedItems}` : 'no run');
  if (card) await card.click();
  await page.waitForTimeout(600);
}

// ---- 2. WALK THERE AND PLAY IT, ON THE KEYS AND THE MOUSE ------------------
// Straight out of coldplay.mjs: face the objective with the arrow keys, hold W,
// press E on contact, and answer whatever comes up by clicking an option.
const faceYaw = async (want) => {
  for (let i = 0; i < 26; i++) {
    const d = await page.evaluate((w) => {
      let e = ((w - window.__ascent.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (e < -Math.PI) e += Math.PI * 2;
      return e;
    }, want);
    if (Math.abs(d) < 0.1) return true;
    const key = d > 0 ? 'ArrowLeft' : 'ArrowRight';
    await page.keyboard.down(key);
    await page.waitForTimeout(Math.min(340, Math.max(50, Math.abs(d) / 2.6 * 1000)));
    await page.keyboard.up(key);
  }
  return false;
};

/**
 * Answer whatever is on the panel, the way a player does — a click on an
 * option, or the keys if the item wants typing. Reading the answer off the live
 * item is reading a fact; every click and key after that is real input.
 *
 * The proof it registered is the learner model moving, not the panel closing:
 * a panel closes when somebody gives up, too.
 */
const answerByClick = async () => {
  const fact = await page.evaluate(() => {
    const p = window.__ascent.panel;
    return p?.item ? { answer: String(p.item.answer) } : null;
  });
  if (!fact) return false;
  const before = await page.evaluate(() => JSON.stringify(window.__ascent.state().skills || {}));
  const opts = await page.$$('.rift button.ans, .rf-opt, .rf-choice button, .rf-choices button');
  if (opts.length) {
    const want = fact.answer.replace(/\s+/g, '');
    let picked = null;
    for (const o of opts) {
      if ((await o.innerText()).replace(/\s+/g, '') === want) { picked = o; break; }
    }
    await (picked || opts[0]).click().catch(() => {});
  } else {
    for (const ch of fact.answer) {
      if (ch === '-') await page.keyboard.press('Minus');
      else if (ch === '/') await page.keyboard.press('Slash');
      else if (ch === '.') await page.keyboard.press('Period');
      else await page.keyboard.press(ch);
      await page.waitForTimeout(50);
    }
    await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(1400);
  const after = await page.evaluate(() => JSON.stringify(window.__ascent.state().skills || {}));
  return after !== before;
};

// The frame has to be ours before W means anything: the cold open, the orders
// and the controls card all take it in turn. This is the same handback
// coldplay.mjs does — press Escape / click the card's own button until nothing
// is holding the floor — and it is what a player does without thinking.
const handBack = async () => {
  for (let i = 0; i < 6; i++) {
    const busy = await page.evaluate(() => {
      const a = window.__ascent;
      return !!(a.session?.blocking?.() || a.panel?.open || a.menu?.open);
    });
    if (!busy) return true;
    const b = await page.$('.ses-charter.show .sc-go, .ses-close.show button, .rf-x, .mn-resume');
    if (b && await b.isVisible()) { await b.click().catch(() => {}); }
    else await page.keyboard.press('Escape');
    await page.waitForTimeout(450);
  }
  return false;
};

const trace = [];
let answered = 0;
for (let round = 0; round < 26 && answered < 14; round++) {
  await handBack();
  const open = await page.evaluate(() => !!window.__ascent.panel?.open);
  if (!open) {
    const target = await page.evaluate(() => {
      const a = window.__ascent;
      const r = a.rifts.list.find((x) => !x.locked && !x.mastered) || a.rifts.list.find((x) => !x.locked);
      return r ? { x: r.foot.x, z: r.foot.z, id: r.id } : null;
    });
    if (!target) break;
    const me = await page.evaluate(() => ({ x: window.__ascent.player.pos.x, z: window.__ascent.player.pos.z }));
    const d0 = Math.hypot(me.x - target.x, me.z - target.z);
    // Re-aim every couple of seconds rather than once: a single bearing taken
    // from forty metres out walks past a nine-metre ring on the smallest drift.
    let d = d0;
    for (let leg = 0; leg < 10 && d > 4; leg++) {
      const at = await page.evaluate(() => ({ x: window.__ascent.player.pos.x, z: window.__ascent.player.pos.z }));
      await faceYaw(Math.atan2(target.x - at.x, target.z - at.z));
      await page.keyboard.down('KeyW');
      for (let i = 0; i < 18; i++) {
        await page.waitForTimeout(120);
        if (await page.evaluate(() => !!window.__ascent.panel?.open)) break;
        d = await page.evaluate((t) => {
          const p = window.__ascent.player.pos;
          return Math.hypot(p.x - t.x, p.z - t.z);
        }, target);
        if (d < 4) break;
      }
      await page.keyboard.up('KeyW');
      await page.waitForTimeout(180);
      if (await page.evaluate(() => !!window.__ascent.panel?.open)) break;
    }
    trace.push(`walk ${target.id}: ${d0.toFixed(0)}m -> ${d.toFixed(0)}m`);
    if (!(await page.evaluate(() => !!window.__ascent.panel?.open))) {
      await page.keyboard.press('KeyE');
      await page.waitForTimeout(700);
    }
  }
  const opened = await page.evaluate(() => !!window.__ascent.panel?.open);
  if (!opened) {
    trace.push(await page.evaluate(() => {
      const a = window.__ascent;
      const near = a.rifts.nearest?.(a.player.pos);
      return `round: panel shut, nearest ${near ? near.id : 'none'}, blocking ${!!a.session?.blocking?.()}`;
    }));
  }
  if (opened) {
    if (await answerByClick()) answered++;
    await page.waitForTimeout(400);
    // Leave the panel the way a player does.
    await page.keyboard.press('Escape');
    await page.waitForTimeout(350);
  }
}
note(answered >= 6, 'a cadet can walk in and answer on the keys and the mouse',
  `${answered} questions answered with real input from a cleared save`
    + (answered >= 6 ? '' : ` | ${trace.slice(0, 3).join(' ; ')}`));
await shot('02-played');

// ---- 3. NOTHING WAS SERVED OUT OF PREREQUISITE ORDER -----------------------
// Read back, not driven: every skill the engine has any evidence on must be one
// whose prerequisites were held, or one it has already proved.
{
  const bad = await page.evaluate(() => {
    const a = window.__ascent;
    const m = a.mastery;
    const out = [];
    for (const id of a.content().nodes) {
      const s = m.get(id);
      if (!s || !s.attempts) continue;
      if (!m.isUnlocked(id) && !s.everMastered) out.push(`${id} has ${s.attempts} attempts and unheld prereqs`);
    }
    return out;
  });
  note(bad.length === 0, 'no question was asked on a line whose prerequisites are unheld',
    bad.join('; ') || 'every line with evidence on it was open when it was asked');
}

// ---- 4. THE PROGRESS REPORT AGREES WITH THE ENGINE -------------------------
// Opened with the key a player presses, and read off the DOM.
{
  await page.keyboard.press('KeyP');
  await page.waitForTimeout(1400);
  await shot('03-report');
  const rows = await page.evaluate(() => {
    const a = window.__ascent;
    const m = a.mastery;
    const ids = a.content().nodes;
    return [...document.querySelectorAll('.rp-skill')].map((el, i) => {
      const id = ids[i];
      const s = m.get(id);
      const c = m.confidence(id);
      return {
        id,
        state: el.dataset.state,
        pct: el.querySelector('.rp-pct')?.textContent?.trim() || '',
        measured: el.dataset.measured === 'true',
        pL: s.pL,
        floor: c.floor,
        weak: c.weak,
        mastered: !!s.mastered,
      };
    });
  });
  // 4a. No held line has a hole under it.
  const holed = rows.filter((r) => r.mastered && r.weak.length);
  note(holed.length === 0, 'no held line stands over a question type at 0 of 3',
    holed.map((r) => `${r.id}: ${r.weak.join(',')}`).join('; ') || `${rows.filter((r) => r.mastered).length} lines held, none with a hole`);
  // 4b. The percentage on the row is the floor, never the posterior.
  const flattered = rows.filter((r) => {
    if (!r.measured) return false;
    const n = Number((r.pct.match(/\d+/) || [])[0]);
    return Number.isFinite(n) && n > Math.round(Math.min(r.floor, 0.99) * 100) + 1;
  });
  note(flattered.length === 0, 'the row prints the honest lower bound, not the posterior',
    flattered.map((r) => `${r.id}: row ${r.pct} over floor ${r.floor.toFixed(2)}`).join('; ')
      || rows.filter((r) => r.measured).map((r) => `${r.id} ${r.pct} (pL ${r.pL.toFixed(2)})`).join(', ') || 'nothing measured yet');
  // 4c. A locked line still prints nothing rather than a plausible number.
  const lockedNum = rows.filter((r) => r.state === 'locked' && /\d/.test(r.pct));
  note(lockedNum.length === 0, 'a locked line prints no figure at all',
    lockedNum.map((r) => `${r.id} reads ${r.pct}`).join('; ') || `${rows.filter((r) => r.state === 'locked').length} locked lines, all blank`);
  // 4d. The evidence list carries the row an aggregate cannot carry.
  const opened = await page.$('.rp-skill .rp-row');
  if (opened) { await opened.click(); await page.waitForTimeout(700); }
  const labels = await page.evaluate(() => [...document.querySelectorAll('.rp-ev-lab')].map((x) => x.textContent.trim()));
  note(labels.length >= 5, 'the evidence list names every question type as its own row',
    labels.join(' · ') || 'no evidence rows');
  await shot('04-report-open');
  await page.keyboard.press('Escape');
}

note(errors.length === 0, 'no console errors', errors.slice(0, 3).join(' | '));

const bad = steps.filter((s) => !s.ok).length;
console.log(`\n${steps.length - bad}/${steps.length} passed  ->  ${OUT}`);
await browser.close();
process.exit(bad ? 1 : 0);
