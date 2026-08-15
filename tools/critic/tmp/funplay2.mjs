/**
 * Fun-critic driver, take 2. Plays like a person: looks around first, lets the
 * opening beat land, then works the loop until the session resolves.
 *
 *   node tools/critic/tmp/funplay2.mjs --out shots/fun-s2 --day 1 --keep
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4577');
const OUT = path.resolve(arg('out', 'shots/fun-s2'));
const DAY = Number(arg('day', 0));
const KEEP = process.argv.includes('--keep');
const LOAF = Number(arg('loaf', 32));
const MAX_RIFTS = Number(arg('rifts', 20));
const ACC = Number(arg('acc', 0.85));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, storageState: KEEP && process.env.STATE ? process.env.STATE : undefined });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const log = [];
const say = (s) => { log.push(s); console.log(s); };
let shotN = 0;
const shot = async (n) => { await page.screenshot({ path: path.join(OUT, `${String(shotN++).padStart(2, '0')}-${n}.png`) }); };

await page.goto(URL, { waitUntil: 'networkidle' });
if (!KEEP) { await page.evaluate(() => { try { localStorage.clear(); } catch {} }); await page.reload({ waitUntil: 'networkidle' }); }
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(3000);
if (DAY > 0) {
  const w = await page.evaluate((d) => window.__ascent.advanceDays(d), DAY);
  say(`[clock] +${DAY}d -> watch=${JSON.stringify(w.watch)}`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
  await page.waitForTimeout(3000);
}

const brief = () => page.evaluate(() => {
  const a = window.__ascent, s = a.state();
  const sk = {};
  for (const [k, v] of Object.entries(s.skills || {})) sk[k] = { pL: +(v.pL || 0).toFixed(2), mastered: !!v.mastered, att: v.attempts, ok: v.correct, diff: v.difficulty, due: v.dueAt, durable: v.durable };
  return {
    shards: s.shards, fps: Math.round(s.fps), phase: s.session?.phase, run: s.session?.run,
    kit: { lines: s.kit.lines, held: s.kit.held, next: s.kit.next, charters: s.kit.charters, beacons: s.kit.beacons, stations: s.kit.stations, affordable: s.kit.affordable, sounding: s.kit.sounding, move: s.kit.move },
    caches: { total: s.caches.total, opened: s.caches.opened },
    drift: s.drift, watch: a.watch(), objective: a.nextObjective(), skills: sk,
  };
});

say(`[boot] ${JSON.stringify(await brief())}`);
await shot('boot');

// --- LOAF: a teenager pokes at the world for half a minute -----------------
await page.mouse.move(800, 450); await page.mouse.click(800, 450);
await page.waitForTimeout(300);
const loafEnd = Date.now() + LOAF * 1000;
let loafShots = 0;
while (Date.now() < loafEnd) {
  await page.keyboard.down('KeyW');
  await page.mouse.move(800 + (Math.random() - 0.5) * 400, 450, { steps: 3 });
  await page.keyboard.press('Space');
  await page.waitForTimeout(450);
  await page.keyboard.down('Space'); await page.waitForTimeout(900); await page.keyboard.up('Space'); // glide
  await page.keyboard.press('KeyC'); // dash
  await page.waitForTimeout(500);
  await page.keyboard.up('KeyW');
  const open = await page.evaluate(() => !!window.__ascent.panel?.open);
  if (open) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
  if (loafShots < 3) { await shot(`loaf${loafShots++}`); }
  await page.waitForTimeout(1200);
}
const afterLoaf = await page.evaluate(() => {
  const a = window.__ascent, s = a.state();
  return { phase: s.session.phase, run: s.session.run, charterVisible: !!document.querySelector('.ses-charter.show'), cardText: (document.querySelector('.ses-charter.show')?.innerText || '').replace(/\n/g, ' | ') };
});
say(`[loaf] ${JSON.stringify(afterLoaf)}`);
await shot('after-loaf');

// take the orders the way a player does
if (afterLoaf.charterVisible) { await page.keyboard.press('Enter'); await page.waitForTimeout(1200); }
say(`[post-charter] ${JSON.stringify((await brief()).run)} phase=${(await brief()).phase}`);

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
  let held = false, opened = false; const t0 = Date.now();
  for (let i = 0; i < 320; i++) {
    const err = await page.evaluate((t) => {
      const a = window.__ascent, p = a.player.pos;
      const want = Math.atan2(t.x - p.x, t.z - p.z);
      let d = ((want - a.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (d < -Math.PI) d += Math.PI * 2;
      return { d, dist: Math.hypot(t.x - p.x, t.z - p.z) };
    }, target);
    if (Math.abs(err.d) > 0.06) await page.mouse.move(800 - err.d * 240, 450, { steps: 2 });
    if (!held) { await page.keyboard.down('KeyW'); held = true; }
    await page.waitForTimeout(110);
    opened = await page.evaluate(() => !!window.__ascent.panel?.open);
    if (opened) break;
    if (err.dist < 4) { await page.keyboard.press('KeyE'); await page.waitForTimeout(400); opened = await page.evaluate(() => !!window.__ascent.panel?.open); if (opened) break; }
  }
  if (held) await page.keyboard.up('KeyW');
  return { ...target, opened, walkMs: Date.now() - t0 };
};

const events = [];
let rifts = 0, items = 0, wrongs = 0;
let lastResolutionSeen = false;
const modesSeen = new Set(), formsSeen = new Set(), skillsSeen = new Set();

while (rifts < MAX_RIFTS) {
  // a resolution / rest beat?
  const beat = await page.evaluate(() => {
    const r = document.querySelector('.ses-resolution.show'), rest = document.querySelector('.ses-rest.show');
    return { res: r ? (r.innerText || '').replace(/\n+/g, ' | ') : null, rest: rest ? (rest.innerText || '').replace(/\n+/g, ' | ') : null };
  });
  if (beat.res || beat.rest) {
    say(`\n***** SESSION BEAT *****\n${beat.res || ''}\n${beat.rest || ''}`);
    await shot(beat.res ? 'resolution' : 'rest');
    lastResolutionSeen = true;
    break;
  }

  const open = await page.evaluate(() => !!window.__ascent.panel?.open);
  let target = null;
  if (!open) {
    target = await walkToRift();
    if (!target) { say('[world] nothing left to walk to'); break; }
    if (!target.opened) { say(`[world] failed to open ${target.id}`); break; }
  }
  rifts++;
  say(`\n=== RIFT ${rifts} ${target ? target.id + ' (' + Math.round(target.dist) + 'm, walk ' + Math.round(target.walkMs / 1000) + 's)' : '(chained)'} ===`);
  for (let line = 0; line < 10; line++) {
    const still = await page.evaluate(() => !!window.__ascent.panel?.open);
    if (!still) break;
    const b = await page.evaluate(() => {
      const a = window.__ascent, it = a.panel.item;
      return { mode: a.panel.mode, form: it?.form, rep: it?.rep, skill: a.panel.skillId || it?.skill, prompt: (it?.prompt || '').slice(0, 130), answer: it?.answer,
               chrome: (document.querySelector('.rift-head, .rf-head')?.innerText || '').replace(/\n/g, ' ') };
    });
    modesSeen.add(b.mode); formsSeen.add(b.form); if (b.skill) skillsSeen.add(b.skill);
    const beWrong = Math.random() > ACC || (rifts === 1 && line === 0);
    const r = await page.evaluate((w) => {
      const a = window.__ascent, it = a.panel.item;
      let v = it.answer;
      if (w) { const n = Number(it.answer); v = Number.isFinite(n) ? String(n + 1) : String(it.answer) + 'q'; }
      return a.enter(v);
    }, beWrong);
    items++; if (beWrong) wrongs++;
    say(`  [${b.mode}/${b.form}/${b.rep}] ${b.skill} :: "${b.prompt}" ans=${b.answer} typed=${r?.entry}${beWrong ? ' WRONG' : ''} mis=${r?.misconception}`);
    events.push({ rift: rifts, ...b, wrong: beWrong });
    await page.waitForTimeout(1000);
  }
  const stillOpen = await page.evaluate(() => !!window.__ascent.panel?.open);
  if (stillOpen) { await page.keyboard.press('Escape'); await page.waitForTimeout(500); }
  await page.waitForTimeout(1600);
  const b = await brief();
  say(`  --> shards=${b.shards} phase=${b.phase} run=${JSON.stringify(b.run)} kit.lines=${b.kit.lines} held=${JSON.stringify(b.kit.held)} next=${b.kit.next} caches=${b.caches.opened}/${b.caches.total} sounding=${JSON.stringify(b.kit.sounding)}`);
  say(`  --> objective=${JSON.stringify(b.objective)} watch=${JSON.stringify(b.watch)}`);
  if (rifts % 3 === 0 || rifts <= 2) await shot(`rift${rifts}`);
}

const end = await brief();
say(`\n[end] rifts=${rifts} items=${items} wrongs=${wrongs} resolutionSeen=${lastResolutionSeen}`);
say(`[end] modes=${[...modesSeen].join(',')}`);
say(`[end] forms=${[...formsSeen].join(',')}`);
say(`[end] skills=${[...skillsSeen].join(',')}`);
say(`[end] ${JSON.stringify(end)}`);
const hud = await page.evaluate(() => (document.getElementById('ui')?.innerText || '').slice(0, 900));
say(`[end] HUD:\n${hud}`);
await shot('end');
say(`[errors] ${errors.length}: ${errors.slice(0, 5).join(' | ')}`);
await writeFile(path.join(OUT, 'play.json'), JSON.stringify({ log, events, end, errors }, null, 2));
await writeFile(path.join(OUT, 'play.txt'), log.join('\n'));
await browser.close();
