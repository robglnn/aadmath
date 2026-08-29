/**
 * THE STINT — how many questions one arrival at a rift is worth.
 *
 * A cold critic played fifteen minutes and wrote down the exact shape of the
 * defect:
 *
 *   "From 01:16 to 11:30 I answered twelve consecutive items inside a modal
 *    card without ever choosing to return to the 3D world — sealing a rift
 *    auto-opens the next card, so there is no beat where I decide what to do."
 *
 * He is describing four lines in `src/main.js`. A correct answer set
 * `chainNext = true`, the panel shut itself 2.9 s after the seal, and 460 ms
 * later the SAME rift opened the SAME card again. Ten minutes of a 3-D game
 * were spent on a keypad, and every single one of those transitions was the
 * game's decision rather than the player's.
 *
 * This module is the rule that ends that, and it is one sentence:
 *
 *   **One arrival at a tear buys THREE items. Then the world comes back.**
 *
 * Three, not one, because the other failure mode is real too: a walk of forty
 * metres per question is not a rhythm either, it is an obstacle course with
 * arithmetic in it, and the mastery engine needs runs of items on one line to
 * read anything at all. Three is one coherent piece of work — long enough that
 * the scheduler can interleave and short enough that nobody is ever eleven
 * items deep in a card they did not choose to still be in.
 *
 * WHAT HAPPENS BETWEEN THE ITEMS OF ONE STINT — the second correction.
 *
 * Three items per arrival fixed the twelve-item marathon and left a smaller
 * version of the same defect standing, which the next cold critic duly found:
 *
 *   "six items that opened with no travel at all (chained inside proving runs)"
 *
 * He is right, and the arithmetic is not survivable. If one arrival is one
 * decision and the two items after it arrive on a 460 ms timer, then two thirds
 * of every learning card in the game opened because the game decided it should.
 * No amount of tuning the number three inverts that ratio; only moving the
 * decision does.
 *
 * So the chain is now an OFFER rather than an action. When an item is finished
 * and the stint has more to give, the tear does not re-open itself — it stays
 * live, keeps the plate and the key it already carries (src/world/afford.js),
 * and waits. One press of the interact key, standing exactly where you are,
 * continues the stint: same tear, same run of items, no travel, no penalty,
 * and `arrive()` deliberately does not reset the count. Walk away instead and
 * the stint simply ends.
 *
 * The mathematics is untouched — the same three items on the same line, still
 * interleaved by the same scheduler. What changed is who says "again": the
 * cadet, three times, instead of a timer, twice.
 *
 * WHAT HAPPENS WHEN A STINT ENDS
 *   · the panel closes for real: no chained card, no 460 ms timer;
 *   · the tear **settles** for a few seconds — walking across its plate will
 *     not pull you back in, so the way out of a rift is not a corridor back
 *     into it. The interact key still works the whole time, because a player
 *     who *wants* another three is making a choice and this module's entire
 *     purpose is that the choice exists;
 *   · `onEnd` fires, and `src/world/errand.js` lights the next place worth
 *     walking to.
 *
 * WHAT IT DELIBERATELY IS NOT. It is not a cap on how much mathematics a
 * session contains — a run is still sized in tears by `estimate.js`. It is a
 * cap on how much happens **without a decision in between**.
 *
 * ---------------------------------------------------------------------------
 * THE THIRD CORRECTION: A DECISION THE WORLD CANNOT SEE IS NOT A DECISION.
 *
 * Everything above shipped, and the sitting got worse, not better. The
 * project's own instrument (`tools/critic/motion.mjs`) read an eighteen-minute
 * run as **805 consecutive seconds inside one 2 m circle with 400 items served
 * there**, and a human-paced sitting agreed independently: 24 of 36 rift
 * openings happened without the cadet moving two metres from the previous one,
 * median rift-to-rift travel 0 m, longest chain nine openings on one square
 * metre.
 *
 * The offer was the hole. `hold()` correctly stopped the timer from re-opening
 * the tear — and then `arrive()` re-armed the count for anybody who pressed the
 * key again, standing still, for ever. Three items became six became four
 * hundred, and every one of them was "a decision": the cadet did press the key.
 * A decision whose only two outcomes are *more of this, here* and *nothing* is
 * a menu with one item on it.
 *
 * So an arrival is an arrival. **When a stint fills, the tear is SPENT**, and
 * what re-arms it is going somewhere:
 *
 *   · they ARRIVE SOMEWHERE ELSE — any tear, opened any way — or
 *   · nothing else on the shard is open, in which case the arrival is never
 *     spent in the first place (`elsewhere`) and `src/meta/objective.js` can
 *     still hand it back (`release`) if the two ever disagree. A cadet on their
 *     first line, with one tear standing and every other node locked behind it,
 *     is never asked to walk for the sake of walking, and
 *   · a long way from the plate (`FAR_M`), which is the anti-lock valve and
 *     nothing else.
 *
 * THE RE-ARM IS AN ARRIVAL AND NOT A DISTANCE, and that is the whole of the
 * argument for it. The first cut of this rule re-armed at twenty-six metres,
 * and tears are seated twenty-six to forty metres apart (`MIN_SEP` in
 * src/world/rifts.js) — so a cadet walking from the tear they had just spent to
 * the tear the card now named crossed the threshold about six metres short of
 * arriving, `mastery.next()` re-selected the line behind them, and the card
 * turned round and pointed back the way they had come. An objective that
 * changes its mind halfway is worse than one that is wrong. The spend now
 * outlives the walk by construction: it ends when the cadet opens something,
 * which is exactly the event that makes the scheduler's answer move on its own.
 * At most one tear is ever spent, so if two are open the other one always is —
 * a lock is not reachable.
 *
 * The gate this answers was written against exactly this rule and says so:
 * *"three items is what one arrival at a tear buys (src/session/stint.js) …
 * two stints in a row from one square metre is not a slow learner, it is a
 * menu."* The 210-second bar was set on the assumption implemented here.
 *
 * ---------------------------------------------------------------------------
 * THE OTHER HALF OF THE PARK: AN ARRIVAL THAT NEVER FILLS.
 *
 * `sealed()` counts correct answers only, so an arrival that lands nothing
 * never fills and never ends — and the tear goes on serving from the same
 * square metre for as long as the learner keeps missing. Measured on the
 * project's own gate, on the frozen build, that is not a hypothetical: 674 of
 * the 677 parked seconds in an eighteen-minute sitting were spent at ONE tear
 * (`like-terms`, at −42.9/−45.0) with the stint reading **n = 0 of 3** the
 * whole time. Every rule above was working; not one of them could fire, because
 * all of them wait on work that was never going to be done.
 *
 * So an arrival is also bounded by ATTEMPTS: `items` pieces of work done, **or**
 * `tries` answers given, whichever comes first.
 *
 * AND THE CEILING CANNOT SHORTEN AN ARRIVAL FOR A LEARNER WHO IS STRUGGLING,
 * which is a requirement and not a hope. The rig reports at most two slips per
 * card, so three answers is the most one piece of work can ever cost; at three
 * times the item count, a cadet who misses twice on every card still gets all
 * three pieces of work out of the arrival, and walks the same single leg as the
 * cadet who missed none. Per metre walked they get MORE mathematics, never
 * less. The rule that would have been a penalty is the one this file has always
 * refused — counting attempts INSTEAD of work, so that three misses end an
 * arrival that has sealed nothing. Counting them AS WELL, at three times the
 * distance, moves the scene without moving the topic.
 *
 * Nothing about the topic changes. `mastery.next()` still wants the line, the
 * objective still names it, and the cadet is back on that plate one leg later —
 * which is spaced practice, and is better teaching than a seventh miss on the
 * same square metre.
 *
 * AND IT IS NOT A PENALTY ON STRUGGLE, which was a hard requirement and not a
 * hope. `sealed()` counts correct answers only, so a learner who needs six
 * tries for one item has not used up any of an arrival; a learner who walks
 * away after one item has not spent the tear either — only a FULL arrival
 * spends it. What the spend asks for is one walk to the nearest open tear, and
 * that walk is the same walk for the cadet who is finding it easy and the cadet
 * who is not: it does not lengthen with misses, it does not lengthen with time,
 * and there is nothing in here that can make it grow. The walk is the loop, not
 * a tax — and the line the cadet was on is not dropped, because the spend ends
 * the instant they open the next tear and `src/meta/objective.js` names the
 * wanted line again on the following poll.
 */

/**
 * THE ONE STINT THIS PAGE IS RUNNING.
 *
 * `src/meta/objective.js` has to know whether the tear the scheduler wants has
 * already given its arrival, and it is called from two files this lane does not
 * own (`src/world/afford.js` and `src/meta/guide.js`) which would both have to
 * be edited to thread it through. There is exactly one stint per page — main.js
 * builds it once — so it is published here instead, the same way
 * `src/player/locomotion.js` publishes `P` and `src/build/pieces.js` publishes
 * `SHARD_COST`. `resolveObjective` still takes an explicit `stint` in its
 * context and prefers it; this is the fallback, not the interface.
 */
let live = null;
export const liveStint = () => live;

/** Items one arrival is worth. */
const ITEMS = 3;
/**
 * Answers one arrival is worth, right or wrong.
 *
 * THREE TIMES the item count, and the multiplier is the whole argument that
 * this ceiling costs a struggling learner nothing. `src/ui/rift.js` reports at
 * most **two** slips per card (`this.reported < 2`) plus the answer that closes
 * it, so one piece of work costs at most three answers however many tries it
 * really took. Three times three is therefore the smallest ceiling that can
 * never cut an arrival short of its full three items — a cadet who misses twice
 * on every single card still walks away having done the same three pieces of
 * work as the cadet who missed none, after the same one leg.
 *
 * The only arrival it ends early is the one that is not going anywhere at all:
 * nine answers, nothing landed. That cadet has had four cards and four worked
 * echoes on one square metre, and the next thing that helps them is a change of
 * scene on the same line — not a fifth.
 */
const TRIES = ITEMS * 3;
/**
 * Seconds a tear stays settled after a stint. Long enough to walk off the dais
 * and mean it; short enough that a player who turns straight round and presses
 * the key is never refused — the key is never blocked at all, only the boots.
 */
const SETTLE = 9;
/**
 * Seconds a cadet may be away from a held tear before the offer of the next
 * item lapses and the world moves on. Long enough to step back, look around and
 * change your mind; short enough that walking off really does mean leaving.
 */
const LEAVE = 2.5;
/**
 * THE ANTI-LOCK VALVE, in metres, and it is only that.
 *
 * The spend ends when the cadet opens something else, which is the honest
 * event. This number exists so that a cadet who wanders off and comes back to
 * the same tear half an island later is never refused by a rule that was
 * waiting on an arrival they decided not to make. It is deliberately far past
 * the widest gap between two tears (`SEPARATIONS` in src/world/rifts.js seats
 * them 26 m apart, 32 m out from their own prerequisite), so it can never fire
 * during the ordinary walk from a spent tear to the one the card now names —
 * which is the flip-flop this file's doc block describes.
 */
const FAR_M = 90;
/**
 * SECONDS A REFUSAL MAY STAND, AND THEN IT STOPS BEING ONE.
 *
 * The spend ends when the cadet opens something else, and every surface in the
 * game points at somewhere they can. A cadet who ignores all of them and keeps
 * asking this tear is not being taught anything by the seventh refusal — a
 * refusal that outlives the reason for it is a wall, and this project's oldest
 * rule is that a documented key must never stop answering. Long enough that it
 * can never be a strategy (the walk to the next tear is four seconds); short
 * enough that nobody is ever stuck.
 */
const RELENT = 75;
/**
 * SECONDS ONE ARRIVAL MAY OWN, and this is the bound that actually holds.
 *
 * The attempt ceiling above cannot fire on its own, and the reason is a detail
 * of the rig: `src/ui/rift.js` reports at most **two** slips per card
 * (`this.reported < 2`), and a card stays on the surface until it comes out
 * right. So a learner who cannot solve the card in front of them answers it a
 * hundred times, the engine hears two of those, the panel never closes, `end()`
 * is never called and every rule in this file is waiting on an event that will
 * not happen. Measured, on the frozen build: **473 consecutive seconds and 208
 * questions at one tear** with the arrival counter stuck at two.
 *
 * So an arrival is also bounded in the only unit that cannot stall: the time
 * the cadet has actually spent standing at that tear. A hundred and fifty
 * seconds is `tools/critic/motion.mjs`'s own arithmetic for one whole stint
 * worked slowly — three items at about twenty-five seconds each, doubled for a
 * miss and a worked echo on every one of them — so it is the most any arrival
 * has ever been supposed to be worth.
 *
 * AND IT IS THE STRUGGLING LEARNER WHO GETS THE MOST OF IT. A cadet who is
 * landing them spends about seventy-five seconds here and walks; a cadet who is
 * not gets the full hundred and fifty, and then the same one leg. The line does
 * not change, the scene does.
 */
const ARRIVAL_S = 150;

export function createStint(opts = {}) {
  const {
    items = ITEMS,
    tries = TRIES,
    settle = SETTLE,
    far = FAR_M,
    relent = RELENT,
    arrivalSeconds = ARRIVAL_S,
    /**
     * The cadet, read for one fact and never written: where their feet are.
     * Used only by the anti-lock valve below. Optional — with no player the
     * spend ends on the next arrival and on nothing else.
     */
    player = null,
    /**
     * IS THERE ANYWHERE ELSE? Answered by the world (`src/main.js` reads the
     * tear list), asked before an arrival is ever spent.
     *
     * A spend is only honest when the game has somewhere to send the cadet
     * instead. On the first line of the first sitting there is exactly one tear
     * standing and every other node is locked behind it — so the arrival is not
     * spent at all, the key keeps working, and the plate keeps saying OPEN.
     * Asking here rather than one poll later is what keeps the plate from
     * flickering SETTLED for four hundred milliseconds and then changing its
     * mind, which is the same class of defect as an objective that turns round
     * halfway.
     */
    elsewhere = () => true,
    /**
     * Fired once, when a stint fills and the world is handed back.
     * `src/meta/relay.js` is on the other end of it: it decides where the
     * player is now pointed, and says the rhythm out loud the first time.
     */
    onEnd = () => {},
  } = opts;

  let riftId = null;      // the tear this stint belongs to
  let n = 0;              // items worked in it
  let t = 0;              // answers given in it, right or wrong
  let age = 0;            // seconds spent standing at this tear
  let offT = 0;           // …and seconds spent off it, which resets that
  let ended = false;      // has this stint already handed the world back
  /**
   * The stint has items left and is waiting for the cadet to ask for the next
   * one. Nothing happens while this is true: the world is theirs, the tear is
   * lit, and the only two things that can move are their key and their boots.
   */
  let holding = false;
  /** Seconds spent standing off the tear while holding, before it lets go. */
  let away = 0;
  /** id -> seconds of settle left. */
  const cooling = new Map();
  /**
   * THE SPENT TEAR. The id of the tear whose arrival is used up, and the plate
   * it stands on — the plate only so that the anti-lock valve has something to
   * measure against. There is never more than one, which is what makes a lock
   * unreachable: if two tears are open, one of them is not this one.
   */
  let spentId = null;
  let spentX = 0, spentZ = 0;
  /** Seconds since this arrival was spent, for `RELENT`. */
  let spentT = 0;

  /**
   * A rift is being opened. Called at the top of the one function that opens
   * one, so that every path — the plate, the key, the touch tag, the chain —
   * arrives here and nothing can start a stint behind this module's back.
   */
  function arrive(id) {
    // Arriving anywhere clears a spent tear: the cadet has gone and opened
    // something, which is the whole thing the spend was asking for. It also
    // clears the tear's OWN spend, because every path into this function is a
    // door the game itself decided to open (a harness naming a rift, a walk-in
    // the world allowed, a key the interact rule let through).
    spentId = null;
    spentT = 0;
    /* THE CLOCK BELONGS TO THE TEAR, NOT TO THE ARRIVAL, and that distinction
       is the whole of whether this bound can fire at all. It used to restart on
       every `arrive()` — and a cadet who cannot answer the card in front of
       them closes it and opens it again, which is a new arrival every eight
       seconds and a clock that never passes ten. Measured: **963 consecutive
       seconds inside one 2 m circle** with the arrival reading `age 8 of 150`
       the whole time. Time at this tear is the one quantity nothing on the
       learning surface can reset. */
    if (id !== riftId) { age = 0; }
    if (id !== riftId || ended || n >= items || t >= tries || age >= arrivalSeconds) {
      riftId = id;
      n = 0;
      t = 0;
      ended = false;
    }
    // Continuing a held stint is the same stint, not a new one: the count
    // carries, which is what makes "three items per arrival" still true when
    // the cadet is the one asking for each of them.
    holding = false;
    away = 0;
    // Pressing the key on a settling tear is a choice, and a choice ends the
    // settle: the world should not go on telling you to leave a place you have
    // just decided to stay at.
    cooling.delete(id);
  }

  /**
   * One item was FINISHED at this tear.
   *
   * Called on a correct answer only, and that is not an accounting nicety. A
   * card stays on the surface until it comes out right — a wrong answer buys a
   * worked echo aimed at the misconception the learner just revealed and then
   * asks again — so counting attempts would eject a struggling cadet from the
   * one line they most need to stay on, after three misses, having sealed
   * nothing. The product brief is explicit that a learner who is struggling
   * "stays on that topic until it is mastered". A stint is three *pieces of
   * work done*, however many tries each of them took.
   */
  function sealed() {
    if (riftId) n++;
  }

  /**
   * One answer was GIVEN at this tear — right or wrong, every single one.
   *
   * The pair with `sealed()`, and the two are not the same count on purpose.
   * Work done decides when an arrival has paid out; answers given decide when
   * it is over. A learner who is missing is not cut short by this — the ceiling
   * is twice the item count — they are simply not left standing on one square
   * metre for eleven minutes because the rule that ends an arrival was waiting
   * on something they could not yet do.
   */
  function tried() {
    if (riftId) t++;
  }

  /**
   * May the loop open another card at this tear without being asked?
   *
   * This is the whole contract. `src/main.js` chains only while this is true.
   */
  function more() {
    return !!riftId && !ended && n < items && t < tries && age < arrivalSeconds;
  }

  /**
   * Has this arrival used up the time one arrival is worth?
   *
   * `src/main.js` reads it on the frame loop and hands the world back — which
   * is the only way this bound can bite, because a card a learner cannot solve
   * never closes on its own and every other rule in this file waits on the
   * close. Never true during the seal ceremony; a beat that has been earned is
   * always allowed to finish.
   */
  function expired() {
    return !!riftId && age >= arrivalSeconds;
  }

  /**
   * The stint is over: the panel has closed and the frame belongs to the world
   * again. Idempotent, because a panel can close for several reasons at once.
   */
  /**
   * An item finished and there are more in this stint. Hold the offer open.
   *
   * Called by `src/main.js` instead of the 460 ms chain timer it used to arm.
   * Nothing here opens anything — that is the entire point.
   */
  function hold() {
    if (!riftId || ended) return;
    holding = true;
    away = 0;
  }

  /**
   * Is this tear mid-stint, waiting to be asked for the next item? Read by the
   * affordance layer, so the plate on the tear can say CONTINUE rather than
   * OPEN — the same key, an honest verb.
   */
  function holdingAt(id) { return holding && !ended && id === riftId; }

  /**
   * Called every frame with the tear the cadet is standing at, or null.
   *
   * An offer nobody takes has to expire, or the world never hands back the
   * next destination and `src/meta/relay.js` never speaks. Walking off the
   * dais is the answer "no thanks", and it is read exactly that way: a couple
   * of seconds away from the tear and the stint closes itself out normally,
   * relay line and all. Standing on it costs nothing and waits forever.
   */
  function watch(nearId, dt) {
    /* THE TEAR'S CLOCK RUNS WHILE YOU ARE STANDING AT IT.
       `update()` adds the seconds; this is what takes them away again. Step off
       the dais and the tear forgets — which is what makes "a hundred and fifty
       seconds" a thing about one visit rather than a thing about the rest of
       your sitting, and what makes the remedy for a settled tear a step rather
       than a wait. */
    if (riftId && nearId !== riftId) {
      offT += dt;
      if (offT >= LEAVE) { age = 0; offT = 0; }
    } else { offT = 0; }
    if (!holding || ended) return;
    if (nearId === riftId) { away = 0; return; }
    away += dt;
    if (away >= LEAVE) end();
  }

  function end() {
    if (!riftId || ended) return;
    ended = true;
    holding = false;
    away = 0;
    if (settle > 0) cooling.set(riftId, settle);
    /* THE ARRIVAL IS SPENT — but only a FINISHED one, and only when there is
       somewhere else to go.
       A cadet who walks off after one item has not used up a tear and must be
       able to walk straight back onto the plate and finish what they started.
       An arrival is finished when three pieces of work are done, or when nine
       answers have been given without them — see the doc block. */
    const filled = n >= items || t >= tries || age >= arrivalSeconds;
    let somewhere = false;
    try { somewhere = !!elsewhere(riftId); } catch { somewhere = false; }
    if (filled && somewhere) {
      spentId = riftId;
      spentT = 0;
      if (player?.pos) { spentX = player.pos.x; spentZ = player.pos.z; }
    }
    try { onEnd(riftId, { filled }); } catch { /* a beat must never stop the loop */ }
  }

  /**
   * Has this tear given what one arrival is worth?
   *
   * Read by `src/main.js` before it opens anything on the interact key, by
   * `src/world/afford.js` so the plate says so rather than lying, and by
   * `src/meta/objective.js` so the card names somewhere the cadet can actually
   * go. It is never a silent no: every one of those three surfaces answers.
   */
  function spent(id) { return spentId != null && id === spentId; }

  /**
   * Give the arrival back, unasked.
   *
   * `src/meta/objective.js` calls this in exactly one case: the scheduler wants
   * this tear, the tear is spent, and there is **nothing else open on the whole
   * shard** to point a cadet at. A first-line cadet with one tear standing is
   * not sent on a hike to prove a rule; the rule steps aside. That is also the
   * proof that a spend can never become a locked door.
   */
  function release(id) {
    if (id == null || id === spentId) { spentId = null; spentT = 0; }
  }

  /**
   * Is this tear settled? Asked by `src/world/beckon.js` before a walk-in
   * opens anything. Never asked about the interact key.
   */
  function settling(id) {
    return (cooling.get(id) || 0) > 0;
  }

  function update(dt) {
    /* THE TWO VALVES, and neither of them is the rule. The rule is `arrive()`.
       One is distance — the cadet went a long way and came back, and a rule
       waiting on an arrival they decided not to make must not refuse them. The
       other is time, and it is the harder promise: no refusal in this game
       stands for longer than `relent`. */
    // The tear's own clock. It runs from the moment this tear was first opened
    // until the cadet opens a different one — across the closes and re-opens in
    // between, which is what makes it the one counter here that nothing on the
    // learning surface can stall.
    if (riftId) age += dt;
    if (spentId != null) {
      spentT += dt;
      const d = player?.pos ? Math.hypot(player.pos.x - spentX, player.pos.z - spentZ) : 0;
      if (spentT >= relent || (player?.pos && d >= far)) spentId = null;
    }
    if (!cooling.size) return;
    for (const [id, left] of cooling) {
      const v = left - dt;
      if (v <= 0) cooling.delete(id); else cooling.set(id, v);
    }
  }

  const api = {
    arrive, sealed, tried, more, expired, end, settling, update, hold, holdingAt, watch,
    spent, release,
    /** Everything a critic needs, off one call. */
    state: () => ({
      riftId, n, of: items, tries: t, ofTries: tries,
      age: Math.round(age), ofSeconds: arrivalSeconds,
      ended, holding, settling: [...cooling.keys()],
      spent: spentId, far, relent, spentFor: Math.round(spentT),
      away: spentId != null && player?.pos
        ? Math.round(Math.hypot(player.pos.x - spentX, player.pos.z - spentZ))
        : 0,
    }),
    reset() {
      riftId = null; n = 0; t = 0; age = 0; offT = 0; ended = false; holding = false; away = 0;
      spentId = null; spentT = 0; cooling.clear();
    },
  };
  live = api;
  return api;
}
