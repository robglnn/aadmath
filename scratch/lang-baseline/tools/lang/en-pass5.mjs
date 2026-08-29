/**
 * The orders card a new player actually reads on run one is this one, not
 * `session.charter.goalHold` — the kit path wins whenever a piece of kit is
 * still locked, which on run one it always is. So this is the second place the
 * word "line" has to define itself.
 */
export default [
  ["    charterNext: '{skill}. Hold that line and {grant} is yours. {what}',",
    "    charterNext: '{skill}. A line is one idea, plus the rifts that test it. Hold this line and {grant} is yours. {what}',"],
];
