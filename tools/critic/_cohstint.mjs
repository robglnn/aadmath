/**
 * COHERENCE PROBE — does one arrival really buy three items?
 *
 * src/session/stint.js states the rule in one sentence: "One arrival at a tear
 * buys THREE items. Then the world comes back." and "When a stint fills, the
 * tear is SPENT", re-armed only by arriving somewhere else.
 *
 * This walks to the nearest tear on REAL KEYS from a cleared save, then does
 * nothing but stand still and press the interact key, answering whatever comes
 * up, and counts how many items one square metre will give.
 * window.__ascent is READ ONLY here (position, panel, stint) — nothing is
 * opened, answered or advanced through it.
 */
import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4917');
const CAP = Number(arg('items', 20));

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
const errs = [];
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(4000);

const facts = () => page.evaluate(() => {
  const a = window.__ascent, p = a.player.pos, pi = a.panelInfo();
  let st = null;
  try { const s = a.stint?.state?.() ?? a.session?.state?.().stint ?? null; st = s ? JSON.parse(JSON.stringify(s)) : null; } catch {}
  const o = a.objective ? a.objective() : null;
  return { x: +p.x.toFixed(2), z: +p.z.toFixed(2), yaw: a.player.yaw, ui: !!a.input.uiOpen,
    panel: !!pi.open, settled: !!pi.settled, answer: pi.open ? String(pi.answer) : null,
    mode: pi.mode, skill: pi.skill, stint: st,
    open: a.rifts.list.filter((r) => !r.locked).map((r) => r.id),
    lockedHere: pi.open && pi.skill ? !!(a.rifts.list.find((r) => r.id === pi.skill) || {}).locked : null,
    obj: o ? { id: o.id, d: +Math.hypot(o.x - p.x, o.z - p.z).toFixed(1), spent: o.spent } : null };
});
const handBack = async () => { for (let i = 0; i < 6; i++) { if (!(await page.evaluate(() => !!window.__ascent.input.uiOpen))) return; await page.keyboard.press('Escape'); await page.waitForTimeout(300); } };
await page.mouse.click(800, 450); await handBack();

// walk to the objective on real keys
const target = await page.evaluate(() => { const a = window.__ascent, o = a.objective(); return o ? { id: o.id, x: o.x, z: o.z } : null; });
console.log('objective the game names:', JSON.stringify(target));
const t0 = Date.now(); let held = false;
while (Date.now() - t0 < 90000) {
  const f = await facts();
  if (f.panel) break;
  if (f.ui) { if (held) { await page.keyboard.up('KeyW'); held = false; } await handBack(); continue; }
  const dx = target.x - f.x, dz = target.z - f.z;
  if (Math.hypot(dx, dz) < 4.5) { if (held) { await page.keyboard.up('KeyW'); held = false; } await page.keyboard.press('KeyE'); await page.waitForTimeout(500); if ((await facts()).panel) break; continue; }
  let d = ((Math.atan2(dx, dz) - f.yaw + Math.PI) % (Math.PI * 2)) - Math.PI; if (d < -Math.PI) d += Math.PI * 2;
  if (!held) { await page.keyboard.down('KeyW'); held = true; }
  if (Math.abs(d) > 0.10) { const k = d > 0 ? 'ArrowLeft' : 'ArrowRight'; await page.keyboard.down(k); await page.waitForTimeout(Math.min(320, Math.max(50, Math.abs(d) / 2.6 * 1000))); await page.keyboard.up(k); }
  else await page.waitForTimeout(120);
}
if (held) await page.keyboard.up('KeyW');
const at = await facts();
console.log('arrived at', at.x, at.z, 'panel', at.panel, 'skill', at.skill);
const anchor = { x: at.x, z: at.z };

async function answerOne(f) {
  const opts = await page.$$('.rf-reading');
  if (opts.length) {
    const want = String(f.answer).replace(/\s+/g, '');
    let pick = null;
    for (const o of opts) { const v = await o.getAttribute('data-value'); if (v != null && String(v).replace(/\s+/g, '') === want) { pick = o; break; } }
    await (pick || opts[0]).click().catch(() => {});
    return 'choice';
  }
  if (await page.$('.rf-chip:not([disabled])')) {
    for (let k = 0; k < 12; k++) {
      const chip = await page.$('.rf-chip:not([disabled]):not(.placed)'); if (!chip) break;
      const txt = ((await chip.innerText().catch(() => '')) || '').trim();
      const wantVar = /[A-Za-z]/.test(txt);
      await chip.click().catch(() => {}); await page.waitForTimeout(80);
      const bay = await page.$(`.rf-bay[data-kind="${wantVar ? 'var' : 'num'}"]`) || (await page.$$('.rf-bay'))[wantVar ? 0 : 1];
      if (!bay) break; await bay.click().catch(() => {}); await page.waitForTimeout(140);
      if (!(await page.evaluate(() => !!window.__ascent.panelInfo().open))) break;
    }
    return 'sort';
  }
  if (await page.$('.rf-move, .rf-cell, .ans')) { await (await page.$('.rf-move, .rf-cell, .ans')).click().catch(() => {}); return 'surface'; }
  for (const ch of String(f.answer)) {
    if (ch === '-') await page.keyboard.press('Minus');
    else if (ch === '/') await page.keyboard.press('Slash');
    else if (ch === '.') await page.keyboard.press('Period');
    else await page.keyboard.press(ch).catch(() => {});
    await page.waitForTimeout(30);
  }
  await page.keyboard.press('Enter');
  return 'keypad';
}

let n = 0, refused = 0; const rows = [];
for (let i = 0; i < CAP * 3 && n < CAP; i++) {
  let f = await facts();
  if (f.ui && !f.panel) { await handBack(); continue; }
  if (!f.panel) { await page.keyboard.press('KeyE'); await page.waitForTimeout(700); f = await facts(); if (!f.panel) { refused++; if (refused === 1) rows.push({ n, event: 'E REFUSED (first)', stint: f.stint, open: f.open, obj: f.obj }); if (refused >= 8) { rows.push({ n, event: `E REFUSED ${refused} TIMES RUNNING — the tear is spent`, stint: f.stint, open: f.open }); break; } continue; } refused = 0; }
  if (f.settled) { await page.waitForTimeout(600); continue; }
  n++;
  const how = await answerOne(f);
  const after = await facts();
  rows.push({ n, skill: f.skill, mode: f.mode, how, lockedRiftHere: f.lockedHere, open: f.open.length, drift: +Math.hypot(after.x - anchor.x, after.z - anchor.z).toFixed(2), stint: after.stint, obj: after.obj });
  await page.waitForTimeout(900);
  const g = await facts();
  if (g.panel && !g.settled) { const x = await page.$('.rf-x'); if (x) await x.click().catch(() => {}); await page.waitForTimeout(300); }
  else if (g.panel && g.settled) { const t = Date.now(); while ((await facts()).panel && Date.now() - t < 4000) await page.waitForTimeout(200); }
}
const end = await facts();
console.log(`\nITEMS SERVED WITHOUT MOVING: ${n} (cap ${CAP}); drift from the anchor ${Math.hypot(end.x - anchor.x, end.z - anchor.z).toFixed(2)} m`);
for (const r of rows) console.log(' ', JSON.stringify(r));
console.log('errors:', errs.length ? errs.slice(0, 5) : 'none');
await browser.close();
