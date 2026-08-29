/**
 * BLIND CRITIC · the harness's self-test.
 *
 * A cue is PLANTED in each of the six surfaces and the named shape rule has to
 * find it. A harness that cannot catch a planted cue has nothing to say about a
 * clean one. Each plant is measured against the SAME rule on the SAME cards
 * with no plant, so "it fired" is a difference and not a coincidence.
 */
import { build } from 'vite';
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.json': 'application/json', '.svg': 'image/svg+xml' };
const out = await mkdtemp(path.join(tmpdir(), 'blindself-'));
let server, browser;
try {
  await build({ root: HERE, base: './', logLevel: 'error', build: { target: 'es2022', outDir: out, emptyOutDir: true, sourcemap: false, assetsInlineLimit: 0 } });
  server = createServer(async (req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    try { const body = await readFile(path.join(out, rel)); res.writeHead(200, { 'content-type': MIME[path.extname(rel)] || 'application/octet-stream' }); res.end(body); }
    catch { res.writeHead(404); res.end('nope'); }
  });
  const port = await new Promise((r, j) => { server.once('error', j); server.listen(0, '127.0.0.1', () => r(server.address().port)); });
  browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
  const page = await (await browser.newContext({ viewport: { width: 1500, height: 950 } })).newPage();
  const errs = [];
  page.on('pageerror', (e) => errs.push(String(e.message)));
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__blind, null, { timeout: 90000 });

  // surface, the rule the plant should light up, a skill that reaches it, band
  const CASES = [
    ['choice',  'first',           'inequality-two-step', 3, (r) => r.sealed && !r.assisted],
    ['special', 'first',           'both-sides',          4, (r) => r.sealed && !r.assisted],
    ['narrow',  'first',           'one-step-add',        2, (r) => r.sealed],
    ['sort',    'alternate',       'like-terms',          4, (r) => r.sealed && !r.assisted],
    ['area',    'biggestAbs',      'distribute',          3, (r) => r.sealed && !r.assisted],
    // The beam's plant makes the IDEAL move the only division; the rule must
    // press that button.
    ['balance', 'divideIfPresent', 'two-step',            3, (r) => r.tookPlant],
    // The chart already marks readings ON the answer, so its plant runs the
    // other way: the marks are moved OFF the line and the rule must STOP
    // sealing. The control below is the honest chart, where it does seal.
    ['plot',    'onAnchors',       'graph-linear',        3, (r) => (r.inverted ? !r.sealed : r.sealed && !r.assisted)],
  ];
  let bad = 0;
  console.log('PLANTED CUE            RULE              n   planted   control   verdict');
  for (const [surface, rule, skill, band, win] of CASES) {
    const got = await page.evaluate(({ surface: sf, rule: rl, skill: sk, band: bd }) => {
      const planted = [], control = [];
      const want = sf === 'special' ? 'choice' : sf;
      for (let sd = 1; sd < 3000 && planted.length < 60; sd++) {
        const spec = { skill: sk, band: bd, seed: (sd * 977) >>> 0, locale: 'en' };
        const p = window.__blind.planted(spec, want, rl);
        if (!p) continue;
        const c = window.__blind.control(spec, want, rl);
        planted.push(p); if (c) control.push(c);
      }
      return { planted, control };
    }, { surface, rule, skill, band });
    const wins = got.planted.filter(win).length;
    const ctrlWin = surface === 'plot' ? ((r) => !(r.sealed && !r.assisted)) : (surface === 'balance' ? ((r) => r.tookPlant) : win);
    const ctrl = got.control.filter(ctrlWin).length;
    const n = got.planted.length;
    const ok = n >= 20 && wins / n >= 0.9 && wins / n > (ctrl / Math.max(1, got.control.length)) + 0.2;
    if (!ok) bad++;
    console.log(`${surface.padEnd(22)} ${rule.padEnd(16)} ${String(n).padStart(3)}  ${(100 * wins / Math.max(1, n)).toFixed(1).padStart(6)}%  ${(100 * ctrl / Math.max(1, got.control.length)).toFixed(1).padStart(6)}%   ${ok ? 'CAUGHT' : 'MISSED — this harness cannot see a cue in this surface'}`);
  }
  if (errs.length) console.log(`page errors: ${errs.length} — ${errs[0]}`);
  console.log(bad ? `\nSELF-TEST FAILED on ${bad} surface(s). Nothing this harness says about those surfaces is evidence.`
    : '\nSELF-TEST PASSED — every surface refuses its own planted cue, and the same rule on the same cards without the plant does not.');
  process.exitCode = bad ? 1 : 0;
} finally { try { server?.close(); } catch {} try { await browser?.close(); } catch {} await rm(out, { recursive: true, force: true }); }
