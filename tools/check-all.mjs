#!/usr/bin/env node
/**
 * `npm run check` — every gate, and the table.
 *
 *   npm run check                    # run them all, print the table, fail if any failed
 *   npm run check -- --stop          # stop at the first red one
 *   npm run check -- --only lang,items
 *   npm run check -- --list
 *
 * WHY THIS FILE EXISTS
 *
 * `check` used to be eight `npm run` calls joined with `&&`. Two things follow
 * from that, and both of them happened.
 *
 *  1. THE FIRST RED GATE HIDES EVERY GATE BEHIND IT. A run that stops at gate
 *     three says nothing about gates four to twelve, and the summary line reads
 *     the same whether one gate failed or nine did. Nobody can tell the
 *     difference between "one thing broke" and "the build is on fire", so the
 *     habit becomes "fix the first error and re-run", eleven times.
 *
 *  2. A GATE THAT IS NOT IN THE LIST IS NOT IN THE BUILD.
 *     `tools/validate-courses.mjs` is the only gate that covers the whole
 *     course — 78,594 items across five units — and it was never wired in. It
 *     failed, deterministically, on `multi-step band 3 does not ask more than
 *     band 2`, on every run, for as long as it has existed, while `npm run
 *     check` printed green. The build was reporting on ten skills and calling
 *     it the product.
 *
 * So the list lives here, in one place, with a sentence per gate saying what it
 * is for; every gate runs; and the table at the end shows the exit code of each
 * one whether or not something before it went red.
 *
 * WHAT IS DELIBERATELY NOT IN THE LIST is in `NOT_IN_BUILD` below, with a
 * reason per line — because the sentence above cuts both ways and an
 * unexplained omission is the same defect again. That list used to live in this
 * comment, where nothing could read it, and `check:standards` — the gate over
 * every framework citation in all five units — was in neither list for as long
 * as it existed. Nobody had left it out; nobody had put it in. It is now in the
 * build, and the accounting is machine-checked: see `--self-test`.
 */
import { spawn } from 'node:child_process';
import { readFileSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { ago, classify, fingerprintAll, readLedger, writeRun } from './gate-ledger.mjs';
import { judgeRun, parseLedger } from './_findings.mjs';
import { toolsNamedBy } from './gate-ledger.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * THE BUILD GATE LIST, in the order they run: cheapest and most diagnostic
 * first, so a broken tree says so in seconds; the browser sweeps last.
 *
 * `script` is the npm script name. Nothing here shells out to anything the
 * package file does not already name — the list of gates and the definition of
 * each gate stay in one place each.
 *
 * THE THIRD COLUMN IS SCOPE, and it exists because "the build is red" is not a
 * useful sentence. `content/courses.json` ships two of five units — the other
 * three are `preview`, on disk and reachable with `?unit=` and in front of
 * nobody — so a red gate is either A DEFECT A LEARNER MEETS TODAY or a defect
 * in a region nobody has been sent to, and those are not the same emergency.
 *
 *   route   its subject IS the shipped route; a red one is in front of a
 *           learner today.
 *   sweep   it covers every unit, preview included, so where the red is depends
 *           on the finding. A sweep gate that knows the difference says so on
 *           its last line, as `ROUTE: …` or `PREVIEW-ONLY: …`, and the summary
 *           below reads it. One that does not is reported as UNKNOWN rather
 *           than guessed at — an honest "read its output" beats a wrong label.
 *   engine  not unit-scoped at all: the runner, the solver, the coverage rule,
 *           the bundles. A red one is red everywhere.
 */
export const GATES = [
  ['check:coverage', 'every gate that reads items loads all 62 skills the manifest names, not the 10 in the core bank', 'engine'],
  ['check:handed', 'left is left: every left-or-right the player can feel, run out of the real source and checked against three.js\'s own projection', 'route'],
  ['check:meet', 'THE MEET (src/world/meet.js): its mathematics cut out of the shipped file and re-derived — the rail is the solution set, the beam falls both ways, no pan holds a negative, the rail is walkable, and a cadet crossing the plot cannot give an answer', 'route'],
  ['check:i18n', 'no hardcoded English in src/ or content/', 'engine'],
  ['check:prose', 'a situation and its question count the same object, in three languages', 'sweep'],
  ['check:solver', 'the checker itself: planted wrong answers are all caught, clean ones all pass', 'engine'],
  ['check:items', 'the shipped Level 1 bank, re-derived by an independent solver', 'route'],
  ['check:courses', 'EVERY unit in the manifest: generation, alignment, three locales, and the difficulty ladder (only the ladder half self-tests — see NO_SELF_TEST)', 'sweep'],
  ['check:standards', 'content/STANDARDS.md cites what the graphs cite, in every framework and every unit; the unit has ONE name in the graph and in all three bundles; and the mastery figures it publishes are readings of THIS tree', 'sweep'],
  /* THE DOCUMENT, NOT ITS SOURCES. `check:standards` regenerates
     content/STANDARDS.md and byte-compares it, and it was green while that
     document printed the literal word `undefined` in TWENTY-TWO CONSECUTIVE
     ROWS under a promise that every expectation is quoted in full. It was green
     because it compared the page with itself. This one reads the page. */
  ['check:docs', 'every generated document under content/, read as a district reads it: no value is a javascript accident, no citation column holds an empty cell, and no coverage figure appears without saying whether it is what a class receives or what is on disk', 'sweep'],
  /* AND THE CLAIM THE ITEMS DO NOT BACK. Every other content gate asks whether
     a standards claim is WELL FORMED. This one generates the items and reads
     them against the words of the expectation. */
  ['check:cases', 'a node may not claim an expectation whose named cases its forms never produce — the items are generated and read against the standard\'s own words, and a missing case must be named in the claim\'s caveat', 'sweep'],
  ['check:figures', 'a drawing says the same thing as the prose beside it', 'sweep'],
  ['check:lang', 'ASD-STE100 + ELI18, on the bundles and on real composed item stems', 'sweep'],
  /* AND THE OTHER HALF OF THE SAME QUESTION. `check:lang` proves the words a
     learner reads are plain. It cannot ask whether they are the words the
     standard is written in — and on this bank they were not: SLOPE, INTERCEPT,
     INEQUALITY and VARIABLE each appeared zero times on the shipped route. */
  ['check:vocab', 'every technical term the route\'s cited CCSS and TEKS text uses is taught in the item bank, introduced beside its plain phrase before it is used bare, and met often enough to be recognised cold — in each locale\'s own classroom words', 'sweep'],
  ['check:echo', 'every misconception-tagged wrong answer is answered with computed mathematics, not the prompt restated', 'sweep'],
  ['check:determinate', 'the answer is decided by what the learner is shown, in every unit', 'sweep'],
  ['check:scenes', 'no cadet meets the same situation twice in one sitting, in any unit', 'sweep'],
  ['check:marlow', 'the companion channel: no tutorial line reaches a sovereign', 'route'],
  /* THE CHEAP HALVES OF THE TWO PER-WAVE GATES THAT CATCH THE WORST DEFECTS.
     Both of those gates cost nine and eighteen minutes of real play, which is a
     real reason not to run them on every commit — and both of them wrote down,
     in their own NOT_IN_BUILD line, that their RULE answers in a second with no
     browser at all. That sentence was the seam. The rule is now checked on
     every commit; the walk is recorded per wave, in progress/gate-runs.json,
     and its staleness is printed by the summary below. */
  ['check:compose:rule', 'THE ESCAPE PREDICATE, on every commit: notFree() run over the exact frame the report quotes (open 0.00, short 0.73, minD 0.37) and over honest ground — the open plaza and the tightest legitimate standing place on the island. It is the bar the nine-minute walk is judged by, so it may not be moved without the build noticing', 'route'],
  ['check:motion:rule', 'THE THREE BARS a sitting is judged by, on every commit: moving share, longest park and verbs used, run over fabricated sittings — the 614-second park the report describes, a healthy sitting, and a slow learner who works one whole stint from one spot and must still pass', 'route'],
  ['check:traffic:rule', "THE CEILING ON THE WALK THROUGH NOTHING, on every commit: traffic's own bars run over fabricated sittings, and the six answer surfaces this gate presses read back out of the exact strings the shipped rig prints. It is the other half of check:motion:rule — one says the walk must not be through nothing, the other that there must be a walk — and its rule was the only one of the pair that no commit checked", 'route'],
  ['check:mastery', 'THE 80% PROMISE: the composed shipped route reaches true mastery; preview units are advisory', 'route'],
  ['check:record', "the teacher record: the standards it prints are the ones the learner's unit declares", 'sweep'],
  ['check:route', 'the road past the first region: it opens by held lines, and no returning learner loses one', 'route'],
  ['check:reachable', 'a player with no query string can get to every unit the manifest ships', 'route'],
  ['check:answerable', 'the key can be entered on the real surface, and the question cannot be handed back as the answer', 'sweep'],
  ['check:choices', 'every option set, rendered through the real panel and clicked', 'sweep'],
  ['check:shape', "the key's SHAPE carries nothing: how often it is the shortest / longest / most- or fewest-digits option, two-sided against chance, on the route and in every preview unit", 'sweep'],
  ['check:traverse', 'the corridor between two tears, walked from every approach bearing, and no routed line into a wall', 'route'],
  ['check:wayfind', 'the world turns a lost player round: the bearing word on the card matches the pixels beside it in three locales, and walking away is answered by the WORLD at 8 / 16 / 24 s and by nothing at 32', 'route'],
  ['check:wipe', 'START OVER clears what its own confirm text promises: a real record planted, wiped through the real menu with real keys, and not one byte of it left across the reload', 'route'],
  ['check:withdrawn', 'a mastery claim withdrawn while LOADING the record is said out loud, in all three locales, before the learner is asked for anything', 'route'],
  /* THE THIRD CARD OF THIS SHAPE. A closed full-screen rift dialog ate every
     click for months; the ORDERS card put BEGIN below the fold and, because
     that card holds `uiOpen` and `uiOpen` hides the touch pad, killed every
     control on the device; and then the RUN CLOSED card took 100% of the
     frame with no key handler on it at all. All three were found by a human.
     This one walks a sitting and tries, with real Escapes, to leave every
     surface that owns the frame. AND IT BENT ANOTHER GATE'S NUMBERS: the RUN
     CLOSED card held 967 of the 1082 seconds of check:motion's own 18-minute
     sitting, so 3.6% moving / 974 s parked was largely an instrument reading a
     blocked player as an idle one — over the free seconds the same sitting
     reads 34.2% moving and a 16 s park. A modal defect does not stay inside
     its own module. */
  ['check:modal', 'every surface that takes the frame hands it back: real Escapes dismiss it, a control is on the glass, and input.uiOpen is never true with nothing on screen', 'route'],
  /* THE PHONE'S REACH. The client plays on a phone, and on that phone three of
     the four touch verbs were 38 x 38 against a published 44 x 44 floor, CALL
     THE ECHO — the only route in the game to the teaching — was 111 x 22 and
     the smallest control on the card, and the coordinate chart that IS the
     question drew 17% narrower than the keypad answering it on a laptop and
     19% narrower on a handset. Every one of those was measured by an existing
     gate and asserted by none: touch.mjs printed all four button sizes on
     every run and only ever asked whether they could be HIT. */
  ['check:reach', 'the phone\'s reach: every interactive control on a coarse pointer is at least 44 x 44 CSS px, the coordinate chart is never narrower than the keypad answering it, and the digits sit where a phone puts them — six phone profiles x three locales on the real rift panel, plus the shipped world frame', 'route'],
];

/**
 * THE GATES THAT ARE DELIBERATELY OUT OF THE BUILD, and the reason for each.
 *
 * This is a list, not a comment, because the self-test reads it: every
 * `check:*` script `package.json` defines must appear either in `GATES` or
 * here, and nothing may appear here that `package.json` does not define. A gate
 * that is in neither list is not in the build and nobody is choosing that —
 * which is exactly how `check:standards` sat outside the build unnoticed, and
 * how `check:courses` sat outside it while failing on every run.
 *
 * Adding a `check:*` script and forgetting it now fails `npm run check`.
 *
 * AND A REASON THAT IS NOT A REASON. This list used to carry:
 *
 *     ['check:mastery', '… It currently fails on Levels 2 and 4.']
 *
 * A gate excluded BECAUSE IT FAILS is not a decision; it is the defect, written
 * down here in the shape of a decision. It meant the 80%-mastery promise — the
 * one number this product is sold on — could not turn the build red for a unit
 * that is on the shipped route. `check:mastery` is now in GATES, and the way it
 * handles Levels 3 to 5 is severity read off `content/courses.json`, not
 * absence: see the header of `tools/simulate-all.mjs`. Nothing may be added
 * here whose reason is that it is red. If a gate is red, it is red.
 */
export const NOT_IN_BUILD = [
  ['check:layout', 'browser sweep, 6 viewports × 3 locales × 3 insets × 8 surfaces — 432 frames, a display budget of its own. It swept only the four LANDSCAPE sizes until 2026-08-28: the pass that added a phone on its side replaced the portrait ladder instead of joining it, so nothing photographed 390x844 with an island on it while this line said 8 viewports. Both halves were measured before the default changed — 288/288 landscape, 144/144 portrait. Run per wave, not per commit; recorded in progress/gate-runs.json.'],
  ['check:sustain', 'fifteen minutes of real play per run. Run per wave, not per commit; recorded.'],
  ['check:traffic', 'eighteen minutes of real play per run — where a sitting actually goes: work, composed place, or the walk through nothing. Run per wave, not per commit; recorded. Its bars now ARE a gate of their own in the build (`check:traffic:rule`, no browser) — that gap was named out loud in this list for a wave and is closed. Its `answer()` also had the same defect check:motion had: one blind click on `.rf-move, .rf-chip, .rf-bay, .ans` is not an answer on the beam, the bays, the field or the plot, so both gates now press through tools/critic/_play.mjs.'],
  ['check:takeover', 'fifteen minutes of real play per run. Run per wave, not per commit; recorded.'],
  /* THE TWO THAT MATTER MOST, AND WHAT CHANGED ABOUT THEM.
     Both were here, both were RED ON THE SHIPPED ROUTE, and nothing anywhere
     said so — so a blind critic re-found their two defects by hand, twice: half
     the places the game routes a cadet to are frames its own escape predicate
     calls not-free, and the sitting needs no world at all. The written reasons
     were honest and are kept. What was missing is the other half of the
     sentence: the rule each of them applies costs a second and no browser, and
     the walk that applies it costs nine and eighteen minutes. The rule is now a
     gate in the build (check:compose:rule, check:motion:rule) and the walk is a
     RECORDED per-wave run whose last exit code and staleness are printed by
     `npm run check` every time it runs. See PER_WAVE below. */
  ['check:compose', 'every objective the world seats, approached from eight bearings on real keys, plus the ends of twelve sprints — about nine minutes of walking per run. Run per wave, not per commit, and RECORDED: its last result is in progress/gate-runs.json and `npm run check` says whether it is red and whether it is stale. Its predicate is in the build as check:compose:rule, and EVERY ordinary run also plants a real wedge in the real build and requires the gate to refuse it, so the sampling path is proved on every run too.'],
  ['check:motion', 'eighteen minutes of real play per run — the mirror of check:traffic: traffic says the walk must not be through nothing, this says there must be a walk. Run per wave, not per commit, and RECORDED. Its three bars are in the build as check:motion:rule.'],
  ['check:progress', 'frame captures across the progress surfaces. Folded into the per-wave sweep; recorded.'],
  ['check:transient', 'frame captures of every transient surface. Folded into the per-wave sweep; recorded.'],
  /* EXCUSED BY ANOTHER GATE — and the third column says WHICH, so the excuse is
     machine-checkable. `accountForPerWave` requires the named coverer to be a
     per-wave gate that is itself recorded: "covered by X" is only a reason if
     somebody can tell whether X has ever been run. */
  /* IT WAS 'covered by check:layout', AND ON THIS TREE IT IS NOT. Measured the
     same afternoon, on the same frozen build: `check:layout` reported 288/288
     frames clean and `check:truncate` exited 1 — one companion line taken off
     the glass mid-word, "No rush. Thou", interrupted by the next line at 900 ms
     with 97 characters never shown. `landscape.mjs` measures GEOMETRY off one
     screenshot per frame — clipping, ink outside the viewport, overlap, a silent
     scroller, the safe area — and a line cut off in TIME leaves no geometry to
     photograph. So the coverer ran, passed, and could not see it. An excuse that
     names a gate which does not cover the defect is the same artefact as an
     excuse that names no gate at all; it is recorded per wave instead. */
  ['check:truncate', 'a smaller browser probe of the companion channel: 630 surfaces over 6 rooms x 3 locales, and it reads a line as it is TYPED — about ten minutes of browser. It used to be excused as covered by check:layout, and it is not: layout photographs one frame per surface and measures geometry, so a line the next line interrupts mid-word leaves nothing on the glass to measure. Run per wave, not per commit; recorded.'],
  ['check:lock', 'a smaller browser probe, covered by check:layout in the per-wave sweep.', 'check:layout'],
  ['check:escape', 'a smaller browser probe, covered by check:layout in the per-wave sweep.', 'check:layout'],
  ['check:locklayout', 'a smaller browser probe, covered by check:layout in the per-wave sweep.', 'check:layout'],
  ['check:shopask', 'a smaller browser probe, covered by check:takeover in the per-wave sweep.', 'check:takeover'],
  ['check:templates', 'a smaller browser probe, covered by check:takeover in the per-wave sweep.', 'check:takeover'],
  ['check:scaffold', 'a smaller browser probe, covered by check:takeover in the per-wave sweep.', 'check:takeover'],
  ['check:quality', 'NOT a browser probe, and the reason written here used to say it was: tools/critic/qualityloop.mjs imports QualityDirector out of src/core/engine.js, feeds it frame times under node, and answers in about a second. It is out of the build because it is RED, and neither it nor src/core/engine.js has been written since 2026-08-18, so it was red then too. Measured on this tree, 2 of its 8 cases fail — a genuinely slow machine spends its resolution down to the floor and never gives up the effect tier (cap 0.72/0.72, tier still high), and sustained stutter costs nothing at all (cap 1.50/1.50, tier high). check:takeover does not cover it; the controller is arithmetic and takeover is fifteen minutes of play. IT IS NOW RECORDED: a gate excluded because it fails is not a decision, so its red is written into progress/gate-runs.json and printed by `npm run check` on every build instead of living in this paragraph. Fix the controller and put this line in GATES.'],
  ['check:figures:render', 'the browser half of check:figures — the label pass over every drawing the bank can print, and the chart pass that drives the real RiftPanel over 8 viewports x 3 locales and measures the lattice, the readings and the type size off the DOM. Needs a browser and about two minutes. It DOES self-test (four planted charts: the shipped lattice, the numbering slid one square, a reading drawn one square off, and the drawing cut to 110px), it is simply too slow per commit. check:figures runs its --no-render half in the build. Recorded per wave.'],
  ['check:mastery:full', 'the per-wave half of check:mastery: every unit simulated standalone AND every preview prefix, about ten Monte-Carlo minutes. The half that is IN the build is the half that can be red — the composed shipped route — and tools/simulate-all.mjs prints, on every run, exactly which runs it skipped and the flag that brings them back. Run per wave, not per commit; recorded.'],
  /* The two gates below landed with the HUD/touch pass and were in NEITHER list,
     so `npm run check` refused to start — the accounting rule doing exactly what
     it exists for. Both were RUN before being written down here, because
     "excluded for time" and "excluded because it is red" are the same line of
     text and only one of them is a decision. */
  ['check:density', 'the opening ninety seconds against the caps design/FIRST-90-SECONDS.md §7.1 measured — 12 readable strings, 3 text surfaces — in three languages on a phone held up, a phone on its side and a laptop. Nine openings played for 90 s each: about half an hour of browser per run. Run per wave, not per commit; recorded. It DOES self-test on every run (it plants a plate and requires both counts to move, then requires them to fall back when it goes).'],
  ['check:touch', 'every on-screen control tapped for real — jump, dash, glide, interact, the run card, THE PAUSE MENU AND ITS SETTINGS PANEL, and the rift card the interact button opens — in three locales x three orientations, from a cleared save, walking to a live tear on the pad\'s own stick. It also asserts the published 44 x 44 CSS px floor on every interactive control on a coarse pointer, opens the pause card with a real tap on its handle and switches the language with a real tap on a language button, and measures the coordinate chart against the keypad answering it on the real RiftPanel. About forty minutes of real touch input per run. Run per wave, not per commit; recorded. It self-tests four times on every run (a transparent lid over the jump button, the shipped 0.16 s of input deafness put back, a 38 px control planted in the pause menu, and the chart cut to 60% of the keypad).'],
];

/**
 * THE PER-WAVE LEDGER LIST — the gates the build does not run, and the record
 * that proves somebody did.
 *
 * "Run per wave, not per commit" is a real decision about a real cost. It is
 * only a DECISION if somebody can tell whether the wave happened, and until
 * this list existed nobody could. `check:compose` and `check:motion` were both
 * out of the build with an honest cost written beside them, both RED ON THE
 * SHIPPED ROUTE, and a blind critic re-found both of their defects by hand,
 * twice, while `npm run check` printed green. That is the same disease as
 * `check:mastery`'s exclusion — a red gate turned into a paragraph — one step
 * further along, because here nobody even had to write the word "fails".
 *
 * So every per-wave gate is RECORDED. `npm run wave` runs them and writes the
 * exit code, the time and a content fingerprint of the tree into
 * `progress/gate-runs.json`; `npm run check` reads that file on every build and
 * says, in its one summary line, which per-wave gates are red and which have
 * not been run since the tree changed.
 *
 *   [gate, scope, cheapHalf|null]
 *
 * `scope` obeys the same rule as GATES — route / sweep / engine — and it is
 * what decides severity: A RECORDED RED ON A ROUTE-SCOPE GATE FAILS THE BUILD.
 * A learner meets that defect today, and the record says so in writing; a build
 * that prints green while holding that record is the exact artefact this whole
 * list exists to abolish. Off-route and engine reds are printed in the summary
 * on every build and do not fail it, by the same severity rule `check:mastery`
 * and `check:scenes` apply to preview units.
 *
 * `cheapHalf` is the gate in the build that checks this one's RULE in a second
 * with no browser — the seam that lets an expensive gate still bite on every
 * commit. `null` means there is no such gate yet, and the summary names those
 * out loud rather than leaving the gap to memory.
 */
export const PER_WAVE = [
  ['check:compose', 'route', 'check:compose:rule'],
  ['check:motion', 'route', 'check:motion:rule'],
  ['check:mastery:full', 'route', 'check:mastery'],
  ['check:figures:render', 'sweep', 'check:figures'],
  ['check:layout', 'route', null],
  ['check:traffic', 'route', 'check:traffic:rule'],
  ['check:takeover', 'route', null],
  ['check:sustain', 'route', null],
  ['check:progress', 'route', null],
  ['check:transient', 'route', null],
  ['check:density', 'route', null],
  ['check:touch', 'route', null],
  ['check:truncate', 'route', null],
  ['check:quality', 'engine', null],
];

/**
 * A GATE THAT HAS NEVER REJECTED ANYTHING IS NOT A GATE.
 *
 * Most gates here run `--self-test` in front of themselves: they plant the
 * exact defect they exist to catch, prove the rule fires, and prove the same
 * rule stays quiet on the nearest honest content. That is the bar.
 *
 * These two lists cover the gates whose command line does NOT carry the flag,
 * so the exception is a written decision rather than something nobody looked
 * at. The self-test below requires every such gate to be in exactly one of
 * them, and neither list may name a gate that is not in the build.
 *
 * INLINE — proves itself on every run, with no flag to remember. Verified by
 * reading each one: the planted battery runs unconditionally and the process
 * exits non-zero if the gate fails to catch its own plants.
 */
export const SELF_TEST_INLINE = [
  ['check:solver', 'tools/check-solver.mjs IS the planted battery — clean items must pass and every planted fault must be caught, and its coverage check re-proves itself each run by removing one covered check kind and requiring the count to notice.'],
  ['check:answerable', 'tools/critic/answerable.mjs arms one defect per rule before it measures anything — nine of them, from an untypeable key and a value-only grader to a socket that keeps the line the rig just refused — and prints "Nothing below is evidence" and exits 1 if it misses any of them. It then takes its own browser away mid-slice and requires the slice back whole.'],
  ['check:choices', 'tools/critic/choiceaudit.mjs proves its position test on every run: answer-always-first must be caught, a 44/28/28 lean must be caught, and an honest 104/96/100 must be spared, or it exits 1 before sweeping anything.'],
];

/**
 * NO SELF-TEST — a gate that has never been watched refuse anything. Each line
 * says what is missing and what covers it meanwhile. This list should get
 * shorter; it may not get longer without somebody writing the reason down.
 */
export const NO_SELF_TEST = [
  ['check:items', 'tools/validate-items.mjs re-derives the Level 1 bank with an independent solver but plants no fault in itself, so nothing proves the re-derivation would notice a wrong answer. The solver underneath it IS proved, by check:solver. Owned by the pedagogy lane.'],
  ['check:courses', 'tools/validate-courses.mjs runs tools/critic/ladder.mjs --self-test in front of itself, which proves the four difficulty-ladder rules, and proves its two FORM rules inline on every run — simplestFaults and factorFaults are each pointed at the planted defect and at the nearest honest content before the bank is read (19 cases, printed). Its other rules — graph shape, standards in every declared framework, every form by name in three locales, strict KaTeX on the shown options — plant nothing and have never been watched refuse anything.'],
  ['check:scenes', 'PROVED ONLY IN PART. tools/scene-audit.mjs --self-test now plants the SEVERITY rule in both directions — a repeat in a unit on route.units must exit 1 and print ROUTE:, a repeat only in a preview unit must print every finding in full, print PREVIEW-ONLY: and exit 0, and promoting a unit must flip it with no edit to the tool — because that rule was changed this wave and a changed refusal nobody has watched is not a refusal. It still plants no repeated SITUATION, so nothing proves the detector underneath would see one.'],
  ['check:marlow', 'tools/narrative/marlow-audit.mjs sweeps the real canTutor() over the whole state space, which is a proof by exhaustion rather than by a plant; its census and gender rules plant nothing. Owned by the narrative lane.'],
];

/**
 * NO FINDINGS LEDGER — a gate whose exit code is still its own unchecked claim.
 *
 * `tools/_findings.mjs` owns the exit code of every gate that uses it: declare
 * a finding on the shipped route and the process cannot leave with a zero
 * status, and the one machine line it prints is re-judged by the runner from
 * outside the process. A gate that does not use it decides for itself what its
 * own findings are worth — which is how `check:shape` printed per-form answer
 * leaks at 62.2% on the route and returned 0.
 *
 * Each line below says WHY, and what covers it meanwhile. This list may only
 * get shorter. `accountForFindings` refuses a build where a gate is in neither
 * state.
 */
export const NO_FINDINGS_LEDGER = [
];

/**
 * THE ACCOUNTING, as a pure function so the self-test can plant a defect in it.
 *
 * Every `check:*` script the package file defines has to be accounted for: it
 * is either a gate the build runs, or an omission somebody wrote a reason for.
 * There is no third state, and "nobody noticed" is not a decision.
 *
 * @param {Record<string,string>} scripts  package.json's scripts block
 * @param {[string,string][]} gates        the build list
 * @param {[string,string][]} omitted      the deliberate omissions, with reasons
 * @returns {string[]} one sentence per problem; empty means the books balance
 */
export function accountFor(scripts, gates, omitted) {
  const problems = [];
  const inGates = new Map(gates);
  const inOmit = new Map(omitted);
  const defined = Object.keys(scripts).filter((k) => k.startsWith('check:'));

  for (const name of defined) {
    if (inGates.has(name) === inOmit.has(name)) {
      problems.push(inGates.has(name)
        ? `${name} is both a gate the build runs and a deliberate omission — pick one`
        : `${name} is a gate package.json defines and NOTHING accounts for it: it is not in the build `
          + 'and nobody wrote down that it was left out. Add it to GATES, or to NOT_IN_BUILD with a reason.');
    }
  }
  for (const [name] of gates) {
    if (!scripts[name]) problems.push(`the build list names "${name}", which package.json does not define — a typo here is a gate silently dropped`);
  }
  for (const [name, why] of omitted) {
    if (!scripts[name]) problems.push(`NOT_IN_BUILD names "${name}", which package.json no longer defines — a stale excuse for a gate that is gone`);
    if (!why || !String(why).trim()) problems.push(`NOT_IN_BUILD names "${name}" with no reason; an unexplained omission is the defect this list exists to prevent`);
  }
  return problems;
}

/**
 * THE SECOND ACCOUNTING: every gate in the build has been watched refuse
 * something, or somebody has written down that it has not.
 *
 * @param {Record<string,string>} scripts
 * @param {[string,string][]} gates
 * @param {[string,string][]} inline    proves itself every run, no flag
 * @param {[string,string][]} none      no planted fault at all, with a reason
 * @returns {string[]}
 */
export function accountForSelfTests(scripts, gates, inline, none) {
  const problems = [];
  const inInline = new Map(inline);
  const inNone = new Map(none);
  for (const [name] of gates) {
    const cmd = scripts[name] || '';
    const flagged = cmd.includes('--self-test');
    const declared = (inInline.has(name) ? 1 : 0) + (inNone.has(name) ? 1 : 0);
    if (flagged && inInline.has(name)) problems.push(`${name} runs --self-test and is also listed as proving itself inline — one or the other`);
    if (declared > 1) problems.push(`${name} is listed as both inline-proved and unproved`);
    if (!flagged && declared === 0) {
      problems.push(`${name} is in the build, its command runs no --self-test, and NOTHING says whether it proves itself. `
        + 'A gate nobody has watched refuse anything is not a gate. Add --self-test, or name it in SELF_TEST_INLINE or NO_SELF_TEST with a reason.');
    }
  }
  const named = new Set(gates.map(([n]) => n));
  for (const [label, list] of [['SELF_TEST_INLINE', inline], ['NO_SELF_TEST', none]]) {
    for (const [name, why] of list) {
      if (!named.has(name)) problems.push(`${label} names "${name}", which is not a gate in the build — a stale note`);
      if (!why || !String(why).trim()) problems.push(`${label} names "${name}" with no reason`);
    }
  }
  return problems;
}

/**
 * THE THIRD ACCOUNTING: a gate left out of the build is either RECORDED, or it
 * is excused by a gate that is.
 *
 * The first two accountings closed "nobody chose to leave this out" and "nobody
 * has watched this refuse anything". They both stop at the edge of the build,
 * and the hole behind that edge is where `check:compose` and `check:motion`
 * sat: honestly excluded, honestly expensive, RED ON THE SHIPPED ROUTE, and
 * never run. This rule makes both halves of that sentence checkable.
 *
 *  · Every gate in NOT_IN_BUILD must be in PER_WAVE (so its last result is
 *    written down) or must NAME the per-wave gate that covers it. "Covered by
 *    check:layout" is only a reason if somebody can tell whether check:layout
 *    has ever been run.
 *  · A coverer must itself be a recorded per-wave gate, so an excuse cannot
 *    point at another excuse.
 *  · PER_WAVE may not name a gate that is in the build, or one package.json
 *    does not define, and every entry needs a scope the summary can sort by.
 *  · A `cheapHalf` must be a gate that IS in the build — the whole point of it
 *    is that the expensive gate's RULE still bites on every commit.
 *
 * @param {Record<string,string>} scripts
 * @param {[string,string][]} gates
 * @param {[string,string,string?][]} omitted
 * @param {[string,string,string?][]} perWave
 * @returns {string[]}
 */
export function accountForPerWave(scripts, gates, omitted, perWave) {
  const problems = [];
  const inGates = new Set(gates.map(([n]) => n));
  const recorded = new Map(perWave.map(([n, scope, cheap]) => [n, { scope, cheap }]));
  const SCOPES = new Set(['route', 'sweep', 'engine']);

  for (const [name, scope, cheap] of perWave) {
    if (!scripts[name]) problems.push(`PER_WAVE names "${name}", which package.json does not define`);
    if (inGates.has(name)) problems.push(`PER_WAVE names "${name}", which is IN the build — a gate cannot be both run every commit and recorded per wave`);
    if (!SCOPES.has(scope)) problems.push(`PER_WAVE names "${name}" with scope "${scope}"; it must be route, sweep or engine, because scope is what decides whether its red fails the build`);
    if (cheap && !inGates.has(cheap)) {
      problems.push(`PER_WAVE says "${name}" has its rule checked by "${cheap}", which is not a gate in the build. `
        + 'A cheap half nobody runs is the same as no cheap half.');
    }
  }
  for (const [name, , coveredBy] of omitted) {
    if (recorded.has(name)) continue;
    if (!coveredBy) {
      problems.push(`${name} is out of the build and NOTHING records it: it is not in PER_WAVE and it names no gate that covers it. `
        + 'That is the state check:compose and check:motion were in while both were red on the shipped route.');
      continue;
    }
    if (!recorded.has(coveredBy)) {
      problems.push(`${name} is excused as covered by "${coveredBy}", which is not a recorded per-wave gate — an excuse pointing at another excuse`);
    }
  }
  return problems;
}

/**
 * THE FOURTH ACCOUNTING: every gate in the build routes its verdict through the
 * findings collector, or somebody has written down why it does not.
 *
 * The first three accountings closed "nobody chose to leave this gate out",
 * "nobody has watched this gate refuse anything" and "nobody has run this gate
 * since the tree moved". This one closes the hole they all sit inside: A GATE
 * THAT REPORTS A ROUTE DEFECT AND RETURNS SUCCESS.
 *
 * It has happened three times, by three different mechanisms — an exclusion
 * whose reason was "it fails", a predicate that matched the wrong arm of its
 * own output, and `tools/critic/choiceshape.mjs` printing per-form answer leaks
 * at 62.2% ON THE SHIPPED ROUTE and then writing `the bar this gate enforces is
 * the surface` and returning 0. Patching the third one would have been the
 * fourth patch. `tools/_findings.mjs` makes it structural: a gate declares
 * findings and the collector owns the exit code, and it prints one machine line
 * the runner re-judges from outside the process.
 *
 * A gate that does not use it is not forbidden — it is NAMED, here and on every
 * build, as a gate whose exit code is its own unchecked claim. This list may
 * only get shorter.
 *
 * @param {Record<string,string>} scripts
 * @param {[string,string,string?][]} gates
 * @param {[string,string][]} exempt              NO_FINDINGS_LEDGER
 * @param {(gate:string)=>boolean} usesCollector  does this gate's code import it
 * @returns {string[]}
 */
export function accountForFindings(scripts, gates, exempt, usesCollector) {
  const problems = [];
  const named = new Set(gates.map(([n]) => n));
  const excused = new Map(exempt);
  for (const [name] of gates) {
    const uses = !!usesCollector(name);
    if (uses && excused.has(name)) {
      problems.push(`${name} routes its verdict through tools/_findings.mjs AND is listed as not doing so — delete the excuse`);
    }
    if (!uses && !excused.has(name)) {
      problems.push(`${name} is in the build and its verdict does not go through tools/_findings.mjs, and NOTHING says why. `
        + 'A gate that owns its own exit code can print a route finding and return success — which is exactly what '
        + 'check:shape did. Convert it, or name it in NO_FINDINGS_LEDGER with a reason.');
    }
  }
  for (const [name, why] of exempt) {
    if (!named.has(name)) problems.push(`NO_FINDINGS_LEDGER names "${name}", which is not a gate in the build — a stale note`);
    if (!why || !String(why).trim()) problems.push(`NO_FINDINGS_LEDGER names "${name}" with no reason`);
    if (!scripts[name]) problems.push(`NO_FINDINGS_LEDGER names "${name}", which package.json does not define`);
  }
  return problems;
}

/**
 * Does this gate's own code hand its verdict to `tools/_findings.mjs`?
 *
 * Answered off the files the npm command REALLY EXECUTES: the tools it names,
 * and — through a shell wrapper, which runs a tool rather than deciding
 * anything itself — the tools that wrapper's live lines name.
 *
 * TWO THINGS IT DELIBERATELY DOES NOT DO, and both of them were wrong here for
 * one revision each:
 *
 *  · IT DOES NOT READ COMMENTS. Scraping tool paths out of a JavaScript file's
 *    whole text follows the prose: `tools/critic/thumb.mjs`'s header says "run
 *    this through tools/critic/rungate.sh", whose own comment mentions
 *    snapshot.sh, which runs shoot.mjs — and out through that into gates that
 *    do carry a ledger.
 *  · IT DOES NOT FOLLOW ORDINARY IMPORTS. `tools/critic/thumb.mjs` imports
 *    `serveFrozen` from `tools/check-figures.mjs`, which is a converted gate —
 *    so a transitive walk called thumb.mjs converted while its verdict is still
 *    `process.exit(0)` at the bottom of the file. Borrowing a library is not
 *    borrowing a verdict.
 *
 * Both are the same defect `tools/check-coverage.mjs` exists to prevent: one
 * gate borrowing another gate's answer.
 *
 * @param {string} gate
 * @param {Record<string,string>} scripts
 * @returns {boolean}
 */
export function usesCollector(gate, scripts, root = ROOT) {
  const seen = new Set();
  const queue = toolsNamedBy(scripts[gate] || '');
  while (queue.length) {
    const rel = queue.shift();
    if (seen.has(rel)) continue;
    seen.add(rel);
    let text = '';
    try { text = readFileSync(path.join(root, rel), 'utf8'); } catch { continue; }
    if (rel.endsWith('.sh')) {
      const live = text.split('\n').filter((l) => !/^\s*#/.test(l)).join('\n');
      for (const named of toolsNamedBy(live)) if (named !== rel) queue.push(named);
      continue;
    }
    if (/_findings\.mjs/.test(text)) return true;
  }
  return false;
}

/**
 * What the ledger says about every per-wave gate, right now.
 *
 * @returns {Promise<{gate:string, scope:string, cheap:string|null, state:string, code:number|null, at:string|null, secs:number|null}[]>}
 */
export async function perWaveStatus(scripts, perWave = PER_WAVE) {
  const names = perWave.map(([n]) => n);
  const [runs, prints] = await Promise.all([readLedger(), fingerprintAll(names, scripts)]);
  return perWave.map(([gate, scope, cheap]) => {
    const row = runs[gate] || null;
    return {
      gate, scope, cheap,
      state: classify(row, prints[gate]?.key),
      code: row && typeof row.code === 'number' ? row.code : null,
      at: row?.at || null,
      secs: row && typeof row.secs === 'number' ? row.secs : null,
      key: prints[gate]?.key || null,
    };
  });
}

/**
 * THE ONE LINE, as a pure function so it can be planted against.
 *
 * "3 of 21 gates red" is a fact nobody can act on, and "all 21 gates green" is
 * worse than useless while two per-wave gates are sitting on a recorded red
 * nobody has looked at since three waves ago. One line, four facts: what is
 * red, which of it a learner meets today, WHICH ROUTE-SCOPE GATES ARE NOT
 * EVIDENCE ABOUT THIS TREE, and what is advisory.
 *
 * STALENESS IS AS LOUD AS FAILURE, and it counts in the same total. "We did not
 * look" is not "it is fine": `progress/gate-runs.json` held six route-scope
 * gates that had NEVER been run on this tree — every gate covering touch,
 * layout and the opening ninety seconds, which is the phone-and-Chromebook
 * surface this product is sold for — while this line printed the number of red
 * gates and nothing else, and the build exited 0.
 *
 * @param {{script:string, code:number, where:string}[]} rows the gates just run
 * @param {{gate:string, scope:string, state:string}[]} wave  the ledger
 * @param {string[]} roadIds  content/courses.json route.units
 * @returns {string}
 */
export function summaryLine(rows, wave, roadIds) {
  const red = rows.filter((r) => r.code !== 0);
  const waveRed = wave.filter((w) => w.state === 'red');
  const cold = wave.filter((w) => w.state === 'stale' || w.state === 'never');
  const coldRoute = cold.filter((w) => w.scope === 'route');
  const onRoute = [
    ...red.filter((r) => r.where === 'route').map((r) => r.script),
    ...waveRed.filter((w) => w.scope === 'route').map((w) => `${w.gate}*`),
    ...coldRoute.map((w) => `${w.gate}:${w.state}`),
  ];
  const allRed = [...red.map((r) => r.script), ...waveRed.map((w) => `${w.gate}*`)];
  /* Red is never abbreviated — it is the actionable half, and a gate hidden
     behind "+3 more" is a gate nobody fixes. Nor is the route-scope cold list,
     for the same reason: it is the half that used to be printed and ignored. */
  const name = (xs) => (xs.length ? ` (${xs.join(', ')})` : '');
  const some = (xs, k) => (xs.length > k ? ` (${xs.slice(0, k).join(', ')}, +${xs.length - k} more — see the table above)` : name(xs));
  const offRouteCold = cold.filter((w) => w.scope !== 'route');
  return `CHECK · red ${allRed.length}${name(allRed)}`
    + ` · NOT EVIDENCE ABOUT THIS TREE, route-scope ${coldRoute.length}${name(coldRoute.map((w) => `${w.gate}:${w.state}`))}`
    + ` · on the shipped route [${roadIds.join(' + ') || 'unknown'}], red or unproved: ${onRoute.length}${name(onRoute)}`
    + ` · off-route per-wave gates not run since the tree changed ${offRouteCold.length}${some(offRouteCold.map((w) => `${w.gate}:${w.state}`), 5)}`
    + (waveRed.length ? '  [* = last RECORDED per-wave run; `npm run wave` re-runs them]' : '');
}

/* RUN AS A TOOL, OR IMPORTED FOR ITS LISTS.
   This file exports GATES, NOT_IN_BUILD and the two accounting rules, and other
   tools read them — `tools/gate-audit.mjs` asks it what is in the build. Until
   this guard existed, importing it RAN THE WHOLE BUILD as a side effect: a
   twenty-minute sweep started by an `import` statement, with the importer's
   own output buried inside it. `realpathSync` rather than a string compare,
   for the same reason tools/check-coverage.mjs uses it: this repo is reached
   through a symlink on more than one machine. */
const IS_MAIN = !!process.argv[1]
  && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);

const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);
const opt = (name, d = null) => {
  const hit = argv.find((a) => a.startsWith(`--${name}=`));
  if (hit) return hit.slice(name.length + 3);
  const i = argv.indexOf(`--${name}`);
  return i >= 0 && argv[i + 1] && !argv[i + 1].startsWith('--') ? argv[i + 1] : d;
};

if (IS_MAIN && has('--list')) {
  for (const [name, why, scope] of GATES) console.log(`${name.padEnd(22)} ${String(scope || '?').padEnd(7)} ${why}`);
  console.log(`\nnot in the build (${NOT_IN_BUILD.length}) — every one with a reason, and the self-test proves the lists cover every check: script:`);
  for (const [name, why] of NOT_IN_BUILD) console.log(`${name.padEnd(22)} ${why}`);
  const { readFileSync } = await import('node:fs');
  const scripts = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts;
  const wave = await perWaveStatus(scripts);
  console.log(`\nper-wave, recorded in progress/gate-runs.json (${wave.length}) — \`npm run wave\` runs them all:`);
  for (const w of wave) {
    console.log(`${w.gate.padEnd(22)} ${w.scope.padEnd(7)} ${w.state.padEnd(6)} `
      + `${w.code == null ? 'never run' : `exit=${w.code}`.padEnd(9)} ${(w.at ? ago(w.at) : '—').padEnd(12)} `
      + `rule in the build: ${w.cheap || 'NONE — its rule is not checked on any commit'}`);
  }
  process.exit(0);
}

const only = opt('only');
const wanted = only
  ? GATES.filter(([n]) => only.split(',').some((s) => n === s.trim() || n === `check:${s.trim()}`))
  : GATES;

const spawnOne = (cmd, args, quiet = false) => new Promise((resolve) => {
  const t0 = Date.now();
  const child = spawn(cmd, args, { cwd: ROOT, stdio: quiet ? 'ignore' : 'inherit', env: process.env });
  child.on('exit', (code, signal) => resolve({ code: signal ? 1 : (code ?? 1), secs: (Date.now() - t0) / 1000 }));
  child.on('error', () => resolve({ code: 127, secs: (Date.now() - t0) / 1000 }));
});

/**
 * Run one gate, passing its output straight through AND keeping the tail.
 *
 * The tail is kept for one reason: a sweep gate covers preview units as well as
 * the shipped route, so only the gate itself can say whether what it found is
 * in front of a learner. The ones that know print a last line beginning
 * `ROUTE:` or `PREVIEW-ONLY:`; this reads it so the summary can sort the red
 * gates by whether anybody is standing in the defect. Nothing is inferred: a
 * gate that does not say is reported as unknown.
 */
const TAIL_BYTES = 8192;
const run = (script) => new Promise((resolve) => {
  const t0 = Date.now();
  let tail = '';
  const child = spawn('npm', ['run', '--silent', script], { cwd: ROOT, stdio: ['inherit', 'pipe', 'pipe'], env: process.env });
  const grab = (stream, sink) => {
    stream.on('data', (b) => { sink.write(b); tail = (tail + b).slice(-TAIL_BYTES); });
  };
  grab(child.stdout, process.stdout);
  grab(child.stderr, process.stderr);
  child.on('exit', (code, signal) => resolve({ code: signal ? 1 : (code ?? 1), secs: (Date.now() - t0) / 1000, tail }));
  child.on('error', () => resolve({ code: 127, secs: (Date.now() - t0) / 1000, tail }));
});

/**
 * Where a red gate's defect actually is: on the shipped route, or only in a
 * preview unit nobody is sent to.
 *
 * @param {'route'|'sweep'|'engine'} scope the declared scope in GATES
 * @param {string} tail                   the last few KB the gate printed
 * @returns {{where:'route'|'preview'|'engine'|'unknown', said:string|null}}
 */
export function whereIsIt(scope, tail = '') {
  const said = /^\s*(ROUTE|PREVIEW-ONLY):\s*(.+)$/m.exec(tail || '');
  if (said) return { where: said[1] === 'ROUTE' ? 'route' : 'preview', said: said[2].trim() };
  if (scope === 'route') return { where: 'route', said: null };
  if (scope === 'engine') return { where: 'engine', said: null };
  return { where: 'unknown', said: null };
}

/**
 * `npm run wave` — RUN THE EXPENSIVE HALF AND WRITE DOWN WHAT HAPPENED.
 *
 * This is the other end of PER_WAVE. It runs each recorded gate exactly as
 * package.json defines it, and stores the exit code, the duration, the time and
 * a content fingerprint of the tree it was measured on. Nothing here decides
 * whether a result is acceptable — it records what happened, and `npm run
 * check` reads it. A recorder that could soften a result is not a record.
 */
if (IS_MAIN && has('--wave')) {
  const { readFileSync } = await import('node:fs');
  const scripts = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts;
  const pick = opt('only');
  const list = PER_WAVE.filter(([n]) => !pick || pick.split(',').some((x) => n === x.trim() || n === `check:${x.trim()}`));
  if (!list.length) { console.error(`--only "${pick}" names no per-wave gate; npm run check -- --list to see them`); process.exit(2); }
  console.log(`\x1b[1mper-wave run\x1b[0m — ${list.length} gate(s), recorded into progress/gate-runs.json\n`);
  const done = [];
  for (const [gate, scope, cheap] of list) {
    console.log(`\n\x1b[1m── ${gate} ──\x1b[0m ${scope}${cheap ? `   (its rule runs on every commit as ${cheap})` : ''}`);
    /* FINGERPRINTED ON BOTH SIDES OF THE RUN. Several builders hot-edit this
       tree at once — that is the documented working mode — and an eighteen
       minute gate can easily outlive the tree it built from. The recorded
       fingerprint is the one taken BEFORE the run, because that is what
       `rungate.sh` built; if the tree moved underneath, the row says so, and
       `classify()` will already read it as stale against the tree now. */
    const before = (await fingerprintAll([gate], scripts))[gate];
    const { code, secs, tail } = await run(gate);
    const after = (await fingerprintAll([gate], scripts))[gate];
    if (before.key !== after.key) {
      console.log(`\x1b[33m  ..    the tree changed while this gate was running — recorded against the tree it built from, and marked\x1b[0m`);
    }
    await writeRun(gate, {
      code, secs, scope,
      at: new Date().toISOString(),
      cmd: scripts[gate],
      fingerprint: before,
      movedDuringRun: before.key !== after.key,
      said: whereIsIt(scope, code === 0 ? '' : tail).said,
    });
    done.push({ gate, scope, code, secs, moved: before.key !== after.key });
  }
  console.log('\n\x1b[1mrecorded\x1b[0m');
  for (const d of done) {
    console.log(`${d.code === 0 ? '\x1b[32m  ok  \x1b[0m' : '\x1b[31m FAIL \x1b[0m'} ${d.gate.padEnd(22)} ${d.scope.padEnd(7)} exit=${String(d.code).padEnd(3)} ${d.secs.toFixed(1).padStart(8)}s${d.moved ? '   (the tree moved under it)' : ''}`);
  }
  const red = done.filter((d) => d.code !== 0);
  console.log(`\n${red.length ? `\x1b[31m${red.length} recorded RED: ${red.map((d) => d.gate).join(', ')}\x1b[0m` : `\x1b[32mall ${done.length} recorded green\x1b[0m`}`);
  console.log('`npm run check` now reads this on every build, and says so in its summary line.\n');
  process.exit(red.length ? 1 : 0);
}

/**
 * Prove the runner reports a failure.
 *
 * A runner is not a gate, but it is the thing every gate's verdict travels
 * through, and the defect it exists to prevent is precisely "the summary said
 * green while something was red". So it is asked to run one command that
 * succeeds and one that exits 3, and it has to see both.
 *
 * Then TWO ACCOUNTINGS, which are the other half of the same defect.
 *
 *  · A gate that is not in the list is not in the build. `accountFor` is asked
 *    the real question against the real package file, and then asked it again
 *    against PLANTED package files — a gate nobody listed, a gate listed twice,
 *    a typo in the build list, a stale excuse for a script that no longer
 *    exists, an omission with a blank reason — because a rule that has never
 *    been watched refuse anything is not a rule.
 *
 *  · A gate nobody has watched refuse anything is not a gate. `accountForSelfTests`
 *    requires every gate in the build to run `--self-test`, or to be named in
 *    `SELF_TEST_INLINE` or `NO_SELF_TEST` with a reason, and it is planted
 *    against too. That sentence was being kept in people's heads; it is in the
 *    build now.
 *
 *  · AND THE THIRD, ADDED THIS WAVE: a gate left out of the build is either
 *    RECORDED per wave or excused by a gate that is. `accountForPerWave` is
 *    planted against with the exact shape `check:compose` and `check:motion`
 *    were in — out of the build, honestly expensive, red on the shipped route,
 *    and never run — and with an excuse that points at another excuse.
 *
 *  · AND THE SUMMARY LINE ITSELF, because the line is the whole deliverable:
 *    `summaryLine` is run over planted rows and a planted ledger and has to say
 *    the right thing about each. A build whose failure is not legible does not
 *    get fixed, and a summary that has never been watched be wrong is a summary
 *    nobody has checked.
 */
if (IS_MAIN && has('--self-test')) {
  let bad = 0;
  const ok = await spawnOne(process.execPath, ['-e', 'process.exit(0)'], true);
  const red = await spawnOne(process.execPath, ['-e', 'process.exit(3)'], true);
  if (ok.code !== 0) { console.error(`SELF-TEST FAIL: a passing command reported ${ok.code}`); bad++; }
  else console.log('  ok     a passing command reports 0');
  if (red.code !== 3) { console.error(`SELF-TEST FAIL: a command that exits 3 reported ${red.code}`); bad++; }
  else console.log('  ok     a command that exits 3 reports 3, so a red gate cannot be read as green');

  /* The port helper every browser gate binds through. It is not a gate, so it
     is not in the list — but five gates die without it, and a helper nobody
     runs is a helper that rots. It proves itself here, once, on every
     `npm run check`: see tools/_freeport.mjs. */
  const ports = await spawnOne(process.execPath, [path.join(ROOT, 'tools/_freeport.mjs'), '--self-test'], true);
  if (ports.code !== 0) { console.error(`SELF-TEST FAIL: tools/_freeport.mjs --self-test exited ${ports.code}; the five gates that stand up a server can go red for a port clash`); bad++; }
  else console.log('  ok     tools/_freeport.mjs proves a gate cannot go red because another gate was on its port');

  /* The ledger the per-wave half is recorded in, for the same reason: it is not
     a gate, so it is not in the list — but the staleness rule and the content
     fingerprint decide whether an eighteen-minute run is still evidence, and a
     helper nobody runs is a helper that rots. It plants its own trees. */
  const ledger = await spawnOne(process.execPath, [path.join(ROOT, 'tools/gate-ledger.mjs'), '--self-test'], true);
  if (ledger.code !== 0) { console.error(`SELF-TEST FAIL: tools/gate-ledger.mjs --self-test exited ${ledger.code}; the per-wave staleness rule is not proved, so "stale" and "red" in the summary below mean nothing`); bad++; }
  else console.log('  ok     tools/gate-ledger.mjs proves the fingerprint moves only when the tree does, and that a recorded red never ages out');

  const { readFileSync } = await import('node:fs');
  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));

  // --- the rule, on planted defects ---------------------------------------
  const CLEAN = { 'check:a': 'x', 'check:b': 'y', build: 'vite build' };
  const G = [['check:a', 'runs']];
  const O = [['check:b', 'too slow for every commit']];
  const fires = (problems, re, why) => {
    if (!problems.some((p) => re.test(p))) { console.error(`SELF-TEST FAIL: the accounting missed ${why} — ${JSON.stringify(problems)}`); bad++; }
    else console.log(`  fires  ${why}`);
  };
  // THE DEFECT THIS LIST EXISTS FOR: check:standards, defined and in neither list.
  fires(accountFor({ ...CLEAN, 'check:standards': 'z' }, G, O),
    /check:standards is a gate package\.json defines and NOTHING accounts for it/,
    'a check: script that is in neither list — the shape check:standards was in');
  fires(accountFor(CLEAN, [...G, ['check:b', 'runs']], O),
    /check:b is both a gate the build runs and a deliberate omission/,
    'a gate claimed by both lists');
  fires(accountFor(CLEAN, [...G, ['check:typo', 'runs']], O),
    /the build list names "check:typo", which package\.json does not define/,
    'a typo in the build list — a gate silently dropped');
  fires(accountFor(CLEAN, G, [...O, ['check:gone', 'was slow']]),
    /NOT_IN_BUILD names "check:gone", which package\.json no longer defines/,
    'a stale excuse for a gate that no longer exists');
  fires(accountFor(CLEAN, G, [['check:b', '   ']]),
    /with no reason/,
    'an omission with an empty reason');
  const quiet = accountFor(CLEAN, G, O);
  if (quiet.length) { console.error(`SELF-TEST FAIL: balanced books were refused — ${JSON.stringify(quiet)}`); bad++; }
  else console.log('  quiet  a package file whose every check: script is in exactly one list');

  // --- the self-test accounting, on planted defects too --------------------
  const SG = [['check:a', 'runs'], ['check:c', 'runs']];
  const SS = { 'check:a': 'node a.mjs --self-test && node a.mjs', 'check:c': 'node c.mjs' };
  fires(accountForSelfTests(SS, SG, [], []),
    /check:c is in the build, its command runs no --self-test, and NOTHING says whether it proves itself/,
    'a gate in the build that nobody has ever watched refuse anything');
  fires(accountForSelfTests(SS, SG, [], [['check:gone', 'no plants']]),
    /NO_SELF_TEST names "check:gone", which is not a gate in the build/,
    'a stale note about a gate that is not in the build');
  fires(accountForSelfTests(SS, SG, [['check:a', 'proves itself']], [['check:c', 'nothing yet']]),
    /check:a runs --self-test and is also listed as proving itself inline/,
    'a gate double-counted as both flagged and inline');
  const quietST = accountForSelfTests(SS, SG, [], [['check:c', 'no planted fault yet; the layer under it is proved by check:solver']]);
  if (quietST.length) { console.error(`SELF-TEST FAIL: a fully declared build was refused — ${JSON.stringify(quietST)}`); bad++; }
  else console.log('  quiet  a build where every gate either self-tests or says in writing that it does not');

  // --- WHERE A RED GATE'S DEFECT IS, on planted output ---------------------
  //
  // "3 of 21 gates red" is a sentence nobody can act on. The summary sorts red
  // gates by whether the defect is on the two units a learner is handed or in a
  // preview unit nobody is sent to — and a rule that has never been watched
  // refuse anything is not a rule, so it is planted against here too.
  {
    const w = (scope, tail) => whereIsIt(scope, tail).where;
    const cases = [
      ['route', '', 'route', 'a gate whose whole subject is the shipped route'],
      ['engine', '', 'engine', 'a gate about the solver / the bundles / the gates themselves'],
      ['sweep', 'lots of output\nand more\n', 'unknown', 'a sweep gate that did not say where it found it — reported as unknown, never guessed'],
      ['sweep', 'blah\nROUTE: 525 under-determined item(s) on the shipped route — ratio-proportion/rp-model\n', 'route', 'a sweep gate that says it found it on the route'],
      ['sweep', 'blah\nPREVIEW-ONLY: 12 findings, none of them on the shipped route\n', 'preview', 'a sweep gate that says its finding is preview-only'],
      ['route', 'PREVIEW-ONLY: nothing on the route\n', 'preview', "the gate's own verdict outranks the declared scope"],
    ];
    for (const [scope, tail, want, why] of cases) {
      const got = w(scope, tail);
      if (got !== want) { console.error(`SELF-TEST FAIL: ${why} was classified "${got}", not "${want}"`); bad++; }
      else console.log(`  ok     ${why} -> ${want}`);
    }
    const said = whereIsIt('sweep', 'ROUTE: 525 items, ratio-proportion/rp-model (algebra1-l2)\n').said;
    if (!said || !said.includes('ratio-proportion')) { console.error('SELF-TEST FAIL: the summary drops the sentence the gate wrote'); bad++; }
    else console.log('  ok     the gate\'s own one-line reason survives into the summary');
  }

  // --- THE THIRD ACCOUNTING, on planted defects ----------------------------
  //
  // The shape check:compose and check:motion were in: out of the build, an
  // honest cost written beside them, red on the shipped route, and never run.
  {
    const S3 = { 'check:a': 'node a.mjs --self-test', 'check:slow': 'node slow.mjs', 'check:tiny': 'node tiny.mjs', 'check:a:rule': 'node a.mjs --self-test' };
    const G3 = [['check:a', 'runs'], ['check:a:rule', 'runs']];
    fires(accountForPerWave(S3, G3, [['check:slow', 'nine minutes of real play per run']], []),
      /check:slow is out of the build and NOTHING records it/,
      'a gate out of the build that nothing records — the shape check:compose and check:motion were in');
    fires(accountForPerWave(S3, G3, [['check:slow', 'nine minutes'], ['check:tiny', 'covered by check:slow', 'check:slow']], []),
      /check:slow is out of the build and NOTHING records it/,
      'an excuse pointing at another excuse: check:tiny is covered by check:slow, and check:slow is recorded by nothing');
    fires(accountForPerWave(S3, G3, [['check:slow', 'nine minutes']], [['check:slow', 'route', 'check:missing']]),
      /has its rule checked by "check:missing", which is not a gate in the build/,
      'a cheap half that is not in the build — a rule nobody runs is the same as no rule');
    fires(accountForPerWave(S3, G3, [['check:slow', 'nine minutes']], [['check:slow', 'often', null]]),
      /with scope "often"; it must be route, sweep or engine/,
      'a per-wave gate with no scope the summary can sort by');
    fires(accountForPerWave(S3, G3, [], [['check:a', 'route', null]]),
      /PER_WAVE names "check:a", which is IN the build/,
      'a gate claimed as both run-every-commit and recorded-per-wave');
    const clean3 = accountForPerWave(S3, G3,
      [['check:slow', 'nine minutes of real play'], ['check:tiny', 'covered by check:slow', 'check:slow']],
      [['check:slow', 'route', 'check:a:rule']]);
    if (clean3.length) { console.error(`SELF-TEST FAIL: a fully accounted per-wave build was refused — ${JSON.stringify(clean3)}`); bad++; }
    else console.log('  quiet  a build where every excluded gate is recorded per wave, or covered by one that is');
  }

  // --- THE SUMMARY LINE, on planted rows and a planted ledger --------------
  //
  // The line is the deliverable. "all 21 gates green" while two per-wave gates
  // sit on a recorded red nobody has looked at since three waves ago is the
  // sentence this whole wave exists to stop being printable.
  {
    const R = (script, code, where) => ({ script, code, where });
    const W = (gate, scope, state) => ({ gate, scope, state });
    const road = ['algebra1-l1', 'algebra1-l2'];
    const cases = [
      [[R('check:lang', 0, 'sweep')], [], /red 0 · NOT EVIDENCE ABOUT THIS TREE, route-scope 0 · on the shipped route \[algebra1-l1 \+ algebra1-l2\], red or unproved: 0 · off-route per-wave gates not run since the tree changed 0/,
        'a clean build with an empty ledger states all four facts'],
      [[R('check:scenes', 1, 'preview')], [], /red 1 \(check:scenes\).*shipped route \[[^\]]+\], red or unproved: 0 /,
        'a red sweep gate whose own last line says PREVIEW-ONLY is red but NOT on the route'],
      [[R('check:mastery', 1, 'route')], [], /shipped route \[[^\]]+\], red or unproved: 1 \(check:mastery\)/,
        'a red route gate is named in the route clause'],
      [[], [W('check:motion', 'route', 'red')], /red 1 \(check:motion\*\).*shipped route \[[^\]]+\], red or unproved: 1 \(check:motion\*\)/,
        'A RECORDED RED PER-WAVE ROUTE GATE COUNTS AS RED, with a star — the sentence that could not be printed before'],
      [[], [W('check:quality', 'engine', 'red')], /red 1 \(check:quality\*\).*shipped route \[[^\]]+\], red or unproved: 0 /,
        'a recorded red that is not unit-scoped is still counted red, and is not claimed to be on the route'],
      [[], [W('check:layout', 'route', 'stale'), W('check:touch', 'route', 'never')], /NOT EVIDENCE ABOUT THIS TREE, route-scope 2 \(check:layout:stale, check:touch:never\)/,
        'STALE AND NEVER-RUN ROUTE GATES GET A CLAUSE OF THEIR OWN, with which of the two they are'],
      [[], [W('check:layout', 'route', 'stale'), W('check:touch', 'route', 'never')], /red or unproved: 2 \(check:layout:stale, check:touch:never\)/,
        '…and they are named in the route clause beside the red ones, because "we did not look" is not "it is fine"'],
      [[], [W('check:figures:render', 'sweep', 'never')], /NOT EVIDENCE ABOUT THIS TREE, route-scope 0 .*off-route per-wave gates not run since the tree changed 1 \(check:figures:render:never\)/,
        'an off-route per-wave gate that has never run is named, and is not counted against the route'],
      [[], [W('check:compose', 'route', 'fresh')], /NOT EVIDENCE ABOUT THIS TREE, route-scope 0 /,
        'a per-wave gate run on this exact tree is not reported as cold'],
    ];
    for (const [rows, wave, re, why] of cases) {
      const line = summaryLine(rows, wave, road);
      if (!re.test(line)) { console.error(`SELF-TEST FAIL: ${why}\n         line: ${line}`); bad++; }
      else console.log(`  ok     ${why}`);
    }
    const one = summaryLine([R('check:a', 1, 'route')], [W('check:motion', 'route', 'red')], road);
    if (one.split('\n').length !== 1) { console.error('SELF-TEST FAIL: the summary is not one line'); bad++; }
    else console.log('  ok     it is one line — red, on-route, and cold per-wave gates, in that order');
  }

  // --- THE FOURTH ACCOUNTING, on planted defects ---------------------------
  //
  // The shape check:shape was in: a gate holding a route finding, printing it
  // in full, and returning 0 because it had decided for itself what its own
  // finding was worth.
  {
    const S4 = { 'check:a': 'node a.mjs', 'check:b': 'node b.mjs' };
    const G4 = [['check:a', 'runs'], ['check:b', 'runs']];
    const usesA = (g) => g === 'check:a';
    fires(accountForFindings(S4, G4, [], usesA),
      /check:b is in the build and its verdict does not go through tools\/_findings\.mjs, and NOTHING says why/,
      'a gate in the build that owns its own exit code and nobody wrote down why');
    fires(accountForFindings(S4, G4, [['check:a', 'it does not, honest']], usesA),
      /check:a routes its verdict through tools\/_findings\.mjs AND is listed as not doing so/,
      'a stale excuse for a gate that has since been converted');
    fires(accountForFindings(S4, G4, [['check:gone', 'no ledger']], () => true),
      /NO_FINDINGS_LEDGER names "check:gone", which is not a gate in the build/,
      'a note about a gate that is not in the build');
    fires(accountForFindings(S4, G4, [['check:b', '  ']], usesA),
      /NO_FINDINGS_LEDGER names "check:b" with no reason/,
      'an exemption with an empty reason');
    const clean4 = accountForFindings(S4, G4, [['check:b', 'a browser probe; converting it is the next pass and check:a covers its rule']], usesA);
    if (clean4.length) { console.error(`SELF-TEST FAIL: a fully declared findings build was refused — ${JSON.stringify(clean4)}`); bad++; }
    else console.log('  quiet  a build where every gate either owns a findings ledger or says in writing that it does not');

    /* AND `usesCollector` ITSELF, ON A PLANTED TREE. This rule was wrong twice
       in one afternoon and both times it said YES about a gate that owns its
       own exit code — once by following the tool paths in a file's COMMENTS,
       once by following an ordinary library IMPORT into a gate that had been
       converted. A rule that answers "converted" about an unconverted gate is
       the accounting agreeing with the defect. */
    {
      const { mkdtempSync, writeFileSync, mkdirSync } = await import('node:fs');
      const os = await import('node:os');
      const dir = mkdtempSync(path.join(os.tmpdir(), 'uses-'));
      mkdirSync(path.join(dir, 'tools/critic'), { recursive: true });
      const put = (rel, body) => writeFileSync(path.join(dir, rel), body);
      put('tools/_findings.mjs', 'export const findings = () => {};\n');
      put('tools/critic/converted.mjs', "import { findings } from '../_findings.mjs';\nfindings('x').done();\n");
      put('tools/critic/library.mjs', "import { findings } from '../_findings.mjs';\nexport const serveFrozen = () => {};\n");
      put('tools/critic/own.mjs', "/* run this through tools/critic/converted.mjs */\nimport { serveFrozen } from './library.mjs';\nprocess.exit(0);\n");
      put('tools/critic/rungate.sh', '# see tools/critic/converted.mjs for why\nnode "$1"\n');
      put('tools/critic/wrap.sh', '# a comment naming tools/critic/own.mjs\nnode tools/critic/converted.mjs --out x\n');
      const S = {
        'check:converted': 'node tools/critic/converted.mjs',
        'check:own': 'node tools/critic/own.mjs --self-test && tools/critic/rungate.sh tools/critic/own.mjs',
        'check:wrapped': 'tools/critic/wrap.sh shots/x',
      };
      const cases = [
        ['check:converted', true, 'a gate whose own file imports the collector'],
        ['check:own', false, 'A GATE THAT IMPORTS A LIBRARY OUT OF A CONVERTED GATE and mentions one in a comment — borrowing a library is not borrowing a verdict'],
        ['check:wrapped', true, 'a shell wrapper is followed to the tool it really runs, and its comments are not'],
      ];
      for (const [g, want, why] of cases) {
        const got = usesCollector(g, S, dir);
        if (got !== want) { console.error(`SELF-TEST FAIL: ${why} — usesCollector said ${got}, wanted ${want}`); bad++; }
        else console.log(`  ok     ${why} -> ${want}`);
      }
    }

    // AND THE COLLECTOR ITSELF, in a real process — see tools/_findings.mjs.
    const coll = await spawnOne(process.execPath, [path.join(ROOT, 'tools/_findings.mjs'), '--self-test'], true);
    if (coll.code !== 0) { console.error(`SELF-TEST FAIL: tools/_findings.mjs --self-test exited ${coll.code}; the rule that a route finding cannot exit 0 is not proved, so every ledger below means nothing`); bad++; }
    else console.log('  ok     tools/_findings.mjs proves a route finding cannot leave a process with a zero exit code, and that a clean gate is untouched');

    // AND THE RUNNER'S HALF OF THE LOCK, on a planted ledger and a planted code.
    const jr = [
      [{ route: 2, preview: 7, engine: 0, exit: 1 }, 0, 1, 'THE check:shape SHAPE: a gate that prints two route findings and exits 0 is recorded RED by the runner'],
      [{ route: 0, preview: 7, engine: 0, exit: 0 }, 0, 0, 'a gate holding only preview findings that exits 0 is left alone'],
      [{ route: 0, preview: 0, engine: 0, exit: 1 }, 1, 1, 'a clean ledger does not rescue a gate that crashed'],
    ];
    for (const [led, child, want, why] of jr) {
      const got = judgeRun(led, child).code;
      if (got !== want) { console.error(`SELF-TEST FAIL: ${why} — judgeRun gave ${got}, wanted ${want}`); bad++; }
      else console.log(`  ok     ${why}`);
    }
  }

  // --- and now the real one ------------------------------------------------
  const problems = [
    ...accountFor(pkg.scripts, GATES, NOT_IN_BUILD),
    ...accountForSelfTests(pkg.scripts, GATES, SELF_TEST_INLINE, NO_SELF_TEST),
    ...accountForPerWave(pkg.scripts, GATES, NOT_IN_BUILD, PER_WAVE),
    ...accountForFindings(pkg.scripts, GATES, NO_FINDINGS_LEDGER, (g) => usesCollector(g, pkg.scripts)),
  ];
  if (problems.length) { for (const p of problems) console.error(`SELF-TEST FAIL: ${p}`); bad += problems.length; }
  else {
    const n = Object.keys(pkg.scripts).filter((k) => k.startsWith('check:')).length;
    const flag = (g) => (pkg.scripts[g] || '').includes('--self-test');
    const noneNames = new Set(NO_SELF_TEST.map(([g]) => g));
    const full = GATES.filter(([g]) => flag(g) && !noneNames.has(g)).map(([g]) => g);
    const partial = GATES.filter(([g]) => flag(g) && noneNames.has(g)).map(([g]) => g);
    const unproved = GATES.filter(([g]) => !flag(g) && noneNames.has(g)).map(([g]) => g);
    console.log(`  ok     all ${n} check: scripts accounted for — ${GATES.length} in the build, ${NOT_IN_BUILD.length} left out with a reason, ${PER_WAVE.length} of those recorded per wave`);
    const noRule = PER_WAVE.filter(([, , c]) => !c).map(([g]) => g);
    console.log(`  ok     per-wave: ${PER_WAVE.length - noRule.length} have their RULE in the build as a gate of its own; `
      + `${noRule.length} do not, and their rule is checked on no commit (${noRule.join(', ') || 'none'})`);
    console.log(`  ok     self-tests: ${full.length} run --self-test, ${SELF_TEST_INLINE.length} prove themselves inline `
      + `(${SELF_TEST_INLINE.map(([g]) => g).join(', ')}), ${partial.length} only in part (${partial.join(', ') || 'none'}), `
      + `${unproved.length} not at all (${unproved.join(', ') || 'none'}) — each with a written reason`);
    const own = GATES.filter(([g]) => usesCollector(g, pkg.scripts)).map(([g]) => g);
    console.log(`  ok     findings ledgers: ${own.length} of ${GATES.length} gates hand their verdict to tools/_findings.mjs, `
      + `so the runner and not the gate decides what a route finding is worth; ${NO_FINDINGS_LEDGER.length} do not `
      + `(${NO_FINDINGS_LEDGER.map(([g]) => g).join(', ') || 'none'}) — each with a written reason, and that list may only get shorter`);
  }

  if (bad) { console.error(`\nself-test: ${bad} failure(s)`); process.exit(1); }
  console.log('\nself-test: ok — the runner sees a failure; no gate can be defined without being in the build or excused from it, and none can be in the build without saying whether it has ever refused anything');
  process.exit(0);
}

/* Everything above is definition; everything below RUNS THE BUILD, so it hangs
   off a function that only IS_MAIN calls. See IS_MAIN. */
async function main() {
if (!wanted.length) { console.error(`--only "${only}" names no gate; --list to see them`); process.exit(2); }
const { readFileSync } = await import('node:fs');
const scripts = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8')).scripts;
const rows = [];
for (const [script, why, scope] of wanted) {
  console.log(`\n\x1b[1m── ${script} ──\x1b[0m ${why}`);
  const { code, secs, tail } = await run(script);
  /* THE TAIL IS READ WHETHER OR NOT THE GATE WENT RED, and that is a change.
     A sweep gate whose severity follows the route — check:scenes, check:mastery —
     can now find something real, print `PREVIEW-ONLY: …` and exit 0. Reading the
     tail only on failure would have made that finding vanish from the summary
     entirely, which is not "advisory", it is silence. */
  /* AND THE RUNNER, NOT THE GATE, DECIDES WHAT A ROUTE FINDING IS WORTH.
     A gate that uses tools/_findings.mjs prints its ledger as one machine line;
     `judgeRun` reads it and OVERRIDES a zero exit code when that ledger holds a
     finding on the shipped route or in the engine. That is the outside half of
     the lock: `tools/critic/choiceshape.mjs` found per-form answer leaks at
     62.2% and 57.3% ON THE ROUTE, printed every one of them, and returned 0 —
     three times now a gate has reported a route defect and claimed success, and
     each time the fix was a patch to that gate. This is not a patch. */
  const ledger = parseLedger(tail);
  const j = judgeRun(ledger, code);
  if (j.overridden) {
    console.log(`\x1b[31m  RUNNER OVERRIDE — ${script} ${j.overridden}\x1b[0m`);
  }
  const placed = whereIsIt(scope || 'sweep', tail);
  rows.push({
    script, why, scope: scope || 'sweep', code: j.code, childCode: code, secs, ledger,
    overridden: j.overridden,
    where: j.where || placed.where,
    said: placed.said || (ledger && ledger.route ? `${ledger.route} finding(s) on its own ledger` : null),
  });
  if (j.code !== 0 && has('--stop')) break;
}
const wave = await perWaveStatus(scripts);
const roadIds = await (async () => { try { return (await (await import('./_courses.mjs')).routeUnits()).road.map((u) => u.id); } catch { return []; } })();

const failed = rows.filter((r) => r.code !== 0);
const advisory = rows.filter((r) => r.code === 0 && r.said && r.where === 'preview');
console.log('\n\x1b[1mnpm run check\x1b[0m');
for (const r of rows) {
  const mark = r.code === 0
    ? (advisory.includes(r) ? '\x1b[33m ok*  \x1b[0m' : '\x1b[32m  ok  \x1b[0m')
    : '\x1b[31m FAIL \x1b[0m';
  console.log(`${mark} ${r.script.padEnd(22)} ${r.scope.padEnd(6)} exit=${String(r.code).padEnd(3)} ${r.secs.toFixed(1).padStart(7)}s   ${r.why}`);
}
const skipped = wanted.length - rows.length;
if (skipped) console.log(`       ${skipped} gate(s) not run (--stop)`);

/* THE PER-WAVE TABLE — the gates this run did NOT do, and what is known about
   them. It prints on every build, green or red, because the failure mode it
   exists for is a green build sitting on top of a recorded red nobody has
   opened since three waves ago. */
console.log(`\n\x1b[1mper-wave\x1b[0m   not run here; last recorded result, from progress/gate-runs.json  (\`npm run wave\`)`);
for (const w of wave) {
  const mark = { red: '\x1b[31m RED  \x1b[0m', stale: '\x1b[33m stale\x1b[0m', never: '\x1b[33m never\x1b[0m', fresh: '\x1b[32m  ok  \x1b[0m' }[w.state];
  console.log(`${mark} ${w.gate.padEnd(22)} ${w.scope.padEnd(6)} `
    + `${w.code == null ? 'never run    ' : `exit=${String(w.code).padEnd(3)}`.padEnd(13)}`
    + `${(w.at ? ago(w.at) : '—').padEnd(13)} rule on every commit: ${w.cheap || '\x1b[33mnone\x1b[0m'}`);
}
console.log('');

/**
 * THE ONE LINE.
 *
 * "3 of 21 gates red" is a fact nobody can act on. A build whose failure is
 * legible gets fixed; a wall of output does not. So the summary sorts the red
 * gates by WHERE THE DEFECT IS — on the two units `content/courses.json` puts
 * in front of a learner, or in a preview unit nobody is sent to — because those
 * are two different emergencies and only one of them stops a shipment.
 *
 * And it now carries the third fact, which is the one that was missing
 * altogether: WHICH PER-WAVE GATES ARE NOT EVIDENCE ABOUT THIS TREE. A gate
 * that is honestly too slow for every commit is still a gate; one nobody has
 * run since the tree moved is a paragraph. `check:compose` and `check:motion`
 * were both in that state and both red on the shipped route, and a blind critic
 * re-found their two defects by hand, twice, while this line said green.
 */
const waveRedRoute = wave.filter((w) => w.state === 'red' && w.scope === 'route');
const waveRedOther = wave.filter((w) => w.state === 'red' && w.scope !== 'route');
console.log(`\x1b[1m${summaryLine(rows, wave, roadIds)}\x1b[0m`);

if (failed.length) {
  const onRoute = failed.filter((r) => r.where === 'route');
  const preview = failed.filter((r) => r.where === 'preview');
  const engine = failed.filter((r) => r.where === 'engine');
  const unknown = failed.filter((r) => r.where === 'unknown');
  const list = (rs) => rs.map((r) => r.script).join(', ');
  console.log(`\x1b[31m${failed.length} of ${rows.length} gate(s) run here are red: ${list(failed)}\x1b[0m`);
  console.log(`  ON THE SHIPPED ROUTE (${roadIds.join(', ') || 'unknown'}) — a learner meets this today: ${list(onRoute) || 'none'}`);
  console.log(`  PREVIEW / OFF-ROUTE ONLY — nobody is sent there yet: ${list(preview) || 'none'}`);
  if (engine.length) console.log(`  NOT UNIT-SCOPED — the engine, the bundles, the solver, the gates themselves: ${list(engine)}`);
  if (unknown.length) {
    console.log(`  WHERE UNKNOWN — these sweep every unit and did not say which one they found it in: ${list(unknown)}`);
    console.log('     (a sweep gate can settle this by printing `ROUTE: …` or `PREVIEW-ONLY: …` as its last line)');
  }
  for (const r of failed) if (r.said) console.log(`     ${r.script}: ${r.said}`);
}
if (advisory.length) {
  console.log(`  ADVISORY — these exited 0 and still found something, in a preview unit nobody is sent to: ${advisory.map((r) => r.script).join(', ')}`);
  for (const r of advisory) console.log(`     ${r.script}: ${r.said}`);
  console.log('     Promoting that unit into content/courses.json route.units makes the same finding HARD on the next build.');
}
if (waveRedRoute.length) {
  console.log(`\x1b[31m  RECORDED RED, PER-WAVE, ON THE SHIPPED ROUTE: ${waveRedRoute.map((w) => `${w.gate} (${ago(w.at)})`).join(', ')}\x1b[0m`);
  console.log('     This build did not run them — they cost minutes of real play — but the tree holds a written record');
  console.log('     that they refused this product, and a build that prints green on top of that record is the artefact');
  console.log('     this list exists to abolish. Fix them, or run `npm run wave` and show they pass.');
}
if (waveRedOther.length) {
  console.log(`  RECORDED RED, PER-WAVE, NOT ON THE ROUTE: ${waveRedOther.map((w) => `${w.gate} (${w.scope}, ${ago(w.at)})`).join(', ')}`);
  console.log('     Reported on every build and not fatal, by the same severity rule check:mastery and check:scenes use.');
}
const cold = wave.filter((w) => w.state === 'stale' || w.state === 'never');
const coldRoute = cold.filter((w) => w.scope === 'route');
const coldOther = cold.filter((w) => w.scope !== 'route');
if (coldRoute.length) {
  /* STALENESS IS AS LOUD AS FAILURE, and this is where it got loud.
     `progress/gate-runs.json` recorded SIX route-scope gates that had never
     been run on this tree — check:layout, check:touch, check:density,
     check:takeover, check:progress, check:transient — which between them are
     every gate covering touch, layout and the opening ninety seconds, on the
     phone-and-Chromebook surface this product is sold for. The build printed
     that list, in this exact place, and exited 0. "We did not look" is not "it
     is fine", and a build that says green over six unread route gates teaches
     everybody that the per-wave ledger is decoration. */
  console.log(`\x1b[31m  NOT EVIDENCE ABOUT THIS TREE, AND ROUTE-SCOPE — ${coldRoute.length}: `
    + `${coldRoute.map((w) => `${w.gate} (${w.state === 'never' ? 'NEVER RUN' : `last run ${ago(w.at)}, on a different tree`})`).join(', ')}\x1b[0m`);
  console.log('     Each of these covers something a learner meets today, and nothing in this tree says whether it holds.');
  console.log('     A recorded green about a tree that no longer exists is not evidence, and never-run is not evidence at all.');
  console.log(`     ->  npm run wave -- --only ${coldRoute.map((w) => w.gate.replace(/^check:/, '')).join(',')}`);
}
if (coldOther.length) {
  console.log(`  NOT EVIDENCE ABOUT THIS TREE, off the route: ${coldOther.map((w) => `${w.gate} (${w.scope}, ${w.state === 'never' ? 'never run' : `last run ${ago(w.at)}, on a different tree`})`).join(', ')}`);
  console.log('     Named on every build and not fatal, by the same severity rule a preview finding follows.');
}
console.log('');

/* WHAT MAKES THIS BUILD RED. Three things, and the third one is new.
     1. a gate run here refused something — or its own findings ledger holds a
        route or engine finding and it tried to exit 0 anyway (judgeRun);
     2. a RECORDED red on a route-scope per-wave gate, because "we did not run
        it in this process" has never been a reason to print green over a
        written refusal;
     3. A ROUTE-SCOPE PER-WAVE GATE THAT IS STALE OR HAS NEVER BEEN RUN on this
        tree. Six of them were in that state — every gate covering touch,
        layout and the opening ninety seconds — and the build printed the list
        and exited 0. "We did not look" is not "it is fine".
   Off-route and engine per-wave reds, and off-route staleness, follow the same
   severity rule as a preview finding: named on every build, never fatal. */
if (failed.length || waveRedRoute.length || coldRoute.length) {
  if (!failed.length && !waveRedRoute.length) {
    console.log(`\x1b[31mno gate run here refused anything, and this build is still RED: ${coldRoute.length} route-scope `
      + 'per-wave gate(s) are not evidence about this tree. Staleness is as loud as failure.\x1b[0m\n');
  }
  process.exit(1);
}
console.log(`\x1b[32mall ${rows.length} gates run here are green, every route-scope per-wave gate has been run on THIS tree`
  + `${coldOther.length ? `, and ${coldOther.length} off-route per-wave gate(s) are not evidence about it` : ''}\x1b[0m\n`);
}

if (IS_MAIN) await main();
