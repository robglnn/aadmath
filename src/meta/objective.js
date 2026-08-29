/**
 * WHAT TO DO NEXT — derived, never stored.
 *
 * The defect this file exists to kill, in the player's own words: *"unsure what
 * to do next? not sure what to do about rifts, shards, and other things, not
 * super sure how the player learns or proceeds."* He had played a full session.
 * He had collected eight hundred shards. He had visited seven islands. And the
 * game had never once told him, in one sentence, what it wanted.
 *
 * ASCENT already knew the answer the whole time — `mastery.next()` returns the
 * single highest-leverage skill for this learner on every frame — but that
 * answer only ever reached the *inside* of a rift he had already found. The
 * objective is that answer, spoken out loud, before he has found anything.
 *
 * It is computed from live state on every tick rather than written down, which
 * is what makes it survive a session break for free: there is no objective
 * record to reload, restore or migrate. Close the tab in the middle of a
 * sentence, come back a week later, and the first frame carries the same one
 * sentence the last frame did, because both are a function of the same save.
 *
 * The four scheduler verbs are the four things the scheduler can ask for, and
 * they are deliberately different words. "Seal the rift" and "Prove the line"
 * are not dressing on one action: the first is practice and the second is the
 * proving run that actually closes a claim, and a player who cannot tell them
 * apart cannot tell that he is nearly finished with something.
 *
 * THERE ARE THREE MORE VERBS AND THEY ARE NOT ABOUT A TEAR AT ALL. Every one of
 * the scheduler's five kinds resolved to *open a rift*, so the card could not
 * send anybody to the two best objects this game owns — the hanging caches and
 * the spans — and across three measured eighteen-minute sittings nobody opened
 * one. `crack`, `lay` and `climb` are the answer, and the block above
 * `FIELD_VERB` is the whole of the rule.
 *
 * ---------------------------------------------------------------------------
 * THE DEFECT THIS FILE WAS NAMED FOR, AND THE ONE RULE THAT ANSWERS IT
 *
 * A critic put the whole of it in one sentence: **the loop re-offers the same
 * ring the instant you seal it.** Measured on the project's own gate
 * (`tools/critic/motion.mjs`, frozen build, eighteen minutes): 805 consecutive
 * seconds inside one 2 m circle, 400 items served there, 3.7% of the sitting
 * spent going anywhere at all. Measured again at human pace: 24 of 36 rift
 * openings with the cadet less than two metres from the previous one, median
 * rift-to-rift travel **0 m**, longest chain nine openings on one square metre.
 *
 * The mechanism was here. `mastery.next()` keeps naming a line until it is
 * held, `taskFor()` routes the item correctly whichever tear it is asked
 * through, and this function turned both of those true facts into an objective
 * that pointed at the ground the cadet was already standing on. The card said
 * YOU ARE STANDING IN IT, the key opened the same aperture again, and the
 * mathematics arrived through it for thirteen minutes.
 *
 *   **THE OBJECTIVE MAY NEVER NAME A DOOR THAT IS SHUT.**
 *
 * A tear that has given what one arrival is worth is SPENT until the cadet has
 * opened another one (`src/session/stint.js`). While it is spent this function
 * names the nearest other OPEN tear instead — a line the lattice has already
 * unlocked, so it is work the scheduler was going to want, not a diversion into
 * something the learner has not earned.
 *
 * And when there is genuinely nowhere else to OPEN, the objective asks for the
 * other thing this world owns: a place. See the field-leg block below — a
 * hanging cache, a span or a survey mark, chosen against the kit the cadet has
 * bought with held lines, so the walk gets longer as the mathematics gets
 * better and never as it gets worse.
 *
 * And when there is no such place either — the first line of the first sitting,
 * one tear standing, nothing in reach — the objective steps aside and gives the
 * arrival back (`stint.release`) and names the tear, exactly as it always did.
 * That is also the proof that the rule cannot lock anybody out: at most one
 * tear is ever spent, so either another one is open and this function names it,
 * or a place is in reach and this function names that, or neither is and the
 * spend ends here, on this line.
 *
 * **A cadet who is struggling is never made to walk further than a cadet who is
 * not.** The walk this asks for is one leg: to the nearest open tear, or to the
 * nearest place the cadet's own kit can reach. It does not lengthen with misses
 * and it does not lengthen with time; there is nothing in either rule that can
 * make it grow. The only thing that lengthens it is holding more lines, which
 * is the exact opposite of a penalty.
 *
 * NOR IS THE LINE ABANDONED, which is the other half of the promise the product
 * brief makes ("stays on that topic until it is mastered — no spiral that
 * abandons them"). The spend ends the moment the cadet opens the tear they were
 * sent to, so `mastery.next()` is asked again with nothing in its way and names
 * the same line it wanted before — and this function names it again on the very
 * next poll. The wanted line is on the card for the whole of the other tear's
 * arrival. A learner alternates between two open lines; nothing drops one.
 *
 * ---------------------------------------------------------------------------
 * AND THE CORRECTION THIS ROUND: THE RULE ABOVE ONLY EVER RAN FOR THE CADET WHO
 * WAS ALREADY FINE.
 *
 * Two cold eighteen-minute sittings on the frozen build, same code, the only
 * difference being whether the answer handed in was the right one:
 *
 *   ANSWERING WELL   median leg 4.36 m, 13 legs over 20 m.
 *   MISSING          43 consecutive openings of one ring from inside a 2 m
 *                    circle in 290 s, this function naming one node on 94.9%
 *                    of samples, 5.9% of the window moving — and `spent` FALSE
 *                    on 1158 of 1158 samples.
 *
 * Every sentence above was written about a spend that never happened. The three
 * bounds that finish an arrival all lived in `src/session/stint.js` and all
 * three were unreachable for a learner who was missing (that file's fourth
 * correction has the measurement); with none of them able to fire, this
 * function was being told — honestly — that the tear the cadet was standing on
 * still had an arrival in it, and it duly named it again, and again.
 *
 * With the arrival able to end, one thing here had to change as well: WHICH
 * SOMEWHERE-ELSE A DRY ARRIVAL BUYS. A diversion to the nearest other open tear
 * is a change of LINE, and the cadet who has just missed for a hundred and
 * fifty seconds is precisely the one the brief forbids moving off a line. So an
 * arrival that landed nothing asks for a PLACE first — a cache, a span, a mark
 * — which is a change of scene and a change of representation and not a change
 * of topic. See the block above `FIELD_EVERY`. The distance is read off the kit
 * the cadet holds, exactly as before, so a cadet who is missing is offered the
 * SHORTEST leg in the table and never a longer one.
 *
 * ---------------------------------------------------------------------------
 * AND THE FIFTH CORRECTION: THE PLACE THIS FILE PROMISED DID NOT EXIST.
 *
 * All of the above landed and the sitting did not move. Re-measured on the
 * frozen build with the arrival clock working (`tools/critic/_laneB-probe.mjs`,
 * 220 s at the boot tear, missing every answer):
 *
 *   age  1 → 147 of 150   the clock now runs through the card, as promised;
 *   t≈150                 `expired()` closes it and `end()` FILLS the arrival;
 *   t≈151                 `spent` already reads null and `age` reads 0 again;
 *   t≈153                 the SAME ring re-opens on the same square metre.
 *   objective             `var-meaning` on 100% of samples, both openings.
 *
 * The spend was being handed back inside the same frame it was granted, by the
 * `release` at the bottom of this function — and that branch was right about
 * the facts. `tools/critic/_laneB-boot.mjs` on a cleared save:
 *
 *   TEARS   10 in the world, **1 OPEN**. `content/graph/algebra1-l1.json` has
 *           one root, so a cadet who lands nothing never unlocks a second door.
 *   PLACES  every cache, span and meet is registered `air: true`
 *           (src/kit/kit.js), which `REACH` gates behind `kite` — THREE HELD
 *           LINES — and the three marks that stand on the ground
 *           (src/world/errand.js) are 98 m, 128 m and 170 m from the seat of
 *           `var-meaning`, against a first-row envelope of **70 m**.
 *
 * So for the cadet holding nothing — which is every cadet on their first line,
 * and every struggling cadet for the whole of a sitting — the set of places
 * this file was allowed to name was EMPTY. `pickField()` returned null on every
 * poll, `away` was null because there is one door, and the only branch left was
 * to give the arrival back and name the ring again. Every rule above was
 * working. None of them had anywhere to point.
 *
 * WHAT CHANGED: `REACH` grew a second envelope, `relief`, used on exactly the
 * frames where the alternative is a leg of length ZERO — no other tear open at
 * all. That condition is a fact about THE WORLD and never about the learner, so
 * the cadet who is answering well and the cadet who is missing are handed the
 * same envelope on the same frames; nothing here reads a miss, a streak or a
 * clock to decide a distance. And inside it the ladder is climbed from the
 * bottom: `pickField` now prefers the LOWEST RUNG before the shortest walk,
 * which is `src/world/errand.js`'s own rule for `offer()` — so the card names
 * the rung-0 mark the world is already lighting instead of the rung-1 summit
 * eighty metres beyond it, and the two instruments agree.
 */
import * as THREE from 'three';
import { linesHeld } from './progress.js';
import { liveStint } from '../session/stint.js';
import { t } from '../i18n/index.js';

/** Which verb a scheduler `kind` asks for. */
const VERB_FOR = {
  learn: 'seal',
  probe: 'seal',
  check: 'prove',
  review: 'watch',
  deep: 'sound',
};

/* ===========================================================================
 * THE FIELD LEG — the objective that is not a tear.
 *
 * THE DEFECT, IN ONE LINE OF THIS FILE. Every one of the five entries above
 * resolves to *open a rift*. So across three cold eighteen-minute sittings the
 * objective asked for a traversal verb exactly **zero** times: dash 0, glide 0,
 * build 0, and **not one hanging cache and not one span opened in fifty-four
 * minutes of play**. The kit ladder in src/kit/ladder.js buys six traversal
 * capabilities with held lines, and the game never once asked for one of them
 * back. A capability nothing spends is a certificate.
 *
 * The caches are the thing a real player singled out unprompted and a critic
 * called the best object in the build. Nothing in a session sent anybody to
 * one, because this table had no word for it.
 *
 * WHAT A FIELD SITE IS. A place in the world that is not a tear and that
 * carries real mathematics you do with your feet: a hanging cache (a balance,
 * src/world/caches.js), a span (an area, src/world/span.js), a survey mark (a
 * climb, src/world/errand.js). Each one registers itself here through
 * `registerField` — there is no import from this file into any of them, so
 * nothing outside this lane had to be edited to make the objective able to see
 * the world it is pointing at.
 *
 * WHEN IT IS ASKED FOR, and this is the whole of the safety argument. The leg
 * is offered in **exactly the state where this function used to give up** — the
 * tear the scheduler wants has already given its arrival, and there is no other
 * open tear inside a diversion's reach. Before this, that state released the
 * arrival and re-named the same tear on the same square metre, which is the
 * measured defect: the objective named the SAME tear in 44 to 54 of every 55 to
 * 62 legs, **median travel between openings 0 m**. So this branch can only ever
 * replace a leg of length zero. It cannot lengthen a leg that already existed.
 *
 * AND A STRUGGLING LEARNER IS NEVER SENT FURTHER — the rule is the exact
 * opposite, by construction. How far the game may point is read off TWO things
 * and neither of them is the learner: THE KIT THE CADET IS HOLDING, which is
 * bought with held lines (src/kit/ladder.js), and WHETHER THE WORLD HAS ANOTHER
 * DOOR — the `relief` column in `REACH`, which widens the envelope on the
 * frames where the only other answer available is the ground the cadet is
 * standing on. Both readings are identical for the cadet who is landing them
 * and the cadet who is not, on the same frame, at the same tear. A cadet
 * holding the wing is offered the coast; the walk gets longer as the
 * mathematics gets better, never as it gets worse, and nothing here reads a
 * miss, a streak or a clock.
 *
 * That is also the answer to the experiment recorded further down this file,
 * which sent a first-line cadet to a survey mark on the Ossuary and measured
 * 33 items in ten minutes against 51 in six. That cadet held no kit at all, so
 * under this rule the Ossuary is not offered to him: his ladder starts at a
 * mark he can walk to.
 * ========================================================================= */

/**
 * The verb a field site asks for. Deliberately not `seal` — the whole point is
 * that the card can say something the keypad cannot answer.
 */
const FIELD_VERB = {
  cache: 'crack',
  deepcache: 'crack',
  span: 'lay',
  mark: 'climb',
  /* THE MEET (src/world/meet.js) — the fifth kind of place, registered by
     `src/kit/kit.js` alongside the caches and the spans, and the only site in
     the archipelago whose reading is continuous. It had no row here, so
     `FIELD_VERB[site.kind] || 'climb'` printed REACH THE MARK at a crossing, in
     all three locales. The word was already waiting: `guide.verb.cross` is in
     en, es and pl, and its own comment says the one line this file needed. */
  meet: 'cross',
};

/**
 * HOW FAR THE GAME MAY POINT, AND AT WHAT, given what the cadet holds.
 *
 * `rung` is the site's own access ladder — 0 a walk, 1 a glide or a short
 * climb, 2 height you have to arrive with, 3 a column you had to earn. Those
 * numbers are the ones src/world/caches.js, src/world/span.js and
 * src/world/errand.js already write down in their own headers; this table only
 * says which of them a given cadet may be shown.
 *
 * `need` is a grant id from src/kit/ladder.js. `vault` is one held line,
 * `kite` is three, `legs` is five. The ladder is cumulative, so the loop stops
 * at the first rung the cadet has not bought.
 *
 * The metres are the leg this may ask for. The first row is the same 70 m as
 * `DIVERT_MAX` below — the leg a diversion to another tear was already allowed
 * to be — so the cadet who has bought nothing is never asked to walk one metre
 * further than the old rule already asked of him. It is written out rather than
 * read off that constant because `DIVERT_MAX` is declared further down the file
 * and this table is evaluated at module load; the two must move together.
 *
 * `air` IS THE ONE THAT MATTERS MOST, and it is not a distance. A survey mark
 * stands on ground: legs and a jump reach it, and the rung says how much of a
 * climb it is. A hanging cache and a span do not — there is nothing under
 * either of them, and the honest way in is the wing. So they are named only
 * once `kite` is held, which is THREE HELD LINES. That is the whole of BRIEF
 * product goal 1 in one field: the flight out to the best object in this game
 * is paid for in mathematics, and it is offered on the day it is paid for.
 * `src/world/errand.js` states the rule this borrows from: an errand you cannot
 * physically complete teaches the player that the marker lies.
 */
/**
 * …AND `relief`, THE ENVELOPE THAT APPLIES WHEN THE ALTERNATIVE IS A LEG OF
 * LENGTH ZERO. This is the column the fifth correction added, and it is worth
 * the paragraph because it is the one number that decides whether the world can
 * open for a cadet who is missing.
 *
 * MEASURED, on the frozen build, from a cleared save
 * (`tools/critic/_laneB-boot.mjs`): the seat of `var-meaning` is at (0.1, −22),
 * and the three places a cadet holding no kit is allowed to be shown — the
 * marks, the only sites registered with `air: false` — stand at **98 m**
 * (`spine`, rung 1), **128 m** (`reckoning`, rung 0) and **170 m** (`ossuary`,
 * rung 1). Every cache, span and meet is `air: true` and is therefore gated
 * behind `kite`, which is three held lines. Against a first-row envelope of
 * 70 m that is an empty set: on the first line of the first sitting this file
 * could name NO place at all, so the field leg — the whole of its answer to
 * "a change of scene and a change of way in" — was unreachable in exactly the
 * state it was written for, and the only branch left was to hand the arrival
 * back and name the same ring again.
 *
 * 70 m was never a measurement of where a place stands. It was copied off
 * `DIVERT_MAX`, which is a rule about diverting to ANOTHER TEAR and is sized on
 * how far apart tears are seated (26–40 m, `SEPARATIONS` in src/world/rifts.js).
 * The bottom rung of the errand ladder is 128 m away, and `src/world/errand.js`
 * calls that rung *a walk*.
 *
 * WHEN IT IS USED, AND WHY THAT IS NOT A PENALTY ON STRUGGLE. Only when there
 * is no other open tear to divert to — `!away` in `resolveObjective`. That is a
 * fact about the WORLD (this lattice has one root, so the first line has one
 * door) and not a fact about the learner: the cadet who is answering well and
 * the cadet who is missing are handed the same envelope on the same frames, and
 * the moment a second line unlocks BOTH of them go back to the 70 m column.
 * Nothing in this table is read off a miss, a streak or a clock. It replaces a
 * leg of length zero and can never lengthen a leg that already existed.
 *
 * 140 m, because the lowest rung of the ladder stands at 128 and the rule must
 * not depend on a cadet's exact footing on the dais. It is deliberately NOT
 * wide enough to reach the Ossuary at 170 — that is the site the experiment
 * recorded further down this file measured at 33 items in ten minutes against
 * 51 in six, and it stays out of reach of a cadet who has bought nothing.
 * Past the first two rows the two columns are the same number: a cadet holding
 * the wing already has the coast.
 */
const REACH = [
  { need: null, rung: 1, metres: 70, relief: 140, air: false },
  { need: 'vault', rung: 2, metres: 150, relief: 150, air: false },
  { need: 'kite', rung: 3, metres: 260, relief: 260, air: true },
  { need: 'legs', rung: 3, metres: 340, relief: 340, air: true },
];

/**
 * SECONDS ONE FIELD LEG MAY OWN, and then the game stops asking.
 *
 * A sitting is fifteen to twenty-five minutes (BRIEF product goal 3) and holds
 * about eight filled arrivals, of which this rule claims one in three. Two
 * minutes is the most any one of them can be worth: past that the leg is not a
 * beat, it is the hike `tools/critic/traffic.mjs` exists to refuse, and the
 * cadet is better served by the tear behind them. It is a ceiling and not a
 * timer — nearly every leg ends by arriving, which is `LEG_DONE_M` below.
 */
const LEG_MAX_S = 120;
/** Metres from a site at which the leg is finished, whatever the site says. */
const LEG_DONE_M = 12;
/**
 * Metres at which a tear ends a field leg on its own.
 *
 * `REACH` in src/world/rifts.js is 9 m to the plate and is measured from the
 * foot; this is measured from the ring and is deliberately a little wider, so
 * the card lets go slightly BEFORE the key starts working rather than slightly
 * after. A signpost that is still arguing when the key is live is the two-metre
 * ring that file's own header is about.
 */
const PLATE_M = 14;

/**
 * Every source of field sites, registered by the module that owns them.
 *
 * `src/kit/kit.js` registers the caches and the spans, because it is handed
 * both at construction. `src/world/errand.js` registers the survey marks.
 * Registration rather than import is what keeps this out of anybody else's
 * file: `src/world/caches.js` and `src/world/span.js` are untouched, and the
 * only lines this lane wrote outside it are four in `src/meta/guide.js` and one
 * in `src/meta/rite.js`, which read the name a place carries instead of looking
 * it up in a bundle that has never held it.
 *
 * A source returns rows of:
 *   `{ id, kind, x, y, z, rung, air, open, nameKey }`
 * `open` is false once the place has been cracked, laid or claimed, and a
 * closed place is never named — a signpost pointing at a solved puzzle is the
 * defect this whole file exists to stop.
 */
const FIELD = [];

/** @param {() => Array} fn a live view over one kind of place. */
export function registerField(fn) {
  if (typeof fn === 'function' && !FIELD.includes(fn)) FIELD.push(fn);
}

/** For a harness that tears the page down and builds a second one. */
export function clearField() { FIELD.length = 0; }

function fieldSites() {
  const out = [];
  for (const fn of FIELD) {
    try {
      const rows = fn();
      if (Array.isArray(rows)) for (const r of rows) if (r && r.open) out.push(r);
    } catch { /* a source mid-teardown is not evidence */ }
  }
  return out;
}

/** What the cadet's kit lets the game point at. See `REACH`. */
function reachOf(kit) {
  let step = REACH[0];
  for (let i = 1; i < REACH.length; i++) {
    let has = false;
    try { has = !!kit?.has?.(REACH[i].need); } catch { has = false; }
    if (!has) break;
    step = REACH[i];
  }
  return step;
}

/**
 * THE LEG THAT IS STANDING, if one is.
 *
 * Module state, and it is the same argument `liveStint` makes twenty lines
 * below: there is one page, one cadet and one objective, and this function is
 * asked by four surfaces at four different rates. A latch that lived in one of
 * them would make the card and the compass disagree, which is the defect this
 * codebase has the longest record of.
 *
 * It exists because an objective that changes its mind halfway is worse than
 * one that is wrong. The spend that opens this branch is given back on its own
 * after seventy-five seconds (`RELENT` in src/session/stint.js), and without a
 * latch the card would turn round and point back at the tear while the cadet
 * was still in the air on the way out.
 */
let leg = null;

/**
 * HOW OFTEN A FILLED ARRIVAL BUYS A WALK TO A PLACE — one in every three.
 *
 * The first cut of this rule only fired when there was no other tear to open,
 * and that is backwards: tears are seated twenty-six to forty metres apart
 * (`SEPARATIONS` in src/world/rifts.js), so from the second unlocked line
 * onwards there is nearly always another tear, and the field leg would have
 * stopped firing exactly as the kit that reaches the good places got good. The
 * measured consequence of never firing is on the record: **zero caches and zero
 * spans opened in fifty-four minutes of play.**
 *
 * Three, from this game's own arithmetic. One arrival is three pieces of work
 * (src/session/stint.js) and a 15-25 minute sitting is about twenty-four items
 * (tools/session-length.mjs), so a sitting holds about eight arrivals and this
 * buys two or three walks in it. At the leg lengths below that is roughly two
 * minutes of a twenty-minute sitting — comfortably inside the third that
 * `tools/critic/traffic.mjs` allows for the walk, and it is not a walk through
 * nothing: every one of these places is a composed site with mathematics in it.
 *
 * AND IT IS NOT A PENALTY ON STRUGGLE. A cadet who is missing fills arrivals
 * on the attempt ceiling rather than on work done, so they reach this count at
 * the same rate or faster — and what they are handed is the SHORTEST leg in the
 * table, because they are holding the least kit. The leg they are given
 * replaces a diversion to another tear that was already allowed to be seventy
 * metres, so at the bottom of the ladder the two are the same walk. Only the
 * cadet who has bought the wing is ever pointed at the coast.
 */
const FIELD_EVERY = 3;
/** Filled arrivals seen since the page opened, and the last one counted. */
let spends = 0;
let wasSpent = false;
/**
 * WHICH ARRIVAL THE LAST LEG BELONGED TO — one leg per arrival, at most.
 *
 * Without this the ceiling below cannot bite and the card flickers. A leg ends
 * (arrived, or out of time) and this function is asked again a fifth of a
 * second later with the tear still spent and the same site still the best one
 * in reach — so it latches the same leg again, with a fresh clock, for ever.
 * Standing ON the mark, `legStanding` would clear the leg and `pickField`
 * would name it again on the same frame: a card reading REACH THE MARK at
 * somebody who is standing on it, which is this codebase's oldest defect
 * wearing a new hat.
 *
 * So a leg is spent the same way an arrival is. The next one is bought by the
 * next arrival, and until then the tear behind the cadet is the objective —
 * which is exactly what a cadet who has just walked somewhere wants next.
 */
let legAt = -1;

/**
 * The cadet arrived, the place is solved, the cadet went back to a tear, or the
 * leg ran out of its own time.
 *
 * ARRIVING IS HORIZONTAL AND GENEROUS. The site itself decides whether to pay —
 * a mark wants to be within fourteen metres vertically, a cache wants you on
 * the perch — and that is the site's business. The OBJECTIVE's business is
 * whether it is still pointing somewhere the cadet is not, and standing under
 * a thing is not being sent to it.
 *
 * AND THE CADET CAN ALWAYS SAY NO. Walking back onto an open plate ends the
 * leg on the spot, so a signpost can never stand between somebody and a tear
 * that is ready to serve them. This is the anti-lock valve, in the same shape
 * `src/session/stint.js` uses for the spend it opens.
 */
function legStanding(sites, player, now, backAtATear) {
  if (!leg) return null;
  const live = sites.find((s) => s.id === leg.id && s.kind === leg.kind);
  if (!live) { leg = null; return null; }
  if (backAtATear()) { leg = null; return null; }
  if (now - leg.at > LEG_MAX_S * 1000) { leg = null; return null; }
  const d = Math.hypot(player.pos.x - live.x, player.pos.z - live.z);
  if (d < LEG_DONE_M) { leg = null; return null; }
  return live;
}

/**
 * Is the cadet standing at a tear that would open for them right now? Measured
 * against `Rifts.REACH` the same way the interact key is, so the card and the
 * key cannot disagree about it.
 */
function onAnOpenPlate(rifts, player, isSpent) {
  for (const r of rifts.list) {
    if (r.locked || isSpent(r.id)) continue;
    if (player.pos.distanceTo(r.group.position) <= PLATE_M) return true;
  }
  return false;
}

/**
 * WHICH PLACE, and it is not simply the nearest one.
 *
 * A hanging cache is the object a real player singled out unprompted and a
 * critic called the best thing in this build, and a span is the only site that
 * lays permanent ground. A survey mark is a good beat and it is the bottom of
 * the ladder. So inside the envelope the cadet's kit has earned, the game asks
 * for the best thing it owns rather than the closest — the envelope is where
 * "is this a hike" is decided, and it is decided once.
 */
const KIND_RANK = { cache: 0, deepcache: 0, span: 1, meet: 2, mark: 2 };

/**
 * The open field site this cadet's kit is entitled to be shown.
 *
 * `relief` asks for the wider of the two envelopes in `REACH`, and it is passed
 * on exactly one condition: there is no other open tear, so the only other
 * answer this function can give is the ground the cadet is already standing on.
 * See the block above `REACH`.
 *
 * THE LADDER IS CLIMBED FROM THE BOTTOM. Inside a kind, the LOWEST RUNG wins
 * and distance only breaks a tie — which is `offer()`'s rule in
 * src/world/errand.js, in the same words ("always lights the LOWEST unclaimed
 * rung … distance breaks ties inside a rung"). It used to be distance alone,
 * and the two instruments then disagreed on the one frame it matters most: from
 * the boot tear the rung-1 summit is 98 m and the rung-0 stone ring is 128 m, so
 * the card would have sent a cadet who has bought nothing up the Spine while the
 * world's own marker stood on the Reckoning.
 */
function pickField(sites, player, kit, relief = false) {
  const step = reachOf(kit);
  const cap = relief ? (step.relief ?? step.metres) : step.metres;
  let best = null;
  let bd = Infinity;
  let bk = 99;
  let br = 99;
  for (const s of sites) {
    if (!(s.rung <= step.rung)) continue;
    if (s.air && !step.air) continue;
    const d = Math.hypot(player.pos.x - s.x, player.pos.z - s.z);
    if (d > cap) continue;
    const k = KIND_RANK[s.kind] ?? 3;
    const r = s.rung ?? 0;
    if (k > bk) continue;
    if (k === bk && r > br) continue;
    if (k === bk && r === br && d >= bd) continue;
    bk = k; br = r; bd = d; best = s;
  }
  return best;
}

/** The objective, when it is a place rather than a line. */
function fieldObjective(site, mastery) {
  const pos = new THREE.Vector3(site.x, site.y, site.z);
  return {
    skill: site.id,
    /* THE NAME THE CARD PRINTS. A field site has a name of its own and no row
       in the skills bundle, so it carries one. `src/meta/guide.js` prefers this
       over `t('skills.' + skill)` when it is there — one line, additive. */
    name: t(site.nameKey),
    verb: FIELD_VERB[site.kind] || 'climb',
    kind: site.kind,
    /* Read by everything that draws: there is no tear here, and every surface
       that wants one already tests for it. `src/meta/relay.js` returns null
       rather than naming a tear; `src/world/afford.js` stands the gold column
       down; `src/meta/guide.js` measures the plain distance. */
    rift: null,
    field: true,
    pos,
    aim: new THREE.Vector3(site.x, site.y + 16, site.z),
    pay: 'field',
    payN: 0,
    payName: '',
    payGist: '',
    spent: true,
    ...countLines(mastery),
  };
}

/**
 * The one thing to do right now — a line, or a place.
 *
 * @param {{mastery:object, rifts:object, player:object, kit:object|null,
 *          stint:object|undefined}} ctx
 * @returns {{skill:string, verb:string, kind:string, rift:object|null,
 *            name?:string, field?:boolean, pos:object, aim:object,
 *            pay:string, payN:number, payName:string, payGist:string,
 *            spent:boolean, held:number, open:number, locked:number}|null}
 *   `rift` is null and `field` is true when the objective is a place rather
 *   than a tear; `name` is then the localised name that place carries, because
 *   it has no row in the skills bundle. Every surface that wants a tear already
 *   tests `rift`.
 */
export function resolveObjective(ctx) {
  const { mastery, rifts, player, kit } = ctx;
  if (!rifts?.list?.length) return null;

  // The live arrival (src/session/stint.js). Taken from the context when a
  // caller has one and from the page's own stint otherwise, so that neither of
  // the two files that call this function — and this lane owns neither — has to
  // be edited to thread it through.
  const stint = ctx.stint || liveStint();
  const isSpent = (id) => { try { return !!stint?.spent?.(id); } catch { return false; } };
  /** Did that arrival land anything? See the block above `FIELD_EVERY`. */
  const isDry = (id) => { try { return !!stint?.spentDry?.(id); } catch { return false; } };

  const sites = fieldSites();
  /* A LEG ALREADY UNDER WAY OUTRANKS EVERYTHING except the cadet. It is
     finished by arriving, by the place being solved, by walking back onto an
     open plate, or by its own clock — never by the scheduler changing its mind
     while the cadet is in the air. */
  const standing = legStanding(sites, player, Date.now(),
    () => onAnOpenPlate(rifts, player, isSpent));
  if (standing) return fieldObjective(standing, mastery);

  const pick = safeNext(mastery);
  let rift = pick ? rifts.list.find((r) => r.id === pick.id && !r.locked) : null;

  // The scheduler named a line with no rift standing for it (it can, at the
  // very top of the lattice) — or named nothing at all. Fall back to the
  // nearest thing that is actually open, because an objective that points at
  // nothing is worse than an objective that points at the wrong thing.
  if (!rift) {
    rift = nearestOpen(rifts, player, false, isSpent)
      || nearestOpen(rifts, player, true, isSpent)
      || nearestOpen(rifts, player, false)
      || nearestOpen(rifts, player, true);
  }
  if (!rift) return null;

  // ---- THE SPENT TEAR. Somewhere to go, or the arrival back ----------------
  let spent = false;
  /* One count per SPEND, not per poll: this function is asked about twice a
     second by three surfaces, and `RELENT` in src/session/stint.js hands a
     spend back on its own, so the honest event is the edge. */
  const nowSpent = isSpent(rift.id);
  if (nowSpent && !wasSpent) spends++;
  wasSpent = nowSpent;
  if (nowSpent) {
    const away = nearOpen(rifts, player, false, isSpent, rift)
      || nearOpen(rifts, player, true, isSpent, rift);
    /* ---- THE FIELD LEG ---------------------------------------------------
       Every third filled arrival, every arrival with nowhere else to open, and
       EVERY ARRIVAL THAT LANDED NOTHING. See `FIELD_EVERY` and `REACH` — how
       far it may point is read off the kit the cadet has bought with held
       lines, never off how they are doing.

       THE DRY ARRIVAL IS THE ONE THIS FILE WAS RE-OPENED FOR. A cadet who has
       just spent a whole arrival missing is the cadet a diversion to the next
       tear serves worst: the next tear is a different LINE, and the product
       brief is explicit that a learner who is struggling stays on the topic
       until it is mastered. A place is not a different line. A hanging cache is
       a balance, a span is an area, a survey mark is a climb — the same
       mathematics, in a representation the keypad cannot draw, in a part of the
       island they have not been standing on. That is the change of scene and
       the change of way in that the sitting measured on this build never once
       produced: 43 consecutive openings of ONE ring from inside a 2 m circle.

       AND IT IS NOT A LONGER WALK. The site is chosen out of the same `REACH`
       envelope as every other leg, and that envelope is read off two facts:
       what the cadet HOLDS, and whether the world has another door. Neither is
       a fact about how they are doing. On the frames where a second tear is
       open both learners get the seventy metres a diversion was already allowed
       to be; on the frames where there is one door — the first line, for
       everybody — both get the relief column, because the only other sentence
       available is the name of the ground under their feet. Nothing here reads
       a miss, a streak or a clock to decide a distance. */
    const dry = isDry(rift.id);
    const due = spends > 0 && spends % FIELD_EVERY === 0;
    /* THE RELIEF ENVELOPE, and the whole of the condition for it: there is no
       other tear open, so the only other sentence this function can say is the
       name of the ground under the cadet's feet. That is a fact about the world
       — `content/graph/algebra1-l1.json` has one root, so the first line has one
       door — and it is the same fact for the cadet who is landing them and the
       cadet who is missing. Measured before it existed: 1 open tear, 0 places
       inside 70 m, `spent` handed back inside the frame it was granted, the same
       ring re-opened at 100% of samples. See the block above `REACH`. */
    const relief = !away;
    const site = (spends !== legAt && (dry || due || !away))
      ? pickField(sites, player, kit, relief)
      : null;
    if (site) {
      leg = { id: site.id, kind: site.kind, at: Date.now() };
      legAt = spends;
      return fieldObjective(site, mastery);
    }
    if (away) {
      rift = away;
    } else {
      /* NO OTHER TEAR — so the rule steps aside, and it is measured that it
         has to.

         The obvious alternative was tried and is worse: keep the tear spent and
         let the island be the beat, because `src/meta/relay.js` already lights
         a survey mark on exactly this frame. On a shard with one tear open that
         turns the whole of the first line into a hike — the marks stand on the
         Henge, the Spine and the Ossuary, which are a long way off and up — and
         the sitting measured 33 items in ten minutes against 51 in six with the
         rule stood down. Sending a cadet across the island before they have
         held their first line is not a beat, it is an obstacle course with
         arithmetic in it, which is the exact failure `tools/critic/traffic.mjs`
         exists to catch.

         So: the mark is still lit and the relay still names it — going is
         worth it and always available — but it is an OFFER, not the objective,
         and the tear opens again for a cadet who would rather keep working.
         The arrival clock in src/session/stint.js is what stops that becoming
         a worksheet: one arrival is still one arrival, however it ends.

         WHAT CHANGED, AND WHAT DID NOT. The field leg above is asked FIRST, so
         this branch is reached only when there is also no place in reach at all.
         That USED TO BE the state at the boot tear on every save — `var-meaning`
         has no mark inside seventy metres — and it is why the fifth correction
         at the head of this file exists: "no place in reach" was not a property
         of the island, it was a property of the envelope, and it made this
         branch the whole of the first line for a cadet who was missing. With
         `relief` it is reached only when the shard genuinely has nothing left
         standing: every mark held, every cache cracked, no other tear open.

         The experiment quoted above is still honoured where it was measured.
         It sent a first-line cadet to the OSSUARY, 170 m out and up, and the
         relief envelope stops at 140 — so the site that experiment measured is
         still not one a cadet holding nothing is ever shown. What they are shown
         is the rung-0 stone ring `src/world/errand.js` calls "the first mark
         anybody is ever shown … it stands on the ground", which is the mark the
         world's own marker was already lighting at them while this card pointed
         at their feet. */
      try { stint.release(rift.id); } catch { /* a beat must never stop the loop */ }
      spent = true;
    }
  }

  const st = mastery.get?.(rift.id) || null;
  const kind = pick && pick.id === rift.id ? pick.kind : (st?.mastered ? 'deep' : 'learn');
  const verb = VERB_FOR[kind] || 'seal';

  // ---- what holding this line is actually worth, in that order of interest
  const opens = wouldUnlock(mastery, rift.id);
  const grant = nextGrantOf(kit);
  let pay = 'calm';
  let payN = 0;
  let payName = '';
  /* …and what it DOES, in six words. The card names a reward the player has
     never seen; a name with no meaning behind it is not a reason to walk.
     (hud/slotting pass: `gist` comes off kit.nextGrant(), i18n additive.) */
  let payGist = '';
  if (st?.mastered) {
    pay = 'sound';
  } else if (opens > 0) {
    pay = 'lines';
    payN = opens;
  } else if (grant) {
    pay = 'kit';
    payName = grant.name;
    payGist = grant.gist || '';
  }

  const tally = countLines(mastery);
  const foot = rift.foot || rift.group?.position || rift.pos;
  return {
    skill: rift.id,
    verb,
    kind,
    rift,
    // Two points, deliberately. Distance is measured to the plate you have to
    // stand on; the marker is drawn sixteen metres above the ring. At the ring
    // itself it lands on top of the world's own label for the same object
    // (src/world/beckon.js) — two captions on one thing is a HUD — and a
    // waypoint standing clear of the skyline is also simply easier to fly at.
    pos: foot,
    aim: new THREE.Vector3(foot.x, foot.y + 16, foot.z),
    pay,
    payN,
    payName,
    payGist,
    /* Additive, and read by nothing that draws: it is the fact that this tear
       had already given its arrival and the shard had nothing else to offer,
       so a critic can tell that case apart from an ordinary objective. */
    spent,
    ...tally,
  };
}

/**
 * held / open / locked, across the whole lattice. The arc, in three numbers.
 *
 * `held` is THE progress number and is therefore not counted here: it comes
 * from `linesHeld()` in src/meta/progress.js, which is the single definition
 * every surface in the game reads. This function used to count it itself, the
 * report counted it a second way and the session close a third — three
 * expressions for one figure, on the one number a teacher is asked to trust.
 */
export function countLines(mastery) {
  const { held, total } = linesHeld(mastery);
  let open = 0;
  for (const n of mastery.graph.nodes) {
    if (mastery.get(n.id)?.mastered) continue;
    if (mastery.isUnlocked(n.id)) open++;
  }
  return { held, open, locked: total - held - open, total };
}

/**
 * How many further lines holding this one would open. Only lines whose *every
 * other* prerequisite is already held count: "this unlocks three" has to be
 * true on the next frame after you seal it, or it is a promise the game breaks.
 */
function wouldUnlock(mastery, id) {
  let n = 0;
  for (const node of mastery.graph.nodes) {
    if (!node.prereqs?.includes(id)) continue;
    if (mastery.isUnlocked(node.id)) continue;
    if (node.prereqs.every((p) => p === id || mastery.get(p)?.mastered)) n++;
  }
  return n;
}

/**
 * The nearest tear that is actually open.
 *
 * `skip` takes an id and answers "not this one" — it is how a spent tear is
 * kept out of the answer. `except` is the tear being diverted FROM, so that a
 * diversion can never resolve to the place it is diverting away from.
 */
/**
 * HOW FAR A DIVERSION MAY SEND SOMEBODY, in metres.
 *
 * `src/world/rifts.js` seats tears twenty-six metres apart and thirty-two out
 * from their own prerequisite, and it guarantees a walkable approach along that
 * edge — not between two arbitrary tears. So a diversion to the far side of the
 * shard is both a hike and a route nothing has checked: measured, an
 * eighteen-minute sitting sent this way spent **974 seconds inside one 2 m
 * circle with nothing served in it at all**, wedged against ground on the way
 * to a tear a hundred metres off. Seventy metres covers a tear and its
 * neighbours — the fan the lattice actually puts side by side — and past it the
 * honest answer is that there is nowhere better to be, so the arrival goes
 * back. A diversion nobody can walk is worse than no diversion.
 */
const DIVERT_MAX = 70;

/** `nearestOpen`, refusing anything further off than a diversion may reach. */
function nearOpen(rifts, player, allowMastered, skip, except) {
  const r = nearestOpen(rifts, player, allowMastered, skip, except);
  if (!r) return null;
  return player.pos.distanceTo(r.group.position) <= DIVERT_MAX ? r : null;
}

function nearestOpen(rifts, player, allowMastered, skip = null, except = null) {
  let best = null, bd = Infinity;
  for (const r of rifts.list) {
    if (r.locked) continue;
    if (!allowMastered && r.mastered) continue;
    if (except && r === except) continue;
    if (skip && skip(r.id)) continue;
    const d = player.pos.distanceTo(r.group.position);
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}

function safeNext(mastery) {
  try { return mastery.next(); } catch { return null; }
}

function nextGrantOf(kit) {
  try { return kit?.nextGrant?.() || null; } catch { return null; }
}
