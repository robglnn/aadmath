/**
 * Hostile critic: play ONE whole session end to end at a human pace and
 * record the wall-clock shape.
 *
 *   node x-session.mjs --w 1600 --h 900 --out shots/xcrit-desktop --pace 1 --loc en
 *
 * --pace 1 answers each item in roughly the time the engine's own cost model
 * says it should take (so the measured pace factor lands near 1, which is what
 * the planner assumed). --pace 0 answers instantly, for layout work.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const W = +arg('w', 1600), H = +arg('h', 900);
const OUT = path.resolve(arg('out', 'shots/xcrit'));
const PACE = +arg('pace', 1);
const LOC = arg('loc', 'en');
const URL = arg('url', 'http://127.0.0.1:4611');
const RELOAD_AT = +arg('reloadAt', 0.45); // fraction of target at which we simulate the break
await mkdir(OUT, { recursive: true });

let rs = 12345;
const rnd = () => { rs = (rs * 1664525 + 1013904223) >>> 0; return rs / 4294967296; };

const b = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization', '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const ctx = await b.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2, isMobile: W < 700, hasTouch: W < 700 });
const p = await ctx.newPage();
const logs = [];
p.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
p.on('pageerror', (e) => logs.push('pageerror: ' + e.message));

const T0 = Date.now();
const at = () => ((Date.now() - T0) / 1000);
const timeline = [];
const mark = (what, extra = {}) => { const e = { t: +at().toFixed(1), what, ...extra }; timeline.push(e); console.log(JSON.stringify(e)); };
const shot = async (name) => { await p.screenshot({ path: path.join(OUT, name + '.png') }); mark('shot:' + name); };

await p.goto(URL, { waitUntil: 'networkidle' });
await p.evaluate(() => { localStorage.clear(); });
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
if (LOC !== 'en') { await p.evaluate((l) => window.__ascent.setLocale(l), LOC); await p.waitForTimeout(1200); await p.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 }); await p.evaluate(() => document.getElementById('boot')?.classList.add('gone')); }
mark('loaded');

const sess = () => p.evaluate(() => {
  const s = window.__ascent.state();
  return { phase: s.session.phase, run: s.session.run, pace: s.session.pace, fps: s.fps, perf: s.perf };
});

await p.waitForTimeout(2200); await shot('00-boot');
await p.waitForTimeout(8000); await shot('01-coldopen');
// wait for orders
await p.waitForFunction(() => document.querySelector('.ses-charter.show'), null, { timeout: 60000 });
mark('orders-visible');
await p.waitForTimeout(1400); await shot('02-orders');
const plan = await sess();
mark('plan', { target: plan.run.target, minutes: plan.run.minutes, seams: plan.run.seams.map((s) => s.id + (s.hold ? ':hold' : ':ground')), seeded: plan.run.seeded });
mark('orders-text', { text: await p.evaluate(() => document.querySelector('.ses-charter .sc-card')?.innerText) });

await p.click('.sc-go');
const TBEGIN = at();
mark('begin');
await p.waitForTimeout(600);
await shot('03-world-after-begin');

// --- the work ---
const items = [];
let reloaded = false;
let lastShot = 0;
const target = plan.run.target;

async function ensureItem() {
  const open = await p.evaluate(() => !!window.__ascent.panel.open);
  if (open) return true;
  // walk in: teleport to the objective's rift and press E, as a player would
  const ok = await p.evaluate(async () => {
    const a = window.__ascent;
    const n = a.nextObjective();
    const id = n?.skill || n?.id;
    if (!id) return 'no-objective';
    if (!a.teleportTo(id)) return 'no-rift:' + id;
    return 'tp:' + id;
  });
  await p.waitForTimeout(500);
  await p.keyboard.press('KeyE');
  await p.waitForTimeout(900);
  const open2 = await p.evaluate(() => !!window.__ascent.panel.open);
  if (!open2) mark('rift-open-failed', { why: ok });
  return open2;
}

let guard = 0;
while (guard++ < 400) {
  const st = await sess();
  if (st.phase !== 'work') { mark('phase-change', { phase: st.phase }); break; }
  const got = await ensureItem();
  if (!got) { await p.waitForTimeout(1500); continue; }
  const info = await p.evaluate(() => {
    const a = window.__ascent;
    const it = a.panel.item;
    return {
      prompt: (document.querySelector('.rift, .panel, #rift')?.innerText || '').slice(0, 700),
      answer: String(it.answer), form: it.form, rep: it.rep, difficulty: it.difficulty,
      sec: a.itemSeconds({ rep: it.rep, difficulty: it.difficulty }),
    };
  });
  if (items.length === 0) { await p.waitForTimeout(900); await shot('04-first-item'); }
  const think = PACE ? Math.max(2, info.sec * PACE * (0.65 + rnd() * 0.8)) : 0.35;
  await p.waitForTimeout(think * 1000);
  const correct = rnd() < 0.75;
  const res = await p.evaluate((c) => {
    const a = window.__ascent;
    const it = a.panel.item;
    const v = c ? it.answer : (typeof it.answer === 'number' ? it.answer + 1 : String(it.answer) + '1');
    return a.enter(v);
  }, correct);
  items.push({ t: +at().toFixed(1), think: +think.toFixed(1), correct, form: info.form, rep: info.rep, d: info.difficulty, answer: info.answer, prompt: info.prompt });
  await p.waitForTimeout(1600);
  const now = await sess();
  const frac = now.run ? now.run.tears / target : 0;
  if (!reloaded && frac >= RELOAD_AT) {
    reloaded = true;
    await shot('05-mid-band');
    const before = { tears: now.run.tears, focus: Math.round(now.run.focus), index: now.run.index };
    mark('break:reload-now', before);
    await p.waitForTimeout(500);
    await p.reload({ waitUntil: 'networkidle' });
    await p.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
    await p.waitForTimeout(5000);
    const after = await sess();
    mark('break:after-reload', { phase: after.phase, tears: after.run?.tears, focus: Math.round(after.run?.focus || 0), target: after.run?.target, before });
    await shot('06-after-reload');
    // wait for the run to pick itself back up
    for (let i = 0; i < 20 && (await sess()).phase !== 'work'; i++) await p.waitForTimeout(1000);
    mark('break:resumed', { phase: (await sess()).phase });
    await shot('07-resumed');
  }
  if (frac >= 0.76 && lastShot < 0.76) { lastShot = 0.76; await shot('08-near-state'); }
  if (items.length % 5 === 0) mark('progress', { items: items.length, tears: now.run?.tears, target, focusMin: +((now.run?.focus || 0) / 60).toFixed(1), pace: now.pace });
}

const TWORK = at() - TBEGIN;
mark('work-ended', { workMinutes: +(TWORK / 60).toFixed(2), items: items.length });
await p.waitForTimeout(1500);
await shot('09-close');
const closeText = await p.evaluate(() => document.querySelector('.ses-close .sx-in')?.innerText);
mark('close-text', { text: closeText });
const st2 = await sess();
mark('close-state', { phase: st2.phase, run: st2.run && { tears: st2.run.tears, target: st2.run.target, held: st2.run.held, opened: st2.run.opened, minutes: Math.round(st2.run.focus / 60) }, pace: st2.pace });

// --- the break ---
await p.evaluate(() => document.querySelector('.ses-close .sx-rest')?.click());
await p.waitForTimeout(1800);
await shot('10-rest');
mark('rest-text', { text: await p.evaluate(() => document.querySelector('.ses-rest')?.innerText) });
await p.waitForTimeout(12000);
await shot('11-rest-mid');
mark('rest-mid-text', { text: await p.evaluate(() => document.querySelector('.ses-rest')?.innerText) });
await p.waitForTimeout(25000);
await shot('12-rest-late');
mark('rest-late-text', { text: await p.evaluate(() => document.querySelector('.ses-rest')?.innerText) });
mark('rest-state', { s: (await sess()).phase });

// fps sample while resting / world
const perf = await p.evaluate(() => window.__ascent.state().perf);
mark('perf', perf);
mark('logs', { n: logs.length, sample: logs.slice(0, 8) });

await writeFile(path.join(OUT, 'timeline.json'), JSON.stringify({ timeline, items, logs }, null, 1));
console.log('ITEMS', items.length, 'WORK MIN', (TWORK / 60).toFixed(2));
await b.close();
