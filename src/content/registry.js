/**
 * The content registry — where a course puts its generators.
 *
 * WHY THIS FILE EXISTS
 *
 * The bank used to be one object literal in `src/learn/generators.js`, keyed by
 * skill id, three thousand lines long and closed. Adding Geometry to that shape
 * means editing the same file that Algebra I is generated from, so every course
 * shares one blast radius and one merge conflict. Four courses do not survive
 * that.
 *
 * So the bank is now a registry. `src/learn/generators.js` registers Algebra I
 * Level 1 into it at import, exactly as before, and anything else — a second
 * unit, a whole new course — registers a *pack* of its own. The engine reads
 * the registry. Nothing in `src/learn` has to know a new course exists.
 *
 * WHAT A PACK IS
 *
 *   { id, skills: { 'skill-id': [form, form, ...] }, strings: { en, es, pl } }
 *
 * A `form` is exactly what `generators.js` has always meant by one:
 *
 *   { id, rep, dMin, dMax, distinctNums?, scenes?, build({ r, d, T, skill, sr }) }
 *
 * `build` returns a raw item; `generators.finalize` verifies it before it can
 * reach a learner, so a pack cannot ship mathematics the gate has not proved.
 *
 * `strings` are the prose a pack's items read from — the same key space as
 * `content/lang/items.*.js`, looked up after it, so a pack may use every
 * existing key and add its own. Three locales or the pack does not load.
 *
 * REGISTRATION IS A CALL, NOT AN IMPORT SIDE EFFECT. A pack module exports a
 * plain object and the loader registers it. That way importing a pack costs
 * nothing, and the game only ever holds the courses it is actually running.
 */

/** skillId -> forms[]. The whole bank, for every loaded course. */
const FORMS = Object.create(null);
/** packId -> the pack, so a second load is a no-op rather than a duplicate. */
const PACKS = new Map();
/** locale -> extra item prose, merged in registration order. */
const STRINGS = Object.create(null);

/**
 * Live views. These arrays and objects are handed out by `generators.js` as its
 * own `SKILLS` and `FORMS_BY_SKILL` exports, so they are mutated in place
 * rather than replaced — a consumer that captured the reference at import must
 * keep seeing the truth after a pack loads.
 */
export const SKILLS = [];
export const FORMS_BY_SKILL = Object.create(null);

/** Called by `generators.js` once, to derive its public summary of a form. */
let summarise = (f) => ({ id: f.id, rep: f.rep, dMin: f.dMin, dMax: f.dMax });
export function setFormSummary(fn) {
  summarise = fn;
  for (const id of SKILLS) FORMS_BY_SKILL[id] = FORMS[id].map(summarise);
}

/** The forms registered for one skill, or undefined. */
export function formsFor(skill) { return FORMS[skill]; }

/** Is there a generator for this skill? */
export function hasSkill(skill) { return !!FORMS[skill]; }

/** Every skill the loaded courses can generate. */
export function registeredSkills() { return SKILLS.slice(); }

/**
 * Register one pack. Idempotent by pack id.
 * @param {{id:string, skills:object, strings?:object}} pack
 * @returns {string[]} the skill ids this call added
 */
export function registerPack(pack) {
  if (!pack || !pack.id) throw new Error('a content pack needs an id');
  if (PACKS.has(pack.id)) return [];
  PACKS.set(pack.id, pack);
  const added = [];
  for (const [skill, forms] of Object.entries(pack.skills || {})) {
    if (FORMS[skill]) throw new Error(`two packs both generate "${skill}"`);
    if (!Array.isArray(forms) || !forms.length) throw new Error(`"${skill}" registers no item forms`);
    for (const f of forms) {
      if (!f.id || !f.rep || !f.build) throw new Error(`"${skill}" has a form with no id, rep or build`);
    }
    FORMS[skill] = forms;
    SKILLS.push(skill);
    FORMS_BY_SKILL[skill] = forms.map(summarise);
    added.push(skill);
  }
  for (const [loc, bundle] of Object.entries(pack.strings || {})) {
    STRINGS[loc] = { ...(STRINGS[loc] || {}), ...bundle };
  }
  return added;
}

/** Which packs are loaded. */
export function loadedPacks() { return [...PACKS.keys()]; }

/** Extra item prose for one locale, or an empty object. */
export function packStrings(locale) { return STRINGS[locale] || EMPTY; }
const EMPTY = Object.freeze({});
