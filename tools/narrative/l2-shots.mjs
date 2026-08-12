/**
 * The second unit, on the real learning surface.
 *
 * A pack that generates and verifies can still look wrong: an array table that
 * overflows the panel, a fraction that collides with the keypad. So one item of
 * every form in the new unit is put on the *shipping* rift panel, in all three
 * locales, and photographed.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/narr-l2'));
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
await page.goto(URL + '/?unit=algebra1-l2', { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(3500);

const forms = await page.evaluate(() => {
  const a = window.__ascent;
  return a.content().nodes.flatMap((s) => a.formsBySkill[s].map((f) => ({ skill: s, form: f.id, rep: f.rep })));
});
for (const loc of ['en', 'es', 'pl']) {
  await page.evaluate((l) => window.__ascent.setLocale(l), loc);
  await page.waitForTimeout(500);
  for (const f of forms) {
    const info = await page.evaluate(({ skill, form }) => {
      window.__ascent.panel?.hide?.();
      return window.__ascent.showItem(skill, { form, difficulty: 4, seed: 20260812 });
    }, f);
    await page.waitForTimeout(600);
    const over = await page.evaluate(() => {
      const el = document.querySelector('.rift-card') || document.querySelector('.rift');
      return el ? { w: el.scrollWidth > el.clientWidth + 2, h: el.scrollHeight > el.clientHeight + 2 } : null;
    });
    console.log(`${loc}  ${f.skill.padEnd(20)} ${f.form.padEnd(14)} ${f.rep.padEnd(9)} ans=${String(info.answer).padEnd(6)} overflow=${JSON.stringify(over)}`);
    await page.screenshot({ path: path.join(OUT, `${loc}-${f.skill}-${f.form}.png`) });
  }
}
console.log(errors.length ? 'CONSOLE ERRORS: ' + errors.slice(0, 3).join(' | ') : 'no console errors');
await browser.close();
process.exit(errors.length ? 1 : 0);
