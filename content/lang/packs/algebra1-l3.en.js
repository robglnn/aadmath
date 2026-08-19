/**
 * Algebra I · Level 3 — item prose, English.
 *
 * Prose for a course pack lives beside the shipped item bundles, under
 * content/lang, and never inside src/. Same rule, same reason: src/ carries no
 * language. The pack in src/content/packs imports this file and the registry
 * merges it in behind content/lang/items.*.js.
 *
 * HOUSE STYLE. Simplified technical English: one word means one thing, one
 * instruction per sentence, active voice, under twenty words. A situation is
 * ONE sentence, and it never states a number the mathematics does not use.
 *
 * ONE WORD, ONE MEANING — the vocabulary this level adds:
 *   power   a letter or number with a count written above it
 *   count   the number written above, which says how many factors there are
 *   factor  one of the things being multiplied
 *   term    one part of a sum, taught at Level 1
 *   rule    a named machine that turns one input into one output
 *   step    one move along the inputs, from a number to the next number
 *   factor of growth is always called "factor", never "rate" — a rate adds.
 */
export default {
  // ------------------------------------------------------------------ asks
  'l3.ask.onePower': 'Write this as one power.',
  'l3.ask.whatFactor': "What is that factor?",
  'l3.ask.areaOnePower': "Write the area as one power.",
  'l3.ask.wholeOnePower': "Write the whole as one power.",
  'l3.ask.shareOnePower': "Write one share as one power.",
  'l3.ask.oneExpression': 'Write this as one expression.',
  'l3.ask.exactValue': 'What is the exact value?',
  'l3.ask.whichIsRight': 'Which cadet is right?',
  'l3.ask.valueOfF': 'What is $f({k})$?',
  'l3.ask.whichInputGives': 'Which input gives the output ${out}$?',
  'l3.ask.largestOutput': 'What is the largest output?',
  'l3.ask.smallestOutput': 'What is the smallest output?',
  'l3.ask.missingReading': 'What is the missing reading?',
  'l3.ask.plateArea': 'Write the area as one expression.',
  'l3.ask.factoredForm': 'Write this as a product.',
  'l3.ask.combinedTotal': 'Write the combined total as one expression.',
  'l3.ask.whatIsLeft': 'Write what is left as one expression.',
  'l3.ask.stepFactor': 'The output multiplies by the same number at each step. What is it?',
  'l3.ask.stepAdd': 'The output adds the same number at each step. What is it?',
  'l3.ask.gapAt': 'What is the value at ${v} = {k}$?',
  'l3.ask.startValue': 'What is the output at the start?',
  'l3.ask.nextReading': 'What is the output one step later?',

  // ------------------------------------------------------- the input range
  'l3.ctx.inputsRun': 'The inputs are the whole numbers from {lo} to {hi}.',

  // --------------------------------------------------------- named rules
  'l3.ctx.assay': 'An assay rig turns each ore sample into one reading.',
  'l3.ctx.kilnRule': 'This kiln turns each fuel setting into one temperature.',
  'l3.ctx.sorter': "A sorter turns each crate load into one shelf load.",
  'l3.ctx.lathe': 'A lathe turns each pass into one finished depth.',
  'l3.ctx.beacon': "A beacon turns each dial setting into one distance.",

  // ------------------------------------------------------- whole inputs only
  'l3.ctx.crates': "A hoist takes whole crates only, from {lo} to {hi}.",
  'l3.ctx.berths': "A shuttle takes whole berths only, from {lo} to {hi}.",
  'l3.ctx.panels': "A frame takes whole panels only, from {lo} to {hi}.",
  'l3.ctx.rations': "A locker takes whole ration packs only, from {lo} to {hi}.",

  // --------------------------------------------- a power beside a power
  'l3.ctx.tileRun': "This tile bay is a rectangle, and each side is a power of the same length.",
  'l3.ctx.coilStack': "This coil rack is a rectangle, and each side is a power of the same width.",
  'l3.ctx.cellArray': "This cell block is a rectangle, and each side is a power of the same depth.",
  'l3.ctx.driveBank': "This drive bank is a rectangle, and each side is a power of the same height.",
  'l3.ctx.oreSeam': "This ore seam is a rectangle, and each side is a power of the same span.",

  // ------------------------------------------------- a power of a power
  'l3.ctx.stackOfStacks': "Each bay holds a power of one load, and the hold repeats that bay a power of times.",
  'l3.ctx.gridOfGrids': "Each grid holds a power of one cell, and the array repeats that grid a power of times.",
  'l3.ctx.podOfPods': "Each pod holds a power of one seed, and the rack repeats that pod a power of times.",
  'l3.ctx.reelOfReels': "Each reel holds a power of one turn, and the spool repeats that reel a power of times.",

  // ------------------------------------------------------- a power shared
  'l3.ctx.equalCrews': "A hold holds a power of one load, and shares it between a power of crews.",
  'l3.ctx.equalPallets': "A bay holds a power of one box, and shares it between a power of pallets.",
  'l3.ctx.equalRacks': "A store holds a power of one cell, and shares it between a power of racks.",
  'l3.ctx.equalVats': "A line holds a power of one litre, and shares it between a power of vats.",

  // ------------------------------------------------------ two records joined
  'l3.ctx.twoManifests': 'Two manifests record the same kinds of item.',
  'l3.ctx.twoSurveys': 'Two surveys record the same kinds of reading.',
  'l3.ctx.twoHolds': 'Two holds record the same kinds of crate.',
  'l3.ctx.twoShifts': 'Two shifts record the same kinds of job.',

  // ------------------------------------------------------------ rectangles
  'l3.ctx.hullPlate': 'A hull plate is a rectangle, and neither side is known yet.',
  'l3.ctx.deckPanel': 'A deck panel is a rectangle, and neither side is known yet.',
  'l3.ctx.solarSail': 'A solar sail is a rectangle, and neither side is known yet.',
  'l3.ctx.floorBay': 'A floor bay is a rectangle, and neither side is known yet.',

  // --------------------------------------------------- one shared quantity
  'l3.ctx.sameCrew': "Every term below measures the same crew size.",
  'l3.ctx.samePallet': "Every term below measures the same pallet size.",
  'l3.ctx.sameRack': "Every term below measures the same rack size.",
  'l3.ctx.sameVat': "Every term below measures the same vat size.",

  // ---------------------------------------------------------------- growth
  'l3.ctx.spore': 'A spore bed grows by the same factor every watch.',
  'l3.ctx.relaySignal': 'A relay signal gains by the same factor every watch.',
  'l3.ctx.rustBloom': 'A rust bloom spreads by the same factor every watch.',
  'l3.ctx.yeastVat': 'A yeast vat rises by the same factor every watch.',

  // ----------------------------------------------------------------- decay
  'l3.ctx.coolant': 'A coolant tank keeps the same fraction of its charge every watch.',
  'l3.ctx.isotope': 'An isotope keeps the same fraction of its mass every watch.',
  'l3.ctx.powerCell': "A cell keeps the same fraction of its store every watch.",
  'l3.ctx.signalFade': 'A signal keeps the same fraction of its strength every watch.',

  // ------------------------------------------------------------ steady logs
  'l3.ctx.steadyWinch': 'A winch log climbs by the same amount every watch.',
  'l3.ctx.steadyTank': 'A tank log climbs by the same amount every watch.',
  'l3.ctx.steadyStack': 'A stack log climbs by the same amount every watch.',
  'l3.ctx.steadyFrost': 'A frost log climbs by the same amount every watch.',

  // -------------------------------------------------------------- disputes
  'l3.ctx.disputeExponent': 'Two cadets multiplied two powers of one letter and disagree about the new count.',
  'l3.ctx.disputeFactorCount': 'Two cadets counted the factors in a product of powers and got different totals.',
  'l3.ctx.disputeMinus': 'Two cadets took one bracket away from another and disagree about the signs.',
  'l3.ctx.disputeSecondBracket': 'Two cadets subtracted a bracket, and one of them changed only its first term.',

  // ------------------------------------------------------- why · exponents
  'l3.why.countTheFactors': 'A power counts factors, so a product of powers counts both lots.',
  'l3.why.addTheCounts': 'Add the two counts, {a} and {b}.',
  'l3.why.numbersThenLetters': 'Gather the numbers together, then gather the powers together.',
  'l3.why.multiplyNumbersAddCounts': 'Multiply the numbers. Add the counts.',
  'l3.why.twoAtATime': 'Take the first two powers, then bring the third one in.',
  'l3.why.addTheLastCount': 'Add the last count, {c}, to the total so far.',
  'l3.why.writeOutTheFactors': 'Write the factors out in full, and count them.',
  'l3.why.copiesOfTheBracket': 'The bracket appears {b} times, and each copy carries {a} factors.',
  'l3.why.countCopiesOfCount': 'Each copy of the bracket brings the same count again.',
  'l3.why.multiplyTheCounts': 'Multiply the two counts, {a} and {b}.',
  'l3.why.everyFactorIsRaised': 'The count outside reaches every factor inside the bracket.',
  'l3.why.raiseNumberMultiplyCounts': 'Raise the number to the count. Multiply the counts.',
  'l3.why.innerPairFirst': 'Work the inner pair of counts out first.',
  'l3.why.cancelMatchingFactors': 'Every factor on the bottom cancels one on the top.',
  'l3.why.subtractTheCounts': 'Take the bottom count from the top count: {a} take away {b}.',
  'l3.why.divideNumbersSubtractCounts': 'Divide the numbers. Take the counts away.',
  'l3.why.bottomFirst': 'Gather the bottom into one power first.',
  'l3.why.everyFactorCancels': 'Top and bottom hold the same factors, so only one is left.',
  'l3.why.theZeroBelongsToTheLetter': 'The zero count belongs to the letter, not to the number.',
  'l3.why.zeroPowerIsOne': 'A letter with a count of zero is one.',
  'l3.why.negativeCountIsUnderTheBar': 'A count of minus {n} puts {n} factors under the bar.',
  'l3.why.unitFractionDivides': "Each step divides by {q}, so {n} steps divide by {q} that many times.",
  'l3.why.workOutTheBottom': 'Work out {base} with a count of {n} on the bottom.',

  // ------------------------------------------------------- why · functions
  'l3.why.putTheInputIn': 'Put {k} everywhere the letter stands in the rule.',
  'l3.why.workItOut': 'Now work the arithmetic out.',
  'l3.why.nameIsNotAFactor': 'The name of a rule is a label, and it never multiplies.',
  'l3.why.readTheRowAcross': 'Read across the row to the output column.',
  'l3.why.oneStepDownTable': 'One step down the table changes the output by the same amount.',
  'l3.why.risingRuleTopInput': 'The rate is positive, so the largest input gives the largest output.',
  'l3.why.risingRuleLowInput': 'The rate is positive, so the smallest input gives the smallest output.',
  'l3.why.fallingRuleTopOutput': 'The rate is negative, so the smallest input gives the largest output.',
  'l3.why.undoToFindInput': 'Undo the rule to find the input that gives it.',

  // ----------------------------------------------------- why · polynomials
  'l3.why.dropTheFirstBracket': 'A plus in front leaves the bracket exactly as it is.',
  'l3.why.minusEntersEveryTerm': 'The minus belongs to the whole bracket, so it changes every term inside.',
  'l3.why.collectEachPower': 'Collect the terms that carry the same count.',
  'l3.why.eachTimesEach': 'Every term in the first bracket multiplies every term in the second.',
  'l3.why.collectTheMiddle': 'The two middle terms carry the same count, so they join.',
  'l3.why.squareIsTwoBrackets': 'A square is the bracket written out twice.',
  'l3.why.monoIntoEveryTerm': 'The term in front multiplies every term inside the bracket.',
  'l3.why.largestSharedFactor': 'Find the largest factor that every term carries.',
  'l3.why.divideEachTerm': 'Divide each term by that factor, and write what is left inside.',
  'l3.why.checkByExpanding': 'Multiply back out to check that nothing was left behind.',
  'l3.why.lowestPowerComesOut': 'The lowest count of the letter is the most every term can share.',

  // --------------------------------------------------------- why · growth
  'l3.why.divideNeighbours': 'Divide one reading by the reading before it.',
  'l3.why.thatIsTheFactor': 'That is the factor, and every step uses the same one.',
  'l3.why.subtractNeighbours': 'Take one reading away from the reading after it.',
  'l3.why.thatIsTheStep': 'That is the step, and every step adds the same amount.',
  'l3.why.putTheStepIn': 'Put {k} in place of the letter in both rules.',
  'l3.why.exponentialOvertakes': 'A factor beats a step once the count grows.',
  'l3.why.startIsTheNumberInFront': 'At zero the power is one, so the number in front is the start.',
  'l3.why.oneMoreStepMultiplies': 'One more step multiplies the output by the base once more.',
  'l3.why.readTheBaseOff': 'The number above the letter is the count, and the number under it is the base.',
};
