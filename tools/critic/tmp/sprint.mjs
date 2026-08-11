import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://127.0.0.1:4877';
const browser = await chromium.launch({ args: ['--use-gl=angle','--enable-unsafe-swiftshader','--disable-gpu-vsync','--disable-frame-rate-limit'] });
const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
const page = await ctx.newPage();
const errs = []; page.on('pageerror', e => errs.push(e.message)); page.on('console', m => { if (m.type()==='error') errs.push(m.text()); });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent);
await page.evaluate(() => localStorage.removeItem('ascent.save'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent);
await page.waitForTimeout(3000);
await page.mouse.click(800, 450);
await page.waitForTimeout(300);

async function run(label) {
  // reset to spawn, no teleport tricks
  await page.evaluate(() => { const a = window.__ascent; a.player.vel.set(0,0,0); });
  await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
  await page.waitForTimeout(1800);
  const s = await page.evaluate(async () => {
    const p = window.__ascent.player; let m = 0, g = 0, n = 0;
    for (let i=0;i<40;i++){ const v = Math.hypot(p.vel.x,p.vel.z); m=Math.max(m,v); if(p.loco?.grounded){g+=v;n++;} await new Promise(r=>setTimeout(r,50)); }
    return { peak: m, groundAvg: n? g/n : 0, state: p.loco?.state, grounded: p.loco?.grounded, y: p.pos.y };
  });
  await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
  await page.waitForTimeout(600);
  const k = await page.evaluate(() => window.__ascent.kit.state());
  console.log(label, 'peak', s.peak.toFixed(2), 'groundAvg', s.groundAvg.toFixed(2), 'state', s.state, 'P.sprint', k.move.sprint, 'dashCool', k.move.dashCool, 'held', JSON.stringify(k.held));
  return s;
}
await run('BEFORE seals:');
// seal 5 lines
await page.evaluate(async () => {
  const a = window.__ascent;
  for (let i=0;i<200;i++){
    const n = [...a.mastery.state.values()].filter(x=>x.mastered).length;
    if (n >= 5) break;
    const o = a.nextObjective(); if(!o) break;
    if(!a.openRiftById(o.id)) break;
    await new Promise(r=>setTimeout(r,110));
    if(a.panel.open){ a.panel.demo('right'); await new Promise(r=>setTimeout(r,220)); try{a.panel.close();}catch{} }
    await new Promise(r=>setTimeout(r,90));
  }
});
await page.waitForTimeout(1500);
await page.mouse.click(800, 450);
await page.waitForTimeout(300);
await run('AFTER 5 seals:');
// what does seal 7..10 buy?
const beyond = await page.evaluate(async () => {
  const a = window.__ascent;
  for (let i=0;i<400;i++){
    const n = [...a.mastery.state.values()].filter(x=>x.mastered).length;
    if (n >= 10) break;
    const o = a.nextObjective(); if(!o) break;
    if(!a.openRiftById(o.id)) break;
    await new Promise(r=>setTimeout(r,100));
    if(a.panel.open){ a.panel.demo('right'); await new Promise(r=>setTimeout(r,200)); try{a.panel.close();}catch{} }
    await new Promise(r=>setTimeout(r,80));
  }
  return { seals: [...a.mastery.state.values()].filter(x=>x.mastered).length, kit: a.kit.state(), state: a.state(), next: a.nextObjective() };
});
console.log('\nAFTER ALL SEALS:', beyond.seals, 'held', JSON.stringify(beyond.kit.held));
console.log('move numbers:', JSON.stringify(beyond.kit.move));
console.log('integrity:', beyond.state.integrity, 'shards', beyond.state.shards, 'caches', JSON.stringify(beyond.state.caches), 'session', JSON.stringify(beyond.state.session).slice(0,400));
console.log('nextObjective after everything mastered:', JSON.stringify(beyond.next));
await page.screenshot({ path: 'shots/critic-seal/all-sealed.png' });
console.log('errors:', errs.length, errs.slice(0,5));
await browser.close();
