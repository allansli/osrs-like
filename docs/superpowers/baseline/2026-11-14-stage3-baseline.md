# Stage 3 baseline (commit b1c572d)

Captured 2026-11-14 on `feat/start-pacing`, main (Stage 1 and 2 merged) already merged in.

## Gate
- SUITE: 41 test files, 274 tests passed.
- TYPES: `tsc --noEmit` exit 0, no output.
- BUILD: exit 0. JS chunk `dist/assets/index-*.js` 948.78 kB (gzip 261.10 kB); css 29.34 kB; html 18.28 kB.

Commands run through `scripts/capped.sh`.

## Camps (`src/data/worldMap.ts`, `CAMPS`)
| id | aggressive | members | design 4.2 assumed | difference |
|---|---|---|---|---|
| hen_yard | no | 4 chicken | n/a | |
| three_kettle | no | 5 goblin, 2 goblin_archer | n/a | |
| wizards | yes | 3 dark_wizard | wizard 3 | none |
| rangers | yes | 2 dark_ranger | ranger 2 | none |
| giants | yes | 4 hill_giant | giant 4 | none |
| dune_nest_west | yes | 3 scorpion | scorpion 3 | none |
| dune_nest_east | yes | 2 scorpion | scorpion 3 | 1 fewer (largest camp is the west nest: 3, matches) |
| deep_woods_west | yes | 2 moss_guardian | guardian 2 | none |
| deep_woods_south | yes | 2 moss_guardian | guardian 2 | none |
| pass_sentries | yes | 4 lesser_demon | demon 2 | DIFFERENT: 4 attackers, not 2 (design 4.2 notes the largest aggressive camp gives 4 demons, same kill counts) |
| slagfall_terrace | yes | 2 lesser_demon | demon 2 | none |
| dragon | yes | 1 elvarg_dragon | n/a | |

## Nodes by type (`NODE_PLACEMENTS`, `src/data/placements.ts`)
copper_rock 2, iron_rock 3, mith_rock 4, gold_rock 3, runite_rock 3; normal_tree 5, oak_tree 3, willow_tree 2, maple_tree 3, yew_tree 4, magic_tree 3; fish_shrimp 4, fish_trout 3, fish_lobster 2, fish_shark 2.
Total 49. These are whole-map counts, not the design's per-site counts.

## Symbol lines
| symbol | file:line |
|---|---|
| performPlayerAttack | src/engine/actions.ts:83 |
| handleMonsterDeath | src/engine/actions.ts:270 |
| performMonsterRetaliation | src/engine/actions.ts:310 |
| performResourceGather | src/engine/actions.ts:396 |
| rollMonsterHit | src/state/combat.ts:212 |
| ATTACK_INTERVAL (1.65) | src/state/monsterAi.ts:54 |
| DYING_SECS (0.85) | src/state/monsterAi.ts:55 |
| DEAD_SECS (7.5) | src/state/monsterAi.ts:56 |
| loadGameState | src/engine/session.ts:38 (`src/state/session.ts` does not exist; the file is under `src/engine/`) |
| regeneration line (`STATE.hp + f.dt * 0.25`) | src/engine/loop.ts:115 (in `updateVitalsAndRegen`, line 86) |

## M1: pacing model, before any data change (HEAD 325e2d2, after D2, I2, K2 and lane N)

Model: `tests/support/pacingModel.ts`, `tests/support/starterChain.ts`. Kill counts from the new game; average times are information only.

### One-time reproduction of design 4.3 "today" rows
Start `createDefaultState`, no chain, `priceOf: item.price`, quests off, drops on, Stage 2 camps. Kit worn, average minutes, with the difference from the design row.

| Row | Case | | bronze | iron | steel | black | mithril | adamant | rune | dragon |
|---|---|---|---|---|---|---|---|---|---|---|
| T4 | 10x, no Slayer | level kills | 0 | 4 | 12 | 17 | 24 | 45 | 83 | 462 |
| | | kit kills | 0 | 4 | 18 | 28 | 36 | 45 | 83 | 462 |
| | | kit average | 0 | 2.3 m (-24%) | 5.7 m (-6%) | 8.3 m (+4%) | 10.1 m (-16%) | 12.2 m (-6%) | 17.2 m (-4%) | 42.8 m (-3%) |
| T3 | 10x, Slayer | level kills | 0 | 4 | 12 | 17 | 24 | 44 | 83 | 462 |
| | | kit kills | 0 | 4 | 12 | 17 | 27 | 44 | 83 | 462 |
| | | kit average | 0 | 2.4 m (-18%) | 5.0 m (-16%) | 8.1 m (-10%) | 10.9 m (-9%) | 13.4 m (-11%) | 18.5 m (-16%) | 44.1 m (-26%) |
| T4 | 1x, no Slayer | level kills | 0 | 38 | 111 | 162 | 234 | 441 | 823 | 4,614 |
| | | kit kills | 0 | 38 | 111 | 162 | 234 | 441 | 823 | 4,614 |
| | | kit average | 0 | 3.3 m (-17%) | 9.1 m (-9%) | 15.4 m (-4%) | 22.1 m (-4%) | 39.0 m (-2%) | 71.2 m (-2%) | 5.2 h (-1%) |
| T3 | 1x, Slayer | level kills | 0 | 38 | 101 | 145 | 217 | 408 | 790 | 4,581 |
| | | kit kills | 0 | 38 | 101 | 145 | 217 | 408 | 790 | 4,581 |
| | | kit average | 0 | 4.9 m (-2%) | 9.9 m (-23%) | 15.6 m (-26%) | 21.4 m (-29%) | 37.5 m (-31%) | 69.5 m (-32%) | 5.1 h (-34%) |

**Report (more than 20% from the design):** T4 10x iron (2.3 m against 3 m: rounding of a small value), T3 10x dragon (44 m against 60 m), and T3 1x from steel to dragon (5.1 h against 7.8 h at dragon). Both no-Slayer rows otherwise hold within 17%. The Slayer rows are where the first script disagrees: design 5.5 already notes it "charged the walk to the Slayer master differently" (7.9 h against 5.5 h). This model charges 10 s per task, as design 4.2 states. A report, not a failure.

### Dry run of the "after" rows (critique C-1)
Injected, not written: `start: createNewGameState`, the chain, `priceOf: shopPrice` (markup 10), `dropChanceOf` 0.05 x each non-boss equipment chance and 0.05 for the dragon's four, `bountyOf` 300 / 400 / 600 / 1,100 / 1,800 (goblin 400).

| Row | | bronze | iron | steel | black | mithril | adamant | rune | dragon |
|---|---|---|---|---|---|---|---|---|---|
| A1 1x | level | 0 | 39 | 112 | 156 | 228 | 433 | 816 | 4,606 |
| | kit | 1 (chain) | 132 | 354 | 453 | 540 | 824 | 1,558 | 4,606 |
| | kit average | 9 m | 23 m | 42 m | 55 m | 64 m | 89 m | 2.4 h | 5.5 h |
| A3 1x | level | 0 | 39 | 102 | 146 | 218 | 410 | 792 | 4,583 |
| | kit | 1 (chain) | 114 | 186 | 378 | 410 | 448 | 1,087 | 4,583 |
| | kit average | 9 m | 24 m | 30 m | 48 m | 51 m | 56 m | 1.8 h | 5.4 h |
| A1 10x | level | 0 | 5 | 13 | 18 | 25 | 45 | 84 | 463 |
| | kit | 1 (chain) | 47 | 135 | 234 | 321 | 559 | 739 | 1,271 |
| | kit average | 9 m | 19 m | 30 m | 39 m | 47 m | 67 m | 1.5 h | 2.6 h |

| At 1x | iron | steel | black | mithril | adamant | rune | dragon |
|---|---|---|---|---|---|---|---|
| A1, further kills | 93 | 242 | 297 | 312 | 391 | 742 | 0 |
| A1, tiers behind | 1 | 2 | 2 | 1 | 1 | 0 | 0 |
| A3, further kills | 75 | 84 | 232 | 192 | 38 | 295 | 0 |
| A3, tiers behind | 1 | 1 | 1 | 0 | 0 | 0 | 0 |

A1 at 10x, further kills iron to rune: 42 / 122 / 216 / 296 / 514 / 655.

Tests 2 to 6 of `tests/pacing.test.ts` evaluated on these rows: **all pass** (the control, test 5, passes on the live tables). The stop rule is not triggered. The further kills and tiers behind equal design table 5.2 to the kill. Every level count is one kill later than design 4.3 (39 against 38, and so on), because the plan maps the chain's goblin kill to `registerKill` alone, which grants no combat XP; the kit counts carry the same offset, so the differences are unchanged.

For information, the same dry run at the other markups (all pass tests 2 to 6):

| Markup | A1 further kills, iron to adamant | A1 most tiers behind | A3 further kills, iron to mithril | A1 10x further kills, steel to rune |
|---|---|---|---|---|
| 8 | 76 / 196 / 253 / 251 / 274 | 2 | 61 / 84 / 193 / 189 | 99 / 172 / 235 / 443 / 549 |
| 9 | 84 / 229 / 275 / 281 / 332 | 2 | 66 / 84 / 212 / 192 | 111 / 194 / 266 / 502 / 626 |
| 11 | 101 / 254 / 319 / 342 / 450 | 2 | 42 / 84 / 228 / 192 | 134 / 238 / 326 / 505 / 664 |
| 12 | 109 / 266 / 340 / 373 / 509 | 2 | 60 / 84 / 245 / 192 | 146 / 259 / 357 / 503 / 681 |

### Red assertions after D2 (expected until T1)
- `pacing.test.ts`: test 1 (the chain takes 34 actions: the forgings still take ore, so five more copper ore are mined) and the A3 half of test 3 (iron and steel kits arrive with the level: gear still drops at today's chances and bounties are full). Test 7 (forge routes) already passes on ore recipes.
- `economy-invariants.test.ts`: the 2.5 rule (mithril scimitar 2.55 and platelegs 2.99, gilded 17.6 and 14.8, rune 2.80 to 3.15, willow to magic bows 6.1 to 13.3), the fishing bound (trout 1.55 and 2.20, lobster 2.01 at requirement + 21, shark 1.78 and 2.63; shrimp passes), the drop-chance bound, and `bronze armour needs no gold`. The three `shopPrice` assertions pass.
- Fishing depletion is read from `performResourceGather` (today 0.35 per catch; 1 once D4 removes the condition). With D4's respawns the bound computes to at most 0.61 for every spot.
