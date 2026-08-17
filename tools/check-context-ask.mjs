/**
 * Context/question agreement gate.
 *
 * A word problem in this bank is dealt from a deck: a *situation* that counts
 * some number of things, and a *question* that asks how many things there are.
 * The two are separate strings in separate places, translated at separate
 * times, and nothing checked that they were still talking about the same
 * object once all three languages existed.
 *
 * They were not. `ctx.hullPatches` counts plates of hull skin; it was paired
 * with `ask.howManyPanes`, which asks for window panes. English got away with
 * it because English happened to call the hull covering a "pane" too, so the
 * item read as consistent. Spanish did not: the story counted *paños de
 * plancha* and the question asked *¿cuántos cristales son?* over the very same
 * expression. Polish did not either: *płatów blachy* counted, *ile to szyb?*
 * asked. A learner in those two languages was handed the hardest item type in
 * the game — walk between a situation and its symbols — and asked to walk to
 * the wrong place.
 *
 * Every existing gate passed over it. `validate-items` re-derives the
 * mathematics and it was right; `check-i18n` compares key sets and they
 * matched. The defect was semantic and lived in the space *between* two keys
 * that no checker had ever been asked to read together.
 *
 * So: this file. Every deck pairing declares, once, which noun the question is
 * about; every noun carries the stems it is spelt with in each language; and
 * for every pairing, in every locale, the situation must actually name that
 * noun. A question that asks for something the story never counted fails the
 * build, in every language, before a learner ever sees it.
 *
 *   node tools/check-context-ask.mjs              # the gate
 *   node tools/check-context-ask.mjs --self-test  # prove the gate can fail
 *   node tools/check-context-ask.mjs --list       # print every pairing
 *
 * Adding a deck entry with an undeclared question fails too, so the table
 * cannot quietly fall behind the bank.
 */
import en from '../content/lang/items.en.js';
import es from '../content/lang/items.es.js';
import pl from '../content/lang/items.pl.js';
import { realpathSync } from 'node:fs';
import { fileURLToPath } from 'node:url';
import { DECK_PAIRS } from '../src/learn/generators.js';

const BUNDLES = { en, es, pl };
const LOCALES = Object.keys(BUNDLES);

// ---------------------------------------------------------------------------
// What each question is about.
//
// One entry per question the decks can deal. The value is the id of the noun
// in NOUNS below — the thing the learner is being asked to count, weigh or
// read. It is deliberately written out rather than inferred from the key name:
// `ask.howManyPanes` and `ask.howManyPlates` differ by one noun and that is
// exactly the difference this file exists to keep.
// ---------------------------------------------------------------------------
export const ASK_SUBJECT = {
  // k lots of v, and b lots of a lots of v — the unit the total comes out in.
  'ask.howManyCadets': 'cadets',
  'ask.howManySeedlings': 'seedlings',
  'ask.howManySeedlingsPlanted': 'seedlings',
  'ask.howManyMetres': 'metres',
  'ask.howManyDays': 'days',
  'ask.howManyDaysAir': 'days',
  'ask.howManySeconds': 'seconds',
  'ask.howManySecondsPing': 'seconds',
  'ask.howManyTonnes': 'tonnes',
  'ask.howManyTonnesRaised': 'tonnes',
  'ask.howManyTonnesBarged': 'tonnes',
  'ask.howManyLitres': 'litres',
  'ask.howManyWatts': 'watts',
  'ask.howManySamples': 'samples',
  'ask.howManyMinutes': 'minutes',
  'ask.howManyPackets': 'packets',
  'ask.howManyPanes': 'panes',
  'ask.howManyPlates': 'plates',
  'ask.howManyBricks': 'bricks',
  'ask.howManyCells': 'cells',
  'ask.howManyKilometres': 'kilometres',
  'ask.howManyHours': 'hours',
  'ask.howManyGrams': 'grams',
  'ask.howManyRivets': 'rivets',
  'ask.howManyFrames': 'frames',
  'ask.howManyFramesHeld': 'frames',
  'ask.howManyReadings': 'readings',
  'ask.howManyLumens': 'lumens',
  'ask.howManyDegrees': 'degrees',
  'ask.howManyDoses': 'doses',
  'ask.howManyDosesStowed': 'doses',

  // A fixed charge and a charge per cycle: the running strip, the torn bill
  // and the question all have to be counting the same cycles.
  'ask.costOfStay': 'cycles',
  'ask.costOfTow': 'cycles',
  'ask.costOfBerth': 'cycles',
  'ask.costOfHire': 'cycles',
  'ask.costOfFiring': 'cycles',
  'ask.costOfStorage': 'cycles',
  'ask.costOfPassage': 'cycles',
  'ask.costOfSlip': 'cycles',
  'ask.costOfStall': 'cycles',
  'ask.costOfRig': 'cycles',
  'ask.costOfEscort': 'cycles',
  'ask.howManyCycles': 'cycles',
  'ask.howManyCyclesTow': 'cycles',
  'ask.howManyCyclesBerth': 'cycles',
  'ask.howManyCyclesHire': 'cycles',
  'ask.howManyCyclesFiring': 'cycles',
  'ask.howManyCyclesStorage': 'cycles',
  'ask.howManyCyclesPassage': 'cycles',
  'ask.howManyCyclesSlip': 'cycles',
  'ask.howManyCyclesStall': 'cycles',
  'ask.howManyCyclesRig': 'cycles',
  'ask.howManyCyclesEscort': 'cycles',

  // k sealed identical things, or a beam that balances them: the question
  // names the sealed thing, and the story had better be about that thing.
  'ask.oneCrateMass': 'crate',
  'ask.oneDrumMass': 'drum',
  'ask.onePalletMass': 'pallet',
  'ask.oneCanisterMass': 'canister',
  'ask.oneSackMass': 'sack',
  'ask.oneCaskMass': 'cask',
  'ask.oneBilletMass': 'billet',
  'ask.oneBaleMass': 'bale',
  'ask.oneCoilMass': 'coil',
  'ask.oneCoreMass': 'core',
  'ask.oneJarMass': 'jar',
  'ask.oneKegMass': 'keg',
  'ask.oneTinMass': 'tin',
  'ask.oneCrucibleMass': 'crucible',
  'ask.oneSeedPodMass': 'seedPod',

  // A gauge that reads the present: the question names the vessel whose past
  // has to be reconstructed.
  'ask.startingMass': 'hold',
  'ask.whichEquationHold': 'hold',
  'ask.startingGrain': 'silo',
  'ask.whichEquationSilo': 'silo',
  'ask.startingLevel': 'reservoir',
  'ask.whichEquationReservoir': 'reservoir',
  'ask.startingBunker': 'bunker',
  'ask.whichEquationBunker': 'bunker',
  'ask.startingCistern': 'cistern',
  'ask.whichEquationCistern': 'cistern',
  'ask.startingSaltPan': 'saltPan',
  'ask.whichEquationSaltPan': 'saltPan',
  'ask.startingIce': 'icehouse',
  'ask.whichEquationIcehouse': 'icehouse',
  'ask.startingTailings': 'tailings',
  'ask.whichEquationTailings': 'tailings',
  'ask.startingStockpile': 'stockpile',
  'ask.whichEquationStockpile': 'stockpile',
  'ask.startingFeed': 'feedBin',
  'ask.whichEquationFeedBin': 'feedBin',
  'ask.startingCoal': 'coalHeap',
  'ask.whichEquationCoal': 'coalHeap',
  'ask.startingBrine': 'brineTank',
  'ask.whichEquationBrine': 'brineTank',
  'ask.startingSlag': 'slag',
  'ask.whichEquationSlag': 'slag',
  'ask.startingButt': 'butt',
  'ask.whichEquationButt': 'butt',
  'ask.startingHopper': 'hopperBin',
  'ask.whichEquationHopper': 'hopperBin',
  'ask.startingPeat': 'peatStack',
  'ask.whichEquationPeat': 'peatStack',
  'ask.startingOreBunk': 'oreBunk',
  'ask.whichEquationOreBunk': 'oreBunk',
  'ask.startingMeal': 'mealSilo',
  'ask.whichEquationMeal': 'mealSilo',
  'ask.startingSnow': 'snowLoad',
  'ask.whichEquationSnow': 'snowLoad',
  'ask.startingBallast': 'ballastHold',
  'ask.whichEquationBallast': 'ballastHold',
};

// ---------------------------------------------------------------------------
// How each noun is spelt, per language.
//
// Stems, not words: Polish inflects the noun after a numeral and Spanish
// pluralises it, so `szyb` has to cover *szyba, szyby, szyb* and `cristal` has
// to cover *cristales*. A stem matches only at the start of a word, so `nit`
// finds *nitów* and not *monitor*.
//
// A noun with no stems in some language is itself a build failure — that is
// the hole the Spanish and Polish hull-patch items fell through.
// ---------------------------------------------------------------------------
export const NOUNS = {
  cadets: { en: ['cadet'], es: ['cadete'], pl: ['kadet'] },
  seedlings: { en: ['seedling'], es: ['plántula'], pl: ['sadzon'] },
  metres: { en: ['metre'], es: ['metro'], pl: ['metr'] },
  days: { en: ['day'], es: ['día'], pl: ['dni', 'dzień', 'dnia'] },
  seconds: { en: ['second'], es: ['segundo'], pl: ['sekund'] },
  tonnes: { en: ['tonne'], es: ['tonelada'], pl: ['ton'] },
  litres: { en: ['litre'], es: ['litro'], pl: ['litr'] },
  watts: { en: ['watt'], es: ['vatio'], pl: ['wat'] },
  samples: { en: ['sample'], es: ['muestra'], pl: ['próbk'] },
  minutes: { en: ['minute'], es: ['minuto'], pl: ['minut'] },
  packets: { en: ['packet'], es: ['paquete'], pl: ['pakiet'] },
  panes: { en: ['pane'], es: ['cristal'], pl: ['szyb'] },
  plates: { en: ['plate'], es: ['plancha'], pl: ['płat'] },
  bricks: { en: ['brick'], es: ['bloque'], pl: ['blok'] },
  cells: { en: ['cell'], es: ['celda'], pl: ['ogniw'] },
  kilometres: { en: ['kilometre'], es: ['kilómetro'], pl: ['kilometr'] },
  hours: { en: ['hour'], es: ['hora'], pl: ['godzin'] },
  grams: { en: ['gram'], es: ['gramo'], pl: ['gram'] },
  rivets: { en: ['rivet'], es: ['remache'], pl: ['nit'] },
  frames: { en: ['frame'], es: ['fotograma'], pl: ['klat'] },
  readings: { en: ['reading'], es: ['lectura'], pl: ['odczyt'] },
  lumens: { en: ['lumen'], es: ['lumen', 'lúmen'], pl: ['lumen'] },
  degrees: { en: ['degree'], es: ['grado'], pl: ['stopni', 'stopie'] },
  doses: { en: ['dose'], es: ['dosis'], pl: ['dawk', 'dawek'] },
  cycles: { en: ['cycle'], es: ['ciclo'], pl: ['cykl'] },

  crate: { en: ['crate'], es: ['caja'], pl: ['skrzyn', 'skrzyń'] },
  drum: { en: ['drum'], es: ['bidón', 'bidon'], pl: ['bęb'] },
  pallet: { en: ['pallet'], es: ['palé'], pl: ['palet'] },
  canister: { en: ['canister'], es: ['bidón', 'bidon'], pl: ['bęb'] },
  sack: { en: ['sack'], es: ['saco'], pl: ['work', 'worek', 'work'] },
  cask: { en: ['cask'], es: ['barrica'], pl: ['becz'] },
  billet: { en: ['billet'], es: ['tocho'], pl: ['kęs'] },
  bale: { en: ['bale'], es: ['paca'], pl: ['bela', 'bele', 'bel'] },
  coil: { en: ['coil'], es: ['bobina'], pl: ['krąg', 'kręg'] },
  core: { en: ['core'], es: ['testigo'], pl: ['rdze'] },
  jar: { en: ['jar'], es: ['tarro'], pl: ['sło', 'słó'] },
  keg: { en: ['keg'], es: ['barrilete'], pl: ['antał'] },
  tin: { en: ['tin'], es: ['lata'], pl: ['puszk'] },
  crucible: { en: ['crucible'], es: ['crisol'], pl: ['tygiel', 'tygl'] },
  seedPod: { en: ['pod'], es: ['vaina'], pl: ['strąk'] },

  hold: { en: ['hold'], es: ['bodega'], pl: ['ładown'] },
  silo: { en: ['silo'], es: ['silo'], pl: ['silos'] },
  reservoir: { en: ['reservoir'], es: ['depósito'], pl: ['zbiornik'] },
  bunker: { en: ['bunker'], es: ['tolva'], pl: ['zasobnik'] },
  cistern: { en: ['cistern'], es: ['aljibe'], pl: ['cystern'] },
  saltPan: { en: ['pan'], es: ['salina'], pl: ['panw', 'panwi'] },
  icehouse: { en: ['icehouse'], es: ['nevera'], pl: ['lodown'] },
  tailings: { en: ['tailings', 'pile'], es: ['escombrera'], pl: ['hałd'] },
  stockpile: { en: ['stockpile', 'pad'], es: ['plataforma'], pl: ['płyt'] },
  feedBin: { en: ['bin'], es: ['silo'], pl: ['zasobnik'] },
  coalHeap: { en: ['weighbridge'], es: ['báscula'], pl: ['wag'] },
  brineTank: { en: ['tank'], es: ['depósito'], pl: ['zbiornik'] },
  slag: { en: ['slag'], es: ['escoria'], pl: ['żużl', 'żuże'] },
  butt: { en: ['butt'], es: ['cuba'], pl: ['kadź', 'kadzi'] },
  hopperBin: { en: ['hopper'], es: ['tolva'], pl: ['zsyp'] },
  peatStack: { en: ['stack'], es: ['pila'], pl: ['stert'] },
  oreBunk: { en: ['bunk'], es: ['pañol'], pl: ['zasobnik'] },
  mealSilo: { en: ['silo'], es: ['silo'], pl: ['silos'] },
  snowLoad: { en: ['roof'], es: ['techo'], pl: ['dach'] },
  ballastHold: { en: ['hold'], es: ['bodega'], pl: ['ładown'] },
};

/**
 * The situation, as prose, with everything that is not prose removed:
 * mathematics (`$…$`), interpolation slots (`{k}`), and the delimiters of the
 * plural alternants — whose branches stay, because that is where the Polish
 * noun lives.
 */
function prose(raw) {
  return String(raw)
    .replace(/\$[^$]*\$/g, ' ')
    .replace(/«([^»]*)»/g, (_, inner) => ' ' + inner.split('|').slice(1).map((b) => b.split(':').slice(1).join(':')).join(' ') + ' ')
    .replace(/\{\w+\}/g, ' ')
    .toLowerCase();
}

/** True when the prose uses a word beginning with this stem. */
function names(text, stem) {
  const i = text.indexOf(stem.toLowerCase());
  if (i < 0) return false;
  for (let at = i; at >= 0; at = text.indexOf(stem.toLowerCase(), at + 1)) {
    const before = at === 0 ? '' : text[at - 1];
    if (!before || !/\p{L}/u.test(before)) return true;
  }
  return false;
}

/**
 * Walk every pairing in every locale.
 * @param {{bundles?: object, pairs?: object[]}} opts overrides, for the self-test.
 * @returns {{problems: string[], checked: number}}
 */
export function auditContextAsk({ bundles = BUNDLES, pairs = DECK_PAIRS } = {}) {
  const problems = [];
  let checked = 0;
  const usedSubjects = new Set();
  const usedAsks = new Set();

  for (const { deck, ctx, slot, ask } of pairs) {
    usedAsks.add(ask);
    const subject = ASK_SUBJECT[ask];
    if (!subject) {
      problems.push(`${deck}: "${ask}" is dealt with ${ctx} but ASK_SUBJECT does not say what it asks for — declare it in tools/check-context-ask.mjs`);
      continue;
    }
    const noun = NOUNS[subject];
    if (!noun) {
      problems.push(`${ask}: names subject "${subject}", which NOUNS does not define`);
      continue;
    }
    usedSubjects.add(subject);
    for (const loc of LOCALES) {
      const bundle = bundles[loc] || {};
      const story = bundle[ctx];
      const question = bundle[ask];
      if (story == null) { problems.push(`${loc}: ${ctx} is missing`); continue; }
      if (question == null) { problems.push(`${loc}: ${ask} is missing`); continue; }
      const stems = noun[loc];
      if (!stems || !stems.length) {
        problems.push(`NOUNS.${subject} has no ${loc} spelling — every subject must be spelt in every language`);
        continue;
      }
      checked += 1;
      const text = prose(story);
      if (!stems.some((s) => names(text, s))) {
        problems.push(
          `${loc}: ${ctx} (${deck}.${slot}) never counts "${subject}", but ${ask} asks for it\n`
          + `        situation: ${String(story).slice(0, 150)}\n`
          + `        question:  ${String(question).slice(0, 150)}`
        );
      }
    }
  }

  for (const ask of Object.keys(ASK_SUBJECT)) {
    if (!usedAsks.has(ask)) problems.push(`ASK_SUBJECT declares "${ask}", which no deck deals — remove it or wire it up`);
  }
  for (const subject of Object.keys(NOUNS)) {
    if (!usedSubjects.has(subject)) problems.push(`NOUNS defines "${subject}", which no question is about — remove it`);
  }
  return { problems, checked };
}

/**
 * Prove the gate can fail.
 *
 * Puts the shipped defect back exactly as it shipped — `ctx.hullPatches` and
 * `ctx.nestedPatches` dealt with `ask.howManyPanes`, and the Spanish and
 * Polish situations counting *paños de plancha* and *płatów blachy* — and
 * insists the audit reports all four readings (two situations × two languages)
 * while leaving English, which really did agree with itself, alone.
 *
 * A checker nobody has watched fail is a checker nobody knows is wired up.
 */
function selfTest() {
  const broken = Object.fromEntries(LOCALES.map((l) => [l, { ...BUNDLES[l] }]));
  broken.en['ctx.hullPatches'] = 'A hull patch covers ${v}$ panes of skin, which is what the press was set to and what it stays set to. {k} patches came out of stores.';
  broken.en['ctx.nestedPatches'] = 'A hull patch covers ${v}$ panes of skin. A roll carries {a} patches. {b} rolls came out of stores and none of them has been broken open.';
  broken.es['ctx.hullPatches'] = 'Un parche de casco cubre ${v}$ paños de plancha, que es a lo que se ajustó la prensa y como sigue ajustada. Del almacén han salido {k} parches.';
  broken.es['ctx.nestedPatches'] = 'Un parche de casco cubre ${v}$ paños de plancha. Un rollo lleva {a} parches. Del almacén salieron {b} rollos y ninguno se ha abierto.';
  broken.pl['ctx.hullPatches'] = 'Łata poszycia zakrywa ${v}$ płatów blachy — na tyle ustawiono prasę i tak zostaje ustawiona. Z magazynu «k|one:wyszła|few:wyszły|many:wyszło» {k} «k|one:łata|few:łaty|many:łat».';
  broken.pl['ctx.nestedPatches'] = 'Łata poszycia zakrywa ${v}$ płatów blachy. Rolka niesie {a} «a|one:łatę|few:łaty|many:łat». Z magazynu «b|one:wyszła|few:wyszły|many:wyszło» {b} «b|one:rolka|few:rolki|many:rolek» i żadnej jeszcze nie otwarto.';
  // …and the pairing that made it a defect rather than a translation choice.
  const pairs = DECK_PAIRS.map((p) => (
    p.ctx === 'ctx.hullPatches' || p.ctx === 'ctx.nestedPatches' ? { ...p, ask: 'ask.howManyPanes' } : p
  ));

  const { problems } = auditContextAsk({ bundles: broken, pairs });
  const hits = problems.filter((p) => /ctx\.(hullPatches|nestedPatches)/.test(p));
  const expect = ['es: ctx.hullPatches', 'es: ctx.nestedPatches', 'pl: ctx.hullPatches', 'pl: ctx.nestedPatches'];
  const missed = expect.filter((e) => !hits.some((h) => h.startsWith(e)));
  const englishNoise = hits.filter((h) => h.startsWith('en:'));
  const ok = !missed.length && !englishNoise.length && hits.length === expect.length;
  if (ok) {
    console.log(`self-test: PASS — the gate catches all ${hits.length} reintroduced hull-patch mismatches:`);
    for (const h of hits) console.log('   · ' + h.split('\n')[0]);
    console.log('   and does not fire on English, which agreed with itself.');
  } else {
    console.error(`self-test: FAIL — missed ${missed.join(', ') || 'nothing'}`
      + `${englishNoise.length ? `; false alarm on English: ${englishNoise[0]}` : ''}`
      + `${hits.length !== expect.length ? `; expected ${expect.length} hits, got ${hits.length}` : ''}`);
  }
  return ok;
}

// The audit is importable — tools/validate-items.mjs runs it too, so the same
// defect fails the content gate and this one — so the command line only runs
// when this file *is* the command.
const invokedDirectly = process.argv[1] && realpathSync(process.argv[1]) === fileURLToPath(import.meta.url);
const args = invokedDirectly ? process.argv.slice(2) : null;
if (!invokedDirectly) { /* imported: expose auditContextAsk and stop here */ } else if (args.includes('--list')) {
  for (const { deck, ctx, slot, ask } of DECK_PAIRS) {
    console.log(`${deck}.${slot}  ${ctx.padEnd(26)} → ${ask.padEnd(30)} (${ASK_SUBJECT[ask] || '???'})`);
  }
  process.exit(0);
} else if (args.includes('--self-test')) {
  process.exit(selfTest() ? 0 : 1);
} else {
  const { problems, checked } = auditContextAsk();
  console.log('ASCENT — context/question agreement');
  console.log(`  ${DECK_PAIRS.length} deck pairings × ${LOCALES.length} locales, ${checked} situation/question readings`);
  console.log(`  ${Object.keys(ASK_SUBJECT).length} questions declared over ${Object.keys(NOUNS).length} nouns`);
  if (problems.length) {
    console.error(`\n  ${problems.length} problem(s):`);
    for (const p of problems) console.error('   · ' + p);
    console.error('\nFAIL — a question asks for something its situation never counted.');
    process.exit(1);
  }
  console.log('\n  PASS — every question asks for the noun its situation counts, in all three languages');
}
