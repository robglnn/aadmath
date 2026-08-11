/**
 * The P0 acceptance run: a cold save, real keys and a real mouse, no teleports.
 *
 *   controls legible by 10 s · the first click does not build · no click the
 *   interface ate reaches the world · Escape reaches a pause surface · the
 *   companion speaks in the opening seconds.
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { mkdir, writeFile } from 'node:fs/promises';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4399');
const OUT = path.resolve(arg('out', '/Users/harrison/dev/aadmath/shots/p0final'));
await mkdir(OUT, { recursive: true });
const W = 1600, H = 900;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H } });
const page = await ctx.newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push('pageerror ' + e.message));
await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent);
const t0 = Date.now();
const out = {};
const shot = (n) => page.screenshot({ path: path.join(OUT, n + '.png') });
const st = () => page.evaluate(() => ({
  menu: window.__ascent.menu.open, uiOpen: window.__ascent.input.uiOpen,
  owned: window.__ascent.builder.solids.owned, hand: window.__ascent.builder.handOut,
  report: window.__ascent.report.open, panel: window.__ascent.panel.open,
}));
const readable = () => page.evaluate(() => {
  const out = [];
  const walk = (n) => {
    for (const c of n.children) {
      const cs = getComputedStyle(c);
      if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.15) continue;
      const r = c.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) continue;
      const own = [...c.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent.trim()).join(' ').trim();
      if (own) out.push(own.replace(/\s+/g, ' '));
      walk(c);
    }
  };
  walk(document.getElementById('ui'));
  return out;
});
// when did the companion first say something
await page.evaluate(() => {
  window.__firstSay = null;
  const t = performance.now();
  const iv = setInterval(() => {
    const n = document.querySelector('.meta-comms, #marlow');
    if (n && n.textContent.trim().length > 24 && +getComputedStyle(n).opacity > 0.4) {
      window.__firstSay = Math.round((performance.now() - t) / 100) / 10;
      clearInterval(iv);
    }
  }, 100);
});

// --- 10 s: what can be read, and is a verb among it? ----------------------
await page.waitForTimeout(10000 - (Date.now() - t0));
out.t10 = { at: Math.round((Date.now() - t0) / 100) / 10, text: await readable() };
await shot('10s');
out.firstSay = await page.evaluate(() => window.__firstSay);

// --- the first click of a cold player -------------------------------------
const b4 = await st();
await page.mouse.move(W / 2, H / 2);
await page.mouse.down(); await page.mouse.up();
await page.waitForTimeout(800);
out.firstClick = { before: b4, after: await st() };
await shot('after-first-click');

// --- Escape: the pause surface a lost player reaches for -------------------
await page.keyboard.press('Escape');
await page.waitForTimeout(700);
out.escape = await st();
await shot('menu');

// --- and a click inside it stays inside it ---------------------------------
const card = await page.evaluate(() => document.querySelector('.mnu-card').getBoundingClientRect().toJSON());
await page.mouse.click(card.x + card.width / 2, card.y + card.height - 30);
await page.waitForTimeout(400);
out.clickInMenu = await st();

// --- another surface takes the frame while the menu is up ------------------
await page.keyboard.press('KeyP');
await page.waitForTimeout(800);
out.reportOverMenu = await st();
await page.keyboard.press('Escape');
await page.waitForTimeout(700);
out.escapeClosesReport = await st();
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
await page.keyboard.press('Escape');
await page.waitForTimeout(600);

// --- 30 s: walk, the way the world funnels you -----------------------------
await page.mouse.click(W / 2, H / 2);
await page.keyboard.down('KeyW');
await page.waitForTimeout(Math.max(500, 29000 - (Date.now() - t0)));
await page.keyboard.up('KeyW');
out.t30 = { at: Math.round((Date.now() - t0) / 100) / 10, text: await readable() };
await shot('30s');

// --- with the hand drawn, no click the interface ate may build -------------
await page.keyboard.press('Digit2');
await page.waitForTimeout(400);
const targets = [['lang', '.langs button'], ['progress launcher', '.rp-launch'], ['menu pill', '.mnu-pill'],
  ['kit chip', '.kit-chip'], ['controls card', '.fc-card'], ['comms', '.meta-comms'], ['hotbar', '#buildbar .slot']];
out.fallThrough = [];
for (const [name, sel] of targets) {
  const box = await page.evaluate((s) => {
    const n = [...document.querySelectorAll(s)].find((x) => {
      const r = x.getBoundingClientRect(); const cs = getComputedStyle(x);
      return r.width > 8 && r.height > 8 && cs.display !== 'none' && +cs.opacity > 0.3 && cs.pointerEvents !== 'none';
    });
    return n ? n.getBoundingClientRect().toJSON() : null;
  }, sel);
  if (!box) { out.fallThrough.push([name, 'not on screen']); continue; }
  const before = (await st()).owned;
  await page.mouse.click(box.x + box.width / 2, box.y + Math.min(box.height / 2, 14));
  await page.waitForTimeout(450);
  const after = (await st()).owned;
  out.fallThrough.push([name, after > before ? `BUILT ${before}->${after}` : 'clean']);
  if (await page.evaluate(() => window.__ascent.menu.open)) await page.keyboard.press('Escape');
  await page.waitForTimeout(250);
}

// --- 60 s -----------------------------------------------------------------
while (Date.now() - t0 < 60000) await page.waitForTimeout(300);
out.t60 = { at: Math.round((Date.now() - t0) / 100) / 10, text: await readable() };
await shot('60s');

out.chips = await page.evaluate(() => [...document.querySelectorAll('.kit-chip')]
  .filter((n) => getComputedStyle(n).display !== 'none')
  .map((n) => ({ id: n.dataset.id, cap: n.querySelector('u')?.textContent.trim(), lock: !!n.querySelector('u svg'), aria: n.getAttribute('aria-label') })));
out.state = await page.evaluate(() => window.__ascent.state());

// --- a phone, portrait ------------------------------------------------------
const mob = await ctx.newPage();
await mob.setViewportSize({ width: 414, height: 896 });
await mob.goto(URL, { waitUntil: 'networkidle' });
await mob.waitForFunction(() => !!window.__ascent);
await mob.waitForTimeout(9000);
await mob.screenshot({ path: path.join(OUT, 'mobile.png') });
out.mobilePill = await mob.evaluate(() => {
  const b = document.querySelector('.mnu-pill'); const l = document.querySelector('.rp-launch');
  const r = b?.getBoundingClientRect(); const q = l?.getBoundingClientRect();
  const overlap = r && q && !(r.right < q.left || r.left > q.right || r.bottom < q.top || r.top > q.bottom);
  return { pill: r && { x: Math.round(r.x), y: Math.round(r.y), w: Math.round(r.width) }, launcher: q && { x: Math.round(q.x), y: Math.round(q.y) }, overlap };
});
await mob.evaluate(() => window.__ascent.menu.show());
await mob.waitForTimeout(600);
await mob.screenshot({ path: path.join(OUT, 'mobile-menu.png') });

out.errors = errs;
await writeFile(path.join(OUT, 'final.json'), JSON.stringify(out, null, 2));
console.log(JSON.stringify({ ...out, t10: out.t10.text.length, t30: undefined, t60: undefined }, null, 1).slice(0, 4000));
await browser.close();
