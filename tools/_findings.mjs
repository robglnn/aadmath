#!/usr/bin/env node
/**
 * THE FINDINGS COLLECTOR — the exit code is not the gate author's to write.
 *
 *   import { findings } from './_findings.mjs';        // tools/
 *   import { findings } from '../_findings.mjs';       // tools/critic/
 *
 *   const F = findings('check:shape', { scope: 'sweep', onRoute });
 *   F.route(`${form} hands a cadet 62.2% against 25.0% over 412 sets`);
 *   F.preview('…the same thing in a unit nobody is sent to');
 *   F.done();            // prints the ledger, prints the machine line, exits
 *
 * WHY THIS FILE EXISTS — THE SAME DISEASE, THREE TIMES.
 *
 *  1. `check:mastery` was out of the build with the reason written into the
 *     tree as *"It currently fails on Levels 2 and 4."* A gate excluded because
 *     it fails is the defect wearing a decision's clothes.
 *  2. Back in the build, it went green by regex-matching the CRAM arm while the
 *     delivered-shape arm in the same output read `0.0%`.
 *  3. `tools/critic/choiceshape.mjs` found per-form answer leaks ON THE SHIPPED
 *     ROUTE at 62.2% and 57.3% against a 25% chance, PRINTED THEM IN FULL, and
 *     then wrote `the bar this gate enforces is the surface` and **returned 0**.
 *
 * Every one of those is one shape: A GATE HOLDS A FINDING SCOPED TO THE SHIPPED
 * ROUTE AND REPORTS SUCCESS. That is worse than having no gate at all, because
 * it manufactures confidence and buries the finding in a passing log where
 * nobody reads it — twice now, a human re-found by hand a defect a gate had
 * already printed.
 *
 * Patching the three gates is not a fix; it is the fourth patch. So the rule is
 * structural and it lives here, in one place every gate uses:
 *
 *   THE COLLECTOR OWNS THE EXIT CODE.
 *
 * A gate declares findings; it does not decide what they are worth. The moment
 * a route- or engine-scoped finding is declared, this module installs a
 * `process.on('exit')` guard that REWRITES a zero exit code to 1 — after
 * `process.exit(0)`, after a `return 0` from `main()`, after anything. A gate
 * author cannot accidentally or deliberately print a route finding and return
 * success, because the success is not theirs to return.
 *
 * And because a lock inside one process only binds the processes that use it,
 * the ledger is also printed as ONE MACHINE-READABLE LINE:
 *
 *   GATE-FINDINGS v1 gate=check:shape route=2 preview=7 engine=0 exit=1
 *
 * `tools/check-all.mjs` reads that line out of every gate's output and applies
 * the same rule from OUTSIDE the process: a gate that exits 0 while its own
 * ledger holds a route finding is recorded RED by the runner, whatever the gate
 * thought. Two independent locks on the same rule, because this rule has been
 * broken three times by three different mechanisms.
 *
 * WHAT IS AND IS NOT FATAL — the severity rule this repo already applies, in
 * one place instead of five:
 *
 *   route    the defect is in front of a learner today.        FATAL
 *   engine   not unit-scoped: the runner, the solver, the      FATAL
 *            bundles, the gates themselves. Red everywhere.
 *   preview  a unit on disk that no learner is sent to.        ADVISORY —
 *            printed in full, every time, and named in the build's summary;
 *            promoting the unit in content/courses.json makes the identical
 *            finding fatal on the next run with no edit to any tool.
 *
 * `forUnit(unitId, text)` applies that rule off `content/courses.json` rather
 * than off a gate author's judgement, so severity cannot drift between gates.
 */
import process from 'node:process';

/** The three scopes a finding can have. Fatal-ness is a property of the scope. */
export const SCOPES = ['route', 'preview', 'engine'];
/** The scopes that stop a shipment. */
export const FATAL = new Set(['route', 'engine']);

/** The machine line every converted gate prints last. Read by tools/check-all.mjs. */
export const LEDGER_MARK = 'GATE-FINDINGS v1';
const LEDGER_RE = /^GATE-FINDINGS v1 gate=(\S+) route=(\d+) preview=(\d+) engine=(\d+) exit=(\d+)\s*$/gm;

/**
 * THE VERDICT, as a pure function so it can be planted against.
 *
 * @param {{route:number, preview:number, engine:number}} counts
 * @returns {0|1}
 */
export function verdict(counts) {
  const n = (k) => Math.max(0, Number(counts?.[k]) || 0);
  return n('route') > 0 || n('engine') > 0 ? 1 : 0;
}

/**
 * Read a gate's ledger out of whatever it printed.
 *
 * Returns `null` when the gate printed no ledger at all — which is not the same
 * as a clean ledger, and `tools/check-all.mjs` reports the difference: an
 * unconverted gate's exit code is its own unchecked claim.
 *
 * @param {string} text  the gate's output, or the tail of it
 * @returns {{gate:string, route:number, preview:number, engine:number, exit:number}|null}
 */
export function parseLedger(text) {
  /* THE LAST LEDGER IN THE OUTPUT IS THE AUTHORITATIVE ONE, and reading the
     first one is a hole exactly the shape of the ones this file exists to
     close. Most gates are two stages joined by `&&` — `node x.mjs --self-test
     && node x.mjs` — and a tool whose self-test path falls through to the same
     verdict prints a ledger TWICE. `check:echo` does, on every run. If the
     runner read the first, a clean self-test ledger would stand in front of the
     real run's route findings and the build would believe it. */
  let last = null;
  const re = new RegExp(LEDGER_RE.source, 'gm');
  for (const m of String(text || '').matchAll(re)) last = m;
  if (!last) return null;
  return {
    gate: last[1], route: Number(last[2]), preview: Number(last[3]), engine: Number(last[4]), exit: Number(last[5]),
  };
}

/**
 * THE RUNNER'S RULE, as a pure function so it can be planted against too.
 *
 * Given what a gate printed and the code it actually exited with, what should
 * the build record? This is the outside lock: it does not trust the child's
 * exit code when the child's own ledger contradicts it.
 *
 * @param {{route:number, preview:number, engine:number, exit:number}|null} ledger
 * @param {number} childCode  the exit code the process really returned
 * @returns {{code:number, where:'route'|'preview'|'engine'|null, overridden:string|null}}
 */
export function judgeRun(ledger, childCode) {
  if (!ledger) return { code: childCode, where: null, overridden: null };
  const want = verdict(ledger);
  const where = ledger.route > 0 ? 'route' : ledger.engine > 0 ? 'engine' : ledger.preview > 0 ? 'preview' : null;
  if (want === 1 && childCode === 0) {
    return {
      code: 1,
      where,
      overridden: `it exited 0 while its own ledger held ${ledger.route} route and ${ledger.engine} engine finding(s) — `
        + 'the runner decides that, not the gate',
    };
  }
  /* A gate that goes red for a reason it did not write down is still red: the
     child's own non-zero code stands. Only the zero is overridden, because only
     the zero is the failure mode this file exists for. */
  return { code: childCode, where, overridden: null };
}

// ---------------------------------------------------------------------------

let ARMED = null;   // the one armed ledger in this process

/**
 * One gate's findings.
 *
 * Not exported directly — `findings()` gives you the armed one and `sandbox()`
 * gives you an inert one for a self-test. That distinction matters: a self-test
 * has to be able to build a ledger holding a route finding and read its verdict
 * WITHOUT poisoning the exit code of the self-test itself.
 */
class Ledger {
  /**
   * @param {string} gate  the npm script name, e.g. 'check:shape'
   * @param {{scope?:string, onRoute?:(id:string)=>boolean, out?:(s:string)=>void, armed?:boolean}} opts
   */
  constructor(gate, opts = {}) {
    this.gate = String(gate || 'unnamed-gate');
    this.declaredScope = opts.scope || 'sweep';
    this.onRoute = opts.onRoute || null;
    this.out = opts.out || ((s) => console.log(s));
    this.items = [];
    this.armedFlag = false;
    this.reported = false;
    if (opts.armed) this._arm();
  }

  /* THE LOCK. Installed on construction of the armed ledger, not on the first
     finding, so there is no window in which a gate can declare and exit before
     the guard exists. It only ever turns a 0 into a 1. */
  _arm() {
    if (this.armedFlag) return;
    this.armedFlag = true;
    process.on('exit', (code) => {
      const c = this.counts();
      if (verdict(c) !== 1) return;
      if (code === 0) {
        /* stderr, because stdout may be a pipe somebody is grepping and this is
           the one sentence that must not be lost. */
        process.stderr.write(`\n${this.gate}: REFUSED TO EXIT 0 — ${c.route} route and ${c.engine} engine `
          + 'finding(s) are on this gate\'s ledger. A gate that reports a route defect and returns success is\n'
          + 'worse than no gate: see tools/_findings.mjs.\n');
        process.exitCode = 1;
      }
      if (!this.reported) {
        process.stderr.write(`${this.gate}: the ledger was never reported — printing it now so the finding is not lost\n`);
        this.report();
      }
    });
  }

  /** @returns {{route:number, preview:number, engine:number}} */
  counts() {
    const c = { route: 0, preview: 0, engine: 0 };
    for (const f of this.items) c[f.where]++;
    return c;
  }

  /** The code this ledger requires. */
  code() { return verdict(this.counts()); }

  /**
   * Declare one finding.
   *
   * @param {'route'|'preview'|'engine'} where
   * @param {string} text  what is wrong, in a sentence somebody can act on
   * @param {object} [meta] anything a report wants to carry (unit, skill, form)
   */
  add(where, text, meta = {}) {
    if (!SCOPES.includes(where)) throw new Error(`${this.gate}: "${where}" is not a finding scope; use ${SCOPES.join(' / ')}`);
    const t = String(text || '').trim();
    if (!t) throw new Error(`${this.gate}: a finding with no sentence in it is not a finding`);
    this.items.push({ where, text: t, ...meta });
    return this;
  }

  /**
   * A finding whose sentence came out empty is still a finding.
   *
   * The one thing this file may never do is drop something a gate found, so an
   * empty or null entry is recorded with a sentence saying the gate produced
   * one and could not describe it. Dropping it silently would be the disease
   * wearing a helper's clothes.
   */
  _each(where, texts) {
    for (const t of texts.flat()) {
      const s = t == null ? '' : String(t).trim();
      this.add(where, s || `${this.gate} declared a ${where} finding with no sentence in it — see the output above`);
    }
    return this;
  }

  /** A defect a learner meets today. Fatal. */
  route(...texts) { return this._each('route', texts); }
  /** A defect in a unit nobody is sent to. Advisory, printed in full. */
  preview(...texts) { return this._each('preview', texts); }
  /** A defect that is not unit-scoped at all — the engine, the bundles, the gates. Fatal. */
  engine(...texts) { return this._each('engine', texts); }

  /**
   * SEVERITY FOLLOWS THE ROUTE, off `content/courses.json`, in one place.
   *
   * Pass the unit the finding is in; the collector decides whether a learner
   * can meet it. Promoting a unit into `route.units` turns every one of these
   * fatal on the next build with no edit to any gate.
   *
   * @param {string} unitId
   * @param {string} text
   */
  forUnit(unitId, text, meta = {}) {
    if (!this.onRoute) {
      throw new Error(`${this.gate}: forUnit() needs the route predicate — findings(gate, { onRoute }) from tools/_courses.mjs routeUnits()`);
    }
    return this.add(this.onRoute(unitId) ? 'route' : 'preview', text, { unit: unitId, ...meta });
  }

  /** Findings of one scope, in the order they were declared. */
  of(where) { return this.items.filter((f) => f.where === where); }

  /**
   * Print the ledger and the machine line. Idempotent — the exit guard calls it
   * if the gate forgot to.
   *
   * @returns {0|1} the code this ledger requires
   */
  report({ limit = 40, machine = this.armedFlag } = {}) {
    if (this.reported) return this.code();
    this.reported = true;
    const c = this.counts();
    const total = c.route + c.preview + c.engine;
    const say = this.out;
    if (!total) {
      say(`\nFINDINGS · ${this.gate} — none`);
    } else {
      say(`\nFINDINGS · ${this.gate} — ${total} (${c.route} route, ${c.engine} engine, ${c.preview} preview)`);
      const block = (where, head) => {
        const list = this.of(where);
        if (!list.length) return;
        say(`  ${head} (${list.length})`);
        for (const f of list.slice(0, limit)) say(`    · ${f.text}`);
        if (list.length > limit) say(`    … ${list.length - limit} more of the same scope, in the gate's own output above`);
      };
      block('route', 'ROUTE — a learner meets this today');
      block('engine', 'ENGINE — not unit-scoped: red everywhere');
      block('preview', 'PREVIEW — on disk, in front of nobody. Advisory; promoting the unit makes it fatal');
    }
    /* The two markers tools/check-all.mjs already reads, so the summary line
       can sort a red gate by whether anybody is standing in the defect. */
    if (c.route) say(`ROUTE: ${c.route} finding(s) a learner meets today — ${this.gate}`);
    else if (c.preview && !c.engine) say(`PREVIEW-ONLY: ${c.preview} advisory finding(s), none of them on the route — ${this.gate}`);
    /* THE MACHINE LINE IS PRINTED BY THE ARMED LEDGER ONLY. A self-test that
       builds a sandbox to prove the rule would otherwise print a second
       `GATE-FINDINGS` line into the same output, and tools/check-all.mjs reads
       the tail of a gate's output to decide what the gate found: a planted
       ledger from a self-test leaking into that tail is a gate reporting a
       finding it did not make. */
    if (machine) say(`${LEDGER_MARK} gate=${this.gate} route=${c.route} preview=${c.preview} engine=${c.engine} exit=${this.code()}`);
    return this.code();
  }

  /** Print the ledger and end the process with the code the ledger requires. */
  done(opts) {
    const code = this.report(opts);
    process.exit(code);
  }
}

/**
 * THE ARMED LEDGER for this process. Call it once, near the top of a gate.
 *
 * @param {string} gate  the npm script name
 * @param {{scope?:string, onRoute?:(id:string)=>boolean}} [opts]
 * @returns {Ledger}
 */
export function findings(gate, opts = {}) {
  if (ARMED) return ARMED;
  ARMED = new Ledger(gate, { ...opts, armed: true });
  return ARMED;
}

/** The armed ledger, if a gate has made one. */
export function current() { return ARMED; }

/**
 * AN INERT LEDGER, for a self-test that needs to build one and read its verdict
 * without the exit guard binding the test process.
 */
export function sandbox(gate, opts = {}) {
  return new Ledger(gate, { ...opts, armed: false });
}

/** Only for this file's own self-test: forget the armed ledger. */
export function _resetForTest() { ARMED = null; }

// ---------------------------------------------------------------------------
// --self-test — plant the exact fault this module exists to catch, in both
// directions, and prove the lock cannot be talked out of.
//
// The interesting half is the CHILD PROCESSES: the guard is an exit-handler
// rewrite, so the only honest way to prove it is to run a real node process
// that declares a route finding and then does its level best to exit 0.
// ---------------------------------------------------------------------------
async function selfTest() {
  const { spawnSync } = await import('node:child_process');
  const { mkdtempSync, writeFileSync } = await import('node:fs');
  const { tmpdir } = await import('node:os');
  const pathMod = await import('node:path');
  const { fileURLToPath } = await import('node:url');
  const HERE = fileURLToPath(import.meta.url);

  let bad = 0;
  const ok = (m) => console.log(`  ok   ${m}`);
  const flag = (m) => { console.error(` FAIL ${m}`); bad++; };

  console.log('the findings collector — the exit code is not the gate author\'s to write\n');

  // ---- the pure verdict
  console.log('the verdict, on counts alone');
  const V = [
    [{ route: 0, preview: 0, engine: 0 }, 0, 'nothing found'],
    [{ route: 1, preview: 0, engine: 0 }, 1, 'ONE ROUTE FINDING — a learner meets it today'],
    [{ route: 0, preview: 9, engine: 0 }, 0, 'nine preview findings and nothing on the route — advisory, by the same rule check:scenes uses'],
    [{ route: 0, preview: 0, engine: 1 }, 1, 'an engine finding is red everywhere'],
    [{ route: 2, preview: 7, engine: 0 }, 1, 'THE choiceshape SHAPE: two route findings printed beside seven preview ones'],
  ];
  for (const [c, want, why] of V) {
    const got = verdict(c);
    if (got !== want) flag(`${why}: verdict said ${got}, wanted ${want}`);
    else ok(`${why} -> exit ${want}`);
  }

  // ---- the ledger's own accounting
  console.log('\nthe ledger');
  const s = sandbox('check:example');
  s.route('a form hands a cadet 62.2% against 25.0% over 412 sets');
  s.preview('the same thing in a unit nobody is sent to');
  if (s.code() !== 1) flag('a sandbox holding one route finding did not require exit 1');
  else ok('one route finding beside one preview finding requires exit 1');
  const lines = [];
  sandbox('check:example', { out: (l) => lines.push(l) }).route('x').report({ machine: true });
  const led = parseLedger(lines.join('\n'));
  if (!led || led.route !== 1 || led.exit !== 1) flag(`the printed ledger did not parse back: ${JSON.stringify(led)}`);
  else ok('the ledger prints a machine line that parses back to the same numbers');
  const twoStage = `${LEDGER_MARK} gate=check:x route=0 preview=0 engine=0 exit=0\n…the real run…\n${LEDGER_MARK} gate=check:x route=3 preview=0 engine=0 exit=1`;
  const lastLed = parseLedger(twoStage);
  if (!lastLed || lastLed.route !== 3) flag('TWO LEDGERS IN ONE OUTPUT: the first one was read, so a clean self-test would stand in front of the real run\'s route findings');
  else ok('a gate that prints two ledgers — a self-test stage and the run — is judged by the LAST one');
  if (!lines.join('\n').includes('ROUTE:')) flag('a route finding printed no ROUTE: marker for check-all\'s whereIsIt()');
  else ok('a route finding prints the ROUTE: marker the build summary sorts by');
  const empt = sandbox('check:example');
  empt.route(['', null, 'a real one']);
  if (empt.counts().route !== 3) flag('AN EMPTY FINDING WAS DROPPED — the one thing this file may never do');
  else ok('an empty or null finding is recorded with a sentence saying so, never dropped');

  const quietLines = [];
  sandbox('check:example', { out: (l) => quietLines.push(l) }).route('x').report();
  if (quietLines.join('\n').includes(LEDGER_MARK)) flag('A SANDBOX PRINTED THE MACHINE LINE — a self-test\'s planted ledger would leak into the tail the build reads');
  else ok('a sandbox ledger prints its findings and NOT the machine line, so a self-test cannot report a finding the gate did not make');
  const pv = [];
  sandbox('check:example', { out: (l) => pv.push(l) }).preview('only in a preview unit').report({ machine: true });
  if (!pv.join('\n').includes('PREVIEW-ONLY:')) flag('a preview-only ledger printed no PREVIEW-ONLY: marker');
  else ok('a preview-only ledger prints PREVIEW-ONLY: and requires exit 0');
  if (!pv.join('\n').includes('only in a preview unit')) flag('the advisory finding itself was not printed — that is silence, not advice');
  else ok('…and prints the advisory finding in full, which is the difference between advisory and silent');

  // ---- severity follows the route, not the author
  console.log('\nseverity follows content/courses.json');
  const onRoute = (id) => id === 'algebra1-l1' || id === 'algebra1-l2';
  const r = sandbox('check:example', { onRoute });
  r.forUnit('algebra1-l1', 'a repeat on the road');
  r.forUnit('algebra1-l4', 'the same repeat in preview');
  if (r.counts().route !== 1 || r.counts().preview !== 1) flag(`forUnit() split the wrong way: ${JSON.stringify(r.counts())}`);
  else ok('forUnit() puts a route unit on the route and a preview unit in preview, off the manifest');
  const promoted = sandbox('check:example', { onRoute: () => true });
  promoted.forUnit('algebra1-l4', 'the same repeat in preview');
  if (promoted.code() !== 1) flag('promoting the unit did not make the identical finding fatal');
  else ok('PROMOTING THE UNIT makes the identical finding fatal, with no edit to any gate');

  // ---- the runner's outside lock
  console.log('\nthe runner\'s rule, from outside the process');
  const J = [
    [{ route: 2, preview: 7, engine: 0, exit: 1 }, 0, 1, 'A GATE THAT PRINTS TWO ROUTE FINDINGS AND EXITS 0 is recorded RED by the runner'],
    [{ route: 0, preview: 7, engine: 0, exit: 0 }, 0, 0, 'a gate with only preview findings that exits 0 is left alone'],
    [{ route: 0, preview: 0, engine: 0, exit: 0 }, 1, 1, 'a clean ledger does not rescue a gate that crashed'],
    [{ route: 3, preview: 0, engine: 0, exit: 1 }, 1, 1, 'an honest red stays red'],
  ];
  for (const [ledger, child, want, why] of J) {
    const got = judgeRun(ledger, child);
    if (got.code !== want) flag(`${why}: judgeRun gave ${got.code}, wanted ${want}`);
    else ok(why);
  }
  if (judgeRun(null, 0).code !== 0) flag('a gate that printed no ledger at all was judged by a ledger it does not have');
  else ok('a gate that printed no ledger is judged by its own exit code, and named as unchecked by the build');
  if (!judgeRun({ route: 1, preview: 0, engine: 0, exit: 1 }, 0).overridden) flag('the override said nothing about why');
  else ok('the override carries the sentence that says why, so the build\'s summary can print it');

  // ---- THE LOCK, in real child processes
  console.log('\nthe lock, in a real process that tries to get away with it');
  const dir = mkdtempSync(pathMod.join(tmpdir(), 'findings-'));
  const child = (body) => {
    const f = pathMod.join(dir, `t${Math.random().toString(36).slice(2)}.mjs`);
    writeFileSync(f, `import { findings } from ${JSON.stringify(HERE)};\n${body}\n`);
    const res = spawnSync(process.execPath, [f], { encoding: 'utf8' });
    return { code: res.status, out: `${res.stdout}${res.stderr}` };
  };

  const cases = [
    ['a gate that declares a route finding and calls process.exit(0)',
      "const F = findings('check:planted');\nF.route('a form hands the answer away');\nconsole.log('PASS — nothing to see here');\nprocess.exit(0);", 1],
    ['a gate that declares a route finding and just falls off the end of the file',
      "const F = findings('check:planted');\nF.route('a form hands the answer away');\nconsole.log('PASS');", 1],
    ['a gate that declares a route finding, reports it, and then re-exits 0 on purpose',
      "const F = findings('check:planted');\nF.route('x');\nF.report();\nprocess.exit(0);", 1],
    ['a gate that sets process.exitCode = 0 after declaring',
      "const F = findings('check:planted');\nF.route('x');\nprocess.exitCode = 0;", 1],
    ['AN ENGINE FINDING — red everywhere, same lock',
      "const F = findings('check:planted');\nF.engine('the bundle does not build');\nprocess.exit(0);", 1],
    ['a gate holding only PREVIEW findings still exits 0 — the lock is not a blanket',
      "const F = findings('check:planted');\nF.preview('a preview unit repeats a situation');\nF.done();", 0],
    ['A CLEAN GATE IS NOT TOUCHED — this is the half that keeps the gate switched on',
      "const F = findings('check:planted');\nF.done();", 0],
    ['a clean gate that exits 0 by itself is not touched either',
      "findings('check:planted');\nconsole.log('clean');\nprocess.exit(0);", 0],
  ];
  for (const [why, body, want] of cases) {
    const { code, out } = child(body);
    if (code !== want) flag(`${why}: exited ${code}, wanted ${want}\n${out}`);
    else ok(`${why} -> exit ${code}`);
    if (want === 1 && !out.includes('REFUSED TO EXIT 0')) flag(`${why}: refused silently — nobody reading the log would know why`);
  }
  const forgot = child("const F = findings('check:planted');\nF.route('a form hands the answer away');\nprocess.exit(0);");
  if (!forgot.out.includes(LEDGER_MARK)) flag('a gate that never called report() lost its ledger — the finding would be invisible to the build');
  else ok('a gate that forgets to report still prints its ledger, so the runner can read it');

  console.log('');
  if (bad) { console.error(`self-test: ${bad} failure(s)`); process.exit(1); }
  console.log('self-test: ok — a route finding cannot leave this process with a zero exit code, and a clean gate is untouched\n');
  process.exit(0);
}

if (process.argv[1] && process.argv.includes('--self-test')) {
  const { realpathSync } = await import('node:fs');
  const { fileURLToPath: f2 } = await import('node:url');
  if (realpathSync(f2(import.meta.url)) === realpathSync(process.argv[1])) await selfTest();
}
