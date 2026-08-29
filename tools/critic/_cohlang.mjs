/** COHERENCE: every learner-visible surface, in one locale, dumped and scanned. */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:4917');
const LOC = arg('locale', 'es');
const OUT = path.resolve(arg('out', `/tmp/cohplay/lang-${LOC}`));
const ITEMS = Number(arg('items', 14));
const PHONE = process.argv.includes('--phone');
const W = PHONE ? 390 : 1600, H = PHONE ? 844 : 900;
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({ headless: true, args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, hasTouch: PHONE, isMobile: PHONE });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push('console: ' + m.text()); });

/** Switch language the way a player does: the globe on the menu handle, then
    the settings card's first row. There is no locale plate on the glass any
    more (src/ui/hud.js) — it moved into the pause menu. */
async function setLocale(page, loc) {
  if (loc === 'en') return 'en (default)';
  const clickLang = async () => page.evaluate((l) => {
    const b = document.querySelector(`.langs button[data-loc="${l}"]`);
    if (!b) return 'no-button';
    const r = b.getBoundingClientRect(); const c = getComputedStyle(b);
    if (!(r.width > 1 && r.height > 1) || c.visibility === 'hidden' || Number(c.opacity) < 0.05) return 'not-visible';
    b.click(); return 'clicked';
  }, loc);
  let r = await clickLang();
  if (r !== 'clicked') {
    await page.keyboard.press('Escape');
    await page.waitForTimeout(900);
    r = await clickLang();
    await page.waitForTimeout(700);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(900);
  const got = await page.evaluate(() => window.__ascent.locale());
  return `${r}; the game is now in ${got}`;
}

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
await page.waitForTimeout(4500);
console.log('locale ' + LOC + ': ' + (await setLocale(page, LOC)));
await page.waitForTimeout(1200);

const panelOpen = () => page.evaluate(() => !!window.__ascent.panelInfo().open);
const card = async () => { const c = await page.evaluate(() => window.__ascent.panelInfo()); return c && c.open ? c : null; };
async function dismiss() {
  for (const sel of ['.ses-close.show .sx-rest', '.ses-rest.show .sr-again', '.ses-rest.show .sr-skip',
    '.ses-charter.show .sc-go', '.fdy .fdy-close']) {
    const el = page.locator(sel).first();
    if (await el.count() && await el.isVisible().catch(() => false)) { await el.click({ timeout: 3000 }).catch(() => {}); await page.waitForTimeout(400); return true; }
  }
  return false;
}
async function walkAndKnock(budgetMs = 40000) {
  const t0 = Date.now();
  await page.keyboard.press('KeyE');
  if (await panelOpen()) return true;
  const cx = Math.round(W / 2);
  let held = false;
  try {
    while (Date.now() - t0 < budgetMs) {
      const w = await page.evaluate((half) => {
        const a = window.__ascent, Wd = a.world, T = a.THREE;
        const o = a.objective && a.objective(); if (!o) return null;
        const p = a.player.pos; const hd = Wd.headingTo(p.x, p.z, o.x, o.z);
        const fwd = new T.Vector3(); a.camera.getWorldDirection(fwd); fwd.y = 0; fwd.normalize();
        const dir = new T.Vector3(Math.sin(hd.yaw), 0, Math.cos(hd.yaw));
        const ang = Math.atan2(fwd.x * dir.z - fwd.z * dir.x, fwd.dot(dir));
        return { x: half + Math.max(-1, Math.min(1, ang / 0.8)) * half * 0.9, edge: Math.abs(ang) > 0.8 };
      }, cx);
      if (w) {
        const off = w.x - cx;
        if (Math.abs(off) > 40 || w.edge) { const k = off > 0 ? 'ArrowRight' : 'ArrowLeft'; await page.keyboard.down(k); await page.waitForTimeout(Math.min(300, Math.max(45, (Math.abs(off) / cx) * 340))); await page.keyboard.up(k); }
      }
      if (!held) { await page.keyboard.down('KeyW'); held = true; }
      await page.waitForTimeout(140);
      for (let j = 0; j < 3; j++) { await page.keyboard.press('KeyE'); if (await panelOpen()) { await page.keyboard.up('KeyW'); return true; } await page.waitForTimeout(110); }
      if (await dismiss()) { /* a beat */ }
      if (!w) { await page.keyboard.down('ArrowRight'); await page.waitForTimeout(240); await page.keyboard.up('ArrowRight'); }
    }
  } finally { if (held) await page.keyboard.up('KeyW'); }
  return false;
}
async function answer(c) {
  if (c.mode === 'choice') {
    const b = page.locator('.rf-reading'); const n = await b.count(); if (!n) return false;
    let want = 0;
    for (let i = 0; i < n; i++) { if (String(await b.nth(i).getAttribute('data-value')) === String(c.answer)) { want = i; break; } }
    await b.nth(want).click({ timeout: 5000 }).catch(() => {}); return true;
  }
  if (c.mode === 'keypad') {
    const s = String(c.answer ?? ''); if (!s) return false;
    for (const ch of s) {
      if (ch === '-') await page.keyboard.press('Minus');
      else if (ch === '/') await page.keyboard.press('Slash');
      else if (ch === '+') await page.keyboard.press('Equal');
      else if (ch === '^') await page.keyboard.press('Digit6');
      else await page.keyboard.press(ch);
      await page.waitForTimeout(28);
    }
    await page.keyboard.press('Enter'); return true;
  }
  const any = page.locator('.rf-move, .rf-chip, .rf-bay, .ans, .rf-cell').first();
  if (await any.count()) { await any.click({ timeout: 5000 }).catch(() => {}); return true; }
  return false;
}

/** Every string a learner can actually see right now, per surface. */
const visible = () => page.evaluate(() => {
  const out = {};
  const seen = new Set();
  const walk = (root, label) => {
    const el = document.querySelector(root);
    if (!el) return;
    const r = el.getBoundingClientRect();
    const cs = getComputedStyle(el);
    if (!(r.width > 1 && r.height > 1) || cs.visibility === 'hidden' || Number(cs.opacity) < 0.05 || cs.display === 'none') return;
    const txt = el.innerText.trim();
    if (txt && !seen.has(label)) { out[label] = txt.slice(0, 3000); seen.add(label); }
  };
  for (const [sel, lab] of [['#hud', 'hud'], ['#marlow', 'marlow'], ['.gd-card', 'objective'],
    ['.ses-band', 'band'], ['.ses-charter.show', 'orders'], ['.ses-close.show', 'close'],
    ['.ses-rest.show', 'rest'], ['.rf.show', 'rift'], ['#rig', 'rig'], ['.meta-quest', 'chapter'],
    ['.fdy', 'foundry'], ['.mnu.show', 'menu'], ['#rp-doc-host', 'report'], ['.rp', 'reportpanel'],
    ['.kit-rack', 'kit'], ['.fc', 'firstcontact'], ['#buildbar', 'buildbar'], ['#touchpad', 'touchpad']]) walk(sel, lab);
  return out;
});

const dumps = {};
const grab = async (tag) => { const v = await visible(); dumps[tag] = v; return v; };

await grab('00-arrival');
await dismiss();
await page.mouse.click(Math.round(W / 2), Math.round(H / 2));
await page.waitForTimeout(400);
await grab('01-orders-dismissed');
let n = 0;
while (n < ITEMS) {
  await dismiss();
  if (!(await panelOpen())) { if (!(await walkAndKnock(40000))) break; }
  const c = await card(); if (!c) { await page.waitForTimeout(200); continue; }
  if (c.settled) { await page.waitForTimeout(1200); continue; }
  if (n === 0) await grab('02-first-rift');
  n++;
  if (n === 3) { await answer({ ...c, answer: 'zzz' }); await page.waitForTimeout(1200); await grab('03-after-a-miss'); }
  await answer(c);
  await page.waitForTimeout(800);
  if (await panelOpen() && !(await page.evaluate(() => !!window.__ascent.panelInfo().settled))) { await page.keyboard.press('Escape'); await page.waitForTimeout(250); }
}
await page.waitForTimeout(600);
await grab('04-mid-run');
await page.screenshot({ path: path.join(OUT, 'mid.png') });
// the screens
for (const [key, tag] of [['KeyP', '05-progress'], ['KeyJ', '06-dossier'], ['Escape', '07-menu']]) {
  await page.keyboard.press(key); await page.waitForTimeout(1400);
  await grab(tag);
  await page.screenshot({ path: path.join(OUT, tag + '.png') });
  await page.keyboard.press('Escape'); await page.waitForTimeout(700);
}
await writeFile(path.join(OUT, 'dump.json'), JSON.stringify({ locale: LOC, dumps, errors }, null, 1));
for (const [tag, v] of Object.entries(dumps)) {
  console.log(`\n########## ${tag} ##########`);
  for (const [k, s] of Object.entries(v)) console.log(`--- ${k} ---\n${s}`);
}
console.log('\nERRORS: ' + (errors.length ? errors.slice(0, 6).join(' | ') : 'none'));
await browser.close();
