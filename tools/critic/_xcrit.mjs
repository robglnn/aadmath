/**
 * Independent critic driver: plays a full session to the close at a given
 * viewport + locale, and asserts programmatically that no two *text runs*
 * intersect without opaque backing between them.
 *
 *   node tools/critic/_xcrit.mjs --url ... --out shots/x --w 390 --h 844 --loc pl
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4791');
const OUT = path.resolve(arg('out', 'shots/xcrit'));
const W = Number(arg('w', 1600));
const H = Number(arg('h', 900));
const LOC = arg('loc', 'en');
const MOBILE = W < 700;

await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
    '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({
  viewport: { width: W, height: H }, deviceScaleFactor: 2,
  hasTouch: MOBILE, isMobile: MOBILE,
});
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => logs.push({ type: m.type(), text: m.text() }));
page.on('pageerror', (e) => logs.push({ type: 'pageerror', text: e.message + '\n' + (e.stack || '') }));

const shots = [];
async function shot(name, ms = 250) {
  await page.waitForTimeout(ms);
  const f = path.join(OUT, `${name}.png`);
  await page.screenshot({ path: f });
  shots.push(f);
}

/**
 * TEXT-ON-TEXT. Collects every painted text run (per line box, via Range
 * rects), then reports pairs that intersect on screen with no opaque paint
 * between them, plus text clipped inside a non-scrolling box or pushed off
 * the frame.
 */
const AUDIT = `(() => {
  const alpha = (c) => {
    const m = /rgba?\\(([^)]+)\\)/.exec(c || '');
    if (!m) return c && c !== 'transparent' ? 1 : 0;
    const p = m[1].split(',').map((x) => parseFloat(x));
    return p.length > 3 ? p[3] : 1;
  };
  const painted = (el) => {
    let n = el;
    while (n && n.nodeType === 1) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden' || parseFloat(cs.opacity) < 0.06) return false;
      // KaTeX ships an invisible MathML twin for screen readers, clipped to a
      // 1px box. It is not on screen; counting it doubles every formula.
      if (n.classList && n.classList.contains('katex-mathml')) return false;
      if (cs.clip && cs.clip !== 'auto' && /1px/.test(cs.clip)) return false;
      if (cs.clipPath && /inset\\(50%/.test(cs.clipPath)) return false;
      n = n.parentElement;
    }
    return true;
  };
  const runs = [];
  const w = document.createTreeWalker(document.body, NodeFilter.SHOW_TEXT);
  for (let t = w.nextNode(); t; t = w.nextNode()) {
    const s = t.nodeValue.replace(/\\s+/g, ' ').trim();
    if (!s) continue;
    const el = t.parentElement;
    if (!el || !painted(el)) continue;
    const cs = getComputedStyle(el);
    if (alpha(cs.color) < 0.06) continue;
    const r = document.createRange(); r.selectNodeContents(t);
    for (const b of r.getClientRects()) {
      if (b.width < 3 || b.height < 3) continue;
      if (b.bottom < 0 || b.top > innerHeight || b.right < 0 || b.left > innerWidth) continue;
      runs.push({ el, txt: s.slice(0, 60), x: b.left, y: b.top, r: b.right, b: b.bottom, w: b.width, h: b.height,
        cls: el.className && el.className.baseVal === undefined ? String(el.className) : el.tagName });
    }
  }
  // does anything opaque sit between the two, in paint order?
  const opaqueBetween = (a, bx, box) => {
    // walk up from the later-painted element looking for a filled box that
    // covers the overlap and is not an ancestor of the earlier one
    let n = bx.el;
    while (n && n.nodeType === 1) {
      const cs = getComputedStyle(n);
      const bg = cs.backgroundColor;
      const hasImg = cs.backgroundImage && cs.backgroundImage !== 'none';
      if ((alpha(bg) > 0.92 || hasImg) && !n.contains(a.el)) {
        const q = n.getBoundingClientRect();
        if (q.left <= box.x + 0.5 && q.top <= box.y + 0.5 && q.right >= box.r - 0.5 && q.bottom >= box.b - 0.5) {
          return { by: String(n.className || n.tagName), bg, img: hasImg };
        }
      }
      n = n.parentElement;
    }
    return null;
  };
  const overlaps = [];
  for (let i = 0; i < runs.length; i++) {
    for (let j = i + 1; j < runs.length; j++) {
      const a = runs[i], b = runs[j];
      if (a.el === b.el) continue;
      if (a.el.contains(b.el) || b.el.contains(a.el)) continue;
      const x = Math.max(a.x, b.x), y = Math.max(a.y, b.y);
      const r = Math.min(a.r, b.r), bo = Math.min(a.b, b.b);
      const ow = r - x, oh = bo - y;
      if (ow <= 1.5 || oh <= 1.5) continue;
      const area = ow * oh;
      if (area < 24) continue;
      const box = { x, y, r, b: bo };
      // paint order: whichever appears later in document order (same stacking)
      const pos = a.el.compareDocumentPosition(b.el);
      const later = (pos & Node.DOCUMENT_POSITION_FOLLOWING) ? b : a;
      const earlier = later === b ? a : b;
      // if a higher z-index puts earlier on top, treat it as the later one
      const zi = (el) => { let n = el, z = 0; while (n && n.nodeType === 1) { const v = parseInt(getComputedStyle(n).zIndex); if (!isNaN(v)) { z = v; break; } n = n.parentElement; } return z; };
      const top = zi(earlier.el) > zi(later.el) ? earlier : later;
      const bot = top === later ? earlier : later;
      const cover = opaqueBetween(bot, top, box);
      // also accept: the element on top is itself painted over an opaque
      // ancestor that the bottom one is NOT inside of
      if (cover) continue;
      overlaps.push({ a: { cls: a.cls, txt: a.txt, x: Math.round(a.x), y: Math.round(a.y), w: Math.round(a.w), h: Math.round(a.h) },
                      b: { cls: b.cls, txt: b.txt, x: Math.round(b.x), y: Math.round(b.y), w: Math.round(b.w), h: Math.round(b.h) },
                      overlap: { x: Math.round(x), y: Math.round(y), w: Math.round(ow), h: Math.round(oh) } });
    }
  }
  // clipping / offscreen
  const clip = [];
  for (const el of document.querySelectorAll('body *')) {
    if (el.children.length || !el.textContent.trim()) continue;
    if (!painted(el)) continue;
    const cs = getComputedStyle(el); const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;
    const scrollX = ['auto', 'scroll'].includes(cs.overflowX);
    const scrollY = ['auto', 'scroll'].includes(cs.overflowY);
    if (el.scrollWidth > el.clientWidth + 2 && !scrollX && cs.textOverflow !== 'ellipsis')
      clip.push({ kind: 'clipX', cls: String(el.className || el.tagName), txt: el.textContent.trim().slice(0, 48), sw: el.scrollWidth, cw: el.clientWidth });
    if (el.scrollHeight > el.clientHeight + 3 && !scrollY)
      clip.push({ kind: 'clipY', cls: String(el.className || el.tagName), txt: el.textContent.trim().slice(0, 48), sh: el.scrollHeight, ch: el.clientHeight });
    if (r.right > innerWidth + 2 || r.left < -2 || r.bottom > innerHeight + 2 || r.top < -2) {
      // inside a scroller is fine
      let sc = false, n = el.parentElement;
      while (n) { const c = getComputedStyle(n); if (['auto', 'scroll'].includes(c.overflowY) || ['auto', 'scroll'].includes(c.overflowX)) { sc = true; break; } n = n.parentElement; }
      if (!sc) clip.push({ kind: 'offscreen', cls: String(el.className || el.tagName), txt: el.textContent.trim().slice(0, 48), rect: [Math.round(r.left), Math.round(r.top), Math.round(r.right), Math.round(r.bottom)] });
    }
  }
  return { runs: runs.length, overlaps: overlaps.slice(0, 30), clip: clip.slice(0, 20) };
})()`;

const audit = () => page.evaluate(AUDIT);
const findings = [];
async function check(beat) {
  const a = await audit();
  if (a.overlaps.length || a.clip.length) findings.push({ beat, ...a });
  console.log(`  [${beat}] runs=${a.runs} overlaps=${a.overlaps.length} clip=${a.clip.length}`);
  if (a.overlaps.length) console.log('    OVERLAP ' + JSON.stringify(a.overlaps.slice(0, 3)));
  if (a.clip.length) console.log('    CLIP ' + JSON.stringify(a.clip.slice(0, 3)));
  return a;
}

// ---------------------------------------------------------------- boot ----
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.evaluate((l) => {
  localStorage.removeItem('ascent.save');
  localStorage.setItem('ascent.locale', l);
  window.__ascent.session.reset();
}, LOC);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(2200);
console.log(`\n### ${W}x${H} ${LOC} — locale=${await page.evaluate(() => window.__ascent.locale())}`);
await shot('00-arrival', 600);
await check('arrival');

// --------------------------------------------------------------- orders ---
await page.waitForFunction(() => window.__ascent.session.state().phase === 'charter', null, { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(1200);
await shot('01-orders', 300);
await check('orders');
await page.locator('.sc-go').click({ timeout: 5000 }).catch(() => {});
await page.waitForTimeout(900);
await shot('02-band', 200);
await check('band');

// ----------------------------------------------------------------- work ---
const first = await page.evaluate(() => window.__ascent.session.state().run?.seams?.[0]?.id || window.__ascent.nextObjective()?.id);
await page.evaluate((id) => window.__ascent.teleportTo(id), first);
await page.waitForTimeout(400);
await page.evaluate((id) => window.__ascent.openRiftById(id), first);
await page.waitForTimeout(800);
let n = 0, lastPanel = Date.now();
while (n < 26) {
  const s = await page.evaluate(() => window.__ascent.session.state());
  if (s.phase !== 'work' && s.phase !== 'charter') break;
  const open = await page.evaluate(() => window.__ascent.panel.open);
  if (!open) {
    if (Date.now() - lastPanel > 2400) {
      const id = await page.evaluate(() => window.__ascent.nextObjective()?.id || null);
      if (id) {
        await page.evaluate((i) => window.__ascent.teleportTo(i), id);
        await page.waitForTimeout(300);
        await page.evaluate((i) => window.__ascent.openRiftById(i), id);
        lastPanel = Date.now();
      }
    }
    await page.waitForTimeout(300);
    continue;
  }
  lastPanel = Date.now(); n++;
  const wrong = n === 2 || n === 7;
  if (n <= 2) { await shot(`03-item-${n}`, 500); await check(`item-${n}`); }
  await page.evaluate((w) => window.__ascent.panel.demo(w ? 'wrong' : 'right'), wrong);
  await page.waitForTimeout(wrong ? 1200 : 900);
  if (n === 2) { await shot('04-echo', 400); await check('echo'); }
  if (n === 1) { await shot('05-seal', 200); await check('seal'); }
  if (wrong) { await page.evaluate(() => window.__ascent.panel.close()); await page.waitForTimeout(400); }
  else await page.waitForTimeout(2400);
  if (n >= 12) await page.evaluate(() => window.__ascent.session.chargeTo?.(24.8));
}

// ---------------------------------------------------------------- close ---
const closed = await page.waitForFunction(() => ['close', 'rest'].includes(window.__ascent.session.state().phase), null, { timeout: 25000 }).catch(() => null);
if (!closed) {
  console.log('  (forcing close)');
  await page.evaluate(() => window.__ascent.session.skipToClose());
}
await page.waitForTimeout(2600); // all reveal animations land by 1.45s + .6s
await shot('06-close', 400);
const closeAudit = await check('close');
// scroll the close card to its foot and re-check, since the shelf is sticky
await page.evaluate(() => { const s = document.querySelector('.ses-close .sx-in'); if (s) s.scrollTop = s.scrollHeight; });
await page.waitForTimeout(500);
await shot('07-close-foot', 200);
const footAudit = await check('close-foot');
await page.evaluate(() => { const s = document.querySelector('.ses-close .sx-in'); if (s) s.scrollTop = Math.round(s.scrollHeight * 0.45); });
await page.waitForTimeout(400);
await shot('08-close-mid', 200);
await check('close-mid');

// button reachable and real?
const btn = await page.evaluate(() => {
  const b = document.querySelector('.ses-close .sx-rest');
  if (!b) return null;
  const r = b.getBoundingClientRect();
  const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
  return { txt: b.textContent.trim(), rect: [Math.round(r.x), Math.round(r.y), Math.round(r.width), Math.round(r.height)],
    inView: r.top >= 0 && r.bottom <= innerHeight + 1, hitIsSelf: b.contains(hit) || hit === b, hit: hit ? String(hit.className || hit.tagName) : null };
});
console.log('  REST BUTTON ' + JSON.stringify(btn));

// ----------------------------------------------------------------- rest ---
await page.locator('.ses-close .sx-rest').click({ timeout: 5000 }).catch((e) => console.log('  rest click failed: ' + e.message));
await page.waitForTimeout(1600);
await shot('09-rest', 400);
await check('rest');
await page.waitForTimeout(5000);
await shot('10-rest-late', 300);
await check('rest-late');

const errors = logs.filter((l) => l.type === 'error' || l.type === 'pageerror');
const rep = await page.evaluate(() => window.__ascent.session.state());
await writeFile(path.join(OUT, 'xcrit.json'), JSON.stringify({ W, H, LOC, findings, button: btn, report: rep.run?.report, errors }, null, 2));
console.log(`  console errors: ${errors.length}`);
errors.slice(0, 6).forEach((e) => console.log('    ! ' + e.text.split('\n')[0]));
console.log(`  BAD BEATS: ${findings.length}`);
await browser.close();
process.exit(errors.length || findings.length ? 2 : 0);
