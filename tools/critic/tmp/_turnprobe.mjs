import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4831');
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const ctx = await b.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent);
await p.evaluate(() => { window.__ascent.session.reset(); window.__ascent.story.reset(); localStorage.removeItem('ascent.save'); });
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent);
await p.waitForTimeout(2000);
await p.evaluate(() => { window.__ascent.session.plan(); });
await p.waitForFunction(() => window.__ascent.session.state().phase === 'charter', null, { timeout: 60000 });
await p.waitForTimeout(1200);
await p.locator('.sc-go').click();
await p.waitForTimeout(800);
await p.evaluate(() => { const s = window.__ascent.story; for (let i = 0; i < 40 && s.state().toNext > 3; i++) s.grant(1); });
const dump = async (label) => {
  const r = await p.evaluate(() => {
    const el = document.querySelector('.meta-turn');
    const cs = getComputedStyle(el);
    const kick = el.querySelector('.tn-kick'), seals = el.querySelector('.tn-seals');
    const box = (e) => { const q = e.getBoundingClientRect(); return [Math.round(q.left), Math.round(q.top), Math.round(q.right), Math.round(q.bottom)]; };
    const ink = (e) => { const r = document.createRange(); r.selectNodeContents(e); return [...r.getClientRects()].map((q) => [Math.round(q.left), Math.round(q.top), Math.round(q.right), Math.round(q.bottom)]); };
    return {
      cls: el.className, op: cs.opacity, vis: cs.visibility, z: cs.zIndex,
      turnBox: box(el), kickBox: box(kick), kickInk: ink(kick), sealsBox: box(seals), sealsInk: ink(seals),
      kickOp: getComputedStyle(kick).opacity, sealsOp: getComputedStyle(seals).opacity,
      txt: kick.textContent + ' | ' + seals.textContent,
      rite: document.querySelector('.meta-rite').className,
    };
  });
  console.log(label, JSON.stringify(r));
};
for (const t of [400, 800, 1200, 1600, 2400, 3600]) { await p.waitForTimeout(t === 400 ? 400 : 600); await dump('t+' + t); }
await p.screenshot({ path: 'shots/turnprobe.png' });
await b.close();
