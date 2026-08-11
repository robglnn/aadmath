import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4877');
const OUT = path.resolve(arg('out', 'shots/critic-seal'));
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const logs = []; page.on('console', m => logs.push(m.type()+': '+m.text())); page.on('pageerror', e => logs.push('pageerror: '+e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent);
await page.evaluate(() => localStorage.removeItem('ascent.save'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent);
await page.waitForTimeout(3000);

// --- measure capability with REAL keyboard through CDP ---
async function glideRatio() {
  await page.evaluate(() => { const p = window.__ascent.player; p.pos.set(0, 260, 0); p.vel.set(0,0,0); p.yaw = 0; p.pitch = 0; });
  await page.waitForTimeout(400);
  await page.keyboard.down('KeyW');
  await page.keyboard.press('Space'); await page.waitForTimeout(200);
  await page.keyboard.press('Space'); await page.waitForTimeout(200);
  await page.keyboard.press('Space'); // open wing
  const s = await page.evaluate(() => { const p = window.__ascent.player; return [p.pos.x, p.pos.y, p.pos.z]; });
  await page.waitForTimeout(5000);
  const e = await page.evaluate(() => { const p = window.__ascent.player; return { pos: [p.pos.x,p.pos.y,p.pos.z], state: p.loco?.state, speed: Math.hypot(p.vel.x,p.vel.z) }; });
  await page.keyboard.up('KeyW');
  const dh = Math.hypot(e.pos[0]-s[0], e.pos[2]-s[2]); const dv = s[1]-e.pos[1];
  return { dh:+dh.toFixed(1), dv:+dv.toFixed(1), ratio:+(dh/Math.max(0.01,dv)).toFixed(2), state:e.state, speed:+e.speed.toFixed(1) };
}
async function sprintPeak() {
  await page.evaluate(() => { const a = window.__ascent, p = a.player; p.pos.set(0,(a.surfaceAt(0,26)??12)+0.6,26); p.vel.set(0,0,0); p.yaw=Math.PI; p.pitch=0; });
  await page.waitForTimeout(500);
  await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(2500);
  const peak = await page.evaluate(async () => { const p = window.__ascent.player; let m=0; for(let i=0;i<30;i++){ m=Math.max(m, Math.hypot(p.vel.x,p.vel.z)); await new Promise(r=>setTimeout(r,40)); } return m; });
  await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
  return +peak.toFixed(2);
}
async function cap(label) {
  const g = await glideRatio(); const s = await sprintPeak();
  const rest = await page.evaluate(() => { const a = window.__ascent; return { seals: [...a.mastery.state.values()].filter(x=>x.mastered).length, kit: a.kit.state(), charge: a.builder.maxCharge, shards: a.state().shards, kinds: a.kit.state().move.kinds }; });
  return { label, glide: g, sprint: s, ...rest };
}
await page.mouse.click(800,450);
const c0 = await cap('0 seals');
console.log('CAP0', JSON.stringify({glide:c0.glide, sprint:c0.sprint, charge:c0.charge, held:c0.kit.held}));

// --- seal for real: keep playing the scheduler's next objective correctly ---
const marks = [];
let items = 0;
const t0 = Date.now();
for (let i = 0; i < 400; i++) {
  const r = await page.evaluate(async () => {
    const a = window.__ascent;
    const o = a.nextObjective(); if (!o) return { done: true };
    if (!a.openRiftById(o.id)) return { miss: o.id };
    await new Promise(r => setTimeout(r, 160));
    if (!a.panel.open) return { noopen: o.id };
    const skill = a.panel.skillId || o.id;
    a.panel.demo('right');
    await new Promise(r => setTimeout(r, 300));
    try { a.panel.close(); } catch {}
    await new Promise(r => setTimeout(r, 120));
    const st = a.mastery.state.get(skill);
    return { skill, pL: st?.pL, mastered: st?.mastered, seals: [...a.mastery.state.values()].filter(x=>x.mastered).length, kind: o.kind };
  });
  items++;
  if (r.done || r.miss || r.noopen) { console.log('STOP at item', items, JSON.stringify(r)); break; }
  const last = marks.length ? marks[marks.length-1].seals : 0;
  if (r.seals > last) {
    const mins = ((Date.now()-t0)/60000).toFixed(2);
    marks.push({ seals: r.seals, items, mins: +mins });
    console.log(`--- SEAL ${r.seals} after ${items} items / ${mins} min (${r.skill}) ---`);
    const c = await cap(`${r.seals} seals`);
    console.log('   glide', c.glide.ratio, `(${c.glide.dh}m/${c.glide.dv}m)`, ' sprint', c.sprint, ' reserve', c.charge, ' held', JSON.stringify(c.kit.held), ' pieces', JSON.stringify(c.kinds));
    await page.screenshot({ path: path.join(OUT, `seal-${r.seals}.png`) });
    if (r.seals >= 6) break;
  }
  if (items % 25 === 0) console.log(`  ...${items} items, seals ${r.seals}, pL ${(r.pL??0).toFixed?.(2)}`);
}
console.log('\nSEAL MARKS', JSON.stringify(marks));
console.log('console errors:', logs.filter(l=>l.startsWith('error')||l.startsWith('pageerror')).length);
logs.filter(l=>l.startsWith('error')||l.startsWith('pageerror')).slice(0,5).forEach(l=>console.log(' !',l));
await browser.close();
