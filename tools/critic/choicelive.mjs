/**
 * ANSWER INTEGRITY, on the surface a player actually touches.
 *
 * `choiceaudit.mjs` sweeps the whole bank through the real rift class. This is
 * the other half of the same question: it plays the SHIPPING game — the real
 * scheduler picking the item, the real seed, the real scaffold, the real locale
 * — and answers with real key presses and real clicks. The oracle that decides
 * what is true runs out here in node, off `src/learn/parser.js`, reading only
 * the item's verification descriptor. Nothing in the page is asked whether it
 * is right.
 *
 * The one thing it borrows from `window.__ascent` is a rift to stand in front
 * of, because walking to ten of them costs four minutes per language and
 * `tools/critic/coldplay.mjs` already proves a stranger can walk to one. Every
 * answer from that point on is a keystroke or a click at a real button.
 *
 *   node tools/critic/choicelive.mjs [--rifts 12] [--locale en] [--shots dir]
 *
 * Exit 0 = every option set a player was shown contained its own answer, and
 * the surface agreed with the mathematics about which one it was.
 */
import { chromium } from 'playwright';
import { build } from 'vite';
import { createServer } from 'node:http';
import { readFile, mkdtemp, rm, mkdir } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { evaluate, solveLinear, equivalent, parseArrayCells } from '../../src/learn/parser.js';
import { R, add, sub, mul, div, eq as req, fromString, str as rstr } from '../../src/learn/rational.js';
import { ITEM_BUNDLES } from '../../src/learn/strings.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.resolve(HERE, '../..');
const argv = process.argv.slice(2);
const arg = (k, d) => { const i = argv.indexOf('--' + k); return i >= 0 ? argv[i + 1] : d; };
const RIFTS = Number(arg('rifts', 10));
const LOCALES = arg('locale') ? [arg('locale')] : ['en', 'es', 'pl'];
const SHOTS = arg('shots', null);
// How often to spend a rift on the audit instead of on progress. Auditing costs
// two deliberate misses, which earns no mastery, so a run that audits every
// rift never leaves the first skill.
const EVERY = Number(arg('every', 2));

// ---------------------------------------------------------------------------
// The oracle — the same one the lab uses, out here where the page cannot reach it
// ---------------------------------------------------------------------------
const canon = (s) => String(s).normalize('NFD').replace(/[̀-ͯʰ-˿]/g, '')
  .replace(/[−‒–—‐‑]/g, '-')
  .replace(/[\s   ​⁡]/g, '').trim();

function oracle(item) {
  const c = item.check || {};
  switch (c.kind) {
    case 'evaluate': return { kind: 'value', value: evaluate(c.math, c.env) };
    case 'solve': {
      const sol = solveLinear(c.math, c.variable);
      if (sol.kind === 'unique') return { kind: 'value', value: sol.value };
      return { kind: 'special', which: sol.kind === 'none' ? 'NONE' : 'ALL' };
    }
    case 'equivalent': return { kind: 'expr', src: c.math, variable: c.variable };
    case 'equationChoice': return { kind: 'equation', expect: c.expect, variable: c.variable };
    case 'table': {
      const cells = parseArrayCells(item.latex).slice(1);
      const known = cells.filter((r) => r.length >= 2 && r[0] !== '?' && r[1] !== '?').map((r) => [Number(r[0]), Number(r[1])]);
      const [x1, y1] = known[0], [x2, y2] = known[1];
      const m = div(sub(R(y2), R(y1)), sub(R(x2), R(x1)));
      const b = sub(R(y1), mul(m, R(x1)));
      const gap = cells.find((r) => r[0] === '?' || r[1] === '?');
      return { kind: 'value', value: gap[0] === '?' ? div(sub(R(Number(gap[1])), b), m) : add(mul(m, R(Number(gap[0]))), b) };
    }
    case 'graph': {
      const [[x1, y1], [x2, y2]] = c.points;
      const m = div(sub(R(y2), R(y1)), sub(R(x2), R(x1)));
      const b = sub(R(y1), mul(m, R(x1)));
      return { kind: 'value', value: c.mode === 'y' ? add(mul(m, R(c.at)), b) : div(sub(R(c.at), b), m) };
    }
    default: return { kind: 'trusted', answer: String(item.answer) };
  }
}

function isTrue(truth, value, locale) {
  const v = String(value).trim();
  switch (truth.kind) {
    case 'value': { const r = fromString(v); return !!r && req(r, truth.value); }
    case 'special': {
      const bundle = ITEM_BUNDLES[locale] || ITEM_BUNDLES.en;
      const want = truth.which === 'NONE' ? bundle['answer.noSolution'] : bundle['answer.allValues'];
      const inner = v.match(/^\\text\{([^}]*)\}$/);
      return canon(inner ? inner[1] : v) === canon(want);
    }
    case 'expr': try { return equivalent(v, truth.src, truth.variable) === true; } catch { return false; }
    case 'equation': try { const s = solveLinear(v, truth.variable); return s.kind === 'unique' && rstr(s.value) === truth.expect; } catch { return false; }
    default: { const a = fromString(v), b = fromString(truth.answer); return a && b ? req(a, b) : canon(v) === canon(truth.answer); }
  }
}
/** What a learner who is right would type. */
function typedAnswer(truth, item) {
  if (truth.kind === 'value') return rstr(truth.value);
  return String(item.answer);
}

// ---------------------------------------------------------------------------
const MIME = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.svg': 'image/svg+xml', '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.json': 'application/json', '.ico': 'image/x-icon', '.png': 'image/png', '.jpg': 'image/jpeg', '.map': 'application/json' };
const out = await mkdtemp(path.join(tmpdir(), 'choicelive-'));
let server, browser;
const done = async () => { try { server?.close(); } catch {} try { await browser?.close(); } catch {} await rm(out, { recursive: true, force: true }); };

const findings = [];
const seenSurfaces = {};
let audited = 0;

try {
  await build({ root: ROOT, base: './', logLevel: 'error', build: { target: 'es2022', outDir: out, emptyOutDir: true, sourcemap: false } });
  const port = 4300 + Math.floor(Math.random() * 400);
  server = createServer(async (req, res) => {
    const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
    try {
      const body = await readFile(path.join(out, rel));
      res.writeHead(200, { 'content-type': MIME[path.extname(rel)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end(''); }
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  if (SHOTS) await mkdir(SHOTS, { recursive: true });

  browser = await chromium.launch({ args: ['--use-gl=angle', '--enable-unsafe-swiftshader'] });
  const ctx = await browser.newContext({ viewport: { width: 1500, height: 950 } });
  const page = await ctx.newPage();
  const errors = [];
  page.on('pageerror', (e) => errors.push('PAGEERROR ' + e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

  await page.goto(`http://127.0.0.1:${port}/index.html`, { waitUntil: 'networkidle' });
  await page.evaluate(() => { try { localStorage.clear(); } catch {} });
  await page.reload({ waitUntil: 'networkidle' });
  await page.waitForFunction(() => !!window.__ascent, null, { timeout: 40000 });
  await page.waitForTimeout(3500);

  // The same reader the lab uses: KaTeX stacks a fraction bottom-up, so plain
  // textContent reads \frac{k}{4} back as "4k".
  const READER = `(el) => {
    const SKIP = ['katex-mathml','pstrut','vlist-s','frac-line','key','hintmark','strut'];
    const out = [];
    (function walk(n){
      if (n.nodeType === 3) { out.push(n.nodeValue); return; }
      if (n.nodeType !== 1) return;
      for (const c of SKIP) if (n.classList.contains(c)) return;
      if (n.classList.contains('mfrac')) {
        const vl = n.querySelector('.vlist');
        if (vl) {
          const parts = [...vl.children].map((c) => { const o = []; (function w(m){ if(m.nodeType===3){o.push(m.nodeValue);return;} if(m.nodeType!==1)return; for(const s of SKIP) if(m.classList.contains(s)) return; for(const k of m.childNodes) w(k); })(c); return o.join('').trim(); }).filter((s) => s.length);
          out.push('(' + parts.reverse().join(')/(') + ')');
          return;
        }
      }
      for (const c of n.childNodes) walk(c);
    })(el);
    return out.join('');
  }`;

  for (const locale of LOCALES) {
    await page.evaluate((l) => window.__ascent.setLocale(l), locale);
    await page.waitForTimeout(200);

    for (let i = 0; i < RIFTS; i++) {
      // Stand in front of a rift the real scheduler wants next. Everything after
      // this line is a key press or a click at a real button.
      // A session can resolve mid-run and put its close card, then its rest
      // beat, over the world. Take the "keep going" door the way a player
      // would, then carry on.
      for (const sel of ['.ses-close.show .sx-more', '.ses-rest.show .sr-skip', '.ses-rest.show .sr-again']) {
        const b = await page.$(sel);
        if (!b || !(await b.isVisible().catch(() => false))) continue;
        await page.waitForTimeout(1400);              // let the card finish arriving
        await b.click({ timeout: 2500 }).catch(async () => {
          // Its own scrim is still over it. This is the door out of a card, not
          // the thing under test, so take it directly.
          await b.evaluate((el) => el.click()).catch(() => {});
        });
        await page.waitForTimeout(900);
      }

      const opened = await page.evaluate(() => {
        const a = window.__ascent;
        if (a.panel.open) a.panel.close();
        const task = a.nextObjective();
        const id = task?.skill || a.rifts.list.find((r) => !r.locked)?.id;
        return id ? a.openRiftById(id) : false;
      });
      if (!opened) break;
      await page.waitForTimeout(320);

      const item = await page.evaluate(() => JSON.parse(JSON.stringify(window.__ascent.panel.item)));
      const mode = await page.evaluate(() => window.__ascent.panel.mode);
      let truth;
      try { truth = oracle(item); } catch (e) {
        findings.push({ code: 'oracle-threw', locale, item: item.form, seed: item.seed, detail: e.message });
        await page.evaluate(() => window.__ascent.panel.close());
        continue;
      }

      // Every other rift is played CLEANLY — the right answer, typed, first
      // time — because a run that misses twice on purpose every single rift
      // never earns mastery and the scheduler never leaves the first skill.
      // Alternating is what carries this audit across the whole course.
      if (i % EVERY !== 0 && mode === 'keypad') {
        for (const ch of typedAnswer(truth, item)) await page.keyboard.press(ch === '-' ? 'Minus' : ch === '/' ? 'Slash' : ch);
        await page.keyboard.press('Enter');
        await page.waitForTimeout(200);
        const sealed = await page.evaluate(() => !!window.__ascent.panel._settled);
        if (!sealed) {
          findings.push({
            code: 'correct-entry-rejected', locale, skill: item.skill, form: item.form,
            difficulty: item.difficulty, seed: item.seed, surface: 'keypad',
            detail: `typed "${typedAnswer(truth, item)}" — the answer — and the rig marked it wrong`,
          });
        }
        seenSurfaces.typed = (seenSurfaces.typed || 0) + 1;
        audited++;
        await page.waitForTimeout(700);
        await page.evaluate(() => window.__ascent.panel.close());
        await page.waitForTimeout(160);
        continue;
      }

      let scope = null;
      if (mode === 'choice') scope = '.rf-readings .rf-reading';
      else if (mode === 'keypad') {
        // Two honest misses, typed. This is the only way a player ever sees the
        // narrowed set, and it is the path three rounds of agents never took.
        for (let k = 0; k < 2; k++) {
          for (const key of ['9', '8', '7', '6', '5', '4']) await page.keyboard.press(key);
          await page.keyboard.press('Enter');
          await page.waitForTimeout(140);
        }
        const has = await page.$('.rf-narrow .rf-reading');
        if (has) scope = '.rf-narrow .rf-reading';
      }
      if (!scope) {
        seenSurfaces[mode] = (seenSurfaces[mode] || 0) + 1;
        await page.evaluate(() => window.__ascent.panel.close());
        await page.waitForTimeout(120);
        continue;
      }

      const surface = scope.includes('narrow') ? 'narrow' : 'choice';
      seenSurfaces[surface] = (seenSurfaces[surface] || 0) + 1;
      audited++;

      const opts = await page.evaluate(([sel, readerSrc]) => {
        const read = eval(readerSrc);
        return [...document.querySelectorAll(sel)].map((b) => ({ value: b.dataset.value, visible: read(b) }));
      }, [scope, READER]);

      // The readings stagger in. Photograph them settled, or the evidence is a
      // picture of an animation rather than of what a learner reads.
      if (SHOTS) await page.waitForTimeout(700);
      if (SHOTS) await page.locator(surface === 'narrow' ? '.rf-narrow' : '.rf-readings')
        .screenshot({ path: path.join(SHOTS, `${locale}-${i}-${item.form}-${surface}.png`) }).catch(() => {});

      const ctxRow = { locale, skill: item.skill, form: item.form, difficulty: item.difficulty, seed: item.seed, surface };
      const trueIdx = opts.map((o, k) => (isTrue(truth, o.value, locale) ? k : -1)).filter((k) => k >= 0);
      const shown = opts.map((o) => canon(o.visible)).join(' | ');

      if (trueIdx.length !== 1) {
        findings.push({
          code: trueIdx.length ? 'multiple-correct-options' : 'no-correct-option',
          ...ctxRow,
          detail: `shown [${shown}] · answer should be "${typedAnswer(truth, item)}"`,
        });
      } else {
        // The surface must agree with the mathematics — proved by clicking.
        const els = await page.$$(scope);
        // A session can resolve on a wrong answer and drop its close card over
        // the open rift, which is a real collision worth knowing about but is
        // not what this tool is measuring. Fall back to the button's own
        // handler when its pixels are covered.
        const press = async (el) => {
          await el.click({ timeout: 2500 }).catch(async () => { await el.evaluate((e) => e.click()).catch(() => {}); });
        };
        let sealed = false;
        for (let k = 0; k < els.length && !sealed; k++) {
          if (k === trueIdx[0]) continue;
          await press(els[k]);
          await page.waitForTimeout(90);
          sealed = await page.evaluate(() => !!window.__ascent.panel._settled);
          if (sealed) findings.push({ code: 'wrong-option-accepted', ...ctxRow, detail: `"${canon(opts[k].visible)}" sealed the rift; shown [${shown}]` });
        }
        if (!sealed) {
          await press(els[trueIdx[0]]);
          await page.waitForTimeout(140);
          const ok = await page.evaluate(() => !!window.__ascent.panel._settled);
          if (!ok) findings.push({ code: 'correct-option-rejected', ...ctxRow, detail: `"${canon(opts[trueIdx[0]].visible)}" is the answer but did not seal; shown [${shown}]` });
        }
      }

      await page.waitForTimeout(500);
      await page.evaluate(() => window.__ascent.panel.close());
      await page.waitForTimeout(160);
    }
  }

  console.log(`live play: ${audited} option sets audited on the shipping surface`);
  console.log(`  surfaces seen: ${Object.entries(seenSurfaces).map(([k, v]) => `${k} ${v}`).join(', ')}`);
  for (const f of findings) console.log(`  ! ${f.code}  ${f.locale} ${f.skill}/${f.form} d${f.difficulty} seed ${f.seed} — ${f.detail}`);
  if (errors.length) { console.log(`console errors ×${errors.length}`); errors.slice(0, 5).forEach((e) => console.log('  ! ' + e)); }
  const bad = findings.length || errors.length;
  console.log(`\n${bad ? 'FAIL' : 'PASS'} — ${findings.length} findings, ${errors.length} console errors`);
  await done();
  process.exit(bad ? 1 : 0);
} catch (e) {
  console.error(e);
  await done();
  process.exit(2);
}
