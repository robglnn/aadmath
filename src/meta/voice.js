/**
 * Marlow's state awareness.
 *
 * THE DEFECT THIS FILE EXISTS TO KILL
 *
 * A cadet with a hundred and thirty sealed rifts, every chapter open and the
 * Standard cut at Sovereign walked past a tear and was told:
 *
 *     "That tear ahead of you is a rift. Walk into it and the rig throws the
 *      statement onto your visor. Press E — or whatever your hands prefer."
 *
 * There is no writing good enough to survive that. It is not a bad line; it is
 * a line said to the wrong person, which is worse, because it says the thing in
 * your ear is not listening. Companion writing lives or dies on one question —
 * *does it know who it is talking to* — and the old channel answered no.
 *
 * Two separate faults produced it, and both are fixed here rather than in the
 * copy:
 *
 *  1. TUTORIAL LINES WERE GATED ON MEMORY, NOT ON EVIDENCE. `firstRift` fired
 *     whenever the save had not already recorded it. Any state the save did not
 *     author — a critic's `seal(130)`, a restored ledger, cleared storage, a
 *     second device — therefore re-ran the tutorial at the top of the ladder.
 *     Gating is now on what the cadet has demonstrably *done*: `canTutor()` is
 *     true only for someone with nothing sealed, no line held, no rank and no
 *     chapter turned, and it does not care what the save remembers.
 *
 *  2. THERE WAS ONE REGISTER FOR THE WHOLE ARC. Every ambient bank — slips,
 *     seals, idling, falling, coming back — held one set of lines written for a
 *     cadet in their first ten minutes, and those lines were still playing at
 *     seal one hundred and thirty. Marlow now speaks in four registers, and a
 *     register is chosen from state, not from a counter of how often he has
 *     spoken.
 *
 * THE FOUR REGISTERS
 *
 *   GREEN     Nothing sealed, or barely. Marlow explains, because explaining is
 *             warranted exactly once. This is the only register that may tutor.
 *   WORKING   The cadet can work. Explanation stops; Marlow reports, needles,
 *             and gets out of the way.
 *   VETERAN   Past the last chapter beat. Marlow talks to a colleague — shared
 *             history, callbacks, no orientation of any kind.
 *   MASTER    More sealed than any cadet in the record. Marlow is talking to
 *             someone who outranks the thing that is talking. Dry deference,
 *             and the occasional admission.
 *
 * THE RATCHET
 *
 * A register is earned and never given back. Spaced review can demote a held
 * line, standing can be re-derived, a critic can drive the state anywhere — and
 * none of it may make Marlow start explaining again. `peak` is persisted with
 * the rest of the arc and the register is the max of the derived stage and the
 * highest stage ever reached. Regression to tutorial framing is therefore not
 * something the copy has to be careful about; it is unrepresentable.
 */

/**
 * The stages, in order. `seals` is the tear count that opens the stage; the
 * `floor` predicates open it early for a cadet whose evidence is lines held
 * rather than volume sealed — someone who tests out of six lines in twenty
 * items has not earned the beginner register no matter how few tears they cut.
 */
export const STAGES = [
  { id: 'landfall', register: 'green',   seals: 0 },
  { id: 'novice',   register: 'green',   seals: 1 },
  { id: 'working',  register: 'working', seals: 7,   lines: 1, rank: 1 },
  { id: 'adept',    register: 'working', seals: 16,  lines: 3, rank: 2 },
  { id: 'veteran',  register: 'veteran', seals: 28,  lines: 5, rank: 3 },
  { id: 'master',   register: 'master',  seals: 60,  lines: 7, rank: 4 },
  { id: 'legend',   register: 'master',  seals: 110, lines: 10 },
];

export const REGISTERS = ['green', 'working', 'veteran', 'master'];

/** Every ambient bank that has a line written for all four registers. */
export const BANKS = [
  'wrong', 'right', 'slump', 'recover', 'idle', 'streak', 'fall',
  'returning', 'close', 'held', 'capped', 'rift',
];

/**
 * Seal counts that each buy one line, once, forever. The chapters stop at
 * twenty-eight; a cadet who seals two hundred used to hear nothing new after
 * the twenty-eighth, which is where "he is finished by seal 28" came from.
 * These are not chapters and they do not turn the card — they are the sound of
 * somebody keeping count of you.
 */
export const MILESTONES = [32, 40, 50, 64, 80, 100, 120, 150, 180, 220];

/**
 * Which stage a state has reached, as an index into STAGES.
 * @param {{tears?:number, lines?:number, rankIndex?:number, integrity?:number}} s
 */
export function stageIndex(s = {}) {
  const tears = s.tears || 0;
  const lines = s.lines || 0;
  const rank = s.rankIndex || 0;
  let i = 0;
  for (let k = 1; k < STAGES.length; k++) {
    const st = STAGES[k];
    const bySeals = tears >= st.seals;
    const byLines = st.lines != null && lines >= st.lines;
    const byRank = st.rank != null && rank >= st.rank;
    if (bySeals || byLines || byRank) i = k;
  }
  if ((s.integrity || 0) >= 0.999) i = STAGES.length - 1;
  return i;
}

/** The register a state speaks in, after the ratchet. `peak` is an index. */
export function registerFor(s = {}, peak = 0) {
  const i = Math.max(stageIndex(s), peak | 0, 0);
  return STAGES[Math.min(STAGES.length - 1, i)].register;
}

/**
 * May Marlow explain the basics to this cadet?
 *
 * Only to somebody who has provably not done them. No seal, no held line, no
 * rank, no chapter turned, and nothing in the ratchet. Every tutorial line in
 * `src/meta` is behind this one predicate, so "can a tutorial line fire late"
 * has exactly one answer and it is checkable by reading four comparisons.
 */
export function canTutor(s = {}, peak = 0) {
  return (peak | 0) <= 1
    && (s.tears || 0) === 0
    && (s.lines || 0) === 0
    && (s.rankIndex || 0) === 0
    && (s.chapter || 1) <= 1;
}

/**
 * Five banks were already written at exactly the green register and are good,
 * so the green voice keeps using them rather than paying for a second
 * translation of the same sentence in three languages. Everything else has a
 * green bank of its own under `story.v`, because a single line is not a bank
 * and "take your time, the rift is not going anywhere" said twice in a session
 * is how a companion becomes a notification.
 */
const GREEN_LEGACY = {
  wrong: 'story.voice.wrong',
  right: 'story.voice.right',
  close: 'story.voice.close',
  held: 'story.voice.held',
  capped: 'story.voice.capped',
};

/** The i18n key for one bank in one register. */
export function bankKey(bank, register) {
  if (register === 'green' && GREEN_LEGACY[bank]) return GREEN_LEGACY[bank];
  return `story.v.${bank}.${register}`;
}

/** The milestone (if any) crossed by going from `before` to `after` tears. */
export function milestoneCrossed(before, after) {
  for (const m of MILESTONES) if ((before || 0) < m && (after || 0) >= m) return m;
  return 0;
}

/** The i18n key for a milestone beat. */
export function milestoneKey(m) { return `story.v.mile.s${m}`; }
