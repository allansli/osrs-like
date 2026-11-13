# World foundation: implementation plan

Date: 2026-11-13. Branch: `feat/world-foundation`. Design: `docs/superpowers/specs/2026-11-13-world-foundation-design.md` (called "the design" below; section numbers refer to it). Maps: `docs/superpowers/specs/2026-11-13-world-foundation-maps/`. Audit: `docs/audit/2026-11-13-findings.json`. Source line numbers are at commit `1284a6e`.

The design is still a proposal. Nothing in this plan starts before owner step **O-1** (section 0.6).

---

## 0. Conventions

### 0.1 Task tags and tiers

- **[AGY]**: the task is specified fully enough to hand to the agy backend through `/agy-implement` (one worktree) or `/agy-parallel` (several clusters). It always runs in three stages: a **haiku** stage runs the `agy -p` command and returns the diff stat, test output and exit status; a **sonnet** stage implements the task only if agy failed or refused, and records that it did; an **opus** stage (a [CLAUDE] verify) checks the diff against the task's allowlist, runs the acceptance check, and looks for weakened or deleted assertions and for edits to [CLAUDE] tests. On an [AGY] task, "Tier" names the tier that does the work if agy fails. The verify stage is always opus and is part of the task.
- **[CLAUDE]**: tests that define acceptance, governance or licensing text, work the plan cannot fully specify (tuning world data against a test, the monster-state reshape, deciding which geometry is shared), and every verification. Tests that define acceptance for an [AGY] task are their own [CLAUDE] task and come first.
- **[OWNER]** and **[HUMAN]**: a decision only the owner can make, or something a person has to look at in the running game. These are not agent tasks.
- Agents never merge, tag, push or open pull requests. The main session merges cluster branches after verification. No commit carries an AI attribution trailer (owner's global rule).

### 0.2 Commands

Run every command from the repository root (or the worktree root), in a shell started with an allowlisted environment, so that no token reaches a test process: `env -i HOME="$HOME" PATH="$PATH" XDG_RUNTIME_DIR="$XDG_RUNTIME_DIR" DBUS_SESSION_BUS_ADDRESS="$DBUS_SESSION_BUS_ADDRESS" bash`. The two XDG and D-Bus variables are needed: without them `systemd-run --user` fails with "Failed to connect to bus" (checked on this machine).

| Name | Command | Expected |
|---|---|---|
| SUITE | `systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 env TEST_CONCURRENCY=4 npx vitest run` | exit 0; every test passes, including the 103 baseline tests |
| ONE(file) | `systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 env TEST_CONCURRENCY=4 npx vitest run <file>` | as stated in the task |
| TYPES | `systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 env TEST_CONCURRENCY=4 npx tsc --noEmit` | exit 0, no output |
| BUILD | `systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 env TEST_CONCURRENCY=4 npm run build` | exit 0; the JS chunk size is reported |

**Standard gate (SG)**: SUITE, TYPES and BUILD all pass. Every task below ends with SG unless it says otherwise. A wrapper OOM kill means a defect to fix. Never raise the cap.

### 0.3 Rules that apply to every task

1. **Allowlist.** A task touches only the files listed for it. The opus verify rejects a diff with any other file in it.
2. **Line numbers go stale.** After the first move, line numbers in `runtime.ts` no longer match `1284a6e`. Every extraction task names the symbols it moves, so find them by name. The `1284a6e` ranges are only a hint.
3. **Existing tests are frozen.** No edit to any file that exists today under `tests/` or `src/__tests__/`. A new test goes in a new file under `tests/`, never under `src/` (the no-pragma scan would see itself). The only edits allowed to test files created by this plan are the three replacements declared in design 6.11, each named in the Stage 2 task that makes it (W3, W5, A5).
4. **Test-first pairs.** A [CLAUDE] test task may leave the suite red until the [AGY] task that implements it lands on the same branch. Because `tsconfig.json` includes `tests/` and `npm run build` runs `tsc --noEmit`, a test file that imports a module or export the paired task has not written yet also makes TYPES and BUILD red. Allowed in that window: SUITE failures only in the new test files, and TYPES/BUILD errors only in the new test files and only because a module, export, field, optional parameter or union member that the paired task adds does not exist yet (for example "Cannot find module", "has no exported member", "does not exist on type", "is not assignable to type" for a new state name, "may only specify known properties" for a new world field). The opus verify of the test task lists them; any other error is a defect. The paired task's accept restores full SG. A branch reaches the main session only when it is green.
5. **Commit kinds (design 5.2).** Move, Type, Reshape and Fix are separate commits and never mixed. A Move commit may carry `// @ts-nocheck` in the new file. The Type commit right after it removes the pragma. The opus verify checks a Move with `git diff --color-moved=dimmed-zebra -w HEAD~1`; this is review evidence that no logic changed, not a pass/fail command.
6. **`any` budget (CALL-11).** An explicit `any` is allowed only at three seams: `Object3D.userData`, the rig parts bag (`player.parts`, monster `rig`), and GLTF scene traversal. Each Type task reports how many it added; the pull request totals them.
7. **No new runtime dependency** (design C5).
8. Every commit message names its kind and, for a Fix, the finding number: `move(engine): extract vfx.ts`, `fix(#11): dispose VFX geometry`.

### 0.4 Branches, worktrees, clusters

- The Stage 1 spine (cluster **X**) runs on `feat/world-foundation` itself, one task after another. Every spine task edits `src/engine/runtime.ts`, so none of them can run in parallel.
- Fix clusters each run in their own worktree, `../osrs-like-wt/<cluster>`, on branch `wf/<cluster>`, cut from the spine head after task F02. These `wf/` (and Stage 2 `wp/`) branches are local worktree branches only: they are never pushed; only `feat/world-foundation` and `feat/world-place` go to the remote. They may be developed in parallel. They are merged **only after checkpoint CP-1** (design 5.2: every move, reshape and typing lands before any fix), and in the order given in 1.4.
- Run at most 3 or 4 agents at a time on this machine, with one BUILD at a time.

### 0.5 Owner and human steps (where they block)

| Step | What the owner decides or does | Blocks |
|---|---|---|
| O-1 | Approve Stage 1 scope: CALL-1 (essence), CALL-11 (no pragma anywhere, three `any` seams), CALL-12 (fix/defer ledger), CALL-14 (Stage 1 scope), CALL-16 (what is left out). CALL-13 (later order) is for information. | Everything |
| O-2 | Capture the baseline: a real version-4 save, FPS on the owner's GPU, the GPU geometry count (task PRE-1). | X01 |
| O-3 | Resolved, no owner step: `knight.blend` is Blend Swap blend 28541, "Rigged Knight in Armor" by Xali, CC0. | none |
| O-4 | **Q3 / CALL-2**: block buying gathered goods now, yes or no. | S3, S4 |
| O-5 | **Q5 / CALL-5**: is the game framed by another site? (sets `frame-ancestors`) | T4 |
| O-6 | **Q6**: point the README at Vercel, or make GitHub Pages work. | D3 |
| O-7 | **Q8 / CALL-3**: 2048 shadows on every tier, or 1024 on the default tier. | R2 |
| O-8 | **CALL-4**: major-version bumps of vite and vitest, CI on Node 22. | T6, T7 |
| CP-1 | [HUMAN] "Is it the same game?" checkpoint after the spine. | every fix merge |
| O-9 | Accept Stage 1 (after G-1 and G-2). | everything in Stage 2 |
| O-10 | Approve Stage 2 scope: CALL-6 (layout), CALL-7 and **Q7** (aggression), CALL-8 and **Q4** (leashing, teleport rule), CALL-9 (the gate), CALL-10 (the twelve names), CALL-15 (Stage 2 scope). | Stage 2 |
| O-11 | [HUMAN] web search for each new name. | Stage 2 merge |
| Q2 | Renaming borrowed names. Out of scope for both stages, and blocks nothing. Until it is answered, signposts show the existing region names next to the new ones. | none |

If an owner answer takes "the alternative" (for example 1024 shadows, or no shop block), the blocked task changes as stated inside that task. No other task changes.

---

# Stage 1: Foundation

## 1.0 Prerequisites

### PRE-1 Baseline capture [CLAUDE] + [OWNER]
- **Tier**: haiku for the command runs (mechanical, output recorded). The owner captures what needs the running game.
- **Depends**: O-1.
- **Files**: `docs/superpowers/baseline/2026-11-13-stage1-baseline.md` (new), `docs/superpowers/baseline/shot-03-noon.jpg`, `docs/superpowers/baseline/shot-04-peak.jpg` (copied from the gitignored `.playwright-mcp/`), `tests/fixtures/save-v4.json` (new).
- **Change**: record the SUITE, TYPES and BUILD output (expected: 103 tests in 11 files, tsc clean, JS chunk 926.36 kB). The owner plays a character to non-default state and saves while standing in the start town, within 16 units of (0, 0) and outside the castle, so the position stays valid after Stage 2 relief (gp, several skills, bank items, a slayer task, a claimed quest, an active prayer, a chosen spell, special energy below 100). In the browser console the owner runs `copy(localStorage.getItem('gielinor_hero_save_v1'))` and saves the result as `tests/fixtures/save-v4.json`. Also recorded: FPS on the owner's GPU at the two `window.__DEBUG` poses on the balanced tier; perf HUD draw calls and triangles at both poses; `renderer.info.memory.geometries` at rest, then again after 200 attacks, 5 level-ups and 20 gear swaps (it grows today).
- **Accept**: the baseline file holds every number above. `save-v4.json` parses as JSON and has `"version":4`. SUITE reports 103 passed.
- **Must not change**: anything under `src/` or `tests/` except the new fixture.

---

## 1.1 Spine: extraction (cluster X, serial, on `feat/world-foundation`)

Every X task ends with SG. X tasks never change behaviour.

### X01 Architecture tests [CLAUDE]
- **Tier**: sonnet (tests written from a clear spec).
- **Depends**: PRE-1.
- **Files**: `tests/architecture.test.ts` (new).
- **Change**: two tests.
  - `imports every module under src in node without throwing`: list `src` with `fs.readdirSync(srcDir, { recursive: true })`, keep the `.ts` files, leave out `src/main.ts` and everything under `src/__tests__/`, and `await import(pathToFileURL(file).href)` each one. Do not use `import.meta.glob`: `tsconfig.json` has `"types": []`, so `ImportMeta.glob` is not declared and TYPES would fail. New modules are then covered automatically.
  - `state and data layers do not import engine, ui or three, and do not mention document or window`: read every file under `src/state` and `src/data` as text.
- **Accept**: `ONE(tests/architecture.test.ts)`. The layering test passes today. The import test fails on `src/engine/runtime.ts` (`window is not defined`) until X02.
- **Must not change**: any existing file.

### X02 Move the import-time listeners into `boot()` [AGY]
- **Tier**: sonnet (two-line move).
- **Depends**: X01.
- **Files**: `src/engine/runtime.ts`, `src/main.ts`.
- **Change**: add `export function boot(): void` to `runtime.ts`. It registers, unchanged, the `beforeunload` listener (5989) and the `DOMContentLoaded` handler (6224-6253). Nothing else runs at import time. `main.ts` keeps its stylesheet import and calls `boot()`.
- **Accept**: `ONE(tests/architecture.test.ts)` passes both tests, then SG.
- **Must not change**: the body of the `DOMContentLoaded` handler or the order of its calls.

### X03 Delete dead code and the ordering guards [AGY]
- **Tier**: sonnet (deletions named exactly).
- **Depends**: X02.
- **Files**: `src/engine/runtime.ts`.
- **Change**: delete `countItemInInventory` and `removeItemsFromInventory` (327-335, no callers); `particlesList` (1078); `atmosphericMotes`, `createSoftMoteTexture`, `buildAtmosphericParticles` and `updateAtmosphericParticles` (3592-3700, never called); `contextTarget` (3713) and its two writes (3899, 3919); `lastMiniYaw` (5988). Remove the `typeof fn === 'function'` guards at 288, 409 and 449: the functions are hoisted declarations, so each guard is always true, and the guarded call is kept. This is the dead-code part of finding 21. Commit message: `chore(#21): delete dead code and ordering guards` (G-1 step 6 looks for it).
- **Accept**: SG. `grep -c "atmosphericMotes\|contextTarget\|lastMiniYaw\|particlesList" src/engine/runtime.ts` prints `0`.
- **Must not change**: any reachable statement.

### X04 Move terrain to `src/state/terrain.ts` [AGY]
- **Tier**: sonnet (verbatim move).
- **Depends**: X03.
- **Files**: `src/state/terrain.ts` (new), `src/engine/runtime.ts`.
- **Change**: Move commit only. Move `getTerrainHeight` and `rawHills` verbatim. Add `regionAt(x, z): RegionDef | null`, which returns the first `WORLD_REGIONS` entry whose radius contains the point (the loop in `checkRegionChange`, 4098-4110). `checkRegionChange` calls `regionAt` and keeps `currentRegion` when the result is `null`. `terrain.ts` imports only `../data/world` and `./collision`.
- **Accept**: SG. `ONE(tests/architecture.test.ts)` passes, layering included.
- **Must not change**: the river formula inside `getTerrainHeight`. X06 changes it, under the golden.

### X05 Terrain tests [CLAUDE]
- **Tier**: sonnet (tests written from design 5.3 and G1.3).
- **Depends**: X04.
- **Files**: `tests/terrain-golden.test.ts`, `tests/terrain.test.ts`, `tests/fixtures/terrain-golden.json` (all new).
- **Change**:
  - `terrain-golden.test.ts`: `terrain matches the extraction golden`. It samples `getTerrainHeight` on a 5-unit grid over [-130, 130] (53 x 53 points) and compares each value to the fixture within 1e-9. When `UPDATE_GOLDEN=1` is set, it writes the fixture instead. Generate the fixture once from the function as moved in X04, with `systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 env TEST_CONCURRENCY=4 UPDATE_GOLDEN=1 npx vitest run tests/terrain-golden.test.ts`.
  - `terrain.test.ts`, the permanent invariants: `height is exactly 0 within 16 of every region centre`; `river centre at z=0 is below the water plane`; `land 28+ from every centre and outside the trough is at least 0.08`; `regionAt returns each region at its centre`; `regionAt(40,-10) is lumbridge`; `regionAt returns null outside every radius`.
- **Accept**: `ONE(tests/terrain-golden.test.ts)` and `ONE(tests/terrain.test.ts)` pass, then SG.
- **Must not change**: `src/`.

### X06 Type terrain and use `riverCenterX` [AGY]
- **Tier**: sonnet (small typing step).
- **Depends**: X05.
- **Files**: `src/state/terrain.ts`.
- **Change**: Type commit. No pragma. Replace the inline `28 + Math.sin(z*0.05)*8` with `riverCenterX(z)`.
- **Accept**: `ONE(tests/terrain-golden.test.ts)` passes with the X05 fixture unchanged, then SG.
- **Must not change**: the golden fixture.

### X07 Move shared engine state to `src/engine/context.ts` [AGY]
- **Tier**: sonnet (mechanical search and replace).
- **Depends**: X06.
- **Files**: `src/engine/context.ts` (new), `src/ui/hud.ts` (new, `el` only), `src/engine/runtime.ts`.
- **Change**: Move commit, then Type commit. `context.ts` imports only `three` and project types.
  - Export `TICK_SEC` (86); `player` and `camState` (1081-1117); the scratch vectors `_tmpScratchVec`, `_camTargetVec`, `_lookTargetVec` (1162-1164); and `telemetryInfo` (1230) as a const object.
  - Export `G`, whose fields are every variable declared at 1069-1079 (`scene`, `camera`, `renderer`, `sunLight`, `ambientLight`, `hemiLight`, `terrainMesh`, `waterMesh`, `skyDomeMesh`, `grassInstanced`, `waterUniforms`, `skyUniforms`, `worldInteractiveObjects`, `monstersList`, `resourceNodesList`, `npcList`, `projectilesList`, `vfxList`, `swayingFoliage`), plus `frameCounter` and `lastFpsTime` (1237-1238), `npcAnimatorsList` (2141), the input state (3706-3712: `keysPressed`, `raycaster`, `mouseVec`, `hoveredWorld`, `clickMarkerMesh`, `hoverTile`, `rightPress`), `lastFrameTime` (5362), and the loop timers (5982-5987: `setBonusTimer`, `lastAutoSaveTime`, `labelTick`, `miniTick`, `lastLabelX`, `lastLabelZ`).
  - Every use in `runtime.ts` becomes `G.<name>`.
  - The Type commit also defines, in `context.ts`, the shared entity types that every later Type task uses instead of inventing its own: `PlayerState` (the shape of `player`), `MonsterEntity` (extends `MonsterEntityLike` from `blenderMonsters.ts`), `ResourceNodeEntity` (extends `ResourceNodeLike` from `blenderWorld.ts`), `NpcLabel`, `VfxEntry = { mesh: THREE.Object3D; life: number; age: number; onTick?: (v: VfxEntry, dt: number) => void }` and `ProjectileEntry`, with the fields the code reads today. `G`'s lists are typed with them. Type-only imports from `blender*.ts` keep the "types only" rule.
  - The same commit creates `src/ui/hud.ts` holding only `export function el<T extends HTMLElement = HTMLElement>(id: string): T`, which throws `Error('missing #<id>')`. Every later Type task (X09, X12, X13, X16, X18, X23 have DOM lookups) uses `el` instead of null checks. X18 moves the HUD symbols into this same file.
- **Accept**: SG. `grep -n "^let \(scene\|camera\|renderer\|monstersList\)" src/engine/runtime.ts` prints nothing.
- **Must not change**: initial values. Arrays keep their identity, and `npcAnimatorsList` is now initialised before any builder runs.

### X08-X13, X16, X18-X23: one module per task [AGY]

Each of these tasks is one Move commit and then one Type commit for one module. Each depends on the task before it in this order: X08, X09, X10, X11, X12, X13, (X14, X15), X16, X17, X18, X19, X20, X21, X22, X23.

- **Tier**: sonnet (verbatim move, then compiler-guided typing, both against a clear rule).
- **Files**: the new module and `src/engine/runtime.ts`. A task may also touch an already-extracted module, but only to change an import line, and `src/engine/context.ts`, but only to add fields to the shared entity types.
- **Change**: cut the named symbols, paste them into the new module, export what other modules use, and add imports. A module may import from `runtime.ts` the symbols that have not moved yet; cycles between engine and ui are allowed, because no module runs code at import time. Then the Type commit: remove the pragma, add types, add `GLTF` type imports where loaders are touched, and use `any` only at the three seams. Entities use the shared types in `context.ts` (`PlayerState`, `MonsterEntity`, `ResourceNodeEntity`, `NpcLabel`, `VfxEntry`, `ProjectileEntry`, from X07); a missing field is added there, never to a local copy. DOM lookups use `el(id)` from `src/ui/hud.ts` instead of null checks. The same two rules apply to the Type commits of X15, X26 and X29.
- **Accept**: SG after each commit. `ONE(tests/architecture.test.ts)` passes, so the new module imports in node. `grep -c "@ts-nocheck" <new module>` prints `0` after the Type commit.
- **Must not change**: any statement's logic, constants, call order, or DOM ids.

| Task | New module | Symbols (`1284a6e` hint) | Notes |
|---|---|---|---|
| X08 | `src/engine/audio.ts` | `SFX` (89-141) | |
| X09 | `src/engine/vfx.ts` | `spawnHitSplatWorld`, `spawnHitSplatOnPlayer`, `glowMaterial`, `spawnVfx`, `launchProjectile`, `spawnProjectile`, `spawnBurst`, `spawnExpandingRing`, `spawnSlashArc`, `metalSlashTint`, `spawnMeleeSlashEffect`, `spawnSpellImpact`, `spawnRunicCircle`, `spawnSpellProjectile`, `spawnArrowProjectile`, `spawnPiercingBeam`, `spawnRareLootBeam`, `spawnDragonfireEffect`, `spawnShadowBolt`, `spawnHellfireOrb`, `spawnLevelUpFireworks` (4124-4745) | The fireworks keep their private rAF loop until fix L2. |
| X10 | `src/engine/monsterMeshes.ts` | `monsterPart`, `monsterPivot`, `monsterHitbox`, `finishMonster`, `glowEye`, `paint`, `addQuiver`, `addStrungBow`, the ten `build*` monster builders, `buildElvargMesh`, `createMonsterMesh`, `poseMonsterLimbs` (2518-3375) | Largest module, about 860 lines. Must stay under 1000. |
| X11 | `src/engine/playerMesh.ts` | `buildPlayerCharacter`, `syncWhipGeometry`, `rebuildPlayerEquipmentMeshes` (2143-2516) | |
| X12 | `src/engine/worldMesh.ts` | `getBiomeColor` (1149-1160), `buildSkyDomeShader`, `cycleTimeOfDay`, `buildTerrainAndWater`, `buildRiverBridge` (1335-1535) | |
| X13 | `src/engine/worldBuild.ts` | `buildBiomeLandmarks`, `buildAllCitiesAndLandmarks`, `createCastleStructure`, `createPrayerAltar`, `createForgeStation`, `createBankBooth`, `createSlayerMaster`, `createMerchantNPC`, `cachedGuardPromise`, `loadBlenderGuardTemplate`, `createCastleGuard`, `spawnWorldProp` (1537-2138) | The Type commit imports `type GLTF` from `three/examples/jsm/loaders/GLTFLoader.js`; its message names `#20`. This closes the GLTF part of **finding 20** (opus verify confirms). |
| X16 | `src/engine/overlay.ts` | `renderMinimap`, `worldToScreenPos`, `worldToScreen`, `LANDMARKS`, `landmarkEls`, `playerOverheadEl`, `updateLandmarkLabels`, `updateFloatingWorldLabels` (5119-5357) | The Type commit replaces the inline river formula at 5154 with `riverCenterX`. |
| X18 | `src/ui/hud.ts` (exists since X07, holding `el`) | `initStaticSvgIcons`, `addChatMessage`, `getCombatLevel`, `getItemReqInfo` (143-200); `spawnXpDrop`, `lvlBannerTimeout`, `showLevelUpBanner`, `showBanner` (293-318); `switchTab` (470-477); `updateAllUI` (575-803); `updateTargetHud` (4060-4080); `applyLoadedStateToHud` (5991-6004); `refreshCombatStyleLocks` (6014-6024); `showItemTooltip`, `moveItemTooltip`, `hideItemTooltip` (6050-6068) | DOM lookups in `hud.ts` use `el` (from X07) instead of null checks. |
| X19 | `src/ui/playerActions.ts` | `grantXp` (265-291); `addItemToInventory`, `sellInventoryItem`, `sellPayoutLabel`, `showSellChooseMenu`, `handleInventoryClick`, `unequipSlot` (320-468); `setCombatStyle`, `toggleSpecialAttack`, `togglePrayer`, `handleSpellClick`, `toggleXpMultiplier` (479-573); `closeModals`, `hideHoverTooltip`, `openModal`, `openShopModal`, `renderShopModal`, `buyShopItem`, `buyShopPair`, `sellAllLoot`, `sellAllUnequippedGear`, `openSmithingModal`, `renderSmithingModal`, `craftRecipe`, `openXpTableModal`, `openWorldMapModal`, `locateQuestRegion`, `claimQuestReward`, `requestSlayerTask` (805-981); `openBankModal`, `openQuestsModal`, `openSettingsModal`, `toggleAudio` (6026-6048) | |
| X20 | `src/engine/session.ts`, plus `src/state/save.ts` | `saveGameState`, `loadGameState`, `manualSaveToast`, `resetGameSave` (983-1063); `cheatBuffer`, `noteCheatKey`, `cheatSkillsPlus10`, `cheatGold200k`, `applyTypedCheat` (6087-6128); `INTRO_KEY`, `dismissOnboarding`, `replayOnboarding`, `maybeShowOnboarding` (6200-6219) | The pose and camera clamps at 1033-1043 move to `save.ts` as `sanitizePose(p: SavedPose): SavedPose` and `sanitizeCam(c: SavedCam): SavedCam`, with the same numbers (pitch at most 0.42, distance at most 9.5). `loadGameState` calls both. The `gielinor_anime_hero_v1` migration (1018-1032) moves unchanged. `save.ts` is on this task's allowlist. |
| X21 | `src/engine/actions.ts` | `teleportToRegion`, `lastBannerRegion`, `checkRegionChange`, `bannerTimer`, `triggerRegionBanner` (4082-4122); `performPlayerAttack`, `wpKindIsChop`, `handleMonsterDeath`, `performMonsterRetaliation`, `handlePlayerDeath`, `finishRespawn`, `performResourceGather` (4747-5117) | The player's attack formulas stay here, unchanged. |
| X22 | `src/engine/input.ts` | `setupInputHandlers`, `resetCameraBehindPlayer`, `showClickMarker`, `handleWorldHover`, `hideContextMenu`, `pointerToWorld`, `onGameContextMenu`, `openChooseMenu`, `handleWorldClick` (3715-4058); `updateHoverTile` (6070-6085) | |
| X23 | `src/engine/renderer.ts` | `QualityTier`, `currentQuality`, `outlinesEnabled`, `getQualityDpr`, `applyQualityTier`, `cycleGraphicsQuality`, `toggleOutlines`, `syncGraphicsButtons`, `initGpuTelemetry`, `init3DEngine` (1166-1333); `onWindowResize` (6006-6011) | `outlinesEnabled` keeps its initial value `true` until fix R1. |

### X14 Placement tests [CLAUDE]
- **Tier**: sonnet (written from G1.3).
- **Depends**: X13.
- **Files**: `tests/placements.test.ts` (new).
- **Change**: import `MONSTER_PLACEMENTS` and `NODE_PLACEMENTS` (type `{ type: string; x: number; z: number }[]`) from `src/data/placements.ts`. Tests:
  - `every monster type has a MONSTER_TYPES entry`
  - `every node type has a RESOURCE_NODES_DEF entry`
  - `every monster point is walkable`
  - `every fishing point is within 6.8 of riverCenterX(z)` (planned replacement #2, see W5)
  - `every fishing point is within 3.1 of a walkable point` (sample a circle of radius 3.1 in 16 steps)
  
  Exact counts are not asserted, because Stage 2 changes them. The opus verify of X15 checks "same 34 monsters, same nodes, same coordinates" against the arrays at `1284a6e` (design 5.7 lists the known dry and buried fishing spots, which these tests allow).
- **Accept**: red until X15, then `ONE(tests/placements.test.ts)` passes.
- **Must not change**: `src/`.

### X15 Placement table and spawns [AGY]
- **Tier**: sonnet (data transcription plus a move).
- **Depends**: X14.
- **Files**: `src/data/placements.ts` (new), `src/engine/spawns.ts` (new), `src/engine/runtime.ts`.
- **Change**: transcribe the arrays of `spawnAllResourcesAndMonsters` (3553-3590) into `MONSTER_PLACEMENTS` and `NODE_PLACEMENTS`, in the same order. Move `spawnMonster`, `spawnResourceNode` and `spawnAllResourcesAndMonsters` (3377-3551) to `spawns.ts`. Its loop now iterates the two tables, all monsters first and then all nodes. Within each kind the order is today's; the interleaving of monsters and nodes is not kept (they live in separate lists, `G.monstersList` and `G.resourceNodesList`, and `worldInteractiveObjects` order matters only for two hits at exactly the same ray distance). Then the Type commit.
- **Accept**: `ONE(tests/placements.test.ts)` passes, then SG. The opus verify counts 34 monster rows and compares both tables row by row with `1284a6e` 3553-3590.
- **Must not change**: the order within each kind, coordinates, the async GLTF upgrade.

### X17 `getEquipmentBonuses` to `src/state/combat.ts` [AGY]
- **Tier**: sonnet (move of pure arithmetic).
- **Depends**: X16.
- **Files**: `src/state/combat.ts`, `src/engine/runtime.ts`, plus import lines in already-extracted engine modules.
- **Change**: move `getEquipmentBonuses` (202-263) as `getEquipmentBonuses(state: GameState)`. Callers pass `STATE`. It is typed on arrival, because `combat.ts` has no pragma.
- **Accept**: SG. The layering test still passes.
- **Must not change**: the set-bonus rules or the rounding.

### X24 Monster-step tests, Stage 1 shape [CLAUDE]
- **Tier**: sonnet (written from the transition table in design 5.4).
- **Depends**: X23.
- **Files**: `tests/monster-ai.test.ts` (new).
- **Change**: tests against `src/state/monsterAi.ts`. Create logic only through `createMonsterLogic(typeKey: string, homeX: number, homeZ: number, opts?: { campId?: string; wander?: number }): MonsterLogic`. Build `world` with the Stage 1 fields only: `{ playerX, playerZ, playerDown, dt, rand }`. Stage 2 adds optional fields only, so these tests stay valid. Every test name here is checked against Stage 2 transitions T1-T9: only "combat drops beyond 26" changes meaning, and it is the declared replacement #3. The player-down rule is not tested here for that reason (in Stage 2 it leads to `return`, not `idle`); CP-1 covers it. Use a seeded `rand`. Tests:
  - `a passive monster stays idle for 60 simulated seconds without a hit`
  - `onPlayerHit with dmg 0 sends idle to chase`
  - `onPlayerHit reduces hp`
  - `chase becomes attack within 2.9 for melee and 11.0 for ranged or magic`
  - `attack returns to chase beyond range`
  - `first attack event is immediate, then every 1.65 s`
  - `combat drops beyond 26 with HP kept` (planned replacement #3, see A5)
  - `hp 0 enters dying and emits died`
  - `dying lasts 0.85 s, dead lasts 7.5 s, then idle at home with full HP`
  - `idle wanders within 4.5 of home at 1.8 units/s`
- **Accept**: red until X25.
- **Must not change**: `src/`.

### X25 Reshape: monster rules behind `stepMonster` and `onPlayerHit` [CLAUDE]
- **Tier**: opus. This is [CLAUDE] because mapping four flags across six modules and the loop needs reading and judgment that a prompt cannot fully specify, and it is the one Stage 1 change that alters how behaviour is expressed; by the tier table that is opus. A separate opus verify still checks it.
- **Depends**: X24.
- **Files**: `src/state/monsterAi.ts` (new), `src/engine/spawns.ts`, `src/engine/monsterMeshes.ts`, `src/engine/overlay.ts`, `src/engine/actions.ts`, `src/engine/input.ts` (click and hover reads, `1284a6e` 3869, 3921, 4039), `src/ui/hud.ts` (`updateTargetHud`, 4062), `src/engine/context.ts` (the `MonsterEntity` type), `src/engine/runtime.ts`.
- **Change**: Reshape commit (design 5.4).
  - `createMonsterLogic(typeKey, homeX, homeZ, opts?)` as X24 names it; `spawns.ts` calls it in `spawnMonster`.
  - `type MonsterLogic` has the fields in 5.4 and `state: 'idle'|'chase'|'attack'|'dying'|'dead'`.
  - `stepMonster(m: MonsterLogic, world: StepWorld): MonsterEvent[]`, where `MonsterEvent = { kind: 'attack'|'died'|'respawned' }`.
  - `onPlayerHit(m: MonsterLogic, dmg: number): { applied: boolean; events: MonsterEvent[] }`.
  - The monster entity holds `logic: MonsterLogic`. The rules in the loop (5787-5878) call `stepMonster` with `rand = Math.random` and apply its events: `attack` runs `performMonsterRetaliation`, `respawned` shows the rig, and `state` selects the pose.
  - `applyDamage` (4842-4850) calls `onPlayerHit`, and `died` runs today's drops and XP.
  - The player-death loop at 5039 is removed, because the `playerDown` rule replaces it.
  - The monster fields `inCombatWithPlayer`, `dead`, `isDying` and `dyingTimer` are replaced by `logic.state` at every read. At `1284a6e` the reads are at 3304, 3356 (`monsterMeshes`), 3869, 3921, 4039 (`input`), 4062 (`hud`), 4748-5039 (`actions`), 5183, 5293, 5320 (`overlay`), 5462 and 5789-5831 (loop, still in `runtime.ts`). Resource nodes are not monsters; their own fields are untouched.
  - `m.wanderTarget` (a `THREE.Vector3`, 5857) becomes `logic.wanderX` and `logic.wanderZ`, since `src/state` may not import `three`.
  - The engine copies `logic.x` and `logic.z` to `rig.group.position` after each step.
- **Accept**: `ONE(tests/monster-ai.test.ts)` passes, then SG (the layering test included). `grep -rn "inCombatWithPlayer\|isDying\|dyingTimer\|wanderTarget" src` prints nothing. The opus verify reads every former `.dead` read on a monster entity.
- **Must not change**: speeds, ranges, timers, or the retaliation formulas.

### X26 Move the loop to `src/engine/loop.ts` [AGY]
- **Tier**: sonnet (cut into named functions in a fixed order).
- **Depends**: X25.
- **Files**: `src/engine/loop.ts` (new), `src/engine/runtime.ts`.
- **Change**: Move commit, then Type commit. Move `lerpAngle` and `gameLoop` (5359-5980). Cut the body into `updateVitalsAndRegen`, `updatePlayerIntent`, `updatePlayerMotion`, `updatePlayerAnimation`, `updateCamera`, `updateMonsters`, `updateWorldTimers`, `updateOverlay`, `renderFrame`, called in that order from `gameLoop`. Every local that one block writes and a later block reads goes into one object `f: FrameState`, declared in `loop.ts` and created at the top of `gameLoop` (`now`, `dt`, and those locals). Each function takes `f` as its only parameter. Locals used by one block only stay local to its function. `updateCapePhysics` stays inside `updatePlayerAnimation`.
- **Accept**: SG. `loop.ts` is under 1000 lines.
- **Must not change**: statement order within the frame, or `dt` handling. The talk-to-guard null dereference stays until L6.

### X27 Source-limit and globals tests [CLAUDE]
- **Tier**: sonnet (written from G1.1, G1.2 and G1.4).
- **Depends**: X26.
- **Files**: `tests/source-limits.test.ts`, `tests/globals.test.ts` (new).
- **Change**:
  - `source-limits`: `no ts file under src exceeds 1000 lines`; `no file under src contains @ts-nocheck or @ts-ignore`.
  - `globals`: `every function named in an index.html onclick is in WINDOW_GLOBALS`. It reads every `onclick` attribute in `index.html` and collects every call `name(` in it, where `name` is an identifier that may contain digits (`cheatGold200k`) and is not preceded by a dot, so `event.stopPropagation(); resetCameraBehindPlayer()` yields `resetCameraBehindPlayer` only. It imports `WINDOW_GLOBALS` from `src/engine/runtime.ts`.
- **Accept**: red until X28 and X29.
- **Must not change**: `src/`.

### X28 Type `src/ui/icons.ts` [AGY], parallel cluster XI
- **Tier**: sonnet (typing one 191-line file).
- **Depends**: X02. This task touches only `icons.ts`, so it can run in its own worktree during the spine. Cut the worktree from a green spine head (after X02, X06, X13, X15 or X23, never inside a test-first red window: X14-X15, X24-X25, X27-X29), so its SG can pass. It merges before X29.
- **Files**: `src/ui/icons.ts`.
- **Change**: remove `// @ts-nocheck` and add types. Behaviour unchanged.
- **Accept**: SG.
- **Must not change**: the SVG strings or the exported names.

### X29 What remains of `runtime.ts` [AGY]
- **Tier**: sonnet (typing the remainder and adding one list).
- **Depends**: X27, X28.
- **Files**: `src/engine/runtime.ts`.
- **Change**: what is left is `wireBridge` and `boot`. Export `WINDOW_GLOBALS: readonly string[]`, the names `wireBridge` assigns to `window`. Assign them in one loop over a name-to-function record, so the list and the assignments cannot drift apart. Remove the pragma and type the file. The Type commit message names `#20` and `#38`.
- **Accept**: `ONE(tests/source-limits.test.ts)` and `ONE(tests/globals.test.ts)` pass, then SG. `wc -l src/engine/runtime.ts` is under 200. This closes **finding 38** (with X28) and the typing part of **finding 20**.
- **Must not change**: the set of `window.*` names, `bridge.*` bindings, `window.__DEV_ACCESS__`, `window.__DEBUG`.

### X30 Spine verification [CLAUDE]
- **Tier**: opus (verification).
- **Depends**: X29.
- **Files**: none (a report in the session).
- **Change**: nothing. Check:
  - every Move commit with `--color-moved`;
  - every Type commit for logic changes;
  - the total `any` count, and that each one sits at an allowed seam;
  - that `git diff 1284a6e -- tests src/__tests__` shows only added files;
  - SG, with the test count at 103 plus the new tests;
  - the BUILD JS chunk within 10 kB of 926.36 kB.
- **Accept**: a written pass, or a list of defects that go back to the task that caused each one.
- **Must not change**: anything; the task is read-only.

### CP-1 "Same game?" checkpoint [HUMAN]
- **Depends**: X30.
- **Do**: at noon, take screenshots from the two `window.__DEBUG` poses and compare them side by side with `docs/superpowers/baseline/shot-03-noon.jpg` and `shot-04-peak.jpg`. Grass blade positions may differ; nothing else may. Check the perf HUD at both poses against the baseline, within 2%. Then run the smoke list in design 5.7 except the items that later fixes change: talking to a guard still throws, and typing in the bank search still moves the hero.
- **Accept**: recorded in the pull request draft. A difference is a spine defect, fixed before any fix cluster merges.

---

## 1.2 Fix preparation (serial, before the clusters split)

### F01 Disposal helper tests [CLAUDE]
- **Tier**: sonnet (spec below).
- **Depends**: X30.
- **Files**: `tests/dispose.test.ts` (new).
- **Change**: tests against `src/engine/dispose.ts`, `disposeObject3D(root: Object3D, keep?: (m: Material) => boolean): void`. Tests:
  - `disposes every geometry under root once`
  - `disposes materials unless keep returns true`
  - `never disposes the shared outline material`
  - `detaches root from its parent`
  
  Spy on `dispose` with `vi.fn`.
- **Accept**: red until F02.
- **Must not change**: `src/`.

### F02 Disposal helper [AGY]
- **Tier**: sonnet.
- **Depends**: F01.
- **Files**: `src/engine/dispose.ts` (new), `src/engine/materials.ts` (export `isSharedOutlineMaterial(m)`, which reads `outlineCache`).
- **Change**: traverse `root`. Dispose each geometry. Dispose each material (array or single) unless it is a shared outline material or `keep(m)` returns true. Textures are never disposed (they are cached in `textures.ts`). Remove `root` from its parent.
- **Accept**: `ONE(tests/dispose.test.ts)` passes, then SG.
- **Must not change**: `outlineCache` behaviour.

---

## 1.3 Fix clusters (parallel worktrees, merged after CP-1)

### Cluster S: save hardening and shop (`save.ts`, `inventory.ts`, `session.ts`, `ui/stations.ts`)

#### S1 Save tests [CLAUDE]
- **Tier**: sonnet (spec in design 5.5 and G1.5).
- **Depends**: F02, PRE-1 fixture.
- **Files**: `tests/save-hardening.test.ts`, `tests/fixtures/save-hostile.json` (new).
- **Change**: tests:
  - `writeSave then readSave round-trips gp, skills, bank, slayer task, claimed quests, prayers, spell and special energy` (**finding 10**)
  - `the captured version-4 save loads to its recorded values` (assert the values read from `save-v4.json`)
  - `hostile save: Infinity position becomes finite and walkable`
  - `position inside the castle keep is moved to walkable ground`
  - `position in the river is moved to walkable ground`
  - `unknown region becomes lumbridge`
  - `constructor as an item or equipment id is dropped` (**finding 2**)
  - `slayer task name comes from the catalog, not the save` (**finding 1**)
  - `qty 1e999 and gp 1e308 are finite and at most 2147483647` (the `1e999` slot is dropped)
  - `a slot with no qty still loads with qty 1`
  - `unknown activeSpell becomes wind_strike`
  - `unknown claimed quest ids are dropped and duplicates removed`
  - `non-integer or negative timeOfDay becomes 0`
  - `readSave copies a non-parsing main save to gielinor_hero_save_v1_corrupt and reports corrupt`
  - `readSave does not overwrite an existing corrupt backup`
  - `a corrupt main save next to a valid legacy save reports corrupt and does not load the legacy save`
  - `every valid save reports corrupt false`
  
  Storage is an in-memory `StorageLike`.
- **Accept**: red until S2. Existing `phase1.test.ts` save tests are untouched.
- **Must not change**: `src/`; the save tests in `tests/phase1.test.ts`.

#### S2 Save hardening [AGY]
- **Tier**: sonnet (field table given in design 5.5).
- **Depends**: S1.
- **Files**: `src/state/save.ts`, `src/state/inventory.ts` (`compactSlots` only), `src/engine/session.ts`.
- **Change**: commit by commit:
  1. **Finding 2**: `Object.hasOwn(ITEMS, id)` in `compactSlots` and in the equipment loop of `migrateLegacySave`. `qty`: a missing, zero or `NaN` value keeps today's default of 1 (`Number(slot.qty) || 1`, `inventory.ts` 73), so legacy slots without `qty` still load; `Infinity` or `-Infinity` drops the slot; any other value is floored and clamped to 1..2147483647.
  2. **Finding 1**: keep `quests.slayer` only when `monster` is in `SLAYER_BANDS`, and take `name` from the catalog.
  3. The rest of the 5.5 table inside `migrateLegacySave`:
     - `gp`: `Number.isFinite`, floor, clamp 0..2147483647.
     - `hp`, `prayerPts`, `specEnergy`: finite, then today's clamps.
     - `currentRegion`: must be in `WORLD_REGIONS`.
     - `timeOfDay`: integer 0..2.
     - `activeSpell`: must be a combat spell in `SPELLS`, else `wind_strike`.
     - `quests.claimed`: filter by `QUEST_DEFS` ids and deduplicate.
  4. **Saved-position defect**: `sanitizePose` requires finite `x` and `z`, clamps them to ±118, and returns the point unchanged if `isWalkable`. Otherwise it searches rings of radius 0.5..12 in 0.5 steps, 24 angles each, and returns the first walkable point; failing that, the home respawn point (0, 4) (`finishRespawn` uses the Lumbridge centre plus 4 on z). `migrateLegacySave` applies it, and the `sanitizePose` call that X20 put in `loadGameState` is removed, so the pose is validated once, at the boundary.
  5. **Corrupt-save guard**: `MigratedSave` gains `corrupt: boolean`. `readSave` follows design 5.5 (backup only if the key is empty, no legacy fallback).
  6. In `session.ts`: when `corrupt` is true, print one chat line naming `gielinor_hero_save_v1_corrupt`; the autosave's empty `catch` sets the save button text to "Save failed"; an exception thrown by `applyState` is reported with `console.error`.
- **Accept**: `ONE(tests/save-hardening.test.ts)` passes, then SG. The `phase1.test.ts` save tests are unchanged and pass.
- **Must not change**: `SAVE_KEY`, `version` 4, `serializeState` output keys, legacy keys.

#### S3 Shop gathered-goods test [CLAUDE]
- **Tier**: sonnet.
- **Depends**: S2, **O-4** (Q3).
- **Files**: `tests/shop-gathered.test.ts` (new).
- **Change**: `buyItem refuses ore, raw fish, logs, bars and bones` (one id of each, taken from `isGatheredGood`); `buyItem still sells runes and arrows`. If the owner answers "leave it open", skip S3 and S4, and the ledger moves **finding 6** to Stage 3.
- **Accept**: red until S4.
- **Must not change**: `src/`.

#### S4 Block buying gathered goods [AGY] (**finding 6**)
- **Tier**: sonnet.
- **Depends**: S3.
- **Files**: `src/state/inventory.ts` (`buyItem`), `src/ui/stations.ts` (shop renderer: hide the buy buttons of gathered goods).
- **Change**: `buyItem` returns a refusal result for `isGatheredGood(id)`. The shop does not render buy buttons for those rows. Selling them is unchanged.
- **Accept**: `ONE(tests/shop-gathered.test.ts)` passes, then SG. `src/__tests__/bulk-buy.test.ts` passes unchanged.
- **Must not change**: prices, sell rate, the rest of the `stations.ts` rendering (finding 24 is deferred).

### Cluster P: pure rules (`adventure.ts`, `recipes.ts`)

#### P1 Rule tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: X30.
- **Files**: `tests/rule-fixes.test.ts` (new).
- **Change**: `resolveDragonfire returns reduced damage with the ward flag and no shield` (**finding 7**); `crafting succeeds when consuming the inputs frees the slot for the output` (**finding 8**; fill all 28 slots, with the inputs taking exactly the slots needed).
- **Accept**: red until P2 and P3.
- **Must not change**: `src/`.

#### P2 Dragonfire ward [AGY] (**finding 7**)
- **Tier**: sonnet.
- **Depends**: P1.
- **Files**: `src/state/adventure.ts`.
- **Change**: in `resolveDragonfire`, `absorbed` becomes `state.quests.dragonfireWard || state.activePrayers.has('prot_magic') || DRAGONFIRE_WARDS.includes(shield)` (audit finding 7). The damage rule is unchanged: absorbed keeps 25%. The P1 test asserts `resolveDragonfire(100, s).damage === 25` with the flag set and no shield.
- **Accept**: the P1 dragonfire test passes, then SG.
- **Must not change**: the shield's own reduction and the dragonfire roll.

#### P3 Craft capacity [AGY] (**finding 8**)
- **Tier**: sonnet.
- **Depends**: P1.
- **Files**: `src/data/recipes.ts`.
- **Change**: `tryCraft` removes the inputs on a scratch copy of the backpack, then checks capacity for the output on that copy. It commits only on success.
- **Accept**: the P1 craft test passes, then SG.
- **Must not change**: recipe inputs, outputs and XP (finding 9 is deferred).

### Cluster L: loop, VFX, player mesh, HUD (`loop.ts`, `vfx.ts`, `playerMesh.ts`, `monsterMeshes.ts`, `hud.ts`, `playerActions.ts`, `runtime.ts`, `context.ts`, `actions.ts`)

#### L1 VFX and projectile disposal [AGY] (**finding 11**)
- **Tier**: sonnet.
- **Depends**: F02.
- **Files**: `src/engine/loop.ts`, `src/engine/vfx.ts`.
- **Change**: where `vfxList` and `projectilesList` entries expire (in `updateWorldTimers` or wherever X26 put the 5891-5923 block), call `disposeObject3D(mesh)` instead of `scene.remove(mesh)`, with no `keep`: `vfx.ts` has no module-level geometry or material cache, and `glowMaterial` returns a new material per call (audit finding 11 confirms both). For a projectile, dispose after `p.onImpact()` runs, not before. This includes the lava-cape embers, which go through `spawnBurst`.
- **Accept**: SG. `grep -c 'disposeObject3D(' src/engine/loop.ts` prints at least 2 (VFX and projectiles; the import line has no parenthesis, so it does not count). The leak check is on G-2.
- **Must not change**: effect timings and looks; only disposal changes.

#### L2 Fireworks through `spawnVfx` [AGY] (**finding 16**)
- **Tier**: sonnet.
- **Depends**: L1.
- **Files**: `src/engine/vfx.ts`.
- **Change**: `spawnLevelUpFireworks` registers its particles as `vfxList` entries with an update callback that uses frame `dt`. The private `requestAnimationFrame` loop is removed.
- **Accept**: SG. `grep -c requestAnimationFrame src/engine/vfx.ts` prints `0`.
- **Must not change**: the fireworks' look, particle count and lifetime.

#### L3 Player gear disposal [CLAUDE] (**findings 17, 26**, player part)
- **Tier**: sonnet. This is [CLAUDE] because deciding which gear geometry and materials are shared with GLB templates needs reading `playerGear.ts` and `blenderGear.ts`.
- **Depends**: F02.
- **Files**: `src/engine/playerMesh.ts`.
- **Change**: in `rebuildPlayerEquipmentMeshes`, every detached gear node goes through `disposeObject3D`. Starting facts from audit findings 17 and 26, to confirm by reading `playerGear.ts` and `blenderGear.ts`: `cloneBlenderGearNode` clones each mesh's geometry (`blenderGear.ts` 97) and creates new materials per call (75-92); `albedoMaterial` and `facetMaterial` return a new material per call, and textures are cached (the helper never disposes textures); outline shells share their mesh's geometry and use the shared outline material (kept by the helper). Anything found to be shared with a live template or cache goes in `keep`; the opus verify checks each `keep` rule against the code.
- **Accept**: SG. `grep -c 'disposeObject3D(' src/engine/playerMesh.ts` prints at least 1 (a call, not the import). The 20-swap leak check is on G-2.
- **Must not change**: gear visuals, the outline shells, the GLB templates.

#### L4 Turn-velocity wrap [AGY] (**finding 15**)
- **Tier**: sonnet.
- **Depends**: L3.
- **Files**: `src/engine/loop.ts`.
- **Change**: delete the two lines that wrap the turn velocity (rad/s) against π, in the bank and cape roll block (around 5572-5588).
- **Accept**: SG. `git diff HEAD~1 --numstat -- src/engine/loop.ts` shows 0 added and 2 deleted lines; the opus verify confirms they are the two wrap lines.
- **Must not change**: anything else in the bank and cape block.

#### L5 Frame-loop waste [AGY] (**finding 21**, the rest)
- **Tier**: sonnet.
- **Depends**: L4.
- **Files**: `src/engine/loop.ts`, `src/engine/context.ts`, `src/engine/monsterMeshes.ts`, `src/engine/vfx.ts`.
- **Change**:
  - `getEquipmentBonuses(STATE)` is computed once per frame and passed to the blocks that used it (5382, 5384).
  - The per-frame `new THREE.Vector3` allocations in the loop (`1284a6e` 5636 ember offset, 5904 projectile look-ahead, 5908 up axis) become scratch vectors exported from `context.ts`, set with `.set(...)` or `.copy(...)`.
  - Fixed-factor damping becomes frame-time damping with the audit's formula: `x *= f` becomes `x *= Math.pow(f, dt * 60)`, which equals `f` at 60 Hz. The sites: `poseMonsterLimbs` leg pivots `*= 0.86` (3370-3371; the function already takes `dt`); the player's idle legs and knees `*= 0.85` (5689-5692) and torso `*= 0.88` (5695); the yaw velocity blend `v * 0.8 + turnDelta * 0.2` (5583) becomes `a = Math.pow(0.8, dt * 60); v = v * a + turnDelta * (1 - a)`. The `vfx.ts` sigil spin `v.mesh.rotation.z += 0.02` (4448) becomes `v.mesh.rotation.z = v.age * 1.2` (0.02 rad per frame at 60 Hz; the sigil starts at 0). No other site changes; finding 14's special-attack spin (5743) is deferred.
- **Accept**: SG. `grep -c 'getEquipmentBonuses(' src/engine/loop.ts` prints 1. `grep -c 'new THREE.Vector3' src/engine/loop.ts` prints 0. The opus verify confirms each listed site and no other.
- **Must not change**: the look at 60 Hz: each damping factor at 60 Hz equals today's.

#### L6 Talk-to-guard null dereference [AGY]
- **Tier**: sonnet (one-line reorder).
- **Depends**: L5.
- **Files**: `src/engine/loop.ts`.
- **Change**: in the interactive branch (5494-5506), read `player.targetEntity.ref` into a local before setting `player.targetEntity = null`. The `dialogue` branch uses the local.
- **Accept**: SG. The opus verify confirms the `dialogue` branch reads the local and not `player.targetEntity`. On G-2, talking to a guard shows the guard's line.
- **Must not change**: the other interactive branches.

#### L7 Vitals at 10 Hz, no save in `updateAllUI` [AGY] (**finding 12**)
- **Tier**: sonnet.
- **Depends**: L6.
- **Files**: `src/ui/hud.ts`, `src/ui/playerActions.ts` (`grantXp` only), `src/engine/loop.ts`, `src/engine/runtime.ts`, `src/engine/actions.ts`.
- **Change**:
  - `updateAllUI` no longer calls `saveGameState`.
  - New `updateVitalsBars()` in `hud.ts` updates only the HP, prayer and special-energy bars. `updateOverlay` calls it every 0.1 s.
  - `boot()` registers a `visibilitychange` listener on `document` that saves when the page becomes hidden.
  - One full HUD rebuild per hit (design section 8): new `requestUiRefresh(): void` in `hud.ts` sets a dirty flag. The calls to `updateAllUI` inside `grantXp` (it runs 2 to 4 times per hit, `1284a6e` 290), `performPlayerAttack`, `handleMonsterDeath` and `performMonsterRetaliation` become `requestUiRefresh()`. `updateOverlay` runs `updateAllUI` once in a frame when the flag is set, then clears it.
  
  The README sentence is changed in D3.
- **Accept**: SG. `grep -n saveGameState src/ui/hud.ts` prints nothing. The opus verify confirms that the four functions call `requestUiRefresh` and no longer call `updateAllUI`, and, as audit finding 12 asks, that no caller of those four reads DOM that `updateAllUI` builds in the same tick (for example a modal opened right after `grantXp` that reads the inventory grid). Vitals moving during regeneration is on G-2.
- **Must not change**: the 2 s autosave, the `beforeunload` and manual saves, what `updateAllUI` draws.

### Cluster M: world build and model loaders (`worldBuild.ts`, `blender*.ts`, new `gltf.ts`, guard assets)

#### M1 GLTF loader test [CLAUDE]
- **Tier**: sonnet.
- **Depends**: X30.
- **Files**: `tests/gltf-loader.test.ts` (new).
- **Change**: tests against `src/engine/gltf.ts`, `loadGltfOnce(url: string, load?: (url: string) => Promise<GLTF>): Promise<GLTF | null>`.
  - `returns the same promise for repeated calls`
  - `a failed load resolves null and the next call retries` (stub rejects once, then resolves)
  - `concurrent calls during a load share it`
- **Accept**: red until M2.
- **Must not change**: `src/`.

#### M2 One shared loader [AGY] (**finding 28**)
- **Tier**: sonnet.
- **Depends**: M1.
- **Files**: `src/engine/gltf.ts` (new), `src/engine/blenderHero.ts`, `src/engine/blenderGear.ts`, `src/engine/blenderMonsters.ts`, `src/engine/blenderWorld.ts`, `src/engine/worldBuild.ts`.
- **Change**: `loadGltfOnce` keeps a per-URL promise map and deletes the entry when a load fails (and resolves `null` for that call, logging with `console.warn` as the loaders do today). It has no `typeof window` check, so the M1 tests run in node with a stub `load`. The default `load` wraps `GLTFLoader.loadAsync`. The five public loaders (`loadBlenderHeroTemplate`, `loadBlenderGearTemplate`, `loadBlenderMonstersTemplate`, `loadBlenderWorldTemplate`, `loadBlenderGuardTemplate`) keep their names, signatures, default URLs and their `typeof window === 'undefined'` early return, and call `loadGltfOnce(url)` after it. Their private `cached*Promise` variables are removed. `loadBlenderGearTemplate` keeps setting `loadedGearRoot = gltf.scene` on success (through `.then`).
- **Accept**: `ONE(tests/gltf-loader.test.ts)` passes, then SG (`src/__tests__/blender-hero.test.ts` unchanged and green).
- **Must not change**: URLs, including the `?v=` cache keys; the exported names of the five loaders; `setBlenderGearRoot` and `hasBlenderGearTemplate`.

#### M3 Slayer-master gear disposal [CLAUDE] (**findings 17, 26**, slayer-master part)
- **Tier**: sonnet (same judgment as L3).
- **Depends**: M2, and L3 merged into `feat/world-foundation` (M3 reuses its `keep` rules), so M3 is cut from the stage branch after the L merge and does not run in parallel with L3.
- **Files**: `src/engine/worldBuild.ts`.
- **Change**: `attachVannakaGear` disposes the gear it replaces through `disposeObject3D`, using the same `keep` rules as L3.
- **Accept**: SG. `grep -c 'disposeObject3D(' src/engine/worldBuild.ts` prints at least 1 (a call, not the import). The leak check is on G-2.
- **Must not change**: the slayer master's gear choice or look.

#### M4 Guard asset, licence-dependent [AGY] (**finding 35**, code part)
- **Status**: CANCELLED. The licence was found (Blend Swap blend 28541, "Rigged Knight in Armor" by Xali, CC0), so the guard stays and there is no code change. Finding 35 closes through D1 and D2. The text below is kept for the record only.
- **Tier**: sonnet.
- **Depends**: none. **Not run.**
- **Files** (only if the owner has no licence): `src/engine/worldBuild.ts`, `public/models/guard.glb` (delete), `blender/examples/knight_28541/` (delete), `scripts/blender/export_guard.py` (delete).
- **Change**: if Q1 gives a licence, there is no code change; the text is in D2. If not, delete the files above, and `createCastleGuard` builds the two guards from `buildHumanoidRig` with existing gear visuals, the way `createMerchantNPC` does, keeping the hitbox, `userData`, the dialogue text and `npcList` entries. `loadBlenderGuardTemplate` is deleted.
- **Accept**: SG. `test ! -e public/models/guard.glb` (no-licence case).
- **Must not change**: the guards' positions, dialogue, hitbox and `npcList` labels.

### Cluster R: renderer (`renderer.ts`)

#### R1 Outline flag [AGY] (**finding 19**)
- **Tier**: sonnet.
- **Depends**: X30.
- **Files**: `src/engine/renderer.ts`.
- **Change**: `outlinesEnabled` starts `false`, matching what is drawn.
- **Accept**: SG. The `outlinesEnabled` declaration in `renderer.ts` initialises it to `false`.
- **Must not change**: the outline shells and `toggleOutlines`.

#### R2 Shadow resolution [AGY] (**finding 13**)
- **Tier**: sonnet.
- **Depends**: R1, **O-7** (Q8).
- **Files**: `src/engine/renderer.ts`.
- **Change**: owner keeps 2048 (CALL-3): in `applyQualityTier`, delete the two lines that pick and set a per-tier size (`1284a6e` 1193-1194: `const res = tier === 'ultra' ? 2048 : (tier === 'high' ? 2048 : 1024)` and `sunLight.shadow.mapSize.set(res, res)`); the 2048 set in `init3DEngine` (1311-1312) stays, so every shadowed tier uses 2048, and tiers change only pixel ratio and shadows on or off. Owner picks 1024: `applyQualityTier` sets `sunLight.shadow.mapSize` from the tier table, then disposes and nulls `shadow.map` so it is recreated, and the hard-coded 2048 in `init3DEngine` is removed.
- **Accept**: SG. 2048 case: no quality-tier entry carries a shadow size, and `grep -n 1024 src/engine/renderer.ts` prints nothing. 1024 case: the opus verify confirms `applyQualityTier` sets `mapSize` and recreates the map. Screenshots are on G-2.
- **Must not change**: pixel-ratio rules and which tiers have shadows.

### Cluster I: input and CSS (`input.ts`, `styles.css`)

#### I1 Key handler ignores text inputs [AGY] (**finding 22**)
- **Tier**: sonnet.
- **Depends**: X30.
- **Files**: `src/engine/input.ts`.
- **Change**: in the `keydown` and `keyup` listeners, after the Escape branch, return early when the event target is an `input`, a `textarea` or `isContentEditable`. Keys typed into a text field no longer reach `noteCheatKey`; the cheat box keeps its own submit path (`applyTypedCheat`).
- **Accept**: SG. `grep -c isContentEditable src/engine/input.ts` prints at least 1. The "wasd f" check is on G-2.
- **Must not change**: the Escape branch and game keys outside text fields.

#### I2 Inputs are selectable [AGY] (**finding 25**)
- **Tier**: sonnet fallback (one CSS rule).
- **Depends**: I1.
- **Files**: `src/ui/styles.css`.
- **Change**: after the global `*` rule, add one rule that makes `input` and `textarea` elements selectable again (`user-select` and its `-webkit-` form set to `text`).
- **Accept**: BUILD passes.
- **Must not change**: any other CSS rule.

### Cluster T: tooling and deployment (`scripts/run-blender.mjs`, `vercel.json`, `.gitignore`, `blender/examples/amulet_15782/`, `package.json`, `package-lock.json`, `vite.config.ts`, `.github/workflows/ci.yml`)

#### T1 `run-blender` tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: X30.
- **Files**: `tests/run-blender.test.ts` (new).
- **Change**: each test writes a stub executable (a `#!/usr/bin/env node` script that appends its argv as one JSON line to a file, then exits with `STUB_EXIT`, or kills itself with `process.kill(process.pid, 'SIGKILL')` when `STUB_SIGNAL=1`) into a temporary directory, sets mode 0o755, and runs `process.execPath scripts/run-blender.mjs <mode>` with `spawnSync`, `BLENDER_PATH` pointing at it, and a `PATH` limited to the node binary's directory. Tests:
  - `exits non-zero when the binary is missing` (`BLENDER_PATH` set to a missing path; the Windows candidates do not exist on Linux, so the fallback `blender` is looked up on the limited `PATH` and fails)
  - `exits non-zero when the stub exits 3` (mode `hero`)
  - `exits non-zero on an unknown mode` (mode `no_such_mode`)
  - `passes --disable-autoexec and --python-exit-code 1 on every spawn`: modes `hero`, `all` (four argv lines), `export knight` and `open hero` (detached: poll the argv file for up to 2 s). In every argv line, `--disable-autoexec` comes before any `.blend` path and `--python-exit-code 1` comes before `--python`, because Blender applies its arguments in order.
  - `exits non-zero when the child is killed by a signal`
- **Accept**: red until T2.
- **Must not change**: `scripts/`.

#### T2 `run-blender` exit codes and flags [AGY] (**findings 4, 36**)
- **Tier**: sonnet.
- **Depends**: T1.
- **Files**: `scripts/run-blender.mjs`.
- **Change**:
  - Commit 1 (**#4**): every `spawn` and `spawnSync` gets `--disable-autoexec` as an argument placed before the `.blend` path (`open`: `[ '--disable-autoexec', blendFile ]`; `export`: `[ '--background', '--disable-autoexec', blendFile, ... ]`; build modes: right after `--background`).
  - Commit 2 (**#36**): `--python-exit-code 1` placed before `--python` in every `spawnSync`. A spawn error, a signal or a non-zero status exits non-zero; `res.status ?? 0` becomes an explicit check of `res.error`, `res.signal` and `res.status`. A mode that is neither a known key nor an existing file prints the valid modes and exits 2.
- **Accept**: `ONE(tests/run-blender.test.ts)` passes, then SG.
- **Must not change**: the Blender Python scripts and the meaning of each mode.

#### T3 Deployment header test [CLAUDE]
- **Tier**: sonnet.
- **Depends**: X30, **O-5**.
- **Files**: `tests/vercel-headers.test.ts` (new).
- **Change**: `vercel.json sends nosniff, strict-origin-when-cross-origin and the frame-ancestors policy on every path`; `assets under /assets are immutable for one year`; `no immutable caching outside /assets`. The `frame-ancestors` value follows Q5.
- **Accept**: red until T4.
- **Must not change**: `vercel.json`.

#### T4 Headers and caching [AGY] (**findings 5, 41**)
- **Tier**: sonnet.
- **Depends**: T3.
- **Files**: `vercel.json`.
- **Change**: commit 1 (**#5**): a `headers` block for `/(.*)` with `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Content-Security-Policy: frame-ancestors 'self'` (plus any site named in Q5). Commit 2 (**#41**): `/assets/(.*)` gets `Cache-Control: public, max-age=31536000, immutable`.
- **Accept**: `ONE(tests/vercel-headers.test.ts)` passes.
- **Must not change**: `framework`, `buildCommand`, `outputDirectory`.

#### T5 Repository weight [AGY] (**finding 42**)
- **Tier**: sonnet fallback (delete one folder, add one rule).
- **Depends**: X30.
- **Files**: `blender/examples/amulet_15782/` (delete), `.gitignore`.
- **Change**: delete the unused amulet folder. Add `!blender/examples/Game Anime RPG Character.zip` after `*.zip`. No Git LFS and no history rewrite (CALL-12).
- **Accept**: `git check-ignore -q --no-index "blender/examples/Game Anime RPG Character.zip"` exits 1 (without `--no-index`, a tracked file is never reported as ignored, so the check passes today with no change). `test ! -e blender/examples/amulet_15782` succeeds and `git ls-files blender/examples/amulet_15782` prints nothing (the old `grep -rn amulet_15782 scripts src` check already prints nothing today).
- **Must not change**: any other file under `blender/`.

#### T6 Dev dependency bump [AGY] (**finding 37**)
- **Tier**: sonnet (version bump plus config fallout).
- **Depends**: T5, **O-8**.
- **Files**: `package.json`, `package-lock.json`, `vite.config.ts` (only if the vitest 4 config API requires it).
- **Change**: move vite and vitest to the first versions that `npm audit` accepts (vite 6.4.4 or later, vitest 4.x). Keep `environment: 'node'` and the test include globs.
- **Accept**: `npm audit --audit-level=high` exits 0. SG with all tests passing; the count is unchanged by this task.
- **Must not change**: any test file. A test that breaks under vitest 4 is a stop-and-report for the opus verify, never an edit.

#### T7 CI workflow [AGY] (**finding 43**)
- **Tier**: sonnet.
- **Depends**: T6.
- **Files**: `.github/workflows/ci.yml` (new).
- **Change**: on `push` and `pull_request`: checkout; `actions/setup-node` with Node 22 and npm cache; `npm ci`; run the package's `test` script; run the package's `build` script. The memory wrapper in 0.2 is for this machine, not for the CI runner.
- **Accept**: the opus verify reads the workflow against this spec. The CI run on the Stage 1 pull request is green (G-1).
- **Must not change**: `package.json` scripts.

### Cluster D: docs, credits, licence (`README.md`, `CREDITS.md`, `index.html`)

#### D1 Credits test [CLAUDE]
- **Tier**: sonnet.
- **Depends**: X30.
- **Files**: `tests/credits.test.ts` (new).
- **Change**: `CREDITS.md names the dragon by yoji and Kai by uchiha007 under CC-BY 3.0`. Then: `CREDITS.md names the knight as Blend Swap 28541 by Xali under CC0` and `blender/examples/knight_28541/LICENSE.txt exists`. Also: `README states MIT covers the code only`.
- **Accept**: red until D2.
- **Must not change**: `README.md`, `CREDITS.md`, `index.html`.

#### D2 Credits and licence text [CLAUDE] (**findings 34, 35** text)
- **Tier**: opus. This is licensing text, and it has to be correct.
- **Depends**: D1.
- **Files**: `CREDITS.md` (new), `README.md` (credits section and a licence-scope sentence), `index.html` (one "Credits" line in `#settings-modal` naming yoji and uchiha007, CC-BY 3.0, linking `CREDITS.md` by its repository URL `https://github.com/allansli/osrs-like/blob/main/CREDITS.md`, because Vite does not serve a repository-root file from the built site), `blender/examples/knight_28541/LICENSE.txt` (new: title, author Xali, source https://www.blendswap.com/blend/28541, licence CC0, and the note that the author's base mesh came from a CGTrader model with unstated terms).
- **Change**: for each third-party asset in `blender/examples/` and `public/models/`, list title, author, source URL and licence (from the audit's finding 34 evidence; the knight is Blend Swap blend 28541, "Rigged Knight in Armor" by Xali, CC0).
- **Accept**: `ONE(tests/credits.test.ts)` passes.
- **Must not change**: any `onclick` in `index.html` (X27 `globals` test).

#### D3 README corrections [CLAUDE] (**findings 33, 40**, and the finding 12 sentence)
- **Tier**: sonnet (doc sync to code).
- **Depends**: D2, **O-6**.
- **Files**: `README.md`.
- **Change**:
  - **#33**: the "Play Live in Browser" link and the Mirror badge point at the Vercel URL. If the owner chose to make Pages work instead, this task stops and is replanned.
  - **#40**: counts and the monster table from `src/data` (34 monsters, the 10 types with levels).
  - **#12**: "saved on every action" becomes "saved every 2 seconds, when the tab is hidden, on exit and on manual save".
- **Accept**: the opus verify checks every number against `src/data/placements.ts` and `catalog.ts`. One commit per finding, messages naming `#33`, `#40` and `#12` (G-1 step 6).
- **Must not change**: the credits section written in D2.

---

## 1.4 Merge order after CP-1

The main session merges in this order: F01-F02 (already on the spine), P, I, R, T, S, L, M, D. Each merge is followed by SG on `feat/world-foundation`. L and M both import `dispose.ts` but do not edit it. No two clusters share a file.

| File | Cluster |
|---|---|
| `src/engine/runtime.ts` | X (spine), then L7 only |
| `src/engine/loop.ts`, `vfx.ts`, `playerMesh.ts`, `monsterMeshes.ts`, `context.ts`, `actions.ts`, `src/ui/hud.ts`, `src/ui/playerActions.ts` | L |
| `src/engine/worldBuild.ts`, `blender*.ts`, `gltf.ts` | M |
| `src/state/save.ts`, `inventory.ts`, `src/engine/session.ts`, `src/ui/stations.ts` | S |
| `src/state/adventure.ts`, `src/data/recipes.ts` | P |
| `src/engine/renderer.ts` | R |
| `src/engine/input.ts`, `src/ui/styles.css` | I |
| `scripts/run-blender.mjs`, `vercel.json`, `.gitignore`, `package*.json`, `vite.config.ts`, `.github/` | T |
| `README.md`, `CREDITS.md`, `index.html` | D |

What cannot run in parallel: the whole spine X (one file, `runtime.ts`), F01-F02 (shared helper, before the split), M3 (needs L3 merged), and the tasks inside each cluster (listed in dependency order).

---

## 1.5 Stage 1 gate

### G-1 Stage 1 verification [CLAUDE]
- **Tier**: opus (verification).
- **Depends**: all Stage 1 clusters merged.
- **Files**: none (read-only; a written report in the session).
- **Check**:
  1. SUITE: all pass. That is 103 baseline tests, unchanged, plus the new files: `architecture`, `terrain`, `terrain-golden`, `placements`, `monster-ai`, `source-limits`, `globals`, `dispose`, `save-hardening`, `shop-gathered`, `rule-fixes`, `gltf-loader`, `run-blender`, `vercel-headers`, `credits`.
  2. TYPES: clean.
  3. BUILD: JS chunk within 10 kB of 926.36 kB.
  4. `npm audit --audit-level=high` exits 0.
  5. `git diff 1284a6e -- tests/phase1.test.ts tests/phase2.test.ts tests/phase3-content.test.ts tests/phase4-combat.test.ts tests/cheats.test.ts tests/textures.test.ts src/__tests__` is empty.
  6. Ledger: each of findings 1, 2, 4, 5, 6, 7, 8, 10, 11, 12, 13, 15, 16, 17, 19, 20, 21, 22, 25, 26, 28, 33, 34, 35, 36, 37, 38, 40, 41, 42, 43 has a merged Fix commit or test naming it. Findings 14 and 18 keep their written deferrals (design section 9), copied into the pull request.
  7. The `any` count is at the three seams only.
  8. The CI run on the pull request is green.
- **Accept**: a written pass. Any failure goes back to its task.
- **Must not change**: anything; the task is read-only.

### G-2 Stage 1 human checks [HUMAN]
Design 5.7, recorded in the pull request:
- Screenshots at the two fixed poses against the baseline. No difference except grass, and outlines if R1 changed what was drawn (expected: nothing, because outlines were already hidden).
- Perf HUD within 2% of 1509 calls / 226k triangles (start) and 544 / 108k (shrine).
- Leak check: `renderer.info.memory.geometries` is back to its first value after 200 attacks, 5 level-ups and 20 gear swaps (**11, 16, 17, 26**).
- The full smoke list of 5.7. Talking to a guard works (L6). Typing "wasd f" and spaces in the bank search and the cheat box does not move the hero (**22**). Reload restores position, camera and time of day. The Credits line is visible in Settings (**34**).
- The vitals bars move while standing still and regenerating (**12**).
- FPS on the owner's GPU, balanced tier, is not lower than the PRE-1 value.

### O-9 Accept Stage 1 [OWNER]
The owner reviews G-1 and G-2 and accepts. The main session opens the pull request to `main` and merges after CI is green. **No Stage 2 task starts before this step.**

---

# Stage 2: World as a place

Nothing here starts before **O-9** (Stage 1 accepted and merged) and **O-10** (Stage 2 CALLs approved). Stage 2 works on a new branch `feat/world-place` cut from `main` after the Stage 1 merge. Lane branches are `wp/<lane>`.

## 2.0 Owner gate

### O-10 Approve Stage 2 [OWNER]
The owner approves or amends CALL-6, CALL-7 with Q7, CALL-8 with Q4, CALL-9, CALL-10 and CALL-15. An amendment changes only the data or test values of the task that the table in 0.5 names. Q2 (renaming) stays out of scope.

## 2.1 Lanes and files

| Lane | Tasks | Files |
|---|---|---|
| W (world) | W1-W8 | `src/data/worldMap.ts` (new), `src/data/placements.ts`, `src/engine/spawns.ts`, `src/state/terrain.ts`, `src/state/collision.ts`, `src/engine/worldMesh.ts`, `src/engine/worldBuild.ts`, `src/engine/overlay.ts`, `src/engine/textures.ts` (W4b only), `README.md` |
| A (rules) | A1-A7 | `src/state/combat.ts`, `src/engine/actions.ts`, `src/state/monsterAi.ts`, `src/engine/loop.ts`, `src/engine/session.ts`, `src/engine/context.ts` |
| B (pathing) | B1-B2, then B3 | `src/state/pathfind.ts` (new); B3: `src/engine/input.ts`, `src/engine/loop.ts`, `src/engine/context.ts`, `src/engine/renderer.ts`, `src/engine/actions.ts` |

What cannot run in parallel:
- **W1 comes first.** A5 and A6 import `CampDef` from `worldMap.ts`.
- **B3 runs after A6**, in lane A's branch, because both edit `loop.ts` and `context.ts`.
- **B2 merges before W3**, because the reachability test uses the walk grid.
- **A7 runs last**: it needs A2, A6 and W5.

Inside lane W every task edits `worldMap.ts` or depends on the one before it, so the lane is serial. Lanes A and B (B1-B2) run in parallel with lane W after W1.

Merge order into `feat/world-place`: W1, then B1-B2, then A1-A4, then A5-A6, then B3, then W2-W8 as one merge once the lane is green (the W2 tests stay red until W5), then A7. Lane W rebases onto `feat/world-place` after the B1-B2 merge and before W3, because W3 needs `buildWalkGrid`.

---

## 2.2 Lane W: world data, relief, places

### W1 Camps, behaviour-preserving [AGY]
- **Tier**: sonnet (data transcription).
- **Depends**: O-10.
- **Files**: `src/data/worldMap.ts` (new), `src/data/placements.ts`, `src/engine/spawns.ts`.
- **Change**:
  - `worldMap.ts` exports the types `PathDef`, `RidgeDef`, `BasinDef`, `PoiDef`, `CampDef`, `CampMember = { type: string; x: number; z: number; wander?: number }` (design 6.1 row shapes), and the four tables `PATHS`, `RIDGES`, `BASINS`, `POIS` as empty typed arrays, so W2's tests compile against them before W3 fills them.
  - It exports `CAMPS: CampDef[]`, one camp per group of today's monsters (hen yard, Three Kettle goblins and archers, wizards, rangers, giants, scorpions, guardians, demons, dragon). Each camp has its members at today's coordinates and in today's order, `aggressive: false`, and `radius` equal to the largest member distance from the camp centre (the members' centroid) plus 4.5, rounded up.
  - It exports `SAFE_ZONES` (radius 14 around each `WORLD_REGIONS` centre) and `isInSafeZone(x, z): boolean`.
  - `placements.ts`: `MONSTER_PLACEMENTS` is derived from `CAMPS` (all members of all camps, in camp order), so the Stage 1 placements test stays valid unchanged.
  - `spawns.ts` iterates `CAMPS` and passes `campId` and `wander` to `createMonsterLogic`.
- **Accept**: SG. `ONE(tests/placements.test.ts)` passes unchanged. The opus verify confirms the same 34 monsters, in the same spawn order and at the same coordinates as `1284a6e`.
- **Must not change**: behaviour. No camp is aggressive yet, and `stepMonster` ignores camps.

### W2 World validation tests [CLAUDE]
- **Tier**: opus. These tests are the boundary check for compiled world data (design R9), and choosing them is judgment.
- **Depends**: W1.
- **Files** (all new): `tests/relief.test.ts`, `tests/world-data.test.ts`, `tests/reachability.test.ts`, `tests/save-relocation.test.ts`, `tests/names.test.ts`, `tests/world-budget.test.ts`, `tests/fixtures/save-relocation/*.json`.
- **Change**:
  - `relief` (**G2.1, G2.2**):
    - `walkable height range outside the crag corner is at least 12` (2-unit grid)
    - `every region core is exactly 0 within 16`
    - `every basin centre is below -0.34`
    - `every basin point below the water plane is unwalkable and every unwalkable basin point is under water`
    - `every path sampled each unit is walkable end to end`
    - `path slope is at most 0.25 outside the bridge rectangle`
    - `paths cross the river only on the bridge rectangle`
    - `each path ends within 8 of its region's shrine`
  - `world-data` (**G2.3**, the world data row, the resource rules of **G2.4** and **G2.5**):
    - `every POI piece names a world.glb node or one of tent, fireRing, cairn, signpost` (read the GLB JSON chunk with `fs`)
    - `every POI piece stands on walkable ground inside its pad`
    - `every camp member is inside its camp and on walkable ground`
    - `every fishing spot is on unwalkable water (river by isDeepWater, or a basin) within 3.1 of walkable ground`
    - `every monster type and node key exists`
    - `no ridge core or basin overlaps a region core, the castle, a station or a path`
    - `every ridge core and basin is at least 2 units across`
    - `no aggressive camp overlaps a safe zone`
    - `no path except Cinder Stair crosses an aggressive camp`
    - `no resource node except yew and magic trees is inside an aggressive camp`
    - `all yew and magic trees are inside the two deep-woods camps`
    - `runite rocks are outside every camp`
    - `four lesser demons stand in the Cinderstep Pass camp with wander 1`
  - `reachability` (**G2.5**): `flood fill from the start point reaches every shrine`; `with the Cinderstep Pass cells blocked the last shrine is unreachable`. Uses `buildWalkGrid` from B2.
  - `save-relocation` (**G2.7**):
    - `the Stage 1 version-4 fixture loads unchanged`
    - `a position in the ridge core loads to a walkable point`
    - `a position in each basin loads to a walkable point`
    - `the 20 listed old spawn points load to walkable points` (coordinates from `1284a6e`, written into the test)
    - `serializeState writes the same keys as before Stage 2` (key list written into the test)
  - `names` (**G2.8**): `no name in worldMap.ts contains a deny-listed token`. The deny-list is the region, monster, NPC and franchise words taken from `catalog.ts` and `README.md`, written into the test.
  - `world-budget` (**G2.9**): `paths and ridges have at most 60 segments in total`; `the walk grid has 55,696 cells`; `TERRAIN_SEGMENTS is 160`; `CAMPS hold 36 monsters`.
- **Accept**: under rule 0.3.4. TYPES reports only missing-export errors for `TERRAIN_SEGMENTS`, `onPath` and `slopeAt` (added by W3) and, if B2 is not merged yet, the missing `src/state/pathfind.ts`; nothing else. The suites are red until W3 and W5. Each test is checked to fail for the right reason on today's data (empty tables count as failing where the design requires content, e.g. "each path ends within 8 of its shrine" must fail on an empty `PATHS`, not pass vacuously: every table-driven test first asserts the table has the design's row count).
- **Must not change**: `src/`.

### W3 Relief: paths, ridge, basins, pads [CLAUDE]
- **Tier**: opus. Shaping terrain to pass the relief and reachability tests is tuning that the plan cannot fully specify.
- **Depends**: W2, B2 merged.
- **Files**: `src/data/worldMap.ts` (`PATHS`, `RIDGES`, `BASINS`, `POIS`), `src/state/terrain.ts`, `src/state/collision.ts`, `tests/fixtures/terrain-golden.json`, `tests/terrain.test.ts` (one line, planned replacement #1).
- **Change**:
  - Data from design 6.3: Millrace Road, Saltwind Track, Lanternway, Cinder Stair; Harrowback Ridge with one gap, Cinderstep Pass (5 wide, about 24 long, near (-31, 55)); Reedglass Tarn and Tamarisk Pool; the seven POIs with their pads and pieces, and Wardstone Cairn's one-line warning in its `sign` field (W6 shows it). Every path's first point is where W6 puts its signpost, so it is chosen at a fork or a town exit.
  - `getTerrainHeight` composes the six steps of design 6.2, in that order, with the river after the paths and the region cores blending to the composed height.
  - Also export `TERRAIN_SEGMENTS = 160`, `onPath(x, z): boolean` (true within any path's own `halfWidth` of its centre line) and `slopeAt(x, z): number` (central difference, 0.5 units).
  - `isWalkable` also returns false inside a ridge core (except at a gap) and on basin water.
  - **Planned replacement #1**: regenerate `terrain-golden.json` with `systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 env TEST_CONCURRENCY=4 UPDATE_GOLDEN=1 npx vitest run tests/terrain-golden.test.ts`, and change the "at least 0.08" invariant in `tests/terrain.test.ts` to "at points 28 or more from every region centre, outside basins and outside the river trough". Name both in the commit message.
- **Accept**: `ONE(tests/relief.test.ts)`, `ONE(tests/reachability.test.ts)`, `ONE(tests/save-relocation.test.ts)`, `ONE(tests/names.test.ts)`, `ONE(tests/terrain.test.ts)` and `ONE(tests/terrain-golden.test.ts)` pass. TYPES and BUILD pass. The ridge, basin, path and both POI-piece cases of `world-data` pass (POI pieces are pure data, written here). The 103 baseline tests and `tests/pathfind.test.ts` pass (the `phase1` collision points and `textures` biome points are unchanged). Still red, and only these: the camp, fishing-spot, resource and sentry cases of `world-data`, and the 36-monster case of `world-budget` (W5).
- **Must not change**: region cores (exactly 0 within 16), the castle, stations, `riverCenterX`, the bridge rectangle.

### W4 Terrain mesh, ground colour, grass [AGY]
- **Tier**: sonnet.
- **Depends**: W3.
- **Files**: `src/engine/worldMesh.ts`.
- **Change**:
  - The terrain `PlaneGeometry` uses `TERRAIN_SEGMENTS`.
  - In `getBiomeColor`, delete the hard-coded road strip. `onPath(x, z)` gives dirt. `slopeAt(x, z) > 0.55` gives the existing crag colour.
  - Grass skips points on a path or with slope over 0.55. The count stays 900.
- **Accept**: TYPES and BUILD pass; SUITE passes except the W3-listed red cases. `grep -c 'TERRAIN_SEGMENTS' src/engine/worldMesh.ts` prints at least 1 and `grep -c 'segs = 80' src/engine/worldMesh.ts` prints 0 (today `const segs = 80`, `1284a6e` 1403); the opus verify confirms the terrain `PlaneGeometry` takes `TERRAIN_SEGMENTS` for both segment counts (the `world-budget` case only reads the constant W3 exports, so it passes without this task). The look is on G-4.
- **Must not change**: the terrain shader, the water plane, the palette.

### W4b Path readability fallback [AGY], conditional
- **Tier**: sonnet.
- **Depends**: G-4 finds paths unreadable inside a biome tile. Otherwise skipped. If it runs, G-3 steps 1-3 are re-run after it.
- **Files**: `src/engine/textures.ts`.
- **Change**: in `TERRAIN_SAMPLE`, scale each biome weight by `(1.0 - dirtW)`.
- **Accept**: `ONE(tests/textures.test.ts)` passes unchanged, then SG.
- **Must not change**: anything outside the biome-weight lines of `TERRAIN_SAMPLE`.

### W5 Camps, nodes and fishing spots [CLAUDE]
- **Tier**: sonnet. Data tuned against the W2 tests; escalate to opus if two rounds do not converge.
- **Depends**: W4, O-10 (CALL-7, Q7).
- **Files**: `src/data/worldMap.ts` (`CAMPS`), `src/data/placements.ts` (`NODE_PLACEMENTS`), `tests/placements.test.ts` (one assertion, planned replacement #2).
- **Change**:
  - Camps and aggression per design 6.4: hen yard and Three Kettle Camp passive; the rest aggressive, with `aggroRadius` 9 for melee and 12 for ranged and magic.
  - Two deep-woods camps, with the yews and magic trees moved to the coordinates in 6.4.
  - Four pass sentries with `wander: 1`: today's (-64, 78) and (-82, 58), plus two new lesser demons.
  - Slagfall Terrace and the dragon's lair moved as the tests require.
  - The five dry river fishing spots moved onto deep water, plus one spot in each basin.
  - **Planned replacement #2**: in `tests/placements.test.ts`, "every fishing point is within 6.8 of `riverCenterX(z)`" becomes the world-data rule (on unwalkable water, river or basin). Name it in the commit message.
- **Accept**: `ONE(tests/world-data.test.ts)`, `ONE(tests/world-budget.test.ts)` and `ONE(tests/placements.test.ts)` pass in full, then SG. From here lane W is green.
- **Must not change**: monster stats, drops, the runite rocks, iron, mithril and gold rocks, stations.

### W6 Points of interest [AGY]
- **Tier**: sonnet.
- **Depends**: W5.
- **Files**: `src/engine/worldBuild.ts`.
- **Change**:
  - Add four builders in the style of the existing ones: `buildTent`, `buildFireRing`, `buildCairn`, `buildSignpost`.
  - Add `buildPointsOfInterest()`, which places each `POIS` piece at the POI position plus its offset, with Y from `getTerrainHeight`. A GLB node goes through `spawnWorldProp`; a builder name calls its builder. `buildAllCitiesAndLandmarks` calls it.
  - Wardstone Cairn gets an interactive hitbox with `action: 'dialogue'`, and its `dialogue` is the POI's `sign` text from `worldMap.ts`.
  - Signposts are derived, not a new table: one `buildSignpost` at the first point of each `PATHS` entry, offset perpendicular to the first segment by `halfWidth + 1`, on the side away from the river. Each pushes a label to `G.npcList` whose text is the path name and the existing name of the region whose shrine is nearest the path's last point (Q2).
- **Accept**: SG. `grep -c 'buildPointsOfInterest(' src/engine/worldBuild.ts` prints at least 2 (definition and call) and `grep -c 'buildSignpost(' src/engine/worldBuild.ts` at least 2. The opus verify confirms every `POIS` piece and every path start gets a mesh; `world-data` already passed in W3, so it does not prove this task. The look is on G-4.
- **Must not change**: any existing landmark, prop or station.

### W7 Minimap paths and ridge [AGY]
- **Tier**: sonnet.
- **Depends**: W6.
- **Files**: `src/engine/overlay.ts`.
- **Change**: `renderMinimap` draws `PATHS` as dirt-coloured strokes scaled by `halfWidth`, and `RIDGES` as dark strokes, after the river and before the nodes.
- **Accept**: SG. The opus verify confirms `renderMinimap` iterates both `PATHS` and `RIDGES` (a grep count would pass on the import line alone). The minimap is on G-4.
- **Must not change**: the minimap's existing layers and scale.

### W8 README world table [CLAUDE]
- **Tier**: sonnet (doc sync to code).
- **Depends**: W7.
- **Files**: `README.md`.
- **Change**: update the world table with the new places, paths, the ridge and pass, which camps are aggressive, and the monster count of 36. List the twelve new names.
- **Accept**: the opus verify checks every row against `worldMap.ts`.
- **Must not change**: README sections other than the world table.

---

## 2.3 Lane A: monster rules

### A1 Monster hit-roll tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: O-10.
- **Files**: `tests/monster-hit.test.ts` (new).
- **Change**: tests against `rollMonsterHit(typeKey: string, breathCount: number, state: GameState, rand: () => number): { dmg: number; dragonfire: boolean; absorbed: boolean }` in `src/state/combat.ts`. It reads `MONSTER_TYPES[typeKey]`. The design's `def` parameter cannot work: `MonsterDef` has no type key, and today's dragonfire test is `monster.typeKey === 'elvarg_dragon'` (`1284a6e` 4974). `breathCount` is the value after the caller's increment, as today (4973-4974). `absorbed` is a boolean, as `resolveDragonfire` returns. Tests:
  - `same seed gives the same result`
  - `rand is drawn for the hit roll first, then the damage roll` (record the calls)
  - `hit chance is clamped to 0.12..0.82`
  - `Protect from Melee cuts a melee hit to 20% through mitigateDamage`
  - `the dragon breathes fire when breathCount % 3 is 0, through resolveDragonfire`
  - `a miss deals 0`
- **Accept**: red until A2.
- **Must not change**: `src/`.

### A2 Extract `rollMonsterHit` [AGY], behaviour-preserving
- **Tier**: sonnet (move of a formula).
- **Depends**: A1.
- **Files**: `src/state/combat.ts`, `src/engine/actions.ts`.
- **Change**: move the roll from `performMonsterRetaliation` (`1284a6e` 4966-4990) into `rollMonsterHit(typeKey, breathCount, state, rand)` (signature in A1), keeping the order of the `rand` draws and using `getEquipmentBonuses(state)` (in `combat.ts` since X17). It applies `mitigateDamage` and `resolveDragonfire` itself. The caller increments `breathCount` first, then passes it with `Math.random`, sets `attackAnim`, and keeps the per-type delivery.
- **Accept**: `ONE(tests/monster-hit.test.ts)` passes, then SG.
- **Must not change**: any number in the formula.

### A3 Teleport discovery tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: O-10 (CALL-9, Q4).
- **Files**: `tests/teleport-discovery.test.ts` (new).
- **Change**: `canCastTeleport refuses a destination whose shrine is undiscovered`; `canCastTeleport accepts it once discovered`; `the refusal reason names the shrine`.
- **Accept**: red until A4.
- **Must not change**: `src/`.

### A4 Teleport requires the shrine [AGY]
- **Tier**: sonnet.
- **Depends**: A3, A2.
- **Files**: `src/state/combat.ts`.
- **Change**: `canCastTeleport` returns `{ ok: false, reason }` when `state.shrines[regionId]` is false.
- **Accept**: `ONE(tests/teleport-discovery.test.ts)` passes, then SG.
- **Must not change**: rune costs, level requirements, world-map shrine travel.

### A5 Territory state-machine tests [CLAUDE]
- **Tier**: opus. These define the leash, aggression and immunity rules that the gate depends on.
- **Depends**: W1, A4, O-10 (CALL-7, CALL-8, Q4, Q7).
- **Files**: `tests/monster-territory.test.ts` (new), `tests/monster-ai.test.ts` (one assertion, planned replacement #3).
- **Change**: tests with test-local camps and fake time, building `world` with the optional fields `playerCombat`, `playerSafe` and `camps`. One test each for T1 to T9 (T1 and T7 through `onPlayerHit`). Then:
  - `a passive camp never starts a fight`
  - `a passive monster in a safe zone attacked from inside it fights back and can be killed`
  - `an aggressive camp ignores a player whose combat level is above the monster's`
  - `acquires at aggroRadius and not beyond`
  - `acquires only when the player is inside the camp radius`
  - `leashes at radius + 4, walks home and is at full HP on arrival`
  - `gives up after 1.5 s of moving less than 0.2 against a wall`
  - `does not acquire during the 3-second grace or inside a safe zone`
  - `attack cadence is 1.65 s`
  - `a monster in return cannot be damaged or re-acquired until home`
  - `return emits reset at home with breathCount 0`
  
  **Planned replacement #3**: in `tests/monster-ai.test.ts`, "combat drops beyond 26 with HP kept" becomes "returns home, cannot be damaged on the way, and is healed on arrival". Name it in the commit message.
- **Accept**: red until A6.
- **Must not change**: every other test in `tests/monster-ai.test.ts`; `src/`.

### A6 Territory, aggression, leashing [AGY]
- **Tier**: sonnet (state table fully given in design 6.5).
- **Depends**: A5.
- **Files**: `src/state/monsterAi.ts`, `src/engine/loop.ts`, `src/engine/actions.ts`, `src/engine/session.ts`, `src/engine/context.ts`.
- **Change**:
  - `MonsterLogic` gains `campId`, the state `'return'`, and stall-tracking fields. `StepWorld` gains the optional `playerCombat`, `playerSafe` and `camps`; when they are absent, aggression (T2) and the camp leash are off, and every other rule applies, including `return` (CALL-8). `MonsterEvent.kind` gains `'aggro'` and `'reset'`. T2, T5 and T6 are implemented exactly as in 6.5. Threat uses `monsterThreatColor(level, playerCombat) !== 'green'`.
  - `onPlayerHit` returns `applied: false` in `return`.
  - Engine: `G.aggroGraceUntil` is set to now + 3000 ms in `loadGameState`, `finishRespawn` and `teleportToRegion`. `updateMonsters` passes `playerCombat = getCombatLevel()` (from `hud.ts`), `camps = CAMPS` and `playerSafe = isInSafeZone(player.pos.x, player.pos.z) || now < G.aggroGraceUntil`. `aggro` prints one chat line, and `reset` refreshes the label. `applied: false` shows a miss splat and one chat line saying the monster has lost interest.
- **Accept**: `ONE(tests/monster-territory.test.ts)` and `ONE(tests/monster-ai.test.ts)` pass, then SG.
- **Must not change**: the player's attack formulas, `rollMonsterHit`, chase speed 5.2, attack ranges, cadence. There is no player auto-retaliation.

### A7 Gate simulation [CLAUDE]
- **Tier**: opus. This proves the CALL-9 threshold, and if it fails, chooses the tuning.
- **Depends**: A6, W5.
- **Files**: `tests/gate-simulation.test.ts` (new); `src/data/worldMap.ts` (the pass-sentry camp only: count and spacing, design 6.6.4).
- **Change**: a scripted runner moves at 11.5 units/s along the pass centre line and along each wall. The real `stepMonster` drives the four sentries, and each `attack` is resolved with `rollMonsterHit`. Seeded `rand`, 1000 seeds. Tests:
  - `a fresh character (10 HP, no prayer) survives fewer than 5% of runs`
  - `a character with 40 hitpoints and Protect from Melee survives every run`
  - `every run records at least one attack per sentry`
- **Accept**: `ONE(tests/gate-simulation.test.ts)` passes. If a threshold misses, change sentry spacing or count in `worldMap.ts` (W2's `world-data` sentry case changes only if the count changes, and that needs owner sign-off of the new count against CALL-9). Then re-run `ONE(tests/world-data.test.ts)` and SG.
- **Must not change**: any formula, monster stat, or camp other than the pass sentries.

---

## 2.4 Lane B: player pathfinding

### B1 Pathfinding tests [CLAUDE]
- **Tier**: sonnet (written from design 6.7 and G2.6).
- **Depends**: O-10.
- **Files**: `tests/pathfind.test.ts` (new).
- **Change**: tests against `src/state/pathfind.ts`:
  - `WalkGrid = { size: number; origin: number; cells: Uint8Array; walkable: (x: number, z: number) => boolean }`
  - `buildWalkGrid(walkable = isWalkable): WalkGrid`
  - `findPath(grid, from: [number, number], to: [number, number], stats?: { expanded: number }): [number, number][] | null`
  - `entityGoal(grid, from, target, stopDist): [number, number] | null`
  - `shouldRepath(goal, target, reachedLast: boolean): boolean`
  
  Tests (on today's world, which already has the castle and the river):
  - `grid is 236 x 236`
  - `start to each shrine returns a route whose every segment is walkable at 0.25 sampling`
  - `crossing the river routes over the bridge`
  - `reaching the courtyard from outside routes through the gate and never touches a wall box`
  - `an enclosed target returns null` (synthetic `walkable`)
  - `expanded cells never exceed the grid size`
  - `the start point reaches stop distance 3.1 of every fishing spot`
  - `a follower re-paths when the target moves more than 2 and ends within stop distance`
  - `no corner cutting between two blocked diagonal cells`
- **Accept**: red until B2.
- **Must not change**: `src/`.

### B2 Pathfinder [AGY]
- **Tier**: sonnet.
- **Depends**: B1.
- **Files**: `src/state/pathfind.ts` (new).
- **Change**: 1-unit cells over ±118, filled once from `walkable` at the cell centres. A* over 8 neighbours with an octile heuristic, a binary-heap open list and a closed set, and no corner cutting. Then smoothing: drop a waypoint when the segment between its neighbours is walkable, sampled every 0.25 units. `entityGoal` returns the nearest walkable cell within `stopDist` of the target. `shouldRepath` is true when the target is more than 2 from `goal` or `reachedLast` is true.
- **Accept**: `ONE(tests/pathfind.test.ts)` passes, then SG.
- **Must not change**: `collision.ts`.

### B3 Click-to-move on paths, one raycast [AGY] (**finding 18**)
- **Tier**: sonnet.
- **Depends**: B2, A6 (same `loop.ts` and `context.ts`, so it runs after A6 on lane A's branch).
- **Files**: `src/engine/context.ts`, `src/engine/renderer.ts`, `src/engine/input.ts`, `src/engine/loop.ts`, `src/engine/actions.ts` (`teleportToRegion` and `handlePlayerDeath` clear the target today, `1284a6e` 4086 and 5036).
- **Change**:
  - `context.ts`: `player.targetPos` becomes `player.waypoints: [number, number][]` (empty means no target; every `player.targetPos = null` becomes `player.waypoints.length = 0`), and `G.walkGrid` is built once in `init3DEngine` (it depends only on `isWalkable`).
  - `input.ts`: ground click, minimap click, "Walk here" and an entity click call `findPath` (or `entityGoal` and then `findPath`) once. A `null` result prints the existing "can't reach" chat line.
  - `loop.ts`: `updatePlayerIntent` walks toward the next waypoint through `moveWithCollision`. For a monster target it re-paths when `shouldRepath` says so, and between re-paths the last segment aims at the monster. Keyboard movement is unchanged.
  - **Finding 18**: one terrain raycast per pointer event, shared by `handleWorldHover` and `updateHoverTile`.
- **Accept**: SG. `grep -rnE "player\.targetPos|^\s+targetPos:" src` prints nothing (a bare `targetPos` grep would hit the unrelated parameter of the VFX functions in `vfx.ts`). `grep -c 'findPath(' src/engine/input.ts` prints at least 1 (a call, not the import). Routing around the castle and over the bridge is on G-4.
- **Must not change**: stop distances (2.9, 13.5, 3.1, 3.5), player speed, keyboard control.

---

## 2.5 Stage 2 gate

### G-3 Stage 2 verification [CLAUDE]
- **Tier**: opus (verification).
- **Depends**: A7, W8, B3 merged into `feat/world-place`.
- **Files**: none (read-only; a written report in the session).
- **Check**:
  1. SUITE: all pass. The 103 baseline tests and every Stage 1 test are unchanged, except the three declared replacements (W3, W5, A5). The verify reads `git diff main -- tests` and finds edits only in `tests/terrain.test.ts` (one invariant), `tests/fixtures/terrain-golden.json`, `tests/placements.test.ts` (one assertion) and `tests/monster-ai.test.ts` (one test).
  2. TYPES: clean.
  3. BUILD: JS chunk within 25 kB of 926.36 kB.
  4. `npm audit --audit-level=high` exits 0.
  5. Every goal G2.1-G2.9 maps to a passing test (table in section 4).
  6. Finding 18 is closed by B3.
  7. No new runtime dependency (`git diff main -- package.json` shows no `dependencies` change).
- **Accept**: a written pass.
- **Must not change**: anything; the task is read-only.

### G-4 Stage 2 human checks [HUMAN]
Design 6.11:
- Screenshots at noon from fixed poses: the start town toward Three Kettle Camp; Millrace Road at the bridge; Wardstone Cairn looking at Cinderstep Pass with the ridge on both sides; inside the pass with the sentries; Slagfall Terrace; Reedglass Tarn; Tamarisk Pool; the minimap with paths and the ridge. Judge each for: the ridge reads as a wall, paths read as paths (if they do not, run W4b), water sits in the basins, nothing floats or is buried, and the faceted painted look is intact.
- Walking along the foot of the ridge, the camera does not sink into it.
- Walk the gate as a fresh level-3 character (expected: killed in the pass). Then do it as a character raised with the `skills10` cheat until Protect from Melee is available (expected: gets through, the shrine is discovered, and the teleport now works).
- Click from the start town to a point behind the castle and to a point across the river: the hero walks around, and over the bridge.
- Pull a moss guardian out of its camp: it turns back, shrugs off attacks on the way, and heals. Stand in a shrine's safe zone next to an aggressive camp: nothing comes.
- Perf HUD on a real GPU at the two baseline poses and at Cinderstep Pass, against design section 8: start pose at most 1750 calls and 300k triangles; shrine at most 700 calls; FPS no more than 5% below the PRE-1 value.

### O-11 Name search [HUMAN]
For each of the twelve names in design 6.8, a person runs a web search and records "not a known place in a published game", or a replacement name (which then goes through W2's `names` test). This blocks the Stage 2 merge.

### O-12 Accept Stage 2 [OWNER]
The owner accepts after G-3, G-4 and O-11. The main session opens the pull request and merges after CI is green.

---

# 3. Final verification (end of both stages)

Run on `main` after the Stage 2 merge, from an allowlisted shell:

1. `systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 env TEST_CONCURRENCY=4 npx vitest run`: every test passes. That is the 103 baseline tests plus every file added by this plan; none is skipped or `.todo`.
2. `systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 env TEST_CONCURRENCY=4 npx tsc --noEmit`: exit 0, no output.
3. `systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 env TEST_CONCURRENCY=4 npm run build`: exit 0, JS chunk at most 951 kB (926.36 + 25).
4. `npm audit --audit-level=high`: exit 0.
5. The CI workflow is green on the merge commit.

What a person must look at in the running game (the union of G-2 and G-4):
- Baseline poses: the picture is unchanged except grass and the deliberate Stage 2 relief, and the perf HUD is within the section 8 budget.
- Leak check: GPU geometries return to their first value after 200 attacks, 5 level-ups and 20 gear swaps.
- The smoke list of design 5.7: walk by click and keys; cross the bridge; chop, mine, fish; fight with melee, ranged and magic; die and respawn; pray; bank; buy and sell (gathered goods have no buy button, if O-4 said yes); forge; equip; teleport by spell and shrine; talk to a guard; type in the bank search and cheat box without moving; reload restores position, camera and time; Credits in Settings; vitals move while regenerating.
- The Stage 2 list in G-4: ridge and paths read correctly, the gate holds for a fresh character and opens for a prepared one, routing around the castle and over the bridge, leashing and safe zones, the camera at the ridge foot, minimap paths.

---

# 4. Coverage

## 4.1 Audit findings to tasks

| Finding | Task | | Finding | Task |
|---|---|---|---|---|
| 1 | S1, S2 | | 22 | I1 |
| 2 | S1, S2 | | 25 | I2 |
| 4 | T1, T2 | | 26 | L3, M3 |
| 5 | T3, T4 | | 28 | M1, M2 |
| 6 | S3, S4 (O-4) | | 33 | D3 (O-6) |
| 7 | P1, P2 | | 34 | D1, D2 |
| 8 | P1, P3 | | 35 | D1, D2 |
| 10 | S1 | | 36 | T1, T2 |
| 11 | L1 | | 37 | T6 (O-8) |
| 12 | L7, D3 | | 38 | X27, X28, X29 |
| 13 | R2 (O-7) | | 40 | D3 |
| 15 | L4 | | 41 | T3, T4 |
| 16 | L2 | | 42 | T5 |
| 17 | L3, M3 | | 43 | T7 |
| 19 | R1 | | **18** | **Stage 2, B3** |
| 20 | X13, X29 | | 14 | deferred to Stage 4 (written in design section 9) |
| 21 | X03, L5 | | 3, 9, 23, 24, 27, 29, 30, 31, 32, 39 | deferred (design section 9), no task |

The two map-found defects: the talk-to-guard null dereference is L6, and the unchecked saved position is S2 (commit 4).

## 4.2 Goals to proofs

| Goal | Proof task(s) |
|---|---|
| G1.1 | X01 (node import), X27 (1000 lines) |
| G1.2 | X27 (no pragma), TYPES |
| G1.3 | X05, X14, X24, X01 (layering) |
| G1.4 | the 103 baseline tests unchanged (G-1 step 5), X27 (`globals`), CP-1 |
| G1.5 | S1 |
| G1.6 | S3, P1, M1, T1, T3, plus G-2 for the visual fixes |
| G1.7 | D1, G-2 |
| G1.8 | T6, T7, G-1 |
| G2.1, G2.2 | W2 `relief`, W3 |
| G2.3 | W2 `world-data`, W6 |
| G2.4 | A5, W2 `world-data` |
| G2.5 | W2 `reachability`, A3, A7 |
| G2.6 | B1 |
| G2.7 | W2 `save-relocation` |
| G2.8 | W2 `names`, O-11 |
| G2.9 | W2 `world-budget`, G-4 perf |

---

# Review log

Adversarial review of 2026-11-13 against the design and the source at `1284a6e`. Every item was checked in the code before it was changed. Nothing was run (no npm, tsc or vitest).

## Changed

| # | Where | Change | Reason |
|---|---|---|---|
| 1 | 0.3 rule 4 | Red test-first windows may also turn TYPES and BUILD red, limited to missing-symbol errors for the paired task. | `tsconfig.json` includes `tests/` and `npm run build` runs `tsc --noEmit`, so a test that imports a symbol not yet written breaks both. The old rule covered only SUITE. |
| 2 | X01 | `fs.readdirSync(..., { recursive: true })` plus dynamic `import()`, not `import.meta.glob`. | `"types": []` leaves `ImportMeta.glob` undeclared (vitest's `importMeta.d.ts` declares only `url` and `vitest`), so TYPES would fail. |
| 3 | X03, X13, X29, D3 | Commit messages name `#21`, `#20`, `#38`, `#33`, `#40` and `#12`. | G-1 step 6 looks for a commit or test that names each finding, and these tasks had neither. |
| 4 | X07 | Shared entity types defined once in `context.ts`. `el()` created in `src/ui/hud.ts` at X07, not at X18. | Otherwise every Type task (an [AGY] decision) invents its own types. `vfx`, `worldMesh`, `worldBuild`, `overlay` and `renderer` look up DOM ids before X18 would have defined `el`. |
| 5 | X15 | Spawn order is kept within each kind only. | Today's calls interleave monsters and nodes, so "monsters first, then nodes" and "must not change spawn order" contradicted each other. |
| 6 | X25 | Tier sonnet to opus. Allowlist adds `input.ts`, `hud.ts` and `context.ts`. Names `createMonsterLogic` and `wanderTarget`. | The task calls itself judgment, which the tier table assigns to opus. Flag reads sit at 3869, 3921 and 4039 (`input`) and 4062 (`hud`), so the old allowlist could not pass its own grep. `src/state` may not hold a `THREE.Vector3`. |
| 7 | X26 | One `FrameState` object, chosen. | "Parameters or a frame-local object" was a design decision left to agy. |
| 8 | X28 | Depends on X02. The worktree is cut only from a green spine head. | Cut after X01, or inside a red window, its SG cannot pass. |
| 9 | S2 | `sanitizePose` runs only in `migrateLegacySave`; the X20 call in `loadGameState` is removed. The (0, 4) source is named. | Validate once at the boundary (owner's rule). |
| 10 | L1 | No `keep`. Dispose after `onImpact`. Grep counts calls (`disposeObject3D(`). | Audit 11 confirms VFX geometry and materials are per instance. The old grep passed on the import line alone. |
| 11 | L3, M3 | Audit 17/26 facts written into L3. Greps count calls. | The grep passed on the import line. L3 stays sonnet now that its facts are given, with an opus verify of each `keep` rule. |
| 12 | L5 | Every site listed by symbol, with the audit's `Math.pow(f, dt*60)`. Allowlist adds `monsterMeshes.ts` and `vfx.ts`. | Audit 21 names 3370-3371 (`poseMonsterLimbs`) and 4448 (`vfx`), which the old allowlist excluded. "Choose k" was a decision left to agy. |
| 13 | L7 | `grantXp` also switches to `requestUiRefresh`; `playerActions.ts` added. The verify checks for synchronous DOM reads. | `grantXp` calls `updateAllUI` 2 to 4 times per hit (290), so section 8's "1 rebuild per hit" was unreachable. Audit 12 names the DOM-read caveat. |
| 14 | Cluster L, 1.4 table | `monsterMeshes.ts`, `playerActions.ts` and the M4 deletions added to the cluster file table. | The table must list every file each cluster touches, so the "no two clusters share a file" check holds. |
| 15 | M2 | `loadGltfOnce` has no window check. The public loaders keep their names, URLs, window guard and gear root side effect. | The M1 node tests need the injectable `load` path. `blender-hero.test.ts` (frozen) and `hasBlenderGearTemplate` depend on the existing exports. |
| 16 | P2 | Fix text written inline (ward flag ORed into `absorbed`, 25%). | "Use the audit's fix text" sent agy to another file. Checked: `phase2.test.ts` 181-186 uses a fresh state without the flag, so it is unaffected. |
| 17 | R2 | The exact lines to delete are named (1193-1194). The 2048 at 1311-1312 is kept. | There is no tier table entry; the size is an inline ternary. |
| 18 | T1, T2 | Stub protocol, modes to cover, `open` polling, and argument order (`--disable-autoexec` before the `.blend`, `--python-exit-code` before `--python`). | Blender applies its arguments in order. A flag appended at the end would pass a "contains" test and do nothing. |
| 19 | T5 | `git check-ignore --no-index` and `test ! -e`. | Checked: both old checks pass today with no change, because a tracked file is never reported as ignored and nothing greps the amulet. |
| 20 | D1 | In the no-licence case, D is rebased after the M merge before its final SG. | D1's "absent" test cannot go green on the D branch alone. |
| 21 | D2 | The Credits link goes to the repository URL. | Vite does not serve a repository-root `CREDITS.md`. |
| 22 | W1 | Exports empty `PATHS`, `RIDGES`, `BASINS` and `POIS`. | W2 can then compile against the data tables before W3. |
| 23 | W2 | Accept rewritten under rule 4. Table-driven tests must assert row counts first. | "Files compile" was impossible while the tests import W3 and B2 symbols. Empty tables would otherwise pass "for every row" tests vacuously. |
| 24 | W3, W5, W6 | POI-piece cases are accepted at W3. W5 makes lane W green. W6 accepts by call greps plus an opus verify. | POI pieces are pure data that W3 writes, so `world-data` passing proved nothing about W6. |
| 25 | W4 | Accept greps `worldMesh.ts` for `TERRAIN_SEGMENTS` and the absence of `segs = 80`. | The `world-budget` case only reads W3's constant, so it passed without W4. SG was also impossible while W2 cases were red. |
| 26 | W6 | Signposts derived from each path's first point. Cairn text from the POI `sign`. | Design 6.3 has signposts at forks but no table holding them, which left a data decision to agy. |
| 27 | W7, B3 | Acceptance by opus verify and `findPath(`, not by grep counts. | Greps on a symbol name pass on the import line. |
| 28 | B3 | Allowlist adds `actions.ts`. The grep is `player\.targetPos`. The empty waypoint list means no target. | `teleportToRegion` (4086) and `handlePlayerDeath` (5036) write `targetPos`. `vfx.ts` has unrelated `targetPos` parameters, so the old grep could never print nothing. |
| 29 | A1, A2 | `rollMonsterHit(typeKey, ...)`. `absorbed` is a boolean. The breath count is post-increment. | `MonsterDef` has no type key, and dragonfire is keyed on `typeKey === 'elvarg_dragon'` (4974). This is a deliberate deviation from the design's signature. |
| 30 | A6 | `updateMonsters` passes `playerCombat` and `camps` explicitly. | Only `playerSafe` was specified, so T2 would never fire in the engine. |
| 31 | A7 | `worldMap.ts` added to Files. | A7 is allowed to tune the sentries, but the file was missing from its allowlist. |
| 32 | W4b, 2.1 | G-3 is re-run if W4b runs. Lane W rebases after B1-B2. Lane W is red until W5 (was W6). | Ordering and gate consistency. |

## Checked and left

| Item | Reason |
|---|---|
| Stage 2 lane file split (W / A / B) and merge order | Only B3 and A6 share files, and B3 is already serialized after A6 on lane A's branch. |
| Save key, `version` 4, `serializeState` keys, legacy fallback when the main key is empty | `phase1.test.ts` 75-83 still passes. Adding `corrupt` breaks no `toEqual` on `MigratedSave` (checked by grep). |
| Freeze of the 103 baseline tests (rule 0.3.3, G-1 step 5) | No task edits them. `canCastTeleport` and `buyItem` have no existing test that A4 or S4 would break (bulk-buy buys runes only). |
| No `@ts-nocheck`/`@ts-ignore` and no file over 1000 lines in `src/__tests__` | Only `runtime.ts` and `icons.ts` carry the pragma, and the largest test is 428 lines, so X27 can pass with frozen tests. |
| Layering test passes today | No file in `src/state` or `src/data` mentions `document`, `window`, `three`, engine or ui. `monsterThreatColor` and `resolveDragonfire` live in `src/state`, so `monsterAi` and `combat` can use them. |
| Import-time side effects | Only the two listeners (5989, 6224). The other top-level initialisers use `performance.now()`. |
| `activeSpell` rule in S2 | Only combat spells are ever stored (`runtime.ts` 539-541), so a legitimate save is never rejected. |
| L4 deleting the wrap lines | `lerpAngle` does not normalise `rotation.y`, so the raw difference never jumps by 2π. Deleting the lines is correct. |
| Model tiers elsewhere | Haiku runs agy, sonnet is the fallback for specified [AGY] work, and opus does D2, W2, W3, A5, A7 and every verify. D2 stays opus: it is licence text. |
| Blender | No task runs Blender. T1 uses a stub. M4 is cancelled (the knight is CC0 and stays). Findings 3 and 39 stay deferred. |
| X24 leaves the player-down rule untested | It changes meaning in Stage 2 (to `return`). CP-1 covers it by eye, as the plan says. |
| T6 vitest 4 bump | A frozen test that breaks is stop-and-report. Local Node is 22.22, which vitest 4 and vite 6 accept. |
| Design-requirement coverage | Every G1.x and G2.x goal, and every Stage 1 ledger finding, maps to a task (section 4). The only design gap found, signposts, is fixed in item 26. |

## Changed after the second pass

| # | Where | Change | Reason |
|---|---|---|---|
| 33 | S1, S2 | A missing, zero or `NaN` `qty` keeps today's default of 1. Only a non-finite `qty` drops the slot. New S1 case for a slot with no `qty`. | `compactSlots` uses `Number(slot.qty) \|\| 1` (`inventory.ts` 73). "Drop anything that is not a finite integer" would delete items from legacy saves that the game itself wrote. |
| 34 | 0.3 rule 4 | The red-window allowance is defined by cause, not by a list of error messages. | A5's new union members and optional world fields produce "not assignable" and "known properties" errors, which the narrower list would have called defects. |
| 35 | X08-X23 shared text | Points to the shared entity types and `el`, and lets the task add fields to `context.ts`. Also applies to X15, X26 and X29. | An agy prompt names one task, so rules written only in X07 would not reach the later tasks. |

Also checked and left: D2's repository URL matches `git remote get-url origin`. `timeOfDay` is only ever written as `(n + 1) % 3` or `(n + 2) % 3` (`runtime.ts` 1375, 6002), so S2's integer 0..2 rule rejects nothing the game wrote. `phase2.test.ts` 110 (`smelt_bronze` succeeds) is unaffected by P3. No frozen test expects a pose, slayer name or `timeOfDay` to pass through unchanged.

## Not fixable from this task

- The design still gives `rollMonsterHit(def, ...)`. The plan (A1, A2) now uses `typeKey`; the design should be amended to match.
- `world-and-monsters.md` still says 33 monsters (34 is correct).
