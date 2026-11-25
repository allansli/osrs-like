# Combat with weight: implementation plan

Date: 2026-11-14. Branch: `feat/combat-weight`. Design: `docs/superpowers/specs/2026-11-14-combat-weight-design.md` (called "the design" below; section numbers refer to it). Models: `docs/superpowers/research/combat-model/` (`model.ts`, `fight.ts` with `check.ts`, `boss.ts`, `decisions.ts`, `run.sh` and the three committed outputs). Source line numbers are at commit `54736ba` and are only hints: Stage 2's review fixes and all of Stage 3 land before this plan starts.

The design is a proposal, partly decided. On 2026-11-14 the owner answered CALL-4.6 (what dying costs), CALL-4.4 (the dragon), CALL-4.5 (regeneration) and CALL-4.8 (two new monsters); this plan carries those answers (review log at the end). The rest is still open: nothing in this plan starts before owner step **O-4.1** (section 0.5).

The critique of 2026-11-14 (`docs/superpowers/specs/2026-11-14-combat-weight-critique.md`) was applied to this plan; its changes are in the review log at the end.

---

## 0. Conventions

These repeat the foundation plan's section 0 (`docs/superpowers/plans/2026-11-13-world-foundation-plan.md`), with this stage's values. Where the two differ, this file wins for Stage 4.

### 0.1 Task tags and tiers

- **[AGY]**: specified fully enough to hand to the agy backend through `/agy-implement` (one worktree) or `/agy-parallel` (several clusters). It always runs in three stages: a **haiku** stage runs the `agy -p` command and returns the diff stat, test output and exit status; a **sonnet** stage implements the task only if agy failed or refused, and records that it did; an **opus** stage (a [CLAUDE] verify) checks the diff against the task's allowlist, runs the acceptance check, and looks for weakened or deleted assertions and for edits to [CLAUDE] tests. On an [AGY] task, "Tier" names the tier that does the work if agy fails. The verify is always opus and is part of the task.
- **[CLAUDE]**: tests that define acceptance, work the plan cannot fully specify (tuning data against a test, the boss simulation), and every verification. Tests for an [AGY] task are their own [CLAUDE] task and come first.
- **[OWNER]** and **[HUMAN]**: a decision only the owner can make, or something a person has to see or hear in the running game.
- Agents never merge, tag, push or open pull requests. The main session merges after verification. No commit carries an AI attribution trailer.
- **Tier per kind of work in this plan** (owner's model rule): haiku runs commands and reports; sonnet writes tests from a table in the design and is the fallback implementer; opus writes the tests that define a rule (routes, patterns, phases, the boss simulation, the death loss and its saved flag), tunes data and verifies. No fable stage: nothing here is a contract that later stages build on beyond what the design already fixed.

### 0.2 Commands

Run every command from the worktree root through the repository's wrapper, which starts an allowlisted environment under a 3 GB cap: `scripts/capped.sh <command>`.

| Name | Command | Expected |
|---|---|---|
| SUITE | `scripts/capped.sh npx vitest run` | exit 0; every test passes |
| ONE(file) | `scripts/capped.sh npx vitest run <file>` | as stated in the task |
| TYPES | `scripts/capped.sh npx tsc --noEmit` | exit 0, no output |
| BUILD | `scripts/capped.sh npm run build` | exit 0; the JS chunk size is reported |
| MODEL | `bash docs/superpowers/research/combat-model/run.sh` | prints the tables of `model.ts`, the boss fight of `check.ts` and the death, gate and arena tables of `decisions.ts`; `results.txt`, `check-results.txt` and `decisions-results.txt` are rewritten. It runs with an empty environment: the committed output is the default run. |

**Standard gate (SG)**: SUITE, TYPES and BUILD all pass. Every task ends with SG unless it says otherwise. An OOM kill by the wrapper is a defect to fix. Never raise the cap. One BUILD at a time on the machine; at most 3 or 4 agents at a time.

### 0.3 Rules that apply to every task

1. **Allowlist.** A task touches only the files listed for it. The opus verify rejects a diff with any other file in it.
2. **Find symbols by name.** Line numbers are from `54736ba`.
3. **Existing tests are frozen.** No edit to any file that exists under `tests/` or `src/__tests__/` when R0 runs, except the four replacements declared in design 9.3 (Stage 3's `content-freeze`, `world-data` line 162, `world-budget`'s monster count, `src/__tests__/blender-hero.test.ts`'s species test), all made in M3, once, with the final counts (42 monsters, 13 type keys, 10 model keys), and each named in its commit message. A new test goes in a new file under `tests/`. `src/data/catalog.ts` is in no task's allowlist: the existing dragon's row is not edited by anyone.
4. **Test-first pairs.** A [CLAUDE] test task may leave SUITE red in its new files, and TYPES and BUILD red only for a module, export, field or union member that the paired task adds. The opus verify of the test task lists those errors; any other is a defect. The paired task's accept restores full SG. A branch reaches the main session only when green.
5. **Purity.** No new file under `src/state` or `src/data` imports from `src/engine` or `src/ui`, or mentions `STATE`, `Math.random`, `Date.now`, `performance`, `document` or `window`. Time and randomness are parameters.
6. **Timings are data.** No millisecond, radius, power or amplitude of design 6.2 to 6.5 and 6.7 is written outside `src/data/attacks.ts` and `src/data/feel.ts`. The numbers of design 6.6 (the two cooldowns, the two regeneration rates, the rest timer, the death share, the level floor, the vow's price) are named constants in `src/state/sustain.ts` and nowhere else.
7. **`any` budget** stays as the foundation plan set it: `Object3D.userData`, rig parts bags, GLTF traversal. Each task reports how many it added.
8. **No new runtime dependency. No audio, image or model file.**
9. **Commit messages**: `test(<task>): …`, `feat(<task>): …`, `fix(#14): …` for the audit finding, `data(<task>): …` for tuning. One task, one or more commits; never two tasks in one commit.
10. **No file under `src/` over 1,000 lines** (the existing source-limit test). T4 and B2 state what moves if `monsterAi.ts` passes 600.

### 0.4 Branches, worktrees, clusters

- The **spine** (lanes P, T, B, then W) runs on `feat/combat-weight` itself, one task after another: these tasks edit `src/state/monsterAi.ts`, `src/engine/loop.ts` and `src/engine/actions.ts`.
- **Side clusters** S, F, A and M each run in their own worktree, `../osrs-like-wp/S4-<cluster>`, on a local branch `cw/<cluster>` cut from the spine head after R0 (cluster A after T2, because its plans read `ATTACKS`). They touch only new files and files no spine task before lane W touches (table in 1.1). Cluster M is one task (M2) and is merged into the spine after CP-4, before M1: the new boss's row needs the model key. S, F and A are merged before lane W, in that order. `cw/` branches are never pushed.
- **One declared exception to "side clusters touch no spine file"** (found by the second pass): `src/state/adventure.ts` is edited by S2 (`deathNotice` only) on `cw/S` and by B2 (`isBossLoot`, `registerKill` only) on the spine. The three functions are far apart (lines 230, 285 and about 470 at `54736ba`), so the merge of `cw/S` should apply cleanly; the merge of cluster S is followed by `ONE(tests/sustain.test.ts)`, `ONE(tests/boss-phases.test.ts)` and `ONE(tests/phase4-combat.test.ts)` before W1 starts, and a conflict there is resolved by keeping both sides (sonnet), checked by the W1 verify.
- Workflow scripts live in `docs/superpowers/workflows/` (as Stage 2's do), so a crash loses nothing.

### 0.5 Owner and human steps (where they block)

| Step | What the owner decides or does | Blocks |
|---|---|---|
| O-4.1 | Approve the stage: CALL-4.1 (essence), CALL-4.2 (no new buttons), CALL-4.10 (ordinary monsters hit as hard on average), CALL-4.11 (synthesised sound), CALL-4.12 (deferrals), CALL-4.13 (no new model). | Everything |
| O-4.2 | **CALL-4.6: decided 2026-11-14** (experience loss, with a blessing). Still to decide, **CALL-4.17**: the share (3%), which skills pay (every fighting skill), the vow's price (one coin per point guarded) and cover (one death, whole). | S1, S2, W1 |
| O-4.3 | **CALL-4.4: decided 2026-11-14** (the existing dragon untouched; a separate new boss). **CALL-4.18: decided 2026-11-14** (the owner's "ok" to the recommendation: the fight opens with a 2-second roar, a banner and the line "Its bolts are magic."; the bolt's damage stays; `BOSSES.ashmantle.openingShiftMs` 2000). Still to decide, **CALL-4.14**: whether a run of misses may kill from full health. | M3 (the boss's row), B1 to B4 |
| O-4.4 | **CALL-4.5: decided 2026-11-14** (regeneration always on, faster out of combat). Still to decide, **CALL-4.19**: the two rates (0.25 and 1.0 HP/s) and the 6 s timer. | S1, S2, W1 |
| O-4.5 | **CALL-4.8: decided 2026-11-14**: ship the two monsters. | (nothing left to decide) |
| O-4.6 | **CALL-4.3** (no telegraphs in the start region) and **CALL-4.7** (auto-retaliation). | T2; S1, W1 |
| O-4.7 | **CALL-4.9**: the names, now with the boss, its title and the blessing. [HUMAN] web search for each. (CALL-4.15, renaming the existing dragon, is settled: not renamed.) | The merge |
| O-4.9 | **CALL-4.16**: warnings for trackpad players (leave and test, longer for everyone, or an option). | G-8 |
| CP-4 | [HUMAN] "Do the shapes read?" checkpoint after T5 (design 9.2, first two items). | M1, lane B |
| O-4.8 | Accept Stage 4 (after G-7 and G-8). | The merge |

If the owner takes an alternative on an open call, only the blocked task changes, as that task states. **CALL-4.17:** another share, price or floor changes constants in S2 and the expected values S1 computes from them, nothing else; "only the skill in use" changes `FIGHTING_SKILLS` to a function of the combat style in S2 and two tests in S1; "half the loss" or "several deaths" changes `applyDeathLoss` and the notice text in S2, and "several deaths" makes the saved flag a small whole number, which needs its own reader rule and tests before S2 starts. **CALL-4.18:** another name changes the row in M3 and the name test; a lower bolt changes one number in the boss's row and B3 then fails F, FR or FM by design, so B3's thresholds for those rows are re-stated by the owner, not by the task; a material reward is not planned here: it needs Stage 3's pricing. **CALL-4.19:** other rates change two constants in S2; a faster rate in fights is not planned here: the gate margin of design 6.6 does not allow it without re-tuning Stage 2. Second pass additions: **CALL-4.17 (a)** "scale the share by the rate" multiplies the share by `state.xpMultiplier` in `deathLoss` and `vowPrice` (S2) with two S1 cases; **(b)** "waive a small loss" adds one comparison in `applyDeathLoss` and a fourth notice case (S1, S2). **CALL-4.18** "open with a warning" adds `openingShiftMs` (2,000) to `BossDef` and one shift on the boss's first `aggro` after a reset or respawn (B1 test, B2), and the banner and chat line "Its bolts are magic." in B4; no proof row of B3 moves. **CALL-4.9** renames change data in M3 and B2 and the name test in M1, nothing else.
**CALL-4.14** "cap a single blow" adds one clamp to `rollMonsterAttack` in B2 and a cap test in B1; B3 then re-derives the never-moving rows, which the cap makes winners.

---

## 1. Order and files

### 1.0 Prerequisite

### R0 Premise re-check [CLAUDE]
- **Tier**: opus (judgment: decides whether the plan still fits the code).
- **Depends**: O-4.1; Stage 2 and Stage 3 merged to `main`; `feat/combat-weight` rebased onto `main`.
- **Files**: this plan and the design (edits recorded in the "Review log" section at the end of each); `docs/superpowers/research/combat-model/` (the scripts and their three outputs).
- **Change**: read, by name, and record what was found: `stepMonster`, `onPlayerHit`, `StepWorld`, `MonsterLogic` (`monsterAi.ts`); `findPath`, `findWalkPath`, `nearestOpenCell`, `entityGoal`, `shouldRepath`, `segmentWalkable` and the Stage 2 review additions `entityAim`, `walkSpent`, `stallTime`, `escapeStall` (`pathfind.ts`); Stage 3's `playerAttackProfile`, `playerHitChance`, `monsterHitChance`, `creditGp`, `HP_REGEN_PER_SEC` (and that it lives under `src/state`, in `economy.ts`, as its plan says), `rollDrops` and its `tests/content-freeze.test.ts` and `tests/pacing.test.ts`; `handleInventoryClick`, `togglePrayer`, `setCombatStyle`, `toggleSpecialAttack`; `tone` in `audio.ts`; the four pins of design 9.3 (Stage 3's `content-freeze`; `world-data` line 162 and `world-budget`'s "CAMPS hold 36 monsters" at their merged line numbers; `src/__tests__/blender-hero.test.ts`'s species test) and any new test that counts monsters or iterates `MONSTER_TYPES`; `normalizeQuests`, `defaultQuests` and `QuestFlags`, and Stage 3's two save goldens (`tests/fixtures/s3/default-state.golden.json`, `save-v4-loaded.golden.json`) with its "same keys" assertion, its `no new saved field` test in `tests/starter-quests.test.ts`, and Stage 2's `tests/save-relocation.test.ts` golden and `SAVE_KEYS`; Stage 3's `DECLARED_NEW_ITEMS` pattern in `content-freeze` (design 9.3 item 1 copies it); where `grantXp` lives and how `xpMultiplier` defaults for a new game and for a loaded save (design 6.6, 10x saves); `handlePlayerDeath` and `finishRespawn` (its chat line prints `deathNotice()`); the altar branch in `loop.ts` and the context-menu builder `onGameContextMenu` in `input.ts`; `makeCamp`'s radius and the aggression test in `stepMonster` (design 6.4: the boss's aggression circle is its camp circle); every comparison with the literal `elvarg_dragon` under `src/` (design 6.4 lists seven). Replace the hand-transcribed attack arithmetic in `fight.ts` with Stage 3's functions, run MODEL, and compare with design 6.2, 6.4 and 6.6. Run Stage 3's `tests/pacing.test.ts` twice with local patches that are not committed, and record whether any assertion moves (design 6.10): once with the new boss's row and camp added, once with its model's rest rate set to 1.0 HP/s. Run SG and record test count and JS chunk size as this stage's baseline.
- **Accept**: a written list, one line per symbol: found, moved, or missing. If one is missing, or MODEL's win rates leave the thresholds of B3, or the gate rows of `decisions-results.txt` leave their bounds, the plan is edited before any task starts and the edit is logged. SG passes.
- **Must not change**: anything under `src/` or `tests/`.

### 1.1 Lanes

| Lane | Tasks | Files |
|---|---|---|
| P (routes), spine | P1 to P4 | `src/state/pathfind.ts`, `src/state/collision.ts`, `src/state/monsterAi.ts`, `src/engine/loop.ts` |
| T (telegraphs), spine | T1 to T5 | `src/data/attacks.ts` (new), `src/state/telegraph.ts` (new), `src/data/world.ts`, `src/state/monsterAi.ts`, `src/state/combat.ts`, `src/engine/telegraphs.ts` (new), `src/engine/loop.ts`, `src/engine/actions.ts`, `src/engine/monsterMeshes.ts`, `src/engine/context.ts` |
| M (roster), spine part, after CP-4 | M1, M3 | `tests/new-monsters.test.ts`, `tests/names-combat.test.ts`, `tests/fixtures/existing-dragon.golden.json`, `src/data/world.ts`, `src/data/worldMap.ts`, `src/engine/monsterMeshes.ts`, `src/engine/overlay.ts`, the four declared test replacements |
| B (boss), spine | B1 to B4 | `src/data/attacks.ts`, `src/data/worldMap.ts`, `src/data/world.ts` (the boss's row), `src/state/monsterAi.ts`, `src/state/combat.ts`, `src/state/adventure.ts` (`isBossLoot`, `registerKill`), `src/engine/loop.ts`, `src/engine/actions.ts`, `src/ui/hud.ts`, `src/ui/styles.css`, `index.html` |
| S (sustain, commands), side | S1, S2 | `src/state/sustain.ts` (new), `src/state/commands.ts` (new), `src/state/adventure.ts` (`deathNotice` only), `src/state/quests.ts` and `src/state/types.ts` (`lanternVow` only) |
| F (feel), side | F1, F2 | `src/data/feel.ts` (new), `src/engine/reactions.ts` (new) |
| A (audio), side | A1, A2 | `src/state/soundPlan.ts` (new), `src/engine/audio.ts` |
| M (roster), side part | M2 | `src/engine/blenderMonsters.ts`, `src/engine/spawns.ts` |
| W (wiring), spine, after the S, F and A merges | W1 to W4 | `src/engine/actions.ts`, `loop.ts`, `input.ts`, `context.ts`, `spawns.ts`, `playerMesh.ts`, `monsterMeshes.ts`, `src/ui/playerActions.ts`, `hud.ts`, `styles.css`, `index.html`, `README.md` |

What cannot run in parallel: every spine task with every other spine task. `src/data/world.ts` and `monsterMeshes.ts` are edited by T2/T5 on the spine, so lane M's edits to them (the `model`, `tint` and `modelScale` fields and the three rows) are made in M3, on the spine, after CP-4 and before lane B, because the boss is built from the dragon's mesh. `spawns.ts` belongs to M2 until its merge after CP-4, so the monsters' stable `id` is assigned in W1, not T5. Side clusters never touch a spine file.

Spine order: R0; P1 to P4; T1 to T5; CP-4; merge M2; M1, M3; B1 to B4; merge S, F, A; W1 to W4; G-7.

---

## 2. Lane P: monsters on routes (design 6.1, G4.1)

### P1 Pathfinder budget tests [CLAUDE]
- **Tier**: sonnet (tests from the table in design 6.1).
- **Depends**: R0.
- **Files**: `tests/pathfind-budget.test.ts`, `tests/fixtures/pathfind-golden.json` (both new).
- **Change**: tests against the real grid. First, before P2 exists, generate the golden: the routes today's `findPath` returns for 200 seeded pairs of open cells, written by the test when `UPDATE_GOLDEN=1` is set (the foundation plan's X05 pattern).
  - `a search past maxExpanded returns null` and `without maxExpanded the same search returns a route`.
  - `routes equal the golden on 200 seeded pairs` (waypoint for waypoint, within 1e-9). This passes today and must still pass after P2.
  - `a second search allocates no typed array`: wrap `Float64Array`, `Int32Array` and `Uint8Array` constructors on `globalThis` for the duration of the second call and count constructions of length `size * size`.
  - `openStart returns the point itself when its cell is open and the nearest open cell centre when not` (the rule of `pathStart` in `input.ts`).
  - `segmentWalkable (now exported) is true across open ground and along the bridge deck, false across the castle wall and across the river off the bridge`.
  - `around every camp, a search to each home from 32 points at leash and leash + 11 expands at most 6000 cells`.
- **Accept**: the golden test passes today; the rest is red until P2, only for the missing exports.
- **Must not change**: `src/`; the golden after this task (P2 may not regenerate it).

### P2 Pathfinder: scratch memory, cap, shared start [AGY]
- **Tier**: sonnet.
- **Depends**: P1.
- **Files**: `src/state/pathfind.ts`.
- **Change**: `findPath(grid, from, to, stats?, maxExpanded?)`: when `stats.expanded` would pass `maxExpanded`, return `null`. The four per-call arrays become one scratch set kept in a module-level `Map` keyed by `size`, with a `Uint32Array` generation stamp per cell, so a call resets nothing but a counter. Export `openStart(grid, x, z): [number, number] | null` (the point itself if its cell is open, else `nearestOpenCell`) and export the existing `segmentWalkable` unchanged. No second segment test is written.
- **Accept**: `ONE(tests/pathfind-budget.test.ts)`, `ONE(tests/pathfind.test.ts)` and `ONE(tests/stage2-review-fixes.test.ts)` pass, then SG.
- **Must not change**: the route any existing call returns; `tests/fixtures/pathfind-golden.json`; `findWalkPath`, `entityGoal`, `shouldRepath` and the Stage 2 review helpers.

### P3 Monster route tests [CLAUDE]
- **Tier**: opus. These define the rule that closes the "cannot get home" defect class.
- **Depends**: P2.
- **Files**: `tests/monster-routes.test.ts`, `tests/world-data-combat.test.ts`, `tests/fixtures/monster-steps-golden.json` (all new).
- **Change**: with test-local grids built by `buildWalkGrid(customWalkable)` and with the real grid:
  - `reaches a player behind a wall that a straight walk cannot pass`
  - `walks straight and makes no search when the segment is open` (a counting grid proxy, or `pathBudget.left` unchanged)
  - `asks for a route at most every 0.5 s`
  - `with the frame budget spent it makes no search and still moves`
  - `with pathBudget 1 and three monsters asking every frame, each is served within three frames when the caller rotates the start` (the rotation is the engine's; the test rotates as `updateMonsters` will)
  - `a monster chasing a target that stands still asks for no second route` (`pathGoal` is the target's position at planning)
  - `a monster held on a route corner for STALL_SEC takes an escape cell (escapeStall) and keeps chasing`
  - `a search past the cap leads to return`; `a route longer than 52 leads to return`
  - `return follows the route home over the bridge` (the three_kettle goblin on the east bank, real grid)
  - `from 200 seeded points per camp, return reaches idle at full hitpoints within route time + 3 s`
  - `with the home walled in, the monster is put home when the clock runs out, with reset`
  - `a monster whose cell centre is blocked still gets a route`
  - `without a grid, positions equal the golden step for step over 30 s`: the golden is written by this task, before P4, from today's `stepMonster` (a goblin chase, a leash and return, and a wander, each seeded, with `UPDATE_GOLDEN=1`). It passes today and must still pass after P4, T4 and B2.
  - `with a grid, a wander point on a blocked cell is re-drawn; without a grid, wander draws exactly as today`
  - `world-data-combat`: every member's home cell is open; a route exists to every home from every open cell within leash + 11 of its camp.
- **Accept**: the golden test passes today; the rest is red until P4.
- **Must not change**: `src/`; every existing test; the golden after this task.

### P4 Routes in `stepMonster` [AGY]
- **Tier**: sonnet (the table of design 6.1 is the specification).
- **Depends**: P3.
- **Files**: `src/state/monsterAi.ts`, `src/state/collision.ts`, `src/engine/loop.ts`.
- **Change**: `StepWorld` gains optional `grid` and `pathBudget`. `moveWithCollision` gains an optional fifth parameter, the walk test (default `isWalkable`); no existing call changes. `MonsterLogic` gains `path`, `pathGoalX`, `pathGoalZ`, `repathIn`, `returnLeft` (the golden's comparison reads only the fields that exist today); `createMonsterLogic` sets `repathIn` from the home coordinates (`((|x| * 12.9898 + |z| * 78.233) % 1) * 0.5`). Implement each row of the table in design 6.1 exactly: `pathGoalX/Z` hold the target's position when the route was planned; the open-segment test is `segmentWalkable`; a monster stuck on a route for `STALL_SEC` calls `escapeStall`; `returnLeft` and the wander re-draw exist only with a grid. With a grid, movement steps pass `grid.walkable` to `moveWithCollision`. `updateMonsters` passes `G.walkGrid` and one `{ left: 2 }` object per frame, and starts its loop over `G.monstersList` one place further round each frame (a module counter).
- **Accept**: `ONE(tests/monster-routes.test.ts)`, `ONE(tests/world-data-combat.test.ts)`, and unchanged `monster-ai`, `monster-territory`, `gate-simulation`, `stage2-review-fixes` pass, then SG.
- **Must not change**: T1 to T9 of the foundation design 6.5 (states, distances, speeds, cadence, immunity, heal); the stall test.

---

## 3. Lane T: telegraphed attacks (design 6.2, 6.3, G4.2, G4.3)

### T1 Attack data and shape tests [CLAUDE]
- **Tier**: sonnet (tables and a stated rule).
- **Depends**: P4, O-4.6.
- **Files**: `tests/attack-data.test.ts`, `tests/telegraph.test.ts` (both new).
- **Change**: the G4.2 and G4.3 rows of design 9.1 that concern data and geometry: `inShape` for circle (both anchors), cone, line and ring, at edge, inside, outside and rotated; `shapeOutline` closed and consistent with `inShape` on a 0.25 grid; `escapeDistance` equals the "Escape" column of design 6.3 within 0.05 (a circle around the monster counts its full radius); every row has `windupMs >= minWindupMs(row) + 200`, no wind-up under 1,100 ms, every slot time (`max(slots x cadence, windupMs + 150)`) leaves a recovery of at least 150 ms, and for every boss phase at that phase's cadence (the boss rows arrive in B2; the test iterates whatever `BOSSES` holds); every entry of `PATTERNS` starts with `basic`, and so does every boss's first phase (later phases may open with a heavy, design 6.4); every pattern names existing attacks; chicken, goblin, goblin archer and the existing dragon have no pattern; the conservation rule within 5% over 10,000 simulated seconds for each ordinary pattern (seeded, the loop of `model.ts` section 2).
- **Accept**: red until T2.
- **Must not change**: `src/`.

### T2 Attack tables and shape geometry [AGY]
- **Tier**: sonnet (data transcription and four small functions).
- **Depends**: T1.
- **Files**: `src/data/attacks.ts` (new), `src/state/telegraph.ts` (new), `src/data/world.ts`.
- **Change**: `attacks.ts` exports `CADENCE_SECS = 1.65`, `CAMP_WINDUP_GAP_SECS = 1.65`, `TELEGRAPH_TIME_SCALE = 1`, the types `Shape`, `AttackDef`, the six ordinary rows of `ATTACKS` and `PATTERNS` exactly as in design 6.2 and 6.3 (numbers from the 6.3 table, Rootquake 1,700 ms and Scorch Lane `halfWidth` 1.2; names from 6.9; no `cue` field, it is derived in A2). The existing dragon gets no pattern (design 6.4). `telegraph.ts` exports `inShape(shape, originX, originZ, dirX, dirZ, x, z)`, `escapeDistance(attack)`, `minWindupMs(attack)` (700 + 160 + 90 + distance / 11.5 x 1000) and `shapeOutline(shape, segments)`. `world.ts`: `MonsterDef` gains `pattern?: string`; the type-level override sets it for scorpion, dark wizard, dark ranger, hill giant, moss guardian and lesser demon without editing `catalog.ts`.
- **Accept**: `ONE(tests/attack-data.test.ts)`, `ONE(tests/telegraph.test.ts)`, then SG.
- **Must not change**: any existing monster stat or drop; `catalog.ts`.

### T3 Pattern state-machine tests [CLAUDE]
- **Tier**: opus (defines the wind-up, resolve and cancel rule and guards the gate).
- **Depends**: T2.
- **Files**: `tests/monster-patterns.test.ts` (new).
- **Change**: the G4.2 row of design 9.1 for `monster-patterns`, plus: `every windup is followed by exactly one resolve or cancel`; `the shape does not follow a target that moves`; `the monster does not move during wind-up and recovery`; `two members of one camp sharing a windupGate never wind up at once, the second starts at least CAMP_WINDUP_GAP_SECS after the first resolves, plays basics meanwhile and keeps its heavy for the next free slot`; `each member's first attack is a basic`; `without windupGate members are not gated`; `leash, target beyond 26, target down and target safe in an aggressive camp during a wind-up each emit cancel`; `a faster cadence never shortens a slot below wind-up + 150 ms`; `a target that leaves attack range during a wind-up does not cancel it`; `rollMonsterAttack on an ordinary heavy equals slots x the roll rollMonsterHit makes on the same random draws`; `in the gate simulation's 1000 seeds no sentry emits windup while the runner is alive` (imports nothing from the frozen test; rebuilds the run from `CAMPS`).
- **Accept**: red until T4.
- **Must not change**: `src/`; `tests/gate-simulation.test.ts`.

### T4 Patterns in `stepMonster`; heavy roll [AGY]
- **Tier**: sonnet.
- **Depends**: T3.
- **Files**: `src/state/monsterAi.ts`, `src/state/combat.ts`.
- **Change**: `MonsterLogic` gains `patternIdx` and `windup: { attackId, left, total, ox, oz, dx, dz } | null` and `recoverLeft`. `MonsterEvent` becomes a union: the five existing kinds unchanged, plus `{ kind: 'windup', attackId, ox, oz, dx, dz, ms }`, `{ kind: 'resolve', attackId, hit }`, `{ kind: 'cancel' }`. In `attack`, a type with a pattern consumes pattern entries instead of the plain cooldown, per design 6.2 steps 1 to 4; `patternIdx` is 0 on entering combat from `idle` and on `reset`. `StepWorld` gains optional `windupGate?: Record<string, number>`; a heavy may start only when its camp's entry is 0 or absent, and starting one sets it to `windupMs / 1000 + CAMP_WINDUP_GAP_SECS`; a shut gate turns the slot into a basic `attack` and leaves `patternIdx` on the heavy. Export `tickWindupGates(gates, dt)`. Any exit from `attack` during a wind-up (death, every T5 cause) emits `cancel`. Slot time follows the rule of design 6.2 step 3. A type without a pattern runs today's code path untouched. `combat.ts` gains `rollMonsterAttack(typeKey, attack, state, marks, rand)`: for style `own` it draws exactly as `rollMonsterHit` does (hit roll, then damage roll) and multiplies by `slots`; `marks` is ignored for ordinary monsters. If `monsterAi.ts` passes 600 lines, the pattern step moves to `src/state/monsterPattern.ts` in this task.
- **Accept**: `ONE(tests/monster-patterns.test.ts)` and the unchanged `monster-ai`, `monster-territory`, `monster-hit`, `gate-simulation` pass, then SG.
- **Must not change**: `rollMonsterHit`; the cadence of unpatterned types; lane P's rules.

### T5 Shapes on the ground and wind-up pose [AGY]
- **Tier**: sonnet.
- **Depends**: T4.
- **Files**: `src/engine/telegraphs.ts` (new), `src/engine/loop.ts`, `src/engine/actions.ts`, `src/engine/monsterMeshes.ts`, `src/engine/context.ts`.
- **Change**: `telegraphs.ts`: `showTelegraph(monster, event)` builds an outline as a triangle band about 0.15 wide along `shapeOutline` (not a `LineLoop`: WebGL lines are one pixel) and a fill mesh (the same polygon scaled from the origin by progress), `MeshBasicMaterial` with `fog: false`, `polygonOffset`, no depth write, vertices no farther apart than 1.5 units and lifted to `getTerrainHeight + 0.06`; neither mesh is pushed to `G.worldInteractiveObjects`; `updateTelegraphs(dt)` advances progress by rules time; `clearTelegraph(monster)` disposes through `disposeObject3D`. `MonsterEntity` gains `telegraph`. `updateMonsters` keeps one `windupGate` record for the session, calls `tickWindupGates` once per frame and passes it. While `logic.windup` is set, the monster's mesh turns toward the locked direction instead of the hero. `updateMonsters` maps `windup` to `showTelegraph`, `cancel` to `clearTelegraph`, `resolve` to `clearTelegraph` plus, on a hit, `performMonsterHeavy(monster, attackId)` in `actions.ts`, which calls `rollMonsterAttack` and applies damage as `performMonsterRetaliation` does (splat kind `heavy`). `poseMonsterLimbs` holds a raised pose while `logic.windup` is set, by wind-up progress. A death or `reset` clears the shape.
- **Accept**: SG. `grep -c "logic\.\(x\|z\) *=" src/engine/telegraphs.ts` prints `0`; `grep -c LineLoop src/engine/telegraphs.ts` prints `0`. The opus verify reads that every created mesh has a dispose path.
- **Must not change**: `vfx.ts`; `performMonsterRetaliation`'s behaviour for basic attacks.

### T6 Shapes read on every ground [CLAUDE] (added after CP-4, 2026-11-14)
- **Tier**: sonnet.
- **Depends**: T5; the CP-4 captures in `docs/superpowers/baseline/cw/` (the band is faint on volcanic ground and hidden under tree canopies).
- **Files**: `src/engine/telegraphs.ts`, `tests/telegraph-contrast.test.ts` (new).
- **Change**: in `showTelegraph`, (1) add a dark halo band just outside the coloured band, the same triangle-band construction, 0.12 wide, colour `0x140a08`, opacity 0.75; (2) widen the coloured band from about 0.15 to 0.22; (3) draw the halo and the coloured band with `depthTest: false` and a `renderOrder` above the world so a canopy or a prop never hides the edge; the fill keeps its depth test; (4) dispose the halo with the rest in `clearTelegraph`. No timing, shape, colour of the coloured band or data changes. The test (written first) builds a telegraph for each attack and asserts the group holds a halo mesh and a band mesh, both with `depthTest === false`, the halo drawn before the band, and that `clearTelegraph` disposes every geometry and material it created.
- **Accept**: the new test passes, then SG. The main session re-captures grass, sand and volcanic ground and judges them; the captures replace the CP-4 ones.
- **Must not change**: `src/data/attacks.ts`, `src/state/telegraph.ts`, any timing, any test of T1 to T5.

### CP-4 "Do the shapes read?" [HUMAN]
Design 9.2, the first two items: each shape on four grounds and four tiers, by day and night, and one hill giant fight. Screenshots go in `docs/superpowers/baseline/cw/`. If a shape does not read, the fix is in `telegraphs.ts` (opacity, outline width, height offset) and is one more [AGY] task with the same allowlist. M1 and lane B do not start before this passes.

---

## 4. The roster and the boss (design 6.4, 6.8, G4.4, G4.5, G4.9)

### Before the boss: the three new rows

Cluster M's one task, M2 (section 5), is merged into the spine here, after CP-4.

### M1 Roster, boss-row and name tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: CP-4, O-4.3 (the boss's name); M2 merged.
- **Files**: `tests/new-monsters.test.ts`, `tests/names-combat.test.ts`, `tests/fixtures/existing-dragon.golden.json` (all new).
- **Change**: first, before M3 exists, write the golden with `UPDATE_GOLDEN=1` (the foundation plan's X05 pattern): `MONSTER_TYPES.elvarg_dragon` and the `dragon` camp of `CAMPS`, as JSON. Then the G4.9 row of design 9.1:
  - `the existing dragon's row, drops and camp equal the golden` (name, level 95, 260 hitpoints, max hit 32, attack 88, defence 78, magic, its six drops, one member at (-102, 100), no `pattern`, no `model`, no `tint`). It passes today and must pass after every later task.
  - for `saltback_stalker` and `thornwatch_marksman`: a camp, a pattern, stats between the giant's and the guardian's, the rows of design 6.8.
  - for `ashmantle`: the row of design 6.4 (level 110, 1,400 hitpoints, max hit 72, attack 120, defence 78, magic), `model` `elvarg_dragon`, a `tint`, `modelScale` 1.2, an aggressive camp of one member.
  - `every model names one of the 10 existing monster models`; `none of the three new types drops an item with a slot` (no equipment).
  - The name test reuses the deny-list of `tests/names.test.ts` by importing nothing from it: the list is copied with a comment naming its source, and a third assertion fails if the two lists differ. It covers the three monster names, the attack and phase names that exist by then, and, from the design's table, "Ashbreaker" and "Lantern Vow".
- **Accept**: the golden test passes today; the rest is red until M3. The golden is written after lanes P and T have edited `src/data/world.ts`, so the opus verify also compares it with `MONSTER_TYPES.elvarg_dragon` and the `dragon` camp as they are on `main` at R0 (read in a scratch checkout of `main`): it must hold exactly those. The golden proves data only; the dragon's dragonfire rests on the frozen `monster-hit` test and its respawn, leash and stall on B1.
- **Must not change**: `src/`; `tests/names.test.ts`; the golden after this task.

### M3 The three rows and their camps [CLAUDE]
- **Tier**: opus (places camps against the world-data test; makes the declared test replacements).
- **Depends**: M1.
- **Files**: `src/data/world.ts`, `src/data/worldMap.ts`, `src/engine/monsterMeshes.ts`, `src/engine/overlay.ts`, and the four **declared replacements** of design 9.3, one commit each, each named in its message: Stage 3's `tests/content-freeze.test.ts` (a `DECLARED_NEW_MONSTERS` constant with the three keys, subtracted in the `MONSTER_TYPES` cases as `DECLARED_NEW_ITEMS` is in the `ITEMS` case; `content-ids.golden.json` not regenerated), `tests/world-data.test.ts` (36 to 42), `tests/world-budget.test.ts` (36 to 42), `src/__tests__/blender-hero.test.ts` (iterate the 10 model keys; 13 type keys; every type's model key is one of the 10).
- **Change**: `MonsterDef` gains `model?`, `tint?` and `modelScale?`; `createMonsterMesh` and `poseMonsterLimbs` switch on `def.model ?? typeKey`; `overlay.ts`'s three comparisons with `'elvarg_dragon'` (minimap dot size and colour, label height) read the model key, and the label height is multiplied by `def.modelScale ?? 1`. Add `saltback_stalker` and `thornwatch_marksman` with the rows of design 6.8 (`modelScale` 1.4 and 1.1) and `ashmantle` with the row and the reward table of design 6.4 (`model: 'elvarg_dragon'`, `modelScale` 1.2; no `pattern`: its patterns arrive with `BOSSES` in B2). Add three aggressive camps: the stalkers' (3 members) and the marksmen's (2 members) at coordinates that pass `world-data` and `world-data-combat`, outside every safe zone, off every path, clear of every resource node and of every point-of-interest piece by 2 (Stage 2 review 8), the marksmen outside the `woods` region (Stage 5 plants trees there); and `ashmantle`, one member at (-102, 54), with the ranged aggression radius. Until B2 the boss is an ordinary magic monster with a camp leash; the branch is never merged in that state. Run `tests/pacing.test.ts`; if an assertion fails, stop and report (design 6.10): the owner has decided the two monsters ship, so the fix is a change to their rows agreed with Stage 3, or to the boss's reward table, never dropping a row silently.
- **Accept**: `ONE(tests/new-monsters.test.ts)`, `ONE(tests/names-combat.test.ts)`, `ONE(tests/world-data.test.ts)`, `ONE(tests/world-budget.test.ts)`, `ONE(src/__tests__/blender-hero.test.ts)`, `ONE(tests/textures.test.ts)`, `ONE(tests/pacing.test.ts)`, then SG. The opus verify diffs each replaced test against `main` and accepts only the edits design 9.3 names, and confirms `git diff main -- src/data/catalog.ts` is empty.
- **Must not change**: any existing monster row, drop, camp, bounty band or quest; `catalog.ts`; `tests/fixtures/existing-dragon.golden.json`.

### B1 Boss phase tests [CLAUDE]
- **Tier**: opus.
- **Depends**: M3, O-4.3.
- **Files**: `tests/boss-phases.test.ts` (new).
- **Change**: the G4.4 row of design 9.1, plus: `a boss heavy deals power x 0.75..1.0 when inside and 0 when outside`; `Ember Cone is cut to 25% by a ward, the quest flag or Protect from Magic, through resolveDragonfire`; `Tail Sweep and Slagburst are cut by Protect from Melee and not by Protect from Magic`; `Slag Rain and Ashen Nova are cut by nothing`; `each heavy hit adds a mark up to four and resets one shared 12 s timer; every heavy hit while marks last is raised 25% per mark; all marks go when the timer runs out` (through `addMark`, `tickMarks` and `markMultiplier`, with time as a parameter); `unmarked, no boss heavy deals 60 or more before mitigation`; `a wind-up in progress is cancelled by a phase shift`; `phases II and III start with their first pattern entry, a heavy, one second after the shift`; `no standing distance from 0 to 13.5 is outside both Ashen Nova and Slagburst` (the pair of design 6.4, through `inShape`); `the last phase's threshold is 0 and the boss can die`; `the boss never chases beyond arenaRadius`; `a boss pinned at its arena edge in chase does not stall home`; `while the target is farther than arenaRadius + 6 from home, onPlayerHit returns applied false with reason arena and the boss's hitpoints do not move` (a target at 24 from home with the boss at its edge 12 from home, 12 apart: beyond the boss's reach of 11, inside a ranged hero's 13.5); `a target that alternates 4.9 s at 24 from home and 0.1 s at 17 deals no damage while outside`; `reset and respawn restore phase I, the first pattern entry and full hitpoints`; `the existing dragon has no BOSSES row: it respawns after 7.5 s dead, leashes and stalls as any monster, and rollMonsterHit gives it dragonfire when breathCount is a multiple of 3`; `rollMonsterHit never returns dragonfire for ashmantle, at any breathCount`; `isBossLoot is true for elvarg_dragon and for ashmantle and false for hill_giant`; `registerKill of ashmantle sets quests.title to the row's title and sets no quest flag`.
- **Accept**: red until B2.
- **Must not change**: `src/`.

### B2 Phases, gate, shift, arena, respawn [AGY]
- **Tier**: sonnet.
- **Depends**: B1.
- **Files**: `src/data/attacks.ts`, `src/data/worldMap.ts`, `src/state/monsterAi.ts`, `src/state/combat.ts`, `src/state/adventure.ts` (`isBossLoot` and `registerKill` only).
- **Change**: `attacks.ts` gains the five boss rows (Ember Cone, Tail Sweep, Slag Rain, Ashen Nova, Slagburst, numbers from the design 6.3 table and the 6.4 power table) and `BossDef`, `BOSSES` with one row, `ashmantle`, exactly as design 6.4 (respawn 120, arena 12, title "Ashbreaker", mark step 0.25, max 4, 12 s; the three phases and their patterns; `shiftMs` 2,000; no hitpoints in the row). `CampDef` gains `arenaRadius?`, set to 12 on the `ashmantle` camp. `createMonsterLogic` takes the dead time from `BOSSES` when the type has a row (hitpoints come from `MONSTER_TYPES`, as today). `MonsterLogic` gains `phase` and `shiftLeft`. `onPlayerHit` clamps at the phase threshold and starts the shift; in a shift it returns `applied: false` with `reason: 'shift'`. `stepMonster` emits `{ kind: 'phase', index }`, uses the phase's pattern and `cadenceMult`, and applies the arena rule of 6.4 in place of the camp leash and the stall test for a boss. `reset` and respawn set `phase` 0, `patternIdx` 0 and `shiftLeft` 0. `rollMonsterAttack` handles `power`, the styles `fire`, `melee`, `ranged`, `magic` and `pure`, and `marks`; `combat.ts` also gains the pure mark rule `addMark(marks, boss)`, `tickMarks(marks, dt)` and `markMultiplier(marks, boss)` on a `{ count, left }` value. `MonsterLogic` also gains `outsideFor`, the seconds the target has spent beyond `arenaRadius + 6` (0 while it is inside); `onPlayerHit` on a boss returns `applied: false` with `reason: 'arena'` while `outsideFor > 0` (design 6.4, "No shooting from outside"). `adventure.ts`: `isBossLoot(typeKey)` is true for `elvarg_dragon` as today and for any type with a `BOSSES` row; `registerKill` writes `BOSSES[typeKey].title` to `quests.title` when the row has one. Nothing is keyed on the literal `ashmantle` anywhere in code.
- **Accept**: `ONE(tests/boss-phases.test.ts)`, `ONE(tests/new-monsters.test.ts)` and unchanged `monster-hit`, `monster-territory`, `phase2` pass, then SG.
- **Must not change**: `rollMonsterHit`; `resolveDragonfire`; `catalog.ts`; the existing dragon's row, camp, drops, respawn and quest flag (its golden).

### B3 Arena placement and the boss fight simulation [CLAUDE]
- **Tier**: opus (tunes data against tests and proves G4.5).
- **Depends**: B2.
- **Files**: `tests/support/bossModel.ts`, `tests/boss-fight.test.ts` (both new); `src/data/worldMap.ts` (the `ashmantle` camp only); `src/data/world.ts` (the `ashmantle` row only: hitpoints, max hit, attack, defence); `src/data/attacks.ts` (boss powers, wind-ups, shapes and mark step only, inside the timing rule); `tests/world-data-combat.test.ts` (one added assertion for the arena).
- **Change**: add the arena assertion, the criterion of design 6.4 "Where the arena goes" as `decisions.ts` computes it: the circle of `arenaRadius + 6` clear of every other camp's leash circle (radius + 4, the existing dragon's among them) and of every safe zone; the arena beyond every other camp's attack reach and outside every aggression circle; every arena cell open and inside the world's bound; no path or point-of-interest pad inside `arenaRadius + 6`; no resource node within `arenaRadius + 2`; the ground inside the arena no steeper than 0.8 per unit (`getTerrainHeight`, sampled every 0.5); the home reachable from the pass's west mouth. It must pass at (-102, 54); if Stage 3 or Stage 5 data moved something, move the camp to the nearest spot that passes and log it. Port the positional fight, `docs/superpowers/research/combat-model/fight.ts`, to `bossModel.ts`, calling `rollMonsterAttack`, `inShape`, `regenRate` and Stage 3's attack functions, with the fighters of design 6.4. `boss-fight.test.ts` runs 500 seeds each and asserts: A at least 85%; C at least 65%; B and G at most 5%; F at most 15%; the prepared ranged and magic fighters at least 85%, and at most 5% when they never move; the unprepared level-50 ranged and magic fighters at most 15%. It prints the table. The committed model holds every row with room at 2,000 seeds (design 6.4); the thinnest is the unprepared magic fighter, 9.2% against 15%.
- **Accept**: `ONE(tests/boss-fight.test.ts)`, `ONE(tests/attack-data.test.ts)`, `ONE(tests/world-data.test.ts)`, `ONE(tests/world-data-combat.test.ts)`, `ONE(tests/new-monsters.test.ts)` pass, then SG. If a threshold misses, change the boss's row, powers, shapes or mark step and record the new values in the design's review log; never a threshold, never a fighter.
- **Must not change**: any ordinary monster; the existing dragon; any timing below its minimum.

### B4 Boss in the engine: phase change, bar, marks [AGY]
- **Tier**: sonnet.
- **Depends**: B3.
- **Files**: `src/engine/loop.ts`, `src/engine/actions.ts`, `src/ui/hud.ts`, `src/ui/styles.css`, `index.html`.
- **Change**: `phase` shows the banner (`showBanner` with the boss's name and the phase name, both read from data), one expanding ring from the existing `spawnExpandingRing`, and marks the boss untouchable in the target HUD for `shiftMs`. `applied: false` with reason `shift` prints "untouchable" once and keeps the target; with reason `arena` it prints "out of the arena" once and keeps the target. A boss bar (one block in `index.html`, hidden by default): name, hitpoints, two phase pips at 66% and 33%, the hero's mark count. It shows while a monster with a `BOSSES` row is in combat. The hero's `{ count, left }` mark value is held on `player`; the engine only calls `tickMarks` each frame, `addMark` on a heavy hit and passes the value to `rollMonsterAttack`, and clears it on death. No mark arithmetic is written in the engine. `performMonsterRetaliation` is not changed for the boss: `rollMonsterHit` breathes dragonfire only for the existing dragon's key, so the boss's basics need no rule, and the two chat lines that name the existing dragon stay as they are, because only it reaches them.
- **Accept**: SG. `ONE(tests/globals.test.ts)` passes (no new inline handler). `ONE(tests/monster-hit.test.ts)` passes unchanged. `grep -c ashmantle src/engine/*.ts src/ui/*.ts` prints `0` for every file (the boss is data).
- **Must not change**: the minimap, the tab bar, any existing HUD element's id; `rollMonsterHit`; `performMonsterRetaliation`'s behaviour for any existing monster.

---

## 5. Side clusters (parallel worktrees, cut after R0)

### Cluster S: sustain and commands (design 6.6, section 7)

### S1 Sustain and command tests [CLAUDE]
- **Tier**: opus (these tests define what a death takes and how a new saved value is read; the rest of the file is from tables).
- **Depends**: R0, O-4.2, O-4.4, O-4.6.
- **Files**: `tests/sustain.test.ts`, `tests/commands.test.ts` (both new).
- **Change**: the G4.8 and G4.10 rows of design 9.1, every clause. In full for the three new rules:
  - **Regeneration.** `regenRate(0)` and `regenRate(5.99)` equal Stage 3's `HP_REGEN_PER_SEC` (0.25); `regenRate(6)` and beyond equal `HP_REGEN_RESTING_PER_SEC` (1.0); it is never 0. The gate crossing rebuilt from `CAMPS` and `stepMonster` (importing nothing from the frozen test, but with its generator, its seeds and its runner), with hitpoints regenerating at `regenRate(sinceCombat)` where `sinceCombat` is reset by every `attack` event: every seed gives the same outcome as a run at a constant `HP_REGEN_PER_SEC`; a fresh runner survives fewer than 5% of seeds 1 to 1,000 on each of the three lines (measured 4.5%, 4.4%, 4.4%) and fewer than 5% of seeds 1 to 10,000 pooled over the three lines (measured 3.66%; the worst block of 1,000 is 4.8%, so no per-block bound is asserted); the runner with 40 hitpoints and Protect from Melee survives all; no gap between two blows in any crossing reaches `COMBAT_REST_SECS` (measured at most 0.97 s). The 30,000 pooled crossings took about 2.5 s in a plain node script; the test sets an explicit timeout of 30 s.
  - **Death.** `deathLoss` is all zeros at combat level 14 and not at 15. For each fighting skill, each level 1 to 98 and experience at 0%, 1%, 50% and 100% of the level, and at 1% plus 0.5 (a fractional save value): the loss is a finite whole number, at least 0, at most the experience inside the level, at most `floor(DEATH_XP_SHARE x span)`, and `getLevelForXp(xp - loss)` equals the level. A skill at 99, at its floor and at 5,000,000 past it, loses 0 and adds 0 to `vowPrice`. `applyDeathLoss` changes no skill outside `FIGHTING_SKILLS`, no item, no `gp`, no `maxHp`; with a vow it changes no experience, clears the vow and returns `vow`; with nothing to lose it returns `none` and keeps the vow; without a vow it returns `lost` with amounts that equal the change in each skill.
  - **Vow.** `vowPrice` equals the summed `floor(share x span)` over the six skills that are below 99, and 250 when that is less. `buyVow` refuses below combat 15, when a vow is held and when `gp` is below the price, and then changes nothing; when it accepts, `gp` falls by exactly the price and the vow is held.
  - **Save.** The seven cases of design 6.6, "One new saved value", through `writeSave` and `readSave`.
  - **Notice.** `deathNotice()` and `deathNotice({ kind: 'none' })` deep-equal today's notice; the `vow` text says no experience was lost and the vow is spent; the `lost` text contains the exact total and "no level was lost"; all three match `/Lumbridge/` and contain "You keep your gear and coins".
  - `shouldRetaliate` is false whenever `windupLive` is true. `applyCommand` refuses a meal inside the food cooldown without consuming it, and refuses a prayer below its level or with no points, with today's messages.
- **Accept**: red until S2, only for the missing module, exports and field.
- **Must not change**: `src/`; `tests/phase4-combat.test.ts`; `tests/gate-simulation.test.ts`; Stage 3's goldens.

### S2 `sustain.ts`, `commands.ts` and the vow's flag [AGY]
- **Tier**: sonnet.
- **Depends**: S1.
- **Files**: `src/state/sustain.ts`, `src/state/commands.ts` (both new); `src/state/adventure.ts` (`deathNotice` only); `src/state/quests.ts` and `src/state/types.ts` (`lanternVow` only).
- **Change**: `sustain.ts`: the constants `FOOD_CD_SECS = 1.8`, `POTION_CD_SECS = 1.8`, `COMBAT_REST_SECS = 6`, `HP_REGEN_RESTING_PER_SEC = 1.0`, `DEATH_XP_SHARE = 0.03`, `DEATH_MIN_COMBAT = 15`, `VOW_COINS_PER_XP = 1`, `VOW_MIN_PRICE = 250`, `FIGHTING_SKILLS` (attack, strength, defence, hitpoints, ranged, magic); `canEat(clock, now)`, `eat(state, slot, clock, now)` and `drink(...)` (today's effects of `handleInventoryClick`, returning what was restored; the clock is a small object the caller owns); `regenRate(sinceCombatSecs)`, which returns Stage 3's `HP_REGEN_PER_SEC` below `COMBAT_REST_SECS` and the resting rate from it on (Stage 3's constant is imported from its `src/state/economy.ts`, not edited; if R0 finds it elsewhere, in the engine, this task stops, because `src/state` may not import the engine); `deathLoss(state)`, `applyDeathLoss(state)`, `vowPrice(state)` and `buyVow(state)` exactly as design 6.6 states them (both terms of the loss floored; a skill at 99 loses nothing and is not priced; `applyDeathLoss` asserts that no level changed and deletes `quests.lanternVow` when it spends the vow; `buyVow` pays through `creditGp`); `shouldRetaliate({ hasTarget, walking, keyHeld, downed, windupLive })`. `types.ts`: `QuestFlags` gains `lanternVow?: true`. `quests.ts`: `normalizeQuests` gains the one line `if (data.lanternVow === true) quests.lanternVow = true;`, outside the boolean `flags` list; `defaultQuests` is not edited. `adventure.ts`: `deathNotice(outcome?)` with the three bodies of design 6.6. `commands.ts`: the `PlayerCommand` union of design section 7 and the pure `applyCommand(state, cmd, clocks, now)` for `eat`, `drink`, `prayer`, `style` and `special`, returning `{ ok, reason, restored? }`: eat and drink through `sustain.ts`, style through `canUseStyle`, prayer with the level and points checks and messages that `togglePrayer` has inline today (moved, not copied: W1 makes `togglePrayer` call it), special with `toggleSpecialAttack`'s energy check. `move` and `attack` are not applied here; taking a vow is not a combat command and goes through `buyVow` directly.
- **Accept**: both tests pass, then SG. Stage 3's save goldens and `tests/phase1.test.ts` pass unedited. `grep -c lanternVow src/state/save.ts src/state/gameState.ts` prints `0` for both.
- **Must not change**: `applyRespawn`; `serializeState`; `defaultQuests`; `createDefaultState`; the title of `deathNotice` and its body when nothing was lost.

### Cluster F: feel (design 6.5)

### F1 Feel data tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: R0.
- **Files**: `tests/feel-data.test.ts` (new).
- **Change**: the G4.6 and G4.12 rows of design 9.1: caps (flash spacing at least 350 ms), the spin offset at three step sizes, every tier row present, telegraph outline and fill on in all four tiers.
- **Accept**: red until F2.
- **Must not change**: `src/`; every existing test.

### F2 `feel.ts` and `reactions.ts` [AGY]
- **Tier**: sonnet.
- **Depends**: F1.
- **Files**: `src/data/feel.ts`, `src/engine/reactions.ts` (both new).
- **Change**: `feel.ts`: the numbers of the design 6.5 table, the tier table of section 10 keyed by the four tier ids, and the pure curves `spinOffset(spinAnim)`, `springOffset(t, amplitude, ms)`, `flashAmount(t)`. `reactions.ts`: `hitStop(entity, ms)`, `flash(entity)`, `flinchHero(dirX, dirZ)`, `knockBack(entity, dirX, dirZ, amount)`, `cameraKick(dirX, dirZ, amount)`, `setLowHealth(on)`, `updateReactions(dt)`, each reading `feel.ts` and `prefers-reduced-motion`. Offsets are applied to meshes only. Nothing is called from the loop yet (W2 wires it).
- **Accept**: `ONE(tests/feel-data.test.ts)`, `ONE(tests/architecture.test.ts)`, then SG.
- **Must not change**: any existing file.

### Cluster A: audio (design 6.7)

### A1 Sound plan tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: R0, T2 merged to the spine (the plans read `ATTACKS`); until then the cluster waits.
- **Files**: `tests/sound-plan.test.ts` (new).
- **Change**: the G4.7 row of design 9.1.
- **Accept**: red until A2.
- **Must not change**: `src/`; every existing test.

### A2 `soundPlan.ts` and the audio engine [AGY]
- **Tier**: sonnet.
- **Depends**: A1.
- **Files**: `src/state/soundPlan.ts` (new), `src/engine/audio.ts`.
- **Change**: `soundPlan.ts`: the `Voice` type, `cueFor(attack, monsterStyle)` (fire for style `fire`; the attack's own style when it is melee, ranged or magic; otherwise the monster's style; melee low, ranged mid, magic high) and one plan function per cue of the design 6.7 table (`windupPlan(attack, cue)`, which ends at `windupMs` and holds no impact voice; `resolvePlan(cue)`, the impact; `impactPlan(ratio)`, `heavyTakenPlan()`, `dodgedPlan()`, `phasePlan()`, `bossDownPlan()`, `heartbeatPlan()`, `foodReadyPlan()`). `audio.ts`: `tone` and a new `noise` take a start offset on `ctx.currentTime`; one master gain and `DynamicsCompressor`; a count of live voices capped at 12 (16 for wind-up and impact cues); `SFX.play(plan)`; `setMuted(muted)` ramps the master gain to 0 or back within 20 ms; the existing `SFX` methods keep their names and sounds, re-expressed as plans (no `setTimeout`); `armAudioOnGesture()` exported for W3: it **creates** the context inside the first pointer, key or touch event and stays armed while the context is not `running`; no other code path creates it; cues are dropped while it is not running; the empty `catch` becomes a one-time `console.warn` and sound off.
- **Accept**: `ONE(tests/sound-plan.test.ts)`, then SG. `grep -c setTimeout src/engine/audio.ts` prints `0`; `grep -c audioEnabled src/engine/audio.ts` prints `1`.
- **Must not change**: the `SoundEffects` method names existing callers use (Stage 3's two tones included).

### Cluster M: new monsters (design 6.8)

M1 and M3 run on the spine and are in section 4.

### M2 Model key and tint in the loader [AGY]
- **Tier**: sonnet.
- **Depends**: R0. Behaviour-preserving; the frozen `src/__tests__/blender-hero.test.ts` and `textures.test.ts` are its guard, and its new tests (M1) come with the three rows in M3. It is merged into the spine after CP-4.
- **Files**: `src/engine/blenderMonsters.ts`, `src/engine/spawns.ts`.
- **Change**: (No `roster.ts`: the slot table stays in the design and the README, design 6.8.) `MonsterEntityLike` gains an **optional** `modelKey` (default `typeKey`, because the frozen test builds the object without it), and reads optional `def.tint` and `def.modelScale`; `upgradeMonsterRigWithGltf` looks up `Monster_${modelKey}`, finds the pivots by `modelKey` (`findPivot` takes the type key today), chooses the albedo by `modelKey`, and multiplies `tint` into each non-emissive material colour. `spawnMonster` sets `modelKey = def.model ?? typeKey` and, after `createMonsterMesh`, multiplies `rig.group.scale` by `def.modelScale ?? 1` (the hitbox is a child of the group; the GLB upgrade keeps the group's scale).
- **Accept**: SG. Every existing monster renders from the same node as before (the opus verify reads the lookup), the existing dragon included: no tint and scale 1 leave its materials untouched.
- **Must not change**: materials of existing monsters.

---

## 6. Lane W: wiring (spine, after merging S, F, A in that order)

### W1 Commands, sustain, regeneration, death, the vow, retaliation [AGY]
- **Tier**: sonnet.
- **Depends**: B4; S2, F2, A2 merged.
- **Files**: `src/engine/actions.ts`, `src/engine/loop.ts`, `src/engine/input.ts`, `src/engine/context.ts`, `src/engine/spawns.ts`, `src/ui/playerActions.ts`, `src/ui/hud.ts`, `src/ui/styles.css`, `index.html`.
- **Change**: `spawnMonster` gives each monster a stable `id`. `dispatchCommand(cmd)` in `actions.ts` applies the five state commands through `applyCommand` and the two others (`move`, `attack`) itself; `handleWorldClick`, the context menu's attack and walk entries, `handleInventoryClick` (food and potion branches only), `togglePrayer`, `setCombatStyle` and `toggleSpecialAttack` call it. Eating sets `player.actionCooldown` to at least one tick. Backpack food and potion slots show a cooldown overlay (a CSS class and a custom property).
  **Regeneration:** `player.sinceCombat` (seconds, starts above `COMBAT_REST_SECS`, not saved) grows each frame and is set to 0 by every event of design 6.6: the hero's attack leaving its hand (hit or miss), a monster's `attack` event on the hero (hit, miss or absorbed), a `resolve` on the hero (hit or dodged), and each frame while any monster targeting the hero has `logic.windup` set. `updateVitalsAndRegen` adds `regenRate(player.sinceCombat) x dt`; the literal 0.25 in `loop.ts` goes.
  **Death:** `handlePlayerDeath` calls `applyDeathLoss(STATE)` once, keeps the outcome on `player` until the respawn and passes it to `deathNotice`; the overlay shows that title and body (the title and "Lumbridge" stay); on `lost` the skills panel refreshes. `finishRespawn`'s chat line uses the same stored outcome, not `deathNotice()` with no argument, then clears it.
  **The vow:** `onGameContextMenu`, on an interactive object whose action is `altar`, adds a second entry "Take the Lantern Vow (N coins)" when `buyVow` could succeed now. It walks there exactly as the "Use" entry does and sets `player.targetEntity` with an extra `intent: 'vow'`; the arrival branch in `loop.ts` for `altar` calls `buyVow` (price recomputed on arrival) instead of praying when the intent is `vow`, and prints its result. Nothing buys a vow from a distance; the existing left-click prayer is unchanged and, for a hero of combat 15 or more with no vow, adds one chat line with the price. A lantern mark (one element in `index.html`, hidden by default) beside the hitpoint bar shows while `STATE.quests.lanternVow` is set, with a tooltip.
  **Retaliation:** on a monster `attack` or heavy that lands, `shouldRetaliate` may set the target; `windupLive` is true while any monster targeting the hero has `logic.windup` set. In `handleWorldClick`, a click on the monster the hero already targets, while the hero is within its stop distance, is handled as a ground click at the ray's terrain hit (design 6.4, "Running in with one click").
- **Accept**: `ONE(tests/phase4-combat.test.ts)` unchanged, `ONE(tests/sustain.test.ts)`, `ONE(tests/globals.test.ts)`, then SG. Text scans in the opus verify: no write of `STATE.hp` from an item outside `sustain.ts`; no write of a skill's `xp` that lowers it outside `sustain.ts`; the regeneration line in `loop.ts` holds no numeric literal; the altar's left-click branch still restores hitpoints and prayer for nothing; `buyVow` is called only from the altar's arrival branch; `deathNotice()` with no argument is no longer called from `finishRespawn`.
- **Must not change**: shops, bank, forge, bones, logs; `applyRespawn`; the altar's free heal.

### W2 Hit reactions and the spin fix [AGY] (**audit finding 14**)
- **Tier**: sonnet.
- **Depends**: W1.
- **Files**: `src/engine/actions.ts`, `src/engine/loop.ts`, `src/engine/playerMesh.ts`, `src/engine/monsterMeshes.ts`, `src/engine/spawns.ts`, `src/engine/context.ts`, `index.html`, `src/ui/styles.css`.
- **Change**: call `reactions.ts` from the damage points: hero hits (hit stop, flash, knock-back by the design 6.5 table, camera kick replacing the inline `camState.shake` write), heavy hits taken (flinch, knock-back, kick, splat `heavy`), mitigated hits (splat `blocked`), kills. `updateReactions` runs in the loop after `updateMonsters`. Monster materials are collected at spawn for the flash. `player.baseYaw` holds the facing; `updatePlayerMotion` lerps `baseYaw` and sets `rotation.y = baseYaw + spinOffset(player.spinAnim)`; the accumulating line in `updatePlayerAnimation` is deleted. The low-health vignette element and its class. Commit the spin change alone as `fix(#14): the special-attack spin is a function of its timer`.
- **Accept**: `ONE(tests/feel-data.test.ts)`, then SG. `grep -c "rotation.y +=" src/engine/loop.ts` prints `0`.
- **Must not change**: `flinch` timing for monsters; the hero's movement.

### W3 Sound cues wired [AGY]
- **Tier**: sonnet.
- **Depends**: W2.
- **Files**: `src/engine/actions.ts`, `src/engine/loop.ts`, `src/engine/input.ts`.
- **Change**: `windup` plays `windupPlan(attack, cueFor(attack, def.style))`; `resolve` plays `resolvePlan` with the heavy-taken or dodged plan, in the frame the impact is drawn; hero hits play `impactPlan(dmg / maxHit)`; `phase` and the boss's death play theirs; the loop starts and stops the heartbeat by hitpoints, mute, the death state and `document.hidden`, one beat scheduled at a time; the food-ready blip; the loop calls `SFX.setMuted(!STATE.audioEnabled)` when the setting changes. `setupInputHandlers` calls `armAudioOnGesture()`.
- **Accept**: SG.
- **Must not change**: which existing action plays which existing sound.



### W4 README [CLAUDE]
- **Tier**: sonnet (doc sync to code).
- **Depends**: W3.
- **Files**: `README.md`.
- **Change**: the combat section (telegraphs; the new boss and its three phases; the existing dragon, unchanged; food cooldown; regeneration in and out of combat; what a death costs and the Lantern Vow), the monster table (three new rows; the existing dragon's row is not edited) and the prepared monster slots of design 6.8 as a short table.
- **Accept**: SG.
- **Must not change**: anything but `README.md`; the credits and licence sections.

---

## 7. Gate

### G-7 Stage 4 verification [CLAUDE]
- **Tier**: opus.
- **Depends**: W4.
- **Files**: none (read-only; a written report).
- **Check**:
  1. SUITE passes. `git diff main -- tests src/__tests__` shows new files only, plus at most the four declared replacements of design 9.3, each limited to the lines 9.3 names. No `.skip`, `.todo` or `.only`.
  2. TYPES clean. BUILD: JS chunk at most 30 kB over the R0 baseline.
  3. `npm audit --audit-level=high` exits 0; `git diff main -- package.json` shows no change.
  4. `git diff main --stat -- public CREDITS.md` is empty (no asset, no credit change).
  5. Every goal G4.1 to G4.12 maps to a passing test (table in section 8).
  6. Rule 0.3.5 and 0.3.6 by text scan: no forbidden word in new `src/state` and `src/data` files; no timing literal of design 6.2 to 6.7 outside the two data files.
  7. `gate-simulation`, `monster-ai`, `monster-territory`, `monster-hit`, `phase2`, `phase4-combat`, `stage2-review-fixes`, Stage 3's `pacing` and Stage 3's two save goldens pass with no edit. `git diff main -- src/data/catalog.ts src/state/save.ts` is empty, and the existing dragon's golden (M1) passes: the owner's decision that it stays as it is.
  8. MODEL run against the final tables (`boss.ts` brought in line with `attacks.ts` and the boss's row first); its numbers replace `results.txt`, `check-results.txt` and `decisions-results.txt` and the design's tables if they moved.
  9. Finding 14 is closed by W2. Every row of design section 11 is done or carries its written deferral.
- **Accept**: a written pass.
- **Must not change**: anything except `docs/superpowers/research/combat-model/` (`boss.ts` and the three outputs) and, if numbers moved, the design's tables with a review-log line; the task is otherwise read-only.

### G-8 Stage 4 human checks [HUMAN]
Everything in design 9.2, each recorded with a screenshot or a sentence in `docs/superpowers/baseline/cw/`: the shapes on four grounds and four tiers; the hill giant fight; the boss as fighter A, with a crossbow, with magic, and as fighter F; the existing dragon, unchanged; dying below combat 15, without a vow and with one, and a vow surviving a reload; regeneration starting 6 s after the last blow and not while being missed; sound by ear at full and throttled frame rate, on two browsers, muted, and on a fresh load; control during reactions; reduced motion; routes around the ridge, the castle and over the bridge; perf HUD at the pass and in phase II; the 6x CPU throttle; clicks under pressure with a mouse **and a trackpad** (design 9.2; the trackpad result answers CALL-4.16). Then the Stage 1 leak check again: `renderer.info.memory.geometries` returns to its first value after 30 telegraphed attacks and one boss fight.

### O-4.7 Name search [HUMAN]
For each name in design 6.9, a person runs a web search and records "not a known name in a published game", or a replacement (which then goes through `names-combat`).

### O-4.8 Accept Stage 4 [OWNER]
After G-7, G-8 and O-4.7. The main session opens the pull request and merges after CI is green.

---

## 8. Coverage

### 8.1 Goals to proofs

| Goal | Tasks | Proof |
|---|---|---|
| G4.1 routes | P1 to P4 | `pathfind-budget`, `monster-routes`, `world-data-combat`; G-8 routes |
| G4.2 telegraphs | T1 to T5 | `telegraph`, `monster-patterns`; CP-4 |
| G4.3 reaction window | T1, T2 | `attack-data`; G-8 throttle |
| G4.4 phases; the existing dragon unchanged | M1, B1, B2, B4 | `boss-phases`, the dragon's golden in `new-monsters`, unchanged `monster-hit`; G-8 boss and dragon |
| G4.5 winnable and losable | B3 | `boss-fight`, unchanged `gate-simulation` |
| G4.6 hit weight | F1, F2, W2 | `feel-data`; G-8 control and reduced motion |
| G4.7 sound | A1, A2, W3 | `sound-plan`; G-8 sound |
| G4.8 sustain: food, regeneration, death, the vow | S1, S2, W1 | `sustain`, unchanged `phase4-combat` and `gate-simulation`, Stage 3's save goldens; G-8 dying and regeneration |
| G4.9 roster | M2, M1, M3, B3 | `new-monsters`, `names-combat`, `world-data-combat` (arena), the four declared replacements; O-4.7 |
| G4.10 pure, tables, commands | S1, S2, W1; rule 0.3.5 | `commands`, `architecture`, G-7 item 6 |
| G4.11 owed items | all | G-7 item 9 |
| G4.12 budget and tiers | P1, F1 | `pathfind-budget`, `feel-data`; G-7 item 2; G-8 perf |

### 8.2 Owed items to tasks

| Item (design section 11) | Task |
|---|---|
| Monster chase and return on the grid; the monster that cannot get home | P3, P4 |
| Food's job; regeneration | S2, W1 |
| The altar | none: kept, design 6.6 |
| The cost of dying; the recurring gold sink | O-4.2, S2, W1 |
| The dragon's 8.35 s return | none: declined by the owner's decision on the dragon, design section 11 |
| Audit finding 14 | W2 |
| Auto-retaliation | S2, W1 |
| Safespotting within a leash cycle | none: accepted, design section 11 |
| Ranged and magic ladders | none: deferred to Stage 6 |
| Roster gap | M2, M1, M3 |

### 8.3 Files this plan shares with Stage 3 and Stage 5

| File | Stage 3 | Stage 5 | Stage 4 task |
|---|---|---|---|
| `src/engine/actions.ts` | yes | | T5, B4, W1, W2, W3 |
| `src/engine/loop.ts` | yes | yes (render part) | P4, T5, B4, W1, W2, W3 |
| `src/state/monsterAi.ts` | yes (exports three constants) | reads only | P4, T4, B2 |
| `src/state/combat.ts` | yes | | T4, B2 |
| `src/state/quests.ts`, `src/state/types.ts` | yes (starter quest ids) | | S2 (`lanternVow` only) |
| `src/engine/overlay.ts` | | yes | M3 (model key for the dragon-sized dot and label) |
| `src/engine/audio.ts` | yes (two tones) | | A2 |
| `src/engine/spawns.ts` | yes | yes | M2, W1, W2 |
| `src/data/world.ts` | yes | | T2, M3, B3 |
| `src/ui/playerActions.ts` | yes | yes (`openModal`) | W1 |
| `index.html` | yes | yes | B4, W1, W2 |
| `README.md` | yes | | W4 |
| `src/ui/hud.ts`, `src/ui/styles.css` | | yes | B4, W1, W2 |
| `src/engine/monsterMeshes.ts`, `blenderMonsters.ts`, `playerMesh.ts`, `context.ts`, `input.ts` | | yes (materials, context fields) | T5, M2, M3, W1, W2 |
| `src/state/pathfind.ts` | | reads only (its 6.11 says it does not touch it) | P2 |
| `src/state/collision.ts` | | yes (trunk cells in `isWalkable`) | P4 (optional walk test only) |
| `src/state/adventure.ts` | yes (quests, bounties, `creditGp`) | | S2 (`deathNotice` only), B2 (`isBossLoot`, `registerKill`) |
| `src/data/worldMap.ts` | | yes (woods trees table) | M3, B2, B3. The three new camps stay outside the `woods` region, so Stage 5's clearings are unchanged; the boss's arena is in the volcanic corner; Stage 5's R0 still re-reads `CAMPS`. |
| `src/engine/vfx.ts` | | yes (shape swap table) | not touched: new effects are in `telegraphs.ts` and `reactions.ts` |
| Stage 3's `tests/content-freeze.test.ts` | owns it | | M3, declared replacement 1 |
| Stage 3's save goldens (`tests/fixtures/s3/`) | owns them | | none: they must pass unedited (design 6.6) |

Stage 3 lands first, so its side of every shared file is already there when R0 runs. Stage 5 lands after; its task R0 re-reads these files.

---

## Review log

- 2026-11-14, critique (`docs/superpowers/specs/2026-11-14-combat-weight-critique.md`), applied with the design's changes in one commit. Rule 0.3.3 and G-7 now name four declared replacements, all in M3 (the first draft missed `world-budget` and `src/__tests__/blender-hero.test.ts`, and made `world-data` an "if"). P: `segmentWalkable` exported instead of a new `gridSegmentOpen`; `openStart` keeps an open point; `collision.ts` added for the walk test; rotation, route goal, `escapeStall` and grid-only rules specified and tested. T: camp wind-up gate in place of the start-index stagger; cancel on every T5 cause; band outline, no fog, not clickable; mesh faces the locked direction; Rootquake 1,700 ms and Scorch Lane 2.4 wide; no `cue` field. The stable `id` moved from T5 to W1 (`spawns.ts` belongs to M2 until the merge). B: no hitpoints or prayer hint in `BossDef`; boss basics with `breathCount` 1; reset restores phase I; no stall for a boss; lair placed against leash circles; B3 ports the positional check and adds ranged and magic fighters. S: `deathNotice(paid)` (adventure.ts added); `applyCommand` pure for five commands instead of `validateCommand`; retaliation guard. A: impact on the resolve event; mute ramp; context created on a gesture. M: no `roster.ts`; optional `modelKey`; pivots by model key; Thornwatch Marksman; camps outside the woods and clear of POI pieces. W1: run-in click rule. G-8: trackpad. New owner steps for CALL-4.14 to CALL-4.16.
- 2026-11-14, owner decisions (CALL-4.6, 4.4, 4.5, 4.8), applied with the design's changes in one commit. 0.5: the four answered steps are marked decided, with what is still open under each (CALL-4.17, 4.18, 4.19); the alternatives paragraph rewritten for them; CALL-4.15 closed. Order: cluster M (M2) merges after CP-4, and M1 and M3 moved from lane W to the spine before lane B, because the boss is built from the dragon's mesh; the four declared replacements are still made once, in M3, now with 42 monsters, 13 type keys and 10 model keys. M1 gains a golden of the existing dragon's row, drops and camp; M3 gains the boss's row, its camp at (-102, 54) and `overlay.ts`; a pacing failure there stops and reports, since the two monsters are decided. B: the boss is the new type `ashmantle`, not the dragon; no world override of the dragon's hitpoints and no `breathCount` rule in the engine; five boss attacks with the re-tuned shapes; phases II and III open with a heavy (T1's "starts with basic" now covers `PATTERNS` and first phases only); `isBossLoot` and the title through `BOSSES`; B3 checks the arena by the extended criterion (the dragon's camp as a neighbour, node clearance, ground slope) and asserts unprepared ranged and magic rows too. S: `deathCost` and the fee are gone; S1 and S2 specify the two regeneration rates, the death loss, the vow and its optional saved flag (`quests.ts`, `types.ts` join the cluster; `save.ts` is not edited); the gate is re-run with regeneration in S1. W1: the combat timer, the death outcome, the altar's menu entry and the lantern mark. G-7 checks that `catalog.ts`, `save.ts` and the dragon's golden did not move. MODEL now runs three scripts.
- 2026-11-14, second-pass check (critique file, "Second pass"). 0.4: the `adventure.ts` overlap of S2 and B2 declared, with the tests run after the S merge. R0: also reads Stage 3's `no new saved field` test, Stage 2's `save-relocation` golden, the `DECLARED_NEW_ITEMS` pattern, `xpMultiplier` defaults, `finishRespawn`, `onGameContextMenu`, `makeCamp`'s radius. M1: the dragon's golden checked against `main`. M3: the `content-freeze` edit is a `DECLARED_NEW_MONSTERS` constant. B1, B2, B4: no damage to the boss while the target is beyond `arenaRadius + 6` (reason `arena`). S1, S2: a skill at 99 loses nothing; floored loss on fractional experience; gate asserted seed for seed against constant 0.25 HP/s and pooled over 10,000 seeds. W1: the stored death outcome reaches `finishRespawn`'s chat line; the vow entry walks to the altar and buys on arrival. 0.5: what the new sub-choices of CALL-4.17, CALL-4.18 and CALL-4.9 change.
- 2026-11-14, R0 premise re-check, at `9de722e` (main with Stages 2 and 3 merged into `feat/combat-weight`). Verdict: **every symbol found; no task changes; the plan stands as written.** One line per symbol (found = same file and role; moved = found elsewhere or the cited line moved):
  - `monsterAi.ts` (284 lines): `MonsterLogic` 11, `StepWorld` 38, `stepMonster` 125, `onPlayerHit` 270: found. The aggression test (camp circle and aggro radius) is at 220-231: found.
  - `pathfind.ts`: `findPath` 109, `nearestOpenCell` 233, `findWalkPath` 258, `entityGoal` 269, `shouldRepath` 309, `walkSpent` 319, `entityAim` 330, `stallTime` 348, `escapeStall` 357: found. `segmentWalkable` 27: found, still not exported (P2 exports it).
  - Stage 3: `playerAttackProfile` 212, `playerHitChance` 241, `monsterHitChance` 245, `rollMonsterHit` 256 (dragonfire on the literal key at 264), all in `src/state/combat.ts`; `creditGp` 7, `HP_REGEN_PER_SEC = 0.25` 19, `rollDrops` 28, all in `src/state/economy.ts` (under `src/state`, as its plan says): found. The player's damage roll (`max(1, floor(rand * (maxHit + 1)))`) and the Blood Barrage heal stay inline in `actions.ts` 159-187; no Stage 3 function owns them, so B3's `bossModel.ts` keeps its own roll, as `fight.ts` does.
  - `tests/content-freeze.test.ts` (`DECLARED_NEW_ITEMS` 12, used at 36; `MONSTER_TYPES` keyed at 23) and `tests/pacing.test.ts` (11 tests, model in `tests/support/pacingModel.ts`): found.
  - `playerActions.ts`: `handleInventoryClick` 147, `setCombatStyle` 238, `toggleSpecialAttack` 257, `togglePrayer` 267: found. `grantXp` 55: found, in `src/ui/playerActions.ts` (UI, mutates `STATE`, multiplies by `STATE.xpMultiplier`); `recipes.ts` 161 applies the rate inline too. S2's loss stays a pure function of `state`, as specified.
  - `xpMultiplier`: `createDefaultState` sets 10, `createNewGameState` 1, `migrateLegacySave` keeps 1 or else 10, and a save without the field keeps the default 10: as design 6.6 assumes.
  - `audio.ts` `tone` 42: found.
  - Pins of design 9.3: `world-data` `memberCount()).toBe(36)` still line 162 (`aggressive().length` = `CAMPS.length - 2` at 255, 266, 287; `POIS` length 7 at 135, 151); `world-budget` "CAMPS hold 36 monsters" now lines 40-41; `blender-hero` species test 133-136 (`speciesKeys.length` 10); `content-freeze` above: found. Other tests reading `MONSTER_TYPES`: `economy-invariants` 60 iterates it with `isBossLoot` choosing the gear bound (the boss drops no equipment, so it passes after B2), `combat-profile` 100 iterates it for `playerHitChance` (adds three cases, passes), `world-data` 189 and `placements` 11 check membership, `pacingModel` reads the camps; none counts monsters, none needs an edit.
  - Saves: `QuestFlags` (`types.ts` 21), `defaultQuests` 5 and `normalizeQuests` 44 (`quests.ts`); `tests/fixtures/s3/default-state.golden.json`, `save-v4-loaded.golden.json`; "same keys" in `tests/save-compat-s3.test.ts` 77-80; `no new saved field` in `tests/starter-quests.test.ts` 201-204 (`Object.keys(defaultQuests())` against the golden, so `lanternVow` must stay out of `defaultQuests`, as 6.6 says); `SAVE_KEYS` is a constant in `tests/save-relocation.test.ts` 38 (`LEGACY_SAVE_KEYS` in `save.ts` 16): found.
  - `actions.ts`: `handlePlayerDeath` 337, `finishRespawn` 354 (its chat line calls `deathNotice()` twice); `adventure.ts`: `deathNotice()` 365 (no argument yet), `isBossLoot` 420, `registerKill` 657: found. `loop.ts` altar branch 222; `input.ts` `onGameContextMenu` 255, `handleWorldClick` 376: found.
  - `makeCamp` (`worldMap.ts` 155): radius `ceil(farthest + 4.5)`, so 5 for one member: found, as 6.4 says.
  - `elvarg_dragon` under `src/` (catalog row aside): `monsterMeshes.ts` 687 (albedo), 787 (builder), 816 (pose); `textures.ts` 62; `overlay.ts` 120-121 (dot), 246 (label); `combat.ts` 264; `adventure.ts` 421 (`isBossLoot`), 662 (`killedElvarg`); `worldMap.ts` 233 is the placement: every branch of design 6.4's table found, at moved lines. The dragonfire chat lines are now `actions.ts` 299 and 314, the magic projectile 328-329.
  - MODEL: `fight.ts`'s hand-transcribed `swing` now calls `playerAttackProfile` and `playerHitChance`. `check-results.txt` and `decisions-results.txt` came out byte-identical, so every B3 row (A 98.9, C 96.8, B 0.0, G 0.0, F 0.1, R 98.5, M 100.0, Rstill 0.0, Mstill 0.1, FR 1.8, FM 9.2) and the gate (pooled 3.66%, worst block 4.8%) and the arena at (-102, 54) are as design 6.4 and 6.6 state. `results.txt` moved only in section 4: mean expanded cells 125 (was 120), max 3,686, none over the cap, no missing route; the time per call is noise. Design 6.2 tables unchanged.
  - Pacing (design 6.10), local patches not committed: with the `ashmantle` row and camp at (-102, 54) the test's printed output is identical to the baseline and all 11 tests pass (the model never picks the boss); with the model's rest at 1.0 HP/s all 11 pass, levels arrive 3 kills earlier (iron 39 to 36 on A1) and the order holds. No assertion moved.
  - Baseline (SG): 58 test files, 453 tests pass; TYPES clean; BUILD JS chunk 955.97 kB (gzip 263.46 kB).
- 2026-11-15, review finding 18 (G-7 item 6, rule 0.3.6). The reaction-time numbers of `minWindupMs` (700, 160, 90, the run speed 11.5 and the body radius 0.3) are now `REACTION_WINDOW` in `src/data/attacks.ts`, and the voice caps 12 and 16 and the 20 ms mute ramp are `AUDIO` in `src/data/feel.ts`; `telegraph.ts` and `audio.ts` import them. Rule 0.3.6 does not apply to the cue voices in `src/state/soundPlan.ts`, because design 6.7 places them there, nor to the mesh sizes in `src/engine/telegraphs.ts` (height offset, band width, halo, vertex step), because those 6.5 sizes are not timings, radii, powers or amplitudes of an attack.
- 2026-11-15, review finding 19 (G-7 item 8). MODEL brought in line with the final tables and rerun: `decisions.ts` leaves the boss's own camp (`ashmantle`, now in the live `CAMPS`) out of the arena criterion; `boss.ts` takes the live `bodyColor` 0x57534e and models the opening shift of CALL-4.18 (`openingShiftMs` 2000; the first draft's baseline has none), which `fight.ts` runs as a phase shift at the start; `fight.ts` now throws if `BOSS_ROW` differs from the game's row. CALL-4.18 is marked decided in O-4.3. `decisions-results.txt` came out byte-identical (the arena at (-102, 54) passes). `results.txt` moved in section 4 only: 42 monsters, 1,166 findPath calls, mean expanded cells 115, none over the cap; the time per call is noise. `check-results.txt` moved in the new boss's sections 3 to 7 because of the opening shift, and every proof row still holds: A 99.1 (was 98.9), C 97.0 (96.8), B 0.0, G 0.0, F 0.1, R 98.8 (98.5), M 99.8 (100.0), Rstill 0.0, Mstill 0.2 (0.1), FR 1.1 (1.8), FM 10.4 (9.2) against its bound of 15. The design's 6.4 table and the numbers that cite it are updated (design review log). A later fix (finding 19, second fix) caught two it missed: 6.6's D figure (72% to 73%) and the bolt paragraph's sweep and Prayer figures, now printed by `check.ts` sections 8 and 9.
