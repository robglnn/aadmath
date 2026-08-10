/**
 * Narrative capture: drives the arc surfaces the main harness never reaches —
 * the cold open, a REAL PLAY RUN through the real scheduler, each rank's
 * ascension rite, the chapter card, the Standard and the dossier, in all three
 * locales. Runs against the same frozen preview server.
 *
 * The real-play section is the important one. An arc that only reaches chapter
 * two when a debug hook forces it is not an arc, so this plays sixteen items
 * through `nextObjective` / `openRiftById` / `enter` exactly as the critic does,
 * records standing and rank after every single answer, and photographs the
 * promotion that falls out of it rather than one summoned by `preview()`.
 *
 *   node tools/narrative/shoot.mjs --url http://127.0.0.1:PORT --out shots/x
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/narrative'));
const W = Number(arg('w', 1600)), H = Number(arg('h', 900));

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
    '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => logs.push({ type: m.type(), text: m.text() }));
page.on('pageerror', (e) => logs.push({ type: 'pageerror', text: e.message }));

const shot = async (n, ms = 250) => { await page.waitForTimeout(ms); await page.screenshot({ path: path.join(OUT, `${n}.png`) }); };

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });

// --- the cold open, beat by beat ---
await shot('n01-open-line1', 3200);
await shot('n02-open-line3', 7000);
await shot('n03-open-question', 12000);

// --- the chapter card once the chrome retracts ---
await page.evaluate(() => { window.__ascent.story.comms.clear(); window.__ascent.story.card.show(true); });
await page.evaluate(() => window.__ascent.player.pos.set(2, 12, 26));
await shot('n04-quest-card', 2200);

// --- the dossier as a brand-new cadet sees it: five chapters still redacted ---
await page.evaluate(() => window.__ascent.story.openDossier());
await shot('n05-dossier-fresh', 900);
await page.evaluate(() => window.__ascent.story.dossier.close());
await page.waitForTimeout(400);

// ---------------------------------------------------------------------------
// REAL PLAY. Sixteen items, answered correctly, through the real scheduler.
// ---------------------------------------------------------------------------
const play = [];
let riteShot = 0;
let lastRank = await page.evaluate(() => window.__ascent.story.state().rank);
for (let i = 0; i < 16; i++) {
  const opened = await page.evaluate(() => {
    const a = window.__ascent;
    a.panel.close();
    const next = a.nextObjective();
    if (!next) return null;
    const id = next.skill || next.id || next;
    return a.openRiftById(id) ? id : null;
  });
  if (!opened) break;
  await page.waitForTimeout(260);
  const res = await page.evaluate(() => {
    const a = window.__ascent;
    if (!a.panel.open) return null;
    return a.enter(a.panel.item.answer);
  });
  await page.waitForTimeout(420);
  const st = await page.evaluate(() => {
    const a = window.__ascent;
    return { ...a.story.state(), integrity: a.mastery.integrity() };
  });
  play.push({ n: i + 1, skill: opened, correct: res ? res.entry === String(res.answer) : null, standing: st.standing, rank: st.rank, chapter: st.chapter, lines: st.lines, integrity: +st.integrity.toFixed(3) });
  if (st.rank !== lastRank) {
    lastRank = st.rank;
    // the promotion the player actually earned, mid-flight
    await page.evaluate(() => window.__ascent.panel.close());
    await shot(`n0${6 + riteShot}-earned-rite-${st.rank}`, 900);
    riteShot++;
    await page.waitForTimeout(4800);
  }
}
await page.evaluate(() => window.__ascent.panel.close());
await page.waitForTimeout(600);
await shot('n08-after-play-card', 1200);
await page.evaluate(() => window.__ascent.story.openDossier());
await shot('n09-after-play-dossier', 900);
await page.evaluate(() => window.__ascent.story.dossier.close());

// what Marlow actually said across that run, and how often she repeated herself
const spoken = await page.evaluate(() => window.__ascent.story.said());
const repeats = {};
for (const s of spoken) repeats[s.text] = (repeats[s.text] || 0) + 1;
const worstRepeat = Object.entries(repeats).sort((a, b) => b[1] - a[1])[0] || ['', 0];

// --- the ascension rites, every rank, so each palette can be checked ---
for (const [i, rank] of ['bronze', 'silver', 'gold', 'sovereign'].entries()) {
  await page.evaluate((r) => window.__ascent.story.preview(r), rank);
  await shot(`n1${i}-rite-${rank}`, 1300);
  await page.waitForTimeout(4400);
}

// --- the reveal beat, mid-transmission ---
await page.evaluate(() => window.__ascent.story.beat(4));
await shot('n20-reveal', 5200);

// --- the dossier at the top of the ladder ---
await page.evaluate(() => window.__ascent.story.openDossier());
await shot('n21-dossier', 900);

// --- localised ---
for (const loc of ['es', 'pl']) {
  await page.evaluate((l) => window.__ascent.setLocale(l), loc);
  await page.waitForTimeout(500);
  await shot(`n22-dossier-${loc}`, 400);
}
await page.evaluate(() => window.__ascent.setLocale('en'));
await page.evaluate(() => window.__ascent.story.dossier.close());

// --- the locale-switch defect: a line said in EN, then the language changes ---
await page.evaluate(() => {
  const a = window.__ascent;
  a.story.comms.clear();
  a.story.comms.sayKey('story.voice.firstSeal', { force: true });
});
await page.waitForTimeout(1400);
await shot('n25-line-en', 200);
await page.evaluate(() => window.__ascent.setLocale('es'));
await shot('n26-line-es', 900);
const strand = await page.evaluate(() => {
  const el = document.querySelector('.meta-comms');
  return { role: el?.querySelector('.role')?.textContent, body: el?.querySelector('.body')?.textContent };
});
await page.evaluate(() => window.__ascent.setLocale('en'));

// --- the Standard in the plaza, at the rank the play run earned and at the top ---
const standView = () => {
  const a = window.__ascent;
  a.panel.close();
  a.story.dossier.close();
  a.player.pos.set(21.5, (a.player.groundAt(21.5, 20) ?? 12) + 0.4, 20);
  a.player.vel.set(0, 0, 0);
  a.player.yaw = Math.PI * 1.22; a.player.pitch = -0.16;
};
await page.evaluate(() => window.__ascent.story.release());
await page.evaluate(standView);
await shot('n30-standard', 1600);
await page.evaluate(() => window.__ascent.story.preview('sovereign'));
await page.waitForTimeout(5600);
await page.evaluate(standView);
await shot('n31-standard-sovereign', 1600);

// --- mobile: the comms panel and the dossier have to survive a phone ---
const mob = await ctx.newPage();
await mob.setViewportSize({ width: 414, height: 896 });
await mob.goto(URL, { waitUntil: 'networkidle' });
await mob.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await mob.waitForTimeout(3400);
await mob.screenshot({ path: path.join(OUT, 'n40-mobile-open.png') });
await mob.evaluate(() => { window.__ascent.story.beat(4); });
await mob.waitForTimeout(1200);
await mob.evaluate(() => window.__ascent.story.openDossier());
await mob.waitForTimeout(700);
await mob.screenshot({ path: path.join(OUT, 'n41-mobile-dossier.png') });

// --- 1280x720: the resolution the ten-lines grid was clipping at ---
const lap = await ctx.newPage();
await lap.setViewportSize({ width: 1280, height: 720 });
await lap.goto(URL, { waitUntil: 'networkidle' });
await lap.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await lap.waitForTimeout(2600);
await lap.evaluate(() => window.__ascent.story.preview('gold'));
await lap.waitForTimeout(1200);
await lap.screenshot({ path: path.join(OUT, 'n50-720-rite.png') });
await lap.waitForTimeout(4600);
await lap.evaluate(() => window.__ascent.story.openDossier());
await lap.waitForTimeout(800);
await lap.screenshot({ path: path.join(OUT, 'n51-720-dossier.png') });
const overflow = await lap.evaluate(() => {
  const de = document.documentElement;
  const bad = [];
  document.querySelectorAll('#ui *').forEach((el) => {
    const r = el.getBoundingClientRect();
    if (r.width && (r.right > innerWidth + 1 || r.left < -1)) bad.push(el.className + ' ' + Math.round(r.left) + '..' + Math.round(r.right));
  });
  return { scrollW: de.scrollWidth, innerW: innerWidth, bad: bad.slice(0, 8) };
});

const errors = logs.filter((l) => l.type === 'error' || l.type === 'pageerror');
await writeFile(path.join(OUT, 'narrative.json'), JSON.stringify({ play, spoken, repeats, strand, overflow, errors }, null, 2));
console.log(`narrative shots -> ${OUT}`);
console.log('real play (item → standing/rank/chapter):');
for (const p of play) console.log(`  ${String(p.n).padStart(2)}  ${p.skill.padEnd(16)} standing ${String(p.standing).padStart(3)}  ${p.rank.padEnd(9)} ch${p.chapter}  lines ${p.lines}  int ${p.integrity}`);
console.log(`marlow said ${spoken.length} lines; most repeated x${worstRepeat[1]}: ${String(worstRepeat[0]).slice(0, 78)}`);
console.log('locale switch under a live line ->', JSON.stringify(strand));
console.log('720p overflow ->', JSON.stringify(overflow));
console.log(`console errors: ${errors.length}`);
errors.slice(0, 10).forEach((e) => console.log('  ! ' + e.text.split('\n')[0]));
await browser.close();
process.exit(errors.length ? 2 : 0);
