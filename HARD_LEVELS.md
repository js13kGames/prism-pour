# Hard-level search

Debug → Search for hard level uses the current colors, capacity, empty tubes and starting seed. Stop keeps the best completed candidate. Play best loads it; Export best saves its board, rules, solution and measurements. Hidden colors affect play only: scores assume all colors are visible.

`src/hard-levels.js` is independent of browser and Node APIs. It exports bounded solving, candidate evaluation and batch search. The worker and Debug adapter are separate modules. The existing shortest-path solver accepts optional visit/deadline budgets without changing ordinary solving.

## Batch use

Run from the repository root:

```sh
node scripts/search-hard-levels.mjs --seed=1 --colors=4 --capacity=4 --emptyTubes=1 --seconds=28800 --candidates=10000 --maxVisits=50000 --output=hard-levels.jsonl
```

Every proven candidate is appended immediately as one JSON record. Progress goes to stderr, including `nextSeed` for resuming. Append output is preserved on interruption; resume with that seed and the same rules. No overnight process is started automatically. Increase visit budgets for larger puzzles; expensive candidates may remain unproven and are skipped.

## Scoring version 1

The generator scrambles solved boards backward; candidates must also pass exact forward solving before being retained. Primary scoring is the fraction of 24 sampled, cycle-avoiding detours of up to five moves which are proven unsolvable, plus a bonus for shallow traps. A timeout never counts as a dead end. Unresolved probes remain in the denominator. A loop encountered during sampling is also not itself a dead end.

Secondary terms measure proven solution length, average mistake cost and scarcity of optimal choices among solved branches sampled along the first six solution positions, and moves before the first completed tube. Equivalent tube permutations are deduplicated. Score is a heuristic, not a proof of human difficulty. Sampling is deterministic by seed, but time budgets can truncate analysis; compare candidates with similar coverage and budgets. Free extra tubes during play can rescue traps. Exported metrics expose sample counts and unresolved work.
