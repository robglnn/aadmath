/** Play the NEW unit (algebra1-l2) in the real running game. */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const URL = 'http://127.0.0.1:4787/?unit=algebra1-l2';
const OUT = path.resolve('shots/science-l2');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
await page.waitForTimeout(3000);

const content = await page.evaluate(() => window.__ascent.content());
console.log('CONTENT:', JSON.stringify(content));

const skills = process.argv.slice(2).length ? process.argv.slice(2) : content.nodes;

for (const skill of skills) {
  // list forms
  const forms = await page.evaluate((s) => (window.__ascent.formsBySkill?.[s] || []), skill);
  console.log(`\n=== ${skill}  forms=${JSON.stringify(forms)}`);
  for (const form of forms.map(f=>f.id).slice(0, 4)) {
    const info = await page.evaluate(async ({ s, f }) => {
      try {
        const r = window.__ascent.showItem(s, { difficulty: 4, form: f, seed: 12345 });
        const p = window.__ascent.panel;
        const txt = (sel) => document.querySelector(sel)?.textContent?.trim() || '';
        return {
          ok: true, form: r.form, rep: r.rep, answer: String(r.answer),
          prompt: txt('#rf-prompt') || txt('.rf-prompt'),
          stem: txt('#rf-stem') || txt('.rf-stem'),
          body: document.querySelector('#rift')?.innerText?.slice(0, 700) || '',
        };
      } catch (e) { return { ok: false, err: e.message }; }
    }, { s: skill, f: form });
    if (!info.ok) { console.log(`  ${form}: GENERATE FAILED ${info.err}`); continue; }
    console.log(`  --- form=${info.form} rep=${info.rep} answer=${info.answer}`);
    console.log(info.body.replace(/\n+/g, ' | ').slice(0, 500));
    await page.screenshot({ path: path.join(OUT, `${skill}__${form}.png`) });

    // now slip on purpose and read the echo
    const slip = await page.evaluate(() => {
      const a = window.__ascent;
      const it = a.panel.item;
      const wrong = String(Number(it.answer) + 3);
      const res = a.enter(wrong);
      return res ? { entry: res.entry, answer: String(res.answer), mis: res.misconception, recog: res.recognisable } : null;
    });
    if (slip) console.log(`  slip: typed ${slip.entry} (answer ${slip.answer}) -> misconception=${slip.mis} recognisable=${slip.recog}`);
    await page.waitForTimeout(700);
    // open the echo
    await page.evaluate(() => { document.querySelector('#rf-echo-btn, .rf-echo-btn, [id*="echo"]')?.click(); });
    await page.waitForTimeout(900);
    const echo = await page.evaluate(() => document.querySelector('#rf-echo, .rf-echo, .echo')?.innerText?.slice(0, 900) || 'NO ECHO PANEL');
    console.log('  ECHO:', echo.replace(/\n+/g, ' | ').slice(0, 700));
    await page.screenshot({ path: path.join(OUT, `${skill}__${form}__echo.png`) });
    await page.evaluate(() => window.__ascent.panel.hide?.());
    await page.waitForTimeout(300);
  }
}

console.log('\nERRORS:', errors.length, JSON.stringify(errors.slice(0, 10), null, 1));
await browser.close();
