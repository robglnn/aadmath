import { chromium } from 'playwright';
import fs from 'node:fs';

const OUT = '/Users/harrison/dev/aadmath/shots/h6-play';
fs.mkdirSync(OUT, { recursive: true });
const LOG = '/tmp/h6-drive.log';
fs.writeFileSync(LOG, '');
const log = (s) => fs.appendFileSync(LOG, s + '\n');

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => {
  window.__h6 = { errs: [] };
  const ce = console.error.bind(console);
  console.error = (...a) => { try { window.__h6.errs.push('console.error: ' + a.map(x => (x && x.stack) || String(x)).join(' ')); } catch (e) {} ce(...a); };
  window.addEventListener('error', e => window.__h6.errs.push('onerror: ' + (e.message || '') + ' @ ' + (e.filename || '') + ':' + e.lineno));
  window.addEventListener('unhandledrejection', e => window.__h6.errs.push('unhandledrejection: ' + String(e.reason)));
});
const page = await ctx.newPage();
const errs = [];
page.on('console', m => { if (m.type() === 'error') errs.push('[console] ' + m.text()); });
page.on('pageerror', e => errs.push('[pageerror] ' + e.message));
await page.goto('http://127.0.0.1:4791/', { waitUntil: 'load' });
await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch (e) {} });
await page.reload({ waitUntil: 'load' });
await page.waitForTimeout(5000);
log('READY');

async function seen() {
  return await page.evaluate(() => {
    const out = [];
    const walk = (el, depth) => {
      if (depth > 40) return;
      const cs = getComputedStyle(el);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) return;
      const r = el.getBoundingClientRect();
      if (r.width === 0 || r.height === 0) return;
      if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return;
      let own = '';
      for (const n of el.childNodes) if (n.nodeType === 3) own += n.nodeValue;
      own = own.replace(/\s+/g, ' ').trim();
      const isKatex = el.closest && el.closest('.katex');
      if (own && !(isKatex && el.tagName !== 'ANNOTATION')) out.push({ t: own, x: Math.round(r.x), y: Math.round(r.y), cls: String(el.className || '').slice(0, 50), tag: el.tagName });
      if (isKatex && el.tagName === 'ANNOTATION') return;
      for (const c of el.children) walk(c, depth + 1);
    };
    walk(document.body, 0);
    return out;
  });
}

let seq = 0;
const seenFiles = new Set();
async function run(cmds) {
  for (const a of cmds) {
    const [op, arg, arg2, arg3] = a;
    try {
      if (op === 'hold') { await page.keyboard.down(arg); await page.waitForTimeout(arg2 || 500); await page.keyboard.up(arg); }
      else if (op === 'holdmany') { for (const k of arg) await page.keyboard.down(k); await page.waitForTimeout(arg2 || 500); for (const k of arg) await page.keyboard.up(k); }
      else if (op === 'key') { await page.keyboard.press(arg); }
      else if (op === 'type') { await page.keyboard.type(arg, { delay: 70 }); }
      else if (op === 'click') { await page.mouse.click(arg, arg2); }
      else if (op === 'move') { await page.mouse.move(arg, arg2, { steps: arg3 || 15 }); }
      else if (op === 'wheel') { await page.mouse.wheel(0, arg); }
      else if (op === 'wait') { await page.waitForTimeout(arg); }
      else if (op === 'shot') { const p = `${OUT}/${String(++seq).padStart(3, '0')}-${arg}.png`; await page.screenshot({ path: p }); log('SHOT ' + p); }
      else if (op === 'dump') { const s = await seen(); log('=== DUMP ' + (arg || '') + '\n' + s.map(o => `[y${o.y} x${o.x}] <${o.tag}.${o.cls}> ${o.t}`).join('\n')); }
      else if (op === 'errs') { const ie = await page.evaluate(() => window.__h6 ? window.__h6.errs : ['NO_HOOK']); log('ERRS page=' + JSON.stringify(errs) + ' inpage=' + JSON.stringify(ie)); }
      else if (op === 'eval') { log('EVAL ' + JSON.stringify(await page.evaluate(arg))); }
      else if (op === 'reload') { await page.reload({ waitUntil: 'load' }); await page.waitForTimeout(4000); }
    } catch (e) { log('!! ' + op + ' failed: ' + e.message); }
  }
  log('DONE');
}

// command loop
const CMD = '/tmp/h6-cmd';
let last = '';
setInterval(async () => {
  try {
    if (!fs.existsSync(CMD)) return;
    const raw = fs.readFileSync(CMD, 'utf8');
    if (!raw.trim() || raw === last) return;
    last = raw;
    const cmds = JSON.parse(raw);
    log('--- BATCH');
    await run(cmds);
  } catch (e) { log('!! loop ' + e.message); }
}, 400);
