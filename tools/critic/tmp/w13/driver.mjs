// Long-lived cold-play driver: watches a command file, executes real input, writes output.
import { chromium } from 'playwright';
import fs from 'fs';

const OUT = '/Users/harrison/dev/aadmath/shots/w13-cold';
const DIR = '/tmp/w13';
const LOG = `${DIR}/console.log`;
fs.mkdirSync(OUT, { recursive: true });
fs.mkdirSync(DIR, { recursive: true });

const denyLock = process.argv.includes('--deny-lock');

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--use-angle=metal'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US' });
const page = await ctx.newPage();
if (denyLock) {
  await page.addInitScript(() => {
    Element.prototype.requestPointerLock = function () {
      // browser denies the request: fire pointerlockerror like a real refusal
      setTimeout(() => document.dispatchEvent(new Event('pointerlockerror')), 0);
      return Promise.reject(new DOMException('denied', 'NotAllowedError'));
    };
  });
}
page.on('console', m => {
  if (m.type() === 'error' || m.type() === 'warning') fs.appendFileSync(LOG, `[${m.type()}] ${m.text()}\n`);
});
page.on('pageerror', e => fs.appendFileSync(LOG, `[pageerror] ${e.message}\n`));
page.on('requestfailed', r => fs.appendFileSync(LOG, `[reqfail] ${r.url()} ${r.failure()?.errorText}\n`));

const dumpText = () => page.evaluate(() => {
  const vis = [];
  const walk = (el) => {
    for (const c of el.children) {
      const cs = getComputedStyle(c);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) continue;
      const r = c.getBoundingClientRect();
      if (r.width < 1 || r.height < 1) continue;
      let own = [...c.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).filter(Boolean).join(' ');
      if (c.tagName === 'INPUT') own = `[input value="${c.value}" ph="${c.placeholder || ''}"]`;
      const cls = (c.className && c.className.baseVal !== undefined ? c.className.baseVal : c.className || '').toString().split(' ').filter(Boolean).slice(0, 3).join('.');
      if (own) vis.push(`y${Math.round(r.y)} x${Math.round(r.x)} w${Math.round(r.width)} <${c.tagName.toLowerCase()}.${cls}> ${own}`);
      walk(c);
    }
  };
  walk(document.body);
  return vis.join('\n');
});

async function run(steps) {
  const out = [];
  for (const s of steps) {
    const t = s[0];
    try {
      if (t === 'goto') await page.goto(s[1], { waitUntil: 'load' });
      else if (t === 'clearstorage') await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); });
      else if (t === 'reload') await page.reload({ waitUntil: 'load' });
      else if (t === 'wait') await page.waitForTimeout(s[1]);
      else if (t === 'key') await page.keyboard.press(s[1]);
      else if (t === 'keys') { for (const k of s[1]) { await page.keyboard.press(k); await page.waitForTimeout(s[2] ?? 200); } }
      else if (t === 'type') await page.keyboard.type(s[1], { delay: s[2] ?? 70 });
      else if (t === 'hold') { await page.keyboard.down(s[1]); await page.waitForTimeout(s[2]); await page.keyboard.up(s[1]); }
      else if (t === 'hold2') { await page.keyboard.down(s[1]); await page.keyboard.down(s[2]); await page.waitForTimeout(s[3]); await page.keyboard.up(s[2]); await page.keyboard.up(s[1]); }
      else if (t === 'down') await page.keyboard.down(s[1]);
      else if (t === 'up') await page.keyboard.up(s[1]);
      else if (t === 'move') await page.mouse.move(s[1], s[2], { steps: s[3] ?? 10 });
      else if (t === 'look') { // relative mouse look, like a real player dragging the view
        let x = 640, y = 400;
        const dx = s[1], dy = s[2], n = s[3] ?? 20;
        for (let i = 0; i < n; i++) { x += dx / n; y += dy / n; await page.mouse.move(x, y); await page.waitForTimeout(8); }
      }
      else if (t === 'click') await page.mouse.click(s[1], s[2]);
      else if (t === 'clicksel') await page.click(s[1], { timeout: 4000 });
      else if (t === 'mdown') await page.mouse.down();
      else if (t === 'mup') await page.mouse.up();
      else if (t === 'wheel') await page.mouse.wheel(s[1], s[2]);
      else if (t === 'seek') { // navigate to objective using ONLY the on-screen compass, like a player
        const limitMs = s[1] ?? 90000, stopAt = s[2] ?? 6;
        const t0 = Date.now(); let last = null; const trail = [];
        while (Date.now() - t0 < limitMs) {
          const st = await page.evaluate(() => ({ d: document.querySelector('.gd-dist')?.textContent, dir: document.querySelector('.gd-dir')?.textContent, rift: !!document.querySelector('.rift, .rift-card, .r-card') }));
          if (!st.d) break;
          const m = parseFloat(st.d); trail.push(`${m}|${st.dir}`);
          if (m <= stopAt) break;
          const dir = (st.dir || '').toLowerCase();
          if (dir.includes('right')) { await page.keyboard.down('ArrowRight'); await page.waitForTimeout(220); await page.keyboard.up('ArrowRight'); }
          else if (dir.includes('left')) { await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(220); await page.keyboard.up('ArrowLeft'); }
          else if (dir.includes('behind')) { await page.keyboard.down('ArrowRight'); await page.waitForTimeout(700); await page.keyboard.up('ArrowRight'); }
          else { await page.keyboard.down('KeyW'); await page.waitForTimeout(900); if (Math.random() < 0.4) await page.keyboard.press('Space'); await page.keyboard.up('KeyW'); }
        }
        out.push('SEEK ' + trail.slice(-14).join('  '));
      }
      else if (t === 'shot') { await page.screenshot({ path: `${OUT}/${s[1]}.png` }); out.push('SHOT ' + s[1]); }
      else if (t === 'text') out.push('--- TEXT ---\n' + (await dumpText()) + '\n--- /TEXT ---');
      else if (t === 'html') { const d = await page.evaluate(sel => { const e = document.querySelector(sel); return e ? e.outerHTML.slice(0, 8000) : 'NULL'; }, s[1]); out.push('HTML ' + s[1] + '\n' + d); }
      else if (t === 'eval') out.push('EVAL ' + JSON.stringify(await page.evaluate(s[1])));
      else if (t === 'lock') out.push('POINTERLOCK ' + await page.evaluate(() => !!document.pointerLockElement));
      out.push('ok ' + JSON.stringify(s).slice(0, 140));
    } catch (e) { out.push('ERR ' + JSON.stringify(s).slice(0, 140) + ' :: ' + e.message.split('\n')[0]); }
  }
  return out.join('\n');
}

fs.writeFileSync(`${DIR}/ready`, 'yes');
let last = '';
setInterval(async () => {
  let cmd;
  try { cmd = fs.readFileSync(`${DIR}/cmd.json`, 'utf8'); } catch { return; }
  if (cmd === last || !cmd.trim()) return;
  last = cmd;
  let res;
  try { res = await run(JSON.parse(cmd)); } catch (e) { res = 'PARSE/RUN ERR ' + e.message; }
  fs.writeFileSync(`${DIR}/out.txt`, res);
  fs.writeFileSync(`${DIR}/done`, String(Date.now()));
}, 300);
