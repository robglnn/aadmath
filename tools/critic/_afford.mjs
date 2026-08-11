/**
 * AFFORDANCE PROBE — walk into things with real hands and report what the game
 * said back.
 *
 * The client's report was "lots of ring portal looking things but nothing
 * happens when i go in them". `openRiftById` cannot see that bug, because it
 * skips the walk-in path entirely. This drives the keyboard.
 *
 *   tools/critic/frozen.sh tools/critic/_afford.mjs [--out shots/afford]
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/afford'));
await mkdir(OUT, { recursive: true });

const b = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await b.newContext({ viewport: { width: 1600, height: 900 }, deviceScaleFactor: 1 });
const p = await ctx.newPage();
const errs = [];
p.on('pageerror', (e) => errs.push('pageerror: ' + e.message + '\n' + (e.stack || '')));
p.on('console', (m) => { if (m.type() === 'error') errs.push('console: ' + m.text()); });

const shot = async (n) => { await p.screenshot({ path: path.join(OUT, n + '.png') }); };

await p.goto(URL, { waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
// FRESH SAVE — the state the client was in.
await p.evaluate(() => { localStorage.clear(); });
await p.reload({ waitUntil: 'networkidle' });
await p.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
await p.waitForTimeout(3000);
await p.evaluate(() => document.getElementById('boot')?.classList.add('gone'));
// the orders card, dismissed the way a player dismisses it
await p.mouse.move(800, 450);
const go = p.locator('.sc-go');
if (await go.count()) { await go.first().click({ timeout: 4000 }).catch(() => {}); }
await p.waitForTimeout(600);

const say = () => p.evaluate(() => ({
  say: document.querySelector('.hud-say')?.textContent || document.querySelector('.say')?.textContent || '',
  toast: [...document.querySelectorAll('.toast, .hud-toast, .flash')].map((e) => e.textContent).join(' | '),
  comms: [...document.querySelectorAll('.comms, .comms-line, .cm-line')].map((e) => e.textContent.trim()).filter(Boolean).slice(-2).join(' | '),
  panel: !!window.__ascent.panel.open,
  visible: [...document.querySelectorAll('#ui *')].filter((e) => e.textContent && e.children.length === 0 && e.offsetParent && e.textContent.trim().length > 2).map((e) => e.className + ': ' + e.textContent.trim()).slice(0, 24),
}));

const rifts = await p.evaluate(() => window.__ascent.rifts.list.map((r) => ({
  id: r.id, locked: r.locked, mastered: r.mastered, pos: r.pos.toArray(), tier: r.tier,
})));
console.log('RIFTS:', JSON.stringify(rifts.map((r) => [r.id, r.locked ? 'LOCKED' : 'open']), null));

/** Stand `d` metres from a point, facing it, then walk in with the W key. */
async function walkInto(label, target, { d = 16, seconds = 4.2, press = null, stop = 3 } = {}) {
  await p.evaluate(([tx, ty, tz, dd]) => {
    const A = window.__ascent;
    const px = tx, pz = tz + dd;
    const gy = A.islandAt(px, pz);
    A.player.pos.set(px, (gy === null ? ty : gy) + 0.6, pz);
    A.player.vel.set(0, 0, 0);
    A.player.yaw = Math.PI; // forward = (sin, cos) = (0,-1): toward -z
  }, [target[0], target[1], target[2], d]);
  await p.waitForTimeout(700);
  await shot(label + '-a-approach');
  const approach = await say();

  await p.keyboard.down('KeyW');
  const frames = [];
  for (let i = 0; i < Math.round(seconds / 0.35); i++) {
    await p.waitForTimeout(350);
    frames.push(await p.evaluate(([tx, ty, tz]) => {
      const A = window.__ascent;
      const near = A.rifts.nearest(A.player.pos);
      return {
        d: +Math.hypot(A.player.pos.x - tx, A.player.pos.z - tz).toFixed(1),
        dy: +(A.player.pos.y - ty).toFixed(1),
        panel: !!A.panel.open,
        near: near ? near.id : null,
      };
    }, target));
    const f = frames[frames.length - 1];
    if (f.panel || f.d < stop) break;
  }
  await p.keyboard.up('KeyW');
  await p.waitForTimeout(400);
  await shot(label + '-b-contact');
  const contact = await say();
  const diag = await p.evaluate(([tx, ty, tz]) => {
    const A = window.__ascent;
    const near = A.rifts.nearest(A.player.pos);
    const all = A.rifts.list.map((r) => +A.player.pos.distanceTo(r.group.position).toFixed(1));
    return {
      uiOpen: A.input.uiOpen, locked: A.input.locked, interact: A.input.interact,
      playerY: +A.player.pos.y.toFixed(1), targetY: ty,
      nearest: near ? near.id : null, dists: all.slice(0, 3),
    };
  }, target);
  console.log('  diag    :', JSON.stringify(diag));
  const near = frames.reduce((m, f) => Math.min(m, f.d), 99);

  let after = null;
  if (press) {
    await p.keyboard.press(press);
    await p.waitForTimeout(900);
    await shot(label + '-c-' + press);
    after = await say();
  }
  console.log(`\n## ${label}  closest=${near}m  panelOpened=${frames.some((f) => f.panel)}`);
  console.log('  walk    :', frames.map((f) => `${f.d}/${f.dy}${f.near ? '*' : ''}`).join(' '));
  console.log('  approach:', JSON.stringify({ say: approach.say, toast: approach.toast, comms: approach.comms }));
  console.log('  contact :', JSON.stringify({ say: contact.say, toast: contact.toast, comms: contact.comms, panel: contact.panel }));
  if (after) console.log(`  ${press}     :`, JSON.stringify({ say: after.say, toast: after.toast, comms: after.comms, panel: after.panel }));
  if (contact.panel) { await p.keyboard.press('Escape'); await p.waitForTimeout(500); }
  return { near, contact, approach, after };
}

const open = rifts.find((r) => !r.locked);
const locked = rifts.find((r) => r.locked);
await walkInto('rift-open-' + open.id, open.pos);
await walkInto('rift-locked-' + locked.id, locked.pos);

// ---- the diamonds: a lit vein, then the husks it leaves behind ------------
const vein = await p.evaluate(() => {
  const A = window.__ascent;
  const v = A.drift.veins.find((q) => q.cool <= 0 && q.motes.length);
  return { x: v.x, z: v.z, y: A.islandAt(v.x, v.z) ?? 20 };
});
await walkInto('vein', [vein.x, vein.y, vein.z], { d: 14, seconds: 5, stop: 0.6 });
await p.waitForTimeout(2200);
await shot('vein-d-spent');
console.log('  spent   :', JSON.stringify(await say()));

// ---- the edge of the world ------------------------------------------------
const edge = await p.evaluate(() => {
  const A = window.__ascent;
  const R = A.world?.ISLAND_R ? A.world.ISLAND_R * 1.62 : 272;
  A.player.pos.set(0, 260, R - 110);
  A.player.vel.set(0, 0, 0);
  A.player.yaw = 0;              // forward = +z, straight at the edge
  return R;
});
await p.waitForTimeout(900);
await shot('verge-a-approach');
// wing out, exactly the way a hand does it
await p.keyboard.press('Space'); await p.waitForTimeout(260);
await p.keyboard.press('Space'); await p.waitForTimeout(200);
await p.keyboard.press('Space');
await p.keyboard.down('KeyW');
for (let i = 0; i < 22; i++) {
  await p.waitForTimeout(300);
  const r = await p.evaluate(() => Math.hypot(window.__ascent.player.pos.x, window.__ascent.player.pos.z));
  if (r > edge - 1.5) break;
}
await p.keyboard.up('KeyW');
await p.waitForTimeout(500);
await shot('verge-b-contact');
console.log('  verge   :', JSON.stringify(await say()));

// ---- the field props: motes (cyan), husks (spent/dark), caches (gold seam) --
const field = await p.evaluate(() => {
  const A = window.__ascent;
  const st = A.state();
  return { drift: st.drift, caches: st.caches, kit: st.kit, anchors: A.anchors() };
});
console.log('\nFIELD STATE:', JSON.stringify(field).slice(0, 800));

if (errs.length) console.log('\nERRORS:\n' + errs.slice(0, 8).join('\n'));
else console.log('\nERRORS: none');
await b.close();
