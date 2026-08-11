/**
 * WHAT TO DO NEXT — derived, never stored.
 *
 * The defect this file exists to kill, in the player's own words: *"unsure what
 * to do next? not sure what to do about rifts, shards, and other things, not
 * super sure how the player learns or proceeds."* He had played a full session.
 * He had collected eight hundred shards. He had visited seven islands. And the
 * game had never once told him, in one sentence, what it wanted.
 *
 * ASCENT already knew the answer the whole time — `mastery.next()` returns the
 * single highest-leverage skill for this learner on every frame — but that
 * answer only ever reached the *inside* of a rift he had already found. The
 * objective is that answer, spoken out loud, before he has found anything.
 *
 * It is computed from live state on every tick rather than written down, which
 * is what makes it survive a session break for free: there is no objective
 * record to reload, restore or migrate. Close the tab in the middle of a
 * sentence, come back a week later, and the first frame carries the same one
 * sentence the last frame did, because both are a function of the same save.
 *
 * The four verbs are the four things the scheduler can ask for, and they are
 * deliberately different words. "Seal the rift" and "Prove the line" are not
 * dressing on one action: the first is practice and the second is the proving
 * run that actually closes a claim, and a player who cannot tell them apart
 * cannot tell that he is nearly finished with something.
 */
import * as THREE from 'three';

/** Which verb a scheduler `kind` asks for. */
const VERB_FOR = {
  learn: 'seal',
  probe: 'seal',
  check: 'prove',
  review: 'watch',
  deep: 'sound',
};

/**
 * The one thing to do right now.
 *
 * @param {{mastery:object, rifts:object, player:object, kit:object|null}} ctx
 * @returns {{skill:string, verb:string, rift:object, pos:object,
 *            pay:string, payN:number, payName:string,
 *            held:number, open:number, locked:number}|null}
 */
export function resolveObjective(ctx) {
  const { mastery, rifts, player, kit } = ctx;
  if (!rifts?.list?.length) return null;

  const pick = safeNext(mastery);
  let rift = pick ? rifts.list.find((r) => r.id === pick.id && !r.locked) : null;

  // The scheduler named a line with no rift standing for it (it can, at the
  // very top of the lattice) — or named nothing at all. Fall back to the
  // nearest thing that is actually open, because an objective that points at
  // nothing is worse than an objective that points at the wrong thing.
  if (!rift) rift = nearestOpen(rifts, player, false) || nearestOpen(rifts, player, true);
  if (!rift) return null;

  const st = mastery.get?.(rift.id) || null;
  const kind = pick && pick.id === rift.id ? pick.kind : (st?.mastered ? 'deep' : 'learn');
  const verb = VERB_FOR[kind] || 'seal';

  // ---- what holding this line is actually worth, in that order of interest
  const opens = wouldUnlock(mastery, rift.id);
  const grant = nextGrantOf(kit);
  let pay = 'calm';
  let payN = 0;
  let payName = '';
  if (st?.mastered) {
    pay = 'sound';
  } else if (opens > 0) {
    pay = 'lines';
    payN = opens;
  } else if (grant) {
    pay = 'kit';
    payName = grant.name;
  }

  const tally = countLines(mastery);
  const foot = rift.foot || rift.group?.position || rift.pos;
  return {
    skill: rift.id,
    verb,
    kind,
    rift,
    // Two points, deliberately. Distance is measured to the plate you have to
    // stand on; the marker is drawn sixteen metres above the ring. At the ring
    // itself it lands on top of the world's own label for the same object
    // (src/world/beckon.js) — two captions on one thing is a HUD — and a
    // waypoint standing clear of the skyline is also simply easier to fly at.
    pos: foot,
    aim: new THREE.Vector3(foot.x, foot.y + 16, foot.z),
    pay,
    payN,
    payName,
    ...tally,
  };
}

/** held / open / locked, across the whole lattice. The arc, in three numbers. */
export function countLines(mastery) {
  let held = 0, open = 0, locked = 0;
  for (const n of mastery.graph.nodes) {
    if (mastery.get(n.id)?.mastered) held++;
    else if (mastery.isUnlocked(n.id)) open++;
    else locked++;
  }
  return { held, open, locked };
}

/**
 * How many further lines holding this one would open. Only lines whose *every
 * other* prerequisite is already held count: "this unlocks three" has to be
 * true on the next frame after you seal it, or it is a promise the game breaks.
 */
function wouldUnlock(mastery, id) {
  let n = 0;
  for (const node of mastery.graph.nodes) {
    if (!node.prereqs?.includes(id)) continue;
    if (mastery.isUnlocked(node.id)) continue;
    if (node.prereqs.every((p) => p === id || mastery.get(p)?.mastered)) n++;
  }
  return n;
}

function nearestOpen(rifts, player, allowMastered) {
  let best = null, bd = Infinity;
  for (const r of rifts.list) {
    if (r.locked) continue;
    if (!allowMastered && r.mastered) continue;
    const d = player.pos.distanceTo(r.group.position);
    if (d < bd) { bd = d; best = r; }
  }
  return best;
}

function safeNext(mastery) {
  try { return mastery.next(); } catch { return null; }
}

function nextGrantOf(kit) {
  try { return kit?.nextGrant?.() || null; } catch { return null; }
}
