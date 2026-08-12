/**
 * Algebra I · Level 2 — item prose, English.
 *
 * Prose for a course pack lives beside the shipped item bundles, under
 * content/lang, and never inside src/. Same rule, same reason: src/ carries no
 * language. The pack in src/content/packs imports this file and the registry
 * merges it in behind content/lang/items.*.js.
 */
export default {
  'l2.ctx.twoHolds': 'A freighter has two holds. Both holds are loaded to the same mass.',
  'l2.ask.holdMass': 'The record below is what each hold weighs. Find ${v}$.',
  'l2.ctx.shareOut': 'A crew shares one delivery into equal loads.',
  'l2.ask.oneLoad': 'The record below states the size of one load. Find ${v}$.',
  'l2.ctx.gauge': 'A gauge is read once every watch. Nobody wrote down the rule it follows.',
  'l2.ask.missingWatch': 'One reading is missing. What was it?',
  'l2.ctx.stockpile': 'A stockpile grows by the same amount every watch.',
  'l2.why.openBothBrackets': 'Open both brackets first. Each side is one quantity until you do.',
  'l2.why.minusEntersEveryTerm': 'The minus sign belongs to the whole bracket, so it enters every term inside it.',
  'l2.why.multiplyBothByBottom': 'Multiply both sides by {k}. That is what takes the bar away.',
  'l2.why.stepTellsRate': 'Each step of the input moves the output by {n}. That is the rate.',
  'l2.why.applyRateOnce': 'Apply the rate to the row above the gap.',
  'l2.why.stepBackToInput': 'The output moved by one rate, so the input moved by one step.',
};
