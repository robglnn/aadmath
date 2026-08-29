/**
 * Algebra I · Level 5 — item prose, English.
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
 * ONE WORD, ONE MEANING — the vocabulary this level adds, on top of Levels 1
 * to 3. Every word below is defined by the sentence that first uses it.
 *   reading   one measured pair, or one measured value
 *   list      numbers written in order, one for each position
 *   position  which place along the list, counting 1, 2, 3
 *   step      the amount a list adds at every position
 *   factor    the number a list multiplies by at every position (Level 3)
 *   count     the number written above, which says how many factors (Level 3)
 *   root      the move that undoes a power
 *   rate      the amount a line rises for one step across (Level 2)
 *   closest line  the one line that sits nearest to every reading at once
 *   gap       one reading take away the value the line gives there
 *   region    every reading a statement with a lean is true for
 *   boundary  the line where a region stops
 *   crossing  the one reading two rules agree on
 *   share     a part written against a whole
 */
export default {
  // ------------------------------------------------------------------ asks
  'l5.ask.exactValue': 'What is the exact value?',
  'l5.ask.simplestForm': 'Write this in its simplest form.',
  'l5.ask.rootThenPower': 'The bottom of the count says which root. What is the value?',
  'l5.ask.whichInputBreaks': 'One input carries two different outputs. Which input?',
  'l5.ask.valueAtPosition': 'What is the value at position {k}?',
  'l5.ask.oneFormula': 'Write one formula that gives the value at position {v}.',
  'l5.ask.sameLineFromReading': 'Write the same line with the marked reading taken off both sides.',
  'l5.ask.sameLineOutputAlone': 'Write the same line with the output alone on the left.',
  'l5.ask.sameLineWholeNumbers': 'Write the same line with both letters on the left and no fraction.',
  // THE TWO LETTERS A RULE IS WRITTEN IN, NAMED ON THE CARD.
  // `pp-upright` prints an upright line as $x = 1$ and a marked reading, and
  // the rule of the line at a right angle to it is $y = 10$ — so the only
  // letter the answer accepts was one the card never showed. Naming both is
  // also the plainer instruction: a cadet is told what to answer in.
  'l5.ask.lineBeside': 'Write the rule of the line beside this one, through the marked reading. Use $x$ and $y$.',
  'l5.ask.lineAtRightAngle': 'Write the rule of the line at a right angle to this one, through the marked reading. Use $x$ and $y$.',
  'l5.ask.writeThatLine': 'Write the rule of that line.',
  'l5.ask.rateAtRightAngle': 'What is the rate of the line at a right angle to this one?',
  'l5.ask.rateOfThatLine': 'What is the rate of that line?',
  'l5.ask.valueAtZero': 'What is the output when the input is zero?',
  'l5.ask.whichRegion': 'R is the region. Write the statement that names R.',
  'l5.ask.writeThePair': 'Write the pair of rules, one for each table.',
  'l5.ask.whereTheyMeet': 'Where do the two rules meet?',
  'l5.ask.inputAtCrossing': 'What is the input at the crossing?',
  'l5.ask.outputAtCrossing': 'What is the output at the crossing?',
  'l5.ask.fitRate': 'What is the rate of the closest line?',
  'l5.ask.fitStart': 'Where does the closest line start?',
  'l5.ask.predictAt': 'What does the closest line give at {k}?',
  'l5.ask.gapAt': 'A gap is one reading take away the line. What is the gap at {k}?',
  'l5.ask.gapAtShort': 'What is the gap at {k}?',
  'l5.ask.shareOfRow': 'What share of the marked row sits in the marked column?',
  'l5.ask.shareOfAll': 'What share of every reading sits where the marked row meets the marked column?',
  'l5.ask.shareOfColumn': 'What share of the marked column sits in the marked row?',
  // THE START IS AT $x = 0$, AND THE LOG DOES NOT PRINT THAT ROW.
  // "What is the starting amount?" over a table whose first row is $x = 1$
  // reads as "copy the first reading", and the first reading ships as a
  // wrong option. The row the answer sits on is now named on the card.
  'l5.ask.startAmount': 'The start is at $x = 0$. What is the amount there?',
  'l5.ask.growthFactor': 'What is the factor?',
  'l5.ask.percentEachStep': 'By what percent does it rise at each step?',
  'l5.ask.writeTheRule': 'Write the rule for these readings.',
  'l5.ask.whenItPasses': 'At which position does the first rule pass the second?',

  // ---------------------------------------------------- counts as fractions
  'l5.ctx.kilnFire': 'A kiln raises each charge to a fractional count of its own mass.',
  'l5.ctx.tuner': 'A tuner sets each dish to a fractional count of the beacon reading.',
  'l5.ctx.mixer': 'A mixer scales each batch by a fractional count of its load.',
  'l5.ctx.gauge': 'A gauge reports a fractional count of the pressure it holds.',
  'l5.ctx.hullSquare': 'A square hull plate has this area, and the crew needs one side.',
  'l5.ctx.tankSquare': 'A square tank floor has this area, and the crew needs one edge.',
  'l5.ctx.bayRoot': 'A square landing bay has this area, and the crew paints one edge.',

  // ------------------------------------------------------- one output only
  'l5.ctx.dockLog': 'A dock log pairs each berth number with the mass it took.',
  'l5.ctx.sensorLog': 'A sensor log pairs each dial setting with the reading it gave.',
  'l5.ctx.cropLog': 'A crop log pairs each tray number with the yield it gave.',
  'l5.ctx.relayLog': 'A relay log pairs each channel number with the delay it gave.',
  'l5.ctx.pilotSheet': 'A pilot sheet pairs each launch code with the burn time it set.',

  // --------------------------------------------------------------- lists
  'l5.ctx.driftRow': 'A drift buoy reports one distance at every watch.',
  'l5.ctx.stackRow': 'A crew stacks the same number of crates at every watch.',
  'l5.ctx.iceRow': 'A hull loses the same mass of ice at every watch.',
  'l5.ctx.fuelRow': 'A burner loses the same mass of fuel at every watch.',
  'l5.ctx.stockRow': 'A store loses the same number of packs at every watch.',
  'l5.ctx.sporeRow': 'A spore bed multiplies by the same factor at every watch.',
  'l5.ctx.dimmerRow': 'A lamp keeps the same fraction of its light at every watch.',
  'l5.ctx.tetherRow': 'A tether pays out the same length at every watch.',

  // --------------------------------------------------------------- lines
  'l5.ctx.rampRule': 'A ramp climbs at a steady rate.',
  'l5.ctx.beltRule': 'A belt carries mass at a steady rate.',
  'l5.ctx.pumpRule': 'A pump fills a tank at a steady rate.',
  'l5.ctx.craneRule': 'A crane lifts at a steady rate.',
  'l5.ctx.girderRun': 'A girder runs beside this line, and the marked reading sits on it.',
  'l5.ctx.braceRun': 'A brace crosses this line at a right angle through the marked reading.',
  'l5.ctx.railRun': 'A rail runs beside this line and carries the marked reading.',
  'l5.ctx.strutRun': 'A strut meets this line at a right angle at the marked reading.',
  'l5.ctx.towLine': 'A tow line runs beside this line and holds the marked reading.',

  // ------------------------------------------------------------- regions
  'l5.ctx.safeLoad': 'A hoist is safe for every reading inside the region.',
  'l5.ctx.coldBay': 'A cold bay holds every reading inside the region.',
  'l5.ctx.powerBudget': 'A power budget covers every reading inside the region.',
  'l5.ctx.airMix': 'An air mix stays clean for every reading inside the region.',

  // ------------------------------------------------------------- systems
  'l5.ctx.twoHoists': 'Two hoists run at their own steady rates, and each table logs one.',
  'l5.ctx.twoTanks': 'Two tanks fill at their own steady rates, and each table logs one.',
  'l5.ctx.twoRovers': 'Two rovers travel at their own steady rates, and each table logs one.',
  'l5.ctx.twoKilns': 'Two kilns heat at their own steady rates, and each table logs one.',
  'l5.ctx.priceMeet': 'Two suppliers charge by their own rules, and the crew wants the same price.',
  'l5.ctx.rangeMeet': 'Two drones drain power by their own rules, and the crew wants the same charge.',
  'l5.ctx.fillMeet': 'Two pipes fill by their own rules, and the crew wants the same depth.',
  'l5.ctx.climbMeet': 'Two lifts climb by their own rules, and the crew wants the same height.',

  // ---------------------------------------------------------------- data
  'l5.ctx.oreAssay': 'A crew logs one ore reading for each drill depth.',
  'l5.ctx.frostRun': 'A crew logs one frost reading for each hour of night.',
  'l5.ctx.dustRun': 'A crew logs one dust reading for each metre of altitude.',
  'l5.ctx.saltRun': 'A crew logs one salt reading for each kilometre of coast.',
  'l5.ctx.windRun': 'A crew logs one wind reading for each metre of mast.',
  'l5.ctx.yieldRun': 'A crew logs one yield reading for each gram of feed.',
  'l5.ctx.wearRun': 'A crew logs one wear reading for each thousand turns.',

  // --------------------------------------------------------- two-way table
  'l5.ctx.crewSurvey': 'A survey sorts every cadet by shift and by trade.',
  'l5.ctx.partsAudit': 'An audit sorts every part by supplier and by grade.',
  'l5.ctx.cargoAudit': 'An audit sorts every crate by deck and by seal.',
  'l5.ctx.faultAudit': 'An audit sorts every fault by system and by watch.',

  // ------------------------------------------------------- growth and decay
  'l5.ctx.blightSpread': 'A blight multiplies by the same factor at every watch.',
  'l5.ctx.fundGrow': 'A fund multiplies by the same factor at every watch.',
  'l5.ctx.coolantFade': 'A coolant keeps the same fraction of itself at every watch.',
  'l5.ctx.isotopeFade': 'An isotope keeps the same fraction of itself at every watch.',
  'l5.ctx.raceStep': 'One store adds at every watch and the other multiplies.',
  'l5.ctx.raceGrow': 'One crop adds at every watch and the other multiplies.',

  // ------------------------------------------------------------- disputes
  'l5.ctx.disputeRoot': 'Two cadets read the same fractional count and disagree.',
  'l5.ctx.disputeOrder': 'Two cadets took the root and the power in different orders.',
  'l5.ctx.disputeFunction': 'Two cadets disagree about which setting broke the log.',
  'l5.ctx.disputeStep': 'Two cadets disagree about the step of the same list.',
  'l5.ctx.disputeFormula': 'Two cadets wrote different formulas for the same list.',
  'l5.ctx.disputeRate': 'Two cadets disagree about the line at a right angle to this one.',
  'l5.ctx.disputeCrossing': 'Two cadets disagree about where the two rules meet.',
  'l5.ctx.disputeFit': 'Two cadets disagree about the closest line.',
  'l5.ctx.disputeGap': 'Two cadets disagree about the gap at one reading.',
  'l5.ctx.disputeShare': 'Two cadets disagree about the share in one row.',
  'l5.ctx.disputeWhole': 'Two cadets disagree about which total a share counts against.',

  // ------------------------------------------------------- why · fractional counts
  'l5.why.bottomIsTheRoot': 'The bottom of the count says which root to take.',
  'l5.why.topIsThePower': 'The top of the count says what power to raise it to.',
  'l5.why.rootFirstThenPower': 'Take the root first, then raise the small number to the top count.',
  'l5.why.negativeCountFlips': 'A count below zero turns the value upside down.',
  'l5.why.squareFactorComesOut': 'Split out the largest square factor, then take its root.',
  'l5.why.rootOfAProduct': 'The root of a product is the root of each part multiplied.',
  'l5.why.workItOut': 'Work it out.',

  // ------------------------------------------------------- why · one output
  'l5.why.oneOutputEachInput': 'A rule is a function when every input carries exactly one output.',
  'l5.why.readDownTheInputs': 'Read down the input column and look for the same input twice.',
  'l5.why.twoOutputsBreakIt': 'That input carries two different outputs, so the rule breaks there.',
  'l5.why.sharedOutputIsFine': 'Two inputs may share one output, and the rule still holds.',

  // ------------------------------------------------------- why · lists
  'l5.why.takeNeighbours': 'Take one value away from the value after it.',
  'l5.why.sameStepAllTheWay': 'Every pair gives the same step, so the list adds.',
  'l5.why.divideNeighbours': 'Divide one value by the value before it.',
  'l5.why.sameFactorAllTheWay': 'Every pair gives the same factor, so the list multiplies.',
  'l5.why.countTheStepsOn': 'Count the steps from the last printed position to position {k}.',
  'l5.why.addTheStepEachTime': 'Add the step once for every position you move on.',
  'l5.why.multiplyEachTime': 'Multiply by the factor once for every position you move on.',
  'l5.why.firstValuePlusSteps': 'Start at the first value, then add the step for each later position.',
  'l5.why.stepTimesPositionPlusStart': 'The formula is the step times the position, plus what is left over.',
  'l5.why.factorPowerFromFirst': 'The formula is the first value times the factor, raised to the steps taken.',
  'l5.why.checkAtPositionOne': 'Put position one into the formula and check the first value.',
  'l5.why.runTheRuleOn': 'Run the rule forward one position at a time.',

  // ------------------------------------------------------- why · lines
  'l5.why.rateOffTheRule': 'Read the rate off the printed rule.',
  'l5.why.pointIntoTheForm': 'Put the marked reading into the form, and mind the signs.',
  'l5.why.zeroIntoTheForm': 'Put zero in place of the input, and mind the signs.',
  'l5.why.takeAwayTheReading': 'Take the reading away, so a point below zero becomes a plus.',
  'l5.why.multiplyOutTheBracket': 'Multiply out the bracket and gather the numbers.',
  'l5.why.clearTheBottom': 'Multiply every part by the bottom number to clear the fraction.',
  'l5.why.gatherLettersLeft': 'Gather both letters on the left and the number on the right.',
  'l5.why.sameRateForParallel': 'Two lines that never meet carry the same rate.',
  'l5.why.turnOverAndChangeSign': 'For a right angle, turn the rate upside down and change its sign.',
  'l5.why.uprightHasNoRate': 'An upright line has no rate, so it is written from its input alone.',
  'l5.why.flatLineRateIsZero': 'A level line has rate zero, so its rule names the output alone.',
  'l5.why.throughTheOrigin': 'The line passes through zero, so no number is added.',
  'l5.why.constantIsOutputOverInput': 'Divide the output by the input to get the constant.',

  // ------------------------------------------------------- why · regions
  'l5.why.boundaryFromReadings': 'Fit the line through the boundary readings first.',
  'l5.why.testTheReadingOffTheLine': 'Put the reading that is off the line in. See which side it falls.',
  'l5.why.readingOffTheLineIsIn': 'The reading off the line is in R, so R is on its side.',
  'l5.why.readingOffTheLineIsOut': 'The reading off the line is not in R, so R is on the other side.',
  'l5.why.boundaryLeftOutOfR': 'The boundary reading is not in R, so the lean is strict.',
  'l5.why.boundaryKeptInR': 'The boundary reading is in R, so the lean allows equals.',

  // ------------------------------------------------------- why · systems
  'l5.why.ruleFromEachTable': 'Work out one rule from each table on its own.',
  'l5.why.twoRulesTwoUnknowns': 'Two different rules about one pair pin both readings down.',
  'l5.why.setThemEqual': 'The rules agree at the crossing, so set them equal.',
  'l5.why.solveForTheInput': 'Solve for the input.',
  'l5.why.putItBackInEither': 'Put the input back into either rule to get the output.',
  'l5.why.checkInBoth': 'A crossing has to fit both rules, so check it in both.',
  'l5.why.readTheSharedRow': 'Find the reading that appears in both tables.',

  // ------------------------------------------------------- why · fitted lines
  'l5.why.noReadingIsExact': 'Real readings never sit exactly on one line.',
  'l5.why.closestLineIdea': 'The closest line sits nearest to every reading at once.',
  'l5.why.rateFromAllReadings': 'Every reading pulls on the rate, not just the first and the last.',
  'l5.why.putTheInputIn': 'Put {k} into the closest line.',
  'l5.why.gapIsReadingMinusLine': 'The gap is the reading take away the value the line gives.',
  'l5.why.signOfTheGap': 'A gap above zero means the reading sits above the line.',
  'l5.why.gapsAllOneSide': 'Gaps that stay on one side say a straight rule is the wrong shape.',
  'l5.why.predictIsNotMeasured': 'A predicted value is worked out, and nobody measured it.',

  // ------------------------------------------------------- why · shares
  'l5.why.rowTotalIsTheWhole': 'Inside one row, the row total is the whole.',
  'l5.why.columnTotalIsTheWhole': 'Inside one column, the column total is the whole.',
  'l5.why.grandTotalIsTheWhole': 'Across the table, the grand total is the whole.',
  'l5.why.cellOverWhole': 'Write the cell over that whole, then cancel.',
  'l5.why.riseTogetherIsPositive': 'A rate above zero means the two readings rise together.',
  'l5.why.fallAgainstIsNegative': 'A rate below zero means one reading falls as the other rises.',

  // ------------------------------------------------------- why · growth
  'l5.why.factorBetweenReadings': 'Divide one reading by the reading before it to get the factor.',
  // Reads the line it sits under: $a \cdot b^{0} = a$. It used to say
  // "divide back by the factor", which described a step the echo no longer
  // shows — the echo writes the rule and reads it at zero instead.
  'l5.why.backToTheStart': 'A factor raised to nothing is one. So at zero the rule gives the starting amount.',
  'l5.why.percentFromFactor': 'Take one away from the factor, then multiply by one hundred.',
  'l5.why.startTimesFactorPower': 'The rule is the starting amount times the factor, raised to the input.',
  'l5.why.tryEachStep': 'Try each position in turn until the first rule leads.',
  'l5.why.factorBeatsStep': 'A factor beats a step once the position grows.',
};
