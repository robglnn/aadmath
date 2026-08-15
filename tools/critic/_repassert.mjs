/**
 * THE CONTRADICTION ASSERTIONS.
 *
 * One rule, applied thirty ways: **no two figures a teacher can see may be true
 * of different worlds.**
 *
 * A progress report is not defensible because each number was computed
 * correctly. It is defensible because the numbers cannot disagree. Every
 * assertion below is a pair of figures that a cold reader put beside each other
 * and found could not both be right — or a pair that could go the same way
 * tomorrow if nothing stopped it.
 *
 * These are pure functions over a capture, so they run in this file, in
 * tools/critic/repcheck.mjs against a real driven session, and in
 * tools/critic/rep-audit.mjs against the scripted one. Nothing here reaches for
 * a browser.
 *
 * Run `node tools/critic/_repassert.mjs --self-test` to check the assertions
 * themselves: each one is fed a capture it must pass and a capture it must
 * catch, because an assertion that has never failed has never been tested.
 */

export const fmt = {
  mins: (ms) => `${Math.floor(ms / 60000)}m ${Math.round((ms % 60000) / 1000)}s`,
  pct: (x) => (x == null ? 'n/a' : `${Math.round(x * 100)}%`),
};

/** Within `tol` of each other, for figures that are both measured. */
const near = (a, b, tol) => Math.abs(a - b) <= tol;
/** A rendered figure that reads as a measurement rather than as "unknown". */
const READS_AS_MEASURED = /\d/;
/** The mark this report uses for a figure nobody has measured. */
export const UNMEASURED = '—';

/**
 * @param {object} cap one checkpoint from repcheck.mjs
 * @returns {string[]} every contradiction found, in reading order
 */
export function auditReport(cap) {
  const out = [];
  const bad = (m) => out.push(m);
  const snap = cap.snapshot;
  if (!snap) return ['the report exposed no snapshot to check'];
  const skills = snap.skills || [];
  const model = cap.model || {};
  const verified = !snap.trust || snap.trust.level === 'verified';

  // ---------------------------------------------------------------- the clock
  // "This session" is the one figure a learner checks against their own watch.
  // It must be real elapsed session time, not the sum of the gaps between
  // answers — which is what made a sixteen-minute sitting read "4 min".
  if (cap.wallMs != null) {
    const tol = Math.max(30_000, cap.wallMs * 0.08);
    if (!near(snap.sessionMs, cap.wallMs, tol)) {
      bad(`"this session" reads ${fmt.mins(snap.sessionMs)} at wall-clock ${fmt.mins(cap.wallMs)}`
        + ` (tolerance ${fmt.mins(tol)}) — session time is not elapsed session time`);
    }
  }
  if (snap.sessionTaskMs != null && snap.sessionMs < snap.sessionTaskMs - 1000) {
    bad(`this session (${fmt.mins(snap.sessionMs)}) is shorter than the time on task inside it`
      + ` (${fmt.mins(snap.sessionTaskMs)})`);
  }
  if (snap.totalMs != null && snap.sessionMs > snap.totalMs + 1000 && snap.totalMs === 0 && snap.items > 0) {
    bad('time on task is zero while questions have been answered');
  }

  // --------------------------------------------------------------- the totals
  const sumItems = skills.reduce((a, s) => a + (s.items || 0), 0);
  if (sumItems !== snap.items) {
    bad(`questions answered reads ${snap.items} but the ten lines add up to ${sumItems}`);
  }
  const held = skills.filter((s) => s.state === 'mastered' || s.state === 'provisional').length;
  if (held !== snap.mastered) bad(`lines held reads ${snap.mastered} but ${held} lines are in a held state`);
  if (snap.granted < held) bad(`${held} lines are held but only ${snap.granted} claims were ever granted`);
  const expectHollow = snap.granted ? snap.withdrawn / snap.granted : null;
  if (expectHollow == null ? snap.hollowRate != null : !near(snap.hollowRate, expectHollow, 1e-6)) {
    bad(`claims withdrawn reads ${fmt.pct(snap.hollowRate)} but ${snap.withdrawn} of ${snap.granted}`
      + ` is ${fmt.pct(expectHollow)}`);
  }
  if (snap.accuracy != null && (snap.accuracy < 0 || snap.accuracy > 1)) {
    bad(`whole-record unaided rate is ${snap.accuracy}, which is not a share`);
  }
  if (snap.items === 0 && snap.accuracy != null) {
    bad('an unaided rate is published with no questions answered');
  }

  // ------------------------------------------------------ what comes next
  if (snap.next && (snap.next.why === 'fresh' || snap.next.why === 'continue')) {
    const nx = skills.find((s) => s.id === snap.next.id);
    if (nx && (nx.state === 'mastered' || nx.state === 'provisional')) {
      bad(`"next" offers ${snap.next.id} as new ground, and the same screen says it is held`);
    }
    if (snap.next.why === 'fresh' && nx && nx.items > 0) {
      bad(`"next" calls ${snap.next.id} new ground with ${nx.items} questions already answered on it`);
    }
  }
  // The card used to promise "three clean answers" whatever the live run
  // actually had left, on the same screen as the evidence row saying five.
  if (snap.next?.why === 'check' && cap.next) {
    const said = (cap.next.match(/\d+/) || [])[0];
    if (said != null && snap.next.left != null && Number(said) !== snap.next.left) {
      bad(`"next" promises ${said} clean answers and the live proving run has ${snap.next.left} left`);
    }
  }

  // ------------------------------------------------------------- line by line
  for (const s of skills) {
    const m = model[s.id] || {};
    const row = (cap.rows || []).find((r) => r.name && r.name === s.title) || null;
    const where = s.id;

    // A state and an item count that describe different learners.
    if (s.state === 'open' && s.items > 0) bad(`${where}: state OPEN with ${s.items} questions answered`);
    // A proved line drawn as locked. The strip counts what the model holds, so
    // a row that hides a held claim behind LOCKED puts the two out of step —
    // and takes a learner's evidence away over a lapse somewhere else.
    if (s.state === 'locked' && m.mastered) {
      bad(`${where}: drawn LOCKED while the model holds the claim`);
    }
    if (s.underReopened && s.state !== 'mastered' && s.state !== 'provisional') {
      bad(`${where}: flagged as held-on-reopened-ground while its state reads ${s.state}`);
    }
    if (s.state === 'practising' && s.items === 0) bad(`${where}: state IN PROGRESS with no question answered`);
    if (verified && m.attempts != null && m.attempts !== s.items) {
      bad(`${where}: the model counts ${m.attempts} attempts, the ledger counts ${s.items} questions`);
    }

    // THE ZERO-ATTEMPT CONFIDENCE. A percentage under a line nobody has asked a
    // question about is a measurement of nothing, and it reads as a measurement.
    if (s.items === 0) {
      if (s.accuracy != null) bad(`${where}: an unaided rate on a line with no attempts`);
      if (s.measured) bad(`${where}: flagged measured with no attempts`);
      if (row && READS_AS_MEASURED.test(row.pct)) {
        bad(`${where}: the row prints confidence "${row.pct}" for a line with zero attempts`);
      }
    }

    // A posterior that rounds up to certainty. BKT never reaches one, so a
    // report that prints 100% is rounding a belief into a fact.
    if (row && /^100\s*%$/.test(row.pct.replace(/ /g, ' ')) && s.pL < 1) {
      bad(`${where}: confidence prints 100% for a posterior of ${s.pL}`);
    }

    // ------------------------------------------------------------ the receipt
    const held2 = s.state === 'mastered' || s.state === 'provisional';
    if (held2 && !s.claim) {
      const rows = s.evidence || [];
      const saysSo = rows.some((e) => e.met === 'old');
      if (!saysSo) bad(`${where}: held with no receipt, and no evidence row says so`);
    }
    if (s.claim) {
      const c = s.claim;
      if (c.items !== (c.entryRun || 0) + (c.checkDone || 0)) {
        bad(`${where}: the claim says ${c.items} items but ${c.entryRun} + ${c.checkDone} is`
          + ` ${(c.entryRun || 0) + (c.checkDone || 0)}`);
      }
      if (c.checkDone < c.checkNeed) {
        bad(`${where}: the claim was granted on ${c.checkDone} of ${c.checkNeed} proving items`);
      }
      // THE ONE A CURRICULUM DIRECTOR CAUGHT. The claim may not rest on more
      // unassisted items than there were questions on the line when it was made.
      if (c.itemsAtClaim != null && c.items > c.itemsAtClaim) {
        bad(`${where}: the claim rests on ${c.items} unassisted items out of ${c.itemsAtClaim}`
          + ' questions answered before it was granted');
      }
      // "PROVED OUT ON FIRST CONTACT" MEANS FIRST CONTACT. The sight road is
      // still the sight road when the run afterwards absorbs a miss — but the
      // card may not then say the line proved out cold, and the flag that
      // decides that sentence is checked here rather than in the prose.
      if (c.road === 'sight') {
        const clean = (c.missed || 0) === 0 && c.itemsAtClaim === c.items;
        if (c.firstContact !== clean) {
          bad(`${where}: firstContact=${c.firstContact} but the run absorbed ${c.missed || 0} miss(es)`
            + ` over ${c.itemsAtClaim} questions for a ${c.items}-item claim`);
        }
      }
      // The split the card prints has to add up.
      if (c.itemsAtClaim != null && s.itemsSinceClaim != null
        && c.itemsAtClaim + s.itemsSinceClaim !== s.items) {
        bad(`${where}: ${c.itemsAtClaim} before the claim + ${s.itemsSinceClaim} since`
          + ` is not the ${s.items} questions on this line`);
      }
    }
    if (!s.claim && s.itemsSinceClaim != null) {
      bad(`${where}: a "since the claim" count with no claim`);
    }

    // The unaided rate has to be the rate of the counts beside it.
    if (s.accuracy != null && s.unaidedRight != null && s.items) {
      if (!near(s.accuracy, s.unaidedRight / s.items, 1e-6)) {
        bad(`${where}: unaided reads ${fmt.pct(s.accuracy)} but ${s.unaidedRight} of ${s.items}`
          + ` is ${fmt.pct(s.unaidedRight / s.items)}`);
      }
      if (s.unaidedRight > s.items) bad(`${where}: ${s.unaidedRight} unaided solves out of ${s.items} questions`);
    }

    // ------------------------------------------------- the screen vs the data
    if (row) {
      const q = row.facts?.find((f) => /questions here/i.test(f.k));
      if (q && s.claim && /first contact/i.test(JSON.stringify(row.evidence || []))
        && !new RegExp(`\\b${s.claim.items}\\b`).test(q.v)) {
        bad(`${where}: the card says the line proved out on first contact and prints "${q.v}" questions here`);
      }
      if (row.sum) {
        const nums = row.sum.match(/\d+/g)?.map(Number) || [];
        if (nums.length >= 2 && nums[0] > nums[1]) {
          bad(`${where}: the claim sentence reads "${row.sum.trim()}" — more evidence than questions`);
        }
      }
    }
  }

  // ------------------------------------------------------- standards coverage
  for (const r of snap.coverage?.rows || []) {
    if (r.heldLines > r.totalLines) bad(`${r.code}: ${r.heldLines} lines held of ${r.totalLines}`);
    if (r.unaided > r.answers) bad(`${r.code}: ${r.unaided} unaided out of ${r.answers} answers`);
    if (r.formsMet > r.formsDeclared) bad(`${r.code}: ${r.formsMet} question types met of ${r.formsDeclared} declared`);
    if (r.cover === 'held' && r.heldLines < r.totalLines) {
      bad(`${r.code}: grouped as HELD with ${r.heldLines} of ${r.totalLines} lines proved`);
    }
    if (r.cover === 'none' && r.answers > 0) bad(`${r.code}: grouped as NO EVIDENCE with ${r.answers} answers`);
  }
  const tot = snap.coverage?.totals;
  if (tot) {
    if (tot.coreHeld > tot.coreTotal) bad(`core held ${tot.coreHeld} of ${tot.coreTotal}`);
    if (tot.evidenced + tot.none > tot.total) {
      bad(`coverage: ${tot.evidenced} evidenced + ${tot.none} untouched exceeds ${tot.total} expectations`);
    }
  }

  return out;
}

/**
 * THE COUNTER THAT ONLY WENT UP.
 *
 * A cold critic watched a strip labelled "left" read 2 → 6 → 10 → 13 → 39 and
 * wrote: *"a number called 'left' that only goes up is not a number."* They were
 * right about the label and it was worse than they knew — the figure is the
 * wallet balance after the movement, which is a perfectly good number under a
 * perfectly wrong noun.
 *
 * So two things are checked. The running balance must be arithmetic: each line's
 * figure is the line before it plus that line's delta. And the number must be
 * allowed to fall, which a balance does and a countdown of things "left" to
 * collect never would in the same log.
 */
export function auditLedgerStrip(log) {
  const out = [];
  if (!Array.isArray(log) || log.length < 2) return out;
  // The log is newest first.
  const rows = [...log].reverse();
  for (let i = 1; i < rows.length; i++) {
    const want = rows[i - 1].left + (rows[i].delta || 0);
    if (rows[i].left !== want) {
      out.push(`the wallet strip printed ${rows[i].left} after a movement of ${rows[i].delta}`
        + ` from ${rows[i - 1].left} — the running figure is not the balance it claims to be`);
      break;
    }
  }
  return out;
}

// ---------------------------------------------------------------------------
// Self-test: every assertion gets one capture it passes and one it catches.
// ---------------------------------------------------------------------------
if (process.argv.includes('--self-test')) {
  const clean = () => ({
    wallMs: 16 * 60_000,
    model: { a: { attempts: 3 }, b: { attempts: 0 } },
    rows: [
      { name: 'A', pct: '96%', facts: [{ k: 'Questions here', v: '3' }], evidence: [{ note: 'proved out on first contact' }], sum: 'rests on 3 unassisted items, out of 3 questions' },
      { name: 'B', pct: '—', facts: [], evidence: [], sum: '' },
    ],
    snapshot: {
      trust: { level: 'verified' },
      sessionMs: 16 * 60_000, sessionTaskMs: 9 * 60_000, totalMs: 9 * 60_000,
      items: 3, accuracy: 1, mastered: 1, total: 2,
      granted: 1, withdrawn: 0, hollowRate: 0,
      next: { id: 'b', why: 'fresh' },
      coverage: { totals: { evidenced: 1, total: 2, coreHeld: 1, coreTotal: 1, none: 1 }, rows: [] },
      skills: [
        {
          id: 'a', title: 'A', state: 'mastered', pL: 0.96, items: 3, measured: true,
          accuracy: 1, unaidedRight: 3, itemsSinceClaim: 0,
          claim: { road: 'sight', entryRun: 0, entryNeed: 0, checkDone: 3, checkNeed: 3, items: 3, itemsAtClaim: 3, missed: 0, firstContact: true },
          evidence: [],
        },
        { id: 'b', title: 'B', state: 'open', pL: 0.8, items: 0, measured: false, accuracy: null, unaidedRight: 0, claim: null, evidence: [] },
      ],
    },
  });

  const cases = [
    ['a clean capture raises nothing', clean(), 0],
    ['session time that is not elapsed time',
      (() => { const c = clean(); c.snapshot.sessionMs = 4 * 60_000; return c; })(), 1],
    ['confidence printed on a line with zero attempts',
      (() => { const c = clean(); c.rows[1].pct = '80%'; return c; })(), 1],
    ['confidence rounded up to certainty',
      (() => { const c = clean(); c.rows[0].pct = '100%'; return c; })(), 1],
    ['first contact claimed over a run that absorbed a miss',
      (() => { const c = clean(); const cl = c.snapshot.skills[0].claim; cl.missed = 1; cl.itemsAtClaim = 5; c.snapshot.skills[0].items = 5; c.model.a.attempts = 5; c.snapshot.items = 5; c.snapshot.skills[0].unaidedRight = 4; c.snapshot.skills[0].accuracy = 4 / 5; c.snapshot.accuracy = 4 / 5; return c; })(), 1],
    ['a claim resting on more items than were asked',
      (() => { const c = clean(); c.snapshot.skills[0].claim.items = 6; c.snapshot.skills[0].claim.checkDone = 6; return c; })(), 1],
    ['the ten lines not adding up to the total',
      (() => { const c = clean(); c.snapshot.items = 9; return c; })(), 1],
    ['a hollow rate that is not the ratio beside it',
      (() => { const c = clean(); c.snapshot.hollowRate = 0.5; return c; })(), 1],
    ['a held line offered as new ground',
      (() => { const c = clean(); c.snapshot.next = { id: 'a', why: 'fresh' }; return c; })(), 1],
    ['a before/after split that does not add up',
      (() => { const c = clean(); c.snapshot.skills[0].itemsSinceClaim = 4; return c; })(), 1],
    ['a state that disagrees with the item count',
      (() => { const c = clean(); c.snapshot.skills[1].state = 'practising'; return c; })(), 1],
    ['an unaided rate that is not the counts beside it',
      (() => { const c = clean(); c.snapshot.skills[0].accuracy = 0.5; return c; })(), 1],
    ['a proved line drawn as locked',
      (() => { const c = clean(); c.snapshot.skills[0].state = 'locked'; return c; })(), 1],
    ['a next card promising a run length the run does not have',
      (() => {
        const c = clean();
        c.next = 'The proving run is live: 3 clean answers to go, no help, harder than usual.';
        c.snapshot.next = { id: 'b', why: 'check', left: 5 };
        return c;
      })(), 1],
  ];

  let bad = 0;
  for (const [name, cap, wantAtLeast] of cases) {
    const got = auditReport(cap);
    const ok = wantAtLeast === 0 ? got.length === 0 : got.length >= wantAtLeast;
    if (!ok) { bad += 1; console.log(` FAIL  ${name} — got ${got.length}: ${got.join(' | ')}`); }
    else console.log(`  ok   ${name}${got.length ? ' — ' + got[0].slice(0, 90) : ''}`);
  }

  const stripCases = [
    ['a balance that adds up', [{ delta: -9, left: 31 }, { delta: 2, left: 40 }, { delta: 2, left: 38 }], 0],
    ['a running figure that is not a balance', [{ delta: 4, left: 39 }, { delta: 4, left: 13 }, { delta: 4, left: 10 }], 1],
  ];
  for (const [name, log, want] of stripCases) {
    const got = auditLedgerStrip(log);
    const ok = want === 0 ? got.length === 0 : got.length >= want;
    if (!ok) { bad += 1; console.log(` FAIL  ${name} — got ${got.length}`); }
    else console.log(`  ok   ${name}`);
  }

  console.log(bad ? `\n${bad} assertion(s) do not do what they claim` : '\nassertions self-test passed');
  process.exit(bad ? 1 : 0);
}
