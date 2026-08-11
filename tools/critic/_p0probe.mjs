/**
 * P0 cold-player probe: real keyboard/mouse, cleared localStorage, no teleports.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4399');
const OUT = path.resolve(arg('out', '/Users/harrison/dev/aadmath/shots/p0probe'));
const W = 1600, H = 900;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));

await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });

const t0 = Date.now();
const el = (s) => Math.round((Date.now() - t0) / 100) / 10;

// what the player can actually READ on screen right now
async function visibleText() {
  return page.evaluate(() => {
    const out = [];
    const walk = (n) => {
      for (const c of n.children) {
        const cs = getComputedStyle(c);
        if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.06) continue;
        const r = c.getBoundingClientRect();
        if (r.width < 2 || r.height < 2) continue;
        const own = [...c.childNodes].filter((x) => x.nodeType === 3).map((x) => x.textContent.trim()).join(' ').trim();
        if (own) out.push(own.replace(/\s+/g, ' '));
        walk(c);
      }
    };
    walk(document.getElementById('ui'));
    return out.filter(Boolean);
  });
}
const owned = () => page.evaluate(() => ({
  owned: window.__ascent.builder.solids.owned,
  handOut: window.__ascent.builder.handOut,
  placed: window.__ascent.builder.placedCount,
}));

const report = {};
async function shot(name) { await page.screenshot({ path: path.join(OUT, name + '.png') }); }

// --- watch marlow / comms text over time --------------------------------
await page.evaluate(() => {
  window.__say = [];
  const t0 = performance.now();
  const seen = new Set();
  setInterval(() => {
    for (const sel of ['#marlow', '.comms', '.meta-comms', '.comms-line', '#toast']) {
      document.querySelectorAll(sel).forEach((n) => {
        const cs = getComputedStyle(n);
        const txt = n.textContent.trim().replace(/\s+/g, ' ');
        if (!txt || +cs.opacity < 0.1 || cs.display === 'none') return;
        const k = sel + '|' + txt;
        if (seen.has(k)) return;
        seen.add(k);
        window.__say.push({ at: Math.round((performance.now() - t0) / 100) / 10, sel, txt: txt.slice(0, 160) });
      });
    }
  }, 200);
});

// --- 10 s: is anything telling me how to play? ---------------------------
await page.waitForTimeout(10000);
report.at10 = { t: el(), text: await visibleText() };
await shot('10s');

// --- help keys ------------------------------------------------------------
const overlaySig = () => page.evaluate(() => [...document.querySelectorAll('#ui *')]
  .filter((n) => { const cs = getComputedStyle(n); const r = n.getBoundingClientRect(); return +cs.opacity > 0.5 && cs.display !== 'none' && r.width > 200 && r.height > 100; })
  .map((n) => n.className + ':' + Math.round(n.getBoundingClientRect().width) + 'x' + Math.round(n.getBoundingClientRect().height)).join('|'));

report.keys = {};
const base = await overlaySig();
for (const k of ['Escape', 'KeyH', 'F1', 'Slash', 'KeyM', 'Tab']) {
  await page.keyboard.press(k);
  await page.waitForTimeout(500);
  const sig = await overlaySig();
  report.keys[k] = sig === base ? 'NOTHING' : 'CHANGED';
  const txt = await visibleText();
  if (sig !== base) { await shot('key-' + k); report.keys[k] = 'CHANGED: ' + txt.slice(0, 8).join(' / '); }
  // put it back
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
}

// --- the first click ------------------------------------------------------
const before = await owned();
await page.mouse.move(W / 2, H / 2);
await page.mouse.down(); await page.mouse.up();
await page.waitForTimeout(700);
const after = await owned();
report.firstClick = { before, after, built: after.owned > before.owned };
await shot('after-first-click');

// --- 30 s ------------------------------------------------------------------
while (Date.now() - t0 < 30000) await page.waitForTimeout(300);
report.at30 = { t: el(), text: await visibleText() };
await shot('30s');

// --- report modal row click ------------------------------------------------
await page.keyboard.press('KeyP');
await page.waitForTimeout(800);
await shot('report-open');
const b4 = await owned();
const rowInfo = await page.evaluate(() => {
  const el = document.querySelector('.rp, .report, [class*="rp-"]')?.closest('div');
  const rows = [...document.querySelectorAll('#ui li, #ui tr, #ui [class*="row"]')]
    .filter((n) => { const r = n.getBoundingClientRect(); const cs = getComputedStyle(n); return r.width > 200 && r.height > 12 && +cs.opacity > 0.4; });
  return rows.slice(0, 12).map((n) => ({ cls: n.className, cursor: getComputedStyle(n).cursor, txt: n.textContent.trim().replace(/\s+/g, ' ').slice(0, 60), box: n.getBoundingClientRect().toJSON() }));
});
report.reportRows = rowInfo;
const target = rowInfo.find((r) => /variable|Reading/i.test(r.txt)) || rowInfo[0];
if (target) {
  await page.mouse.click(target.box.x + target.box.width / 2, target.box.y + target.box.height / 2);
  await page.waitForTimeout(700);
  const aft = await owned();
  report.reportRowClick = { txt: target.txt, cursor: target.cursor, before: b4, after: aft, built: aft.owned > b4.owned, stillOpen: await page.evaluate(() => !!document.querySelector('.rp.show, [class*="rp"].show')) };
  await shot('report-row-click');
}
await page.keyboard.press('Escape');
await page.waitForTimeout(500);

// --- walk forward toward the first rift, real keys -------------------------
await page.mouse.click(W / 2, H / 2);
await page.keyboard.down('KeyW');
await page.waitForTimeout(6000);
await page.keyboard.up('KeyW');
await shot('walked');

// --- 60 s ------------------------------------------------------------------
while (Date.now() - t0 < 60000) await page.waitForTimeout(300);
report.at60 = { t: el(), text: await visibleText() };
await shot('60s');

report.say = await page.evaluate(() => window.__say);
report.kitChips = await page.evaluate(() => [...document.querySelectorAll('.kit-chip')]
  .filter((n) => getComputedStyle(n).display !== 'none')
  .map((n) => ({ id: n.dataset.id, u: n.querySelector('u')?.textContent, full: n.querySelector('.full')?.textContent, em: n.querySelector('em')?.textContent, title: n.title })));
report.state = await page.evaluate(() => window.__ascent.state());
report.logs = logs;

await writeFile(path.join(OUT, 'report.json'), JSON.stringify(report, null, 2));
console.log(JSON.stringify(report, null, 2).slice(0, 12000));
await browser.close();
