#!/usr/bin/env node
/**
 * The fit gate: does every translated string still fit the box it was designed
 * around, in every language, at every viewport the game claims to support?
 *
 *   node tools/i18n-fit.mjs                 # all locales, all viewports, frozen build
 *   node tools/i18n-fit.mjs --loc pl        # one locale
 *   node tools/i18n-fit.mjs --url http://…  # against a server already running
 *   node tools/i18n-fit.mjs --shots         # also write a frame per surface
 *
 * `check-i18n.mjs` proves the strings exist. `i18n-drive.mjs` proves the right
 * language reaches the screen. Neither can see the defect that actually makes a
 * game look untranslated: a Polish label two words longer than the English one
 * it was measured against, sliced off by an `overflow: hidden` at 1280 wide, or
 * a Spanish button whose text has quietly become an ellipsis.
 *
 * So this opens every surface that carries text — HUD, build bar, comms, all
 * five rift modalities, the echo, the dossier, the rite, the standard — in each
 * locale, at seven viewports from a 4K desktop down to a 360px phone, and
 * measures every element that owns a text node:
 *
 *   · clipped     the element's own content is wider/taller than its box and
 *                 the overflow is hidden, clipped, or turned into an ellipsis
 *   · escapes     the element's ink leaves the nearest clipping ancestor
 *   · offscreen   the ink leaves the viewport
 *   · page-scroll the document itself scrolls sideways
 *
 * Every finding is reported with the locale, viewport, surface and the text, so
 * a fix is a translation change, not a guess. English findings are reported too
 * — if a box is too small in every language, that is a layout defect and it is
 * said as one rather than blamed on the translation.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile, rm } from 'node:fs/promises';
import { spawn } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const arg = (k, d) => {
  const i = process.argv.indexOf('--' + k);
  return i >= 0 && process.argv[i + 1] && !process.argv[i + 1].startsWith('--') ? process.argv[i + 1] : d;
};
const has = (k) => process.argv.includes('--' + k);

const LOCALES = arg('loc', null) ? [arg('loc')] : ['en', 'es', 'pl'];
const OUT = path.resolve(arg('out', path.join(ROOT, 'shots/i18n-fit')));
const SHOTS = has('shots');

/** The viewports the game promises: desktop down to a small phone. */
const VIEWPORTS = [
  { name: '1920', w: 1920, h: 1080 },
  { name: '1440', w: 1440, h: 810 },
  { name: '1280', w: 1280, h: 720 },
  { name: '1024', w: 1024, h: 640 },
  { name: 'tablet', w: 820, h: 1180 },
  { name: 'phone', w: 414, h: 896 },
  { name: 'phone-s', w: 360, h: 740 },
];

// ---------------------------------------------------------------------------
// Server
// ---------------------------------------------------------------------------
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
function run(cmd, args) {
  return new Promise((res, rej) => {
    const p = spawn(cmd, args, { cwd: ROOT, stdio: 'ignore' });
    p.on('exit', (c) => (c === 0 ? res() : rej(new Error(`${cmd} exited ${c}`))));
  });
}
let server = null;
let URL_BASE = arg('url', null);
if (!URL_BASE) {
  const port = 4800 + Math.floor(Math.random() * 400);
  await run('npm', ['run', 'build']);
  server = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(port), '--strictPort'],
    { cwd: ROOT, stdio: 'ignore' });
  URL_BASE = `http://127.0.0.1:${port}`;
  for (let i = 0; i < 60; i++) {
    try { const r = await fetch(URL_BASE); if (r.ok) break; } catch { /* not up yet */ }
    await sleep(400);
  }
}

// ---------------------------------------------------------------------------
// The measurement, run inside the page
// ---------------------------------------------------------------------------
const PROBE = () => {
  const out = [];
  const seen = new Set();
  const CLIP = (cs) => cs.overflow !== 'visible' || cs.overflowX !== 'visible' || cs.overflowY !== 'visible';

  const label = (el) => {
    const parts = [];
    for (let n = el; n && n !== document.body; n = n.parentElement) {
      const cls = (n.className && typeof n.className === 'string' ? n.className.split(/\s+/)[0] : '') || n.tagName.toLowerCase();
      parts.unshift(cls);
      if (parts.length >= 3) break;
    }
    return parts.join('>');
  };

  const all = document.querySelectorAll('body *');
  for (const el of all) {
    if (el.closest('#boot')) continue;
    const cs = getComputedStyle(el);
    if (cs.display === 'none' || cs.visibility === 'hidden' || +cs.opacity < 0.05) continue;
    const r = el.getBoundingClientRect();
    if (r.width < 2 || r.height < 2) continue;

    // Only elements that own text directly. KaTeX is notation, not language,
    // and it is laid out by KaTeX's own metrics — measuring its inline boxes
    // reports the renderer, not the translation.
    if (el.closest('.katex')) continue;
    const own = [...el.childNodes]
      .filter((n) => n.nodeType === 3 && n.nodeValue.trim())
      .map((n) => n.nodeValue.trim()).join(' ');
    if (!own) continue;
    const text = own.replace(/\s+/g, ' ').slice(0, 90);

    const push = (kind, detail) => {
      const id = kind + '|' + label(el) + '|' + text;
      if (seen.has(id)) return;
      seen.add(id);
      out.push({ kind, el: label(el), text, detail, w: Math.round(r.width), h: Math.round(r.height) });
    };

    // 1. the element clips its own content
    const inline = cs.display === 'inline';
    if (!inline) {
      const overX = el.scrollWidth - el.clientWidth;
      const overY = el.scrollHeight - el.clientHeight;
      const hidX = cs.overflowX === 'hidden' || cs.overflowX === 'clip' || cs.textOverflow === 'ellipsis';
      const hidY = cs.overflowY === 'hidden' || cs.overflowY === 'clip';
      if (overX > 1 && hidX) push('clipped-x', `${overX}px of text past the right edge`);
      if (overY > 1 && hidY && cs.webkitLineClamp === 'none') push('clipped-y', `${overY}px of text past the bottom`);
    }

    // 2. the ink leaves the nearest clipping ancestor
    for (let p = el.parentElement; p && p !== document.body; p = p.parentElement) {
      const pcs = getComputedStyle(p);
      if (!CLIP(pcs)) continue;
      if (pcs.overflowY === 'auto' || pcs.overflowY === 'scroll'
        || pcs.overflowX === 'auto' || pcs.overflowX === 'scroll') break; // scrollable: reachable
      const pr = p.getBoundingClientRect();
      const dx = Math.round(r.right - pr.right);
      const dy = Math.round(r.bottom - pr.bottom);
      if (dx > 1) push('escapes-x', `${dx}px past .${label(p).split('>').pop()}`);
      else if (dy > 2) push('escapes-y', `${dy}px past .${label(p).split('>').pop()}`);
      break;
    }

    // 3. the ink leaves the viewport
    const dx = Math.round(r.right - innerWidth);
    if (dx > 1 && r.left < innerWidth) push('offscreen-x', `${dx}px past the right edge of the screen`);
    if (r.left < -1 && r.right > 0) push('offscreen-x', `${Math.round(-r.left)}px past the left edge`);
  }

  if (document.documentElement.scrollWidth > innerWidth + 1) {
    out.push({
      kind: 'page-scroll', el: 'html', text: '',
      detail: `${document.documentElement.scrollWidth - innerWidth}px of sideways page scroll`,
    });
  }
  return out;
};

// ---------------------------------------------------------------------------
// Surfaces
// ---------------------------------------------------------------------------
/** Each surface: a name, how to raise it, and how long to let it settle. */
const SURFACES = [
  { name: 'hud', open: async (p) => { await p.evaluate(() => window.__ascent.panel.close()); }, wait: 500 },
  {
    name: 'comms',
    open: async (p) => p.evaluate(() => {
      window.__ascent.panel.close();
      window.__ascent.story.say(window.__ascent.t('build.anchorCall'));
    }),
    wait: 2200,
  },
  { name: 'rift-choice', open: (p) => openMode(p, 'var-meaning', 'choice'), wait: 900 },
  { name: 'rift-keypad', open: (p) => openMode(p, 'one-step-add', 'keypad'), wait: 900 },
  { name: 'rift-balance', open: (p) => openMode(p, 'two-step', 'balance'), wait: 900 },
  { name: 'rift-sort', open: (p) => openMode(p, 'like-terms', 'sort'), wait: 900 },
  { name: 'rift-area', open: (p) => openMode(p, 'distribute', 'area'), wait: 900 },
  {
    name: 'rift-echo',
    open: async (p) => {
      await openMode(p, 'two-step', null);
      await p.evaluate(() => window.__ascent.panel.demo('wrong'));
      await p.waitForTimeout(900);
      // dig the trace out to its deepest layer — the densest prose in the game
      for (let i = 0; i < 3; i++) {
        await p.evaluate(() => document.querySelector('.ec-more, .ec-deeper, [data-echo-more]')?.click());
        await p.waitForTimeout(350);
      }
    },
    wait: 900,
  },
  {
    name: 'rift-sealed',
    open: async (p) => {
      await openMode(p, 'one-step-add', null);
      await p.evaluate(() => window.__ascent.panel.demo('right'));
    },
    wait: 1400,
  },
  {
    name: 'dossier',
    open: async (p) => {
      await p.evaluate(() => { window.__ascent.panel.close(); window.__ascent.story.seal(9); });
      await p.evaluate(() => window.__ascent.story.openDossier());
    },
    wait: 900,
    close: (p) => p.keyboard.press('Escape'),
  },
  {
    name: 'rite',
    open: async (p) => { await p.evaluate(() => window.__ascent.story.preview('silver')); },
    wait: 1800,
    close: (p) => p.evaluate(() => window.__ascent.story.release()),
  },
  {
    name: 'chapter-turn',
    open: async (p) => { await p.evaluate(() => window.__ascent.story.beat(4)); },
    wait: 2600,
  },
];

/** Open a rift on `skill`, retrying until the scheduler yields `mode`. */
async function openMode(p, skill, mode) {
  for (let i = 0; i < (mode ? 14 : 1); i++) {
    await p.evaluate(() => window.__ascent.panel.close());
    await p.evaluate((s) => window.__ascent.openRiftById(s), skill);
    await p.waitForTimeout(140);
    if (!mode) return;
    if (await p.evaluate(() => window.__ascent.panel.mode) === mode) return;
  }
}

// ---------------------------------------------------------------------------
// Drive
// ---------------------------------------------------------------------------
await rm(OUT, { recursive: true, force: true });
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  args: ['--use-gl=angle', '--ignore-gpu-blocklist', '--enable-unsafe-swiftshader',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});

const findings = [];
const errors = [];
for (const loc of LOCALES) {
  for (const vp of VIEWPORTS) {
    const ctx = await browser.newContext({
      viewport: { width: vp.w, height: vp.h },
      deviceScaleFactor: 2,
      locale: { en: 'en-US', es: 'es-ES', pl: 'pl-PL' }[loc],
      isMobile: vp.w <= 500,
      hasTouch: vp.w <= 900,
    });
    await ctx.addInitScript((l) => {
      try {
        localStorage.setItem('ascent.locale', l);
        localStorage.removeItem('ascent.story');
        localStorage.removeItem('ascent.save');
      } catch { /* private mode */ }
    }, loc);
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`${loc}/${vp.name}: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`${loc}/${vp.name}: ${e.message}`));

    await page.goto(URL_BASE, { waitUntil: 'networkidle' });
    await page.waitForFunction(() => !!window.__ascent, null, { timeout: 45000 });
    await page.evaluate(() => document.getElementById('boot')?.classList.add('gone'));
    await page.waitForTimeout(600);

    for (const s of SURFACES) {
      try {
        await s.open(page);
        await page.waitForTimeout(s.wait);
        const hits = await page.evaluate(PROBE);
        for (const h of hits) findings.push({ locale: loc, vp: vp.name, surface: s.name, ...h });
        if (SHOTS) {
          const dir = path.join(OUT, `${loc}-${vp.name}`);
          await mkdir(dir, { recursive: true });
          await page.screenshot({ path: path.join(dir, `${s.name}.png`) });
        }
        if (s.close) await s.close(page);
      } catch (e) {
        errors.push(`${loc}/${vp.name}/${s.name}: ${e.message.split('\n')[0]}`);
      }
    }
    await ctx.close();
    process.stdout.write(`  ${loc} @ ${vp.name} ✓\n`);
  }
}
await browser.close();
if (server) server.kill();

// ---------------------------------------------------------------------------
// Verdict
// ---------------------------------------------------------------------------
await writeFile(path.join(OUT, 'report.json'), JSON.stringify(findings, null, 2));

/** Group by what a fix would be: one string, in one place. */
const byText = new Map();
for (const f of findings) {
  const k = `${f.kind}|${f.el}|${f.text}`;
  if (!byText.has(k)) byText.set(k, { ...f, where: [] });
  byText.get(k).where.push(`${f.locale}@${f.vp}`);
}
const groups = [...byText.values()].sort((a, b) => b.where.length - a.where.length);

console.log('');
for (const g of groups) {
  const locs = [...new Set(g.where.map((w) => w.split('@')[0]))].join(',');
  console.log(`${g.kind.padEnd(11)} [${locs}] ${g.surface} · ${g.el}`);
  console.log(`            "${g.text}"  — ${g.detail}`);
  console.log(`            ${g.where.join(' ')}`);
}
if (errors.length) {
  console.log(`\n${errors.length} console error(s):`);
  for (const e of [...new Set(errors)].slice(0, 10)) console.log('  ! ' + e.slice(0, 160));
}
console.log(`\n${findings.length} finding(s) in ${groups.length} distinct string(s), ` +
  `${LOCALES.length} locale(s) × ${VIEWPORTS.length} viewport(s) × ${SURFACES.length} surface(s).`);
if (SHOTS) console.log(`frames in ${path.relative(ROOT, OUT)}`);
process.exit(groups.length ? 1 : 0);
