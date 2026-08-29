#!/usr/bin/env node
/**
 * THE ESCAPE GATE.
 *
 *   node tools/critic/escapekey.mjs [--url http://127.0.0.1:5173] [--headed]
 *
 * Exit 0 = the key the HUD prints opens the thing the HUD says it opens.
 *
 * WHY THIS EXISTS, AND WHY IT IS NOT PART OF coldplay.mjs
 *
 * The HUD prints MENU · ESC · F1. The menu prints "This menu · ESC · F1". A cold
 * critic pressed Escape twice from a clean world, found no menu either time,
 * and filed it: *"ESC is a lie… that is the first key a stuck kid presses."*
 *
 * The handler was there and it was correct. It never ran, for a reason no
 * automated harness in this repo could see: **while the pointer is locked, the
 * Escape that releases the lock is consumed by the browser and no `keydown` is
 * delivered to the page at all.** Every player who clicks once to look around
 * is locked — the game asks them to — so for every real player, the first
 * Escape did nothing but hand back the mouse.
 *
 * Headless Chromium never grants a pointer lock, and Playwright's synthetic
 * click does not earn one in headed mode either. So every existing gate ran in
 * the one state where the bug is invisible, and all of them passed. This script
 * therefore installs a pointer lock that behaves the way a real browser's does:
 *
 *   · `requestPointerLock` succeeds and `pointerLockElement` becomes the canvas
 *   · Escape, while locked, releases the lock and IS NOT DELIVERED as a keydown
 *   · `exitPointerLock` works, and fires `pointerlockchange`
 *
 * That is a model of the browser, not a mock of the game: everything below is a
 * real key press into the real build, and the assertion is read off the real
 * DOM. Both halves are tested — the swallowed Escape AND the ordinary one —
 * because the fix must not open the menu twice or open and immediately close it
 * on a browser that delivers the key as well.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';
import { findings } from '../_findings.mjs';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/escapekey'));
const HEADED = process.argv.includes('--headed');

await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: !HEADED,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});

const steps = [];
const note = (ok, label, detail = '') => {
  steps.push({ ok, label, detail });
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ' — ' + detail : ''}`);
};

/**
 * A browser that grants the pointer lock, and eats the Escape that ends it.
 *
 * Installed before any page script runs. The keydown suppressor is registered
 * in the capture phase on `window` from an init script, so it is genuinely
 * first — which is what the browser is, relative to the page.
 */
const REAL_LOCK = () => {
  let locked = null;
  Object.defineProperty(document, 'pointerLockElement', { get: () => locked, configurable: true });
  const change = () => document.dispatchEvent(new Event('pointerlockchange'));
  Element.prototype.requestPointerLock = function () {
    locked = this;
    setTimeout(change, 0);
    return Promise.resolve();
  };
  document.exitPointerLock = function () {
    if (!locked) return;
    locked = null;
    setTimeout(change, 0);
  };
  addEventListener('keydown', (e) => {
    // Chrome: the Escape that releases a pointer lock never reaches the page.
    if (e.key !== 'Escape' || !locked) return;
    locked = null;
    setTimeout(change, 0);
    e.stopImmediatePropagation();
    e.preventDefault();
  }, true);
};

const errors = [];
const menuUp = (p) => p.evaluate(() => !!document.querySelector('#ui .mnu.show'));
const locked = (p) => p.evaluate(() => !!document.pointerLockElement);

async function fresh(initScript) {
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  if (initScript) await ctx.addInitScript(initScript);
  const p = await ctx.newPage();
  p.on('pageerror', (e) => errors.push(e.message));
  p.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  await p.goto(URL, { waitUntil: 'networkidle' });
  await p.evaluate(() => { try { localStorage.clear(); } catch { /* private mode */ } });
  await p.reload({ waitUntil: 'networkidle' });
  await p.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
  // Past the boot curtain and the cold open's first breath, standing in the
  // world, exactly where a cold player's hand first goes looking for a menu.
  await p.waitForTimeout(6000);
  return { ctx, p };
}

// --- 1. THE REPORTED FAILURE: a player who has clicked once to look ---------
{
  const { ctx, p } = await fresh(REAL_LOCK);
  await p.mouse.click(800, 450);            // what the game asks you to do
  await p.waitForTimeout(1200);
  note(await locked(p), 'the pointer is locked, the way it is for a real player');

  await p.keyboard.press('Escape');
  await p.waitForTimeout(700);
  const up = await menuUp(p);
  await p.screenshot({ path: path.join(OUT, '01-escape-under-lock.png') });
  note(up, 'ESCAPE OPENS THE MENU while the pointer is locked',
    up ? '' : 'the browser ate the key and nothing opened — this is the reported defect');
  note(!(await locked(p)), 'and the mouse comes back with it');

  // …and it is still a toggle. One press in, one press out.
  await p.keyboard.press('Escape');
  await p.waitForTimeout(700);
  note(!(await menuUp(p)), 'a second Escape closes it again');
  await ctx.close();
}

// --- 2. THE ORDINARY PATH: no lock, plain keydown ---------------------------
{
  const { ctx, p } = await fresh(null);
  await p.keyboard.press('Escape');
  await p.waitForTimeout(700);
  note(await menuUp(p), 'ESCAPE OPENS THE MENU with no pointer lock at all');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(700);
  note(!(await menuUp(p)), 'and closes it');

  // F1 is printed on the same chip and must keep working.
  await p.keyboard.press('F1');
  await p.waitForTimeout(700);
  note(await menuUp(p), 'F1 opens it too, exactly as the chip says');
  await p.keyboard.press('Escape');
  await p.waitForTimeout(700);

  // --- 3. THE CARD IS NOT A LIE EITHER ------------------------------------
  // Everything the menu prints has to be true of the machine reading it: the
  // key that opened it, the sprint the critic could not find, and one line for
  // every word the game coined.
  await p.keyboard.press('F1');
  await p.waitForTimeout(700);
  const card = await p.evaluate(() => {
    const el = document.querySelector('#ui .mnu.show');
    if (!el) return null;
    const rows = [...el.querySelectorAll('.mnu-verbs li')].map((li) => ({
      v: li.dataset.v, keys: li.querySelector('.mnu-keys')?.innerText.trim() || '',
    }));
    const words = [...el.querySelectorAll('.mnu-words dl > div')].map((d) => ({
      term: d.querySelector('dt')?.textContent.trim() || '',
      means: d.querySelector('dd')?.textContent.trim() || '',
    }));
    return { rows, words, menuKeys: el.querySelector('.mnu-screens li[data-v="menu"] .mnu-keys')?.innerText.trim() || '' };
  });
  await p.screenshot({ path: path.join(OUT, '02-menu-open.png') });
  const sprint = card?.rows.find((r) => r.v === 'sprint');
  note(!!sprint && sprint.keys.length > 0, 'the menu prints SPRINT and the key it is on',
    sprint ? sprint.keys.replace(/\n/g, ' · ') : 'no sprint row');
  note(/esc/i.test(card?.menuKeys || ''), 'the menu names ESC as its own key',
    card?.menuKeys.replace(/\n/g, ' · ') || '');
  const shortWord = (card?.words || []).find((w) => w.means.split(/\s+/).length < 8);
  note((card?.words.length || 0) >= 9 && !shortWord,
    'every coined word on the card carries a meaning, in one line',
    shortWord ? `"${shortWord.term}" has no meaning beside it` : `${card?.words.length || 0} words defined`);

  await ctx.close();
}

// --- 4. And the world stayed quiet -----------------------------------------
note(errors.length === 0, 'no console errors', errors.slice(0, 3).join(' | '));

const failed = steps.filter((s) => !s.ok);
await writeFile(path.join(OUT, 'escapekey.json'), JSON.stringify({ steps, errors }, null, 2));
console.log(`\n${steps.length - failed.length}/${steps.length} passed  ->  ${OUT}`);
if (failed.length) {
  console.log('\nThe key the game prints does not do what the game says. Failures:');
  failed.forEach((f) => console.log('  - ' + f.label + (f.detail ? ` (${f.detail})` : '')));
}
await browser.close();
/* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs. */
findings('check:escape', { scope: 'route' })
  .route(failed.map((f) => `${f.label}${f.detail ? ` (${f.detail})` : ''}`)).done();
