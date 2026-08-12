/**
 * The language critic's own album.
 *
 * The standard harness deliberately takes the ORDERS card OFF the glass so it
 * can photograph the surfaces underneath. This one does the opposite: it
 * photographs the beats and panels where the *words* live — the opening, the
 * orders card, one item of each contextual form, the echo at every stratum,
 * and the world labels — in EN, ES and PL.
 *
 *   node tools/critic/langshots.mjs --url http://127.0.0.1:5173 --out shots/lang
 */
import { chromium } from 'playwright';
import { mkdir } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/lang'));
const W = 1600, H = 900;
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--disable-gpu-vsync'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1.5 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));

const shot = async (n, ms = 350) => { await page.waitForTimeout(ms); await page.screenshot({ path: path.join(OUT, n + '.png') }); console.log('  ' + n); };
const ax = (fn, a) => page.evaluate(fn, a);

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(2600);

for (const loc of ['en', 'es', 'pl']) {
  // A fresh load per language, because ORDERS is the first thing the run puts
  // on the glass and the only honest way to photograph it is to be there when
  // it arrives. The locale is set, then the page is reloaded into it.
  await page.evaluate((l) => window.__ascent.setLocale(l), loc);
  // A run in progress does not re-open its orders — quite right, and the
  // reason the second and third languages photographed an empty sky. The
  // session is reset so each language meets the real first beat of a real
  // first run, which is the thing under review.
  await page.evaluate(() => window.__ascent.session.reset());
  await page.waitForTimeout(250);
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
  await page.waitForTimeout(2600);
  // The boot curtain is what starts the session, and the session is what opens
  // ORDERS. Click through it the way a player does rather than stripping the
  // class off it, or the beat that is being photographed never fires at all.
  await page.mouse.move(W / 2, H / 2);
  await page.mouse.click(W / 2, H / 2);
  await page.keyboard.press('KeyW');
  await page.waitForTimeout(600);

  // --- the ORDERS card, exactly as a learner meets it ---------------------
  // The beat has a fuse of its own — twenty-five seconds on a fresh save — so
  // this waits for the real card rather than posing one. Nothing is faked: the
  // session opens it, and the harness photographs it when it arrives.
  let up = false;
  for (let i = 0; i < 140; i++) {
    up = await ax(() => !!document.querySelector('.ses-charter.show'));
    if (up) break;
    await page.waitForTimeout(500);
  }
  await shot(`${loc}-01-orders`, 500);
  if (!up) console.log('   (orders never arrived — check the beat)');

  // --- the opening frame, everything the world says at once ---------------
  await ax(() => {
    const s = window.__ascent?.session;
    s?.charter?.hide?.(); s?.resolution?.hide?.(); s?.rest?.hide?.();
    document.getElementById('ui')?.classList.remove('ses-cine', 'ses-resting');
  });
  await shot(`${loc}-02-open`, 900);

  // --- how many text surfaces are competing, 36 seconds in ----------------
  await page.mouse.move(W / 2, H / 2);
  await page.mouse.click(W / 2, H / 2);
  await page.keyboard.down('KeyW');
  await page.waitForTimeout(2600);
  await page.keyboard.up('KeyW');
  await shot(`${loc}-03-walk`, 900);
  const panels = await ax(() => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 24 || r.height < 12) return false;
      const st = getComputedStyle(el);
      if (st.visibility === 'hidden' || st.display === 'none' || Number(st.opacity) < 0.06) return false;
      return (el.textContent || '').trim().length > 1;
    };
    const SEL = '#ui .gd-card, #ui .gd-prompt, #ui .gd-pin, #ui .axiom, #ui .axiom-why, #ui .axiom-clear,'
      + ' #ui .afford, #ui .af-plate, #ui .ses-band, #ui .hud-wallet, #ui .hud-rank, #ui .comms,'
      + ' #ui .lex-card, #ui .obj, #ui .toast, #ui .hud-tip, #ui .langs, #ui .hud-fps';
    const hits = [...document.querySelectorAll(SEL)].filter(vis);
    return hits.map((e) => (e.className || e.id) + ' :: ' + (e.textContent || '').trim().replace(/\s+/g, ' ').slice(0, 60));
  });
  console.log(`  [${loc}] text surfaces up while walking: ${panels.length}`);
  for (const p of panels) console.log('      · ' + p);

  // --- one item of each contextual form -----------------------------------
  const FORMS = [
    ['04-groups', 'var-meaning'],
    ['05-fee', 'two-step'],
    ['06-gauge', 'one-step-add'],
    ['07-plans', 'both-sides'],
  ];
  for (const [tag, skill] of FORMS) {
    for (let i = 0; i < 24; i++) {
      await ax(() => window.__ascent.panel.close());
      await ax((sk) => window.__ascent.openRiftById(sk), skill);
      await page.waitForTimeout(80);
      const rep = await ax(() => (window.__ascent.panel.open ? window.__ascent.panel.item?.rep : null));
      if (rep === 'context' || rep === 'verbal') break;
    }
    await shot(`${loc}-${tag}`, 420);
  }

  // --- the echo, dug through its strata -----------------------------------
  await ax(() => window.__ascent.panel.close());
  await ax(() => window.__ascent.openRiftById('var-meaning'));
  await page.waitForTimeout(320);
  await page.evaluate(() => {
    const panel = window.__ascent.panel;
    const btns = [...document.querySelectorAll('.ans')];
    const bad = btns.find((b) => !b.textContent.trim().startsWith(String(panel.item.answer)));
    if (bad) bad.click(); else panel.demo?.('wrong');
  });
  await shot(`${loc}-08-echo1`, 900);
  for (const tier of [2, 3]) {
    await page.evaluate(() => document.querySelector('#rf-hint')?.click());
    await shot(`${loc}-09-echo${tier}`, 700);
  }
  await ax(() => window.__ascent.panel.close());
}

console.log(logs.length ? `\nCONSOLE ERRORS (${logs.length}):\n` + logs.slice(0, 10).join('\n') : '\nno console errors');
await browser.close();
