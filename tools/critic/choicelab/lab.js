/**
 * The choice-set audit lab.
 *
 * ANSWER INTEGRITY is the one defect class a learning product cannot survive:
 * a student who is right and is told they are wrong stops believing the thing
 * that told them. Generation-level checks cannot see it, because the fault can
 * live anywhere between "the generator computed 144" and "the learner reads a
 * button". So this page mounts the REAL `RiftPanel` — the shipping class, its
 * own CSS, strict KaTeX, the real item bank, the real locale bundles — puts
 * every item form on it, and reads the choice set back off the DOM the learner
 * would actually be looking at.
 *
 * For every option it asserts:
 *   a. exactly one option is mathematically correct, decided by an INDEPENDENT
 *      re-derivation from `item.check` (parser.js), never by `item.answer`;
 *   b. the correct option's RENDERED glyphs are the expected answer;
 *   c. no two options render identically;
 *   d. clicking the option a correct solver would pick actually seals the rift,
 *      and clicking any other option never does.
 *
 * (d) is the whole point. It is done by dispatching real clicks at the real
 * buttons and reading the panel's own settled flag — not by inspecting the
 * closure that built them.
 *
 * `window.__lab.run(plan)` returns findings; tools/critic/choiceaudit.mjs
 * drives it.
 */
import 'katex/dist/katex.min.css';
import { RiftPanel } from '../../../src/ui/rift.js';
import { safeGenerate, SKILLS, FORMS_BY_SKILL } from '../../../src/learn/generators.js';
// Every unit the manifest ships, not only the one that registers itself at
// import. Without this the render-level audit covers Level 1 and silently
// says nothing at all about any other course.
import { registerPack } from '../../../src/content/registry.js';
import algebra1L2 from '../../../src/content/packs/algebra1-l2.js';
registerPack(algebra1L2);
import { ITEM_BUNDLES } from '../../../src/learn/strings.js';
import { setLocale, LOCALES } from '../../../src/i18n/index.js';
import { evaluate, solveLinear, equivalent, parseArrayCells } from '../../../src/learn/parser.js';
import { R, add, sub, mul, div, eq as req, fromString, str as rstr } from '../../../src/learn/rational.js';

const root = document.getElementById('app');
const panel = new RiftPanel(root);

// ---------------------------------------------------------------------------
// What the learner actually sees
// ---------------------------------------------------------------------------
/**
 * The glyphs on a button, IN READING ORDER.
 *
 * `textContent` is not good enough and is actively misleading here: KaTeX
 * stacks a fraction bottom-to-top, so `\frac{k}{4}` has the DOM order "4", "k"
 * and reads back as the completely different expression `4k`. An audit that
 * cannot tell those two apart is exactly the audit that would let a choice set
 * ship with two options a learner sees as identical. So the numerator and
 * denominator of every `.mfrac` are put back in the order an eye takes them,
 * and the layout struts KaTeX uses for spacing are dropped.
 */
const SKIP = ['katex-mathml', 'pstrut', 'vlist-s', 'frac-line', 'key', 'hintmark', 'strut', 'sizing-reset'];
function readNode(node, out) {
  if (node.nodeType === 3) { out.push(node.nodeValue); return; }
  if (node.nodeType !== 1) return;
  for (const c of SKIP) if (node.classList.contains(c)) return;
  if (node.classList.contains('mfrac')) {
    const vlist = node.querySelector('.vlist');
    if (vlist) {
      const parts = [...vlist.children]
        .map((c) => { const o = []; readNode(c, o); return o.join('').trim(); })
        .filter((s) => s.length);
      out.push(`(${parts.reverse().join(')/(')})`);   // stacked bottom-up -> read top-down
      return;
    }
  }
  for (const c of node.childNodes) readNode(c, out);
}
function visibleText(el) {
  const out = [];
  readNode(el, out);
  return out.join('');
}
const canon = (s) => String(s)
  .normalize('NFD')
  // KaTeX sets "ó" as an o with a separately-drawn accent stacked over it, so
  // the DOM reads "oˊ" for something the eye reads as "ó" (verified against
  // real pixels in shots/ped-special). Both spellings fold to the same letter
  // here; a missing accent is a typography question, not an answer-integrity
  // one, and this audit is not the place to conflate them.
  .replace(/[̀-ͯʰ-˿]/g, '')
  .replace(/[−‒–—‐‑]/g, '-')
  .replace(/[\s   ​⁡]/g, '')
  .trim();
/**
 * Digits, letters, and the marks that change what a number IS — the minus and
 * the fraction bar. Immune to how a plus or a times is drawn, which varies by
 * locale on purpose; not immune to anything that would change a value.
 */
// A relation is one of those marks: "x > 5" and "x \\ge 5" are different
// statements about different sets, so the four of them are kept.
const glyphs = (s) => canon(s).replace(/[^0-9A-Za-zÀ-ɏ\-/()<>≤≥]/g, '');

/**
 * What the glyphs for a value SHOULD be, derived from the value string itself
 * rather than from the code that renders it. A stacked fraction shows numerator
 * then denominator with no slash between them; everything else is literal.
 */
function expectedVisible(value) {
  let s = String(value).trim();
  const txt = s.match(/^\\text\{([^}]*)\}$/);
  if (txt) return canon(txt[1]);
  s = s.replace(/\\left|\\right/g, '')
    .replace(/\\cdot|\\times/g, '*')
    .replace(/\\div|\\mathbin\{:\}/g, ':')
    // The relations, as KaTeX draws them. Without these a statement option is
    // compared letter by letter against the control sequence that produced it,
    // and every inequality in the bank reads as a mismatch.
    .replace(/\\le(?![a-zA-Z])/g, '≤')
    .replace(/\\ge(?![a-zA-Z])/g, '≥')
    .replace(/\\lt(?![a-zA-Z])/g, '<')
    .replace(/\\gt(?![a-zA-Z])/g, '>')
    .replace(/\\Rightarrow/g, '⇒')
    .replace(/\\square/g, '□')
    .replace(/\\qquad|\\quad/g, '')
    .replace(/\\[,;:! ]/g, '');
  // A stacked fraction is read numerator first — the same convention the DOM
  // reader above puts it back into.
  for (let i = 0; i < 4; i++) s = s.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, '($1)/($2)');
  // "a/b" typed plainly is stacked by texify(), so it reads the same way.
  s = s.replace(/^(-?)(\d+)\/(\d+)$/, '$1($2)/($3)');
  return canon(s.replace(/[{}]/g, ''));
}

// ---------------------------------------------------------------------------
// The independent oracle. Nothing here reads item.answer to decide truth.
// ---------------------------------------------------------------------------
const ratio = (s) => fromString(String(s).trim());

/** Re-derive what is true from the item's verification descriptor. */
function oracle(item) {
  const c = item.check || {};
  switch (c.kind) {
    case 'evaluate':
      return { kind: 'value', value: evaluate(c.math, c.env) };
    case 'solve': {
      const sol = solveLinear(c.math, c.variable);
      if (sol.kind === 'unique') return { kind: 'value', value: sol.value };
      return { kind: 'special', which: sol.kind === 'none' ? 'NONE' : 'ALL' };
    }
    case 'equivalent':
      return { kind: 'expr', src: c.math, variable: c.variable };
    case 'equationChoice':
      return { kind: 'equation', expect: c.expect, variable: c.variable };
    case 'table': {
      const cells = parseArrayCells(item.latex).slice(1);
      const known = cells.filter((r) => r.length >= 2 && r[0] !== '?' && r[1] !== '?')
        .map((r) => [Number(r[0]), Number(r[1])]);
      const [x1, y1] = known[0], [x2, y2] = known[1];
      const m = div(sub(R(y2), R(y1)), sub(R(x2), R(x1)));
      const b = sub(R(y1), mul(m, R(x1)));
      const gap = cells.find((r) => r[0] === '?' || r[1] === '?');
      return {
        kind: 'value',
        value: gap[0] === '?' ? div(sub(R(Number(gap[1])), b), m) : add(mul(m, R(Number(gap[0]))), b),
      };
    }
    case 'graph': {
      const [[x1, y1], [x2, y2]] = c.points;
      const m = div(sub(R(y2), R(y1)), sub(R(x2), R(x1)));
      const b = sub(R(y1), mul(m, R(x1)));
      return { kind: 'value', value: c.mode === 'y' ? add(mul(m, R(c.at)), b) : div(sub(R(c.at), b), m) };
    }
    default:
      // 'literal' and anything new: no second derivation is possible, so the
      // audit falls back to the item's own answer and says so.
      return { kind: 'trusted', answer: String(item.answer) };
  }
}

/** Is this option string the true one, according to the oracle? */
function isTrue(item, truth, value, locale) {
  const v = String(value).trim();
  switch (truth.kind) {
    case 'value': {
      const r = ratio(v);
      return !!r && req(r, truth.value);
    }
    case 'special': {
      const bundle = ITEM_BUNDLES[locale] || ITEM_BUNDLES.en;
      const want = truth.which === 'NONE' ? bundle['answer.noSolution'] : bundle['answer.allValues'];
      return canon(expectedVisible(v)) === canon(want);
    }
    case 'expr':
      try { return equivalent(v, truth.src, truth.variable) === true; } catch { return false; }
    case 'equation':
      try {
        const s = solveLinear(v, truth.variable);
        return s.kind === 'unique' && rstr(s.value) === truth.expect;
      } catch { return false; }
    default: {
      const a = ratio(v), b = ratio(truth.answer);
      if (a && b) return req(a, b);
      return canon(v) === canon(truth.answer);
    }
  }
}

/** What the true answer should look like on screen. */
function truthVisible(item, truth, locale) {
  switch (truth.kind) {
    case 'value': return expectedVisible(rstr(truth.value));
    case 'special': {
      const bundle = ITEM_BUNDLES[locale] || ITEM_BUNDLES.en;
      return canon(truth.which === 'NONE' ? bundle['answer.noSolution'] : bundle['answer.allValues']);
    }
    default: return expectedVisible(item.answer);
  }
}

// ---------------------------------------------------------------------------
// Driving the real surface
// ---------------------------------------------------------------------------
const click = (el) => el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));

function show(item) {
  panel.show(item, {
    title: '', skillId: item.skill, tier: 0, kind: 'learn',
    scaffold: 'none', example: null, streak: 0,
    onAnswer() { return { gained: 1, pL: 1, prev: 0.5 }; },
    onClose() {},
  });
}

/** Two honest misses, so the keypad narrows to three readings the way it does in play. */
function forceNarrow(item) {
  const wrongs = ['987654', '765432', '654321'];
  for (const w of wrongs) {
    if (panel._settled) return false;
    panel._modality.set(w);
    panel._modality.submit();
    if (panel._settled) { show(item); continue; }
    if (panel.el.querySelector('.rf-narrow')) return true;
  }
  return !!panel.el.querySelector('.rf-narrow');
}

function readOptions(scope) {
  return [...panel.el.querySelectorAll(scope)].map((b) => ({
    el: b,
    value: b.dataset.value,
    visible: visibleText(b),
  }));
}

/**
 * Audit one generated item end to end. Returns a list of findings (empty when
 * the surface is honest) plus a note of what was actually exercised.
 */
function auditItem(item, locale, ctx) {
  const out = [];
  const add = (code, detail) => out.push({ code, detail, ...ctx, locale, mode: panel.mode, answer: item.answer });

  let truth;
  try { truth = oracle(item); } catch (e) { add('oracle-threw', e.message); return { findings: out, mode: panel.mode }; }

  let options = [];
  let surface = null;
  if (panel.mode === 'choice') {
    surface = 'choice';
    options = readOptions('.rf-readings .rf-reading');
  } else if (panel.mode === 'keypad') {
    if (forceNarrow(item)) {
      surface = 'narrow';
      options = readOptions('.rf-narrow .rf-reading');
    }
  } else if (panel.mode === 'area') {
    // Not a choice set, but the same failure is available to it: if the tray
    // holds no chip for a cell, the correct move is not on the surface.
    const wants = [...panel.el.querySelectorAll('.rf-cell')].map((c) => c.dataset.want);
    const have = [...panel.el.querySelectorAll('.rf-chip')].map((c) => c.dataset.value);
    for (const w of wants) if (!have.includes(w)) add('area-missing-chip', `no chip for "${w}" among [${have.join(', ')}]`);
    return { findings: out, mode: 'area' };
  } else {
    return { findings: out, mode: panel.mode };
  }

  if (!options.length) return { findings: out, mode: panel.mode, surface };

  // ---- (c) two options that read the same are one option ----
  const seen = new Map();
  for (const o of options) {
    const k = canon(o.visible);
    if (seen.has(k)) add('duplicate-rendering', `"${k}" rendered by values "${seen.get(k)}" and "${o.value}"`);
    seen.set(k, o.value);
  }

  // ---- every option must render as the value it claims to be ----
  for (const o of options) {
    const want = expectedVisible(o.value);
    if (glyphs(o.visible) !== glyphs(want)) {
      add('render-mismatch', `value "${o.value}" should read "${want}" but reads "${canon(o.visible)}"`);
    }
  }

  // ---- (a) exactly one option is true, per the independent oracle ----
  const trueIdx = options.map((o, i) => (isTrue(item, truth, o.value, locale) ? i : -1)).filter((i) => i >= 0);
  if (trueIdx.length === 0) {
    add('no-correct-option', `options [${options.map((o) => canon(o.visible)).join(' | ')}] — none is the answer (${truthVisible(item, truth, locale)})`);
  } else if (trueIdx.length > 1) {
    add('multiple-correct-options', `${trueIdx.length} of [${options.map((o) => canon(o.visible)).join(' | ')}] are correct`);
  }

  // ---- (b) the true option reads as the true answer ----
  if (trueIdx.length === 1) {
    const want = truthVisible(item, truth, locale);
    const got = options[trueIdx[0]].visible;
    if (glyphs(got) !== glyphs(want)) {
      add('answer-renders-wrong', `answer should read "${want}" but the correct option reads "${canon(got)}"`);
    }
  }

  // ---- (d) the surface agrees: real clicks, real settle flag ----
  if (trueIdx.length === 1) {
    for (let i = 0; i < options.length; i++) {
      if (i === trueIdx[0]) continue;
      click(options[i].el);
      if (panel._settled) {
        add('wrong-option-accepted', `clicking "${canon(options[i].visible)}" (value "${options[i].value}") sealed the rift`);
        show(item);
        return { findings: out, mode: panel.mode, surface };
      }
    }
    click(options[trueIdx[0]].el);
    if (!panel._settled) {
      add('correct-option-rejected', `clicking the correct option "${canon(options[trueIdx[0]].visible)}" (value "${options[trueIdx[0]].value}") did NOT seal the rift`);
    }
  }

  return { findings: out, mode: panel.mode, surface };
}

// ---------------------------------------------------------------------------
// Answer checking: a correct entry must never be marked wrong.
// ---------------------------------------------------------------------------
/** Every spelling of the right answer a learner could plausibly hand in. */
function acceptableForms(item, truth) {
  const forms = new Set();
  if (truth.kind === 'value') {
    const v = truth.value;
    forms.add(rstr(v));
    if (v.d !== 1) {
      forms.add(`${v.n}/${v.d}`);
      forms.add(`${v.n * 2}/${v.d * 2}`);      // an unreduced but correct fraction
      forms.add(`${v.n * 3}/${v.d * 3}`);
    } else {
      forms.add(`${v.n}/1`);
      forms.add(`${v.n * 2}/2`);
    }
  } else if (truth.kind === 'expr' || truth.kind === 'trusted') {
    const a = String(item.answer);
    forms.add(a);
    // "15 + 6x" is "6x + 15". A cadet who writes the constant first has not
    // made a mistake, and a checker that only compares strings would say they
    // had — so the audit hands the rig the same expression in the other order.
    const parts = a.match(/^\s*(-?[^+\-]+?)\s*([+-])\s*([^+\-]+?)\s*$/);
    if (parts) forms.add(`${parts[2] === '-' ? '-' : ''}${parts[3]} + ${parts[1]}`.replace('+ -', '- '));
  }
  return [...forms];
}

function auditChecking(item, locale, ctx) {
  const out = [];
  const add = (code, detail) => out.push({ code, detail, ...ctx, locale, mode: 'keypad', answer: item.answer });
  let truth;
  try { truth = oracle(item); } catch { return out; }
  for (const form of acceptableForms(item, truth)) {
    show(item);
    if (panel.mode !== 'keypad' || !panel._modality?.set) return out;
    panel._modality.set(form);
    panel._modality.submit();
    if (!panel._settled) add('correct-entry-rejected', `entry "${form}" is correct but the rig marked it wrong`);
  }
  return out;
}

// ---------------------------------------------------------------------------
// The sweep
// ---------------------------------------------------------------------------
function combos({ locales, skills, difficulties }) {
  const out = [];
  for (const locale of locales) {
    for (const skill of skills) {
      for (const form of FORMS_BY_SKILL[skill]) {
        for (const d of difficulties) out.push({ locale, skill, form: form.id, difficulty: d });
      }
    }
  }
  return out;
}

window.__lab = {
  SKILLS,
  /**
   * Prove the audit can fail.
   *
   * A gate nobody has ever seen go red is a gate nobody should trust. This is
   * the client's own report, built on purpose: an item whose prompt is worth
   * 144 and whose answer says 104, so the choice set the learner is shown does
   * not contain the answer to the question above it. The audit must say so.
   */
  selfTest() {
    setLocale('en');
    const rigged = {
      skill: 'eval-expr', form: 'self-test', rep: 'symbolic', difficulty: 1, seed: 7,
      type: 'numeric', stem: '', latex: '12 \\cdot 12', answer: '104',
      check: { kind: 'evaluate', math: '12 \\cdot 12', env: {} },
      steps: [{ latex: '12 \\cdot 12 = 104', why: 'rigged' }],
      accept: [],
      distractors: [{ value: '40', misconception: 'a' }, { value: '54', misconception: 'b' }],
      diagnostics: [],
    };
    show(rigged);
    const r = auditItem(rigged, 'en', { skill: 'eval-expr', form: 'self-test', difficulty: 1, seed: 7 });
    panel.close();
    return { codes: r.findings.map((f) => f.code), detail: r.findings.map((f) => f.detail) };
  },
  /**
   * Put one item on the surface and leave it there, narrowed if asked, so a
   * harness can photograph the readings a learner is actually looking at.
   * Screenshots are the only evidence that counts for how a thing reads.
   */
  showOne({ locale = 'en', skill, form, difficulty = 3, seed = 1000, narrow = false }) {
    setLocale(locale);
    const item = safeGenerate(skill, difficulty, seed, { locale, form });
    show(item);
    let opened = null;
    if (narrow && panel.mode === 'keypad') opened = forceNarrow(item) ? 'narrow' : null;
    const scope = opened === 'narrow' ? '.rf-narrow .rf-reading' : '.rf-readings .rf-reading';
    return {
      form: item.form, mode: panel.mode, surface: opened || (panel.mode === 'choice' ? 'choice' : null),
      answer: item.answer,
      options: readOptions(scope).map((o) => ({ value: o.value, visible: o.visible })),
    };
  },
  formsBySkill: Object.fromEntries(Object.entries(FORMS_BY_SKILL).map(([k, v]) => [k, v.map((f) => f.id)])),
  plan(opts = {}) {
    return combos({
      locales: opts.locales || LOCALES,
      skills: opts.skills || SKILLS,
      difficulties: opts.difficulties || [1, 2, 3, 4, 5],
    });
  },
  /**
   * @param {{locales?:string[],skills?:string[],difficulties?:number[],
   *          seeds?:number,seed0?:number,slice?:[number,number],
   *          checking?:boolean}} opts
   */
  run(opts = {}) {
    const plan = this.plan(opts);
    const [from, to] = opts.slice || [0, plan.length];
    const seeds = opts.seeds ?? 4;
    const seed0 = opts.seed0 ?? 1000;
    const findings = [];
    const modes = {};
    let items = 0, skipped = 0;

    for (const c of plan.slice(from, to)) {
      setLocale(c.locale);
      for (let s = 0; s < seeds; s++) {
        const seed = seed0 + s * 7919;
        let item = null;
        try {
          item = safeGenerate(c.skill, c.difficulty, seed, { locale: c.locale, form: c.form });
        } catch { item = null; }
        if (!item || item.form !== c.form) { skipped++; continue; }
        items++;
        const ctx = { skill: c.skill, form: c.form, difficulty: c.difficulty, seed };
        try {
          show(item);
          const r = auditItem(item, c.locale, ctx);
          modes[r.surface || r.mode] = (modes[r.surface || r.mode] || 0) + 1;
          findings.push(...r.findings);
          if (opts.checking) findings.push(...auditChecking(item, c.locale, ctx));
        } catch (e) {
          findings.push({ code: 'threw', detail: String(e && e.message || e), ...ctx, locale: c.locale });
        }
        panel.close();
      }
    }
    return { total: plan.length, from, to, items, skipped, modes, findings };
  },
};
document.title = 'choicelab ready';
