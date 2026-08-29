# The stem rewrite, as it was applied

`apply.mjs <patch.mjs>` swaps one line per key in each of
`content/lang/items.{en,es,pl}.js`. Every `p-*.mjs` here is one deck family of
the rewrite, kept so the change is reviewable as prose rather than as a diff of
a thousand one-line edits:

    node scratch/lang/apply.mjs scratch/lang/p-groups.mjs

Order applied: groups, nested+claim, logs, fee/hold/beam, strip, rest,
trim2..trim5 (per-locale overflow), es-trim (Spanish runs longer than English
for the same sentence), salt, crew, plural, plural2.

The gate that keeps it true is `tools/check-language.mjs` — rules `stem` and
`decoy`, measured on real generated items in all three languages.
