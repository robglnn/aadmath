#!/usr/bin/env node
/**
 * THE MEET GATE — `src/world/meet.js`, re-derived rather than believed.
 *
 *   node tools/critic/meet.mjs               # the gate; non-zero on any finding
 *   node tools/critic/meet.mjs --self-test   # prove it can refuse
 *   node tools/critic/meet.mjs --json
 *
 * WHY THIS EXISTS
 *
 * `design/ARCHIPELAGO.md` §6 states the hole plainly: *"Today, no off-island
 * site is covered by any gate… The caches' question generator has never been
 * independently re-derived; its answers are correct BY CONSTRUCTION, which is
 * exactly the condition tools/validate-items.mjs exists because of."* A
 * physical answer only the generator believes is the same defect as a card
 * whose key is whatever the generator wrote down, and this project already
 * paid for that once.
 *
 * The reason there was no gate is structural: `question(seed)` lives inside
 * `createCaches`, in a module that imports three.js and touches the DOM, so
 * nothing headless can reach it. `src/world/meet.js` answers that by keeping
 * every line of its mathematics between two markers:
 *
 *      // ---- PURE:BEGIN  …  // ---- PURE:END
 *
 * with no import, no three.js and no DOM inside them. THIS GATE CUTS THAT
 * BLOCK OUT OF THE SHIPPED FILE AND RUNS IT. It does not import a copy and it
 * does not restate the rules — `tools/critic/handed.mjs` established the
 * discipline (*"it cuts the real expression out of the shipped file and
 * executes it, so an edit to the source is what runs"*) and it is the only
 * arrangement under which a checker and a renderer cannot drift apart.
 *
 * NINE RULES, AND THE DEFECT EACH ONE IS FOR
 *
 *   pose     the rail a learner is shown is EXACTLY the lattice cells where
 *            statement one is true — no cell more, no cell fewer, re-derived
 *            here by brute force over the whole plot.
 *   unique   'unique' means one lattice cell satisfies both; 'parallel' means
 *            none does; 'coincident' means every rail cell does. Brute-forced,
 *            and cross-checked against the determinant.
 *   sign     the residual takes BOTH SIGNS on the rail.
 *            *Exists because:* a tier-1 hanging cache can only ever say TOO
 *            BIG — both its distractors are arithmetically >= x — so half of
 *            Rule 4's channel is dead until a learner reaches a deep cache.
 *            A site that cannot fall both ways is not allowed to ship here.
 *   count    every number the pans have to hold is a POSITIVE WHOLE under the
 *            countability cap. *Exists because:* `src/world/caches.js` `lay()`
 *            composes only positive counts and §7a of the pattern study says
 *            there is no counterweight for minus three — and §4.2 nonetheless
 *            proposed `2x - y = 3`.
 *   ribbon   the rail is 4-CONNECTED and inside the plot, and it carries every
 *            whole-number reading. *Exists because:* the lattice cells of a
 *            steep line do not touch, and floor laid on those alone is a row
 *            of squares a cadet falls between.
 *   verdict  `readVerdict` agrees with an independent re-derivation, for EVERY
 *            standable cell as the claim, walked-in-full and walked-in-part.
 *   cross    A CADET CROSSING THE PLOT MAY NOT GIVE AN ANSWER. Every straight
 *            walk across the rail touches fewer readings than it takes to arm
 *            a claim. *Exists because:* the first real playthrough of this
 *            site fired three claims in thirty seconds, on cells nobody chose,
 *            simply by walking across the plot — the caches' own defect in a
 *            new shape, found by playing and not by reading.
 *   reach    THE ACCESS LADDER, RECOMPUTED. Flood-fill walkable ground from the
 *            cadet's own spawn with the game's own slope rule, solve the wing
 *            at each trim from `P` and from `src/kit/kit.js`, and require the
 *            family's FIRST instance to be reachable on the base wing and the
 *            second to be out of reach on it and inside KITE TRIM — over FREE
 *            AIR, with the descent line clearing the island the whole way.
 *            *Exists because:* Rule 9's forbidden case is "five sites at the
 *            same height" and nothing would notice; because §3.4's launches
 *            for this family are in a component no walk reaches; and because
 *            the first flight flown at the number §3.4 gives put a cadet on
 *            the ground two hundred metres short, having flown into the hill
 *            the "ceiling" was measured from.
 *   boot     the factory declares no scratch binding, so nothing it builds at
 *            construction can reach a `const` that does not exist yet.
 *            *Exists because:* this file's first boot threw "Cannot access 'T'
 *            before initialization" and the page never came up — the same
 *            defect `src/world/span.js` documents, and one no headless gate
 *            can see.
 *   named    every misconception id the site can emit exists on that pose's
 *            own node in `content/graph/`. *Exists because:* the caches'
 *            `wrongA = c - b` is documented in a comment and enforced by
 *            nothing, which makes Rule 5 aspirational.
 *   body     Rule 1 and Rule 10, read off the shipped source: no key, no
 *            pointer, no DOM control, no `mastery`, no `session`, no `graph`,
 *            no objective — and NO PROXIMITY TEST AGAINST A CANDIDATE.
 *            *Exists because:* the pattern study reproduced twice that walking
 *            across a cache's deck commits an answer the player never chose,
 *            at a capture radius of 1.04-1.65 m against gaps of 2.9 m.
 *   budget   the frame budget this site states in its own header is arithmetic
 *            that holds for every pose the generator can produce.
 *            *Exists because:* 17 instances were specified with no budget
 *            against a build whose sustained framerate is an open defect.
 *
 * `--self-test` plants each of those defects into the real source and requires
 * the matching rule to fire, then requires every rule to stay quiet on the
 * honest file. A gate nobody has watched refuse anything is not a gate.
 */
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import katex from 'katex';
import { heightAt } from '../../src/world/terrain.js';
import { findings as ledger } from '../_findings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..', '..');
const SRC = path.join(ROOT, 'src', 'world', 'meet.js');
const GRAPH = path.join(ROOT, 'content', 'graph');

const SEEDS = 240;
const reachNotes = [];
const BANDS = [1, 2, 3, 4, 5];

// ---------------------------------------------------------------------------
// Cutting the mathematics out of the shipped file
// ---------------------------------------------------------------------------
function readSource() {
  return readFileSync(SRC, 'utf8');
}

function pureOf(src) {
  const a = src.indexOf('// ---- PURE:BEGIN');
  const b = src.indexOf('// ---- PURE:END');
  if (a < 0 || b < 0 || b < a) throw new Error('meet.js has no PURE block');
  return src.slice(a, b);
}

/** Code only — the prose in this file is allowed to name the things it forbids. */
function stripComments(s) {
  return s.replace(/\/\*[\s\S]*?\*\//g, ' ').replace(/(^|[^:])\/\/[^\n]*/g, '$1');
}

function loadPure(src) {
  const pure = pureOf(src);
  if (/\bimport\b|\brequire\s*\(|\bTHREE\b|\bdocument\b|\bwindow\b/.test(stripComments(pure))) {
    throw new Error('the PURE block is not pure');
  }
  const body = `${pure}\nreturn { PLOT, TILE_CAP, posePlot, readVerdict, railOf, lineCells, residualAt, SKILL, MISREAD, gcd3 };`;
  // eslint-disable-next-line no-new-func
  return new Function(body)();
}

// ---------------------------------------------------------------------------
// The graph, for rule `named`
// ---------------------------------------------------------------------------
function graphIds() {
  const out = new Map();
  for (const f of ['algebra1-l1.json', 'algebra1-l2.json', 'algebra1-l3.json',
    'algebra1-l4.json', 'algebra1-l5.json']) {
    let j;
    try { j = JSON.parse(readFileSync(path.join(GRAPH, f), 'utf8')); } catch { continue; }
    for (const n of (j.nodes || [])) {
      const ids = (n.misconceptions || []).map((m) => (typeof m === 'string' ? m : m.id));
      out.set(n.id, new Set(ids));
    }
  }
  return out;
}

function strictTex(s) {
  katex.renderToString(s, { throwOnError: true, strict: 'error', output: 'html', trust: false });
}

// ---------------------------------------------------------------------------
// The nine rules
// ---------------------------------------------------------------------------
function run(src) {
  const found = [];
  const add = (rule, why) => found.push({ rule, why });
  let M;
  try { M = loadPure(src); } catch (e) { add('pose', `the PURE block will not run: ${e.message}`); return found; }
  const N = M.PLOT;
  const nodes = graphIds();

  // ---- body: Rule 1 and Rule 10, read off the whole shipped file ----------
  const banned = [
    [/addEventListener/, 'the site owns an event listener'],
    [/\bkeydown\b|\bkeyup\b|\bKeyE\b|\bkeyCode\b|\bonkeydown\b/, 'the site reads a key'],
    [/\binput\.(interact|fire|jump|dash)/, 'the site reads the input layer'],
    [/document\.createElement\('(button|input|select)'/, 'the site draws a DOM control'],
    [/builder\.(place|set|arm|target)\b/, 'the site calls into the build system'],
  ];
  const code = stripComments(src);
  for (const [re, why] of banned) if (re.test(code)) add('body', why);
  const opts = code.match(/const \{([\s\S]*?)\} = opts;/);
  if (!opts) add('body', 'createMeets does not destructure its options where the gate can read them');
  else {
    for (const bad of ['mastery', 'session', 'graph', 'objective', 'scheduler']) {
      if (new RegExp(`\\b${bad}\\b`).test(opts[1])) {
        add('body', `Rule 10: the site is handed \`${bad}\``);
      }
    }
  }
  if (/distanceTo\(\s*player\.pos\s*\)\s*<|player\.pos\.distanceTo\([^)]*\)\s*</.test(code)) {
    add('body', 'a claim is decided by proximity to a candidate — the caches\' accidental-commit hazard');
  }

  // ---- boot: NOTHING THE FACTORY BUILDS AT CONSTRUCTION MAY REACH FORWARD --
  //
  // `src/world/span.js` paid for this with the whole game — a scratch vector
  // declared below the code that runs during module setup threw "Cannot access
  // before initialization", `window.__ascent` never appeared, and every cadet
  // who had covered a plot came back to a black page. It only happens on a
  // second sitting there, so nothing that starts from a cleared save could see
  // it. THIS FILE DID THE SAME THING ON ITS FIRST BOOT, from a cleared save,
  // for the same reason. The rule that removes the whole class: the factory
  // declares no scratch binding at all — they live at module scope, above
  // everything — so there is nothing left for construction to reach forward to.
  const fac = code.slice(code.indexOf('export function createMeets'));
  const scratch = /^\s{2}(?:const|let)\s+\w+\s*=\s*new THREE\.(Vector3|Vector2|Matrix4|Quaternion|Color|Box3|Ray)\b/gm;
  let sm;
  while ((sm = scratch.exec(fac))) {
    add('boot', `a scratch ${sm[1]} is declared inside createMeets — move it to module scope, or construction can reach it before it exists (src/world/span.js)`);
  }

  // ---- budget: the header's own numbers, against every pose --------------
  const cap = {
    tile: Number((src.match(/const TILE_MAX = (\d+)/) || [])[1]),
    plate: Number((src.match(/const PLATE_MAX = (\d+)/) || [])[1]),
    road: Number((src.match(/const ROAD_CELLS = (\d+)/) || [])[1]),
  };
  const ARM = Number((src.match(/const ARM = (\d+)/) || [])[1]);
  if (!ARM) add('cross', 'the site does not state how many readings arm a claim');
  if (!cap.tile || !cap.plate || !cap.road) add('budget', 'the frame budget is not stated as constants');

  let worstPlate = 0, worstTile = 0, poses = 0;
  for (const band of BANDS) {
    for (let seed = 0; seed < SEEDS; seed++) {
      const pose = M.posePlot(seed, band);
      if (!pose) continue;
      poses++;
      const tag = `band ${band} seed ${seed} (${pose.latexA} | ${pose.latexB})`;

      // ---- pose ---------------------------------------------------------
      const brute = [];
      for (let gx = 0; gx < N; gx++) {
        for (let gz = 0; gz < N; gz++) {
          if (pose.eqA.u * gx + pose.eqA.v * gz === pose.eqA.w) brute.push(`${gx},${gz}`);
        }
      }
      const shown = pose.rail.map((c) => `${c[0]},${c[1]}`);
      if (brute.length !== shown.length || brute.some((k) => !shown.includes(k))) {
        add('pose', `${tag}: the rail is not the solution set of statement one`);
      }
      try { strictTex(pose.latexA); strictTex(pose.latexB); }
      catch (e) { add('pose', `${tag}: strict KaTeX refuses it — ${e.message}`); }

      // ---- unique -------------------------------------------------------
      const both = [];
      for (let gx = 0; gx < N; gx++) {
        for (let gz = 0; gz < N; gz++) {
          if (pose.eqA.u * gx + pose.eqA.v * gz === pose.eqA.w
            && pose.eqB.p * gx + pose.eqB.q * gz === pose.eqB.r) both.push([gx, gz]);
        }
      }
      const det = pose.eqA.u * pose.eqB.q - pose.eqA.v * pose.eqB.p;
      if (pose.kind === 'unique') {
        if (both.length !== 1) add('unique', `${tag}: says unique, ${both.length} lattice cells satisfy both`);
        else if (!pose.solution || pose.solution[0] !== both[0][0] || pose.solution[1] !== both[0][1]) {
          add('unique', `${tag}: the crossing it names is not the crossing`);
        }
        if (det === 0) add('unique', `${tag}: says unique but the two statements are parallel`);
      } else if (pose.kind === 'parallel') {
        if (both.length !== 0) add('unique', `${tag}: says parallel, ${both.length} lattice cells satisfy both`);
        if (det !== 0) add('unique', `${tag}: says parallel but the two lines cross`);
        if (pose.solution !== null) add('unique', `${tag}: parallel poses may not name a crossing`);
      } else if (pose.kind === 'coincident') {
        if (both.length !== pose.rail.length) add('unique', `${tag}: says coincident, only ${both.length} of ${pose.rail.length} rail cells satisfy both`);
        if (det !== 0) add('unique', `${tag}: says coincident but the two lines cross`);
      } else add('unique', `${tag}: unknown kind ${pose.kind}`);

      // ---- sign ---------------------------------------------------------
      if (pose.kind === 'unique') {
        let lo = 0, hi = 0;
        for (const [gx, gz] of pose.rail) {
          const d = M.residualAt(pose, gx, gz);
          if (d < lo) lo = d;
          if (d > hi) hi = d;
        }
        if (lo >= 0 || hi <= 0) {
          add('sign', `${tag}: the beam only ever falls one way (residual ${lo}..${hi}) — the caches' dead sign channel`);
        }
      }

      // ---- count --------------------------------------------------------
      const nums = [pose.eqA.u, pose.eqA.v, pose.eqA.w, pose.eqB.p, pose.eqB.q, pose.eqB.r];
      if (nums.some((n) => !Number.isInteger(n) || n < 1)) {
        add('count', `${tag}: a pan cannot hold ${nums.filter((n) => n < 1).join(', ')} — no negative, no zero, no fraction`);
      }
      if (pose.eqB.r > M.TILE_CAP) add('count', `${tag}: the right pan holds ${pose.eqB.r}, past the countability cap ${M.TILE_CAP}`);
      if (pose.eqB.p + pose.eqB.q > 8) add('count', `${tag}: ${pose.eqB.p + pose.eqB.q} unknown tiles on one pan`);
      for (const [gx, gz] of pose.rail) {
        const left = pose.eqB.p * gx + pose.eqB.q * gz;
        if (left > M.TILE_CAP) add('count', `${tag}: standing at (${gx}, ${gz}) lays ${left} on the left pan, past ${M.TILE_CAP}`);
        worstTile = Math.max(worstTile, left + pose.eqB.r);
      }

      // ---- ribbon -------------------------------------------------------
      const ribbon = M.lineCells(pose.eqA.u, pose.eqA.v, pose.eqA.w);
      const rset = new Set(ribbon.map((c) => `${c[0]},${c[1]}`));
      for (const [gx, gz] of ribbon) {
        if (gx < 0 || gz < 0 || gx >= N || gz >= N) add('ribbon', `${tag}: the rail leaves the plot at (${gx}, ${gz})`);
      }
      for (const k of shown) if (!rset.has(k)) add('ribbon', `${tag}: reading ${k} is on the line and has no floor under it`);
      // 4-connected: a cadet must be able to walk it without falling off
      const seen = new Set([`${ribbon[0][0]},${ribbon[0][1]}`]);
      const q = [ribbon[0]];
      while (q.length) {
        const [gx, gz] = q.pop();
        for (const [dx, dz] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
          const k = `${gx + dx},${gz + dz}`;
          if (rset.has(k) && !seen.has(k)) { seen.add(k); q.push([gx + dx, gz + dz]); }
        }
      }
      if (seen.size !== ribbon.length) {
        add('ribbon', `${tag}: the rail is in ${ribbon.length - seen.size + 1} pieces — a cadet walks off it`);
      }
      // ---- cross ---------------------------------------------------------
      // A CADET CROSSING THE PLOT MAY NOT GIVE AN ANSWER. Every straight walk
      // between two edge cells whose heading is within 45 degrees of the
      // rail's own normal is a crossing, not a reading, and it must touch
      // fewer than ARM cells of the rail — or the boots pull the cadet up the
      // metre, carry him over and drop him off the far side, and that was a
      // claim on a cell he never chose. Found by playing this site, not by
      // reading it, and this is the rule that stops it coming back.
      if (ARM) {
        const nx = pose.eqA.u, nz = pose.eqA.v;      // the rail's normal
        const nlen = Math.hypot(nx, nz);
        const edge = [];
        for (let k = 0; k < N; k++) edge.push([k, 0], [k, N - 1], [0, k], [N - 1, k]);
        let worst = 0, worstPath = null;
        for (const a of edge) {
          for (const b of edge) {
            const dx = b[0] - a[0], dz = b[1] - a[1];
            const dl = Math.hypot(dx, dz);
            if (dl < N - 1) continue;
            if (Math.abs((dx * nx + dz * nz) / (dl * nlen)) < Math.SQRT1_2) continue;
            let hit = 0;
            const steps = Math.max(Math.abs(dx), Math.abs(dz)) * 2;
            let last = '';
            for (let i2 = 0; i2 <= steps; i2++) {
              const gx2 = Math.round(a[0] + (dx * i2) / steps);
              const gz2 = Math.round(a[1] + (dz * i2) / steps);
              const k2 = `${gx2},${gz2}`;
              if (k2 === last) continue;
              last = k2;
              if (rset.has(k2)) hit++;
            }
            if (hit > worst) { worst = hit; worstPath = `${a} -> ${b}`; }
          }
        }
        if (worst >= ARM) {
          add('cross', `${tag}: a straight crossing (${worstPath}) touches ${worst} readings and ARM is ${ARM} — it would give an answer`);
        }
        // …and the other half of the same rule: a site that cannot be armed
        // cannot be solved. The rail has to be longer than the arming.
        if (ribbon.length <= ARM) {
          add('cross', `${tag}: the rail is ${ribbon.length} cells and ARM is ${ARM} — no claim could ever be made`);
        }
      }

      const second = M.lineCells(pose.eqB.p, pose.eqB.q, pose.eqB.r);
      worstPlate = Math.max(worstPlate, ribbon.length + second.length + cap.road * 4);

      // ---- verdict + named ----------------------------------------------
      const vocab = M.MISREAD[pose.skill] || {};
      const known = nodes.get(pose.skill);
      const all = ribbon.map((c) => `${c[0]},${c[1]}`);
      for (const cell of ribbon) {
        for (const whole of [true, false]) {
          const walked = whole ? ribbon : ribbon.slice(0, 1);
          const got = M.readVerdict(pose, { cell, walked });
          const want = derive(pose, cell, whole ? all : all.slice(0, 1), N);
          if (got.correct !== want.correct) {
            add('verdict', `${tag}: claim (${cell}) walked=${whole ? 'all' : 'part'} — site says ${got.correct}, re-derivation says ${want.correct}`);
          }
          if (got.residual !== want.residual) {
            add('verdict', `${tag}: claim (${cell}) — residual ${got.residual} against ${want.residual}`);
          }
          if (!got.correct && !got.misconception) {
            add('named', `${tag}: claim (${cell}) is refused and names no misconception`);
          }
          if (got.misconception && known && !known.has(got.misconception)) {
            add('named', `${tag}: \`${got.misconception}\` is not on \`${pose.skill}\` in content/graph`);
          }
          if (got.correct && got.misconception) {
            add('named', `${tag}: a correct claim carries a misconception`);
          }
        }
      }
      for (const id of Object.values(vocab)) {
        if (known && !known.has(id)) add('named', `${tag}: vocabulary \`${id}\` is not on \`${pose.skill}\``);
      }
    }
  }

  if (!poses) add('pose', 'the generator produced no pose at all');

  // ---- reach ------------------------------------------------------------
  const loco = readFileSync(path.join(ROOT, 'src', 'player', 'locomotion.js'), 'utf8');
  const kitSrc = readFileSync(path.join(ROOT, 'src', 'kit', 'kit.js'), 'utf8');
  const ctl = readFileSync(path.join(ROOT, 'src', 'player', 'controller.js'), 'utf8');
  const num = (re, txt) => Number((txt.match(re) || [])[1]);
  const slopeLimit = num(/slopeLimit:\s*([\d.]+)/, loco);
  const baseWing = [num(/glideBase:\s*(-?[\d.]+)/, loco), num(/glideDrag:\s*([\d.]+)/, loco)];
  const kiteWing = [num(/P\.glideBase = (-?[\d.]+);[\s\S]{0,80}?P\.glideDrag = ([\d.]+);/, kitSrc),
    Number((kitSrc.match(/P\.glideBase = -?[\d.]+;\s*\n\s*P\.glideDrag = ([\d.]+);/) || [])[1])];
  const spawnM = ctl.match(/this\.pos\.set\(\s*(-?[\d.]+)\s*,[^,]+,\s*(-?[\d.]+)\s*\)/);
  const spawn = spawnM ? [Math.round(Number(spawnM[1])), Math.round(Number(spawnM[2]))] : [0, 26];
  const kitTrims = [...kitSrc.matchAll(/P\.glideBase = (-?[\d.]+);\s*\n\s*P\.glideDrag = ([\d.]+);/g)]
    .map((m2) => [Number(m2[1]), Number(m2[2])]);
  if (!slopeLimit || !baseWing[0] || kitTrims.length < 2) {
    add('reach', 'could not read the slope limit or the wing trims out of the shipped source');
  } else {
    const half = ((Number((src.match(/const PLOT = (\d+)/) || [])[1]) - 1) / 2) * 4;
    const ground = walkable(slopeLimit, spawn);
    const R = { base: glideRatio(baseWing[0], baseWing[1]),
      kite: glideRatio(kitTrims[0][0], kitTrims[0][1]),
      span: glideRatio(kitTrims[1][0], kitTrims[1][1]) };
    const sitesTxt = src.slice(src.indexOf('const SITES = ['), src.indexOf('export function createMeets'));
    const sites = [...sitesTxt.matchAll(/key:\s*'(\w+)',\s*x:\s*(-?\d+),\s*z:\s*(-?\d+),\s*y:\s*(-?\d+)/g)]
      .map((m2) => ({ key: m2[1], x: Number(m2[2]), z: Number(m2[3]), y: Number(m2[4]) }));
    if (sites.length < 2) add('reach', 'could not read SITES out of the shipped file');
    reachNotes.length = 0;
    sites.forEach((st, i) => {
      const b = ceilingAt(ground, st.x, st.z, R.base, half);
      const k = ceilingAt(ground, st.x, st.z, R.kite, half);
      reachNotes.push(`${st.key} deck ${st.y} m · base ceiling ${b.c.toFixed(1)} · kite ceiling ${k.c.toFixed(1)}`
        + (b.from ? ` · base launch (${b.from}) at ${b.h.toFixed(1)} m, ${b.gulf.toFixed(0)} m of gulf` : ' · no base launch clears'));
      if (i === 0) {
        // the family's first instance: reachable from a cleared save, on the
        // wing every cadet has from boot. This is the rule that stops the
        // archipelago being a reward for people who are already winning.
        if (st.y > b.c - MARGIN) {
          add('reach', `${st.key} sits at ${st.y} m against a base-wing ceiling of ${b.c.toFixed(1)} — the first instance of a family must be flyable from a cleared save`);
        }
      } else {
        if (st.y < b.c + MARGIN) {
          add('reach', `${st.key} sits at ${st.y} m and the base wing reaches ${b.c.toFixed(1)} — it is not tiered against anything`);
        }
        if (st.y > k.c - MARGIN) {
          add('reach', `${st.key} sits at ${st.y} m against a KITE TRIM ceiling of ${k.c.toFixed(1)} — the kit it claims does not reach it`);
        }
      }
    });
  }
  if (cap.tile && worstTile * 2 > cap.tile) {
    add('budget', `two plots can want ${worstTile * 2} pan tiles against TILE_MAX ${cap.tile}`);
  }
  if (cap.plate && worstPlate * 2 > cap.plate) {
    add('budget', `two plots can want ${worstPlate * 2} plates against PLATE_MAX ${cap.plate}`);
  }
  return found;
}

// ---------------------------------------------------------------------------
// reach — the access ladder, recomputed from the shipping source
// ---------------------------------------------------------------------------
const SLOPE_E = 0.7;
/** Metres of air the wing's own descent line must keep over the island. */
const CLEAR = 3;
/** Margin a tier must hold, either way, before it is a tier and not a coin toss. */
const MARGIN = 3;

function grad(x, z) {
  const h = heightAt(x, z);
  if (h === null) return null;
  const e = SLOPE_E;
  const hx = heightAt(x + e, z), hxn = heightAt(x - e, z);
  const hz = heightAt(x, z + e), hzn = heightAt(x, z - e);
  return Math.hypot(((hx ?? h) - (hxn ?? h)) / (2 * e), ((hz ?? h) - (hzn ?? h)) / (2 * e));
}

/**
 * Every square metre of ground a cadet can WALK to from the spawn.
 *
 * The game's own rule, out of `src/player/locomotion.js`: `_blocked` refuses a
 * step onto ground whose `gradientAt(x, z, 0.7)` is over `P.slopeLimit`. The
 * discrete-step half of that test (`rise > P.stepUp`) never fires on this
 * heightfield at the ten-centimetre steps a walk actually takes, so the slope
 * is what binds.
 */
function walkable(slopeLimit, spawn) {
  const R = 200, N = 2 * R + 1;
  const H = new Float32Array(N * N), G = new Float32Array(N * N);
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const h = heightAt(i - R, j - R);
      H[i * N + j] = h === null ? NaN : h;
      G[i * N + j] = h === null ? NaN : grad(i - R, j - R);
    }
  }
  const seen = new Uint8Array(N * N);
  const s0 = (spawn[0] + R) * N + (spawn[1] + R);
  if (Number.isNaN(H[s0])) return { list: [], N, R, H };
  seen[s0] = 1;
  const q = [s0];
  let head = 0;
  for (const D = [[1, 0], [-1, 0], [0, 1], [0, -1]]; head < q.length;) {
    const k = q[head++], i = (k / N) | 0, j = k % N;
    for (const [di, dj] of D) {
      const ni = i + di, nj = j + dj;
      if (ni < 0 || nj < 0 || ni >= N || nj >= N) continue;
      const nk = ni * N + nj;
      if (seen[nk] || Number.isNaN(H[nk]) || G[nk] > slopeLimit) continue;
      seen[nk] = 1; q.push(nk);
    }
  }
  const list = [];
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) if (seen[i * N + j]) list.push([i - R, j - R, H[i * N + j]]);
  }
  return { list, N, R, H };
}

/** Steady glide ratio, solved from the trim the shipped source sets. */
function glideRatio(base, drag) {
  const g = 26, gam = -base;
  const v = Math.sqrt((g * Math.sin(gam)) / drag);
  return (v * Math.cos(gam)) / (v * Math.sin(gam));
}

/**
 * The highest deck at (tx, tz) any walk-reachable launch can put a cadet on,
 * on a wing of this ratio, WITH THE ISLAND IN THE WAY.
 */
function ceilingAt(ground, tx, tz, ratio, half) {
  const cand = [];
  for (const [lx, lz, lh] of ground.list) {
    const gulf = Math.hypot(tx - lx, tz - lz) - half;
    if (gulf < 14) continue;
    cand.push([lh - gulf / ratio, lx, lz, lh, gulf]);
  }
  cand.sort((a, b) => b[0] - a[0]);
  for (const [c, lx, lz, lh, gulf] of cand) {
    const full = Math.hypot(tx - lx, tz - lz) || 1;
    const steps = Math.max(4, Math.ceil(gulf / 3));
    let clearAll = true;
    for (let k = 1; k <= steps; k++) {
      const d = (gulf * k) / steps;
      const f = d / full;
      const g = heightAt(lx + (tx - lx) * f, lz + (tz - lz) * f);
      if (g !== null && lh - d / ratio < g + CLEAR) { clearAll = false; break; }
    }
    if (clearAll) return { c, from: [lx, lz], h: lh, gulf };
  }
  return { c: -1e9, from: null, h: 0, gulf: 0 };
}

/**
 * THE INDEPENDENT RE-DERIVATION. It shares no line with `readVerdict`: it
 * decides from the two statements, the claimed cell and the walk alone.
 */
function derive(pose, cell, walked, N) {
  const [gx, gz] = cell;
  const onLine = pose.eqA.u * gx + pose.eqA.v * gz === pose.eqA.w;
  const res = pose.eqB.p * gx + pose.eqB.q * gz - pose.eqB.r;
  if (gx < 0 || gz < 0 || gx >= N || gz >= N) return { correct: false, residual: res };
  if (!onLine) return { correct: false, residual: res };
  if (pose.kind === 'parallel') {
    const whole = pose.rail.every((c) => walked.includes(`${c[0]},${c[1]}`));
    const ends = [pose.rail[0], pose.rail[pose.rail.length - 1]];
    const atEnd = ends.some((c) => c[0] === gx && c[1] === gz);
    return { correct: whole && atEnd, residual: res };
  }
  return { correct: res === 0, residual: res };
}

// ---------------------------------------------------------------------------
// --self-test: plant the exact defect each rule exists for
// ---------------------------------------------------------------------------
const PLANTS = [
  ['pose', 'the rail carries a cell that is not a solution',
    (s) => s.replace('  out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);',
      '  out.push([0, 0]);\n  out.sort((a, b) => a[0] - b[0] || a[1] - b[1]);')],
  ['sign', 'both distractors on one side — the tier-1 cache defect',
    (s) => s.replace('    if (lo >= 0 || hi <= 0) continue;', '    if (false) continue;')],
  ['count', 'a pan asked to hold more than it can count',
    (s) => s.replace('function layable(rail, p, q) {\n  for (const [gx, gz] of rail) if (p * gx + q * gz > TILE_CAP) return false;',
      'function layable(rail, p, q) {\n  for (const [gx, gz] of rail) if (p * gx + q * gz > 1e9) return false;')],
  ['count', 'a negative coefficient, which no pan has a body for',
    (s) => s.replace('    const p = 1 + rnd(capB);', '    const p = -1 - rnd(capB);')],
  ['ribbon', 'the rail laid as a chain of corners a cadet falls between',
    (s) => s.replace('      if (Math.abs(ax) === 1 && Math.abs(az) === 1) {',
      '      if (false) {')],
  ['verdict', 'a claim off the line accepted',
    (s) => s.replace('  if (!onRail) {', '  if (false) {')],
  ['cross', 'a claim armed by one reading, so crossing the rail answers it',
    (s) => s.replace('const ARM = 4;', 'const ARM = 1;')],
  ['cross', 'an arming longer than the rail, so nothing can ever be claimed',
    (s) => s.replace('const ARM = 4;', 'const ARM = 40;')],
  ['named', 'a misconception id that is on no node',
    (s) => s.replace("'system-substitution': { swapped: 'axis-swap', off: 'partial-rule' },",
      "'system-substitution': { swapped: 'looked-plausible', off: 'partial-rule' },")],
];

const BODY_PLANTS = [
  ['body', 'the site grows a key handler',
    (s) => s.replace('export function createMeets(opts = {}) {',
      "export function createMeets(opts = {}) {\n  window.addEventListener('keydown', () => {});")],
  ['body', 'the site is handed the mastery model',
    (s) => s.replace('    scene, uiRoot, player, builder, hud, wallet, audio, fx,',
      '    scene, uiRoot, player, builder, hud, wallet, audio, fx, mastery,')],
  ['body', 'a claim decided by walking near a candidate',
    (s) => s.replace('  function claimCell(c, cell) {',
      '  function claimCell(c, cell) {\n    if (_p.distanceTo(player.pos) < 2.2) return;')],
  ['reach', 'the first instance hung above the wing every cadet has from boot',
    (s) => s.replace("{ key: 'm1', x: 140, z: 136, y: 56,", "{ key: 'm1', x: 140, z: 136, y: 96,")],
  ['reach', 'the second instance dropped to where the base wing already reaches',
    (s) => s.replace("{ key: 'm2', x: 120, z: 224, y: 64,", "{ key: 'm2', x: 120, z: 224, y: 40,")],
  ['boot', 'a scratch vector put back inside the factory, where setup can reach it too early',
    (s) => s.replace('  function cellWorld(c, gx, gz) {',
      '  const _late = new THREE.Vector3();\n  function cellWorld(c, gx, gz) {')],
  ['budget', 'the shared tile buffer cut below what one plot wants',
    (s) => s.replace('const TILE_MAX = 160;', 'const TILE_MAX = 12;')],
];

function selfTest() {
  const honest = readSource();
  const clean = run(honest);
  let bad = 0;
  if (clean.length) {
    bad++;
    console.log('SELF-TEST: the honest file is not clean —');
    for (const f of clean.slice(0, 6)) console.log(`   ${f.rule}: ${f.why}`);
  } else console.log('SELF-TEST: the honest file is clean · ok');

  for (const [rule, what, plant] of [...PLANTS, ...BODY_PLANTS]) {
    const hurt = plant(honest);
    if (hurt === honest) {
      bad++;
      console.log(`SELF-TEST: could not plant "${what}" — the source moved under the plant`);
      continue;
    }
    let got;
    try { got = run(hurt); } catch (e) { got = [{ rule, why: e.message }]; }
    const fired = got.some((f) => f.rule === rule);
    console.log(`SELF-TEST: ${rule.padEnd(8)} ${fired ? 'refused' : 'ACCEPTED'} "${what}"${fired ? ' · ok' : ''}`);
    if (!fired) bad++;
  }
  return bad;
}

// ---------------------------------------------------------------------------
const argv = process.argv.slice(2);
if (argv.includes('--self-test')) {
  const bad = selfTest();
  console.log(bad ? `\nself-test FAILED (${bad})` : '\nself-test passed');
  process.exit(bad ? 1 : 0);
}

const findings = run(readSource());
if (argv.includes('--json')) {
  console.log(JSON.stringify({ findings }, null, 2));
} else {
  const by = new Map();
  for (const f of findings) by.set(f.rule, [...(by.get(f.rule) || []), f.why]);
  if (!findings.length) {
    console.log(`meet: clean — ${BANDS.length} bands x ${SEEDS} seeds, every standable cell claimed, both walks`);
    for (const n of reachNotes) console.log(`  reach · ${n}`);
    console.log('the two plots stand off the coast on the shipped route');
  } else {
    for (const [rule, whys] of by) {
      console.log(`${rule} — ${whys.length}`);
      for (const w of whys.slice(0, 8)) console.log(`   ${w}`);
      if (whys.length > 8) console.log(`   … ${whys.length - 8} more`);
    }
  }
}
/* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs. The meet is on the
   shipped route, so every finding here is one a learner meets today.
   The clean case used to print `ROUTE: the two plots stand off the coast`,
   which reads to tools/check-all.mjs's whereIsIt() as a route FINDING on a
   green gate — the marker means "here is a defect on the route", not "this
   gate is about the route", and overloading it is how a marker stops meaning
   anything. The ledger prints it now, once, from one place. */
const F = ledger('check:meet', { scope: 'route' });
F.route(findings.map((f) => `${f.rule}: ${f.why}`));
F.done();
