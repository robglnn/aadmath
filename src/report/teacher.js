/**
 * The teacher's copy.
 *
 * The progress report answers "what have I got and what is next" for the person
 * holding the keyboard. This answers a different question for a different
 * person, and it is a question the product had no answer to at all: *did
 * learning happen, for whom, and how would anyone else know?*
 *
 * Until this existed, "a teacher can see whether learning happened" meant
 * standing behind one fourteen-year-old while they pressed P. That is not a
 * record. It cannot be filed, it has no date on it, it has nobody's name on it,
 * it cannot be compared with the same child last week or with the other
 * twenty-nine children, and it evaporates when the tab closes. So:
 *
 *   ONE LEARNER  a dated, named evidence sheet — every line, the state, the
 *                evidence behind the claim, the road it was granted on, the
 *                standards it answers to with their coverage depth, and the
 *                withdrawn claims. Printable to paper or PDF, exportable as
 *                JSON (the whole record) or CSV (a gradebook row per line).
 *
 *   STANDARDS    the same evidence addressed to the framework a district
 *                actually uses. A row is an expectation — `A.10(D)`,
 *                `8.EE.C.7.B` — not one of our skill names, and it carries the
 *                depth of the claim, the lines that carry it, what this learner
 *                did for it, and whether it has any evidence at all. The
 *                framework switch in the header governs this pane, the sheet
 *                above it and every export.
 *
 *   A CLASS      the same records, collected. A teacher drops the JSON files
 *                their class exported and gets a roster with a row per student
 *                and a table per line showing how many of the class hold it —
 *                which is the only view that answers "who is stuck, and on
 *                what?" without opening thirty devices.
 *
 * Everything stays on the device. Nothing is uploaded, there is no account, and
 * the class list is a file the teacher assembled themselves — which is the only
 * shape of this feature that a school can switch on without a data-protection
 * review it will never finish.
 */
import { t, num, pct } from '../i18n/index.js';
import {
  recordToCsv, standardsToCsv, classToCsv, classBySkill, isRecord, fileName, duration, dateText,
} from './record.js';
import { createFrameSwitch, gapsOf, shortCode } from './standards.js';

const LEARNER_KEY = 'ascent.learner';
const CLASS_KEY = 'ascent.class';
const DEPTHS = ['core', 'supporting', 'introduced'];

export function createTeacher({ build, coverage, process: processOf, onToggle }) {
  const host = document.createElement('div');
  host.className = 'rp-doc-host';
  host.id = 'rp-doc-host';
  host.innerHTML = `<section class="rp-doc" role="dialog" aria-modal="true">
      <header class="rp-doc-head">
        <div class="rp-titles"><h2 class="rp-h rp-doc-h"></h2><p class="rp-sub rp-doc-sub"></p></div>
        <div class="rp-frame-slot"></div>
        <button class="rp-x rp-doc-x" type="button"></button>
      </header>
      <nav class="rp-tabs" role="tablist">
        <button class="rp-tab on" type="button" data-tab="one" role="tab"></button>
        <button class="rp-tab" type="button" data-tab="std" role="tab"></button>
        <button class="rp-tab" type="button" data-tab="class" role="tab"></button>
      </nav>
      <div class="rp-doc-body">
        <div class="rp-pane p-one">
          <div class="rp-ident"></div>
          <div class="rp-acts"></div>
          <div class="rp-sheet"></div>
        </div>
        <div class="rp-pane p-std" hidden>
          <div class="rp-acts rp-acts-std"></div>
          <div class="rp-sheet rp-std-sheet"></div>
        </div>
        <div class="rp-pane p-class" hidden>
          <div class="rp-acts rp-acts-class"></div>
          <div class="rp-sheet rp-class-sheet"></div>
        </div>
      </div>
    </section>`;
  document.body.appendChild(host);

  const q = (s) => host.querySelector(s);
  const open = { value: false };
  let tab = 'one';
  let learner = loadJson(LEARNER_KEY) || { name: '', group: '' };
  let roster = (loadJson(CLASS_KEY) || []).filter(isRecord);

  // The same switch as the report screen, on the document a teacher prints.
  // It is in the header rather than inside a pane, because the choice governs
  // every pane and a control that moves with the tab reads as a filter.
  const frame = createFrameSwitch();
  q('.rp-frame-slot').appendChild(frame.el);

  q('.rp-doc-x').addEventListener('click', close);
  host.addEventListener('click', (e) => { if (e.target === host) close(); });
  host.addEventListener('keydown', (e) => {
    // The game listens on window and swallows Space as a jump. A record with a
    // student called "AdaLovelace" is not a record.
    //
    // Only while this screen is actually up, though. A button in here keeps
    // the focus after the screen closes, so every key still arrived through
    // this listener and was stopped dead — which took P and Escape away from
    // the panel underneath just as surely as the missing listener did.
    if (!open.value) return;
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
  // …AND THE SAME KEY WHEN NOTHING IN HERE HAS FOCUS.
  //
  // The listener above only ever runs for a key aimed at something inside this
  // document, and opening it focuses nothing — so for a reader who had not
  // clicked into the name field, Escape went to the window and this screen
  // never saw it. It could then only be closed with the mouse, and because
  // `src/report/index.js` holds P and Escape back while `teacher.open` is true,
  // the progress panel underneath it lost BOTH of its keys for the rest of the
  // session. Two documented bindings, dead, from one missing listener.
  //
  // Capture, and the key is consumed: the panel underneath must not close on
  // the same press that closed this. (learn-ux, lane B: smallest fix that gives
  // the keys back.)
  addEventListener('keydown', (e) => {
    if (!open.value || e.repeat || e.key !== 'Escape') return;
    if (host.contains(e.target)) return;   // the listener above has it
    e.preventDefault();
    e.stopPropagation();
    close();
  }, true);
  for (const b of host.querySelectorAll('.rp-tab')) {
    b.addEventListener('click', () => { tab = b.dataset.tab; render(); });
  }

  /** Whose keyboard this screen borrowed, so it can be handed back. */
  let cameFrom = null;

  function show() {
    cameFrom = document.activeElement;
    open.value = true;
    host.classList.add('show');
    // The print stylesheet hides everything on the page except this document —
    // which would turn Ctrl+P on the *game* into a blank sheet of paper. It is
    // switched on only while the document is actually open.
    document.body.dataset.rpDoc = 'on';
    render();
    onToggle?.(true);
    // A dialog nobody's keyboard is inside is a dialog a keyboard cannot leave.
    setTimeout(() => q('.rp-doc-x')?.focus({ preventScroll: true }), 40);
  }
  function close() {
    if (!open.value) return;
    open.value = false;
    host.classList.remove('show');
    delete document.body.dataset.rpDoc;
    // Hand the keyboard back to whatever opened this. A focus left inside a
    // hidden dialog is a focus the panel underneath cannot get keys past.
    if (host.contains(document.activeElement)) {
      if (cameFrom && cameFrom.isConnected && cameFrom !== document.body) cameFrom.focus({ preventScroll: true });
      else document.activeElement.blur?.();
    }
    cameFrom = null;
    onToggle?.(false);
  }

  // -------------------------------------------------------------------------
  function render() {
    q('.rp-doc-h').textContent = t('report.record.title');
    q('.rp-doc-sub').textContent = t('report.record.sub');
    q('.rp-doc-x').textContent = t('report.close');
    q('.rp-doc-x').setAttribute('aria-label', t('report.close'));
    frame.relabel();
    const tabs = [...host.querySelectorAll('.rp-tab')];
    for (const b of tabs) {
      b.textContent = b.dataset.tab === 'class'
        ? t('report.record.tab.class', { n: roster.length })
        : t('report.record.tab.' + b.dataset.tab);
      b.classList.toggle('on', b.dataset.tab === tab);
    }
    for (const pane of host.querySelectorAll('.rp-pane')) {
      pane.hidden = !pane.classList.contains('p-' + tab);
    }
    document.body.dataset.rpPrint = tab;
    if (tab === 'one') { renderIdentity(); renderActions(); renderSheet(); }
    else if (tab === 'std') { renderStdActions(); renderStdSheet(); }
    else { renderClassActions(); renderClass(); }
  }

  function renderIdentity() {
    const box = q('.rp-ident');
    box.innerHTML = '';
    for (const [key, labKey, phKey] of [
      ['name', 'report.record.name', 'report.record.namePh'],
      ['group', 'report.record.group', 'report.record.groupPh'],
    ]) {
      const lab = document.createElement('label');
      lab.className = 'rp-field';
      const span = document.createElement('span');
      span.textContent = t(labKey);
      const inp = document.createElement('input');
      inp.type = 'text';
      inp.value = learner[key] || '';
      inp.placeholder = t(phKey);
      inp.autocomplete = 'off';
      inp.addEventListener('input', () => {
        learner = { ...learner, [key]: inp.value };
        saveJson(LEARNER_KEY, learner);
        renderSheet();
      });
      lab.append(span, inp);
      box.appendChild(lab);
    }
    const note = document.createElement('p');
    note.className = 'rp-note';
    note.textContent = t('report.record.nameNote');
    box.appendChild(note);
  }

  function renderActions() {
    const box = q('.rp-acts');
    box.innerHTML = '';
    const rec = () => build(learner);
    box.append(
      button('report.record.print', () => window.print(), 'primary'),
      button('report.record.exportJson', () => {
        const r = rec();
        download(fileName(r, 'json'), JSON.stringify(r, null, 2), 'application/json');
      }),
      button('report.record.exportCsv', () => {
        const r = rec();
        download(fileName(r, 'csv'), recordToCsv(r), 'text/csv');
      }),
    );
  }

  function renderStdActions() {
    const box = q('.rp-acts-std');
    box.innerHTML = '';
    box.append(
      button('report.record.print', () => window.print(), 'primary'),
      button('report.record.exportStd', () => {
        const r = build(learner);
        download(fileName(r, 'csv', 'standards'), standardsToCsv(r), 'text/csv');
      }),
      button('report.record.exportJson', () => {
        const r = build(learner);
        download(fileName(r, 'json'), JSON.stringify(r, null, 2), 'application/json');
      }),
    );
  }

  /**
   * The standards sheet: the same evidence, addressed to the framework a
   * district actually uses.
   *
   * A teacher does not file "distribute". They file A.10(D), or 8.EE.C.7.B, and
   * they need three things beside the code before it is worth filing: how deep
   * the claim goes, what the student did for it, and — the part a vendor sheet
   * always leaves out — which expectations have nothing behind them at all.
   */
  function renderStdSheet() {
    const box = q('.rp-std-sheet');
    box.innerHTML = '';
    const rec = build(learner);
    const cov = coverage();
    const fw = cov.framework;

    // --- head -------------------------------------------------------------
    const head = document.createElement('div');
    head.className = 'rp-sheet-head';
    const h = document.createElement('h1');
    h.textContent = rec.learner.name || t('report.record.anon');
    const sub = document.createElement('p');
    sub.className = 'rp-sheet-sub';
    sub.textContent = [
      rec.learner.group,
      // A coverage sheet with no unit on it is a coverage sheet about the
      // product. The unit is named here for the same reason it is named on the
      // line sheet: this document gets filed, and read a month later.
      t('report.record.levelLine', { level: rec.level?.name || t('report.record.levelName') }),
      t('report.record.stdSub', { frame: t('report.std.frame.full.' + fw) }),
      t('report.record.generatedLine', { date: dateText(rec.generatedAt, true) }),
    ].filter(Boolean).join(' · ');
    const auth = document.createElement('p');
    auth.className = 'rp-doc-trust';
    auth.textContent = t('report.std.frame.authority.' + fw);
    head.append(h, sub, auth);
    box.appendChild(head);

    // --- the five figures -------------------------------------------------
    box.appendChild(sumList([
      [t('report.record.col.framework'), t('report.std.frame.' + fw)],
      [t('report.std.cover.evidenced'), `${num(cov.totals.evidenced)} / ${num(cov.totals.total)}`],
      [t('report.std.cover.group.held'), num(cov.totals.held)],
      [t('report.std.cover.core'), `${num(cov.totals.coreHeld)} / ${num(cov.totals.coreTotal)}`],
      [t('report.std.cover.untouched'), num(cov.totals.none)],
    ]));

    // --- coverage, one row per expectation --------------------------------
    box.appendChild(h3(t('report.std.cover.head')));
    const cols = [
      'report.record.col.code', 'report.record.col.depth', 'report.record.col.cover',
      'report.record.col.linesHeld', 'report.record.col.formsMet', 'report.record.col.answers',
      'report.record.col.unaided', 'report.record.col.carriedBy',
    ];
    const tbl = table(cols);
    const body = tbl.querySelector('tbody');
    for (const r of cov.rows) {
      const tr = document.createElement('tr');
      tr.dataset.cover = r.cover;
      for (const c of [
        r.short,
        t('report.std.depth.' + (DEPTHS.includes(r.depth) ? r.depth : 'unknown')),
        t('report.std.cover.group.' + r.cover),
        `${num(r.heldLines)} / ${num(r.totalLines)}`,
        `${num(r.formsMet)} / ${num(r.formsDeclared)}`,
        num(r.answers),
        num(r.unaided),
        r.lines.map((l) => t('skills.' + l.id)).join(' · '),
      ]) {
        const td = document.createElement('td');
        td.textContent = c;
        tr.appendChild(td);
      }
      body.appendChild(tr);
    }
    box.appendChild(tbl);

    if (cov.rows.some((r) => r.thin)) box.appendChild(sheetNote(t('report.std.cover.thin')));
    if (cov.totals.indirect) box.appendChild(sheetNote(t('report.std.cover.indirectNote')));

    // --- the wording, quoted ---------------------------------------------
    box.appendChild(h3(t('report.record.stdSheetHead')));
    box.appendChild(sheetNote(t('report.std.cover.textNote')));
    const wl = document.createElement('dl');
    wl.className = 'rp-defs';
    for (const r of cov.rows) {
      const dt = document.createElement('dt');
      dt.textContent = r.citation ? `${r.short} · ${r.citation}` : r.short;
      const dd = document.createElement('dd');
      dd.lang = 'en';
      dd.textContent = r.text;
      wl.append(dt, dd);
      if (!r.caveat) continue;
      const cav = document.createElement('dd');
      cav.className = 'rp-def-caveat';
      const head = document.createElement('b');
      head.textContent = t('report.std.cover.caveatHead');
      // OURS, NOT THEIRS. The `dd` above is a quotation of a US standard and
      // stays English under `lang="en"` with the note that says so. This
      // paragraph is the project explaining the edge of its own claim, so it
      // arrives in the reader's language and carries no `lang` override — it
      // used to carry one, and a department head reading the Spanish record
      // found seventeen English paragraphs under a Spanish heading.
      const body2 = document.createElement('span');
      body2.textContent = r.caveat;
      cav.append(head, body2);
      wl.appendChild(cav);
    }
    box.appendChild(wl);

    // --- process standards / practices ------------------------------------
    const proc = processOf ? processOf() : [];
    if (proc.length) {
      box.appendChild(h3(t('report.std.cover.processHead.' + fw)));
      box.appendChild(sheetNote(t('report.std.cover.processNote')));
      // The EXPECTATION column quotes the standard, so it needs the same
      // disclosure the expectation table above carries. The MET column does
      // not: it is our own sentence, and it is translated.
      box.appendChild(sheetNote(t('report.std.cover.textNote')));
      const pt = table(['report.record.col.code', 'report.record.col.linesHeld',
        'report.record.col.expectation', 'report.record.col.processMet']);
      const pb = pt.querySelector('tbody');
      for (const p of proc) {
        const tr = document.createElement('tr');
        for (const [c, quoted] of [[p.short, false], [`${num(p.held)} / ${num(p.total)}`, false],
          [p.text, true], [p.how, false]]) {
          const td = document.createElement('td');
          if (quoted) td.lang = 'en';
          td.textContent = c;
          tr.appendChild(td);
        }
        pb.appendChild(tr);
      }
      box.appendChild(pt);
    }

    // --- where the alignment stops ---------------------------------------
    const gaps = gapsOf(fw);
    if (gaps.length) {
      box.appendChild(h3(t('report.std.cover.gapHead')));
      box.appendChild(sheetNote(t('report.std.cover.gapNote')));
      const ul = document.createElement('ul');
      ul.className = 'rp-list rp-gaps';
      for (const g of gaps) {
        // Where the alignment stops is our finding about our own product. It
        // quotes nothing, so it is translated like any other sentence we wrote.
        const li = document.createElement('li');
        const head = document.createElement('b');
        head.textContent = g.finding || '';
        li.appendChild(head);
        for (const part of [g.why, g.resolution]) {
          if (!part) continue;
          const sp = document.createElement('span');
          sp.textContent = part;
          li.appendChild(sp);
        }
        ul.appendChild(li);
      }
      box.appendChild(ul);
    }

    const foot = document.createElement('p');
    foot.className = 'rp-sheet-foot';
    foot.textContent = t('report.record.stdFoot');
    box.appendChild(foot);
  }

  function renderClassActions() {
    const box = q('.rp-acts-class');
    box.innerHTML = '';
    const pick = document.createElement('label');
    pick.className = 'rp-btn primary';
    const inp = document.createElement('input');
    inp.type = 'file';
    inp.accept = '.json,application/json';
    inp.multiple = true;
    inp.className = 'rp-file';
    inp.addEventListener('change', async () => {
      for (const f of [...inp.files]) {
        try {
          const parsed = JSON.parse(await f.text());
          for (const r of Array.isArray(parsed) ? parsed : [parsed]) {
            if (!isRecord(r)) continue;
            const at = roster.findIndex((x) => x.recordId && x.recordId === r.recordId);
            if (at >= 0) roster[at] = r; else roster.push(r);
          }
        } catch { /* not a record; the count on screen is the feedback */ }
      }
      inp.value = '';
      saveJson(CLASS_KEY, roster);
      render();
    });
    const lab = document.createElement('span');
    lab.textContent = t('report.record.import');
    pick.append(inp, lab);
    box.append(
      pick,
      button('report.record.addMine', () => {
        const r = build(learner);
        const at = roster.findIndex((x) => x.recordId && x.recordId === r.recordId);
        if (at >= 0) roster[at] = r; else roster.push(r);
        saveJson(CLASS_KEY, roster);
        render();
      }),
      button('report.record.print', () => window.print()),
      button('report.record.exportCsv', () => {
        if (roster.length) download(`ascent-class-${new Date().toISOString().slice(0, 10)}.csv`, classToCsv(roster), 'text/csv');
      }),
      button('report.record.clear', () => {
        roster = [];
        saveJson(CLASS_KEY, roster);
        render();
      }, 'quiet'),
    );
  }

  // ------------------------------------------------------------------ sheet --
  /**
   * The document itself. Written as headings, definition lists and tables and
   * nothing else, so that the print stylesheet only has to change colours and
   * spacing to turn it into a piece of paper a department head can file.
   */
  function renderSheet() {
    const host2 = q('.rp-sheet');
    const rec = build(learner);
    host2.innerHTML = '';

    host2.appendChild(sheetHead(rec));

    // --- headline figures -------------------------------------------------
    host2.appendChild(sumList([
      [t('report.record.sum.held'), `${num(rec.totals.held)} / ${num(rec.totals.total)}`],
      [t('report.record.sum.items'), num(rec.totals.items)],
      [t('report.record.sum.unaided'), rec.totals.accuracy == null ? t('report.record.notMeasured') : pct(rec.totals.accuracy)],
      [t('report.record.sum.time'), rec.totals.timeMs == null ? t('report.record.notMeasured') : duration(rec.totals.timeMs).full],
      [t('report.record.sum.claimItems'), num(rec.totals.claimItems)],
      [t('report.record.sum.testedOut'), num(rec.totals.testedOut)],
      [t('report.record.sum.withdrawn'), `${num(rec.totals.withdrawn)} / ${num(rec.totals.granted)}`],
    ]));

    // --- the lines --------------------------------------------------------
    host2.appendChild(h3(t('report.record.linesHead')));
    const tbl = document.createElement('table');
    tbl.className = 'rp-table';
    tbl.innerHTML = '<thead><tr></tr></thead><tbody></tbody>';
    const head = [
      'report.record.col.skill', 'report.record.col.state', 'report.record.col.evidence',
      'report.record.col.items', 'report.record.col.unaided', 'report.record.col.time',
      'report.record.col.retention', 'report.record.col.standards',
    ];
    for (const k of head) {
      const th = document.createElement('th');
      th.textContent = t(k);
      tbl.querySelector('thead tr').appendChild(th);
    }
    for (const s of rec.skills) {
      const tr = document.createElement('tr');
      tr.dataset.state = s.state;
      // The same claim the STANDARDS cell prints, in the words the graph uses
      // rather than the words this locale prints. `tools/check-record.mjs`
      // holds every printed depth against the depth that line's node declares,
      // and a gate that had to parse "(core)" out of a sentence could only ever
      // do it in English — which is the locale a defect is least likely to be
      // found in. Machine-readable, so the check runs in all three.
      tr.dataset.skill = s.id;
      tr.dataset.std = (rec.framework === 'teks' ? s.teks : s.ccss)
        .map((c) => `${c.code}:${c.depth || 'unknown'}`).join(' ');
      const probes = s.probes.hit + s.probes.miss;
      const cells = [
        s.title,
        t('report.state.' + s.state),
        s.claim ? claimText(s.claim) : t('report.record.noClaim'),
        // The lifetime count, and — where there is a claim — which side of it
        // those questions fell on. The bare total sat next to "tested out ·
        // 3 items" and left a reader to guess whether the other nine questions
        // were evidence the claim ignored or practice that came after it.
        s.itemsAtClaim == null || !s.itemsSinceClaim
          ? num(s.items)
          : t('report.fact.itemsSplit', { n: num(s.items), before: num(s.itemsAtClaim), since: num(s.itemsSinceClaim) }),
        s.accuracy == null ? '—' : pct(s.accuracy),
        s.timeMs == null ? '—' : duration(s.timeMs).full,
        probes ? t('report.evidence.probeCount', { hit: s.probes.hit, n: probes }) : '—',
        standardsText(s, rec),
      ];
      for (const c of cells) {
        const td = document.createElement('td');
        td.textContent = c;
        tr.appendChild(td);
      }
      tbl.querySelector('tbody').appendChild(tr);
    }
    host2.appendChild(tbl);

    // WHAT THE REPRESENTATION LABEL IS, ON THE PAPER. See claimText(): the
    // engine counts the labels its item forms carry, and two labelled forms of
    // one line can ask for the same act. The claim column prints that count, so
    // the sheet has to say what the count is. A limitation a reader discovers
    // is worth less than the same limitation printed beside the number.
    if (anyLabelledSpan(rec)) host2.appendChild(sheetNote(t('report.record.repsNote')));

    // --- withdrawn claims -------------------------------------------------
    if (rec.withdrawnList.length) {
      host2.appendChild(h3(t('report.record.withdrawnHead')));
      const ul = document.createElement('ul');
      ul.className = 'rp-list';
      for (const w of rec.withdrawnList) {
        const li = document.createElement('li');
        li.textContent = t('report.record.withdrawnRow', { skill: w.title, date: dateText(w.at) });
        ul.appendChild(li);
      }
      host2.appendChild(ul);
    }

    // WHERE THIS RECORD ACTUALLY LIVES. Last on the sheet, and on the paper.
    // A district reading a printed evidence sheet has no way to know, from the
    // sheet, that the evidence behind it is one browser's local storage on one
    // device — and on the shared Chromebooks this product targets, that means a
    // record cannot be reliably attached to a student at all. Saying so on the
    // document is cheaper than a school discovering it in September.
    // content/STANDARDS.md section 6 carries the same limitation, and section
    // 6.1 the smallest honest path out of it. Not a defect: a scope statement.
    host2.appendChild(custodyNote());

    host2.appendChild(foot(rec));
  }

  /** The evidence-custody statement, as it belongs on paper. */
  function custodyNote() {
    const box = document.createElement('div');
    box.className = 'rp-custody';
    box.appendChild(h3(t('report.record.custody.head')));
    for (const k of ['device', 'shared', 'name', 'klass']) {
      box.appendChild(sheetNote(t('report.record.custody.' + k)));
    }
    return box;
  }

  function sheetHead(rec) {
    const box = document.createElement('div');
    box.className = 'rp-sheet-head';
    const h = document.createElement('h1');
    h.textContent = rec.learner.name || t('report.record.anon');
    const sub = document.createElement('p');
    sub.className = 'rp-sheet-sub';
    // THE COURSE AND THE UNIT THIS DOCUMENT IS ABOUT, NOT THE ONE THAT SHIPPED
    // FIRST. This line printed one fixed bundle key on every unit, so a record
    // of a learner's quadratics work was filed under "Algebra I · Level 1 · The
    // Cipher Worlds". The name now comes from the manifest keys of the units
    // that are open (src/report/standards.js `unitTitle`), and falls back to
    // the old key only if the manifest cannot name them.
    sub.textContent = [
      rec.learner.group,
      t('report.record.levelLine', { level: rec.level?.name || t('report.record.levelName') }),
      t('report.record.generatedLine', { date: dateText(rec.generatedAt, true) }),
    ].filter(Boolean).join(' · ');
    box.append(h, sub);
    const trust = document.createElement('p');
    trust.className = `rp-doc-trust t-${rec.trust.level}`;
    trust.textContent = t('report.record.trustNote.' + rec.trust.level);
    box.appendChild(trust);
    return box;
  }

  function foot(rec) {
    const p = document.createElement('p');
    p.className = 'rp-sheet-foot';
    p.textContent = t('report.record.foot', {
      id: rec.recordId ? rec.recordId.slice(0, 8) : t('report.record.anon'),
      n: num(rec.observations ?? rec.totals.items),
    });
    return p;
  }

  /**
   * One claim, said in a sentence a teacher can check against the table.
   *
   * THE CHIP THAT WAS SAYING MORE THAN THE ENGINE KNOWS.
   *
   * This read "across {n} representations", which a teacher reads as *the
   * learner met this idea on two different surfaces*. That is not what was
   * counted. `pv.reps` is the set of `rep` LABELS the run's items carried, and
   * a label sits on the item form, not on the act. Two forms of one line can
   * carry two labels and ask for exactly the same thing:
   *
   *   rule-from-table  four forms, labelled table / table / context / verbal.
   *                    Every one of them is answered with a value out of the
   *                    same four-row table. The `context` form is the `table`
   *                    form with a scene sentence in front of it.
   *   write-linear     `wl-context` (labelled context) prints a sentence with
   *                    no numbers in it beside the same two coordinate pairs
   *                    `wl-points` (labelled symbolic) prints. The sentence
   *                    carries no quantity the learner uses.
   *
   * So a run can satisfy "spanned two representations" and "included a
   * modelling item" by doing one act three times. The engine-side fix is a
   * measure of whether two forms are the same ACT — the same answer type over
   * the same drawn quantity — rather than whether they carry two labels, and it
   * belongs in `src/learn/mastery.js` (`s.check.reps`, `s.check.modelled`,
   * `spans`) and in `tools/simulate.mjs` (`XFER.twoReps`, `XFER.modelled`).
   * Neither is this lane's file and neither is changed here.
   *
   * What IS changed here is the sentence on the paper. The record now reports
   * the label count as a label count, and `repsNote()` says on the sheet what
   * the label does and does not prove. A record that overstates one leg of its
   * own evidence is worth less than a record that states it exactly.
   */
  function claimText(c) {
    const road = t('report.road.' + c.road);
    const parts = [road, t('report.record.claimItemsShort', { n: c.items, band: c.band })];
    // A run that stumbled and paid for it. On the sight road this is the whole
    // difference between "proved out cold" and "opened cold, then worked for
    // it", and the printed record used to show neither.
    if (c.missed) parts.push(t('report.record.claimMissed', { n: c.missed }));
    if (c.reps.length > 1) parts.push(t('report.record.claimReps', { n: c.reps.length }));
    if (c.regrant) parts.push(t('report.record.claimRegrant'));
    return parts.join(' · ');
  }

  /** Does any claim on this record lean on the representation label? */
  function anyLabelledSpan(rec) {
    return rec.skills.some((s) => s.claim && (s.claim.reps || []).length > 1);
  }

  /**
   * The standards cell on the line-by-line table, in the framework the teacher
   * chose. It used to print both at once, which meant a Texas reader scanned
   * past Common Core codes in every row of a sheet they were about to file.
   */
  function standardsText(s, rec) {
    const rows = rec.framework === 'teks' ? s.teks : s.ccss;
    return rows
      .map((c) => `${shortCode(c.code)} (${t('report.std.depth.' + (c.depth || 'unknown'))})`)
      .join(', ');
  }

  // ------------------------------------------------------------------ class --
  function renderClass() {
    const box = q('.rp-class-sheet');
    box.innerHTML = '';
    const head = document.createElement('div');
    head.className = 'rp-sheet-head';
    const h = document.createElement('h1');
    h.textContent = t('report.record.classTitle');
    const sub = document.createElement('p');
    sub.className = 'rp-sheet-sub';
    sub.textContent = t('report.record.classSub', {
      n: roster.length, date: dateText(new Date().toISOString(), true),
    });
    head.append(h, sub);
    box.appendChild(head);

    if (!roster.length) {
      const p = document.createElement('p');
      p.className = 'rp-note';
      p.textContent = t('report.record.classEmpty');
      box.appendChild(p);
      return;
    }

    const tbl = document.createElement('table');
    tbl.className = 'rp-table';
    tbl.innerHTML = '<thead><tr></tr></thead><tbody></tbody>';
    for (const k of ['report.record.col.student', 'report.record.col.held', 'report.record.col.items',
      'report.record.col.unaided', 'report.record.col.time', 'report.record.col.testedOut',
      'report.record.col.withdrawn', 'report.record.col.generated']) {
      const th = document.createElement('th');
      th.textContent = t(k);
      tbl.querySelector('thead tr').appendChild(th);
    }
    for (const r of [...roster].sort((a, b) => b.totals.held - a.totals.held)) {
      const tr = document.createElement('tr');
      for (const c of [
        r.learner.name || t('report.record.anon'),
        `${num(r.totals.held)} / ${num(r.totals.total)}`,
        num(r.totals.items),
        r.totals.accuracy == null ? '—' : pct(r.totals.accuracy),
        r.totals.timeMs == null ? '—' : duration(r.totals.timeMs).full,
        num(r.totals.testedOut),
        num(r.totals.withdrawn),
        dateText(r.generatedAt),
      ]) {
        const td = document.createElement('td');
        td.textContent = c;
        tr.appendChild(td);
      }
      tbl.querySelector('tbody').appendChild(tr);
    }
    box.appendChild(tbl);

    box.appendChild(h3(t('report.record.byLineHead')));
    const bys = classBySkill(roster);
    const t2 = document.createElement('table');
    t2.className = 'rp-table';
    t2.innerHTML = '<thead><tr></tr></thead><tbody></tbody>';
    for (const k of ['report.record.col.skill', 'report.record.col.classHeld',
      'report.record.col.classProving', 'report.record.col.classWorking', 'report.record.col.classLocked']) {
      const th = document.createElement('th');
      th.textContent = t(k);
      t2.querySelector('thead tr').appendChild(th);
    }
    for (const row of bys) {
      const tr = document.createElement('tr');
      for (const c of [row.title, `${num(row.held)} / ${num(row.n)}`, num(row.proving), num(row.working), num(row.locked)]) {
        const td = document.createElement('td');
        td.textContent = c;
        tr.appendChild(td);
      }
      t2.querySelector('tbody').appendChild(tr);
    }
    box.appendChild(t2);

    box.appendChild(custodyNote());

    const p = document.createElement('p');
    p.className = 'rp-sheet-foot';
    p.textContent = t('report.record.classFoot');
    box.appendChild(p);
  }

  // ------------------------------------------------------------------ bits --
  function button(key, fn, kind = '') {
    const b = document.createElement('button');
    b.type = 'button';
    b.className = `rp-btn${kind ? ' ' + kind : ''}`;
    b.textContent = t(key);
    b.addEventListener('click', fn);
    return b;
  }

  function h3(text) {
    const el = document.createElement('h3');
    el.className = 'rp-sheet-h';
    el.textContent = text;
    return el;
  }

  /**
   * The strip of headline figures, as a definition list that CAN WRAP.
   *
   * THE STATISTIC THAT DID NOT COME OUT OF THE PRINTER. `.rp-sum` used to be a
   * flat `dl` of alternating `dt`/`dd` laid out with `grid-auto-flow:column`
   * over two rows, with `overflow-x:auto` to catch the spill. On glass that is
   * a strip a reader can push. ON PAPER THERE IS NOTHING TO PUSH: whatever sits
   * past `clientWidth` is simply never inked, and what sat last was
   * `sum.withdrawn` — claims withdrawn, the one figure on the sheet that says
   * how often this record took a claim back.
   *
   * Measured on the shipped build, @media print, `?unit=algebra1-l2`: the seven
   * columns need 978 px in English, 1141 px in Polish and 1180 px in Spanish.
   * A4 landscape gives the print engine 1032 px and US Letter landscape 965 px,
   * so English came out whole and Spanish lost its last column by 148 px and
   * Polish by 109 px — on every paper a teacher would pick for a wide table. It
   * was cut on a 1600 px SCREEN in those two languages as well; the strip
   * scrolled, inside a modal, with no thumb a reader would look for.
   *
   * A statistic that is present in one language and absent in two is not a
   * layout preference, it is a different document. So each label and its figure
   * are now one block, the list wraps to as many columns as the paper has room
   * for, and nothing anywhere reaches for `overflow-x`.
   */
  function sumList(rows) {
    const dl = document.createElement('dl');
    dl.className = 'rp-sum';
    for (const [k, v] of rows) {
      const cell = document.createElement('div');
      cell.className = 'rp-sum-cell';
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = v;
      cell.append(dt, dd);
      dl.appendChild(cell);
    }
    return dl;
  }

  /**
   * A note that belongs on the paper. `.rp-note` is hidden by the print
   * stylesheet — correctly, because it is the class the on-screen identity
   * hints use — so a note the printed sheet needs carries its own class.
   */
  function sheetNote(text) {
    const p = document.createElement('p');
    p.className = 'rp-sheet-note';
    p.textContent = text;
    return p;
  }

  /** An empty ruled table with a localised header row. */
  function table(keys) {
    const tbl = document.createElement('table');
    tbl.className = 'rp-table';
    tbl.innerHTML = '<thead><tr></tr></thead><tbody></tbody>';
    const tr = tbl.querySelector('thead tr');
    for (const k of keys) {
      const th = document.createElement('th');
      th.textContent = t(k);
      tr.appendChild(th);
    }
    return tbl;
  }

  return {
    get open() { return open.value; },
    show, close, render,
    /** For critics: the record this screen would export, right now. */
    record: () => build(learner),
    roster: () => roster,
  };
}

function download(name, text, mime) {
  const url = URL.createObjectURL(new Blob([text], { type: `${mime};charset=utf-8` }));
  const a = document.createElement('a');
  a.href = url;
  a.download = name;
  a.rel = 'noopener';
  document.body.appendChild(a);
  a.click();
  a.remove();
  setTimeout(() => URL.revokeObjectURL(url), 4000);
}

function loadJson(key) {
  try { return JSON.parse(localStorage.getItem(key) || 'null'); } catch { return null; }
}
function saveJson(key, value) {
  try { localStorage.setItem(key, JSON.stringify(value)); } catch { /* private mode */ }
}
