# Combat with weight: implementation plan

Date: 2026-11-14. Branch: `feat/combat-weight`. Design: `docs/superpowers/specs/2026-11-14-combat-weight-design.md` (called "the design" below; section numbers refer to it). Model: `docs/superpowers/research/combat-model/` (`model.ts`, `run.sh`, `results.txt`). Source line numbers are at commit `54736ba` and are only hints: Stage 2's review fixes and all of Stage 3 land before this plan starts.

The design is still a proposal. Nothing in this plan starts before owner step **O-4.1** (section 0.5).

The critique of 2026-11-14 (`docs/superpowers/specs/2026-11-14-combat-weight-critique.md`) was applied to this plan; its changes are in the review log at the end.

---

## 0. Conventions

These repeat the foundation plan's section 0 (`docs/superpowers/plans/2026-11-13-world-foundation-plan.md`), with this stage's values. Where the two differ, this file wins for Stage 4.

### 0.1 Task tags and tiers

- **[AGY]**: specified fully enough to hand to the agy backend through `/agy-implement` (one worktree) or `/agy-parallel` (several clusters). It always runs in three stages: a **haiku** stage runs the `agy -p` command and returns the diff stat, test output and exit status; a **sonnet** stage implements the task only if agy failed or refused, and records that it did; an **opus** stage (a [CLAUDE] verify) checks the diff against the task's allowlist, runs the acceptance check, and looks for weakened or deleted assertions and for edits to [CLAUDE] tests. On an [AGY] task, "Tier" names the tier that does the work if agy fails. The verify is always opus and is part of the task.
- **[CLAUDE]**: tests that define acceptance, work the plan cannot fully specify (tuning data against a test, the boss simulation), and every verification. Tests for an [AGY] task are their own [CLAUDE] task and come first.
- **[OWNER]** and **[HUMAN]**: a decision only the owner can make, or something a person has to see or hear in the running game.
- Agents never merge, tag, push or open pull requests. The main session merges after verification. No commit carries an AI attribution trailer.
- **Tier per kind of work in this plan** (owner's model rule): haiku runs commands and reports; sonnet writes tests from a table in the design and is the fallback implementer; opus writes the tests that define a rule (routes, patterns, phases, the boss simulation), tunes data and verifies. No fable stage: nothing here is a contract that later stages build on beyond what the design already fixed.

### 0.2 Commands

Run every command from the worktree root through the repository's wrapper, which starts an allowlisted environment under a 3 GB cap: `scripts/capped.sh <command>`.

| Name | Command | Expected |
|---|---|---|
| SUITE | `scripts/capped.sh npx vitest run` | exit 0; every test passes |
| ONE(file) | `scripts/capped.sh npx vitest run <file>` | as stated in the task |
| TYPES | `scripts/capped.sh npx tsc --noEmit` | exit 0, no output |
| BUILD | `scripts/capped.sh npm run build` | exit 0; the JS chunk size is reported |
| MODEL | `bash docs/superpowers/research/combat-model/run.sh` | prints the five tables of `model.ts` and the positional boss table of `check.ts`; `results.txt` and `check-results.txt` are rewritten |

**Standard gate (SG)**: SUITE, TYPES and BUILD all pass. Every task ends with SG unless it says otherwise. An OOM kill by the wrapper is a defect to fix. Never raise the cap. One BUILD at a time on the machine; at most 3 or 4 agents at a time.

### 0.3 Rules that apply to every task

1. **Allowlist.** A task touches only the files listed for it. The opus verify rejects a diff with any other file in it.
2. **Find symbols by name.** Line numbers are from `54736ba`.
3. **Existing tests are frozen.** No edit to any file that exists under `tests/` or `src/__tests__/` when R0 runs, except the four replacements declared in design 9.3 (Stage 3's `content-freeze`, `world-data` line 162, `world-budget`'s monster count, `src/__tests__/blender-hero.test.ts`'s species test), all made in M3 and each named in its commit message. A new test goes in a new file under `tests/`.
4. **Test-first pairs.** A [CLAUDE] test task may leave SUITE red in its new files, and TYPES and BUILD red only for a module, export, field or union member that the paired task adds. The opus verify of the test task lists those errors; any other is a defect. The paired task's accept restores full SG. A branch reaches the main session only when green.
5. **Purity.** No new file under `src/state` or `src/data` imports from `src/engine` or `src/ui`, or mentions `STATE`, `Math.random`, `Date.now`, `performance`, `document` or `window`. Time and randomness are parameters.
6. **Timings are data.** No millisecond, radius, power or amplitude of design 6.2 to 6.7 is written outside `src/data/attacks.ts` and `src/data/feel.ts`.
7. **`any` budget** stays as the foundation plan set it: `Object3D.userData`, rig parts bags, GLTF traversal. Each task reports how many it added.
8. **No new runtime dependency. No audio, image or model file.**
9. **Commit messages**: `test(<task>): …`, `feat(<task>): …`, `fix(#14): …` for the audit finding, `data(<task>): …` for tuning. One task, one or more commits; never two tasks in one commit.
10. **No file under `src/` over 1,000 lines** (the existing source-limit test). T4 and B2 state what moves if `monsterAi.ts` passes 600.

### 0.4 Branches, worktrees, clusters

- The **spine** (lanes P, T, B, then W) runs on `feat/combat-weight` itself, one task after another: these tasks edit `src/state/monsterAi.ts`, `src/engine/loop.ts` and `src/engine/actions.ts`.
- **Side clusters** S, F, A and M each run in their own worktree, `../osrs-like-wp/S4-<cluster>`, on a local branch `cw/<cluster>` cut from the spine head after R0 (cluster A after T2, because its plans read `ATTACKS`). They touch only new files and files no spine task before lane W touches (table in 1.1). They are merged into the spine before lane W, in the order S, F, A, M. `cw/` branches are never pushed.
- Workflow scripts live in `docs/superpowers/workflows/` (as Stage 2's do), so a crash loses nothing.

### 0.5 Owner and human steps (where they block)

| Step | What the owner decides or does | Blocks |
|---|---|---|
| O-4.1 | Approve the stage: CALL-4.1 (essence), CALL-4.2 (no new buttons), CALL-4.10 (ordinary monsters hit as hard on average), CALL-4.11 (synthesised sound), CALL-4.12 (deferrals), CALL-4.13 (no new model). | Everything |
| O-4.2 | **CALL-4.6**: what dying costs (A nothing, B fee, C grave, D repair). | S1, S2, W1 |
| O-4.3 | **CALL-4.4**: the dragon's fight (1,200 hitpoints, three phases, 120 s); **CALL-4.14**: whether a run of misses may kill from full health. | B1 to B4 |
| O-4.4 | **CALL-4.5**: regeneration paused in fights; food cooldown. | S1, S2, W1 |
| O-4.5 | **CALL-4.8**: ship two monsters, none, or four. | M1 to M3 |
| O-4.6 | **CALL-4.3** (no telegraphs in the start region) and **CALL-4.7** (auto-retaliation). | T2; S1, W1 |
| O-4.7 | **CALL-4.9**: the names. [HUMAN] web search for each. **CALL-4.15**: rename the dragon's display name. | The merge; CALL-4.15 also B4 and M3 |
| O-4.9 | **CALL-4.16**: warnings for trackpad players (leave and test, longer for everyone, or an option). | G-8 |
| CP-4 | [HUMAN] "Do the shapes read?" checkpoint after T5 (design 9.2, first two items). | Lane B |
| O-4.8 | Accept Stage 4 (after G-7 and G-8). | The merge |

If the owner takes an alternative, only the blocked task changes, as that task states: option A of CALL-4.6 removes the `deathCost` parts of S1, S2 and W1; "keep 260" in CALL-4.4 changes one number in B2 and the thresholds of B3 are re-derived by MODEL; "neither" in CALL-4.5 removes `regenRate` and the cooldown from S1, S2, W1; "ship none" in CALL-4.8 drops M1 and M3 and replacements 2 to 4, and leaves seven prepared slots; M2 stays (it changes nothing visible and is what a future reused-model monster needs), and with CALL-4.15 M3 still makes replacement 1 for the name alone. Options C and D of CALL-4.6 are not planned here: they need a design of their own. "Cap a single blow" in CALL-4.14 adds one clamp to `rollMonsterAttack` in B2 and a cap test in B1; B3 then re-derives B's threshold. "Rename" in CALL-4.15 changes the dragon's `name` in the world override (B2), the chat line in `actions.ts` that names it (B4) and the captured name in Stage 3's `content-freeze` (M3, replacement 1).

---

## 1. Order and files

### 1.0 Prerequisite

### R0 Premise re-check [CLAUDE]
- **Tier**: opus (judgment: decides whether the plan still fits the code).
- **Depends**: O-4.1; Stage 2 and Stage 3 merged to `main`; `feat/combat-weight` rebased onto `main`.
- **Files**: this plan and the design (edits recorded in the "Review log" section at the end of each); `docs/superpowers/research/combat-model/` (`model.ts`, `check.ts`, `results.txt`, `check-results.txt`).
- **Change**: read, by name, and record what was found: `stepMonster`, `onPlayerHit`, `StepWorld`, `MonsterLogic` (`monsterAi.ts`); `findPath`, `findWalkPath`, `nearestOpenCell`, `entityGoal`, `shouldRepath`, `segmentWalkable` and the Stage 2 review additions `entityAim`, `walkSpent`, `stallTime`, `escapeStall` (`pathfind.ts`); Stage 3's `playerAttackProfile`, `playerHitChance`, `monsterHitChance`, `creditGp`, `HP_REGEN_PER_SEC`, `rollDrops` and its `tests/content-freeze.test.ts` and `tests/pacing.test.ts`; `handleInventoryClick`, `togglePrayer`, `setCombatStyle`, `toggleSpecialAttack`; `tone` in `audio.ts`; the four pins of design 9.3 (Stage 3's `content-freeze`; `world-data` line 162 and `world-budget`'s "CAMPS hold 36 monsters" at their merged line numbers; `src/__tests__/blender-hero.test.ts`'s species test) and any new test that counts monsters or iterates `MONSTER_TYPES`. Replace the hand-transcribed swing in `model.ts` and `check.ts` with Stage 3's functions, run MODEL, and compare with design 6.2 and 6.4. Run Stage 3's `tests/pacing.test.ts` once with the dragon's proposed hitpoints and respawn time patched in locally (not committed) and record whether any assertion moves (design 6.10). Run SG and record test count and JS chunk size as this stage's baseline.
- **Accept**: a written list, one line per symbol: found, moved, or missing. If one is missing or MODEL's win rates leave the thresholds of B3, the plan is edited before any task starts and the edit is logged. SG passes.
- **Must not change**: anything under `src/` or `tests/`.

### 1.1 Lanes

| Lane | Tasks | Files |
|---|---|---|
| P (routes), spine | P1 to P4 | `src/state/pathfind.ts`, `src/state/collision.ts`, `src/state/monsterAi.ts`, `src/engine/loop.ts` |
| T (telegraphs), spine | T1 to T5 | `src/data/attacks.ts` (new), `src/state/telegraph.ts` (new), `src/data/world.ts`, `src/state/monsterAi.ts`, `src/state/combat.ts`, `src/engine/telegraphs.ts` (new), `src/engine/loop.ts`, `src/engine/actions.ts`, `src/engine/monsterMeshes.ts`, `src/engine/context.ts` |
| B (boss), spine | B1 to B4 | `src/data/attacks.ts`, `src/data/worldMap.ts`, `src/state/monsterAi.ts`, `src/state/combat.ts`, `src/engine/loop.ts`, `src/engine/actions.ts`, `src/ui/hud.ts`, `src/ui/styles.css`, `index.html` |
| S (sustain, commands), side | S1, S2 | `src/state/sustain.ts` (new), `src/state/commands.ts` (new), `src/state/adventure.ts` (`deathNotice` only) |
| F (feel), side | F1, F2 | `src/data/feel.ts` (new), `src/engine/reactions.ts` (new) |
| A (audio), side | A1, A2 | `src/state/soundPlan.ts` (new), `src/engine/audio.ts` |
| M (new monsters), side | M2 (M1 and M3 run on the spine) | `src/engine/blenderMonsters.ts`, `src/engine/spawns.ts` |
| W (wiring), spine, after the side merges | W1 to W3, M1, M3, W4 | `tests/new-monsters.test.ts`, `tests/names-combat.test.ts`, `src/engine/actions.ts`, `loop.ts`, `input.ts`, `context.ts`, `spawns.ts`, `playerMesh.ts`, `monsterMeshes.ts`, `src/ui/playerActions.ts`, `hud.ts`, `styles.css`, `index.html`, `src/data/world.ts`, `src/data/worldMap.ts`, the four declared test replacements, `README.md` |

What cannot run in parallel: every spine task with every other spine task. `src/data/world.ts` and `monsterMeshes.ts` are edited by T2/T5 on the spine, so lane M's edits to them (the `model` and `tint` fields and the two rows) are made in M3, on the spine. `spawns.ts` belongs to M2 until the side merges, so the monsters' stable `id` is assigned in W1, not T5. Side clusters never touch a spine file.

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
- **Change**: the G4.2 and G4.3 rows of design 9.1 that concern data and geometry: `inShape` for circle (both anchors), cone, line and ring, at edge, inside, outside and rotated; `shapeOutline` closed and consistent with `inShape` on a 0.25 grid; `escapeDistance` equals the "Escape" column of design 6.3 within 0.05 (a circle around the monster counts its full radius); every row has `windupMs >= minWindupMs(row) + 200`, no wind-up under 1,100 ms, every slot time (`max(slots x cadence, windupMs + 150)`) leaves a recovery of at least 150 ms, and for every boss phase at that phase's cadence (the boss rows arrive in B2; the test iterates whatever `BOSSES` holds); every pattern starts with `basic` and names existing attacks; chicken, goblin and goblin archer have no pattern; the conservation rule within 5% over 10,000 simulated seconds for each ordinary pattern (seeded, the loop of `model.ts` section 2).
- **Accept**: red until T2.
- **Must not change**: `src/`.

### T2 Attack tables and shape geometry [AGY]
- **Tier**: sonnet (data transcription and four small functions).
- **Depends**: T1.
- **Files**: `src/data/attacks.ts` (new), `src/state/telegraph.ts` (new), `src/data/world.ts`.
- **Change**: `attacks.ts` exports `CADENCE_SECS = 1.65`, `CAMP_WINDUP_GAP_SECS = 1.65`, `TELEGRAPH_TIME_SCALE = 1`, the types `Shape`, `AttackDef`, the six ordinary rows of `ATTACKS` and `PATTERNS` exactly as in design 6.2 and 6.3 (numbers from the 6.3 table, Rootquake 1,700 ms and Scorch Lane `halfWidth` 1.2; names from 6.9; no `cue` field, it is derived in A2). `telegraph.ts` exports `inShape(shape, originX, originZ, dirX, dirZ, x, z)`, `escapeDistance(attack)`, `minWindupMs(attack)` (700 + 160 + 90 + distance / 11.5 x 1000) and `shapeOutline(shape, segments)`. `world.ts`: `MonsterDef` gains `pattern?: string`; the type-level override sets it for scorpion, dark wizard, dark ranger, hill giant, moss guardian and lesser demon without editing `catalog.ts`.
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

### CP-4 "Do the shapes read?" [HUMAN]
Design 9.2, the first two items: each shape on four grounds and four tiers, by day and night, and one hill giant fight. Screenshots go in `docs/superpowers/baseline/cw/`. If a shape does not read, the fix is in `telegraphs.ts` (opacity, outline width, height offset) and is one more [AGY] task with the same allowlist. Lane B does not start before this passes.

---

## 4. Lane B: the boss (design 6.4, G4.4, G4.5)

### B1 Boss phase tests [CLAUDE]
- **Tier**: opus.
- **Depends**: CP-4, O-4.3.
- **Files**: `tests/boss-phases.test.ts` (new).
- **Change**: the G4.4 row of design 9.1, plus: `a boss heavy deals power x 0.75..1.0 when inside and 0 when outside`; `fire is cut to 25% by a ward, the quest flag or Protect from Magic, through resolveDragonfire`; `Tail Sweep is cut by Protect from Melee and not by Protect from Magic`; `Ashen Nova is cut by nothing`; `each heavy hit adds a mark up to four and resets one shared 12 s timer; every heavy hit while marks last is raised 25% per mark; all marks go when the timer runs out` (through `addMark`, `tickMarks` and `markMultiplier`, with time as a parameter); `unmarked, no boss heavy deals 60 or more before mitigation`; `a wind-up in progress is cancelled by a phase shift`; `the last phase's threshold is 0 and the boss can die`; `the boss never chases beyond arenaRadius`; `a boss pinned at its arena edge in chase does not stall home`; `reset and respawn restore phase I, the first pattern entry and full hitpoints`.
- **Accept**: red until B2.
- **Must not change**: `src/`.

### B2 Phases, gate, shift, arena, respawn [AGY]
- **Tier**: sonnet.
- **Depends**: B1.
- **Files**: `src/data/attacks.ts`, `src/data/worldMap.ts`, `src/data/world.ts`, `src/state/monsterAi.ts`, `src/state/combat.ts`.
- **Change**: `attacks.ts` gains the four boss rows and `BossDef`, `BOSSES` with the dragon's row exactly as design 6.4 (respawn 120, arena 12, mark step 0.25, max 4, 12 s; the three phases and their patterns; `shiftMs` 2,000; no hitpoints and no prayer hint in the row). `CampDef` gains `arenaRadius?`. `createMonsterLogic` takes the dead time from `BOSSES` when the type has a row (hitpoints come from `MONSTER_TYPES`, as today). `MonsterLogic` gains `phase` and `shiftLeft`. `onPlayerHit` clamps at the phase threshold and starts the shift; in a shift it returns `applied: false` with `reason: 'shift'`. `stepMonster` emits `{ kind: 'phase', index }`, uses the phase's pattern and `cadenceMult`, and applies the arena rule of 6.4 in place of the camp leash and the stall test for a boss. `reset` and respawn set `phase` 0, `patternIdx` 0 and `shiftLeft` 0. `rollMonsterAttack` handles `power`, the four styles and `marks`; `combat.ts` also gains the pure mark rule `addMark(marks, boss)`, `tickMarks(marks, dt)` and `markMultiplier(marks, boss)` on a `{ count, left }` value. `MonsterLogic` also gains `outsideFor`, the seconds the target has spent beyond `arenaRadius + 6`. The world override sets the dragon's `hp` to 1,200 (and, only with CALL-4.15, its new `name`): this is the one place the boss's hitpoints live.
- **Accept**: `ONE(tests/boss-phases.test.ts)` and unchanged `monster-hit`, `monster-territory` pass, then SG.
- **Must not change**: `rollMonsterHit`; `resolveDragonfire`; the dragon's level, name, drops, model.

### B3 Lair placement and the boss fight simulation [CLAUDE]
- **Tier**: opus (tunes data against tests and proves G4.5).
- **Depends**: B2.
- **Files**: `tests/support/bossModel.ts`, `tests/boss-fight.test.ts` (both new); `src/data/worldMap.ts` (the dragon camp only); `src/data/attacks.ts` (boss powers, wind-ups and mark step only, inside the timing rule); `tests/world-data-combat.test.ts` (one added assertion for the lair).
- **Change**: move the lair until `world-data-combat` and `world-data` pass with: the circle of `arenaRadius + 6` clear of every other camp's leash circle (radius + 4) and of every safe zone, every arena cell open, the home reachable (design 6.4 "Where the lair goes"; start near (-106, 66), not (-106, 106), which fails the leash test). Port the **positional** check, `docs/superpowers/research/combat-model/check.ts`, to `bossModel.ts`, calling `rollMonsterAttack`, `inShape` and Stage 3's attack functions, with the fighters A to G of design 6.4 plus a ranged and a magic fighter prepared as A (and each of them never moving). `boss-fight.test.ts` runs 500 seeds each and asserts: A at least 85%, C at least 65%, B and G at most 5%, F at most 15%, the ranged and magic fighters at least 85% and at most 5% when they never move; it prints the table. Expect F to fail first (41.5% in the critique's check): the lever is the share of damage that preparation cuts (the boss basic and the fire powers), not hitpoints.
- **Accept**: `ONE(tests/boss-fight.test.ts)`, `ONE(tests/attack-data.test.ts)`, `ONE(tests/world-data.test.ts)` pass, then SG. If a threshold misses, change boss powers, hitpoints or the mark step and record the new values in the design's review log; never a threshold.
- **Must not change**: any ordinary monster; any timing below its minimum.

### B4 Boss in the engine: phase change, bar, marks [AGY]
- **Tier**: sonnet.
- **Depends**: B3.
- **Files**: `src/engine/loop.ts`, `src/engine/actions.ts`, `src/ui/hud.ts`, `src/ui/styles.css`, `index.html`.
- **Change**: for a type with a `BOSSES` row, `performMonsterRetaliation` calls `rollMonsterHit` with `breathCount` 1 and does not increment it (design 6.4: no dice dragonfire; 0 would be dragonfire). `phase` shows the banner (`showBanner` with the phase name), one expanding ring from the existing `spawnExpandingRing`, and marks the boss untouchable in the target HUD for `shiftMs`. With CALL-4.15, the dragonfire chat line in `actions.ts` prints `monster.def.name`, not a literal name. `applied: false` with reason `shift` prints "untouchable" once and keeps the target. A boss bar (one block in `index.html`, hidden by default): name, hitpoints, two phase pips at 66% and 33%, the hero's mark count. It shows while the boss is in combat. The hero's `{ count, left }` mark value is held on `player`; the engine only calls `tickMarks` each frame, `addMark` on a heavy hit and passes the value to `rollMonsterAttack`, and clears it on death. No mark arithmetic is written in the engine.
- **Accept**: SG. `ONE(tests/globals.test.ts)` passes (no new inline handler). `ONE(tests/monster-hit.test.ts)` passes unchanged.
- **Must not change**: the minimap, the tab bar, any existing HUD element's id; `rollMonsterHit`.

---

## 5. Side clusters (parallel worktrees, cut after R0)

### Cluster S: sustain and commands (design 6.6, section 7)

### S1 Sustain and command tests [CLAUDE]
- **Tier**: sonnet (rules given as a table).
- **Depends**: R0, O-4.2, O-4.4, O-4.6.
- **Files**: `tests/sustain.test.ts`, `tests/commands.test.ts` (both new).
- **Change**: the G4.8 and G4.10 rows of design 9.1. `deathCost` for option B: `min(floor(gp * 0.1), combatLevel * 100)`, 0 below combat 15. `deathNotice(0)` deep-equals today's notice; `deathNotice(250)` names 250 coins, says banked coins are safe, no longer says "You keep your gear and coins", and matches `/Lumbridge/`. `shouldRetaliate` is false whenever `windupLive` is true. `applyCommand` refuses a meal inside the food cooldown without consuming it, and refuses a prayer below its level or with no points, with today's messages.
- **Accept**: red until S2.
- **Must not change**: `src/`; `tests/phase4-combat.test.ts`.

### S2 `sustain.ts` and `commands.ts` [AGY]
- **Tier**: sonnet.
- **Depends**: S1.
- **Files**: `src/state/sustain.ts`, `src/state/commands.ts` (both new); `src/state/adventure.ts` (`deathNotice` only).
- **Change**: `sustain.ts`: `FOOD_CD_SECS = 1.8`, `POTION_CD_SECS = 1.8`, `COMBAT_REST_SECS = 6`; `canEat(clock, now)`, `eat(state, slot, clock, now)` and `drink(...)` (today's effects of `handleInventoryClick`, returning what was restored; the clock is a small object the caller owns); `regenRate(sinceCombatSecs)`; `deathCost(state)` and `applyDeathCost(state)` through `creditGp`; `shouldRetaliate({ hasTarget, walking, keyHeld, downed, windupLive })`. `adventure.ts`: `deathNotice(paid = 0)` (design 6.6). `commands.ts`: the `PlayerCommand` union of design section 7 and the pure `applyCommand(state, cmd, clocks, now)` for `eat`, `drink`, `prayer`, `style` and `special`, returning `{ ok, reason, restored? }`: eat and drink through `sustain.ts`, style through `canUseStyle`, prayer with the level and points checks and messages that `togglePrayer` has inline today (moved, not copied: W1 makes `togglePrayer` call it), special with `toggleSpecialAttack`'s energy check. `move` and `attack` are not applied here.
- **Accept**: both tests pass, then SG.
- **Must not change**: `applyRespawn`; the title of `deathNotice` and its body when nothing was paid.

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
- **Change**: `soundPlan.ts`: the `Voice` type, `cueFor(attack, monsterStyle)` (fire for style `fire`, else melee low, ranged mid, magic high) and one plan function per cue of the design 6.7 table (`windupPlan(attack, cue)`, which ends at `windupMs` and holds no impact voice; `resolvePlan(cue)`, the impact; `impactPlan(ratio)`, `heavyTakenPlan()`, `dodgedPlan()`, `phasePlan()`, `bossDownPlan()`, `heartbeatPlan()`, `foodReadyPlan()`). `audio.ts`: `tone` and a new `noise` take a start offset on `ctx.currentTime`; one master gain and `DynamicsCompressor`; a count of live voices capped at 12 (16 for wind-up and impact cues); `SFX.play(plan)`; `setMuted(muted)` ramps the master gain to 0 or back within 20 ms; the existing `SFX` methods keep their names and sounds, re-expressed as plans (no `setTimeout`); `armAudioOnGesture()` exported for W3: it **creates** the context inside the first pointer, key or touch event and stays armed while the context is not `running`; no other code path creates it; cues are dropped while it is not running; the empty `catch` becomes a one-time `console.warn` and sound off.
- **Accept**: `ONE(tests/sound-plan.test.ts)`, then SG. `grep -c setTimeout src/engine/audio.ts` prints `0`; `grep -c audioEnabled src/engine/audio.ts` prints `1`.
- **Must not change**: the `SoundEffects` method names existing callers use (Stage 3's two tones included).

### Cluster M: new monsters (design 6.8)

### M1 Roster and name tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: W3, O-4.5; M2 merged. It runs on the spine, right before M3, so the side cluster stays green.
- **Files**: `tests/new-monsters.test.ts`, `tests/names-combat.test.ts` (both new).
- **Change**: the G4.9 row of design 9.1, for `saltback_stalker` and `thornwatch_marksman`. The name test reuses the deny-list of `tests/names.test.ts` by importing nothing from it: the list is copied with a comment naming its source, and a third assertion fails if the two lists differ.
- **Accept**: red until M3.
- **Must not change**: `src/`; `tests/names.test.ts`.

### M2 Model key and tint in the loader [AGY]
- **Tier**: sonnet.
- **Depends**: R0, O-4.5. Behaviour-preserving; the frozen `src/__tests__/blender-hero.test.ts` and `textures.test.ts` are its guard, and its new tests (M1) come with the monsters in M3.
- **Files**: `src/engine/blenderMonsters.ts`, `src/engine/spawns.ts`.
- **Change**: (No `roster.ts`: the slot table stays in the design and the README, design 6.8.) `MonsterEntityLike` gains an **optional** `modelKey` (default `typeKey`, because the frozen test builds the object without it), and reads optional `def.tint` and `def.modelScale`; `upgradeMonsterRigWithGltf` looks up `Monster_${modelKey}`, finds the pivots by `modelKey` (`findPivot` takes the type key today), chooses the albedo by `modelKey`, and multiplies `tint` into each non-emissive material colour. `spawnMonster` sets `modelKey = def.model ?? typeKey` and, after `createMonsterMesh`, multiplies `rig.group.scale` by `def.modelScale ?? 1` (the hitbox is a child of the group; the GLB upgrade keeps the group's scale).
- **Accept**: SG. Every existing monster renders from the same node as before (the opus verify reads the lookup).
- **Must not change**: materials of existing monsters.

---

## 6. Lane W: wiring (spine, after merging S, F, A, M in that order)

### W1 Commands, sustain, death cost, retaliation [AGY]
- **Tier**: sonnet.
- **Depends**: B4; S2, F2, A2, M2 merged.
- **Files**: `src/engine/actions.ts`, `src/engine/loop.ts`, `src/engine/input.ts`, `src/engine/context.ts`, `src/engine/spawns.ts`, `src/ui/playerActions.ts`, `src/ui/hud.ts`, `src/ui/styles.css`.
- **Change**: `spawnMonster` gives each monster a stable `id`. `dispatchCommand(cmd)` in `actions.ts` applies the five state commands through `applyCommand` and the two others (`move`, `attack`) itself; `handleWorldClick`, the context menu's attack and walk entries, `handleInventoryClick` (food and potion branches only), `togglePrayer`, `setCombatStyle` and `toggleSpecialAttack` call it. Eating sets `player.actionCooldown` to at least one tick. Backpack food and potion slots show a cooldown overlay (a CSS class and a custom property). `updateVitalsAndRegen` uses `regenRate` with the time since the hero last dealt or took damage. `handlePlayerDeath` calls `applyDeathCost` once and the death overlay's body adds what was paid (the title and "Lumbridge" stay). On a monster `attack` or heavy that lands, `shouldRetaliate` may set the target; `windupLive` is true while any monster targeting the hero has `logic.windup` set. In `handleWorldClick`, a click on the monster the hero already targets, while the hero is within its stop distance, is handled as a ground click at the ray's terrain hit (design 6.4, "Running in with one click").
- **Accept**: `ONE(tests/phase4-combat.test.ts)` unchanged, `ONE(tests/sustain.test.ts)`, then SG. A text scan in the opus verify: no write of `STATE.hp` from an item outside `sustain.ts`.
- **Must not change**: shops, bank, forge, bones, logs; `applyRespawn`.

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

### M3 The two monsters and their camps [CLAUDE]
- **Tier**: opus (places camps against the world-data test; makes a declared test replacement).
- **Depends**: M1.
- **Files**: `src/data/world.ts`, `src/data/worldMap.ts`, `src/engine/monsterMeshes.ts`, and the four **declared replacements** of design 9.3, one commit each, each named in its message: Stage 3's `tests/content-freeze.test.ts` (two keys; the dragon's name only with CALL-4.15), `tests/world-data.test.ts` (36 to 41), `tests/world-budget.test.ts` (36 to 41), `src/__tests__/blender-hero.test.ts` (iterate the 10 model keys, and every type's model key is one of them).
- **Change**: `MonsterDef` gains `model?`, `tint?` and `modelScale?`; `createMonsterMesh` and `poseMonsterLimbs` switch on `def.model ?? typeKey`. Add `saltback_stalker` and `thornwatch_marksman` with the rows of design 6.8. Add two aggressive camps (3 and 2 members) at coordinates that pass `world-data` and `world-data-combat`: outside every safe zone, off every path, clear of every resource node and of every point-of-interest piece by 2 (Stage 2 review 8), and the marksmen outside the `woods` region (Stage 5 plants trees there). The two rows use `modelScale` 1.4 and 1.1. Run `tests/pacing.test.ts`; if an assertion fails, apply the fallbacks of design 6.10 in order and record which.
- **Accept**: `ONE(tests/new-monsters.test.ts)`, `ONE(tests/names-combat.test.ts)`, `ONE(tests/world-data.test.ts)`, `ONE(tests/world-budget.test.ts)`, `ONE(src/__tests__/blender-hero.test.ts)`, `ONE(tests/textures.test.ts)`, `ONE(tests/pacing.test.ts)`, then SG. The opus verify diffs each replaced test against `main` and accepts only the edits design 9.3 names.
- **Must not change**: any existing monster row, drop, bounty band or quest.

### W4 README [CLAUDE]
- **Tier**: sonnet (doc sync to code).
- **Depends**: M3.
- **Files**: `README.md`.
- **Change**: the combat section (telegraphs, the boss's phases, food cooldown, the cost of dying as chosen), the monster table (two rows, the dragon's hitpoints and, with CALL-4.15, name) and the prepared monster slots of design 6.8 as a short table.
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
  7. `gate-simulation`, `monster-ai`, `monster-territory`, `monster-hit`, `phase4-combat`, `stage2-review-fixes` and Stage 3's `pacing` pass with no edit.
  8. MODEL run against the final tables; its numbers replace `results.txt` and `check-results.txt` and the design's tables if they moved.
  9. Finding 14 is closed by W2. Every row of design section 11 is done or carries its written deferral.
- **Accept**: a written pass.
- **Must not change**: anything except `docs/superpowers/research/combat-model/results.txt`, `check-results.txt` and, if numbers moved, the design's tables with a review-log line; the task is otherwise read-only.

### G-8 Stage 4 human checks [HUMAN]
Everything in design 9.2, each recorded with a screenshot or a sentence in `docs/superpowers/baseline/cw/`: the shapes on four grounds and four tiers; the hill giant fight; the boss as fighter A and as fighter F; sound by ear at full and throttled frame rate, on two browsers, muted, and on a fresh load; control during reactions; reduced motion; routes around the ridge, the castle and over the bridge; perf HUD at the pass and in phase II; the 6x CPU throttle; clicks under pressure with a mouse **and a trackpad** (design 9.2; the trackpad result answers CALL-4.16). Then the Stage 1 leak check again: `renderer.info.memory.geometries` returns to its first value after 30 telegraphed attacks and one boss fight.

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
| G4.4 phases | B1, B2, B4 | `boss-phases`; G-8 boss |
| G4.5 winnable and losable | B3 | `boss-fight`, unchanged `gate-simulation` |
| G4.6 hit weight | F1, F2, W2 | `feel-data`; G-8 control and reduced motion |
| G4.7 sound | A1, A2, W3 | `sound-plan`; G-8 sound |
| G4.8 sustain | S1, S2, W1 | `sustain`, unchanged `phase4-combat` |
| G4.9 roster | M1, M2, M3 | `new-monsters`, `names-combat`, the four declared replacements; O-4.7 |
| G4.10 pure, tables, commands | S1, S2, W1; rule 0.3.5 | `commands`, `architecture`, G-7 item 6 |
| G4.11 owed items | all | G-7 item 9 |
| G4.12 budget and tiers | P1, F1 | `pathfind-budget`, `feel-data`; G-7 item 2; G-8 perf |

### 8.2 Owed items to tasks

| Item (design section 11) | Task |
|---|---|
| Monster chase and return on the grid; the monster that cannot get home | P3, P4 |
| Food's job; regeneration | S2, W1 |
| The altar | none: kept, design 6.6 |
| The cost of dying | O-4.2, S2, W1 |
| The dragon's 8.35 s return | B2 |
| Audit finding 14 | W2 |
| Auto-retaliation | S2, W1 |
| Safespotting within a leash cycle | none: accepted, design section 11 |
| Ranged and magic ladders | none: deferred to Stage 6 |
| Roster gap | M1 to M3 |

### 8.3 Files this plan shares with Stage 3 and Stage 5

| File | Stage 3 | Stage 5 | Stage 4 task |
|---|---|---|---|
| `src/engine/actions.ts` | yes | | T5, B4, W1, W2, W3 |
| `src/engine/loop.ts` | yes | yes (render part) | P4, T5, B4, W1, W2, W3 |
| `src/state/monsterAi.ts` | yes (exports three constants) | reads only | P4, T4, B2 |
| `src/state/combat.ts` | yes | | T4, B2 |
| `src/engine/audio.ts` | yes (two tones) | | A2 |
| `src/engine/spawns.ts` | yes | yes | M2, W2 |
| `src/data/world.ts` | yes | | T2, B2, M3 |
| `src/ui/playerActions.ts` | yes | yes (`openModal`) | W1 |
| `index.html` | yes | yes | B4, W2 |
| `README.md` | yes | | W4 |
| `src/ui/hud.ts`, `src/ui/styles.css` | | yes | B4, W1, W2 |
| `src/engine/monsterMeshes.ts`, `blenderMonsters.ts`, `playerMesh.ts`, `context.ts`, `input.ts` | | yes (materials, context fields) | T5, M2, M3, W1, W2 |
| `src/state/pathfind.ts` | | reads only (its 6.11 says it does not touch it) | P2 |
| `src/state/collision.ts` | | yes (trunk cells in `isWalkable`) | P4 (optional walk test only) |
| `src/state/adventure.ts` | yes (quests, bounties, `creditGp`) | | S2 (`deathNotice` only) |
| `src/data/worldMap.ts` | | yes (woods trees table) | B2, B3, M3. The two new camps stay outside the `woods` region, so Stage 5's clearings are unchanged; Stage 5's R0 still re-reads `CAMPS`. |
| `src/engine/vfx.ts` | | yes (shape swap table) | not touched: new effects are in `telegraphs.ts` and `reactions.ts` |
| Stage 3's `tests/content-freeze.test.ts` | owns it | | M3, declared replacement 1 |

Stage 3 lands first, so its side of every shared file is already there when R0 runs. Stage 5 lands after; its task R0 re-reads these files.

---

## Review log

- 2026-11-14, critique (`docs/superpowers/specs/2026-11-14-combat-weight-critique.md`), applied with the design's changes in one commit. Rule 0.3.3 and G-7 now name four declared replacements, all in M3 (the first draft missed `world-budget` and `src/__tests__/blender-hero.test.ts`, and made `world-data` an "if"). P: `segmentWalkable` exported instead of a new `gridSegmentOpen`; `openStart` keeps an open point; `collision.ts` added for the walk test; rotation, route goal, `escapeStall` and grid-only rules specified and tested. T: camp wind-up gate in place of the start-index stagger; cancel on every T5 cause; band outline, no fog, not clickable; mesh faces the locked direction; Rootquake 1,700 ms and Scorch Lane 2.4 wide; no `cue` field. The stable `id` moved from T5 to W1 (`spawns.ts` belongs to M2 until the merge). B: no hitpoints or prayer hint in `BossDef`; boss basics with `breathCount` 1; reset restores phase I; no stall for a boss; lair placed against leash circles; B3 ports the positional check and adds ranged and magic fighters. S: `deathNotice(paid)` (adventure.ts added); `applyCommand` pure for five commands instead of `validateCommand`; retaliation guard. A: impact on the resolve event; mute ramp; context created on a gesture. M: no `roster.ts`; optional `modelKey`; pivots by model key; Thornwatch Marksman; camps outside the woods and clear of POI pieces. W1: run-in click rule. G-8: trackpad. New owner steps for CALL-4.14 to CALL-4.16.
