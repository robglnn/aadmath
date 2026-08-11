/**
 * TAG COLLISION, IN MOTION.
 *
 * The default spawn is one frame. This walks the real game around the landing —
 * up to the foundry, across the drift, onto a dais — sampling the same glyph-box
 * assertion many times a second, because a ledger that only holds still is not a
 * ledger. Reports the worst frame it saw, per viewport, per locale.
 *
 *   node tools/critic/_tagdrive.mjs --url http://127.0.0.1:5173 --out shots/tagdrive
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/tagdrive'));
const LOCS = arg('locs', 'en,pl').split(',');
await mkdir(OUT, { recursive: true });

const VIEWS = [
  { tag: 'p390', w: 390, h: 844, touch: true },
  { tag: 'p414', w: 414, h: 896, touch: true },
  { tag: 'd1280', w: 1280, h: 720, touch: false },
  { tag: 'd1600', w: 1600, h: 900, touch: false },
];

/** Only the layers this hotfix owns count as a world tag. */
const WORLD = ['afd-call', 'bk-tag', 'field-tag', 'afd-head'];

const MEASURE = (world) => {
  const owner = (el) => {
    for (const c of world) if (el.closest('.' + c)) return c;
    const p = el.closest('[class]');
    return p ? String(p.className).split(/\s+/)[0] : el.tagName.toLowerCase();
  };
  const shown = (el) => {
    let n = el, o = 1;
    while (n && n.nodeType === 1) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
      o *= Number(cs.opacity);
      if (o < 0.06) return 0;
      n = n.parentElement;
    }
    return o;
  };
  const boxes = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let n = w.nextNode(); n; n = w.nextNode()) {
    if (!n.nodeValue || !n.nodeValue.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest('#boot')) continue;
    if (!shown(el)) continue;
    const r = document.createRange(); r.selectNodeContents(n);
    for (const b of r.getClientRects()) {
      if (b.width < 2 || b.height < 2) continue;
      if (b.right < 0 || b.bottom < 0 || b.left > innerWidth || b.top > innerHeight) continue;
      boxes.push({ o: owner(el), t: n.nodeValue.trim().slice(0, 40),
        x: b.left, y: b.top, w: b.width, h: b.height });
    }
  }
  const hits = [];
  for (let i = 0; i < boxes.length; i++) for (let j = i + 1; j < boxes.length; j++) {
    const a = boxes[i], b = boxes[j];
    if (a.o === b.o) continue;
    // Only intersections a world tag is party to: everything else on the glass
    // belongs to another owner and is reported, not fixed, by this pass.
    if (!world.includes(a.o) && !world.includes(b.o)) continue;
    const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
    const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
    if (ox > 1 && oy > 1) hits.push({ a: `${a.o}:${a.t}`, b: `${b.o}:${b.t}`, ox: Math.round(ox), oy: Math.round(oy) });
  }
  return hits;
};

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const errors = [];
const worst = [];
let total = 0, frames = 0;

for (const v of VIEWS) {
  for (const loc of LOCS) {
    const ctx = await browser.newContext({
      viewport: { width: v.w, height: v.h }, deviceScaleFactor: 2,
      isMobile: v.touch, hasTouch: v.touch,
    });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${v.tag}/${loc}: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`${v.tag}/${loc}: ${e.message}`));
    await page.addInitScript((l) => { try { localStorage.clear(); localStorage.setItem('ascent.locale', l); } catch { /* */ } }, loc);
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });
    await page.waitForTimeout(2500);

    // A tour of the landing: the foundry deck, the drift, the near dais, the
    // far dais, and a look back at all of it. Positions are set on the real
    // player, so the real camera, the real rifts and the real hail respond.
    const STOPS = [
      [0, 26, Math.PI], [0, 14, Math.PI], [-6, 6, Math.PI * 0.8],
      [10, 4, -0.6], [18, -6, 0.2], [4, -18, 1.4],
      [-14, -10, 2.6], [-2, 34, 0.1], [0, 40, Math.PI],
    ];
    let bad = { n: 0 };
    for (const [x, z, yaw] of STOPS) {
      await page.evaluate(([px, pz, py]) => {
        const a = window.__ascent;
        a.player.pos.set(px, (a.player.groundAt(px, pz) ?? 12) + 0.6, pz);
        a.player.vel.set(0, 0, 0);
        a.player.yaw = py; a.player.pitch = -0.08;
      }, [x, z, yaw]);
      for (let k = 0; k < 6; k++) {
        await page.waitForTimeout(120);
        const hits = await page.evaluate(MEASURE, WORLD);
        frames++; total += hits.length;
        if (hits.length > bad.n) bad = { n: hits.length, at: [x, z], hits };
      }
    }
    if (bad.n) {
      console.log(`[HIT] ${v.tag}/${loc} worst frame: ${bad.n} at ${JSON.stringify(bad.at)}`);
      for (const h of bad.hits) console.log(`   ${h.a}\n x ${h.b}  (${h.ox}x${h.oy})`);
      await page.screenshot({ path: path.join(OUT, `${v.tag}-${loc}-worst.png`) });
    } else {
      console.log(`[ok ] ${v.tag}/${loc} — 54 frames across 9 vantage points, 0 world-tag intersections`);
      await page.screenshot({ path: path.join(OUT, `${v.tag}-${loc}-end.png`) });
    }
    worst.push({ view: v.tag, loc, worst: bad });
    await ctx.close();
  }
}

await writeFile(path.join(OUT, 'tagdrive.json'), JSON.stringify({ total, frames, errors, worst }, null, 2));
console.log(`\n=== ${total} world-tag intersections over ${frames} sampled frames, ${errors.length} console error(s) ===`);
for (const e of errors.slice(0, 10)) console.log('  ERR', e);
await browser.close();
process.exit(total || errors.length ? 1 : 0);
