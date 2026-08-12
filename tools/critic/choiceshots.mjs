/**
 * Pixels of the readings a learner chooses between.
 *
 * The audit reads the DOM; a screenshot is the only thing that can tell you the
 * DOM was drawn where a person could read it. Every choice-carrying form, in
 * every language, plus the narrowed set the keypad falls back to.
 *
 *   node tools/critic/choiceshots.mjs shots/ped-choices
 */
import { chromium } from 'playwright';
import { build } from 'vite';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const LAB = path.join(HERE, 'choicelab');
const OUT = path.resolve(process.argv[2] || 'shots/ped-choices');
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };

const dist = await mkdtemp(path.join(tmpdir(), 'choiceshots-'));
let server, browser;
const done = async () => { try { server?.close(); } catch {} try { await browser?.close(); } catch {} await rm(dist, { recursive: true, force: true }); };

try {
  await mkdir(OUT, { recursive: true });
  await build({ root: LAB, base: './', logLevel: 'error', build: { target: 'es2022', outDir: dist, emptyOutDir: true, sourcemap: false } });
  const port = 4900 + Math.floor(Math.random() * 90);
  server = createServer(async (req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    try {
      const body = await readFile(path.join(dist, rel));
      res.writeHead(200, { 'content-type': MIME[path.extname(rel)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end(''); }
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));

  browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 2 })).newPage();
  page.on('console', (m) => { if (m.type() === 'error') console.log('  ! ' + m.text()); });
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__lab);

  const cases = [
    // every form that puts a set of readings on the surface
    { skill: 'var-meaning', form: 'vm-choose', difficulty: 3, seed: 1000 },
    { skill: 'one-step-add', form: 'oa-model', difficulty: 3, seed: 1000 },
    { skill: 'two-step', form: 'ts-model', difficulty: 4, seed: 1000 },
    { skill: 'both-sides', form: 'bs-special', difficulty: 4, seed: 1000 },
    { skill: 'both-sides', form: 'bs-collect', difficulty: 5, seed: 3000 },
    // the narrowed set: the surface after two honest misses
    { skill: 'eval-expr', form: 'ee-linear', difficulty: 3, seed: 1000, narrow: true },
    { skill: 'two-step', form: 'ts-symbolic', difficulty: 5, seed: 2000, narrow: true },
    { skill: 'one-step-mul', form: 'om-fraction', difficulty: 5, seed: 7000, narrow: true },
    { skill: 'multi-step', form: 'ms-bracket', difficulty: 5, seed: 4000, narrow: true },
    { skill: 'order-ops', form: 'oo-fracbar', difficulty: 5, seed: 9000, narrow: true },
    { skill: 'eval-expr', form: 'ee-fraction', difficulty: 4, seed: 5000, narrow: true },
  ];

  for (const c of cases) {
    for (const locale of ['en', 'es', 'pl']) {
      let info;
      try { info = await page.evaluate((k) => window.__lab.showOne(k), { ...c, locale }); }
      catch (e) { console.log(`skip ${c.skill}/${c.form} ${locale}: ${e.message}`); continue; }
      await page.waitForTimeout(160);
      const sel = info.surface === 'narrow' ? '.rf-narrow' : '.rf-readings';
      const box = await page.$(sel);
      if (!box) { console.log(`no ${sel} for ${c.skill}/${c.form} (${info.mode})`); continue; }
      const name = `${c.skill}-${c.form}-${locale}${c.narrow ? '-narrow' : ''}`;
      await box.screenshot({ path: path.join(OUT, `${name}.png`) });
      console.log(`${name}  answer=${JSON.stringify(info.answer)}  reads=${JSON.stringify(info.options.map((o) => o.visible))}`);
    }
  }
  console.log(`\n-> ${OUT}`);
  await done();
} catch (e) { console.error(e); await done(); process.exit(2); }
