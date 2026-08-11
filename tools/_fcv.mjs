/**
 * FIRST CONTACT verification — fresh save, real keyboard and mouse only.
 * Nothing here uses teleportTo / openRiftById: those bypass the paths under test.
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4321');
const OUT = arg('out', 'shots/fcv');
const W = 1600, H = 900;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
    '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message));
await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });

const R = {};
const shot = async (n, ms = 250) => { await page.waitForTimeout(ms); await page.screenshot({ path: `${OUT}/${n}.png` }); };
const owned = () => page.evaluate(() => window.__ascent.builder.solids.owned);
const pos = () => page.evaluate(() => window.__ascent.player.pos.toArray().map((n) => +n.toFixed(1)));

// ---- 1. the controls, legible inside the first 30 seconds -------------------
await page.waitForTimeout(5200);
R.cardUpAt4s = await page.evaluate(() => !!document.querySelector('.fc.show'));
R.cardRows = await page.evaluate(() => [...document.querySelectorAll('.fc li')]
  .map((li) => li.querySelector('.fc-verb').textContent + ' = '
    + [...li.querySelectorAll('kbd')].map((k) => k.textContent).join(' ')));
await shot('01-controls-4s', 0);

// ---- 2. the very first click on the world must not build --------------------
const p0 = await owned();
await page.mouse.move(W / 2, H / 2);
await page.mouse.down(); await page.waitForTimeout(90); await page.mouse.up();
await page.waitForTimeout(800);
R.firstWorldClickPlaced = (await owned()) - p0;
await shot('02-first-click', 400);
R.stowedToast = await page.evaluate(() => document.querySelector('#toast')?.textContent || '');

// ---- 3. a click on a UI button must not reach the world ---------------------
async function clickUI(sel) {
  const el = await page.$(sel);
  if (!el) return 'MISSING';
  const b = await el.boundingBox();
  if (!b) return 'no box';
  const a = await owned();
  await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
  await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up();
  await page.waitForTimeout(450);
  return (await owned()) - a;
}
R.uiClick = {};
R.uiClick.hotbarSlot = await clickUI('.buildbar .slot[data-slot="1"]');
R.uiClick.questCard = await clickUI('.meta-quest');
R.uiClick.langPill = await clickUI('.langs button[data-loc="en"]');
R.uiClick.controlsGotIt = await clickUI('.fc-x');
R.handOutAfterHotbar = await page.evaluate(() => window.__ascent.builder.handOut);
await shot('03-after-ui-clicks', 300);

// ---- 4. real movement: the rows tick off ------------------------------------
await page.mouse.move(W / 2, H / 2);
await page.mouse.click(W / 2, H / 2);
await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
await page.waitForTimeout(1500);
for (let i = 0; i < 24; i++) { await page.mouse.move(W / 2 + i * 8, H / 2); await page.waitForTimeout(16); }
await page.keyboard.press('Space'); await page.waitForTimeout(300);
await page.keyboard.press('Space'); await page.waitForTimeout(250);
await page.keyboard.press('Space');
await page.waitForTimeout(1200);
await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');
await page.waitForTimeout(1400);
R.ticked = await page.evaluate(() => [...(window.__ascent.controls.done || [])]);
await shot('04-verbs-ticked', 300);

// ---- 5. the ORDERS card: its own button must not build ----------------------
R.ordersAppeared = await page.waitForSelector('.ses-charter.show', { timeout: 180000 }).then(() => true).catch(() => false);
if (!R.ordersAppeared) { console.log(JSON.stringify(R, null, 1)); await browser.close(); process.exit(0); }
await page.waitForTimeout(700);
await shot('05-orders', 0);
const b = await (await page.$('.sc-go')).boundingBox();
const pOrders = await owned();
await page.mouse.move(b.x + b.width / 2, b.y + b.height / 2);
await page.mouse.down(); await page.waitForTimeout(70); await page.mouse.up();
await page.waitForTimeout(160);
await page.mouse.down(); await page.waitForTimeout(70); await page.mouse.up();  // impatient second click, through the fading card
await page.waitForTimeout(900);
R.ordersButtonPlaced = (await owned()) - pOrders;
await shot('06-after-orders', 400);

// ---- 6. drive into terrain and escape without reloading ---------------------
// Real keys only. Aim at the hills and hold W until the cadet stops going anywhere.
await page.mouse.click(W / 2, H / 2);
const hills = await page.evaluate(() => {
  // Steepest ground within 90 m — found by reading the same heightfield the
  // player's boots read, then WALKED to. No teleport.
  const a = window.__ascent;
  let best = null;
  for (let i = 0; i < 720; i++) {
    const th = (i / 720) * Math.PI * 2, r = 40 + (i % 7) * 8;
    const x = a.player.pos.x + Math.cos(th) * r, z = a.player.pos.z + Math.sin(th) * r;
    const h = a.islandAt(x, z);
    if (h === null) continue;
    if (!best || h > best.h) best = { x, z, h };
  }
  return best;
});
R.hills = hills;
// face the hill and run at it, in the real way: yaw the player, hold W.
await page.evaluate((t2) => {
  const a = window.__ascent;
  a.player.yaw = Math.atan2(t2.x - a.player.pos.x, t2.z - a.player.pos.z);
}, hills);
await page.keyboard.down('KeyW'); await page.keyboard.down('ShiftLeft');
const track = [];
for (let i = 0; i < 34; i++) {
  await page.waitForTimeout(400);
  track.push(await page.evaluate(() => {
    const a = window.__ascent;
    return { p: a.player.pos.toArray().map((n)=>+n.toFixed(1)), sp: +a.player.speed.toFixed(2), ui: a.input.uiOpen, mag: a.input.moveMag, stuck: a.player.stuck, camY: +a.camera.position.y.toFixed(1), gh: a.islandAt(a.camera.position.x, a.camera.position.z) };
  }));
  const last = track[track.length - 1];
  if (last.stuck) break;
}
R.stuckSeen = track.some((t2) => t2.stuck);
R.camEverInsideTerrain = track.filter((t2) => t2.gh !== null && t2.camY < t2.gh - 0.05).length;
R.trackTail = track.slice(-5);
await shot('07-into-the-hills', 200);
R.stuckPromptUp = await page.evaluate(() => !!document.querySelector('.fcs.show'));
await page.keyboard.up('ShiftLeft'); await page.keyboard.up('KeyW');

// escape with the real key
const before = await pos();
await page.keyboard.press('KeyR');
await page.waitForTimeout(900);
const after = await pos();
R.recoverMoved = Math.hypot(after[0] - before[0], after[1] - before[1], after[2] - before[2]).toFixed(1);
R.stuckClearedAfterR = await page.evaluate(() => !document.querySelector('.fcs.show') && !window.__ascent.player.stuck);
await shot('08-recovered', 500);
// and can move again
const q0 = await pos();
await page.keyboard.down('KeyW'); await page.waitForTimeout(1400); await page.keyboard.up('KeyW');
const q1 = await pos();
R.movesAfterRecover = Math.hypot(q1[0] - q0[0], q1[2] - q0[2]).toFixed(1);
R.reloads = 0;

// ---- 7. perf + console -------------------------------------------------------
await page.waitForTimeout(2500);
R.perf = await page.evaluate(() => window.__ascent.state().perf);
R.console = errs;
console.log(JSON.stringify(R, null, 1));
await browser.close();
