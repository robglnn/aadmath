import { chromium } from 'playwright';
import { readFile, writeFile, mkdir } from 'node:fs/promises';
import path from 'node:path';

export const OUT = '/Users/harrison/dev/aadmath/shots/naive';
export const URL = 'http://127.0.0.1:4399/';
const ERRFILE = '/tmp/np-errors.log';

export async function connect() {
  const ws = (await readFile('/tmp/np-ws.txt', 'utf8')).trim();
  const browser = await chromium.connect(ws);
  await mkdir(OUT, { recursive: true });
  let ctx = browser.contexts()[0];
  let fresh = false;
  if (!ctx) {
    ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
    fresh = true;
  }
  let page = ctx.pages()[0];
  if (!page) { page = await ctx.newPage(); fresh = true; }
  if (!page.__wired) {
    page.__wired = true;
    const log = async (s) => { try { await writeFile(ERRFILE, s + '\n', { flag: 'a' }); } catch {} };
    page.on('pageerror', (e) => log('PAGEERROR: ' + e.message));
    page.on('console', (m) => { if (m.type() === 'error') log('CONSOLE.ERROR: ' + m.text()); });
  }
  return { browser, ctx, page, fresh };
}

export async function shot(page, name) {
  const p = path.join(OUT, name + '.png');
  await page.screenshot({ path: p });
  console.log('SHOT ' + p);
  return p;
}

export async function screenText(page) {
  return await page.evaluate(() => {
    const seen = [];
    const walk = (el) => {
      for (const c of el.children) {
        const cs = getComputedStyle(c);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
        const r = c.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        const own = [...c.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
        if (own) seen.push({ t: own, x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width), h: Math.round(r.height), tag: c.tagName.toLowerCase(), cls: c.className && String(c.className).slice(0, 40) });
        walk(c);
      }
    };
    walk(document.body);
    return seen;
  });
}

export async function dumpText(page, label) {
  const t = await screenText(page);
  console.log('--- SCREEN TEXT [' + label + '] ---');
  for (const s of t) console.log(`(${s.x},${s.y} ${s.w}x${s.h}) [${s.tag}.${s.cls}] ${s.t}`);
  console.log('--- end ---');
  return t;
}
