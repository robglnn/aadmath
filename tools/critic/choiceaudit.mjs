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
  if (SELFTEST) { await done(); process.exit(0); }

  const plan = await page.evaluate((o) => window.__lab.plan(o).length, opts);
  const CHUNK = 40;
  const all = { items: 0, skipped: 0, modes: {}, findings: [] };
  const t0 = Date.now();
  for (let i = 0; i < plan; i += CHUNK) {
    const r = await page.evaluate((o) => window.__lab.run(o), { ...opts, slice: [i, Math.min(plan, i + CHUNK)] });
    all.items += r.items; all.skipped += r.skipped;
    for (const [k, v] of Object.entries(r.modes)) all.modes[k] = (all.modes[k] || 0) + v;
    all.findings.push(...r.findings);
    const pctDone = Math.round(Math.min(plan, i + CHUNK) / plan * 100);
    process.stdout.write(`\r  ${pctDone}%  ${all.items} items  ${all.findings.length} findings   `);
  }
  process.stdout.write('\n');

  const secs = ((Date.now() - t0) / 1000).toFixed(1);
  console.log(`choice-set audit: ${all.items} items rendered through the real rift in ${secs}s`);
  console.log(`  surfaces: ${Object.entries(all.modes).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  if (all.skipped) console.log(`  ${all.skipped} draws the bank refused (retries), not audited`);

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
