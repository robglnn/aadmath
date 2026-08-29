# THE ARCHIPELAGO

**Eight off-island sites where the mathematics is the mechanism, one family per strand of
Algebra I — plus the honest list of what cannot be built this way and must stay in the rift.**

Companion to `design/ARCHIPELAGO-PATTERN.md`, which anatomised `src/world/caches.js` and
derived ten rules from it. That document asked *why does the proven thing work*. This one asks
*what else can be built that works for the same reasons*, and answers the client's own question
about the sites they already found.

**This is design only. No game code was written. Nothing outside `design/` was touched.**

---

## 0 · WHAT IS MEASURED HERE AND WHAT IS PROPOSED

The pattern study drove the real game with real keys and measured the caches. This document is a
specification, so most of what follows is a proposal and must be labelled as one. Three classes of
statement appear below and they are kept visibly apart:

**MEASURED — read from the running game by the pattern study, or computed here from the shipping
source.** Every glide ratio, every terrain height, every reachability ceiling, every skill id,
every misconception id, and the whole coverage partition in §5. The reachability tables in §4 were
computed by importing `src/world/terrain.js` into node and solving the wing's own equilibrium at
each trim from the constants in `src/player/locomotion.js`. That method reproduces the pattern
study's independently measured figures to within 2% — **1 : 7.6 / 1 : 18.3 / 1 : 24.1** against its
measured **1 : 7.7 / 1 : 18.2 / 1 : 23.8** — which is the only reason the tables are quoted at all.
The 62-skill partition in §5 was checked by script: every id appears exactly once, every id exists
in `content/graph/`, nothing is missing.

**PROPOSED — a design decision with a stated reason.** Every mechanism, every geometry, every
reward, every band table. These are arguments, not findings. Where a proposal rests on a claim
about how something will feel, the claim is named as the thing to verify first.

**CUT — a site or a skill I could not defend, with the reason.** §5 and §7. The brief's instruction
was that three sites which pass the not-a-quiz test are worth more than nine that do not, so the
cuts are the load-bearing part of this document, not an appendix to it.

**What I read first, in full, before writing a word:** `src/world/caches.js` (740 lines) and
`design/ARCHIPELAGO-PATTERN.md`. Then `src/world/span.js`, `waygate.js`, `warden.js`, `errand.js`,
`drift.js`, `beckon.js`, `tagspace.js`, `field.css`, `terrain.js`; `src/player/locomotion.js`,
`glider.js`, `controller.js`, `src/core/input.js`; `src/build/pieces.js`, `manipulative.js`;
`src/kit/kit.js`, `ladder.js`; `src/learn/mastery.js` (the `observe` contract); all five course
graphs with their `bigIdea`, `worldSite` and `misconceptions` fields; and the gate table in
`RESUME.md` with `tools/scene-audit.mjs`, `tools/critic/answerable.mjs` and
`tools/critic/traverse.mjs`.

---

## 1 · THE CLIENT'S QUESTION, ANSWERED

> *"what do the floating islands with a scale do and how do they fit in?"*

They are **doors with a true sentence written on them and one word missing.** Three weights float
beside each door. Walk into the weight that makes the sentence true and the door opens and pays
you. Walk into a wrong one and the beam slams the heavy way, so you can see which way you were
wrong and by how much, and that weight is spent — but nothing else is, and every weight comes
back.

They fit in as **the elective half of the game.** The rifts are the course: the schedule sends you
to them, they take the screen, and they are where a mastery claim is earned. The archipelago is
where the same mathematics is a thing you do with your body, in a place you decided to fly to, for
a payment that changes the map for ever. Nothing sends you there. That is the whole point of them,
and it is why the client noticed them without being told anything.

### The finding hiding inside the question

The client found the sites, solved them, liked them — *"I kinda like that it's something off our
main island"* — and **still had to ask what they were.** That is a defect, and it is not a small
one: the best mechanic in the build cannot say what it is.

Three causes, all in the source, all cheap to fix:

1. **The site never states its verb.** `caches.js` prints `field.balanceLock` — *"Balance lock"* —
   which is a **name**, not an instruction. Compare `warden.js`, which carries
   `wardenFan: 'Run into the correct weight'` and says it **once, on the first encounter, ever**.
   The caches say nothing equivalent. **Fix: one line, once, on the first cache a player ever
   reaches, in the wardens' exact pattern.** Proposed string, ASD-STE100, active, eight words:
   `field.cacheFirst: 'Walk into the weight that holds the beam level.'`
2. **The payment cuts off the moment it is paying for.** Measured by the pattern study: the
   updraft is planted at `(c.x, c.z)`, under the player's own boots, and lifts them off the perch
   within a second or two of the win. **They never see the level beam.** The one frame that would
   answer "what does this do" is the one frame the reward deletes. **Fix: delay the column, or
   offset it to the deck's edge, or let the player trigger it by stepping onto it.**
3. **There is no set to belong to.** Today the world off the island holds caches and spans, and
   they share a CSS file and nothing else. Two unrelated props are not an archipelago. **Fix:
   §3 — one grammar, one ring, one colour per family, and a skyline you can read.**

The rest of this document is written so that a player who has been told nothing can answer the
client's question by looking out from the island's highest point.

---

## 2 · THE VERBS YOU ALREADY HAVE

The brief's instruction was: prefer a verb that exists over inventing one. This is the vocabulary,
read out of `src/player/**`, `src/build/**` and `src/core/input.js`. **Every site below is built
from this list and nothing else.**

| verb | what the code already does | key |
|---|---|---|
| **walk / run / sprint** | three readably different gaits, 3.1 / 6.2 / 11.8 m/s, linear accelerate-toward with a pivot boost | `W`, `Shift` |
| **jump / double jump** | `jumpV 11.4`, `doubleV 9.9`, coyote 0.14 s, 0.17 s input buffer, variable height, apex hang | `Space` |
| **dash** | 22 m/s for 0.19 s, 0.62 s cooldown; with WINDSTEP it refunds in the air | `Ctrl` / `C` |
| **glide** | a real wing at three trims: **1 : 7.6** base, **1 : 18.3** KITE TRIM, **1 : 24.1** LONG SPAN | `G` |
| **launch** | ground that rises under you throws you off its head — `launchK 0.62`, `0.80` off a lip you built | (emergent) |
| **mantle / scramble** | a ledge pull-up; and a hands-on-rock climb at 4.5 m/s of height, only where the island is one-way | (automatic) |
| **build** | grid-snapped lattice, `CELL = 4 m`: wall, ramp, floor, beam, and vault plate once bought | `1`–`4`, `5` |
| **stand on a vault plate** | thrown 12 m straight up (16 m with PLATE ARRAY) | `5` then walk on |
| **light a flare** | 6 s of rising air under your own boots, anywhere (11 s and 74 m with SQUALL) | `F` |
| **plant a beacon** | a permanent updraft, 90 motes and rising | `G` (kit) |
| **wait** | standing still is already a state the animator and the camera both read | (none) |
| **fall and be caught** | `escape.js` recovers a stuck or fallen cadet; **nothing in this world may cost you the route** | `R` |

Two things this list does **not** contain, and both are load-bearing:

- **There is no carry and no drop.** The manipulatives near a rift are built, not held. So no site
  below asks a player to pick something up. Where the brief's verb list says *carry* or *drop*, the
  site uses **build** or **walk into** instead, because those exist.
- **There is no push.** Where a design wants a thing moved, it is moved by **standing** — the
  object snaps to the player's position, or to the mark they are standing on. That is the caches'
  own idiom (`_p.distanceTo(player.pos) < TOUCH`) and it keeps Rule 1 intact.

### An amendment to Rule 1, stated up front because four sites depend on it

Rule 1 is **POSITION IS THE ONLY INPUT**, and its test is: *delete every keyboard and pointer
handler from the site's module and it must still be completable.*

Four sites below read the world the player has already changed with their **own** verbs — a floor
they built, a plate they threw themselves off, a flare they lit, the line their wing flew. That
must not be allowed to become a loophole, so here is the sharper form of the rule:

> **RULE 1, sharpened.** The site owns no input surface. It may read the state of the world; it may
> not read a key. Concretely: a site module contains no `addEventListener`, no `input.interact`, no
> key code, no pointer handler, no DOM control, and no call into the build system. It reads
> `player.pos`, `builder.solids` and its own geometry, and nothing else. **The player's standing
> verbs are the vocabulary; the site's job is to have a shape those verbs can act on.**

`caches.js` and `span.js` both pass this in its sharpened form —
`grep -n "interact|KeyE|keydown|addEventListener" src/world/caches.js` returns nothing. Every site
below is written to pass it too, and §6 makes it a mechanical gate rather than a promise.

---

## 3 · THE RING

The answer to *"how do they fit in"* has to be visible from the ground. This is the shared grammar
that makes eight kinds of site read as one thing.

### 3.1 · What every site in the archipelago has

Six properties, five of which the caches and spans already satisfy. A proposal that breaks one of
them is out.

1. **A torn shard of island on a keel, hanging clear of the ground.** The cache's own geometry: a
   13.2 m deck on a 16 m keel, forced to `ground + 24` for a deep one — *"or it reads as scenery
   rather than as somewhere you have to reach"*. Never on a hillside. Nothing behind the apparatus
   but sky, which is what makes thirteen cubes against seven legible at 40 m.
2. **Real floor, in the build lattice, flagged `fixed`.** 25 `floor` solids on a cache's deck, at
   `CELL = 4 m`, on the same registry the player's own pieces live in. You stand on it the way you
   stand on a floor you set yourself, you build off it, and it cannot be cleared out from under
   you. **A place before a puzzle.**
3. **A mark you can see from the far coast, that goes out when the site is solved.** A 120 m cone
   of additive light standing *above* the apparatus — `shaftGeo.translate(0, 68, 0)` — so it is a
   mark rather than a fog bank over the thing you came for. `c.mark.visible = false` on open.
4. **One apparatus, and the apparatus is the sentence.** Not a plinth with a label on it.
5. **A payment that is access, planted where it was earned.** 120 motes plus a standing updraft at
   a cache; 140 plus a road at a span. Never a badge.
6. **A statement that comes down to meet you.** Two anchors per label, riding `descend` between
   them, so that at 40 m, at 24 m and at 2 m the thing you must read and the thing you must touch
   are in the same frame. This is the defect the caches already paid for once.

### 3.2 · The ring, and why it is a ring

The island stops at `ISLAND_R = 168`. The leash is `RIM() * 1.62 = 272`. Everything off-island
lives in that 104-metre band, and today it holds eight sites at eight bearings:

```
   cache2 -152°     span2 -81°   cache0 -67°   span1 -58°
   span0 -36°       cache3 -15°  cache1 +70°   cache4 +123°
```

The caches' bearings come from the golden angle (`i * 2.3999632`), which is why they are spread and
not clustered. **Leave them exactly where they are** — they are the ring's anchors and they are the
proven thing. The free arcs between them are where the new families go:

| free arc | width | family placed there | family colour |
|---|---|---|---|
| −15° → +70° | 85° | **THE SPINDLES** (+12 … +30), **THE MEET** (+55 … +62) | amber-white / cold green |
| +70° → +123° | 53° | **THE ENGINE** (+97 … +105) | brass |
| +123° → −152° | 85° | **THE CHAIN** (+142 … +150), **THE YARDS** (+170 … +190) | pale rose / slate blue |
| −152° → −81° | 71° | **THE ARC** (−135 … −142), **THE WEIR** (−103 … −110) | orange / deep cyan |
| −58° → −36° | 22° | **THE READINGS** (−47) | violet-white |

**The rule, not the numbers: a new family takes the widest empty arc, and its instances march
outward along it.** The numbers above are what that rule produces against today's occupancy, and
they are what §4's reachability tables are computed from. If the caches ever move, the rule still
holds and the numbers are recomputed.

### 3.3 · How a player finds any of it

Four channels, in the order a player meets them.

**The skyline.** From the island's high ground the whole archipelago is a **ring of light shafts
around your island**, one per unsolved site, and each family has its own hue at the same value. A
solved site's shaft goes out. So the answer to "how are you doing" is a thing you look at, not a
menu: **the ring dims as you clear it.** The Spine's summit is at **136.6 m at r = 116, bearing
−57.7°** — measured — which is the natural place to stand and see it, and the errand system already
sends people to summits.

**Colour tells you what kind, before you commit to the flight.** `caches.js` already does this
across tiers: *"cold blue is the island's own, amber is one you made"*. Extend it across families.
A player who has cracked one spindle knows every amber-white shaft in the sky is another spindle.

**Height tells you whether you can get there.** §3.4.

**And one line of text, once, ever, per family.** The wardens' pattern: `wardenFan` fires on the
first fan and never again. Each family gets exactly one such line, and every one of them is under
twelve words, imperative, active, and free of jargon:

| family | proposed key | proposed English |
|---|---|---|
| cache | `field.cacheFirst` | Walk into the weight that holds the beam level. |
| spindle | `field.spindleFirst` | Count the rings. Walk into the spindle that has as many. |
| meet | `field.meetFirst` | Walk the rail. Stand still where the beam is level. |
| yard | `field.yardFirst` | Stand on a mark to set each side. The tiles must fill the plot. |
| engine | `field.engineFirst` | Stand on an input plate. Watch what the engine lifts. |
| arc | `field.arcFirst` | Stand where the weight will come down. |
| weir | `field.weirFirst` | Walk out. The plates that hold you are the answer. |
| chain | `field.chainFirst` | Count the stones on each perch. Walk into the pile that comes next. |
| readings | `field.readFirst` | Fly through the cloud. The line you fly is the model. |

All nine go through `src/i18n` in EN/ES/PL, additive keys only, and none of them may be printed
twice.

### 3.4 · The access ladder, and one correction to Rule 9

Rule 9 says the site's position must be tiered against the traversal kit, stated as a number in the
same units as a kit grant. The caches state it as `LIFT[]` metres above **the highest ground on the
site's own bearing**. That datum has a flaw, and `span.js` already found it and wrote it down: on
one bearing the highest ground *"climbs from 72 m to 99 m in eight metres of run: nothing on legs
gets up it, so the first span was hung off a launch pad no cadet could reach."* **The highest
ground is not the launch if you cannot stand on it.**

> **RULE 9, corrected.** A site declares a **LAUNCH** — a specific, runnable, reachable piece of
> ground with a radius and a height — and a **DROP BUDGET** in metres. The site's height is
> `launch height − gulf / glide ratio − margin`, and the wing that flies it is the access
> requirement. The launch must be somewhere a player can get to on legs.

Computed, per wing, at each site's own bearing, by scanning every radius on that bearing for the
launch point that maximises `h − (siteRadius − r) / ratio`:

| site | bearing | radius | best launch | base ceiling | KITE ceiling | SPAN ceiling |
|---|---:|---:|---|---:|---:|---:|
| SPINDLES 1 | +20° | 194 | r 38 @ 61 m | **40.3** | 52.0 | 54.0 |
| SPINDLES 2 | +12° | 216 | r 40 @ 60 m | 37.3 | **50.6** | 52.9 |
| SPINDLES 3 | +30° | 240 | r 52 @ 61 m | 36.3 | 50.4 | 52.8 |
| MEET 1 | +55° | 206 | r 148 @ 82 m | **74.0** | 78.3 | 79.1 |
| MEET 2 | +62° | 238 | r 150 @ 76 m | 64.8 | **71.5** | 72.7 |
| ENGINE 1 | +97° | 210 | r 142 @ 59 m | **50.1** | 55.3 | 56.3 |
| ENGINE 2 | +105° | 244 | r 144 @ 59 m | 46.5 | 54.1 | **55.4** |
| CHAIN head | +142° | 190 | r 22 @ 58 m | **36.6** | 49.2 | 51.4 |
| CHAIN tail | +150° | 262 | r 22 @ 58 m | 27.3 | **45.3** | 48.4 |
| YARDS 1 | +180° | 204 | r 24 @ 58 m | **34.9** | 48.5 | 50.8 |
| YARDS 2 | +190° | 230 | r 24 @ 58 m | 31.5 | **47.1** | 49.7 |
| YARDS 3 | +170° | 258 | r 24 @ 58 m | 27.8 | 45.5 | **48.5** |
| ARC 1 | −135° | 214 | r 120 @ 84 m | **71.5** | 78.6 | 79.8 |
| ARC 2 | −142° | 246 | r 116 @ 95 m | 77.7 | **87.4** | 89.1 |
| WEIR 1 | −103° | 200 | r 24 @ 58 m | **35.4** | 48.7 | 51.0 |
| WEIR 2 | −110° | 234 | r 24 @ 58 m | 31.1 | **46.8** | 49.6 |
| READINGS | −47° | 222 | r 138 @ 134 m | **123.0** | 130.8 | 132.2 |

Bold is the tier each instance is set to sit just under. **Every family's first instance is
reachable on the base wing from a cleared save** — that is the rule, and it is what stops the
archipelago from being a reward for people who are already winning. Instance 2 wants KITE TRIM
(lines 3), instance 3 wants LONG SPAN (depth 26) or a vault plate off instance 2's own deck.

One honest caveat, and `span.js` already stated it: **the Spine is 136.6 m and a clean cross-island
line from it beats most of this ladder.** That is not a leak — *"that is the game paying out for
being good at it"* — and it is deliberately not closed.

---

## 4 · THE EIGHT SITES

Each site below carries the brief's eight required specifications, then the paragraph the brief
calls the point of the lane. **They are ordered by how strongly I can write that paragraph**, not
by course order, because that ordering is the recommendation in §7.

---

## 4.1 · THE SPINDLES — exponent rules

**Bearings +12° … +30°. Colour: amber-white. Carries 4 skills the pattern study called
impossible.**

The pattern study sorted all 62 skills and put `exponent-product`, `exponent-power`,
`exponent-quotient` and `zero-negative-exponent` under **"NEVER — the answer is not a countable
positive whole"**, with the reason: *"`2^3 · 2^4` is 128 cubes; the site caps at 34."*

**That reasoning is wrong, and finding out why is the most valuable thing in this document.** It
tested whether a pan could hold the **value of the power**. But the exponent rules never ask you to
evaluate the power. Read the graph's own words, which are the course's own words:

> `exponent-product` — *"A count above a letter says how many factors there are. Multiplying two
> powers of one letter puts the two lots of factors side by side, **so the counts add**."*
>
> `exponent-power` — *"A power raised to a power writes the bracket out that many times, and each
> copy brings its own count again — **so the two counts multiply**."*
>
> `exponent-quotient` — *"Dividing two powers of one letter cancels a factor from the top against a
> factor from the bottom, **so the bottom count comes off the top count**."*
>
> `zero-negative-exponent` — *"Dividing a power by itself gives one by cancelling and a count of
> zero by subtracting, **so a count of zero has to mean one** — and a negative count has to mean
> factors under the bar."*

Every one of those sentences is about **counting small numbers of objects**. `3 + 4 = 7`.
`3 × 4 = 12`. `8 − 5 = 3`. The 128 never appears. **The exponent rules are the most countable
mathematics in Algebra I, and they were mis-sorted because they are written in a notation that
looks like arithmetic.**

### 1 · What the player does with their body

**Fly. Land. Walk along a rank of spindles and count rings with your eyes. Walk into the one that
has as many rings as the two you were shown.** Then, once it opens, **climb the mast you just
proved** — its rings become rungs.

### 2 · Where the mathematics lives on screen

A **spindle** is a mast standing on the deck with **rings threaded onto it**. One ring is one
factor. The exponent is *how many rings you can count*. The base is *the mast* — a square-section
mast is `x`, a hexagonal one is `y`, and they are visibly different objects at 40 m.

| in the notation | on the deck |
|---|---|
| the base `x` | the mast's section — square for `x`, hexagonal for `y` |
| the exponent `n` | `n` rings threaded on it, banded bright every fifth like a tally |
| the coefficient `k` | `k` **collars** at the mast's foot, a different colour, below the rings |
| the fraction bar | **the deck itself** — rings above it, rings below it |
| `x^{-n}` | `n` rings hanging **under** the deck and none above |
| `x^{0}` | a **bare mast**, standing, with no rings on it at all |
| multiplying | two masts on the left of the deck, and one answer rank on the right |
| cancelling | a ring above and a ring below **pair off and both go dark**, one pair at a time |

Rings are banded in fives — a brighter ring every fifth, the way a ruler is ruled — so twelve reads
as *two brights and two* at a glance rather than as a texture. That is the design decision that
keeps the whole site inside the countability limit the caches hit at 34.

### 3 · What being wrong does, physically

The candidate spindles stand on one rank and **they are different heights, visibly, from the far
end of the deck.** Walk into a wrong one and:

- **It rises out of its socket and stands beside the two givens**, so that all three are on one
  line at the same scale. Then **the rings pair off**: one from the answer against one from the
  first given, then the second given, one at a time, the way cancelling looks. Whatever is left
  over stands there unpaired.
- **What is left over is the error, in rings.** Take 12 for `x^3 · x^4` and **five rings stand
  unpaired**, glowing, countable. Take 1 and the answer is **six rings short** and there is a
  visible gap of empty spindle above it.
- **Then the socket rejects it and it sinks back**, dark, spent.

Signed and scaled, in the units of the problem, with no text: too many rings or too few, and by
how many. **Both signs are live from the first encounter**, which is the channel the caches never
had at tier 1.

### 4 · The cost of being wrong

**One spindle, and nothing else.** No motes. The statement stands. All spindles re-form after a
delay, exactly as the caches' weights do (`1500 ms` to restore, `3200 ms` to re-form). Nobody is
locked out.

What makes a player think rather than guess: **counting is cheaper than guessing here.** Three
spindles on a rank is a 1-in-3 guess, but the rings are right there and reading them takes two
seconds. This is the one site in the archipelago where **the correct strategy is also the fastest
one**, and that is a stronger pressure than any penalty.

### 5 · Skill nodes carried

`exponent-product`, `exponent-power`, `exponent-quotient`, `zero-negative-exponent`.

**Wrong candidates, and the graph misconception each one is** (all ids verified present in
`content/graph/algebra1-l3.json`):

| statement | correct | wrong candidate | as an object | misconception id |
|---|---|---|---|---|
| `x^3 · x^4` | 7 rings | 12 rings | too tall by five | `exponents-multiplied` |
| `x^3 · x^4` | 7 rings | 7 rings, **hexagonal mast** | right count, wrong letter | `bases-multiplied` |
| `2x^3 · 5x^4` | 10 collars, 7 rings | 7 collars, 7 rings | three collars short | `coefficients-added` |
| `(x^3)^4` | 12 rings | 7 rings | five short | `exponents-added` |
| `(2x^3)^4` | 16 collars | 8 collars | half the collars | `coefficient-not-raised` |
| `x^8 / x^5` | 3 rings **above** | 13 rings | eight too many | `exponents-added` |
| `x^8 / x^5` | 3 rings above | 3 rings **below the deck** | right count, wrong side of the bar | `exponents-subtracted-wrong-way` |
| `x^5 / x^5` | a **bare mast** | an **empty socket** | nothing standing at all | `zero-power-is-zero` |
| `x^{-2}` | 2 rings **below** | 2 rings **above** | the right count on the wrong side | `negative-power-is-reciprocal-slip` |

The last two are the reason to build this site. `zero-power-is-zero` is the single most stubborn
misconception in the exponent block, and here **the world refutes it by standing there**: a bare
mast is not nothing. It is a mast. You can walk up and touch it. And `negative-power-is-negative`
— *"reads a negative count as a negative answer"* — dies the moment a learner sees that the rings
below the deck are exactly as bright and as solid as the rings above it. **Nothing about being
underneath says "less than zero". It says "under the bar", which is what it means.**

### 6 · Difficulty bands 1–5

| band | what moves | example |
|---|---|---|
| 1 | one rule, small counts, no coefficient | `x^2 · x^3` |
| 2 | counts to 9, still one rule | `x^5 · x^4` |
| 3 | coefficients appear as collars | `3x^2 · 4x^5` |
| 4 | the quotient rule, rings below the deck | `12x^7 / 4x^3` |
| 5 | zero and negative counts; two rules in one spindle | `(2x^3)^2 / x^8` |

Monotone, no flat step, no cliff. The ring cap is **12 above and 12 below**, which is what keeps
band 5 countable and is the honest ceiling of the apparatus.

### 7 · How it is verified

`pose(seed, band)` returns `{ base, exps, coeffs, op, answer, candidates }` and lives in a pure
module with no Three and no DOM (§6). The gate re-derives every answer with an independent
exponent solver, asserts every candidate is a distinct `{ mast, ringsAbove, ringsBelow, collars }`
tuple, and asserts every wrong candidate carries a misconception id **that exists on that skill's
node in `content/graph/`**. The physical answer becomes checkable trivially: **the commitment is an
index into `candidates`, and the whole apparatus is integers.** Ring counts are asserted `≤ 12` on
both sides of the deck and collars `≤ 16`, so the geometry can never outrun countability.

### 8 · Footprint and finding it

Three instances, at bearings **+20°, +12°, +30°**, radii **194, 216, 240** — the wide arc between
cache 3 and cache 1. Deck: **20 m** (`SPAN = 2`, 25 `fixed` `floor` cells), same as a cache.
Heights **34 / 46 / 58 m** against measured ceilings of 40.3 / 50.6 / 52.8, so instance 1 is a base
wing from a cleared save, instance 2 wants KITE TRIM, and instance 3 is above every wing.

**And instance 3 is reached by the reward instance 2 pays.** This is the family's payment:

> **A solved spindle's rings become rungs.** The mast stays, and it is climbable to
> `answer × CELL` metres — **the exponent's own height in lattice storeys.** A 7-mast pays 28 m of
> climb. A 12-mast pays 48 m. **The reward's size is the answer.**

Which means SPINDLES 3 at 58 m, twelve metres above the base wing's ceiling of 36.3, is reached by
standing on SPINDLES 2's deck at 46 m and climbing the mast you just proved. **The exponent is the
altitude**, and it is the cleanest fusion of Rule 8 and Rule 9 in this document.

### WHY THIS IS NOT A QUIZ WITH A VIEW

A card that says `x^3 · x^4 = ?` with three options tests one thing: **whether you remember the
rule.** A learner who does not remember it has nothing to do but guess, and a learner who guesses
right learns nothing. That is the entire failure mode of exponent instruction and it is why
`exponents-multiplied` survives into Algebra II.

At the spindles there is no rule to remember. **There are three rings on one mast and four on
another, and you go and find the mast with seven.** A learner who has never heard the word
"exponent" solves it by counting, and having solved it by counting a dozen times, *has derived the
rule* — because the rule is nothing but the observation that putting two lots of factors side by
side gives you as many as both lots together, which is a fact about objects and not about
notation.

Test the two claims that matter:

**The cover test.** Hide every label the site draws. The site is still completely solvable, because
the mathematics is a count of physical objects and the notation was only ever a caption. The caches
half-fail this test — their three counterweights are identical octahedra told apart by a numeral on
a DOM tag. **The spindles pass it outright.** They are the first site in this world whose
*candidates* carry their own mathematics in their bodies, which is the thing `span.js` got right
and the pattern language named as the fix.

**The typing test.** Could a learner solve this by reading a card and typing a number? Only by
already knowing the rule — which is exactly the population the site is not for. The site is
strictly more informative than the card it replaces, for every learner, at every level of prior
knowledge. **That is the only defensible reason to move a piece of mathematics out of the rift and
into the world**, and this site is the clearest case of it I found.

---

## 4.2 · THE MEET — systems, graphs, rate, and two-variable inequalities

**Bearings +55° … +62°. Colour: cold green. Carries 6 skills.**

### 1 · What the player does with their body

**Walk out along a rail of light that hangs in the sky, and stop where the beam at the edge of the
plot goes level.** Then **stand still** for about a second, and the cell under your boots sinks and
locks.

That is the whole site. Walking is reading; standing still is answering.

### 2 · Where the mathematics lives on screen

A **plot**: a square of open lattice hanging over the gulf, 13 × 13 cells at `CELL = 4 m` — a
**52 m deck** of real `fixed` `floor`, ruled into cells with the numbers cut into the south and
west edges. It is a coordinate plane you stand on. That is a place before it is a puzzle: with the
mathematics stripped out it is still the largest flat buildable deck in the archipelago, hanging in
clear air, and people would fly to it for that alone.

**The first statement is a RAIL.** `x + y = 9` is drawn as a low wall of light standing 1.2 m proud
of the deck, laid on exactly the cells where that equation holds. It runs corner to corner across
the plot. **A line is all the solutions of one equation, and here it is a thing you can walk along
and trip over.**

**The second statement is a BALANCE at the plot's edge** — the caches' own apparatus, unchanged:
an arm, two pans, tiles. Left pan holds `2x − y`. Right pan holds `3`.

And this is the mechanism:

> **The balance substitutes the cell you are standing on, live, at 60 frames a second.** As you
> walk the rail, the pans re-lay themselves and the beam swings. Somewhere along the rail it goes
> level. **Stand there.**

### 3 · What being wrong does, physically

**There is no verdict, because there is a continuous reading.** The beam is not something that
happens to you after you commit; it is something you are steering. Walk out along the rail and the
beam falls one way. Keep going and it comes up, passes through level, and **falls the other way.**

Three facts, none of them prose, all of them delivered by your own legs:

1. **Every cell on the rail satisfies statement one.** You are walking on the proof.
2. **Exactly one of them satisfies statement two.** The beam is level at exactly one place.
3. **Which side of it you are on.** The beam's sign flips as you walk through the answer, and its
   magnitude is `|2x − y − 3|` tiles on a pan — countable, at the tilt rate the caches already
   tuned (`0.055 rad` per unit, `3.15°`, saturating at 26.4°).

**The failure state is a slope you can feel with your feet, and the answer is the bottom of it.**
A learner who overshoots does not get told they overshot. They watch the beam turn over, and they
walk back.

The **commit** is standing still for `1.2 s`. If the beam is level when the cell locks, the plot
seals. If it is not, **that cell drops out of the rail** — a one-cell hole you can step over, and a
permanent visible record of where you guessed. The rail is a line with your wrong answers punched
out of it.

### 4 · The cost of being wrong

**One cell of rail, and nothing else.** No motes. You can jump a one-cell hole; if you fall,
`escape.js` catches you. The rail re-forms whole after a delay.

The pressure that makes a learner think: **standing still is the commitment, so hesitating on a
cell is answering it.** That is a real and legible tension — the site is asking you to be sure
before you stop — and it costs nothing but a hole in a line you are walking on.

### 5 · Skill nodes carried

`system-substitution`, `system-elimination`, `system-graphically`, `graph-linear`, `slope-rate`,
`inequality-two-var`.

**Why each one is genuinely there, not just adjacent to it:**

- **`system-substitution`** — *"When one of them already says what a letter is, put that straight
  into the other and only one letter is left."* **That is what walking the rail does.** The rail is
  statement one, already solved for you as a set of pairs; you put each pair into statement two
  until one works. The site performs substitution with the player's legs.
- **`system-graphically`** — *"Two statements drawn as two traces meet where both are true at
  once."* On the seal, **the second statement's rail is drawn**, and it crosses the first at the
  cell you are standing on. You do not see the answer before you commit; you see it be right.
- **`graph-linear`** and **`slope-rate`** — the rail's own rise and run are cells you can count
  under your boots. *"On one straight rule it is the same number wherever you measure it"* is a
  thing you can check by counting in two different places on the same rail.
- **`inequality-two-var`** — the same plot, one rail, and **one side of it flooded** (the WEIR's
  tide, §4.6). *"One tested reading says which side it is on"* becomes: walk somewhere and see
  whether you are wet. **`boundary-strictness-ignored`** is the rail plate itself giving way
  under you for a strict inequality and holding for a closed one.
- **`system-elimination`** — carried honestly but **partly**. On the seal, the two rails fold
  together into a third that passes through the same cell, which is *"add two true statements and
  the result is true as well"* shown as an event. A value check cannot see whether the learner
  eliminated or substituted, so this one is **taught here and assessed in the rift.** Said plainly
  rather than claimed.

**Wrong candidates as named misconceptions** (ids verified in `algebra1-l5.json` and
`algebra1-l2.json`):

| where the learner stands | what the world does | misconception id |
|---|---|---|
| the cell mirrored across the plot's diagonal — `(q, p)` for `(p, q)` | the beam slams; **the diagonal is drawn on the deck**, so you can see you are its reflection | `crossing-coordinates-swapped`, `axis-swap` |
| the nearest cell that is *not* on the rail | the rail is not under your boots — **you are standing on open lattice with the sea below** | `nearest-grid-line-taken` |
| the end of the rail | you walked the whole line and never stopped where the beam levelled | `one-trace-followed`, `checked-in-one-statement-only` |
| anywhere, when the two rails are **parallel** | the beam **never goes level anywhere on the rail**, and at the far end you can see the second rail running beside the first and never touching it | `crossing-invented-for-parallel-traces` |

That last row is the one no card does. **A system with no solution is a walk with no answer at the
end of it**, and the learner finds that out by walking the whole rail and watching the beam stay
stubbornly off level the whole way. Then they look up and see two rails that will never meet. The
site can teach *no solution* without ever using the words.

### 6 · Difficulty bands 1–5

| band | what moves |
|---|---|
| 1 | both coefficients 1; the crossing is on a lattice node in the middle of the plot |
| 2 | one coefficient up to 3; crossing still whole and central |
| 3 | both coefficients up to 4; the crossing moves toward an edge |
| 4 | one statement has to be rearranged before its rail can be read; negatives on one side |
| 5 | the parallel case and the coincident case are both in the bank |

The plot is 13 × 13, so every intercept and every crossing has to land in `0..12` on both axes.
That is the apparatus's honest range and it is what caps band 5.

### 7 · How it is verified

`pose(seed, band)` returns `{ eqA, eqB, railCells, solution, plot: {w, h} }`, pure. The gate
re-derives the solution by an independent linear solver, asserts it is the **only** lattice cell in
the plot satisfying both, asserts every cell in `railCells` satisfies `eqA` and that no cell
outside it does, and asserts the parallel and coincident bands really have no unique solution.
**The commitment is a lattice cell `(gx, gz)`** — two integers — so the checker re-derives the
verdict from `pose` and the cell alone, never from what the site reported.

The live beam needs its own gate, because it is the site's whole argument. `check:sites --play`
walks the rail with real key events and samples `beam.roll` per cell; the assertion is
**monotone through zero**: the sign must change exactly once along the rail, and `|roll|` must
increase with distance from the solution on both sides.

### 8 · Footprint and finding it

Two instances at **+55°, r 206, y 68 m** and **+62°, r 238, y 70 m**. Measured base-wing ceilings
on those bearings are **74.0** and **64.8**, so MEET 1 is a base-wing glide from the shoulder at
r 148 @ 82 m — one of the best launches on the island — and MEET 2 needs KITE TRIM.

Footprint 52 m square, which is the largest in the archipelago. That is deliberate: the site has to
be **walkable at length**, because walking is the reading.

**What it pays: a crossroads.** On the seal the two rails fuse and become **road** — real `fixed`
floor, the span's own reward mechanism — running out of the plot in two directions at once. The
MEET is therefore the first place in the archipelago where two routes join, and that is exactly
what a system of equations is. It also pays 140 motes.

### WHY THIS IS NOT A QUIZ WITH A VIEW

Every other site in this document, and both sites that already exist, share one shape: **you
commit, then the world tells you.** The interval between the two is where the teaching happens, and
Rule 3 exists to protect it. The MEET is the only site here that **deletes the interval by making
it continuous.** There is no moment of commitment followed by a verdict. There is a beam that
answers your feet, sixty times a second, for as long as you keep walking.

A card cannot do that. A keypad cannot do that. A drag-a-slider applet on a whiteboard is the
closest thing to it, and it is still a picture you are pointing at rather than a place you are
standing in — you can move a slider without knowing what it means, and you can watch a number
change without it costing you a step.

Here, **the substitution is your own displacement.** You are the value of `x`. The thing being
tested — *does this pair satisfy the second statement* — is being tested continuously, on you, and
the answer is written in a beam ten metres away that you can see out of the corner of your eye
while you run.

And the parallel case is the argument's second half. On a card, *"no solution"* is an option in a
list, and a learner picks it by elimination. Here it is a hundred and eighty metres of walking that
ends with nothing happening, and then a look up at two rails going out over the sea beside each
other for ever. **A learner who has had that experience once does not forget what parallel means**,
and no amount of ink does the same job.

The honest weakness: **the answer is visible if you are patient.** Walk the whole rail slowly and
the beam will tell you where to stop, with no algebra at all. That is the same trade the caches
make, and it is the correct behaviour for a tutor and disqualifying for an assessment. It is why
this site emits `assisted` evidence and never carries a mastery claim (§6).

---

## 4.3 · THE YARDS — polynomials and factoring

**Bearings +170° … +190°. Colour: slate blue. Carries 7 skills — the largest single block in this
document.**

`span.js` already built the forward direction: `a(b + c)` is the area of a rectangle split in two,
and you walk into the pile of slabs that covers the plot. The YARDS is **the same apparatus run
backwards**, and that is not a repetition — it is the mathematics being correct. The graph says so
in its own words:

> `factor-common` — *"**Factoring is expanding read right to left.** Take out the largest number
> every term shares and the lowest count of the letter every term carries."*

At a span you are given the shape and must find the pile. **At a yard you are given the pile and
must find the shape.**

### 1 · What the player does with their body

**Fly to a plot with a heap of tiles on it. Walk to a mark on the south edge and stand; walk to a
mark on the west edge and stand. Two positions set two sides of a rectangle. The tiles then fly out
and fill it — or fail to.**

### 2 · Where the mathematics lives on screen

A **yard** is an open plot of lattice hanging in the sky with two **rails that slide**: a south rail
and a west rail. Where you stand on the edge, the rail snaps. The rails are the two factors.

At the near edge sits **the stock** — the polynomial, as a real countable heap of three kinds of
tile, which is the standard algebra-tile model made physical:

| tile | size | what it is |
|---|---|---|
| **the square** | `x` by `x` | one `x²` |
| **the long** | `x` by `1` | one `x` |
| **the unit** | `1` by `1` | one `1` |

`x² + 7x + 12` is **one square, seven longs and twelve units**, sitting in a heap you can walk
around and count. The three kinds are different sizes and different colours, so they can never be
confused — and that fact **is** `like-terms`: *"a number and an x-term never merge, and x and x
squared are different kinds."* You cannot stack a unit where a long goes. The geometry forbids it.

### 3 · What being wrong does, physically

Set the rails, and the stock lays itself into the rectangle, one tile at a time, in front of you —
the span's `lay()` behaviour, which already exists and already works. Then one of three things:

- **Exact.** Every square filled, nothing left. The plot goes solid and becomes floor.
- **Short.** Holes stay open, go red, **and you can count them.** And — this is the part that makes
  the site carry factoring rather than arithmetic — **the holes have a shape.** Set `(x+2)(x+6)`
  for `x² + 7x + 12` and you get `x² + 8x + 12`: you are **one long short**, and the hole is
  long-shaped, `x` by `1`, sitting in the strip. You can see that what is missing is an `x` and not
  a `1`.
- **Over.** The surplus piles on top and **slides off the edge into the gulf.** Again with a shape:
  a surplus of units looks nothing like a surplus of longs.

**The shape of the leftover is the name of the error.** That is Rule 4 and Rule 5 fused into one
object, and it is the strongest form either rule takes anywhere in this document.

And **`difference-of-squares` gets a proof rather than a rule.** `x² − 9` is a big square with a
3 × 3 square **cut out of one corner** — an L-shaped plot. Setting the rails cuts the L, and the
two pieces **swing together into a rectangle** of `x + 3` by `x − 3`. You watch the identity be
true. Now try `x² + 9`: a big square with a 3 × 3 square **added** to a corner. **There is no rail
setting anywhere on the plot that makes it a rectangle.** You can try all of them. The world proves
the negative, which is a thing no multiple-choice card has ever managed, and it kills
`sum-of-squares-factored` — *"factors a sum of two squares as if it were a difference"* — outright.

And **`complete-the-square` is the site's namesake move.** `x² + 6x` is one square and six longs.
Lay them and the natural arrangement is an **L**: the square, with three longs down one side and
three down the other. **The missing corner is a 3 × 3 hole you are looking at.** *"Half the middle
coefficient, squared"* is not a formula here — it is the size of the hole. And
`half-b-not-squared`, which adds 3 instead of 9, arrives as **three tiles trying to fill a
nine-tile hole, leaving six holes open.** You can count them.

### 4 · The cost of being wrong

**One rail setting.** The stock re-forms; the plot clears; the marks you have already used go dark
so you can see which shapes this yard has already refused. No motes, no lockout. The span carries
the harder version of this lesson already and it is in the source as a warning: **every timed
restore needs a per-attempt ticket**, because at the span *"the first attempt's two-second clear
fired half a second after the second attempt had laid its slabs, and wiped them."*

### 5 · Skill nodes carried

`like-terms`, `poly-multiply`, `factor-common`, `factor-trinomial-monic`, `factor-trinomial-lead`,
`difference-of-squares`, `complete-the-square`.

**Named misconceptions, all ids verified in the graphs:**

| skill | wrong rail setting | what you see | misconception id |
|---|---|---|---|
| `factor-trinomial-monic` | the pair that multiplies to the middle and adds to the last | one long short or over, in the strip | `product-and-sum-swapped` |
| `factor-trinomial-monic` | two plus signs when the last term is positive | the unit block is right and the long strip is wrong | `sign-both-positive` |
| `factor-trinomial-monic` | the last term split, the middle never checked | the corner block fits, the strip does not | `constant-split-only` |
| `factor-trinomial-lead` | the front number left out of both brackets | the square block is short by whole rows | `leading-coefficient-ignored` |
| `factor-trinomial-lead` | the front number put in **both** brackets | the square block overshoots the plot | `leading-coefficient-in-both` |
| `difference-of-squares` | a sum treated as a difference | **no rail setting works at all** | `sum-of-squares-factored` |
| `difference-of-squares` | the square copied instead of its root | the strip is out by a factor you can pace | `coefficient-root-skipped` |
| `complete-the-square` | half the middle number, not squared | **six holes left in a nine-hole corner** | `half-b-not-squared` |
| `factor-common` | part of the common factor pulled out | the rectangle comes out whole but **the stock is not empty** | `factor-partial` |
| `factor-common` | one term divided and another left | **one strip is the wrong length** | `factor-drops-term` |

`factor-partial` deserves a note. It is the one error at this site that produces a *valid
rectangle*, so a naive checker would pass it. **The site catches it because the stock is still not
empty**: there are tiles left in the heap that had nowhere to go. The seal only opens when the plot
is full **and** the heap is bare, which is exactly the mathematical condition for a complete
factorisation and would be a hard sentence to write on a card.

### 6 · Difficulty bands 1–5

| band | what moves |
|---|---|
| 1 | `k(x + n)` — a common factor only, unit tiles and longs |
| 2 | `(x + a)(x + b)`, both positive, small |
| 3 | one negative sign; the plot has a cut corner |
| 4 | a leading coefficient; the square block is `a` rows deep |
| 5 | complete the square, and the differences of squares with coefficients |

Plot cap: **17 × 17 cells** at `SQ = 1.5 m`, which is 26 m across — the span's own scale. That caps
`x ≤ 12` and the constant at 34 tiles, for the same countability reason a cache caps at 34.

### 7 · How it is verified

`pose(seed, band)` returns `{ terms: {sq, lin, unit}, factors: [p, q], marks }`, pure. The gate
multiplies `p × q` with an independent polynomial multiplier and asserts it equals `terms`;
asserts every mark on each rail is reachable and distinct; asserts **the stock is exactly
consumed** by the true setting; and asserts that for every wrong setting the residual — holes and
surplus — is non-zero and *distinguishable from every other wrong setting's residual*. That last
assertion is Rule 4 made mechanical and it is the one that would catch a lazy distractor.

The commitment is **two integers** — the mark index on each rail. Fully checkable.

### 8 · Footprint and finding it

Three instances at **+180° r 204 y 28**, **+190° r 230 y 42**, **+170° r 258 y 47**, against
measured base/kite/span ceilings of **34.9 / 47.1 / 48.5**. Instance 1 is the base wing; 2 wants
KITE TRIM; 3 wants LONG SPAN. All three launch from the island's central high ground at r 24 @ 58 m
— a **192 to 246 metre flight**, the longest committed glide in the archipelago, which suits a
family whose reward is a landing field.

**What it pays: the plot itself.** On the seal the completed rectangle **becomes floor** — real
`fixed` lattice, `p × q` cells of it. A big flat buildable deck at the edge of the world is, for a
player who builds, the most valuable thing in this game. **The area you proved is the ground you
get**, which is the most direct statement of "the payment is access" available.

### WHY THIS IS NOT A QUIZ WITH A VIEW

Algebra tiles have existed for fifty years and every teacher who has used them knows the same two
things: they work, and students stop using them the moment the tiles go back in the box. The reason
is that a tabletop manipulative is a **demonstration you perform on the mathematics**, and the
moment the demonstration is over you are back with the symbols and nothing has been transferred.

The yard is not a tabletop. It is **26 metres across, you are standing in the middle of it, and the
tiles are the size of doors.** You do not arrange the tiles; you set the two edges of the world and
the tiles arrange themselves, and if you got it wrong you are standing in the hole. When the
correct rectangle closes it does not go back in a box — **it becomes the ground under your feet and
stays there for the rest of the game.**

The specific thing a card cannot do is `difference-of-squares`. On a card, *"a sum of two squares
does not factor"* is a fact to memorise, and `sum-of-squares-factored` is the misconception that
proves nobody memorised it. Here, **you can try.** You can set every rail position on the plot,
one after another, and watch every one of them leave a hole. That is not a fact you were told. That
is a search you conducted, and its result is a thing you now know rather than a thing you were
given.

The honest weakness: **this is the span's medium.** It is a plot, tiles fly, holes go red. If the
YARDS ships and the SPANS ship and a player meets them in the wrong order, they will read as one
site with two moods. **Mitigation, and it must be built in: the yard's verb is setting an edge, and
the span's verb is choosing a pile.** Those must be legible as different actions from the air —
different deck shapes, different colours, and the yard's rails standing proud so you can see from
40 m out that this is a plot with movable sides. If that separation cannot be achieved visually,
build the YARDS and **retire the SPANS into it as its band-1 case**, rather than shipping two
sites that are one site.

---

## 4.4 · THE ENGINE — functions and function notation

**Bearings +97° … +105°. Colour: brass. Carries 5 skills, and it is the site that opens Level 3.**

### 1 · What the player does with their body

**Stand on an input plate.** That is the whole input surface. The machine runs, and something
happens out in front of you.

### 2 · Where the mathematics lives on screen

Three parts, in a line, all of them machinery you can see working.

**THE INPUT RANK.** A row of stone plates set into the deck, numbered, that you walk along and
stand on. **The plates that exist are the domain.** For `f(x) = 6/x` there is no plate at zero —
there is a **gap in the rank with the sea underneath it.** For a function defined on `1..9` the
rank is nine plates long and stops. Domain is not a set written in brackets; it is **which floor is
there.**

**THE THROAT.** The rule, as gearing, in the open, turning. For `f(x) = 3x + 2`: the plate you
stand on drives a shaft; the shaft turns **three identical cranks** — countable, side by side —
and then a bar is pushed **two notches** along a ruled rack. **You watch your number get multiplied
by three and then shifted by two, as motion, in that order.** The order of the machinery is the
order of operations, and it is a physical chain: the cranks are upstream of the rack and there is
no way to run them the other way round.

**THE OUTPUT RANK.** A row of pillars in the gulf beyond the deck. Stand on plate 4 and **pillar 14
rises out of the deck** to a height of `14` notches, ruled and countable. The pillars that can rise
are the range.

**THE SEAL** stands out among the pillars at a fixed height — say 14 notches. The question the site
asks by its geometry, with no sentence anywhere, is: **which plate lifts a pillar to the seal's
own head?**

### 3 · What being wrong does, physically

Stand on the wrong plate and a pillar rises to the wrong height, **beside the seal**, and stops.
The two heads are side by side, ruled in the same notches. **You can count the gap.** Then the
plate sinks and goes dark.

Signed and scaled from the first encounter: too short or too tall, by how many notches. And because
the throat ran in front of you, **you can see where it went wrong** — you watched three cranks turn
and a bar shift two, and if you know your number went in as 5 you can see 15 and then 17 happen.

**And then there is the jam.** For `relation-is-function` the throat holds no rule at all: it holds
a **pin-board**, a physical relation, drawn as **cables from input plates to output pillars**. Stand
on a plate with one cable and the machine runs. **Stand on a plate with two cables and both
pillars try to rise at once, the shaft binds, the whole machine shudders, and a shear pin fails
with a bang.** The task at that band is: *find the input that jams it.*

That is the entire content of `relation-is-function` — *"One input with two different outputs breaks
it"* — as a physical event with a noise. And its commonest misconception, `repeated-output-rejected`
(*"says a relation is not a function because two inputs share the same output"*), is refuted
without a word: **two cables arriving at one pillar is fine, the machine runs, you watch it run.**
The world contradicts the misconception by working.

### 4 · The cost of being wrong

**One input plate**, which goes dark. Everything re-forms. No motes.

The pressure to think: the input rank has **every plate in the domain on it** — nine of them, not
three. This is not a menu, it is a number line. And because the throat runs visibly, **working the
machine forwards in your head is faster than walking the rank**, which is the same "correct
strategy is also the fastest" pressure the spindles have.

### 5 · Skill nodes carried

`eval-expr`, `rule-from-table`, `function-notation`, `domain-range`, `relation-is-function`.

- **`function-notation`** — *"f(3) is not f times 3 — it is the one output the rule gives when 3
  goes in."* The machine has one throat and one output per input, so `f(3)` **is** what comes out
  when you stand on 3. There is nothing to multiply.
- **`domain-range`** — the missing plates and the pillars that can rise.
- **`rule-from-table`** — the pin-board **is** a table, laid out as a rank of plates and a rank of
  pillars with cables between them, and `off-by-one-row` (*"reads the neighbouring row"*) is a real
  and physical error because the plates are in a row and you can be standing on the wrong one.
- **`eval-expr`** — assessed directly: stand on the plate that lifts the seal.
- **`relation-is-function`** — the jam.

**Named misconceptions:** `input-output-swap` (stand on 14 looking for 4 — the pillar shoots far
past the seal and you can see by how much), `off-by-one-row`, `range-ends-swapped`,
`repeated-output-rejected`, `repeated-input-accepted` (*"names an input that carries only one
output, so the real break goes unseen"* — you stood on a plate and the machine **ran**, which is
the refutation), `counted-not-checked`, `add-not-multiply` (the throat's cranks are counted, so
adding three where three cranks turn is visibly a different machine).

### 6 · Difficulty bands 1–5

| band | what moves |
|---|---|
| 1 | `f(x) = x + k`, domain `1..9`, one crank |
| 2 | `f(x) = kx + c` |
| 3 | the domain has a hole in it; the range is read off the pillars |
| 4 | the pin-board: a relation rather than a rule, read as a table |
| 5 | the jam — find the input with two cables; and `f(x) = x²`, where the throat squares |

### 7 · How it is verified

`pose(seed, band)` returns `{ rule | pairs, domain, range, sealHeight, answer }`, pure. The gate
evaluates the rule with an independent evaluator at every plate in the domain, asserts exactly one
reaches `sealHeight`, asserts the declared range equals the computed image, and — for the
pin-board bands — asserts exactly one input carries two cables and that at least one *output* is
shared by two inputs, so that `repeated-output-rejected` has something to be wrong about. The
commitment is **one integer**, the plate index.

`check:sites --play` must additionally assert the **jam** is legible: a screenshot before and
after must differ by more than a threshold in ink, not boxes (`landscape.mjs`'s method), because
"the machine shudders" is a claim about pixels and must be measured as one.

### 8 · Footprint and finding it

Two instances at **+97° r 210 y 44** and **+105° r 244 y 55**, against measured ceilings of
**50.1 / 46.5** base, **55.3 / 54.1** kite and **56.3 / 55.4** long span. Instance 1 is a base-wing
glide off the shoulder at r 142 @ 59 m. Instance 2 at 55 m sits above the kite ceiling and just
under the LONG SPAN ceiling — a **depth-26** site, one of only two in the archipelago that a
returning player reaches and a first-day player does not.

Deck 28 m — longer than a cache's, because the input rank has to be walkable.

**What it pays: a staircase whose steps are the function's own outputs.** On the seal, the output
pillars **stay up, for ever**, in order. A linear function pays an even staircase. A quadratic pays
one that steepens. **You climb the graph**, and from the top you can see the next site out. That is
the reward, the landmark and the mathematics as one object.

### WHY THIS IS NOT A QUIZ WITH A VIEW

The weak half of this site must be admitted first: **"stand on the plate that lifts the seal" is a
cache in a brass costume.** It is walk-into-the-right-candidate, and if that were all the ENGINE
did it should be cut.

Two things save it, and only two.

**The answer space is the domain, not a menu.** A cache offers three weights. The engine offers
**every input the function accepts**, and no more. That is not a design flourish; it is the
mathematics. `domain-range` is *"a rule does not accept every number"*, and the site says that by
having nine plates and a hole where zero would be. A learner standing at the edge of the gap,
looking down through where `f(0)` should be, has been taught something that the sentence "the
domain excludes zero" does not teach. **The menu is a fact about the function**, which means there
is no menu.

**And the jam cannot be done any other way.** `relation-is-function` on a card is a yes/no
question, and a yes/no question is a coin flip with a 50% floor — the single worst assessment shape
in the whole course, and the reason `counted-not-checked` (*"decides by counting rows rather than
by reading the inputs"*) survives. Here the question is not "is this a function". It is **find the
input that breaks the machine**, which is a search over the domain that cannot be guessed and
cannot be answered by counting anything. And when the learner finds it, the machine **breaks**, in
front of them, loudly, because two things tried to happen at once. There is no sentence in any
textbook that does what that noise does.

So: the ENGINE earns its place on the domain and the jam. If it were built with a rank of three
candidate plates and a silent verdict, it would be a cache with a different skin and it should be
refused at review.

---

## 4.5 · THE ARC — quadratics

**Bearings −135° … −142°. Colour: orange. Carries 5 skills.**

### 1 · What the player does with their body

**Stand where you think the thrown thing will come down.** Or, for the vertex, **climb to where you
think the top of its flight is, and stand there while it goes past you.**

### 2 · Where the mathematics lives on screen

A **throwing arm** on a perch, charged and aimed, and out in front of it a **field of standing
marks** on plates hanging in the gulf, ruled along the ground in the arm's own units. The rule is
carried on the arm — but the rule is not the mathematics on screen. **The trajectory is.**

The arm throws a weight, on a real ballistic arc, at a known launch speed and angle. Where it comes
down is a zero. Where it stops rising is the vertex. Both are places.

| in the notation | in the air |
|---|---|
| `h(t) = −at² + bt` | the flight of a thrown weight, run in front of you |
| a zero | **a plate on the ground the weight hits** |
| the vertex | **a plate on a pillar the weight passes level with, at the top of its climb** |
| the axis of symmetry | the two zeros are the same distance either side of it, pace it out |
| the maximum value | how high the pillar you are standing on is |

### 3 · What being wrong does, physically

**You stand on the mark you chose. Then the arm throws, and you watch the weight come.**

- **Right, for a zero:** it lands on the plate you are standing on. Everything locks.
- **Too near:** it **sails over your head** and lands further out, and you can pace the distance —
  the ground is ruled.
- **Too far:** it **falls short in front of you**, and you can pace that too.
- **Right, for the vertex:** it passes **level with your boots and stops rising.** You feel the
  turn happen beside you.
- **Too low, for the vertex:** it goes over you and **it is still climbing** when it passes.
- **Too high:** it passes **beneath** you.

Both signs from the first encounter, magnitude in metres you can walk. And the two vertex errors
are physically distinct in a way the two zero errors are not: *still climbing* is a different event
from *already falling*, and a learner who watches both learns what a turning point is without the
phrase.

**`highest-and-lowest-swapped`** and **`zero-called-the-turn`** are separated by geometry: standing
on a *zero* mark, the weight hits the deck at your feet; standing on the *vertex* pillar, it goes
over the top beside you and carries on. Those are different experiences and cannot be confused.

**And `square-root-method`'s `plus-only`** — *"reports one root and drops the one below zero"* —
gets the best refutation available anywhere: **the arm can be turned round.** There are two marks,
symmetric about the arm, and **both of them are real ground you can stand on.** The negative root
is not a sign convention. It is a plate, over there, that you can walk to.

### 4 · The cost of being wrong

**Nothing but the throw**, and the arm re-arms from the mark you are standing on — so **a miss does
not cost the climb.** This matters enormously and must be built in: the ARC is the only site where
being wrong could plausibly cost a two-minute traversal, and Rule 6 says a miss narrows and never
taxes. **The arm is re-fired by standing on any mark, including the one you just missed with.**

And the miss pays something back. **Where the weight lands, it leaves a standing plate.** So the
throws you got wrong build a line of stepping stones through the sky, and after a few attempts
**the trajectory is walkable.** A player brute-forcing this site is, without meaning to,
constructing a parabola out of the ground and then walking along it. I will take that trade: the
brute-force path and the teaching path are the same path.

### 5 · Skill nodes carried

`quadratic-zero-product`, `solve-by-factoring`, `square-root-method`, `parabola-features`,
`quadratic-model`.

**Named misconceptions** (ids verified in `algebra1-l4.json`):

| skill | wrong mark | what you see | misconception id |
|---|---|---|---|
| `parabola-features` | the mark at the constant term's height | the weight passes nowhere near you | `constant-called-the-turn` |
| `parabola-features` | the vertex input with the sign not turned | you are the same distance the **wrong side** of the axis | `turning-point-sign-wrong` |
| `parabola-features` | the low mark when the curve opens down | the weight is at its top on the far side of you | `highest-and-lowest-swapped` |
| `quadratic-model` | the input at the turn reported as the value at the turn | you stand at `t` metres out when the answer was `h` metres up | `turn-coordinates-swapped` |
| `quadratic-model` | the solution the story cannot carry | there is **a mark behind the arm**, and standing on it the weight flies away from you | `impossible-zero-chosen` |
| `quadratic-zero-product` | one zero taken, the other ignored | the second mark is still lit when the first is spent | `one-zero-only` |
| `square-root-method` | the positive root only | **the other mark is right there, symmetric, and lit** | `plus-only` |
| `solve-by-factoring` | a bracket constant copied as a solution | the mark is at `+3` where the answer was `−3`, and they are on opposite sides of the arm | `bracket-constants-copied` |

`impossible-zero-chosen` is worth its own note. *"Chooses the solution the story cannot carry, such
as a time before the launch."* At the ARC there is a mark **behind the arm** — the algebraically
valid but physically impossible root — and standing on it, **the weight is thrown away from you.**
The learner is standing in the past. That is the modelling misconception delivered as a physical
absurdity, and it is exactly what `quadratic-model` is for.

### 6 · Difficulty bands 1–5

| band | what moves |
|---|---|
| 1 | `x² = k` — two symmetric marks, whole roots |
| 2 | one zero given, find the other; symmetry only |
| 3 | the vertex: climb to the turning point |
| 4 | both zeros from a factorable rule |
| 5 | a modelling frame with an impossible root in the field |

### 7 · How it is verified

`pose(seed, band)` returns `{ a, b, c, zeros, vertex, marks, target }`, pure. The gate re-derives
zeros and vertex with an independent quadratic solver, asserts they are whole and inside the
field, asserts every mark is a distinct reachable plate, and — critically — **asserts the ballistic
integrator agrees with the algebra.** The arm's thrown weight is simulated by the same physics the
game runs and must land within `0.25 m` of the algebraic zero. That is the assertion that stops the
site from lying: if the physics and the notation ever disagree, the site is teaching a falsehood
and must not ship.

The commitment is **one mark index**. The vertex bands additionally record the pillar height stood
on, which is one more integer.

### 8 · Footprint and finding it

Two instances at **−135° r 214 y 64** and **−142° r 246 y 84**, against measured base ceilings of
**71.5 / 77.7** and kite ceilings of **78.6 / 87.4**. ARC 1 is a base-wing glide from the ridge at
r 120 @ 84 m; ARC 2 needs KITE TRIM.

The field extends **90 m out from the arm** and the highest vertex pillar stands **34 m** above the
deck. That is the site's footprint and it is the largest vertical extent in the archipelago, which
is correct: it is the only site whose subject is height.

**What it pays: the arc itself.** Every plate the weight left stays. Solve the site and the plates
**join into a walkable line of stepping stones following the trajectory** — from the arm, up over
the vertex, down to the far zero. **The graph becomes the bridge**, and it lands you 90 m further
out than you started, pointed at the next site.

### WHY THIS IS NOT A QUIZ WITH A VIEW

`parabola-features` on a card is four numbers read off three coefficients, and every one of its
misconceptions — `constant-called-the-turn`, `turning-point-sign-wrong`,
`highest-and-lowest-swapped` — is a *symbol-shuffling* error committed by a student who has no
mental picture of the curve at all. The card cannot supply the picture, because the card **is** the
symbols.

At the ARC the picture is not supplied either. **It is thrown at you.** You stand somewhere and a
heavy object either arrives where you are or does not, and the difference between "still climbing"
and "already falling" is something you watch happen a metre from your face. `quadratic-model`'s own
big idea is *"a thrown object, a fenced area and a price against takings all follow a squared
rule"* — and this is the first of those three, actually thrown, on real physics, with the algebra
required to agree with the integrator or the gate fails.

And then the site does the thing only a place can do: **the vertex is above you and you have to
get there.** Rule 9 says access must be a second difficulty axis. Here the second axis *is the
mathematics*: the highest point of the curve is the highest point of the site, and you climb to it
using the flight kit the game gave you. **A learner who has stood on a vertex knows what a maximum
is in a way that cannot be got from a picture of one**, because they had to work out how to be up
there.

Honest weaknesses, both real:

- **The traversal cost of a miss is the highest in the archipelago**, and the re-arm-from-any-mark
  rule is the only thing keeping it inside Rule 6. If that rule is not built, the site fails Rule 6
  and must be cut.
- **The brute-force path builds the answer.** Throw enough times and the stepping stones show you
  the curve. I judged that acceptable because the artefact of brute force is the teaching, but a
  reviewer could reasonably call it a leak, and it is why this site emits `assisted` evidence like
  every other.

---

## 4.6 · THE WEIR — inequalities

**Bearings −103° … −110°. Colour: deep cyan. Carries 4 skills.**

The brief said: *"a beam that must TILT and stay tilted is the obvious move; find a better one."*
Four reasons the tilting beam is wrong, before the alternative:

1. **Tilt already means WRONG.** A learner who has cracked three caches has spent an hour learning
   that a level beam is truth and a slammed beam is error. Reusing tilt to mean *correct* inverts
   the visual language of the whole archipelago at the exact moment a learner is being asked to
   extend it. That is not a neutral choice; it is actively destructive.
2. **A counterweight carries a number. An inequality's answer is a set.** `3x + 2 ≤ 11` is not `3`.
   It is *three and everything below it*, and a weight cannot be a ray.
3. **A tilted beam has no boundary in it.** The entire difficulty of `boundary-slip` — *"includes
   the boundary value in a strict inequality, or excludes it from a closed one"* — lives at one
   point, and a beam has no way to show the difference between `≤` and `<`.
4. **Two beams make nothing.** `compound-inequality` is *"two statements at once describe a band"*,
   and two tilted beams side by side describe two tilted beams.

**The answer is a set. So make the answer out of ground.**

### 1 · What the player does with their body

**Walk out along a causeway and find out where it stops holding you.** Then walk back and stand on
the last plate that held.

### 2 · Where the mathematics lives on screen

A **causeway**: a narrow line of numbered plates running out from a perch over the gulf, ruled
`… −2, −1, 0, 1, 2, 3, 4, 5 …`. It is the number line, and it is real `floor`.

Down the middle of the causeway runs a **channel**, and cipher-tide flows in it from the perch
outward. At the far end stands **the weir** — and the weir is the statement:

- **On the near side of the weir**, standing in the channel, is a **column of tiles**: for
  `3x + 2 ≤ 11`, three tall violet `x`-tiles and two small cyan units, the caches' own tile
  language, unchanged.
- **On the far side** is a **wall of eleven units.** That is the right-hand side, and it is a
  height the tide either clears or does not.

**Stepping onto plate `k` substitutes `k`.** Each `x`-tile becomes `k` units, one for one, on the
near column, in front of you — the caches' `layout()` behaviour exactly. And then **the tide rises
to the top of the near column**, and:

- **`3k + 2 ≤ 11`** — the tide sits at or under the wall's head. The channel holds. **You stay
  dry, and the plate holds you.**
- **`3k + 2 > 11`** — the tide **overtops the wall and pours back down the causeway at you**, and
  every plate from the overtopping point outward **goes dark and drops into the gulf.**

**The solution set is the causeway that is still there.**

### 3 · What being wrong does, physically

There is no "wrong answer" at a weir in the way there is at a cache. **There is a place where the
world stops holding you**, and finding it is the task.

- **Direction:** which way the water came from.
- **Magnitude:** **how deep the tide runs over the wall**, in units you can count against the
  wall's own courses. `3k + 2 − 11` is standing there as a depth.
- **The boundary itself:** and this is the site's best single stroke. For `≤`, the plate at the
  boundary **holds you.** For `<`, that same plate **gives way under your boots and drops**, and
  you land on the one behind it. **A strict inequality is a plate you cannot stand on.** That is
  `boundary-slip` — the misconception the graph names on all four inequality skills — turned into a
  physical sensation, and I do not know of another way to deliver it without words.

**And `compound-inequality` is two weirs on one causeway.** `2 < x + 1 ≤ 6` is a weir at each end.
Walk out and you get wet at the far end; walk back past the near weir and you get wet at that end
too. **The dry stretch in the middle is the band**, and it is standing in the sky where you can see
both ends of it at once.

Its misconception `band-reversed` — *"writes the band with the larger number first, so it describes
no value at all"* — arrives as **the two weirs overlapping and the entire causeway flooding.**
There is nowhere to stand. **The empty set, made of water.** A learner who sees that once
understands why `5 < x < 2` is not a small mistake.

### 4 · The cost of being wrong

**You get wet, and some plates fall.** No motes, no lockout. The tide recedes and the causeway
re-forms after a delay, exactly as a cache's weights do. If a plate drops out from under you,
`escape.js` catches you — **nothing in this world may ever cost you the route.**

The pressure to think: walking out one plate at a time and watching the tide climb is slow, and the
tide is coming at you. **Reading the column and predicting the flood is faster than testing every
plate.** That is the same incentive shape as the spindles and the engine, and it is the only kind
of pressure that is safe to apply to somebody who is learning.

### 5 · Skill nodes carried

`inequality-one-step`, `inequality-two-step`, `inequality-multi-step`, `compound-inequality`.

**Named misconceptions:** `boundary-slip` (the plate that holds or gives way), `partial-rule`
(*"undoes the loose number and stops before dividing"* — the tide clears the wall by exactly the
coefficient you failed to remove), `sign-on-constant`, `same-op-both`, `band-reversed`,
`collect-wrong-side`.

### 6 · Difficulty bands 1–5

| band | what moves |
|---|---|
| 1 | `x + b ≤ c`, one weir, closed |
| 2 | `ax ≤ c`, the coefficient appears |
| 3 | `ax + b ≤ c`, and strict signs enter — boundary plates start giving way |
| 4 | a bracket to distribute before the column can be read |
| 5 | two weirs — the band, including the reversed case that floods everything |

### 7 · How it is verified

`pose(seed, band)` returns `{ a, b, c, rel, solutionPlates, boundaryPlate, strict }`, pure. The gate
re-derives the solution set with an independent inequality solver over the causeway's integer
range, asserts `solutionPlates` is exactly that set, and asserts the **boundary plate's own state
matches `strict`** — closed means it holds, strict means it drops. That last assertion is the one
worth building the gate for: `boundary-slip` is the misconception most likely to be introduced
*by the implementation*, and this catches it at build time rather than in a classroom.

The commitment is **one plate index** — the outermost plate the player ends standing on when the
tide settles. Fully checkable.

### 8 · The flip, and the honest limit

**The site cannot teach the flip, and it must say so in its own header.**

`inequality-one-step`'s big idea ends: *"One move is different: divide by a negative and the lean
turns round."* Two reasons the weir cannot carry it:

- **A pan and a channel both hold counted objects, and there is no negative quantity of water.**
  `−2x + 1 ≥ 7` has no column.
- **The flip is a fact about a symbolic operation, not about a set.** A learner who walks the
  causeway and finds the dry stretch of `−2x + 1 ≥ 7` — which is `x ≤ −3` — has found the right
  answer **and has learnt nothing about why the sign turned**, because they never performed a
  division. A value check cannot tell "flipped correctly" from "tested and found out".

So: **`flip-always` and `flip-not-needed` belong to the rift**, and the weir must not be asked to
carry them. This is the Rule 4 escape clause used honestly — *"a new site must generate at least one
distractor on each side, or state in its own header why it cannot"* — and stating it is worth more
than a mechanism that pretends.

What the weir gives the rift in exchange is the concept the rift is worst at: **a solution set is a
place, not a number.** A learner who arrives at `flip-always` having already stood on the dry
stretch of a causeway has something for the symbol manipulation to be *about*.

### 9 · Footprint and finding it

Two instances at **−103° r 200 y 30** and **−110° r 234 y 44**, against measured base ceilings of
**35.4 / 31.1** and kite ceilings of **48.7 / 46.8**. WEIR 1 is the base wing; WEIR 2 needs KITE
TRIM. Both launch from the island's central high ground at r 24 @ 58 m.

The causeway is **68 m long** — seventeen plates at `CELL = 4 m` — running outward from a 16 m
perch. It is the narrowest footprint in the archipelago and the longest, which reads unmistakably
as a number line from the air.

**What it pays: the causeway.** The plates that held **stay, for ever**, and the ones that fell
**stay fallen.** So the solution set is standing in the sky, permanently, as the shape of the
ground — and the next player to fly past can read the answer to a problem they have not met yet off
the skyline. **Your answer is the landscape.**

### WHY THIS IS NOT A QUIZ WITH A VIEW

`x ≤ 3` typed into a pad is a string. The learner who types it and the learner who understands it
produce the same six characters, and the engine cannot tell them apart — which is why
`boundary-slip` survives every assessment ever built for it: `x ≤ 3` and `x < 3` differ by one
glyph, and a student who has no idea what the glyph means gets it right half the time.

**At the weir there is no string.** There is a stretch of causeway that holds you and a stretch
that does not, and the boundary is a single plate that either takes your weight or drops you into
the sky. **You cannot be half-right about whether the floor is there.** That is the whole argument
for this site, and it is enough on its own.

The second argument is `compound-inequality`. On a card, a band is a compound expression with two
relation symbols and a variable in the middle, and the commonest error — writing it backwards so it
describes nothing — is invisible to the student, because a string that describes nothing looks
exactly like a string that describes something. **Here it is a flooded causeway with nowhere to
stand on it.** The empty set is a thing you are looking at, in the rain, from the perch.

The honest weakness, and it is the reason this site is ranked seventh of eight rather than higher:
**walking out plate by plate is guess-and-check, and guess-and-check finds the answer.** I accept
it, for one specific reason: **guess-and-check on a number line is not a degenerate strategy for
inequalities, it is the definition of the concept.** CCSS's own framing is that a solution set is
the set of values that make the statement true, and testing values is how that set is found. A
learner who walks the causeway is doing the mathematics, slowly. A learner who reads the column and
predicts the flood is doing it quickly. **Both are doing it**, which is not true of a learner who
guesses on a card.

---

## 4.7 · THE CHAIN — sequences

**Bearings +142° … +150°. Colour: pale rose. Carries 3 skills.**

### 1 · What the player does with their body

**Fly out along a line of small perches, counting the stones on each. Where the line stops, walk
into the pile that comes next.** Then walk on, further out than you were.

### 2 · Where the mathematics lives on screen

A **chain**: a run of small perches marching outward from the island, one per position, numbered on
their own decks — `1, 2, 3, 4 …` — and each carrying **a countable pile of stones.** Perch 1 holds
`a` stones, perch 2 holds `a + d`, perch 3 holds `a + 2d`.

**The sequence is not written anywhere.** It is a row of piles you fly along and count. The rule is
something you read off the structure by holding two neighbours against each other.

The chain **stops.** At some position the next perch is dark and unformed, and beside it float
**three piles of stones**, each a different visible height. Walk into the pile that continues the
pattern and it lands on the perch, the perch lights, and it becomes real floor. Now you can go on.

### 3 · What being wrong does, physically

The pile you chose **flies to the perch, lands, and stands beside its neighbours** — and then you
are looking at four piles in a row, three of them in a pattern and one of them not. **You can see
the step break.** The stones are countable; the difference between your pile and the one it should
have been is a number of stones standing there.

- **Too many:** a taller pile in a line of even steps, and the surplus is countable.
- **Too few:** a shorter one, and the gap is countable.
- **The wrong kind:** for a geometric chain, a pile that *added* the factor rather than multiplying
  by it. From perch 4 onward those two are visibly different by a lot, and the further out you are
  the more obviously different they are. **The chain's own growth is the diagnostic.**

Then the pile falls away, the perch goes dark again, and you try another.

**`position-off-by-one`** — *"reads the first printed value as the value at position zero"* — is
refuted by the deck under your boots. **The perches are numbered and you walked from the first
one.** You can walk back and count them. There is no ambiguity about which position you are
standing at, which is a thing a printed table can never quite promise.

### 4 · The cost of being wrong

**One pile, and nothing else.** No motes. All three re-form. And — the reason the site is safe —
**you can always turn round and go back.** The chain behind you is solid; only the chain ahead is
in question.

### 5 · Skill nodes carried

`sequence-terms`, `sequence-nth-term`, `linear-vs-exponential`.

**Named misconceptions** (ids verified in `algebra1-l5.json`): `step-from-the-first-pair-only`
(*"takes the step from the first two values and never checks the rest"* — and at a chain you flew
past four perches to get here, so the site has already shown you the rest),
`step-and-factor-confused`, `position-off-by-one`, `falling-step-made-positive`,
`rule-applied-to-the-position`, `offset-dropped`, `factor-power-off-by-one`,
`adding-formula-used-for-multiplying`, `position-returned-instead-of-value`.

### 6 · Difficulty bands 1–5, and the site's one big idea

| band | what moves |
|---|---|
| 1 | arithmetic, positive step, the gap is at position 5 |
| 2 | arithmetic, falling step |
| 3 | geometric, factor 2 or 3 |
| 4 | **the gap is far out** — position 12, and the chain between is missing |
| 5 | **the gap is at position 20**, and there is no chain to walk |

**Bands 4 and 5 are the reason to build this site**, and they are the best pedagogical argument in
this whole document.

`sequence-nth-term`'s big idea is: *"Instead of walking value by value, one formula gives any value
straight from its position."* Every student who has met that sentence has had the same unspoken
reply: **why not just add it up twenty times?** And there is no good answer on paper, because on
paper adding it up twenty times takes forty seconds.

**Here, adding it up twenty times is a five-minute flight.** The gap at position 20 is 260 metres
out, past the leash's own limit for a comfortable trip, and there is no chain between you and it —
just open sky. **The recursive rule is a walk. The closed form is a glide.** The learner does not
have to be told which one they would rather do; they are standing on perch 6 looking at a dark
perch on the horizon.

**And `linear-vs-exponential` is two chains side by side.** *"Given enough steps, the factor always
overtakes the amount."* Two chains launched from the same coast at the same starting pile, one
adding and one doubling. **By perch 8 the doubling chain's piles are a skyline.** You can see where
it overtakes, from the island, without counting anything.

More than that: **the gaps between the perches grow with the sequence.** An arithmetic chain's
perches are evenly spaced and walkable. A geometric chain's perches get further apart every step,
and by perch 7 **the gap is too wide to jump and you have to fly.** The growth rate is a thing you
feel in your legs and then in your wing. That is `linear-vs-exponential` delivered as traversal
difficulty, and it is the single cleanest fusion of mathematics and movement I found.

### 7 · How it is verified

`pose(seed, band)` returns `{ kind, first, stepOrFactor, gapAt, piles, answer }`, pure. The gate
re-derives every term with an independent sequence evaluator, asserts the pile at every built
perch matches, asserts the three candidate piles are distinct and countable (`≤ 34` stones, the
caches' own limit), and asserts **the perch spacing matches the declared growth** — an arithmetic
chain's gaps constant, a geometric chain's gaps scaling — so that the traversal argument above is
a property the gate holds the build to rather than a nice sentence in a design document.

`check:sites --reach` gets an extra job here: it must assert that **the band-5 gap is not walkable
and not jumpable**, by simulating the jump arc from the last standing perch. If it is jumpable,
band 5's whole argument evaporates.

The commitment is **one pile index**. Fully checkable.

### 8 · Footprint and finding it

One chain per instance, running from **+142° r 190 y 30** outward to **+150° r 262**, which is
within a few metres of the leash at 272 — **the far end of a band-5 chain is one of the furthest
places a player can stand.** Measured base ceiling at the head is **36.6** and kite ceiling at the
tail is **45.3**, so the head is a base-wing glide from the island centre and the tail wants KITE
TRIM.

Each perch is small — a **12 m deck**, `SPAN = 1`, 9 `fixed` `floor` cells — because a chain of
twenty 20 m decks would be a road, and this is meant to read as stepping stones.

**What it pays: the chain itself.** Every perch you complete stays for ever. So the reward is a
stepping-stone road out to the edge of the world, **and its spacing is the sequence.** Walking home
along an arithmetic chain is an even rhythm. Walking home along a geometric one is a series of
increasingly desperate flights. **You feel the growth rate on the way back.**

### WHY THIS IS NOT A QUIZ WITH A VIEW

A sequence item on a card is a row of four numbers and a blank. Every misconception the graph names
for it — `position-off-by-one`, `step-from-the-first-pair-only`, `step-and-factor-confused` — is a
**reading error about a row of printed numbers**, and the card cannot fix a reading error about
itself.

The chain is not a row of printed numbers. **It is a row of places**, each with its own floor and
its own number cut into it, and you got to perch 6 by flying past perches 1 through 5 and looking
at them. `step-from-the-first-pair-only` is difficult to commit when the site has already made you
travel past the rest of the list. `position-off-by-one` is difficult to commit when you are
standing on the position.

But the real argument is bands 4 and 5, and it is an argument about **motivation rather than
representation**, which makes it different from every other site here. Every other site makes a
concept visible. The chain makes a concept **necessary**. The closed form of a sequence is a labour
saving device, and a labour saving device is worthless to somebody for whom the labour is free. On
paper the labour is free. **At the chain the labour is a five-minute flight into empty sky**, and
the formula is the thing that lets you skip it.

That is the answer to "why do we have to learn this", delivered as a distance.

The honest weakness: **the closed form itself is a rule, and this site cannot check a rule.** What
it checks is the *value at position n*, which is a number. So `sequence-nth-term` is carried here
only in the sense that the site creates the need and tests the result; **the formula is written in
the rift.** That split is stated rather than hidden, and it is the same split `system-elimination`
has at the MEET.

---

## 4.8 · THE READINGS — data and trend lines

**Bearing −47°. Colour: violet-white. Carries 2 skills. Ranked last, and the reason is in the last
paragraph.**

### 1 · What the player does with their body

**Fly through a cloud of readings.** A cable pays out behind you as you go. Where you entered and
where you left are the two ends of a straight chord, and **that chord is your model.**

### 2 · Where the mathematics lives on screen

A **cloud**: forty or so bright motes hanging in the air over a ruled plot, at positions that are
real measurements of this world — the height of the island's ridges against their distance from the
centre, the yield of a mote vein against how long it has been recharging, the height a drift column
throws you against how tall it stands. **Quantities the player has already walked among.** The plot
is ruled on both axes and the axes are labelled in the world's own units.

**Your cable is the model.** Straight, from entry point to exit point, drawn in light, hanging over
the plot.

**And then the residuals arrive.** Every reading in the cloud **drops a plumb-line to the cable** —
a visible vertical thread, one per reading, with a length you can compare against every other one.
Threads to readings **above** the cable are one colour; threads to readings **below** are another.

That is the whole apparatus. A cloud, a chord, and forty coloured threads.

### 3 · What being wrong does, physically

Two failure signatures, and they correspond exactly to the two skills.

**For `scatter-regression`: the threads are long.** A bad line hangs visibly away from the cloud and
the threads are metres of visible cord. A good one sits in the middle of it and the threads are
short. You can fly under the plot and look up at them.

The named misconception `first-and-last-joined` — *"draws the line through the first and last
readings and calls it the closest line"* — is the site's best single moment. **Fly from the first
mote to the last mote and the cable is a perfectly reasonable-looking line**, and then the threads
appear and **almost the whole cloud is hanging on one side of it.** You are looking at a line that
touches two points and misses everything.

**For `residual-and-fit`: the colours come in runs.** Walk along your own cable and look down the
line of threads. If the model is the right shape, the colours **alternate** — above, below, above,
below, scattered. If a straight line has been laid across curved data, the colours come in
**blocks**: eight of one, then twelve of the other, then eight of the first again. *"Gaps that keep
the same sign along a run say the wrong shape of rule was chosen"* is a thing you see in one glance
because it is a stripe.

**And `single-largest-gap-used`** — *"judges the fit by the one biggest gap rather than by the
pattern of the gaps"* — is separated physically by two candidate cables you can walk under and
compare: one with a single very long thread and forty short ones, one with forty medium ones. The
learner has to decide which is the better fit while looking at both.

### 4 · The cost of being wrong

**Nothing but the flight, and the flight is the good part of this game.** Re-stringing is free and
unlimited.

Each attempt leaves its cable behind as a **ghost** — dim, still hanging, with its threads gone. So
after four attempts you are flying inside a visible record of your own converging guesses, and the
best one is obvious because it is the one nearest the middle of the cloud. **The site accumulates
its own teaching.**

### 5 · Skill nodes carried

`scatter-regression`, `residual-and-fit`.

**Named misconceptions:** `first-and-last-joined`, `rate-from-one-pair`,
`smallest-reading-called-the-start`, `prediction-read-off-the-data` (a prediction band asks for the
model's value at an input where **there is no mote**, so answering with the nearest reading means
flying to a mote that is visibly not on your cable), `residual-sign-flipped`,
`single-largest-gap-used`, `curved-data-kept-linear`.

### 6 · Difficulty bands 1–5

| band | what moves |
|---|---|
| 1 | eight readings, tight, strongly linear |
| 2 | twenty readings, more scatter |
| 3 | a prediction: hit a marked target height at an input with no reading on it |
| 4 | forty readings, one outlier that must not drag the line |
| 5 | curved data — the straight cable can be flown well and its threads still run in blocks |

### 7 · How it is verified

`pose(seed, band)` returns `{ readings: [[x, y]…], best: {m, c}, tolerance, curved }`, pure. The
gate computes the least-squares fit with an independent regression, asserts the declared `best`
matches, asserts the tolerance band is wide enough that a good flight can hit it and narrow enough
that `first-and-last-joined` cannot, and — for band 5 — asserts the sign-run test **actually fires**
on the curved bank and **does not fire** on the linear one. That second half is the pattern the
project already insists on: *"a threshold picked to catch one defect is worthless if it also
catches the twenty skills either side of it."*

The commitment is **two points in the plot's own coordinates** — where the cable entered and where
it left — quantised to the plot's ruling, so it is two integer pairs. Fully checkable, and
re-derivable from `pose` alone.

### 8 · Footprint and finding it

One instance at **−47°, r 222, y 112 m**, in the 22° gap between span 1 and span 0. That bearing's
best launch is **r 138 at 134 m** — the Spine's own shoulder, the highest ground in the world — and
the measured base-wing ceiling there is **123.0 m.** So the READINGS sits at **112 m**, the highest
site in the archipelago, reached on the base wing by the most dramatic launch available.

That is deliberate and it is the site's whole staging: **its subject is seeing a pattern in a
scatter, so you arrive looking down on it from the highest point in the game.**

Two mooring towers, **140 m apart**, with the cloud between them. Footprint by far the largest here,
because it is mostly empty air with motes in it.

**What it pays: the cable goes taut and becomes a bridge.** Real `fixed` floor, 140 m of it, over
the deepest gulf in the world. **The best-fit line is a road**, and a bad-fit line is a slack rope
you can see sagging through the data. The metaphor and the mechanism are the same object.

### WHY THIS IS NOT A QUIZ WITH A VIEW — AND WHERE THE ARGUMENT IS WEAKEST

The strong half first. `scatter-regression` on a card is a printed scatter plot with four candidate
lines drawn on it, and the student picks the one that looks best. That is **not a bad item** — it
is genuinely closer to the mathematics than most — but it is a picture, and the student is a reader
of it.

Here the student is **inside the plot, flying**, and the line is the path their own body took
through the data. `rate-from-one-pair` is hard to commit when the rate is the angle you held your
wing at. And the residuals are not a computed column in a table; they are **forty coloured cords
hanging in the air that you can fly under and look up at.** The pattern in their signs is a stripe
across the sky.

Now the weak half, stated plainly because the brief asked for it.

**This site's commitment is two points, and two points is two numbers.** Strip away the flight and
what remains is: choose an intercept, choose a slope. That is uncomfortably close to a keypad in a
nicer frame, and it is the reason this site is ranked eighth of eight.

Three things keep it on the right side of the line, and if any of the three is dropped in
implementation **the site should be cut**:

1. **The two points are chosen at speed, in the air, and a flight is a thing you can do well or
   badly.** If the site is ever built with two ladders and two notches to stand on, it has become a
   keypad and it must be refused.
2. **The residuals are the teaching, and they arrive after the commitment, not before.** If the
   threads are drawn live while the player is choosing their line, the site becomes a slider and
   the mathematics evaporates.
3. **The data must be about this world.** If the cloud is forty random numbers, `residual-and-fit`
   is arithmetic and the site is decoration. If it is the island's own ridges, the learner is
   modelling a place they have walked.

And one skill I refuse to claim for it. `association-strength` — *"a two-way table splits one count
against three different wholes, and a share is never a cause"* — has **no physical form at all.** A
two-way table is a piece of notation about categories, there is nothing to fly through and nothing
to weigh, and any attempt to render it as a place would be a card on a plinth. It stays in the
rift, and §5 says so.

---

## 5 · THE COVERAGE, HONESTLY

62 skills. The partition below was **checked by script**: every id appears exactly once, every id
exists in `content/graph/`, nothing is missing, nothing is double-counted.

| bucket | count |
|---|---:|
| **carried by a site** — the mathematics is the mechanism | **43** |
| **taught by a site, assessed only in the rift** | **3** |
| **rift only** — no honest physical form exists | **16** |

### 5.1 · Carried by a site (43)

| site | skills |
|---|---|
| **THE CACHES** (built) | `one-step-add` `one-step-mul` `two-step` `multi-step` `both-sides` `bracket-both-sides` |
| **THE SPANS** (built) | `distribute` |
| **THE SPINDLES** | `exponent-product` `exponent-power` `exponent-quotient` `zero-negative-exponent` |
| **THE MEET** | `slope-rate` `graph-linear` `system-substitution` `system-elimination` `system-graphically` `inequality-two-var` |
| **THE YARDS** | `like-terms` `poly-multiply` `factor-common` `factor-trinomial-monic` `factor-trinomial-lead` `difference-of-squares` `complete-the-square` |
| **THE ENGINE** | `eval-expr` `rule-from-table` `function-notation` `domain-range` `relation-is-function` |
| **THE ARC** | `quadratic-zero-product` `solve-by-factoring` `square-root-method` `parabola-features` `quadratic-model` |
| **THE WEIR** | `inequality-one-step` `inequality-two-step` `inequality-multi-step` `compound-inequality` |
| **THE CHAIN** | `linear-vs-exponential` `sequence-terms` `sequence-nth-term` |
| **THE READINGS** | `scatter-regression` `residual-and-fit` |

**Four of these are carried partly, and the split is stated at the site rather than buried here:**
`multi-step` (a value check cannot see whether each side was simplified first),
`system-elimination` (a value check cannot tell elimination from substitution),
`sequence-nth-term` (the site creates the need and tests the value; the formula is written in the
rift), `bracket-both-sides` (needs the bracket rendered as a **tray** of tiles that move together,
which is a proposal and not a proven form).

### 5.2 · Taught by a site, assessed only in the rift (3)

- **`var-meaning`** — the pattern study already named the irony and it is worth repeating: the
  x-tile **is** the definition of a variable, and watching two of them become six cubes is the whole
  idea. But there is nothing to weigh. **The best teaching of this skill in the build cannot assess
  it at all.**
- **`order-ops`** — the ENGINE's throat is a physical chain of machinery and the cranks are upstream
  of the rack, so the order of operations is the order of the parts. But you cannot answer "which
  operation first" by standing somewhere; you can only watch it be true.
- **`parallel-perpendicular`** — the MEET's parallel case is a genuine and unforgettable physical
  fact: two rails going out over the sea beside each other for ever, and a beam that never levels.
  But the *answer* to a `parallel-perpendicular` item is a **rule**, and three candidate rules on
  three identical plinths is a multiple-choice card with a view.

### 5.3 · Rift only, with the reason (16)

**The answer is a rule, and the rule has no shape you can see before you commit.** This is Rule 2's
own test applied honestly. `write-linear`, `point-slope-form`, `write-system`,
`quadratic-from-vertex`, `exponential-rule`, `exponential-model`, `literal-equations`.

`literal-equations` resists hardest and is worth naming: its subject is **symbolic rearrangement
with no quantity attached to rearrange.** Solve `A = ½bh` for `h` and nothing anywhere has got
bigger or smaller. There is nothing to weigh, count, lay, fly or stand on.

**The answer is not a countable quantity.** `fraction-solve` (a pan cannot hold a third),
`radical-simplify`, `radical-arith`, `rational-exponent`, `quadratic-formula`.

`rational-exponent` is the near miss and it deserves its reason. `x^{1/2}` could be a **half ring**
on a spindle, and `√x · √x = x` would be two halves making a whole, which is correct and rather
beautiful. It is cut because `8^{2/3}` is two thirds of a ring, and **the moment a learner has to
read "two thirds of an object" off geometry, the cover test fails.** A count of objects is
countable. A count of fractions of objects is a picture of a fraction, and we already have those.

**The answer is an expression.** `poly-add-sub`, `poly-divide`.

`poly-add-sub` is the other near miss. Two heaps of tiles combined and sorted into three bays is a
real and good manipulative, and it very nearly works at the YARDS. It is cut because **the answer
is a polynomial**, and three candidate polynomials is three plinths with expressions on them —
Rule 2's forbidden case, and precisely the halfway house `waygate.js` occupies. If a later wave can
give the *candidates* a shape, this comes back.

**Structural, and there is nothing to make.** `ratio-proportion`, `association-strength`.

`ratio-proportion` was listed by the pattern study under "fits the balance", and I disagree with
that call for a specific reason: **the balance carries the arithmetic and destroys the concept.**
`3 : x = 6 : 8` reduces to `6x = 24`, which a cache solves — but the learner has then done a
one-step equation, not a proportion, and the structure the skill is about has vanished into the
apparatus. A similar-rectangles form at the YARDS is plausible and unproven; until somebody proves
it, this is rift work.

`association-strength` has no physical form of any kind. A two-way table is notation about
categories. There is nothing to fly through.

### 5.4 · The headline, and where it disagrees with the pattern study

The pattern study concluded: **18 of 62** fit the balance; **23** need a different machine; **21**
cannot be an off-island site at all; and the archipelago could reach *"a little over half the
course"*.

This document reaches **43 of 62 with the mathematics as the mechanism** — better than two thirds.
The whole of that difference comes from one correction and one extension:

**The correction: the exponent block was mis-sorted, and the mis-sorting is instructive.** The
pattern study asked *"can a pan hold the answer"* and got `128` and said no. The right question was
*"is the mathematics a count"*, and the graph answers it in the skills' own big ideas, four times,
in the word **count**. Four skills move from NEVER to a site, and they move to the site I would
build first.

**The extension: three of the pattern study's five proposed sites turned out to carry more than it
credited them with.** THE MEET picks up `graph-linear`, `slope-rate` and `inequality-two-var`
because a plot you walk on is a coordinate plane and a coordinate plane carries all three. THE
YARDS picks up the whole factoring block because the span's apparatus, run backwards, is factoring
by definition. THE ARC picks up `square-root-method` and `solve-by-factoring` because a symmetric
trajectory has two zeros and both of them are ground.

**And one place where the pattern study was more right than it knew.** Its closing warning was:
*"What is deliberately absent from this list: five more balances holding `a·x + b = c` with
different numbers."* Of the eight sites here, **exactly one uses a balance at all** — THE MEET —
and it uses it as a *live instrument responding to the player's position*, which is a different
machine wearing the same parts. Seven of the eight are new apparatus. That was the bar and it is
the bar I held myself to.

---

## 6 · HOW ANY OF THIS IS VERIFIED

This project's iron rule is that an unverified item does not ship. **Today, no off-island site is
covered by any gate.** `npm run check --list` names twenty-odd gates and not one of them looks at
`caches.js`, `span.js`, `waygate.js` or `warden.js`. The caches' question generator has never been
independently re-derived; its answers are correct **by construction**, which is exactly the
condition `tools/validate-items.mjs` exists because of.

Eight new sites cannot be added on top of that. So the verification design comes first, and it has
one structural requirement.

### 6.1 · The structural change: split the mathematics out of the renderer

`question(seed)` and `deepQuestion(seed)` live **inside** `createCaches`, in a module that imports
`three` and touches the DOM. Nothing headless can reach them. That is the reason there is no gate,
and it is the only reason.

> **PROPOSED: `src/world/sites/*.js` — one pure module per family, holding only the mathematics
> and the geometry as numbers.** No `three`. No DOM. No i18n. Exports exactly two functions:
>
> ```
> pose(seed, band)            -> { statement, latex, answer, candidates, geometry }
> verdict(pose, commitment)   -> { correct, misconception, residual }
> ```
>
> The world module imports the site module and draws it. The gate imports the site module and
> checks it. **Neither can drift from the other, because there is one description.**

`candidates` is a list of `{ value, misconception }`, where `misconception` is `null` for the true
one and otherwise **an id that exists on that skill's node in `content/graph/`**. `residual` is the
signed, scaled error in the site's own units — tiles, rings, holes, notches, metres — which is what
Rule 4 is made of.

That shape mirrors `content/` exactly: **courses are data, not code.** Sites should be too.

### 6.2 · How a physical answer becomes a checkable one

The player's answer is a position. It is made checkable by recording a **commitment record** and
never trusting the site's own verdict:

```
{ site: 'spindle', key: 's2', seed, band, commitment, pos: [x, y, z], t }
```

`commitment` is always small integers: a candidate index, a lattice cell, a plate index, a mark
index, a pair of rail marks, two quantised plot points. The checker calls `pose(seed, band)` and
`verdict(pose, commitment)` and re-derives the outcome from those alone. **What the site said
happened is not evidence.** That is the same discipline as *"answers were once correct only by
construction"*, applied to a place instead of a card.

### 6.3 · Five gates, and what each exists because of

**1. `check:sites` — the mathematics.** For every family × seed × band, in EN/ES/PL: an independent
solver re-derives the answer; every statement renders through `src/ui/tex.js` under
`throwOnError: true, strict: 'error'`; every candidate is distinct under mathematical equality; and
**every wrong candidate carries a misconception id that exists on that skill's graph node.** That
last check makes Rule 5 mechanical instead of aspirational, and it is checkable today — I verified
every id quoted in §4 against `content/graph/` while writing it.

*Exists because:* the caches' `wrongA = c − b` and `wrongB = round(c/a)` are documented in comments
and enforced by nothing.

**2. `check:sites --reach` — the access ladder.** For every instance: compute the best launch on its
bearing from `src/world/terrain.js`, solve the wing's equilibrium at each trim from
`src/player/locomotion.js`, and assert the site is reachable at the kit rung it claims **and not at
the rung below it.** Every number in §3.4 came out of a thirty-line script; this gate is that
script with assertions.

*Exists because:* Rule 9's forbidden case is *"five sites at the same height"*, and nothing today
would notice. It also catches the `span.js` defect — a site hung off a launch pad nobody can stand
on — because the launch has to be a real reachable point, not just the highest number on the
bearing.

**3. `check:sites --commit` — the accidental-commit hazard.** For every pair of candidate capture
regions, and every straight path between them, assert the path enters no third region. Pure
geometry, no browser.

*Exists because:* the pattern study **reproduced twice** that walking across a cache's deck from one
counterweight toward another commits an answer the player never chose, and that on a deep cache
`gap = 2.9 m` against a horizontal capture radius of `1.04–1.65 m` means the discs **overlap**. A
site where the answer can be given by accident is not a site. This is a unit test and it would have
caught it from the source.

**4. `check:sites --tags` — label arbitration.** Assert no site module writes `.style.left`
directly, and that every world label is submitted through `src/world/tagspace.js`.

*Exists because:* `.field-tag` is **chrome** to `tagspace.js` — nothing arbitrates it. `waygate.js`
already paid **452 overlaps across 126 of 288 layout frames** for exactly this. `caches.js` prints
every unopened cache's labels inside `reach = 74 m` (140 with RESONANT SIGHT) while `DEEP_CLEAR` is
only **46 m**, so two statements and six weights can be on the glass at once. With eight families
in one ring, this stops being a latent defect and becomes a certainty.

**5. `check:sites --play` — the real game, with real keys.** In the shape of
`tools/critic/traverse.mjs`: from a cleared save, on a frozen build, on its own port, fly to each
site and take every wrong candidate and then the right one. Assert:

- every wrong state is **visibly different** from every other wrong state — measured as **ink, not
  boxes**, which is `landscape.mjs`'s method and exists because bounding boxes reported no overlap
  while text printed over text;
- the wallet is unchanged **to the mote** across every miss (Rule 6);
- every candidate re-forms, and the site is completable after exhausting them (Rule 6);
- the site opens, and **the reward exists in the world afterwards** — a new drift column, a new
  road, a new mast, a new deck — verified by reading the world back, not by reading a flash message
  (Rule 8);
- **the resolution beat survives the payment**: the player is still on the deck, and the apparatus
  is still legible, for at least two seconds after the seal (Rule 8's amendment, which exists
  because the caches' updraft picks the player up before they see the level beam);
- zero console errors.

**And it may not use `window.__ascent` to make progress.** That is the rule that hid more defects
in this project than any other cause, and the harness must be forbidden it by construction, the way
`coldplay.mjs` is.

**Every one of the five answers `--self-test`**: it plants the exact defect it exists to catch,
proves the rule fires, and proves the same rule stays quiet on the nearest honest site in the same
bank. *A gate nobody has watched refuse anything is not a gate.*

### 6.4 · What a site reports to the record, and what it must never claim

`mastery.observe` already takes the meta a site needs:

```
observe(id, correct, { assisted, misconception, form, kind })
```

**Every site observation must set `assisted: true`.** The reason is structural, not cautious: a
site that tells you which way you were wrong, by how much, and lets you try again for free
**cannot produce unassisted evidence**, and the engine already weights an assisted success at
`prior + (post − prior) * 0.35` and refuses it for `cleanRun`, `formsSeen.correct` and the gate
ledger. That is exactly the right treatment. A site therefore:

- **may** move a learner's belief a little;
- **may** record a misconception, which is what feeds the echo aimed at what the learner just
  revealed;
- **may never** close a proving run, satisfy a gate-band requirement, or carry a mastery claim.

Today the caches emit **nothing at all**, which is the opposite error: the teacher record cannot
say that a learner solved `2x + 1 = 7` with their feet. **Both errors are avoidable and the fix is
one call with one flag.**

`form: 'site:spindle'` and `kind: 'world'` keep site work visible in the diversity memory and in
`tools/scene-audit.mjs`, so a session that spends fifteen minutes in the archipelago does not read
as fifteen minutes of nothing.

---

## 7 · WHAT I WOULD BUILD, IN WHAT ORDER, AND WHAT I WOULD CUT

The brief's instruction was that three sites which pass the not-a-quiz test are worth more than
nine that do not. Here is the ranking, and it is a real one — I would rather ship the first three
alone than all eight badly.

| rank | site | new skills | why it is here |
|---:|---|---:|---|
| **1** | **THE SPINDLES** | 4 | Reclaims four skills the pattern study called impossible. **The only site that passes the cover test outright** — hide every label and it is still solvable, because the candidates are countable objects rather than numerals on identical stones. Simplest geometry of the eight. |
| **2** | **THE MEET** | 6 | The live beam under the walking player is the strongest single mechanic idea in this document, and the parallel case teaches "no solution" in a way nothing else can. Reuses the cache's balance wholesale. |
| **3** | **THE YARDS** | 7 | Largest coverage block. Reuses `span.js`'s laying machinery entirely. **The shape of the leftover is the name of the error** — Rule 4 and Rule 5 fused into one object. |
| 4 | **THE ENGINE** | 5 | Opens Level 3. Earns its place on the domain-as-floor and the jam, not on its evaluation half. |
| 5 | **THE ARC** | 5 | The vertex you climb to. Highest build risk: the algebra and the ballistic integrator must be gated into agreement. |
| 6 | **THE CHAIN** | 3 | Bands 4 and 5 are the best pedagogical argument here. Fewest new skills. |
| 7 | **THE WEIR** | 4 | The boundary plate that gives way is worth the whole site. Cannot carry the flip, and says so. |
| 8 | **THE READINGS** | 2 | Weakest not-a-quiz argument, and the three conditions in §4.8 are load-bearing. |

**Build one, two and three. Then re-read this document before building four.** Sites four to eight
are specified honestly but they are unbuilt designs by an author who has not walked them, and the
pattern study's own finding stands: **every defect it found, it found by playing, not by reading.**

### What I cut, and why

**A ninth site for `literal-equations` and the rule-writing block.** I tried three shapes for it —
a rearrangement frame, a set of interchangeable sockets, a machine you re-plumb. Every one of them
ended as three plinths with expressions printed on them, which is `waygate.js`'s failure mode:
Rule 1 passes, Rule 2 fails, and hiding the labels makes it unsolvable. **A rule can be a physical
object only if it has a shape you can see before you commit, and a rearranged formula has none.**
Cut, and the 16 skills in §5.3 are cut with it.

**A tenth site for `association-strength` and the two-way table.** No physical form exists. Cut
without regret.

**`rational-exponent` at the spindles.** Half a ring is honest. Two thirds of a ring is a picture of
a fraction on a stick. Cut at the boundary where counting stops.

**Five more balances.** The thing the pattern study named as the failure mode. One of eight sites
uses a beam, and it uses it as a live instrument rather than as a verdict.

### The four defects that must be fixed before any new site ships

All four were found by the pattern study **by playing the game**, and all four will be inherited by
every site built on the caches' pattern unless they are fixed first.

1. **The accidental commit.** Reproduced twice. Fix the geometry, and add `check:sites --commit` so
   it cannot come back.
2. **The payment that cuts off its own resolution.** The updraft under the player's boots. Delay,
   offset, or make the player step onto it.
3. **No label arbitration.** `caches.js` bypasses `tagspace.js`. With eight families this becomes
   the `waygate.js` defect at eight times the scale.
4. **`.field-tag.won` is dead CSS.** `won` is set on the object and never written as a class by
   either `caches.js` or `span.js`, and `rebuildTags()` skips opened sites entirely. **The winning
   answer never gets its green frame** — the one piece of positive feedback the tag layer was
   designed to give.

---

## 8 · THREE AMENDMENTS TO THE PATTERN LANGUAGE

Offered back to `ARCHIPELAGO-PATTERN.md` as corrections its author would want, each one forced by a
site above.

**RULE 1 — sharpened, because four sites read the player's own building and flying.**
The rule is not *"the site has no keyboard handler"*, which is a weak test a bad site can pass. It
is: **the site owns no input surface. It reads the state of the world; it never reads a key.** A
site module contains no `addEventListener`, no `input.*`, no key code, no DOM control, and no call
into the build system. It reads `player.pos`, `builder.solids` and its own geometry. **The player's
standing verbs are the vocabulary; the site's job is to have a shape those verbs can act on.**

**RULE 5 — extended, because the ENGINE and the WEIR have continuous answer spaces.**
Rule 5 says every wrong candidate is a named misconception, and its test is: *name the step of the
method it skipped, or remove it.* That test assumes three or four candidates. THE ENGINE offers the
whole domain; THE WEIR offers a whole causeway. The rule becomes:

> **In a continuous or enumerated answer space, every named misconception must be REACHABLE and
> must produce a DISTINGUISHABLE reaction. The rest of the space produces the generic scaled error
> of Rule 4.** The forbidden case is unchanged: a space in which two different misconceptions
> produce the same world state.

**RULE 9 — corrected, because the highest ground is not the launch if you cannot stand on it.**
Stated in full in §3.4. A site declares a **launch** — a specific runnable reachable point with a
radius and a height — and a **drop budget** in metres, and the wing that flies it is the access
requirement. `span.js` learned this the hard way and wrote it down; the caches' `hi + LIFT` datum
has not been corrected.

**And one thing the pattern language got exactly right that this document leaned on hardest.**
Rule 2's Test A, the cover test — *hide every DOM label; a player who cannot read the notation must
still be able to solve it.* Every site above was designed against that test before anything else,
and it is the reason the spindles are ranked first: they are the only one that passes it without a
qualification. **It is the single most useful sentence in that document and it should be the first
question asked of every future site.**

---

## APPENDIX · THE NUMBERS

**Measured or computed from the shipping source.**

| | |
|---|---|
| island radius | `ISLAND_R = 168` (`src/world/terrain.js`) |
| leash | `RIM() * 1.62` = **272 m** (`src/player/locomotion.js`) |
| the archipelago's band | r 186 … 264 — 78 m of usable ring |
| the Spine | **136.6 m at r 116, bearing −57.7°** — the highest ground and the master launch |
| glide ratios, solved from `P` | base **1 : 7.6** · KITE TRIM **1 : 18.3** · LONG SPAN **1 : 24.1** |
| — the pattern study's measured figures | base 1 : 7.7 · KITE 1 : 18.2 · SPAN 1 : 23.8 (agreement within 2%) |
| trim speed / sink | base 14.5 / 1.88 · kite 11.1 / 0.60 · span 10.8 / 0.45 m/s |
| gaits | walk 3.1 · run 6.2 · sprint 11.8 m/s |
| jump | `jumpV 11.4`, `doubleV 9.9`, coyote 0.14 s, buffer 0.17 s |
| dash | 22 m/s for 0.19 s, cooldown 0.62 s |
| vault plate | 12 m of clean air; 16 m with PLATE ARRAY |
| flare | 6 s of rising air; 11 s and 74 m with SQUALL |
| lattice | `CELL = LEVEL = 4 m`, `Q = 64` |
| existing occupied bearings | −152 −81 −67 −58 −36 −15 +70 +123 |
| free arcs | 85° · 53° · 85° · 71° · 22° |
| kit ladder, lines | vault 1 · flare 2 · **kite 3** · reserve 4 · legs 5 · sight 6 |
| kit ladder, depth | beacon 13 · windstep 18 · **span 26** · array 33 · squall 39 · deepwell 44 · station 46 |
| a cache pays | 120 motes (deep 160) + a permanent updraft |
| a span pays | 140 motes + a road |
| tilt per unit of imbalance | `0.055 rad` = **3.15°**, saturating at `±0.46 rad` = 26.4° |
| a cache's countability caps | 6 x-tiles, 34 units; `a ∈ 2..4`, `x ∈ 2..7`, `b ∈ 1..8`, `c ≤ 30` |
| proposed spindle caps | 12 rings above, 12 below, 16 collars; banded bright every fifth |
| proposed plot caps | MEET 13 × 13 cells (52 m) · YARDS 17 × 17 at `SQ 1.5` (26 m) · WEIR 17 plates (68 m) |
| skills, total | 62 · **43** carried by a site · **3** taught only · **16** rift only |
| partition | script-checked: no duplicates, no omissions, no ids absent from `content/graph/` |

**Proposed site placements.** Height, then the measured ceiling it sits under, then the rung.

| site | bearing | r | y | ceiling | needs |
|---|---:|---:|---:|---:|---|
| SPINDLES 1 | +20° | 194 | 34 | 40.3 base | nothing — day one |
| SPINDLES 2 | +12° | 216 | 46 | 50.6 kite | KITE TRIM (lines 3) |
| SPINDLES 3 | +30° | 240 | 58 | above every wing | climb SPINDLES 2's own mast |
| MEET 1 | +55° | 206 | 68 | 74.0 base | nothing |
| MEET 2 | +62° | 238 | 70 | 71.5 kite | KITE TRIM |
| YARDS 1 | +180° | 204 | 28 | 34.9 base | nothing |
| YARDS 2 | +190° | 230 | 42 | 47.1 kite | KITE TRIM |
| YARDS 3 | +170° | 258 | 47 | 48.5 span | LONG SPAN (depth 26) |
| ENGINE 1 | +97° | 210 | 44 | 50.1 base | nothing |
| ENGINE 2 | +105° | 244 | 55 | 55.4 span | LONG SPAN |
| ARC 1 | −135° | 214 | 64 | 71.5 base | nothing |
| ARC 2 | −142° | 246 | 84 | 87.4 kite | KITE TRIM |
| CHAIN head | +142° | 190 | 30 | 36.6 base | nothing |
| CHAIN tail | +150° | 262 | 44 | 45.3 kite | KITE TRIM |
| WEIR 1 | −103° | 200 | 30 | 35.4 base | nothing |
| WEIR 2 | −110° | 234 | 44 | 46.8 kite | KITE TRIM |
| READINGS | −47° | 222 | 112 | 123.0 base | nothing — but the launch is the Spine |

**Every family's first instance is reachable on the base wing from a cleared save.** That is the
rule the table exists to hold the build to.

---

*Design only. No game code written. Nothing outside `design/` touched. Every skill id and
misconception id quoted above was checked against `content/graph/*.json`; the partition in §5 was
verified by script; every terrain height, glide ratio and reachability ceiling was computed by
importing the shipping source into node. Everything else is a proposal with a stated reason, and
the pattern study's own finding still stands over all of it: **the defects that matter are found by
playing, not by reading.***
