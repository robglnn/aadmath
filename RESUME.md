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
npm run check                         # content + language + i18n gates
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
| `tools/validate-items.mjs` | Every answer re-derived by an **independent solver**, strict KaTeX, misconception tags, standards alignment. | Answers were once correct only "by construction". |
| `tools/check-i18n.mjs` | No hardcoded English in `src/` **or `content/`**. | 17 English paragraphs sat on a Spanish report while the gate said "every string comes from src/i18n". |
| `tools/check-language.mjs` | Sentence length, passive voice, terms used before definition. | The ASD-STE100 + ADHD standard. |
| `tools/simulate.mjs` | Monte-Carlo over synthetic learners: mastery, quintiles, hollow claims, time-to-clear. | The 80%-mastery promise needs evidence. |

**The rule that matters: a builder may not verify its own work through the debug API.** That single
habit hid more defects than any other cause in this project.

---

## Verified status

| | |
|---|---|
| Cold-player critic | **7.5/10, passed** (was 3/10) |
| Teacher / adoption | **8/10, passed** — "I would adopt this, in Texas and in a Common Core state" |
| True mastery (simulated) | 99.8%; lowest ability quintile 89.3% |
| Test-out for a knower | 2.7 min median (**p90 15.4 min — still the gap**) |
| Items | 12,180+ validated, 3 locales, independently re-derived |
| Layout | 288/288 frames clean |
| Perf | 120 fps median fresh — **44.9 fps after 18 min of real play** |

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
