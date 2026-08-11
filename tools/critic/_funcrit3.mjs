/**
 * Probe 3 — the endgame verb, with charters actually in hand.
 * 25 simulated days, then H.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/funcrit3'));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push(e.message));
await page.addInitScript(() => { try { localStorage.clear(); } catch { /* */ } });
await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(2500);
const out = [];
const say = (o) => { out.push(o); console.log(JSON.stringify(o)); };

const play = (n) => page.evaluate(async (count) => {
  const A = window.__ascent, m = A.mastery;
  let served = 0;
  for (let i = 0; i < count; i++) {
    const o = m.next(); if (!o) break;
    const task = m.taskFor(o.id); if (!task) break;
    const item = A.itemFor(task); if (!item) continue;
    served++;
    m.observe(task.skill, true, { assisted: task.scaffold !== 'none', form: item.form, rep: item.rep, scene: item.scene, kind: task.kind });
  }
  A.kit.sync?.();
  return served;
}, n);

await play(300);
for (let d = 0; d < 26; d++) { await page.evaluate(() => window.__ascent.advanceDays(1)); await play(60); }
await page.waitForTimeout(14000);   // let every queued beat drain
const st0 = await page.evaluate(() => ({ ...window.__ascent.kit.state(), shards: window.__ascent.state().shards }));
say({ at: 'far', depth: st0.depth, charters: st0.charters, toCharter: st0.toCharter, stations: st0.stations, shards: st0.shards, next: st0.next });

await page.mouse.click(800, 450);
await page.waitForTimeout(400);
await page.evaluate(() => { const a = window.__ascent; a.player.pos.set(20, (a.player.groundAt?.(20, 30) ?? 20) + 1, 30); a.player.vel.set(0, 0, 0); });
await page.waitForTimeout(700);
const uiOpen = await page.evaluate(() => window.__ascent.input?.uiOpen);
await page.keyboard.press('KeyH');
await page.waitForTimeout(900);
const s1 = await page.evaluate(() => ({ ...window.__ascent.kit.state(), shards: window.__ascent.state().shards,
  toast: document.querySelector('.toast')?.textContent?.trim() || null }));
say({ act: 'H-1', uiOpen, stations: s1.stations, charters: s1.charters, shards: s1.shards, price: s1.prices?.station, toast: s1.toast });
await page.screenshot({ path: path.join(OUT, 'a-station-1.png') });

// move, raise a second
await page.evaluate(() => { const a = window.__ascent; a.player.pos.set(140, (a.player.groundAt?.(140, -110) ?? 40) + 1, -110); a.player.vel.set(0, 0, 0); });
await page.waitForTimeout(900);
await page.keyboard.press('KeyH');
await page.waitForTimeout(900);
const s2 = await page.evaluate(() => ({ ...window.__ascent.kit.state(), shards: window.__ascent.state().shards, pos: [...window.__ascent.player.pos.toArray()], toast: document.querySelector('.toast')?.textContent?.trim() || null }));
say({ act: 'H-2', stations: s2.stations, charters: s2.charters, shards: s2.shards, nextPrice: s2.prices?.station, pos: s2.pos, toast: s2.toast });
await page.screenshot({ path: path.join(OUT, 'b-station-2.png') });

// standing at it, H should travel
await page.keyboard.press('KeyH');
await page.waitForTimeout(1500);
const p3 = await page.evaluate(() => ({ pos: [...window.__ascent.player.pos.toArray()], toast: document.querySelector('.toast')?.textContent?.trim() || null }));
say({ act: 'H-travel', from: s2.pos, to: p3.pos, moved: Math.round(Math.hypot(p3.pos[0] - s2.pos[0], p3.pos[2] - s2.pos[2])), toast: p3.toast });
await page.screenshot({ path: path.join(OUT, 'c-travel.png') });

// look at the station we built
await page.evaluate(() => {
  const a = window.__ascent, s = a.kit.state().stationsAt || null;
  a.player.pos.set(28, (a.player.groundAt?.(28, 42) ?? 20) + 2, 42); a.player.yaw = Math.PI * 1.1; a.player.pitch = -0.05;
});
await page.waitForTimeout(1300);
await page.screenshot({ path: path.join(OUT, 'd-station-look.png') });

// the report
await page.evaluate(() => { const b = [...document.querySelectorAll('button')].find((x) => /progress/i.test(x.textContent || '')); b?.click(); });
await page.waitForTimeout(1600);
await page.screenshot({ path: path.join(OUT, 'e-report.png') });
const reportText = await page.evaluate(() => {
  const p = document.querySelector('.report, .rep, [class*="report"]');
  return p ? p.innerText.slice(0, 2500) : document.body.innerText.slice(0, 1500);
});
say({ act: 'report', reportText });
await page.mouse.wheel(0, 1000); await page.waitForTimeout(700);
await page.screenshot({ path: path.join(OUT, 'f-report2.png') });

await writeFile(path.join(OUT, 'funcrit3.json'), JSON.stringify({ out, errors }, null, 2));
console.log('errors:', errors.length);
errors.slice(0, 10).forEach((e) => console.log('  ! ' + e.split('\n')[0]));
await browser.close();
process.exit(0);
