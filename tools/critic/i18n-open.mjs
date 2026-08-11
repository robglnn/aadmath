/**
 * Drives the REAL game through the whole opening narration in one locale,
 * screenshots every beat, and records exactly what Marlow said in what
 * language — plus every visible piece of chrome around her.
 *
 *   node tools/critic/i18n-open.mjs --loc pl --out shots/i18n-pl [--url ...]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const LOC = arg('loc', 'pl');
const OUT = path.resolve(arg('out', 'shots/i18n-' + LOC));
const W = Number(arg('w', 1600));
const H = Number(arg('h', 900));

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
const logs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') logs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => logs.push('pageerror: ' + e.message));

// Pick the language the way a returning player does: before the game boots.
await ctx.addInitScript((loc) => {
  try { localStorage.setItem('ascent.locale', loc); localStorage.removeItem('ascent.save'); } catch { /* */ }
}, LOC);

await page.goto(URL, { waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 45000 });
// A fresh cadet: wipe any save the init script could not see, and restart the arc.
await page.evaluate(() => { try { for (const k of Object.keys(localStorage)) if (k.startsWith('ascent')) localStorage.removeItem(k); } catch { /* */ } });
await page.reload({ waitUntil: 'load' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 45000 });

const beats = [];
let last = '';
let n = 0;
const t0 = Date.now();
while (Date.now() - t0 < 40000 && n < 12) {
  const line = await page.evaluate(() => {
    const el = document.querySelector('.meta-comms');
    if (!el || !el.classList.contains('show')) return null;
    return {
      body: el.querySelector('.body')?.textContent || '',
      who: el.querySelector('.who')?.textContent || '',
      role: el.querySelector('.role')?.textContent || '',
      full: el.classList.contains('talk') === false,
    };
  });
  if (line && line.full && line.body && line.body !== last) {
    last = line.body;
    n++;
    const f = path.join(OUT, `beat-${String(n).padStart(2, '0')}.png`);
    await page.screenshot({ path: f });
    const chrome = await page.evaluate(() => ({
      rank: document.querySelector('#rankchip')?.innerText || '',
      stamp: Array.from(document.querySelectorAll('.meta-stamp > div')).map((d) => d.textContent).filter(Boolean),
      quest: document.querySelector('.q-card')?.innerText || '',
      hudRig: document.querySelector('#hud-rig')?.innerText || '',
    }));
    beats.push({ n, ...line, chrome, shot: f });
    console.log(`\n[beat ${n}] ${line.who} · ${line.role}`);
    console.log('  ' + line.body);
    console.log('  chrome.rank = ' + JSON.stringify(chrome.rank));
  }
  await page.waitForTimeout(120);
}

// ---------------------------------------------------------------------------
// A full rift, opened and answered, in the same locale. The opening explains
// what a rift is; this is the thing it explained, so the two have to be in one
// language or the explanation was for somebody else.
// ---------------------------------------------------------------------------
const rift = {};
const skill = await page.evaluate(() => window.__ascent.nextObjective()?.id || window.__ascent.skillIds[0]);
await page.evaluate((s) => window.__ascent.openRiftById(s) || window.__ascent.showItem(s), skill);
await page.waitForTimeout(1400);
rift.skill = skill;
rift.opened = await page.evaluate(() => {
  const p = document.querySelector('.rift, #rift, .rf-panel, .rf');
  return p ? p.innerText.replace(/\n{2,}/g, '\n').trim() : null;
});
await page.screenshot({ path: path.join(OUT, 'rift-1-open.png') });

// Answer it wrong on purpose: the wrong answer is where the teaching lives, and
// the echo it triggers is the densest prose surface in the game.
rift.wrong = await page.evaluate(() => {
  const a = window.__ascent.task ? null : null; void a;
  const item = window.__ascent.panel?.item;
  const bad = item ? String(Number(item.answer) + 1) : '999';
  return window.__ascent.enter(bad);
});
await page.waitForTimeout(1600);
rift.afterWrong = await page.evaluate(() => {
  const p = document.querySelector('.rift, #rift, .rf-panel, .rf');
  return p ? p.innerText.replace(/\n{2,}/g, '\n').trim() : null;
});
await page.screenshot({ path: path.join(OUT, 'rift-2-wrong.png') });

rift.right = await page.evaluate(() => {
  const item = window.__ascent.panel?.item;
  return window.__ascent.enter(item ? String(item.answer) : '0');
});
await page.waitForTimeout(1800);
rift.afterRight = await page.evaluate(() => {
  const p = document.querySelector('.rift, #rift, .rf-panel, .rf');
  return (p ? p.innerText.replace(/\n{2,}/g, '\n').trim() : null);
});
rift.comms = await page.evaluate(() => document.querySelector('.meta-comms .body')?.textContent || '');
rift.hud = await page.evaluate(() => document.querySelector('#rig')?.innerText.replace(/\n+/g, ' | ') || '');
await page.screenshot({ path: path.join(OUT, 'rift-3-right.png') });
await page.waitForTimeout(2500);
await page.screenshot({ path: path.join(OUT, 'rift-4-after.png') });

console.log('\n--- rift, ' + LOC + ' ---');
console.log('panel on open:\n' + (rift.opened || '(none)'));
console.log('\npanel after a wrong answer:\n' + (rift.afterWrong || '(none)'));
console.log('\npanel after the right answer:\n' + (rift.afterRight || '(none)'));
console.log('\nHUD rig: ' + rift.hud);
console.log('Marlow: ' + rift.comms);

await writeFile(path.join(OUT, 'beats.json'), JSON.stringify({ locale: LOC, beats, rift, logs }, null, 2));
console.log(`\n${n} beats captured in ${LOC}. console problems: ${logs.length}`);
if (logs.length) console.log(logs.join('\n'));
await browser.close();
if (logs.length) process.exit(1);
