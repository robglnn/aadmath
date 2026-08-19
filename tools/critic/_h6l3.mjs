/**
 * Blind audit driver — plays the NEWEST unit (algebra1-l3) in the real game.
 * Puts every declared item form of every L3 node on the real learning surface,
 * screenshots it, and dumps prompt text + options + the answer the bank claims,
 * so a human can check whether the thing on screen is what the cited standard
 * actually says.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/h6-l3'));
const SEL = arg('sel', '?unit=algebra1-l3');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(URL + SEL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(3000);

const content = await page.evaluate(() => window.__ascent.content());
console.log('CONTENT', JSON.stringify(content));

const forms = await page.evaluate(() => {
  const a = window.__ascent;
  const out = {};
  for (const s of a.content().nodes) out[s] = (a.formsBySkill[s] || []).map((f) => (typeof f === 'string' ? f : f.id));
  return out;
});
console.log('FORMS', JSON.stringify(forms, null, 1));

const rows = [];
let n = 0;
for (const skill of Object.keys(forms)) {
  for (const form of forms[skill]) {
    for (const d of [2, 5]) {
      n += 1;
      const info = await page.evaluate(async ([skill, form, d, seed]) => {
        const a = window.__ascent;
        try { a.panel.hide?.(); } catch {}
        let r;
        try { r = a.showItem(skill, { difficulty: d, form, seed }); } catch (e) { return { err: String(e && e.message || e) }; }
        await new Promise((res) => setTimeout(res, 350));
        const el = document.querySelector('#rift') || document.querySelector('.rift') || document.getElementById('ui');
        const txt = el ? el.innerText : '';
        const opts = [...document.querySelectorAll('#rift button, .rift button, .rift .choice, .choice')].map((b) => b.innerText.trim()).filter(Boolean);
        const pi = a.panelInfo();
        return { r, txt, opts, pi };
      }, [skill, form, d, 1234 + n]);
      const tag = `${String(n).padStart(2, '0')}-${skill}-${form}-d${d}`;
      await page.screenshot({ path: path.join(OUT, tag + '.png') });
      rows.push({ tag, skill, form, d, ...info });
      console.log('----', tag);
      if (info.err) { console.log('   ERROR', info.err); continue; }
      console.log('   rep=', info.r?.rep, ' answer=', JSON.stringify(info.r?.answer));
      console.log('   TEXT:', (info.txt || '').replace(/\n/g, ' | ').slice(0, 400));
      if (info.opts?.length) console.log('   OPTS:', JSON.stringify(info.opts));
    }
  }
}

await writeFile(path.join(OUT, 'items.json'), JSON.stringify(rows, null, 1));
console.log('ERRORS', errors.length, errors.slice(0, 8).join(' | '));
await browser.close();
