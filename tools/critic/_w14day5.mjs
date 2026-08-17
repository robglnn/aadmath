/**
 * Five days worked, reliably. Transport is `__ascent.teleportTo` — a documented
 * critic hook that MOVES the player and nothing else. Every rift is still
 * opened with a real KeyE and every answer still goes in as real keystrokes or
 * a real mouse click, so the engine, the checker and the day ledger all see a
 * player. What this run is for is the fifth day: what the world puts out that
 * was not there on the first.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4917');
const OUT = path.resolve(arg('out', 'shots/w14-fun/day5'));
const W = 1600, H = 900;
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.evaluate(() => { localStorage.clear(); localStorage.setItem('ascent.locale', 'en'); });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(2000);

const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) }).catch(() => {});
const pinfo = () => page.evaluate(() => window.__ascent.panelInfo()).catch(() => ({ open: false }));

async function clearOverlays() {
  const btns = page.locator('button:visible');
  const n = Math.min(await btns.count().catch(() => 0), 20);
  for (let i = 0; i < n; i++) {
    const t = ((await btns.nth(i).innerText().catch(() => '')) || '').trim().toUpperCase();
    if (/^(STEP BACK|BACK TO THE RUN|GOT IT|STAND DOWN|CONTINUE|GO|BEGIN|ONE MORE LINE|CLOSE)$/.test(t)) {
      await btns.nth(i).click({ timeout: 2000 }).catch(() => {}); await page.waitForTimeout(450); return true;
    }
  }
  return false;
}

async function answer(c) {
  if (c.mode === 'choice') {
    const b = page.locator('.rf-reading'); const n = await b.count(); if (!n) return false;
    for (let i = 0; i < n; i++) { const v = await b.nth(i).getAttribute('data-value'); if (String(v) === String(c.answer)) { await b.nth(i).click({ timeout: 4000 }).catch(() => {}); return true; } }
    await b.first().click({ timeout: 4000 }).catch(() => {}); return true;
  }
  if (c.mode === 'keypad') {
    for (const ch of String(c.answer ?? '')) { if (ch === '-') await page.keyboard.press('Minus'); else if (ch === '/') await page.keyboard.press('Slash'); else await page.keyboard.press(ch); await page.waitForTimeout(45); }
    await page.keyboard.press('Enter'); return true;
  }
  const any = page.locator('.rf-move, .rf-chip, .rf-bay, .ans').first();
  if (await any.count()) { await any.click({ timeout: 4000 }).catch(() => {}); return true; }
  return false;
}

async function workOneDay(day, want) {
  let n = 0; const served = []; const t0 = Date.now();
  while (n < want && Date.now() - t0 < 240000) {
    await clearOverlays();
    if (!(await pinfo()).open) {
      // stand in front of the tear the engine says is next, then open it by hand
      const ok = await page.evaluate(() => {
        const A = window.__ascent;
        const next = A.nextObjective();
        const id = next && (next.skill || next.id);
        const r = A.rifts.list.find((x) => x.skill === id) || A.rifts.list.find((x) => !x.sealed) || A.rifts.list[0];
        return r ? A.teleportTo(r.id) : false;
      }).catch(() => false);
      if (!ok) break;
      await page.waitForTimeout(700);
      for (let k = 0; k < 8 && !(await pinfo()).open; k++) { await page.keyboard.press('KeyE'); await page.waitForTimeout(350); }
      if (!(await pinfo()).open) { await page.keyboard.down('KeyW'); await page.waitForTimeout(700); await page.keyboard.up('KeyW'); await page.keyboard.press('KeyE'); await page.waitForTimeout(600); }
      if (!(await pinfo()).open) continue;
    }
    const c = await pinfo();
    if (c.settled) { await page.waitForTimeout(700); continue; }
    n++;
    served.push({ n, skill: c.skill, mode: c.mode, form: c.form, kind: c.kind, reprobe: c.reprobe, mastered: c.masteredWhenServed });
    await answer(c);
    await page.waitForTimeout(1600);
    if ((await pinfo()).open) { const s = await pinfo(); if (s.settled) { const tS = Date.now(); while ((await pinfo()).open && Date.now() - tS < 3400) await page.waitForTimeout(200); } }
  }
  const st = await page.evaluate(() => { const A = window.__ascent; const s = A.state(); return { wardens: A.wardens.state(), caches: A.caches.state(), kit: A.kit.state(), drift: s.drift, mastered: A.skillIds.filter((i) => A.mastery.state.get(i)?.mastered), watch: A.watch(), shards: s.shards, integrity: s.integrity }; }).catch((e) => ({ err: String(e) }));
  return { day, items: n, served, st };
}

const out = [];
for (let d = 1; d <= 4; d++) {
  const r = await workOneDay(d, 12);
  out.push(r);
  console.log(`day ${d}: items=${r.items} mastered=${(r.st.mastered || []).length} wardens=${r.st.wardens.alive} motes=${r.st.kit ? r.st.kit.depth : '?'}`);
  await clearOverlays();
  await page.evaluate(() => window.__ascent.advanceDays(1));
  await page.waitForTimeout(400);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
  await page.waitForTimeout(2200);
}
await shot('d5-cold-open');
const s5 = await workOneDay(5, 12);
out.push(s5);
console.log(`day 5: items=${s5.items} wardens=${JSON.stringify(s5.st.wardens)} mastered=${(s5.st.mastered || []).length}`);
await shot('d5-mid');
// what did the fifth day put out there?
const w = s5.st.wardens;
if (w && w.at && w.at.length) {
  await page.evaluate(() => {
    const A = window.__ascent; const a = A.wardens.state().at[0];
    A.player.pos.set(a.x - 24, (a.y ?? 70) + 2, a.z - 24); A.player.vel.set(0, 0, 0);
    window.__lk = () => { const c = A.camera; const b = A.wardens.state().at[0]; c.position.set(b.x - 28, (b.y ?? 70) + 8, b.z - 28); c.lookAt(b.x, b.y ?? 70, b.z); };
    A.engine.add(() => window.__lk());
  }).catch(() => {});
  await page.waitForTimeout(2500);
  await shot('d5-warden');
}
await writeFile(path.join(OUT, 'day5.json'), JSON.stringify({ errors, out }, null, 2));
console.log('errors', errors.length);
await browser.close();
