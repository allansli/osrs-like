# Content and systems: implementation plan

Date: 2026-11-14. Branch: `feat/content-systems`. Design: `docs/superpowers/specs/2026-11-14-content-systems-design.md` (called "the design" below; section numbers refer to it). Data: `docs/superpowers/research/content-model/content.ts` (called "the content file"): every row a data task adds is written there, and a task that says "as the content file" copies those rows without changing a number or a name. Earlier documents this plan builds on: the foundation design and plan (`2026-11-13-world-foundation-*`), and the approved designs of Stage 3 (start and pacing), Stage 4 (combat with weight) and Stage 5 (visual pass). Source line numbers are at commit `5caa597`.

The design is a proposal. Nothing in this plan starts before owner step **O-6.1**, and before Stages 3, 4 and 5 are merged to `main` (section 0.5). The first task, **R0**, re-checks every premise the design takes from those three stages and stops the stage if one fails.

---

## 0. Conventions

These are the conventions of the earlier plans, restated so this plan can be read alone. Where a rule is new for Stage 6 it says so.

### 0.1 Task tags and tiers

- **[AGY]**: the task is specified fully enough to hand to the agy backend through `/agy-implement` (one worktree) or `/agy-parallel` (several lanes). It always runs in three stages: a **haiku** stage runs the `agy -p` command and returns the diff stat, test output and exit status; a **sonnet** stage implements the task only if agy failed or refused, and records that it did; an **opus** stage (a [CLAUDE] verify) checks the diff against the task's allowlist, runs the acceptance check, and looks for weakened or deleted assertions and for edits to [CLAUDE] tests. On an [AGY] task, "Tier" names the tier that does the work if agy fails. The verify stage is always opus and is part of the task.
- **[CLAUDE]**: tests that define acceptance, the premise re-check, tuning against a test, every piece of written content (dialogue, journal text, quest text), governance text, and every verification. Tests that define acceptance for an [AGY] task are their own [CLAUDE] task and come first.
- **[OWNER]** and **[HUMAN]**: a decision only the owner can make, or something a person has to look at in the running game. These are not agent tasks.
- Agents never merge, tag, push or open pull requests. The main session merges after verification. No commit carries an AI attribution trailer (owner's global rule).
- Tiers used in this plan: haiku for running agy; sonnet for tests written from a stated spec, for fully specified implementation and for doc sync; opus for the premise re-check (R0), the fight tests and their tuning (B1 to B3), the written content (Q6, Z5, K4, N4, U3) and every verify. No task needs a higher tier: the design is done and each task is bounded.

### 0.2 Commands

Run every command from the worktree root, in a shell started with an allowlisted environment, so that no token reaches a test process: `env -i HOME="$HOME" PATH="$PATH" XDG_RUNTIME_DIR="$XDG_RUNTIME_DIR" DBUS_SESSION_BUS_ADDRESS="$DBUS_SESSION_BUS_ADDRESS" bash`.

| Name | Command | Expected |
|---|---|---|
| SUITE | `systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 env TEST_CONCURRENCY=4 npx vitest run` | exit 0; every test passes, including every test that exists when R0 records the baseline |
| ONE(file) | `systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 env TEST_CONCURRENCY=4 npx vitest run <file>` | as stated in the task |
| TYPES | `systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 env TEST_CONCURRENCY=4 npx tsc --noEmit` | exit 0, no output |
| BUILD | `systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 env TEST_CONCURRENCY=4 npm run build` | exit 0; the JS chunk size is reported |
| MODEL | `bash docs/superpowers/research/content-model/run.sh` | exit 0; `results.txt` ends with `ALL CHECKS PASS`, `check-results.txt` with `EVERY BOUND HOLDS` |
| ECON | `ONE(tests/pacing.test.ts)` and `ONE(tests/economy-invariants.test.ts)` (Stage 3's, unedited) | both pass |

**Standard gate (SG)**: SUITE, TYPES and BUILD all pass. Every task below ends with SG unless it says otherwise. A wrapper OOM kill means a defect to fix. Never raise the cap.

**Slice gate**: SG, ECON and MODEL pass, then the slice's [HUMAN] check. A slice reaches the owner only after its gate.

### 0.3 Rules that apply to every task

1. **Allowlist.** A task touches only the files listed for it. The opus verify rejects a diff with any other file in it.
2. **Line numbers go stale.** Three stages land between `5caa597` and the first task. Every task names the symbols it changes; find them by name. R0 records their current lines.
3. **Existing tests are frozen.** No edit to any file that exists under `tests/` or `src/__tests__/` when R0 records the baseline: the 103 original tests and every test of Stages 1 to 5. A new test goes in a new file under `tests/`. Stage 6 declares the replacements of design 11.3 and no other: the declared-additions lists of `tests/content-freeze.test.ts` (D1, Z3, K1, N1, U1, A1, each adding exactly the ids its slice adds); the two Stage 3 save goldens, regenerated once per new skill (K1, N1); the overworld monster count of `tests/world-budget.test.ts` (D3). If R0 finds a Stage 4 or Stage 5 test that pins a number of skills, commands or interactive actions, it names it and the owner is asked before any code. If any other existing test goes red, the change is wrong, not the test: stop and report.
4. **Test-first pairs.** A [CLAUDE] test task may leave the suite red until the [AGY] task that implements it lands on the same branch. Allowed in that window: SUITE failures only in the new test files and in the one frozen file the test task is authorised to edit; TYPES and BUILD errors only in the new test files and only because a module, export, field or union member that the paired task adds does not exist yet. The opus verify of the test task lists them. The paired task's accept restores full SG.
5. **Commit kinds, never mixed.** *Test*. *Data*: rows in a table. *Rule*: a pure module under `src/state`. *Engine*. *UI*. *Text*: dialogue and quest wording. *Docs*. Every commit message names its kind and task: `test(Q1): dialogue rules`, `data(D2): coal, steel, blacksteel`, `rule(Z2): zone walk and dungeon run`.
6. **Content comes from the content file.** Every id, name and number of a data task is in `docs/superpowers/research/content-model/content.ts` or in the design's tables. A task that seems to need another name or number stops and reports. New ids are added to the declared lists of the freeze test by the test task of the same slice, never by the data task.
7. **No formula edits.** The XP table, the XP of existing actions, the hit and damage formulas, the price, requirement and stats of existing items, existing recipes' inputs, existing monsters' stats, `QUEST_DEFS`, `STARTER_QUESTS` and every existing quest's reward do not change. One named exception: `ammoForWeapon` (A2).
8. **Pure rules.** A new module under `src/state` takes time and randomness as parameters and never calls `Math.random`, `Date.now` or `performance.now`. `src/state` and `src/data` import nothing from the engine or the UI and contain neither of the two words the architecture test forbids, in code, comments or strings: say "the log" or "the panel" in text.
9. **No save string as markup.** New UI modules write text with `textContent`. No new `innerHTML` assignment takes a value that came from the save or from a dialogue table. No inline handler attribute is added to `index.html`.
10. **No new runtime dependency.** No change to `package.json` or `package-lock.json`.
11. **No test asserts a time of play** (owner, Stage 3). Fight tests assert win rates over seeds; pacing is stated in actions. Durations that are game data (a wind-up, a respawn) may be checked.
12. **One slice at a time on the spine.** At most 3 agents at once on this machine, one BUILD at a time.

### 0.4 Branches and lanes

- Everything runs on `feat/content-systems`, one slice after another: the slices share the data tables (`extras.ts`, `recipes.ts`, `world.ts`), `save.ts` and the engine's interaction code.
- Inside slice 2, two lanes share no file and may run in parallel worktrees after Q5: lane **E** (engine: Q7) at `../osrs-like-wp/cs-E` on `cs/E`, and lane **U** (interface: Q8, Q9) at `../osrs-like-wp/cs-U` on `cs/U`. Inside slice 3, Z6 (engine) may run beside Z4 (data). They are local branches and are never pushed.
- Each slice ends with its gate and a pull request only the main session opens.

### 0.5 Owner and human steps (where they block)

| Step | What the owner decides or does | Blocks |
|---|---|---|
| O-6.0 | Stages 3, 4 and 5 accepted and merged to `main`. | Everything |
| O-6.1 | Approve Stage 6: the CALLs of design section 15 and the names of design 7.10. | Everything |
| O-6.1b | Only if R0 reports a failed premise: decide how the design changes. | Everything after R0 |
| H-n | [HUMAN] the play check at the end of slice n (design 11.2). | The slice's pull request |
| O-6.2 | [HUMAN] a web search for each new name. | The first pull request that carries the name |
| O-6.3 | Accept Stage 6, or stop after any slice. | Nothing after it |

If the owner answers a CALL with the alternative, only the named task changes:

| Answer | Change |
|---|---|
| CALL-6.8: no ammunition tiers | Slice 8 is not built. Nothing else changes; the diary has no task that reads it. |
| CALL-6.7: equal damage wanted | Return to the design: it is a stage of its own. Slices 0 to 7 are unaffected. |
| CALL-6.5: a daily chest | Return to the design: a saved time and its reader rule (as `bossDownUntil`), Z1 and Z2 change. |
| CALL-6.4: save the run | Return to the design. |
| CALL-6.18: dungeon monsters keep the open-ground rule | Z1 and Z2 drop `ignoresLevel`; Z7 does not set it. The rooms then ignore most heroes who can enter; the doors' levels stay. |
| CALL-6.3: only Crafting | Slice 5 keeps chapters 4 and 5 without the binding stage and drops N1 to N3; the diary's woods rows change (Y3). |
| CALL-6.6: no perks | Y2 and Y5 drop `perks`; Y1 drops its cases. Embers stay. |
| CALL-6.2: existing saves see the chain | Return to Stage 3's design, which decided it. |
| CALL-6.10: wait for models | Slices 3 and 6 wait for the models pass; slices 0, 1 (without Marrowjaw), 2, 4, 5 (without the dungeon stages), 7 are built. |
| CALL-6.12: keep the silent behaviour | F3 and F4 keep the three copies and the guarded write and drop the hold and the notice. |
| CALL-6.13: monsters inside the ridge | D3 and D4 take new coordinates from a re-run of MODEL; the task stops if no spot passes. |
| CALL-6.14: count from the moment a quest is taken | Return to the design: a tally per quest in the save. |
| CALL-6.16: the owner writes the text | Q6, Z5, K4, N4, U3 deliver the trees with placeholder lines marked as such; the data tests are the same. |
| Other names | The data task uses them; the freeze lists and the names test pin them. |

---

# Stage 6: Content and systems

## 6.0 Slice 0: foundation

### O-6.1 Approve Stage 6 [OWNER]
The owner approves or amends the CALLs of design section 15 and the names. An amendment changes only what the table in 0.5 names.

### R0 Premise re-check and baseline [CLAUDE]
- **Tier**: opus (it decides whether the design still stands on the merged code).
- **Depends**: O-6.0, O-6.1.
- **Files**: `docs/superpowers/baseline/2026-11-14-stage6-baseline.md` (new); `docs/superpowers/research/content-model/*` (the overlays replaced by imports, the outputs regenerated).
- **Change**: rebase `feat/content-systems` onto `main`. Run SG and ECON. Then, in the baseline file:
  1. Record the number of test files and tests, the JS and CSS chunk sizes, and the current line of every symbol the design cites.
  2. **Names assumed from Stage 3.** Confirm each exists with the shape the design uses, or record the difference: `createNewGameState`, `STARTER_QUESTS`, `STARTER_ARRIVAL`, `starterView`, `claimQuest` reading both quest tables, the order of `adventureTracker`, `shopPrice`, `GEAR_MARKUP`, `creditGp`, `MAX_GP`, `rollDrops`, `gatherChance`, `HP_REGEN_PER_SEC`, `unlocksAt`, `forgeHint`, `playerAttackProfile`, `playerHitChance`, `monsterHitChance`; the tests `pacing.test.ts`, `economy-invariants.test.ts`, `content-freeze.test.ts` (and how it declares additions), `save-compat-s3.test.ts` with its two goldens, `starter-quests.test.ts`, `tracker-order.test.ts`; `tests/support/pacingModel.ts` and `starterChain.ts`; that forging recipes take bars, that gear drops and fishing respawns are Stage 3's.
  3. **Names assumed from Stage 4.** `src/data/attacks.ts` with `AttackDef`, `ATTACKS`, `PATTERNS`, `BossDef`, `BOSSES`; `MonsterDef.pattern`, `.model`, `.tint`, `.modelScale`; `CampDef.arenaRadius`; `StepWorld.grid`, `.pathBudget`, `.windupGate`; the optional walk test of `moveWithCollision` and whether it still clamps to ±118 when given one; `findPath`'s `maxExpanded`; `segmentWalkable` and `openStart` exported; a boss's `respawnSecs` and how `createMonsterLogic` receives it; the events `windup`, `resolve`, `cancel`, `phase`; `src/state/sustain.ts` with `buyVow`, `vowPrice`, `applyDeathLoss`, `deathLoss`; `quests.lanternVow`; `src/state/commands.ts` with `PlayerCommand` and `applyCommand`; the engine's `dispatchCommand`; a monster's stable `id`; `isBossLoot` true for a type with a `BOSSES` row; the rows `saltback_stalker`, `thornwatch_marksman`, `ashmantle`; the ids and coordinates of their camps; the name and exports of the fight model its plan task B3 put under `tests/support`.
  4. **Names assumed from Stage 5.** The class names of its panel, button, tab and modal; whether CALL-V13 was taken (`data-action` and no inline handlers) and the delegation function; the token names; the table of woods-tree cells and how the walk grid reads it; the module that owns fog and sky.
  5. **Frozen counts.** Every existing test that pins a count this stage changes: skills, monster types, overworld monsters, recipes, items, commands, interactive actions. Compare with design 11.3; anything not declared there is reported under O-6.1b.
  6. **The model on the real code.** In the content file, delete the `S3` and `S4_MONSTERS` overlays and read the game's own tables; replace `fight.ts` and `boss.ts` by imports of Stage 4's fight model; add Stage 4's two camps and Stage 5's tree cells to the placement checks. Run MODEL. Commit the new outputs.
- **Accept**: SG and ECON pass. The baseline file holds items 1 to 5. MODEL passes on the real code, or the file lists each failed check with the smallest change to the content file that fixes it (a coordinate, a drop chance, a boss number) and MODEL passes with those changes. `git diff main --stat` shows only files under `docs/`.
- **Stop rule**: stop and report to the main session (O-6.1b) if any of these is true: a name in items 2 to 4 does not exist and has no equivalent; `moveWithCollision` cannot take a walk test; a boss row cannot be data alone; ECON fails on `main`; a MODEL check fails and no change to the content file fixes it; a frozen test pins a count that design 11.3 does not declare.
- **Must not change**: anything under `src/`, `tests/`, `index.html` or `package*.json`.

### F1 Progress and save tests [CLAUDE]
- **Tier**: sonnet (written from design section 9 and 7.3).
- **Depends**: R0.
- **Files** (all new): `tests/progress.test.ts`, `tests/save-progress.test.ts`, `tests/fixtures/s6/progress-full.json`, `tests/fixtures/s6/progress-hostile.json`.
- **Change**:
  - `progress.test.ts`, against `src/state/progress.ts`: `STAT_KEYS` holds `kill:` for every key of `MONSTER_TYPES`, `gather:` for every node item, `craft:` for every recipe id, and `bury`, `vows`, `deaths`, and nothing else (the `talk:` and `clear:` families are added by Q2 and Z2 and their tests); `bump` adds one to a listed key and creates `progress` when absent; `bump` throws on an unlisted key; a count saturates at 2,147,483,647; `registerKill`, `noteGather`, `noteBury` and `tryCraft` each bump their key once per call and leave every flag they set today unchanged.
  - `save-progress.test.ts`: the default state serialises with no `progress` key; a state with every field of `progress-full.json` survives `writeSave` then `readSave` through the in-memory `StorageLike`; `progress-hostile.json` (a stage index of 99 and of -1 and of 1.5, an unknown quest id, `__proto__` and `constructor` as keys in every map, a count of `1e999` and of -5, a `diary` array of 100,000 strings, a `diary` that is an object, a dungeon with `clears` as a string, a boss time in the year 3000 and one in the past) loads to a state where every map has only own, known keys, every number is a finite integer in range, `diary` is empty, and the boss time is at most `now + respawnSecs x 1000` (`now` passed in); Stage 1's `save-v4.json` and Stage 3's geared fixture load to states whose `progress` is absent or empty; a save with the new keys deleted (the old reader, simulated) loads to the same state as before the stage.
- **Accept**: red until F2 (missing module). The opus verify lists the errors.
- **Must not change**: `src/`, any existing test or fixture.

### F2 The progress block, counters and reader [AGY]
- **Tier**: sonnet.
- **Depends**: F1.
- **Files**: `src/state/progress.ts` (new), `src/state/types.ts`, `src/state/gameState.ts`, `src/state/save.ts`, `src/state/adventure.ts`, `src/state/quests.ts`, `src/data/recipes.ts`.
- **Change**: Rule commit.
  - `types.ts`: `Progress = { story?: Record<string, number>; stats?: Record<string, number>; diary?: string[]; dungeons?: Record<string, { clears: number; best: number }>; bossDownUntil?: Record<string, number> }` and `GameState.progress?: Progress`.
  - `progress.ts`: `STAT_KEYS` (a frozen array built from the tables, as F1 states), `bump(state, key, n = 1)`, `stat(state, key)`, `normalizeProgress(raw, now)` by the table of design section 9 (iterate the tables, own-key checks, finite and clamped numbers, arrays over 64 entries ignored), `isEmptyProgress`.
  - `gameState.ts`: `cloneState` and `applyState` deep-copy `progress`. `createDefaultState` is not edited.
  - `save.ts`: `serializeState` adds `progress` only when it is not empty; `migrateLegacySave` sets `state.progress = normalizeProgress(data.progress, now)` with `now` an optional parameter defaulting to the caller's clock in `readSave` (the engine passes `Date.now()`; tests pass a number).
  - One `bump` line each in `registerKill` (`kill:<type>`), `noteGather` (`gather:<item>`), `noteBury` (`bury`), and `tryCraft` after a success (`craft:<id>`).
- **Accept**: `ONE(tests/progress.test.ts)`, `ONE(tests/save-progress.test.ts)`; `ONE(tests/save-compat-s3.test.ts)` and `ONE(tests/save-hardening.test.ts)` unchanged; SG.
- **Must not change**: `createDefaultState`, `normalizeQuests`, the keys `serializeState` writes for a default state, any flag a note function sets.

### F3 Save recovery tests [CLAUDE]
- **Tier**: sonnet (from design 7.9).
- **Depends**: F2.
- **Files**: `tests/save-recovery.test.ts` (new).
- **Change**: against `src/state/saveRecovery.ts` with an in-memory `StorageLike`, and a second one whose `setItem` throws for chosen keys: `keepCorrupt(storage, raw)` does nothing when `_corrupt` already equals `raw`; otherwise shifts `_corrupt_2` to `_corrupt_3` and `_corrupt` to `_corrupt_2` and writes `raw`; returns `kept: false` for a string over 256 kB and writes nothing; when the newest write throws it removes the two older copies, tries once more, and returns `kept: false` if that also throws, with the main key untouched in every case. `legacyPreview(storage)` returns `{ key, gp, totalLevel }` for the first legacy key that parses and migrates, else `null`, and writes nothing. `shouldAutosave(hold)` is false while held. `readSave` still copies a corrupt main save to an empty `_corrupt`, still does not read the legacy keys beside a corrupt main save, and does not throw when that copy cannot be written.
- **Accept**: red until F4.
- **Must not change**: `src/`, existing tests.

### F4 Save recovery [AGY]
- **Tier**: sonnet.
- **Depends**: F3.
- **Files**: `src/state/saveRecovery.ts` (new), `src/state/save.ts`, `src/engine/session.ts`, `src/ui/hud.ts`, `index.html`, `src/ui/styles.css`.
- **Change**: Rule commit, then UI commit.
  - `saveRecovery.ts`: `keepCorrupt`, `legacyPreview`, `shouldAutosave`, as F3. `save.ts`: a `try` around the one `setItem` in `readSave`'s catch, and `readLegacy(storage)` exported (the loop that exists today after the main key, as its own function).
  - `session.ts`: a module flag `saveHold`. `saveGameState` returns at once while it is set and sets the save button's text to "Not saving". `loadGameState` sets the flag and shows the notice when `readSave` reports `corrupt` or when `applyState` throws; it no longer prints the chat line that names the backup key. The notice (Stage 5's modal markup, a new block in `index.html`, text written with `textContent`) has three buttons wired with `addEventListener`: start a new game (`keepCorrupt`, then Stage 3's `startNewGame`, release the hold; if `kept` is false, say so and ask once more before releasing); load the older save (shown only when `legacyPreview` is not `null`; applies `readLegacy`, releases the hold); copy the save text (`navigator.clipboard.writeText` in a `try`, with a read-only text box as the fallback).
- **Accept**: `ONE(tests/save-recovery.test.ts)`; `ONE(tests/save-hardening.test.ts)` and `ONE(tests/globals.test.ts)` unchanged; SG.
- **Must not change**: what `readSave` returns; the legacy migration; the autosave's interval.

### F5 Boss timer tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: F2.
- **Files**: `tests/boss-timer.test.ts` (new).
- **Change**: against `noteBossDown(state, typeKey, now)`, `bossBackIn(state, typeKey, now)` and `clearBossDown` in `progress.ts`: a kill of a type with a `BOSSES` row and an overworld camp records `now + respawnSecs x 1000`; a type without a row records nothing; `bossBackIn` returns the seconds left, 0 when past or absent; after a round trip through the save with `now` moved forward 30 s the remaining time is 30 s less; a saved value an hour ahead is clamped to one respawn.
- **Accept**: red until F6.
- **Must not change**: `src/`.

### F6 Boss timer [AGY]
- **Tier**: sonnet.
- **Depends**: F5.
- **Files**: `src/state/progress.ts`, `src/engine/actions.ts`, `src/engine/spawns.ts`.
- **Change**: the three functions of F5. `handleMonsterDeath` calls `noteBossDown` with `Date.now()` for a boss. After spawning, a boss whose `bossBackIn` is above 0 starts in the `dead` state with that timer (through the option Stage 4 uses for a boss's respawn, as R0 recorded); when it respawns the engine calls `clearBossDown`.
- **Accept**: `ONE(tests/boss-timer.test.ts)`; Stage 4's boss tests unchanged; SG.
- **Must not change**: `stepMonster`; the existing dragon, which has no `BOSSES` row.

### G-6.0 Slice 0 gate [CLAUDE] + H-0 [HUMAN]
- **Tier**: opus.
- **Change**: the slice gate. Check by reading: no new module under `src/state` calls a clock or `Math.random` (grep); `serializeState` output of the default state is byte-identical to Stage 3's golden.
- **H-0**: break the main save by hand and reload (design 11.2, the recovery item). Kill Ashmantle, reload at once: it is still gone.

---

## 6.1 Slice 1: the forge's missing tiers and the roster

### D1 Content tests, slice 1 [CLAUDE]
- **Tier**: sonnet.
- **Depends**: G-6.0.
- **Files**: `tests/content-s6.test.ts` (new), `tests/names-s6.test.ts` (new), and the declared edit to `tests/content-freeze.test.ts`.
- **Change**:
  - `content-s6.test.ts`, written to read the tables, so later slices are covered without editing it: every recipe's inputs and output are own keys of `ITEMS` and its skill a key of `SKILLS_META`; every node's item exists; every drop id exists; no monster whose key is not in a fixed list of the twelve pre-Stage-6 types drops an item of type `equip`; every item whose id is not in the pre-Stage-6 golden has type `resource`, `bar` or `ammo`; for every monster, the summed sale value of its non-bone, non-food item drops is at most 25% of its mean coin drop, chickens excepted by name; no forging recipe added after the golden sells for less than its inputs, `smith_mithril_bolts` and `smith_rune_bolts` excepted by name; the loop audit of design 7.4: every non-equipment item has a source (node, recipe, drop) and a use (recipe input, spell, food, potion, bones, ammunition, or an `ember_` id), except the named list `salmon`, `anglerfish`, `saradomin_brew`, `bronze_bolts`, and except items a later slice closes, held in a second named list that each later test task shortens (this file's one declared kind of edit).
  - `names-s6.test.ts`: the deny-list of `tests/names.test.ts`, copied, over the `name` of every item, node, monster, recipe, person, quest, dungeon, attack and phase whose id is not in the pre-Stage-6 golden; recipes named after an existing item are excepted by a list of the five of design 7.10.
  - `content-freeze.test.ts`: the declared lists gain the ids of slice 1 from the content file: items `coal`, `steel_bar`, `black_bar`, `sting_gland`, `mire_root`; node `coal_rock`; recipes `smelt_steel`, `smelt_black`, the three steel and three black forging recipes, the three brews; monsters `cinder_adept`, `slag_brute`, `marrowjaw`.
- **Accept**: red until D2 and D4. The verify confirms the freeze test's diff only adds ids.
- **Must not change**: `src/`, any other existing test.

### D2 Coal, steel, blacksteel, brewing, feathers [AGY]
- **Tier**: sonnet.
- **Depends**: D1.
- **Files**: `src/data/extras.ts`, `src/data/world.ts`, `src/data/recipes.ts`, `src/data/placements.ts`.
- **Change**: Data commit, rows as the content file: the five items; `coal_rock` in the node override of `world.ts` with an `oreColor` of `0x1f2937`; its three placements; the eleven recipes (in `recipes.ts`, appended after the smelt rows, with `kind` as given); the appended drops for `chicken` (feather), `scorpion` and Stage 4's `saltback_stalker` (Sting Gland only), `moss_guardian` (Mire Root only). Drops are appended to the end of each table.
- **Accept**: `ONE(tests/content-s6.test.ts)` green for these rows; ECON; `ONE(tests/placements.test.ts)` and `ONE(tests/world-data.test.ts)` unchanged; SG.
- **Must not change**: any existing row; the order of existing drops.

### D3 Roster and camp tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: D2.
- **Files**: `tests/roster-s6.test.ts` (new); the declared edit to `tests/world-budget.test.ts` (the overworld monster count plus six).
- **Change**: the three new rows have the stats of design 7.5 and a `model` that is an existing mesh key; `cinder_circle` and `brute_shelf` pass every rule Stage 2's world-data test applies to a camp (members inside, on open cells, no safe zone, no path, no node inside), are clear of every other camp's leash, and of Ashmantle's arena plus 6; `tollmaster` passes Stage 4's arena criteria (design of Stage 4, 6.4) with radius 9 on the real grid; `BOSSES.marrowjaw` is the row of design 7.7 and passes Stage 4's attack-table test.
- **Accept**: red until D4.
- **Must not change**: `src/`.

### D4 Cinder Adepts, Slag Brutes, Marrowjaw [AGY]
- **Tier**: sonnet.
- **Depends**: D3.
- **Files**: `src/data/world.ts`, `src/data/worldMap.ts`, `src/data/attacks.ts`.
- **Change**: Data commit, as the content file (with R0's corrections): three monster rows with `model`, `tint`, `modelScale`, `pattern` and drops (the Adept's Cinder Silk and the Brute's Slagscale Hide are left out until K2; Marrowjaw's Tough Hide likewise); three camps; `toll_slam` and `camp_sweep` in `ATTACKS`; `BOSSES.marrowjaw` with `respawnSecs` 180, `arenaRadius` 9, title unset.
- **Accept**: `ONE(tests/roster-s6.test.ts)`; `ONE(tests/world-budget.test.ts)`; ECON; SG. Marrowjaw is the one boss in `CAMPS` that Stage 3's model fighter might choose (design section 17). If ECON fails or the pacing table's printed kills by monster show it being farmed, the lever is Marrowjaw's row (coins down, hitpoints or basic max hit up), agreed with the main session and written back to the content file; B1 then re-proves the fight.
- **Must not change**: any existing camp, monster or attack row; any Stage 3 test.

### B1 Marrowjaw's fight test [CLAUDE]
- **Tier**: opus (a seeded proof and, if needed, tuning).
- **Depends**: D4.
- **Files**: `tests/boss-marrowjaw.test.ts` (new); `src/data/world.ts` and `src/data/attacks.ts` only if a bound misses.
- **Change**: the six rows of design 7.7 for Marrowjaw through Stage 4's fight model, 500 seeds each, the same bounds. If a bound misses, change the boss's hitpoints, basic max hit or attack powers, never a bound or a fighter, and record the change in the content file and the design's table.
- **Accept**: the test passes; MODEL passes with the same numbers.
- **Must not change**: the fight model; Stage 4's boss rows.

### G-6.1 Slice 1 gate [CLAUDE] + H-1 [HUMAN]
- **Tier**: opus (verification).
- **Change**: the slice gate of 0.2 (SG, ECON, MODEL); the diff of the slice against its tasks' allowlists; no frozen test edited beyond the declared ones.
- **H-1**: mine coal, smelt and forge a steel and a blacksteel piece; brew a vial; walk Cinder Stair past the Adepts at combat 40 (the road is safe); fight Marrowjaw with a mouse and with a trackpad.

---

## 6.2 Slice 2: people and the first chapters

### Q1 Dialogue rule tests [CLAUDE]
- **Tier**: sonnet (from design 7.2).
- **Depends**: G-6.1.
- **Files**: `tests/dialogue-rules.test.ts` (new), `tests/support/dialogueFixture.ts` (new: one small tree and one two-stage quest, used only by tests).
- **Change**: `evalCond` for each of the fourteen kinds, true and false, including `starter` against Stage 3's chain and nesting of `all`, `any`, `not`; an unknown kind throws. `openDialogue` returns the first `greet` whose condition holds, only the options whose `when` holds, and bumps `talk:<npc>`; an unknown person returns `null`. `chooseOption`: a node that is not that person's is refused; an index whose option is hidden is refused; with a full backpack a `give` applies nothing, moves no quest and returns a reason; a `take` without the item likewise; effects apply in order and the events match; `claimStarter` pays exactly what `claimQuest(state, id)` pays on a copy and a second call by either route is refused; `open` and `enter` change no state and return an event. `STAT_KEYS` now holds `talk:<id>` for every person.
- **Accept**: red until Q2.
- **Must not change**: `src/`.

### Q2 Conditions and dialogue [AGY]
- **Tier**: sonnet.
- **Depends**: Q1.
- **Files**: `src/state/dialogue.ts` (new), `src/state/progress.ts`, `src/data/npcs.ts` (new, types and an empty table), `src/data/dialogue.ts` (new, types and an empty table), `src/data/story.ts` (new, types and an empty table).
- **Change**: Rule commit. The types of design 7.2 and 7.3; `evalCond(state, cond)`; `openDialogue`; `chooseOption` with the rehearsal on a `cloneState` copy; `talk:` keys in `STAT_KEYS` from `NPCS`. `finish` and `start` call functions of `story.ts` that Q4 adds; until then they are imported from a stub in `src/state/story.ts` that Q2 creates with the final signatures and bodies that throw "not built".
- **Accept**: `ONE(tests/dialogue-rules.test.ts)` except the cases that need Q4, which the verify lists; `ONE(tests/architecture.test.ts)`; TYPES.
- **Must not change**: `claimQuest`, `STARTER_QUESTS`.

### Q3 Story rule tests [CLAUDE]
- **Tier**: sonnet (from design 7.3).
- **Depends**: Q2.
- **Files**: `tests/story-rules.test.ts` (new).
- **Change**: on the fixture quest: `questStatus` is `none`, `active`, `done`; `startQuest` refuses when `needs` is false or the quest is active or done; `advanceStory` moves a `do` stage when its condition is true, never a `talk` stage, moves several quests in one call, and is idempotent; work done before the quest finishes the stage at once; `finishQuest` pays coin through `creditGp`, experience unmultiplied at 10x, items after the rehearsal, sets a title, moves the id from `progress.story` to `claimed`, and refuses with a full backpack leaving the quest active; `journalView` lists active, offered and done quests with counts for `stat` conditions ("2 of 4"). `adventureTracker`: with no story progress it returns exactly what it returned before (the default state, a new game, a finished chain); with an active main-line quest it shows that stage after the open starter quest and before everything else; a save with a story id in `claimed` keeps it across `writeSave` and `readSave`. `useEmber(state, itemId, skill)` removes one ember, adds its experience unmultiplied at 10x, updates the level (and hitpoints or prayer points as `grantExactXp` does), and refuses an unknown skill or an item that is not an ember.
- **Accept**: red until Q4.
- **Must not change**: `src/`.

### Q4 Story module and tracker [AGY]
- **Tier**: sonnet.
- **Depends**: Q3.
- **Files**: `src/state/story.ts`, `src/state/adventure.ts`, `src/state/save.ts`.
- **Change**: Rule commit. `questStatus`, `startQuest`, `advanceStory`, `finishQuest`, `journalView`, `useEmber` (an ember is an item with a `lampXp` number) as Q3. `adventureTracker` gains the two entries of design 7.3 after Stage 3's first. `save.ts`: the valid claimed ids include `STORY_QUESTS`.
- **Accept**: `ONE(tests/story-rules.test.ts)`, `ONE(tests/dialogue-rules.test.ts)`; Stage 3's `starter-quests`, `tracker-order` and `phase3-content` tests unchanged; SG.
- **Must not change**: `QUEST_DEFS`, `STARTER_QUESTS`, `questView`, `starterView`, `claimQuest`.

### Q5 Content data tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: Q4.
- **Files**: `tests/dialogue-data.test.ts`, `tests/story-data.test.ts`, `tests/npc-placement.test.ts`, `tests/support/satisfy.ts` (all new); the declared edit to `tests/content-freeze.test.ts` (the three embers).
- **Change**: all three read the tables, so later slices are covered without edits.
  - `dialogue-data.test.ts`: the checks of design 7.2 ("the data test"), and the once-only rule: every option with `give`, `take`, `finish` or `claimStarter` has a `when` that pins a stage or a starter state and an effect that moves that quest.
  - `satisfy.ts`: `satisfy(state, cond)` makes a condition true the way play would (bump a counter to its minimum, set a skill level, add an item, set a shrine or flag, claim a quest through its own walk).
  - `story-data.test.ts`: every quest's giver, stage person, item, counter, skill and region exists; every `talk` stage has, in that person's tree, exactly one option that advances or finishes it and is reachable from a `greet`; **the walk**: for every quest in table order, starting from a new game with the chain claimed, satisfy `needs`, then loop: for a `talk` stage, `openDialogue` and choose options breadth-first until the stage moves; for a `do` stage, `satisfy` and `advanceStory`; until the quest is done. Assert the reward was paid once, a second finish is refused, and no step needed more than 12 choices. The main line is refused out of order and below its combat level.
  - `npc-placement.test.ts`: every person stands on an open cell of the walk grid, outside every camp's leash circle (radius + 4) and every boss arena plus 6, at least 2.5 from every station and every other person, and has a dialogue.
- **Accept**: passes on the empty tables (vacuously, which the verify notes); it becomes the acceptance of Q6.
- **Must not change**: `src/`.

### Q6 The cast, chapters 1 and 2, four side quests, the text [CLAUDE]
- **Tier**: opus (writing: about 150 short passages in seven voices).
- **Depends**: Q5.
- **Files**: `src/data/npcs.ts`, `src/data/story.ts`, `src/data/dialogue.ts`, `src/data/extras.ts` (the three embers, type `resource`, price 1, `lampXp` 1000, 7500, 40000).
- **Change**: Data and Text commits.
  - `npcs.ts`: the seven people of design 7.2 with the coordinates of the content file (R0's corrections applied).
  - `story.ts`: `ml_wards`, `ml_east`, `sq_steel`, `sq_kettle`, `sq_vow`, `sq_toll`, with the stages and rewards of design 7.3.
  - `dialogue.ts`: a tree for each of the seven. Bran Tolley: a `greet` per starter quest, open and ready, with `claimStarter` on "It is done."; the veteran greeting for a save without `arrival`; the pointer to Odalys Venn; `sq_toll`. Odalys Venn: chapter 1, the end of chapter 2, `sq_vow`, and a "what are the wards" branch that can be asked at any time. Tamsin Reeve: chapter 2 and `sq_steel`, and `open: 'forge'`. Pell Greaves: `sq_kettle`. Corin Ashby: the end of chapter 1 and the warning by combat level. Qadir Salt-Hand and Hesper Moth: a greeting, who they are, `open: 'shop'` for Qadir, and "come back when" lines for chapters that later slices add.
  - Voice and register: design 7.2's table and its three sample lines. Every passage at most 280 characters, every option at most 80, at most four options a node, no markup characters, neither forbidden word. Plain sentences; nobody explains the interface; no person mentions another game.
- **Accept**: `ONE(tests/dialogue-data.test.ts)`, `ONE(tests/story-data.test.ts)`, `ONE(tests/npc-placement.test.ts)`, `ONE(tests/names-s6.test.ts)`; ECON; SG.
- **Must not change**: Stage 3's quest texts; any id or number of the design.

### Q7 People in the world [AGY], lane E
- **Tier**: sonnet.
- **Depends**: Q6.
- **Files**: `src/engine/worldBuild.ts`, `src/engine/loop.ts`, `src/engine/input.ts`, `src/engine/context.ts`.
- **Change**: Engine commit. `createPeople()` builds one humanoid per row of `NPCS` with the merchant builder's rig, a tunic colour from the row, the name label, and `userData = { type: 'interactive', action: 'talk', npcId, name, interactRadius: 4 }`; it is called where the merchants are built. The interaction branch of `updatePlayerIntent` gains `talk`: dispatch the `talk` command (Q8 shows the result). The context menu label for `talk` is `Talk-to <name>`. The 10 Hz vitals tick calls `advanceStory(STATE)` and, when it returns events, shows the banner "Journal updated" and redraws the tracker.
- **Accept**: SG; `ONE(tests/architecture.test.ts)`.
- **Must not change**: the existing `dialogue`, `shop`, `bank`, `forge`, `slayer`, `altar` branches; merchant and guard builders.

### Q7t Interface scan and command tests [CLAUDE], lane U
- **Tier**: sonnet.
- **Depends**: Q6.
- **Files**: `tests/dialogue-ui-scan.test.ts`, `tests/commands-s6.test.ts` (new).
- **Change**: the scan reads `src/ui/dialogue.ts` and `src/ui/journal.ts` as text and fails on `innerHTML`, and reads `index.html` and fails if it holds more inline handler attributes than the count R0 recorded (written as a constant with that source). `commands-s6.test.ts`: the pure appliers of `talk`, `choose` and `useEmber` return what `openDialogue`, `chooseOption` and `useEmber` return on the same state and change nothing else; an unknown command kind is refused.
- **Accept**: red until Q8 and Q9 (missing files and command kinds); the verify lists the errors.
- **Must not change**: `src/`.

### Q8 The dialogue panel [AGY], lane U
- **Tier**: sonnet.
- **Depends**: Q7t.
- **Files**: `src/ui/dialogue.ts` (new), `src/state/commands.ts`, `src/ui/playerActions.ts`, `index.html`, `src/ui/styles.css`.
- **Change**: UI commit. Commands `talk` and `choose` with pure appliers that call `openDialogue` and `chooseOption`. The panel of design 7.2: Stage 5's panel and button classes; `role="dialog"`, `aria-labelledby`; focus in and back; keys 1 to 4 and Escape through one `keydown` listener that is active only while the panel is open and ignores text inputs; every string through `textContent`; events `open` and `enter` call the existing station openers and the dungeon command (a no-op until Z7). It closes on a hit, on death and when the hero is more than 5 units from the person.
- **Accept**: `ONE(tests/dialogue-ui-scan.test.ts)` for `dialogue.ts` and `index.html`; the `talk` and `choose` cases of `ONE(tests/commands-s6.test.ts)`; `ONE(tests/globals.test.ts)` and `ONE(tests/input-keys.test.ts)` unchanged. The suite stays red only in the cases that wait for Q9.
- **Must not change**: the chat box; other modals.

### Q9 The journal and the tracker line [AGY], lane U
- **Tier**: sonnet.
- **Depends**: Q8.
- **Files**: `src/ui/journal.ts` (new), `src/ui/stations.ts`, `src/ui/hud.ts`, `src/ui/playerActions.ts`, `src/state/commands.ts`, `index.html`, `src/ui/styles.css`.
- **Change**: UI commit. The log window gets three tabs (Stage 5's tab component): Journal, Tasks, Diary. **Tasks** holds what `renderQuests` draws today, moved into the tab unchanged. **Journal** draws `journalView(STATE)` with DOM nodes and `textContent`: active quests with the stage text and counts, offered quests with giver, place and what is needed, finished quests collapsed. **Diary** is an empty tab body with the line "Nothing recorded yet." until Y4. Redrawing a tab keeps its scroll position. Using an ember from the backpack opens a small list of skills (Stage 5's modal) and dispatches the `useEmber` command, whose pure applier this task adds to `src/state/commands.ts`. The tracker line reads `adventureTracker` as today.
- **Accept**: `ONE(tests/dialogue-ui-scan.test.ts)`, `ONE(tests/commands-s6.test.ts)`; SG.
- **Must not change**: the markup of a quest card; the claim buttons' behaviour.

### G-6.2 Slice 2 gate [CLAUDE] + H-2 [HUMAN]
- **Tier**: opus. Merge lanes E and U. The slice gate. Read every passage of `dialogue.ts` once for sense, voice and the rules of Q6; list any to rewrite.
- **H-2**: design 11.2, the first three items: talk to all seven as a new and as a late character; play chapters 1 and 2 from a new game guided only by the journal and tracker; take a reward with a full backpack.

---

## 6.3 Slice 3: the first dungeon

### Z1 Zone rule tests [CLAUDE]
- **Tier**: sonnet (from design 7.6).
- **Depends**: G-6.2.
- **Files**: `tests/zone-rules.test.ts` (new), `tests/support/dungeonFixture.ts` (new: a three-room zone with one gate and a one-member boss camp).
- **Change**: `buildWalkGrid()` with no arguments equals today's grid cell for cell (size 236, origin -118); with `(walk, 600, -200, 96)` it has that origin and size and `findPath` routes on it. `zoneWalk(def, open)` is true inside a room, false outside every room, false inside a shut gate and true inside an open one. `moveWithCollision` with a walk test moves at x of 620 and does not clamp; without one it behaves as today. `getTerrainHeight(600, 0)` is 0; Stage 2's terrain golden is unchanged. `canEnter(state, def)` equals `evalCond(state, def.needs)`: refused below the combat level and before the quest stage that opens the door, allowed at it and after the quest is done. `zoneSafe(def, x, z)` is true within 6 of the entry and false elsewhere. Through `stepMonster` with a fixture camp: a camp with `ignoresLevel: true` acquires a hero whose combat level is far above the monster's; the same camp without the flag does not; the flag changes nothing else (leash, return, attack cadence). `runStep`: a camp's death opens a gate only when every camp it names is dead; the boss's death arms the chest. `openChest`: refused while the boss lives; pays the run reward with `rand` injected; pays the first-clear reward when `clears` is 0 and never again; with a full backpack pays nothing and stays armed; bumps `clear:<id>` and `clears`; keeps the smaller `best`. `zoneCamps(def)` returns `CampDef` rows in world coordinates with `arenaRadius` kept. `savedPose(pose, zone)` returns the door when a zone is given.
- **Accept**: red until Z2.
- **Must not change**: `src/`.

### Z2 Zone rules [AGY]
- **Tier**: sonnet.
- **Depends**: Z1.
- **Files**: `src/state/dungeon.ts` (new), `src/state/pathfind.ts`, `src/state/collision.ts`, `src/state/terrain.ts`, `src/state/monsterAi.ts`, `src/state/progress.ts`, `src/data/worldMap.ts` (the type only), `src/data/dungeons.ts` (new, types and an empty table).
- **Change**: Rule commit. `buildWalkGrid(walkable = isWalkable, origin = -118, originZ = origin, size = 236)` and `WalkGrid.originZ`; every reader of `grid.origin` for the z axis uses `originZ`. `moveWithCollision`: when a walk test is passed, no clamp. `getTerrainHeight`: `if (x >= 400) return 0;` as its first line. `dungeon.ts`: the `Dungeon` type's functions of Z1 and `DungeonRun = { id, startedAt, deadCamps: string[], bossDead: boolean, chestOpen: boolean }`. `clear:` keys in `STAT_KEYS` from `DUNGEONS`. `CampDef.ignoresLevel?: boolean`, and in `stepMonster`'s acquisition rule (transition T2) the threat-colour test is skipped for a camp that has it: one condition. `Dungeon.needs` is a `Cond`; `zoneCamps` sets `ignoresLevel: true` on every camp it returns; `zoneSafe`.
- **Accept**: `ONE(tests/zone-rules.test.ts)`; `ONE(tests/pathfind.test.ts)`, `ONE(tests/terrain-golden.test.ts)`, `ONE(tests/reachability.test.ts)`, `ONE(tests/monster-territory.test.ts)`, `ONE(tests/gate-simulation.test.ts)`, Stage 4's route tests unchanged; SG.
- **Must not change**: `isWalkable`; A* itself; any height for x below 400; aggression for a camp without the flag; any row of `CAMPS`.

### Z3 Dungeon data test and slice 3 content tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: Z2.
- **Files**: `tests/dungeon-data.test.ts` (new); declared edits to `tests/content-freeze.test.ts` (ids of slice 3: `adamantite_ore`, `adamant_bar`, `adamantite_rock`, `smelt_adamant`, the three adamant forging recipes, `scree_skitter`, `saltfang`) and to the "closed later" list of `tests/content-s6.test.ts`.
- **Change**: `dungeon-data.test.ts` reads `DUNGEONS`: rooms inside the zone with a 2-cell margin and at least 6 wide; every member inside its room and of a known type; with gates open every open cell is reachable from the entry; with gates shut neither the boss's cell nor the chest is; the arena fits its room; the zone is at least 400 from the overworld's bound and from every other zone; the door is on an open overworld cell, outside every camp's leash and every arena plus 6, at least 3 from every node; every node in a zone is on an open cell; the chest's ids exist; every zone camp carries `ignoresLevel`; a run's coin per second for the model fighter is at most 90% of the best open ground at that level, by the arithmetic of design 7.6 and `model.ts` section 8 (the same fighter and no rests on both sides; open ground pays per kill with 1.5 s to the next monster or the camp's shared respawn wait, whichever is longer; the dungeon pays its monsters and chest over the fights plus the walk between room centres times 1.5).
- **Accept**: passes vacuously until Z4.
- **Must not change**: `src/`.

### Z4 Saltfang Warren, as data [AGY]
- **Tier**: sonnet.
- **Depends**: Z3.
- **Files**: `src/data/dungeons.ts`, `src/data/world.ts`, `src/data/extras.ts`, `src/data/recipes.ts`, `src/data/attacks.ts`.
- **Change**: Data commit, as the content file: the dungeon row and its chest; `scree_skitter` and `saltfang` rows; `adamantite_rock`, `adamantite_ore`, `adamant_bar`, `smelt_adamant` and the three adamant forging recipes; `sting_arc`, `brine_spit` and `BOSSES.saltfang` (`respawnSecs` unset: a zone monster does not respawn).
- **Accept**: `ONE(tests/dungeon-data.test.ts)`, `ONE(tests/content-s6.test.ts)`; ECON (zone camps are not in `CAMPS`); SG.
- **Must not change**: `CAMPS`.

### Z5 Chapter 3 and the door's words [CLAUDE]
- **Tier**: opus (writing).
- **Depends**: Z4.
- **Files**: `src/data/story.ts`, `src/data/dialogue.ts`.
- **Change**: `ml_salt` with the stages and reward of design 7.3; Qadir Salt-Hand's and Odalys Venn's nodes for it; the dungeon's `needs.quest` satisfied from the stage where Qadir opens the door.
- **Accept**: Q5's three data tests; SG.
- **Must not change**: earlier passages, except "come back when" lines this chapter replaces.

### Z6 A room to stand in [AGY]
- **Tier**: sonnet.
- **Depends**: Z2. May run beside Z4.
- **Files**: `src/engine/zones.ts` (new), `src/engine/context.ts`, `src/engine/loop.ts`, `src/engine/input.ts`, `src/engine/overlay.ts`, `src/engine/actions.ts`.
- **Change**: Engine commit. `G.zone: { def, run, grid, group } | null`. `enterZone(def)`: build the zone grid; build one merged floor mesh and one merged wall mesh from the room rectangles (walls 4 units high along every room edge not shared with another room, flat-shaded, the existing painted stone tile), the gate slabs, props from an optional `props` list in the row (existing `world.glb` nodes); set `G.walkGrid`; register the floor mesh for ground picking exactly as the terrain mesh is (a new field `G.groundMesh` holds the terrain mesh in the overworld and the zone's floor in a zone; the three places in `input.ts` that compare a hit with `G.terrainMesh` compare with `G.groundMesh`; the floor carries `userData.type = 'ground'` and is in the raycast list); move the hero to `entry` with the aggression grace; set fog dense and dark and remember the old values. `leaveZone()`: dispose the group with `disposeObject3D`, restore the grid and fog, put the hero at the door. The hero's step passes `G.walkGrid.walkable` to `moveWithCollision`. Teleport, shrine travel and respawn call `leaveZone()` first when `G.zone` is set. The minimap draws the room rectangles and gates when in a zone. A debug entry on `window.__DEBUG` enters a zone by id.
- **Accept**: SG. [HUMAN] (part of H-3, done here before Z7): the bare room with the hero in it; the overworld, the sky and any horizon piece are not visible; the hero cannot leave the rooms; clicking the floor walks.
- **Must not change**: the overworld build; `updateMonsters` (Z7).

### Z7 Monsters, gates, the chest, the door [AGY]
- **Tier**: sonnet.
- **Depends**: Z4, Z6.
- **Files**: `src/engine/zones.ts`, `src/engine/spawns.ts`, `src/engine/loop.ts`, `src/engine/worldBuild.ts`, `src/engine/session.ts`, `src/engine/actions.ts`, `src/state/commands.ts`.
- **Change**: Engine commit. Commands `enterDungeon`, `leaveDungeon`, `openChest` with pure appliers over state and run. A door object at each dungeon's `door` (the existing sandstone arch node for the Warren) with `action: 'door'`: its dialogue-style prompt names the dungeon, its level and what it needs. `enterZone` spawns the zone's members through `spawnMonster` with the zone camp id and no respawn (the option R0 recorded) and the zone's nodes through `spawnResourceNode`; `leaveZone` removes and disposes them. `updateMonsters` steps only monsters of the current space and passes the zone's grid and `zoneCamps` to `stepMonster`; while in a zone the `playerSafe` it passes is `zoneSafe(def, x, z)` or the grace, not the overworld's `isPlayerSafe`. On a `died` event in a zone the engine calls `runStep`; when gates open it rebuilds the grid and removes the slab. The chest is an interactive object that dispatches `openChest` with `Math.random`. `saveGameState` writes `savedPose(pose, G.zone?.def)`.
- **Accept**: SG; `ONE(tests/zone-rules.test.ts)`.
- **Must not change**: overworld spawns; `stepMonster`.

### B2 Matron Saltfang's fight test [CLAUDE]
- **Tier**: opus.
- **Depends**: Z4.
- **Files**: `tests/boss-saltfang.test.ts` (new); `src/data/world.ts` and `src/data/attacks.ts` only if a bound misses.
- **Change**: the rows of design 7.7 for Matron Saltfang through Stage 4's fight model, 500 seeds each: prepared melee at least 85%; the same 300 ms slower at least 65%; the same never moving at most 5%; melee 38 in adamant without prayer at most 15%; prepared ranged and prepared magic at least 85% each. The no-food row and the at-the-door row are printed, not asserted. If a bound misses, change the boss's hitpoints, basic max hit, attack powers or cadences, never a bound or a fighter, and write the change back to the content file and the design's tables.
- **Accept**: the test passes; MODEL passes with the same numbers; `ONE(tests/dungeon-data.test.ts)` still holds the income bound.
- **Must not change**: the fight model; the fighters; any other boss's rows.

### G-6.3 Slice 3 gate [CLAUDE] + H-3 [HUMAN]
- **Tier**: opus (verification).
- **Change**: the slice gate of 0.2 (SG, ECON, MODEL); the diff of the slice against its tasks' allowlists; no frozen test edited beyond the declared ones.
- **H-3**: design 11.2, the dungeon item: enter; the rooms, the minimap, the gate, the chest, the way out; die inside; reload inside; teleport out. Fight Matron Saltfang with a mouse and a trackpad. Perf HUD inside.

---

## 6.4 Slice 4: Crafting

### K1 Crafting tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: G-6.3.
- **Files**: `tests/crafting.test.ts` (new); declared edits: `tests/content-freeze.test.ts` (8 materials, 16 recipes), the "closed later" list, and the two Stage 3 goldens regenerated with `UPDATE_GOLDEN=1` after K2 (the verify confirms each diff is one added `crafting` entry under `skills`).
- **Change**: `SKILLS_META.crafting` exists; a new game and a loaded version-4 save have Crafting 1 with 0 XP; each of the sixteen recipes can be made at its level with its inputs and not one level below; `recipesFor('bench')` returns exactly the recipes of kind `craft`, `recipesFor('forge')` what the forge shows today plus the new smithing and cooking rows, and no recipe is in two stations; `unlocksAt('crafting', n)` returns the row of design 7.4 at each level; the actions-to-level table of `results.txt` section 4 within one action; the material drops are the last entries of their tables; Stage 3's `forgeHint` for a green hide body names its bench recipe (3 Chitin Plate at Crafting 20), and for an item with no recipe is unchanged.
- **Accept**: red until K2.
- **Must not change**: `src/`.

### K2 The skill, the materials, the recipes [AGY]
- **Tier**: sonnet.
- **Depends**: K1.
- **Files**: `src/data/catalog.ts` (one row in `SKILLS_META`), `src/data/extras.ts`, `src/data/world.ts`, `src/data/recipes.ts`, `src/state/unlocks.ts`.
- **Change**: Data commit, as the content file. `RecipeDef.kind` gains `'craft'`; `recipesFor(station)` in `recipes.ts`; `forgeHint` also finds a recipe of kind `craft` and says "at a bench". The eight materials; the sixteen recipes; the appended drops of design 7.4 (including the three D4 left out).
- **Accept**: `ONE(tests/crafting.test.ts)`, `ONE(tests/content-s6.test.ts)`; ECON; `ONE(tests/save-compat-s3.test.ts)` with the regenerated goldens; SG.
- **Must not change**: `combatLevel`; any other row of `catalog.ts`.

### K3 The bench and the recipe panel by station [AGY]
- **Tier**: sonnet.
- **Depends**: K2.
- **Files**: `src/engine/worldBuild.ts`, `src/engine/loop.ts`, `src/engine/input.ts`, `src/ui/stations.ts`, `src/ui/playerActions.ts`, `src/ui/hud.ts`, `src/ui/styles.css`.
- **Change**: Engine and UI commits. Two benches (existing `World_crate` and `World_barrel` nodes) at (62, 68) and (8, 14), with `action: 'bench'`; MODEL's placement check covers both. `renderForge` takes a station and draws `recipesFor(station)`; the forge passes `'forge'`. The skills tab draws every key of `SKILLS_META`.
- **Accept**: SG. [HUMAN] in H-4.
- **Must not change**: the forge's behaviour.

### K4 Nothing Wasted [CLAUDE]
- **Tier**: opus (writing, short).
- **Depends**: K2.
- **Files**: `src/data/story.ts`, `src/data/dialogue.ts`.
- **Change**: `sq_hides` and Qadir Salt-Hand's nodes for it, including `open: 'bench'`.
- **Accept**: Q5's data tests; SG.
- **Must not change**: any earlier quest's stages or reward; passages of other people.

### G-6.4 Slice 4 gate [CLAUDE] + H-4 [HUMAN]
- **Tier**: opus (verification).
- **Change**: the slice gate of 0.2 (SG, ECON, MODEL); the diff of the slice against its tasks' allowlists; no frozen test edited beyond the declared ones.
- **H-4**: do `sq_hides`; make gloves, boots and a green hide body; the skills tab shows thirteen skills and fits.

---

## 6.5 Slice 5: Runebinding

### N1 Runebinding tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: G-6.4.
- **Files**: `tests/runebinding.test.ts` (new); declared edits as K1 (`runestone`, `runestone_rock`, nine recipes; the goldens gain `runebinding`).
- **Change**: as K1 for this skill: the meta row; nine recipes at their levels; `recipesFor('altar')` is exactly the kind `bind`; the unlock table; the actions table; each bind's ratio under Stage 3's rule (its own test covers it; here the catalysts are asserted: ashes for fire, big bones for chaos, law and death, dragon bones for blood); the two outcrops pass the node rules.
- **Accept**: red until N2. The verify confirms the freeze test's diff only adds ids and each golden's diff is one added `runebinding` entry.
- **Must not change**: `src/`, any other existing test.

### N2 The skill, the stone, the recipes [AGY]
- **Tier**: sonnet.
- **Depends**: N1.
- **Files**: `src/data/catalog.ts` (one row), `src/data/extras.ts`, `src/data/world.ts`, `src/data/recipes.ts`, `src/data/placements.ts`.
- **Change**: Data commit, as the content file; `kind` gains `'bind'`.
- **Accept**: `ONE(tests/runebinding.test.ts)`, `ONE(tests/content-s6.test.ts)`; ECON; `ONE(tests/save-compat-s3.test.ts)` with the regenerated goldens; SG.
- **Must not change**: the price of any rune; `SPELLS` and their rune costs; `combatLevel`.

### N3 The altar's second use [AGY]
- **Tier**: sonnet.
- **Depends**: N2.
- **Files**: `src/engine/input.ts`, `src/engine/loop.ts`, `src/ui/stations.ts`.
- **Change**: the altar's context menu gains "Bind runes", which opens the recipe panel with `'altar'`; the default click still prays.
- **Accept**: SG.
- **Must not change**: what praying does.

### N4 Blank Stones, chapters 4 and 5 [CLAUDE]
- **Tier**: opus (writing).
- **Depends**: N2.
- **Files**: `src/data/story.ts`, `src/data/dialogue.ts`.
- **Change**: `sq_binding`, `ml_hollow`, `ml_pass` with the stages and rewards of design 7.3; Hesper Moth's, Corin Ashby's and Odalys Venn's nodes; `open: 'altar'` is not used (the altar is a place, not a person).
- **Accept**: Q5's data tests; SG.
- **Must not change**: any earlier quest's stages or reward.

### G-6.5 Slice 5 gate [CLAUDE] + H-5 [HUMAN]
- **Tier**: opus (verification).
- **Change**: the slice gate of 0.2 (SG, ECON, MODEL); the diff of the slice against its tasks' allowlists; no frozen test edited beyond the declared ones.
- **H-5**: mine stones, bind air and fire runes, cast with them; play chapter 4; take the vow and cross the pass for chapter 5.

---

## 6.6 Slice 6: the Underkiln and the end

### U0 Slice 6 content tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: G-6.5.
- **Files**: `tests/wyrmsteel.test.ts` (new); the declared edits to `tests/content-freeze.test.ts` (`kiln_shard`, `wyrmsteel_ingot`, `smelt_wyrmsteel`, the three dragon forging recipes, `kiln_warden`) and to the "closed later" list of `tests/content-s6.test.ts`.
- **Change**: `wyrmsteel.test.ts`: an ingot needs one runite bar and one Kilnglass Shard at Smithing 60; the three forging recipes make the existing dragon scimitar, platelegs and platebody from 4, 4 and 5 ingots at 60, 62 and 65; Kilnglass is dropped by the Kiln Warden and paid by the Underkiln's chest and by nothing else. Z3's `dungeon-data.test.ts` reads the table and needs no edit.
- **Accept**: red until U1 (missing ids). The verify confirms the freeze test's diff only adds ids.
- **Must not change**: `src/`, any other existing test.

### U1 The Underkiln, as data [AGY]
- **Tier**: sonnet.
- **Depends**: U0.
- **Files**: `src/data/dungeons.ts`, `src/data/world.ts`, `src/data/extras.ts`, `src/data/recipes.ts`, `src/data/attacks.ts`.
- **Change**: Data commit, as the content file: the dungeon row and chest; the Kiln Warden; `kiln_ring`, `core_vent`, `hammer_arc`, `BOSSES.kiln_warden`; Kilnglass, the ingot and its four recipes. The door is a procedural frame (the existing signpost builder's posts) at (-52, 46).
- **Accept**: `ONE(tests/wyrmsteel.test.ts)`, `ONE(tests/dungeon-data.test.ts)`, `ONE(tests/content-s6.test.ts)`; ECON; SG.
- **Must not change**: `CAMPS`; the Warren's row; the price or stats of any dragon piece.

### B3 The Kiln Warden's fight test [CLAUDE]
- **Tier**: opus.
- **Depends**: U1.
- **Files**: `tests/boss-kiln-warden.test.ts` (new); `src/data/world.ts` and `src/data/attacks.ts` only if a bound misses.
- **Change**: the rows of design 7.7 for the Kiln Warden through Stage 4's fight model, 500 seeds each: prepared melee at least 85%; the same 300 ms slower at least 65%; the same never moving at most 5%; melee 55 in rune without prayer at most 15%; prepared ranged and prepared magic at least 85% each, and each never moving at most 5%. The no-prayer row and the at-the-door row are printed, not asserted. If a bound misses, the boss's numbers move as in B2.
- **Accept**: the test passes; MODEL passes with the same numbers; `ONE(tests/dungeon-data.test.ts)` still holds the income bound.
- **Must not change**: the fight model; the fighters; any other boss's rows.

### U3 Chapters 6 and 7 [CLAUDE]
- **Tier**: opus (writing).
- **Depends**: U1.
- **Files**: `src/data/story.ts`, `src/data/dialogue.ts`.
- **Change**: `ml_kiln` and `ml_ash`; the last conversations of Corin Ashby and Odalys Venn; a closing line for each of the other five people once `ml_ash` is done.
- **Accept**: Q5's data tests; the walk now finishes all thirteen quests; SG.
- **Must not change**: any earlier quest's stages or reward; Stage 4's Ashmantle rows.

### G-6.6 Slice 6 gate [CLAUDE] + H-6 [HUMAN]
- **Tier**: opus (verification).
- **Change**: the slice gate of 0.2 (SG, ECON, MODEL); the diff of the slice against its tasks' allowlists; no frozen test edited beyond the declared ones.
- **H-6**: the Underkiln as H-3; the Kiln Warden with each style; forge a wyrmsteel ingot and a dragon piece; finish Ashfall and see the title.

---

## 6.7 Slice 7: the diary

### Y1 Diary tests [CLAUDE]
- **Tier**: sonnet (from design 7.8).
- **Depends**: G-6.6.
- **Files**: `tests/diary.test.ts`, `tests/diary-data.test.ts` (new).
- **Change**: rules, on a fixture tier: `diaryView` marks tasks and counts; `claimTier` is refused until five are done, pays the ember and the easy tier's 500 GP once, is refused when the ember does not fit, and records the tier; `perks(state)` returns exactly the perk of each claimed tier (design 7.8's table). Through `stepMonster`: a hero with `peace` for a region is not acquired by a camp whose centre is in that region, is still fought back when it attacks, and is acquired as before by camps elsewhere. Data: 15 tiers of 5 tasks; every condition valid by `evalCond`'s vocabulary and ids; each stat family (`kill`, `gather`, `craft`, `talk`, `clear`, `bury`, `vows`) and each of Crafting and Runebinding read by at least one task; no task is true for a new game.
- **Accept**: red until Y2 and Y3.
- **Must not change**: `src/`, any existing test.

### Y2 Diary rules, embers, perks [AGY]
- **Tier**: sonnet.
- **Depends**: Y1.
- **Files**: `src/state/diary.ts` (new), `src/state/progress.ts`, `src/state/commands.ts`, `src/data/diary.ts` (new, types and an empty table).
- **Change**: Rule commit: `diaryView`, `claimTier`, `perks`, and the command `claimTier`.
- **Accept**: `ONE(tests/diary.test.ts)` except the `stepMonster` cases (Y5); SG.
- **Must not change**: `normalizeProgress`'s rules for the other fields; `finishQuest`.

### Y3 The 75 tasks [AGY]
- **Tier**: sonnet (the table of design 7.8, one condition per task; where a task says "or", an `any`).
- **Depends**: Y2.
- **Files**: `src/data/diary.ts`.
- **Change**: Data commit. Each task's text is the design's wording; its condition uses counters, skills, flags, shrines, coin and claimed quests only.
- **Accept**: `ONE(tests/diary-data.test.ts)`, Q5's data tests; ECON; SG.
- **Must not change**: the wording, tier or region of a task in design 7.8; `evalCond`.

### Y4 The diary tab [AGY]
- **Tier**: sonnet.
- **Depends**: Y3.
- **Files**: `src/ui/journal.ts`, `src/ui/styles.css`.
- **Change**: UI commit: the tab of design 7.8.
- **Accept**: `ONE(tests/dialogue-ui-scan.test.ts)`; SG.
- **Must not change**: the Journal and Tasks tabs.

### Y5 Where the perks are read [AGY]
- **Tier**: sonnet.
- **Depends**: Y2.
- **Files**: `src/engine/loop.ts`, `src/state/combat.ts`, `src/engine/worldBuild.ts`, `src/state/sustain.ts`.
- **Change**: four reads of `perks(STATE)`, one each: the engine passes `peace` regions in `StepWorld` as an optional `peaceRegions?: string[]`, and `stepMonster`'s acquisition rule skips a camp whose centre lies in one (one condition beside the threat-colour check); `canCastTeleport` asks for no runes for the home teleport with that perk; a region's shrine opens the bank from its menu with that perk; `vowPrice` returns three quarters with that perk.
- **Accept**: `ONE(tests/diary.test.ts)`; Stage 2's territory tests and Stage 4's vow tests unchanged; SG.
- **Must not change**: aggression for a state without perks.

### G-6.7 Slice 7 gate [CLAUDE] + H-7 [HUMAN]
- **Tier**: opus (verification).
- **Change**: the slice gate of 0.2 (SG, ECON, MODEL); the diff of the slice against its tasks' allowlists; no frozen test edited beyond the declared ones.
- **H-7**: finish one easy tier from a new game and one medium tier with a prepared save; use an ember; walk through a camp with the peace perk; open the bank at a shrine.

---

## 6.8 Slice 8: ammunition tiers (only if CALL-6.8 is accepted)

### A1 Ammunition tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: G-6.7 (or G-6.1, if the slice is taken early; it needs only slice 1).
- **Files**: `tests/ammo-tiers.test.ts` (new); the freeze list (five items, five recipes).
- **Change**: `ammoForWeapon` returns bronze for bows worn below 25, iron from 25, mithril from 45, rune from 70, bolts likewise for crossbows, and `null` for the three self-drawn bows; `canUseStyle` with a maple bow and only bronze arrows is refused with a reason that names the arrow needed; with iron arrows it is allowed; the frozen shortbow case of `tests/phase1.test.ts` still holds; the five recipes exist and pass Stage 3's rule.
- **Accept**: red until A2.
- **Must not change**: `src/`; `tests/phase1.test.ts`.

### A2 Arrows, bolts and the rule [AGY]
- **Tier**: sonnet.
- **Depends**: A1.
- **Files**: `src/data/items.ts`, `src/data/extras.ts`, `src/data/recipes.ts`, `src/state/combat.ts`.
- **Change**: Data and Rule commits, as the content file's `AMMO_TIERS`; the refusal text names the arrow.
- **Accept**: `ONE(tests/ammo-tiers.test.ts)`, `ONE(tests/phase1.test.ts)`, `ONE(tests/phase4-combat.test.ts)` unchanged; ECON; SG.
- **Must not change**: any damage or accuracy number; the three self-drawn bows; the price of bronze arrows and bolts.

### G-6.8 Slice 8 gate [CLAUDE] + H-8 [HUMAN]
- **Tier**: opus (verification).
- **Change**: the slice gate of 0.2 (SG, ECON, MODEL); the diff of the slice against its tasks' allowlists; no frozen test edited beyond the declared ones.
- **H-8**: load a save with a yew bow and bronze arrows: the refusal reads clearly; fletch iron arrows; shoot.

---

## 6.9 End of the stage

### R1 README [CLAUDE]
- **Tier**: sonnet (doc sync to code).
- **Depends**: the gate of the last slice that is built.
- **Files**: `README.md`.
- **Change**: quests and people, the two skills, the dungeons, the bosses, the diary; the monster table; the model needs of design 7.5 as a short "known compromises" list.
- **Accept**: SG; `ONE(tests/credits.test.ts)` unchanged.
- **Must not change**: the credits and licence sections.

### G-6.F Final verification [CLAUDE]
- **Tier**: opus.
- **Depends**: R1.
- **Files**: none (a report in the pull request).
- **Change**: section 3 of this plan.
- **Accept**: every step of section 3 holds.
- **Must not change**: anything.

### O-6.2 Name search [HUMAN]. O-6.3 Accept Stage 6 [OWNER].

---

# 3. Final verification

Run in order, from a clean checkout of the stage's head:

1. SG, ECON, MODEL.
2. `git diff <R0 baseline> --stat -- tests/ src/__tests__/` lists, among files that existed at the baseline, only `tests/content-freeze.test.ts`, `tests/world-budget.test.ts` and the two Stage 3 goldens; each diff is additions of the declared kind.
3. `grep -rn "Math.random\|Date.now\|performance.now" src/state` shows no line in a module this stage created.
4. `grep -rn "innerHTML" src/ui/dialogue.ts src/ui/journal.ts` prints nothing.
5. The walk test finishes all thirteen quests; the three fight tests pass; the dungeon, dialogue, story, diary and placement data tests pass.
6. `serializeState(createDefaultState())` differs from the R0 golden only by the two skills.
7. The JS chunk is within design section 10's budget of the R0 baseline; the report gives the number per slice.
8. No commit on the branch carries an attribution trailer; no agent branch was pushed.
9. Every human check H-0 to H-8 is recorded in its pull request.

---

# 4. Coverage

## 4.1 Goals to tasks

| Goal | Tasks | Proof |
|---|---|---|
| G6.1 dialogue | Q1, Q2, Q5, Q8 | `dialogue-rules`, `dialogue-data`, the UI scan |
| G6.2 main line, side quests, journal | Q3, Q4, Q5, Q6, Q9, Z5, K4, N4, U3 | `story-rules`, the walk in `story-data` |
| G6.3 starter chain's voice | Q1, Q6 | `dialogue-rules` (`claimStarter`), Stage 3's tests unedited |
| G6.4 loops closed | D1, D2, Z4, K2, N2, U1, A2 | the loop audit in `content-s6` |
| G6.5 two skills | K1 to K3, N1 to N3 | `crafting`, `runebinding` |
| G6.6 dungeons | Z1 to Z7, U0, U1 | `zone-rules`, `dungeon-data`, H-3, H-6 |
| G6.7 roster and bosses | D3, D4, Z4, U1, B1 to B3 | `roster-s6`, the three fight tests |
| G6.8 diary | Y1 to Y5; embers in Q3, Q4, Q6, Q9 | `diary`, `diary-data`, `story-rules` |
| G6.9 Stage 3's economy holds | every slice gate | ECON, unedited |
| G6.10 save | F1, F2 | `save-progress`, the goldens |
| G6.11 debts | F3 to F6 | `save-recovery`, `boss-timer` |
| G6.12 ready for co-op | rule 0.3.8; the commands in Q8, Z7, Y2 | final verification step 3; the architecture test |

## 4.2 Ledger (design section 12) to tasks

| Item | Task |
|---|---|
| Backup written once; unguarded write; no legacy fallback; `applyState` throw then overwrite | F3, F4 |
| Steel, black, adamant, dragon recipes | D2, Z4, U1 |
| Food that matters, extended | D2 (brewing) |
| The giants plateau | D4, Z4 |
| Givers, dialogue, talk-to steps; the first hour | Q1 to Q9 |
| Ranged and magic ladders | K2 (armour), N2 (runes), A2 (ammunition); the measurement is MODEL section 5 |
| A boss's respawn timer | F5, F6 |
| The prepared slots | D4, Z4, U1 |
| Audit findings 1, 10, 24 | rule 0.3.9 and Q8's scan; F1; Q9 |

## 4.3 CALLs to tasks

| CALL | Tasks that carry it |
|---|---|
| 6.2 | Q6 |
| 6.3 | K1 to K3, N1 to N3, D2 |
| 6.4, 6.5, 6.18 | Z1, Z2, Z3, Z7 |
| 6.6 | Y2, Y5 |
| 6.7, 6.8 | A1, A2; MODEL |
| 6.10 | D4, Z4, U1; R1 lists the compromises |
| 6.11 | F1, F2 |
| 6.12 | F3, F4 |
| 6.13 | D3, D4 |
| 6.14 | Q3, Q4 |
| 6.15 | Q6, Z5, N4, U3 |
| 6.16 | Q6, Z5, K4, N4, U3 |
| 6.9 | D1 (`names-s6`), O-6.2 |

---

# 5. What this plan could not check

- **It was written against designs, not code, for Stages 4 and 5**, and against a half-built Stage 3. R0 exists for that and is the one task that may stop the stage.
- **Stage 4's fight model is named by guess** ("its plan task B3 put it under `tests/support`"). B1 to B3 depend on R0 finding it.
- **How Stage 4 passes a boss's respawn time into a monster's logic** is not in its design in code form; F6 and Z7 say "the option R0 recorded".
- **Whether Stage 5 took CALL-V13** decides how Q8, Q9 and F4 wire buttons; both ways are allowed by rule 0.3.9 as long as no inline handler is added.
- **Allowlists for engine tasks** (Q7, Z6, Z7, K3, Y5) name the files that hold the code today; if Stage 4 or 5 moved a function, R0's symbol table is the guide and the verify stage accepts the file that now holds it, recorded.
- **No suite, type check or build was run** while writing this plan. The commands of 0.2 are the earlier plans', which were run on this machine.
