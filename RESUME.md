# ASCENT — The Cipher Worlds · state of play

**Repos.** `/Users/harrison/dev/aadmath` is where work happens. `/Users/harrison/dev/aadmath-pub`
is a clean clone used only to push, because `.git` in the working repo is owned by root and no agent
can commit. Live at **https://robglnn.github.io/aadmath/**, served from `docs/` on `main`.

Three one-liners collapse all that friction, from a real terminal:

```bash
security unlock-keychain ~/Library/Keychains/login.keychain-db   # gh can then store its token
sudo chown -R harrison:staff /Users/harrison/dev/aadmath/.git    # agents can commit directly
gh auth refresh -h github.com -s workflow                        # lets .github/workflows/pages.yml push
```

---

## Run it

```bash
npm install && npm run dev            # http://127.0.0.1:5173
npm run check                         # every gate, with an exit-code table (npm run check --list)
npm run wave                          # the PER-WAVE gates — minutes of real play each — and it records what happened
npm run audit:gates                   # every check: script: in the build? covers what? has it ever refused anything?
tools/critic/snapshot.sh shots/x      # real pixels off a frozen build
```

### The gates — this is the important part

Nearly every defect a human found had already passed automated review, because the instrument was
measuring the wrong thing. Each gate below exists because something real slipped through.

| gate | what it does | why it exists |
|---|---|---|
| `tools/critic/coldplay.mjs` | Plays with **real key events** from cleared storage. Forbidden from using `window.__ascent` to make progress. 15 steps. | Three rounds "fixed" rift interaction while verifying through `openRiftById()`, which skips walking up and pressing a key. Shipped broken twice. |
| `tools/critic/landscape.mjs` | Layout across 8 viewports × 3 locales × notch rotations. Measures **ink, not boxes**. | Bounding boxes reported no overlap while text printed over text. Also: portrait was rendered with **no notch at all** for months, and insets were skipped outside English as "a geometry test" — the Polish frame was the one that failed. |
| `tools/critic/choiceaudit.mjs` | Renders thousands of items through the real UI, asserts the answer is present and correct. Self-tests by planting a fake. | A user reported options missing the right answer. |
| `tools/critic/choicelab/lab.js`<br>(the page `check:choices` drives) | Registers **every generator pack the manifest names**, and reads a rendered option as a learner sees it — a stacked fraction top-down, a radical with its surd, ± as a sign. When it has no rule for a control sequence it says so (`expectation-unknown`) instead of calling the option wrong. | The pack list was written out by hand and stopped at Level 2, so the render-level audit covered 24 of 62 skills and printed PASS in the same words either way. Widening it exposed three bugs in the reader itself — a fraction regex that could not see a nested brace, a surd the DOM reader dropped, and `\pm` — worth 3,255 findings that were all false. A gate that fires on honest content gets switched off. |
| `tools/validate-items.mjs` | Every answer re-derived by an **independent solver**, strict KaTeX, misconception tags, standards alignment. | Answers were once correct only "by construction". |
| `tools/check-i18n.mjs` | No hardcoded English in `src/` **or `content/`**. | 17 English paragraphs sat on a Spanish report while the gate said "every string comes from src/i18n". |
| `tools/check-language.mjs` | Sentence length, passive voice, terms used before definition. | The ASD-STE100 + ADHD standard. |
| `tools/simulate.mjs` | Monte-Carlo over synthetic learners: mastery, quintiles, hollow claims, time-to-clear. | The 80%-mastery promise needs evidence. |
| `tools/critic/reachable.mjs`<br>`npm run check:reachable` | Boots the shipped page with **no query string** and a cleared save, walks to a rift with **real key events** and opens it with a real key, then asks of every unit the manifest calls `shipped`: is one of its nodes in the boot lattice, does it have a rift in the world, and is its prerequisite closure inside that lattice. A null-input control proves the walk is measuring the keys and not the clock. | **52 of 62 skills were unreachable in normal play, and every gate was green.** They were green because every gate that touches content reaches it *by name*: `generate('exponent-power', 3, seed)` works perfectly for a skill no player can ever be handed. `validate-courses` proved 78,594 items across five units and none of them were in the game — with no query string the boot resolves the manifest default, one unit, ten nodes. |
| `tools/critic/determinate.mjs`<br>`npm run check:determinate` | 186,000 items, every skill in every unit, all three locales. Four rules: **collision** (the same stem over the same notation with two different accepted answers — a proof, not a threshold), **ambiguous** (one sentence, one shape of notation, two declared relations), **dangling** (the stem points at a marked row, a graph or a table the card does not carry), **selector** (the checker picks a row or column the card never states). **Its report now opens with an address, not prose**: a table of form, unit, ON ROUTE or preview, and item count, route-first and biggest-first, and a last line the build reads (`ROUTE:` / `PREVIEW-ONLY:`) so `npm run check`'s summary can say whether a learner is standing in it. | 2,348 items whose answer is not decided by what the learner is shown. 1,178 `parallel-perpendicular` items reading "Write the rule of the line through the marked reading" over a line and a point, where three forms print that sentence and one wants the parallel rule, one the perpendicular, and one tosses a coin. 1,170 `association-strength` items asking for "the marked column" with `figure: null` and nothing marked. Every other gate passed all of them: the mathematics was right, the KaTeX was strict, the sentences were short. **And then it happened again in the other direction: the gate worked and nobody acted.** It exits 1 today on `ratio-proportion/rp-model` — **525 items on the shipped route**, one Polish card with 30 accepted answers — and two critics later found the same defect by hand, independently. A finding a gate has already made and a human has to re-find is a finding the report buried. Nothing in forty lines of prose said which form, in which unit, or whether anybody could be handed it. |
| `tools/critic/handed.mjs`<br>`npm run check:handed` | **Left is left, on every surface, in one convention.** 13 sites — the strafe basis, the keyboard/pad/touch lateral axes, mouse and arrow-key yaw, the over-the-shoulder camera, the objective card's direction word, the off-screen marker arrow, the compass needle, the compass ribbon, and the stereo pan of a rift you cannot see. It does not test a copy of the rule: it **cuts the real expression out of the shipped file and executes it**, so an edit to `src/player/controller.js` is what runs. `src/world/bearing.js` is proved against **three.js's own `camera.project()`** — the matrix that puts the pixels on the glass — over 8 yaws × 3 pitches × 6 bearings × 3 distances. On top of the site list sits a **census**: seven textual rules find every chirality-bearing construction in `src/`, the planar cross product may appear in `bearing.js` and nowhere else, every call into it must pass the forward vector first (these functions are antisymmetric, so swapped pairs *are* an inversion and look like nothing in a diff), and every other hit is a registered site or a line in `NOT_CHIRAL` with a reason. `--self-test` mirrors every site and requires findings the honest source does not produce. | **This project shipped a left-for-right inversion twice, and every gate was green both times.** The client reported the first himself: *"A and D movement for character are backwards"* — `(fz, 0, -fx)` is the LEFT vector and it was used as screen-right. A critic found the second: the objective card said TO YOUR LEFT for a rift on the right while the arrow six pixels away pointed right, in every locale, and the Orders screen printed the same wrong word in a whole sentence. A still frame has no handedness, so no screenshot critic could ever see either one. Building this gate found a **third, live and unreported**: `src/world/afford.js` wrote the compass needle as `rotate: -ang`, mirroring the only bearing instrument on screen — and then a **fourth**, when the fix landed: `bearingWord()` gained eight bearings and `session.charter.mark` carried four of them, so the Orders screen would have printed a raw key in EN, ES and PL. |
| `tools/critic/ladder.mjs`<br>(applied by `validate-courses.mjs`) | Four rules on each skill's five band means, naming **which** band and **by how much**: `inverted`, `flat-span` (band 5 asks under 15% more than band 1), `flat-step` (a rung under +1%), `cliff` (one step carrying over 60% of the whole climb *and* over +50% of the band beneath it). | The ladder check only knew about inversion, so it certified `system-substitution` — 8.20 8.65 8.66 8.90 9.19, five bands spanning 0.99, adaptivity moving a learner between five settings that are one setting — and `exponent-power` — 4.01 4.44 4.96 **9.16** 10.21, an 85% jump and 68% of the whole climb at one boundary, which is a wall inside one skill. Every threshold sits in a measured gap in the 62-skill distribution and the self-test names the honest skill on the safe side of each. |
| `tools/validate-courses.mjs`<br>`npm run check:courses` | The only gate over the **whole** course: five units, 62 skills, 78,594 items — graph shape, standards in every declared framework, every form by name in three locales, strict KaTeX on the options a learner is actually shown, and the ladder above. | **It was never wired into `npm run check`.** It failed deterministically, on every run, for as long as it had existed, while the build printed green: `multi-step band 3 does not ask more than band 2 (9.04 -> 9.01)`. The build was reporting on ten skills and calling it the product. |
| `tools/gate-audit.mjs` | Asks five questions of every one of the 52 `check:` scripts, from the source of record rather than from a document: **is it in the build** (`GATES` / `NOT_IN_BUILD`), **where would its red be** (route / sweep / engine), **what does it cover** (`check-coverage` walks its real module graph: all 62 skills the manifest names, or the 10 in the core bank), and **has it ever refused anything** — which it answers by RUNNING every `--self-test` and recording the exit code, not by reading a claim. `--md` prints the table for this file. **A fifth question, added this wave: WHO DECIDES WHAT ITS FINDINGS ARE WORTH.** A gate that owns its own exit code can print a route defect and return success, which is exactly what `check:shape` did; a gate whose verdict goes through `tools/_findings.mjs` cannot. The column is read off the real module graph — imports, and the tools a shell wrapper names — not off a list, and it reads **52 of 52** today. | Three times a gate here turned out not to be one, and each time the answer was a hand-written sentence that then went stale: `check:courses` failed on every run outside the build, `check:standards` was in neither list, `check:mastery` was excluded *for being red*. A table somebody types is the same artefact that failed those three times. This one is regenerated. |
| `tools/check-all.mjs`<br>`npm run check` | Runs every gate — no `&&` — and prints an exit-code table with a line per gate, **and one summary line that sorts the red ones by whether the defect is on the shipped route, in a preview unit, or not unit-scoped at all**. `--stop` restores the old short-circuit. Its `--self-test` now **balances two sets of books**. (1) Every `check:*` script the package file defines must be in `GATES` or in `NOT_IN_BUILD` **with a written reason**, and neither list may name a script that does not exist. (2) Every gate in the build must either run `--self-test`, or be named in `SELF_TEST_INLINE` (it plants its own faults on every run) or `NO_SELF_TEST` (it does not, and here is why and what covers it meanwhile) — because *a gate nobody has watched refuse anything is not a gate*, and that sentence was being kept in people's heads. Today: 10 run `--self-test`, 3 prove themselves inline, 1 only in part (`check:courses` — the ladder half self-tests, the rest of it plants nothing), 4 not at all (`check:items`, `check:standards`, `check:scenes`, `check:marlow`). That list is printed by the build itself and cannot grow without somebody writing the reason down. `npm run check --list` prints the gate table, the omissions and the per-wave ledger. **And a third set of books, added this wave:** every gate in `NOT_IN_BUILD` must be in `PER_WAVE` — its last exit code, its duration and a content fingerprint of the tree written into `progress/gate-runs.json` by `npm run wave` — or must NAME the per-wave gate that covers it, and that coverer must itself be recorded, so an excuse cannot point at another excuse. A per-wave gate may also declare the gate in the build that checks its RULE in a second with no browser, and the build prints which ones have none. `summaryLine()` is planted against too. **And a FOURTH set of books, added this wave — who decides what a gate's findings are worth.** Every gate in the build must hand its verdict to `tools/_findings.mjs` or be named in `NO_FINDINGS_LEDGER` with a reason; `usesCollector()` answers that off the real module graph (imports, and the tools a shell wrapper names), never off a list. **52 of 52 `check:` scripts now do**, so the list is empty. Every gate's output is read for its machine line and re-judged by `judgeRun`: **a gate that exits 0 while its own ledger holds a route or engine finding is recorded RED by the runner and the override is printed by name.** And the summary's one line grew a fourth fact and a new severity: **A ROUTE-SCOPE PER-WAVE GATE THAT IS STALE OR HAS NEVER BEEN RUN ON THIS TREE FAILS THE BUILD**, exactly as a recorded red does. | Eight gates joined by `&&` means the first red one hides the rest, and a gate nobody added to the string is not in the build at all. Both happened: see the two rows above. And then it happened a third time, quietly — `check:standards`, the gate over every CCSS and TEKS citation in all five units, was in neither the build list nor the list of deliberate omissions. Nobody had left it out; nobody had put it in. The omissions used to live in a doc comment, where nothing could read them. **And a build whose failure is not legible does not get fixed.** `21 of 21 gates` is not an actionable sentence: `content/courses.json` ships two of five units, so a red gate is either a defect a learner meets today or one in a preview region nobody is sent to, and those are not the same emergency. Every gate now declares a scope (`route` / `sweep` / `engine`), the runner keeps each gate's output tail, and a sweep gate that knows the difference says so on its last line as `ROUTE:` or `PREVIEW-ONLY:` — read by `whereIsIt()`, which is planted against in `--self-test`, and which reports **unknown** rather than guessing when a gate does not say. And this file used to run the entire build as a side effect of being `import`ed, which is how a twenty-minute sweep started from an `import` statement; it has a main guard now (`tools/simulate-all.mjs` had the identical defect the moment it had anything worth importing — importing it started a four-minute Monte-Carlo — and now has the same guard). **And the fourth shape of the same disease, which this wave found: an honestly-excluded gate that nobody ever runs.** `check:compose` and `check:motion` were both in `NOT_IN_BUILD` with a true cost written beside them — nine and eighteen minutes of real play — and both were RED ON THE SHIPPED ROUTE, and nothing anywhere said so, so a blind critic re-found both of their defects by hand, twice. "Run per wave, not per commit" is a real decision; it is only a decision if somebody can tell whether the wave happened. Now `npm run check` reads `progress/gate-runs.json` on every build and its one line carries three facts: what is red (including a RECORDED per-wave red, starred), which of that a learner meets today, and which per-wave gates are not evidence about this tree. **A recorded red on a route-scope per-wave gate fails the build** — printing green on top of a written refusal is the artefact the whole list exists to abolish — and off-route reds follow the same severity rule a preview finding does. **And the fifth shape, which is why the exit code stopped being the gate's to write.** `progress/gate-runs.json` held six route-scope gates that had NEVER been run on this tree — `check:layout`, `check:touch`, `check:density`, `check:takeover`, `check:progress`, `check:transient`, which between them are every gate covering touch, layout and the opening ninety seconds, on the phone-and-Chromebook surface this product is sold for — and the build printed that list in full and exited 0. "We did not look" is not "it is fine", and a build that prints green over six unread route gates teaches everybody that the ledger is decoration. Staleness is now as loud as failure and counts in the same clause of the same line. |
| `tools/simulate-all.mjs`<br>`npm run check:mastery` | **In `npm run check`, and it can turn it red.** **The arm it reads is the ACROSS-DAYS one** — 15-25 minute sittings with a night between them — and it is read by `readArms()`, which cuts the output into its sections first (every heading simulate.mjs prints sits at column 0 and everything it owns is indented) and then reads each arm's figure ONLY from inside that arm's own block. Three rules make it fail closed: a reading may only come from its own section, so the identical row `true mastery of the level` in the testing-out block cannot be mistaken for it; a missing, doubled or ambiguous section is a RED gate and **never** a fall-back to the headline; and the child's own exit code is not enough, because `simulate.mjs` exits 0 on the strength of the cram. **Both cadences of the delivered arm are held to the bar** — 24 h and 72 h — and the number the table reports is the weaker of the two, so the friendlier one cannot be quoted. The cram figure is still read and printed beside it, labelled, because the manifest's published 98.0% is a single-sitting number. The honest end state is `simulate.mjs --json`, which is the pedagogy lane's file; `readArms()` is the one function that changes when it lands and its self-test is the contract. Simulates the SHIPPED ROUTE composed — `--units algebra1-l1,algebra1-l2`, the lattice a learner with no query string actually walks — at the parameters `content/courses.json` itself publishes (300 learners, 3600 items), and re-runs that published experiment on every build. A route run under 80% exits 1. Preview units and preview prefixes are ADVISORY: run, printed with their numbers, never red. Severity is read off `route.units`, not written in the tool, so promoting a unit makes its run hard on the next build with no edit; `--self-test` plants a manifest and proves both directions. It also prints, every run, which runs it did NOT do and the flag that brings them back (`--full`, `NOT_IN_BUILD` as `check:mastery:full`). | **It was out of the build, with the reason written down as "It currently fails on Levels 2 and 4."** A gate excluded *because it fails* is not a decision; it is the defect, written into the tree in the shape of a decision — so the one number this product is sold on could not turn `npm run check` red for a unit that is on the route. And the reason it failed was itself a measurement error: `--unit algebra1-l2` prunes cross-unit prerequisites, modelling a learner who walks into Level 2 with no Level 1 behind them, the one condition `src/content/route.js` makes impossible. That reading is 68.0%; the composed route reads **98.0%** and passes. The gate was measuring a lattice nobody plays and then being switched off for saying so. **And then, in the build, it certified the wrong arm.** `simulate.mjs` runs two cohorts over the same lattice, the same bank and the same budget, differing only in the SHAPE the work arrives in: one unbroken sitting (its own header calls this row *the cram*), and 22-minute sittings with a real night between them, the record saved and reloaded at every boundary — which is the delivery shape BRIEF.md mandates in as many words. The predicate was `/(\d+(?:\.\d+)?)% of simulated learners reach true mastery/` matched against **the whole captured tail**, and that sentence belongs to the cram. So on 2026-08-28 this gate certified the shipped route at **97.0%** while the same output, forty lines up, read `true mastery of the level 0.0%` for the across-days cohort. The number was not wrong; it was about a cohort nobody is. **The arm rule earns its keep on the very first honest run**: with the delivered arm now read, the daily cadence passes at 90.7% and the three-day cadence reads **6.7%** — so a predicate that had been "fixed" to read only the daily row would have gone green over a cohort that never learns anything, and `tools/simulate.mjs` still exits 0 on the whole run. Both cadences are held to the bar, and the number the table quotes is the weaker one. |
| `tools/gate-ledger.mjs`<br>`npm run wave` | **The per-wave ledger.** `npm run wave` runs every gate in `PER_WAVE`, exactly as `package.json` defines it, and writes the exit code, the duration, the time and a **content fingerprint** into `progress/gate-runs.json`. The fingerprint is a sha1 over the product (`src/`, `content/`, `index.html`, `vite.config.js`) plus the tool files the gate's own command names and the command string itself — content, never mtime, because a fingerprint that moves when somebody opens a file trains everybody to ignore the word *stale*. `classify()` answers **never / red / stale / fresh**, and **red outranks stale**: a recorded refusal does not decay into "we should re-run that sometime". `--self-test` plants trees — one changed byte, one new file, a two-stage command, a missing ledger — and proves the round trip keeps a red red. **And its answer is now acted on rather than printed.** `classify()` still answers never / red / stale / fresh with red outranking stale, but `npm run check` now FAILS on `stale` and `never` for a route-scope gate as well as on `red` — because six route-scope gates had never been run on this tree and the build said green over the list of them. It is not a gate, so it is not in the list, but `npm run check --self-test` runs it on every build for the same reason it runs `tools/_freeport.mjs`. | `check:compose` and `check:motion` were out of the build with an honest cost written beside them, both RED ON THE SHIPPED ROUTE, and **never run**. A blind critic found both defects by hand, twice, while `npm run check` printed green. That is `check:mastery`'s exclusion one step further along: there, somebody at least had to write the word *fails*. Here nobody had to write anything at all. |
| `tools/critic/compose.mjs`<br>`npm run check:compose` (per-wave, **RECORDED RED**)<br>`npm run check:compose:rule` (**every commit**) | **Every place the game sends you is a place with a shot in it.** Recorded on this tree 2026-08-28, exit 1 in 887 s: **192 of 391 frames not free**, over 15 seated sites, 118 approaches and 12 sprints — 49 of them at one waygate, 23 at `both-sides`, 19 at `order-ops`, and four sprints ending somewhere `notFree()` refuses. Its planted wedge was caught, the engine was advancing at all 391 frames, and there were no console errors, so the run measured the game and not the harness. It asks `notFree()` — the repo's one honest answer to *is this a frame a player can play out of*, measured off the real heightfield, the real three.js camera transform and raycasts through the real scene graph — of the positions the game CHOSE: every objective the world seats, approached from 8 bearings on real keys, the ground covered on the way in sampled three times an approach, and the ends of 12 sprints. About nine minutes of walking. **Its predicate is now a gate of its own in the build** (`check:compose:rule`, 0.35 s, no browser): it runs `notFree()` over the exact frame the report quotes and over honest ground — the open plaza, and the tightest legitimate standing place on the island, which must still pass or the gate is a gate against hillsides. Every ordinary run also plants a real wedge in the real build (a cadet 1.2 km off the island, a state the collider cannot rescue him out of before the reading) and requires the gate to refuse it. | *"Standing 3 m from the objective ring the game itself sent me to, the project's own escape instrument reads open 0.00, short 0.73, seeFar 0.00, minD 0.37 m, boom 1.85 m — FOUR clauses of `notFree()` failing at once — and the frame is solid dark green with no cadet in it. 3 of 8 random 70 m sprints ended somewhere that same predicate calls not-free."* The instrument already existed and was asked in exactly one place: after pressing the Recover key. So the game could hand a player an unplayable frame for as long as it liked, provided nobody pressed R. |
| `tools/critic/motion.mjs`<br>`npm run check:motion` (per-wave, **RECORDED GREEN — and the number it used to be red on was the harness**)<br>`npm run check:motion:rule` (**every commit**) | **Does the loop still need the world?** A sitting measured at 1 Hz on the real frame loop, from a cleared save, on real keys: seconds actually moving, ground covered, the longest unbroken run inside one 2 m circle *whatever is on screen*, and how many of the six verbs the game owns (sprint, dash, glide, updraft, vault, build) the sitting ever used. Eighteen minutes of real play. It is the exact mirror of `check:traffic` — traffic says *the walk must not be through nothing*, this says *there must be a walk* — because a gate with a ceiling and no floor certifies removing traversal instead of composing it. **Its three bars are now a gate of its own in the build** (`check:motion:rule`, 0.35 s, no browser): they must fire on the sitting the report describes and on two other broken shapes, and must stay quiet on a healthy sitting **and on a slow learner who works one whole stint from one spot** — 178 s against a 210 s bar, so the thing that fails is never a slow learner. **And every ordinary run now PROVES THE INSTRUMENT BEFORE IT MEASURES ANYTHING:** one card of each of the six surfaces `_mount()` can build is put up on the real build and ANSWERED — the coordinate plot on a `?unit=algebra1-l2` boot, because that is where it lives and it is still on the shipped route — and the old *"one blind click on `.rf-move, .rf-cell, .ans`"* strategy is planted at the real area field and required to settle nothing. A surface it cannot press is an ENGINE finding on the ledger, and the gate says in as many words that every number under it is a reading about the harness. `S.items` only counts an item when something was actually pressed, a card that has already SEALED is no longer miscounted as unpressable, and a browser that dies mid-sitting is recorded as an engine finding with the minute it died at instead of an uncaught exception. | *"The cadet moved horizontally for 35 SECONDS and covered 128 m of ground… he stood on the same square metre for 614 CONSECUTIVE SECONDS while a ring fed him 17 questions in place."* Zero verbs used, in a game sold as flying, gliding and dashing. **AND THEN THE INSTRUMENT ITSELF WAS THE STORY, TWICE.** First a modal: the RUN CLOSED card held 967 of this gate's own 1,082 seconds, full frame, holding `uiOpen`, with the gate pressing Escape at it five times a pass — so 3.6% moving was largely an instrument reading a BLOCKED player as an IDLE one. That card is fixed. Then `answer()`: it could not press three of the six surfaces the rig draws (see `_play.mjs`), so it counted no-ops as answered items and the park it measured was partly itself. **Nobody may quote 3.6% / 805 s / 971 s: those are readings from a broken instrument.** The honest baseline, after the modal fix and before this one, is 5.5% moving · 793 s parked at one spot · 336 items served there · 2 of 6 verbs — and 749 of those parked seconds had THE RIFT PANEL up, not a session card. The defect is real and its mechanism is the ring feeding items in place. **RE-MEASURED ON THIS TREE, 2026-08-28, with an instrument that can play: 18.4 min, 87 items answered, 57.2% moving (632 s of 1,104 s), 5,293 m of ground, longest park 101 s with 8 items served there, 3 of 6 verbs (sprint 131, vault 5, updraft 4) — exit 0.** Three readings of the same eighteen minutes, and the only thing that changed between them was the harness: 3.6% moving with a modal eating 967 s; 5.5% moving / 793 s parked / 336 items with the modal fixed and `answer()` still unable to press three surfaces; 57.2% moving / 101 s parked / 87 REAL items once it could. The 336 "items served" at one spot were mostly no-ops on a sorting board that never settled, which is precisely why the cadet never left it. **The gate passes on the verb bar at exactly 3 of 6** — dash, glide and the build hand were never reached in eighteen minutes — so the floor is met and nothing above it is. |
| `tools/scene-audit.mjs`<br>`npm run check:scenes` | No cadet meets the same situation twice in one sitting, in any unit the manifest ships — 40 sessions of 45 scheduled items per unit, worked analogues included, exactly as the game draws them. **Its severity now follows the route**, by the same rule and the same helper `check:mastery` uses: a repeat in a unit on `route.units` exits 1 and prints `ROUTE: …`; a repeat only in a preview unit prints every finding in full, prints `PREVIEW-ONLY: …` and exits 0, and `npm run check` lists it as **ADVISORY** on every build with the gate's own sentence beside it. Promoting any of those units makes the same finding hard on the next build with no edit to the tool. | It printed every finding and then exited 1 whatever it found, so three preview-unit repeats — `l3.ctx.disputeFactorCount ×6`, `l4.ctx.plotStore ×5`, `l5.ctx.rampRule ×7` — held `npm run check` red for a region no learner is sent to. A build that is permanently red for a defect nobody can meet teaches everybody to stop reading the build, and the next thing that gets excused is a route defect. |
| `tools/check-coverage.mjs`<br>`npm run check:coverage` | A gate over the gates. For **every** `check:*` script it walks the module graph that script really runs — static imports, dynamic imports, the lab directories a critic hands to a vite build, and the tools a gate `spawn`s rather than imports — and asks one question: this tool reads the generator surface, does anything in it load the packs the manifest names? It checks its own premise first (`SKILLS` holds **10** cold and **62** after the manifest; if those are ever equal it fails and says the rule has stopped meaning anything), it refuses to let one gate borrow another gate's coverage, and its exceptions carry a reason under the same rule as `NOT_IN_BUILD`. | `SKILLS` is a **live view** over the content registry, so a tool that sweeps it without loading the packs measures ten skills of sixty-two and prints PASS in exactly the same words. There is no error, no warning, no smaller number in the output. `check:lang`, `check:scenes` and the choice-set lab all shipped that way; the lab's hand-written pack list stopped at Level 2 and covered 24 of 62. One audit fixes that for one afternoon — this fixes it for good. Its self-test takes the **real** `choicelab/lab.js`, puts the hand-written list back in memory, and proves the rule flips. |
| `tools/build-standards.mjs`<br>`npm run check:standards` | `content/STANDARDS.md` cites what the graphs cite, in every framework, over all five units. **Now in `npm run check`.** | It existed, it passed, and it was not in the build — see the `check-all` row. A gate outside the build is a gate that stops being true the first week nobody runs it. |
| `tools/_findings.mjs` | **THE FINDINGS COLLECTOR — the exit code is not the gate author's to write.** A gate declares findings with a scope (`route` a learner meets today · `engine` not unit-scoped, red everywhere · `preview` on disk in front of nobody, advisory and printed in full) and **the collector owns the exit code**. Two independent locks, because this rule has been broken three times by three different mechanisms. INSIDE the process: declaring a route or engine finding installs a `process.on('exit')` guard that rewrites a zero exit code to 1 — after `process.exit(0)`, after `process.exitCode = 0`, after falling off the end of the file; the self-test proves it in eight real child processes that each try to get away with it, and proves a clean gate and a preview-only gate are untouched. OUTSIDE it: the ledger is printed as one machine line (`GATE-FINDINGS v1 gate=… route=… preview=… engine=… exit=…`) which `tools/check-all.mjs` reads out of every gate's output and re-judges with `judgeRun` — **a gate that exits 0 while its own ledger holds a route finding is recorded RED by the runner, whatever the gate thought.** `forUnit(unitId, text)` puts the repo's severity rule — read off `content/courses.json` — in one place instead of five, so promoting a unit makes every gate's identical finding fatal with no edit to any tool. **The ledger is a floor on severity and never a ceiling:** `check:determinate`, `check:courses` and `check:record` are stricter than it and stay that way. `node tools/check-all.mjs --self-test` runs its self-test on every build, and a fourth accounting (`accountForFindings`) refuses a build where a gate in the list neither uses it nor has a written reason. | **THE THIRD OCCURRENCE OF ONE DISEASE, and patching the third one would have been the fourth patch.** (1) `check:mastery` was excluded from the build with the reason written into the tree as *"It currently fails on Levels 2 and 4."* (2) Back in the build it went green by matching the CRAM arm while the delivered arm in the same output read `0.0%`. (3) `tools/critic/choiceshape.mjs` found per-form answer leaks **ON THE SHIPPED ROUTE** — `literal-equations/le-share` hands a cadet who plays *"take the ones without a minus sign"* **50.0% against 25.0%** over 144 sets, `compound-inequality/cd-band` **48.3%** — printed all of them in full, then wrote *"the bar this gate enforces is the surface"* and **returned 0**. A gate that reports a route defect and returns success is worse than no gate: it manufactures confidence and buries the finding in a passing log. Two critics had already re-found this class of defect by hand. **And a second gate was quietly degrading the one signal the runner sorts by:** on a CLEAN run this gate printed `ROUTE: the two plots stand off the coast on the shipped route`, and `ROUTE:` is the marker that means *here is a defect a learner meets today*, not *this gate is about the route*. A marker that means two things means nothing. The ledger prints it now, from one place, and only when there is something to print. |
| `tools/critic/choiceshape.mjs`<br>`npm run check:shape` | The key's SHAPE carries nothing: how often it is the shortest, longest, most- or fewest-digits option, on **every surface separately** — the four-option card, the special-answer card, the narrowed field, the balance move tray and the sorting bays — two-sided against chance with a Bonferroni step, on the route and in every preview unit. **And per FORM, because a learner works one skill at a time:** a surface's number is an average, and a single form at 50% inside a surface averaging 26% is a cadet being handed the answer for a whole sitting. Its verdict now goes through the findings ledger, and its `--self-test` plants that exact reading — one route form over the band with every surface average inside it must fail the gate. | **It found the defect, printed it, and exited 0.** 25 route forms over the band were listed in full under the heading *"the route forms furthest from chance — a learner works ONE SKILL at a time"*, and the next line said the bar this gate enforces is the surface. Measured on this tree the ledger now reads **86 route findings and 26 preview**, and the gate is red. |
| `tools/critic/_play.mjs` | **The six answer surfaces, pressed the way a hand presses them** — shared by `check:motion` and available to every browser critic. A choice by `data-value`; the keypad one click per glyph on the cap that publishes it (`data-g`), so no keyboard layout and no locale is in the way; the sorting bays chip-then-bay, reading each chip's KaTeX `<annotation>`; the area field by splitting the answer into the two terms the two parts of the rectangle are worth; the balance beam by parsing the LIVE statement at the head of the rig, computing the move that takes ground off it, and pressing the button that carries that move — in `÷` and in the `:` two of the three shipped locales use; the coordinate plot on the keys the surface itself publishes (`1`/`2` pick a knob, arrows walk it one lattice square, `Enter` seals), with the scale MEASURED off one arrow press rather than assumed. `--self-test` reads back the exact strings the shipped tray prints and proves the old strategy pressed nothing. | **A GATE THAT CANNOT PLAY THE GAME CANNOT MEASURE HOW THE GAME IS PLAYED.** `motion.mjs` answered the balance, the plate and the area field with *"one honest click on `.rf-move, .rf-cell, .ans`"*. `src/ui/rift.js:3949` returns early on a cell click when no chip is picked, so **that click is a no-op**; the area field's chips are `.rf-chip`, the same class the bays use, so an area card fell into the sorter branch, found no `.rf-bay`, placed nothing — **and counted an item as answered**; and the coordinate plot has none of the three classes, so it fell through to typing `y = 3x + 1` at a surface with no socket. A card that is never answered never settles, the scheduler never moves, and the cadet stands on that plate for the rest of the sitting. **And the self-test caught its own author:** `parseOp('+\; 4')` inside a JavaScript string is `+; 4`, so the reader's thin-space strip was never exercised, every move on every beam parsed as `null` on the real build, and the harness fell back to clicking the tray in order for eight moves without solving anything. The cases are written off the real tray now. **And its twin gate had the same defect and the same fix.** `tools/critic/traffic.mjs` answered the beam, the bays, the field and the plot with `page.locator('.rf-move, .rf-chip, .rf-bay, .ans').first().click()` — a `.rf-chip` click only PICKS the chip — so its ceiling on *the walk through nothing* was measured by a harness that could not answer four of the six surfaces either. Both gates press through `tools/critic/_play.mjs` now, and traffic's rule half is finally a gate of its own on every commit (`check:traffic:rule`), which its own `NOT_IN_BUILD` line had been asking for. |
| `tools/_freeport.mjs` | The five gates that stand up a server and point a browser at it — `check:figures`, `check:record`, `check:reachable`, `check:answerable`, `check:choices` — bind on **port 0** and read the number back, instead of drawing a random port out of a 400-wide range. `--self-test` holds a port, proves the old line dies on it, and proves the new one does not; stands eight servers up at once; and proves a bind that cannot succeed **rejects rather than hangs**. It is not a gate, so it is not in the list — but `check-all --self-test` runs it on every `npm run check`, because a helper nobody runs is a helper that rots. | Several builders and critics run at once here — that is the documented working mode — and two of them drew the same number. `listen(port, host, cb)` fires the callback on success and nothing on failure, so the `error` event went unhandled and node re-threw it: `npm run check` recorded `check:reachable` as red with `Error: listen EADDRINUSE 127.0.0.1:5241` and not one word about the game. `check:record` had the worse shape of the same bug: `vite preview --strictPort` simply never came up, the 30-second wait ran out in silence, and every reading afterwards was taken against a dead URL. A gate that goes red for a reason that is not the product is how gates stop being read. |

#### Every `check:` script, and the five questions that decide whether it is a gate

The table above carries the *why*; this one carries the *accounting*. It is generated —
`node tools/gate-audit.mjs` regenerates it, `--md` in this shape — because the last three times
somebody wrote this down by hand it went stale and a gate fell out of the build unnoticed. "Has it
ever refused anything" is measured, not claimed: the audit RUNS each `--self-test` and records the
exit code. Measured on this tree today.

| gate | in `npm run check` | where its red is | item coverage | has it ever refused anything | who decides what its findings are worth |
|---|---|---|---|---|---|
| `check:answerable` | **yes** | sweep | all 62 skills | every run, no flag | the findings ledger |
| `check:cases` | **yes** | sweep | all 62 skills | proved just now (0.2s) | the findings ledger |
| `check:choices` | **yes** | sweep | all 62 skills | every run, no flag | the findings ledger |
| `check:compose:rule` | **yes** | route | reads no items | proved just now (0.2s) | the findings ledger |
| `check:courses` | **yes** | sweep | all 62 skills | proved just now (0.0s) | the findings ledger |
| `check:coverage` | **yes** | engine | all 62 skills | proved just now (0.1s) | the findings ledger |
| `check:determinate` | **yes** | sweep | all 62 skills | proved just now (0.1s) | the findings ledger |
| `check:docs` | **yes** | sweep | reads no items | proved just now (0.1s) | the findings ledger |
| `check:echo` | **yes** | sweep | all 62 skills | proved just now (134.4s) | the findings ledger |
| `check:figures` | **yes** | sweep | all 62 skills | proved just now (0.1s) | the findings ledger |
| `check:handed` | **yes** | route | reads no items | proved just now (0.2s) | the findings ledger |
| `check:i18n` | **yes** | engine | reads no items | proved just now (0.1s) | the findings ledger |
| `check:items` | **yes** | route | 10 skills (excused) | NEVER — nothing planted | the findings ledger |
| `check:lang` | **yes** | sweep | all 62 skills | proved just now (0.1s) | the findings ledger |
| `check:marlow` | **yes** | route | reads no items | NEVER — nothing planted | the findings ledger |
| `check:mastery` | **yes** | route | all 62 skills | proved just now (0.1s) | the findings ledger |
| `check:meet` | **yes** | route | reads no items | proved just now (7.0s) | the findings ledger |
| `check:modal` | **yes** | route | reads no items | proved just now (0.2s) | the findings ledger |
| `check:motion:rule` | **yes** | route | reads no items | proved just now (0.0s) | the findings ledger |
| `check:prose` | **yes** | sweep | all 62 skills | proved just now (0.1s) | the findings ledger |
| `check:reach` | **yes** | route | reads no items | proved just now (8.5s) | the findings ledger |
| `check:reachable` | **yes** | route | reads no items | proved just now (0.2s) | the findings ledger |
| `check:record` | **yes** | sweep | reads no items | proved just now (0.2s) | the findings ledger |
| `check:route` | **yes** | route | all 62 skills | proved just now (0.8s) | the findings ledger |
| `check:scenes` | **yes** | sweep | all 62 skills | proved just now (0.1s) | the findings ledger |
| `check:shape` | **yes** | sweep | all 62 skills | proved just now (2.2s) | the findings ledger |
| `check:solver` | **yes** | engine | all 62 skills | every run, no flag | the findings ledger |
| `check:standards` | **yes** | sweep | all 62 skills | proved just now (0.1s) | the findings ledger |
| `check:traffic:rule` | **yes** | route | reads no items | proved just now (0.0s) | the findings ledger |
| `check:traverse` | **yes** | route | reads no items | declared; its plant is fused into the whole browser run, so not run here | the findings ledger |
| `check:vocab` | **yes** | sweep | all 62 skills | proved just now (5.7s) | the findings ledger |
| `check:wayfind` | **yes** | route | reads no items | proved just now (0.2s) | the findings ledger |
| `check:wipe` | **yes** | route | 10 skills (excused) | proved just now (23.8s) | the findings ledger |
| `check:withdrawn` | **yes** | route | 10 skills (excused) | proved just now (71.5s) | the findings ledger |
| `check:compose` | no, with a reason | — | reads no items | proved just now (0.2s) | the findings ledger |
| `check:density` | no, with a reason | — | reads no items | declared; its plant is fused into the whole browser run, so not run here | the findings ledger |
| `check:escape` | no, with a reason | — | reads no items | never — and out of the build | the findings ledger |
| `check:figures:render` | no, with a reason | — | all 62 skills | proved just now (38.4s) | the findings ledger |
| `check:layout` | no, with a reason | — | reads no items | never — and out of the build | the findings ledger |
| `check:lock` | no, with a reason | — | reads no items | never — and out of the build | the findings ledger |
| `check:locklayout` | no, with a reason | — | reads no items | never — and out of the build | the findings ledger |
| `check:mastery:full` | no, with a reason | — | all 62 skills | never — and out of the build | the findings ledger |
| `check:motion` | no, with a reason | — | reads no items | proved just now (0.1s) | the findings ledger |
| `check:progress` | no, with a reason | — | reads no items | proved just now (0.2s) | the findings ledger |
| `check:quality` | no, with a reason | — | reads no items | never — and out of the build | the findings ledger |
| `check:scaffold` | no, with a reason | — | reads no items | never — and out of the build | the findings ledger |
| `check:shopask` | no, with a reason | — | reads no items | never — and out of the build | the findings ledger |
| `check:sustain` | no, with a reason | — | reads no items | proved just now (0.2s) | the findings ledger |
| `check:takeover` | no, with a reason | — | reads no items | never — and out of the build | the findings ledger |
| `check:templates` | no, with a reason | — | reads no items | never — and out of the build | the findings ledger |
| `check:touch` | no, with a reason | — | reads no items | declared; its plant is fused into the whole browser run, so not run here | the findings ledger |
| `check:traffic` | no, with a reason | — | reads no items | proved just now (0.0s) | the findings ledger |
| `check:transient` | no, with a reason | — | reads no items | proved just now (8.8s) | the findings ledger |
| `check:truncate` | no, with a reason | — | reads no items | proved just now (0.3s) | the findings ledger |

Reading it (`node tools/gate-audit.mjs --md --no-fused`, this tree, 2026-08-29): **54 `check:`
scripts, 34 in the build, 20 out of it with a written reason, none unaccounted for**. Of the 34 in
the build, **16 would be red on the shipped route** — a learner meets them today — 15 sweep every
unit including preview, and 3 are not unit-scoped at all. The list of
gates nobody has ever watched refuse anything is down to **two**, `check:items` and `check:marlow`,
each with a written reason in `NO_SELF_TEST`; that list may only get shorter. Fourteen of the twenty
excluded gates are recorded per wave in `progress/gate-runs.json`; the other six each name the
per-wave gate that covers them, and `accountForPerWave` refuses a build where an excuse points at
another excuse.

**And the column that is new: WHO DECIDES WHAT ITS FINDINGS ARE WORTH.** `54 of 54` scripts hand
their verdict to `tools/_findings.mjs`, so the collector and then the runner decide, and no gate can
print a route finding under a zero exit code. That reading is taken off the real module graph —
static imports, and the tools a shell wrapper names — because a list somebody types is the artefact
this whole table exists to replace.

The tree moves under this table, and other lanes were landing gates into it while it was being
measured, so the numbers are a reading and not a constant. `npm run audit:gates` takes a fresh one.
**Taking a fresh one used to cost about eighty minutes**, because three gates FUSE their plant into
the whole browser run rather than putting it behind `&&` — `check:traverse` (minutes),
`check:density` (about thirty) and `check:touch` (about forty) — so "run the self-test" meant "run
the entire browser gate". `node tools/gate-audit.mjs --md --no-fused` runs every self-test that is a
stage of its own and says, in the row itself, that those three were not run here; splitting their
commands at `&&`, the way every other gate is written, is still the cheapest thing anybody could do
and is still undone. What is *not* a reading is the accounting itself: `npm run check` refuses to
start if any `check:` script is in neither list, if a gate in the build says nothing about whether it
has ever refused anything, if an excluded gate is recorded by nothing, or if a gate in the build owns
its own exit code with no reason written down.

The audit found two gates red on this tree that nobody had reported. `check:traverse` — in the build,
route scope — catches all three of its planted defects but fails its own sweep on *"the compass was on
screen to be read: 21 bearings where the tear's own plate had the frame instead"*. And
`check:figures:render`, out of the build, fails on its **clean control**: 18 off-grid numerals on
`graph-linear/gl-plot-points`, where a numbered tick sits 19.9px off the nearest gridline and a cadet
counting squares reads the chart wrong. A gate whose honest case fails is a gate somebody switches off.

#### What `npm run check` says on this tree, 2026-08-29

```
CHECK · red 7 (check:standards, check:mastery, check:shape, check:traverse, check:compose*,
check:touch*, check:quality*) · NOT EVIDENCE ABOUT THIS TREE, route-scope 10 (check:motion:stale,
check:mastery:full:never, check:layout:never, check:traffic:stale, check:takeover:never,
check:sustain:stale, check:progress:never, check:transient:never, check:density:never,
check:truncate:never) · on the shipped route [algebra1-l1 + algebra1-l2], red or unproved: 16 ·
off-route per-wave gates not run since the tree changed 1 (check:figures:render:never)
```

**Exit 1.** Four gates run in that build are red and every one of them is on the route
(`check:standards` 1 finding, `check:mastery` 1, `check:shape` 71, `check:traverse` 2); two more are
a RECORDED per-wave red on the route (`check:compose`, `check:touch`) and one off it
(`check:quality`); `check:scenes` is ADVISORY with 2 preview findings printed in full; and **ten
route-scope per-wave gates are not evidence about this tree** — three green on a tree that has since
moved, seven never run at all. Before this wave the last clause was printed and the build exited 0.

That reading is 32 of the 34 gates in the build: `check:answerable` (14 min) and `check:choices`
(28 min) were run separately on the same tree two hours earlier and both hold **0 findings, exit 0**,
so neither the exit code nor a name in the red list moves. They are named here rather than quietly
left out — a gate missing from a summary is the shape this whole file is about.

**The rule that matters: a builder may not verify its own work through the debug API.** That single
habit hid more defects than any other cause in this project.
**And the rule this wave added, because it is the third time the same thing happened: NO GATE MAY
EXIT 0 WHILE HOLDING A FINDING SCOPED TO THE SHIPPED ROUTE, and that is now structural rather than
a habit.** Three occurrences, three mechanisms, and each of the first two was fixed with a patch to
one gate: `check:mastery` excluded from the build with *"It currently fails on Levels 2 and 4"*
written in the tree as if it were a decision; then, back in the build, a predicate that matched the
CRAM arm while the delivered arm in the same output read `0.0%`; then
`tools/critic/choiceshape.mjs`, which found per-form answer leaks ON THE ROUTE at 50.0% and 48.3%
against a 25% chance, printed every one of them in full, wrote *"the bar this gate enforces is the
surface"* and **returned 0**. Patching the third would have been the fourth patch. `tools/_findings.mjs`
is the fix: a gate declares findings and **the collector owns the exit code**, a route or engine
finding installs an exit guard that rewrites a zero status to 1 no matter what the author writes
afterwards, and the one machine line it prints is re-judged from OUTSIDE the process by
`tools/check-all.mjs`, so a gate that exits 0 over its own route finding is recorded red by the
runner. **52 of 52 `check:` scripts run through it**, and a fourth accounting refuses a build where
one does not without a written reason. The ledger is a floor on severity and never a ceiling: three
gates are stricter than it and stay that way.

**And its twin: "WE DID NOT LOOK" IS NOT "IT IS FINE".** `progress/gate-runs.json` recorded six
route-scope gates that had NEVER been run on this tree — `check:layout`, `check:touch`,
`check:density`, `check:takeover`, `check:progress`, `check:transient`, which between them are every
gate covering touch, layout and the opening ninety seconds, on the phone and the Chromebook this
product is sold for — and `npm run check` printed that list in full and exited 0. Staleness is now
as loud as failure: a route-scope per-wave gate that is `stale` or `never` fails the build exactly
as a recorded red does, and the summary's one line carries it in the same clause.

**And the rule under both of them: A GATE THAT CANNOT PLAY THE GAME CANNOT MEASURE HOW THE GAME IS
PLAYED.** `check:motion` was red for four rounds on a number its own JSON contradicted. Two separate
instrument defects were doing the work: a full-frame RUN CLOSED card that held 967 of its 1,082
seconds while it pressed Escape at it, and an `answer()` that could not press three of the six
surfaces `src/ui/rift.js` draws — one blind click on `.rf-move, .rf-cell, .ans`, which
`src/ui/rift.js:3949` ignores. Every browser gate that judges a sitting now answers through
`tools/critic/_play.mjs`, and `check:motion` PROVES THE INSTRUMENT on the real build before it
measures anything.

**And the rule this wave added: a gate excluded because it fails is not a decision — it is the
defect.** `check:mastery` sat in `NOT_IN_BUILD` with the reason written down as *"It currently fails
on Levels 2 and 4"*, which meant the 80%-mastery promise the product is sold on could not turn
`npm run check` red for a unit that is on the shipped route. It is in the build now, and the way it
handles Levels 3 to 5 is **severity read off `content/courses.json`** — the composed route is hard,
preview is advisory, and promoting a unit into `route.units` makes its run hard on the next build
with no edit to any tool. `npm run check --list` prints the scope of every gate; `node
tools/gate-audit.mjs` prints the whole table with the self-tests actually run.

**And the rule before it: a gate that has never rejected anything is not a gate.** Every gate
this wave added answers `--self-test` — it plants the exact defect it exists to catch, proves the rule
fires on it, and proves the same rule stays quiet on the nearest honest content in the same bank.
That second half is the half that matters — a threshold picked to catch one defect is worthless if
it also catches the twenty skills either side of it, because a gate that fires on honest content
gets switched off.

**And the rule this wave added: a gate that is out of the build for a real reason is still a gate that has to be
run, and somebody has to be able to tell whether it was.** `check:compose` and `check:motion` sat in `NOT_IN_BUILD`
with an honest cost written beside them — nine and eighteen minutes of real play — and both were red on the shipped
route, and nothing anywhere said so. A blind critic re-found both defects by hand, twice, while `npm run check`
printed green. Every excluded gate is now either RECORDED in `progress/gate-runs.json` by `npm run wave` — exit code,
time, and a content fingerprint of the tree it was measured on — or it names the per-wave gate that covers it, and that
coverer must itself be recorded. `npm run check` reads the ledger on every build; **a recorded red on a route-scope
gate fails the build**, and the summary's one line says what is red, which of it a learner meets today, and which
per-wave gates are not evidence about this tree. And the cheap half of an expensive gate belongs in the build: both of
those gates' RULES answer in 0.35 s with no browser, and both are now gates of their own (`check:compose:rule`,
`check:motion:rule`), so the bars cannot be moved without every commit noticing.

**Coverage is the other half.** `SKILLS` is a live view over the content registry, so a tool that
imports `generators.js` and does not load the manifest's packs sees TEN skills of sixty-two and
says "clean" in exactly the same words either way. `check:lang`, `check:scenes` and the choice-set
lab all did. `npm run check --list` names every gate in the build.

---

## Verified status

| | |
|---|---|
| Cold-player critic | **7.5/10, passed** (was 3/10) |
| Teacher / adoption | **8/10, passed** — "I would adopt this, in Texas and in a Common Core state" |
| True mastery (simulated) | **Three numbers, and the one the product was sold on is the one nobody plays.** Composed shipped route, 300 learners × 3600 items, measured 2026-08-28 by `npm run check:mastery`: ONE UNBROKEN SITTING (the cram — everything learned in the last eight hours, nothing carried across a night) **97.0%**; ACROSS DAYS **every day** (22-minute sittings, saved and reloaded, a real night between) **90.7%**; ACROSS DAYS **every third day** **6.7%**. `tools/simulate.mjs` exits **0** on this run, because its own bar is the cram. `check:mastery` now certifies the delivered arm at both cadences and is **RED at 6.7%**. Hollow claims on the daily arm: 5.7% of learners. A week later the three rows read 0.0% / 90.7% / 6.3%. |
| Test-out for a knower | 2.7 min median (**p90 15.4 min — still the gap**) |
| Items | 12,180+ validated, 3 locales, independently re-derived |
| Layout | 288/288 frames clean |
| Perf | 120 fps median fresh — **44.9 fps after 18 min of real play** |
| Motion (does the loop need the world?) | **57.2% moving · 5,293 m · longest park 101 s · 3 of 6 verbs · 87 items**, over 18.4 min from a cleared save on real keys, measured 2026-08-28 by `npm run check:motion` — **and the two readings before it were instruments, not the game.** 3.6% moving was a full-frame RUN CLOSED card holding 967 of 1,082 seconds; 5.5% moving / 793 s parked / 336 items was an `answer()` that could not press three of the six surfaces, so the "items" at that spot were no-ops on a card that never settled. Nobody may quote either. Dash, glide and the build hand were still never used in eighteen minutes. |

---

## Architecture

```
src/core/     engine, input (kbm + pad + touch + pointer-lock-denied fallback)
src/world/    daylight.js is the SINGLE source of sun + time of day; terrain, sky, air, rifts
src/player/   locomotion, rig, animator, camera, glider, recovery
src/build/    grid-snapped lattice; closing a room gives it a door
src/learn/    mastery (BKT + clean-run + spaced review in NIGHTS, not attempts), generators, parser
src/ui/       hud, rift (5 answer modalities), landscape.css + portrait.css (one file per orientation)
src/kit/      capability ladder — mastery buys verbs, not prose
src/meta/     narrative arc; src/session/ the 15–25 min run; src/report/ teacher record
content/      courses as DATA, not code — graphs, standards (CCSS + TEKS), item banks
```

**Learning model.** Per-skill BKT plus three gates: prerequisite gating, unassisted-evidence only,
and spaced re-entry measured in **elapsed nights** (not attempts, so it cannot be ground out in one
sitting). Teaching is a faded worked "echo" of a previous cadet, revealed a line at a time, aimed at
the specific misconception the wrong answer revealed.

---

## RESUME HERE — open work, in priority order

### In flight at the deadline (check the working tree first)
Two waves were running when the window closed. Their work may be partially landed:
- **Wave 15 (P0):** a dead zone at 10–11 m where the objective says "YOU ARE STANDING IN IT" with no
  rift present and `E` a silent no-op (a lost moment — automatic fail); a **hollow mastery claim**
  (a line marked HELD with `formsSeen.vm-table = {seen:3, correct:0}`); two **giveaways** (narrowed
  options list the answer first; the sorter colour-codes tiles to match their bays, solvable by hue);
  and **ten progress numbers that disagree**.
- **AAA wave (time-boxed):** world density between rifts, atmosphere and audio, game feel.

**Run every gate before trusting any of it.**

### Known and unfixed
0a. **THE ANSWER SURFACES LEAK, AND THE GATE THAT FOUND IT HAD BEEN EXITING 0.** `npm run check:shape`,
   measured on this tree 2026-08-29: **71 route findings and 26 preview** (86 route six hours
   earlier — the pedagogy lane is working through them). 25 of the route findings are
   single FORMS over the band inside a surface whose average is inside it — `literal-equations/le-share`
   hands a cadet who plays *"take the ones without a minus sign"* **50.0% against 25.0%** over 144 sets,
   `compound-inequality/cd-band` **48.3%**, `compound-inequality/cd-context` **40.0%** — and a learner
   works one skill at a time, so that is what a whole sitting on those skills is worth. The rest are
   surface-level: the balance move TRAY is the worst instrument in the game (a cadet who has played it
   before and plays "take the reading with the best record" first-picks **42.4% against 20.0%** — the
   whole surface draws only 391 distinct move texts), and the narrowed field's `strike every unique
   extreme at once` is worth +12.4 points on 97% of 10,260 sets. **Owned by the pedagogy lane.** The
   gate is red now and cannot be talked out of it; before this wave it printed every per-form line and
   returned 0.
0b. **A NOTE ON HOW FAST THIS TREE MOVES, because it is why the gates are written the way they are.**
   While this wave was running, another lane landed `src/i18n/typography.js` — a Spanish and Polish
   orphan-word rule that binds a one-letter word to the next with a NO-BREAK SPACE — and for about
   ninety minutes `npm run check:items` was RED with **477 strict-KaTeX findings, 80 distinct, every
   one `es/both-sides/bs-special`**: `typeset('uno funciona, y es mayor que cero', 'es')` put U+00A0
   at index 15, which lands at position 21 inside `\text{…}` and is a hard error in strict mode. The
   file's own header says mathematics is left strictly alone and cuts out every `$…$` and backtick
   span; a whole prose string used as a `\text{}` distractor is not one of those spans.
   `npm run check:i18n` was red at the same time with **108** `content-untranslated` findings on new
   `content/lang/terms.json` rows. **Both are green again on the build below.** Nobody had to be told:
   the gates said so, in the words a person could act on, and the same tree that broke them fixed
   them. That is the whole argument for the ledger — a finding somebody can read is a finding
   somebody fixes.

0. **A CADET WHO PLAYS EVERY THIRD DAY REACHES 6.7% TRUE MASTERY.** Same lattice, same bank, same 3600-item budget,
   same learners; the only difference is the gap between sittings. One unbroken sitting **97.0%**, sittings a day
   apart **90.7%**, sittings three days apart **6.7%** — and a week later 0.0% / 90.7% / 6.3%. Three days is a
   completely ordinary school pattern, and it is the difference between the product working and the product not
   existing. `npm run check:mastery` holds BOTH cadences of the delivered arm to the 80% bar and is red on this;
   `tools/simulate.mjs` itself exits 0, because its own bar is the cram. Whoever takes this: the 24 h and 72 h runs
   differ only in `gapHours`, so the whole of the gap is in the forgetting term
   (`(1 + h/GAP_HOURS·S)^-GAP_POW` towards `PERMA`) and in whether a re-probe lands before a line has decayed under
   the mastery threshold. The sweep already printed in the same output — `perma × exponent`, nine cells — is the
   place to start, and the honest question is whether the schedule can re-probe soon enough at a three-day cadence
   or whether the constants are wrong.
1. **Test-out tail** — p90 15.4 min for someone who already knows the material. Must be shortened
   *without* raising false positives: learners frozen at competence 0.70 already clear 84.3% of the
   time within 25 minutes, which a curriculum director would challenge.
2. **Sustained performance** — 44.9 fps after 18 minutes vs 120 fresh. Something accumulates.
   The benchmark measures a fresh scene; it should measure minute 15.
3. **The world between rifts** — the most repeated criticism across every critic:
   "the arrival frame genuinely competes with a Fortnite screenshot; five minutes later it is a
   worksheet with a wallpaper."
4. **Player agency** — 7 chosen travels versus ~16 takeovers in one session; the shop opened
   full-screen three times unprompted.
5. **Prerequisite violation** — an item from a LOCKED skill was served once.
6. **Workload honesty** — Orders promised "Seal 16 rifts" while the engine planned 24 items.
7. **Template repetition** — 8 of 14 items across two shapes.
8. **Edge recovery is marginal** — passes at ~6.1s against a 6s bar, flaky run to run.

### Product decisions that are yours, not defects
- **More mathematics.** Algebra I Level 2 exists; content is data now, so Algebra II, Geometry and
  Trigonometry are a decision rather than a build problem.
- **Rank and story pacing** — capability is day-gated and cannot be bought by staying up late;
  rank and chapters still can be.

### To resume
Saved workflow scripts are under
`~/.claude/projects/-Users-harrison-dev-math-aadmath/*/workflows/scripts/`.
The pattern that works: builders in disjoint lanes, then **blind critics that never see a builder's
summary and may not use the debug API**, each required to verify the specific gap the last critic
named before judging anything new.
