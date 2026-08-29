/**
 * Algebra I · Level 2 — the generator pack.
 *
 * Level 1 ends with a balance that stays level. Level 2 is what happens when
 * the balance starts to LEAN, when a formula has to be turned round to give up
 * a different letter, and when one statement is no longer enough to pin a
 * point down. Fourteen skills:
 *
 *   bracket-both-sides      a(x + b) = c(x + d)
 *   fraction-solve          a balance divided rather than multiplied
 *   rule-from-table         a table with no rule written on it
 *   inequality-one-step     a balance that leans, and the move that turns it
 *   inequality-two-step     the same lean, unwrapped in reverse
 *   inequality-multi-step   brackets and unknowns on both sides, still leaning
 *   compound-inequality     two statements at once — a band, not a ray
 *   literal-equations       a formula solved for a different letter
 *   ratio-proportion        two ratios that agree, and the fourth number
 *   slope-rate              rise over run, off points, tables and traces
 *   graph-linear            a rule drawn as a line, and a line read back
 *   write-linear            a rule written down from readings
 *   system-substitution     two statements, one point, one letter at a time
 *   system-elimination      two statements added until one letter leaves
 *
 * IT IS STILL DATA. This file imports one toolkit from `src/learn/generators.js`
 * and three prose bundles from `content/lang/packs/`. It touches no engine file:
 * not the mastery model, not the scheduler, not the session planner, not the
 * report, not the rift surface, not the world, not `src/main.js`.
 *
 * EVERY ITEM GOES THROUGH THE SAME GATE. `finalize` in generators.js re-derives
 * the answer from the displayed notation in exact rational arithmetic, checks
 * every worked line, refuses untagged distractors and refuses a set with fewer
 * than five recognisable errors. The Level 2 mathematics needed six new ways of
 * re-deriving an answer — an inequality, a band, a rearranged formula, a
 * proportion, a pair of statements, and a line — and they live in `verify()`
 * beside the others. A pack can add mathematics. It cannot add a way past the
 * gate.
 *
 * PROSE LIVES UNDER content/lang. Not in this file, and nowhere in src/.
 *
 * WHAT A DRESSED FORM OWES THE SCHEDULER. Every form that draws a situation
 * declares `sceneKeys` — the ctx keys of its own deck. That is not decoration:
 * four mechanisms in `src/learn/mastery.js` read it, and every one of them was
 * reading an empty list for this whole unit because a pack's decks are not in
 * the engine's `DECK_SCENES` table. Measured, that cost the proving run its
 * transfer test (18.6% of claim-bearing runs held an unpractised form or world
 * against Level 1's 95.2%) and left `proseThin()` unable to find a form that
 * carries prose. Both are back on, and the decks are wide enough to feed them:
 * 34 situations became 242, so a 45-item sitting deals 31 distinct ones and
 * repeats none — the figure `npm run check:scenes` measures.
 */
import { kit } from '../../learn/generators.js';
import en from '../../../content/lang/packs/algebra1-l2.en.js';
import es from '../../../content/lang/packs/algebra1-l2.es.js';
import pl from '../../../content/lang/packs/algebra1-l2.pl.js';

const {
  pick, int, nz, nzc, band, Bcoef, Bkonst, Broot, co, sg, lin, paren, distinct,
  arrayTex, ratio, pointTex, ptsTex,
  // Every situation this pack shows is drawn through `scene`, never through
  // `pick`. `pick` chooses; `scene` chooses AND tells the engine what it chose,
  // which is what the session ledger, the analogue and the gate's transfer test
  // all read. Drawing a framing with `pick` leaves `item.scene` empty and turns
  // the proving run back into a rehearsal.
  scene,
} = kit;

/** The letters this unit uses for one unknown. Short, and never `l` or `o`. */
const VARS = ['x', 'n', 'm', 't', 'p'];

// ---------------------------------------------------------------------------
// Relations. One spelling each, everywhere, so an option set never offers the
// same statement twice in two costumes.
// ---------------------------------------------------------------------------
const RELS = ['>', '<', '\\ge', '\\le'];
const FLIP = { '>': '<', '<': '>', '\\ge': '\\le', '\\le': '\\ge' };
/** Swap a strict boundary for a closed one and back. The commonest careless read. */
const EDGE = { '>': '\\ge', '<': '\\le', '\\ge': '>', '\\le': '<' };
/** "x > 5" — the one spelling `verify()` derives and compares against. */
const st = (v, rel, n) => `${v} ${rel} ${n}`;
/** "3x + 5 > 20  =>  ?" — the prompt of every statement-choice item. */
const asks = (mathTex) => `${mathTex} \\;\\Rightarrow\\; \\square`;

// ---------------------------------------------------------------------------
// Situations.
//
// A pack cannot reach the engine's deck of framings, so it keeps its own and
// draws on `sr`, the situation stream, exactly as the deck does: the numbers an
// item asks about never move when the words around them change.
// ---------------------------------------------------------------------------
/** A machine that runs only while a reading holds. */
const LIMITS = [
  { ctx: 'l2.ctx.hoist', set: 'l2.ask.setHoist', least: 'l2.ask.leastHoist', most: 'l2.ask.mostHoist' },
  { ctx: 'l2.ctx.airlock', set: 'l2.ask.setAirlock', least: 'l2.ask.leastAirlock', most: 'l2.ask.mostAirlock' },
  { ctx: 'l2.ctx.kiln', set: 'l2.ask.setKiln', least: 'l2.ask.leastKiln', most: 'l2.ask.mostKiln' },
  { ctx: 'l2.ctx.tether', set: 'l2.ask.setTether', least: 'l2.ask.leastTether', most: 'l2.ask.mostTether' },
  { ctx: 'l2.ctx.thruster', set: 'l2.ask.setThruster', least: 'l2.ask.leastThruster', most: 'l2.ask.mostThruster' },
  // The five above name their own question, because the sentence reads better
  // when it does. The rest share the three general ones — a deck cannot pay
  // for three bespoke questions per world in three languages, and a wide deck
  // is what the proving run needs. See the header of this file.
  { ctx: 'l2.ctx.limCrane', set: 'l2.ask.whichStatement', least: 'l2.ask.leastWhole', most: 'l2.ask.mostWhole' },
  { ctx: 'l2.ctx.limPress', set: 'l2.ask.whichStatement', least: 'l2.ask.leastWhole', most: 'l2.ask.mostWhole' },
  { ctx: 'l2.ctx.limPump', set: 'l2.ask.whichStatement', least: 'l2.ask.leastWhole', most: 'l2.ask.mostWhole' },
  { ctx: 'l2.ctx.limFilter', set: 'l2.ask.whichStatement', least: 'l2.ask.leastWhole', most: 'l2.ask.mostWhole' },
  { ctx: 'l2.ctx.limWeld', set: 'l2.ask.whichStatement', least: 'l2.ask.leastWhole', most: 'l2.ask.mostWhole' },
  { ctx: 'l2.ctx.limBrake', set: 'l2.ask.whichStatement', least: 'l2.ask.leastWhole', most: 'l2.ask.mostWhole' },
  { ctx: 'l2.ctx.limDrone', set: 'l2.ask.whichStatement', least: 'l2.ask.leastWhole', most: 'l2.ask.mostWhole' },
  { ctx: 'l2.ctx.limCoolant', set: 'l2.ask.whichStatement', least: 'l2.ask.leastWhole', most: 'l2.ask.mostWhole' },
  { ctx: 'l2.ctx.limDeck', set: 'l2.ask.whichStatement', least: 'l2.ask.leastWhole', most: 'l2.ask.mostWhole' },
  { ctx: 'l2.ctx.limSluice', set: 'l2.ask.whichStatement', least: 'l2.ask.leastWhole', most: 'l2.ask.mostWhole' },
  { ctx: 'l2.ctx.limForge', set: 'l2.ask.whichStatement', least: 'l2.ask.leastWhole', most: 'l2.ask.mostWhole' },
  { ctx: 'l2.ctx.limSpar', set: 'l2.ask.whichStatement', least: 'l2.ask.leastWhole', most: 'l2.ask.mostWhole' },
  { ctx: 'l2.ctx.limLadder', set: 'l2.ask.whichStatement', least: 'l2.ask.leastWhole', most: 'l2.ask.mostWhole' },
  { ctx: 'l2.ctx.limVent', set: 'l2.ask.whichStatement', least: 'l2.ask.leastWhole', most: 'l2.ask.mostWhole' },
  { ctx: 'l2.ctx.limChain', set: 'l2.ask.whichStatement', least: 'l2.ask.leastWhole', most: 'l2.ask.mostWhole' },
  { ctx: 'l2.ctx.limSolar', set: 'l2.ask.whichStatement', least: 'l2.ask.leastWhole', most: 'l2.ask.mostWhole' },
  { ctx: 'l2.ctx.limKettle', set: 'l2.ask.whichStatement', least: 'l2.ask.leastWhole', most: 'l2.ask.mostWhole' },
  { ctx: 'l2.ctx.limScaffold', set: 'l2.ask.whichStatement', least: 'l2.ask.leastWhole', most: 'l2.ask.mostWhole' },
  { ctx: 'l2.ctx.limBeacon', set: 'l2.ask.whichStatement', least: 'l2.ask.leastWhole', most: 'l2.ask.mostWhole' },
  { ctx: 'l2.ctx.limHatch', set: 'l2.ask.whichStatement', least: 'l2.ask.leastWhole', most: 'l2.ask.mostWhole' },
  { ctx: 'l2.ctx.limMill', set: 'l2.ask.whichStatement', least: 'l2.ask.leastWhole', most: 'l2.ask.mostWhole' },
  { ctx: 'l2.ctx.limRelay', set: 'l2.ask.whichStatement', least: 'l2.ask.leastWhole', most: 'l2.ask.mostWhole' },
  { ctx: 'l2.ctx.limStill', set: 'l2.ask.whichStatement', least: 'l2.ask.leastWhole', most: 'l2.ask.mostWhole' },
  { ctx: 'l2.ctx.limGrapple', set: 'l2.ask.whichStatement', least: 'l2.ask.leastWhole', most: 'l2.ask.mostWhole' },
];
/** A machine that will only run inside a band. */
const BANDS = [
  { ctx: 'l2.ctx.bandGlaze', set: 'l2.ask.setBand', count: 'l2.ask.countBand' },
  { ctx: 'l2.ctx.bandHold', set: 'l2.ask.setBand', count: 'l2.ask.countBand' },
  { ctx: 'l2.ctx.bandSeed', set: 'l2.ask.setBand', count: 'l2.ask.countBand' },
  { ctx: 'l2.ctx.bandTrack', set: 'l2.ask.setBand', count: 'l2.ask.countBand' },
  { ctx: 'l2.ctx.bandKiln2', set: 'l2.ask.setBand', count: 'l2.ask.countBand' },
  { ctx: 'l2.ctx.bandPress', set: 'l2.ask.setBand', count: 'l2.ask.countBand' },
  { ctx: 'l2.ctx.bandVat', set: 'l2.ask.setBand', count: 'l2.ask.countBand' },
  { ctx: 'l2.ctx.bandRotor', set: 'l2.ask.setBand', count: 'l2.ask.countBand' },
  { ctx: 'l2.ctx.bandTank', set: 'l2.ask.setBand', count: 'l2.ask.countBand' },
  { ctx: 'l2.ctx.bandLamp', set: 'l2.ask.setBand', count: 'l2.ask.countBand' },
  { ctx: 'l2.ctx.bandWeld', set: 'l2.ask.setBand', count: 'l2.ask.countBand' },
  { ctx: 'l2.ctx.bandLift', set: 'l2.ask.setBand', count: 'l2.ask.countBand' },
  { ctx: 'l2.ctx.bandBrine', set: 'l2.ask.setBand', count: 'l2.ask.countBand' },
  { ctx: 'l2.ctx.bandRelay', set: 'l2.ask.setBand', count: 'l2.ask.countBand' },
  { ctx: 'l2.ctx.bandGlider', set: 'l2.ask.setBand', count: 'l2.ask.countBand' },
  { ctx: 'l2.ctx.bandForge', set: 'l2.ask.setBand', count: 'l2.ask.countBand' },
  { ctx: 'l2.ctx.bandPump', set: 'l2.ask.setBand', count: 'l2.ask.countBand' },
  { ctx: 'l2.ctx.bandCell', set: 'l2.ask.setBand', count: 'l2.ask.countBand' },
  { ctx: 'l2.ctx.bandNet', set: 'l2.ask.setBand', count: 'l2.ask.countBand' },
  { ctx: 'l2.ctx.bandOven', set: 'l2.ask.setBand', count: 'l2.ask.countBand' },
  { ctx: 'l2.ctx.bandMast', set: 'l2.ask.setBand', count: 'l2.ask.countBand' },
  { ctx: 'l2.ctx.bandFilter', set: 'l2.ask.setBand', count: 'l2.ask.countBand' },
  { ctx: 'l2.ctx.bandCoil', set: 'l2.ask.setBand', count: 'l2.ask.countBand' },
  { ctx: 'l2.ctx.bandStore', set: 'l2.ask.setBand', count: 'l2.ask.countBand' },
];
/** Two quantities that keep the same ratio. */
const RATIOS = [
  { ctx: 'l2.ctx.mix', ask: 'l2.ask.mixHowMany' },
  { ctx: 'l2.ctx.chart', ask: 'l2.ask.chartHowFar' },
  { ctx: 'l2.ctx.alloy', ask: 'l2.ask.alloyHowMuch' },
  { ctx: 'l2.ctx.feed', ask: 'l2.ask.feedHowMany' },
  { ctx: 'l2.ctx.dye', ask: 'l2.ask.dyeHowMuch' },
  { ctx: 'l2.ctx.ratioMortar', ask: 'l2.ask.sameRatioAmount' },
  { ctx: 'l2.ctx.ratioBrass', ask: 'l2.ask.sameRatioAmount' },
  { ctx: 'l2.ctx.ratioInk', ask: 'l2.ask.sameRatioAmount' },
  { ctx: 'l2.ctx.ratioGlaze', ask: 'l2.ask.sameRatioAmount' },
  { ctx: 'l2.ctx.ratioBrine', ask: 'l2.ask.sameRatioAmount' },
  { ctx: 'l2.ctx.ratioSolder', ask: 'l2.ask.sameRatioAmount' },
  { ctx: 'l2.ctx.ratioMap', ask: 'l2.ask.sameRatioAmount' },
  { ctx: 'l2.ctx.ratioModel', ask: 'l2.ask.sameRatioAmount' },
  { ctx: 'l2.ctx.ratioFeedMix', ask: 'l2.ask.sameRatioAmount' },
  { ctx: 'l2.ctx.ratioFuelMix', ask: 'l2.ask.sameRatioAmount' },
  { ctx: 'l2.ctx.ratioConcrete', ask: 'l2.ask.sameRatioAmount' },
  { ctx: 'l2.ctx.ratioTea', ask: 'l2.ask.sameRatioAmount' },
  { ctx: 'l2.ctx.ratioCrew', ask: 'l2.ask.sameRatioAmount' },
  { ctx: 'l2.ctx.ratioSoil', ask: 'l2.ask.sameRatioAmount' },
  { ctx: 'l2.ctx.ratioPaint', ask: 'l2.ask.sameRatioAmount' },
];
/**
 * The situations `rp-model` states its numbers in.
 *
 * A modelling item shows no notation — the whole question is which pair of
 * ratios states the situation — so the three known amounts have to be IN the
 * situation. Every sentence here carries them, and `noDisplay` on the form
 * says out loud that there is nothing else to show. Before this, the card was
 * four empty boxes over a sentence with no numbers in it, and one display
 * carried forty-four different accepted answers.
 */
const MODELS = [
  { ctx: 'l2.ctx.modelResin' },
  { ctx: 'l2.ctx.modelLime' },
  { ctx: 'l2.ctx.modelCopper' },
  { ctx: 'l2.ctx.modelPigment' },
  { ctx: 'l2.ctx.modelGrain' },
  { ctx: 'l2.ctx.modelCement' },
  { ctx: 'l2.ctx.modelSalt' },
  { ctx: 'l2.ctx.modelOats' },
  { ctx: 'l2.ctx.modelSpirit' },
  { ctx: 'l2.ctx.modelAsh' },
  { ctx: 'l2.ctx.modelPeat' },
  { ctx: 'l2.ctx.modelSilver' },
  { ctx: 'l2.ctx.modelLeaf' },
  { ctx: 'l2.ctx.modelColour' },
  { ctx: 'l2.ctx.modelCadet' },
  { ctx: 'l2.ctx.modelWax' },
];
/** Something that changes at a steady rate, read twice. */
const RATES = [
  { ctx: 'l2.ctx.rateWinch', ask: 'l2.ask.ratePerStep' },
  { ctx: 'l2.ctx.rateFrost', ask: 'l2.ask.ratePerStep' },
  { ctx: 'l2.ctx.rateTank', ask: 'l2.ask.ratePerStep' },
  { ctx: 'l2.ctx.rateSled', ask: 'l2.ask.ratePerStep' },
  { ctx: 'l2.ctx.rateKiln', ask: 'l2.ask.ratePerStep' },
  { ctx: 'l2.ctx.rateLift', ask: 'l2.ask.ratePerStep' },
  { ctx: 'l2.ctx.rateDrill', ask: 'l2.ask.ratePerStep' },
  { ctx: 'l2.ctx.rateSnow', ask: 'l2.ask.ratePerStep' },
  { ctx: 'l2.ctx.rateStore', ask: 'l2.ask.ratePerStep' },
  { ctx: 'l2.ctx.rateBuoy', ask: 'l2.ask.ratePerStep' },
  { ctx: 'l2.ctx.rateCharge', ask: 'l2.ask.ratePerStep' },
  { ctx: 'l2.ctx.rateTide', ask: 'l2.ask.ratePerStep' },
  { ctx: 'l2.ctx.rateSpool', ask: 'l2.ask.ratePerStep' },
  { ctx: 'l2.ctx.rateGlacier', ask: 'l2.ask.ratePerStep' },
  { ctx: 'l2.ctx.rateSilo', ask: 'l2.ask.ratePerStep' },
  { ctx: 'l2.ctx.rateCandle', ask: 'l2.ask.ratePerStep' },
  { ctx: 'l2.ctx.rateRust', ask: 'l2.ask.ratePerStep' },
  { ctx: 'l2.ctx.rateBelt', ask: 'l2.ask.ratePerStep' },
  { ctx: 'l2.ctx.rateSap', ask: 'l2.ask.ratePerStep' },
  { ctx: 'l2.ctx.rateDust', ask: 'l2.ask.ratePerStep' },
  { ctx: 'l2.ctx.rateWell', ask: 'l2.ask.ratePerStep' },
  { ctx: 'l2.ctx.rateCable', ask: 'l2.ask.ratePerStep' },
  { ctx: 'l2.ctx.rateSaw', ask: 'l2.ask.ratePerStep' },
  { ctx: 'l2.ctx.rateVault', ask: 'l2.ask.ratePerStep' },
  { ctx: 'l2.ctx.rateWax', ask: 'l2.ask.ratePerStep' },
];
/** A rule to be written down, or drawn. */
const RULES = [
  { ctx: 'l2.ctx.ruleLift', write: 'l2.ask.writeRule', draw: 'l2.ask.drawRule' },
  { ctx: 'l2.ctx.ruleDrift', write: 'l2.ask.writeRule', draw: 'l2.ask.drawRule' },
  { ctx: 'l2.ctx.ruleStack', write: 'l2.ask.writeRule', draw: 'l2.ask.drawRule' },
  { ctx: 'l2.ctx.ruleBrine', write: 'l2.ask.writeRule', draw: 'l2.ask.drawRule' },
  { ctx: 'l2.ctx.ruleCrane', write: 'l2.ask.writeRule', draw: 'l2.ask.drawRule' },
  { ctx: 'l2.ctx.ruleSilo', write: 'l2.ask.writeRule', draw: 'l2.ask.drawRule' },
  { ctx: 'l2.ctx.ruleDrill', write: 'l2.ask.writeRule', draw: 'l2.ask.drawRule' },
  { ctx: 'l2.ctx.ruleCredit', write: 'l2.ask.writeRule', draw: 'l2.ask.drawRule' },
  { ctx: 'l2.ctx.ruleReef', write: 'l2.ask.writeRule', draw: 'l2.ask.drawRule' },
  { ctx: 'l2.ctx.ruleSnowline', write: 'l2.ask.writeRule', draw: 'l2.ask.drawRule' },
  { ctx: 'l2.ctx.ruleSpoil', write: 'l2.ask.writeRule', draw: 'l2.ask.drawRule' },
  { ctx: 'l2.ctx.ruleSail', write: 'l2.ask.writeRule', draw: 'l2.ask.drawRule' },
  { ctx: 'l2.ctx.ruleWard', write: 'l2.ask.writeRule', draw: 'l2.ask.drawRule' },
  { ctx: 'l2.ctx.ruleTrench', write: 'l2.ask.writeRule', draw: 'l2.ask.drawRule' },
  { ctx: 'l2.ctx.ruleKilnRule', write: 'l2.ask.writeRule', draw: 'l2.ask.drawRule' },
  { ctx: 'l2.ctx.ruleOrchard', write: 'l2.ask.writeRule', draw: 'l2.ask.drawRule' },
  { ctx: 'l2.ctx.ruleRoad', write: 'l2.ask.writeRule', draw: 'l2.ask.drawRule' },
  { ctx: 'l2.ctx.ruleWater', write: 'l2.ask.writeRule', draw: 'l2.ask.drawRule' },
  { ctx: 'l2.ctx.ruleFleet', write: 'l2.ask.writeRule', draw: 'l2.ask.drawRule' },
  { ctx: 'l2.ctx.ruleMast', write: 'l2.ask.writeRule', draw: 'l2.ask.drawRule' },
  { ctx: 'l2.ctx.ruleArchive', write: 'l2.ask.writeRule', draw: 'l2.ask.drawRule' },
  { ctx: 'l2.ctx.ruleGlass', write: 'l2.ask.writeRule', draw: 'l2.ask.drawRule' },
  { ctx: 'l2.ctx.ruleWall', write: 'l2.ask.writeRule', draw: 'l2.ask.drawRule' },
  { ctx: 'l2.ctx.ruleFund', write: 'l2.ask.writeRule', draw: 'l2.ask.drawRule' },
];
/** Two groupings packed the same way. */
const HOLDS = [
  { ctx: 'l2.ctx.twoHolds', ask: 'l2.ask.holdMass' },
  { ctx: 'l2.ctx.twoBays', ask: 'l2.ask.holdMass' },
  { ctx: 'l2.ctx.holdPallets', ask: 'l2.ask.holdMass' },
  { ctx: 'l2.ctx.holdCrates', ask: 'l2.ask.holdMass' },
  { ctx: 'l2.ctx.holdTanks', ask: 'l2.ask.holdMass' },
  { ctx: 'l2.ctx.holdBays', ask: 'l2.ask.holdMass' },
  { ctx: 'l2.ctx.holdRacks', ask: 'l2.ask.holdMass' },
  { ctx: 'l2.ctx.holdSpools', ask: 'l2.ask.holdMass' },
  { ctx: 'l2.ctx.holdKilns', ask: 'l2.ask.holdMass' },
  { ctx: 'l2.ctx.holdBins', ask: 'l2.ask.holdMass' },
  { ctx: 'l2.ctx.holdWings', ask: 'l2.ask.holdMass' },
  { ctx: 'l2.ctx.holdSleds', ask: 'l2.ask.holdMass' },
  { ctx: 'l2.ctx.holdVats', ask: 'l2.ask.holdMass' },
  { ctx: 'l2.ctx.holdBeds', ask: 'l2.ask.holdMass' },
  { ctx: 'l2.ctx.holdBanks', ask: 'l2.ask.holdMass' },
  { ctx: 'l2.ctx.holdHoppers', ask: 'l2.ask.holdMass' },
  { ctx: 'l2.ctx.holdChests', ask: 'l2.ask.holdMass' },
  { ctx: 'l2.ctx.holdRolls', ask: 'l2.ask.holdMass' },
  { ctx: 'l2.ctx.holdCarts', ask: 'l2.ask.holdMass' },
  { ctx: 'l2.ctx.holdWells', ask: 'l2.ask.holdMass' },
  { ctx: 'l2.ctx.holdRuns', ask: 'l2.ask.holdMass' },
  { ctx: 'l2.ctx.holdLofts', ask: 'l2.ask.holdMass' },
];
/**
 * Spare stock added to a run, and the whole lot then split into equal parts.
 *
 * The situation used to read "a crew shares one delivery into equal loads"
 * and the question read "find $v$, the size of one load" — over
 * `(v + b)/k = c`, where one load is `c` and is already printed. The letter
 * the learner is sent after is what the run STARTED with, so that is what the
 * sentence says now.
 */
const SHARES = [
  { ctx: 'l2.ctx.shareRun', ask: 'l2.ask.startAmount' },
  { ctx: 'l2.ctx.shareCable', ask: 'l2.ask.startAmount' },
  { ctx: 'l2.ctx.shareWater', ask: 'l2.ask.startAmount' },
  { ctx: 'l2.ctx.shareOre', ask: 'l2.ask.startAmount' },
  { ctx: 'l2.ctx.shareSeed', ask: 'l2.ask.startAmount' },
  { ctx: 'l2.ctx.shareFuel', ask: 'l2.ask.startAmount' },
  { ctx: 'l2.ctx.shareRope', ask: 'l2.ask.startAmount' },
  { ctx: 'l2.ctx.shareGrain', ask: 'l2.ask.startAmount' },
  { ctx: 'l2.ctx.shareSalt', ask: 'l2.ask.startAmount' },
  { ctx: 'l2.ctx.shareWax', ask: 'l2.ask.startAmount' },
  { ctx: 'l2.ctx.shareCanvas', ask: 'l2.ask.startAmount' },
  { ctx: 'l2.ctx.shareDose', ask: 'l2.ask.startAmount' },
  { ctx: 'l2.ctx.shareCharge', ask: 'l2.ask.startAmount' },
  { ctx: 'l2.ctx.sharePaint', ask: 'l2.ask.startAmount' },
  { ctx: 'l2.ctx.shareIce', ask: 'l2.ask.startAmount' },
  { ctx: 'l2.ctx.shareTape', ask: 'l2.ask.startAmount' },
  { ctx: 'l2.ctx.shareClay', ask: 'l2.ask.startAmount' },
  { ctx: 'l2.ctx.shareTimber', ask: 'l2.ask.startAmount' },
  { ctx: 'l2.ctx.shareThread', ask: 'l2.ask.startAmount' },
  { ctx: 'l2.ctx.shareSand', ask: 'l2.ask.startAmount' },
];
/** A log that obeys a rule nobody wrote down. */
const GAUGES = [
  { ctx: 'l2.ctx.gauge' },
  { ctx: 'l2.ctx.gaugeLog' },
  { ctx: 'l2.ctx.gaugeDial' },
  { ctx: 'l2.ctx.gaugeTide' },
  { ctx: 'l2.ctx.gaugeFuel' },
  { ctx: 'l2.ctx.gaugeDepth' },
  { ctx: 'l2.ctx.gaugeHeat' },
  { ctx: 'l2.ctx.gaugeYield' },
  { ctx: 'l2.ctx.gaugeSalt' },
  { ctx: 'l2.ctx.gaugeWind' },
  { ctx: 'l2.ctx.gaugeSpin' },
  { ctx: 'l2.ctx.gaugeDose' },
  { ctx: 'l2.ctx.gaugeLoad' },
  { ctx: 'l2.ctx.gaugePower' },
  { ctx: 'l2.ctx.gaugeFrost' },
  { ctx: 'l2.ctx.gaugeSpool' },
  { ctx: 'l2.ctx.gaugeStock' },
  { ctx: 'l2.ctx.gaugeSignal' },
  { ctx: 'l2.ctx.gaugeGrain' },
  { ctx: 'l2.ctx.gaugeAir' },
  { ctx: 'l2.ctx.gaugeSpeed' },
  { ctx: 'l2.ctx.gaugeIce' },
  { ctx: 'l2.ctx.gaugeWater' },
  { ctx: 'l2.ctx.gaugeTally' },
  { ctx: 'l2.ctx.gaugeRelay' },
];

/**
 * Two conditions that hold at once.
 *
 * EVERY SENTENCE HERE BINDS ITS LETTERS. `x = 5` and `y = 2` are both on the
 * card of a system item, so a situation that names two things and never says
 * which letter counts which leaves the learner to guess which number the
 * question wants. The first four name their own question as well; the rest
 * use the two general ones.
 */
const PAIRS = [
  { ctx: 'l2.ctx.pairCrates', x: 'l2.ask.pairHowManyLight', y: 'l2.ask.pairHowManyHeavy' },
  { ctx: 'l2.ctx.pairTickets', x: 'l2.ask.pairHowManyCadet', y: 'l2.ask.pairHowManyCrew' },
  { ctx: 'l2.ctx.pairAlloys', x: 'l2.ask.pairHowManyTin', y: 'l2.ask.pairHowManyLead' },
  { ctx: 'l2.ctx.pairRuns', x: 'l2.ask.pairHowManyShort', y: 'l2.ask.pairHowManyLong' },
  { ctx: 'l2.ctx.pairSacks', x: 'l2.ask.findX', y: 'l2.ask.findY' },
  { ctx: 'l2.ctx.pairLamps', x: 'l2.ask.findX', y: 'l2.ask.findY' },
  { ctx: 'l2.ctx.pairPanes', x: 'l2.ask.findX', y: 'l2.ask.findY' },
  { ctx: 'l2.ctx.pairSeeds', x: 'l2.ask.findX', y: 'l2.ask.findY' },
  { ctx: 'l2.ctx.pairDrums', x: 'l2.ask.findX', y: 'l2.ask.findY' },
  { ctx: 'l2.ctx.pairPlates', x: 'l2.ask.findX', y: 'l2.ask.findY' },
  { ctx: 'l2.ctx.pairCores', x: 'l2.ask.findX', y: 'l2.ask.findY' },
  { ctx: 'l2.ctx.pairSleds', x: 'l2.ask.findX', y: 'l2.ask.findY' },
  { ctx: 'l2.ctx.pairSpools', x: 'l2.ask.findX', y: 'l2.ask.findY' },
  { ctx: 'l2.ctx.pairCans', x: 'l2.ask.findX', y: 'l2.ask.findY' },
  { ctx: 'l2.ctx.pairBricks', x: 'l2.ask.findX', y: 'l2.ask.findY' },
  { ctx: 'l2.ctx.pairFlares', x: 'l2.ask.findX', y: 'l2.ask.findY' },
  { ctx: 'l2.ctx.pairRolls', x: 'l2.ask.findX', y: 'l2.ask.findY' },
  { ctx: 'l2.ctx.pairCells', x: 'l2.ask.findX', y: 'l2.ask.findY' },
  { ctx: 'l2.ctx.pairDoses', x: 'l2.ask.findX', y: 'l2.ask.findY' },
  { ctx: 'l2.ctx.pairBuoys', x: 'l2.ask.findX', y: 'l2.ask.findY' },
  { ctx: 'l2.ctx.pairStakes', x: 'l2.ask.findX', y: 'l2.ask.findY' },
  { ctx: 'l2.ctx.pairKilns', x: 'l2.ask.findX', y: 'l2.ask.findY' },
  { ctx: 'l2.ctx.pairSpars', x: 'l2.ask.findX', y: 'l2.ask.findY' },
  { ctx: 'l2.ctx.pairPumps', x: 'l2.ask.findX', y: 'l2.ask.findY' },
];

/**
 * The ctx keys of one deck, for a form to declare as its `sceneKeys`.
 *
 * WHY A FORM HAS TO SAY THIS OUT LOUD. `sceneKeys` is how the scheduler asks
 * "is there a world in this form the learner has never worked inside?" without
 * generating an item to find out — and it is read in four places: the proving
 * run's novelty test, the sounding's, and the two `proseThin()` rules that
 * pull a dressed form to the front when the last two items carried no prose.
 * A core-bank form gets it from `scenes: '<deck>'`, which resolves through
 * `DECK_SCENES` — a table of the ENGINE's decks, which a pack's decks are not
 * in. So every dressed form in this pack declared no scene keys at all, all
 * four mechanisms read an empty list, and the gate could only ever be a
 * transfer test by serving a form the learner had never practised. Measured:
 * 18.6% of Level 2's claim-bearing runs held an unpractised form or world
 * against Level 1's 95.2%.
 */
/**
 * TWO READINGS, BOTH PRINTED.
 *
 * `rft-dispute` and `im-dispute` used to read "Which cadet read $y$ correctly?"
 * over a card that named neither cadet's answer. `check:determinate` measures
 * exactly that — a stem that asks which of several answers is right while the
 * card names none of them — and found 1,449 of them on the shipped route.
 * Level 1's four disputes have always done it honestly: the situation prints
 * BOTH readings, so "which reading is the true one" has something to point at.
 * These do now too, and the question is the core bank's own `ask.whichIsRight`.
 */
const DISPUTES = [
  { ctx: 'l2.ctx.dispChalk' },
  { ctx: 'l2.ctx.dispLog' },
  { ctx: 'l2.ctx.dispRadio' },
  { ctx: 'l2.ctx.dispSlate' },
  { ctx: 'l2.ctx.dispWatch' },
  { ctx: 'l2.ctx.dispQuarrel' },
  { ctx: 'l2.ctx.dispAudit' },
  { ctx: 'l2.ctx.dispWager' },
  { ctx: 'l2.ctx.dispBridge' },
  { ctx: 'l2.ctx.dispPost' },
  { ctx: 'l2.ctx.dispDrill' },
  { ctx: 'l2.ctx.dispInk' },
];

/**
 * THE FRAMINGS THAT DO NOT PROMISE ONE OF THE TWO IS RIGHT.
 *
 * `quoteReadings` draws the two readings a dispute quotes out of the ones the
 * card really shows, so on a four-option card the key is one of them half the
 * time and on a free keypad it is never one of them. Ten of the twelve
 * framings above stay true either way — "One cadet chalks A. Another chalks
 * B." is a report, and "Two cadets cannot both be right" is still a fact when
 * neither of them is. Two of them are not reports but PROMISES:
 * `dispAudit` ("The audit takes one reading: A or B") and `dispTags` ("The rig
 * accepts exactly one") both assert that one of the two quoted readings is the
 * one to file, and that is a sentence the card can no longer keep. They are
 * left out of the two dispute forms and stay available to anything that really
 * does put the answer in the sentence.
 */
const DISPUTES_OPEN = DISPUTES.filter((e) => !/dispAudit|dispTags/.test(e.ctx));

const KEYS = (deck) => deck.map((e) => (typeof e === 'string' ? e : e.ctx));

// ===========================================================================
// inequality-one-step  —  x + b REL c   and   ax REL c
// ===========================================================================
/** A one-step lean with a whole-number boundary. */
function drawLean(r, d) {
  const v = pick(r, VARS);
  const rel = pick(r, RELS);
  const x = Broot(r, d);
  return { v, rel, x };
}

const inequalityOneStep = [
  {
    id: 'i1-add', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const { v, rel, x } = drawLean(r, d);
      const b = Bkonst(r, d);
      const c = x + b;
      if (!distinct(b, c, x)) throw new Error('retry: repeated number');
      const math = `${lin(1, v, b)} ${rel} ${c}`;
      return {
        stem: T('l2.ask.whichStatement', { v }),
        latex: asks(math),
        type: 'expression',
        answer: st(v, rel, x),
        check: { kind: 'inequality', math, variable: v },
        steps: [
          { latex: `${v} ${rel} ${c} ${sg(-b)}`, why: T(b > 0 ? 'l2.why.takeOffBothSides' : 'l2.why.addToBothSides', { n: Math.abs(b) }) },
          { latex: st(v, rel, x), why: T('l2.why.leanUnchanged') },
        ],
        distractors: [
          { v: st(v, FLIP[rel], x), m: 'flip-always' },
          { v: st(v, rel, c + b), m: 'sign-on-constant' },
          { v: st(v, rel, b - c), m: 'sign-slip' },
          { v: st(v, EDGE[rel], x), m: 'boundary-slip' },
          { v: st(v, rel, x + 1), m: 'arith-slip' },
          { v: st(v, rel, x - 1), m: 'arith-slip' },
          { v: st(v, FLIP[rel], c + b), m: 'flip-always' },
        ],
      };
    },
  },
  {
    id: 'i1-mul', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const { v, rel, x } = drawLean(r, d);
      const a = d >= 3 ? Bcoef(r, d) : int(r, 2, 3 + d);
      const c = a * x;
      if (Math.abs(a) < 2 || x === 0) throw new Error('retry: nothing to undo');
      if (!distinct(a, c, x)) throw new Error('retry: repeated number');
      const out = a < 0 ? FLIP[rel] : rel;
      const math = `${co(a, v)} ${rel} ${c}`;
      return {
        stem: T('l2.ask.whichStatement', { v }),
        latex: asks(math),
        type: 'expression',
        answer: st(v, out, x),
        check: { kind: 'inequality', math, variable: v },
        steps: [
          {
            latex: `\\frac{${co(a, v)}}{${a}} ${out} \\frac{${c}}{${a}}`,
            why: T(a < 0 ? 'l2.why.divideByNegativeTurns' : 'why.divideBothByCoef', { a }),
          },
          { latex: st(v, out, x), why: T('why.whatIsLeft') },
        ],
        distractors: [
          { v: st(v, rel, x), m: a < 0 ? 'flip-not-needed' : 'flip-always' },
          { v: st(v, out, c - a), m: 'same-op-both' },
          { v: st(v, out, -x), m: 'sign-slip' },
          { v: st(v, EDGE[out], x), m: 'boundary-slip' },
          { v: st(v, out, x + 1), m: 'arith-slip' },
          { v: st(v, out, x - 1), m: 'arith-slip' },
          { v: st(v, FLIP[out], -x), m: 'flip-always' },
        ],
      };
    },
  },
  {
    id: 'i1-edge', rep: 'symbolic', dMin: 2, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const up = r() < 0.5;
      const rel = up ? pick(r, ['>', '\\ge']) : pick(r, ['<', '\\le']);
      const a = int(r, 2, 2 + 3 * d);
      // A boundary that is NOT whole is the whole point: the first reading that
      // works is a second thought, not a copy of the line above.
      const c = a * int(r, 1, 2 + 3 * d) + int(r, 1, a - 1);
      if (c % a === 0) throw new Error('retry: a whole boundary hides the last step');
      if (!distinct(a, c)) throw new Error('retry: repeated number');
      const q = c / a;
      const ans = up ? Math.ceil(q) : Math.floor(q);
      const math = `${co(a, v)} ${rel} ${c}`;
      return {
        stem: T(up ? 'l2.ask.leastWhole' : 'l2.ask.mostWhole', { v }),
        latex: math,
        type: 'numeric',
        answer: String(ans),
        check: { kind: 'inequality', math, variable: v, want: up ? 'least' : 'greatest' },
        steps: [
          { latex: `${v} ${rel} \\frac{${c}}{${a}}`, why: T('why.divideBothByCoef', { a }) },
          { latex: st(v, rel, ratio(c, a)), why: T('l2.why.boundaryNotWhole') },
          { latex: `${ans} ${rel} ${ratio(c, a)}`, why: T(up ? 'l2.why.firstWholePast' : 'l2.why.lastWholeBefore') },
        ],
        distractors: [
          { v: String(up ? Math.floor(q) : Math.ceil(q)), m: 'boundary-slip' },
          { v: String(c - a), m: 'same-op-both' },
          { v: String(ans + 1), m: 'arith-slip' },
          { v: String(ans - 1), m: 'arith-slip' },
          { v: String(c), m: 'partial-rule' },
          { v: String(a), m: 'partial-rule' },
          { v: String(-ans), m: 'sign-slip' },
        ],
      };
    },
  },
  {
    id: 'i1-context', rep: 'context', dMin: 1, dMax: 5, distinctNums: true,
    sceneKeys: KEYS(LIMITS),
    build({ r, d, T, sr }) {
      const sc = scene(sr, LIMITS);
      const v = pick(r, VARS);
      const rel = pick(r, RELS);
      const a = int(r, 2, 2 + 3 * d);
      const x = int(r, 2, 3 + 3 * d);
      const c = a * x;
      if (!distinct(a, c, x)) throw new Error('retry: repeated number');
      const math = `${co(a, v)} ${rel} ${c}`;
      return {
        stem: `${T(sc.ctx)} ${T(sc.set, { v })}`,
        latex: asks(math),
        type: 'expression',
        answer: st(v, rel, x),
        check: { kind: 'inequality', math, variable: v },
        steps: [
          { latex: `\\frac{${co(a, v)}}{${a}} ${rel} \\frac{${c}}{${a}}`, why: T('why.divideBothByCoef', { a }) },
          { latex: st(v, rel, x), why: T('why.whatIsLeft') },
        ],
        distractors: [
          { v: st(v, FLIP[rel], x), m: 'flip-always' },
          { v: st(v, rel, c - a), m: 'same-op-both' },
          { v: st(v, EDGE[rel], x), m: 'boundary-slip' },
          { v: st(v, rel, x + 1), m: 'arith-slip' },
          { v: st(v, rel, x - 1), m: 'arith-slip' },
          { v: st(v, rel, c), m: 'partial-rule' },
          { v: st(v, FLIP[rel], c - a), m: 'flip-always' },
        ],
      };
    },
  },
];

// ===========================================================================
// inequality-two-step  —  ax + b REL c
// ===========================================================================
function drawTwoStepLean(r, d, { forceNeg = false } = {}) {
  const v = pick(r, VARS);
  const rel = pick(r, RELS);
  const x = Broot(r, d);
  const a = forceNeg ? -Math.abs(nzc(r, 2, 3 + d)) : (d >= 3 ? Bcoef(r, d) : int(r, 2, 3 + d));
  if (Math.abs(a) < 2) throw new Error('retry: nothing to divide by');
  const b = Bkonst(r, d);
  const c = a * x + b;
  if (!distinct(a, b, c, x)) throw new Error('retry: repeated number');
  return { v, rel, x, a, b, c, out: a < 0 ? FLIP[rel] : rel };
}

/** The two moves every two-step lean is made of, as worked lines. */
function leanSteps(T, { v, rel, x, a, b, c, out }) {
  return [
    { latex: `${co(a, v)} ${rel} ${c} ${sg(-b)}`, why: T(b > 0 ? 'l2.why.takeOffBothSides' : 'l2.why.addToBothSides', { n: Math.abs(b) }) },
    { latex: `${co(a, v)} ${rel} ${c - b}`, why: T('why.whatIsLeft') },
    {
      latex: st(v, out, ratio(c - b, a)),
      why: T(a < 0 ? 'l2.why.divideByNegativeTurns' : 'why.divideBothByCoef', { a }),
    },
    { latex: st(v, out, x), why: T('l2.why.leanNowRead') },
  ];
}

/** The wrong statements a two-step lean can actually produce. */
function leanWrong({ v, rel, x, a, b, c, out }) {
  return [
    { v: st(v, rel, x), m: a < 0 ? 'flip-not-needed' : 'flip-always' },
    { v: st(v, out, ratio(c + b, a)), m: 'sign-on-constant' },
    { v: st(v, out, ratio(c, a) === ratio(c - b, a) ? c : c - a), m: 'partial-rule' },
    { v: st(v, EDGE[out], x), m: 'boundary-slip' },
    { v: st(v, out, -x), m: 'sign-slip' },
    { v: st(v, out, x + 1), m: 'arith-slip' },
    { v: st(v, out, x - 1), m: 'arith-slip' },
    { v: st(v, FLIP[out], x), m: 'flip-always' },
  ];
}

const inequalityTwoStep = [
  {
    id: 'i2-symbolic', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const s = drawTwoStepLean(r, d);
      const math = `${lin(s.a, s.v, s.b)} ${s.rel} ${s.c}`;
      return {
        stem: T('l2.ask.whichStatement', { v: s.v }),
        latex: asks(math),
        type: 'expression',
        answer: st(s.v, s.out, s.x),
        check: { kind: 'inequality', math, variable: s.v },
        steps: leanSteps(T, s),
        distractors: leanWrong(s),
      };
    },
  },
  {
    id: 'i2-turn', rep: 'symbolic', dMin: 3, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const s = drawTwoStepLean(r, d, { forceNeg: true });
      const math = `${lin(s.a, s.v, s.b)} ${s.rel} ${s.c}`;
      return {
        stem: T('l2.ask.whichStatement', { v: s.v }),
        latex: asks(math),
        type: 'expression',
        answer: st(s.v, s.out, s.x),
        check: { kind: 'inequality', math, variable: s.v },
        steps: leanSteps(T, s),
        distractors: leanWrong(s),
      };
    },
  },
  {
    id: 'i2-edge', rep: 'symbolic', dMin: 2, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const up = r() < 0.5;
      const rel = up ? pick(r, ['>', '\\ge']) : pick(r, ['<', '\\le']);
      const a = int(r, 2, 3 + d);
      const b = Bkonst(r, d);
      const c = a * int(r, 1, 3 + d) + int(r, 1, a - 1) + b;
      if ((c - b) % a === 0) throw new Error('retry: a whole boundary hides the last step');
      if (!distinct(a, b, c)) throw new Error('retry: repeated number');
      const q = (c - b) / a;
      const ans = up ? Math.ceil(q) : Math.floor(q);
      const math = `${lin(a, v, b)} ${rel} ${c}`;
      return {
        stem: T(up ? 'l2.ask.leastWhole' : 'l2.ask.mostWhole', { v }),
        latex: math,
        type: 'numeric',
        answer: String(ans),
        check: { kind: 'inequality', math, variable: v, want: up ? 'least' : 'greatest' },
        steps: [
          { latex: `${co(a, v)} ${rel} ${c - b}`, why: T(b > 0 ? 'l2.why.takeOffBothSides' : 'l2.why.addToBothSides', { n: Math.abs(b) }) },
          { latex: st(v, rel, ratio(c - b, a)), why: T('why.divideBothByCoef', { a }) },
          { latex: `${ans} ${rel} ${ratio(c - b, a)}`, why: T(up ? 'l2.why.firstWholePast' : 'l2.why.lastWholeBefore') },
        ],
        distractors: [
          { v: String(up ? Math.floor(q) : Math.ceil(q)), m: 'boundary-slip' },
          { v: String(Math.round((c + b) / a)), m: 'sign-on-constant' },
          { v: String(c - b), m: 'partial-rule' },
          { v: String(ans + 1), m: 'arith-slip' },
          { v: String(ans - 1), m: 'arith-slip' },
          { v: String(-ans), m: 'sign-slip' },
          { v: String(c), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    // The question a real limit actually asks: not "which statement", but
    // "what is the most I can load?".
    id: 'i2-limit', rep: 'context', dMin: 2, dMax: 5, distinctNums: true,
    sceneKeys: KEYS(LIMITS),
    build({ r, d, T, sr }) {
      const sc = scene(sr, LIMITS);
      const v = pick(r, VARS);
      const up = r() < 0.5;
      const rel = up ? pick(r, ['>', '\\ge']) : pick(r, ['<', '\\le']);
      const a = int(r, 2, 2 + 2 * d);
      const b = int(r, 2, 4 + 2 * d);
      const c = a * int(r, 2, 2 + 2 * d) + int(r, 1, a - 1) + b;
      if ((c - b) % a === 0) throw new Error('retry: a whole boundary hides the last step');
      if (!distinct(a, b, c)) throw new Error('retry: repeated number');
      const q = (c - b) / a;
      const ans = up ? Math.ceil(q) : Math.floor(q);
      const math = `${lin(a, v, b)} ${rel} ${c}`;
      return {
        stem: `${T(sc.ctx)} ${T(up ? sc.least : sc.most, { v })}`,
        latex: math,
        type: 'numeric',
        answer: String(ans),
        check: { kind: 'inequality', math, variable: v, want: up ? 'least' : 'greatest' },
        steps: [
          { latex: `${co(a, v)} ${rel} ${c - b}`, why: T('l2.why.takeOffBothSides', { n: b }) },
          { latex: st(v, rel, ratio(c - b, a)), why: T('why.divideBothByCoef', { a }) },
          { latex: `${ans} ${rel} ${ratio(c - b, a)}`, why: T(up ? 'l2.why.firstWholePast' : 'l2.why.lastWholeBefore') },
        ],
        distractors: [
          { v: String(up ? Math.floor(q) : Math.ceil(q)), m: 'boundary-slip' },
          { v: String(c - b), m: 'partial-rule' },
          { v: String(ans + 1), m: 'arith-slip' },
          { v: String(ans - 1), m: 'arith-slip' },
          { v: String(c), m: 'partial-rule' },
          { v: String(-ans), m: 'sign-slip' },
          { v: String(a), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'i2-context', rep: 'context', dMin: 1, dMax: 5, distinctNums: true,
    sceneKeys: KEYS(LIMITS),
    build({ r, d, T, sr }) {
      const sc = scene(sr, LIMITS);
      const v = pick(r, VARS);
      const rel = pick(r, RELS);
      const a = int(r, 2, 2 + 2 * d);
      const b = int(r, 2, 4 + 2 * d);
      const x = int(r, 2, 3 + 2 * d);
      const c = a * x + b;
      if (!distinct(a, b, c, x)) throw new Error('retry: repeated number');
      const math = `${lin(a, v, b)} ${rel} ${c}`;
      return {
        stem: `${T(sc.ctx)} ${T(sc.set, { v })}`,
        latex: asks(math),
        type: 'expression',
        answer: st(v, rel, x),
        check: { kind: 'inequality', math, variable: v },
        steps: [
          { latex: `${co(a, v)} ${rel} ${c - b}`, why: T('l2.why.takeOffBothSides', { n: b }) },
          { latex: st(v, rel, x), why: T('why.divideBothByCoef', { a }) },
        ],
        distractors: [
          { v: st(v, FLIP[rel], x), m: 'flip-always' },
          { v: st(v, rel, ratio(c + b, a)), m: 'sign-on-constant' },
          { v: st(v, rel, c - b), m: 'partial-rule' },
          { v: st(v, EDGE[rel], x), m: 'boundary-slip' },
          { v: st(v, rel, x + 1), m: 'arith-slip' },
          { v: st(v, rel, x - 1), m: 'arith-slip' },
          { v: st(v, rel, -x), m: 'sign-slip' },
        ],
      };
    },
  },
];

// ===========================================================================
// inequality-multi-step  —  a(x + b) REL c   and   ax + b REL cx + e
// ===========================================================================
const inequalityMultiStep = [
  {
    id: 'im-bracket', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const rel = pick(r, RELS);
      const a = d >= 3 ? nzc(r, -(1 + d), 1 + d) : int(r, 2, 2 + d);
      if (Math.abs(a) < 2) throw new Error('retry: an empty factor');
      const b = d >= 2 ? nz(r, -(2 + d), 2 + d) : int(r, 1, 5);
      const x = d >= 3 ? nz(r, -(1 + d), 1 + d) : int(r, 1, 2 + d);
      const c = a * (x + b);
      if (!distinct(a, b, c, x)) throw new Error('retry: repeated number');
      const out = a < 0 ? FLIP[rel] : rel;
      const math = `${paren(a, lin(1, v, b))} ${rel} ${c}`;
      return {
        stem: T('l2.ask.whichStatement', { v }),
        latex: asks(math),
        type: 'expression',
        answer: st(v, out, x),
        check: { kind: 'inequality', math, variable: v },
        steps: [
          { latex: `${lin(a, v, a * b)} ${rel} ${c}`, why: T('why.everyTermInside') },
          { latex: `${co(a, v)} ${rel} ${c - a * b}`, why: T(a * b > 0 ? 'l2.why.takeOffBothSides' : 'l2.why.addToBothSides', { n: Math.abs(a * b) }) },
          { latex: st(v, out, x), why: T(a < 0 ? 'l2.why.divideByNegativeTurns' : 'why.divideBothByCoef', { a }) },
        ],
        distractors: [
          { v: st(v, rel, x), m: a < 0 ? 'flip-not-needed' : 'flip-always' },
          { v: st(v, out, ratio(c, a) - b), m: 'partial-distribute' },
          { v: st(v, out, ratio(c - b, a)), m: 'partial-distribute' },
          { v: st(v, EDGE[out], x), m: 'boundary-slip' },
          { v: st(v, out, -x), m: 'sign-slip' },
          { v: st(v, out, x + 1), m: 'arith-slip' },
          { v: st(v, out, x - 1), m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'im-bothsides', rep: 'symbolic', dMin: 2, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const rel = pick(r, RELS);
      const a = int(r, 2, 3 + d);
      const cc = d >= 3 ? nzc(r, -(3 + d), a - 1) : int(r, 1, a - 1);
      if (cc === a || Math.abs(cc) < 1) throw new Error('retry: the unknown cancels');
      const gap = a - cc;
      const b = Bkonst(r, d);
      const x = Broot(r, d);
      const e = gap * x + b;
      if (!distinct(a, b, cc, e, x)) throw new Error('retry: repeated number');
      const math = `${lin(a, v, b)} ${rel} ${lin(cc, v, e)}`;
      // Gathering on the left leaves a POSITIVE coefficient, so this form never
      // turns the lean: it is the one that teaches that gathering is a choice.
      return {
        stem: T('l2.ask.whichStatement', { v }),
        latex: asks(math),
        type: 'expression',
        answer: st(v, rel, x),
        check: { kind: 'inequality', math, variable: v },
        steps: [
          { latex: `${lin(gap, v, b)} ${rel} ${e}`, why: T('why.gatherUnknownOneSide', { term: co(cc, v) }) },
          { latex: `${co(gap, v)} ${rel} ${e - b}`, why: T(b > 0 ? 'l2.why.takeOffBothSides' : 'l2.why.addToBothSides', { n: Math.abs(b) }) },
          { latex: st(v, rel, x), why: T('why.divideBothByCoef', { a: gap }) },
        ],
        distractors: [
          { v: st(v, FLIP[rel], x), m: 'flip-always' },
          { v: st(v, rel, ratio(b - e, gap)), m: 'collect-wrong-side' },
          { v: st(v, rel, ratio(e - b, a + cc)), m: 'collect-wrong-side' },
          { v: st(v, EDGE[rel], x), m: 'boundary-slip' },
          { v: st(v, rel, e - b), m: 'partial-rule' },
          { v: st(v, rel, x + 1), m: 'arith-slip' },
          { v: st(v, rel, -x), m: 'sign-slip' },
        ],
      };
    },
  },
  {
    id: 'im-edge', rep: 'symbolic', dMin: 3, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const up = r() < 0.5;
      const rel = up ? pick(r, ['>', '\\ge']) : pick(r, ['<', '\\le']);
      const a = int(r, 2, 3 + d);
      const b = Bkonst(r, d);
      const c = a * int(r, 1, 3 + d) + int(r, 1, a - 1);
      if (c % a === 0) throw new Error('retry: a whole boundary hides the last step');
      if (!distinct(a, b, c)) throw new Error('retry: repeated number');
      const q = c / a - b;
      const ans = up ? Math.ceil(q) : Math.floor(q);
      const math = `${paren(a, lin(1, v, b))} ${rel} ${c}`;
      return {
        stem: T(up ? 'l2.ask.leastWhole' : 'l2.ask.mostWhole', { v }),
        latex: math,
        type: 'numeric',
        answer: String(ans),
        check: { kind: 'inequality', math, variable: v, want: up ? 'least' : 'greatest' },
        steps: [
          { latex: `${lin(a, v, a * b)} ${rel} ${c}`, why: T('why.everyTermInside') },
          { latex: st(v, rel, ratio(c - a * b, a)), why: T('why.divideBothByCoef', { a }) },
          { latex: `${ans} ${rel} ${ratio(c - a * b, a)}`, why: T(up ? 'l2.why.firstWholePast' : 'l2.why.lastWholeBefore') },
        ],
        distractors: [
          { v: String(up ? Math.floor(q) : Math.ceil(q)), m: 'boundary-slip' },
          { v: String(Math.round(c / a) - b), m: 'partial-distribute' },
          { v: String(ans + 1), m: 'arith-slip' },
          { v: String(ans - 1), m: 'arith-slip' },
          { v: String(-ans), m: 'sign-slip' },
          { v: String(c - a), m: 'partial-rule' },
          { v: String(c), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'im-dispute', rep: 'verbal', dMin: 3, dMax: 5, distinctNums: true,
    sceneKeys: KEYS(DISPUTES_OPEN),
    build({ r, d, T, sr }) {
      const v = pick(r, VARS);
      const rel = pick(r, ['>', '<']);
      const a = -Math.abs(nzc(r, 2, 3 + d));
      const b = Bkonst(r, d);
      const x = Broot(r, d);
      const c = a * x + b;
      if (!distinct(a, b, c, x)) throw new Error('retry: repeated number');
      const out = FLIP[rel];
      const sc = scene(sr, DISPUTES_OPEN);
      const math = `${lin(a, v, b)} ${rel} ${c}`;
      return {
        // TWO OF THE FOUR READINGS ON THE CARD ARE QUOTED IN THE SENTENCE, AND
        // WHICH TWO IS NOT DECIDED HERE. It used to be `{ a: the answer, b: the
        // first distractor }`, and every one of the twelve framings prints
        // `{a}` first, so "take the reading the sentence names first" was right
        // 100% of the time. `quoteReadings` draws them out of the four the card
        // will actually show, once `balanceShape` has chosen them.
        quote: { ctx: sc.ctx, ask: 'ask.whichIsRight' },
        stem: `${T(sc.ctx, { a: st(v, out, x), b: st(v, rel, x) })} ${T('ask.whichIsRight')}`,
        latex: asks(math),
        type: 'expression',
        answer: st(v, out, x),
        check: { kind: 'inequality', math, variable: v },
        steps: [
          { latex: `${co(a, v)} ${rel} ${c - b}`, why: T(b > 0 ? 'l2.why.takeOffBothSides' : 'l2.why.addToBothSides', { n: Math.abs(b) }) },
          { latex: st(v, out, x), why: T('l2.why.divideByNegativeTurns', { a }) },
        ],
        distractors: [
          { v: st(v, rel, x), m: 'flip-not-needed' },
          { v: st(v, EDGE[out], x), m: 'boundary-slip' },
          { v: st(v, out, -x), m: 'sign-slip' },
          { v: st(v, out, x + 1), m: 'arith-slip' },
          { v: st(v, out, x - 1), m: 'arith-slip' },
          { v: st(v, rel, -x), m: 'flip-not-needed' },
          { v: st(v, out, c - b), m: 'partial-rule' },
        ],
      };
    },
  },
];

// ===========================================================================
// compound-inequality  —  p REL ax + b REL q
// ===========================================================================
function drawBandLean(r, d, { forceNeg = false } = {}) {
  const v = pick(r, VARS);
  const lo = d >= 3 ? nz(r, -(2 + 2 * d), 2 + 2 * d) : int(r, 1, 3 + d);
  const width = int(r, 2, 2 + 2 * d);
  const hi = lo + width;
  const a = forceNeg ? -Math.abs(nzc(r, 2, 2 + d)) : (d >= 4 ? nzc(r, -(2 + d), 2 + d) : int(r, 2, 2 + d));
  if (Math.abs(a) < 2) throw new Error('retry: nothing to divide by');
  const b = d >= 2 ? nz(r, -(3 + 2 * d), 3 + 2 * d) : int(r, 1, 6);
  const l = pick(r, ['<', '\\le']);
  const u = pick(r, ['<', '\\le']);
  // Written left to right, the smaller end always comes first, so a negative
  // coefficient turns the whole statement inside out — which is the point.
  const p = a > 0 ? a * lo + b : a * hi + b;
  const q = a > 0 ? a * hi + b : a * lo + b;
  if (!distinct(a, b, p, q)) throw new Error('retry: repeated number');
  // A negative coefficient turns the written statement inside out: the end that
  // was printed on the left is the end the unknown carries on the right.
  const math = `${p} ${a > 0 ? l : u} ${lin(a, v, b)} ${a > 0 ? u : l} ${q}`;
  const answer = `${lo} ${l} ${v} ${u} ${hi}`;
  return { v, a, b, lo, hi, p, q, l, u, loRel: l, upRel: u, math, answer };
}

const compoundInequality = [
  {
    id: 'cd-band', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const s = drawBandLean(r, d);
      const mid = s.a > 0 ? s.l : s.u;
      const midU = s.a > 0 ? s.u : s.l;
      return {
        stem: T('l2.ask.whichBand', { v: s.v }),
        latex: asks(s.math),
        type: 'expression',
        answer: s.answer,
        check: { kind: 'compound', math: s.math, variable: s.v },
        steps: [
          { latex: `${s.p - s.b} ${mid} ${co(s.a, s.v)} ${midU} ${s.q - s.b}`, why: T(s.b > 0 ? 'l2.why.takeOffEveryPart' : 'l2.why.addToEveryPart', { n: Math.abs(s.b) }) },
          { latex: s.answer, why: T(s.a < 0 ? 'l2.why.divideByNegativeTurnsBoth' : 'l2.why.divideEveryPart', { a: s.a }) },
        ],
        distractors: [
          { v: `${s.hi} ${s.loRel} ${s.v} ${s.upRel} ${s.lo}`, m: 'band-reversed' },
          { v: `${s.lo} ${EDGE[s.loRel]} ${s.v} ${s.upRel} ${s.hi}`, m: 'boundary-slip' },
          { v: `${s.lo} ${s.loRel} ${s.v} ${EDGE[s.upRel]} ${s.hi}`, m: 'boundary-slip' },
          { v: `${s.lo - 1} ${s.loRel} ${s.v} ${s.upRel} ${s.hi}`, m: 'arith-slip' },
          { v: `${s.lo} ${s.loRel} ${s.v} ${s.upRel} ${s.hi + 1}`, m: 'arith-slip' },
          { v: `${s.p} ${s.loRel} ${s.v} ${s.upRel} ${s.q}`, m: 'partial-rule' },
          { v: `${-s.hi} ${s.loRel} ${s.v} ${s.upRel} ${-s.lo}`, m: 'sign-slip' },
        ],
      };
    },
  },
  {
    id: 'cd-turn', rep: 'symbolic', dMin: 3, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const s = drawBandLean(r, d, { forceNeg: true });
      const mid = s.u;
      const midU = s.l;
      return {
        stem: T('l2.ask.whichBand', { v: s.v }),
        latex: asks(s.math),
        type: 'expression',
        answer: s.answer,
        check: { kind: 'compound', math: s.math, variable: s.v },
        steps: [
          { latex: `${s.p - s.b} ${mid} ${co(s.a, s.v)} ${midU} ${s.q - s.b}`, why: T(s.b > 0 ? 'l2.why.takeOffEveryPart' : 'l2.why.addToEveryPart', { n: Math.abs(s.b) }) },
          { latex: s.answer, why: T('l2.why.divideByNegativeTurnsBoth', { a: s.a }) },
        ],
        // FOUR READINGS, NOT THREE.
        //
        // `band-reversed` here is `hi <= v <= lo` — the band written without
        // turning it, which is the error this form exists to surface, and as
        // written it is the empty set. `flip-not-needed` used to sit beside it
        // as `lo >= v >= hi`: the SAME two conditions read right to left, so
        // the same empty set, printed twice. A cadet offered four options was
        // choosing between three, and the two empties are indistinguishable
        // even to a cadet who knows exactly what is wrong with them. It is
        // replaced by the second boundary slip — the closed end read as open
        // at the top rather than at the bottom — which `cd-band` already
        // offers and which is a band a learner really writes.
        distractors: [
          { v: `${s.hi} ${s.loRel} ${s.v} ${s.upRel} ${s.lo}`, m: 'band-reversed' },
          { v: `${s.lo} ${s.loRel} ${s.v} ${EDGE[s.upRel]} ${s.hi}`, m: 'boundary-slip' },
          { v: `${s.lo} ${EDGE[s.loRel]} ${s.v} ${s.upRel} ${s.hi}`, m: 'boundary-slip' },
          { v: `${-s.hi} ${s.loRel} ${s.v} ${s.upRel} ${-s.lo}`, m: 'sign-slip' },
          { v: `${s.lo + 1} ${s.loRel} ${s.v} ${s.upRel} ${s.hi}`, m: 'arith-slip' },
          { v: `${s.lo} ${s.loRel} ${s.v} ${s.upRel} ${s.hi - 1}`, m: 'arith-slip' },
          { v: `${s.p} ${s.loRel} ${s.v} ${s.upRel} ${s.q}`, m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'cd-count', rep: 'symbolic', dMin: 2, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const s = drawBandLean(r, d);
      const first = s.loRel === '<' ? s.lo + 1 : s.lo;
      const last = s.upRel === '<' ? s.hi - 1 : s.hi;
      const n = last - first + 1;
      if (n < 2) throw new Error('retry: a band with nothing in it');
      return {
        stem: T('l2.ask.howManyWhole', { v: s.v }),
        latex: s.math,
        type: 'numeric',
        answer: String(n),
        check: { kind: 'compound', math: s.math, variable: s.v, want: 'count' },
        steps: [
          { latex: s.answer, why: T('l2.why.bandFirst') },
          { latex: `${last} - ${first} + 1 = ${n}`, why: T('l2.why.countTheEnds') },
        ],
        distractors: [
          { v: String(n - 1), m: 'boundary-slip' },
          { v: String(n + 1), m: 'boundary-slip' },
          { v: String(s.hi - s.lo), m: 'partial-rule' },
          { v: String(s.q - s.p), m: 'partial-rule' },
          { v: String(n + 2), m: 'arith-slip' },
          { v: String(Math.max(1, n - 2)), m: 'arith-slip' },
          { v: String(s.hi), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'cd-context', rep: 'context', dMin: 1, dMax: 5, distinctNums: true,
    sceneKeys: KEYS(BANDS),
    build({ r, d, T, sr }) {
      const sc = scene(sr, BANDS);
      const v = pick(r, VARS);
      const lo = int(r, 2, 4 + 2 * d);
      const hi = lo + int(r, 2, 3 + 2 * d);
      const a = int(r, 2, 2 + 2 * d);
      const b = int(r, 1, 4 + 2 * d);
      const l = pick(r, ['<', '\\le']);
      const u = pick(r, ['<', '\\le']);
      const p = a * lo + b;
      const q = a * hi + b;
      if (!distinct(a, b, p, q)) throw new Error('retry: repeated number');
      const math = `${p} ${l} ${lin(a, v, b)} ${u} ${q}`;
      const answer = `${lo} ${l} ${v} ${u} ${hi}`;
      return {
        stem: `${T(sc.ctx)} ${T(sc.set, { v })}`,
        latex: asks(math),
        type: 'expression',
        answer,
        check: { kind: 'compound', math, variable: v },
        steps: [
          { latex: `${p - b} ${l} ${co(a, v)} ${u} ${q - b}`, why: T('l2.why.takeOffEveryPart', { n: b }) },
          { latex: answer, why: T('l2.why.divideEveryPart', { a }) },
        ],
        distractors: [
          { v: `${hi} ${l} ${v} ${u} ${lo}`, m: 'band-reversed' },
          { v: `${lo} ${EDGE[l]} ${v} ${u} ${hi}`, m: 'boundary-slip' },
          { v: `${lo} ${l} ${v} ${EDGE[u]} ${hi}`, m: 'boundary-slip' },
          { v: `${p} ${l} ${v} ${u} ${q}`, m: 'partial-rule' },
          { v: `${lo - 1} ${l} ${v} ${u} ${hi}`, m: 'arith-slip' },
          { v: `${lo} ${l} ${v} ${u} ${hi + 1}`, m: 'arith-slip' },
          { v: `${p - b} ${l} ${v} ${u} ${q - b}`, m: 'partial-rule' },
        ],
      };
    },
  },
];

// ===========================================================================
// literal-equations  —  a formula solved for a different letter
// ===========================================================================
/**
 * The formulas, by band. Each carries the wrong rearrangements a learner
 * actually writes, so a distractor is never invented to fill a slot.
 */
const FORMULAS = [
  {
    d: 1, math: 'A = bh', v: 'h', vars: ['A', 'b'], answer: '\\frac{A}{b}', ctx: 'l2.ctx.fArea',
    steps: [{ l: '\\frac{A}{b} = h', w: 'l2.why.divideBothByLetter' }, { l: 'h = \\frac{A}{b}', w: 'l2.why.readItRoundTheOtherWay' }],
    wrong: [
      { v: '\\frac{b}{A}', m: 'div-direction' }, { v: 'A b', m: 'same-op-both' },
      { v: 'A - b', m: 'same-op-both' }, { v: 'b - A', m: 'div-direction' },
      { v: '\\frac{A}{b} + b', m: 'partial-rule' }, { v: '\\frac{A b}{2}', m: 'partial-rule' },
    ],
  },
  {
    d: 1, math: 'd = rt', v: 't', vars: ['d', 'r'], answer: '\\frac{d}{r}', ctx: 'l2.ctx.fDistance',
    steps: [{ l: '\\frac{d}{r} = t', w: 'l2.why.divideBothByLetter' }, { l: 't = \\frac{d}{r}', w: 'l2.why.readItRoundTheOtherWay' }],
    wrong: [
      { v: '\\frac{r}{d}', m: 'div-direction' }, { v: 'd r', m: 'same-op-both' },
      { v: 'd - r', m: 'same-op-both' }, { v: 'r - d', m: 'div-direction' },
      { v: '\\frac{d}{r} + r', m: 'partial-rule' }, { v: '\\frac{d + r}{r}', m: 'partial-rule' },
    ],
  },
  {
    d: 2, math: 'F = ma', v: 'a', vars: ['F', 'm'], answer: '\\frac{F}{m}', ctx: 'l2.ctx.fForce',
    steps: [{ l: '\\frac{F}{m} = a', w: 'l2.why.divideBothByLetter' }, { l: 'a = \\frac{F}{m}', w: 'l2.why.readItRoundTheOtherWay' }],
    wrong: [
      { v: '\\frac{m}{F}', m: 'div-direction' }, { v: 'F m', m: 'same-op-both' },
      { v: 'F - m', m: 'same-op-both' }, { v: 'm - F', m: 'div-direction' },
      { v: '\\frac{F}{m} - m', m: 'partial-rule' }, { v: '\\frac{F - m}{m}', m: 'partial-rule' },
    ],
  },
  {
    d: 2, math: 'A = \\frac{bh}{2}', v: 'h', vars: ['A', 'b'], answer: '\\frac{2A}{b}', ctx: 'l2.ctx.fTriangle',
    steps: [
      { l: '2A = bh', w: 'l2.why.clearTheBarFirst' },
      { l: '\\frac{2A}{b} = h', w: 'l2.why.divideBothByLetter' },
      { l: 'h = \\frac{2A}{b}', w: 'l2.why.readItRoundTheOtherWay' },
    ],
    wrong: [
      { v: '\\frac{A}{2b}', m: 'divide-not-multiply' }, { v: '\\frac{A}{b}', m: 'partial-rule' },
      { v: '\\frac{2b}{A}', m: 'div-direction' }, { v: '2A b', m: 'same-op-both' },
      { v: '\\frac{b}{2A}', m: 'div-direction' }, { v: '2A - b', m: 'same-op-both' },
    ],
  },
  {
    d: 3, math: 'P = 2l + 2w', v: 'w', vars: ['P', 'l'], answer: '\\frac{P - 2l}{2}', ctx: 'l2.ctx.fPerimeter',
    steps: [
      { l: 'P - 2l = 2w', w: 'l2.why.moveTheOtherTermFirst' },
      { l: '\\frac{P - 2l}{2} = w', w: 'l2.why.divideBothByNumber' },
      { l: 'w = \\frac{P - 2l}{2}', w: 'l2.why.readItRoundTheOtherWay' },
    ],
    wrong: [
      { v: '\\frac{P}{2} - 2l', m: 'partial-rule' }, { v: 'P - 2l', m: 'partial-rule' },
      { v: '\\frac{P + 2l}{2}', m: 'sign-on-constant' }, { v: '\\frac{2l - P}{2}', m: 'sign-slip' },
      { v: '\\frac{P - l}{2}', m: 'partial-distribute' }, { v: '\\frac{2}{P - 2l}', m: 'div-direction' },
    ],
  },
  {
    d: 3, math: 'y = mx + b', v: 'x', vars: ['y', 'm', 'b'], answer: '\\frac{y - b}{m}', ctx: 'l2.ctx.fLine',
    steps: [
      { l: 'y - b = mx', w: 'l2.why.moveTheOtherTermFirst' },
      { l: '\\frac{y - b}{m} = x', w: 'l2.why.divideBothByLetter' },
      { l: 'x = \\frac{y - b}{m}', w: 'l2.why.readItRoundTheOtherWay' },
    ],
    wrong: [
      { v: '\\frac{y}{m} - b', m: 'partial-rule' }, { v: 'y - b - m', m: 'same-op-both' },
      { v: '\\frac{y + b}{m}', m: 'sign-on-constant' }, { v: '\\frac{m}{y - b}', m: 'div-direction' },
      { v: '\\frac{b - y}{m}', m: 'sign-slip' }, { v: 'm y - b', m: 'same-op-both' },
    ],
  },
  {
    d: 4, math: 'ax + by = c', v: 'y', vars: ['a', 'x', 'c', 'b'], answer: '\\frac{c - ax}{b}', ctx: 'l2.ctx.fStandard',
    steps: [
      { l: 'ax + by - ax = c - ax', w: 'l2.why.moveTheOtherTermFirst' },
      { l: 'by = c - ax', w: 'why.whatIsLeft' },
      { l: 'y = \\frac{c - ax}{b}', w: 'l2.why.divideBothByLetter' },
    ],
    wrong: [
      { v: '\\frac{c}{b} - ax', m: 'partial-rule' }, { v: 'c - ax', m: 'partial-rule' },
      { v: '\\frac{c + ax}{b}', m: 'sign-on-constant' }, { v: '\\frac{ax - c}{b}', m: 'sign-slip' },
      { v: '\\frac{b}{c - ax}', m: 'div-direction' }, { v: '\\frac{c - a}{b}', m: 'partial-distribute' },
    ],
  },
  {
    d: 4, math: 'S = \\frac{a + b}{2}', v: 'b', vars: ['S', 'a'], answer: '2S - a', ctx: 'l2.ctx.fMean',
    steps: [
      { l: '2S = a + b', w: 'l2.why.clearTheBarFirst' },
      { l: '2S - a = b', w: 'l2.why.moveTheOtherTermFirst' },
      { l: 'b = 2S - a', w: 'l2.why.readItRoundTheOtherWay' },
    ],
    wrong: [
      { v: '\\frac{S}{2} - a', m: 'divide-not-multiply' }, { v: '2S + a', m: 'sign-on-constant' },
      { v: 'S - a', m: 'partial-rule' }, { v: 'a - 2S', m: 'sign-slip' },
      { v: '\\frac{2S}{a}', m: 'same-op-both' }, { v: '2 S a', m: 'same-op-both' },
    ],
  },
  {
    d: 5, math: 'T = a + (n - 1)d', v: 'n', vars: ['T', 'a', 'd'], answer: '\\frac{T - a}{d} + 1', ctx: 'l2.ctx.fTerm',
    steps: [
      { l: 'T - a = (n - 1)d', w: 'l2.why.moveTheOtherTermFirst' },
      { l: '\\frac{T - a}{d} = n - 1', w: 'l2.why.divideBothByLetter' },
      { l: '\\frac{T - a}{d} + 1 = n', w: 'l2.why.putBackTheOne' },
    ],
    wrong: [
      { v: '\\frac{T - a}{d}', m: 'partial-rule' }, { v: '\\frac{T - a}{d} - 1', m: 'sign-on-constant' },
      { v: '\\frac{T - a - 1}{d}', m: 'partial-rule' }, { v: '\\frac{T + a}{d} + 1', m: 'sign-slip' },
      { v: '\\frac{d}{T - a} + 1', m: 'div-direction' }, { v: 'T - a - d + 1', m: 'same-op-both' },
    ],
  },
  {
    d: 5, math: 'F = \\frac{9C}{5} + 32', v: 'C', vars: ['F'], answer: '\\frac{5\\left(F - 32\\right)}{9}', ctx: 'l2.ctx.fDegrees',
    steps: [
      { l: 'F - 32 = \\frac{9C}{5}', w: 'l2.why.moveTheOtherTermFirst' },
      { l: '5\\left(F - 32\\right) = 9C', w: 'l2.why.clearTheBarFirst' },
      { l: 'C = \\frac{5\\left(F - 32\\right)}{9}', w: 'l2.why.divideBothByNumber' },
    ],
    wrong: [
      { v: '\\frac{9\\left(F - 32\\right)}{5}', m: 'div-direction' },
      { v: '\\frac{5F - 32}{9}', m: 'partial-distribute' },
      { v: '\\frac{5\\left(F + 32\\right)}{9}', m: 'sign-on-constant' },
      { v: '\\frac{9F}{5} + 32', m: 'same-op-both' },
      { v: '5\\left(F - 32\\right)', m: 'partial-rule' },
      { v: '\\frac{F - 32}{9}', m: 'partial-rule' },
    ],
  },
  {
    d: 5, math: 'I = Prt', v: 'r', vars: ['I', 'P', 't'], answer: '\\frac{I}{Pt}', ctx: 'l2.ctx.fInterest',
    steps: [
      { l: '\\frac{I}{P} = rt', w: 'l2.why.divideBothByLetter' },
      { l: '\\frac{I}{Pt} = r', w: 'l2.why.divideBothByLetter' },
      { l: 'r = \\frac{I}{Pt}', w: 'l2.why.readItRoundTheOtherWay' },
    ],
    wrong: [
      { v: '\\frac{Pt}{I}', m: 'div-direction' },
      { v: '\\frac{I}{P} - t', m: 'same-op-both' },
      { v: '\\frac{I}{P}', m: 'partial-rule' },
      { v: 'I - Pt', m: 'same-op-both' },
      { v: '\\frac{It}{P}', m: 'div-direction' },
      { v: '\\frac{I}{P + t}', m: 'partial-rule' },
    ],
  },
  {
    d: 5, math: 'V = \\frac{Bh}{3}', v: 'B', vars: ['V', 'h'], answer: '\\frac{3V}{h}', ctx: 'l2.ctx.fCone',
    steps: [
      { l: '3V = Bh', w: 'l2.why.clearTheBarFirst' },
      { l: '\\frac{3V}{h} = B', w: 'l2.why.divideBothByLetter' },
      { l: 'B = \\frac{3V}{h}', w: 'l2.why.readItRoundTheOtherWay' },
    ],
    wrong: [
      { v: '\\frac{V}{3h}', m: 'divide-not-multiply' }, { v: '\\frac{V}{h}', m: 'partial-rule' },
      { v: '\\frac{3h}{V}', m: 'div-direction' }, { v: '3V h', m: 'same-op-both' },
      { v: '\\frac{h}{3V}', m: 'div-direction' }, { v: '3V - h', m: 'same-op-both' },
    ],
  },
  // ---------------------------------------------------------------------
  // TEN MORE, AND WHY.
  //
  // `le-context` draws its situation from this catalogue, and the pool at one
  // band is the formulas filed at that band and the one below it. Twelve
  // formulas meant a pool of TWO at band 1 and FOUR at bands 2-4, and
  // `tools/scene-audit.mjs` measured the result: `l2.ctx.fStandard` twice
  // inside one 45-item sitting, which is the same repeated sentence this whole
  // deck exists to stop. Ten more, spread over the five bands, take the
  // narrowest pool from two to four and the widest from six to ten.
  // ---------------------------------------------------------------------
  {
    d: 1, math: 'P = 4s', v: 's', vars: ['P'], answer: '\\frac{P}{4}', ctx: 'l2.ctx.fSquare',
    steps: [{ l: '\\frac{P}{4} = s', w: 'l2.why.divideBothByNumber' }, { l: 's = \\frac{P}{4}', w: 'l2.why.readItRoundTheOtherWay' }],
    wrong: [
      { v: '\\frac{4}{P}', m: 'div-direction' }, { v: '4P', m: 'same-op-both' },
      { v: 'P - 4', m: 'same-op-both' }, { v: '\\frac{P}{2}', m: 'arith-slip' },
      { v: '\\frac{P}{4} + 4', m: 'partial-rule' }, { v: 'P + 4', m: 'sign-on-constant' },
    ],
  },
  {
    d: 1, math: 'M = dV', v: 'V', vars: ['M', 'd'], answer: '\\frac{M}{d}', ctx: 'l2.ctx.fDensity',
    steps: [{ l: '\\frac{M}{d} = V', w: 'l2.why.divideBothByLetter' }, { l: 'V = \\frac{M}{d}', w: 'l2.why.readItRoundTheOtherWay' }],
    wrong: [
      { v: '\\frac{d}{M}', m: 'div-direction' }, { v: 'M d', m: 'same-op-both' },
      { v: 'M - d', m: 'same-op-both' }, { v: 'd - M', m: 'div-direction' },
      { v: '\\frac{M}{d} + d', m: 'partial-rule' }, { v: '\\frac{M d}{2}', m: 'partial-rule' },
    ],
  },
  {
    d: 2, math: 'C = np', v: 'n', vars: ['C', 'p'], answer: '\\frac{C}{p}', ctx: 'l2.ctx.fCost',
    steps: [{ l: '\\frac{C}{p} = n', w: 'l2.why.divideBothByLetter' }, { l: 'n = \\frac{C}{p}', w: 'l2.why.readItRoundTheOtherWay' }],
    wrong: [
      { v: '\\frac{p}{C}', m: 'div-direction' }, { v: 'C p', m: 'same-op-both' },
      { v: 'C - p', m: 'same-op-both' }, { v: 'p - C', m: 'div-direction' },
      { v: '\\frac{C}{p} - p', m: 'partial-rule' }, { v: '\\frac{C + p}{p}', m: 'partial-rule' },
    ],
  },
  {
    d: 2, math: 'V = lwh', v: 'h', vars: ['V', 'l', 'w'], answer: '\\frac{V}{lw}', ctx: 'l2.ctx.fBox',
    steps: [{ l: '\\frac{V}{lw} = h', w: 'l2.why.divideBothByLetter' }, { l: 'h = \\frac{V}{lw}', w: 'l2.why.readItRoundTheOtherWay' }],
    wrong: [
      { v: '\\frac{lw}{V}', m: 'div-direction' }, { v: '\\frac{V}{l}', m: 'partial-rule' },
      { v: '\\frac{V}{w}', m: 'partial-rule' }, { v: 'V l w', m: 'same-op-both' },
      { v: 'V - lw', m: 'same-op-both' }, { v: '\\frac{V}{l + w}', m: 'divide-not-multiply' },
    ],
  },
  {
    d: 3, math: 'P = a + b + c', v: 'c', vars: ['P', 'a', 'b'], answer: 'P - a - b', ctx: 'l2.ctx.fTriFrame',
    steps: [
      { l: 'P - a = b + c', w: 'l2.why.moveTheOtherTermFirst' },
      { l: 'P - a - b = c', w: 'l2.why.moveTheOtherTermFirst' },
      { l: 'c = P - a - b', w: 'l2.why.readItRoundTheOtherWay' },
    ],
    wrong: [
      { v: 'P + a + b', m: 'sign-on-constant' }, { v: 'P - a + b', m: 'sign-slip' },
      { v: 'a + b - P', m: 'sign-slip' }, { v: '\\frac{P}{a + b}', m: 'div-direction' },
      { v: 'P - a', m: 'partial-rule' }, { v: 'P - b', m: 'partial-rule' },
    ],
  },
  {
    d: 3, math: 'v = u + at', v: 't', vars: ['v', 'u', 'a'], answer: '\\frac{v - u}{a}', ctx: 'l2.ctx.fSpeedUp',
    steps: [
      { l: 'v - u = at', w: 'l2.why.moveTheOtherTermFirst' },
      { l: '\\frac{v - u}{a} = t', w: 'l2.why.divideBothByLetter' },
      { l: 't = \\frac{v - u}{a}', w: 'l2.why.readItRoundTheOtherWay' },
    ],
    wrong: [
      { v: '\\frac{v + u}{a}', m: 'sign-on-constant' }, { v: '\\frac{u - v}{a}', m: 'sign-slip' },
      { v: '\\frac{v}{a} - u', m: 'partial-rule' }, { v: 'v - u - a', m: 'same-op-both' },
      { v: '\\frac{a}{v - u}', m: 'div-direction' }, { v: '\\frac{v - u}{u}', m: 'partial-rule' },
    ],
  },
  {
    d: 4, math: 'A = \\frac{h\\left(a + b\\right)}{2}', v: 'a', vars: ['A', 'h', 'b'], answer: '\\frac{2A}{h} - b', ctx: 'l2.ctx.fTrapezoid',
    steps: [
      { l: '2A = h\\left(a + b\\right)', w: 'l2.why.clearTheBarFirst' },
      { l: '\\frac{2A}{h} = a + b', w: 'l2.why.divideBothByLetter' },
      { l: 'a = \\frac{2A}{h} - b', w: 'l2.why.moveTheOtherTermFirst' },
    ],
    wrong: [
      { v: '\\frac{2A}{h} + b', m: 'sign-on-constant' }, { v: '\\frac{A}{2h} - b', m: 'divide-not-multiply' },
      { v: '\\frac{2A}{h}', m: 'partial-rule' }, { v: '\\frac{2A}{h b}', m: 'div-direction' },
      { v: 'b - \\frac{2A}{h}', m: 'sign-slip' }, { v: '2A - h - b', m: 'same-op-both' },
    ],
  },
  {
    d: 4, math: 'N = \\frac{a + b + c}{3}', v: 'c', vars: ['N', 'a', 'b'], answer: '3N - a - b', ctx: 'l2.ctx.fThreeMean',
    steps: [
      { l: '3N = a + b + c', w: 'l2.why.clearTheBarFirst' },
      { l: '3N - a = b + c', w: 'l2.why.moveTheOtherTermFirst' },
      { l: 'c = 3N - a - b', w: 'l2.why.moveTheOtherTermFirst' },
    ],
    wrong: [
      { v: '\\frac{N}{3} - a - b', m: 'divide-not-multiply' }, { v: '3N + a + b', m: 'sign-on-constant' },
      { v: '3N - a', m: 'partial-rule' }, { v: 'N - a - b', m: 'partial-rule' },
      { v: 'a + b - 3N', m: 'sign-slip' }, { v: '\\frac{3N}{a + b}', m: 'div-direction' },
    ],
  },
  {
    d: 5, math: 'A = P + Prt', v: 't', vars: ['A', 'P', 'r'], answer: '\\frac{A - P}{Pr}', ctx: 'l2.ctx.fBalance',
    steps: [
      { l: 'A - P = Prt', w: 'l2.why.moveTheOtherTermFirst' },
      { l: '\\frac{A - P}{P} = rt', w: 'l2.why.divideBothByLetter' },
      { l: 't = \\frac{A - P}{Pr}', w: 'l2.why.divideBothByLetter' },
    ],
    wrong: [
      { v: '\\frac{A + P}{Pr}', m: 'sign-on-constant' }, { v: '\\frac{Pr}{A - P}', m: 'div-direction' },
      { v: '\\frac{A - P}{P}', m: 'partial-rule' }, { v: '\\frac{A}{Pr} - P', m: 'partial-rule' },
      { v: '\\frac{P - A}{Pr}', m: 'sign-slip' }, { v: 'A - P - Pr', m: 'same-op-both' },
    ],
  },
  {
    d: 5, math: 'S = \\frac{n\\left(a + L\\right)}{2}', v: 'L', vars: ['S', 'n', 'a'], answer: '\\frac{2S}{n} - a', ctx: 'l2.ctx.fLadderSum',
    steps: [
      { l: '2S = n\\left(a + L\\right)', w: 'l2.why.clearTheBarFirst' },
      { l: '\\frac{2S}{n} = a + L', w: 'l2.why.divideBothByLetter' },
      { l: 'L = \\frac{2S}{n} - a', w: 'l2.why.moveTheOtherTermFirst' },
    ],
    wrong: [
      { v: '\\frac{2S}{n} + a', m: 'sign-on-constant' }, { v: '\\frac{S}{2n} - a', m: 'divide-not-multiply' },
      { v: '\\frac{2S}{n}', m: 'partial-rule' }, { v: '\\frac{2S}{n a}', m: 'div-direction' },
      { v: 'a - \\frac{2S}{n}', m: 'sign-slip' }, { v: '2S - n - a', m: 'same-op-both' },
    ],
  },
];

/** The formula skeleton a choice is made against: the shape, with the values gone. */
const literalPrompt = (f) => `${f.math} \\;\\Rightarrow\\; ${f.v} = \\square`;

const literalEquations = [
  {
    id: 'le-formula', rep: 'symbolic', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const pool = FORMULAS.filter((f) => f.d <= d && f.d >= d - 1);
      const f = pick(r, pool.length ? pool : FORMULAS.filter((x) => x.d <= d));
      if (!f) throw new Error('retry: no formula at this band');
      return {
        stem: T('l2.ask.solveFormulaFor', { v: f.v }),
        latex: literalPrompt(f),
        type: 'expression',
        answer: f.answer,
        check: { kind: 'rearrange', math: f.math, variable: f.v, vars: f.vars },
        steps: f.steps.map((s) => ({ latex: s.l, why: T(s.w, { v: f.v }) })),
        distractors: f.wrong.map((w) => ({ v: w.v, m: w.m })),
      };
    },
  },
  {
    id: 'le-context', rep: 'context', dMin: 1, dMax: 5,
    sceneKeys: KEYS(FORMULAS),
    build({ r, d, T, sr }) {
      const pool = FORMULAS.filter((f) => f.d <= d && f.d >= d - 1);
      // Through `scene`, not `pick`: each named formula IS a situation, and the
      // catalogue is the deck. Drawn with `pick` the item came back with
      // `item.scene` empty, so a run could be handed the hull plate three times
      // and the gate had nothing to withhold.
      const f = scene(sr, pool.length ? pool : FORMULAS.filter((x) => x.d <= d));
      if (!f) throw new Error('retry: no formula at this band');
      return {
        stem: `${T(f.ctx)} ${T('l2.ask.turnItRound', { v: f.v })}`,
        latex: literalPrompt(f),
        type: 'expression',
        answer: f.answer,
        check: { kind: 'rearrange', math: f.math, variable: f.v, vars: f.vars },
        steps: f.steps.map((s) => ({ latex: s.l, why: T(s.w, { v: f.v }) })),
        distractors: f.wrong.map((w) => ({ v: w.v, m: w.m })),
      };
    },
  },
  {
    id: 'le-general', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      // A literal equation with numbers in it: the same act, at the magnitudes
      // the band promises, so the ladder is measured and not asserted.
      const a = d >= 3 ? Bcoef(r, d) : int(r, 2, 5 + 3 * d);
      const b = d >= 3 ? nz(r, -(8 + 8 * d), 8 + 8 * d) : int(r, 2, 6 + 4 * d);
      if (Math.abs(a) < 2 || !distinct(a, b)) throw new Error('retry: repeated number');
      const math = `y = ${lin(a, 'x', 0)} ${sg(b)}`;
      const answer = `\\frac{y ${sg(-b)}}{${a}}`;
      return {
        stem: T('l2.ask.solveFormulaFor', { v: 'x' }),
        latex: `${math} \\;\\Rightarrow\\; x = \\square`,
        type: 'expression',
        answer,
        check: { kind: 'rearrange', math, variable: 'x', vars: ['y'] },
        steps: [
          { latex: `y ${sg(-b)} = ${co(a, 'x')}`, why: T('l2.why.moveTheOtherTermFirst', { v: 'x' }) },
          { latex: `\\frac{y ${sg(-b)}}{${a}} = x`, why: T('why.divideBothByCoef', { a }) },
        ],
        distractors: [
          { v: `\\frac{y}{${a}} ${sg(-b)}`, m: 'partial-rule' },
          { v: `\\frac{y ${sg(b)}}{${a}}`, m: 'sign-on-constant' },
          { v: `y ${sg(-b)}`, m: 'partial-rule' },
          { v: `\\frac{${a}}{y ${sg(-b)}}`, m: 'div-direction' },
          { v: `${a}y ${sg(-b)}`, m: 'same-op-both' },
          { v: `\\frac{${-b} - y}{${a}}`, m: 'sign-slip' },
        ],
      };
    },
  },
  {
    id: 'le-share', rep: 'symbolic', dMin: 2, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      // A bar over a sum: the move that has to happen first, in letters.
      const k = int(r, 2, 2 + 3 * d);
      const a = int(r, 2, 4 + 5 * d);
      if (!distinct(k, a)) throw new Error('retry: repeated number');
      const math = `\\frac{P ${sg(-a)}}{${k}} = Q`;
      const answer = `${k}Q + ${a}`;
      return {
        stem: T('l2.ask.solveFormulaFor', { v: 'P' }),
        latex: `${math} \\;\\Rightarrow\\; P = \\square`,
        type: 'expression',
        answer,
        check: { kind: 'rearrange', math, variable: 'P', vars: ['Q'] },
        steps: [
          { latex: `P ${sg(-a)} = ${k}Q`, why: T('l2.why.clearTheBarFirst', { v: 'P' }) },
          { latex: `P = ${k}Q + ${a}`, why: T('l2.why.moveTheOtherTermFirst', { v: 'P' }) },
        ],
        distractors: [
          { v: `${k}Q - ${a}`, m: 'sign-on-constant' },
          { v: `\\frac{Q}{${k}} + ${a}`, m: 'divide-not-multiply' },
          { v: `${k}Q`, m: 'partial-rule' },
          { v: `Q + ${a}`, m: 'partial-rule' },
          { v: `${k}\\left(Q + ${a}\\right)`, m: 'partial-distribute' },
          { v: `${a} - ${k}Q`, m: 'sign-slip' },
        ],
      };
    },
  },
  {
    // The standard form, turned round. The named formulas above are a fixed
    // catalogue of twelve, so on their own they cannot hold a learner who is
    // being held: band 1 offered two prompts and repeated them. This form is
    // the same act with drawn numbers, so the supply does not run out.
    id: 'le-standard', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const a = d >= 3 ? Bcoef(r, d) : int(r, 2, 4 + 2 * d);
      const b = d >= 3 ? nzc(r, 2, 3 + d) : int(r, 2, 3 + 2 * d);
      const c = d >= 3 ? Bkonst(r, d) : int(r, 2, 6 + 3 * d);
      if (Math.abs(b) < 2 || !distinct(a, b, c)) throw new Error('retry: repeated number');
      const math = `${lin(a, 'x', 0)} ${signedTerm(b, 'y')} = ${c}`;
      const answer = `\\frac{${c} ${sg(-a)}x}{${b}}`;
      return {
        stem: T('l2.ask.solveFormulaFor', { v: 'y' }),
        latex: `${math} \\;\\Rightarrow\\; y = \\square`,
        type: 'expression',
        answer,
        check: { kind: 'rearrange', math, variable: 'y', vars: ['x'] },
        steps: [
          { latex: `${co(b, 'y')} = ${c} ${sg(-a)}x`, why: T('l2.why.moveTheOtherTermFirst', { v: 'y' }) },
          { latex: `y = \\frac{${c} ${sg(-a)}x}{${b}}`, why: T('why.divideBothByCoef', { a: b }) },
        ],
        distractors: [
          { v: `\\frac{${c} ${sg(a)}x}{${b}}`, m: 'sign-on-constant' },
          { v: `\\frac{${c}}{${b}} ${sg(-a)}x`, m: 'partial-rule' },
          { v: `${c} ${sg(-a)}x`, m: 'partial-rule' },
          { v: `\\frac{${b}}{${c} ${sg(-a)}x}`, m: 'div-direction' },
          { v: `${b}\\left(${c} ${sg(-a)}x\\right)`, m: 'divide-not-multiply' },
          { v: `\\frac{${a}x ${sg(-c)}}{${b}}`, m: 'sign-slip' },
        ],
      };
    },
  },
];

// ===========================================================================
// ratio-proportion  —  two ratios that agree
// ===========================================================================
/** A proportion with a whole-number answer, with the gap in any of four slots. */
function drawProportion(r, d, slot) {
  const k = int(r, 2, 2 + 2 * d);      // the scale between the two ratios
  const a = int(r, 2, 4 + 3 * d);
  const b = int(r, 2, 4 + 3 * d);
  if (a === b) throw new Error('retry: a ratio of one is not a ratio');
  const c = a * k;
  const e = b * k;
  const cells = [a, b, c, e];
  if (!distinct(...cells)) throw new Error('retry: repeated number');
  const x = cells[slot];
  const shown = cells.map((n, i) => (i === slot ? 'x' : String(n)));
  const math = `\\frac{${shown[0]}}{${shown[1]}} = \\frac{${shown[2]}}{${shown[3]}}`;
  return { a, b, c, e, k, x, slot, math };
}

const ratioProportion = [
  {
    id: 'rp-solve', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const slot = d >= 3 ? int(r, 0, 3) : int(r, 2, 3);
      const p = drawProportion(r, d, slot);
      const cross = [p.a * p.e, p.b * p.c];
      return {
        stem: T('l2.ask.findTheFourth'),
        latex: p.math,
        type: 'numeric',
        answer: String(p.x),
        check: { kind: 'proportion', math: p.math, variable: 'x' },
        steps: [
          { latex: `${p.a} \\cdot ${p.e} = ${p.b} \\cdot ${p.c}`, why: T('l2.why.crossMultiply') },
          { latex: `${cross[0]} = ${cross[1]}`, why: T('l2.why.oneNumberLeft') },
        ],
        distractors: [
          { v: String(p.k), m: 'partial-rule' },
          { v: String(p.x + p.k), m: 'add-not-multiply' },
          { v: String(p.x - p.k), m: 'add-not-multiply' },
          { v: String(Math.round(p.a * p.b / Math.max(1, p.k))), m: 'div-direction' },
          { v: String(p.x + 1), m: 'arith-slip' },
          { v: String(p.x - 1), m: 'arith-slip' },
          { v: String(p.a + p.b), m: 'add-not-multiply' },
        ],
      };
    },
  },
  {
    id: 'rp-rate', rep: 'table', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      // Equivalent ratios in a table. The rule through the origin is the rate.
      const rate = int(r, 2, 3 + 2 * d);
      const start = int(r, 1, 2 + d);
      const step = int(r, 1, Math.max(1, d - 1));
      const rows = [0, 1, 2, 3].map((i) => [start + i * step, rate * (start + i * step)]);
      const missing = int(r, 1, 3);
      if (!distinct(rate, start, step)) throw new Error('retry: repeated number');
      const ans = rows[missing][1];
      return {
        stem: T('l2.ask.sameRatioRow'),
        latex: arrayTex('x', 'y', rows, missing),
        type: 'numeric',
        answer: String(ans),
        check: { kind: 'table', rows, missing },
        steps: [
          { latex: `\\frac{${rows[0][1]}}{${rows[0][0]}} = ${rate}`, why: T('l2.why.oneRowGivesTheRate') },
          { latex: `${rate} \\cdot ${rows[missing][0]} = ${ans}`, why: T('l2.why.applyRateToRow') },
        ],
        distractors: [
          { v: String(rows[missing - 1][1]), m: 'off-by-one-row' },
          { v: String(rows[Math.min(3, missing + 1)][1]), m: 'off-by-one-row' },
          { v: String(rows[missing][0] + rate), m: 'add-not-multiply' },
          { v: String(rate), m: 'partial-rule' },
          { v: String(ans + rate), m: 'arith-slip' },
          { v: String(ans - rate), m: 'arith-slip' },
          { v: String(ans + 1), m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'rp-context', rep: 'context', dMin: 1, dMax: 5, distinctNums: true,
    sceneKeys: KEYS(RATIOS),
    build({ r, d, T, sr }) {
      const sc = scene(sr, RATIOS);
      const p = drawProportion(r, d, 3);
      const cross = [p.a * p.e, p.b * p.c];
      return {
        stem: `${T(sc.ctx)} ${T(sc.ask)}`,
        latex: p.math,
        type: 'numeric',
        answer: String(p.x),
        check: { kind: 'proportion', math: p.math, variable: 'x' },
        steps: [
          { latex: `${p.a} \\cdot ${p.e} = ${p.b} \\cdot ${p.c}`, why: T('l2.why.crossMultiply') },
          { latex: `${cross[0]} = ${cross[1]}`, why: T('l2.why.oneNumberLeft') },
        ],
        distractors: [
          { v: String(p.k), m: 'partial-rule' },
          { v: String(p.x + p.k), m: 'add-not-multiply' },
          { v: String(p.b + p.c - p.a), m: 'add-not-multiply' },
          { v: String(p.x + 1), m: 'arith-slip' },
          { v: String(p.x - 1), m: 'arith-slip' },
          { v: String(p.c), m: 'partial-rule' },
          { v: String(p.a * p.b), m: 'div-direction' },
        ],
      };
    },
  },
  {
    /**
     * WHICH PAIR OF RATIOS STATES THIS? — with the amounts on the card.
     *
     * This form used to print the constant string
     * `\\frac{\\square}{\\square} = \\frac{\\square}{\\square}` over a situation
     * that named no numbers, and keep `a`, `b` and `e` in `answer` and
     * `distractors` where the learner could not reach them. `check:determinate`
     * measured the result across 167,760 sampled items: fifteen distinct
     * (locale, sentence, notation) displays carrying 148 different accepted
     * answers, 525 items affected, and it was the ONLY finding in the whole
     * five-unit run. A learner shown four empty boxes is picking, not modelling.
     *
     * So the amounts move into the situation, which is where a modelling
     * question's quantities belong, and the form DECLARES that it has nothing
     * else to show (`noDisplay`) rather than inventing a display. That is the
     * same repair `lt-perimeter` and `ee-context` already carry in the core
     * bank. `demandOf` reads the mathematics out of the stem for exactly this
     * case, so the difficulty ladder is unaffected.
     */
    id: 'rp-model', rep: 'verbal', dMin: 2, dMax: 5, distinctNums: true,
    sceneKeys: KEYS(MODELS),
    build({ r, d, T, sr }) {
      const sc = scene(sr, MODELS);
      // The unknown stands in a numerator, because the rig re-solves whichever
      // statement the cadet chooses and a letter under a bar is a different
      // question from the one this form is asking.
      const p = drawProportion(r, d, 2);
      const ans = `\\frac{${p.a}}{${p.b}} = \\frac{x}{${p.e}}`;
      return {
        stem: `${T(sc.ctx, { a: p.a, b: p.b, e: p.e })} ${T('l2.ask.whichProportion')}`,
        latex: null,
        noDisplay: true,
        type: 'expression',
        answer: ans,
        check: { kind: 'equationChoice', variable: 'x', expect: String(p.x) },
        steps: [
          { latex: `\\frac{${p.a}}{${p.b}}`, why: T('l2.why.firstPairIsTheRatio') },
          { latex: ans, why: T('l2.why.secondPairMatchesIt') },
        ],
        // `\\frac{e}{b} = \\frac{x}{a}` is NOT here any more. It is the scale
        // factor written the other way round, so it solves to the same `x` as
        // the key: a second correct answer wearing a misconception tag.
        // `finalize` was already dropping it — every equationChoice option that
        // re-solves to `expect` is refused — so it never reached a learner, but
        // it was occupying a slot that a real error should have.
        distractors: [
          { v: `\\frac{${p.b}}{${p.a}} = \\frac{x}{${p.e}}`, m: 'div-direction' },
          { v: `\\frac{${p.a}}{${p.e}} = \\frac{x}{${p.b}}`, m: 'swapped-roles' },
          { v: `\\frac{${p.a}}{${p.b}} = \\frac{${p.e}}{x}`, m: 'inverted-second' },
          { v: `\\frac{${p.a}}{${p.b}} = \\frac{x}{${p.e + 1}}`, m: 'arith-slip' },
          { v: `\\frac{${p.b}}{${p.e}} = \\frac{x}{${p.a}}`, m: 'swapped-roles' },
          { v: `\\frac{${p.a}}{${p.b}} = \\frac{x}{${p.a + p.b}}`, m: 'add-not-multiply' },
        ],
      };
    },
  },
];

// ===========================================================================
// slope-rate  —  rise over run
// ===========================================================================
/** Two readings on one straight rule, with the rate the band asks for. */
function drawRate(r, d, { whole = false, tabled = false } = {}) {
  // `tabled` — a table prints four rows of the rule, so the largest number on
  // the card is three steps further along than it is for a pair of readings,
  // and `sr-table` measured a point and a half above every other form of this
  // skill because of it. The rule it draws is the same rule; only the reach of
  // the printed rows comes down.
  const run = whole ? 1 : int(r, 1, 1 + (tabled ? 1 : 2) * d);
  const rise = d >= 3 ? nz(r, -(2 + (tabled ? 2 : 4) * d), 2 + (tabled ? 2 : 4) * d) : int(r, 1, 3 + (tabled ? 2 : 4) * d);
  if (rise === 0) throw new Error('retry: a flat rule teaches nothing here');
  if (!whole && d >= 4 && rise % run === 0 && r() < 0.6) throw new Error('retry: draw a rate that is not whole');
  const x1 = d >= 3 ? int(r, -4 - 2 * d, 4 + 2 * d) : int(r, 0, 4 + 3 * d);
  const b0 = d >= 3 ? nz(r, -(4 + 4 * d), 4 + 4 * d) : int(r, 0, 5 + 4 * d);
  const x2 = x1 + run;
  const y1 = b0;
  const y2 = b0 + rise;
  return { x1, y1, x2, y2, rise, run };
}

const slopeRate = [
  {
    id: 'sr-points', rep: 'symbolic', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const p = drawRate(r, d);
      if (!distinct(p.x1, p.x2)) throw new Error('retry: two readings at one input');
      return {
        stem: T('l2.ask.rateBetweenReadings'),
        latex: ptsTex([p.x1, p.y1], [p.x2, p.y2]),
        type: 'numeric',
        answer: ratioStr(p.rise, p.run),
        check: { kind: 'line', points: [[p.x1, p.y1], [p.x2, p.y2]], want: 'slope' },
        steps: [
          { latex: `\\frac{${p.y2} - ${p.y1}}{${p.x2} - ${p.x1}}`, why: T('l2.why.riseOverRun') },
          { latex: `\\frac{${p.y2 - p.y1}}{${p.x2 - p.x1}} = ${ratio(p.rise, p.run)}`, why: T('l2.why.thatIsTheRate') },
        ],
        distractors: [
          { v: ratioStr(p.run, p.rise), m: 'run-over-rise' },
          { v: ratioStr(-p.rise, p.run), m: 'sign-slip' },
          { v: String(p.y2 - p.y1), m: 'partial-rule' },
          { v: String(p.x2 - p.x1), m: 'run-over-rise' },
          { v: ratioStr(p.y1 - p.y2, p.x2 - p.x1), m: 'sign-slip' },
          { v: ratioStr(p.y2 + p.y1, p.x2 + p.x1), m: 'add-not-subtract' },
          { v: String(p.y2), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'sr-table', rep: 'table', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const p = drawRate(r, d, { tabled: true });
      const rows = [0, 1, 2, 3].map((i) => [p.x1 + i * p.run, p.y1 + i * p.rise]);
      return {
        stem: T('l2.ask.rateFromTable'),
        latex: arrayTex('x', 'y', rows, -1),
        type: 'numeric',
        answer: ratioStr(p.rise, p.run),
        check: { kind: 'line', points: [[rows[0][0], rows[0][1]], [rows[1][0], rows[1][1]]], want: 'slope' },
        steps: [
          { latex: `\\frac{${rows[1][1]} - ${rows[0][1]}}{${rows[1][0]} - ${rows[0][0]}}`, why: T('l2.why.oneStepDownTheTable') },
          { latex: `\\frac{${p.rise}}{${p.run}} = ${ratio(p.rise, p.run)}`, why: T('l2.why.thatIsTheRate') },
        ],
        distractors: [
          { v: ratioStr(p.run, p.rise), m: 'run-over-rise' },
          { v: ratioStr(-p.rise, p.run), m: 'sign-slip' },
          { v: String(p.rise), m: 'partial-rule' },
          { v: String(p.run), m: 'run-over-rise' },
          { v: String(rows[0][1]), m: 'off-by-one-row' },
          { v: String(rows[1][1]), m: 'off-by-one-row' },
          { v: ratioStr(p.rise + p.run, p.run), m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'sr-graph', rep: 'graph', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const lim = band(d).chart;
      const p = drawRate(r, d, { whole: true });
      if (Math.abs(p.rise) > lim - 1) throw new Error('retry: off chart');
      const x1 = int(r, -Math.floor(lim / 2), 0);
      const y1 = int(r, -Math.floor(lim / 2), Math.floor(lim / 2) - Math.abs(p.rise));
      const x2 = x1 + int(r, 1, 3);
      const y2 = y1 + p.rise * (x2 - x1);
      if (Math.abs(y2) > lim || Math.abs(x2) > lim) throw new Error('retry: off chart');
      const b = y1 - p.rise * x1;
      if (Math.abs(b) > lim) throw new Error('retry: off chart');
      return {
        stem: T('l2.ask.rateOfTrace'),
        latex: ptsTex([x1, y1], [x2, y2]),
        type: 'numeric',
        answer: String(p.rise),
        figure: { kind: 'line', m: p.rise, b, points: [[x1, y1], [x2, y2]], range: fitRange([[x1, y1], [x2, y2]], b) },
        check: { kind: 'line', points: [[x1, y1], [x2, y2]], want: 'slope' },
        steps: [
          { latex: `\\frac{${y2} - ${y1}}{${x2} - ${x1}}`, why: T('l2.why.riseOverRun') },
          { latex: `\\frac{${y2 - y1}}{${x2 - x1}} = ${p.rise}`, why: T('l2.why.thatIsTheRate') },
        ],
        distractors: [
          { v: ratioStr(x2 - x1, y2 - y1), m: 'run-over-rise' },
          { v: String(-p.rise), m: 'sign-slip' },
          { v: String(y2 - y1), m: 'partial-rule' },
          { v: String(b), m: 'slope-intercept-swap' },
          { v: String(y2), m: 'axis-swap' },
          { v: String(x2), m: 'axis-swap' },
          { v: String(p.rise + 1), m: 'arith-slip' },
        ],
      };
    },
  },
  {
    // The rate of a line handed over as Ax + By = C. TEKS A.3(A) names this
    // form explicitly, and it is the first time the rate is not simply visible.
    id: 'sr-standard', rep: 'symbolic', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const a = nzc(r, 2, 2 + 2 * d);
      const b = nzc(r, 2, 2 + 2 * d);
      const c = nz(r, -(4 + 4 * d), 4 + 4 * d);
      if (!distinct(a, b, c)) throw new Error('retry: repeated number');
      const math = `${lin(a, 'x', 0)} ${signedTerm(b, 'y')} = ${c}`;
      return {
        stem: T('l2.ask.rateOfStatement'),
        latex: math,
        type: 'numeric',
        answer: ratioStr(-a, b),
        check: { kind: 'lineEquation', math, want: 'slope' },
        steps: [
          { latex: `${co(b, 'y')} = ${lin(-a, 'x', c)}`, why: T('l2.why.gatherYAlone') },
          { latex: `y = ${ratio(-a, b)}x ${sgRatio(c, b)}`, why: T('l2.why.divideByCoefOfY', { b }) },
          { latex: `\\frac{${-a}}{${b}} = ${ratio(-a, b)}`, why: T('l2.why.thatIsTheRate') },
        ],
        distractors: [
          { v: ratioStr(a, b), m: 'sign-slip' },
          { v: ratioStr(-b, a), m: 'run-over-rise' },
          { v: ratioStr(c, b), m: 'slope-intercept-swap' },
          { v: String(a), m: 'partial-rule' },
          { v: String(b), m: 'partial-rule' },
          { v: ratioStr(b, a), m: 'run-over-rise' },
          { v: ratioStr(-a, c), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'sr-context', rep: 'context', dMin: 1, dMax: 5,
    sceneKeys: KEYS(RATES),
    build({ r, d, T, sr }) {
      const sc = scene(sr, RATES);
      const run = int(r, 2, 2 + 2 * d);
      const rise = int(r, 2, 3 + 4 * d);
      const x1 = int(r, 0, 3 + 2 * d);
      const y1 = int(r, 1, 5 + 4 * d);
      const x2 = x1 + run;
      const y2 = y1 + rise;
      if (!distinct(x1, y1, x2, y2)) throw new Error('retry: repeated number');
      return {
        stem: `${T(sc.ctx)} ${T(sc.ask)}`,
        latex: ptsTex([x1, y1], [x2, y2]),
        type: 'numeric',
        answer: ratioStr(rise, run),
        check: { kind: 'line', points: [[x1, y1], [x2, y2]], want: 'slope' },
        steps: [
          { latex: `\\frac{${y2} - ${y1}}{${x2} - ${x1}}`, why: T('l2.why.riseOverRun') },
          { latex: `\\frac{${rise}}{${run}} = ${ratio(rise, run)}`, why: T('l2.why.thatIsTheRate') },
        ],
        distractors: [
          { v: ratioStr(run, rise), m: 'run-over-rise' },
          { v: String(rise), m: 'partial-rule' },
          { v: String(run), m: 'run-over-rise' },
          { v: ratioStr(y2, x2), m: 'partial-rule' },
          { v: ratioStr(rise + run, run), m: 'arith-slip' },
          { v: String(y2 - y1 + 1), m: 'arith-slip' },
          { v: ratioStr(-rise, run), m: 'sign-slip' },
        ],
      };
    },
  },
];

// ===========================================================================
// graph-linear  —  a rule drawn, and a line read back
// ===========================================================================
/**
 * A line that fits inside the chart at this band, on whole lattice points.
 *
 * The rungs here are the rate, the height it starts from, and the sign of
 * both. A band-5 trace climbs five for one and starts a dozen below the axis;
 * a band-1 trace climbs one or two and starts above it. `validate-courses`
 * measures the result, so these numbers are checked rather than claimed.
 */
// Band 5 used to climb six for one from eighteen below the axis, and the two
// skills built on this draw measured 6.83 and 6.94 at band 5 — the two easiest
// gates in the level, in a unit whose hardest gate measured 9.70. A learner
// cleared them in about fifty items and left holding 0.78. The rate and the
// start both reach further now, and the chart with them.
const MSPAN = [3, 4, 6, 8, 10];
const BSPAN = [6, 11, 17, 24, 32];
/** How far the chart reaches at each band. A wider sky holds a steeper trace. */
const CHART = [8, 13, 19, 26, 34];
function drawChartLine(r, d) {
  const lim = CHART[d - 1];
  const ms = MSPAN[d - 1];
  const bs = BSPAN[d - 1];
  // The low bands never draw a rate of one. `y = x + 5` hides the coefficient
  // altogether, which is the exact reading this unit teaches against — it is
  // the rule a cadet writes when they add the rate instead of multiplying by
  // it. It also collapses the rule to a single digit, and a single-digit
  // answer at band 1 leaves the scaffold no analogue it is allowed to show.
  const m = d >= 3 ? nz(r, -ms, ms) : int(r, 2, ms);
  if (m === 0) throw new Error('retry: a flat trace');
  if (d < 3 && Math.abs(m) === 1) throw new Error('retry: a hidden rate');
  const b = d >= 2 ? nz(r, -bs, bs) : int(r, 1, bs);
  const reach = Math.max(1, Math.min(3, Math.floor((lim - 2) / Math.abs(m))));
  const x1 = -int(r, 0, reach);
  const x2 = x1 + int(r, 1, reach);
  if (x1 === x2) throw new Error('retry: two readings at one input');
  const pts = [[x1, m * x1 + b], [x2, m * x2 + b]];
  if (pts.some((p) => Math.abs(p[1]) > lim - 1 || Math.abs(p[0]) > lim - 1)) throw new Error('retry: off chart');
  return { m, b, lim, pts };
}

const graphLinear = [
  {
    id: 'gl-plot-points', rep: 'graph', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const g = drawChartLine(r, d);
      return {
        stem: T('l2.ask.drawThroughBoth'),
        latex: ptsTex(g.pts[0], g.pts[1]),
        type: 'expression',
        answer: `y = ${lineTex(g.m, g.b)}`,
        figure: { kind: 'plot', range: fitRange(g.pts, g.b), target: { m: g.m, b: g.b }, points: g.pts },
        check: { kind: 'line', points: g.pts, want: 'equation' },
        steps: [
          { latex: `\\frac{${g.pts[1][1]} - ${g.pts[0][1]}}{${g.pts[1][0]} - ${g.pts[0][0]}} = ${g.m}`, why: T('l2.why.riseOverRun') },
          { latex: `${g.pts[0][1]} - ${g.m} \\cdot \\left(${g.pts[0][0]}\\right) = ${g.b}`, why: T('l2.why.backToTheAxis') },
          { latex: `y = ${lineTex(g.m, g.b)}`, why: T('l2.why.startIsTheAxis') },
        ],
        distractors: [
          { v: `y = ${lineTex(-g.m, g.b)}`, m: 'sign-slip' },
          { v: `y = ${lineTex(g.b, g.m)}`, m: 'slope-intercept-swap' },
          { v: `y = ${lineTex(g.m, -g.b)}`, m: 'sign-slip' },
          { v: `y = ${lineTex(g.m, 0)}`, m: 'partial-rule' },
          { v: `y = ${lineTex(g.m + 1, g.b)}`, m: 'arith-slip' },
          { v: `y = ${lineTex(g.m, g.b + 1)}`, m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'gl-plot-table', rep: 'table', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const g = drawChartLine(r, d);
      const step = g.pts[1][0] - g.pts[0][0];
      const rows = [0, 1, 2].map((i) => {
        const x = g.pts[0][0] + i * step;
        return [x, g.m * x + g.b];
      });
      if (rows.some((p) => Math.abs(p[1]) > g.lim - 1)) throw new Error('retry: off chart');
      return {
        stem: T('l2.ask.drawThroughTable'),
        latex: arrayTex('x', 'y', rows, -1),
        type: 'expression',
        answer: `y = ${lineTex(g.m, g.b)}`,
        figure: { kind: 'plot', range: fitRange(rows, g.b), target: { m: g.m, b: g.b }, points: rows.map((p) => [p[0], p[1]]) },
        check: { kind: 'line', points: [rows[0], rows[1]], want: 'equation' },
        steps: [
          { latex: `\\frac{${rows[1][1]} - ${rows[0][1]}}{${rows[1][0]} - ${rows[0][0]}} = ${g.m}`, why: T('l2.why.oneStepDownTheTable') },
          { latex: `${rows[0][1]} - ${g.m} \\cdot \\left(${rows[0][0]}\\right) = ${g.b}`, why: T('l2.why.backToTheAxis') },
          { latex: `y = ${lineTex(g.m, g.b)}`, why: T('l2.why.startIsTheAxis') },
        ],
        distractors: [
          { v: `y = ${lineTex(-g.m, g.b)}`, m: 'sign-slip' },
          { v: `y = ${lineTex(g.b, g.m)}`, m: 'slope-intercept-swap' },
          { v: `y = ${lineTex(g.m, -g.b)}`, m: 'sign-slip' },
          { v: `y = ${lineTex(g.m, 0)}`, m: 'partial-rule' },
          { v: `y = ${lineTex(g.m + 1, g.b)}`, m: 'arith-slip' },
          { v: `y = ${lineTex(g.m, g.b + 1)}`, m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'gl-read', rep: 'graph', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const g = drawChartLine(r, d);
      const at = g.pts[0][0] + int(r, 1, 1 + d);
      const y = g.m * at + g.b;
      if (Math.abs(y) > g.lim - 1) throw new Error('retry: off chart');
      return {
        stem: T('l2.ask.traceHeightAt', { val: at }),
        latex: `${ptsTex(g.pts[0], g.pts[1])} \\quad x = ${at}`,
        type: 'numeric',
        answer: String(y),
        figure: { kind: 'line', m: g.m, b: g.b, points: g.pts, at, range: fitRange(g.pts.concat([[at, y]]), g.b) },
        check: { kind: 'graph', points: g.pts, mode: 'y', at },
        steps: [
          { latex: `\\frac{${g.pts[1][1]} - ${g.pts[0][1]}}{${g.pts[1][0]} - ${g.pts[0][0]}} = ${g.m}`, why: T('l2.why.riseOverRun') },
          { latex: `${g.m} \\cdot \\left(${at}\\right) ${sg(g.b)}`, why: T('why.findColumn', { val: at }) },
          { latex: `${g.m * at} ${sg(g.b)} = ${y}`, why: T('why.readHeight') },
        ],
        distractors: [
          { v: String(at), m: 'axis-swap' },
          { v: String(g.b), m: 'slope-intercept-swap' },
          { v: String(g.m * at), m: 'partial-rule' },
          { v: String(-y), m: 'sign-slip' },
          { v: String(y + 1), m: 'arith-slip' },
          { v: String(y - 1), m: 'arith-slip' },
          { v: String(at + g.m), m: 'add-not-multiply' },
        ],
      };
    },
  },
  {
    id: 'gl-cross', rep: 'graph', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const g = drawChartLine(r, d);
      const x = g.pts[0][0] + int(r, 1, 1 + d);
      const target = g.m * x + g.b;
      if (Math.abs(target) > g.lim - 1 || Math.abs(x) > g.lim - 1) throw new Error('retry: off chart');
      return {
        stem: T('l2.ask.traceReaches', { val: target }),
        latex: `${ptsTex(g.pts[0], g.pts[1])} \\quad y = ${target}`,
        type: 'numeric',
        answer: String(x),
        figure: { kind: 'line', m: g.m, b: g.b, points: g.pts, target, range: fitRange(g.pts.concat([[x, target]]), g.b) },
        check: { kind: 'graph', points: g.pts, mode: 'x', at: target },
        steps: [
          { latex: `\\frac{${g.pts[1][1]} - ${g.pts[0][1]}}{${g.pts[1][0]} - ${g.pts[0][0]}} = ${g.m}`, why: T('l2.why.riseOverRun') },
          { latex: `${target} ${sg(-g.b)} = ${target - g.b}`, why: T('why.heightIsEquation', { val: target }) },
          { latex: `\\frac{${target - g.b}}{${g.m}} = ${x}`, why: T('why.divideBothByCoef', { a: g.m }) },
        ],
        distractors: [
          { v: String(target), m: 'axis-swap' },
          { v: String(g.b), m: 'slope-intercept-swap' },
          { v: String(-x), m: 'sign-slip' },
          { v: String(target - g.b), m: 'partial-rule' },
          { v: String(x + 1), m: 'arith-slip' },
          { v: String(x - 1), m: 'arith-slip' },
          { v: String(g.m * target), m: 'div-direction' },
        ],
      };
    },
  },
  {
    // Key features off a statement in standard form. TEKS A.3(C) names the
    // x-intercept and the y-intercept, and neither is legible until the
    // statement is opened.
    id: 'gl-standard', rep: 'symbolic', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const a = nzc(r, 2, 2 + Math.min(d, 3));
      const b = nzc(r, 2, 2 + Math.min(d, 3));
      const q = nz(r, -(d - 1), d - 1);
      const c = a * b * q;                 // both intercepts land on whole numbers
      const wantX = r() < 0.5;
      const ans = wantX ? c / a : c / b;
      if (!distinct(a, b, c, ans)) throw new Error('retry: repeated number');
      const math = `${lin(a, 'x', 0)} ${signedTerm(b, 'y')} = ${c}`;
      return {
        stem: T(wantX ? 'l2.ask.crossesAcross' : 'l2.ask.crossesUpright'),
        latex: math,
        type: 'numeric',
        answer: String(ans),
        check: { kind: 'lineEquation', math, want: wantX ? 'xintercept' : 'intercept' },
        steps: [
          {
            latex: wantX ? `${lin(a, 'x', 0)} = ${c}` : `${co(b, 'y')} = ${c}`,
            why: T(wantX ? 'l2.why.otherIsZeroAcross' : 'l2.why.otherIsZeroUpright'),
          },
          { latex: `\\frac{${c}}{${wantX ? a : b}} = ${ans}`, why: T('why.divideBothByCoef', { a: wantX ? a : b }) },
        ],
        distractors: [
          { v: String(wantX ? c / b : c / a), m: 'axis-swap' },
          { v: String(-ans), m: 'sign-slip' },
          { v: String(c), m: 'partial-rule' },
          { v: ratioStr(wantX ? -a : -b, wantX ? b : a), m: 'slope-intercept-swap' },
          { v: String(ans + 1), m: 'arith-slip' },
          { v: String(ans - 1), m: 'arith-slip' },
          { v: String(a + b), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'gl-context', rep: 'context', dMin: 1, dMax: 5,
    sceneKeys: KEYS(RULES),
    build({ r, d, T, sr }) {
      const sc = scene(sr, RULES);
      const lim = CHART[d - 1];
      const m = int(r, 2, MSPAN[d - 1] + d);
      const b = int(r, 2, Math.max(3, lim - 3));
      const pts = [[0, b], [1, m + b]];
      if (Math.abs(pts[1][1]) > lim - 1) throw new Error('retry: off chart');
      return {
        stem: `${T(sc.ctx)} ${T(sc.draw)}`,
        latex: ptsTex(pts[0], pts[1]),
        type: 'expression',
        answer: `y = ${lineTex(m, b)}`,
        figure: { kind: 'plot', range: fitRange(pts, b), target: { m, b }, points: pts },
        check: { kind: 'line', points: pts, want: 'equation' },
        steps: [
          { latex: `\\frac{${pts[1][1]} - ${pts[0][1]}}{${pts[1][0]} - ${pts[0][0]}} = ${m}`, why: T('l2.why.riseOverRun') },
          { latex: `${pts[1][1]} - ${m} = ${b}`, why: T('l2.why.backToTheAxis') },
          { latex: `y = ${lineTex(m, b)}`, why: T('l2.why.startIsTheAxis') },
        ],
        distractors: [
          { v: `y = ${lineTex(b, m)}`, m: 'slope-intercept-swap' },
          { v: `y = ${lineTex(-m, b)}`, m: 'sign-slip' },
          { v: `y = ${lineTex(m, 0)}`, m: 'partial-rule' },
          { v: `y = ${lineTex(m, -b)}`, m: 'sign-slip' },
          { v: `y = ${lineTex(m + 1, b)}`, m: 'arith-slip' },
          { v: `y = ${lineTex(m, b + 1)}`, m: 'arith-slip' },
        ],
      };
    },
  },
];

// ===========================================================================
// write-linear  —  the rule written down
// ===========================================================================
const RULE_SKELETON = 'y = \\square x + \\square';

/** The six rules a learner writes instead of the right one. */
function ruleWrong(m, b) {
  return [
    { v: `y = ${lineTex(b, m)}`, m: 'slope-intercept-swap' },
    { v: `y = ${lineTex(-m, b)}`, m: 'sign-slip' },
    { v: `y = ${lineTex(m, -b)}`, m: 'sign-on-constant' },
    { v: `y = ${lineTex(m, 0)}`, m: 'partial-rule' },
    { v: `y = ${lineTex(m + 1, b)}`, m: 'arith-slip' },
    { v: `y = ${lineTex(m, b + 1)}`, m: 'arith-slip' },
  ];
}

const writeLinear = [
  {
    id: 'wl-points', rep: 'symbolic', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const g = drawChartLine(r, d);
      return {
        stem: T('l2.ask.writeTheRule'),
        latex: `${ptsTex(g.pts[0], g.pts[1])} \\qquad ${RULE_SKELETON}`,
        type: 'expression',
        answer: `y = ${lineTex(g.m, g.b)}`,
        check: { kind: 'line', points: g.pts, want: 'equation' },
        steps: [
          { latex: `\\frac{${g.pts[1][1]} - ${g.pts[0][1]}}{${g.pts[1][0]} - ${g.pts[0][0]}} = ${g.m}`, why: T('l2.why.riseOverRun') },
          { latex: `${g.pts[0][1]} - ${g.m} \\cdot \\left(${g.pts[0][0]}\\right) = ${g.b}`, why: T('l2.why.backToTheAxis') },
          { latex: `y = ${lineTex(g.m, g.b)}`, why: T('l2.why.startIsTheAxis') },
        ],
        distractors: ruleWrong(g.m, g.b),
      };
    },
  },
  {
    id: 'wl-table', rep: 'table', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const g = drawChartLine(r, d);
      const step = int(r, 1, 1 + Math.floor(d / 2));
      const rows = [0, 1, 2, 3].map((i) => {
        const x = g.pts[0][0] + i * step;
        return [x, g.m * x + g.b];
      });
      return {
        stem: T('l2.ask.writeTheRule'),
        latex: `${arrayTex('x', 'y', rows, -1)} \\qquad ${RULE_SKELETON}`,
        type: 'expression',
        answer: `y = ${lineTex(g.m, g.b)}`,
        check: { kind: 'line', points: [rows[0], rows[1]], want: 'equation' },
        steps: [
          { latex: `\\frac{${rows[1][1]} - ${rows[0][1]}}{${rows[1][0]} - ${rows[0][0]}} = ${g.m}`, why: T('l2.why.oneStepDownTheTable') },
          { latex: `${rows[0][1]} - ${g.m} \\cdot \\left(${rows[0][0]}\\right) = ${g.b}`, why: T('l2.why.backToTheAxis') },
          { latex: `y = ${lineTex(g.m, g.b)}`, why: T('l2.why.startIsTheAxis') },
        ],
        distractors: ruleWrong(g.m, g.b),
      };
    },
  },
  {
    id: 'wl-graph', rep: 'graph', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const g = drawChartLine(r, d);
      return {
        stem: T('l2.ask.writeTheTrace'),
        latex: RULE_SKELETON,
        type: 'expression',
        answer: `y = ${lineTex(g.m, g.b)}`,
        figure: { kind: 'line', m: g.m, b: g.b, points: g.pts, range: fitRange(g.pts, g.b) },
        check: { kind: 'line', points: g.pts, want: 'equation' },
        steps: [
          { latex: `\\frac{${g.pts[1][1]} - ${g.pts[0][1]}}{${g.pts[1][0]} - ${g.pts[0][0]}} = ${g.m}`, why: T('l2.why.riseOverRun') },
          { latex: `${g.pts[0][1]} - ${g.m} \\cdot \\left(${g.pts[0][0]}\\right) = ${g.b}`, why: T('l2.why.backToTheAxis') },
          { latex: `y = ${lineTex(g.m, g.b)}`, why: T('l2.why.startIsTheAxis') },
        ],
        distractors: ruleWrong(g.m, g.b),
      };
    },
  },
  {
    // The same line, said the other way. TEKS A.2(B) asks for the rule in
    // various forms, and turning Ax + By = C into y = mx + b is the turn a
    // learner needs before any of the graphing work is usable.
    id: 'wl-standard', rep: 'symbolic', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const b = nzc(r, 2, 2 + d);
      const m = nz(r, -(1 + d), 1 + d);
      const k = nz(r, -(3 + d), 3 + d);
      if (m === 0 || k === 0) throw new Error('retry: a flat trace');
      const a = -m * b;
      const c = k * b;
      if (a === 0 || !distinct(a, b, c, m, k)) throw new Error('retry: repeated number');
      const math = `${lin(a, 'x', 0)} ${signedTerm(b, 'y')} = ${c}`;
      return {
        stem: T('l2.ask.sameLineOtherWay'),
        latex: `${math} \\;\\Rightarrow\\; ${RULE_SKELETON}`,
        type: 'expression',
        answer: `y = ${lineTex(m, k)}`,
        check: { kind: 'lineEquation', math, want: 'equation' },
        steps: [
          { latex: `${co(b, 'y')} = ${lin(-a, 'x', c)}`, why: T('l2.why.gatherYAlone') },
          { latex: `y = ${lineTex(m, k)}`, why: T('l2.why.divideByCoefOfY', { b }) },
        ],
        distractors: [
          { v: `y = ${lineTex(-m, k)}`, m: 'sign-slip' },
          { v: `y = ${lineTex(a, c)}`, m: 'partial-rule' },
          { v: `y = ${lineTex(k, m)}`, m: 'slope-intercept-swap' },
          { v: `y = ${lineTex(m, -k)}`, m: 'sign-on-constant' },
          { v: `y = ${lineTex(m, c)}`, m: 'partial-rule' },
          { v: `y = ${lineTex(m + 1, k)}`, m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'wl-context', rep: 'context', dMin: 1, dMax: 5,
    sceneKeys: KEYS(RULES),
    build({ r, d, T, sr }) {
      const sc = scene(sr, RULES);
      const m = d >= 3 ? nz(r, -(2 + 2 * d), 2 + 2 * d) : int(r, 2, 2 + 2 * d);
      const b = d >= 2 ? nz(r, -(4 + 3 * d), 4 + 3 * d) : int(r, 1, 7);
      if (m === 0 || b === 0 || !distinct(m, b)) throw new Error('retry: repeated number');
      const pts = [[0, b], [1, m + b]];
      return {
        stem: `${T(sc.ctx)} ${T(sc.write)}`,
        latex: `${ptsTex(pts[0], pts[1])} \\qquad ${RULE_SKELETON}`,
        type: 'expression',
        answer: `y = ${lineTex(m, b)}`,
        check: { kind: 'line', points: pts, want: 'equation' },
        steps: [
          { latex: `${pts[1][1]} - ${pts[0][1]} = ${m}`, why: T('l2.why.oneStepIsTheRate') },
          { latex: `${pts[0][1]} = ${b}`, why: T('l2.why.startIsTheAxis') },
          { latex: `y = ${lineTex(m, b)}`, why: T('l2.why.writeTheRuleDown') },
        ],
        distractors: ruleWrong(m, b),
      };
    },
  },
];

// ===========================================================================
// system-substitution  —  one letter already alone
// ===========================================================================
/**
 * A pair of statements meeting at whole numbers, the first already solved for y.
 *
 * FIVE RUNGS, NOT ONE SETTING MEASURED FIVE TIMES.
 *
 * This draw used to run 8.20 8.55 8.59 8.95 9.22 across the five bands — a span
 * of 14.6%, under the 15% floor, with band 3 asking 0.5% more than band 2.
 * `check:courses` named both, and it was right: adaptivity was moving a learner
 * between five settings that are one setting. It came from starting high and
 * having nowhere to go — band 1 already drew a negative constant, a two-digit
 * total and a signed rate, because everything a system needs is expensive
 * (two unknowns to hold, three worked lines, a bracketed substitution) before
 * a single digit is chosen.
 *
 * So the sign enters ONE PART AT A TIME and the magnitudes climb underneath it:
 *
 *   band 1-2  every number positive. Meeting two statements at one point is
 *             enough new work on its own.
 *   band 3    the constant may be negative — the first sign to carry, and it
 *             is carried through one substitution.
 *   band 4    the rate and the second coefficient may be negative too.
 *   band 5    the meeting point itself may sit behind either axis.
 *
 * `b` is now DRAWN and `y` derived from it, rather than the other way round,
 * because that is the only way a band can promise the constant's sign. The
 * measured ladder is printed by `tools/simulate.mjs` and gated by
 * `tools/critic/ladder.mjs`; neither is asserted here.
 */
const SS_X = [3, 4, 5, 6, 7];
const SS_M = [3, 4, 4, 5, 5];
const SS_A = [4, 4, 5, 5, 6];
const SS_B = [4, 6, 7, 8, 10];
function drawSubSystem(r, d) {
  const x = d >= 5 ? nz(r, -SS_X[d - 1], SS_X[d - 1]) : int(r, 1, SS_X[d - 1]);
  const m = d >= 4 ? nzc(r, -SS_M[d - 1], SS_M[d - 1]) : int(r, 2, SS_M[d - 1]);
  const b = d >= 3 ? nz(r, -SS_B[d - 1], SS_B[d - 1]) : int(r, 1, SS_B[d - 1]);
  const a = d >= 4 ? nzc(r, -SS_A[d - 1], SS_A[d - 1]) : int(r, 2, SS_A[d - 1]);
  const y = m * x + b;
  const c = a * x + y;
  if (b === 0 || y === 0 || !distinct(a, b, c, m)) throw new Error('retry: repeated number');
  const e1 = `y = ${lin(m, 'x', b)}`;
  const e2 = `${lin(a, 'x', 0)} + y = ${c}`;
  return { x, y, m, b, a, c, e1, e2, latex: `\\begin{cases} ${e1} \\\\ ${e2} \\end{cases}` };
}

const systemSubstitution = [
  {
    id: 'ss-forx', rep: 'symbolic', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const s = drawSubSystem(r, d);
      return {
        stem: T('l2.ask.findX'),
        latex: s.latex,
        type: 'numeric',
        answer: String(s.x),
        check: { kind: 'system', eqs: [s.e1, s.e2], vars: ['x', 'y'], want: 'x' },
        steps: [
          { latex: `${lin(s.a, 'x', 0)} + ${lin(s.m, 'x', s.b)} = ${s.c}`, why: T('l2.why.putTheRuleIn') },
          { latex: `${lin(s.a + s.m, 'x', s.b)} = ${s.c}`, why: T('why.gatherSameKind', { v: 'x' }) },
          { latex: `x = ${s.x}`, why: T('why.divideBothByCoef', { a: s.a + s.m }) },
        ],
        distractors: [
          { v: String(s.y), m: 'axis-swap' },
          { v: String(-s.x), m: 'sign-slip' },
          { v: String(s.c - s.b), m: 'partial-rule' },
          { v: String(s.x + 1), m: 'arith-slip' },
          { v: String(s.x - 1), m: 'arith-slip' },
          { v: String(s.b), m: 'partial-rule' },
          { v: String(s.c), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'ss-fory', rep: 'symbolic', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const s = drawSubSystem(r, d);
      return {
        stem: T('l2.ask.findY'),
        latex: s.latex,
        type: 'numeric',
        answer: String(s.y),
        check: { kind: 'system', eqs: [s.e1, s.e2], vars: ['x', 'y'], want: 'y' },
        steps: [
          { latex: `${lin(s.a, 'x', 0)} + ${lin(s.m, 'x', s.b)} = ${s.c}`, why: T('l2.why.putTheRuleIn') },
          { latex: `x = ${s.x}`, why: T('l2.why.oneLetterAtATime') },
          { latex: `y = ${s.m} \\cdot \\left(${s.x}\\right) ${sg(s.b)} = ${s.y}`, why: T('l2.why.backIntoTheRule') },
        ],
        distractors: [
          { v: String(s.x), m: 'axis-swap' },
          { v: String(-s.y), m: 'sign-slip' },
          { v: String(s.b), m: 'partial-rule' },
          { v: String(s.y + 1), m: 'arith-slip' },
          { v: String(s.y - 1), m: 'arith-slip' },
          { v: String(s.m * s.x), m: 'partial-rule' },
          { v: String(s.c), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'ss-pair', rep: 'verbal', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const s = drawSubSystem(r, d);
      return {
        stem: T('l2.ask.whichPairHoldsBoth'),
        latex: `${s.latex} \\qquad \\left(\\square, \\square\\right)`,
        type: 'expression',
        answer: pointTex(s.x, s.y),
        check: { kind: 'system', eqs: [s.e1, s.e2], vars: ['x', 'y'], want: 'pair' },
        steps: [
          { latex: `${lin(s.a, 'x', 0)} + ${lin(s.m, 'x', s.b)} = ${s.c}`, why: T('l2.why.putTheRuleIn') },
          { latex: `x = ${s.x}`, why: T('l2.why.oneLetterAtATime') },
          { latex: `y = ${s.y}`, why: T('l2.why.backIntoTheRule') },
        ],
        distractors: [
          { v: pointTex(s.y, s.x), m: 'axis-swap' },
          { v: pointTex(-s.x, s.y), m: 'sign-slip' },
          { v: pointTex(s.x, -s.y), m: 'sign-slip' },
          { v: pointTex(s.x + 1, s.y), m: 'arith-slip' },
          { v: pointTex(s.x, s.y + 1), m: 'arith-slip' },
          { v: pointTex(s.b, s.c), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'ss-context', rep: 'context', dMin: 1, dMax: 5,
    sceneKeys: KEYS(PAIRS),
    build({ r, d, T, sr }) {
      const sc = scene(sr, PAIRS);
      // Counts of real things, so `x` and `y` stay positive at every band; the
      // rungs are the size of the totals and the sign of the CONSTANT, which is
      // a coefficient in the statement rather than a count of anything. Same
      // shape as `drawSubSystem` above, and for the same reason.
      const x = int(r, 2, SS_X[d - 1]);
      const m = int(r, 2, SS_M[d - 1]);
      const b = d >= 3 ? nz(r, -SS_B[d - 1], SS_B[d - 1]) : int(r, 1, SS_B[d - 1]);
      const y = m * x + b;
      const a = int(r, 2, SS_A[d - 1]);
      const c = a * x + y;
      if (y < 2 || b === 0 || x === y || !distinct(a, b, c, m)) throw new Error('retry: repeated number');
      const e1 = `y = ${lin(m, 'x', b)}`;
      const e2 = `${lin(a, 'x', 0)} + y = ${c}`;
      return {
        stem: `${T(sc.ctx)} ${T(sc.x)}`,
        latex: `\\begin{cases} ${e1} \\\\ ${e2} \\end{cases}`,
        type: 'numeric',
        answer: String(x),
        check: { kind: 'system', eqs: [e1, e2], vars: ['x', 'y'], want: 'x' },
        steps: [
          { latex: `${lin(a, 'x', 0)} + ${lin(m, 'x', b)} = ${c}`, why: T('l2.why.putTheRuleIn') },
          { latex: `${lin(a + m, 'x', b)} = ${c}`, why: T('why.gatherSameKind', { v: 'x' }) },
          { latex: `x = ${x}`, why: T('why.divideBothByCoef', { a: a + m }) },
        ],
        distractors: [
          { v: String(y), m: 'axis-swap' },
          { v: String(c - b), m: 'partial-rule' },
          { v: String(x + 1), m: 'arith-slip' },
          { v: String(x - 1), m: 'arith-slip' },
          { v: String(b), m: 'partial-rule' },
          { v: String(c), m: 'partial-rule' },
          { v: String(m), m: 'partial-rule' },
        ],
      };
    },
  },
];

// ===========================================================================
// system-elimination  —  add until one letter leaves
// ===========================================================================
/** Two statements in standard form whose y-terms are already opposite. */
// The low bands draw from a WIDE window at a LOW magnitude, not a narrow one.
// Measured before this was true, band 1 of this form held 64 distinct systems
// and 72% of them had no analogue at all: every candidate the scaffold
// auditioned printed a digit of the live answer somewhere, because there were
// barely any digits left to print. An item with no analogue falls back on the
// learner's own trace, which is the one trace that contains the live answer —
// so a narrow pool is not a gentler question, it is a leaking echo.
// The bands, spelled out. Elimination measured 8.20 at band 1 — the hardest
// opening in the level and harder than most other skills' band 5 — because
// every draw was already two digits wide before the mathematics started. The
// four totals a learner has to hold are what makes this expensive; the digits
// inside them are what the ladder is allowed to move, so they start small and
// the sign enters at band 4 rather than band 3.
const EL_X = [4, 5, 6, 6, 10];
const EL_A = [4, 5, 5, 6, 10];
const EL_B = [4, 5, 6, 6, 8];
function drawElimSystem(r, d, { scaled = false } = {}) {
  const x = d >= 4 ? nz(r, -EL_X[d - 1], EL_X[d - 1]) : int(r, 1, EL_X[d - 1]);
  const y = d >= 4 ? nz(r, -EL_X[d - 1], EL_X[d - 1]) : int(r, 1, EL_X[d - 1]);
  const a1 = d >= 4 ? nzc(r, -EL_A[d - 1], EL_A[d - 1]) : int(r, 2, EL_A[d - 1]);
  const a2 = d >= 4 ? nzc(r, -EL_A[d - 1], EL_A[d - 1]) : int(r, 2, EL_A[d - 1]);
  // A scaled pair multiplies one whole statement, so its second coefficient is
  // `b1 * k` and its second total grows with the product. The smaller `b1` and
  // the capped `k` are what keep `se-scale` from standing a point and a half
  // above every other form in the level.
  const b1 = nzc(r, 2, scaled ? Math.max(2, EL_B[d - 1] - 2) : EL_B[d - 1]);
  const k = scaled ? int(r, 2, 3) : 1;
  const b2 = -b1 * k;
  if (a1 * b2 - a2 * b1 === 0) throw new Error('retry: the traces never meet');
  if (!distinct(a1, a2, b1, k)) throw new Error('retry: repeated number');
  const c1 = a1 * x + b1 * y;
  const c2 = a2 * x + b2 * y;
  const e1 = `${lin(a1, 'x', 0)} ${signedTerm(b1, 'y')} = ${c1}`;
  const e2 = `${lin(a2, 'x', 0)} ${signedTerm(b2, 'y')} = ${c2}`;
  return { x, y, a1, a2, b1, b2, c1, c2, k, e1, e2, latex: `\\begin{cases} ${e1} \\\\ ${e2} \\end{cases}` };
}

const systemElimination = [
  {
    id: 'se-add', rep: 'symbolic', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const s = drawElimSystem(r, d);
      return {
        stem: T('l2.ask.findX'),
        latex: s.latex,
        type: 'numeric',
        answer: String(s.x),
        check: { kind: 'system', eqs: [s.e1, s.e2], vars: ['x', 'y'], want: 'x' },
        steps: [
          { latex: `${lin(s.a1 + s.a2, 'x', 0)} = ${s.c1 + s.c2}`, why: T('l2.why.addTheStatements') },
          { latex: `x = ${s.x}`, why: T('why.divideBothByCoef', { a: s.a1 + s.a2 }) },
        ],
        distractors: [
          { v: String(s.y), m: 'axis-swap' },
          { v: String(-s.x), m: 'sign-slip' },
          { v: String(s.c1 + s.c2), m: 'partial-rule' },
          { v: String(s.x + 1), m: 'arith-slip' },
          { v: String(s.x - 1), m: 'arith-slip' },
          { v: String(s.c1 - s.c2), m: 'subtract-not-add' },
          { v: String(s.a1 + s.a2), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'se-scale', rep: 'symbolic', dMin: 3, dMax: 5,
    build({ r, d, T }) {
      const s = drawElimSystem(r, d, { scaled: true });
      return {
        stem: T('l2.ask.findX'),
        latex: s.latex,
        type: 'numeric',
        answer: String(s.x),
        check: { kind: 'system', eqs: [s.e1, s.e2], vars: ['x', 'y'], want: 'x' },
        steps: [
          { latex: `${lin(s.a1 * s.k, 'x', 0)} ${signedTerm(s.b1 * s.k, 'y')} = ${s.c1 * s.k}`, why: T('l2.why.scaleUntilOpposite', { k: s.k }) },
          { latex: `${lin(s.a1 * s.k + s.a2, 'x', 0)} = ${s.c1 * s.k + s.c2}`, why: T('l2.why.addTheStatements') },
          { latex: `x = ${s.x}`, why: T('why.divideBothByCoef', { a: s.a1 * s.k + s.a2 }) },
        ],
        distractors: [
          { v: String(s.y), m: 'axis-swap' },
          { v: String(-s.x), m: 'sign-slip' },
          { v: String(s.c1 + s.c2), m: 'partial-rule' },
          { v: String(s.x + 1), m: 'arith-slip' },
          { v: String(s.x - 1), m: 'arith-slip' },
          { v: String(s.c1 * s.k + s.c2), m: 'partial-rule' },
          { v: String(s.k), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'se-fory', rep: 'symbolic', dMin: 2, dMax: 5,
    build({ r, d, T }) {
      const s = drawElimSystem(r, d);
      return {
        stem: T('l2.ask.findY'),
        latex: s.latex,
        type: 'numeric',
        answer: String(s.y),
        check: { kind: 'system', eqs: [s.e1, s.e2], vars: ['x', 'y'], want: 'y' },
        steps: [
          { latex: `${lin(s.a1 + s.a2, 'x', 0)} = ${s.c1 + s.c2}`, why: T('l2.why.addTheStatements') },
          { latex: `x = ${s.x}`, why: T('l2.why.oneLetterAtATime') },
          { latex: `y = ${s.y}`, why: T('l2.why.backIntoEitherStatement') },
        ],
        distractors: [
          { v: String(s.x), m: 'axis-swap' },
          { v: String(-s.y), m: 'sign-slip' },
          { v: String(s.c1 + s.c2), m: 'partial-rule' },
          { v: String(s.y + 1), m: 'arith-slip' },
          { v: String(s.y - 1), m: 'arith-slip' },
          { v: String(s.c1), m: 'partial-rule' },
          { v: String(s.b1), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'se-context', rep: 'context', dMin: 1, dMax: 5,
    sceneKeys: KEYS(PAIRS),
    build({ r, d, T, sr }) {
      const sc = scene(sr, PAIRS);
      // Counts again, so nothing here goes negative; the rungs are magnitude.
      const x = int(r, 2, EL_X[d - 1]);
      const y = int(r, 2, EL_X[d - 1]);
      const a1 = int(r, 2, EL_A[d - 1]);
      const a2 = int(r, 2, EL_A[d - 1]);
      const b1 = int(r, 2, EL_B[d - 1]);
      const b2 = -b1;
      if (a1 * b2 - a2 * b1 === 0) throw new Error('retry: the traces never meet');
      if (!distinct(a1, a2, b1) || x === y) throw new Error('retry: repeated number');
      const c1 = a1 * x + b1 * y;
      const c2 = a2 * x + b2 * y;
      const e1 = `${lin(a1, 'x', 0)} + ${b1}y = ${c1}`;
      const e2 = `${lin(a2, 'x', 0)} - ${b1}y = ${c2}`;
      return {
        stem: `${T(sc.ctx)} ${T(sc.y)}`,
        latex: `\\begin{cases} ${e1} \\\\ ${e2} \\end{cases}`,
        type: 'numeric',
        answer: String(y),
        check: { kind: 'system', eqs: [e1, e2], vars: ['x', 'y'], want: 'y' },
        steps: [
          { latex: `${lin(a1 + a2, 'x', 0)} = ${c1 + c2}`, why: T('l2.why.addTheStatements') },
          { latex: `x = ${x}`, why: T('l2.why.oneLetterAtATime') },
          { latex: `y = ${y}`, why: T('l2.why.backIntoEitherStatement') },
        ],
        distractors: [
          { v: String(x), m: 'axis-swap' },
          { v: String(c1 + c2), m: 'partial-rule' },
          { v: String(y + 1), m: 'arith-slip' },
          { v: String(y - 1), m: 'arith-slip' },
          { v: String(c1 - c2), m: 'subtract-not-add' },
          { v: String(c1), m: 'partial-rule' },
          { v: String(b1), m: 'partial-rule' },
        ],
      };
    },
  },
];

// ---------------------------------------------------------------------------
// bracket-both-sides —  a(x + b) = c(x + d)      (shipped in the first Level 2)
// ---------------------------------------------------------------------------
/**
 * Draw an equation with a bracket on each side that has a whole-number answer.
 * `a` and `c` must differ, or the letters cancel and the statement is either
 * always true or never true — a different skill, and one Level 1 already owns.
 */
// `positive` — a hold cannot carry a negative mass, so the contextual form used
// to draw from the signed pool and throw away every draw that came back
// negative. With the magnitudes brought down that pool got thin enough to
// exhaust a 120-seed budget at band 3, so it draws positives directly instead,
// over a range wide enough to keep `e` landing on a whole number.
function drawBrackets(r, d, { negOutside = false, positive = false } = {}) {
  const v = pick(r, VARS);
  const x = positive ? int(r, 1, 4 + 2 * d) : (d >= 3 ? nz(r, -(2 + d), 2 + d) : int(r, 1, 3 + d));
  const a = negOutside ? -Math.abs(nzc(r, 2, 2 + d)) : (positive ? int(r, 2, 3 + d) : nzc(r, 2, 2 + d));
  let c = positive ? int(r, 2, 3 + d) : nzc(r, 2, 2 + d);
  if (a === c) c = Math.abs(a) >= 9 ? 2 : Math.abs(a) + 1;
  const b = positive ? int(r, 1, 5 + 2 * d) : (d >= 2 ? nz(r, -(3 + 2 * d), 3 + 2 * d) : int(r, 1, 6));
  // The right-hand bracket's constant is forced, so the solution is the whole
  // number drawn above rather than whatever the arithmetic happens to give.
  //   a(x + b) = c(x + e)  =>  e = ((a - c)x + ab) / c
  const num = (a - c) * x + a * b;
  if (num % c !== 0) throw new Error('retry: this draw does not land on a whole number');
  const e = num / c;
  if (e === 0 || b === 0) throw new Error('retry: an empty bracket is a different question');
  if (!distinct(a, b, c, e, x)) throw new Error('retry: repeated number');
  return { v, x, a, b, c, e };
}

const bracketBothSides = [
  {
    id: 'bbs-symbolic', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const { v, x, a, b, c, e } = drawBrackets(r, d);
      const eqn = `${paren(a, lin(1, v, b))} = ${paren(c, lin(1, v, e))}`;
      const L = lin(a, v, a * b);   // opened left
      const Rt = lin(c, v, c * e);  // opened right
      return {
        stem: T('ask.solveFor', { v }),
        latex: eqn,
        type: 'numeric',
        answer: String(x),
        check: { kind: 'solve', math: eqn, variable: v },
        steps: [
          { latex: `${L} = ${Rt}`, why: T('l2.why.openBothBrackets') },
          { latex: `${lin(a - c, v, a * b)} = ${c * e}`, why: T('why.gatherUnknownOneSide', { term: co(c, v) }) },
          { latex: `${co(a - c, v)} = ${c * e - a * b}`, why: T('why.unwrapConstantFirst') },
          { latex: `${v} = ${x}`, why: T('why.divideBothByCoef', { a: a - c }) },
        ],
        distractors: [
          // the bracket opened onto the letter only, on one side or both
          { v: String(safeDiv((c * e) - a * b, a - c) + 1), m: 'arith-slip' },
          { v: String(safeDiv(e - b, a - c)), m: 'partial-distribute' },
          { v: String(safeDiv(c * e - b, a - c)), m: 'partial-distribute' },
          { v: String(safeDiv(a * b - c * e, a - c)), m: 'collect-wrong-side' },
          { v: String(safeDiv(c * e - a * b, a + c)), m: 'collect-wrong-side' },
          { v: String(-x), m: 'sign-slip' },
          { v: String(x - 1), m: 'arith-slip' },
          { v: String(c * e - a * b), m: 'one-side-only' },
        ],
      };
    },
  },
  {
    id: 'bbs-negative', rep: 'symbolic', dMin: 3, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const { v, x, a, b, c, e } = drawBrackets(r, d, { negOutside: true });
      const eqn = `${paren(a, lin(1, v, b))} = ${paren(c, lin(1, v, e))}`;
      return {
        stem: T('ask.solveFor', { v }),
        latex: eqn,
        type: 'numeric',
        answer: String(x),
        check: { kind: 'solve', math: eqn, variable: v },
        steps: [
          { latex: `${lin(a, v, a * b)} = ${lin(c, v, c * e)}`, why: T('l2.why.minusEntersEveryTerm') },
          { latex: `${lin(a - c, v, a * b)} = ${c * e}`, why: T('why.gatherUnknownOneSide', { term: co(c, v) }) },
          { latex: `${co(a - c, v)} = ${c * e - a * b}`, why: T('why.unwrapConstantFirst') },
          { latex: `${v} = ${x}`, why: T('why.divideBothByCoef', { a: a - c }) },
        ],
        distractors: [
          { v: String(safeDiv(c * e - (a * b - 2 * a * b), a - c)), m: 'neg-distribute' },
          { v: String(safeDiv(c * e + a * b, a - c)), m: 'neg-distribute' },
          { v: String(safeDiv(a * b - c * e, a - c)), m: 'collect-wrong-side' },
          { v: String(safeDiv(c * e - a * b, a + c)), m: 'collect-wrong-side' },
          { v: String(-x), m: 'sign-slip' },
          { v: String(x + 1), m: 'arith-slip' },
          { v: String(safeDiv(e - b, a - c)), m: 'partial-distribute' },
        ],
      };
    },
  },
  {
    id: 'bbs-context', rep: 'context', dMin: 1, dMax: 5, distinctNums: true,
    sceneKeys: KEYS(HOLDS),
    build({ r, d, T, sr }) {
      const { v, x, a, b, c, e } = drawBrackets(r, d, { positive: true });
      if (e < 0) throw new Error('retry: a hold cannot carry a negative mass');
      const eqn = `${paren(a, lin(1, v, b))} = ${paren(c, lin(1, v, e))}`;
      const sc = scene(sr, HOLDS);
      return {
        stem: `${T(sc.ctx)} ${T(sc.ask, { v })}`,
        latex: eqn,
        type: 'numeric',
        answer: String(x),
        check: { kind: 'solve', math: eqn, variable: v },
        steps: [
          { latex: `${lin(a, v, a * b)} = ${lin(c, v, c * e)}`, why: T('l2.why.openBothBrackets') },
          { latex: `${lin(a - c, v, a * b)} = ${c * e}`, why: T('why.gatherUnknownOneSide', { term: co(c, v) }) },
          { latex: `${co(a - c, v)} = ${c * e - a * b}`, why: T('why.unwrapConstantFirst') },
          { latex: `${v} = ${x}`, why: T('why.divideBothByCoef', { a: a - c }) },
        ],
        distractors: [
          { v: String(safeDiv(e - b, a - c)), m: 'partial-distribute' },
          { v: String(safeDiv(c * e - b, a - c)), m: 'partial-distribute' },
          { v: String(safeDiv(a * b - c * e, a - c)), m: 'collect-wrong-side' },
          { v: String(safeDiv(c * e - a * b, a + c)), m: 'collect-wrong-side' },
          { v: String(c * e - a * b), m: 'one-side-only' },
          { v: String(x + 1), m: 'arith-slip' },
          { v: String(x - 1), m: 'arith-slip' },
        ],
      };
    },
  },
  {
    // THE FIRST LINE, not the answer.
    //
    // Three item forms is not a bank, it is a rehearsal: the gate asks for an
    // item in a form the learner has not practised, and with three forms and
    // two required representations there is never one left. Measured across
    // the level, only 2% of gate items were in an unseen form against 68% in
    // Level 1, and true mastery fell from 100% to 62%. So the thin skills get
    // a fourth form, in a representation they did not have — and it is the one
    // that isolates the misconception this node is really about: opening a
    // bracket onto the letter and leaving the number behind.
    id: 'bbs-firstline', rep: 'verbal', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const { v, x, a, b, c, e } = drawBrackets(r, d);
      const eqn = `${paren(a, lin(1, v, b))} = ${paren(c, lin(1, v, e))}`;
      const opened = `${lin(a, v, a * b)} = ${lin(c, v, c * e)}`;
      return {
        stem: T('l2.ask.whichFirstLine'),
        latex: asks(eqn),
        type: 'expression',
        answer: opened,
        check: { kind: 'equationChoice', variable: v, expect: String(x) },
        steps: [
          { latex: `${paren(a, lin(1, v, b))} = ${lin(a, v, a * b)}`, why: T('l2.why.openBothBrackets') },
          { latex: `${paren(c, lin(1, v, e))} = ${lin(c, v, c * e)}`, why: T('l2.why.openBothBrackets') },
        ],
        distractors: [
          { v: `${lin(a, v, b)} = ${lin(c, v, c * e)}`, m: 'partial-distribute' },
          { v: `${lin(a, v, a * b)} = ${lin(c, v, e)}`, m: 'partial-distribute' },
          { v: `${lin(a, v, b)} = ${lin(c, v, e)}`, m: 'partial-distribute' },
          { v: `${lin(a, v, -a * b)} = ${lin(c, v, c * e)}`, m: 'neg-distribute' },
          { v: `${lin(a, v, a * b)} = ${lin(c, v, -c * e)}`, m: 'neg-distribute' },
          { v: `${lin(a, v, a * b)} = ${lin(c, v, c * e + 1)}`, m: 'arith-slip' },
          { v: `${lin(a, v, a * b + 1)} = ${lin(c, v, c * e)}`, m: 'arith-slip' },
        ],
      };
    },
  },
];

// ---------------------------------------------------------------------------
// fraction-solve —  (x + b)/k = c   and   x/k + b = c
// ---------------------------------------------------------------------------
const fractionSolve = [
  {
    id: 'fs-bar', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const k = int(r, 2, 1 + 2 * d);
      const c = d >= 3 ? nz(r, -(2 + 2 * d), 2 + 2 * d) : int(r, 2, 2 + 2 * d);
      const b = Bkonst(r, d);
      const x = c * k - b;
      if (x === 0) throw new Error('retry: a zero answer hides the last step');
      if (!distinct(k, b, c, x)) throw new Error('retry: repeated number');
      const eqn = `\\frac{${lin(1, v, b)}}{${k}} = ${c}`;
      return {
        stem: T('ask.solveFor', { v }),
        latex: eqn,
        type: 'numeric',
        answer: String(x),
        check: { kind: 'solve', math: eqn, variable: v },
        steps: [
          { latex: `${lin(1, v, b)} = ${c * k}`, why: T('l2.why.multiplyBothByBottom', { k }) },
          { latex: `${v} = ${x}`, why: T('why.unwrapConstantFirst') },
        ],
        distractors: [
          { v: String(c * k + b), m: 'sign-slip' },
          { v: safeFrac(c, k, b), m: 'divide-not-multiply' },
          { v: String(c - b), m: 'partial-rule' },
          { v: String(c * k), m: 'partial-rule' },
          { v: String((c - b) * k), m: 'wrong-unwrap-order' },
          { v: String(x + 1), m: 'arith-slip' },
          { v: String(x - 1), m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'fs-split', rep: 'symbolic', dMin: 2, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const k = int(r, 2, 2 + d);
      const b = Bkonst(r, d);
      const q = d >= 3 ? nz(r, -(3 + d), 3 + d) : int(r, 2, 3 + d);
      const x = q * k;
      const c = q + b;
      if (x === 0 || c === 0) throw new Error('retry: a zero answer hides the last step');
      if (!distinct(k, b, c, q)) throw new Error('retry: repeated number');
      const eqn = `\\frac{${v}}{${k}} ${sg(b)} = ${c}`;
      return {
        stem: T('ask.solveFor', { v }),
        latex: eqn,
        type: 'numeric',
        answer: String(x),
        check: { kind: 'solve', math: eqn, variable: v },
        steps: [
          { latex: `\\frac{${v}}{${k}} = ${q}`, why: T('why.unwrapConstantFirst') },
          { latex: `${v} = ${x}`, why: T('l2.why.multiplyBothByBottom', { k }) },
        ],
        distractors: [
          { v: String(c * k - b), m: 'wrong-unwrap-order' },
          { v: String(c * k), m: 'wrong-unwrap-order' },
          { v: safeFrac(c - b, k, 0), m: 'divide-not-multiply' },
          { v: String(q), m: 'partial-rule' },
          { v: String(x + b), m: 'partial-rule' },
          { v: String(-x), m: 'sign-slip' },
          { v: String(x + 1), m: 'arith-slip' },
        ],
      };
    },
  },
  {
    id: 'fs-context', rep: 'context', dMin: 1, dMax: 5, distinctNums: true,
    sceneKeys: KEYS(SHARES),
    build({ r, d, T, sr }) {
      const v = pick(r, VARS);
      const k = int(r, 2, 1 + 2 * d);
      const c = int(r, 2, 3 + 2 * d);
      const b = int(r, 2, 3 + 2 * d);
      const x = c * k - b;
      if (x <= 0) throw new Error('retry: a delivery cannot be negative');
      if (!distinct(k, b, c, x)) throw new Error('retry: repeated number');
      const eqn = `\\frac{${lin(1, v, b)}}{${k}} = ${c}`;
      const sc = scene(sr, SHARES);
      return {
        stem: `${T(sc.ctx)} ${T(sc.ask, { v })}`,
        latex: eqn,
        type: 'numeric',
        answer: String(x),
        check: { kind: 'solve', math: eqn, variable: v },
        steps: [
          { latex: `${lin(1, v, b)} = ${c * k}`, why: T('l2.why.multiplyBothByBottom', { k }) },
          { latex: `${v} = ${x}`, why: T('why.unwrapConstantFirst') },
        ],
        distractors: [
          { v: String(c * k + b), m: 'sign-slip' },
          { v: safeFrac(c, k, b), m: 'divide-not-multiply' },
          { v: String(c - b), m: 'partial-rule' },
          { v: String(c * k), m: 'partial-rule' },
          { v: String((c - b) * k), m: 'wrong-unwrap-order' },
          { v: String(x + 1), m: 'arith-slip' },
          { v: String(x - 1), m: 'arith-slip' },
        ],
      };
    },
  },
  {
    // The move that has to be first, on its own. A cadet who divides by the
    // number under the bar instead of multiplying by it never reaches a wrong
    // ANSWER here — they reach a wrong LINE, and this is the form that shows
    // it to them one step earlier, in a representation this skill did not have.
    id: 'fs-firstline', rep: 'verbal', dMin: 1, dMax: 5,
    build({ r, d, T }) {
      const v = pick(r, VARS);
      const k = int(r, 2, 2 + 2 * d);
      const c = d >= 3 ? nz(r, -(3 + d), 3 + d) : int(r, 2, 4 + d);
      const b = Bkonst(r, d);
      const x = c * k - b;
      if (x === 0 || !distinct(k, b, c, x)) throw new Error('retry: repeated number');
      const eqn = `\\frac{${lin(1, v, b)}}{${k}} = ${c}`;
      return {
        stem: T('l2.ask.whichFirstLine'),
        latex: asks(eqn),
        type: 'expression',
        answer: `${lin(1, v, b)} = ${c * k}`,
        check: { kind: 'equationChoice', variable: v, expect: String(x) },
        steps: [
          { latex: `${k} \\cdot \\frac{${lin(1, v, b)}}{${k}} = ${k} \\cdot ${c}`, why: T('l2.why.multiplyBothByBottom', { k }) },
          { latex: `${lin(1, v, b)} = ${c * k}`, why: T('l2.why.clearTheBarFirst', { v }) },
        ],
        distractors: [
          { v: `${lin(1, v, b)} = ${c}`, m: 'partial-rule' },
          { v: `${v} = ${c * k}`, m: 'wrong-unwrap-order' },
          { v: `${lin(1, v, b * k)} = ${c * k}`, m: 'partial-rule' },
          { v: `${lin(1, v, -b)} = ${c * k}`, m: 'sign-slip' },
          { v: `${lin(1, v, b)} = ${c * k + 1}`, m: 'arith-slip' },
          { v: `${lin(1, v, b)} = ${c * k - 1}`, m: 'arith-slip' },
        ],
      };
    },
  },
];

// ---------------------------------------------------------------------------
// rule-from-table — the table never states its rule
// ---------------------------------------------------------------------------
/** Four rows of one linear rule, with even steps and no rule written down. */
function drawTable(r, d) {
  const rate = nzc(r, 2, Math.max(2, d)) * (d >= 3 && r() < 0.4 ? -1 : 1);
  const base = d >= 3 ? nz(r, -(1 + d), 1 + d) : int(r, 1, 2 + d);
  const step = int(r, 1, Math.max(1, d - 1));
  const start = d >= 3 ? int(r, -2 - d, 2 + d) : int(r, 1, 2 + d);
  const rows = [0, 1, 2, 3].map((i) => {
    const x = start + i * step;
    return [x, rate * x + base];
  });
  const missing = int(r, 1, 3);
  if (!distinct(rate, base, step)) throw new Error('retry: repeated number');
  return { rows, missing, rate, base, step };
}

const ruleFromTable = [
  {
    id: 'rft-output', rep: 'table', dMin: 1, dMax: 5,
    sceneKeys: KEYS(GAUGES),
    build({ r, d, T, sr }) {
      const { rows, missing, rate, base } = drawTable(r, d);
      const ans = rows[missing][1];
      const prev = rows[missing - 1];
      return {
        stem: `${T(scene(sr, GAUGES).ctx)} ${T('ask.missingReading')}`,
        latex: arrayTex('x', 'y', rows, missing),
        type: 'numeric',
        answer: String(ans),
        check: { kind: 'table', rows, missing },
        steps: [
          { latex: `${rows[0][1]} \\rightarrow ${rows[1][1]}`, why: T('l2.why.stepTellsRate', { n: rate }) },
          { latex: `${prev[1]} ${sg(rate * (rows[missing][0] - prev[0]))} = ${ans}`, why: T('l2.why.applyRateOnce') },
        ],
        distractors: [
          { v: String(prev[1]), m: 'off-by-one-row' },
          { v: String(rows[Math.min(3, missing + 1)][1]), m: 'off-by-one-row' },
          { v: String(rows[missing][0] + rate), m: 'add-not-multiply' },
          { v: String(rate * rows[missing][0]), m: 'partial-rule' },
          { v: String(ans + rate), m: 'arith-slip' },
          { v: String(ans - rate), m: 'arith-slip' },
          { v: String(ans + 1), m: 'arith-slip' },
          { v: String(-ans), m: 'sign-slip' },
          { v: String(base), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    id: 'rft-input', rep: 'table', dMin: 2, dMax: 5,
    sceneKeys: KEYS(GAUGES),
    build({ r, d, T, sr }) {
      const { rows, missing, rate } = drawTable(r, d);
      const ans = rows[missing][0];
      const shown = rows.map((row, i) => (i === missing ? [null, row[1]] : row));
      const prev = rows[missing - 1];
      return {
        stem: `${T(scene(sr, GAUGES).ctx)} ${T('ask.missingInput')}`,
        latex: arrayTexInput('x', 'y', shown),
        type: 'numeric',
        answer: String(ans),
        // The verifier reads the gap out of the printed table either way round.
        check: { kind: 'table', rows: rows.map((row, i) => (i === missing ? ['?', row[1]] : row)), missing },
        steps: [
          { latex: `${rows[0][1]} \\rightarrow ${rows[1][1]}`, why: T('l2.why.stepTellsRate', { n: rate }) },
          { latex: `${prev[0]} + ${rows[missing][0] - prev[0]} = ${ans}`, why: T('l2.why.stepBackToInput') },
        ],
        distractors: [
          { v: String(prev[0]), m: 'off-by-one-row' },
          { v: String(rows[Math.min(3, missing + 1)][0]), m: 'off-by-one-row' },
          { v: String(rows[missing][1]), m: 'partial-rule' },
          { v: String(ans + 1), m: 'arith-slip' },
          { v: String(ans - 1), m: 'arith-slip' },
          { v: String(ans + rate), m: 'add-not-multiply' },
          { v: String(-ans), m: 'sign-slip' },
        ],
      };
    },
  },
  {
    id: 'rft-context', rep: 'context', dMin: 1, dMax: 5,
    sceneKeys: KEYS(GAUGES),
    build({ r, d, T, sr }) {
      const { rows, missing, rate, base } = drawTable(r, d);
      if (rate < 0 || base < 0) throw new Error('retry: a stockpile does not run backwards here');
      const ans = rows[missing][1];
      const prev = rows[missing - 1];
      return {
        stem: `${T(scene(sr, GAUGES).ctx)} ${T('l2.ask.missingWatch')}`,
        latex: arrayTex('x', 'y', rows, missing),
        type: 'numeric',
        answer: String(ans),
        check: { kind: 'table', rows, missing },
        steps: [
          { latex: `${rows[0][1]} \\rightarrow ${rows[1][1]}`, why: T('l2.why.stepTellsRate', { n: rate }) },
          { latex: `${prev[1]} ${sg(rate * (rows[missing][0] - prev[0]))} = ${ans}`, why: T('l2.why.applyRateOnce') },
        ],
        distractors: [
          { v: String(prev[1]), m: 'off-by-one-row' },
          { v: String(rows[Math.min(3, missing + 1)][1]), m: 'off-by-one-row' },
          { v: String(rows[missing][0] + rate), m: 'add-not-multiply' },
          { v: String(rate * rows[missing][0]), m: 'partial-rule' },
          { v: String(ans + rate), m: 'arith-slip' },
          { v: String(ans - rate), m: 'arith-slip' },
          { v: String(ans + 1), m: 'arith-slip' },
          { v: String(base), m: 'partial-rule' },
        ],
      };
    },
  },
  {
    // A fourth reading of the same table, in the representation this skill did
    // not have: two cadets have filled the gap, and only one of them used the
    // rate. It is the form the gate can reach for when every table form has
    // already been practised.
    id: 'rft-dispute', rep: 'verbal', dMin: 1, dMax: 5,
    sceneKeys: KEYS(DISPUTES_OPEN),
    build({ r, d, T, sr }) {
      const { rows, missing, rate, base } = drawTable(r, d);
      const ans = rows[missing][1];
      const prev = rows[missing - 1];
      const next = rows[Math.min(3, missing + 1)];
      const sc = scene(sr, DISPUTES_OPEN);
      // THIS ONE LANDS ON A FREE KEYPAD, so the two readings the sentence
      // quotes are two that are NEVER right. It used to quote the answer
      // itself beside the row above the gap, and every framing prints the
      // answer first: a cadet who typed the first number in the sentence
      // sealed 171 route cards with no mathematics at all, on a surface that
      // has no option set for a guess to be spread over. `quoteReadings` draws
      // both out of the wrong readings this form already catalogues, and out
      // of the ones the narrowed field will not show. The ask changes with it:
      // "which reading is the true one" is not a question a keypad asks.
      return {
        quote: { ctx: sc.ctx, ask: 'l2.ask.missingWatch' },
        stem: `${T(sc.ctx, { a: ans, b: prev[1] })} ${T('ask.whichIsRight')}`,
        latex: arrayTex('x', 'y', rows, missing),
        type: 'numeric',
        answer: String(ans),
        check: { kind: 'table', rows, missing },
        steps: [
          { latex: `${rows[0][1]} \\rightarrow ${rows[1][1]}`, why: T('l2.why.stepTellsRate', { n: rate }) },
          { latex: `${prev[1]} ${sg(rate * (rows[missing][0] - prev[0]))} = ${ans}`, why: T('l2.why.applyRateOnce') },
        ],
        distractors: [
          { v: String(prev[1]), m: 'off-by-one-row' },
          { v: String(next[1]), m: 'off-by-one-row' },
          { v: String(rows[missing][0] + rate), m: 'add-not-multiply' },
          { v: String(rate * rows[missing][0]), m: 'partial-rule' },
          { v: String(base), m: 'partial-rule' },
          { v: String(ans + rate), m: 'arith-slip' },
          { v: String(ans - rate), m: 'arith-slip' },
        ],
      };
    },
  },
];

// ---------------------------------------------------------------------------
// small local helpers
// ---------------------------------------------------------------------------
/** A distractor that would divide by zero is not a distractor. */
function safeDiv(n, dd) { return dd === 0 ? n + 1 : Math.round(n / dd); }
/** "(c - b)/k" as an exact string, for a divide-instead-of-multiply slip. */
function safeFrac(c, k, b) {
  const n = c - b;
  if (k === 0) return String(n);
  if (n % k === 0) return String(n / k);
  const g = gcdOf(n, k);
  return `${n / g}/${k / g}`;
}
function gcdOf(a, b) { a = Math.abs(a); b = Math.abs(b); while (b) { [a, b] = [b, a % b]; } return a || 1; }
/** The keypad answer format for an exact rate: "3", "-3", "3/2". */
function ratioStr(n, dd) {
  if (dd === 0) throw new Error('retry: a rate with no run');
  let a = n, b = dd;
  if (b < 0) { a = -a; b = -b; }
  const g = gcdOf(a, b);
  return b / g === 1 ? String(a / g) : `${a / g}/${b / g}`;
}
/** "+ \frac{3}{4}", "- 2" — an exact value, signed, to stand after another. */
function sgRatio(n, dd) {
  const s = ratio(n, dd);
  return s.startsWith('-') ? `- ${s.slice(1)}` : `+ ${s}`;
}
/** "+ 3y", "- y" — a signed term to stand after another one. */
function signedTerm(c, v) {
  const a = Math.abs(c);
  return `${c < 0 ? '-' : '+'} ${a === 1 ? v : `${a}${v}`}`;
}
/**
 * A chart just big enough for what is on it.
 *
 * A grid that reaches to the band's outer limit while the readings sit in one
 * corner is a grid a cadet cannot place a point on: at forty units across, one
 * lattice step is seven pixels and the knob covers two of them. So the chart is
 * cut to the data, with a margin to see the trace leave.
 */
function fitRange(pts, extra = 0) {
  let far = 4;
  for (const [x, y] of pts) far = Math.max(far, Math.abs(x), Math.abs(y));
  return Math.max(5, Math.ceil(Math.max(far, Math.abs(extra)) + 2));
}
/** "3x + 2", "-x - 4", "5" — a straight line written the one way. */
function lineTex(m, b) {
  if (m === 0) return String(b);
  if (b === 0) return co(m, 'x');
  return `${co(m, 'x')} ${sg(b)}`;
}
/** The table printer for a gap on the input side. */
function arrayTexInput(vname, ruleLabel, rowsShown) {
  const body = rowsShown
    .map((row) => `${row[0] === null ? '?' : row[0]} & ${row[1]}`)
    .join(' \\\\ ');
  return `\\begin{array}{c|c} ${vname} & ${ruleLabel} \\\\ \\hline ${body} \\end{array}`;
}

// ---------------------------------------------------------------------------
// the pack
// ---------------------------------------------------------------------------
export default {
  id: 'algebra1-l2',
  skills: {
    'bracket-both-sides': bracketBothSides,
    'fraction-solve': fractionSolve,
    'rule-from-table': ruleFromTable,
    'inequality-one-step': inequalityOneStep,
    'inequality-two-step': inequalityTwoStep,
    'inequality-multi-step': inequalityMultiStep,
    'compound-inequality': compoundInequality,
    'literal-equations': literalEquations,
    'ratio-proportion': ratioProportion,
    'slope-rate': slopeRate,
    'graph-linear': graphLinear,
    'write-linear': writeLinear,
    'system-substitution': systemSubstitution,
    'system-elimination': systemElimination,
  },
  strings: { en, es, pl },
};
