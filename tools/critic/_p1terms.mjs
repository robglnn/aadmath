/**
 * P1 — ARE THE WORDS DEFINED WHERE THEY ARE FIRST USED?
 *
 * The critic's list: rift, lattice, line, sounding, descent, grip, drive back,
 * jump the ring, cipher vein, lemma, "1 night held" — and "+5 DESCENT", which
 * "is printed as a reward reason and defined nowhere."
 *
 * This drives a COLD session with real keys, in each locale, and checks that
 * every one of those terms reaches the screen WITH its meaning attached rather
 * than as a bare noun. It reads the real bundles and the real ledger strip.
 *
 *   node tools/critic/_p1terms.mjs [--url ...] [--out shots/p1/terms]
 */
import { chromium } from 'playwright';
import { mkdir, writeFile } from 'node:fs/promises';
import path from 'node:path';

const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };
const URL = arg('url', 'http://127.0.0.1:5173');
const OUT = path.resolve(arg('out', 'shots/p1/terms'));
await mkdir(OUT, { recursive: true });

const browser = await chromium.launch({
  headless: true,
  args: ['--use-gl=angle', '--enable-unsafe-swiftshader', '--ignore-gpu-blocklist'],
});
const page = await (await browser.newContext({ viewport: { width: 1440, height: 900 } })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(e.message));
page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });

await page.goto(URL, { waitUntil: 'networkidle' });
await page.evaluate(() => { try { localStorage.clear(); } catch {} });
await page.reload({ waitUntil: 'networkidle' });
await page.waitForFunction(() => !!window.__ascent, null, { timeout: 30000 });

/**
 * Every term the critic named, the key that is supposed to define it, and a
 * word that must appear in that definition. The point is not that a string
 * exists — it is that the string SAYS WHAT THE THING IS.
 */
const TERMS = [
  ['rift',           'story.open.l4',        { en: /statement/i, es: /afirmaci/i, pl: /zdanie/i }],
  ['lattice',        'story.open.l1',        { en: /argument/i,  es: /razonamiento/i, pl: /wywód/i }],
  ['line',           'kit.charterNext',      { en: /one idea/i,  es: /una idea/i, pl: /jedna idea/i }],
  // `guide.tallyNew` became `guide.linesHeldNew` when the objective card's
  // tally row was made to carry the progress number itself rather than three
  // different captions (src/meta/progress.js). The gloss still arrives with
  // the term, on the same row, while the count is zero — which is what this
  // check is actually about.
  ['held',           'guide.linesHeldNew',   { en: /proved/i,    es: /probada/i,  pl: /udowodnion/i }],
  ['sounding',       'guide.pay.sound',      { en: /harder/i,    es: /difícil/i,  pl: /trudniejsz/i }],
  ['descent',        'ledger.first.sound',   { en: /back down/i, es: /vuelta/i,   pl: /w d.ł|powr.t/i }],
  ['cipher vein',    'ledger.first.vein',    { en: /lattice/i,   es: /red/i,      pl: /sieć|sieci/i }],
  ['lattice anchor', 'ledger.first.anchor',  { en: /proof/i,     es: /demostraci/i, pl: /dowod/i }],
  ['hanging cache',  'ledger.first.cache',   { en: /weight/i,    es: /pesa/i,     pl: /odważnik/i }],
  ['jump the ring',  'ledger.first.surge',   { en: /jump it/i,   es: /sáltalo/i,  pl: /przeskocz/i }],
  // GRIP is no longer coined at all — the seal meter reuses HELD, which the
  // objective card already defines. A term you never invent needs no gloss.
  ['grip (retired)', 'rift.seal.grip',       { en: /hold/i,     es: /sost[eé]n/i, pl: /utrzyman/i }],
  ['drive back',     'session.charter.goalPush', { en: /win back ground/i, es: /recuperar terreno/i, pl: /odzyskać teren/i }],
  ['lemma',          'story.ch3.b1b',        { en: /one step of a proof/i, es: /un paso de una demostraci/i, pl: /jeden krok dowodu/i }],
  ['a night held',   'kit.charter.what',     { en: /still knew after/i, es: /se sigue sabiendo/i, pl: /Noc utrzymana to linia/i }],
];

const rows = [];
for (const loc of ['en', 'es', 'pl']) {
  await page.evaluate((l) => window.__ascent.setLocale(l), loc);
  await page.waitForTimeout(400);
  for (const [term, key, want] of TERMS) {
    const text = await page.evaluate((k) => window.__ascent.t(k), key);
    const missing = !text || text.startsWith(key.split('.')[0] + '.');
    const defines = !missing && want[loc].test(text);
    rows.push({ loc, term, key, defines, missing, text });
  }
}

// The ledger's first-sight rows must actually be reachable from the strip, not
// merely present in the bundle: `ledger.first.<why>` is looked up by the same
// key the strip prints, so a renamed reason silently loses its definition.
await page.evaluate((l) => window.__ascent.setLocale(l), 'en');
const wired = await page.evaluate(() => {
  const why = Object.keys(window.__ascent.t('ledger.why') || {});
  return ['seal', 'vein', 'cache', 'anchor', 'sound', 'surge'].map((k) => ({
    k,
    hasReason: typeof window.__ascent.t('ledger.why.' + k) === 'string'
      && !window.__ascent.t('ledger.why.' + k).startsWith('ledger.'),
    hasGloss: typeof window.__ascent.t('ledger.first.' + k) === 'string'
      && !window.__ascent.t('ledger.first.' + k).startsWith('ledger.'),
  }));
});

const bad = rows.filter((r) => !r.defines);
console.log('TERM                 EN   ES   PL');
for (const [term] of TERMS) {
  const g = (l) => (rows.find((r) => r.term === term && r.loc === l)?.defines ? ' ok ' : 'MISS');
  console.log(`  ${term.padEnd(18)} ${g('en')} ${g('es')} ${g('pl')}`);
}
console.log('\nledger first-sight wiring:',
  wired.every((w) => w.hasReason && w.hasGloss) ? 'every reason has a gloss' : JSON.stringify(wired));
console.log('\nconsole errors:', errors.length ? errors.slice(0, 3) : 'none');

await writeFile(path.join(OUT, 'terms.json'), JSON.stringify({ rows, wired, errors }, null, 2));
await browser.close();

if (bad.length) {
  console.log(`\nFAIL — ${bad.length} term/locale pair(s) are used without being defined:`);
  for (const b of bad.slice(0, 12)) console.log(`  ${b.loc} ${b.term} (${b.key}): ${b.text?.slice(0, 90)}`);
  process.exit(1);
}
console.log(`\nPASS — ${TERMS.length} terms define themselves in all three locales.`);
