/** Names every container that grows during real play: DOM, listeners, scene. */
import { chromium } from 'playwright';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4611');
const MIN = Number(arg('minutes', 4));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });

await ctx.addInitScript(() => {
  const live = new Map(); let seq = 0;
  const key = (t, f) => t + '|' + (f && (f.__lk || (f.__lk = ++seq)));
  const A = EventTarget.prototype.addEventListener, R = EventTarget.prototype.removeEventListener;
  EventTarget.prototype.addEventListener = function (t, f, o) {
    try {
      const k = key(t, f);
      const st = new Error().stack.split('\n').slice(2, 5).join(' <- ').replace(/https?:\/\/[^/]+/g, '');
      const tn = this === window ? 'window' : this === document ? 'document'
        : (this.tagName ? this.tagName.toLowerCase() + (this.className ? '.' + String(this.className).split(' ')[0] : '') : String(this));
      const rec = live.get(k) || { n: 0, stack: st, type: t, target: tn };
      rec.n++; live.set(k, rec);
    } catch {}
    return A.call(this, t, f, o);
  };
  EventTarget.prototype.removeEventListener = function (t, f, o) {
    try { const k = key(t, f); const r = live.get(k); if (r) { r.n--; if (r.n <= 0) live.delete(k); } } catch {}
    return R.call(this, t, f, o);
  };
  window.__leak = () => {
    const by = new Map();
    for (const r of live.values()) { const k = `${r.type} @ ${r.target} :: ${r.stack}`; by.set(k, (by.get(k) || 0) + r.n); }
    return { total: [...live.values()].reduce((a, r) => a + r.n, 0), top: [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 8) };
  };
  window.__dom = () => {
    const by = new Map();
    for (const el of document.getElementsByTagName('*')) {
      const p = el.parentElement;
      const k = p ? ((p.id ? '#' + p.id : '') + (p.className ? '.' + String(p.className).split(' ').join('.') : p.tagName)) : 'root';
      by.set(k, (by.get(k) || 0) + 1);
    }
    return [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 10);
  };
  window.__scene = () => {
    const by = new Map();
    window.__ascent.engine.scene.traverse((o) => {
      const p = o.parent;
      const k = (p ? (p.name || p.type) : 'root') + ' > ' + (o.name || o.type);
      by.set(k, (by.get(k) || 0) + 1);
    });
    return [...by.entries()].sort((a, b) => b[1] - a[1]).slice(0, 12);
  };
});

const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[err]', e.message.slice(0, 120)));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4500);
await page.mouse.click(800, 450);

const facts = () => page.evaluate(() => { const a = window.__ascent, p = a.player.pos; return { x: p.x, z: p.z, yaw: a.player.yaw, ui: !!a.input.uiOpen, panel: !!a.panel?.open, stuck: !!a.player.stuck, answer: (a.panel?.open && a.panel.item) ? String(a.panel.item.answer) : null }; });
const handBack = async () => { for (let i = 0; i < 4; i++) { if (!(await page.evaluate(() => !!window.__ascent.input.uiOpen))) return; await page.keyboard.press('Escape'); await page.waitForTimeout(300); } };

const snap = async (label) => {
  const [l, d, s] = await Promise.all([page.evaluate(() => window.__leak()), page.evaluate(() => window.__dom()), page.evaluate(() => window.__scene())]);
  console.log(`\n===== ${label} — ${l.total} listeners`);
  l.top.forEach(([k, n]) => console.log('  L', String(n).padStart(5), k.slice(0, 190)));
  console.log('  -- DOM children per parent --');
  d.forEach(([k, n]) => console.log('  D', String(n).padStart(5), k.slice(0, 120)));
  console.log('  -- scene children --');
  s.forEach(([k, n]) => console.log('  S', String(n).padStart(5), k.slice(0, 120)));
};

await snap('start');
const t0 = Date.now();
while ((Date.now() - t0) / 60000 < MIN) {
  await handBack();
  const target = await page.evaluate(() => { const a = window.__ascent, p = a.player.pos; const r = (a.rifts?.list || []).filter((x) => !x.locked); let b = null, bd = 1e9; for (const x of r) { const dd = Math.hypot(x.pos.x - p.x, x.pos.z - p.z); if (dd < bd) { bd = dd; b = x; } } return b ? { x: b.pos.x, z: b.pos.z } : null; });
  if (!target) { await page.waitForTimeout(400); continue; }
  const tw = Date.now(); let held = false;
  while (Date.now() - tw < 40000) {
    const f = await facts();
    if (f.panel) break;
    if (f.ui) { if (held) { await page.keyboard.up('KeyW'); held = false; } await handBack(); continue; }
    if (f.stuck) { await page.keyboard.up('KeyW').catch(() => {}); held = false; await page.keyboard.press('KeyR'); await page.waitForTimeout(700); continue; }
    const dx = target.x - f.x, dz = target.z - f.z;
    if (Math.hypot(dx, dz) < 5) break;
    let dd = ((Math.atan2(dx, dz) - f.yaw + Math.PI) % (Math.PI * 2)) - Math.PI; if (dd < -Math.PI) dd += Math.PI * 2;
    if (!held) { await page.keyboard.down('KeyW'); held = true; }
    if (Math.abs(dd) > 0.1) { const k = dd > 0 ? 'ArrowLeft' : 'ArrowRight'; await page.keyboard.down(k); await page.waitForTimeout(Math.min(380, Math.max(50, Math.abs(dd) / 2.6 * 1000))); await page.keyboard.up(k); }
    else { await page.keyboard.down('ShiftLeft'); await page.waitForTimeout(160); }
  }
  if (held) await page.keyboard.up('KeyW');
  await page.keyboard.up('ShiftLeft').catch(() => {});
  for (const k of ['KeyE', 'Enter']) { await page.keyboard.press(k); await page.waitForTimeout(400); if (await page.evaluate(() => !!window.__ascent.panel?.open)) break; }
  for (let n = 0; n < 3; n++) {
    const f = await facts(); if (!f.panel || !f.answer) break;
    const opts = await page.$$('.rf-opt, .rf-choice button, .rf-choices button');
    if (opts.length) await opts[0].click().catch(() => {});
    else { for (const ch of f.answer) await page.keyboard.press(ch === '-' ? 'Minus' : ch === '/' ? 'Slash' : ch === '.' ? 'Period' : ch).catch(() => {}); await page.keyboard.press('Enter'); }
    await page.waitForTimeout(1300);
  }
  await handBack();
  await page.mouse.click(800, 450).catch(() => {});
  for (let k = 0; k < 5; k++) { await page.mouse.click(640 + k * 90, 420 + (k % 2) * 60).catch(() => {}); await page.waitForTimeout(120); }
  await page.keyboard.press('KeyG'); await page.keyboard.press('KeyF');
  await page.waitForTimeout(200);
}
await snap(`after ${MIN}m`);
await browser.close();
