/**
 * THE ANSWER SURFACES A LEARNER ACTUALLY MEETS, cut out of the shipped file
 * and executed.
 *
 * WHY THIS FILE EXISTS
 *
 * `tools/critic/choiceshape.mjs` used to sweep the bank and read
 * `[item.answer, ...item.distractors]` as though every card were a set of four
 * readings a learner is shown. It is not. `RiftPanel._mount` sends each card to
 * one of six surfaces, and only two of them ever put that option set in front
 * of anybody:
 *
 *     the four-option card   `_choice`   — all three distractors, shown at once
 *     the narrowed field     `_narrow`   — the key and the FIRST TWO, after two
 *                                          honest misses, under the keypad
 *     the balance move tray  `_balance`  — five moves, one of them the ideal
 *     the sorter             `_sort`     — chips, and one bay per like-class
 *     the area field         `_area`     — two cells, typed into
 *     the coordinate plane   `_plot`     — a line, dragged
 *
 * On the last three the item's distractor list is never drawn at all. Averaging
 * those cards in with the choice cards is how a 31.6% leak on the surface a
 * learner is shown came out as 26.3% and printed PASS.
 *
 * HOW IT KNOWS. It does not keep a copy of the dispatch. It reads
 * `src/ui/rift.js` off disk, cuts out the real text of the routing chain and
 * of the pure prefix of each modality builder — the part that decides whether
 * that surface can take this card at all, and, for the balance beam, the part
 * that builds the tray — and executes it. So a change to the shipped file is
 * what runs here on the next build, and `cut()` throws rather than guessing
 * when an anchor moves: a census that silently reverts to "everything" is the
 * exact defect this file exists to end.
 *
 * The same technique, and the same reason, as `tools/critic/handed.mjs`.
 */
import { readFile } from 'node:fs/promises';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { mathOp } from '../../src/i18n/index.js';
import { balancedPick } from '../../src/learn/shape.js';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const RIFT = path.join(ROOT, 'src/ui/rift.js');

/** Every anchor this file cuts on, so `--self-test` can name the one that moved. */
export const ANCHORS = [];

function cutter(src, file) {
  const lineOf = (i) => src.slice(0, i).split('\n').length;
  /** The text from `from` up to (not including) `to`. */
  const region = (from, to, after = 0) => {
    const a = src.indexOf(from, after);
    if (a < 0) throw new Error(`${file}: anchor gone — ${JSON.stringify(from.slice(0, 60))}`);
    const b = src.indexOf(to, a + from.length);
    if (b < 0) throw new Error(`${file}: end anchor gone — ${JSON.stringify(to.slice(0, 60))}`);
    ANCHORS.push({ file, from, line: lineOf(a) });
    return src.slice(a, b);
  };
  /** The BODY of a method: what is between its header and the first DOM line. */
  const body = (header, stop) => {
    const a = src.indexOf(header);
    if (a < 0) throw new Error(`${file}: method gone — ${JSON.stringify(header.slice(0, 60))}`);
    const s = a + header.length;
    const b = src.indexOf(stop, s);
    if (b < 0) throw new Error(`${file}: stop gone — ${JSON.stringify(stop.slice(0, 60))}`);
    ANCHORS.push({ file, from: header, line: lineOf(a) });
    return src.slice(s, b);
  };
  return { region, body, at: (s) => src.indexOf(s) };
}

/**
 * Build the real surfaces once.
 *
 * @returns {Promise<object>} `{ route, tray, chips, arranged, anchors }`
 */
export async function realSurfaces() {
  const src = await readFile(RIFT, 'utf8');
  const { region, body, at } = cutter(src, 'src/ui/rift.js');

  // The pure helpers the modality builders stand on: exact rationals, the
  // readers that turn generated notation back into structure, and the
  // arrangement. Cut whole, so they are the shipped ones.
  const rationals = region('const gcd = (a, b) =>', '\n// ------');
  const clean = region('const CLEAN = (s) =>', '\n/** Replace one variable');
  const readers = region('function parseSide(str, v)', '\n/**\n * A written number as an exact fraction');
  const norm = region('const norm = (s) =>', '\n\n/**\n * How many glyphs');
  const arrange = region('function mulberry(seed)', '\n/**\n * The aperture itself.');

  // The prefix of each modality builder: everything before it touches the DOM.
  // That prefix is exactly the part that decides whether the surface can take
  // this card — and, on the beam, the part that builds the tray of moves.
  const balance = body('  _balance(work) {\n', '    // A machine with weight');
  const sorter = body('  _sort(work) {\n', '    const bays = document.createElement');
  const area = body('  _area(work) {\n', '    const field = document.createElement');

  // The routing chain itself, out of `_mount`, ending on the keypad line.
  const KEYPAD_LINE = '    if (!built) built = this._keypad(work);';
  const mount = region('    const item = this.item;', KEYPAD_LINE, at('  _mount() {')) + KEYPAD_LINE;

  // What the narrowed field and the four-option card are BUILT FROM — cut so
  // that "the key and the first two distractors" is read off the shipped file
  // and not remembered here.
  const narrowPool = region('    const pool = this._readings((this.item.distractors', ';\n');
  const choicePool = region('    const pool = this._readings(item.distractors', ';\n');

  const narrowArg = narrowPool.replace('this._readings', '_readings');
  const choiceArg = choicePool.replace('this._readings', '_readings');

  const made = new Function('mathOp', 'balancedPick', `
${rationals}
${clean}
${readers}
${norm}
${arrange}
const BEAM = function () {
${balance}
  return { S, v, start, ideal, apply, distance, candidates, solvedValue };
};
const CHIPS = function () {
${sorter}
  return { terms, v, chipOrder, classes, bayOrder };
};
const FIELD = function () {
${area}
  return { k, a, b, v, wantA, wantB, chips };
};
const ROUTE = function (work) {
${mount}
  return built;
};
/* The two option sets, read out of the shipped source rather than restated.
   \`_readings\` needs a DOM to render with, so what is executed here is the
   ARGUMENT it is handed — which is the whole of the claim being made: the
   four-option card shows every distractor, the narrowed field shows two. */
const NARROW_ARG = function () { const _readings = (x) => x; ${narrowArg}; return pool; };
const CHOICE_ARG = function (item) { const _readings = (x) => x; ${choiceArg}; return pool; };
return { BEAM, CHIPS, FIELD, ROUTE, NARROW_ARG, CHOICE_ARG, arranged, shuffled, sideTex };
`);

  const R = made(mathOp, balancedPick);

  /** Every option the four-option card puts on screen, THE KEY FIRST. */
  const choiceOptions = (item) =>
    [String(item.answer), ...R.CHOICE_ARG.call({ item }, item).map((d) => String(d.value ?? ''))]
      .filter((s) => s.trim());
  /** Every reading the narrowed field puts on screen, THE KEY FIRST. */
  const narrowOptions = (item) =>
    [String(item.answer), ...R.NARROW_ARG.call({ item }).map((d) => String(d.value ?? ''))]
      .filter((s) => s.trim());

  /**
   * Which surface this card is sent to, by the shipped routing chain.
   *
   * @param {object} item a generated item.
   * @param {number} seed the rift's seed — the beam's tray is drawn from it.
   * @returns {{name:string, beam?:object, chips?:object}}
   */
  function route(item, seed = 1) {
    const self = {
      item, seed,
      _choice: () => (choiceOptions(item).length >= 2 ? { name: 'choice' } : null),
      // `mountPlot` refuses anything that is not a plot with a target; that is
      // its first line and the only one that decides whether it takes the card.
      _plot: () => (item.figure?.kind === 'plot' && item.figure?.target ? { name: 'plot' } : null),
      _balance() {
        let r = null;
        try { r = R.BEAM.call(self); } catch { r = null; }
        return r ? { name: 'balance', beam: r } : null;
      },
      _area() {
        let r = null;
        try { r = R.FIELD.call(self); } catch { r = null; }
        return r ? { name: 'area', field: r } : null;
      },
      _sort() {
        let r = null;
        try { r = R.CHIPS.call(self); } catch { r = null; }
        return r ? { name: 'sort', chips: r } : null;
      },
      _keypad: () => ({ name: 'keypad' }),
    };
    return R.ROUTE.call(self, null);
  }

  return {
    route, choiceOptions, narrowOptions,
    arranged: R.arranged, shuffled: R.shuffled, sideTex: R.sideTex,
    anchors: ANCHORS.slice(),
  };
}
