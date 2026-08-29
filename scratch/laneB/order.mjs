/** Real presses: the brackets the other way round must seal; the question must not. */
import { chromium } from 'playwright';
import { build } from 'vite';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
const LAB = '/Users/harrison/dev/aadmath/scratch/laneB/shotlab';
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf' };
const dir = await mkdtemp(path.join(tmpdir(), 'orderlab-'));
await build({ root: LAB, base: './', logLevel: 'error', build: { target: 'es2022', outDir: dir, emptyOutDir: true, assetsInlineLimit: 0 } });
const port = 4680 + Math.floor(Math.random() * 200);
const server = createServer(async (req, res) => {
  const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
  try { const b = await readFile(path.join(dir, rel)); res.writeHead(200, { 'content-type': MIME[path.extname(rel)] || 'application/octet-stream' }); res.end(b); } catch { res.writeHead(404); res.end('no'); }
});
await new Promise((r) => server.listen(port, '127.0.0.1', r));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1400, height: 900 } })).newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message)); page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__shot, null, { timeout: 30000 });

const run = async (o, typed) => page.evaluate(({ o, typed }) => {
  const info = window.__shot.show(o);
  const press = (g) => { const b = document.querySelector(`.rf-keys .rf-key[data-g="${g.replace(/["\\]/g, '\\$&')}"]`); if (!b) return false; b.dispatchEvent(new MouseEvent('click', { bubbles: true })); return true; };
  let missing = '';
  for (const ch of typed) if (!press(ch)) missing += ch;
  const commit = document.querySelector('.rf-key.commit');
  const dead = commit.disabled;
  if (!dead) commit.dispatchEvent(new MouseEvent('click', { bubbles: true }));
  return { answer: info.answer, latex: info.latex, missing, dead, sealed: document.querySelector('.rift').classList.contains('sealing') };
}, { o, typed });

const CASES = [
  ['brackets the other way round', { skill: 'factor-trinomial-monic', form: 'fm-plus', d: 2, seed: 5000 }, null, true],
  ['the question, typed back',     { skill: 'factor-trinomial-monic', form: 'fm-plus', d: 2, seed: 5000 }, 'PROMPT', false],
  ['the key itself',               { skill: 'factor-trinomial-monic', form: 'fm-plus', d: 2, seed: 5000 }, 'KEY', true],
  ['roots in the other order',     { skill: 'quadratic-zero-product', form: 'zp-roots', d: 3, seed: 5000 }, 'SWAP', true],
  ['an unsimplified root',         { skill: 'radical-simplify', form: 'rs-root', d: 3, seed: 5000 }, 'UNSIMPLIFIED', false],
];
const toPad = (s) => {
  let t = String(s).replace(/\\left|\\right|\\!|\\,|\;|\\ /g, '').replace(/\\pm/g, '\u00b1');
  for (let i = 0; i < 12; i++) {
    const b = t;
    t = t.replace(/\^\s*\{([^{}]*)\}/g, '^$1')
      .replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (m, a, c) => `${a}/${c}`)
      .replace(/\\sqrt\s*\{([^{}]*)\}/g, (m, a) => '\u221a' + a);
    if (t === b) break;
  }
  return t.replace(/\s+/g, '');
};
let bad = 0;
for (const [name, o, mode, wantSeal] of CASES) {
  const probe = await page.evaluate((x) => window.__shot.show(x), o);
  let typed;
  if (mode === null) {
    const m = /^\\left\((.+?)\\right\)\\left\((.+?)\\right\)$/.exec(probe.answer);
    typed = m ? `(${m[2].replace(/\s+/g, '')})(${m[1].replace(/\s+/g, '')})` : toPad(probe.answer);
  } else if (mode === 'PROMPT') typed = toPad(probe.latex);
  else if (mode === 'KEY') typed = toPad(probe.answer);
  else if (mode === 'SWAP') { const ps = String(probe.answer).split(',').map((x) => x.trim()); typed = toPad(`${ps[1]}, ${ps[0]}`); }
  else if (mode === 'UNSIMPLIFIED') typed = toPad(probe.latex);
  const r = await run(o, typed);
  const ok = r.sealed === wantSeal;
  if (!ok) bad++;
  console.log(`${ok ? ' ok ' : 'FAIL'}  ${name.padEnd(30)} key ${JSON.stringify(r.answer).padEnd(40)} typed "${typed}" -> ${r.sealed ? 'SEALED' : (r.dead ? 'SEAL dead' : 'refused')}${r.missing ? ' | no cap for: ' + r.missing : ''}`);
}
console.log(bad ? `${bad} FAILURES` : 'all real-press cases behave');
console.log('console errors', errs.length, errs.slice(0, 3));
await browser.close(); server.close(); await rm(dir, { recursive: true, force: true });
