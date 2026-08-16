/**
 * w12-fun: an outside critic's five-session play.
 *
 * Drives the REAL game with real keys. Between sittings it moves the wall clock
 * with advanceDays (the only writer) and re-enters, so sessions 2..5 are real
 * returns, not a rerun of session 1. Records, per session, everything a player
 * could notice as different: unlocked rifts, skills held, kit owned, caches,
 * wardens, chapter/rank, objective text, HUD text, and the whole set of item
 * FORMS the game actually served.
 *
 *   node tools/critic/w12fun.mjs --url http://127.0.0.1:4788 --out shots/w12-fun-play
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4788');
const OUT = path.resolve(arg('out', 'shots/w12-fun-play'));
const SESSIONS = Number(arg('sessions', 5));
const ITEMS_PER = Number(arg('items', 14));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
const errors = [];
const notfound = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('response', (r) => { if (r.status() === 404) notfound.push(r.url()); });

const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) });
const log = [];
const say = (s) => { console.log(s); log.push(s); };

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4500);

// ---------------------------------------------------------------------------
const snapshotState = () => page.evaluate(() => {
  const a = window.__ascent;
  const s = a.state();
  const rifts = (a.rifts?.list ?? []).map((r) => ({ id: r.id, locked: !!r.locked, sealed: !!r.sealed }));
  const skills = s.skills || {};
  const held = Object.entries(skills).filter(([, v]) => v && v.mastered).map(([k]) => k);
  const seen = Object.keys(skills);
  let kit = {}, caches = {}, wardens = {};
  try { kit = a.kit.state(); } catch {}
  try { caches = a.caches.state(); } catch {}
  try { wardens = a.wardens.state(); } catch {}
  return {
    ui: (document.getElementById('ui')?.innerText || '').replace(/\s+/g, ' ').trim(),
    rank: s.rank ?? null, chapter: s.chapter ?? null,
    repaired: s.repaired ?? null, motes: s.motes ?? s.wallet ?? null,
    heldCount: held.length, held, seenCount: seen.length,
    unlockedRifts: rifts.filter((r) => !r.locked).length,
    sealedRifts: rifts.filter((r) => r.sealed).length,
    totalRifts: rifts.length,
    kit, caches, wardens,
    session: s.session ?? null,
    watch: a.watch ? a.watch() : null,
    fps: s.fps,
  };
});

// Answer whatever is on the card, correctly, through the real input surface
// where possible; fall back to the panel's own commit only when the surface is
// a drag-and-drop field a script cannot mouse reliably.
const answerCard = (kind = 'right') => page.evaluate(async (k) => {
  const a = window.__ascent;
  const p = a.panel;
  if (!p?.open || !p.item) return { ok: false, why: 'no card' };
  const before = a.panelInfo();
  try {
    const r = await p.demo(k);
    return { ok: r !== false, via: 'demo:' + k, info: before };
  } catch (e) { return { ok: false, why: String(e), info: before }; }
});

const sessions = [];

for (let day = 1; day <= SESSIONS; day++) {
  say(`\n================ SESSION ${day} ================`);
  const opening = await snapshotState();
  await shot(`s${day}-a-open`);
  say(`open: rank=${opening.rank} chapter=${JSON.stringify(opening.chapter)} held=${opening.heldCount} unlocked=${opening.unlockedRifts}/${opening.totalRifts} sealed=${opening.sealedRifts} motes=${opening.motes}`);
  say(`open ui: ${opening.ui.slice(0, 400)}`);
  say(`watch: ${JSON.stringify(opening.watch)}`);
  say(`kit: ${JSON.stringify(opening.kit).slice(0, 300)}`);
  say(`caches: ${JSON.stringify(opening.caches).slice(0, 300)}`);
  say(`wardens: ${JSON.stringify(opening.wardens).slice(0, 300)}`);

  // --- do real work: walk to rifts with keys, answer what is served ---
  const forms = [];
  const skillsServed = [];
  const reprobes = [];
  let opened = 0, answered = 0;
  await page.mouse.click(800, 450);
  await page.waitForTimeout(300);

  for (let i = 0; i < ITEMS_PER; i++) {
    const isOpen = await page.evaluate(() => !!window.__ascent.panel?.open);
    if (!isOpen) {
      // walk to the nearest unlocked, unsealed rift with W + mouse
      const target = await page.evaluate(() => {
        const a = window.__ascent;
        const list = (a.rifts?.list ?? []).filter((x) => !x.locked && !x.sealed);
        if (!list.length) return null;
        const p = a.player.pos; let best = null, bd = 1e9;
        for (const x of list) { const d = Math.hypot(x.pos.x - p.x, x.pos.z - p.z); if (d < bd) { bd = d; best = x; } }
        return best ? { id: best.id, x: best.pos.x, z: best.pos.z, dist: bd } : null;
      });
      if (!target) { say(`  no unlocked+unsealed rift left at item ${i}`); break; }
      let held = false, arrived = false;
      for (let k = 0; k < 300 && !arrived; k++) {
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
        if (await page.evaluate(() => !!window.__ascent.panel?.open)) arrived = true;
        else if (err.dist < 4) arrived = true;
      }
      if (held) await page.keyboard.up('KeyW');
      if (!(await page.evaluate(() => !!window.__ascent.panel?.open))) {
        for (const key of ['KeyE', 'KeyF', 'Enter']) {
          await page.keyboard.press(key); await page.waitForTimeout(400);
          if (await page.evaluate(() => !!window.__ascent.panel?.open)) break;
        }
      }
      if (!(await page.evaluate(() => !!window.__ascent.panel?.open))) { say(`  could not open a rift at item ${i}`); break; }
      opened++;
    }
    // Play like a learner: right most of the time, but miss the 3rd item of
    // every session on purpose so the recovery path is exercised for real.
    const kind = (i === 2) ? 'wrong' : 'right';
    let r = await answerCard(kind);
    if (kind === 'wrong') {
      await page.waitForTimeout(1400);
      await shot(`s${day}-b2-wrong`);
      const stillOpen = await page.evaluate(() => !!window.__ascent.panel?.open);
      if (stillOpen) { await page.waitForTimeout(600); r = await answerCard('right'); }
    }
    if (r.info?.open) {
      forms.push(r.info.form);
      skillsServed.push(r.info.skill);
      if (r.info.reprobe) reprobes.push(r.info.reprobe);
      if (r.info.masteredWhenServed) reprobes.push('mastered-when-served:' + r.info.skill);
    }
    if (r.ok) answered++;
    await page.waitForTimeout(1100);
    if (i === 1) await shot(`s${day}-b-card`);
  }

  // close whatever is up, hand the frame back
  for (let i = 0; i < 6; i++) {
    if (!(await page.evaluate(() => !!window.__ascent.input?.uiOpen))) break;
    await page.keyboard.press('Escape'); await page.waitForTimeout(400);
  }
  await page.waitForTimeout(1500);
  await shot(`s${day}-c-after`);

  const closing = await snapshotState();
  say(`worked: opened=${opened} answered=${answered}`);
  say(`forms served: ${JSON.stringify([...new Set(forms)])}`);
  say(`skills served: ${JSON.stringify([...new Set(skillsServed)])}`);
  say(`reprobes: ${JSON.stringify([...new Set(reprobes)])}`);
  say(`close: rank=${closing.rank} chapter=${JSON.stringify(closing.chapter)} held=${closing.heldCount} unlocked=${closing.unlockedRifts} sealed=${closing.sealedRifts} motes=${closing.motes} repaired=${closing.repaired}`);
  say(`close ui: ${closing.ui.slice(0, 500)}`);
  say(`close kit: ${JSON.stringify(closing.kit).slice(0, 400)}`);
  say(`close caches: ${JSON.stringify(closing.caches).slice(0, 400)}`);
  say(`close wardens: ${JSON.stringify(closing.wardens).slice(0, 400)}`);

  // open the progress/report a player would look at before leaving
  try {
    await page.evaluate(() => { try { window.__ascent.report.open(); } catch {} });
    await page.waitForTimeout(1200);
    await shot(`s${day}-d-report`);
    const rep = await page.evaluate(() => (document.getElementById('ui')?.innerText || '').replace(/\s+/g, ' ').trim());
    say(`report: ${rep.slice(0, 600)}`);
    for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); }
  } catch (e) { say('report open failed: ' + e); }

  sessions.push({ day, opening, closing, forms: [...new Set(forms)], skills: [...new Set(skillsServed)], reprobes: [...new Set(reprobes)], opened, answered });

  if (day < SESSIONS) {
    const adv = await page.evaluate(() => window.__ascent.advanceDays(1));
    say(`--- advanced to next day: ${JSON.stringify(adv)} ---`);
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
    await page.waitForTimeout(4500);
  }
}

say(`\nconsole errors: ${errors.length}`);
errors.slice(0, 10).forEach((e) => say('  ! ' + e));
say(`404s (${notfound.length}): ${JSON.stringify([...new Set(notfound)].slice(0, 12))}`);

await writeFile(path.join(OUT, 'play.json'), JSON.stringify({ sessions, errors, notfound: [...new Set(notfound)] }, null, 2));
await writeFile(path.join(OUT, 'play.log'), log.join('\n'));
await browser.close();
