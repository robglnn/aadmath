import { chromium } from 'playwright';
import { build } from 'vite';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const LAB = '/Users/harrison/dev/aadmath/scratch/laneB/shotlab';
const OUT = '/Users/harrison/dev/aadmath/shots/laneB';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };
const dir = await mkdtemp(path.join(tmpdir(), 'shotlab-'));
await mkdir(OUT, { recursive: true });
await build({ root: LAB, base: './', logLevel: 'error', build: { target: 'es2022', outDir: dir, emptyOutDir: true, assetsInlineLimit: 0 } });
const port = 4610 + Math.floor(Math.random() * 200);
const server = createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  try { const b = await readFile(path.join(dir, rel)); res.writeHead(200, { 'content-type': MIME[path.extname(rel)] || 'application/octet-stream' }); res.end(b); }
  catch { res.writeHead(404); res.end('no'); }
});
await new Promise((r) => server.listen(port, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1500, height: 950 }, deviceScaleFactor: 2 })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__shot, null, { timeout: 30000 });
const CASES = [
  { name: 'factor-monic', skill: 'factor-trinomial-monic', form: 'fm-plus', d: 2, type: '(x+2)(x+3)' },
  { name: 'complete-square', skill: 'complete-the-square', form: 'cs-monic', d: 2, type: '' },
  { name: 'surd-roots', skill: 'square-root-method', form: 'sq-surd', d: 4, type: '' },
  { name: 'radical-simplify', skill: 'radical-simplify', form: 'rs-root', d: 3, type: '' },
  { name: 'zero-product', skill: 'quadratic-zero-product', form: 'zp-roots', d: 3, type: '' },
  { name: 'value-pad', skill: 'eval-expr', form: 'ee-linear', d: 2, type: '' },
  { name: 'factor-monic-pl', skill: 'factor-trinomial-monic', form: 'fm-plus', d: 2, locale: 'pl', type: '' },
  { name: 'surd-roots-es', skill: 'square-root-method', form: 'sq-surd', d: 4, locale: 'es', type: '' },
];
for (const c of CASES) {
  const info = await page.evaluate((o) => window.__shot.show(o), c);
  await page.waitForTimeout(450);
  await page.screenshot({ path: path.join(OUT, `${c.name}.png`) });
  console.log(c.name.padEnd(18), '| ans', JSON.stringify(info.answer), '| keys', info.keys.join(''), '| help:', (info.help || '').slice(0, 90));
  const m = await page.evaluate(() => window.__shot.miss(1));
  await page.waitForTimeout(650);
  await page.screenshot({ path: path.join(OUT, `${c.name}-miss.png`) });
  console.log('   after a miss: socket =', JSON.stringify(m.socket), '| nudge:', (m.nudge || '').slice(0, 110));
}
console.log('errors', errs.length, errs.slice(0, 4));
await browser.close(); server.close(); await rm(dir, { recursive: true, force: true });
