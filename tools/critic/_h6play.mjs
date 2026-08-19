/**
 * H6 — the fifth-session judgement drive.
 *
 * Plays five real sittings with real keys, screenshots every beat, and on the
 * fifth day goes out to an off-island site and solves it with the feet.
 * The only debug call used to make progress is advanceDays.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4777');
const OUT = path.resolve(arg('out', 'shots/h6-play'));
const W = 1600, H = 900;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const log = [];
const say = (s) => { console.log(s); log.push(s); };
const shot = async (n) => { await page.screenshot({ path: path.join(OUT, `${n}.png`) }); };

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4200);

// ---------------------------------------------------------------- movement
let strafeSign = 1, downNow = new Set();
async function hold(keys) {
  const want = new Set(keys);
  for (const k of downNow) if (!want.has(k)) await page.keyboard.up(k).catch(() => {});
  for (const k of want) if (!downNow.has(k)) await page.keyboard.down(k).catch(() => {});
  downNow = want;
}
async function calibrate() {
  const a = await page.evaluate(() => ({ x: window.__ascent.player.pos.x, z: window.__ascent.player.pos.z }));
  await hold(['KeyD']); await page.waitForTimeout(600); await hold([]);
  const b = await page.evaluate(() => ({ x: window.__ascent.player.pos.x, z: window.__ascent.player.pos.z, yaw: window.__ascent.player.yaw }));
  if (Math.hypot(b.x - a.x, b.z - a.z) < 0.4) return false;
  const dir = Math.atan2(b.x - a.x, b.z - a.z);
  let rel = ((dir - b.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (rel < -Math.PI) rel += Math.PI * 2;
  strafeSign = rel > 0 ? 1 : -1;
  return true;
}
function keysFor(rel) {
  const out = [];
  if (Math.cos(rel) > 0.38) out.push('KeyW');
  else if (Math.cos(rel) < -0.38) out.push('KeyS');
  const side = Math.sin(rel);
  if (side > 0.38) out.push(strafeSign > 0 ? 'KeyD' : 'KeyA');
  else if (side < -0.38) out.push(strafeSign > 0 ? 'KeyA' : 'KeyD');
  return out.length ? out : ['KeyW'];
}
const panelInfo = () => page.evaluate(() => window.__ascent.panelInfo());

async function clearFrame(tries = 8) {
  const CARDS = ['.fdy.show .fdy-close', '.ses-charter.show .sc-go', '.ses-close.show .sx-rest',
    '.ses-rest.show .sr-skip', '.ses-rest.show .sr-off'];
  for (let i = 0; i < tries; i++) {
    for (const sel of CARDS) {
      const b = page.locator(sel).first();
      if (!(await b.count())) continue;
      if (!(await b.isVisible().catch(() => false))) continue;
      if (await b.click({ timeout: 1500 }).then(() => true).catch(() => false)) await page.waitForTimeout(600);
    }
    if ((await panelInfo()).open || await page.evaluate(() => !!window.__ascent.input.uiOpen)) {
      await page.keyboard.press('Escape'); await page.waitForTimeout(450);
    }
    await page.evaluate(() => document.activeElement?.blur?.());
    const a = await page.evaluate(() => ({ ...window.__ascent.player.pos }));
    await hold(['KeyW']); await page.waitForTimeout(700); await hold([]);
    const b = await page.evaluate(() => ({ ...window.__ascent.player.pos }));
    if (Math.hypot(b.x - a.x, b.z - a.z) > 0.6) return true;
    await page.mouse.click(W / 2, H / 2); await page.waitForTimeout(400);
  }
  return false;
}

async function runAt(target, budgetMs, near = 4, stop = null, keepRift = false) {
  const t0 = Date.now(); let check = 0, stall = 0, wedged = 0, lastDist = Infinity;
  await page.keyboard.down('ShiftLeft');
  try {
    while (Date.now() - t0 < budgetMs) {
      if (stop && await stop()) return true;
      if (++check % 9 === 0 && await page.evaluate(() => !!window.__ascent.input.uiOpen)
          && !(keepRift && (await panelInfo()).open)) {
        await hold([]); await page.keyboard.up('ShiftLeft'); await clearFrame(4); await page.keyboard.down('ShiftLeft');
      }
      const t = typeof target === 'function' ? await target() : target;
      if (!t) { await hold([]); await page.waitForTimeout(200); continue; }
      const err = await page.evaluate((tt) => {
        const a = window.__ascent, p = a.player.pos;
        const want = Math.atan2(tt.x - p.x, tt.z - p.z);
        let d = ((want - a.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
        if (d < -Math.PI) d += Math.PI * 2;
        return { d, dist: Math.hypot(tt.x - p.x, tt.z - p.z) };
      }, t);
      if (err.dist < near) return true;
      if (++stall % 27 === 0) {
        if (err.dist > lastDist - 1) {
          await page.keyboard.press('Space'); await page.waitForTimeout(120); wedged++;
          if (wedged >= 3) { wedged = 0; await page.keyboard.press('KeyR'); await page.waitForTimeout(900); }
        } else wedged = 0;
        lastDist = err.dist;
      }
      await hold(keysFor(err.d));
      await page.waitForTimeout(110);
    }
  } finally { await hold([]); await page.keyboard.up('ShiftLeft'); }
  return false;
}

async function answerOpenCard(correct = true) {
  const c = await panelInfo();
  if (!c || !c.open) return false;
  if (c.mode === 'choice') {
    const btns = page.locator('.rf-reading');
    const n = await btns.count();
    for (let i = 0; i < n; i++) {
      const v = String(await btns.nth(i).getAttribute('data-value'));
      const match = correct ? v === String(c.answer) : v !== String(c.answer);
      if (match) { await btns.nth(i).click({ timeout: 5000 }).catch(() => {}); return true; }
    }
    return false;
  }
  if (c.mode === 'keypad') {
    const val = correct ? String(c.answer ?? '') : String((Number(c.answer) || 0) + 3);
    for (const ch of val) {
      if (ch === '-') await page.keyboard.press('Minus');
      else if (ch === '/') await page.keyboard.press('Slash');
      else if (ch === '+') await page.keyboard.press('Equal');
      else if (ch === '^') await page.keyboard.press('Digit6');
      else await page.keyboard.press(ch);
      await page.waitForTimeout(40);
    }
    await page.keyboard.press('Enter');
    return true;
  }
  const any = page.locator('.rf-move, .rf-chip, .rf-bay, .ans').first();
  if (await any.count()) { await any.click({ timeout: 5000 }).catch(() => {}); return true; }
  return false;
}

const seen = [];
async function workItems(n, tag, wrongAt = -1) {
  let done = 0;
  for (let i = 0; i < n * 3 && done < n; i++) {
    if ((await panelInfo()).open) {
      const c = await panelInfo();
      const correct = done !== wrongAt;
      if (correct === false) { await shot(`${tag}-wrong-before`); }
      if (await answerOpenCard(correct)) {
        await page.waitForTimeout(1500);
        if (!correct) await shot(`${tag}-wrong-after`);
        seen.push({ tag, skill: c.skill, mode: c.mode, form: c.form, masteredWhenServed: c.masteredWhenServed, reprobe: c.reprobe });
        done++;
        if (done === 1) await shot(`${tag}-item1`);
        await page.waitForTimeout(1200);
        continue;
      }
    }
    const target = await page.evaluate(() => {
      const a = window.__ascent, p = a.player.pos;
      let best = null, bd = 1e9;
      for (const r of a.rifts.list) { if (r.locked) continue;
        const d = Math.hypot(r.pos.x - p.x, r.pos.z - p.z); if (d < bd) { bd = d; best = r; } }
      return best ? { x: best.pos.x, z: best.pos.z } : null;
    });
    if (!target) { say(`   [${tag}] no unlocked rift`); return done; }
    await runAt(target, 30000, 6, async () => (await panelInfo()).open, true);
    for (let k = 0; k < 8; k++) { await page.keyboard.press('KeyE'); await page.waitForTimeout(320); if ((await panelInfo()).open) break; }
    if (!(await panelInfo()).open) await clearFrame(3);
  }
  return done;
}

const snapState = () => page.evaluate(() => {
  const a = window.__ascent, s = a.state();
  return {
    fps: Math.round(s.fps), tier: s.fxTier,
    session: s.session, kit: s.kit, wallet: a.wallet?.balance ?? null,
    caches: s.caches, spans: s.spans, wardens: s.wardens,
    watch: a.watch(), locale: a.locale(),
    mastered: Object.entries(s.skills || {}).filter(([, v]) => v.mastered).map(([k]) => k),
    skills: Object.keys(s.skills || {}).length,
    rifts: a.rifts.list.map((r) => ({ id: r.id, locked: r.locked })),
    guide: a.story?.guide?.() ?? null,
    hudText: (document.getElementById('ui')?.innerText || '').slice(0, 900),
  };
});

// ============================================================ DAY 1
say('=== DAY 1 ===');
await shot('d1-00-arrival');
say('arrival HUD: ' + JSON.stringify((await snapState()).hudText.slice(0, 400)));
await page.waitForSelector('.sc-go', { timeout: 6000 }).catch(() => {});
if (await page.locator('.ses-charter.show').count()) await shot('d1-01-charter');
await clearFrame(6);
await page.mouse.click(W / 2, H / 2);
say('strafe calibrated: ' + await calibrate());
await shot('d1-02-world');
const d1a = await snapState();
say('d1 open: ' + JSON.stringify({ session: d1a.session, kit: d1a.kit, wallet: d1a.wallet, guide: d1a.guide }));
say(`d1 items answered: ${await workItems(8, 'd1', 3)}`);
const d1b = await snapState();
say('d1 after 8: ' + JSON.stringify({ session: d1b.session, mastered: d1b.mastered, wallet: d1b.wallet, kit: d1b.kit, fps: d1b.fps, tier: d1b.tier }));
await shot('d1-03-mid');
// look for the break / close beat
if (await page.locator('.ses-rest.show').count()) await shot('d1-04-rest');
if (await page.locator('.ses-close.show').count()) await shot('d1-05-close');
say(`d1 more items: ${await workItems(8, 'd1b')}`);
const d1c = await snapState();
say('d1 after 16: ' + JSON.stringify({ session: d1c.session, mastered: d1c.mastered, wallet: d1c.wallet, kit: d1c.kit, caches: d1c.caches, spans: d1c.spans, wardens: d1c.wardens }));
await shot('d1-06-late');
for (const sel of ['.ses-rest', '.ses-close', '.ses-charter']) {
  if (await page.locator(sel + '.show').count()) { await shot('d1-07-' + sel.replace(/\W/g, '')); }
}

// ============================================================ DAYS 2-4
for (const day of [2, 3, 4]) {
  say(`=== DAY ${day} ===`);
  await page.evaluate(() => window.__ascent.advanceDays(1));
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
  await page.waitForTimeout(4200);
  await shot(`d${day}-00-open`);
  const open = await snapState();
  say(`d${day} open: ` + JSON.stringify({ session: open.session, watch: open.watch, guide: open.guide, kit: open.kit, wallet: open.wallet }));
  say(`d${day} HUD: ` + open.hudText.replace(/\n/g, ' | ').slice(0, 500));
  if (await page.locator('.ses-charter.show').count()) await shot(`d${day}-01-charter`);
  await clearFrame(6);
  await page.mouse.click(W / 2, H / 2);
  await calibrate();
  say(`d${day} items: ${await workItems(10, 'd' + day)}`);
  const s = await snapState();
  say(`d${day} end: ` + JSON.stringify({ session: s.session, mastered: s.mastered.length, wallet: s.wallet, kit: s.kit, caches: s.caches, spans: s.spans, wardens: s.wardens, watch: s.watch }));
  await shot(`d${day}-02-end`);
}

// ============================================================ DAY 5
say('=== DAY 5 ===');
await page.evaluate(() => window.__ascent.advanceDays(1));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4200);
await shot('d5-00-open');
const d5open = await snapState();
say('d5 open: ' + JSON.stringify(d5open.session) + ' watch ' + JSON.stringify(d5open.watch));
say('d5 HUD: ' + d5open.hudText.replace(/\n/g, ' | '));
say('d5 guide: ' + JSON.stringify(d5open.guide));
say('d5 kit: ' + JSON.stringify(d5open.kit) + ' wallet ' + d5open.wallet);
say('d5 caches: ' + JSON.stringify(d5open.caches));
say('d5 spans: ' + JSON.stringify(d5open.spans));
say('d5 wardens: ' + JSON.stringify(d5open.wardens));
say('d5 mastered: ' + d5open.mastered.length + '/' + d5open.skills + ' -> ' + d5open.mastered.join(','));
say('d5 rifts: ' + JSON.stringify(d5open.rifts));
if (await page.locator('.ses-charter.show').count()) {
  await shot('d5-01-charter');
  say('d5 charter text: ' + (await page.locator('.ses-charter').innerText()).replace(/\n/g, ' | '));
}
await clearFrame(6);
await page.mouse.click(W / 2, H / 2);
await calibrate();
await shot('d5-02-world');
say(`d5 items: ${await workItems(6, 'd5')}`);
await shot('d5-03-afteritems');
const d5mid = await snapState();
say('d5 mid: ' + JSON.stringify({ session: d5mid.session, wallet: d5mid.wallet, kit: d5mid.kit, guide: d5mid.guide }));

await writeFile(path.join(OUT, 'log.txt'), log.join('\n'));
await writeFile(path.join(OUT, 'items.json'), JSON.stringify(seen, null, 2));
say('errors: ' + errors.length + (errors.length ? ' :: ' + errors.slice(0, 5).join(' ;; ') : ''));

// keep the page alive for the off-island phase in a second script? no — do it here.
await writeFile(path.join(OUT, 'state-d5.json'), JSON.stringify(await snapState(), null, 2));
await browser.close();
