/**
 * Day five. Continues the same save. Where running at the objective rift fails
 * (it did, three sittings out of four), it uses teleportTo to STAND NEXT TO the
 * ring and then opens it with the E key like anybody else — the traversal is
 * judged separately; this run is judging what day five has to offer.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4577');
const OUT = path.resolve(arg('out', 'shots/fun-day5'));
const PROFILE = arg('profile', '/tmp/ascent-profile');
const DAY = Number(arg('day', 1));
const RIFTS = Number(arg('rifts', 22));
await mkdir(OUT, { recursive: true });
const ctx = await chromium.launchPersistentContext(PROFILE, { args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist', '--disable-gpu-vsync'], viewport: { width: 1600, height: 900 } });
const page = ctx.pages()[0] || await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push('PAGEERR ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const log = []; const say = (s) => { log.push(s); console.log(s); };
let n = 0; const shot = async (t) => { await page.screenshot({ path: path.join(OUT, `${String(n++).padStart(2, '0')}-${t}.png`) }); };

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(2500);
say(`[clock] ${JSON.stringify(await page.evaluate((d) => window.__ascent.advanceDays(d), DAY))}`);
await page.waitForTimeout(1500);

const brief = () => page.evaluate(() => {
  const a = window.__ascent, s = a.state(); const sk = {};
  for (const [k, v] of Object.entries(s.skills || {})) if (v.attempts || v.mastered) sk[k] = `pL${(+v.pL).toFixed(2)}${v.mastered ? ' HELD' : ''} ${v.correct}/${v.attempts} d${v.difficulty} dur${v.durable}`;
  return { shards: s.shards, phase: s.session.phase, run: s.session.run && { tears: s.session.run.tears, target: s.session.run.target, focusMin: Math.round((s.session.run.focus || 0) / 6) / 10 },
    kit: { lines: s.kit.lines, held: s.kit.held, next: s.kit.next, glideMax: s.kit.move.glideMax, sprint: s.kit.move.sprint, kinds: s.kit.move.kinds, sounding: s.kit.sounding, beacons: s.kit.beacons, stations: s.kit.stations },
    caches: s.caches.opened + '/' + s.caches.total, drift: s.drift, watch: a.watch(), objective: a.nextObjective(), skills: sk };
});
say(`[day5 open] ${JSON.stringify(await brief())}`);
say(`[day5 HUD] ${await page.evaluate(() => (document.getElementById('ui')?.innerText || '').replace(/\n+/g, ' | ').slice(0, 800))}`);
await shot('open');
await page.mouse.move(800, 450); await page.mouse.click(800, 450); await page.waitForTimeout(400);

const modes = new Set(), forms = new Set(), skills = new Set();
let rifts = 0, items = 0, wrongs = 0;
for (; rifts < RIFTS; rifts++) {
  // take the orders if they are up
  if (await page.evaluate(() => !!document.querySelector('.ses-charter.show'))) {
    say(`[CHARTER] ${await page.evaluate(() => document.querySelector('.ses-charter.show').innerText.replace(/\n+/g, ' | '))}`);
    await shot('charter'); await page.keyboard.press('Enter'); await page.waitForTimeout(1200);
  }
  for (const sel of ['.ses-resolution.show', '.ses-rest.show']) {
    if (await page.evaluate((s) => !!document.querySelector(s), sel)) {
      say(`[BEAT ${sel}] ${await page.evaluate((s) => document.querySelector(s).innerText.replace(/\n+/g, ' | '), sel)}`);
      await shot(sel.includes('resolution') ? 'resolution' : 'rest');
      await page.keyboard.press('Enter'); await page.waitForTimeout(1500);
    }
  }
  let open = await page.evaluate(() => !!window.__ascent.panel?.open);
  if (!open) {
    const tgt = await page.evaluate(() => {
      const a = window.__ascent, p = a.player.pos;
      const r = a.rifts.list.filter((x) => !x.locked && !x.sealed);
      if (!r.length) return null;
      let b = null, bd = 1e9;
      for (const x of r) { const d = Math.hypot(x.pos.x - p.x, x.pos.z - p.z); if (d < bd) { bd = d; b = x; } }
      return { id: b.id, d: Math.round(bd) };
    });
    if (!tgt) { say('[world] nothing unlocked left'); break; }
    await page.evaluate((id) => window.__ascent.teleportTo(id), tgt.id);
    await page.waitForTimeout(700);
    for (const k of ['KeyE', 'KeyE', 'KeyW']) { await page.keyboard.press(k); await page.waitForTimeout(500); if (await page.evaluate(() => !!window.__ascent.panel?.open)) break; }
    open = await page.evaluate(() => !!window.__ascent.panel?.open);
    say(`\n=== RIFT ${rifts + 1} ${tgt.id} (was ${tgt.d}m off) opened=${open} ===`);
    if (!open) { await page.waitForTimeout(1200); open = await page.evaluate(() => !!window.__ascent.panel?.open); if (!open) { say('  could not open even standing on it'); continue; } }
  } else say(`\n=== RIFT ${rifts + 1} (chained) ===`);
  for (let line = 0; line < 10; line++) {
    if (!(await page.evaluate(() => !!window.__ascent.panel?.open))) break;
    const b = await page.evaluate(() => {
      const a = window.__ascent, it = a.panel.item;
      return { mode: a.panel.mode, form: it?.form, rep: it?.rep, skill: a.panel.skillId || it?.skill, prompt: (it?.prompt || '').slice(0, 110), answer: String(it?.answer).slice(0, 40) };
    });
    modes.add(b.mode); forms.add(b.form); if (b.skill) skills.add(b.skill);
    const wrong = Math.random() > 0.85;
    const r = await page.evaluate((w) => {
      const a = window.__ascent, it = a.panel.item; let v = it.answer;
      if (w) { const num = Number(it.answer); v = Number.isFinite(num) ? String(num + 1) : String(it.answer) + '1'; }
      return a.enter(v);
    }, wrong);
    items++; if (wrong) wrongs++;
    say(`  [${b.mode}/${b.form}] ${b.skill} "${b.prompt}" =${b.answer}${wrong ? ' WRONG' : ''} mis=${r?.misconception}`);
    if (['balance', 'sort', 'area', 'choice', 'plot'].includes(b.mode) && !global['s_' + b.mode]) { global['s_' + b.mode] = 1; await shot(`mode-${b.mode}`); }
    await page.waitForTimeout(900);
  }
  if (await page.evaluate(() => !!window.__ascent.panel?.open)) { await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
  await page.waitForTimeout(1000);
  if (rifts % 5 === 0) { say(`  --> ${JSON.stringify(await brief())}`); await shot(`rift${rifts + 1}`); }
}
say(`\n[day5] rifts=${rifts} items=${items} wrongs=${wrongs}`);
say(`[day5] modes=${[...modes].join(',')}`);
say(`[day5] forms=${[...forms].join(',')}`);
say(`[day5] skills=${[...skills].join(',')}`);
say(`[day5] ${JSON.stringify(await brief())}`);
await shot('before-close');

// Force the run's own ending — the shipped hook, the real resolution.
say('[close] driving the real close…');
await page.evaluate(() => window.__ascent.session.skipToClose());
await page.waitForTimeout(3000);
const res = await page.evaluate(() => {
  const el = document.querySelector('.ses-resolution');
  return el ? { show: el.classList.contains('show'), text: (el.innerText || '').replace(/\n+/g, ' | ') } : null;
});
say(`[RESOLUTION] ${JSON.stringify(res)}`);
await shot('resolution');
await page.keyboard.press('Enter'); await page.waitForTimeout(2500);
const rest = await page.evaluate(() => {
  const el = document.querySelector('.ses-rest');
  return el ? { show: el.classList.contains('show'), text: (el.innerText || '').replace(/\n+/g, ' | ') } : null;
});
say(`[REST] ${JSON.stringify(rest)}`);
await shot('rest');
await page.waitForTimeout(4000); await shot('rest2');
say(`[after] ${JSON.stringify(await brief())}`);
say(`[errors] ${errors.length}: ${errors.slice(0, 5).join(' | ')}`);
await writeFile(path.join(OUT, 'play.txt'), log.join('\n'));
await ctx.close();
