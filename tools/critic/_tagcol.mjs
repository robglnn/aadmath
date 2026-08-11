/**
 * TAG COLLISION PROBE — does any readable text in the frame sit on any other?
 *
 * Drives the real game on a clean save at the default spawn, across every
 * viewport and locale the hotfix has to hold, and measures the *glyph* boxes
 * (Range.getClientRects on the actual text nodes, not the padded card) of every
 * visible piece of UI. Two glyph boxes that intersect are, by definition, one
 * unreadable label — that is the whole assertion.
 *
 *   node tools/critic/_tagcol.mjs --out shots/tagcol [--url http://…]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/tagcol'));
const ONLY = arg('only', '');            // e.g. "p390" to shoot one viewport
const LOCS = (arg('locs', 'en,es,pl')).split(',');
const TIMES = (arg('times', '3500,8000,14000')).split(',').map(Number);
const SHOT = arg('shot', '1') !== '0';

await mkdir(OUT, { recursive: true });

const VIEWS = [
  { tag: 'p390', w: 390, h: 844, touch: true },
  { tag: 'p414', w: 414, h: 896, touch: true },
  { tag: 'd1280', w: 1280, h: 720, touch: false },
  { tag: 'd1600', w: 1600, h: 900, touch: false },
].filter((v) => !ONLY || v.tag === ONLY);

/** Runs in the page. Returns every visible text box, plus every intersection. */
const MEASURE = () => {
  // The whole page, not just #ui: the on-screen controls live in #app and a
  // world label is a click target that must never land on a thumb button.
  const root = document.body;
  const boxes = [];

  // The name a human would use for the thing this text belongs to, so a report
  // reads "afd-call x meta-comms" and not "div x div".
  const OWNERS = [
    ['.afd-call', 'afford-call'], ['.afd-head', 'afford-compass'],
    ['.bk-tag', 'beckon-tag'], ['.field-tag', 'cache-tag'],
    ['.gd-card', 'guide-card'], ['.gd-mark', 'guide-mark'], ['.gd-prompt', 'guide-prompt'],
    ['.hail', 'foundry-hail'], ['.meta-comms', 'marlow-card'], ['.meta-stamp', 'title-stamp'],
    ['.meta-quest', 'quest-card'], ['.meta-turn', 'chapter'], ['.rig', 'rig'],
    ['.toast', 'toast'], ['.marlow', 'hud-marlow'], ['.buildbar', 'buildbar'],
    ['.langs', 'langs'], ['.touch', 'touch'], ['#pad', 'touch'], ['.tc', 'touch'],
  ];
  const ownerOf = (el) => {
    for (const [sel, name] of OWNERS) { if (el.closest(sel)) return name; }
    return el.className && typeof el.className === 'string'
      ? el.className.split(/\s+/)[0] : el.tagName.toLowerCase();
  };

  // Effective visibility: an ancestor at opacity 0, visibility hidden or
  // display none makes the text unreadable and therefore not a collider.
  const shown = (el) => {
    let n = el, o = 1;
    while (n && n !== document.documentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return 0;
      o *= Number(cs.opacity);
      if (o < 0.06) return 0;
      n = n.parentElement;
    }
    return o;
  };

  const walker = document.createTreeWalker(root, NodeFilter.SHOW_TEXT);
  for (let n = walker.nextNode(); n; n = walker.nextNode()) {
    if (!n.nodeValue || !n.nodeValue.trim()) continue;
    const el = n.parentElement;
    if (!el || el.closest('#boot') || el.closest('script') || el.closest('style')) continue;
    const o = shown(el);
    if (!o) continue;
    const r = document.createRange();
    r.selectNodeContents(n);
    for (const rect of r.getClientRects()) {
      if (rect.width < 2 || rect.height < 2) continue;
      // Off-screen is not a collision.
      if (rect.right < 0 || rect.bottom < 0 || rect.left > innerWidth || rect.top > innerHeight) continue;
      boxes.push({
        owner: ownerOf(el), text: n.nodeValue.trim().slice(0, 46), op: Number(o.toFixed(2)),
        x: Math.round(rect.left), y: Math.round(rect.top),
        w: Math.round(rect.width), h: Math.round(rect.height),
      });
    }
  }

  const hits = [];
  for (let i = 0; i < boxes.length; i++) {
    for (let j = i + 1; j < boxes.length; j++) {
      const a = boxes[i], b = boxes[j];
      if (a.owner === b.owner) continue;   // one card's own lines are its layout
      const ox = Math.min(a.x + a.w, b.x + b.w) - Math.max(a.x, b.x);
      const oy = Math.min(a.y + a.h, b.y + b.h) - Math.max(a.y, b.y);
      if (ox > 1 && oy > 1) {
        hits.push({ a: `${a.owner}:${a.text}`, b: `${b.owner}:${b.text}`, ox, oy,
          ar: [a.x, a.y, a.w, a.h], br: [b.x, b.y, b.w, b.h] });
      }
    }
  }
  return { boxes, hits, tagState: window.__ascent?.afford?.state?.() ?? null };
};

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});

/** The layers this hotfix owns. An intersection touching one of these fails. */
const WORLD = ['afford-call', 'afford-compass', 'beckon-tag', 'cache-tag'];
const mine = (h) => WORLD.some((w) => h.a.startsWith(w + ':') || h.b.startsWith(w + ':'));

const errors = [];
const report = [];
let hitCount = 0;
let worldHits = 0;

const save = () => writeFile(path.join(OUT, 'tagcol.json'),
  JSON.stringify({ hitCount, errors, report }, null, 2));

for (const v of VIEWS) {
  for (const loc of LOCS) {
    const ctx = await browser.newContext({
      viewport: { width: v.w, height: v.h }, deviceScaleFactor: 2,
      isMobile: v.touch, hasTouch: v.touch,
    });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${v.tag}/${loc}: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`${v.tag}/${loc}: ${e.message}`));
    await page.addInitScript((l) => {
      try { localStorage.clear(); localStorage.setItem('ascent.locale', l); } catch { /* */ }
    }, loc);
    await page.goto(URL, { waitUntil: 'domcontentloaded' });
    await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60000 });

    let prev = 0;
    for (const at of TIMES) {
      await page.waitForTimeout(at - prev);
      prev = at;
      const m = await page.evaluate(MEASURE);
      const own = m.hits.filter(mine);
      hitCount += m.hits.length;
      worldHits += own.length;
      report.push({ view: v.tag, loc, at, hits: m.hits, boxes: m.boxes });
      if (own.length) {
        console.log(`\n[FAIL] ${v.tag}/${loc} t=${at}  ${own.length} world-tag intersection(s)`);
        for (const h of own) console.log(`   ${h.a}\n x ${h.b}   (${h.ox}x${h.oy}px)`);
      } else {
        console.log(`[ok ] ${v.tag}/${loc} t=${at}  ${m.boxes.length} text boxes, `
          + `0 world-tag intersections${m.hits.length ? `, ${m.hits.length} elsewhere` : ''}`);
      }
      if (SHOT) await page.screenshot({ path: path.join(OUT, `${v.tag}-${loc}-t${at}.png`) });
    }
    await ctx.close();
    await save();          // written per viewport: a run that dies still reports
  }
}

await save();
console.log(`\n=== ${worldHits} world-tag intersection(s), ${errors.length} console error(s) ===`);
if (hitCount > worldHits) {
  // Everything else on the glass belongs to another owner. Named, counted and
  // handed over rather than reached into.
  const other = {};
  for (const e of report) for (const h of e.hits) {
    if (mine(h)) continue;
    const k = `${h.a.split(':')[0]} x ${h.b.split(':')[0]}`;
    (other[k] = other[k] || []).push(`${e.view}/${e.loc}/${e.at}`);
  }
  console.log(`--- ${hitCount - worldHits} intersection(s) between other owners' cards, for referral:`);
  for (const [k, v] of Object.entries(other)) {
    console.log(`  ${k.padEnd(30)} ${String(v.length).padStart(3)}  ${[...new Set(v)].slice(0, 4).join(' ')}`);
  }
}
for (const e of errors.slice(0, 12)) console.log('  ERR', e);
await browser.close();
process.exit(worldHits || errors.length ? 1 : 0);
