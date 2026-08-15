/** The day's assay, measured through the real wallet (temporary probe). */
import { chromium } from 'playwright';
const URL = process.argv[2] || 'http://127.0.0.1:4488';
const b = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
const p = await (await b.newContext({ viewport: { width: 1280, height: 800 } })).newPage();
const errs = [];
p.on('pageerror', (e) => errs.push(e.message));
await p.addInitScript(() => { try { localStorage.clear(); } catch { /* */ } });
await p.goto(URL, { waitUntil: 'domcontentloaded' });
await p.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await p.waitForTimeout(2500);

const r = await p.evaluate(() => {
  const A = window.__ascent;
  const out = [];
  const before = A.state().shards;
  let offered = 0;
  for (let i = 0; i < 260; i++) {
    const n = i % 40 === 0 ? 120 : 6;    // a cache now and then, veins between
    offered += n;
    A.earn(n, i % 40 === 0 ? 'cache' : 'vein');
    if (offered % 260 < 6) out.push({ offered, paid: A.state().shards - before });
  }
  return { offered, paid: A.state().shards - before, marks: out.slice(0, 8) };
});
console.log(`one day, ground only: offered ${r.offered}, paid ${r.paid}  (${Math.round(100 * r.paid / r.offered)}%)`);
for (const m of r.marks) console.log(`   at ${m.offered} offered -> ${m.paid} paid`);

// The rule is on screen, once.
await p.waitForTimeout(1600);
await p.screenshot({ path: 'shots/close/assay-strip.png' });
const note = await p.evaluate(() => [...document.querySelectorAll('.led-row.note .led-why')].map((e) => e.textContent));
console.log('strip note: ' + JSON.stringify(note));

// A question still pays in full, all day.
const learn = await p.evaluate(() => {
  const A = window.__ascent;
  const b0 = A.state().shards;
  for (let i = 0; i < 50; i++) A.earn(2, 'seal');
  return A.state().shards - b0;
});
console.log(`50 sealed rifts after all that ground: ${learn} (must be 100)`);

// Tomorrow is a fresh seam.
await p.evaluate(() => window.__ascent.advanceDays(1));
const tom = await p.evaluate(() => {
  const A = window.__ascent;
  const b0 = A.state().shards;
  for (let i = 0; i < 20; i++) A.earn(6, 'vein');
  return A.state().shards - b0;
});
console.log(`120 offered on the next morning: ${tom} (must be 120)`);
console.log(`errors: ${errs.length}`);
await b.close();
