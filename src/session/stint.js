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
 *
 * ===========================================================================
 * THE FOURTH CORRECTION: EVERY WORD ABOVE WAS TRUE AND NONE OF IT COULD RUN.
 *
 * Two cold eighteen-minute sittings on the frozen build, the same code, the
 * only difference being whether the answer handed in was the right one:
 *
 *   THE CADET WHO IS ANSWERING WELL   median leg 4.36 m, 13 legs over 20 m.
 *   THE CADET WHO IS MISSING          43 consecutive rift openings inside two
 *                                     metres of each other in 290 s, the
 *                                     objective naming one node on 94.9% of
 *                                     samples, 5.9% of the window moving, the
 *                                     rift panel up for 76.3% of it — and
 *                                     `spent` FALSE on 1158 of 1158 samples.
 *
 * The loop opened the world for the learner who was succeeding and pinned the
 * one who was struggling, which is backwards: the cadet who most needs a change
 * of scene, a walk and a different way in got one square metre and the same
 * node for five minutes.
 *
 * THE MECHANISM, read off the running game rather than off this file (probe:
 * `tools/critic/_laneB-probe.mjs`, 120 s at the boot tear, missing every
 * answer). All three bounds an arrival has were unreachable at once:
 *
 *   n     0 of 3     `sealed()` counts work done, and none was being done.
 *   t     2 of 9     `src/ui/rift.js:2074` reports at most TWO slips per card,
 *                    and the card stays up until it comes out right — so `t`
 *                    saturates at two and `arrive()` set it back to zero on the
 *                    next open. Nine answers was a number nothing could reach.
 *   age   2 of 150   THE ONE THAT MATTERED. `src/main.js` calls
 *                    `watch(!panel.open && nearRift ? nearRift.id : null, dt)`,
 *                    so while a card is on the screen this module is told the
 *                    cadet is at NO tear — and `watch()` read that as having
 *                    walked away and zeroed the arrival clock every 2.5 s. The
 *                    bound this file calls "the one that actually holds" was
 *                    measured pinned at 2 out of 150 for two solid minutes.
 *
 * With all three dead, `filled` was never true, `end()` never spent the tear,
 * and `src/meta/objective.js` — which is the only reader of `spent()` — was
 * being told, honestly, that the cadet had somewhere better to be: the place
 * they were already standing.
 *
 * WHAT CHANGED, and every one of them is the rule this file already claimed:
 *
 *  1. THE ARRIVAL CLOCK IS GIVEN BACK BY GOING SOMEWHERE, NOT BY A CARD BEING
 *     UP. `age` and `t` are reset by DISTANCE from where the arrival began
 *     (`AWAY_M` held for `LEAVE`), read off the cadet's own feet on the frame
 *     loop, instead of by a `nearId` that is null for as long as the learning
 *     surface owns the frame. A player cannot move while a card is up, so the
 *     clock now runs through the card exactly as the doc block on `arrive()`
 *     always said it did. No file outside this lane changed.
 *  2. NINE ANSWERS IS NINE ANSWERS AT THIS TEAR, across the closes and re-opens
 *     in between — the same rule the clock has. That is what makes `TRIES` bite
 *     on the shape that was actually measured: forty-three openings of one ring
 *     from one square metre. It still cannot shorten an arrival below three
 *     pieces of work, because the rig can only ever spend three answers on one
 *     of them.
 *  3. A FILLED ARRIVAL IS SPENT WHETHER OR NOT THIS MODULE CAN SEE ANYWHERE
 *     ELSE. `elsewhere()` only knows about tears; `src/meta/objective.js` knows
 *     about tears AND the places this world owns, and it already hands the
 *     arrival straight back (`release`) on the same poll when there is genuinely
 *     nowhere. One module answers "is the arrival finished"; the other answers
 *     "is there anywhere to go". They were both being asked here, and the
 *     narrower one was winning.
 *  4. `expired()` NOW MEANS WHAT `spent()`'S OWN DOC BLOCK SAYS IT MEANS. That
 *     block has claimed for three rounds that `src/main.js` reads the spend
 *     "before it opens anything on the interact key". It does not — it reads
 *     `expired()` — so a spent tear went on opening for anybody who pressed the
 *     key while standing on it, and `arrive()` handed the spend back. The two
 *     are one question and are answered in one place now.
 *  5. GIVING AN ARRIVAL BACK GIVES THE CLOCK BACK. `release()`, `RELENT` and
 *     `FAR_M` all clear `age` as well as the spend, because a refusal that has
 *     been withdrawn must not leave a refusing clock standing behind it. That
 *     is what keeps rule 4 from becoming a wall on the first line of the first
 *     sitting, where there is one tear and nowhere else at all.
 *
 * WHAT MUST NOT HAPPEN, AND DOES NOT.
 *
 *   A STRUGGLING LEARNER IS NEVER MADE TO WALK FURTHER. Every bound here is a
 *   bound on TIME AND ANSWERS AT ONE TEAR. Not one of them touches how far the
 *   next leg is — that is `src/meta/objective.js`, where the distance is read
 *   off the kit a cadet has bought with held lines and off nothing else. The
 *   cadet who is landing them leaves after about three items; the cadet who is
 *   not gets the full hundred and fifty seconds and then the same one leg. Per
 *   arrival, struggling buys MORE time on the line, never less, and exactly the
 *   same walk.
 *
 *   AND NOBODY IS MOVED OFF A LINE THAT IS NOT HELD. Nothing in this file names
 *   a skill. `mastery.next()` still wants the same line the moment the spend
 *   ends, and `src/meta/objective.js` prefers a PLACE — a cache, a span, a
 *   survey mark — for an arrival that landed nothing, precisely because a place
 *   is a change of scene and a change of representation that is not a change of
 *   topic. The walk is relief and variety. It is never a tax and it is never a
 *   time-boxed move on anyway.
 *
 * ===========================================================================
 * THE FIFTH CORRECTION: THE ARRIVAL ENDED, AND THE WORLD STILL HAD NO DOOR.
 *
 * Everything above works and is measured working. `tools/critic/_laneB-probe.mjs`
 * on the frozen build, 220 s at the boot tear missing every answer:
 *
 *   age 1 → 147 of 150   the clock runs through the card, exactly as the fourth
 *                        correction promised. `tries` sat at 2 of 9 the whole
 *                        time, because `src/ui/rift.js:2145` reports only the
 *                        first two slips on a card and the card does not close
 *                        until it comes out right — so it is the CLOCK that
 *                        ends this arrival, and `TRIES` is a second lock that
 *                        needs about five openings of one ring to reach.
 *   t ≈ 150              `expired()` closes the panel and `end()` fills it.
 *   t ≈ 151              `spent` already null, `age` already 0.
 *   t ≈ 153              the same ring re-opens, on the same square metre.
 *
 * The arrival was filling and the spend was being handed straight back — by
 * `src/meta/objective.js`, correctly, because it genuinely had nowhere to point:
 * one open tear on a one-root lattice, and every place on the shard outside the
 * envelope a cadet holding no kit is allowed to be shown. That file's fifth
 * correction has the measurement and the fix; the only thing that changed HERE
 * is `FAR_M`, which was sized to clear a walk between two tears and had to grow
 * to clear a walk to a place. Nothing about what an arrival is worth moved:
 * three pieces of work, nine answers at this tear, a hundred and fifty seconds,
 * whichever comes first — the same numbers for both learners.
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
 * METRES THAT COUNT AS HAVING LEFT THIS TEAR — the one measurement that decides
 * whether an arrival's clock is still running.
 *
 * It used to be a question this module asked `src/main.js`, and the answer came
 * back wrong for the whole of every learning card: `watch()` is handed
 * `!panel.open && nearRift ? nearRift.id : null`, so a cadet with a question on
 * the screen is reported as standing at NO tear, and the clock was zeroed every
 * 2.5 seconds for as long as the card was up. Measured on the frozen build:
 * `age 2 of 150` for two solid minutes at one ring.
 *
 * So it is a distance now, read off the cadet's own feet, which is a fact this
 * module can check for itself and nothing on the learning surface can fake. A
 * player cannot move while a card is up, so the clock runs through the card;
 * step away and it is given back after `LEAVE` seconds, which is the promise
 * this file has always made ("the remedy is one step").
 *
 * Twelve metres, because `REACH` in src/world/rifts.js opens a tear at nine to
 * the plate and `PLATE_M` in src/meta/objective.js lets a card go at fourteen:
 * a cadet who is off the dais by this much has left, and a cadet shifting their
 * feet on it has not. It is far inside `MIN_SEP` (26 m between two tears), so
 * the walk from one tear to the next always clears the one behind it.
 */
const AWAY_M = 12;
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
 *
 * IT IS PAST THE PLACES TOO, WHICH IS WHY IT MOVED. At ninety metres the widest
 * thing this valve had to clear was another tear. `src/meta/objective.js` can
 * now name a PLACE on the frames where there is no other tear at all — the
 * relief envelope, 140 m, sized on where the bottom rung of the errand ladder
 * actually stands (128 m from the seat of `var-meaning`) — so ninety metres
 * fired in the middle of the very walk the card had just asked for, and
 * `spent()` went false for the second half of every relief leg while the card
 * still read REACH THE MARK. Two surfaces disagreeing about one fact is the
 * defect this codebase has the longest record of. A hundred and sixty clears
 * that leg with room, and nothing is lost by the move: the valve that actually
 * guarantees no lock is `RELENT`, which is a clock and cannot be walked around.
 */
const FAR_M = 160;
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
     * The cadet, read for two facts and never written: where their feet are
     * now, and how far that is from where this visit to the tear began. The
     * second one is the arrival clock's only honest reset — see `AWAY_M`.
     * Optional; with no player the spend ends on the next arrival, on `relent`,
     * and on nothing else.
     */
    player = null,
    /**
     * IS THERE ANOTHER TEAR? Answered by the world (`src/main.js` reads the
     * tear list), asked when an arrival fills, and REPORTED rather than obeyed.
     *
     * It used to be a veto: no other tear, no spend. That was wrong in one
     * specific and expensive way — it only knows about TEARS, and this game's
     * best answer to "where else" is often not one. `src/meta/objective.js` can
     * send a cadet to a hanging cache, a span or a survey mark, it is the only
     * reader of `spent()`, and it already hands the arrival straight back
     * (`release`) on its next poll when there is genuinely nowhere at all. So
     * the narrow question stopped being allowed to answer the wide one: this
     * module says whether the arrival is FINISHED, that module says whether
     * there is anywhere to go, and the answer here rides along on `onEnd` and
     * in `state()` so a critic can tell the two cases apart.
     *
     * The first line of the first sitting therefore plays exactly as it did:
     * one tear standing, no place in reach, the arrival handed back within
     * 400 ms, the key working, the plate saying OPEN.
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
  let t = 0;              // answers given at this tear, right or wrong
  let age = 0;            // seconds spent standing at this tear
  let offT = 0;           // …and seconds spent away from it, which gives both back
  /** Where the visit to this tear began, so `offT` has something to measure. */
  let homeX = 0, homeZ = 0;
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
   * THE ARRIVAL THAT LANDED NOTHING — read by `src/meta/objective.js`, and the
   * only fact this module publishes about how an arrival went.
   *
   * It is not a score and nothing is taken away for it. It is the one thing the
   * objective needs in order to answer the right question next: a cadet who has
   * just done three pieces of work wants the next line, and a cadet who has
   * just spent the whole arrival missing wants a different way IN to the same
   * one — a balance you crack, a span you lay, a mark you climb. Same line,
   * different representation, different place. See the field leg in
   * src/meta/objective.js.
   */
  let spentDryF = false;

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
    spentDryF = false;
    /* THE CLOCK BELONGS TO THE TEAR, NOT TO THE ARRIVAL, and that distinction
       is the whole of whether this bound can fire at all. It used to restart on
       every `arrive()` — and a cadet who cannot answer the card in front of
       them closes it and opens it again, which is a new arrival every eight
       seconds and a clock that never passes ten. Measured: **963 consecutive
       seconds inside one 2 m circle** with the arrival reading `age 8 of 150`
       the whole time. Time at this tear is the one quantity nothing on the
       learning surface can reset.

       AND SO DO THE ANSWERS, for exactly the same reason and against exactly
       the same measured shape. `t` used to be zeroed here on every re-open, and
       `src/ui/rift.js:2074` only ever reports TWO slips per card — so nine
       answers was a number no cadet could reach by any route, and the sitting
       that was actually measured was **forty-three openings of one ring from
       one square metre**, each of them worth two answers and then a fresh
       count. Nine answers AT THIS TEAR, across the closes and re-opens in
       between, is the bound that reads that sitting for what it is. It still
       cannot cut an arrival short of three pieces of work: the rig can spend at
       most three answers on one of them. */
    if (id !== riftId) {
      age = 0;
      t = 0;
      offT = 0;
      if (player?.pos) { homeX = player.pos.x; homeZ = player.pos.z; }
    }
    if (id !== riftId || ended || n >= items || t >= tries || age >= arrivalSeconds) {
      riftId = id;
      n = 0;
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
  /**
   * …AND THE SAME QUESTION ASKED OF THE INTERACT KEY, WHICH IS THE HALF THAT
   * WAS MISSING — but only when the caller says WHICH TEAR it is asking about.
   *
   * `spent()`'s doc block below has said for three rounds that `src/main.js`
   * reads the spend "before it opens anything on the interact key". It does
   * not: it reads THIS. So a tear whose arrival was used up went on opening for
   * anybody standing on its plate, and `arrive()` handed the spend straight
   * back on the way in — which is the menu with one item on it that the third
   * correction above is entirely about, wearing a different hat.
   *
   * WHY THE ARGUMENT IS NOT OPTIONAL DRESSING. This function is about ONE
   * arrival — the live one — and the caller in `openRift` is about ONE TEAR,
   * and until now those were assumed to be the same thing. They are not: a
   * cadet whose arrival at A is used up and who WALKS TO B is the whole point
   * of the rule, and an unscoped answer would have refused them at B for a
   * reason that belongs to A. Every bound in this file exists to send somebody
   * somewhere; not one of them may refuse them when they get there.
   *
   *   `expired()`         the live arrival's own clock. `src/main.js` reads it
   *                       on the frame loop to hand the world back when a card
   *                       nobody can solve will not close by itself. Unchanged.
   *   `expired(id)`       …and, for the tear being asked for, whether its
   *                       arrival is used up. False for every other tear, so
   *                       walking somewhere always works.
   *
   * Everything downstream is unchanged: `src/main.js` still asks
   * `relay.onward()` for somewhere to go, and **a refusal only stands while the
   * relay has a place to name**; when it has none the tear opens after all. It
   * is a beat, never a wall, and `release`, `RELENT` and `FAR_M` are the three
   * ways it ends on its own.
   */
  function expired(id) {
    if (!riftId) return false;
    if (id != null && id !== riftId) return false;
    if (age >= arrivalSeconds) return true;
    return id != null && spentId != null && spentId === id;
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
    /* THE CLOCK USED TO BE GIVEN BACK HERE, AND THAT IS THE DEFECT.
       `src/main.js` calls this with `!panel.open && nearRift ? nearRift.id :
       null`, so for the whole of every learning card this module was told the
       cadet stood at NO tear — and read it as having walked away. Measured on
       the frozen build: the arrival clock pinned at 2 of 150 for two solid
       minutes with a card up and the same ring feeding it. The clock is given
       back by DISTANCE now, in `update()`, off the cadet's own feet, which is a
       fact nothing on the learning surface can fake. This function keeps the
       one job it can do honestly: an offer nobody comes back for has to lapse. */
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
    /* THE ARRIVAL IS SPENT — a FINISHED one, whatever this module can see.
       A cadet who walks off after one item has not used up a tear and must be
       able to walk straight back onto the plate and finish what they started.
       An arrival is finished when three pieces of work are done, when nine
       answers have been given at this tear without them, or when the arrival's
       own hundred and fifty seconds are gone — see the doc block.

       AND IT NO LONGER ASKS `elsewhere()` FOR PERMISSION, because `elsewhere()`
       only knows about TEARS. `src/meta/objective.js` knows about tears and
       about the places this world owns — a hanging cache, a span, a survey mark
       — and it is the only reader of `spent()`. So one module answers *is the
       arrival finished*, the other answers *is there anywhere to go*, and the
       narrower of the two stopped being allowed to veto the wider one. When
       there is genuinely nowhere, that module hands the arrival straight back
       (`release`) on its very next poll, 400 ms later, which is the same
       first-line behaviour as before and is the proof this can never lock
       anybody out. `elsewhere()`'s answer is still asked and still reported, so
       a critic can read which of the two cases a spend was. */
    const filled = n >= items || t >= tries || age >= arrivalSeconds;
    let somewhere = false;
    try { somewhere = !!elsewhere(riftId); } catch { somewhere = false; }
    if (filled) {
      spentId = riftId;
      spentT = 0;
      /* Did this arrival land anything? The objective asks, so that an arrival
         which landed nothing buys a different way IN to the same line rather
         than the next line along. Nothing is taken away for it. */
      spentDryF = n === 0;
      if (player?.pos) { spentX = player.pos.x; spentZ = player.pos.z; }
    }
    try { onEnd(riftId, { filled, dry: n === 0, elsewhere: somewhere }); }
    catch { /* a beat must never stop the loop */ }
  }

  /**
   * Has this tear given what one arrival is worth?
   *
   * WHO ACTUALLY READS IT, measured rather than hoped, because this block used
   * to name three surfaces and only one of them was true:
   *
   *   `src/meta/objective.js`   yes — the card names somewhere the cadet can
   *                             actually go, and hands the arrival back when
   *                             there is nowhere.
   *   `src/main.js`             yes, THROUGH `expired(id)` above, which carries
   *                             the spend for the tear it is asked about. The
   *                             interact key answers with a place instead of
   *                             another arrival.
   *   `src/world/afford.js`     NO. It reads `holdingAt()` and nothing else, so
   *                             the plate on a spent tear still says OPEN while
   *                             the key answers with somewhere to go. That file
   *                             belongs to the world lane; the key is never
   *                             silent, so this is a caption out of step and
   *                             not a dead door — but it is out of step, and
   *                             saying so here is cheaper than the next reader
   *                             believing the old sentence.
   */
  function spent(id) { return spentId != null && id === spentId; }

  /**
   * DID THAT ARRIVAL LAND ANYTHING? — false unless the tear is spent and the
   * arrival that spent it finished with nothing sealed.
   *
   * Read by `src/meta/objective.js` and by nothing else. It is not a score, it
   * costs nothing, and it can only ever buy a cadet MORE: a place to go that is
   * a different way in to the same line, instead of the next line along.
   */
  function spentDry(id) { return spentId != null && id === spentId && spentDryF; }

  /**
   * Give the arrival back, unasked — the spend AND the clock.
   *
   * `src/meta/objective.js` calls this in exactly one case: the scheduler wants
   * this tear, the tear is spent, and there is **nothing else on the whole
   * shard** to point a cadet at — no other open tear, and no place their kit
   * can reach. A first-line cadet with one tear standing is not sent on a hike
   * to prove a rule; the rule steps aside. That is also the proof that a spend
   * can never become a locked door.
   *
   * IT HAS TO GIVE THE CLOCK BACK TOO, and that is new. `expired()` is now true
   * for a spent tear as well as for an old one, and `src/main.js` reads it
   * before the interact key opens anything — so handing back the spend and
   * leaving a hundred and fifty seconds standing on the counter would refuse
   * the cadet for a reason that had just been withdrawn. Giving an arrival back
   * means giving all of it back: the spend, the clock, and the answers counted
   * against it. `src/main.js`'s debug door (`openRiftById`) calls this for the
   * same reason and gets the same thing.
   */
  function release(id) {
    if (id != null && id !== spentId && id !== riftId) return;
    spentId = null;
    spentT = 0;
    spentDryF = false;
    age = 0;
    t = 0;
    offT = 0;
    if (player?.pos) { homeX = player.pos.x; homeZ = player.pos.z; }
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
    // until the cadet opens a different one or genuinely walks away from it —
    // across the closes and re-opens in between, which is what makes it the one
    // counter here that nothing on the learning surface can stall.
    if (riftId) {
      age += dt;
      /* …AND THIS IS WHERE IT IS GIVEN BACK. It used to be given back in
         `watch()`, off a `nearId` that `src/main.js` sets to null for the whole
         of every learning card — so the clock was zeroed every 2.5 seconds
         while a cadet sat at one ring missing the same question, and the bound
         this file calls "the one that actually holds" was measured pinned at 2
         of 150. A cadet cannot move while a card is up, so a distance measured
         off their own feet runs through the card and is still an honest answer
         to "have they left". Both the clock and the answers go back together:
         they are two readings of one visit. */
      const off = player?.pos ? Math.hypot(player.pos.x - homeX, player.pos.z - homeZ) : 0;
      if (player?.pos && off >= AWAY_M) {
        offT += dt;
        if (offT >= LEAVE) {
          age = 0; t = 0; offT = 0;
          homeX = player.pos.x; homeZ = player.pos.z;
        }
      } else { offT = 0; }
    }
    if (spentId != null) {
      spentT += dt;
      const d = player?.pos ? Math.hypot(player.pos.x - spentX, player.pos.z - spentZ) : 0;
      // A refusal that has run out gives the clock back with it — see `release`.
      if (spentT >= relent || (player?.pos && d >= far)) release(spentId);
    }
    if (!cooling.size) return;
    for (const [id, left] of cooling) {
      const v = left - dt;
      if (v <= 0) cooling.delete(id); else cooling.set(id, v);
    }
  }

  const api = {
    arrive, sealed, tried, more, expired, end, settling, update, hold, holdingAt, watch,
    spent, spentDry, release,
    /** Everything a critic needs, off one call. */
    state: () => ({
      riftId, n, of: items, tries: t, ofTries: tries,
      age: Math.round(age), ofSeconds: arrivalSeconds,
      ended, holding, settling: [...cooling.keys()],
      spent: spentId, dry: spentDryF, far, relent, spentFor: Math.round(spentT),
      /** Metres from where this visit to the tear began — see `AWAY_M`. */
      offBy: player?.pos ? Math.round(Math.hypot(player.pos.x - homeX, player.pos.z - homeZ)) : 0,
      away: spentId != null && player?.pos
        ? Math.round(Math.hypot(player.pos.x - spentX, player.pos.z - spentZ))
        : 0,
    }),
    reset() {
      riftId = null; n = 0; t = 0; age = 0; offT = 0; ended = false; holding = false; away = 0;
      homeX = 0; homeZ = 0;
      spentId = null; spentT = 0; spentDryF = false; cooling.clear();
    },
  };
  live = api;
  return api;
}
