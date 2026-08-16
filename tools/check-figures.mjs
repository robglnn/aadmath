/**
 * Figure/prose agreement gate.
 *
 * WHY THIS FILE EXISTS
 *
 * A cold critic opened a `like-terms` card and read this:
 *
 *     "A pressure hatch is 3m + 6 across and m + 15 down.
 *      The seal runs right round.
 *      Which expression gives the distance all the way round?"
 *
 * and beside it a drawing of a rectangle labelled `3m + 6` across and `m` down.
 * A cadet who trusts the drawing computes 2(3m + 6) + 2(m) = 8m + 12 and is
 * marked wrong. The accepted answer was 8m + 42, because the sentence — not the
 * picture — was what the marking used.
 *
 * The generator was innocent. It emitted `hLabel: "m + 15"`, the same string the
 * sentence carried. The drawing put that label in a 90-unit box starting at unit
 * 362 of a 396-unit viewBox, an SVG clips at its viewBox, and 72% of the ink was
 * cut off. What survived was the leading `m` — a *plausible* label, which is why
 * nobody caught it. A figure that renders as obvious garbage gets fixed in an
 * hour. A figure that renders as a different, well-formed question can ship.
 *
 * Every gate we had passed it. `validate-items` re-derived the mathematics and
 * the mathematics was right. `check-i18n` compared key sets and they matched.
 * `check-context-ask` reads situations against questions and this defect was in
 * neither — it was in the space between the item's data and the pixels.
 *
 * The same card carried two more faults of the same family:
 *   · the target expression `2(3m + 6) + 2(m + 15)` was printed in full in the
 *     statement box directly above the answer box, and the word "simplify"
 *     appeared nowhere — the question as written was answered by the display;
 *   · the footer read "Type the value that makes the statement true" while the
 *     task was to type an expression.
 *
 * So this file checks three things that nothing else checks:
 *
 *   A. AGREEMENT — every quantity a figure declares is a quantity the item's own
 *      mathematics declares, and the figure re-derives the item's own answer.
 *      A drawing may not carry a number the prose never said.
 *   B. NOT-ALREADY-ANSWERED — if the printed notation is already equivalent to
 *      the accepted answer, the question must name the rewriting as the task.
 *   C. LEGIBILITY (--render) — in a real browser, with the real `figureHtml` from
 *      `src/ui/rift.js` and the real `rift.css`, every label's ink lies inside
 *      the clip box with slack to spare. This is the one that would have caught
 *      the shipped defect, because A, B and the whole existing gate suite all
 *      passed while the picture on screen said something else.
 *
 *   node tools/check-figures.mjs              # A and B, every form × band × locale
 *   node tools/check-figures.mjs --render     # C, in a real browser
 *   node tools/check-figures.mjs --self-test  # prove A, B and C can all fail
 *   node tools/check-figures.mjs --list       # print every figure the bank makes
 */
import { realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generate, SKILLS, FORMS_BY_SKILL } from '../src/learn/generators.js';
import { equivalent, solveLinear } from '../src/learn/parser.js';
import { eq as req } from '../src/learn/rational.js';
import { allUnits, loadUnit } from './_courses.mjs';

/**
 * Every course the manifest ships, not just the one `generators.js` registers
 * at import. A pack draws figures through the same renderer, so a pack can
 * introduce exactly this defect and the gate has to be looking at it.
 */
export async function loadEveryCourse() {
  for (const { unit } of await allUnits()) await loadUnit(unit);
}

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
export const LOCALES = ['en', 'es', 'pl'];

/**
 * Every figure kind the bank may produce, and who draws it.
 *
 * `svg` kinds go through `figureHtml` in `src/ui/rift.js` and are drawn into a
 * clipping viewBox — those are the ones `--render` measures. `modality` kinds
 * are built as ordinary flow DOM by the rig that owns them (`_area`, `_balance`,
 * `mountPlot`), which cannot clip a label the way a viewBox can.
 *
 * A kind that appears in an item and is not listed here fails the gate. That is
 * deliberate: an unlisted kind is one `figureHtml` renders as the empty string,
 * so the card would silently lose its drawing and keep its prose — the same
 * defect as a wrong label, arrived at from the other side.
 */
export const FIGURE_KINDS = {
  rect: 'svg',
  line: 'svg',
  lines: 'svg',
  area: 'modality',
  balance: 'modality',
  plot: 'modality',
};

// ---------------------------------------------------------------------------
// Asks that declare rewriting as the task.
//
// An item whose display is already equivalent to its answer is legitimate — it
// is the whole shape of "simplify this" — but only if the question says so.
// Listing the keys, rather than grepping the prose for a verb, is the point:
// three languages have three verbs, and a new ask has to be classified by a
// person rather than pattern-matched by luck.
// ---------------------------------------------------------------------------
export const REWRITE_ASKS = new Set([
  'ask.simplify', 'ask.simplifyAlt', 'ask.simplifyAlt2',
  'ask.expand', 'ask.expandAndSimplify', 'ask.multiplyOut', 'ask.takeBracketOff',
  'ask.shareOut', 'ask.whichEquivalent', 'ask.whichProduct',
  'ask.perimeterGather', 'ask.areaMultiplyOut',
]);

const norm = (s) => String(s ?? '').replace(/\\left|\\right/g, '').replace(/\s+/g, '');

/** The notation inside a prose stem: every `$…$` span, unwrapped. */
export function mathSpans(stem) {
  return [...String(stem || '').matchAll(/\$([^$]+)\$/g)].map((m) => m[1]);
}

/**
 * Is this notation printed somewhere the learner can actually read it?
 *
 * `exact` demands that the prose states this quantity as a quantity of its own —
 * a whole `$…$` span — rather than merely containing its characters. It matters:
 * `m` is a substring of `m + 15`, so a containment test calls the truncated
 * label "stated in the prose" and waves through the very defect this file was
 * written for. A side of a rectangle is named outright by the sentence, so it
 * gets the exact test. A strip of a distributed width is one half of a printed
 * sum and is not stated alone, so it gets containment.
 */
function isOnScreen(item, src, { exact = false } = {}) {
  const want = norm(src);
  if (!want) return false;
  const spans = mathSpans(item.stem).map(norm);
  if (exact) return spans.includes(want);
  if (norm(item.latex).includes(want)) return true;
  return spans.some((s) => s === want || s.includes(want));
}

const onLine = (m, b, x, y) => m * x + b === y;

/**
 * One item's figure, checked against the item's own mathematics.
 *
 * Every branch answers the same question in the terms of its own kind: could a
 * learner who read ONLY the drawing arrive at the answer this item marks? If
 * not, the drawing and the marking are two different questions.
 */
export function auditFigure(item) {
  const out = [];
  const fig = item.figure;
  const where = `${item.skill}/${item.form} d${item.difficulty} seed ${item.seed}`;
  if (!fig) return out;

  const drawnBy = FIGURE_KINDS[fig.kind];
  if (!drawnBy) {
    out.push(`${where}: figure kind "${fig.kind}" is not declared in FIGURE_KINDS — nothing is known to draw it`);
    return out;
  }

  const v = item.check?.variable || (String(item.answer).match(/[a-zA-Z]/) || [])[0] || 'x';
  const equiv = (a, b) => { try { return equivalent(a, b, v) === true; } catch { return false; } };

  if (fig.kind === 'rect') {
    // The two sides are the whole question. Each must be printed in the prose
    // the learner reads, and the two of them must add up — twice each — to the
    // answer that will be marked.
    for (const [slot, label] of [['wLabel', fig.wLabel], ['hLabel', fig.hLabel]]) {
      if (!label) { out.push(`${where}: rect has no ${slot}`); continue; }
      if (!isOnScreen(item, label, { exact: true })) {
        out.push(`${where}: the drawing labels a side "${label}", which the prose never states`
          + `\n      stem: ${item.stem}\n      latex: ${item.latex}`);
      }
    }
    if (fig.wLabel && fig.hLabel) {
      const round = `2\\left(${fig.wLabel}\\right) + 2\\left(${fig.hLabel}\\right)`;
      if (!equiv(round, item.answer)) {
        out.push(`${where}: a learner reading only the drawing gets ${round}`
          + `, which is not the accepted answer ${item.answer}`);
      }
    }
  }

  if (fig.kind === 'area') {
    const { k, aLabel, bLabel } = fig;
    if (!Number.isFinite(Number(k))) out.push(`${where}: area figure has no depth`);
    for (const [slot, label] of [['aLabel', aLabel], ['bLabel', bLabel]]) {
      if (!label) { out.push(`${where}: area has no ${slot}`); continue; }
      if (!isOnScreen(item, label)) {
        out.push(`${where}: the field is drawn with a strip "${label}", which the prose never states`
          + `\n      stem: ${item.stem}\n      latex: ${item.latex}`);
      }
    }
    if (aLabel && bLabel) {
      const covered = `${k}\\left(${aLabel} + \\left(${bLabel}\\right)\\right)`;
      if (!equiv(covered, item.answer)) {
        out.push(`${where}: covering the drawn field gives ${covered}, not the accepted answer ${item.answer}`);
      }
    }
  }

  if (fig.kind === 'balance') {
    const { left = {}, right = {} } = fig;
    const lv = left.coef ?? 0, lk = left.konst ?? 0, rk = right.konst ?? 0;
    const beam = `${lv === 1 ? '' : lv}${left.v || v} ${lk < 0 ? '-' : '+'} ${Math.abs(lk)} = ${rk}`;
    let sol = null;
    try { sol = solveLinear(beam, left.v || v); } catch { /* reported below */ }
    if (!sol || sol.kind !== 'unique') {
      out.push(`${where}: the beam ${beam} does not state a solvable equation`);
    } else {
      let want = null;
      try { want = solveLinear(item.latex, left.v || v); } catch { /* reported below */ }
      if (!want || want.kind !== 'unique' || !req(want.value, sol.value)) {
        out.push(`${where}: the beam reads ${beam}, but the statement reads ${item.latex}`
          + ` — the pans and the notation are two different equations`);
      }
    }
  }

  if (fig.kind === 'line' || fig.kind === 'lines' || fig.kind === 'plot') {
    const lines = fig.kind === 'lines' ? (fig.lines || [])
      : fig.kind === 'plot' ? (fig.target ? [fig.target] : [])
        : [{ m: fig.m, b: fig.b }];
    if (!lines.length) out.push(`${where}: a ${fig.kind} figure with no trace to draw`);
    for (const ln of lines) {
      if (!Number.isFinite(ln.m) || !Number.isFinite(ln.b)) {
        out.push(`${where}: a trace with no rule (m=${ln.m}, b=${ln.b})`);
      }
    }
    // Every plotted reading must sit on a trace. A dot beside the line is a
    // reading the chart denies, and reading values off the chart is the entire
    // skill these items claim to test.
    for (const [x, y] of fig.points || []) {
      if (!lines.some((ln) => onLine(ln.m, ln.b, x, y))) {
        out.push(`${where}: the chart plots (${x}, ${y}), which sits on none of its own traces`
          + ` [${lines.map((l) => `y = ${l.m}x + ${l.b}`).join(', ')}]`);
      }
    }
    if (fig.mark && !lines.some((ln) => onLine(ln.m, ln.b, fig.mark[0], fig.mark[1]))) {
      out.push(`${where}: the chart marks (${fig.mark[0]}, ${fig.mark[1]}), which is not on its traces`);
    }
    // A GOLD RULE OFF THE EDGE OF THE PAPER IS NOT A RULE.
    //
    // These items say "what does the trace read at x = 4?" and draw a dashed
    // upright there. If that upright falls outside the drawn range, the cadet is
    // asked to read a crossing that is not on the picture — the graph half of
    // exactly the defect this file is about, and the reason the range is checked
    // and not merely the arithmetic.
    const R = fig.range;
    const inRange = (n) => !Number.isFinite(R) || Math.abs(n) <= R;
    if (fig.at != null && !inRange(fig.at)) {
      out.push(`${where}: the chart rules an upright at x = ${fig.at}, outside its own range of ±${R}`);
    }
    if (fig.at != null && lines.length === 1) {
      const y = lines[0].m * fig.at + lines[0].b;
      if (!inRange(y)) {
        out.push(`${where}: at x = ${fig.at} the trace reads ${y}, off the top of a chart that only shows ±${R}`);
      }
    }
    if (fig.target != null && fig.kind !== 'plot') {
      if (!inRange(fig.target)) {
        out.push(`${where}: the chart rules a level at y = ${fig.target}, outside its own range of ±${R}`);
      }
      if (lines.length === 1) {
        const ln = lines[0];
        if (ln.m !== 0 && !Number.isInteger((fig.target - ln.b) / ln.m)) {
          out.push(`${where}: the chart rules a level at y = ${fig.target}, which its trace crosses off the lattice`);
        }
        if (ln.m !== 0 && !inRange((fig.target - ln.b) / ln.m)) {
          out.push(`${where}: the trace reaches y = ${fig.target} at x = ${(fig.target - ln.b) / ln.m},`
            + ` outside the drawn range of ±${R} — the crossing the question asks for is not on the picture`);
        }
      }
    }
    for (const [x, y] of fig.points || []) {
      if (!inRange(x) || !inRange(y)) {
        out.push(`${where}: the chart plots (${x}, ${y}), outside its own range of ±${R}`);
      }
    }
  }

  return out;
}

/**
 * Is this item answered by its own display?
 *
 * `latex` is printed in the statement box directly above the answer box. If it
 * is already equivalent to what the marking accepts, then the only honest
 * question is "rewrite this", and the ask has to say so.
 */
export function auditSelfAnswering(item, askKey) {
  const where = `${item.skill}/${item.form} d${item.difficulty} seed ${item.seed}`;
  if (item.type !== 'expression') return [];
  const v = item.check?.variable || (String(item.answer).match(/[a-zA-Z]/) || [])[0];
  if (!v) return [];
  let same = null;
  try { same = equivalent(item.latex, item.answer, v); } catch { return []; }
  if (same !== true) return [];
  if (askKey && REWRITE_ASKS.has(askKey)) return [];
  return [`${where}: the display is already an expression for what the question asks`
    + `, and the ask (${askKey || 'unclassified'}) does not name the rewriting as the task`
    + `\n      stem : ${item.stem}\n      shown: ${item.latex}\n      marks: ${item.answer}`];
}

// ---------------------------------------------------------------------------
// Which ask each figure-bearing form uses.
//
// Written down rather than scraped, for the same reason `ASK_SUBJECT` is in
// check-context-ask.mjs: the pairing is the thing being checked, so it must be
// a person's claim that the build can falsify, not a regex's guess.
// ---------------------------------------------------------------------------
export const FORM_ASK = {
  'lt-perimeter': 'ask.perimeterGather',
  'ds-area': 'ask.areaMultiplyOut',
  'lt-collect': 'ask.simplifyAlt2',
  'lt-three': 'ask.simplifyAlt2',
  'lt-four': 'ask.simplifyAlt2',
  'lt-square': 'ask.simplifyAlt2',
  'lt-equivalent': 'ask.whichEquivalent',
  'ds-expand': 'ask.expand',
  'ds-negative': 'ask.expand',
  'ds-share': 'ask.shareOut',
  'ds-twoterm': 'ask.expandAndSimplify',
  'ds-factor': 'ask.whichProduct',
};

/** The whole bank, every band, many seeds, all three locales. */
export function auditFigures({ seeds = 12, locales = LOCALES, items = null } = {}) {
  const problems = [];
  const seen = new Map();
  let checked = 0;

  const take = (item, locale) => {
    checked++;
    if (item.figure) {
      const key = `${item.skill}/${item.form}/${item.figure.kind}`;
      if (!seen.has(key)) seen.set(key, { item, locale });
      for (const p of auditFigure(item)) problems.push(`${locale}: ${p}`);
    }
    for (const p of auditSelfAnswering(item, FORM_ASK[item.form])) problems.push(`${locale}: ${p}`);
  };

  if (items) {
    for (const { item, locale } of items) take(item, locale || 'en');
    return { problems, checked, seen };
  }

  for (const skill of SKILLS) {
    for (const f of FORMS_BY_SKILL[skill] || []) {
      for (let d = f.dMin; d <= f.dMax; d++) {
        for (let s = 0; s < seeds; s++) {
          for (const locale of locales) {
            let item;
            try {
              item = generate(skill, d, 7001 + s * 6779, { form: f.id, locale, record: false });
            } catch { continue; }
            take(item, locale);
          }
        }
      }
    }
  }
  return { problems, checked, seen };
}

/** One representative item per figure-bearing form, for the render pass. */
export function figureSamples({ seeds = 24 } = {}) {
  const out = [];
  const seen = new Set();
  for (const skill of SKILLS) {
    for (const f of FORMS_BY_SKILL[skill] || []) {
      for (let d = f.dMin; d <= f.dMax; d++) {
        for (let s = 0; s < seeds; s++) {
          for (const locale of LOCALES) {
            let item;
            try { item = generate(skill, d, 8101 + s * 4409, { form: f.id, locale, record: false }); } catch { continue; }
            if (!item.figure || FIGURE_KINDS[item.figure.kind] !== 'svg') continue;
            // Widest labels matter most, so keep every distinct label pair
            // rather than the first one drawn.
            const key = `${f.id}/${locale}/${item.figure.wLabel || ''}|${item.figure.hLabel || ''}`
              + `|${item.figure.m ?? ''}|${item.figure.b ?? ''}|${item.figure.range ?? ''}`;
            if (seen.has(key)) continue;
            seen.add(key);
            out.push({
              skill, form: f.id, d, locale, seed: item.seed,
              figure: item.figure,
              expect: {
                w: item.figure.wLabel ? norm(item.figure.wLabel) : null,
                h: item.figure.hLabel ? norm(item.figure.hLabel) : null,
              },
            });
          }
        }
      }
    }
  }
  return out;
}

export { norm as normNotation };

// ---------------------------------------------------------------------------
// C. LEGIBILITY — the pixels, in a real browser.
//
// A, above, reads the item's data. The shipped defect was not in the data: the
// generator emitted the right label and the renderer cut it in half. So this
// pass renders the REAL `figureHtml` from `src/ui/rift.js`, under the REAL
// `rift.css`, through a real Vite dev server, and measures the ink.
//
// Two things are asserted of every label:
//   · its text is exactly the notation the item declared — not a prefix of it;
//   · its ink lies inside the SVG's clip box, with at least SLACK of the label
//     box to spare, so that a slightly wider draw in some future band does not
//     land straight back on the edge.
//
// The second one is what matters. `m + 15` clipped to `m` reads as a complete,
// well-formed label; no assertion about text content can see it, because the
// text is all still in the DOM. Only geometry knows.
// ---------------------------------------------------------------------------
const SLACK = 0.12;   // of the label box, on each side, that must stay unused

/**
 * A FROZEN build of a harness page, served on its own port.
 *
 * Not the dev server. Several builders hot-edit this tree at once, so Vite
 * full-reloads mid-measure and Playwright dies with "Execution context was
 * destroyed" — the house rule (BRIEF.md) is to judge frozen pixels. This builds
 * a one-line entry that re-exports the real `figureHtml` from `src/ui/rift.js`,
 * which pulls in the real `rift.css` through the real bundler, and serves the
 * result as static files. Nothing can reload underneath it.
 */
async function serveFrozen() {
  const { build } = await import('vite');
  const { mkdtemp, writeFile, rm, readFile } = await import('node:fs/promises');
  const { createServer } = await import('node:http');
  const os = await import('node:os');

  const stage = path.join(ROOT, 'tools/critic/tmp/.figharness');
  await rm(stage, { recursive: true, force: true });
  await (await import('node:fs/promises')).mkdir(stage, { recursive: true });
  // The entry lives inside the repo so it resolves `src/ui/rift.js` and its CSS
  // exactly as the game does.
  await writeFile(path.join(stage, 'harness.js'),
    `import { figureHtml } from '${path.relative(stage, path.join(ROOT, 'src/ui/rift.js')).replace(/\\/g, '/')}';\n`
    + `window.__figureHtml = figureHtml;\n`
    + `window.__ready = true;\n`);
  await writeFile(path.join(stage, 'index.html'),
    `<!doctype html><html><head><meta charset="utf-8"><title>figure harness</title></head>`
    + `<body><div id="stage"></div><script type="module" src="./harness.js"></script></body></html>`);

  const out = await mkdtemp(path.join(os.tmpdir(), 'ascent-fig-'));
  await build({
    root: ROOT,
    base: './',
    logLevel: 'error',
    build: { target: 'es2022', outDir: out, emptyOutDir: true, sourcemap: false,
      rollupOptions: { input: path.join(stage, 'index.html') } },
  });

  // The built html lands under the entry's path relative to root.
  const rel = path.relative(ROOT, path.join(stage, 'index.html'));
  const port = 4700 + Math.floor(Math.random() * 500);
  const types = { '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css',
    '.woff': 'font/woff', '.woff2': 'font/woff2', '.ttf': 'font/ttf', '.svg': 'image/svg+xml',
    '.png': 'image/png', '.jpg': 'image/jpeg', '.json': 'application/json' };
  const server = createServer(async (req, res) => {
    const p = path.join(out, decodeURIComponent(req.url.split('?')[0]));
    try {
      const body = await readFile(p);
      res.writeHead(200, { 'content-type': types[path.extname(p)] || 'application/octet-stream' });
      res.end(body);
    } catch { res.writeHead(404); res.end('no'); }
  });
  await new Promise((r) => server.listen(port, '127.0.0.1', r));
  return {
    base: `http://127.0.0.1:${port}/${rel.split(path.sep).join('/')}`,
    stop: async () => { server.close(); await rm(out, { recursive: true, force: true }); await rm(stage, { recursive: true, force: true }); },
  };
}

/**
 * Measure every label of every figure the bank can draw.
 *
 * `samples` may be overridden so the self-test can push a known-bad geometry
 * through the identical measuring code.
 */
export async function auditRendered({ samples = null, geometry = null } = {}) {
  const { chromium } = await import('playwright');
  const list = samples || figureSamples();
  const server = await serveFrozen();
  const browser = await chromium.launch();
  const problems = [];
  let measured = 0;
  try {
    const page = await browser.newPage({ viewport: { width: 1280, height: 900 } });
    const errors = [];
    page.on('pageerror', (e) => errors.push(String(e)));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    await page.goto(server.base, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 30000 });

    const results = await page.evaluate(async ({ list, geometry, SLACK }) => {
      const real = window.__figureHtml;
      // The self-test swaps in a past geometry and measures it with this same
      // code, so a claim that the gate "would have caught it" is demonstrated
      // rather than asserted. `texFirst` is handed in because the replaced body
      // is `rectSvg`'s, which closes over it in the real module.
      const probe = document.createElement('div');
      probe.innerHTML = real({ kind: 'rect', wLabel: 'x', hLabel: 'x' });
      const tex = (srcs) => { const d = document.createElement('div'); d.innerHTML = real({ kind: 'rect', wLabel: srcs[0], hLabel: srcs[0] }); return d.querySelector('.figlabel').innerHTML; };
      const figureHtml = geometry ? new Function('texFirst', 'fig', geometry) : null;
      const host = document.createElement('div');
      // The figure's real home: the same box, the same width constraints.
      host.className = 'rift';
      host.style.cssText = 'position:fixed;left:0;top:0;width:520px;z-index:99999;opacity:1;';
      host.innerHTML = '<div class="rf-figbox"></div>';
      document.body.appendChild(host);
      const box = host.querySelector('.rf-figbox');
      const out = [];
      for (const s of list) {
        box.innerHTML = figureHtml ? figureHtml(tex, s.figure) : real(s.figure);
        const svg = box.querySelector('svg');
        if (!svg) { out.push({ ...s, fatal: 'figureHtml drew nothing' }); continue; }
        const sb = svg.getBoundingClientRect();
        const labels = [];
        for (const el of box.querySelectorAll('.figlabel')) {
          // KaTeX emits the same maths twice — a visually-hidden MathML copy for
          // screen readers and the HTML copy that is actually drawn. Only the
          // drawn one has a size, and only the drawn one is what a cadet reads.
          const ink = el.querySelector('.katex-html') || el.querySelector('.katex') || el;
          const r = ink.getBoundingClientRect();
          const hostR = el.getBoundingClientRect();
          labels.push({
            slot: el.dataset.fig || '?',
            text: ink.textContent.replace(/\s+/g, ''),
            // How much of the label's ink is inside the clip box, 0..1.
            visible: r.width > 0
              ? Math.max(0, Math.min(r.right, sb.right) - Math.max(r.left, sb.left)) / r.width
              : 0,
            // How much of its own box the ink leaves unused on the tighter side.
            slack: hostR.width > 0
              ? Math.min(r.left - hostR.left, hostR.right - r.right) / hostR.width
              : -1,
            rightOverflow: +(r.right - sb.right).toFixed(1),
          });
        }
        // Axis numerals and the like are plain SVG <text>; they clip too.
        const texts = [];
        for (const el of svg.querySelectorAll('text')) {
          const r = el.getBoundingClientRect();
          if (!r.width) continue;
          texts.push({
            text: el.textContent,
            inside: r.left >= sb.left - 0.5 && r.right <= sb.right + 0.5
              && r.top >= sb.top - 0.5 && r.bottom <= sb.bottom + 0.5,
          });
        }
        out.push({ ...s, labels, texts });
      }
      host.remove();
      return out;
    }, { list, geometry, SLACK });

    for (const r of results) {
      const where = `${r.locale}: ${r.skill}/${r.form} d${r.d} seed ${r.seed} (${r.figure.kind})`;
      measured++;
      if (r.fatal) { problems.push(`${where}: ${r.fatal}`); continue; }
      for (const L of r.labels) {
        const want = L.slot === 'w' ? r.expect.w : L.slot === 'h' ? r.expect.h : null;
        if (want && L.text !== want) {
          problems.push(`${where}: the ${L.slot} label renders as "${L.text}" but the item declares "${want}"`);
        }
        if (L.visible < 0.999) {
          problems.push(`${where}: the ${L.slot} label "${L.text}" is CLIPPED — only ${(L.visible * 100).toFixed(0)}%`
            + ` of its ink is inside the drawing (${L.rightOverflow}px past the edge).`
            + ` A cadet reads a different side length than the prose states.`);
        } else if (L.slack < SLACK) {
          problems.push(`${where}: the ${L.slot} label "${L.text}" fills its box to within`
            + ` ${(L.slack * 100).toFixed(1)}% (need ${(SLACK * 100).toFixed(0)}%) — one wider band clips it`);
        }
      }
      for (const T of r.texts) {
        if (!T.inside) problems.push(`${where}: the scale numeral "${T.text}" falls outside the drawing`);
      }
    }
    if (errors.length) problems.push(`console errors while drawing figures: ${errors.slice(0, 3).join(' | ')}`);
  } finally {
    await browser.close();
    // Awaited: the teardown deletes the staged entry, and a second pass (the
    // self-test runs two) must not start building while it is being removed.
    await server.stop();
  }
  return { problems, measured, total: list.length };
}

// ---------------------------------------------------------------------------
// Prove the gate can fail.
// ---------------------------------------------------------------------------

/** A. plant a drawing that contradicts its own prose. */
function selfTestAgreement() {
  const item = generate('like-terms', 4, 4242, { form: 'lt-perimeter', locale: 'en', record: false });
  const clean = auditFigure(item);
  // Exactly the shipped defect, in data form: the drawing keeps the leading
  // term of the side and drops the constant, the way the clip did.
  const cut = { ...item, figure: { ...item.figure, hLabel: item.figure.hLabel.split(' ')[0] } };
  const caught = auditFigure(cut);
  // …and the mirror image: a side the prose never mentions at all.
  const invented = { ...item, figure: { ...item.figure, wLabel: '9z + 1' } };
  const caught2 = auditFigure(invented);

  // The same defect on a chart: a dot drawn beside its own trace, and a gold
  // rule at a level the drawn window never shows.
  const gitem = generate('two-step', 3, 4242, { form: 'ts-graph', locale: 'en', record: false });
  const gclean = auditFigure(gitem);
  const offLine = { ...gitem, figure: { ...gitem.figure, points: [[gitem.figure.points[0][0], gitem.figure.points[0][1] + 1]] } };
  const caught3 = auditFigure(offLine);
  const offPaper = { ...gitem, figure: { ...gitem.figure, target: gitem.figure.range * 4 } };
  const caught4 = auditFigure(offPaper);

  const ok = clean.length === 0 && caught.length > 0 && caught2.length > 0
    && gclean.length === 0 && caught3.length > 0 && caught4.length > 0;
  console.log(`  A agreement: ${ok ? 'PASS' : 'FAIL'}`);
  console.log(`     clean item (${item.figure.wLabel} × ${item.figure.hLabel}): ${clean.length} problem(s)`);
  console.log(`     height label truncated to "${cut.figure.hLabel}": ${caught.length} problem(s)`);
  for (const p of caught) console.log('       · ' + p.split('\n')[0]);
  console.log(`     width label replaced with "9z + 1": ${caught2.length} problem(s)`);
  for (const p of caught2) console.log('       · ' + p.split('\n')[0]);
  console.log(`     clean chart (y = ${gitem.figure.m}x + ${gitem.figure.b}): ${gclean.length} problem(s)`);
  console.log(`     one plotted reading nudged off its trace: ${caught3.length} problem(s)`);
  for (const p of caught3) console.log('       · ' + p.split('\n')[0]);
  console.log(`     the gold rule moved off the drawn window: ${caught4.length} problem(s)`);
  for (const p of caught4) console.log('       · ' + p.split('\n')[0]);
  return ok;
}

/** B. plant a question that its own display answers. */
function selfTestSelfAnswering() {
  const item = generate('like-terms', 4, 4242, { form: 'lt-perimeter', locale: 'en', record: false });
  const clean = auditSelfAnswering(item, FORM_ASK['lt-perimeter']);
  // The ask as it shipped: names the quantity, never names the work.
  const shipped = auditSelfAnswering({ ...item, stem: 'Which expression gives the distance all the way round?' }, 'ask.perimeterExpr');
  const ok = clean.length === 0 && shipped.length > 0;
  console.log(`  B not-already-answered: ${ok ? 'PASS' : 'FAIL'}`);
  console.log(`     with ask.perimeterGather: ${clean.length} problem(s)`);
  console.log(`     with the shipped ask.perimeterExpr: ${shipped.length} problem(s)`);
  for (const p of shipped) console.log('       · ' + p.split('\n')[0]);
  return ok;
}

/**
 * C. put the shipped geometry back and prove the browser pass rejects it.
 *
 * This is the important one. The body below is `rectSvg` exactly as it shipped
 * — a 90-unit label box beginning at unit 362 of a 396-unit viewBox — measured
 * by the identical code that measures the real renderer.
 */
const SHIPPED_RECT_SVG = `
  const w = 300, h = 150;
  return \`<div class="rf-fig">
    <svg viewBox="0 0 \${w + 96} \${h + 62}" role="img">
      <rect x="56" y="34" width="\${w}" height="\${h}" fill="rgba(95,230,255,.07)" stroke="#5fe6ff" stroke-width="1.4"/>
      <path d="M56 22 h\${w}" stroke="rgba(95,230,255,.5)" stroke-width="1" stroke-dasharray="3 3"/>
      <path d="M44 34 v\${h}" stroke="rgba(95,230,255,.5)" stroke-width="1" stroke-dasharray="3 3"/>
      <foreignObject x="56" y="0" width="\${w}" height="22">
        <div class="figlabel" data-fig="w" xmlns="http://www.w3.org/1999/xhtml">\${texFirst([fig.wLabel]) || ''}</div>
      </foreignObject>
      <foreignObject x="\${56 + w + 6}" y="\${34 + h / 2 - 14}" width="90" height="28">
        <div class="figlabel" data-fig="h" xmlns="http://www.w3.org/1999/xhtml">\${texFirst([fig.hLabel]) || ''}</div>
      </foreignObject>
    </svg></div>\`;`;

async function selfTestRendered() {
  const rects = figureSamples().filter((s) => s.figure.kind === 'rect').slice(0, 8);
  if (!rects.length) { console.log('  C legibility: FAIL — no rect figures to measure'); return false; }
  const now = await auditRendered({ samples: rects });
  const then = await auditRendered({ samples: rects, geometry: SHIPPED_RECT_SVG });
  const clipped = then.problems.filter((p) => /CLIPPED/.test(p));
  const ok = now.problems.length === 0 && clipped.length > 0;
  console.log(`  C legibility: ${ok ? 'PASS' : 'FAIL'}`);
  console.log(`     today's rectSvg over ${rects.length} drawings: ${now.problems.length} problem(s)`);
  for (const p of now.problems.slice(0, 3)) console.log('       · ' + p);
  console.log(`     the shipped rectSvg put back: ${then.problems.length} problem(s), ${clipped.length} clipped`);
  for (const p of clipped.slice(0, 3)) console.log('       · ' + p);
  return ok;
}

// ---------------------------------------------------------------------------
// CLI
// ---------------------------------------------------------------------------
const invokedDirectly = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
if (invokedDirectly) {
  const args = process.argv.slice(2);
  await loadEveryCourse();
  if (args.includes('--list')) {
    const { seen } = auditFigures({ seeds: 6, locales: ['en'] });
    for (const [key, { item }] of [...seen].sort()) {
      console.log(`${key.padEnd(40)} ${FIGURE_KINDS[item.figure.kind].padEnd(9)} ${JSON.stringify(item.figure).slice(0, 90)}`);
    }
    process.exit(0);
  }
  if (args.includes('--self-test')) {
    console.log('ASCENT — figure/prose agreement · self-test');
    const a = selfTestAgreement();
    const b = selfTestSelfAnswering();
    const c = args.includes('--no-render') ? true : await selfTestRendered();
    const ok = a && b && c;
    console.log(ok ? '\nself-test: PASS — every branch of the gate was watched to fail.'
      : '\nself-test: FAIL — a branch of the gate did not catch its planted defect.');
    process.exit(ok ? 0 : 1);
  }
  if (args.includes('--render')) {
    const { problems, measured, total } = await auditRendered();
    console.log('ASCENT — figure legibility (real browser, real rift.js, real rift.css)');
    console.log(`  ${measured}/${total} drawings measured`);
    if (problems.length) {
      console.error(`\n  ${problems.length} problem(s):`);
      for (const p of problems) console.error('   · ' + p);
      console.error('\nFAIL — a drawing does not say what the item says.');
      process.exit(1);
    }
    console.log('\n  PASS — every label renders in full, inside its drawing, in all three languages');
    process.exit(0);
  }
  const { problems, checked, seen } = auditFigures();
  console.log('ASCENT — figure/prose agreement');
  console.log(`  ${checked} items over ${LOCALES.length} locales; ${seen.size} distinct figure-bearing forms`);
  console.log(`  ${Object.keys(FIGURE_KINDS).length} figure kinds declared, ${REWRITE_ASKS.size} asks classified as rewriting`);
  if (problems.length) {
    console.error(`\n  ${problems.length} problem(s):`);
    for (const p of problems.slice(0, 40)) console.error('   · ' + p);
    console.error('\nFAIL — a drawing contradicts its item, or a question is answered by its own display.');
    process.exit(1);
  }
  console.log('\n  PASS — every figure re-derives its item\'s answer, and no question is answered by its display');
}
