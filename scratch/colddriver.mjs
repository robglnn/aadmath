// Cold-play driver: keeps one real browser alive, executes commands from a queue file.
// Real keyboard/mouse only. No window.__ascent until the very end.
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';

const DIR = '/tmp/cold';
fs.mkdirSync(DIR, { recursive: true });
fs.mkdirSync('/Users/harrison/dev/aadmath/shots/cold', { recursive: true });
const URL = process.env.URL || 'http://127.0.0.1:4477/';
const errors = [];
const logf = path.join(DIR, 'console.log');
fs.writeFileSync(logf, '');

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-webgl', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1, locale: 'en-US' });
const page = await ctx.newPage();
page.on('console', m => {
  const t = m.type();
  const line = `[${new Date().toISOString()}] ${t}: ${m.text()}`;
  fs.appendFileSync(logf, line + '\n');
  if (t === 'error') errors.push(line);
});
page.on('pageerror', e => {
  const line = `[${new Date().toISOString()}] pageerror: ${e.message}`;
  fs.appendFileSync(logf, line + '\n');
  errors.push(line);
});
await page.goto(URL, { waitUntil: 'load' });
const t0 = Date.now();
fs.writeFileSync(path.join(DIR, 'ready'), String(t0));

async function visible() {
  return await page.evaluate(() => {
    const out = [];
    const seen = new Set();
    function walk(node) {
      for (const el of node.children) {
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || cs.opacity === '0') continue;
        const r = el.getBoundingClientRect();
        if (r.width < 1 || r.height < 1) { walk(el); continue; }
        const own = Array.from(el.childNodes).filter(n => n.nodeType === 3).map(n => n.textContent.trim()).join(' ').trim();
        if (own) {
          const key = own + '@' + Math.round(r.x) + ',' + Math.round(r.y);
          if (!seen.has(key)) { seen.add(key); out.push({ t: own, x: Math.round(r.x + r.width / 2), y: Math.round(r.y + r.height / 2), tag: el.tagName.toLowerCase(), cls: (el.className && el.className.baseVal !== undefined ? el.className.baseVal : el.className || '').toString().slice(0, 60) }); }
        }
        walk(el);
      }
    }
    walk(document.body);
    return out;
  });
}

async function run(cmd) {
  const a = cmd;
  switch (a.op) {
    case 'shot': {
      const p = `/Users/harrison/dev/aadmath/shots/cold/${a.name}.png`;
      await page.screenshot({ path: p });
      return { shot: p, elapsed: ((Date.now() - t0) / 1000).toFixed(1) };
    }
    case 'text': return { elapsed: ((Date.now() - t0) / 1000).toFixed(1), items: await visible() };
    case 'key': {
      for (let i = 0; i < (a.n || 1); i++) { await page.keyboard.press(a.k); await page.waitForTimeout(a.gap || 120); }
      return { ok: true };
    }
    case 'hold': { await page.keyboard.down(a.k); await page.waitForTimeout(a.ms || 500); await page.keyboard.up(a.k); return { ok: true }; }
    case 'click': { await page.mouse.click(a.x, a.y); await page.waitForTimeout(a.wait || 300); return { ok: true }; }
    case 'move': { await page.mouse.move(a.x, a.y, { steps: a.steps || 10 }); return { ok: true }; }
    case 'dblclick': { await page.mouse.dblclick(a.x, a.y); return { ok: true }; }
    case 'down': { await page.mouse.down(); return { ok: true }; }
    case 'up': { await page.mouse.up(); return { ok: true }; }
    case 'type': { await page.keyboard.type(a.s, { delay: 60 }); return { ok: true }; }
    case 'wait': { await page.waitForTimeout(a.ms || 1000); return { ok: true }; }
    case 'errors': return { errors, count: errors.length };
    case 'eval': return { v: await page.evaluate(a.js) };
    case 'quit': { await browser.close(); process.exit(0); }
  }
  return { err: 'unknown op' };
}

let last = 0;
setInterval(async () => {
  const f = path.join(DIR, 'cmd.json');
  if (!fs.existsSync(f)) return;
  const st = fs.statSync(f).mtimeMs;
  if (st === last) return;
  last = st;
  let batch;
  try { batch = JSON.parse(fs.readFileSync(f, 'utf8')); } catch { return; }
  const res = [];
  for (const c of batch) {
    try { res.push(await run(c)); } catch (e) { res.push({ err: String(e) }); }
  }
  fs.writeFileSync(path.join(DIR, 'out.json'), JSON.stringify(res, null, 1));
}, 250);
