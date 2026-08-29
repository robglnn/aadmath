/**
 * THE ANSWER-SURFACE LAB.
 *
 * `tools/critic/choiceaudit.mjs` proves that the option a learner is shown is
 * the right one. It says nothing about the two questions that turned out to
 * matter more, because a rift can be sealed without ever touching an option:
 *
 *   a. CAN THE KEY BE ENTERED AT ALL, on the surface this item routes to? For
 *      every factoring, complete-the-square, vertex-form and surd-root item in
 *      the bank the honest answer used to be no — the pad could emit no
 *      bracket, no radical, no equals sign and no comma, so the only path to a
 *      seal was to be wrong twice and take the narrowed scaffold.
 *   b. IS THE QUESTION, TYPED BACK, REFUSED? The grader compared values and
 *      nothing else, so `x^{2} + 5x + 6` satisfied "write this as a product of
 *      brackets". Over 16,720 sampled Level 4 items, 1,763 sealed that way,
 *      with full unassisted mastery credit and no misconception recorded.
 *   c. DOES ANY OPTION SET HOLD THE KEY TWICE? Textually distinct, mathematically
 *      identical: `n = 2 \pm \sqrt{20}` beside the key `n = 2 \pm 2\sqrt{5}`, one
 *      of them marked wrong with a misconception tag on it.
 *
 * HOW IT ANSWERS THEM. This page mounts the REAL `RiftPanel` — the shipping
 * class, its own stylesheet, strict KaTeX, the real generators, every course
 * pack the manifest ships — and then works it the way a hand does: it finds the
 * keys on the glass, presses them one at a time with real click events, presses
 * SEAL, and reads whether the rift shut off the DOM (`.rift.sealing`).
 *
 * It never calls `_accepts`, never calls `_solve`, and never sets the socket
 * through the modality's closure. If the pad has no key for a glyph, this page
 * cannot press one, which is exactly the property under test.
 *
 * The one thing it does read out of the object is `panel.mode` — which surface
 * the item landed on — because that is a fact about the item, not a way of
 * driving it.
 *
 * `tools/critic/answerable.mjs` drives this page.
 */
import 'katex/dist/katex.min.css';
import { RiftPanel } from '../../../src/ui/rift.js';
import { safeGenerate, SKILLS, FORMS_BY_SKILL } from '../../../src/learn/generators.js';
import { registerPack } from '../../../src/content/registry.js';
// EVERY UNIT THE MANIFEST NAMES, and not a list kept up to date by hand. A
// gate that covers Level 1 and says nothing at all about Levels 2 to 5 would
// have passed every defect this file exists to catch, and would have said
// "PASS" in exactly the same words. The manifest is the only list.
import manifest from '../../../content/courses.json';
const PACKS = import.meta.glob('../../../src/content/packs/*.js', { eager: true, import: 'default' });
for (const course of manifest.courses) {
  for (const unit of course.units || []) {
    if (!unit.pack) continue;               // null means the core bank, already in
    const pack = PACKS[`../../../src/content/packs/${unit.pack}.js`];
    if (!pack) throw new Error(`the manifest names a generator pack that is not there: ${unit.pack}`);
    registerPack(pack);
  }
}
import { setLocale, LOCALES, t } from '../../../src/i18n/index.js';
import EN_BUNDLE from '../../../src/i18n/en.js';
import {
  parse, expandPm, evalSurd, splitTop, equivalent,
  radicandsOf, radicalInDenominator, polynomialise,
} from '../../../src/learn/parser.js';
import { sCmp, isSquarefree } from '../../../src/learn/surd.js';

const root = document.getElementById('app');
const panel = new RiftPanel(root);

// ---------------------------------------------------------------------------
// The gate's OWN reading of the notation. Deliberately a second implementation:
// if it and the surface disagree about what a key says, that disagreement is
// the finding.
// ---------------------------------------------------------------------------
/**
 * A written answer, as the glyphs a hand would have to press. Plain algebra:
 * brackets, a radical sign, a caret, a bar, an equals sign, a comma, the two
 * order marks and plus-or-minus.
 */
function spell(src) {
  let s = String(src ?? '');
  if (!s || /\\text|\\begin|\\square/.test(s)) return null;
  s = s.replace(/\\left|\\right|\\!|\\,|\;|\\ /g, '')
    .replace(/\\cdot|\\times/g, '*')
    .replace(/\\div/g, '/')
    .replace(/\\pm/g, '\u00b1')
    .replace(/\\le(?![a-zA-Z])/g, '\u2264')
    .replace(/\\ge(?![a-zA-Z])/g, '\u2265')
    .replace(/\\lt(?![a-zA-Z])/g, '<')
    .replace(/\\gt(?![a-zA-Z])/g, '>')
    .replace(/\\ne(?![a-zA-Z])/g, '\u2260');
  for (let i = 0; i < 16; i++) {
    const before = s;
    s = s.replace(/\^\s*\{([^{}]*)\}/g, '^$1');
    s = s.replace(/\\frac\s*\{([^{}]*)\}\s*\{([^{}]*)\}/g, (m, a, b) => `${atom(a)}/${atom(b)}`);
    s = s.replace(/\\sqrt\s*\{([^{}]*)\}/g, (m, a) => `\u221a${atom(a)}`);
    if (s === before) break;
  }
  s = s.replace(/\s+/g, '');
  // Anything still carrying a control sequence or a brace is notation this
  // spelling cannot produce, and saying so is the point.
  if (/[\\{}]/.test(s)) return null;
  return s;
}
const atom = (b) => (/^(?:\d+|[a-zA-Z](?:\^\d+)?)$/.test(String(b).trim()) ? String(b).trim() : `(${String(b).trim()})`);

/** Every exact value a written answer stands for, or null when unreadable. */
function valuesOf(text) {
  try {
    const out = [];
    for (const part of splitTop(String(text), ',')) {
      const body = part.trim();
      if (!body) return null;
      const at = body.indexOf('=');
      const lhs = at >= 0 ? body.slice(0, at).replace(/\s+/g, '') : '';
      const rhs = at >= 0 ? body.slice(at + 1) : body;
      const vals = expandPm(parse(rhs)).map((n) => evalSurd(n, {})).sort(sCmp);
      out.push(`${lhs}|${vals.map((x) => `${x.p.n}/${x.p.d}+${x.q.n}/${x.q.d}r${x.k}`).join(';')}`);
    }
    return out.sort();
  } catch { return null; }
}

/** The gate's own "are these the same answer". Never throws; null = unreadable. */
function sameValue(a, b) {
  const A = String(a).replace(/\\left|\\right/g, '').replace(/\s+/g, '');
  const B = String(b).replace(/\\left|\\right/g, '').replace(/\s+/g, '');
  if (A === B) return true;
  const va = valuesOf(a), vb = valuesOf(b);
  if (va && vb) return va.length === vb.length && va.every((x, i) => x === vb[i]);
  const letters = new Set([...String(a).replace(/\\[a-zA-Z]+/g, ' ').matchAll(/[a-zA-Z]/g)].map((m) => m[0]));
  for (const m of String(b).replace(/\\[a-zA-Z]+/g, ' ').matchAll(/[a-zA-Z]/g)) letters.add(m[0]);
  if (letters.size !== 1) return null;
  const v = [...letters][0];
  if (String(a).includes('=') || String(b).includes('=')) return null;
  try { return equivalent(String(a), String(b), v) === true; } catch { return null; }
}

// ---------------------------------------------------------------------------
// The gate's own reading of WHAT FORM an item demands. Second implementation
// again: it is drawn from the item, never from the panel.
// ---------------------------------------------------------------------------
function ast(src) { try { return parse(String(src)); } catch { return null; } }
const isSum = (n) => !!n && (n.k === 'add' || n.k === 'sub');
const strip = (n) => { let x = n; while (x && x.k === 'neg') x = x.a; return x; };
function constish(n) {
  if (!n) return true;
  if (n.k === 'var') return false;
  if (n.k === 'num') return true;
  return constish(n.a) && (n.b === undefined || constish(n.b));
}
function openProduct(node) {
  let hit = false;
  const rec = (n) => {
    if (!n || hit) return;
    if (n.k === 'mul' && (isSum(strip(n.a)) || isSum(strip(n.b)) || (!constish(n.a) && !constish(n.b)))) { hit = true; return; }
    if (n.k === 'div' && !constish(n.b)) { hit = true; return; }
    if (n.k === 'pow' && !(n.a?.k === 'num' || n.a?.k === 'var')) { hit = true; return; }
    for (const k of ['a', 'b']) if (n[k] && typeof n[k] === 'object') rec(n[k]);
  };
  rec(node);
  return hit;
}
function rootsSimple(node) {
  try {
    if (radicalInDenominator(node)) return false;
    for (const r of radicandsOf(node)) { if (r == null) continue; if (r < 0 || !isSquarefree(r)) return false; }
    return true;
  } catch { return false; }
}
/**
 * Does this item demand a FORM of its answer, and is that demand one the
 * question itself fails? Only then is "type the question back" a thing that
 * must be refused — and only then does this gate insist on it.
 */
function formDemand(item) {
  const key = String(item.answer ?? '');
  const prompt = String(item.check?.math || item.latex || '');
  const kNode = ast(key), pNode = ast(prompt);
  if (!kNode || !pNode) return null;
  const declared = item.check?.form;
  if (declared === 'factored' || item.check?.kind === 'factored') {
    return openProduct(kNode) && !openProduct(pNode) ? 'a product' : null;
  }
  if (declared === 'vertex' || item.check?.kind === 'vertexForm') {
    return openProduct(kNode) && !openProduct(pNode) ? 'a completed square' : null;
  }
  const kOpen = openProduct(kNode), pOpen = openProduct(pNode);
  if (kOpen !== pOpen) return kOpen ? 'a product' : 'multiplied out';
  if (/\\sqrt/.test(key) && rootsSimple(kNode) && !rootsSimple(pNode)) return 'a simplified root';
  return null;
}

/** Every factor at the top of an expression, flattened. */
function factorsFlat(node) {
  const out = [];
  const rec = (n) => {
    if (!n) return;
    if (n.k === 'mul') { rec(n.a); rec(n.b); return; }
    if (n.k === 'neg') { rec(n.a); return; }
    if (n.k === 'div' && constish(n.b)) { rec(n.a); return; }
    out.push(n);
  };
  rec(node);
  return out;
}

/** A bracket, somewhere: a sum sitting inside a product, a quotient or a power. */
function hasBracket(node) {
  let hit = false;
  const rec = (n) => {
    if (!n || hit) return;
    if ((n.k === 'mul' || n.k === 'div') && (isSum(strip(n.a)) || isSum(strip(n.b)))) { hit = true; return; }
    if (n.k === 'pow' && isSum(strip(n.a))) { hit = true; return; }
    for (const k of ['a', 'b']) if (n[k] && typeof n[k] === 'object') rec(n[k]);
  };
  rec(node);
  return hit;
}

/**
 * Is there NO whole square anywhere under a root on this card?
 *
 * `true` for a card with no root in it at all, and for one whose every
 * readable radicand is already square-free. Deliberately `false` — quiet —
 * when the only radicands are ones this reader cannot reduce to a whole
 * number, because "I cannot read it" is not evidence that a line is wrong.
 */
function noWholeSquareUnderRoot(node, promptSrc) {
  if (!/\\sqrt/.test(String(promptSrc))) return true;
  let readable = 0;
  let rs;
  try { rs = radicandsOf(node); } catch { return false; }
  for (const r of rs) {
    if (r == null) continue;
    readable++;
    if (r > 0 && !isSquarefree(r)) return false;
  }
  return readable > 0;
}

/** ONE bracket with a shared factor in front of it: `3(2n + 4)`, `x^{2}(-4x + 7)`. */
function oneBracketOnly(kNode) {
  if (!kNode) return false;
  const fs = factorsFlat(strip(kNode));
  if (fs.length < 2) return false;
  const brackets = fs.filter((f) => isSum(strip(f)));
  const squares = fs.filter((f) => f.k === 'pow' && isSum(strip(f.a)));
  return brackets.length === 1 && squares.length === 0;
}

/**
 * WHICH standing instruction is on the glass, by its key.
 *
 * The list is read out of the shipped bundle rather than written out here. A
 * hand-written list of surfaces is exactly how the choice-set lab came to
 * cover 24 skills of 62 and print PASS in the same words either way
 * (tools/check-coverage.mjs), and a hand-written list here would go quiet the
 * first time the rig learned a new task.
 */
const HELP_KEYS = Object.keys(EN_BUNDLE?.rift?.help || {});
function helpKeyOnGlass() {
  const said = (panel.el.querySelector('#rf-help')?.textContent || '').replace(/\s+/g, ' ').trim();
  if (!said) return null;
  for (const k of HELP_KEYS) {
    if (String(t('rift.help.' + k)).replace(/\s+/g, ' ').trim() === said) return k;
  }
  return null;
}

/**
 * IS THE STANDING INSTRUCTION UNDER THIS CARD ABOUT THIS CARD?
 *
 * The line in the footer, and the first whisper of the echo above it, are the
 * same string chosen the same way. Both used to be picked by `type` alone, so
 * 179 of 341 item forms — 73 of the 87 in Level 4 — carried the level-1
 * like-terms line: "You do not solve anything here. Write the same amount in
 * fewer terms, and the shorter line must still hold for every value of the
 * letter." It stood under a card asking for the square root of 244, which has
 * no letter in it and no terms to shorten, in three languages.
 *
 * That was the first half. The second half is that a line can be wrong without
 * being the like-terms line: choosing it off the FORM the grader demands, one
 * step better than choosing it off the type, still printed
 *
 *   · "Multiply it out. Leave no bracket" — and, under it, "every part of the
 *     first bracket meets every part of the second" — over `\frac{n^{8}}{n^{1}}`
 *     and nineteen other cards with no pair of brackets to multiply;
 *   · "Take every whole square out of the root" over `5\sqrt{3} + 4\sqrt{3}`,
 *     whose radicand is square-free, and over `\frac{15}{\sqrt{3}}`, where the
 *     job is to get the root off the bottom;
 *   · the two-numbers-that-multiply-and-add whisper over `6n + 12`, where one
 *     shared factor comes out and there is no such pair to find.
 *
 * So this asks, of whichever line is on the glass, whether the card can bear
 * it. Every rule is narrow and structural — it fires only where the item's own
 * two strings PROVE the line false, never on a taste in phrasing — and each
 * one carries its own code, so the self-test can be watched catching them one
 * at a time rather than in a heap.
 *
 * Read off the glass — `#rf-help` as it is mounted — not out of the object.
 *
 * @returns {null|{code:string, detail:string}}
 */
function taskMismatch(item, locale) {
  void locale;
  const line = helpKeyOnGlass();
  if (!line) return null;
  const key = String(item.answer ?? '');
  const prompt = String(item.check?.math || item.latex || '');
  const pNode = ast(prompt), kNode = ast(key);

  if (line === 'keypadExpression') {
    const bare = key.replace(/\\[a-zA-Z]+/g, ' ');
    const say = (detail) => ({ code: 'nudge-does-not-fit-the-task', detail });
    if (!/[a-zA-Z]/.test(bare)) return say('the key has no letter in it, so there is no shorter line "for every value of the letter"');
    if (/[=,]/.test(bare) || /\\pm/.test(key)) return say('the key is a statement, not a shorter way of writing the question');
    const demand = formDemand(item);
    if (demand) return say(`the card asks for ${demand}, not for fewer terms`);
    return null;
  }

  if (line === 'expand' && pNode && !hasBracket(pNode)) {
    return {
      code: 'instruction-names-a-bracket-that-is-not-there',
      detail: `the footer says to leave no bracket, and "${prompt}" has none to leave`,
    };
  }
  if (line === 'simplify' && pNode && noWholeSquareUnderRoot(pNode, prompt)) {
    return {
      code: 'instruction-names-a-square-that-is-not-there',
      detail: `the footer says to take every whole square out of the root, and no root in "${prompt}" holds one`,
    };
  }
  if (line === 'factor' && oneBracketOnly(kNode)) {
    return {
      code: 'instruction-names-a-pair-that-is-not-there',
      detail: `the whisper under this line names two numbers that multiply to the last term and add to the middle one,`
        + ` and the key "${key}" is one shared factor outside one bracket`,
    };
  }
  return null;
}

// ---------------------------------------------------------------------------
// Working the surface the way a hand does
// ---------------------------------------------------------------------------
const press = (el) => {
  el.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
};
const sealed = () => panel.el.classList.contains('sealing');

function show(item) {
  panel.show(item, {
    title: '', skillId: item.skill, tier: 0, kind: 'learn',
    scaffold: 'none', example: null, streak: 0,
    onAnswer() { return { gained: 1, pL: 1, prev: 0.5 }; },
    onClose() {},
  });
}

/** The glyphs this pad can actually emit, straight off the caps. */
function padGlyphs() {
  return new Set([...panel.el.querySelectorAll('.rf-keys .rf-key[data-g]')]
    .map((b) => b.dataset.g)
    .filter((g) => g && !['back', 'clear', 'seal', 'sign'].includes(g)));
}
const keyFor = (g) => panel.el.querySelector(`.rf-keys .rf-key[data-g="${cssEscape(g)}"]`);
const cssEscape = (s) => String(s).replace(/["\\]/g, '\\$&');

/**
 * Type a spelling on the pad, glyph by glyph, pressing the real caps.
 *
 * A LEADING MINUS IS NOT ALWAYS A MINUS KEY. The pad that charges a value
 * carries a sign cap that flips what is already in the socket, rather than a
 * minus glyph that could be left dangling at the end of an entry. So a hand
 * writing `-18` presses 1, 8, and then the sign — and this types it the same
 * way. Anywhere else a minus is a real key and is pressed as one.
 *
 * @returns {{ok:true}|{ok:false, missing:string}}
 */
function typeOnPad(spelling) {
  const clear = panel.el.querySelector('.rf-key.wipe');
  if (clear) press(clear);
  let body = spelling;
  let flip = false;
  if (body.startsWith('-') && !keyFor('-') && panel.el.querySelector('.rf-key[data-g="sign"]')) {
    body = body.slice(1);
    flip = true;
  }
  for (const ch of body) {
    if (/\s/.test(ch)) continue;
    const k = keyFor(ch);
    if (!k) return { ok: false, missing: ch };
    press(k);
  }
  if (flip) press(panel.el.querySelector('.rf-key[data-g="sign"]'));
  return { ok: true };
}
function pressSeal() {
  const commit = panel.el.querySelector('.rf-key.commit');
  if (!commit) return false;
  if (commit.disabled) return false;
  press(commit);
  return true;
}

/** What the socket currently reads, so a refused entry can be shown as typed. */
const socketText = () => panel.el.querySelector('.rf-socket .val')?.textContent?.trim() || '';

/** Two real wrong entries, typed on the keys, to bring the narrowed field up. */
function forceNarrow() {
  for (const wrong of ['987654', '765432', '654321']) {
    if (sealed()) return false;
    if (panel.el.querySelector('.rf-narrow')) return true;
    const r = typeOnPad(wrong);
    if (!r.ok) return false;
    if (!pressSeal()) return false;
    if (panel.el.querySelector('.rf-narrow')) return true;
  }
  return !!panel.el.querySelector('.rf-narrow');
}

/**
 * WHAT THE SOCKET HOLDS ONCE THE RIG HAS SAID NO.
 *
 * The socket used to keep a refused entry, so the next glyph a cadet pressed
 * landed on the END of it: their corrected answer went in as the wrong one
 * with the right one stuck to it, and was counted as a SECOND miss off one
 * real mistake. That burns the proving run and drops the scaffold a rung the
 * cadet never earned. There was also no clear key at all — fourteen glyphs of
 * a mistyped bracket was fourteen presses of Delete, and a learner who cannot
 * see a way to empty a field starts submitting rubbish to get rid of it.
 *
 * Both halves are read off the glass after a real refusal on a real card. It
 * costs one attempt, which is why the caller does it on the card it is about
 * to spend on the narrowed field anyway.
 *
 * `null` means the question could not be put — nothing typeable, a dead SEAL,
 * or an entry the rig accepted — and a caller that reported `null` as a pass
 * would be inventing evidence.
 */
function socketAfterARefusal() {
  const wipe = panel.el.querySelector('.rf-key.wipe');
  if (!typeOnPad('987654').ok) return null;
  if (!pressSeal()) return null;
  if (sealed()) return null;
  const val = panel.el.querySelector('.rf-socket .val');
  if (!val) return null;
  return { empty: val.classList.contains('empty'), left: socketText(), wipe: !!wipe };
}

const optionValues = (scope) => [...panel.el.querySelectorAll(scope)].map((b) => b.dataset.value).filter((v) => v != null);

// ---------------------------------------------------------------------------
// One item, end to end
// ---------------------------------------------------------------------------
function audit(item, ctx, tally) {
  const found = [];
  const did = (k) => { if (tally) tally[k] = (tally[k] || 0) + 1; };
  const add = (code, detail) => found.push({ code, detail, ...ctx, mode: panel.mode, answer: String(item.answer) });
  const surface = panel.mode;
  const key = String(item.answer ?? '');

  // ---- (c) the key, twice, in one set of options -------------------------
  let options = [];
  if (surface === 'choice') options = optionValues('.rf-readings .rf-reading');
  else if (surface === 'keypad') {
    // ---- (e) what the socket holds once the rig has said no ---------------
    // First, because it needs a card nobody has typed on yet, and it spends
    // the first of the two attempts the narrowed field below costs anyway.
    const after = socketAfterARefusal();
    if (after) {
      did('refusalsRead');
      if (!after.empty) {
        add('entry-kept-after-a-refusal',
          `the rig refused "987654" and the socket still reads "${after.left}";`
          + ' the next glyph a cadet presses lands on the end of it and goes in as a second miss');
      }
      if (!after.wipe) {
        add('no-way-to-clear-the-socket',
          'nothing on the glass empties the socket on purpose, so a mistyped line can only be walked back one glyph at a time');
      }
    }
    // Then the options, because forcing the narrowed field spends the second
    // attempt, and the checks below want a clean surface.
    if (forceNarrow()) options = optionValues('.rf-narrow .rf-reading');
    show(item);
  }
  if (options.length) did('optionSets');
  for (let i = 0; i < options.length; i++) {
    for (let j = i + 1; j < options.length; j++) {
      if (sameValue(options[i], options[j]) === true) {
        add('duplicate-key-in-options',
          `"${options[i]}" and "${options[j]}" are the same answer; one of them is marked wrong`);
      }
    }
  }

  if (surface !== 'keypad') {
    if (surface === 'choice') {
      // The key has to BE there, and pressing it has to shut the rift.
      const btns = [...panel.el.querySelectorAll('.rf-readings .rf-reading')];
      const right = btns.find((b) => sameValue(b.dataset.value, key) === true);
      if (!right) add('key-not-on-surface', `no option carries the key "${key}"`);
      else { press(right); if (!sealed()) add('key-rejected', `pressing the key "${key}" did not seal the rift`); }
    }
    return { found, surface };
  }

  // ---- (d) is the standing instruction about THIS card? ------------------
  // Read before anything is pressed, because a miss rewrites the footer.
  did('instructionsRead');
  const wrongLine = taskMismatch(item, ctx.locale);
  if (wrongLine) add(wrongLine.code, wrongLine.detail);

  // ---- (a) can the key be typed, and does typing it seal the rift? -------
  const spelling = spell(key);
  if (spelling == null) {
    add('key-not-spellable', `"${key}" is notation no keypad spelling covers`);
    return { found, surface };
  }
  const glyphs = padGlyphs();
  // The sign cap makes a leading minus reachable without a minus glyph.
  if (spelling.startsWith('-') && panel.el.querySelector('.rf-key[data-g="sign"]')) glyphs.add('-');
  const missing = [...new Set([...spelling])].filter((ch) => !/\s/.test(ch) && !glyphs.has(ch));
  if (missing.length) {
    add('key-not-typeable',
      `"${key}" needs ${missing.map((m) => `"${m}"`).join(', ')}; the pad offers [${[...glyphs].join(' ')}]`);
    return { found, surface };
  }
  const typed = typeOnPad(spelling);
  if (!typed.ok) { add('key-not-typeable', `no key writes "${typed.missing}"`); return { found, surface }; }
  did('keysTyped');
  if (!pressSeal()) {
    add('key-not-committable', `the pad holds "${spelling}" but SEAL is dead; the socket reads "${socketText()}"`);
    return { found, surface };
  }
  if (!sealed()) {
    add('key-rejected', `the key "${key}" was typed on the keys and the rig marked it wrong`);
    return { found, surface };
  }

  // ---- (b) the question, typed back, on a fresh card ---------------------
  const demand = formDemand(item);
  if (demand) {
    did('formDemanded');
    const prompt = String(item.check?.math || item.latex || '');
    const back = spell(prompt);
    if (back != null && [...new Set([...back])].every((ch) => /\s/.test(ch) || glyphs.has(ch)) && back !== spelling) {
      show(item);
      const t2 = typeOnPad(back);
      if (t2.ok && pressSeal()) {
        // Counted only once the question is really in the socket and SEAL has
        // really been pressed. A refusal that came from a dead commit key is
        // not the grader refusing the question, and must not be reported as if
        // it were.
        did('questionTypedBack');
        if (sealed()) {
          add('question-back-accepted',
            `the card asks for ${demand}; typing the question "${prompt}" straight back sealed the rift`);
        }
      }
    } else {
      did('questionNotTypeable');
    }
  }
  return { found, surface };
}

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

/** The three defects, planted on purpose, so the gate is seen to go red. */
function selfTest() {
  setLocale('en');
  const codes = [];
  const detail = [];
  const run = (item) => {
    show(item);
    const r = audit(item, { skill: 'self-test', form: 'planted', difficulty: 1, seed: 1 }, null);
    panel.close();
    for (const f of r.found) { codes.push(f.code); detail.push(`${f.code}: ${f.detail}`); }
  };

  // 1. A KEY NO KEYPAD CAN WRITE. The bank could ship this tomorrow.
  run({
    skill: 'self-test', form: 'planted', rep: 'symbolic', difficulty: 1, seed: 1,
    type: 'expression', stem: '', latex: 'x + 1',
    answer: 'x \\ne 3',
    check: { kind: 'equivalent', math: 'x + 1', variable: 'x' },
    steps: [], accept: [],
    distractors: [{ value: 'x + 2', misconception: 'a' }, { value: 'x + 4', misconception: 'b' }],
    diagnostics: [],
  });

  // 2. THE GRADER THAT TESTS VALUE AND NEVER FORM — the defect itself, put
  //    back for one item, on a card that asks for a product of brackets.
  const realAccepts = RiftPanel.prototype._accepts;
  RiftPanel.prototype._accepts = function (value) {
    const v = String(value).trim();
    if (!v) return false;
    try { return equivalent(v, String(this.item.answer), this.item.check?.variable || 'x') === true; } catch { return false; }
  };
  run({
    skill: 'self-test', form: 'planted', rep: 'symbolic', difficulty: 1, seed: 2,
    type: 'expression', stem: '', latex: 'x^{2} + 5x + 6',
    answer: '\\left(x + 2\\right)\\left(x + 3\\right)',
    check: { kind: 'factored', math: 'x^{2} + 5x + 6', variable: 'x' },
    steps: [], accept: [],
    distractors: [{ value: '\\left(x + 1\\right)\\left(x + 6\\right)', misconception: 'a' },
      { value: '\\left(x + 5\\right)\\left(x + 1\\right)', misconception: 'b' }],
    diagnostics: [],
  });
  RiftPanel.prototype._accepts = realAccepts;

  // 3. THE SAFETY NET WITH ITS OLD HOLE IN IT: an option set that lists the
  //    key twice, once simplified and once not.
  const realSame = RiftPanel.prototype._sameValue;
  RiftPanel.prototype._sameValue = () => false;
  run({
    skill: 'self-test', form: 'planted', rep: 'symbolic', difficulty: 1, seed: 3,
    type: 'expression', stem: '', latex: '\\sqrt{20}',
    answer: '2\\sqrt{5}',
    check: { kind: 'radical', math: '\\sqrt{20}', variable: 'x' },
    steps: [], accept: [],
    distractors: [{ value: '\\sqrt{20}', misconception: 'a' }, { value: '4\\sqrt{5}', misconception: 'b' }],
    diagnostics: [],
  });
  RiftPanel.prototype._sameValue = realSame;

  // 4. THE LEVEL-1 LIKE-TERMS LINE UNDER A CARD IT CANNOT BE ABOUT — the
  //    instruction chosen by the item's TYPE instead of by its task, which is
  //    what put "write the same amount in fewer terms" under the square root
  //    of 244 in three languages.
  const realHelpKey = RiftPanel.prototype._helpKey;
  RiftPanel.prototype._helpKey = function () { return this.mode === 'keypad' ? 'keypadExpression' : this.mode; };
  run({
    skill: 'self-test', form: 'planted', rep: 'symbolic', difficulty: 1, seed: 4,
    type: 'expression', stem: '', latex: '\\sqrt{244}',
    answer: '2\\sqrt{61}',
    check: { kind: 'radical', math: '\\sqrt{244}' },
    steps: [], accept: [],
    distractors: [{ value: '4\\sqrt{61}', misconception: 'a' }, { value: '2\\sqrt{31}', misconception: 'b' }],
    diagnostics: [],
  });
  RiftPanel.prototype._helpKey = realHelpKey;

  // 5. THE EXPAND LINE OVER A CARD WITH NO BRACKET. The rig used to choose the
  //    footer off the FORM the grader demands, and "an entry with nothing left
  //    to multiply out" is the demand on `n^{8} \cdot n^{2}` exactly as it is
  //    on `\left(t - 1\right)\left(t + 6\right)`. Twenty forms therefore stood
  //    under "leave no bracket", with "every part of the first bracket meets
  //    every part of the second" whispered under that.
  RiftPanel.prototype._helpKey = function () { return this.mode === 'keypad' ? 'expand' : this.mode; };
  run({
    skill: 'self-test', form: 'planted', rep: 'symbolic', difficulty: 1, seed: 5,
    type: 'expression', stem: '', latex: 'n^{8} \\cdot n^{2}',
    answer: 'n^{10}',
    check: { kind: 'equivalent', math: 'n^{8} \\cdot n^{2}', variable: 'n' },
    steps: [], accept: [],
    distractors: [{ value: 'n^{16}', misconception: 'a' }, { value: 'n^{6}', misconception: 'b' }],
    diagnostics: [],
  });
  RiftPanel.prototype._helpKey = realHelpKey;

  // 6. THE ROOT LINE OVER A ROOT WITH NOTHING IN IT TO TAKE OUT. Five forms
  //    asking for roots to be collected, or for one to be cleared off the
  //    bottom of a fraction, were told to take out a whole square that is not
  //    under the sign.
  RiftPanel.prototype._helpKey = function () { return this.mode === 'keypad' ? 'simplify' : this.mode; };
  run({
    skill: 'self-test', form: 'planted', rep: 'symbolic', difficulty: 1, seed: 6,
    type: 'expression', stem: '', latex: '5\\sqrt{3} + 4\\sqrt{3}',
    answer: '9\\sqrt{3}',
    check: { kind: 'equivalent', math: '5\\sqrt{3} + 4\\sqrt{3}', variable: 'x' },
    steps: [], accept: [],
    distractors: [{ value: '9\\sqrt{6}', misconception: 'a' }, { value: '20\\sqrt{3}', misconception: 'b' }],
    diagnostics: [],
  });
  RiftPanel.prototype._helpKey = realHelpKey;

  // 7. THE TRINOMIAL PAIR, WHISPERED OVER A COMMON FACTOR. "Both must multiply
  //    to the last number and add to the middle one" is a true and useful line
  //    under `n^{2} + 5n + 6`. Under `6n + 12` it sends a cadet looking for a
  //    pair of numbers that does not exist.
  RiftPanel.prototype._helpKey = function () { return this.mode === 'keypad' ? 'factor' : this.mode; };
  run({
    skill: 'self-test', form: 'planted', rep: 'symbolic', difficulty: 1, seed: 7,
    type: 'expression', stem: '', latex: '6n + 12',
    answer: '3\\left(2n + 4\\right)',
    check: { kind: 'factored', math: '6n + 12', variable: 'n' },
    steps: [], accept: [],
    distractors: [{ value: '3\\left(2n + 12\\right)', misconception: 'a' },
      { value: '6\\left(n + 12\\right)', misconception: 'b' }],
    diagnostics: [],
  });
  RiftPanel.prototype._helpKey = realHelpKey;

  // 8. THE SOCKET THAT KEEPS A REFUSED ENTRY. The exact shipped behaviour, put
  //    back for one card: the refused line stayed in the socket, so the next
  //    glyph landed on the end of it.
  const realMiss = RiftPanel.prototype._miss;
  RiftPanel.prototype._miss = function (mis, msg, entry) {
    const r = realMiss.call(this, mis, msg, entry);
    if (this.mode === 'keypad' && entry) this._modality?.set?.(entry);
    return r;
  };
  run({
    skill: 'self-test', form: 'planted', rep: 'symbolic', difficulty: 1, seed: 8,
    // `kind: 'solve'` would land on the BALANCE beam, which has no socket at
    // all; a plant that misses the surface under test proves nothing about it.
    type: 'numeric', stem: '', latex: '3x + 4',
    answer: '25',
    check: { kind: 'evaluate', math: '3x + 4', env: { x: 7 }, variable: 'x' },
    steps: [], accept: [],
    distractors: [{ value: '35', misconception: 'a' }, { value: '19', misconception: 'b' }],
    diagnostics: [],
  });
  RiftPanel.prototype._miss = realMiss;

  // 9. NO WAY TO CLEAR THE SOCKET ON PURPOSE — the pad as it shipped, with the
  //    clear cap taken back off it.
  const realKeypad = RiftPanel.prototype._keypad;
  RiftPanel.prototype._keypad = function (work) {
    const m = realKeypad.call(this, work);
    for (const b of this.el.querySelectorAll('.rf-key.wipe')) b.remove();
    return m;
  };
  run({
    skill: 'self-test', form: 'planted', rep: 'symbolic', difficulty: 1, seed: 9,
    type: 'numeric', stem: '', latex: '5x + 2',
    answer: '37',
    check: { kind: 'evaluate', math: '5x + 2', env: { x: 7 }, variable: 'x' },
    steps: [], accept: [],
    distractors: [{ value: '47', misconception: 'a' }, { value: '35', misconception: 'b' }],
    diagnostics: [],
  });
  RiftPanel.prototype._keypad = realKeypad;

  return { codes, detail };
}

window.__able = {
  SKILLS,
  selfTest,
  /**
   * THE STANDING LINE UNDER EVERY FORM, one row each. `answerable.mjs --footers`
   * prints it; no rule reads it.
   *
   * It is here because nothing in this repo could show what the instruction on
   * a card said, and thirty-three forms sat under a wrong one for as long as
   * nobody could look. A rule can only be written for a mismatch somebody has
   * seen, so the looking is part of the tool rather than a script somebody
   * writes again next time.
   */
  dump(opts = {}) {
    const rows = [];
    for (const c of this.plan(opts)) {
      setLocale(c.locale);
      let item = null;
      try { item = safeGenerate(c.skill, c.difficulty, opts.seed0 ?? 3000, { locale: c.locale, form: c.form, record: false }); }
      catch { item = null; }
      if (!item || item.form !== c.form) continue;
      show(item);
      rows.push({
        skill: c.skill, form: c.form, d: c.difficulty, mode: panel.mode,
        latex: String(item.check?.math || item.latex || ''), answer: String(item.answer ?? ''),
        help: (panel.el.querySelector('#rf-help')?.textContent || '').replace(/\s+/g, ' ').trim(),
      });
      panel.close();
    }
    return rows;
  },
  plan(opts = {}) {
    return combos({
      locales: opts.locales || LOCALES,
      skills: opts.skills || SKILLS,
      difficulties: opts.difficulties || [1, 2, 3, 4, 5],
    });
  },
  run(opts = {}) {
    const plan = this.plan(opts);
    const [from, to] = opts.slice || [0, plan.length];
    const seeds = opts.seeds ?? 3;
    const seed0 = opts.seed0 ?? 1000;
    const findings = [];
    const surfaces = {};
    // WHAT WAS ACTUALLY ASKED. A gate that quietly skipped its own main check
    // would report a clean sweep and mean nothing by it, so every run says how
    // many times each question was put.
    const tally = {};
    let items = 0, skipped = 0;
    for (const c of plan.slice(from, to)) {
      setLocale(c.locale);
      for (let s = 0; s < seeds; s++) {
        const seed = seed0 + s * 7919;
        let item = null;
        try { item = safeGenerate(c.skill, c.difficulty, seed, { locale: c.locale, form: c.form, record: false }); }
        catch { item = null; }
        if (!item || item.form !== c.form) { skipped++; continue; }
        items++;
        const ctx = { skill: c.skill, form: c.form, difficulty: c.difficulty, seed, locale: c.locale };
        try {
          show(item);
          const r = audit(item, ctx, tally);
          surfaces[r.surface] = (surfaces[r.surface] || 0) + 1;
          findings.push(...r.found);
        } catch (e) {
          findings.push({ code: 'threw', detail: String((e && e.message) || e), ...ctx });
        }
        panel.close();
      }
    }
    return { total: plan.length, items, skipped, surfaces, tally, findings };
  },
};
document.title = 'answerlab ready';
