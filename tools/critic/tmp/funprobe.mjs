/**
 * Hostile fun probe: 60s of PURE TRAVERSAL, counting events independently of
 * the game's own counters; then a capability diff across seals.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/funprobe'));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle','--ignore-gpu-blocklist','--enable-gpu-rasterization','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const logs = [];
page.on('console', m => logs.push({ type: m.type(), text: m.text() }));
page.on('pageerror', e => logs.push({ type: 'pageerror', text: e.message }));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
// fresh save
await page.evaluate(() => { localStorage.removeItem('ascent.save'); });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(3500);

// ---- independent observer installed in-page: watches DOM + wallet, not the game's stats
await page.evaluate(() => {
  const w = window.__obs = { ticks: [], msgs: [], shardSeries: [], start: performance.now() };
  const seen = new Set();
  const scan = () => {
    const a = window.__ascent;
    const t = (performance.now() - w.start) / 1000;
    const st = a.state();
    w.shardSeries.push([+t.toFixed(2), st.shards ?? st.wallet ?? null]);
    // any transient text surface in the HUD
    for (const sel of ['.hud-say', '.hud-flash', '.say', '.flash', '.kit-toast.show', '.field-tag', '.comms', '.comms-line', '.cache-tag']) {
      for (const el of document.querySelectorAll(sel)) {
        const txt = (el.textContent || '').trim();
        if (!txt) continue;
        const cs = getComputedStyle(el);
        if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) continue;
        const key = sel + '|' + txt;
        if (seen.has(key)) continue;
        seen.add(key);
        w.msgs.push({ t: +t.toFixed(2), sel, txt: txt.slice(0, 140) });
      }
    }
  };
  w.iv = setInterval(scan, 100);
});

const before = await page.evaluate(() => {
  const s = window.__ascent.state();
  return { shards: s.shards, drift: JSON.parse(JSON.stringify(window.__ascent.drift.stats)), caches: window.__ascent.caches.state(), kit: window.__ascent.kit.state(), pos: window.__ascent.player.pos.toArray() };
});

// ---- 60 seconds of PURE TRAVERSAL. No rift opening. Real keys, real mouse look.
await page.mouse.move(800, 450);
await page.mouse.click(800, 450);
const shots = [];
const t0 = Date.now();
let seg = 0;
await page.keyboard.down('KeyW');
await page.keyboard.down('ShiftLeft');
while (Date.now() - t0 < 60000) {
  // wander: swing the camera, jump/glide occasionally
  await page.mouse.move(800 + Math.sin(seg * 0.7) * 380, 450 + Math.cos(seg * 0.4) * 60, { steps: 8 });
  await page.waitForTimeout(700);
  if (seg % 3 === 1) { await page.keyboard.press('Space'); await page.waitForTimeout(260); await page.keyboard.press('Space'); }
  if (seg % 7 === 5) { await page.keyboard.press('Space'); await page.waitForTimeout(1500); await page.keyboard.press('Space'); }
  await page.waitForTimeout(500);
  if (seg % 8 === 3) {
    const f = path.join(OUT, `trav-${String(seg).padStart(2, '0')}.png`);
    await page.screenshot({ path: f }); shots.push(f);
  }
  seg++;
}
await page.keyboard.up('ShiftLeft');
await page.keyboard.up('KeyW');

const after = await page.evaluate(() => {
  const s = window.__ascent.state();
  clearInterval(window.__obs.iv);
  return { shards: s.shards, drift: JSON.parse(JSON.stringify(window.__ascent.drift.stats)), caches: window.__ascent.caches.state(), pos: window.__ascent.player.pos.toArray(),
    obs: { msgs: window.__obs.msgs, shardSeries: window.__obs.shardSeries } };
});

const traversal = {
  seconds: 60,
  shardsBefore: before.shards, shardsAfter: after.shards,
  driftBefore: before.drift, driftAfter: after.drift,
  distance: Math.hypot(after.pos[0] - before.pos[0], after.pos[2] - before.pos[2]).toFixed(1),
  // independent count: number of distinct upward shard jumps observed
  shardJumps: (() => { const s = after.obs.shardSeries; let n = 0; for (let i = 1; i < s.length; i++) if (s[i][1] > s[i - 1][1]) n++; return n; })(),
  messages: after.obs.msgs,
};

await writeFile(path.join(OUT, 'traversal.json'), JSON.stringify(traversal, null, 2));
console.log('=== 60s PURE TRAVERSAL ===');
console.log('distance travelled (m):', traversal.distance);
console.log('shards:', before.shards, '->', after.shards);
console.log('drift stats before:', JSON.stringify(before.drift));
console.log('drift stats after :', JSON.stringify(after.drift));
console.log('independent shard-gain events:', traversal.shardJumps);
console.log('distinct on-screen messages:', traversal.messages.length);
traversal.messages.slice(0, 25).forEach(m => console.log(`  [${m.t}s] ${m.sel}  ${m.txt}`));

// ---------------- CAPABILITY DIFF ----------------
async function capability(label) {
  return await page.evaluate(async (lab) => {
    const a = window.__ascent;
    const P = a.player;
    const sleep = ms => new Promise(r => setTimeout(r, ms));
    // 1. glide ratio: drop from height, hold glide, measure horizontal per vertical
    const measureGlide = async () => {
      P.pos.set(0, 220, 0); P.vel.set(0, 0, 0); P.yaw = 0; P.pitch = 0;
      a.input.keys ||= {};
      await sleep(300);
      const k = a.input;
      // press jump twice then hold to open the wing, the way the player does
      const start = { x: P.pos.x, y: P.pos.y, z: P.pos.z };
      const press = (code) => { window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true })); document.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true })); };
      const rel = (code) => { window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true })); document.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true })); };
      press('KeyW');
      press('Space'); await sleep(90); rel('Space'); await sleep(120);
      press('Space'); await sleep(90); rel('Space'); await sleep(120);
      press('Space'); await sleep(90); rel('Space');
      await sleep(4000);
      const end = { x: P.pos.x, y: P.pos.y, z: P.pos.z };
      rel('KeyW');
      const dh = Math.hypot(end.x - start.x, end.z - start.z);
      const dv = start.y - end.y;
      return { dh: +dh.toFixed(1), dv: +dv.toFixed(1), ratio: +(dh / Math.max(0.01, dv)).toFixed(2), gliding: a.player.loco?.state };
    };
    const glide = await measureGlide();
    // 2. sprint top speed on flat ground
    P.pos.set(0, (a.surfaceAt(0, 26) ?? 12) + 0.5, 26); P.vel.set(0, 0, 0); P.yaw = Math.PI;
    await sleep(400);
    const press = (code) => window.dispatchEvent(new KeyboardEvent('keydown', { code, bubbles: true }));
    const rel = (code) => window.dispatchEvent(new KeyboardEvent('keyup', { code, bubbles: true }));
    press('KeyW'); press('ShiftLeft');
    await sleep(2200);
    let peak = 0;
    for (let i = 0; i < 25; i++) { peak = Math.max(peak, Math.hypot(P.vel.x, P.vel.z)); await sleep(40); }
    rel('KeyW'); rel('ShiftLeft');
    return {
      label: lab,
      seals: [...a.mastery.state.values()].filter(s => s.mastered).length,
      kit: a.kit.state(),
      glide, sprintPeak: +peak.toFixed(2),
      buildCharge: a.buildTarget().charge,
      builderMax: a.builder.maxCharge,
      vaultAllowed: (() => { try { return a.builder.setSlot(4); } catch { return 'err'; } })(),
      shards: a.state().shards,
    };
  }, label);
}

const cap0 = await capability('fresh (0 seals)');
console.log('\n=== CAPABILITY @ 0 SEALS ===');
console.log(JSON.stringify(cap0, null, 2));

// Seal lines for real, through the real panel, and re-measure after each.
const caps = [cap0];
const skills = await page.evaluate(() => window.__ascent.skillIds);
console.log('\nskills:', JSON.stringify(skills));

for (let round = 0; round < 6; round++) {
  const sealed = await page.evaluate(async () => {
    const a = window.__ascent;
    // find the next unmastered skill and answer it correctly until it seals
    const before = [...a.mastery.state.values()].filter(s => s.mastered).length;
    for (let i = 0; i < 40; i++) {
      const obj = a.nextObjective();
      if (!obj) break;
      const id = obj.skill || obj.id;
      if (!a.openRiftById(id)) break;
      await new Promise(r => setTimeout(r, 130));
      if (!a.panel.open) break;
      a.panel.demo('right');
      await new Promise(r => setTimeout(r, 260));
      const now = [...a.mastery.state.values()].filter(s => s.mastered).length;
      if (now > before) { try { a.panel.close(); } catch {} return { ok: true, seals: now, i }; }
    }
    try { a.panel.close(); } catch {}
    return { ok: false, seals: [...a.mastery.state.values()].filter(s => s.mastered).length };
  });
  await page.waitForTimeout(900);
  const c = await capability(`after ${sealed.seals} seal(s)`);
  caps.push(c);
  console.log(`\n=== CAPABILITY @ ${c.seals} SEALS (sealing took ${sealed.i ?? '?'} correct answers) ===`);
  console.log(`glide ratio ${c.glide.ratio} (dh ${c.glide.dh}m / dv ${c.glide.dv}m)  sprint ${c.sprintPeak} m/s  reserve ${c.builderMax}  vault ${c.vaultAllowed}  held ${JSON.stringify(c.kit)}`);
  if (!sealed.ok) { console.log('  !! could not seal another line'); break; }
  const f = path.join(OUT, `cap-${c.seals}.png`);
  await page.screenshot({ path: f }); shots.push(f);
}

await writeFile(path.join(OUT, 'caps.json'), JSON.stringify(caps, null, 2));
const errors = logs.filter(l => l.type === 'error' || l.type === 'pageerror');
console.log('\nconsole errors:', errors.length);
errors.slice(0, 10).forEach(e => console.log('  !', e.text));
await browser.close();
