/**
 * EN pass three: the walls.
 *
 * Nothing below breaks a checker rule. Every one of them was a paragraph, and a
 * paragraph is the thing an ADHD reader skips. Each is re-cut so the point is in
 * the first sentence and every sentence after it is short enough to scan.
 */
export default [
  // Teacher-facing disclosures. They must still say everything they said —
  // these are honesty statements about a mastery claim — but the headline now
  // comes first and the clauses are separate sentences.
  ["      reconstructed: 'The learner model and the evidence ledger are stored separately, and one came back without the other. {n} questions and {claims} mastery claims were rebuilt from the model, so nothing is under-reported — but time on task and unaided accuracy before the break cannot be recovered and are shown as unknown rather than as zero.',",
    "      reconstructed: 'Part of this record is missing. The learner model and the evidence ledger live in separate stores, and one came back without the other. The model rebuilt {n} questions and {claims} mastery claims, so nothing is under-reported. Time on task and unaided accuracy from before the break are gone. The report shows them as unknown, not as zero.',"],
  ["      foreign: 'The evidence ledger on this device was written against a different learner record, so it was discarded rather than merged. Question counts and claims have been rebuilt from the learner model; the minutes and the unaided rate start again from here.',",
    "      foreign: 'This ledger belonged to a different learner. The rig threw it away rather than merge it. Question counts and claims come from the learner model instead. The minutes and the unaided rate start again from here.',"],
  ["        reconstructed: 'Restored from a partial save. Question counts and claims were rebuilt from the learner model, so nothing is under-reported; time on task and unaided accuracy from before the break are not recoverable and are reported as unknown rather than as zero.',",
    "        reconstructed: 'Restored from a partial save. The model rebuilt the question counts and the claims, so nothing is under-reported. Time on task and unaided accuracy from before the break are not recoverable. The record reports them as unknown, not as zero.',"],
  ["        foreign: 'The evidence ledger found on this device belonged to a different record and was discarded rather than merged. Everything here was rebuilt from the learner model alone.',",
    "        foreign: 'The ledger on this device belonged to a different record. The rig threw it away rather than merge it. Everything here comes from the learner model alone.',"],
  ["    foot: 'Nothing here is a stored grade. Live figures are recomputed from the learner model every time this opens; the evidence behind a mastered line is the receipt written when the claim was granted, and it does not move afterwards. Open a line to see it.',",
    "    foot: 'Nothing here is a stored grade. This report recomputes every live figure from the learner model each time it opens. Behind a held line sits the receipt written when the claim was granted, and that receipt never moves. Open a line to see it.',"],
  ["      foot: 'Record {id} · {n} observations. Every figure above is recomputed from the learner model and the evidence ledger on this device; none of it is a stored grade. A line is held only after an unassisted proving run at the gate band, and the claim is withdrawn again if two later cold re-tests fail.',",
    "      foot: 'Record {id} · {n} observations. None of this is a stored grade. This sheet recomputes every figure from the learner model and the evidence ledger on this device. A line is held only after a proving run with no help, at the gate band. Two failed cold re-tests withdraw the claim again.',"],

  // Marlow's subtitles are typed out one character at a time. A long one is a
  // wall of text that moves.
  ["      verge: 'That curtain is the verge, where Shard Nine ends. The next lands lie eight hundred metres of open sky away. Only the lattice crosses that gap. Hold all ten lines and it will carry you out there. Until then, the verge is a long fall with a view.',",
    "      verge: 'That curtain is the verge. Shard Nine stops there. The next lands are eight hundred metres of open sky away. Only the lattice crosses. Hold all ten lines and it carries you out. Until then: a long fall with a view.',"],
  ["      charged: 'The gold motes grew beside an open rift. Each gold mote pays three times what a pale one pays. That rift also throws a surge out here every fifteen seconds and takes motes back. Seal it and the surges stop. The vein keeps paying.',",
    "      charged: 'The gold motes grew beside an open rift. Each one pays three times what a pale one pays. That rift throws a surge out here every fifteen seconds and takes motes back. Seal it and the surges stop.',"],

  // Three sentences that were still over the twenty-word aim.
  ["      workedSub: 'None of them sealed. The shard does not count attempts and neither do I — but it did not happen for nothing, and the rows below say what it bought.',",
    "      workedSub: 'None of them sealed. The shard does not count attempts, and neither do I. But the work bought something, and the rows below say what.',"],
  ["      signWhole: 'Ten lines, all held, and none of them rots while you are gone. What is left is how deep you can go, and how much of this island you can make one step wide.',",
    "      signWhole: 'Ten lines, all held. None of them rots while you are gone. What is left is how deep you can go. And how much of this island you can make one step wide.',"],
  ["    charterOpen: '{skill}. Everything the kit has is already yours; what is left out there is the island, and it is bigger than you have flown.',",
    "    charterOpen: '{skill}. Everything the kit has is already yours. What is left is the island, and it is bigger than you have flown.',"],
];
