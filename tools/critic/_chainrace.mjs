/** Does the 460ms chain actually fire, and can it paint under the close card? */
import { chromium } from 'playwright';
const URL = 'http://127.0.0.1:4791';
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
p.on('pageerror', (e) => console.log('ERR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent);
await p.evaluate(() => { window.__ascent.session.reset(); localStorage.removeItem('ascent.save'); });
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent);
await p.waitForFunction(() => window.__ascent.session.state().phase === 'charter', null, { timeout: 60000 });
const seam = await p.evaluate(() => window.__ascent.session.state().run.seams[0].id);
await p.locator('.sc-go').click();
await p.waitForTimeout(400);

// stand AT the rift so main.js's nearRift === the rift we sealed
await p.evaluate((id) => window.__ascent.teleportTo(id), seam);
await p.waitForTimeout(600);
await p.evaluate((id) => window.__ascent.openRiftById(id), seam);
await p.waitForTimeout(600);
console.log('panel open:', await p.evaluate(() => window.__ascent.panel.open));

// A: normal seal — does the chain re-open the rift on its own?
await p.evaluate(() => window.__ascent.panel.demo('right'));
const trace = [];
for (let i = 0; i < 22; i++) {
  await p.waitForTimeout(200);
  trace.push(await p.evaluate(() => (window.__ascent.panel.open ? 'OPEN' : '.')));
}
console.log('A chain trace (200ms/step, from seal):', trace.join(''));
console.log('A chain re-opened by itself:', trace.slice(12).includes('OPEN'));

// B: now the race. Set the run one tear from its goal, then seal while standing here.
await p.evaluate(() => { if (window.__ascent.panel.open) window.__ascent.panel.close(); });
await p.waitForTimeout(600);
await p.evaluate((id) => window.__ascent.openRiftById(id), seam);
// the real ceiling: the clock runs out while the card is up, so the close
// lands on the frame after the panel shuts — the exact race.
await p.evaluate(() => window.__ascent.session.chargeTo(25.1));
await p.waitForTimeout(700);
console.log('B panel open before final seal:', await p.evaluate(() => window.__ascent.panel.open));
await p.evaluate(() => window.__ascent.panel.demo('right'));
const trace2 = [];
for (let i = 0; i < 30; i++) {
  await p.waitForTimeout(200);
  trace2.push(await p.evaluate(() => {
    const rift = document.querySelector('.rift');
    const cs = getComputedStyle(rift);
    const painted = cs.visibility !== 'hidden' && +cs.opacity > 0.01;
    const close = document.querySelector('.ses-close')?.classList.contains('show');
    return (close ? 'C' : '-') + (window.__ascent.panel.open ? 'P' : '.') + (painted ? 'v' : '.');
  }));
  if (i === 16) await p.screenshot({ path: 'shots/crit-race/race-mid.png' });
}
console.log('B trace (close/panelOpen/riftPainted):', trace2.join(' '));
const collide = trace2.filter((s) => s[0] === 'C' && (s[1] === 'P' || s[2] === 'v'));
console.log('B frames where the close card and a painted rift coexist:', collide.length);
await p.screenshot({ path: 'shots/crit-race/race-end.png' });
await b.close();
