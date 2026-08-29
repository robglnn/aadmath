# THE ARCHIPELAGO PATTERN

**An anatomy of `src/world/caches.js`, and the transferable rules that follow from it.**

This is a design study, not a build. It exists so the next wave can build five more kinds of
off-island site that work for the reasons the hanging caches work, rather than five more that
look like them.

The claim under test is one sentence from the file itself:

> *There is no keypad, no multiple-choice card and no sentence of instruction in any of that.
> The mathematics is something you do with your feet.*

That claim is true. It is also narrower than it sounds, and the narrowness is the useful part.

---

## 0 · WHAT WAS ACTUALLY MEASURED

Nothing below is read off the source alone. A frozen production build was served on its own
port and driven by Playwright from a **cleared save**, with real key events only — `W`,
`Shift`, `Space`, `G`, `S`, and the arrow keys for the view. No `teleportTo`, no
`openRiftById`, no scripted state change. `window.__ascent` was read for facts (where a cache
is, what the beam is holding) and never used to make the game do anything.

The route flown was the one the file describes: run the bearing, climb the ridge, leave the
ground, open the wing, land on the perch. Console errors across every run: **0**.

| stage | shot |
|---|---|
| cleared save, first light | `design/shots/00-arrival.png` |
| turned toward the cache from the landing plaza | `design/shots/01-facing-out.png` |
| the route costs you — a fall into a ravine on the way out | `design/shots/02-the-route-costs-you.png` |
| under the wing, statement and weights already legible | `design/shots/03-inbound-glide.png` |
| standing on the deck | `design/shots/04-on-the-perch.png` |
| the balance at rest, holding the claim | `design/shots/10-perch-unloaded.png` |
| a LARGE error (`x := 6`, 13 against 7) — the beam hard over | `design/shots/11-tilt-big-error.png` |
| the same slam, held | `design/shots/12-tilt-big-error-held.png` |
| 1.5 s later: the statement restored, that weight struck out | `design/shots/13-after-reset.png` |
| a SMALL error (`x := 4`, 9 against 7) — the beam off by a little | `design/shots/20-tilt-small-error.png` |
| level, the monolith opening, +120 motes | `design/shots/14-level-open-and-paid.png` |
| the updraft it just paid picks the cadet up off the perch | `design/shots/16-cache-open.png` |
| …and carries him back over the island | `design/shots/21-carried-off-by-the-reward.png` |

---

## 1 · THE MECHANISM, BEAT BY BEAT

### What the body does, and what the world does back

**1. You see a mark, not a site.** A 120 m cone of additive light stands *above* the apparatus —
`shaftGeo.translate(0, 68, 0)`, deliberately, "a mark you can see from the far coast must not be
a fog bank standing on the thing you came for". Past `TILE_RANGE = 170` m the pans are not laid
out at all; the site is a silhouette with a light over it. You are told *there is something out
there*, and nothing else.

**2. You decide.** Nothing sends you. `createCaches` is handed `scene, uiRoot, player, builder,
hud, wallet, drift, audio, fx, isBusy` — no `mastery`, no `session`, no `graph`, no objective.
This is the only mathematics in the game a learner arrives at because they chose to.

**3. You have to leave the ground.** The perch hangs at `LIFT[i]` metres relative to the *highest
ground on its own bearing*: `[-16, -9, 3, 17, 34]`. That ladder is not decorative — it is the
glide ratio of the wing, tiered:

Solving the wing's own equilibrium (`dv/dt = −g·sin γ − k·v²`, `g = 26`) at each trim:

| wing | `glideBase` | `glideDrag` | trim speed | sink | glide ratio | reaches |
|---|---|---|---|---|---|---|
| base — everyone, from boot | −0.13 | 0.016 | 14.5 m/s | 1.88 m/s | **1 : 7.7** | LIFT −16, −9 |
| KITE TRIM — mastery grant 3 | −0.055 | 0.0115 | 11.1 m/s | 0.61 m/s | **1 : 18.2** | +3, +17 |
| LONG SPAN — mastery grant 9 | −0.042 | 0.0092 | 10.9 m/s | 0.46 m/s | **1 : 23.8** | +34 |

Those three numbers are the reason `LIFT` reads `[-16, -9, 3, 17, 34]` and not five round numbers.
`kit.js` states the same ladder from the other end: *"KITE TRIM — the wing. About 1:7 to about
1:18."*

**Measured, not modelled.** Cache 1 (`LIFT −9`) was reached on the base wing from a cleared save,
twice, by two different routes. Once by running the bearing over the ridge and gliding the last
leg flared — **36.4 m of run for 2.5 m of drop** — landing on the deck at 56.2 m with `dy = 0.0`.
Once by the ridge's own natural updraft, which lifted the cadet **11 m above the deck** and turned
the arrival into a descent he had to fly down onto. Caches 3 and 4 sit +17 m and +34 m above the
highest ground on their bearings and are out of reach on a 1 : 7.7 wing without an updraft a
previous cache paid for.
*The site's altitude is a second difficulty curve, denominated in a kit grant.*

**4. You land on real floor.** The perch registers **25 `floor` solids** into `builder.solids` —
`SPAN = 2`, so a 5 × 5 block of `CELL = 4 m` cells, a 20 m deck — `fixed: true` so they cannot be
cleared out from under you, on exactly the same lattice as a floor you set yourself. You can
stand on it, build off it, and launch from it. *It is a place before it is a puzzle.*

**5. The statement comes down to meet you.** Every label carries two anchors and rides between
them on `descend = clamp((52 − d) / (52 − 24))`. Far out, the statement floats at local
y = 8.2 over the rig; on the deck it sits at y = 4.2, at local z = +2.8 — directly over the
counterweights. The comment records the defect that produced this: *"from the perch the equation
was seven metres overhead and off-screen, and from far enough back to read it the weights were
chips."* The counterweight radius went 0.62 → 0.92 for the same reason. **The read-band and the
act-band are the same band at every distance you can act from.** `03-inbound-glide.png` shows the
statement and all three weights legible while still under the wing.

**6. You walk into one.** This is the entire input surface of the file:

```js
if (_p.distanceTo(player.pos) < TOUCH) choose(c, s);      //  TOUCH = 2.2
```

`grep -n "interact|KeyE|keydown|addEventListener" src/world/caches.js` returns **nothing**. There
is no key, no prompt, no menu, no panel. Position is the only input the site accepts.

**7. The pans do the arithmetic in front of you.** Before any verdict, `layout(c, stone.v)` runs.
Every unknown tile is replaced by that many unit tiles — *on both pans at once*:

```js
lay(c.load, -2.8, -1.5, a * v + b, 'unit');
lay(c.load,  2.8, -1.5, rc * v + rd, 'unit');
```

Measured, on `2x + 1 = 7` with weight 6 taken: the load goes from **2 x-tiles + 8 units** to
**0 x-tiles + 20 units**, split 13 against 7. Substitution is not notation here. It is a physical
event you watch happen, and `c.settle = 1.1` holds the state long enough to read it.

**8. The beam does what a beam does.** `want = clamp(diff × 0.055, ±0.46)`, and `roll` chases it
through an under-damped spring (`rollV += (want − roll) × 30 × dt`, damped `exp(−6 dt)`). The
overshoot is the point: the measured peak exceeded `want` by 8–16 %, which is what makes it read
as a *slam* rather than a lerp.

---

## 2 · WHERE THE MATHEMATICS IS

**Name the thing on screen that IS the equation: it is the beam, not the label.**

| in the notation | on screen | file |
|---|---|---|
| `=` | the beam's level rest position | `c.want = 0` at rest |
| `a·x` | `a` tall violet tiles, 0.62 m, `XCOL 0xb489ff` | `lay(..., a, 'x')` |
| `b`, `c` | small cyan cubes, 0.32 m, `UCOL 0x74e2ff`, one per unit | `lay(..., b, 'unit')` |
| substituting `x := v` | each x-tile becomes `v` cubes, on **both** pans | `layout(c, v)` |
| evaluating a side | the number of cubes on that pan | `c.left`, `c.right` |
| "is it true?" | the beam's angle | `diff === 0` |
| "how false, and which way?" | the size and sign of the tilt | `diff × 0.055` |

Two consequences worth stating plainly.

**The rest state is the claim.** At rest the pans hold *unlike* things — two tall violet tiles
and one cyan cube on the left, seven cyan cubes on the right — and the beam is nonetheless dead
level (`10-perch-unloaded.png`). That level beam is an *assertion*: this statement is true, for
some `x`. You are not being asked a question. You are being shown a claim and asked to make it
good. That is a different posture from a quiz, and it is entirely carried by the geometry.

**Known and unknown are different kinds of object, not different glyphs.** An x-tile is twice
the size and a different colour from a unit cube. A learner who cannot read `2x + 1 = 7` can
still see *two of the big ones and one of the little ones against seven little ones*, and can
still count. The notation is a caption on a working apparatus.

---

## 3 · WHAT BEING WRONG FEELS LIKE

Wrong is not a buzzer. It is a **signed, scaled, countable world state**, and the learner reads
three separate facts off it without a word of text.

Measured on `2x + 1 = 7` (`x = 3`, weights `4 / 3 / 6`):

| weight taken | the misconception it is | pans | `diff` | `want` | measured peak `roll` | shot |
|---|---|---|---|---|---|---|
| **4** | divided, never subtracted (`round(c/a)`) | **9** vs 7 | +2 | 6.3° | **7.3°** | `20-tilt-small-error.png` |
| **6** | subtracted, never divided (`c − b`) | **13** vs 7 | +6 | 18.9° | **20.4°** | `11-tilt-big-error.png` |
| **3** | — | **7** vs 7 | 0 | 0° | 0° | `14-level-open-and-paid.png` |

Three channels of information, none of them prose:

1. **Direction.** Which pan went down says which side is heavier — which way you were wrong.
2. **Magnitude.** `0.055 rad` per tile of imbalance = **3.15° per unit**, saturating at 8.4 units
   (`±0.46 rad`). Three times the error gives very nearly three times the tilt. A learner who
   takes 4 sees *nearly right*; a learner who takes 6 sees *nowhere near*. **The world is grading
   the kind of error, not just the fact of it.**
3. **Quantity.** The pans are still holding the substituted tiles when the beam settles. You can
   count nine cubes against seven, or thirteen against seven, and read off *by how much*. That is
   a diagnostic delivered as a number of objects, in the units of the problem.

And the reason all of that means anything: **the wrong weights are not distractors, they are the
two named errors of this exact procedure.**

```js
const wrongA = c - b;                 // never divided
const wrongB = Math.round(c / a);     // never subtracted
```

So the picture on the beam is a picture of *your own mistake*. Take the "never divided" weight
and the pan is heavy by `a·x − x` — the whole coefficient you failed to remove, standing there as
cubes. Nothing tells you that. You are looking at it.

**The honest limit on this, and it is a real one.** At tier 1 both wrong weights are always
`≥ x` — `c − b = a·x > x` for `a ≥ 2`, and `round(c/a) = round(x + b/a) ≥ x`. So the left pan is
*always* the heavy one, and a tier-1 cache can only ever say **TOO BIG**. The sign channel is
dead at tier 1 and only wakes on a deep cache, where `wrongSide = (d − b)/(a + rc) < x` puts the
right pan down for the first time. A learner who never reaches a deep cache never learns that the
beam can fall the other way. Compare `src/world/warden.js`, which prints "TOO SMALL BY EIGHT" —
it uses both signs from the first encounter.

---

## 4 · WHAT IT COSTS TO BE WRONG, AND WHY THAT MAKES YOU THINK

The cost is exactly one thing: **that weight is gone.**

```js
stone.spent = true;                                  // the object goes grey and inert
hud?.flash?.(t('field.balanceNo'), 'bad');           // "The beam refuses it"
setTimeout(() => { c.want = 0; layout(c, null); }, 1500);   // the statement comes back whole
if (c.stones.every((s) => s.spent))
  setTimeout(() => { for (const s of c.stones) s.spent = false; }, 3200);  // and re-form
```

What it does **not** cost, verified by reading the wallet across the run: **nothing**. There is no
`wallet.take` anywhere in the failure branch. Motes went 70 → 190 across the whole visit; a wrong
answer moved the counter by zero. That is the ledger's rule enforced here — *"a wallet must never
empty for a reason the player did not choose"* — and it is why a miss is survivable enough to be
worth risking.

It also does not cost the question. 1.5 s after the slam the pans are back to `2 x-tiles +
8 units` and the beam is level again (`13-after-reset.png`). The *problem* is intact; only the
*wrong answer* is gone. And when all of them are spent, all of them come back. **Nobody is ever
locked out.**

So the cost is a **narrowing**, and the pressure it creates is not fear of punishment. It is
this: the field of possible answers is visibly shrinking, the spent ones are struck through in
front of you, and you are standing on a rock 195 m from the island's centre — some 39 m past the
coastline on that bearing — that you had to fly to. The stake is the trip, not the wallet.

**Where that argument is weakest, and it must be said.** Three weights, free re-forms, and a
failure state that tells you which way you were wrong means brute force *works*: two misses and
the third weight opens it. And a player who takes one miss and reads the tilt can compute the
answer from the tilt without ever doing the algebra. That is a feature of a good tutor and a
defect of an assessment — which is exactly why a cache must never be asked to carry a mastery
claim (see §7).

---

## 5 · WHY IT IS OFF THE ISLAND

The client's one line — *"I kinda like that it's something off our main island"* — is about the
going, not the arriving. Six separate things the separation buys, in rough order of importance:

**1. Traversal becomes the price of admission, and traversal is the part of this game that is
already good.** The mathematics is not a toll booth bolted onto a reward loop. The flight *is*
the reward loop, and the mathematics is what is at the end of it. This is the single structural
difference between a cache and a rift, and it is the whole of the client's sentence.

**2. It is the only elective mathematics in the build.** No scheduler sends you. `createCaches`
receives no `mastery`, no `session`, no `graph`. Set against the standing criticism — *7 chosen
travels versus ~16 takeovers in one session* — a cache **cannot** take over: it has no panel, it
opens no surface, and `isBusy()` is consulted only to make it get out of the way.

**3. A silhouette against sky is a composable frame; a hillside is not.** The perch hangs on a
16 m keel and, for a deep cache, is forced to `ground + 24` — explicitly *"or it reads as scenery
rather than as somewhere you have to reach"*. With nothing behind the pans, thirteen cubes
against seven is legible at 40 m (`03-inbound-glide.png`). The same rig on a meadow is a prop.

**4. Distance is a second difficulty axis that is not the mathematics.** `LIFT = [-16, -9, 3, 17,
34]` tiers the five sites by *reachability*. A learner who cannot yet solve `4x + 8 = 28` can
still fly to a site and try; a learner who can solve it but has no wing cannot reach site 4.
Difficulty of *getting there* and difficulty of *the sentence* are decoupled, which is what lets
one apparatus serve a whole ability range.

**5. It makes the reward legible as a change to the world.** `drift.addColumn(c.x, c.z, 78, 8.4,
true)` plants a permanent updraft **at the perch you just reached**. Verified: after the open, a
new drift column exists at exactly `(64, 184)` — the cache's own coordinates. The hard place you
reached once is a launch pad for ever, and the next site out is now reachable because you cracked
this one. Off-island is the only place where *reward = access* can be literally true.

**6. It survives the session.** `localStorage['ascent.caches']` keeps `opened` and every deep
cache's position and seed. An opened cache stops advertising itself (`c.mark.visible = false`) —
the updraft it planted is the landmark now. The map remembers what you did.

---

## 6 · WHAT IS SPECIFIC TO A LINEAR EQUATION, AND WHAT IS GENERAL

### Specific — and therefore not portable

- **The numbers have to be small, whole and positive.** `a ∈ 2..4`, `x ∈ 2..7`, `b ∈ 1..8`,
  `c ≤ 30`; `uniq()` rejects anything `≤ 0` or `> 34`; `lay()` caps at 6 x-tiles and 34 cubes.
  A pan cannot hold "minus three", or "two thirds", or "one hundred and twenty-eight".
- **Both sides have to be additive quantities of one dimension.** A pan adds. That is all it does.
- **`a·x` has to mean "a copies of x"**, or the one-for-one tile substitution is a lie.
- **Wrongness has to have a sign and a magnitude in the units of the quantities**, or a tilt has
  nothing to express.

### General — the seven things that actually carry

1. **The relation symbol is a mechanism whose rest state is the claim.** Level = equal.
2. **The unknown is a distinct kind of object**, and committing to a value **replaces** it, in
   front of you, on every side at once.
3. **The candidate answers are placed objects you move your body to.**
4. **Wrong is a continuous world state, not a boolean.**
5. **The wrong candidates are the named misconceptions**, so the world state you are looking at
   is a portrait of your own error.
6. **The payment is access, planted where you earned it.**
7. **Reaching the site is a second difficulty, denominated in a traversal verb.**

### Where each carries — concretely

| target | the mechanism the seven rules imply | already built? |
|---|---|---|
| **inequality** (`3x + 2 ≤ 11`) | a beam **with a stop under one pan**. `≤` is a beam that must come to rest *on* the stop. The wrong weight is the one that lifts it off. Sign and magnitude both live. | no |
| **system of two** (`2x + y = 7`, `x − y = 2`) | **two beams that share their x-tiles.** Load a value on one and it appears on the other. Both must go level at once, and you can watch one go level while the other slams. | no |
| **quadratic / completing the square** | not a balance — **an area.** `x² + 6x` is a square tile and six rectangles; completing the square is *arranging them into a square and seeing what corner is missing*, and you fly the missing corner in. | half — `src/world/span.js` does `a(b+c)` as a rectangle |
| **function** (`f(3)`) | not a balance — **a machine with an input rank and an output rank.** Stand on an input stone; the output stone lights. Domain and range are *which stones exist*. | no |
| **data / residual-and-fit** | a balance again, and a very good one: **the sum of the positive residuals against the sum of the negative ones.** The line of best fit is the one where the beam goes level. The candidate "answers" are lines you fly along, and the gaps hang off the points as tiles. | no |

Two of those five (inequality, systems) are the *same* apparatus with one part added — which is
exactly the relationship a deep cache has to a shallow one (`a·x + b = c·x + d`: same pans, same
slam, one more mistake available, four weights instead of three). The other three are different
apparatus that keep the seven rules. **That is the correct shape of the next wave: two variations
and three new machines, not five more balances.**

---

## 7 · WHAT IT DOES NOT DO

### The limits of the apparatus itself

**a. It cannot hold a negative, a fraction, or a large number.** This is not tuning. A pan holds
counted objects. `-3x + 7 = 22`, `x/3 + 2 = 5`, `2^3 · 2^4` have no physical form here.

**b. Its answer space is three or four values.** It cannot ask for an expression, a rule, a
graph, a region, or a proof — unless the candidates have *shape*, which is the span's whole
insight and which the caches do not use (see below).

**c. It checks a value; it never sees the working.** `multi-step`, `both-sides`,
`complete-the-square`, `quadratic-formula` are all *procedures*, and a value check cannot tell
"solved it" from "recognised it" from "took a miss and read the tilt". Note the duality with the
rift's own balance modality, which is the exact inverse: **there you choose the MOVE and the world
guarantees the truth; here you choose the VALUE and the world reveals the truth.** They teach
different halves of the same idea and neither substitutes for the other.

**d. It is one question, for ever.** `dice(seed)` is deterministic: a cache asks the same
sentence on day one and day thirty. Five caches is five questions. `hang()` fixes the *count*
(the island grows one more every time a warden is bound, up to `DEEP_MAX = 12`) but not the
*repeatability* — you cannot practise at a cache.

**e. It banks no evidence.** `createCaches` never touches `mastery`. Nothing done at a cache
moves the knowledge graph, appears in the teacher record, or changes the session plan. Two
readings: (i) deliberate and correct, because a site that tells you which way you were wrong
cannot produce *unassisted* evidence; (ii) a hole, because the report currently cannot say that a
learner solved `2x + 1 = 7` with their feet at all. **Recommendation: sites should emit an
observation flagged `assisted`, so the record is complete and the mastery claim stays honest.**

**f. Two defects found by playing it, not by reading it.**

- **The answer can be given by accident.** Reproduced in two independent runs: crossing the deck
  from one counterweight toward another passes within 1.0–1.7 m of the middle one and commits.
  The three stones sit on one 7.2 m rank (`gap = 3.6`) with `TOUCH = 2.2` measured to the feet
  while the stone hovers at 1.46–1.94 m, so the horizontal capture radius is 1.04–1.65 m. At tier
  1 the discs just miss each other (2 × 1.65 = 3.3 < 3.6). **On a deep cache `gap = 2.9`, so they
  overlap by up to 0.4 m** — and which of two overlapping answers fires depends on the phase of
  the bob (`ph = k * 1.7`) and on array order, not on where the player stood.
- **The reward overwrites the moment it is paying for.** The updraft is planted at `(c.x, c.z)` —
  under the cadet's own boots — and picks him up within a second or two of the win. In both runs
  he was airborne and back over the island before he could look at the level beam
  (`16-cache-open.png`, `21-carried-off-by-the-reward.png`). The resolution beat of the best
  mechanic in the game is being cut off by its own payment.

**g. One line of dead CSS.** `.field-tag.won` in `src/world/field.css` is never applied. Both
`caches.js` and `span.js` set `stack.won = true` / `stone.won = true` on the object, but
`rebuildTags()` only ever writes the `spent` class, and it skips opened sites entirely. The
winning answer never gets its green frame.

### Which of the 62 skills could never be a hanging cache

The question is narrow on purpose: **not "could this be a site", but "could this be a balance with
counterweights".** That form needs an answer which is a *small positive whole number* and a
statement made of *countable additive quantities*. Sorting all 62 by that test:

**FITS THE BALANCE — 18.** `one-step-add`, `one-step-mul`, `two-step`, `multi-step`\*,
`both-sides`, `bracket-both-sides`, `eval-expr`, `order-ops`, `ratio-proportion`,
`inequality-one-step`\*\*, `inequality-two-step`\*\*, `inequality-multi-step`\*\*,
`system-substitution`\*\*\*, `system-elimination`\*\*\*, `sequence-terms`,
`quadratic-zero-product`, `square-root-method`, `solve-by-factoring`.
<br>\* value fits, but the *skill* is "simplify each side before you undo", which a value check
cannot see. \*\* needs the beam with a stop. \*\*\* needs two coupled beams.

**NEVER — THE ANSWER IS NOT A COUNTABLE POSITIVE WHOLE — 10.** `fraction-solve`,
`radical-simplify`, `radical-arith`, `rational-exponent`, `zero-negative-exponent`,
`exponent-product`, `exponent-power`, `exponent-quotient`, `exponential-rule`, `quadratic-formula`.
*A pan holds counted objects and nothing else. `2^3 · 2^4` is 128 cubes; the site caps at 34, and
it caps there for a reason — past about thirty objects a pan stops being countable and becomes a
texture. There is no counterweight for `3√2`, for `−4`, or for `x/3`.*

**NEVER — THE ANSWER IS A RULE, NOT A VALUE — 10.** `literal-equations`, `write-linear`,
`point-slope-form`, `sequence-nth-term`, `quadratic-from-vertex`, `write-system`, `poly-add-sub`,
`poly-divide`, `parallel-perpendicular`, `exponential-model`.
*A counterweight carries a number. Three candidate **rules** printed on three identical stones is
a multiple-choice card with a view — the exact thing this document exists to forbid. A rule can be
a physical object only if it has a shape you can see before you commit (Rule 2), and these have
none. `literal-equations` resists even a different machine, because its subject is symbolic
rearrangement with no quantity attached to rearrange.*

**NEVER — THERE IS NOTHING TO WEIGH — 1.** `var-meaning`.
*And the irony is worth stating: a cache **teaches** `var-meaning` better than anything else in
the build — the x-tile IS the definition, and watching two of them become six cubes is the whole
idea — and it cannot assess it at all.*

**NOT A BALANCE, BUT A DIFFERENT MACHINE THAT KEEPS THE SAME TEN RULES — 23.** `like-terms`
(bays: a number will not fit in the x-bay), `distribute` (area — **already built**, `span.js`),
`poly-multiply`, `factor-common`, `factor-trinomial-monic`, `factor-trinomial-lead`,
`difference-of-squares`, `complete-the-square` (all area), `function-notation`, `domain-range`,
`relation-is-function`, `rule-from-table` (a machine with an input rank and an output rank),
`slope-rate`, `graph-linear`, `system-graphically`, `parabola-features`, `quadratic-model`,
`linear-vs-exponential`, `inequality-two-var`, `compound-inequality`, `scatter-regression`,
`residual-and-fit`, `association-strength` (a line or a region you fly).

**The headline the next wave has to accept.** **18 of 62** fit the proven apparatus, and they are
the first 18 — Level 1 and the front of Level 2. **23 of 62** need a *different machine that keeps
the same ten rules*, and a third of those are the area form `span.js` already half-built.
**21 of 62 cannot be an off-island site of this family at all** — and that is not a failure of
imagination, it is where notation stops standing for quantity. Those 21 belong in the rift, and
the rift is not a lesser place; it is the other half of the design.

**Five more balances would add nothing.** That is the whole finding.

---

## 8 · THE PATTERN LANGUAGE

Ten rules. Each is a **test you can fail a design against before a line of it is written**, and
each names the thing it forbids. A site that fails any one of them is a quiz with a view.

**How to use it.** Walk the ten in order for any proposed site and write `pass` / `partial` /
`fail` with a reason next to each — the table in §9 is that exercise done for the six sites that
already exist. A `fail` on Rules 1, 2 or 4 is disqualifying: those three are what separates this
family of sites from a card with a background. A `fail` on 6 or 10 is a safety failure and is
worse. Rules 7, 8 and 9 are what make anybody go there twice.

---

### RULE 1 · POSITION IS THE ONLY INPUT

**Constraint.** The site accepts nothing but where the player's body is. No key, no click, no
menu, no typed value, no hovering, no confirm.

**Test.** Delete every keyboard and pointer handler from the site's module. It must still be
completable. (`caches.js` passes trivially: it has none. Its entire input surface is
`if (_p.distanceTo(player.pos) < TOUCH) choose(c, s)`.)

**Forbids.** A stone you walk to and then press `E` on. A floating card with three buttons. A
plinth with a keypad on it. Any surface that takes the frame — the moment a site opens a panel it
has become a rift with scenery.

**Corollary you must design for.** If position is the only input, **position is also a
commitment you cannot take back**, and the player must never be able to answer by walking past.
Every pair of candidate regions must be separated by more than **twice the horizontal capture
radius** along *every* path a player can walk between them, or the candidates must be approached
from outside their own rank. The caches fail this: reproduced twice, walking across the deck from
one counterweight toward another commits an answer the player did not choose, and on a deep cache
the four capture discs overlap.

---

### RULE 2 · THE APPARATUS IS THE SENTENCE

**Constraint.** Every symbol in the statement has a body on screen that behaves the way the
symbol behaves, and the relation symbol is a *mechanism* whose rest state is the claim being made.

**Test A — THE COVER TEST.** Hide every DOM label the site draws. A player who cannot read the
notation must still be able to solve it. At a cache the *statement* passes — two big violet tiles
and one small cyan cube against seven small cyan cubes is countable — and level-versus-tilted is
the whole of `=`.

**Test B — THE DESCENT TEST.** At 40 m, at 24 m and at 2 m, the thing the player must read and
the thing the player must touch are in the same frame and both legible. (`caches.js`: two anchors
per label, `descend = clamp((52 − d)/(52 − 24))`, label riding from over the rig down onto the
weights. The counterweight radius went 0.62 → 0.92 for the same reason.)

**Forbids.** `src/world/waygate.js`, which is a good place and a weaker apparatus. Its lintel
prints `x = 6` and `2x + 5` as DOM tags and its four road stones are plain cylinders with numerals
tagged onto them. Nothing in the gate embodies the multiplication. Hide the tags and it is
unsolvable — it fails Test A while passing Rule 1. It is the exact halfway house this pattern
language exists to catch.

**Where the caches themselves half-fail it.** The *statement* passes the cover test; the
*candidates* do not. The three counterweights are identical octahedra distinguishable only by the
numeral on a DOM tag. The mathematics lives entirely in the consequence, never in the object.
`src/world/span.js` is the better version of this exact joint: its three candidate stacks are
**laid out in the shape their own expression describes** — the true one is two blocks, `a×b` beside
`a×c`, which is the plot cut along its own seam; the false ones are the shapes the two commonest
mistakes actually make. **Build candidates that differ from each other in a way you can see
before you commit.**

---

### RULE 3 · THE WORLD SHOWS ITS WORKING BEFORE ITS VERDICT

**Constraint.** Between commitment and verdict there is a visible, held state in which the
computation has been *carried out* and the player could still predict the outcome themselves.

**Test.** Freeze the frame 200 ms after the player commits. The substituted quantities must be on
screen and the verdict must not have arrived yet. Measured at a cache: `layout(c, stone.v)` runs
first and replaces every unknown tile with that many unit tiles on **both** pans; `c.settle = 1.1`
holds it; the beam's spring then takes ~0.5 s to reach `want`.

**Forbids.** Instant green tick / red cross. A stone that lights and a door that opens. Any site
where the interval between "I chose" and "I was told" is zero — because that interval is the only
place the teaching can happen without text.

---

### RULE 4 · WRONG IS SIGNED AND SCALED

**Constraint.** The failure state carries *direction* and *magnitude*, in the units of the
problem, with no words.

**Test.** Two different wrong answers must produce two visibly different world states, and the
difference between the states must track the difference between the errors — monotonically, and
close to proportionally. Measured: an error of +2 tilts the beam **7.3°**, an error of +6 tilts it
**20.4°** — 3× the error for 2.8× the tilt, the gap being the spring's overshoot. `0.055 rad` per
unit, saturating at `±0.46 rad` so a wildly wrong answer still reads instead of leaving the frame.

**Forbids.** A shake and a red flash. "Try again." A buzzer. Any failure that looks identical for
every wrong answer — because then the player learns only *that* they were wrong, which they
already knew.

**And use both signs from the first encounter.** A tier-1 cache can only ever say TOO BIG, because
both its distractors are arithmetically `≥ x`. Half the channel is dead until a learner reaches a
deep cache. `src/world/warden.js` gets this right ("TOO SMALL BY EIGHT"). A new site must generate
at least one distractor on each side, or state in its own header why it cannot.

---

### RULE 5 · EVERY WRONG CANDIDATE IS A NAMED MISCONCEPTION

**Constraint.** Each wrong option is the output of one specific, documented error in the taught
procedure, and the module says which one in a comment beside the line that produces it.

**Test.** For each wrong option, name the step of the method it skipped. If you cannot name it, it
is noise and it must be removed. (`caches.js`: `wrongA = c − b` *never divided*; `wrongB =
round(c/a)` *never subtracted*. Deep tier: `wrongSign` *added when the sign said subtract*,
`wrongSide` *collected the unknowns on the wrong side*, `wrongDiv` *both steps right and then
forgot to divide*.)

**Forbids.** `answer ± 1`. A random number in range. A distractor chosen because it "looks
plausible". Options that are all correct-shaped — a learner who takes one learns nothing about
themselves.

**Why this rule and Rule 4 are one rule.** Because the tilt is proportional, the *size of the
world's reaction is a portrait of which mistake you made*. Take "never divided" and the pan is
heavy by exactly the coefficient you failed to remove, standing there as cubes you can count.
Neither rule does that alone.

---

### RULE 6 · A MISS NARROWS; IT NEVER TAXES, AND IT NEVER LOCKS

**Constraint.** A wrong answer costs one candidate and nothing else. It does not cost currency,
progress, mastery, or the route. The field always re-forms.

**Test.** Play the site to exhaustion. At the end the player must be able to try again, holding
the same information or more, with the wallet unchanged to the mote. (Measured: no `wallet.take`
in the failure branch at all; the statement is restored at 1500 ms; every weight re-forms at
3200 ms.)

**And the trade this rule buys.** Because a miss is free and the failure state is diagnostic,
brute force works — two misses and the third weight opens it — and one miss plus a reading of the
tilt is enough to compute the answer without doing the algebra. That is the correct behaviour for
a *tutor* and disqualifying for an *assessment*. Rule 10 is where that debt is paid.

**Forbids.** −10 shards. Three lives. A gate that actually shuts (see `waygate.js`'s own header:
*"a gate that could actually stop somebody would be the exact defect this whole lane exists to
remove… Nothing in this world may ever cost you the route"*). Any state a learner can reach from
which the only exit is to walk away.

**The stake is the trip.** With no wallet cost and free re-forms, the pressure to think is not
fear of punishment — it is that the visible field of answers is shrinking and you flew out past
the coast to get here. That is enough, and it is the only kind of pressure that is safe to apply
to somebody who is learning.

---

### RULE 7 · A PLACE BEFORE A PUZZLE

**Constraint.** The site stands on real, standable, buildable-from ground, registered in the same
solid registry as the player's own build lattice, and it is somewhere worth going *after* it is
solved.

**Test.** Strip the mathematics out completely. What is left must still be somewhere a player
would fly to. (A cache perch is 25 `fixed` `floor` cells — a 20 m deck on a 16 m keel, hanging
clear of the ground so it reads as a destination and not as scenery; and once solved it is a
permanent launch pad.)

**Forbids.** A puzzle floating in the air with no floor. A site that despawns when solved. An
exhibit behind glass. A "challenge room" you are teleported into and out of.

---

### RULE 8 · THE PAYMENT IS ACCESS, PLANTED WHERE IT WAS EARNED

**Constraint.** What the site pays must permanently change what the player can reach, at the spot
where they earned it.

**Test.** Screenshot the skyline before and after. If the world looks identical, the reward is a
number and the site has not paid. (A cache plants a standing updraft at its own coordinates —
verified, a new drift column at exactly `(64, 184)` — worth 90 motes on its own, since that is
what one costs to plant by hand, on top of 120 motes paid, against a mote economy deliberately
capped so a hillside cannot be farmed. A span pays a **road**, which is the more legible version
of the same idea: *"an updraft is a column of light out at sea; a road is a road."*)

**Forbids.** Shards only. XP. A cosmetic. A paragraph of story. A badge.

**But the payment must not cut off the moment it is paying for.** Verified defect: a cache plants
its updraft under the cadet's own boots and lifts him off the perch within a second or two of the
win, so he never gets to stand and look at the level beam. Plant the reward with a delay, or
offset, or a lead-in the player triggers.

---

### RULE 9 · GETTING THERE IS A SECOND, INDEPENDENT DIFFICULTY

**Constraint.** The site's position is tiered against the traversal kit the player has earned, so
that *where it is* carries difficulty without changing *what it asks*.

**Test.** State the site's access requirement as a number in the same units as a kit grant — a
glide ratio, a dash count, a jump height. If you cannot, the site is at an arbitrary distance.
(`LIFT = [-16, -9, 3, 17, 34]` metres above the highest ground on its own bearing, against wings
of 1 : 7.7, 1 : 18.2 and 1 : 23.8. Cache 1 at `LIFT −9` was reached on the base wing from a
cleared save; caches 3 and 4 at `+17` and `+34` are out of reach until KITE TRIM.)

**Forbids.** Five sites at the same height. A site gated by a *skill* unlock rather than a *verb*
— that collapses the two axes back into one and locks a struggling learner out of the thing that
would have taught them.

---

### RULE 10 · NOTHING SENDS YOU, AND IT NEVER TAKES THE FRAME

**Constraint.** The site is elective. No scheduler, objective card or session plan directs the
player to it, and it may never open a surface that takes over the screen.

**Test.** Read the module's constructor arguments. It must receive no `mastery`, no `session`, no
`graph`, and no objective; and it must consult `isBusy()` **only to get out of the way**, never to
demand attention. (`createCaches({ scene, uiRoot, player, builder, hud, wallet, drift, audio, fx,
isBusy })` — that list is the rule.)

**Forbids.** A site that fires a modal. A site the objective card orders you to. A site that
pauses the world. The standing criticism this rule answers is measured: *7 chosen travels versus
~16 takeovers in one session.*

**And its consequence, which must be designed for on purpose.** A site that tells you which way
you were wrong cannot produce **unassisted** evidence, so it must never be asked to carry a
mastery claim. It should still *report*: emit an observation flagged `assisted`, so the teacher
record knows the learner solved `2x + 1 = 7` with their feet, and the mastery number stays honest.
Today the caches emit nothing at all, which is the opposite error.

---

## 9 · THE RULES APPLIED TO WHAT ALREADY EXISTS

`·` = passes, `~` = partial, `✗` = fails. **Only the cache row was scored by playing it.** The
other five are read from source and should be re-scored by somebody who has walked them.

| | 1 body | 2 apparatus | 3 working | 4 signed | 5 named | 6 narrows | 7 place | 8 access | 9 second | 10 elective |
|---|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|:-:|
| **cache** `caches.js` | ~ | ~ | · | ~ | · | · | · | ~ | · | ~ |
| **span** `span.js` | ~ | · | · | · | · | · | · | · | · | ~ |
| **waygate** `waygate.js` | · | ✗ | ~ | · | · | · | · | ~ | ✗ | · |
| **warden** `warden.js` | · | ✗ | ✗ | ~ | · | · | ✗ | · | ~ | · |
| **survey mark** `errand.js` | · | n/a | n/a | n/a | n/a | n/a | · | · | · | ✗ |
| **rift** `rift.js` | ✗ | · | · | · | · | · | ✗ | ~ | ✗ | ✗ |

Reading the table:

- **On this scoring the span outscores the cache** — because its candidates carry
  their own mathematics in their shape (Rule 2) and its reward is a road (Rule 8). Its Rule 1 mark
  is docked for the same walk-through hazard the caches have, which `span.js` documents and
  accepts: *"a cadet crossing the deck to the far one walks straight through the near one. That is
  fine — it costs him a guess and he can see why."* At a cache it is worse than a guess: it can
  **open the site** with a weight the player never chose.
- **The cache's `~`s are all named in §7.** Rule 1: accidental commits. Rule 2: the candidates are
  featureless. Rule 4: one sign only at tier 1. Rule 8: the payment cuts off its own resolution.
  Rule 10: elective, but it reports nothing to anybody.
- **The waygate fails Rule 2 and Rule 9 by construction**, and Rule 9 *deliberately* — it stands on
  the road because that is where the session is spent. It is a good answer to a different problem.
  Its Rule 2 failure is not deliberate and is fixable: give the expression a body.
- **The warden fails Rule 7 and it does not matter**, because it is the one thing in the world with
  intent, and what it *pays* is a place (a new cache where it fell). It is the correct exception.
  It fails Rules 2 and 3 the same way the waygate does — numbered stones, a tagged statement, no
  visible working — and it delivers Rule 4 as **text** (*"TOO SMALL BY EIGHT"*) rather than as
  world state, which is why its Rule 4 is `~` and not `·`. It is nonetheless the only site that
  uses both signs from the first encounter, which is the thing the caches should copy.
- **The rift is not a site and should not be scored as one.** It is the assessment surface, it is
  supposed to take the frame, and its balance modality is the exact dual of the cache's: *there
  you choose the move and the world guarantees the truth; here you choose the value and the world
  reveals it.* Both are needed. Neither replaces the other.

---

## 10 · BUILD NOTES THAT ARE NOT OPTIONAL

Four things the caches got right that a new site will get wrong by default.

**1. The apparatus is a KIND, not a fixed set of instances.** `hang(x, z, y, seed)` builds one
anywhere, and `warden.js` calls it — bind a warden and a new deep cache falls out of the sky where
you caught it, for ever, up to `DEEP_MAX = 12`. This is the answer to the criticism that ended the
fourth sitting: *"by then I would hold all six grants, shards would be confetti, and the island
would still be scenery with pickups on it."* **Write `hang()` before you write the five instances.**

**2. One instanced buffer for every instance of the kind, and compose nothing you cannot read.**
All caches on the island share a single `InstancedMesh` of `TILE_MAX = 640`, refilled per frame
with `tiles.count = n`. Past `TILE_RANGE = 170 m` a cache's pans **are not laid out at all**.
Perch deck and keel are merged to one geometry; arm, risers and both pans are merged to one more.
`waygate.js` learned the same lesson the hard way: per-instance geometry read to `check:sustain`
as *"live GPU geometries grew 27 % (298 → 378) — unbounded accumulation"*.

**3. `.field-tag` is CHROME to `src/world/tagspace.js` — nothing arbitrates it. You must arbitrate
it yourself.** `waygate.js` paid for this already: **452 overlaps across 126 of 288 layout frames,
every one a lintel printed through a HUD plate**. Its fix is three rules — only the nearest gate
talks; a gate is silent in the landing frame; a tear outranks a gate.
**`caches.js` has none of that, and it is a defect waiting for the twelfth deep cache**: two
perches may stand `DEEP_CLEAR = 46 m` apart while a label prints out to `reach = 74 m`, or `140 m`
with RESONANT SIGHT — so two statements and six weights can be on the glass at once. The comment
on `TILE_MAX` says the buffer is sized for *"eight at once"*, which is the same admission from the
other side. **A new site must decide, in its own `placeTags`, which single instance owns the
labels this frame.**

**4. Debounce the commit, and ticket the recovery.** `c.settle = 1.1` stops one walk from
spending two candidates. `span.js` carries the harder version of the same lesson: its per-attempt
`ticket` exists because one attempt's clear-timer fired after the next attempt had laid its slabs
and wiped them — *"a cadet saw his answer erased, and the flight harness read a covered plot as
empty"*. Any site with a timed restore needs a ticket.

---

## 11 · THE FIVE SITES THESE RULES IMPLY

Not a wish list — the five that satisfy all ten rules, cover ground the caches cannot, and reuse
machinery that already exists. Ordered by ratio of new coverage to new code.

**1 · THE LEANING BEAM — inequalities.** `inequality-one-step`, `-two-step`, `-multi-step`, and
with two stops `compound-inequality`. A cache with **a stop under one pan**. `≤` is a beam that must come to rest
*on* the stop; the wrong weight is the one that lifts it off, and the world can now tilt both
ways (Rule 4's dead channel wakes up). Candidates are weights, exactly as now. This is the cache
plus one box geometry, and it is the cheapest new sentence in the archipelago.

**2 · THE COUPLED PAIR — systems.** `system-substitution`, `system-elimination`.
**Two beams that share their x-tiles**, on one perch. Load a value on one and it appears on the
other; both must go level at once. The teaching that no text can give you: watching one beam go
level while the other slams is what "a solution satisfies *both*" actually means. Candidates are
pairs of weights, so the answer space is a grid you walk on rather than a rank you cross — which
also fixes the accidental-commit hazard.

**3 · THE MISSING CORNER — quadratics as area.** `complete-the-square`, `factor-trinomial-monic`
and `-lead`, `difference-of-squares`, `poly-multiply`, `factor-common`. The span's plot, made square. `x² + 6x` is
one square tile and six rectangles; you fly the candidate corner in and either it completes the
square or it leaves a hole you can count and a surplus that slides off the edge. Rule 2 is
satisfied by construction — **the candidates have shape**, which is the span's insight applied to
the one topic where shape is the mathematics.

**4 · THE ENGINE — functions.** `function-notation`, `domain-range`, `relation-is-function`,
`rule-from-table`. Not a balance. An input rank of numbered stones and an output rank; stand on an
input and the machine drives one output stone up. Domain and range are *which stones exist*, and
`relation-is-function` is the machine **jamming** when one input drives two outputs — a physical
event, not a definition. This is the first site in the archipelago whose subject is a *rule*
rather than a *value*, and it is the one that unlocks Level 3.

**5 · THE FLOWN LINE — data and fit.** `scatter-regression`, `residual-and-fit`,
`association-strength`, `slope-rate`, `graph-linear`. A cloud of readings hung in the air; you
**fly a line through them** and the wing's own track is the model. Each reading drops a tile onto
one of two pans — above the line or below it — and the balance goes level when the fit is best.
Rule 4 comes free: the residuals are the tilt. This is the only site here that makes the player's
own flight path the answer, and it is the one that carries the archipelago into Level 5.

**Between them these five reach 21 more of the 62** — and every one of them is reachable only by
flying, pays a permanent change to the map, and can be built as a `hang()`-style kind rather than
a fixed set. Combined with what exists, the archipelago would then carry a little over half the
course with the mathematics as the mechanism, and the rift would carry the rest as assessment.

**What is deliberately absent from this list.** Five more balances holding `a·x + b = c` with
different numbers. That is the failure mode the whole document exists to name: the caches were
*"ONE idea with five instances, so the whole world off the island said exactly one sentence, five
times"* (`span.js`, on itself being the second sentence). The next wave's job is the third,
fourth, fifth, sixth and seventh sentence.

---

## APPENDIX · MEASURED CONSTANTS

| | |
|---|---|
| touch radius (3-D, feet to stone) | `TOUCH = 2.2 m`; horizontal capture 1.04–1.65 m as the stone bobs |
| counterweight spacing | `3.6 m` (3 weights) · `2.9 m` (4 weights, deep) |
| perch deck | `SPAN = 2` → 5 × 5 × `CELL 4 m` = **20 m**, 25 `fixed` `floor` solids |
| tilt per unit of imbalance | `0.055 rad` = **3.15°**, saturating at `±0.46 rad` = 26.4° |
| beam spring | `rollV += (want − roll) × 30 × dt`, damped `exp(−6 dt)` — measured overshoot 8–16 % |
| statement restored after a miss | **1500 ms** · all weights re-form after **3200 ms** · commit debounce `settle = 1.1 s` |
| label descent band | `52 m → 24 m` · label reach `74 m`, `140 m` with RESONANT SIGHT |
| pans composed within | `TILE_RANGE = 170 m` · one shared buffer of `TILE_MAX = 640` |
| pays | `120` motes (deep: `160`) + a permanent updraft, `78 m` tall (deep: `96 m`) |
| verified payment | motes 70 → **190**; new drift column at exactly `(64, 184)`, the perch's own coordinates |
| access ladder | `LIFT = [-16, -9, 3, 17, 34] m` above the highest ground on each bearing |
| wings | base **1 : 7.7** · KITE TRIM **1 : 18.2** · LONG SPAN **1 : 23.8** |
| the flight actually flown | base wing, cleared save; final leg **36.4 m run for 2.5 m drop**, landed on the deck `dy = 0.0` |
| number range the tiles allow | `a ∈ 2..4`, `x ∈ 2..7`, `b ∈ 1..8`, `c ≤ 30`, every value `> 0` and `≤ 34` |
| console errors, all runs | **0** |

*Driven from a cleared save on a frozen build with real key events only. `window.__ascent` was
read for facts and never used to make the game do anything.*
