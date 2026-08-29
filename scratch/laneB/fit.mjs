import { chromium } from 'playwright';
import { build } from 'vite';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const LAB = '/Users/harrison/dev/aadmath/scratch/laneB/shotlab';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };
const dir = await mkdtemp(path.join(tmpdir(), 'fitlab-'));
await build({ root: LAB, base: './', logLevel: 'error', build: { target: 'es2022', outDir: dir, emptyOutDir: true, assetsInlineLimit: 0 } });
const port = 4650 + Math.floor(Math.random() * 200);
const server = createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  try { const b = await readFile(path.join(dir, rel)); res.writeHead(200, { 'content-type': MIME[path.extname(rel)] || 'application/octet-stream' }); res.end(b); } catch { res.writeHead(404); res.end('no'); }
});
await new Promise((r) => server.listen(port, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const CASES = [
  ['complete-the-square', 'cs-odd', 5], ['complete-the-square', 'cs-lead', 4],
  ['factor-trinomial-lead', 'fl-both', 5], ['factor-common', 'fc-three', 4],
  ['difference-of-squares', 'dq-gcf', 4], ['quadratic-formula', 'qf-surd', 5],
  ['quadratic-zero-product', 'zp-lead', 5], ['square-root-method', 'sq-surd', 5],
  ['factor-trinomial-monic', 'fm-gcf', 5],
];
for (const vp of [[1500, 950], [900, 620], [844, 390], [390, 844]]) {
  const page = await (await browser.newContext({ viewport: { width: vp[0], height: vp[1] } })).newPage();
  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
  await page.waitForFunction(() => !!window.__shot, null, { timeout: 30000 });
  let worst = null;
  for (const [skill, form, d] of CASES) {
    for (const seed of [5000, 12919]) {
      let r; try { r = await page.evaluate((o) => window.__shot.fill(o), { skill, form, d, seed }); } catch (e) { console.log('ERR', skill, form, e.message.slice(0, 60)); continue; }
      await page.waitForTimeout(60);
      if (r.clipped) console.log(`CLIP ${vp.join('x')} ${skill}/${form} len ${r.len} "${r.typed}" ${r.scroll}>${r.client} cls=${r.cls}`);
      if (!worst || r.len > worst.len) worst = r;
    }
  }
  console.log(`${vp.join('x')} — longest typed: ${worst.len} "${worst.typed}" clipped=${worst.clipped}`);
  await page.close();
}
await browser.close(); server.close(); await rm(dir, { recursive: true, force: true });
