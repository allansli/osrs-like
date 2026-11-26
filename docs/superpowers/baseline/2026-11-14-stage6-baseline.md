# Stage 6 baseline (task R0)

**Verdict: STOP (O-6.1b).** Every name the design takes from Stages 3, 4 and 5 exists in the shape it uses. SG, ECON, MODEL and PACE all pass on the merged tree. Two frozen tests pin counts that design 11.3 does not declare (stop rule: "a frozen test pins a count that design 11.3 does not declare"). Both are listed in section 5, together with the declaration the owner would add. Nothing else stops the stage. Section 6 lists two content-file changes: one is required, the other only follows from removing the overlays.

Tree: `feat/content-systems` at `72c95ab`, which is `8761672` (origin/main `2c9c697`, Stages 1 to 5 and the models pass, merged in) plus the R0 workflow file. No rebase was needed. The local `main` ref is stale (`c84cd12`), so the "only docs" check below is taken against `origin/main`. The commands are the brief's gate commands (`flock /tmp/claude-capped.lock scripts/capped.sh ...`). Plan 0.2's `systemd-run` lines are obsolete.

## 1. Gates, sizes and symbol lines

| Gate | Command | Result |
|---|---|---|
| SUITE | `scripts/capped.sh npx vitest run` | exit 0. **130 test files, 1,431 tests: 1,428 passed, 3 skipped** (the `skipIf` cases of `tests/monster-motion.test.ts`, which skip when a figure is not built) |
| TYPES | `scripts/capped.sh npx tsc --noEmit` | exit 0, no output |
| BUILD | `scripts/capped.sh npm run build` | exit 0 |
| ECON | `ONE(tests/pacing.test.ts)`, `ONE(tests/economy-invariants.test.ts)` | 11 of 11 passed, 7 of 7 passed |
| MODEL | `scripts/capped.sh bash docs/superpowers/research/content-model/run.sh` | exit 0: `ALL CHECKS PASS`, `EVERY BOUND HOLDS, WITH TODAY'S FORMULA AND WITH THE REBALANCE`, `ALL AGGRESSION CHECKS PASS` (after the change in section 6.1) |
| PACE | `scripts/capped.sh bash docs/superpowers/research/content-model/pacing-rerun.sh` | exit 0. All five blocks end with `EVERY ASSERTION OF pacing.test.ts HOLDS` |
| second pass | `scripts/capped.sh bash docs/superpowers/research/content-model/second-pass.sh` | exit 0, `SECOND-PASS CHECKS PASS` |
| critique check | `scripts/capped.sh bash docs/superpowers/research/content-model/critique-check.sh` | exit 0. `critique-results.txt` is byte-identical to the committed file |

The bundle is reported, not held to a limit: the owner retired the hard JS limit on 2026-11-26.

| file | size | gzip |
|---|---|---|
| `dist/index.html` | 20.63 kB | 5.52 kB |
| `dist/assets/index-B8AMdTop.css` | 37.73 kB | 7.96 kB |
| `dist/assets/index-CNbxwCIK.js` | **1,097.21 kB** | 311.09 kB |

Design section 10 measures "at most 140 kB more" from this JS number.

### Symbol lines at `72c95ab`

Every symbol is found by name. Lines that moved since `87f18e7` are marked. `src/state/monsterAi.ts`, `combat.ts`, `collision.ts`, `pathfind.ts`, `worldMap.ts` and `attacks.ts` are byte-identical to `87f18e7`. `src/data/world.ts` gained 5 lines (`kit`, `body`) and `src/engine/actions.ts` gained 6 (death and respawn clips, after line 560).

| Symbol | File:line |
|---|---|
| `createDefaultState`, `createNewGameState`, `applyState` | `src/state/gameState.ts` 19, 89, 116 |
| `QUEST_DEFS`, `STARTER_QUESTS`, `combatLevel`, `monsterThreatColor`, `isBossLoot`, `resolveDragonfire`, `starterView`, `questView`, `claimQuest`, `adventureTracker` | `src/state/adventure.ts` 60, 222, 409, 428, 442, 513, 580, 596, 632, 758 |
| `STARTER_ARRIVAL` | `src/state/quests.ts` 3 |
| `GEAR_MARKUP`, `shopPrice`, `unitSellPrice`, `ITEMS` | `src/data/items.ts` 72, 74, 80, 31 |
| `MAX_GP`, `creditGp`, `HP_REGEN_PER_SEC`, `FISH_DEPLETION_CHANCE`, `rollDrops`, `gatherChance` | `src/state/economy.ts` 4, 7, 19, 22, 28, 47 |
| `unlocksAt`, `forgeHint` | `src/state/unlocks.ts` 12, 53 |
| `prepareAttack`, `mitigateDamage`, `playerAttackProfile` (ranged branch 223-225, magic 226-229), `playerHitChance`, `monsterHitChance`, `rollMonsterHit`, `Marks`/`addMark`/`tickMarks`, `rollMonsterAttack` | `src/state/combat.ts` 91, 111, 213, 242, 246, 257, 284-300, 306 |
| `CADENCE_SECS`, `BOSS_ARENA_MARGIN`, `BOSS_FIRST_ENTRY_SECS`, `Shape`, `AttackDef`, `ATTACKS`, `PhaseDef`, `BossDef`, `BOSSES`, `PATTERNS` | `src/data/attacks.ts` 1, 6, 7, 16, 23, 34, 141, 149, 158, 191 |
| `RUNE_COSTS` (not exported), `SPELLS` | `src/data/magic.ts` 21 (ice burst 24, blood barrage 25), 32 |
| the combat spells' rows and "Max Hit" descriptions | `src/data/catalog.ts` 401-405 |
| `MonsterDef` (`pattern`, `model`, `tint`, `modelScale`, `kit`, `body` at 34-40), `MONSTER_TYPES`, `RESOURCE_NODES_DEF` | `src/data/world.ts` 20, 43, 181 |
| `CampDef` (`arenaRadius` 62), `makeCamp`, `CAMPS`, `SAFE_ZONES`, `isInSafeZone` | `src/data/worldMap.ts` 55, 156, 176, 253, 260 |
| `NODE_PLACEMENTS`, `WOODS_TREES` | `src/data/placements.ts` 13, `src/data/woodsTrees.ts` 18 |
| `MonsterLogic`, `MonsterEvent`, `StepWorld` (`grid` 80, `pathBudget` 82, `windupGate` 83), `DEAD_SECS`, `isPlayerSafe`, `createMonsterLogic`, `attackRange`, `followPath`, `resetToIdle`, `enterReturn`, `stepMonster` | `src/state/monsterAi.ts` 24, 61, 72, 99, 105, 109, 165, 197, 225, 239, 262 |
| `stepMonster`: dying→dead (boss respawn) 265-271; the chase test `distToPlayer > attackRange(m)` 355; the route goal `entityGoal(..., attackRange(m))` 392; the idle acquisition block (T2) 437-479, with its first strike 465 | `src/state/monsterAi.ts` |
| `startBossOpening`, `crossPhase`, `patternAttack` | `src/state/monsterPattern.ts` (imported at `monsterAi.ts` 20) |
| `isWalkableGround`, `isWoodsTreeCell`, `isWalkable`, `moveWithCollision` | `src/state/collision.ts` 109, 120, 134, 138 |
| `WalkGrid`, `buildWalkGrid`, `segmentWalkable`, `openStart`, `findPath`, `entityGoal` | `src/state/pathfind.ts` 3, 10, 27, 142, 146, 320 |
| `serializeState`, `sanitizePose` | `src/state/save.ts` 138, 209 |
| `regenRate`, `deathLoss`, `vowPrice`, `applyDeathLoss`, `buyVow`, `shouldRetaliate` | `src/state/sustain.ts` 111, 115, 154, 158, 207, 217 |
| `PlayerCommand`, `applyCommand` | `src/state/commands.ts` 9, 29 |
| `dispatchCommand`, `performPlayerAttack` (cost removed 192, profile 193), `maybeRetaliate`, `performMonsterRetaliation` (the Lesser Demon's orb branch 495) | `src/engine/actions.ts` 107, 179, 434, 449 |
| `WINDOW_GLOBALS`, the `data-action` listener | `src/engine/runtime.ts` 116, 157-172 |
| `G.walkGrid`, `MonsterEntity.id` | `src/engine/context.ts` 231, 132; ids are `monster_<n>` (`src/engine/spawns.ts` 64) |
| the gatherer's `stopDist` | `src/engine/loop.ts` 237-255 |
| `G.monstersList` readers | `loop.ts` 139 (was 138), 642-648; `actions.ts` 122, 441; `overlay.ts` 157, 296 |
| `saveGameState`, `loadGameState` | `src/engine/session.ts` 14, 42 |
| `CAMERA_FAR`, `SKY_DOME_RADIUS`, `HORIZON_APRON` | `src/data/look.ts` 225, 226, 229 |
| `updateSky`, `updateLightingFrame` (fog density 213), `getWeatherState` | `src/engine/sky.ts` 159, `src/engine/lighting.ts` 203, `src/engine/particles.ts` 305 |
| `upgradeMonsterRigWithGltf`, `loadBlenderMonstersTemplate`, `MONSTER_MOTION` | `src/engine/blenderMonsters.ts` 85, 10; `src/data/monsterPoses.ts` 40 |
| `tests/support/pacingModel.ts`: the `monsterThreatColor` import, `largestAggressive`, `attackers` | 17, 113, 141 (as design 11.3 item 9) |
| `src/__tests__/blender-hero.test.ts`: type-key count | **155** (design 11.3 item 6 says 138); the species count is at 157 |

## 2. Names assumed from Stage 3

All exist, with the shapes the design uses:

- `createNewGameState`, `STARTER_QUESTS`, `STARTER_ARRIVAL` and `starterView` exist.
- `claimQuest` reads both tables: `QUEST_DEFS.find(...) || STARTER_QUESTS.find(...)` (adventure.ts 634).
- `adventureTracker` checks in this order: the open starter quest, then a discovered quest, then an unclaimed one, then "Every quest is claimed".
- `shopPrice`, `GEAR_MARKUP` 10, `creditGp`, `MAX_GP` 2147483647, `rollDrops`, `gatherChance`, `HP_REGEN_PER_SEC` 0.25, `unlocksAt`, `forgeHint`, `playerAttackProfile`, `playerHitChance` and `monsterHitChance` exist.
- The tests `pacing.test.ts`, `economy-invariants.test.ts`, `content-freeze.test.ts`, `save-compat-s3.test.ts` (goldens `tests/fixtures/s3/default-state.golden.json` and `save-v4-loaded.golden.json`, regenerated with `UPDATE_GOLDEN=1`), `starter-quests.test.ts` and `tracker-order.test.ts` all exist.
- `content-freeze.test.ts` declares additions as named arrays subtracted from the live ids before comparing with `content-ids.golden.json`: `DECLARED_NEW_ITEMS` (line 12) and `DECLARED_NEW_MONSTERS` (line 14). It has no node or recipe list, as design 11.3 item 1 says.
- `tests/support/pacingModel.ts` exports `TIERS`, `fight`, `simulate`, `furtherKills`, `tiersBehind`, `forgeTasks` and the rest. `starterChain.ts` exports `STARTER_ACTIONS` (29) and `playStarterChain`.
- Forging takes bars. Every Stage 3 recipe input and requirement the old `S3` overlay wrote matches `FORGE_RECIPES` (0 differences).
- Gear drops are already Stage 3's 0.05 times the old chance (for example the goblin's iron plate at 0.008), and the dragon's is 0.05.
- Fishing spots deplete with `FISH_DEPLETION_CHANCE` 1 (Stage 3).

## 3. Names assumed from Stage 4

All exist:

- **Attack data.** `src/data/attacks.ts` holds `AttackDef` (`id`, `name`, `shape`, `windupMs`, `slots`, `style`, `power?`, `reach`), `ATTACKS`, `PATTERNS` (six heavy monsters), `BossDef` (`respawnSecs`, `arenaRadius`, `title?`, `openingShiftMs`, `mark {step, max, secs}`, `phases[]` with `shiftMs`) and `BOSSES` (Ashmantle only).
- **Monster rows.** `MonsterDef` has `.pattern`, `.model`, `.tint` and `.modelScale`, and the models pass added `.kit` and `.body`. `CampDef.arenaRadius` exists.
- **Step world.** `StepWorld` has `.grid`, `.pathBudget` and `.windupGate`.
- **Walk test and clamp.** `moveWithCollision(x, z, dx, dz, walkable = isWalkable)` takes an optional walk test, and **still clamps to ±118 when given one** (collision.ts 145). Z2's planned change stands.
- **Path search.** `findPath(..., maxExpanded?)` exists (stepMonster passes 6000). `segmentWalkable` and `openStart` are exported.
- **Boss respawn.** A boss's dead time is `BOSSES[m.typeKey].respawnSecs`, read inside `stepMonster` at the dying→dead step (line 270). Any other monster gets `DEAD_SECS` 7.5. **`createMonsterLogic(typeKey, homeX, homeZ, opts?: { campId, wander })` receives no respawn value.** F6, Z2 and C2 add one, as planned.
- **Events.** `windup`, `resolve`, `cancel` and `phase` exist, along with `attack`, `died`, `respawned`, `aggro` and `reset`.
- **Sustain.** `src/state/sustain.ts` has `buyVow`, `vowPrice`, `applyDeathLoss`, `deathLoss` and `shouldRetaliate`. `quests.lanternVow` is `true | undefined` (types.ts 48).
- **Commands.** `src/state/commands.ts` defines `PlayerCommand`: `attack`, `move`, `eat`, `drink`, `prayer`, `style` and `special`. It also has `applyCommand`, and the engine has `dispatchCommand` (actions.ts 107).
- **Monster ids.** Each monster has a stable `id`, `monster_<n>`.
- **Boss loot.** `isBossLoot` returns true for a type with a `BOSSES` row, which is Ashmantle today.
- **Rows and camps.** The rows `saltback_stalker`, `thornwatch_marksman` and `ashmantle` exist. Their camps, with centroid, radius, aggro radius and arena:

| Camp | Centre | Radius | Aggro | Arena | Members |
|---|---|---|---|---|---|
| `saltback_shore` | (106.00, 105.67) | 8 | 9 | | 3 Saltback Stalkers |
| `thornwatch` | (-18.00, -48.00) | 8 | 12 | | 2 Thornwatch Marksmen |
| `ashmantle` | (-102, 54) | 5 | 12 | 12 | Ashmantle |
| `slagfall_terrace` (Stage 2, C1 moves it) | (-82, 100) | 11 | 9 | | 2 Lesser Demons |

- **Fight model.** Stage 4's fight model is `tests/support/bossModel.ts`. It exports `BOSS_KEY` (`'ashmantle'`), `seeded`, `Style`, `Fighter`, `Outcome`, `fight(f, seed)`, `FIGHTERS` (A, B, C, F, G, R, Rstill, M, Mstill, FR, FM) and `runRow(key, n)`. `tests/boss-fight.test.ts` runs it over 500 seeds. **It is fixed to Ashmantle, to its own fighters and to `playerAttackProfile`**: it takes no boss, no style numbers and no arrow. B1 to B3 cannot call it as it is (section 6.2).

## 4. Names assumed from Stage 5

- **CALL-V13 was taken.** `index.html` has 38 `data-action` attributes and no inline handler, and `tests/globals.test.ts` checks this.
  - **The delegation.** One `document` click listener in `src/engine/runtime.ts` 157-172 finds `[data-action]`, accepts only names in `WINDOW_GLOBALS` (it throws otherwise), and passes an optional `data-arg`.
  - **For Q8, Q9 and F4.** `tests/globals.test.ts` also checks that `src/ui/stations.ts` sets no `data-action`. That rule exists because a `data-action` set from a script would be read as a window global. New panels should wire their buttons with their own listener, as `stations.ts` does with `dataset.transfer`.
- **Class names** (index.html): `ui-panel`, `panel-header-title`, `hud-btn`, `tab-bar`, `tab-btn` and `tab-content`. Modals use `modal-backdrop`, `modal-header`, `modal-body`, `modal-close` and `modal-subtext`. Other classes are `style-btn` and `spec-attack-btn`.
- **Tokens** (`src/ui/styles.css` 7-22): `--ui-ink`, `--ui-slate-1` to `-3`, `--ui-bone`, `--ui-bone-dim`, `--ui-brass`, `--ui-brass-hi`, `--ui-ember`, `--ui-moss`, `--ui-tide`, `--ui-amethyst`, `--ui-warn`, `--ui-panel`, `--ui-font-display` and `--ui-font-text`.
- **Woods trees.** `src/data/woodsTrees.ts` `WOODS_TREES` is a literal table of `[i, j]` cells, with the cell centre at `-118 + i + 0.5`. `collision.ts` builds a 236 x 236 mask from it lazily (`isWoodsTreeCell`, 120), and `isWalkable` is `isWalkableGround && !isWoodsTreeCell`. **`buildWalkGrid(walkable = isWalkable)` is unchanged**: one optional parameter, and the trees come in through the default walk test.
- **Fog.** It is created as a `THREE.FogExp2` in `src/engine/renderer.ts` 128. Its density is written every frame from `weather.fogScale` (`getWeatherState`, particles.ts 305) in `lighting.ts` 213 (`AIR.uFogDensity`), and copied to `scene.fog` in `sky.ts` `updateSky` 164-165. The world materials read the air uniforms of `src/engine/atmosphere.ts`.
- **Sky dome and apron.** Both are owned by `src/engine/sky.ts`:
  - **Dome.** It is `G.skyDomeMesh` (112), and it follows the camera (163).
  - **Apron.** It is `apronMesh`, which is **private to the module** (118).
  - **Hiding.** Nothing hides either today, and no function exports that. Z6 needs one in `sky.ts`.
- **Values.** `CAMERA_FAR` 460, `SKY_DOME_RADIUS` 440 and `HORIZON_APRON` `{ inner: 130, outer: 240 }`, as the design assumed (460 and 240). MODEL now reads these constants.

## 4b. Stage 4 code the zones depend on

- **Walk tests in `stepMonster`.** `stepMonster` has **four** `moveWithCollision` calls, not three:
  - `followPath` (209) passes `grid.walkable`; it is the chase and return route used when `world.grid` is set.
  - The return without a grid (302) and the chase without a grid (370) pass **no** test, so they use the overworld's `isWalkable`.
  - The wander (519) passes `world.grid?.walkable`.
  - So with a zone grid, chase and return already route on it. Z2's edit ("its three calls pass `world.grid?.walkable`") applies to 302 and 370, and 519 already does it.
- **The clamp.** `moveWithCollision` clamps to ±118 even when given a test (see section 3).
- **Dead time.** It comes from `BOSSES[type].respawnSecs` or `DEAD_SECS`, chosen per type in `stepMonster`, not per monster.

## 4c. What the two rule changes stand on

- **The acquisition block is still Stage 2's** (monsterAi.ts 437-479). Its condition is `camp && camp.aggressive && !world.playerDown && !world.playerSafe && world.playerCombat != null && monsterThreatColor(m.level, world.playerCombat) !== 'green'`. The radius is `camp.aggroRadius ?? (magic or ranged ? 12 : 9)`, and the hero must also be within `camp.radius` of the camp. Stage 4 added only the boss opening (460-464) and the pattern index on the first strike. Both anchors of `run.sh` and `second-pass.sh` match exactly once. **Not rewritten: no stop.**
- **No test pins the old aggression rule except the declared one.**
  - The only test of "ignores a hero above its level" is `tests/monster-territory.test.ts` 259-273 (design 11.3 item 8).
  - No test pins Ashmantle's "combat level 110 or less" (grep: none).
  - `tests/boss-phases.test.ts` plays combat 70 against level 110 (125, 737, 755).
  - `monster-routes` plays combat 3, and `monster-patterns` and `sustain` play the default hero. All are at or below the monster's level, where nothing changes.
- **`playerAttackProfile`'s branches are the expressions design 7.12 writes out.**
  - Ranged: `max(2, floor((2 + 0.35·Ranged + 0.22·bonus) × prayer))`.
  - Magic: `max(3, floor((spell + 0.22·Magic + 0.18·bonus) × prayer))`.
  - Melee is untouched. **Not rewritten: no stop.**
  - The arrow is known in `prepareAttack` (combat.ts 91-104, through `ammoForWeapon`).
  - In `performPlayerAttack` the swing's cost is removed (actions.ts 192) before `playerAttackProfile` is called (193), which S4 depends on.
- **Stage 4's boss model calls `playerAttackProfile`** (`tests/support/bossModel.ts` 82). S2 therefore changes `tests/boss-fight.test.ts`'s numbers.
  - On today's formula: R 99.0% and M 100.0%, against a bound of 85%.
  - MODEL's rebalanced columns for the same rows: R 98.1% with bronze bolts and 97.9% with the bolt of its level; M 99.5%. Every bound holds.
- **A hit does not stop a gatherer, and Stage 4's auto-retaliation skips one.**
  - Gathering sets `player.targetEntity = { type: 'resource' }` (input.ts 301, 436). No monster hit clears it.
  - `maybeRetaliate` (actions.ts 434-447) retaliates only when `!hasTarget`, through `shouldRetaliate` (sustain.ts 217).
  - **For CALL-6.29 (b):** auto-retaliation lives in `src/engine/actions.ts` (`maybeRetaliate`, called from `performMonsterRetaliation` 475, 480 and 535), not in `loop.ts`. That is the file G2 adds.
- **Tests pinning a ranged or magic max hit** (grep `playerAttackProfile`, `maxHit`): `tests/combat-profile.test.ts` and `tests/entry-staff.test.ts` 45-48. The five values and the one value are exactly design 11.3 items 10 and 11:
  - `combat-profile` 58: shortbow 5; 60: Sharp Eye 7; 65: wind strike 10; 68: fire bolt 17; 71: Mystic Might 12.
  - `entry-staff` 48: `{ maxHit: 6, accuracy: 21.5 }`.
  - Its other users are the two support models: `bossModel.ts`, above, and `pacingModel.ts`, which is melee.

## 5. Frozen counts: two not declared (the STOP)

Found with a grep over every existing test for `toHaveLength(n)`, `.length).toBe(n)` and `.size).toBe(n)`, and for every loop over `MONSTER_TYPES`, `CAMPS`, `NODE_PLACEMENTS`, `ITEMS` and `FORGE_RECIPES`. Every test file the models pass added since `87f18e7` was checked the same way.

**Declared and found as design 11.3 says:**

- `tests/world-budget.test.ts` 41 and `tests/world-data.test.ts` 162 (42 members).
- `src/__tests__/blender-hero.test.ts`: the type-key count 13 is at line **155**, not 138. Its species count of 10 (157) holds, because every new row reuses one of the ten meshes.
- `tests/scatter.test.ts` 176 and 178, and `tests/woods-trees.test.ts` 134 and 240 (15 camps, 42 members).
- `tests/new-monsters.test.ts` 125 (`NEW`) and 132 (`MODELS` 10).
- `tests/fixtures/size-refactor-golden.json` `monsters` (`f3c2f70d...`). `monsterAi.ts` is unchanged since `87f18e7`, so the declared digest still applies.
- The Stage 3 goldens and `tests/fixtures/save-relocation/v4-loaded.json` (skills).
- `tests/monster-territory.test.ts` 259-273, `pacingModel.ts` 17 and 141, `combat-profile.test.ts` and `entry-staff.test.ts`.
- No existing test pins the number of skills, commands, `WINDOW_GLOBALS`, recipes or items: `globals.test.ts` asserts only `> 10` data-actions, and `commands.test.ts` lists no kinds. **Design 11.3 item 12 needs nothing.**

**Not declared (stop rule):**

1. **`NODE_PLACEMENTS` has 46 rows, pinned three times** (Stage 5):
   - `tests/scatter.test.ts` 175 (`expect(NODE_PLACEMENTS).toHaveLength(46)`);
   - `tests/woods-trees.test.ts` 135 (inside `targets()`, which the reachability and route tests call);
   - `tests/woods-trees.test.ts` 218.

   D2 appends three `coal_rock` placements to `src/data/placements.ts` (46 to 49), and N2 appends two `runestone_rock` placements (to 51). Each of the three asserts fails as soon as D2 lands. The design's 2026-11-25 run found the camp counts by running the suite with the cave's data only, which adds no node, so it could not see this one.

   *Proposed declaration* (design 11.3 item 13b, made by D3 and N1 the way item 13 is): `46` to `49` (D3, before D2's rows land), then `49` to `51` (N1). Every other assertion of both files passes unedited with the new placements. MODEL now checks the woods-tree clearance that `woods-trees.test.ts` 215 applies, and scatter avoids every node and camp member by itself (`src/state/scatter.ts` 77-78).

2. **`tests/monster-kits.test.ts` 105-123 holds a snapshot of every `MONSTER_TYPES` row's model key** (models pass), titled "the model keys of every row equal a snapshot, so Stage 4's tests still see ten". Its `expect(keys).toEqual({...})` lists the 13 types. Any new row fails it, starting with D4's three, then Z4's two, C2's one and U1's one. Its last line (`new Set(Object.values(keys).filter((_, i) => i < 10)).size` is 10) holds, because new rows are appended after the first ten.

   *Proposed declaration* (design 11.3 item 14b, made by D3, Z3, C1 and U0, the same task that extends `NEW` in `tests/new-monsters.test.ts`): the object gains each Stage 6 type with its model key when its row lands:
   - D3: `cinder_adept: 'dark_wizard'`, `slag_brute: 'hill_giant'`, `marrowjaw: 'hill_giant'`;
   - Z3: `scree_skitter: 'scorpion'`, `saltfang: 'scorpion'`;
   - C1: `ember_hurler: 'lesser_demon'`;
   - U0: `kiln_warden: 'moss_guardian'`.

   No other line changes. It is at least as strict, because each new row's model key is pinned by name.

What the owner decides at O-6.1b: add items 13b and 14b to design 11.3 (and to plan 0.3.3, D3, N1, Z3, C1 and U0), or change the plan otherwise. Nothing under `src/` or `tests/` is touched before that.

## 6. The model on the real code

Changes to `docs/superpowers/research/content-model/`:

- **The overlays are gone.**
  - `content.ts` no longer has `S3`, `S4_MONSTERS` or `S4_ASHMANTLE_ARENA`.
  - `model.ts` and `critique-check.ts` read `FORGE_RECIPES`, `MONSTER_TYPES` and `GEAR_MARKUP` as shipped.
  - The Ashmantle arena is now the camp's centre, `BOSSES.ashmantle.arenaRadius` and `BOSS_ARENA_MARGIN`.
  - A run with the overlays still on the merged tree would apply Stage 3's ×0.05 to gear drops twice. That is why an intermediate run read the Lesser Demon at 140.6 GP/s instead of 178.5.
  - `S3.bounties` was not read by any script.
- **`boss.ts` reads Ashmantle from the game.** The copy of its row and attacks is deleted, and so is the line in `fight.ts` that wrote the copy over `MONSTER_TYPES.ashmantle`. The first draft's dragon fight, unused, is deleted too. The types stay for content.ts's three bosses.
- **`fight.ts` runs Stage 4's rules.** It cannot be replaced by an import of `bossModel.ts` (section 3), so it is ported onto that model's rules instead:
  - `inShape`, `rollMonsterHit` and `rollMonsterAttack` (the marks multiply after mitigation, and dragonfire is `resolveDragonfire`);
  - `addMark` and `tickMarks` with the boss's own mark row;
  - `regenRate`, `FOOD_CD_SECS`, `CADENCE_SECS`, `BOSS_FIRST_ENTRY_SECS` and `TICK_SEC`;
  - the opening roar and each phase's `shiftMs`, the `Math.round` phase floor of `crossPhase`, and bossModel's `seeded`.

  It keeps what check.ts needs that bossModel lacks: the boss as a parameter (a boss with no `BOSSES` row is registered there, with Ashmantle's mark max and seconds), `f.prayer`, the rebalance numbers, the arrow, and the extra fighters.

  The hero's swing is `playerAttackProfile` and `playerHitChance`. With today's numbers and no arrow, every swing asserts that the rebalance expression equals `playerAttackProfile`; it never threw.
- **Proof of the port.** A new first block of `check-results.txt` runs both `fight.ts` and the shipped `runRow` on Ashmantle over seeds 1 to 500 with today's formula. **All 11 rows are identical** (A 99.4% 105 s, R 99.0% 63 s, M 100.0% 50 s, FR 1.0%, FM 10.8%), the same numbers `tests/boss-fight.test.ts` prints.
- **Stage 4's camps and Stage 5's trees are in the placement checks.** `CAMPS` is read live, so Stage 4's three camps count in every gap. `isWalkable` blocks tree cells. Two new rules are added: a new node must be at least 4.5 from a tree centre, and a new camp's radius + 2 must be clear of every tree (`tests/woods-trees.test.ts` 215 and 239).
- **The far-plane check reads the constants.** It uses `CAMERA_FAR` and `HORIZON_APRON.outer` in place of 460 and 240.
- **The scripts run in the capped container.** `systemd-run` is dropped from `run.sh`, `pacing-rerun.sh`, `second-pass.sh` and `critique-check.sh`; each now runs node with an empty environment and a 1 GB heap, behind `scripts/capped.sh`. `git` does not work inside the container, because this worktree's `.git` points outside the mount. So `pacing-rerun.sh` and `second-pass.sh` now copy the working tree by default (the merged tree, `72c95ab`), and a ref argument or `PACE_REF` still reads a ref where git works.

### 6.1 Failed checks and the smallest fix (content file; the design follows)

**One check failed and was fixed: the Runestone Outcrops.** `runestone_rock` at (-48, -4) stands on a Stage 5 woods-tree cell (not walkable). Its pair at (-44, -6) is walkable, but only 4.3 from a tree centre, under `woods-trees.test.ts`'s 4.5, so N2 would have broken that test.

Both are moved to the nearest spots that pass every check (walkable, walkable ground within 1, outside every aggressive camp, at least 3 from every node and from each other, 4.5 or more from every tree):

| Old | New | Nearest woods tree |
|---|---|---|
| (-44, -6) | **(-45, -9)** | 5.1 |
| (-48, -4) | **(-42, -3)** | 5.5 |

Design 7.4 (line 520, "two rocks at (-44, -6) and (-48, -4)") follows. After the move: `ALL CHECKS PASS`.

### 6.2 For later tasks, recorded and not a stop

- **B1 to B3 (fight tests).** Stage 4's model has no boss parameter. A fight test for a new boss needs a parameterised model under `tests/support`, for example a new file that does what `fight.ts` now does. `fight.ts` is the reference, and its Ashmantle rows equal the shipped model's. The plan's "through Stage 4's fight model" should read that way.
- **D4, Z4, U1 (boss rows).** The three boss rows in `content.ts` carry no `openingShiftMs`, no `mark.max` or `mark.secs`, and no phase `shiftMs`, all of which `BossDef` requires. MODEL assumed no opening roar, Ashmantle's marks (max 4, 12 s), and 2000 ms per phase, as the copy did. Under rule 0.3.6 the data tasks need these numbers in the content file or the design (7.7), so the owner or the lead should write them there before D4.
- **C1 and C2 (the Ember Hurler).** `content.ts` has no `ember_hurler` row, so MODEL still prints 6 new monster types and 75 diary tasks; the design says 7 and 76. Its row is in design 7.5, and C1 and C2 take it from there.
- **Save size.** MODEL's new save block at every bound is now 5,005 bytes (it was 4,977), because there is one more stat key (134) with Stage 4's types. Design section 10 says "at most 5 kB more".

### 6.3 MODEL numbers that moved (design tables follow; no bound changed side)

**`results.txt`:**

- **Loops.** "Today" has 18 open loops, not 24, because the old run did not have Stage 3's bar recipes or Stage 4's swordfish drop. "After Stage 6" is still 4.
- **Items.** Equipment totals 212 (the Hazel Staff).
- **Placement.** The tollmaster camp's gap to the nearest camp is 4.1 (was 28.7), now that Stage 4's `thornwatch` counts; it is still at least 0.
- **Dungeon income.** Unchanged: Warren ratio 0.57, Underkiln 0.50.

**`check-results.txt`:** every bound still holds in every column. The largest moves:

| Row | Before | After |
|---|---|---|
| Ashmantle A | 98.9% / 103 s | 99.2% / 104 s |
| Ashmantle R, rebalanced, bronze | 97.5% / 108 s | 98.1% / 110 s |
| Ashmantle R, rebalanced, bolt of the level | 98.5% / 93 s | 97.9% / 96 s |
| Ashmantle M, rebalanced | 99.6% / 93 s | 99.5% / 95 s |
| Ashmantle FR, rebalanced | 0.1% and 0.3% | 0.1% and 0.3% (same) |
| Ashmantle FM, rebalanced | 0.9% | 0.4% |
| Saltfang, "+300 ms" | 81.3% | 82.5% (bound ≥ 65) |
| Kiln Warden, "never moves" | 0.0% | 0.1% (bound ≤ 5) |
| Kiln Warden, ranged 70, bronze | 87.3% | 87.3% (the closest to its bound of 85; unchanged) |

Marrowjaw's rows move by at most 0.2 points. Design 7.7 and 7.12 (the Ashmantle sentence: "97.5% in 108 s with bronze bolts", "99.6% in 93 s") follow.

**Second pass.**

- **Section A** (the band, O-6.6's table) is identical to the committed one. From 20 to 70, ranged runs ×0.98 to ×1.33 and magic ×0.98 to ×1.43; the largest spread is 1.43 at level 28 and the only level above 1.4 is 28. From 71 to 99 the largest spread is 1.19.
- **Section C** (the high trees) is identical.
- **Section B** adds Stage 4's camps, so a new column appears in the same rows.

### 6.4 PACE: the kit-kill table, merged world (Stage 4's camps), beside design 7.13's

Kills from a new game to each complete kit:

| | Iron | Steel | Black | Mithril | Adamant | Rune | Dragon |
|---|---|---|---|---|---|---|---|
| A1 before, design 7.13 | 132 | 354 | 453 | 540 | 824 | 1,558 | 4,606 |
| **A1 before, merged** | 132 | 354 | 448 | 515 | 735 | 1,301 | 3,887 |
| A1 after (gap 10), design 7.13 | 169 | 434 | 637 | 724 | 1,009 | 1,743 | 4,771 |
| **A1 after (gap 10), merged** | 169 | 434 | 637 | 724 | 979 | 1,545 | 4,100 |
| A1 gap 5, merged | 159 | 401 | 548 | 634 | 853 | 1,419 | 3,990 |
| A1 gap 20, merged | 169 | 434 | 704 | 943 | 1,247 | 1,813 | 4,333 |
| A3 before, design 7.13 | 114 | 186 | 378 | 410 | 448 | 1,087 | 4,583 |
| **A3 before, merged** | 114 | 186 | 378 | 410 | 443 | 1,009 | 3,863 |
| A3 after (gap 10), design 7.13 | 126 | 223 | 482 | 611 | 682 | 1,322 | 4,725 |
| **A3 after (gap 10), merged** | 126 | 223 | 482 | 611 | 682 | 1,254 | 4,037 |

**Further kills after the level, A1, iron to rune.** Before: 93, 242, 292, 287, 302, 551. After: 130, 322, 422, 437, 381, 582.

What changed on the merged world: Stage 4's Saltback Stalkers (level 34, 140 to 340 coins) are now the fighter's best target from black onwards. So adamant, rune and dragon come sooner in both columns, and from adamant on the rule moves the pace less (rune +244 kills, dragon +213, against +185 and +165 in the design's table). **Every assertion of `tests/pacing.test.ts` holds in all five blocks** (before, convention, and gaps 10, 5 and 20). The convention block is still identical to "before".

## 7. What the models pass changed that this stage builds on

- **Skinned figures only.**
  - `upgradeMonsterRigWithGltf` (`src/engine/blenderMonsters.ts` 85) takes the node `Monster_<def.body ?? model key>`. It **refuses a node without a skin** (`hasSkin`, warning "is not skinned, refusing to upgrade") and returns false.
  - It strips the `<key>_` bone prefix. If `def.kit` is set, it requires `Kit_<kit>` and **returns false if that node is missing**. Each child of the kit is attached to the bone of the same name (or to the root).
  - Biped figures are animated with the hero's clips (`attachBipedAnimator`, which needs `hero.glb`). Crawlers and dragons use their own clips.
  - The loader URL is `/models/monsters.glb?v=11081170`.
- **The motion table** (`src/data/monsterPoses.ts` 40) has one row for each of the ten model keys:

  | Skeleton | Model keys |
  |---|---|
  | biped | goblin, chicken (code-posed), goblin_archer, dark_wizard, dark_ranger, hill_giant, moss_guardian, lesser_demon |
  | crawler | scorpion |
  | dragon | elvarg_dragon, which Ashmantle uses through `body` |

  Each row names its clips (attack: `Slash`, `Ranged`, `Strike`, `Cast`, `Chop` or `Bite`), an `anticipation`, a `codeAttack` pose and an optional `windup` clip. `tests/monster-motion.test.ts` 60 holds 10 model keys, which holds for Stage 6, since every new row reuses a mesh.
- **Look fields** on `MonsterDef`:
  - `kit` puts `Kit_<name>` rigid pieces on the base's bones, at most 4 rigid meshes (owner, 2026-11-26).
  - `body` names another `Monster_` node on the same skeleton (`tests/monster-models.test.ts` checks that).
  - `tint` and `modelScale` are as in Stage 4. `tint` recolours the `skin`, `scale`, `chitin` and `feather` materials.
- **`public/models/monsters.glb`** (2,248,648 bytes):
  - 11 skinned `Monster_` nodes: chicken, goblin, goblin_archer, scorpion, dark_wizard, dark_ranger, hill_giant, moss_guardian, lesser_demon, elvarg_dragon and ashmantle.
  - Two rigid kits: `Kit_saltback_stalker` (4 children) and `Kit_thornwatch_marksman` (3).
  - Clips in the file: `scorpion_Death`, `scorpion_Idle` and `scorpion_Walk`, plus the dragon's `Strike`, `Bite`, `Death`, `Idle`, `Walk` and `WingBuffet`.
  - `scripts/blender/build_monsters.py` builds only those two kits. `docs/superpowers/baseline/models/final.md` "To Stage 6" lists no unpromoted kit or body.
- **This stage's new monsters and bosses** (plan line 3). **None has a real model or a ready kit.** Each can only be the recolour the design planned, on a skinned, animated base:

| Type | Base model (skeleton) | Has a real model? | Ready kit? | What a model needs (content.ts `modelNeed`) and its budget class (final.md 7) |
|---|---|---|---|---|
| `cinder_adept` | `dark_wizard` (biped, `Cast`) | no | no | a hooded caster with a brazier staff; a kit on the wizard fits the kit route |
| `slag_brute` | `hill_giant` (biped, `Slash`) | no | no | a hunched, plated brute; a kit (plates) or a `body` |
| `marrowjaw` | `hill_giant` (biped) | no | no | camp captain, large class (7,000 triangles, 4 meshes, 110 kB); banner pole and shoulder armour suit a kit |
| `scree_skitter` | `scorpion` (crawler, own clips) | no | no | swarm creature (1,200 triangles, 1 mesh, 21 kB) |
| `saltfang` | `scorpion` (crawler) | no | no | dungeon boss class (14,000 triangles, 4 meshes, 220 kB); a brood mother needs a `body` |
| `ember_hurler` | `lesser_demon` (biped) | no | no | tint `0xb8b2a7`, modelScale 0.85 (design 7.5) |
| `kiln_warden` | `moss_guardian` (biped, `Chop`) | no | no | dungeon boss class; "must not read as the woods creature": a `body` |

Building a kit or a body stays outside this stage (plan line 3). Every row above works with `model`, `tint` and `modelScale` alone, as the design planned.

## Commands run (exit status)

All from the worktree root, behind `flock /tmp/claude-capped.lock scripts/capped.sh`: `npx vitest run` (0), `npx tsc --noEmit` (0), `npm run build` (0), `npx vitest run tests/pacing.test.ts` (0), `npx vitest run tests/economy-invariants.test.ts` (0), `bash docs/superpowers/research/content-model/run.sh` (0, after the content fix in 6.1; 1 before it), `pacing-rerun.sh` (0), `second-pass.sh` (0), `critique-check.sh` (0). No Blender process was run.
