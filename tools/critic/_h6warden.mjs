/** H6 — the fifth-day encounter: chase the warden, load the right counterweight
 *  with the feet, and see what it leaves behind. Real keys from the reload on. */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4777');
const OUT = path.resolve(arg('out', 'shots/h6-warden'));
const W = 1600, H = 900;
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
const page = await ctx.newPage();
const errors = []; page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
const log = []; const say = (s) => { console.log(s); log.push(String(s)); };
const shot = async (n) => { await page.screenshot({ path: path.join(OUT, `${n}.png`) }); };

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4000);
for (const d of [1, 2, 3, 4, 5]) {
  await page.evaluate(async () => {
    const A = window.__ascent;
    for (let i = 0; i < 60; i++) {
      const o = A.nextObjective(); if (!o) break;
      if (!A.openRiftById(o.id)) break;
      const inf = A.panelInfo(); if (!inf.open) break;
      A.enter(inf.answer); await new Promise((r) => setTimeout(r, 20));
      try { A.panel.close?.(); } catch {}
      await new Promise((r) => setTimeout(r, 12));
    }
  });
  if (d < 5) {
    await page.evaluate(() => window.__ascent.advanceDays(1));
    await page.reload({ waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
    await page.waitForTimeout(3200);
  }
}
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4200);

let downNow = new Set(), strafeSign = 1;
async function hold(keys) {
  const want = new Set(keys);
  for (const k of downNow) if (!want.has(k)) await page.keyboard.up(k).catch(() => {});
  for (const k of want) if (!downNow.has(k)) await page.keyboard.down(k).catch(() => {});
  downNow = want;
}
const panelInfo = () => page.evaluate(() => window.__ascent.panelInfo());
async function clearFrame(tries = 6) {
  const CARDS = ['.fdy.show .fdy-close', '.ses-charter.show .sc-go', '.ses-close.show .sx-rest', '.ses-rest.show .sr-skip', '.ses-rest.show .sr-off'];
  for (let i = 0; i < tries; i++) {
    for (const sel of CARDS) {
      const b = page.locator(sel).first();
      if (!(await b.count())) continue;
      if (!(await b.isVisible().catch(() => false))) continue;
      if (await b.click({ timeout: 1500 }).then(() => true).catch(() => false)) await page.waitForTimeout(500);
    }
    if ((await panelInfo()).open || await page.evaluate(() => !!window.__ascent.input.uiOpen)) { await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
    await page.evaluate(() => document.activeElement?.blur?.());
    const a = await page.evaluate(() => ({ ...window.__ascent.player.pos }));
    await hold(['KeyW']); await page.waitForTimeout(600); await hold([]);
    const b = await page.evaluate(() => ({ ...window.__ascent.player.pos }));
    if (Math.hypot(b.x - a.x, b.z - a.z) > 0.6) return true;
    await page.mouse.click(W / 2, H / 2); await page.waitForTimeout(300);
  }
  return false;
}
await clearFrame(8); await page.mouse.click(W / 2, H / 2);
{
  const a = await page.evaluate(() => ({ x: window.__ascent.player.pos.x, z: window.__ascent.player.pos.z }));
  await hold(['KeyD']); await page.waitForTimeout(600); await hold([]);
  const b = await page.evaluate(() => ({ x: window.__ascent.player.pos.x, z: window.__ascent.player.pos.z, yaw: window.__ascent.player.yaw }));
  const dir = Math.atan2(b.x - a.x, b.z - a.z);
  let rel = ((dir - b.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
  if (rel < -Math.PI) rel += Math.PI * 2;
  strafeSign = rel > 0 ? 1 : -1;
}
function keysFor(rel) {
  const out = [];
  if (Math.cos(rel) > 0.38) out.push('KeyW'); else if (Math.cos(rel) < -0.38) out.push('KeyS');
  const s = Math.sin(rel);
  if (s > 0.38) out.push(strafeSign > 0 ? 'KeyD' : 'KeyA'); else if (s < -0.38) out.push(strafeSign > 0 ? 'KeyA' : 'KeyD');
  return out.length ? out : ['KeyW'];
}
const P = () => page.evaluate(() => { const p = window.__ascent.player.pos; return { x: p.x, y: p.y, z: p.z, g: !!window.__ascent.player.grounded }; });
async function faceYaw(want) {
  for (let i = 0; i < 16; i++) {
    const d = await page.evaluate((w) => { let e = ((w - window.__ascent.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI; if (e < -Math.PI) e += Math.PI * 2; return e; }, want);
    if (Math.abs(d) < 0.12) return true;
    const key = d > 0 ? 'ArrowLeft' : 'ArrowRight';
    await page.keyboard.down(key); await page.waitForTimeout(Math.min(320, Math.max(50, Math.abs(d) / 2.6 * 1000))); await page.keyboard.up(key);
  }
  return false;
}
const wsnap = () => page.evaluate(() => {
  const A = window.__ascent, pp = A.player.pos;
  const w = (A.wardens.list || []).find((x) => x.state !== 'bound');
  if (!w) return null;
  const V = A.THREE.Vector3;
  return { state: w.state, x: w.group.position.x, y: w.group.position.y, z: w.group.position.z,
    latex: w.q?.latex, answer: w.q?.x, d: Math.hypot(w.group.position.x - pp.x, w.group.position.z - pp.z),
    fan: (w.fan || []).map((s) => { const v = new V(); s.group.getWorldPosition(v); return { v: s.v, spent: !!s.spent, x: v.x, y: v.y, z: v.z, d: +Math.hypot(v.x - pp.x, v.z - pp.z).toFixed(1), dy: +(v.y - pp.y).toFixed(1) }; }) };
});
say('day5 warden: ' + JSON.stringify(await wsnap()));
say('kit: ' + JSON.stringify(await page.evaluate(() => window.__ascent.kit.state().held)));
await shot('00-day5');

// chase, then load the right stone
let boundAt = null;
for (let phase = 0; phase < 60 && !boundAt; phase++) {
  const w = await wsnap();
  if (!w) break;
  const live = (w.fan || []).filter((s) => !s.spent);
  const good = live.find((s) => Number(s.v) === Number(w.answer));
  const tgt = good ? { x: good.x, y: good.y, z: good.z, tag: `stone ${good.v}`, dy: good.dy } : { x: w.x, y: w.y, z: w.z, tag: 'warden', dy: w.y - (await P()).y };
  const q = await P();
  const dist = Math.hypot(tgt.x - q.x, tgt.z - q.z);
  if (phase % 6 === 0) say(`phase ${phase}: ${tgt.tag} d=${dist.toFixed(1)} dy=${(tgt.y - q.y).toFixed(1)} fan=${live.map((s) => s.v).join('/')} answer=${w.answer}`);
  await faceYaw(Math.atan2(tgt.x - q.x, tgt.z - q.z));
  // climb toward a stone that hangs above: jump, then hold the wing
  if (tgt.y - q.y > 2 && q.g) { await page.keyboard.press('Space'); await page.waitForTimeout(90); }
  await page.keyboard.down('ShiftLeft'); await hold(['KeyW']);
  await page.waitForTimeout(good && dist < 14 ? 200 : 700);
  await hold([]); await page.keyboard.up('ShiftLeft');
  if (await page.evaluate(() => !!window.__ascent.input.uiOpen)) await clearFrame(3);
  const st = await page.evaluate(() => window.__ascent.wardens.state());
  if (st.bound > 0) { boundAt = await P(); break; }
}
say('bound: ' + JSON.stringify(boundAt));
await page.waitForTimeout(1500);
await shot('01-bind');
say('wardens: ' + JSON.stringify(await page.evaluate(() => window.__ascent.wardens.state())));
const cs = await page.evaluate(() => window.__ascent.caches.state());
say('caches: ' + JSON.stringify({ total: cs.total, opened: cs.opened, deep: cs.deep, at: cs.at.filter((c) => c.tier === 2) }));

// if a deep cache fell, go and crack it
const deep = cs.at.find((c) => c.tier === 2 && !c.opened);
if (deep) {
  say('deep cache at ' + JSON.stringify(deep));
  for (let i = 0; i < 70; i++) {
    const q = await P();
    const d = Math.hypot(deep.x - q.x, deep.z - q.z);
    if (d < 12) break;
    await faceYaw(Math.atan2(deep.x - q.x, deep.z - q.z));
    await page.keyboard.down('ShiftLeft'); await hold(['KeyW']); await page.waitForTimeout(700); await hold([]); await page.keyboard.up('ShiftLeft');
    if (await page.evaluate(() => !!window.__ascent.input.uiOpen)) await clearFrame(3);
  }
  await shot('02-at-deep');
  const det = await page.evaluate(() => {
    const A = window.__ascent, pp = A.player.pos;
    const c = (A.caches.list || []).find((x) => x.tier === 2 && !x.opened); if (!c) return null;
    const V = A.THREE.Vector3;
    return { latex: c.q?.latex, answer: c.q?.x, d: Math.round(Math.hypot(c.x - pp.x, c.z - pp.z)), y: c.y,
      stones: (c.stones || []).map((s) => { const v = new V(); s.group.getWorldPosition(v); return { v: s.v, spent: !!s.spent, x: v.x, y: v.y, z: v.z }; }) };
  });
  say('deep balance: ' + JSON.stringify(det));
  for (let round = 0; round < 4; round++) {
    const t = await page.evaluate(() => {
      const A = window.__ascent;
      const c = (A.caches.list || []).find((x) => x.tier === 2 && !x.opened); if (!c) return null;
      const g = (c.stones || []).find((s) => !s.spent && Number(s.v) === Number(c.q?.x)); if (!g) return null;
      const v = new A.THREE.Vector3(); g.group.getWorldPosition(v);
      return { x: v.x, y: v.y, z: v.z, v: g.v };
    });
    if (!t) break;
    say('deep stone ' + JSON.stringify(t));
    for (let step = 0; step < 70; step++) {
      const q = await P();
      const d = Math.hypot(t.x - q.x, t.z - q.z);
      if (d < 1.5 && Math.abs(t.y - q.y) < 2.2) break;
      await faceYaw(Math.atan2(t.x - q.x, t.z - q.z));
      if (t.y - q.y > 1.5 && q.g) { await page.keyboard.press('Space'); await page.waitForTimeout(80); }
      await hold(['KeyW']); await page.waitForTimeout(200); await hold([]);
      if ((await page.evaluate(() => window.__ascent.caches.state().deepOpen)) > 0) break;
    }
    await page.waitForTimeout(1400);
    const st = await page.evaluate(() => window.__ascent.caches.state());
    say('  deepOpen=' + st.deepOpen + ' opened=' + st.opened);
    await shot(`03-deep-${round}`);
    if (st.deepOpen > 0) break;
  }
}
await page.waitForTimeout(1500);
await shot('04-final');
say('final caches: ' + JSON.stringify(await page.evaluate(() => { const c = window.__ascent.caches.state(); return { total: c.total, opened: c.opened, deep: c.deep, deepOpen: c.deepOpen }; })));
say('errors ' + errors.length);
await writeFile(path.join(OUT, 'log.txt'), log.join('\n'));
await browser.close();
