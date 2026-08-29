#!/usr/bin/env node
/**
 * THE COVERAGE GATE — a gate over the gates.
 *
 *   npm run check:coverage
 *   node tools/check-coverage.mjs --self-test
 *   node tools/check-coverage.mjs --list        # the module set behind each gate
 *
 * WHY THIS FILE EXISTS
 *
 * `SKILLS` in `src/learn/generators.js` is a LIVE VIEW over the content
 * registry, not a constant. Cold, it holds the core bank. It only holds the
 * course once somebody has loaded the packs the manifest names:
 *
 *     import { SKILLS } from '../src/learn/generators.js';   // 10 skills
 *     for (const { unit } of await allUnits()) await loadUnit(unit);
 *     SKILLS                                                 // 62 skills
 *
 * So a tool can sweep `SKILLS`, find nothing wrong, and print PASS — having
 * measured ten skills of sixty-two, in exactly the same words it would have
 * used for all of them. There is no error, no warning and no smaller number in
 * the output. `check:lang`, `check:scenes` and the choice-set lab all shipped
 * that way; the lab's hand-written pack list stopped at Level 2 and covered 24
 * of 62 skills while printing PASS. The gate that covered the whole course,
 * `validate-courses`, was meanwhile not in the build at all.
 *
 * A one-off audit fixes that for one afternoon. This gate fixes it for good:
 * for every `check:*` script in the package file it walks the module graph the
 * script actually runs, and asks one question —
 *
 *     THIS TOOL READS THE GENERATOR SURFACE. DOES ANYTHING IN IT LOAD THE
 *     PACKS THE MANIFEST NAMES?
 *
 * — where "loads the packs" means the node-side `allUnits()` + `loadUnit()`
 * pair, or the browser-side `content/courses.json` + `registerPack()` pair that
 * the labs use inside a vite build. Anything else is a tool that sees the core
 * bank and calls it the product.
 *
 * A DECLARED EXCEPTION IS FINE; AN UNDECLARED ONE IS THE DEFECT. `EXCEPTIONS`
 * below carries a reason per entry and the self-test proves a stale or
 * unexplained exception fails the build, exactly as `NOT_IN_BUILD` does in
 * tools/check-all.mjs.
 *
 * AND IT CHECKS ITS OWN PREMISE. The rule is only worth anything while loading
 * the manifest's packs really does change what a tool can see, so the run
 * measures that: `SKILLS` cold, and `SKILLS` after the manifest. If those two
 * numbers are ever equal the gate says its own premise has gone and fails,
 * rather than passing on a rule that has quietly stopped meaning anything.
 */
import { readFileSync, readdirSync, existsSync, statSync, realpathSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { findings } from './_findings.mjs';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');

/**
 * Gates that read the generator surface and deliberately do not load the whole
 * manifest. Each one needs a reason, and the reason has to name what covers the
 * rest — otherwise it is not an exception, it is the defect with a note on it.
 */
export const EXCEPTIONS = [
  ['check:items', 'tools/validate-items.mjs is the LEVEL 1 bank gate by declaration — it re-derives the shipped ten-node unit against content/graph/algebra1-l1.json and writes that unit\'s standards document. Every other unit is covered by check:courses, which runs tools/validate-courses.mjs over every unit in the manifest.'],
  ['check:wipe', "tools/critic/wipegate.mjs reports on the SAVE FILE, not on the bank. It touches the generator surface for one thing only: naming a real form id so the record it plants is one the shipping MasteryEngine would actually write. Its verdict — what is left in localStorage after START OVER — is a property of src/meta/wipe.js and cannot vary with how many skills are registered, and its own static rule already sweeps every storage key in ALL of src/, not just the boot unit's. It plants the record for the unit a player gets with no query string, which is the state the pause menu is pressed in. Bank coverage is check:courses' job."],
  ['check:withdrawn', "tools/critic/withdrawgate.mjs plants ONE hollow claim in ONE line of the boot lattice and asks whether the learner is told it was taken back. The generator surface is read for the same single reason as check:wipe — a real form id, so the hole is a hole in a shape that exists — and the verdict is a sentence on screen in three locales, which is the same sentence whichever unit the line came from. Every unit's bank is covered by check:courses; that a withdrawal is SAID is covered here and nowhere else."],
];

// ---------------------------------------------------------------------------
// THE RULES, as pure functions over file text, so the self-test can plant each
// defect as a synthetic module set and watch the verdict change.
// ---------------------------------------------------------------------------

/** Does this file read the generator surface — the thing that is empty until packs load? */
export function readsGenerators(text) {
  if (/from\s*['"][^'"]*src\/learn\/generators\.js['"]/.test(text)) return true;
  if (/import\(\s*['"][^'"]*src\/learn\/generators\.js['"]/.test(text)) return true;
  // The registry is the same surface under another name — but importing ONLY
  // `registerPack` from it is how a tool LOADS packs, not how it reads them.
  for (const m of text.matchAll(/import\s*\{([^}]*)\}\s*from\s*['"][^'"]*src\/content\/registry\.js['"]/g)) {
    const named = m[1].split(',').map((s) => s.trim().split(/\s+as\s+/)[0]).filter(Boolean);
    if (named.some((n) => n !== 'registerPack')) return true;
  }
  if (/import\(\s*['"][^'"]*src\/content\/registry\.js['"]/.test(text)) return true;
  return false;
}

/**
 * Does this file load the packs the manifest names — either way round?
 *
 * THE DEFINER IS NOT A CONSUMER. `tools/_courses.mjs` contains the words
 * `allUnits`, `loadUnit`, `registerPack` and `content/courses.json` because it
 * is the loader. Counting its own text as "this gate loads the manifest" would
 * certify every tool that imports it for any reason at all — which is how
 * `tools/validate-items.mjs`, a Level-1 gate that re-derives ten skills, first
 * came out of this rule looking like it covered sixty-two.
 */
export function loadsManifestPacks(text) {
  if (/export\s+(?:async\s+)?function\s+(?:allUnits|loadUnit|loadCourse)\b/.test(text)) return false;
  // node side: the tools/_courses.mjs pair, CALLED.
  if (/\ballUnits\s*\(/.test(text) && /\bloadUnit\s*\(/.test(text)) return true;
  if (/\bloadCourse\s*\(/.test(text)) return true;
  // browser side: the labs read the manifest and register what it names.
  if (/content\/courses\.json/.test(text) && /\bregisterPack\s*\(/.test(text)) return true;
  return false;
}

// ---------------------------------------------------------------------------
// Which files does a gate actually run?
// ---------------------------------------------------------------------------

/** The .mjs/.js/.sh entry points named by one npm script command line. */
export function entriesOf(cmd) {
  const out = [];
  for (const part of cmd.split(/&&|\|\||;/)) {
    for (const tok of part.trim().split(/\s+/)) {
      if (/\.(mjs|js|sh)$/.test(tok) && !tok.startsWith('-')) out.push(tok);
    }
  }
  return [...new Set(out)];
}

const LOCAL = /(?:from|import\()\s*['"](\.[^'"]+)['"]/g;
const HERE_DIR = /path\.join\(\s*(?:HERE|__dirname)\s*,\s*['"]([^'".\/][^'"]*)['"]\s*\)/g;
const STRING_LIT = /['"]([^'"\n]+)['"]/g;

function walkDir(dir, out) {
  for (const name of readdirSync(dir)) {
    const p = path.join(dir, name);
    if (statSync(p).isDirectory()) walkDir(p, out);
    else if (/\.(mjs|js)$/.test(name)) out.add(p);
  }
}

/**
 * Every file under tools/ that one entry point pulls in — static imports,
 * dynamic imports, and the lab directories a critic names as a string and hands
 * to a vite build (`const LAB = path.join(HERE, 'choicelab')`). Those labs are
 * the whole point: the choice-set audit's coverage lives in `choicelab/lab.js`,
 * not in the critic that starts it.
 */
export function moduleSetOf(entry, root = ROOT, read = (p) => readFileSync(p, 'utf8')) {
  const seen = new Set();
  const stack = [path.resolve(root, entry)];
  while (stack.length) {
    const file = stack.pop();
    if (seen.has(file) || !existsSync(file)) continue;
    seen.add(file);
    let text;
    try { text = read(file); } catch { continue; }
    if (file.endsWith('.sh')) {                       // a shell wrapper names the real tool
      for (const m of text.matchAll(/\b(?:node|npx)\s+(\S+\.(?:mjs|js))/g)) stack.push(path.resolve(root, m[1]));
      continue;
    }
    const dir = path.dirname(file);
    for (const m of text.matchAll(LOCAL)) {
      const p = path.resolve(dir, m[1]);
      if (p.startsWith(path.join(root, 'tools'))) stack.push(p);
    }
    /* A gate may START another tool rather than import it — `spawn('node',
       ['tools/simulate.mjs', …])` is how check:mastery runs the simulator once
       per unit. A walk that only follows `import` would call that gate
       "reads no items" and pass it for entirely the wrong reason. So every
       string literal that names a real file under tools/ is an edge too. */
    for (const m of text.matchAll(STRING_LIT)) {
      const lit = m[1];
      if (!/\.(mjs|js|sh)$/.test(lit)) continue;
      for (const base of [dir, root]) {
        const p = path.resolve(base, lit);
        if (p.startsWith(path.join(root, 'tools')) && existsSync(p) && statSync(p).isFile()) { stack.push(p); break; }
      }
    }
    for (const m of text.matchAll(HERE_DIR)) {
      const d = path.resolve(dir, m[1]);
      if (d.startsWith(path.join(root, 'tools')) && existsSync(d) && statSync(d).isDirectory()) {
        const found = new Set(); walkDir(d, found);
        for (const f of found) stack.push(f);
      }
    }
  }
  return [...seen];
}

/**
 * The verdict for one gate.
 *
 * `foreign` names the entry files of the OTHER gates, and loading found only
 * inside one of those does not count. That distinction is the whole difference
 * between a rule and a rubber stamp: `tools/validate-items.mjs` imports one
 * helper out of `tools/check-figures.mjs`, and check-figures loads the whole
 * manifest — for its own run. Counting that would certify validate-items as
 * covering 62 skills when it re-derives 10, which is precisely the false
 * "PASS in the same words either way" this gate exists to stop.
 *
 * @param {string} script  npm script name
 * @param {{file:string,text:string}[]} files  its module set, already read
 * @param {Set<string>} foreign  entry files belonging to other gates
 * @returns {{script:string, reads:string[], loads:string[], verdict:'all-units'|'single-unit'|'no-content'}}
 */
export function judgeGate(script, files, foreign = new Set()) {
  const mine = files.filter((f) => !foreign.has(f.file));
  const reads = mine.filter((f) => readsGenerators(f.text)).map((f) => f.file);
  const loads = mine.filter((f) => loadsManifestPacks(f.text)).map((f) => f.file);
  const verdict = !reads.length ? 'no-content' : (loads.length ? 'all-units' : 'single-unit');
  return { script, reads, loads, verdict };
}

/**
 * @param {{script:string,verdict:string,reads:string[]}[]} rows
 * @param {[string,string][]} exceptions
 * @returns {string[]} problems
 */
export function judgeAll(rows, exceptions) {
  const problems = [];
  const excused = new Map(exceptions);
  for (const r of rows) {
    if (r.verdict !== 'single-unit') continue;
    if (excused.has(r.script)) continue;
    problems.push(`${r.script} reads the generator surface and NOTHING in it loads the manifest's packs — `
      + `it sees the core bank and reports on it in the same words it would use for the whole course. `
      + `(${r.reads.map((f) => path.relative(ROOT, f)).join(', ')})`);
  }
  for (const [name, why] of exceptions) {
    const row = rows.find((r) => r.script === name);
    if (!row) { problems.push(`EXCEPTIONS names "${name}", which is not a gate any more — a stale excuse`); continue; }
    if (row.verdict !== 'single-unit') problems.push(`EXCEPTIONS excuses "${name}", which does not need excusing (${row.verdict}) — an excuse nobody can check rots into one nobody reads`);
    if (!why || !String(why).trim()) problems.push(`EXCEPTIONS names "${name}" with no reason`);
  }
  return problems;
}

// ---------------------------------------------------------------------------
// The run
// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
const has = (f) => argv.includes(f);

async function premise() {
  const g = await import(path.join(ROOT, 'src/learn/generators.js'));
  const cold = g.SKILLS.length;
  const { allUnits, loadUnit } = await import(path.join(ROOT, 'tools/_courses.mjs'));
  for (const { unit } of await allUnits()) await loadUnit(unit);
  return { cold, whole: g.SKILLS.length };
}

export function rowsForPackage() {
  const pkg = JSON.parse(readFileSync(path.join(ROOT, 'package.json'), 'utf8'));
  const scripts = Object.entries(pkg.scripts).filter(([k]) => k.startsWith('check:'));

  // Every gate's own entry files, so one gate cannot borrow another's coverage.
  const entryOf = new Map(scripts.map(([k, cmd]) => [k, new Set(entriesOf(cmd).map((e) => path.resolve(ROOT, e)))]));

  const rows = [];
  for (const [script, cmd] of scripts) {
    const foreign = new Set();
    for (const [other, set] of entryOf) {
      if (other === script) continue;
      for (const f of set) if (!entryOf.get(script).has(f)) foreign.add(f);
    }
    const files = [];
    for (const e of entriesOf(cmd)) {
      for (const f of moduleSetOf(e)) {
        if (files.some((x) => x.file === f)) continue;
        try { files.push({ file: f, text: readFileSync(f, 'utf8') }); } catch { /* unreadable */ }
      }
    }
    rows.push({ ...judgeGate(script, files, foreign), files: files.length });
  }
  return rows;
}

async function run() {
  const { cold, whole } = await premise();
  console.log(`the premise: SKILLS holds ${cold} skill(s) cold and ${whole} once the manifest's packs are loaded.`);
  if (cold >= whole) {
    console.log('\nFAIL — loading the manifest changes nothing, so this gate is measuring a rule that no longer means anything. '
      + 'Either the packs stopped registering, or the core bank now holds the course. Find out which before trusting any other gate.');
    return 1;
  }

  const rows = rowsForPackage();
  const excused = new Map(EXCEPTIONS);
  const w = Math.max(...rows.map((r) => r.script.length));
  console.log('');
  for (const r of rows.sort((a, b) => a.verdict.localeCompare(b.verdict) || a.script.localeCompare(b.script))) {
    const tag = r.verdict === 'all-units' ? '\x1b[32mall units \x1b[0m'
      : r.verdict === 'single-unit' ? (excused.has(r.script) ? '\x1b[33mby design \x1b[0m' : '\x1b[31mCORE ONLY\x1b[0m')
        : '  —       ';
    console.log(`  ${tag} ${r.script.padEnd(w)}  ${String(r.files).padStart(3)} file(s)${r.verdict === 'no-content' ? '   reads no items' : ''}`);
  }
  if (has('--list')) {
    for (const r of rows) {
      console.log(`\n${r.script}`);
      for (const f of r.reads) console.log(`    reads   ${path.relative(ROOT, f)}`);
      for (const f of r.loads) console.log(`    loads   ${path.relative(ROOT, f)}`);
    }
  }

  const problems = judgeAll(rows, EXCEPTIONS);
  const n = rows.filter((r) => r.verdict === 'all-units').length;
  console.log('');
  if (!problems.length) {
    console.log(`${n} gate(s) read items and every one of them loads all ${whole} skills the manifest names; `
      + `${EXCEPTIONS.length} declared exception(s); ${rows.length - n - EXCEPTIONS.length} gate(s) read no items at all.`);
  }
  /* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs. A gate that reports on
     ten skills of sixty-two is broken for every unit at once, so these are
     ENGINE findings: red everywhere, never advisory. */
  const F = findings('check:coverage', { scope: 'engine' });
  F.engine(problems.map(String));
  return F.report();
}

// ---------------------------------------------------------------------------
// Self-test.
// ---------------------------------------------------------------------------
function selfTest() {
  let bad = 0;
  const fires = (problems, re, why) => {
    if (!problems.some((p) => re.test(p))) { console.error(`SELF-TEST FAIL: not raised on ${why} — ${JSON.stringify(problems)}`); bad++; }
    else console.log(`  fires  ${why}`);
  };
  const quiet = (problems, why) => {
    if (problems.length) { console.error(`SELF-TEST FAIL: false positive on ${why} — ${JSON.stringify(problems)}`); bad++; }
    else console.log(`  quiet  ${why}`);
  };

  const F = (file, text) => ({ file, text });
  const GEN = "import { generate, SKILLS } from '../src/learn/generators.js';";
  const NODE_LOAD = "import { allUnits, loadUnit } from './_courses.mjs';\nfor (const { unit } of await allUnits()) await loadUnit(unit);";
  const LAB_LOAD = "import manifest from '../../../content/courses.json';\nregisterPack(pack);";

  // 1. THE DEFECT THIS GATE EXISTS FOR — the shape check:lang, check:scenes and
  //    the choice-set lab all shipped in: read SKILLS, never load the packs.
  const blind = [judgeGate('check:blind', [F('/t/blind.mjs', GEN)])];
  fires(judgeAll(blind, []), /reads the generator surface and NOTHING in it loads/, 'a tool that reads SKILLS and never loads the manifest');
  if (blind[0].verdict !== 'single-unit') { console.error('SELF-TEST FAIL: the blind tool was not called single-unit'); bad++; }

  // 2. The two honest shapes, which must stay quiet.
  quiet(judgeAll([judgeGate('check:node', [F('/t/a.mjs', GEN + '\n' + NODE_LOAD)])], []), 'a node gate that loads every unit the manifest names');
  quiet(judgeAll([judgeGate('check:split', [F('/t/a.mjs', GEN), F('/t/_courses.mjs', NODE_LOAD)])], []),
    'a gate whose loading lives in a module beside it, not in the entry file');
  quiet(judgeAll([judgeGate('check:lab', [F('/t/critic.mjs', 'const LAB = path.join(HERE, "lab");'), F('/t/lab/lab.js', GEN + '\n' + LAB_LOAD)])], []),
    'a browser lab that reads the manifest and registers what it names');
  quiet(judgeAll([judgeGate('check:layoutish', [F('/t/x.mjs', "import { chromium } from 'playwright';")])], []),
    'a gate that reads no items at all');

  // 2b. AND IT MAY NOT BORROW SOMEBODY ELSE'S COVERAGE. This is the shape
  //     check:items has: it imports one helper out of another gate's entry
  //     file, and that file loads the manifest for its own run.
  const borrowed = [judgeGate('check:borrower',
    [F('/t/mine.mjs', GEN + "\nimport { helper } from './other.mjs';"), F('/t/other.mjs', GEN + '\n' + NODE_LOAD)],
    new Set(['/t/other.mjs']))];
  fires(judgeAll(borrowed, []), /reads the generator surface and NOTHING in it loads/,
    "a gate whose only manifest loading lives inside another gate's entry file");

  // 2c. The loader module itself is not evidence that anybody called it.
  const LOADER = "export async function allUnits() {}\nexport async function loadUnit(unit) { registerPack(mod.default); }\n// content/courses.json";
  const viaLoaderModule = [judgeGate('check:justimports',
    [F('/t/mine.mjs', GEN + "\nimport { allUnits } from './_courses.mjs';"), F('/t/_courses.mjs', LOADER)])];
  fires(judgeAll(viaLoaderModule, []), /reads the generator surface and NOTHING in it loads/,
    'a gate that imports the loader module and never calls it');

  // 3. `registerPack` alone is how a tool LOADS packs, not how it reads them —
  //    tools/_courses.mjs must not be read as a blind consumer of the registry.
  const loaderOnly = judgeGate('check:loader', [F('/t/_courses.mjs', "import { registerPack } from '../src/content/registry.js';")]);
  if (loaderOnly.verdict !== 'no-content') { console.error(`SELF-TEST FAIL: the pack loader itself was judged ${loaderOnly.verdict}`); bad++; }
  else console.log('  quiet  the pack loader itself, which imports only registerPack');
  const registryReader = judgeGate('check:reg', [F('/t/x.mjs', "import { hasSkill, formsFor } from '../src/content/registry.js';")]);
  if (registryReader.verdict !== 'single-unit') { console.error('SELF-TEST FAIL: reading the registry by another name slipped through'); bad++; }
  else console.log('  fires  a tool that reads the registry directly instead of generators.js');

  // 4. The exception list is held to the same bar as NOT_IN_BUILD.
  fires(judgeAll(blind, [['check:gone', 'was fine once']]), /which is not a gate any more/, 'a stale exception');
  fires(judgeAll([judgeGate('check:clean', [F('/t/a.mjs', GEN + '\n' + NODE_LOAD)])], [['check:clean', 'no need']]),
    /does not need excusing/, 'an exception for a gate that is already clean');
  fires(judgeAll(blind, [['check:blind', '  ']]), /with no reason/, 'an exception with no reason');
  quiet(judgeAll(blind, [['check:blind', 'covered in full by check:courses']]), 'a declared exception with a reason');

  // 5. The reader that finds the files. `entriesOf` decides what a gate runs,
  //    so a shell-quoting change that silently drops the second command would
  //    silently drop half a gate's coverage.
  const e = entriesOf('node tools/critic/ladder.mjs --self-test && node tools/validate-courses.mjs');
  if (e.length !== 2 || !e.includes('tools/validate-courses.mjs')) { console.error(`SELF-TEST FAIL: entriesOf lost a command — ${JSON.stringify(e)}`); bad++; }
  else console.log('  ok     entriesOf reads BOTH halves of a "self-test && gate" script');
  const sh = entriesOf('tools/critic/takeover.sh shots/takeover --minutes 15');
  if (!sh.includes('tools/critic/takeover.sh')) { console.error(`SELF-TEST FAIL: entriesOf lost a shell wrapper — ${JSON.stringify(sh)}`); bad++; }
  else console.log('  ok     entriesOf follows a shell wrapper to the tool it starts');

  // 6. The real module walk really reaches the lab, which is the file the
  //    coverage actually lives in. If this ever stops being true the gate would
  //    call check:choices "no-content" and pass it for the wrong reason.
  const set = moduleSetOf('tools/critic/choiceaudit.mjs').map((f) => path.relative(ROOT, f));
  if (!set.includes('tools/critic/choicelab/lab.js')) { console.error(`SELF-TEST FAIL: the walk did not reach choicelab/lab.js — ${JSON.stringify(set)}`); bad++; }
  else console.log('  ok     the module walk reaches tools/critic/choicelab/lab.js from the critic that starts it');

  /* 7. THE REAL FILES, WITH THE REAL DEFECT PUT BACK.
        Everything above is synthetic. This leg takes the module set
        `check:choices` actually has on disk today, and edits the lab's text in
        memory to remove the manifest loop — which is exactly what that file
        looked like when its pack list was written out by hand, stopped at Level
        2, covered 24 of 62 skills and printed PASS in the same words. Nothing
        is written to disk. If the gate cannot tell those two versions of a real
        file apart, none of the synthetic cases above mean anything. */
  const LAB = path.join(ROOT, 'tools/critic/choicelab/lab.js');
  const real = moduleSetOf('tools/critic/choiceaudit.mjs').map((f) => F(f, readFileSync(f, 'utf8')));
  const shipped = judgeGate('check:choices', real);
  if (shipped.verdict !== 'all-units') { console.error(`SELF-TEST FAIL: the real choice-set audit reads as ${shipped.verdict}; this leg proves nothing`); bad++; }
  else console.log('  quiet  the real tools/critic/choicelab/lab.js as it stands, which loads every pack the manifest names');
  const crippled = real.map((f) => (f.file !== LAB ? f
    : F(f.file, f.text.replace(/content\/courses\.json/g, 'a-hand-written-list.js').replace(/\ballUnits\s*\(/g, 'handList('))));
  if (crippled.every((f) => f.text === real.find((r) => r.file === f.file).text)) { console.error('SELF-TEST FAIL: the planted defect changed nothing in the real lab text'); bad++; }
  fires(judgeAll([judgeGate('check:choices', crippled)], []), /reads the generator surface and NOTHING in it loads/,
    'the REAL choice-set lab with its manifest loop taken back out — the 24-of-62 defect');

  if (bad) { console.error(`\nself-test: ${bad} failure(s)`); process.exit(1); }
  console.log('\nself-test: ok — a gate that reads ten skills and calls it the course cannot pass, and an honest one is not touched');
}

/* Run as a tool, or imported for its rules. `realpathSync` rather than a string
   compare: this repo is reached through a symlink on more than one machine, and
   a mismatched path would turn the whole file into a no-op on import — which is
   the one failure a gate may not have. */
const isMain = !!process.argv[1]
  && realpathSync(fileURLToPath(import.meta.url)) === realpathSync(process.argv[1]);
if (isMain) {
  if (has('--self-test')) selfTest();
  else process.exit(await run());
}
