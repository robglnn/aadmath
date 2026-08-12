/**
 * Long-lived naive-player driver.
 * Keeps one real browser + one page alive, and executes command files dropped
 * into /tmp/np-cmd as async (page, ctx) => {...} modules, appending output to
 * /tmp/np-out/<name>.txt.  Real keyboard/mouse only — the commands decide.
 */
import { chromium } from 'playwright';
import { mkdir, readdir, rename, appendFile, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { pathToFileURL } from 'node:url';

const CMD = '/tmp/np-cmd', DONE = '/tmp/np-done', OUTD = '/tmp/np-out';
await mkdir(CMD, { recursive: true }); await mkdir(DONE, { recursive: true }); await mkdir(OUTD, { recursive: true });
const OUT = '/Users/harrison/dev/aadmath/shots/naive';
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERROR: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('CONSOLE.ERROR: ' + m.text()); });
page.on('crash', () => errors.push('PAGE CRASHED'));

const t0 = Date.now();
const helpers = {
  OUT, errors, t0,
  el: () => Math.round((Date.now() - t0) / 1000),
  async shot(name) {
    const tag = 't' + String(helpers.el()).padStart(4, '0') + '-' + name;
    await page.screenshot({ path: path.join(OUT, tag + '.png') });
    return path.join(OUT, tag + '.png');
  },
  async text() {
    return await page.evaluate(() => {
      const seen = [];
      const walk = (el) => {
        for (const c of el.children) {
          const cs = getComputedStyle(c);
          if (cs.display === 'none' || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05) continue;
          const r = c.getBoundingClientRect();
          if (r.width < 2 || r.height < 2) continue;
          const own = [...c.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
          if (own) seen.push(`(${Math.round(r.x)},${Math.round(r.y)}) [${c.tagName.toLowerCase()}.${String(c.className || '').slice(0, 30)}] ${own}`);
          walk(c);
        }
      };
      walk(document.body);
      return seen;
    });
  },
};

console.log('driver ready');
await writeFile('/tmp/np-ready', '1');

const loop = async () => {
  const files = (await readdir(CMD)).filter(f => f.endsWith('.mjs')).sort();
  for (const f of files) {
    const src = path.join(CMD, f);
    const log = [];
    const say = (...a) => log.push(a.map(x => typeof x === 'string' ? x : JSON.stringify(x)).join(' '));
    try {
      const mod = await import(pathToFileURL(src).href + '?t=' + Date.now());
      await mod.default(page, { ...helpers, say, ctx, browser });
    } catch (e) {
      say('DRIVER-ERROR: ' + (e && e.stack || e));
    }
    await writeFile(path.join(OUTD, f + '.txt'), log.join('\n') + '\n');
    await rename(src, path.join(DONE, Date.now() + '-' + f));
    await appendFile('/tmp/np-errors.log', errors.splice(0).join('\n') + (errors.length ? '\n' : ''));
  }
  setTimeout(loop, 300);
};
loop();
