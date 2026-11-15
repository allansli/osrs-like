# Start and pacing: implementation plan

Date: 2026-11-14. Branch: `feat/start-pacing`. Design: `docs/superpowers/specs/2026-11-14-start-pacing-design.md` (called "the design" below; section numbers refer to it). Earlier documents this plan builds on: `docs/superpowers/specs/2026-11-13-world-foundation-design.md` ("the Stage 1-2 design") and `docs/superpowers/plans/2026-11-13-world-foundation-plan.md` ("the Stage 1-2 plan"). Source line numbers are at commit `a8cad85`.

The owner answered the open questions on 2026-11-14 (design section 15.1). Two small decisions remain (Q3.10, Q3.11, design 15.2) and the CALLs the owner did not speak to (design section 12). Nothing in this plan starts before owner step **O-13** and before Stage 2 is merged to `main` (section 0.5).

Critiqued on 2026-11-14 (`docs/superpowers/specs/2026-11-14-start-pacing-critique.md`). Applied earlier:
- M1 measures the "after" rows before any data task (a dry run with a stop rule) and adds a negative control.
- N2 fixes the reset defect (design F16).
- C1 and C2 drop the stack cap in play (design 7.1 item 6).
- U2 aligns the examine line with the shop price.

Changed by the owner's decisions of 2026-11-14:
- **No test asserts a time.** M1 asserts task counts and their order (design 5.3). T1 and G-6 no longer name a minute.
- **The hero starts with nothing.** New tasks K1 and K2 build the six starter quests and the tracker order; N1 and N2 build the empty new game.
- **The booster and the cheats are hidden.** New tasks N3 and N4.
- **An entry-level staff.** New tasks I1 and I2. No Blender task: the staff reuses the existing model.
- **Fishing empties on every catch, with cues.** D4 stays; new tasks F0 (tests) and F1 add the cues.
- **One declared test replacement:** `tests/phase3-content.test.ts` line 41 (K1).

Second-pass check of 2026-11-14 (critique, "Second pass"): N2 also keeps the one-time outfit migration of `loadGameState` away from new-game saves (it would delete worn Traveler Boots); F0 checks the fishing respawns against T1's range instead of pinning values T1 may tune; N1 compares serialised states without `savedAt`; M1 calls `pickSlayerBand`; G-6 reloads after wearing the boots.

---

## 0. Conventions

These are the Stage 1-2 plan's conventions, restated so this plan can be read alone. Where a rule is new for Stage 3 it says so.

### 0.1 Task tags and tiers

- **[AGY]**: the task is specified fully enough to hand to the agy backend through `/agy-implement` (one worktree) or `/agy-parallel` (several lanes). It always runs in three stages: a **haiku** stage runs the `agy -p` command and returns the diff stat, test output and exit status; a **sonnet** stage implements the task only if agy failed or refused, and records that it did; an **opus** stage (a [CLAUDE] verify) checks the diff against the task's allowlist, runs the acceptance check, and looks for weakened or deleted assertions and for edits to [CLAUDE] tests. On an [AGY] task, "Tier" names the tier that does the work if agy fails. The verify stage is always opus and is part of the task.
- **[CLAUDE]**: tests that define acceptance, the pacing model, tuning against a test, governance text, and every verification. Tests that define acceptance for an [AGY] task are their own [CLAUDE] task and come first.
- **[OWNER]** and **[HUMAN]**: a decision only the owner can make, or something a person has to look at in the running game. These are not agent tasks.
- Agents never merge, tag, push or open pull requests. The main session merges lane branches after verification. No commit carries an AI attribution trailer (owner's global rule).
- Tiers used in this plan: haiku for running agy; sonnet for tests written from a stated spec, for fully specified implementation, for the rebase and for doc sync; opus for the pacing model (M1), the tuning (T1) and every verify. No task needs a higher tier: the design is done and each task is bounded.

### 0.2 Commands

Run every command from the worktree root, in a shell started with an allowlisted environment, so that no token reaches a test process: `env -i HOME="$HOME" PATH="$PATH" XDG_RUNTIME_DIR="$XDG_RUNTIME_DIR" DBUS_SESSION_BUS_ADDRESS="$DBUS_SESSION_BUS_ADDRESS" bash`.

| Name | Command | Expected |
|---|---|---|
| SUITE | `systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 env TEST_CONCURRENCY=4 npx vitest run` | exit 0; every test passes, including every test that exists when P0 records the baseline |
| ONE(file) | `systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 env TEST_CONCURRENCY=4 npx vitest run <file>` | as stated in the task |
| TYPES | `systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 env TEST_CONCURRENCY=4 npx tsc --noEmit` | exit 0, no output |
| BUILD | `systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 env TEST_CONCURRENCY=4 npm run build` | exit 0; the JS chunk size is reported |

**Standard gate (SG)**: SUITE, TYPES and BUILD all pass. Every task below ends with SG unless it says otherwise. A wrapper OOM kill means a defect to fix. Never raise the cap.

### 0.3 Rules that apply to every task

1. **Allowlist.** A task touches only the files listed for it. The opus verify rejects a diff with any other file in it.
2. **Line numbers go stale.** Stage 2 lands first and moves lines in `actions.ts`, `combat.ts`, `monsterAi.ts`, `session.ts` and `loop.ts`. Every task names the symbols it changes, so find them by name. The `a8cad85` line numbers are only a hint.
3. **Existing tests are frozen.** No edit to any file that exists under `tests/` or `src/__tests__/` when P0 records the baseline. That includes the 103 original tests, every Stage 1 test and every Stage 2 test. A new test goes in a new file under `tests/`. Stage 3 declares **one** planned replacement, authorised by the owner on 2026-11-14: in `tests/phase3-content.test.ts`, case `tracks the earliest open step, then a claim prompt, then the next quest`, the assertion on line 41, `expect(adventureTracker(state).title).toBe('Varrock Arcane Trial');`, becomes `expect(adventureTracker(state).title).toBe("Cook's Errand");`. Task K1 makes that edit and no other. Design 9.3 explains, test by test, why no other is needed. If any other existing test goes red, the change is wrong, not the test; stop and report to the main session.
4. **Test-first pairs.** A [CLAUDE] test task may leave the suite red until the [AGY] task that implements it lands on the same branch. Because `tsconfig.json` includes `tests/` and `npm run build` runs `tsc --noEmit`, a test file that imports a module or export the paired task has not written yet also makes TYPES and BUILD red. Allowed in that window: SUITE failures only in the new test files, and TYPES/BUILD errors only in the new test files and only because a module, export or field that the paired task adds does not exist yet. The opus verify of the test task lists them; any other error is a defect. One existing test file may also be red in such a window: `tests/phase3-content.test.ts`, between K1 and K2, in the one assertion K1 is authorised to replace (rule 3). The paired task's accept restores full SG. A branch reaches the main session only when it is green, with one declared exception: the pacing and invariant tests of M1 stay red from M1 until T1 (section 3.3). In that span "SG" means TYPES and BUILD pass and SUITE is red only in those two files.
5. **Commit kinds, never mixed.** *Move*: arithmetic leaves `actions.ts` for a pure module, unchanged (lane E). *Test*. *Data*: numbers in a table. *Rule*: new behaviour. *Docs*. A Move commit changes no number and no order of random draws; the opus verify checks it with `git diff --color-moved=dimmed-zebra -w HEAD~1` as review evidence.
6. **No new content beyond the owner's additions** (design C3, G3.9). The additions are: the item `hazel_staff` (I2) and the table `STARTER_QUESTS` with its seven entries (K2). No other new item, monster, node, recipe id, quest, prayer, spell, character or name. `tests/content-freeze.test.ts` (P1) and `tests/starter-quests.test.ts` (K1) enforce it. Every new name is given verbatim in the design; a task that seems to need another name stops and reports.
7. **No new runtime dependency.** No change to `package.json` or `package-lock.json`.
8. **No formula edits.** The XP table, XP per action, the hit and damage formulas, the gather success formula, the `price` and `req` of existing items, coin drops and the rewards of the ten existing quests do not change (design 3, anti-goals). Two rule changes are named exceptions and belong to one task each: fishing spots deplete on every catch (D4), and five Slayer bounties change (D3). A task that seems to need any other stops and reports.
9. Every commit message names its kind and task, and the audit finding where there is one: `move(E2): playerAttackProfile to state/combat`, `data(D3): gear drop rates`, `data(#9, D6): smithing takes bars`.
10. **No test asserts a time** (owner, 2026-11-14). No `expect` in any Stage 3 test reads minutes, seconds or hours of play. The pacing model returns its average times in a separate object, `averageSeconds`, which a test may print and may not assert on. The fishing bound of M1 compares two hourly rates computed by the same formula; it is a ratio and names no clock value. Game data that happens to be a duration (a respawn in milliseconds, `ATTACK_INTERVAL`) is not a time of play and may be checked, but only against a range, never pinned where T1 may tune it (F0). G-5 step 11 checks this rule by grep.
11. **No new saved field.** `QuestFlags`, `GameState`, `serializeState` and `normalizeQuests` gain nothing. The starter quests read flags and values that exist today.

### 0.4 Branches, worktrees, lanes

- Stage 3 works on `feat/start-pacing`. Today that branch holds only the two documents. Task P0 rebases it onto `main` after the Stage 2 merge.
- The spine (P, E, D, M, C, R, T) runs on `feat/start-pacing` itself, one task after another: these tasks share `src/engine/actions.ts`, `src/data/catalog.ts` and `src/state/inventory.ts`.
- Two lanes share no file with the spine while they run, and none with each other. They may run in parallel worktrees, `../osrs-like-wp/sp-N` on branch `sp/N` and `../osrs-like-wp/sp-U` on `sp/U`. `sp/N` is cut from the spine head after K2 (N2 imports `STARTER_ARRIVAL`, which K2 adds). `sp/U` is cut after D2 (U2 needs `shopPrice`). They are local branches only and are never pushed. Lane N edits `src/state/cheats.ts`, which the spine also edits in C2; lane N is merged long before C2 starts, so the two never run at once.
- Run at most 3 agents at a time on this machine, with one BUILD at a time.

| Lane | Tasks | Files |
|---|---|---|
| Spine | P0, P1, E1-E3, D1-D2, I1-I2, K1-K2, M1, D3, F0, D4, F1, D5-D6, C1-C2, R1, T1 | `src/state/combat.ts`, `src/state/economy.ts` (new), `src/state/monsterAi.ts`, `src/state/inventory.ts`, `src/state/adventure.ts`, `src/state/quests.ts`, `src/state/cheats.ts` (C2 only), `src/state/save.ts`, `src/engine/actions.ts`, `src/engine/loop.ts`, `src/engine/audio.ts`, `src/engine/spawns.ts`, `src/data/items.ts`, `src/data/catalog.ts`, `src/data/world.ts`, `src/data/recipes.ts`, `src/ui/stations.ts`, `README.md`, new tests, and the one declared line of `tests/phase3-content.test.ts` |
| N (new game, hidden tools) | N1, N2, N3, N4 | `src/state/gameState.ts`, `src/state/cheats.ts`, `src/engine/session.ts`, `src/engine/runtime.ts`, `index.html`, `tests/new-game.test.ts`, `tests/hidden-tools.test.ts` |
| U (unlocks) | U1, U2 | `src/state/unlocks.ts` (new), `src/ui/playerActions.ts`, `tests/unlocks.test.ts` |

Order on `feat/start-pacing`: P0, P1, E1-E3, D1-D2, I1-I2, K1-K2, then lane N runs and is merged, then M1, D3, F0, D4, F1, D5-D6, then merge `sp/U`, then C1-C2, R1, T1. Lane N is merged before M1 because the pacing test starts from `createNewGameState()`. The staff and the starter quests come before M1 because the model plays the chain. With them and D2 in place, M1's files type-check from the start.

Files that Stage 2 also edits (design 7.6): `src/engine/actions.ts`, `src/state/combat.ts`, `src/state/monsterAi.ts`, `src/engine/session.ts`, `src/engine/loop.ts`, `README.md`. That is why nothing starts before the Stage 2 merge.

### 0.5 Owner and human steps (where they block)

| Step | What the owner decides or does | Blocks |
|---|---|---|
| O-12 | Stage 2 accepted and merged to `main` (Stage 1-2 plan). | Everything |
| O-13 | Approve Stage 3: the CALLs still marked "Proposal" in design section 12, the two new questions Q3.10 and Q3.11, and the list of new names (design C4). The questions of design 15.1 are already decided. | Everything |
| O-13b | Only if M1's dry run fails an assertion of design 5.3: choose a different markup or a different threshold (Q3.10). | D3 and everything after |
| G-6 | [HUMAN] play and look (design 9.2). | O-14 |
| O-14 | Accept Stage 3. | The pull request |

Decided on 2026-11-14, and built into the tasks as written (design 15.1): task milestones without minutes (M1, T1, G-6); fishing empties on every catch (F0, D4, F1); the tenfold shop price and the bounties cut to a third, with the forge recipe in the unlock line (D2, D3, U1, U2); the tracker order and its one test replacement (K1, K2); the starter quests (K1, K2, N1, N2); the hidden booster and cheats (N3, N4); the Hazel Staff (I1, I2); no stack cap in play (C1, C2).

If the owner answers one of the remaining points with the alternative, only the named task changes:

| Answer | Change |
|---|---|
| Q3.10: no number in the task assertions | M1: assertion 3 becomes "at least one further kill" on both routes, and assertion 4 (tiers behind) is removed. The control still fails assertion 3. T1's "Must not change" follows. |
| Q3.10: other numbers | M1 uses them. The dry run decides whether they hold. |
| Q3.11: a 10x save is told nothing | N4 drops the one chat line in `boot()`. N3 drops its case for it. |
| CALL-3.20 overruled: existing saves see the starter chain too | Return to the design. It needs a rule for rewards a geared character already owns and it makes the first assertions of the `phase3-content` tracker case false, which is a second test replacement. |
| CALL-3.5 at another markup | D1 and D2 use that value (at 8: `rune_plate` 41600, `bronze_scimitar` 360, `hazel_staff` 480). T1 still checks the assertions. |
| CALL-3.6, 3.8 or 3.14 refused | Return to the design: the milestones of design section 5 were measured with all three. |
| The owner wants other names for the quests or the staff | K2 and I2 use them; K1, I1 and P1 pin them. No other task changes. |

---

# Stage 3: Start and pacing

## 3.0 Prerequisites

### O-13 Approve Stage 3 [OWNER]
The owner approves or amends what is still open: the CALLs marked "Proposal" in design section 12, Q3.10, Q3.11, and the new names. An amendment changes only what the table in 0.5 names.

### P0 Rebase on the merged Stage 2 and record the baseline [CLAUDE]
- **Tier**: sonnet (a rebase of a docs-only branch and a recorded command run; mechanical).
- **Depends**: O-12, O-13.
- **Files**: `docs/superpowers/baseline/2026-11-14-stage3-baseline.md` (new).
- **Change**: rebase `feat/start-pacing` onto `main`. Run SG. Record in the baseline file: the number of test files and tests, the JS chunk size, and, read from `src/data/worldMap.ts`: every camp's id, `aggressive` flag and member count by monster type; the number of nodes of each type in `NODE_PLACEMENTS`; and the current line of each symbol the design cites in `actions.ts`, `combat.ts`, `monsterAi.ts`, `session.ts` and `loop.ts` (`performPlayerAttack`, `handleMonsterDeath`, `performMonsterRetaliation`, `performResourceGather`, `rollMonsterHit`, `ATTACK_INTERVAL`, `DYING_SECS`, `DEAD_SECS`, `loadGameState`, the regeneration line). Next to the camp table, write the attackers the design's model assumed (design 4.2: scorpion 3, wizard 3, ranger 2, giant 4, guardian 2, demon 2) and mark every difference.
- **Accept**: SG passes. The baseline file holds every item above. `git diff main --stat` shows only files under `docs/`.
- **Must not change**: anything under `src/`, `tests/`, `index.html` or `package*.json`.

### P1 Freeze fixtures [CLAUDE]
- **Tier**: sonnet (tests written from design section 8 and G3.9).
- **Depends**: P0.
- **Files** (all new): `tests/save-compat-s3.test.ts`, `tests/content-freeze.test.ts`, `tests/fixtures/s3/default-state.golden.json`, `tests/fixtures/s3/save-v4-loaded.golden.json`, `tests/fixtures/s3/save-v4-geared.json`, `tests/fixtures/s3/save-v4-no-multiplier.json`, `tests/fixtures/s3/save-legacy-bare.json`, `tests/fixtures/s3/content-ids.golden.json`.
- **Change**:
  - `save-compat-s3.test.ts`. A helper `stable(json)` parses a `serializeState` string and deletes `savedAt`. With `UPDATE_GOLDEN=1` the two golden tests write their file instead of comparing (the pattern of `tests/terrain-golden.test.ts`). Generate both goldens once, now, before any Stage 3 change to `src/`.
    - `the default state serialises to its golden`: `stable(serializeState(createDefaultState(), null, null))` equals `default-state.golden.json`.
    - `the Stage 1 version-4 fixture loads to its golden`: `migrateLegacySave(JSON.parse(save-v4.json), SAVE_KEY)`, serialised with its own pose and camera, equals `save-v4-loaded.golden.json`.
    - `a geared version-4 save keeps every piece, its gold and its rate`: `save-v4-geared.json` is hand-written, `version: 4`, wearing `rune_scimitar`, `rune_plate`, `rune_legs`, `rune_helm`; backpack with `dragon_chain`, `dragon_legs` and 40 `shark`; bank with `dragon_scimitar` x2 and 300 `runite_bar`; `gp` 500000; `xpMultiplier` 10; Attack, Strength and Defence XP 37224; position (8, 10). Assert each of those values after `migrateLegacySave`.
    - `a version-4 save without xpMultiplier loads at 10`: the same file without the field.
    - `a bare legacy save gets today's default kit`: `{ "gp": 77 }` read through `readSave` with an in-memory `StorageLike` under `runewilds_save_v3`; assert `gp` 77, `equipment.weapon` `bronze_scimitar`, and the inventory ids and quantities equal those of `createDefaultState()`.
    - `serializeState writes version 4 and the same keys as the default golden`.
  - `content-freeze.test.ts`: `content-ids.golden.json` holds, captured now, the sorted ids and the `name` of every entry of `ITEMS`, `MONSTER_TYPES`, `RESOURCE_NODES_DEF`, `FORGE_RECIPES` (from `src/data/recipes.ts`), `QUEST_DEFS`, `PRAYERS` and `SPELLS`. Tests: `no id was added or removed` and `no name changed`, one per table. Same `UPDATE_GOLDEN=1` pattern. One declared addition, written as a constant in the test with a comment naming the owner's decision of 2026-11-14: `DECLARED_NEW_ITEMS = ['hazel_staff']`. The `ITEMS` case compares the live ids **minus the declared ones** with the golden, so it passes before and after I2; no other table has a declared addition. (`STARTER_QUESTS` does not exist yet; K1 pins it.)
- **Accept**: `ONE(tests/save-compat-s3.test.ts)` and `ONE(tests/content-freeze.test.ts)` pass, then SG.
- **Must not change**: `src/`. After this task the two goldens are never regenerated; a later task that needs `UPDATE_GOLDEN=1` on them is wrong.

---

## 3.1 Lane E: move the arithmetic out of the engine (spine, serial)

E tasks change no behaviour. They exist so that the pacing model can call the game's own formulas (design 6.4, G3.8).

### E1 Value tests for the moved functions [CLAUDE]
- **Tier**: sonnet (tests written from the cited expressions).
- **Depends**: P1.
- **Files** (new): `tests/combat-profile.test.ts`, `tests/economy-rolls.test.ts`.
- **Change**: each expected value is written out from today's expression in the test, with the source line as a comment, not taken from the new function.
  - `combat-profile.test.ts`, against `src/state/combat.ts`:
    - `playerAttackProfile(state): { maxHit: number; accuracy: number }` is the value of `maxHit` and `accuracyScore` in `performPlayerAttack` just before the special-attack block (`actions.ts` 95-115), with style, prayer and Dharok multipliers applied. Cases: the default state on accurate (max hit 3, accuracy 25.75), aggressive (3, 20.35), controlled (3, 23.05) and defensive; the same with `burst_str` and with `piety`; `shortbow` on rapid (5, 29.4) and with `sharp_eye`; `fire_staff` on magic with `wind_strike` (10, 41.5), with `fire_bolt`, and with `mystic_might`; Strength 40 with `rune_scimitar`, `rune_plate`, `rune_legs`; the full Dharok set at half health; bare hands (`weapon: null`).
    - `playerHitChance(accuracy, monsterDef)` equals `min(0.94, max(0.22, accuracy / (accuracy + (def * 1.1 + 4) * 0.75)))` (`actions.ts` 173-174): one case per monster type, plus one that hits each clamp.
    - `monsterHitChance(typeKey, state)` equals the `hitChance` of `rollMonsterHit` (Stage 2, `combat.ts`; today `actions.ts` 298-303): default state against a goblin and a lesser demon; with `thick_skin`; with `piety`; on the defensive style; clamps at 0.82 and 0.12.
    - `rollMonsterHit consumes the same random numbers as before`: with a recorded `rand` sequence, the result equals the values Stage 2's `tests/monster-hit.test.ts` already expects (do not edit that file; add cases here).
  - `economy-rolls.test.ts`, against `src/state/economy.ts`:
    - `rollDrops(typeKey, rand): DropResult[]`, where `DropResult` is `{ kind: 'gp'; amount: number } | { kind: 'item'; id: string; qty: number }`, in table order. Rule (`actions.ts` 272-288): for each entry one draw, kept when `draw <= chance`; a kept coin entry makes a second draw at once, `amount = lo + floor(draw * (hi - lo + 1))`; a kept item entry has `qty` from the entry or 1. Tests with a scripted `rand` (an array handed out in order, throwing when it runs dry): `a goblin with every roll at 0 drops bones, 12 GP, both iron pieces and shrimp, in table order`; `every roll at 0.999 drops only the chance-1 entries`; `the coin draw follows its chance draw immediately`; `the number of draws is entries + kept coin entries`.
    - `gatherChance(level, req)` equals `min(0.92, 0.50 + (level - req) * 0.02)` (`actions.ts` 425): at the requirement, 10 above, 21 above (the cap), 40 above.
    - `HP_REGEN_PER_SEC` is `0.25`.
- **Accept**: red until E2 and E3 (missing exports only).
- **Must not change**: `src/`, any existing test.

### E2 Hit arithmetic to `src/state/combat.ts` [AGY]
- **Tier**: sonnet (a move of pure arithmetic).
- **Depends**: E1.
- **Files**: `src/state/combat.ts`, `src/engine/actions.ts`.
- **Change**: Move commit. Add `playerAttackProfile`, `playerHitChance` and `monsterHitChance` to `combat.ts` with the expressions moved verbatim. `performPlayerAttack` calls the first two and keeps everything from the special-attack block on (it still multiplies `maxHit` and `accuracyScore` by the special's factors, then calls `playerHitChance`). `rollMonsterHit` calls `monsterHitChance` in place of its inline expression. `combat.ts` imports `dharokMultiplier` from `./adventure` (it already imports `resolveDragonfire` from there after Stage 2).
- **Accept**: `ONE(tests/combat-profile.test.ts)` passes. Stage 2's `ONE(tests/monster-hit.test.ts)` passes unchanged. SG.
- **Must not change**: any constant, any clamp, the order of `Math.random()` calls in `performPlayerAttack`, the special-attack block, XP grants.

### E3 Drop roll, gather chance and regeneration constant to `src/state/economy.ts` [AGY]
- **Tier**: sonnet (a move of pure arithmetic).
- **Depends**: E2.
- **Files**: `src/state/economy.ts` (new), `src/engine/actions.ts`, `src/engine/loop.ts`, `src/state/monsterAi.ts`.
- **Change**: Move commit.
  - `economy.ts` imports only from `src/data` and types. It exports `rollDrops` and `gatherChance` as E1 states, and `HP_REGEN_PER_SEC = 0.25`.
  - `handleMonsterDeath` calls `rollDrops(monster.typeKey, Math.random)` and applies each result in order with today's side effects (coin credit, sound, chat line, rare-loot beam test, `addItem`, the "left behind" line).
  - `performResourceGather` uses `gatherChance(skillLvl, def.req)`. The fishing depletion line (`def.kind !== 'fish' || Math.random() < 0.35`) stays exactly as it is in this task; D4 changes it.
  - `updateVitalsAndRegen` in `loop.ts` uses `HP_REGEN_PER_SEC` in place of the literal `0.25`.
  - `monsterAi.ts`: add `export` to `ATTACK_INTERVAL`, `DYING_SECS` and `DEAD_SECS`. Nothing else.
- **Accept**: `ONE(tests/economy-rolls.test.ts)` passes. `ONE(tests/architecture.test.ts)` passes (layering). SG. `grep -n "d.chance\|0.50 + \|accuracyScore / " src/engine/actions.ts` prints nothing.
- **Must not change**: drop tables, the order of chat lines, any behaviour.

---

## 3.2 Lane N: the new game and the hidden tools (parallel worktree `sp/N`, cut after K2)

### N1 New-game tests [CLAUDE]
- **Tier**: sonnet (written from design 7.1 item 1 and G3.1).
- **Depends**: K2.
- **Files**: `tests/new-game.test.ts` (new).
- **Change**: tests against `createNewGameState()` from `src/state/gameState.ts`:
  - `a new game holds nothing`: all ten `equipment` slots are `null`, `inventory` is `[]`, `bank` is `[]`, `gp` is 0.
  - `a new game runs at 1x`: `xpMultiplier` is 1.
  - `a new game has claimed arrival and nothing else`: `quests.claimed` deep-equals `[STARTER_ARRIVAL]`; every boolean flag of `quests` is `false`; `quests.slayer` is `null`.
  - `the first starter quest is open`: `starterView(state)` has one entry, `sq_ledger`, unclaimed; `adventureTracker(state).title` is `A Name in the Ledger`.
  - `everything else is the default`: with `gp`, `xpMultiplier`, `equipment`, `inventory` and `quests.claimed` copied over from the default state, `stable(serializeState(newGame, null, null))` equals `stable(serializeState(createDefaultState(), null, null))` (the P1 helper that drops `savedAt`, which differs between two calls).
  - `it returns a fresh object each call` (mutating one does not change the next).
  - `a new game survives writeSave then readSave` with an in-memory `StorageLike`: empty kit, `gp` 0, `xpMultiplier` 1, `claimed` `['arrival']`.
  - `a bare-handed hero can fight`: `canUseStyle('accurate', null, state)` is ok.
  - `the default state is still its golden` (imports the P1 golden; a second guard in the file that the implementer will have open).
- **Accept**: red until N2.
- **Must not change**: `src/`.

### N2 New-game state and wiring [AGY]
- **Tier**: sonnet (fully specified).
- **Depends**: N1.
- **Files**: `src/state/gameState.ts`, `src/engine/session.ts`, `src/engine/runtime.ts`, `index.html`.
- **Change**: Rule commit.
  - `gameState.ts`: add `export function createNewGameState(): GameState`. It calls `createDefaultState()`, then sets `gp = 0`, `xpMultiplier = 1`, every `equipment` slot to `null`, `inventory = []` and `quests.claimed = [STARTER_ARRIVAL]` (imported from `./quests`).
  - `session.ts`: add `export function startNewGame(): void { applyState(STATE, createNewGameState()); }`.
  - `session.ts`, reset guard (design F16): add `let resetting = false;` at module level. In `resetGameSave`, after the `confirm` succeeds, set `resetting = true` before removing the keys. At the top of `saveGameState`, `if (resetting) return;`. Nothing else in either function changes.
  - `session.ts`, outfit migration (design 7.1 item 1, second pass): in `loadGameState`, inside the `if (!localStorage.getItem(OVERHAUL_FLAG))` block, keep the `setItem` line and wrap the six `STATE.equipment.* = null` lines and the `if (camState) { … }` block in `if (!STATE.quests.claimed.includes(STARTER_ARRIVAL)) { … }` (import `STARTER_ARRIVAL` from `../state/quests`). Without it a new game played in one sitting loses its worn Traveler Boots (`leather_boots`) on the first reload.
  - `runtime.ts`, in `boot()`: directly after `const hadSave = loadGameState();`, add `if (!hadSave) startNewGame();`. In the `else` branch of the `hadSave` chat block, after the existing movement line, add: `addChatMessage('You arrive with nothing. The tracker under your health shows your first task: speak with the <b>task master</b> in the courtyard.', 'skill');`
  - `index.html`, the `onboard-list`: add two items after the existing four: `<li>You start with <b>nothing</b>. Everything you wear is earned.</li>` and `<li>First steps: follow the <b>tracker</b>. Six short tasks in the haven pay your first kit.</li>`
- **Accept**: `ONE(tests/new-game.test.ts)` passes. `ONE(tests/save-compat-s3.test.ts)` passes with both goldens untouched. `ONE(tests/globals.test.ts)` passes. SG. `git diff` of `gameState.ts` shows only added lines after `createDefaultState` and one import.
- **Must not change**: `createDefaultState`, `STATE`'s initialiser, `loadGameState` other than the one wrapping condition above (the `OVERHAUL_FLAG` key is still set, and a state without `arrival` is migrated exactly as today), the order of calls in `boot()` other than the one inserted line, any `onclick` in `index.html`. The reset guard and the outfit condition have no headless test, because `session.ts` needs the DOM (design C7). The opus verify reads the diff, and G-6 checks both in the browser.

### N3 Hidden-tools tests [CLAUDE]
- **Tier**: sonnet (written from design 7.1 item 10 and G3.11).
- **Depends**: N2.
- **Files**: `tests/hidden-tools.test.ts` (new).
- **Change**: the page and the boot code are read as text, as `tests/globals.test.ts` does.
  - `the reveal word is matched on its own function`: `matchToolsCode('backroom')`, `('::backroom')` and `('wasdbackroom')` are `true`; `('backroo')`, `('hello')` and `('')` are `false`.
  - `the cheat matcher is untouched`: `matchCheat('backroom')` is `null`; `matchCheat('skills10')` is `'skills'`; `matchCheat('gold200k')` is `'gold'`.
  - `the tools block is hidden in the page`: `index.html` contains exactly one element with `id="hidden-tools"`, and its opening tag carries the `hidden` attribute.
  - `the 10x button and the cheat panel are inside the block`: in the text between that opening tag and the end of the Settings modal are `id="xp-rate-btn"`, `id="cheat-code-input"`, `cheatSkillsPlus10()` and `cheatGold200k()`.
  - `nothing outside the block names them`: the text of `index.html` before that opening tag contains none of `xp-rate-btn`, `cheat`, `skills10`, `gold200k`, `10x`, `League XP`.
  - `the boot code does not advertise`: `src/engine/runtime.ts` contains neither `skills10` nor `gold200k`; `src/engine/session.ts` does not contain the text `Try <b>skills10` (the reply to a wrong code is `Unknown code.`).
  - `a save at 10x is told once` (drop this case if Q3.11 is answered "nothing"): `src/engine/runtime.ts` contains the text `This character earns experience at`.
- **Accept**: red until N4.
- **Must not change**: `src/`, `index.html`.

### N4 Hide the booster and the cheats [AGY]
- **Tier**: sonnet (fully specified).
- **Depends**: N3.
- **Files**: `index.html`, `src/state/cheats.ts`, `src/engine/session.ts`, `src/engine/runtime.ts`.
- **Change**: Rule commit.
  - `index.html`, Settings modal: take the `xp-rate-btn` button out of `settings-grid`. After `settings-grid`, add `<div id="hidden-tools" hidden>` holding that button followed by the existing `cheat-panel`, unchanged inside. Every id and every `onclick` stays. Nothing is deleted from the page: `el()` throws on a missing id and four functions fetch these elements.
  - `cheats.ts`: add `export const TOOLS_CODE = 'backroom';` with the comment `// Typed during play: shows the 10x button and the cheat panel in Settings until reload. Not shown anywhere in the game.` and `export function matchToolsCode(raw: string): boolean { return normalizeCheatText(raw).endsWith(TOOLS_CODE); }`. `matchCheat`, `SKILL_CHEAT_CODES` and `GOLD_CHEAT_CODES` are not edited. Keep the comment as written: `tests/architecture.test.ts` forbids the words `document` and `window` anywhere in a state file.
  - `session.ts`: in `noteCheatKey`, after the buffer is updated and before `matchCheat`: `if (matchToolsCode(cheatBuffer)) { cheatBuffer = ''; el('hidden-tools').hidden = false; addChatMessage('Hidden tools are shown in Settings until you reload.', 'skill'); return; }`. In `applyTypedCheat`, the last branch prints `'Unknown code.'`.
  - `runtime.ts`, `boot()`: delete the `addChatMessage('Cheat codes: …')` line. Inside the `if (hadSave)` branch add `if (STATE.xpMultiplier !== 1) addChatMessage('This character earns experience at <b>10x</b>.', 'skill');` (Q3.11). The `cheat-code-input` listener stays.
- **Accept**: `ONE(tests/hidden-tools.test.ts)`, `ONE(tests/cheats.test.ts)` and `ONE(tests/globals.test.ts)` pass. SG.
- **Must not change**: `toggleXpMultiplier`, `applyLoadedStateToHud`, `syncSettingsButtons`, `cheatSkillsPlus10`, `cheatGold200k`, the direct typed codes, `WINDOW_GLOBALS`, any saved field, `localStorage` keys. The reveal has no headless test (design C7); the opus verify reads the diff and G-6 checks it in the browser.

---

## 3.3 Lane D and the model: prices, the pacing model, drops, fishing, recipes (spine, serial)

### D1 Shop price tests [CLAUDE]
- **Tier**: sonnet (written from design 7.1 item 2).
- **Depends**: E3.
- **Files** (new): `tests/shop-price.test.ts`.
- **Change**:
  - `shop-price.test.ts`: `shopPrice(rune_plate) is 52000`; `shopPrice(bronze_scimitar) is 450`; `shopPrice(air_rune) is 6`, `(bronze_arrow) is 8`, `(shark) is 280`, `(prayer_potion) is 240`; `buyItem charges shopPrice for equipment`: 52,000 GP buys one `rune_plate` and leaves 0, 51,999 is refused with the price in the reason; `result.unit` and `result.gp` report the charged amount; `unitSellPrice(rune_plate) is still 3380`.
- **Accept**: red until D2.
- **Must not change**: `src/`.

### D2 Shop price for equipment [AGY]
- **Tier**: sonnet (one function and its call sites).
- **Depends**: D1.
- **Files**: `src/data/items.ts`, `src/state/inventory.ts`, `src/ui/stations.ts`.
- **Change**: Rule commit.
  - `items.ts`: `export const GEAR_MARKUP = 10;` and `export function shopPrice(item: ItemDef | null | undefined): number`, returning 0 for no item, `(item.price || 0) * GEAR_MARKUP` when `item.type === 'equip'`, otherwise `item.price || 0`.
  - `inventory.ts`, `buyItem`: `const price = shopPrice(item);`. Nothing else in the function changes. `runePackCost` and `buyRunePack` are not touched.
  - `stations.ts`: `affordableBuyQty`, `shopBuyLabel`, the batch-button cost and the card description use `shopPrice(it)` in place of `it.price`. The tooltip line that reads `Value ${it.price} GP · sell ...` becomes `Shop ${shopPrice(it)} GP · sell ${unitSellPrice(it)} GP`.
- **Accept**: `ONE(tests/shop-price.test.ts)` passes. `ONE(src/__tests__/bulk-buy.test.ts)`, `ONE(src/__tests__/bulk-sell.test.ts)` and `ONE(tests/shop-gathered.test.ts)` pass unchanged. SG.
- **Must not change**: any `price`, `SELL_RATIO`, `unitSellPrice`, the chat line in `playerActions.ts` that says "Value".

---

## 3.3a The owner's additions: the entry staff and the starter chain (spine, serial)

Both come before M1, because the pacing model plays the chain and the chain pays the staff.

### I1 Entry-staff tests [CLAUDE]
- **Tier**: sonnet (written from design 7.1 item 11 and G3.12).
- **Depends**: D2 (`shopPrice`), E2 (`playerAttackProfile`).
- **Files**: `tests/entry-staff.test.ts` (new).
- **Change**:
  - `the Hazel Staff is the row the design gives`: `ITEMS.hazel_staff` deep-equals `{ id: 'hazel_staff', name: 'Hazel Staff', type: 'equip', slot: 'weapon', iconKind: 'staff', style: 'magic', tier: 'bronze', mag: 4, atk: 2, str: 1, req: { magic: 1 }, price: 60, color: 0x7c8a4a, trim: 0x8d6b3a }`.
  - `it is a magic weapon`: `itemCombatClass` is `'magic'`; `allowedStyles` is `['magic']`.
  - `it uses the existing staff model`: `gearSilhouette(ITEMS.hazel_staff)` is `'staff'`, the same value as for `fire_staff` (import from `src/engine/playerGear`, as `src/__tests__/combat-class.test.ts` does).
  - `it casts Wind Strike when the runes are there`: on the default state with `equipment.weapon = 'hazel_staff'` and `activeSpell = 'wind_strike'`, `canUseStyle('magic', ITEMS.hazel_staff, state)` is ok; with `inventory = []` it is refused and the reason names Air Rune and Mind Rune.
  - `Wind Strike with it hits for 6 at Magic 1`: `playerAttackProfile` on that state with the magic style returns max hit 6 and accuracy 21.5.
  - `it costs 600 GP in the shop and sells for 39`.
  - `no recipe makes it`: no entry of `FORGE_RECIPES` has `output: 'hazel_staff'`.
- **Accept**: red until I2 (the item does not exist).
- **Must not change**: `src/`.

### I2 The Hazel Staff [AGY]
- **Tier**: sonnet (one data row).
- **Depends**: I1.
- **Files**: `src/data/catalog.ts`.
- **Change**: Data commit, message `data(I2): Hazel Staff, entry-level staff`. In `ITEMS`, directly before the `fire_staff` row, add the row of I1's first test, formatted like its neighbours. Nothing else: the shop lists every item, the icon comes from `iconKind`, and the model in the hand is the existing `Gear_staff` node recoloured from `color` and `trim` (design 7.1 item 11). **No Blender work and no change to `public/models`.**
- **Accept**: `ONE(tests/entry-staff.test.ts)` passes. `ONE(tests/content-freeze.test.ts)` passes (the id is its one declared addition). `ONE(src/__tests__/combat-class.test.ts)`, `ONE(tests/textures.test.ts)` and `ONE(tests/shop-price.test.ts)` pass unchanged. SG.
- **Must not change**: any other row, `playerGear.ts`, `blenderGear.ts`, `icons.ts`, any file under `public/` or `blender/`.

### K1 Starter-chain and tracker tests [CLAUDE]
- **Tier**: sonnet (written from design 7.1 items 9 and 12, section 8 and G3.10).
- **Depends**: I2.
- **Files**: `tests/starter-quests.test.ts` (new), `tests/tracker-order.test.ts` (new), and **the one declared edit** to `tests/phase3-content.test.ts` (rule 0.3.3).
- **Change**: a local helper `newGame()` builds the new-game state by hand (the default state with `gp = 0`, `inventory = []`, every equipment slot `null`, `quests.claimed = [STARTER_ARRIVAL]`), because `createNewGameState` arrives later in lane N.
  - `starter-quests.test.ts`, against `STARTER_QUESTS`, `starterView` and `claimQuest` from `src/state/adventure.ts`:
    - `the starter table is exactly these seven entries`: ids `arrival`, `sq_ledger`, `sq_quarrel`, `sq_gather`, `sq_forge`, `sq_keeping`, `sq_coin` in that order; names `Arrival`, `A Name in the Ledger`, `First Quarrel`, `Stone, Timber, Tide`, `Fire and Hammer`, `Left in Keeping`, `Fair Coin`; every `region` is `lumbridge`; every `xp` is `{}`; `gp` is 25 for `sq_quarrel` and 0 for the rest; `items` as K2's table.
    - `QUEST_DEFS still has its ten ids and questView its ten cards`.
    - `each step reads what the game already records`: one case per step of design 7.1 item 9. On `newGame()` the step is unmet; after the one change the design names (for example `quests.caughtFish = true`, `skills.mining.xp = 28`, `equipment.body = 'bronze_plate'`, `assignSlayerTask(state, 3)`) it is met.
    - `the chain opens one quest at a time`: on `newGame()`, `starterView` returns one card, `sq_ledger`. With the step of `sq_quarrel` met but `sq_ledger` unclaimed, `claimQuest(state, 'sq_quarrel')` is refused with `That quest is not open yet.` and changes nothing. After each claim the next card appears and the claimed ones stay, marked claimed.
    - `each quest pays its reward once`: for each of the six, with its steps met and its predecessors claimed: the claim succeeds, the backpack and `gp` grow by exactly the reward of K2's table, a second claim is refused, and no skill experience changes.
    - `arrival can never be claimed`: refused on `newGame()` and on the default state.
    - `a state that never claimed arrival has no starter quest`: for the default state, for `tests/fixtures/save-v4.json` through `migrateLegacySave`, and for `tests/fixtures/s3/save-v4-geared.json`: `starterView` is `[]`; `claimQuest` on each of the seven ids is refused; the serialised state is unchanged afterwards.
    - `the reward that needs room is refused when the backpack is full and nothing is claimed` (28 filled slots, `sq_keeping`).
    - `coin is paid before it is needed`: the quest that pays coin (`sq_quarrel`) comes before the quest with the purchase step (`sq_coin`), and 25 GP is at least the price of the cheapest item the store sells.
    - `a half-finished chain survives a save`: `claimed = ['arrival', 'sq_ledger', 'sq_quarrel']` through `writeSave` then `readSave` with an in-memory `StorageLike` keeps all three; `claimed = ['arrival', 'no_such_quest']` keeps only `arrival`.
    - `no new saved field`: the keys of `defaultQuests()` equal the keys of the `quests` object in `tests/fixtures/s3/default-state.golden.json`.
  - `tracker-order.test.ts`, against `adventureTracker`:
    - `a new game starts on the chain`: title `A Name in the Ledger`, detail `Speak with the task master and accept a task`; with the step met, detail `Claim the reward in the Adventure Log`.
    - `the chain comes before every other quest`: with `openedBank`, `burnedLog` and `killedGoblin` set on `newGame()` (Lumbridge Foundations complete), the title is still the open starter quest.
    - `after the chain, the start town's quests come next`: all six claimed: `Lumbridge Foundations`; that claimed: `Cook's Errand`; that claimed: `Varrock Arcane Trial` (no other place discovered, table order).
    - `a discovered place comes before an undiscovered one`: as above, with `shrines.desert = true` and the two start-town quests claimed: `Sunscorched Oasis`, not Varrock.
    - `a state without arrival starts at Lumbridge Foundations` (the default state).
    - `everything claimed`: title `Adventure log`.
  - **Declared replacement** (owner, 2026-11-14): in `tests/phase3-content.test.ts`, line 41, `'Varrock Arcane Trial'` becomes `"Cook's Errand"`. One line. `git diff -- tests/phase3-content.test.ts` shows one line removed and one added.
- **Accept**: red until K2 (missing exports, and the one edited assertion). The opus verify confirms the diff of `tests/phase3-content.test.ts` is that single line.
- **Must not change**: `src/`, any other existing test.

### K2 Starter quests and tracker order [AGY]
- **Tier**: sonnet (fully specified; every name and text is given here or in design 7.1 item 9).
- **Depends**: K1.
- **Files**: `src/state/quests.ts`, `src/state/adventure.ts`, `src/state/save.ts`, `src/ui/stations.ts`.
- **Change**: Rule commit.
  - `quests.ts`: add `export const STARTER_ARRIVAL = 'arrival';`. Nothing else: no flag, no change to `defaultQuests`, `copyQuests` or `normalizeQuests`.
  - `adventure.ts`: add `export const STARTER_QUESTS: QuestDef[]` after `QUEST_DEFS`, seven entries in this order, each with `region: 'lumbridge'`, `xp: {}`, the `lore` of design 7.1 item 9, and:

    | id | name | steps (label: predicate) | gp | items | rewardText |
    |---|---|---|---|---|---|
    | `arrival` | Arrival | none | 0 | none | `Nothing.` (lore: `You arrived with nothing.`) |
    | `sq_ledger` | A Name in the Ledger | `Speak with the task master and accept a task`: `s.quests.slayer !== null \|\| s.quests.slayerTasksCompleted > 0` | 0 | `bronze_scimitar` 1 | `A Bronze Scimitar.` |
    | `sq_quarrel` | First Quarrel | `Defeat a goblin`: `s.quests.killedGoblin` | 25 | `shrimp` 3 | `3 Cooked Shrimp and 25 GP.` |
    | `sq_gather` | Stone, Timber, Tide | `Mine copper ore`: `s.skills.mining.xp > 0`; `Chop a tree`: `s.skills.woodcutting.xp > 0`; `Net a raw fish`: `s.quests.caughtFish` | 0 | `bronze_helm` 1 | `A Bronze Full Helm.` |
    | `sq_forge` | Fire and Hammer | `Cook a fish`: `s.quests.cookedMeal`; `Smelt a bronze bar`: `s.quests.smeltedBar`; `Forge a platebody and wear it`: `s.quests.worePlate \|\| plateWorn(s)` | 0 | `wooden_shield` 1 | `A Wooden Kiteshield.` |
    | `sq_keeping` | Left in Keeping | `Open the bank`: `s.quests.openedBank` | 0 | `hazel_staff` 1, `air_rune` 30, `mind_rune` 30 | `A Hazel Staff, 30 Air Runes and 30 Mind Runes.` |
    | `sq_coin` | Fair Coin | `Sell an item to a merchant`: `s.quests.soldWares`; `Buy an item from a shop`: `s.quests.boughtWares` | 0 | `leather_boots` 1 | `Traveler Boots. Next: iron gear needs Attack and Defence 5. Buy it at the store, or mine iron and forge it.` |

  - `adventure.ts`: add `function starterOpen(state): QuestDef | null`: the first entry of `STARTER_QUESTS` after index 0 that is not in `claimed` and whose predecessor in the table is; `null` when `arrival` is not claimed or all are claimed. Add `export function starterView(state): QuestView[]`: `[]` when `arrival` is not claimed; otherwise the cards (built exactly as `questView` builds them) of every claimed starter quest after index 0, followed by the open one if there is one.
  - `adventure.ts`, `claimQuest`: look the id up in `QUEST_DEFS`, then in `STARTER_QUESTS`. For a starter quest: if it is not `starterOpen(state)`, return `{ ok: false, reason: 'That quest is not open yet.' }` unless it is already claimed, in which case the existing "already claimed" reason applies. `arrival` is never open, so it is always refused. Everything after the lookup is the existing code, unchanged.
  - `adventure.ts`, `adventureTracker`, in this order: (1) if `starterOpen(state)` exists, its line (claim prompt when complete, else its first unmet step), built from its card; (2) the first unclaimed card of `questView` whose `region` is discovered (`state.shrines[quest.region]`); (3) the first unclaimed card of `questView`; (4) the existing "every quest is claimed" line. Lines for (2) and (3) are built as today.
  - `save.ts`, in `migrateLegacySave`: the set `validQuestIds` is built from the ids of `QUEST_DEFS` and of `STARTER_QUESTS`. One line and one import.
  - `stations.ts`, `renderQuests`: build the cards from `[...starterView(STATE), ...questView(STATE)]`. Nothing else in the function changes.
- **Accept**: `ONE(tests/starter-quests.test.ts)`, `ONE(tests/tracker-order.test.ts)` and `ONE(tests/phase3-content.test.ts)` pass. `ONE(tests/phase2.test.ts)`, `ONE(tests/save-hardening.test.ts)`, `ONE(tests/save-compat-s3.test.ts)` (both goldens untouched) and `ONE(tests/architecture.test.ts)` pass unchanged. SG.
- **Must not change**: `QUEST_DEFS`, `questView`, `QuestDef`, `QuestFlags`, `normalizeQuests`, `serializeState`, the reward of any existing quest, `registerKill`, `assignSlayerTask`, the Adventure Log's markup for a card. Use the quest texts exactly as given: `tests/architecture.test.ts` fails any file under `src/state` or `src/data` that contains the word `document` or `window`, in a string or a comment as much as in code.

---

## 3.3b The pacing model, before any data changes (spine)

### M1 Pacing model and invariant tests [CLAUDE]
- **Tier**: opus. The model is the proof of the stage (design G3.2, G3.8). Implementing it faithfully and judging the dry run is trusted without re-checking.
- **Depends**: D2, I2, K2, and `sp/N` merged.
- **Files** (new): `tests/support/pacingModel.ts`, `tests/support/starterChain.ts`, `tests/pacing.test.ts`, `tests/economy-invariants.test.ts`.
- **Change**:
  - `starterChain.ts` exports `STARTER_ACTIONS`, the 29 actions of design 5.1 in order, as data (`{ kind: 'task' | 'kill' | 'gather' | 'craft' | 'forge' | 'wear' | 'bank' | 'sell' | 'buy' | 'claim', id: string }`), and `playStarterChain(state): Ledger`, which performs each one with the game's own functions and returns the counts. The mapping, which is what the engine does for each click: `task` is `assignSlayerTask(state, combatLevel(state))`; `kill` is `registerKill(state, id)`; `gather` is `addItem(state, item, 1)`, `noteGather(state, item)` and the node's `xp` times `state.xpMultiplier` added to its skill with the level recomputed by `getLevelForXp`; `craft` is `performCraft(state, id)` and must return ok; `forge` is a `craft` that first makes up whatever the live recipe's `input` asks for and the hero lacks (an ore is gathered; a bar is gathered as ore and smelted), so that the chain can be played both before and after D6 changes the smithing recipes; `wear` moves the item from the backpack to its slot and, for a plate body, sets `quests.worePlate` (as `playerActions.ts` does); `bank` sets `quests.openedBank`; `sell` is `sellItem` then `noteSale`; `buy` is `buyItem` then `notePurchase`; `claim` is `claimQuest(state, id)` and must return ok. The list: task; claim `sq_ledger`; wear `bronze_scimitar`; kill `goblin`; claim `sq_quarrel`; gather `copper_ore`, `logs`, `raw_shrimp`; claim `sq_gather`; craft `cook_shrimp`; gather `copper_ore` four times; craft `smelt_bronze` five times; forge `smith_bronze_legs`, `smith_bronze_plate`; wear `bronze_legs`, `bronze_plate`; claim `sq_forge`; bank; claim `sq_keeping`; sell `logs`; buy `arrow_shaft`; claim `sq_coin`. That is 29 entries. Once smithing takes bars (D6) the five smelts are exactly the bars the two forgings need, and the ledger counts 29 actions. Before D6 the forgings still take ore, the helper gathers five more, and the count is 34.
  - `pacingModel.ts` implements design 4.2 against the live code. It must not contain a hit, drop or gather formula of its own: it calls `playerAttackProfile`, `playerHitChance`, `monsterHitChance`, `gatherChance`, `getEquipmentBonuses`, `combatLevel`, `pickSlayerBand` (the Slayer rule of design 4.2 takes the band it returns), `monsterThreatColor`, `unitSellPrice`, `getLevelForXp`, and reads `MONSTER_TYPES`, `CAMPS`, `NODE_PLACEMENTS`, `RESOURCE_NODES_DEF`, `FORGE_RECIPES`, `SLAYER_BANDS`, `QUEST_DEFS`, `STARTER_QUESTS`, `ITEMS`, `ATTACK_INTERVAL`, `DYING_SECS`, `DEAD_SECS`, `HP_REGEN_PER_SEC` and `TICK_SEC`. It uses no random number and no clock: it is a pure function of its options and the tables.
    - Types: `Ledger = { actions: number; killsTotal: number; kills: Record<string, number>; questsClaimed: number; gathered: Record<string, number>; crafted: Record<string, number>; goldEarned: { coins: number; gear: number; slayer: number; quests: number }; goldSpent: number }`. Every ledger is cumulative from the new game.
    - `simulate(opts): { gate: Record<Tier, Ledger>; kit: Record<Tier, Ledger>; averageSeconds: { gate: Record<Tier, number>; kit: Record<Tier, number> } }` with `opts = { start: () => GameState; playChain: boolean; xpMultiplier: number; priceOf: (item) => number; dropChanceOf: (typeKey: string, entry: MonsterDef['drops'][number]) => number; bountyOf: (band: SlayerBand) => number; useShop: boolean; useDrops: boolean; useSlayer: boolean; useQuests: boolean }`. `dropChanceOf` defaults to `(t, e) => e.chance`, and `bountyOf` to `(b) => b.bountyGp`. Both exist so that the dry run and the control below can use other values without editing data. `gate[tier]` is the ledger at the kill on which Attack and Defence both reach the tier; `kit[tier]` is the ledger once weapon, body and legs of the tier are worn. **Counts and times are kept apart on purpose** (rule 0.3.10): nothing in `gate` or `kit` is a time.
    - It works on a real `GameState` (skills, equipment, `gp`), on the controlled style, with the purchase rule, Slayer rule, start rule, quest rule, kit table, timings and "can win" rule written in design 4.2. None of these is the implementer's choice: if 4.2 is ambiguous on a point, stop and ask. Do not pick a reading. With `playChain` the run begins with `playStarterChain` (90 s per quest of average time) and the one goblin task it hands out is completed and paid on every route; a further task is taken only with `useSlayer`. Monster count per type and attackers come from `CAMPS`: attackers are the members of that type's largest aggressive camp when `monsterThreatColor(level, combatLevel(state))` is not `green`, otherwise 1. Expected drops come from the tables: each entry's chance times its value; a kit piece is obtained when its expected count reaches 1. Slayer bounties come from `SLAYER_BANDS` through `bountyOf`. A guard stops a run at 400 simulated hours.
    - `furtherKills(run, tier)` is `kit[tier].killsTotal - gate[tier].killsTotal`. `tiersBehind(run, tier)` is the number of later tiers whose `gate.killsTotal` is below `kit[tier].killsTotal`.
    - `siteSize(nodeKey)`: the largest group of `NODE_PLACEMENTS` of that type in which each node is within 15 units of another (design 4.2). `gatherSeconds(nodeKey, level)` uses it as the node count. `gatherGpPerHour(nodeKey, level)` (cooked value for fish), `forgeTasks(tier): Ledger` (design 4.5 and 7.1 item 5: mine the best ore for the levels still missing, smelt and forge everything, stop when the tier's three recipes and its ore are unlocked, then mine and smelt the kit's bars and forge it; the ledger counts ore, bars and forgings and has `goldSpent` 0 by construction only if no step needed the shop), and `saleRatio(recipe)` (sale value of the output quantity over the sale value of the direct inputs).
  - `pacing.test.ts`. Route A1 is `{ start: createNewGameState, playChain: true, xpMultiplier: 1, priceOf: shopPrice, useShop: true, useDrops: false, useSlayer: false, useQuests: true }`; A3 is the same with drops and Slayer on. The two thresholds are constants at the top of the file with the design reference: `MIN_FURTHER_KILLS = 25`, `MAX_TIERS_BEHIND = 3` (design 5.3, Q3.10). The tests: 1 to 7 are assertions 1 to 7 of design 5.3, test 8 is the purity check of G3.8, and test 9 is assertion 8 (the printed table):
    1. `the starter chain earns the bronze kit: six quests, one kill, 29 actions, no coin spent on equipment`: `playStarterChain(createNewGameState())` completes without a refused step; `actions` is 29; the hero wears `bronze_scimitar`, `bronze_plate` and `bronze_legs`; `questsClaimed` is 6, `killsTotal` is 1; the only purchase is the one the last quest asks for; the backpack holds `bronze_helm`, `wooden_shield`, `hazel_staff`, 30 `air_rune`, 30 `mind_rune` and `leather_boots`; `kit.bronze` of route A1 equals this ledger.
    2. `every tier is a step, in order` (A1 and A3, at 1x only): for each tier `gate.killsTotal <= kit.killsTotal`; from iron to dragon `kit.killsTotal` is strictly increasing.
    3. `shop only: the kit takes at least 25 further kills after the level, iron to adamant` (A1), and `with bounties and drops it still comes after the level, iron to mithril` (A3, at least 1).
    4. `a shop-only fighter is never more than three tiers behind` (A1, iron to rune).
    5. `negative control: today's economy hands over the kit with the level` (critique H-1). It runs `start: createNewGameState`, the chain, 1x, `priceOf: (it) => it.price`, drops on, and today's drop chances and bounties, with and without Slayer. Because D3 edits both tables, the 23 equipment drop chances and the five bounties of `a8cad85` are written as constants in the test and passed through `dropChanceOf` and `bountyOf`. It asserts that for **every** tier from iron to adamant `furtherKills` is below `MIN_FURTHER_KILLS`, on both runs. If this test fails, test 3 cannot tell the two economies apart.
    6. `the booster speeds levels, not gear` (A1 at `xpMultiplier: 10`, steel to rune: at least 25 further kills; iron is printed only, design 6.1).
    7. `the forge makes bronze, iron, mithril and rune kits without coin`: for each, `forgeTasks(tier).goldSpent` is 0, the ledger ends with the tier's three pieces crafted, and `actions` is strictly greater than the previous tier's.
    8. `the model is a pure function`: two calls of `simulate` with the same options return deep-equal results.
    9. `prints the milestone table`: for A1 and A3 at 1x and A1 at 10x, per tier: kills at the level and at the kit by monster, further kills, tiers behind, quests claimed, gold earned by source and spent, the share of the kit's price earned at the level, and the average time from `averageSeconds`. For each tier from iron to rune it also prints the forge task list and the best gathering and crafting GP an hour next to the fighter's coin income (design F15). It asserts nothing. This is the only place in the file that reads `averageSeconds`.
  - `economy-invariants.test.ts` (design G3.3):
    - `no recipe's output sells for more than 2.5 times its inputs`, with one listed exception, `fletch_shortbow`, and the reason in a comment (pinned by `tests/phase1.test.ts`).
    - `shopPrice is never below unitSellPrice` over every item, and `shopPrice equals price for runes, ammunition, food and potions`.
    - `equipment costs GEAR_MARKUP times its list price`.
    - `no fishing spot earns more than 1.5 times the best rock or tree of a comparable level`: cooked-fish GP per hour against the best mining or woodcutting node whose requirement is at most 10 levels higher, at the spot's requirement and 21 levels above it. A ratio of two rates from the same formula (rule 0.3.10).
    - `every non-boss equipment drop chance is at most 0.02`, and `the boss's is at most 0.05`.
    - `bronze armour needs no gold`: a copper rock stands in the start region outside every aggressive camp; on a new-game state given five copper ore, `performCraft` succeeds for `smelt_bronze` five times, then `smith_bronze_legs`, then `smith_bronze_plate` (the five smelts give the 83 XP that Smithing 2 needs at 1x).
  - **One-time reproduction, before any data changes.** The verify of this task runs `simulate` once with today's start (`createDefaultState`, no chain, `priceOf: item.price`, quests off, drops on) at 10x and 1x, with and without Slayer, and writes the four rows, in kills and in average time, into the P0 baseline file next to design table 4.3's rows T1 to T4. Stage 2's real camps are in force, so compare with T3 and T4. An average kit time more than 20% away from the design's row is reported to the main session before lane D starts. It is a report and not a failure: it means the design's "today" numbers, produced by a script nobody else has run, do not hold.
  - **Dry run of the "after" rows, before any data changes** (critique C-1). The same verify runs A1 and A3 at 1x and A1 at 10x with the design's parameters injected rather than written: `start: createNewGameState`, `priceOf: shopPrice` (in place since D2), `dropChanceOf` returning `0.05 ×` the chance for every non-boss equipment entry and `0.05` for the dragon's four, and `bountyOf` returning the five reduced bounties of D3. It writes the rows into the baseline file next to design tables 4.3 and 5.2, and evaluates tests 2 to 6 against them. **Stop rule:** if any of them fails, do not start D3. Repeat the dry run with `priceOf` at markups 8, 9, 11 and 12, write those rows too, and return to the main session for owner step O-13b. The design's scratch model passes all five across the tuning range, and design 6.1 lists the closest value to each bound, so a failure here means the two models disagree, which is exactly what this step is for. Finding that out here costs one task. Finding it at T1 costs twenty.
- **Accept**: TYPES and BUILD pass. The reproduction rows and the dry-run rows are in the baseline file, and the dry run passes tests 2 to 6; otherwise the stop rule above applies. Tests 5 and 8 pass from the start, and so do the A1 halves of tests 2, 3, 4 and 6, because route A1 uses only the shop price, which D2 has already set. `ONE(tests/pacing.test.ts)` and `ONE(tests/economy-invariants.test.ts)` are red, and the verify lists which assertions fail with the tables as they are after D2. By design sections 4 and 5 that should be: the action count of test 1 and `bronze armour needs no gold` (recipes still take ore), possibly test 7, the A3 half of test 3 (gear still drops one kill in five and bounties are full), the 2.5 rule (gilded, bows, rune smithing), the fishing bound (trout, lobster, shark) and the drop-chance bound. The three `shopPrice` assertions pass.
- **Declared exception to rule 0.3.4**: these two test files stay red from this task until T1. Every task in between (D3 to D6, C1, C2, R1) states its accept in terms of the specific assertions it turns green.
- **Must not change**: `src/`, any existing test.

---

### D3 Gear drop rates [AGY]
- **Tier**: sonnet (data transcription).
- **Depends**: M1.
- **Files**: `src/data/catalog.ts`, `src/data/world.ts`, `src/state/adventure.ts`.
- **Change**: Data commit. In `SLAYER_BANDS` (`adventure.ts`) set `bountyGp` to 300 for `scorpion`, 400 for `dark_wizard`, 600 for `hill_giant`, 1100 for `moss_guardian` and 1800 for `lesser_demon`; the `goblin` row stays 400 and no other field changes. In `MONSTER_TYPES`, set the `chance` of exactly these entries; touch no other entry:

  | Monster | Entry | New chance |
  |---|---|---|
  | `goblin` | `iron_plate`, `iron_legs` | 0.008 |
  | `scorpion` | `steel_plate`, `steel_legs` | 0.011 |
  | `dark_wizard` | `mystic_top`, `mystic_bottom` | 0.010 |
  | `dark_wizard` | `mith_scimitar` | 0.009 |
  | `hill_giant` | `addy_plate`, `addy_legs` | 0.011 |
  | `moss_guardian` | `rune_plate`, `rune_legs` | 0.011 |
  | `moss_guardian` | `green_dhide_body`, `green_dhide_chaps` | 0.012 |
  | `lesser_demon` | `dragon_chain`, `dragon_legs` | 0.010 |
  | `lesser_demon` | `dragon_scimitar` | 0.009 |
  | `elvarg_dragon` | `bandos_chest`, `bandos_tassets`, `champion_tunic`, `champion_leggings` | 0.05 |
  | `goblin_archer` (`world.ts`) | `shortbow` | 0.004 |
  | `dark_ranger` (`world.ts`) | `willow_bow` | 0.008 |
  | `dark_ranger` (`world.ts`) | `green_dhide_body` | 0.004 |

- **Accept**: in `tests/economy-invariants.test.ts` the two drop-chance assertions pass. In `tests/pacing.test.ts`, the A3 half of test 3 passes. `ONE(tests/economy-rolls.test.ts)` still passes (its goblin cases use rolls of 0 and 0.999, which do not depend on the chance values). `ONE(tests/content-freeze.test.ts)` passes. `ONE(tests/phase2.test.ts)` passes unchanged. The opus verify reads the diff and finds 23 changed drop chances, 5 changed bounties and nothing else.
- **Must not change**: coin ranges, bones, food, arrows, monster stats, the goblin bounty, Slayer counts and experience.

### F0 Fishing tests [CLAUDE]
- **Tier**: sonnet (written from design 7.1 item 4).
- **Depends**: D3.
- **Files**: `tests/fishing-cues.test.ts` (new).
- **Change**: the engine files need the DOM, so they are read as text, as `tests/source-limits.test.ts` reads sources.
  - `an emptied fishing spot stays empty longer than today, inside the tuning range`: for each of `fish_shrimp`, `fish_trout`, `fish_lobster`, `fish_shark`, `RESOURCE_NODES_DEF[key].respawn` is greater than today's value (2000, 2000, 2500, 3000, written as constants in the test) and at most 10000. The exact values (6000, 3000, 7000, 8000) are D4's data and are not pinned here, because T1 may tune them between 2000 and 10000 and must not edit this file.
  - `a catch always empties the spot`: `src/engine/actions.ts` does not contain `0.35`.
  - `an emptied spot and a returning spot each have a sound`: `src/engine/audio.ts` contains `spotEmpty:` and `spotReturn:`; `src/engine/actions.ts` contains `SFX.spotEmpty()`; `src/engine/loop.ts` contains `SFX.spotReturn()`.
  - `an empty spot leaves a mark`: in `src/engine/spawns.ts`, the text between `depletedMesh = new THREE.Group();` and the next `const hitbox` contains `depletedMesh.add(`.
  - `no second chat line per fish`: `src/engine/actions.ts` contains the text `Gathered <b>` exactly once.
- **Accept**: red until D4 (the first two cases) and F1 (the rest).
- **Must not change**: `src/`.

### D4 Fishing spots deplete on every catch [AGY]
- **Tier**: sonnet (one condition and four numbers).
- **Depends**: F0.
- **Files**: `src/engine/actions.ts`, `src/data/catalog.ts`.
- **Change**: Rule commit (owner 2026-11-14, Q3.7 option a). In `performResourceGather`, the block guarded by `if (def.kind !== 'fish' || Math.random() < 0.35)` runs after every successful gather: remove the condition, keep the body. In `RESOURCE_NODES_DEF`, set `respawn` to 6000 for `fish_shrimp`, 3000 for `fish_trout`, 7000 for `fish_lobster` and 8000 for `fish_shark`.
- **Accept**: in `tests/economy-invariants.test.ts`, `no fishing spot earns more than 1.5 times the best rock or tree of a comparable level` passes. Stage 2's `ONE(tests/world-data.test.ts)` and `ONE(tests/placements.test.ts)` pass unchanged. In `tests/fishing-cues.test.ts`, the first two cases pass.
- **Must not change**: `gatherChance`, any other node's respawn, XP. The look and sound of an empty spot are F1's.

### F1 Fishing cues: the empty and the returning spot [AGY]
- **Tier**: sonnet (three small engine edits, fully specified).
- **Depends**: D4.
- **Files**: `src/engine/audio.ts`, `src/engine/actions.ts`, `src/engine/loop.ts`, `src/engine/spawns.ts`.
- **Change**: Rule commit (design 7.1 item 4). F0 checks that the cues are wired, by reading the sources. How they look and sound needs a browser (design C7): the opus verify reads the diff against this text and G-6 judges the result.
  - `audio.ts`: add to the `SoundEffects` interface and to `SFX` two tones in the style of the existing ones: `spotEmpty: () => { tone(420, 'sine', 0.16, 0.08, 210); }` (falling) and `spotReturn: () => { tone(300, 'sine', 0.14, 0.07, 520); }` (rising).
  - `actions.ts`, `performResourceGather`, inside the depletion block: `if (def.kind === 'fish') SFX.spotEmpty();`.
  - `spawns.ts`, the fishing branch of `spawnResourceNode`: the `depletedMesh` group, empty today, gets one flat ring: a `TorusGeometry(1.15, 0.03, 5, 8)` with a `MeshBasicMaterial` of colour `0x7a96a3`, `transparent: true`, `opacity: 0.35`, rotated flat like `ring1`, at `y = 0.05`. It is not added to `G.swayingFoliage`, so it stays still. `upgradeResourceNode` in `blenderWorld.ts` replaces only the live visual of a fishing spot, so this ring survives the model upgrade.
  - `loop.ts`, `updateWorldTimers`, where a node's timer ends: `if (r.def.kind === 'fish' && Math.hypot(r.pos.x - player.pos.x, r.pos.z - player.pos.z) <= 14) SFX.spotReturn();`.
- **Accept**: `ONE(tests/fishing-cues.test.ts)` passes. SG apart from the two M1 files. `ONE(tests/architecture.test.ts)` passes. The diff touches only the four files and adds no import cycle.
- **Must not change**: `SFX.fish`, tree and rock depletion, respawn times, the hitbox, `blenderWorld.ts`, any chat line (one line per fish is already printed; a second would be noise).

### D5 Recipe tests [CLAUDE]
- **Tier**: sonnet (written from design 7.1 item 5 and G3.4).
- **Depends**: F1.
- **Files** (new): `tests/recipes-bars.test.ts`.
- **Change**:
  - `recipes-bars.test.ts`: `every smith recipe takes bars, or a rune piece and gold bars` (inputs of each `smith_*` id, exactly as the table in design 7.1 item 5); `ore alone cannot forge` (`tryCraft` on a state with 3 `copper_ore` and Smithing 2 fails and names the bar); `bars forge and give today's XP` (bronze platebody 50, rune platebody 520 through `performCraft` at multiplier 1); `gilded platebody consumes the rune platebody and three gold bars at Smithing 48 and is refused at 47`; `smelt requirements are 1, 5, 20, 35, 40`; `bows take 1, 3, 4, 5 and 6 logs` for oak, willow, maple, yew, magic; `a smelt requirement never exceeds its metal's lowest forging requirement`.
- **Accept**: red until D6.
- **Must not change**: `src/`.

### D6 Smithing takes bars; recipe inputs [AGY] (**audit finding 9**)
- **Tier**: sonnet (data transcription).
- **Depends**: D5.
- **Files**: `src/data/catalog.ts`, `src/data/recipes.ts`.
- **Change**: Data commit, message `data(#9, D6): smithing takes bars`.
  - `catalog.ts`, `FORGE_RECIPES`, `input` (and `req` where stated); ids, names, `xp`, `output` unchanged:

    | Recipe id | New input | Req |
    |---|---|---|
    | `smith_bronze_legs` | `{ bronze_bar: 2 }` | 1 |
    | `smith_bronze_plate` | `{ bronze_bar: 3 }` | 2 |
    | `smith_iron_scim` | `{ iron_bar: 2 }` | 5 |
    | `smith_iron_legs` | `{ iron_bar: 2 }` | 7 |
    | `smith_iron_plate` | `{ iron_bar: 3 }` | 9 |
    | `smith_mith_scim` | `{ mithril_bar: 3 }` | 20 |
    | `smith_mith_legs` | `{ mithril_bar: 3 }` | 22 |
    | `smith_mith_plate` | `{ mithril_bar: 4 }` | 24 |
    | `smith_gilded_legs` | `{ rune_legs: 1, gold_bar: 3 }` | 46 (was 35) |
    | `smith_gilded_plate` | `{ rune_plate: 1, gold_bar: 3 }` | 48 (was 38) |
    | `smith_rune_scim` | `{ runite_bar: 4 }` | 40 |
    | `smith_rune_legs` | `{ runite_bar: 4 }` | 42 |
    | `smith_rune_plate` | `{ runite_bar: 5 }` | 45 |

  - `recipes.ts`: `smelt_iron` req 5, `smelt_mithril` req 20, `smelt_runite` req 40 (`smelt_bronze` 1 and `smelt_gold` 35 stay). `LOG_CRAFT` rows gain an optional `bowLogs`: 3 for `willow_logs`, 4 for `maple_logs`, 5 for `yew_logs`, 6 for `magic_logs`; the bow recipe's input becomes `{ [log.id]: log.bowLogs ?? 1 }`. The burn recipes and `fletch_shortbow` keep one log.
- **Accept**: `ONE(tests/recipes-bars.test.ts)` passes. In `tests/economy-invariants.test.ts`, the 2.5 rule and `bronze armour needs no gold` pass. In `tests/pacing.test.ts`, test 1 (the chain in 29 actions) and test 7 (the forge routes) pass. `ONE(tests/phase1.test.ts)`, `ONE(tests/phase2.test.ts)`, `ONE(tests/phase3-content.test.ts)`, `ONE(tests/rule-fixes.test.ts)` and `ONE(tests/content-freeze.test.ts)` pass unchanged.
- **Must not change**: recipe ids, names, XP, outputs, cooking recipes, `fletch_shafts`, `craft_wood_shield`, `fletch_bronze_arrows`, `tryCraft`.

---

## 3.4 Lane U: unlock messages (parallel worktree `sp/U`)

### U1 Unlock tests [CLAUDE]
- **Tier**: sonnet (written from design 7.1 item 7 and G3.6).
- **Depends**: D2 (the lane is cut after it).
- **Files**: `tests/unlocks.test.ts` (new).
- **Change**: tests against `src/state/unlocks.ts`:
  - `unlocksAt(skill: string, level: number): { kind: 'gear' | 'recipe' | 'node' | 'prayer' | 'spell'; name: string; id: string }[]`: gear is every equip item whose `req[skill] === level`; recipes are `FORGE_RECIPES` with that `skill` and `req`; nodes are `RESOURCE_NODES_DEF` with that `skill` and `req`; prayers only for `prayer`; spells only for `magic`. Order: gear, recipes, nodes, prayers, spells, each in table order.
  - Cases: `('attack', 5)` contains `Iron Scimitar`; `('mining', 10)` contains `Iron Ore Vein`; `('smithing', 9)` contains `Forge Iron Platebody`; `('prayer', 30)` contains `Protect from Melee`; `('magic', 12)` contains `Fire Bolt`; `('attack', 6)` is empty; `('nonsense', 5)` is empty.
  - `forgeHint(itemId: string): string | null` (the owner's condition on the markup, 2026-11-14): for an item that is the `output` of a recipe of kind `smith` or `fletch`, the text `forge: <qty> <input name>[, …] at Smithing <req>`, with the input names from `ITEMS`; `null` otherwise. Cases: `forgeHint('iron_scimitar')` starts with `forge: 2 ` and ends with ` at Smithing 5` (the input is iron ore before D6 and iron bars after; the test does not name it); `forgeHint('steel_longsword')` is `null`; `forgeHint('shortbow')` ends with ` at Smithing 5`; `forgeHint('no_such_item')` is `null`.
  - `unlockLine(skillName: string, level: number, unlocks): string | null`: `null` for an empty list; for three or fewer, `Level 5 Attack unlocks: <b>Iron Scimitar</b> (shop 1,400 GP, or forge: … at Smithing 5).` with entries joined by `, `; for more, the first three then ` and N more.` A gear entry is followed by `(shop <shopPrice> GP, or <forgeHint>)` when it has a hint and by `(shop <shopPrice> GP)` when it has none; other kinds carry no bracket. Cases: the Attack 5 line contains `shop 1,400 GP` and `forge:`; the Attack 10 line names the Steel Longsword with `(shop 2,900 GP)` and no `forge`.
  - `every name comes from a data table`: each returned name is the `name` of an entry in `ITEMS`, `FORGE_RECIPES`, `RESOURCE_NODES_DEF`, `PRAYERS` or `SPELLS`.
- **Accept**: red until U2.
- **Must not change**: `src/`.

### U2 Unlock module and chat line [AGY]
- **Tier**: sonnet (fully specified).
- **Depends**: U1.
- **Files**: `src/state/unlocks.ts` (new), `src/ui/playerActions.ts`.
- **Change**: Rule commit. `unlocks.ts` exports `unlocksAt`, `forgeHint` and `unlockLine` as U1 states and imports only from `src/data` (`shopPrice` from `items.ts`, the recipes from `recipes.ts`). In `grantXp`, inside the `if (s.lvl > oldLvl)` block after the existing level-up chat line: for each level from `oldLvl + 1` to `s.lvl`, `const line = unlockLine(meta.name, level, unlocksAt(skillKey, level)); if (line) addChatMessage(line, 'skill');`. The examine line (`addChatMessage('<b>' + item.name + '</b> — Value: ' + item.price + ...)`, `playerActions.ts` 205) becomes `<b>${item.name}</b> — Shop ${shopPrice(item).toLocaleString('en-US')} GP · sells for ${unitSellPrice(item).toLocaleString('en-US')} GP. Use it at the Bank, Anvil, or General Store.` (design 7.1 item 7, critique L-1). No test reads that line. It imports `shopPrice` (D2) and `unitSellPrice` from `src/data/items.ts`.
- **Accept**: `ONE(tests/unlocks.test.ts)` and `ONE(tests/architecture.test.ts)` pass. SG.
- **Must not change**: XP arithmetic, the level-up banner, sounds, `requestUiRefresh`.

---

## 3.5 Caps and README (spine, after the lanes are merged)

### C1 Cap tests [CLAUDE]
- **Tier**: sonnet (written from design 7.1 item 6 and G3.5).
- **Depends**: D6, and `sp/U` merged.
- **Files**: `tests/gp-cap.test.ts` (new).
- **Change**: with `MAX_GP` imported from `src/state/economy.ts` (the stack cap in play is dropped, design 7.1 item 6, critique M-3):
  - `creditGp adds, and stops at MAX_GP`; `creditGp never goes below 0` (a negative amount larger than the purse); `creditGp ignores NaN and Infinity` (the purse is unchanged); it returns the amount actually credited.
  - `selling at the cap is refused and removes nothing`: `gp = MAX_GP - 10`, sell one `rune_plate`: `ok` false, reason `Your coin pouch is full.`, the item still in the backpack.
  - `a bounty and a quest reward at the cap leave gp at MAX_GP` (`registerKill` finishing a task, `claimQuest`).
  - `the gold cheat at the cap leaves gp at MAX_GP`.
  - `the cap value is written once`: `src/state/save.ts` and `src/state/inventory.ts` do not contain the text `2147483647`.
- **Accept**: red until C2.
- **Must not change**: `src/`.

### C2 Caps in play [AGY] (**Stage 1 review finding**)
- **Tier**: sonnet (fully specified).
- **Depends**: C1.
- **Files**: `src/state/economy.ts`, `src/state/inventory.ts`, `src/state/adventure.ts`, `src/state/cheats.ts`, `src/state/save.ts`, `src/engine/actions.ts`.
- **Change**: Rule commit.
  - `economy.ts`: `export const MAX_GP = 2147483647; export const MAX_STACK = 2147483647;` and `export function creditGp(state: GameState, amount: number): number`: when `amount` is not finite it returns 0; otherwise it sets `state.gp` to `min(MAX_GP, max(0, state.gp + floor(amount)))` and returns the difference.
  - `inventory.ts`: `compactSlots` uses `MAX_STACK` in place of the literal. `sellItem`: compute `gp = unit * n` first; when `state.gp + gp > MAX_GP` return `{ ok: false, moved: 0, reason: 'Your coin pouch is full.' }` before removing anything; otherwise remove and `creditGp`. `canPlace`, `place`, `buyItem`, `buyRunePack`, `withdraw` and `deposit` are not touched.
  - `adventure.ts`: `claimQuest` and `registerKill` use `creditGp`. `cheats.ts`: `applyGold200k` uses `creditGp`. `save.ts`: the `gp` clamp uses `MAX_GP`. `actions.ts`, `handleMonsterDeath`: the coin result uses `creditGp(STATE, amount)`.
  - `economy.ts` still imports only `src/data` and types; `inventory.ts`, `adventure.ts`, `cheats.ts` and `save.ts` import from it. Check there is no import cycle: `economy.ts` must not import `inventory.ts` or `adventure.ts`.
- **Accept**: `ONE(tests/gp-cap.test.ts)` passes. `ONE(tests/cheats.test.ts)`, `ONE(tests/phase2.test.ts)`, `ONE(tests/save-hardening.test.ts)`, `ONE(src/__tests__/bulk-buy.test.ts)`, `ONE(src/__tests__/bulk-sell.test.ts)` and `ONE(tests/save-compat-s3.test.ts)` pass unchanged. `ONE(tests/architecture.test.ts)` passes.
- **Must not change**: behaviour below the cap; `canPlace`, `place`, `buyItem`, `buyRunePack`, `withdraw`, `deposit`. Every existing test of buying, selling, banking, quests and cheats is the guard.

### R1 README [CLAUDE]
- **Tier**: sonnet (doc sync to code).
- **Depends**: C2.
- **Files**: `README.md`.
- **Change**: Docs commit. Correct the feature list and tables for: the new start (nothing in hand; six start-town quests pay the first kit; 1x experience); shop equipment at ten times list price while selling stays at 65% of list, and a sentence that gear and gold already owned are kept; rare gear drops; fishing spots that empty on each catch; smelting bars before forging; bows that take several logs; the Hazel Staff; the item count in the badge and the heading if it is a count of `ITEMS` (one more). **Remove** the mention of the 10x rate switch from the feature list (line 43 today) and do not mention the cheat codes or the reveal word anywhere: the owner wants both hidden. Do not add a name the game does not already use, other than the six quest names and the staff.
- **Accept**: SG (`tests/credits.test.ts` still passes). `grep -n -i "10x\|league xp\|cheat\|skills10\|gold200k\|backroom" README.md` prints nothing. The opus verify checks each sentence against the merged code.
- **Must not change**: the credits section, licence text, links.

---

## 3.6 Tuning and gate

### T1 Run the model on the real world and tune [CLAUDE]
- **Tier**: opus (tuning data against a test, and judging whether the result is still the design).
- **Depends**: R1.
- **Files**: `src/data/items.ts` (only the value of `GEAR_MARKUP`), `src/data/catalog.ts` and `src/data/world.ts` (only the drop chances of D3 and the four fishing respawns of D4), `docs/superpowers/specs/2026-11-14-start-pacing-design.md` (tables 4.3, 5.1, 5.2, 5.5 and 6.1 and section 14 only), `docs/superpowers/baseline/2026-11-14-stage3-baseline.md`.
- **Change**: run `ONE(tests/pacing.test.ts)` and `ONE(tests/economy-invariants.test.ts)`.
  - If both pass: copy the printed table into the baseline file. Replace the counts and the average times in design tables 4.3 (the "after" rows), 5.1, 5.2 and 5.5 and the "10" row of the kills table in 6.1 with the committed model's numbers, including the forge task lists and the chain's action count, and change the paragraph under "How the numbers were produced" and section 14 to say that these rows now come from the committed test.
  - If test 2, 3, 4 or 6 of `pacing.test.ts` fails: tune, in this order and no further. (1) `GEAR_MARKUP`, an integer from 8 to 12. (2) The non-boss gear drop chances of D3, all scaled by one common factor between 0.5 and 2 (so 0.004 to 0.024). Choose the smallest change from the design's values that passes every assertion on both routes. Record every value tried and its table in the baseline file. Then update the design tables as above, and state the changed constant in design 7.1 and CALL-3.5 or CALL-3.6.
  - If the fishing bound fails (Stage 2 moved fishing spots, so site sizes may differ): tune only the four fishing `respawn` values of D4, each between 2000 and 10000, so that the bound holds and no spot earns less than a third of the best rock or tree of equal or lower requirement. Then correct the rhythm table of design 7.1 item 4.
  - There is no knob for the starter chain (test 1), the forge route (test 7), the control (test 5), the 2.5 rule, or `bronze armour needs no gold`. If one of them fails, or no value in the ranges above passes, or a test can only pass by moving `MIN_FURTHER_KILLS` or `MAX_TIERS_BEHIND`: stop. Write what was tried in the baseline file and return to the main session. The two thresholds are the owner's (Q3.10) and are not tuned here.
  - No tuning step may look at a time. The average times are copied into the design after the counts pass; they decide nothing (rule 0.3.10).
- **Accept**: SG, with no red test anywhere. The baseline file holds the final table.
- **Must not change**: `MIN_FURTHER_KILLS`, `MAX_TIERS_BEHIND` and every assertion in `tests/pacing.test.ts`, the bounds in `tests/economy-invariants.test.ts`, any formula, any other data.

### G-5 Stage 3 verification [CLAUDE]
- **Tier**: opus (verification).
- **Depends**: T1.
- **Files**: none (read-only; a written report in the session).
- **Check**:
  1. SUITE: all pass. `git diff main --stat -- tests src/__tests__` lists only added files and one modified file, `tests/phase3-content.test.ts`, whose diff is the single declared line (rule 0.3.3).
  2. TYPES: clean.
  3. BUILD: the JS chunk is within 10 kB of the P0 value.
  4. `npm audit --audit-level=high` exits 0. `git diff main -- package.json package-lock.json` is empty.
  5. Every goal G3.1 to G3.12 maps to a passing test (section 4.2 below).
  6. Audit finding 9 and the Stage 1 review finding on caps are closed (D6, C2).
  7. `git diff main -- src/state/gameState.ts` shows `createDefaultState` untouched; `git diff main -- src/state/save.ts` shows only the `MAX_GP` and `MAX_STACK` imports and their use and the one line that widens `validQuestIds`; `serializeState` is unchanged; `git diff main -- src/state/quests.ts` shows one added constant; `git diff main -- src/state/types.ts` is empty (no new saved field).
  8. `git diff main -- src/data/catalog.ts` changes no `price`, `req` (outside the two gilded recipes), monster stat, coin range, XP value or name of an existing row, and adds exactly one item row, `hazel_staff`. `src/data/skills.ts` is unchanged. `git diff main -- src/state/adventure.ts` shows `QUEST_DEFS` and `questView` untouched, five changed `bountyGp` values, the two `creditGp` calls, `STARTER_QUESTS`, `starterOpen`, `starterView`, and the edits to `claimQuest` and `adventureTracker` that K2 names.
  9. `git diff main --stat` lists only files on some task's allowlist. Nothing under `public/` or `blender/` changed.
  10. No commit on the branch carries an attribution trailer.
  11. No test asserts a time (rule 0.3.10): `grep -n "averageSeconds" tests/pacing.test.ts` matches only inside the test `prints the milestone table`, and `grep -n -i "minutes\|seconds\|hours" tests/pacing.test.ts tests/economy-invariants.test.ts tests/starter-quests.test.ts` shows no line that also contains `expect(`.
  12. Nothing in the normal interface names the booster or the cheats: `grep -n "skills10\|gold200k" src/engine/runtime.ts` prints nothing, and in `index.html` every match of `cheat\|xp-rate-btn\|League XP` lies after the opening tag of `hidden-tools`.
  13. Every new name is one the design lists (design C4): the six quest names, `Arrival`, `Hazel Staff`. `tests/content-freeze.test.ts` and `tests/starter-quests.test.ts` pass.
- **Accept**: a written pass.
- **Must not change**: anything; the task is read-only.

### G-6 Stage 3 human checks [HUMAN]
Design 9.2. Nothing below expects a time. Where a time is asked for, it is written down as information.
- Reset from Settings on a profile with a save: after the reload the hero is a new character (design F16; before the fix the old one came back).
- A new game: nothing worn, an empty backpack, 0 GP; Settings shows no experience button and no cheat panel; the chat names no cheat; the tracker shows "A Name in the Ledger"; the onboarding card and first chat lines describe the start.
- Play the starter chain to the end without cheats. Record: every point where the next step was unclear; what the hero wears and carries at the end (expected: bronze scimitar, platebody and platelegs worn; helm, shield, boots, Hazel Staff, 30 Air and 30 Mind runes, food, coin); the number of clicks it took, roughly. For information, the time.
- In a private window, play the chain in one sitting, wear the Traveler Boots, then reload: the boots are still worn (N2, outfit condition).
- Continue to the iron kit. Record the kills by monster, whether the kit was bought or forged, and whether the unlock line at Attack 5 was noticed. For information, the time. Put both records in the baseline file beside the model's table: they are the only measurement of a real player.
- Type `backroom` during play: Settings shows the experience button and the cheat panel; the button changes the rate; after a reload both are hidden again. Without revealing anything, type `gold200k` and `skills10`: both still work.
- Load a save that runs at 10x: one chat line says so, the rate is unchanged, Settings shows no button.
- The shop: the card, the buy button and the tooltip show the marked-up price; buying charges it; selling pays what it paid before; runes and arrows cost what they cost before; the Hazel Staff is listed under Magic at 600 GP.
- Fishing: at the three shrimp spots, each empties on the catch with a falling tone and leaves a still ring, returns after about six seconds with a rising tone, and the three can be worked in rotation without waiting. At a trout spot the wait reads as a wait. Count the clicks for ten shrimp (expected: about ten on the spots). Say whether one click per fish reads well.
- The Hazel Staff: equipped, it shows as a staff, tinted unlike the Staff of Fire; Wind Strike casts and uses the runes; with none left the game says which are missing.
- The forge: smelt copper, forge bronze platelegs and platebody, equip them; forging from ore alone is refused with the bar named.
- Reaching Attack 5 prints the unlock line with the iron scimitar's shop price and its forge recipe.
- The owner's own save from before the stage loads with position, gear, bank, gold, multiplier and quests as they were, and shows no starter quest.
- The smoke list of the Stage 1-2 design 5.7, once.

### O-14 Accept Stage 3 [OWNER]
The owner reviews G-5 and G-6 and accepts. The main session opens the pull request to `main` and merges after CI is green.

---

# 4. Coverage

## 4.1 Findings to tasks

| Finding (design 4.6, 10) | Task |
|---|---|
| F1 start kit | N1, N2 (nothing in hand); K1, K2 (the kit is earned) |
| F2 10x by default | N1, N2 (1x); N3, N4 (the option hidden) |
| F3 gear drops | D3, M1 |
| F4 shop prices never bind | D1, D2, M1, T1 |
| F5 crafting prints money | D5, D6, M1 |
| F6 fishing | F0, D4, F1, M1 |
| F7, audit finding 9: bars are dead ends | D5, D6 |
| F8, Stage 1 review: caps only on load | C1, C2 |
| F9 free sustain | deferred to Stage 4 (design 7.2) |
| F10 Slayer income | D3 (five bounties), M1 (test 3) |
| F11 low-requirement strong items | D2 (price); requirements left alone (design 7.4) |
| F12 giants plateau | deferred to Stage 6 (design 7.5); printed by M1 |
| F13 the dragon's drops / its respawn | D3 / deferred to Stage 4 |
| F14 tiers without recipes | deferred to Stage 6 |
| F15 money from gathering and crafting | M1 (printed, not asserted) |
| F16 reset writes the old character back | N2 (reset guard), G-6 |
| F17 the tracker points at an aggressive camp | K1, K2 |
| F18 cheats and booster advertised | N3, N4, R1 |
| F19 magic closed at the start | I1, I2, K2 (the fifth quest pays the staff) |
| Audit finding 6, second half | D6, M1 (the 2.5 rule) |

## 4.2 Goals to proofs

| Goal | Proof task(s) |
|---|---|
| G3.1 | N1; P1 (default golden) |
| G3.2 | M1 `pacing` (tests 1 to 9), T1; G-5 step 11 (no time asserted) |
| G3.3 | M1 `economy-invariants`; D1 `shop-price` |
| G3.4 | D5 `recipes-bars` |
| G3.5 | C1 |
| G3.6 | U1; G-6 |
| G3.7 | P1 `save-compat-s3`; K1 (existing saves have no starter quest); G-5 step 7; G-6 (the owner's save) |
| G3.8 | E1; M1 (the model imports the game's functions and is pure, test 8; G-5 reads `pacingModel.ts` and confirms it contains no formula of its own) |
| G3.9 | P1 `content-freeze`; K1 (the starter table); G-5 steps 8 and 13 |
| G3.10 | K1 `starter-quests`, `tracker-order`; M1 test 1 (the chain played with the game's functions); G-6 |
| G3.11 | N3 `hidden-tools`; G-5 step 12; G-6 |
| G3.12 | I1 `entry-staff`; G-6 |

## 4.3 Decisions and CALLs to tasks

| Decision or CALL (design 12, 15) | Task |
|---|---|
| 3.1, 3.13, 3.15, 3.16 | no task; held by rules 0.3.6, 0.3.8 and G-5 steps 7 to 9 |
| 3.2, Q3.5: milestones as tasks, no minutes | M1, T1, rule 0.3.10, G-5 step 11 |
| 3.3, Q3.3: nothing in hand, quests pay the kit | N1, N2, K1, K2 |
| 3.4, Q3.2: 1x, booster hidden | N1, N2, N3, N4 |
| 3.5, Q3.1: tenfold shop price, with the forge recipe shown | D1, D2, U1, U2, T1 |
| 3.6 | D3 |
| 3.7, Q3.7: fishing empties on every catch | F0, D4, F1 |
| 3.8 | D5, D6 |
| 3.9 | no task (nothing is built) |
| 3.10 | no task (written deferral) |
| 3.11: gold cap, no stack cap in play | C1, C2 |
| 3.12 | U1, U2, N2 (onboarding text) |
| 3.14 | D3, M1 |
| 3.17, Q3.6: tracker order, one test replacement | K1, K2 |
| 3.18, Q3.9: the Hazel Staff | I1, I2, K2 |
| 3.19, Q3.8: cheats hidden | N3, N4, R1 |
| 3.20: existing saves see no starter chain | K1, K2 |
| Q3.4: hours to dragon, as information | M1 test 9 (printed) |
| Q3.10: the two thresholds | M1 (constants), T1 (must not change) |
| Q3.11: the 10x notice | N3, N4 |

---

# 5. Final verification

Run on `main` after the Stage 3 merge, from an allowlisted shell:

1. `systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 env TEST_CONCURRENCY=4 npx vitest run`: every test passes; none is skipped or `.todo`.
2. `systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 env TEST_CONCURRENCY=4 npx tsc --noEmit`: exit 0, no output.
3. `systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 env TEST_CONCURRENCY=4 npm run build`: exit 0; JS chunk within 10 kB of the P0 value.
4. `npm audit --audit-level=high`: exit 0.
5. The CI workflow is green on the merge commit.

What a person must look at in the running game: the list of G-6.

---

# 6. What this plan could not check

Nothing was run to write it: no test, no type check, no build. In particular:

- That every existing test stays green under these changes is argued by reading (design 9.3). G-5 step 1 is where it is first proven.
- The task texts name symbols as they are at `a8cad85` plus what Stage 2's branches show today (`rollMonsterHit` in `combat.ts`, `CAMPS` in `worldMap.ts`). Stage 2 is not finished; P0 records what is really there, and a task whose named symbol does not exist stops and reports.
- Whether agy accepts each [AGY] task as written. None contains security-sensitive content; all are data, small pure functions or small engine edits.
- Whether the task assertions hold on the merged Stage 2 world and in the committed model. The design's model passes them at every markup from 8 to 12 and the control fails them. The second pass reproduced its counts exactly with a TypeScript model that imports the game's tables, but from the same rule text, so a misreading of design 4.2 shared by both would not show. M1's dry run checks it before any data changes, and T1 re-checks it with a bounded knob and a stop rule.
- The starter chain's helper in M1 gathers by adding the item and the experience directly, because the real gather lives in the engine and needs the DOM. That it matches what a click does was read from `performResourceGather`, not run.
- F1 and N4 are checked headless only by reading their source text (F0, N3). That the cues sound and look right, and that the typed word reveals the block, rests on the opus verify reading the diff and on G-6.
- That `hidden` on the new block hides it: no stylesheet rule gives `#hidden-tools` a `display`, by a search of `src/ui/styles.css`. If the page shows it anyway, N4 needs one CSS rule and `styles.css` on its allowlist.
