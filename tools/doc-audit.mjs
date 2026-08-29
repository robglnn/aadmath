/**
 * THE DOCUMENTS A DISTRICT FILES, READ AS A DISTRICT READS THEM.
 *
 * `content/STANDARDS.md` printed the literal word `undefined` in TWENTY-TWO
 * consecutive rows, in the column headed *The expectation, word for word*,
 * three lines under a sentence promising that "every expectation is quoted in
 * full so a reader can price the gap rather than guess at it". Every gate in
 * this build was green while it did. They were green because every one of them
 * reads the SOURCES — the graphs, the inventory, the manifest — and the defect
 * was in the last step, where a field that exists in one source and not the
 * other was interpolated straight into the page. `--check` byte-compared the
 * document against itself and agreed with it perfectly.
 *
 * So this module reads the OUTPUT, as text, and asks three questions of it.
 * None of them needs to know what the document is about.
 *
 *   1. NO VALUE MAY BE A JAVASCRIPT ACCIDENT. `undefined`, `null`, `NaN`,
 *      `Infinity`, `[object Object]`, an unexpanded `${...}` — anywhere in the
 *      file, not only in a table cell, because the same mistake in a sentence
 *      reads as a sentence.
 *
 *      `undefined` is also an English word, and a mathematical one: 19 TAC
 *      §111.39(c)(2)(G) says "determine whether the slope of the line is zero
 *      or undefined", and this course quotes it. A rule that fires on that
 *      sentence is a rule somebody switches off. So an honest occurrence is
 *      not guessed at — it is WRITTEN DOWN, as an exact phrase with a reason,
 *      in the caller's allow list, under the same discipline as the build's
 *      `NOT_IN_BUILD`. An allowance nothing uses is itself a fault, so the
 *      list cannot quietly outlive the sentence it was written for.
 *
 *   2. A CITATION COLUMN MAY NOT HAVE AN EMPTY CELL. A blank where a citation
 *      belongs reads as "no citation is needed here", which is a claim. If
 *      there is genuinely nothing to cite, the cell says so with an em dash —
 *      that is a statement a reader can argue with. Blank is not.
 *      Every OTHER cell in every table must be non-empty for the same reason.
 *
 *   3. A COVERAGE FIGURE MUST NAME ITS SCOPE. "10 of 49" is not a fact until
 *      the reader knows whether it is what a class receives or what is on
 *      disk; this product ships two of five units and the two numbers differ
 *      by a factor of nearly three. A figure names its scope if the scope word
 *      is in the same sentence, in its row, or in its own column's header.
 *
 * Every rule reports a line number and quotes the text, because a finding a
 * human has to go and re-find is a finding the report buried.
 */

/** The renderings of a value that is not there. None has an honest use as a value. */
const NULLISH = [
  'undefined', 'null', 'NaN', 'Infinity', '[object Object]', '[object ', 'undefinedundefined',
];
/** Template syntax that reached the page instead of being expanded. */
const UNEXPANDED = /\$\{[^}]*\}|%[sd]\b/;

/**
 * Words that say WHICH course a figure is about. Every one of them is a phrase
 * this product's documents already use; none of them is invented here.
 */
const SCOPE = new RegExp([
  'on the shipped route', 'on the route', 'on route', 'shipped route', 'ON ROUTE',
  'in class', 'IN CLASS', 'a class', 'the class', 'this course', 'the course',
  'on disk', 'everything on disk', 'preview', 'claimed nowhere', 'nowhere',
  'composed', 'standalone', 'per unit', 'this unit', 'route column',
].join('|'), 'i');

/**
 * A coverage figure: a count out of a denominator, in a sentence that says what
 * is being counted. `2 of 5 units`, `10 of the 49` expectations, `24 of 62`
 * skills. A bare fraction with no coverage noun near it is arithmetic, not
 * coverage, and is left alone.
 */
const FIGURE = /\b\d+ of (?:the )?\d+\b/g;
const COUNTED = /\b(expectation|student expectation|skill|unit|standard|code|TEKS|CCSS)/i;

const clean = (s) => String(s).replace(/[*`_]/g, '').trim();

/** Split one markdown table row into its cells. Returns null if it is not one. */
function cells(line) {
  const t = line.trim();
  if (!t.startsWith('|')) return null;
  const parts = t.replace(/^\|/, '').replace(/\|$/, '').split('|');
  return parts;
}

const isRule = (line) => /^\s*\|[\s:|-]+\|\s*$/.test(line);

/**
 * Every table in a markdown file, as {header:string[], rows:[{n,cells}]}.
 * A table is a header line, a rule line, and the rows that follow it.
 */
export function tablesOf(text) {
  const lines = text.split('\n');
  const out = [];
  for (let i = 0; i < lines.length - 1; i++) {
    if (!isRule(lines[i + 1])) continue;
    const head = cells(lines[i]);
    if (!head) continue;
    const t = { header: head.map(clean), headLine: i + 1, rows: [] };
    for (let j = i + 2; j < lines.length; j++) {
      const c = cells(lines[j]);
      if (!c || isRule(lines[j])) break;
      t.rows.push({ n: j + 1, cells: c, line: lines[j] });
    }
    out.push(t);
    i += 1 + t.rows.length;
  }
  return out;
}

/** Which columns of a table hold a citation or a code. */
const CITATION_COL = /^(19 TAC|citation|code|standard|framework)$/i;

/**
 * @param {string} text        the rendered document
 * @param {object} opt
 * @param {string} opt.name    what to call it in a finding
 * @param {{phrase:string, why:string}[]} opt.allow
 *        Occurrences of a nullish token that are honest English or honest
 *        mathematics, each with a reason. An allowance that matches nothing in
 *        the document is a fault of its own.
 * @returns {string[]} findings, empty when the document is clean
 */
export function documentFaults(text, { name = 'the document', allow = [] } = {}) {
  const faults = [];
  const lines = text.split('\n');
  const at = (i, s) => `${name}:${i + 1} — ${s}`;
  const used = new Set();

  // --- 1. no value may be a javascript accident ------------------------------
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    for (const tok of NULLISH) {
      let from = 0;
      for (;;) {
        const k = line.indexOf(tok, from);
        if (k < 0) break;
        from = k + tok.length;
        // A longer token already reported this position.
        if (tok === 'undefined' && line.slice(k, k + 'undefinedundefined'.length) === 'undefinedundefined') continue;
        if (tok === '[object ' && line.includes('[object Object]')) continue;
        // Word tokens must be whole words; `nullish` and `Nannette` are not faults.
        if (/^[A-Za-z]+$/.test(tok)) {
          const before = line[k - 1] || ' ';
          const after = line[k + tok.length] || ' ';
          if (/[A-Za-z0-9_]/.test(before) || /[A-Za-z0-9_]/.test(after)) continue;
        }
        /* An allowance covers an occurrence that lies INSIDE its phrase —
           every occurrence of that phrase on the line, not only the first,
           because a caveat may quote the standard twice in one sentence. */
        const excuse = allow.find((a) => {
          for (let j = line.indexOf(a.phrase); j >= 0; j = line.indexOf(a.phrase, j + 1)) {
            if (k >= j && k < j + a.phrase.length) return true;
          }
          return false;
        });
        if (excuse) { used.add(excuse.phrase); continue; }
        const cellText = (cells(line) || []).map(clean).find((c) => c.includes(tok));
        faults.push(at(i, `\`${tok}\` reached the page${cellText !== undefined ? ` — the cell reads "${cellText.slice(0, 80)}"` : ''}: ${line.trim().slice(0, 160)}`));
      }
    }
    if (UNEXPANDED.test(line) && !line.includes('```')) {
      faults.push(at(i, `an unexpanded template placeholder: ${line.trim().slice(0, 160)}`));
    }
  }
  for (const a of allow) {
    if (!used.has(a.phrase)) {
      faults.push(`${name} — the allowance for "${a.phrase}" matches nothing in this document any more. `
        + `Delete it, or find out what happened to the sentence it was written for. (Reason on file: ${a.why})`);
    }
  }

  // --- 2. no empty cell, and never in a citation column -----------------------
  for (const t of tablesOf(text)) {
    const citeCols = t.header.map((h) => CITATION_COL.test(h) || /19 TAC/i.test(h));
    for (const r of t.rows) {
      for (let c = 0; c < r.cells.length; c++) {
        const v = clean(r.cells[c] || '');
        const col = t.header[c] || `column ${c + 1}`;
        if (v !== '') continue;
        if (citeCols[c]) {
          faults.push(at(r.n - 1, `an EMPTY CELL where a citation belongs, under "${col}". `
            + `A blank reads as "nothing needs citing here", which is a claim. Write an em dash and a reason: ${r.line.trim().slice(0, 160)}`));
        } else {
          faults.push(at(r.n - 1, `an empty cell under "${col}" — write an em dash rather than nothing: ${r.line.trim().slice(0, 160)}`));
        }
      }
    }
  }

  // --- 3. a coverage figure must name its scope ------------------------------
  //
  // A figure names its scope when the scope word is in the same sentence, in
  // the row's own label, or in the table's header — because a column headed
  // "On the shipped route" scopes every number under it.
  const tables = tablesOf(text);
  const rowOf = new Map();
  for (const t of tables) for (const r of t.rows) rowOf.set(r.n, { t, r });
  let fenced = false;
  for (let i = 0; i < lines.length; i++) {
    const line = lines[i];
    if (line.trim().startsWith('```')) { fenced = !fenced; continue; }
    if (fenced) continue;
    const hits = line.match(FIGURE);
    if (!hits) continue;
    const here = rowOf.get(i + 1);
    const counted = COUNTED.test(line) || (here && here.t.header.some((h) => COUNTED.test(h)));
    if (!counted) continue;
    if (SCOPE.test(line)) continue;
    if (here && (here.t.header.some((h) => SCOPE.test(h)) || SCOPE.test(clean(here.r.cells[0] || '')))) continue;
    faults.push(at(i, `a coverage figure with no scope beside it — "${hits.join('", "')}" `
      + `is not a fact until the reader knows whether it is what a class receives or what is on disk: ${line.trim().slice(0, 160)}`));
  }

  return faults;
}
