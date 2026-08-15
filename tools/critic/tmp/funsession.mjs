/**
 * One sitting, played at human pace, against a PERSISTENT profile so day 1,
 * day 2 and day 5 are genuinely the same save.
 *
 *   node tools/critic/tmp/funsession.mjs --out shots/fun-day1 --day 0 --fresh
 *   node tools/critic/tmp/funsession.mjs --out shots/fun-day2 --day 1
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4577');
const OUT = path.resolve(arg('out', 'shots/fun-day1'));
const PROFILE = path.resolve(arg('profile', '/tmp/ascent-profile'));
const DAY = Number(arg('day', 0));
const FRESH = process.argv.includes('--fresh');
const WANDER = Number(arg('wander', 12));   // seconds of world between rifts
const MAX_RIFTS = Number(arg('rifts', 18));
const ACC = Number(arg('acc', 0.85));
const BUDGET = Number(arg('budget', 1500)); // seconds of wall clock max
await mkdir(OUT, { recursive: true });
if (FRESH) await rm(PROFILE, { recursive: true, force: true });

const ctx = await chromium.launchPersistentContext(PROFILE, {
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync'],
  viewport: { width: 1600, height: 900 },
});
const page = ctx.pages()[0] || await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const log = []; const say = (s) => { log.push(s); console.log(s); };
let shotN = 0;
const shot = async (n) => { await page.screenshot({ path: path.join(OUT, `${String(shotN++).padStart(2, '0')}-${n}.png`) }); };

await page.goto(URL, { waitUntil: 'networkidle' });
if (FRESH) { await page.evaluate(() => { try { localStorage.clear(); } catch {} }); await page.reload({ waitUntil: 'networkidle' }); }
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(2500);
if (DAY > 0) {
  // NO reload after this: the offset lives in the page, not in the save.
  const w = await page.evaluate((d) => window.__ascent.advanceDays(d), DAY);
  say(`[clock] +${DAY}d -> ${JSON.stringify(w.watch)}`);
  await page.waitForTimeout(1500);
}

const brief = () => page.evaluate(() => {
  const a = window.__ascent, s = a.state();
  const sk = {};
  for (const [k, v] of Object.entries(s.skills || {})) if (v.attempts || v.mastered) sk[k] = `pL${(+v.pL).toFixed(2)}${v.mastered ? ' MASTERED' : ''} ${v.correct}/${v.attempts} d${v.difficulty} dur${v.durable}`;
  return { shards: s.shards, fps: Math.round(s.fps), phase: s.session.phase, run: s.session.run && { index: s.session.run.index, tears: s.session.run.tears, target: s.session.run.target, seams: s.session.run.seams?.map((x) => x.id), done: s.session.run.done },
    kit: { lines: s.kit.lines, held: s.kit.held, next: s.kit.next, affordable: s.kit.affordable, charters: s.kit.charters, beacons: s.kit.beacons, stations: s.kit.stations, sounding: s.kit.sounding, kinds: s.kit.move.kinds, sprint: s.kit.move.sprint, glideMax: s.kit.move.glideMax, airDash: s.kit.move.airDash },
    caches: { total: s.caches.total, opened: s.caches.opened }, drift: s.drift,
    watch: a.watch(), objective: a.nextObjective(), skills: sk };
});

say(`[open day${DAY}] ${JSON.stringify(await brief())}`);
const openHud = await page.evaluate(() => (document.getElementById('ui')?.innerText || '').replace(/\n+/g, ' | ').slice(0, 900));
say(`[open HUD] ${openHud}`);
await shot('open');

await page.mouse.move(800, 450); await page.mouse.click(800, 450);
await page.waitForTimeout(300);

// wander: run/jump/glide/dash around, pick up whatever the world offers
const wander = async (secs, label) => {
  const end = Date.now() + secs * 1000;
  while (Date.now() < end) {
    await page.mouse.move(800 + (Math.random() - 0.5) * 500, 450 + (Math.random() - 0.5) * 120, { steps: 3 });
    await page.keyboard.down('KeyW');
    await page.keyboard.down('ShiftLeft');
    await page.waitForTimeout(700);
    if (Math.random() < 0.5) { await page.keyboard.down('Space'); await page.waitForTimeout(1000); await page.keyboard.up('Space'); }
    if (Math.random() < 0.4) await page.keyboard.press('KeyC');
    await page.waitForTimeout(600);
    await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
    const st = await page.evaluate(() => ({
      open: !!window.__ascent.panel?.open,
      charter: !!document.querySelector('.ses-charter.show'),
      res: !!document.querySelector('.ses-resolution.show'),
      rest: !!document.querySelector('.ses-rest.show'),
      stuck: !!document.querySelector('.fcs.show'),
    }));
    if (st.charter) {
      const txt = await page.evaluate(() => document.querySelector('.ses-charter.show').innerText.replace(/\n+/g, ' | '));
      say(`[CHARTER @${label}] ${txt}`); await shot('charter');
      await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
    }
    if (st.res) { const txt = await page.evaluate(() => document.querySelector('.ses-resolution.show').innerText.replace(/\n+/g, ' | ')); say(`[RESOLUTION @${label}] ${txt}`); await shot('resolution'); return 'resolution'; }
    if (st.rest) { const txt = await page.evaluate(() => document.querySelector('.ses-rest.show').innerText.replace(/\n+/g, ' | ')); say(`[REST @${label}] ${txt}`); await shot('rest'); return 'rest'; }
    if (st.open) return 'rift';
    if (st.stuck) { await page.keyboard.press('KeyR'); await page.waitForTimeout(600); }
  }
  return 'ok';
};

const walkToRift = async () => {
  const target = await page.evaluate(() => {
    const a = window.__ascent, p = a.player.pos;
    const r = (a.rifts?.list || []).filter((x) => !x.locked && !x.sealed);
    if (!r.length) return null;
    let best = null, bd = 1e9;
    for (const x of r) { const d = Math.hypot(x.pos.x - p.x, x.pos.z - p.z); if (d < bd) { bd = d; best = x; } }
    return { id: best.id, x: best.pos.x, z: best.pos.z, dist: bd };
  });
  if (!target) return null;
  let held = false, opened = false, stucks = 0; const t0 = Date.now();
  for (let i = 0; i < 400; i++) {
    const err = await page.evaluate((t) => {
      const a = window.__ascent, p = a.player.pos;
      const want = Math.atan2(t.x - p.x, t.z - p.z);
      let d = ((want - a.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (d < -Math.PI) d += Math.PI * 2;
      return { d, dist: Math.hypot(t.x - p.x, t.z - p.z), y: p.y };
    }, target);
    if (Math.abs(err.d) > 0.06) await page.mouse.move(800 - err.d * 240, 450, { steps: 2 });
    if (!held) { await page.keyboard.down('KeyW'); held = true; }
    // sprint on the approach, ease off near the ring the way a person does
    if (err.dist > 18) { await page.keyboard.down('ShiftLeft'); } else { await page.keyboard.up('ShiftLeft'); }
    await page.waitForTimeout(err.dist > 18 ? 110 : 60);
    opened = await page.evaluate(() => !!window.__ascent.panel?.open);
    if (opened) break;
    if (err.dist < 9) { await page.keyboard.press('KeyE'); await page.waitForTimeout(220); opened = await page.evaluate(() => !!window.__ascent.panel?.open); if (opened) break; }
    if (i % 40 === 39) {
      const stuck = await page.evaluate(() => !!document.querySelector('.fcs.show'));
      if (stuck) { await page.keyboard.press('KeyR'); stucks++; await page.waitForTimeout(700); }
      else { // sidestep an obstacle the way a person does
        await page.keyboard.down('KeyD'); await page.keyboard.press('Space'); await page.waitForTimeout(700); await page.keyboard.up('KeyD'); }
    }
  }
  if (held) { await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft'); }
  return { ...target, opened, walkMs: Date.now() - t0, stucks };
};

const events = []; const modes = new Set(), forms = new Set(), skills = new Set(), scenes = new Set();
let rifts = 0, items = 0, wrongs = 0, ended = null;
const t0 = Date.now();

while (rifts < MAX_RIFTS && (Date.now() - t0) / 1000 < BUDGET) {
  const w = await wander(rifts === 0 ? 30 : WANDER, `pre-rift${rifts + 1}`);
  if (w === 'resolution' || w === 'rest') { ended = w; break; }
  let target = null;
  if (w !== 'rift') {
    target = await walkToRift();
    if (!target) { say('[world] nothing to walk to'); break; }
    if (!target.opened) { say(`[world] COULD NOT REACH/OPEN ${target.id} after ${Math.round(target.walkMs / 1000)}s (dist started ${Math.round(target.dist)}m, stucks ${target.stucks})`); await shot('cannot-reach'); break; }
    say(`\n=== RIFT ${rifts + 1} ${target.id} — ${Math.round(target.dist)}m, ${Math.round(target.walkMs / 1000)}s run, ${target.stucks} stuck ===`);
  } else say(`\n=== RIFT ${rifts + 1} (walked into it while wandering) ===`);
  rifts++;
  for (let line = 0; line < 10; line++) {
    const still = await page.evaluate(() => !!window.__ascent.panel?.open);
    if (!still) break;
    const b = await page.evaluate(() => {
      const a = window.__ascent, it = a.panel.item;
      return { mode: a.panel.mode, form: it?.form, rep: it?.rep, scene: it?.scene, skill: a.panel.skillId || it?.skill,
               prompt: (it?.prompt || '').slice(0, 120), answer: it?.answer,
               head: (document.querySelector('.rift')?.innerText || '').split('\n').slice(0, 4).join(' ') };
    });
    modes.add(b.mode); forms.add(b.form); if (b.skill) skills.add(b.skill); if (b.scene) scenes.add(b.scene);
    const beWrong = Math.random() > ACC;
    const r = await page.evaluate((wr) => {
      const a = window.__ascent, it = a.panel.item;
      let v = it.answer;
      if (wr) { const n = Number(it.answer); v = Number.isFinite(n) ? String(n + 1) : String(it.answer) + 'q'; }
      return a.enter(v);
    }, beWrong);
    items++; if (beWrong) wrongs++;
    say(`  [${b.mode}/${b.form}] ${b.skill} "${b.prompt}" =${b.answer} typed ${r?.entry}${beWrong ? ' WRONG' : ''} mis=${r?.misconception}`);
    if (beWrong && wrongs <= 3) {
      const fb = await page.evaluate(() => (document.querySelector('.rift')?.innerText || '').replace(/\n+/g, ' | ').slice(0, 900));
      say(`  RECOVERY: ${fb}`); await shot(`wrong${wrongs}`);
    }
    events.push({ rift: rifts, ...b, wrong: beWrong, mis: r?.misconception });
    await page.waitForTimeout(1100);
  }
  if (await page.evaluate(() => !!window.__ascent.panel?.open)) { await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
  await page.waitForTimeout(1500);
  const b = await brief();
  say(`  --> ${JSON.stringify(b)}`);
  if (rifts <= 2 || rifts % 4 === 0) await shot(`after-rift${rifts}`);
}

// give the session a chance to resolve
if (!ended) { const w = await wander(45, 'tail'); if (w === 'resolution' || w === 'rest') ended = w; }

const end = await brief();
say(`\n[end day${DAY}] rifts=${rifts} items=${items} wrongs=${wrongs} wall=${Math.round((Date.now() - t0) / 1000)}s ended=${ended}`);
say(`[end] modes=${[...modes].join(',')} | forms=${[...forms].join(',')} | skills=${[...skills].join(',')} | scenes=${scenes.size}`);
say(`[end] ${JSON.stringify(end)}`);
const hud = await page.evaluate(() => (document.getElementById('ui')?.innerText || '').replace(/\n+/g, ' | ').slice(0, 1200));
say(`[end HUD] ${hud}`);
await shot('end');
// open the progress screen the way a player would
await page.keyboard.press('KeyP'); await page.waitForTimeout(1500); await shot('progress');
const prog = await page.evaluate(() => (document.querySelector('.rep, .report, [class*="report"]')?.innerText || document.body.innerText).replace(/\n+/g, ' | ').slice(0, 1500));
say(`[progress] ${prog}`);
say(`[errors] ${errors.length}: ${errors.slice(0, 5).join(' | ')}`);
await writeFile(path.join(OUT, 'play.json'), JSON.stringify({ log, events, end, errors }, null, 2));
await writeFile(path.join(OUT, 'play.txt'), log.join('\n'));
await ctx.close();
