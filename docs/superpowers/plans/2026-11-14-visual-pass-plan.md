# Visual pass: implementation plan

Date: 2026-11-14. Branch: `feat/visual-pass`. Design: `docs/superpowers/specs/2026-11-14-visual-pass-design.md` (called "the design" below; section numbers refer to it). Foundation design and plan: `docs/superpowers/specs/2026-11-13-world-foundation-design.md`, `docs/superpowers/plans/2026-11-13-world-foundation-plan.md`. Audit: `docs/audit/2026-11-13-findings.json`. Source line numbers are at commit `a8cad85`, which has no Stage 2, 3 or 4 code; task **R0** re-anchors them.

The design is approved in part. On 2026-11-14 the owner decided CALL-V3 (the running clock), V9 (woods trees block walking, design 6.11), V18 (Low, Medium, High, Ultra), V19 (smooth texels) and V20 (budgets adjusted once, then frozen), and agreed QV4 and QV5. Nothing in this plan starts before owner step **OV-1** (section 0.5), and nothing starts before Stages 2, 3 and 4 are merged into `main`.

---

## 0. Conventions

### 0.1 Task tags and tiers

- **[AGY]**: the task is specified fully enough to hand to the agy backend through `/agy-implement` (one worktree) or `/agy-parallel` (several clusters). It always runs in three stages: a **haiku** stage runs the `agy -p` command and returns the diff stat, test output and exit status; a **sonnet** stage implements the task only if agy failed or refused, and records that it did; an **opus** stage (a [CLAUDE] verify) checks the diff against the task's allowlist, runs the acceptance check, and looks for weakened or deleted assertions and for edits to [CLAUDE] tests. On an [AGY] task, "Tier" names the tier that does the work if agy fails. The verify stage is always opus and is part of the task.
- **[CLAUDE]**: tests that define acceptance, licence text, work the plan cannot fully specify (editing three's shader chunks, tuning a look against pictures, deciding where decoration may stand), and every verification. Tests that define acceptance for an [AGY] task are their own [CLAUDE] task and come first.
- **[OWNER]** and **[HUMAN]**: a decision only the owner can make, or something a person has to look at in the running game. These are not agent tasks. Every slice ends with one.
- Agents never merge, tag, push or open pull requests. The main session merges after verification. No commit carries an AI attribution trailer (owner's global rule).

Tiers used in this plan, with the reason for every opus that is not a verify:

| Tier | Tasks |
|---|---|
| haiku | Every agy run; V2's command runs and captures; every capture run at a checkpoint (following V1c's procedure) |
| sonnet | Every [AGY] fallback; the test tasks written from a clear table (V1a, LT1, AR1, WT1, GR1, WX1, UI2, UI8a, FX1); V1c (writing and proving the capture procedure) |
| opus | Every verify; **R0** (judging whether the design's premises still hold); **LT3** and **LT4** (rewriting the light model inside three's chunk text, and the tests that pin it); **AR2** (fog chunk replacement across five shaders); **GR3** (the boundary test for generated decoration); **TR1** (the boundary test for trees that change walkability, a game rule); **GR6** (a vertex shader that reads the ground field); **LT7**, **GR7** (tuning a look against pictures); **UI1** (licence text); **G-5** |
| fable | none |

### 0.2 Commands

Run every command from the worktree root, in a shell started with an allowlisted environment: `env -i HOME="$HOME" PATH="$PATH" XDG_RUNTIME_DIR="$XDG_RUNTIME_DIR" DBUS_SESSION_BUS_ADDRESS="$DBUS_SESSION_BUS_ADDRESS" bash`.

| Name | Command | Expected |
|---|---|---|
| SUITE | `systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 env TEST_CONCURRENCY=4 npx vitest run` | exit 0; every test passes |
| ONE(file) | the same wrapper with `npx vitest run <file>` | as stated in the task |
| TYPES | the same wrapper with `npx tsc --noEmit` | exit 0, no output |
| BUILD | the same wrapper with `npm run build` | exit 0; the JS and CSS sizes are reported and recorded by the task |
| SERVE | the same wrapper with `npx vite preview --port 4173` after BUILD | used only by capture runs; one at a time on the machine |

**Standard gate (SG)**: SUITE, TYPES and BUILD all pass. Every task below ends with SG unless it says otherwise. A wrapper OOM kill means a defect to fix. Never raise the cap.

**Capture run (CAP(poses, tiers))**: the procedure written and proven by V1c (`docs/superpowers/baseline/stage5/capture.md`), run with the Playwright browser tools available to the main session; no new dependency. With SERVE up, the browser opens the game in a throwaway profile, an init script seeds `Math.random` before any game script, the onboarding window is dismissed, the run waits until `__DEBUG.look.ready()` is true, and for each tier and each named pose and time it calls `__DEBUG.look.tier(id)`, `look.pose(row)`, `look.phase` (or `look.preset` before LT5a), `look.weather`, `look.hud(false)`, waits 2 s and saves a JPEG to `docs/superpowers/baseline/stage5/<slice>/<pose>-<time>-<tier>.jpg`, plus the perf HUD's calls and triangles to `<slice>/perf.md`. Headless captures run on a software renderer: pictures are valid, frame times are not. Frame times come only from `look.bench` on the owner's GPU.

### 0.3 Rules that apply to every task

1. **Allowlist.** A task touches only the files listed for it. The opus verify rejects a diff with any other file in it.
2. **Anchors.** Line numbers are from `a8cad85` and are hints. Find every symbol by name. R0 records the new lines.
3. **Existing tests are frozen.** "Existing" means every file under `tests/` and `src/__tests__/` on `main` at R0. No edit to any of them, except the declared replacements of design 8.3: two in `tests/textures.test.ts` (task LT3) and, only if CALL-V13 is taken, `tests/globals.test.ts` and `tests/vercel-headers.test.ts` (task UI8a). A new test goes in a new file under `tests/`.
4. **Test-first pairs.** A [CLAUDE] test task may leave SUITE red in its new files, and TYPES and BUILD red only because a module, export, field or union member that the paired task adds does not exist yet (plan rule 0.3.4 of the foundation plan, unchanged). The paired task's accept restores SG.
5. **Commit format.** `<kind>(<area>): <what>`, kinds `test`, `feat`, `tune`, `fix`, `chore`, `docs`; a fix names its finding: `fix(#23): track projected UVs in a WeakSet`. Areas: `light`, `air`, `water`, `ground`, `weather`, `ui`, `fx`, `gfx`. Tune commits change constants only.
6. **No model, texture or dependency change.** `git diff main -- public/models public/textures` is empty at every task, and `package.json` `dependencies` is unchanged. Imports from `three/examples/jsm/` are allowed. The only new binary assets are the font files of UI1.
7. **Shader text is built from constants.** GLSL strings are composed only from string constants and from the closed set of `#define`s in `GFX_TIERS`. No value from the save, the DOM or the URL is concatenated into a shader.
8. **Counts come from the tier table.** Every instance, particle and light count and every map size is read from `GFX_TIERS` in `src/data/look.ts`. A literal count in engine code is a defect.
9. **Determinism.** `src/state/scatter.ts`, `weather.ts`, `src/engine/floraKit.ts` and `scripts/place-woods-trees.ts` never call `Math.random`; they use a seeded generator passed in. `src/data/woodsTrees.ts` holds only literals.
10. **Module rules of the foundation design hold**: no file under `src/` over 1000 lines; every module imports in `node` without throwing and runs nothing at import time; `src/data` and `src/state` do not import `three` and do not mention `document` or `window`.
11. **No new `innerHTML` sink.** New interface code builds DOM with elements and `textContent`.
12. **Machine budget.** At most 3 agents at a time, one BUILD at a time, one SERVE at a time, across every worktree on the machine.

### 0.4 Branches, worktrees, lanes

- The **spine** runs on `feat/visual-pass`, one task after another: R0, V1, V2, then the lanes LT (light), AR (air), GR (ground), WT (water), WX (weather), FX (effects). They share `materials.ts`, `renderer.ts`, `loop.ts`, `worldMesh.ts` and `look.ts`, so none of them runs in parallel with another.
- Lane **UI** runs in its own worktree, `../osrs-like-vp/UI`, on the local branch `vp/UI`, cut from the spine head after V2. It can run in parallel with the whole spine. `vp/UI` is never pushed.
- Files per lane (the check that no two parallel lanes share a file):

| Lane | Files |
|---|---|
| Spine | `src/data/look.ts`, `src/state/dayCycle.ts`, `shadowFit.ts`, `weather.ts`, `scatter.ts`, `waterGrid.ts` (all new); `src/engine/lighting.ts`, `atmosphere.ts`, `sky.ts`, `water.ts`, `batching.ts`, `floraKit.ts`, `flora.ts`, `particles.ts`, `post.ts`, `photo.ts` (all new); `src/engine/materials.ts`, `textures.ts`, `renderer.ts`, `loop.ts`, `context.ts`, `worldMesh.ts`, `worldBuild.ts`, `blenderWorld.ts`, `spawns.ts`, `vfx.ts`; `src/engine/runtime.ts` (V1b only, one line); `src/data/woodsTrees.ts`, `scripts/place-woods-trees.ts` (new) and the Stage 2 file `src/state/collision.ts` (TR2 only) |
| UI | `index.html`, `src/ui/styles.css`, `src/ui/fonts/` (new), `src/ui/hud.ts`, `stations.ts`, `playerActions.ts`, `src/ui/scrollSnapshot.ts` (new), `src/engine/overlay.ts`, `src/engine/input.ts`, `CREDITS.md`; UI8b only: `src/engine/runtime.ts`, `vercel.json` |

`runtime.ts` is the one shared file: V1b lands before the UI lane is cut, and UI8b is the lane's last task.

- Merge into `feat/visual-pass`: the spine is linear. `vp/UI` rebases onto the spine head and merges after CP-UI, at any point between two spine tasks.
- Order of slices: light, air, ground, water, weather, then effects. Ground comes before water because vegetation and place-making are the larger part of the environment the owner asked for, and merging (GR2) pays for the draws every later slice adds. The interface slice runs beside them. Each slice ends with a checkpoint the owner can accept, send back or hold; a held slice does not block the next one, except that the light slice comes first.

### 0.5 Owner and human steps (where they block)

| Step | What the owner decides or does | Blocks |
|---|---|---|
| OV-1 | Approve the design: CALL-V1 (essence, now with the one game-rule exception of CALL-V9), V2 (cut world, round figures), V5 (tier table), V6 (budgets, provisional), V14 (two test replacements), V16 (ledger), V17 (composer on the upper tiers only). Already decided on 2026-11-14: V18 (Low, Medium, High, Ultra), V19 (smooth), V20 (adjusted once, then frozen). | Everything |
| OV-2 | `look.bench` frame times on the owner's computer at poses P1, P3, P5 and P8 on each tier. At this first timing the owner names the reference machine, GPU and display (QV5, agreed 2026-11-14). Part of V2. Then, per CALL-V20 (decided 2026-11-14), the lead adjusts the budgets of design section 10 and the tier numbers once to what was measured; the result is written into design section 10 and frozen. | LT1 |
| OV-3 | **CALL-V4**: the night floor. (CALL-V3 / QV1 decided 2026-11-14: the running clock.) | LT2 |
| OV-4 | **CALL-V8**: no new model. (CALL-V9 / QV3 decided 2026-11-14: woods trees block walking, design 6.11.) | GR3 |
| OV-4b | **CALL-V21 / QV9**: may a trunk stop a chasing monster (cover), or should monster chase use the walk grid? If the walk grid: the stage stops before TR2 and a Stage 2 monster-movement task is planned first, because `monsterAi.ts` is Stage 2 code. | TR2 |
| OV-5 | **CALL-V10**: the weather set. | WX1 |
| OV-6 | **CALL-V11, V12**: the type system and the interface identity. | UI1 |
| OV-7 | Pick the two font families from UI1's report (QV4). | UI3 |
| OV-8 | **CALL-V13 / QV2**: inline handlers and the full policy now, or Stage 7. **Decided 2026-11-14: now.** | UI8a |
| OV-9 | **CALL-V15**: effects restyled in shape and colour only. | FX1 |
| CP-LT, CP-AR, CP-GR, CP-WT, CP-WX, CP-UI, CP-FX | [OWNER] looks at the slice's before and after pictures and answers accept, change or hold. | the slice's merge is final only after it; the next slice may start |
| OV-10 | Accept Stage 5 (after G-5 and G-6). | the pull request |

CALL-V9 took the alternative (trees that block) on 2026-11-14. The design was amended in its section 6.11, and tasks TR1 and TR2 below carry it out. If another owner answer takes the alternative: **V8 a Blender kit**: task GR8 is added after CP-GR (a `scripts/blender/build_flora.py`, a `flora.glb` of at most 90 kB on the wire, loaded with `loadGltfOnce`, replacing the crag and backdrop-tree pieces of `floraKit.ts`; the five existing GLBs stay untouched). **V13 no**: UI8 is skipped and the main session writes the second deferral of finding 5's script policy to Stage 7 into the foundation design's section 9. **V15 no**: lane FX is skipped. **V21 walk-grid chase**: see OV-4b.

---

## 1. Prerequisites (spine, serial)

### R0 Re-anchor [CLAUDE]
- **Tier**: opus (it decides whether the design still stands).
- **Depends**: OV-1; Stages 2, 3 and 4 merged into `main`.
- **Files**: `docs/superpowers/plans/2026-11-14-visual-pass-plan.md` (a new section "Anchors" at the end), `docs/superpowers/specs/2026-11-14-visual-pass-design.md` (corrections only).
- **Change**: the main session rebases `feat/visual-pass` onto `main`. Then, reading only:
  1. Record the new line of every symbol this plan cites.
  2. Confirm the five facts of design section 1: `facetMaterial` still discards `reflectedLight`; `renderer.info` is still reset after the shadow pass (`node_modules/three/src/renderers/WebGLRenderer.js`); `cycleTimeOfDay` still writes only sky and fog; the sky, water and grass shaders still lack the tone-mapping and colour-space chunks; `cloneWorldNode` still keeps one mesh per GLB mesh.
  3. Read what Stage 2 did to `worldMesh.ts`, `getBiomeColor`, the grass block and `worldMap.ts`, and what Stage 4 did to `vfx.ts` and `loop.ts`. List every place where a task below must change.
  4. List the test files that exist on `main` now: that list is "existing tests" for rule 0.3.3. Check whether any of them imports `grassMaterial`, `buildSkyDomeShader`, `G.grassInstanced`, `G.waterUniforms` or `G.skyUniforms`; if one does, the export stays as a thin wrapper and the task that would remove it says so.
  5. Check `three`'s installed version is 0.169.x, that `lights_lambert_pars_fragment`, `lights_fragment_begin` and `normal_fragment_begin` still read as design 6.1 says, and that `Material.customProgramCacheKey` is still `onBeforeCompile.toString()`.
  6. Scan `index.html` and `src/` again for `on<event>=` attributes and `<script` tags; UI8 assumes 38 `onclick` attributes and one external module script.
  7. Check the Stage 2 data this plan reads by name: `PATHS`, `RIDGES`, `BASINS`, `POIS` and `CAMPS` in `src/data/worldMap.ts` are non-empty (on `feat/world-place` at the time of the critique, the first four were still empty arrays); every POI the design names (Three Kettle Camp, Wardstone Cairn, Cinderstep Pass, Reedglass Tarn, Tamarisk Pool, Lampwright's Hollow, Slagfall Terrace, Millrace Road) exists with a `padRadius`; `isWalkable`, `regionAt`, `riverCenterX` and the walk grid exist; record the walkable bound (118 at `a8cad85`, `collision.ts` 47).
  8. Re-read the live camera limits in `input.ts` (pitch 0.12 to 1.15, distance 3.6 to 26 at `a8cad85`) and `spawnWorldProp`'s material handling; V1a, LT1 and LT5b depend on them.
  9. Re-check the walking premises of design 6.11 on `main`:
     - `isWalkable` in `collision.ts` is still the one predicate behind `buildWalkGrid`, the ground click, minimap and "Walk here" checks, `moveWithCollision` and `sanitizePose`;
     - the hover tile still raycasts the terrain only, and the click ray still tests only `G.worldInteractiveObjects`;
     - `G.walkGrid` is built once from it;
     - the walk grid is still 1-unit cells over ±118 with no corner cutting;
     - `stepMonster` still walks straight through `moveWithCollision` and does not path-find;
     - `sanitizePose` still searches rings from 0.5 units.
     Record the stop distances of Stage 2's task B3 per target kind (2.9, 13.5, 3.1, 3.5 at the time of the design) and which kind each uses. Record that no station other than the woods shrine lies in the `woods` region, and that `node_modules/.bin/esbuild` exists (TR2 runs its script with it; `npx` must not download anything). Record the list of frozen Stage 2 tests that read `isWalkable`: reachability, relief, world data, pathfinding, save relocation, world budget.
- **Accept**: the "Anchors" section exists and covers every cited symbol. A written "premises hold" or a list of what changed. If fact 1 or 5 no longer holds, or a check of step 7 or 9 fails, the stage stops and the design is amended before any task starts. If monsters now path-find, CALL-V21 is moot, and R0 says so.
- **Must not change**: anything under `src/`, `tests/` or `public/`.

### V1a Pose and tier-count tests [CLAUDE]
- **Tier**: sonnet (written from design 8.2).
- **Depends**: R0.
- **Files**: `tests/photo-poses.test.ts` (new), `docs/superpowers/baseline/stage5/poses.json` (new).
- **Change**: `poses.json` holds the twelve poses of design 8.2 as rows `{ id, place, yaw, pitch, distance, times: string[], weather?: string }`, where `place` is a `POIS` id or a `WORLD_REGIONS` id. Tests: `every pose names a known place`; `every pose is inside the live camera limits` (pitch 0.12 to 1.15, distance 3.6 to 26, the clamps in `input.ts`, as recorded by R0; not `sanitizeCam`, which only clamps a saved camera); `P10 has eight yaws 45 degrees apart at pitch 0.12 and distance 26, plus eight from the walkable corner`; `every time is one of night, dawn, morning, noon, golden, dusk`.
- **Accept**: `ONE(tests/photo-poses.test.ts)` passes; SG.
- **Must not change**: `src/`.

### V1b Photo hooks, bench, and the honest call counter [AGY]
- **Tier**: sonnet.
- **Depends**: V1a.
- **Files**: `src/engine/photo.ts` (new), `src/engine/runtime.ts`, `src/engine/loop.ts`.
- **Change**:
  - `photo.ts` exports `createLookHooks()` returning `{ ready(): boolean, pose(row: { place: string; yaw: number; pitch: number; distance: number }): void, preset(n: 0 | 1 | 2): void, hud(on: boolean): void, tier(id: QualityTier): void, bench(frames: number): number }`. `tier` calls `applyQualityTier` and sets an exported flag that the governor (AR4b) reads as "the player chose". `bench` renders the current scene and camera `frames` times back to back with `G.renderer.render`, calls `gl.finish()` once, and returns the mean milliseconds per frame measured with `performance.now()`; `frames` is clamped to 1..600. The capture driver reads `poses.json` and passes each row; the game does not import it. `pose` resolves the place to coordinates from `POIS` or `WORLD_REGIONS` (an unknown place throws), sets `player.pos` on the terrain, clears the waypoint list, and sets `camState.yaw`, `pitch` and `distance` through `sanitizeCam`. `preset` calls `cycleTimeOfDay` until `STATE.timeOfDay` equals `n`. `hud(false)` sets `hidden` on the HUD's root elements and `hud(true)` clears it; no stylesheet edit. `ready` is true once the world GLB promise has settled. Every DOM access is inside these functions, so the module imports in `node`.
  - `runtime.ts`: the object assigned to `window.__DEBUG` (line 190 at `a8cad85`) gains `look: createLookHooks()`. Nothing else.
  - `loop.ts`, `renderFrame`: set `G.renderer.info.autoReset = false` once, call `G.renderer.info.reset()` at the start of each frame, and write `perf-calls` as `<calls> calls • <tris>k tris`, now including the shadow pass. Add `telemetryInfo.calls` and `telemetryInfo.triangles` so a capture can read them.
- **Accept**: SG. `ONE(tests/architecture.test.ts)` passes (the new module imports in `node`).
- **Must not change**: any rendering result; `index.html`.

### V1c Capture procedure [CLAUDE]
- **Tier**: sonnet (a written procedure, proven once).
- **Depends**: V1b.
- **Files**: `docs/superpowers/baseline/stage5/capture.md` (new).
- **Change**: write CAP (section 0.2) as an exact step list for the Playwright browser tools the main session has (open, an init script that replaces `Math.random` with a seeded generator before the page's scripts, onboarding dismissal by its element id, `look.ready()` polling with a 60 s limit, the hook calls, JPEG save paths, the perf HUD read). No new dependency and no file under `src/`. Prove it once: capture P1 at noon on performance and balanced into `stage5/proof/`.
- **Accept**: the two proof pictures exist and differ in shadow (balanced has a shadow pass); the procedure file names every step.
- **Must not change**: `src/`, `tests/`, `package.json`.

### V2 Baseline capture [CLAUDE] + [OWNER]
- **Tier**: haiku (runs and records).
- **Depends**: V1c.
- **Files**: `docs/superpowers/baseline/2026-11-14-stage5-baseline.md` (new), `docs/superpowers/baseline/stage5/before/*`.
- **Change**: record BUILD's JS and CSS sizes. Run CAP over P1 to P10 at presets 0, 1 and 2 (golden, noon, night) and P11 at its four sizes; these are the "before" pictures. Record per pose and per tier: calls and triangles with shadows on, and calls on the performance tier (shadows off); the difference is the shadow pass. The owner (OV-2) runs `__DEBUG.look.bench(300)` on their GPU and display at P1, P3, P5 and P8 on each tier, records the milliseconds, and names that computer, its GPU and its display as the reference machine (QV5). Per CALL-V20 (decided 2026-11-14), the lead then adjusts the budgets and tier numbers once to the measurement.
- **Accept**: the baseline file holds every number above and the owner's. From here on, "the V2 chunk", "the V2 capture" and "the V2 bench" in design section 10 mean these numbers. The main session writes the adjusted budgets into design section 10 (one `docs` commit) before LT1; from then on they are frozen.
- **Must not change**: `src/`, `tests/`.

---

## 2. Slice 1, lane LT: light, shadow, sky

What the owner gets: shadows on screen for the first time, a sun that moves, five times of day, cut terrain and props. Cost (estimate): about +0.3 ms, +1 draw call, about +14 kB of JS.

### LT1 Day-cycle, tier and shadow-fit tests [CLAUDE]
- **Tier**: sonnet (written from design 5.3, 6.2, 10).
- **Depends**: V2, OV-3.
- **Files** (all new): `tests/day-cycle.test.ts`, `tests/look-data.test.ts`, `tests/gfx-tiers.test.ts`, `tests/shadow-fit.test.ts`.
- **Change**: the G5.2, G5.3 and G5.12 rows of design 8.1, against these exports:
  - `src/data/look.ts`: `DAY_KEYS: DayKey[]` (the six rows of design 5.3: `phase`, `sunElevationDeg`, `key`, `keyIntensity`, `zenith`, `horizon`, `air`, `fill`, `bounce`, `exposure`, colours as `#rrggbb` strings); `DAY_CLOCK = { dayMinutes: 24, nightSpeed: 2, sunDownBelow: 0.22, sunDownFrom: 0.82 }`; `PRESET_PHASE = [0.70, 0.50, 0.00]`; `GFX_TIERS: Record<'performance' | 'balanced' | 'high' | 'ultra', GfxTier>` with one field per row of the design's tier table; `HORIZON_APRON = { inner: 130, outer: 240 }` (inner is the terrain's half-size); `CAMERA_FAR = 460`; `SKY_DOME_RADIUS = 440`; `CAMERA_LIMITS = { pitchMin: 0.12, pitchMax: 1.15, distanceMin: 3.6, distanceMax: 26 }` and `WALK_BOUND = 118` (the values R0 recorded); `SHADOW_SUN_STEP_DEG = 0.5`.
  - `src/state/dayCycle.ts`: `dayFrameAt(phase: number): DayFrame` (linear RGB triples, `sunDir: [x, y, z]`, `keyIsMoon: boolean`); `stepPhase(phase, dtSec, clock)`; `presetToPhase(n)`; `phaseToPreset(phase)`; `litGroundValue(frame, albedoValue)`.
  - `src/state/shadowFit.ts`: `fitShadow(cam: Vec3, forward: Vec3, lightDir: Vec3, range: number, mapSize: number): { target: Vec3, lightPos: Vec3, texel: number }`; `stepShadowDir(current: Vec3, sun: Vec3, stepDeg: number): Vec3` (returns `current` while the angle to `sun` is at most `stepDeg`, else `sun`).
  - `look-data.test.ts` in this task holds: every `DayKey` is complete and its colours parse; phases ascend; `litGroundValue` is at least 0.22 for every key on albedo 0.30; `WALK_BOUND * Math.SQRT2 + CAMERA_LIMITS.distanceMax + HORIZON_APRON.outer < CAMERA_FAR`; `SKY_DOME_RADIUS < CAMERA_FAR`; `HORIZON_APRON.inner` equals the terrain's half-size (130). `shadow-fit.test.ts` also: `stepShadowDir` holds below the step and snaps beyond it. Every table-driven test asserts the row count first.
- **Accept**: red until LT2, within rule 0.3.4.
- **Must not change**: `src/`.

### LT2 Look data, day cycle, shadow fit [AGY]
- **Tier**: sonnet.
- **Depends**: LT1.
- **Files**: `src/data/look.ts`, `src/state/dayCycle.ts`, `src/state/shadowFit.ts` (all new).
- **Change**: implement the exports LT1 names, with the values of design 5.3 and 10. `dayFrameAt` interpolates colours in OKLab between neighbouring keys and wraps from the last key to the first. The sun moves on a circle tilted so that near phase 0.58 its direction is within 5 degrees of (0.52, 0.78, 0.34); below the horizon the moon (opposite side, elevation 50 at phase 0) is the key and `keyIsMoon` is true; the key intensity fades through zero where they hand over. `look.ts` also exports the empty tables later lanes fill, so their tests compile: `REGION_LOOK = []`, `WEATHER = []`, `FLORA_RULES = []`, `KIT_PIECES = []`, `EMITTERS = []`. The clock runs (CALL-V3, decided 2026-11-14).
- **Accept**: the four LT1 test files pass; `ONE(tests/architecture.test.ts)` passes with layering; SG.
- **Must not change**: any existing file.

### LT3 Light-model tests and the two declared replacements [CLAUDE]
- **Tier**: opus (these assertions pin edits to three's chunk text, and two frozen assertions are replaced).
- **Depends**: LT2.
- **Files**: `tests/facet-light.test.ts` (new), `tests/textures.test.ts` (the two replacements of design 8.3 only).
- **Change**:
  - `facet-light.test.ts`, compiling through `mat.onBeforeCompile` with `THREE.ShaderLib.lambert` as `textures.test.ts` does: `three's lambert fragment still includes lights_lambert_pars_fragment and fog_fragment` (the guard for design risk X2); `facetMaterial replaces RE_Direct_Lambert with a banded response` (the text contains `facetBand(` and no `BRDF_Lambert( material.diffuseColor )`); `the Lambert sum is used again` (contains `reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance`); `shade cut sets flatShading and three bands`; `shade round keeps smooth normals and two bands`; `the default shade is round`; `terrainMaterial declares uFacet, defines FACET_BLEND, does not set flatShading, and still samples the eight ground maps`; `the foot gradient is off when uFootHeight is 0`; `customProgramCacheKey differs between terrainMaterial, a cut facetMaterial and a round facetMaterial` (the carpet joins this case in GR6).
  - `textures.test.ts`: in "cel-shades the sampled diffuse color and leaves the ink outline alone", the three assertions on the fixed tint line, the fixed `smoothstep` and the absent Lambert sum become `toContain('facetBand(')` and `toContain('reflectedLight.directDiffuse + reflectedLight.indirectDiffuse + totalEmissiveRadiance')`. In "blends grass, dirt, sand, and stone in the terrain cel shader", the fixed tint line becomes `toContain('facetBand(')`. Nothing else in the file changes.
- **Accept**: red until LT4. The opus verify reads `git diff -- tests/textures.test.ts` and finds exactly those four assertions replaced.
- **Must not change**: any other assertion in `textures.test.ts`.

### LT4 The banded light inside `facetMaterial` [CLAUDE]
- **Tier**: opus. This is [CLAUDE] because it rewrites text inside three's shader chunks, which a prompt cannot fully specify, and every surface in the game depends on it. A separate opus verify still checks it.
- **Depends**: LT3.
- **Files**: `src/engine/materials.ts`, `src/engine/textures.ts`.
- **Change**: design 6.1. In `facetMaterial`: delete the `outgoingLight` replacement; replace `#include <lights_lambert_pars_fragment>` with a copy whose `RE_Direct_Lambert` is `reflectedLight.directDiffuse += facetBand(dotNL) * directLight.color * material.diffuseColor;` and whose indirect term drops the division by pi; `facetBand` is three steps (0.15 and 0.55, values 0.22, 0.62, 1.0, each 0.04 wide) under `#define FACET_CUT`, two steps (0.35) otherwise. New parameter `shade: 'cut' | 'round'`, default `round`; `cut` sets `flatShading: true` and `material.defines.FACET_CUT`. Every variant is a key in `material.defines`, never text picked in a closure, because three's program cache key is `onBeforeCompile.toString()` plus the defines. A new parameter `facetBlend` (a number; absent means the plain `cut` or `round` behaviour) sets `#define FACET_BLEND` and a `uFacet` uniform, keeps `flatShading` off (with `FLAT_SHADED` three declares no `vNormal`), and after `normal_fragment_begin` sets `normal = normalize(mix(normal, faceNormal, uFacet))` with `faceNormal` from `cross(dFdx(vViewPosition), dFdy(vViewPosition))`; `terrainMaterial` passes 0.7 and not `shade: 'cut'`. Every patched material sets `customProgramCacheKey` to a string joined from constant tags of its chain (`facet|cut`, `facet|round`, `facet|blend|terrain`); later hooks (`attachAtmosphere`, the carpet) append their tag. A new parameter `footHeight` (default 0) sets a `uFootHeight` uniform; when it is above 0, an object-space height varying multiplies `diffuseColor` by `mix(0.75, 1.0, smoothstep(0.0, uFootHeight, height))`. The `vCelNormal` code and the old `flatNormal` branch are removed. `metalness`, `roughness`, `map` handling and `userData.albedoSpace` stay as they are.
- **Accept**: `ONE(tests/facet-light.test.ts)` and `ONE(tests/textures.test.ts)` pass; SG.
- **Must not change**: `addCartoonOutline`, the outline material, `TERRAIN_SAMPLE`'s map sampling, any texture id.

### LT5a The light rig, the clock, visible shadows [AGY]
- **Tier**: sonnet.
- **Depends**: LT4.
- **Files**: `src/engine/lighting.ts` (new), `src/engine/renderer.ts`, `src/engine/loop.ts`, `src/engine/context.ts`, `src/engine/worldMesh.ts` (`cycleTimeOfDay` only), `src/engine/photo.ts`.
- **Change**:
  - `lighting.ts`: `initLighting()` creates the key `DirectionalLight`, the `HemisphereLight` and a small constant `AmbientLight` (replacing the three in `init3DEngine`, which keeps `G.sunLight`, `G.hemiLight`, `G.ambientLight` pointing at them); `updateLighting(dt)` steps the phase with `stepPhase`, applies `dayFrameAt` to the lights and to `G.renderer.toneMappingExposure`, clamps the cast direction at 12 degrees of elevation, passes it through `stepShadowDir` (the key's shading direction follows the true sun, the shadow light's direction the stepped one), places the light with `fitShadow`, and writes `STATE.timeOfDay = phaseToPreset(phase)` when it changes; `setPhase(p, frozen)`; `applyShadowTier(tier)` sets map size and range from `GFX_TIERS`, disposes the old map (`shadow.map.dispose(); shadow.map = null`), sets `shadowMap.type = THREE.PCFShadowMap`, and sets `bias` and `normalBias` from `look.ts`.
  - `renderer.ts`: `init3DEngine` calls `initLighting()`; `applyQualityTier` calls `applyShadowTier` and no longer sets `PCFSoftShadowMap`.
  - `loop.ts`: the three sun-follow lines at the end of `updateCamera` are removed; `updateLighting(f.dt)` is called once per frame before `renderFrame`.
  - `worldMesh.ts`: `cycleTimeOfDay` keeps its contract (`STATE.timeOfDay = (n + 1) % 3`, the same three button labels) and now calls `setPhase(presetToPhase(n), false)`; its sky and fog writes are removed (LT6 owns the sky).
  - `photo.ts`: add `phase(p: number)`, which calls `setPhase(p, true)`.
- **Accept**: SG. `grep -n "PCFSoftShadowMap" src/engine` prints nothing. `grep -n "sunLight.position.set" src/engine/loop.ts` prints nothing.
- **Must not change**: the save's keys; the three preset labels; any material.

### LT5b The cut world [AGY]
- **Tier**: sonnet.
- **Depends**: LT5a.
- **Files**: `src/engine/worldMesh.ts` (terrain and bridge only), `src/engine/worldBuild.ts`, `src/engine/blenderWorld.ts`, `src/engine/spawns.ts`.
- **Change**:
  - `blenderWorld.ts` (`applyWorldMaterials`), the builders in `worldBuild.ts`, the tree, rock and bridge builders in `spawns.ts` and `worldMesh.ts`: every `facetMaterial` and `albedoMaterial` call for world geometry passes `shade: 'cut'`. `footHeight` is not passed yet: object-space height is per child mesh until GR2 merges props.
  - `spawnWorldProp` (`worldBuild.ts`) calls `applyWorldMaterials` on its clone (export it from `blenderWorld.ts`), so its props stop keeping the GLB's `MeshStandardMaterial`; it keeps its own `castShadow` and `receiveShadow` settings.
  - The terrain mesh gets `castShadow = true` when the tier says so, and its index buffer alternates the quad diagonal like a checkerboard. Positions, heights, vertex colours and UVs are unchanged.
  - Hero, guard, monster and gear code is not touched.
- **Accept**: SG. The opus verify confirms `spawnWorldProp` now passes its clone through `applyWorldMaterials`, and confirms no call site in `humanoid.ts`, `blenderHero.ts`, `blenderMonsters.ts`, `monsterMeshes.ts`, `blenderGear.ts`, `playerGear.ts` or `playerMesh.ts` changed.
- **Must not change**: terrain heights (`tests/terrain-golden.test.ts` passes untouched); node and material names looked up in the GLB.

### LT6 Sky, and the colour pipeline of the custom shaders [AGY]
- **Tier**: sonnet.
- **Depends**: LT5b.
- **Files**: `src/engine/sky.ts` (new), `src/engine/atmosphere.ts` (new), `src/engine/worldMesh.ts`, `src/engine/materials.ts` (`grassMaterial` only), `src/engine/renderer.ts`, `src/engine/loop.ts`, `src/engine/context.ts`.
- **Change**:
  - `atmosphere.ts`: export the shared uniform objects (colour values linear; `Color.setHex` converts) `AIR = { uSunDir, uKeyColor, uAirColor, uAirSunColor, uZenith, uHorizon, uFill, uTime, uWind, uFogDensity, uFogHeightFalloff, uFogBase, uRegionTint }` (each `{ value }`), `updateAir(frame, dt)`, and the string `COLOR_FOOTER` (`#include <tonemapping_fragment>` then `#include <colorspace_fragment>`). The fog function arrives in AR2.
  - `sky.ts`: `buildSky()` replaces `buildSkyDomeShader`. One dome `ShaderMaterial` that reads `AIR`: three-stop gradient, a horizon glow toward `uSunDir`, sun and moon discs as `step` edges with one halo step, stars from a hash of the direction with a hard threshold, drawn only when `uNight` is above 0; `dithering: true`; ends with `COLOR_FOOTER`. The dome's radius is `SKY_DOME_RADIUS`. `updateSky()` keeps the dome centred on the camera. `scene.fog`'s colour and density follow the frame. `renderer.ts`: the camera's far plane is `CAMERA_FAR` from `look.ts`.
  - `worldMesh.ts`: `buildSkyDomeShader` is removed (or kept as a wrapper if R0 said a test imports it); the water shader ends with `COLOR_FOOTER`.
  - `grassMaterial`: its `uLightDir` and tint uniforms are replaced by `AIR.uSunDir` and `AIR.uKeyColor`; it ends with `COLOR_FOOTER`.
- **Accept**: SG. `grep -n "0.52, 0.78, 0.34" src/engine` prints nothing.
- **Must not change**: the water's geometry and position; the grass count (GR6 replaces both).

### LT7 Look development: light [CLAUDE]
- **Tier**: opus (a look tuned against pictures and numbers).
- **Depends**: LT6.
- **Files**: `src/data/look.ts` (values of `DAY_KEYS`, shadow `bias` and `normalBias` only), `src/engine/materials.ts` (the band constants and `facetBlend` only).
- **Change**: run CAP over P1 (noon, golden, night), P3 (golden), P5 (noon, night) and P12. Tune until, in the P1 noon picture, a lit meadow pixel is 55 to 65% value and a shadowed one 30 to 38%; at P1 night the lit ground is at least 22%; no shadow acne on the terrain; no band flicker on the flat ground of the start town; shadow edges do not swim during a minute of running clock at P12. Texel magnification stays smooth (CALL-V19, decided 2026-11-14). Each tune commit changes constants only and leaves the LT1 and LT3 tests green.
- **Accept**: SG; the pictures and the measured pixel values are in `docs/superpowers/baseline/stage5/light/`.
- **Must not change**: hues' direction (design 5.3), any logic, the texture filters.

### CP-LT Light checkpoint [OWNER]
The owner compares `before/` and `light/` at P1, P3 and P5 and watches P12 live. Should see: shadows under every object, long at golden hour; the ridge's shadow at P3; a blue, readable night; planes on rock, trees and ground; round figures. Answers accept, change (back to LT7) or hold.

---

## 3. Slice 2, lane AR: air, horizon, clouds, output

What the owner gets: depth in three planes, fog that pools and leans to the sun, a closed horizon, drifting clouds and their shadows, glow on emissive things (upper tiers). Cost (estimate): direct path about +0.3 ms; composer tiers about +1.5 to 2.5 ms; +3 to +5 draw calls; about +19 kB of JS.

### AR1 Air, pixel-budget, governor and plain-mode tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: LT7.
- **Files**: `tests/air.test.ts`, `tests/plain-mode.test.ts` (new); `tests/gfx-tiers.test.ts`, `tests/look-data.test.ts` (new files of this plan, extended).
- **Change**: against `src/state/dayCycle.ts` `fogFactor(distance, height, frame): number` (the TypeScript twin of the GLSL, used to fill uniforms): monotonic in distance, halves every 9 units of height, equals plain exponential-squared fog when the height terms are 0. Against `src/engine/post.ts`: `effectivePixelRatio(tier, width, height, devicePixelRatio)` never exceeds the tier's ratio cap or megapixel cap; `nextTier(tier, frameTimesMs, { hidden, playerChose })` steps down once when the median of a 4 s window is above 24 ms, never up, stays at `performance`, returns the tier unchanged when the window saw the page hidden, and returns it unchanged for the rest of the session once the player chose a tier. Against `src/engine/atmosphere.ts`: the text of `AIR_GLSL` contains `applyAir`; a `facetMaterial` compiled through its hooks contains no `#include <fog_fragment>`, and `applyAir(` appears before `#include <tonemapping_fragment>`; its `customProgramCacheKey` ends in `|air`. `plain-mode.test.ts`: `enterPlainMode(scene)` is idempotent; `facetMaterial` built while plain mode is on contains no `facetBand(`; a facet material registered before `enterPlainMode(scene)` is replaced on its mesh by a `MeshLambertMaterial` with the same colour and map. `look-data`: `REGION_LOOK` has five rows, one per `WORLD_REGIONS` id, each with an air tint whose weight is at most 0.2; `BLOOM.threshold` is at least 1.15 times the brightest lit value over all `DAY_KEYS` (`litGroundValue` at albedo 0.75, full band, fill and bounce included).
- **Accept**: red until AR2, AR4a and AR4b.
- **Must not change**: `src/`.

### AR2 The air function in every shader [CLAUDE]
- **Tier**: opus (chunk replacement across the facet shader and four custom shaders, with a fallback that must equal today's fog).
- **Depends**: AR1.
- **Files**: `src/engine/atmosphere.ts`, `src/engine/materials.ts`, `src/engine/sky.ts`, `src/engine/worldMesh.ts`, `src/data/look.ts` (`REGION_LOOK`), `src/state/dayCycle.ts` (`fogFactor`).
- **Change**: design 6.3. `AIR_GLSL` holds `applyAir(vec3 color, vec3 worldPos)` and, under `#define CLOUD_SHADOW`, `cloudShade(vec2 xz)` (two octaves of value noise moved by `uWind * uTime`). `attachAtmosphere(material)` chains `onBeforeCompile`, assigns the shared `AIR` objects into `shader.uniforms`, adds a world-position varying that handles `USE_INSTANCING`, replaces `fog_pars_fragment`, removes `fog_fragment`, and inserts `outgoingLight = applyAir(outgoingLight, vAirWorld);` before `#include <opaque_fragment>`, so the air acts on linear radiance before tone mapping (design 6.3); it appends `|air` to the material's `customProgramCacheKey`. `facetMaterial` calls it and multiplies the key by `cloudShade` inside `RE_Direct_Lambert` when `material.defines.CLOUD_SHADOW` is set. `atmosphere.ts` keeps a list of the materials it attached, and `setAirTier(tier)` updates their defines and sets `needsUpdate`; `applyQualityTier` calls it. The sky, water and grass shaders include `AIR_GLSL` and call `applyAir` before `COLOR_FOOTER`. `updateAir` blends `REGION_LOOK` tints by distance to the region centres. `REGION_LOOK` gets the five rows of design 5.5.
- **Accept**: `ONE(tests/air.test.ts)` passes except the `post.ts` cases; the LT tests stay green; SG otherwise within rule 0.3.4.
- **Must not change**: `glowMaterial` and every `MeshBasicMaterial` (they keep `scene.fog`).

### AR3 Horizon apron and cloud solids [AGY]
- **Tier**: sonnet.
- **Depends**: AR2.
- **Files**: `src/engine/floraKit.ts` (new), `src/engine/sky.ts`.
- **Change**: `floraKit.ts` exports `makeRng(seed)` and `buildKitPiece(id, rng): THREE.BufferGeometry` for `cloud_a`, `cloud_b`, `cloud_c` (3 to 5 jittered icosahedra of detail 0 merged, vertex colours, at most 120 triangles) and `horizon_apron` (inner boundary the terrain's square edge at `HORIZON_APRON.inner`, its vertices sharing the terrain's edge heights from `getTerrainHeight`, rising to two rows of jittered hills out to radius `HORIZON_APRON.outer`, 600 to 800 triangles). `sky.ts` adds the apron as one mesh with a `cut` facet material tinted toward `uAirColor`, and the clouds as `InstancedMesh`es (count from `GFX_TIERS.clouds`), 60 to 90 units up, their instance matrices moved on the CPU each frame by the wind and wrapped inside the 260-unit square. Neither casts or receives shadows.
- **Accept**: SG; `floraKit.ts` contains no `Math.random`. CAP over P10 (both sets of eight yaws) on performance shows no void between terrain and apron.
- **Must not change**: the camera's far plane (set in LT6).

### AR4a Output path and pixel budget [AGY]
- **Tier**: sonnet.
- **Depends**: AR3.
- **Files**: `src/engine/post.ts` (new), `src/engine/renderer.ts`, `src/engine/loop.ts`, `src/data/look.ts` (`BLOOM` only).
- **Change**: design 6.10. `look.ts`: `BLOOM = { threshold, strength, radius }` with the threshold the AR1 rule requires. `post.ts`: `effectivePixelRatio` and `createOutput(renderer, scene, camera, tier)` returning `{ render(), setSize(), dispose() }`. For `performance` and `balanced`, `render` is `renderer.render`. For `high` and `ultra` it is an `EffectComposer` on a `WebGLRenderTarget` with `HalfFloatType` (or `UnsignedByteType` when the device cannot render to half float) and 4 samples (2 above 8.3 megapixels), a `RenderPass`, an `UnrealBloomPass` at half resolution with `BLOOM`'s values, and three's stock `OutputPass`. No custom output shader and no vignette. `renderer.ts`: `applyQualityTier` and `onWindowResize` use `effectivePixelRatio` and rebuild the output on a path change. `loop.ts`: `renderFrame` calls the output's `render`.
- **Accept**: the `post.ts` pixel-budget cases of `ONE(tests/air.test.ts)`, the `BLOOM` case of `ONE(tests/look-data.test.ts)` and `ONE(tests/gfx-tiers.test.ts)` pass; SG; BUILD's JS size is recorded.
- **Must not change**: `getQualityDpr`'s four caps; the perf HUD's ids.

### AR4b Governor, plain mode, tier labels [AGY]
- **Tier**: sonnet.
- **Depends**: AR4a.
- **Files**: `src/engine/post.ts`, `src/engine/renderer.ts`, `src/engine/loop.ts`, `src/engine/materials.ts` (registry and plain-mode branch only), `src/engine/atmosphere.ts` (plain-mode branch only), `src/engine/photo.ts`.
- **Change**: `post.ts`: `nextTier` as AR1 tests it; `enterPlainMode(scene)`, `isPlainMode`. `materials.ts`: every material `facetMaterial` patches is pushed, with its mesh-independent parameters, to a module-level list; `enterPlainMode` walks the scene and replaces every registered material on its mesh with a stock `MeshLambertMaterial` with the same colour, map, emissive, side and `vertexColors`, then turns off the composer, carpet, particles, clouds and water effects; in plain mode `facetMaterial` returns the stock material directly and `attachAtmosphere` does nothing. `renderer.ts`: `init3DEngine` sets `renderer.debug.onShaderError` to a handler that logs the program's info log with `console.error` (three no longer logs once a handler is set) and then calls `enterPlainMode`, and reads `new URLSearchParams(location.search).has('plain')` as a boolean. `loop.ts`: `renderFrame` feeds frame times and `document.hidden` to `nextTier` and applies a step down with one chat line. `cycleGraphicsQuality` marks the player's choice, which stops the governor for the session; `photo.ts`'s `tier` does the same. `syncGraphicsButtons` and the chat line show Low, Medium, High, Ultra for `performance`, `balanced`, `high`, `ultra` (CALL-V18, decided 2026-11-14); the `QualityTier` ids are unchanged.
- **Accept**: `ONE(tests/air.test.ts)`, `ONE(tests/plain-mode.test.ts)` and `ONE(tests/gfx-tiers.test.ts)` pass; SG.
- **Must not change**: the `QualityTier` ids; the perf HUD's ids; the graphics button's id.

### CP-AR Air checkpoint [OWNER]
CAP over P10 (both sets of eight yaws), P3 (golden), P4 (night), P1 (golden, noon), P2 (dawn) on the balanced and the high tier. Should see: three planes at every yaw of P10 and no map edge; mist low at P2 and the ridge's crest clear at P3; glow only on lava, lanterns and runes at P4, and only on the high tier (no lit sand or grass glowing at P1 noon on high); the same colours on both tiers apart from the glow, including where the sky meets the terrain. The owner also opens the game with `?plain` and sees a playable, plainly lit world.

---

## 4. Slice 3, lane GR: ground, vegetation, places

What the owner gets: a filled world. Meadow, verge, reeds, ferns, scrub, rocks, logs, a forest frame, crags on the ridge, a walk-through forest in the woods whose trees block walking (design 6.11), and props textured as intended. Cost (estimate): merging about -40 to -55% of draw calls and -1 to -3 ms of CPU; carpet, scatter and woods trees +20 draws and about +1 to 2 ms; triangles up to the new budget; about +24 kB of JS.

This slice edits one Stage 2 file, `src/state/collision.ts`, in TR2 only. Every frozen Stage 2 test (reachability, relief, world data, pathfinding, save relocation, world budget) must pass untouched after TR2 and at every later task.

### GR1 Batching, UV and texture-cache tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: AR4b.
- **Files** (new): `tests/batching.test.ts`, `tests/uv-projection.test.ts`, `tests/texture-cache.test.ts`.
- **Change**:
  - `batching`: against `mergeByMaterial(group: THREE.Group): THREE.Group` and `materialKey(mat): string`. A group of 6 meshes over 2 material keys, with child transforms and one negative scale, becomes 2 meshes; the triangle count is unchanged; world-space bounds are unchanged within 1e-5; `castShadow` and `receiveShadow` are true on a merged mesh if any source was; a mesh with `userData.noOutline` or `isCollider` is left unmerged; meshes with and without `uv` merge (the missing attribute is filled with zeros); an indexed and a non-indexed mesh with the same key merge.
  - `uv-projection` (**finding 23**): two geometries where the second is `first.clone()` both get projected UVs from `sealAlbedoUvs`; calling it twice on the same geometry does not project twice.
  - `texture-cache` (**finding 29**): against `loadAlbedo` with the default loader in `node`: the same id at repeat 3 and 1.5 returns two textures with `a.source === b.source` and different `repeat`; the same id and repeat returns the same object.
- **Accept**: red until GR2.
- **Must not change**: `src/`.

### GR2 Merge static props; fix findings 23 and 29 [AGY]
- **Tier**: sonnet.
- **Depends**: GR1.
- **Files**: `src/engine/batching.ts` (new), `src/engine/blenderWorld.ts`, `src/engine/worldBuild.ts`, `src/engine/textures.ts`, `src/engine/renderer.ts`.
- **Change**: three commits.
  1. `feat(ground): merge prop meshes by material`. `materialKey` is `colour hex | albedo id | emissive hex and intensity | shade | side`. `mergeByMaterial` bakes each child's matrix relative to the group into a clone of its geometry (flipping the winding under a negative determinant), keeps only `position`, `normal` and `uv`, merges per key with `mergeGeometries` from `three/examples/jsm/utils/BufferGeometryUtils.js`, keeps the first material of each key and disposes the rest. `cloneWorldNode` calls it after `applyWorldMaterials`; `spawnWorldProp` calls it after `applyWorldMaterials` (added in LT5b). Non-indexed inputs are given an index before `mergeGeometries`, which refuses a mix. Now that a prop's geometry is in the prop's own space, `applyWorldMaterials` passes `footHeight: 0.6`. The per-mesh `mesh.geometry.clone()` in `applyWorldMaterials` goes, because the merge makes new geometry.
  2. `fix(#23): track projected UVs in a WeakSet`. In `assignProjectedUvs`, `geometry.userData.albedoUv` is replaced by a module-level `WeakSet`. `assignGroundUvs` adds the terrain geometry to the same set.
  3. `fix(#29): one texture source per albedo id`. `loadAlbedo` caches a base texture per id and a clone per `id:repeat`; clones copy wrap, filter and colour space and set their own `repeat`. The path with an explicit `loader` argument stays uncached and returns the loader's own texture, as the frozen test "loads each painted tile from /textures with ground and prop repeats" needs. It also sets `anisotropy` from `GFX_TIERS`, clamped by `renderer.capabilities.getMaxAnisotropy()` through a setter `setAlbedoAnisotropy(n)` that `applyQualityTier` calls.
- **Accept**: the three GR1 files pass; `ONE(tests/textures.test.ts)` and `ONE(tests/dispose.test.ts)` pass untouched; SG. The opus verify confirms every `getObjectByName('World_...')` and every material-name test in `applyWorldMaterials` still runs before the merge.
- **Must not change**: any GLB; node and material names; the live and depleted swap of `upgradeResourceNodeWithGltf`; what `upgradeWorldPropWithGltf` pushes to the interactive list (it now pushes the merged meshes); `addCartoonOutline` (three frozen tests read its shell right after the call).

### TR1 Woods-tree walk tests [CLAUDE]
- **Tier**: opus. These tests are the boundary check for a game-rule change (walkability, design 6.11 and threat V8). The tests decide what "still playable" means; that is judgment, not transcription.
- **Depends**: GR2, R0 step 9.
- **Files**: `tests/woods-trees.test.ts` (new).
- **Change**: the woods-tree part of the G5.6 row of design 8.1, written against these names:
  - `src/data/woodsTrees.ts`: `WOODS_TREES: readonly (readonly [number, number])[]` (cell indices `[i, j]`, centre at `-118 + i + 0.5`, `-118 + j + 0.5`); `WOODS_TREE_CLEAR = { spacingCells: 3, groundCells: 3, pathExtra: 3, target: 4.5, poiExtra: 3, campExtra: 2 }`; `WOODS_TREE_COUNT = { min: 100, max: 220 }`.
  - `src/state/collision.ts`: `isWalkableGround(x, z)` (today's `isWalkable` unchanged), `isWoodsTreeCell(x, z)`, and `isWalkable(x, z)` equal to ground and not a tree cell.

  The test holds the station list and the 20 old spawn points as literals, as the Stage 2 tests do. It reads the Stage 1 save fixture's position from the fixture file. Every table-driven case first asserts its table's row count. Cases:
  - **The table**: `the table is sorted integer cells with no duplicates and 100 to 220 rows`; `woodsTrees.ts contains only literals` (a text scan finds no `(` after the array opens).
  - **Placement**:
    - `every tree is in woods on walkable ground`;
    - `every two trees are at cell distance max(|di|, |dj|) >= 3`;
    - `every tree is at cell distance >= 3 from every cell whose centre has isWalkableGround false`;
    - `no tree is within halfWidth + 3 of any path centre line`;
    - `no tree is within 4.5 of a node, fishing spot, station or shrine`;
    - `no tree is within padRadius + 3 of a POI`;
    - `no tree is inside any camp radius + 2`;
    - `no tree is inside a safe zone or the Cinderstep Pass corridor`;
    - `no tree is on the cell of the start point, the save fixture's position or any of the 20 old spawn points`;
    - `no tree cell contains a path point sampled each unit`.
  - **Walkability**:
    - `isWalkable is false at the centre and four inset corners (±0.45) of every tree cell`;
    - `isWalkable equals isWalkableGround at every point of a 0.25 grid over the woods outside tree cells`.
  - **Reach**:
    - `the cells reachable from the start with trees equal the cells reachable with isWalkableGround, minus the tree cells` (the same four-neighbour fill as `tests/reachability.test.ts`);
    - `every shrine, station, POI centre, camp member home, resource node and fishing spot has a reachable walkable cell within its stop distance`, with the stop distances R0 recorded;
    - `findPath(buildWalkGrid(), start, entityGoal(...)) returns a route for each of them`.
  - **Saves**: `sanitizePose moves a pose at every tree cell centre to a walkable point within 1.1`.
  - **Walk-grid budget**:
    - `buildWalkGrid() has 55,696 cells and blocks exactly WOODS_TREES.length more than buildWalkGrid(isWalkableGround)`;
    - `buildWalkGrid() takes at most 1.5 times the ground-only build (median of 5 in the same run)`.
- **Accept**: red until TR2, within rule 0.3.4. The opus verify checks that each clearance in the test matches design 6.11 exactly.
- **Must not change**: `src/`; every existing test.

### TR2 Woods trees in the walk rules [AGY]
- **Tier**: sonnet.
- **Depends**: TR1, OV-4b.
- **Files**: `src/data/woodsTrees.ts` (new), `scripts/place-woods-trees.ts` (new), `src/state/collision.ts` (Stage 2).
- **Change**: two commits.
  1. `feat(ground): woods trees block their walk cell`. In `collision.ts`, rename the body of `isWalkable` to an exported `isWalkableGround` with no other change. Add `isWoodsTreeCell(x, z)`, which on its first call builds a 236 × 236 `Uint8Array` from `WOODS_TREES` and then returns the bit at `floor(x + 118)`, `floor(z + 118)` (false outside ±118). Make `isWalkable(x, z)` return `isWalkableGround(x, z) && !isWoodsTreeCell(x, z)`. Nothing runs at import time. `woodsTrees.ts` exports the constants TR1 names and an empty `WOODS_TREES` for now.
  2. `feat(ground): place the woods trees`. `scripts/place-woods-trees.ts`. It is bundled and run with the `esbuild` that vite already installs (no new dependency): `npx esbuild scripts/place-woods-trees.ts --bundle --platform=node --format=esm --outfile=<scratchpad>/place.mjs && node <scratchpad>/place.mjs`. The script:
     - candidates are every cell centre of the woods region, in a seeded order (the seed is a constant in the file's header; no `Math.random`);
     - it keeps a candidate when every rule of design 6.11 holds, checked against `isWalkableGround` and the Stage 2 tables;
     - it stops at 150 trees, or at the end of the candidates;
     - it writes `WOODS_TREES` into `src/data/woodsTrees.ts` as sorted integer literals.
     The script is not imported by `src/`.
- **Accept**: `ONE(tests/woods-trees.test.ts)` passes. `ONE` passes untouched for `tests/reachability.test.ts`, `tests/relief.test.ts`, `tests/world-data.test.ts`, `tests/pathfind.test.ts`, the save-relocation test and the world-budget test. SG. `git diff main -- src/state/collision.ts` shows only the rename, the new function and the new `isWalkable` line. The opus verify confirms that `pathfind.ts`, `monsterAi.ts`, `save.ts`, `input.ts` and `loop.ts` are unchanged.
- **Must not change**: `isWalkableGround`'s behaviour (today's `isWalkable`, point for point); the signatures of `isWalkable` and `moveWithCollision`; `pathfind.ts`; `monsterAi.ts`; `save.ts`; `worldMap.ts`; `placements.ts`; harvestable trees and every other prop (they stay non-blocking).

### GR3 Scatter tests [CLAUDE]
- **Tier**: opus. These tests are the boundary check for generated decoration (design V8), and choosing the clear radii and the unwalkable-only rule is judgment.
- **Depends**: TR2, OV-4.
- **Files**: `tests/scatter.test.ts` (new), `tests/look-data.test.ts` (extended).
- **Change**: the G5.6 and G5.8 rows of design 8.1 against `buildScatter(seed: number, tier: GfxTierId): ScatterResult` where `ScatterResult = Record<KitPieceId, { x: number, z: number, rot: number, scale: number }[]>`, and against `KIT_PIECES` (each with `layer: 'understorey' | 'canopy'`, `maxHeight`) and `FLORA_RULES` (one row per region id plus rows keyed by POI id). Tests assert row counts first, then: determinism; no instance inside any path's half-width, any POI's `padRadius`, 2.5 units of any node placement, station, shrine or camp member home, the corridor of Cinderstep Pass, or a safe zone's inner 6 units; every `canopy` instance is at a point where `isWalkableGround(x, z)` is false and not in water (the walk grid stops at 118, so the predicate is the source; `isWalkableGround`, not `isWalkable`, so that a woods-tree cell does not count as room for canopy); no instance lies within 1 unit of a `WOODS_TREES` cell centre; every `understorey` piece has `maxHeight` at most 1.2; reeds within 3 units of a water cell; ferns only where `regionAt` is `woods`; no two understorey or canopy instances closer than the larger piece's footprint radius (`KIT_PIECES[id].radius`); each region and each POI has at least one cluster; each of 16 sectors of the 118 to 130 border ring has canopy instances; total instances per tier equal `GFX_TIERS.scatterDensity` times the full count within 5%.
- **Accept**: red until GR4.
- **Must not change**: `src/`.

### GR4 Flora rules and scatter [AGY]
- **Tier**: sonnet.
- **Depends**: GR3.
- **Files**: `src/data/look.ts` (`KIT_PIECES`, `FLORA_RULES`), `src/state/scatter.ts` (new).
- **Change**: design 5.6 and 6.7. `KIT_PIECES`: `boulder_s`, `boulder_m`, `boulder_l`, `bush_a`, `bush_b`, `fern`, `reed`, `log`, `snag`, `sapling`, `mushrooms`, `backdrop_tree_a`, `backdrop_tree_b`, `crag_a`, `crag_b`, each with layer, `maxHeight`, tint family and whether it casts a shadow. `FLORA_RULES`: per region, the pieces and their cluster density; per POI id, the frame, focus and floor of design 5.6. `KIT_PIECES` rows also carry `radius` (footprint). `buildScatter` draws cluster centres from the seeded generator, places 3 to 9 members per cluster by Poisson-disk sampling (Bridson's method, seeded, minimum distance from the larger footprint radius) with size falling from the centre, rejects every position the GR3 tests forbid, and thins by the tier's density.
- **Accept**: `ONE(tests/scatter.test.ts)` passes; the layering test passes; SG.
- **Must not change**: `worldMap.ts`, `collision.ts`, `pathfind.ts`.

### GR5 The kit and the instanced scatter [AGY]
- **Tier**: sonnet.
- **Depends**: GR4.
- **Files**: `src/engine/floraKit.ts`, `src/engine/flora.ts` (new), `src/engine/renderer.ts`.
- **Change**: `floraKit.ts` gains a builder per `KIT_PIECES` id: jittered icosahedra and dodecahedra for boulders, bushes and crowns; stacked jittered cones for `backdrop_tree_b`; hexagonal cylinders for logs and trunks; thin triangles for reeds and ferns; each with vertex colours from its tint family and within its triangle limit (boulder 20, bush 40, backdrop tree 80, crag 60). It also gains `woods_tree_a` and `woods_tree_b` (design 6.11): a hexagonal trunk of radius 0.30 to 0.42 and height 7 to 11, and a crown that starts at least 3.2 units up. The crown is darker, less saturated, taller and narrower than any harvestable tree, and each piece has at most 80 triangles. `flora.ts` `buildFlora(tier)` calls `buildScatter` with a fixed seed and makes one `InstancedMesh` per piece with a `cut` facet material (`vertexColors`, `footHeight` 0.6), the instance's Y from `getTerrainHeight`, `castShadow` from the piece. It also makes the two woods-tree `InstancedMesh`es from `WOODS_TREES` (one instance per row at its cell centre, the variant and a small rotation and scale chosen from the cell indices). They are built on every tier and never thinned, because they are walkability, not decoration. Nothing is added to `G.worldInteractiveObjects`. `init3DEngine` calls it after the world is built.
- **Accept**: SG; `grep -n "worldInteractiveObjects" src/engine/flora.ts` prints nothing; `grep -n "Math.random" src/engine/flora.ts src/engine/floraKit.ts` prints nothing; the opus verify confirms the woods-tree instance count equals `WOODS_TREES.length` and does not read the tier.
- **Must not change**: resource nodes, stations, landmarks.

### GR6 The ground field and the carpet [CLAUDE]
- **Tier**: opus (a vertex shader that wraps instances around the hero and reads a data texture; a prompt cannot fully specify it).
- **Depends**: GR5.
- **Files**: `src/engine/flora.ts`, `src/engine/floraKit.ts`, `src/engine/worldMesh.ts`, `src/engine/materials.ts` (`grassMaterial` removed or wrapped), `src/engine/loop.ts`, `src/engine/context.ts`.
- **Change**: design 6.7. `buildGroundField()` fills a 257 by 257 `HalfFloatType` RGBA `DataTexture` with linear filtering: height, carpet density (0 inside a path's half-width, a POI pad, water, slope above the Stage 2 crag threshold, the paved plaza; 1.5 on the 2-unit path verge), variant, region blend. `buildCarpet(tier)` makes one `InstancedMesh` per variant (`tuft`, `flower`, `tussock`, `ember_grass`, about 8 triangles each, vertex colours for a root-to-tip tint) with `GFX_TIERS.carpetTufts` instances in total and `frustumCulled = false` (instances are placed in the shader, so the bounding sphere would sit at the origin). Its material is `facetMaterial({ shade: 'round', vertexColors: true })` plus one more `onBeforeCompile` link that replaces `begin_vertex`: it computes the tuft's cell from `gl_InstanceID` and `uHeroXZ` on a wrapping jittered grid, samples the field, scales to 0 where density is 0 and within the last 15% of the carpet's radius, and bends by `uWind` and the gust noise of `AIR_GLSL`; the link appends `|carpet` to `customProgramCacheKey`. Lighting, shadows received from trees and props, and `applyAir` then come from the facet and atmosphere hooks; the carpet does not cast. The 900-blade block leaves `buildTerrainAndWater`; `loop.ts` stops writing the old grass uniform and sets `uHeroXZ`.
- **Accept**: SG. A new `tests/ground-field.test.ts` (written in this task, since the field's rules come from the scatter rules already tested): density is 0 at the centre of every path sample, every POI centre and the river centre, and positive at three named meadow points; the carpet material's `customProgramCacheKey` differs from the terrain's and from a round facet's.
- **Must not change**: the terrain mesh; `getTerrainHeight`.

### GR7 Place-making pass [CLAUDE]
- **Tier**: opus (a look tuned against pictures).
- **Depends**: GR6.
- **Files**: `src/data/look.ts` (`FLORA_RULES`, `KIT_PIECES` tints and densities only); `scripts/place-woods-trees.ts` (its target count only) and `src/data/woodsTrees.ts` (regenerated by the script only).
- **Change**: CAP over P1, P3, P6, P7, P8, P9 and P10. For each POI and region, tune the rules until the frame, focus and floor of design 5.6 are visible in its pose and the regions differ at a glance. At P8, judge the woods trees at pitch 0.12 and 1.15. If the wood is too thin or too thick, or the crowns hide the hero, change only the script's target count, within the 100 to 220 range of `WOODS_TREE_COUNT`. Rerun the script and commit the new table in its own `tune(ground): woods tree count <n>` commit. Then record calls and triangles at P1, P3, P5 and P8 on every tier.
- **Accept**: `ONE(tests/scatter.test.ts)` and `ONE(tests/woods-trees.test.ts)` stay green, and so do the frozen Stage 2 tests; SG; at P1 on balanced, colour-pass calls are at most 60% of the V2 capture and at most 1000, calls with the shadow pass at most 60% of V2's, triangles at most 550k. If a limit is missed, thin `scatterDensity` or `carpetTufts` in `GFX_TIERS` (and the tier test with it, in a declared tune commit), never the limits.
- **Must not change**: any rule the scatter test or the woods-tree test holds; the clearance constants in `woodsTrees.ts`; `collision.ts`.

### CP-GR Ground checkpoint [OWNER]
The owner compares `before/` and `ground/` at P1, P3, P6, P7, P8 and P10, and looks closely at props for finding 23's texture change. Should see: a meadow with a verge along the road; reeds only at water; a dense woods floor inside a tall frame; crags along the ridge; no straight map edge at any yaw; nothing in front of a node, a station or the pass. In the woods, the owner should see a forest of tall trunks with open lanes along Lanternway and around Lampwright's Hollow, Reedglass Tarn and the guardians' clearing, and decorative trees that do not look choppable. The owner also walks the woods live: clicked routes bend around trunks, keyboard movement slides along them, and a moss guardian's chase behaves as CALL-V21 decided. The owner also runs `look.bench` on their GPU at P1 and P8. Here the owner answers CALL-V8 again if the crags or backdrop trees do not convince. **Once CP-GR accepts, `WOODS_TREES` is frozen.** Any later change is a game-rule change and goes back to the owner.

---

## 5. Slice 4, lane WT: water

What the owner gets: a river and two ponds with banks, depth, foam, facets and sky. Cost (estimate): about -0.2 to +0.3 ms, no draw call added, about +4 kB of JS.

### WT1 Water-grid tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: GR7.
- **Files**: `tests/water-grid.test.ts` (new).
- **Change**: the G5.5 row of design 8.1 against `src/state/waterGrid.ts` `buildWaterGrid(): { positions: number[], depth: number[], flow: number[], index: number[], cells: number }` and `WATER_LEVEL = -0.34`.
- **Accept**: red until WT2.
- **Must not change**: `src/`.

### WT2 Water grid [AGY]
- **Tier**: sonnet.
- **Depends**: WT1.
- **Files**: `src/state/waterGrid.ts` (new).
- **Change**: design 6.5: a 1-unit grid over the terrain square; a cell is kept when any of its corners has `getTerrainHeight` below `WATER_LEVEL`, plus its eight neighbours; per vertex, depth is `WATER_LEVEL - height` clamped at 0 and flow is the unit tangent of `riverCenterX` within 8 units of the river, zero elsewhere.
- **Accept**: `ONE(tests/water-grid.test.ts)` passes; SG.
- **Must not change**: `terrain.ts`, `collision.ts`.

### WT3 Water sheet and shader [AGY]
- **Tier**: sonnet.
- **Depends**: WT2.
- **Files**: `src/engine/water.ts` (new), `src/engine/worldMesh.ts`, `src/engine/loop.ts`, `src/engine/context.ts`, `src/engine/renderer.ts`.
- **Change**: `buildWater()` makes one mesh from `buildWaterGrid` with attributes `aDepth` and `aFlow` and a `ShaderMaterial` that reads `AIR`: vertex displacement by two travelling sines (along `aFlow` on the river, radial in ponds); face normal from derivatives; a three-stop colour ramp over `aDepth` (bank, shallow, `PALETTE.water`); foam where depth is under 0.12, broken by the sines; a stepped flash of `uKeyColor` where the reflected view direction is within the sun's cone; a Fresnel mix toward `uHorizon` and `uZenith`; alpha from depth; `applyAir`; `COLOR_FOOTER`. Under `#define WATER_SIMPLE` (performance tier) only the ramp, foam and air remain. The water block and `G.waterUniforms` leave `worldMesh.ts` and `context.ts` (or stay as a wrapper if R0 said so); `loop.ts` stops writing `G.waterUniforms.uTime`.
- **Accept**: SG; `grep -n "waterGeo" src/engine/worldMesh.ts` prints nothing.
- **Must not change**: the water level; the bridge; the fishing spots.

### CP-WT Water checkpoint [OWNER]
CAP over P2 (dawn, noon), P6 (dawn), P7 (noon). Should see: three water colours from bank to middle; a foam line; facets that flash toward the sun; the far water taking the sky's colour; the riverbed showing at the bank.

---

## 6. Slice 5, lane WX: weather, motes, local light

What the owner gets: air that moves. Leaves, pollen, fireflies, embers, ash; rain, mist and haze; lanterns and lava that light the ground at night. Cost (estimate): about +0.3 to 0.6 ms, +2 draw calls, about +8 kB of JS; point lights only on high and ultra.

### WX1 Weather tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: WT3, OV-5.
- **Files**: `tests/weather.test.ts` (new), `tests/gfx-tiers.test.ts`, `tests/look-data.test.ts` (extended).
- **Change**: against `WEATHER` (rows `id`, `regions: string[]`, `keyScale`, `fogScale`, `motes`, `fall`) and `weatherAt(dayIndex: number, phase: number, regionWeights: Record<string, number>): { id: string, blend: number }`: the same inputs give the same output; a state appears only in a region its row lists; `rain` never in `desert` or `wilderness`, `sand_haze` only in `desert`, `ash_fall` only in `wilderness`; no state changes more often than every 0.08 of phase; mote, fall and point-light counts are in `GFX_TIERS` and are 0 on `performance`. In `look-data.test.ts`: every `EMITTERS` colour, and every glowing mote colour, is at least 1.2 times `BLOOM.threshold` in luminance.
- **Accept**: red until WX2.
- **Must not change**: `src/`.

### WX2 Weather data and schedule [AGY]
- **Tier**: sonnet.
- **Depends**: WX1.
- **Files**: `src/data/look.ts` (`WEATHER`, `EMITTERS`), `src/state/weather.ts` (new).
- **Change**: the six states of design 5.7 as rows; `weatherAt` hashes the day index and a phase bucket into a state allowed by the heaviest region, with a blend that ramps over 0.02 of phase. `EMITTERS` lists the world nodes that emit light and their colour: `World_woods_lantern`, `World_forge`, `World_lava_fissure`, `World_shrine`, `World_mystic_mushroom`.
- **Accept**: `ONE(tests/weather.test.ts)` passes; SG.
- **Must not change**: anything else in `look.ts`.

### WX3 Motes and falling weather [AGY]
- **Tier**: sonnet.
- **Depends**: WX2.
- **Files**: `src/engine/particles.ts` (new), `src/engine/lighting.ts`, `src/engine/loop.ts`, `src/engine/renderer.ts`, `src/engine/photo.ts`.
- **Change**: design 6.8. Two `InstancedMesh`es of small flat shapes (diamond, leaf, sliver, flake as four tiny geometries selected by an instance attribute), each with a `ShaderMaterial` that places the instance in a box around the camera from a per-instance seed and `uTime`, moves it by `uWind` and a fall speed, fades at the box faces, colours it from the weather row and, for fireflies and embers, writes above `BLOOM.threshold` so it blooms. Both meshes have `frustumCulled = false` (instances are placed in the shader). Counts from `GFX_TIERS`. `updateLighting` multiplies the key and the fog by the weather row's scales through `weatherAt`. When `matchMedia('(prefers-reduced-motion: reduce)')` matches, fall counts are halved, wind amplitude is a third and the camera shake in `updateCamera` is skipped. `photo.ts` gains `weather(id)`.
- **Accept**: SG; `grep -n "Math.random" src/engine/particles.ts` prints nothing.
- **Must not change**: `vfx.ts`.

### WX4 Local light [AGY]
- **Tier**: sonnet.
- **Depends**: WX3.
- **Files**: `src/engine/lighting.ts`, `src/engine/blenderWorld.ts`, `src/engine/worldBuild.ts`.
- **Change**: `registerEmitter(position, colorHex)` is called where a world node in `EMITTERS` is placed (`upgradeWorldPropWithGltf` and `spawnWorldProp`). `initLighting` creates `GFX_TIERS.pointLights` `PointLight`s once, with distance 9 and decay 2, intensity 0. Every 0.25 s `updateLighting` assigns them to the nearest emitters and sets intensity from `1 - keyIntensity / 0.9` clamped to 0..1. The pool is resized only by `applyShadowTier`'s caller on a tier change (three then recompiles the lit programs once).
- **Accept**: SG; the opus verify confirms no light is created outside `initLighting`.
- **Must not change**: emissive materials.

### CP-WX Weather checkpoint [OWNER]
CAP over P6 (rain), P7 (golden with haze), P5 (noon with ash), P8 (night) on balanced and high. Should see: thin slivers slanting with the grass's lean; three flat dune layers in haze; ash drifting at the last shrine; amber pools under the lanterns on the high tier; nothing that flashes.

---

## 7. Slice 6, lane UI: the interface (parallel worktree)

What the owner gets: the game's own interface. Cost: fonts up to 120 kB, CSS up to +16 kB, about +8 kB of JS; six full-screen blurs removed.

### UI1 Fonts: licence, subset, credits [CLAUDE]
- **Tier**: opus (licence text and provenance).
- **Depends**: V2, OV-6.
- **Files**: `src/ui/fonts/*.woff2`, `src/ui/fonts/LICENSE-<family>.txt`, `src/ui/fonts/SOURCE.md` (all new), `CREDITS.md`.
- **Change**: for the two candidates of design 7.1 (Grenze, Alegreya Sans), download each family from its publisher's repository at a pinned commit, with a generic client and no project identifier in the request, into a new empty directory outside the repository. Read the licence file. Check the criteria of design 7.1: redistribution and embedding allowed; whether a Reserved Font Name clause applies to a subset; tabular figures in the text face (`tnum` feature present); weights available. Subset to Basic Latin plus Latin-1 with `pyftsubset` (fonttools 4.61.1 is installed) to woff2: display in two weights, text in 400 and 600. Record in `SOURCE.md`: title, author, URL, commit, the SHA-256 of each downloaded and each shipped file, and the exact subset command. Add a "Fonts" table to `CREDITS.md` with a row per family. If a candidate fails a criterion or the 120 kB total, propose one replacement against the same criteria and report both to the owner (OV-7).
- **Accept**: a written report to the owner with a picture of each face at 11, 14, 20 and 40 px on slate. No SG change expected.
- **Must not change**: the existing rows of `CREDITS.md` (`tests/credits.test.ts` passes untouched).

### UI2 Interface tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: UI1, OV-7.
- **Files** (new): `tests/ui-tokens.test.ts`, `tests/ui-fonts.test.ts`, `tests/ui-a11y.test.ts`, `tests/scroll-snapshot.test.ts`.
- **Change**: the G5.9 (interface part), G5.10 and G5.11 rows of design 8.1. `ui-tokens`: no `--osrs-`, `--botw-` or `--panel-` in `src/ui/styles.css`, `index.html` or any file under `src/`; no `backdrop-filter`; no `font-size` below 11px and no `font-weight` above 700 in the CSS; no `http://` or `https://` in the CSS; every `@font-face` has `font-display: swap` and a relative `url(`; the contrast of each pair in a declared list (`bone` on `slate-1`, `slate-2`; `bone-dim` on `slate-1`, `slate-2`; `brass` on `slate-1`; each semantic colour on `slate-1`; `ink` on `brass`) is at least 4.5, computed from the token values; `index.html` contains no `style="` with a colour or a font size. `ui-fonts`: files exist; total at most 120,000 bytes; a licence file per family; `CREDITS.md` has a Fonts row per family naming a licence and a source. `ui-a11y`: every element in `index.html` with a click hook (`onclick` or `data-action`) is a `button`, `a` or `input`; every `.modal-window` has `role="dialog"`, `aria-modal="true"` and an `aria-labelledby` that names an existing id; every icon-only button has an `aria-label`; the CSS has `@media (prefers-reduced-motion: reduce)` setting `animation: none` and `transition: none`; a `:focus-visible` rule exists. `scroll-snapshot`: `takeSnapshot(nodes)` and `restoreSnapshot(nodes, snap)` over plain objects `{ scrollTop }` and a focus record `{ id, start, end }` round-trip.
- **Accept**: red until UI3 to UI7.
- **Must not change**: `src/`.

### UI3 Tokens, type, scale [AGY]
- **Tier**: sonnet.
- **Depends**: UI2.
- **Files**: `src/ui/styles.css`, `index.html`, and any file under `src/ui/` or `src/engine/overlay.ts` that names an old token.
- **Change**: design 7.1 and 7.2. Replace the `:root` block with the `--ui-*` tokens and map every use of an old token to its new role. Add the two `@font-face` families from `src/ui/fonts/` with relative URLs and `font-display: swap`, and `--ui-font-display`, `--ui-font-text` with a system stack behind each. Set the root font size to `calc(16px * clamp(1, min(100vw / 1440, 100vh / 810), 2))` and convert sizes to rem on the seven-step scale; raise every size below 11 px; weights to 400, 600 or 700; `font-variant-numeric: tabular-nums` on numbers. Move every inline colour and font size in `index.html` to a class.
- **Accept**: the token, font and size cases of `ui-tokens` and `ui-fonts` pass; `ONE(tests/globals.test.ts)` passes untouched; SG.
- **Must not change**: element ids; `onclick` attributes; layout positions.

### UI4 Component language [AGY]
- **Tier**: sonnet.
- **Depends**: UI3.
- **Files**: `src/ui/styles.css`, `index.html` (class names only).
- **Change**: design 7.3, one commit per component row: panel, button, tab, slot, vitals bar, tooltip and context menu, banner and toast, hit splat and XP drop, focus and motion. Chamfers by `clip-path` on two layers. Remove all `backdrop-filter`. The reduced-motion and `:focus-visible` rules.
- **Accept**: the remaining `ui-tokens` cases and the CSS cases of `ui-a11y` pass; SG; CSS size at most 45 kB.
- **Must not change**: element ids; the 4 by 7 inventory grid; what any control does.

### UI5 Keyboard and dialogs [AGY] (**findings 31, 32**)
- **Tier**: sonnet.
- **Depends**: UI4.
- **Files**: `index.html`, `src/ui/hud.ts`, `src/ui/playerActions.ts`, `src/engine/input.ts`.
- **Change**: two commits. `fix(#31)`: the combat style options, the special attack, the perf HUD, the compass and the generated inventory slots become `<button type="button">` with the same classes and an `aria-label`; icon-only tabs and close buttons get labels. In `input.ts` the global key handler returns early for Space and Enter when the event target is a button, so activating a focused control does not also jump; the existing text-input rule and its exported predicate keep their behaviour. `fix(#32)`: every `.modal-window` gets `role="dialog"`, `aria-modal="true"` and `aria-labelledby`; `openModal` remembers `document.activeElement` and focuses the window's first control; `closeModals` returns focus.
- **Accept**: `ONE(tests/ui-a11y.test.ts)` passes; `ONE(tests/input-keys.test.ts)` and `ONE(tests/globals.test.ts)` pass untouched; SG.
- **Must not change**: function names in `WINDOW_GLOBALS`; the Escape branch of the key handler.

### UI6 Station windows keep scroll and focus [AGY] (**finding 24**)
- **Tier**: sonnet.
- **Depends**: UI5.
- **Files**: `src/ui/scrollSnapshot.ts` (new), `src/ui/stations.ts`.
- **Change**: `fix(#24)`. `scrollSnapshot.ts` exports the two pure functions UI2 tests. `renderBankModal` and `renderShopModal` take a snapshot of `#bank-grid`, `#bank-pack`, `#shop-pack` and of `#bank-search` (focused or not, selection range) before assigning `innerHTML`, and restore it after.
- **Accept**: `ONE(tests/scroll-snapshot.test.ts)` passes; SG; the opus verify confirms no new `innerHTML` assignment.
- **Must not change**: the markup the render functions produce.

### UI7 Minimap and world labels [AGY]
- **Tier**: sonnet.
- **Depends**: UI6.
- **Files**: `src/engine/overlay.ts`, `src/ui/styles.css`, `index.html`.
- **Change**: `renderMinimap` sizes the canvas backing store to its CSS size times `devicePixelRatio` (capped at 3) once and on resize, and scales its drawing by the same factor; its fill colours come from the `--ui-*` tokens read once. The frame becomes an octagon by `clip-path`. Landmark, overhead and monster labels use the text face with the ink outline.
- **Accept**: the minimap case of `ui-tokens` passes; SG.
- **Must not change**: what the minimap shows; minimap click-to-walk.

### CP-UI Interface checkpoint [OWNER]
CAP over P11 at its four sizes, before and after. The owner also tabs through the HUD and one bank visit with the keyboard only, scrolls the bank grid and withdraws. Should see: the new faces and panels; a visible brass focus ring; nothing smaller than the 11 px step; the same layout at 4K; a sharp minimap; the bank list staying where it was scrolled.

### UI8 Inline handlers and the script policy, only if OV-8 says yes
- **UI8a [CLAUDE]**, sonnet. **Files**: `tests/globals.test.ts`, `tests/vercel-headers.test.ts` (replacements 3 and 4 of design 8.3 only). **Accept**: red until UI8b; the verify finds only those two tests changed.
- **UI8b [AGY]**, sonnet. **Depends**: UI8a, CP-UI. **Files**: `index.html`, `src/engine/runtime.ts`, `vercel.json`. **Change**: every `onclick="name(args)"` becomes `data-action="name"` plus `data-arg` attributes; `wireBridge` adds one delegated `click` listener on `document` that finds the nearest `[data-action]`, looks the name up in `WINDOW_GLOBALS` (an unknown name throws a clear error) and calls it with the parsed arguments. `vercel.json` sends the policy of design 7.5. **Accept**: both replaced tests and `ONE(tests/ui-a11y.test.ts)` pass; `grep -c "onclick" index.html` prints 0; SG. **Must not change**: the `window.*` assignments.
- **UI8c [HUMAN]**: the main session deploys a preview; a person plays through the smoke list with the browser console open and finds no policy violation.

---

## 8. Slice 7, lane FX: effects in the idiom (only if OV-9 says yes)

What the owner gets: spells, slashes and fireworks made of shards and planes that bloom, instead of smooth glowing balls. Cost: none; fewer triangles per effect.

### FX1 Effect shape tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: WX4.
- **Files**: `tests/vfx-shape.test.ts`, `tests/fixtures/vfx-timings.json` (new).
- **Change**: the fixture is generated before FX2 from `vfx.ts` as it stands after Stage 4: every numeric literal passed as a lifetime to `spawnVfx` and every duration passed to `launchProjectile`, by function name and order. Tests: `no SphereGeometry in vfx.ts`; `no ring or cylinder with more than 10 radial segments`; `vfx.ts imports BLOOM from look.ts`; `lifetimes and durations equal the fixture`; `every exported function of vfx.ts at FX1 is still exported`.
- **Accept**: the first three cases red until FX2.
- **Must not change**: `src/`.

### FX2 Cut the effects [AGY]
- **Tier**: sonnet.
- **Depends**: FX1.
- **Files**: `src/engine/vfx.ts`.
- **Change**: by this table, and nothing else: `SphereGeometry(r, ...)` becomes `IcosahedronGeometry(r, 0)` (`OctahedronGeometry(r, 0)` for radii under 0.08); `RingGeometry` theta segments become 8; `CylinderGeometry` and `ConeGeometry` radial segments become 6; `TubeGeometry` radial segments 5 and tubular segments 10; `TorusGeometry` 5 by 8. Core colours of spell, loot and heal effects are multiplied so their luminance is 1.2 times `BLOOM.threshold` (read from `look.ts`, not a literal). Positions, scales, counts, lifetimes, ticks and `disposeObject3D` calls are untouched.
- **Accept**: `ONE(tests/vfx-shape.test.ts)` passes; SG.
- **Must not change**: any timing; any function signature.

### CP-FX Effects checkpoint [OWNER]
The owner fights with melee, ranged and magic, gains a level and gets a rare drop at P1, on balanced and high. Should see: the same effects at the same moments, now cut, and glowing on the high tier.

---

## 9. Stage gate

### G-5 Stage 5 verification [CLAUDE]
- **Tier**: opus (verification).
- **Depends**: every lane merged into `feat/visual-pass`.
- **Files**: none (read-only; a written report in the session).
- **Check**:
  1. SUITE: all pass. `git diff main -- tests src/__tests__` shows edits to existing files only in `tests/textures.test.ts` (four assertions) and, if UI8 ran, `tests/globals.test.ts` and `tests/vercel-headers.test.ts`.
  2. TYPES: clean.
  3. BUILD: the JS chunk is at most the V2 chunk plus 80 kB; CSS at most 45 kB; fonts at most 120 kB.
  4. `git diff main -- package.json` shows no `dependencies` change. `git diff --stat main -- public/models public/textures` is empty.
  5. `npm audit --audit-level=high` exits 0.
  6. Every goal G5.1 to G5.14 maps to a passing test (section 10.2).
  7. Findings 23, 24, 29, 30, 31 and 32 each have a commit naming them; finding 5's script policy is either closed by UI8 or has its written second deferral.
  8. `grep -rn "Math.random" src/state/scatter.ts src/state/weather.ts src/engine/flora.ts src/engine/floraKit.ts src/engine/particles.ts scripts/place-woods-trees.ts` prints nothing. No literal instance, particle or light count outside `look.ts`.
  9. No commit on the branch carries an attribution trailer.
  10. Walkability:
      - `git diff main -- src/state` shows changes to Stage 2 files only in `collision.ts`, as TR2 describes;
      - the frozen Stage 2 tests pass untouched;
      - `src/data/woodsTrees.ts` is unchanged since the commit CP-GR accepted;
      - no file reads `GFX_TIERS` to decide woods-tree placement or count.
- **Accept**: a written pass.
- **Must not change**: anything.

### G-6 Stage 5 human checks [HUMAN]
- CAP over every pose and time of design 8.2 on all four tiers into `stage5/final/`; the pictures match what each row says the owner should see.
- On the owner's GPU, at P1, P3, P5 and P8 on every tier: calls, triangles and `look.bench` frame time against design section 10 as frozen at OV-2.
- The Stage 1 leak check again: GPU geometries return to the first value after 200 attacks, 5 level-ups and 20 gear swaps.
- The smoke list of the foundation design 5.7, once, on the balanced tier.
- A full day watched once at P1 with the clock sped up through `__DEBUG.look.phase`: no jump in light or sky at any phase.
- `?plain`: the game is playable. Reduced motion set in the operating system: no weather storm, no shake, no interface animation.
- The woods, on the performance and the ultra tier: the same trunks block in both. Click-to-move reaches the woods shrine, Lampwright's Hollow, Reedglass Tarn's fishing spot and a yew from the start. A save made while standing beside a trunk reloads to the same place.
- If UI8 ran: UI8c.

### OV-10 Accept Stage 5 [OWNER]
The owner accepts after G-5 and G-6. The main session pushes the branch, opens the pull request and merges after CI is green.

---

## 10. Coverage

### 10.1 Audit findings to tasks

| Finding | Task |
|---|---|
| 23 | GR1, GR2 (commit 2), judged at CP-GR |
| 24 | UI2, UI6 |
| 29 | GR1, GR2 (commit 3) |
| 30 | UI2, UI3, UI4 |
| 31 | UI2, UI5 |
| 32 | UI2, UI4 (motion), UI5 (dialogs), WX3 (engine motion) |
| 5, script policy | UI8, or the written deferral to Stage 7 if OV-8 says no |
| 13, reopened | LT5a (`applyShadowTier` disposes the map), AR1 and LT1 (tier table tests) |
| 27 | not touched; stays with Stage 7 (design section 11) |

### 10.2 Goals to proofs

| Goal | Proof task(s) |
|---|---|
| G5.1 | LT3, LT4, LT5b; CP-LT |
| G5.2 | LT1 (`shadow-fit`, stepped sun), LT5a, GR6 (carpet receives shadows); CP-LT with P12 |
| G5.3 | LT1 (`day-cycle`), LT2; G-6 full day |
| G5.4 | AR1 (`air`, `look-data`, bloom threshold), AR2; CP-AR |
| G5.5 | WT1, WT2; CP-WT |
| G5.6 | TR1, TR2 (`woods-trees`, plus the frozen Stage 2 tests), GR3, GR4, GR6 (`ground-field`); CP-GR; G-6 woods walk |
| G5.7 | WX1, WX2, FX1; CP-WX, CP-FX |
| G5.8 | GR3 (border sectors), LT1 (`look-data` far plane and apron), AR3; CP-AR with P10 |
| G5.9 | AR1 (`gfx-tiers` pixel budget), UI2 (sizes, minimap); CP-UI |
| G5.10 | UI2 (`ui-tokens`, `ui-fonts`); CP-UI |
| G5.11 | UI2 (`ui-a11y`, `scroll-snapshot`), UI5, UI6; CP-UI |
| G5.12 | V1b (`bench`), V2 and OV-2 (measured budgets), LT1, AR1, WX1 (`gfx-tiers`), GR7 (limits), G-5 step 3, G-6 |
| G5.13 | AR1 (`plain-mode`), AR4b; CP-AR with `?plain` |
| G5.14 | GR1, UI2, G-5 step 7 |

### 10.3 Slices in order, with their cost

| # | Slice | Shown at | Frame cost (estimate, balanced) | Draw calls | Bytes |
|---|---|---|---|---|---|
| 1 | Light, shadow, sky | CP-LT | about +0.3 ms | +1 | JS about +14 kB |
| 2 | Air, horizon, clouds, output | CP-AR | about +0.3 ms; upper tiers +1.5 to 2.5 ms | +3 to +5 | JS about +19 kB |
| 3 | Ground, vegetation, places, blocking woods trees | CP-GR | about 0 net (merging pays for the carpet); woods trees about +0.1 ms on every tier | about -40 to -55%, then +20 | JS about +24 kB |
| 4 | Water | CP-WT | about -0.2 to +0.3 ms | 0 | JS about +4 kB |
| 5 | Weather, motes, local light | CP-WX | about +0.3 to 0.6 ms | +2 | JS about +8 kB |
| 6 | Interface (parallel) | CP-UI | negative (blurs removed) | 0 | fonts up to 120 kB, CSS up to +16 kB, JS about +8 kB |
| 7 | Effects in the idiom | CP-FX | about 0 | 0 | about 0 |

Every frame cost above is an estimate made without a GPU measurement; V2 (benched, OV-2), GR7 and G-6 replace them with numbers.
