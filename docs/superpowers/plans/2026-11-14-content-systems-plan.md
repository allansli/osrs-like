# Content and systems: implementation plan

> **Order changed by the owner on 2026-11-15:** the models pass now lands BEFORE this stage (order 4, 5, models pass, 6, 7). Task R0 therefore also re-checks against the merged models pass: skinned figures and their loader, the `kit` field and `Kit_<name>` nodes, the model keys, and which of this stage's new monsters and bosses can now get a real model instead of a recolour (record it; building new models stays out of this stage unless the models pass left a ready kit).

Date: 2026-11-14. Branch: `feat/content-systems`. Design: `docs/superpowers/specs/2026-11-14-content-systems-design.md` (called "the design" below; section numbers refer to it). Data: `docs/superpowers/research/content-model/content.ts` (called "the content file"): every row a data task adds is written there, and a task that says "as the content file" copies those rows without changing a number or a name. Earlier documents this plan builds on: the foundation design and plan (`2026-11-13-world-foundation-*`), and the approved designs of Stage 3 (start and pacing), Stage 4 (combat with weight) and Stage 5 (visual pass). Source line numbers are at commit `5caa597`.

The design is a proposal. Nothing in this plan starts before owner step **O-6.1**, and before Stages 3, 4 and 5 are merged to `main` (section 0.5). The first task, **R0**, re-checks every premise the design takes from those three stages and stops the stage if one fails. Critiqued on 2026-11-14 (`../specs/2026-11-14-content-systems-critique.md`); its fixes are applied below. **Revised on 2026-11-14 for the owner's answers** (design section 15.1): aggressive and passive monsters (tasks G1, G2 in slice 0), the style rebalance and arrow grades (a new slice 6, tasks S1 to S4, replacing the old last slice), dungeon drop tables and quest rewards paid once (Z1 to Z5, U0 to U3), and the diary without "peace" (Y1, Y2, Y5). The review log at the end lists what moved. **Revised on 2026-11-25 for the owner's approval of CALL-6.30 to 6.32** (the demons' cave, the Ember Hurler, line of sight): new slices 3a and 3b, the owner step O-6.33, and the tasks the last entry of the review log names. Where a task gives a line number "on `87f18e7`", it is the merged tree of Stages 1 to 5 on this branch.

---

## 0. Conventions

These are the conventions of the earlier plans, restated so this plan can be read alone. Where a rule is new for Stage 6 it says so.

### 0.1 Task tags and tiers

- **[AGY]**: the task is specified fully enough to hand to the agy backend through `/agy-implement` (one worktree) or `/agy-parallel` (several lanes). It always runs in three stages: a **haiku** stage runs the `agy -p` command and returns the diff stat, test output and exit status; a **sonnet** stage implements the task only if agy failed or refused, and records that it did; an **opus** stage (a [CLAUDE] verify) checks the diff against the task's allowlist, runs the acceptance check, and looks for weakened or deleted assertions and for edits to [CLAUDE] tests. On an [AGY] task, "Tier" names the tier that does the work if agy fails. The verify stage is always opus and is part of the task.
- **[CLAUDE]**: tests that define acceptance, the premise re-check, tuning against a test, every piece of written content (dialogue, journal text, quest text), governance text, and every verification. Tests that define acceptance for an [AGY] task are their own [CLAUDE] task and come first.
- **[OWNER]** and **[HUMAN]**: a decision only the owner can make, or something a person has to look at in the running game. These are not agent tasks.
- Agents never merge, tag, push or open pull requests. The main session merges after verification. No commit carries an AI attribution trailer (owner's global rule).
- Tiers used in this plan: haiku for running agy; sonnet for tests written from a stated spec, for fully specified implementation and for doc sync; opus for the premise re-check (R0), the fight tests and their tuning (B1 to B3), the three tests that replace frozen assertions after an owner's rule change (G1, S1, L1: each has to judge that its replacement is at least as strict as what it replaces), the written content (Q6, Z5, K4, N4, U3) and every verify. No task needs a higher tier: the design is done and each task is bounded.

### 0.2 Commands

Run every command from the worktree root, in a shell started with an allowlisted environment, so that no token reaches a test process: `env -i HOME="$HOME" PATH="$PATH" XDG_RUNTIME_DIR="$XDG_RUNTIME_DIR" DBUS_SESSION_BUS_ADDRESS="$DBUS_SESSION_BUS_ADDRESS" bash`.

| Name | Command | Expected |
|---|---|---|
| SUITE | `systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 env TEST_CONCURRENCY=4 npx vitest run` | exit 0; every test passes, including every test that exists when R0 records the baseline |
| ONE(file) | `systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 env TEST_CONCURRENCY=4 npx vitest run <file>` | as stated in the task |
| TYPES | `systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 env TEST_CONCURRENCY=4 npx tsc --noEmit` | exit 0, no output |
| BUILD | `systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 env TEST_CONCURRENCY=4 npm run build` | exit 0; the JS chunk size is reported |
| MODEL | `bash docs/superpowers/research/content-model/run.sh` | exit 0; `results.txt` ends with `ALL CHECKS PASS`, `check-results.txt` with `EVERY BOUND HOLDS, WITH TODAY'S FORMULA AND WITH THE REBALANCE`, `aggro-results.txt` with `ALL AGGRESSION CHECKS PASS` |
| PACE | `bash docs/superpowers/research/content-model/pacing-rerun.sh` (it reads `origin/main` by default, `PACE_REF` overrides; R0 points it at the merged tree) | exit 0; every block of `pacing-results.txt` ends with `EVERY ASSERTION OF pacing.test.ts HOLDS` |
| ECON | `ONE(tests/pacing.test.ts)` and `ONE(tests/economy-invariants.test.ts)` (Stage 3's, unedited) | both pass |

**Standard gate (SG)**: SUITE, TYPES and BUILD all pass. Every task below ends with SG unless it says otherwise. A wrapper OOM kill means a defect to fix. Never raise the cap.

**Slice gate**: SG, ECON and MODEL pass, then the slice's [HUMAN] check. A slice reaches the owner only after its gate.

### 0.3 Rules that apply to every task

1. **Allowlist.** A task touches only the files listed for it. The opus verify rejects a diff with any other file in it.
2. **Line numbers go stale.** Three stages land between `5caa597` and the first task. Every task names the symbols it changes; find them by name. R0 records their current lines.
3. **Existing tests are frozen.** No edit to any file that exists under `tests/` or `src/__tests__/` when R0 records the baseline: the 103 original tests and every test of Stages 1 to 5. A new test goes in a new file under `tests/`. Stage 6 declares the replacements of design 11.3 and no other. These are additive: the declared lists of `tests/content-freeze.test.ts` (D1 adds `DECLARED_NEW_NODES` and `DECLARED_NEW_RECIPES` beside Stage 3's item list and Stage 4's monster list; D1, Z3, C1, K1, N1, S3, U0 each append exactly the ids their slice adds); the two Stage 3 save goldens, regenerated once per new skill (K1, N1); Stage 2's `tests/fixtures/save-relocation/v4-loaded.json`, one added `saved.skills` entry per new skill (K1, N1); the overworld monster counts of `tests/world-budget.test.ts` 41 and `tests/world-data.test.ts` 162, 42 to 48 (D3) and then 46 (C1); the monster type-key count of `src/__tests__/blender-hero.test.ts` 138, 13 to 16, 18, 19, 20 (D3, Z3, C1, U0); Stage 5's camp counts, `tests/scatter.test.ts` 176 and 178 and `tests/woods-trees.test.ts` 134 and 240, 15 camps and 42 members to 18 and 48 (D3) and then 17 and 46 (C1) (design 11.3 item 13); the `NEW` list of `tests/new-monsters.test.ts` 125, which gains each Stage 6 type when its row lands (D3, Z3, C1, U0; item 14). Four follow the owner's two rule changes of 2026-11-14, each made by the opus test task named and each replaced by an assertion at least as strict about the new rule: one test of Stage 2's `tests/monster-territory.test.ts`, "an aggressive camp ignores a player whose combat level is above the monster's" (G1); one expression and one import of Stage 3's `tests/support/pacingModel.ts`, the `attackers` line (G1; `tests/pacing.test.ts` itself is not edited; the second pass dropped the `largestAggressive` filter, which changes no number); five expected max hits of Stage 3's `tests/combat-profile.test.ts` (S1); one expected profile of Stage 3's `tests/entry-staff.test.ts` (S1). Design 11.3 items 8 to 11 give the exact old and new assertions. One follows the owner's decision of 2026-11-24 on line of sight (CALL-6.32): the `monsters` key of `tests/fixtures/size-refactor-golden.json`, made by L1 (item 15). If R0 finds a Stage 4 or Stage 5 test that pins a number of skills, commands or interactive actions, it names it and the owner is asked before any code. If any other existing test goes red, the change is wrong, not the test: stop and report.
4. **Test-first pairs.** A [CLAUDE] test task may leave the suite red until the [AGY] task that implements it lands on the same branch. Allowed in that window: SUITE failures only in the new test files and in the one frozen file the test task is authorised to edit; TYPES and BUILD errors only in the new test files and only because a module, export, field or union member that the paired task adds does not exist yet. The opus verify of the test task lists them. The paired task's accept restores full SG.
5. **Commit kinds, never mixed.** *Test*. *Data*: rows in a table. *Rule*: a pure module under `src/state`. *Engine*. *UI*. *Text*: dialogue and quest wording. *Docs*. Every commit message names its kind and task: `test(Q1): dialogue rules`, `data(D2): coal, steel, blacksteel`, `rule(Z2): zone walk and dungeon run`.
6. **Content comes from the content file.** Every id, name and number of a data task is in `docs/superpowers/research/content-model/content.ts` or in the design's tables. A task that seems to need another name or number stops and reports. New ids are added to the declared lists of the freeze test by the test task of the same slice, never by the data task.
7. **No formula edits, with three named exceptions the owner decided.** The XP table, the XP of existing actions, the hit and damage formulas, the price, requirement and stats of existing items, existing recipes' inputs, existing monsters' stats, `QUEST_DEFS`, `STARTER_QUESTS` and every existing quest's reward do not change. The exceptions, each in one task and nowhere else: the acquisition rule of `stepMonster` (G2, design 7.13); and the three style constants of `playerAttackProfile`, the arrow term, and the rune counts of ice burst and blood barrage (S2 and S4, design 7.12); and the line-of-sight test of `stepMonster` (L2, design 7.13, CALL-6.32). Melee's branch of `playerAttackProfile`, `playerHitChance`, `monsterHitChance` and `rollMonsterHit` are never edited.
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
| O-6.33 | Decide the demons' cave income bound (design 15.2, CALL-6.33): against the package's 0.9, the front hall measures 0.94, the back hall 0.87, both halls in turn 0.73. | C1, C2, C3 |
| O-6.6 | Re-approve the rebalance numbers (CALL-6.24) on the band table that R0's MODEL prints against the merged code, with the level-28 exception. | S1 |
| O-6.3 | Accept Stage 6, or stop after any slice. | Nothing after it |

If the owner answers a CALL with the alternative, only the named task changes:

| Answer | Change |
|---|---|
| CALL-6.24: other rebalance numbers | S1's written-out values and S2's three constants take the owner's numbers; MODEL is rerun first and must show every fight bound holding, or the task stops. Rune counts kept as today: S2 drops the two `RUNE_COSTS` rows and S1 its case. |
| CALL-6.27: another sight gap | `SIGHT_GAP` in G2 and `aggro.ts`; PACE is rerun and its table goes into the design. No other task changes. |
| CALL-6.25: other chances, or all Kilnglass by chance | The `loot` rows and boss rows of Z4 and U1, and the expected-clears figures U0 reproduces; MODEL section 8 must still hold the income bound. All by chance: U0 drops its "at least one shard" case and asserts the variant's figures (`second-pass-results.txt` D). There is no counter option: the owner ruled it out. |
| CALL-6.28: a quiver | A new task after S4: an equipment slot `quiver`, its UI, `bestAmmo` reading it first; Stage 3's default-state golden regenerated once (declared like 11.3 item 2). |
| CALL-6.29 (b): a hit stops the gather | G2 gains `src/engine/loop.ts` (or the file Stage 4 put auto-retaliation in, as R0 records): a monster attack that lands on a gathering hero ends the gather, so Stage 4's auto-retaliation answers it; a test task before it pins that a gatherer hit once is no longer gathering. (c): the two `deep_woods_*` camp rows move, a declared data change with world-data's rules re-run. |
| CALL-6.26: another middle-tier perk | Y1, Y2 and Y5. A bank at the volcanic shrine only: Y5 reads one region. No middle perk: Y5 keeps the hard tier's bank and the two start-town perks. |
| CALL-6.4: save the run | Return to the design. |
| CALL-6.3: only Crafting | Slice 5 keeps chapters 4 and 5 without the binding stage and drops N1 to N3; the diary's woods rows change (Y3). |
| CALL-6.22: re-tune Matron Saltfang around a ring | B2 gets the new rows and tunes her health and max hit until its bounds hold; the content file and design 7.7 follow. |
| CALL-6.2: existing saves see the chain | Return to Stage 3's design, which decided it. |
| CALL-6.10: wait for models | Slices 3 and 6 wait for the models pass; slices 0, 1 (without Marrowjaw), 2, 4, 5 (without the dungeon stages), 7 are built. |
| CALL-6.12: keep the silent behaviour | F3 and F4 keep the three copies and the guarded write and drop the hold and the notice. |
| CALL-6.13: monsters inside the ridge | D3 and D4 take new coordinates from a re-run of MODEL; the task stops if no spot passes. |
| CALL-6.14: count from the moment a quest is taken | Return to the design: a tally per quest in the save. |
| CALL-6.16: the owner writes the text | Q6, Z5, K4, N4, U3 deliver the trees with placeholder lines marked as such; the data tests are the same. |
| CALL-6.33 (a): a longer respawn in the cave | The owner sets the seconds (13.4 s from death to return reaches 0.9; design 7.6). C1 asserts the cave row's `respawnSecs` and that `campRate` with that wait holds 0.9; `campRate` gains a wait argument (Z3's file, one parameter). C2 adds `respawnSecs` to the `Zone` type and the row, and `createMonsterLogic` takes it through Z2's options (that option only, in `src/state/monsterAi.ts`, already C2's for `sendHome`); C3 passes it at spawn. |
| CALL-6.33 (b) or another change to the Hurler's numbers | C1's Hurler assertions and C2's row take the owner's numbers; design 7.5 and 7.6 follow. |
| CALL-6.33 (c): the bound read for the cave as a whole | C1 asserts 0.9 for both halls in turn with the walk only, and prints each hall's ratio. No other task changes. |
| Slice 3a delayed past slice 4 | C1 asserts, and C2 writes, the Ember Hurler's Slagscale Hide at 0.10 (the hide exists by then); K1 and K2 leave it out. If slice 3a also comes after slice 7, U0's type-key count is 18 to 19 and C1's is 19 to 20. |
| CALL-6.33 (d): the cave's bound is 1.0 | C1 asserts at most 1.0 for each hall and for both in turn; the dungeons keep 0.9. No other task changes. |
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
  4. **Names assumed from Stage 5.** The class names of its panel, button, tab and modal; whether CALL-V13 was taken (`data-action` and no inline handlers) and the delegation function; the token names; the table of woods-tree cells and how the walk grid reads it (and whether `buildWalkGrid`'s signature changed); the module that owns fog, the sky dome and the horizon apron, how each is hidden, and the values of `CAMERA_FAR` and the apron's outer radius (design: 460 and 240).
  4b. **Stage 4 code the zones depend on** (critique C2, H3): whether `stepMonster` passes `world.grid.walkable` to its three `moveWithCollision` calls, whether `moveWithCollision` still clamps to ±118 when given a test, and how a monster's dead time is chosen (`BOSSES[type].respawnSecs` or something per monster).
  4c. **What the two rule changes stand on** (design 7.12, 7.13). The acquisition block of `stepMonster` after Stage 4 (the idle branch, transition T2): its lines, and whether it is still Stage 2's test of `camp.aggressive`, `playerDown`, `playerSafe`, the threat colour, `aggroRadius` and the camp circle; any Stage 4 test that pins "a camp ignores a hero above its level" or Ashmantle attacking only "combat level 110 or less" (its design says so; 7.13 supersedes it). `playerAttackProfile` after Stage 4: that its ranged and magic branches are still the expressions design 7.12 writes out, and where a shot's arrow is known (`prepareAttack`). In `performPlayerAttack` (or wherever Stage 4 moved it): whether the swing's cost is still removed before `playerAttackProfile` is called (on `main`, lines 97-98; S4 depends on it). Whether Stage 4's `tests/support/bossModel.ts` calls `playerAttackProfile` (its plan B3 says it does; then S2 changes that test's numbers, and MODEL shows they hold). Whether a monster's hit still leaves a gathering hero gathering and Stage 4's auto-retaliation still skips a gatherer (design 7.13, CALL-6.29). Every existing test that pins a ranged or magic max hit, by grep for `playerAttackProfile` and `maxHit`, compared with design 11.3 items 10 and 11.
  5. **Frozen counts.** Every existing test that pins a count this stage changes: skills, monster types, overworld monsters, recipes, items, commands, interactive actions. Compare with design 11.3; anything not declared there is reported under O-6.1b.
  6. **The model on the real code.** In the content file, delete the `S3` and `S4_MONSTERS` overlays and read the game's own tables; replace `fight.ts` and `boss.ts` by imports of Stage 4's fight model; add Stage 4's two camps and Stage 5's tree cells to the placement checks; replace the far-plane check's 460 and 240 by Stage 5's constants. Point `pacing-rerun.sh` (it reads `origin/main` today) at the merged tree, so that PACE runs the real `tests/pacing.test.ts` on the real world with Stage 4's camps; its patched `attackers` expression stays as written until G1 lands it. Run `second-pass.sh` on the merged tree too and record its section A and C. Run MODEL, PACE and `critique-check.sh`. Commit the new outputs, and record PACE's kit-kill table beside design 7.13's.
- **Accept**: SG and ECON pass. The baseline file holds items 1 to 5. MODEL passes on the real code, or the file lists each failed check with the smallest change to the content file that fixes it (a coordinate, a drop chance, a boss number) and MODEL passes with those changes. `git diff main --stat` shows only files under `docs/`.
- **Stop rule**: stop and report to the main session (O-6.1b) if any of these is true: a name in items 2 to 4 does not exist and has no equivalent; `moveWithCollision` cannot take a walk test; a boss row cannot be data alone; ECON fails on `main`; a MODEL check fails and no change to the content file fixes it; a frozen test pins a count that design 11.3 does not declare; Stage 4 rewrote the acquisition block or the ranged or magic branch of `playerAttackProfile`; an assertion of PACE fails on the merged world with the new rule (then the lever is `SIGHT_GAP` or a camp row, decided with the owner, never the test).
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
- **Change**: against `src/state/saveRecovery.ts` with an in-memory `StorageLike`, and a second one whose `setItem` throws for chosen keys: `keepCorrupt(storage, raw)` does nothing when `_corrupt` already equals `raw`; otherwise shifts `_corrupt_2` to `_corrupt_3` and `_corrupt` to `_corrupt_2` and writes `raw`; returns `kept: false` for a string over 256 kB and writes nothing; when the newest write throws it removes the two older copies, tries once more, and returns `kept: false` if that also throws, with the main key untouched in every case. Every exit of the notice that releases the hold (new game, load the older save) calls `keepCorrupt` first and does not release when it returns `kept: false`; the copy-text exit never releases (tested through a pure `recoveryExit(choice, keepResult)` that returns whether to release). `legacyPreview(storage)` returns `{ key, gp, totalLevel }` for the first legacy key that parses and migrates, else `null`, and writes nothing. `shouldAutosave(hold)` is false while held. `readSave` still copies a corrupt main save to an empty `_corrupt`, still does not read the legacy keys beside a corrupt main save, and does not throw when that copy cannot be written.
- **Accept**: red until F4.
- **Must not change**: `src/`, existing tests.

### F4 Save recovery [AGY]
- **Tier**: sonnet.
- **Depends**: F3.
- **Files**: `src/state/saveRecovery.ts` (new), `src/state/save.ts`, `src/engine/session.ts`, `src/ui/hud.ts`, `index.html`, `src/ui/styles.css`.
- **Change**: Rule commit, then UI commit.
  - `saveRecovery.ts`: `keepCorrupt`, `legacyPreview`, `shouldAutosave`, `recoveryExit`, as F3. `save.ts`: a `try` around the one `setItem` in `readSave`'s catch, and `readLegacy(storage)` exported (the loop that exists today after the main key, as its own function).
  - `session.ts`: a module flag `saveHold`. `saveGameState` returns at once while it is set and sets the save button's text to "Not saving". `loadGameState` sets the flag and shows the notice when `readSave` reports `corrupt` or when `applyState` throws; it no longer prints the chat line that names the backup key. The notice (Stage 5's modal markup, a new block in `index.html`, text written with `textContent`) has three buttons wired with `addEventListener`: start a new game (`keepCorrupt`, then Stage 3's `startNewGame`, release the hold; if `kept` is false, say so and ask once more before releasing); load the older save (shown only when `legacyPreview` is not `null`; `keepCorrupt` first, exactly as for a new game, then applies `readLegacy` and releases the hold: critique H5); copy the save text (`navigator.clipboard.writeText` in a `try`, with a read-only text box as the fallback).
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

### G1 Aggression tests and the two declared replacements [CLAUDE]
- **Tier**: opus (it replaces frozen assertions of Stages 2 and 3 after the owner's rule change, and must judge that each replacement is at least as strict).
- **Depends**: R0 (Stage 4 merged: this rule lands after its route-following, patterns and phases, in the same file).
- **Files**: `tests/aggression.test.ts` and `tests/support/packAttackers.ts` (new); the declared edits to `tests/monster-territory.test.ts` (one test, design 11.3 item 8) and to `tests/support/pacingModel.ts` (one expression and one import, item 9).
- **Change**:
  - `aggression.test.ts`, against `sightRadius(base, monsterLevel, heroCombat, keepsSight)`, `SIGHT_MIN` and `SIGHT_GAP` exported from `src/state/monsterAi.ts`, and `packAttackers` from `tests/support/packAttackers.ts` (a convention of Stage 3's pacing model, not a game rule, so it is not in `src/`; G1 writes it from `docs/superpowers/research/content-model/aggro.ts`, taking the monster row and reading its level and style, and calling `sightRadius`): `SIGHT_MIN` is 3 and `SIGHT_GAP` 10; for bases 5, 9 and 12 and every level difference from -20 to 60 the radius is `base` at or below the monster's level, 3 from ten levels above, on the straight line between, never above `base`, never larger for a higher hero, and `base` whenever `keepsSight` is true; a base under 3 is returned as it is. Through `stepMonster` with a test camp and a monster that stands still: for a goblin, a goblin archer and a dark wizard, at level differences -1, 0, 1, 2, 5, 9, 10 and 30, the farthest distance (steps of 0.05) at which a standing hero is acquired equals `sightRadius` within 0.051; a passive camp acquires nobody in 600 steps at combat 1 and at combat 99; a camp with `keepsSight: true` acquires a combat-126 hero at 9. Data: of `CAMPS`, exactly `pass_sentries` and every camp with an `arenaRadius` carry `keepsSight`; the passive camps are exactly the two of today (the hen yard and Three Kettle Camp), named by id, never a count, so the three aggressive camps D4 adds do not break this test. `packAttackers(pack, monster, heroCombat)`: the whole pack at or below the monster's level, 1 from ten levels above, `4, 4, 4, 4, 3, 3, 3, 2, 2, 2, 1` for a pack of four at 0 to 10 above, and 1 for a pack of one.
  - `monster-territory.test.ts`, the test "an aggressive camp ignores a player whose combat level is above the monster's": renamed "an aggressive camp attacks at any level, from a distance that shrinks". Its first half (fifty steps, each expecting no event, then `idle`) becomes: one level above at 2 units, the step's events contain `aggro`; ten levels above at 3.5 units, fifty steps each return no event and the state is `idle`; ten levels above at 2.9 units, the events contain `aggro`. Its second half (equal level emits `aggro`) is not touched. No other test of the file is edited.
  - `tests/support/pacingModel.ts`: `const attackers = pack > 0 && monsterThreatColor(m.level, combatLevel(state)) !== 'green' ? pack : 1;` becomes `const attackers = packAttackers(pack, m, combatLevel(state));`; the import of `monsterThreatColor` is replaced by `import { packAttackers } from './packAttackers';`. The `largestAggressive` line is not edited (the second pass: excluding the sentries changes no number). Nothing else in the file and nothing in `tests/pacing.test.ts`.
- **Accept**: red until G2 (missing exports and field). The verify lists the errors, confirms the two frozen files' diffs are exactly the edits above (one test; one expression and one import), and confirms by reading that the replaced territory assertions fail on the code before G2 and that no threshold of `pacing.test.ts` moved.
- **Must not change**: `src/`; `tests/pacing.test.ts`; `tests/gate-simulation.test.ts`; `tests/phase2.test.ts`; any other assertion of the two edited files.

### G2 Aggressive and passive monsters [AGY]
- **Tier**: sonnet (the function is written out in design 7.13 and exists as `docs/superpowers/research/content-model/aggro.ts`).
- **Depends**: G1; the owner's answer to CALL-6.29 (the high trees). If it is (b) or (c), the task named in 0.5 for that answer lands with this one.
- **Files**: `src/state/monsterAi.ts`, `src/data/worldMap.ts`.
- **Change**: Rule commit, then Data commit.
  - `monsterAi.ts`: export `SIGHT_MIN = 3`, `SIGHT_GAP = 10` and `sightRadius` as in `aggro.ts`. Nothing else is exported for the rule (`packAttackers` is G1's, in `tests/support`). In the idle branch's acquisition test (transition T2), delete the condition `monsterThreatColor(m.level, world.playerCombat) !== 'green'` and replace `const aggroRadius = camp.aggroRadius ?? (...)` by `const aggroRadius = sightRadius(camp.aggroRadius ?? (...), m.level, world.playerCombat, !!camp.keepsSight)`. Remove the import of `monsterThreatColor` if nothing else in the file uses it. No other line of `stepMonster`.
  - `worldMap.ts`: `CampDef.keepsSight?: boolean`; set to `true` on `pass_sentries` and on Stage 4's `ashmantle` camp. `makeCamp` passes it through. No other camp row changes; no camp changes between aggressive and passive.
- **Accept**: `ONE(tests/aggression.test.ts)`, `ONE(tests/monster-territory.test.ts)`, `ONE(tests/gate-simulation.test.ts)` (unedited), `ONE(tests/world-data.test.ts)`, `ONE(tests/phase2.test.ts)`, ECON, Stage 4's route, pattern and boss tests; SG. The verify prints the pacing table and compares its kit kills with design 7.13's (they may differ by Stage 4's camps; every assertion must hold).
- **Must not change**: `monsterThreatColor` (it still colours the name label); the leash, return, stall, safe-zone and grace rules; chase and attack; anything Stage 4 added to the file; `aggroRadius` of any camp.

### G-6.0 Slice 0 gate [CLAUDE] + H-0 [HUMAN]
- **Tier**: opus.
- **Change**: the slice gate, with PACE. Check by reading: no new module under `src/state` calls a clock or `Math.random` (grep); `serializeState` output of the default state is byte-identical to Stage 3's golden.
- **H-0**: break the main save by hand and reload (design 11.2, the recovery item). Kill Ashmantle, reload at once: it is still gone. As a strong character walk through the scorpions and the giants: nothing comes from a distance; chop a yew among the moss guardians at combat 70: a guardian attacks within seconds (design 7.13), and what happens next is what the owner chose in CALL-6.29; as a new one, the scorpions come from a distance; cross the pass at combat 75: the sentries attack.

---

## 6.1 Slice 1: the forge's missing tiers and the roster

### D1 Content tests, slice 1 [CLAUDE]
- **Tier**: sonnet.
- **Depends**: G-6.0.
- **Files**: `tests/content-s6.test.ts` (new), `tests/names-s6.test.ts` (new), and the declared edit to `tests/content-freeze.test.ts`.
- **Change**:
  - `content-s6.test.ts`, written to read the tables, so later slices are covered without editing it: every recipe's inputs and output are own keys of `ITEMS` and its skill a key of `SKILLS_META`; every node's item exists; every drop id exists; no monster whose key is not in a fixed list of the twelve pre-Stage-6 types drops an item of type `equip`; every item whose id is not in the pre-Stage-6 golden has type `resource`, `bar` or `ammo`; for every monster without a `BOSSES` row, the summed sale value of its non-bone, non-food item drops is at most 25% of its mean coin drop, chickens excepted by name (a boss's table is held elsewhere: Saltfang's and the Kiln Warden's by the dungeon income bound of Z3, Marrowjaw's, which is on open ground and whose goods are about as much as its coins, by D3's own bound); no forging recipe added after the golden sells for less than its inputs, `smith_mithril_bolts` and `smith_rune_bolts` excepted by name; the loop audit of design 7.4: every non-equipment item has a source (node, recipe, drop) and a use (recipe input, spell, food, potion, bones, ammunition, or an `ember_` id), except the named list `salmon`, `anglerfish`, `saradomin_brew`, `bronze_bolts`, and except items a later slice closes, held in a second named list that each later test task shortens (this file's one declared kind of edit).
  - `names-s6.test.ts`: the deny-list of `tests/names.test.ts`, copied, over the `name` of every item, node, monster, recipe, person, quest, dungeon, attack and phase whose id is not in the pre-Stage-6 golden; recipes named after an existing item are excepted by a list of the five of design 7.10.
  - `content-freeze.test.ts`: add `DECLARED_NEW_NODES` and `DECLARED_NEW_RECIPES` (empty arrays subtracted from the current ids exactly as Stage 3 subtracts `DECLARED_NEW_ITEMS`; the golden is not regenerated); then the declared lists gain the ids of slice 1 from the content file: items `coal`, `steel_bar`, `black_bar`, `sting_gland`, `mire_root`; node `coal_rock`; recipes `smelt_steel`, `smelt_black`, the three steel and three black forging recipes, the three brews; monsters `cinder_adept`, `slag_brute`, `marrowjaw`.
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
- **Files**: `tests/roster-s6.test.ts` (new); the declared edits to `tests/world-budget.test.ts` 41 and `tests/world-data.test.ts` 162 (the overworld monster count, 42 to 48; design 11.3 items 4, 5), to `src/__tests__/blender-hero.test.ts` 138 (the type-key count, 13 to 16; item 6), to `tests/scatter.test.ts` 176 and 178 and `tests/woods-trees.test.ts` 134 and 240 (15 camps to 18, 42 members to 48; item 13), and to `tests/new-monsters.test.ts` 125 (`NEW` gains `cinder_adept`, `slag_brute`, `marrowjaw`; item 14).
- **Change**: the three new rows have the stats of design 7.5 and a `model` that is an existing mesh key; `cinder_circle` and `brute_shelf` pass every rule Stage 2's world-data test applies to a camp (members inside, on open cells, no safe zone, no path, no node inside), are clear of every other camp's leash, and of Ashmantle's arena plus 6; `tollmaster` passes Stage 4's arena criteria (design of Stage 4, 6.4) with radius 9 on the real grid; `BOSSES.marrowjaw` is the row of design 7.7 and passes Stage 4's attack-table test; the Adept's coin drop is 230 to 550 (critique H1); `tollmaster` carries `keepsSight` and the two other new camps do not; Marrowjaw's table ends with one Runite Bar at 0.125 (design 7.6); Marrowjaw's coins plus its non-bone, non-food drops at sale value, every entry at its chance, divided by its 180 s return, are at most 0.9 times the GP per second of the best open ground at its level, by Z3's arithmetic (about 9 GP/s against moss guardians' 79 by the content file; second pass: D1's 25% rule exempts bosses, and nothing else held this one).
- **Accept**: red until D4. The verify confirms each of the five frozen files' diffs is exactly the count or list edit named (revision of 2026-11-25: the Stage 5 and Stage 4 pins were found by running the suite on `87f18e7`).
- **Must not change**: `src/`.

### D4 Cinder Adepts, Slag Brutes, Marrowjaw [AGY]
- **Tier**: sonnet.
- **Depends**: D3.
- **Files**: `src/data/world.ts`, `src/data/worldMap.ts`, `src/data/attacks.ts`.
- **Change**: Data commit, as the content file (with R0's corrections): three monster rows with `model`, `tint`, `modelScale`, `pattern` and drops (the Adept's Cinder Silk and the Brute's Slagscale Hide are left out until K2; Marrowjaw's Tough Hide likewise); three camps (`tollmaster` with `keepsSight: true`); `toll_slam` and `camp_sweep` in `ATTACKS`; `BOSSES.marrowjaw` with `respawnSecs` 180, `arenaRadius` 9, title unset.
- **Accept**: `ONE(tests/roster-s6.test.ts)`; `ONE(tests/world-budget.test.ts)`; `ONE(tests/scatter.test.ts)`, `ONE(tests/woods-trees.test.ts)` and `ONE(tests/new-monsters.test.ts)` with D3's edits and every other assertion unedited (a clearance that fails moves a camp, never the test); ECON; SG. Marrowjaw is the one boss in `CAMPS` that Stage 3's model fighter might choose (design section 17). The verify prints the pacing model's chosen target per tier. If ECON fails or the table shows Marrowjaw being farmed, the declared fallback (critique H2) is to move Marrowjaw's camp out of `CAMPS` into a `BOSS_CAMPS` list in `worldMap.ts` that `spawns.ts` also spawns (add `src/engine/spawns.ts` to this task's allowlist for that case only), with D3's world-data rules applied to it by name, and to restore the counts of design 11.3 items 4, 5 and 13 to 47 members (17 camps); the cave (C1) then takes them to 45 and 16. Never edit the pacing test or its fighter. If ECON fails because of the Adept or the Brute, their coins move down along the moss-to-demon line, written back to the content file.
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
- **Change**: Rule commit. The types of design 7.2 and 7.3; `evalCond(state, cond)`; `openDialogue`; `chooseOption` applying every effect to a `cloneState` copy and committing it with `applyState` only when all succeed (critique M5); `talk:` keys in `STAT_KEYS` from `NPCS`. `finish` and `start` call functions of `story.ts` that Q4 adds; until then they are imported from a stub in `src/state/story.ts` that Q2 creates with the final signatures and bodies that throw "not built".
- **Accept**: `ONE(tests/dialogue-rules.test.ts)` except the cases that need Q4, which the verify lists; `ONE(tests/architecture.test.ts)`; TYPES.
- **Must not change**: `claimQuest`, `STARTER_QUESTS`.

### Q3 Story rule tests [CLAUDE]
- **Tier**: sonnet (from design 7.3).
- **Depends**: Q2.
- **Files**: `tests/story-rules.test.ts` (new).
- **Change**: on the fixture quest: `questStatus` is `none`, `active`, `done`; `startQuest` refuses when `needs` is false or the quest is active or done; `advanceStory` moves a `do` stage when its condition is true, never a `talk` stage, moves several quests in one call, and is idempotent; work done before the quest finishes the stage at once; `finishQuest` pays coin through `creditGp`, experience unmultiplied at 10x, items after the rehearsal, sets a title, moves the id from `progress.story` to `claimed`, and refuses with a full backpack leaving the quest active; `journalView` lists active, offered and done quests with counts for `stat` conditions ("2 of 4"). `adventureTracker`: with no story progress it returns exactly what it returned before (the default state, a new game, a finished chain); with an active main-line quest it shows that stage after the open starter quest and before everything else; a save with a story id in `claimed` keeps it across `writeSave` and `readSave`. `useEmber(state, itemId, skill)` removes one ember, adds its experience unmultiplied at 10x, updates the level (and hitpoints or prayer points as `grantExactXp` does), and refuses an unknown skill or an item that is not an ember. Embers (critique H6): `buyItem` refuses an item with `lampXp`; `sellInventoryMatch(state, isGatheredGood)` leaves embers in the backpack.
- **Accept**: red until Q4.
- **Must not change**: `src/`.

### Q4 Story module and tracker [AGY]
- **Tier**: sonnet.
- **Depends**: Q3.
- **Files**: `src/state/story.ts`, `src/state/adventure.ts`, `src/state/save.ts`, `src/state/inventory.ts` (the two ember guards only).
- **Change**: Rule commit. `questStatus`, `startQuest`, `advanceStory`, `finishQuest`, `journalView`, `useEmber` (an ember is an item with a `lampXp` number) as Q3. `adventureTracker` gains the two entries of design 7.3 after Stage 3's first. `save.ts`: the valid claimed ids include `STORY_QUESTS`. `inventory.ts`: `buyItem` refuses `item.lampXp`; `isGatheredGood` is false for an item with `lampXp`, and `buyItem`'s gathered-goods refusal stays where it is, so the ember is refused by the new check.
- **Accept**: `ONE(tests/story-rules.test.ts)`, `ONE(tests/dialogue-rules.test.ts)`; Stage 3's `starter-quests`, `tracker-order` and `phase3-content` tests unchanged; SG.
- **Must not change**: `QUEST_DEFS`, `STARTER_QUESTS`, `questView`, `starterView`, `claimQuest`.

### Q5 Content data tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: Q4.
- **Files**: `tests/dialogue-data.test.ts`, `tests/story-data.test.ts`, `tests/npc-placement.test.ts`, `tests/support/satisfy.ts` (all new); the declared edit to `tests/content-freeze.test.ts` (the three embers).
- **Change**: all three read the tables, so later slices are covered without edits.
  - `dialogue-data.test.ts`: the checks of design 7.2 ("the data test"), including the `<`, `&` and forbidden-word scan over every string of `NPCS`, `STORY_QUESTS`, `DIARY` and `DUNGEONS` (critique M6), and the once-only rule: every option with `give`, `take`, `finish` or `claimStarter` has a `when` that pins a stage or a starter state and an effect that moves that quest.
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
- **Change**: `buildWalkGrid()` with no arguments equals today's grid cell for cell (size 236, origin -118); with `(walk, 1000, -200, 96)` it has that origin and size and `findPath` routes on it. `zoneWalk(def, open)` is true inside a room, false outside every room, false inside a shut gate and true inside an open one. `moveWithCollision` with a walk test moves at x of 1020 and does not clamp; without one it behaves as today. Through `stepMonster` with a zone grid (critique C2): a monster at x 1020 chases, returns and wanders and stays inside the zone's rooms. `createMonsterLogic(type, x, z, { respawn: false })` (critique H3): after dying it stays `dead` for 10 simulated minutes, while a monster of the same type without the option respawns as today. `getTerrainHeight(1000, 0)` is 0; Stage 2's terrain golden is unchanged. `canEnter(state, def)` equals `evalCond(state, def.needs)`: refused below the combat level and before the quest stage that opens the door, allowed at it and after the quest is done. `zoneSafe(def, x, z)` is true within 6 of the entry and false elsewhere. Through `stepMonster` with the camps `zoneCamps` returns for the fixture: every one is aggressive and has `keepsSight: true`, and a zone monster acquires a hero 60 combat levels above it at its full radius (no dungeon rule exists: this is G2's rule with the camp's flag). `runStep`: a camp's death opens a gate only when every camp it names is dead; the boss's death arms the chest. `openChest(state, def, run, rand)`: refused while the boss lives; pays the fixed part of `loot` and coins in range; pays a rare entry exactly when the injected value for it is under its chance (a `rand` of 0 pays every rare entry, a `rand` of 0.999 none); over 20,000 seeded opens each rare entry's rate is within 15% of its chance; with a full backpack pays nothing, stays armed and pays the SAME roll when opened again with room (the roll is kept in the run, so a full backpack is not a second roll); bumps `clear:<id>` and `clears`; keeps the smaller `best`; the `Dungeon` type has no field for a once-only reward. **A quest's reward is paid once** (design 7.3), on the fixture quest with a `do` stage `{ stat: ['clear:<fixture>', 1] }`: three clears pay three chest rolls, `advanceStory` moves the quest once, `finishQuest` pays its reward once and is refused a second time; with the counter already at 1 before the quest starts, the stage is done at once and the reward is still paid once. `zoneCamps(def)` returns `CampDef` rows in world coordinates with `arenaRadius` kept and ids prefixed `<dungeon id>:` (critique L2). `savedPose(pose, zone)` returns the door when a zone is given.
- **Accept**: red until Z2.
- **Must not change**: `src/`.

### Z2 Zone rules [AGY]
- **Tier**: sonnet.
- **Depends**: Z1.
- **Files**: `src/state/dungeon.ts` (new), `src/state/pathfind.ts`, `src/state/collision.ts`, `src/state/terrain.ts`, `src/state/monsterAi.ts`, `src/state/progress.ts`, `src/data/worldMap.ts` (the type only), `src/data/dungeons.ts` (new, types and an empty table).
- **Change**: Rule commit. `buildWalkGrid(walkable = isWalkable, origin = -118, originZ = origin, size = 236)` and `WalkGrid.originZ`; every reader of `grid.origin` for the z axis uses `originZ`. `moveWithCollision`: when a walk test is passed, no clamp. `stepMonster`: its three `moveWithCollision` calls pass `world.grid?.walkable` (critique C2). `createMonsterLogic` gains `opts.respawn?: boolean`; with `false`, `dead` never returns to `idle` (critique H3). `getTerrainHeight`: `if (x >= 400) return 0;` as its first line. `dungeon.ts`: the `Dungeon` type's functions of Z1 and `DungeonRun = { id, startedAt, deadCamps: string[], bossDead: boolean, chestOpen: boolean, roll?: { id: string; qty: number }[] }`. `clear:` keys in `STAT_KEYS` from `DUNGEONS`. `Dungeon.needs` is a `Cond` and `Dungeon.loot` the table of design 7.6; `zoneCamps` returns aggressive camps with `keepsSight: true` (G2's field; `stepMonster`'s acquisition rule is not edited here); `openChest` rolls each rare entry once per run with the injected `rand` and keeps the roll in `DungeonRun.roll` until it is paid; `zoneSafe`.
- **Accept**: `ONE(tests/zone-rules.test.ts)`; `ONE(tests/pathfind.test.ts)`, `ONE(tests/terrain-golden.test.ts)`, `ONE(tests/reachability.test.ts)`, `ONE(tests/monster-territory.test.ts)`, `ONE(tests/gate-simulation.test.ts)`, Stage 4's route tests unchanged; SG.
- **Must not change**: `isWalkable`; A* itself; any height for x below 400; the acquisition rule of `stepMonster` (G2 owns it); any row of `CAMPS`; the behaviour of `stepMonster` when `world.grid` is absent and of a monster created without the `respawn` option.

### Z3 Dungeon data test and slice 3 content tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: Z2.
- **Files**: `tests/dungeon-data.test.ts` (new); declared edits to `tests/content-freeze.test.ts` (ids of slice 3: `adamantite_ore`, `adamant_bar`, `adamantite_rock`, `smelt_adamant`, the three adamant forging recipes, `scree_skitter`, `saltfang`), to the "closed later" list of `tests/content-s6.test.ts`, to `src/__tests__/blender-hero.test.ts` 138 (type keys 16 to 18), and to `tests/new-monsters.test.ts` 125 (`NEW` gains `scree_skitter`, `saltfang`); `tests/support/income.ts` (new).
- **Change**: `dungeon-data.test.ts` reads `DUNGEONS`: rooms inside the zone with a 2-cell margin and at least 6 wide; every member inside its room and of a known type; with gates open every open cell is reachable from the entry; with gates shut neither the boss's cell nor the chest is; the arena fits its room; the zone is at least 400 from the overworld's bound and from every other zone; the door is on an open overworld cell, outside every camp's leash and every arena plus 6, at least 3 from every node; every node in a zone is on an open cell; every id of the chest's `loot` exists, every chance is above 0 and at most 1, an entry whose item is equipment has a chance of at most 0.05 (Stage 3's boss cap), and no dungeon row has a reward field other than `loot`; no monster of a zone or boss row drops equipment; every zone camp is aggressive (`zoneCamps` gives it `keepsSight`); the ratio of a run's pay to the best open ground's, for the model fighter, is at most 0.9, by the arithmetic of design 7.6 and `model.ts` section 8 (the same fighter and no rests on both sides; every non-bone drop counted at sale value on both sides, the boss's included, and every chance entry of a boss or a chest at its chance; open-ground candidates up to ten levels above the fighter's skills; open ground pays per kill with 1.5 s to the next monster or the camp's shared respawn wait, whichever is longer; the dungeon pays its monsters and chest over the fights plus the walk between room centres times 1.5). The test asserts the dimensionless ratio, never a duration (Stage 3's rule 10). Every zone node is created without respawn. The income arithmetic is written once, in `tests/support/income.ts`: `openGroundBest(level)` (the best open-ground type and its GP per second, by the rule above) and `campRate(types, level)` (a camp of those member types killed in turn: its coins and goods over the longer of the summed kill times plus 1.5 s each, and the respawn wait plus the slowest kill). The cave's test (C1) reads the same two functions.
- **Accept**: passes vacuously until Z4.
- **Must not change**: `src/`.

### Z4 Saltfang Warren, as data [AGY]
- **Tier**: sonnet.
- **Depends**: Z3.
- **Files**: `src/data/dungeons.ts`, `src/data/world.ts`, `src/data/extras.ts`, `src/data/recipes.ts`, `src/data/attacks.ts`.
- **Change**: Data commit, as the content file: the dungeon row and its `loot` (3 to 5 adamantite ore, 1 to 2 Tough Hide, 100 to 300 GP; rare: a Rune Crossbow at 0.05); `scree_skitter` and `saltfang` rows (hers ends with 3 Adamant Bars at 0.2); `adamantite_rock`, `adamantite_ore`, `adamant_bar`, `smelt_adamant` and the three adamant forging recipes; `sting_arc`, `brine_spit` and `BOSSES.saltfang` (`respawnSecs` unset: a zone monster does not respawn).
- **Accept**: `ONE(tests/dungeon-data.test.ts)`, `ONE(tests/content-s6.test.ts)`; ECON (zone camps are not in `CAMPS`); SG.
- **Must not change**: `CAMPS`.

### Z5 Chapter 3 and the door's words [CLAUDE]
- **Tier**: opus (writing).
- **Depends**: Z4.
- **Files**: `src/data/story.ts`, `src/data/dialogue.ts`.
- **Change**: `ml_salt` with the stages and reward of design 7.3 (the reward carries the 8 Adamant Bars and the title Warrenbreaker that the first draft's chest paid once); Qadir Salt-Hand's and Odalys Venn's nodes for it; the dungeon's `needs.quest` satisfied from the stage where Qadir opens the door.
- **Accept**: Q5's three data tests; SG.
- **Must not change**: earlier passages, except "come back when" lines this chapter replaces.

### Z6 A room to stand in [AGY]
- **Tier**: sonnet.
- **Depends**: Z2. May run beside Z4.
- **Files**: `src/engine/zones.ts` (new), `src/engine/context.ts`, `src/engine/loop.ts`, `src/engine/input.ts`, `src/engine/overlay.ts`, `src/engine/actions.ts`, and Stage 5's sky module as R0 names it (`src/engine/sky.ts` in its design), for a `setSkyVisible(on)` only.
- **Change**: Engine commit. `G.zone: { def, run, grid, group } | null`. `enterZone(def)`: build the zone grid; build one merged floor mesh and one merged wall mesh from the room rectangles (walls 4 units high along every room edge not shared with another room, flat-shaded, the existing painted stone tile), the gate slabs, props from an optional `props` list in the row (existing `world.glb` nodes); set `G.walkGrid`; register the floor mesh for ground picking exactly as the terrain mesh is (a new field `G.groundMesh` holds the terrain mesh in the overworld and the zone's floor in a zone; the three places in `input.ts` that compare a hit with `G.terrainMesh` compare with `G.groundMesh`; the floor carries `userData.type = 'ground'` and is in the raycast list); move the hero to `entry` with the aggression grace; set fog dense and dark and remember the old values; hide the sky dome and the horizon apron (Stage 5's dome follows the camera: critique C1). `leaveZone()`: dispose the group with `disposeObject3D`, restore the grid, fog, dome and apron, put the hero at the door. The hero's step passes `G.walkGrid.walkable` to `moveWithCollision`. Teleport, shrine travel and respawn call `leaveZone()` first when `G.zone` is set. The minimap draws the room rectangles and gates when in a zone. A debug entry on `window.__DEBUG` enters a zone by id.
- **Accept**: SG. [HUMAN] (part of H-3, done here before Z7): the bare room with the hero in it; the overworld, the sky, the apron and any cloud are not visible at every camera yaw, the lowest pitch and the longest distance; the hero cannot leave the rooms; clicking the floor walks.
- **Must not change**: the overworld build; `updateMonsters` (Z7).

### Z7 Monsters, gates, the chest, the door [AGY]
- **Tier**: sonnet.
- **Depends**: Z4, Z6.
- **Files**: `src/engine/zones.ts`, `src/engine/spawns.ts`, `src/engine/loop.ts`, `src/engine/worldBuild.ts`, `src/engine/session.ts`, `src/engine/actions.ts`, `src/state/commands.ts`.
- **Change**: Engine commit. Commands `enterDungeon`, `leaveDungeon`, `openChest` with pure appliers over state and run. A door object at each dungeon's `door` (the existing sandstone arch node for the Warren) with `action: 'door'`: its dialogue-style prompt names the dungeon, its level and what it needs. `enterZone` spawns the zone's members through `spawnMonster` with the prefixed zone camp id and `respawn: false` (Z2) and the zone's nodes through `spawnResourceNode` without respawn (one gather a run); `leaveZone` removes and disposes them. `updateMonsters` steps only monsters of the current space and passes the zone's grid and `zoneCamps` to `stepMonster`; while in a zone the `playerSafe` it passes is `zoneSafe(def, x, z)` or the grace, not the overworld's `isPlayerSafe`. On a `died` event in a zone the engine calls `runStep`; when gates open it rebuilds the grid and removes the slab. The chest is an interactive object that dispatches `openChest` with `Math.random`. `saveGameState` writes `savedPose(pose, G.zone?.def)`.
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
- **Change**: read every passage Z5 added or changed once for sense, voice and the rules of Q6, and list any to rewrite (critique M7); the slice gate of 0.2 (SG, ECON, MODEL); the diff of the slice against its tasks' allowlists; no frozen test edited beyond the declared ones.
- **H-3**: talk to Qadir Salt-Hand and Odalys Venn through chapter 3; design 11.2, the dungeon item: enter; the rooms, the minimap, the gate, the chest, the way out; die inside; reload inside; teleport out. Fight Matron Saltfang with a mouse and a trackpad. Perf HUD inside.

---

## 6.3a Slice 3a: the demons' cave

Design 7.5 (the Ember Hurler), 7.6 ("The demons' cave") and the "Approved package" of `docs/superpowers/proposals/2026-11-24-call-6.30-demons-cave.md` (owner, 2026-11-24). It needs slice 3's zone mechanism (Z2, Z6, Z7) and Z3's income arithmetic. Every line number "on `87f18e7`" is the merged tree of Stages 1 to 5.

### O-6.33 The cave's income bound [OWNER]
The main session shows the owner design 7.6's measurement (against the package's 0.9 of the best open ground at level 70: the front hall 0.94, the back hall 0.87, both halls in turn 0.73) and CALL-6.33's four options. The answer sets C1's bound and what C2 adds (table 0.5). Nothing of slice 3a starts before it.

**Answered 2026-11-25: option (a)**, a 13.5 s wait from death to return inside the cave (design 15.1). Table 0.5's row (a) applies; C1 asserts at most 0.9 for each hall with that wait.

### C1 Cave and Ember Hurler tests, and the declared count edits [CLAUDE]
- **Tier**: sonnet (written from design 7.5, 7.6 and the owner's answer to CALL-6.33).
- **Depends**: G-6.3, O-6.33.
- **Files**: `tests/cave.test.ts` (new). Declared edits (design 11.3): `tests/content-freeze.test.ts` (`DECLARED_NEW_MONSTERS` gains `ember_hurler`; item 1); `tests/world-budget.test.ts` 41 and `tests/world-data.test.ts` 162 (48 to 46; items 4, 5); `src/__tests__/blender-hero.test.ts` 138 (18 to 19; item 6); `tests/scatter.test.ts` 176 and 178 and `tests/woods-trees.test.ts` 134 and 240 (18 camps to 17, 48 members to 46; item 13); `tests/new-monsters.test.ts` 125 (`NEW` gains `ember_hurler`; item 14).
- **Change**: `cave.test.ts`, against `CAVES` and `DUNGEONS` (`src/data/dungeons.ts`), `zoneWalk`, `zoneCamps`, `zoneSafe`, `canEnter`, `zoneRespawns` (`src/state/dungeon.ts`), `buildWalkGrid` and `findPath` with Z2's signatures, `stepMonster`, `CAMPS`, `POIS`, `MONSTER_TYPES`, `PATTERNS`, and `openGroundBest`, `campRate` from `tests/support/income.ts` (Z3):
  - **The row.** `CAVES` holds one row, `slagfall_cave`, named "Slagfall Terrace", origin (1000, 600), size 96, door (-84, 98), entry (12, 34), and the rooms, camps, members and `solid` rectangles of design 7.6's table, written out in the test. `needs` is `{ all: [] }`, and `canEnter` is true for a new game. The row has no `gates`, `nodes`, `chest` or `loot` field.
  - **The package's rules.** Each camp holds at most 4. The cave holds 3 `lesser_demon` and 3 `ember_hurler`: camp `front` 2 and 1, camp `back` 1 and 2. Every Hurler's home is more than 12 from `entry`. Every home of one camp is more than 12 from every home of the other.
  - **Walking.** On `buildWalkGrid(zoneWalk(cave, []), 1000, 600, 96)`: every open cell is reachable from the entry by `findPath`; no point inside a `solid` rectangle is walkable, and a dungeon fixture with a `solid` rectangle is not walkable inside it either; every member's home is on an open cell inside its room; every room lies inside the zone with a 2-cell margin and is at least 6 wide. The door (-84, 98) passes Z3's door rules (an open overworld cell, outside every camp's leash and every arena plus 6, at least 3 from every node). The cave's origin is at least 400 from every `DUNGEONS` origin. `zoneSafe(cave, 1012, 634)` is true, and false 6.1 from the entry.
  - **Rules.** `zoneRespawns(cave)` is true, and false for both rows of `DUNGEONS`. `zoneCamps(cave)` returns two aggressive camps, `slagfall_cave:front` and `slagfall_cave:back`, with `keepsSight: true` and no `aggroRadius`. Through `stepMonster` with the cave grid and those camps: an idle Lesser Demon acquires a combat-126 hero standing 8.9 away and not one standing 9.1 away; an idle Ember Hurler acquires one at 11.9 and not at 12.1. A member created with `respawn: zoneRespawns(cave)` is back at home and `idle` after `DYING_SECS` plus `DEAD_SECS` of steps. `sendHome` on an Ember Hurler in `attack` with a `windup` set puts it at its home, `idle`, with full hp and `windup` null; on a `dead` member it changes nothing.
  - **The overworld.** `CAMPS` has no camp `slagfall_terrace` and no member within 12 of (-84, 98). `pass_sentries` holds the four Lesser Demons at (-42, 55), (-37, 55), (-27, 55) and (-22, 55), each with `wander` 1. `POIS` still holds `slagfall_terrace` (the cave mouth).
  - **The Ember Hurler.** `MONSTER_TYPES.ember_hurler`: name "Ember Hurler", level 66, hp 105, maxHit 19, atk 64, def 44, style `ranged`, pattern `dark_ranger` (whose fourth entry is `pinning_volley`), model `lesser_demon`, tint `0xb8b2a7`, modelScale 0.85, and the Lesser Demon's `scale`, `bodyColor`, `accentColor`, `weaponColor` and `kind`. Its drops, in order: `dragon_bones` 1; coins 340 to 760 at 1; `shark` 0.5; 2 `ashes` 0.5. (Slagscale Hide 0.10 is appended by K2, and K1 asserts it.) No drop is an item of type `equip`. `MONSTER_TYPES.lesser_demon` deep-equals its row before the task.
  - **The orb.** A source scan of `src/engine/actions.ts`: the branch that calls `spawnHellfireOrb` tests `monster.typeKey === 'lesser_demon' || monster.typeKey === 'ember_hurler'`, and no other line names `ember_hurler`.
  - **The income bound**, as the owner answered CALL-6.33 (table 0.5): with every fighting skill at 70, `campRate` of camp `front`, of camp `back`, and of both in turn with the walk between the halls' centres (32 units, times 1.5, both ways, at 11.5 units a second, as Z3 walks a dungeon), each divided by `openGroundBest(70).rate`. The test prints the three ratios (0.94, 0.87 and 0.73 on `87f18e7` with the Hurler's hide counted) and asserts the bound the owner set. Until K2 the hide is absent and each ratio is a little lower; the test reads the tables, so K2's slice gate checks it again.
  - **The cave's light.** `CAVE_LIGHT` (`src/data/look.ts`) is exactly: `phase` 0, `sunElevationDeg` 90, `key` `'#ff7a3a'`, `keyIntensity` 0.3, `zenith` `'#2a120c'`, `horizon` `'#2a120c'`, `air` `'#3b1a12'`, `fill` `'#120a1a'`, `bounce` `'#ff6a1f'`, `exposure` 1.2 (design 7.6's words, as the lead's starting values; H-3a may ask to retune them, and the retune is a [CLAUDE] data edit of this row and this assertion only). `frameOf(key)` (`src/state/dayCycle.ts`) gives `sunDir` [0, 1, 0], `keyIsMoon` false and the key's exposure and intensity, and for `DAY_KEYS[2]` and `DAY_KEYS[3]` it equals `dayFrameAt` at their phases within 1e-6 in every colour. `DAY_KEYS` still has six rows. `CAVE_FOG_SCALE` (`look.ts`) is 3, the lead's starting value for design 7.6's dense red-brown fog (above `ash_fall`'s 1.5; H-3a may retune it as the light), and `getWeatherState` returns it as `fogScale` while `setCaveWeather(true)` is on.
- **Accept**: red until C2 and C3 (the missing table, functions, row and branch). The verify lists the errors, and confirms each frozen file's diff is exactly the edit named above.
- **Must not change**: `src/`; any other assertion of the seven edited files; `tests/gate-simulation.test.ts`, `tests/monster-patterns.test.ts`, `tests/sustain.test.ts` (the sentries).

### C2 The cave and the Ember Hurler, as rules and data [AGY]
- **Tier**: sonnet.
- **Depends**: C1.
- **Files**: `src/state/dungeon.ts`, `src/state/monsterAi.ts` (`sendHome` only), `src/data/dungeons.ts`, `src/data/world.ts`, `src/data/worldMap.ts`.
- **Change**: Rule commit, then Data commit.
  - `dungeon.ts`: the type `Zone` (`id`, `name`, `origin`, `size`, `door`, `entry`, `rooms`, `camps`, `needs`, `solid?: [number, number, number, number][]`) and `Dungeon = Zone & { gates, nodes, chest, loot }`. `zoneWalk`, `zoneCamps`, `zoneSafe`, `canEnter` and `savedPose` take a `Zone`. `zoneWalk` treats a zone without `gates` as having none and returns false inside a `solid` rectangle. A zone camp row's `aggro` becomes optional; without it, `zoneCamps` leaves `aggroRadius` unset (the camp is still aggressive). `zoneRespawns(zone)` returns `!('chest' in zone)`.
  - `monsterAi.ts`: `export function sendHome(m: MonsterLogic): void`. A member that is not `dying` or `dead` is put at its home and reset as `resetToIdle` does (the end of the return path: `idle`, full hp, `windup` null). A dying or dead member is not changed. No other line of the file.
  - `dungeons.ts`: `export const CAVES: Zone[]` with the one row of design 7.6.
  - `world.ts`: the `ember_hurler` row, placed after `thornwatch_marksman`, as C1 asserts. The 2 ashes are written as D4 writes the Cinder Adept's (`{ id: 'ashes', chance: 0.5, qty: 2 }`).
  - `worldMap.ts`: delete the `makeCamp('slagfall_terrace', ...)` entry (lines 230-233 on `87f18e7`). Nothing else.
- **Accept**: `ONE(tests/cave.test.ts)` except the orb scan and the light cases (C3); `ONE(tests/zone-rules.test.ts)` and `ONE(tests/dungeon-data.test.ts)` unchanged; `ONE(tests/gate-simulation.test.ts)`, `ONE(tests/world-data.test.ts)`, `ONE(tests/monster-patterns.test.ts)`, `ONE(tests/sustain.test.ts)`, `ONE(tests/scatter.test.ts)`, `ONE(tests/woods-trees.test.ts)`, `ONE(tests/new-monsters.test.ts)`, `ONE(tests/content-s6.test.ts)`, `ONE(tests/names-s6.test.ts)`; ECON; MODEL; SG except those C3 cases.
- **Must not change**: the `lesser_demon` row; `pass_sentries` and every other camp; `POIS`; the rows of `DUNGEONS`; `runStep`, `openChest`; `createMonsterLogic` (unless the owner chose CALL-6.33 (a), table 0.5).

### C3 The cave in the engine [AGY]
- **Tier**: sonnet.
- **Depends**: C2, Z6, Z7, O-6.33.
- **Files**: `src/engine/zones.ts`, `src/engine/spawns.ts`, `src/engine/loop.ts`, `src/engine/worldBuild.ts`, `src/engine/actions.ts`, `src/engine/lighting.ts`, `src/engine/particles.ts`, `src/state/commands.ts`, `src/state/dayCycle.ts`, `src/data/look.ts`.
- **Change**: Rule commit (`frameOf` in `dayCycle.ts`), Data commit (`CAVE_LIGHT` and `CAVE_FOG_SCALE` in `look.ts`), then Engine commit (the rest). The engine treats a zone as a cave when its row is in `CAVES`.
  - `actions.ts`, `performMonsterRetaliation`, line 495 on `87f18e7`: `} else if (monster.typeKey === 'lesser_demon') {` becomes `} else if (monster.typeKey === 'lesser_demon' || monster.typeKey === 'ember_hurler') {`. No other line of the function.
  - The door: `worldBuild.ts` builds a door object at each `CAVES` row's `door`, as Z7 builds the Underkiln's (the signpost builder's posts, charcoal), with `action: 'door'`. Its prompt names "Slagfall Terrace" and says nothing is needed. `commands.ts`: Z7's `enterDungeon` command accepts a `CAVES` id; a cave makes no `DungeonRun`.
  - `zones.ts`: `enterZone(def)` for a cave builds as Z6 does, with walls 6 high in charcoal (`0x2b2622`), the floor textured with `loadAlbedo(biomeAlbedoId('peak-volcanic'), GROUND_REPEAT)` (`src/engine/textures.ts`, the volcanic ground tile), a `World_obsidian_spire` on each `solid` rectangle's centre, and a `World_lava_fissure` every 8 units along each wall's inner face, its material emissive ember. On the first entry in a session it spawns the members through `spawnMonster` (`spawns.ts`) with the prefixed camp ids and `respawn: zoneRespawns(def)`. `leaveZone()` from a cave hides the cave's group and keeps it (no dispose). It moves the cave's monsters out of `G.monstersList` into a held list on the cave's zone state, hidden; a later entry shows the group and puts them back. Before a living member is held, `sendHome` (C2) puts it at its home, `idle`, its `windup` cleared, so no telegraph survives the door; dead and dying members keep their timers (design 7.6). `G.monstersList` holds no cave monster while the hero is outside: `loop.ts` (the `sinceCombat` reset), `actions.ts` (`windupLive` in `maybeRetaliate`) and `overlay.ts` (minimap dots and name labels) read every entry of it. Nothing of the cave is saved.
  - `loop.ts`: `updateMonsters` steps the cave's monsters only while the hero is in the cave (Z7's rule; they keep their timers while hidden). `updateCamera`: while in a cave, the arm's horizontal length shrinks in steps of 0.25, not below `CAMERA_LIMITS.distanceMin` times the cosine of the pitch, until `G.walkGrid.walkable(camTargetX, camTargetZ)` is true.
  - `look.ts`: `export const CAVE_LIGHT: DayKey` with the values C1 asserts, and beside it `export const CAVE_FOG_SCALE = 3`. It is not added to `DAY_KEYS`.
  - `dayCycle.ts`: `export function frameOf(k: DayKey): DayFrame`, each colour through `hexToLinear`, `keyIntensity` and `exposure` as given, `sunDir` [0, 1, 0], `keyIsMoon` false. `dayFrameAt` is not edited.
  - `lighting.ts`: one function returns the frame to apply: inside a cave `frameOf(CAVE_LIGHT)`, built once; elsewhere `dayFrameAt(currentPhase)`. `currentDayFrame` (line 114 on `87f18e7`) and the frames `updateLighting` applies (lines 66 and 204) read it; line 157 (the first shadow direction) does not. The phase keeps stepping, so the saved clock runs on.
  - `particles.ts`: `export function setCaveWeather(on: boolean)`. While on, `getWeatherState` returns `{ id: 'ash_fall', blend: 1, curr, prev, keyScale: 1, fogScale: CAVE_FOG_SCALE }` with `curr` and `prev` the `ash_fall` row of `WEATHER` (its glowing ember motes and grey motes), and the fall mesh is hidden. `zones.ts` calls it on entering and leaving a cave. `WEATHER` gains no row. This fog scale, not Z6's fog write, holds the cave's density: `updateLightingFrame` (`lighting.ts` 213 on `87f18e7`) writes `AIR.uFogDensity` from `weather.fogScale` on every frame.
- **Accept**: `ONE(tests/cave.test.ts)` whole; `ONE(tests/architecture.test.ts)`; SG; BUILD's chunk size recorded against design section 10. [HUMAN] in H-3a.
- **Must not change**: dungeon zones' behaviour (Z6, Z7: they are still built per run and disposed); `dayFrameAt`; the saved clock; overworld lighting, fog and weather; every other branch of `performMonsterRetaliation`.

### G-6.3a Slice 3a gate [CLAUDE] + H-3a [HUMAN]
- **Tier**: opus (verification).
- **Change**: the slice gate of 0.2 with PACE (`CAMPS` changed): the pacing table's chosen target per tier is printed and compared with R0's, and the sentries' 4 are still the largest Lesser Demon camp; the diff of the slice against its tasks' allowlists; the seven frozen files' diffs are exactly C1's declared edits.
- **H-3a**: design 11.2, the cave item: enter at the terrace, fight both rooms, step out and back in, die inside, reload inside, teleport out. Leave by the door while a Hurler winds up Pinning Volley, then on the overworld be hit by a goblin: the hero fights back. The light, the seams and the camera at every yaw and pitch. Perf HUD inside. O-6.2 searches "Ember Hurler".

---

## 6.3b Slice 3b: line of sight

Design 7.13, "Line of sight" (CALL-6.32, owner, 2026-11-24): a monster fires a ranged or magic attack only if `segmentWalkable` holds from it to the hero; otherwise it closes in. A slice of its own, after the cave, so the cover can be tested on the cave's pillars and checked by a person standing behind one.

### L1 Line-of-sight tests and the declared replacement [CLAUDE]
- **Tier**: opus (it replaces a frozen digest after the owner's rule change, and must show the replacement is at least as strict).
- **Depends**: G-6.3a.
- **Files**: `tests/line-of-sight.test.ts` (new); `tests/fixtures/size-refactor-golden.json` (the `monsters` key only; design 11.3 item 15).
- **Change**:
  - **Before writing**, on the branch as it stands: copy the scene of `monsterTrace` in `tests/size-refactor-golden.test.ts` (the wall `Math.abs(x) < 0.6 && Math.abs(z) <= 8`, the five monsters, the 1,800 steps) into the new test as a function that returns one digest per monster. Write the goblin's, scorpion's, dark wizard's and hill giant's digests into the new test as constants, with the commit they were taken on. Then, on a scratch copy of the branch with exactly L2's four edits, compute the whole trace's digest with `GOLDEN_WRITE=1`, and put it into the fixture's `monsters` key (on `87f18e7` it is `5e5eb89906dbee5772c106f4fadefa7dff1087d586f021600d920f57e4f283f8`, from `f3c2f70d9ac992a39e6d7d52fcf1e181935e1f249dabbd25a4f65d78dd69e957`). `plans` and `telegraphs` stay byte-identical.
  - `line-of-sight.test.ts`, on a walk grid with the same wall inside ±118, `dt` 1/60, a seeded `rand`:
    1. **No shot through a wall.** For each of `goblin_archer`, `dark_ranger`, `thornwatch_marksman`, `dark_wizard`, `elvarg_dragon`, `cinder_adept`, `ember_hurler`, and `ashmantle` (camp id `ashmantle`, the hero inside its arena circle of its home): the monster at (-4, 0) is pulled by `onPlayerHit(m, 0)` and the hero stands at (4, 0), 8 away, across the wall. No step emits `attack` or `windup` while `segmentWalkable(grid, [m.x, m.z], [4, 0])` is false. Within 900 steps the monster emits `attack` or `windup`, and on that step the segment is walkable.
    2. **Open ground as today.** The same eight with no wall: `attack` or `windup` within 120 steps, Ashmantle within 240 (its 2 s opening shift and 1 s first entry).
    3. **Melee does not need the line.** `goblin` and `lesser_demon` at (-1.2, 0), the hero at (1.2, 0), the wall between: `attack` within 120 steps.
    4. **No grid, no rule.** A goblin archer at (-4, 0), the hero at (4, 0), `world.grid` absent: `attack` within 120 steps.
    5. **A started wind-up resolves.** A `dark_ranger` with no wall, `patternIdx` 3 and `attackCooldown` 0, emits `windup` for `pinning_volley`; the following steps use the grid with the wall and the hero does not move; the `resolve` event comes with `hit: true`.
    6. **Acquisition.** An idle `dark_wizard` in an aggressive test camp (radius 12, `keepsSight`) at (-4, 0), the hero at (4, 0) across the wall at combat 1: the step emits `aggro` and not `attack`.
    7. **The cave's pillar.** On the cave's grid (C1), an Ember Hurler at its home (1074, 628), pulled; the hero at (1066.8, 633.4), 9 away, with the pillar [1069, 630, 1071, 632] between (the test first asserts the segment is not walkable): no `attack` or `windup` while the segment is blocked, and one within 900 steps once it is clear.
    8. **The golden's four.** The per-monster digests of the goblin, scorpion, dark wizard and hill giant equal the constants above; in that scene Ashmantle emits no `attack` or `windup` on a step where its segment to the hero is not walkable.
- **Accept**: red until L2. Cases 1 to 6 were run on a scratch copy of `87f18e7` with L2's edits for the six types that exist there (2026-11-25): every type held its fire while the wall cut the line and fired within 144 steps (Ashmantle 179); with no wall all fired at once (Ashmantle at 179); melee, no grid, the wind-up and the acquisition held. The verify runs the file on the code before L2 and lists the failures: cases 1, 6, 7, and the Ashmantle half of case 8, and `tests/size-refactor-golden.test.ts` ("every monster step on a walk grid is unchanged"). Cases 2 to 5 and the four digests pass before and after. The fixture's diff is the one key.
- **Must not change**: `src/`; `tests/size-refactor-golden.test.ts`; the fixture's `plans` and `telegraphs`; any other test.

### L2 Line of sight [AGY]
- **Tier**: sonnet.
- **Depends**: L1.
- **Files**: `src/state/monsterAi.ts`.
- **Change**: Rule commit, exactly these four edits (lines on `87f18e7`; find them by the expressions quoted):
  1. After `attackRange` (line 165), a module function, not exported:
     `function lineClear(m: MonsterLogic, world: StepWorld): boolean { return attackRange(m) === MELEE_RANGE || !world.grid || segmentWalkable(world.grid, [m.x, m.z], [world.playerX, world.playerZ]); }`
  2. The chase branch (line 355): `if (distToPlayer > attackRange(m)) {` becomes `if (distToPlayer > attackRange(m) || !lineClear(m, world)) {`.
  3. The repath (line 392): the fourth argument of `entityGoal(world.grid, start, [world.playerX, world.playerZ], attackRange(m))` becomes `attackRange(m) > MELEE_RANGE ? MELEE_RANGE : attackRange(m)`.
  4. The first strike on acquisition (line 465): `if (distToPlayer <= attackRange(m)) {` becomes `if (distToPlayer <= attackRange(m) && lineClear(m, world)) {`.
- **Accept**: `ONE(tests/line-of-sight.test.ts)`; `ONE(tests/size-refactor-golden.test.ts)` with L1's fixture; unedited and green: `ONE(tests/monster-territory.test.ts)`, `ONE(tests/monster-routes.test.ts)`, `ONE(tests/monster-patterns.test.ts)`, `ONE(tests/monster-ai.test.ts)`, `ONE(tests/boss-phases.test.ts)`, `ONE(tests/stage2-review-fixes.test.ts)`, `ONE(tests/gate-simulation.test.ts)`, `ONE(tests/aggression.test.ts)`, `ONE(tests/cave.test.ts)`; ECON; MODEL; SG.
- **Must not change**: `attackRange`, `MELEE_RANGE`, `FAR_RANGE`; `segmentWalkable`, `entityGoal` (`pathfind.ts`); the acquisition test G2 wrote; `stepWindupAndRecovery`, `patternAttack`; any file but `monsterAi.ts`.

### G-6.3b Slice 3b gate [CLAUDE] + H-3b [HUMAN]
- **Tier**: opus (verification).
- **Change**: the slice gate of 0.2; the slice's diff is `src/state/monsterAi.ts`, the new test and the fixture's one key; L2's diff is exactly the four edits; the four per-monster digests hold.
- **H-3b**: design 11.2, the cover item: stand behind a cave pillar and a wall corner from a Hurler, behind the castle wall from a dark wizard, across the river from goblin archers. Judged for: they walk round to get a shot and never shoot through.

---

## 6.4 Slice 4: Crafting

### K1 Crafting tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: G-6.3b (the `ember_hurler` row of C2 exists, and slice 3a's edits to `src/data/world.ts` and `tests/content-freeze.test.ts` have landed).
- **Files**: `tests/crafting.test.ts` (new); declared edits: `tests/content-freeze.test.ts` (8 materials, 16 recipes), the "closed later" list, the two Stage 3 goldens regenerated with `UPDATE_GOLDEN=1` after K2, and Stage 2's `tests/fixtures/save-relocation/v4-loaded.json` edited by hand (the verify confirms each of the three diffs is one added `crafting` entry under `skills`).
- **Change**: `SKILLS_META.crafting` exists; a new game and a loaded version-4 save have Crafting 1 with 0 XP; each of the sixteen recipes can be made at its level with its inputs and not one level below; `recipesFor('bench')` returns exactly the recipes of kind `craft`, `recipesFor('forge')` what the forge shows today plus the new smithing and cooking rows, and no recipe is in two stations; `unlocksAt('crafting', n)` returns the row of design 7.4 at each level; the actions-to-level table of `results.txt` section 4 within one action; the material drops are the last entries of their tables, the Ember Hurler's Slagscale Hide at 0.10 among them (design 7.4, 7.5); Stage 3's `forgeHint` for a green hide body names its bench recipe (3 Chitin Plate at Crafting 20), and for an item with no recipe is unchanged.
- **Accept**: red until K2.
- **Must not change**: `src/`.

### K2 The skill, the materials, the recipes [AGY]
- **Tier**: sonnet.
- **Depends**: K1.
- **Files**: `src/data/catalog.ts` (one row in `SKILLS_META`), `src/data/extras.ts`, `src/data/world.ts`, `src/data/recipes.ts`, `src/state/unlocks.ts`.
- **Change**: Data commit, as the content file. `RecipeDef.kind` gains `'craft'`; `recipesFor(station)` in `recipes.ts`; `forgeHint` also finds a recipe of kind `craft` and says "at a bench". The eight materials; the sixteen recipes; the appended drops of design 7.4 (including the three D4 left out, and the Ember Hurler's Slagscale Hide at 0.10 that C2 left out, design 7.5).
- **Accept**: `ONE(tests/crafting.test.ts)`, `ONE(tests/content-s6.test.ts)`; ECON; `ONE(tests/save-compat-s3.test.ts)` and `ONE(tests/save-relocation.test.ts)` with the edited goldens; SG.
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
- **Change**: read every passage K4 added or changed once for sense, voice and the rules of Q6, and list any to rewrite (critique M7); the slice gate of 0.2 (SG, ECON, MODEL); the diff of the slice against its tasks' allowlists; no frozen test edited beyond the declared ones.
- **H-4**: do `sq_hides`, reading Qadir's new lines; make gloves, boots and a green hide body; the skills tab shows thirteen skills and fits.

---

## 6.5 Slice 5: Runebinding

### N1 Runebinding tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: G-6.4.
- **Files**: `tests/runebinding.test.ts` (new); declared edits as K1 (`runestone`, `runestone_rock`, nine recipes; the three goldens gain `runebinding`).
- **Change**: as K1 for this skill: the meta row; nine recipes at their levels; `recipesFor('altar')` is exactly the kind `bind`; the unlock table; the actions table; each bind's ratio under Stage 3's rule (its own test covers it; here the catalysts are asserted: ashes for fire, big bones for chaos, law and death, dragon bones for blood); the two outcrops pass the node rules.
- **Accept**: red until N2. The verify confirms the freeze test's diff only adds ids and each golden's diff is one added `runebinding` entry.
- **Must not change**: `src/`, any other existing test.

### N2 The skill, the stone, the recipes [AGY]
- **Tier**: sonnet.
- **Depends**: N1.
- **Files**: `src/data/catalog.ts` (one row), `src/data/extras.ts`, `src/data/world.ts`, `src/data/recipes.ts`, `src/data/placements.ts`.
- **Change**: Data commit, as the content file; `kind` gains `'bind'`.
- **Accept**: `ONE(tests/runebinding.test.ts)`, `ONE(tests/content-s6.test.ts)`; ECON; `ONE(tests/save-compat-s3.test.ts)` and `ONE(tests/save-relocation.test.ts)` with the edited goldens; SG.
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
- **Change**: read every passage N4 added or changed once for sense, voice and the rules of Q6, and list any to rewrite (critique M7); the slice gate of 0.2 (SG, ECON, MODEL); the diff of the slice against its tasks' allowlists; no frozen test edited beyond the declared ones.
- **H-5**: read Hesper Moth's and Corin Ashby's new lines; mine stones, bind air and fire runes, cast with them; play chapter 4; take the vow and cross the pass for chapter 5.

---

## 6.6 Slice 6: the three styles (rebalance and arrows)

Design 7.12 and 7.4. Placed after both new skills and before the last boss (design 14.1): what it takes from ranged and magic arrives with what the stage gives them, no boss is re-tuned because every fight bound holds with the formula before and after, and the Kiln Warden is then tuned once on the final numbers.

### O-6.6 Re-approve the rebalance numbers [OWNER]
The main session shows the owner the band table that R0's MODEL printed on the merged code (every level from 20 to 70, with the level-28 exception, and the losses of design 7.12), beside design 7.12's. The owner approves the three constants and the two rune counts, or gives others (0.5, CALL-6.24). Nothing in slice 6 starts before this answer: the slice changes numbers existing archers and casters own.

### S1 Style balance tests and the two declared replacements [CLAUDE]
- **Tier**: opus (it replaces six pinned values of two Stage 3 tests after the owner's decision, each written out from the new formula, and defines the band the owner approves).
- **Depends**: G-6.5 and O-6.6 (the owner re-approves the numbers on the merged code's band table).
- **Files**: `tests/style-balance.test.ts` (new); the declared edits to `tests/combat-profile.test.ts` (five expected max hits, design 11.3 item 10) and `tests/entry-staff.test.ts` (one expected profile, item 11).
- **Change**:
  - `style-balance.test.ts`. The constants: `RANGED_BASE` is 3, `RANGED_GEAR` 0.06, `MAGIC_DAMAGE` 0.5. **Melee did not move**: twelve states, listed in the test, drawn from levels 1, 20, 40 and 70, the bronze, mithril, rune and dragon kits, the accurate, aggressive and controlled styles, with and without Piety (each value appears at least once), give max hits and accuracies written out in the test from today's expression. **The band**: for levels 20, 30, 40, 50, 60, 70, build the standard kit of each style from `ITEMS` by design 7.12's rule (best wearable ordinary weapon, body and legs; the listed special tiers and uniques left out), take a reference monster of the level from a fixed list, and compute damage per swing as hit chance times the mean of the damage roll, through `playerAttackProfile` and `playerHitChance`; assert ranged with bronze arrows (the only arrows that exist at this task; the arrow of the level is S3's) within 0.9 to 1.35 of melee, magic with its highest unlocked spell within 0.95 to 1.4, and the largest of the three at most 1.4 times the smallest. **Between the decades**: at every level from 20 to 70, the largest at most 1.45 times the smallest (measured worst 1.43 at level 28, design 7.12; `second-pass-results.txt` A). It prints the table of design 7.12 for every level from 20 to 70, and beside it the same with every slot filled, as information. **Runes**: `SPELLS` gives ice burst 1 water and 1 chaos, blood barrage 1 blood and 1 death, wind strike and fire bolt what they have today. **Prayers**: Sharp Eye and Mystic Might multiply inside the floor, as written in design 7.12. **Descriptions**: no combat spell's `desc` contains "Max". It also prints experience per hour by style before and after (design 7.12, `results.txt` 5e), as information.
  - `combat-profile.test.ts`: "shortbow on rapid: max hit 5" becomes 4, its comment `floor(3 + 0.35 + 0.96) = 4`; "with sharp_eye: max hit 7" becomes 5 (`floor(4.31 * 1.2)`); "fire_staff ... wind_strike: max hit 10" becomes 5 (`floor(10.54 * 0.5)`); "fire_bolt: max hit 17" becomes 8 (`floor(17.54 * 0.5)`); "wind_strike and mystic_might: max hit 12" becomes 6 (`floor(10.54 * 0.5 * 1.2)`). The test names and the two formula comments above them follow. Every accuracy and every other case stays.
  - `entry-staff.test.ts`: "Wind Strike with it hits for 6 at Magic 1" becomes "hits for 3", `{ maxHit: 3, accuracy: 21.5 }`.
- **Accept**: red until S2. The verify confirms the two frozen files' diffs are exactly those six values with their names and comments, and recomputes each by hand.
- **Must not change**: `src/`; any other test; the fight tests B1, B2 and Stage 4's boss test.

### S2 The three style numbers and the two spells [AGY]
- **Tier**: sonnet.
- **Depends**: S1.
- **Files**: `src/state/combat.ts`, `src/data/magic.ts`, `src/data/catalog.ts` (the `desc` of the four combat spells only).
- **Change**: Rule commit, then Data commit. In `catalog.ts`: the four combat spells' `desc` lose their "(Max Hit N)" or "(Max N)" figure and nothing else (it was never the real max hit; design 7.12). In `combat.ts`: `export const RANGED_BASE = 3`, `RANGED_GEAR = 0.06`, `MAGIC_DAMAGE = 0.5`; the ranged branch of `playerAttackProfile` becomes `Math.max(2, Math.floor((RANGED_BASE + s.ranged.lvl * 0.35 + bon.rng * RANGED_GEAR) * prayRngMult))` and the magic branch `Math.max(3, Math.floor((sp.maxHit! + s.magic.lvl * 0.22 + bon.mag * 0.18) * MAGIC_DAMAGE * prayMagMult))`. In `magic.ts`: `ice_burst: { water_rune: 1, chaos_rune: 1 }`, `blood_barrage: { blood_rune: 1, death_rune: 1 }`.
- **Accept**: `ONE(tests/style-balance.test.ts)` whole (it has no arrow cases: S1 plays bronze); `ONE(tests/combat-profile.test.ts)`, `ONE(tests/entry-staff.test.ts)`; the fight tests of B1 and B2 and Stage 4's boss test **unedited** (they hold on both formulas, `check-results.txt`); ECON; MODEL; SG.
- **Must not change**: the melee branch; accuracy of any style; `playerHitChance`, `monsterHitChance`, `rollMonsterHit`; any spell's `maxHit`, level, experience, id or name; any item row; the two small spells' runes; the teleports' runes.

### S3 Arrow tests [CLAUDE]
- **Tier**: sonnet (from design 7.4).
- **Depends**: S2.
- **Files**: `tests/arrows.test.ts` (new); the declared lists of `tests/content-freeze.test.ts` (five items, five recipes).
- **Change**: `ammoForWeapon` returns what it returns today for every weapon (`bronze_arrow` for bows, `bronze_bolts` for crossbows, `null` for the three self-drawn bows). `AMMO_GRADES` (design 7.4) has exactly the seven ids of the content file's `AMMO`, each with `of` equal to `bronze_arrow` or `bronze_bolts` and its `power` (0, 2, 4, 6; bolts 0, 4, 6); the two bronze item rows deep-equal their rows before the task (no field added to any item). **Any bow, any arrow**: for every bow that takes arrows and every arrow grade, `canUseStyle('rapid', bow, state)` is ok with only that arrow in the backpack, and likewise every crossbow with every bolt; with no ammunition of the kind it is refused with today's reason. **The best is shot**: with bronze and mithril arrows carried, `prepareAttack` consumes one mithril arrow and returns `ammoPower` 4; `playerAttackProfile(state, 4)` gives the max hit of `playerAttackProfile(state, 0)` plus 4, for a shortbow and for a magic bow, and with Sharp Eye `floor((x + 4) x 1.2)` as design 7.12 writes it; `playerAttackProfile(state)` with no second argument reads the best carried arrow (so every frozen caller is unchanged). **The last arrow of a grade** (second pass): with exactly one mithril arrow and some bronze, the shot that spends the mithril arrow gets power 4, which is what the engine passes after removing it; the next shot gets 0. **The band with the arrow of the level**: S1's band, rerun with iron from 25 (arrows), mithril from 45, rune from 70, holds the same shares at the decades and the 1.45 ceiling between them (design 7.12, `results.txt` 5a). A crossbow ignores arrows and a bow ignores bolts. The frozen shortbow case of `tests/phase1.test.ts` still holds. The five recipes exist with the content file's inputs and pass Stage 3's rule.
- **Accept**: red until S4.
- **Must not change**: `src/`; `tests/phase1.test.ts`.

### S4 Arrows and bolts [AGY]
- **Tier**: sonnet.
- **Depends**: S3.
- **Files**: `src/data/items.ts`, `src/data/extras.ts`, `src/data/recipes.ts`, `src/state/combat.ts`, `src/engine/actions.ts` (one call; second pass).
- **Change**: Data and Rule commits, as the content file's `AMMO`. Five items of type `ammo`, rows as the content file (no new field); five recipes. `items.ts`: `AMMO_GRADES` and `bestAmmo(state, of)` (the carried id whose grade has that `of` and the highest `power`; ties by table order). `combat.ts`: `canUseStyle` asks `bestAmmo` for the kind `ammoForWeapon` names; `prepareAttack` consumes that item and returns its `ammoPower` in `AttackPrep`; `playerAttackProfile(state, ammoPower = <power of bestAmmo(state)>)` adds it inside the floor, beside the gear term. `actions.ts`: `performPlayerAttack` calls `playerAttackProfile(STATE, prep.ammoPower)` (it removes the arrow first, so reading the backpack there would shoot the last arrow of a grade at the next grade's power), and writes one log line when the grade it shoots differs from the last shot's (kept in memory, not saved; CALL-6.28).
- **Accept**: `ONE(tests/arrows.test.ts)`, `ONE(tests/style-balance.test.ts)` whole, `ONE(tests/phase1.test.ts)` and `ONE(tests/phase4-combat.test.ts)` unchanged; ECON; MODEL; SG.
- **Must not change**: `ammoForWeapon`'s results; the two bronze item rows; the three self-drawn bows; the price of bronze arrows and bolts; anything S2 set; any other line of `performPlayerAttack`.

### G-6.6 Slice 6 gate [CLAUDE] + H-6 [HUMAN]
- **Tier**: opus (verification).
- **Change**: the slice gate of 0.2 (SG, ECON, MODEL, PACE); the diff of the slice against its tasks' allowlists; the six replaced values and nothing else changed in the two Stage 3 tests; the printed band table equals design 7.12's (and the one the owner saw at O-6.6). If it differs, the slice stops and the owner sees the new table before the gate passes; the design is then updated.
- **H-6**: load a save with a yew bow and bronze arrows: it shoots, and hits less than before; fletch iron arrows: they are shot first and hit harder. As a level-50 caster cast fire bolt, ice burst and blood barrage at the same monster: each is stronger and dearer than the last. Fight Marrowjaw with each style: about the same length. Judged for: no style feels dead.

---

## 6.7 Slice 7: the Underkiln and the end

### U0 Slice 7 content tests [CLAUDE]
- **Tier**: sonnet.
- **Depends**: G-6.6.
- **Files**: `tests/wyrmsteel.test.ts` (new); the declared edits to `tests/content-freeze.test.ts` (`kiln_shard`, `wyrmsteel_ingot`, `smelt_wyrmsteel`, the three dragon forging recipes, `kiln_warden`), to the "closed later" list of `tests/content-s6.test.ts`, to `src/__tests__/blender-hero.test.ts` 138 (type keys 19 to 20: the cave's Ember Hurler is the nineteenth), and to `tests/new-monsters.test.ts` 125 (`NEW` gains `kiln_warden`).
- **Change**: `wyrmsteel.test.ts`: an ingot needs one runite bar and one Kilnglass Shard at Smithing 60; the three forging recipes make the existing dragon scimitar, platelegs and platebody from 4, 4 and 5 ingots at 60, 62 and 65; Kilnglass comes from the Kiln Warden's table and the Underkiln's `loot` and from nothing else; the chest's fixed part holds at least one shard (base loot, design 7.6 and CALL-6.25; with it the kit takes 13 clears at worst and chapter 6's shard step always follows its chest step); from the rows, by the exact distribution and not by sampling, the mean per clear is 2.2 within 0.05 and the expected clears for 4 and for 13 ingots are 2.3 and 6.4 within 0.1 (design 7.6; an ingot from the boss counts as a shard). Z3's `dungeon-data.test.ts` reads the table and needs no edit.
- **Accept**: red until U1 (missing ids). The verify confirms the freeze test's diff only adds ids.
- **Must not change**: `src/`, any other existing test.

### U1 The Underkiln, as data [AGY]
- **Tier**: sonnet.
- **Depends**: U0.
- **Files**: `src/data/dungeons.ts`, `src/data/world.ts`, `src/data/extras.ts`, `src/data/recipes.ts`, `src/data/attacks.ts`.
- **Change**: Data commit, as the content file: the dungeon row and its `loot` (1 Kilnglass Shard, 1 to 2 Cinder Silk, 500 to 1,000 GP; rare: 3 Kilnglass at 0.2, Bloodbark Body at 0.04, Bloodbark Legs at 0.04); the Kiln Warden (its table: dragon bones, 800 to 1,600 GP, 1 Kilnglass at 0.5, 1 Wyrmsteel Ingot at 0.1); `kiln_ring`, `core_vent`, `hammer_arc`, `BOSSES.kiln_warden`; Kilnglass, the ingot and its four recipes. The door is a procedural frame (the existing signpost builder's posts) at (-52, 46).
- **Accept**: `ONE(tests/wyrmsteel.test.ts)`, `ONE(tests/dungeon-data.test.ts)`, `ONE(tests/content-s6.test.ts)`; ECON; SG.
- **Must not change**: `CAMPS`; the Warren's row; the price or stats of any dragon piece.

### B3 The Kiln Warden's fight test [CLAUDE]
- **Tier**: opus.
- **Depends**: U1.
- **Files**: `tests/boss-kiln-warden.test.ts` (new); `src/data/world.ts` and `src/data/attacks.ts` only if a bound misses.
- **Change**: the rows of design 7.7 for the Kiln Warden through Stage 4's fight model, 500 seeds each (the ranged fighter carries rune bolts: slice 6 is built by now; B1 and B2, written before it, play bronze and are not edited): prepared melee at least 85%; the same 300 ms slower at least 65%; the same never moving at most 5%; melee 55 in rune without prayer at most 15%; prepared ranged and prepared magic at least 85% each, and each never moving at most 5%. The no-prayer row and the at-the-door row are printed, not asserted. If a bound misses, the boss's numbers move as in B2.
- **Accept**: the test passes; MODEL passes with the same numbers; `ONE(tests/dungeon-data.test.ts)` still holds the income bound.
- **Must not change**: the fight model; the fighters; any other boss's rows.

### U3 Chapters 6 and 7 [CLAUDE]
- **Tier**: opus (writing).
- **Depends**: U1.
- **Files**: `src/data/story.ts`, `src/data/dialogue.ts`.
- **Change**: `ml_kiln` and `ml_ash` as design 7.3: `ml_kiln`'s fourth stage is the chest step, `{ kind: 'do', done: { stat: ['clear:underkiln', 1] } }`, and its reward carries the title Kilnbreaker; the last conversations of Corin Ashby and Odalys Venn; a closing line for each of the other five people once `ml_ash` is done.
- **Accept**: Q5's data tests; the walk now finishes all thirteen quests; SG.
- **Must not change**: any earlier quest's stages or reward; Stage 4's Ashmantle rows.

### G-6.7 Slice 7 gate [CLAUDE] + H-7 [HUMAN]
- **Tier**: opus (verification).
- **Change**: read every passage U3 added or changed once for sense, voice and the rules of Q6, and list any to rewrite (critique M7); the slice gate of 0.2 (SG, ECON, MODEL); the diff of the slice against its tasks' allowlists; no frozen test edited beyond the declared ones.
- **H-7**: read the closing lines of all seven people; the Underkiln as H-3, cleared three times: the chest pays each time, chapter 6 pays once; the Kiln Warden with each style; forge a wyrmsteel ingot and a dragon piece; finish Ashfall and see the title.

---

## 6.8 Slice 8: the diary

### Y1 Diary tests [CLAUDE]
- **Tier**: sonnet (from design 7.8).
- **Depends**: G-6.7.
- **Files**: `tests/diary.test.ts`, `tests/diary-data.test.ts` (new).
- **Change**: rules, on a fixture tier: `diaryView` marks tasks and counts; `claimTier` is refused until every task of the tier is done (five; six in the volcanic medium tier), pays the ember and the easy tier's 500 GP once, is refused when the ember does not fit, and records the tier; `perks(state)` returns exactly the perk of each claimed tier (design 7.8's table): a deposit box at a region's shrine from its middle tier, a bank from its hard tier, the two start-town perks. `shrineBank(state, regionId)` is `'none'`, `'deposit'` or `'bank'`; `shrineTransfer(state, regionId, action, itemId, mode)` (design 7.8): at `'deposit'` a deposit moves exactly what today's `deposit` moves and a withdrawal is refused with a reason and moves nothing; at `'bank'` both behave exactly as today's `deposit` and `withdraw`; at `'none'` both are refused; the bank's capacity rule is today's (a full bank refuses a shrine deposit with today's reason). No perk concerns aggression: a scan finds no read of `perks` in `src/state/monsterAi.ts`. Data: 15 tiers, fourteen of 5 tasks and the volcanic corner's medium tier of 6, 76 tasks in all; that tier holds "Kill 10 Ember Hurlers" with the condition `{ stat: ['kill:ember_hurler', 10] }` (CALL-6.31); every condition valid by `evalCond`'s vocabulary and ids; each stat family (`kill`, `gather`, `craft`, `talk`, `clear`, `bury`, `vows`) and each of Crafting and Runebinding read by at least one task; no task is true for a new game.
- **Accept**: red until Y2 and Y3.
- **Must not change**: `src/`, any existing test.

### Y2 Diary rules, embers, perks [AGY]
- **Tier**: sonnet.
- **Depends**: Y1.
- **Files**: `src/state/diary.ts` (new), `src/state/progress.ts`, `src/state/commands.ts`, `src/data/diary.ts` (new, types and an empty table).
- **Change**: Rule commit: `diaryView`, `claimTier`, `perks`, `shrineBank`, `shrineTransfer` (it calls `deposit` and `withdraw` of `src/state/inventory.ts`, unedited), and the command `claimTier`.
- **Accept**: `ONE(tests/diary.test.ts)`; SG.
- **Must not change**: `normalizeProgress`'s rules for the other fields; `finishQuest`.

### Y3 The 76 tasks [AGY]
- **Tier**: sonnet (the table of design 7.8, one condition per task; where a task says "or", an `any`).
- **Depends**: Y2.
- **Files**: `src/data/diary.ts`.
- **Change**: Data commit. Each task's text is the design's wording; its condition uses counters, skills, flags, shrines, coin and claimed quests only. The volcanic medium tier has six tasks: design 7.8's five and "Kill 10 Ember Hurlers", `{ stat: ['kill:ember_hurler', 10] }`, last.
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
- **Files**: `src/state/combat.ts`, `src/engine/worldBuild.ts`, `src/engine/input.ts`, `src/engine/loop.ts`, `src/ui/stations.ts`, `src/state/sustain.ts`. (Second pass: the shrine's menu option is built in `input.ts` and dispatched in `loop.ts`; a shrine today has the one action `worldmap`.)
- **Change**: three reads of `perks(STATE)`, one each: `canCastTeleport` asks for no runes for the home teleport with that perk; a region's shrine offers a second menu option, "Deposit" with the middle perk and "Bank" with the hard one, beside its teleport, which opens the bank window with the shrine's region; in deposit mode the window draws no withdraw controls, and every transfer from a shrine goes through `shrineTransfer`; `vowPrice` returns three quarters with that perk.
- **Accept**: `ONE(tests/diary.test.ts)`; `ONE(tests/aggression.test.ts)` and Stage 4's vow tests unchanged; SG.
- **Must not change**: `stepMonster`; the bank's own behaviour at the bank.

### G-6.8 Slice 8 gate [CLAUDE] + H-8 [HUMAN]
- **Tier**: opus (verification).
- **Change**: the slice gate of 0.2 (SG, ECON, MODEL); the diff of the slice against its tasks' allowlists; no frozen test edited beyond the declared ones.
- **H-8**: finish one easy tier from a new game and one medium tier with a prepared save; use an ember; put things into the deposit box at a shrine and find them in the bank; open the bank at a shrine with a hard tier.

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

1. SG, ECON, MODEL, PACE.
2. `git diff <R0 baseline> --stat -- tests/ src/__tests__/` lists, among files that existed at the baseline, only `tests/content-freeze.test.ts`, `tests/world-budget.test.ts`, `tests/world-data.test.ts`, `src/__tests__/blender-hero.test.ts`, `tests/scatter.test.ts`, `tests/woods-trees.test.ts`, `tests/new-monsters.test.ts`, the two Stage 3 goldens, `tests/fixtures/save-relocation/v4-loaded.json`, and the four of the owner's rule changes: `tests/monster-territory.test.ts` (one test), `tests/support/pacingModel.ts` (one expression, one import), `tests/combat-profile.test.ts` (five values), `tests/entry-staff.test.ts` (one value), and the one of line of sight: `tests/fixtures/size-refactor-golden.json` (the `monsters` key); each diff is exactly what design 11.3 declares.
3. `grep -rn "Math.random\|Date.now\|performance.now" src/state` shows no line in a module this stage created.
4. `grep -rn "innerHTML" src/ui/dialogue.ts src/ui/journal.ts` prints nothing.
5. The walk test finishes all thirteen quests; the three fight tests pass; the dungeon, cave, line-of-sight, dialogue, story, diary and placement data tests pass.
6. `serializeState(createDefaultState())` differs from the R0 golden only by the two skills.
7. The JS chunk is within design section 10's budget of the R0 baseline; the report gives the number per slice.
8. No commit on the branch carries an attribution trailer; no agent branch was pushed.
9. Every human check H-0 to H-8, H-3a and H-3b is recorded in its pull request.

---

# 4. Coverage

## 4.1 Goals to tasks

| Goal | Tasks | Proof |
|---|---|---|
| G6.1 dialogue | Q1, Q2, Q5, Q8 | `dialogue-rules`, `dialogue-data`, the UI scan |
| G6.2 main line, side quests, journal | Q3, Q4, Q5, Q6, Q9, Z5, K4, N4, U3 | `story-rules`, the walk in `story-data` |
| G6.3 starter chain's voice | Q1, Q6 | `dialogue-rules` (`claimStarter`), Stage 3's tests unedited |
| G6.4 loops closed | D1, D2, Z4, K2, N2, U1, S4 | the loop audit in `content-s6` |
| G6.5 two skills | K1 to K3, N1 to N3 | `crafting`, `runebinding` |
| G6.6 dungeons | Z1 to Z7, U0, U1; the cave C1 to C3 | `zone-rules`, `dungeon-data`, `cave`, H-3, H-3a, H-7 |
| G6.7 roster and bosses | D3, D4, Z4, C1, C2, U1, B1 to B3 | `roster-s6`, `cave` (the Ember Hurler), the three fight tests |
| G6.8 diary | Y1 to Y5; embers in Q3, Q4, Q6, Q9 | `diary`, `diary-data`, `story-rules` |
| G6.9 Stage 3's economy holds | every slice gate | ECON, the pacing test unedited (its model: G1) |
| G6.13 the three styles in one band | S1 to S4 | `style-balance`, `arrows`; the fight tests unedited on both sides; H-6 |
| G6.14 aggressive and passive monsters; line of sight | G1, G2; Z1, Z2 for dungeon camps; C1, C2 for the cave's camps; L1, L2 for line of sight | `aggression`, the gate simulation unedited, PACE; H-0 |
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
| Ranged and magic ladders | S1, S2 (the rebalance), S3, S4 (arrows), K2 (armour), N2 (runes); the measurement is MODEL section 5 |
| A boss's respawn timer | F5, F6 |
| The prepared slots | D4, Z4, U1 |
| Audit findings 1, 10, 24 | rule 0.3.9 and Q8's scan; F1; Q9 |

## 4.3 CALLs to tasks

| CALL | Tasks that carry it |
|---|---|
| 6.2 | Q6 |
| 6.3 | K1 to K3, N1 to N3, D2 |
| 6.4, 6.5 (decided), 6.25 | Z1, Z2, Z3, Z4, Z7, U0, U1 |
| 6.28 | S3, S4 (the log line); a later task if the quiver is chosen |
| 6.24 (numbers) | O-6.6, S1, S2 |
| 6.18 (replaced, decided), 6.27, 6.29 | G1, G2 (and the task 0.5 names for CALL-6.29's answer) |
| 6.6 (decided in part), 6.26 | Y1, Y2, Y5 |
| 6.7, 6.8 (decided), 6.24 | S1 to S4; MODEL |
| 6.22 | B2 |
| 6.10 | D4, Z4, U1; R1 lists the compromises |
| 6.11 | F1, F2 |
| 6.12 | F3, F4 |
| 6.13 | D3, D4 |
| 6.14 | Q3, Q4 |
| 6.15 | Q6, Z5, N4, U3 |
| 6.16 | Q6, Z5, K4, N4, U3 |
| 6.9 | D1 (`names-s6`), O-6.2 |
| 6.30 (decided 2026-11-24) | Z3 (`income.ts`), C1, C2, C3, G-6.3a |
| 6.31 (decided 2026-11-24) | C1, C2, C3 (the orb), K1, K2 (the hide), U0 (type keys), Y1, Y3 |
| 6.32 (decided 2026-11-24) | L1, L2, G-6.3b |
| 6.33 (decided 2026-11-25: (a), 13.5 s) | C1, C2, C3 as 0.5 row (a) says |

---

# 5. What this plan could not check

- **It was written against designs, not code, for Stages 4 and 5**, and against a half-built Stage 3. R0 exists for that and is the one task that may stop the stage.
- **Stage 4's fight model is named by guess** ("its plan task B3 put it under `tests/support`"). B1 to B3 depend on R0 finding it.
- **How Stage 4 passes a boss's respawn time into a monster's logic** is not in its design in code form; F6 and Z7 say "the option R0 recorded".
- **Whether Stage 5 took CALL-V13** decides how Q8, Q9 and F4 wire buttons; both ways are allowed by rule 0.3.9 as long as no inline handler is added.
- **Allowlists for engine tasks** (Q7, Z6, Z7, K3, S4, Y5) name the files that hold the code today; if Stage 4 or 5 moved a function, R0's symbol table is the guide and the verify stage accepts the file that now holds it, recorded.
- **G2 edits a block Stage 4 has not written its changes around yet.** The task names the two expressions as they are on `main`; R0 item 4c records them on the merged code and stops the stage if Stage 4 rewrote the block.
- **S2's expressions are Stage 3's as read on its branch**; Stage 4 is not expected to touch `playerAttackProfile`, and R0 checks.
- **PACE was run on Stage 3's world only** (now read from `origin/main`). With Stage 4's and this stage's overworld camps the fighter's choices under the new rule are unrun; R0, G2 and D4 run them.
- **The high-tree case** (design 7.13, CALL-6.29) was measured on `main`'s `stepMonster` patched with the rule, not on Stage 4's; whether Stage 4's auto-retaliation still skips a gathering hero is R0 4c's to confirm.
- **The deposit-only bank window** (Y5) is described, not designed against Stage 5's components.
- **The cave's income bound misses in one hall** (design 7.6, measured 2026-11-25: the front hall 0.94 against 0.9): resolved by O-6.33 (a), 13.5 s.
- **The cave's geometry was checked by hand**, not on a zone grid: Z2's grid builder does not exist yet. C1 proves reachability around the pillars; if it fails, C2 stops and the design's table changes, never a rule of the package.
- **The line-of-sight digest** (`5e5eb899...`) was computed on `87f18e7` with L2's edits. Z2 and G2 land before L1 and may move other lines of `stepMonster`; L1 recomputes it on the tree of its day, on a scratch copy with exactly L2's edits, and the four untouched monsters' digests must not move.
- **No suite, type check or build was run** while writing this plan, except the runs of the 2026-11-25 revision (design 17). The commands of 0.2 are the earlier plans', which were run on this machine.

---

# 6. Review log

- 2026-11-14, critique: rule 0.3.3, R0, F3, F4, D1, D3, D4, Q2 to Q5, Z1 to Z3, Z6, Z7, K1, N1, U0, the slice gates.
- 2026-11-14, **owner decisions** (design 15.1), one commit:
  - **Aggression**: new tasks G1 (tests, and declared replacements 8 and 9) and G2 (the rule) in slice 0, after Stage 4's work on the same file; R0 item 4c and a new stop rule; the command PACE; `ignoresLevel` removed from Z1, Z2, Z3 (zone camps are aggressive camps with `keepsSight`); `peace` removed from Y1, Y2, Y5 (a deposit box instead; `stepMonster` is no longer in Y5's files); H-0 gains the walk-through checks.
  - **Style rebalance and arrows**: new slice 6 (S1 to S4, G-6.6, H-6) with declared replacements 10 and 11; the old slice 8 (A1, A2: bows refusing arrows) is deleted and its recipes moved to S4; rule 0.3.7 names the two exceptions; the Underkiln becomes slice 7 and the diary slice 8 (gates and human checks renumbered).
  - **Dungeon drops and quests**: `openChest` rolls a `loot` table with rare entries and keeps its roll; no first-clear reward (Z1, Z2, Z3, Z4, U0, U1); the quest-pays-once proof (Z1); chapter 3's and 6's rewards and chapter 6's chest step (Z5, U3); boss tables with chance entries (D3, D4, Z4, U1); D1's 25% rule excludes boss rows.
  - Tables 0.5, 4.1, 4.2, 4.3 and section 5 follow.
- 2026-11-14, **second pass** (critique file, "Second pass"), one commit: R0 4c gains the attack-path order, Stage 4's boss model and the gatherer check; G1 keeps `packAttackers` in `tests/support`, edits one expression of the pacing model (the `largestAggressive` filter changes no number) and names the passive camps by id; G2 waits for CALL-6.29; D1's boss exemption and D3's Marrowjaw bound; O-6.6 (the owner re-approves the rebalance on the merged code) before S1; S1 plays bronze and asserts every level 20 to 70 within 1.45; S2's Accept no longer leaves a red test; S3 and S4: `AMMO_GRADES` instead of an item field, the arrow's power handed from `prepareAttack` through `performPlayerAttack` (`src/engine/actions.ts` added to S4), the last-arrow case, the log line; Y1, Y2, Y5: `shrineTransfer`, and `input.ts` and `loop.ts` added to Y5; U0's shard reworded as base loot; 0.5 gains CALL-6.28, CALL-6.29 and O-6.6, and loses the counter option; PACE reads `origin/main`.

## Revision 2026-11-25: CALL-6.30 to 6.32

The owner approved the package of `docs/superpowers/proposals/2026-11-24-call-6.30-demons-cave.md` ("aprovo o pacote do fable, e sim à linha de visão"). This revision carries it, grounded on the merged tree at `87f18e7`: the whole suite was run on a scratch copy with the cave's data changes and, separately, with the line-of-sight edits, and `model.ts` section 8's arithmetic was run on the cave. One commit with the design (its review log lists the design sections).

- **Header**: the revision named; line numbers "on `87f18e7`" defined.
- **0.1**: L1 joins the opus tasks that replace a frozen assertion.
- **0.3.3**: the counts follow the cave (42 to 48, then 46; type keys to 20); Stage 5's camp counts in `tests/scatter.test.ts` and `tests/woods-trees.test.ts` and Stage 4's `NEW` list in `tests/new-monsters.test.ts` declared (design 11.3 items 13, 14; found by running the suite, they also break D3 as first written); the line-of-sight digest declared (item 15).
- **0.3.7**: a third named exception, the line-of-sight test of `stepMonster` (L2).
- **0.5**: owner step O-6.33 (against the package's 0.9, the front hall measures 0.94, the back hall 0.87, both halls in turn 0.73); four answer rows for CALL-6.33.
- **D3**: the five frozen files and their exact edits (two Stage 2 counts, the type-key count, Stage 5's two camp counts, the `NEW` list). **D4**: its Accept runs the three Stage 4 and Stage 5 files; its fallback counts follow the cave.
- **Z3**: `tests/support/income.ts` (new), so the cave's camps join the same income test (owner); the `NEW` list gains the two Warren types.
- **New slice 3a, the demons' cave**: O-6.33, C1 (cave and Ember Hurler tests, seven declared count and list edits), C2 (the `Zone` type, `solid`, `zoneRespawns`, `CAVES`, the `ember_hurler` row, the terrace camp removed from `CAMPS`), C3 (the hellfire-orb branch in `actions.ts`, the door, the standing zone kept across leave and enter, `CAVE_LIGHT` and `frameOf`, the camera arm, `setCaveWeather`), G-6.3a and H-3a.
- **New slice 3b, line of sight**: L1 (the test and the declared `monsters` digest of `tests/fixtures/size-refactor-golden.json`), L2 (four edits of `monsterAi.ts`), G-6.3b and H-3b.
- **K1, K2**: K1 asserts, and K2 appends, the Ember Hurler's Slagscale Hide (0.10), as for the Slag Brute's.
- **U0**: the type-key count 19 to 20; the `NEW` list gains `kiln_warden`.
- **Y1, Y3**: "Kill 10 Ember Hurlers" (`kill:ember_hurler`, 10) in the volcanic medium tier, which now has six tasks; 76 tasks; a tier is claimed when every one of its tasks is done.
- **Section 3** (final verification): steps 2, 5 and 9 follow.
- **4.1, 4.3**: G6.6, G6.7 and G6.14 rows; CALL-6.30 to 6.33 rows.
- **Section 5**: the failed income bound, the hand-checked cave geometry, and how L1 recomputes the digest.
- Critique, high: slice 4 asserts and writes the Ember Hurler's hide but did not wait for slice 3a. Applied: K1 depends on G-6.3b; design 14.1 gives slice 4 "2, 3a, 3b" and slice 8 "1 to 7, 3a and 3b" and states the order 3, 3a, 3b, 4; table 0.5 gains a row for slice 3a delayed past slice 4 (the hide moves to C1 and C2; U0's count 18 to 19 if 3a also follows slice 7).
- Critique, medium: the held cave monsters stayed in `G.monstersList`, which `loop.ts` 138, `actions.ts` 441 and `overlay.ts` 157 and 296 (`src/engine/overlay.ts`) read on the overworld. Confirmed and applied: C3 moves them to a held list on leave and back on entry; a living member is first reset by `sendHome`, a new export of C2 in `monsterAi.ts`, because the return path (`enterReturn`, `resetToIdle`) is private to that module and the engine sets no logic field; C1 asserts `sendHome`; H-3a leaves during a wind-up and checks the hero fights back on the overworld.
- Critique, medium: `setCaveWeather` forced `fogScale: 1`, and `updateLightingFrame` (`lighting.ts` 213) writes the fog density from it on every frame. Confirmed and applied: `CAVE_FOG_SCALE` 3 beside `CAVE_LIGHT` in `look.ts`, returned by `getWeatherState` while the cave weather is on, asserted by C1, judged at H-3a; C3 says this, not Z6's fog write, holds the density.
- Critique, low: design 7.13 said "the three edits of plan L2". Confirmed (L2 lists four) and applied.
- Critique, low: C3 mixed a Rule, a Data and an Engine change in one commit (rule 0.3.5). Applied: Rule commit (`frameOf`), Data commit (`CAVE_LIGHT`, `CAVE_FOG_SCALE`), then Engine commit.
- Critique, low: design 11.3 item 1 counted 6 monster types and 0.3.3's appender list left out C1. Applied: item 1 reads 7 monster types, the Ember Hurler by C1; 0.3.3 lists D1, Z3, C1, K1, N1, S3, U0. Item 1 has no appender list of its own, so only 0.3.3 changed there.
- 2026-11-25, O-6.33 answered (a): the cave row's `respawnSecs` is 13.5; table 0.5 row (a) applies to C1, C2, C3.

## Revision 2026-11-26: O-6.1b answered after R0

R0 stopped (baseline file, section 5 and 6.1 to 6.2). The owner answered every point with the recommendation ("Segue recomendação", 2026-11-26). Each answer below names the task that carries it; these win over older text.

### O-6.1b.1 The ten undeclared frozen tests (declared, additive)

Each list or count follows the new content only; every existing entry stays byte-identical. Made by the test task of the slice that adds the content, never by a data task (rule 0.3.6).
1. `tests/scatter.test.ts` 175, `tests/woods-trees.test.ts` 135 and 218: the `NODE_PLACEMENTS` count follows (46 to 49 by D3, to 51 by N1).
2. `tests/monster-kits.test.ts` 105-123: the model-key snapshot gains each new type with its model key (D3, Z3, C1, U0).
3. `tests/monster-models.test.ts` 76-81 and its SNAPSHOT: gains each new row and each appended drop (D3 for slice 1 rows and D2's drops, K1 and N1 for theirs, Z3, C1, U0).
4. `tests/economy-rolls.test.ts` 58-70: the chicken's draw count and results gain the feather (D1). The feather stays on the chicken (O-6.1b.2).
5. `tests/boss-phases.test.ts` 188-189: `Object.keys(BOSSES)` "equals ['ashmantle']" becomes "contains 'ashmantle'"; the rest of the test still pins Ashmantle's row (D3).
6. `tests/world-data-combat.test.ts` 70-71: the arena list gains each new boss camp (D3, Z3, U0). The "more than 400 open cells" rule at 95 is **not** declared: Marrowjaw's arena grows instead (O-6.1b.4).
7. `tests/names-combat.test.ts` 26 and 45-49: the name list gains the seven attack names of design 7.10 (D1).
8. `tests/size-refactor-golden.test.ts` 103-109: each existing attack's `telegraphs` entry stays byte-identical and only new keys are added; `plans` is regenerated once per slice that adds attacks, and its test checks the regenerated digest against one recomputed with the new attacks removed (D3, Z3, U0).
9. `tests/recipes-bars.test.ts` 31-38: `SMITH_TABLE` gains each new smith recipe with its inputs and requirement (D1, Z3, U0, S3).
10. `tests/unlocks.test.ts` 75-78 and 95-98: the two cases name an item that still has no recipe after the stage (D1 picks it and asserts it is still unforgeable at the end).

Design 11.3 gains these as items 13b and 16 to 24.

### O-6.1b.2 to 5

- **Feather**: stays on the chicken (item 4 above).
- **Slag Brute**: takes `hill_giant`'s four-slot pattern (one heavy, Overhead Slam); Stage 4's "basic x3, wind-up" rule and `tests/monster-patterns.test.ts` are unchanged. Design 7.5 follows.
- **Marrowjaw's arena**: radius 12, so the 400-cell rule holds, and the `tollmaster` camp moves to the nearest spot more than 35 from `thornwatch` (-18, -48) that passes every MODEL placement check. MODEL gains Stage 4's arena criterion (`tests/world-data-combat.test.ts` 65-115), and the fight model is rerun at radius 12.
- **New boss numbers**: Marrowjaw, Matron Saltfang and the Kiln Warden take Ashmantle's: marks max 4 for 12 s, no opening roar (`openingShiftMs` 0), 2000 ms per phase shift.

### R0b Content file and design follow the answers [CLAUDE], before F1

- **Tier**: opus. **Files**: `docs/superpowers/research/content-model/*`, the design (7.4, 7.5, 7.7, 11.3, review log), the baseline file (an "After O-6.1b" note).
- **Change**: write O-6.1b.2 to 5 into the content file (the Slag Brute's pattern, Marrowjaw's radius and camp, the three bosses' mark, opening and phase numbers) and the design; add the arena criterion to MODEL; rerun MODEL, PACE, `second-pass.sh` and `critique-check.sh`.
- **Accept**: MODEL, PACE and the arena criterion pass; `git diff main --stat` shows only files under `docs/`. **Stop rule**: no camp spot passes, or a fight bound fails at radius 12: stop and report.

### O-6.1b.6 Models for the new monsters (owner: option B)

A models lane runs beside slices 0 and 1 in its own worktree (`../osrs-like-wp/S6-mod` on `cs/models`, never pushed until merged by the main session). Its rules, commands (BLEND, COMPARE, SHEETS, the promote) and art bar are the models pass's: its plan section 0, its design 5 and 9.1, `docs/superpowers/baseline/models/README.md` (the pilot's pattern) and `final.md`'s hand-off "To Stage 6". Budgets: a kit at most 1,200 triangles, 4 rigid meshes, 3 materials, 20 kB; a boss body the dragon-class row of design 9.1 (14,000 triangles, 4 skinned meshes, 220 kB Brotli).

- **MK1 Cinder Adept kit** [CLAUDE, opus]: `Kit_cinder_adept` on `dark_wizard`: a hood with an ember lining and a brazier staff head; read as a fire caster, not the dark wizard.
- **MK2 Slag Brute kit** [CLAUDE, opus]: `Kit_slag_brute` on `hill_giant`: slag plates on the shoulders and back, a cooled-slag maul head.
- **MK3 Marrowjaw kit** [CLAUDE, opus]: `Kit_marrowjaw` on `hill_giant`: bone shoulder armour, a jaw-bone crown, a toll banner pole on the back; must read apart from MK2 at 85 px.
- **MB1 Matron Saltfang body** [CLAUDE, opus]: `Monster_saltfang` on the scorpion's crawler skeleton (bones `saltfang_<Bone>`, no clips of its own; it plays the scorpion's library as Ashmantle plays the dragon's): a broad brood mother, a salt-crusted carapace, egg sacs, a heavy forked sting.
- **MB2 Kiln Warden body** [CLAUDE, opus]: `Monster_kiln_warden` on `moss_guardian`'s biped skeleton (bones `kiln_warden_<Bone>`): a fired-clay and iron construct with a glowing kiln core (the `glow` material), heavy hammer arms; must not read as the woods creature.
- **MP6 Promote** [CLAUDE, main session, sonnet runs it]: as the models pass's M4c (8-bit pack, live manifest from pending with the same margins, `?v=` key, `totals.json`, follow-through test edits only as the models pass declared them), with sheets and captures under `docs/superpowers/baseline/models/s6c/`.
- Each of MK1 to MB2 ends with BLEND, COMPARE against the pending manifest, the turnaround, worst-pose and 85 px silhouette sheets, and a `monster-motion` built-file check that the figure plays its base's clips. Verified by opus against the models pass's art bar and the owner's art words ("the models must make sense; old school but with good definition").
- **Wiring**: the data task that adds each row sets its look field once MP6 is merged into `feat/content-systems`: D4 sets `kit: 'cinder_adept'`, `kit: 'slag_brute'` and `kit: 'marrowjaw'`; Z4 sets `body: 'saltfang'`; U1 sets `body: 'kiln_warden'`. Scree Skitter and the Ember Hurler stay recolours. D4 therefore also depends on MP6. `tests/monster-models.test.ts`'s kit and body cases then cover them with no new test.

### F2 amendment (2026-11-26, main session, from F2's verification)

- **F2's files gain `src/data/recipeTable.ts`** (new): `RecipeDef`, `LOG_IDS`, `LOG_CRAFT`, `logRecipes` and `FORGE_RECIPES` move there byte for byte from `recipes.ts`, which re-exports them, because `progress.ts` reads `FORGE_RECIPES` at module load and `recipes.ts` imports `progress.ts` (an import cycle). Ratified as is (commit c8a79a0).
- The models lane's own amendment (commit 7b4419d on `cs/models`: the declared `tests/monster-kits.test.ts` fixture rename and `scripts/blender/review_scales.json` in MP6) is ratified by the main session.

### O-6.1b.6 amendment: kit child names (2026-11-26, main session, from MK1)

GLB node names are unique, so two kits cannot both have a child named `HeadGroup` (the Thornwatch Marksman's kit already does). From now on **every kit child is named `<kit>_<Bone>`** (for example `cinder_adept_HeadGroup`), like the `<key>_<Bone>` bones of a figure.
- **MK1 to MK3** build their children with that prefix, and MK1 builds the hood it left out. MK1 also renames the two existing kits' children (`saltback_stalker_<Bone>`, `thornwatch_marksman_<Bone>`) in `build_monsters.py`; nothing else about them changes.
- **MK1** also edits `tests/monster-models.test.ts`'s kit case (**declared**): it reads the pending manifest when one exists, so it asserts that each child carries the `<kit>_` prefix and that the name without it is a bone of the model.
- **MP6**, in the promote commit with the new `monsters.glb` (the shipped file has the old names until then): `upgradeMonsterRigWithGltf`'s kit loop attaches each child to the bone named by its name with the `<kit>_` prefix removed, and throws when a child lacks the prefix.
- **Emissive (design 5.4, at most one per figure)**: a kit's fire may glow on its own emissive beside its base's (the Cinder Adept: the wizard's violet glints and the brazier's orange fire). Each kit README records it as an owner look check (OM-S6c), not a defect.

### O-6.1b.6 amendment 2: MP6 files and captures (2026-11-26, main session, from the MP6 repair)

- **Declared edit to a frozen test**: `tests/monster-kits.test.ts`. The loader change of amendment 1 throws on a kit child without the `<kit>_` prefix, so the fixture's kit children (`Arm`, `Stray`) must carry it (`spiked_Arm`, `spiked_Stray`) and the lookups read the prefixed names; one case is added for the throw. No assertion is weakened or removed. `tests/model-vertex-colour.test.ts` (painted set gains `saltfang` and `kiln_warden`) and `tests/fixtures/monster-families.json` (two entries) are the follow-through edits the M4c pattern already declares.
- **MP6's file list also holds** `scripts/blender/review_scales.json` (the new figures' and kits' review scales, which SHEETS reads for the roster sheet) and `src/engine/blenderMonsters.ts` (the loader and the `?v=` key).
- **MP6 captures** are as M4c's: the in-engine capture and draw calls are taken at the promote commit in a throw-away worktree because the new defs are not wired until D4, Z4 and U1, so the capture sets their look fields in the throw-away copy only. Frame time is recorded but is too noisy on the shared machine to compare (OM-S4 stands). The owner's look check on a real GPU (OM-S6c) stays open.

### F6 amendment (2026-11-26, main session, from F6's verification)

- F6's file list also holds `src/engine/loop.ts` (allowlist amendment for an engine task, section 5): the engine's `respawned` branch (the one that already re-shows the monster) calls `clearBossDown(STATE, m.typeKey)`. `actions.ts` has no respawn handler and `spawns.ts` has no accessor on `logic.state`; `spawns.ts` only starts a boss `dead` when `bossBackIn` is above 0.

### G-6.1 amendment (2026-11-26, written by the G-6.1 repair lane, ratified by the main session 2026-11-27)

Ratified as written below.
- **G-6.1's files gain `src/engine/actions.ts`** (commit 2f84d42, engine): `handleBossPhase` printed "Its bolts are magic." on phase 0 for every boss, so Marrowjaw said it too. It now prints the line only when `monster.def.style === 'magic'`. Ashmantle's style is `'magic'` and Marrowjaw's is `'melee'`, so only Ashmantle says it (CALL-4.18). No test pins this line yet. If one is wanted, the main session names the task and its new test file.
- **G-6.1's files gain `docs/superpowers/research/content-model/model.ts` and `results.txt`** (commit 3e86aa7, docs): once slice 1 had landed, MODEL counted each shipped Stage 6 row twice (the live table plus the content file), so 27 checks failed. The live imports are aliased, and the world before Stage 6 is derived by id. A shipped row now passes the "id is free" check only if it matches the content file's numbers (drops are exempt until K2). `results.txt` is unchanged except for one added line listing the 23 shipped rows.
- **G-6.0's files gain** `docs/superpowers/baseline/s6/README.md`, `docs/superpowers/research/content-model/run.sh`, `aggro-check.ts`, `aggro-results.txt`, `pacing-rerun.sh` and `pacing-results.txt` (commit 6332d5d, docs): MODEL and PACE run on the tree after G1 and G2. The G-6.1 MODEL repair above cites it as its precedent.

### Q6 amendment (2026-11-27, written by the Q6 repair lane, ratified by the main session 2026-11-27)

Q6's data and text are unchanged. Its Accept was red on two tests that Q6 may not edit, so the repair made two declared test edits, each in its own commit so that either can be reverted alone.
- **`tests/npc-placement.test.ts` (Q5's test)**: the leash rule reads "outside every **aggressive** camp's leash circle", as design 7.2 states and as MODEL checked (`results.txt` section 6). Q5's "every camp's leash circle" is superseded. The content file puts Bran Tolley at (4, 12), 14.2 from the centre of the passive `three_kettle` camp (leash 20); the town's people stand among its passive camps. The arena-plus-6 rule still holds for every camp, and no other check changed. This was the main session's call (move Bran in the content file and the design, or narrow the test); the repair took the design's wording because a new coordinate is in neither the content file nor the design (rule 0.3.6). To take the other option, revert that commit and move Bran.
- **`tests/content-s6.test.ts` (D1's loop audit)**: the reward items of `STORY_QUESTS` count as a source, beside nodes, recipes and drops; the Faint and Steady Embers are closed that way. `ember_bright` joins `LATER_SLICE_CLOSES`: its sources are `ml_ash`'s reward (U3) and the hard diary tier (slice 8). U0, which already edits that list, removes it; that case is green once U3 lands. No `ember_` id is exempted from the source check.

### Q7 amendment (2026-11-27, written by the Q7 lane, ratified by the main session 2026-11-27)

- **Q7's files gain `src/state/commands.ts`** (commit 6fe05ce, engine): only the `{ kind: 'talk'; npcId: string }` member of `PlayerCommand` and its place among the engine-handled cases of `applyCommand` (beside `attack` and `move`), so the `talk` dispatch of `updatePlayerIntent` type-checks in lane E alone, without a cast. Q8 edits the same file: it keeps the member and replaces the engine-handled case with the real applier. No other line of the file changes.

### Q9 repair amendment (2026-11-27, written by the Q9 repair lane, ratified by the main session 2026-11-27)

- **Q9's files gain `src/ui/dialogue.ts` and `src/engine/loop.ts`**: the task-master interaction (`act === 'slayer'`) and the dialogue event `open: 'tasks'` now call `openQuestsModal('tasks')`, so they land on the Tasks tab even when the log last showed Journal. Nothing else in those files changes.

### G-6.2 amendment (2026-11-27, written by the G-6.2 lane, ratified by the main session 2026-11-27)

- **G-6.2's files gain `docs/superpowers/research/content-model/results.txt`** (docs): the gate's MODEL run regenerated it, and the only change is in its "shipped so far" line, which gains `ember_faint`, `ember_steady` and `ember_bright` (shipped by Q6 with the content file's numbers). `check-results.txt` and `aggro-results.txt` came out byte-identical. No script changed. This is the same kind of file as in G-6.1's amendment.

### Z4 amendment (2026-11-27, written by the Z4 repair lane, ratified by the main session 2026-11-27 with every proposed option)

Z4's data as shipped (commits f1c5c46, 2405ba2, f18be76) holds three points where the plan and the frozen tests disagree. Ratified: the `NODES` filter in `tests/support/starterChain.ts` and, for the same reason, `tierRecipes` in `tests/support/pacingModel.ts` keeping only recipes made from overworld nodes (both declared, made by the main session; Stage 3's numbers are the pre-Z4 ones, `tests/pacing.test.ts` and `tests/economy-invariants.test.ts` unedited and green); the Tough Hide and the Chitin Plate move to K2; `sting_arc.reach` is 2.9 and `content.ts` and design 7.7 follow.
- **ECON is red on a frozen helper (rule 0.3.3).** `tests/support/starterChain.ts` exports `NODES` as all of `RESOURCE_NODES_DEF`, so the new `adamantite_rock` (`where: 'dungeon'`, content file `NEW_NODES`) reaches Stage 3's overworld model. `siteSize` throws "No placement of adamantite_rock." (`tests/economy-invariants.test.ts`, the fishing bound; `tests/pacing.test.ts`, the milestone table), and `forgeTasks(rune)` mines adamantite from Mining 40, cannot smelt it (2 coal, never gathered), fills the backpack and stops at 200,000 actions ("did not unlock"). Proposed: a declared edit of one expression, `NODES` keeps only nodes whose `where` is not `'dungeon'` (`export const NODES = Object.fromEntries(Object.entries(RESOURCE_NODES_DEF).filter(([, n]) => (n as { where?: string }).where !== 'dungeon')) as unknown as Record<string, NodeDef>;`; no node before Z4 has a `where` field, so the set is exactly the pre-Z4 one); the dungeon's income is held by its own bound (`tests/dungeon-data.test.ts`, design 7.6). It restores the exact pre-Z4 node set to every Stage 3 assertion, so no number moves and no assertion is loosened. Alternative: keep the node out of `RESOURCE_NODES_DEF` (a separate dungeon-node table), which changes Z2/Z3's reading of node types. The repair lane did not make the test edit.
- **The Warren chest's Tough Hide (rule 0.3.6).** `tough_hide` is not in the live item table until K2, and Z3's test fails a `loot` entry with an unknown id, so `CHESTS.saltfang_warren`'s `{ id: 'tough_hide', qty: [1, 2] }` cannot ship in Z4. Proposed: K2's Files gain `src/data/dungeons.ts`, and K2's Change appends that run entry to `saltfang_warren`'s `loot.run` beside the drops D4 and C2 left out. MODEL reads the chest from the content file, so its figures do not move. Alternative: Z4 adds the `tough_hide` item row itself (outside Z4's ids).
- **`sting_arc.reach` (rule 0.3.6).** The content file (line 251) gives 13.5; with the cone of 14 and 50 degrees, `minWindupMs` is about 1504 and the frozen `tests/attack-data.test.ts` needs `windupMs >= minWindupMs + 200`, so 1600 fails (the exact minimum at reach 13.5 is 950 + (6.07 + 0.3) / 11.5 x 1000 + 200 = about 1704 ms; at 2.9 it is about 1369). Shipped: 2.9 (`MELEE_RANGE`, as Stage 4's melee `tail_lash` cone), which keeps design 7.7's 1.6 s. `boss.ts` and `fight.ts` never read an attack's `reach`, so no MODEL or B2 figure moves. Caveat: the engine does not gate a wind-up on `reach`, so a hero at 6 to 9 inside the cone needs more escape than 2.9 assumes. Alternative: keep 13.5 and lengthen the wind-up to at least 1750 ms, which moves design 7.7's 1.6 s and B2's bounds. On ratification, the main session writes the chosen number into `content.ts` line 251 and design 7.7. To take the alternative, revert the `sting_arc` lines of f18be76.
- **Scree Skitter's Chitin Plate (rule 0.3.6).** `chitin_plate` is not in the live item table until K2, so `MONSTER_TYPES.scree_skitter` ships without the content file's `{ id: 'chitin_plate', chance: 0.06 }` (content file line 123). Proposed: K2's Change appends that drop to `scree_skitter`'s `drops` beside the drops D4 and C2 left out (`src/data/world.ts` is already in K2's Files). Every other Z4 row matches the content file; the only entries left out are this drop and the Tough Hide above.
- The two repair commits were reworded from `fix(Z4)` to `data(Z4): repair: ...` (rule 0.3.5); their trees are unchanged.

### Z5 repair amendment (2026-11-27, written by the Z5 repair lane, ratified by the main session 2026-11-27)

Ratified with the proposed option (K2 appends the entry and tops up the saves that finished the chapter without it; K1 tests both).

Z5 shipped `ml_salt` (commit 695bbc3) with `xp: {}`. Design 7.3 pays 2,000 Crafting XP. Z5 cannot ship that entry: `SKILLS_META.crafting` arrives with K2, `tests/story-data.test.ts` fails a reward skill outside `SKILL_KEYS`, and `grantExactXp` ignores a skill the state does not have. No later task could add it either: K2's Files left out `src/data/story.ts`, and K4 must not change an earlier quest's reward. Proposed:
- **K2 appends the entry.** K2's Files gain `src/data/story.ts`: `ml_salt`'s `reward.xp` becomes `{ crafting: 2000 }`, in K2's data commit, and the comment above the reward goes. No other key of that file changes. It is K2 and not K4 because it has to land in the commit series that adds the skill: a save that finishes the chapter after the skill exists and before the entry does could not be told from a paid one. This is a declared exception to rule 0.3.7 ("every existing quest's reward"), for this one key, once. K4's Must-not-change is as written and now covers the completed reward.
- **K2 tops up the saves that finished the chapter without it.** K2's Files gain `src/state/save.ts`, as a rule commit of its own (rule 0.3.5). In the loader, after `state.quests.claimed` is filtered: if the stored save has no `skills.crafting` entry and the filtered `claimed` holds `ml_salt`, call `grantExactXp(state, 'crafting', 2000)`. The amount is read from the `STORY_QUESTS` row, not written a second time. Why the test is exact: `saveGame` writes every key of `state.skills`, so no build before K2 writes a `crafting` entry and every build from K2 on does. The top-up therefore runs on the first load after K2 and never again, with no new save field and no version bump. The gold, the bars, the ember and the title were paid when the chapter finished and are not touched. Known limit: a save edited by hand to drop the `crafting` entry is paid again and loses its Crafting XP in the same edit; a local save can be edited to any XP anyway.
- **K1 tests both.** K1's Change gains, in `tests/crafting.test.ts`: `ml_salt`'s `reward.xp` deep-equals `{ crafting: 2000 }`; a version-4 save with `ml_salt` in `claimed` and no `skills.crafting` loads with exactly 2,000 Crafting XP (not multiplied at 10x) and the level `getLevelForXp(2000)` gives; that state saved and loaded again still has 2,000; a save with `ml_salt` claimed and a `skills.crafting` entry loads with that entry's XP unchanged; a save without `ml_salt` claimed and without the entry loads with 0. K1's sentence "a loaded version-4 save has Crafting 1 with 0 XP" reads "unless `ml_salt` is claimed". No fixture or golden claims `ml_salt` (`tests/fixtures/s6/progress-hostile.json` names it only under `progress.story`), so the three declared fixture edits of K1 stay one added `crafting` entry each. From K2 on, the reward walk of `tests/story-data.test.ts` checks the 2,000 on its own, unedited.
- **Until K2 lands**, a player who finishes chapter 3 gets everything but the Crafting XP, and gets that on the first load of a build with K2. Slice 3's gate (G-6.3) reports this as a known gap against design 7.3, closed by K2; G-6.4 checks it closed.

Alternative: K2 appends the entry and nothing tops up old saves. A player who finished chapter 3 between the merges of slice 3 and slice 4 never gets the 2,000 XP (about 6 Work Blue Body actions at Crafting 35, 340 XP each). It saves the loader lines and the four load tests. To take it, strike the second bullet and the load cases of the third.

The repair changed no data and no text: one docs commit (this amendment) and one data commit that rewords the comment above `ml_salt`'s reward to cite it.

### Z6 repair amendment (2026-11-27, written by the Z6 repair lane, ratified by the main session 2026-11-27)

- **Z6's files gain** `src/data/dungeons.ts` (a typed optional `props?: { node; x; z; scale?; rotY? }[]` on `Dungeon`), `src/engine/worldMesh.ts` (one line: `G.groundMesh = G.terrainMesh` where the terrain mesh is built) and `src/engine/runtime.ts` (`enterZone` and `leaveZone` added to the `window.__DEBUG` object literal, replacing the import-time `defineProperty` hook, which `runtime.ts`'s later assignment would have replaced anyway).
- **The sky module's scope is `setSkyVisible(on)` only again**: `updateSky` is back to its merged text. The zone's fog is `applyZoneAir()` in `zones.ts`, called from `loop.ts` after `updateAir`: it writes `AIR.uAirColor`, `uAirSunColor`, `uFogHeightFalloff` and `uFogDensity`, so the shader fog and (through the untouched `updateSky`) `scene.fog` are dark and dense. `zones.ts` no longer writes `scene.fog`. The clouds are hidden by layer because `updateSky` rewrites their `visible` each frame. C3's `CAVE_FOG_SCALE` should replace the density line of `applyZoneAir` for a cave.

### G-6.3 amendment (2026-11-27, written by the G-6.3 lane, ratified by the main session 2026-11-27)

- **G-6.3's files gain `docs/superpowers/research/content-model/results.txt`** (docs). The gate's MODEL run regenerated it. The only change is its "shipped so far" line, which gains the nine ids of slice 3, each shipped with the content file's numbers. `check-results.txt` and `aggro-results.txt` came out byte-identical, and no script changed. This is the same kind of file as in the G-6.1 and G-6.2 amendments.
- **G-6.3's files also gain `docs/superpowers/baseline/s6/g63/`**: the README, the capture job, `facts.json` and the pictures for H-3, as G-6.1 and G-6.2 had.
- **One defect for a repair and one design question**, with the evidence in that README (findings 1 and 2). This gate fixes neither.
  - **The overworld's grass carpet and weather particles draw inside a zone.** This fails Z6's [HUMAN] check. A Z6 repair would need `src/engine/flora.ts` and `src/engine/particles.ts`, beside `zones.ts`.
  - **A camp's circle is `ceil(spread + 4.5)`, in `zoneCamps` and in the overworld's `makeCamp` alike.** For a one-member boss camp that is 5, so Matron Saltfang (like Marrowjaw and Ashmantle) engages only a hero within 5 of her, and her `aggro` 12 is moot. Once she is fighting, the boss branch of `stepMonster` does not leash on that circle. This is a design question for the main session and the owner, not a defect of slice 3. A change would be in both `makeCamp` and `zoneCamps`, and slice 3a's caves read `zoneCamps` too.
- **Z4's files gain `src/data/recipeTable.ts`** (commit f1c5c46). Since the F2 amendment it holds `FORGE_RECIPES`, which is where `smelt_adamant` and the three adamant forging recipes go. No earlier amendment covers it for Z4.

### C3 repair amendment (2026-11-27, written by the C3 repair lane, ratified by the main session 2026-11-27)

- **C3's files gain `src/engine/context.ts` and `src/engine/overlay.ts`.** `G.zone.def` is typed `Zone` (not `Dungeon`) and `renderMinimap` draws gates only when the zone has a run, so the minimap no longer throws in the cave (the cave row has no `gates`). The two `as unknown as Dungeon` casts in `zones.ts` are gone.
- Also in the repair: the cave branch of `leaveZone` calls `clearTelegraph` before `sendHome`; the cave's prop loader throws like Z6's on a missing glb or node; the four `!== -1` guards, the bare block and `setCaveWeather`'s `fallMesh` guard are removed (`updateParticles` already hides the fall mesh while the cave weather is on); `applyZoneAir` leaves the colour `updateAir` wrote from `CAVE_LIGHT.air` in a cave.

### G-6.3a amendment (2026-11-27, written by the G-6.3a lane, ratified by the main session 2026-11-27)

- **G-6.3a's files gain `docs/superpowers/research/content-model/results.txt` and `pacing-results.txt`** (docs). The gate's MODEL and PACE runs regenerated them, and no script changed. `check-results.txt` and `aggro-results.txt` came out byte-identical.
  - `results.txt` changed in three lines, all from the Ember Hurler's row: `ashes` gains `drop` as a source, and the save section's stat keys go from 134 to 135 (the new block at every bound goes from 5,005 to 5,036 bytes).
  - `pacing-results.txt` was last regenerated at G-6.0, so its diff also carries slices 1 and 2. A run on `8a67c06` shows slice 3a moves only block 2, the convention-only variant (`docs/superpowers/baseline/s6/g63a/README.md`).
- **G-6.3a's files also gain `docs/superpowers/baseline/s6/g63a/`**: the README, the capture job, `facts.json` and the pictures for H-3a, as G-6.1 to G-6.3 had.
- **One allowlist point for the main session.** C2's `src/state/monsterAi.ts` diff has, beside `sendHome` and the `respawnSecs` option of table 0.5 row (a), the dying-to-dead line of `stepMonster`, which reads `m.respawnSecs` when set. Row (a) names the option but not this line, and without the line the option has no effect. Proposed: ratify the line as part of row (a).
- **Findings for repairs, with the evidence in that README** (findings 1 to 8). This gate fixes none of them.
  - The grass carpet draws inside the cave (G-6.3's finding 1, still open).
  - The camera shows the outside of a wall near a corner, because the arm stops at `distanceMin x cos(pitch)`.
  - The lava fissures lie as flat slabs across the wall lines.
  - The cave draws about 1,000 calls a frame, against design 10's 150 for a zone.
  - The Hurler's tint does not read in the cave light.
  - The target panel outlives the cave.
  - The cave mouth has two labels.
  - The region banner names the volcano inside the cave.

### G-6.3b amendment (2026-11-27, written by the G-6.3b lane, ratified by the main session 2026-11-27)

- **G-6.3b's files gain `docs/superpowers/baseline/s6/g63b/`**: the README, the capture job, `los-check.ts` and its output, `facts.json`, the four traces and the pictures for H-3b, as G-6.1 to G-6.3a had. MODEL's three result files came out byte-identical, so no result file is regenerated.
- **Two points for the main session and the owner, with the evidence in that README** (findings 1 and 2). This gate changes neither.
  - **A safe spot round the c2 corner.** The front hall's Ember Hurler holds its fire on a hero just past corridor c2 in the back hall. 20 cells inside its leash (camp radius 10 + 4) have a clear line to that spot, but its route hugs the blocking corner and no point of it has a line; it turns back at the leash and goes home. The probable cause, read from the code, is L2's edit 3: the repath goal is melee range of the hero, not the nearest cell with a line. The levers are the cave row (design 7.6), the leash, or the chase goal in `monsterAi.ts`. Whether it is a slice 3b defect is the main session's call.
  - **H-3b's castle item cannot happen in play.** The only dark wizard camp's leash disk ends 20.97 from the nearest castle blocker, against a reach of 11. The owner may name another wall for that check, or drop it.

### Slices 3 to 3b follow-ups (2026-11-27, main session, from the G-6.3, G-6.3a and G-6.3b findings)

Ratified with the amendments above: C2's dying-to-dead line in `stepMonster` reading `m.respawnSecs` is part of table 0.5 row (a). Each finding below is a task, verified by opus; files are named, and a task that needs another file writes a proposed amendment. Two points go to the owner at H-3 and H-3b and are not tasks: a one-member boss camp's circle (`ceil(spread + 4.5)`, so a boss's `aggro` is moot) and the castle item of H-3b.

- **SF1 Zone air** [AGY, sonnet] (`src/engine/flora.ts`, `src/engine/particles.ts`, `src/engine/zones.ts`): the grass carpet and the weather particles are hidden while `G.zone` is set and shown again on leave. Test (new `tests/zone-hide.test.ts`): after `enterZone` the carpet and every weather emitter are not visible; after `leaveZone` they are as before.
- **SF2 Zone camera** [CLAUDE, opus] (`src/engine/camera.ts` or the module that owns the arm, and `zones.ts`): inside a zone the camera arm is shortened so the eye stays inside the room walls (a ray from the hero against the zone's wall mesh), so the outside of a wall never shows. Test: the eye position is inside the zone's open cells for every yaw at the corner the G-6.3a README names.
- **SF3 Cave look** [CLAUDE, opus] (`src/engine/zones.ts`, `src/data/caves.ts` or the cave row): the lava fissures follow the floor inside the rooms and never cross a wall line; the Ember Hurler's tint reads in the cave light (its tint or the cave's light adjusted, measured on a capture against the cave floor); one label at the cave mouth; the region banner names the cave inside it.
- **SF4 Cave draw calls** [CLAUDE, opus] (`src/engine/zones.ts`): the cave's static geometry merged by material (as Z6 did for the Warren), so a frame in the cave draws at most design 10's 150 calls plus the figures; measured with the perf HUD in a capture.
- **SF5 Target panel** [AGY, sonnet] (`src/engine/zones.ts`, `src/ui/hud.ts`): leaving a zone clears the target panel. Test in `tests/zone-hide.test.ts`.
- **SF6 Chase with a line** [CLAUDE, opus] (`src/state/monsterAi.ts`, L2's edit 3): a ranged monster that has no line to the hero repaths to the nearest reachable cell inside its leash that has a line to the hero, not to melee range; test (new `tests/los-chase.test.ts`) on the c2 corner of the cave: the Hurler reaches a cell with a line and fires.
- **SG3 Gate rerun** [CLAUDE, opus]: G-6.3, G-6.3a and G-6.3b's checks and captures again after SF1 to SF6, under `docs/superpowers/baseline/s6/g63-follow/`.

### SF3 amendment (2026-11-27, written by the SF3 lane, for the main session to ratify)

- **SF3's files gain `src/engine/worldBuild.ts`**, one guard in `buildDungeonDoors`. A door that stands on a `POIS` place (the cave mouth on Slagfall Terrace) does not push its own place label, so the place's label is the only one. The door's hover name and click are unchanged. No `POIS` row changes, since `tests/cave.test.ts` keeps `slagfall_terrace`.
- **SF3's files also gain `docs/superpowers/baseline/s6/sf3/`**: the README, the capture job, `facts.json` and the pictures, as the gates had.
- **`zones.ts` imports `triggerRegionBanner` from `actions.ts`**, which already imports `zones.ts`. The cycle is only between functions called at run time. `tests/architecture.test.ts` passes.
- **The Hurler's tint is not fixed. It needs files outside SF3's list.** The measurement is in the README (scene D).
  - The Lesser Demon's red is in the model's vertex colours. `blenderMonsters.ts` multiplies `tint` into the material colour, so no tint value can make the Hurler anything but a darker red.
  - Today the front Hurler measures luminance 0.0109 against the demons' 0.0120 to 0.0126, at the same hue.
  - A change to `CAVE_LIGHT` lights both figures alike.
  - **Proposed:** an optional field on the monster row, set only on `ember_hurler`, for example `tintAsColour: true` (`src/data/world.ts`). With it, `blenderMonsters.ts` gives the body, horn and membrane materials the tint as their colour, with vertex colours off.
  - Shown in the page only, this proposal gives the Hurler 3.0 to 3.7 times the demons' luminance, and a contrast to the floor of 1.52 against 1.07 to 1.19. It stays red-hued under the ember light.
  - If the owner wants it to read ash-pale and not red, add the `CAVE_LIGHT` retune that C1 declares for H-3a (`src/data/look.ts`, and its one `tests/cave.test.ts` assertion).
  - No frozen assertion pins the new field: `tests/monster-models.test.ts`'s snapshot has no `tint`, and `tests/cave.test.ts` pins `tint` `0xb8b2a7`, which stays.
- **Not SF3's, and it was there before SF3:** after a death, `finishRespawn` (`actions.ts`) sets the saved region to `lumbridge` but does not write the footer, so the footer names the last region (README finding 2, G-6.3a `g1`).

