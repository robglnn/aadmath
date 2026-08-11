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
 *                evidence behind the claim, the road it was granted on, both
 *                standards frameworks with their coverage depth, and the
 *                withdrawn claims. Printable to paper or PDF, exportable as
 *                JSON (the whole record) or CSV (a gradebook row per line).
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
  recordToCsv, classToCsv, classBySkill, isRecord, fileName, duration, dateText,
} from './record.js';

const LEARNER_KEY = 'ascent.learner';
const CLASS_KEY = 'ascent.class';

export function createTeacher({ build, onToggle }) {
  const host = document.createElement('div');
  host.className = 'rp-doc-host';
  host.id = 'rp-doc-host';
  host.innerHTML = `<section class="rp-doc" role="dialog" aria-modal="true">
      <header class="rp-doc-head">
        <div class="rp-titles"><h2 class="rp-h rp-doc-h"></h2><p class="rp-sub rp-doc-sub"></p></div>
        <button class="rp-x rp-doc-x" type="button"></button>
      </header>
      <nav class="rp-tabs" role="tablist">
        <button class="rp-tab on" type="button" data-tab="one" role="tab"></button>
        <button class="rp-tab" type="button" data-tab="class" role="tab"></button>
      </nav>
      <div class="rp-doc-body">
        <div class="rp-pane p-one">
          <div class="rp-ident"></div>
          <div class="rp-acts"></div>
          <div class="rp-sheet"></div>
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
    const tabs = [...host.querySelectorAll('.rp-tab')];
    tabs[0].textContent = t('report.record.tab.one');
    tabs[1].textContent = t('report.record.tab.class', { n: roster.length });
    for (const b of tabs) b.classList.toggle('on', b.dataset.tab === tab);
    q('.p-one').hidden = tab !== 'one';
    q('.p-class').hidden = tab === 'one';
    document.body.dataset.rpPrint = tab === 'one' ? 'one' : 'class';
    if (tab === 'one') { renderIdentity(); renderActions(); renderSheet(); }
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
        num(s.items),
        s.accuracy == null ? '—' : pct(s.accuracy),
        s.timeMs == null ? '—' : duration(s.timeMs).full,
        probes ? t('report.evidence.probeCount', { hit: s.probes.hit, n: probes }) : '—',
        standardsText(s),
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
    if (c.reps.length > 1) parts.push(t('report.record.claimReps', { n: c.reps.length }));
    if (c.regrant) parts.push(t('report.record.claimRegrant'));
    return parts.join(' · ');
  }

  function standardsText(s) {
    const all = [
      ...s.ccss.map((c) => `${c.code.replace('CCSS.MATH.CONTENT.', '')} (${t('report.std.depth.' + (c.depth || 'unknown'))})`),
      ...s.teks.map((c) => `${c.code} (${t('report.std.depth.' + c.depth)})`),
    ];
    return all.join(', ');
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
