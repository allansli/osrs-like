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
