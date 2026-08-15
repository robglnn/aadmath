/**
 * Independent fun-critic driver. Plays the real game as a teenager would:
 * walks with keys, opens rifts by touch, answers with real hands (sometimes
 * wrong on purpose), and reports what the world gives back.
 *
 *   node tools/critic/tmp/funplay.mjs --url http://127.0.0.1:4577 --out shots/fun-s1 --day 0 --minutes 20
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4577');
const OUT = path.resolve(arg('out', 'shots/fun-s1'));
const DAY = Number(arg('day', 0));
const FRESH = !process.argv.includes('--keep');
const SKILL_ACC = Number(arg('acc', 0.8)); // how often our teenager is right
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('PAGEERR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const log = [];
const say = (s) => { log.push(s); console.log(s); };
let shotN = 0;
const shot = async (name) => { await page.screenshot({ path: path.join(OUT, `${String(shotN++).padStart(2, '0')}-${name}.png`) }); };

await page.goto(URL, { waitUntil: 'networkidle' });
if (FRESH) {
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
}
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(3500);

if (DAY > 0) {
  const w = await page.evaluate((d) => window.__ascent.advanceDays(d), DAY);
  say(`[clock] advanced ${DAY} day(s) -> ${JSON.stringify(w.watch)}`);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
  await page.waitForTimeout(3500);
}

const snap = () => page.evaluate(() => {
  const a = window.__ascent; const s = a.state();
  return {
    shards: s.shards, motes: s.motes ?? s.wallet ?? null,
    session: s.session, drift: s.drift, caches: s.caches, kit: s.kit,
    fps: Math.round(s.fps), skills: s.skills,
    objective: a.nextObjective?.(),
    watch: a.watch?.(),
    hud: (document.getElementById('ui')?.innerText || '').slice(0, 1400),
  };
});

const t0 = await snap();
say(`[open] objective=${JSON.stringify(t0.objective)}`);
say(`[open] session=${JSON.stringify(t0.session)}`);
say(`[open] kit=${JSON.stringify(t0.kit)} caches=${JSON.stringify(t0.caches)} drift=${JSON.stringify(t0.drift)}`);
say(`[open] watch=${JSON.stringify(t0.watch)}`);
say(`[open] HUD:\n${t0.hud}`);
await shot('open');

// dismiss whatever beat is up, the way a player does
for (let i = 0; i < 6; i++) {
  const dismissed = await page.evaluate(() => {
    const btns = [...document.querySelectorAll('button')].filter((b) => b.offsetParent && /begin|start|run|got it|continue|ok/i.test(b.textContent || ''));
    if (btns.length) { btns[0].click(); return btns[0].textContent.trim(); }
    return null;
  });
  if (!dismissed) break;
  say(`[beat] clicked "${dismissed}"`);
  await page.waitForTimeout(900);
}
await shot('after-beats');

// --- walk to rifts with keys, open by touch, answer with hands -------------
await page.mouse.move(800, 450); await page.mouse.click(800, 450);
await page.waitForTimeout(300);

const walkToNearestRift = async () => {
  const target = await page.evaluate(() => {
    const a = window.__ascent, p = a.player.pos;
    const r = (a.rifts?.list || []).filter((x) => !x.locked && !x.sealed);
    if (!r.length) return null;
    let best = null, bd = 1e9;
    for (const x of r) { const d = Math.hypot(x.pos.x - p.x, x.pos.z - p.z); if (d < bd) { bd = d; best = x; } }
    return { id: best.id, x: best.pos.x, z: best.pos.z, dist: bd, skill: best.skill };
  });
  if (!target) return null;
  let held = false, opened = false;
  for (let i = 0; i < 300; i++) {
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
  return { ...target, opened };
};

const answerOnce = async (deliberatelyWrong) => {
  const before = await page.evaluate(() => {
    const a = window.__ascent, it = a.panel.item;
    return { mode: a.panel.mode, form: it?.form, prompt: (it?.prompt || it?.stem || '').slice(0, 160), answer: it?.answer, skill: a.panel.skillId };
  });
  const res = await page.evaluate((wrong) => {
    const a = window.__ascent, it = a.panel.item;
    let v = it.answer;
    if (wrong) {
      const n = Number(it.answer);
      v = Number.isFinite(n) ? String(n + (Math.random() < 0.5 ? 1 : -2)) : String(it.answer) + 'x';
    }
    return a.enter(v);
  }, deliberatelyWrong);
  await page.waitForTimeout(1100);
  const after = await page.evaluate(() => ({
    open: !!window.__ascent.panel?.open,
    text: (document.querySelector('.rift')?.innerText || '').replace(/\n+/g, ' | ').slice(0, 700),
  }));
  return { before, res, after };
};

const events = [];
const startWall = Date.now();
let riftsPlayed = 0, wrongsMade = 0, sealed = 0;
const MAX_RIFTS = Number(arg('rifts', 14));

while (riftsPlayed < MAX_RIFTS) {
  const open = await page.evaluate(() => !!window.__ascent.panel?.open);
  let target = null;
  if (!open) {
    target = await walkToNearestRift();
    if (!target) { say('[world] no unlocked, unsealed rift to walk to'); break; }
    if (!target.opened) { say(`[world] could not open ${target.id}`); break; }
  }
  riftsPlayed++;
  const st = await page.evaluate(() => ({ id: window.__ascent.panel.riftId, skill: window.__ascent.panel.skillId }));
  say(`\n=== RIFT ${riftsPlayed} ${target ? target.id : ''} skill=${st.skill} ===`);
  if (riftsPlayed <= 2 || riftsPlayed === 6) await shot(`rift${riftsPlayed}-open`);

  // answer up to 8 lines inside this rift
  for (let line = 0; line < 8; line++) {
    const stillOpen = await page.evaluate(() => !!window.__ascent.panel?.open);
    if (!stillOpen) break;
    // teenager: mostly right, deliberately wrong at line 1 of rift 1 and rift 3
    const beWrong = (riftsPlayed === 1 && line === 0) || (riftsPlayed === 3 && line === 1) || (Math.random() > SKILL_ACC);
    const r = await answerOnce(beWrong);
    if (beWrong) wrongsMade++;
    say(`  [${r.before.mode}/${r.before.form}] "${r.before.prompt}" ans=${r.before.answer} -> typed ${r.res?.entry} ${beWrong ? '(WRONG on purpose)' : ''} misconception=${r.res?.misconception}`);
    if (beWrong) { say(`  FEEDBACK: ${r.after.text}`); if (wrongsMade <= 2) await shot(`wrong${wrongsMade}`); }
    events.push({ rift: riftsPlayed, ...r.before, wrong: beWrong, mis: r.res?.misconception });
    await page.waitForTimeout(400);
  }
  const closed = await page.evaluate(() => !!window.__ascent.panel?.open);
  if (closed) { await page.keyboard.press('Escape'); await page.waitForTimeout(600); }
  await page.waitForTimeout(1400);
  const s = await snap();
  sealed = s.session?.sealed ?? sealed;
  say(`  --> after: shards=${s.shards} session=${JSON.stringify(s.session)} kit=${JSON.stringify(s.kit)} caches=${JSON.stringify(s.caches)}`);
  if (riftsPlayed <= 3 || riftsPlayed % 4 === 0) await shot(`after-rift${riftsPlayed}`);

  // did a beat interrupt (resolution / rest / chapter)?
  const beat = await page.evaluate(() => {
    const el = [...document.querySelectorAll('.ses-charter, .ses-resolution, .ses-rest, .beat, .card')].filter((e) => e.offsetParent);
    return el.map((e) => e.className + ' :: ' + (e.innerText || '').replace(/\n+/g, ' | ').slice(0, 400));
  });
  if (beat.length) { say(`  [BEAT] ${beat.join(' || ')}`); await shot(`beat-rift${riftsPlayed}`); }
}

const end = await snap();
say(`\n[end] wall=${Math.round((Date.now() - startWall) / 1000)}s rifts=${riftsPlayed} wrongs=${wrongsMade}`);
say(`[end] state=${JSON.stringify({ shards: end.shards, session: end.session, kit: end.kit, caches: end.caches, drift: end.drift })}`);
say(`[end] skills=${JSON.stringify(end.skills)}`);
say(`[end] watch=${JSON.stringify(end.watch)}`);
say(`[end] objective=${JSON.stringify(end.objective)}`);
say(`[end] HUD:\n${end.hud}`);
await shot('end');
say(`[end] console errors: ${errors.length} ${errors.slice(0, 4).join(' | ')}`);

await writeFile(path.join(OUT, 'play.json'), JSON.stringify({ log, events, end, errors }, null, 2));
await writeFile(path.join(OUT, 'play.txt'), log.join('\n'));
await browser.close();
