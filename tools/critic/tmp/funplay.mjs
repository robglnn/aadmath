/**
 * A sustained, human-shaped play session. Keys and mouse only where a hand
 * would use them. Reads state between beats and narrates what changed.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/funplay'));
const W = 1600, H = 900;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: [
  '--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
  '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit',
]});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 2 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));

const notes = [];
const say = (s) => { notes.push(s); console.log(s); };
let n = 0;
async function shot(name, ms = 250) {
  await page.waitForTimeout(ms);
  await page.screenshot({ path: path.join(OUT, `${String(++n).padStart(2,'0')}-${name}.png`) });
}
const st = () => page.evaluate(() => {
  const s = window.__ascent.state();
  return { fps: Math.round(s.fps), integrity: s.integrity, rank: s.rank, shards: s.shards,
    sealed: s.sealed, chapter: s.chapter, session: s.session,
    skills: Object.fromEntries(Object.entries(s.skills || {}).map(([k,v]) => [k, `pL=${(v.pL||0).toFixed(2)} att=${v.attempts} ok=${v.correct} m=${v.mastered?1:0} d=${v.difficulty}`])) };
});

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
// fresh save so this is an actual first session
await page.evaluate(() => localStorage.removeItem('ascent.save'));
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });

// ---- ARRIVAL: watch the opening for real seconds, not one frame -------------
await shot('boot', 400);
await shot('arrival-2s', 1800);
await shot('arrival-6s', 4000);
await shot('arrival-11s', 5000);
say('state@11s ' + JSON.stringify(await st()));

// ---- MOVE: pointer lock, look, run, sprint ---------------------------------
await page.mouse.move(W/2, H/2);
await page.mouse.click(W/2, H/2);
await page.waitForTimeout(300);
say('after-first-click buildTarget=' + JSON.stringify(await page.evaluate(() => window.__ascent.buildTarget())));
await shot('after-click', 200);

const before = await page.evaluate(() => window.__ascent.player.pos.toArray().map(v => +v.toFixed(1)));
await page.keyboard.down('KeyW');
await page.waitForTimeout(1200);
await shot('walk', 100);
await page.keyboard.down('ShiftLeft');
await page.mouse.move(W/2 + 240, H/2, { steps: 12 });
await page.waitForTimeout(1600);
await shot('sprint', 100);
const after = await page.evaluate(() => window.__ascent.player.pos.toArray().map(v => +v.toFixed(1)));
say(`travel ${JSON.stringify(before)} -> ${JSON.stringify(after)}`);

// jump, double jump, glide
await page.keyboard.press('Space');
await page.waitForTimeout(280);
await shot('jump', 60);
await page.keyboard.press('Space');
await page.waitForTimeout(240);
await shot('doublejump', 60);
await page.keyboard.press('KeyG');
await page.waitForTimeout(700);
await shot('glide', 60);
await page.waitForTimeout(1500);
await shot('glide-long', 60);
await page.keyboard.up('ShiftLeft');
await page.keyboard.up('KeyW');
await page.waitForTimeout(1200);
await shot('landed', 200);
say('post-move ' + JSON.stringify(await st()));

// ---- BUILD: place a stack with real clicks and stand on it -----------------
const p0 = await page.evaluate(() => window.__ascent.player.pos.y);
for (let i = 0; i < 5; i++) {
  await page.mouse.down(); await page.mouse.up();
  await page.waitForTimeout(200);
  await page.keyboard.press('Space');
  await page.waitForTimeout(500);
}
await shot('build-stack', 400);
const p1 = await page.evaluate(() => window.__ascent.player.pos.y);
say(`build: y ${p0.toFixed(1)} -> ${p1.toFixed(1)}  ${JSON.stringify(await page.evaluate(() => window.__ascent.buildTarget()))}`);
// ramp + floor variety
await page.keyboard.press('Digit2');
await page.mouse.down(); await page.mouse.up();
await page.waitForTimeout(200);
await page.keyboard.press('Digit3');
await page.mouse.down(); await page.mouse.up();
await shot('build-variety', 500);

// ---- WALK TO A RIFT on foot and press E ------------------------------------
const near = await page.evaluate(() => {
  const a = window.__ascent;
  const p = a.player.pos;
  let best = null, bd = 1e9;
  for (const r of a.rifts.list) { const d = p.distanceTo(r.group.position); if (!r.locked && d < bd) { bd = d; best = r; } }
  return best ? { id: best.id, pos: best.group.position.toArray(), dist: +bd.toFixed(1), locked: best.locked } : null;
});
say('nearest rift ' + JSON.stringify(near));
// stand a short walk away, then actually walk in
await page.evaluate((p) => {
  const a = window.__ascent;
  a.player.pos.set(p[0], p[1] + 2, p[2] + 14); a.player.vel.set(0,0,0);
  a.player.yaw = Math.PI; a.player.pitch = -0.05;
}, near.pos);
await page.waitForTimeout(600);
await shot('rift-approach', 400);
await page.keyboard.down('KeyW');
await page.waitForTimeout(1800);
await page.keyboard.up('KeyW');
await shot('rift-close', 400);
await page.keyboard.press('KeyE');
await shot('rift-open', 900);

// ---- GET ONE WRONG ON PURPOSE ---------------------------------------------
const wrong = await page.evaluate(() => {
  const p = window.__ascent.panel;
  const it = p.item;
  const bad = Number.isFinite(Number(it.answer)) ? Number(it.answer) + 2 : 'zzz';
  return window.__ascent.enter(bad);
});
say('WRONG entry -> ' + JSON.stringify(wrong));
await shot('wrong-immediate', 500);
await shot('wrong-settled', 1600);
say('after-wrong ' + JSON.stringify(await st()));

// what does the panel say / offer now?
const wrongDom = await page.evaluate(() => {
  const el = document.querySelector('.rift');
  return el ? el.innerText.replace(/\n{2,}/g, '\n').slice(0, 1400) : null;
});
say('--- PANEL AFTER WRONG ---\n' + wrongDom + '\n---');
await shot('wrong-panel-2', 1800);

// ---- NOW GET SEVERAL RIGHT -------------------------------------------------
for (let i = 0; i < 10; i++) {
  const r = await page.evaluate(() => {
    const a = window.__ascent;
    if (!a.panel.open) return { closed: true };
    return a.enter(a.panel.item.answer);
  });
  if (r.closed) { say(`panel closed after ${i} correct`); break; }
  say(`right#${i+1} ${JSON.stringify({ form: r.form, ok: r.entry === String(r.answer) })}`);
  await page.waitForTimeout(1100);
  if (i === 0) await shot('right-1', 200);
  if (i === 2) await shot('right-3', 200);
  if (i === 5) await shot('right-6', 200);
}
await shot('after-correct-run', 1200);
say('after-run ' + JSON.stringify(await st()));

// ---- SEAL: close and see the world react ----------------------------------
await page.evaluate(() => window.__ascent.panel.open && window.__ascent.panel.close());
await page.waitForTimeout(1400);
await shot('world-after-seal', 800);
const dom1 = await page.evaluate(() => document.body.innerText.replace(/\n{2,}/g,'\n').slice(0, 1200));
say('--- HUD TEXT ---\n' + dom1 + '\n---');

// ---- KEEP GOING: seal several rifts, look for progression change ----------
const ids = await page.evaluate(() => window.__ascent.rifts.list.map(r => r.id));
say('rift ids: ' + ids.join(', '));
for (const id of ids.slice(0, 8)) {
  const opened = await page.evaluate((i) => window.__ascent.openRiftById(i), id);
  if (!opened) continue;
  await page.waitForTimeout(500);
  for (let k = 0; k < 12; k++) {
    const open = await page.evaluate(() => window.__ascent.panel.open);
    if (!open) break;
    await page.evaluate(() => window.__ascent.enter(window.__ascent.panel.item.answer));
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(900);
  const s = await st();
  say(`sealed ${id} -> integrity=${s.integrity} rank=${s.rank} shards=${s.shards} sealed=${s.sealed} chapter=${JSON.stringify(s.chapter)}`);
  await shot(`prog-${id}`, 700);
  await page.evaluate(() => window.__ascent.panel.open && window.__ascent.panel.close());
  await page.waitForTimeout(700);
}
await shot('progression-world', 1200);
const dom2 = await page.evaluate(() => document.body.innerText.replace(/\n{2,}/g,'\n').slice(0, 1600));
say('--- HUD AFTER RUN ---\n' + dom2 + '\n---');

// progress screen
await page.evaluate(() => [...document.querySelectorAll('button,[role=button],.btn')].find(b => /progress/i.test(b.textContent))?.click());
await shot('progress-screen', 1200);
const dom3 = await page.evaluate(() => document.body.innerText.replace(/\n{2,}/g,'\n').slice(0, 2500));
say('--- PROGRESS SCREEN ---\n' + dom3 + '\n---');

// session state / rest beat
say('SESSION ' + JSON.stringify(await page.evaluate(() => window.__ascent.session.state())));

await writeFile(path.join(OUT, 'notes.txt'), notes.join('\n'));
await writeFile(path.join(OUT, 'console.txt'), logs.join('\n'));
console.log('\nCONSOLE ERRORS: ' + logs.filter(l => l.startsWith('pageerror') || l.startsWith('error')).length);
await browser.close();
