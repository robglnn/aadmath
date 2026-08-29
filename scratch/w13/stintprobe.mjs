/**
 * Does a stint really stop at three? Walk to the first tear with real keys,
 * answer every card correctly, and sample the stint counter and the panel every
 * 300 ms for four minutes. Nothing here opens anything.
 */
import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const MIN = Number(arg('minutes', 4));

const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
p.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await p.goto(URL, { waitUntil: 'networkidle' });
await p.evaluate(() => { try { localStorage.clear(); } catch {} });
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await p.waitForTimeout(5000);
await p.mouse.click(640, 360);
try { await p.waitForSelector('.sc-go', { timeout: 10000 }); await p.locator('.sc-go').click(); } catch {}
await p.waitForTimeout(700);
await p.mouse.click(640, 360);

const open = () => p.evaluate(() => !!window.__ascent.panel?.open);
const info = () => p.evaluate(() => window.__ascent.panelInfo());
const st = () => p.evaluate(() => window.__ascent.stint.state());

// walk to the first tear with W + mouse
await p.keyboard.down('ShiftLeft');
await p.keyboard.down('KeyW');
for (let i = 0; i < 200; i++) {
  const e = await p.evaluate(() => {
    const a = window.__ascent, pp = a.player.pos;
    const r = a.rifts.list.find((x) => !x.locked && !x.mastered);
    if (!r) return null;
    let d = ((Math.atan2(r.foot.x - pp.x, r.foot.z - pp.z) - a.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (d < -Math.PI) d += Math.PI * 2;
    return { d, dist: Math.hypot(pp.x - r.foot.x, pp.z - r.foot.z) };
  });
  if (!e) break;
  if (Math.abs(e.d) > 0.06) await p.mouse.move(640 - e.d * 220, 360, { steps: 2 });
  await p.waitForTimeout(120);
  if (e.dist < 5 || await open()) break;
}
await p.keyboard.up('KeyW'); await p.keyboard.up('ShiftLeft');
if (!(await open())) { await p.keyboard.press('KeyE'); await p.waitForTimeout(700); }

const T0 = Date.now();
let last = '';
let n = 0;
const deadline = T0 + MIN * 60000;
while (Date.now() < deadline) {
  const o = await open();
  const s = await st();
  const line = `${((Date.now() - T0) / 1000).toFixed(1)}s panel=${o ? 'OPEN' : 'shut'} rift=${s.riftId} n=${s.n}/${s.of} ended=${s.ended} settling=[${s.settling}]`;
  if (line.replace(/^[\d.]+s /, '') !== last) { console.log(line); last = line.replace(/^[\d.]+s /, ''); }
  if (o) {
    const c = await info();
    if (c.open && !c.settled) {
      n++;
      if (c.mode === 'choice') {
        const btns = p.locator('.rf-reading');
        const k = await btns.count();
        let want = 0;
        for (let i = 0; i < k; i++) if (String(await btns.nth(i).getAttribute('data-value')) === String(c.answer)) { want = i; break; }
        if (k) await btns.nth(want).click().catch(() => {});
      } else if (c.mode === 'keypad') {
        for (const ch of String(c.answer ?? '')) {
          if (ch === '-') await p.keyboard.press('Minus'); else await p.keyboard.press(ch);
          await p.waitForTimeout(30);
        }
        await p.keyboard.press('Enter');
      } else {
        const any = p.locator('.rf-move, .rf-chip, .rf-bay, .ans').first();
        if (await any.count()) await any.click().catch(() => {});
      }
      console.log(`   -> answered #${n} skill=${c.skill} mode=${c.mode}`);
      await p.waitForTimeout(900);
    }
  }
  await p.waitForTimeout(300);
}
console.log('items answered:', n);
console.log('final', await st());
await b.close();
