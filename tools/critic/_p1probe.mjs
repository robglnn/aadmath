/**
 * P1 probe — layering, clipping, dead air, and undefined words.
 *
 * Drives a COLD session with real keys and a real mouse. `window.__ascent` is
 * read for facts only (never to make progress) because that debug path has
 * hidden three rounds of false fixes in this project.
 *
 *   node tools/critic/_p1probe.mjs [--url ...] [--out shots/p1/run]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/p1/run'));
const HEADED = process.argv.includes('--headed');
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: !HEADED,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: 1440, height: 900 } });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) });

// ---------------------------------------------------------------- instrument
// Every named surface, its live z-index, its rect, and whether it is painting.
const PROBE = `(() => {
  const NAMES = [
    ['.rift', 'rift panel'], ['.kit-toast', 'kit grant card'], ['.meta-comms', 'marlow'],
    ['.meta-rite', 'rank rite'], ['.gd-card', 'objective card'], ['.gd-prompt', 'interact prompt'],
    ['.fc', 'controls card'], ['.fc-pill', 'controls pill'], ['.meta-quest', 'chapter card'],
    ['.ses-band', 'session band'], ['.meta-turn', 'turn card'], ['.hud-top', 'rig'],
    ['.buildbar', 'hotbar'], ['.kit', 'kit strip'], ['.menu', 'esc menu'], ['.rp', 'report'],
    ['.rp-launch', 'progress launcher'], ['.toast', 'toast'], ['.meta-open', 'cold open'],
    ['.ses-close', 'close card'], ['.fcs', 'stuck card'], ['.langs', 'langs'],
  ];
  const vis = (el) => {
    const s = getComputedStyle(el);
    if (s.visibility === 'hidden' || s.display === 'none') return 0;
    let o = parseFloat(s.opacity);
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const ps = getComputedStyle(p);
      if (ps.visibility === 'hidden' || ps.display === 'none') return 0;
      o *= parseFloat(ps.opacity);
    }
    return o;
  };
  const out = [];
  for (const [sel, label] of NAMES) {
    for (const el of document.querySelectorAll(sel)) {
      const r = el.getBoundingClientRect();
      const s = getComputedStyle(el);
      out.push({
        sel, label, z: s.zIndex, pos: s.position,
        opacity: +vis(el).toFixed(3),
        rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
        painting: vis(el) > 0.02 && r.width > 1 && r.height > 1,
      });
    }
  }
  return out;
})()`;

// Any element whose own box clips its own text.
const CLIP = `(() => {
  const bad = [];
  const sels = ['.meta-text', '.meta-text .body', '.gd-card', '.gd-what', '.gd-why',
                '.kit-toast', '.kit-toast i', '.fc', '.meta-quest', '.rite-cite',
                '.mw-text', '.marlow'];
  for (const sel of sels) {
    for (const el of document.querySelectorAll(sel)) {
      const s = getComputedStyle(el);
      if (s.visibility === 'hidden' || s.display === 'none') continue;
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const clipV = el.scrollHeight - el.clientHeight > 1;
      const clipH = el.scrollWidth - el.clientWidth > 1;
      const hidden = s.overflow !== 'visible' || s.overflowY !== 'visible' || s.overflowX !== 'visible';
      if ((clipV || clipH) && hidden) {
        bad.push({ sel, overflow: s.overflow + '/' + s.overflowX + '/' + s.overflowY,
                   need: [el.scrollWidth, el.scrollHeight], have: [el.clientWidth, el.clientHeight],
                   text: (el.textContent || '').slice(0, 120) });
      }
    }
  }
  return bad;
})()`;

const marlowNow = `(() => {
  const b = document.querySelector('.meta-comms .body');
  const c = document.querySelector('.meta-comms');
  if (!b) return null;
  return { text: b.textContent, showing: c.classList.contains('show'),
           talking: c.classList.contains('talk') };
})()`;

const log = [];
const record = async (tag, extra = {}) => {
  const surfaces = await page.evaluate(PROBE);
  const clips = await page.evaluate(CLIP);
  const mw = await page.evaluate(marlowNow);
  const painting = surfaces.filter((s) => s.painting);
  log.push({ tag, t: Date.now() - T0, painting, clips, marlow: mw, ...extra });
  return { painting, clips, mw };
};

const T0 = Date.now();
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); sessionStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });

// =============================== 1. THE FIRST 100 SECONDS OF MARLOW =========
// Sample the companion channel every 250 ms and keep every distinct full frame
// of text, so a line that is clipped or cut is visible in the transcript.
const seen = new Map();
let clipHits = [];
for (let i = 0; i < 400; i++) {           // 100 s
  const mw = await page.evaluate(marlowNow);
  if (mw?.showing && mw.text) {
    const prev = seen.get(mw.text.slice(0, 24)) || '';
    if (mw.text.length >= prev.length) seen.set(mw.text.slice(0, 24), mw.text);
  }
  const c = await page.evaluate(CLIP);
  if (c.length) clipHits.push({ t: ((Date.now() - T0) / 1000).toFixed(1), c });
  if (i === 20) await shot('10-marlow-early');
  if (i === 60) await shot('11-marlow-l3');
  await page.waitForTimeout(250);
}
await shot('12-after-100s');
const lines = [...seen.values()];

// =============================== 2. CONTROLS CARD ===========================
// Perform every core verb with real input, then watch whether the card leaves.
// Pointer lock first — `input.lookTravel` only accumulates from locked mouse
// movement, so a LOOK row can never tick without it.
await page.mouse.click(720, 450);
await page.waitForTimeout(400);
for (let i = 0; i < 60; i++) {
  await page.mouse.move(720 + (i % 2 ? 60 : -60), 450 + (i % 3 ? 20 : -20));
  await page.waitForTimeout(24);
}
await page.keyboard.down('KeyW'); await page.waitForTimeout(1600); await page.keyboard.up('KeyW');
await page.keyboard.press('Space'); await page.waitForTimeout(600);
await page.keyboard.down('Space'); await page.waitForTimeout(1100); await page.keyboard.up('Space');
await page.keyboard.press('KeyE'); await page.waitForTimeout(600);
// NO Escape. Escape is `hide(byHand)`, which sets `dismissed` and would make
// this measure the player dismissing the card rather than the card retiring —
// which is exactly the confusion that let the defect survive the first pass.
const verbs = await page.evaluate(() => {
  const rows = [...document.querySelectorAll('.fc-rows li')];
  return rows.map((li) => ({ v: li.dataset.v, done: li.classList.contains('done') }));
});
await record('verbs-performed', { verbs });
await shot('20-controls-verbs-ticked');
// Give the documented 1.5 s auto-dismiss ten times over.
await page.waitForTimeout(15000);
const ctlAfter = await page.evaluate(() => {
  const el = document.querySelector('.fc');
  const r = el.getBoundingClientRect();
  return { show: el.classList.contains('show'), opacity: getComputedStyle(el).opacity,
           rect: [Math.round(r.width), Math.round(r.height)] };
});
await record('controls-15s-after-all-verbs', { ctlAfter });
await shot('21-controls-15s-later');

await writeFile(path.join(OUT, 'report.json'),
  JSON.stringify({ lines, clipHits, log, errors }, null, 2));

console.log('\n=== MARLOW, first 100 s ===');
lines.forEach((l, i) => console.log(`  [${i}] (${l.length}) ${l}`));
console.log('\n=== CLIPPED SURFACES ===');
if (!clipHits.length) console.log('  none');
else for (const h of clipHits.slice(0, 6)) console.log(`  t+${h.t}s`, JSON.stringify(h.c));
console.log('\n=== CONTROLS CARD ===');
console.log('  verbs:', JSON.stringify((log.find((l) => l.verbs) || {}).verbs));
console.log('  15 s after every core verb:', JSON.stringify(ctlAfter));
console.log('\n=== CONSOLE ERRORS ===', errors.length ? errors : 'none');

await browser.close();
