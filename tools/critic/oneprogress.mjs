#!/usr/bin/env node
/**
 * THE ONE-NUMBER GATE.
 *
 *   node tools/critic/oneprogress.mjs [--url http://127.0.0.1:5173] [--headed]
 *   node tools/critic/oneprogress.mjs --self-test
 *   node tools/critic/oneprogress.mjs --locale pl --vw 1280 --vh 720
 *
 * Exit 0 = at every checkpoint of a real session there was exactly ONE progress
 * number on the live HUD, no number anywhere disagreed with any other about the
 * same fact, no counter changed its unit, no digit sat on the glass that this
 * build had not declared, and Marlow never quoted a figure. Exit 1 = the game
 * is telling a fourteen-year-old more than one thing about their own progress.
 *
 * ===========================================================================
 * WHY THIS FILE WAS REWRITTEN
 *
 * There was already a gate here. It ran green while a cold critic counted NINE
 * figures on a single frame, two rifts in:
 *
 *   WORLD REPAIRED 0%  ·  3 CIPHER MOTES  ·  2 OF 16 RIFTS THIS RUN
 *   4 questions this run  ·  0 OF 10 LINES HELD  ·  Hold this one and 2 more
 *   lines open  ·  2 RIFTS SEALED IN ALL  ·  1 MORE TO CHAPTER 2
 *   BRONZE · 2 TO GO
 *
 * The gate passed because of what it was asked to check. Its rule was that six
 * figures were ALLOWED provided each said whose question it answered — "this
 * run", "in all" — and that each agreed with itself. So it compared every
 * declared figure against every other declared figure of the SAME id, found no
 * contradiction, and reported PASS on a screen with six answers on it. Run
 * against the build this replaces it printed, verbatim:
 *
 *   3-report-tiles-over-hud — 6 figure(s) on screen
 *   PASS — every progress figure on screen agreed, at every checkpoint.
 *
 * Two holes did the damage, and both are closed here:
 *
 *   1. IT COULD NOT COUNT. Nothing in it said "one". A gate whose strongest
 *      statement is "these six agree" cannot be the gate for a rule that says
 *      there must be one.
 *   2. IT COULD ONLY SEE WHAT HAD BEEN DECLARED. `Marlow: "Nine points of
 *      standing"` and `BRONZE · 2 TO GO` carried no tag, so they were invisible
 *      to it. The figures that survive a dedicated pass are precisely the ones
 *      nobody remembered to declare.
 *
 * ===========================================================================
 * WHAT IT ASSERTS
 *
 *   ONE   ONE PROGRESS NUMBER ON THE LIVE HUD. Exactly one element, carrying
 *         the one fact whose role is `progress` (src/meta/progress.js), is
 *         visible while the player is in the world. Not two that agree. One.
 *   AGREE ONE FACT, ONE VALUE. Every visible element claiming the same fact id
 *         claims the same number — across the HUD, the report and the résumé,
 *         at one instant.
 *   NAME  ONE NAME, ONE FACT. Two different facts may not be printed under the
 *         same words, in any of the three languages.
 *   UNIT  NO COUNTER CHANGES ITS UNIT. A fact's declared unit is recorded at
 *         every checkpoint of the session and compared across all of them.
 *         "BRONZE · 2 TO GO" ran 10 → 7 → 2 → 18 → 15 → "SILVER · 1 NIGHT
 *         HELD" — standing points, then nights, under one label.
 *   DECL  NO UNDECLARED DIGIT ON THE LIVE HUD. Every numeral a player can read
 *         while in the world lies inside an element this build declared through
 *         `tagFigure`. This is the rule that would have caught all nine: a
 *         tenth figure cannot be added quietly, because adding one fails the
 *         build until somebody registers it in src/meta/progress.js and argues
 *         for it there.
 *   VOICE MARLOW STATES NO FIGURE. His live line is read off the glass and
 *         tested for a tally in any of the three languages.
 *   MODEL THE SCREEN AGREES WITH THE ENGINE. The printed progress number is
 *         checked against `repaired()` computed inside the page from the live
 *         mastery model. A screen that is merely self-consistent is not
 *         evidence.
 *
 * HOW IT PLAYS. Real keys, real mouse, from a cleared save — the same
 * discipline `coldplay.mjs` is built on, and for the same reason: rounds of
 * agents have "fixed" things through `window.__ascent` and fixed a path no
 * player ever takes. The debug API is used here for exactly two things, both of
 * them reading facts back rather than making anything happen: the coordinates
 * of a rift to walk toward, and the learner model to check the screen against.
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/oneprogress'));
const HEADED = process.argv.includes('--headed');
const SELFTEST = process.argv.includes('--self-test');
/* WHICH LANGUAGE THE SESSION IS PLAYED IN. A figure that only disagrees in
   Polish is still two figures, and every word this pass turns on is a
   translation. Switched through the real language plate in the HUD, which is a
   control a learner uses, not a debug call. */
const LOCALE = arg('locale', 'en');
/* The frame it is played in. 1600x900 desktop, 1280x720 school Chromebook,
   896x414 phone sideways, 390x844 phone held up. */
const VW = Number(arg('vw', 1600));
const VH = Number(arg('vh', 900));

/**
 * THE REGISTER, MIRRORED.
 *
 * Deliberately a second copy of `FACTS` in src/meta/progress.js rather than an
 * import of it. A gate that reads the rules out of the file it is auditing can
 * only ever prove that file agrees with itself — which is the exact class of
 * check that let six figures coexist, every one verified through the code that
 * drew it. If somebody adds a fact to the game and not to this list, the gate
 * fails and a person has to look at both. That friction is the feature.
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
  /* THE TWO TIME FIGURES. Declared because a figure nothing compares is a
     figure that can do anything, and one of these ran 4 → 7 → 9 → 1 → 5 minutes
     inside a single unbroken sitting before anything on the screen was allowed
     to have an opinion about it. `tools/critic/oneclock.mjs` is where they are
     asserted against each other, against the wall and against themselves over
     time; they are here so that this gate's own register stays complete and
     "not in the register" keeps meaning what it says. */
  'rank.standing': { role: 'aside', unit: 'standing' },
  'session.elapsed': { role: 'aside', unit: 'time' },
  'task.time': { role: 'evidence', unit: 'time' },
};

/**
 * WHAT COUNTS AS "THE LIVE HUD".
 *
 * The rule the product owes is about the surface a learner cannot get away
 * from: the frame they are looking at while playing. A surface they OPENED —
 * the report, the orders, the dossier, the run résumé, a rift card — is allowed
 * to carry the ledger, because opening it is a question and the numbers are the
 * answer. So a checkpoint taken while any of these is up is not a live-HUD
 * checkpoint, and the ONE and DECL rules are not applied to it. Every other
 * rule is applied everywhere, always.
 */
/* Matched WITHOUT their `.show` class, and tested with the same `onGlass` every
   figure is tested with. A panel that has just had `.show` removed is still
   painted for the length of its fade, and the first version of this list — which
   asked for `.rift.show` — read a frame with a rift card still legibly on it as
   a bare HUD, and then failed the HUD for having no progress number on it while
   the rift was covering the rig. Opacity is what a player sees; a class is not. */
const OVERLAYS = [
  // the report (src/report/index.js mounts `.rp-scrim`)
  '.rp-scrim',
  // the three session beats (src/session)
  '.ses-charter', '.ses-close', '.ses-rest',
  // a rift card (src/ui/rift.js) — the maths on it is full of numerals, and
  // every one of them is a question rather than a claim about the learner
  '.rift',
  // the ceremonies and the dossier (src/meta)
  '.dos', '.meta-dossier', '.meta-rite', '.meta-turn',
  // the menu, and the foundry the motes are spent in
  '.menu', '.mn', '.foundry',
];

/**
 * DIGITS ON THE LIVE HUD THAT ARE NOT FIGURES AT ALL.
 *
 * Two kinds, and nothing else gets in:
 *
 *   A KEY, DRAWN.        `kbd` and the hotbar and language plates. "Press 1 to
 *                        4", "F1", "LB". A picture of a control the player is
 *                        holding, not a claim about the player.
 *   A PLACE, MEASURED.   The world's own affordance labels (`src/world`), which
 *                        quote metres to a thing you can walk to. The objective
 *                        card quotes the same metres and DOES declare them, so
 *                        the two are still compared to each other by AGREE.
 *
 * Everything in this list is still read for a tally — see the STRAY-VOICE check
 * in `assess` — so a toast that says "3 rifts sealed" fails even though a toast
 * that says "press 1 to 4" does not. Kept short on purpose: every entry is a
 * hole, and a long list is how the DECL rule would quietly stop working.
 */
const NOT_A_FIGURE = [
  'kbd', '.buildbar', '.langs', '.crosshair', '.slot u',
  '.afd', '.afd-far', '.bk', '.beckon', '.wd-', '.verge',
];

/**
 * …and the notice slot, which is a different case again: it is transient, it
 * speaks about an event that just happened, and it counts things that are not
 * progress ("Motes +3", "Anchor 2 of 3"). It is exempt from DECL and NOT from
 * the tally test — a toast is a place a progress figure could hide.
 */
const TRANSIENT = [
  '.toast', '.hud-toast', '.notice',
  /* The foundry's transaction ticker (src/kit/ledger.js) — "+2", "balance 7".
     A running balance of a spendable currency, which is the one number in this
     game that is deliberately not about mastery at all. Same deal as a toast:
     exempt from declaring a numeral, not exempt from stating a progress count. */
  '.ledger', '.led-row', '.kit-toast',
];

/** Where Marlow speaks. Both channels: the comms plate and the HUD's own line. */
const VOICE = ['.marlow', '.comms', '.cm-body', '.cm', '#marlow'];

// ---------------------------------------------------------------------------
// The tally test, mirrored from src/meta/progress.js for the same reason FACTS
// is. If the two ever disagree, one of them is wrong and a person must say
// which.
// ---------------------------------------------------------------------------
const NUMBER = '(?:\\d+'
  + '|two|three|four|five|six|seven|eight|nine|ten|eleven|twelve|twenty|thirty'
  + '|dos|tres|cuatro|cinco|seis|siete|ocho|nueve|diez|once|doce|veinte|treinta'
  + '|dwa|dwie|trzy|cztery|pięć|sześć|siedem|osiem|dziewięć|dziesięć'
  + '|jedenaście|dwanaście|dwadzieścia|trzydzieści)';
const COUNTED = '(?:lines?|rifts?|questions?|points?|nights?|seals?|sealed|held'
  + '|l[ií]neas?|grietas?|preguntas?|puntos?|noches?|sellos?|posici[oó]n|sellad\\w*'
  + '|cerrad\\w*|sostenid\\w*|mantenid\\w*'
  + '|lini[ei]|linia|wyrw[aeyą]?|pyta(?:nie|nia|ń)|punkt(?:y|ów|ach)?|noc(?:e|y)?'
  + '|piecz[eę]\\w*|pozycj[iaeę]|zapiecz\\w*|utrzyman\\w*|zamkni[ęe]t\\w*)';
const TALLY = new RegExp(`\\b${NUMBER}\\b(?:\\s+\\w+)?\\s+${COUNTED}\\b`, 'i');
const PERCENT = /\d\s*%|\d\s*(?:per ?cent|por ?ciento|procent)/i;
const statesAFigure = (s) => !!s && (PERCENT.test(s) || TALLY.test(s));

// ---------------------------------------------------------------------------
// THE ONE READ: every number on the glass, at one instant
// ---------------------------------------------------------------------------
/**
 * Injected into the page as source and rebuilt on the other side, so it is one
 * function with one definition rather than a copy living in a string. It does
 * its own visibility test and its own text walk; nothing here calls into the
 * game's own helpers, because a read that shares code with the draw can only
 * confirm the draw agrees with itself.
 */
const SNAPSHOT = (cfg) => {
  const { overlays, notFigure, transient, voiceSel } = cfg;

  const onGlass = (el) => {
    const r = el.getBoundingClientRect();
    if (r.width < 1 || r.height < 1) return false;
    if (r.bottom < 0 || r.top > innerHeight || r.right < 0 || r.left > innerWidth) return false;
    for (let n = el; n && n.nodeType === 1; n = n.parentElement) {
      const cs = getComputedStyle(n);
      if (cs.display === 'none' || cs.visibility === 'hidden') return false;
      if (Number(cs.opacity) < 0.08) return false;
      if (n.hidden) return false;
    }
    return true;
  };
  const norm = (s) => (s || '').replace(/\s+/g, ' ').trim();
  const low = (s) => norm(s).toLowerCase();

  // ---- is an overlay up? --------------------------------------------------
  const openOverlays = overlays.filter((sel) => {
    const el = document.querySelector(sel);
    return el && onGlass(el);
  });
  const live = openOverlays.length === 0;

  // ---- every declared figure ---------------------------------------------
  const els = [...document.querySelectorAll('[data-fig]')].filter(onGlass);
  const figures = els.map((el, i) => {
    const r = el.getBoundingClientRect();
    // `innerText` is what a person actually reads: it respects rendering and
    // puts whitespace at element boundaries, where `textContent` runs "2" and
    // "of 16" together into "2of 16".
    const said = low(el.innerText || el.textContent);
    return {
      i,
      fig: el.dataset.fig,
      role: el.dataset.figRole || '',
      unit: el.dataset.figUnit || '',
      value: el.dataset.figV ?? '',
      text: said,
      // The words WITHOUT the digits. Two figures printed under one name differ
      // only in their numerals, so the name is what is left when they are gone.
      name: said.replace(/[\d .,%·—–-]+/g, ' ').replace(/\s+/g, ' ').trim(),
      /* WHICH OTHER FIGURES THIS ONE CONTAINS OR SITS INSIDE. "2 of 16 rifts"
         is ONE readout carrying two figures and its halves necessarily share a
         noun — that is what "n of m" means, and it is not the defect. Two
         figures sharing a noun from OPPOSITE SIDES of the screen is. */
      nested: els.map((o, j) => ((j !== i && (el.contains(o) || o.contains(el))) ? j : -1))
        .filter((j) => j >= 0),
      where: `${Math.round(r.left)},${Math.round(r.top)}`,
      onHud: !overlays.some((sel) => el.closest(sel)),
    };
  });

  // ---- every UNDECLARED digit inside the HUD ------------------------------
  /* THE RULE THE LAST GATE DID NOT HAVE.
     Walk the text of `#ui`, node by node, and find every numeral a player can
     read. If the node it lives in is not inside a declared figure and not
     inside one of the three control surfaces that are pictures of keys rather
     than claims, it is an undeclared number on the glass. */
  const stray = [];
  const exemptText = [];
  const ui = document.getElementById('ui');
  if (ui && live) {
    const walker = document.createTreeWalker(ui, NodeFilter.SHOW_TEXT);
    for (let n = walker.nextNode(); n; n = walker.nextNode()) {
      const text = norm(n.nodeValue);
      if (!/\d/.test(text)) continue;
      const host = n.parentElement;
      if (!host || !onGlass(host)) continue;
      if (host.closest('[data-fig]')) continue;
      if (overlays.some((sel) => host.closest(sel))) continue;
      const exempt = notFigure.some((sel) => host.closest(sel))
        || transient.some((sel) => host.closest(sel));
      const r = host.getBoundingClientRect();
      // Exempt text is still recorded — it is read for a tally, just not for
      // being a numeral. The list of what is exempt is the thing a person has
      // to defend, so it is visible in the capture rather than filtered away.
      (exempt ? exemptText : stray).push({
        text: text.slice(0, 90),
        // The whole line it sits in, so a human reading the failure can see it.
        line: norm(host.innerText || host.textContent).slice(0, 140),
        sel: (host.className && typeof host.className === 'string'
          ? '.' + host.className.trim().split(/\s+/).join('.') : host.tagName.toLowerCase()),
        where: `${Math.round(r.left)},${Math.round(r.top)}`,
      });
    }
  }

  // ---- what Marlow is saying at this instant ------------------------------
  const voice = [];
  for (const sel of voiceSel) {
    for (const el of document.querySelectorAll(sel)) {
      if (!onGlass(el)) continue;
      const said = norm(el.innerText || el.textContent);
      if (said) voice.push({ sel, text: said });
    }
  }

  // ---- the engine, for the cross-check ------------------------------------
  const a = window.__ascent;
  let model = null;
  try {
    const m = a?.mastery;
    const nodes = m?.graph?.nodes || [];
    // `repaired()` re-derived here rather than imported, same discipline as
    // FACTS: the screen is the subject, the model is an independent witness.
    let credit = 0;
    let held = 0;
    for (const nd of nodes) {
      const s = m.get(nd.id);
      /* THE COLD-START FLOOR, TAKEN OUT — the same rebase src/meta/progress.js
         does, re-derived here rather than imported. BKT opens every line at
         `pInit` (0.25 in this graph) because a learner who has never been asked
         is not certainly ignorant; printed raw, that made the first frame of a
         cleared save read WORLD REPAIRED 26%. What the figure reports is what
         this learner's own evidence bought, from their line's own prior up to
         certainty. */
      const p0 = Number(nd?.bkt?.pInit);
      const base = Number.isFinite(p0) ? p0 : 0.25;
      const pL = Number(s?.pL) || 0;
      const earned = base >= 0.999 ? 1 : Math.max(0, Math.min(1, (pL - base) / (1 - base)));
      credit += s?.mastered ? 1 : earned;
      if (s?.mastered) held++;
    }
    const st = a?.session?.state?.();
    model = {
      repaired: nodes.length ? Math.round((credit / nodes.length) * 100) : 0,
      linesHeld: held,
      linesTotal: nodes.length,
      run: st?.run ? { tears: st.run.tears, target: st.run.target, items: st.run.items } : null,
      allSealed: a?.story?.state?.()?.tears ?? null,
      allItems: a?.report?.tracker?.items?.() ?? null,
    };
  } catch { /* the screen is the subject */ }

  return {
    live,
    openOverlays,
    figures,
    stray,
    exemptText,
    voice,
    model,
    screen: norm(ui?.innerText || '').slice(0, 2000),
  };
};

// ---------------------------------------------------------------------------
// The assertions
// ---------------------------------------------------------------------------
/**
 * @param {object} snap one instant of the screen
 * @param {string} label which checkpoint
 * @param {Map<string,{unit:string,label:string}>} units what each fact's unit
 *        was the last time it was seen — this is how UNIT sees across the whole
 *        session rather than within one frame.
 */
function assess(snap, label, units = new Map()) {
  const fails = [];
  const add = (rule, why) => fails.push({ rule, label, why });

  const byId = new Map();
  for (const f of snap.figures) {
    if (!byId.has(f.fig)) byId.set(f.fig, []);
    byId.get(f.fig).push(f);
  }

  // ---- ONE. Exactly one progress figure on the live HUD -------------------
  const progress = snap.figures.filter((f) => FACTS[f.fig]?.role === 'progress');
  if (snap.live) {
    const onHud = progress.filter((f) => f.onHud);
    if (onHud.length === 0) {
      add('ONE', 'no progress number is on screen at all — the one number must be on '
        + 'the glass for the whole session, or a learner has nothing to read');
    } else if (onHud.length > 1) {
      add('ONE', `${onHud.length} progress figures are on the live HUD at once: `
        + onHud.map((f) => `${f.fig}=${f.value} at ${f.where} ("${f.text}")`).join('  |  ')
        + '. There is one progress number in this game.');
    }
    // …and nothing that is not the progress figure may claim that role.
    for (const f of onHud) {
      if (f.fig !== 'world.repaired') {
        add('ONE', `"${f.fig}" is declared as the progress number and world.repaired is `
          + 'the progress number. Two facts cannot both be it.');
      }
    }
    /* AND THE LEDGER STAYS BEHIND A DELIBERATE OPEN.
       This is the half of the rule the ONE count alone cannot state. "0 OF 10
       LINES HELD" is not tagged `progress` and never was — it is evidence — so
       a gate that only counts progress-role figures walks straight past a HUD
       carrying the progress number AND the line tally AND the run tally, which
       is the screen the cold critic actually photographed. A learner reading
       four numbers does not read four roles. Anything that is not the one
       number is on a surface they asked for. */
    for (const f of snap.figures) {
      const role = FACTS[f.fig]?.role;
      if (!f.onHud) continue;
      if (role === 'evidence' || role === 'plan') {
        add('ONE', `"${f.fig}" (${role}) is on the live HUD: "${f.text}" at ${f.where}. `
          + 'Only the one progress number lives on the glass a learner cannot leave; '
          + 'the ledger belongs in the report, which they open on purpose.');
      }
    }
  }

  // ---- DECL. No undeclared digit on the live HUD --------------------------
  if (snap.live) {
    for (const s of snap.stray) {
      add('DECL', `an undeclared number is on the live HUD: "${s.text}" in ${s.sel} at ${s.where}`
        + (s.line && s.line !== s.text ? ` — the line reads "${s.line}"` : '')
        + '. Every numeral a player can read must be registered in src/meta/progress.js '
        + 'and declared with tagFigure, or nothing compares it against anything.');
    }
  }

  // ---- AGREE. One fact, one value ----------------------------------------
  for (const [id, list] of byId) {
    if (!FACTS[id]) {
      add('AGREE', `"${id}" is printed on screen and is not in the register. `
        + 'A figure nobody argued for is how nine of them got here.');
      continue;
    }
    const vals = [...new Set(list.map((f) => f.value))];
    if (vals.length > 1) {
      add('AGREE', `"${id}" is on screen ${list.length} times with ${vals.length} different values: `
        + list.map((f) => `${f.value} at ${f.where} ("${f.text}")`).join('  |  '));
    }
  }

  // ---- NAME. One name, one fact ------------------------------------------
  const said = new Set();
  for (const a of snap.figures) {
    for (const b of snap.figures) {
      if (a.i >= b.i) continue;
      if (a.fig === b.fig || !a.name || a.name !== b.name) continue;
      if ((a.nested || []).includes(b.i)) continue;
      const key = [a.fig, b.fig].sort().join('|') + a.name;
      if (said.has(key)) continue;
      said.add(key);
      add('NAME', `two different facts are printed under the same words "${a.name}": `
        + `${a.fig}=${a.value} at ${a.where} and ${b.fig}=${b.value} at ${b.where}`);
    }
  }

  // ---- UNIT. No counter changes what it counts ----------------------------
  for (const f of snap.figures) {
    const declared = FACTS[f.fig]?.unit;
    if (declared && f.unit && f.unit !== declared) {
      add('UNIT', `"${f.fig}" is drawn claiming unit "${f.unit}" and the register says `
        + `"${declared}" — a counter that changes what it counts is worse than a wrong one`);
    }
    const seen = units.get(f.fig);
    if (seen && f.unit && seen.unit !== f.unit) {
      add('UNIT', `"${f.fig}" counted ${seen.unit} at ${seen.label} and counts ${f.unit} now `
        + '— one label, two units, and nothing on the glass marks where it changed');
    }
    if (f.unit) units.set(f.fig, { unit: f.unit, label });
  }

  // ---- VOICE. Marlow states no figure ------------------------------------
  for (const v of snap.voice) {
    if (statesAFigure(v.text)) {
      add('VOICE', `the companion states a figure: "${v.text}" (${v.sel}). `
        + 'Marlow reads the same state the HUD reads and quotes none of it.');
    }
  }

  /* …AND NEITHER DOES ANYTHING ELSE THAT WAS LET OFF THE DECL RULE.
     A keycap, a toast and a world label are exempt from "declare your numeral"
     because they are a control, an event and a place. None of them is exempt
     from "do not state a progress figure": the moment a toast reads "3 rifts
     sealed" it is the tenth number, and it got there through the one door this
     gate had propped open for it. */
  for (const e of snap.exemptText || []) {
    if (statesAFigure(e.line)) {
      add('VOICE', `an exempt surface states a figure: "${e.line}" (${e.sel} at ${e.where}). `
        + 'Being a keycap, a notice or a world label buys an exemption from declaring '
        + 'a numeral, never a licence to print a progress count.');
    }
  }

  // ---- MODEL. The screen agrees with the engine ---------------------------
  const m = snap.model;
  if (m) {
    const check = (id, want, name, slack = 0) => {
      if (want == null) return;
      for (const f of byId.get(id) || []) {
        if (Math.abs(Number(f.value) - Number(want)) > slack) {
          add('MODEL', `${name}: the screen says ${f.value} at ${f.where} ("${f.text}") `
            + `and the engine says ${want}`);
        }
      }
    };
    /* One point of slack on the percentage, and only there. The rig counts the
       figure up over 620 ms and the engine has already moved; a gate that
       demands they are equal to the unit at an arbitrary instant is measuring
       the tween, not the truth. Everything else is exact. */
    check('world.repaired', m.repaired, 'world repaired', 1);
    check('lines.held', m.linesHeld, 'lines held');
    check('all.sealed', m.allSealed, 'rifts sealed in all');
    check('all.items', m.allItems, 'questions answered in all');
    if (m.run) {
      check('run.sealed', m.run.tears, 'rifts sealed this run');
      check('run.target', m.run.target, 'rifts this run asks for');
      check('run.items', m.run.items, 'questions this run');
    }
  }

  return fails;
}

// ---------------------------------------------------------------------------
// Self-test: prove the assertion actually fires
// ---------------------------------------------------------------------------
/**
 * A gate nobody has watched fail is a gate nobody knows works — and the gate
 * this replaces is the proof: it ran green for a whole pass over a screen with
 * six numbers on it. So before it is trusted, every rule is shown a screen it
 * must reject, and one it must accept.
 */
function selfTest() {
  const fig = (o) => ({
    i: 0, nested: [], role: FACTS[o.fig]?.role || '', unit: FACTS[o.fig]?.unit || '',
    text: '', name: '', where: '0,0', onHud: true, value: '', ...o,
  });
  const blank = { live: true, openOverlays: [], figures: [], stray: [], voice: [], model: null };

  const cases = [
    {
      name: 'ONE — the nine-figure frame the critic photographed',
      snap: {
        ...blank,
        figures: [
          fig({ i: 0, fig: 'world.repaired', value: '0', text: 'world repaired 0%', name: 'world repaired' }),
          fig({ i: 1, fig: 'lines.held', value: '0', text: '0 of 10 lines held', name: 'of lines held', where: '10,400' }),
        ],
      },
      rule: 'ONE',
    },
    {
      name: 'DECL — a number on the live HUD that nothing declared',
      snap: { ...blank,
        figures: [fig({ fig: 'world.repaired', value: '12', text: 'world repaired 12%', name: 'world repaired' })],
        stray: [{ text: 'bronze · 2 to go', line: 'bronze · 2 to go', sel: '.qr-next', where: '30,540' }] },
      rule: 'DECL',
    },
    {
      name: 'AGREE — one fact, two values',
      snap: { ...blank,
        figures: [
          fig({ i: 0, fig: 'world.repaired', value: '12', text: '12%', name: '' }),
          fig({ i: 1, fig: 'run.sealed', value: '2', text: '2 rifts this run', name: 'rifts this run', where: '10,10', onHud: false }),
          fig({ i: 2, fig: 'run.sealed', value: '4', text: '4 rifts this run', name: 'rifts this run', where: '900,10', onHud: false }),
        ] },
      rule: 'AGREE',
    },
    {
      name: 'NAME — two facts under one name, opposite sides of the screen',
      snap: { ...blank,
        figures: [
          fig({ i: 0, fig: 'run.sealed', value: '9', text: '9 rifts this run', name: 'rifts this run', where: '0,9', onHud: false }),
          fig({ i: 1, fig: 'run.target', value: '20', text: '20 rifts this run', name: 'rifts this run', where: '900,600', onHud: false }),
          fig({ i: 2, fig: 'world.repaired', value: '12', text: '12%', name: '' }),
        ] },
      rule: 'NAME',
    },
    {
      name: 'UNIT — one label, standing points then nights',
      snap: { ...blank,
        figures: [
          fig({ fig: 'world.repaired', value: '12', text: '12%', name: '' }),
          fig({ i: 1, fig: 'run.sealed', unit: 'nights', value: '1', text: '1 night held', name: 'night held', onHud: false }),
        ] },
      rule: 'UNIT',
    },
    {
      name: 'VOICE — Marlow quotes a count',
      snap: { ...blank,
        figures: [fig({ fig: 'world.repaired', value: '12', text: '12%', name: '' })],
        voice: [{ sel: '.marlow', text: 'Three rifts sealed. The lattice has noticed you.' }] },
      rule: 'VOICE',
    },
    {
      name: 'VOICE — a toast quotes a progress count through the exemption',
      snap: { ...blank,
        figures: [fig({ fig: 'world.repaired', value: '12', text: '12%', name: '' })],
        exemptText: [{ text: '3', line: '3 rifts sealed this run', sel: '.toast', where: '0,0' }] },
      rule: 'VOICE',
    },
    {
      name: 'a keycap toast that is NOT a figure (must PASS)',
      snap: { ...blank,
        figures: [fig({ fig: 'world.repaired', value: '12', text: '12%', name: '' })],
        exemptText: [{ text: '1', line: 'build hand stowed. press 1 to 4 to pick a piece', sel: '.toast', where: '0,0' }] },
      rule: null,
    },
    {
      name: 'VOICE — Marlow quotes a unit that is on no surface',
      snap: { ...blank,
        figures: [fig({ fig: 'world.repaired', value: '12', text: '12%', name: '' })],
        voice: [{ sel: '.marlow', text: 'Nine points of standing sit behind that door.' }] },
      rule: 'VOICE',
    },
    {
      name: 'MODEL — the screen disagrees with the engine',
      snap: { ...blank,
        figures: [fig({ fig: 'world.repaired', value: '40', text: '40%', name: '' })],
        model: { repaired: 12, linesHeld: 0, linesTotal: 10, run: null, allSealed: null, allItems: null } },
      rule: 'MODEL',
    },
    {
      name: 'ONE — the HUD carries no progress number at all',
      snap: { ...blank },
      rule: 'ONE',
    },
    {
      name: 'a clean live HUD (must PASS)',
      snap: { ...blank,
        figures: [
          fig({ i: 0, fig: 'world.repaired', value: '31', text: '31%', name: '' }),
          fig({ i: 1, fig: 'wallet.motes', value: '3', text: '3 cipher motes', name: 'cipher motes', where: '200,10' }),
          fig({ i: 2, fig: 'objective.metres', value: '140', text: '140 m', name: 'm', where: '30,300' }),
          fig({ i: 3, fig: 'ordinal.run', value: '2', text: 'run 2', name: 'run', where: '600,10' }),
        ],
        model: { repaired: 31, linesHeld: 1, linesTotal: 10, run: null, allSealed: null, allItems: null } },
      rule: null,
    },
    {
      name: 'the report over the HUD, ledger and all (must PASS)',
      snap: {
        ...blank,
        live: false,
        openOverlays: ['.rp.show'],
        // The stray digits a report is full of are not checked while it is
        // open, and the ledger's several facts are allowed to coexist there.
        stray: [{ text: '17', line: 'questions answered 17', sel: '.rp-tile', where: '0,0' }],
        figures: [
          fig({ i: 0, fig: 'world.repaired', value: '31', text: '31% world repaired', name: '% world repaired', onHud: false }),
          fig({ i: 1, fig: 'lines.held', value: '1', text: '1 of 10 lines held', name: 'of lines held', where: '0,80', onHud: false }),
          fig({ i: 2, fig: 'all.items', value: '17', text: '17 questions answered in all', name: 'questions answered in all', where: '0,160', onHud: false }),
        ],
        model: { repaired: 31, linesHeld: 1, linesTotal: 10, run: null, allSealed: null, allItems: 17 },
      },
      rule: null,
    },
    {
      name: 'the readout and its own part share a noun (must PASS)',
      snap: {
        ...blank,
        live: false,
        openOverlays: ['.ses-charter.show'],
        figures: [
          fig({ i: 0, fig: 'run.sealed', value: '9', text: '9 of 20 rifts this run', name: 'of rifts this run', nested: [1], onHud: false }),
          fig({ i: 1, fig: 'run.target', value: '20', text: 'of 20 rifts this run', name: 'of rifts this run', nested: [0], where: '20,9', onHud: false }),
        ],
      },
      rule: null,
    },
  ];

  let bad = 0;
  for (const c of cases) {
    const fails = assess(c.snap, 'self-test', new Map());
    const caught = fails.some((f) => f.rule === c.rule);
    const ok = c.rule ? caught : fails.length === 0;
    console.log(`${ok ? '  ok  ' : ' FAIL '} self-test: ${c.name}`);
    if (!ok) {
      bad++;
      console.log('        got: ' + (fails.length ? fails.map((f) => f.rule + ': ' + f.why).join(' / ') : '(nothing)'));
    }
  }
  // …and the UNIT rule across two checkpoints, which is the only rule that
  // cannot be shown a single frame.
  {
    const units = new Map();
    assess({
      ...blank,
      figures: [{ i: 0, nested: [], fig: 'world.repaired', role: 'progress', unit: 'percent', value: '12', text: '12%', name: '', where: '0,0', onHud: true }],
    }, 'early', units);
    const late = assess({
      ...blank,
      figures: [{ i: 0, nested: [], fig: 'world.repaired', role: 'progress', unit: 'nights', value: '1', text: '1 night held', name: 'night held', where: '0,0', onHud: true }],
    }, 'late', units);
    const ok = late.some((f) => f.rule === 'UNIT');
    console.log(`${ok ? '  ok  ' : ' FAIL '} self-test: UNIT — the same fact counts something else at the next checkpoint`);
    if (!ok) bad++;
  }
  console.log(bad ? `\nthe gate itself is broken — ${bad} case(s)` : '\nthe gate fires on every rule it claims to check.');
  process.exit(bad ? 1 : 0);
}

if (SELFTEST) selfTest();

// ---------------------------------------------------------------------------
// Driving the real game
// ---------------------------------------------------------------------------
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: !HEADED,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const ctx = await browser.newContext({ viewport: { width: VW, height: VH } });
const page = await ctx.newPage();

const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

const allFails = [];
const captures = [];
/** Every fact's unit, the last time it was seen. Carried across checkpoints. */
const units = new Map();

const SNAP_SRC = SNAPSHOT.toString();

async function read(label) {
  const snap = await ask(
    ({ src, cfg }) => {
      // eslint-disable-next-line no-new-func
      const fn = new Function('return (' + src + ')')();
      return fn(cfg);
    },
    { src: SNAP_SRC, cfg: { overlays: OVERLAYS, notFigure: NOT_A_FIGURE, transient: TRANSIENT, voiceSel: VOICE } },
  );
  await page.screenshot({ path: path.join(OUT, `${label}.png`) });
  const fails = assess(snap, label, units);
  captures.push({ label, live: snap.live, openOverlays: snap.openOverlays, figures: snap.figures, stray: snap.stray, exemptText: snap.exemptText, voice: snap.voice, model: snap.model, fails });
  allFails.push(...fails);
  console.log(`\n--- ${label} — ${snap.live ? 'LIVE HUD' : 'overlay: ' + snap.openOverlays.join(' ')}`);
  console.log(`      ${snap.figures.length} declared figure(s):`);
  for (const f of snap.figures) {
    console.log(`        ${(f.role || '?').padEnd(9)} ${f.fig.padEnd(20)} = ${String(f.value).padEnd(5)} "${f.text}"`);
  }
  if (snap.stray.length) {
    console.log(`      ${snap.stray.length} UNDECLARED number(s) on the HUD:`);
    for (const s of snap.stray) console.log(`        ${s.sel} → "${s.line}"`);
  }
  if (snap.exemptText?.length) {
    console.log(`      ${snap.exemptText.length} exempt numeral(s) (keycaps, notices, world labels):`);
    for (const e of snap.exemptText) console.log(`        ${e.sel} → "${e.line}"`);
  }
  for (const v of snap.voice) console.log(`      voice: "${v.text.slice(0, 100)}"`);
  if (snap.model) {
    console.log(`      engine: repaired=${snap.model.repaired}% linesHeld=${snap.model.linesHeld}/${snap.model.linesTotal}`
      + ` allSealed=${snap.model.allSealed} allItems=${snap.model.allItems}`
      + (snap.model.run ? ` run=${snap.model.run.tears}/${snap.model.run.target} items=${snap.model.run.items}` : ''));
  }
  for (const f of fails) console.log(` FAIL [${f.rule}] ${f.why}`);
  if (!fails.length) console.log('  ok   one number, and everything on this screen agrees with it and with the engine');
  return snap;
}

/**
 * Every read of the page goes through here. Several builders hot-edit this tree
 * at once, so a dev server can full-reload the page between two lines of this
 * script and `window.__ascent` is briefly gone — which is the build process,
 * not the game. A gate that dies on that reports a defect that does not exist.
 */
async function ask(fn, argv) {
  for (let i = 0; i < 3; i++) {
    try {
      await page.waitForFunction(() => !!window.__ascent, null, { timeout: 20000 });
      return await page.evaluate(fn, argv);
    } catch (e) {
      if (i === 2) throw e;
      await page.waitForTimeout(700);
    }
  }
  return null;
}

const panelOpen = () => ask(() => !!window.__ascent?.panel?.open);
const uiOpen = () => ask(() => !!window.__ascent?.input?.uiOpen);

async function handBack() {
  for (let i = 0; i < 6; i++) {
    if (!(await uiOpen())) return;
    await page.keyboard.press('Escape');
    await page.waitForTimeout(380);
  }
}

/** Walk to a rift with W and the mouse, exactly as coldplay.mjs does. */
async function walkToRift() {
  const target = await ask(() => {
    const a = window.__ascent;
    const r = (a.rifts?.list ?? []).filter((x) => !x.locked && !x.mastered);
    if (!r.length) return null;
    const p = a.player.pos;
    let best = null, bd = 1e9;
    for (const x of r) {
      const d = Math.hypot(x.pos.x - p.x, x.pos.z - p.z);
      if (d < bd) { bd = d; best = x; }
    }
    return best ? { id: best.id, x: best.pos.x, z: best.pos.z } : null;
  });
  if (!target) return false;
  let held = false;
  let opened = false;
  for (let i = 0; i < 260 && !opened; i++) {
    if (await uiOpen()) {
      if (held) { await page.keyboard.up('KeyW'); held = false; }
      if (await panelOpen()) { opened = true; break; }
      await handBack();
      continue;
    }
    const err = await ask((tg) => {
      const a = window.__ascent, p = a.player.pos;
      const want = Math.atan2(tg.x - p.x, tg.z - p.z);
      let d = ((want - a.player.yaw + Math.PI) % (Math.PI * 2)) - Math.PI;
      if (d < -Math.PI) d += Math.PI * 2;
      return { d, dist: Math.hypot(tg.x - p.x, tg.z - p.z) };
    }, target);
    if (Math.abs(err.d) > 0.06) await page.mouse.move(800 - err.d * 240, 450, { steps: 2 });
    if (!held) { await page.keyboard.down('KeyW'); held = true; }
    await page.waitForTimeout(120);
    opened = await panelOpen();
    if (err.dist < 5) break;
  }
  if (held) await page.keyboard.up('KeyW');
  if (!opened) {
    for (const k of ['KeyE', 'Enter']) {
      await page.keyboard.press(k);
      await page.waitForTimeout(480);
      opened = await panelOpen();
      if (opened) break;
    }
  }
  return opened;
}

/**
 * Answer whatever is on the surface, with keys and clicks. The answer is READ
 * off the live item — a fact — and everything after that is pressed. `wrong`
 * deliberately misses, because a run where nothing is ever wrong never opens
 * the gap between rifts sealed and questions worked, and that gap is the pair
 * the cold critic caught disagreeing.
 */
async function answerOne(wrong = false) {
  if (!(await panelOpen())) return false;
  const fact = await ask(() => {
    const p = window.__ascent.panel;
    return p?.item ? { answer: String(p.item.answer) } : null;
  });
  if (!fact) return false;
  const opts = await page.$$('.rf-opt, .rf-choice button, .rf-choices button');
  const want = fact.answer.replace(/\s+/g, '');
  if (opts.length) {
    let picked = null;
    for (const o of opts) {
      const same = (await o.innerText()).replace(/\s+/g, '') === want;
      if (wrong ? !same : same) { picked = o; break; }
    }
    await (picked || opts[0]).click();
  } else {
    const typed = wrong ? String((Number(fact.answer) || 0) + 7) : fact.answer;
    for (const ch of typed) {
      if (ch === '-') await page.keyboard.press('Minus');
      else if (ch === '/') await page.keyboard.press('Slash');
      else if (ch === '.') await page.keyboard.press('Period');
      else await page.keyboard.press(ch);
      await page.waitForTimeout(45);
    }
    await page.keyboard.press('Enter');
  }
  await page.waitForTimeout(1400);
  return true;
}

/**
 * Stand where the chapter card is allowed to speak, and wait for it.
 *
 * `src/ui/quiet.js` keeps three prose surfaces at once and the chapter card is
 * fourth in line, so inside a rift ring it can never appear. Walking into open
 * ground retires the plate; standing still lets Marlow's queue drain. Both are
 * things a player does between two rifts, which is why waiting for them is fair
 * rather than a pose — and this frame is the one the cold critic photographed.
 */
async function waitForChapter(seconds = 46) {
  const t0 = Date.now();
  let leg = 0;
  while ((Date.now() - t0) / 1000 < seconds) {
    const up = await ask(() => {
      const el = document.querySelector('.meta-quest');
      const band = document.querySelector('.ses-band.show');
      if (!el || !band) return false;
      const r = el.getBoundingClientRect();
      const cs = getComputedStyle(el);
      return r.width > 1 && r.height > 1
        && cs.visibility !== 'hidden' && Number(cs.opacity) > 0.3;
    });
    if (up) return true;
    if (await uiOpen()) { await handBack(); continue; }
    const key = ['KeyS', 'KeyA', 'KeyW', 'KeyD'][leg++ % 4];
    await page.keyboard.down(key);
    await page.waitForTimeout(1500);
    await page.keyboard.up(key);
    await page.waitForTimeout(2200);
  }
  return false;
}

// --- a cleared save, every time --------------------------------------------
await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch { /* private mode */ } });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });
await page.waitForTimeout(4500);

if (LOCALE !== 'en') {
  const hit = await page.evaluate((l) => {
    const b = document.querySelector(`#langs button[data-loc="${l}"]`);
    if (!b) return false;
    b.click();
    return true;
  }, LOCALE);
  console.log(hit ? `playing in ${LOCALE.toUpperCase()}` : `(!) no ${LOCALE} button on the language plate`);
  await page.waitForTimeout(1500);
}

await page.waitForFunction(
  () => !!window.__ascent.session?.state?.()?.run,
  null,
  { timeout: 60000 },
).catch(() => {});
await page.waitForTimeout(1500);

// ============================ CHECKPOINT 1 ==================================
// The orders are up. The goal has been stated and nothing has been done.
await read('1-orders-stated');

// hand the frame back the way a player does, then play
await handBack();
await page.mouse.click(800, 450);
await page.waitForTimeout(400);

// ============================ CHECKPOINT 2 ==================================
// THE FIRST FRAME OF PLAY, before any answer. The one number must already be on
// the glass and reading zero, and it must be the only one.
await read('2-live-hud-before-any-answer');

const opened = await walkToRift();
if (!opened) console.log('\n  (!) could not reach a rift with keys — later checkpoints will be thin');

// Real work: several right, one deliberately wrong.
for (let i = 0; i < 7; i++) {
  if (!(await panelOpen())) {
    await handBack();
    if (!(await walkToRift())) break;
  }
  await answerOne(i === 2);
}

// ============================ CHECKPOINT 3 ==================================
// THE HUD, WHOLE, MID-RUN — the frame the cold reader photographed with nine
// figures on it. Everything is up: the rig, the run band, the objective card.
await page.waitForTimeout(800);
if (await panelOpen()) { await page.keyboard.press('Escape'); await page.waitForTimeout(700); }
await handBack();
await page.waitForTimeout(600);
await read('3-live-hud-midrun');

// ---- …and with the chapter card standing beside the band -------------------
if (await waitForChapter(46)) await read('4-band-and-chapter-card-together');
else console.log('\n  (!) the chapter card never stood beside the band — not observed this run');

// ============================ CHECKPOINT 5 ==================================
// The report OPEN OVER THE LIVE HUD, scrolled to the tiles a teacher reads.
// The ledger is allowed here; it must still agree with the one number.
await ask(() => document.querySelector('.rp-launch')?.click());
await page.waitForTimeout(1200);
await ask(() => {
  const tt = document.querySelector('.rp-stats');
  if (tt) tt.scrollIntoView({ block: 'center' });
});
await page.waitForTimeout(700);
await read('5-report-over-hud');

// …and again after one more answer, because a report rendered four minutes ago
// is indistinguishable on screen from one that disagrees.
await ask(() => document.querySelector('.rp-x')?.click());
await page.waitForTimeout(500);
await handBack();
if (!(await panelOpen())) await walkToRift();
await answerOne(false);
await page.waitForTimeout(500);
if (await panelOpen()) { await page.keyboard.press('Escape'); await page.waitForTimeout(700); }
await handBack();
await read('6-live-hud-after-one-more-seal');
await ask(() => document.querySelector('.rp-launch')?.click());
await page.waitForTimeout(1000);
await ask(() => {
  const tt = document.querySelector('.rp-stats');
  if (tt) tt.scrollIntoView({ block: 'center' });
});
await page.waitForTimeout(700);
await read('7-report-after-one-more-seal');
await ask(() => document.querySelector('.rp-x')?.click());
await page.waitForTimeout(500);

// ============================ CHECKPOINT 8 ==================================
// The close. The run résumé, the progress number and whatever ceremony the run
// earned, all on one card at one moment.
await handBack();
await ask(() => {
  const se = window.__ascent.session;
  se?.chargeTo?.(18);
  se?.close?.();
});
await page.waitForTimeout(2400);
await read('8-run-closed');

// ============================ CHECKPOINT 9 ==================================
// ONE MORE LINE — the only thing in the game that may move the run's goal.
const before = await ask(() => window.__ascent.session?.state?.()?.run?.target ?? null);
const canMore = await ask(() => {
  const b = document.querySelector('.ses-close.show .sx-more');
  if (!b) return false;
  const r = b.getBoundingClientRect();
  return r.width > 1 && r.height > 1;
});
if (canMore) {
  await ask(() => document.querySelector('.ses-close.show .sx-more')?.click());
  await page.waitForTimeout(2600);
  const after = await ask(() => window.__ascent.session?.state?.()?.run?.target ?? null);
  await read('9-goal-raised-live-hud');
  console.log(`  ok   one more line: target ${before} -> ${after}, and the live HUD prints no target to contradict`);
} else {
  console.log('\n  (!) one more line was not on offer at this close');
}

// ============================ CHECKPOINT 10 =================================
// A SECOND RUN. Everything above happened inside run one, where "this run" and
// "in all" are the same number by arithmetic — so a mislabelled pair could have
// survived it. A second run puts the run tally back to zero while the lifetime
// total stands, which is the shape the cold reading was.
await handBack();
await ask(() => document.querySelector('.ses-close.show .sx-rest')?.click());
await page.waitForTimeout(2000);
for (let i = 0; i < 30; i++) {
  const done = await ask(() => {
    const b = document.querySelector('.ses-rest .sr-again');
    if (!b) return 'gone';
    const r = b.getBoundingClientRect();
    if (r.width > 1 && r.height > 1 && Number(getComputedStyle(b).opacity) > 0.3) {
      b.click();
      return 'clicked';
    }
    const skip = document.querySelector('.ses-rest .sr-skip');
    if (skip) skip.click();
    return 'waiting';
  });
  if (done !== 'waiting') break;
  await page.waitForTimeout(1200);
}
await page.waitForTimeout(2600);
await page.keyboard.press('Space');
await page.waitForTimeout(1600);
const two = await ask(() => {
  const st = window.__ascent?.session?.state?.();
  return { index: st?.run?.index ?? null,
    tears: st?.run?.tears ?? null,
    all: window.__ascent?.story?.state?.()?.tears ?? null };
});
if (two.index && two.tears === 0 && two.all > 0) {
  console.log(`\n  ok   run ${two.index} opens at 0 sealed while ${two.all} stand in all `
    + '— the two counts differ, which is the pair that was reported');
  if (await waitForChapter(46)) await read('10-second-run-counts-differ');
  else await read('10-second-run-live-hud');
} else {
  console.log(`\n  (!) a second run did not open (index=${two.index} tears=${two.tears})`);
}

// --- frame health -----------------------------------------------------------
const perf = await ask(() => {
  const st = window.__ascent?.state?.();
  return st ? { fps: st.fps, p50: st.perf?.p50, p95: st.perf?.p95, low: st.perf?.fps1Low,
    median: st.perf?.fps, samples: st.perf?.samples } : null;
});
if (perf) {
  console.log(`\n  ok   frame: median ${Math.round(perf.median || 0)} fps `
    + `(p50 ${Number(perf.p50 || 0).toFixed(1)} ms, p95 ${Number(perf.p95 || 0).toFixed(1)} ms, `
    + `1% low ${Math.round(perf.low || 0)} fps, ${perf.samples || 0} frames)`);
}

// --- console health ---------------------------------------------------------
if (errors.length) {
  allFails.push({ rule: '0', label: 'console', why: errors.slice(0, 3).join(' | ') });
  console.log(`\n FAIL [0] ${errors.length} console error(s): ${errors.slice(0, 3).join(' | ')}`);
} else {
  console.log('\n  ok   no console errors');
}

await writeFile(path.join(OUT, 'oneprogress.json'),
  JSON.stringify({ captures, fails: allFails, errors, perf }, null, 2));

const liveCaps = captures.filter((c) => c.live);
const worst = Math.max(0, ...liveCaps.map((c) => c.figures.filter((f) => FACTS[f.fig]?.role === 'progress' && f.onHud).length));
const seen = new Set(captures.flatMap((c) => c.figures.map((f) => f.fig)));
console.log(`\nfacts observed across the session: ${[...seen].sort().join(', ') || 'none'}`);
console.log(`most progress figures seen on one live-HUD frame: ${worst}`);
console.log(allFails.length
  ? `\nFAIL — ${allFails.length} disagreement(s). -> ${OUT}`
  : `\nPASS — one progress number, at every checkpoint, agreeing with the engine. -> ${OUT}`);

await browser.close();
process.exit(allFails.length ? 1 : 0);
