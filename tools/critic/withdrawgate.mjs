#!/usr/bin/env node
/**
 * THE WITHDRAWAL GATE — is a claim taken back ever taken back in silence?
 *
 *   node tools/critic/withdrawgate.mjs [--url …] [--headed] [--out shots/withdrawn]
 *   node tools/critic/withdrawgate.mjs --self-test
 *
 * Exit 0 = every mastery claim this engine withdraws while loading a record is
 * said out loud, in the learner's own language, before anything else happens.
 *
 * WHY THIS EXISTS
 *
 * `MasteryEngine.load()` withdraws any line loaded as held over a question type
 * the learner has never once got right unaided — `reopenedFor: 'formFloor'`.
 * The rule is right: the form floor stops a hollow claim being GRANTED, and
 * this is the same rule applied to the claims already sitting in save files.
 *
 * The product reloads that save on EVERY visit. So a claim granted at the end
 * of one sitting could be withdrawn on the next boot, with no re-check offered
 * and not one word to the learner: a badge that said HELD on Tuesday saying
 * something else on Wednesday, and nothing anywhere explaining it. That is the
 * hollow-mastery failure with the sign flipped. This project's rule is that
 * mastery claims are honest in BOTH directions, and a withdrawal nobody is told
 * about is not honest.
 *
 * It was also invisible to the evidence. `tools/simulate.mjs` keeps ONE engine
 * object across all of its simulated sittings and never calls `save()` or
 * `load()`, so no number this build has ever quoted included this effect at
 * all. That half is fixed in the simulation; this gate is the other half — the
 * real page, the real record, the real words on screen.
 *
 * WHAT IT READS
 *
 * The companion's channel, character by character as it is typed, off the real
 * DOM — which is what a learner actually sees. Not `window.__ascent`, and not a
 * transcript the game keeps for harnesses. The expected sentence comes out of
 * `src/i18n/<loc>.js` and is compared verbatim, in all three locales, so a beat
 * that fires in English over a Polish session fails.
 *
 * SELF-TEST. `--self-test` builds the product with `src/meta/withdrawn.js`
 * aliased to a no-op — which is exactly what shipped before this gate existed —
 * and requires the gate to go red on it. It then proves the same rule stays
 * quiet on an HONEST record: four lines held with no hole in any of them must
 * produce no withdrawal beat and no withdrawn row, or the rule is one that
 * fires on clean content and would be switched off within a week.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { listenFree } from '../_freeport.mjs';
import { MasteryEngine } from '../../src/learn/mastery.js';
import { FORMS_BY_SKILL } from '../../src/learn/generators.js';
import { manifest, loadUnit, standalone } from '../_courses.mjs';
import { findings } from '../_findings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const has = (f) => process.argv.includes(f);
const OUT = path.resolve(arg('out', 'shots/withdrawn'));
const SELF = has('--self-test');
const HEADED = has('--headed');
const LOCALES = ['en', 'es', 'pl'];
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.map': 'application/json',
};

/**
 * The screen is not the bundle, character for character, and it is right not
 * to be: src/i18n/typography.js glues a one-letter Spanish or Polish word to
 * the word after it with a no-break space, so "a estar" reaches the DOM as
 * "a\u00a0estar". That is a language rule, not a defect, and a gate that
 * compared raw code points would have called correct Spanish a missing
 * sentence — which is exactly what it did on the first run. Compared on
 * normalised whitespace, so every word still has to be there, in order.
 */
const norm = (x) => String(x).replace(/[\u00a0\u202f\u2009\u2007]/g, ' ').replace(/\s+/g, ' ').trim();

/** The bundles, read as data: the words this gate expects on screen. */
const BUNDLE = {};
for (const loc of LOCALES) {
  const mod = await import(path.join(ROOT, 'src/i18n', `${loc}.js`));
  BUNDLE[loc] = mod.default || mod[loc];
}

// ---------------------------------------------------------------------------
// Two records: one with a hole in a held line, one honest
// ---------------------------------------------------------------------------
const m = await manifest();
const course = m.courses.find((c) => c.id === m.default.course);
const unit = course.units.find((u) => u.id === m.default.unit);
const GRAPH = standalone(await loadUnit(unit));
const SKILLS = GRAPH.nodes.map((n) => n.id);

/** Play a knower through the real router until four lines are genuinely held. */
function honestRecord() {
  let seed = 20260825;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  let vnow = Date.now() - 3 * 86_400_000;
  const eng = new MasteryEngine(GRAPH);
  eng.setClock(() => vnow);
  for (let step = 0; step < 900; step++) {
    const objective = eng.next();
    if (!objective) break;
    const task = eng.taskFor(objective.id)
      || { skill: objective.id, kind: 'learn', difficulty: 1, formCandidates: [] };
    const forms = FORMS_BY_SKILL[task.skill] || [];
    const pool = task.formCandidates?.length
      ? task.formCandidates
      : forms.filter((f) => task.difficulty >= f.dMin && task.difficulty <= f.dMax).map((f) => f.id);
    const form = pool[Math.floor(rnd() * pool.length)] || forms[0]?.id;
    eng.observe(task.skill, true, { assisted: false, form, rep: 'symbolic', kind: task.kind });
    vnow += 25_000;
    if (SKILLS.filter((s) => eng.get(s).mastered).length >= 4) break;
  }
  const save = eng.save();
  return { save, held: SKILLS.filter((s) => save.skills[s]?.mastered) };
}

/**
 * The same record with a hole opened in one held line: a question type asked
 * three times and never once solved. This is the state a live save file was
 * found in — it is not a hypothetical.
 */
function holedRecord(honest) {
  const save = JSON.parse(JSON.stringify(honest.save));
  const id = honest.held[honest.held.length - 1];
  const forms = FORMS_BY_SKILL[id] || [];
  const already = new Set(Object.keys(save.skills[id].formsSeen || {}));
  const hole = (forms.find((f) => !already.has(f.id)) || forms[0]).id;
  save.skills[id].formsSeen = { ...save.skills[id].formsSeen, [hole]: { seen: 3, items: 3, correct: 0 } };
  return { save, victim: id, hole };
}

const HONEST = honestRecord();
const HOLED = holedRecord(HONEST);

/** Prove the plant is real before any browser is opened. */
{
  const back = new MasteryEngine(GRAPH, JSON.parse(JSON.stringify(HOLED.save)));
  const took = back.withdrewOnLoad || [];
  if (!took.some((w) => w.id === HOLED.victim)) {
    console.error(`the planted record does not actually lose ${HOLED.victim} on load; this gate would prove nothing`);
    process.exit(2);
  }
  const clean = new MasteryEngine(GRAPH, JSON.parse(JSON.stringify(HONEST.save)));
  if ((clean.withdrewOnLoad || []).length) {
    console.error('the honest record loses a claim on load; the control arm is not a control');
    process.exit(2);
  }
}

function planted(save, locale) {
  return {
    'ascent.save': JSON.stringify({ mastery: save, shards: 210 }),
    // A learner who has been here before: the cold open is done, so the beat is
    // read against a returning session, which is when this really happens.
    'ascent.story': JSON.stringify({ seen: ['story.open.l1'], told: [], ledger: {} }),
    'ascent.locale': locale,
  };
}

// ---------------------------------------------------------------------------
// The play
// ---------------------------------------------------------------------------
async function watch({ url, browser, save, locale, shots, tag, patience = 240 }) {
  const errors = [];
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (msg) => { if (msg.type() === 'error') errors.push(msg.text()); });
  const heard = new Set();
  try {
    await page.goto(`${url}/index.html`, { waitUntil: 'load' });
    await page.evaluate(() => localStorage.clear());
    await page.evaluate((rec) => { for (const [k, v] of Object.entries(rec)) localStorage.setItem(k, v); },
      planted(save, locale));
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60_000 });

    // The channel types one character at a time, so the only honest way to read
    // it is the way a learner does: keep looking at it.
    // Long enough for the channel to get through whatever else it had to say
    // first — a returning greeting and, in one locale, a rank line — and then
    // type two sentences at reading speed. A minute is generous on purpose:
    // being late is a different complaint from being silent, and this gate is
    // about silence.
    const want = norm(BUNDLE[locale].story.withdrawn.why);
    for (let i = 0; i < patience; i++) {
      const line = await page.evaluate(() => document.querySelector('#ui .meta-comms .body')?.textContent || '');
      if (line) heard.add(line);
      if ([...heard].some((x) => norm(x).includes(want))) break;
      await page.waitForTimeout(250);
    }
    if (shots) await page.screenshot({ path: path.join(shots, `${tag}-comms.png`) });

    // …and the other half of honesty: the record a teacher reads.
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(1400);
    const report = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.rp-skill')];
      const by = {};
      for (const r of rows) by[r.dataset.state] = (by[r.dataset.state] || 0) + 1;
      return {
        rows: rows.length,
        by,
        withdrawnNames: rows.filter((r) => r.dataset.state === 'withdrawn')
          .map((r) => r.querySelector('.rp-name')?.textContent || ''),
        // The label printed on that row. It is the offer, on the record: the
        // line is not lost, it is REOPENED, and practice has come back to it.
        withdrawnTags: rows.filter((r) => r.dataset.state === 'withdrawn')
          .map((r) => r.querySelector('.rp-tag')?.textContent || ''),
        locked: rows.filter((r) => r.dataset.state === 'locked').length,
        // What the engine says this learner should do next, off the same
        // surface it prints it on. A claim taken back has to come back round.
        next: document.querySelector('.rp-nx-name')?.textContent || '',
      };
    });
    if (shots) await page.screenshot({ path: path.join(shots, `${tag}-report.png`) });
    return { heard: [...heard], report, errors };
  } finally {
    await ctx.close();
  }
}

async function withBuild(fn, { stubWithdrawn = false } = {}) {
  let url = arg('url', null);
  let out = null; let server = null; let browser = null; let stub = null;
  try {
    if (!url) {
      out = await mkdtemp(path.join(tmpdir(), 'withdrawgate-'));
      /* THE PLANT: the shipping tree with `src/meta/withdrawn.js` replaced by a
         module that says nothing. That is not a mock of the game — it is the
         game exactly as it shipped before this module existed, and it is the
         only honest way to prove this gate would notice its absence.

         Resolved by absolute path rather than by an alias on the specifier:
         `src/meta/index.js` imports it as `./withdrawn.js`, so a `find` on
         `meta/withdrawn.js` matches nothing and the "stubbed" build is the real
         one. That is what the first run of this self-test measured. */
      const plugins = [];
      if (stubWithdrawn) {
        stub = path.join(out, 'no-withdrawn.js');
        await writeFile(stub, 'export function sayWithdrawals() { return []; }\n'
          + 'export function withdrawnOnLoad() { return []; }\n');
        let hit = 0;
        plugins.push({
          name: 'lane-e-stub-withdrawn',
          enforce: 'pre',
          async resolveId(source, importer, options) {
            const r = await this.resolve(source, importer, { ...options, skipSelf: true });
            if (r && r.id.replace(/\\/g, '/').endsWith('/src/meta/withdrawn.js')) { hit++; return stub; }
            return null;
          },
          buildEnd() {
            if (!hit) this.error('the stub never replaced src/meta/withdrawn.js; the self-test would prove nothing');
          },
        });
      }
      await build({
        root: ROOT, base: './', logLevel: 'error',
        plugins,
        build: { target: 'es2022', outDir: path.join(out, 'dist'), emptyOutDir: true, sourcemap: false },
      });
      server = createServer(async (req, res) => {
        const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
        try {
          const body = await readFile(path.join(out, 'dist', rel));
          res.writeHead(200, { 'content-type': MIME[path.extname(rel)] || 'application/octet-stream' });
          res.end(body);
        } catch { res.writeHead(404); res.end('nope'); }
      });
      const port = await listenFree(server);
      url = `http://127.0.0.1:${port}`;
    }
    browser = await chromium.launch({
      headless: !HEADED,
      args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    });
    return await fn({ url, browser });
  } finally {
    try { server?.close(); } catch { /* already down */ }
    try { await browser?.close(); } catch { /* already down */ }
    if (out) await rm(out, { recursive: true, force: true });
  }
}

/** Did the learner hear the withdrawal, in this locale, about this line? */
function verdict(seen, locale, victim) {
  const b = BUNDLE[locale];
  const skill = b.skills[victim];
  const why = norm(b.story.withdrawn.why);
  // The head line carries `{skill}`, so it is checked by the literal tail of
  // its own first sentence plus the localised name of the line.
  const headTail = norm(b.story.withdrawn.one.split('}').slice(1).join('}').split('.')[0]);
  const all = seen.map(norm).join('\n');
  return {
    said: all.includes(why),
    named: !!skill && all.includes(norm(skill)),
    head: !!headTail && all.includes(headTail),
    skill,
    reopened: norm(b.report.state.withdrawn),
  };
}

await mkdir(OUT, { recursive: true });
console.log(`planted hole: ${HOLED.victim} · form "${HOLED.hole}" asked 3, solved 0`);
console.log(`held in the honest control: ${HONEST.held.join(', ')}`);

const steps = [];
const note = (ok, label, detail = '') => {
  steps.push({ ok, label, detail });
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ' — ' + detail : ''}`);
};

if (SELF) {
  console.log('\n--- self-test: the product with nothing to say ------------------');
  // A negative arm never breaks early, so it runs the whole window. Half of one
  // is still six times the delay the beat is posted on and every other line the
  // channel had to get through first.
  const silent = await withBuild(({ url, browser }) => watch({
    url, browser, save: HOLED.save, locale: 'en', tag: 'selftest-silent', patience: 120,
  }), { stubWithdrawn: true });
  const v = verdict(silent.heard, 'en', HOLED.victim);
  const withdrewAnyway = (silent.report.by.withdrawn || 0) > 0;
  let bad = 0;
  if (!withdrewAnyway) {
    console.error('SELF-TEST FAIL: the stubbed build did not withdraw the claim either, so nothing was hidden and this proves nothing');
    bad++;
  } else console.log(`  ok     the claim is still withdrawn in the stubbed build (${silent.report.by.withdrawn} row)`);
  if (v.said || v.head) {
    console.error('SELF-TEST FAIL: the words appeared with the module stubbed out; this gate is reading something else');
    bad++;
  } else console.log('  ok     …and with src/meta/withdrawn.js stubbed the learner is told nothing — the defect, reproduced');

  console.log('\n--- self-test: an HONEST record must stay quiet ----------------');
  const clean = await withBuild(({ url, browser }) => watch({
    url, browser, save: HONEST.save, locale: 'en', tag: 'selftest-honest', patience: 120,
  }));
  const cv = verdict(clean.heard, 'en', HOLED.victim);
  if (cv.said || cv.head) {
    console.error('SELF-TEST FAIL: a record with no hole in it was told a claim had been withdrawn');
    bad++;
  } else console.log('  ok     four lines held with no hole: nothing is withdrawn and nothing is said');
  if ((clean.report.by.withdrawn || 0) > 0) {
    console.error(`SELF-TEST FAIL: the honest record shows ${clean.report.by.withdrawn} withdrawn row(s)`);
    bad++;
  } else console.log('  ok     …and the report shows no withdrawn line either');
  if (bad) { console.error('\nself-test failed'); process.exit(1); }
  console.log('\nself-test passed');
  process.exit(0);
}

const results = await withBuild(async ({ url, browser }) => {
  const out = {};
  for (const loc of LOCALES) {
    out[loc] = await watch({ url, browser, save: HOLED.save, locale: loc, shots: OUT, tag: loc });
  }
  return out;
});

const errors = [];
for (const loc of LOCALES) {
  const r = results[loc];
  errors.push(...r.errors);
  const v = verdict(r.heard, loc, HOLED.victim);
  note(v.head, `[${loc}] the learner is told the line is open again`,
    v.head ? '' : `never said "${BUNDLE[loc].story.withdrawn.one.split('}').slice(1).join('}').split('.')[0].trim()}"`);
  note(v.named, `[${loc}] …and which line it was`, v.skill);
  note(v.said, `[${loc}] …and what to do to get it back`,
    v.said ? BUNDLE[loc].story.withdrawn.why : 'the offer of a re-check never reached the screen');
  note((r.report.by.withdrawn || 0) >= 1,
    `[${loc}] the record a teacher reads shows the claim as withdrawn`,
    r.report.withdrawnNames.join(', ') || JSON.stringify(r.report.by));
  /* THE RE-CHECK IS ON THE RECORD, not only in a sentence that scrolls away.
     The row for the withdrawn line carries the state's own label — REOPENED —
     which is the standing answer to "what happened to it": practice has come
     back to that line and it can be re-proved through the ordinary gate.

     This gate first asserted something stronger and wrong: that the engine
     serves the withdrawn line NEXT. It does not, and it should not. Every held
     line in a loaded record comes back due at once (`load()`), so the next
     objective was a due re-probe of a line that is still held — which is a
     legitimate call the product makes for its own reasons. Asserting it fails
     three locales for a promise the product never made. */
  note(!!v.skill && r.report.withdrawnTags.some((x) => norm(x) === v.reopened),
    `[${loc}] …and the record says the line has reopened, not that it is lost`,
    r.report.withdrawnTags.join(', ') || 'no tag on the row');
}
note(errors.length === 0, 'no console errors', errors.slice(0, 3).join(' | '));

const failed = steps.filter((s) => !s.ok);
await writeFile(path.join(OUT, 'withdrawn.json'), JSON.stringify({
  victim: HOLED.victim, hole: HOLED.hole, steps, errors,
  heard: Object.fromEntries(LOCALES.map((l) => [l, results[l].heard])),
}, null, 2));
console.log(`\n${steps.length - failed.length}/${steps.length} passed  ->  ${OUT}`);
if (failed.length) {
  console.log('\nA mastery claim was taken back and the learner was not told:');
  failed.forEach((f) => console.log('  - ' + f.label + (f.detail ? ` (${f.detail})` : '')));
}
/* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs. A mastery claim taken back in silence is taken back from a learner on the
   shipped route, in whichever of the three locales they read. */
findings('check:withdrawn', { scope: 'route' })
  .route(failed.map((f) => `${f.label}${f.detail ? ` (${f.detail})` : ''}`))
  .done();
