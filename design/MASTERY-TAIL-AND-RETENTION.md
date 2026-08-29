# The test-out tail, and day-five retention

Two product goals in `BRIEF.md` have never had a passing verdict. This is the measurement
of both, the mechanism behind the first, a fix proved in simulation, and the first
retention number this project has ever had.

Everything here was produced by a **second instrument**, written from scratch under
`design/tools/`, driving the **real** `src/learn/mastery.js` and the **real** item bank.
Nothing in `src/`, `tools/`, `content/` or anywhere outside `design/` was changed.

**[§11](#11-the-three-day-cadence--the-model-the-schedule-and-what-is-left) was added
by a later wave** and is about a third question — the three-day cadence — which this
document's own §6d named and did not pursue. It uses the SHIPPING instrument
(`tools/simulate.mjs`), not `design/tools/`, and it changed nothing in `src/` that a
learner meets: the engine's schedule is byte-for-byte what it was, and the section is
the record of six candidate changes that were measured and refused.

- Simulation code: `design/tools/` (see [§9](#9-the-instrument) and [§10](#10-every-command))
- Proposed engine changes: `design/tools/lib/patches.mjs` — each one replaces exactly one
  method of the shipping engine, so every figure below is the shipping code with one
  method swapped and nothing else.

---

## 1. Headline

| | reported in `RESUME.md` | measured here | measured by `tools/simulate.mjs` today |
|---|---|---|---|
| test-out, median | 2.7 min | **2.7 min** | 2.7 min |
| test-out, p90 | **15.4 min** | **10.3 min** | 10.1 min |
| frozen k=0.70 clears inside 25 min | **84.3%** | **57.4%** | 63.0% |
| frozen k=0.60 | **52.8%** | **26.9%** | 27.0% |
| frozen k=0.50 | **18.3%** | **9.7%** | 9.8% |
| day-five retention | *no verdict* | **78.7%** of cold re-probes right, first try, unaided | — |

**The three numbers the task was briefed on are stale.** The build is roughly five minutes
better on the p90 and about twenty-five points better on the classifier than `RESUME.md`
says. The two instruments agree digit-for-digit on identical seeds (§9), so this is a
documentation lag, not a disagreement.

**What is not stale is the shape of the problem.** The tail is real, it is bigger than the
p90 makes it look, and the mechanism has a name.

With the fix in §5:

| | today | with `B' + E' + S` | with `A'` as well |
|---|---|---|---|
| test-out p75 | 6.9 min | **5.5** | 5.1 |
| test-out p90 | 10.3 min | **8.5** | 8.1 |
| test-out p99 | 22.4 min | **18.5** | 17.2 |
| learners with at least one >15-min test-out | 34.0% | **17.6%** | 14.7% |
| whole level, wall clock, median | 60 min | **50** | 47 |
| claims granted and then withdrawn, per knower | 3.91 | **1.03** | 1.07 |
| frozen k=0.50 / 0.60 / 0.70 / 0.80 / 0.90 clear rate | 11.4 / 32.0 / 66.3 / 91.3 / 98.8 | **11.4 / 32.0 / 66.3 / 91.4 / 98.9** | 11.4 / 32.0 / 66.6 / 91.5 / 98.9 |

The classifier does not move. That is the whole point of the design, and §5 explains why
it is a property of the rule rather than luck.

---

## 2. What "two minutes" means, and the clock nobody was reading

`tools/simulate.mjs` reports test-out as **contact minutes**: the sum of the seconds of
items served *on that skill* until the claim. That is a defensible measure and it is the
one every published figure in this project has meant. It is not the clock a student
watches, because the router interleaves.

Measured on the same 20,000 clears (2000 learners at hidden competence 0.95):

| | median | p75 | p90 | p95 | p99 | max |
|---|---|---|---|---|---|---|
| **contact** minutes | 2.7 | 6.9 | 10.3 | 14.1 | 22.4 | 58.6 |
| **elapsed** minutes (first item on the skill → claim) | 6.6 | 12.2 | 21.0 | 27.9 | 41.3 | 96.3 |
| items | 3 | 8 | 11 | 15 | 23 | 59 |

Three more framings of the same cohort, because the quantile is the least honest of them:

- **55.2%** of test-outs finish in the minimum three items. **5.2%** finish inside two
  contact minutes — "about two minutes" is really "about three items, which is two and a
  half minutes".
- Per learner, over their ten skills, the **slowest single test-out** has a median of
  **12.0 minutes** and a p90 of **22.2**. So "one learner in ten spends fifteen minutes"
  understates it: **34.0% of learners hit at least one skill that takes more than fifteen
  contact minutes.** A per-skill p90 is a per-learner near-certainty when a learner meets
  ten skills.
- Proving the **whole level** they already know takes a median of **60 minutes** of wall
  clock (p75 72, p90 86) and 57 items. Against a 15–25 minute session that is two and a
  half to four sittings to test out of one lesson.

Both clocks are printed by `design/tools/testout.mjs`.

---

## 3. Why the p90 learner is slow — the mechanism

Three candidate explanations were tested and two are wrong.

**Not a specific node.** Share of the minutes above the global p75, by skill:
`distribute` 14.4%, `var-meaning` 14.2%, `both-sides` 13.6%, `eval-expr` 12.7%,
`two-step` 11.0%, `like-terms` 10.8%, `order-ops` 7.9%, `one-step-mul` 6.4%,
`multi-step` 5.6%, `one-step-add` 3.3%. Nothing above 15%.

**Not the cold start.** `steadyAtGate` will not answer until a learner has met
`gateFormMin` = 8 gate items anywhere in the lattice, so every concession the engine grants
is withheld on a knower's first skill or two. Measured, that costs almost nothing: clears
that began while the record read steady have median 2.5 / p90 10.0 minutes; clears that
began before it could answer have median 2.7 / p90 10.5.

**It is the form floor meeting the sight-read's band.** Here is the chain, each link
measured.

1. **`formFloor` is 1.** A shape the engine has *served once* and never had answered
   unaided is a hole, and `observe` will not let a proving run close while one stands:
   `if (holes.length) { s.check.need += 1; }`. This rule is correct and must not be
   weakened — it is what took claims granted over a served, never-solved shape from 46.06%
   to 0.00%.

2. **The sight-read is the most expensive question in the bank, and 19% of knowers miss
   it.** It is served at `sightReadBand` 5, and `task()` prefers a modelling surface for
   `kind === 'probe'` — context (46 s base) or verbal (38 s). Missing it opens a hole *on
   exactly that form*.

3. **A run opened by a clean sight-read runs at band 5.** `observe` does
   `s.difficulty = Math.max(s.difficulty, band)` and stamps `s.check.band = band`. So the
   two items that follow the cold item are the hardest the bank can produce, on a claim
   whose stated bar is "band 4 or above".

4. **Band 5 opens holes at twice the rate of band 4.** Gate items answered by a learner at
   hidden competence 0.95:

   | band | items | clean, unaided | new holes opened per item | mean seconds |
   |---|---|---|---|---|
   | 4 | 4,138 | 86.8% | 0.067 | 48.8 |
   | 5 | 18,845 | 82.7% | **0.133** | 56.6 |

5. **`holeSpacing` = 3 makes the run fill the wait with fresh transfer items.** The run
   cannot close without that shape, but `holeDue` refuses to serve it again for three
   items, and `checkTask` prefers a form this learner has never practised. So each hole
   costs a **median of 5 items** (mean 5.10, p90 9, max 36) before it clears, and each of
   those items opens 0.061–0.157 new holes. The branching ratio is **R = 0.31** — it
   converges, with a long tail.

**What that is worth, per clear:**

| distinct holes opened before the claim | share of clears | median min | p90 min | median items |
|---|---|---|---|---|
| 0 | 54.6% | 2.5 | 2.7 | 3 |
| 1 | 24.2% | 5.6 | 9.0 | 6 |
| 2 | 15.3% | 8.4 | 14.7 | 9 |
| 3 | 4.9% | 11.3 | 20.1 | 12 |
| 4+ | 1.0% | 16.9 | 29.5 | 18 |

**The tail is not a slow learner. It is a bookkeeping cascade.** A knower who opens no hole
finishes in three items and 2.5 minutes with a p90 of 2.7 — the distribution has no tail at
all. Every minute above that belongs to a shape the engine asked once, did not get, and then
made itself wait three items to ask again.

The run's own length shows it: the bar names **3** items, and the actual `need` at the
promoting item has a median of **4**, p90 **7**, p99 **12**, max **20**.

Where the holes come from, per item of that kind served (500 knowers, 110,000 items,
5,714 holes):

| served by | new holes per item | share of all holes |
|---|---|---|
| `probe` (the sight-read) | **0.190** | 16.6% |
| `learn` | 0.108 | 13.1% |
| `check` | 0.071 | 40.0% |
| `review` | 0.066 | 8.7% |
| `deep` (the sounding) | 0.021 | 21.1% |
| `retrieval` | 0.013 | 0.5% |

68.0% of all holes are opened at band 5.

And the split that matters most, over 5,000 clears:

| | clears | median | p75 | p90 | items |
|---|---|---|---|---|---|
| sight-read landed cold | 81.0% | 2.5 | 5.4 | 8.8 | 3 |
| sight-read missed | 19.0% | **7.4** | 9.6 | 13.1 | 8 |

The 19% who miss the cold item are **30.2% of every test-out minute** and **42.3% of the
clears in the tail**.

---

## 4. Two other defects found on the way

### 4a. The sounding is destroying mastery claims, and its own documentation says it cannot

`observe` ends with a block titled *A HOLE THAT OPENS AFTER THE CLAIM STILL UNSEATS IT*.
`soundingPick` **prefers** a held line whose bank still holds a form this learner has never
worked; `soundingTask` serves it at band 5. One miss writes
`formsSeen[f] = {items: 1, correct: 0}`, and the claim is withdrawn.

The sounding's own comment says it *"grants no mastery and no retention credit … a miss ends
the run and costs the line not one point of its claim."* That last clause is false.

Measured on 300 learners at hidden competence 0.95, one sitting of 220 items:

- **3.94 claims withdrawn per learner** — 28.3% of every claim granted.
- **98.0% of learners** see at least one line go from HELD back to open. Worst learner: 10.
- **87.1%** of those withdrawals are `formFloor`, not a missed re-probe, and **708 of 1,181
  (60%) were done by a `deep` item** — the endgame descent — with 301 more by a `review`.
- The knower therefore pays for **3.9 extra proving runs**: claims granted per learner is
  13.91 over ten skills.

For an ordinary cold-start learner over 25 daily 22-minute sittings it is **8.50
withdrawals per learner, 47.3% of claims, 100% of learners** — though there 90.3% are
honest lapses (a cold re-probe missed twice), which is the schedule working.

### 4b. `gateFloorFor` has drifted to band 1 on `multi-step`

The demand rule in `gateFloorFor` is documented as binding "on exactly one skill here" and
landing it "at band 2 — measuring 8.69, still the second-hardest gate of the ten."

Today it lands at **band 1**:

```
$ node -e "…" # design/tools recipe in §10
skill            gateFloor sightBand   d1     d2     d3     d4     d5
multi-step           1        1       8.12   8.99   9.30   9.47  10.23
```

The loop `while (d > 1 && row[d-1] > ceiling && row[d-2] >= floorDemand) d--` walks all the
way down, because `multi-step`'s band-1 demand (8.12) is still above every other skill's
band-4 demand (max 7.83). So **`multi-step`'s sight-read and its entire proving run are
served at band 1 of its own ladder**, and it is the cheapest skill in the level to test out
of (median 1.5 contact minutes, 3 items). The rule is arguably right on demand and its
receipt records `bandCapped`, but the comment above it is now wrong by a whole band and
nobody noticed.

### 4c. The published classifier table reads one node, and it is the wrong one

`tools/simulate.mjs` reads `SKILLS.find(s => r.spent.get(s).items > 0)`, which with a
cleared save is always `var-meaning`. Run the same frozen cohorts against **every** node
(400 per cell, the rest of the lattice held with a real form history — see §9c):

| node | k=0.60 | k=0.70 | k=0.80 |
|---|---|---|---|
| one-step-add | **62.8%** | **88.5%** | 98.8% |
| one-step-mul | 41.8% | 76.0% | 95.8% |
| var-meaning *(the published row)* | 31.0% | 70.5% | 90.8% |
| order-ops | 28.5% | 68.0% | 91.3% |
| multi-step | 16.8% | 48.8% | 79.5% |
| eval-expr | 16.8% | 44.3% | 78.5% |
| like-terms | 16.8% | 54.8% | 85.0% |
| two-step | 16.0% | 49.8% | 82.5% |
| distribute | 13.5% | 43.0% | 74.8% |
| both-sides | 13.0% | 42.5% | 75.3% |

`one-step-add` is a **five-fold** softer gate than `both-sides` at k=0.60 and the published
table cannot see it. Its whole demand ladder is the lowest in the level (5.30 → 6.80) and
its band-4 gate measures 6.36, the lowest gate in the level. **This is a real
false-positive hot spot and it is invisible today.** It is a content problem, not a gate
problem — the fix is a harder band-4 form on `one-step-add`, not a stricter rule.

---

## 5. The fix

Three changes. None of them lowers a band, shortens a run, or removes a closing condition.
All three are implemented in `design/tools/lib/patches.mjs` and graded on identical seeds.

### B′ — a hole is asked at the bar

`checkTask` serves a hole-pinned item at the **run's** band. A hole opened by a missed
sight-read is therefore re-asked at band 5 over and over. The claim it stands in front of
is a band-4 claim, so band 4 is what it should be asked at, floored by `gateFloorFor` and
clamped into the form's own range exactly as today.

Gated on `steadyAtGate()`, for the reason below.

### E′ — the run pays its debt at once

`holeSpacing` stops one shape filling a third of a session, and outside a proving run that
is right. Inside a run that **cannot close without that shape**, the three items it waits
are three items it did not have to serve, and each of them can open a debt of its own.

So `holeDue` returns true while a proving run is open. Practice (`task`, kind `learn`) is
untouched, and every session-level diversity rule that reads `recentActs` and
`recentSkeletons` is untouched — this changes only the road that is already pinned to one
shape by necessity.

Gated on `steadyAtGate()`.

**Why the steady gate makes both free.** `steadyAtGate` reads the whole lattice, and the
share of items served while it is true is:

| hidden competence | 0.50 | 0.60 | 0.70 | 0.80 | 0.90 | 0.95 |
|---|---|---|---|---|---|---|
| share of items served while steady | 0.7% | 4.0% | 19.3% | 45.8% | 67.0% | **94.8%** |

A concession behind that gate reaches a knower on nineteen items in twenty and a learner
at 0.60 on one in twenty-five. That is not a prediction; it is why the classifier rows do
not move.

### S — a hole found *after* the claim is a lapse, not a verdict

The engine already knows how to handle "one miss cannot tell a slip from rot": a missed
cold re-probe is a **lapse** — the line keeps its standing, comes back round in two
minutes, and a **second** miss demotes it.

A shape that goes never-once-solved on a line already held is exactly that evidence and
deserves exactly that answer. So the claim stands, the line goes on the engine's own lapse
path (`lapsePending`, which already carries a 2.2× priority boost in `leverage`), the
shape is pinned **by name** on the next re-probe, and a second miss of that shape — *on a
new question, not on the retry of the card that opened it* — takes the claim.

Nothing is weakened. A claim still cannot survive a shape this learner cannot do; it now
takes two misses of that shape rather than one, which is the standard every other kind of
rot in this file is held to.

> **The tap-versus-item trap, again.** The first implementation of S spent its second
> strike on the *retry* of the card that opened the hole and therefore did nothing at all
> (`withdrawn` 3.94 → 3.91). `s.lastServed.seq` is the fix, and it is the same fix
> `gateOnce`, `formsSeen.items` and `check.chargedFor` already carry. Any implementation
> of this rule that does not stamp the item will silently be a no-op.

### The frontier

2000 knowers, 2000 frozen learners per cell, 800 cold starts, identical seeds
(`design/tools/arena.mjs`).

**Test-out — contact minutes to clear one skill, learner at hidden competence 0.95**

| arm | med | p75 | p90 | p95 | p99 | items p90 | learners with a >15-min clear | elapsed p90 |
|---|---|---|---|---|---|---|---|---|
| shipping | 2.7 | 6.9 | 10.3 | 14.1 | 22.4 | 11 | 34.0% | 21.0 |
| B′ + E′ | 2.5 | 5.5 | 8.5 | 10.8 | 18.2 | 9 | 16.9% | 16.6 |
| S alone | 2.7 | 6.9 | 10.4 | 14.2 | 22.3 | 11 | 34.3% | 20.6 |
| **B′ + E′ + S** | **2.5** | **5.5** | **8.5** | **10.9** | **18.5** | **9** | **17.6%** | **16.5** |
| A′ + B′ + E′ + S | 2.4 | 5.1 | 8.1 | 10.4 | 17.2 | 9 | 14.7% | 15.3 |

**The whole level — a knower, first item to tenth claim**

| arm | wall-clock min: med / p75 / p90 | items med | claims withdrawn per learner |
|---|---|---|---|
| shipping | 60 / 72 / 86 | 57 | 3.91 |
| B′ + E′ | 52 / 62 / 73 | 49 | 4.30 |
| **B′ + E′ + S** | **50 / 60 / 71** | **49** | **1.03** |
| A′ + B′ + E′ + S | 47 / 56 / 66 | 47 | 1.07 |

**The classifier — frozen learners, "ever inside 40 items / inside 25 real minutes / still
held at the buzzer"**

| arm | k=0.50 | k=0.60 | k=0.70 | k=0.80 | k=0.90 |
|---|---|---|---|---|---|
| shipping | 11.4 / 9.7 / 2.8 | 32.0 / 26.9 / 16.5 | 66.3 / 57.4 / 50.2 | 91.3 / 83.3 / 82.6 | 98.8 / 95.2 / 93.0 |
| B′ + E′ | 11.4 / 9.7 / 2.7 | 32.0 / 26.9 / 16.4 | 66.3 / 57.5 / 51.3 | 91.4 / 83.3 / 83.6 | 98.9 / 95.3 / 93.0 |
| S alone | 11.4 / 9.7 / 3.1 | 32.0 / 26.9 / 17.4 | 66.3 / 57.4 / 51.0 | 91.3 / 83.3 / 84.2 | 98.8 / 95.2 / 95.3 |
| **B′ + E′ + S** | **11.4 / 9.7 / 3.0** | **32.0 / 26.9 / 17.4** | **66.3 / 57.5 / 52.2** | **91.4 / 83.3 / 85.1** | **98.9 / 95.3 / 94.7** |
| A′ + B′ + E′ + S | 11.4 / 9.7 / 3.0 | 32.0 / 26.9 / 17.6 | 66.6 / 57.7 / 53.5 | 91.5 / 83.4 / 84.8 | 98.9 / 95.3 / 95.0 |

95% Wilson half-widths on the first column: ±1.4, ±2.0, ±2.1, ±1.2, ±0.5.

**The gate's decision does not move.** "Ever" and "inside 25 minutes" are unchanged to
0.0–0.1 points at every level. **The third column does move**, and it is the honest cost:
+0.2 / +0.9 / +2.0 / +2.5 / +1.7 points. That column is not the gate; it is how often a
claim the gate granted is later destroyed by something else — and today the something else
is the sounding, which hits knowers 87% of the time. As a fraction of claims destroyed the
fix is *differentially* better for the knower: at k=0.70 destruction falls from 16.1 points
to 14.1 (−12%); at k=0.90 from 5.8 to 4.2 (−28%).

**The ordinary population — 800 cold starts, 800 items**

| arm | true mastery | all ten | any hollow claim | hollow claims |
|---|---|---|---|---|
| shipping | 100.0% | 99.6% | 0.0% | 4.55% |
| B′ + E′ + S | 100.0% | 99.5% | 0.0% | 4.83% |
| A′ + B′ + E′ + S | 100.0% | 99.6% | 0.0% | 4.84% |

**Invariants** (`design/tools/invariants.mjs`, 200 learners × 4 cohorts, ~370,000 items,
~8,700 claims): `HOLE` 0, `LOCKED` 0, `SPAN` 0, `BAND` 0 under both arms. `MODEL` — a claim
whose run carried no modelling item — is **1 of 8,720** under the shipping engine and 0
under the fix; it is the `ext >= 2` escape hatch firing, it pre-exists this work, and at 1
in 8,700 it is not worth a rule.

**What S costs, stated exactly.** Under S a line may stand HELD over an unanswered shape
for a short window. Measured as a share of held-line item-slots across all four cohorts:
**0.067%** — about **one item**, because the very next thing the engine serves on that line
is that shape, by name. 1.53 lines per learner ever enter that state. The product already
has a name for it (`lapsePending`) and a report state for it; nothing new has to be
invented, and `HELD` must not be glossed in-world as *"proved for good, never opens
again"* — which is what a cold critic photographed it saying.

### A′, and why it is a separate decision

`A′` serves the whole proving run at `gateFloorFor` rather than at whatever band the credit
ladder has climbed to, for a learner whose record reads steady. It is worth a further
0.4 minutes on the p90, 3 minutes on the whole level, and 3 points on "learners with a
>15-min clear". Ungated it is **not** free — the un-gated `A` arm takes k=0.60 from 32.0%
to 43.1% and k=0.80 from 91.3% to 94.8%. Gated it measures free on both the root table and
the per-node table (§4c, max delta +1.2 at k=0.70).

Ship `B′ + E′ + S` first; `A′` is a demand change and deserves its own argument with a
curriculum director. Both are in `design/tools/lib/arms.mjs`.

### What is left in the tail after the fix

`ARM="B'+E'+S" node design/tools/tailwhy.mjs 400` — the tail above the new p75 (5.5 min),
996 clears at 8.90 min each:

| | items | min | share |
|---|---|---|---|
| gate items answered clean | 3.27 | 2.50 | 28.1% |
| gate items missed | 1.25 | 1.69 | 19.0% |
| the climb back after a missed sight-read | 1.80 | 1.59 | 17.8% |
| the hole, paid | 1.31 | 0.93 | 10.4% |
| the sight-read itself, missed | 0.54 | 0.92 | 10.3% |

What remains is **irreducible arithmetic, not bookkeeping**: a learner at 0.95 answers a
band-5 gate item cold 82.7% of the time, so `0.827³ = 56.6%` of three-item runs go straight
through, and the rest pay for a miss. Shortening it further means either lowering the
demand (A′, and further) or accepting fewer than three unassisted items — and the second is
the bar itself.

---

## 6. Day-five retention

### 6a. The model

**What a learner should retain on night five.** The engine's ladder is
`[10 min, 8 h, 21 h, 52 h, 130 h]`. For a daily returner a line proved on day 0 is
re-probed on days 1, 2, 4 and 9. There is no probe at exactly five nights unless the
learner returns daily, so "night five" has two honest readings and both are reported:
*the fifth night of the course*, and *the fifth night after a claim*. The second is the one
retention is about.

**How the game measures it without punishing anybody.** It already does. The measurement is
the **cold re-probe the schedule was going to serve anyway** — unassisted by construction,
at the gate band, on a line the learner proved. Nothing extra is asked, no quiz is bolted
on, and a miss costs a lapse (a two-minute re-ask), not the claim. The only change needed
is that the *outcome* be recorded and reported, which it already is
(`s.durable`, `provenBy`, `watch()`).

### 6b. The number

1000 learners, 25 daily sittings of 22 minutes, arm `B′+E′+S`, shipping ladder
(`design/tools/retention.mjs`).

| nights since the claim | cold re-probes | **right, first try, unaided** | true competence: mean / share ≥ 0.85 |
|---|---|---|---|
| 1 | 11,522 | 74.2% [73.4–75.0] | 0.774 / 9.2% |
| 2 | 10,176 | 75.4% [74.6–76.2] | 0.775 / 11.0% |
| 3 | 7,795 | 75.9% [74.9–76.8] | 0.798 / 22.6% |
| 4 | 5,851 | 78.3% [77.2–79.3] | 0.826 / 38.3% |
| **5** | **5,707** | **78.7% [77.6–79.7]** | **0.829 / 44.8%** |
| 6–8 | 15,552 | 81.2% [80.6–81.8] | 0.855 / 57.7% |
| 9–14 | 18,307 | 84.6% [84.1–85.2] | 0.902 / 81.0% |
| 15+ | 10,378 | 86.7% [86.0–87.3] | 0.938 / 93.1% |

> **Day-five retention: 78.7% of the questions the schedule asks cold on the fifth night
> after a line was proved come back right, first try, with no help.**

The curve **rises** with elapsed nights rather than falling. That is the expanding schedule
working exactly as an expanding schedule is supposed to: each survived, genuinely spaced
re-probe buys enough durability to pay for the longer interval that follows. It also means
the shipping ladder is, if anything, conservative — see §6d.

The figure is stable across session shape (78.4–78.7% at 15, 22 and 25 minutes a day), so
it is a property of the ladder, not of how long the student sits.

**Is the measured number a fair estimate of what is really there?** One cold item is a real
but coarse instrument. Pass rate against true competence read **before** the answer:

| true competence | pass rate |
|---|---|
| 0.40 – 0.70 | 68.7% |
| 0.70 – 0.80 | 75.7% |
| 0.80 – 0.88 | 79.3% |
| 0.88 – 0.94 | 83.7% |
| 0.94 – 1.00 | 85.7% |

Monotone, but compressed: **one item cannot separate a learner at 0.80 from one at 0.90.**
Averaged over a learner's ten lines and five days it becomes usable:

| a learner's measured pass rate over their last five days | learners | share of their held lines truly at mastery |
|---|---|---|
| 60–70% | 71 | 79.7% |
| 70–80% | 268 | 85.0% |
| 80–90% | 425 | 87.7% |
| 90–100% | 234 | 95.6% |

**Never print the measured rate as "you remember 78% of what you learned."** It is not a
percentage of knowledge. It is the pass rate of a specific set of hard questions, and the
honest sentence is the literal one: *"X of the Y questions we asked cold came back right."*

### 6c. What is actually there, and what survives

Same cohort, at the end of 25 daily sittings:

- **9.47 of 10 lines held.** Of those, **89.7% are truly above the mastery bar** and 2.03%
  are below the hollow bar.
- **71.2% of learners** have at least 9 of 10 skills truly mastered (61.4% have all ten).
- Taught nothing and asked nothing after that: **69.0% one day later, 60.8% a week later,
  48.2% a month later**.

And the single most quotable number in the whole exercise — **the same total minutes, spread
two different ways:**

| shape | total minutes | ≥ 9 of 10 truly mastered at the buzzer | a week later | **a month later** |
|---|---|---|---|---|
| 45 min × 12 days | 540 | 85.6% | 68.8% | **10.0%** |
| 22 min × 25 days | 550 | 74.0% | 64.2% | **50.8%** |

**Same class time. Five times the month-later retention, purely from the shape of the
calendar.** That is the Pomodoro argument in one row, and it is measured rather than
asserted.

### 6d. The session shape a 15–25 minute Pomodoro actually needs

500 learners per row, arm `B′+E′+S`:

| session | gap | days | items/day | lines held | ≥9 of 10 truly | +7 d | +30 d |
|---|---|---|---|---|---|---|---|
| 15 min | daily | 25 | 16.9 | 7.6 | **14.0%** | 5.6% | 2.6% |
| 22 min | daily | 25 | 24.6 | 9.5 | 74.0% | 64.2% | 50.8% |
| 25 min | daily | 25 | 27.7 | 9.8 | **87.6%** | 80.2% | 67.8% |
| 15 min | daily | 35 | 16.9 | 9.0 | 57.4% | 50.2% | 37.4% |
| 22 min | daily | 35 | 24.6 | 9.9 | **95.0%** | 92.2% | 88.2% |
| 22 min | every other day | 25 | 24.6 | 8.8 | 50.4% | 41.4% | 32.4% |
| 22 min | weekly | 12 | 24.6 | 4.1 | **0.0%** | 0.0% | 0.0% |

Four findings, in order of how much they should change the product:

1. **15 minutes is a cliff, not the bottom of a dial.** One Algebra I level does not close
   inside a month at 15 minutes a day (14.0%), and it barely closes in five weeks (57.4%).
   The level needs about 600 served items; 15 minutes buys 17 a day. **The floor of the
   Pomodoro band should be 20 minutes, not 15**, or the level has to be smaller.
2. **Daily is doing most of the work.** Every-other-day costs about a third of the
   outcome; weekly is worth nothing at all. A product that cannot get a student back
   tomorrow is not delivering a mastery schedule, it is delivering a worksheet.
3. **The course must not end when the last line is proved.** A line needs about four
   survived spaced re-probes before it is above the bar a month later, and the ladder
   delivers those over nine days. A line proved on the last day of the course has none of
   them. **The session shape needs a "keep" phase**: five to eight minutes a day for about
   nine days after the last claim, made of nothing but due re-probes. That is what turns
   "you have proved everything" into "you will still have it in a month", and it is
   already what the engine's own watch (`nextInMinutes`) knows how to schedule.
4. The maintenance load is small and stable: **3.6 re-probes per sitting**, about 2.4
   minutes of a 22-minute session, growing slowly as more lines are held.

### 6e. The ladder

1500 learners, 25 daily 22-minute sittings, arm `B′+E′+S` (`design/tools/ladder.mjs`):

| ladder | true-held | ≥9 of 10 | +7 d | **+30 d** | re-probes / sitting | night-5 | durable |
|---|---|---|---|---|---|---|---|
| **shipping** 10 m · 8 h · 21 h · 52 h · 130 h | 89.8% | 71.5% | 61.1% | 48.0% | 3.59 | 78.5% | 64.7 |
| drop the in-sitting rung 8 h · 21 h · 52 h · 130 h | 88.8% | 71.2% | 61.4% | 37.9% | 2.81 | 75.7% | 54.0 |
| daily-aligned 10 m · 20 h · 44 h · 92 h · 188 h | 88.5% | 69.0% | 57.7% | 34.2% | 3.11 | 77.7% | 54.2 |
| tight early 10 m · 4 h · 20 h · 44 h · 92 h | 90.7% | 71.1% | 62.4% | 51.1% | 3.81 | 79.4% | 69.2 |
| **tighter** 10 m · 3 h · 12 h · 30 h · 3 d · 7 d | **90.1%** | **71.1%** | **61.8%** | **51.7%** | **3.96** | **79.8%** | **72.3** |
| tight + long 10 m · 4 h · 20 h · 44 h · 92 h · 14 d | 90.5% | 70.7% | 62.0% | 51.1% | 3.76 | 79.2% | 68.1 |
| slow 10 m · 20 h · 3 d · 7 d · 21 d | 86.9% | 68.6% | 51.2% | 11.5% | 2.67 | 77.2% | 45.4 |
| the pre-clock ladder 1 d · 3 d · 8 d · 21 d | 83.3% | 65.0% | 21.5% | **0.0%** | 1.74 | 71.8% | 32.2 |

- **The shipping ladder is good and the wall-clock rewrite was worth everything claimed for
  it.** The ladder it replaced leaves **0.0%** of learners above the bar a month later.
- **Recommendation: `reviewMinutes: [10, 180, 720, 1800, 4320, 10080]`** — 10 minutes,
  3 hours, 12 hours, 30 hours, 3 days, 7 days. Six rungs, a tighter early section, and a
  longer terminal rung. Worth **+3.7 points of true mastery a month later** and +1.3 points
  on the night-five probe, for **0.37 more re-probes per sitting** — about fifteen seconds
  of a twenty-two-minute session.
- **Do not drop the ten-minute rung.** It looks like the cheapest thing to cut (saves 0.8
  items a sitting) and it costs **10 points at thirty days**, because it is what gets a
  line onto rung 1 before the learner leaves.
- **Do not stretch the early rungs.** The `slow` row is what a "kinder, less repetitive"
  schedule measures like: 11.5% at thirty days against 48.0%.

---

## 7. What to show a teacher, and what to show a parent

Both sentences are drawn from numbers the engine already records
(`s.durable`, `watch()`, `provenBy`) and both are `ASD-STE100` short. Neither states a
percentage of knowledge, because the measurement does not support one.

**Teacher, one sentence:**

> *Of the questions we asked cold, days after this student proved the skill and with no
> help on screen, they answered 4 of 5 correctly on the first try; 9 of their 10 lines have
> now survived at least one night away from the machine.*

**Parent, one sentence:**

> *Five days after your child learned this, we asked again with no hints — they got it
> right first time, and we will keep asking on a widening schedule so it stays learned.*

What neither may say, and what the record must be built to refuse:

- **Not a percentage of knowledge.** "78% retained" is unsupported — the measurement is one
  hard question per line, calibrated in §6b.
- **Not "mastered for good."** `HELD` is currently glossed in-world as *"proved for good,
  never opens again"*, which is false today (28.3% of claims are withdrawn) and still false,
  by design, after the fix. The honest badge has three states, and the engine already has
  all three: **held**, **re-checking**, **reopened**.
- **Not a number from one sitting.** Nothing measured inside a sitting is retention, which
  is exactly why `durableMinutes` exists. A report should show *nights survived*, not
  *questions answered*.

---

## 8. Recommendations, in order

| # | change | owner | evidence |
|---|---|---|---|
| 1 | `E′` — `holeDue` returns true inside an open proving run when `steadyAtGate()`. **Stamp the item (`lastServed.seq`) or it is a no-op.** | `src/learn/mastery.js` | §5, `arena.mjs` |
| 2 | `B′` — a hole-pinned gate item is served at `gateFloorFor`, not the run band, when `steadyAtGate()` | `src/learn/mastery.js` | §5 |
| 3 | `S` — a hole opening on a held line puts the line on the lapse path with the shape pinned by name; a second miss of that shape on a new question takes the claim | `src/learn/mastery.js` | §5, `churn.mjs` |
| 4 | `reviewMinutes: [10, 180, 720, 1800, 4320, 10080]` | `src/learn/mastery.js` | §6e, `ladder.mjs` |
| 5 | A "keep" phase — five to eight minutes a day of due re-probes for nine days after the last claim | `src/session/**` | §6d |
| 6 | Raise the Pomodoro floor from 15 to 20 minutes, or shrink the level | `src/session/**`, `BRIEF.md` | §6d |
| 7 | Fix `one-step-add`'s band-4 bank — it is the softest gate in the level by a factor of five | `content/**` | §4c |
| 8 | Correct the `gateFloorFor` comment, and decide whether band 1 on `multi-step` is intended | `src/learn/mastery.js` | §4b |
| 9 | Report the classifier per node, not off the first skill in graph order; give harness-held lines a form history | `tools/simulate.mjs` | §4c, §9c |
| 10 | Update the three stale figures in `RESUME.md` | `RESUME.md` | §1 |
| 11 | `A′` — the run is served at the bar, when `steadyAtGate()`. Separate decision; it is a demand change | `src/learn/mastery.js` | §5 |

---

## 9. The instrument

### 9a. What it shares, and what it does not

`design/tools/lib/sim.mjs` drives the **real** `MasteryEngine`, the **real**
`generators.js` bank, the **real** `itemSeconds` cost model and the **real** graph. Nothing
about the gate is restated. The learner model is re-implemented from the specification in
`tools/simulate.mjs`'s header rather than copied from its body; every measurement is new
code.

### 9b. Where the two instruments agree

Run seed-for-seed at N = 400, the frozen classifier is **identical to the last digit**:

```
                 ≤3 items   ≤6 items   ever      in 25 min
  0.50            3.3%       3.3%      11.0%      9.8%
  0.60            9.5%      11.3%      31.0%     27.0%
  0.70           22.0%      24.8%      70.5%     63.0%
  0.75           26.8%      30.5%      82.8%     74.0%
  0.80           33.5%      38.0%      90.8%     84.5%
  0.90           49.3%      55.3%      99.8%     96.5%
  0.95           55.8%      61.8%      99.3%     97.8%
```

and test-out agrees to 0.2 minutes at the p90 (10.1 vs 10.3 at N = 2000). Where I disagree
is with `RESUME.md`, not with `tools/simulate.mjs`.

### 9c. Three instrument faults found while doing this

The project rule is that the instrument is the usual bottleneck. It was, three times, and
two of the three flipped a conclusion:

1. **Reading the outcome variable after the outcome.** The first retention calibration read
   hidden competence *after* the answer, so a passed re-probe carried its own retrieval
   gain into the bin it was being scored in. The calibration came out **flat and inverted**
   — 84.6% pass for learners at 0.60–0.75 against 76.9% at 0.85–0.92 — and would have
   supported the conclusion "the cold re-probe measures nothing". Read before the answer it
   is cleanly monotone (§6b).
2. **A held line with no form history is not a held line.** The per-node classifier marks
   the rest of the lattice mastered with an empty `formsSeen`, so every shape of it is
   novel, the sounding goes hunting for exactly that, and one miss withdraws the
   prerequisite — which then blocks the node under test, because `promote` refuses a claim
   on a line whose prerequisites are not held. Measured: **2.1 to 2.6 pre-held lines
   knocked over per learner against 0.1 withdrawals of the target.** The diagnostic was
   mostly reporting on its own scaffolding, and it made `A′` look like it cost 7–9 points
   of false positives when it costs at most 1.2.
3. **Counting taps, not items.** The first implementation of `S` spent its second strike on
   the retry of the card that opened the hole, and measured as a perfect no-op. This is the
   fourth place in this codebase where that exact bug has appeared; `lastServed.seq` is the
   fix each time.

### 9d. What this instrument still cannot see

- `task.reps` (the `requiredReps` filter on `learn` items) is not modelled: the simulation
  picks a form from `formCandidates` and ignores the requested representations. Neither
  instrument models it.
- The feedback rate is measured off `src/learn/echo.js`, which another lane was editing
  during this work; it currently reads **100.0%**. It moves nothing in the test-out or
  frozen figures by construction — a frozen learner does not learn, and a learner at 0.95
  gains under a thousandth per item — and it is pinnable with `SIM_FEEDBACK=`.
- Everything about forgetting rests on two constants (`GAP_POW` 0.35, `PERMA` 0.60). The
  shipping instrument prints a nine-cell sweep of them; the retention *ranking* of ladders
  and session shapes is stable across it, the absolute levels are not.

---

## 10. Every command

All from `/Users/harrison/dev/aadmath`. Every tool takes `ARM=<name>` from
`design/tools/lib/arms.mjs` (`shipping`, `A`, `A'`, `B`, `B'`, `C`, `D`, `E`, `E'`, `S`,
`R`, `B'+E'`, `B'+E'+S`, `A'+B'+E'`, `A'+B'+E'+S`, `B'+E'+S+R`) and `CFG=k=v,k=v` for any
numeric dial in `DEFAULT_MASTERY`.

```bash
# §1, §2  test-out, both clocks, per skill, per position in the run
node design/tools/testout.mjs 2000

# §1, §9b  the classifier, with Wilson intervals; NODES=1 adds §4c
node design/tools/frozen.mjs 800
NODES=1 LEVELS=0.60,0.70,0.80 node design/tools/frozen.mjs 400

# §3  where the tail's minutes go, item by item, with the engine's state read first
node design/tools/tailwhy.mjs 500
ARM="B'+E'+S" node design/tools/tailwhy.mjs 400        # what is left after the fix

# §3  the hole cascade: holes per clear, band table, branching ratio, run length
node design/tools/holes.mjs 500

# §3  where holes come from, by scheduler kind / band / surface / shape
node design/tools/holesrc.mjs 500

# §4a  claims granted and then taken away, by cause and by the item that did it
ARM=shipping     node design/tools/churn.mjs 300
ARM="B'+E'+S"    node design/tools/churn.mjs 300

# §5  the frontier: test-out + whole level + classifier + population, identical seeds
ARMS="shipping,B'+E',S,B'+E'+S,A'+B'+E'+S" node design/tools/arena.mjs 2000 2000 800

# §5  the invariants, and the standing-hole exposure window
ARM=shipping     node design/tools/invariants.mjs 200
ARM="B'+E'+S"    node design/tools/invariants.mjs 200

# §6b, §6c  day-five retention, the forgetting curve, calibration
ARM="B'+E'+S" node design/tools/retention.mjs 1000 25
ARM="B'+E'+S" LADDER=10,180,720,1800,4320,10080 node design/tools/retention.mjs 1000 25

# §6e  the spacing ladders, graded
ARM="B'+E'+S" node design/tools/ladder.mjs 1500 25
SESSION=15 ARM="B'+E'+S" node design/tools/ladder.mjs 300 30
GAP=48     ARM="B'+E'+S" node design/tools/ladder.mjs 300 25

# §4b  the gate floors and sight-read bands the engine actually computes
node --input-type=module -e "
import { buildWorld } from './design/tools/lib/sim.mjs';
import { MasteryEngine } from './src/learn/mastery.js';
const w = await buildWorld('algebra1-l1');
const e = new MasteryEngine(w.graph);
for (const s of w.skills) console.log(s.padEnd(14), 'gateFloor', e.gateFloorFor(s), 'sightBand', e.sightReadBandFor(s), w.raw[s].map(x=>x.toFixed(2)).join(' '));
"

# §5  how often steadyAtGate() is true, by hidden competence
node --input-type=module -e "
import { buildWorld, runLearner } from './design/tools/lib/sim.mjs';
const w = await buildWorld('algebra1-l1');
for (const c of [0.5,0.6,0.7,0.8,0.9,0.95]) {
  let st=0, all=0;
  for (let i=0;i<200;i++) runLearner(w,(i*2654435761+12345)>>>0,{knows:()=>c,frozen:c!==0.95,budget:c===0.95?220:40,watch:e=>{all++; if(e.before.steady) st++;}});
  console.log(c.toFixed(2), (100*st/all).toFixed(1)+'%');
}
"

# §6d  session shape: 15 vs 22 vs 25 minutes, daily vs every other day vs weekly
node --input-type=module -e "
import { buildWorld, runLearner, decayTo, mean, TRUE_MASTERY } from './design/tools/lib/sim.mjs';
import { armOf } from './design/tools/lib/arms.mjs';
const w = await buildWorld('algebra1-l1'), arm = armOf(\"B'+E'+S\"), NEED = 9;
for (const [sess,gap,days] of [[15,24,25],[22,24,25],[25,24,25],[15,24,35],[22,24,35],[22,48,25],[22,168,12],[45,24,12]]) {
  const runs=[]; for (let i=0;i<500;i++) runs.push(runLearner(w,(i*2654435761+12345)>>>0,{budget:8000,sessions:days,sessionMinutes:sess,gapHours:gap,...arm}));
  const ok=d=>100*runs.filter(r=>{const kk=d?decayTo(r,w.skills,d):r.k; return w.skills.filter(s=>kk.get(s)>=TRUE_MASTERY).length>=NEED;}).length/runs.length;
  console.log(sess+'min/'+gap+'h/'+days+'d', mean(runs.map(r=>r.heldSet.size)).toFixed(1), ok(0).toFixed(1)+'%', ok(7).toFixed(1)+'%', ok(30).toFixed(1)+'%');
}
"
```

Runtimes on this machine: `testout` 7 s at N=2000, `frozen` 4 s at N=800, `arena` 100 s at
2000/2000/800, `ladder` 85 s at N=1500, `retention` 15 s at N=1000. Nothing here binds a
port, builds `dist/`, or writes outside `design/`.

### Files

```
design/MASTERY-TAIL-AND-RETENTION.md   this document
design/tools/lib/sim.mjs               the learner, the clock, the ledgers
design/tools/lib/patches.mjs           A A' B B' C D E E' S R — the candidate changes
design/tools/lib/arms.mjs              the named arms every tool shares
design/tools/testout.mjs               §1 §2   test-out, both clocks
design/tools/frozen.mjs                §1 §4c  the classifier, root and per node
design/tools/tailwhy.mjs               §3      where the minutes go
design/tools/holes.mjs                 §3      the hole cascade
design/tools/holesrc.mjs               §3      where holes come from
design/tools/churn.mjs                 §4a     claims granted and taken away
design/tools/arena.mjs                 §5      the frontier
design/tools/invariants.mjs            §5      what a fix may not buy its speed with
design/tools/retention.mjs             §6      day-five retention
design/tools/ladder.mjs                §6e     the spacing ladders, graded
```

---

## 11. The three-day cadence — the model, the schedule, and what is left

A district curriculum director refused this product in one sentence:

> *"Every campus I run has A/B block, UIL pull-outs, lab rotations and ordinary
> absence; I cannot promise any class a device every single day, and the product's
> own instrument says that at any gap wider than 24 hours it does not work."*

He is quoting `npm run check:mastery`. On the composed shipped route the same
learners, the same bank and the same 3,600-item budget read **90.7% true mastery
delivered every day and 5.7% delivered every third day**, with the lowest ability
quintile at 0.0% and 14.7% of learners holding a claim that is not true.

This section is what that number is made of. **Nothing in it changes a gate**, and
after all of it the shipping engine is byte-for-byte the schedule it was before —
which is the finding, not an admission.

Everything below is `tools/simulate.mjs` driving the real `src/learn/mastery.js`
over the real bank. Every command is in [§11.8](#118-every-command).

### 11.1 One number was two mechanisms, and that is why the argument could not end

`gapHours` was doing two jobs under one name.

| | what it is | who can see it |
|---|---|---|
| the **scheduling** clock | how long the ENGINE is told the learner was away — which re-probe has come round, whether a pass crossed a real gap and counts as durable, whether a belief has gone stale, whether this is a new sitting | `src/learn/mastery.js` |
| the **forgetting** clock | how much MEMORY the wait costs | nothing in the engine; it is the learner model, and it rests on constants nobody here has calibrated |

While they shared a name, "5.7%" was the sum of *the scheduler meets a three-day
cadence* and *the learner forgets three nights' worth*, and no evidence could
separate them. They are separable now (`decayHours` in `runLearner`), and the 2×2
is printed on every run under `coming back across days`.

**Composed shipped route, 60 learners a cell, identical seeds — this is the block
`npm run check:mastery` itself printed on 2026-08-29:**

| arm | scheduling clock | forgetting clock | true mastery | Q1 | lines truly held | lines the engine holds |
|---|---|---|---|---|---|---|
| daily, as delivered | 24 h | 24 h | **93.3%** | 75.0% | 23.5 / 24 | 23.7 / 24 |
| every third day, as delivered | 72 h | 72 h | **5.0%** | 0.0% | 15.2 / 24 | 14.0 / 24 |
| **the scheduler alone** | 72 h | 24 h | **40.0%** | 0.0% | 19.8 / 24 | 16.7 / 24 |
| **the model alone** | 24 h | 72 h | **41.7%** | 0.0% | 16.3 / 24 | 21.2 / 24 |

Three independent readings of the same 2×2 at N = 60 on this tree gave the two
middle cells as 46.7 / 45.0, 46.7 / 43.3 and 40.0 / 41.7. **The split is stable and
the ordering never changes; the cells are within a few points of each other and of
the halfway mark in every reading.** The mean-lines-held column is the tighter
statistic and says the same thing: 15.2 as delivered, about 20 with the scheduler's
half removed, about 16 with the model's half removed, 23.5 with both.

**Neither owns it. Each of the two mechanisms costs about half of the 88-point
gap on its own, and the two together cost all of it.** Any account of the
every-third-day figure that names only one of them is wrong.

The same 2×2 on Algebra I Level 1 alone (10 skills, 40 learners) reads
85.0 / 57.5 / **82.5** / **55.0**: on a short lattice the scheduler costs 2.5
points and the model costs 30. **The scheduler's share is a property of the
LATTICE, not of the cadence** — it appears when there are 24 lines to keep alive
at once and is nearly absent when there are 10.

### 11.2 What the scheduler is doing, measured rather than assumed

The obvious hypothesis was re-entry order: *a learner returns after three days
and the session planner spends its first ten minutes on new material instead of
re-proving what is about to lapse.* **That hypothesis is false and it is worth
saying so plainly, because it is the one everybody reaches for.**

Every sitting after the first, opening ten minutes, composed route:

| arm | due re-probe | interleaved retrieval | re-proving a line that fell | new ground: proving run | new ground: teaching | sounding |
|---|---|---|---|---|---|---|
| daily | 42.4% | 1.2% | 12.4% | 8.2% | 12.6% | 23.2% |
| every third day | **66.5%** | 0.3% | 10.4% | 5.0% | 17.9% | 0.0% |
| scheduler alone (72 h clock, 24 h loss) | **73.2%** | 0.3% | 8.3% | 5.6% | 12.6% | 0.1% |

A returning learner already meets recovery first, and meets *more* of it at a
three-day cadence than at a daily one. Re-entry order is not the defect. The
re-probes themselves are not failing either: they come back right first try
**85.1%** of the time at 72 h against **82.8%** daily.

What the scheduler is really doing is **serving twice as many of them for a worse
result**:

| | daily | every third day | scheduler alone (72 h clock, 24 h loss) |
|---|---|---|---|
| re-probes served, per learner | 787 | 1,393 | **1,640** |
| lapses opened | 104.0 | 159.5 | 175.8 |
| claims lost to a lapse | 43.3 | 53.6 | 56.7 |
| claims lost to the form floor | 0.3 | 0.2 | 0.2 |
| lines that never crossed a gap | 0% | 32% | 14% |
| endgame soundings | 1,075 | **3** | 1 |

**The mechanism has a name: the ladder cannot outrun the learner's own cadence.**
`reviewMinutes` tops out at 7800 minutes — 130 hours. That is 5.4 nights, so a
daily returner's proved line rests five sittings. It is **1.8 gaps** for a learner
on a three-day cadence, so their proved lines are due at, or within two sittings
of, *every sitting, for ever*. The schedule has no state in which it can say
"this one is fine, spend the minute on something they cannot do yet" — which is
exactly what `soundings: 3` means. About one item in five of the whole course is
a re-probe the daily cohort does not have to serve.

### 11.3 Six scheduling changes, measured in two regimes, none shipped

All six keep the gate identical: the same proving run, the same form floor, the
same `durableMinutes`, the same two-miss rule. Each is a dial in `DEFAULT_MASTERY`
with its measurement written beside it, so none of this has to be re-discovered.

1. **`reviewCatchUp`** — a survived gap credits the rung it was actually long
   enough to pay for, instead of one rung above wherever the line happened to sit.
   A line that has just come back right after 72 hours has demonstrated 72 hours
   of retention; putting it back on an 8-hour rung asks a question the learner has
   this second answered. `tools/simulate.mjs --self-test` proves in both directions
   that the rung is still bought with elapsed time and cannot be ground out inside
   a sitting.
2. **A sixth rung** — `[10, 480, 1260, 3120, 7800, 19500]`, one more ×2.5 step, so
   the ladder goes on expanding for as long as the strength one survived re-probe
   buys goes on growing.
3. **A tighter ladder** — `[10, 120, 480, 1440, 4320]`: ten minutes, two hours,
   eight hours, one night, three nights, every rung landing on a gap a school
   actually takes instead of between two of them.
4. **The design document's own §6e recommendation**, `[10, 180, 720, 1800, 4320, 10080]`.
5. **`lapseStep`** — a missed re-probe steps the rung down by one instead of
   throwing the whole ladder away.
6. **`reviewProvenFactor`** — a line may not be parked longer than a multiple of
   the longest gap it has actually survived.
   **`beliefHalfLife` at three days** was measured too and is the worst of the lot
   (72 h true mastery 6.0% → 0.0%): a returning learner's belief is not the problem.

**Composed route, 150 learners an arm, identical seeds. Two regimes.** The left
half is the budget-matched arm `npm run check:mastery` certifies — every learner
plays until the 3,600 items are gone, which is 150 sittings. The right half is a
**sixty-school-day term**, 22 minutes a day, which is what a district buys.

| | budget-matched, 24 h | budget-matched, 72 h | 60-day term, 24 h | 60-day term, 72 h |
|---|---|---|---|---|
| | mastery / truly held / hollow lines | mastery / truly held / hollow lines | truly held / engine holds / hollow lines | truly held / engine holds / hollow lines |
| **shipping** | 93.3% / 23.5 / 0.09 | **6.0%** / 15.5 / 0.11 | **12.3** / 18.7 / **2.47** | **9.7** / 11.8 / **0.55** |
| catch-up + a sixth rung | **96.0%** / 23.5 / 0.13 | **14.0%** / **17.2** / 0.41 | 9.7 / 20.1 / 6.01 | **3.9** / 13.6 / **5.39** |
| catch-up alone | 93.3% / 23.3 / 0.15 | 9.3% / 15.9 / 0.31 | 9.5 / 19.6 / 5.15 | 8.8 / 12.1 / 1.26 |
| a sixth rung alone | 93.3% / 23.3 / 0.21 | 9.3% / 16.5 / — | 11.5 / 19.7 / 3.83 | 6.8 / 12.9 / 2.41 |
| tighter ladder | 86.0% / 23.1 / 0.06 | **0.0%** / 14.2 / 0.12 | **14.0** / 17.4 / **0.93** | **10.3** / 10.5 / **0.37** |
| §6e recommendation | 88.0% / 23.1 / 0.16 | 8.0% / 15.6 / 0.24 | 12.6 / 18.5 / 2.27 | 8.8 / 12.1 / 0.79 |
| lapse steps down | — | — | 12.0 / 19.8 / 3.31 | 9.4 / 12.1 / 0.71 |

**The two regimes disagree about the schedule, in opposite directions, and the
build reads only one of them.**

- Everything that makes the certified arm better does it by **serving fewer
  re-probes** (780 → 350 at 24 h) and spending the items on skills nobody has
  reached yet. That works when every learner finishes the course, which is what
  150 sittings buys.
- Inside a term nobody finishes. The items a longer ladder frees are spent in the
  middle of the lattice while the early lines rot unasked-about behind them. The
  engine ends up holding **more** lines while the learner knows **fewer**, and at
  a three-day cadence **every learner in the cohort** finishes the term holding at
  least one claim that is not true (hollow rate 45.3% → 100.0%).
- Push the ladder the other way and it mirrors exactly: the tighter ladder is
  better inside a term on everything about the learner — more knowledge truly
  held, a third of the hollow claims — and costs seven points of the headline and
  twenty points of the lowest ability quintile on the certified arm.

**And per unit, which is where the refusal is easiest to read.** `--unit` runs
each unit on its own — an advisory lattice, because it models a learner entering
with nothing behind them — but it is also the shortest course in the tree, and the
short course is the case the certified arm cannot see. All three arms, 600 learners,
the shipping engine against the same engine carrying the catch-up rule and a sixth
rung:

| | one sitting (the cram) | across days, every day | across days, every third day |
|---|---|---|---|
| `algebra1-l1` shipping | 100.0% | **87.8%** | **57.7%** |
| `algebra1-l1` with the change | 100.0% | **82.8%** | **52.0%** |
| `algebra1-l2` shipping | 82.3% | 17.8% | 0.0% |
| `algebra1-l2` with the change | 82.3% | 18.7% | 0.5% |
| the composed route, shipping | 98.0% | 91.0% | 6.3% |

Level 1 is the clearest case in the tree: **five points off the daily arm and
five and a half off the three-day arm, on the unit a class actually gets first.**
Learners holding a hollow line on that unit go from 17.5% to 38.5% at a three-day
cadence. The composed-route row is the reading `npm run check:mastery` printed on
this tree, exit 1, and it is the row that would have gone up.

**So none of them ships.** The shipping ladder sits between two regimes that want
opposite things, and a change that improves the arm this build is graded on while
making the sixty-day term worse is buying the gate's number with the district's.
`design/MASTERY-TAIL-AND-RETENTION.md` §6e reached the same trade from the other
end — its `slow` ladder reads 11.5% at thirty days against 48.0% — and this is a
second, independent measurement of it in the regime a school actually runs.

### 11.4 And the arm the gate certifies is a calendar nobody plays

The every-third-day arm is budget-matched: it plays until the 3,600-item budget is
gone, which the run itself reports as **149 sittings, 447 days from the first item
to the last — 64 weeks.** The daily arm's 150 sittings are a school year; the
three-day arm's 149 are two and a half of them.

That is the same defect shape as the `sessions: 40` finding this document already
records, one step along: the number is not wrong, it is about a cohort nobody is.
A three-day cadence inside one 180-day school year is **60 sittings**, and the
sixty-day term column above is the closest thing here to that reading. The
budget-matched arm remains the right comparison for *the schedule* — it is the
only one that holds the work constant — but it is not a statement about a class,
and `check:mastery` currently certifies nothing else.

### 11.5 What is left, and exactly what it rests on

After the scheduling work the every-third-day figure is where it was, and what it
rests on is a learner model. Every constant in it, its value, and whether anything
measured it:

| constant | value | where it came from | swept? |
|---|---|---|---|
| `GAP_POW` | 0.35 | **CHOSEN.** Power-law forgetting is measured in the literature; this exponent is not measured here. | yes, 0.25 / 0.35 / 0.45 |
| `PERMA` | 0.60 | **CHOSEN.** Bahrick permastore is a real effect; this fraction of peak is not measured here. | yes, 0.50 / 0.60 / 0.70 |
| the composition law | `iterated` | **CHOSEN, AND UNTIL THIS WAVE UNNAMED.** The power law is re-applied at every sitting boundary, so a line left alone for *n* sittings decays by `keep(h)^n` — exponential in the number of boundaries, which is the curve this file's own header says fits nonsense syllables and does not fit meaningful material. `elapsed` takes it once over the real time since the line was last practised. | yes, now printed |
| `GAP_GROWTH` | 2.5 | **CHOSEN.** Matched by argument to the engine ladder's own expansion, not to data. A 72-hour survival and an 8-hour survival buy the same strength, which is almost certainly wrong. | **no** |
| strength cap | 60 | **CHOSEN.** About five survived re-probes reach it. | **no** |
| stability step | 0.7 | **CHOSEN.** What one spaced retrieval takes off the within-sitting interference cost. | **no** |
| `DECAY` | 0.0018 | **CHOSEN.** Within-sitting interference per item. | **no** |
| `GAP_HOURS` | 24 | UNIT. The time scale the exponent is expressed in, not a free parameter. | n/a |

**The two that are swept move the answer by a factor of infinity.** Composed
route, 60 learners a cell, engine identical in all nine, true mastery at the
buzzer / a week later:

| every third day (72 h) | exponent 0.25 | 0.35 | 0.45 |
|---|---|---|---|
| **floor 0.50** | 3% / 3% | 0% / 0% | 0% / 0% |
| **floor 0.60** *(shipping)* | 18% / 18% | **5% / 5%** | 0% / 0% |
| **floor 0.70** | **43% / 43%** | 30% / 30% | 10% / 8% |

The daily arm over the same nine cells runs 62% to 98% and is above the 80% bar in
five of them. **The every-third-day row is 0% in three cells and 43% in another,
and nothing in this repository can say which cell is right.**

The composition law is a smaller lever than either constant at these values
(72 h: 5% iterated against 3% elapsed, 15.2 against 15.7 lines truly held), and
the reason is worth writing down: the median line finishes at the strength cap,
where the two laws barely differ. It would be a large lever for a cohort whose
lines never reach the cap — which is 32% of lines at a three-day cadence.

### 11.6 The same question under three defensible parameter choices

Not a sweep of arbitrary cells: three positions a reviewer could actually defend,
each run whole.

Composed shipped route, 60 learners a cell, identical seeds, the engine
byte-identical in all three — only the learner's memory moves:

| | `GAP_POW` | `PERMA` | composition | **daily** | Q1 | lines held | **every third day** | Q1 | lines held |
|---|---|---|---|---|---|---|---|---|---|
| **A · pessimistic** — fast forgetting, a low permastore floor; the position a sceptical reviewer would take | 0.45 | 0.50 | iterated | **61.7%** | 16.7% | 19.9 / 24 | **0.0%** | 0.0% | 10.4 / 24 |
| **B · shipping** — what every published figure in this repository is measured on | 0.35 | 0.60 | iterated | **93.3%** | 75.0% | 23.5 / 24 | **5.0%** | 0.0% | 15.2 / 24 |
| **C · literature-leaning** — a shallow power-law exponent for well-learned meaningful material, a Bahrick-scale floor, and the power law taken once over elapsed time rather than re-applied every boundary | 0.25 | 0.70 | elapsed | **98.3%** | 100.0% | 23.8 / 24 | **51.7%** | 8.3% | 20.6 / 24 |

Read the whole row before reading any cell.

- **Under A the product fails at BOTH cadences** — 61.7% daily, against an 80%
  bar. The daily claim this build is sold on is not robust to a pessimistic
  memory model either; it has simply never been asked.
- **Under C the three-day cadence reads 51.7%** — still under the bar, still not
  a product a district should be sold, but a completely different conversation
  from 5.0%: a schedule that is two thirds of the way there rather than one
  that does not work.
- **B — what ships — produces the largest gap between the two cadences of the
  three** (88.3 points, against 61.7 under A and 46.6 under C). That is not
  evidence of anything crooked. It is evidence that the specific sentence the
  district was shown — *daily is fine and anything wider is not* — is the
  sharpest form of the finding available, and it belongs to one uncalibrated
  setting of two constants and one composition rule.

**Neither the three-day refusal nor the daily promise is a measured claim yet.
Both are readings of the same uncalibrated model, and they move in the same
direction together.**

### 11.7 The calibration study that would settle it

It is small, and it is the same instrument the product already runs.

**Design.** A line the learner has proved is re-probed cold — unassisted, at the
gate band, on a form drawn the way the schedule already draws it. That item is
served anyway; the only change is that the delay is *randomised* rather than taken
from the ladder, and the outcome is recorded against the delay.

- **Delays:** 1, 3, 7, 14 and 30 nights, randomised within learner, so ability and
  item difficulty are balanced across the delay conditions.
- **The contrast that matters most is 1 night against 3 nights, within subject, on
  matched lines** — because that is the exact comparison the district's refusal
  turns on, and a within-subject design removes the ability variance that makes
  the between-cohort figure so noisy.
- **Sample.** One cold probe is a coarse instrument: measured here, pass rate runs
  68.7% at true competence 0.40–0.70 and 85.7% at 0.94–1.00, so a single item
  separates those two bands with about 17 points of signal. Pinning `GAP_POW` to
  ±0.05 and `PERMA` to ±0.05 needs on the order of **1,500–3,000 probe outcomes
  spread over the five delays** — roughly 150 students × 10 held lines × 2 probes
  each, which is one class-set of the product running normally for six weeks.
- **Estimation.** The engine's own response model gives `p(correct | k, demand)`;
  invert it per probe, then fit
  `k(t) = PERMA·peak + (k₀ − PERMA·peak)·(1 + t/(24·S))^−GAP_POW`
  by maximum likelihood, with `S` read off the learner's own recorded durable
  count. Fit the `iterated` and `elapsed` compositions as competing models and
  report the likelihood ratio — that settles the third choice as data rather than
  as an argument about functional forms.
- **`GAP_GROWTH` falls out of the same data for free**, because `S` is observed:
  regress the fitted per-line decay rate on the number of survived spaced
  re-probes and on the LENGTH of the gaps survived. If the length matters — and
  it almost certainly does — then "one durable pass is worth ×2.5 whatever the
  gap" is wrong, and it is currently the single largest unswept assumption here.

**What no simulation can do:** none of this is answerable from inside the
instrument. Every arm above holds the learner model fixed and moves the engine,
and the learner model is the thing in question. A limitation stated with its
sensitivity is a research plan; a single number nobody can defend is a liability.

### 11.8 Every command

All from `/Users/harrison/dev/aadmath`. None of them binds a port, builds `dist/`
or writes anything.

```bash
# §11.1  the 2x2 — it is now printed on every ordinary run, under
#        "coming back across days", and this is the standalone version
CADENCE_PROBE=1 PROBE_N=60 node tools/simulate.mjs 60 3600 --units algebra1-l1,algebra1-l2

# §11.2  the same probe prints the re-entry table, the churn ledger and the
#        durable-strength table; PROBE_ARMS picks a subset of the six arms
PROBE_ARMS="daily,every third day" CADENCE_PROBE=1 PROBE_N=60 node tools/simulate.mjs 60 3600 --units algebra1-l1,algebra1-l2

# §11.3  the schedule candidates, budget-matched — the arm check:mastery reads
SCHED_AB=1 PROBE_N=150 node tools/simulate.mjs 150 3600 --units algebra1-l1,algebra1-l2
#        …and the same candidates bound to a sixty-school-day term
SCHED_AB=1 SCHED_DAYS=60 PROBE_N=150 node tools/simulate.mjs 150 3600 --units algebra1-l1,algebra1-l2
#        …and any candidate of your own: label|reviewMinutes|CFG, semicolon separated
SCHED_AB=1 SCHED_ONLY=1 SCHED_EXTRA="mine|10,120,480,1440,4320|reviewCatchUp=1" node tools/simulate.mjs 150 3600 --units algebra1-l1,algebra1-l2
#        …and a scheduling change graded against a FIXED rate of forgetting
SCHED_AB=1 SCHED_DECAY=24 PROBE_N=150 node tools/simulate.mjs 150 3600 --units algebra1-l1,algebra1-l2

# §11.5, §11.6  the constants, and the composition
SIM_GAP_POW=0.25 SIM_PERMA=0.70 SIM_LAW=elapsed CADENCE_PROBE=1 PROBE_N=60 node tools/simulate.mjs 60 3600 --units algebra1-l1,algebra1-l2

# the rung rule, both directions, and that it cannot be ground out in a sitting
node tools/simulate.mjs --self-test
```

`SIM_LAW=elapsed` and `decayHours` are the only two things in `tools/simulate.mjs`
that can move a published figure, and both default to exactly what the file did
before this section existed: every number this build has been held against is
reproduced byte-for-byte by leaving them unset.

