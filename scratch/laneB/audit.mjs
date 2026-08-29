#!/usr/bin/env node
/**
 * LANE B independent audit — four rules, over every form the manifest ships.
 *
 *   node scratch/laneb/audit.mjs [--seeds N] [--unit algebra1-l4] [--rule surd]
 *
 * The rules are written here from the mathematics, not from the generators, so
 * a generator that is wrong cannot make the audit agree with it.
 *
 *  surd      every radical a learner is SHOWN (key or option) on a skill whose
 *            task is simplest form is c*sqrt(s) with s squarefree and s > 1.
 *  factor    every key that is a factorisation is COMPLETE: no numeric content
 *            left inside a bracket, no bracket that still factors over Z.
 *  phantom   the stem asks the learner to choose between candidates ("which
 *            answer / which cadet is right") and no candidates are printed.
 *  outvar    the key names a variable that appears nowhere on the card.
 */
import { generate, SKILLS, FORMS_BY_SKILL } from '../../src/learn/generators.js';
import { allUnits, loadUnit } from '../../tools/_courses.mjs';

const LOCALES = ['en', 'es', 'pl'];
const arg = (k, d) => { const i = process.argv.indexOf('--' + k); return i >= 0 ? process.argv[i + 1] : d; };

// ---------------------------------------------------------------- rule: surd
const sqfree = (n) => { for (let p = 2; p * p <= n; p++) if (n % (p * p) === 0) return false; return true; };
/** every \sqrt{...} with a plain whole-number radicand in a rendered string */
function radicandsOf(tex) {
  const out = [];
  const s = String(tex);
  for (const m of s.matchAll(/\\sqrt\s*\{\s*(-?\d+)\s*\}/g)) out.push(Number(m[1]));
  for (const m of s.matchAll(/\\sqrt\s*(\d)(?![\d{])/g)) out.push(Number(m[1]));
  return out;
}
/** a rooted index other than 2, e.g. \sqrt[3]{8} — those have their own rule */
const hasIndex = (tex) => /\\sqrt\s*\[/.test(String(tex));

// -------------------------------------------------------------- rule: factor
const gcd = (a, b) => (b ? gcd(b, a % b) : Math.abs(a));
/**
 * Split a rendered product into its top-level factors, as source strings.
 * `4x\left(x + 3\right)\left(x - 3\right)` -> ['4x', 'x + 3', 'x - 3'].
 * Returns null when the string is not a plain product of that shape.
 */
function bracketFactors(tex) {
  const s = String(tex).trim();
  if (/[=<>,]|\\text|\\frac|\\pm|\\sqrt|\\ldots/.test(s)) return null;
  const parts = [];
  let i = 0; let lead = '';
  while (i < s.length) {
    if (s.startsWith('\\left(', i)) {
      const close = findClose(s, i);
      if (close < 0) return null;
      parts.push(s.slice(i + 6, close));
      i = close + 7; // \right)
      // an exponent on a bracket repeats it
      const m = /^\s*\^\{(\d+)\}/.exec(s.slice(i));
      if (m) { for (let t = 1; t < Number(m[1]); t++) parts.push(parts[parts.length - 1]); i += m[0].length; }
      continue;
    }
    if (parts.length) return null;       // a monomial AFTER a bracket: not this shape
    lead += s[i]; i++;
  }
  if (!parts.length) return null;
  return { lead: lead.trim(), parts };
}
function findClose(s, at) {
  let depth = 0;
  for (let i = at; i < s.length; i++) {
    if (s.startsWith('\\left(', i)) { depth++; i += 5; continue; }
    if (s.startsWith('\\right)', i)) { depth--; if (!depth) return i; i += 6; continue; }
  }
  return -1;
}
/** integer coefficients of a rendered linear/quadratic factor in v, or null */
function intCoeffs(src, v) {
  const s = String(src).replace(/\\left|\\right|\s|\\cdot/g, '');
  if (!new RegExp(`^[-+0-9${v}^{}]*$`).test(s)) return null;
  const terms = s.replace(/-/g, '+-').split('+').filter(Boolean);
  const out = {};
  for (const t of terms) {
    const m = new RegExp(`^(-?\\d*)${v}(?:\\^\\{(\\d+)\\})?$`).exec(t);
    if (m) {
      const c = m[1] === '' ? 1 : (m[1] === '-' ? -1 : Number(m[1]));
      const p = m[2] ? Number(m[2]) : 1;
      out[p] = (out[p] || 0) + c;
      continue;
    }
    if (/^-?\d+$/.test(t)) { out[0] = (out[0] || 0) + Number(t); continue; }
    return null;
  }
  return out;
}
const contentOf = (co) => Object.values(co).reduce((g, c) => gcd(g, c), 0);
/** does this quadratic still come apart over the integers? */
function stillFactors(co) {
  const a = co[2] || 0, b = co[1] || 0, c = co[0] || 0;
  if (!a) return false;
  const disc = b * b - 4 * a * c;
  if (disc < 0) return false;
  const rt = Math.round(Math.sqrt(disc));
  return rt * rt === disc;
}

// ------------------------------------------------------------- rule: phantom
const CHOOSER = {
  en: /which (answer|cadet|reading)s?\b/i,
  es: /(qué|cuál|cual|que) (respuesta|cadete|lectura)/i,
  pl: /(któr[ayąe]\w*) (odpowied\w+|kadet|odczyt)/i,
};
/** two or more candidate values named in the sentence itself */
function printsCandidates(stem) {
  const src = String(stem);
  const toks = new Set();
  for (const m of src.matchAll(/\$([^$]+)\$/g)) toks.add(m[1].trim());
  for (const m of src.replace(/\$[^$]+\$/g, ' ').matchAll(/-?\d+(?:\.\d+)?/g)) toks.add(m[0]);
  return toks.size >= 2;
}

// -------------------------------------------------------------- rule: outvar
const LETTERS = (s) => new Set(
  String(s)
    .replace(/\\text\s*\{[^}]*\}/g, ' ')   // localized prose is not notation
    .replace(/\\[a-zA-Z]+/g, ' ')            // control sequences are not letters
    .match(/[a-zA-Z]/g) || []);
/** kinds whose whole task is to INTRODUCE notation for a situation */
const MODELLING = new Set(['equationChoice', 'model', 'writeRule', 'twoWayTable']);

async function main() {
  for (const { unit } of await allUnits()) await loadUnit(unit);
  const SEEDS = Number(arg('seeds', 60));
  const only = arg('rule', null);
  const onlySkill = arg('skill', null);
  const findings = new Map();
  let n = 0, bad = 0;
  const note = (rule, skill, form, loc, text, sample) => {
    const key = `${rule}|${skill}|${form}|${loc}|${text}`;
    const g = findings.get(key);
    if (g) { g.count++; return; }
    findings.set(key, { rule, skill, form, loc, text, sample, count: 1 });
  };

  for (const skill of SKILLS) {
    if (onlySkill && skill !== onlySkill) continue;
    for (const form of (FORMS_BY_SKILL[skill] || [])) {
      for (let d = form.dMin; d <= form.dMax; d++) {
        for (let s = 0; s < SEEDS; s++) {
          for (const loc of LOCALES) {
            let it;
            try { it = generate(skill, d, s * 104729 + d * 31, { locale: loc, strict: true, record: false, form: form.id }); }
            catch { continue; }
            if (it.form !== form.id) continue;
            n++;
            let hit = false;
            const shown = [it.answer, ...(it.distractors || []).map((x) => x.value)];

            // --- surd -----------------------------------------------------
            if (!only || only === 'surd') {
              const wantsSimplest = /simpl|prost|simplif/i.test(String(it.stem))
                || /sqrt/.test(String(it.answer)) || /sqrt/.test(String(it.latex));
              if (wantsSimplest) {
                for (let si = 0; si < shown.length; si++) {
                  const src = shown[si];
                  if (hasIndex(src)) continue;
                  for (const rad of radicandsOf(src)) {
                    if (rad > 1 && !sqfree(rad)) {
                      note('surd', skill, form.id, loc,
                        `${si === 0 ? 'the KEY' : 'an option'} shows a root of ${rad}, which has a square inside it`, src);
                      hit = true;
                    }
                  }
                }
              }
            }

            // --- factor ---------------------------------------------------
            if (!only || only === 'factor') {
              const v = it.check?.variable || 'x';
              // ANY key that is a plain product of brackets, whatever the
              // task said. A factorisation that is left half done is left half
              // done whether or not the stem used the word "factor".
              {
                const f = bracketFactors(it.answer);
                if (f) {
                  let leadNum = 1;
                  const lm = /^(-?\d+)/.exec(f.lead);
                  if (lm) leadNum = Math.abs(Number(lm[1]));
                  for (const p of f.parts) {
                    const co = intCoeffs(p, v);
                    if (!co) continue;
                    const ct = contentOf(co);
                    if (ct > 1) {
                      note('factor', skill, form.id, loc, `the key leaves a factor of ${ct} inside a bracket`, it.answer);
                      hit = true;
                    }
                    if (stillFactors(co)) {
                      note('factor', skill, form.id, loc, 'a bracket in the key still comes apart over the integers', it.answer);
                      hit = true;
                    }
                  }
                }
              }
            }

            // --- phantom --------------------------------------------------
            if (!only || only === 'phantom') {
              if (CHOOSER[loc].test(it.stem) && !printsCandidates(it.stem)) {
                note('phantom', skill, form.id, loc, 'the stem asks which candidate is right and none are printed', it.stem);
                hit = true;
              }
            }

            // --- outvar ---------------------------------------------------
            if (!only || only === 'outvar') {
              const onCard = new Set([...LETTERS(it.latex), ...LETTERS(it.stem)]);
              const symbolic = onCard.size > 0 && !MODELLING.has(it.check?.kind);
              for (const L of (symbolic ? LETTERS(it.answer) : [])) {
                if (!onCard.has(L)) {
                  note('outvar', skill, form.id, loc, `the key names "${L}", which is nowhere on the card`, `${it.latex} => ${it.answer}`);
                  hit = true;
                }
              }
            }
            if (hit) bad++;
          }
        }
      }
    }
  }
  const rows = [...findings.values()].sort((a, b) => b.count - a.count);
  console.log(`audit — ${n} items generated, ${bad} flagged, ${rows.length} distinct finding(s)`);
  const byRule = new Map();
  for (const r of rows) byRule.set(r.rule, (byRule.get(r.rule) || 0) + r.count);
  console.log([...byRule.entries()].map(([k, v]) => `${k} ${v}`).join(', ') || 'none');
  for (const r of rows) console.log(`  [${r.rule} x${r.count}] ${r.skill}/${r.form} (${r.loc}): ${r.text}\n      ${r.sample}`);
  process.exit(rows.length ? 1 : 0);
}
main();
