/**
 * THE SESSION BREAK.
 *
 * "Progress must survive the break" is a product goal, and an objective that
 * has to be re-derived on a reload is the easiest place in a game to break it
 * silently — the card comes back saying something plausible and different, and
 * nobody notices until a learner does.
 *
 * So: play with real keys, read the objective, seal nothing, close the tab,
 * come back, and assert that the first frame after the reload is telling the
 * player exactly what the last frame before it was — including which nouns
 * have already been explained, which must never be explained twice.
 */
import { chromium } from 'playwright';

const URL = process.argv.includes('--url') ? process.argv[process.argv.indexOf('--url') + 1] : 'http://127.0.0.1:5173';
const W = 1600, H = 900;

const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--disable-gpu-vsync'] });
const c = await b.newContext({ viewport: { width: W, height: H } });
const p = await c.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
p.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });

await p.goto(URL, { waitUntil: 'domcontentloaded' });
await p.evaluate(() => localStorage.clear());
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await p.waitForTimeout(2500);
await p.mouse.click(W / 2, H / 2);

// a minute of real play: walk, look, pick things up
for (let i = 0; i < 12; i++) {
  await p.keyboard.down('KeyW');
  await p.mouse.move(W / 2 + (i % 3 - 1) * 180, H / 2);
  await p.waitForTimeout(1800);
  const open = await p.evaluate(() => !!document.querySelector('.rift.show'));
  if (open) { await p.click('.rift.show .rf-x'); await p.waitForTimeout(400); await p.mouse.click(W / 2, H / 2); }
}
await p.keyboard.up('KeyW');
await p.waitForTimeout(600);

const before = await p.evaluate(() => ({
  guide: window.__ascent.story.guide(),
  save: localStorage.getItem('ascent.story'),
}));

// the break
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await p.waitForTimeout(2500);
const after = await p.evaluate(() => window.__ascent.story.guide());

const same = (k) => before.guide?.[k] === after?.[k];
const taughtKept = (before.guide?.taught || []).every((x) => (after?.taught || []).includes(x));
console.log('before:', JSON.stringify(before.guide));
console.log('after :', JSON.stringify(after));
console.log('verb/skill/kind survive:', same('verb') && same('skill') && same('kind'));
console.log('held/open/locked survive:', same('held') && same('open') && same('locked'));
console.log('nouns already taught stay taught:', taughtKept, '·', (after?.taught || []).join(','));
console.log('console errors:', errs.length, errs.slice(0, 3));
await b.close();
