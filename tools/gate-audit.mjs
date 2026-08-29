#!/usr/bin/env node
/**
 * THE GATE AUDIT — every `check:` script, and the four questions that decide
 * whether it is a gate at all.
 *
 *   node tools/gate-audit.mjs            # the table, self-tests actually run
 *   node tools/gate-audit.mjs --no-run   # the table, from the source alone
 *   node tools/gate-audit.mjs --md       # the same table as markdown, for RESUME.md
 *
 * WHY THIS FILE EXISTS
 *
 * Three times now, a gate in this repo turned out not to be one, and each time
 * the answer was written by hand in a document that then went stale:
 *
 *   · `check:courses` was never wired into the build and failed on every run
 *     for as long as it had existed, while the build printed green.
 *   · `check:standards` was in neither the build list nor the list of
 *     deliberate omissions. Nobody had left it out; nobody had put it in.
 *   · `check:mastery` was in the omissions list with the reason written down as
 *     *"It currently fails on Levels 2 and 4"* — a gate excluded because it
 *     fails, which is not a decision, it is the defect.
 *
 * And a fourth shape, which is the one a table catches and a sentence does not:
 * `SKILLS` in `src/learn/generators.js` is a LIVE VIEW over the content
 * registry, so a tool that sweeps it without loading the manifest's packs sees
 * TEN skills of sixty-two and prints PASS in exactly the same words. Three
 * gates shipped that way.
 *
 * So the four questions are asked of every script the package file defines, by
 * a program, from the source of record:
 *
 *   1. IS IT IN THE BUILD?      `tools/check-all.mjs` GATES / NOT_IN_BUILD.
 *   2. WHAT DOES IT COVER?      `tools/check-coverage.mjs` walks each gate's
 *      real module graph and answers whether it loads all 62 skills the
 *      manifest names or only the 10 in the core bank.
 *   3. WHERE WOULD ITS RED BE?  route / sweep / engine, off the GATES table —
 *      `content/courses.json` ships two of five units.
 *   4. HAS IT EVER REFUSED ANYTHING? Not "does it claim to": this RUNS every
 *      `--self-test` and records the exit code. A gate whose self-test is
 *      broken is a gate nobody has watched refuse anything, today, on this
 *      tree.
 */
import { spawn } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { GATES, NOT_IN_BUILD, SELF_TEST_INLINE, NO_SELF_TEST } from './check-all.mjs';
import { rowsForPackage, EXCEPTIONS } from './check-coverage.mjs';
import { usesCollector } from './check-all.mjs';
import { routeUnits } from './_courses.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
const argv = process.argv.slice(2);
const NO_RUN = argv.includes('--no-run');
const MD = argv.includes('--md');
/* THE CHEAPEST THING ANYBODY COULD DO TO KEEP THIS TABLE TRUE, and it was
   written down as a wish for a wave before it was a flag. Three gates FUSE
   their plant into the whole browser run rather than putting it behind `&&`
   — check:traverse (minutes), check:density (about thirty) and check:touch
   (about forty) — so "run the self-tests" meant eighty minutes and the table
   went stale instead. `--no-fused` runs every self-test that is a stage of its
   own and says, in the row itself, that the other three were not run here.
   A table nobody can afford to regenerate is a table somebody types. */
const NO_FUSED = argv.includes('--no-fused');

const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
const scripts = Object.entries(pkg.scripts).filter(([k]) => k.startsWith('check:') && k !== 'check');

const inGates = new Map(GATES.map(([n, why, scope]) => [n, { why, scope: scope || 'sweep' }]));
const inOmit = new Map(NOT_IN_BUILD);
const inline = new Map(SELF_TEST_INLINE);
const never = new Map(NO_SELF_TEST);
const coverage = new Map();
try { for (const r of rowsForPackage()) coverage.set(r.script, r); } catch (e) { /* reported below */ }
const covExcused = new Map(EXCEPTIONS);

/**
 * Run one gate's own `--self-test` and report what it did.
 *
 * TWO SHAPES, AND THEY MUST NOT BE CONFUSED. Most gates are written
 * `node x.mjs --self-test && node x.mjs`, so the half that plants the defect
 * can be run on its own and a non-zero exit means the PLANT WAS NOT CAUGHT.
 * A few fuse the flag into one invocation — `check:traverse` is
 * `rungate.sh traverse.mjs --out … --self-test`, which stands up a server,
 * sweeps the real world AND plants its defects in one process. There, a
 * non-zero exit says the gate is red and says nothing about whether the plant
 * was caught, and reporting it as "its self-test is red" would be the same
 * class of error this whole audit exists to find: an instrument that measures
 * one thing and prints the name of another.
 */
const selfTestOf = (name, cmd) => new Promise((resolve) => {
  if (!cmd.includes('--self-test')) return resolve(null);
  const parts = cmd.split('&&').map((x) => x.trim());
  /* FUSED means "running the self-test means running the whole browser gate":
     one stage, and that stage is a shell wrapper that builds the tree and
     stands a server up. A single-stage NODE command that is only a self-test —
     check:route, check:compose:rule, check:motion:rule — costs under a second
     and is always run. */
  if (NO_FUSED && parts.length === 1 && /\.sh(\s|$)/.test(parts[0])) return resolve({ fused: true });
  const isolated = parts.length > 1 && parts.some((x) => x.includes('--self-test') && !parts.every((y) => y.includes('--self-test')));
  const first = parts.find((x) => x.includes('--self-test'));
  const t0 = Date.now();
  const child = spawn('sh', ['-c', first], { cwd: ROOT, stdio: 'ignore', env: process.env });
  const done = (code) => resolve({ code, secs: (Date.now() - t0) / 1000, cmd: first, isolated });
  child.on('exit', (c, sig) => done(sig ? 1 : (c ?? 1)));
  child.on('error', () => done(127));
});

const rows = [];
for (const [name, cmd] of scripts) {
  const g = inGates.get(name);
  const cov = coverage.get(name);
  rows.push({
    name,
    cmd,
    build: g ? 'in the build' : (inOmit.has(name) ? 'out, with a reason' : 'UNACCOUNTED FOR'),
    why: g ? g.why : (inOmit.get(name) || ''),
    scope: g ? g.scope : '—',
    covers: cov ? cov.verdict : 'unknown',
    coverNote: cov ? cov.note || '' : '',
    covExcused: covExcused.has(name),
    /* UNDECLARED is only a defect for a gate that is IN the build: the two
       declaration lists in tools/check-all.mjs exist to account for gates the
       build runs. A gate outside the build with no planted fault is simply
       something nobody has proved yet, and its NOT_IN_BUILD line is where its
       reason lives. */
    proves: cmd.includes('--self-test') ? 'flag'
      : (inline.has(name) ? 'inline'
        : (never.has(name) ? 'never' : (inGates.has(name) ? 'UNDECLARED' : 'none, and out of the build'))),
    provesWhy: inline.get(name) || never.get(name) || '',
    /* THE FIFTH QUESTION, added this wave: WHO DECIDES WHAT ITS FINDINGS ARE
       WORTH. A gate that owns its own exit code can print a route defect and
       return success, which is exactly what check:shape did with per-form
       answer leaks at 62.2% on the shipped route. A gate whose verdict goes
       through tools/_findings.mjs cannot: the collector owns the exit code and
       prints one machine line that tools/check-all.mjs re-judges from outside
       the process. Read off the real module graph, not off a list. */
    ledger: usesCollector(name, Object.fromEntries(scripts)),
    st: null,
  });
}

if (!NO_RUN) {
  const fused = rows.filter((r) => r.proves === 'flag' && !r.cmd.includes('&&'));
  process.stderr.write(`running ${rows.filter((r) => r.proves === 'flag').length} self-test(s)…`);
  if (fused.length) {
    process.stderr.write(` (${fused.map((r) => r.name).join(', ')} fuse their plant into the whole gate, `
      + 'so those run the whole sweep — minutes each)');
  }
  process.stderr.write('\n');
  for (const r of rows) r.st = await selfTestOf(r.name, r.cmd);
}

const { road, off } = await routeUnits();
const REFUSED = {
  ok: 'proved just now',
  fail: 'ITS OWN SELF-TEST IS RED',
};

const verdictOf = (r) => {
  if (r.proves === 'flag') {
    if (r.st && r.st.fused) return 'declared; its plant is fused into the whole browser run, so not run here';
    if (!r.st) return 'declared, not run here';
    if (r.st.code === 0) return `${REFUSED.ok} (${r.st.secs.toFixed(1)}s)`;
    return r.st.isolated ? `${REFUSED.fail} (exit ${r.st.code})`
      : `the gate exited ${r.st.code} with its plant fused in — unknown`;
  }
  if (r.proves === 'inline') return 'every run, no flag';
  if (r.proves === 'never') return 'NEVER — nothing planted';
  if (r.proves === 'UNDECLARED') return 'UNDECLARED';
  return 'never — and out of the build';
};

const covOf = (r) => {
  if (r.covers === 'all-units') return `all ${62} skills`;
  if (r.covers === 'single-unit') return r.covExcused ? '10 skills (excused)' : '10 SKILLS ONLY';
  if (r.covers === 'no-content' || r.covers === 'no-items') return 'reads no items';
  return r.covers;
};

if (MD) {
  console.log(`| gate | in \`npm run check\` | where its red is | item coverage | has it ever refused anything | who decides what its findings are worth |`);
  console.log('|---|---|---|---|---|---|');
  for (const r of rows.sort((a, b) => (inGates.has(b.name) - inGates.has(a.name)) || a.name.localeCompare(b.name))) {
    console.log(`| \`${r.name}\` | ${r.build === 'in the build' ? '**yes**' : (r.build === 'UNACCOUNTED FOR' ? '**UNACCOUNTED FOR**' : 'no, with a reason')} `
      + `| ${r.scope} | ${covOf(r)} | ${verdictOf(r)} | ${r.ledger ? 'the findings ledger' : '**ITSELF — unchecked**'} |`);
  }
  process.exit(0);
}

console.log('THE GATE AUDIT\n');
console.log(`route (content/courses.json): ${road.map((u) => u.id).join(' -> ')}`);
console.log(`off the route:                ${off.map((u) => `${u.id} (${u.status})`).join(', ')}`);
console.log(`scripts:                      ${rows.length}   in the build: ${rows.filter((r) => inGates.has(r.name)).length}\n`);

const head = `${'gate'.padEnd(22)} ${'build'.padEnd(19)} ${'red where'.padEnd(10)} ${'covers'.padEnd(20)} ${'ledger'.padEnd(8)} has it ever refused anything`;
console.log(head);
console.log('-'.repeat(head.length + 22));
const order = (r) => (inGates.has(r.name) ? 0 : 1);
for (const r of rows.sort((a, b) => order(a) - order(b) || a.name.localeCompare(b.name))) {
  const flagBad = r.build === 'UNACCOUNTED FOR' || r.proves === 'UNDECLARED'
    || (r.st && !r.st.fused && r.st.code !== 0) || (r.covers === 'single-unit' && !r.covExcused && inGates.has(r.name));
  /* eslint-disable-next-line no-unused-expressions */
  const paint = (s) => (flagBad ? `\x1b[31m${s}\x1b[0m` : s);
  console.log(paint(`${r.name.padEnd(22)} ${r.build.padEnd(19)} ${r.scope.padEnd(10)} ${covOf(r).padEnd(20)} ${(r.ledger ? 'ledger' : 'ITSELF').padEnd(8)} ${verdictOf(r)}`));
}

// ---------------------------------------------------------------------------
const unaccounted = rows.filter((r) => r.build === 'UNACCOUNTED FOR');
const undeclared = rows.filter((r) => r.proves === 'UNDECLARED');
const neverProved = rows.filter((r) => r.proves === 'never');
const redSelfTests = rows.filter((r) => r.st && !r.st.fused && r.st.code !== 0);
const narrow = rows.filter((r) => r.covers === 'single-unit' && !r.covExcused);

const ownExit = rows.filter((r) => !r.ledger && inGates.has(r.name));

console.log('\nWHAT THE TABLE SAYS');
console.log(`  ${rows.filter((r) => r.ledger).length} of ${rows.length} script(s) hand their verdict to tools/_findings.mjs, so the RUNNER `
  + `and not the gate decides what a route finding is worth; ${ownExit.length} gate(s) in the build still own their own exit code`
  + `${ownExit.length ? `: ${ownExit.map((r) => r.name).join(', ')}` : ''}.`);
console.log(`  ${rows.filter((r) => inGates.has(r.name)).length} gate(s) in the build; `
  + `${rows.filter((r) => inOmit.has(r.name)).length} out of it with a written reason; ${unaccounted.length} unaccounted for.`);
console.log(`  ${rows.filter((r) => r.proves === 'flag').length} run --self-test; ${rows.filter((r) => r.proves === 'inline').length} prove themselves inline; `
  + `${neverProved.length} have NEVER been watched refuse anything${neverProved.length ? ': ' + neverProved.map((r) => r.name).join(', ') : ''}.`);
console.log(`  ${rows.filter((r) => r.covers === 'all-units').length} read all 62 skills the manifest names; `
  + `${rows.filter((r) => r.covers === 'single-unit').length} read only the 10 in the core bank `
  + `(${rows.filter((r) => r.covers === 'single-unit' && r.covExcused).length} of those with a declared reason).`);
const gatesInBuild = rows.filter((r) => inGates.has(r.name));
console.log(`  of the ${gatesInBuild.length} in the build: ${gatesInBuild.filter((r) => r.scope === 'route').length} would be red ON THE SHIPPED ROUTE, `
  + `${gatesInBuild.filter((r) => r.scope === 'sweep').length} sweep every unit, ${gatesInBuild.filter((r) => r.scope === 'engine').length} are not unit-scoped.`);

let bad = 0;
for (const r of unaccounted) { console.log(`\n  UNACCOUNTED FOR: ${r.name} is defined and is in neither list.`); bad++; }
for (const r of undeclared) { console.log(`\n  UNDECLARED: ${r.name} is in the build and nothing says whether it proves itself.`); bad++; }
for (const r of redSelfTests) {
  if (r.st.isolated) {
    console.log(`\n  ITS OWN SELF-TEST IS RED: ${r.name} — \`${r.st.cmd}\` exited ${r.st.code}, and that half only plants defects `
      + 'and checks they are caught. Nobody has watched this gate refuse anything today.');
  } else {
    console.log(`\n  RED, AND ITS PLANT IS FUSED INTO THE SAME PROCESS: ${r.name} — \`${r.st.cmd}\` exited ${r.st.code}. `
      + 'That one run does the sweep AND the planting, so this cannot say which half went red. Read its output; '
      + 'splitting the command at `&&` would make the answer readable here.');
  }
  bad++;
}
for (const r of narrow) { console.log(`\n  TEN SKILLS OF SIXTY-TWO: ${r.name} sweeps SKILLS without loading the manifest's packs, and says "clean" in the same words either way.`); bad++; }
console.log('');
process.exit(bad ? 1 : 0);
