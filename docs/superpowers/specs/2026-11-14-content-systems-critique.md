# Content and systems: critique of the design and the plan

Date: 2026-11-14. Branch `feat/content-systems` at `ebf260e`. Documents critiqued: `2026-11-14-content-systems-design.md` ("the design") and `../plans/2026-11-14-content-systems-plan.md` ("the plan"), with the model in `../research/content-model/`.

Method: every premise was checked against the code on `main` (`5caa597`), Stage 3's branch `origin/feat/start-pacing` at `ffa87cb` and Stage 4's approved design on `origin/feat/combat-weight` at `732cb8c` (read with `git show`), and Stage 5's approved design (reference copy). The committed model was re-run (`run.sh`, 1 GB cap): before any change it reproduced `results.txt` and `check-results.txt` byte for byte. An independent script, `critique-check.ts` (`critique-check.sh`, output `critique-results.txt`), recomputes the economy with none of `model.ts`'s income arithmetic. No test, type check, build or dev server was run.

## Verdict: READY-WITH-FIXES

The architecture holds: tagged-data dialogue with a pure interpreter, one stage index per quest, counters, dungeons as an offset zone with a swapped walk grid, bosses as rows, the save as one optional block. The economy is safe in shape (no lockout is needed: a run pays about half of open ground once goods are counted on both sides). But four premises were wrong against the code or against the approved Stages 4 and 5, one new monster printed money, five frozen tests were going to go red without being declared, and the corrupt-save flow had a path that lost the save it was meant to keep. All of those are fixed in the documents and the model by this commit. What is left is owner choice (section 5).

## 1. Premises

| # | Premise in the design | Evidence | Holds? |
|---|---|---|---|
| P1 | Talking prints one chat line, no state | `loop.ts` 216-220 | Yes |
| P2 | A quest is closures over flags; claimed ids outside the table dropped on load | `adventure.ts` 33-55; `save.ts` 88-89 | Yes |
| P3 | `addChatMessage` writes `innerHTML`; `showBanner` and the title use `textContent` | `hud.ts` 60-68, 120-129, 192-195 | Yes. Quest names and option text that reach a chat line are markup: see M6 |
| P4 | New `resource`/`bar` items cannot be bought | `buyItem` refuses `isGatheredGood` (`inventory.ts` 176, set at 208), not 208-214 as cited | Yes (wrong line). But the same set feeds the one-click "sell gathered", which would sell embers for 1 GP: H6 |
| P5 | `isWalkable` and `moveWithCollision` clamp at ±118; the grid is 236 from -118; `sanitizePose` clamps | `collision.ts` 107-122; `pathfind.ts` 10-25; `save.ts` 212-213 | Yes |
| P6 | Stage 4 gives `moveWithCollision` an optional walk test | Stage 4 design: "gains an optional walk test (default `isWalkable`)". It does not say the ±118 clamp goes, nor that `stepMonster` passes the test to its three movement calls (chase, return, wander: `monsterAi.ts` 166, 200, 270) | **Partly.** Without both, a zone monster at x 1000 is clamped to x 118 on its first step: C2 |
| P7 | A zone monster uses `respawnSecs: Infinity`, "the option Stage 4 adds for bosses" | Stage 4's `respawnSecs` is a field of `BossDef`, keyed by monster **type** (`BOSSES[typeKey]`); no per-instance option exists; Infinity is never mentioned | **No.** Stalkers, marksmen, Adepts and Brutes in a dungeon share a type with overworld camps: H3 |
| P8 | The camera far plane is 360, so zones over 470 away are culled; the sky is centred on the overworld | True on `main` (`renderer.ts` 112). Stage 5 (approved, lands first) raises `far` to 460, makes the dome follow the camera (radius 440) and adds a horizon apron out to radius 240 (Stage 5 design 6.4) | **No**: C1 |
| P9 | Every monster is stepped; aggression skips a hero whose combat is above the monster's level | `loop.ts` 551-572; `monsterAi.ts` 219-231, `adventure.ts` 271-275 | Yes (no near-hero culling on `main`) |
| P10 | The pass sentries are lesser demons (68) in the volcanic region | `worldMap.ts` 223-227; centre (-32, 55) is 40 from the `wilderness` centre, radius 46 | Yes. The new camps `cinder_circle` and `brute_shelf` are in **no** region, so no diary peace reaches them |
| P11 | Stage 3: `STARTER_QUESTS` seven ids with `arrival` first; `createNewGameState` claims `arrival`; `claimQuest(state, id)` reads both tables and opens the chain one at a time; XP unmultiplied | `adventure.ts` 219-351, 609-636; `gameState.ts` 97 (Stage 3 branch) | Yes. Coins are `state.gp +=` at its head; `creditGp` is planned (its C1/C2), not built |
| P12 | Stage 3's pacing test plays the chain as 29 actions | `pacing.test.ts` 128-129 | Yes |
| P13 | Stage 3's pacing model cannot see Stage 6's monsters | It builds its candidate list from `CAMPS` (`pacingModel.ts` 10, 106-120) and picks the most hitpoints a second | **Only for dungeon camps.** The three overworld camps are candidates: H1, H2 |
| P14 | Stage 3's 2.5 rule iterates every recipe; gear-drop caps per monster; fishing 1.5x | `economy-invariants.test.ts` 14-67; `RATIO_EXCEPTIONS = ['fletch_shortbow']` | Yes; new rows are covered unedited |
| P15 | Stage 3's freeze test has "declared-additions lists" for every table | Only `DECLARED_NEW_ITEMS` (`content-freeze.test.ts` 11-12); Stage 4 adds `DECLARED_NEW_MONSTERS`. Nodes and recipes are pinned by the golden with no list | **No**: H4 |
| P16 | Only Stage 3's two goldens and `world-budget` move | Stage 2's `save-relocation.test.ts` 45-49 compares a serialised save, `skills` included, to `save-relocation/v4-loaded.json`; `world-data.test.ts` 162 pins the overworld member count (Stage 4: 42); Stage 4's rewrite of `blender-hero.test.ts` asserts 13 monster type keys | **No**: H4 |
| P17 | Stage 3's "no test asserts a time" | Stage 3 plan rule 10 and its grep | Held, if the dungeon-income test asserts a ratio, not seconds (L4) |
| P18 | Stage 4's death: 3% of the level's span in each fighting skill, the vow, waking in the start town; regeneration 0.25 / 1.0; Ashmantle separate from the untouched dragon; the two recoloured monsters | Stage 4 design approval note, 564-606, 517-528, 324-366, 696-699 | Yes; the design is consistent with the final answers |
| P19 | Today 24 open items; 19 recipes for equipment | `results.txt` section 1, re-run | Yes |
| P20 | The three Stage 1 save debts | Foundation design 648-650 | Yes, all three named and answered; one path of the answer was wrong (H5) |
| P21 | Bran's "Leather Gloves" are an existing item | The item `leather_gloves` is named "Leather Vambraces" (`catalog.ts` 306) | No (name only): L1 |

## 2. Numbers: the author's beside the re-check

| Quantity | Author | Re-check | Note |
|---|---|---|---|
| Worst new recipe against 2.5 | 2.50 | 2.50 (`craft_black_body`: 3 x 910 in, 6,825 out; `craft_mystic_top` 2.50) | Agree. No headroom, but the frozen test uses the same floors |
| Crafting: kills for a set | 60 to 75 | 30 (stalkers) to 100 (skitters); 60 to 75 for the monster of the set's level | Agree in substance |
| Runebinding cost per kill at 70 | 596 GP bound, 1,741 bought, 715 coins | 596 / 1,741 / 715 (blood barrage: 2 blood at 50.6, 2 death at 35) | Agree. At 50 the bound cost is still 127% of the kill; magic "breaks even" only from about 60 |
| Ranged cost per kill, made arrows | 6 to 10% | 6 to 10% | Agree: a ranger who smiths pays what it pays today (M2) |
| Cinder Adept coins per hitpoint | "on the line" | **5.75**, the lesser demon's (5.72, level 68); the line at 52 is 4.86 | **Disagree** (H1). Fixed to 230-550 GP, 4.88 |
| Best open ground at skill 45 | Moss Guardian 54.9 GP/s | Cinder Adept 77.2 (before the fix); 65.5 after | The model compared monster level with **skill** level and left the Adept out |
| Warren run against open ground | 0.63 | 0.52 (goods counted on both sides, model after fixes); 0.49 independently | Lower than claimed; the bound holds more easily |
| Underkiln run against open ground | 0.74 | 0.60 (both); the model had left out the boss's two Kilnglass (1,560 GP) and every monster's goods (2,727 GP a run) | Holds |
| Kilnglass for a dragon kit | about three clears | **one clear**: 8 first-clear + 4 chest + 2 boss = 14 shards for 13 ingots | Disagree (M3) |
| Material drops against coins | at most 25% | 10 to 24% raw; **25 to 55% once worked** into the best recipe; bones bound into blood runes add 37% to a lesser demon | The bound is real but measured raw (M1) |
| Quest coin | 64,500 + 3,800 | 64,500 + 3,800 | Agree |
| Boss kill time, one row each by hand (no dodging) | 61 / 89 / 99 s (model, with dodging) | 43 / 55 / 74 s with no time lost; dodging and walking cost 26 to 38% | Consistent with the model |
| Fight table | every bound holds | re-run: identical, every bound holds | Agree |
| Save block at bounds | 4,977 bytes | not recomputed independently; the reader walks tables, so the bound follows from table sizes | Accepted |

## 3. Findings

### Critical

**C1. The dungeon would show the overworld.** The design rests on "past the camera's far plane of 360" and "the sky is not drawn". Stage 5, approved and landing first, sets `far` to 460, makes the sky dome follow the camera, and builds a horizon apron to radius 240 round the origin. From a zone at x 600 with the camera 26 behind the hero, the apron is about 373 away: in view. The dome is always in view. *Fixed*: zones move to x 1000 (734 clear of the apron less the camera's reach, checked in `model.ts` section 7 against 460); `enterZone` hides the dome and the apron explicitly; Z6's allowlist takes Stage 5's sky module; R0 records it.

**C2. Zone monsters would leave the zone on their first step.** `stepMonster` moves with `moveWithCollision(x, z, dx, dz)` in three places and that function clamps to ±118 before any walk test. Stage 4 adds an optional walk test but neither removes the clamp nor says `stepMonster` passes it. A zone monster at x 1000 would be put at x 118, in the overworld. *Fixed*: Z2 passes `world.grid.walkable` to all three calls and drops the clamp when a test is given; Z1 tests a zone monster chasing, returning and wandering at x 1000; R0 checks what Stage 4 built.

### High

**H1. The Cinder Adept was the best income from level 45 to 59.** At 80 hitpoints and 275-645 coins it paid 5.75 coins a hitpoint, a level-68 lesser demon's rate, at level 52: 30% more a second than moss guardians, the open ground the stage measures dungeons against. *Fixed*: coins 230-550 (4.88 a hitpoint, the moss-to-demon line at 52). It is still the best coin-only spot at skill 45 by 10%, as a level-52 monster should be.

**H2. Stage 3's pacing model will choose the new overworld monsters, and maybe Marrowjaw.** It maximises hitpoints a second over every type in `CAMPS`. The Adept (13.4 hp/s at skill 45 against 13.2 for moss guardians) and the Brute are candidates; Marrowjaw is a 560-hitpoint target the model respawns in 8.35 s, not 180 s, and pays 1.61 coins a hitpoint, so if the model can "win" against it, it farms it and every kit comes later. Nothing was run. *Fixed in the plan*: D4 prints the pacing table's choice per tier and, if Marrowjaw is chosen or ECON fails, the declared fallback is to keep Marrowjaw's camp out of `CAMPS` (a `BOSS_CAMPS` list the engine spawns, tested by D3 with the same world-data rules) rather than tune the boss; the Adept fix of H1 lowers the other risk.

**H3. "No respawn inside" has no mechanism.** See P7. *Fixed*: `createMonsterLogic` gains a per-instance `respawn: false` option (dead stays dead); zone monsters use it; Z1 tests that an overworld Saltback Stalker still respawns. The same rule now holds for zone nodes: a vein inside gives one ore a run. The design said both "nothing respawns" and "nodes work as outside"; the second made one clear of the Warren an unlimited, safe adamantite mine.

**H4. Five frozen tests were going to fail undeclared.** Stage 2's `save-relocation` golden (the two skills), Stage 2/4's `world-data` member count (42 to 48), Stage 4's `blender-hero` type-key count (13 to 19), and Stage 3's freeze test, which has no declared list for nodes or recipes. *Fixed*: design 11.3 and plan rule 0.3.3 name each file, the exact assertion and the new value; D1 adds `DECLARED_NEW_NODES` and `DECLARED_NEW_RECIPES` beside Stage 3's and Stage 4's lists (a structural, additive edit, declared).

**H5. "Load the older save" lost the broken save.** Only "Start a new game" called `keepCorrupt`. When `_corrupt` already held an earlier copy, or when `applyState` threw (so `readSave` copied nothing), loading the legacy save released the hold and the next autosave overwrote the only copy. *Fixed*: every button that releases the hold calls `keepCorrupt` first and stops if it returns `kept: false`; F3 tests both exits.

**H6. Embers could be sold for 1 GP by one click, or bought if the guard moved.** An ember is a `resource`, so the store's "sell gathered goods" sells it with the ore. *Fixed*: the bulk-sell match skips items with `lampXp`, and `buyItem` refuses them by that field as well as by type; Q3 tests both.

### Medium

**M1. Drops are worth up to 55% of coins once worked.** The 25% bound is measured at raw sale value; a hide made into its body is worth up to 2.5 times that, and a dragon bone bound into blood runes adds 37% to a lesser demon. Stage 3 accepted crafting as earning (its F15), and the 2.5 rule caps each step. *Not changed*; stated in the design's risks and in owner decision 6.
**M2. The ranged "price" is real only for buyers.** Made arrows cost 6 to 10% of a kill, as today; ranged stays about 1.8 times melee's damage for about the same cost. Magic's price is real (83 to 127% of a kill even with bound runes). *Stated honestly in 7.4; owner decision 2.*
**M3. Kilnglass: one clear, not three.** *Fixed* in the text; owner decision 7 offers fewer first-clear shards if three clears is wanted.
**M4. Saltfang's question is Marrowjaw's, faster.** Both are "step out of a circle placed at you"; the tempo rise is a number. The Warden's band is genuinely different. *Not changed*; owner decision 8.
**M5. "Rehearse on a copy, then apply" runs every effect twice.** Sound today (no effect draws randomness) but two code paths that must agree. *Fixed*: `chooseOption` applies to a `cloneState` copy and commits it with `applyState` only when all effects succeed.
**M6. Quest, journal, diary and person names reach `innerHTML` through chat lines.** They are trusted data, but the `<`/`&` scan covered dialogue text only. *Fixed*: the scan covers every string of the five new tables.
**M7. Writing review was planned for slice 2 only.** About 150 more passages land in Z5, K4, N4 and U3. *Fixed*: each of those slice gates reads its passages, and H-3 to H-6 include talking to the people the slice changed.

### Low

**L1.** `craft_gloves` makes "Leather Vambraces", not "Leather Gloves". *Fixed* (recipe name and text).
**L2.** Zone camp ids (`nest`, `forge`, `lair`) could collide with overworld ids in Stage 4's per-camp wind-up gate. *Fixed*: zone camp ids are prefixed with the dungeon id.
**L3.** In a session, an overworld boss's respawn timer freezes while the hero is in a dungeon (it is not stepped) while the saved timer runs on the wall clock. Harmless; noted in 7.9.
**L4.** The dungeon-income test asserts a coin-per-second ratio. *Fixed*: it asserts the dimensionless ratio only, never a time.
**L5.** Runebinding is close to a specific game's rune-making skill (blank stones mined, bound at altars, several runes a stone at higher tiers), and the diary's easy/medium/hard regional tiers with lamp-like rewards to its achievement diaries. The owner allows techniques; whether these two are a technique or a copy is the owner's call (decision 9).
**L6.** The wall-clock boss timer can be shortened by moving the clock back; accepted (cheating is not a boundary).
**L7.** A Stage 6 save loaded and re-saved by an older build loses `progress` and the story ids in `claimed`, so the new build would offer the quests and diary tiers again. Requires an old build; accepted and stated in section 9.
**L8.** The existing quest `maple` rewards a maple bow (`phase3-content.test.ts` 66-69), which slice 8's rule would make shoot iron arrows. Stated in 7.4.

## 4. What was checked and holds

- **Dialogue system.** Fourteen condition kinds and eight effect kinds are each used by a quest or a diary task; none can be dropped without moving a rule into code. Content is data, there is no eval or parser, saves hold no free text, and the panel writes with `textContent`. Every tree is walked by D1's data test (resolution, reachability, termination, limits) and every quest by Q5's walk.
- **Aggression in dungeons.** `ignoresLevel` is one condition on zone camps only; Stage 2's territory tests and Stage 4's routes use overworld camps, which never carry it.
- **Diary peace and the pass.** The volcanic medium tier needs chapter 5 (crossing the pass) and 25 lesser-demon kills, which are the sentries' type; the perk arrives only after the gate has been passed. It removes the gate for return trips between combat 60 and 69, which is its intent, and reaches no new camp (they lie in no region).
- **Save.** Version stays 4; the old reader ignores unknown top-level keys (`migrateLegacySave` reads named fields only); the reader iterates tables; Stage 3's "same top-level keys" passes because `progress` is absent when empty; nothing of Stage 3's chain needs migrating (its state is `claimed`).
- **Quests.** Rewards pay once by construction; both starter routes call one `claimQuest`; work done before counts, as stated.
- **Scope.** Each slice is shippable and showable; the order is sound (the dungeon slice is the risky one and comes third, after the systems it needs). What could be cut without the owner noticing: the second tanner's bench, the `talk:` counters beyond the quest stages that read them, and the diary perks (embers alone). Nothing is built for co-op beyond keeping rules pure and content in tables; section 8 is documentation.
- **Plan.** Tests precede implementation in every pair; tiers fit the owner's table; parallel lanes share no file; R0 re-checks the premises. The fixes above add the missing declarations and allowlist entries.
- **Names.** The cast (Bran Tolley, Odalys Venn, Pell Greaves, Tamsin Reeve, Qadir Salt-Hand, Hesper Moth, Corin Ashby), places (Saltfang Warren, the Underkiln), bosses (Marrowjaw the Tollmaster, Matron Saltfang, the Kiln Warden) and quests match no specific character, place or quest of another game that I know of. Generic words (Coal, Steel, Crafting, Ashfall, Warden) are shared, which the owner allows. A web search per name (O-6.2) is still owed.

## 5. Owner decisions (real trade-offs first)

These are the design's section 15, narrowed to what still needs an answer, with three added by this critique.

1. **Bows need better arrows (CALL-6.8).** Takes something away from existing rangers who hold bronze arrows; costs a buyer about a quarter of each kill, a smith almost nothing. Recommendation: do it, last, as designed.
2. **Ranged stays the strongest style (CALL-6.7, new detail).** After this stage magic pays a real price (most of what a kill drops), but a ranger who makes his own arrows pays what he pays today and still kills about 1.8 times as fast as melee. Options: accept; make arrow-making cost more (fewer arrows per bar); or a separate rebalance stage. Recommendation: accept now, and look again after the ammunition slice is played.
3. **No lockout on dungeons (CALL-6.5).** A run pays about half of fighting in the open, so it cannot be farmed for coin; its point is the material. Recommendation: as proposed.
4. **Everything attacks inside a dungeon (CALL-6.18).** Recommendation: as proposed.
5. **Diary peace includes the pass's sentries once the volcanic middle tier is done (CALL-6.6).** That tier can only be finished after crossing the pass and killing 25 of the sentries' kind, so it frees return trips, not the first one. Recommendation: as proposed.
6. **Crafting and binding make drops worth more (new).** Making a monster's hide into armour, or its bones into runes, can add a third to half to what that monster pays. Options: accept (it is what the skills are for, and each step is capped); or lower the material drop chances. Recommendation: accept.
7. **How many Underkiln clears for dragon gear (new).** Today: one clear gives enough Kilnglass for the whole kit. Options: keep one; or cut the first-clear shards from 8 to 2, which makes it two or three clears. Recommendation: cut to 2 if the owner wants dragon gear to feel earned; otherwise keep.
8. **Matron Saltfang's fight (new).** It is "dodge the circle", faster: the same lesson as the first boss. Options: accept; or give it a second kind of attack (needs a small new rule). Recommendation: accept for this stage and revisit with the models pass.
9. **Two systems close to one other game (new).** Runebinding works much like that game's rune-making skill, and the diary like its regional achievement lists. Options: keep (techniques, which the owner allows); or change their shape (for example, runes from drops instead of mined stones). Recommendation: keep, but the owner should say so.
10. **The rest, unchanged (CALL-6.1 to 6.4, 6.9 to 6.17):** recommendation as the design.

## 6. Applied in this commit

Design: P6 to P8 premises and 6.4, 7.6, 10 (zones at x 1000, dome and apron hidden, the walk test in `stepMonster`, per-instance no-respawn, zone nodes, camp id prefix); 7.2 (commit the copy; the string scan); 7.4 (vambraces, the honest price); 7.5 (Adept coins); 7.6 income figures; 7.8 (ember guards); 7.9 (`keepCorrupt` on every exit, L3); 9 (L7); 11.3 (every declared replacement); 15 (decisions); 16 and 17. Plan: rule 0.3.3, R0, F3, F4, D1, D3, D4, Q2, Q3, Q4, Q5, Z1, Z2, Z3, Z6, Z7, K1, N1, U0, the slice gates. Model: `content.ts` (Adept coins, zone origins, recipe name), `model.ts` (the far-plane check against Stage 5, the level filter, goods on both sides), regenerated outputs; `critique-check.ts` added.

---

## Second pass (2026-11-14): the revision for the owner's answers

Scope: only what commit `b8bc225` changed (`git diff 9bafd46 b8bc225`), plus the owner note of `7533e55`, checked against the code on `origin/main` (`db15263`, Stages 1 to 3 merged), Stage 4's approved design on `origin/feat/combat-weight`, and the owner's four answers. Every claim was treated as wrong until the code or a run said otherwise.

**Verdict: READY-WITH-FIXES.** Every number the revision reports was reproduced. The fixes below are applied in this commit. One new owner decision is a real trade-off and blocks plan task G2 until it is answered (CALL-6.29, the high trees).

### What was run

- `run.sh`, `pacing-rerun.sh`, `critique-check.sh` under the 1 GB cap: each reproduces its committed output byte for byte (the pacing header now names `origin/main`, where Stage 3's files are identical to the branch the revision read).
- `second-pass.sh` (new, `second-pass-results.txt`): reads `origin/main` itself, checks its own transcription of the attack formula against `playerAttackProfile` before using it, and patches the rule of `aggro.ts` into a copy of main's `stepMonster`.
- A pacing run of the new rule without the `keepsSight` filter (a copy of `pacing-rerun.sh`): every number of every table identical.
- `content.ts`'s Stage 3 overlay diffed against `main` (drop cuts, bars in recipes, bow logs, smelting levels, the markup): it matches. Stage 4's model is unchanged since `732cb8c`.

### Confirmed

- **The radius function** (`aggro.ts`): full at or below the monster's level, linear to 3 at 10 levels above, `keepsSight` exempt; `aggro-results.txt` 1 and 2 match the formula.
- **The declared replacement 8 is exact and is the only one.** `tests/monster-territory.test.ts` 259-273 is the one test that plays a hero above the monster; every other `stepMonster` call in it, and in `monster-ai.test.ts`, defaults to combat 1 (at or below every monster used). `gate-simulation.test.ts` plays combat 3 and 10 against level-68 sentries that keep their sight; `stage2-review-fixes.test.ts` tests the grace; `world-data.test.ts` counts camps; `phase2.test.ts` pins the label colour. The replacement's 50 steps at 3.5 are safe: a new monster's first wander is 2.5 s away (`createMonsterLogic`), the steps cover 1 s.
- **Gate rerun**: identical blow for blow for both test heroes. **Pacing rerun**: reproduced; mithril 540 to 724 kills (34% later, "a third"), dragon 3.6%; every assertion holds at gaps 5, 10 and 20.
- **Style table**: recomputed independently from `main`; every decade row of design 7.12 matches to two decimals; max hits 25/41/67 to 14/26/44 and 32/49/83 to 16/24/41 match.
- **The six replaced Stage 3 values** (`combat-profile.test.ts` 58-72, `entry-staff.test.ts` 45-49): 4, 5, 5, 8, 6 and 3 by hand from the new formula; accuracies unchanged.
- **Boss rows**: every bound holds with both formulas; the thinnest is the Kiln Warden's ranged row, 87.3% with bronze bolts (89.1% with rune bolts, which U2 uses). Stage 4's B3 calls Stage 3's attack functions, so its test numbers move with S2; they hold (`check-results.txt`, Ashmantle block).
- **Drops**: Rune Crossbow 20 clears on average (14 half, 45 nine in ten); robes 25 (17, 57), both 37; Kilnglass 2.2 a clear, kit 6.4 (6, 8, worst 13), scimitar 2.3. Income ratios 0.57 and 0.50 with first-clear rewards gone.
- **Quest pays once**: the data split (`reward` on a story quest, `loot` on a dungeon) is sound; reload and re-entry cannot re-pay.

### Findings

| # | Severity | Finding | Fixed |
|---|---|---|---|
| S1 | **High** | **The high trees.** "A level-70 woodcutter will be attacked from time to time" is far too mild. Measured on main's `stepMonster` with the rule, the gatherer standing where the engine stops it (3 from the tree): attacked within 5 minutes in 59 to 100% of runs, median 0 to 12 s once attacked, from 6 to 8 of 8 sides of every tree. A gatherer keeps gathering when hit and does not fight back (only death or depletion end a gather on main; Stage 4's auto-retaliation skips gatherers by design), so a player away from the keys can die there. The stated lever (a smaller wander) reduces it and does not remove it: with wander 0, 1 to 3 sides of every tree are still within reach. | **Not fixed: owner decision CALL-6.29.** Documented (7.13, R20, 16); G2 waits for the answer; 0.5 names the task for each answer. |
| S2 | **High** | **The last arrow of a grade is shot at the wrong power.** `performPlayerAttack` removes the swing's cost before calling `playerAttackProfile` (`actions.ts` 97-98), so a profile that reads the best carried arrow shoots the last mithril arrow as bronze. S4's allowlist had no `actions.ts`; no test could see it. | Yes: `prepareAttack` returns the power, the engine passes it, S4 gains `actions.ts`, S3 gains the last-arrow case, R0 4c checks the order on Stage 4's code. |
| S3 | **High** | **The band claim "from level 20 to 70" is false at level 28** (fastest 1.43 times the slowest; 1.48 with every slot filled, at 28 and 29): ice burst opens two levels before the next staff and sword. The decade-only test would never see it. 80 to 99 hold (at most 1.22). | **Documented, owner decision** (CALL-6.24): 7.12 and G6.13 say it, S1 asserts the decades plus a 1.45 ceiling at every level. |
| S4 | Medium | **What existing archers and casters lose was understated**: Hitpoints experience (1.5 a point of damage in every style), coins per hour from fighting (34 to 50% fewer kills an hour), more time under attack per kill, blood barrage healing halved, ranged experience down 44% at level 20 (the table said 33 to 39%), levels 1 and 10 slower than melee and dearer than the kill. | Yes: 7.12 and CALL-6.24. |
| S5 | Medium | **No owner step between the numbers on paper and the code that takes damage from existing players.** G-6.6 allowed the design's table to be "updated to the real kits" silently. | Yes: O-6.6 before S1; G-6.6 stops and shows the owner if the table differs. |
| S6 | Medium | **S2's Accept contradicts the standard gate**: "style-balance except the arrow cases" leaves a red test after the implementing task, which rule 0.3.4 forbids. | Yes: S1 plays bronze (inside the band at every level), S3 asserts the band with the arrow of the level. |
| S7 | Medium | **The ammunition kind had no home.** 7.11 put an `ammoPower` field on five item rows, 14.2 on seven, and nothing said how a bolt is told from an arrow. | Yes: one `AMMO_GRADES` table (`of`, `power`) in `items.ts`; no item row gains a field; the bronze rows are pinned unchanged by S3. |
| S8 | Medium | **D1 exempts boss tables "held by the dungeon income bound"; Marrowjaw is not in a dungeon** and its goods are about equal to its coins. Nothing bounded it. | Yes: D3 asserts its income per second over the 180 s return against open ground (about 9 GP/s against 79). |
| S9 | Medium | **G1's "the count of aggressive camps is unchanged"** would fail at D4, which adds three aggressive camps, needing an undeclared edit to a test this stage wrote. | Yes: the passive camps are named by id. |
| S10 | Medium | **Y5's allowlist cannot build the shrine's menu** (`input.ts` builds it, `loop.ts` dispatches it; a shrine has one action today), and no pure function owned the "deposit only" refusal. | Yes: `shrineTransfer` in Y2 and Y1's cases; Y5 gains the two files; 7.8 says what the engine needs (no saved field; the bank's rules unchanged). |
| S11 | Medium | **The pacing headline used one route.** With bounties and drops mithril comes 49% later and adamant 52% later in kills; in the model's minutes 8% (A1) and 18 to 20% (A3). | Yes: 7.13, 16, CALL-6.27. |
| S12 | Low | **Declared replacement 9's second expression is not needed**: without the `keepsSight` filter every pacing number is identical. One less edit to a frozen file. | Yes: replacement 9 is one expression and one import; `pacing-rerun.sh` applies the filter only in its information block. |
| S13 | Low | **`packAttackers` is a convention of the test model, not a game rule**, and was to be exported from `src/state/monsterAi.ts`. | Yes: `tests/support/packAttackers.ts` (G1). |
| S14 | Low | **The certain Kilnglass was framed as protection against bad luck** ("bad luck is bounded", "the bound on bad luck"), and CALL-6.25 still offered a counter, which the owner has ruled out. | Yes: reframed as base loot (it also keeps chapter 6's shard step from waiting on luck); the counter option deleted; pure chance with the same mean computed and offered. |
| S15 | Low | **The quest-once proof named an untestable clause** ("no reward reachable by a path that does not end in `finish`"). | Yes: replaced by the three concrete tests; the re-earn paths (reload, re-entry, reset, an older build) listed. |
| S16 | Low | **Stale references**: `9ccbdae`, `fc5fe84`, "reads Stage 3's branch". | Yes: `origin/main`. |

Also checked and not a finding: **chain-pulling**. A hero ten or more levels above a camp is never pulled into it at once. Standing still 2 units from the member it fights for a full minute it is joined by one other member in 0 to 69% of fights, never two; standing near the camp's centre, by about one more a minute (`second-pass-results.txt` B). **"About strike range"** is exact for melee monsters (2.9) and a stated reading for archers and casters, whose reach is 11 (7.13, part of CALL-6.27). **Equipment in chests**: Stage 3's gear-drop test reads monster tables only, so it passes unedited but does not cover chests; Z3 holds the 0.05 cap; the 2.5 rule concerns recipes and is untouched.

### Where these numbers disagree with the revision

- The band: at most 1.31 at the decades (agreed), but 1.43 at level 28 (the revision said "from level 20 to 70").
- Ranged experience per hour: down 33 to 44% with the arrow of the level, not 33 to 39%.
- The high trees: attacked in 59 to 100% of 5-minute runs, usually within seconds, not "from time to time"; the smaller-wander lever reduces it and does not remove it.
- Pacing: the A3 route moves more than A1 in kills (49% against 34% for mithril), and both move much less in minutes.
- Special sets at 80 and 90: 0.90 to 0.94 (ranged) and 0.86 to 0.87 (magic) against the dragon, where the revision used the demon (0.89 to 0.93, 0.84 to 0.85). Same conclusion; not a disagreement.

### Is slice 6 placed where it does least harm?

Yes. It cannot go earlier without shipping a slice that only takes from archers and casters (the made armour of slice 4 and the bound runes of slice 5 are what soften it), and it must come before the Underkiln so the hardest boss is tuned once on the final numbers. Every fight bound holds on both formulas, so nothing written before it is edited after it. The one thing the placement did not have was an owner step at the point where the code starts taking damage from existing players; O-6.6 is that step.

### Open owner decisions after this pass (real trade-offs first)

1. **CALL-6.29, the high trees (new).** A strong woodcutter is now attacked at every yew and magic tree, usually within seconds, and, because a gathering hero neither stops nor hits back, can die if the player walks away. Choose: (a) accept; (b) a hit stops the chopping so the hero's automatic fight-back (Stage 4) answers it; (c) move the guardians away from the trees (keeping them still at home is not enough). **Recommendation: (b)**: it keeps "aggressive monsters attack" and removes the one nasty surprise.
2. **CALL-6.24, the rebalance numbers, with one exception.** Archers and casters lose a third to half of their damage, their training speed, their coin per hour from fighting, and half of blood barrage's healing; at level 28 magic is 1.43 times melee, just over the 1.4 target. **Recommendation: approve, accept the level-28 exception**, and look at the final table once more before it is built (O-6.6).
3. **CALL-6.27, how fast sight shrinks.** At 10 levels, the middle of the game is slower by Stage 3's model: mithril gear 34 to 49% more kills, 8 to 18% more time. **Recommendation: 10.**
4. **CALL-6.25, Kilnglass.** Keep one certain shard per clear (the kit in 6 or 7 clears, never more than 13), or make it all chance with the same average (18% of clears give none; 9 clears for nine players in ten, no limit). **Recommendation: keep the certain shard**: it is ordinary loot, not a luck counter, and the story's last Kilnglass step never waits on luck.
5. **CALL-6.28, which arrow is shot (new).** The best one carried, always (bank rune arrows to save them), or a quiver the player fills (a new saved slot). **Recommendation: best first, with a log line when a better grade starts being used.**
6. **CALL-6.26, the diary's middle reward.** **Recommendation: the deposit box.**
7. The rest as the design's 15.2 (CALL-6.22, 6.21, 6.4, 6.3, 6.2, 6.10 to 6.17, 6.9, 6.1).

### Applied in this commit

Design: owner note kept; 7.3 (the proof, the re-earn paths), 7.4 (`AMMO_GRADES`, the arrow's power from `prepareAttack`, saving rune arrows), 7.6 (base loot, not protection; who holds the chest cap), 7.8 (what the deposit box needs), 7.11, 7.12 (every level, 80 to 99, the losses, where it lands and who approves it there), 7.13 (the high trees measured, chain-pulling, strike range, pacing in kills and minutes, replacement 9 cut, `packAttackers` placed), 11.3 item 9, 13.3 R20 and R21, 14.2, 15.2 (CALL-6.24, 6.25, 6.27 rewritten; 6.28 and 6.29 added; real trade-offs first), 16, 17, review log. Plan: 0.2 PACE, 0.3.3, 0.5 (CALL-6.25, 6.28, 6.29, O-6.6), R0 4c, G1, G2, H-0, D1, D3, O-6.6, S1 to S4, G-6.6, U0, Y1, Y2, Y5, final verification step 2, 4.3, section 5, review log. Models: `pacing-rerun.sh` (reads `origin/main`; the filter only in block 2) and its results header; `run.sh` comment; new `second-pass.sh`, `second-pass-check.ts`, `second-pass-results.txt`.
