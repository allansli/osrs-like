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
