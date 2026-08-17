/**
 * ANSWER INTEGRITY gate — the render-level choice-set audit.
 *
 * `tools/validate-items.mjs` proves the item bank is sound. It cannot prove the
 * learner is looking at what the bank computed: everything between the answer
 * and the button is downstream of it. This builds a frozen page that mounts the
 * REAL `src/ui/rift.js` panel, puts every item form on it in every locale, and
 * reads the options back off the DOM — then clicks them.
 *
 * A choice set that does not contain its own answer, an answer that renders as
 * a different number, two options that read the same, or a correct entry the
 * rig marks wrong all fail the build here.
 *
 * And so does a set whose answer sits in a place a cadet could learn. That one
 * is invisible in any single item — no one option set is "biased" — so it is
 * tested on the whole sweep: every position the correct reading landed in is
 * tallied per surface and per option count, and the distribution is put through
 * a chi-square test against the uniform one it must be. A rig that put the
 * answer first even a fifth of the time too often fails here, because a learner
 * who notices that stops reading the options and starts reading the layout.
 *
 *   node tools/critic/choiceaudit.mjs                # the gate (fast sweep)
 *   node tools/critic/choiceaudit.mjs --full         # every form × band × locale, deep
 *   node tools/critic/choiceaudit.mjs --seeds 12 --checking
 *   node tools/critic/choiceaudit.mjs --skill two-step --locale pl
 *   node tools/critic/choiceaudit.mjs --self-test    # prove the audit can fail
 *
 * Exit 0 = every option a learner can see is honest.
 */
import { chromium } from 'playwright';
import { build } from 'vite';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const LAB = path.join(HERE, 'choicelab');

const argv = process.argv.slice(2);
const flag = (k) => argv.includes('--' + k);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };

const FULL = flag('full');
const SELFTEST = flag('self-test');
const opts = {
  locales: arg('locale') ? [arg('locale')] : ['en', 'es', 'pl'],
  skills: arg('skill') ? [arg('skill')] : undefined,
  difficulties: arg('d') ? [Number(arg('d'))] : [1, 2, 3, 4, 5],
  seeds: Number(arg('seeds', FULL ? 8 : 3)),
  seed0: Number(arg('seed0', 1000)),
  checking: FULL || flag('checking'),
};

const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.json': 'application/json' };

// ---------------------------------------------------------------------------
// Is the answer's position learnable?
// ---------------------------------------------------------------------------
/**
 * Upper-tail chi-square critical values at p = 0.001, by degrees of freedom.
 *
 * p = 0.001 and not 0.05 on purpose. This gate runs on every build, over
 * several buckets, and a 5% test would go red about once a fortnight on a rig
 * that is behaving perfectly. A gate that cries wolf is a gate that gets
 * ignored, and the defect it exists to catch — an answer that favours a slot —
 * is not a 5%-of-uniform effect. It is a pattern a teenager can see, which is
 * enormous, and 0.001 catches it with a decade of room to spare.
 */
const CHI2_P001 = { 1: 10.828, 2: 13.816, 3: 16.266, 4: 18.467, 5: 20.515, 6: 22.458, 7: 24.322 };

/**
 * @param {number[]} counts how often the answer landed in each slot
 * @returns {null|{thin:boolean, chi:number, crit:number, n:number, worst:string}}
 *          null only when there is nothing to test (fewer than two slots).
 *          `thin` marks a sample too small to say anything about, which the
 *          caller prints as such rather than passing in silence. Otherwise
 *          `chi > crit` is the verdict.
 */
function positionBias(counts) {
  const n = counts.reduce((a, b) => a + b, 0);
  const k = counts.length;
  if (k < 2) return null;
  // Below this the test has no power and would only produce noise. Reported
  // separately by the caller so a thin bucket is never silently a pass.
  if (n < 60) return { thin: true, n, chi: 0, crit: 0, worst: '' };
  const exp = n / k;
  const chi = counts.reduce((a, c) => a + ((c - exp) ** 2) / exp, 0);
  // Wilson–Hilferty for anything past the table. No rift has ever drawn eight
  // readings, so this is a guard against a future surface rather than a path
  // anything currently takes — but a wrong constant here would fail silently,
  // which is the one way a gate can be worse than no gate.
  const crit = CHI2_P001[k - 1] ?? (() => {
    const df = k - 1;
    return df * (1 - 2 / (9 * df) + 3.0902 * Math.sqrt(2 / (9 * df))) ** 3;
  })();
  const worst = counts
    .map((c, i) => ({ i, c }))
    .sort((a, b) => Math.abs(b.c - exp) - Math.abs(a.c - exp))[0];
  return { thin: false, n, chi, crit,
    worst: `slot ${worst.i + 1} took it ${worst.c}/${n} times (${(100 * worst.c / n).toFixed(1)}%, expected ${(100 / k).toFixed(1)}%)` };
}

const out = await mkdtemp(path.join(tmpdir(), 'choicelab-'));
let server, browser;
const done = async () => { try { server?.close(); } catch {} try { await browser?.close(); } catch {} await rm(out, { recursive: true, force: true }); };

try {
  // A frozen build, for the same reason snapshot.sh exists: several builders
  // hot-edit this tree at once and a dev server reloads out from under the run.
  await build({
    root: LAB,
    base: './',
    logLevel: 'error',
    build: { target: 'es2022', outDir: out, emptyOutDir: true, sourcemap: false, assetsInlineLimit: 0 },
  });

  const port = 4700 + Math.floor(Math.random() * 500);
  server = createServer(async (req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    try {
      const body = await readFile(path.join(out, rel));
      res.writeHead(200, { 'content-type': MIME[path.extname(rel)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end('nope'); }
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));

  browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__lab, null, { timeout: 30000 });

  // A gate nobody has watched go red is a gate nobody should trust, so it
  // proves itself on every run rather than in a flag somebody has to remember.
  const rigged = await page.evaluate(() => window.__lab.selfTest());
  const caught = rigged.codes.includes('no-correct-option');
  console.log(`self-test — a rift worth 144 whose answer says 104: ${caught ? 'caught' : 'MISSED'}`);
  if (rigged.detail[0]) console.log(`  ${rigged.detail[0]}`);
  if (!caught) {
    console.log('\nFAIL — the audit cannot see the defect it exists to catch. Nothing below is evidence.');
    await done();
    process.exit(1);
  }

  // The position test proves itself too, and on both sides: it has to redden
  // for the defect the client reported (the answer listed first) and stay
  // green for a rig that is merely lucky or unlucky, or it is a gate that
  // trades one false claim for another.
  const answerFirst = positionBias([300, 0, 0]);          // the reported defect
  const leaning = positionBias([132, 84, 84]);            // 44/28/28 — subtler
  const honest = positionBias([104, 96, 100]);            // uniform, with noise
  const sawFirst = !!answerFirst && answerFirst.chi > answerFirst.crit;
  const sawLean = !!leaning && leaning.chi > leaning.crit;
  const sparedHonest = !!honest && honest.chi <= honest.crit;
  console.log(`self-test — answer always first: ${sawFirst ? 'caught' : 'MISSED'}`
    + ` · a 44/28/28 lean: ${sawLean ? 'caught' : 'MISSED'}`
    + ` · an honest 104/96/100: ${sparedHonest ? 'spared' : 'FALSE ALARM'}`);
  if (!sawFirst || !sawLean || !sparedHonest) {
    console.log('\nFAIL — the position test does not measure what it claims to. Nothing below is evidence.');
    await done();
    process.exit(1);
  }
  if (SELFTEST) { await done(); process.exit(0); }

  const plan = await page.evaluate((o) => window.__lab.plan(o).length, opts);
  const CHUNK = 40;
  const all = { items: 0, skipped: 0, modes: {}, positions: {}, findings: [] };
  const t0 = Date.now();
  for (let i = 0; i < plan; i += CHUNK) {
    const r = await page.evaluate((o) => window.__lab.run(o), { ...opts, slice: [i, Math.min(plan, i + CHUNK)] });
    all.items += r.items; all.skipped += r.skipped;
    for (const [k, v] of Object.entries(r.modes)) all.modes[k] = (all.modes[k] || 0) + v;
    for (const [k, row] of Object.entries(r.positions || {})) {
      const acc = (all.positions[k] ||= new Array(row.length).fill(0));
      for (let j = 0; j < row.length; j++) acc[j] += row[j];
    }
    all.findings.push(...r.findings);
    const pctDone = Math.round(Math.min(plan, i + CHUNK) / plan * 100);
    process.stdout.write(`\r  ${pctDone}%  ${all.items} items  ${all.findings.length} findings   `);
  }
  process.stdout.write('\n');

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`choice-set audit: ${all.items} items rendered through the real rift in ${secs}s`);
  console.log(`  surfaces: ${Object.entries(all.modes).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  if (all.skipped) console.log(`  ${all.skipped} draws the bank refused (retries), not audited`);

  // ---- where the answer landed, over the whole sweep ----------------------
  console.log('\nanswer position — the slot the correct reading landed in:');
  const posKeys = Object.keys(all.positions).sort();
  if (!posKeys.length) console.log('  (no option sets were drawn)');
  for (const key of posKeys) {
    const counts = all.positions[key];
    const v = positionBias(counts);
    const n = counts.reduce((a, b) => a + b, 0);
    const pct = counts.map((c) => `${(100 * c / (n || 1)).toFixed(1)}%`).join('  ');
    const flat = counts.join(' / ');
    if (v?.thin) {
      console.log(`  ${key.padEnd(12)} ${flat}   ${pct}   — ${n} sets, too few to test`);
      continue;
    }
    const bad = v && v.chi > v.crit;
    console.log(`  ${key.padEnd(12)} ${flat}   ${pct}   chi2 ${v.chi.toFixed(2)} vs ${v.crit.toFixed(2)} (p<0.001) ${bad ? '  BIASED' : '  ok'}`);
    if (bad) {
      all.findings.push({
        code: 'answer-position-biased', locale: '-', skill: '-', form: '-', difficulty: 0, seed: 0,
        mode: key.split(':')[0],
        detail: `over ${n} option sets of ${counts.length}, ${v.worst}; chi2 ${v.chi.toFixed(2)} > ${v.crit} (p<0.001). A learner can answer by position.`,
      });
    }
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

  const failed = all.findings.length > 0 || errors.length > 0;
  console.log(`\n${failed ? 'FAIL' : 'PASS'} — ${all.findings.length} answer-integrity findings, ${errors.length} console errors`);
  await done();
  process.exit(failed ? 1 : 0);
} catch (e) {
  console.error(e);
  await done();
  process.exit(2);
}
