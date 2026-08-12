/**
 * The third clock, on the real screen.
 *
 * `tools/narrative/pacing.mjs` proves the arithmetic. This proves the *surface*:
 * that a night-gated chapter and a night-gated rank say so, in words, on the
 * card the player is looking at — because a full bar that has stopped moving,
 * with no reason printed next to it, is worse than no gate at all.
 *
 * It also boots the two extra content selections, so "a course is a graph, a
 * pack and a manifest entry" is checked against the running game and not only
 * against a node harness.
 *
 *   node tools/narrative/pacing-shot.mjs --url http://127.0.0.1:5173
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/narr-pacing'));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const steps = [];
const note = (ok, label, detail = '') => {
  steps.push({ ok, label, detail });
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ' — ' + detail : ''}`);
};

const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(3500);

// --- the shipped default is untouched ---------------------------------------
const content = await page.evaluate(() => window.__ascent.content());
note(content.units.length === 1 && content.units[0] === 'algebra1-l1',
  'the default selection is still Algebra I Level 1', content.units.join(','));
note(content.nodes.length === 10, 'the default lattice is still ten nodes', String(content.nodes.length));

// --- a marathon cannot buy the top ------------------------------------------
const marathon = await page.evaluate(() => {
  window.__ascent.story.seal(400);
  return window.__ascent.story.state();
});
note(marathon.nights === 0, 'a long sitting earns no nights held', `nights=${marathon.nights}`);
note(marathon.chapter <= 3, 'four hundred tears in one sitting does not open the reveal',
  `chapter=${marathon.chapter}`);
note(marathon.rankIndex <= 1, 'four hundred tears in one sitting does not buy Silver or above',
  `rank=${marathon.rank}, standing=${marathon.standing}`);

// --- and the card says why --------------------------------------------------
/* Two ceremonies fire on that answer and both take the frame: the bronze rite,
   and two chapter plates queued behind it. The card stands down while a plate
   is drawing (see the `:has(.meta-turn.show)` rule in meta.css), so wait for the
   queue to drain rather than photographing the card underneath a plate. */
await page.waitForFunction(
  () => !document.querySelector('.meta-turn.show') && !document.querySelector('.rite-dim'),
  null, { timeout: 40000 },
).catch(() => {});
await page.waitForTimeout(1200);
/* …and the orders card opens on its own twenty-five seconds in, which dims the
   frame and stands the chapter card down with it. Stand it down first: this
   shot is of the card, and the card is only visible when the world is. */
if (await page.locator('.ses-charter.show').count()) {
  await page.keyboard.press('Space');
  await page.waitForTimeout(900);
}
const card = await page.evaluate(() => {
  const el = document.querySelector('.meta-quest');
  return {
    next: el?.querySelector('.qs-next')?.textContent || '',
    rung: el?.querySelector('.qr-next')?.textContent || '',
    gatedSeal: !!el?.querySelector('.qseal.gated'),
    gatedRung: !!el?.querySelector('.qrung.gated'),
  };
});
note(/night/i.test(card.next) && card.gatedSeal,
  'the chapter row names the night it is waiting for', JSON.stringify(card.next));
/* The rank row must name whichever gate is genuinely missing — standing first,
   nights second. A cadet short of both should be told to go and work. */
const rg = marathon.rankGate;
note(rg.kind === 'nights' ? (/night/i.test(card.rung) && card.gatedRung) : !card.gatedRung,
  `the rank row names the gate that is actually missing (${rg.kind} ${rg.need})`,
  JSON.stringify(card.rung));
// Clip to where the card actually is, not to where it was last time somebody
// looked: the chapter card is laid out by src/meta/meta.css and moves.
const box = await page.locator('.meta-quest').boundingBox();
await page.screenshot({
  path: path.join(OUT, '01-night-gated-card.png'),
  clip: box ? { x: box.x - 12, y: box.y - 12, width: box.width + 24, height: box.height + 24 } : undefined,
});
await page.screenshot({ path: path.join(OUT, '01-night-gated-full.png') });

// --- the close card names the returning loop --------------------------------
// The run is already open by now — the orders card was stood down above. If it
// is not, open the real one and stand it down, then wind the real work clock.
if (await page.evaluate(() => window.__ascent.session.state().phase === 'idle')) {
  await page.evaluate(() => window.__ascent.session.plan?.());
  await page.waitForTimeout(700);
  await page.keyboard.press('Space');
  await page.waitForTimeout(700);
}
const closed = await page.evaluate(async () => {
  const a = window.__ascent;
  a.session.skipToClose?.();
  await new Promise((r) => setTimeout(r, 1600));
  const el = document.querySelector('.ses-close .sx-next');
  return { phase: a.session.state().phase, text: el ? el.innerText : '' };
});
note(/night/i.test(closed.text), 'the close card names nights held every time',
  `[${closed.phase}] ` + closed.text.replace(/\n/g, ' / ').slice(0, 160));
await page.screenshot({ path: path.join(OUT, '02-close-card.png') });
await ctx.close();

// --- coming back tomorrow ---------------------------------------------------
/* The night beat and the day dispatches are the arc's answer to "why is
   tomorrow different from more of today", and both only fire on a real return.
   So: age the save by a day, reload, and read the transcript Marlow actually
   produced. Nothing is stubbed — the beat is chosen by the same code the game
   runs, off the same save. */
{
  const c3 = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const p3 = await c3.newPage();
  const errs3 = [];
  p3.on('pageerror', (e) => errs3.push(e.message));
  p3.on('console', (m) => { if (m.type() === 'error') errs3.push(m.text()); });
  await p3.goto(URL, { waitUntil: 'networkidle' });
  await p3.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
  await p3.evaluate(() => {
    // A save that worked yesterday: one day on the ledger, dated yesterday.
    const DAY = 86400000;
    const n = Math.floor((Date.now() - DAY - new Date().getTimezoneOffset() * 60000) / DAY);
    localStorage.setItem('ascent.story', JSON.stringify({
      seen: ['story.open.l1'], told: [], peak: 2,
      ledger: { clean: 40, assisted: 0, checks: 2, slips: 3, best: 6 },
      days: { first: n, last: n, count: 1, streak: 1, best: 1, nights: 0, nightDay: 0, durable: 0 },
      dayMarks: [], chapter: 3, rank: 1,
    }));
  });
  await p3.reload({ waitUntil: 'networkidle' });
  await p3.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
  await p3.waitForTimeout(26000);
  const back = await p3.evaluate(() => ({
    said: window.__ascent.story.said().map((x) => x.text),
    days: window.__ascent.story.daysState(),
  }));
  note(back.days.gapDays === 1, 'the game knows a day passed', `gapDays=${back.days.gapDays}`);
  note(back.said.some((x) => /welcome back|bienvenido|witaj/i.test(x)),
    'a returning cadet is greeted for the return, not for the first landing',
    JSON.stringify(back.said.slice(0, 3)));
  await p3.screenshot({ path: path.join(OUT, '04-returning.png') });
  note(errs3.length === 0, 'the returning save boots with no console errors', errs3.slice(0, 2).join(' | '));
  await c3.close();
}

// --- the second unit boots in the real game ---------------------------------
for (const [sel, wantNodes] of [['?unit=algebra1-l2', 3], ['?course=algebra1', 13]]) {
  const c2 = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const p2 = await c2.newPage();
  const errs2 = [];
  p2.on('pageerror', (e) => errs2.push(e.message));
  p2.on('console', (m) => { if (m.type() === 'error') errs2.push(m.text()); });
  await p2.goto(URL + '/' + sel, { waitUntil: 'networkidle' });
  await p2.evaluate(() => { try { localStorage.clear(); } catch {} });
  await p2.reload({ waitUntil: 'networkidle' });
  await p2.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
  await p2.waitForTimeout(3500);
  const got = await p2.evaluate(() => ({
    content: window.__ascent.content(),
    rifts: window.__ascent.rifts.list.length,
    skill: window.__ascent.t('skills.' + window.__ascent.content().nodes[0]),
  }));
  note(got.content.nodes.length === wantNodes && got.rifts === wantNodes,
    `${sel} runs a ${wantNodes}-node lattice with a rift for every node`,
    `${got.content.nodes.length} nodes, ${got.rifts} rifts, packs=[${got.content.packs}]`);
  note(errs2.length === 0, `${sel} boots with no console errors`, errs2.slice(0, 2).join(' | '));
  await p2.screenshot({ path: path.join(OUT, `03-${sel.replace(/[?=]/g, '-')}.png`) });
  await c2.close();
}

note(errors.length === 0, 'no console errors on the default selection', errors.slice(0, 2).join(' | '));

const failed = steps.filter((s) => !s.ok);
await writeFile(path.join(OUT, 'pacing.json'), JSON.stringify({ steps, errors }, null, 2));
console.log(`\n${steps.length - failed.length}/${steps.length} passed  ->  ${OUT}`);
await browser.close();
process.exit(failed.length ? 1 : 0);
