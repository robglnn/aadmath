#!/usr/bin/env node
/**
 * THE ONE-FRAME GATE — every figure on the screen, at one instant, plus a clock
 * that is watched all the way through and is not allowed to go down.
 *
 *   node tools/critic/oneclock.mjs [--url http://127.0.0.1:5173] [--minutes 20]
 *   node tools/critic/oneclock.mjs --self-test
 *   node tools/critic/oneclock.mjs --locale pl --checkpoints 10
 *
 * Exit 0 = across a real driven session, no two surfaces ever described the
 * same fact differently in the same frame, the session clock never once ran
 * backwards and never parted from the wall, and the rank ladder never
 * contradicted itself. Exit 1 = at least one of those happened, with the frame
 * it happened in written out.
 *
 * ===========================================================================
 * WHY THIS EXISTS WHEN oneprogress.mjs ALREADY DOES
 *
 * Two dedicated passes were asked to fix this class of defect and did not. Both
 * of them left `oneprogress.mjs` green. It is a good gate and it is still here;
 * what it could not see is the shape of what a third cold critic reported:
 *
 *   "the session clock runs backwards. Progress Report read 4 min, then 7 min,
 *    then 9 min, then **1 min**, then 5 min. Real elapsed at the '1 min'
 *    reading was ~25 minutes. At the same instant the panel said 5 min, the
 *    Learner Record said 'TIME ON TASK 7 min'."
 *
 *   "030-progress2.png reads '22% WORLD REPAIRED'. Seconds later, with no
 *    action taken, 031-hud-after.png reads 'WORLD REPAIRED 10%'."
 *
 * Three holes, and every one of them is a hole in *what was sampled*, not in
 * what was asserted:
 *
 *   1. NO CLOCK WAS EVER A FIGURE. Every rule in the register applied to
 *      counts. A duration was not declared, so nothing compared one duration to
 *      another, to the wall, or to itself a minute later. A number that no gate
 *      has an opinion about is a number that can do anything, and this one did.
 *
 *   2. TWO SCREENSHOTS ARE NOT ONE FRAME. The evidence for the 22-vs-10 finding
 *      is two files taken seconds apart, and *that is the only way it could have
 *      been caught*, because the report is a scrim over the rig: at the instant
 *      the report says 22 the rig is behind it, still painted, still saying 10,
 *      and a check that only reads what is topmost reads one of them. This gate
 *      samples every element that is PAINTED, occluded or not, in a single
 *      `evaluate` — one frame, one lock, both numbers.
 *
 *   3. A DEFECT THAT NEEDS TWENTY MINUTES WAS NEVER GIVEN TWENTY MINUTES. The
 *      old session clock reset after ten minutes with no ANSWER. Every harness
 *      in this directory answers questions as fast as it can walk to them, so
 *      no harness in this directory had ever gone ten minutes without one, so
 *      the reset was unreachable by every check that existed. This gate plays
 *      for twenty minutes and spends part of that time doing what the critic
 *      did: walking, building, standing still and reading.
 *
 * ===========================================================================
 * WHAT IT ASSERTS
 *
 *   FRAME   ONE FACT, ONE VALUE, IN ONE FRAME. Every painted element declaring
 *           the same fact id declares the same value — across the rig, the
 *           report, the dossier and the résumé, occlusion ignored.
 *   TRUTH   THE GLASS AGREES WITH THE ENGINE, EXACTLY. The progress figure is
 *           compared with `repaired()` re-derived inside the page with no
 *           slack at all. The old gate allowed a point of it for the count-up
 *           animation; P0's rule is that an animating number must never be the
 *           number anybody reads, so the tween may no longer buy tolerance.
 *   TEXT    THE DECLARATION AGREES WITH THE WORDS. `data-fig-v` is checked
 *           against the digits actually printed inside the element, so a
 *           correct tag over stale text cannot pass.
 *   MONO    THE SESSION CLOCK NEVER DECREASES. Sampled every two seconds for
 *           the whole session, roughly six hundred times, and one decrease of
 *           one second fails the build.
 *   WALL    THE SESSION CLOCK IS THE WALL CLOCK. Checked at every checkpoint
 *           against real elapsed time since the page was loaded.
 *   ORDER   TIME ON TASK NEVER EXCEEDS THE SITTING IT WAS DONE IN, and the two
 *           are never printed under the same words.
 *   LADDER  THE RANK LADDER IS COHERENT. No rung may print "{have} of {need}"
 *           with have >= need; the rung a cadet stands on and the rung above it
 *           must agree about what the rung above it costs.
 *   EMPTY   NO LABELLED READOUT WITH NOTHING IN IT. A bar with a name over it
 *           and neither a number nor a fill is a bug wearing a caption.
 *
 * HOW IT PLAYS. Real keys, real mouse, cleared save — the discipline
 * `coldplay.mjs` and `realsession.mjs` are built on. `window.__ascent` is read
 * for exactly three things, all of them facts read back rather than anything
 * made to happen: which rift to walk toward, what the expected answer is so the
 * script knows which real key to press, and the learner model to check the
 * screen against. Nothing is proved through it.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/oneclock'));
const MINUTES = Number(arg('minutes', 20));
const CHECKPOINTS = Number(arg('checkpoints', 10));
const LOCALE = arg('locale', 'en');
const VW = Number(arg('vw', 1600));
const VH = Number(arg('vh', 900));
const HEADED = process.argv.includes('--headed');
const SELFTEST = process.argv.includes('--self-test');

/**
 * THE REGISTER, MIRRORED — second copy on purpose, same as `oneprogress.mjs`.
 * A gate that reads its rules out of the file it audits can only prove that
 * file agrees with itself. If somebody adds a fact to the game and not to this
 * list, this gate fails and a person has to look at both.
 */
const FACTS = {
  'world.repaired': { role: 'progress', unit: 'percent' },
  'run.target': { role: 'plan', unit: 'rifts' },
  'run.sealed': { role: 'plan', unit: 'rifts' },
  'run.items': { role: 'plan', unit: 'questions' },
  'lines.held': { role: 'evidence', unit: 'lines' },
  'all.sealed': { role: 'evidence', unit: 'rifts' },
  'all.items': { role: 'evidence', unit: 'questions' },
  'nights.held': { role: 'evidence', unit: 'nights' },
  'wallet.motes': { role: 'aside', unit: 'motes' },
  'build.pieces': { role: 'aside', unit: 'pieces' },
  'price.kit': { role: 'aside', unit: 'price' },
  'objective.metres': { role: 'aside', unit: 'metres' },
  'ordinal.run': { role: 'aside', unit: 'ordinal' },
  'ordinal.chapter': { role: 'aside', unit: 'ordinal' },
  'ordinal.chapterNext': { role: 'aside', unit: 'ordinal' },
  'ordinal.rift': { role: 'aside', unit: 'ordinal' },
  'time.elapsed': { role: 'aside', unit: 'time' },
  'rank.standing': { role: 'aside', unit: 'standing' },
  'session.elapsed': { role: 'aside', unit: 'time' },
  'task.time': { role: 'evidence', unit: 'time' },
};

/** The one fact that answers "how am I doing". */
const PROGRESS = 'world.repaired';
/** The one clock. */
const CLOCK = 'session.elapsed';

/**
 * A CAPTION THAT CLAIMS A TALLY, in the three languages this game ships in.
 * Deliberately narrow: it wants "rifts sealed in all", "lines held", "questions
 * answered in all" — a counted noun with a SCOPE on it — and not "through this
 * chapter" or a rank name. The scope word is what turns a label into a claim
 * about a number.
 */
const COUNT_CAPTION = new RegExp(
  '\\b(rifts?|lines?|questions?|nights?|seals?'
  + '|grietas?|l[ií]neas?|preguntas?|noches?|sellos?'
  + '|wyrw\\w*|lini[ei]|pyta\\w*|noc\\w*)\\b[\\s\\w]*'
  + '\\b(in all|sealed|held|answered|total|en total|selladas?|sostenid\\w*|respondidas?'
  + '|łącznie|zamkni[ęe]t\\w*|utrzyman\\w*)\\b', 'i');

/**
 * FACTS THAT ARE A LIVE QUANTITY RATHER THAN A COUNT.
 *
 * The two clocks are declared in SECONDS — the finest unit any surface prints,
 * so every surface can be checked in one — and drawn in whatever reads best,
 * "11 sec" under a minute and "18 min" over it. Two surfaces sampled a frame
 * apart, or a figure rounded to minutes beside one rounded to seconds, may
 * legitimately differ by up to a minute. Every COUNT in this game is exact and
 * gets no slack at all.
 */
const CLOCK_SLACK_S = 60;
const SLACK = { 'session.elapsed': CLOCK_SLACK_S, 'task.time': CLOCK_SLACK_S };

/**
 * FACTS THAT ARE ALLOWED TO MOVE BETWEEN TWO FRAMES OF ONE CHECKPOINT.
 *
 * The cross-frame rule exists for facts about the LEARNER, which cannot change
 * without the learner doing something and which the harness does nothing to
 * between pressing J and pressing P. A distance to a waypoint is a fact about
 * where the boots are, and the boots keep sliding down a slope while a card is
 * open — comparing it across two frames measures the physics, not the report.
 * Kept to exactly the facts that are a live reading of the world; every figure
 * about mastery, work or time is still compared across all three.
 */
const CROSS_EXEMPT = new Set(['objective.metres', 'time.elapsed']);

// ---------------------------------------------------------------------------
// THE ONE READ — every painted figure, and every clock, at one instant
// ---------------------------------------------------------------------------
/**
 * Injected as source and rebuilt on the other side, so it is one function
 * rather than a copy living in a string.
 *
 * PAINTED, NOT TOPMOST. `oneprogress.mjs` asks what a player can see, which is
 * the right question for "how many numbers are on the glass" and the wrong one
 * for "do two surfaces disagree" — because the two surfaces that disagreed were
 * one in front of the other. An element is sampled here if the browser is
 * drawing it at all: it has a box, it is not `display:none`, not
 * `visibility:hidden` and not transparent. Whether the report is sitting on top
 * of the rig is exactly what makes this catchable.
 */
const SNAPSHOT = () => {
  const painted = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      if (Number(cs.opacity) < 0.08) return false;
      if (n.hidden) return false;
    }
    return true;
  };
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();

  const els = [...document.querySelectorAll('[data-fig]')].filter(painted);
  const figures = els.map((el, i) => {
    const r = el.getBoundingClientRect();
    const said = norm(el.innerText || el.textContent);
    return {
      i,
      fig: el.dataset.fig,
      role: el.dataset.figRole || '',
      unit: el.dataset.figUnit || '',
      value: el.dataset.figV ?? '',
      text: said.toLowerCase(),
      name: said.toLowerCase().replace(/[\d .,%·—–-]+/g, ' ').replace(/\s+/g, ' ').trim(),
      // Every whole number actually printed inside this element, so a stale
      // string under a fresh declaration can be caught.
      digits: (said.match(/-?\d+/g) || []).map(Number),
      where: `${Math.round(r.left)},${Math.round(r.top)}`,
      // Which surface it is on, for the report table.
      surface: el.closest('.rp-scrim') ? 'report'
        : el.closest('.meta-dossier') ? 'dossier'
          : el.closest('.ses-close') ? 'resume'
            : el.closest('.ses-charter') ? 'orders'
              : el.closest('#rig') || el.closest('.hud-top') ? 'rig'
                : el.closest('.meta-quest') ? 'card' : 'other',
      nested: null,
    };
  });
  for (const f of figures) {
    f.nested = figures.map((o, j) => ((j !== f.i
      && (els[f.i].contains(els[j]) || els[j].contains(els[f.i]))) ? j : -1)).filter((j) => j >= 0);
  }

  /* ---- THE RANK LADDER, read as data ---------------------------------- */
  const rungs = [...document.querySelectorAll('.dos-ladder .rung')].filter(painted).map((el) => ({
    i: Number(el.dataset.rung),
    here: el.classList.contains('here'),
    done: el.classList.contains('done'),
    have: el.dataset.rungHave === '' || el.dataset.rungHave == null ? null : Number(el.dataset.rungHave),
    need: el.dataset.rungNeed === '' || el.dataset.rungNeed == null ? null : Number(el.dataset.rungNeed),
    nights: el.dataset.rungNights === '' || el.dataset.rungNights == null ? null : Number(el.dataset.rungNights),
    gate: el.dataset.rungGate || '',
    text: norm(el.innerText || el.textContent),
  }));

  /* ---- LABELLED READOUTS WITH NOTHING IN THEM -------------------------- */
  /* A caption over a bar, on the live glass. If neither the caption nor the
     line under it carries a figure AND the bar is drawn at zero, the learner is
     looking at a name with nothing behind it — which is what "a 'RIFTS SEALED
     IN ALL' label whose bar is empty and whose number is missing" is. */
  const meters = [];
  for (const sel of ['.meta-quest .qseal', '.meta-quest .qrung']) {
    for (const el of document.querySelectorAll(sel)) {
      if (!painted(el)) continue;
      const fill = el.querySelector('b');
      const w = fill ? parseFloat(getComputedStyle(fill).width) : 0;
      const track = fill?.parentElement ? parseFloat(getComputedStyle(fill.parentElement).width) : 0;
      meters.push({
        sel,
        label: norm(el.querySelector('.qs-lab, .qr-now')?.textContent),
        under: norm(el.querySelector('.qs-next, .qr-next')?.textContent),
        frac: track > 0 ? +(w / track).toFixed(3) : 0,
        hasFigure: !!el.querySelector('[data-fig]'),
      });
    }
  }

  /* ---- the engine, as an independent witness --------------------------- */
  const a = window.__ascent;
  let model = null;
  try {
    const m = a?.mastery;
    const nodes = m?.graph?.nodes || [];
    let credit = 0;
    let held = 0;
    for (const nd of nodes) {
      const s = m.get(nd.id);
      const p0 = Number(nd?.bkt?.pInit);
      const base = Number.isFinite(p0) ? p0 : 0.25;
      const pL = Number(s?.pL) || 0;
      const earned = base >= 0.999 ? 1 : Math.max(0, Math.min(1, (pL - base) / (1 - base)));
      credit += s?.mastered ? 1 : earned;
      if (s?.mastered) held++;
    }
    model = {
      repaired: nodes.length ? Math.round((credit / nodes.length) * 100) : 0,
      linesHeld: held,
      allSealed: a?.story?.state?.()?.tears ?? null,
      allItems: a?.report?.tracker?.items?.() ?? null,
      sessionMs: a?.report?.tracker?.sessionMs?.() ?? null,
      taskMs: a?.report?.tracker?.totalMs?.() ?? null,
    };
  } catch { /* the screen is the subject */ }

  return { at: Date.now(), figures, rungs, meters, model };
};

// ---------------------------------------------------------------------------
// The assertions — pure, so they can be self-tested without a browser
// ---------------------------------------------------------------------------
/**
 * @param {object} snap one instant of the screen
 * @param {string} label which checkpoint
 * @param {{wallMs?:number}} ctx what the world outside the page knows
 */
export function assess(snap, label, ctx = {}) {
  const fails = [];
  const add = (rule, why) => fails.push({ rule, label, why });

  const byId = new Map();
  for (const f of snap.figures || []) {
    if (!byId.has(f.fig)) byId.set(f.fig, []);
    byId.get(f.fig).push(f);
  }

  // ---- FRAME. One fact, one value, in one frame --------------------------
  for (const [id, list] of byId) {
    if (!FACTS[id]) {
      add('FRAME', `"${id}" is painted and is not in the register — a figure nobody `
        + 'argued for is how this class of defect survives a pass');
      continue;
    }
    const slack = SLACK[id] ?? 0;
    for (const a of list) {
      for (const b of list) {
        if (a.i >= b.i) continue;
        const av = Number(a.value);
        const bv = Number(b.value);
        const differ = Number.isFinite(av) && Number.isFinite(bv)
          ? Math.abs(av - bv) > slack
          : String(a.value) !== String(b.value);
        if (!differ) continue;
        add('FRAME', `"${id}" is on the glass twice in one frame with two values: `
          + `${a.value} on the ${a.surface} at ${a.where} ("${a.text}") and `
          + `${b.value} on the ${b.surface} at ${b.where} ("${b.text}"). `
          + 'Every surface reads the same value at the same instant, or none of them is trusted.');
      }
    }
  }

  // ---- TEXT. The declaration agrees with the words -----------------------
  for (const f of snap.figures || []) {
    const v = Number(f.value);
    if (!Number.isFinite(v) || !f.digits || !f.digits.length) continue;
    /* A readout may legitimately carry more than one numeral ("2 of 16"); the
       one it declares has to be among them. A DURATION is declared in seconds
       and printed in seconds, minutes or hours-and-minutes depending on how big
       it is, so all three readings of the declared value are accepted — and
       nothing else is, which is what keeps a stale string under a fresh tag
       catchable. */
    const wants = FACTS[f.fig]?.unit === 'time'
      ? [v, Math.round(v / 60), Math.floor(v / 60), Math.floor(v / 3600), Math.round(v / 60) % 60]
      : [v];
    const slack = FACTS[f.fig]?.unit === 'time' ? 1 : 0;
    if (!f.digits.some((d) => wants.some((w) => Math.abs(d - w) <= slack))) {
      add('TEXT', `"${f.fig}" declares ${f.value} and the glass reads "${f.text}" `
        + `(${f.surface} at ${f.where}). A correct tag over stale words is stale words.`);
    }
  }

  // ---- TRUTH. The glass agrees with the engine, exactly ------------------
  const m = snap.model;
  if (m) {
    const check = (id, want, name, slack = 0) => {
      if (want == null) return;
      for (const f of byId.get(id) || []) {
        if (Math.abs(Number(f.value) - Number(want)) > slack) {
          add('TRUTH', `${name}: the ${f.surface} says ${f.value} at ${f.where} ("${f.text}") `
            + `and the engine says ${want}`);
        }
      }
    };
    /* NO SLACK ON THE PROGRESS NUMBER. It used to get a point of it for the
       620 ms count-up. An animating figure is not allowed to be the figure
       anybody reads, so there is nothing left for the slack to cover. */
    check(PROGRESS, m.repaired, 'world repaired');
    check('lines.held', m.linesHeld, 'lines held');
    check('all.sealed', m.allSealed, 'rifts sealed in all');
    check('all.items', m.allItems, 'questions answered in all');
    if (m.sessionMs != null) check(CLOCK, Math.round(m.sessionMs / 1000), 'this session', CLOCK_SLACK_S);
    if (m.taskMs != null) check('task.time', Math.round(m.taskMs / 1000), 'time on task in all', CLOCK_SLACK_S);
  }

  // ---- ORDER. Work done cannot exceed the sitting it was done in ---------
  if (m && m.sessionMs != null && m.taskMs != null && m.taskMs > m.sessionMs + 60_000) {
    add('ORDER', `time on task (${mins(m.taskMs)}) is longer than the session it was `
      + `measured inside (${mins(m.sessionMs)}) — two clocks, and one of them is wrong`);
  }
  // …and they are never printed under the same words.
  for (const a of snap.figures || []) {
    for (const b of snap.figures || []) {
      if (a.i >= b.i || a.fig === b.fig) continue;
      if (!a.name || a.name !== b.name) continue;
      if ((a.nested || []).includes(b.i)) continue;
      add('ORDER', `two different facts are printed under the same words "${a.name}": `
        + `${a.fig}=${a.value} (${a.surface}) and ${b.fig}=${b.value} (${b.surface})`);
    }
  }

  // ---- WALL. The session clock is the wall clock -------------------------
  if (ctx.wallMs != null && m?.sessionMs != null) {
    const tol = Math.max(90_000, ctx.wallMs * 0.15);
    if (Math.abs(m.sessionMs - ctx.wallMs) > tol) {
      add('WALL', `the session clock reads ${mins(m.sessionMs)} at real elapsed `
        + `${mins(ctx.wallMs)} (tolerance ${mins(tol)}). A learner checks this against `
        + 'the clock on the wall, and a teacher files it.');
    }
  }

  // ---- LADDER. The climb agrees with itself ------------------------------
  const rungs = snap.rungs || [];
  for (const r of rungs) {
    if (r.here && r.have != null && r.need != null && r.have >= r.need) {
      add('LADDER', `the rung the cadet is standing on reads "${r.text}" — ${r.have} of `
        + `${r.need}. A ladder that says you have more than the next rung costs and `
        + 'still has you below it is a ladder a fifteen-year-old calls broken.');
    }
    if (r.here && r.gate === 'standing' && r.need == null && r.have != null) {
      add('LADDER', `the current rung claims a standing gate and states no threshold: "${r.text}"`);
    }
  }
  const here = rungs.find((r) => r.here);
  const above = here ? rungs.find((r) => r.i === here.i + 1) : null;
  if (here && above && here.gate === 'standing' && here.need != null && above.need != null
      && here.need !== above.need) {
    add('LADDER', `the rung you are on says the next one opens at ${here.need} and the next `
      + `one says it opens at ${above.need}`);
  }
  if (here && above && here.gate === 'nights' && !(above.nights > 0)) {
    add('LADDER', `"${here.text}" says the next rank waits on nights held, and the rank above `
      + `it — "${above.text}" — does not mention a night`);
  }

  // ---- EMPTY. No labelled readout with nothing in it ---------------------
  for (const me of snap.meters || []) {
    if (!me.label) continue;
    if (!(me.frac > 0.005) && !me.hasFigure && !me.under) {
      add('EMPTY', `"${me.label}" (${me.sel}) is a caption over a bar drawn at zero with no `
        + 'figure and no line under it. Fill it or take it off the glass.');
    }
    /* A CAPTION THAT NAMES A TALLY MUST CARRY ONE.
       This is the half the fill test cannot reach, and it is the half that
       actually happened: "RIFTS SEALED IN ALL" survived a pass that deleted its
       numeral, so the words went on claiming a lifetime count over a bar that
       measures progress through the current chapter and empties itself every
       few minutes. The bar had a line under it, so it was never "empty" — it
       was MISLABELLED, which reads to a learner as broken and to a gate as
       fine. A caption may name a tally only if the row prints one. */
    if (COUNT_CAPTION.test(me.label) && !me.hasFigure) {
      add('EMPTY', `"${me.label}" (${me.sel}) names a tally and the row carries no figure. `
        + 'A count in the words with no count on the glass is a claim the learner cannot '
        + 'check — name the thing the bar actually draws, or print the number.');
    }
  }

  return fails;
}

/**
 * THE CLOCK, WATCHED. Pure, so the self-test can prove it fires.
 * @param {{at:number, ms:number, wallMs:number}[]} samples in the order taken
 */
export function assessClock(samples) {
  const fails = [];
  const add = (rule, why) => fails.push({ rule, label: 'clock', why });
  let peak = -Infinity;
  let peakAt = null;
  for (const s of samples) {
    /* ONE SECOND OF TOLERANCE AND NOT A MILLISECOND MORE. It is here only
       because the sampler reads a live accumulator over a wire and two reads
       can cross a write; a real reset is measured in minutes. 4 → 7 → 9 → 1 is
       a fall of eight minutes and would fail four hundred times over. */
    if (peak > -Infinity && s.ms < peak - 1000) {
      add('MONO', `the session clock went backwards: ${mins(peak)} at `
        + `${mins(peakAt)} of real time, then ${mins(s.ms)} at ${mins(s.wallMs)}. `
        + 'Session time only ever increases.');
    }
    if (s.ms > peak) { peak = s.ms; peakAt = s.wallMs; }
  }
  const last = samples[samples.length - 1];
  if (last && last.wallMs > 5 * 60_000) {
    const tol = Math.max(90_000, last.wallMs * 0.15);
    if (last.ms < last.wallMs - tol) {
      add('WALL', `after ${mins(last.wallMs)} of real play the session clock reads only `
        + `${mins(last.ms)} — a session clock that is not the session's length`);
    }
  }
  return fails;
}

const mins = (ms) => (ms == null ? 'n/a' : `${Math.floor(ms / 60000)}m${String(Math.round((ms % 60000) / 1000)).padStart(2, '0')}s`);

// ---------------------------------------------------------------------------
// Self-test: an assertion nobody has watched fail is an assertion nobody knows
// works. The gate this supplements ran green through two dedicated passes.
// ---------------------------------------------------------------------------
function selfTest() {
  const fig = (o) => ({
    i: 0, nested: [], role: FACTS[o.fig]?.role || '', unit: FACTS[o.fig]?.unit || '',
    text: '', name: '', where: '0,0', surface: 'rig', value: '', digits: [], ...o,
  });
  const blank = { figures: [], rungs: [], meters: [], model: null };
  const ok = (fs) => fs.length === 0;

  const cases = [
    {
      name: 'FRAME — the report says 22% and the rig behind it says 10%',
      run: () => assess({ ...blank, figures: [
        fig({ i: 0, fig: 'world.repaired', value: '10', text: '10%', digits: [10], surface: 'rig' }),
        fig({ i: 1, fig: 'world.repaired', value: '22', text: '22% world repaired', digits: [22], surface: 'report' }),
      ] }, 'x'),
      rule: 'FRAME',
    },
    {
      name: 'TEXT — the tag was updated and the words were not',
      run: () => assess({ ...blank, figures: [
        fig({ fig: 'world.repaired', value: '22', text: '10%', digits: [10] }),
      ] }, 'x'),
      rule: 'TEXT',
    },
    {
      name: 'TRUTH — the glass is one point off the engine (no slack any more)',
      run: () => assess({ ...blank,
        figures: [fig({ fig: 'world.repaired', value: '21', text: '21%', digits: [21] })],
        model: { repaired: 22, linesHeld: 0, allSealed: null, allItems: null, sessionMs: null, taskMs: null } }, 'x'),
      rule: 'TRUTH',
    },
    {
      name: 'ORDER — time on task is longer than the session it happened in',
      run: () => assess({ ...blank,
        model: { repaired: 0, linesHeld: 0, allSealed: null, allItems: null, sessionMs: 5 * 60_000, taskMs: 7 * 60_000 } }, 'x'),
      rule: 'ORDER',
    },
    {
      name: 'ORDER — two clocks printed under one name',
      run: () => assess({ ...blank, figures: [
        fig({ i: 0, fig: 'session.elapsed', value: '300', text: '5 min time on task', name: 'min time on task', digits: [5], surface: 'report' }),
        fig({ i: 1, fig: 'task.time', value: '420', text: '7 min time on task', name: 'min time on task', digits: [7], surface: 'report' }),
      ] }, 'x'),
      rule: 'ORDER',
    },
    {
      name: 'WALL — the panel says 1 min at twenty-five real minutes',
      run: () => assess({ ...blank,
        model: { repaired: 0, linesHeld: 0, allSealed: null, allItems: null, sessionMs: 60_000, taskMs: 0 } },
      'x', { wallMs: 25 * 60_000 }),
      rule: 'WALL',
    },
    {
      name: 'LADDER — "You are here · 50 of 30"',
      run: () => assess({ ...blank, rungs: [
        { i: 1, here: true, done: false, have: 50, need: 30, nights: null, gate: 'standing', text: 'BRONZE You are here · 50 of 30' },
        { i: 2, here: false, done: false, have: null, need: 30, nights: null, gate: '', text: 'SILVER Opens at 30' },
      ] }, 'x'),
      rule: 'LADDER',
    },
    {
      name: 'LADDER — the two rows disagree about what the next rank costs',
      run: () => assess({ ...blank, rungs: [
        { i: 1, here: true, done: false, have: 20, need: 30, nights: null, gate: 'standing', text: 'BRONZE · 20 of 30' },
        { i: 2, here: false, done: false, have: null, need: 44, nights: null, gate: '', text: 'SILVER opens at 44' },
      ] }, 'x'),
      rule: 'LADDER',
    },
    {
      name: 'LADDER — the cadet is waiting on a night the rank above never mentions',
      run: () => assess({ ...blank, rungs: [
        { i: 1, here: true, done: false, have: 50, need: null, nights: 1, gate: 'nights', text: 'BRONZE · standing is in, 1 night held to go' },
        { i: 2, here: false, done: false, have: null, need: 30, nights: 0, gate: '', text: 'SILVER opens at 30 standing' },
      ] }, 'x'),
      rule: 'LADDER',
    },
    {
      name: 'EMPTY — "RIFTS SEALED IN ALL" over a bar with no figure in the row',
      run: () => assess({ ...blank, meters: [
        { sel: '.meta-quest .qseal', label: 'RIFTS SEALED IN ALL', under: 'NEXT · CHAPTER 2', frac: 0.4, hasFigure: false },
      ] }, 'x'),
      rule: 'EMPTY',
    },
    {
      name: 'EMPTY — a caption over a bar at zero with no number and no line',
      run: () => assess({ ...blank, meters: [
        { sel: '.meta-quest .qseal', label: 'RIFTS SEALED IN ALL', under: '', frac: 0, hasFigure: false },
      ] }, 'x'),
      rule: 'EMPTY',
    },
    {
      name: 'MONO — 4 → 7 → 9 → 1 → 5 minutes in one sitting',
      run: () => assessClock([
        { ms: 4 * 60_000, wallMs: 4 * 60_000 },
        { ms: 7 * 60_000, wallMs: 7 * 60_000 },
        { ms: 9 * 60_000, wallMs: 9 * 60_000 },
        { ms: 1 * 60_000, wallMs: 25 * 60_000 },
        { ms: 5 * 60_000, wallMs: 29 * 60_000 },
      ]),
      rule: 'MONO',
    },
    {
      name: 'WALL — a clock that only counts the time an item was on screen',
      run: () => assessClock([
        { ms: 60_000, wallMs: 5 * 60_000 },
        { ms: 4 * 60_000, wallMs: 20 * 60_000 },
      ]),
      rule: 'WALL',
    },
    {
      name: 'a clock that just runs (must PASS)',
      run: () => assessClock(Array.from({ length: 40 }, (_, i) => ({ ms: i * 30_000, wallMs: i * 30_000 }))),
      rule: null,
    },
    {
      name: 'the report over the rig, both agreeing (must PASS)',
      run: () => assess({ ...blank,
        figures: [
          fig({ i: 0, fig: 'world.repaired', value: '22', text: '22%', digits: [22], surface: 'rig' }),
          fig({ i: 1, fig: 'world.repaired', value: '22', text: '22% world repaired', name: '% world repaired', digits: [22], surface: 'report' }),
          fig({ i: 2, fig: 'session.elapsed', value: '1080', text: '18 min this session', name: 'min this session', digits: [18], surface: 'report' }),
          fig({ i: 3, fig: 'task.time', value: '660', text: '11 min time on task in all', name: 'min time on task in all', digits: [11], surface: 'report' }),
        ],
        rungs: [
          { i: 1, here: true, done: false, have: 20, need: 30, nights: null, gate: 'standing', text: 'BRONZE · 20 of 30 standing' },
          { i: 2, here: false, done: false, have: null, need: 30, nights: 1, gate: '', text: 'SILVER opens at 30 standing and 1 night held' },
        ],
        meters: [{ sel: '.meta-quest .qseal', label: 'THROUGH THIS CHAPTER', under: 'NEXT · CHAPTER 3', frac: 0, hasFigure: false }],
        model: { repaired: 22, linesHeld: 1, allSealed: null, allItems: null, sessionMs: 18 * 60_000, taskMs: 11 * 60_000 } },
      'x', { wallMs: 18 * 60_000 }),
      rule: null,
    },
    {
      name: 'a clock rounding across a minute boundary between two surfaces (must PASS)',
      run: () => assess({ ...blank, figures: [
        fig({ i: 0, fig: 'session.elapsed', value: '1109', text: '18 min', digits: [18], surface: 'report' }),
        fig({ i: 1, fig: 'session.elapsed', value: '1140', text: '19 min', digits: [19], surface: 'resume' }),
      ] }, 'x'),
      rule: null,
    },
  ];

  let bad = 0;
  for (const c of cases) {
    const fails = c.run();
    const caught = fails.some((f) => f.rule === c.rule);
    const good = c.rule ? caught : ok(fails);
    console.log(`${good ? '  ok  ' : ' FAIL '} self-test: ${c.name}`);
    if (!good) {
      bad++;
      console.log('        got: ' + (fails.length ? fails.map((f) => f.rule + ': ' + f.why).join(' / ') : '(nothing)'));
    }
  }
  console.log(bad ? `\n${bad} assertion(s) do not do what they say` : '\nevery assertion fires on the frame it exists for');
  return bad ? 1 : 0;
}

if (SELFTEST) process.exit(selfTest());

// ===========================================================================
// The real session
// ===========================================================================
await mkdir(OUT, { recursive: true });
const browser = await chromium.launch({
  headless: !HEADED,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist',
    '--disable-gpu-vsync', '--disable-frame-rate-limit'],
});
const ctx = await browser.newContext({ viewport: { width: VW, height: VH }, deviceScaleFactor: 1 });
const page = await ctx.newPage();

const errors = [];
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

await page.goto(URL, { waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
// A cleared install: this is the starting condition, not progress.
await page.evaluate((l) => { localStorage.clear(); localStorage.setItem('ascent.locale', l); }, LOCALE);
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(2500);

/** THE WALL. Real time since the learner sat down, kept out here in node. */
const T0 = Date.now();
const wall = () => Date.now() - T0;

const fails = [];
const table = [];
const clockSamples = [];

const snapshot = () => page.evaluate(SNAPSHOT);
const shot = (n) => page.screenshot({ path: path.join(OUT, `${n}.png`) }).catch(() => {});

/**
 * THE DENSE CLOCK SAMPLER — a read, not a proof.
 *
 * Every two seconds, for the whole session, whatever else is happening. The
 * screen is the subject everywhere else in this file; here the point is
 * frequency, and no surface in the game prints the clock unless a learner has
 * opened the report. So this reads the value the report would print, six
 * hundred times, and the ten checkpoints below prove that the printed figure is
 * that value.
 */
const sampleClock = async () => {
  try {
    const ms = await page.evaluate(() => window.__ascent?.report?.tracker?.sessionMs?.() ?? null);
    if (ms != null) clockSamples.push({ ms, wallMs: wall() });
  } catch { /* a frame mid-teardown is not evidence */ }
};
const clockTimer = setInterval(sampleClock, 2000);

// ------------------------------------------------------------ real answering
const panelOpen = () => page.evaluate(() => !!window.__ascent.panelInfo?.().open).catch(() => false);
const panelSettled = () => page.evaluate(() => !!window.__ascent.panelInfo?.().settled).catch(() => false);
const uiOpen = () => page.evaluate(() => !!window.__ascent.input.uiOpen).catch(() => false);
const card = async () => {
  const c = await page.evaluate(() => window.__ascent.panelInfo()).catch(() => null);
  return c && c.open ? c : null;
};

/** Get any full-screen beat out of the way with the controls it actually has. */
async function handBack() {
  for (let i = 0; i < 8; i++) {
    if (!(await uiOpen())) return;
    let hit = false;
    for (const sel of ['.sc-go', '.ses-charter button', '.ses-rest button', '.rs-go', '.rf-x', '.rp-x']) {
      const b = await page.$(sel);
      if (b && await b.isVisible().catch(() => false)) { await b.click({ timeout: 3000 }).catch(() => {}); hit = true; break; }
    }
    if (!hit) await page.keyboard.press('Escape');
    await page.waitForTimeout(450);
  }
}

/** Walk toward whatever the game itself is pointing at, on real keys. */
async function walkAndKnock(budgetMs = 40000) {
  const t0 = Date.now();
  await page.keyboard.press('KeyE');
  if (await panelOpen()) return true;
  let held = false;
  const forward = async (on) => {
    if (on === held) return;
    held = on;
    if (on) await page.keyboard.down('KeyW'); else await page.keyboard.up('KeyW');
  };
  const cx = Math.round(VW / 2);
  const cy = Math.round(VH / 2);
  let mx = cx;
  try {
    while (Date.now() - t0 < budgetMs) {
      const w = await page.evaluate(() => {
        const mark = document.querySelector('.gd-mark');
        if (!mark || !mark.classList.contains('show')) return null;
        const r = mark.getBoundingClientRect();
        return { x: r.left + r.width / 2, edge: mark.classList.contains('edge') };
      }).catch(() => null);
      if (w) {
        const off = w.x - cx;
        if (Math.abs(off) > 40 || w.edge) {
          const step = Math.max(-160, Math.min(160, off * (w.edge ? 1.6 : 0.7))) || 120;
          mx = Math.max(4, Math.min(VW - 4, mx + step));
          await page.mouse.move(mx, cy);
          if (mx <= 8 || mx >= VW - 8) mx = cx;
        }
      }
      await forward(true);
      for (let j = 0; j < 4; j++) {
        await page.waitForTimeout(150);
        await page.keyboard.press('KeyE');
        if (await panelOpen()) { await forward(false); return true; }
      }
      if (!w) { mx = mx > cx ? cx - 150 : cx + 150; await page.mouse.move(mx, cy); }
    }
  } finally { await forward(false); }
  return false;
}

/** Answer the open card with real input. */
async function answer(c, wrong) {
  if (c.mode === 'choice') {
    const btns = page.locator('.rf-reading');
    const n = await btns.count();
    if (!n) return false;
    let want = 0;
    for (let i = 0; i < n; i++) {
      const v = await btns.nth(i).getAttribute('data-value');
      if ((String(v) === String(c.answer)) !== wrong) { want = i; break; }
    }
    await btns.nth(want).click({ timeout: 5000 }).catch(() => {});
    return true;
  }
  if (c.mode === 'keypad') {
    let s = String(c.answer ?? '');
    if (wrong) s = /^-?\d+$/.test(s) ? String(Number(s) + 1) : (s + '1');
    if (!s) return false;
    for (const ch of s) {
      if (ch === '-') await page.keyboard.press('Minus');
      else if (ch === '/') await page.keyboard.press('Slash');
      else if (ch === '+') await page.keyboard.press('Equal');
      else if (ch === '^') await page.keyboard.press('Digit6');
      else await page.keyboard.press(ch);
      await page.waitForTimeout(35);
    }
    await page.keyboard.press('Enter');
    return true;
  }
  const any = page.locator('.rf-move, .rf-chip, .rf-bay, .ans').first();
  if (await any.count()) { await any.click({ timeout: 5000 }).catch(() => {}); return true; }
  return false;
}

let items = 0;
/** One stretch of ordinary play: walk to a tear, answer what it serves. */
async function play(ms) {
  const until = Date.now() + ms;
  while (Date.now() < until) {
    if (!(await panelOpen())) {
      if (await uiOpen()) { await handBack(); continue; }
      if (!(await walkAndKnock(Math.min(30000, until - Date.now())))) continue;
    }
    const c = await card();
    if (!c) { await page.waitForTimeout(200); continue; }
    if (c.settled) {
      const t1 = Date.now();
      while ((await panelOpen()) && Date.now() - t1 < 4000) await page.waitForTimeout(200);
      continue;
    }
    items++;
    await answer(c, items % 9 === 0);
    await page.waitForTimeout(850);
    if (await panelOpen()) {
      if (await panelSettled()) {
        const t1 = Date.now();
        while ((await panelOpen()) && Date.now() - t1 < 3600) await page.waitForTimeout(200);
      } else {
        await page.waitForTimeout(600);
        await page.keyboard.press('Escape');
        await page.waitForTimeout(300);
      }
    }
  }
}

/**
 * THE STRETCH THAT NO HARNESS HAD EVER PLAYED.
 *
 * The clock reset the critic caught needed ten unbroken minutes with no answer
 * in them, and every harness in this directory answers as fast as it can walk.
 * So one span of this session is spent the way the critic spent theirs: walking
 * the island, turning, building, and standing still. It is not filler; it is
 * the only input sequence that reaches the defect.
 */
async function wander(ms) {
  const until = Date.now() + ms;
  await handBack();
  while (Date.now() < until) {
    const dir = ['KeyW', 'KeyA', 'KeyS', 'KeyD'][Math.floor(Math.random() * 4)];
    await page.keyboard.down(dir);
    await page.waitForTimeout(700 + Math.random() * 900);
    await page.keyboard.up(dir);
    await page.mouse.move(VW / 2 + (Math.random() - 0.5) * 500, VH / 2);
    // Stand and look, which is a thing players do and no gate had ever done.
    await page.waitForTimeout(1200 + Math.random() * 1800);
    if (await uiOpen()) await handBack();
  }
}

/**
 * One checkpoint: three frames, in the order a player produces them.
 *
 *   BARE     nothing open. The rig alone, checked against the engine. This is
 *            the frame the critic's `031-hud-after.png` was, and it is where a
 *            rig that has gone stale between answers is caught — the FRAME rule
 *            cannot see that on its own, because a stale rig and a stale
 *            *report* would agree with each other perfectly.
 *   DOSSIER  the rank ladder, read as data.
 *   REPORT   every figure the record prints, with the rig still painted behind
 *            the scrim, so the two are compared inside one lock.
 */
async function checkpoint(n, tag) {
  await handBack();
  await page.waitForTimeout(900);
  const bare = await snapshot();
  await shot(`${String(n).padStart(2, '0')}-${tag}-hud`);

  // Two surfaces at once, on purpose: the dossier's ladder and the report's
  // figures, plus the rig painted behind both of them.
  await page.keyboard.press('KeyJ');
  await page.waitForTimeout(700);
  const ladder = await snapshot();
  await shot(`${String(n).padStart(2, '0')}-${tag}-dossier`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  await page.keyboard.press('KeyP');
  await page.waitForTimeout(900);
  const snap = await snapshot();
  await shot(`${String(n).padStart(2, '0')}-${tag}-report`);
  await page.keyboard.press('Escape');
  await page.waitForTimeout(400);

  const wallMs = wall();
  const found = [
    ...assess(bare, tag + '/hud', { wallMs }),
    ...assess(snap, tag, { wallMs }),
    ...assess({ ...ladder, model: null }, tag + '/ladder', {}),
  ];
  /* AND THE THREE FRAMES AGREE WITH EACH OTHER. Nothing was answered between
     them — the harness pressed J, Escape, P, Escape — so any fact that moved
     across them moved without a cause, which is the cross-frame half of the
     defect: a report reading 22% and a rig reading 10% seconds later. */
  const anchor = new Map();
  for (const fr of [bare, ladder, snap]) {
    for (const f of fr.figures || []) {
      if (CROSS_EXEMPT.has(f.fig)) continue;
      const prev = anchor.get(f.fig);
      const slack = SLACK[f.fig] ?? 0;
      if (prev && Math.abs(Number(prev.value) - Number(f.value)) > slack) {
        found.push({ rule: 'FRAME', label: tag + '/across', why:
          `"${f.fig}" read ${prev.value} on the ${prev.surface} and ${f.value} on the `
          + `${f.surface} moments later with nothing answered in between` });
      }
      if (!prev) anchor.set(f.fig, f);
    }
  }
  fails.push(...found);

  const one = (id) => (snap.figures.find((f) => f.fig === id)?.value ?? '—');
  const clockMin = (id) => {
    const v = Number(one(id));
    return Number.isFinite(v) ? `${Math.round(v / 60)} min` : '—';
  };
  const rig = bare.figures.find((f) => f.fig === PROGRESS)
    || snap.figures.find((f) => f.fig === PROGRESS && f.surface === 'rig');
  const rep = snap.figures.find((f) => f.fig === PROGRESS && f.surface === 'report');
  const hereRung = (ladder.rungs || []).find((r) => r.here);
  table.push({
    n,
    at: tag,
    wall: mins(wallMs),
    sessionClock: mins(snap.model?.sessionMs),
    clockPrinted: clockMin(CLOCK),
    taskPrinted: clockMin('task.time'),
    repairedRig: rig ? rig.value + '%' : '—',
    repairedReport: rep ? rep.value + '%' : '—',
    repairedEngine: snap.model ? snap.model.repaired + '%' : '—',
    linesHeld: one('lines.held'),
    riftsAll: one('all.sealed'),
    itemsAll: one('all.items'),
    runSealed: one('run.sealed'),
    runTarget: one('run.target'),
    rung: hereRung ? hereRung.text.replace(/\s+/g, ' ').slice(0, 58) : '—',
    figures: snap.figures.length,
    fails: found.length,
  });
  console.log(`  ${String(n).padStart(2)}  ${mins(wallMs).padEnd(8)} clock ${clockMin(CLOCK).padStart(6)}  `
    + `rig ${String(rig?.value ?? '—').padStart(3)}%  report ${String(rep?.value ?? '—').padStart(3)}%  `
    + `engine ${String(snap.model?.repaired ?? '—').padStart(3)}%  `
    + `${found.length ? 'FAIL ' + found.map((f) => f.rule).join(',') : 'ok'}`);
}

// --------------------------------------------------------------- the session
console.log(`playing ${MINUTES} min at ${VW}x${VH} in ${LOCALE}, ${CHECKPOINTS} checkpoints\n`);
console.log('  #   wall     session      rig      report    engine   verdict');

const totalMs = MINUTES * 60_000;
/* ONE SPAN IS SPENT NOT ANSWERING, AND IT IS ELEVEN MINUTES LONG.
   The clock that ran backwards was reset by TEN MINUTES WITH NO ANSWER — not
   by ten minutes with no learner, which is the distinction the defect turned
   on. Every other harness in this directory answers as fast as it can walk, so
   none of them had ever been inside that window, so none of them could ever
   have caught it. This one crosses it on purpose, in the middle of the session,
   with a run behind it and a run in front of it, doing what the critic did:
   walking, turning, and standing still looking at the sea.

   It is taken OUT of the session's budget rather than added to it, so
   `--minutes 20` is twenty minutes of sitting — the Pomodoro shape the whole
   product is built around — of which eleven are not answering. */
const WANDER_MS = Math.min(11 * 60_000, Math.max(60_000, totalMs * 0.55));
const WANDER_AT = Math.max(1, Math.floor(CHECKPOINTS / 2));
const slice = Math.max(20_000, (totalMs - WANDER_MS) / Math.max(1, CHECKPOINTS - 1));

/* THE EVIDENCE IS WRITTEN EVEN IF THE RUN DIES. Several builders hot-edit this
   tree at once and a preview server can go out from under a twenty-five minute
   session; a harness that throws away nine good checkpoints because the tenth
   lost its page has destroyed the only expensive thing it made. Whatever was
   sampled is reported, and a run that did not finish says so rather than
   passing quietly on a short table. */
let ranAll = true;
try {
  for (let n = 1; n <= CHECKPOINTS; n++) {
    if (n === WANDER_AT) await wander(WANDER_MS); else await play(slice);
    await checkpoint(n, n === WANDER_AT ? 'after-11-min-of-not-answering' : 'playing');
  }
} catch (e) {
  ranAll = false;
  fails.push({ rule: 'RUN', label: 'session', why: `the session did not finish: ${String(e).split('\n')[0]}` });
}

fails.push(...assessClock(clockSamples));
clearInterval(clockTimer);

// ------------------------------------------------------------------ the read
const decreases = [];
{
  let peak = -Infinity;
  for (const s of clockSamples) {
    if (peak > -Infinity && s.ms < peak - 1000) decreases.push({ from: mins(peak), to: mins(s.ms), atWall: mins(s.wallMs) });
    peak = Math.max(peak, s.ms);
  }
}

const out = {
  url: URL, locale: LOCALE, minutes: MINUTES, viewport: `${VW}x${VH}`,
  completed: ranAll,
  itemsAnswered: items,
  clockSamples: clockSamples.length,
  clockDecreases: decreases.length,
  decreases: decreases.slice(0, 10),
  clockFirst: mins(clockSamples[0]?.ms), clockLast: mins(clockSamples[clockSamples.length - 1]?.ms),
  wallLast: mins(wall()),
  consoleErrors: errors.length,
  errors: errors.slice(0, 8),
  checkpoints: table,
  failures: fails,
};
await writeFile(path.join(OUT, 'oneclock.json'), JSON.stringify(out, null, 2));

console.log('\nCHECKPOINT TABLE');
console.table(table);
console.log(`\nclock: ${clockSamples.length} samples, ${decreases.length} decrease(s), `
  + `${out.clockFirst} → ${out.clockLast} across ${out.wallLast} of real time`);
if (errors.length) console.log(`console errors: ${errors.length}\n  ` + errors.slice(0, 5).join('\n  '));

if (fails.length) {
  console.log(`\nFAIL — ${fails.length} contradiction(s):`);
  for (const f of fails.slice(0, 40)) console.log(`  [${f.rule}] ${f.label}: ${f.why}`);
} else {
  console.log('\nPASS — every figure agreed with every other in every frame, and the '
    + 'session clock only ever went forwards.');
}

await browser.close().catch(() => {});
process.exit(fails.length || errors.length ? 1 : 0);
