import { chromium } from 'playwright';
import { build } from 'vite';
import { createServer } from 'node:http';
import { readFile, mkdir, writeFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../../..');
const LAB = path.join(HERE, 'plotlab');
const OUT = path.join(ROOT, 'shots/l2audit/plot');
await mkdir(OUT, { recursive: true });
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };
const dist = await mkdtemp(path.join(tmpdir(), 'plotlab-'));
await build({ root: LAB, base: './', logLevel: 'error',
  build: { target: 'es2022', outDir: dist, emptyOutDir: true, sourcemap: false, assetsInlineLimit: 0 } });
const port = 4700 + Math.floor(Math.random() * 500);
const server = createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  try {
    const body = await readFile(path.join(dist, rel));
    res.writeHead(200, { 'content-type': MIME[path.extname(rel)] || 'application/octet-stream' });
    res.end(body);
  } catch { res.writeHead(404); res.end('nope'); }
});
await new Promise((r) => server.listen(port, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const VIEWPORTS = [
  { name: 'portrait-390x844', width: 390, height: 844 },
  { name: 'landscape-844x390', width: 844, height: 390 },
];
const CASES = [
  ['graph-linear', 'gl-plot-points', 2, 1234],
  ['graph-linear', 'gl-plot-table', 3, 555],
  ['graph-linear', 'gl-context', 2, 99],
];
const rows = [];
for (const vp of VIEWPORTS) {
  for (const loc of ['en', 'es', 'pl']) {
    const ctx = await browser.newContext({
      viewport: { width: vp.width, height: vp.height },
      deviceScaleFactor: 3, isMobile: true, hasTouch: true,
    });
    const page = await ctx.newPage();
    const errs = [];
    page.on('pageerror', (e) => errs.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
    await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__plot, null, { timeout: 20000 });
    for (const [skill, form, d, seed] of CASES) {
      const info = await page.evaluate(([s, f, dd, se, l]) => window.__plot.open(s, f, dd, se, l),
        [skill, form, d, seed, loc]);
      if (!info) { rows.push({ vp: vp.name, loc, form, err: 'no plot item' }); continue; }
      await page.waitForTimeout(350);
      const targets = await page.evaluate(() => window.__plot.targets());
      const tap = await page.evaluate(() => window.__plot.tapProbe());
      const of = await page.evaluate(() => window.__plot.overflow());
      const knobs = targets.filter((t) => /knob-hit/.test(t.what || ''));
      const dots = targets.filter((t) => /^knob( |$)/.test(t.what || ''));
      const stg = targets.find((t) => /rf-plot-stage/.test(t.what || ''));
      rows.push({
        vp: vp.name, loc, form,
        knobPx: knobs.map((k) => `${k.w}x${k.h}`).join(' '),
        dotPx: dots.map((k) => `${k.w}`).join('/'),
        stagePx: stg ? `${stg.w}x${stg.h}` : '?',
        tapReachesGrid: tap ? `${tap.reachesGrid}/${tap.of}` : 'n/a',
        swallowedBy: tap ? tap.by : {},
        overflow: of.count, errs: errs.length,
        stem: info.stem,
      });
      if (form === 'gl-plot-points') {
        await page.screenshot({ path: path.join(OUT, `${vp.name}-${loc}.png`) });
      }
    }
    await ctx.close();
  }
}
await browser.close();
server.close(); await rm(dist, { recursive: true, force: true });
await writeFile(path.join(OUT, 'report.json'), JSON.stringify(rows, null, 1));
for (const r of rows) {
  console.log(`${(r.vp || '').padEnd(18)} ${r.loc}  ${(r.form || '').padEnd(16)} stage=${String(r.stagePx).padEnd(12)} hit=${(r.knobPx || r.err || '').padEnd(22)} dot=${String(r.dotPx).padEnd(10)} tap-reaches-grid=${String(r.tapReachesGrid).padEnd(8)} overflow=${r.overflow} err=${r.errs}`);
}
const swall = rows.find((r) => r.swallowedBy && Object.keys(r.swallowedBy).length);
if (swall) console.log('\ntaps swallowed by:', JSON.stringify(swall.swallowedBy));
console.log('\nshots ->', OUT);
