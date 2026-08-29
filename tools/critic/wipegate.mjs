#!/usr/bin/env node
/**
 * THE WIPE GATE — does START OVER clear what its own confirm text promises?
 *
 *   node tools/critic/wipegate.mjs [--url …] [--headed] [--out shots/wipe]
 *   node tools/critic/wipegate.mjs --self-test
 *
 * Exit 0 = a learner who presses START OVER gets a fresh install.
 *
 * WHY THIS EXISTS
 *
 * The pause menu prints a promise above two buttons: *"Start over? Every rift
 * you have sealed and every mote you have earned goes."* Measured on the
 * shipping build, through the real menu, with real keys, across a full page
 * reload: the motes went, and everything else stayed. Four held lines were
 * still standing in `ascent.save` after the confirm, with `shards: 0` beside
 * them. `ascent.waygates` came back byte for byte. So did the name stamped on
 * the teacher record. The sealed rifts and the world-repair figure are derived
 * from the mastery model, so they came back too.
 *
 * The cause was ordering, and it is the kind of thing no review catches: the
 * old `restartRun()` deleted four keys and then called eleven `reset()`
 * methods, and one of those — `wallet.reset()` — fires `onChange`, which is
 * wired to `save()`, which writes the live mastery engine back to disk. The
 * wipe deleted the file and the wipe rewrote it, four lines apart.
 *
 * WHAT THIS GATE REFUSES TO DO
 *
 *  · It does not use `window.__ascent` to wipe anything or to read the verdict.
 *    The wipe is a real Escape key, a real click on the real button, and a real
 *    click on the confirm. The verdict is read off `localStorage` — the save
 *    file itself, which is the artefact under test — and off the real progress
 *    report, opened with the real key a learner presses.
 *  · It does not ask a list of keys whether they are gone. It asks the STORAGE
 *    what is left, and requires everything still standing to be named in
 *    `KEPT_KEYS` with a written reason. A key nobody has thought about fails
 *    this gate rather than quietly surviving it, which is the whole defect.
 *
 * THE RECORD IT PLANTS IS REAL. The mastery half is produced by the shipping
 * `MasteryEngine`: a knower is played through the real router and the real
 * promotion gate until four lines are genuinely held, and `engine.save()` — the
 * product's own serializer — writes the file. There is no hand-written learner
 * model anywhere in this gate.
 *
 * SELF-TEST. `--self-test` plants a key that survives the sweep: an init script
 * that makes `Storage.removeItem` quietly ignore `ascent.waygates`, which is
 * exactly the bug this gate was written against. The gate must go red on it and
 * must name the key. It then runs the same rule against the honest build and
 * requires it to stay quiet, because a gate that also fires on a clean tree
 * gets switched off. The static half of the rule is tested the same way: an
 * unclassified storage key is planted in a copy of the ledger and the rule must
 * find it, then the real ledger must come back clean.
 */
import { chromium } from 'playwright';
import { createServer } from 'node:http';
import { readFile, mkdir, mkdtemp, rm, writeFile, readdir, stat } from 'node:fs/promises';
import { tmpdir } from 'node:os';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { build } from 'vite';
import { listenFree } from '../_freeport.mjs';
import { MasteryEngine } from '../../src/learn/mastery.js';
import { FORMS_BY_SKILL } from '../../src/learn/generators.js';
import { manifest, loadUnit, standalone } from '../_courses.mjs';
import { RECORD_KEYS, KEPT_KEYS, NOT_STORAGE, PREFIX, WIPE_MARK } from '../../src/meta/wipe.js';
import { findings } from '../_findings.mjs';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const has = (f) => process.argv.includes(f);
const OUT = path.resolve(arg('out', 'shots/wipe'));
const SELF = has('--self-test');
const HEADED = has('--headed');
const MIME = {
  '.html': 'text/html', '.js': 'text/javascript', '.css': 'text/css', '.json': 'application/json',
  '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml', '.ico': 'image/x-icon',
  '.woff2': 'font/woff2', '.woff': 'font/woff', '.ttf': 'font/ttf', '.map': 'application/json',
};

const KEPT = new Set(KEPT_KEYS.map(([k]) => k));
const RECORD = [...RECORD_KEYS];

/**
 * AN EXCEPTION WITHOUT A REASON IS NOT A DECISION.
 *
 * The two lists that let a key SURVIVE a start-over are the ones that can go
 * wrong quietly, so every entry in them has to say why. Same rule the build's
 * own `NOT_IN_BUILD` runs under, and for the same reason: the day somebody adds
 * a progress key to `KEPT_KEYS` to make this gate go green, they have to write
 * the sentence that says a student's work is a device setting.
 */
function unexplained(list) {
  return list.filter(([k, why]) => !k || !String(why || '').trim()).map(([k]) => k || '(no key)');
}

// ---------------------------------------------------------------------------
// The static half: every storage key in src/ is classified, with a reason
// ---------------------------------------------------------------------------

/** Every `'ascent.…'` literal in `src/`, with the file it is in. */
async function keysInSource(root = path.join(ROOT, 'src')) {
  const found = new Map();
  const walk = async (dir) => {
    for (const name of await readdir(dir)) {
      const p = path.join(dir, name);
      if ((await stat(p)).isDirectory()) { await walk(p); continue; }
      if (!/\.(js|mjs)$/.test(name)) continue;
      const src = await readFile(p, 'utf8');
      for (const m of src.matchAll(/'(ascent\.[A-Za-z0-9._-]+)'/g)) {
        if (!found.has(m[1])) found.set(m[1], path.relative(ROOT, p));
      }
    }
  };
  await walk(root);
  return found;
}

/**
 * The rule, as a pure function so the self-test can plant a defect in it.
 * Every key the source names is in exactly one of the three lists.
 */
export function unclassified(keys, record, kept, notStorage) {
  const known = new Set([...record, ...kept, ...notStorage]);
  return [...keys].filter(([k]) => !known.has(k)).map(([k, file]) => `${k} (${file})`);
}

// ---------------------------------------------------------------------------
// A real record, written by the product's own serializer
// ---------------------------------------------------------------------------
async function plantedRecord() {
  const m = await manifest();
  const course = m.courses.find((c) => c.id === m.default.course);
  const unit = course.units.find((u) => u.id === m.default.unit);
  const graph = standalone(await loadUnit(unit));
  const skills = graph.nodes.map((n) => n.id);
  let seed = 20260825;
  const rnd = () => (seed = (seed * 1664525 + 1013904223) >>> 0) / 4294967296;
  let vnow = Date.now() - 3 * 86400000;
  const eng = new MasteryEngine(graph);
  eng.setClock(() => vnow);
  for (let step = 0; step < 900; step++) {
    const objective = eng.next();
    if (!objective) break;
    const task = eng.taskFor(objective.id)
      || { skill: objective.id, kind: 'learn', difficulty: 1, formCandidates: [] };
    const forms = FORMS_BY_SKILL[task.skill] || [];
    const pool = task.formCandidates?.length
      ? task.formCandidates
      : forms.filter((f) => task.difficulty >= f.dMin && task.difficulty <= f.dMax).map((f) => f.id);
    const form = pool[Math.floor(rnd() * pool.length)] || forms[0]?.id;
    eng.observe(task.skill, true, { assisted: false, form, rep: 'symbolic', kind: task.kind });
    vnow += 25_000;
    if (skills.filter((s) => eng.get(s).mastered).length >= 4) break;
  }
  const mastery = eng.save();
  const held = skills.filter((s) => mastery.skills[s]?.mastered);
  return { mastery, held, skills };
}

/**
 * What a learner who has been here a week has on disk. Every key in the ledger
 * gets a value, so the sweep is measured against the whole record and not
 * against the four keys somebody happened to remember.
 */
function fullRecord(mastery) {
  const now = Date.now();
  return {
    'ascent.save': JSON.stringify({ mastery, shards: 640 }),
    'ascent.run': JSON.stringify({
      index: 3, target: 18, tears: 6, focus: 900, items: 11, misses: 2, echoes: 2,
      seams: [], worked: {}, held: [], opened: [], startedAt: now - 900_000, done: false,
    }),
    'ascent.run.last': JSON.stringify({ tears: 5, minutes: 21, at: now - 86_400_000 }),
    'ascent.pace': JSON.stringify({ factor: 1.24, accuracy: 0.81, samples: 26 }),
    'ascent.clock': JSON.stringify({ ms: 640_000, sitting: 7, startedAt: now - 640_000, seenAt: now }),
    'ascent.clockoffset': '0',
    'ascent.report': JSON.stringify({ v: 2, recordId: 'planted-record', seq: 41, claims: [], withdrawn: [] }),
    'ascent.story': JSON.stringify({ seen: ['story.open.l1'], told: [], chapter: 4, rank: 3, regionsOpened: ['algebra1-l2'] }),
    'ascent.night': JSON.stringify({ marks: [{ id: 'var-meaning', at: now - 86_400_000 }] }),
    'ascent.survey': JSON.stringify({ done: ['errand-1', 'errand-2'] }),
    'ascent.waygates': JSON.stringify({ opened: ['wg-plaza', 'wg-ridge'] }),
    'ascent.spans': JSON.stringify({ opened: ['span-gulf'] }),
    'ascent.caches': JSON.stringify({ taken: ['cache-1', 'cache-2', 'cache-3'] }),
    // THE MEET (src/world/meet.js) keeps its own key. It reached the tree in a
    // lane that never read src/meta/wipe.js, so it was in neither list and the
    // static half of this rule was red on it. Planted here so the sweep is
    // PROVED to take it, not merely presumed to by the deny-by-default rule.
    'ascent.meet': JSON.stringify({ opened: [0, 1], said: true }),
    'ascent.wardens': JSON.stringify({ beaten: ['warden-1'] }),
    'ascent.charges': JSON.stringify({ glide: 3 }),
    'ascent.beacons': JSON.stringify(['beacon-1']),
    'ascent.stations': JSON.stringify({ at: ['station-1'], spent: 2 }),
    'ascent.charters': JSON.stringify(['charter-1']),
    'ascent.sound': JSON.stringify({ day: 3 }),
    'ascent.temper': '4',
    'ascent.assay': JSON.stringify({ day: 0, took: 120, said: true }),
    'ascent.ledgerterms': JSON.stringify(['vein', 'surge']),
    'ascent.hand': '1',
    'ascent.learner': JSON.stringify({ name: 'A Planted Cadet', group: 'P3' }),
    // …and two settings that MUST survive, because a start-over is not a
    // factory reset of somebody's machine. If these go, the gate says so.
    'ascent.locale': 'en',
    'ascent.sens': '1.35',
  };
}

// ---------------------------------------------------------------------------
// The play
// ---------------------------------------------------------------------------

/** An init script that makes one key immortal — the planted defect. */
const IMMORTAL = (key) => `(() => {
  const raw = Storage.prototype.removeItem;
  Storage.prototype.removeItem = function (k) { if (k === ${JSON.stringify(key)}) return; return raw.call(this, k); };
})();`;

async function runOnce({ url, browser, plant, immortal = null, shots = null }) {
  const steps = [];
  const errors = [];
  const note = (ok, label, detail = '') => {
    steps.push({ ok, label, detail });
    console.log(`${ok ? '  ok  ' : ' FAIL '} ${label}${detail ? ' — ' + detail : ''}`);
  };
  const ctx = await browser.newContext({ viewport: { width: 1600, height: 900 } });
  if (immortal) await ctx.addInitScript(IMMORTAL(immortal));
  // A gate that dies with a stack trace reports the harness, not the product.
  // Anything that goes wrong below becomes a named failure instead.

  const page = await ctx.newPage();
  page.on('pageerror', (e) => errors.push(e.message));
  page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
  const shot = async (name) => { if (shots) await page.screenshot({ path: path.join(shots, name) }); };

  try {
    // --- a learner who has been here a week ---------------------------------
    await page.goto(`${url}/index.html`, { waitUntil: 'load' });
    await page.evaluate(() => localStorage.clear());
    await page.evaluate((rec) => { for (const [k, v] of Object.entries(rec)) localStorage.setItem(k, v); }, plant.record);
    await page.reload({ waitUntil: 'load' });
    await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60_000 });
    await page.waitForTimeout(6500);

    // --- the record is LIVE, read off the real report with the real key -----
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(1400);
    const before = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.rp-skill')];
      return {
        open: !!rows.length,
        held: rows.filter((r) => r.dataset.state === 'mastered' || r.dataset.state === 'provisional').length,
        rows: rows.length,
        head: document.querySelector('.rp-h-skills')?.textContent || '',
      };
    });
    await shot('01-record-before.png');
    note(before.open, 'the progress report opens on the key it prints', `${before.rows} rows`);
    note(before.held >= 1, 'the planted record is live: the report shows lines held',
      `${before.held} of ${before.rows} held`);
    note(!/\bten\b|diez|Dziesięć/i.test(before.head),
      'the report does not head its list with a hardwired count', `"${before.head}" over ${before.rows} rows`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(900);

    // --- START OVER, through the menu a player uses -------------------------
    await page.keyboard.press('Escape');
    await page.waitForTimeout(1000);
    const menuUp = await page.evaluate(() => !!document.querySelector('#ui .mnu.show'));
    note(menuUp, 'ESC opens the pause menu');
    if (!menuUp) throw new Error('no pause menu, so nothing below it can be measured');

    await page.click('#ui .mnu-restart');
    await page.waitForTimeout(500);
    const confirm = await page.evaluate(() => ({
      text: document.querySelector('#ui .mnu-confirm span')?.textContent || '',
      shown: !document.querySelector('#ui .mnu-confirm')?.hidden,
      yes: document.querySelector('#ui .mnu-yes')?.textContent || '',
    }));
    await shot('02-confirm.png');
    note(confirm.shown && confirm.text.length > 10,
      'START OVER asks once, and states what it is about to throw away', confirm.text);

    const nav = page.waitForNavigation({ waitUntil: 'load', timeout: 45_000 }).catch(() => null);
    await page.click('#ui .mnu-yes');
    await nav;
    await page.waitForFunction(() => !!window.__ascent, null, { timeout: 60_000 });
    await page.waitForTimeout(6500);
    await shot('03-after.png');

    // --- WHAT IS LEFT ON DISK ------------------------------------------------
    const left = await page.evaluate(() => {
      const o = {};
      for (let i = 0; i < localStorage.length; i++) {
        const k = localStorage.key(i);
        o[k] = localStorage.getItem(k);
      }
      return o;
    });
    /* THE TEST IS NOT "IS THE KEY GONE". A fresh install starts writing its own
       record within a second of arriving — the session clock, the teacher
       ledger and the story's first mark are all back on disk before the first
       frame is finished, and they SHOULD be. The question is whether any of it
       is the OLD record. So: a key that still holds byte for byte what was
       planted in it survived; and separately, nothing anywhere in storage may
       still carry a fingerprint of the learner who was wiped. */
    const wantedGone = Object.keys(plant.record).filter((k) => !plant.kept.includes(k));
    const identical = wantedGone.filter((k) => k in left && left[k] === plant.record[k]);
    note(identical.length === 0,
      'NOTHING of the record survives the wipe — no skill state, no run, no sealed rift, no world repair, no rank',
      identical.length
        ? `still on disk, unchanged: ${identical.join(', ')}`
        : `${wantedGone.length} planted keys, none of them still holds what was planted`);

    const blob = Object.entries(left)
      .filter(([k]) => !plant.kept.includes(k))
      .map(([k, v]) => `${k}=${v}`).join('\n');
    const traces = plant.fingerprints.filter((f) => blob.includes(f));
    note(traces.length === 0,
      'and no trace of that learner is left anywhere in storage',
      traces.length ? `found: ${traces.join(', ')}` : `${plant.fingerprints.length} fingerprints, none of them found`);

    const stillThere = wantedGone.filter((k) => k in left);
    const reborn = stillThere.filter((k) => left[k] !== plant.record[k]);
    console.log(`         (${stillThere.length} key(s) written again by the fresh install: ${reborn.join(', ') || 'none'})`);

    const settingsKept = plant.kept.filter((k) => k in plant.record);
    const lostSettings = settingsKept.filter((k) => !(k in left));
    note(lostSettings.length === 0,
      'and a start-over is not a factory reset: the device settings are still there',
      lostSettings.length ? `lost: ${lostSettings.join(', ')}` : settingsKept.join(', '));

    note(!(plant.mark in left), 'the wipe cleans up after itself', plant.mark);

    // --- …AND WHAT THE LEARNER SEES -----------------------------------------
    await page.keyboard.press('KeyP');
    await page.waitForTimeout(1400);
    const after = await page.evaluate(() => {
      const rows = [...document.querySelectorAll('.rp-skill')];
      const by = {};
      for (const r of rows) by[r.dataset.state] = (by[r.dataset.state] || 0) + 1;
      return { rows: rows.length, by };
    });
    await shot('04-report-after.png');
    const standing = ['mastered', 'provisional', 'proving', 'practising', 'withdrawn']
      .filter((k) => after.by[k]);
    note(after.rows > 0 && standing.length === 0,
      'the report a teacher reads shows a learner who has done nothing yet',
      standing.length ? standing.map((k) => `${after.by[k]} ${k}`).join(', ') : `${after.rows} rows, all open or locked`);
    await page.keyboard.press('Escape');
    await page.waitForTimeout(600);

    note(errors.length === 0, 'no console errors across the whole wipe',
      errors.slice(0, 3).join(' | '));
  } catch (e) {
    note(false, 'the wipe could be measured at all', e.message.split('\n')[0]);
  } finally {
    await ctx.close();
  }
  return { steps, errors };
}

// ---------------------------------------------------------------------------
// Standing the build up
// ---------------------------------------------------------------------------
async function withBuild(fn) {
  let url = arg('url', null);
  let out = null; let server = null; let browser = null;
  try {
    if (!url) {
      out = await mkdtemp(path.join(tmpdir(), 'wipegate-'));
      await build({
        root: ROOT, base: './', logLevel: 'error',
        build: { target: 'es2022', outDir: out, emptyOutDir: true, sourcemap: false },
      });
      server = createServer(async (req, res) => {
        const rel = decodeURIComponent(req.url.split('?')[0]).replace(/^\/+/, '') || 'index.html';
        try {
          const body = await readFile(path.join(out, rel));
          res.writeHead(200, { 'content-type': MIME[path.extname(rel)] || 'application/octet-stream' });
          res.end(body);
        } catch { res.writeHead(404); res.end('nope'); }
      });
      const port = await listenFree(server);
      url = `http://127.0.0.1:${port}`;
    }
    browser = await chromium.launch({
      headless: !HEADED,
      args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
    });
    return await fn({ url, browser });
  } finally {
    try { server?.close(); } catch { /* already down */ }
    try { await browser?.close(); } catch { /* already down */ }
    if (out) await rm(out, { recursive: true, force: true });
  }
}

// ---------------------------------------------------------------------------
// Main
// ---------------------------------------------------------------------------
await mkdir(OUT, { recursive: true });
const record = await plantedRecord();
const plant = {
  record: fullRecord(record.mastery),
  kept: [...KEPT],
  prefix: PREFIX,
  mark: WIPE_MARK,
  /* Strings that only the planted learner's record contains. A wipe that
     leaves any of these anywhere in storage did not wipe. They cover every
     part of the promise in turn: the mastery model, the sealed rifts, the
     world repair, the run, the rank and the name on the teacher record. */
  fingerprints: [
    ...record.held.map((id) => `"${id}"`),   // the held lines themselves
    'wg-plaza', 'span-gulf', 'cache-1', 'warden-1',   // world repair
    'errand-1', 'beacon-1', 'station-1', 'charter-1', // the island and the kit
    'planted-record', 'A Planted Cadet',              // the teacher record
    '"sitting":7', '"tears":6',                       // the sitting and the run
  ],
};
console.log(`planted record: ${record.held.length} held line(s) — ${record.held.join(', ')}`);
console.log(`planted keys:   ${Object.keys(plant.record).length}`);

let bad = 0;

if (SELF) {
  console.log('\n--- self-test: the static rule ---------------------------------');
  const keys = await keysInSource();
  const planted = new Map([...keys, ['ascent.somethingnew', 'src/planted/lane.js']]);
  const caught = unclassified(planted, RECORD, [...KEPT], NOT_STORAGE.map(([k]) => k));
  if (!caught.some((x) => x.startsWith('ascent.somethingnew'))) {
    console.error('SELF-TEST FAIL: an unclassified storage key was not caught; the static rule proves nothing');
    bad++;
  } else console.log(`  ok     an unclassified key is caught — ${caught.join(', ')}`);
  const blank = unexplained([...KEPT_KEYS, ['ascent.planted', '']]);
  if (!blank.includes('ascent.planted')) {
    console.error('SELF-TEST FAIL: a surviving key with no written reason was not caught');
    bad++;
  } else console.log('  ok     a key that survives a start-over with no reason written is caught');
  const clean = unclassified(keys, RECORD, [...KEPT], NOT_STORAGE.map(([k]) => k));
  if (clean.length) {
    console.error(`SELF-TEST FAIL: the same rule fires on the honest tree — ${clean.join(', ')}`);
    bad++;
  } else console.log(`  ok     …and stays quiet on the ${keys.size} keys this tree really has`);

  console.log('\n--- self-test: a key that survives the wipe ---------------------');
  console.log('planting an immortal "ascent.waygates" — the sealed-waygate list that really did survive');
  const { steps } = await withBuild(({ url, browser }) => runOnce({ url, browser, plant, immortal: 'ascent.waygates' }));
  const failed = steps.filter((s) => !s.ok);
  const named = failed.some((s) => (s.detail || '').includes('ascent.waygates'));
  if (!failed.length) {
    console.error('SELF-TEST FAIL: a key that survives the wipe was not caught. This gate proves nothing.');
    bad++;
  } else if (!named) {
    console.error('SELF-TEST FAIL: the gate went red but never named the key that survived.');
    bad++;
  } else {
    console.log(`  ok     the gate refuses a surviving key and names it (${failed.length} failure(s))`);
  }
  if (bad) { console.error('\nself-test failed'); process.exit(1); }
  console.log('\nself-test passed');
  // The package script runs `--self-test && <gate>` as two processes, the same
  // shape every other gate here uses. Two vite builds and two browsers in one
  // process is how this timed out on a loaded machine and reported the game.
  process.exit(0);
}

console.log('\n--- the gate ---------------------------------------------------');
const noReason = [...unexplained(KEPT_KEYS), ...unexplained(NOT_STORAGE)];
if (noReason.length) {
  console.log(` FAIL  every key that SURVIVES a start-over says why — no reason given for: ${noReason.join(', ')}`);
} else {
  console.log(`  ok   all ${KEPT_KEYS.length + NOT_STORAGE.length} keys that survive a start-over carry a written reason`);
}
const keys = await keysInSource();
const loose = unclassified(keys, RECORD, [...KEPT], NOT_STORAGE.map(([k]) => k));
if (loose.length) {
  console.log(` FAIL  every storage key in src/ is classified — unclassified: ${loose.join(', ')}`);
} else {
  console.log(`  ok   every one of the ${keys.size} storage keys in src/ is classified as record, setting or not-storage`);
}

const { steps, errors } = await withBuild(({ url, browser }) => runOnce({ url, browser, plant, shots: OUT }));
const failed = steps.filter((s) => !s.ok);
await writeFile(path.join(OUT, 'wipe.json'), JSON.stringify({
  planted: record.held, keys: Object.keys(plant.record), steps, errors, unclassified: loose,
}, null, 2));
console.log(`\n${steps.length - failed.length}/${steps.length} passed  ->  ${OUT}`);
if (failed.length || loose.length) {
  console.log('\nSTART OVER does not clear what its own confirm text promises:');
  failed.forEach((f) => console.log('  - ' + f.label + (f.detail ? ` (${f.detail})` : '')));
  loose.forEach((k) => console.log('  - unclassified storage key: ' + k));
}
/* THE LEDGER OWNS THE EXIT CODE — tools/_findings.mjs. START OVER is a control a learner presses on the shipped build; a byte of
   somebody's record surviving it is in front of them today. */
findings('check:wipe', { scope: 'route' })
  .route(failed.map((f) => `${f.label}${f.detail ? ` (${f.detail})` : ''}`))
  .route(loose.map((k) => `unclassified storage key survives START OVER: ${k}`))
  .route(noReason.map(String))
  .done();
