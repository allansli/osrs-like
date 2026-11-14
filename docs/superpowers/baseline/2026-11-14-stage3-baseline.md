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
- `economy-invariants.test.ts`: the 2.5 rule (mithril scimitar 2.55 and platelegs 2.99, gilded 17.6 and 14.8, rune 2.80 to 3.15, willow to magic bows 6.1 to 13.3), the fishing bound (trout 1.63 at requirement + 21, lobster 2.01 at requirement + 21, shark 1.78 and 2.63; shrimp passes, and so do trout at its requirement, 1.26, and lobster at its requirement, 1.39), the drop-chance bound, and `bronze armour needs no gold`. The three `shopPrice` assertions pass.
- Fishing depletion is read from `performResourceGather` (today 0.35 per catch; 1 once D4 removes the condition). With D4's respawns the bound computes to at most 0.61 for every spot.

## T1: the model on the real world (HEAD 27ce12f, after R1)

Every Stage 3 data change is in place: `GEAR_MARKUP` 10, the drop chances and bounties of D3, the fishing respawns of D4, smithing from bars (D6), the caps of C2.

- `ONE(tests/pacing.test.ts)`: 11 tests passed.
- `ONE(tests/economy-invariants.test.ts)`: 7 tests passed.

No tuning step ran: tests 2, 3, 4 and 6 and the fishing bound passed at the design's values. Values tried: markup 10, drop factor 1 (the design's 0.05 times the `a8cad85` chance, the boss 0.05), the four fishing respawns of D4 as committed. No constant changed. The rows equal the M1 dry run above to the kill, so the dry run's model of D3 matched D3 as committed. The design's row "10" of the 6.1 kills table (93 / 242 / 297 / 312 / 391, at most 2 behind, A3 75 / 84 / 232 / 192 / 38) equals this run and is left as it was.

Control (`CONTROL` of `tests/pacing.test.ts`, run once for the design's row C and table 5.2; not printed by the test): level and kit 39 / 112 / 156 / 228 / 433 / 816 / 4,606 from iron to dragon, 0 further kills at every tier; with Slayer 39 / 102 / 146 / 218 / 410 / 792 / 4,583, 0 further kills. Share of the kit's price earned at the level, iron to dragon: 7.1 / 7.6 / 10.3 / 13.9 / 22.1 / 29.3 / 79.5 times (with Slayer 10.9 / 10.2 / 13.3 / 16.2 / 23.7 / 29.8 / 79.7).

The printed table of `prints the milestone table`, verbatim (average times are information only, rule 0.3.10):

```
A1: tier | level kills | kit kills | further | behind | quests | earned at kit coins/gear/slayer/quests | spent | share at level | average at level / kit | kills at level | kills at kit
bronze | 0 | 1 | 1 | 0 | 6 | 0/7/0/25 | 2 | 0% | 0 m / 9 m | {} | {"goblin":1}
iron | 39 | 132 | 93 | 1 | 8 | 3680/7/400/1325 | 5352 | 48% | 15 m / 23 m | {"goblin":39} | {"goblin":112,"scorpion":20}
steel | 112 | 354 | 242 | 2 | 8 | 19144/7/400/1325 | 20852 | 37% | 19 m / 42 m | {"goblin":112} | {"goblin":112,"scorpion":231,"hill_giant":11}
black | 156 | 453 | 297 | 2 | 8 | 36543/7/400/1325 | 38152 | 44% | 25 m / 55 m | {"goblin":112,"scorpion":44} | {"goblin":112,"scorpion":231,"hill_giant":110}
mithril | 228 | 540 | 312 | 1 | 8 | 51833/7/400/1325 | 53452 | 55% | 31 m / 64 m | {"goblin":112,"scorpion":116} | {"goblin":112,"scorpion":231,"hill_giant":197}
adamant | 433 | 824 | 391 | 1 | 8 | 101746/7/400/1325 | 103452 | 70% | 52 m / 89 m | {"goblin":112,"scorpion":231,"hill_giant":90} | {"goblin":112,"scorpion":231,"hill_giant":481}
rune | 816 | 1558 | 742 | 0 | 8 | 230747/7/400/1325 | 232452 | 79% | 88 m / 2.4 h | {"goblin":112,"scorpion":231,"hill_giant":473} | {"goblin":112,"scorpion":231,"hill_giant":1215}
dragon | 4606 | 4606 | 0 | 0 | 8 | 766433/7/400/1325 | 612452 | 202% | 5.5 h / 5.5 h | {"goblin":112,"scorpion":231,"hill_giant":4263} | {"goblin":112,"scorpion":231,"hill_giant":4263}

A3: tier | level kills | kit kills | further | behind | quests | earned at kit coins/gear/slayer/quests | spent | share at level | average at level / kit | kills at level | kills at kit
bronze | 0 | 1 | 1 | 0 | 6 | 0/7/0/25 | 2 | 0% | 0 m / 9 m | {} | {"goblin":1}
iron | 39 | 114 | 75 | 1 | 8 | 3249/12/3700/1325 | 8252 | 85% | 17 m / 24 m | {"goblin":39} | {"goblin":95,"scorpion":19}
steel | 102 | 186 | 84 | 1 | 8 | 7866/53/3700/1325 | 11852 | 62% | 21 m / 30 m | {"goblin":95,"scorpion":7} | {"goblin":95,"scorpion":91}
black | 146 | 378 | 232 | 1 | 8 | 27880/774/3700/1325 | 33552 | 65% | 26 m / 48 m | {"goblin":95,"scorpion":51} | {"goblin":95,"scorpion":214,"hill_giant":69}
mithril | 218 | 410 | 192 | 0 | 8 | 33504/1035/3700/1325 | 33552 | 72% | 32 m / 51 m | {"goblin":95,"scorpion":123} | {"goblin":95,"scorpion":214,"hill_giant":101}
adamant | 410 | 448 | 38 | 0 | 8 | 40182/2026/3700/1325 | 47052 | 79% | 51 m / 56 m | {"goblin":95,"scorpion":214,"hill_giant":101} | {"goblin":95,"scorpion":214,"hill_giant":139}
rune | 792 | 1087 | 295 | 0 | 8 | 152487/18699/3700/1325 | 176052 | 90% | 83 m / 1.8 h | {"goblin":95,"scorpion":214,"hill_giant":483} | {"goblin":95,"scorpion":214,"hill_giant":778}
dragon | 4583 | 4583 | 0 | 0 | 8 | 766909/109917/3700/1325 | 556052 | 232% | 5.4 h / 5.4 h | {"goblin":95,"scorpion":214,"hill_giant":4274} | {"goblin":95,"scorpion":214,"hill_giant":4274}

A1 10x: tier | level kills | kit kills | further | behind | quests | earned at kit coins/gear/slayer/quests | spent | share at level | average at level / kit | kills at level | kills at kit
bronze | 0 | 1 | 1 | 0 | 6 | 0/7/0/25 | 2 | 0% | 0 m / 9 m | {} | {"goblin":1}
iron | 5 | 47 | 42 | 4 | 8 | 3667/7/400/1325 | 5352 | 27% | 12 m / 19 m | {"goblin":5} | {"goblin":13,"scorpion":23,"hill_giant":11}
steel | 13 | 135 | 122 | 4 | 8 | 19133/7/400/1325 | 20852 | 18% | 13 m / 30 m | {"goblin":13} | {"goblin":13,"scorpion":23,"hill_giant":99}
black | 18 | 234 | 216 | 3 | 8 | 36533/7/400/1325 | 38152 | 15% | 14 m / 39 m | {"goblin":13,"scorpion":5} | {"goblin":13,"scorpion":23,"hill_giant":198}
mithril | 25 | 321 | 296 | 2 | 8 | 51823/7/400/1325 | 53452 | 13% | 15 m / 47 m | {"goblin":13,"scorpion":12} | {"goblin":13,"scorpion":23,"hill_giant":285}
adamant | 45 | 559 | 514 | 2 | 8 | 102279/7/400/1325 | 103452 | 10% | 18 m / 67 m | {"goblin":13,"scorpion":23,"hill_giant":9} | {"goblin":13,"scorpion":23,"hill_giant":507,"lesser_demon":16}
rune | 84 | 739 | 655 | 1 | 8 | 230979/7/400/1325 | 232452 | 9% | 23 m / 1.5 h | {"goblin":13,"scorpion":23,"hill_giant":48} | {"goblin":13,"scorpion":23,"hill_giant":507,"lesser_demon":196}
dragon | 463 | 1271 | 808 | 0 | 8 | 611359/7/400/1325 | 612452 | 21% | 57 m / 2.6 h | {"goblin":13,"scorpion":23,"hill_giant":427} | {"goblin":13,"scorpion":23,"hill_giant":507,"lesser_demon":728}

Forge route and income, per tier (best gathering and crafting GP/h at the tier level, A1 fighter GP/h from level to kit):
iron: forge 122 actions, gathered {"copper_ore":42,"iron_ore":7}, crafted {"smelt_bronze":42,"smith_bronze_legs":21,"smelt_iron":7,"smith_iron_scim":1,"smith_iron_legs":1,"smith_iron_plate":1}; best gathering copper_rock 13009 GP/h; best crafting smith_bronze_legs 27320 GP/h; fighter 22418 GP/h
steel: no forge recipe; best gathering iron_rock 43522 GP/h; best crafting smith_iron_legs 91075 GP/h; fighter 44052 GP/h
black: no forge recipe; best gathering iron_rock 44862 GP/h; best crafting smith_iron_legs 93877 GP/h; fighter 62917 GP/h
mithril: forge 415 actions, gathered {"copper_ore":42,"iron_ore":115,"mithril_ore":10}, crafted {"smelt_bronze":42,"smith_bronze_legs":21,"smelt_iron":115,"smith_iron_legs":57,"smelt_mithril":10,"smith_mith_scim":1,"smith_mith_legs":1,"smith_mith_plate":1}; best gathering iron_rock 45870 GP/h; best crafting smith_iron_legs 95987 GP/h; fighter 76296 GP/h
adamant: no forge recipe; best gathering maple_tree 88138 GP/h; best crafting fletch_maple_bow 181552 GP/h; fighter 111322 GP/h
rune: forge 1679 actions, gathered {"copper_ore":42,"iron_ore":115,"mithril_ore":122,"gold_ore":451,"runite_ore":45}, crafted {"smelt_bronze":42,"smith_bronze_legs":21,"smelt_iron":115,"smith_iron_legs":57,"smelt_mithril":122,"smith_mith_legs":40,"smelt_gold":451,"smelt_runite":45,"smith_rune_legs":9,"smith_rune_scim":1,"smith_rune_plate":1}; best gathering gold_rock 144000 GP/h; best crafting fletch_yew_bow 206905 GP/h; fighter 139247 GP/h
```
