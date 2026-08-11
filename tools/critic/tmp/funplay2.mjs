/** Part two: the world verb on its own terms, and the failure loop. */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4457');
const OUT = path.resolve(arg('out', 'shots/funplay2'));
const W = 1600, H = 900;
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle','--ignore-gpu-blocklist','--enable-gpu-rasterization','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const logs = []; const notes = [];
page.on('console', m => { if (m.type()==='error') logs.push(m.text()); });
page.on('pageerror', e => logs.push('pageerror: '+e.message));
const say = s => { notes.push(s); console.log(s); };
let n = 0;
const shot = async (name, ms=250) => { await page.waitForTimeout(ms); await page.screenshot({ path: path.join(OUT, `${String(++n).padStart(2,'0')}-${name}.png`) }); };

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.evaluate(() => localStorage.removeItem('ascent.save'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(3000);

// --- THE ANCHOR CHALLENGE: can I climb to one with the build verb? ---------
const anchors = await page.evaluate(() => window.__ascent.anchors());
say('anchors ' + JSON.stringify(anchors));
// lock pointer WITHOUT building: click far corner? test whether first click builds
await page.mouse.move(W/2, H/2);
await page.mouse.click(W/2, H/2);
const placedAfterLock = await page.evaluate(() => window.__ascent.buildTarget().placed);
say('pieces placed by the pointer-lock click: ' + placedAfterLock);
await page.keyboard.press('KeyQ'); await page.waitForTimeout(200);

// stand under the first anchor, look up, and climb by placing under myself
const a0 = anchors.at[0];
say('anchor0 ' + JSON.stringify(a0));
await page.evaluate((p) => { const a = window.__ascent; a.player.pos.set(p[0], a.islandAt(p[0], p[2]) + 1.2, p[2]); a.player.vel.set(0,0,0); a.player.pitch = -0.2; a.player.yaw = 0; }, a0);
await page.waitForTimeout(600);
await shot('under-anchor', 500);
const gy0 = await page.evaluate(() => window.__ascent.player.pos.y);
// pillar-jump: look down, place, jump — the classic Fortnite ramp-up
for (let i = 0; i < 0; i++) {
  await page.evaluate(() => { window.__ascent.player.pitch = -1.2; });
  await page.keyboard.press('Space');
  await page.waitForTimeout(90);
  const r = await page.evaluate(() => window.__ascent.build());
  await page.waitForTimeout(320);
  if (i === 4) await shot('climb-5', 100);
}
await page.waitForTimeout(900);
const gy1 = await page.evaluate(() => window.__ascent.player.pos.y);
say(`pillar climb: y ${gy0.toFixed(1)} -> ${gy1.toFixed(1)} (gain ${(gy1-gy0).toFixed(1)})`);
await page.evaluate(() => { window.__ascent.player.pitch = -0.1; });
await shot('climbed', 700);
say('anchors now ' + JSON.stringify(await page.evaluate(() => window.__ascent.anchors())));

// --- FAILURE LOOP: get four in a row wrong on the same rift ----------------
await page.evaluate(() => window.__ascent.openRiftById('var-meaning'));
await page.waitForTimeout(900);
for (let i = 0; i < 4; i++) {
  const r = await page.evaluate(() => {
    const a = window.__ascent; if (!a.panel.open) return { closed: true };
    const ans = a.panel.item.answer;
    const bad = Number.isFinite(Number(ans)) ? Number(ans) + 3 : 'x';
    return a.enter(bad);
  });
  say(`wrong#${i+1} ` + JSON.stringify(r));
  await page.waitForTimeout(1600);
  await shot(`fail-${i+1}`, 300);
  const txt = await page.evaluate(() => document.querySelector('.rift')?.innerText.replace(/\n{2,}/g,'\n').slice(0,900));
  say(`--- after wrong ${i+1} ---\n${txt}\n---`);
  // advance to the next item the way a player would
  await page.evaluate(() => {
    const b = [...document.querySelectorAll('.rift button')].find(x => /push further|next|continue|again/i.test(x.textContent));
    b?.click();
  });
  await page.waitForTimeout(900);
}
say('after 4 wrong: ' + JSON.stringify(await page.evaluate(() => {
  const s = window.__ascent.state().skills['var-meaning'];
  return { pL: s.pL, attempts: s.attempts, correct: s.correct, difficulty: s.difficulty, consecutiveWrong: s.consecutiveWrong, misconceptions: s.misconceptions };
})));
await shot('fail-state', 400);

// --- PACED MASTERY: answer correctly with human-ish spacing ----------------
await page.evaluate(() => window.__ascent.panel.open && window.__ascent.panel.close());
await page.waitForTimeout(600);
let mastered = false;
for (let round = 0; round < 40 && !mastered; round++) {
  const open = await page.evaluate(() => window.__ascent.panel.open);
  if (!open) await page.evaluate(() => window.__ascent.openRiftById('var-meaning'));
  await page.waitForTimeout(600);
  const still = await page.evaluate(() => window.__ascent.panel.open);
  if (!still) { say('rift will not reopen at round ' + round); break; }
  await page.evaluate(() => window.__ascent.enter(window.__ascent.panel.item.answer));
  await page.waitForTimeout(3200); // human pace
  const s = await page.evaluate(() => window.__ascent.state().skills['var-meaning']);
  mastered = s.mastered;
  if (round % 4 === 0 || mastered) say(`r${round} pL=${s.pL.toFixed(2)} att=${s.attempts} ok=${s.correct} d=${s.difficulty} mastered=${s.mastered}`);
  if (mastered) { await shot('mastery-moment', 400); await page.waitForTimeout(1600); await shot('mastery-after', 400); }
}
say('MASTERED var-meaning: ' + mastered);
await page.evaluate(() => window.__ascent.panel.open && window.__ascent.panel.close());
await page.waitForTimeout(1500);
await shot('world-after-mastery', 800);
say('state ' + JSON.stringify(await page.evaluate(() => { const s = window.__ascent.state(); return { integrity: s.integrity, soft: s.soft, shards: s.shards, session: s.session.phase, run: s.session.run && { tears: s.session.run.tears, focus: Math.round(s.session.run.focus) } }; })));

// --- next objective after mastery: does the game hand me somewhere to go? --
say('next objective ' + JSON.stringify(await page.evaluate(() => window.__ascent.nextObjective())));
const dom = await page.evaluate(() => document.body.innerText.replace(/\n{2,}/g,'\n').slice(0,900));
say('--- HUD ---\n' + dom);

// --- persistence: reload and see if it survives ---------------------------
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(3000);
await shot('return-visit', 900);
say('after reload ' + JSON.stringify(await page.evaluate(() => { const s = window.__ascent.state(); return { integrity: s.integrity, shards: s.shards, mastered: Object.values(s.skills).filter(x=>x.mastered).length }; })));
const dom2 = await page.evaluate(() => document.body.innerText.replace(/\n{2,}/g,'\n').slice(0,700));
say('--- RETURN HUD ---\n' + dom2);

await writeFile(path.join(OUT,'notes.txt'), notes.join('\n'));
console.log('CONSOLE ERRORS: ' + logs.length);
if (logs.length) console.log(logs.slice(0,5).join('\n'));
await browser.close();
