/** The menu, driven with a real keyboard and a real mouse from a cleared save. */
import { chromium } from 'playwright';
import path from 'node:path';
import { mkdir } from 'node:fs/promises';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4399');
const OUT = path.resolve(arg('out', '/Users/harrison/dev/aadmath/shots/p0menu'));
await mkdir(OUT, { recursive: true });
const W = 1600, H = 900;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'] });
const page = await (await browser.newContext({ viewport: { width: W, height: H } })).newPage();
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push('pageerror ' + e.message));
await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent);
const shot = (n) => page.screenshot({ path: path.join(OUT, n + '.png') });
const st = () => page.evaluate(() => ({
  menu: window.__ascent.menu.open,
  uiOpen: window.__ascent.input.uiOpen,
  owned: window.__ascent.builder.solids.owned,
  panel: window.__ascent.panel.open,
}));
const out = {};
const { writeFile } = await import('node:fs/promises');
const dump = () => writeFile(path.join(OUT, 'menu.json'), JSON.stringify(out, null, 2));
process.on('unhandledRejection', async (e) => { out.crash = String(e).slice(0, 300); await dump(); process.exit(1); });

await page.waitForTimeout(9000);
out.pillVisible = await page.evaluate(() => {
  const b = document.querySelector('.mnu-pill');
  if (!b) return false;
  const r = b.getBoundingClientRect(); const cs = getComputedStyle(b);
  return r.width > 20 && +cs.opacity > 0.5 && cs.display !== 'none' ? `${Math.round(r.x)},${Math.round(r.y)} "${b.textContent.trim()}"` : 'hidden';
});
await shot('10s');

// --- a session beat may own the frame; hand it back the way a player does --
async function clearFloor() {
  for (let i = 0; i < 6; i++) {
    if (!await page.evaluate(() => window.__ascent.session.blocking())) return true;
    const hit = await page.evaluate(() => {
      const card = document.querySelector('.ses-charter.show, .ses-close.show, .ses-rest.show, [class^="ses-"].show');
      const b = card && [...card.querySelectorAll('button')].find((x) => x.getBoundingClientRect().width > 10);
      if (b) { b.click(); return b.textContent.trim(); }
      return null;
    });
    await page.waitForTimeout(900);
    if (!hit) break;
  }
  return !await page.evaluate(() => window.__ascent.session.blocking());
}
out.floorCleared = await clearFloor();
await dump();

// --- Escape opens it ------------------------------------------------------
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
out.afterEscape = await st();
await shot('menu-escape');
out.menuText = await page.evaluate(() => [...document.querySelectorAll('.mnu-card li, .mnu-card h2, .mnu-card h3, .mnu-card p, .mnu-card button, .mnu-card .mnu-row')].map((n) => n.textContent.trim().replace(/\s+/g, ' ')).filter(Boolean));

// --- a click inside it must never reach the world -------------------------
await page.keyboard.press('Digit2');            // (blocked: uiOpen) — hand must stay stowed
const midBox = await page.evaluate(() => document.querySelector('.mnu-card').getBoundingClientRect().toJSON());
await page.mouse.click(midBox.x + midBox.width / 2, midBox.y + midBox.height / 2);
await page.waitForTimeout(500);
out.clickInsideMenu = await st();
await dump();

// --- settings are real ----------------------------------------------------
await page.evaluate(() => { const s = document.querySelector('.mnu-sens'); s.value = '1.8'; s.dispatchEvent(new Event('input', { bubbles: true })); });
await page.click('.mnu-toggle');
await page.waitForTimeout(200);
out.settings = await page.evaluate(() => ({
  sens: window.__ascent.input.sensitivity, invert: window.__ascent.input.invertY,
  savedSens: localStorage.getItem('ascent.sens'), savedInv: localStorage.getItem('ascent.invertY'),
  shown: document.querySelector('.mnu-val').textContent + ' / ' + document.querySelector('.mnu-toggle').textContent,
}));
await shot('menu-settings');

// --- Escape closes it, and hands the world back ---------------------------
await page.keyboard.press('Escape');
await page.waitForTimeout(500);
out.afterClose = await st();

// --- the pill opens it too ------------------------------------------------
await page.click('.mnu-pill');
await page.waitForTimeout(500);
out.afterPill = await st();
await page.click('.mnu-resume');
await page.waitForTimeout(500);
out.afterResume = await st();

// --- it must NOT steal Escape from the report -----------------------------
await page.keyboard.press('KeyP');
await page.waitForTimeout(700);
const reportOpen = await page.evaluate(() => window.__ascent.report.open);
await page.keyboard.press('Escape');
await page.waitForTimeout(600);
out.escapeFromReport = { reportWasOpen: reportOpen, reportNow: await page.evaluate(() => window.__ascent.report.open), ...(await st()) };

// --- nor from a rift ------------------------------------------------------
await page.evaluate(() => window.__ascent.openRiftById('var-meaning'));
await page.waitForTimeout(900);
await page.keyboard.press('Escape');
await page.waitForTimeout(700);
out.escapeFromRift = await st();
await shot('after-rift-escape');

// --- three languages ------------------------------------------------------
for (const loc of ['es', 'pl']) {
  await page.evaluate((l) => window.__ascent.setLocale(l), loc);
  await page.waitForTimeout(1200);
  await page.waitForFunction(() => !!window.__ascent);
  await page.evaluate(() => document.getElementById('boot')?.classList.add('gone'));
  await page.waitForTimeout(900);
  await page.keyboard.press('F1');
  await page.waitForTimeout(700);
  await shot('menu-' + loc);
  out['menu-' + loc] = await page.evaluate(() => document.querySelector('.mnu-card')?.textContent.replace(/\s+/g, ' ').slice(0, 300));
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);
}

out.errors = errs;

await dump();
console.log(JSON.stringify(out, null, 2));
await browser.close();
