// w13 cold-play driver. Connects to persistent browser, runs a script of real input actions.
// usage: node act.mjs '<json array of steps>'
import { chromium } from 'playwright';
import fs from 'fs';
const WS = 'ws://localhost:9987/w13';
const OUT = '/Users/harrison/dev/aadmath/shots/w13-cold';
const LOG = '/tmp/w13/console.log';

const browser = await chromium.connect(WS);
let ctx = browser.contexts()[0];
let page = ctx && ctx.pages()[0];

const steps = JSON.parse(process.argv[2]);

if (!page) {
  ctx = await browser.newContext({ viewport: { width: 1280, height: 800 }, locale: 'en-US', deviceScaleFactor: 1 });
  page = await ctx.newPage();
  page.on('console', m => {
    if (m.type() === 'error' || m.type() === 'warning')
      fs.appendFileSync(LOG, `[${m.type()}] ${m.text()}\n`);
  });
  page.on('pageerror', e => fs.appendFileSync(LOG, `[pageerror] ${e.message}\n`));
  page.on('requestfailed', r => fs.appendFileSync(LOG, `[reqfail] ${r.url()} ${r.failure()?.errorText}\n`));
}

const say = (...a) => console.log(...a);

for (const s of steps) {
  const t = s[0];
  try {
    if (t === 'goto') { await page.goto(s[1], { waitUntil: 'load' }); }
    else if (t === 'clearstorage') { await page.evaluate(() => { localStorage.clear(); sessionStorage.clear(); }); }
    else if (t === 'reload') { await page.reload({ waitUntil: 'load' }); }
    else if (t === 'wait') { await page.waitForTimeout(s[1]); }
    else if (t === 'key') { await page.keyboard.press(s[1]); }
    else if (t === 'down') { await page.keyboard.down(s[1]); }
    else if (t === 'up') { await page.keyboard.up(s[1]); }
    else if (t === 'type') { await page.keyboard.type(s[1], { delay: s[2] ?? 60 }); }
    else if (t === 'hold') { await page.keyboard.down(s[1]); await page.waitForTimeout(s[2]); await page.keyboard.up(s[1]); }
    else if (t === 'move') { await page.mouse.move(s[1], s[2], { steps: s[3] ?? 12 }); }
    else if (t === 'click') { await page.mouse.click(s[1], s[2]); }
    else if (t === 'clicksel') { await page.click(s[1], { timeout: 4000 }); }
    else if (t === 'mdown') { await page.mouse.down(); }
    else if (t === 'mup') { await page.mouse.up(); }
    else if (t === 'wheel') { await page.mouse.wheel(s[1], s[2]); }
    else if (t === 'shot') {
      await page.screenshot({ path: `${OUT}/${s[1]}.png` });
      say('SHOT', s[1]);
    }
    else if (t === 'text') {
      const txt = await page.evaluate(() => {
        const vis = [];
        const walk = (el) => {
          for (const c of el.children) {
            const cs = getComputedStyle(c);
            if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.05) continue;
            const r = c.getBoundingClientRect();
            if (r.width < 1 || r.height < 1) continue;
            const own = [...c.childNodes].filter(n => n.nodeType === 3).map(n => n.textContent.trim()).filter(Boolean).join(' ');
            if (own) vis.push(`${Math.round(r.y)}|${Math.round(r.x)}|${c.tagName.toLowerCase()}.${(c.className && c.className.baseVal !== undefined ? c.className.baseVal : c.className || '').toString().split(' ').filter(Boolean).slice(0,3).join('.')}| ${own}`);
            walk(c);
          }
        };
        walk(document.body);
        return vis.join('\n');
      });
      say('--- TEXT ---\n' + txt + '\n--- END ---');
    }
    else if (t === 'dom') {
      const d = await page.evaluate((sel) => {
        const el = document.querySelector(sel);
        return el ? el.outerHTML.slice(0, 6000) : 'NULL';
      }, s[1]);
      say('DOM', s[1], '\n', d);
    }
    else if (t === 'eval') { say('EVAL', JSON.stringify(await page.evaluate(s[1]))); }
    else if (t === 'pointerlock') {
      say('POINTERLOCK', await page.evaluate(() => !!document.pointerLockElement));
    }
    say('ok', JSON.stringify(s).slice(0, 120));
  } catch (e) {
    say('ERR', JSON.stringify(s).slice(0, 120), e.message.split('\n')[0]);
  }
}
process.exit(0);
