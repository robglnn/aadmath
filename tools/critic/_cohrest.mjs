/** COHERENCE: can a player get out of the break beat? Real clicks, real keys. */
import { chromium } from 'playwright';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4917');
const OUT = path.resolve(arg('out', '/tmp/cohplay/rest'));
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', (e) => errs.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
await page.waitForTimeout(4500);
const panelOpen = () => page.evaluate(() => !!window.__ascent.panelInfo().open);
const card = () => page.evaluate(() => window.__ascent.panelInfo());
const phase = () => page.evaluate(() => window.__ascent.session.state().phase);
async function click(sel) { const el = page.locator(sel).first(); if (await el.count() && await el.isVisible().catch(() => false)) { await el.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(500); return true; } return false; }
async function answer(c) {
  if (c.mode === 'choice') { const b = page.locator('.rf-reading'); const n = await b.count(); if (!n) return false;
    let w = 0; for (let i = 0; i < n; i++) if (String(await b.nth(i).getAttribute('data-value')) === String(c.answer)) { w = i; break; }
    await b.nth(w).click({ timeout: 5000 }).catch(() => {}); return true; }
  if (c.mode === 'keypad') { const s = String(c.answer ?? ''); if (!s) return false;
    for (const ch of s) { await page.keyboard.press(ch === '-' ? 'Minus' : ch === '/' ? 'Slash' : ch === '+' ? 'Equal' : ch === '^' ? 'Digit6' : ch); await page.waitForTimeout(24); }
    await page.keyboard.press('Enter'); return true; }
  const a2 = page.locator('.rf-move, .rf-chip, .rf-bay, .ans, .rf-cell').first();
  if (await a2.count()) { await a2.click({ timeout: 5000 }).catch(() => {}); return true; } return false;
}
await click('.ses-charter.show .sc-go');
await page.mouse.click(800, 450); await page.waitForTimeout(300);
// play until the close card
const t0 = Date.now();
while (Date.now() - t0 < 9 * 60000) {
  if (await page.locator('.ses-close.show').count() && await page.locator('.ses-close.show').first().isVisible().catch(() => false)) break;
  await click('.ses-charter.show .sc-go'); await click('.fdy .fdy-close');
  if (!(await panelOpen())) {
    await page.keyboard.press('KeyE');
    if (!(await panelOpen())) {
      const w = await page.evaluate(() => { const a = window.__ascent, T = a.THREE, o = a.objective(); if (!o) return null;
        const p = a.player.pos, hd = a.world.headingTo(p.x, p.z, o.x, o.z);
        const f = new T.Vector3(); a.camera.getWorldDirection(f); f.y = 0; f.normalize();
        const d = new T.Vector3(Math.sin(hd.yaw), 0, Math.cos(hd.yaw));
        return { ang: Math.atan2(f.x * d.z - f.z * d.x, f.dot(d)) }; });
      if (w && Math.abs(w.ang) > 0.08) { const k = w.ang > 0 ? 'ArrowRight' : 'ArrowLeft'; await page.keyboard.down(k); await page.waitForTimeout(90); await page.keyboard.up(k); }
      await page.keyboard.down('KeyW'); await page.waitForTimeout(220); await page.keyboard.up('KeyW');
      continue;
    }
  }
  const c = await card(); if (!c.open) continue;
  if (c.settled) { await page.waitForTimeout(900); continue; }
  await answer(c); await page.waitForTimeout(620);
  if (await panelOpen() && !(await page.evaluate(() => !!window.__ascent.panelInfo().settled))) { await page.keyboard.press('Escape'); await page.waitForTimeout(180); }
}
console.log('close card up:', await page.locator('.ses-close.show').count() > 0, 'phase', await phase());
await page.screenshot({ path: path.join(OUT, 'a-close.png') });
console.log('clicking STAND DOWN (.sx-rest):', await click('.ses-close.show .sx-rest'));
await page.waitForTimeout(1500);
console.log('phase now:', await phase());
const dump = async (tag) => {
  const d = await page.evaluate(() => {
    const el = document.querySelector('.ses-rest');
    if (!el) return { none: true };
    const info = (sel) => {
      const b = el.querySelector(sel); if (!b) return null;
      const r = b.getBoundingClientRect(); const c = getComputedStyle(b);
      const mid = document.elementFromPoint(Math.round(r.left + r.width / 2), Math.round(r.top + r.height / 2));
      return { sel, text: b.textContent, rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
        display: c.display, visibility: c.visibility, opacity: c.opacity, pointerEvents: c.pointerEvents,
        zIndex: c.zIndex, disabled: b.disabled, onTop: mid ? (mid === b ? 'itself' : mid.className || mid.tagName) : 'nothing' };
    };
    return { cls: el.className, phase: window.__ascent.session.state().phase,
      uiOpen: !!window.__ascent.input.uiOpen,
      skip: info('.sr-skip'), again: info('.sr-again'), off: info('.sr-off'), offBack: info('.sr-off-frame button') };
  });
  console.log(`\n[${tag}] ` + JSON.stringify(d, null, 1));
  await page.screenshot({ path: path.join(OUT, tag + '.png') });
  return d;
};
await dump('b-rest-breathe');
console.log('click .sr-skip ->', await click('.ses-rest.show .sr-skip'));
await page.waitForTimeout(1200);
await dump('c-rest-ended');
console.log('click .sr-again ->', await click('.ses-rest.show .sr-again'));
await page.waitForTimeout(1500);
console.log('phase after ANOTHER RUN:', await phase(), 'uiOpen', await page.evaluate(() => !!window.__ascent.input.uiOpen));
await dump('d-after-again');
// if still stuck, try every other way a player would
for (const [how, fn] of [
  ['press Enter', async () => page.keyboard.press('Enter')],
  ['press Space', async () => page.keyboard.press('Space')],
  ['press Escape', async () => page.keyboard.press('Escape')],
  ['click .sr-e-acts button', async () => click('.ses-rest.show .sr-e-acts button')],
  ['click .sr-off', async () => click('.ses-rest.show .sr-off')],
  ['click the middle of the frame', async () => page.mouse.click(800, 450)],
]) {
  if (await phase() !== 'rest') break;
  await fn(); await page.waitForTimeout(1200);
  console.log(`  ${how} -> phase ${await phase()} uiOpen ${await page.evaluate(() => !!window.__ascent.input.uiOpen)}`);
}
await dump('e-final');
console.log('errors: ' + (errs.length ? errs.slice(0, 6).join(' | ') : 'none'));
await browser.close();
