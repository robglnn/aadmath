/**
 * THE CLOSE CARD, IN EVERY STATE IT CAN END A RUN IN.
 *
 * Drives the real game to a real session close and photographs it, then reads
 * the painted text back off the DOM and checks it against the one thing this
 * card must never do: contradict its own neighbour.
 *
 *   modes
 *     endgame  a save with all ten lines held, the day they were held
 *     deep     the same save, weeks of coming back later: charters cut,
 *              a waystation standing, a sounding on the record
 *     mid      a learner part way up the shard, some lines held
 *     review   a learner whose next scheduled item is a re-probe on a line
 *              they already hold — the mid-progress form of the same defect
 *
 *   tools/critic/frozen.sh tools/critic/_closefix.mjs --out shots/closefix
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/closefix'));
const ONLY = arg('only', null);

const SIZES = [[1600, 900], [414, 896]];
const LOCALES = ['en', 'es', 'pl'];
const MODES = ['endgame', 'deep', 'mid', 'review'];

/** Anything that reads as "zero units of work", in the three locales. */
const ZERO = [
  /\b0\s*(minute|minutes|minuto|minutos|minut|minuty|minuta)\b/i,
  /About 0\b/i, /Unos 0\b/i, /Un 0\b/i, /Jakieś 0\b/i, /Jakaś 0\b/i,
];

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});

const findings = [];
const rows = [];

for (const mode of MODES) {
  if (ONLY && ONLY !== mode) continue;
  for (const [W, H] of SIZES) {
    for (const loc of LOCALES) {
      // The deep state costs a hundred simulated days; one size and one
      // language is enough to prove the rows it is the only way to reach.
      if (mode === 'deep' && (loc !== 'en' || W !== 1600)) continue;
      const tag = `${mode}-${loc}-${W}x${H}`;
      const r = await run(mode, loc, W, H, tag);
      rows.push(r);
    }
  }
}

await browser.close();

console.log('\nASCENT — the close card, every ending\n');
for (const r of rows) {
  console.log(`── ${r.tag}`);
  console.log(`   lines held ${r.lines}/10 · run ${r.tears}/${r.target} tears, ${r.items} items`);
  console.log(`   report.next    ${JSON.stringify(r.next)}`);
  console.log(`   report.endgame ${JSON.stringify(r.endgame)}`);
  console.log(`   card overflows ${r.scrolls ? `yes, by ${r.over}px (sticky shelf on)` : 'no'} · errors ${r.errors.length}`);
  for (const b of r.blocks) console.log(`   [${b.h}]  ${b.rows.map((x) => `${x.b} — ${x.s}`).join('\n           ')}`);
  console.log(`   sign: ${r.sign}`);
  if (r.bad.length) console.log('   ✗ ' + r.bad.join('\n   ✗ '));
  console.log('');
}
console.log(findings.length ? `FAIL — ${findings.length} finding(s)` : 'PASS — no state contradicts itself');
await writeFile(path.join(OUT, 'report.json'), JSON.stringify(rows, null, 2));
process.exit(findings.length ? 1 : 0);

// ---------------------------------------------------------------------------

async function run(mode, loc, W, H, tag) {
  const ctx = await browser.newContext({
    viewport: { width: W, height: H }, deviceScaleFactor: 2,
    hasTouch: W < 700, isMobile: W < 700,
  });
  const page = await ctx.newPage();
  const errors = [];
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  page.on('pageerror', (e) => errors.push(e.message));

  await page.addInitScript(() => { try { localStorage.clear(); } catch { /* private */ } });
  await page.goto(URL, { waitUntil: 'domcontentloaded' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
  await page.evaluate((l) => {
    window.__ascent.setLocale(l);
    try { localStorage.setItem('ascent.locale', l); } catch { /* private */ }
  }, loc);
  await page.waitForTimeout(1800);

  // --- the save ------------------------------------------------------------
  const built = await page.evaluate(async (m) => {
    const A = window.__ascent;
    const eng = A.mastery;
    const one = () => {
      const o = eng.next();
      if (!o) return false;
      const task = eng.taskFor(o.id);
      if (!task) return false;
      const item = A.itemFor(task);
      eng.observe(task.skill, true, {
        assisted: task.scaffold !== 'none', kind: task.kind,
        form: item?.form, rep: item?.rep, scene: item?.scene,
      });
      return true;
    };
    const whole = () => eng.integrity() >= 0.999;
    if (m === 'mid') {
      // Part way up: stop as soon as three lines stand.
      for (let i = 0; i < 400; i++) {
        if ([...eng.state.values()].filter((s) => s.mastered).length >= 3) break;
        if (!one()) break;
      }
    } else if (m === 'review') {
      for (let i = 0; i < 400; i++) {
        if ([...eng.state.values()].filter((s) => s.mastered).length >= 3) break;
        if (!one()) break;
      }
      // …then leave it long enough that a held line falls due for a re-probe,
      // which is what makes mastery.next() answer with a line already held.
      for (let d = 0; d < 40 && A.watch().due === 0; d++) A.advanceDays(1);
    } else {
      for (let i = 0; i < 800; i++) { if (whole()) break; if (!one()) break; }
      if (m === 'deep') {
        for (let d = 0; d < 90; d++) {
          A.advanceDays(1);
          for (let i = 0; i < 26; i++) one();
        }
      }
    }
    A.kit.sync();
    return {
      lines: [...eng.state.values()].filter((s) => s.mastered).length,
      whole: whole(), watch: A.watch(), kit: A.kit.state(),
      nextRaw: eng.next(),
    };
  }, mode);

  // The save was built by bulk-observing, so every rank the record earned is
  // still queued as an unplayed rite; in real play those fire during the run.
  // Drain them, or the close card is composed around a promotion crest every
  // single time and the three blocks are never the thing being photographed.
  await page.evaluate(() => { for (let i = 0; i < 8; i++) window.__ascent.story?.claimRite?.(); });

  // --- a real run, opened, worked and closed --------------------------------
  await page.evaluate(() => window.__ascent.session.plan());
  await page.waitForFunction(() => window.__ascent.session.state().phase === 'charter', null, { timeout: 20000 });
  await page.waitForTimeout(600);
  await page.locator('.sc-go').click();
  await page.waitForTimeout(600);

  // Six honest items through the real panel, one of them missed, so the run has
  // work on the record and the close is a close and not a pose.
  for (let i = 0; i < 6; i++) {
    const id = await page.evaluate(() => window.__ascent.nextObjective()?.id || null);
    if (!id) break;
    await page.evaluate((x) => window.__ascent.teleportTo(x), id);
    await page.waitForTimeout(200);
    const opened = await page.evaluate((x) => window.__ascent.openRiftById(x), id);
    if (!opened) break;
    await page.waitForTimeout(700);
    await page.evaluate((w) => window.__ascent.panel.demo(w ? 'wrong' : 'right'), i === 2);
    await page.waitForTimeout(i === 2 ? 1400 : 1200);
    await page.evaluate(() => window.__ascent.panel.close?.());
    await page.waitForTimeout(400);
  }

  await page.evaluate(() => window.__ascent.session.skipToClose());
  await page.waitForFunction(() => document.querySelector('.ses-close')?.classList.contains('show'),
    null, { timeout: 20000 });
  // The stagger runs to --sx-t0 + 1.45s, and --sx-t0 is 1.35s when the card is
  // composed around an ascension. Photograph it settled, never mid-rise.
  await page.waitForTimeout(4600);

  const read = await page.evaluate(() => {
    const el = document.querySelector('.ses-close');
    const s = window.__ascent.session.state();
    const rep = s.run?.report || {};
    return {
      scrolls: el.classList.contains('scrolls'),
      over: (() => { const s = el.querySelector('.sx-in'); return s.scrollHeight - s.clientHeight; })(),
      kick: el.querySelector('.sx-kick')?.textContent || '',
      title: el.querySelector('.sx-title span')?.textContent || '',
      tally: [el.querySelector('.sx-t-n')?.textContent, el.querySelector('.sx-t-lab')?.textContent,
        el.querySelector('.sx-t-sub')?.textContent].filter(Boolean).join(' · '),
      blocks: [...el.querySelectorAll('.sx-b')].map((sec) => ({
        h: sec.querySelector('h3')?.textContent || '',
        rows: [...sec.querySelectorAll('li')].map((li) => ({
          b: li.querySelector('b')?.textContent || '', s: li.querySelector('span')?.textContent || '',
        })),
      })),
      sign: el.querySelector('.sx-sign')?.textContent || '',
      cap: el.querySelector('.sx-cap')?.textContent || '',
      all: el.innerText,
      next: rep.next || null, endgame: rep.endgame || null,
      tears: s.run?.tears, target: s.run?.target, items: s.run?.items,
      held: rep.held || [],
    };
  });

  await page.screenshot({ path: path.join(OUT, `${tag}.png`) });
  // …and again at the foot of the scroller, because on every frame this card
  // has to run on, the three blocks are below the fold.
  if (read.scrolls) {
    await page.evaluate(() => { const s = document.querySelector('.ses-close .sx-in'); s.scrollTop = s.scrollHeight; });
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(OUT, `${tag}-foot.png`) });
  }

  // --- the assertions ------------------------------------------------------
  const bad = [];
  const push = (s) => { bad.push(s); findings.push(`${tag}: ${s}`); };
  for (const re of ZERO) {
    if (re.test(read.all)) push(`prints zero minutes of work — ${re}`);
  }
  const nextBlock = read.blocks[2];
  if (built.whole) {
    if (read.next) push('lattice whole, yet NEXT still names an open line');
    const joined = JSON.stringify(nextBlock);
    for (const want of ['sound', 'charter', 'station']) {
      if (!read.endgame || read.endgame[want === 'sound' ? 'sounding' : want === 'charter' ? 'charters' : 'stations'] === undefined) {
        push(`report.endgame has no ${want}`);
      }
    }
    if (nextBlock.rows.length < 4) push(`the endgame block names only ${nextBlock.rows.length} things`);
    if (!joined.length) push('empty next block');
  } else if (!read.next) {
    push('lines still open, yet NEXT says the shard is whole');
  }
  if (read.held.length && /^$/.test(read.sign)) push('no sign-off');
  if (errors.length) push(`${errors.length} console error(s): ${errors[0]}`);
  // Nothing may be clipped or pushed off the frame.
  const clipped = await page.evaluate(() => {
    const out = [];
    for (const el of document.querySelectorAll('.ses-close *')) {
      if (el.children.length || !el.textContent.trim()) continue;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || +cs.opacity < 0.05) continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2) continue;
      if (el.scrollWidth > el.clientWidth + 2 && !/auto|scroll/.test(cs.overflowX)) {
        out.push('clipX: ' + el.textContent.trim().slice(0, 40));
      }
      if (r.right > innerWidth + 2 || r.left < -2) out.push('offscreen: ' + el.textContent.trim().slice(0, 40));
    }
    return out.slice(0, 8);
  });
  for (const c of clipped) push(c);

  await ctx.close();
  return {
    tag, mode, loc, w: W, h: H, lines: built.lines, whole: built.whole,
    nextRaw: built.nextRaw, watch: built.watch,
    kit: { charters: built.kit.charters, stations: built.kit.stations, toCharter: built.kit.toCharter, depth: built.kit.depth },
    ...read, errors, bad,
  };
}
