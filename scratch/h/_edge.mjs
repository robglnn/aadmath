/**
 * EDGE RECOVERY, N TIMES, WITH A DISTRIBUTION.
 *
 * "passes at ~6.1s against a 6s bar and is flaky run to run" is a claim about
 * VARIANCE, and a single run cannot answer it. So: walk off the shard with real
 * keys, once with the wing shut and once with the jump button held (which is
 * what a panicking player does and is the input that defeated the old catch),
 * repeated, and print every time.
 */
import { chromium } from 'playwright';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4802');
const N = Number(arg('n', 6));
const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const page = await (await browser.newContext({ viewport: { width: 1280, height: 720 } })).newPage();
const errs = [];
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await page.waitForTimeout(3500);
const handBack = async () => {
  for (let i = 0; i < 8; i++) {
    if (!(await page.evaluate(() => !!window.__ascent.input.uiOpen))) return;
    let hit = false;
    for (const s of ['.sc-go', '.sx-more', '.sr-skip', '.ses-charter button', '.ses-rest button', '.rf-x']) {
      const el = await page.$(s);
      if (el && await el.isVisible().catch(() => false)) { await el.click().catch(() => {}); hit = true; break; }
    }
    if (!hit) await page.keyboard.press('Escape');
    await page.waitForTimeout(400);
  }
};
await handBack();
const facts = () => page.evaluate(() => {
  const a = window.__ascent, p = a.player.pos;
  return { x: p.x, y: p.y, z: p.z, g: a.islandAt(p.x, p.z), grounded: !!a.player.grounded,
    stuck: !!a.player.stuck, rec: a.player.recoveries | 0, caught: a.player.caught | 0,
    gliding: !!a.player.loco?.gliding };
});
const rows = [];
for (let i = 0; i < N; i++) {
  const wing = i % 2 === 1;
  // Put him on the coast facing out to sea — the starting condition only.
  const set = await page.evaluate(() => {
    const a = window.__ascent, W = a.world;
    // walk outward on a bearing until the island stops
    const ang = (Math.random() * Math.PI * 2);
    let r = 60;
    while (r < 220 && a.islandAt(Math.cos(ang) * r, Math.sin(ang) * r) !== null) r += 2;
    const x = Math.cos(ang) * (r - 14), z = Math.sin(ang) * (r - 14);
    const h = a.islandAt(x, z);
    if (h === null) return null;
    a.player.pos.set(x, h + 0.4, z);
    a.player.vel.set(0, 0, 0);
    a.player.yaw = ang < Math.PI ? Math.atan2(Math.cos(ang), Math.sin(ang)) : Math.atan2(Math.cos(ang), Math.sin(ang));
    a.player.yaw = Math.atan2(Math.cos(ang), Math.sin(ang));
    return { x, z, h, esc: W.escapable(x, z) };
  });
  if (!set) { i--; continue; }
  await page.waitForTimeout(700);
  const b = await facts();
  await page.keyboard.down('KeyW');
  await page.keyboard.down('ShiftLeft');
  if (wing) await page.keyboard.down('Space');
  const t0 = Date.now();
  let offAt = null, backAt = null, last = null;
  while ((Date.now() - t0) / 1000 < 45) {
    await page.waitForTimeout(90);
    const f = await facts();
    last = f;
    if (offAt === null && f.g === null && !f.grounded) offAt = (Date.now() - t0) / 1000;
    if (offAt !== null && f.grounded && f.g !== null) { backAt = (Date.now() - t0) / 1000; break; }
  }
  await page.keyboard.up('KeyW'); await page.keyboard.up('ShiftLeft');
  if (wing) await page.keyboard.up('Space');
  const a2 = await facts();
  rows.push({ wing, offAt, backAt, took: offAt !== null && backAt !== null ? +(backAt - offAt).toFixed(2) : null,
    rec: a2.rec - b.rec, caught: a2.caught - b.caught, end: [+a2.x.toFixed(0), +a2.y.toFixed(0), +a2.z.toFixed(0)] });
  console.log(`  run ${i + 1}${wing ? ' (wing held)' : '            '}  left at ${offAt === null ? '—' : offAt.toFixed(2) + 's'}  back at ${backAt === null ? 'NEVER' : backAt.toFixed(2) + 's'}  => ${rows[rows.length - 1].took === null ? 'LOST' : rows[rows.length - 1].took + 's'}  recoveries+${rows[rows.length - 1].rec} caught+${rows[rows.length - 1].caught}`);
  await page.waitForTimeout(700);
  await handBack();
}
const t = rows.map((r) => r.took).filter((v) => v !== null).sort((a, b) => a - b);
console.log(`\n${t.length}/${rows.length} returned. min ${t[0]}s  median ${t[t.length >> 1]}s  max ${t[t.length - 1]}s  spread ${(t[t.length - 1] - t[0]).toFixed(2)}s`);
console.log('errors:', errs.length, errs.slice(0, 3).join(' | '));
await browser.close();
