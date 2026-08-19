/**
 * SELF-TEST FOR THE SUSTAINED VERDICT IN shoot.mjs.
 *
 * The reported failure needs a loaded machine. On an idle M4 three minutes of
 * real play passes every bar in that verdict — with the defect present and with
 * it fixed — so "I ran snapshot.sh and it exited 0" is not, on its own, evidence
 * that the bars still bite. This feeds the verdict the numbers off runs that
 * actually happened and asserts what it says about them.
 *
 * Case 1 is verbatim from `shots/h6-cold/report.json`, the run the complaint was
 * written from.
 *
 *   node tools/critic/_sustainverdict-test.mjs
 */
import { sustainedVerdict } from './_sustainverdict.mjs';

let bad = 0;
const names = (rows) => rows.map((r) => r.name).sort().join(',');
const check = (label, rows, expect) => {
  const got = names(rows);
  const want = [...expect].sort().join(',');
  const ok = got === want;
  console.log(`${ok ? '  ok  ' : '  FAIL'} ${label}\n         expected [${want || '—'}]  got [${got || '—'}]`);
  if (!ok) bad++;
  for (const r of rows) console.log(`         · ${r.why}`);
};

/** A sample as measurePlaza returns one. */
const S = (o) => ({
  fps: 100, tier: 'high', chosenCap: 1.5, measuredAtCap: 1,
  sceneObjects: 779, geometries: 292, textures: 17, programs: 147,
  updaters: 9, domNodes: 1855, listeners: 187, ...o,
});

// 1. THE REPORTED RUN, verbatim from shots/h6-cold/report.json.
check('the reported session (h6-cold): tier high->low, cap 1.20->0.72',
  sustainedVerdict(
    S({ fps: 70.92, tier: 'high', chosenCap: 1.2, programs: 147, domNodes: 1855, listeners: 187 }),
    S({ fps: 74.63, tier: 'low', chosenCap: 0.72, programs: 153, domNodes: 1911, listeners: 189 })),
  ['perf-tier', 'perf-resolution']);

// 2. The regression this file was changed to remove: a session that ends
//    SHARPER. Raw frame rate falls because the buffer grew; measured at a
//    pinned buffer it did not. This must be silent, or a controller that
//    improves the picture fails the gate for improving it.
check('the game got sharper (cap 1.02->1.36) and the pinned frame rate held',
  sustainedVerdict(S({ fps: 98.0, chosenCap: 1.02 }), S({ fps: 82.6, chosenCap: 1.36 })),
  []);

// 3. A frame that really did get more expensive, at the same buffer size.
check('a real 40% decay at an identical buffer',
  sustainedVerdict(S({ fps: 120 }), S({ fps: 72 })),
  ['perf-sustained']);

// 4. Something accumulating.
check('a DOM leak',
  sustainedVerdict(S({ domNodes: 1000 }), S({ domNodes: 1400 })),
  ['perf-growth']);

// 5. A leak that hides behind a fast machine — the case the growth bars exist
//    for, where nothing else moves at all.
check('shader programs running away while the frame rate is fine',
  sustainedVerdict(S({ programs: 140 }), S({ programs: 200 })),
  ['perf-growth']);

// 6. A clean session.
check('a clean session', sustainedVerdict(S({ fps: 110 }), S({ fps: 104 })), []);

console.log(bad ? `\n${bad} case(s) failed` : '\nself-test OK — the sustained verdict still bites on every recorded failure.');
process.exit(bad ? 1 : 0);
