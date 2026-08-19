/**
 * THE LEDGER OF NUMBERS — one number, one place, one name.
 *
 * ---------------------------------------------------------------------------
 * WHAT WENT WRONG, TWICE
 *
 * A cold critic counted NINE figures on one frame, two rifts into a run:
 *
 *   WORLD REPAIRED 0%   ·   3 CIPHER MOTES   ·   2 OF 16 RIFTS THIS RUN
 *   4 questions this run ·  0 OF 10 LINES HELD ·  Hold this one and 2 more lines open
 *   2 RIFTS SEALED IN ALL · 1 MORE TO CHAPTER 2 · BRONZE · 2 TO GO
 *
 * and Marlow, over the top of them, saying "Three rifts sealed" and "Nine
 * points of standing" — a tenth and eleventh answer to one question, in a unit
 * that appeared nowhere on the glass.
 *
 * A pass before this one was asked to reduce that to ONE number. It did not. It
 * wrote a rule that six figures were allowed provided each said whose question
 * it answered ("this run", "in all"), and a gate that checked each figure
 * against itself. Every figure was individually true and individually labelled,
 * and the screen still had six answers on it. **Labelling a contradiction is not
 * resolving it.** A fourteen-year-old does not read six scopes; they read six
 * numbers and conclude the game does not know.
 *
 * ---------------------------------------------------------------------------
 * THE RULE THIS FILE NOW ENFORCES
 *
 *   1. ONE PROGRESS NUMBER. It is **WORLD REPAIRED**, a percentage of the whole
 *      lattice, and it is the only answer in this game to "how am I doing".
 *   2. ONE PLACE. The rig, top-left, on screen for the whole session. No other
 *      live HUD surface prints a progress figure at all — not a smaller one,
 *      not a differently-scoped one, not one that agrees.
 *   3. ONE NAME, ONE UNIT. "World repaired", per cent, 0 to 100, from the first
 *      frame of a cleared save to the last. It never becomes rifts, never
 *      becomes lines, never becomes points, never becomes nights.
 *   4. IT MOVES ON EVERY SEAL. That is why it is belief and not a staircase.
 *      `mastered / 10` sat at 0% through eight sealed rifts, which is a progress
 *      number that does not report progress. See `repaired()`.
 *   5. EVERYTHING ELSE IS BEHIND A DELIBERATE OPEN. Lines held, questions
 *      answered, rifts sealed, the run's plan — all real, all still counted,
 *      all only on surfaces the learner asks for: the report, the orders card,
 *      the run résumé. Each one there must still agree with WORLD REPAIRED.
 *   6. MARLOW STATES NO FIGURE. He reads the same state the HUD reads
 *      (`voiceState()` in `src/meta/index.js`) and he never says a count —
 *      spelled out or in numerals. `statesAFigure()` below is the backstop, and
 *      it is applied inside the comms channel, not left to the writing.
 *
 * ---------------------------------------------------------------------------
 * HOW IT IS KEPT TRUE
 *
 * Every figure printed anywhere is tagged onto its own element with
 * `tagFigure()`, which records the FACT it states, the ROLE that fact plays and
 * the UNIT it is counted in. `tools/critic/oneprogress.mjs` then reads the
 * screen at one instant — every tagged element, and **every untagged digit as
 * well** — and fails the build if:
 *
 *   · more than one `progress` figure is visible on the live HUD, or
 *   · one fact carries two values, or
 *   · two facts are printed under the same words, or
 *   · a fact's unit changes between two checkpoints of one session, or
 *   · a digit is on the glass inside no declared figure at all, or
 *   · Marlow states a count.
 *
 * The last two are the ones that matter. The previous gate could only compare
 * figures that had been declared, so a tenth figure nobody declared was
 * invisible to it — which is precisely how nine of them survived a dedicated
 * pass. A number that is on the screen and not in this ledger is now a build
 * failure, so a tenth figure cannot be added quietly. It has to be argued for
 * here first.
 *
 * This module holds no state. Every figure is a function of the learner model,
 * so a figure cannot go stale, drift, or need migrating.
 */

/**
 * WHAT A FIGURE IS FOR. Four roles, and only one of them answers "how am I
 * doing".
 *
 *   progress  THE number. Exactly one fact may hold this role, and exactly one
 *             element may print it on the live HUD.
 *   plan      what this sitting asked for. Never on the live HUD; the orders
 *             card and the report only.
 *   evidence  the ledger a teacher checks. The report only.
 *   aside     not an answer to "how am I doing" at all — spendable motes, a
 *             distance in metres, an ordinal like "Run 2". Allowed anywhere,
 *             and still checked for agreeing with itself.
 */
export const ROLE = {
  PROGRESS: 'progress',
  PLAN: 'plan',
  EVIDENCE: 'evidence',
  ASIDE: 'aside',
};

/**
 * THE REGISTER OF EVERY NUMBER THIS GAME IS ALLOWED TO PRINT.
 *
 * `unit` is the thing the number counts, and it is checked for stability across
 * a whole session: "BRONZE · 2 TO GO" ran 10 → 7 → 2 → 18 → 15 → "SILVER · 1
 * NIGHT HELD", which is one label counting standing points and then counting
 * nights. A counter that changes what it counts is worse than a wrong counter,
 * because nothing on screen marks the moment it changed.
 */
export const FACTS = {
  /** THE progress number. Per cent of the lattice repaired. */
  'world.repaired': { role: ROLE.PROGRESS, unit: 'percent' },

  /** What this sitting asked for, and what it has done. Orders card + report. */
  'run.target': { role: ROLE.PLAN, unit: 'rifts' },
  'run.sealed': { role: ROLE.PLAN, unit: 'rifts' },
  'run.items': { role: ROLE.PLAN, unit: 'questions' },

  /** The teacher's ledger. Report only. */
  'lines.held': { role: ROLE.EVIDENCE, unit: 'lines' },
  'all.sealed': { role: ROLE.EVIDENCE, unit: 'rifts' },
  'all.items': { role: ROLE.EVIDENCE, unit: 'questions' },
  'nights.held': { role: ROLE.EVIDENCE, unit: 'nights' },

  /** Not progress. Spendable, or a place, or a name with a number in it. */
  'wallet.motes': { role: ROLE.ASIDE, unit: 'motes' },
  /* How many pieces the player has standing on this island (src/build). An
     inventory of a thing they built, not a claim about what they know — but it
     is a numeral on the live HUD, so it is declared like every other one. */
  'build.pieces': { role: ROLE.ASIDE, unit: 'pieces' },
  /* WHAT A PIECE OF KIT COSTS — "Hold 1 line", "90 motes". A price tag on a
     shelf, not a reading of the learner. It counts lines, which is also what
     `lines.held` counts, and the two are deliberately different facts: one is
     what this thing costs and the other is what you have. They are never
     printed under the same words, and the gate proves it. */
  'price.kit': { role: ROLE.ASIDE, unit: 'price' },
  'objective.metres': { role: ROLE.ASIDE, unit: 'metres' },
  'ordinal.run': { role: ROLE.ASIDE, unit: 'ordinal' },
  'ordinal.chapter': { role: ROLE.ASIDE, unit: 'ordinal' },
  /* The chapter that is NEXT is a different name from the chapter you are in,
     so it is a different fact. Folding both into `ordinal.chapter` would put
     two values under one id, which is the shape of the original defect — and
     the gate is right to refuse it even when the two numbers are both correct. */
  'ordinal.chapterNext': { role: ROLE.ASIDE, unit: 'ordinal' },
  'ordinal.rift': { role: ROLE.ASIDE, unit: 'ordinal' },
  'time.elapsed': { role: ROLE.ASIDE, unit: 'time' },

  /* ------------------------------------------------------------------------
     THE TWO TIME FIGURES, DECLARED — because an undeclared figure is one
     nothing compares, and that is how one of them came to run backwards.

     A cold critic read the session figure five times in one unbroken sitting:
     4 min → 7 min → 9 min → **1 min** → 5 min, with about twenty-five real
     minutes gone at the "1 min" reading; and at the instant the panel said
     5 min the record beside it said TIME ON TASK 7 min. Every rule in this
     register applied to counts and none of it applied to clocks, so neither
     number was ever checked against the other or against itself.

     They are two facts and they are meant to differ, in one direction only:
     TIME ON TASK is work done and can never exceed the sitting it was done in.
     `tools/critic/oneclock.mjs` asserts that, asserts that neither is ever
     printed under the other's words, and samples `session.elapsed` across a
     whole session and fails the build if it ever decreases. */
  /* WHAT THE ORDER HAS SEEN — standing, the number the rank ladder is bought
     with (src/meta/standing.js). Printed twice on the dossier, once at the head
     of the breakdown and once on the rung the cadet is standing on, and until
     now on neither surface as a declared figure — which is how "BRONZE — You
     are here · 50 of 30" came to sit above "SILVER — Opens at 30" with nothing
     in the build able to notice. Not progress: it is the order's judgement of
     you, and WORLD REPAIRED is still the only answer to "how am I doing". */
  'rank.standing': { role: ROLE.ASIDE, unit: 'standing' },

  /** How long this sitting has been going. Wall clock, monotonic, one source. */
  'session.elapsed': { role: ROLE.ASIDE, unit: 'time' },
  /** Time on task across the whole record: measured between answers, capped. */
  'task.time': { role: ROLE.EVIDENCE, unit: 'time' },
};

/** Convenience aliases, so no call site spells an id as a bare string. */
export const FIG = {
  REPAIRED: 'world.repaired',
  RUN_TARGET: 'run.target',
  RUN_SEALED: 'run.sealed',
  RUN_ITEMS: 'run.items',
  LINES_HELD: 'lines.held',
  ALL_SEALED: 'all.sealed',
  ALL_ITEMS: 'all.items',
  NIGHTS_HELD: 'nights.held',
  MOTES: 'wallet.motes',
  PIECES: 'build.pieces',
  PRICE: 'price.kit',
  METRES: 'objective.metres',
  RUN_NO: 'ordinal.run',
  CHAPTER_NO: 'ordinal.chapter',
  CHAPTER_NEXT_NO: 'ordinal.chapterNext',
  RIFT_NO: 'ordinal.rift',
  ELAPSED: 'time.elapsed',
  STANDING: 'rank.standing',
  SESSION_TIME: 'session.elapsed',
  TASK_TIME: 'task.time',
};

/** Every id, for a gate that wants to check it has seen them all. */
export const FIG_IDS = Object.keys(FACTS);

/** The one fact that answers "how am I doing". There is deliberately one. */
export const PROGRESS_FIG = FIG.REPAIRED;

// ---------------------------------------------------------------------------
// THE ONE NUMBER
// ---------------------------------------------------------------------------
/**
 * WORLD REPAIRED — the single progress figure, computed once, here.
 *
 * WHY IT IS NOT `mastered / 10`. That was the old definition, and it is the one
 * the cold critic caught: "the largest number on screen stayed at 0% through
 * eight sealed rifts". A line takes roughly twenty-five items to hold, so the
 * old number was a ten-step staircase whose first step is most of a session —
 * which means for most of a first session the game's headline figure reported
 * that nothing had happened, while the learner had in fact done a great deal.
 * A progress number that cannot move is not honest; it is just quiet.
 *
 * So it is the mastery engine's own belief, summed. Each of the ten lines
 * contributes its posterior probability of being held, and a line actually held
 * contributes a whole one. That number rises on every correct answer — which is
 * to say **on every seal** — because a seal is evidence and evidence moves the
 * posterior. It is also the honest one: it is exactly what the engine would bet
 * on this learner, and it is the same quantity the report's mastery claims are
 * drawn from, so nothing downstream can disagree with it.
 *
 * It is not a ratchet. If a learner comes back after three weeks and a re-probe
 * fails, the world has genuinely un-repaired a little and the number says so.
 * Progress you cannot lose is not a claim about mastery; BRIEF.md asks for
 * mastery claims that are honest, and this is what honest costs.
 *
 * @param {object} mastery the live learner model
 * @returns {{pct:number, frac:number, credit:number, total:number, held:number,
 *            lines:number[]}}
 *   `pct` is the printed integer. `lines` is the per-line credit, in graph
 *   order, so the meter can be drawn out of the same numbers the figure is.
 */
export function repaired(mastery) {
  const nodes = mastery?.graph?.nodes || [];
  const lines = [];
  let credit = 0;
  let held = 0;
  for (const n of nodes) {
    const s = mastery.get?.(n.id);
    // `mastered` is the claim the engine will stand behind, and a claim is worth
    // a whole line even if the posterior has drifted a hair below one.
    const c = s?.mastered ? 1 : earned(n, Number(s?.pL) || 0);
    if (s?.mastered) held++;
    lines.push(Math.max(0, c));
    credit += c;
  }
  const total = nodes.length;
  /* CLAMPED ONCE, AT THE TOTAL — not per line. A line the learner has just
     missed sits below where it started, and clamping it to zero on its own
     creates a dead zone: the next two or three correct answers climb back
     through it and the figure does not move, which is the seal-that-shows-
     nothing this whole pass exists to kill. Letting one line carry its own
     deficit lets a seal on ANY line lift the total immediately. The floor still
     exists where it has to — a learner whose evidence is worse than the cold
     prior is looking at a world that is not repaired, and zero is the true
     reading of that. */
  const frac = total ? Math.max(0, Math.min(1, credit / total)) : 0;
  return { pct: Math.round(frac * 100), frac, credit, total, held, lines };
}

/**
 * THE COLD-START FLOOR, TAKEN OUT.
 *
 * BKT opens every skill at `pInit` — 0.25 in this graph — because a learner who
 * has never been asked is not a learner who is certainly ignorant. That is right
 * for the scheduler and catastrophic for a headline figure: measured on a
 * cleared save, the first frame of the game read **WORLD REPAIRED 26%** before
 * the player had touched anything. A number that starts a quarter of the way up
 * is not a progress number, it is a participation trophy printed in the largest
 * type on the screen, and it makes the other 74% look like the whole game.
 *
 * So each line's credit is what the learner's own evidence bought, rescaled
 * from that line's own prior to certainty. A fresh save reads 0. Ten held lines
 * read 100. Nothing in between is invented, and the shape of the curve is
 * unchanged — every seal still moves it.
 *
 * Lift bought by holding a PREREQUISITE still counts, and should: `seedPL`
 * raises a line's prior above `pInit` when the lattice beneath it is solid, and
 * that is real progress made by real work on another line. It is the constant
 * floor that is removed here, not the earned one.
 */
function earned(node, pL) {
  const p0 = Number(node?.bkt?.pInit);
  const base = Number.isFinite(p0) ? p0 : 0.25;
  if (base >= 0.999) return 1;
  // Capped above at a whole line, deliberately open below zero — see the clamp
  // in `repaired()`.
  return Math.min(1, (pL - base) / (1 - base));
}

/*
 * WHERE THIS FIGURE STILL SITS STILL, MEASURED, AND WHY IT IS ALLOWED TO.
 *
 * Driven through the real scheduler at 55% and 70% accuracy, a seal moves it on
 * roughly three seals in four. The two cases that do not move are both cases
 * where mastery genuinely did not change:
 *
 *   THE RECOVERY.  A seal immediately after a miss is buying back ground the
 *                  miss cost. The figure comes back up over the next answer or
 *                  two rather than on that one.
 *   THE PLATEAU.   `pL` saturates several items before the engine will CLAIM a
 *                  line, because a claim needs corroboration and not merely
 *                  confidence. Through that stretch the engine's belief about
 *                  this learner is not changing, and a figure that rose anyway
 *                  would be reporting something nobody had learned.
 *
 * Reserving the last tenth of a line for the claim itself was tried, so that
 * holding a line paid a visible point. Measured, it made the plateau LONGER
 * (12 seals in 24 moved the figure, against 16 without it), because it lowers
 * the ceiling the plateau sits on rather than removing it. It is not here.
 *
 * What the cold critic actually reported - "the largest number on screen stayed
 * at 0% through eight sealed rifts" - is gone outright: the first correct answer
 * of a cleared save takes it to 7%, and the third to 10%.
 */


/**
 * How many lines this engine will stand behind. Evidence, not progress — the
 * report prints it and nothing on the live HUD does.
 *
 * It used to be computed in three places with three different expressions.
 * @param {object} mastery the live learner model
 * @returns {{held:number, total:number}}
 */
export function linesHeld(mastery) {
  const nodes = mastery?.graph?.nodes || [];
  let held = 0;
  for (const n of nodes) if (mastery.get(n.id)?.mastered) held++;
  return { held, total: nodes.length };
}

// ---------------------------------------------------------------------------
// Declaring a figure
// ---------------------------------------------------------------------------
/**
 * Declare that this element prints this figure.
 *
 * The value is written as a machine-readable number beside the words, so the
 * gate never has to parse prose in three languages to know what the screen
 * said. Tag the smallest element that carries the figure **and its noun**: the
 * gate reads `data-fig-v` for the number and the element's own text for the
 * name, and it needs both to catch "two figures, one name".
 *
 * An id that is not in `FACTS` throws in dev. A figure that is not in the
 * register is a figure nobody argued for, and the whole defect was figures
 * nobody argued for.
 *
 * @param {Element|null} el
 * @param {string} id one of FIG
 * @param {number|string} value what the element is currently claiming
 * @returns {Element|null} el, so this can wrap an assignment
 */
export function tagFigure(el, id, value) {
  if (!el) return el;
  const fact = FACTS[id];
  if (!fact) {
    // Loud in dev, harmless in a lesson. A build gate reads the register, so an
    // unregistered id fails there whatever this does at runtime.
    if (typeof console !== 'undefined') console.warn('[progress] unregistered figure id:', id);
    return el;
  }
  el.dataset.fig = id;
  el.dataset.figV = String(value ?? '');
  el.dataset.figRole = fact.role;
  el.dataset.figUnit = fact.unit;
  return el;
}

/** Take a figure declaration off an element that has stopped printing one. */
export function untagFigure(el) {
  if (!el) return el;
  delete el.dataset.fig;
  delete el.dataset.figV;
  delete el.dataset.figRole;
  delete el.dataset.figUnit;
  return el;
}

// ---------------------------------------------------------------------------
// MARLOW STATES NO FIGURE
// ---------------------------------------------------------------------------
/**
 * Numbers said in words, in the three languages this game ships in.
 *
 * "Nine points of standing" and "Three rifts sealed" are both spelled out, and
 * a digit test walks straight past both. That is not an accident of the
 * writing — a companion who says "3" reads as a readout, so anyone writing him
 * spells it, which is exactly what makes a prose figure harder to catch than a
 * HUD one and exactly why it needs its own test.
 */
/**
 * WHY "ONE" IS NOT IN HERE.
 *
 * `one`, `uno`, `una`, `jeden` are articles and pronouns far more often than
 * they are counts — "a line is ONE idea", "each rift holds ONE statement",
 * "UNA grieta", "hold this ONE". Treating them as numerals flagged eighty of
 * the four hundred Spanish lines, none of which was a readout. A tally of one
 * is also the least dangerous tally there is: nothing on the glass can be
 * off-by-one against "one line held" without being off by one against itself.
 * So the guard starts at two, and buys back the whole of the writing for it.
 */
const NUMBER = '(?:\\d+'
  + '|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty'
  + '|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|veinte|treinta'
  + '|dwa|dwie|trzy|cztery|pięć|sześć|siedem|osiem|dziewięć|dziesięć'
  + '|jedenaście|dwanaście|dwadzieścia|trzydzieści)';

/**
 * The nouns this game counts, in the three languages — including `standing`,
 * `posición` and `pozycji`, which is the unit the critic caught Marlow using
 * and which appears on no surface in the game at all. The participles are here
 * for the same reason: "{n} sealed." and "two held" are tallies with the noun
 * left out, and a noun-only test walks straight past both.
 */
const COUNTED = '(?:lines?|rifts?|questions?|points?|nights?|seals?|sealed|held'
  + '|l[ií]neas?|grietas?|preguntas?|puntos?|noches?|sellos?|posici[oó]n|sellad\\w*'
  + '|cerrad\\w*|sostenid\\w*|mantenid\\w*'
  + '|lini[ei]|linia|wyrw[aeyą]?|pyta(?:nie|nia|ń)|punkt(?:y|ów|ach)?|noc(?:e|y)?'
  + '|piecz[eę]\\w*|pozycj[iaeę]|zapiecz\\w*|utrzyman\\w*|zamkni[ęe]t\\w*)';

/**
 * ONE FILLER WORD, AND NO MORE — why adjacency is the whole test.
 *
 * The first version of this asked "is there a number anywhere in this sentence
 * and a counted noun anywhere in this sentence", and it flagged 129 of the 400
 * lines in the English bundle. Almost all of them were writing, not readouts:
 * *"the rift has waited nine hundred years"*, *"one more and this whole line of
 * sky opens up"*, *"three in a row — that is not a verdict, it is a Tuesday"*.
 * A guard that silences the writing to protect the numbers has traded a real
 * defect for a worse one, and it would have been switched off within a week.
 *
 * A tally is a number sitting ON a noun. "Three rifts sealed." "Nine points of
 * standing." "{n} lines held." At most one small word may come between them —
 * "nine points OF standing", "two more lines" — and that is the whole licence.
 * Everything the writing wants to do with a number at a distance survives.
 */
const TALLY = new RegExp(`\\b${NUMBER}\\b(?:\\s+\\w+)?\\s+${COUNTED}\\b`, 'i');

/**
 * Does this sentence state a progress figure?
 *
 * @param {string} text a rendered, localised line
 * @returns {boolean}
 */
export function statesAFigure(text) {
  const s = String(text || '');
  if (!s) return false;
  // A percentage needs no noun to be read as the progress number, because the
  // progress number IS a percentage — "you are at forty per cent" is the rig,
  // said out loud, and one frame later it is the rig disagreeing with itself.
  if (/\d\s*%|\d\s*(?:per ?cent|por ?ciento|procent)/i.test(s)) return true;
  return TALLY.test(s);
}

/**
 * The channel guard. Returns the line, or null if it states a figure.
 *
 * Applied in `src/meta/comms.js` to everything Marlow says, so a beat written
 * next year that quotes a count is dropped rather than shipped. Dropping is the
 * right failure: a companion who says nothing is a companion with nothing to
 * say this second, and there is always another line. A companion who says
 * "three rifts sealed" beside a HUD that says something else is the bug.
 */
export function voiceSafe(text) {
  return statesAFigure(text) ? null : text;
}
