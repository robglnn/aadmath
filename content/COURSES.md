# Adding a course

How to add Algebra II, Geometry or Trigonometry to ASCENT.

**You will write three things and edit one.** No engine file changes.

| # | What | Where |
|---|---|---|
| 1 | A knowledge graph | `content/graph/<unit>.json` |
| 2 | A generator pack | `src/content/packs/<pack>.js` |
| 3 | Item prose, EN + ES + PL | `content/lang/packs/<pack>.<loc>.js` |
| 4 | One manifest entry | `content/courses.json` |

Then run two gates. That is the whole job.

---

## Before you start

Read one worked example end to end. It is small and it is real:

- graph — `content/graph/algebra1-l2.json` (3 skills)
- pack — `src/content/packs/algebra1-l2.js`
- prose — `content/lang/packs/algebra1-l2.en.js`
- manifest — the `algebra1-l2` block in `content/courses.json`

Everything below is that example, explained.

---

## 1. Write the knowledge graph

One JSON file per **unit**. A unit is a coherent slice a learner can finish —
roughly 3 to 12 skills. A **course** is an ordered list of units.

```jsonc
{
  "id": "geometry-l1",
  "course": "geometry",
  "unit": "geometry-l1",
  "titleKey": "unit.geometry-l1.title",
  "schema": "unified-alignment-1",     // use the shared standards schema
  "requires": ["algebra1-l1"],         // units whose nodes your prereqs may name
  "mastery": { /* copy from algebra1-l2.json unless you have a reason */ },
  "commonMisconceptions": [ { "id": "arith-slip", "text": "…" } ],
  "nodes": [ /* see below */ ]
}
```

### A node

```jsonc
{
  "id": "angle-pairs",
  "prereqs": ["var-meaning"],
  "worldSite": "shoal",
  "bigIdea": "One sentence. Plain words. What the learner ends up believing.",

  "alignment": [
    { "framework": "CCSS-M", "code": "CCSS.MATH.CONTENT.HSG.CO.C.9",
      "text": "Prove theorems about lines and angles.", "depth": "core" },
    { "framework": "TEKS", "code": "G.6(A)",
      "citation": "19 TAC §111.41(c)(6)(A)",
      "text": "verify theorems about angles…", "depth": "supporting",
      "caveat": "Says exactly which part the gate does not test." }
  ],
  "practices": { "CCSS-M": ["MP.3"], "TEKS": ["G.1(G)"] },
  "alignmentNote": {
    "CCSS-M": "What the mastery gate actually proves, in prose.",
    "TEKS": "Same, per framework."
  },

  "bkt": { "pInit": 0.2, "pTransit": 0.26, "pSlip": 0.09, "pGuess": 0.12 },
  "requiredReps": ["symbolic", "context"],
  "misconceptions": [ { "id": "off-by-one-row", "text": "…" } ]
}
```

**Rules the gate enforces.**

1. `prereqs` must name a node in this unit or in a unit listed in `requires`.
2. The graph must be a DAG. No cycles.
3. Every node needs a generator. Every generator needs a node.
4. Every framework the course declares must be cited by every node.
5. `depth` is `core`, `supporting` or `introduced`. `core` means the mastery gate
   really tests it. Anything below `core` must carry a `caveat` saying which part
   is missing.
6. Every TEKS citation needs its 19 TAC reference.
7. Every misconception a distractor names must be declared here.

**One standards schema, four courses.** `alignment` is a flat list and every row
names its own framework, so Geometry citing `HSG.*` and `§111.41` works exactly
like Algebra citing `HSA.*` and `§111.39`. Read it with
`src/content/standards.js` — never by reaching for `node.standards` directly.
The Algebra I Level 1 graph still uses the older four-field shape and the same
reader normalises it, so nothing has to be rewritten.

---

## 2. Write the generator pack

```js
// src/content/packs/geometry-l1.js
import { kit } from '../../learn/generators.js';
import en from '../../../content/lang/packs/geometry-l1.en.js';
import es from '../../../content/lang/packs/geometry-l1.es.js';
import pl from '../../../content/lang/packs/geometry-l1.pl.js';

const { pick, int, nz, nzc, band, co, sg, lin, paren, distinct, arrayTex } = kit;

const anglePairs = [
  {
    id: 'ap-symbolic', rep: 'symbolic', dMin: 1, dMax: 5, distinctNums: true,
    build({ r, d, T }) {
      // …return a raw item
    },
  },
  // at least two forms per skill, and at least one non-symbolic
];

export default {
  id: 'geometry-l1',
  skills: { 'angle-pairs': anglePairs },
  strings: { en, es, pl },
};
```

### What `build` returns

```js
{
  stem: T('ask.solveFor', { v }),      // prose — always through T
  latex: '3x + 5 = 20',                // notation only, no prose, no \text{}
  type: 'numeric',                     // numeric | expression | special
  answer: '5',                         // exact: integer or n/d
  check: { kind: 'solve', math: '3x + 5 = 20', variable: 'x' },
  steps: [                             // at least two, each with a reason
    { latex: '3x = 15', why: T('why.unwrapConstantFirst') },
    { latex: 'x = 5',   why: T('why.divideBothByCoef', { a: 3 }) },
  ],
  distractors: [                       // at least five, every one tagged
    { v: '15', m: 'partial-rule' },
    // …
  ],
}
```

`check.kind` is one of `evaluate`, `solve`, `equivalent`, `equationChoice`,
`table`, `graph`. Each one re-derives the answer from the notation the learner
actually sees. If your mathematics does not fit one of them, add a kind to
`verify()` rather than skipping verification.

**Throw to redraw.** A `build` that does not like its own dice throws; the bank
draws again with the next seed. That is how you keep answers whole, keep numbers
distinct and refuse degenerate cases. See `drawBrackets` in `algebra1-l2.js`.

**The difficulty ladder is measured, not asserted.** `demandOf()` scores every
item, and the gate fails the build unless mean demand rises strictly from band 1
to band 5 within every skill. Make bands 4 and 5 genuinely harder — bigger
magnitudes, negatives, more terms — not the same question with longer digits.

**What a pack may not do.** It cannot reach the deck of situations, cannot touch
the served-scenes ledger and cannot skip `finalize`. A pack can add mathematics.
It cannot add a way past the content gate.

---

## 3. Write the prose, in three languages

`content/lang/packs/<pack>.{en,es,pl}.js`, each a flat `export default { key: string }`.

- Prose lives under `content/`, never in `src/`. `tools/check-i18n.mjs` enforces it.
- Key sets must be identical across the three locales. No blanks.
- A pack key may not collide with a key in `content/lang/items.*.js`. Prefix
  them (`l2.`, `geo.`) and you will not collide.
- You may **use** any existing key. `ask.solveFor`, `why.divideBothByCoef` and
  about seven hundred others are already written and translated.
- Interpolate with `{name}`. Inflect with `«n|one:…|other:…»`; Polish also takes
  `few:` and `many:`.
- Notation inside prose goes in `$…$`. Notation on its own goes in `latex`.

---

## 4. Add the manifest entry

`content/courses.json`:

```jsonc
{
  "id": "geometry",
  "titleKey": "course.geometry.title",
  "subject": "geometry",
  "status": "shipped",
  "frameworks": ["CCSS-M", "TEKS"],
  "units": [
    {
      "id": "geometry-l1",
      "titleKey": "unit.geometry-l1.title",
      "graph": "graph/geometry-l1.json",
      "pack": "geometry-l1",
      "requires": ["algebra1-l1"],
      "status": "shipped"
    }
  ]
}
```

Add `course.geometry.title` and `unit.geometry-l1.title` to `src/i18n/{en,es,pl}.js`,
and a `skills.<node-id>` entry for every node.

`default` at the top of the manifest names the unit a player gets when nothing
asks for anything else. **Do not change it** without a save migration: it is the
shipped experience.

---

## 5. Run the gates

```bash
node tools/validate-courses.mjs   # every unit: graph, generators, standards, 3 locales, ladder
node tools/validate-items.mjs     # the shipped Algebra I bank, unchanged
node tools/check-i18n.mjs         # no language in src/
node tools/course-proof.mjs       # engine + session planner + report, per lattice
node tools/simulate.mjs 800 800 --unit geometry-l1     # true mastery for your unit
node tools/simulate.mjs 800 1400 --course geometry     # …and for the whole course
```

`simulate.mjs` reads the lattice off the graph, so your unit is judged by the
same simulation Algebra I is, at the same bar: **≥95% of simulated learners
reach true mastery.** If yours does not, the content is wrong, not the harness.

---

## Playing it

```
http://127.0.0.1:5173/                     the default unit — Algebra I Level 1
http://127.0.0.1:5173/?unit=algebra1-l2    one unit on its own
http://127.0.0.1:5173/?course=algebra1     every unit in a course, composed
```

A unit loaded on its own drops prerequisites that point outside it, so it starts
at the root. Composing the course keeps every edge.

---

## What you do **not** touch

The mastery engine, the scheduler, the proving run, the session planner, the
close card, the report, the rift surface, the world, `src/main.js`. All of them
read the graph and the registry. If you find yourself editing one to add a
course, the architecture has a hole in it — say so rather than widening it.

Two exceptions, both additive:

- `src/i18n/*` — course, unit and skill names. Additive keys only.
- `verify()` in `src/learn/generators.js` — only if your mathematics genuinely
  needs a new kind of independent re-derivation.

---

## Where things live

| File | What it is |
|---|---|
| `content/courses.json` | the manifest — the only place content is named |
| `content/graph/*.json` | one knowledge graph per unit |
| `content/lang/packs/*` | pack prose, three locales |
| `src/content/index.js` | the browser loader (`?unit=`, `?course=`) |
| `src/content/registry.js` | the generator + prose registry |
| `src/content/standards.js` | the shared standards schema and its readers |
| `src/content/packs/*.js` | one generator pack per unit |
| `tools/_courses.mjs` | the same loader, for node tools |
| `tools/validate-courses.mjs` | the multi-course content gate |
| `tools/course-proof.mjs` | engine + planner + report, across every lattice |
