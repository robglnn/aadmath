/** Which (skill, form, difficulty) actually mounts which answer surface. */
import { chromium } from 'playwright';

const URL = process.argv[2] || 'http://127.0.0.1:4321';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
page.on('pageerror', (e) => console.log('  ! ' + e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(2000);

const forms = await page.evaluate(() => window.__ascent.formsBySkill);
const want = ['like-terms', 'two-step', 'distribute', 'one-step-add', 'multi-step', 'both-sides'];
for (const skill of want) {
  for (const f of forms[skill] || []) {
    const id = typeof f === 'string' ? f : f.id;
    for (const d of [1, 3, 5]) {
      const mode = await page.evaluate(async ({ skill: s, form, difficulty }) => {
        try {
          window.__ascent.panel.close();
          window.__ascent.showItem(s, { form, difficulty, seed: 4242 });
          await new Promise((r) => setTimeout(r, 30));
          return window.__ascent.panel.mode;
        } catch (e) { return 'ERR:' + e.message.slice(0, 30); }
      }, { skill, form: id, difficulty: d });
      console.log(`${skill.padEnd(12)} ${String(id).padEnd(14)} d=${d}  ${mode}`);
    }
  }
}
await browser.close();
