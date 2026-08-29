#!/usr/bin/env node
/**
 * DO THE TWO NEW RULES SEPARATE? — lane C, no browser, under a second.
 *
 *   node tools/critic/_laneC-rules.mjs
 *
 * It runs the REAL functions — `resolveObjective` out of src/meta/objective.js
 * and `createRepairWatch` out of src/meta/progress.js — over fabricated worlds
 * and fabricated learners, and requires each rule to fire on the shape it
 * exists for and to STAY QUIET on the shape beside it. That second half is the
 * half that matters: a rule that also catches the honest case gets switched off.
 *
 * It is deliberately not a `check:` script. `tools/check-all.mjs` refuses to
 * start if a `check:*` script is in neither of its two ledgers, and adding one
 * is a decision for whoever owns the build, not for the lane that wrote the
 * rules. It is here so that the next person can run it in a second.
 *
 * Every case gets a FRESH module instance, because the errand latch and the
 * arrival count are page state and one page is one cadet.
 */
const store = new Map();
globalThis.localStorage = {
  getItem: (k) => (store.has(k) ? store.get(k) : null),
  setItem: (k, v) => store.set(k, String(v)),
  removeItem: (k) => store.delete(k), clear: () => store.clear(),
};
globalThis.addEventListener = () => {};
globalThis.document = { documentElement: { style: { setProperty() {} } }, querySelectorAll: () => [] };

import path from 'node:path';
import { fileURLToPath } from 'node:url';
const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const OBJ = 'file://' + path.join(ROOT, 'src/meta/objective.js');
const PROG = 'file://' + path.join(ROOT, 'src/meta/progress.js');

const fails = [];
const note = (ok, label, detail = '') => {
  if (!ok) fails.push(label);
  console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ' — ' + detail : ''}`);
};

// ---------------------------------------------------------------------------
// A. THE FIELD LEG (src/meta/objective.js)
// ---------------------------------------------------------------------------
console.log('A. the objective may ask for a traversal verb — and only where it may');
let v = 0;
const fresh = () => import(OBJ + '?case=' + (++v));
const NODES = ['var-meaning', 'eval-expr', 'like-terms'].map((id) => ({ id, prereqs: [], bkt: { pInit: 0.25 } }));
const mastery = {
  graph: { nodes: NODES },
  get: () => ({ pL: 0.4, mastered: false }),
  isUnlocked: () => true,
  next: () => ({ id: 'var-meaning', kind: 'learn' }),
};
const V3 = (x, y, z) => ({ x, y, z, distanceTo(o) { return Math.hypot(x - o.x, y - o.y, z - o.z); } });
const rift = (id, x, z) => ({
  id, locked: false, mastered: false, foot: V3(x, 0, z), pos: V3(x, 0, z),
  group: { position: V3(x, 0, z) }, node: { prereqs: [] },
});
const MARK0 = { id: 'mark-reckoning', kind: 'mark', x: 40, y: 4, z: 0, rung: 0, air: false, open: true, nameKey: 'survey.reckoning' };
const MARK2 = { id: 'mark-watchtower', kind: 'mark', x: 90, y: 40, z: 0, rung: 2, air: false, open: true, nameKey: 'survey.watchtower' };
const CACHE = { id: 'cache-0', kind: 'cache', x: 120, y: 90, z: 0, rung: 1, air: true, open: true, nameKey: 'guide.site.cache' };

async function ask({ tears, sites, kitHas = [], px = 0, pz = 0, spent = null, mod = null }) {
  const M = mod || await fresh();
  M.clearField();
  M.registerField(() => sites);
  return {
    o: M.resolveObjective({
      mastery, rifts: { list: tears }, player: { pos: V3(px, 0, pz) },
      kit: { has: (id) => kitHas.includes(id) },
      stint: { spent: (id) => id === spent, release() {} },
    }),
    M,
  };
}

let r = await ask({ tears: [rift('var-meaning', 10, 0)], sites: [MARK0] });
note(r.o && r.o.skill === 'var-meaning' && r.o.verb === 'seal',
  'with nothing spent the objective is still the tear', r.o && r.o.skill + '/' + r.o.verb);

r = await ask({ tears: [rift('var-meaning', 10, 0)], sites: [MARK2, CACHE], spent: 'var-meaning' });
note(!!r.o && r.o.skill === 'var-meaning' && !r.o.field,
  'a cadet holding NOTHING is shown neither the high mark nor the cache — the arrival is given back',
  r.o && (r.o.skill + ' field=' + !!r.o.field));

r = await ask({ tears: [rift('var-meaning', 10, 0)], sites: [MARK0], spent: 'var-meaning' });
note(!!r.o && r.o.field && r.o.verb === 'climb' && r.o.skill === 'mark-reckoning',
  '…and IS sent to the mark he can walk to', r.o && (r.o.skill + '/' + r.o.verb));

r = await ask({ tears: [rift('var-meaning', 10, 0)], sites: [{ ...MARK0, x: 400 }], spent: 'var-meaning' });
note(!!r.o && !r.o.field, 'a place past the leg his kit has earned is not named', r.o && r.o.skill);

r = await ask({ tears: [rift('var-meaning', 10, 0)], sites: [MARK0, CACHE], kitHas: ['vault', 'kite'], spent: 'var-meaning' });
note(!!r.o && r.o.field && r.o.kind === 'cache' && r.o.verb === 'crack',
  'three held lines buy the wing, and the wing is what the card spends: THE CACHE',
  r.o && (r.o.skill + '/' + r.o.verb));

{
  const M = await fresh();
  const tears = [rift('var-meaning', 10, 0), rift('eval-expr', 40, 0)];
  const seen = [];
  for (let n = 1; n <= 4; n++) {
    const g = await ask({ tears, sites: [MARK0], kitHas: ['vault', 'kite'], spent: 'var-meaning', mod: M });
    seen.push(g.o && g.o.field ? 'FIELD' : 'tear');
    await ask({ tears, sites: [MARK0], kitHas: ['vault', 'kite'], spent: null, px: 10, mod: M });
  }
  note(seen.join(',') === 'tear,tear,FIELD,tear',
    'with another tear open, ONE arrival in three buys the walk and the rest go to the tear', seen.join(','));
}

{
  let g = await ask({ tears: [rift('var-meaning', 10, 0), rift('eval-expr', 40, 0)], sites: [MARK0], spent: 'var-meaning', px: 200, pz: 200 });
  g = await ask({ tears: [rift('var-meaning', 10, 0)], sites: [MARK0], spent: 'var-meaning', mod: g.M });
  const got = !!(g.o && g.o.field);
  const back = await ask({ tears: [rift('var-meaning', 10, 0), rift('eval-expr', 40, 0)], sites: [MARK0], spent: 'var-meaning', px: 40, pz: 0, mod: g.M });
  note(got && back.o && !back.o.field,
    'standing on an open plate ends the leg on the spot — a signpost never blocks a live tear',
    `leg=${got} then ${back.o && back.o.skill}`);
}

{
  const tears = [rift('var-meaning', 10, 0)];
  const g = await ask({ tears, sites: [MARK0], spent: 'var-meaning' });
  const first = !!(g.o && g.o.field);
  const on = await ask({ tears, sites: [MARK0], spent: 'var-meaning', px: 40, pz: 0, mod: g.M });
  const again = await ask({ tears, sites: [MARK0], spent: 'var-meaning', px: 40, pz: 0, mod: g.M });
  note(first && on.o && !on.o.field && again.o && !again.o.field,
    'arriving ENDS the errand, and it does not re-arm — the card never names the place he is standing on',
    `leg=${first} then ${on.o && on.o.skill}, ${again.o && again.o.skill}`);
}

// ---------------------------------------------------------------------------
// B. THE ONE NUMBER, WHEN IT GOES DOWN (src/meta/progress.js)
// ---------------------------------------------------------------------------
console.log('\nB. the headline figure explains a loss — once, and never a rise');
const { createRepairWatch, repaired } = await import(PROG);
const pnodes = ['var-meaning', 'eval-expr', 'like-terms'].map((id) => ({ id, bkt: { pInit: 0.25 } }));
const learner = (pL, mastered = {}) => ({
  graph: { nodes: pnodes },
  get: (id) => ({ pL: pL[id] ?? 0.25, mastered: !!mastered[id] }),
});
let now = 0;
const w = createRepairWatch(() => now);

const A = learner({ 'var-meaning': 0.85, 'eval-expr': 0.60, 'like-terms': 0.40 });
note(w.read(A) === null, 'the first reading of a session never speaks', repaired(A).pct + '%');
now += 60000;
const up = learner({ 'var-meaning': 0.90, 'eval-expr': 0.70, 'like-terms': 0.50 });
note(w.read(up) === null, 'a reading that went UP is silent', repaired(up).pct + '%');
now += 60000;
const down = learner({ 'var-meaning': 0.90, 'eval-expr': 0.30, 'like-terms': 0.50 });
const r1 = w.read(down);
note(!!r1 && r1.skill === 'eval-expr' && r1.key === 'guide.slip.line',
  'a fall names the line that fell furthest, as a miss on work in progress',
  JSON.stringify(r1) + ' at ' + repaired(down).pct + '%');
now += 5000;
note(w.read(learner({ 'var-meaning': 0.90, 'eval-expr': 0.28, 'like-terms': 0.48 })) === null,
  'a second fall inside the quiet window does not nag');
now += 60000;
const held = learner({ 'var-meaning': 0.99, 'eval-expr': 0.99, 'like-terms': 0.99 },
  { 'var-meaning': true, 'eval-expr': true, 'like-terms': true });
w.read(held);
now += 60000;
const slipped = learner({ 'var-meaning': 0.99, 'eval-expr': 0.40, 'like-terms': 0.99 },
  { 'var-meaning': true, 'like-terms': true });
const r2 = w.read(slipped);
note(!!r2 && r2.skill === 'eval-expr' && r2.key === 'guide.slip.held',
  'a line the engine had CLAIMED gets the other sentence', JSON.stringify(r2));
note(repaired(slipped).pct < repaired(held).pct,
  'and the figure itself still goes down — the posterior was not made a ratchet',
  `${repaired(held).pct}% -> ${repaired(slipped).pct}%`);

console.log(fails.length ? `\n${fails.length} rule(s) do not separate` : '\nevery rule fires on the shape it names and stays quiet on the one beside it');
process.exit(fails.length ? 1 : 0);
