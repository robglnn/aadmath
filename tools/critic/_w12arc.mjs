/**
 * w12: play the whole lattice through the real scheduler and the real bank,
 * across five real days, and report what is left on each of them.
 *
 * The walk-up path is already proved by coldplay; this measures CONTENT and
 * PACE — how many items and how many seconds the engine itself budgets to
 * master each skill, what a sitting ends with, and what day five still has.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4939');
const OUT = path.resolve(arg('out', 'shots/w12-arc'));
const MINUTES = Number(arg('minutes', 22));   // one pomodoro sitting
const DAYS = Number(arg('days', 5));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const page = await (await browser.newContext({ viewport: { width: 1600, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => localStorage.clear());
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent);
await page.waitForTimeout(4000);

const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) });
const out = [];
const say = (s) => { console.log(s); out.push(s); };

const facts = () => page.evaluate(() => {
  const a = window.__ascent;
  const sk = a.mastery.save().skills;
  const held = Object.values(sk).filter((s) => s.mastered).map((s) => s.id);
  return {
    held, heldN: held.length,
    seen: Object.values(sk).filter((s) => s.attempts > 0).length,
    attempts: Object.values(sk).reduce((n, s) => n + s.attempts, 0),
    correct: Object.values(sk).reduce((n, s) => n + s.correct, 0),
    durable: Object.values(sk).reduce((n, s) => n + (s.durable | 0), 0),
    rifts: a.rifts.list.map((r) => ({ id: r.id, locked: !!r.locked, sealed: !!r.sealed })),
    unlocked: a.rifts.list.filter((r) => !r.locked).length,
    sealed: a.rifts.list.filter((r) => r.sealed).length,
    watch: a.watch(),
    caches: (() => { try { const c = a.caches.state(); return { total: c.total, opened: c.opened, deep: c.deep, deepOpen: c.deepOpen }; } catch { return null; } })(),
    kit: (() => { try { const k = a.kit.state(); return { held: k.held, lines: k.lines, seals: k.seals, stock: k.stock.map((s) => ({ id: s.id, state: s.state, price: s.price })) }; } catch { return null; } })(),
    wardens: (() => { try { const w = a.wardens.state(); return { wakeDay: w.wakeDay, alive: w.alive, woke: w.woke, bound: w.bound, at: w.at.map((x) => ({ state: x.state, latex: x.latex })) }; } catch { return null; } })(),
    session: (() => { try { return a.session.state(); } catch { return null; } })(),
    next: (() => { try { const n = a.mastery.next(); return n ? { id: n.id, kind: n.kind } : null; } catch { return null; } })(),
  };
});

// One item, start to finish, through the real panel. Returns what was served
// and the engine's own second-cost for it.
const oneItem = async (wrongFirst = false) => {
  const opened = await page.evaluate(() => {
    const a = window.__ascent;
    if (a.panel.open) return { ok: true, already: true };
    const n = a.mastery.next();
    if (!n) return { ok: false, why: 'scheduler has nothing' };
    const did = a.openRiftById(n.id);
    return { ok: did, skill: n.id, kind: n.kind, difficulty: n.difficulty };
  });
  if (!opened.ok) return { ok: false, why: opened.why || 'rift would not open' };
  await page.waitForTimeout(450);
  const info = await page.evaluate(() => {
    const a = window.__ascent;
    const i = a.panelInfo();
    let secs = null;
    try { secs = a.itemSeconds(a.panel.item, a.panel.mode); } catch {}
    return { ...i, secs };
  });
  if (!info.open) return { ok: false, why: 'panel did not open' };
  if (wrongFirst) {
    await page.evaluate(() => window.__ascent.panel.demo('wrong'));
    await page.waitForTimeout(900);
  }
  const solved = await page.evaluate(() => {
    const a = window.__ascent;
    if (!a.panel.open) return 'closed-after-wrong';
    return a.panel.demo('right');
  });
  await page.waitForTimeout(700);
  // hand the frame back if the panel lingers
  await page.evaluate(() => { try { if (window.__ascent.panel.open && window.__ascent.panel._settled) window.__ascent.panel.close?.(); } catch {} });
  await page.waitForTimeout(500);
  return { ok: true, skill: info.skill, form: info.form, mode: info.mode, kind: info.kind, rep: info.rep, secs: info.secs, masteredWhenServed: info.masteredWhenServed, reprobe: info.reprobe, solved };
};

const days = [];
for (let d = 1; d <= DAYS; d++) {
  say(`\n########## DAY ${d} ##########`);
  const open = await facts();
  await shot(`d${d}-open`);
  say(`open  held=${open.heldN} [${open.held}] unlocked=${open.unlocked}/10 sealed=${open.sealed} durable=${open.durable}`);
  say(`open  watch=${JSON.stringify(open.watch)}`);
  say(`open  wardens=${JSON.stringify(open.wardens)}`);
  say(`open  caches=${JSON.stringify(open.caches)}`);
  say(`open  kit=${JSON.stringify(open.kit)}`);
  say(`open  session=${JSON.stringify(open.session)}`);

  let budget = MINUTES * 60;   // the engine's own seconds
  const served = [];
  let n = 0;
  while (budget > 0 && n < 200) {
    const r = await oneItem(n % 6 === 2);   // miss roughly one in six on purpose
    if (!r.ok) { say(`  scheduler stopped: ${r.why} (after ${n} items, ${(MINUTES * 60 - budget).toFixed(0)}s spent)`); break; }
    served.push(r);
    budget -= (r.secs || 30);
    n++;
    if (n === 1) await shot(`d${d}-first-item`);
  }
  const close = await facts();
  await shot(`d${d}-close`);

  const bySkill = {};
  for (const s of served) { bySkill[s.skill] = (bySkill[s.skill] || 0) + 1; }
  say(`worked ${served.length} items, engine-budget ${(MINUTES * 60 - budget).toFixed(0)}s of ${MINUTES * 60}s`);
  say(`  per skill: ${JSON.stringify(bySkill)}`);
  say(`  modes: ${JSON.stringify([...new Set(served.map((s) => s.mode))])}`);
  say(`  forms: ${JSON.stringify([...new Set(served.map((s) => s.form))])}`);
  say(`  served-on-a-held-line: ${served.filter((s) => s.masteredWhenServed).length}  reprobes: ${JSON.stringify([...new Set(served.map((s) => s.reprobe).filter(Boolean))])}`);
  say(`close held=${close.heldN} [${close.held}] unlocked=${close.unlocked}/10 sealed=${close.sealed} durable=${close.durable}`);
  say(`close watch=${JSON.stringify(close.watch)}`);
  say(`close wardens=${JSON.stringify(close.wardens)}`);
  say(`close caches=${JSON.stringify(close.caches)}`);
  say(`close kit=${JSON.stringify(close.kit)}`);
  say(`close next=${JSON.stringify(close.next)}`);

  days.push({ day: d, open, close, served: served.map((s) => ({ skill: s.skill, form: s.form, mode: s.mode, kind: s.kind, secs: s.secs, held: s.masteredWhenServed })) });

  if (d < DAYS) {
    await page.evaluate(() => window.__ascent.advanceDays(1));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__ascent);
    await page.waitForTimeout(4000);
  }
}

say(`\nerrors: ${errors.length}`);
errors.slice(0, 8).forEach((e) => say('  ! ' + e));
await writeFile(path.join(OUT, 'arc.json'), JSON.stringify(days, null, 2));
await writeFile(path.join(OUT, 'arc.log'), out.join('\n'));
await browser.close();
