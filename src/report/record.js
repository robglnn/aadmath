/**
 * The learner record: the report as a document rather than as a screen.
 *
 * A progress screen a teacher has to stand behind a student to read is not
 * evidence of anything — it cannot be filed, attached to a person, compared
 * across a class, or handed to a department head who was not in the room. So
 * everything the report knows is also assembled here, once, as a plain object
 * with a name and a date on it, and that object is what the printout, the JSON
 * export, the CSV export and the class aggregate are all built from. One
 * source, four shapes: a figure can never differ between the screen and the
 * paper, because there is only one place it is computed.
 *
 * Three rules the shape follows:
 *
 *   NOTHING IS A GRADE. Every number is recomputed from the learner model and
 *   the evidence ledger at the moment of export. There is no stored score to
 *   drift out of date, and the record says so on its face.
 *
 *   EVIDENCE TRAVELS WITH THE CLAIM. A skill row carries the road the claim was
 *   granted on and the item counts behind it, so "held" can be checked rather
 *   than believed — including by someone reading the CSV in a spreadsheet with
 *   the game nowhere in sight.
 *
 *   THE RECORD SAYS WHAT IT DOES NOT KNOW. A restored or partial record carries
 *   its own trust level, and the fields that were rebuilt rather than measured
 *   come back null instead of coming back flattering.
 */
import { t, num, getLocale } from '../i18n/index.js';

/**
 * A duration a teenager reads without decoding, and a teacher reads without
 * converting. Under a minute is seconds, under an hour is minutes, above that
 * is hours and minutes — never "0.73 h". Lives here because the screen and the
 * printed record must never round differently.
 */
export function duration(ms) {
  const sec = Math.round(ms / 1000);
  if (sec < 60) return { big: num(sec), small: t('report.unit.sec'), full: t('report.unit.secFull', { n: sec }) };
  const min = Math.round(sec / 60);
  if (min < 60) return { big: num(min), small: t('report.unit.min'), full: t('report.unit.minFull', { n: min }) };
  const h = Math.floor(min / 60);
  const m = min % 60;
  return { big: num(h), small: t('report.unit.hr'), full: t('report.unit.hrFull', { h, m }) };
}

/** A date a person reads, in the locale they are reading the record in. */
export function dateText(iso, withTime = false) {
  if (!iso) return t('report.record.unknownDate');
  const d = new Date(iso);
  if (Number.isNaN(+d)) return t('report.record.unknownDate');
  return new Intl.DateTimeFormat(getLocale(), withTime
    ? { dateStyle: 'long', timeStyle: 'short' }
    : { dateStyle: 'long' }).format(d);
}

export const RECORD_KIND = 'ascent.learner-record';
/**
 * 2 adds `framework` and `standards`: the expectation-level coverage, in the
 * framework the record was drawn in. Version 1 records still import — the
 * shape only grew, and `isRecord` checks the parts a class roster reads.
 */
export const RECORD_VERSION = 2;

const REPS = ['symbolic', 'context', 'verbal', 'table', 'graph'];

/**
 * Everything a teacher can be shown about one learner, as data.
 *
 * `depthOf` is injected rather than imported so this module never has to know
 * how the two standards frameworks store their coverage depth.
 */
export function buildRecord({ mastery, graph, tracker, learner, stateOf, depthOf, coverage }) {
  const total = graph.nodes.length;
  const held = graph.nodes.filter((n) => mastery.get(n.id).mastered).length;
  const trust = tracker.trust();
  // Standard-level coverage in the framework this device reports in. It travels
  // inside the record rather than being recomputed by each reader, so the
  // printed sheet, the JSON a teacher files and the CSV they paste into a
  // gradebook cannot disagree about what was covered.
  const cov = coverage ? coverage() : null;

  const skills = graph.nodes.map((n) => {
    const s = mastery.get(n.id);
    const pv = s.mastered ? s.provenBy : null;
    const probes = tracker.probesFor(n.id);
    return {
      id: n.id,
      title: t('skills.' + n.id),
      state: stateOf(n.id),
      pL: round(s.pL, 3),
      difficulty: s.difficulty,
      items: tracker.itemsFor(n.id),
      timeMs: trust.msTrusted ? tracker.msFor(n.id) : null,
      accuracy: round(tracker.accuracyFor(n.id), 3),
      // The receipt, or an honest null. Never the configured thresholds.
      claim: pv
        ? {
          road: pv.road,
          entryRun: pv.entryRun,
          entryNeed: pv.entryNeed,
          checkDone: pv.checkDone,
          checkNeed: pv.checkNeed,
          band: pv.band,
          items: pv.items,
          reps: pv.reps,
          forms: pv.forms.length,
          novel: pv.novel,
          regrant: pv.regrant,
          at: pv.at ? new Date(pv.at).toISOString() : null,
        }
        : null,
      probes: { hit: probes.hit, miss: probes.miss },
      reps: REPS.filter((r) => (s.repsCorrect[r] || 0) > 0),
      slip: mastery.topMisconception(n.id),
      ccss: (n.standards || []).map((x) => ({ code: x.code, depth: depthOf('ccss', n.id, x.code) })),
      teks: (n.teks || []).map((x) => ({ code: x.code, citation: x.citation, depth: x.depth })),
    };
  });

  return {
    kind: RECORD_KIND,
    v: RECORD_VERSION,
    generatedAt: new Date().toISOString(),
    locale: getLocale(),
    level: { id: graph.id, title: graph.title, frameworks: graph.frameworks || [] },
    framework: cov?.framework || null,
    standards: cov
      ? {
        totals: cov.totals,
        rows: cov.rows.map((r) => ({
          code: r.short,
          citation: r.citation,
          text: r.text,
          depth: r.depth,
          cover: r.cover,
          heldLines: r.heldLines,
          totalLines: r.totalLines,
          lines: r.lines.map((l) => ({ id: l.id, title: t('skills.' + l.id), depth: l.depth, state: l.state })),
          formsMet: r.formsMet,
          formsDeclared: r.formsDeclared,
          answers: r.answers,
          unaided: r.unaided,
          thin: r.thin,
        })),
      }
      : null,
    learner: { name: (learner?.name || '').trim() || null, group: (learner?.group || '').trim() || null },
    recordId: tracker.state.recordId || null,
    observations: tracker.state.seq ?? null,
    trust: {
      level: trust.level,
      reasons: trust.reasons || [],
      msTrusted: !!trust.msTrusted,
      rebuiltItems: trust.rebuiltItems || 0,
      rebuiltClaims: trust.rebuiltClaims || 0,
    },
    totals: {
      held,
      total,
      items: tracker.items(),
      accuracy: round(tracker.accuracy(), 3),
      timeMs: trust.msTrusted ? tracker.totalMs() : null,
      sessions: tracker.sessions(),
      granted: tracker.granted(),
      withdrawn: tracker.withdrawn(),
      hollowRate: round(tracker.hollowRate(), 3),
      // The share of held lines that were granted on the fast cold road. A
      // teacher asking "did they really do the work?" is asking this.
      testedOut: skills.filter((s) => s.claim?.road === 'sight').length,
      claimItems: skills.reduce((a, s) => a + (s.claim?.items || 0), 0),
    },
    skills,
    withdrawnList: tracker.withdrawnList().map((w) => ({
      id: w.id, title: t('skills.' + w.id), at: w.at ? new Date(w.at).toISOString() : null, rebuilt: !!w.rebuilt,
    })),
  };
}

const round = (x, n) => (x == null ? null : Number(x.toFixed(n)));

/**
 * The record as a spreadsheet. One row per skill, every row carrying the
 * learner and the date, because a CSV loses its header block the moment it is
 * pasted into a gradebook next to another one.
 */
export function recordToCsv(rec) {
  const head = [
    t('report.record.col.student'), t('report.record.col.group'), t('report.record.col.generated'),
    t('report.record.col.skill'), t('report.record.col.state'), t('report.record.col.confidence'),
    t('report.record.col.items'), t('report.record.col.unaided'), t('report.record.col.time'),
    t('report.record.col.road'), t('report.record.col.claimItems'), t('report.record.col.band'),
    t('report.record.col.retention'),
    // One standards column, in the framework this record was drawn in. Two
    // columns made a Texas gradebook carry Common Core codes it will never
    // read, and a teacher had to delete one before the file was usable.
    t('report.record.col.framework'), t('report.record.col.standards'),
    t('report.record.col.trust'),
  ];
  const name = rec.learner.name || t('report.record.anon');
  const frame = rec.framework ? t('report.std.frame.' + rec.framework) : '';
  const rows = rec.skills.map((s) => [
    name, rec.learner.group || '', rec.generatedAt,
    s.title, t('report.state.' + s.state), s.pL,
    s.items, s.accuracy == null ? '' : s.accuracy,
    s.timeMs == null ? '' : Math.round(s.timeMs / 1000),
    s.claim ? t('report.road.' + s.claim.road) : '',
    s.claim ? s.claim.items : '',
    s.claim ? s.claim.band : '',
    s.probes.hit + s.probes.miss ? `${s.probes.hit}/${s.probes.hit + s.probes.miss}` : '',
    frame,
    (rec.framework === 'teks' ? s.teks : s.ccss)
      .map((c) => `${short(c.code)} (${c.depth || '?'})`).join(' '),
    t('report.record.trust.' + rec.trust.level),
  ]);
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/**
 * The standards sheet as a spreadsheet. One row per expectation, in the
 * framework the record was drawn in — because a district that asks for a
 * coverage file asks for it in their own codes, and a file carrying both
 * frameworks makes the reader filter before they can read.
 */
export function standardsToCsv(rec) {
  const head = [
    t('report.record.col.student'), t('report.record.col.group'), t('report.record.col.generated'),
    t('report.record.col.framework'), t('report.record.col.code'), t('report.record.col.depth'),
    t('report.record.col.citation'), t('report.record.col.cover'), t('report.record.col.linesHeld'),
    t('report.record.col.carriedBy'), t('report.record.col.formsMet'), t('report.record.col.answers'),
    t('report.record.col.unaided'), t('report.record.col.expectation'),
  ];
  const name = rec.learner.name || t('report.record.anon');
  const frame = rec.framework ? t('report.std.frame.' + rec.framework) : '';
  const rows = (rec.standards?.rows || []).map((s) => [
    name, rec.learner.group || '', rec.generatedAt,
    frame, s.code, t('report.std.depth.' + (s.depth || 'unknown')),
    s.citation || '',
    t('report.std.cover.group.' + s.cover),
    `${s.heldLines}/${s.totalLines}`,
    s.lines.map((l) => l.title).join(' · '),
    `${s.formsMet}/${s.formsDeclared}`,
    s.answers, s.unaided,
    s.text,
  ]);
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/** A whole class as one table: one row per student, ready for a gradebook. */
export function classToCsv(recs) {
  const head = [
    t('report.record.col.student'), t('report.record.col.group'), t('report.record.col.generated'),
    t('report.record.col.held'), t('report.record.col.items'), t('report.record.col.unaided'),
    t('report.record.col.time'), t('report.record.col.testedOut'), t('report.record.col.withdrawn'),
    t('report.record.col.trust'),
  ];
  const rows = recs.map((r) => [
    r.learner.name || t('report.record.anon'), r.learner.group || '', r.generatedAt,
    `${r.totals.held}/${r.totals.total}`, r.totals.items,
    r.totals.accuracy == null ? '' : r.totals.accuracy,
    r.totals.timeMs == null ? '' : Math.round(r.totals.timeMs / 60000),
    r.totals.testedOut, r.totals.withdrawn,
    t('report.record.trust.' + r.trust.level),
  ]);
  return [head, ...rows].map((r) => r.map(csvCell).join(',')).join('\r\n');
}

/**
 * A spreadsheet cell. Excel reads a leading `=`, `+`, `-` or `@` as a formula,
 * so a value that starts with one is prefixed — a record is a document, and a
 * document must not execute.
 */
function csvCell(v) {
  let s = v == null ? '' : String(v);
  if (s && '=+-@'.includes(s[0])) s = `'${s}`;
  // The double quote is built rather than written: tools/check-i18n.mjs lexes
  // this file for stray English, and a `"` inside a regex literal desynchronises
  // its scanner for the rest of the file. Cheaper to avoid than to allow-list.
  const Q = String.fromCharCode(34);
  const needs = s.includes(Q) || s.includes(',') || s.includes('\r') || s.includes('\n');
  return needs ? Q + s.split(Q).join(Q + Q) + Q : s;
}

// i18n-allow: the CCSS code prefix is a standards identifier, not language
const short = (code) => code.replace('CCSS.MATH.CONTENT.', '');

/** Does this parsed file look like a record this build can read? */
export function isRecord(x) {
  return !!x && x.kind === RECORD_KIND && Array.isArray(x.skills) && !!x.totals;
}

/**
 * What a class holds, skill by skill. The one view a teacher wants that no
 * individual record can answer: which line is the class stuck on.
 */
export function classBySkill(recs) {
  const byId = new Map();
  for (const r of recs) {
    for (const s of r.skills) {
      // A record exported by a student playing in Spanish carries Spanish skill
      // names. The teacher reading the class table is reading it in their own
      // language, so the id is re-localised here and the stored name is only a
      // fallback for a line this build does not know.
      const local = t('skills.' + s.id);
      const title = local === 'skills.' + s.id ? s.title : local;
      const row = byId.get(s.id) || { id: s.id, title, held: 0, proving: 0, working: 0, locked: 0, n: 0 };
      row.n += 1;
      if (s.state === 'mastered' || s.state === 'provisional') row.held += 1;
      else if (s.state === 'proving') row.proving += 1;
      else if (s.state === 'locked') row.locked += 1;
      else row.working += 1;
      byId.set(s.id, row);
    }
  }
  return [...byId.values()];
}

/**
 * A file name a teacher can find again a month later. `tag` separates the two
 * CSVs a teacher can pull for the same student on the same day \u2014 the line sheet
 * and the standards sheet \u2014 so the second one does not silently overwrite the
 * first in a downloads folder.
 */
export function fileName(rec, ext, tag = '') {
  const who = (rec.learner.name || t('report.record.anon'))
    .normalize('NFD').replace(/[\u0300-\u036f]/g, '')
    .replace(/[^\w-]+/g, '-').replace(/^-|-$/g, '').slice(0, 40) || 'record';
  // i18n-allow: a download file name is a path, not display language
  const part = tag ? `${tag}-` : '';
  return `ascent-${part}${who}-${rec.generatedAt.slice(0, 10)}.${ext}`;
}
