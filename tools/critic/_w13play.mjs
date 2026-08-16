/**
 * A fifteen-year-old plays. Real keys, real minutes, real pixels.
 *
 * Session 1 for nine minutes with frames at minute 1/3/5/8, then four nights
 * pass and session 5 is played the same way. Nothing is teleported.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/w13-play'));
const MINUTES = Number(arg('minutes', 9));
const TAG = arg('tag', 's1');
const SEED = arg('seed', '');   // 'late' -> advance 4 days before playing
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
    '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const log = [];
const say = (s) => { console.log(s); log.push(s); };

await page.goto(URL, { waitUntil: 'networkidle' });
if (!SEED) await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 45000 });
await page.waitForTimeout(4000);

// --- Nights 1..4: play them fast, the honest way, so session 5 is a real save.
if (SEED === 'late') {
  for (let day = 1; day <= 4; day++) {
    let served = 0;
    for (let i = 0; i < 26; i++) {
      const did = await page.evaluate(async (n) => {
        const a = window.__ascent;
        const open = a.rifts.list.filter((r) => !r.locked);
        if (!open.length) return null;
        a.openRiftById(open[n % open.length].id);
        await new Promise((r) => setTimeout(r, 260));
        const info = a.panelInfo();
        if (!info.open) return null;
        // a real kid is right about 85% of the time on a held line
        a.enter(n % 7 === 5 ? 'zzz' : info.answer);
        await new Promise((r) => setTimeout(r, 420));
        try { a.panel.close?.(); } catch {}
        return { skill: info.skill };
      }, i);
      if (!did) break;
      served++;
      await page.waitForTimeout(120);
    }
    const w = await page.evaluate((d) => window.__ascent.advanceDays(1), day);
    say(`  night ${day}: ${served} items, clock +1d, due=${w.watch?.due ?? '?'}`);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__ascent, null, { timeout: 45000 });
    await page.waitForTimeout(3000);
  }
}

const facts = () => page.evaluate(() => {
  const a = window.__ascent, s = a.state();
  return {
    t: Date.now(), pos: [a.player.pos.x | 0, a.player.pos.y | 0, a.player.pos.z | 0],
    motes: s.kit?.motes ?? s.drift?.motes ?? null,
    drift: s.drift, caches: s.caches, kit: s.kit, wardens: s.wardens,
    session: s.session, fps: Math.round(s.fps),
    mastered: Object.values(s.skills || {}).filter((x) => x.mastered).length,
    skillsSeen: Object.keys(s.skills || {}).length,
    panel: a.panelInfo(),
    hudText: (document.getElementById('ui')?.innerText || '').replace(/\s+/g, ' ').slice(0, 900),
  };
});

const shot = async (n) => { await page.screenshot({ path: path.join(OUT, `${TAG}-${n}.png`) }); };

// pointer lock is usually refused headless; the game says so and arrows work.
await page.mouse.click(800, 450);
await page.waitForTimeout(400);

const t0 = Date.now();
const el = () => (Date.now() - t0) / 1000;
const marks = [60, 180, 300, 480];
const taken = new Set();
const served = [];        // every item the game put in front of us
const between = [];       // what happened between rifts

const blockers = [];
const dismiss = async () => {
  for (let i = 0; i < 8; i++) {
    const open = await page.evaluate(() => {
      const a = window.__ascent;
      return !!a.input.uiOpen && !a.panel?.open;
    });
    if (!open) return;
    const clicked = await page.evaluate(() => {
      const re = /BEGIN|CONTINUE|GOT IT|RESUME|ONWARD|NEXT|BACK TO|STEP BACK|RECOVER|CLOSE|DISMISS|RETURN|RUN ON|RIGHT/i;
      const btns = [...document.querySelectorAll('button, [role=button], .btn')]
        .filter((b) => b.offsetParent && re.test(b.innerText || ''));
      if (btns.length) { const s = (btns[0].innerText || '').trim(); btns[0].click(); return s; }
      return null;
    });
    if (clicked) blockers.push(`${Math.round(el())}s "${clicked}"`);
    else await page.keyboard.press('Escape');
    await page.waitForTimeout(450);
  }
};

let lastSeal = 0;
while (el() < MINUTES * 60) {
  // marks
  for (const m of marks) {
    if (el() >= m && !taken.has(m)) {
      taken.add(m);
      const f = await facts();
      await shot(`min${Math.round(m / 60)}`);
      say(`[${TAG} min ${Math.round(m / 60)}] motes=${f.motes} mastered=${f.mastered}/${f.skillsSeen} `
        + `drift=${JSON.stringify(f.drift)} caches=${JSON.stringify(f.caches)} `
        + `wardens=${JSON.stringify(f.wardens)} fps=${f.fps}`);
      say(`   HUD: ${f.hudText.slice(0, 320)}`);
    }
  }

  await dismiss();
  // travel frames: what the world looks like between two rifts
  for (const m of [100, 260, 450]) {
    if (el() >= m && !taken.has('t' + m)) {
      const open = await page.evaluate(() => !!window.__ascent.panel?.open);
      if (!open) {
        taken.add('t' + m);
        await shot(`travel${Math.round(m)}`);
        const f = await facts();
        say(`[${TAG} travel ${m}s] pos=${f.pos} motes=${f.motes} HUD: ${f.hudText.slice(0, 260)}`);
      }
    }
  }
  const st = await page.evaluate(() => {
    const a = window.__ascent;
    if (a.panel?.open) return { panel: true };
    const p = a.player.pos;
    const r = a.rifts.list.filter((x) => !x.locked);
    let best = null, bd = 1e9;
    for (const x of r) { const d = Math.hypot(x.pos.x - p.x, x.pos.z - p.z); if (d < bd) { bd = d; best = x; } }
    return { panel: false, target: best ? { id: best.id, x: best.pos.x, z: best.pos.z, dist: bd, skill: best.skill } : null };
  });

  if (st.panel) {
    const info = await page.evaluate(() => window.__ascent.panelInfo());
    // a real teen gets some wrong.
    const wrong = served.length % 5 === 3;
    const res = await page.evaluate((w) => {
      const a = window.__ascent; const i = a.panelInfo();
      const val = w ? (Number(i.answer) + 2 || 'x') : i.answer;
      return a.enter(val);
    }, wrong);
    served.push({ at: Math.round(el()), skill: info.skill, form: info.form, mode: info.mode,
      kind: info.kind, wrong, masteredWhenServed: info.masteredWhenServed });
    await page.waitForTimeout(1100);
    await page.evaluate(() => { try { window.__ascent.panel.close?.(); } catch {} });
    await page.waitForTimeout(400);
    const f = await facts();
    if (f.motes !== lastSeal) { lastSeal = f.motes; }
    continue;
  }

  if (!st.target) { await page.waitForTimeout(500); continue; }

  // walk, with arrows for yaw (pointer lock refused headless)
  const err = await page.evaluate((t) => {
    const a = window.__ascent, p = a.player.pos;
    const want = Math.atan2(t.x - p.x, t.z - p.z);
    let d = ((want - a.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
    if (d < -Math.PI) d += Math.PI * 2;
    return { d, dist: Math.hypot(t.x - p.x, t.z - p.z) };
  }, st.target);
  // ArrowRight DECREASES yaw (measured: -1.21 rad/s), so a positive error turns left.
  if (Math.abs(err.d) > 0.12) {
    if (Math.abs(err.d) > 0.9) await page.keyboard.up('KeyW');   // stop, look, then go
    await page.keyboard.down(err.d > 0 ? 'ArrowLeft' : 'ArrowRight');
    await page.waitForTimeout(Math.min(700, Math.abs(err.d) * 830));
    await page.keyboard.up('ArrowRight'); await page.keyboard.up('ArrowLeft');
  }
  await page.keyboard.down('ShiftLeft');
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(700);
  // a person presses E when they are AT the ring, not every second on the way
  if (err.dist < 9) { await page.keyboard.press('KeyE'); await page.waitForTimeout(60); }
  // and hops rather than sprinting off a lip
  if (err.dist > 20) { await page.keyboard.press('Space'); }
}
await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');

const end = await facts();
await shot('end');
say(`[${TAG} END ${MINUTES}min] items=${served.length} motes=${end.motes} `
  + `mastered=${end.mastered}/${end.skillsSeen}`);
say(`  drift=${JSON.stringify(end.drift)}`);
say(`  caches=${JSON.stringify(end.caches)}`);
say(`  wardens=${JSON.stringify(end.wardens)}`);
say(`  kit=${JSON.stringify(end.kit)}`);
say(`  session=${JSON.stringify(end.session)}`);
say(`  forms served: ${JSON.stringify(served.map((s) => `${s.at}s ${s.skill}/${s.form}/${s.mode}`))}`);
const modes = {}; for (const s of served) modes[s.mode] = (modes[s.mode] | 0) + 1;
say(`  surface mix: ${JSON.stringify(modes)}`);
const skills = {}; for (const s of served) skills[s.skill] = (skills[s.skill] | 0) + 1;
say(`  skill mix: ${JSON.stringify(skills)}`);
say(`  re-served an already-mastered skill: ${served.filter((s) => s.masteredWhenServed).length}`);
say(`  console errors: ${errors.length}${errors.length ? ' :: ' + errors.slice(0, 3).join(' | ') : ''}`);
say(`  full-screen cards I had to dismiss (${blockers.length}): ${JSON.stringify(blockers.slice(0, 40))}`);
say(`  ledger: ${JSON.stringify(await page.evaluate(() => window.__ascent.ledger().slice(0, 14)))}`);

await writeFile(path.join(OUT, `${TAG}-log.txt`), log.join('\n'));
await browser.close();
