/**
 * LANE D DIAGNOSTIC (not a gate). Reads notFree() at every place the world
 * seats an objective and on rings around it, with no walking, so the map of
 * wedges comes back in two minutes instead of forty. Verification is
 * tools/critic/compose.mjs, not this.
 */
import { chromium } from 'playwright';
import { writeFile } from 'node:fs/promises';
import { ESCAPE_JS, notFree } from '../../tools/critic/_escape.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4390');
const OUT = arg('out', 'scratch/laneD/probe.json');
const RINGS = (arg('rings', '0,8,17')).split(',').map(Number);
const B = Number(arg('bearings', 8));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 } });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2400);
const clear = () => page.evaluate(() => {
  const s = window.__ascent?.session;
  s?.charter?.hide?.(); s?.resolution?.hide?.(); s?.rest?.hide?.();
  for (const el of document.querySelectorAll('.ses-charter,.ses-close,.ses-rest')) el.classList.remove('show');
  document.getElementById('ui')?.classList.remove('ses-cine', 'ses-resting');
  document.getElementById('boot')?.classList.add('gone');
}).catch(() => {});
await clear();
for (let i = 0; i < 6; i++) {
  const busy = await page.evaluate(() => !!(window.__ascent.panel?.open || window.__ascent.input.uiOpen));
  if (!busy) break;
  await page.keyboard.press('Escape'); await page.waitForTimeout(300);
}

const sites = await page.evaluate(() => {
  const a = window.__ascent; const out = [];
  const push = (kind, id, x, y, z) => { if (Number.isFinite(x) && Number.isFinite(z)) out.push({ kind, id, x: +x, y: +(y ?? 0), z: +z }); };
  push('plaza', 'landing', 0, a.islandAt(0, 0) ?? 0, 0);
  for (const r of a.rifts.list) push('rift', r.id, r.foot ? r.foot.x : r.pos.x, r.pos.y, r.foot ? r.foot.z : r.pos.z);
  const gates = a.waygates?.list || a.waygates?.gates || [];
  for (const g of gates) if (g && g.x !== undefined) push('waygate', g.id || 'gate', g.x, g.y ?? 0, g.z);
  const sp = a.spans?.state?.() || null;
  if (sp && Array.isArray(sp.sites)) for (const s of sp.sites) push('span', s.id || 'span', s.x, s.y ?? 0, s.z);
  const er = a.errand?.state?.() || a.errand?.mark || null;
  if (er && Number.isFinite(er.x)) push('errand', 'mark', er.x, er.y ?? 0, er.z);
  return out;
});
console.log(`${sites.length} sites`);

const standAt = (x, z, yaw) => page.evaluate(([px, pz, yw]) => {
  const a = window.__ascent; const h = a.islandAt(px, pz);
  if (h === null) return false;
  a.player.pos.set(px, h + 0.15, pz); a.player.vel.set(0, 0, 0);
  if (yw !== null) { a.player.yaw = yw; if (a.player.cam) a.player.cam.yaw = yw; }
  a.player.cam?.refound?.();
  return true;
}, [x, z, yaw]);

const handBack = async () => {
  for (let i = 0; i < 6; i++) {
    const busy = await page.evaluate(() => !!(window.__ascent.panel?.open || window.__ascent.input.uiOpen));
    if (!busy) return true;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(320);
  }
  return false;
};
let frozenN = 0;
const running = async () => {
  for (let i = 0; i < 8; i++) {
    const a = await page.evaluate(() => window.__ascent.engine.frame | 0);
    await page.waitForTimeout(200);
    const b = await page.evaluate(() => window.__ascent.engine.frame | 0);
    if (b > a) return true;
    await page.bringToFront().catch(() => {});
    await page.mouse.click(800, 450).catch(() => {});
    await page.keyboard.press('Escape').catch(() => {});
    await clear();
    await page.waitForTimeout(260);
  }
  frozenN++; return false;
};

const rows = [];
for (const s of sites) {
  for (const R of RINGS) {
    const n = R === 0 ? 1 : B;
    for (let b = 0; b < n; b++) {
      const th = (b / n) * Math.PI * 2;
      const px = s.x + Math.cos(th) * R, pz = s.z + Math.sin(th) * R;
      const toSite = R === 0 ? 0 : Math.atan2(s.x - px, s.z - pz);
      if (!(await standAt(px, pz, toSite))) { rows.push({ site: `${s.kind} ${s.id}`, R, b, off: true }); continue; }
      // settle on his own collider, exactly as compose.mjs does, or a placement
      // on a slope reads back as "not standing on a surface" and that is the
      // harness talking
      await page.waitForTimeout(360);
      try { await page.waitForFunction(() => !!window.__ascent.player.grounded, null, { timeout: 1600 }); } catch { /* airborne is its own answer */ }
      await handBack();
      await clear();
      await running();
      await page.waitForTimeout(420);
      const f = await page.evaluate(ESCAPE_JS);
      const why = notFree(f);
      rows.push({ site: `${s.kind} ${s.id}`, R, b, why, open: f.open, short: f.short, seeFar: f.seeFar, minD: f.minD, boom: f.boom, camOpen: f.camOpen, onGround: f.onGround, x: f.x, z: f.z, y: f.y, ground: f.ground });
    }
  }
  const bad = rows.filter((r) => r.site === `${s.kind} ${s.id}` && r.why);
  console.log(`${s.kind} ${s.id} @ ${s.x.toFixed(0)},${s.z.toFixed(0)}: ${bad.length}/${rows.filter((r) => r.site === `${s.kind} ${s.id}` && !r.off).length} not free`);
  for (const q of bad) console.log(`    R${q.R} b${q.b}: ${q.why}  [open ${q.open} short ${q.short} seeFar ${q.seeFar} minD ${q.minD} boom ${q.boom} camOpen ${q.camOpen}]`);
}
await writeFile(OUT, JSON.stringify(rows, null, 1));
const bad = rows.filter((r) => r.why).length, tot = rows.filter((r) => !r.off).length;
console.log(`\nTOTAL ${bad}/${tot} not free`);
const byReason = {};
for (const r of rows) if (r.why) { const k = r.why.replace(/[0-9.]+/g, '#'); byReason[k] = (byReason[k] || 0) + 1; }
console.log(JSON.stringify(byReason, null, 1));
console.log('frozen samples:', frozenN);
await browser.close();
