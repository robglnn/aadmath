/**
 * Item prose — English.
 *
 * Everything a learner reads around the mathematics lives here: the situation,
 * the question, and the reason attached to each line of a worked solution.
 * The notation itself never appears in this file; it is language-independent
 * and is generated (and machine-verified) in src/learn/generators.js.
 */
export default {
  // ---- what the learner is being asked to do -----------------------------
  'ask.evaluate': 'Work out the value.',
  'ask.evaluateAlt': 'What does this come to?',
  'ask.evaluateAlt2': 'Settle it.',
  'ask.costOfStay': 'What does a stay of {c} cycles come to?',
  'ask.costOfTow': 'What does a tow of {c} cycles come to?',
  'ask.evaluateWhen': 'Work this out when ${v} = {val}$.',
  'ask.evaluateWhenAlt': 'Work it out with ${v} = {val}$.',
  'ask.evaluateWhenAlt2': 'Read this at ${v} = {val}$.',
  'ask.evaluateWhenTwo': 'Work this out when ${a} = {av}$ and ${b} = {bv}$.',
  'ask.valueWhen': 'If ${v} = {val}$, what is this worth?',
  'ask.worthWhen': 'With ${v} = {val}$ on the manifest, what does this come to?',
  'ask.settleWhen': 'Take ${v} = {val}$ and settle it.',
  'ask.valueOfExpr': 'What is the expression worth?',
  'ask.howManyCadets': 'If ${v} = {val}$, how many cadets is that?',
  'ask.howManySeedlings': 'If ${v} = {val}$, how many seedlings go up?',
  'ask.howManyMetres': 'If ${v} = {val}$, how many metres is that?',
  'ask.howManyDays': 'If ${v} = {val}$, how many days has been signed out?',
  'ask.howManySeconds': 'If ${v} = {val}$, how many seconds of light is that?',
  'ask.howManyTonnes': 'If ${v} = {val}$, how many tonnes goes into the keel?',
  'ask.howManyDoses': 'If ${v} = {val}$, how many doses came down?',
  'ask.solveFor': 'Find ${v}$.',
  'ask.solveForAlt': 'What must ${v}$ be?',
  'ask.solveForAlt2': 'Name the value of ${v}$ that holds this true.',
  'ask.solveOrClassify': 'Find ${v}$ — or say what kind of statement this is.',
  'ask.simplify': 'Write this as simply as it can be written.',
  'ask.simplifyAlt': 'Say the same thing in fewer terms.',
  'ask.simplifyAlt2': 'Gather what is alike, and write what is left.',
  'ask.expand': 'Open the bracket.',
  'ask.expandAlt': 'Take the bracket off it.',
  'ask.expandAlt2': 'Multiply it out.',
  'ask.expandAndSimplify': 'Open both brackets, then gather what is alike.',
  'ask.whichExpression': 'Which expression gives the total?',
  'ask.whichEquivalent': 'Which one says exactly the same thing?',
  'ask.whichProduct': 'Which product is this expression in disguise?',
  'ask.whichIsRight': 'Which reading is the true one?',
  'ask.whichEquationTotal': 'Which equation says the bill came to {c} credits?',
  'ask.missingReading': 'What belongs in the gap?',
  'ask.missingInput': 'Which input belongs in the gap?',
  'ask.readTraceAt': 'What does the trace read at ${v} = {val}$?',
  'ask.whereTraceReaches': 'At what $x$ does the trace reach {val}?',
  'ask.whereTracesMeet': 'At what $x$ do the two traces cross?',
  'ask.readingAfter': 'What does it read after {val} minutes?',
  'ask.startingMass': 'What did the hold read before the drop?',
  'ask.startingGrain': 'What did the silo hold before this morning?',
  'ask.startingLevel': 'Where was the needle before?',
  'ask.oneCrateMass': 'What is one crate worth?',
  'ask.oneDrumMass': 'What is one drum worth?',
  'ask.onePalletMass': 'What is one pallet worth?',
  'ask.oneCanisterMass': 'What is one canister worth?',
  'ask.howManyCycles': 'How many cycles does a bill of {c} credits buy?',
  'ask.howManyCyclesTow': 'How many cycles of tow does {c} credits buy?',
  'ask.howManyShiftsTotal': 'How many rotations make a total of {c} shifts?',
  // These two ask about a shape whose measuring rule is already printed on the
  // card. "Which expression gives the distance all the way round?" was answered
  // by the display: 2(3m + 6) + 2(m + 15) is that expression, sitting in the
  // statement box above the answer box. So the ask names the printed rule for
  // what it is, and then names the work — which is the work the item actually
  // marks. Wording matched to the plain-language asks these skills already use
  // ('ask.simplifyAlt2', 'ask.expand'), so no new term arrives undefined.
  /* THE ASK THAT STOPPED DOING THE WORK. `perimeterGather` pointed at a
     display that had already written the four sides out in order, so the
     only task left was collecting like terms and the drawing was decoration.
     The sides are still stated above; going round them is now the learner's.
     The old key is kept — other banks may point at it. (src/learn/generators.js
     `lt-perimeter`) */
  'ask.perimeterGather': 'The rule below adds that distance up. Gather what is alike, and write what is left.',
  'ask.perimeterRound': 'Add the four sides. Gather what is alike, and write what is left.',
  'ask.areaMultiplyOut': 'The rule below gives that area. Multiply it out.',
  'ask.whenSameCost': 'After how many runs do the plans cost the same?',
  'ask.shareOut': 'Share the bar out over every term.',
  'ask.whichEquationHold': 'Which equation says what happened to the hold?',
  'ask.whichEquationSilo': 'Which equation says what happened in the silo?',
  'ask.whichEquationReservoir': 'Which equation says what the reservoir did?',

  // ---- the situations ----------------------------------------------------
  //
  // A situation earns its place only if the mathematics is the shape of the
  // situation. A beam is an equation because it is level. A hold gauge is
  // solved backwards because it never recorded what it started at. A log is a
  // rule because one instrument wrote every line of it. Where a form needs a
  // log, it gets its own log with its own quantities. Six copies of one
  // sentence is wallpaper, and a cadet stops reading wallpaper by the third
  // rift — so the decks below are wide enough to deal a whole session without
  // dealing the same card twice, and `deck()` in src/learn/generators.js draws
  // only from the framings it has served least.
  'ctx.pods': 'A drop-pod takes exactly ${v}$ cadets. {k} pods empty the bay.',
  'ctx.trays': 'A tray raises ${v}$ seedlings, always. {k} trays go up to the ring.',
  'ctx.spools': 'One spool of tether pays out ${v}$ metres. The rig carries {k} spools.',
  'ctx.rations': 'A ration crate feeds one cadet for ${v}$ days. {k} crates are signed out.',
  'ctx.flares': 'A survey flare burns for ${v}$ seconds, never longer. {k} flares hang on the mast.',
  'ctx.ballast': 'A ballast block masses ${v}$ tonnes. {k} blocks go into the keel.',
  'ctx.charge': 'A survey skiff drifts out on {b} percent charge and loses {a} percent a minute.',
  'ctx.coolant': 'A coolant loop comes on shift at {b} degrees and sheds «a|one:# degree|other:# degrees» a minute.',
  'ctx.tether': 'A tether starts with {b} metres out, and the winch takes back {a} a minute.',
  'ctx.alphabetClaim': 'Cadet {who} read ${v}$ off the alphabet. The manifest says ${v} = {val}$.',
  'ctx.claimRoster': 'The roster prints ${v}$, so Cadet {who} counted the alphabet. The manifest says ${v} = {val}$.',
  'ctx.claimOldRig': 'An old training rig taught Cadet {who} the alphabet trick. The live manifest reads ${v} = {val}$.',
  'ctx.claimBet': 'Cadet {who} bets a week of galley duty on the alphabet. The manifest reads ${v} = {val}$.',
  'ctx.beacon': 'A beacon has drifted for a week, and the chart kept every minute.',
  'ctx.balloonChart': 'A survey balloon has climbed since first light, and the chart has it all.',
  'ctx.winchChart': 'The winch drew its own chart all shift: one straight run.',
  'ctx.twoBeacons': 'Two beacons, two drifts, one chart. Somewhere they read the same.',
  'ctx.twoLifts': 'Two lifts, two rates, one chart. For one instant they stood level.',
  'ctx.beamOne': 'The cargo beam hangs level: one sealed crate and {b} counterweights against {c} counterweights.',
  'ctx.assayOne': 'The assay scale sits level: one unopened canister and {b} counterweights against {c} counterweights.',
  'ctx.beamMany': 'The cargo beam hangs level: {k} sealed crates against {c} counterweights.',
  'ctx.assayMany': 'The assay scale sits level: {k} canisters against {c} counterweights.',
  'ctx.nested': 'A drop-pod takes ${v}$ cadets. A skiff takes {a} pods. {b} skiffs stand full.',
  'ctx.nestedTrays': 'A tray raises ${v}$ seedlings. A rack holds {a} trays. {b} racks stand full.',
  'ctx.nestedVials': 'A vial holds ${v}$ doses. A case takes {a} vials. {b} sealed cases came down.',
  'ctx.nestedStruts': 'One strut spans ${v}$ metres. A section is {a} struts. The bridge is {b} sections.',
  'ctx.cargo': 'The hold gauge has no memory. {b} tonnes went out, and it reads {c}.',
  'ctx.silo': 'The grain silo has no memory. {b} tonnes were drawn off, and it reads {c}.',
  'ctx.reservoir': 'The reservoir gauge is a level, not a history. {b} tonnes went out; it reads {c}.',
  'ctx.crates': '{k} crates off the same line — sealed, identical, and {c} tonnes between them.',
  'ctx.drums': '{k} drums off the same fill line — sealed, identical, {c} tonnes between them.',
  'ctx.pallets': '{k} pallets came out of one press: same mould, same mass, {c} tonnes in all.',
  'ctx.dockFee': 'The dock takes {b} credits to clamp on, then {a} a cycle.',
  'ctx.hangarFee': 'The hangar takes {b} credits to close the doors, then {a} a cycle.',
  'ctx.tugFee': 'The tug takes {b} credits to make fast, then {a} a cycle.',
  'ctx.crew': 'Each of {k} crews logs «a|one:# shift|other:# shifts» a rotation, plus «b|one:# shift|other:# shifts» on watch.',
  'ctx.watches': 'Each of {k} watches logs «a|one:# shift|other:# shifts» a rotation, plus «b|one:# shift|other:# shifts» on the rail.',
  'ctx.plate': 'A hull plate is {w} across and {h} down. The seam runs right round.',
  'ctx.hatch': 'A pressure hatch is {w} across and {h} down. The seal runs right round.',
  'ctx.panel': 'A shield panel stands {k} units tall. Its width {w} was cast in two strips.',
  'ctx.bulkhead': 'A bulkhead stands {k} units tall. Its width {w} was cast in two strips.',
  'ctx.plans': 'Plan A: {b} credits, then {a} a run. Plan B: {e}, then {c} a run.',
  'ctx.hauliers': 'Haulier A: {b} credits, then {a} a run. Haulier B: {e}, then {c} a run.',
  'ctx.dispute': 'Cadet {one} makes it {a}. Cadet {two} makes it {b}. Both cannot be right.',
  'ctx.disputeBoard': 'Cadet {one} chalks {a}. Cadet {two} writes {b} underneath and underlines it.',
  'ctx.disputeAudit': 'The line carries {a} from Cadet {one} and {b} from Cadet {two}. The audit takes one.',
  'ctx.disputeSolve': 'Cadet {one} divides and gets {a}. Cadet {two} subtracts and gets {b}.',
  'ctx.disputeUndo': 'Cadet {one} divides and lands on {a}. Cadet {two} subtracts and lands on {b}.',
  'ctx.disputeExpand': 'Cadet {one} multiplies {a} and {b} by {k}. Cadet {two} multiplies only {a}.',
  'ctx.disputeReach': 'Cadet {one} sends the {k} to {a} and {b}. Cadet {two} sends it only to {a}.',

  // ---- the logs ----------------------------------------------------------
  // Every one of these is the same mathematical object — one rule, four lines,
  // one line burned — and every one of them is a different instrument, because
  // the header of the column has to mean something before reading down it does.
  'ctx.logDrone': 'The survey drone log made every row from the rule at the top. One row burned away.',
  'ctx.logCore': 'The core log derives every row from the rule in its header. One row is blank.',
  'ctx.logTwoSensors': 'Two sensors write into one column, so its header is a sum. One row burned away.',
  'ctx.logBanks': 'The header measures one bank of the array, then multiplies up for all of them. One row burned away.',
  'ctx.logAirlock': 'The airlock log pairs what went in with what came out. One line lost its input.',
  'ctx.logGain': 'The gain stage log pairs what went in with what came out. One line lost its input.',
  'ctx.logFab': 'The fabricator log pairs what went in with what came out. One line lost its input.',
  'ctx.dockLog': 'One cycle on the strip is blank.',
  'ctx.logTide': 'The tide log computes every row from the rule above it. One row has gone.',
  'ctx.logKiln': 'The kiln log made every row from the rule at the top. One row was scrubbed out.',
  'ctx.logRelay': 'The relay log derives every row from the rule in its header. One row came back empty.',
  'ctx.logOrchard': 'The orchard log computes every row from the rule above it. One row washed off.',
  'ctx.logTwoCrews': 'Two crews write into one column, so its header is a sum. One row is blank.',
  'ctx.logTwoFeeds': 'Two feeds write into one column, so its header is a sum. One row has gone.',
  'ctx.logPerCrate': 'The header measures one crate, then multiplies up for all of them. One row is blank.',
  'ctx.logPerDeck': 'The header measures one deck, then multiplies up for all of them. One row has gone.',
  'ctx.logRefinery': 'The refinery log pairs what went in with what came out. One line lost its input.',
  'ctx.logCourier': 'The courier log pairs what went in with what came out. One line lost its input.',
  'ctx.hangarLog': 'One cycle on the strip is empty.',
  'ctx.tugLog': 'One cycle on the strip shows nothing.',

  // ---- reasons attached to worked lines ----------------------------------
  'why.juxtaposition': 'A number written against a letter means multiply — {k} lots of ${v}$.',
  'why.substituteHere': 'Put {val} wherever ${v}$ stands.',
  'why.substituteThenMultiply': 'Put {val} in place of ${v}$, then multiply.',
  'why.substituteBoth': 'Both known values go in at once.',
  'why.countGroups': 'That is {k} equal groups, counted up.',
  'why.onePodEach': 'One and the same ${v}$, once for every one of the {k} — which is ${v}$ added to itself {k} times.',
  'why.groupsMeansTimes': '"{k} groups of ${v}$" is {k} times ${v}$.',
  'why.readRule': 'Every surviving row obeys the same rule.',
  'why.applySameRule': 'Apply that rule to the row that burned.',
  'why.letterIsNotPosition': 'Where ${v}$ sits in the alphabet has nothing to do with its value. The manifest decides.',
  'why.multiplyThenAdd': 'Multiplication is settled before addition.',
  'why.divideThenAdd': 'Divide first — the bar holds the top together.',
  'why.findColumn': 'Go along to the column where $x = {val}$.',
  'why.readHeight': 'Read the height of the trace there.',
  'why.timesBeforePlus': 'Multiplication binds tighter than addition.',
  'why.thenAdd': 'Now the addition.',
  'why.powersFirst': 'Powers are settled first.',
  'why.thenTimesThenMinus': 'Then multiply, then subtract.',
  'why.bracketTakesSign': 'The bracket carries the minus inside, so the minus is squared too.',
  'why.powerBeforeMinus': 'With no bracket the power reaches only the {c}; the minus stays outside it.',
  'why.fracBarGroups': 'A fraction bar is a bracket — finish the top first.',
  'why.thenDivide': 'Now divide by {c}.',
  'why.gatherSameKind': 'Bring the ${v}$-terms next to each other.',
  'why.numbersAndLettersSeparate': 'A bare number and a ${v}$-term never merge into one.',
  'why.addCoefficients': 'Add the counts standing in front.',
  'why.onlySameKindCombine': 'Only terms of the same kind combine.',
  'why.squaredIsItsOwnKind': '${v}$ squared is a different kind of term from ${v}$, and keeps its own count.',
  'why.doubleEachSide': 'Two of each side.',
  'why.everyTermInside': 'The factor outside reaches every term inside.',
  'why.multiplyEachOut': 'Multiply each part out.',
  'why.twoRectangles': 'It is two rectangles standing side by side, and their areas add.',
  'why.minusIsTimesMinusOne': 'A bare minus in front is multiplying by negative one.',
  'why.everySignFlips': 'So every sign inside flips.',
  'why.commonFactor': 'Both terms carry a factor of {k}.',
  'why.pullOutFront': 'Pull the {k} out in front.',
  'why.undoBothSides': '{op} {n} on both sides — the beam stays level.',
  'why.takeSameOffBoth': 'Take {n} off both pans at once.',
  'why.putBackWhatWasTaken': 'Put the {n} tonnes back on both sides.',
  'why.balanceHolds': 'Still level, and the unknown is standing alone.',
  'why.rowIsEquation': 'That row is an equation waiting to be undone.',
  'why.divideBothByCoef': 'Divide both sides by {a}.',
  'why.oneGroupWeighs': 'That is what a single one is worth.',
  'why.multiplyBothBy': 'Multiply both sides by {k}.',
  'why.shareEqually': 'Share the total between {k} equal parts.',
  'why.coefIsTimesNotPlus': 'The {a} against the letter means times, so it comes off by dividing, not subtracting.',
  'why.unwrapConstantFirst': 'Unwrap in reverse: the loose number goes first.',
  'why.whatIsLeft': 'What is left after that.',
  'why.whatIsLeftIsCycles': 'What is left is the cost of the cycles alone.',
  'why.removeFlatFee': 'Take off the {b} credits that were charged once, up front — both sides at the same time.',
  'why.perCycleTimesCycles': '{a} credits for each cycle it ran.',
  'why.plusFlatFeeEqualsTotal': 'Plus the {b} up front, and the bill is {c}.',
  'why.expandFirst': 'Open the bracket first.',
  'why.collectConstants': 'Collect the loose numbers.',
  'why.simplifySideFirst': 'Simplify the side completely before undoing anything.',
  'why.gatherUnknownOneSide': 'Take {term} off both sides, so the unknown lives on one side only.',
  'why.identityBothSidesSame': 'The two sides were the same statement all along — every value holds it true.',
  'why.contradictionNoValue': 'The unknown has vanished and left something false behind. No value can rescue it.',
  'why.meetMeansEqual': 'Where the traces cross, the two readings are equal.',
  'why.heightIsEquation': 'Height {val} turns the chart into an equation.',
  'why.perCycle': '{a} credits per cycle.',
  'why.groupsOfGroups': '{a} inside each one, and {b} of those, so it is {a} times {b} in all.',
  'why.squareTheValueFirst': 'Square the substituted value first — {val} times itself.',
  'why.deepestBracketFirst': 'Inside the bracket, the multiplication goes first.',
  'why.finishTheBracket': 'Finish the bracket before anything outside it.',
  'why.thenTheFactorOutside': 'Only now does the {a} outside reach it.',
  'why.barSharesEveryTerm': 'One bar over a sum is a bar over each term: every term is shared by {k}.',
  'why.divideEachTerm': 'Divide each term by {k} in turn.',
  'why.whatLeftTheHold': '{b} tonnes went out, so whatever it started at is reduced by {b}.',
  'why.andThatIsTheGauge': 'And what is left is what it reads now: {c}.',

  // ---- special answers ---------------------------------------------------
  'answer.noSolution': 'no solution',
  'answer.allValues': 'every value works',

  'word.add': 'Add',
  'word.subtract': 'Subtract',

  // ---- learning-surface furniture ---------------------------------------
  'ui.echo': 'Echo — a cadet who came this way before',
  'ui.echoFaded': 'Echo — the last line is yours',
  'ui.yourTurn': 'Now the live rift',
  'ui.blank': 'your line',
  'ui.proving': 'Proving run {n} of {m}',
  'ui.retrieval': 'Holding the lattice below',
  'ui.review': 'Old ground, revisited',

  // ---- the echo: what a slip is answered with ----------------------------
  // Layer one is never commentary. It is the cadet's own entry put back into
  // the statement, and the statement refusing it.
  'echo.substituteYours': 'Put your ${v} = {val}$ back where the unknown stood, and weigh both pans again.',
  'echo.sidesDisagree': 'The pans come out different, so the beam tips. That value is not the one holding it level.',
  'echo.notThatNumber': 'Work that out for yourself, in that order, and it does not come to {val}.',
  'echo.yourReadingAt': 'Take ${v} = {t}$. The line you wrote comes to {val} there.',
  'echo.countItByHand': 'Now work out the rift itself at ${v} = {t}$, one term at a time. It does not come to {val} — and two lines that are the same thing cannot disagree anywhere.',
  'echo.yourModelSays': 'That is the statement you signed. Read it back as a sentence about ${v}$ and see whether it is the story you were told.',
  'echo.yourModelNames': 'Follow it to the end and it names ${v} = {val}$. Take that number back to the situation and see whether the story can carry it.',
  'echo.whereItStands': 'This is what the move left standing. The unknown is no freer than it was before you made it.',
  'echo.thatMergeSays': 'That is the statement your move would have signed. Put any number in for the letter and it comes apart in your hands.',

  // Aim. A linear beam tips one way when the unknown is set high and the other
  // when it is set low, so which way it tipped is a fact — and it is the fact
  // that says what to do next, without saying what the value is.
  'echo.aimedHigh': 'It tips the way it tips when the unknown has been set too high. Whatever the beam wants, it is under {val}.',
  'echo.aimedLow': 'It tips the way it tips when the unknown has been set too low. Whatever the beam wants, it is over {val}.',

  // Evaluation. Three different slips, three different answers — the reading a
  // power actually asks for, the brackets a left-to-right reader drew in
  // without noticing, and the input that would have made their number right.
  'echo.powerIsCopies': 'A power counts copies. The small number says how many {base}s are multiplied together — it is not something to multiply {base} by.',
  'echo.bracketsYouAdded': 'Those are the brackets you read into it, closing each operation as you met it. Nothing on the page put them there, and where they sit changes what the line is worth.',
  'echo.yoursNeeds': 'Your number is not nonsense — it is the reading this gives when ${v} = {need}$. But the rift fixes ${v} = {val}$.',

  // Logs. One rule wrote every line, so between any two lines the reading
  // climbs at one rate. The fractions are left unworked on purpose: working
  // them out is the whole of the lesson.
  'echo.everyPairSameRate': 'One rule wrote every line of this log, so between any two lines the reading climbs at one rate. Here it is, taken across lines that survived the burn.',
  'echo.yourRateBreaksIt': 'And here it is measured across the number you handed in. Work both out: they do not agree, and nothing in this log changes pace at the line that burned.',
  'echo.sameInputTwice': 'The log already gives that reading, at a different input. One rule wrote every line, and a rule that moves at all cannot hand back the same reading twice.',
  'echo.sameOutputTwice': 'That input already has a line of its own further down the log, and that line does not read what this one reads.',

  // Rewriting. An identity is refuted by one number, and one number is what
  // the cadet is handed.
  'echo.mustAgreeAt': 'You may change how it is written. You may not change what it is worth. This is the rift with {t} in place of ${v}$ — work it out, then work your line out the same way. They have to come to the same number.',
  'echo.oneNumberBreaksIt': 'Two expressions that are the same thing agree at every value. Put ${v} = {t}$ into both sides of that claim and it comes apart in one step.',

  // The beam, mid-solve. Either the move changed which number the beam is
  // about — provable, and proved — or it was legal and got nowhere, in which
  // case the useful thing to say is what is still standing in the way.
  'echo.moveNames': 'The line your move left standing is about ${v} = {val}$.',
  'echo.moveChangedIt': 'And that number does not hold the rift you were given level. The move undid nothing — it swapped the question for a different one.',
  'echo.stillBothSides': 'True, and no nearer. ${v}$ is still standing on both pans, and nothing is settled until it stands on one.',
  'echo.stillTwoThings': 'True, and no nearer. Two things are still wrapped round ${v}$: one added to it, one multiplying it. The added one comes off first.',
  'echo.stillMultiplied': 'True, and one move from done. ${v}$ stands alone but multiplied by {a}, and multiplying comes off by dividing — both pans at once.',
  'echo.stillAdded': 'True, and one move from done. Something is still added to ${v}$. Take it off both pans at once.',
  'echo.tryYourReading': 'Put your ${v} = {t}$ into the statement the rift is holding open.',
  'echo.thatIsNotTrue': 'That is not true, so your value is not in the set at all.',
  'echo.thatIsTrue': 'That is true, so this value belongs in the set — and your statement leaves it out.',
  'echo.tryOneStepFurther': 'Now take ${v} = {t}$, one step further along, and put that in instead.',
  'echo.oneLowerAlsoWorks': 'That works as well. A value with a smaller one still working is not the smallest.',
  'echo.oneHigherAlsoWorks': 'That works as well. A value with a larger one still working is not the largest.',
  'echo.yourSetLetsThrough': 'Your statement lets ${v} = {t}$ through. Put that value into the rift itself.',
  'echo.yourSetShutsOut': 'Your statement shuts ${v} = {t}$ out. Put that value into the rift itself.',
  'echo.crossProductsMatch': 'Two ratios agree exactly when the two products across the bars agree. Here they are with your number in.',
  'echo.yourNumberBreaksTheRatio': 'Work both out: they are not the same number, so those two ratios are not the same ratio.',
  'echo.putYourPairIn': 'Take $x = {x}$ and $y = {y}$, and put both of them into the second statement.',
  'echo.oneStatementRefusesIt': 'The two sides come out different. A pair has to hold both statements, not one.',
  'echo.pinTheOtherLetters': 'Pin every other letter to a number. The formula then names one value of ${v}$, and so does your form.',
  'echo.yourFormDisagrees': 'Yours comes to that. The formula above does not, so the two are not the same rule for ${v}$.',
  'echo.yourRuleAt': 'Run your rule at $x = {t}$, which is one of the readings it has to pass through.',
  'echo.yourRuleMissesReading': 'The reading at $x = {t}$ is not that number, so your rule passes somewhere else.',
  'echo.rateBetweenTheReadings': 'A straight rule climbs at one rate. This is the climb and the step across, taken between the two readings.',
  'echo.yourRateWouldNeed': 'And this is what the climb would have to be for your rate. Work both sides out: they do not agree.',
  'echo.justOutsideTheBand': 'Take ${v} = {t}$, one step outside the band, and read the statement there.',
  'echo.justInsideTheBand': 'Now the value one step in. One of these belongs to the band and one does not — and the band ends where that changes.',
  'echo.thePointIsNotOnIt': 'The two sides come out different, so that point is not on the line the statement draws.',
  'echo.theTear': 'This is what the rift is asking, and nothing more than this.',
  'echo.differentTear': 'A different rift, the same shape. This is how far it has been dug out.',
  'echo.ownTraceOnly': 'The rig holds no other rift of this shape. This is your own line, read back to you, and the last of it stays yours.',
  'echo.landingBurned': 'Where it landed burned away with the rest of the rift.',
  'echo.landsAt': 'And that is the value that rift came to rest on. A different rift. A different number.',

  // No unique value at all. A contradiction differs by the same amount wherever
  // you look; an identity agrees wherever you look. Two substitutions each.
  'echo.tryOneNumber': 'Put ${v} = {t}$ into both sides and weigh them.',
  'echo.gapNeverCloses': 'And again, with a different number, and the two sides are exactly as far apart as before. The gap does not depend on ${v}$ at all, so no value of ${v}$ can close it.',
  'echo.tryOneNumberHolds': 'Put ${v} = {t}$ into both sides and weigh them.',
  'echo.holdsEverywhere': 'And again, with a different number, and it holds again. The two sides are one statement written twice — there is nothing here to solve, only something to notice.',

  // A chart is a log you can see.
  'echo.traceOneRate': 'A straight trace climbs at one rate for its whole length. This is that rate, taken between the two points the chart marks.',
  'echo.yourPointBreaksIt': 'And this is the rate you would have to climb at to reach the point you handed in. Work both out: they are not the same, so your point is off the trace.',

  // A log whose burned cell is an input: the rule is at the head of the column,
  // so run their number through it and read what the log would have written.
  'echo.runItThroughTheRule': 'Take your {val} and run it through the rule at the head of the column, exactly as every surviving line was made.',
  'echo.ruleRefusesYours': 'That is what the log would have written on that line. The line reads {y}.',


  // The oldest slip on the graph, and the one everything else is built on.
  'echo.sideBySideIsNotTimes': 'Setting {a} against {b} makes a two-digit number. Multiplying them does not. A number written against a letter says multiply — it has never meant "write them next to each other".',
  'echo.minusOutsideThePower': 'Those are the two readings, and they are not the same number. Without a bracket the power reaches only the digits; the minus is applied afterwards, to whatever the power came to.',


  'ctx.filedTwice': 'Two survey teams filed the same quantity, written two ways. The rig takes one.',
  'ctx.twoForms': 'The same quantity was filed twice, on two forms. The rig takes one line.',
  'ctx.asPallets': 'The loading rig needs a count of identical pallets, and what is in one.',
  'ctx.asRacks': 'The stores rig needs a count of identical racks, and what stands in one.',
  'ctx.dockBill': 'The dock bill lost its working: {b} credits to clamp on, then {a} a cycle.',
  'ctx.hangarBill': 'The hangar bill lost its working: {b} credits to close the doors, then {a} a cycle.',
  'ctx.tugBill': 'The tow bill lost its working: {b} credits to make fast, then {a} a cycle.',

  // =========================================================================
  // The wide shard.
  //
  // A deck of six framings sounds like variety and is not: a uniform draw from
  // six shows a cadet the same sentence twice inside ten items, and measured on
  // the shipping schedule the first forty-five items of a session used to
  // contain fourteen distinct situations with one of them served eight times.
  // By the third repeat nobody is reading the words any more, and a contextual
  // item nobody reads is a symbolic item wearing a hat.
  //
  // So every deck below is wide enough to deal itself out across a whole
  // session without dealing any card twice, and `deck()` in generators.js draws
  // only from the framings it has served least. Each one is a different corner
  // of the shard with its own noun, its own unit and its own question, and the
  // algebra underneath cannot tell any of them apart.
  // =========================================================================

  // ---- units a count can come out in -------------------------------------
  'ask.howManyLitres': 'If ${v} = {val}$, how many litres is that?',
  'ask.howManyWatts': 'If ${v} = {val}$, how many watts does that come to?',
  'ask.howManySamples': 'If ${v} = {val}$, how many samples come up?',
  'ask.howManyMinutes': 'If ${v} = {val}$, how many minutes is that?',
  'ask.howManyPackets': 'If ${v} = {val}$, how many packets get through?',
  'ask.howManyPanes': 'If ${v} = {val}$, how many panes is that?',
  'ask.howManyBricks': 'If ${v} = {val}$, how many bricks come out?',
  'ask.howManyCells': 'If ${v} = {val}$, how many cells is that?',
  'ask.howManyKilometres': 'If ${v} = {val}$, how many kilometres is that?',
  'ask.howManyHours': 'If ${v} = {val}$, how many hours does that make?',
  'ask.howManyGrams': 'If ${v} = {val}$, how many grams is that?',
  'ask.howManyRivets': 'If ${v} = {val}$, how many rivets is that?',
  'ask.howManyFrames': 'If ${v} = {val}$, how many frames came down?',
  'ask.howManyReadings': 'If ${v} = {val}$, how many readings is that?',
  'ask.howManyLumens': 'If ${v} = {val}$, how many lumens is that?',
  'ask.howManyDegrees': 'If ${v} = {val}$, how many degrees is that?',
  // A question names the noun the situation above it counted, and no other.
  // These exist because the questions above them were being shared by
  // situations that count something else: a hull patch is measured in plates
  // of skin and not in window panes, an ore skip lifts out of the cut and not
  // into a keel, a sounding buoy makes noise and not light. See the unit table
  // in tools/check-context-ask.mjs, which fails the build on a disagreement.
  'ask.howManyPlates': 'If ${v} = {val}$, how many plates is that?',
  'ask.howManyTonnesRaised': 'If ${v} = {val}$, how many tonnes comes out of the cut?',
  'ask.howManyTonnesBarged': 'If ${v} = {val}$, how many tonnes goes onto the barge?',
  'ask.howManySecondsPing': 'If ${v} = {val}$, how many seconds of pinging?',
  'ask.howManyDaysAir': 'If ${v} = {val}$, how many days of air is that?',
  'ask.howManyFramesHeld': 'If ${v} = {val}$, how many frames is that?',
  'ask.howManyDosesStowed': 'If ${v} = {val}$, how many doses are stowed forward?',
  'ask.howManySeedlingsPlanted': 'If ${v} = {val}$, how many seedlings come out for planting?',

  // ---- k identical things, each holding exactly v ------------------------
  'ctx.waterCans': 'A water can takes ${v}$ litres, not a drop more. {k} cans go onto the sled.',
  'ctx.fuelCells': 'A fuel cell puts out ${v}$ watts, hot or cold. The rack holds {k} cells.',
  'ctx.coreTubes': 'One core tube comes up with ${v}$ samples. {k} tubes went down the bore.',
  'ctx.oxyCandles': 'An oxygen candle burns for ${v}$ minutes exactly. The locker holds {k} candles.',
  'ctx.relayWindows': 'The relay clears ${v}$ packets in one window, then shuts. {k} windows open today.',
  'ctx.glazing': 'A glazing frame takes ${v}$ panes. {k} frames wait out on the ring.',
  'ctx.brickMoulds': 'One mould casts ${v}$ water bricks a pour. {k} moulds lie on the drying floor.',
  'ctx.lampCells': 'A lamp stack takes ${v}$ cells in series. {k} stacks must be up by dark.',
  'ctx.sledRuns': 'A sled run covers ${v}$ kilometres of trench. {k} runs are logged for today.',
  'ctx.watchGlass': 'A watch is ${v}$ hours long, by ancient decree. {k} watches fill the rotation.',
  'ctx.crucibles': 'One crucible takes ${v}$ grams of ore. {k} crucibles go into the furnace.',
  'ctx.bunks': 'A bunk module sleeps ${v}$ cadets. {k} modules are bolted along the spine.',
  'ctx.medPacks': 'A med pack carries ${v}$ sealed doses. {k} packs came off the lift.',
  'ctx.cableDrums': 'A cable drum holds ${v}$ metres, wound at the works. {k} drums are chained to the deck.',
  'ctx.oreSkips': 'A skip lifts ${v}$ tonnes out of the cut. {k} skips are on the line.',
  'ctx.seedVaults': 'A vault drawer holds ${v}$ seedlings in stasis. {k} drawers come out for planting.',
  'ctx.filters': 'A filter cartridge lasts ${v}$ days on air like this. {k} cartridges are left.',
  'ctx.pulses': 'The beacon pulses for ${v}$ seconds, then rests. One sweep is {k} pulses.',
  'ctx.resinSpools': 'A resin spool prints ${v}$ rivets, then asks for another. {k} spools are loaded.',
  'ctx.ladderSections': 'A ladder section climbs ${v}$ metres. {k} sections stand between the shaft and daylight.',
  'ctx.stormShutters': 'A storm shutter covers exactly ${v}$ panes. {k} shutters go up before the front.',
  'ctx.telemetry': 'One telemetry burst carries ${v}$ frames. {k} bursts came down overnight.',
  'ctx.solarShingles': 'A solar shingle returns ${v}$ watts at this distance. {k} shingles cover the south face.',
  'ctx.kilnFirings': 'A firing takes ${v}$ hours from cold to cold. {k} firings are booked this week.',
  'ctx.iceCores': 'One ice core gives ${v}$ readings, one per annual band. {k} cores wait in the cold room.',
  'ctx.mantles': 'A lamp mantle throws ${v}$ lumens. {k} mantles hang along the gallery.',
  'ctx.thermalWraps': 'A thermal wrap keeps ${v}$ degrees in the line. {k} wraps are fitted this shift.',
  'ctx.ropeCoils': 'A coil of line is ${v}$ metres, measured at the ropewalk. {k} coils are struck below.',

  // ---- b groups of a groups of v -----------------------------------------
  'ctx.nestedCells': 'A fuel cell gives ${v}$ watts. A bank takes {a} cells. {b} banks are live.',
  'ctx.nestedCores': 'One core tube holds ${v}$ samples. A carrier takes {a} tubes. {b} carriers went down.',
  'ctx.nestedBricks': 'A mould casts ${v}$ bricks a pour. A pour runs {a} moulds. {b} pours are scheduled.',
  'ctx.nestedCans': 'A water can holds ${v}$ litres. A crate takes {a} cans. {b} full crates are lashed down.',
  'ctx.nestedPacks': 'A med pack carries ${v}$ doses. A locker holds {a} packs. {b} lockers are stowed.',
  'ctx.nestedCable': 'A drum holds ${v}$ metres of cable. A cart carries {a} drums. {b} carts went out.',
  'ctx.nestedBunks': 'A bunk module sleeps ${v}$ cadets. A deck takes {a} modules. The spine carries {b} decks.',
  'ctx.nestedPanes': 'A glazing frame takes ${v}$ panes. A bay is {a} frames. The ring has {b} open bays.',

  // ---- somebody has decided a letter is worth its place in the alphabet ---
  'ctx.claimPrimer': 'Cadet {who} took ${v}$ from a numbered alphabet in an old primer. The manifest says ${v} = {val}$.',
  'ctx.claimGraffiti': 'Somebody numbered the alphabet on the bulkhead, and Cadet {who} counted along. The manifest says ${v} = {val}$.',
  'ctx.claimBunkmate': 'A bunkmate told Cadet {who} that the alphabet gives the value. The manifest says ${v} = {val}$.',
  'ctx.claimBroadcast': 'A repair broadcast sold Cadet {who} the alphabet trick. The manifest reads ${v} = {val}$.',
  'ctx.claimTag': 'The cargo tag says ${v}$, so Cadet {who} counted the alphabet. The manifest says ${v} = {val}$.',
  'ctx.claimDrill': 'Cadet {who} answered from the alphabet during the drill. The manifest says ${v} = {val}$.',
  'ctx.claimLedger': 'Cadet {who} reads an old letter-and-number ledger as a conversion table. The manifest says ${v} = {val}$.',
  'ctx.claimSong': 'Cadet {who} can sing the alphabet fast, and did. The manifest says ${v} = {val}$.',

  // ---- one rule at the head of a column, one reading destroyed ------------
  'ctx.logSonde': 'The sonde log made every row from the rule at the top. One row was lost.',
  'ctx.logCentrifuge': 'The centrifuge log derives every row from the rule in its header. One row is missing.',
  'ctx.logMill': 'The mill log computes every row from the rule above it. One row burned away.',
  'ctx.logHatchery': 'The hatchery log made every row from the rule at the top. One row is blank.',
  'ctx.logAssay': 'The assay log derives every row from the rule in its header. One row has gone.',
  'ctx.logFurnace': 'The furnace log computes every row from the rule above it. One row was scrubbed out.',
  'ctx.logPress': 'The press log made every row from the rule at the top. One row came back empty.',
  'ctx.logConveyor': 'The conveyor log derives every row from the rule in its header. One row washed off.',
  'ctx.logAntenna': 'The antenna log computes every row from the rule above it. One row was lost.',
  'ctx.logGlacier': 'The glacier log made every row from the rule at the top. One row is missing.',
  'ctx.logStill': 'The still log derives every row from the rule in its header. One row burned away.',
  'ctx.logLoom': 'The loom log computes every row from the rule above it. One row is blank.',
  'ctx.logForge': 'The forge log made every row from the rule at the top. One row has gone.',
  'ctx.logHive': 'The hive log derives every row from the rule in its header. One row was scrubbed out.',
  'ctx.logSpring': 'The spring log computes every row from the rule above it. One row came back empty.',
  'ctx.logDynamo': 'The dynamo log made every row from the rule at the top. One row washed off.',

  // ---- the header is a sum, because two things write into it -------------
  'ctx.logTwoWells': 'Two wells write into one column, so its header is a sum. One row was scrubbed out.',
  'ctx.logTwoShifts': 'Both shifts write into one column, so its header is a sum. One row came back empty.',
  'ctx.logTwoStills': 'Two stills write into one column, so its header is a sum. One row washed off.',
  'ctx.logTwoMasts': 'Two masts write into one column, so its header is a sum. One row was lost.',
  'ctx.logTwoBelts': 'Two belts write into one column, so its header is a sum. One row is missing.',

  // ---- the header measures one unit and multiplies up --------------------
  'ctx.logPerCoil': 'The header measures one coil, then multiplies up for all of them. One row was scrubbed out.',
  'ctx.logPerBay': 'The header measures one bay of the ring, then multiplies up for all of them. One row came back empty.',
  'ctx.logPerRow': 'The header measures one row of the field, then multiplies up for all of them. One row washed off.',
  'ctx.logPerSled': 'The header measures one sled of the train, then multiplies up for all of them. One row was lost.',
  'ctx.logPerHive': 'The header measures one hive, then multiplies up for all of them. One row is missing.',

  // ---- in and out, and it is the input that burned -----------------------
  'ctx.logStamp': 'The stamping press log pairs what went in with what came out. One line lost its input.',
  'ctx.logDye': 'The dye bath log pairs what went in with what came out. One line lost its input.',
  'ctx.logTuner': 'The tuner log pairs what went in with what came out. One line lost its input.',
  'ctx.logMint': 'The mint log pairs what went in with what came out. One line lost its input.',
  'ctx.logSmelter': 'The smelter log pairs what went in with what came out. One line lost its input.',

  // ---- something that starts at b and loses a of itself a minute ---------
  'ctx.airReserve': 'A suit goes out with {b} minutes of air and spends {a} of them a minute.',
  'ctx.hopper': 'The seed hopper starts a pass at {b} measures and lets {a} go each minute.',
  'ctx.lampOil': 'A gallery lamp is filled to {b} and burns {a} off every minute.',
  'ctx.iceShelf': 'The shelf edge stands {b} metres high and calves «a|one:# metre|other:# metres» off each minute.',
  'ctx.stipend': 'A shore stipend starts at {b} credits and drops {a} for every minute queueing.',
  'ctx.frostLine': 'The frost line sits at {b} and retreats {a} every minute the sun is on it.',
  'ctx.signalLoss': 'The relay comes up at {b} percent and loses {a} percent every minute of storm.',
  'ctx.waterHead': 'The water head starts the shift at {b} and drops {a} every minute.',
  'ctx.paintReel': 'A marking reel starts with {b} metres of paint and lays {a} down each minute.',

  // ---- one straight trace, drawn for you, all the way along --------------
  'ctx.sledChart': 'A sled has run the trench since dawn, and the chart kept every minute.',
  'ctx.tideChart': 'The shard has a tide, and one straight run is drawn across its chart.',
  'ctx.kiteChart': 'A survey kite paid out line all afternoon, and the plotter drew every metre.',
  'ctx.drillChart': 'The drill cut at one steady rate all shift, and the chart holds the descent.',
  'ctx.cableChart': 'The cable was laid at one pace, and the chart has all of it.',
  'ctx.frostChart': 'The frost came down the wall at one rate, and somebody charted it.',
  'ctx.glideChart': 'A glider lost height at one steady rate, and the chart caught the run.',
  'ctx.twoSleds': 'Two sleds, two paces, one chart. Somewhere they were briefly level.',
  'ctx.twoDrills': 'Two drills, two rates, one chart. For one moment they stood at one depth.',
  'ctx.twoBalloons': 'Two balloons, two climbs, one chart. There is an instant with nothing between them.',
  'ctx.twoTides': 'Two channels, two tides, one chart. For a moment the gauges matched.',

  // ---- a store that reports the present and never recorded the past ------
  'ctx.bunker': 'The ore bunker reports now, never before. {b} tonnes went up the hoist; it reads {c}.',
  'ctx.cistern': 'The cistern gauge is a level, not a ledger. {b} tonnes were drawn; it reads {c}.',
  'ctx.saltPan': 'The salt pan is weighed, never remembered. {b} tonnes were carted off; the scale reads {c}.',
  'ctx.icehouse': 'The icehouse scale knows today and nothing before. {b} tonnes went to the galley; it reads {c}.',
  'ctx.tailings': 'The tailings scale reports the pile as it stands. {b} tonnes were hauled out; it reads {c}.',
  'ctx.stockpile': 'The stockpile pad has no memory. {b} tonnes were loaded out; the pad reads {c}.',
  'ctx.feedBin': 'The feed bin gives a weight, not a history. {b} tonnes went up; it reads {c}.',
  'ask.startingBunker': 'What did the bunker hold before?',
  'ask.startingCistern': 'How full was the cistern before the wash?',
  'ask.startingSaltPan': 'What was on the pan before?',
  'ask.startingIce': 'What did the icehouse hold before?',
  'ask.startingTailings': 'How big was the pile before the haul?',
  'ask.startingStockpile': 'What was on the pad before loading?',
  'ask.startingFeed': 'What was in the bin before this morning?',
  'ask.whichEquationBunker': 'Which equation says what happened in the bunker?',
  'ask.whichEquationCistern': 'Which equation says what happened to the cistern?',
  'ask.whichEquationSaltPan': 'Which equation says what happened on the pan?',
  'ask.whichEquationIcehouse': 'Which equation says what happened in the icehouse?',
  'ask.whichEquationTailings': 'Which equation says what happened to the pile?',
  'ask.whichEquationStockpile': 'Which equation says what happened on the pad?',
  'ask.whichEquationFeedBin': 'Which equation says what happened in the bin?',

  // ---- a level beam, and one thing on it nobody has opened ---------------
  'ctx.beamSack': 'The grain beam hangs level: one sealed sack and {b} counterweights against {c} counterweights.',
  'ctx.beamCask': 'The cellar beam sits level: one unopened cask and {b} counterweights against {c} counterweights.',
  'ctx.beamSeed': 'The seed beam is level: one unopened pod and {b} counterweights against {c} counterweights.',
  'ctx.beamCore': 'The core beam hangs level: one capped core and {b} counterweights against {c} counterweights.',
  'ctx.beamBale': 'The bale beam rests level: one bound bale and {b} counterweights against {c} counterweights.',
  'ctx.beamJar': 'The bench beam is level: one sealed jar and {b} counterweights against {c} counterweights.',
  'ctx.beamBillet': 'The forge beam sits level: one unstamped billet and {b} counterweights against {c} counterweights.',
  'ctx.beamCrucible': 'The assay beam hangs level: one lidded crucible and {b} counterweights against {c} counterweights.',
  'ctx.beamManySacks': 'The grain beam hangs level: {k} sealed sacks against {c} counterweights.',
  'ctx.beamManyCasks': 'The cellar beam sits level: {k} unopened casks against {c} counterweights.',
  'ctx.beamManyCores': 'The core beam is level: {k} capped cores against {c} counterweights.',
  'ctx.beamManyBales': 'The bale beam rests level: {k} bound bales against {c} counterweights.',
  'ctx.beamManyBillets': 'The forge beam sits level: {k} unstamped billets against {c} counterweights.',
  'ctx.beamManyJars': 'The bench beam hangs level: {k} sealed jars against {c} counterweights.',
  'ctx.sacks': '{k} sacks off a single filling — sealed, identical, and {c} tonnes between them.',
  'ctx.casks': '{k} casks from one run: same cooper, same fill, {c} tonnes in all.',
  'ctx.billets': '{k} billets out of a single cast — same mould, same mass, {c} tonnes altogether.',
  'ctx.bales': '{k} bales off the same press, bound identically, {c} tonnes between them.',
  'ctx.coils': '{k} coils off one mill: same gauge, same mass, {c} tonnes in all.',
  'ask.oneSackMass': 'What is one sack worth?',
  'ask.oneCaskMass': 'What is one cask worth?',
  'ask.oneSeedPodMass': 'What is one pod worth?',
  'ask.oneCoreMass': 'What is one core worth?',
  'ask.oneBaleMass': 'What is one bale worth?',
  'ask.oneJarMass': 'What is one jar worth?',
  'ask.oneBilletMass': 'What is one billet worth?',
  'ask.oneCrucibleMass': 'What is one crucible worth?',
  'ask.oneCoilMass': 'What is one coil worth?',

  // ---- charged once to begin, then charged by the cycle ------------------
  'ctx.berthFee': 'The berth takes {b} credits to take the lines, then {a} a cycle.',
  'ctx.berthLog': 'One cycle on the strip is gone.',
  'ctx.berthBill': 'The berth bill lost its working: {b} credits to take the lines, then {a} a cycle.',
  'ask.costOfBerth': 'What does a berth of {c} cycles come to?',
  'ask.howManyCyclesBerth': 'How many cycles of berth does {c} credits buy?',
  'ctx.craneFee': 'The crane takes {b} credits to swing out, then {a} a cycle.',
  'ctx.craneLog': 'One cycle on the strip is blank.',
  'ctx.craneBill': 'The crane bill lost its working: {b} credits to swing out, then {a} a cycle.',
  'ask.costOfHire': 'What does a hire of {c} cycles come to?',
  'ask.howManyCyclesHire': 'How many cycles of hire does {c} credits buy?',
  'ctx.kilnFee': 'The kiln takes {b} credits to light it, then {a} a cycle.',
  'ctx.kilnFeeLog': 'One cycle on the strip is empty.',
  'ctx.kilnBill': 'The kiln bill lost its working: {b} credits to light it, then {a} a cycle.',
  'ask.costOfFiring': 'What does a firing of {c} cycles come to?',
  'ask.howManyCyclesFiring': 'How many cycles of firing does {c} credits buy?',
  'ctx.lockupFee': 'The lockup takes {b} credits to open the door, then {a} a cycle.',
  'ctx.lockupLog': 'One cycle on the strip shows nothing.',
  'ctx.lockupBill': 'The lockup bill lost its working: {b} credits to open the door, then {a} a cycle.',
  'ask.costOfStorage': 'What does storage for {c} cycles come to?',
  'ask.howManyCyclesStorage': 'How many cycles of storage does {c} credits buy?',
  'ctx.pilotFee': 'The pilot takes {b} credits to come aboard, then {a} a cycle.',
  'ctx.pilotLog': 'One cycle on the strip is gone.',
  'ctx.pilotBill': 'The pilot bill lost its working: {b} credits to come aboard, then {a} a cycle.',
  'ask.costOfPassage': 'What does a passage of {c} cycles come to?',
  'ask.howManyCyclesPassage': 'How many cycles of passage does {c} credits buy?',

  // ---- two cadets, two answers, one of them true -------------------------
  'ctx.disputeGalley': 'Cadet {one} says {a}. Cadet {two} says {b}. The argument outlasted the meal.',
  'ctx.disputeBridge': 'Cadet {one} reads {a}. Cadet {two} reads {b}. The bridge wants one number.',
  'ctx.disputeInk': 'The log carries {a} from Cadet {one} and {b} from Cadet {two}, in one ink.',
  'ctx.disputeRadio': 'Cadet {one} sends {a}. Cadet {two} sends {b}. The far end cannot tell which.',
  'ctx.disputeWager': 'Cadet {one} has {a}. Cadet {two} has {b}, and galley duty riding on it.',
  'ctx.disputeReverse': 'Cadet {one} divides and gets {a}. Cadet {two} takes the number away and gets {b}.',
  'ctx.disputeStrip': 'Cadet {one} undoes the multiplying and gets {a}. Cadet {two} subtracts and gets {b}.',
  'ctx.disputeUnpick': 'Cadet {one} unpicks it in reverse and reads {a}. Cadet {two} unpicks it in order and reads {b}.',
  'ctx.disputeBackwards': 'Cadet {one} undoes the multiplying and gets {a}. Cadet {two} works both sides and gets {b}.',
  'ctx.disputeShare': 'Cadet {one} shares the {k} over {a} and {b}. Cadet {two} gives it all to {a}.',
  'ctx.disputeDoorway': 'Cadet {one} carries the {k} through to {a} and {b}. Cadet {two} stops at {a}.',
  'ctx.disputeHalfway': 'Cadet {one} takes the {k} to {a} and {b}. Cadet {two} takes it to {a} alone.',
  'ctx.disputeOutside': 'Cadet {one} applies the {k} to {a} and {b}. Cadet {two} applies it to {a} only.',

  // ---- a rectangle whose sides are expressions ---------------------------
  'ctx.viewport': 'A viewport blank is {w} across and {h} down. The gasket runs right round.',
  'ctx.deckMat': 'A deck mat is {w} across and {h} down. The edging runs right round.',
  'ctx.solarFrame': 'A solar frame is {w} across and {h} down. The sealing bead runs right round.',
  'ctx.tarp': 'A storm tarp is {w} across and {h} down. The hem rope runs right round.',
  'ctx.gate': 'A pressure gate is {w} across and {h} down. The beading runs right round.',
  'ctx.mirrorBlank': 'A mirror blank is {w} across and {h} down. The collar runs right round.',
  'ctx.banner': 'A signal banner hangs {k} units deep. Its width {w} was sewn from two strips.',
  'ctx.floorPan': 'A floor pan is {k} units deep. Its width {w} was pressed in two halves.',
  'ctx.gardenBed': 'A growing bed is {k} units deep. Its width {w} was framed in two runs.',
  'ctx.dragSail': 'A drag sail stands {k} units tall. Its width {w} was cut in two panels.',
  'ctx.doorLeaf': 'A hatch leaf stands {k} units tall. Its width {w} was cast in two halves.',
  'ctx.dustScreen': 'A dust screen stands {k} units tall. Its width {w} was woven in two widths.',

  // ---- two plans, two rates, one crossing --------------------------------
  'ctx.couriers': 'Courier A: {b} credits, then {a} a run. Courier B: {e}, then {c} a run.',
  'ctx.kilnsPlan': 'Kiln A: {b} credits, then {a} a run. Kiln B: {e}, then {c} a run.',
  'ctx.berthsPlan': 'Berth A: {b} credits, then {a} a run. Berth B: {e}, then {c} a run.',
  'ctx.riggers': 'Rigger A: {b} credits, then {a} a run. Rigger B: {e}, then {c} a run.',

  // ---- a fixed number of shifts on top of a per-crew rate ----------------
  'ctx.teams': 'Each of {k} teams logs «a|one:# shift|other:# shifts» a rotation, plus «b|one:# shift|other:# shifts» in the yard.',
  'ctx.gangs': 'Each of {k} gangs logs «a|one:# shift|other:# shifts» a rotation, plus «b|one:# shift|other:# shifts» on the hoist.',
  'ctx.wings': 'Each of {k} wings flies «a|one:# shift|other:# shifts» a rotation, plus «b|one:# shift|other:# shifts» on standby.',
  'ctx.sections': 'Each of {k} sections works «a|one:# shift|other:# shifts» a rotation, plus «b|one:# shift|other:# shifts» in the galley.',

  // ---- one quantity, filed twice, in two hands ---------------------------
  'ctx.twoClerks': 'Two clerks wrote the same quantity in two shapes. The rig takes one line.',
  'ctx.twoLedgers': 'The same quantity sits in two ledgers, written two ways. The rig takes one.',
  'ctx.twoTags': 'The crate carries two tags in two notations. The rig accepts exactly one.',
  'ctx.twoQuotes': 'Two yards quoted the same job and wrote it differently. The rig takes one.',
  'ctx.twoManifests': 'The same load was manifested twice, in two hands. The rig accepts one line.',
  'ctx.asCrates': 'The loading rig needs a count of identical crates, and what is in one.',
  'ctx.asDrums': 'The pump rig needs a count of identical drums, and what is in one.',
  'ctx.asBundles': 'The stowage rig needs a count of identical bundles, and what is in one.',
  'ctx.asTrays': 'The seeding rig needs a count of identical trays, and what stands in one.',

  // ---- a wider margin, so the tightest decks still deal a full session ---
  'ctx.airBottles': 'An air bottle takes ${v}$ litres at working pressure. {k} bottles come off the manifold.',
  'ctx.markerStakes': 'A marker stake covers ${v}$ kilometres of route. {k} stakes go out with the survey.',
  'ctx.dryRations': 'A ration block feeds a cadet for ${v}$ days. {k} blocks go on the crossing.',
  'ctx.printPlates': 'A print plate holds ${v}$ frames before regrinding. {k} plates are stacked by the reader.',
  'ctx.saltBlocks': 'A salt block masses ${v}$ tonnes off the pan. {k} blocks go onto the barge.',
  'ctx.chargeCoils': 'A charge coil returns ${v}$ watts into the bus. {k} coils are wound onto the ring.',
  'ctx.claimSlate': 'Cadet {who} counted the alphabet chalked up by the hatch. The manifest says ${v} = {val}$.',
  'ctx.claimTutor': 'An older tutor taught Cadet {who} the alphabet rule, kindly and wrongly. The manifest says ${v} = {val}$.',
  'ctx.claimDare': 'Cadet {who} was dared to defend the alphabet answer, and is enjoying it. The manifest reads ${v} = {val}$.',
  'ctx.claimPoster': 'Cadet {who} took the value off a numbered alphabet poster. The manifest reads ${v} = {val}$.',
  'ctx.coalHeap': 'The weighbridge remembers nothing. {b} tonnes went to the furnace, and it reads {c}.',
  'ctx.brineTank': 'The brine tank reports a level, never a history. {b} tonnes were drawn; it stands at {c}.',
  'ctx.slagPile': 'The slag scale has no memory. {b} tonnes were carted off; it reads {c}.',
  'ctx.waterButt': 'The water butt has a float and no memory. {b} tonnes went out; it sits at {c}.',
  'ask.startingCoal': 'What was on the weighbridge before the furnace was fed?',
  'ask.startingBrine': 'How full was the tank before?',
  'ask.startingSlag': 'How big was the pile before the carts?',
  'ask.startingButt': 'Where was the float before this shift?',
  'ask.whichEquationCoal': 'Which equation says what happened to the heap?',
  'ask.whichEquationBrine': 'Which equation says what happened in the tank?',
  'ask.whichEquationSlag': 'Which equation says what happened to the slag?',
  'ask.whichEquationButt': 'Which equation says what happened in the butt?',

  // ---- more of the shard that charges once and then charges by the cycle -
  'ctx.slipFee': 'The slip takes {b} credits to haul out, then {a} a cycle.',
  'ctx.slipLog': 'One cycle on the strip is blank.',
  'ctx.slipBill': 'The slip bill lost its working: {b} credits to haul out, then {a} a cycle.',
  'ask.costOfSlip': 'What does {c} cycles on the slip come to?',
  'ask.howManyCyclesSlip': 'How many cycles on the slip does {c} credits buy?',
  'ctx.stallFee': 'The stall takes {b} credits to claim it, then {a} a cycle.',
  'ctx.stallLog': 'One cycle on the strip is empty.',
  'ctx.stallBill': 'The stall bill lost its working: {b} credits to claim it, then {a} a cycle.',
  'ask.costOfStall': 'What does {c} cycles of stall come to?',
  'ask.howManyCyclesStall': 'How many cycles of stall does {c} credits buy?',
  'ctx.rigFee': 'The rig takes {b} credits to sign, then {a} a cycle.',
  'ctx.rigLog': 'One cycle on the strip shows nothing.',
  'ctx.rigBill': 'The rig bill lost its working: {b} credits to sign, then {a} a cycle.',
  'ask.costOfRig': 'What does {c} cycles with the rig come to?',
  'ask.howManyCyclesRig': 'How many cycles with the rig does {c} credits buy?',
  'ctx.escortFee': 'The escort takes {b} credits to form up, then {a} a cycle.',
  'ctx.escortLog': 'One cycle on the strip is gone.',
  'ctx.escortBill': 'The escort bill lost its working: {b} credits to form up, then {a} a cycle.',
  'ask.costOfEscort': 'What does an escort of {c} cycles come to?',
  'ask.howManyCyclesEscort': 'How many cycles of escort does {c} credits buy?',
  'ctx.beamKeg': 'The stores beam hangs level: one sealed keg and {b} counterweights against {c} counterweights.',
  'ctx.beamTin': 'The galley beam sits level: one unopened tin and {b} counterweights against {c} counterweights.',
  'ask.oneKegMass': 'What is one keg worth?',
  'ask.oneTinMass': 'What is one tin worth?',

  // ---- and wider still, for the cadet who does not stop at forty-five ----
  'ctx.hullPatches': 'A hull patch covers ${v}$ plates of skin. {k} patches came out of stores.',
  'ctx.gasBladders': 'A lift bladder takes ${v}$ litres before the valve decides. {k} bladders lace into the envelope.',
  'ctx.snowMelters': 'A melter turns out ${v}$ litres a run. {k} melters run on the ridge.',
  'ctx.tallySticks': 'A tally stick carries ${v}$ readings and is then full. {k} sticks came back.',
  'ctx.windMills': 'A ring mill returns ${v}$ watts in this wind. {k} mills stand along the scarp.',
  'ctx.pickAxes': 'A pick head lasts ${v}$ hours in this rock. {k} heads went down with the shift.',
  'ctx.chartRolls': 'A chart roll holds ${v}$ metres of trace. {k} rolls sit under the plotter.',
  'ctx.beeFrames': 'A frame carries ${v}$ grams of capped comb. {k} frames came off the ring.',
  'ctx.soundBuoys': 'A sounding buoy pings for ${v}$ seconds a cycle. {k} buoys are moored across the channel.',
  'ctx.spareBolts': 'A bolt tin holds ${v}$ rivets, counted by weight. {k} tins sit in the locker.',
  'ctx.nestedPatches': 'A hull patch covers ${v}$ plates. A roll carries {a} patches. Stores sent {b} sealed rolls.',
  'ctx.nestedMills': 'A ring mill returns ${v}$ watts. A stand carries {a} mills. {b} stands line the scarp.',
  'ctx.nestedBuoys': 'A buoy pings ${v}$ seconds a cycle. A string holds {a} buoys. {b} strings are moored.',
  'ctx.claimStencil': 'Cadet {who} read the value off the numbered stencil kit. The manifest reads ${v} = {val}$.',
  'ctx.claimTeacher': 'Cadet {who} is certain, because a certain person said so. The manifest says ${v} = {val}$.',
  'ctx.claimSpine': 'Cadet {who} read the index numbers on the manual as values. The manifest says ${v} = {val}$.',
  'ctx.claimQuiz': 'Cadet {who} reused an answer from last term, when the quiz was about the alphabet. The manifest says ${v} = {val}$.',
  'ctx.claimKeel': 'Cadet {who} walked the numbered alphabet painted along the keel. The manifest reads ${v} = {val}$.',
  'ctx.claimMate': 'Cadet {who} will tell you the alphabet gives the value, twice. The manifest says ${v} = {val}$.',
  'ctx.logBellows': 'The bellows log derives every row from the rule in its header. One row was lost.',
  'ctx.logCrusher': 'The crusher log computes every row from the rule above it. One row is missing.',
  'ctx.logSluice': 'The sluice log made every row from the rule at the top. One row burned away.',
  'ctx.logAviary': 'The aviary log derives every row from the rule in its header. One row is blank.',
  'ctx.logCompass': 'The compass log computes every row from the rule above it. One row has gone.',
  'ctx.logGrinder': 'The grinder log made every row from the rule at the top. One row was scrubbed out.',
  'ctx.logStack': 'The stack log derives every row from the rule in its header. One row came back empty.',
  'ctx.logWeir': 'The weir log computes every row from the rule above it. One row washed off.',
  'ctx.logDrier': 'The drier log made every row from the rule at the top. One row was lost.',
  'ctx.logCarding': 'The carding log derives every row from the rule in its header. One row is missing.',
  'ctx.logHone': 'The honing bench log pairs what went in with what came out. One line lost its input.',
  'ctx.logBleach': 'The bleach vat log pairs what went in with what came out. One line lost its input.',
  'ctx.rooftank': 'A roof tank starts the day at {b} and loses {a} every minute in the sun.',
  'ctx.creditLine': 'A survey account opens at {b} credits and the ring takes {a} every minute.',
  'ctx.snowPack': 'The pack stands at {b} and gives up {a} every minute the thaw wind runs.',
  'ctx.brakeShoe': 'A brake shoe starts the descent at {b} and wears {a} off every minute.',
  'ctx.tideRace': 'The race is running at {b} and drops {a} every minute past the turn.',
  'ctx.kilnHeat': 'The kiln comes off full heat at {b} and loses {a} every minute the doors are open.',
  'ctx.tramChart': 'A tram climbed the scarp at one steady rate, and the chart has the climb.',
  'ctx.pumpChart': 'The pump drew the level down at one rate, and somebody charted it.',
  'ctx.mothChart': 'A survey moth ran the coast at one pace, and the plotter drew it all.',
  'ctx.deckPlate': 'A deck plate is {w} across and {h} down. The weld runs right round.',
  'ctx.filterFrame': 'A filter frame is {w} across and {h} down. The tape runs right round.',
  'ctx.awning': 'An awning stands {k} units deep. Its width {w} was cut in two lengths.',
  'ctx.baffle': 'A baffle stands {k} units tall. Its width {w} was pressed in two plates.',
  'ctx.trapDoor': 'A trap door is {k} units deep. Its width {w} was framed in two boards.',
  'ctx.solarBank': 'A solar bank stands {k} units tall. Its width {w} was laid in two runs.',
  'ctx.windBreak': 'A wind break stands {k} units tall. Its width {w} was woven in two panels.',
  'ctx.coldFrame': 'A cold frame is {k} units deep. Its width {w} was glazed in two lights.',
  'ctx.shutterPanel': 'A shutter panel stands {k} units tall. Its width {w} was cast in two leaves.',
  'ctx.twoSignals': 'The same quantity was signalled from two masts, in two notations. The rig takes one.',
  'ctx.twoChalks': 'Two hands chalked the same quantity in two shapes. The rig accepts one line.',


  // ---- ADDED: a known part beside an unknown one -------------------------
  // The deck behind `vm-partWhole`. Every other contextual reading of
  // var-meaning is a product; this one is a sum, so the sentence a cadet
  // recognises is a different sentence, not the same one in a new noun.
  'ctx.pwMuster': 'The muster deck holds ${v}$ cadets. {c} more cadets come up the ramp.',
  'ctx.pwReel': 'A reel carries ${v}$ metres of line. The mate adds {c} metres.',
  'ctx.pwTank': 'A tank holds ${v}$ litres. The pump sends in {c} litres.',
  'ctx.pwGlazing': 'The rack holds ${v}$ panes. A crate adds {c} panes.',
  'ctx.pwBank': 'A power bank holds ${v}$ cells. The crew fits {c} cells.',
  'ctx.pwSledRun': 'A sled has run ${v}$ kilometres today. The next leg adds {c} kilometres.',
  'ctx.pwScalePan': 'The pan already holds ${v}$ grams. The mate drops in {c} grams.',
  'ctx.pwSeam': 'One seam takes ${v}$ rivets. The patch beside it takes {c} rivets.',
  'ctx.pwWatchLog': 'The log holds ${v}$ readings. The night watch adds {c} readings.',
  'ctx.pwLamp': 'A deck lamp gives ${v}$ lumens. A hand torch gives {c} lumens.',
  'ctx.pwWarmBay': 'The bay sits at ${v}$ degrees. The heater lifts it {c} degrees.',
  'ctx.pwHull': 'The hull carries ${v}$ plates. The yard bolts on {c} plates.',
  // ---- ADDED: an unknown total, shared out (vm-share) --------------------
  // The only place in Level 1 where a whole is taken apart rather than built
  // up, so the answer is a fraction and the slip is a division written the
  // wrong way round.
  'ctx.soCable': 'The mate cuts ${v}$ metres of cable into {k} equal lengths.',
  'ctx.soWater': 'The crew draws ${v}$ litres of water into {k} equal cans.',
  'ctx.soRations': 'The cook splits a crate of ${v}$ rations between {k} bunks.',
  'ctx.soOre': 'A skip tips ${v}$ tonnes of ore into {k} equal heaps.',
  'ctx.soWatch': 'The mate shares a watch of ${v}$ hours between {k} hands.',
  'ctx.soPower': 'The bus feeds ${v}$ watts evenly to {k} decks.',
  'ctx.soSeed': 'The gardener sows ${v}$ seeds evenly across {k} beds.',
  'ctx.soFuel': 'The engineer drains ${v}$ litres of fuel into {k} equal drums.',
  'ctx.soCanvas': 'The sailmaker cuts ${v}$ metres of canvas into {k} equal sails.',
  'ctx.soSalt': 'The rake pulls ${v}$ kilograms of salt into {k} equal piles.',
  'ctx.soRope': 'The bosun cuts ${v}$ metres of rope into {k} equal falls.',
  'ctx.soGrain': 'The chute runs ${v}$ tonnes of grain into {k} equal sacks.',
  'ask.whichShare': 'Which expression gives one share?',

  // ---- WIDENING, WAVE 16 -------------------------------------------------
  //
  // Two cold critics counted the same thing and wrote down the same number.
  // "19 distinct situation skeletons across the first 45 scheduled items."
  // "8 of 14 items were two templates." The session ledger in `deck()` already
  // cycles a deck before it repeats, so nothing was served twice inside one
  // sitting — but a deck of twelve dealt three times a session is a deck a
  // cadet has seen all of by their fourth sitting, and the fourth sitting is
  // where a game either keeps somebody or loses them.
  //
  // So the decks under the heaviest load are widened here. `draws/held` from
  // tools/situationspread.mjs is the number that picked them: shareOut 2.67,
  // partWhole 3.00, nested 2.13, claim 1.77 — every one of them dealing each
  // framing more than once per run of sessions.
  //
  // The standard the existing entries set is kept exactly: ONE short sentence
  // of situation, every slot in it used by the mathematics, no decoy number,
  // no joke that costs a line. A framing earns its place by being a different
  // instrument in a different part of the shard — not by being the same
  // instrument with a funnier name.

  // an unknown total, cut into k equal shares
  'ctx.soIce': 'The cutter breaks ${v}$ kilograms of ice into {k} equal blocks.',
  'ctx.soAir': 'The compressor splits ${v}$ litres of air between {k} equal bottles.',
  'ctx.soWire': 'The fitter cuts ${v}$ metres of wire into {k} equal leads.',
  'ctx.soCoal': 'The stoker shovels ${v}$ kilograms of coal into {k} equal buckets.',
  'ctx.soPaint': 'The painter pours ${v}$ litres of paint into {k} equal pots.',
  'ctx.soClay': 'The potter cuts ${v}$ kilograms of clay into {k} equal balls.',
  'ctx.soThread': 'The weaver winds ${v}$ metres of thread onto {k} equal bobbins.',
  'ctx.soSoup': 'The cook ladles ${v}$ litres of broth into {k} equal bowls.',
  'ctx.soSand': 'A barge tips ${v}$ tonnes of sand into {k} equal bays.',
  'ctx.soCredit': 'The purser splits a prize of ${v}$ credits between {k} equal shares.',
  'ctx.soCuttings': 'The gardener sets ${v}$ cuttings out across {k} equal frames.',
  'ctx.soSamples': 'The lab divides ${v}$ samples between {k} equal trays.',
  'ctx.soTape': 'The archivist cuts ${v}$ metres of tape into {k} equal reels.',
  'ctx.soChain': 'The smith cuts ${v}$ links of chain into {k} equal lengths.',
  'ctx.soAsh': 'The furnace drops ${v}$ kilograms of ash into {k} equal skips.',
  'ctx.soDoses': 'The medic divides ${v}$ doses between {k} equal packs.',

  // somebody has decided a letter is worth its place in the alphabet
  'ctx.claimNotebook': 'Cadet {who} copied a numbered alphabet into a notebook and trusts it. The manifest says ${v} = {val}$.',
  'ctx.claimGame': 'Cadet {who} learnt the alphabet trick from a puzzle game. The manifest says ${v} = {val}$.',
  'ctx.claimSign': 'A numbered alphabet is bolted over the workshop door, and Cadet {who} used it. The manifest reads ${v} = {val}$.',
  'ctx.claimHabit': 'Cadet {who} counts the alphabet every time, out of habit. The manifest says ${v} = {val}$.',
  'ctx.claimFirst': 'Cadet {who} answered first, and answered from the alphabet. The manifest says ${v} = {val}$.',
  'ctx.claimCousin': 'A cousin on another shard swears by the alphabet rule. The manifest reads ${v} = {val}$.',
  'ctx.claimCrate': 'The crate is stencilled ${v}$, so Cadet {who} counted the alphabet. The manifest says ${v} = {val}$.',
  'ctx.claimCallSign': 'A call-sign alphabet made Cadet {who} sure of the value. The manifest says ${v} = {val}$.',
  'ctx.claimNotes': 'Cadet {who} found the alphabet rule in a borrowed set of notes. The manifest says ${v} = {val}$.',
  'ctx.claimDoors': 'Cadet {who} read the value off the numbered door plates. The manifest reads ${v} = {val}$.',
  'ctx.claimBadge': 'Cadet {who} counted the letters on a badge to get the value. The manifest says ${v} = {val}$.',
  'ctx.claimBar': 'Cadet {who} bet a ration bar on the alphabet answer. The manifest reads ${v} = {val}$.',

  // a known part beside an unknown one
  'ctx.pwNursery': 'The nursery bench raises ${v}$ seedlings. A new tray adds {c} seedlings.',
  'ctx.pwLarder': 'The larder is signed out for ${v}$ days. A late crate adds {c} days.',
  'ctx.pwFlare': 'One flare burns for ${v}$ seconds. A second flare adds {c} seconds.',
  'ctx.pwKeel': 'The keel already carries ${v}$ tonnes. The crane lowers in {c} tonnes.',
  'ctx.pwArray': 'The array returns ${v}$ watts. A new string adds {c} watts.',
  'ctx.pwCoreRack': 'The rack holds ${v}$ samples. The morning core adds {c} samples.',
  'ctx.pwCandle': 'An oxy candle runs for ${v}$ minutes. The spare adds {c} minutes.',
  'ctx.pwRelay': 'The relay has passed ${v}$ packets. The next window adds {c} packets.',
  'ctx.pwKilnRun': 'The kiln has fired ${v}$ bricks. The last pour adds {c} bricks.',
  'ctx.pwWatchGlass': 'The glass has run ${v}$ hours. The next turn adds {c} hours.',
  'ctx.pwFilm': 'The reel holds ${v}$ frames. The night pass adds {c} frames.',
  'ctx.pwMedChest': 'The chest holds ${v}$ doses. The drop adds {c} doses.',
  'ctx.pwLadder': 'The ladder stands ${v}$ metres tall. One more section adds {c} metres.',
  'ctx.pwRainTank': 'The rain tank holds ${v}$ litres. The gutter brings in {c} litres.',

  // b groups of a groups of v
  'ctx.nestedRivets': 'One seam takes ${v}$ rivets. A panel has {a} seams. The hull needs {b} panels.',
  'ctx.nestedCrucibles': 'One crucible takes ${v}$ grams. A tray holds {a} crucibles. {b} trays go in.',
  'ctx.nestedWatches': 'One watch runs ${v}$ hours. A rotation is {a} watches. The voyage is {b} rotations.',
  'ctx.nestedSondes': 'A sonde returns ${v}$ readings. A cast drops {a} sondes. {b} casts are logged.',
  'ctx.nestedLegs': 'A sled leg runs ${v}$ kilometres. A day is {a} legs. The crossing is {b} days.',
  'ctx.nestedSkips': 'One skip lifts ${v}$ tonnes. A hoist raises {a} skips. {b} hoists ran today.',
  'ctx.nestedMantles': 'One mantle gives ${v}$ lumens. A lamp takes {a} mantles. {b} lamps are lit.',
  'ctx.nestedWindows': 'One window passes ${v}$ packets. A pass has {a} windows. {b} passes are booked.',
  'ctx.nestedCandles': 'One candle burns for ${v}$ minutes. A locker holds {a} candles. {b} lockers are sealed.',
  'ctx.nestedBlocks': 'One ration block feeds ${v}$ days. A crate holds {a} blocks. {b} crates came down.',
  'ctx.nestedPlates': 'One plate holds ${v}$ frames. A cassette takes {a} plates. {b} cassettes are loaded.',
  'ctx.nestedPots': 'One pot raises ${v}$ seedlings. A flat takes {a} pots. {b} flats stand ready.',

  // one rule at the head of a column, four rows, one reading destroyed
  'ctx.logKelp': 'The kelp line log made every row from the rule at the top. One row has gone.',
  'ctx.logVane': 'The wind vane log derives every row from the rule in its header. One row washed out.',
  'ctx.logSeedDrill': 'The seed drill log computes every row from the rule above it. One row is blank.',
  'ctx.logRopeWalk': 'The rope walk log made every row from the rule at the top. One row tore off.',
  'ctx.logTannery': 'The tannery log derives every row from the rule in its header. One row is missing.',
  'ctx.logIceSaw': 'The ice saw log computes every row from the rule above it. One row has gone.',
  'ctx.logPumpHouse': 'The pump house log made every row from the rule at the top. One row is unreadable.',
  'ctx.logQuarry': 'The quarry log derives every row from the rule in its header. One row was lost.',
  'ctx.logSmokeHouse': 'The smokehouse log computes every row from the rule above it. One row is blank.',
  'ctx.logBoiler': 'The boiler log made every row from the rule at the top. One row scorched away.',
  'ctx.logLathe': 'The lathe log derives every row from the rule in its header. One row is missing.',
  'ctx.logBellTower': 'The bell tower log computes every row from the rule above it. One row has gone.',
  'ctx.logTram': 'The tram log made every row from the rule at the top. One row rubbed out.',
  'ctx.logGantry': 'The gantry log derives every row from the rule in its header. One row is blank.',
  'ctx.logNetLoft': 'The net loft log computes every row from the rule above it. One row was lost.',
  'ctx.logRainGauge': 'The rain gauge log made every row from the rule at the top. One row is missing.',

  // something that starts at b and loses a of itself every minute
  'ctx.oxyBottle': 'The bottle comes off the rack at {b} and vents {a} every minute.',
  'ctx.battBank': 'The power bank sits at {b} and drains {a} every minute under load.',
  'ctx.tideFlat': 'The flat stands at {b} and falls {a} every minute on the ebb.',
  'ctx.brineLevel': 'The brine reads {b} and drops {a} every minute the pan runs.',
  'ctx.sandGlass': 'The glass reads {b} and runs down {a} every minute.',
  'ctx.wheelPress': 'The wheel reads {b} and lets go {a} every minute through the split.',
  'ctx.grainChute': 'The chute reads {b} and empties {a} every minute the gate stays up.',
  'ctx.dyeVat': 'The vat reads {b} and fades {a} every minute in the sun.',
  'ctx.ropeStrand': 'The strand holds {b} and gives up {a} every minute under the load.',
  'ctx.wickLamp': 'The lamp reads {b} and burns {a} every minute on the low wick.',

  // one straight trace, drawn for you, all the way along
  'ctx.railChart': 'A rail trolley ran the spine at one pace, and the plotter drew it all.',
  'ctx.ferryChart': 'A ferry crossed at one pace, and the chart kept every minute.',
  'ctx.liftChart': 'A shaft lift ran at one pace, and the recorder drew the whole run.',
  'ctx.creepChart': 'The scarp crept at one pace, and the plotter drew it all.',
  'ctx.thawChart': 'The thaw front moved at one pace, and the chart kept every minute.',
  'ctx.spoolChart': 'A spool paid out at one pace, and the recorder drew the whole run.',
  'ctx.dustChart': 'The dust front rolled in at one pace, and the plotter drew it all.',
  'ctx.gaugeChart': 'A tide gauge rose at one pace, and the chart kept every minute.',

  // k identical groups of v
  'ctx.wickBundles': 'A bundle burns for ${v}$ hours of lamp light. {k} bundles hang in the store.',
  'ctx.tarBarrels': 'A barrel seals ${v}$ plates of decking. {k} barrels came off the barge.',
  'ctx.pressCakes': 'A press cake yields ${v}$ litres of oil. {k} cakes wait at the mill.',
  'ctx.signalKites': 'A kite holds the line for ${v}$ minutes. {k} kites are rigged and ready.',
  'ctx.stoveBricks': 'A stove brick throws ${v}$ degrees into the bunk room. {k} bricks are in the fire.',
  'ctx.roeTrays': 'A hatchery tray brings on ${v}$ seedlings of kelp. {k} trays line the wall.',
  'ctx.sparRods': 'A spar rod measures ${v}$ metres end to end. {k} rods are lashed together.',
  'ctx.beltLinks': 'A belt link carries ${v}$ tonnes down to the barge. {k} links are on the run.',
  'ctx.gasMantle': 'A mantle burns at ${v}$ lumens all night. {k} mantles are lit along the gallery.',
  'ctx.tallyBoards': 'A tally board records ${v}$ readings a shift. {k} boards came in tonight.',
  'ctx.dripFeeds': 'A drip feed delivers ${v}$ doses a round. {k} feeds are running in the ward.',
  'ctx.spoilCarts': 'A haul cart runs ${v}$ kilometres of the spoil line. {k} carts went out today.',
  'ctx.pinionGears': 'A pinion turns ${v}$ watts into the shaft. {k} pinions are engaged.',
  'ctx.saltCribs': 'A crib dries ${v}$ grams of salt a tide. {k} cribs are laid out on the flat.',

  // a gauge that reads the present and never recorded the past
  'ctx.hopperBin': 'The hopper shows a level and keeps no log. {b} tonnes went down the chute; it reads {c}.',
  'ctx.peatStack': 'The peat stack is measured, never remembered. {b} tonnes were cut away; it stands at {c}.',
  'ctx.oreBunk': 'The ore bunk has a scale and no history. {b} tonnes were drawn off; it reads {c}.',
  'ctx.mealSilo': 'The meal silo reports depth and nothing else. {b} tonnes were milled; it sits at {c}.',
  'ctx.snowLoad': 'The roof gauge reads now, never before. {b} tonnes slid off; it reads {c}.',
  'ctx.ballastHold': 'The ballast hold is sounded, never logged. {b} tonnes were pumped out; it stands at {c}.',
  'ask.startingHopper': 'What did the hopper hold before the chute ran?',
  'ask.startingPeat': 'How big was the stack before the cut?',
  'ask.startingOreBunk': 'What was in the bunk before it was drawn off?',
  'ask.startingMeal': 'How deep was the silo before milling?',
  'ask.startingSnow': 'What did the roof carry before the slide?',
  'ask.startingBallast': 'What did the ballast hold carry before the pump?',
  'ask.whichEquationHopper': 'Which equation says what happened in the hopper?',
  'ask.whichEquationPeat': 'Which equation says what happened to the stack?',
  'ask.whichEquationOreBunk': 'Which equation says what happened in the bunk?',
  'ask.whichEquationMeal': 'Which equation says what happened in the silo?',
  'ask.whichEquationSnow': 'Which equation says what happened on the roof?',
  'ask.whichEquationBallast': 'Which equation says what happened in the ballast hold?',
};
