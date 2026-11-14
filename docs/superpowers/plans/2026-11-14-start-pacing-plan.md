# Start and pacing: implementation plan

Date: 2026-11-14. Branch: `feat/start-pacing`. Design: `docs/superpowers/specs/2026-11-14-start-pacing-design.md` (called "the design" below; section numbers refer to it). Earlier documents this plan builds on: `docs/superpowers/specs/2026-11-13-world-foundation-design.md` ("the Stage 1-2 design") and `docs/superpowers/plans/2026-11-13-world-foundation-plan.md` ("the Stage 1-2 plan"). Source line numbers are at commit `a8cad85`.

The design is still a proposal. Nothing in this plan starts before owner step **O-13** and before Stage 2 is merged to `main` (section 0.5).

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
3. **Existing tests are frozen.** No edit to any file that exists under `tests/` or `src/__tests__/` when P0 records the baseline. That includes the 103 original tests, every Stage 1 test and every Stage 2 test. A new test goes in a new file under `tests/`. Stage 3 declares **no** planned test replacement: design 9.3 explains, test by test, why none is needed. If an existing test goes red, the change is wrong, not the test; stop and report to the main session.
4. **Test-first pairs.** A [CLAUDE] test task may leave the suite red until the [AGY] task that implements it lands on the same branch. Because `tsconfig.json` includes `tests/` and `npm run build` runs `tsc --noEmit`, a test file that imports a module or export the paired task has not written yet also makes TYPES and BUILD red. Allowed in that window: SUITE failures only in the new test files, and TYPES/BUILD errors only in the new test files and only because a module, export or field that the paired task adds does not exist yet. The opus verify of the test task lists them; any other error is a defect. The paired task's accept restores full SG. A branch reaches the main session only when it is green, with one declared exception: the pacing and invariant tests of M1 stay red from M1 until T1 (section 3.3). In that span "SG" means TYPES and BUILD pass and SUITE is red only in those two files.
5. **Commit kinds, never mixed.** *Move*: arithmetic leaves `actions.ts` for a pure module, unchanged (lane E). *Test*. *Data*: numbers in a table. *Rule*: new behaviour. *Docs*. A Move commit changes no number and no order of random draws; the opus verify checks it with `git diff --color-moved=dimmed-zebra -w HEAD~1` as review evidence.
6. **No new content** (design C3, G3.9): no new item, monster, node, recipe id, quest, prayer, spell or name. `tests/content-freeze.test.ts` (P1) enforces it.
7. **No new runtime dependency.** No change to `package.json` or `package-lock.json`.
8. **No formula edits.** The XP table, XP per action, the hit and damage formulas, the gather success formula, item `price` and `req`, coin drops and quest rewards do not change (design 3, anti-goals). Two rule changes are named exceptions and belong to one task each: fishing spots deplete on every catch (D4), and five Slayer bounties change (D3). A task that seems to need any other stops and reports.
9. Every commit message names its kind and task, and the audit finding where there is one: `move(E2): playerAttackProfile to state/combat`, `data(D3): gear drop rates`, `data(#9, D6): smithing takes bars`.

### 0.4 Branches, worktrees, lanes

- Stage 3 works on `feat/start-pacing`. Today that branch holds only the two documents. Task P0 rebases it onto `main` after the Stage 2 merge.
- The spine (P, E, D, M, C, R, T) runs on `feat/start-pacing` itself, one task after another: these tasks share `src/engine/actions.ts`, `src/data/catalog.ts` and `src/state/inventory.ts`.
- Two lanes share no file with the spine or with each other and may run in parallel worktrees, `../osrs-like-wp/sp-N` on branch `sp/N` and `../osrs-like-wp/sp-U` on `sp/U`, cut from the spine head after P1. They are local branches only and are never pushed.
- Run at most 3 agents at a time on this machine, with one BUILD at a time.

| Lane | Tasks | Files |
|---|---|---|
| Spine | P0, P1, E1-E3, D1-D2, M1, D3-D6, C1-C2, R1, T1 | `src/state/combat.ts`, `src/state/economy.ts` (new), `src/state/monsterAi.ts`, `src/state/inventory.ts`, `src/state/adventure.ts`, `src/state/cheats.ts`, `src/state/save.ts`, `src/engine/actions.ts`, `src/engine/loop.ts`, `src/data/items.ts`, `src/data/catalog.ts`, `src/data/world.ts`, `src/data/recipes.ts`, `src/ui/stations.ts`, `README.md`, new tests |
| N (new game) | N1, N2 | `src/state/gameState.ts`, `src/engine/session.ts`, `src/engine/runtime.ts`, `index.html`, `tests/new-game.test.ts` |
| U (unlocks) | U1, U2 | `src/state/unlocks.ts` (new), `src/ui/playerActions.ts`, `tests/unlocks.test.ts` |

Order on `feat/start-pacing`: P0, P1, E1-E3, D1-D2, then merge `sp/N`, then M1, D3-D6, then merge `sp/U`, then C1-C2, R1, T1. Lane N is merged before M1 because the pacing test starts from `createNewGameState()`; with it and D2 in place, M1's files type-check from the start.

Files that Stage 2 also edits (design 7.6): `src/engine/actions.ts`, `src/state/combat.ts`, `src/state/monsterAi.ts`, `src/engine/session.ts`, `src/engine/loop.ts`, `README.md`. That is why nothing starts before the Stage 2 merge.

### 0.5 Owner and human steps (where they block)

| Step | What the owner decides or does | Blocks |
|---|---|---|
| O-12 | Stage 2 accepted and merged to `main` (Stage 1-2 plan). | Everything |
| O-13 | Approve Stage 3: CALL-3.1 to CALL-3.16 and questions Q3.1 to Q3.4 of the design. | Everything |
| G-6 | [HUMAN] play and look (design 9.2). | O-14 |
| O-14 | Accept Stage 3. | The pull request |

If an owner answer takes an alternative, only the named task changes:

| Answer | Change |
|---|---|
| Q3.1 or CALL-3.14 refused: the five Slayer bounties stay as today | D3 drops its `adventure.ts` edit. In M1 the Slayer-route wait assertion becomes "at least 3 minutes from iron to mithril" (design CALL-3.14). |
| CALL-3.5 at another markup | D1 and D2 use that value (at 8: `rune_plate` 41600, `bronze_scimitar` 360). T1 still checks the windows and waits. |
| Q3.3: start with nothing | N1 and N2: `weapon: null`, and the first-run chat line and the onboarding item name no weapon. |
| Q3.2: move the 10x button | Not in this plan: it is a HUD layout change; record it for Stage 5. |
| CALL-3.4 refused (keep 10x for new games) | Stop. The design's curve cannot hold; return to the design. |
| CALL-3.7 refused (fishing stays as it is) | Stop D4 and return to the design: the alternative is a price change, which rule 8 forbids without a design amendment. |
| CALL-3.12 refused (no unlock messages) | Drop lane U. Lane N keeps the onboarding text. |

---

# Stage 3: Start and pacing

## 3.0 Prerequisites

### O-13 Approve Stage 3 [OWNER]
The owner approves or amends the CALLs of design section 12. An amendment changes only what the table in 0.5 names.

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
  - `content-freeze.test.ts`: `content-ids.golden.json` holds, captured now, the sorted ids and the `name` of every entry of `ITEMS`, `MONSTER_TYPES`, `RESOURCE_NODES_DEF`, `FORGE_RECIPES` (from `src/data/recipes.ts`), `QUEST_DEFS`, `PRAYERS` and `SPELLS`. Tests: `no id was added or removed` and `no name changed`, one per table. Same `UPDATE_GOLDEN=1` pattern.
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

## 3.2 Lane N: the new game (parallel worktree `sp/N`)

### N1 New-game tests [CLAUDE]
- **Tier**: sonnet (written from design 7.1 item 1 and G3.1).
- **Depends**: P1.
- **Files**: `tests/new-game.test.ts` (new).
- **Change**: tests against `createNewGameState()` from `src/state/gameState.ts`:
  - `a new game holds a bronze scimitar, three shrimp and 25 GP`: `equipment.weapon` is `bronze_scimitar`, the other nine slots are `null`, `inventory` deep-equals `[{ id: 'shrimp', qty: 3 }]`, `bank` is empty, `gp` is 25.
  - `a new game runs at 1x`: `xpMultiplier` is 1.
  - `everything else is the default`: with `gp`, `xpMultiplier`, `equipment` and `inventory` copied over from the default state, the serialised new-game state equals the serialised default state.
  - `it returns a fresh object each call` (mutating one does not change the next).
  - `a new game survives writeSave then readSave` with an in-memory `StorageLike`: same kit, `gp` 25, `xpMultiplier` 1.
  - `the default state is still its golden` (imports the P1 golden; a second guard in the file that the implementer will have open).
- **Accept**: red until N2.
- **Must not change**: `src/`.

### N2 New-game state and wiring [AGY]
- **Tier**: sonnet (fully specified).
- **Depends**: N1.
- **Files**: `src/state/gameState.ts`, `src/engine/session.ts`, `src/engine/runtime.ts`, `index.html`.
- **Change**: Rule commit.
  - `gameState.ts`: add `export function createNewGameState(): GameState`. It calls `createDefaultState()`, then sets `gp = 25`, `xpMultiplier = 1`, every `equipment` slot to `null` except `weapon = 'bronze_scimitar'`, and `inventory = [{ id: 'shrimp', qty: 3 }]`.
  - `session.ts`: add `export function startNewGame(): void { applyState(STATE, createNewGameState()); }`.
  - `runtime.ts`, in `boot()`: directly after `const hadSave = loadGameState();`, add `if (!hadSave) startNewGame();`. In the `else` branch of the `hadSave` chat block, after the existing movement line, add: `addChatMessage('You carry a <b>Bronze Scimitar</b>, three <b>Cooked Shrimp</b> and <b>25 GP</b>. Mine copper, smelt it and forge bronze armour at the <b>Anvil</b>, or earn coin from the goblins of Three Kettle Camp.', 'skill');`
  - `index.html`, the `onboard-list`: add two items after the existing four: `<li>You start with a <b>bronze scimitar</b>, three meals and a few coins. Everything else is earned.</li>` and `<li>First steps: mine <b>copper</b>, smelt and forge it at the <b>anvil</b>, and hunt the goblins of <b>Three Kettle Camp</b>.</li>`
  - "Three Kettle Camp" is a Stage 2 name. Use the `name` of the goblins' point of interest exactly as it stands in `POIS` in `src/data/worldMap.ts` after the Stage 2 merge (recorded by P0); if Stage 2 renamed it, use the new name in both texts.
- **Accept**: `ONE(tests/new-game.test.ts)` passes. `ONE(tests/save-compat-s3.test.ts)` passes with both goldens untouched. `ONE(tests/globals.test.ts)` passes. SG. `git diff` of `gameState.ts` shows only added lines after `createDefaultState`.
- **Must not change**: `createDefaultState`, `STATE`'s initialiser, `loadGameState`, the order of calls in `boot()` other than the one inserted line, any `onclick` in `index.html`.

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

### M1 Pacing model and invariant tests [CLAUDE]
- **Tier**: opus. The model is the proof of the stage (design G3.2, G3.8); choosing what it assumes and what the invariants assert is judgment, and everything later is trusted against it.
- **Depends**: D2, and `sp/N` merged.
- **Files** (new): `tests/support/pacingModel.ts`, `tests/pacing.test.ts`, `tests/economy-invariants.test.ts`.
- **Change**:
  - `pacingModel.ts` implements design 4.2 against the live code. It must not contain a hit, drop or gather formula of its own: it calls `playerAttackProfile`, `playerHitChance`, `monsterHitChance`, `gatherChance`, `getEquipmentBonuses`, `combatLevel`, `monsterThreatColor`, `unitSellPrice`, `getLevelForXp`, and reads `MONSTER_TYPES`, `CAMPS`, `NODE_PLACEMENTS`, `RESOURCE_NODES_DEF`, `FORGE_RECIPES`, `SLAYER_BANDS`, `QUEST_DEFS`, `ITEMS`, `ATTACK_INTERVAL`, `DYING_SECS`, `DEAD_SECS`, `HP_REGEN_PER_SEC` and `TICK_SEC`.
    - `simulate(opts): { kitAt: Record<Tier, number>; levelAt: Record<Tier, number>; killsByType: Record<string, number>; income: { coins: number; gear: number; slayer: number; quests: number } }` with `opts = { start: () => GameState; xpMultiplier: number; priceOf: (item) => number; useShop: boolean; useDrops: boolean; useSlayer: boolean; useQuests: boolean }`. It works on a real `GameState` (skills, equipment, `gp`), on the controlled style, with the policy, kit table, timings and "can win" rule of design 4.2. Monster count per type and attackers come from `CAMPS`: attackers are the members of that type's largest aggressive camp when `monsterThreatColor(level, combatLevel(state))` is not `green`, otherwise 1. Expected drops come from the tables: each entry's chance times its value; a kit piece is obtained when its expected count reaches 1. Slayer bounties come from `SLAYER_BANDS` (bounty over count, plus 10 s per task). A guard stops a run at 400 simulated hours.
    - `siteSize(nodeKey)`: the largest group of `NODE_PLACEMENTS` of that type in which each node is within 15 units of another (design 4.2). `gatherSeconds(nodeKey, level)` uses it as the node count. `gatherGpPerHour(nodeKey, level)` (cooked value for fish), `smithRouteSeconds(tier)` (design 4.5 and 7.1 item 5: mine the best ore for the levels still missing, smelt and forge everything, stop when the tier's three recipes and its ore are unlocked, then mine the kit's bars), and `saleRatio(recipe)` (sale value of the output quantity over the sale value of the direct inputs).
  - `pacing.test.ts`, with the windows of design section 5 as one constant table:
    - `shop-only route at 1x wears every tier inside its window` (A1: `start: createNewGameState`, `priceOf: shopPrice`, no drops, no Slayer, quests on)
    - `shop, drops and Slayer route at 1x wears every tier inside its window` (A3)
    - `no tier is worn before its level gate`
    - `without Slayer the kit comes 10 to 30 minutes after the level, from iron to adamant` (A1)
    - `with Slayer the kit comes at least 3 minutes after the level at iron and steel and at least 10 at black and mithril` (A3). These two are what tells the new economy from today's: with today's prices, drops and bounties the wait is 2 minutes everywhere and the window tests alone would pass (design 5).
    - `the smithing route wears bronze, iron, mithril and rune inside their windows` (level gate of A1 plus `smithRouteSeconds`)
    - `at 10x, from iron to rune, the kit is worn no earlier than 1.5 times the level gate`
    - `prints the table`: logs kit and level times for A1 and A3 at 1x and 10x, kills by type and income by source. It asserts nothing; it is what a person reads when a window fails.
  - `economy-invariants.test.ts` (design G3.3):
    - `no recipe's output sells for more than 2.5 times its inputs`, with one listed exception, `fletch_shortbow`, and the reason in a comment (pinned by `tests/phase1.test.ts`).
    - `shopPrice is never below unitSellPrice` over every item, and `shopPrice equals price for runes, ammunition, food and potions`.
    - `equipment costs GEAR_MARKUP times its list price`.
    - `no fishing spot earns more than 1.5 times the best rock or tree of a comparable level`: cooked-fish GP per hour against the best mining or woodcutting node whose requirement is at most 10 levels higher, at the spot's requirement and 21 levels above it.
    - `every non-boss equipment drop chance is at most 0.02`, and `the boss's is at most 0.05`.
    - `bronze armour needs no gold`: a copper rock stands in the start region outside every aggressive camp; on a new-game state given five copper ore, `performCraft` succeeds for `smelt_bronze` five times, then `smith_bronze_legs`, then `smith_bronze_plate` (the five smelts give the 83 XP that Smithing 2 needs at 1x).
  - **One-time reproduction, before any data changes.** The verify of this task runs `simulate` once with today's start (`createDefaultState`, `priceOf: item.price`, quests off, drops on) at 10x and 1x, with and without Slayer, and writes the four rows into the P0 baseline file next to design table 4.3's rows T1, T2, T3 and T4. Stage 2's real camps are in force, so compare with T3 and T4. A kit time more than 20% away from the design's row is reported to the main session before lane D starts: it means the design's numbers, produced by a script nobody else has run, do not hold.
- **Accept**: TYPES and BUILD pass. The reproduction rows are in the baseline file. `ONE(tests/pacing.test.ts)` and `ONE(tests/economy-invariants.test.ts)` are red, and the verify lists which assertions fail with the tables as they are after D2; by design sections 4 and 5 that should be the two wait tests (gear still drops one kill in five and bounties are full), possibly some window tests, the 2.5 rule (gilded, bows, rune smithing), the fishing bound (trout, lobster, shark), the drop-chance bound and `bronze armour needs no gold` (recipes still take ore). The three `shopPrice` assertions pass.
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

- **Accept**: in `tests/economy-invariants.test.ts` the two drop-chance assertions pass. `ONE(tests/economy-rolls.test.ts)` still passes (its goblin cases use rolls of 0 and 0.999, which do not depend on the chance values). `ONE(tests/content-freeze.test.ts)` passes. `ONE(tests/phase2.test.ts)` passes unchanged. The opus verify reads the diff and finds 23 changed drop chances, 5 changed bounties and nothing else.
- **Must not change**: coin ranges, bones, food, arrows, monster stats, the goblin bounty, Slayer counts and experience.

### D4 Fishing spots deplete on every catch [AGY]
- **Tier**: sonnet (one condition and four numbers).
- **Depends**: D3.
- **Files**: `src/engine/actions.ts`, `src/data/catalog.ts`.
- **Change**: Rule commit. In `performResourceGather`, the block guarded by `if (def.kind !== 'fish' || Math.random() < 0.35)` runs after every successful gather: remove the condition, keep the body. In `RESOURCE_NODES_DEF`, set `respawn` to 6000 for `fish_shrimp`, 3000 for `fish_trout`, 7000 for `fish_lobster` and 8000 for `fish_shark`.
- **Accept**: in `tests/economy-invariants.test.ts`, `no fishing spot earns more than 1.5 times the best rock or tree of a comparable level` passes. Stage 2's `ONE(tests/world-data.test.ts)` and `ONE(tests/placements.test.ts)` pass unchanged. `grep -n "0.35" src/engine/actions.ts` prints nothing.
- **Must not change**: `gatherChance`, any other node's respawn, XP, the depleted-mesh handling.

### D5 Recipe tests [CLAUDE]
- **Tier**: sonnet (written from design 7.1 item 5 and G3.4).
- **Depends**: D4.
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
- **Accept**: `ONE(tests/recipes-bars.test.ts)` passes. In `tests/economy-invariants.test.ts`, the 2.5 rule and `bronze armour needs no gold` pass. `ONE(tests/phase1.test.ts)`, `ONE(tests/phase2.test.ts)`, `ONE(tests/phase3-content.test.ts)`, `ONE(tests/rule-fixes.test.ts)` and `ONE(tests/content-freeze.test.ts)` pass unchanged.
- **Must not change**: recipe ids, names, XP, outputs, cooking recipes, `fletch_shafts`, `craft_wood_shield`, `fletch_bronze_arrows`, `tryCraft`.

---

## 3.4 Lane U: unlock messages (parallel worktree `sp/U`)

### U1 Unlock tests [CLAUDE]
- **Tier**: sonnet (written from design 7.1 item 7 and G3.6).
- **Depends**: P1.
- **Files**: `tests/unlocks.test.ts` (new).
- **Change**: tests against `src/state/unlocks.ts`:
  - `unlocksAt(skill: string, level: number): { kind: 'gear' | 'recipe' | 'node' | 'prayer' | 'spell'; name: string }[]`: gear is every equip item whose `req[skill] === level`; recipes are `FORGE_RECIPES` with that `skill` and `req`; nodes are `RESOURCE_NODES_DEF` with that `skill` and `req`; prayers only for `prayer`; spells only for `magic`. Order: gear, recipes, nodes, prayers, spells, each in table order.
  - Cases: `('attack', 5)` contains `Iron Scimitar`; `('mining', 10)` contains `Iron Ore Vein`; `('smithing', 9)` contains `Forge Iron Platebody`; `('prayer', 30)` contains `Protect from Melee`; `('magic', 12)` contains `Fire Bolt`; `('attack', 6)` is empty; `('nonsense', 5)` is empty.
  - `unlockLine(skillName: string, level: number, unlocks): string | null`: `null` for an empty list; for three or fewer, `Level 5 Attack unlocks: <b>Iron Scimitar</b>.` with names joined by `, `; for more, the first three then ` and N more.`
  - `every name comes from a data table`: each returned name is the `name` of an entry in `ITEMS`, `FORGE_RECIPES`, `RESOURCE_NODES_DEF`, `PRAYERS` or `SPELLS`.
- **Accept**: red until U2.
- **Must not change**: `src/`.

### U2 Unlock module and chat line [AGY]
- **Tier**: sonnet (fully specified).
- **Depends**: U1.
- **Files**: `src/state/unlocks.ts` (new), `src/ui/playerActions.ts`.
- **Change**: Rule commit. `unlocks.ts` exports `unlocksAt` and `unlockLine` as U1 states and imports only from `src/data`. In `grantXp`, inside the `if (s.lvl > oldLvl)` block after the existing level-up chat line: for each level from `oldLvl + 1` to `s.lvl`, `const line = unlockLine(meta.name, level, unlocksAt(skillKey, level)); if (line) addChatMessage(line, 'skill');`.
- **Accept**: `ONE(tests/unlocks.test.ts)` and `ONE(tests/architecture.test.ts)` pass. SG.
- **Must not change**: XP arithmetic, the level-up banner, sounds, `requestUiRefresh`.

---

## 3.5 Caps and README (spine, after the lanes are merged)

### C1 Cap tests [CLAUDE]
- **Tier**: sonnet (written from design 7.1 item 6 and G3.5).
- **Depends**: D6, and `sp/U` merged.
- **Files**: `tests/gp-cap.test.ts` (new).
- **Change**: with `MAX_GP` and `MAX_STACK` imported from `src/state/economy.ts`:
  - `creditGp adds, and stops at MAX_GP`; `creditGp never goes below 0` (a negative amount larger than the purse); `creditGp ignores NaN and Infinity` (the purse is unchanged); it returns the amount actually credited.
  - `selling at the cap is refused and removes nothing`: `gp = MAX_GP - 10`, sell one `rune_plate`: `ok` false, reason `Your coin pouch is full.`, the item still in the backpack.
  - `a full stack refuses one more`: an `air_rune` stack of `MAX_STACK`: `canAddItem` false; `addItem` adds 0; `buyItem` of 10 is refused with `You cannot carry more of that.` and charges nothing; `withdraw` of 5 from the bank is refused and the bank keeps them; with `MAX_STACK - 3` in the backpack, `buyItem` of 10 buys 3 and charges for 3.
  - `a full bank stack refuses a deposit` and the backpack keeps the items.
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
  - `inventory.ts`: `canPlace` for a stackable item with an existing stack returns `existing.qty + qty <= MAX_STACK`. `place` for an existing stack adds `min(qty, MAX_STACK - existing.qty)` and returns that; a new stack holds `min(qty, MAX_STACK)`. `compactSlots` uses `MAX_STACK` in place of the literal. `buyItem`, for a stackable item: `want = min(want, MAX_STACK - countIn(state.inventory, itemId))` before the `canPlace` check, and a `want` of 0 from that limit returns reason `You cannot carry more of that.`. `buyRunePack` is refused with the same reason when any rune stack lacks room for `qty`. `sellItem`: compute `gp = unit * n` first; when `state.gp + gp > MAX_GP` return `{ ok: false, moved: 0, reason: 'Your coin pouch is full.' }` before removing anything; otherwise remove and `creditGp`. `withdraw` and `deposit` already return their "full" reasons when `canPlace` is false.
  - `adventure.ts`: `claimQuest` and `registerKill` use `creditGp`. `cheats.ts`: `applyGold200k` uses `creditGp`. `save.ts`: the `gp` clamp uses `MAX_GP`. `actions.ts`, `handleMonsterDeath`: the coin result uses `creditGp(STATE, amount)`.
  - `economy.ts` still imports only `src/data` and types; `inventory.ts`, `adventure.ts`, `cheats.ts` and `save.ts` import from it. Check there is no import cycle: `economy.ts` must not import `inventory.ts` or `adventure.ts`.
- **Accept**: `ONE(tests/gp-cap.test.ts)` passes. `ONE(tests/cheats.test.ts)`, `ONE(tests/phase2.test.ts)`, `ONE(tests/save-hardening.test.ts)`, `ONE(src/__tests__/bulk-buy.test.ts)`, `ONE(src/__tests__/bulk-sell.test.ts)` and `ONE(tests/save-compat-s3.test.ts)` pass unchanged. `ONE(tests/architecture.test.ts)` passes.
- **Must not change**: behaviour below the cap. Every existing test of buying, selling, banking, quests and cheats is the guard.

### R1 README [CLAUDE]
- **Tier**: sonnet (doc sync to code).
- **Depends**: C2.
- **Files**: `README.md`.
- **Change**: Docs commit. Correct the feature list and tables for: the new start (a bronze scimitar, three cooked shrimp, 25 GP, 1x experience; the 10x option is in Settings); shop equipment at ten times list price while selling stays at 65% of list, and a sentence that gear and gold already owned are kept; rare gear drops; fishing spots that deplete; smelting bars before forging; bows that take several logs. Do not add a name the game does not already use.
- **Accept**: SG (`tests/credits.test.ts` still passes). The opus verify checks each sentence against the merged code.
- **Must not change**: the credits section, licence text, links.

---

## 3.6 Tuning and gate

### T1 Run the model on the real world and tune [CLAUDE]
- **Tier**: opus (tuning data against a test, and judging whether the result is still the design).
- **Depends**: R1.
- **Files**: `src/data/items.ts` (only the value of `GEAR_MARKUP`), `src/data/catalog.ts` and `src/data/world.ts` (only the drop chances of D3), `docs/superpowers/specs/2026-11-14-start-pacing-design.md` (tables 4.3, 5 and 6.1 and section 14 only), `docs/superpowers/baseline/2026-11-14-stage3-baseline.md`.
- **Change**: run `ONE(tests/pacing.test.ts)` and `ONE(tests/economy-invariants.test.ts)`.
  - If both pass: copy the printed table into the baseline file. Replace the numbers in design tables 4.3 (rows A1, A3, S and the 10x row), 5 and the "10" row of 6.1 with the committed model's numbers, and change the sentence under "How the numbers were produced" and section 14 to say that these rows now come from the committed test.
  - If a window or a wait assertion fails: tune, in this order and no further. (1) `GEAR_MARKUP`, an integer from 8 to 12. (2) The non-boss gear drop chances of D3, all scaled by one common factor between 0.5 and 2 (so 0.004 to 0.024). Choose the smallest change from the design's values that passes every assertion on both routes. Record every value tried and its table in the baseline file. Then update the design tables as above, and state the changed constant in design 7.1 and CALL-3.5 or CALL-3.6.
  - If the fishing bound fails (Stage 2 moved fishing spots, so site sizes may differ): tune only the four fishing `respawn` values of D4, each between 2000 and 10000, so that the bound holds and no spot earns less than a third of the best rock or tree of equal or lower requirement. `src/data/catalog.ts` is on the allowlist for that too.
  - There is no knob for the smithing route, for the 2.5 rule, or for `bronze armour needs no gold`. If one of them fails, or no value in the ranges above passes, or a test can only pass by moving a window or a wait bound: stop. Write what was tried in the baseline file and return to the main session. The windows and the waits are the owner's CALL-3.2 and are not tuned here.
- **Accept**: SG, with no red test anywhere. The baseline file holds the final table.
- **Must not change**: the window table and the wait bounds in `tests/pacing.test.ts`, the bounds in `tests/economy-invariants.test.ts`, any formula, any other data.

### G-5 Stage 3 verification [CLAUDE]
- **Tier**: opus (verification).
- **Depends**: T1.
- **Files**: none (read-only; a written report in the session).
- **Check**:
  1. SUITE: all pass. `git diff main --stat -- tests src/__tests__` lists only added files; no file that existed at P0 is modified.
  2. TYPES: clean.
  3. BUILD: the JS chunk is within 10 kB of the P0 value.
  4. `npm audit --audit-level=high` exits 0. `git diff main -- package.json package-lock.json` is empty.
  5. Every goal G3.1 to G3.9 maps to a passing test (section 4.2 below).
  6. Audit finding 9 and the Stage 1 review finding on caps are closed (D6, C2).
  7. `git diff main -- src/state/gameState.ts` shows `createDefaultState` untouched; `git diff main -- src/state/save.ts` shows only the `MAX_GP` import and its use; `serializeState` and `migrateLegacySave` are otherwise unchanged.
  8. `git diff main -- src/data/catalog.ts` changes no `price`, `req` (outside the two gilded recipes), monster stat, coin range, XP value or name. `src/data/skills.ts` is unchanged. `git diff main -- src/state/adventure.ts` changes five `bountyGp` values, the two `creditGp` calls and nothing else.
  9. `git diff main --stat` lists only files on some task's allowlist.
  10. No commit on the branch carries an attribution trailer.
- **Accept**: a written pass.
- **Must not change**: anything; the task is read-only.

### G-6 Stage 3 human checks [HUMAN]
Design 9.2:
- A new game: one scimitar worn, three shrimp, 25 GP, the experience button reads 1x, the onboarding card and first chat lines describe the start.
- Thirty minutes of play without cheats, noting the minute at which bronze armour, the iron kit and the steel kit are worn. Expected: bronze inside 16 minutes, iron inside 50. Record the times in the baseline file; they are the only measurement of the "about twice the model" assumption.
- The shop: the card, the buy button and the tooltip show the marked-up price; buying charges it; selling pays what it paid before; runes and arrows cost what they cost before.
- Fishing: the spot empties after a catch and returns after about six seconds, and that reads acceptably.
- The forge: smelt copper, forge bronze platelegs and platebody, equip them; forging from ore alone is refused with the bar named.
- Reaching Attack 5 prints the unlock line.
- The owner's own save from before the stage loads with position, gear, bank, gold, multiplier and quests as they were.
- `gold200k` and `skills10` still work.
- The smoke list of the Stage 1-2 design 5.7, once.

### O-14 Accept Stage 3 [OWNER]
The owner reviews G-5 and G-6 and accepts. The main session opens the pull request to `main` and merges after CI is green.

---

# 4. Coverage

## 4.1 Findings to tasks

| Finding (design 4.6, 10) | Task |
|---|---|
| F1 start kit | N1, N2 |
| F2 10x by default | N1, N2 |
| F3 gear drops | D3, M1 |
| F4 shop prices never bind | D1, D2, M1, T1 |
| F5 crafting prints money | D5, D6, M1 |
| F6 fishing | D4, M1 |
| F7, audit finding 9: bars are dead ends | D5, D6 |
| F8, Stage 1 review: caps only on load | C1, C2 |
| F9 free sustain | deferred to Stage 4 (design 7.2) |
| F10 Slayer income | D3 (five bounties), M1 (the wait test) |
| F11 low-requirement strong items | D2 (price); requirements left alone (design 7.4) |
| F12 giants plateau | deferred to Stage 6 (design 7.5); printed by M1 |
| F13 the dragon's drops / its respawn | D3 / deferred to Stage 4 |
| F14 tiers without recipes | deferred to Stage 6 |
| Audit finding 6, second half | D6, M1 (the 2.5 rule) |

## 4.2 Goals to proofs

| Goal | Proof task(s) |
|---|---|
| G3.1 | N1; P1 (default golden) |
| G3.2 | M1 `pacing`, T1 |
| G3.3 | M1 `economy-invariants`; D1 `shop-price` |
| G3.4 | D5 `recipes-bars` |
| G3.5 | C1 |
| G3.6 | U1; G-6 |
| G3.7 | P1 `save-compat-s3`; G-5 step 7; G-6 (the owner's save) |
| G3.8 | E1; M1 (the model imports the game's functions; G-5 reads `pacingModel.ts` and confirms it contains no formula of its own) |
| G3.9 | P1 `content-freeze`; G-5 step 8 |

## 4.3 CALLs to tasks

| CALL | Task |
|---|---|
| 3.1, 3.13, 3.15, 3.16 | no task; held by rule 0.3.8 and G-5 steps 7 to 9 |
| 3.14 | D3, M1 |
| 3.2 | M1 (the window table), T1 |
| 3.3, 3.4 | N1, N2 |
| 3.5 | D1, D2, T1 |
| 3.6 | D3 |
| 3.7 | D4 |
| 3.8 | D5, D6 |
| 3.9 | no task (nothing is built) |
| 3.10 | no task (written deferral) |
| 3.11 | C1, C2 |
| 3.12 | U1, U2, N2 (onboarding text) |

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
- Whether agy accepts each [AGY] task as written. None contains security-sensitive content; all are data or small pure functions.
- Whether the windows hold on the merged Stage 2 world. That is T1's job, with a bounded knob and a stop rule.
