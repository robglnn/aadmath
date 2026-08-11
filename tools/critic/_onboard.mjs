/**
 * FRESH-PLAYER DRIVE.
 *
 * No `window.__ascent` shortcuts drive anything. The save is cleared, the page
 * is loaded, and the game is played with the keyboard and the mouse the way a
 * stranger would play it — including the thing a stranger actually does when a
 * question he cannot answer appears, which is look at it and close it.
 *
 * Then it photographs second 30, second 90 and second 180 and prints, in words,
 * everything the screen was saying at each — so the only question that matters
 * can be answered off the frames rather than off a summary:
 *
 *     could a stranger looking at this say what to do next?
 *
 *   node tools/critic/_onboard.mjs --url http://127.0.0.1:4392 --out shots/x
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/onboard'));
const LOC = arg('loc', '');
const W = 1600, H = 900;

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-gpu-rasterization',
    '--enable-unsafe-swiftshader', '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1.5 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));

await page.goto(URL, { waitUntil: 'domcontentloaded' });
await page.evaluate(() => { localStorage.clear(); });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
if (LOC) {
  // Switching locale reloads the page. Waiting a fixed beat races the reload:
  // `__ascent` from the *old* document answers immediately, the reload lands
  // afterwards, and the whole run is captured in English while the report says
  // it was Polish. Wait for the live bundle to actually be the one asked for.
  await page.evaluate((l) => { document.querySelector(`.langs [data-loc="${l}"]`)?.click(); }, LOC);
  await page.waitForFunction(
    (l) => !!window.__ascent && window.__ascent.locale() === l, LOC, { timeout: 30000 });
  await page.waitForTimeout(800);
  await page.evaluate(() => document.getElementById('boot')?.classList.add('gone'));
}

const t0 = Date.now();
const at = () => ((Date.now() - t0) / 1000).toFixed(0);
const beats = [];

async function shot(name) {
  await page.screenshot({ path: path.join(OUT, `${name}.png`) });
  console.log(`  shot ${name} @ t+${at()}s`);
}

/** Everything the screen is telling the player, in words, right now. */
async function readScreen() {
  return page.evaluate(() => {
    const vis = (el) => {
      const r = el.getBoundingClientRect();
      if (r.width < 2 || r.height < 2) return false;
      const s = getComputedStyle(el);
      return s.visibility !== 'hidden' && Number(s.opacity) > 0.06 && s.display !== 'none';
    };
    const out = [];
    const seen = new Set();
    const walk = (el) => {
      if (!vis(el)) return;
      for (const c of el.children) walk(c);
      const own = [...el.childNodes].filter((n) => n.nodeType === 3)
        .map((n) => n.textContent.trim()).join(' ').trim();
      if (own && !seen.has(own)) { seen.add(own); out.push(own); }
    };
    for (const r of [document.getElementById('ui'), document.getElementById('touchpad')]) if (r) walk(r);
    return out;
  });
}

async function beat(sec, name) {
  while ((Date.now() - t0) / 1000 < sec) await page.waitForTimeout(120);
  await shot(name);
  const text = await readScreen();
  const guide = await page.evaluate(() => window.__ascent.story.guide?.() || null);
  beats.push({ sec, name, text, guide });
  console.log(`\n--- t+${sec}s --- guide: ${JSON.stringify(guide)}`);
  console.log(text.map((s) => '  | ' + s).join('\n'));
}

/** A stranger, faced with a question he did not ask for, closes it. */
async function closePanelIfOpen() {
  const open = await page.evaluate(() => !!document.querySelector('.rift.show'));
  if (!open) return false;
  await page.waitForTimeout(3500);           // he reads it first
  const btn = await page.$('.rift.show .rf-x, .rift.show .rf-close, .rift.show [data-close]');
  if (btn) await btn.click();
  else await page.keyboard.press('Escape');
  await page.waitForTimeout(700);
  await page.mouse.click(W / 2, H / 2);       // take the pointer back
  return true;
}

const hold = async (keys, ms, look = 0) => {
  for (const k of keys) await page.keyboard.down(k);
  const steps = Math.max(1, Math.round(ms / 250));
  for (let i = 0; i < steps; i++) {
    if (look) await page.mouse.move(W / 2 + look, H / 2);
    await page.waitForTimeout(250);
    if (await closePanelIfOpen()) for (const k of keys) await page.keyboard.down(k);
  }
  for (const k of keys) await page.keyboard.up(k);
};

// ---------------------------------------------------------------------------
await page.mouse.move(W / 2, H / 2);
await page.mouse.click(W / 2, H / 2);
console.log('pointer lock:', await page.evaluate(() => !!document.pointerLockElement));

await shot('00-arrival');
console.log((await readScreen()).map((s) => '  | ' + s).join('\n'));

// 0–30: he looks around, then walks toward whatever the game pointed at.
await page.waitForTimeout(4000);
await page.mouse.move(W / 2 + 320, H / 2);
await page.waitForTimeout(2500);
await page.mouse.move(W / 2 - 320, H / 2);
await page.waitForTimeout(2500);
await hold(['KeyW'], 12000);
await beat(30, '30s');

// 30–90: he turns hard away and runs, to see whether the game keeps up with him.
await closePanelIfOpen();
await page.mouse.move(W / 2 + 900, H / 2);
await page.waitForTimeout(400);
await page.mouse.move(W / 2 + 900, H / 2);
await hold(['KeyW', 'ShiftLeft'], 26000);
await page.waitForTimeout(1500);
await beat(90, '90s');

// 90–180: he follows whatever the screen is telling him.
await closePanelIfOpen();
await page.mouse.move(W / 2 - 700, H / 2);
await page.waitForTimeout(400);
await hold(['KeyW', 'ShiftLeft'], 30000);
await page.keyboard.press('Space');
await hold(['KeyW'], 20000);
await beat(180, '180s');

const state = await page.evaluate(() => window.__ascent.state());
await writeFile(path.join(OUT, 'report.json'), JSON.stringify({ beats, logs, state }, null, 2));
console.log('\nconsole errors:', logs.length);
for (const l of logs.slice(0, 10)) console.log('  ' + l);
console.log('fps', Math.round(state.fps), '· p95', state.perf?.p95, '· shards', state.shards);
await browser.close();
