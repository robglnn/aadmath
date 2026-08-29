/**
 * Algebra I · Level 4 — item prose, English.
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
 *   bar      the line over a square root; "under the bar" is the radicand
 *   root     the number that, multiplied by itself, gives the one under the bar
 *   square   a number multiplied by itself
 *   bracket  one of the two parts of a product, taught at Level 3
 *   product  the result of multiplying, taught at Level 1
 *   zero     an input at which a rule reads zero
 *   turn     the one input where a squared rule stops falling and starts rising
 *   curve    the shape a squared rule draws
 * "turning point" is always two words and always means the pair of readings at
 * the turn. A "value" is an output; an "input" is never called a value.
 */
export default {
  // ------------------------------------------------------------------ asks
  'l4.ask.pullOutTheSquare': 'Take the largest square out from under the bar.',
  'l4.ask.joinTheRoots': 'Join these into one root.',
  'l4.ask.clearTheBottom': 'Move the root off the bottom.',
  'l4.ask.openAndTidy': 'Open the bracket. Then join what can join.',
  'l4.ask.writeAsProduct': 'Write this as a product of brackets.',
  'l4.ask.areaAsProduct': 'Write the area as its two sides.',
  'l4.ask.whichComesApart': 'Only one of these comes apart. Write that one as a product.',
  'l4.ask.whichIsSquareMinusSquare': 'One of these is a square take away a square. Write that one as a product.',
  'l4.ask.writeTheQuotient': 'Write the answer to this division.',
  'l4.ask.writeTheRemainder': 'What is left over?',
  'l4.ask.otherSide': 'Write the other side.',
  'l4.ask.whereIsItZero': 'Where is this zero?',
  'l4.ask.whichInputsShutIt': 'Which inputs shut it?',
  'l4.ask.solveIt': 'Find every value that works.',
  'l4.ask.howWideIsIt': 'How wide is it?',
  'l4.ask.howLongIsTheSide': 'How long is one side?',
  'l4.ask.showTheTurn': 'Write this rule with the turning point showing.',
  'l4.ask.whereDoesItTurn': 'Where does this rule turn?',
  'l4.ask.lineOfSymmetry': 'Write the line the curve folds along.',
  'l4.ask.greatestValue': 'What is the greatest value this rule reaches?',
  'l4.ask.leastValue': 'What is the least value this rule reaches?',
  'l4.ask.whereItCrossesUpright': 'What is the output at the start?',
  'l4.ask.whereItCrossesFlat': 'Where does this rule read zero?',
  'l4.ask.whichOutputs': 'Which outputs does this rule give?',
  'l4.ask.readingAt': 'The readings follow a squared rule. What is the reading at {at}?',
  'l4.ask.ruleTurnsAt': 'The turn is at $\\left({h}, {k}\\right)$. Write the rule with it showing.',
  'l4.ask.ruleIsZeroAt': 'This rule reads zero at {p} and at {q}. Write it as a product.',
  'l4.ask.writeWithoutBrackets': 'Write this rule without brackets.',
  'l4.ask.whenDoesItLand': 'When does it reach the ground?',
  'l4.ask.greatestHeight': 'What is the greatest height?',
  'l4.ask.largestArea': 'What is the largest area?',
  'l4.ask.bestPriceAndTakings': 'Give the best price and the takings there.',

  // -------------------------------------------------------- a square shape
  'l4.ctx.squarePlate': 'A root gives the side of this square hull plate.',
  'l4.ctx.squareBay': 'A root gives the side of this square landing bay.',
  'l4.ctx.squarePad': 'A root gives the side of this square launch pad.',
  'l4.ctx.squareVat': 'A root gives the side of this square mixing vat.',

  // ------------------------------------------------ a square, side unknown
  'l4.ctx.sideDeck': 'A square deck holds this area. The letter is one side.',
  'l4.ctx.sideTile': 'A square tile holds this area. The letter is one side.',
  'l4.ctx.sideFrame': 'A square frame holds this area. The letter is one side.',
  'l4.ctx.sideHatch': 'A square hatch holds this area. The letter is one side.',

  // -------------------------------------------- two sides and a brace across
  'l4.ctx.braceStrut': 'This brace crosses two struts that meet at a right angle.',
  'l4.ctx.braceMast': 'This stay crosses a mast and a deck at a right angle.',
  'l4.ctx.braceRamp': 'This beam crosses a ramp and a floor at a right angle.',
  'l4.ctx.braceHatch': 'This bar crosses two hatch edges at a right angle.',

  // ------------------------------------------------ two lengths, end to end
  'l4.ctx.mixRail': 'Two rails lie end to end, and a root gives each length.',
  'l4.ctx.mixCable': 'Two cables lie end to end, and a root gives each length.',
  'l4.ctx.mixSeam': 'Two seams lie end to end, and a root gives each length.',
  'l4.ctx.mixPipe': 'Two pipes lie end to end, and a root gives each length.',

  // ------------------------------------------------ a rectangle, sides unknown
  'l4.ctx.plotBay': 'This bay is a rectangle, and neither side is known yet.',
  'l4.ctx.plotDeck': 'This deck is a rectangle, and neither side is known yet.',
  'l4.ctx.plotField': 'This field is a rectangle, and neither side is known yet.',
  'l4.ctx.plotStore': 'This store is a rectangle, and neither side is known yet.',

  // ------------------------------------------- a rectangle, one side known
  'l4.ctx.shareFloor': 'This floor is a rectangle. The area is on top, one side below.',
  'l4.ctx.shareRoll': 'This roll is a rectangle. The area is on top, one side below.',
  'l4.ctx.shareTrench': 'This trench is a rectangle. The area is on top, one side below.',
  'l4.ctx.shareGrid': 'This grid is a rectangle. The area is on top, one side below.',

  // ------------------------------------------------------- two gates at once
  'l4.ctx.gatePair': 'A drive stops when the two dial readings multiply to zero.',
  'l4.ctx.gateValve': 'A valve shuts when the two lever readings multiply to zero.',
  'l4.ctx.gateLatch': 'A latch drops when the two catch readings multiply to zero.',
  'l4.ctx.gateRelay': 'A relay opens when the two coil readings multiply to zero.',

  // --------------------------------------------------------- something thrown
  'l4.ctx.throwFlare': 'A cadet fires a flare. This rule gives its height each second.',
  'l4.ctx.throwPod': 'A crane lifts a pod. This rule gives its height each second.',
  'l4.ctx.throwDrone': 'A drone climbs and falls. This rule gives its height each second.',
  'l4.ctx.throwBuoy': 'A cadet throws a buoy. This rule gives its height each second.',

  // ------------------------------------------------------- when it comes down
  'l4.ctx.landFlare': 'A cadet fires a flare. It lands when its height reaches zero.',
  'l4.ctx.landPod': 'A crane releases a pod. It lands when its height reaches zero.',
  'l4.ctx.landDrone': 'A drone climbs and falls. It lands when its height reaches zero.',
  'l4.ctx.landBuoy': 'A cadet throws a buoy. It lands when its height reaches zero.',

  // ----------------------------------------------------------- a fixed fence
  'l4.ctx.fencePen': 'A pen has a fence of fixed length. This rule gives its area.',
  'l4.ctx.fenceYard': 'A yard has a fence of fixed length. This rule gives its area.',
  'l4.ctx.fenceRun': 'A run has a fence of fixed length. This rule gives its area.',
  'l4.ctx.fenceLot': 'A lot has a fence of fixed length. This rule gives its area.',

  // ------------------------------------------------------ a price and takings
  'l4.ctx.priceTicket': 'A stall sets one ticket price. This rule gives the takings.',
  'l4.ctx.pricePart': 'A works sets one part price. This rule gives the takings.',
  'l4.ctx.priceRation': 'A store sets one ration price. This rule gives the takings.',
  'l4.ctx.pricePass': 'A gate sets one pass price. This rule gives the takings.',

  // ----------------------------------------------------------- a curved span
  'l4.ctx.archSpan': 'A span rises and falls. This rule gives its height.',
  'l4.ctx.archCable': 'A cable dips and rises. This rule gives its height.',
  'l4.ctx.archRib': 'A rib rises and falls. This rule gives its height.',
  'l4.ctx.archDome': 'A dome rises and falls. This rule gives its height.',

  // ------------------------------------------------------- two cadets differ
  // A DISPUTE IS A SITUATION, NOT A CHOICE SET.
  // These read "write different answers here" over a keypad, with no answers
  // anywhere on the card, under "Which answer is right?". A cadet looked for
  // two answers, found none, and had to ignore the sentence to do the
  // mathematics. The situation now says only what happened; the question that
  // follows it states the task, exactly as every other form in this pack does.
  'l4.ctx.disputeWatch': 'Two cadets on the same watch disagree about this one.',
  'l4.ctx.disputeBench': 'Two cadets at the same bench disagree about this one.',
  'l4.ctx.disputeCheck': 'Two cadets checking each other disagree about this one.',
  'l4.ctx.disputeBay': 'Two cadets in the same bay disagree about this one.',
  'l4.ctx.disputeSurvey': 'Two cadets on the same survey disagree about this one.',
  'l4.ctx.disputeConsole': 'Two cadets at the same console disagree about this one.',

  // ------------------------------------------------------------------ whys
  'l4.why.largestSquareInside': '{sq} is the largest square that divides the number under the bar.',
  'l4.why.squareComesOut': 'A square under the bar comes out as its own root, so {m} comes out.',
  'l4.why.frontTimesWhatCameOut': 'Multiply the {c} in front by the {m} that came out.',
  'l4.why.shareTheFront': 'Now share the front number between {p}.',
  'l4.why.addUnderTheBarFirst': 'Add under the bar first. One bar covers the whole sum.',
  'l4.why.sameUnderTheBar': 'Both roots hold {k} under the bar, so they count together.',
  'l4.why.countTheRoots': 'Count the roots. The number under the bar does not change.',
  'l4.why.takeEachSquareOut': 'Take the square out of each root first.',
  'l4.why.timesTheSameRoot': 'Multiply the top and the bottom by the root of {k}.',
  'l4.why.shareTheRootOver': 'The root outside reaches each term inside the bracket.',
  'l4.why.rootTimesItself': 'A root times itself gives {k}.',
  'l4.why.pairMultipliesAndAdds': 'One pair multiplies to {c} and adds to {b}.',
  'l4.why.eachNumberItsBracket': 'Each number of the pair takes its own bracket.',
  'l4.why.constantIsASquare': 'The last term is {p} times {p}.',
  'l4.why.sameBracketTwice': 'One bracket, used twice, is that bracket squared.',
  'l4.why.commonFactorFirst': 'Take the {g} out of every term first.',
  'l4.why.firstTimesLast': '{a} times {c} is the number the pair must multiply to.',
  'l4.why.shareTheFrontNumber': 'The two brackets share the {a} in front.',
  'l4.why.frontIsASquare': 'The first term is the square of {p} lots of the letter.',
  'l4.why.bothPartsAreSquares': 'Both parts are squares, and {c} times {c} gives the last one.',
  'l4.why.onePlusOneMinus': 'One bracket adds and one bracket takes away.',
  'l4.why.aCubeIsNotASquare': 'A cube taken away is not a square taken away.',
  'l4.why.plusDoesNotComeApart': 'Two squares with a plus between them stay together.',
  'l4.why.zeroMeansTheRuleReadsZero': 'A zero of a rule is an input where the rule reads zero.',
  'l4.why.noSquareIsBelowZero': 'No square sits below zero, so no input works.',
  'l4.why.oneBarOverEachTerm': 'One bar over a sum is a bar over each term.',
  'l4.why.multiplyBackToCheck': 'Multiply back. The bottom times the answer gives the top.',
  'l4.why.factorTheTopFirst': 'Write the top as a product first.',
  'l4.why.whatIsLeftOver': 'The product misses this much, so this much is left over.',
  'l4.why.thatIsWhatTheBottomNeeds': 'The bottom needs exactly that to give the top.',
  'l4.why.oneBracketIsZero': 'A product reads zero when one bracket reads zero.',
  'l4.why.sameStatementOpenedOut': 'Opened out, the same statement reads like this.',
  'l4.why.andTheOtherBracket': 'The other bracket gives the second reading.',
  'l4.why.everythingOnOneSide': 'Move everything to one side. The other side now reads zero.',
  'l4.why.nowTheBracketsCanBeZero': 'The two-bracket rule works now, because the other side reads zero.',
  'l4.why.onlyOneWidthCanBeReal': 'A width below zero is not a width, so one reading goes.',
  'l4.why.onlyOneLengthCanBeReal': 'A length below zero is not a length, so one reading goes.',
  'l4.why.rootBothSides': 'Take the root of both sides. A square has two roots.',
  'l4.why.twoRootsOneEach': 'One root is {s}. The other root is minus {s}.',
  'l4.why.undoTheShiftLast': 'Move the {h} across last, after the root.',
  'l4.why.freeTheSquare': 'Get the squared bracket on its own first.',
  'l4.why.halfTheMiddleSquared': 'Half of {b}, squared, completes the square.',
  'l4.why.addItAndTakeItBack': 'Add {sq} to build the square. Then take {sq} back.',
  'l4.why.divideTheFrontOutFirst': 'Take the {a} out of the first two terms first.',
  'l4.why.putTheThreeNumbersIn': 'Put the three numbers into the formula.',
  'l4.why.workOutUnderTheRoot': 'The part under the root comes to {disc}.',
  'l4.why.thenTakeTheRoot': 'The root of that part is {root}.',
  'l4.why.noRootBelowZero': 'No real number squares to a number below zero.',
  'l4.why.onlyTheTimeAfterLaunch': 'Only a time after the launch can be real.',
  'l4.why.turnIsMinusBOverTwoA': 'The turn sits at minus the middle number over twice the first.',
  'l4.why.readTheRuleAtTheTurn': 'Read the rule at {h} to get the value there.',
  'l4.why.theLineRunsThroughTheTurn': 'The line runs upright through the turn.',
  'l4.why.putZeroIn': 'Put zero in for the letter.',
  'l4.why.onlyTheLastTermSurvives': 'Every term with a letter goes, so the last term stays.',
  'l4.why.opensUpSoNothingLower': 'The curve opens upwards, so nothing sits lower than the turn.',
  'l4.why.opensDownSoNothingHigher': 'The curve opens downwards, so nothing sits higher than the turn.',
  'l4.why.secondDifferencesAreEqual': 'The gaps between the gaps stay equal, so a squared rule fits.',
  'l4.why.readTheRuleAt': 'Read that rule at {at}.',
  'l4.why.vertexFormShape': 'This shape shows the turning point.',
  'l4.why.putTheTurnIn': 'Put {h} and {k} into that shape.',
  'l4.why.squareTheBracketFirst': 'Square the bracket first.',
  'l4.why.shareThenJoin': 'Share the number in. Then join the like terms.',
  'l4.why.aZeroMakesABracket': 'A zero at {p} makes one bracket.',
  'l4.why.bothZerosBothBrackets': 'Both zeros make both brackets.',
};
