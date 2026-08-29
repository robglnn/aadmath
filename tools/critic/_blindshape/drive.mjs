/**
 * BLIND CRITIC · driver for the shape lab.
 *
 * Builds the lab as a frozen bundle, serves it on a free port, and drives it.
 * Nothing here touches window.__ascent.
 */
import { build } from 'vite';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm, writeFile } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
  '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.json': 'application/json', '.svg': 'image/svg+xml' };

const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf(k); return i < 0 ? d : argv[i + 1]; };
const N = Number(arg('--n', 400));            // items per unit per locale
const LOCALES = String(arg('--locales', 'en,es,pl')).split(',');
const OUTJSON = arg('--out', '/tmp/critic-shape/probe.json');
const SELFTEST = argv.includes('--self-test');

const out = await mkdtemp(path.join(tmpdir(), 'blindshape-'));
let server, browser;
const done = async () => { try { server?.close(); } catch {} try { await browser?.close(); } catch {} await rm(out, { recursive: true, force: true }); };

const UNITS = {
  'algebra1-l1': ['var-meaning', 'eval-expr', 'order-ops', 'like-terms', 'distribute',
    'one-step-add', 'one-step-mul', 'two-step', 'multi-step', 'both-sides'],
  'algebra1-l2': ['bracket-both-sides', 'fraction-solve', 'rule-from-table', 'inequality-one-step',
    'inequality-two-step', 'inequality-multi-step', 'compound-inequality', 'literal-equations',
    'ratio-proportion', 'slope-rate', 'graph-linear', 'write-linear', 'system-substitution', 'system-elimination'],
};

try {
  await build({ root: HERE, base: './', logLevel: 'error',
    build: { target: 'es2022', outDir: out, emptyOutDir: true, sourcemap: false, assetsInlineLimit: 0 } });

  server = createServer(async (req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    try {
      const body = await readFile(path.join(out, rel));
      res.writeHead(200, { 'content-type': MIME[path.extname(rel)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end('nope'); }
  });
  const port = await new Promise((res2, rej) => {
    server.once('error', rej);
    server.listen(0, '127.0.0.1', () => res2(server.address().port));
  });

  browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
  const errors = [];       // the GAME's own console
  const driverErrors = [];  // the harness's
  const LANES = Number(arg('--lanes', 3));
  const ctxs = [];
  const newPage = async (li) => {
    try { await ctxs[li]?.close(); } catch {}
    const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
    ctxs[li] = ctx;
    const pg = await ctx.newPage();
    pg.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
    pg.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await pg.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
    await pg.waitForFunction(() => !!window.__blind, null, { timeout: 90000 });
    return pg;
  };
  const pages = [];
  for (let i = 0; i < LANES; i++) pages.push(await newPage(i));
  const page = pages[0];

  // ---------------------------------------------------------- the plan
  //
  // TWO PLANS, because they answer two different questions.
  //
  // `route` is the population a learner meets: every skill of the two route
  // units, every band, uniform. It says what share of a sitting each surface
  // is, and it is the plan the task's "2,000 items per route unit, every band,
  // all three locales" names.
  //
  // `deep` is a targeted plan over the skills that REACH a given surface, so
  // the sorting bays and the area field — 3.5% and 4% of a uniform sweep — get
  // a sample big enough to state a per-form number about.
  const MODE = arg('--plan', 'route');
  const DEEP = {
    sort: ['like-terms'],
    area: ['distribute'],
    special: ['both-sides'],
    plot: ['graph-linear'],
    balance: ['one-step-add', 'one-step-mul', 'two-step', 'multi-step', 'both-sides',
      'bracket-both-sides', 'fraction-solve'],
    choice: ['inequality-one-step', 'inequality-two-step', 'inequality-multi-step',
      'compound-inequality', 'literal-equations', 'write-linear', 'var-meaning', 'ratio-proportion'],
    narrow: ['var-meaning', 'eval-expr', 'order-ops', 'like-terms', 'rule-from-table',
      'slope-rate', 'system-substitution', 'system-elimination'],
  };
  const plan = [];
  if (MODE === 'route') {
    for (const locale of LOCALES) {
      for (const [unit, skills] of Object.entries(UNITS)) {
        for (let i = 0; i < N; i++) {
          const skill = skills[i % skills.length];
          const band = 1 + (Math.floor(i / skills.length) % 5);
          plan.push({ unit, skill, band, seed: (i * 7919 + 13) >>> 0, locale });
        }
      }
    }
  } else if (MODE === 'forms') {
    // the per-form leaks the route sweep named, at a sample size that settles them
    const SK = ['order-ops', 'inequality-multi-step', 'like-terms', 'var-meaning',
      'literal-equations', 'compound-inequality', 'two-step', 'eval-expr'];
    for (const locale of LOCALES) for (const skill of SK) {
      const unit = UNITS['algebra1-l1'].includes(skill) ? 'algebra1-l1' : 'algebra1-l2';
      for (let i = 0; i < N; i++) plan.push({ unit, tag: skill, skill, band: 1 + (i % 5), seed: (i * 2749 + 61) >>> 0, locale });
    }
  } else if (MODE === 'sortarea') {
    for (const locale of LOCALES) for (const [skill, unit] of [['like-terms', 'algebra1-l1'], ['distribute', 'algebra1-l1']]) {
      for (let i = 0; i < N; i++) plan.push({ unit, tag: skill, skill, band: 1 + (i % 5), seed: (i * 5119 + 41) >>> 0, locale });
    }
  } else if (MODE === 'focus') {
    // the two surfaces a proving run can be made entirely of, at the GATE BAND
    for (const locale of LOCALES) {
      for (const [skill, unit] of [['like-terms', 'algebra1-l1'], ['graph-linear', 'algebra1-l2'],
        ['distribute', 'algebra1-l1'], ['both-sides', 'algebra1-l1']]) {
        for (let i = 0; i < N; i++) {
          plan.push({ unit, tag: skill, skill, band: 4 + (i % 2), seed: (i * 4013 + 17) >>> 0, locale });
        }
      }
    }
  } else {
    const unitOf = (sk) => (UNITS['algebra1-l1'].includes(sk) ? 'algebra1-l1' : 'algebra1-l2');
    for (const locale of LOCALES) {
      for (const [tag, skills] of Object.entries(DEEP)) {
        for (let i = 0; i < N; i++) {
          const skill = skills[i % skills.length];
          const band = 1 + (Math.floor(i / skills.length) % 5);
          plan.push({ unit: unitOf(skill), tag, skill, band, seed: (i * 6199 + 29) >>> 0, locale });
        }
      }
    }
  }
  const T0 = Date.now();
  process.stderr.write(`plan: ${plan.length} items (${N}/unit/locale × ${LOCALES.length} locales × 2 units)\n`);

  const results = [];
  const CH = 20;
  let doneCount = 0;
  const lanes = pages.map(async (pg0, li) => {
    let pg = pg0;
    let mine = 0;
    for (let i = li * CH; i < plan.length; i += CH * pages.length) {
      const slice = plan.slice(i, i + CH);
      let r = null;
      for (let attempt = 0; attempt < 3 && !r; attempt++) {
        try {
          r = await pg.evaluate((sl) => sl.map((sp) => {
            const o = window.__blind.probe(sp);
            return { unit: sp.unit, tag: sp.tag, ...o };
          }), slice);
        } catch (e) {
          driverErrors.push(`EVALUATE ${String(e.message).slice(0, 100)}`);
          try { pg = await newPage(li); mine = 0; } catch (e2) { driverErrors.push('RECOVER ' + String(e2.message).slice(0, 80)); break; }
        }
      }
      if (!r) continue;
      results.push(...r);
      doneCount += slice.length;
      mine += CH;
      if (mine >= 100) { try { pg = await newPage(li); } catch {} mine = 0; }
      if (li === 0) process.stderr.write(`  ${doneCount}/${plan.length} (${((Date.now() - T0) / 1000).toFixed(0)}s)   \r`);
    }
  });
  await Promise.all(lanes);
  process.stderr.write('\n');
  let planted = [];
  if (SELFTEST) {
    // Every surface gets a cue planted in it; the named rule must then fire.
    const want = [
      ['choice', 'first', 'both-sides', 4],
      ['sort', 'alternate', 'like-terms', 2],
      ['balance', 'divideIfPresent', 'two-step', 3],
      ['narrow', 'first', 'one-step-add', 1],
    ];
    for (const [surface, rule, skill, band] of want) {
      const got = await page.evaluate(({ surface: sf, rule: rl, skill: sk, band: bd }) => {
        const hits = [];
        for (let sd = 1; sd < 400 && hits.length < 60; sd++) {
          const r = window.__blind.planted({ skill: sk, band: bd, seed: sd * 977, locale: 'en' }, sf, rl);
          if (r) hits.push(r);
        }
        return hits;
      }, { surface, rule, skill, band });
      planted.push({ surface, rule, skill, n: got.length,
        sealedUnassisted: got.filter((g) => g.sealed && !g.assisted).length,
        sealed: got.filter((g) => g.sealed).length });
    }
  }

  await writeFile(OUTJSON, JSON.stringify({ n: results.length, want: plan.length,
    errors: errors.slice(0, 200), nErrors: errors.length,
    driverErrors: driverErrors.slice(0, 40), nDriverErrors: driverErrors.length, planted, results }));
  process.stderr.write(`wrote ${OUTJSON} · ${results.length}/${plan.length} probes · ${errors.length} GAME console errors · ${driverErrors.length} harness recoveries\n`);
  if (errors.length) process.stderr.write(errors.slice(0, 5).join('\n') + '\n');
} finally { await done(); }
