# World foundation: design

Date: 2026-11-13. Branch: `feat/world-foundation`. All line numbers refer to commit `1284a6e`.

Status: proposal. The owner has not reviewed any of it. Every decision marked **CALL** is the lead's proposal and needs the owner's check (collected in section 11). Nothing here has been agreed.

Inputs read for this document: the three maps in `docs/superpowers/specs/2026-11-13-world-foundation-maps/`, the audit in `docs/audit/2026-11-13-findings.json` (43 confirmed findings, baseline: 103 tests pass, `tsc --noEmit` clean, build 926 kB JS), `README.md`, `src/state/*.ts`, `src/data/world.ts`, `src/data/catalog.ts`, parts of `src/engine/runtime.ts`, and the screenshots `.playwright-mcp/shot-03-noon.jpg` and `shot-04-peak.jpg`.

This document covers two stages, each to be approved, built and accepted separately:

- **Stage 1: Foundation.** Split `runtime.ts`, type it, harden save loading, fix the audit findings in the code it touches and the cheap standalone ones.
- **Stage 2: World as a place.** Relief, paths, points of interest, monster territory with aggression and leashing, and a gated approach to the most dangerous area.

Stage 1 ends green (tests, `tsc --noEmit`, build) and mergeable before any Stage 2 task starts. Stage 2 depends on Stage 1. Stage 1 contains nothing that only makes sense if Stage 2 happens.

---

## 1. Intent and why

The owner asked for better graphics and gameplay, more features and a richer game, "without losing the essence", with the robustness of serious games.

Two things block that today.

1. **The code cannot be changed safely.** The game loop, rendering, input, HUD and monster behaviour are one file, `src/engine/runtime.ts`: 6253 lines under `// @ts-nocheck`. No test imports it, and it cannot be imported in a test because it registers DOM listeners at import time (5989, 6224). Rules such as monster AI (5787-5878) and terrain height (1119-1147) sit inside rendering code. Every later stage (combat feel, quests, dungeons) would have to edit this file blind.
2. **The world is a flat board.** Five regions on nearly flat ground (land height 0.08 to about 2.2 outside one corner). Monsters stand in open fields and never start a fight: `inCombatWithPlayer` is set only when the player's own attack lands (4844). A level-68 demon stands 15 units from the last region's shrine and does nothing as a level-3 player walks past (`shot-04-peak.jpg`). The painted road crosses the river about 6 units north of the bridge. Nothing in the world asks the player to prepare for anything.

Stage 1 makes the code testable and typed. Stage 2 uses that to make the world a place where position matters.

### Essence to preserve (CALL-1)

- Skill progression on the existing XP curve (`OSRS_XP_TABLE`, `getLevelForXp`).
- Click-to-act: click ground to walk, click a thing to walk up and act.
- 28-slot backpack, bank, shops, forge.
- The faceted painted look (flat-shaded geometry, painted albedo tiles, the current palette).
- Existing saves under `gielinor_hero_save_v1` keep loading, as do the two legacy keys.

No combat formula changes in either stage.

---

## 2. Constraints

| # | Constraint | Consequence |
|---|---|---|
| C1 | Blender is not installed on the build machine. `world.glb`, `monsters.glb`, `hero.glb`, `gear.glb`, `guard.glb` cannot be regenerated. | Stage 2 uses only TypeScript at runtime and nodes already in the GLBs. Section 6.9 lists what would need Blender; all of it is deferred. |
| C2 | The game already borrows place, monster and item names from two commercial games. | Neither stage adds a new name, character, map layout or visual taken from an existing game. Every new place or feature gets an original name (section 6.8). Renaming what exists is out of scope and is open question Q2. |
| C3 | Saves live in `localStorage` under `gielinor_hero_save_v1`, format `version: 4`. | Neither stage changes the format or the key. Section 7. |
| C4 | Vitest runs in the `node` environment with no DOM (`vite.config.ts`). | Everything claimed as an automated proof is DOM-free. No jsdom. What needs a screen is listed as a human check. |
| C5 | No new runtime dependency. | Pathfinding, terrain and AI are plain TypeScript. Dev dependencies change only to clear advisories. |
| C6 | Each stage is "done" only when: tests, type check and build pass with no test weakened or removed; every goal has a proof; no audit finding touched by the stage is left without a fix or a written deferral. | Sections 5.7, 6.11 and 9. The three planned test replacements in Stage 2 are declared in advance in section 6.11. |
| C7 | New creatures can only reuse the ten monster models in `monsters.glb`. | Stage 2 adds no creature type. It re-places and re-behaves the existing monsters and adds two more instances of an existing type (34 becomes 36). |

---

## 3. Goals, non-goals, anti-goals

### Stage 1: Foundation

Goals:

- **G1.1** `runtime.ts` is split into modules by behaviour-preserving extraction. No source file under `src/` is over 1000 lines.
- **G1.2** No `@ts-nocheck` or `@ts-ignore` anywhere under `src/` (this includes `src/ui/icons.ts`).
- **G1.3** The rules Stage 2 needs live in pure state modules with tests: terrain height, region lookup, monster behaviour step, monster and node placement table, saved-pose sanitising.
- **G1.4** Behaviour is preserved: the 103 existing tests pass unchanged, and the running game looks and plays the same, except for the listed fixes.
- **G1.5** Save loading is hardened and proven against a real version-4 save, a legacy save and hostile values.
- **G1.6** The audit findings assigned to Stage 1 in section 9 are fixed, each with a proof.
- **G1.7** Third-party asset credits ship in the repo and in the game; the provenance of `knight.blend` (CC0) is recorded.
- **G1.8** CI runs tests and build on every push and pull request; `npm audit` reports no high or critical advisory.

Non-goals: new gameplay, new content, any change to how the world looks, moving the player's attack formulas out of `performPlayerAttack`, rewriting the HUD, reducing the 45 `window.*` globals that `index.html` uses through inline `onclick`.

### Stage 2: World as a place

Goals:

- **G2.1** Real relief: hills, a ridge that reads as a wall, basins that hold water, with the five region cores unchanged.
- **G2.2** Paths between regions, drawn on the ground and on the minimap, crossing the river at the bridge.
- **G2.3** Seven points of interest with original names, built from existing GLB nodes and a few procedural meshes.
- **G2.4** Monsters have territory, aggression and leashing, as an explicit state machine in a pure module.
- **G2.5** The approach to the most dangerous area requires preparation: one pass, guarded, with no way around it, and no teleport past it before the first visit on foot.
- **G2.6** Click-to-act still works with walls in the world: the player finds a way around obstacles.
- **G2.7** Existing saves load into the new world with the player on walkable ground. No save format change.
- **G2.8** Every new name is original and listed.
- **G2.9** The performance budget in section 8 holds.

Non-goals: new monster types, new models, changes to drops, stats or combat formulas, monster pathfinding, line-of-sight, ground loot, weather, streaming or chunking, a map editor or map file format.

### Anti-goals (both stages)

- No rewrite. No entity-component system, no scene graph abstraction, no event bus.
- No new data format parsed at runtime. World data is typed TypeScript constants.
- No renaming of existing places, monsters or items.
- No change to the early-game kit (the player still starts with 23 of 28 slots filled; that is Stage 3).
- No visual restyling of HUD or models.

---

## 4. Approaches

### 4.1 Stage 1: how to split `runtime.ts`

| | A. Leave it, add new modules beside it | B. Behaviour-preserving extraction into ES modules sharing one context object (recommended) | C. Rewrite around classes or an ECS |
|---|---|---|---|
| What | Stage 2 code goes in new files; `runtime.ts` keeps its pragma. | Move each contiguous section to its own module, verbatim first, then type it. Shared mutable engine state moves to one exported holder. | Redesign entities, systems and rendering. |
| Cost | Lowest. | Medium: about 18 modules, mechanical. | Highest, and every behaviour must be re-proven. |
| Risk | Monster AI and terrain stay inside the untyped loop, so Stage 2 edits them blind. The 11 audit findings in the file stay. | Import cycles and load-order hazards (handled in 5.2). Subtle behaviour drift (handled by move-only commits and the checks in 5.7). | High regression risk with no tests on the old behaviour to compare against. |
| Reaches the goals | No (G1.1 to G1.3 fail). | Yes. | Yes, at several times the cost. |

Recommendation: **B**. It is the smallest change that makes the rules testable. C buys architecture nobody has asked for yet.

Within B, how to share the module-level state (`scene`, `camera`, `renderer`, the entity lists, `player`, `camState`):

- **B1 (recommended): one holder module.** `src/engine/context.ts` exports `player`, `camState` and one object `G` whose fields are the old module-level variables. Old code `scene.add(x)` becomes `G.scene.add(x)`. This is a search-and-replace, keeps one obvious place for shared state, and has no behaviour of its own.
- **B2: pass state as parameters.** Cleaner functions, but the loop touches `player` 176 times and the change stops being mechanical.
- **B3: `export let` live bindings.** Importers cannot assign, so every writer needs a setter. More code than B1 for the same result.

### 4.2 Stage 2: relief

| | A. Composed analytic height function with features as data (recommended) | B. Authored heightmap image | C. Seeded noise only |
|---|---|---|---|
| What | Keep `getTerrainHeight(x, z)` as a pure function. Add terms driven by a small typed table: ridges and paths as polylines, basins and flats as circles. | Paint a greyscale PNG, load it, sample bilinearly. | Replace the sine hills with fractal noise. |
| For | Deterministic, testable headless, no asset, no load step, every placement can still ask for a height at build time. Walls are where the table says. | Full artistic control. | Natural-looking detail. |
| Against | Shapes are limited to what a few primitives compose. | New parsed data and a PNG decoder in tests (a dependency), async load before the world can be built, needs an authoring tool. | No control: cannot guarantee a pass, a flat pad or a closed ridge. |

Recommendation: **A**. B's control is not needed for one ridge, four paths and two ponds.

### 4.3 Stage 2: gating and movement

There is no pathfinding today. Player and monsters move in a straight line with an axis-slide (`moveWithCollision`). Any wall added to the world makes click-to-move worse unless something routes around it.

| | A. No walls: gate by aggression only | B. Walls plus grid pathfinding for the player (recommended) | C. Walls plus a hand-placed waypoint graph |
|---|---|---|---|
| What | Relief is scenery. Danger comes only from aggressive monsters in open ground. | Ridge cores and basins block movement. The player's click-to-move runs A* on a walkable grid. | Same walls; the player follows authored path nodes. |
| For | Smallest. No pathfinding. | The gate is real. Also fixes today's getting stuck on the castle and the river. Pure, about 100 lines, testable. | Cheap at run time. |
| Against | The gate does not hold: the player moves at 11.5 units/s and monsters chase at 5.2, so in open ground the player walks around or outruns anything. | New module; the player's movement code changes from "one target" to "list of waypoints". | Off-path clicks still get stuck; the graph must be maintained by hand with every map change. |

Recommendation: **B**. A does not reach G2.5. Monsters do not pathfind in B: they chase in a straight line and give up when blocked or out of territory, which is exactly the leash behaviour wanted.

### 4.4 Stage 2: where monster rules live

- **A (recommended):** a pure step function `stepMonster(logic, world, dt)` in `src/state/monsterAi.ts` that mutates only logic fields and returns events; the engine applies events to meshes, sounds and the HUD. Stage 1 extracts today's behaviour into this shape; Stage 2 adds states.
- **B:** keep the rules in the loop and add aggression there. Cheaper now, untestable, and Stage 1 gains nothing for Stage 2.
- **C:** a general behaviour-tree or state-machine library. Speculative: there is one behaviour.

---

## 5. Stage 1 design: Foundation

### 5.1 Module boundaries

Rules for the split:

- `src/data/` and `src/state/` import nothing from `src/engine/` or `src/ui/`, do not import `three`, and do not reference `document` or `window`. A test enforces this by reading the files.
- `src/engine/` and `src/ui/` may import each other. Cycles between them are allowed only because of the next rule.
- No module under `src/engine/` or `src/ui/` runs code at import time other than declarations and constant initialisers. The two import-time side effects that exist today (the `beforeunload` listener at 5989 and the `DOMContentLoaded` handler at 6224) move into an exported `boot()` that `src/main.ts` calls. This is the first commit of the stage (5.2). A test imports every module in `node` and expects no throw.
- Any module-level `let` that is assigned outside the module it moves to becomes a `G` field, because an importer cannot assign a module binding.
- `context.ts` imports nothing from the project except types, so it is always evaluated first. This removes the two declared-after-use hazards in today's file (`npcAnimatorsList` at 2141 used by functions from 1959, and the loop timers at 5982-5988 declared after `gameLoop`).
- The `typeof fn === 'function'` guards at 288, 409 and 449 are deleted; they exist only because of the single-file ordering.

What moves where (source ranges in `runtime.ts` at `1284a6e`):

| New module | Receives | Notes |
|---|---|---|
| `src/state/terrain.ts` | 1119-1147 (`getTerrainHeight`, `rawHills`); the region test from 4098-4110 as `regionAt(x, z)` | Pure. The inline river formula at 1131 becomes a call to `riverCenterX` from `collision.ts`. |
| `src/state/monsterAi.ts` | The rules in 5787-5878 (dying, respawn, combat drop at 26, chase, attack cooldown, wander), the logic fields created in 3377-3426, and the monster-state writes outside the loop (4844, 4920-4923, 5039) | Pure step function and hit entry point, section 5.4. |
| `src/state/combat.ts` (exists) | 202-263 (`getEquipmentBonuses`) as a function of state | Already pure arithmetic; moves unchanged. It needs a home outside the HUD because combat and mesh code both call it. The player's attack formulas are not moved. The monster's hit roll is extracted in Stage 2 (6.6), where it is needed. |
| `src/state/save.ts` (exists) | The pose and camera clamps from 1033-1043 as `sanitizePose` and `sanitizeCam` | Section 5.5. |
| `src/data/placements.ts` | 3553-3590 as a typed table `{ type, x, z }[]` for monsters and nodes | Same 34 monsters and same nodes, same coordinates. Monster rows have the shape that Stage 2's `CAMPS.members` reuses unchanged. |
| `src/engine/context.ts` | 86 (`TICK_SEC`), 1066-1117 (`G`, `player`, `camState`), 1162-1164, 1237-1238 (`frameCounter`, `lastFpsTime`, assigned in the loop), 2141, 3703-3713, 5982-5987 | Holder only. |
| `src/engine/audio.ts` | 89-141 (`SFX`) | |
| `src/engine/renderer.ts` | 1166-1333 (quality tiers, telemetry, `init3DEngine`), 6006-6011 (resize) | |
| `src/engine/worldMesh.ts` | 1149-1160 (`getBiomeColor`), 1335-1535 (sky, time of day, terrain mesh, water, grass, bridge) | |
| `src/engine/worldBuild.ts` | 1537-2138 (landmarks, castle, altar, forge, bank, slayer master, merchants, guards, props) | The guard's GLB load uses the shared loader from finding 28, `loadGltfOnce(url, load = defaultGltfLoad)`; the injectable `load` is what lets a test make it fail once and then succeed. |
| `src/engine/playerMesh.ts` | 2143-2516 | |
| `src/engine/monsterMeshes.ts` | 2518-3375 (helpers, ten builders, factory, `poseMonsterLimbs`) | Largest module, about 860 lines. |
| `src/engine/spawns.ts` | 3377-3551 (`spawnMonster`, `spawnResourceNode`) and the loop over `placements.ts` | |
| `src/engine/input.ts` | 3715-4058 (listeners, hover, context menu, click), 6070-6085 (hover tile) | |
| `src/engine/vfx.ts` | 4124-4745 | |
| `src/engine/actions.ts` | 4082-4122 (teleport, region change), 4747-5117 (attack, monster death, retaliation, player death, respawn, gather) | Formulas stay here, unchanged. |
| `src/engine/overlay.ts` | 5119-5357 (minimap, world-to-screen, landmark and floating labels) | The inline river formula at 5154 becomes `riverCenterX`. |
| `src/engine/loop.ts` | 5359-5980, cut into named functions called in the same order: `updateVitalsAndRegen`, `updatePlayerIntent`, `updatePlayerMotion`, `updatePlayerAnimation`, `updateCamera`, `updateMonsters`, `updateWorldTimers`, `updateOverlay`, `renderFrame` | `updateMonsters` calls `stepMonster` and applies its events. |
| `src/engine/session.ts` | 983-1063 (save, load, reset), 6087-6128 (cheats), 6200-6219 (onboarding) | |
| `src/ui/hud.ts` | 143-200 (icons, chat, combat level, requirement text), 293-318 (XP drop, banners), 470-477 (tabs), 575-803 (`updateAllUI`), 4060-4080 (target HUD), 5991-6004, 6014-6024, 6050-6068 (tooltips) | |
| `src/ui/playerActions.ts` | 265-291 (`grantXp`), 320-468 (inventory use, equip), 479-573 (style, special, prayer, spells, XP rate), 805-981 (modals, commerce, crafting, quest and slayer claims), 6026-6048 | UI controllers: call state, then chat, sound and redraw. |
| `src/engine/runtime.ts` (what remains) | 6130-6199 (`wireBridge`), 6221-6253 as `boot()` | Under 200 lines. |
| Deleted | 327-335 (two functions with no caller), 1078 (`particlesList`), 3592-3700 (atmospheric motes, never called), 3713 (`contextTarget`, never read), 5988 (`lastMiniYaw`) | Dead code named by the maps and by finding 21. |

Typing: each module loses the pragma when it is extracted. Explicit `any` is allowed at three seams only and is counted in the pull request: `Object3D.userData`, the rig parts bag (`player.parts`, monster `rig`), and GLTF scene traversal. DOM lookups go through one helper `el(id)` in `hud.ts` that throws a clear error if the id is missing, instead of 100 scattered null checks; a missing HUD element is a bug in `index.html`, not a runtime condition.

The `window.*` assignments in `wireBridge` stay, because `index.html` has 38 inline `onclick` attributes using 21 function names. The names move to one exported list, and a test parses `index.html` and fails if an `onclick` names a function that is not in the list.

### 5.2 Order of work and commit discipline

The first commit moves the `beforeunload` and `DOMContentLoaded` registrations into `boot()`, called from `main.ts`, and adds the node-import test, so that test guards every later move (early modules import back from `runtime.ts` for chat, `updateAllUI` and SFX). Then leaf modules, so each step compiles: `terrain` (with its guard test), `context`, `audio`, `vfx`, `monsterMeshes`, `playerMesh`, `worldMesh`, `worldBuild`, `placements` and `spawns`, `overlay`, `hud`, `playerActions`, `session`, `actions`, `input`, `renderer`, `monsterAi` and `loop`, then what remains of `runtime`.

Four kinds of commit, never mixed:

1. **Move.** Cut a range, paste it in the new module, add imports and exports, prefix shared state with `G.`. The new file may carry the pragma for this commit only. Reviewable as a move: `git diff --color-moved` shows no changed logic.
2. **Type.** Remove the pragma from that module and fix what the compiler reports, without changing behaviour.
3. **Reshape.** Only for `monsterAi`: the monster rules move behind `stepMonster` and `onPlayerHit` (5.4), and `inCombatWithPlayer`, `dead`, `isDying` and `dyingTimer` are replaced by `state` across `monsterMeshes`, `overlay` and `actions`. Verified by the `stepMonster` tests, not by `--color-moved`.
4. **Fix.** One audit finding per commit, with its test where a headless test is possible.

All moves, reshapes and typing land before any fix, so "is the game the same?" can be answered once, at that point, before behaviour is allowed to change.

### 5.3 The terrain module

`getTerrainHeight` and `rawHills` move unchanged. Before the move commit is merged, a test samples the moved function on a 5-unit grid over [-130, 130] and stores the values as a golden file. This "extraction guard" proves later refactors in Stage 1 do not change the terrain. Stage 2 replaces it on purpose (section 6.11).

A second, permanent test holds invariants that both stages must keep: height is exactly 0 within 16 of each region centre; at (`riverCenterX(0)`, 0) the height is below the water plane (-0.34); at points 28 or more from every region centre and outside the river trough (`|x - riverCenterX(z)| >= 6.8`), height is at least 0.08 in Stage 1. (Inside the 16-28 blend ring the height goes to 0, and today the ring also hides the river under the west half of the bridge; Stage 2 fixes the latter, 6.2.)

### 5.4 The monster step function (Stage 1 shape)

Stage 1 extracts today's behaviour without changing it. States and constants are the ones in the code now.

```
type MonsterLogic = {
  typeKey, level, style, maxHp, hp,
  x, z, homeX, homeZ,
  state: 'idle' | 'chase' | 'attack' | 'dying' | 'dead',
  attackCooldown, wanderTimer, wanderX, wanderZ, timer, breathCount
}
stepMonster(m, world: { playerX, playerZ, playerDown, dt, rand }): MonsterEvent[]
onPlayerHit(m, dmg): { applied: boolean, events: MonsterEvent[] }
```

`onPlayerHit` is the only writer of monster state outside `stepMonster`. The engine's `applyDamage` (4842-4850) calls it instead of writing `monster.hp` and `inCombatWithPlayer`. It sets `chase` (T1, also on a miss with `dmg` 0, as 4844 does today), applies the HP loss, and on HP 0 enters `dying` and emits `died`; the engine runs drops and XP from `died` (today's `handleMonsterDeath`, 4918-4923). The player-death write at 5039 is replaced by the `playerDown` rule of `stepMonster`. In Stage 2 the immunity of `return` lives here (6.5).

`MonsterLogic.x` and `.z` are written only by `monsterAi`. The engine copies them to `rig.group.position` after each step; the overlay, targeting and VFX read the mesh position, as today.

| From | To | When (today's rule) |
|---|---|---|
| idle | chase | The player's attack resolves against it (`onPlayerHit`). Nothing else. |
| chase | attack | Distance to player is at most 11.0 (ranged or magic) or 2.9 (melee). |
| attack | chase | Distance exceeds that range. |
| chase, attack | idle | Distance to player over 26, or the player goes down (5039). HP is kept. |
| any living | dying | HP reaches 0 (`onPlayerHit`). Lasts 0.85 s. |
| dying | dead | Timer ends. Lasts 7.5 s. |
| dead | idle | Respawn at home with full HP. |

In `idle` it picks a wander point within 4.5 of home every 2.5 to 6.5 s and walks at 1.8. In `chase` it moves at 5.2 through `moveWithCollision`. In `attack` it emits an `attack` event every 1.65 s, the first immediately. The engine turns `attack` into `performMonsterRetaliation`, and reads `state` to pick the pose. `rand` is injected so tests are deterministic; the engine passes `Math.random`.

### 5.5 Save loading

No format change. `version` stays 4. What changes is validation, all inside `migrateLegacySave` (pure, tested), and the corrupt-save guard inside `readSave(storage)` (pure, tested with the in-memory `StorageLike`):

| Field | Today | Stage 1 |
|---|---|---|
| `playerPos.x`, `.z` | Any `number` is applied. `1e999` in JSON parses to `Infinity` and passes. No bounds or walkability check. | Must be finite. Clamped to the walkable bound (118). If the point is not walkable, the nearest walkable point within 12 units is used; failing that, the home respawn point. |
| `currentRegion` | Any string. | Must be an id in `WORLD_REGIONS`, else `lumbridge`. |
| `timeOfDay` | `n % 3` (keeps negatives and fractions). | Integer 0, 1 or 2, else 0. |
| `gp` | `typeof === 'number'`, so `Infinity` passes, and `1e308` overflows to `Infinity` on the next gain. | `Number.isFinite`, floor, clamp 0..2147483647. |
| `hp`, `prayerPts`, `specEnergy` | `typeof === 'number'`, so `Infinity` passes. | `Number.isFinite`, then the existing clamps. |
| Inventory and bank `qty` | `compactSlots` (`inventory.ts` 73) keeps `Infinity`; selling it sets `gp` to `Infinity` and leaves a `NaN` slot. | Must be a finite integer; clamped to 1..2147483647 (the same cap as `gp`); otherwise the slot is dropped. |
| Item and equipment ids | `ITEMS[id]` truthy, so `constructor` and `__proto__` pass (finding 2). | `Object.hasOwn(ITEMS, id)`. |
| `activeSpell` | Any string. | Must be the id of a combat spell in `SPELLS`, else `wind_strike`. |
| `quests.claimed` | Any number of strings. | Kept only ids that exist in the quest catalog (`QUEST_DEFS`), deduplicated. |
| `quests.slayer` | `name` copied from the save and later written with `innerHTML` (finding 1). | Kept only if `monster` is a known slayer monster; `name` taken from the catalog. |

Two data-loss guards:

- In `readSave(storage)` (`save.ts`). Today its single `try` around `JSON.parse` and `migrateLegacySave` falls through to the legacy keys on any failure, so a corrupt main save can load an older legacy save that the autosave then writes over the main key, and the caller never learns the main save was corrupt. New rule: if `SAVE_KEY` holds a value that fails `JSON.parse` or `migrateLegacySave`, `readSave` copies the raw string to `gielinor_hero_save_v1_corrupt` (only if that key is empty) and does not try the legacy keys. It returns a `MigratedSave` built from `migrateLegacySave({})` with a new field `corrupt: true` (every other result has `corrupt: false`), so the return type stays `MigratedSave | null` and the existing `readSave` test is untouched. `session.ts` only reads the flag: it starts a new game, as today, and prints one chat line naming the backup key. The autosave stays on: the raw value is in the backup. Accepted limit: if the backup key already holds an earlier corrupt save, the new one is not copied and the autosave replaces it; the first corrupt copy is the one kept. `loadGameState`'s outer catch (runtime ~1044) stays as it is; after this validation `applyState` receives only a well-formed state, so a throw there is a bug, logged with `console.error`.
- The empty `catch` around the autosave (1006) shows "Save failed" on the save button instead of nothing.

The one-time gear migration behind the `gielinor_anime_hero_v1` flag (1018-1032) moves as it is.

### 5.6 Fixes in Stage 1

The full list with one row per finding is the ledger in section 9. The decisions that are not obvious from the audit's own fix text:

- **Finding 6, shop arbitrage (CALL-2).** `buyItem` refuses gathered goods (`isGatheredGood`: ores, raw fish, logs, bars, bones), and the shop hides their buy buttons. This is the audit's first option. No existing test buys such an item (the bulk-buy tests buy runes only). The alternative is to reprice every crafted output, which touches the whole price table and belongs to the economy work in Stage 3. Side effect to accept: bones can no longer be bought to train Prayer.
- **Finding 13, shadow resolution (CALL-3).** The default tier renders at 2048 today because of the hard-coded value at 1311-1312, and later tier changes do nothing. To keep the look that ships, the per-tier resolution is removed: shadows are 2048 on every tier that has them, and tiers change pixel ratio and shadows on or off, which is what actually happens today. The alternative (1024 on "balanced", as the tier table intends) is cheaper to render and makes the default look softer.
- **Finding 12, vitals and autosave.** `updateAllUI` stops calling `saveGameState`. Saving remains: every 2 s in the loop, on `beforeunload`, on manual save, plus one new `visibilitychange` (hidden) save. Vitals bars update from the loop at 10 Hz. The README sentence "saved on every action" is corrected.
- **Finding 19, outlines.** The flag is initialised to off, which matches what is drawn today.
- **Finding 35, `knight.blend`.** Resolved by provenance, not removal: the file is Blend Swap blend 28541, "Rigged Knight in Armor" by Xali, CC0 (the `28541` in the folder name is the Blend Swap id). Stage 1 commits a `LICENSE.txt` beside the blend with title, author, source URL and licence, and lists it in the credits. CC0 needs no attribution; it is credited anyway. One caveat is recorded in that file: the author says the base mesh came from a CGTrader model whose terms are not stated on the page. The guard and `guard.glb` stay; no code change.
- **Finding 34, credits.** A `CREDITS.md` and a README section list each third-party asset with title, author, source and licence; the README states that MIT covers the code only; the Settings window gets one "Credits" line naming yoji and uchiha007 (CC-BY 3.0).
- **Finding 37, dev dependencies (CALL-4).** vite and vitest move to the first versions `npm audit` accepts (major-version bumps: vitest 4, vite 6.4.4 or later). CI pins Node 22.
- **Findings 5 and 41, `vercel.json` (CALL-5).** `X-Content-Type-Options: nosniff`, `Referrer-Policy: strict-origin-when-cross-origin`, `Content-Security-Policy: frame-ancestors 'self'`, and `Cache-Control: public, max-age=31536000, immutable` for `/assets/*` only. `frame-ancestors 'self'` stops other sites from embedding the game in a frame (Q5).
- **Finding 42.** The unused `amulet_15782/` folder is deleted and `.gitignore` gets an exception for the tracked zip. Proposal (CALL-12): Git LFS and history rewriting are not done in these stages; they change how every clone works, for no gain here.

Two defects that the maps found and the audit did not, fixed in Stage 1 because the extraction touches them:

- `runtime.ts` 5496-5505: the `dialogue` branch reads `player.targetEntity.ref` after setting `player.targetEntity = null`. Talking to a guard throws. The reference is read before it is cleared.
- The saved position is applied without any check (section 5.5).

### 5.7 Stage 1 verification

Headless, in vitest (`node` environment):

| Goal | Proof |
|---|---|
| G1.1 | Test: no `.ts` file under `src/` exceeds 1000 lines. Test: every module under `src/` except `main.ts` (which imports the stylesheet and calls `boot()`) imports in `node` without throwing. Today the largest file after `runtime.ts` is `playerGear.ts` at 924 lines, so the limit binds only the new modules. |
| G1.2 | Test: no file under `src/` contains `@ts-nocheck` or `@ts-ignore`. `tsc --noEmit` passes under the existing strict config. |
| G1.3 | Terrain: extraction-guard golden and the permanent invariants (5.3). `regionAt`: each region centre; (40, -10) returns `lumbridge` (first match where Lumbridge and Varrock overlap); a point outside every radius returns `null` and the caller keeps `currentRegion`. `stepMonster` and `onPlayerHit`: a passive monster never leaves `idle` without a hit over 60 simulated seconds; a hit, including a miss, sends it to `chase`; HP 0 enters `dying`; first attack is immediate and then every 1.65 s; combat drops beyond 26 with HP kept; respawn after 0.85 + 7.5 s at home with full HP. Placements: every monster type has a `MONSTER_TYPES` entry, every node a `RESOURCE_NODES_DEF` entry, every monster point is walkable, every fishing point is within 6.8 of `riverCenterX(z)` and within 3.1 of walkable ground. Known defect, kept by "same coordinates" and deferred to Stage 2: (28, 14), (29, 22), (27, -18), (25, -36) and (27, -44) stand on walkable ground by `isDeepWater`, and (27, 5) and (26, -8) are buried inside Lumbridge's blend ring; Stage 2 restores the trough there (6.2) and its world-data test requires every fishing spot to be in water. Layering: `src/state` and `src/data` do not import `three`, engine or UI, or mention `document` or `window`. |
| G1.4 | The 103 existing tests pass with no edit to their assertions. Test: every function named in an `onclick` in `index.html` is in the exported globals list. |
| G1.5 | Round-trip: a state with non-default `gp`, skills, bank, slayer task, claimed quests, prayers, spell and special energy survives `writeSave` then `readSave` (finding 10). A checked-in version-4 fixture captured from the running game before the stage starts loads to the expected state. The existing legacy tests stay. Hostile fixture: `Infinity` position, position inside the castle keep and inside the river, unknown region, `constructor` as an item id, a slayer task whose name is an HTML string, a bank stack with `qty` `1e999` and `gp` `1e308`, an unknown `activeSpell` and an unknown `claimed` id; the result is finite, walkable, a known region, no inherited-key item, a catalog name, every `qty` and `gp` finite and at most the cap, `wind_strike`, and no unknown claimed id. Through `readSave` with the in-memory `StorageLike`: a non-parsing main save is copied to the backup key and reports `corrupt: true`; a corrupt main save next to a valid legacy key reports corrupt, keeps the raw value, and does not load the legacy save. |
| G1.6 | One test per fixed finding where the fix is in pure code: `buyItem` refuses ore and still sells runes and arrows (6); `resolveDragonfire` returns reduced damage with the ward flag and no shield (7); crafting succeeds when the inputs free the slot (8); the GLB loader retries after a failed load, tested by passing `loadGltfOnce` a stub `load` that rejects once and then resolves (28); `run-blender.mjs` exits non-zero when the binary is missing, when a stub binary exits 3, and on an unknown mode, and passes `--disable-autoexec` and `--python-exit-code 1` (4, 36; the stub is a script pointed to by `BLENDER_PATH`, no Blender needed); `vercel.json` contains the four headers (5, 41). |
| G1.7 | Test: `CREDITS.md` names each CC-BY asset (the dragon by yoji, Kai by uchiha007) with its licence, and, names the knight's source, author and licence (Blend Swap blend 28541, "Rigged Knight in Armor" by Xali, CC0). The in-game Credits line stays on the smoke list. |
| G1.8 | The CI run on the pull request is green. `npm audit --audit-level=high` exits 0. |

Needs a human looking at the running game (recorded in the pull request):

- Screenshots at noon from the two fixed poses of `shot-03-noon.jpg` (start) and `shot-04-peak.jpg` (last shrine), set through `window.__DEBUG`, compared side by side with the originals. Expected: no visible difference except grass blade positions, which are unseeded random today.
- The perf HUD at those two poses: draw calls and triangles within 2% of today's 1509 calls / 226k triangles (start) and 544 calls / 108k triangles (shrine).
- Leak check for findings 11, 16, 17 and 26: read `renderer.info.memory.geometries` in the console, perform 200 attacks, 5 level-ups and 20 gear swaps, read it again. Expected: back to the first value. Today it grows without bound.
- Smoke list, each item once: walk by click and by keys; cross the bridge; chop, mine, fish; fight a goblin with melee, ranged and magic; die and respawn; pray at the altar; bank deposit and withdraw; buy and sell; forge; equip and unequip; teleport by spell and by shrine; talk to a guard (throws today); type "wasd f" and spaces into the bank search and the cheat box and see the hero not move (22); reload and find position, camera and time of day restored; Credits visible in Settings.
- Vitals bars move while standing still and regenerating (12).

Findings resolved by Stage 1 (31 of 43; numbers are the ledger's, section 9): 1, 2, 4, 5, 6, 7, 8, 10, 11, 12, 13, 15, 16, 17, 19, 20, 21, 22, 25, 26, 28, 33, 34, 35, 36, 37, 38, 40, 41, 42, 43. Findings in code Stage 1 touches that it does not fix, with their written deferral in the ledger: 14 (to Stage 4) and 18 (to Stage 2).

---

## 6. Stage 2 design: World as a place

### 6.1 World data

One new file, `src/data/worldMap.ts`, typed constants only:

| Table | Row shape | Used by |
|---|---|---|
| `PATHS` | `id, name, points: [x, z][], halfWidth` | Height (flattening), ground colour, minimap, the walkable guarantee, labels |
| `RIDGES` | `id, name, points: [x, z][], height, halfWidth, coreHalfWidth, gaps: { at: [x, z], halfWidth }[]` | Height, walkability (the core blocks), ground colour, minimap |
| `BASINS` | `id, name, x, z, radius, depth` | Height (below the water plane, so the existing water shows), walkability |
| `POIS` | `id, name, x, z, padRadius, pieces: { node or builder, dx, dz, rot, scale }[], sign?: string` | World build, labels, flat pads in the height function |
| `CAMPS` | `id, x, z, radius, aggressive, aggroRadius, members: { type, x, z, wander }[]` | Spawns, `stepMonster`. Camps have ids only; they are never shown to the player. A camp that is also a place gets its name from `POIS`. |
| `SAFE_ZONES` | Derived: radius 14 around each region centre | `stepMonster`, validation |

`src/data/placements.ts` from Stage 1 keeps the resource nodes; its monster rows move into `CAMPS` unchanged in shape (`wander` is optional, default 4.5). The 34 monsters of today plus two more pass sentries exist (36); some stand in new places.

This is compiled data, checked by the type checker and by the validation test in 6.11. Nothing is parsed at run time, and no editor or file format is introduced.

### 6.2 Terrain model

`getTerrainHeight(x, z)` stays one pure function in `src/state/terrain.ts`. It composes, in this order:

1. **Base hills.** Today's `rawHills`, with amplitude raised away from settled ground: multiplied by a factor that goes from 1 near any region centre or path to about 2.2 in the wilds. The existing crag ramp in the last region's corner is kept.
2. **Ridges.** For each ridge, a smooth profile of the distance to its polyline, `height` at the crest and 0 at `halfWidth`. The maximum over ridges is added. At a gap, the profile is scaled down to a saddle. This is the pass.
3. **Basins.** Inside a basin radius the height is pulled down to `-depth` at the centre. With `depth` over 0.34 the existing water plane shows through, which gives ponds with no new water code.
4. **Paths.** Within `halfWidth` of a path polyline the height is pulled toward a smoothed copy of itself (the base sampled at low frequency), with a 3-unit shoulder, so paths are gentle and readable. Where a path crosses the river it must be on the bridge (validated).
5. **River.** Today's trough, unchanged, applied after the paths so Millrace Road's flattening does not fill it under the bridge.
6. **Flats.** The five region cores: 0 within 16, then blended from 0 to the composed height of steps 1-5 out to 28. Today the ring blends to `rawHills` and drops the river, which fills the west half of the trough under the bridge; blending to the composed height restores it. Then POI pads (flat at the local height within `padRadius`).

Because the region cores are applied last and are still exactly 0 within 16, the castle, its collision boxes, the bank, forges, altars, shrines and every existing station keep their coordinates and their height of 0. The existing collision, shrine and `biomeGroundId` tests keep passing untouched.

Mesh: the terrain plane goes from 80 to 160 segments per side (cell 1.625 units, 51,200 triangles instead of 12,800) so a ridge 6 units thick has a shape. The mesh stays one draw call.

Ground colour (`getBiomeColor`): the hard-coded road strip at 1153 (which crosses the river north of the bridge) is replaced by "within a path's half-width: dirt"; slopes steeper than a threshold take the existing crag colour, so cliffs read as rock. The terrain shader already has palette targets for dirt and crag, so the shader does not change. At the shrine ends of Saltwind Track, Lanternway and Cinder Stair the shader replaces the albedo with the desert, korok or volcanic tile, so the dirt vertex colour only tints it there. If the screenshot check shows paths unreadable inside a biome tile, the fallback is to scale each biome weight by `(1 - dirtW)` in `TERRAIN_SAMPLE`; no existing `textures.test.ts` assertion covers those lines. Grass is not placed on paths or steep slopes; the count stays 900.

Slopes do not block movement. Only these block: the map bound, the river outside the bridge, the castle walls (all three exist today), ridge cores, and basin water. `isWalkable` in `collision.ts` gains the last two as distance tests against `RIDGES` and `BASINS`.

### 6.3 Proposed layout (CALL-6)

Coordinates are proposals to tune during the build; the validation test, not this table, is what must hold. Existing region names are used here only to say where things are.

Paths:

| Name | Route |
|---|---|
| Millrace Road | Start town east to the bridge at (28, 0), then to the east plaza at (78, -20). Replaces the misplaced painted strip. |
| Saltwind Track | Leaves Millrace Road just east of the bridge, runs south-east to the dunes shrine. |
| Lanternway | Start town west to the woods shrine. |
| Cinder Stair | Start town south-west to Cinderstep Pass, then up to the last shrine. |

Ridges:

| Name | Shape | Role |
|---|---|---|
| Harrowback Ridge | From the west map bound near (-118, 22), east to about (-36, 30), then south along x of about -32 to the south map bound. Crest about 12 units. One gap. | Closes off the volcanic corner. Both ends run past the walkable bound, so there is no way around. |

A second, scenic ridge east of the river is left as an option for the Stage 5 visual pass.

The single gap in Harrowback Ridge is **Cinderstep Pass**: a corridor 5 units wide and about 24 long, near (-31, 55). The ridge is thickened there so the corridor has that length.

Basins: **Reedglass Tarn** (a pond beside Lanternway, with one existing-type fishing spot) and **Tamarisk Pool** (a pond in the dunes, outside the region core, with one fishing spot and the existing palm node). The second makes the region's existing "Oasis Fishing" description true.

The five river fishing spots that stand on walkable ground today ((28, 14), (29, 22), (27, -18), (25, -36), (27, -44), see 5.7) move onto deep water near their current places; the two buried in Lumbridge's blend ring are uncovered by the restored trough (6.2).

Points of interest:

| Name | Where | Built from |
|---|---|---|
| Three Kettle Camp | East of the start town near the river; home of the goblins and goblin archers | Procedural tents and fire ring; `World_crate`, `World_barrel`, `World_bag_grain` |
| Wardstone Cairn | On Cinder Stair, just outside the pass | Procedural cairn; `World_plaza_pillar`, `World_woods_lantern`; interactable with a one-line warning (uses the existing `dialogue` action) |
| Cinderstep Pass | The gap in Harrowback Ridge | Terrain only; `World_obsidian_spire` flanking it |
| Slagfall Terrace | Inside the ridge, south-west of the last shrine; home of two demons, starting from today's (-56, 56) and (-58, 84) and moved as needed to pass the 6.11 world-data test | `World_obsidian_spire`, `World_lava_fissure`, flat pad |
| Lampwright's Hollow | On Lanternway before the woods | `World_woods_lantern`, `World_mystic_mushroom`, `World_crate` |
| Reedglass Tarn | Beside Lanternway | Basin, existing tree nodes, fishing spot |
| Tamarisk Pool | In the dunes | Basin, `World_palm_tree`, `World_sandstone_arch`, fishing spot |

Procedural meshes are limited to four small builders in the style of the existing ones in `worldBuild.ts`: tent, fire ring, cairn, signpost. Signposts stand at path forks and use the existing floating-label list for their text.

### 6.4 Camps and aggression (CALL-7)

Every monster belongs to a camp. The camp circle is its territory.

The first column describes each camp for this document; in data they are ids. The validation test in 6.11, not this table, decides the final coordinates of every camp and member: several of today's positions cannot pass it (the giants need a camp radius of about 10.6, which reaches into the plaza's safe zone; the dragon at (-82, 82) leaves room for a lair radius under 4.4; the demon at (-64, 78) and two guardians stand inside a safe zone).

| Camp | Members | Aggressive |
|---|---|---|
| Hen yard (start town) | 4 chickens | No |
| Three Kettle Camp | 5 goblins, 2 goblin archers | No |
| Wizard circle (north of Millrace Road, off the road) | 3 dark wizards | Yes |
| Ranger post (north of the plaza) | 2 dark rangers | Yes |
| Giant camp (south of the plaza, moved as needed to pass the 6.11 world-data test; does not cover the ore rocks or the willows) | 4 hill giants | Yes |
| Dune nests, two camps off Saltwind Track, clear of the gold and mithril rocks | 5 scorpions | Yes |
| Deep woods, two camps of radius about 8: west, centred near (-99, -30), and south, centred near (-75, -56) | 4 moss guardians, two per camp, moved with the trees | Yes |
| Pass sentries (in series along Cinderstep Pass) | 4 lesser demons, wander radius 1: today's (-64, 78) and (-82, 58) moved here, plus two more instances | Yes |
| Slagfall Terrace | 2 lesser demons, from today's (-56, 56) and (-58, 84), moved as needed | Yes |
| Dragon's lair (far corner, moved as needed to pass the 6.11 world-data test) | The dragon | Yes |

The 7 yew and magic trees stand today 15 to 22 from the woods centre, spread around the whole circle, so no two camps can hold them and stay clear of a radius-14 safe zone. They move into the two deep-woods camps (proposals, tuned by the test): west camp, yews (-96, -24) and (-102, -27), magic (-97, -36); south camp, yews (-70, -53) and (-80, -53), magic (-75, -61) and (-79, -59). Every one is at least 21 from the woods centre.

Rules:

- The start region is entirely passive. Early-game pacing is Stage 3 and is not touched here.
- An aggressive camp attacks only a player it is a threat to: the existing `monsterThreatColor(monster level, player combat level)` must not be `green`, that is, the monster's level is at least the player's combat level. The colour of the monster's name, which the player already sees, therefore says whether it will come: red or yellow will, green will not. No new HUD.
- The four paths and every safe zone (radius 14 around each region centre, which covers the shrine, the teleport landing point and the respawn point) lie outside every aggressive camp, with one exception made on purpose: Cinder Stair runs through the pass sentries' camp. Passive camps may sit inside the start town's safe zone.
- After a load, a respawn or a teleport, no monster acquires the player for 3 seconds.

Aggression changes who can gather what, so this is the complete list of resources and quest steps that end up inside an aggressive camp. A test fails if any other resource node is inside one.

| Inside an aggressive camp | Guarded by | Affects |
|---|---|---|
| The 4 yew and 3 magic trees (moved into the two deep-woods camps, above) | Moss guardians, level 45 | Woodcutting 35 and 50; the step "Chop a Yew or Magic log" of the woods quest |
| Nothing else | | The 3 runite rocks stay where they are, behind the pass and outside every camp: the pass guards them (Mining 50; the step "Mine runite ore"). Iron, mithril and gold rocks, willows, maples, every fishing spot and every station stay outside all aggressive camps. Kill steps of quests are unaffected: the player attacks first, as today. |

A player whose combat level is above 45 is ignored by the guardians and gathers in peace; below that, they have to fight or pick their moment. That is the intended meaning of "preparation" outside the gated corner.

### 6.5 Monster behaviour model

`MonsterLogic` gains `campId` and the state `return`. `world` gains `playerCombat`, `playerSafe` (inside a safe zone or in the 3-second grace) and the camp table. All distances are horizontal.

| # | From | To | Condition |
|---|---|---|---|
| T1 | idle | chase | The player's attack resolves against it (as today). |
| T2 | idle | chase | The camp is aggressive, and the player is up, and not `playerSafe`, and threat colour is not green, and distance monster to player is at most the camp's `aggroRadius` (default 9 for melee, 12 for ranged and magic), and the player is inside the camp radius. Emits `aggro`. |
| T3 | chase | attack | Distance to player at most 11.0 (ranged or magic) or 2.9 (melee). Unchanged numbers. |
| T4 | attack | chase | Distance exceeds that range. |
| T5 | chase, attack | return | Any of: monster is farther than camp radius + 4 from the camp centre (leash); player is farther than 26 (today's drop distance); the player goes down; the player becomes `playerSafe` and the camp is aggressive (a passive monster the player attacks from inside a safe zone fights back as today); the monster has moved less than 0.2 units in 1.5 s while in `chase` (blocked by a wall or water). |
| T6 | return | idle | Within 1.0 of home. HP is set to full and `breathCount` to 0. Emits `reset`. |
| T7 | any living except return | dying | HP reaches 0. 0.85 s. Unchanged. |
| T8 | dying | dead | Timer ends. 7.5 s. Unchanged. |
| T9 | dead | idle | Respawn at home, full HP. Unchanged. |

Per state: `idle` wanders within the member's `wander` radius of home (default 4.5, as today) at 1.8. `chase` moves straight at the player at 5.2 through `moveWithCollision`. `attack` emits `attack` every 1.65 s, the first immediately, as today. `return` moves straight home at 5.2, ignores T1 and T2, and takes no damage: `onPlayerHit` (5.4) returns `applied: false` for a monster in `return`, and the engine shows a miss with one chat line saying it has lost interest. This is a check in front of the unchanged attack formula, not a change to it. Without it, a player standing in a safe zone or just outside the leash could hit a monster that never fights back.

Engine side: `aggro` prints one chat line and the existing in-combat label style applies; `attack` calls `performMonsterRetaliation`, which from Stage 2 gets its roll from the extracted, unchanged `rollMonsterHit` (6.6); `reset` refreshes the label. The player does not auto-retaliate; that is a combat-feel decision for Stage 4.

Rule changes that ride on this and are called out (CALL-8): leaving a fight now sends the monster home, untouchable on the way, and heals it on arrival (today it stops where it is and keeps its HP); this applies to passive monsters too.

Accepted limit: a ranged or magic player can still stand outside a camp, hit a monster, and land a few more hits while it runs to the end of its leash, before it turns back and heals. Weak monsters can be killed inside one such cycle. Closing that needs line-of-sight or monster pathfinding, which are non-goals here; it belongs to Stage 4.

### 6.6 The gated approach

What "requires preparation" means concretely for the volcanic corner:

1. Harrowback Ridge closes the corner. Its core is not walkable and both ends pass the map bound.
2. The only way in is Cinderstep Pass: 5 units wide, so nowhere in it is farther than 2.5 from the centre line, inside a melee monster's reach of 2.9. Four level-68 demons stand along it in series with a wander radius of 1. In open ground the player outruns any monster (11.5 against 5.2), and a runner is in any one sentry's reach for only about half a second, so one sentry is one blow at most. By the existing hit and damage rules a fresh character (10 HP, hit chance 0.82, damage 1 to 22) survives two such blows about 23% of the time and four about 3%. That is why there are four, in a corridor, and not two in a doorway.
3. Wardstone Cairn, just outside, tells the player what is ahead.
4. Getting through takes one of: the levels and gear to kill the sentries; Protect from Melee and enough prayer points to run past (the existing `mitigateDamage` cuts their hits to 20%, at most 4 each); or enough hitpoints, defence and food to take four blows. The acceptance threshold, proven by a seeded simulation (6.11): a fresh character survives the run in fewer than 5% of 1000 runs; a character with 40 hitpoints and Protect from Melee survives every run. The gate is a strong filter, not a lock. The tuning knobs, if the simulation misses the threshold, are sentry count and spacing; no formula is touched.
5. Teleports cannot skip the first visit (CALL-9): `canCastTeleport` additionally requires the destination's shrine to be discovered. Shrine travel from the world map already requires it. Today the teleport spell needs only Magic 35 and runes. Effect on existing saves: a player who has the level but never walked there loses that one teleport until they do.
6. Inside, the shrine sits in a safe zone, the demons of Slagfall Terrace and the dragon's lair are separate camps, and the runite rocks stay where they are, outside every camp.

To prove the threshold headless, Stage 2 extracts the monster's hit roll (runtime 4966-4990) into `src/state/combat.ts` as `rollMonsterHit(typeKey, breathCount, state, rand)` (it reads `MONSTER_TYPES[typeKey]`, because `MonsterDef` carries no key and dragonfire is keyed on the type), returning `{ dmg, dragonfire, absorbed }` and keeping the order of `rand` draws; it applies `mitigateDamage` (and `resolveDragonfire`) itself. The caller increments `breathCount` and sets `attackAnim`.

The other regions are gated more lightly, by position only: their shrines and paths are safe, and the yew and magic trees sit among the moss guardians; ore rocks stay outside every aggressive camp (6.4).

### 6.7 Player movement

New pure module `src/state/pathfind.ts`:

- `buildWalkGrid()`: a boolean grid of 1-unit cells over the walkable square (236 x 236 cells), filled from `isWalkable` at each cell centre once at startup. The cell must be smaller than the thinnest obstacle: the castle walls are 1.4 thick and its gate is 3.4 wide, so a 2-unit grid would either step through a wall or close the gate. A world-data test requires every ridge core and basin to be at least 2 units across.
- `findPath(grid, from, to)`: A* over 8 neighbours with no corner cutting, then waypoints are dropped wherever the straight segment between their neighbours is walkable (checked by sampling `isWalkable` every 0.25 units, well under the 1.4 wall thickness). Returns `null` when there is no route.

The player's single `targetPos` becomes a short waypoint list. Ground click, minimap click, "Walk here" and walking up to a monster, node or station all request a path once, at click time. Per frame the player still moves in a straight line toward the next waypoint through `moveWithCollision`, as today. No route prints the existing "can't reach" style chat line. Keyboard movement is unchanged.

For an entity target, the goal is the nearest walkable cell within the entity's stop distance of its position (today 2.9, 13.5, 3.1 and 3.5 by kind), so fishing spots on unwalkable deep water stay reachable; the path ends as soon as the player is within stop distance. For a monster target, the player re-paths when the monster has moved more than 2 units from the goal or when the final waypoint is reached; between re-paths the last segment aims at the monster, as today.

Ground picking raycasts the terrain once per pointer event instead of twice (finding 18), which matters more now that the mesh has four times the triangles.

Monsters do not use the path finder (section 4.3).

### 6.8 New names

Every name added by Stage 2, all proposals (CALL-10). None contains a token from the existing borrowed names, and a test enforces that against a deny-list (the existing region, monster, NPC and franchise words found in `catalog.ts` and `README.md`).

| Kind | Names |
|---|---|
| Paths | Millrace Road, Saltwind Track, Lanternway, Cinder Stair |
| Ridge | Harrowback Ridge |
| Pass | Cinderstep Pass |
| Water | Reedglass Tarn, Tamarisk Pool |
| Places | Three Kettle Camp, Wardstone Cairn, Slagfall Terrace, Lampwright's Hollow |

No new creature, item, character or map layout. The layout is drawn from this game's own five regions and river. Before merge, each name gets a web search by a human to confirm it is not a known place in a published game; the deny-list test cannot prove that.

### 6.9 What would need Blender (all deferred to Stage 7)

- Any new model: buildings, walls, gates, a second bridge, cliff meshes, tents or ruins as authored assets (Stage 2 uses four procedural builders instead).
- Any new creature or a variant with a different silhouette.
- Any change to the look, scale, pivot or material names of an existing node in `world.glb` or `monsters.glb`.
- Regenerating or compressing any GLB.

Nothing in Stage 2 depends on these.

### 6.10 Minimap and README

The minimap draws paths as dirt strokes and ridges as dark strokes, and takes the river from `riverCenterX`. The README's world table is updated for the new places and camps.

### 6.11 Stage 2 verification

Headless, in vitest:

| Goal | Proof |
|---|---|
| G2.1 | Height statistics over a 2-unit grid: range across walkable ground at least 12 units outside the volcanic corner's existing crag (today about 2.2); every region core still exactly 0 within 16; every basin centre below -0.34. |
| G2.2 | Every path sampled each unit is walkable end to end, has slope at most 0.25, and where it crosses the river it is on the bridge rectangle. Slope is not tested inside the bridge rectangle; there the path is on the bridge deck (player Y = `max(-0.25, h)`, runtime 5558). Each path ends within 8 units of its region's shrine. |
| G2.3 | Every POI piece names a node that exists in `world.glb` (the test reads the GLB's JSON chunk, as the audit did) or one of the four builders; every piece stands on walkable ground inside the POI pad. |
| G2.4 | `stepMonster` and `onPlayerHit` with fake time: T1 to T9 each have a test (T1 and T7 driven through `onPlayerHit`), including: a passive camp never starts a fight; a passive monster inside a safe zone, attacked by a player inside the same zone, fights back and can be killed; an aggressive camp ignores a player whose combat level is above the monster's; it acquires at `aggroRadius` and not beyond; it leashes at radius + 4, walks home and is at full HP on arrival; it gives up after 1.5 s against a wall; it does not acquire during the 3-second grace or inside a safe zone; attack cadence is 1.65 s; a monster in `return` cannot be damaged or re-acquired until it is home. A test that no resource node other than the yew and magic nodes is inside an aggressive camp. |
| G2.5 | Flood fill on the walk grid from the start point reaches every region shrine. With the cells of Cinderstep Pass blocked, it does not reach the last shrine. Seeded simulation of the gate: a scripted runner crosses the pass along its centre line and along each wall at 11.5 units/s while the real `stepMonster` drives the four sentries and each `attack` event is resolved with `rollMonsterHit` (which applies `mitigateDamage`); over 1000 seeds a fresh character (10 HP, no prayer) survives in fewer than 5% and a character with 40 hitpoints and Protect from Melee survives in all, and every run records at least one `attack` event per sentry. `canCastTeleport` refuses an undiscovered destination and accepts a discovered one. No aggressive camp overlaps a safe zone; no path except Cinder Stair crosses an aggressive camp. |
| G2.6 | `findPath`: start to each shrine returns a route whose every segment is walkable; around the castle and across the river it routes through the gate and the bridge; a route from outside the castle to its courtyard sampled every 0.25 units never touches a wall box; an enclosed target returns `null`; expanded cells never exceed the grid size; a path from the start point reaches the stop distance of every fishing spot; a player following a monster that moves re-paths and ends within stop distance. |
| G2.7 | The Stage 1 version-4 fixture loads unchanged. Fixtures with the saved position inside the ridge core, inside each basin, and at 20 old spawn points load to a walkable point. `serializeState` output has the same keys as before the stage. |
| G2.8 | The deny-list test over every `name` in `worldMap.ts`. |
| G2.9 | Height function: at most 60 segment-distance evaluations per call (counted from the tables). Walk grid: 55,696 cells. Terrain mesh: 160 segments. Monster count: 36. |
| World data | Every camp member is inside its camp and on walkable ground; every fishing spot is on unwalkable water (the river by `isDeepWater`, or a basin) within 3.1 of walkable ground; every monster type and node key exists; no ridge core or basin overlaps a region core, the castle, a station or a path. |

Three planned test replacements, declared here so they are not mistaken for weakening:

- The Stage 1 terrain extraction guard (a golden of the old heights) is replaced by a golden of the new heights in the commit that changes the terrain. The permanent invariants test stays, except the "at least 0.08" line, which becomes "at points 28 or more from every region centre, outside basins and outside the river trough". The new golden includes the restored trough under the bridge (6.2, step 6).
- The Stage 1 placements assertion "every fishing point is within 6.8 of `riverCenterX(z)`" becomes the world-data rule above (on unwalkable water, river or basin), because the two pond spots are not on the river.
- The Stage 1 `stepMonster` assertion "combat drops beyond 26 with HP kept" becomes "returns home, cannot be damaged on the way, and is healed on arrival" (CALL-8).

Every other existing test stays as it is.

Needs a human looking at the running game:

- Screenshots, noon, fixed poses: the start town looking toward Three Kettle Camp; Millrace Road at the bridge; Wardstone Cairn looking at Cinderstep Pass with the ridge on both sides; inside the pass with both sentries; Slagfall Terrace; Reedglass Tarn; Tamarisk Pool; the minimap with paths and ridge. Judged for: the ridge reads as a wall, paths read as paths, water sits in the basins, nothing floats or is buried, the faceted painted look is intact.
- The camera does not sink into the ridge when the player walks along its foot.
- Walk the gate as a fresh level-3 character (expected: killed in the pass) and as a character raised with the existing `skills10` cheat until Protect from Melee is available (expected: gets through, shrine discovered, teleport now works).
- Click from the start town to a point behind the castle and to a point across the river: the hero walks around and over the bridge.
- Pull a moss guardian out of its camp: it turns back, shrugs off attacks on the way, and heals. Stand in a shrine's safe zone next to an aggressive camp: nothing comes.
- Perf HUD at the two baseline poses and at Cinderstep Pass, on a real GPU, against section 8.

Findings resolved by Stage 2: finding 18 (the terrain raycast). It is assigned here rather than Stage 1 because Stage 2 rewrites ground picking for path requests and changes the terrain resolution.

---

## 7. Save format impact and migration

| | Stage 1 | Stage 2 |
|---|---|---|
| Key | `gielinor_hero_save_v1`, unchanged | unchanged |
| `version` | 4, unchanged | 4, unchanged |
| Fields written | unchanged | unchanged |
| New persistent keys | `gielinor_hero_save_v1_corrupt` (raw copy of a main save that does not parse or migrate, written by `readSave` only when the key is empty) | none |
| Reading | Stricter validation (5.5). Values that were accepted and are now rejected fall back to defaults; nothing that the game itself ever wrote is rejected. | Same code. A saved position that is now inside a ridge or a basin is moved to the nearest walkable point by the Stage 1 rule. |
| Migration code | none | none |
| Rollback | A save written after Stage 1 loads in the build before it. | Every point walkable in the Stage 2 world is walkable in the Stage 1 world (Stage 2 only adds obstacles), so a Stage 2 save loads in a Stage 1 build. |

Monster state, camp state, paths and resource depletion are not saved, as today: the world is rebuilt from code on every load. Stage 2 needs no new saved field. Shrine discovery, which the teleport rule now reads, is already saved per region id.

---

## 8. Performance budget

The two screenshots were taken on a software renderer (3 to 4 FPS), so frame rate there means nothing. The perf HUD's counters do: 1509 draw calls and 226k triangles at the start pose, 544 calls and 108k triangles at the last shrine.

| Measure | Today | After Stage 1 | After Stage 2 |
|---|---|---|---|
| Draw calls, start pose | 1509 | within 2% | at most 1750 |
| Triangles, start pose | 226k | within 2% | at most 300k (terrain adds 38k) |
| Draw calls, last shrine | 544 | within 2% | at most 700 |
| GPU geometries after 200 attacks and 20 gear swaps | grows without bound | returns to the starting count | same |
| `localStorage` writes | several per hit, plus every 2 s | every 2 s, on hide, on unload, on manual save | same |
| Full HUD rebuilds per hit | 3 to 5 | 1 | 1 |
| Height function cost | 5 region tests + 1 river test | same | at most 60 segment distances; called under 100 times per frame |
| Monster AI per frame | 34 monsters, one distance and at most one collision move each | same | 36 monsters, plus one camp-distance test each |
| Path finding | none | none | on click only; at most 55,696 cells, binary-heap open list; no per-frame cost |
| Startup work added | none | none | 25,921 height samples for the mesh, 55,696 walkability samples for the grid |
| JS bundle | 926 kB | within 10 kB | within 25 kB of today |
| Frame rate on the owner's GPU, balanced tier | to be recorded at Stage 1 start | not lower | not lower by more than 5% at the same poses |

No runtime dependency is added in either stage.

---

## 9. Audit ledger

One row per confirmed finding in `docs/audit/2026-11-13-findings.json`, in file order. Each is assigned to exactly one of: fixed in Stage 1, fixed in Stage 2, or deferred to a named later stage (roadmap in section 12).

| # | Finding (title) | File | Severity | Assignment | How, or why deferred |
|---|---|---|---|---|---|
| 1 | Save-derived slayer task name is interpolated into innerHTML (stored DOM injection) | `src/ui/stations.ts` | low | Fixed in Stage 1 | Slayer task kept only for a known monster; name taken from the catalog. |
| 2 | Save item/equipment ids are checked with ITEMS[id] on a plain object, so inherited keys pass | `src/state/inventory.ts` | low | Fixed in Stage 1 | `Object.hasOwn(ITEMS, id)` in `compactSlots` and the equipment loader. |
| 3 | Blender build scripts default render output to a hard-coded Gemini agent scratch path | `scripts/blender/build_gear.py` | low | Deferred to Stage 7 | Python build script; the change cannot be run or checked without Blender. |
| 4 | Third-party .blend files are opened without --disable-autoexec | `scripts/run-blender.mjs` | low | Fixed in Stage 1 | `--disable-autoexec` on every Blender spawn; asserted with a stub binary. |
| 5 | vercel.json sets no security headers | `vercel.json` | low | Fixed in Stage 1 | Headers block in `vercel.json` (CALL-5). A script-src policy waits for Stage 5. |
| 6 | The shop sells raw ores and fish for less than the items they craft into sell for, so GP can be printed without limit | `src/state/inventory.ts` | medium | Fixed in Stage 1 | `buyItem` refuses gathered goods; shop hides those buy buttons (CALL-2). |
| 7 | The Dragon Slayer 'Dragonfire Ward blessing' sets a flag that nothing reads | `src/state/adventure.ts` | medium | Fixed in Stage 1 | `resolveDragonfire` reads the ward flag; one new assertion. |
| 8 | Crafting says 'backpack full' even when using up the inputs would free the slot | `src/data/recipes.ts` | low | Fixed in Stage 1 | Capacity check rehearsed on a scratch copy after removing inputs. |
| 9 | Smelted bars cannot be used for anything, and smelting gold or runite loses money | `src/data/recipes.ts` | low | Deferred to Stage 3 | Changing recipe inputs from ore to bars reshapes smithing progression and prices, which is economy work. |
| 10 | No test writes a current save and reads it back | `tests/phase1.test.ts` | low | Fixed in Stage 1 | Round-trip test plus a real version-4 fixture. |
| 11 | VFX, projectiles and trail embers are removed from the scene but never disposed, so GPU geometry leaks on every attack and continuously while the lava cape is worn | `src/engine/runtime.ts` | high | Fixed in Stage 1 | Dispose geometry and material when VFX and projectiles are removed. |
| 12 | Vitals bars freeze during regeneration, and updateAllUI does several full rebuilds plus localStorage writes per hit | `src/engine/runtime.ts` | medium | Fixed in Stage 1 | Vitals updated from the loop at 10 Hz; `updateAllUI` no longer saves. |
| 13 | Quality tiers never change the shadow map resolution, and 'balanced' actually runs at 2048 | `src/engine/runtime.ts` | medium | Fixed in Stage 1 | Per-tier shadow size removed; 2048 on every shadowed tier (CALL-3). |
| 14 | The special-attack spin accumulates a per-frame increment, so it aliases and its speed depends on frame rate | `src/engine/runtime.ts` | low | Deferred to Stage 4 | The fix changes how the special attack looks at 60 Hz; the spin animation is reworked with combat feel. |
| 15 | The turn-velocity wrap compares rad/s against π, which flips the sign of bank and cape roll | `src/engine/runtime.ts` | low | Fixed in Stage 1 | The two wrap lines are deleted. |
| 16 | Level-up fireworks run private rAF loops with a fixed 0.016 s step and never dispose their meshes | `src/engine/runtime.ts` | low | Fixed in Stage 1 | Fireworks run through `spawnVfx`, so they use frame time and are disposed. |
| 17 | rebuildPlayerEquipmentMeshes and attachVannakaGear detach old gear without disposing geometry | `src/engine/runtime.ts` | low | Fixed in Stage 1 | Geometry disposed when gear nodes are detached, player and slayer master. |
| 18 | Each mousemove raycasts the 80x80-segment terrain twice | `src/engine/runtime.ts` | low | Fixed in Stage 2 | Ground picking is rewritten for path requests and raycasts the terrain once. |
| 19 | The outline flag starts as On while every outline shell is created hidden | `src/engine/runtime.ts` | low | Fixed in Stage 1 | Flag initialised to off, matching what is drawn. |
| 20 | @ts-nocheck hides type errors in a file under a strict tsconfig, including an unimported GLTF type | `src/engine/runtime.ts` | low | Fixed in Stage 1 | Pragma removed from every extracted module; `GLTF` type imported. |
| 21 | Frame-loop waste: duplicate getEquipmentBonuses, per-frame Vector3 allocations, frame-rate-dependent damping, dead code | `src/engine/runtime.ts` | low | Fixed in Stage 1 | Bonuses computed once per frame, scratch vectors hoisted, damping uses frame time, dead code deleted. |
| 22 | Global keydown handler does not ignore focused text inputs: typing in the bank search or cheat box moves, turns, jumps and toggles the special | `src/engine/runtime.ts` | medium | Fixed in Stage 1 | Key handler returns early for input, textarea and editable targets, after the Escape branch. |
| 23 | The projected-UV 'done' flag sits in userData, which geometry clones share, so only the first clone of each GLB node gets projected UVs | `src/engine/textures.ts` | medium | Deferred to Stage 5 | The fix changes the texturing of most props and gear on screen and has to be judged with the visual pass. |
| 24 | Station modals rebuild their whole body on every refresh: scroll position, keyboard focus and the search box's focus are lost | `src/ui/stations.ts` | medium | Deferred to Stage 5 | Station windows are rebuilt in the UI stage; Stage 1 removes the redraws caused by typing (22) and does not edit `stations.ts` rendering. |
| 25 | Global `-webkit-user-select: none` on * can make the bank search input uneditable in WebKit | `src/ui/styles.css` | low | Fixed in Stage 1 | One rule: inputs and textareas are selectable. |
| 26 | Re-equipping strands GPU buffers and materials: removed gear nodes are never disposed | `src/engine/runtime.ts` | low | Fixed in Stage 1 | Same change as finding 17, including non-outline materials. |
| 27 | About 11.9 MB of uncompressed GLBs (float32 attributes, no meshopt, Draco or quantization) is fetched eagerly at boot | `src/engine/blenderMonsters.ts` | low | Deferred to Stage 7 | Asset compression is out of scope and needs the asset pipeline. |
| 28 | Five copy-pasted GLB loaders cache a failed load as null for the whole session | `src/engine/blenderWorld.ts` | low | Fixed in Stage 1 | One `loadGltfOnce(url)` that forgets a failed load; used by all five loaders. |
| 29 | The texture cache key includes repeat, so the same PNGs are decoded and uploaded twice (terrain at repeat 3, props at 1.5) | `src/engine/textures.ts` | low | Deferred to Stage 7 | A memory optimisation in the texture cache, not a defect; grouped with asset weight. |
| 30 | Text contrast below WCAG AA for equipment slot labels and locked shrine titles | `src/ui/styles.css` | low | Deferred to Stage 5 | Colours are chosen in the UI identity pass. |
| 31 | Core controls are click-only divs with no keyboard access | `index.html` | low | Deferred to Stage 5 | Needs the HUD controls rebuilt as buttons, which is the UI stage. |
| 32 | Modals lack dialog semantics and focus handling, and infinite animations ignore reduced motion | `index.html` | low | Deferred to Stage 5 | Dialog semantics and focus handling belong with the modal rework. |
| 33 | README 'Play Live in Browser' link and Mirror badge point at GitHub Pages, which serves the unbuilt source and cannot run the game | `README.md` | medium | Fixed in Stage 1 | Links point at the working Vercel URL (Q6). |
| 34 | CC-BY 3.0 derived assets (dragon by yoji, Kai by uchiha007) ship in public/models without the required attribution; the repo presents everything as MIT | `README.md` | high | Fixed in Stage 1 | `CREDITS.md`, README section, in-game Credits line; MIT stated as code only. |
| 35 | knight.blend (source of the shipped guard.glb) has no licence or provenance file | `scripts/blender/export_guard.py` | high | Fixed in Stage 1 | Provenance found (Blend Swap blend 28541, "Rigged Knight in Armor" by Xali, CC0): licence note committed beside the blend and listed in the credits. The guard stays. |
| 36 | run-blender.mjs exits 0 when Blender is missing or killed, or when the Python build raises; an unknown mode silently rebuilds the hero | `scripts/run-blender.mjs` | medium | Fixed in Stage 1 | Non-zero exit on spawn error, signal, script error and unknown mode. |
| 37 | Dev tooling pinned at vulnerable versions (vite 5.4.10, vitest/@vitest/mocker 2.1.4, esbuild 0.21.5, tinypool 1.1.1) | `package.json` | medium | Fixed in Stage 1 | vite and vitest bumped to patched versions (CALL-4). |
| 38 | @ts-nocheck disables type checking for runtime.ts and icons.ts, about half of the non-test TypeScript | `src/engine/runtime.ts` | medium | Fixed in Stage 1 | No `@ts-nocheck` left under `src/`, `icons.ts` included; enforced by a test. |
| 39 | get_blend_object swallows load failures, so world props become empty roots without any error | `scripts/blender/build_world.py` | low | Deferred to Stage 7 | Python build script; changes build behaviour and cannot be verified without Blender. |
| 40 | README counts and the monster table are out of date | `README.md` | low | Fixed in Stage 1 | Counts and monster table corrected; the table is updated again in Stage 2 for new places. |
| 41 | Hashed /assets served with max-age=0; one 926 KB JS chunk is revalidated on every visit | `vercel.json` | low | Fixed in Stage 1 | Immutable caching for `/assets/*` only. |
| 42 | blender/examples weighs about 77 MB; a tracked zip contradicts the *.zip ignore rule; the amulet .blend is unused | `.gitignore` | low | Fixed in Stage 1 | Unused amulet folder deleted, ignore rule fixed. Git LFS and history rewrite not done in these stages (proposal, CALL-12). |
| 43 | No CI runs the tests or the build | `package.json` | low | Fixed in Stage 1 | GitHub Actions workflow: `npm ci`, `npm test`, `npm run build`. |

Totals: 31 fixed in Stage 1, 1 fixed in Stage 2, 11 deferred (Stage 3: 1, Stage 4: 1, Stage 5: 5, Stage 7: 4).

Every finding located in `src/engine/runtime.ts` (11, 12, 13, 14, 15, 16, 17, 18, 19, 20, 21, 22, 26, 38) is touched by Stage 1 because the whole file is split. Twelve of them are fixed there; 14 and 18 carry the written deferrals above.

---

## 10. Threat model

### 10.1 What are we working on?

A single-player browser game served as static files. There is no server, no account, no network call from game code. The data flows these two stages touch:

| Flow | Source | Trust | Sink |
|---|---|---|---|
| Save load | `localStorage` JSON under three keys | Untrusted. It can be old, truncated, hand-edited, or a save file passed between players and pasted in. | `STATE`, then: `innerHTML` in chat and modals, `player.pos`, equipment mesh building, item lookups |
| Save write | `STATE`, `player.pos`, `camState` | Ours | `localStorage` |
| World data | `src/data/worldMap.ts`, `placements.ts`, `catalog.ts` | Trusted: compiled constants, reviewed in git | Terrain, walkability, spawns, AI |
| Models | Same-origin GLBs in `public/models` | Trusted content; the fetch can fail | Scene |
| Input | Keyboard and pointer events | The player | Movement, actions, HUD |
| Build tooling | npm dev dependencies; Blender opening third-party `.blend` files | Third party | Developer machines and CI |
| Deployment | `vercel.json` | Ours | Response headers |

Trust boundaries: the `localStorage` read (the only place untrusted data enters the running game), the developer machine and CI (supply chain), and the browser frame boundary. Cheating is not a boundary: the player owns the only copy of the state. Neither stage adds a new parsed input.

### 10.2 What can go wrong?

| # | Failure | Where |
|---|---|---|
| R1 | A save carries markup that reaches `innerHTML` (finding 1). | Save load |
| R2 | A save carries non-finite or out-of-world numbers: the player is placed at `Infinity`, the renderer shows nothing, and the autosave writes the bad state back. | Save load |
| R3 | A save carries ids that resolve through the prototype chain (finding 2). | Save load |
| R4 | A save from before Stage 2 puts the player inside a new wall or pond, stuck. | Save load after Stage 2 |
| R5 | A save that fails to parse is silently replaced by a new game two seconds later, or by an older legacy save that the autosave then writes over the main key. | Save load |
| R6 | Stage 1's stricter validation rejects something the game legitimately wrote, and a player loses progress. | Save load |
| R7 | The extraction changes behaviour without anyone noticing, because nothing tests the old behaviour. | Stage 1 |
| R8 | A field is added to state and not to the serialiser, and silently resets each load (finding 10). | Save write |
| R9 | World data is wrong: a spawn inside a wall, a path through water, a camp over a respawn point (spawn-kill loop), a ridge that does not close, or a ridge that cuts a region off for good. | Stage 2 data |
| R10 | Aggression traps the player: killed on load, on respawn or on teleport arrival, repeatedly. | Stage 2 AI |
| R11 | The teleport rule strands a player: inside the gated corner with no runes and no way out but the pass. | Stage 2 rules |
| R12 | Path finding or the height function costs too much per frame or per click, or A* does not terminate. | Stage 2 |
| R13 | A monster chases forever or oscillates at the leash edge. | Stage 2 AI |
| R14 | Dev dependency advisories (finding 37); a `.blend` file runs embedded Python when opened (finding 4); a build script reports success after failing (finding 36). | Tooling |
| R15 | Any site frames the game; hashed assets are never cached (findings 5, 41). | Deployment |
| R16 | Shipped CC-BY assets without attribution, and one asset with no known licence (findings 34, 35). | Legal |
| R17 | A new name or layout turns out to be taken from an existing game. | Content |

### 10.3 What are we going to do about it?

| Risk | Decision |
|---|---|
| R1 | Mitigate at the boundary: the slayer task name comes from the catalog, never from the save. The other save strings were traced by the audit and are either matched against known ids or not written as HTML. Defence in depth by a script-src policy is deferred to Stage 5, because it requires removing the 38 inline handlers first. |
| R2, R3 | Mitigate at the boundary (5.5): finite checks, clamps, own-key lookups, known-id checks. Internal code trusts `STATE` after that and does not re-check. |
| R4 | Mitigate: the Stage 1 walkable-or-relocate rule, proven in Stage 2 with fixtures for every new obstacle. |
| R5 | Mitigate: `readSave` keeps the raw value of a corrupt main save in a backup key, does not fall back to an older legacy save, and reports `corrupt` so the game shows a message. |
| R6 | Mitigate: validation only rejects values the game cannot produce; proven by the round-trip test and the real version-4 fixture. Rejected values fall back to defaults field by field, never the whole save. |
| R7 | Mitigate: move-only commits, golden terrain test, state-machine tests on the extracted AI, the unchanged 103 tests, screenshots and counters at fixed poses, the smoke list. Accept the remainder: animation and VFX details are checked by eye only. |
| R8 | Mitigate: the round-trip test. |
| R9 | Mitigate: the world-data validation test and the two flood fills (everything reachable; the corner unreachable without the pass). The data is compiled constants, so this test is the boundary check for it. |
| R10 | Mitigate: safe zones around every arrival point, the 3-second grace, and the test that no aggressive camp overlaps a safe zone. Death already respawns in the passive start town. |
| R11 | Accept, with reason: the corner's shrine is discovered on arrival, shrine travel from the world map costs no runes, and it is in a safe zone. A player who got in can always leave by the shrine. |
| R12 | Mitigate: bounded tables (section 8), path finding only on click over a fixed grid with a closed set, a test on the expanded-cell bound. |
| R13 | Mitigate: `return` ignores aggression and damage until home, so it always ends; acquisition needs the player inside the camp radius while the leash is at radius + 4, which gives 4 units of hysteresis; the stall timer ends blocked chases. Each has a test. |
| R14 | Mitigate: bump to patched versions; `--disable-autoexec` and `--python-exit-code 1`; exit non-zero on any failure. The two Python-side findings (3, 39) are deferred to Stage 7 because they cannot be run here. |
| R15 | Mitigate: headers in `vercel.json`. |
| R16 | Mitigate: credits in repo and game; the knight asset's source and CC0 licence documented. |
| R17 | Mitigate: deny-list test for tokens; a human search per name before merge. Accept the remainder: no test can prove originality. |

### 10.4 Did we do a good enough job?

By the proofs in 5.7 and 6.11. In particular, for save loading: the hostile fixture, the real version-4 fixture, the legacy tests, the round trip, the backup-on-parse-failure test, and in Stage 2 the relocation fixtures. For world data: the validation test and the two flood fills. For the extraction: the checks listed under R7. If any of these cannot be written as described, the design is wrong at that point and the stage stops there.

---

## 11. CALLs for the owner to check

| # | Proposal | Where |
|---|---|---|
| CALL-1 | The essence list: XP curve, click-to-act, 28 slots, bank, shops, forge, faceted painted look, saves keep loading. | 1 |
| CALL-2 | The shop stops selling ores, raw fish, logs, bars and bones (it still buys them). Bones can no longer be bought for Prayer. | 5.6 |
| CALL-3 | Shadow resolution stays 2048 on every shadowed quality tier, to keep today's look; tiers change pixel ratio and shadows on or off. | 5.6 |
| CALL-4 | Major-version bumps of vite and vitest to clear the advisories; CI on Node 22. | 5.6 |
| CALL-5 | Response headers, including `frame-ancestors 'self'`, and long caching for hashed assets. | 5.6 |
| CALL-6 | The layout: four paths, one closing ridge with one pass, two ponds, seven points of interest. | 6.3 |
| CALL-7 | Which camps are aggressive; the start region stays passive; aggression only when the monster's level is at least the player's combat level; 3-second grace; safe zones of radius 14; yew and magic trees (moved into two deep-woods camps) are the only resources inside aggressive camps; the giant camp, Slagfall Terrace and the dragon's lair move as the validation test requires. | 6.4 |
| CALL-8 | Leashing: monsters walk home, cannot be damaged on the way, and heal fully on arrival, passive ones included. No auto-retaliation by the player yet. Safespotting within one leash cycle is accepted for now. | 6.5 |
| CALL-9 | The gate: one 5-wide pass with four sentries (two more demons than today), accepted as a strong filter (under 5% for a fresh character) and not a lock. Teleport spells require the destination shrine to be discovered. | 6.6 |
| CALL-10 | The twelve new names, and that camps carry ids only. | 6.8 |
| CALL-11 | Stage 1 removes `@ts-nocheck` from all of `src/`, not only from extracted code, with `any` allowed at three named seams. | 5.1 |
| CALL-12 | Which findings are fixed now and which are deferred, and to which stage. | 9 |
| CALL-13 | The order of later stages. | 12 |
| CALL-14 | Stage 1 scope as a whole: split `runtime.ts` by behaviour-preserving extraction, move out only the rules Stage 2 needs, type what is extracted, fix the findings in touched code and the cheap standalone ones. | 3, 5 |
| CALL-15 | Stage 2 scope as a whole: relief, paths, points of interest, territory with aggression and leashing, a gated approach; all in TypeScript with the existing GLBs; no change to any combat formula; no new creature type. | 3, 6 |
| CALL-16 | What is left out of both stages: starting kit and early-game pacing, combat feel and boss phases, the visual pass and UI identity, new skills, quests with dialogue, dungeons, touch controls, asset compression, and renaming existing content. | 3, 12 |

---

## 12. Roadmap (later stages, not designed here)

Numbering follows the owner's program.

| Stage | Subject | Deferred findings it receives |
|---|---|---|
| 3 | Start and pacing: starting kit, early game, economy | 9 |
| 4 | Combat with weight: telegraphed attacks, boss phases, hit reaction, sound | 14 |
| 5 | Visual pass and UI identity, including accessibility | 23, 24, 30, 31, 32 |
| 6 | Content and systems: quests with characters and dialogue, new skills, dungeons, more bosses, achievement diary | |
| 7 | Reach: touch controls, light loading, asset pipeline and model compression (needs Blender or gltfpack, neither installed today) | 3, 27, 29, 39 |
| 8 | Only if the owner decides: rename what comes from other games, with save migration | |

---

## 13. Open questions for the owner

Only questions whose answer changes what is built.

- **Q1.** Resolved, no longer a question: `knight.blend` is Blend Swap blend 28541, "Rigged Knight in Armor" by Xali, CC0. It is credited and kept (5.6, finding 35).
- **Q2.** The game's title, save key, places, monsters, NPCs and many items carry names from two commercial games. Renaming them is out of scope here. Do you want it done, and in which stage? Until then, new signposts and labels will show the existing region names next to the new original ones.
- **Q3.** CALL-2: block buying gathered goods now, or leave the money loop open until the economy stage reprices things?
- **Q4.** CALL-9 and CALL-8 change rules that existing players may rely on (teleporting to a place never visited; hitting a monster and backing off without it healing). Accept both?
- **Q5.** Is the game embedded in a frame on any other site (a portfolio page, a game portal)? If so, `frame-ancestors 'self'` must list that site or be dropped.
- **Q6.** The README links a GitHub Pages mirror that serves unbuilt source and cannot run. Stage 1 points the links at the working Vercel URL. Do you instead want the Pages mirror made to work (a deploy workflow and a Vite `base` setting)?
- **Q7.** CALL-7: is it right that the start region stays fully passive, and that every other region's monsters attack players at or below their level?
- **Q8.** CALL-3: keep today's 2048 shadows on the default tier, or drop the default to 1024 as the tier table intended?

---

## Review log

Review of 2026-11-13. Each issue was checked against the source at `1284a6e` before it was applied.

| # | Issue | Result | Reason |
|---|---|---|---|
| 1 | Corrupt save never reaches `session.ts`; legacy save loads over it | Applied in part | Confirmed (`save.ts` 146-157). Merged with 11 and 22: the guard is in `readSave` with a `corrupt` flag, and no legacy fallback. The `{ status, save, key, raw }` return shape was declined because it breaks the existing `readSave` test (`phase1.test.ts` 81-82). Turning off autosave was declined: the raw value is kept in the backup key. The limit when the backup key is already in use is stated in 5.5. The `applyState` catch is declined: after validation a throw there is a bug, and it is now logged. R5 names the legacy-overwrite form. |
| 2 | Item `qty` and `gp` not bounded | Applied | Confirmed (`inventory.ts` 73 keeps `Infinity`; `removeFrom` keeps a `NaN` slot). Added a qty row, capped `gp`, and extended the hostile fixture. |
| 3 | `activeSpell` and `quests.claimed` lack known-id checks | Applied | Confirmed (`save.ts` 33, `quests.ts` 73). Two rows added in 5.5, plus fixture cases. |
| 4 | Terrain invariants fail today | Applied | Confirmed: H(17, 0) = 0.033, and x = 21..27 at z = 0 is land in the blend ring. 5.3 and the 6.11 replacement note were reworded. |
| 5 | Fishing spots not in water | Applied (first option) | Confirmed for all seven spots named. All nine spots are within 6.8 of the river centre. The Stage 1 test states what holds today. Stage 2 moves the dry spots (6.3), and its world-data test replaces the Stage 1 assertion, declared as a third planned test replacement. |
| 6 | Paths fill the river at the bridge; blend target unclear | Applied | The river is now applied after the paths. Step 6 blends to the composed height. G2.2 exempts the bridge deck (player Y at runtime 5558). |
| 7 | Monster state written outside the AI loop | Applied in part | Confirmed (4844, 4920-4923, 5039; read at 3356, 5293, 5320). Merged with 21 into one `onPlayerHit` instead of `onPlayerAttack` plus `onDamaged`. Added the position-ownership rule and the Reshape commit kind. |
| 8 | T5 breaks kills of passive monsters in the start town | Applied | Took the smaller wording, "the camp is aggressive", which needs no new field. Added a G2.4 test. |
| 9 | Deep-woods camps impossible; guardians and demon inside a safe zone | Applied, option (a) | Confirmed: the trees are 15.1 to 22.4 from the centre, spread over 360°. Option (b), a radius-10 zone, does not fix that spread. The trees are moved into two clusters with listed coordinates. Slagfall now starts from (-56, 56) and (-58, 84). |
| 10 | Pathing to deep-water spots and moving monsters | Applied | Added the stop-distance goal and the re-path rule to 6.7, and two G2.6 tests: a path to every fishing spot, and a path to a moving monster. |
| 11 | Backup in `session.ts` cannot be tested; legacy fallback | Applied | `readSave(storage)` writes the backup and returns `corrupt`. |
| 12 | `frameCounter` and `lastFpsTime` are assigned across modules; clamp range is wrong | Applied | Confirmed (1237-1238, 5965-5971; clamps at 1033-1043). |
| 13 | `rollMonsterHit` is not pure and already mitigates | Applied | Its signature now lives in 6.6, because the extraction moved to Stage 2 (issue 27). G2.5 no longer applies mitigation twice. |
| 14 | 6.6 "ore by the giants" contradicts 6.4 | Applied | Fixed together with 19. |
| 15 | `regionAt` behaviour in overlaps not pinned | Applied | Confirmed: (40, -10) is 41.2 from Lumbridge and 41.8 from Varrock, inside both radii. |
| 16 | Biome tiles hide path dirt | Applied, without a test replacement | Confirmed (`textures.ts` 434-437). `textures.test.ts` asserts only the `uDirtMap` sample, so the fallback needs no declared third test replacement. |
| 17 | Node-import test cannot run until `boot()` | Applied | The `boot()` move is now the first commit. Only the two column-0 listeners (5989, 6224) exist. The other import-time initialisers use only `performance.now()`, which exists in node. |
| 18 | Camps pinned to today's positions fail validation | Applied | The geometry is confirmed. The validation test now decides the coordinates. The "runite inside the lair" claim was dropped: runite stays outside every camp, guarded by the pass. |
| 19 | Same contradiction as 14 | Applied | 6.6's wording was used. |
| 20 | Monster count is 34, not 33 (36, not 35) | Applied in the design doc; map not edited | Confirmed: 4+5+2+3+2+4+5+4+4+1 = 34. This task may write only this file, so the map's "Total 33 monsters" line (`world-and-monsters.md` 135) is still wrong. |
| 21 | Immunity and T1 cannot be tested headless | Applied | `onPlayerHit(m, dmg)` in `monsterAi.ts`. G2.4 drives T1 and T7 through it. |
| 22 | Backup belongs in `readSave` | Applied | Same change as 11. |
| 23 | GLB retry test needs an injectable loader | Applied | `loadGltfOnce(url, load = defaultGltfLoad)`. |
| 24 | G1.7 has no verification row | Applied | Added the row. |
| 25 | Wording reads as already decided | Applied | Header line and finding 42 (5.6 and ledger). |
| 26 | Kestrel Bluffs serves no goal | Applied | Cut from 6.3, 6.8 and CALL-6, and noted as a Stage 5 option. There are now twelve names (CALL-10). |
| 27 | `rollMonsterHit` only makes sense for Stage 2 | Applied (first option) | The extraction moved to Stage 2 (6.6). The `placements.ts` monster rows keep the shape that `CAMPS.members` reuses. |
