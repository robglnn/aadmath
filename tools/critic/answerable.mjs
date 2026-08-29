/**
 * THE ANSWER-SURFACE gate.
 *
 *   npm run check:answerable
 *   node tools/critic/answerable.mjs --self-test
 *   node tools/critic/answerable.mjs --full
 *   node tools/critic/answerable.mjs --skill factor-trinomial-monic --locale en
 *
 * WHY IT EXISTS. Three separate critics landed on the same thing: the surface a
 * learner answers on was not being measured at all. Every gate in this repo
 * asked whether the mathematics on the card was right. None of them asked
 * whether a cadet could hand an answer in, or whether the rig could tell an
 * answer from the question it was printed under.
 *
 * The five things it proves, over a large sample from EVERY unit the manifest
 * ships, in all three languages, by working the real surface with real presses:
 *
 *   a. THE KEY CAN BE ENTERED. The key of every item is spelled out in plain
 *      glyphs, each glyph is found on a real cap, the caps are pressed in
 *      order, SEAL is pressed, and the rift has to shut. Before this pass the
 *      pad could emit no bracket, no radical, no equals sign and no comma, so
 *      the key of every factoring, complete-the-square, vertex-form and
 *      surd-root item in the bank was literally impossible to type.
 *   b. THE QUESTION, TYPED BACK, IS REFUSED — wherever the item demands a form
 *      the question is not in. Measured over 16,720 sampled Level 4 items, the
 *      old grader sealed 1,763 of them for a cadet who typed the prompt into
 *      the pad, with full unassisted mastery credit and no misconception
 *      recorded. That is a hollow mastery claim manufactured at scale.
 *   c. NO OPTION SET HOLDS THE KEY TWICE under mathematical equality. 586
 *      sampled surd-root items listed `n = 2 \pm \sqrt{20}` beside the key
 *      `n = 2 \pm 2\sqrt{5}` and marked one of them wrong.
 *   d. THE STANDING INSTRUCTION IS ABOUT THIS CARD. The footer line and the
 *      first whisper of the echo were chosen by the item's `type`, so 179 of
 *      341 forms — 73 of the 87 in Level 4 — printed the level-1 like-terms
 *      line, including under `\sqrt{144 + 100}`, which has no letter in it and
 *      no terms to shorten. Translated verbatim into Spanish and Polish.
 *      Choosing it off the demanded FORM instead fixed most of that and left
 *      thirty-three forms wrong in a quieter way: "Multiply it out. Leave no
 *      bracket" over `\frac{n^{8}}{n^{1}}` and nineteen others, "take every
 *      whole square out of the root" over `5\sqrt{3} + 4\sqrt{3}`, and the
 *      two-numbers whisper over `6n + 12`. Each is now its own rule with its
 *      own code, and `--footers` prints the line every form lands under.
 *   e. A REFUSED LINE LEAVES THE SOCKET, AND THERE IS A WAY TO EMPTY IT. The
 *      socket used to keep a refused entry, so the next glyph a cadet pressed
 *      landed on the end of it and their corrected answer went in as a SECOND
 *      miss off one real mistake — which burns the proving run and drops the
 *      scaffold a rung nobody earned. There was no clear cap either, so a
 *      mistyped bracket could only be walked back one glyph at a time.
 *
 * AND IT PROVES ITSELF FIRST. A gate nobody has watched go red is a gate nobody
 * should trust, so every run begins by planting all nine defects — one per
 * RULE, never one per family — and refuses to report anything unless it
 * catches every one of them. It then takes its own
 * browser away mid-sweep, because the retry that survives that is the one piece
 * of plumbing here that could drop items without saying so.
 *
 * Exit 0 = every key the bank ships can be handed in, and nothing else can.
 */
import { chromium } from 'playwright';
import { build } from 'vite';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { listenFree } from '../_freeport.mjs';
import { findings } from '../_findings.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const LAB = path.join(HERE, 'answerlab');

const argv = process.argv.slice(2);
const flag = (k) => argv.includes('--' + k);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };

const FULL = flag('full');
const SELFTEST = flag('self-test');
const opts = {
  locales: arg('locale') ? [arg('locale')] : (FULL ? ['en', 'es', 'pl'] : ['en', 'es', 'pl']),
  skills: arg('skill') ? [arg('skill')] : undefined,
  difficulties: arg('d') ? [Number(arg('d'))] : [1, 2, 3, 4, 5],
  seeds: Number(arg('seeds', FULL ? 6 : 2)),
  seed0: Number(arg('seed0', 3000)),
};

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.json': 'application/json' };

/**
 * The planted defects, and the code each one must produce.
 *
 * One code per RULE, not one per family. Four of the seven below are the same
 * question — is the standing line about this card? — and giving them one code
 * between them would let a single plant answer for all four, which is how a
 * rule ends up in a gate without ever having been watched refusing anything.
 */
const MUST_CATCH = [
  ['key-not-typeable', 'a key the pad has no cap for'],
  ['question-back-accepted', 'a grader that tests value and never form'],
  ['duplicate-key-in-options', 'an option set holding the key twice'],
  ['nudge-does-not-fit-the-task', 'the level-1 like-terms line under a card it cannot be about'],
  ['instruction-names-a-bracket-that-is-not-there', '"leave no bracket" over a card with no bracket'],
  ['instruction-names-a-square-that-is-not-there', '"take every whole square out of the root" over a square-free root'],
  ['instruction-names-a-pair-that-is-not-there', 'the trinomial pair whispered over a common factor'],
  ['entry-kept-after-a-refusal', 'a socket that keeps the line the rig just refused'],
  ['no-way-to-clear-the-socket', 'a pad with no way to empty the socket on purpose'],
];

const out = await mkdtemp(path.join(tmpdir(), 'answerlab-'));
let server, browser;
const done = async () => {
  try { server?.close(); } catch { /* already down */ }
  try { await browser?.close(); } catch { /* already down */ }
  await rm(out, { recursive: true, force: true });
};

try {
  // A frozen build, for the same reason snapshot.sh exists: several builders
  // hot-edit this tree at once and a dev server reloads out from under a run.
  await build({
    root: LAB,
    base: './',
    logLevel: 'error',
    build: { target: 'es2022', outDir: out, emptyOutDir: true, sourcemap: false, assetsInlineLimit: 0 },
  });

  server = createServer(async (req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    try {
      const body = await readFile(path.join(out, rel));
      res.writeHead(200, { 'content-type': MIME[path.extname(rel)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end('nope'); }
  });
  // Port 0, not a random one in a range: see tools/_freeport.mjs.
  const port = await listenFree(server);

  // A BROWSER THAT DIES IS NOT A VERDICT ABOUT THE GAME.
  //
  // This gate works ten thousand items through the real rift, and it runs on a
  // machine where several other critics have a headless Chromium open at the
  // same time — the documented working mode of this repo. Twice, under that
  // load, the kernel took this one away mid-sweep and playwright reported
  // `Target page, context or browser has been closed` at 6% and again at 85%.
  //
  // That is not a finding and it must not be reported as one, and it must not
  // be reported as a PASS either. So the lab is a thing that can be stood back
  // up: a chunk that dies with the page under it is retried on a fresh browser,
  // from the same slice, so no item is skipped and no item is counted twice.
  // Only a run that cannot be stood up again at all fails, and it fails loudly
  // as an inconclusive run rather than quietly as a clean one.
  const errors = [];
  let page = null;
  const openLab = async () => {
    try { await browser?.close(); } catch { /* already gone */ }
    browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
    page = await ctx.newPage();
    page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__able, null, { timeout: 40000 });
  };
  /** Did playwright lose the browser, as opposed to the page throwing? */
  const lostTheBrowser = (e) => /Target (?:page, context or browser has been closed|crashed)|browser has been closed|Protocol error|Session closed/i.test(String((e && e.message) || e));
  await openLab();

  // ---- the gate proves itself before it reports anything ------------------
  const rigged = await page.evaluate(() => window.__able.selfTest());
  let armed = true;
  for (const [code, what] of MUST_CATCH) {
    const caught = rigged.codes.includes(code);
    if (!caught) armed = false;
    console.log(`self-test — ${what}: ${caught ? 'caught' : 'MISSED'}  [${code}]`);
  }
  for (const d of rigged.detail) console.log(`  ${d}`);
  if (!armed) {
    console.log('\nFAIL — the gate cannot see the defects it exists to catch. Nothing below is evidence.');
    await done();
    process.exit(1);
  }
  // ---- and so does the one piece of plumbing that can lose an item --------
  //
  // The retry below is the only code in this file that can take items out of a
  // sweep without saying so: a slice worked on a browser that then dies has to
  // come back whole on the next one. So it is watched going wrong on purpose.
  // One slice is worked twice — once on a healthy browser, and once with the
  // browser taken away from under it — and the two readings have to agree item
  // for item. If they do not, every number this gate prints afterwards is a
  // guess.
  //
  // The browser is taken away for certain rather than on a timer: a self-test
  // that only sometimes plants its defect is a self-test that sometimes says
  // "armed" without having been. Nothing is lost by killing it before the call
  // rather than during one — `window.__able.run` is synchronous and hands back
  // its whole slice or nothing at all, so a death anywhere inside it looks
  // exactly like this one to the driver.
  const PROOF = { ...opts, slice: [0, 8] };
  const healthy = await page.evaluate((o) => window.__able.run(o), PROOF);
  await browser.close();
  let recovered = null, restoodUp = 0;
  for (;;) {
    try { recovered = await page.evaluate((o) => window.__able.run(o), PROOF); break; }
    catch (e) {
      if (!lostTheBrowser(e) || ++restoodUp > 2) break;
      await openLab();
    }
  }
  const same = recovered
    && recovered.items === healthy.items
    && recovered.skipped === healthy.skipped
    && recovered.findings.length === healthy.findings.length
    && JSON.stringify(recovered.surfaces) === JSON.stringify(healthy.surfaces);
  console.log(`self-test — a browser taken away mid-slice: ${restoodUp ? 'lost and restood' : 'NOT LOST'}`
    + `, ${same ? `the slice came back whole (${healthy.items} items both times)` : 'THE SLICE CAME BACK DIFFERENT'}`);
  if (!restoodUp || !same) {
    console.log('\nFAIL — the gate cannot survive the thing that killed it twice without losing items.');
    await done();
    process.exit(1);
  }

  // A DIAGNOSTIC, AND SAID TO BE ONE.
  //
  // `--footers` prints the standing line every form actually lands under, one
  // row per form. It is how the twenty-six wrong ones were found: a rule can
  // only be written for a mismatch somebody has looked at, and no gate in this
  // repo could show what the instruction under a card said. It applies no rule
  // and reaches no verdict, so it says so and stops.
  if (flag('footers')) {
    const rows = await page.evaluate((o) => window.__able.dump(o), {
      locales: [opts.locales[0]], skills: opts.skills,
      difficulties: [Number(arg('d', 3))], seed0: opts.seed0,
    });
    for (const r of rows) console.log(`${r.skill} | ${r.form} | ${r.mode} | ${r.latex} => ${r.answer} | ${r.help}`);
    console.log(`\nDIAGNOSTIC — ${rows.length} forms listed. No rule was applied; this is not a verdict.`);
    await done();
    process.exit(0);
  }

  if (SELFTEST) { await done(); process.exit(0); }

  const plan = await page.evaluate((o) => window.__able.plan(o).length, opts);
  const CHUNK = 30;
  const all = { items: 0, skipped: 0, surfaces: {}, tally: {}, findings: [] };
  const t0 = Date.now();
  let restarts = 0;
  const MAX_RESTARTS = 12;
  for (let i = 0; i < plan; i += CHUNK) {
    let r = null;
    for (;;) {
      try { r = await page.evaluate((o) => window.__able.run(o), { ...opts, slice: [i, Math.min(plan, i + CHUNK)] }); break; }
      catch (e) {
        if (!lostTheBrowser(e)) throw e;
        if (++restarts > MAX_RESTARTS) {
          process.stdout.write('\n');
          console.log(`INCONCLUSIVE — the browser was lost ${restarts} times under load; this run proves nothing either way.`);
          await done();
          process.exit(2);
        }
        process.stdout.write(`\n  the browser was lost at ${i}/${plan}; standing the lab back up (${restarts}/${MAX_RESTARTS}) and retrying the same slice\n`);
        await openLab();
      }
    }
    all.items += r.items; all.skipped += r.skipped;
    for (const [k, v] of Object.entries(r.surfaces)) all.surfaces[k] = (all.surfaces[k] || 0) + v;
    for (const [k, v] of Object.entries(r.tally || {})) all.tally[k] = (all.tally[k] || 0) + v;
    all.findings.push(...r.findings);
    const pct = Math.round(Math.min(plan, i + CHUNK) / plan * 100);
    process.stdout.write(`\r  ${pct}%  ${all.items} items  ${all.findings.length} findings   `);
  }
  process.stdout.write('\n');

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`answer-surface audit: ${all.items} items worked through the real rift in ${secs}s`);
  console.log(`  surfaces: ${Object.entries(all.surfaces).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  if (all.skipped) console.log(`  ${all.skipped} draws the bank refused (retries), not audited`);
  // Said out loud rather than passed in silence: these surfaces are not typed,
  // so (a) is not a question that can be asked of them here. They are covered
  // by tools/critic/choiceaudit.mjs and tools/critic/coldplay.mjs.
  const untyped = ['balance', 'area', 'plot', 'sort'].filter((k) => all.surfaces[k]);
  if (untyped.length) {
    console.log(`  not a typed surface, so (a) is not asked of them: ${untyped.map((k) => `${k} ${all.surfaces[k]}`).join(', ')}`);
  }

  // A CLEAN SWEEP MEANS NOTHING UNTIL IT SAYS WHAT IT ASKED.
  const T = all.tally;
  console.log(`  keys typed on real caps and sealed: ${T.keysTyped || 0}`);
  console.log(`  items whose task demands a form:    ${T.formDemanded || 0}`
    + `  (question typed back and refused: ${T.questionTypedBack || 0};`
    + ` question not spellable on the pad: ${T.questionNotTypeable || 0})`);
  console.log(`  option sets read off the glass:     ${T.optionSets || 0}`);
  console.log(`  standing instructions read off the glass: ${T.instructionsRead || 0}`);
  console.log(`  sockets read after a real refusal:  ${T.refusalsRead || 0}`);
  // Only on a WHOLE sweep. A narrowed diagnostic run (`--skill write-system`)
  // legitimately reaches no keypad at all, and a gate that cried wolf at its
  // own diagnostic flag is a gate people stop reading.
  const wholeSweep = !arg('skill') && !arg('d');
  if (wholeSweep && (!T.keysTyped || !T.questionTypedBack || !T.optionSets || !T.instructionsRead || !T.refusalsRead)) {
    all.findings.push({ code: 'gate-asked-nothing', locale: '-', skill: '-', form: '-', difficulty: 0, seed: 0, mode: '-',
      detail: 'one of the five questions was never actually put to the surface; a pass here is not evidence' });
  }

  const byCode = {};
  for (const f of all.findings) (byCode[f.code] ||= []).push(f);
  for (const [code, list] of Object.entries(byCode)) {
    console.log(`\n${code}  ×${list.length}`);
    for (const f of list.slice(0, 8)) {
      console.log(`  ${f.locale} ${f.skill}/${f.form} d${f.difficulty} seed ${f.seed} [${f.mode}] — ${f.detail}`);
    }
    if (list.length > 8) console.log(`  … ${list.length - 8} more`);
  }

  if (errors.length) {
    console.log(`\nconsole errors ×${errors.length}`);
    errors.slice(0, 6).forEach((e) => console.log('  ! ' + e));
  }

  if (restarts) console.log(`  the browser was lost and restood ${restarts}×; every slice under it was retried whole`);
  console.log(`\n${all.findings.length} answer-surface finding(s), ${errors.length} console error(s)`);
  await done();
  /* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs. This sweeps every unit,
     and a key that cannot be entered — or an option set that does not hold the
     answer — is a card a learner is stopped at wherever it is served. */
  findings('check:answerable', { scope: 'sweep' })
    .route(all.findings.map((f) => (typeof f === 'string' ? f : (f.detail || f.kind || JSON.stringify(f)))))
    .route(errors.length ? [`${errors.length} console error(s) during the sweep: ${errors.slice(0, 3).join(' | ')}`] : [])
    .done();
} catch (e) {
  console.error(e);
  await done();
  process.exit(2);
}
