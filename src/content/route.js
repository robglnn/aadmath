/**
 * THE ROUTE — which of a course's units this learner has opened.
 *
 * Split out of `index.js` for one reason: `index.js` resolves graphs with
 * `import.meta.glob`, which does not exist under node, so every rule in it was
 * unreachable by any tool. The rule that decides how much of a course a learner
 * is allowed to see is the single most consequential rule in the content layer
 * — sixty-two lines shipped and ten were reachable — and a rule no gate can run
 * is a rule nobody checks.
 *
 * So everything here is pure: no imports, no storage, no bundler. It is handed
 * the manifest's units and a function that says which skills a unit declares,
 * and it answers with unit ids. `src/content/index.js` calls it with the
 * bundled graphs; `tools/route-proof.mjs` calls it with the same graphs read
 * off disk, and both get the same answer because it is the same function.
 *
 * THE RULE
 *
 *   1. A unit that requires nothing is open. That is the first region, and it
 *      is open on a cleared save — which is why a new learner still gets
 *      exactly the shipped ten-node lattice.
 *   2. A unit is open when every line of every unit it `requires` is HELD.
 *      Held means proved at least once (`everMastered`): a line that has since
 *      lapsed on a spaced re-probe still counts, because the learner did that
 *      work and a region that went dark because a probe came due would be the
 *      game taking a place away from them.
 *   3. A unit the record already carries evidence in is open, whatever the
 *      roll-call says. This is the migration, and it is a hard guarantee:
 *      `MasteryEngine.load()` drops any skill that is not in the graph it was
 *      handed, and the next autosave writes only the survivors back — so a unit
 *      left out of the lattice would erase a record written in it.
 *   4. Whatever opens drags its own `requires` open with it, so a composed
 *      lattice can never hold an edge pointing at a node that is not in it.
 */

/**
 * @param {{id:string, requires?:string[]}[]} units the route's units, in order
 * @param {(unitId:string)=>string[]} nodesOf skills a unit declares
 * @param {{held?:Set<string>|string[], evidence?:Set<string>|string[]}} record
 * @returns {string[]} open unit ids, in the order they were given
 */
export function openUnitIds(units, nodesOf, record = {}) {
  const held = asSet(record.held);
  const evidence = asSet(record.evidence, held);
  const ids = units.map((u) => u.id);
  const open = new Set();
  for (const u of units) {
    const req = u.requires || [];
    const earned = req.length > 0 && req.every((id) => nodesOf(id).every((n) => held.has(n)));
    const stood = nodesOf(u.id).some((n) => evidence.has(n));
    if (!req.length || earned || stood) open.add(u.id);
  }
  let grew = true;
  while (grew) {
    grew = false;
    for (const u of units) {
      if (!open.has(u.id)) continue;
      for (const id of u.requires || []) {
        if (!open.has(id) && ids.includes(id)) { open.add(id); grew = true; }
      }
    }
  }
  return ids.filter((id) => open.has(id));
}

/**
 * The next unit on the route, and the lines still owed for it.
 *
 * Lines, never a percentage and never a lesson number: the game teaches
 * invisibly, and "3 lines to go" is a fact about the lattice while "Level 2" is
 * a label out of a textbook. (BRIEF invariant 4.)
 *
 * @returns {{unit:string, owed:string[]}|null}
 */
export function nextUnit(units, nodesOf, record = {}) {
  const held = asSet(record.held);
  const open = new Set(openUnitIds(units, nodesOf, record));
  for (const u of units) {
    if (open.has(u.id)) continue;
    const owed = [];
    for (const id of u.requires || []) for (const n of nodesOf(id)) if (!held.has(n)) owed.push(n);
    return { unit: u.id, owed };
  }
  return null;
}

/**
 * Everything the route knows at one instant.
 *
 * `seated` is what is actually on the island right now, which is not always
 * what has been opened: the world is raised at planetfall, so a region earned
 * mid-run is announced now and stood on next time the ground is made.
 */
export function stateOf(units, nodesOf, record = {}, seated = null) {
  const open = openUnitIds(units, nodesOf, record);
  const on = seated || open;
  return {
    open,
    seated: on,
    waiting: open.filter((id) => !on.includes(id)),
    next: nextUnit(units, nodesOf, record),
  };
}

/** A record read straight off a save's `mastery.skills` block. */
export function recordOfSkills(skills = {}) {
  const held = new Set();
  const evidence = new Set();
  for (const [id, s] of Object.entries(skills || {})) {
    if (!s) continue;
    if (s.everMastered || s.mastered) { held.add(id); evidence.add(id); }
    else if ((s.attempts || 0) > 0) evidence.add(id);
  }
  return { held, evidence };
}

function asSet(v, fallback = null) {
  if (v instanceof Set) return v;
  if (Array.isArray(v)) return new Set(v);
  return fallback || new Set();
}
