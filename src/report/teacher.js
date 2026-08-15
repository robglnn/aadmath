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
    e.stopPropagation();
    if (e.key === 'Escape') { e.preventDefault(); close(); }
  });
  for (const b of host.querySelectorAll('.rp-tab')) {
    b.addEventListener('click', () => { tab = b.dataset.tab; render(); });
  }

  function show() {
    open.value = true;
    host.classList.add('show');
    // The print stylesheet hides everything on the page except this document —
    // which would turn Ctrl+P on the *game* into a blank sheet of paper. It is
    // switched on only while the document is actually open.
    document.body.dataset.rpDoc = 'on';
    render();
    onToggle?.(true);
  }
  function close() {
    if (!open.value) return;
    open.value = false;
    host.classList.remove('show');
    delete document.body.dataset.rpDoc;
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
      t('report.record.stdSub', { frame: t('report.std.frame.full.' + fw) }),
      t('report.record.generatedLine', { date: dateText(rec.generatedAt, true) }),
    ].filter(Boolean).join(' · ');
    const auth = document.createElement('p');
    auth.className = 'rp-doc-trust';
    auth.textContent = t('report.std.frame.authority.' + fw);
    head.append(h, sub, auth);
    box.appendChild(head);

    // --- the five figures -------------------------------------------------
    const dl = document.createElement('dl');
    dl.className = 'rp-sum';
    for (const [k, v] of [
      [t('report.record.col.framework'), t('report.std.frame.' + fw)],
      [t('report.std.cover.evidenced'), `${num(cov.totals.evidenced)} / ${num(cov.totals.total)}`],
      [t('report.std.cover.group.held'), num(cov.totals.held)],
      [t('report.std.cover.core'), `${num(cov.totals.coreHeld)} / ${num(cov.totals.coreTotal)}`],
      [t('report.std.cover.untouched'), num(cov.totals.none)],
    ]) {
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = v;
      dl.append(dt, dd);
    }
    box.appendChild(dl);

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
    const dl = document.createElement('dl');
    dl.className = 'rp-sum';
    const rows = [
      [t('report.record.sum.held'), `${num(rec.totals.held)} / ${num(rec.totals.total)}`],
      [t('report.record.sum.items'), num(rec.totals.items)],
      [t('report.record.sum.unaided'), rec.totals.accuracy == null ? t('report.record.notMeasured') : pct(rec.totals.accuracy)],
      [t('report.record.sum.time'), rec.totals.timeMs == null ? t('report.record.notMeasured') : duration(rec.totals.timeMs).full],
      [t('report.record.sum.claimItems'), num(rec.totals.claimItems)],
      [t('report.record.sum.testedOut'), num(rec.totals.testedOut)],
      [t('report.record.sum.withdrawn'), `${num(rec.totals.withdrawn)} / ${num(rec.totals.granted)}`],
    ];
    for (const [k, v] of rows) {
      const dt = document.createElement('dt'); dt.textContent = k;
      const dd = document.createElement('dd'); dd.textContent = v;
      dl.append(dt, dd);
    }
    host2.appendChild(dl);

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

    host2.appendChild(foot(rec));
  }

  function sheetHead(rec) {
    const box = document.createElement('div');
    box.className = 'rp-sheet-head';
    const h = document.createElement('h1');
    h.textContent = rec.learner.name || t('report.record.anon');
    const sub = document.createElement('p');
    sub.className = 'rp-sheet-sub';
    sub.textContent = [
      rec.learner.group,
      t('report.record.levelLine', { level: t('report.record.levelName') }),
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

  /** One claim, said in a sentence a teacher can check against the table. */
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
