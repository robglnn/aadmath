/**
 * The item bank.
 *
 * Three commitments make this different from a normal question generator:
 *
 * 1. **Nothing is trusted because of how it was built.** Every item is handed
 *    to an independent parser/solver (`./parser.js`) which reads back the
 *    LaTeX the learner will actually see and works the answer out from
 *    scratch in exact rational arithmetic. Prompt, answer, *and every line of
 *    the worked solution* must agree. Anything that does not agree is thrown
 *    away before a human sees it. See `verify()`.
 *
 * 2. **A skill is not one template.** Each skill carries five to seven distinct
 *    item *forms* spread across representations — symbolic, tabular,
 *    graphical, verbal and real-world contextual — so "mastery" cannot be
 *    reached by learning the shape of one question. The scheduler in
 *    `mastery.js` deliberately draws unseen forms for the mastery check, which
 *    makes the final gate a transfer test rather than a repetition test.
 *
 * 3. **A difficulty band is a promise, so it is kept and measured.** Each step
 *    up the ladder widens the numbers a learner has to hold *and* adds a
 *    structural demand the band below did not have — signed constants at 2,
 *    signed coefficients and negative solutions at 3, non-integer values and
 *    longer chains at 4, and at 5 the easiest item forms stop being drawn at
 *    all. `demandOf()` scores an item and `tools/validate-items.mjs` fails the
 *    build unless the measured ladder rises strictly, per skill, d1 → d5.
 *
 * Items expose: `stem` (localised prose), `latex` (pure notation, identical in
 * every language), `figure` (optional diagram spec), `answer`, `distractors`
 * (the three shown when the surface narrows to a choice) and `diagnostics`
 * (the full tagged catalogue of wrong values this item can *recognise*, used
 * by `./diagnose.js` — an error that matches none of them is never given a
 * name), and `steps` (the worked solution used for faded worked examples).
 */
import {
  R, add, sub, mul, div, neg, str as rstr, texOf, fromString, eq as reqq, isZero, toNum,
  pow as rpow, cmp as rcmp, sign as rsign, isSafe,
} from './rational.js';
import {
  evaluate, solveLinear, equivalent, parse, evalAst, parseEquation, linearize, parseArrayCells, varsOf,
  // The quadratics strand. Every one of these reads the notation the learner
  // is shown and works the answer out again from nothing.
  solveQuadratic, polyCoeffs, polynomialise, polyDegree, polyTex, answerValues,
  evalSurd, radicandsOf, radicalInDenominator, containsSqrt, mentionsVar, walkAst,
  splitTop, parseArrayBlocks,
} from './parser.js';
import {
  S, SR, sAdd, sSub, sMul, sPow, sEq, sCmp, sIsZero, sIsRational, sTex, sTexOverOne,
  surdSpellings, simplifySqrt, rationalSqrt, isPerfectSquareR, surdSqrt, isSurd,
} from './surd.js';
import { makeT } from './strings.js';
// The shape of an option set is not this file's business alone: `src/ui/rift.js`
// balances the beam's move tray with the same instrument. See src/learn/shape.js.
import { balancedPick, shapeMix } from './shape.js';
import {
  registerPack, formsFor, setFormSummary,
  SKILLS as REGISTERED_SKILLS, FORMS_BY_SKILL as REGISTERED_FORMS_BY_SKILL,
} from '../content/registry.js';

// ---------------------------------------------------------------------------
// deterministic randomness
// ---------------------------------------------------------------------------
export function rng(seed) {
  let a = seed >>> 0;
  return function () {
    a |= 0; a = (a + 0x6d2b79f5) | 0;
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}
const pick = (r, arr) => arr[Math.floor(r() * arr.length)];
const int = (r, lo, hi) => (hi < lo ? lo : lo + Math.floor(r() * (hi - lo + 1)));
const nz = (r, lo, hi) => { let v = 0; for (let i = 0; i < 40 && v === 0; i++) v = int(r, lo, hi); return v || 1; };
/** A coefficient. Never 0, never ±1 — both make the item a different question. */
const nzc = (r, lo, hi) => {
  for (let i = 0; i < 60; i++) { const v = int(r, lo, hi); if (v !== 0 && Math.abs(v) !== 1) return v; }
  return lo < 0 ? -2 : 2;
};
const chance = (r, p) => r() < p;
const VARS = ['x', 'y', 'n', 'a', 'm', 't', 'k', 'p'];

// ---------------------------------------------------------------------------
// notation helpers — these only ever build LaTeX, never answers
// ---------------------------------------------------------------------------
function sg(n) { return n < 0 ? `- ${Math.abs(n)}` : `+ ${n}`; }
function co(c, v) {
  if (c === 1) return v;
  if (c === -1) return `-${v}`;
  return `${c}${v}`;
}
function sgc(c, v) {
  const a = Math.abs(c);
  const body = a === 1 ? v : `${a}${v}`;
  return c < 0 ? `- ${body}` : `+ ${body}`;
}
function term(c, v) { return c === 0 ? '0' : co(c, v); }
/** "3x + 5", "3x", "5", "0" */
function lin(a, v, b) {
  if (a === 0 && b === 0) return '0';
  if (a === 0) return String(b);
  if (b === 0) return co(a, v);
  return `${co(a, v)} ${sg(b)}`;
}
function paren(k, inner) {
  const head = k === 1 ? '' : k === -1 ? '-' : String(k);
  return `${head}\\left(${inner}\\right)`;
}
const NAMES = ['Rell', 'Voss', 'Ashe', 'Iro', 'Kade', 'Sol', 'Wren', 'Tal'];
const gcd = (a, b) => { a = Math.abs(a); b = Math.abs(b); while (b) [a, b] = [b, a % b]; return a || 1; };

// ---------------------------------------------------------------------------
// Situation decks.
//
// A form used to carry one situation, so a cadet who met "a drop-pod takes m
// cadets" on their third rift met it again on their eighth, eleventh and
// nineteenth. That is wallpaper, and a cadet stops reading wallpaper: the
// prose becomes a shape to skip past on the way to the numbers, which is the
// exact opposite of what a contextual item is for.
//
// So a situation is *drawn*, per item, from a deck of framings that share one
// mathematical structure and share nothing else. Every entry is a different
// instrument in a different part of the shard, with its own noun, its own
// units and its own question at the end — `k lots of v` is a bay of drop-pods,
// a rack of hydroponic trays, a run of cast struts and a signed-out crate of
// rations, and the algebra cannot tell them apart. The draw is seeded like
// everything else here, so an item is still reproducible from `(skill, band,
// seed)` and the echo can re-derive the analogue exactly.
//
// Entries are objects wherever the question has to agree with the noun: you
// count cadets out of a bay and metres off a spool, and "how many is that
// altogether?" is the sentence you write when you have not decided what the
// situation is about.
// ---------------------------------------------------------------------------
const DECKS = {
  // k identical groups of v.
  groups: [
    { ctx: 'ctx.pods', ask: 'ask.howManyCadets' },
    { ctx: 'ctx.trays', ask: 'ask.howManySeedlings' },
    { ctx: 'ctx.spools', ask: 'ask.howManyMetres' },
    { ctx: 'ctx.rations', ask: 'ask.howManyDays' },
    { ctx: 'ctx.flares', ask: 'ask.howManySeconds' },
    { ctx: 'ctx.ballast', ask: 'ask.howManyTonnes' },
    { ctx: 'ctx.waterCans', ask: 'ask.howManyLitres' },
    { ctx: 'ctx.fuelCells', ask: 'ask.howManyWatts' },
    { ctx: 'ctx.coreTubes', ask: 'ask.howManySamples' },
    { ctx: 'ctx.oxyCandles', ask: 'ask.howManyMinutes' },
    { ctx: 'ctx.relayWindows', ask: 'ask.howManyPackets' },
    { ctx: 'ctx.glazing', ask: 'ask.howManyPanes' },
    { ctx: 'ctx.brickMoulds', ask: 'ask.howManyBricks' },
    { ctx: 'ctx.lampCells', ask: 'ask.howManyCells' },
    { ctx: 'ctx.sledRuns', ask: 'ask.howManyKilometres' },
    { ctx: 'ctx.watchGlass', ask: 'ask.howManyHours' },
    { ctx: 'ctx.crucibles', ask: 'ask.howManyGrams' },
    { ctx: 'ctx.bunks', ask: 'ask.howManyCadets' },
    { ctx: 'ctx.medPacks', ask: 'ask.howManyDoses' },
    { ctx: 'ctx.cableDrums', ask: 'ask.howManyMetres' },
    { ctx: 'ctx.oreSkips', ask: 'ask.howManyTonnesRaised' },
    { ctx: 'ctx.seedVaults', ask: 'ask.howManySeedlingsPlanted' },
    { ctx: 'ctx.filters', ask: 'ask.howManyDaysAir' },
    { ctx: 'ctx.pulses', ask: 'ask.howManySeconds' },
    { ctx: 'ctx.resinSpools', ask: 'ask.howManyRivets' },
    { ctx: 'ctx.ladderSections', ask: 'ask.howManyMetres' },
    { ctx: 'ctx.stormShutters', ask: 'ask.howManyPanes' },
    { ctx: 'ctx.telemetry', ask: 'ask.howManyFrames' },
    { ctx: 'ctx.solarShingles', ask: 'ask.howManyWatts' },
    { ctx: 'ctx.kilnFirings', ask: 'ask.howManyHours' },
    { ctx: 'ctx.iceCores', ask: 'ask.howManyReadings' },
    { ctx: 'ctx.mantles', ask: 'ask.howManyLumens' },
    { ctx: 'ctx.thermalWraps', ask: 'ask.howManyDegrees' },
    { ctx: 'ctx.ropeCoils', ask: 'ask.howManyMetres' },
    { ctx: 'ctx.airBottles', ask: 'ask.howManyLitres' },
    { ctx: 'ctx.markerStakes', ask: 'ask.howManyKilometres' },
    { ctx: 'ctx.dryRations', ask: 'ask.howManyDays' },
    { ctx: 'ctx.printPlates', ask: 'ask.howManyFramesHeld' },
    { ctx: 'ctx.saltBlocks', ask: 'ask.howManyTonnesBarged' },
    { ctx: 'ctx.chargeCoils', ask: 'ask.howManyWatts' },
    { ctx: 'ctx.hullPatches', ask: 'ask.howManyPlates' },
    { ctx: 'ctx.gasBladders', ask: 'ask.howManyLitres' },
    { ctx: 'ctx.snowMelters', ask: 'ask.howManyLitres' },
    { ctx: 'ctx.tallySticks', ask: 'ask.howManyReadings' },
    { ctx: 'ctx.windMills', ask: 'ask.howManyWatts' },
    { ctx: 'ctx.pickAxes', ask: 'ask.howManyHours' },
    { ctx: 'ctx.chartRolls', ask: 'ask.howManyMetres' },
    { ctx: 'ctx.beeFrames', ask: 'ask.howManyGrams' },
    { ctx: 'ctx.soundBuoys', ask: 'ask.howManySecondsPing' },
    { ctx: 'ctx.spareBolts', ask: 'ask.howManyRivets' },
    { ctx: 'ctx.wickBundles', ask: 'ask.howManyHours' },
    { ctx: 'ctx.tarBarrels', ask: 'ask.howManyPlates' },
    { ctx: 'ctx.pressCakes', ask: 'ask.howManyLitres' },
    { ctx: 'ctx.signalKites', ask: 'ask.howManyMinutes' },
    { ctx: 'ctx.stoveBricks', ask: 'ask.howManyDegrees' },
    { ctx: 'ctx.roeTrays', ask: 'ask.howManySeedlingsPlanted' },
    { ctx: 'ctx.sparRods', ask: 'ask.howManyMetres' },
    { ctx: 'ctx.beltLinks', ask: 'ask.howManyTonnesBarged' },
    { ctx: 'ctx.gasMantle', ask: 'ask.howManyLumens' },
    { ctx: 'ctx.tallyBoards', ask: 'ask.howManyReadings' },
    { ctx: 'ctx.dripFeeds', ask: 'ask.howManyDoses' },
    { ctx: 'ctx.spoilCarts', ask: 'ask.howManyKilometres' },
    { ctx: 'ctx.pinionGears', ask: 'ask.howManyWatts' },
    { ctx: 'ctx.saltCribs', ask: 'ask.howManyGrams' },
  ],
  // A known part beside an unknown one — v of something, and c more of the
  // same thing. Every question here is one this bank already asks of a
  // product, so the deck is new and the questions are not: what changes is the
  // sentence, which is the whole point of it existing. See `vm-partWhole`.
  partWhole: [
    { ctx: 'ctx.pwMuster', ask: 'ask.howManyCadets' },
    { ctx: 'ctx.pwReel', ask: 'ask.howManyMetres' },
    { ctx: 'ctx.pwTank', ask: 'ask.howManyLitres' },
    { ctx: 'ctx.pwGlazing', ask: 'ask.howManyPanes' },
    { ctx: 'ctx.pwBank', ask: 'ask.howManyCells' },
    { ctx: 'ctx.pwSledRun', ask: 'ask.howManyKilometres' },
    { ctx: 'ctx.pwScalePan', ask: 'ask.howManyGrams' },
    { ctx: 'ctx.pwSeam', ask: 'ask.howManyRivets' },
    { ctx: 'ctx.pwWatchLog', ask: 'ask.howManyReadings' },
    { ctx: 'ctx.pwLamp', ask: 'ask.howManyLumens' },
    { ctx: 'ctx.pwWarmBay', ask: 'ask.howManyDegrees' },
    { ctx: 'ctx.pwHull', ask: 'ask.howManyPlates' },
    { ctx: 'ctx.pwNursery', ask: 'ask.howManySeedlings' },
    { ctx: 'ctx.pwLarder', ask: 'ask.howManyDays' },
    { ctx: 'ctx.pwFlare', ask: 'ask.howManySeconds' },
    { ctx: 'ctx.pwKeel', ask: 'ask.howManyTonnes' },
    { ctx: 'ctx.pwArray', ask: 'ask.howManyWatts' },
    { ctx: 'ctx.pwCoreRack', ask: 'ask.howManySamples' },
    { ctx: 'ctx.pwCandle', ask: 'ask.howManyMinutes' },
    { ctx: 'ctx.pwRelay', ask: 'ask.howManyPackets' },
    { ctx: 'ctx.pwKilnRun', ask: 'ask.howManyBricks' },
    { ctx: 'ctx.pwWatchGlass', ask: 'ask.howManyHours' },
    { ctx: 'ctx.pwFilm', ask: 'ask.howManyFramesHeld' },
    { ctx: 'ctx.pwMedChest', ask: 'ask.howManyDoses' },
    { ctx: 'ctx.pwLadder', ask: 'ask.howManyMetres' },
    { ctx: 'ctx.pwRainTank', ask: 'ask.howManyLitres' },
  ],
  // An unknown total, cut into k equal shares. The question is always the same
  // one — which expression is a single share — so these are plain framings.
  shareOut: ['ctx.soCable', 'ctx.soWater', 'ctx.soRations', 'ctx.soOre',
    'ctx.soWatch', 'ctx.soPower', 'ctx.soSeed', 'ctx.soFuel',
    'ctx.soCanvas', 'ctx.soSalt', 'ctx.soRope', 'ctx.soGrain',
    'ctx.soIce', 'ctx.soAir', 'ctx.soWire', 'ctx.soCoal', 'ctx.soPaint',
    'ctx.soClay', 'ctx.soThread', 'ctx.soSoup', 'ctx.soSand', 'ctx.soCredit',
    'ctx.soCuttings', 'ctx.soSamples', 'ctx.soTape', 'ctx.soChain',
    'ctx.soAsh', 'ctx.soDoses'],
  // b groups of a groups of v.
  nested: [
    { ctx: 'ctx.nested', ask: 'ask.howManyCadets' },
    { ctx: 'ctx.nestedTrays', ask: 'ask.howManySeedlings' },
    { ctx: 'ctx.nestedVials', ask: 'ask.howManyDoses' },
    { ctx: 'ctx.nestedStruts', ask: 'ask.howManyMetres' },
    { ctx: 'ctx.nestedCells', ask: 'ask.howManyWatts' },
    { ctx: 'ctx.nestedCores', ask: 'ask.howManySamples' },
    { ctx: 'ctx.nestedBricks', ask: 'ask.howManyBricks' },
    { ctx: 'ctx.nestedCans', ask: 'ask.howManyLitres' },
    { ctx: 'ctx.nestedPacks', ask: 'ask.howManyDosesStowed' },
    { ctx: 'ctx.nestedCable', ask: 'ask.howManyMetres' },
    { ctx: 'ctx.nestedBunks', ask: 'ask.howManyCadets' },
    { ctx: 'ctx.nestedPanes', ask: 'ask.howManyPanes' },
    { ctx: 'ctx.nestedPatches', ask: 'ask.howManyPlates' },
    { ctx: 'ctx.nestedMills', ask: 'ask.howManyWatts' },
    { ctx: 'ctx.nestedBuoys', ask: 'ask.howManySecondsPing' },
    { ctx: 'ctx.nestedRivets', ask: 'ask.howManyRivets' },
    { ctx: 'ctx.nestedCrucibles', ask: 'ask.howManyGrams' },
    { ctx: 'ctx.nestedWatches', ask: 'ask.howManyHours' },
    { ctx: 'ctx.nestedSondes', ask: 'ask.howManyReadings' },
    { ctx: 'ctx.nestedLegs', ask: 'ask.howManyKilometres' },
    { ctx: 'ctx.nestedSkips', ask: 'ask.howManyTonnesRaised' },
    { ctx: 'ctx.nestedMantles', ask: 'ask.howManyLumens' },
    { ctx: 'ctx.nestedWindows', ask: 'ask.howManyPackets' },
    { ctx: 'ctx.nestedCandles', ask: 'ask.howManyMinutes' },
    { ctx: 'ctx.nestedBlocks', ask: 'ask.howManyDays' },
    { ctx: 'ctx.nestedPlates', ask: 'ask.howManyFramesHeld' },
    { ctx: 'ctx.nestedPots', ask: 'ask.howManySeedlingsPlanted' },
  ],
  // Somebody has decided a letter is worth its place in the alphabet.
  claim: ['ctx.alphabetClaim', 'ctx.claimRoster', 'ctx.claimOldRig', 'ctx.claimBet',
    'ctx.claimPrimer', 'ctx.claimGraffiti', 'ctx.claimBunkmate', 'ctx.claimBroadcast',
    'ctx.claimTag', 'ctx.claimDrill', 'ctx.claimLedger', 'ctx.claimSong',
    'ctx.claimSlate', 'ctx.claimTutor', 'ctx.claimDare', 'ctx.claimPoster',
    'ctx.claimStencil', 'ctx.claimTeacher', 'ctx.claimSpine', 'ctx.claimQuiz',
    'ctx.claimKeel', 'ctx.claimMate',
    'ctx.claimNotebook', 'ctx.claimGame', 'ctx.claimSign', 'ctx.claimHabit',
    'ctx.claimFirst', 'ctx.claimCousin', 'ctx.claimCrate', 'ctx.claimCallSign',
    'ctx.claimNotes', 'ctx.claimDoors', 'ctx.claimBadge', 'ctx.claimBar'],
  // One rule at the head of a column, four rows, one reading destroyed.
  logRule: ['ctx.logDrone', 'ctx.logCore', 'ctx.logTide', 'ctx.logKiln', 'ctx.logRelay', 'ctx.logOrchard',
    'ctx.logSonde', 'ctx.logCentrifuge', 'ctx.logMill', 'ctx.logHatchery', 'ctx.logAssay',
    'ctx.logFurnace', 'ctx.logPress', 'ctx.logConveyor', 'ctx.logAntenna', 'ctx.logGlacier',
    'ctx.logStill', 'ctx.logLoom', 'ctx.logForge', 'ctx.logHive', 'ctx.logSpring', 'ctx.logDynamo',
    'ctx.logBellows', 'ctx.logCrusher', 'ctx.logSluice', 'ctx.logAviary', 'ctx.logCompass',
    'ctx.logGrinder', 'ctx.logStack', 'ctx.logWeir', 'ctx.logDrier', 'ctx.logCarding',
    'ctx.logKelp', 'ctx.logVane', 'ctx.logSeedDrill', 'ctx.logRopeWalk', 'ctx.logTannery',
    'ctx.logIceSaw', 'ctx.logPumpHouse', 'ctx.logQuarry', 'ctx.logSmokeHouse', 'ctx.logBoiler',
    'ctx.logLathe', 'ctx.logBellTower', 'ctx.logTram', 'ctx.logGantry', 'ctx.logNetLoft',
    'ctx.logRainGauge'],
  // The same, where the header is a sum because two things write into it.
  logSum: ['ctx.logTwoSensors', 'ctx.logTwoCrews', 'ctx.logTwoFeeds',
    'ctx.logTwoWells', 'ctx.logTwoShifts', 'ctx.logTwoStills', 'ctx.logTwoMasts', 'ctx.logTwoBelts'],
  // The same, where the header measures one unit and multiplies up.
  logScaled: ['ctx.logBanks', 'ctx.logPerCrate', 'ctx.logPerDeck',
    'ctx.logPerCoil', 'ctx.logPerBay', 'ctx.logPerRow', 'ctx.logPerSled', 'ctx.logPerHive'],
  // In and out, and it is the *input* that burned — so the rule runs backwards.
  logInverse: ['ctx.logAirlock', 'ctx.logGain', 'ctx.logFab', 'ctx.logRefinery', 'ctx.logCourier',
    'ctx.logStamp', 'ctx.logDye', 'ctx.logTuner', 'ctx.logMint', 'ctx.logSmelter',
    'ctx.logHone', 'ctx.logBleach'],
  // A fixed charge, then a charge per cycle. Four sentences each, because the
  // running strip, the torn bill and the question at the end are the same fee
  // seen from other angles — and a tow is not a stay, so it is not asked about
  // as though it were.
  flatRate: [
    { ctx: 'ctx.dockFee', strip: 'ctx.dockLog', bill: 'ctx.dockBill', ask: 'ask.costOfStay', cycles: 'ask.howManyCycles' },
    { ctx: 'ctx.hangarFee', strip: 'ctx.hangarLog', bill: 'ctx.hangarBill', ask: 'ask.costOfStay', cycles: 'ask.howManyCycles' },
    { ctx: 'ctx.tugFee', strip: 'ctx.tugLog', bill: 'ctx.tugBill', ask: 'ask.costOfTow', cycles: 'ask.howManyCyclesTow' },
    { ctx: 'ctx.berthFee', strip: 'ctx.berthLog', bill: 'ctx.berthBill', ask: 'ask.costOfBerth', cycles: 'ask.howManyCyclesBerth' },
    { ctx: 'ctx.craneFee', strip: 'ctx.craneLog', bill: 'ctx.craneBill', ask: 'ask.costOfHire', cycles: 'ask.howManyCyclesHire' },
    { ctx: 'ctx.kilnFee', strip: 'ctx.kilnFeeLog', bill: 'ctx.kilnBill', ask: 'ask.costOfFiring', cycles: 'ask.howManyCyclesFiring' },
    { ctx: 'ctx.lockupFee', strip: 'ctx.lockupLog', bill: 'ctx.lockupBill', ask: 'ask.costOfStorage', cycles: 'ask.howManyCyclesStorage' },
    { ctx: 'ctx.pilotFee', strip: 'ctx.pilotLog', bill: 'ctx.pilotBill', ask: 'ask.costOfPassage', cycles: 'ask.howManyCyclesPassage' },
    { ctx: 'ctx.slipFee', strip: 'ctx.slipLog', bill: 'ctx.slipBill', ask: 'ask.costOfSlip', cycles: 'ask.howManyCyclesSlip' },
    { ctx: 'ctx.stallFee', strip: 'ctx.stallLog', bill: 'ctx.stallBill', ask: 'ask.costOfStall', cycles: 'ask.howManyCyclesStall' },
    { ctx: 'ctx.rigFee', strip: 'ctx.rigLog', bill: 'ctx.rigBill', ask: 'ask.costOfRig', cycles: 'ask.howManyCyclesRig' },
    { ctx: 'ctx.escortFee', strip: 'ctx.escortLog', bill: 'ctx.escortBill', ask: 'ask.costOfEscort', cycles: 'ask.howManyCyclesEscort' },
  ],
  // A gauge that reads the present and never recorded the past.
  holdBack: [
    { ctx: 'ctx.cargo', ask: 'ask.startingMass', model: 'ask.whichEquationHold' },
    { ctx: 'ctx.silo', ask: 'ask.startingGrain', model: 'ask.whichEquationSilo' },
    { ctx: 'ctx.reservoir', ask: 'ask.startingLevel', model: 'ask.whichEquationReservoir' },
    { ctx: 'ctx.bunker', ask: 'ask.startingBunker', model: 'ask.whichEquationBunker' },
    { ctx: 'ctx.cistern', ask: 'ask.startingCistern', model: 'ask.whichEquationCistern' },
    { ctx: 'ctx.saltPan', ask: 'ask.startingSaltPan', model: 'ask.whichEquationSaltPan' },
    { ctx: 'ctx.icehouse', ask: 'ask.startingIce', model: 'ask.whichEquationIcehouse' },
    { ctx: 'ctx.tailings', ask: 'ask.startingTailings', model: 'ask.whichEquationTailings' },
    { ctx: 'ctx.stockpile', ask: 'ask.startingStockpile', model: 'ask.whichEquationStockpile' },
    { ctx: 'ctx.feedBin', ask: 'ask.startingFeed', model: 'ask.whichEquationFeedBin' },
    { ctx: 'ctx.coalHeap', ask: 'ask.startingCoal', model: 'ask.whichEquationCoal' },
    { ctx: 'ctx.brineTank', ask: 'ask.startingBrine', model: 'ask.whichEquationBrine' },
    { ctx: 'ctx.slagPile', ask: 'ask.startingSlag', model: 'ask.whichEquationSlag' },
    { ctx: 'ctx.waterButt', ask: 'ask.startingButt', model: 'ask.whichEquationButt' },
    { ctx: 'ctx.hopperBin', ask: 'ask.startingHopper', model: 'ask.whichEquationHopper' },
    { ctx: 'ctx.peatStack', ask: 'ask.startingPeat', model: 'ask.whichEquationPeat' },
    { ctx: 'ctx.oreBunk', ask: 'ask.startingOreBunk', model: 'ask.whichEquationOreBunk' },
    { ctx: 'ctx.mealSilo', ask: 'ask.startingMeal', model: 'ask.whichEquationMeal' },
    { ctx: 'ctx.snowLoad', ask: 'ask.startingSnow', model: 'ask.whichEquationSnow' },
    { ctx: 'ctx.ballastHold', ask: 'ask.startingBallast', model: 'ask.whichEquationBallast' },
  ],
  // k sealed identical things and one total.
  identicals: [
    { ctx: 'ctx.crates', ask: 'ask.oneCrateMass' },
    { ctx: 'ctx.drums', ask: 'ask.oneDrumMass' },
    { ctx: 'ctx.pallets', ask: 'ask.onePalletMass' },
    { ctx: 'ctx.sacks', ask: 'ask.oneSackMass' },
    { ctx: 'ctx.casks', ask: 'ask.oneCaskMass' },
    { ctx: 'ctx.billets', ask: 'ask.oneBilletMass' },
    { ctx: 'ctx.bales', ask: 'ask.oneBaleMass' },
    { ctx: 'ctx.coils', ask: 'ask.oneCoilMass' },
  ],
  beamOne: [
    { ctx: 'ctx.beamOne', ask: 'ask.oneCrateMass' },
    { ctx: 'ctx.assayOne', ask: 'ask.oneCanisterMass' },
    { ctx: 'ctx.beamSack', ask: 'ask.oneSackMass' },
    { ctx: 'ctx.beamCask', ask: 'ask.oneCaskMass' },
    { ctx: 'ctx.beamSeed', ask: 'ask.oneSeedPodMass' },
    { ctx: 'ctx.beamCore', ask: 'ask.oneCoreMass' },
    { ctx: 'ctx.beamBale', ask: 'ask.oneBaleMass' },
    { ctx: 'ctx.beamJar', ask: 'ask.oneJarMass' },
    { ctx: 'ctx.beamBillet', ask: 'ask.oneBilletMass' },
    { ctx: 'ctx.beamCrucible', ask: 'ask.oneCrucibleMass' },
    { ctx: 'ctx.beamKeg', ask: 'ask.oneKegMass' },
    { ctx: 'ctx.beamTin', ask: 'ask.oneTinMass' },
  ],
  beamMany: [
    { ctx: 'ctx.beamMany', ask: 'ask.oneCrateMass' },
    { ctx: 'ctx.assayMany', ask: 'ask.oneCanisterMass' },
    { ctx: 'ctx.beamManySacks', ask: 'ask.oneSackMass' },
    { ctx: 'ctx.beamManyCasks', ask: 'ask.oneCaskMass' },
    { ctx: 'ctx.beamManyCores', ask: 'ask.oneCoreMass' },
    { ctx: 'ctx.beamManyBales', ask: 'ask.oneBaleMass' },
    { ctx: 'ctx.beamManyBillets', ask: 'ask.oneBilletMass' },
    { ctx: 'ctx.beamManyJars', ask: 'ask.oneJarMass' },
  ],
  // The bare instruction that sits over a symbolic reading. Three ways of
  // asking one thing, so the sentence above the notation is not furniture.
  askValue: ['ask.valueWhen', 'ask.worthWhen', 'ask.settleWhen'],
  askEvaluate: ['ask.evaluate', 'ask.evaluateAlt', 'ask.evaluateAlt2'],
  askSimplify: ['ask.simplify', 'ask.simplifyAlt', 'ask.simplifyAlt2'],
  askExpand: ['ask.expand', 'ask.expandAlt', 'ask.expandAlt2'],
  askWhen: ['ask.evaluateWhen', 'ask.evaluateWhenAlt', 'ask.evaluateWhenAlt2'],
  askSolve: ['ask.solveFor', 'ask.solveForAlt', 'ask.solveForAlt2'],
  // Something that starts at b and loses a of itself per minute.
  decay: ['ctx.charge', 'ctx.coolant', 'ctx.tether',
    'ctx.airReserve', 'ctx.hopper', 'ctx.lampOil', 'ctx.iceShelf', 'ctx.stipend',
    'ctx.frostLine', 'ctx.signalLoss', 'ctx.waterHead', 'ctx.paintReel',
    'ctx.rooftank', 'ctx.creditLine', 'ctx.snowPack', 'ctx.brakeShoe', 'ctx.tideRace', 'ctx.kilnHeat',
    'ctx.oxyBottle', 'ctx.battBank', 'ctx.tideFlat', 'ctx.brineLevel', 'ctx.sandGlass',
    'ctx.wheelPress', 'ctx.grainChute', 'ctx.dyeVat', 'ctx.ropeStrand', 'ctx.wickLamp'],
  // One straight trace, drawn for you, all the way along.
  trace: ['ctx.beacon', 'ctx.balloonChart', 'ctx.winchChart',
    'ctx.sledChart', 'ctx.tideChart', 'ctx.kiteChart', 'ctx.drillChart',
    'ctx.cableChart', 'ctx.frostChart', 'ctx.glideChart',
    'ctx.tramChart', 'ctx.pumpChart', 'ctx.mothChart',
    'ctx.railChart', 'ctx.ferryChart', 'ctx.liftChart', 'ctx.creepChart',
    'ctx.thawChart', 'ctx.spoolChart', 'ctx.dustChart', 'ctx.gaugeChart'],
  twoTraces: ['ctx.twoBeacons', 'ctx.twoLifts',
    'ctx.twoSleds', 'ctx.twoDrills', 'ctx.twoBalloons', 'ctx.twoTides'],
  // Two cadets, two answers, one of them true.
  /* `ctx.disputeAudit` used to sit here and does not any more. Every framing
     in this deck REPORTS two readings; that one PROMISED — "The audit takes
     one" — and since `quoteReadings` draws both quoted readings out of the
     wrong ones on a free keypad, a sentence that says one of them is the one
     to file is a sentence the card cannot keep. It is still a framing, and any
     form that really does print the answer may use it. */
  dispute: ['ctx.dispute', 'ctx.disputeBoard', 'ctx.disputeGalley',
    'ctx.disputeBridge', 'ctx.disputeInk', 'ctx.disputeRadio', 'ctx.disputeWager'],
  disputeSolve: ['ctx.disputeSolve', 'ctx.disputeUndo',
    'ctx.disputeReverse', 'ctx.disputeStrip', 'ctx.disputeUnpick', 'ctx.disputeBackwards'],
  disputeExpand: ['ctx.disputeExpand', 'ctx.disputeReach',
    'ctx.disputeShare', 'ctx.disputeDoorway', 'ctx.disputeHalfway', 'ctx.disputeOutside'],
  // A rectangle whose sides are expressions.
  plate: ['ctx.plate', 'ctx.hatch',
    'ctx.viewport', 'ctx.deckMat', 'ctx.solarFrame', 'ctx.tarp', 'ctx.gate', 'ctx.mirrorBlank',
    'ctx.deckPlate', 'ctx.filterFrame'],
  panel: ['ctx.panel', 'ctx.bulkhead',
    'ctx.banner', 'ctx.floorPan', 'ctx.gardenBed', 'ctx.dragSail', 'ctx.doorLeaf', 'ctx.dustScreen',
    'ctx.awning', 'ctx.baffle', 'ctx.trapDoor', 'ctx.solarBank', 'ctx.windBreak', 'ctx.coldFrame',
    'ctx.shutterPanel'],
  // A total that has to be handed over as a count and a unit.
  asUnits: ['ctx.asPallets', 'ctx.asRacks',
    'ctx.asCrates', 'ctx.asDrums', 'ctx.asBundles', 'ctx.asTrays'],
  filedTwice: ['ctx.filedTwice', 'ctx.twoForms',
    'ctx.twoClerks', 'ctx.twoLedgers', 'ctx.twoTags', 'ctx.twoQuotes', 'ctx.twoManifests',
    'ctx.twoSignals', 'ctx.twoChalks'],
  // A fixed number of shifts on top of a per-crew rate.
  crew: ['ctx.crew', 'ctx.watches',
    'ctx.teams', 'ctx.gangs', 'ctx.wings', 'ctx.sections'],
  // Two plans, two rates, one crossing.
  plans: ['ctx.plans', 'ctx.hauliers',
    'ctx.couriers', 'ctx.kilnsPlan', 'ctx.berthsPlan', 'ctx.riggers'],
};
/**
 * Draw one framing from a deck.
 *
 * The draw runs on `sr`, a stream derived from the item's seed but separate
 * from the one the mathematics is drawn on. That separation is the point: the
 * numbers an item asks about are exactly the numbers it asked about before
 * this file grew any decks at all, so the measured difficulty ladder in
 * tools/validate-items.mjs still describes the same bank, and choosing a
 * different situation can never quietly make a band easier.
 *
 * The draw is not uniform, and that is the second point.
 *
 * A uniform draw from a deck of six will show a cadet the same sentence twice
 * inside ten items — the birthday problem does not care how well written the
 * sentence is — and the scheduler's `avoidScenes` list could only ask for a
 * re-roll, which a bounded retry budget is free to give up on. Measured on the
 * shipping schedule, the first forty-five items of a session used to contain
 * fourteen distinct situations, one of them eight times. By the third repeat a
 * cadet has stopped reading the words, and a contextual item nobody reads is a
 * symbolic item wearing a hat.
 *
 * So the bank keeps its own ledger of what it has already served this session
 * and draws only from the framings it has served *least*. A deck therefore
 * deals itself out completely before it deals any card twice, which makes
 * repetition inside a session impossible rather than unlikely — no cooperation
 * required from whoever is calling, so the worked analogue drawn alongside an
 * item lands somewhere new too.
 */
const SERVED = new Map();
/** Start a fresh session — the ledger of framings already shown is cleared. */
export function resetSituations() { SERVED.clear(); }
/** How many times each framing has been served since the last reset. */
export function situationsServed() { return new Map(SERVED); }
/**
 * Record a framing that reached a learner by some route other than a plain
 * `generate()` — used by the worked-analogue draw, which builds and rejects
 * dozens of candidates before it finds one that cannot be copied off, and must
 * not charge the ledger for the ones nobody ever saw.
 */
export function noteSituation(scene) {
  for (const key of String(scene || '').split('+')) {
    if (key) SERVED.set(key, (SERVED.get(key) || 0) + 1);
  }
}

let SCENE_LOG = [];
let DRAWN = [];
let AVOID = new Set();
const keyOfEntry = (e) => (typeof e === 'string' ? e : e.ctx);
const deck = (sr, name) => {
  const entries = DECKS[name];
  // What the scheduler has explicitly refused — the proving run naming every
  // world this learner has already worked inside — comes off the top.
  let pool = entries.filter((e) => !AVOID.has(keyOfEntry(e)));
  if (!pool.length) pool = entries;
  // Then the session ledger: only the framings this deck has shown fewest
  // times survive, so the deck cycles before it repeats.
  let least = Infinity;
  for (const e of pool) least = Math.min(least, SERVED.get(keyOfEntry(e)) || 0);
  const freshest = pool.filter((e) => (SERVED.get(keyOfEntry(e)) || 0) === least);
  const chosen = pick(sr, freshest.length ? freshest : pool);
  const key = keyOfEntry(chosen);
  if (isSceneKey(key)) SCENE_LOG.push(key);
  if (key) DRAWN.push(key);
  return chosen;
};

/**
 * Is this deck key the name of a SITUATION, rather than of a question?
 *
 * The core bank names its framings `ctx.something`. A pack namespaces its own
 * — `l2.ctx.hoist` — and the original test, `startsWith('ctx.')`, said no to
 * every one of them. See `packScene` below for what that cost.
 */
const isSceneKey = (k) => /(?:^|\.)ctx\./.test(String(k || ''));

/**
 * A PACK'S OWN DECK, drawn through the engine's ledger.
 *
 * WHY THIS EXISTS. A generator pack cannot reach `DECKS`, so Algebra I Level 2
 * keeps its own lists of framings and drew from them with a plain `pick`. That
 * looked equivalent and was not: `pick` does not touch `SCENE_LOG`, `DRAWN` or
 * `AVOID`, so every Level 2 item came back with `item.scene` EMPTY, and three
 * separate mechanisms that all key off `scene` went quietly dark for a whole
 * unit —
 *
 *   · the proving run's transfer test. `generate` refuses a situation the
 *     learner has already worked inside, which is what makes the gate a
 *     transfer test rather than a fourth rehearsal. Measured across the level,
 *     2.2% of gate items were in an unseen form or world, against 68.1% in
 *     Level 1 — and true mastery came out at 67% against Level 1's 100%.
 *   · the session ledger, which cycles a deck before it repeats. Uncharged, a
 *     pack's five framings can come up in any order, including twice running.
 *   · the worked analogue, which is told not to reuse the live item's
 *     situation. With no scene to name, it was never told anything.
 *
 * Packs draw through this instead of `pick`, and all three come back on.
 *
 * @param {()=>number} sr  the situation stream, as handed to `build`
 * @param {Array<string|{ctx:string}>} entries  the pack's own framings
 */
function packScene(sr, entries) {
  if (!Array.isArray(entries) || !entries.length) throw new Error('a deck with no framings');
  let pool = entries.filter((e) => !AVOID.has(keyOfEntry(e)));
  if (!pool.length) pool = entries;
  let least = Infinity;
  for (const e of pool) least = Math.min(least, SERVED.get(keyOfEntry(e)) || 0);
  const freshest = pool.filter((e) => (SERVED.get(keyOfEntry(e)) || 0) === least);
  const chosen = pick(sr, freshest.length ? freshest : pool);
  const key = keyOfEntry(chosen);
  if (isSceneKey(key)) SCENE_LOG.push(key);
  if (key) DRAWN.push(key);
  return chosen;
}

/** Every number in a worked example must be traceable to where it came from. */
function distinct(...ns) {
  const seen = new Set();
  for (const n of ns) {
    const k = Math.abs(n);
    if (seen.has(k)) return false;
    seen.add(k);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Difficulty shaping.
//
// Five bands, and each one is genuinely a rung: the magnitude a learner has to
// hold roughly doubles every two bands, negatives enter at 2 (constants) and 3
// (coefficients and solutions), and non-integer intermediate values at 4. The
// form pool changes too — the introductory forms drop out above band 3 — so a
// band-5 item is not a band-1 item with bigger digits.
// ---------------------------------------------------------------------------
const BANDS = {
  1: { coef: [2, 4], konst: [1, 8], root: [1, 6], val: [1, 8], groups: [2, 4], neg: false, negSol: false, frac: false, chart: 7 },
  2: { coef: [2, 6], konst: [-12, 12], root: [1, 10], val: [1, 11], groups: [2, 6], neg: 'konst', negSol: false, frac: false, chart: 7 },
  3: { coef: [-8, 8], konst: [-16, 16], root: [-9, 11], val: [-9, 12], groups: [2, 8], neg: true, negSol: true, frac: false, chart: 9 },
  4: { coef: [-11, 11], konst: [-22, 22], root: [-13, 13], val: [-13, 14], groups: [3, 10], neg: true, negSol: true, frac: true, chart: 11 },
  5: { coef: [-18, 18], konst: [-40, 40], root: [-21, 21], val: [-21, 22], groups: [3, 14], neg: true, negSol: true, frac: true, chart: 13 },
};
function band(d) { return BANDS[Math.max(1, Math.min(5, d | 0))] || BANDS[1]; }

// Signed draws — used where the mathematics can carry a negative.
const Bcoef = (r, d) => nzc(r, ...band(d).coef);
const Bkonst = (r, d) => nz(r, ...band(d).konst);
const Broot = (r, d) => (band(d).negSol ? nz(r, ...band(d).root) : int(r, 1, band(d).root[1]));
const Bval = (r, d) => (band(d).neg === true ? nz(r, ...band(d).val) : int(r, 1, band(d).val[1]));
// Positive draws — used where the *situation* forbids a negative (credits,
// tonnes, cycles). The ladder still rises; it rises through magnitude.
const Pcoef = (r, d) => int(r, 2, band(d).coef[1]);
const Pkonst = (r, d) => int(r, 2, band(d).konst[1]);
const Proot = (r, d) => int(r, 2, band(d).root[1]);
const Pgroups = (r, d) => int(r, ...band(d).groups);

// ---------------------------------------------------------------------------
// Form definitions, per skill.
// Every builder returns a raw item; `finalize` verifies it before it escapes.
// ---------------------------------------------------------------------------
const FORMS = {

  // =======================================================================
  'var-meaning': [
    {
      // The first symbolic reading of "a number written against a letter", and
      // the one place the ladder used to be a lie: every band drew a positive
      // count times a positive value, so band 5 was band 1 with longer digits
      // and the same single move. It now deepens structurally. From band 3 the
      // value substituted may be negative, which is the first time a cadet has
      // to carry a sign through a product they did not write down; from band 4
      // the coefficient may be negative too, so the sign of the answer is no
      // longer decided by one of the two numbers on screen.
      id: 'vm-groups', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
      build({ r, d, T, sr }) {
        const ask = deck(sr, 'askValue');
        const v = pick(r, VARS);
        const k = d >= 4 ? Bcoef(r, d) : Pgroups(r, d);
        const val = d >= 3 ? Bval(r, d) : int(r, 2, band(d).val[1]);
        if (!distinct(k, val)) throw new Error('retry: repeated number');
        if (Math.abs(val) < 2) throw new Error('retry: a value of one teaches nothing here');
        const ans = k * val;
        // "43" for 4 times 3 is only a *reading* of the notation when both are
        // written plainly; "-4-3" is not a number anybody meant, so the slip is
        // only offered where it is a slip somebody could actually make.
        const plain = k > 0 && val > 0;
        return {
          stem: T(ask, { v, val }),
          latex: co(k, v),
          type: 'numeric',
          answer: String(ans),
          check: { kind: 'evaluate', math: co(k, v), env: { [v]: val } },
          steps: [
            { latex: `${co(k, v)} = ${k} \\cdot ${v}`, why: T('why.juxtaposition', { k, v }) },
            { latex: `${k} \\cdot ${v} = ${k} \\cdot \\left(${val}\\right) = ${ans}`, why: T('why.substituteThenMultiply', { v, val }) },
          ],
          distractors: [
            ...(plain ? [{ v: `${k}${val}`, m: 'implicit-mult-missed' }] : []),
            { v: String(k * Math.abs(val)), m: 'neg-substitution' },
            { v: String(-ans), m: 'sign-slip' },
            { v: String(k + val), m: 'add-not-multiply' },
            { v: String(k * (VARS.indexOf(v) + 1)), m: 'letter-as-position' },
            { v: String(VARS.indexOf(v) + 1 + k), m: 'letter-as-position' },
            { v: String(ans - k), m: 'arith-slip' },
            { v: String(ans + k), m: 'arith-slip' },
            { v: String(ans - val), m: 'arith-slip' },
            { v: String(val - k), m: 'subtract-not-multiply' },
            { v: String(val), m: 'partial-rule' },
            // "4m" read as "4 metres": the letter taken for a label on the 4,
            // so the quantity is just the 4. Kuchemann's letter-as-object, and
            // the only place in this skill where that name is deserved.
            { v: String(k), m: 'letter-as-object' },
          ],
        };
      },
    },
    {
      id: 'vm-context', rep: 'context', dMin: 1, dMax: 5, distinctNums: true, scenes: 'groups',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'groups');
        const v = pick(r, VARS);
        const k = Pgroups(r, d);
        const val = int(r, 3, band(d).val[1] + 2);
        if (!distinct(k, val)) throw new Error('retry: repeated number');
        const ans = k * val;
        return {
          stem: `${T(sc.ctx, { v, k })} ${T(sc.ask, { v, val })}`,
          latex: co(k, v),
          type: 'numeric',
          answer: String(ans),
          check: { kind: 'evaluate', math: co(k, v), env: { [v]: val } },
          steps: [
            { latex: `${co(k, v)} = ${k} \\cdot ${val}`, why: T('why.substituteHere', { v, val }) },
            { latex: `${k} \\cdot ${val} = ${ans}`, why: T('why.countGroups', { k }) },
          ],
          distractors: [
            { v: String(k + val), m: 'add-not-multiply' },
            { v: `${k}${val}`, m: 'implicit-mult-missed' },
            { v: String(k * val - k), m: 'arith-slip' },
            { v: String(k * val + k), m: 'arith-slip' },
            { v: String(k * val - val), m: 'arith-slip' },
            { v: String(val - k), m: 'subtract-not-multiply' },
            { v: String(val), m: 'partial-rule' },
            { v: String(k), m: 'letter-as-object' },
          ],
        };
      },
    },
    {
      // The first item almost every cadet meets, so its surface has to be
      // honest. It used to show the skeleton "4 □ m" — number, gap, letter —
      // beside the readings 4m, m+4, 5m, m-4. Read the gap as an operator slot
      // and the order of the operands alone eliminates three of the four: the
      // template picked the key with no algebra involved at all, on the root
      // node of the whole prerequisite graph.
      //
      // Now the rift shows a bare gap and the situation lives entirely in the
      // words, which is what a verbal-to-symbolic modelling item is. The
      // readings offered are two written by juxtaposition and two written with
      // an operator, so "the one that looks like a product" is not a strategy
      // either. Nothing on screen distinguishes them but their meaning.
      id: 'vm-choose', rep: 'verbal', dMin: 1, dMax: 3, scenes: 'groups',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'groups');
        const v = pick(r, VARS);
        const k = Pgroups(r, d);
        const sum = Array.from({ length: k }, () => v).join(' + ');
        return {
          stem: `${T(sc.ctx, { v, k })} ${T('ask.whichExpression')}`,
          // The tear shows the count the situation actually describes — one
          // pod's worth, written out once per pod — and a gap for the compact
          // form. Every operator on screen is a plus, so a learner reading the
          // shape instead of the meaning is pulled towards "m + 4", which is
          // the misconception this item exists to surface.
          latex: `${sum} = \\square`,
          type: 'expression',
          answer: co(k, v),
          check: { kind: 'equivalent', math: `${k} \\cdot ${v}`, variable: v, loose: true },
          steps: [
            { latex: `${sum} = ${k} \\cdot ${v}`, why: T('why.onePodEach', { k, v }) },
            { latex: `${k} \\cdot ${v} = ${co(k, v)}`, why: T('why.groupsMeansTimes', { k, v }) },
          ],
          distractors: [
            // ordered so the three readings put on screen are one product, one
            // sum and one quotient — never three shades of the same slip
            { v: `${co(k + 1, v)}`, m: 'arith-slip' },
            { v: `${v} + ${k}`, m: 'add-not-multiply' },
            { v: `\\frac{${v}}{${k}}`, m: 'divide-not-multiply' },
            { v: `${v} - ${k}`, m: 'subtract-not-multiply' },
            { v: `${k} - ${v}`, m: 'subtract-not-multiply' },
            { v: `\\frac{${k}}{${v}}`, m: 'divide-not-multiply' },
          ],
        };
      },
    },
    {
      id: 'vm-table', rep: 'table', dMin: 1, dMax: 5, scenes: 'logRule',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'logRule');
        const v = 'x';
        const k = Pgroups(r, d);
        const c = d >= 2 ? Bkonst(r, d - 1) : 0;
        const step = int(r, 1, 1 + d);
        const start = d >= 3 ? int(r, -4, 3) : int(r, 1, 3);
        const rows = [0, 1, 2, 3].map((i) => { const x = start + i * step; return [x, k * x + c]; });
        const missing = int(r, 1, 3);
        const ans = rows[missing][1];
        const table = arrayTex(v, lin(k, v, c), rows, missing);
        return {
          stem: `${T(sc)} ${T('ask.missingReading')}`,
          latex: table,
          type: 'numeric',
          answer: String(ans),
          check: { kind: 'table', rows, missing },
          steps: [
            { latex: `${v} = ${rows[0][0]} \\Rightarrow ${rows[0][1]}`, why: T('why.readRule', { k, v }) },
            { latex: `${v} = ${rows[missing][0]} \\Rightarrow ${k} \\cdot \\left(${rows[missing][0]}\\right) ${c === 0 ? '' : sg(c)} = ${ans}`, why: T('why.applySameRule') },
          ],
          distractors: [
            { v: String(rows[missing][0] + k + c), m: 'add-not-multiply' },
            { v: String(k * rows[missing][0]), m: c === 0 ? 'arith-slip' : 'partial-rule' },
            { v: String(ans + k), m: 'arith-slip' },
            { v: String(ans - k), m: 'arith-slip' },
            { v: String(ans + 1), m: 'arith-slip' },
            { v: String(ans - 1), m: 'arith-slip' },
            { v: String(rows[missing - 1][1]), m: 'off-by-one-row' },
            { v: String(rows[Math.min(3, missing + 1)][1]), m: 'off-by-one-row' },
            { v: String(k * (rows[missing][0] + step) + c), m: 'off-by-one-row' },
            { v: String(rows[0][1] + rows[missing][0]), m: 'add-not-multiply' },
            { v: String(rows[missing][0]), m: 'partial-rule' },
            { v: String(-ans), m: 'sign-slip' },
          ],
        };
      },
    },
    {
      id: 'vm-position', rep: 'verbal', dMin: 2, dMax: 5, distinctNums: true, scenes: 'claim',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'claim');
        const v = pick(r, ['a', 'b', 'c', 'e']);
        const pos = v.charCodeAt(0) - 96;
        const val = int(r, 5, 8 + band(d).val[1]);
        const k = int(r, 2, 3 + d);
        if (!distinct(k, val, pos)) throw new Error('retry: repeated number');
        const ans = k * val;
        return {
          stem: `${T(sc, { who: NAMES[int(r, 0, NAMES.length - 1)], v, pos, val })} ${T('ask.valueOfExpr')}`,
          latex: co(k, v),
          type: 'numeric',
          answer: String(ans),
          check: { kind: 'evaluate', math: co(k, v), env: { [v]: val } },
          steps: [
            { latex: `${v} = ${val}`, why: T('why.letterIsNotPosition', { v }) },
            { latex: `${co(k, v)} = ${k} \\cdot ${val} = ${ans}`, why: T('why.substituteThenMultiply', { v, val }) },
          ],
          distractors: [
            { v: String(k * pos), m: 'letter-as-position' },
            { v: String(pos), m: 'letter-as-position' },
            { v: String(val + k), m: 'add-not-multiply' },
            { v: `${k}${val}`, m: 'implicit-mult-missed' },
            { v: String(val + pos), m: 'letter-as-position' },
            { v: String(ans - k), m: 'arith-slip' },
            { v: String(ans + k), m: 'arith-slip' },
            { v: String(val), m: 'partial-rule' },
          ],
        };
      },
    },
    {
      id: 'vm-compose', rep: 'context', dMin: 4, dMax: 5, distinctNums: true, scenes: 'nested',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'nested');
        const v = pick(r, ['x', 'n', 'm']);
        const a = int(r, 2, 5);
        const b = int(r, 3, 4 + d);
        const val = int(r, 4, band(d).val[1]);
        if (!distinct(a, b, val, a * b)) throw new Error('retry: repeated number');
        const ans = a * b * val;
        const expr = `${b}\\left(${co(a, v)}\\right)`;
        return {
          stem: `${T(sc.ctx, { v, a, b })} ${T(sc.ask, { v, val })}`,
          latex: expr,
          type: 'numeric',
          answer: String(ans),
          check: { kind: 'evaluate', math: expr, env: { [v]: val } },
          steps: [
            { latex: `${expr} = ${co(a * b, v)}`, why: T('why.groupsOfGroups', { a, b }) },
            { latex: `${co(a * b, v)} = ${a * b} \\cdot ${val} = ${ans}`, why: T('why.substituteThenMultiply', { v, val }) },
          ],
          distractors: [
            { v: String(a + b + val), m: 'add-not-multiply' },
            { v: String(a * b + val), m: 'add-not-multiply' },
            { v: String(b * val), m: 'partial-rule' },
            { v: String(a * val), m: 'partial-rule' },
            { v: String(a * b), m: 'partial-rule' },
            { v: `${a * b}${val}`, m: 'implicit-mult-missed' },
            { v: String(ans - a), m: 'arith-slip' },
            { v: String(ans + b), m: 'arith-slip' },
          ],
        };
      },
    },
    {
      // WHY THIS FORM EXISTS: a bank can be wide and still be thin.
      //
      // Every other contextual reading of this skill is a *product* — k lots of
      // v, or b lots of a lots of v — so a cadet held at band 1 met "how many
      // groups, how big is one" and nothing else, dressed in fifty nouns. That
      // is the reskin a cold critic names, and no amount of new nouns fixes it,
      // because the sentence pattern never changed.
      //
      // This is the other elementary reading, and the one Kuchemann's work puts
      // at the centre of what a letter means: a known part beside an unknown
      // one. It is where "letter as object" actually bites — `w + 6` is read as
      // "w sixes", or as the label "w6", or the letter is dropped and the
      // answer is 6 — and until now the bank could not ask it at all.
      id: 'vm-partWhole', rep: 'context', dMin: 1, dMax: 3, distinctNums: true, scenes: 'partWhole',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'partWhole');
        const v = pick(r, VARS);
        // The known part, and the value the unknown one turns out to hold.
        // Neither may be 1 — "one more" makes the whole item countable on a
        // finger and teaches nothing about substitution.
        const c = int(r, 2, 4 + d * 3);
        const val = int(r, 3, band(d).val[1] + d * 2);
        if (!distinct(c, val)) throw new Error('retry: repeated number');
        const ans = val + c;
        // The two readings that make this item worth asking — the pair read as
        // a single written number, and the sum read as a product — are only
        // wrong values a learner could actually land on if they are not
        // themselves the answer.
        const glued = Number(`${val}${c}`);
        const expr = lin(1, v, c);
        return {
          stem: `${T(sc.ctx, { v, c })} ${T(sc.ask, { v, val })}`,
          latex: expr,
          type: 'numeric',
          answer: String(ans),
          check: { kind: 'evaluate', math: expr, env: { [v]: val } },
          steps: [
            { latex: `${expr} = ${val} + ${c}`, why: T('why.substituteHere', { v, val }) },
            { latex: `${val} + ${c} = ${ans}`, why: T('why.thenAdd') },
          ],
          distractors: [
            { v: String(glued), m: 'combine-unlike' },
            { v: String(val * c), m: 'combine-unlike' },
            { v: String(c), m: 'letter-as-object' },
            { v: String(val), m: 'partial-rule' },
            { v: String(val - c), m: 'sign-slip' },
            { v: String(c - val), m: 'sign-slip' },
            { v: String(VARS.indexOf(v) + 1 + c), m: 'letter-as-position' },
            { v: String(ans + 1), m: 'arith-slip' },
            { v: String(ans - 1), m: 'arith-slip' },
          ],
        };
      },
    },
    {
      // The third elementary reading, and the one this skill had no way to ask:
      // an unknown total SHARED OUT. Every other item here builds a total up;
      // this one takes one apart, so the answer is a fraction rather than a
      // count, and the slip it exists to catch is the one that writes the
      // division upside down or turns it into a product.
      //
      // It is also the only place in Level 1 where a learner meets a letter
      // under a fraction bar before `one-step-mul` teaches them to undo one,
      // which is exactly where a modelling item belongs: recognise the
      // structure first, operate on it later.
      id: 'vm-share', rep: 'verbal', dMin: 1, dMax: 3, scenes: 'shareOut',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'shareOut');
        const v = pick(r, VARS);
        const k = int(r, 2, 3 + d);
        const ans = `\\frac{${v}}{${k}}`;
        return {
          // The reading on screen says only what the situation says: k equal
          // shares make the whole. The gap is the share, so nothing here can be
          // answered by copying a symbol off the prompt.
          stem: `${T(sc, { v, k })} ${T('ask.whichShare')}`,
          latex: `${k} \\cdot \\square = ${v}`,
          type: 'expression',
          answer: ans,
          check: { kind: 'equivalent', math: `\\frac{${v}}{${k}}`, variable: v, loose: true },
          steps: [
            { latex: `${k} \\cdot \\square = ${v}`, why: T('why.shareEqually', { k }) },
            { latex: `\\square = ${ans}`, why: T('why.thenDivide', { c: k }) },
          ],
          distractors: [
            { v: `\\frac{${k}}{${v}}`, m: 'div-direction' },
            { v: co(k, v), m: 'divide-not-multiply' },
            { v: `${v} - ${k}`, m: 'subtract-not-multiply' },
            { v: `${v} + ${k}`, m: 'add-not-multiply' },
            { v: `${k} - ${v}`, m: 'subtract-not-multiply' },
            { v: `\\frac{${v}}{${k + 1}}`, m: 'arith-slip' },
            { v: `\\frac{${v}}{${k - 1}}`, m: 'arith-slip' },
          ],
        };
      },
    },
  ],

  // =======================================================================
  'eval-expr': [
    {
      id: 'ee-linear', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
      build({ r, d, T, sr }) {
        const a = Bcoef(r, d);
        const b = Bkonst(r, d);
        const val = Bval(r, d);
        const v = pick(r, VARS);
        if (!distinct(a, b, val)) throw new Error('retry: repeated number');
        const expr = lin(a, v, b);
        const ans = a * val + b;
        const subbed = `${a === 1 ? '' : a === -1 ? '-' : a}\\left(${val}\\right) ${sg(b)}`;
        return {
          stem: T(deck(sr, 'askWhen'), { v, val }),
          latex: expr,
          type: 'numeric',
          answer: String(ans),
          check: { kind: 'evaluate', math: expr, env: { [v]: val } },
          steps: [
            { latex: `${expr} = ${subbed}`, why: T('why.substituteHere', { v, val }) },
            { latex: `${subbed} = ${a * val} ${sg(b)} = ${ans}`, why: T('why.multiplyThenAdd') },
          ],
          distractors: [
            { v: String(a + val + b), m: 'implicit-mult-missed' },
            { v: String(a * Math.abs(val) + b), m: 'neg-substitution' },
            { v: String(a * val - b), m: 'sign-slip' },
            { v: String(a * val), m: 'partial-rule' },
            { v: String(a + b * val), m: 'implicit-mult-missed' },
            { v: String((a + b) * val), m: 'strict-left-right' },
            { v: String(-ans), m: 'sign-slip' },
            { v: String(ans + a), m: 'arith-slip' },
            { v: String(ans - a), m: 'arith-slip' },
            { v: String(ans + 1), m: 'arith-slip' },
            { v: String(ans - 1), m: 'arith-slip' },
            { v: String(val + b), m: 'partial-rule' },
          ],
        };
      },
    },
    {
      id: 'ee-two-var', rep: 'symbolic', dMin: 3, dMax: 5,
      build({ r, d, T, sr }) {
        const a = Bcoef(r, d - 1), b = Bcoef(r, d - 1), c = Bkonst(r, d);
        const xv = Bval(r, d - 1), yv = Bval(r, d - 1);
        const expr = `${co(a, 'x')} ${sgc(b, 'y')} ${sg(c)}`;
        const ans = a * xv + b * yv + c;
        return {
          stem: T('ask.evaluateWhenTwo', { a: 'x', av: xv, b: 'y', bv: yv }),
          latex: expr,
          type: 'numeric',
          answer: String(ans),
          check: { kind: 'evaluate', math: expr, env: { x: xv, y: yv } },
          steps: [
            { latex: `${expr} = \\left(${a}\\right)\\left(${xv}\\right) + \\left(${b}\\right)\\left(${yv}\\right) ${sg(c)}`, why: T('why.substituteBoth') },
            { latex: `\\left(${a}\\right)\\left(${xv}\\right) + \\left(${b}\\right)\\left(${yv}\\right) ${sg(c)} = ${a * xv} ${sg(b * yv)} ${sg(c)} = ${ans}`, why: T('why.multiplyThenAdd') },
          ],
          distractors: [
            { v: String(a * xv + b * yv - c), m: 'sign-slip' },
            { v: String(a * Math.abs(xv) + b * Math.abs(yv) + c), m: 'neg-substitution' },
            { v: String((a + b) * (xv + yv) + c), m: 'combine-unlike' },
            { v: String(a * yv + b * xv + c), m: 'combine-unlike' },
            { v: String(a * xv + b * yv), m: 'partial-rule' },
            { v: String(-ans), m: 'sign-slip' },
            { v: String(ans + 1), m: 'arith-slip' },
            { v: String(ans - 1), m: 'arith-slip' },
            { v: String(a + xv + b + yv + c), m: 'implicit-mult-missed' },
          ],
        };
      },
    },
    {
      id: 'ee-context', rep: 'context', dMin: 1, dMax: 5, distinctNums: true, scenes: 'decay',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'decay');
        const v = 't';
        const a = -Pcoef(r, d);
        const b = int(r, 18 + d * 10, 26 + d * 15);
        const val = int(r, 2, 2 + band(d).groups[1]);
        if (!distinct(a, b, val)) throw new Error('retry: repeated number');
        const expr = lin(a, v, b);
        const ans = a * val + b;
        if (ans < 0) throw new Error('retry: negative charge');
        return {
          stem: `${T(sc, { a: Math.abs(a), b, v })} ${T('ask.readingAfter', { val, v })}`,
          latex: expr,
          type: 'numeric',
          answer: String(ans),
          check: { kind: 'evaluate', math: expr, env: { [v]: val } },
          steps: [
            { latex: `${expr} = ${a}\\left(${val}\\right) + ${b}`, why: T('why.substituteHere', { v, val }) },
            { latex: `${a}\\left(${val}\\right) + ${b} = ${a * val} + ${b} = ${ans}`, why: T('why.multiplyThenAdd') },
          ],
          distractors: [
            { v: String(b - a * val), m: 'sign-slip' },
            { v: String(b + a + val), m: 'implicit-mult-missed' },
            { v: String(a * val), m: 'partial-rule' },
            { v: String(-a * val), m: 'partial-rule' },
            { v: String(b - val), m: 'implicit-mult-missed' },
            { v: String(ans + 1), m: 'arith-slip' },
            { v: String(ans - 1), m: 'arith-slip' },
            { v: String(ans + Math.abs(a)), m: 'arith-slip' },
            { v: String(b), m: 'partial-rule' },
          ],
        };
      },
    },
    {
      id: 'ee-graph', rep: 'graph', dMin: 2, dMax: 5, scenes: 'trace',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'trace');
        const R2 = band(d).chart;
        const lim = R2 - 1;
        const m = d >= 3 ? nz(r, -(1 + d), 1 + d) : nz(r, 1, 3);
        const b = int(r, -Math.floor(lim / 2), Math.floor(lim / 2));
        const at = nz(r, -Math.min(6, lim), Math.min(6, lim));
        const ans = m * at + b;
        if (Math.abs(ans) > lim) throw new Error('retry: off chart');
        const p1 = [0, b], p2 = [2, 2 * m + b];
        if (Math.abs(p2[1]) > lim) throw new Error('retry: off chart');
        return {
          stem: `${T(sc)} ${T('ask.readTraceAt', { v: 'x', val: at })}`,
          latex: `x = ${at}`,
          type: 'numeric',
          answer: String(ans),
          figure: { kind: 'line', m, b, points: [p1, p2], at, mark: [at, ans], showMark: false, range: R2 },
          check: { kind: 'graph', points: [p1, p2], mode: 'y', at },
          steps: [
            { latex: `x = ${at}`, why: T('why.findColumn', { val: at }) },
            { latex: `y = ${ans}`, why: T('why.readHeight') },
          ],
          distractors: [
            { v: String(at), m: 'axis-swap' },
            { v: String(m * at), m: 'partial-rule' },
            { v: String(b), m: 'partial-rule' },
            { v: String(ans + 1), m: 'arith-slip' },
            { v: String(ans - 1), m: 'arith-slip' },
            { v: String(-ans), m: 'sign-slip' },
            { v: String(m * -at + b), m: 'neg-substitution' },
            { v: String(m), m: 'partial-rule' },
          ],
        };
      },
    },
    {
      id: 'ee-fraction', rep: 'symbolic', dMin: 3, dMax: 5, distinctNums: true,
      build({ r, d, T, sr }) {
        const v = pick(r, VARS);
        const k = int(r, 2, 2 + d);
        const b = Bkonst(r, d);
        const q = nz(r, -(2 + d), 3 + d);
        const val = k * q;
        if (!distinct(k, b, q, val)) throw new Error('retry: repeated number');
        const expr = `\\frac{${v}}{${k}} ${sg(b)}`;
        const ans = q + b;
        return {
          stem: T(deck(sr, 'askWhen'), { v, val }),
          latex: expr,
          type: 'numeric',
          answer: String(ans),
          check: { kind: 'evaluate', math: expr, env: { [v]: val } },
          steps: [
            { latex: `\\frac{${v}}{${k}} ${sg(b)} = \\frac{${val}}{${k}} ${sg(b)}`, why: T('why.substituteHere', { v, val }) },
            { latex: `\\frac{${val}}{${k}} ${sg(b)} = ${q} ${sg(b)} = ${ans}`, why: T('why.divideThenAdd') },
          ],
          distractors: [
            { v: String(q - b), m: 'sign-slip' },
            { v: String(val + b), m: 'partial-rule' },
            { v: String(k * val + b), m: 'div-direction' },
            { v: rstr(div(R(k), R(val))), m: 'div-direction' },
            { v: String(q), m: 'partial-rule' },
            { v: String(-ans), m: 'sign-slip' },
            { v: String(ans + 1), m: 'arith-slip' },
            { v: String(ans - 1), m: 'arith-slip' },
          ],
        };
      },
    },
    {
      id: 'ee-table', rep: 'table', dMin: 1, dMax: 5, scenes: 'logRule',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'logRule');
        const a = d >= 3 ? Bcoef(r, d) : int(r, 2, 4 + d);
        const b = d >= 2 ? Bkonst(r, d) : int(r, 1, 9);
        if (Math.abs(a) === 1) throw new Error('retry: trivial rule');
        const xs = [];
        let s0 = d >= 3 ? int(r, -4, 2) : int(r, 1, 3);
        for (let i = 0; i < 4; i++) { xs.push(s0); s0 += int(r, 1, 1 + d); }
        const rows = xs.map((x) => [x, a * x + b]);
        const missing = int(r, 1, 3);
        const ans = rows[missing][1];
        return {
          stem: `${T(sc)} ${T('ask.missingReading')}`,
          latex: arrayTex('x', lin(a, 'x', b), rows, missing),
          type: 'numeric',
          answer: String(ans),
          check: { kind: 'table', rows, missing },
          steps: [
            { latex: `x = ${rows[0][0]} \\Rightarrow ${rows[0][1]}`, why: T('why.readRule') },
            { latex: `x = ${rows[missing][0]} \\Rightarrow ${a} \\cdot \\left(${rows[missing][0]}\\right) ${sg(b)} = ${ans}`, why: T('why.applySameRule') },
          ],
          distractors: [
            { v: String(a * rows[missing][0]), m: 'partial-rule' },
            { v: String(rows[missing][0] + a + b), m: 'implicit-mult-missed' },
            { v: String(a * rows[missing][0] - b), m: 'sign-slip' },
            { v: String(rows[missing - 1][1]), m: 'off-by-one-row' },
            { v: String(rows[Math.min(3, missing + 1)][1]), m: 'off-by-one-row' },
            { v: String(ans + a), m: 'off-by-one-row' },
            { v: String(ans - a), m: 'off-by-one-row' },
            { v: String(ans + 1), m: 'arith-slip' },
            { v: String(ans - 1), m: 'arith-slip' },
            { v: String(-ans), m: 'sign-slip' },
            { v: String(rows[missing][0]), m: 'axis-swap' },
          ],
        };
      },
    },
    {
      id: 'ee-square', rep: 'symbolic', dMin: 4, dMax: 5, distinctNums: true,
      build({ r, d, T, sr }) {
        const v = pick(r, ['x', 'n', 'm', 't']);
        const a = int(r, 2, 4 + d);
        const b = Bkonst(r, d);
        const val = nz(r, -(2 + d), 2 + d);
        if (!distinct(a, b, val)) throw new Error('retry: repeated number');
        const expr = `${a}${v}^{2} ${sg(b)}`;
        const ans = a * val * val + b;
        return {
          stem: T(deck(sr, 'askWhen'), { v, val }),
          latex: expr,
          type: 'numeric',
          answer: String(ans),
          check: { kind: 'evaluate', math: expr, env: { [v]: val } },
          steps: [
            { latex: `${v}^{2} = \\left(${val}\\right)^{2} = ${val * val}`, why: T('why.squareTheValueFirst', { val }) },
            { latex: `${a} \\cdot ${val * val} ${sg(b)} = ${a * val * val} ${sg(b)} = ${ans}`, why: T('why.multiplyThenAdd') },
          ],
          distractors: [
            { v: String(a * val * 2 + b), m: 'exponent-as-mult' },
            { v: String((a * val) * (a * val) + b), m: 'strict-left-right' },
            { v: String(a * val * val - b), m: 'sign-slip' },
            { v: String(-(a * val * val) + b), m: 'neg-base-power' },
            { v: String(a * val * val), m: 'partial-rule' },
            { v: String(val * val + b), m: 'partial-rule' },
            { v: String(ans + 1), m: 'arith-slip' },
            { v: String(ans - 1), m: 'arith-slip' },
          ],
        };
      },
    },
  ],

  // =======================================================================
  'order-ops': [
    {
      id: 'oo-context', rep: 'context', dMin: 1, dMax: 5, distinctNums: true, scenes: 'flatRate',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'flatRate');
        const b = int(r, 5, 12 + d * 6);
        const a = int(r, 2, 3 + d * 2);
        const c = int(r, 2, 3 + d * 2);
        if (!distinct(a, b, c)) throw new Error('retry: repeated number');
        const expr = `${b} + ${a} \\cdot ${c}`;
        const ans = b + a * c;
        return {
          stem: `${T(sc.ctx, { a, b })} ${T(sc.ask, { c })}`,
          latex: expr,
          type: 'numeric',
          answer: String(ans),
          check: { kind: 'evaluate', math: expr, env: {} },
          steps: [
            { latex: `${a} \\cdot ${c} = ${a * c}`, why: T('why.timesBeforePlus') },
            { latex: `${b} + ${a * c} = ${ans}`, why: T('why.thenAdd') },
          ],
          distractors: [
            { v: String((b + a) * c), m: 'strict-left-right' },
            { v: String(b + a + c), m: 'arith-slip' },
            { v: String(a * c), m: 'partial-rule' },
            { v: String(b * c + a), m: 'strict-left-right' },
            { v: String(b * a * c), m: 'strict-left-right' },
            { v: String(ans - c), m: 'arith-slip' },
            { v: String(ans + c), m: 'arith-slip' },
            { v: String(ans - 1), m: 'arith-slip' },
            { v: String(b), m: 'partial-rule' },
          ],
        };
      },
    },
    {
      id: 'oo-mixed', rep: 'symbolic', dMin: 1, dMax: 3, distinctNums: true,
      build({ r, d, T, sr }) {
        const a = int(r, 2, 9), b = int(r, 2, 8), c = int(r, 2, 6);
        if (!distinct(a, b, c)) throw new Error('retry: repeated number');
        const expr = `${a} + ${b} \\cdot ${c}`;
        const ans = a + b * c;
        return {
          stem: T(deck(sr, 'askEvaluate')),
          latex: expr,
          type: 'numeric',
          answer: String(ans),
          check: { kind: 'evaluate', math: expr, env: {} },
          steps: [
            { latex: `${b} \\cdot ${c} = ${b * c}`, why: T('why.timesBeforePlus') },
            { latex: `${a} + ${b * c} = ${ans}`, why: T('why.thenAdd') },
          ],
          distractors: [
            { v: String((a + b) * c), m: 'strict-left-right' },
            { v: String(a * b + c), m: 'strict-left-right' },
            { v: String(a + b + c), m: 'arith-slip' },
            { v: String(a * b * c), m: 'strict-left-right' },
            { v: String(b * c), m: 'partial-rule' },
            { v: String(ans + 1), m: 'arith-slip' },
            { v: String(ans - 1), m: 'arith-slip' },
          ],
        };
      },
    },
    {
      id: 'oo-power', rep: 'symbolic', dMin: 2, dMax: 5, distinctNums: true,
      build({ r, d, T, sr }) {
        const a = int(r, 2, 3 + d), b = int(r, 2, 6 + d * 3), c = int(r, 2, 3 + d);
        if (!distinct(a, b, c)) throw new Error('retry: repeated number');
        const expr = `${a} \\cdot ${c}^{2} - ${b}`;
        const ans = a * c * c - b;
        return {
          stem: T(deck(sr, 'askEvaluate')),
          latex: expr,
          type: 'numeric',
          answer: String(ans),
          check: { kind: 'evaluate', math: expr, env: {} },
          steps: [
            { latex: `${c}^{2} = ${c * c}`, why: T('why.powersFirst') },
            { latex: `${a} \\cdot ${c * c} - ${b} = ${a * c * c} - ${b} = ${ans}`, why: T('why.thenTimesThenMinus') },
          ],
          distractors: [
            { v: String(a * c * 2 - b), m: 'exponent-as-mult' },
            { v: String((a * c) * (a * c) - b), m: 'strict-left-right' },
            { v: String(a * c * c + b), m: 'sign-slip' },
            { v: String(c * c - b), m: 'partial-rule' },
            { v: String(a * c * c), m: 'partial-rule' },
            { v: String(-ans), m: 'sign-slip' },
            { v: String(ans + 1), m: 'arith-slip' },
            { v: String(ans - 1), m: 'arith-slip' },
          ],
        };
      },
    },
    {
      id: 'oo-negbase', rep: 'symbolic', dMin: 3, dMax: 5, distinctNums: true,
      build({ r, d, T, sr }) {
        const c = int(r, 2, 3 + d), b = int(r, 1, 6 + d * 3);
        if (!distinct(b, c)) throw new Error('retry: repeated number');
        const wrapped = chance(r, 0.5);
        const expr = wrapped ? `\\left(-${c}\\right)^{2} + ${b}` : `-${c}^{2} + ${b}`;
        const ans = (wrapped ? c * c : -(c * c)) + b;
        return {
          stem: T(deck(sr, 'askEvaluate')),
          latex: expr,
          type: 'numeric',
          answer: String(ans),
          check: { kind: 'evaluate', math: expr, env: {} },
          steps: [
            {
              latex: wrapped ? `\\left(-${c}\\right)^{2} = ${c * c}` : `-${c}^{2} = -\\left(${c} \\cdot ${c}\\right) = ${-(c * c)}`,
              why: wrapped ? T('why.bracketTakesSign', { c }) : T('why.powerBeforeMinus', { c }),
            },
            { latex: `${wrapped ? c * c : -(c * c)} + ${b} = ${ans}`, why: T('why.thenAdd') },
          ],
          distractors: [
            { v: String((wrapped ? -(c * c) : c * c) + b), m: 'neg-base-power' },
            { v: String((wrapped ? c * c : -(c * c)) - b), m: 'sign-slip' },
            { v: String(-c * 2 + b), m: 'exponent-as-mult' },
            { v: String(c * 2 + b), m: 'exponent-as-mult' },
            { v: String(-ans), m: 'sign-slip' },
            { v: String(ans + 1), m: 'arith-slip' },
            { v: String(ans - 1), m: 'arith-slip' },
            { v: String(b), m: 'partial-rule' },
          ],
        };
      },
    },
    {
      id: 'oo-fracbar', rep: 'symbolic', dMin: 3, dMax: 5, distinctNums: true,
      build({ r, d, T, sr }) {
        const c = int(r, 2, 3 + d);
        const q = nz(r, -(3 + d), 4 + d);
        const a = int(r, 2, 6 + d * 2);
        const b = c * q - a;
        if (!distinct(a, b, c, q)) throw new Error('retry: repeated number');
        const expr = `\\frac{${a} ${sg(b)}}{${c}}`;
        const ans = q;
        return {
          stem: T(deck(sr, 'askEvaluate')),
          latex: expr,
          type: 'numeric',
          answer: String(ans),
          check: { kind: 'evaluate', math: expr, env: {} },
          steps: [
            { latex: `${a} ${sg(b)} = ${a + b}`, why: T('why.fracBarGroups') },
            { latex: `\\frac{${a + b}}{${c}} = ${ans}`, why: T('why.thenDivide', { c }) },
          ],
          distractors: [
            { v: rstr(add(div(R(a), R(c)), R(b))), m: 'strict-left-right' },
            { v: String(a + b - c), m: 'subtract-coefficient' },
            { v: String(-q), m: 'sign-slip' },
            { v: String(a + b), m: 'partial-rule' },
            { v: rstr(div(R(c), R(a + b || 1))), m: 'strict-left-right' },
            { v: String(q + 1), m: 'arith-slip' },
            { v: String(q - 1), m: 'arith-slip' },
          ],
        };
      },
    },
    {
      id: 'oo-dispute', rep: 'verbal', dMin: 2, dMax: 5, distinctNums: true, scenes: 'dispute',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'dispute');
        const a = int(r, 2, 6 + d), b = int(r, 2, 4 + d), c = int(r, 2, 3 + d);
        if (!distinct(a, b, c)) throw new Error('retry: repeated number');
        const expr = `${a} + ${b} \\cdot ${c}`;
        const right = a + b * c, wrong = (a + b) * c;
        const i = int(r, 0, NAMES.length - 1);
        const j = (i + 1 + int(r, 0, NAMES.length - 2)) % NAMES.length;
        return {
          // A FREE KEYPAD, so neither quoted reading may be the answer — see
          // `quoteReadings`. This form used to print `{ a: right, b: wrong }`
          // and every framing names `{a}` first, so a cadet who typed the
          // first number in the sentence never touched the mathematics.
          quote: { ctx: sc, ask: 'ask.evaluate', vars: { one: NAMES[i], two: NAMES[j] } },
          stem: `${T(sc, { one: NAMES[i], two: NAMES[j], a: right, b: wrong })} ${T('ask.whichIsRight')}`,
          latex: expr,
          type: 'numeric',
          answer: String(right),
          check: { kind: 'evaluate', math: expr, env: {} },
          steps: [
            { latex: `${b} \\cdot ${c} = ${b * c}`, why: T('why.timesBeforePlus') },
            { latex: `${a} + ${b * c} = ${right}`, why: T('why.thenAdd') },
          ],
          distractors: [
            { v: String(wrong), m: 'strict-left-right' },
            { v: String(a * b * c), m: 'strict-left-right' },
            { v: String(a + b + c), m: 'arith-slip' },
            { v: String(a * b + c), m: 'strict-left-right' },
            { v: String(b * c), m: 'partial-rule' },
            { v: String(right + 1), m: 'arith-slip' },
            { v: String(right - 1), m: 'arith-slip' },
          ],
        };
      },
    },
    {
      id: 'oo-nested', rep: 'symbolic', dMin: 4, dMax: 5, distinctNums: true,
      build({ r, d, T, sr }) {
        const a = int(r, 2, 3 + d), b = int(r, 2, 6 + d), c = int(r, 2, 4 + d), e = int(r, 2, 5);
        if (!distinct(a, b, c, e)) throw new Error('retry: repeated number');
        const inner = b + c * e;
        const expr = `${a}\\left(${b} + ${c} \\cdot ${e}\\right)`;
        const ans = a * inner;
        return {
          stem: T(deck(sr, 'askEvaluate')),
          latex: expr,
          type: 'numeric',
          answer: String(ans),
          check: { kind: 'evaluate', math: expr, env: {} },
          steps: [
            { latex: `${c} \\cdot ${e} = ${c * e}`, why: T('why.deepestBracketFirst') },
            { latex: `${b} + ${c * e} = ${inner}`, why: T('why.finishTheBracket') },
            { latex: `${a} \\cdot ${inner} = ${ans}`, why: T('why.thenTheFactorOutside', { a }) },
          ],
          distractors: [
            { v: String(a * (b + c) * e), m: 'strict-left-right' },
            { v: String(a * b + c * e), m: 'partial-rule' },
            { v: String((a + b + c) * e), m: 'strict-left-right' },
            { v: String(a * b + c + e), m: 'partial-rule' },
            { v: String(inner), m: 'partial-rule' },
            { v: String(ans - a), m: 'arith-slip' },
            { v: String(ans + a), m: 'arith-slip' },
            { v: String(ans - 1), m: 'arith-slip' },
          ],
        };
      },
    },
    {
      id: 'oo-table', rep: 'table', dMin: 1, dMax: 5, scenes: 'flatRate',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'flatRate');
        const v = 'n';
        const a = int(r, 2, 3 + d), b = int(r, 3, 6 + d * 3);
        if (!distinct(a, b)) throw new Error('retry: repeated number');
        const xs = [];
        let s0 = int(r, 1, 3);
        for (let i = 0; i < 4; i++) { xs.push(s0); s0 += int(r, 1, 1 + d); }
        const rows = xs.map((x) => [x, b + a * x]);
        const missing = int(r, 1, 3);
        const x = rows[missing][0];
        const ans = rows[missing][1];
        return {
          stem: `${T(sc.ctx, { a, b })} ${T(sc.strip)} ${T('ask.missingReading')}`,
          latex: arrayTex(v, `${b} + ${co(a, v)}`, rows, missing),
          type: 'numeric',
          answer: String(ans),
          check: { kind: 'table', rows, missing },
          steps: [
            { latex: `${v} = ${rows[0][0]} \\Rightarrow ${rows[0][1]}`, why: T('why.readRule') },
            { latex: `${v} = ${x} \\Rightarrow ${b} + ${a} \\cdot ${x} = ${ans}`, why: T('why.timesBeforePlus') },
          ],
          distractors: [
            { v: String((b + a) * x), m: 'strict-left-right' },
            { v: String(b * x + a), m: 'strict-left-right' },
            { v: String(b * a * x), m: 'strict-left-right' },
            { v: String(a * x), m: 'partial-rule' },
            { v: String(b), m: 'partial-rule' },
            { v: String(rows[missing - 1][1]), m: 'off-by-one-row' },
            { v: String(rows[Math.min(3, missing + 1)][1]), m: 'off-by-one-row' },
            { v: String(ans + 1), m: 'arith-slip' },
            { v: String(ans - 1), m: 'arith-slip' },
          ],
        };
      },
    },
  ],

  // =======================================================================
  'like-terms': [
    {
      id: 'lt-collect', rep: 'symbolic', dMin: 1, dMax: 5,
      build({ r, d, T, sr }) {
        const v = pick(r, VARS);
        const a = d >= 3 ? nz(r, ...band(d).coef) : int(r, 1, 3 + d);
        const c = d >= 3 ? nz(r, ...band(d).coef) : int(r, 1, 3 + d);
        const b = d >= 2 ? Bkonst(r, d) : int(r, 1, 9);
        const e = d >= 2 ? Bkonst(r, d) : int(r, 1, 9);
        if (a + c === 0) throw new Error('retry: vanishing variable');
        const expr = `${co(a, v)} ${sg(b)} ${sgc(c, v)} ${sg(e)}`;
        const ans = lin(a + c, v, b + e);
        return {
          stem: T(deck(sr, 'askSimplify')),
          latex: expr,
          type: 'expression',
          answer: ans,
          check: { kind: 'equivalent', math: expr, variable: v },
          steps: [
            { latex: `${expr} = ${co(a, v)} ${sgc(c, v)} ${sg(b)} ${sg(e)}`, why: T('why.gatherSameKind', { v }) },
            { latex: `${co(a, v)} ${sgc(c, v)} ${sg(b)} ${sg(e)} = ${ans}`, why: T('why.numbersAndLettersSeparate', { v }) },
          ],
          distractors: [
            { v: term(a + b + c + e, v), m: 'combine-unlike' },
            { v: lin(a - c, v, b + e), m: 'coefficient-sign-lost' },
            { v: lin(a + c, v, b - e), m: 'coefficient-sign-lost' },
            { v: String(a + b + c + e), m: 'combine-unlike' },
            { v: lin(a, v, b + e), m: 'partial-rule' },
            { v: lin(a + c, v, b), m: 'partial-rule' },
            { v: lin(a * c, v, b + e), m: 'arith-slip' },
            { v: lin(-(a + c), v, b + e), m: 'coefficient-sign-lost' },
          ],
        };
      },
    },
    {
      id: 'lt-three', rep: 'symbolic', dMin: 3, dMax: 5,
      build({ r, d, T, sr }) {
        const v = pick(r, VARS);
        const a = nz(r, ...band(d).coef), c = nz(r, ...band(d).coef), f = nz(r, ...band(d).coef);
        const b = Bkonst(r, d), e = Bkonst(r, d);
        const sumV = a + c + f, sumK = b + e;
        if (sumV === 0) throw new Error('retry: vanishing variable');
        const expr = `${co(a, v)} ${sg(b)} ${sgc(c, v)} ${sg(e)} ${sgc(f, v)}`;
        const ans = lin(sumV, v, sumK);
        return {
          stem: T(deck(sr, 'askSimplify')),
          latex: expr,
          type: 'expression',
          answer: ans,
          check: { kind: 'equivalent', math: expr, variable: v },
          steps: [
            { latex: `${expr} = ${co(a, v)} ${sgc(c, v)} ${sgc(f, v)} ${sg(b)} ${sg(e)}`, why: T('why.gatherSameKind', { v }) },
            { latex: `${co(a, v)} ${sgc(c, v)} ${sgc(f, v)} ${sg(b)} ${sg(e)} = ${ans}`, why: T('why.addCoefficients') },
          ],
          distractors: [
            { v: lin(a + c - f, v, sumK), m: 'coefficient-sign-lost' },
            { v: term(sumV + sumK, v), m: 'combine-unlike' },
            { v: lin(sumV, v, b - e), m: 'coefficient-sign-lost' },
            { v: lin(a + c, v, sumK), m: 'partial-rule' },
            { v: lin(sumV, v, b), m: 'partial-rule' },
            { v: String(sumV + sumK), m: 'combine-unlike' },
            { v: lin(-sumV, v, sumK), m: 'coefficient-sign-lost' },
          ],
        };
      },
    },
    {
      /**
       * THE BOARD THE SORTING BAYS ARE FOR — several unlike variable parts on
       * one line.
       *
       * WHY THIS FORM EXISTS, and it is not "another collect-like-terms form".
       *
       * `src/ui/rift.js` files an expression's terms into bays. For as long as
       * every expression this skill printed carried ONE letter, the bays could
       * only be two — the terms in that letter, and the pure numbers — and
       * those two bays ARE the two glyph classes: a variable chip is printed
       * with the letter on it and a number chip never is. So "a chip with a
       * letter goes left, a chip without goes right" filed every chip of every
       * board with no miss, and a cadet could seal the surface named for like
       * terms without knowing what a like term is. That is not a cue that can
       * be patched out by rearranging the chips; it is what the question was.
       *
       * A like term is not "carries a letter". `3x` and `5x` are alike; `3x`
       * and `5x^{2}` are not; `3x` and `3y` are not. So the board has to carry
       * SEVERAL unlike variable parts, and then the bays are like-classes and
       * the only rule that files a chip is reading its whole variable part —
       * which is the definition this node is named for, and exactly what
       * Booth's conjoining error (`3x + 2 = 5x`) and MacGregor and Stacey's
       * letter-as-object error refuse to do.
       *
       * WHAT THE BANDS CHANGE. Band 1 and 2: two letters and the numbers,
       * small positive counts — the arithmetic is nothing, the whole demand is
       * telling the three kinds apart. Band 3: signs. Bands 4 and 5: a squared
       * class as well, so a cadet who has learned "same letter, same bay"
       * meets `x^{2}` and has to read further.
       *
       * Every class sum is non-zero on purpose: a class that cancels away
       * leaves a bay whose total is 0 and an answer that does not name it, and
       * the first thing that surface should teach is that a kind you were
       * given is a kind you must account for.
       */
      id: 'lt-bays', rep: 'symbolic', dMin: 1, dMax: 5,
      build({ r, d, T, sr }) {
        const v = pick(r, VARS);
        const w = pick(r, VARS.filter((x) => x !== v));
        /**
         * WHAT EACH BAND CHANGES: HOW MANY KINDS ARE ON THE BOARD.
         *
         * Not the magnitude alone. Band 1 is two letters and nothing else —
         * four chips, two bays, small positive counts, and the whole demand is
         * "`4x` and `2y` are not the same kind of thing". Band 2 brings the
         * numbers in, which is where Booth's `3x + 2 = 5x` becomes possible at
         * all. Band 3 brings the signs. Bands 4 and 5 bring a squared class, so
         * a cadet who has learned "same letter, same bay" meets `x^{2}` and has
         * to read past the letter.
         *
         * That ladder is also why band 1 carries a two-numeral answer. The
         * faded worked echo needs an ANALOGUE whose numerals miss every numeral
         * of the live answer (see `analogueFor`), and at band 1 the pools are
         * small: a three-numeral answer over coefficients 2 to 4 leaves so
         * little room that the search fails outright about once in fifty, and
         * an item with no analogue falls back on the learner's own trace, which
         * is the one trace that prints the live answer. Widening band 1 until
         * the search always succeeds means band-3 magnitudes at band 1. Fewer
         * KINDS at band 1 costs nothing pedagogically and is the honest rung.
         */
        const sq = d >= 4;
        const withK = d >= 2;
        // Counts. Bands 1 and 2 stay positive; band 3 lets the signs in, which
        // is where `coefficient-sign-lost` starts to cost something.
        // Bands 1 and 2 draw wider than `band(d).coef` says, and it is not a
        // difficulty decision: the faded worked echo needs an ANALOGUE whose
        // numerals miss every numeral of the live answer, this form's answer
        // carries one count per kind, and a coefficient pool of three values
        // leaves the search nothing to find. Measured over 750 items: 15 with
        // the band's own pool, 0 with this one. The magnitudes are still under
        // what `lt-collect` prints at the same band.
        const C = () => (d >= 3 ? nz(r, ...band(d).coef) : int(r, 2, 3 + 2 * d));
        const K = () => Bkonst(r, d);
        const a1 = C(), a2 = C(), b1 = C(), b2 = C();
        const k1 = withK ? K() : 0;
        // The number bay is the one place a second chip buys nothing: at the
        // top two bands the board already carries three letter classes, and a
        // seventh chip is a row of tray on a phone. (see `_sort` on layout)
        const k2 = withK && !sq ? K() : 0;
        const q1 = sq ? C() : 0, q2 = sq ? C() : 0;
        const sumA = a1 + a2, sumB = b1 + b2, sumK = k1 + k2, sumQ = q1 + q2;
        if (sumA === 0 || sumB === 0 || (withK && sumK === 0) || (sq && sumQ === 0)) {
          throw new Error('retry: a whole kind cancels away');
        }
        // The statement writes its terms interleaved, the way a textbook line
        // is written — the tray does NOT copy this order (see `_sort`), so it
        // is free to read naturally.
        const sqv = `${v}^{2}`;
        const parts = sq
          ? [co(q1, sqv), sgc(a1, v), sgc(b1, w), sg(k1), sgc(q2, sqv), sgc(a2, v), sgc(b2, w)]
          : [co(a1, v), sgc(b1, w), ...(withK ? [sg(k1)] : []), sgc(a2, v), sgc(b2, w), ...(k2 ? [sg(k2)] : [])];
        const expr = parts.join(' ');
        // Highest power first, then the two letters, then the number: one
        // spelling, so the worked line and the answer cannot drift apart.
        const ans = [
          ...(sq ? [co(sumQ, sqv)] : []),
          sq ? sgc(sumA, v) : co(sumA, v),
          sgc(sumB, w),
          ...(withK ? [sg(sumK)] : []),
        ].join(' ');
        /**
         * A reading in the answer's own spelling. `null` drops that kind, and a
         * count of zero drops the term rather than printing `0m` — a wrong
         * reading has to be one a person could actually write down.
         */
        const line = (q, a, b, k) => {
          const bits = [
            ...(sq && q !== null && q !== 0 ? [co(q, sqv)] : []),
            ...(a === null || a === 0 ? [] : [sq ? sgc(a, v) : co(a, v)]),
            ...(b === null || b === 0 ? [] : [sgc(b, w)]),
            ...(withK && k !== null && k !== 0 ? [sg(k)] : []),
          ];
          if (!bits.length) return '0';
          return bits.join(' ').replace(/^\+\s*/, '').replace(/^-\s+/, '-');
        };
        const gathered = [
          ...(sq ? [co(q1, sqv), sgc(q2, sqv)] : []),
          sq ? sgc(a1, v) : co(a1, v), sgc(a2, v),
          sgc(b1, w), sgc(b2, w),
          ...(withK ? [sg(k1)] : []), ...(k2 ? [sg(k2)] : []),
        ].join(' ');
        return {
          stem: T(deck(sr, 'askSimplify')),
          latex: expr,
          type: 'expression',
          answer: ans,
          check: { kind: 'equivalent', math: expr, variable: v },
          steps: [
            { latex: `${expr} = ${gathered}`, why: T('why.onlySameKindCombine') },
            { latex: `${gathered} = ${ans}`, why: T(sq ? 'why.squaredIsItsOwnKind' : 'why.addCoefficients', { v }) },
          ],
          // Every one of these is a real reading of the board, and each is one
          // of the errors the graph declares for this node.
          // Every one of these is a real reading of the board, and each is one
          // of the errors the graph declares for this node. `line` writes them
          // in the answer's own spelling, so a band with no numbers bay never
          // prints a constant that is not on the board.
          distractors: [
            // Booth: the unlike kinds conjoined into one.
            { v: term(sumA + sumB + sumK + sumQ, v), m: 'combine-unlike' },
            { v: String(sumA + sumB + sumK + sumQ), m: 'combine-unlike' },
            // MacGregor and Stacey: the two letters treated as one quantity.
            { v: line(sumQ, sumA + sumB, null, sumK), m: 'combine-unlike' },
            // A kind collected and another left where it was.
            { v: line(sumQ, sumA, sumB, null), m: 'partial-rule' },
            { v: line(sumQ, sumA, b1, sumK), m: 'partial-rule' },
            // The sign dropped off one of the counts.
            { v: line(sumQ, a1 - a2, sumB, sumK), m: 'coefficient-sign-lost' },
            { v: line(sumQ, sumA, sumB, k1 - k2), m: 'coefficient-sign-lost' },
            // The counts multiplied instead of added.
            { v: line(sumQ, a1 * a2, sumB, sumK), m: 'arith-slip' },
          ],
        };
      },
    },
    {
      id: 'lt-perimeter', rep: 'context', dMin: 2, dMax: 5, scenes: 'plate',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'plate');
        const v = pick(r, ['x', 'n', 'm']);
        const a = int(r, 1, 3 + d), b = int(r, 1, 5 + d * 2);
        const c = int(r, 1, 3 + d), e = int(r, 1, 5 + d * 2);
        if (!distinct(a, b, c, e)) throw new Error('retry: repeated number');
        // ONE SPELLING OF EACH SIDE, USED BY ALL THREE PLACES THAT SHOW IT.
        // The prose, the drawing and the notation are three views of the same
        // two sides. Written out three times they are three literals that agree
        // by luck, and the day one of them is edited the picture starts
        // describing a different hatch than the sentence does. Bound once here,
        // a side cannot say `m + 15` in the sentence and anything else on the
        // drawing, because there is only one string.
        const wide = lin(a, v, b), tall = lin(c, v, e);
        // THE FOUR SIDES, WRITTEN OUT. NOT `2(w) + 2(h)`.
        //
        // This item used to read `2\left(2m + 13\right) + 2\left(6m + 10\right)`
        // and its own first step was "double each side" — which is the
        // distributive property, and `distribute` stands DOWNSTREAM of this
        // skill in the graph (its prerequisite is `like-terms`, this node). A
        // cold reader was served exactly that expression while the progress
        // report on the same session listed the distributive property as LOCKED.
        // The graph is the source of truth about what a learner has been taught,
        // and an item may not need a rule that sits above it in the graph, no
        // matter how the routing behaved.
        //
        // Adding the four sides is what a learner who has met `like-terms` and
        // has NOT met `distribute` is equipped to do, and it is the same
        // mathematics: a perimeter is the way round. The answer is unchanged, so
        // the skill this item measures is unchanged; what is gone is the hidden
        // dependency. The bracketed sides are grouping, not multiplication —
        // nothing stands in front of a bracket here.
        const expr = `\\left(${wide}\\right) + \\left(${tall}\\right)`
          + ` + \\left(${wide}\\right) + \\left(${tall}\\right)`;
        const ans = lin(2 * (a + c), v, 2 * (b + e));
        const xs = `${co(a, v)} + ${co(c, v)} + ${co(a, v)} + ${co(c, v)}`;
        const ks = `${b} + ${e} + ${b} + ${e}`;
        // THE ITEM USED TO DO ITS OWN MODELLING, IN FRONT OF THE LEARNER.
        //
        // The display was `expr` — `(7x+1) + (5x+11) + (7x+1) + (5x+11)`, the
        // four sides already written out and already in order — above a stem
        // that had itself just said both side lengths. A cold critic put this
        // among *"six of eleven items are answerable without ever looking at
        // the figure… restate the whole computation in the prose above the
        // box"*, and it is the clearest case of it in the bank: with the sum
        // pre-assembled there is nothing left to do with the rectangle, and
        // the item collapses into `lt-collect` with a picture beside it.
        //
        // Going round a closed shape and finding that four sides means two of
        // each IS the mathematics here — it is the whole difference between a
        // perimeter item and a collect-like-terms item. So the sum is gone and
        // the learner assembles it. What stays is everything the learner needs
        // and is owed:
        //
        //   · the two side lengths, in the PROSE. They must stay there. A
        //     drawing is the one surface a screen reader cannot reach, and
        //     `tools/check-figures.mjs` fails any item that labels a side the
        //     prose never states — that gate exists because a clipped label
        //     once drew `m + 15` as `m` and a learner who trusted the picture
        //     was marked wrong. Redundancy about the LABELS is a requirement;
        //     redundancy about the COMPUTATION was the defect.
        //   · the rectangle, which now carries what the prose does not: that
        //     this is a closed way round with four sides on it.
        //   · `check.math`, so the marking is unchanged — it still accepts
        //     anything equivalent to the four-side sum, and `steps` still walk
        //     it. Only the giveaway is gone.
        return {
          stem: `${T(sc, { w: `$${wide}$`, h: `$${tall}$` })} ${T('ask.perimeterRound')}`,
          latex: null,
          noDisplay: true,
          type: 'expression',
          answer: ans,
          figure: { kind: 'rect', wLabel: wide, hLabel: tall },
          check: { kind: 'equivalent', math: expr, variable: v },
          steps: [
            { latex: `${expr} = \\left(${xs}\\right) + \\left(${ks}\\right)`, why: T('why.gatherSameKind', { v }) },
            { latex: `\\left(${xs}\\right) + \\left(${ks}\\right) = ${ans}`, why: T('why.addCoefficients') },
          ],
          distractors: [
            // Round only two sides — the commonest perimeter slip, and the one
            // this item is actually about.
            { v: lin(a + c, v, b + e), m: 'partial-rule' },
            { v: lin(2 * (a + c), v, b + e), m: 'partial-rule' },
            { v: term(2 * (a + c + b + e), v), m: 'combine-unlike' },
            { v: lin(2 * a, v, 2 * b), m: 'partial-rule' },
            { v: lin(a + c, v, 2 * (b + e)), m: 'partial-rule' },
            { v: String(2 * (a + c + b + e)), m: 'combine-unlike' },
          ],
        };
      },
    },
    {
      /* dMax 5, not 3. like-terms above band 3 offered three acts — collect
         it symbolically, read the plate, read the log — and "were these two
         entries filed as the same expression?" was withdrawn at exactly the
         band where the symbolic forms multiply (lt-three, lt-square, lt-four
         are all one act). Three acts in a six-item window with a cap of two is
         zero slack, which is where the last of the repeated windows came from.
         400/400 generate and verify clean at bands 4 and 5, and judging two
         filings equivalent is harder, not easier, with longer expressions. */
      id: 'lt-equivalent', rep: 'verbal', dMin: 1, dMax: 5, scenes: 'filedTwice',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'filedTwice');
        const v = pick(r, VARS);
        const a = nz(r, 1, 4 + d), b = Bkonst(r, d), c = nz(r, 1, 4 + d), e = Bkonst(r, d);
        /* THE FILING IS LONGER AT THE TOP TWO BANDS.
           Opening this form up to bands 4 and 5 gave like-terms the fourth act
           it needed there — and dropped the measured demand of band 4 to
           within 0.07 s of band 3, because two terms and a constant is a band-2
           reading whatever number is on the dial. `tools/validate-items.mjs`
           caught it: a ladder that does not rise is a mastery gate that proves
           less than it claims. So the entry being judged carries a third pair
           at those bands. Same act, same misconceptions, one more thing to
           hold in your head — which is what a band is. */
        const wide = d >= 4;
        const g = wide ? nz(r, 1, 3 + d) : 0;
        const h = wide ? Bkonst(r, d) : 0;
        const expr = `${co(a, v)} ${sg(b)} ${sgc(c, v)} ${sg(e)}`
          + (wide ? ` ${sgc(g, v)} ${sg(h)}` : '');
        const ans = lin(a + c + g, v, b + e + h);
        return {
          /* THE QUESTION HAS TO BE THE ONE THE INSTRUMENT ASKS.
             This form asked `ask.whichEquivalent` — "Which one says exactly the
             same thing?" — over a display carrying ONE filing, on a surface
             that is a sorting tray with two bays and no readings to choose
             between at all. 573 route cards printed a two-way choice between
             two notations and never showed the second one. The framing stays
             (two teams filed the same quantity, and the rig takes one line);
             the ask is now the act the tray performs, and it is the act this
             skill is named for. */
          stem: `${T(sc)} ${T('ask.simplifyAlt2')}`,
          latex: expr,
          type: 'expression',
          answer: ans,
          check: { kind: 'equivalent', math: expr, variable: v },
          steps: [
            {
              latex: `${expr} = ${co(a, v)} ${sgc(c, v)}${wide ? ` ${sgc(g, v)}` : ''} ${sg(b)} ${sg(e)}${wide ? ` ${sg(h)}` : ''}`,
              why: T('why.gatherSameKind', { v }),
            },
            {
              latex: `${co(a, v)} ${sgc(c, v)}${wide ? ` ${sgc(g, v)}` : ''} ${sg(b)} ${sg(e)}${wide ? ` ${sg(h)}` : ''} = ${ans}`,
              why: T('why.onlySameKindCombine', { v }),
            },
          ],
          distractors: [
            { v: lin(a + c + g, v, b - e + h), m: 'coefficient-sign-lost' },
            { v: term(a + b + c + e + g + h, v), m: 'combine-unlike' },
            { v: lin(a * c, v, b + e + h), m: 'arith-slip' },
            { v: lin(a - c + g, v, b + e + h), m: 'coefficient-sign-lost' },
            { v: lin(a + c + g, v, b * e), m: 'arith-slip' },
            { v: String(a + b + c + e + g + h), m: 'combine-unlike' },
          ],
        };
      },
    },
    {
      id: 'lt-square', rep: 'symbolic', dMin: 4, dMax: 5,
      build({ r, d, T, sr }) {
        const v = pick(r, ['x', 'n']);
        const a = nz(r, 2, 4 + d), b = nz(r, -(6 + d * 2), 6 + d * 2), c = nz(r, 2, 4 + d), e = nz(r, -(6 + d * 2), 6 + d * 2);
        if (a + c === 0 || b + e === 0) throw new Error('retry: vanishing term');
        const expr = `${a}${v}^{2} ${sgc(b, v)} ${c === 1 ? '+ ' + v + '^{2}' : `+ ${c}${v}^{2}`} ${sgc(e, v)}`;
        const ans = `${a + c === 1 ? '' : a + c}${v}^{2} ${sgc(b + e, v)}`;
        return {
          stem: T(deck(sr, 'askSimplify')),
          latex: expr,
          type: 'expression',
          answer: ans,
          check: { kind: 'equivalent', math: expr, variable: v },
          steps: [
            { latex: `${expr} = \\left(${a} + ${c}\\right)${v}^{2} + \\left(${b} ${sg(e)}\\right)${v}`, why: T('why.squaredIsItsOwnKind', { v }) },
            { latex: `\\left(${a} + ${c}\\right)${v}^{2} + \\left(${b} ${sg(e)}\\right)${v} = ${ans}`, why: T('why.addCoefficients') },
          ],
          distractors: [
            { v: lin(a + c + b + e, v, 0), m: 'x-and-x-squared' },
            { v: `${a + c === 1 ? '' : a + c}${v}^{2} ${sgc(b - e, v)}`, m: 'coefficient-sign-lost' },
            { v: `${a + c === 1 ? '' : a + c}${v}^{4} ${sgc(b + e, v)}`, m: 'arith-slip' },
            { v: `${a * c === 1 ? '' : a * c}${v}^{2} ${sgc(b + e, v)}`, m: 'arith-slip' },
            { v: `${a + c + b + e}${v}^{2}`, m: 'x-and-x-squared' },
            { v: `${a + c === 1 ? '' : a + c}${v}^{2}`, m: 'partial-rule' },
          ],
        };
      },
    },
    {
      id: 'lt-four', rep: 'symbolic', dMin: 5, dMax: 5,
      build({ r, d, T, sr }) {
        const v = pick(r, ['x', 'n', 'm', 'p']);
        const cs = [nz(r, -9, 9), nz(r, -9, 9), nz(r, -9, 9), nz(r, -9, 9)];
        const ks = [Bkonst(r, 5), Bkonst(r, 5), Bkonst(r, 5)];
        const sumV = cs.reduce((x, y) => x + y, 0);
        const sumK = ks.reduce((x, y) => x + y, 0);
        if (sumV === 0 || Math.abs(sumV) === 1) throw new Error('retry: vanishing variable');
        const expr = `${co(cs[0], v)} ${sg(ks[0])} ${sgc(cs[1], v)} ${sgc(cs[2], v)} ${sg(ks[1])} ${sgc(cs[3], v)} ${sg(ks[2])}`;
        const gathered = `${co(cs[0], v)} ${sgc(cs[1], v)} ${sgc(cs[2], v)} ${sgc(cs[3], v)} ${sg(ks[0])} ${sg(ks[1])} ${sg(ks[2])}`;
        const ans = lin(sumV, v, sumK);
        return {
          stem: T(deck(sr, 'askSimplify')),
          latex: expr,
          type: 'expression',
          answer: ans,
          check: { kind: 'equivalent', math: expr, variable: v },
          steps: [
            { latex: `${expr} = ${gathered}`, why: T('why.gatherSameKind', { v }) },
            { latex: `${gathered} = ${ans}`, why: T('why.addCoefficients') },
          ],
          distractors: [
            { v: lin(sumV, v, ks[0] + ks[1] - ks[2]), m: 'coefficient-sign-lost' },
            { v: lin(cs[0] + cs[1] + cs[2] - cs[3], v, sumK), m: 'coefficient-sign-lost' },
            { v: term(sumV + sumK, v), m: 'combine-unlike' },
            { v: lin(cs[0] + cs[1], v, sumK), m: 'partial-rule' },
            { v: lin(sumV, v, ks[0]), m: 'partial-rule' },
            { v: String(sumV + sumK), m: 'combine-unlike' },
            { v: lin(-sumV, v, sumK), m: 'coefficient-sign-lost' },
          ],
        };
      },
    },
    {
      id: 'lt-table', rep: 'table', dMin: 1, dMax: 5, scenes: 'logSum',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'logSum');
        const v = 'x';
        const a = nz(r, 1, 3 + d), c = d >= 3 ? nz(r, -(2 + d), 3 + d) : int(r, 1, 3 + d);
        const b = Bkonst(r, d - 1), e = Bkonst(r, d - 1);
        const A = a + c, B = b + e;
        if (A === 0) throw new Error('retry: vanishing variable');
        const rule = `${co(a, v)} ${sg(b)} ${sgc(c, v)} ${sg(e)}`;
        const xs = [];
        let s0 = d >= 3 ? int(r, -3, 2) : int(r, 1, 3);
        for (let i = 0; i < 4; i++) { xs.push(s0); s0 += int(r, 1, 1 + d); }
        const rows = xs.map((x) => [x, A * x + B]);
        const missing = int(r, 1, 3);
        const x = rows[missing][0];
        const ans = rows[missing][1];
        return {
          stem: `${T(sc)} ${T('ask.missingReading')}`,
          latex: arrayTex(v, rule, rows, missing),
          type: 'numeric',
          answer: String(ans),
          check: { kind: 'table', rows, missing },
          steps: [
            { latex: `${rule} = ${lin(A, v, B)}`, why: T('why.onlySameKindCombine', { v }) },
            { latex: `${v} = ${x} \\Rightarrow ${A} \\cdot \\left(${x}\\right) ${sg(B)} = ${ans}`, why: T('why.applySameRule') },
          ],
          distractors: [
            { v: String((a + b + c + e) * x), m: 'combine-unlike' },
            { v: String((a - c) * x + B), m: 'coefficient-sign-lost' },
            { v: String(A * x + b - e), m: 'coefficient-sign-lost' },
            { v: String(A * x), m: 'partial-rule' },
            { v: String(rows[missing - 1][1]), m: 'off-by-one-row' },
            { v: String(rows[Math.min(3, missing + 1)][1]), m: 'off-by-one-row' },
            { v: String(ans + 1), m: 'arith-slip' },
            { v: String(ans - 1), m: 'arith-slip' },
          ],
        };
      },
    },
  ],

  // =======================================================================
  'distribute': [
    {
      id: 'ds-expand', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
      build({ r, d, T, sr }) {
        const v = pick(r, VARS);
        const k = d >= 3 ? nzc(r, ...band(d).coef) : int(r, 2, 4 + d);
        const a = d >= 2 ? nz(r, -(3 + d), 4 + d) : int(r, 1, 5);
        const b = d >= 2 ? Bkonst(r, d) : int(r, 1, 9);
        if (Math.abs(k) === 1) throw new Error('retry: trivial factor');
        if (!distinct(k, a, b)) throw new Error('retry: repeated number');
        const inner = lin(a, v, b);
        const expr = `${k}\\left(${inner}\\right)`;
        const ans = lin(k * a, v, k * b);
        return {
          stem: T(deck(sr, 'askExpand')),
          latex: expr,
          type: 'expression',
          answer: ans,
          check: { kind: 'equivalent', math: expr, variable: v },
          steps: [
            { latex: `${expr} = ${k} \\cdot ${co(a, v)} + ${k} \\cdot \\left(${b}\\right)`, why: T('why.everyTermInside') },
            { latex: `${k} \\cdot ${co(a, v)} + ${k} \\cdot \\left(${b}\\right) = ${ans}`, why: T('why.multiplyEachOut') },
          ],
          distractors: [
            { v: lin(k * a, v, b), m: 'partial-distribute' },
            { v: lin(k * a, v, -k * b), m: 'neg-distribute' },
            { v: lin(a, v, k * b), m: 'partial-distribute' },
            { v: lin(k + a, v, k + b), m: 'combine-unlike' },
            { v: lin(k * a * b, v, 0), m: 'combine-unlike' },
            { v: lin(-k * a, v, k * b), m: 'neg-distribute' },
            { v: lin(k * a, v, k * b + 1), m: 'arith-slip' },
            { v: inner, m: 'partial-distribute' },
          ],
        };
      },
    },
    {
      id: 'ds-negative', rep: 'symbolic', dMin: 3, dMax: 5, distinctNums: true,
      build({ r, d, T, sr }) {
        const v = pick(r, VARS);
        const a = nzc(r, 2, 4 + d), b = Bkonst(r, d), c = Bkonst(r, d);
        if (!distinct(a, b, c, b - c)) throw new Error('retry: repeated number');
        const inner = lin(a, v, b);
        const flipped = lin(-a, v, -b);
        const expr = `-\\left(${inner}\\right) ${sg(c)}`;
        const ans = lin(-a, v, c - b);
        return {
          stem: T(deck(sr, 'askExpand')),
          latex: expr,
          type: 'expression',
          answer: ans,
          check: { kind: 'equivalent', math: expr, variable: v },
          steps: [
            { latex: `-\\left(${inner}\\right) = -1 \\cdot \\left(${inner}\\right)`, why: T('why.minusIsTimesMinusOne') },
            { latex: `-1 \\cdot \\left(${inner}\\right) = ${flipped}`, why: T('why.everySignFlips') },
            { latex: `${flipped} ${sg(c)} = ${ans}`, why: T('why.gatherSameKind', { v }) },
          ],
          distractors: [
            { v: lin(-a, v, b + c), m: 'neg-distribute' },
            { v: lin(a, v, c - b), m: 'neg-distribute' },
            { v: lin(-a, v, -b - c), m: 'coefficient-sign-lost' },
            { v: `${inner} ${sg(c)}`, m: 'partial-distribute' },
            { v: lin(-a, v, -b), m: 'partial-rule' },
            { v: term(-(a + b) + c, v), m: 'combine-unlike' },
            { v: String(-(a + b) + c), m: 'combine-unlike' },
          ],
        };
      },
    },
    {
      id: 'ds-area', rep: 'context', dMin: 1, dMax: 5, distinctNums: true, scenes: 'panel',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'panel');
        const v = pick(r, ['x', 'n', 'm']);
        const k = int(r, 2, 4 + d);
        const a = int(r, 1, 3 + d), b = int(r, 1, 6 + d * 2);
        // A worked example whose only job is to show which number came from
        // where cannot be built out of three copies of the same number.
        if (!distinct(k, a, b, k * a, k * b)) throw new Error('retry: repeated number');
        // As in `lt-perimeter`: the two strips the width was cast in are named
        // once, and the sentence, the field and the worked lines all read that
        // one naming. The depth `k` is the same number in the prose and in the
        // drawing for the same reason.
        const stripA = co(a, v), stripB = String(b);
        const inner = lin(a, v, b);
        const expr = `${k}\\left(${inner}\\right)`;
        const ans = lin(k * a, v, k * b);
        return {
          stem: `${T(sc, { k, w: `$${inner}$` })} ${T('ask.areaMultiplyOut')}`,
          latex: expr,
          type: 'expression',
          answer: ans,
          figure: { kind: 'area', k, aLabel: stripA, bLabel: stripB },
          check: { kind: 'equivalent', math: expr, variable: v },
          steps: [
            { latex: `${k}\\left(${inner}\\right) = ${k} \\cdot ${stripA} + ${k} \\cdot ${stripB}`, why: T('why.twoRectangles') },
            { latex: `${k} \\cdot ${stripA} + ${k} \\cdot ${stripB} = ${ans}`, why: T('why.multiplyEachOut') },
          ],
          distractors: [
            { v: lin(k * a, v, b), m: 'partial-distribute' },
            { v: lin(a, v, k * b), m: 'partial-distribute' },
            { v: lin(k * a * b, v, 0), m: 'combine-unlike' },
            { v: lin(k + a, v, k + b), m: 'combine-unlike' },
            { v: lin(k * a, v, k + b), m: 'partial-distribute' },
            { v: lin(k * a, v, -k * b), m: 'neg-distribute' },
            { v: inner, m: 'partial-distribute' },
          ],
        };
      },
    },
    {
      id: 'ds-twoterm', rep: 'symbolic', dMin: 4, dMax: 5,
      build({ r, d, T, sr }) {
        const v = pick(r, ['x', 'n']);
        const k = nzc(r, 2, 3 + d), a = nz(r, 1, 5), b = nz(r, -(5 + d), 5 + d);
        const j = nzc(r, -(3 + d), 3 + d), c = nz(r, 1, 5), e = nz(r, -(5 + d), 5 + d);
        const sumV = k * a + j * c, sumK = k * b + j * e;
        if (sumV === 0) throw new Error('retry: vanishing variable');
        const expr = `${k}\\left(${lin(a, v, b)}\\right) + ${j < 0 ? `\\left(${j}\\right)` : j}\\left(${lin(c, v, e)}\\right)`;
        const ans = lin(sumV, v, sumK);
        return {
          stem: T('ask.expandAndSimplify'),
          latex: expr,
          type: 'expression',
          answer: ans,
          check: { kind: 'equivalent', math: expr, variable: v },
          steps: [
            { latex: `${expr} = ${lin(k * a, v, k * b)} + \\left(${lin(j * c, v, j * e)}\\right)`, why: T('why.everyTermInside') },
            { latex: `${lin(k * a, v, k * b)} + \\left(${lin(j * c, v, j * e)}\\right) = ${ans}`, why: T('why.gatherSameKind', { v }) },
          ],
          distractors: [
            { v: lin(k * a + j * c, v, b + e), m: 'partial-distribute' },
            { v: lin(k * a - j * c, v, sumK), m: 'neg-distribute' },
            { v: lin(sumV, v, k * b - j * e), m: 'coefficient-sign-lost' },
            { v: lin(k * a, v, k * b), m: 'partial-rule' },
            { v: term(sumV + sumK, v), m: 'combine-unlike' },
            { v: lin(k * a + c, v, k * b + e), m: 'partial-distribute' },
          ],
        };
      },
    },
    {
      id: 'ds-factor', rep: 'verbal', dMin: 3, dMax: 5, distinctNums: true, scenes: 'asUnits',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'asUnits');
        const v = pick(r, VARS);
        const k = int(r, 2, 4 + d), a = int(r, 1, 4 + d), b = nz(r, -(5 + d), 5 + d);
        /* `k` HAS TO BE THE WHOLE COMMON FACTOR, NOT A COMMON FACTOR.
           gcd(ka, kb) is k*gcd(a, b), so unless a and b are coprime the key
           this form writes is a product that still comes apart: `12y + 8` was
           keyed `2\left(6y + 4\right)`, and the echo under it read "Both
           terms carry a factor of 2. Pull the 2 out in front." CCSS A-SSE.3a
           and TEKS A.10(E) both say factor COMPLETELY, and this is the form
           that teaches the habit — in three languages, in the unit that
           ships. Drawn from the numbers that cannot do it rather than
           re-rolled, so no retry budget decides whether a cadet is taught to
           stop early. */
        if (gcd(a, b) !== 1) throw new Error('retry: a factor is still inside the bracket');
        if (!distinct(k, a, b, k * a, k * b)) throw new Error('retry: repeated number');
        const expr = lin(k * a, v, k * b);
        const ans = `${k}\\left(${lin(a, v, b)}\\right)`;
        return {
          stem: `${T(sc)} ${T('ask.whichProduct')}`,
          latex: expr,
          type: 'expression',
          answer: ans,
          check: { kind: 'equivalent', math: expr, variable: v },
          steps: [
            { latex: `${expr} = ${k} \\cdot ${co(a, v)} + ${k} \\cdot \\left(${b}\\right)`, why: T('why.commonFactor', { k }) },
            { latex: `${k} \\cdot ${co(a, v)} + ${k} \\cdot \\left(${b}\\right) = ${ans}`, why: T('why.pullOutFront', { k }) },
          ],
          distractors: [
            { v: `${k}\\left(${lin(a, v, k * b)}\\right)`, m: 'partial-distribute' },
            { v: `${k}\\left(${lin(k * a, v, b)}\\right)`, m: 'partial-distribute' },
            { v: `${k}\\left(${lin(a, v, -b)}\\right)`, m: 'neg-distribute' },
            { v: `${k}\\left(${lin(k * a, v, k * b)}\\right)`, m: 'partial-distribute' },
            { v: `${a}\\left(${lin(k, v, k * b)}\\right)`, m: 'partial-distribute' },
            { v: term(k * a + k * b, v), m: 'combine-unlike' },
          ],
        };
      },
    },
    {
      id: 'ds-share', rep: 'symbolic', dMin: 4, dMax: 5, distinctNums: true,
      build({ r, d, T, sr }) {
        const v = pick(r, ['x', 'n', 'm']);
        const k = int(r, 2, 5);
        const p = nz(r, -(3 + d), 4 + d);
        const a = k * p;
        let b = Bkonst(r, d);
        if (b % k === 0) b += 1;
        if (b % k === 0 || gcd(b, k) !== 1) throw new Error('retry: not a proper share');
        if (!distinct(k, p, a, b)) throw new Error('retry: repeated number');
        const expr = `\\frac{${lin(a, v, b)}}{${k}}`;
        const split = `\\frac{${co(a, v)}}{${k}} + \\frac{${b}}{${k}}`;
        const ans = `${co(p, v)} ${b < 0 ? '-' : '+'} \\frac{${Math.abs(b)}}{${k}}`;
        return {
          stem: T('ask.shareOut'),
          latex: expr,
          type: 'expression',
          answer: ans,
          check: { kind: 'equivalent', math: expr, variable: v },
          steps: [
            { latex: `${expr} = ${split}`, why: T('why.barSharesEveryTerm', { k }) },
            { latex: `${split} = ${ans}`, why: T('why.divideEachTerm', { k }) },
          ],
          distractors: [
            { v: `${co(p, v)} ${sg(b)}`, m: 'partial-distribute' },
            { v: `${co(a, v)} ${b < 0 ? '-' : '+'} \\frac{${Math.abs(b)}}{${k}}`, m: 'partial-distribute' },
            { v: `${co(p, v)} ${b < 0 ? '-' : '+'} \\frac{${k}}{${Math.abs(b)}}`, m: 'div-direction' },
            { v: `${co(p, v)} ${b < 0 ? '+' : '-'} \\frac{${Math.abs(b)}}{${k}}`, m: 'coefficient-sign-lost' },
            { v: `${co(a * k, v)} ${sg(b * k)}`, m: 'div-direction' },
            { v: co(p, v), m: 'partial-rule' },
          ],
        };
      },
    },
    {
      id: 'ds-table', rep: 'table', dMin: 1, dMax: 5, scenes: 'logScaled',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'logScaled');
        const v = 'x';
        const k = int(r, 2, 3 + d), a = nz(r, 1, 2 + d), b = Bkonst(r, d - 1);
        if (!distinct(k, a, b, k * a, k * b)) throw new Error('retry: repeated number');
        const rule = `${k}\\left(${lin(a, v, b)}\\right)`;
        const xs = [];
        let s0 = d >= 3 ? int(r, -3, 2) : int(r, 1, 3);
        for (let i = 0; i < 4; i++) { xs.push(s0); s0 += int(r, 1, 1 + d); }
        const rows = xs.map((x) => [x, k * (a * x + b)]);
        const missing = int(r, 1, 3);
        const x = rows[missing][0];
        const ans = rows[missing][1];
        return {
          stem: `${T(sc)} ${T('ask.missingReading')}`,
          latex: arrayTex(v, rule, rows, missing),
          type: 'numeric',
          answer: String(ans),
          check: { kind: 'table', rows, missing },
          steps: [
            { latex: `${rule} = ${lin(k * a, v, k * b)}`, why: T('why.everyTermInside') },
            { latex: `${v} = ${x} \\Rightarrow ${k * a} \\cdot \\left(${x}\\right) ${sg(k * b)} = ${ans}`, why: T('why.applySameRule') },
          ],
          distractors: [
            { v: String(k * a * x + b), m: 'partial-distribute' },
            { v: String(a * x + k * b), m: 'partial-distribute' },
            { v: String(k * a * x - k * b), m: 'neg-distribute' },
            { v: String((k + a) * x + (k + b)), m: 'combine-unlike' },
            { v: String(rows[missing - 1][1]), m: 'off-by-one-row' },
            { v: String(rows[Math.min(3, missing + 1)][1]), m: 'off-by-one-row' },
            { v: String(ans + 1), m: 'arith-slip' },
            { v: String(ans - 1), m: 'arith-slip' },
          ],
        };
      },
    },
  ],

  // =======================================================================
  'one-step-add': [
    {
      id: 'oa-symbolic', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
      build({ r, d, T, sr }) {
        const v = pick(r, VARS);
        const b = Bkonst(r, d);
        const x = Broot(r, d);
        if (!distinct(b, x, x + b)) throw new Error('retry: repeated number');
        const c = x + b;
        const eqn = `${v} ${sg(b)} = ${c}`;
        return {
          stem: T(deck(sr, 'askSolve'), { v }),
          latex: eqn,
          type: 'numeric',
          answer: String(x),
          check: { kind: 'solve', math: eqn, variable: v },
          steps: [
            { latex: `${v} ${sg(b)} ${sg(-b)} = ${c} ${sg(-b)}`, why: T('why.undoBothSides', { n: Math.abs(b), op: b < 0 ? T('word.add') : T('word.subtract') }) },
            { latex: `${v} = ${x}`, why: T('why.balanceHolds') },
          ],
          distractors: [
            { v: String(c + b), m: 'same-op-both' },
            { v: String(c), m: 'one-side-only' },
            { v: String(-x), m: 'sign-slip' },
            { v: String(b), m: 'one-side-only' },
            { v: String(b - c), m: 'sign-slip' },
            { v: String(x + 1), m: 'arith-slip' },
            { v: String(x - 1), m: 'arith-slip' },
            { v: String(c * b), m: 'arith-slip' },
          ],
        };
      },
    },
    {
      id: 'oa-context', rep: 'context', dMin: 1, dMax: 5, distinctNums: true, scenes: 'holdBack',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'holdBack');
        const v = 'x';
        const b = int(r, 3, 6 + d * 4);
        const c = int(r, 4, 8 + d * 6);
        if (!distinct(b, c, b + c)) throw new Error('retry: repeated number');
        const x = c + b;
        const eqn = `${v} - ${b} = ${c}`;
        return {
          stem: `${T(sc.ctx, { b, c })} ${T(sc.ask)}`,
          latex: eqn,
          type: 'numeric',
          answer: String(x),
          check: { kind: 'solve', math: eqn, variable: v },
          steps: [
            { latex: `${v} - ${b} + ${b} = ${c} + ${b}`, why: T('why.putBackWhatWasTaken', { n: b }) },
            { latex: `${v} = ${x}`, why: T('why.balanceHolds') },
          ],
          distractors: [
            { v: String(c - b), m: 'same-op-both' },
            { v: String(c), m: 'one-side-only' },
            { v: String(b), m: 'one-side-only' },
            { v: String(b - c), m: 'sign-slip' },
            { v: String(-x), m: 'sign-slip' },
            { v: String(x + 1), m: 'arith-slip' },
            { v: String(x - 1), m: 'arith-slip' },
          ],
        };
      },
    },
    {
      id: 'oa-balance', rep: 'graph', dMin: 1, dMax: 3, distinctNums: true, scenes: 'beamOne',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'beamOne');
        const v = 'x';
        const b = int(r, 2, 4 + d);
        const x = int(r, 2, 6 + d * 2);
        if (!distinct(b, x, x + b)) throw new Error('retry: repeated number');
        const c = x + b;
        const eqn = `${v} + ${b} = ${c}`;
        return {
          stem: `${T(sc.ctx, { b, c })} ${T(sc.ask)}`,
          latex: eqn,
          type: 'numeric',
          answer: String(x),
          figure: { kind: 'balance', left: { coef: 1, konst: b, v }, right: { konst: c } },
          check: { kind: 'solve', math: eqn, variable: v },
          steps: [
            { latex: `${v} + ${b} - ${b} = ${c} - ${b}`, why: T('why.takeSameOffBoth', { n: b }) },
            { latex: `${v} = ${x}`, why: T('why.balanceHolds') },
          ],
          distractors: [
            { v: String(c + b), m: 'same-op-both' },
            { v: String(c), m: 'one-side-only' },
            { v: String(b), m: 'one-side-only' },
            { v: String(x + 1), m: 'arith-slip' },
            { v: String(x - 1), m: 'arith-slip' },
            { v: String(-x), m: 'sign-slip' },
          ],
        };
      },
    },
    {
      id: 'oa-table', rep: 'table', dMin: 2, dMax: 5, scenes: 'logInverse',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'logInverse');
        const v = 'x';
        const b = d >= 3 ? Bkonst(r, d) : int(r, 1, 9);
        const xs = [];
        let s = d >= 3 ? int(r, -4, 3) : int(r, -2, 3);
        for (let i = 0; i < 4; i++) { xs.push(s); s += int(r, 1, 1 + d); }
        const rows = xs.map((x) => [x, x + b]);
        const missing = int(r, 1, 3);
        const rowsShown = rows.map((row, i) => (i === missing ? [null, row[1]] : row));
        const ans = rows[missing][0];
        const table = arrayTexInput(v, lin(1, v, b), rowsShown);
        return {
          stem: `${T(sc)} ${T('ask.missingInput')}`,
          latex: table,
          type: 'numeric',
          answer: String(ans),
          check: { kind: 'table', rows, missing, solveFor: 'x' },
          steps: [
            { latex: `${v} ${sg(b)} = ${rows[missing][1]}`, why: T('why.rowIsEquation') },
            { latex: `${v} = ${ans}`, why: T('why.undoBothSides', { n: Math.abs(b), op: b < 0 ? T('word.add') : T('word.subtract') }) },
          ],
          distractors: [
            { v: String(rows[missing][1] + b), m: 'same-op-both' },
            { v: String(rows[missing][1]), m: 'one-side-only' },
            { v: String(-ans), m: 'sign-slip' },
            { v: String(rows[missing - 1][0]), m: 'off-by-one-row' },
            { v: String(rows[Math.min(3, missing + 1)][0]), m: 'off-by-one-row' },
            { v: String(ans + 1), m: 'arith-slip' },
            { v: String(ans - 1), m: 'arith-slip' },
            { v: String(b), m: 'one-side-only' },
          ],
        };
      },
    },
    /**
     * THE ITEM THAT DREW A BROKEN PICTURE OF ITSELF.
     *
     * This form used to carry `latex: 'x \\;\\square\\; \\square = \\square'`,
     * and a cold critic photographed it: *"'Which equation says what happened
     * in the butt?' renders the stem figure as `x □ □ = □` — three empty boxes,
     * the identical glyph the UI uses for an empty answer field."* They were
     * right twice over.
     *
     *   · It looks broken. `\square` is the rig's own glyph for a socket
     *     waiting to be filled, so a display made ENTIRELY of them reads as an
     *     input that failed to load, not as a picture of anything. `\square` is
     *     fine where real quantities stand around it — `12 + 5 = \square`,
     *     `4 \cdot \square = 20` — because there the box is the question. Here
     *     every slot was a box, so the display carried nothing at all.
     *   · On the sibling form `ts-model` it was worse than nothing: the
     *     skeleton `\square n + \square = \square` has a `+` in it, which
     *     silently ELIMINATES the `6n - 44 = 92` option. A display that strikes
     *     out a distractor is a giveaway, and this one did it while looking
     *     like a rendering fault.
     *
     * The right display for a "which equation says this?" item is none. The
     * prose has to state the situation in full anyway — a screen reader has
     * nothing else — so any figure here can only restate the prose, which is
     * the other defect from the same review ("restate the whole computation in
     * the prose above the box"). A figure that repeats the sentence above it is
     * not evidence a learner read a figure; it is decoration that makes the
     * item look richer than it is.
     *
     * `latex: null` is therefore deliberate, and the rig hides the display
     * plate rather than printing an empty one. The choice modality is now
     * routed off `check.kind === 'equationChoice'` — see src/ui/rift.js — which
     * is what should always have selected it. It used to be selected by
     * `/\\square/.test(item.latex)`, so the modality depended on a *rendering
     * glyph*, and the only way to get a choice item was to draw a box on the
     * screen whether or not the box meant anything.
     */
    {
      id: 'oa-model', rep: 'verbal', dMin: 3, dMax: 5, distinctNums: true, scenes: 'holdBack',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'holdBack');
        const v = 'x';
        const b = int(r, 3, 6 + d * 3);
        const c = int(r, 5, 10 + d * 5);
        if (!distinct(b, c, b + c)) throw new Error('retry: repeated number');
        const x = c + b;
        const ans = `${v} - ${b} = ${c}`;
        return {
          stem: `${T(sc.ctx, { b, c })} ${T(sc.model)}`,
          // NO DISPLAY. See `oa-model`'s note below on why the skeleton went.
          latex: null,
          noDisplay: true,
          type: 'expression',
          answer: ans,
          check: { kind: 'equationChoice', variable: v, expect: String(x) },
          steps: [
            { latex: `${v} - ${b}`, why: T('why.whatLeftTheHold', { b }) },
            { latex: `${v} - ${b} = ${c}`, why: T('why.andThatIsTheGauge', { c }) },
          ],
          distractors: [
            { v: `${v} + ${b} = ${c}`, m: 'same-op-both' },
            { v: `${v} - ${c} = ${b}`, m: 'swapped-roles' },
            { v: `${v} + ${c} = ${b}`, m: 'swapped-roles' },
            { v: `${v} - ${b} = ${c + b}`, m: 'arith-slip' },
            { v: `${v} - ${b} = ${c - 1}`, m: 'arith-slip' },
            { v: `${v} + ${b} = ${c + b}`, m: 'same-op-both' },
            { v: `${v} + ${c} = ${c + b}`, m: 'swapped-roles' },
          ],
        };
      },
    },
  ],

  // =======================================================================
  'one-step-mul': [
    {
      id: 'om-symbolic', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
      build({ r, d, T, sr }) {
        const v = pick(r, VARS);
        const a = d >= 3 ? Bcoef(r, d) : int(r, 2, 4 + d);
        const x = Broot(r, d);
        if (Math.abs(a) === 1) throw new Error('retry: trivial coefficient');
        if (!distinct(a, x, a * x)) throw new Error('retry: repeated number');
        const c = a * x;
        const eqn = `${co(a, v)} = ${c}`;
        return {
          stem: T(deck(sr, 'askSolve'), { v }),
          latex: eqn,
          type: 'numeric',
          answer: String(x),
          check: { kind: 'solve', math: eqn, variable: v },
          steps: [
            { latex: `\\frac{${co(a, v)}}{${a}} = \\frac{${c}}{${a}}`, why: T('why.divideBothByCoef', { a }) },
            { latex: `${v} = ${x}`, why: T('why.oneGroupWeighs') },
          ],
          distractors: [
            { v: String(c - a), m: 'subtract-coefficient' },
            { v: String(c + a), m: 'subtract-coefficient' },
            { v: rstr(div(R(a), R(c || 1))), m: 'div-direction' },
            { v: String(-x), m: 'sign-slip' },
            { v: String(c), m: 'one-side-only' },
            { v: String(x + 1), m: 'arith-slip' },
            { v: String(x - 1), m: 'arith-slip' },
            { v: String(c * a), m: 'div-direction' },
          ],
        };
      },
    },
    {
      id: 'om-fraction', rep: 'symbolic', dMin: 3, dMax: 5, distinctNums: true,
      build({ r, d, T, sr }) {
        const v = pick(r, VARS);
        const k = int(r, 2, 2 + d);
        const c = nz(r, -(4 + d), 5 + d);
        const x = c * k;
        if (!distinct(k, c, x)) throw new Error('retry: repeated number');
        const eqn = `\\frac{${v}}{${k}} = ${c}`;
        return {
          stem: T(deck(sr, 'askSolve'), { v }),
          latex: eqn,
          type: 'numeric',
          answer: String(x),
          check: { kind: 'solve', math: eqn, variable: v },
          steps: [
            { latex: `${k} \\cdot \\frac{${v}}{${k}} = ${k} \\cdot \\left(${c}\\right)`, why: T('why.multiplyBothBy', { k }) },
            { latex: `${v} = ${x}`, why: T('why.balanceHolds') },
          ],
          distractors: [
            { v: rstr(div(R(c), R(k))), m: 'div-direction' },
            { v: String(c + k), m: 'subtract-coefficient' },
            { v: String(c - k), m: 'subtract-coefficient' },
            { v: String(-x), m: 'sign-slip' },
            { v: String(c), m: 'one-side-only' },
            { v: String(x + 1), m: 'arith-slip' },
            { v: String(x - 1), m: 'arith-slip' },
          ],
        };
      },
    },
    {
      id: 'om-context', rep: 'context', dMin: 1, dMax: 5, distinctNums: true, scenes: 'identicals',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'identicals');
        const v = 'x';
        const k = int(r, 3, 4 + d);
        const x = int(r, 2, 6 + d * 3);
        if (!distinct(k, x, k * x)) throw new Error('retry: repeated number');
        const c = k * x;
        const eqn = `${co(k, v)} = ${c}`;
        return {
          stem: `${T(sc.ctx, { k, c })} ${T(sc.ask)}`,
          latex: eqn,
          type: 'numeric',
          answer: String(x),
          check: { kind: 'solve', math: eqn, variable: v },
          steps: [
            { latex: `\\frac{${co(k, v)}}{${k}} = \\frac{${c}}{${k}}`, why: T('why.shareEqually', { k }) },
            { latex: `${v} = ${x}`, why: T('why.oneGroupWeighs') },
          ],
          distractors: [
            { v: String(c - k), m: 'subtract-coefficient' },
            { v: String(c + k), m: 'subtract-coefficient' },
            { v: String(c), m: 'one-side-only' },
            { v: String(k), m: 'one-side-only' },
            { v: String(c * k), m: 'div-direction' },
            { v: String(x + 1), m: 'arith-slip' },
            { v: String(x - 1), m: 'arith-slip' },
          ],
        };
      },
    },
    {
      id: 'om-balance', rep: 'graph', dMin: 1, dMax: 3, distinctNums: true, scenes: 'beamMany',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'beamMany');
        const v = 'x';
        const k = int(r, 2, 4);
        const x = int(r, 2, 5 + d * 2);
        if (!distinct(k, x, k * x)) throw new Error('retry: repeated number');
        const c = k * x;
        const eqn = `${co(k, v)} = ${c}`;
        return {
          stem: `${T(sc.ctx, { k, c })} ${T(sc.ask)}`,
          latex: eqn,
          type: 'numeric',
          answer: String(x),
          figure: { kind: 'balance', left: { coef: k, konst: 0, v }, right: { konst: c } },
          check: { kind: 'solve', math: eqn, variable: v },
          steps: [
            { latex: `\\frac{${co(k, v)}}{${k}} = \\frac{${c}}{${k}}`, why: T('why.shareEqually', { k }) },
            { latex: `${v} = ${x}`, why: T('why.oneGroupWeighs') },
          ],
          distractors: [
            { v: String(c - k), m: 'subtract-coefficient' },
            { v: String(c), m: 'one-side-only' },
            { v: String(c + k), m: 'subtract-coefficient' },
            { v: String(k), m: 'one-side-only' },
            { v: String(x + 1), m: 'arith-slip' },
            { v: String(x - 1), m: 'arith-slip' },
          ],
        };
      },
    },
    {
      id: 'om-dispute', rep: 'verbal', dMin: 2, dMax: 5, distinctNums: true, scenes: 'disputeSolve',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'disputeSolve');
        const v = pick(r, ['x', 'n', 'm']);
        const a = int(r, 3, 6 + d);
        const x = int(r, 2, 6 + d * 2);
        if (!distinct(a, x, a * x)) throw new Error('retry: repeated number');
        const c = a * x;
        const eqn = `${co(a, v)} = ${c}`;
        const i = int(r, 0, NAMES.length - 1);
        const j = (i + 1 + int(r, 0, NAMES.length - 2)) % NAMES.length;
        return {
          stem: `${T(sc, { one: NAMES[i], two: NAMES[j], a: x, b: c - a })} ${T('ask.whichIsRight')}`,
          latex: eqn,
          type: 'numeric',
          answer: String(x),
          check: { kind: 'solve', math: eqn, variable: v },
          steps: [
            { latex: `${co(a, v)} = ${c}`, why: T('why.coefIsTimesNotPlus', { a }) },
            { latex: `\\frac{${co(a, v)}}{${a}} = \\frac{${c}}{${a}}`, why: T('why.divideBothByCoef', { a }) },
            { latex: `${v} = ${x}`, why: T('why.oneGroupWeighs') },
          ],
          distractors: [
            { v: String(c - a), m: 'subtract-coefficient' },
            { v: String(c + a), m: 'subtract-coefficient' },
            { v: String(c), m: 'one-side-only' },
            { v: String(a), m: 'one-side-only' },
            { v: String(x + 1), m: 'arith-slip' },
            { v: String(x - 1), m: 'arith-slip' },
          ],
        };
      },
    },
    {
      id: 'om-table', rep: 'table', dMin: 3, dMax: 5, scenes: 'logInverse',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'logInverse');
        const v = 'x';
        const k = d >= 4 ? nzc(r, -(3 + d), 3 + d) : int(r, 2, 3 + d);
        const xs = [];
        let s = int(r, -3, 2);
        for (let i = 0; i < 4; i++) { xs.push(s); s += int(r, 1, 1 + d); }
        if (xs.includes(0)) throw new Error('retry: zero row');
        const rows = xs.map((x) => [x, k * x]);
        const missing = int(r, 1, 3);
        const rowsShown = rows.map((row, i) => (i === missing ? [null, row[1]] : row));
        const ans = rows[missing][0];
        return {
          stem: `${T(sc)} ${T('ask.missingInput')}`,
          latex: arrayTexInput(v, co(k, v), rowsShown),
          type: 'numeric',
          answer: String(ans),
          check: { kind: 'table', rows, missing, solveFor: 'x' },
          steps: [
            { latex: `${co(k, v)} = ${rows[missing][1]}`, why: T('why.rowIsEquation') },
            { latex: `${v} = ${ans}`, why: T('why.divideBothByCoef', { a: k }) },
          ],
          distractors: [
            { v: String(rows[missing][1] - k), m: 'subtract-coefficient' },
            { v: String(rows[missing][1]), m: 'one-side-only' },
            { v: String(-ans), m: 'sign-slip' },
            { v: String(rows[missing - 1][0]), m: 'off-by-one-row' },
            { v: String(rows[Math.min(3, missing + 1)][0]), m: 'off-by-one-row' },
            { v: String(rows[missing][1] * k), m: 'div-direction' },
            { v: String(ans + 1), m: 'arith-slip' },
            { v: String(ans - 1), m: 'arith-slip' },
          ],
        };
      },
    },
  ],

  // =======================================================================
  'two-step': [
    {
      id: 'ts-symbolic', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
      build({ r, d, T, sr }) {
        const v = pick(r, VARS);
        const a = d >= 3 ? Bcoef(r, d) : int(r, 2, 4 + d);
        const b = d >= 2 ? Bkonst(r, d) : int(r, 1, 9);
        const x = Broot(r, d);
        if (Math.abs(a) === 1) throw new Error('retry: trivial coefficient');
        if (!distinct(a, b, x)) throw new Error('retry: repeated number');
        const c = a * x + b;
        const eqn = `${co(a, v)} ${sg(b)} = ${c}`;
        return {
          stem: T(deck(sr, 'askSolve'), { v }),
          latex: eqn,
          type: 'numeric',
          answer: String(x),
          check: { kind: 'solve', math: eqn, variable: v },
          steps: [
            { latex: `${co(a, v)} ${sg(b)} ${sg(-b)} = ${c} ${sg(-b)}`, why: T('why.unwrapConstantFirst') },
            { latex: `${co(a, v)} = ${c - b}`, why: T('why.whatIsLeft') },
            { latex: `${v} = ${x}`, why: T('why.divideBothByCoef', { a }) },
          ],
          distractors: [
            { v: String(c - b + a), m: 'wrong-unwrap-order' },
            { v: rstr(div(R(c + b), R(a))), m: 'sign-on-constant' },
            { v: rstr(div(R(c), R(a))), m: 'wrong-unwrap-order' },
            { v: String(c - b), m: 'wrong-unwrap-order' },
            { v: String(c - b - a), m: 'subtract-coefficient' },
            { v: String(-x), m: 'sign-slip' },
            { v: String(x + 1), m: 'arith-slip' },
            { v: String(x - 1), m: 'arith-slip' },
          ],
        };
      },
    },
    {
      id: 'ts-context', rep: 'context', dMin: 1, dMax: 5, distinctNums: true, scenes: 'flatRate',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'flatRate');
        const v = 'n';
        const a = int(r, 3, 5 + d);
        const b = int(r, 5, 10 + d * 6);
        const x = int(r, 2, 6 + d * 3);
        if (!distinct(a, b, x, a * x + b)) throw new Error('retry: repeated number');
        const c = a * x + b;
        const eqn = `${co(a, v)} + ${b} = ${c}`;
        return {
          stem: `${T(sc.ctx, { a, b })} ${T(sc.cycles, { c })}`,
          latex: eqn,
          type: 'numeric',
          answer: String(x),
          check: { kind: 'solve', math: eqn, variable: v },
          steps: [
            { latex: `${co(a, v)} + ${b} - ${b} = ${c} - ${b}`, why: T('why.removeFlatFee', { b }) },
            { latex: `${co(a, v)} = ${c - b}`, why: T('why.whatIsLeftIsCycles') },
            { latex: `${v} = ${x}`, why: T('why.divideBothByCoef', { a }) },
          ],
          distractors: [
            { v: rstr(div(R(c), R(a))), m: 'wrong-unwrap-order' },
            { v: String(c - b - a), m: 'subtract-coefficient' },
            { v: rstr(div(R(c + b), R(a))), m: 'sign-on-constant' },
            { v: String(c - b), m: 'wrong-unwrap-order' },
            { v: String(x + 1), m: 'arith-slip' },
            { v: String(x - 1), m: 'arith-slip' },
            { v: String(c), m: 'wrong-unwrap-order' },
          ],
        };
      },
    },
    {
      id: 'ts-graph', rep: 'graph', dMin: 1, dMax: 5, scenes: 'trace',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'trace');
        const R2 = band(d).chart;
        const lim = R2 - 1;
        const m = d >= 3 ? nz(r, -(1 + d), 1 + d) : nz(r, 1, 3);
        const b = int(r, -Math.floor(lim / 2), Math.floor(lim / 2));
        const x = nz(r, -Math.min(6, lim), Math.min(6, lim));
        const target = m * x + b;
        if (Math.abs(target) > lim) throw new Error('retry: off chart');
        const p1 = [0, b], p2 = [2, 2 * m + b];
        if (Math.abs(p2[1]) > lim) throw new Error('retry: off chart');
        const eqn = `${lin(m, 'x', b)} = ${target}`;
        return {
          stem: `${T(sc)} ${T('ask.whereTraceReaches', { val: target })}`,
          latex: eqn,
          type: 'numeric',
          answer: String(x),
          figure: { kind: 'line', m, b, points: [p1, p2], target, mark: [x, target], showMark: false, range: R2 },
          check: { kind: 'solve', math: eqn, variable: 'x' },
          steps: [
            { latex: `${lin(m, 'x', b)} = ${target}`, why: T('why.heightIsEquation', { val: target }) },
            { latex: `${co(m, 'x')} = ${target - b}`, why: T('why.unwrapConstantFirst') },
            // "divide both sides by 1" is not a move. With a unit slope the
            // previous line already reads x = …, and repeating it would spend
            // a rung of the echo on nothing.
            ...(m === 1 ? [] : [{ latex: `x = ${x}`, why: T('why.divideBothByCoef', { a: m }) }]),
          ],
          distractors: [
            { v: String(target), m: 'axis-swap' },
            { v: String(-x), m: 'sign-slip' },
            { v: rstr(div(R(target), R(m))), m: 'wrong-unwrap-order' },
            { v: String(b), m: 'axis-swap' },
            { v: String(target - b), m: 'wrong-unwrap-order' },
            { v: String(x + 1), m: 'arith-slip' },
            { v: String(x - 1), m: 'arith-slip' },
          ],
        };
      },
    },
    {
      id: 'ts-model', rep: 'verbal', dMin: 3, dMax: 5, distinctNums: true, scenes: 'flatRate',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'flatRate');
        const v = 'n';
        const a = int(r, 3, 5 + d * 2);
        const b = int(r, 8, 14 + d * 8);
        const x = int(r, 2, 6 + d * 2);
        if (!distinct(a, b, x, a * x + b)) throw new Error('retry: repeated number');
        const c = a * x + b;
        const ans = `${co(a, v)} + ${b} = ${c}`;
        return {
          stem: `${T(sc.bill, { a, b })} ${T('ask.whichEquationTotal', { c })}`,
          // NO DISPLAY, and here the old skeleton was also a giveaway: its `+`
          // struck out the `6n - 44 = 92` option before the learner read it.
          // See the note on `oa-model`.
          latex: null,
          noDisplay: true,
          type: 'expression',
          answer: ans,
          check: { kind: 'equationChoice', variable: v, expect: String(x) },
          steps: [
            { latex: `${co(a, v)}`, why: T('why.perCycleTimesCycles', { a }) },
            { latex: `${co(a, v)} + ${b} = ${c}`, why: T('why.plusFlatFeeEqualsTotal', { b, c }) },
          ],
          distractors: [
            { v: `${co(b, v)} + ${a} = ${c}`, m: 'swapped-roles' },
            { v: `${co(a, v)} - ${b} = ${c}`, m: 'sign-on-constant' },
            { v: `${co(a, v)} + ${b} = ${c + b}`, m: 'arith-slip' },
            { v: `${co(c, v)} + ${b} = ${a}`, m: 'swapped-roles' },
            { v: `${co(a, v)} + ${c} = ${b}`, m: 'swapped-roles' },
          ],
        };
      },
    },
    {
      id: 'ts-fraction', rep: 'symbolic', dMin: 4, dMax: 5, distinctNums: true,
      build({ r, d, T, sr }) {
        const v = pick(r, ['x', 'n', 'm']);
        const k = int(r, 2, 5);
        const b = Bkonst(r, d);
        const q = nz(r, -(4 + d), 5 + d);
        const x = k * q;
        const c = q + b;
        if (!distinct(k, b, q, x)) throw new Error('retry: repeated number');
        const eqn = `\\frac{${v}}{${k}} ${sg(b)} = ${c}`;
        return {
          stem: T(deck(sr, 'askSolve'), { v }),
          latex: eqn,
          type: 'numeric',
          answer: String(x),
          check: { kind: 'solve', math: eqn, variable: v },
          steps: [
            { latex: `\\frac{${v}}{${k}} = ${c} ${sg(-b)}`, why: T('why.unwrapConstantFirst') },
            { latex: `\\frac{${v}}{${k}} = ${q}`, why: T('why.whatIsLeft') },
            { latex: `${v} = ${k} \\cdot \\left(${q}\\right)`, why: T('why.multiplyBothBy', { k }) },
            { latex: `${v} = ${x}`, why: T('why.whatIsLeft') },
          ],
          distractors: [
            { v: rstr(div(R(c - b), R(k))), m: 'div-direction' },
            { v: String(k * (c + b)), m: 'sign-on-constant' },
            { v: String(k * c), m: 'wrong-unwrap-order' },
            { v: String(q), m: 'wrong-unwrap-order' },
            { v: String(-x), m: 'sign-slip' },
            { v: String(x + 1), m: 'arith-slip' },
            { v: String(x - 1), m: 'arith-slip' },
          ],
        };
      },
    },
  ],

  // =======================================================================
  'multi-step': [
    {
      id: 'ms-bracket', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
      build({ r, d, T, sr }) {
        const v = pick(r, VARS);
        const k = d >= 3 ? nzc(r, -(2 + d), 2 + d) : int(r, 2, 3 + d);
        const a = nz(r, 1, 3 + d), b = Bkonst(r, d - 1), e = Bkonst(r, d);
        const x = Broot(r, d);
        if (Math.abs(k) === 1) throw new Error('retry: trivial factor');
        const A = k * a, B = k * b + e;
        if (A === 0) throw new Error('retry: vanishing variable');
        if (!distinct(k, a, b, e, x)) throw new Error('retry: repeated number');
        const c = A * x + B;
        const eqn = `${paren(k, lin(a, v, b))} ${sg(e)} = ${c}`;
        return {
          stem: T(deck(sr, 'askSolve'), { v }),
          latex: eqn,
          type: 'numeric',
          answer: String(x),
          check: { kind: 'solve', math: eqn, variable: v },
          steps: [
            { latex: `${lin(A, v, k * b)} ${sg(e)} = ${c}`, why: T('why.expandFirst') },
            { latex: `${lin(A, v, B)} = ${c}`, why: T('why.collectConstants') },
            { latex: `${co(A, v)} = ${c - B}`, why: T('why.unwrapConstantFirst') },
            { latex: `${v} = ${x}`, why: T('why.divideBothByCoef', { a: A }) },
          ],
          distractors: [
            { v: rstr(div(R(c - e - b), R(a))), m: 'partial-distribute' },
            { v: rstr(div(R(c - k * b), R(A))), m: 'distribute-then-forget' },
            { v: rstr(div(R(c + B), R(A))), m: 'sign-on-constant' },
            { v: rstr(div(R(c - B), R(a))), m: 'partial-distribute' },
            { v: rstr(div(R(c), R(A))), m: 'wrong-unwrap-order' },
            { v: String(c - B), m: 'wrong-unwrap-order' },
            { v: String(-x), m: 'coefficient-sign-lost' },
          ],
        };
      },
    },
    {
      id: 'ms-collect', rep: 'symbolic', dMin: 1, dMax: 5,
      build({ r, d, T, sr }) {
        const v = pick(r, VARS);
        const a = nz(r, 1, 3 + d), c = nz(r, d >= 3 ? -(3 + d) : 1, 3 + d);
        const b = Bkonst(r, d), e = Bkonst(r, d);
        const x = Broot(r, d);
        const A = a + c, B = b + e;
        if (A === 0 || (Math.abs(A) === 1 && d >= 3)) throw new Error('retry');
        const total = A * x + B;
        const eqn = `${co(a, v)} ${sg(b)} ${sgc(c, v)} ${sg(e)} = ${total}`;
        return {
          stem: T(deck(sr, 'askSolve'), { v }),
          latex: eqn,
          type: 'numeric',
          answer: String(x),
          check: { kind: 'solve', math: eqn, variable: v },
          steps: [
            { latex: `${co(a, v)} ${sgc(c, v)} ${sg(b)} ${sg(e)} = ${total}`, why: T('why.gatherSameKind', { v }) },
            { latex: `${lin(A, v, B)} = ${total}`, why: T('why.simplifySideFirst') },
            { latex: `${co(A, v)} = ${total - B}`, why: T('why.unwrapConstantFirst') },
            { latex: `${v} = ${x}`, why: T('why.divideBothByCoef', { a: A }) },
          ],
          distractors: [
            { v: rstr(div(R(total - B), R(a))), m: 'distribute-then-forget' },
            { v: rstr(div(R(total + B), R(A))), m: 'sign-on-constant' },
            { v: rstr(div(R(total - b + e), R(A))), m: 'coefficient-sign-lost' },
            { v: rstr(div(R(total), R(A))), m: 'wrong-unwrap-order' },
            { v: String(total - B), m: 'wrong-unwrap-order' },
            { v: String(-x), m: 'coefficient-sign-lost' },
          ],
        };
      },
    },
    {
      id: 'ms-context', rep: 'context', dMin: 1, dMax: 5, distinctNums: true, scenes: 'crew',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'crew');
        const v = 'n';
        // A CREW COUNT CANNOT GO NEGATIVE, SO THIS RUNG IS CARRIED BY SIZE.
        // Every other form in this skill turns signed at band 3 and steps up
        // hard there; this one drew from ranges that barely moved, and its
        // share of the band-3 draw is large enough that it held the whole band
        // level with band 2. See the note above `Pcoef`: the ladder still
        // rises here, it rises through magnitude — so the magnitudes rise.
        const k = int(r, 2, 2 + d);
        const a = int(r, 2, 3 + d), b = int(r, 2, 4 + d * 3);
        const x = int(r, 2, 3 + d * 3);
        if (!distinct(k, a, b, x, k * a, k * b)) throw new Error('retry: repeated number');
        const total = k * (a * x + b);
        const eqn = `${paren(k, lin(a, v, b))} = ${total}`;
        return {
          stem: `${T(sc, { k, a, b })} ${T('ask.howManyShiftsTotal', { c: total })}`,
          latex: eqn,
          type: 'numeric',
          answer: String(x),
          check: { kind: 'solve', math: eqn, variable: v },
          steps: [
            { latex: `${lin(k * a, v, k * b)} = ${total}`, why: T('why.expandFirst') },
            { latex: `${co(k * a, v)} = ${total - k * b}`, why: T('why.unwrapConstantFirst') },
            { latex: `${v} = ${x}`, why: T('why.divideBothByCoef', { a: k * a }) },
          ],
          distractors: [
            { v: rstr(div(R(total - b), R(k * a))), m: 'partial-distribute' },
            { v: rstr(div(R(total), R(k * a))), m: 'distribute-then-forget' },
            { v: String(total - k * b), m: 'wrong-unwrap-order' },
            { v: rstr(div(R(total - k * b), R(a))), m: 'partial-distribute' },
            { v: String(x + 1), m: 'arith-slip' },
            { v: String(x - 1), m: 'arith-slip' },
          ],
        };
      },
    },
    {
      id: 'ms-fracbar', rep: 'symbolic', dMin: 4, dMax: 5, distinctNums: true,
      build({ r, d, T, sr }) {
        const v = pick(r, ['x', 'n', 'm']);
        const k = int(r, 2, 5);
        const a = nzc(r, 2, 3 + d), b = Bkonst(r, d);
        const x = Broot(r, d);
        const c = (a * x + b) / k;
        if (!Number.isInteger(c)) throw new Error('retry: non-integer right side');
        if (!distinct(k, a, b, x)) throw new Error('retry: repeated number');
        const eqn = `\\frac{${lin(a, v, b)}}{${k}} = ${c}`;
        return {
          stem: T(deck(sr, 'askSolve'), { v }),
          latex: eqn,
          type: 'numeric',
          answer: String(x),
          check: { kind: 'solve', math: eqn, variable: v },
          steps: [
            { latex: `${lin(a, v, b)} = ${k} \\cdot \\left(${c}\\right)`, why: T('why.multiplyBothBy', { k }) },
            { latex: `${co(a, v)} = ${k * c - b}`, why: T('why.unwrapConstantFirst') },
            { latex: `${v} = ${x}`, why: T('why.divideBothByCoef', { a }) },
          ],
          distractors: [
            { v: rstr(div(R(c - b), R(a))), m: 'partial-distribute' },
            { v: rstr(div(R(k * c + b), R(a))), m: 'sign-on-constant' },
            { v: String(k * c - b), m: 'wrong-unwrap-order' },
            { v: rstr(div(R(k * c), R(a))), m: 'wrong-unwrap-order' },
            { v: String(-x), m: 'coefficient-sign-lost' },
            { v: String(x + 1), m: 'partial-distribute' },
          ],
        };
      },
    },
    {
      /* TWO THINGS THIS FORM USED TO GET WRONG.
         1. It ended in "Which reading is the true one?" — but `disputeExpand`
            names two PROCEDURES ("Cadet Wren multiplies 3n and 5 by 4. Cadet
            Vale multiplies only 3n."), not two readings, so nothing on the
            card was a reading for "the true one" to point at. Its three
            sibling disputes in this bank print both cadets' values in the
            sentence and are fine; this one never did. It now asks what every
            other multi-step form asks.
         2. Every number it drew was positive and small while its siblings turn
            signed at band 3, so it entered at band 3 measuring 8.25 against a
            band-2 mean of 9.04 and pulled the whole band under the one below
            it — the `inverted` fault `tools/critic/ladder.mjs` reports. It
            draws from the band table now, like the rest of the skill. */
      id: 'ms-dispute', rep: 'verbal', dMin: 3, dMax: 5, distinctNums: true, scenes: 'disputeExpand',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'disputeExpand');
        const v = pick(r, ['x', 'n']);
        const k = int(r, 2, 2 + d), a = nz(r, 1, 2 + d), b = Bkonst(r, d);
        const x = Broot(r, d);
        if (!distinct(k, a, b, x, k * a, k * b)) throw new Error('retry: repeated number');
        const c = k * (a * x + b);
        const eqn = `${paren(k, lin(a, v, b))} = ${c}`;
        const i = int(r, 0, NAMES.length - 1);
        const j = (i + 1 + int(r, 0, NAMES.length - 2)) % NAMES.length;
        return {
          stem: `${T(sc, { one: NAMES[i], two: NAMES[j], k, a: `$${co(a, v)}$`, b })} ${T(deck(sr, 'askSolve'), { v })}`,
          latex: eqn,
          type: 'numeric',
          answer: String(x),
          check: { kind: 'solve', math: eqn, variable: v },
          steps: [
            { latex: `${lin(k * a, v, k * b)} = ${c}`, why: T('why.everyTermInside') },
            { latex: `${co(k * a, v)} = ${c - k * b}`, why: T('why.unwrapConstantFirst') },
            { latex: `${v} = ${x}`, why: T('why.divideBothByCoef', { a: k * a }) },
          ],
          distractors: [
            { v: rstr(div(R(c - b), R(k * a))), m: 'partial-distribute' },
            { v: rstr(div(R(c), R(k * a))), m: 'distribute-then-forget' },
            { v: String(c - k * b), m: 'wrong-unwrap-order' },
            { v: rstr(div(R(c - k * b), R(a))), m: 'partial-distribute' },
            { v: String(x + 1), m: 'arith-slip' },
            { v: String(x - 1), m: 'arith-slip' },
          ],
        };
      },
    },
    {
      /* dMin 1, not 3. `tools/validate-items.mjs` counts the distinct ACTS a
         band can offer and multi-step could offer exactly two below band 3 —
         "rearrange this symbolically" and "read the crew log" — so a learner
         held there alternated between two questions and no scheduler could do
         anything about it. A rule table with one gap is not a hard reading; it
         is the EASIEST surface this skill has, and holding it back to band 3
         was starving the bands that needed it most. 400/400 generate and
         verify clean at band 1. */
      id: 'ms-table', rep: 'table', dMin: 1, dMax: 5, scenes: 'logInverse',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'logInverse');
        const v = 'x';
        const k = int(r, 2, 2 + d), a = nzc(r, 2, 3 + d), b = Bkonst(r, d - 1);
        if (!distinct(k, a, b, k * a, k * b)) throw new Error('retry: repeated number');
        const rule = `${k}\\left(${lin(a, v, b)}\\right)`;
        const xs = [];
        let s0 = int(r, -3, 2);
        for (let i = 0; i < 4; i++) { xs.push(s0); s0 += int(r, 1, 1 + d); }
        const rows = xs.map((x) => [x, k * (a * x + b)]);
        const missing = int(r, 1, 3);
        const rowsShown = rows.map((row, i) => (i === missing ? [null, row[1]] : row));
        const ans = rows[missing][0];
        const y = rows[missing][1];
        return {
          stem: `${T(sc)} ${T('ask.missingInput')}`,
          latex: arrayTexInput(v, rule, rowsShown),
          type: 'numeric',
          answer: String(ans),
          check: { kind: 'table', rows, missing, solveFor: 'x' },
          steps: [
            { latex: `${rule} = ${y}`, why: T('why.rowIsEquation') },
            { latex: `${lin(k * a, v, k * b)} = ${y}`, why: T('why.expandFirst') },
            { latex: `${co(k * a, v)} = ${y - k * b}`, why: T('why.unwrapConstantFirst') },
            { latex: `${v} = ${ans}`, why: T('why.divideBothByCoef', { a: k * a }) },
          ],
          distractors: [
            { v: rstr(div(R(y), R(k * a))), m: 'distribute-then-forget' },
            { v: rstr(div(R(y - b), R(k * a))), m: 'partial-distribute' },
            { v: rstr(div(R(y + k * b), R(k * a))), m: 'sign-on-constant' },
            { v: String(y - k * b), m: 'wrong-unwrap-order' },
            { v: String(rows[missing - 1][0]), m: 'off-by-one-row' },
            { v: String(rows[Math.min(3, missing + 1)][0]), m: 'off-by-one-row' },
            { v: String(ans + 1), m: 'arith-slip' },
            { v: String(ans - 1), m: 'arith-slip' },
          ],
        };
      },
    },
  ],

  // =======================================================================
  'both-sides': [
    {
      id: 'bs-symbolic', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
      build({ r, d, T, sr }) {
        const v = pick(r, VARS);
        const x = Broot(r, d);
        const a = nzc(r, 2, 4 + d);
        let c = d >= 3 ? nz(r, -(4 + d), 4 + d) : int(r, 1, 3 + d);
        if (a === c) c = a === 9 ? 2 : a + 1;
        const b = Bkonst(r, d);
        if (!distinct(a, b, c, x)) throw new Error('retry: repeated number');
        const e = (a - c) * x + b;
        const eqn = `${co(a, v)} ${sg(b)} = ${co(c, v)} ${sg(e)}`;
        return {
          stem: T(deck(sr, 'askSolve'), { v }),
          latex: eqn,
          type: 'numeric',
          answer: String(x),
          check: { kind: 'solve', math: eqn, variable: v },
          steps: [
            { latex: `${co(a - c, v)} ${sg(b)} = ${e}`, why: T('why.gatherUnknownOneSide', { term: co(c, v) }) },
            { latex: `${co(a - c, v)} = ${e - b}`, why: T('why.unwrapConstantFirst') },
            { latex: `${v} = ${x}`, why: T('why.divideBothByCoef', { a: a - c }) },
          ],
          distractors: [
            { v: rstr(div(R(e + b), R(a - c))), m: 'collect-wrong-side' },
            { v: rstr(div(R(e - b), R(a + c))), m: 'collect-wrong-side' },
            { v: String(-x), m: 'sign-slip' },
            { v: String(e - b), m: 'wrong-unwrap-order' },
            { v: rstr(div(R(e), R(a - c))), m: 'wrong-unwrap-order' },
            { v: String(x + 1), m: 'sign-slip' },
            { v: String(x - 1), m: 'sign-slip' },
          ],
        };
      },
    },
    {
      id: 'bs-special', rep: 'symbolic', dMin: 1, dMax: 5,
      build({ r, d, T, sr }) {
        const v = pick(r, ['x', 'n', 'm']);
        const a = nzc(r, 2, 4 + d);
        const b = Bkonst(r, d);
        const k = int(r, 2, 2 + d);
        // THE FOUR READINGS ARE DRAWN, AND THE STATEMENT IS BUILT TO MATCH.
        // See `SPECIAL_READINGS` for why the draw is the whole repair.
        const kind = specialKind(r);
        // Left: k(a v + b) — always. Right: whatever the drawn reading needs.
        const shift = kind === 'NONE' ? nz(r, 1, 5 + d) : 0;
        const x = kind === 'POS' ? int(r, 1, 4 + d) : kind === 'NEG' ? -int(r, 1, 4 + d) : 0;
        // A unique solution needs the two sides to carry DIFFERENT counts of
        // the unknown; `g` is the gap between them, and the loose number on the
        // right is then forced by the value the reading names.
        let g = 0;
        if (kind === 'POS' || kind === 'NEG') {
          g = int(r, 1, 3 + d);
          if (k * a - g === 0) throw new Error('retry: the unknown leaves the right side');
        }
        const rightA = k * a - g;
        const rightB = k * b + shift + g * x;
        const eqn = `${paren(k, lin(a, v, b))} = ${lin(rightA, v, rightB)}`;
        const solved = kind === 'POS' || kind === 'NEG';
        return {
          stem: T('ask.solveOrClassify', { v }),
          latex: eqn,
          type: 'special',
          answer: kind,
          check: {
            kind: 'solve', math: eqn, variable: v,
            expectKind: solved ? 'unique' : kind === 'ALL' ? 'all' : 'none',
          },
          steps: solved ? [
            { latex: `${lin(k * a, v, k * b)} = ${lin(rightA, v, rightB)}`, why: T('why.expandFirst') },
            { latex: `${co(g, v)} = ${g * x}`, why: T('why.gatherUnknownOneSide', { term: co(rightA, v) }) },
            { latex: `${v} = ${x}`, why: T('why.divideBothByCoef', { a: g }) },
          ] : [
            { latex: `${lin(k * a, v, k * b)} = ${lin(k * a, v, k * b + shift)}`, why: T('why.expandFirst') },
            {
              latex: kind === 'ALL' ? `0 = 0` : `0 = ${shift}`,
              why: kind === 'ALL' ? T('why.identityBothSidesSame') : T('why.contradictionNoValue'),
            },
          ],
          // The three readings that are NOT true of this statement — which is
          // every other reading the card carries, so the four on screen are the
          // same four every time and the key is uniform over them. That is the
          // whole of what keeps this surface at chance; see `SPECIAL_READINGS`.
          distractors: SPECIAL_KINDS.filter((z) => z !== kind).map((z) => ({ v: z, m: 'no-solution-confusion' })),
        };
      },
    },
    {
      id: 'bs-collect', rep: 'symbolic', dMin: 3, dMax: 5,
      build({ r, d, T, sr }) {
        // The special cases again, but reached by collecting like terms rather
        // than by opening a bracket. Same idea, unrecognisable template.
        const v = pick(r, ['x', 'n', 'p', 't']);
        const a = nz(r, 2, 7 + d * 2), c = nz(r, 1, 6 + d * 2);
        const b = Bkonst(r, d);
        const kind = specialKind(r);
        const solved = kind === 'POS' || kind === 'NEG';
        const shift = kind === 'NONE' ? nz(r, 1, 9 + d * 2) : 0;
        const x = kind === 'POS' ? int(r, 1, 4 + d) : kind === 'NEG' ? -int(r, 1, 4 + d) : 0;
        let g = 0;
        if (solved) {
          g = int(r, 1, 3 + d);
          if (a + c - g === 0) throw new Error('retry: the unknown leaves the right side');
        }
        const rightA = a + c - g;
        const rightB = b + shift + g * x;
        // left: a v + b + c v ; right: whatever the drawn reading needs
        const left = `${co(a, v)} ${sg(b)} ${sgc(c, v)}`;
        const right = lin(rightA, v, rightB);
        const eqn = `${left} = ${right}`;
        return {
          stem: T('ask.solveOrClassify', { v }),
          latex: eqn,
          type: 'special',
          answer: kind,
          check: {
            kind: 'solve', math: eqn, variable: v,
            expectKind: solved ? 'unique' : kind === 'ALL' ? 'all' : 'none',
          },
          steps: solved ? [
            { latex: `${lin(a + c, v, b)} = ${right}`, why: T('why.simplifySideFirst') },
            { latex: `${co(g, v)} ${sg(b)} = ${rightB}`, why: T('why.gatherUnknownOneSide', { term: co(rightA, v) }) },
            { latex: `${v} = ${x}`, why: T('why.divideBothByCoef', { a: g }) },
          ] : [
            { latex: `${lin(a + c, v, b)} = ${right}`, why: T('why.simplifySideFirst') },
            { latex: `${b} = ${b + shift}`, why: T('why.gatherUnknownOneSide', { term: co(a + c, v) }) },
            {
              latex: kind === 'ALL' ? `0 = 0` : `0 = ${shift}`,
              why: kind === 'ALL' ? T('why.identityBothSidesSame') : T('why.contradictionNoValue'),
            },
          ],
          distractors: SPECIAL_KINDS.filter((z) => z !== kind).map((z) => ({ v: z, m: 'no-solution-confusion' })),
        };
      },
    },
    {
      id: 'bs-context', rep: 'context', dMin: 1, dMax: 5, distinctNums: true, scenes: 'plans',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'plans');
        const v = 'n';
        const a = int(r, 4, 6 + d);
        const c = int(r, 2, a - 1);
        const b = int(r, 2, 8 + d * 3);
        const x = int(r, 2, 6 + d * 2);
        const e = (a - c) * x + b;
        if (!distinct(a, b, c, e, x)) throw new Error('retry: repeated number');
        const eqn = `${co(a, v)} + ${b} = ${co(c, v)} + ${e}`;
        return {
          stem: `${T(sc, { a, b, c, e })} ${T('ask.whenSameCost')}`,
          latex: eqn,
          type: 'numeric',
          answer: String(x),
          check: { kind: 'solve', math: eqn, variable: v },
          steps: [
            { latex: `${co(a - c, v)} + ${b} = ${e}`, why: T('why.gatherUnknownOneSide', { term: co(c, v) }) },
            { latex: `${co(a - c, v)} = ${e - b}`, why: T('why.unwrapConstantFirst') },
            { latex: `${v} = ${x}`, why: T('why.divideBothByCoef', { a: a - c }) },
          ],
          distractors: [
            { v: rstr(div(R(e + b), R(a - c))), m: 'collect-wrong-side' },
            { v: rstr(div(R(e - b), R(a + c))), m: 'collect-wrong-side' },
            { v: String(e - b), m: 'wrong-unwrap-order' },
            { v: rstr(div(R(e), R(a - c))), m: 'wrong-unwrap-order' },
            { v: String(x + 1), m: 'sign-slip' },
            { v: String(x - 1), m: 'sign-slip' },
          ],
        };
      },
    },
    {
      /* dMin 1, for the same reason and with the same evidence: both-sides
         below band 3 was "solve it symbolically" or "read the two plans", and
         nothing else. Two lines crossing is the most concrete picture of what
         "both sides are equal" MEANS, so serving it only to learners who have
         already got there was exactly backwards. 400/400 clean at band 1. */
      id: 'bs-graph', rep: 'graph', dMin: 1, dMax: 5, scenes: 'twoTraces',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'twoTraces');
        const R2 = band(d).chart;
        const lim = R2 - 1;
        const m1 = nz(r, 1, 1 + d);
        const m2 = nz(r, -(1 + d), 1 + d);
        if (m1 === m2) throw new Error('retry: parallel');
        const x = nz(r, -Math.min(5, lim), Math.min(5, lim));
        const b1 = int(r, -Math.floor(lim / 2), Math.floor(lim / 2));
        const y = m1 * x + b1;
        const b2 = y - m2 * x;
        if (Math.abs(y) > lim || Math.abs(b2) > lim) throw new Error('retry: off chart');
        const pts1 = [[0, b1], [2, 2 * m1 + b1]];
        const pts2 = [[0, b2], [2, 2 * m2 + b2]];
        if (pts1.concat(pts2).some((p) => Math.abs(p[1]) > lim)) throw new Error('retry: off chart');
        const eqn = `${lin(m1, 'x', b1)} = ${lin(m2, 'x', b2)}`;
        return {
          stem: `${T(sc)} ${T('ask.whereTracesMeet')}`,
          latex: eqn,
          type: 'numeric',
          answer: String(x),
          figure: { kind: 'lines', lines: [{ m: m1, b: b1 }, { m: m2, b: b2 }], points: pts1.concat(pts2), mark: [x, y], showMark: false, range: R2 },
          check: { kind: 'solve', math: eqn, variable: 'x' },
          steps: [
            { latex: `${lin(m1, 'x', b1)} = ${lin(m2, 'x', b2)}`, why: T('why.meetMeansEqual') },
            { latex: `${lin(m1 - m2, 'x', b1)} = ${b2}`, why: T('why.gatherUnknownOneSide', { term: co(m2, 'x') }) },
            { latex: `${co(m1 - m2, 'x')} = ${b2 - b1}`, why: T('why.unwrapConstantFirst') },
            { latex: `x = ${x}`, why: T('why.divideBothByCoef', { a: m1 - m2 }) },
          ],
          distractors: [
            { v: String(y), m: 'axis-swap' },
            { v: String(-x), m: 'sign-slip' },
            { v: rstr(div(R(b2 - b1), R(m1 + m2 || 1))), m: 'collect-wrong-side' },
            { v: String(b1), m: 'axis-swap' },
            { v: String(b2), m: 'axis-swap' },
            { v: String(x + 1), m: 'sign-slip' },
            { v: String(x - 1), m: 'sign-slip' },
          ],
        };
      },
    },
    {
      id: 'bs-bracket', rep: 'symbolic', dMin: 4, dMax: 5, distinctNums: true,
      build({ r, d, T, sr }) {
        const v = pick(r, ['x', 'n', 'm']);
        const k = int(r, 2, 2 + d), a = nz(r, 1, 2 + d), b = nz(r, -(4 + d), 4 + d);
        const c = nz(r, 1, 4 + d), e = Bkonst(r, d);
        const A = k * a, B = k * b;
        if (A === c) throw new Error('retry: same coefficient');
        const x = Broot(r, d);
        if (!distinct(k, a, b, c, x)) throw new Error('retry: repeated number');
        const rightConst = (A - c) * x + B;
        const eqn = `${paren(k, lin(a, v, b))} = ${lin(c, v, rightConst)}`;
        return {
          stem: T(deck(sr, 'askSolve'), { v }),
          latex: eqn,
          type: 'numeric',
          answer: String(x),
          check: { kind: 'solve', math: eqn, variable: v },
          steps: [
            { latex: `${lin(A, v, B)} = ${lin(c, v, rightConst)}`, why: T('why.expandFirst') },
            { latex: `${co(A - c, v)} ${sg(B)} = ${rightConst}`, why: T('why.gatherUnknownOneSide', { term: co(c, v) }) },
            { latex: `${co(A - c, v)} = ${rightConst - B}`, why: T('why.unwrapConstantFirst') },
            { latex: `${v} = ${x}`, why: T('why.divideBothByCoef', { a: A - c }) },
          ],
          distractors: [
            { v: rstr(div(R(rightConst + B), R(A - c))), m: 'collect-wrong-side' },
            { v: rstr(div(R(rightConst - B), R(A + c))), m: 'collect-wrong-side' },
            { v: rstr(div(R(rightConst - b), R(A - c))), m: 'partial-distribute' },
            { v: String(rightConst - B), m: 'wrong-unwrap-order' },
            { v: String(-x), m: 'sign-slip' },
            { v: String(x + 1), m: 'sign-slip' },
          ],
        };
      },
    },
    {
      id: 'bs-dispute', rep: 'verbal', dMin: 3, dMax: 5, distinctNums: true, scenes: 'dispute',
      build({ r, d, T, sr }) {
        const sc = deck(sr, 'dispute');
        const v = pick(r, ['x', 'n', 'm']);
        const a = int(r, 3, 5 + d), c = int(r, 1, a - 1);
        const b = Bkonst(r, d);
        const x = Broot(r, d);
        const gapc = a - c;
        if ((2 * b) % gapc !== 0) throw new Error('retry: the wrong reading is not a whole number');
        const e = gapc * x + b;
        const wrong = x + (2 * b) / gapc;
        if (wrong === x) throw new Error('retry: the two readings agree');
        if (!distinct(a, b, c, x)) throw new Error('retry: repeated number');
        const eqn = `${co(a, v)} ${sg(b)} = ${co(c, v)} ${sg(e)}`;
        const i = int(r, 0, NAMES.length - 1);
        const j = (i + 1 + int(r, 0, NAMES.length - 2)) % NAMES.length;
        return {
          stem: `${T(sc, { one: NAMES[i], two: NAMES[j], a: x, b: wrong })} ${T('ask.whichIsRight')}`,
          latex: eqn,
          type: 'numeric',
          answer: String(x),
          check: { kind: 'solve', math: eqn, variable: v },
          steps: [
            { latex: `${co(gapc, v)} ${sg(b)} = ${e}`, why: T('why.gatherUnknownOneSide', { term: co(c, v) }) },
            { latex: `${co(gapc, v)} = ${e - b}`, why: T('why.unwrapConstantFirst') },
            { latex: `${v} = ${x}`, why: T('why.divideBothByCoef', { a: gapc }) },
          ],
          distractors: [
            { v: String(wrong), m: 'collect-wrong-side' },
            { v: rstr(div(R(e - b), R(a + c))), m: 'collect-wrong-side' },
            { v: String(e - b), m: 'wrong-unwrap-order' },
            { v: rstr(div(R(e), R(gapc))), m: 'wrong-unwrap-order' },
            { v: String(-x), m: 'sign-slip' },
            { v: String(x + 1), m: 'sign-slip' },
            { v: String(x - 1), m: 'sign-slip' },
          ],
        };
      },
    },
  ],
};

// ---------------------------------------------------------------------------
// tables
// ---------------------------------------------------------------------------
function arrayTex(vname, ruleLabel, rows, missingIndex) {
  const body = rows
    .map((row, i) => `${row[0]} & ${i === missingIndex ? '?' : row[1]}`)
    .join(' \\\\ ');
  return `\\begin{array}{c|c} ${vname} & ${ruleLabel} \\\\ \\hline ${body} \\end{array}`;
}
function arrayTexInput(vname, ruleLabel, rowsShown) {
  const body = rowsShown
    .map((row) => `${row[0] === null ? '?' : row[0]} & ${row[1]}`)
    .join(' \\\\ ');
  return `\\begin{array}{c|c} ${vname} & ${ruleLabel} \\\\ \\hline ${body} \\end{array}`;
}

/**
 * Does the prompt on screen really say what the verifier checked?
 *
 * True when the checked expression IS the prompt, or sits inside it delimited
 * by something that cannot change its value: a digit, letter, sign or exponent
 * touching either end means the learner is reading a different quantity from
 * the one that was proved correct.
 */
function targetIsThePrompt(latex, math) {
  const hay = normalise(latex);
  const needle = normalise(math);
  if (hay === needle) return true;
  const OPEN = /[0-9a-zA-Z.+\-]/;   // would extend a number or a term leftwards
  const CLOSE = /[0-9a-zA-Z.^]/;    // would extend it, or raise it to a power
  for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + 1)) {
    const before = i > 0 ? hay[i - 1] : '';
    const after = hay[i + needle.length] || '';
    if ((before && OPEN.test(before)) || (after && CLOSE.test(after))) continue;
    return true;
  }
  return false;
}

// ---------------------------------------------------------------------------
// Verification — the item is read back and worked out from scratch.
// ---------------------------------------------------------------------------
export function verify(item) {
  const c = item.check;
  if (!c) throw new Error('item has no verification descriptor');

  // The mathematics we check must be the mathematics we display — and a
  // substring test is not enough to say so. "3(x+2)" occurs inside "-3(x+2)"
  // and "12+4" occurs inside "112+4": both would pass, and both describe an
  // item whose answer is right about a prompt the learner is not looking at.
  // That is the one way a fully verified bank can still tell a correct student
  // they are wrong, so the match has to land on a boundary where no digit,
  // letter, sign or exponent is left dangling outside it.
  if (c.math && !c.loose) {
    if (item.noDisplay) {
      // AN ITEM WITH NO DISPLAY IS CHECKED AGAINST WHAT IS ON SCREEN INSTEAD.
      //
      // The rule above is "the mathematics we check must be the mathematics we
      // display", and it exists so a verified bank cannot mark a correct
      // learner wrong about a prompt they are not looking at. A no-display item
      // has no prompt to compare with — that is the whole point of it — but the
      // rule still has to hold, because the learner is still looking at
      // something. What they are looking at is the DRAWING, so the target must
      // be built out of the drawing's own labels and nothing else.
      //
      // `lt-perimeter` is the case: the rectangle is labelled `7x + 1` and
      // `5x + 11`, the target is those four sides added up, and a learner who
      // reads the picture can produce it. If a label ever stopped appearing in
      // the target, the item would be asking about a shape it is not drawing —
      // the same defect as a prompt/target mismatch, arrived at from the side.
      const labels = [item.figure?.wLabel, item.figure?.hLabel, item.figure?.label]
        .filter(Boolean).map(String);
      if (!labels.length) {
        throw new Error('an item with no display and no drawing cannot be checked against a target');
      }
      const bare = (x) => String(x).replace(/\s+/g, '').replace(/\\left|\\right/g, '');
      for (const lab of labels) {
        if (!bare(c.math).includes(bare(lab))) {
          throw new Error(`verification target "${c.math}" does not use the drawn side "${lab}"`);
        }
      }
    } else if (!targetIsThePrompt(item.latex, c.math)) {
      throw new Error(`verification target "${c.math}" is not what the prompt "${item.latex}" displays`);
    }
  }

  switch (c.kind) {
    case 'evaluate': {
      const got = evaluate(c.math, c.env);
      const want = fromString(item.answer);
      if (!want) throw new Error(`answer "${item.answer}" is not an exact value`);
      if (!reqq(got, want)) throw new Error(`evaluated ${rstr(got)} but answer says ${item.answer}`);
      checkStepsEqual(item.steps, c.env);
      break;
    }
    case 'solve': {
      const sol = solveLinear(c.math, c.variable);
      if (c.expectKind) {
        if (sol.kind !== c.expectKind) throw new Error(`expected ${c.expectKind}, solver said ${sol.kind}`);
      } else {
        if (sol.kind !== 'unique') throw new Error(`solver said ${sol.kind}, item claims a unique answer`);
        const want = fromString(item.answer);
        if (!want) throw new Error(`answer "${item.answer}" is not an exact value`);
        if (!reqq(sol.value, want)) throw new Error(`solved ${rstr(sol.value)} but answer says ${item.answer}`);
      }
      checkStepsSolve(item.steps, c.variable, sol);
      break;
    }
    case 'equivalent': {
      if (!equivalent(c.math, item.answer, c.variable)) {
        throw new Error(`answer "${item.answer}" is not equivalent to the prompt`);
      }
      checkStepsEquivalent(item.steps, c.variable);
      break;
    }
    case 'equationChoice': {
      const sol = solveLinear(item.answer, c.variable);
      if (sol.kind !== 'unique' || rstr(sol.value) !== c.expect) {
        throw new Error(`chosen equation does not model the situation (${sol.kind})`);
      }
      break;
    }
    case 'table': {
      const cells = parseArrayCells(item.latex);
      const data = cells.slice(1); // drop header row
      const known = [];
      for (const row of data) {
        if (row.length < 2) continue;
        if (row[0] === '?' || row[1] === '?') continue;
        known.push([Number(row[0]), Number(row[1])]);
      }
      if (known.length < 2) throw new Error('table has too few complete rows to infer a rule');
      const [x1, y1] = known[0], [x2, y2] = known[1];
      const m = div(sub(R(y2), R(y1)), sub(R(x2), R(x1)));
      const b = sub(R(y1), mul(m, R(x1)));
      for (const [x, y] of known) {
        if (!reqq(add(mul(m, R(x)), b), R(y))) throw new Error('table rows are not one consistent linear rule');
      }
      const gap = data.find((row) => row[0] === '?' || row[1] === '?');
      if (!gap) throw new Error('table has no gap');
      const want = fromString(item.answer);
      if (!want) throw new Error('table answer is not exact');
      const got = gap[0] === '?' ? div(sub(R(Number(gap[1])), b), m) : add(mul(m, R(Number(gap[0]))), b);
      if (!reqq(got, want)) throw new Error(`table gap is ${rstr(got)} but answer says ${item.answer}`);
      break;
    }
    case 'graph': {
      const [[x1, y1], [x2, y2]] = c.points;
      const m = div(sub(R(y2), R(y1)), sub(R(x2), R(x1)));
      const b = sub(R(y1), mul(m, R(x1)));
      const want = fromString(item.answer);
      const got = c.mode === 'y' ? add(mul(m, R(c.at)), b) : div(sub(R(c.at), b), m);
      if (!want || !reqq(got, want)) throw new Error(`graph reading is ${rstr(got)} but answer says ${item.answer}`);
      break;
    }
    // -----------------------------------------------------------------------
    // LEVEL 2 KINDS.
    //
    // Every one of them re-derives its answer from the notation the learner is
    // actually shown, in exact rational arithmetic, using nothing the generator
    // computed. A generator that is wrong about its own item cannot make any of
    // these agree with it.
    // -----------------------------------------------------------------------
    case 'inequality': {
      const sol = solveInequality(c.math, c.variable);
      if (c.want === 'least' || c.want === 'greatest') {
        const want = fromString(item.answer);
        if (!want) throw new Error(`answer "${item.answer}" is not an exact value`);
        const got = edgeInteger(sol, c.want);
        if (!reqq(got, want)) throw new Error(`the ${c.want} whole number is ${rstr(got)}, not ${item.answer}`);
      } else {
        const canon = statementTex(c.variable, sol.rel, sol.value);
        if (normalise(item.answer) !== normalise(canon)) {
          throw new Error(`solving gives "${canon}" but the answer says "${item.answer}"`);
        }
      }
      checkStepsInequality(item.steps, c.variable, sol);
      break;
    }
    case 'compound': {
      const band = solveCompound(c.math, c.variable);
      if (c.want === 'count') {
        const want = fromString(item.answer);
        if (!want) throw new Error(`answer "${item.answer}" is not an exact value`);
        const lo = edgeInteger({ rel: band.lower.rel, value: band.lower.value }, 'least');
        const hi = edgeInteger({ rel: band.upper.rel, value: band.upper.value }, 'greatest');
        const got = R(Math.max(0, toNum(hi) - toNum(lo) + 1));
        if (!reqq(got, want)) throw new Error(`the band holds ${rstr(got)} whole numbers, not ${item.answer}`);
      } else {
        const canon = bandTex(c.variable, band);
        if (normalise(item.answer) !== normalise(canon)) {
          throw new Error(`the band is "${canon}" but the answer says "${item.answer}"`);
        }
      }
      // Each worked line must describe the same band as the one before it.
      for (const s of item.steps) {
        if (/\\Rightarrow|\\square/.test(s.latex)) continue;
        let got;
        try { got = solveCompound(s.latex, c.variable); } catch { continue; }
        if (bandTex(c.variable, got) !== bandTex(c.variable, band)) {
          throw new Error(`worked line changes the band: ${s.latex}`);
        }
      }
      break;
    }
    case 'rearrange': {
      const v = c.variable;
      if (new RegExp(`(^|[^a-zA-Z])${v}([^a-zA-Z]|$)`).test(item.answer)) {
        throw new Error(`the rearranged form still mentions ${v}`);
      }
      let proved = 0;
      for (let s = 0; s < SAMPLE_SETS.length && proved < 4; s++) {
        const env = {};
        (c.vars || []).forEach((name, i) => { env[name] = R(SAMPLE_SETS[s][i % SAMPLE_SETS[s].length]); });
        let sol, got;
        try { sol = isolate(c.math, v, env); } catch { continue; }
        try { got = evaluate(item.answer, env); } catch { continue; }
        if (!reqq(sol, got)) {
          throw new Error(`rearranged form gives ${rstr(got)} where the formula gives ${rstr(sol)}`);
        }
        for (const st of item.steps) {
          let sv;
          try { sv = isolate(st.latex, v, env); } catch { continue; }
          if (!reqq(sv, sol)) throw new Error(`worked line changes the rearrangement: ${st.latex}`);
        }
        proved += 1;
      }
      if (proved < 3) throw new Error('the rearrangement could not be checked at enough values');
      break;
    }
    case 'proportion': {
      const value = solveProportion(c.math, c.variable);
      const want = fromString(item.answer);
      if (!want) throw new Error(`answer "${item.answer}" is not an exact value`);
      if (!reqq(value, want)) throw new Error(`the proportion gives ${rstr(value)} but the answer says ${item.answer}`);
      checkStepsEqual(item.steps, { [c.variable]: value });
      break;
    }
    case 'system': {
      for (const eq of c.eqs) {
        if (!targetIsThePrompt(item.latex, eq)) throw new Error(`"${eq}" is not one of the statements on screen`);
      }
      const sol = solveSystem(c.eqs, c.vars);
      if (c.want === 'pair') {
        // "\left(3, -4\right)" — both readings at once, read back off the answer.
        const m = /^\\left\(\s*(-?\d+)\s*,\s*(-?\d+)\s*\\right\)$/.exec(String(item.answer).trim());
        if (!m) throw new Error(`answer "${item.answer}" is not a pair of readings`);
        c.vars.forEach((name, i) => {
          if (!reqq(sol[name], R(Number(m[i + 1])))) {
            throw new Error(`the pair meets at ${name} = ${rstr(sol[name])}, not ${m[i + 1]}`);
          }
        });
      } else {
        const want = fromString(item.answer);
        if (!want) throw new Error(`answer "${item.answer}" is not an exact value`);
        const got = sol[c.want];
        if (!reqq(got, want)) throw new Error(`the pair solves to ${c.want} = ${rstr(got)}, not ${item.answer}`);
      }
      // A worked line in a system is a statement that must be TRUE at the
      // solution — substitution, elimination and back-substitution all are.
      checkStepsEqual(item.steps, sol);
      break;
    }
    // A line handed over as a statement in two unknowns rather than as two
    // readings: Ax + By = C. The coefficients are probed off the printed
    // equation, never taken from the generator.
    case 'lineEquation': {
      const { a, b, c: rhs } = coeffs2(c.math, 'x', 'y');
      if (isZero(b)) throw new Error('this statement draws an upright line, which has no rate');
      const m = neg(div(a, b));
      const yInt = div(rhs, b);
      if (c.want === 'equation') {
        const side = String(item.answer).split('=').slice(1).join('=').trim();
        if (!side) throw new Error('a rule has to be written as an equation');
        if (!equivalent(side, texLine(m, yInt), 'x')) {
          throw new Error(`the rule "${item.answer}" is not the same line as the statement`);
        }
      } else {
        const want = fromString(item.answer);
        if (!want) throw new Error(`answer "${item.answer}" is not an exact value`);
        if (c.want === 'xintercept' && isZero(a)) throw new Error('this statement never crosses the upright axis');
        const got = c.want === 'slope' ? m
          : c.want === 'intercept' ? yInt
            : div(rhs, a);
        if (!reqq(got, want)) throw new Error(`the statement gives ${rstr(got)} but the answer says ${item.answer}`);
      }
      checkStepsEqual(item.steps, {});
      break;
    }
    case 'line': {
      for (const [px, py] of c.points) {
        if (!pointIsOnScreen(item, px, py)) throw new Error(`the point (${px}, ${py}) is nowhere on screen`);
      }
      const [[x1, y1], [x2, y2]] = c.points;
      if (x1 === x2) throw new Error('two readings at the same input describe no rate');
      const m = div(sub(R(y2), R(y1)), sub(R(x2), R(x1)));
      const b = sub(R(y1), mul(m, R(x1)));
      if (c.want === 'equation') {
        const rhs = String(item.answer).split('=').slice(1).join('=').trim();
        if (!rhs) throw new Error('a rule has to be written as an equation');
        if (!equivalent(rhs, texLine(m, b), 'x')) {
          throw new Error(`the rule "${item.answer}" is not the line through the readings`);
        }
      } else {
        const want = fromString(item.answer);
        if (!want) throw new Error(`answer "${item.answer}" is not an exact value`);
        const got = c.want === 'slope' ? m
          : c.want === 'intercept' ? b
            : c.want === 'y' ? add(mul(m, R(c.at)), b)
              : div(sub(R(c.at), b), m);
        if (!reqq(got, want)) throw new Error(`the line gives ${rstr(got)} but the answer says ${item.answer}`);
      }
      checkStepsEqual(item.steps, {});
      break;
    }
    // -----------------------------------------------------------------------
    // LEVEL 3 KINDS — the quadratics strand.
    //
    // Level 2 could always reach its answer with exact rationals. This strand
    // cannot: the roots of x^{2} - 2x - 4 = 0 are irrational, and a checker
    // that reached for a decimal there would be deciding mastery on a float.
    // So the arithmetic is widened to Q(sqrt k) (`./surd.js`) rather than
    // loosened, and the SUBSTITUTION — not the formula — is what proves a root.
    // -----------------------------------------------------------------------

    /**
     * Solving a quadratic. `c.want`:
     *   'roots'    the whole solution set, smallest first
     *   'greater' / 'lesser'      one named root
     *   'positive' / 'negative'   the one root with that sign
     *   'unique'   a repeated root, which needs the discriminant to be zero
     *   'none'     no real solution
     */
    case 'quadratic': {
      const v = c.variable;
      const sol = solveQuadratic(c.math, v);
      if (sol.kind === 'notQuadratic') throw new Error(`the squared term cancels: this is not a quadratic in ${v}`);
      if (sol.kind === 'identity') throw new Error(`this statement is true for every ${v}`);
      if (sol.kind === 'none') throw new Error('this statement is true for no value at all');
      if (isZero(sol.a)) throw new Error('a quadratic needs a squared term');
      if (c.want === 'none') {
        if (sol.kind !== 'noReal') throw new Error(`this equation does have solutions: ${rootSetTex(v, rootsOf(sol))}`);
        requireVerdict(item, 'NONE', 'the discriminant is below zero');
        break;
      }
      if (sol.kind === 'noReal') throw new Error(`the discriminant is ${rstr(sol.disc)}, so there is no real solution to name`);
      if (c.want === 'unique' && sol.kind !== 'oneRational') {
        throw new Error(`the discriminant is ${rstr(sol.disc)}, not zero, so this equation has two solutions`);
      }
      const roots = rootsOf(sol);
      if (!c.want || c.want === 'roots' || c.want === 'unique') {
        proveRootSet(item, c, sol, v);
        break;
      }
      let wanted;
      if (c.want === 'greater') wanted = roots[roots.length - 1];
      else if (c.want === 'lesser') wanted = roots[0];
      else if (c.want === 'positive' || c.want === 'negative') {
        const sgn = c.want === 'positive' ? 1 : -1;
        const hits = roots.filter((r) => sCmp(r, SR(R(0))) === sgn);
        if (hits.length !== 1) throw new Error(`this equation has ${hits.length} ${c.want} solutions, so naming one is ambiguous`);
        [wanted] = hits;
      } else throw new Error(`unknown quadratic ask ${c.want}`);
      const claimed = exactValue(item.answer, v);
      if (c.spelling !== 'any' && !spellingOk(String(item.answer), [claimed])) {
        throw new Error(`"${item.answer}" is not the spelling this checker uses; it writes ${valueTex(wanted)}`);
      }
      if (!sEq(claimed, wanted)) {
        throw new Error(`the ${c.want} solution is ${valueTex(wanted)} but the answer says "${item.answer}"`);
      }
      // THE PROOF: the claimed value goes back into the printed equation.
      const back = sAdd(sAdd(sMul(SR(sol.a), sPow(claimed, 2)), sMul(SR(sol.b), claimed)), SR(sol.c));
      if (!sIsZero(back)) throw new Error(`putting ${sTex(claimed)} back into the equation leaves ${sTex(back)}, not zero`);
      break;
    }

    /**
     * A radical, simplified or combined. `c.form` is 'simplify' or 'combine'.
     * The factoring is proved by squaring back in whole numbers, so the
     * factoriser is never taken on its own word.
     */
    case 'radical': {
      const shown = parse(c.math);
      if (!containsSqrt(shown)) throw new Error('a radical item must show a radical');
      const value = evalSurd(shown, {});
      if (sIsRational(value)) {
        throw new Error(`this expression is worth ${texOf(value.p)}, which is rational: that is an evaluate item`);
      }
      if (c.form === 'simplify') {
        const rads = radicandsOf(shown);
        if (rads.length !== 1) throw new Error('a simplify prompt shows exactly one radical');
        const n = rads[0];
        if (n === null || n <= 0) throw new Error('a simplify prompt needs a whole radicand above zero');
        const { m, k } = simplifySqrt(n);
        if (m * m * k !== n) throw new Error(`the square factor of ${n} does not multiply back`);
        if (k === 1) throw new Error(`\\sqrt{${n}} is a whole number: that is an evaluate item`);
      } else if (c.form !== 'combine') {
        throw new Error(`unknown radical form ${c.form}`);
      }
      const claimed = exactValue(item.answer, null);
      if (!sEq(claimed, value)) {
        throw new Error(`the expression is worth ${sTex(value)} but the answer says "${item.answer}"`);
      }
      if (c.spelling !== 'any' && !spellingOk(String(item.answer), [claimed])) {
        throw new Error(`"${item.answer}" is not the spelling this checker uses; it writes ${sTex(value)}`);
      }
      break;
    }

    /**
     * A rational exponent. THE PROOF TAKES NO ROOT AT ALL: the learner's value
     * is raised to the q-th power in exact arithmetic and must equal a^p.
     */
    case 'rationalExponent': {
      const node = parse(c.math);
      if (node.k !== 'pow') throw new Error('a rational-exponent prompt shows one power');
      const base = evalAst(node.a, {});
      const ex = evalAst(node.b, {});
      const q = ex.d;
      const p = ex.n;
      if (q === 0) throw new Error('an exponent with no denominator is not a number');
      if (isZero(base) && p <= 0) throw new Error('zero to a power that is not above zero has no value');
      if (base.n < 0 && q % 2 === 0) throw new Error(`an even root of ${rstr(base)} is not a real number`);
      const target = rpow(base, p);
      const claimed = exactValue(item.answer, null);
      if (q % 2 === 0 && sCmp(claimed, SR(R(0))) < 0) {
        throw new Error('an even root is taken as the value that is not below zero');
      }
      const back = sPow(claimed, q);
      if (!sEq(back, SR(target))) {
        throw new Error(`"${item.answer}" to the power ${q} is ${sTex(back)}, and ${rstr(base)} to the power ${p} is ${rstr(target)}`);
      }
      if (!sIsRational(claimed) && c.spelling !== 'any' && !spellingOk(String(item.answer), [claimed])) {
        throw new Error(`"${item.answer}" is not the spelling this checker uses; it writes ${sTex(claimed)}`);
      }
      break;
    }

    /**
     * Factored form. Two clauses, both required: the answer must be the same
     * function as the prompt AT EVERY VALUE, and it must be a PRODUCT — a
     * learner who retypes the prompt passes the first and fails the second.
     */
    case 'factored': {
      const v = c.variable;
      const cs = polyCoeffs(c.math, v, 3);
      const dg = polyDegree(cs);
      if (c.form === 'decide') {
        // "Is this a difference of two squares?" — an exact whole-number test.
        if (dg !== 2) throw new Error('a difference of two squares is written as a quadratic');
        if (!isZero(cs[1] || R(0))) throw new Error('a difference of two squares has no middle term');
        const lead = cs[2]; const kon = cs[0] || R(0);
        const yes = lead.n > 0 && kon.n < 0 && isPerfectSquareR(lead) && isPerfectSquareR(neg(kon));
        requireVerdict(item, yes ? 'YES' : 'NO', yes
          ? 'both parts are squares and the second is taken away'
          : 'this is not a square take away a square');
        break;
      }
      if (dg > 2) {
        // The one family above degree two the strand teaches: a common factor
        // times a difference of squares, which is odd powers only.
        if (dg !== 3 || !isZero(cs[0] || R(0)) || !isZero(cs[2] || R(0))) {
          throw new Error(`degree ${dg} is outside the difference-of-squares family this kind factors`);
        }
      }
      if (!equivalent(c.math, item.answer, v)) {
        throw new Error(`"${item.answer}" is not the same expression as the prompt "${c.math}"`);
      }
      const factors = flattenProduct(parse(String(item.answer)));
      let usesVariable = 0;
      for (const f of factors) {
        let lin;
        try { lin = linearize(f, v); } catch (e) {
          throw new Error(`"${item.answer}" is not a product of factors that are each linear in ${v} (${e.message})`);
        }
        if (!isZero(lin.a)) usesVariable++;
      }
      if (usesVariable < 2) {
        throw new Error(`"${item.answer}" is not a product of two or more factors that use ${v}`);
      }
      break;
    }

    /**
     * Polynomial division. THIS KIND NEVER DIVIDES. `equivalent()` samples at
     * the value that empties the divisor, so a fraction would be judged false
     * for a correct item; instead the checker MULTIPLIES BACK, which needs no
     * excluded value at all.
     */
    case 'polyQuotient': {
      const v = c.variable;
      for (const src of [c.dividend, c.divisor, c.quotient, c.remainder]) {
        if (src && !targetIsThePrompt(item.latex, src)) throw new Error(`"${src}" is not what the prompt displays`);
      }
      const D = polyCoeffs(c.dividend, v, 6);
      const B = polyCoeffs(c.divisor, v, 6);
      const degB = polyDegree(B);
      const degD = polyDegree(D);
      if (degB < 1) throw new Error('a divisor of degree zero is not a division to do');
      if (degB > degD) throw new Error('the divisor has a higher degree than the dividend');
      const qSrc = c.want === 'remainder' ? c.quotient : String(item.answer);
      const rSrc = c.want === 'remainder' ? String(item.answer) : c.remainder;
      if (c.want === 'remainder' && !c.quotient) throw new Error('a remainder item must print its quotient');
      const Q = polyCoeffs(qSrc, v, 6);
      const Rem = rSrc ? polyCoeffs(rSrc, v, 6) : [R(0)];
      if (polyDegree(Rem) >= degB) {
        throw new Error(`the remainder has degree ${polyDegree(Rem)}, which is not below the divisor's ${degB}`);
      }
      // Multiplying back is the proof, and it is done twice: once on exact
      // coefficients, and once through `equivalent()` on the strings, which is
      // the route the shipped kinds use.
      const product = [];
      for (let i = 0; i < B.length; i++) {
        for (let j = 0; j < Q.length; j++) product[i + j] = add(product[i + j] || R(0), mul(B[i], Q[j]));
      }
      for (let i = 0; i < Rem.length; i++) product[i] = add(product[i] || R(0), Rem[i]);
      for (let i = 0; i < Math.max(product.length, D.length); i++) {
        if (!reqq(product[i] || R(0), D[i] || R(0))) {
          throw new Error(`multiplying back gives ${polyTex(product, v)}, not ${c.dividend}`);
        }
      }
      const backTex = `\\left(${c.divisor}\\right)\\left(${qSrc}\\right)${rSrc ? ` + \\left(${rSrc}\\right)` : ''}`;
      if (!equivalent(backTex, c.dividend, v)) {
        throw new Error(`multiplying back does not reproduce "${c.dividend}"`);
      }
      break;
    }

    /**
     * Vertex form. The identity holds at fourteen values, which for a
     * quadratic is a proof, so h and k ARE the turning point by construction
     * and no second derivation is asserted. What is left to check is SHAPE:
     * the standard form is identically equal and must earn no credit.
     */
    case 'vertexForm': {
      const v = c.variable;
      const cs = polyCoeffs(c.math, v, 2);
      if (polyDegree(cs) !== 2) throw new Error('vertex form is asked of a rule of degree two');
      if (!equivalent(c.math, item.answer, v)) {
        throw new Error(`"${item.answer}" is not the same rule as the prompt "${c.math}"`);
      }
      const node = parse(String(item.answer));
      let squares = 0;
      walkAst(node, (n) => {
        if (n.k !== 'pow') return;
        let e;
        try { e = evalAst(n.b, {}); } catch { throw new Error('a power in the answer is not a whole number'); }
        if (e.d !== 1 || e.n < 0) throw new Error('a power in the answer is not a whole number');
        if (e.n >= 2) squares++;
      });
      if (squares !== 1) throw new Error(`vertex form holds exactly one squared bracket, and "${item.answer}" holds ${squares}`);
      vertexShape(node, v);
      break;
    }

    /**
     * One named feature of a printed rule of degree one or two. Coefficients
     * are probed off the notation and confirmed at five inputs, exactly as the
     * quadratic route does, so no higher power can hide behind a bracket.
     */
    case 'features': {
      const v = c.variable;
      const { a, b, c: k0, node, degree } = ruleCoeffs(c.math, v);
      if (degree < 1 || degree > 2) throw new Error('a features prompt is a rule of degree one or two');
      const quadratic = degree === 2;
      if (['vertex', 'axis', 'extremeValue', 'extremeKind', 'opening'].includes(c.want) && !quadratic) {
        throw new Error(`a rule of degree ${degree} has no ${c.want}`);
      }
      const vertexIn = quadratic ? div(neg(b), mul(R(2), a)) : null;
      const vertexOut = quadratic ? sub(k0, div(mul(b, b), mul(R(4), a))) : null;
      switch (c.want) {
        case 'yIntercept': {
          const want = fromString(item.answer);
          if (!want) throw new Error(`answer "${item.answer}" is not an exact value`);
          if (!reqq(evalAst(node, { [v]: R(0) }), want)) {
            throw new Error(`the rule reads ${rstr(k0)} at zero but the answer says ${item.answer}`);
          }
          break;
        }
        case 'zeros': {
          const sol = solveQuadratic(`${c.math} = 0`, v);
          if (sol.kind === 'noReal') {
            requireVerdict(item, 'NONE', 'the discriminant is below zero');
            break;
          }
          if (sol.kind === 'notQuadratic') {
            const want = exactValue(item.answer, v);
            if (!sEq(want, SR(sol.root))) throw new Error(`the rule is zero at ${rstr(sol.root)}, not at "${item.answer}"`);
            break;
          }
          proveRootSet(item, c, sol, v);
          break;
        }
        case 'vertex': {
          const pair = exactPair(item.answer);
          if (!pair) throw new Error(`answer "${item.answer}" is not a pair of readings`);
          if (!reqq(pair[0], vertexIn) || !reqq(pair[1], vertexOut)) {
            throw new Error(`the turning point is \\left(${texOf(vertexIn)}, ${texOf(vertexOut)}\\right), not "${item.answer}"`);
          }
          break;
        }
        case 'axis': {
          const at = String(item.answer).indexOf('=');
          if (at < 0) throw new Error(`an axis of symmetry is an equation, and "${item.answer}" is a bare value`);
          if (String(item.answer).slice(0, at).trim() !== v) throw new Error(`the axis names ${v}`);
          const canon = `${v} = ${texOf(vertexIn)}`;
          if (normalise(item.answer) !== normalise(canon)) {
            throw new Error(`the axis is "${canon}" but the answer says "${item.answer}"`);
          }
          break;
        }
        case 'extremeValue': {
          const want = fromString(item.answer);
          if (!want) throw new Error(`answer "${item.answer}" is not an exact value`);
          if (!reqq(vertexOut, want)) throw new Error(`the turning value is ${rstr(vertexOut)} but the answer says ${item.answer}`);
          break;
        }
        case 'extremeKind':
          requireVerdict(item, a.n < 0 ? 'MAX' : 'MIN', `the squared term has coefficient ${rstr(a)}`);
          break;
        case 'opening':
          requireVerdict(item, a.n < 0 ? 'DOWN' : 'UP', `the squared term has coefficient ${rstr(a)}`);
          break;
        case 'domain': {
          if (!acceptsEveryReal(node, v)) {
            throw new Error('this rule has a value it does not accept, so its domain is not every real number');
          }
          requireVerdict(item, 'ALLREAL', 'the rule divides by no letter and takes no root');
          break;
        }
        case 'range': {
          const outVar = c.outputVariable || 'y';
          if (outVar === v) throw new Error('a range is stated in the output letter, not the input letter');
          if (new RegExp(`(^|[^a-zA-Z])${v}([^a-zA-Z]|$)`).test(String(item.answer))) {
            throw new Error(`the range is stated in ${outVar}, and "${item.answer}" states it in ${v}`);
          }
          if (quadratic) {
            // RANGE IS PROVED BY IDENTITY. The rule is shown to be `a` times a
            // square plus the turning value, so the sign of `a` fixes the
            // boundary exactly and nothing about it is asserted.
            const built = `\\left(${texOf(a)}\\right)\\left(${v} - \\left(${texOf(vertexIn)}\\right)\\right)^{2} + \\left(${texOf(vertexOut)}\\right)`;
            if (!equivalent(built, c.math, v)) throw new Error('the completed square does not reproduce the printed rule');
            const canon = statementTex(outVar, a.n > 0 ? '\\ge' : '\\le', vertexOut);
            if (normalise(item.answer) !== normalise(canon)) {
              throw new Error(`the range is "${canon}" but the answer says "${item.answer}"`);
            }
          } else {
            if (!Array.isArray(c.interval) || c.interval.length !== 2) {
              throw new Error('a straight rule has a range only on a stated closed interval');
            }
            const lo = asR(c.interval[0]); const hi = asR(c.interval[1]);
            if (!lo || !hi || rcmp(lo, hi) >= 0) throw new Error('the stated interval is not a closed interval');
            for (const end of [lo, hi]) {
              if (!valueIsOnScreen(item, end)) throw new Error(`the interval end ${texOf(end)} is nowhere on screen`);
            }
            if (isZero(b)) throw new Error('a rule with no rate has one output, not a range');
            const f0 = evalAst(node, { [v]: lo });
            const f1 = evalAst(node, { [v]: hi });
            const band = rcmp(f0, f1) < 0
              ? { lower: { rel: '\\ge', value: f0 }, upper: { rel: '\\le', value: f1 } }
              : { lower: { rel: '\\ge', value: f1 }, upper: { rel: '\\le', value: f0 } };
            const canon = bandTex(outVar, band);
            if (normalise(item.answer) !== normalise(canon)) {
              throw new Error(`the range is "${canon}" but the answer says "${item.answer}"`);
            }
          }
          break;
        }
        default: throw new Error(`unknown feature ${c.want}`);
      }
      break;
    }

    /**
     * Is a printed set of pairs a function? A complete decision procedure, not
     * a sample: an input that appears twice with two different outputs is the
     * whole definition, and there is nothing else to check.
     */
    case 'relationPairs': {
      if (item.figure && item.figure.kind === 'curve') {
        throw new Error('the vertical-line test over a drawn arc is not attempted by this checker');
      }
      const pairs = readingsOf(item, c);
      if (pairs.length < 3) throw new Error('a relation item needs at least three pairs');
      const seen = new Map();
      let offender = null;
      for (const [x, y] of pairs) {
        const key = rstr(x);
        if (seen.has(key) && !reqq(seen.get(key), y)) { offender = x; break; }
        seen.set(key, y);
      }
      if (c.want === 'breakingInput') {
        if (!offender) throw new Error('every input appears once, so no input breaks this relation');
        const want = fromString(item.answer);
        if (!want) throw new Error(`answer "${item.answer}" is not an exact value`);
        if (!reqq(offender, want)) throw new Error(`the input that breaks it is ${rstr(offender)}, not ${item.answer}`);
      } else {
        requireVerdict(item, offender ? 'NO' : 'YES', offender
          ? `the input ${rstr(offender)} has two different outputs`
          : 'no input has two different outputs');
      }
      break;
    }

    /**
     * Sequences. `equivalent()` CANNOT be used here and the reason is exact:
     * it samples at half-integer values, and a letter in an exponent has no
     * value there. So this kind carries its own sampler, on whole numbers only.
     */
    case 'sequence': {
      const v = c.variable;
      if (c.form === 'recursive') {
        const rec = readRecursion(c.statements);
        for (const st of c.statements) {
          if (!targetIsThePrompt(item.latex, st)) throw new Error(`"${st}" is not what the prompt displays`);
        }
        const at = Number(c.at);
        const got = runRecursion(rec, at);
        const want = fromString(item.answer);
        if (!want) throw new Error(`answer "${item.answer}" is not an exact value`);
        if (!reqq(got, want)) throw new Error(`the recursion reaches ${rstr(got)} at position ${at}, not ${item.answer}`);
        break;
      }
      const rows = readingsOf(item, c);
      const rule = sequenceRule(rows);
      const last = toNum(rows[rows.length - 1][0]);
      if (c.form === 'term') {
        const at = Number(c.at);
        const got = rule.at(at);
        const want = fromString(item.answer);
        if (!want) throw new Error(`answer "${item.answer}" is not an exact value`);
        if (!reqq(got, want)) throw new Error(`this ${rule.kind} sequence reads ${rstr(got)} at position ${at}, not ${item.answer}`);
        break;
      }
      if (c.form !== 'explicit') throw new Error(`unknown sequence form ${c.form}`);
      refuseDecimal(item.answer);
      const claimed = parse(String(item.answer));
      const positions = [...rows.map((r) => toNum(r[0])), last + 1, last + 2, last + 3];
      for (const n of positions) {
        const got = atInteger(claimed, v, n);
        const want = rule.at(n);
        if (!reqq(got, want)) {
          throw new Error(`at position ${n} the answer gives ${rstr(got)} but this ${rule.kind} sequence reads ${rstr(want)}`);
        }
      }
      break;
    }

    /**
     * A line parallel or at right angles to a printed one, through a printed
     * point. The rate is derived here, the constant is derived here, and the
     * point is put back into the learner's own equation — so a rule with the
     * right rate and the wrong constant cannot pass.
     */
    case 'relatedLine': {
      const vx = c.vars?.[0] || 'x';
      const vy = c.vars?.[1] || 'y';
      const { a, b } = coeffs2(c.math, vx, vy);
      const [x0raw, y0raw] = c.point || [];
      const x0 = asR(x0raw); const y0 = asR(y0raw);
      if (!x0 || !y0) throw new Error('a related line needs a printed point to pass through');
      if (!pointIsOnScreen(item, toNum(x0), toNum(y0))) {
        throw new Error(`the point (${rstr(x0)}, ${rstr(y0)}) is nowhere on screen`);
      }
      let m = null;                       // null means the new line stands upright
      if (isZero(b)) {
        if (c.relation === 'parallel') m = null;
        else m = R(0);
      } else {
        const m0 = neg(div(a, b));
        if (c.relation === 'parallel') m = m0;
        else if (c.relation === 'perpendicular') {
          if (isZero(m0)) throw new Error('a line at right angles to a flat line stands upright, which this kind refuses');
          m = neg(div(R(1), m0));
        } else throw new Error(`unknown relation ${c.relation}`);
      }
      if (m === null) {
        if (c.want === 'slope') { requireVerdict(item, 'UNDEFINED', 'the new line stands upright'); break; }
        const canon = `${vx} = ${texOf(x0)}`;
        if (normalise(item.answer) !== normalise(canon)) {
          throw new Error(`the upright line is "${canon}" but the answer says "${item.answer}"`);
        }
        break;
      }
      const bNew = sub(y0, mul(m, x0));
      if (c.want === 'slope') {
        const want = fromString(item.answer);
        if (!want) throw new Error(`answer "${item.answer}" is not an exact value`);
        if (!reqq(m, want)) throw new Error(`the ${c.relation} rate is ${rstr(m)} but the answer says ${item.answer}`);
        break;
      }
      if (!String(item.answer).includes('=')) throw new Error('a rule has to be written as an equation');
      const form = lineFormOf(item.answer, vx, vy);
      if (c.form && form !== c.form) throw new Error(`this asks for ${c.form} and "${item.answer}" is written as ${form}`);
      const learner = coeffs2(String(item.answer), vx, vy);
      if (isZero(learner.b)) throw new Error(`"${item.answer}" draws an upright line, which has no rate`);
      if (!reqq(neg(div(learner.a, learner.b)), m)) {
        throw new Error(`the ${c.relation} rate is ${rstr(m)} but "${item.answer}" has rate ${rstr(neg(div(learner.a, learner.b)))}`);
      }
      if (!reqq(div(learner.c, learner.b), bNew)) {
        throw new Error(`the line through the point meets the upright axis at ${rstr(bNew)}, and "${item.answer}" meets it at ${rstr(div(learner.c, learner.b))}`);
      }
      // …and separately, the printed point must satisfy the learner's own rule.
      if (!reqq(add(mul(learner.a, x0), mul(learner.b, y0)), learner.c)) {
        throw new Error(`"${item.answer}" does not pass through (${rstr(x0)}, ${rstr(y0)})`);
      }
      break;
    }

    /**
     * An inequality in two unknowns, with no shaded region anywhere.
     *
     * The item prints readings ON the boundary, plus one reading off it, and
     * says of exactly two of them whether they belong to the region. Those two
     * statements pin the strictness and the side, so the inequality is unique.
     *
     * ONE STATEMENT, NOT FOUR GLYPHS. This used to read a private alphabet —
     * `+` in, `-` out, a filled circle included, an open circle excluded — that
     * the card never defined and the learner had to already know. Three of the
     * four options on a `iv-*` card differ ONLY in the relation those glyphs
     * decide, so a cadet who has not been told what they mean cannot answer at
     * all, and the source comment defending them said they "are the
     * convention", which is the definition of a card that teaches nothing.
     * A row now carries `\in R` or `\notin R` — one statement, about the one
     * thing that matters, in notation the stem itself introduces.
     *
     * WHICH OF THE TWO MARKED ROWS IS WHICH IS NOW GEOMETRY, not vocabulary,
     * and that is a strengthening rather than a cost: the boundary is fitted
     * through the readings that carry NO statement, and the marked row that
     * lands on it is the one that settles the strictness while the marked row
     * off it is the one that settles the side. A table whose unmarked readings
     * do not lie on one line, or where both marked readings sit off it, is
     * refused rather than guessed at.
     *
     * The four old glyphs are still read, and `tools/check-solver.mjs` still
     * plants them. They no longer appear in any shipped item; they are kept
     * because a checker that stops recognising notation it once accepted turns
     * a content change into a silent scoring change.
     */
    case 'halfPlane': {
      const vy = c.vars?.[1] || 'y';
      const cells = parseArrayCells(item.latex);
      const marked = []; const plain = [];
      for (const row of cells) {
        const nums = numericCells(row);
        if (nums.length !== 2) continue;
        let say = null;
        for (const cell of row) {
          const t = String(cell).replace(/\s+/g, '');
          if (t === '+' || t === '\\bullet' || t === '\\inR') { say = true; break; }
          if (t === '-' || t === '\\circ' || t === '\\notinR') { say = false; break; }
        }
        if (say === null) { plain.push(nums); continue; }
        marked.push({ at: nums, inside: say });
      }
      if (marked.length !== 2) {
        throw new Error('a half-plane item says of exactly two readings whether they are in the region');
      }
      const { m, b } = fitLineExactly(plain, 'the boundary readings');
      const offBy = (k) => sub(k.at[1], add(mul(m, k.at[0]), b));
      const onLine = marked.filter((k) => isZero(offBy(k)));
      const offLine = marked.filter((k) => !isZero(offBy(k)));
      if (onLine.length !== 1 || offLine.length !== 1) {
        throw new Error('the boundary readings do not all sit on one line');
      }
      const strict = !onLine[0].inside;
      const test = offLine[0];
      // The reading off the boundary sits above the line, or below it; whether
      // that side IS the region is the other half of what its statement says.
      const above = offBy(test).n > 0;
      const regionIsAbove = test.inside ? above : !above;
      const rel = regionIsAbove ? (strict ? '>' : '\\ge') : (strict ? '<' : '\\le');
      const canon = halfPlaneTex(vy, rel, m, b);
      if (normalise(item.answer) !== normalise(canon)) {
        throw new Error(`the readings give "${canon}" but the answer says "${item.answer}"`);
      }
      break;
    }

    /**
     * WRITING a pair of rules from two printed data sets. The existing
     * 'system' kind proves a SOLUTION; it cannot prove that a written pair
     * describes two tables. This one fits both tables exactly and matches the
     * learner's two rules against them in either order.
     */
    case 'systemWrite': {
      const vx = c.vars?.[0] || 'x';
      const vy = c.vars?.[1] || 'y';
      const blocks = parseArrayBlocks(item.latex);
      if (blocks.length !== 2) throw new Error('this item shows two tables of readings');
      const fits = blocks.map((cells, i) => {
        const pts = [];
        for (const row of cells) {
          const nums = numericCells(row);
          if (!nums.length) continue;
          if (nums.length !== 2) throw new Error('a table of readings needs exactly two numbers in each row');
          pts.push(nums);
        }
        return fitLineExactly(pts, `table ${i + 1}`);
      });
      if (reqq(fits[0].m, fits[1].m) && reqq(fits[0].b, fits[1].b)) {
        throw new Error('both tables fit the same line, so the pair meets nowhere in particular');
      }
      const written = splitTop(String(item.answer), ',').map((t) => t.trim()).filter(Boolean);
      if (written.length !== 2) throw new Error(`a pair is two rules, and the answer holds ${written.length}`);
      const got = written.map((e) => coeffs2(e, vx, vy));
      const det = sub(mul(got[0].a, got[1].b), mul(got[1].a, got[0].b));
      if (isZero(det)) throw new Error('the two written rules do not meet at one point');
      const matches = (co, fit) => {
        if (isZero(co.b)) return false;
        return reqq(neg(div(co.a, co.b)), fit.m) && reqq(div(co.c, co.b), fit.b);
      };
      const straight = matches(got[0], fits[0]) && matches(got[1], fits[1]);
      const swapped = matches(got[0], fits[1]) && matches(got[1], fits[0]);
      if (!straight && !swapped) {
        throw new Error(`the tables fit ${vy} = ${texLine(fits[0].m, fits[0].b)} and ${vy} = ${texLine(fits[1].m, fits[1].b)}, which "${item.answer}" does not`);
      }
      for (let i = 0; i < 2; i++) {
        const fit = straight ? fits[i] : fits[1 - i];
        const rhs = String(written[i]).split('=').slice(1).join('=').trim();
        if (rhs && !mentionsVar(parse(rhs), vy) && !equivalent(rhs, texLine(fit.m, fit.b), vx)) {
          throw new Error(`"${written[i]}" is not the line its table fits`);
        }
      }
      break;
    }

    /**
     * Exact least squares, from the readings the learner is shown. Not an
     * interpolation through three chosen points: the normal equations are
     * solved by Cramer's rule in exact rationals.
     */
    case 'regression': {
      const pts = readingsOf(item, c);
      const quad = c.model === 'quadratic';
      const need = quad ? 5 : 4;
      if (pts.length < need) throw new Error(`a ${c.model || 'linear'} fit needs at least ${need} readings, and this shows ${pts.length}`);
      refuseDecimal(item.answer);
      let fitted;                        // (x) -> exact output
      let named;                         // the named coefficients
      if (quad) {
        const S = (k) => pts.reduce((acc, [x]) => add(acc, rpow(x, k)), R(0));
        const T = (k) => pts.reduce((acc, [x, y]) => add(acc, mul(rpow(x, k), y)), R(0));
        const M = [
          [S(4), S(3), S(2)],
          [S(3), S(2), S(1)],
          [S(2), S(1), R(pts.length)],
        ];
        const sol = cramer3(M, [T(2), T(1), T(0)]);
        if (!sol) throw new Error('these readings give a singular normal-equation determinant');
        const [qa, qb, qc] = sol;
        named = { a: qa, b: qb, c: qc };
        fitted = (x) => add(add(mul(qa, mul(x, x)), mul(qb, x)), qc);
      } else {
        const { xbar, ybar, sxx, sxy } = fitSums(pts);
        if (isZero(sxx)) throw new Error('every reading shares one input, so no rate can be fitted');
        const m = div(sxy, sxx);
        const b = sub(ybar, mul(m, xbar));
        named = { slope: m, intercept: b, m, b };
        fitted = (x) => add(mul(m, x), b);
      }
      const want = fromString(item.answer);
      if (!want) throw new Error(`answer "${item.answer}" is not an exact value`);
      let got;
      if (c.want === 'predict') {
        const at = asR(c.at);
        if (!at) throw new Error('a prediction needs an input to make it at');
        got = fitted(at);
      } else if (c.want === 'residual') {
        const at = asR(c.at);
        if (!at) throw new Error('a residual needs a reading to take it at');
        const seen = pts.find(([x]) => reqq(x, at));
        if (!seen) throw new Error(`no reading at ${rstr(at)} is on screen`);
        got = sub(seen[1], fitted(at));   // observed minus fitted: the sign is part of the answer
      } else {
        got = named[c.want];
        if (!got) throw new Error(`unknown regression ask ${c.want}`);
      }
      if (!isSafe(got)) throw new Error('this fit has grown too large to hold exactly');
      if (!reqq(got, want)) throw new Error(`the exact fit gives ${rstr(got)} but the answer says ${item.answer}`);
      break;
    }

    /**
     * Association strength. THE CHECKER NEVER COMPUTES r: it is a square root
     * and is irrational for almost every data set. It computes r SQUARED and
     * the SIGN of r, both exactly, and those two settle every question asked.
     */
    case 'correlation': {
      const pts = readingsOf(item, c);
      if (pts.length < 5) throw new Error(`a correlation item needs at least five readings, and this shows ${pts.length}`);
      const { sxx, sxy, syy } = fitSums(pts);
      if (isZero(sxx) || isZero(syy)) throw new Error('one of the two readings never varies, so there is no association to measure');
      const r2 = div(mul(sxy, sxy), mul(sxx, syy));
      const sgn = rsign(sxy);
      if (c.want === 'direction') {
        requireVerdict(item, sgn > 0 ? 'POSITIVE' : sgn < 0 ? 'NEGATIVE' : 'NONE',
          `the readings vary together with sign ${sgn}`);
        break;
      }
      if (c.want === 'strength') {
        const thr = asR(c.threshold);
        const guard = asR(c.guard ?? R(1, 100));
        if (!thr) throw new Error('a strength verdict needs a threshold stated in the item');
        const gap = sub(r2, thr);
        if (rcmp(gap.n < 0 ? neg(gap) : gap, guard) < 0) {
          throw new Error(`r squared is ${rstr(r2)}, too close to the threshold ${rstr(thr)} for a safe verdict`);
        }
        requireVerdict(item, rcmp(r2, thr) >= 0 ? 'STRONG' : 'WEAK', `r squared is ${rstr(r2)}`);
        break;
      }
      if (c.want === 'value') {
        // The item prints a rounded r, as a calculator would. The checker
        // proves the rounding by squaring the bounds — it still never takes a
        // square root, and it still never compares decimals.
        const read = readDecimal(item.answer);
        if (!read) throw new Error(`"${item.answer}" is not a rounded value this checker can read`);
        if (rsign(read.value) !== sgn) {
          throw new Error(`the readings vary with sign ${sgn} and "${item.answer}" claims the other one`);
        }
        const half = R(5, 10 ** (read.places + 1));
        const mag = read.value.n < 0 ? neg(read.value) : read.value;
        const lo = rcmp(sub(mag, half), R(0)) < 0 ? R(0) : sub(mag, half);
        const hi = add(mag, half);
        if (rcmp(mul(lo, lo), r2) > 0 || rcmp(r2, mul(hi, hi)) >= 0) {
          throw new Error(`r squared is ${rstr(r2)}, which does not round to ${item.answer} at ${read.places} places`);
        }
        break;
      }
      throw new Error(`unknown correlation ask ${c.want}`);
    }

    /**
     * A two-way frequency table. The table is checked against itself first —
     * every printed total must agree with its own cells — and only then is the
     * asked frequency re-derived.
     */
    case 'twoWayTable': {
      const grid = [];
      for (const row of parseArrayCells(item.latex)) {
        const nums = numericCells(row);
        if (nums.length) grid.push(nums);
      }
      if (grid.length < 2) throw new Error('a two-way table needs at least two rows of numbers');
      const width = grid[0].length;
      if (!grid.every((row) => row.length === width)) throw new Error('the table is not rectangular');
      if (width < 2) throw new Error('a two-way table needs at least two columns of numbers');
      const bodyRows = grid.length - 1;
      const bodyCols = width - 1;
      if (bodyRows < 1 || bodyCols < 1) throw new Error('a two-way table needs a body inside its totals');
      // Consistency: the printed totals must be the sums of the printed cells.
      for (let i = 0; i < bodyRows; i++) {
        let acc = R(0);
        for (let j = 0; j < bodyCols; j++) acc = add(acc, grid[i][j]);
        if (!reqq(acc, grid[i][bodyCols])) throw new Error(`row ${i + 1} adds to ${rstr(acc)} but its total says ${rstr(grid[i][bodyCols])}`);
      }
      for (let j = 0; j <= bodyCols; j++) {
        let acc = R(0);
        for (let i = 0; i < bodyRows; i++) acc = add(acc, grid[i][j]);
        if (!reqq(acc, grid[bodyRows][j])) throw new Error(`column ${j + 1} adds to ${rstr(acc)} but its total says ${rstr(grid[bodyRows][j])}`);
      }
      const grand = grid[bodyRows][bodyCols];
      if (isZero(grand)) throw new Error('a table with no readings in it has no frequencies');
      const ri = Number(c.row); const ci = Number(c.col);
      const rowOk = Number.isInteger(ri) && ri >= 0 && ri < bodyRows;
      const colOk = Number.isInteger(ci) && ci >= 0 && ci < bodyCols;
      const needRow = ['joint', 'marginalRow', 'conditionalRow', 'conditionalCol'].includes(c.want);
      const needCol = ['joint', 'marginalCol', 'conditionalRow', 'conditionalCol'].includes(c.want);
      if (needRow && !rowOk) throw new Error(`row ${c.row} is outside this table`);
      if (needCol && !colOk) throw new Error(`column ${c.col} is outside this table`);
      const cell = () => grid[ri][ci];
      let num; let den;
      switch (c.want) {
        case 'joint': num = cell(); den = grand; break;
        case 'marginalRow': num = grid[ri][bodyCols]; den = grand; break;
        case 'marginalCol': num = grid[bodyRows][ci]; den = grand; break;
        case 'conditionalRow': num = cell(); den = grid[ri][bodyCols]; break;
        case 'conditionalCol': num = cell(); den = grid[bodyRows][ci]; break;
        case 'conditional': throw new Error('a conditional frequency must name which way it conditions');
        default: throw new Error(`unknown frequency ${c.want}`);
      }
      if (num == null || den == null) throw new Error('the named row or column is outside the table');
      if (isZero(den)) throw new Error('this frequency divides by zero');
      const got = div(num, den);
      refuseDecimal(item.answer);
      const want = fromString(item.answer);
      if (!want) throw new Error(`answer "${item.answer}" is not an exact value`);
      const asPercent = c.asPercent ? mul(got, R(100)) : null;
      if (asPercent && asPercent.d !== 1) throw new Error('this frequency is not an exact percentage');
      if (!reqq(asPercent || got, want)) {
        throw new Error(`the table gives ${rstr(asPercent || got)} but the answer says ${item.answer}`);
      }
      break;
    }

    /**
     * Exponential rules. `equivalent()` cannot check a letter in an exponent —
     * it samples at half-integers and there is no value there — so this kind
     * samples on WHOLE numbers only, which for a fixed rational base is a
     * proof over the inputs the item actually uses.
     */
    case 'exponentialFit': {
      const v = c.variable;
      if (c.form === 'overtake') {
        const [ruleA, ruleB] = c.rules || [];
        if (!ruleA || !ruleB) throw new Error('an overtaking item shows two rules');
        for (const src of [ruleA, ruleB]) {
          if (!targetIsThePrompt(item.latex, src)) throw new Error(`"${src}" is not what the prompt displays`);
        }
        const A = parse(ruleA); const B = parse(ruleB);
        const [lo, hi] = (c.range || []).map(Number);
        if (!Number.isInteger(lo) || !Number.isInteger(hi) || hi <= lo) throw new Error('an overtaking item needs a whole range');
        let first = null;
        for (let n = lo; n <= hi && first === null; n++) {
          if (rcmp(atInteger(A, v, n), atInteger(B, v, n)) > 0) first = n;
        }
        if (first === null) throw new Error('the first rule never passes the second inside the printed range');
        const want = fromString(item.answer);
        if (!want || !reqq(R(first), want)) throw new Error(`the first rule passes the second at ${first}, not at ${item.answer}`);
        break;
      }
      if (c.form === 'rewrite') {
        const [ruleA, ruleB] = [c.math, String(item.answer)];
        const A = parse(ruleA); const B = parse(ruleB);
        for (let n = 0; n < 12; n++) {
          const x = atInteger(A, v, n);
          const y = atInteger(B, v, n);
          if (!reqq(x, y)) throw new Error(`at ${v} = ${n} the prompt reads ${rstr(x)} and "${item.answer}" reads ${rstr(y)}`);
        }
        break;
      }
      const pts = readingsOf(item, c);
      if (pts.length < 3) throw new Error('an exponential item needs at least three readings');
      for (const [x] of pts) if (x.d !== 1) throw new Error('an exponential rule is sampled at whole inputs only');
      if (pts.some(([, y]) => isZero(y))) throw new Error('a reading of zero cannot be part of an exponential rule');
      const ratio = div(pts[1][1], pts[0][1]);
      if (isZero(ratio) || reqq(ratio, R(1)) || ratio.n < 0) throw new Error('a ratio of zero, one or below zero is not exponential growth');
      for (let i = 1; i < pts.length; i++) {
        if (!reqq(sub(pts[i][0], pts[i - 1][0]), R(1))) throw new Error('the printed inputs are not consecutive');
        if (!reqq(div(pts[i][1], pts[i - 1][1]), ratio)) throw new Error('the printed readings do not share one ratio');
      }
      const start = div(pts[0][1], rpow(ratio, pts[0][0].n));    // the value at input zero
      refuseDecimal(item.answer);
      if (c.form === 'fit') {
        const claimed = parse(String(item.answer));
        for (const [x, y] of pts) {
          const got = atInteger(claimed, v, x.n);
          if (!reqq(got, y)) throw new Error(`at ${v} = ${rstr(x)} the answer gives ${rstr(got)} but the table reads ${rstr(y)}`);
        }
        break;
      }
      const want = fromString(item.answer);
      if (!want) throw new Error(`answer "${item.answer}" is not an exact value`);
      const got = c.form === 'start' ? start
        : c.form === 'factor' ? ratio
          : c.form === 'percent' ? mul(sub(ratio, R(1)), R(100))
            : null;
      if (!got) throw new Error(`unknown exponential form ${c.form}`);
      if (!reqq(got, want)) throw new Error(`the readings give ${rstr(got)} but the answer says ${item.answer}`);
      break;
    }

    case 'literal':
      break;
    default:
      throw new Error(`unknown verification kind ${c.kind}`);
  }
  return true;
}

// ---------------------------------------------------------------------------
// Level 2 re-derivation machinery.
//
// Nothing below trusts a generator. Each routine reads a LaTeX string, parses
// it with `./parser.js`, and works the answer out in exact rational arithmetic.
// ---------------------------------------------------------------------------

/** `\le` and `\ge` must not be read out of `\left` and `\gets`. */
const REL_RE = /\\le(?![a-zA-Z])|\\ge(?![a-zA-Z])|<|>/g;
const FLIP = { '<': '>', '>': '<', '\\le': '\\ge', '\\ge': '\\le' };
const OPEN_REL = { '<': true, '>': true, '\\le': false, '\\ge': false };

/** "a < b \le c" -> { parts: [a, b, c], rels: ['<', '\\le'] }. */
function splitRel(src) {
  const parts = [];
  const rels = [];
  let last = 0;
  let m;
  REL_RE.lastIndex = 0;
  while ((m = REL_RE.exec(String(src)))) {
    rels.push(m[0]);
    parts.push(String(src).slice(last, m.index));
    last = m.index + m[0].length;
  }
  parts.push(String(src).slice(last));
  return { parts, rels };
}

/**
 * Solve one linear inequality. Returns the relation the UNKNOWN carries, which
 * is the relation on the page turned round whenever the coefficient is
 * negative — the single move this whole family of skills exists to teach.
 */
function solveInequality(src, v) {
  const { parts, rels } = splitRel(src);
  if (rels.length !== 1) throw new Error('not a single inequality');
  const L = linearize(parse(parts[0]), v);
  const Rt = linearize(parse(parts[1]), v);
  const a = sub(L.a, Rt.a);
  const b = sub(L.b, Rt.b);
  if (isZero(a)) throw new Error(`the unknown cancels: this says nothing about ${v}`);
  return { rel: a.n < 0 ? FLIP[rels[0]] : rels[0], value: div(neg(b), a) };
}

/** "x > 5", "x \le -3". The one spelling every option in the set uses. */
function statementTex(v, rel, value) { return `${v} ${rel} ${texOf(value)}`; }

/** The first whole number on the allowed side of a boundary. */
function edgeInteger({ rel, value }, want) {
  const x = toNum(value);
  const open = OPEN_REL[rel];
  if (want === 'least') {
    if (rel !== '>' && rel !== '\\ge') throw new Error('this inequality has no least whole number');
    return R(open ? Math.floor(x) + 1 : Math.ceil(x));
  }
  if (rel !== '<' && rel !== '\\le') throw new Error('this inequality has no greatest whole number');
  return R(open ? Math.ceil(x) - 1 : Math.floor(x));
}

/** "-4 < 2x + 6 \le 10" -> the band the unknown lives in. */
function solveCompound(src, v) {
  const { parts, rels } = splitRel(src);
  if (rels.length !== 2) throw new Error('not a compound inequality');
  const a = solveInequality(`${parts[0]}${rels[0]}${parts[1]}`, v);
  const b = solveInequality(`${parts[1]}${rels[1]}${parts[2]}`, v);
  const lower = a.rel === '>' || a.rel === '\\ge' ? a : b;
  const upper = a.rel === '<' || a.rel === '\\le' ? a : b;
  if (lower === upper) throw new Error('both ends of the band point the same way');
  if (toNum(lower.value) >= toNum(upper.value)) throw new Error('the band is empty');
  return { lower, upper };
}

/** "-5 < x \le 2" — the band written the way it is read, left to right. */
function bandTex(v, { lower, upper }) {
  return `${texOf(lower.value)} ${FLIP[lower.rel]} ${v} ${upper.rel} ${texOf(upper.value)}`;
}

/**
 * Solve a formula for one of its letters, with every other letter pinned to a
 * number. The equation is probed at three values rather than rearranged, so a
 * generator cannot get credit for an algebraic move the checker also made.
 */
function isolate(eqSrc, v, env) {
  const { left, right } = parseEquation(eqSrc);
  const f = (t) => sub(evalAst(left, { ...env, [v]: t }), evalAst(right, { ...env, [v]: t }));
  const f0 = f(R(0));
  const a = sub(f(R(1)), f0);
  if (isZero(a)) throw new Error(`not linear in ${v}`);
  if (!reqq(f(R(2)), add(f0, mul(a, R(2))))) throw new Error(`not linear in ${v}`);
  return div(neg(f0), a);
}

/** Values the other letters take while a rearrangement is checked. */
const SAMPLE_SETS = [
  [2, 3, 5, 7], [11, 4, 3, 13], [-3, 5, 2, 9], [6, -7, 11, 4],
  [13, 2, 7, 3], [4, 9, 13, 5], [-5, 3, 4, 11], [7, 11, 2, 6],
];

/** Cross-multiply a proportion and solve, wherever the unknown happens to sit. */
function solveProportion(src, v) {
  const { left, right } = parseEquation(src);
  if (left.k !== 'div' || right.k !== 'div') throw new Error('a proportion is two fractions');
  const g = (t) => sub(
    mul(evalAst(left.a, { [v]: t }), evalAst(right.b, { [v]: t })),
    mul(evalAst(left.b, { [v]: t }), evalAst(right.a, { [v]: t })),
  );
  const g0 = g(R(0));
  const a = sub(g(R(1)), g0);
  if (isZero(a)) throw new Error(`the unknown cancels: this says nothing about ${v}`);
  if (!reqq(g(R(2)), add(g0, mul(a, R(2))))) throw new Error('not a linear proportion');
  const value = div(neg(g0), a);
  for (const den of [left.b, right.b]) {
    if (isZero(evalAst(den, { [v]: value }))) throw new Error('the answer empties a denominator');
  }
  return value;
}

/** a·x + b·y = c, read off an equation by probing it. Exact, never rearranged. */
function coeffs2(eqSrc, vx, vy) {
  const { left, right } = parseEquation(eqSrc);
  const F = (x, y) => sub(evalAst(left, { [vx]: x, [vy]: y }), evalAst(right, { [vx]: x, [vy]: y }));
  const f00 = F(R(0), R(0));
  const a = sub(F(R(1), R(0)), f00);
  const b = sub(F(R(0), R(1)), f00);
  const probe = add(f00, add(mul(a, R(2)), mul(b, R(3))));
  if (!reqq(F(R(2), R(3)), probe)) throw new Error('a statement in the pair is not linear');
  return { a, b, c: neg(f00) };
}

/** Solve a pair of linear statements in two unknowns. */
function solveSystem(eqs, vars) {
  if (eqs.length !== 2 || vars.length !== 2) throw new Error('a system here is two statements in two unknowns');
  const [vx, vy] = vars;
  const [p, q] = eqs.map((e) => coeffs2(e, vx, vy));
  const det = sub(mul(p.a, q.b), mul(q.a, p.b));
  if (isZero(det)) throw new Error('the pair does not meet at one point');
  return {
    [vx]: div(sub(mul(p.c, q.b), mul(q.c, p.b)), det),
    [vy]: div(sub(mul(p.a, q.c), mul(q.a, p.c)), det),
  };
}

/** "2x + 3" for a line, so a written rule can be compared with the real one. */
function texLine(m, b) {
  const mt = m.d === 1 ? co(m.n, 'x') : `\\frac{${m.n}}{${m.d}}x`;
  if (isZero(m)) return texOf(b);
  if (isZero(b)) return mt;
  return `${mt} ${b.n < 0 ? '-' : '+'} ${texOf(b.n < 0 ? neg(b) : b)}`;
}

/**
 * Is the reading the checker used really printed somewhere the learner can see
 * it? A rule derived from numbers that are not on the page is a rule about a
 * different question.
 */
function pointIsOnScreen(item, x, y) {
  const fig = item.figure;
  // A DRAWN CURVE. `rift.js` samples `a x^{2} + b x + c` across `range` and
  // emits one polyline, so the readings on screen are exactly the readings the
  // rule produces inside that range — no more and no fewer. This branch
  // therefore ANSWERS rather than falls through: if it fell through, a reading
  // printed in the prose but nowhere on the drawing would still pass, and the
  // whole point of the guard is that the checker cannot certify a reading the
  // drawing does not contain.
  if (fig && fig.kind === 'curve') {
    const lo = Number(fig.range?.[0]);
    const hi = Number(fig.range?.[1]);
    if (!Number.isFinite(lo) || !Number.isFinite(hi)) return false;
    if (x < Math.min(lo, hi) || x > Math.max(lo, hi)) return false;
    const A = asR(fig.a); const B = asR(fig.b); const C = asR(fig.c);
    if (!A || !B || !C) return false;
    const X = asR(x); const Y = asR(y);
    if (!X || !Y) return false;
    return reqq(add(add(mul(A, mul(X, X)), mul(B, X)), C), Y);
  }
  if (fig && Array.isArray(fig.points) && fig.points.some((p) => p[0] === x && p[1] === y)) return true;
  const hay = normalise(`${item.latex} ${item.stem || ''}`);
  if (hay.includes(normalise(`\\left(${x},${y}\\right)`))) return true;
  try {
    const cells = parseArrayCells(item.latex);
    for (const row of cells.slice(1)) {
      if (row.length >= 2 && Number(row[0]) === x && Number(row[1]) === y) return true;
    }
  } catch { /* no table on screen */ }
  return false;
}

// ---------------------------------------------------------------------------
// LEVEL 3 re-derivation machinery — the quadratics strand and what it needs.
//
// Same commitment as everything above it: nothing here takes a number from a
// generator. Each routine reads the LaTeX the learner is SHOWN, parses it, and
// works the answer out again in exact rational arithmetic — widened to exact
// arithmetic in Q(sqrt k) where, and only where, the mathematics is genuinely
// irrational. No decimal ever decides anything.
// ---------------------------------------------------------------------------

/** Anything number-shaped, as an exact rational. Null when it is not. */
function asR(x) {
  if (x == null) return null;
  if (typeof x === 'object' && typeof x.n === 'number' && typeof x.d === 'number') return x;
  if (typeof x === 'number' && Number.isFinite(x)) { try { return R(x); } catch { return null; } }
  if (typeof x === 'string') { try { return evaluate(x); } catch { return fromString(x); } }
  return null;
}

/** Every value here must be exact. A decimal is a rounded value wearing a mask. */
function refuseDecimal(src, what = 'the answer') {
  if (/\d\s*\.\s*\d/.test(String(src))) {
    throw new Error(`${what} "${src}" is a decimal, and only exact values are accepted`);
  }
}

/**
 * A written radical must be in the form the strand teaches: every radicand a
 * whole number, every radicand squarefree, and no radical left downstairs.
 */
function refuseBadRadical(src, what = 'the answer') {
  const node = parse(String(src));
  if (radicalInDenominator(node)) throw new Error(`${what} "${src}" leaves a radical in a denominator`);
  for (const n of radicandsOf(node)) {
    if (n === null) throw new Error(`${what} "${src}" has a radicand that is not a whole number`);
    if (n < 0) throw new Error(`${what} "${src}" has a radicand below zero`);
    const { m } = simplifySqrt(n);
    if (m !== 1) throw new Error(`${what} "${src}" leaves \\sqrt{${n}}, which is not in lowest terms`);
  }
  return node;
}

/** The exact values a written answer names, smallest first, after the refusals. */
function exactValues(src, v = null, what = 'the answer') {
  refuseDecimal(src, what);
  for (const part of splitTop(String(src), ',')) {
    const body = part.includes('=') ? part.slice(part.indexOf('=') + 1) : part;
    if (body.trim()) refuseBadRadical(body.trim(), what);
  }
  return answerValues(src, v);
}

/** One exact value, or a complaint that the answer names more than one. */
function exactValue(src, v = null, what = 'the answer') {
  const all = exactValues(src, v, what);
  if (all.length !== 1) throw new Error(`${what} "${src}" names ${all.length} values, not one`);
  return all[0];
}

/**
 * Is this how the checker would have spelt that value?
 *
 * The set is CLOSED and small: the split spelling, the over-one-denominator
 * spelling the quadratic formula produces, and for a matched pair the `\pm`
 * spelling. Anything else is thrown out WITH THE ITEM, before a learner sees
 * it, which is the safe direction — a rejected item is simply re-drawn.
 */
function spellingOk(part, values) {
  const body = part.includes('=') ? part.slice(part.indexOf('=') + 1) : part;
  const want = normalise(body);
  if (values.length === 1) return surdSpellings(values[0]).some((sp) => normalise(sp) === want);
  if (values.length !== 2) return false;
  const [lo, hi] = values;
  if (lo.k !== hi.k || !reqq(lo.p, hi.p) || !reqq(lo.q, neg(hi.q))) return false;
  const rad = sTex(S(R(0), hi.q, hi.k));
  const cands = [`${texOf(hi.p)} \\pm ${rad}`];
  const over = sTexOverOne(hi);
  const m = /^\\frac\{(.*?)\s*\+\s*(.*)\}\{(\d+)\}$/.exec(over);
  if (m) cands.push(`\\frac{${m[1]} \\pm ${m[2]}}{${m[3]}}`);
  if (isZero(hi.p)) cands.push(`\\pm ${rad}`);
  return cands.some((sp) => normalise(sp) === want);
}

/** The one spelling this checker prints when it has to name a value itself. */
function valueTex(x) { return isSurd(x) ? sTex(x) : texOf(x); }

/** Every root, as a value of Q(sqrt k), whatever the solver handed back. */
function rootsOf(sol) { return (sol.roots || []).map((r) => (isSurd(r) ? r : SR(r))); }

/** `x = -1, x = 4` — the increasing-order spelling a root set is printed in. */
function rootSetTex(v, roots) { return roots.map((r) => `${v} = ${valueTex(r)}`).join(', '); }

/**
 * Prove a claimed root set against the equation it came from.
 *
 * Three separate things are required, and the SUBSTITUTION is the proof:
 * the claimed values must be the solver's values, they must be printed
 * smallest first, and each of them must make `a x^{2} + b x + c` exactly zero.
 * A root that is out by one fails the third test whatever the first two say.
 */
function proveRootSet(item, c, sol, v) {
  const roots = rootsOf(sol);
  const claimedParts = splitTop(String(item.answer), ',').map((t) => t.trim()).filter(Boolean);
  const claimed = exactValues(item.answer, v);
  if (claimed.length !== roots.length) {
    throw new Error(`this equation has ${roots.length} solution(s) but the answer names ${claimed.length}`);
  }
  for (let i = 0; i < roots.length; i++) {
    if (!sEq(claimed[i], roots[i])) {
      throw new Error(`the solutions are ${rootSetTex(v, roots)} but the answer says "${item.answer}"`);
    }
  }
  // Printed order. The values above are sorted; these are as they were written.
  const written = [];
  for (const part of claimedParts) for (const val of exactValues(part, v)) written.push(val);
  for (let i = 1; i < written.length; i++) {
    if (sCmp(written[i - 1], written[i]) > 0) {
      throw new Error(`the answer "${item.answer}" prints its solutions out of order; smallest first is ${rootSetTex(v, roots)}`);
    }
  }
  if (c.spelling !== 'any') {
    for (const part of claimedParts) {
      const vals = exactValues(part, v);
      if (!spellingOk(part, vals)) {
        throw new Error(`"${part.trim()}" is not the spelling this checker uses; it writes ${rootSetTex(v, roots)}`);
      }
    }
  }
  // THE PROOF. Every claimed value goes back into the printed equation.
  for (const r of claimed) {
    const out = sAdd(sAdd(sMul(SR(sol.a), sPow(r, 2)), sMul(SR(sol.b), r)), SR(sol.c));
    if (!sIsZero(out)) throw new Error(`putting ${sTex(r)} back into the equation leaves ${sTex(out)}, not zero`);
  }
  return roots;
}

/** `\left(3, -4\right)` — a written pair, as two exact values. Null when it is not one. */
function exactPair(src) {
  const t = String(src).trim().replace(/^\\left\(/, '(').replace(/\\right\)$/, ')');
  if (!t.startsWith('(') || !t.endsWith(')')) return null;
  const parts = splitTop(t.slice(1, -1), ',');
  if (parts.length !== 2) return null;
  try { return parts.map((piece) => evaluate(piece.trim())); } catch { return null; }
}

/**
 * The factors of a written product. A squared bracket counts as its base
 * twice, which is what makes `(x + 3)^{2}` a product of two linear factors
 * rather than one opaque node.
 */
function flattenProduct(node) {
  if (node.k === 'mul') return [...flattenProduct(node.a), ...flattenProduct(node.b)];
  if (node.k === 'neg') return [{ k: 'num', v: -1 }, ...flattenProduct(node.a)];
  if (node.k === 'pow') {
    let e;
    try { e = evalAst(node.b, {}); } catch { return [node]; }
    if (e.d === 1 && e.n >= 1 && e.n <= 4) {
      const out = [];
      for (let i = 0; i < e.n; i++) out.push(...flattenProduct(node.a));
      return out;
    }
  }
  return [node];
}

/**
 * Is this written as `a(v + h)^{2} + k`?
 *
 * The standard form is IDENTICALLY EQUAL to the vertex form, so the identity
 * check alone would credit a learner who changed nothing. This is the half
 * that will not.
 */
function vertexShape(node, v) {
  const isConst = (n) => !mentionsVar(n, v);
  let core = node;
  let sign = 1;
  if (core.k === 'add' || core.k === 'sub') {
    if (isConst(core.b)) core = core.a;
    else if (isConst(core.a) && core.k === 'add') core = core.b;
    else throw new Error('vertex form adds one constant to one squared bracket');
  }
  while (core.k === 'neg') { core = core.a; sign = -sign; }
  if (core.k === 'mul') {
    if (isConst(core.a)) core = core.b;
    else if (isConst(core.b)) core = core.a;
    else throw new Error('vertex form multiplies the squared bracket by one constant');
  }
  while (core.k === 'neg') { core = core.a; sign = -sign; }
  if (core.k === 'div') {
    if (!isConst(core.b)) throw new Error('vertex form does not divide by the letter');
    core = core.a;
  }
  while (core.k === 'neg') { core = core.a; sign = -sign; }
  if (core.k !== 'pow') throw new Error('vertex form needs one squared bracket');
  const e = evalAst(core.b, {});
  if (e.d !== 1 || e.n !== 2) throw new Error('the bracket in vertex form is squared');
  const lin = linearize(core.a, v);
  if (isZero(lin.a)) throw new Error(`the squared bracket does not use ${v}`);
  return { sign, base: core.a };
}

/** A verdict answer is a token, not a word: the word is localised, the token is not. */
function verdictOf(item) { return String(item.answerKind ?? item.answer).trim().toUpperCase(); }
function requireVerdict(item, want, why) {
  const got = verdictOf(item);
  if (got !== want) throw new Error(`${why}, so the answer should be ${want} and it says ${got}`);
}

/** Coefficients of a printed RULE, read twice and confirmed, exactly as the equation route is. */
function ruleCoeffs(src, v) {
  const node = parse(src);
  const cs = polynomialise(node, v, 2);
  const a = cs[2] || R(0); const b = cs[1] || R(0); const k = cs[0] || R(0);
  const f = (t) => evalAst(node, { [v]: t });
  if (!reqq(f(R(0)), k)) throw new Error('the rule does not read back at zero');
  for (const t of [1, -1, 2, 3]) {
    const want = add(add(mul(a, R(t * t)), mul(b, R(t))), k);
    if (!reqq(f(R(t)), want)) throw new Error('a higher power is hiding in the notation');
  }
  return { a, b, c: k, node, degree: polyDegree(cs) };
}

/** Does the rule accept every real number? Decided by STRUCTURE, never by sampling. */
function acceptsEveryReal(node, v) {
  let ok = true;
  walkAst(node, (n) => {
    if (n.k === 'sqrt') ok = false;
    if (n.k === 'div' && mentionsVar(n.b, v)) ok = false;
  });
  return ok;
}

/** Is this exact value printed anywhere the learner can read it? */
function valueIsOnScreen(item, r) {
  const hay = normalise(`${item.latex || ''} ${item.stem || ''}`);
  for (const sp of [texOf(r), rstr(r), String(toNum(r))]) if (hay.includes(normalise(sp))) return true;
  return false;
}

/** Only cells that are exact numbers. A header of letters contributes none. */
function numericCells(row) {
  const out = [];
  for (const cell of row) {
    let r;
    try { r = evaluate(cell); } catch { continue; }
    out.push(r);
  }
  return out;
}

/**
 * The readings this item SHOWS — off the plotted points, or off the printed
 * table. Never off a data array a generator kept to one side.
 */
function readingsOf(item, c) {
  if (Array.isArray(item.figure?.points) && item.figure.points.length) {
    return item.figure.points.map((p) => [R(p[0]), R(p[1])]);
  }
  const cells = parseArrayCells(item.latex);
  if (c.layout === 'rows') {
    const rows = cells.map(numericCells).filter((r) => r.length);
    if (rows.length !== 2) throw new Error('a table laid out in rows needs exactly two rows of numbers');
    if (rows[0].length !== rows[1].length) throw new Error('the two rows of the table are different lengths');
    return rows[0].map((x, i) => [x, rows[1][i]]);
  }
  const out = [];
  for (const row of cells) {
    const nums = numericCells(row);
    if (!nums.length) continue;
    if (nums.length !== 2) throw new Error('a table of readings needs exactly two numbers in each row');
    out.push(nums);
  }
  return out;
}

/** The exact line through a set of readings, refusing a set that is not on one. */
function fitLineExactly(pts, why = 'the readings') {
  if (pts.length < 2) throw new Error(`${why} are too few to fix a line`);
  const [x1, y1] = pts[0];
  let second = -1;
  for (let i = 1; i < pts.length; i++) if (!reqq(pts[i][0], x1)) { second = i; break; }
  if (second < 0) throw new Error(`${why} all share one input, which draws an upright line`);
  const [x2, y2] = pts[second];
  const m = div(sub(y2, y1), sub(x2, x1));
  const b = sub(y1, mul(m, x1));
  for (const [x, y] of pts) {
    if (!reqq(add(mul(m, x), b), y)) throw new Error(`${why} do not all sit on one line`);
  }
  return { m, b };
}

/** The sums an exact least-squares fit is built from. */
function fitSums(pts) {
  const n = R(pts.length);
  let sx = R(0); let sy = R(0);
  for (const [x, y] of pts) { sx = add(sx, x); sy = add(sy, y); }
  const xbar = div(sx, n); const ybar = div(sy, n);
  let sxx = R(0); let sxy = R(0); let syy = R(0);
  for (const [x, y] of pts) {
    const dx = sub(x, xbar); const dy = sub(y, ybar);
    sxx = add(sxx, mul(dx, dx));
    sxy = add(sxy, mul(dx, dy));
    syy = add(syy, mul(dy, dy));
  }
  for (const q of [xbar, ybar, sxx, sxy, syy]) {
    if (!isSafe(q)) throw new Error('these readings are too large to fit exactly');
  }
  return { n, xbar, ybar, sxx, sxy, syy };
}

/** Three unknowns, by Cramer's rule, in exact rationals. Null when singular. */
function cramer3(M, rhs) {
  const det3 = (A) => sub(
    add(mul(A[0][0], sub(mul(A[1][1], A[2][2]), mul(A[1][2], A[2][1]))),
      mul(A[0][2], sub(mul(A[1][0], A[2][1]), mul(A[1][1], A[2][0])))),
    mul(A[0][1], sub(mul(A[1][0], A[2][2]), mul(A[1][2], A[2][0]))),
  );
  const D = det3(M);
  if (isZero(D)) return null;
  const out = [];
  for (let col = 0; col < 3; col++) {
    const A = M.map((row, i) => row.map((cell, j) => (j === col ? rhs[i] : cell)));
    out.push(div(det3(A), D));
  }
  for (const q of out) if (!isSafe(q)) throw new Error('this fit has grown too large to hold exactly');
  return out;
}

/** A printed decimal, read by this checker's own reader, as an exact rational. */
function readDecimal(src) {
  const m = /^\s*(-?)\s*(\d+)\.(\d+)\s*$/.exec(String(src));
  if (!m) return null;
  const places = m[3].length;
  if (places > 9) return null;
  const scale = 10 ** places;
  const mag = R(Number(m[2]) * scale + Number(m[3]), scale);
  return { value: m[1] === '-' ? neg(mag) : mag, places };
}

/** Which of the three written forms of a line is this? */
function lineFormOf(src, vx, vy) {
  const at = String(src).indexOf('=');
  if (at < 0) return 'other';
  const lhs = String(src).slice(0, at).trim();
  const rhs = String(src).slice(at + 1).trim();
  let ln; let rn;
  try { ln = parse(lhs); rn = parse(rhs); } catch { return 'other'; }
  const lHasX = mentionsVar(ln, vx); const lHasY = mentionsVar(ln, vy);
  const rHasX = mentionsVar(rn, vx); const rHasY = mentionsVar(rn, vy);
  if (lHasY && !lHasX && !rHasY && rHasX) {
    // y = ... is slope-intercept; y - 3 = ... is point-slope.
    return ln.k === 'var' ? 'slopeIntercept' : 'pointSlope';
  }
  if (lHasX && lHasY && !rHasX && !rHasY) return 'standard';
  return 'other';
}

/** The one spelling a written inequality in two unknowns is compared through. */
function halfPlaneTex(vy, rel, m, b) { return `${vy} ${rel} ${texLine(m, b)}`; }

/** Evaluate a rule at a WHOLE-number input only. Half-integers are why `equivalent` cannot be used here. */
function atInteger(node, v, n) {
  if (!Number.isInteger(n)) throw new Error(`${n} is not a whole position`);
  return evalAst(node, { [v]: R(n) });
}

/** The two admissible shapes of a printed recursion, and nothing else. */
const RECUR_NUM = String.raw`(?:-?\d+|-?\\frac\{\d+\}\{\d+\}|\\frac\{-\d+\}\{\d+\})`;
const RECUR_START = new RegExp(`^([a-zA-Z])(?:\\\\left)?\\(1(?:\\\\right)?\\)=(${RECUR_NUM})$`);
const RECUR_STEP_ADD = new RegExp(`^([a-zA-Z])(?:\\\\left)?\\(([a-zA-Z])(?:\\\\right)?\\)=\\1(?:\\\\left)?\\(\\2-1(?:\\\\right)?\\)([+-])(${RECUR_NUM})$`);
const RECUR_STEP_MUL = new RegExp(`^([a-zA-Z])(?:\\\\left)?\\(([a-zA-Z])(?:\\\\right)?\\)=(${RECUR_NUM})\\\\cdot \\1(?:\\\\left)?\\(\\2-1(?:\\\\right)?\\)$`);

function readRecursion(statements) {
  if (!Array.isArray(statements) || statements.length !== 2) {
    throw new Error('a recursion is printed as exactly two statements');
  }
  const flat = statements.map((t) => normalise(t).replace(/\\cdot/g, '\\cdot '));
  let start = null; let step = null;
  for (const t of flat) {
    const a = RECUR_START.exec(t);
    if (a) { start = { name: a[1], value: evaluate(a[2]) }; continue; }
    const b = RECUR_STEP_ADD.exec(t);
    if (b) { step = { name: b[1], v: b[2], kind: 'add', by: b[3] === '-' ? neg(evaluate(b[4])) : evaluate(b[4]) }; continue; }
    const cM = RECUR_STEP_MUL.exec(t);
    if (cM) { step = { name: cM[1], v: cM[2], kind: 'mul', by: evaluate(cM[3]) }; continue; }
    throw new Error(`"${t}" is not one of the two recursion shapes this checker reads`);
  }
  if (!start || !step) throw new Error('a recursion needs a first term and one step rule');
  if (start.name !== step.name) throw new Error('the two statements name different rules');
  if (step.kind === 'add' && isZero(step.by)) throw new Error('a step of zero is not a sequence to find');
  if (step.kind === 'mul' && (isZero(step.by) || reqq(step.by, R(1)))) {
    throw new Error('a ratio of zero or one is not a sequence to find');
  }
  return { start, step };
}

/** Run a printed recursion forward, in exact rational arithmetic. */
function runRecursion(rec, at) {
  if (!Number.isInteger(at) || at < 1) throw new Error(`${at} is not a whole position above zero`);
  if (at > 400) throw new Error('that position is too far along to work out exactly');
  let v = rec.start.value;
  for (let i = 2; i <= at; i++) {
    v = rec.step.kind === 'add' ? add(v, rec.step.by) : mul(v, rec.step.by);
    if (!isSafe(v)) throw new Error('this sequence has grown too large to hold exactly');
  }
  return v;
}

/**
 * The nth-term rule of a printed list, derived rather than looked up.
 * A list that is neither arithmetic nor geometric is refused outright.
 */
function sequenceRule(rows) {
  if (rows.length < 3) throw new Error('a sequence needs at least three printed terms');
  const pos = rows.map((r) => r[0]);
  const val = rows.map((r) => r[1]);
  for (const q of pos) if (q.d !== 1) throw new Error('a position must be a whole number');
  for (let i = 1; i < pos.length; i++) {
    if (!reqq(sub(pos[i], pos[i - 1]), R(1))) throw new Error('the printed positions are not consecutive');
  }
  const d = sub(val[1], val[0]);
  let arithmetic = !isZero(d);
  for (let i = 1; i < val.length && arithmetic; i++) if (!reqq(sub(val[i], val[i - 1]), d)) arithmetic = false;
  if (arithmetic) {
    return { kind: 'arithmetic', at: (n) => add(val[0], mul(d, sub(R(n), pos[0]))) };
  }
  if (val.some(isZero)) throw new Error('the printed terms are neither arithmetic nor geometric');
  const q = div(val[1], val[0]);
  if (isZero(q) || reqq(q, R(1))) throw new Error('a ratio of zero or one is not a sequence to find');
  for (let i = 1; i < val.length; i++) {
    if (!reqq(div(val[i], val[i - 1]), q)) throw new Error('the printed terms are neither arithmetic nor geometric');
  }
  return {
    kind: 'geometric',
    at: (n) => {
      const step = sub(R(n), pos[0]);
      if (step.d !== 1) throw new Error('a position must be a whole number');
      return mul(val[0], rpow(q, step.n));
    },
  };
}

/** Every worked line of an inequality must describe the same solution set. */
function checkStepsInequality(steps, v, sol) {
  for (const s of steps) {
    if (/\\Rightarrow|\\square/.test(s.latex)) continue;
    let got;
    try { got = solveInequality(s.latex, v); } catch { continue; }
    if (got.rel !== sol.rel || !reqq(got.value, sol.value)) {
      throw new Error(`worked line changes the solution set: ${s.latex}`);
    }
  }
}

const normalise = (s) => String(s).replace(/\s+/g, '');

/**
 * DOES THIS SENTENCE PRINT THIS READING WHOLE?
 *
 * Two normalisations, and both are needed. A stem writes `$x \ge -4$` and the
 * reading is `x \ge -4`, so the spacing and `\left`/`\right` have to go; a stem
 * writes "makes it 18." and the reading is `18`, and squeezing ALL the space
 * out of that puts a letter against the `1`, so a boundary test refuses it and
 * a real giveaway is missed. A run of whitespace therefore collapses to ONE
 * space, which is not a word character and keeps the boundary honest, and the
 * fully squeezed form is tried as well — a hit from either is a hit, because a
 * cadet reading the glass does not care which.
 *
 * NEVER INSIDE A LONGER NUMBER: `18` printed inside `180` is not the answer
 * being handed over, and a reading of one character is not either — a stem
 * about six cells that happens to have the answer 6 is a coincidence an eye
 * cannot spend, and refusing every one of those would empty whole forms.
 */
function stemQuotes(stem, reading) {
  const bare = (x) => String(x).replace(/\\left|\\right/g, '').replace(/\s+/g, ' ').trim();
  const wordish = (c) => c !== undefined && /[0-9A-Za-z]/.test(c);
  const whole = (hay, needle) => {
    if (needle.length < 2) return false;
    for (let i = hay.indexOf(needle); i >= 0; i = hay.indexOf(needle, i + 1)) {
      if (wordish(needle[0]) && wordish(hay[i - 1])) continue;
      if (wordish(needle[needle.length - 1]) && wordish(hay[i + needle.length])) continue;
      return true;
    }
    return false;
  };
  const s = bare(stem || '');
  const r = bare(reading || '');
  return whole(s, r) || whole(s.replace(/ /g, ''), r.replace(/ /g, ''));
}

/**
 * Notation that is valid LaTeX but is not what anybody meant: a control
 * sequence whose backslash was eaten somewhere between the source and the
 * screen. `2left(7x + 5<CR>ight)` renders happily under strict KaTeX.
 */
const MANGLED = /[\x00-\x08\x0b\x0c\x0e-\x1f]|(?<![\\a-zA-Z])(?:left|right|cdot|frac|Rightarrow|begin|end|hline|sqrt)(?![a-zA-Z])/;

/** Every chained equality in a worked line must actually be true. */
function checkStepsEqual(steps, env) {
  for (const s of steps) {
    const parts = splitEq(s.latex);
    if (parts.length < 2) continue;
    let first = null;
    for (const p of parts) {
      let val;
      try { val = evaluate(p, env); } catch { first = undefined; break; }
      if (first === null) first = val;
      else if (first !== undefined && !reqq(first, val)) throw new Error(`worked line is false: ${s.latex}`);
    }
  }
}

function checkStepsSolve(steps, v, sol) {
  for (const s of steps) {
    const parts = splitEq(s.latex);
    if (parts.length !== 2) continue;
    let got;
    try { got = solveLinear(s.latex, v); } catch { continue; }
    if (got.kind !== sol.kind) throw new Error(`worked line changes the solution set: ${s.latex}`);
    if (sol.kind === 'unique' && !reqq(got.value, sol.value)) {
      throw new Error(`worked line changes the solution: ${s.latex}`);
    }
  }
}

function checkStepsEquivalent(steps, v) {
  for (const s of steps) {
    const parts = splitEq(s.latex);
    if (parts.length < 2) continue;
    for (let i = 1; i < parts.length; i++) {
      let ok;
      try { ok = equivalent(parts[0], parts[i], v); } catch { ok = null; }
      if (ok === false) throw new Error(`worked line is not an identity: ${s.latex}`);
    }
  }
}

function splitEq(latex) {
  if (/\\Rightarrow|\\square/.test(latex)) return [];
  return latex.split('=').map((p) => p.trim()).filter(Boolean);
}

// ---------------------------------------------------------------------------
// Item shape measurements — used by the ladder gate and by the simulation.
// ---------------------------------------------------------------------------
/** Every integer literal that appears in the notation the learner sees. */
export function literalsOf(latex) {
  return (String(latex).match(/\d+/g) || []).map(Number);
}

/**
 * Every distinct letter standing for a quantity in the notation the learner
 * sees — control sequences, environment names and column specifications
 * removed, because `\frac`, `array` and `c|c` are typography and not algebra.
 */
export function lettersOf(latex) {
  const bare = String(latex)
    // Prose inside notation is prose. "\text{no solution}" is one answer, not
    // seven quantities called n, o, s, l, u, t and i.
    .replace(/\\text\s*\{[^}]*\}/g, ' ')
    .replace(/\\begin\{[a-zA-Z]*\}(\s*\{[^}]*\})?/g, ' ')
    .replace(/\\end\{[a-zA-Z]*\}/g, ' ')
    .replace(/\\[a-zA-Z]+/g, ' ')
    .replace(/[{}]/g, ' ');
  return new Set(bare.match(/[a-zA-Z]/g) || []);
}

/**
 * How much this item actually asks of a learner.
 *
 * Deliberately crude and deliberately mechanical: chain length, the size of the
 * numbers to be held, whether signs are in play, and how many terms there are.
 * It exists so that "difficulty 4" is a claim the build can check rather than a
 * label a generator gives itself.
 */
/**
 * The mathematics inside a stem, and nothing else.
 *
 * Item prose puts its notation between `$…$`, so this pulls those out and drops
 * the words. It exists for `demandOf`: a no-display item states its quantities
 * in the sentence, and a measure that read only the display would score
 * "13 tonnes were hauled out; it reads 29" as an item with no numbers in it.
 */
function mathsInStem(stem) {
  const src = String(stem || '');
  const inline = [...src.matchAll(/\$([^$]+)\$/g)].map((m) => m[1]);
  // Bare numerals in the prose are quantities too — "13 tonnes ... reads 29" —
  // and they are how the situation forms state theirs.
  const bare = src.replace(/\$[^$]+\$/g, ' ').match(/-?\d+/g) || [];
  return [...inline, ...bare].join(' ');
}

export function demandOf(item) {
  // A "which equation models this?" prompt carries its numbers in the answer,
  // not in the stem skeleton, so both are measured — and some of those forms
  // now carry no display at all (`noDisplay`), so the empty string and not the
  // word "null" is what stands in for one. Interpolating a null here put the
  // letters n, u and l into `lettersOf` and inflated the `held` term, which is
  // a term in the measured difficulty ladder.
  // An item with NO display carries its quantities in the stem — that is what
  // "no display" means. Measuring only `latex` and `answer` would score every
  // such item as almost demand-free and quietly flatten the difficulty ladder
  // that `tools/validate-items.mjs` checks band by band.
  const tex = item.latex || (item.noDisplay ? mathsInStem(item.stem) : '');
  const lits = literalsOf(`${tex} ${item.answer}`);
  const maxAbs = lits.length ? Math.max(...lits) : 0;
  const neg = /(^|[\s(=])-\s*\d|\(-/.test(tex) ? 1 : 0;
  const ansNeg = String(item.answer).trim().startsWith('-') ? 0.5 : 0;
  const ansFrac = /\//.test(item.answer) || /\\frac/.test(item.answer) ? 0.75 : 0;
  const terms = (tex.match(/[+]|(?<=[0-9a-zA-Z}])\s-/g) || []).length;
  // Quantities are quantities whether they are written as numbers or as
  // letters. Without this term a literal equation — `P = 2l + 2w`, solved for
  // w — measures as one of the easiest items in the bank, because it contains
  // almost no digits, when in fact the learner is holding three unknowns at
  // once and cannot check the answer by arithmetic. One letter is the ordinary
  // case and costs nothing; every letter after it is another quantity to keep
  // hold of. Algebra I Level 1 is single-unknown throughout, so this leaves its
  // measured ladder where it was.
  const held = Math.max(0, lettersOf(`${tex} ${item.answer}`).size - 1);
  return (item.steps.length * 0.6) + Math.log2(1 + maxAbs) + neg + ansNeg + ansFrac
    + terms * 0.25 + held * 0.9;
}

// ---------------------------------------------------------------------------
// finalize
// ---------------------------------------------------------------------------
function finalize(raw, meta) {
  const { skill, form, d, seed, T } = meta;
  const item = {
    skill,
    form: form.id,
    rep: form.rep,
    // The shape a learner recognises before they read a number, so a caller
    // that reports an item can report what it repeated. See `skeletonOf`.
    skeleton: skeletonOf(form),
    difficulty: d,
    seed,
    type: raw.type || 'numeric',
    stem: raw.stem || '',
    latex: raw.latex,
    /**
     * An item that has NOTHING TO SHOW, and says so.
     *
     * Every item used to be required to carry a display, and a form with
     * nothing worth displaying therefore had to invent one. That is where
     * `x \square \square = \square` came from — three empty boxes in the same
     * glyph the rig uses for an unfilled answer socket, printed above a
     * "which equation says this?" question whose whole content was already in
     * the prose. The requirement stays, because an item that lost its display
     * to a bug must still fail loudly; what changes is that "no display" is
     * now something a form DECLARES rather than something it leaves undone.
     */
    noDisplay: !!raw.noDisplay,
    figure: raw.figure || null,
    answer: String(raw.answer),
    accept: raw.accept || [],
    steps: (raw.steps || []).map((s) => ({ latex: s.latex, why: s.why })),
    check: raw.check,
    distractors: [],
    diagnostics: [],
  };

  if (item.noDisplay) {
    if (item.latex) throw new Error('an item declared noDisplay and then supplied one');
  } else if (!item.latex || /NaN|undefined|Infinity/.test(item.latex)) {
    throw new Error('degenerate prompt');
  }
  // A LaTeX command that lost its backslash still renders — as the letters
  // "left(" or a stray carriage return — and strict KaTeX will not complain,
  // so nothing else catches it. This does.
  for (const src of [item.latex || '', item.answer, ...(raw.steps || []).map((s) => s.latex)]) {
    if (MANGLED.test(String(src))) throw new Error(`a control sequence lost its backslash: ${src}`);
  }
  if (/NaN|undefined|Infinity/.test(item.answer)) throw new Error('degenerate answer');
  if ((item.latex || '').includes('\\text{')) throw new Error('prose leaked into the notation');
  if (item.type === 'numeric' && !/^-?\d+(\/\d+)?$/.test(item.answer)) throw new Error('numeric answer is not exact');

  // A worked example whose job is to show which number came from where cannot
  // be built out of three copies of the same number.
  if (form.distinctNums) {
    // Exponents are notation, not quantities: the 2 in x^{2} is not a number
    // the learner has to trace back to anywhere.
    const lits = literalsOf(String(item.latex || '').replace(/\^\s*\{?-?\d+\}?/g, ''));
    if (new Set(lits).size !== lits.length) throw new Error('repeated literal in a provenance-critical prompt');
  }

  // Special answers ("no solution", "every value") are localised at this point.
  if (item.type === 'special') {
    item.answerKind = item.answer;
    item.answer = specialTex(item.answer, T);
  }

  for (const s of item.steps) {
    if (!s.latex || /NaN|undefined|Infinity/.test(s.latex)) throw new Error('degenerate worked line');
    if (!s.why) throw new Error('worked line without a reason');
  }

  // A worked line identical to the one above it records a move that changed
  // nothing — dividing by one, taking away a zero — and the echo would spend a
  // whole rung of its fading ladder printing it twice. Collapse them, and if
  // what remains is a single move, this seed cannot be faded into a four-layer
  // echo at all: reject it and let the caller draw again.
  const collapsed = [];
  for (const s of item.steps) {
    const prev = collapsed[collapsed.length - 1];
    if (prev && normalise(prev.latex) === normalise(s.latex)) continue;
    collapsed.push(s);
  }
  item.steps = collapsed;
  if (item.steps.length < 2) throw new Error('a single-move derivation cannot be faded into an echo');

  verify(item);

  /**
   * A SENTENCE MAY NOT PRINT THE ANSWER IT IS ASKING FOR.
   *
   * The free keypad has no option set — a cadet has to produce the value — so
   * the one cue left on it is the stem itself, and 24 of 10,692 route cards
   * were handing it over: `eval-expr/ee-fraction` asks "when $x = 6$" of an
   * expression that evaluates to 6, and `eval-expr/ee-graph` asks for the
   * height above $x = -3$ on a line whose height there is $-3$. Nothing had to
   * go wrong for that: both numbers are drawn independently and sometimes land
   * on each other, and every other gate is happy because the mathematics is
   * right and the sentence is short.
   *
   * The rule is stated once, here, rather than as a retry line inside the two
   * forms that were caught — the next form to draw two numbers independently
   * would have shipped the same defect and nobody would have written the line
   * again.
   *
   * THE ONE EXEMPTION IS DECLARED, NOT INFERRED. A `dispute` form quotes two
   * readings into its sentence on purpose and asks which is true, so on a
   * four-option card one of the quoted readings IS the key. Those forms carry
   * `quote`, and `quoteReadings` below decides WHICH readings they name — from
   * the card's own hash, and on a keypad card never from a pool holding the
   * answer. A form with no `quote` has no business printing it.
   *
   * `tools/critic/choiceshape.mjs` keeps its own reader and measures the same
   * thing on every build, which is why this one may exist at all: a generator
   * that grades its own homework is not evidence.
   */
  if (!raw.quote && stemQuotes(item.stem, item.answer)) {
    throw new Error('retry: the stem prints the answer it is asking for');
  }

  // The tagged catalogue. Everything here is a wrong value that this item can
  // *recognise*; `./diagnose.js` will never name a misconception that is not
  // either in this list or a structural certainty. Dedupe, drop anything that
  // is actually correct.
  const seen = new Set([normalise(item.answer)]);
  for (const dd of raw.distractors || []) {
    let val = dd.v;
    if (val == null) continue;
    if (item.type === 'special') val = specialTex(String(val), T);
    val = String(val);
    if (!val.trim()) continue;
    if (/NaN|undefined|Infinity/.test(val)) continue;
    if (seen.has(normalise(val))) continue;
    if (item.type === 'expression' && item.check.kind === 'equivalent') {
      let same = false;
      try { same = equivalent(val, item.answer, item.check.variable); } catch { same = false; }
      if (same) continue;
    }
    if (item.type === 'numeric') {
      const a = fromString(val);
      if (!a) continue;
      if (reqq(a, fromString(item.answer))) continue;
    }
    if (item.check.kind === 'equationChoice') {
      let bad = false;
      try {
        const s2 = solveLinear(val, item.check.variable);
        bad = s2.kind === 'unique' && rstr(s2.value) === item.check.expect;
      } catch { bad = true; }
      if (bad) continue;
    }
    if (!dd.m) throw new Error('untagged distractor');
    seen.add(normalise(val));
    item.diagnostics.push({ value: val, misconception: dd.m });
  }
  // A free keypad has to recognise a lot of wrong answers, because a learner
  // can enter anything. A form that really is a choice between readings has a
  // small, closed error space and does not.
  const closed = item.type === 'special' || item.check.kind === 'equationChoice';
  if (item.diagnostics.length < (closed ? 3 : 5)) {
    throw new Error('too few recognisable errors to diagnose honestly');
  }

  // The three shown when the surface has to narrow to a choice: one per
  // misconception where possible, so a choice is never two shades of one error.
  const usedMis = new Set();
  for (const dd of item.diagnostics) {
    if (item.distractors.length >= 3) break;
    if (usedMis.has(dd.misconception)) continue;
    usedMis.add(dd.misconception);
    item.distractors.push(dd);
  }
  for (const dd of item.diagnostics) {
    if (item.distractors.length >= 3) break;
    if (!item.distractors.includes(dd)) item.distractors.push(dd);
  }
  if (item.distractors.length < 3) throw new Error('not enough usable distractors');
  balanceShape(item);
  quoteReadings(item, raw, T);

  return item;
}

/**
 * WHICH READINGS THE SENTENCE QUOTES, AND WHY THE CARD DECIDES IT RATHER THAN
 * THE FORM.
 *
 * A `dispute` form puts two readings in the stem — "One cadet chalks $x > 4$.
 * Another chalks $x < 4$." — and then asks which reading is true. It is a good
 * item and it was handing the answer over, in twelve framings and three
 * locales, because the two quoted readings were written by hand as
 *
 *     { a: THE ANSWER, b: the first distractor }
 *
 * and every one of the twelve sentences prints `{a}` first. So "take the
 * reading the sentence names FIRST" was right 100% of the time on the
 * four-option card, and on `rule-from-table/rft-dispute`, which lands on a FREE
 * KEYPAD with no option set at all, a cadet who typed the first number in the
 * sentence sealed the card with nothing whatever. 171 route cards.
 *
 * The two readings cannot be chosen when the form is built, because what the
 * card will SHOW is not decided until `balanceShape` has run. So they are
 * chosen here, and the rule is different on the two surfaces for a reason that
 * is not a preference:
 *
 *   · A CARD THAT SHOWS ITS OPTIONS quotes two of the FOUR IT SHOWS, drawn
 *     uniformly. Then the key is quoted exactly half the time and is quoted
 *     first exactly a quarter of the time, so "pick a quoted one", "pick the
 *     first quoted one" and "strike the quoted ones" are each worth 1/4 —
 *     which is chance. Quoting only wrong readings would be worse than the
 *     defect: "strike the two the sentence names" would leave two options and
 *     be worth 1/2.
 *
 *   · A FREE KEYPAD has no option set, so there is nothing for a quoted
 *     reading to be one of, and any rate at which the sentence prints the
 *     answer is a rate at which a cadet types it without doing anything. So it
 *     quotes two readings that are NEVER the key. Eliminating two numbers out
 *     of every number there is buys nothing, which is exactly the point.
 *     They are also drawn from BEYOND the two the narrowed field will show, so
 *     that a cadet who misses twice does not then meet a three-option field
 *     with the two struck readings in it.
 *
 * A form opts in by returning `quote: { ctx, ask, vars }` instead of writing
 * its own stem; `a` and `b` are filled in here.
 */
function quoteReadings(item, raw, T) {
  const q = raw.quote;
  if (!q) return;
  const shown = shownWidth(item) === 4;
  const pool = shown
    ? [String(item.answer), ...item.distractors.map((dd) => String(dd.value))]
    : (item.diagnostics || []).map((dd) => String(dd.value))
      .filter((x) => !item.distractors.slice(0, 2).some((dd) => String(dd.value) === x));
  if (pool.length < 2) return;
  // Drawn off the card's own hash, never off which one is the key.
  const h = shapeMix(`${item.skill}|${item.form}|${item.difficulty}|${item.seed}|quote`);
  const i = h % pool.length;
  const j = (i + 1 + (Math.floor(h / pool.length) % (pool.length - 1))) % pool.length;
  // The framing decides its own notation — every `disp*` sentence already
  // writes `${a}$` — so what is handed over is the reading exactly as the card
  // prints it, and nothing here adds a delimiter.
  // WHAT THE SENTENCE QUOTES, ON THE ITEM. `tools/check-language.mjs` refuses a
  // numeral in a stem that the mathematics never uses, and on a dispute card
  // the quoted readings ARE the question — so the item has to be able to say
  // which numbers those are. It used to be inferred from the stem printing the
  // answer, which is the very thing this function exists to stop doing.
  item.quoted = [pool[i], pool[j]];
  item.stem = `${T(q.ctx, { ...(q.vars || {}), a: pool[i], b: pool[j] })} ${T(q.ask)}`;
}

/**
 * THE KEY'S SHAPE MUST NOT DEPEND ON ITS BEING THE KEY — ON THE SURFACE THIS
 * CARD IS ACTUALLY SHOWN ON.
 *
 * WHAT THIS REPLACED, TWICE, AND WHY NEITHER REPLACEMENT WAS A REVERT.
 *
 * Wrong answers drift longer than right ones, so the key used to end up the
 * shortest string in the set: "pick the shortest" was decisive on roughly half
 * the choice items and right 39% of the time against a 25% baseline. The first
 * repair — `balanceLength` — guaranteed the key was never the unique shortest
 * option and never the unique longest one. It worked, and that is exactly what
 * was wrong with it: a cue right 39% of the time is a weak cue, a cue right 0%
 * of the time is a PERFECT ELIMINATION RULE, and the sandwich turned the first
 * into the second — 2.0% shortest, 0.3% longest, and a cadet who reads no
 * mathematics first-picking 30.9% against 25%.
 *
 * The second repair DREW the key's place instead of clamping it, and weighted
 * the draw against the catalogue's own lean with two hand-set vectors. That was
 * the right shape and the wrong measurement. The weights were fitted to a
 * number averaged over 89,994 cards — and only 26,436 of those are cards a
 * learner is ever shown a set of options on. The other 63,558 go to a keypad, a
 * beam, a sorter, a field or a coordinate plane, where the option list is never
 * drawn at all. So the freedom was being spent on cards nobody chooses between,
 * the aggregate read 26.31% and printed PASS, and the surfaces a learner really
 * meets read 31.6% (the four-option card), 41.6% (the narrowed field) and 50.0%
 * (the special-answer card).
 *
 * THE RULE THIS FILE NOW HOLDS. Not "the key is never extreme", not "the key is
 * sometimes extreme", and not "on average over everything": **on each surface a
 * learner is shown, every cue an eye can read must be worth exactly what chance
 * is worth, and no more.** A cue that never fires leaks nothing; a cue that
 * fires must name the key 1/k of the time.
 *
 * HOW, IN FOUR STEPS.
 *
 * 1. WHICH SET IS SHOWN. `shownWidth` answers it with the same predicate
 *    `RiftPanel._mount` routes on: a card whose type is `special`, whose check
 *    is an `equationChoice`, or whose display carries a box glyph goes to the
 *    four-option card and shows all three distractors. Everything else lands on
 *    a keypad, and the only option set it will ever draw is the NARROWED FIELD
 *    — the key and the FIRST TWO distractors, after two honest misses. So a
 *    keypad card spends its freedom on the three-option field and a choice card
 *    spends it on the four-option card, and neither wastes it on the other.
 *    `tools/critic/choiceshape.mjs` does not trust this predicate: it cuts the
 *    real routing chain out of `src/ui/rift.js` and executes it, so if the two
 *    ever disagree the gate says so on the next build.
 *
 * 2. WHAT AN EYE CAN READ. Two counts — the printed length and the digit count
 *    — and six written features: a leading minus, a fraction bar, a relation
 *    sign, words, a letter, a radical. `words` is here because of the
 *    special-answer card, where the key is a PHRASE: two of its four options
 *    used to be bare numbers, so "strike every bare number" first-picked 50.00%
 *    against 25% and cleared a three-item proving run at 12.5% against 1.56%.
 *
 * 3. WHAT THE CARD IS ASKED FOR. For every cue, each candidate set gives one of
 *    three outcomes: the cue names the KEY, the cue names a distractor (OTHER),
 *    or the cue does not fire at all (NONE). The target is drawn per card from
 *    what this card's own catalogue can actually reach — `shapeTarget` — and
 *    the policy is the whole of the correction:
 *
 *      · both KEY and OTHER reachable → KEY with probability 1/k, else OTHER.
 *        The cue fires, and over the population it names the key exactly at
 *        chance. This is the case that matters and it needs no constants.
 *      · KEY unreachable → ask for NONE if the catalogue can give it. A cue
 *        that never fires cannot be an elimination rule, which is the honest
 *        answer to a one-sided catalogue and the one the old weights were
 *        approximating with a hand-set 8.
 *      · OTHER unreachable → likewise NONE, so a cue that can only ever name
 *        the key is silenced rather than left pointing at it.
 *
 *    That policy is LOCAL. It needs no measurement of the bank, so it cannot go
 *    stale when the bank changes, which is what happened to the two weight
 *    vectors it replaces.
 *
 * 4. WHICH SET IS TAKEN. Ten cues cannot all be satisfied by one set of three
 *    options drawn from a catalogue of six, so the cues are put in a per-card
 *    drawn order and the set matching the longest prefix of that order wins.
 *    Every cue is first on 1/10 of cards, so no cue is systematically the one
 *    that gets given up.
 *
 * WHAT IT WILL NOT TRADE. Every option still comes from `diagnostics`, so it is
 * still a wrong value this item can recognise and name. The set still carries
 * as many distinct misconceptions as the catalogue can give it — a hard filter
 * applied before shape is looked at, so a choice is never two shades of one
 * error in order to hit a target — and on a keypad card the TWO readings the
 * narrowed field will show carry two distinct misconceptions wherever the
 * catalogue has two to give.
 */
const SHAPE_POOL_CAP = 12;

/**
 * WHICH OPTION SET THIS CARD WILL ACTUALLY PUT ON SCREEN, and how wide it is.
 *
 * The predicate is `RiftPanel._mount`'s, in the same order and for the same
 * reason: a `special` answer, an `equationChoice`, or a box glyph in the
 * display sends the card to `_choice`, which shows the key and all three
 * distractors. Every other card lands on the keypad, whose only option set is
 * the narrowed field — the key and the FIRST TWO distractors, drawn after two
 * honest misses.
 *
 * A card that goes to the beam, the sorter, the area field or the coordinate
 * plane shows no option set at all; it is handled here as a keypad card,
 * because balancing a set nobody sees costs nothing, and guessing which of
 * those four surfaces will take it would mean keeping a copy of four DOM
 * builders in this file.
 *
 * `tools/critic/choiceshape.mjs` does not trust this predicate: it cuts the
 * real routing chain out of `src/ui/rift.js` and executes it, so if the two
 * ever disagree the gate says so on the next build.
 */
function shownWidth(item) {
  const choice = item.type === 'special'
    || item.check?.kind === 'equationChoice'
    || (item.latex && /\\square/.test(item.latex));
  return choice ? 4 : 3;
}

/**
 * Balance the option set this card will actually be shown as.
 *
 * Leaves `item.distractors` as three tagged wrong values, in the order the
 * surfaces read them: `_choice` shows all three, `_narrow` shows the first two.
 */
function balanceShape(item) {
  const pool = (item.diagnostics || []).slice(0, SHAPE_POOL_CAP);
  const n = pool.length;
  if (n < 3) return;
  const width = shownWidth(item);
  const M = pool.map((dd) => dd.misconception);

  // Every trio the catalogue can offer, cut down to the ones carrying the most
  // distinct misconceptions. That cut happens BEFORE shape is looked at:
  // meaning is not spent on shape. On a keypad card the ORDER matters too — the
  // narrowed field shows the first two — so each trio is offered in its three
  // rotations, and a rotation whose two leading readings are two shades of one
  // error is dropped wherever the catalogue has two to give.
  const trios = [];
  let bestMis = 0;
  for (let a = 0; a < n - 2; a++) {
    for (let b = a + 1; b < n - 1; b++) {
      for (let c = b + 1; c < n; c++) {
        const dist = new Set([M[a], M[b], M[c]]).size;
        if (dist > bestMis) bestMis = dist;
        trios.push({ o: [a, b, c], dist, near: a + b + c });
      }
    }
  }
  const cand = [];
  let bestLead = 0;
  for (const t of trios) {
    if (t.dist !== bestMis) continue;
    if (width === 4) { cand.push({ o: t.o, near: t.near, lead: 2 }); continue; }
    const [a, b, c] = t.o;
    for (const o of [[a, b, c], [a, c, b], [b, c, a]]) {
      const lead = M[o[0]] === M[o[1]] ? 1 : 2;
      if (lead > bestLead) bestLead = lead;
      cand.push({ o, near: t.near, lead });
    }
  }
  const live = width === 4 ? cand : cand.filter((x) => x.lead === bestLead);
  if (!live.length) return;

  const key = String(item.answer);
  const salt = `${item.skill}|${item.form}|${item.difficulty}|${item.seed}|${key}`;
  /* THE SENTENCE OVER THE SET IS PART OF THE SET. A card whose stem prints a
     value the option list also carries hands a cadet a rule no count of glyphs
     can see: on `eval-expr/ee-graph` the narrowed field's readings were quoted
     by the stem on 44% of cards and the KEY was almost never one of them, so
     "strike whatever the sentence already said" was worth 40.6% against 33.3%.
     What is handed over is the stem as it stands NOW — `quoteReadings` runs
     after this and, on a keypad card, deliberately quotes readings from BEYOND
     the two this field will show, so the two cannot contradict each other. */
  const at = balancedPick(key, live.map((x) => ({
    show: x.o.slice(0, width - 1).map((i) => String(pool[i].value)),
    rank: x.near,
  })), salt, String(item.stem || ''));
  let take = live[at];

  /* THE THIRD READING ON A KEYPAD CARD IS NOT SHOWN, AND IS STILL WORTH
     CHOOSING WELL. The narrowed field draws the key and the first two, so the
     two above decide the surface a learner meets and the third is free. It is
     spent on the four-option set anyway — the one `tools/validate-items.mjs`
     sweeps — because a free choice left to fall out of the catalogue does not
     stay neutral: it fell to "the longest option is the key 0.8% of the time",
     which is a perfect elimination rule on a set nobody is shown today and a
     real one the moment anything shows it. It costs nothing: only sets that
     already give the narrowed field exactly what it asked for are considered. */
  if (width === 3) {
    const lead = `${take.o[0]},${take.o[1]}`;
    const same = live.filter((x) => `${x.o[0]},${x.o[1]}` === lead);
    if (same.length > 1) {
      const j = balancedPick(key, same.map((x) => ({
        show: x.o.map((i) => String(pool[i].value)), rank: x.near,
      })), `${salt}|spare`, String(item.stem || ''));
      take = same[j];
    }
  }
  item.distractors = take.o.map((i) => pool[i]);
}

/**
 * THE FOUR READINGS OF A STATEMENT, AND WHY EVERY ONE OF THEM CAN BE THE KEY.
 *
 * THREE ROUNDS OF THE SAME DEFECT, AND WHAT THEY ALL MISSED.
 *
 * A special-answer card asks which reading of the statement is true. Round one:
 * the key was a phrase and its wrong readings were BARE NUMBERS, so "strike
 * every bare number" left two readings, one of which was always the key —
 * 50.00% against 25%. Round two wrote the wrong readings as phrases that named
 * a value ("only 24 works"), and the key was still the only reading with no
 * numeral in it. Round three wrote them as phrases naming a COUNT ("only four
 * work"), matched all six to the same printed length, and put each whole phrase
 * inside one `\text{}` so no glyph outside could separate them.
 *
 * Round three's card passes every cue a reading of ONE card can carry, and it
 * was still a 50% giveaway, because the leak was never inside a card:
 *
 *     THE KEY WAS ALWAYS `ALL` OR `NONE`. A linear equation in one unknown has
 *     no solution, one, or infinitely many — it can never have "only four" — so
 *     three of the six readings could never be true of anything, the shipped
 *     bank drew exactly four distinct strings, and a cadet who had met the
 *     surface twice knew the answer was one of two of them. Measured over the
 *     route: 56.25% against 25%, and a three-item proving run cleared 17.80% of
 *     the time against 1.56%.
 *
 * No arrangement of four options can repair that. If only two of the four can
 * ever be true, then "take one of those two" is worth 1/2 whatever order they
 * are printed in, whatever they are called and however long they are.
 *
 * THE REPAIR: FOUR READINGS THAT ARE ALL REACHABLE, AND A DRAWN KEY.
 *
 * A linear equation's three solution sets are none, every value, and exactly
 * one — and the fourth reading is the one that has to be EARNED: when exactly
 * one value works, is it more than zero or less than it? Every one of the four
 * is mutually exclusive of the other three, every one of them is true of some
 * statement this generator can write, and `specialKind` DRAWS which one this
 * card will be and then builds the statement to match.
 *
 * That is the whole of the correction, and it makes every other rule free. The
 * four readings on screen are the SAME four on every card, so the option set
 * carries no information at all; and the key is uniform over them, so for any
 * rule a cadet can play — take the shortest, take the ones without a numeral,
 * take the one you remember being right — the chance it names the key is
 * exactly the share of the set that rule leaves standing. Printed length no
 * longer has to be matched by hand, because the key is exchangeable with the
 * other three by construction rather than by resemblance.
 *
 * It also asks for more mathematics than it did: two of the four outcomes
 * cannot be read off the shape of the statement at all — the learner has to
 * solve it — which is what `both-sides` is for, and it is the classification
 * CCSS 8.EE.C.7a names in as many words.
 *
 * `npm run check:shape` measures the real card, plays a cadet who has met the
 * surface before, and goes red on this one if any of it drifts.
 */
const SPECIAL_READINGS = {
  ALL: 'answer.allValues', NONE: 'answer.noSolution',
  POS: 'answer.oneAboveZero', NEG: 'answer.oneBelowZero',
  // Kept for the preview units, whose special cards name their own readings.
  ONE: 'answer.onlyOne', FEW: 'answer.onlyA', SOME: 'answer.onlyB', MANY: 'answer.onlyC',
};
/** The four a linear statement can be, in a fixed order. */
const SPECIAL_KINDS = ['ALL', 'NONE', 'POS', 'NEG'];
/** Which of the four this card will be — drawn, never derived. */
const specialKind = (r) => SPECIAL_KINDS[Math.floor(r() * SPECIAL_KINDS.length) % SPECIAL_KINDS.length];

function specialTex(kind, T) {
  const key = SPECIAL_READINGS[kind];
  if (!key) return kind;
  /* A READING IS PROSE UNTIL THE MOMENT IT BECOMES NOTATION, AND THE TWO WANT
     OPPOSITE THINGS FROM A SPACE. `src/i18n/typography.js` binds a one-letter
     word to the word after it with a NO-BREAK space, because a Spanish line may
     not end on a lone "y" and a Polish one may not end on a lone "w" — and
     strict KaTeX refuses U+00A0 outright, so "uno funciona, y es mayor que
     cero" came back as 477 rejected items the moment it was wrapped. Inside
     `\text{}` the rule has nothing to do anyway: KaTeX sets the whole run as
     one inline block and never breaks it, so the space it protects cannot
     fall at the end of a line. It goes back to an ordinary space here, at the
     one seam where prose turns into notation. */
  return `\\text{${String(T(key)).replace(/\u00a0/g, ' ')}}`;
}

// ---------------------------------------------------------------------------
// public API
// ---------------------------------------------------------------------------
/** Every situation key a deck can produce, by deck name. */
export const DECK_SCENES = Object.fromEntries(
  Object.entries(DECKS).map(([k, v]) => [
    k, v.map((e) => (typeof e === 'string' ? e : e.ctx)).filter((x) => x && x.startsWith('ctx.')),
  ])
);

/**
 * THE SITUATION SKELETON of an item form — what a learner recognises as
 * "this one again" before they have read a single number.
 *
 * WHY A SECOND IDENTITY, WHEN A FORM ALREADY HAS AN ID
 *
 * Two mechanisms already fight repetition and neither of them can see this.
 * The session ledger above cycles a *deck* before it repeats a framing, so no
 * cadet meets the drop-pods twice — and `tools/scene-audit.mjs` proves it. The
 * scheduler prefers the *form* a learner has met least on this skill. Between
 * them a session can still be built entirely out of one sentence pattern:
 *
 *     item 4   the skiff starts at 84% and loses 6% a minute — read it at 7
 *     item 8   the coolant starts at 91 degrees and sheds 5 a minute — at 4
 *     item 11  the tether starts at 74 m and pays out 8 a minute — at 6
 *
 * Every gate passes. Three different framings, three different decks entries,
 * three different numbers, one form served three times. A cold critic reading
 * twelve consecutive items called it what it is: a reskin. A cadet stops
 * reading at the second one and starts pattern-matching for the two numbers,
 * which is the exact habit a contextual item exists to break.
 *
 * WHAT COUNTS AS THE SAME SKELETON
 *
 * A situation deck plus the surface it is read off. The deck fixes the shape of
 * the sentence — "something starts at b and loses a of itself each minute" —
 * and the surface fixes what the learner is asked to do with it. So:
 *
 *   · `holdBack:context` and `holdBack:verbal` are DIFFERENT. Same gauge, but
 *     one asks for the starting mass and the other asks which equation models
 *     it, and those are not the same question wearing a hat.
 *   · `trace:graph` in eval-expr and `trace:graph` in two-step are the SAME,
 *     across two skills. Reading a value off a straight line drawn for you is
 *     one item shape however the skill graph files it, and serving both inside
 *     a handful of items reads as a repeat, because it is one.
 *   · a form with no situation at all — a bare symbolic reading — is its own
 *     skeleton, named after itself. There is no sentence to recognise, so the
 *     only thing that can repeat is the notation.
 *
 * `mastery.js` refuses to serve one skeleton twice running and caps how often
 * one may appear inside a window of items; `tools/validate-items.mjs` plays
 * twenty-item sessions and fails the build if either is broken. A form is free
 * to name its own skeleton if the derived one is wrong for it.
 */
export function skeletonOf(form) {
  if (!form) return 'form:?';
  if (form.skeleton) return form.skeleton;
  const keys = form.sceneKeys || (form.scenes ? DECK_SCENES[form.scenes] : null);
  if (form.scenes && keys && keys.length) return `${form.scenes}:${form.rep}`;
  return `form:${form.id}`;
}

/**
 * THE ACT — one grain coarser than the skeleton, and the grain a learner counts.
 *
 * WHY THERE IS A SECOND AXIS AT ALL.
 *
 * A player who had just finished a real session wrote the count down:
 *
 *   "6 of 14 items were 'substitute a value into a monomial/binomial' … 2 of 14
 *    were 'table with a rule header, one gap'. 8 of 14 across two shapes."
 *
 * Every skeleton rule above was satisfied while that happened, and the item
 * gate passed, because the last clause of `skeletonOf` says a bare symbolic
 * reading is its own skeleton *named after the form*. In `eval-expr` that is
 * four separate names —
 *
 *     form:ee-linear     substitute into  3x + 5
 *     form:ee-two-var    substitute into  3x - 2y
 *     form:ee-fraction   substitute into  (x + 4)/2
 *     form:ee-square     substitute into  2x^2 - 1
 *
 * — for one thing to do: put a number where the letter is and work it out. The
 * scheduler was correctly told those were four different shapes and correctly
 * dealt two of each, and the learner correctly counted six of the same
 * question. The rule was not broken. The rule was measuring notation, and the
 * player was counting the act.
 *
 * WHAT AN ACT IS
 *
 * What the learner physically does, independent of what it is dressed in:
 *
 *   · every bare symbolic form of one skill is ONE act. `eval-expr` symbolic is
 *     "substitute and evaluate", whether the expression is a monomial, a
 *     binomial, a fraction bar or a square. Four notations, one verb.
 *   · a dressed form keeps its skeleton as its act, because a situation deck
 *     genuinely changes the reading task: `decay:context` and `flatRate:context`
 *     are two different things to work out, not one thing in two costumes.
 *   · the act is keyed to the SKILL for symbolic forms and not to the skill for
 *     dressed ones — "solve for x symbolically" and "collect like terms
 *     symbolically" are different acts, while `trace:graph` is the same act
 *     wherever the graph files it, exactly as it is the same skeleton.
 *
 * `mastery.js` enforces adjacency and a window cap on ACTS first and on
 * skeletons second, and `tools/validate-items.mjs` fails the build on either.
 * A form may name its own `act` when the derived one is wrong for it.
 */
export function actOf(form, skill = '') {
  if (!form) return 'act:?';
  if (form.act) return form.act;
  const sk = skeletonOf(form);
  // `form:` is the skeleton's way of saying "no situation here" — which is
  // precisely the case where the notation is not the act.
  return sk.startsWith('form:') ? `do:${skill || form.skill || 'any'}:${form.rep}` : sk;
}

/**
 * Every (situation, question) pairing a deck can deal.
 *
 * A deck entry is an object precisely when the question has to agree with the
 * noun the situation counts, and for a long time nothing checked that it did.
 * `ctx.hullPatches` counted plates of hull skin and `ask.howManyPanes` asked
 * for window panes; English happened to call both a "pane" and so read as
 * consistent, while the Spanish item counted *paños de plancha* and asked for
 * *cristales* and the Polish counted *płatów blachy* and asked *ile to szyb*.
 * Every gate passed: the mathematics was right, the KaTeX was strict, the key
 * sets matched. The learner was simply asked for a different object than the
 * story had counted, in two languages out of three.
 *
 * So the pairings are exported, and tools/check-context-ask.mjs walks them
 * against a per-locale table of unit nouns and fails the build on a
 * disagreement. `strip` and `bill` are alternative framings of the same
 * situation and are checked against the same question as `ctx`.
 */
export const DECK_PAIRS = Object.entries(DECKS).flatMap(([deckName, entries]) => entries.flatMap((e) => {
  if (typeof e === 'string') return [];
  const asks = Object.entries(e).filter(([, key]) => typeof key === 'string' && key.startsWith('ask.'));
  const scenes = ['ctx', 'strip', 'bill'].map((slot) => e[slot]).filter(Boolean);
  return asks.flatMap(([slot, ask]) => scenes.map((ctx) => ({ deck: deckName, ctx, slot, ask })));
}));

/**
 * THE BANK IS A REGISTRY, NOT A LITERAL.
 *
 * Algebra I Level 1 is registered here, unconditionally, so this module behaves
 * exactly as it always did. Every other course registers a pack of its own
 * through `src/content` and appears in the same two exports. Nothing below this
 * line knows how many courses are loaded. See `src/content/registry.js`.
 */
setFormSummary((f, skill = '') => ({
  id: f.id, rep: f.rep, dMin: f.dMin, dMax: f.dMax,
  skill,
  distinctNums: !!f.distinctNums,
  // Which deck of situations this form is dressed from, and the framings in
  // it. The scheduler reads this to ask "is there a world here this learner
  // has not worked in yet?" without having to generate an item to find out.
  scenes: f.scenes || null,
  sceneKeys: f.sceneKeys || (f.scenes ? DECK_SCENES[f.scenes] || [] : []),
  // What a learner recognises as "this one again". See `skeletonOf`.
  skeleton: skeletonOf({
    ...f, sceneKeys: f.sceneKeys || (f.scenes ? DECK_SCENES[f.scenes] || [] : []),
  }),
  // …and what they are actually DOING, which is coarser than the notation and
  // is the grain the repetition complaint was counted at. See `actOf`.
  act: actOf({
    ...f, sceneKeys: f.sceneKeys || (f.scenes ? DECK_SCENES[f.scenes] || [] : []),
  }, skill),
}));
registerPack({ id: 'algebra1-l1', skills: FORMS });

/** Every skill the loaded courses can generate. Live: a pack extends it. */
export const SKILLS = REGISTERED_SKILLS;
/** Form summaries per skill, for every loaded course. Live. */
export const FORMS_BY_SKILL = REGISTERED_FORMS_BY_SKILL;

export const REPS = ['symbolic', 'context', 'table', 'graph', 'verbal'];

/**
 * THE TOOLKIT A COURSE PACK BUILDS WITH.
 *
 * A pack in `src/content/packs` writes item forms in exactly the shape this
 * file has always used, so it needs the same small tools: the difficulty bands,
 * the draws that respect them, the notation writers, and the array printer.
 * Exporting them is what stops a second course from copying them — two
 * definitions of "band 4" is two difficulty ladders, and `validate-items`
 * measures only one of them.
 *
 * Everything here is pure. A pack cannot reach the deck of situations through
 * it, cannot touch the served-scenes ledger, and cannot skip `finalize` — so a
 * pack can add mathematics but cannot add a way past the content gate.
 */
export const kit = {
  rng, pick, int, nz, nzc, chance, gcd,
  band, Bcoef, Bkonst, Broot, Bval, Pcoef, Pkonst, Proot, Pgroups,
  co, sg, sgc, term, lin, paren, distinct, arrayTex,
  // Level 2 writes rules, rates and rearrangements, so it needs to print an
  // exact rational and a straight line the same way the checker reads them.
  ratio, texLine, statementTex, bandTex, pointTex, ptsTex,
  VARS,
  // A pack draws its own framings through this, never through `pick`, so the
  // situation ledger and the gate's transfer test can see them.
  scene: packScene,
};

/** An exact fraction in lowest terms, as strict KaTeX. "3", "-\frac{3}{4}". */
function ratio(n, d) {
  if (d === 0) throw new Error('retry: a rate with no run');
  return texOf(R(n, d));
}
/** "\left(3, -4\right)" — the one spelling `pointIsOnScreen` looks for. */
function pointTex(x, y) { return `\\left(${x}, ${y}\\right)`; }
/** Two readings, side by side, as they appear in a prompt. */
function ptsTex(p, q) { return `${pointTex(p[0], p[1])} \\quad ${pointTex(q[0], q[1])}`; }

/**
 * Generate one verified item.
 * @param {string} skill
 * @param {number} difficulty 1..5
 * @param {number} seed
 * @param {{locale?:string, form?:string, avoid?:string[], avoidScenes?:string[],
 *          reps?:string[], strict?:boolean}} opts
 */
export function generate(skill, difficulty = 1, seed = Math.floor(Math.random() * 1e9), opts = {}) {
  const all = formsFor(skill);
  if (!all) throw new Error(`No generator for skill "${skill}"`);
  const d = Math.max(1, Math.min(5, difficulty | 0));
  const T = makeT(opts.locale || 'en', { strict: !!opts.strict });

  let pool = all.filter((f) => d >= f.dMin && d <= f.dMax);
  if (opts.form) pool = all.filter((f) => f.id === opts.form);
  else {
    if (opts.reps && opts.reps.length) {
      const p2 = pool.filter((f) => opts.reps.includes(f.rep));
      if (p2.length) pool = p2;
    }
    if (opts.avoid && opts.avoid.length) {
      const p3 = pool.filter((f) => !opts.avoid.includes(f.id));
      if (p3.length) pool = p3;
    }
  }
  if (!pool.length) pool = all.filter((f) => d >= f.dMin && d <= f.dMax);
  if (!pool.length) pool = all;

  let lastErr = null;
  for (let i = 0; i < 120; i++) {
    const s = (seed + i * 7919) >>> 0;
    const r = rng(s);
    // A second, independent stream, used only to choose the situation a form
    // is dressed in. See `deck()`.
    const sr = rng((s ^ 0x5bf03635) >>> 0);
    const form = pool[Math.floor(r() * pool.length)];
    SCENE_LOG = [];
    DRAWN = [];
    // A framing the caller has refused is off the deck entirely, rather than
    // being drawn and then re-rolled: a retry budget can run out, a filter
    // cannot.
    AVOID = new Set((opts.avoidScenes || []).flatMap((s) => String(s).split('+')));
    try {
      const built = finalize(form.build({ r, d, T, skill, sr }), { skill, form, d, seed: s, T });
      built.scene = SCENE_LOG.join('+');
      // Transfer, at the level of the situation. The proving run hands over the
      // framings this learner has already worked inside, and for most of the
      // draw budget the bank refuses to serve one of them again: recognising a
      // skill in a world you have not been trained on is the thing a gate is
      // supposed to prove, and by the time a learner reaches the gate they have
      // usually met every *form* the skill has.
      if (built.scene && i < 90 && (opts.avoidScenes || []).includes(built.scene)) {
        throw new Error('retry: this learner has already worked inside that situation');
      }
      // Only a framing that actually reached a learner counts against the
      // ledger — the dozens drawn inside failed verification attempts never
      // existed, and a caller that is auditioning candidates (`record: false`)
      // says so and reports the survivor itself.
      if (opts.record !== false) for (const key of DRAWN) SERVED.set(key, (SERVED.get(key) || 0) + 1);
      return built;
    } catch (e) {
      lastErr = e;
    }
  }
  throw new Error(`generate(${skill}, d${d}) exhausted 120 seeds: ${lastErr && lastErr.message}`);
}

/** Never throws — falls back to the simplest verified form for the skill. */
export function safeGenerate(skill, difficulty = 1, seed = Math.floor(Math.random() * 1e9), opts = {}) {
  try {
    return generate(skill, difficulty, seed, opts);
  } catch (e) {
    for (let d = difficulty; d >= 1; d--) {
      try { return generate(skill, d, seed + 101, { locale: opts.locale, avoidScenes: opts.avoidScenes, record: opts.record }); } catch { /* keep falling back */ }
    }
    throw e;
  }
}
