# Combat with weight: critique

Date: 2026-11-14. Subject: `2026-11-14-combat-weight-design.md` and `../plans/2026-11-14-combat-weight-plan.md` as committed in `4559e03` on `feat/combat-weight` (cut from `54736ba`). Stage 2's later commits on `feat/world-place` (to `78e4564`) were read with `git diff` where they touch what this stage changes. Stage 3's and Stage 5's approved designs were read in their worktrees (`../osrs-like-wp/S3`, `../osrs-like-wp/V5`).

Method: every premise checked against the code by file and line; the committed model rerun; an independent positional check of the boss fight written from scratch (`docs/superpowers/research/combat-model/check.ts`); leash circles, lair candidates and frozen tests measured or read directly. No test suite, type check, build or dev server was run.

## Verdict: READY-WITH-FIXES

The design is careful and most of it holds: the conservation rule for ordinary monsters is right, the timing rule is a good idea, the route rules reuse Stage 2's code, and every premise about today's combat code is accurate. It was not ready as written: four frozen tests would have had to change without being declared, one new name breaks the design's own deny-list rule, and the boss's central proof (who wins and who loses) is an artifact of a position-free model. Every finding below rated critical or high has been fixed in the two documents, except the boss numbers themselves, which are B3's to re-tune against a better model; the documents now say so and give B3 that model. Three new owner decisions were added (CALL-4.14 to CALL-4.16).

## Premises

| # | Design's claim | Evidence | Holds? |
|---|---|---|---|
| P1 | The hero acts every 0.6 s | `context.ts` 9 (`TICK_SEC`); `loop.ts` 224-231 | Yes |
| P2 | Monsters attack at once, then every 1.65 s | `monsterAi.ts` 54, 208-213 (cooldown starts at 0) | Yes |
| P3 | A monster blow is rolled and applied in one call; nothing answers it | `actions.ts` 310-359; ranged and magic blows land on projectile impact, a delay, not an answer | Yes |
| P4 | Hit roll and mitigation | `combat.ts` 110-119, 211-243; `actions.ts` 179-182 | Yes |
| P5 | Protect from Magic also cuts dragonfire | `adventure.ts` 359 | Yes |
| P6 | Food is instant with no cooldown | `playerActions.ts` 153-162 | Yes |
| P7 | 0.25 HP/s regeneration, also in a fight | `loop.ts` 114-116 | Yes |
| P8 | The altar heals fully for free | `loop.ts` 216-223 | Yes |
| P9 | Dying costs nothing | `adventure.ts` 230-242. Missed: the notice says "You keep your gear and coins" (233), which a fee makes false | Yes, incomplete |
| P10 | The dragon: 260 HP, dragonfire on every third attack, back in 8.35 s | `catalog.ts` 475; `combat.ts` 226 with the increment at `actions.ts` 312; `monsterAi.ts` 55-56 | Yes. Missed: the boss's basics keep rolling dice dragonfire unless the engine stops it |
| P11 | The special-attack spin depends on frame rate | `loop.ts` 511-513 (`rotation.y +=` per frame) | Yes |
| P12 | Monsters walk straight; `return` snaps home on a stall | `monsterAi.ts` 154-169, 200-204 | Yes |
| P13 | Frame order; step capped at 0.08 s | `loop.ts` 784-810, 786 | Yes. Missed: an attacking monster is turned toward the hero every frame (649-653), which would contradict a locked cone or lane |
| P14 | Audio: one `tone`, `setTimeout` sequences, no master, empty `catch`, blind `resume`, mute checked in `tone` | `audio.ts` 26-87 | Yes |
| P15 | `flashTimer` is set and never read | set `actions.ts` 200, declared `context.ts` 122, no reader | Yes |
| P16 | The hero's acceleration costs about 90 ms | `loop.ts` 312: rate 16 is a 62.5 ms lag; 90 is conservative | Yes |
| P17 | Graphics tiers come with Stage 5 | They already exist: `renderer.ts` 12-13 (`performance`, `balanced`, `high`, `ultra`) | Better than assumed |
| P18 | A path search costs 0.5 to 0.7 ms today | `results.txt` 0.924; reruns 0.458, 0.552 | Roughly; range is 0.46 to 0.92 |
| P19 | `shouldRepath` compares the target with "the path's goal" | `pathfind.ts` 309-316 with `loop.ts` 238-243: the hero stores the target's position at planning (`madeAt`), not the goal cell | Ambiguous; fixed (M1) |
| P20 | Frozen tests that pin monsters: `world-data` "if" it pins the count | `tests/world-data.test.ts` 162 pins 36; `tests/world-budget.test.ts` 41 (on `feat/world-place`) pins 36; `src/__tests__/blender-hero.test.ts` 133-157 pins 10 species with a `Monster_<typeKey>` node each | No (C-1) |
| P21 | No new name contains a deny-listed token | `tests/names.test.ts` 13 lists `archer` | No for "Thornwatch Archer" (H-10) |
| P22 | The gate simulation is untouched | `tests/gate-simulation.test.ts` drives `stepMonster` with no grid and counts only `attack` events; each sentry gets one blow, a basic | Yes |
| P23 | Moving the lair to about (-106, 106) clears Slagfall Terrace | Clears its camp circle; its leash circle still reaches 8.3 units into arena + 6 (measured) | No (H-7) |
| P24 | Stage 2's review helpers `entityAim`, `walkSpent`, `stallTime`, `escapeStall` | Present on `feat/world-place` (`2b5086a`) | Yes; the design should reuse `escapeStall` for monsters (M-4) |

## Numbers: the author's and the critique's

| Quantity | Design (first draft) | Recomputed | Note |
|---|---|---|---|
| Rootquake escape and minimum | 3.80 u, 1,280 ms | 4.80 u, 1,367 ms | A hero can stand against the monster; the draft assumed 1 unit away. Wind-up raised to 1,700 |
| Tail Sweep escape and minimum | 4.30 u, 1,324 ms | 5.30 u, 1,411 ms, margin 289 | Same cause; still passes |
| Margins with a trackpad (+300 ms) | not computed | Overhead Slam 63, Rootquake 33 (at 1,700), Cinder Fall 7, Tail Sweep -11 ms | 1.6 s is a mouse figure |
| Conservation, ordinary monsters | within 3.5% | confirmed (same rows) | "Hit as hard as today on average" holds; slightly less in short fights, since a cancelled wind-up deals nothing |
| Search cost today | 0.5 to 0.7 ms | 0.46 to 0.92 ms, about 1.1 MB of garbage per search | The scratch-array change is required |
| Sentry contact time | about 0.5 s | under 1 s | Still one blow per sentry |
| Boss, fighter A wins | 93% | model rerun 93.0%; positional 99.5% | |
| B (never moves) | 0%, dead at 26 s | 0% / 0.1%, dead at 26 / 39 s | 90% of B's deaths are one blow from 70% health or more |
| C (+300 ms) | 80% | 72.8% (corrected escape) / 98.0% | |
| D (no food) | 75% | 71.3% / 96.8% | Food matters less than claimed |
| F (level 50, rune, no ward or prayer, attentive) | 6.5% | 5.8% / **41.5%** | Threshold is 15%. At 1,500 HP the positional F still wins 24.9% |
| G (F, never moves) | 0% | 0% / 0% | |
| A's mean fight | 110 s | 111 / 79 s | |
| Any boss heavy capped at 45% of max HP | not considered | A 100%, **B 100%** | The mark's one-shots are what make standing still lose |
| Dragon kills, how much rarer | about 10x | 7x to 13x | 7x when a reload skips the 120 s |
| Blocked cells inside leash circles today | not computed | Three Kettle 219, Dune Nest West 102, pass sentries 653, every other camp 0 | Routes change little before Stage 5's trunks |
| Lair candidates (arena 12 + 6 against leash circles and safe zones) | (-106, 106) | (-106, 106): leash gap -8.3. (-106, 66): leash gap 8.6, safe-zone gap 4.1, 0 closed cells | Not checked against nodes or paths |

The positional check gives the hero a position 2.9 from the dragon and tests each shape where the hero actually is. That matters most for Ashen Nova (a melee hero at reach is already inside the safe disc of radius 4, where the model charged a 9.8-unit run) and Ember Cone (a 1.8-unit sidestep at reach, not 4.45). It also charges what the model leaves out: the hero swings until it reacts, then must click the boss again and walk back. Both scripts are under `docs/superpowers/research/combat-model/` and `run.sh` runs both.

## Findings

Status: **fixed** means the design and plan now carry the fix; **owner** means it became a numbered decision.

### Critical

**C-1. Four frozen tests must change; the plan declared one and a half.** Adding two monster types and five members breaks `tests/world-data.test.ts` 162 (`memberCount()` is 36), `tests/world-budget.test.ts` 41 on `feat/world-place` ("CAMPS hold 36 monsters") and `src/__tests__/blender-hero.test.ts` 133-157 (exactly 10 species, `Monster_<typeKey>` found for each). The plan declared only Stage 3's `content-freeze` and an "if" for `world-data`. As written, G-7 item 1 fails or an implementer edits frozen tests without leave. Also M2 made `modelKey` a field of `MonsterEntityLike`, which the frozen test constructs without it, and `findPivot` takes the type key (`blenderMonsters.ts` 151-157), which a reused model breaks. Fix: design 9.3 lists the four replacements with lines and the intent each keeps; plan rule 0.3.3, M3 and G-7 name them; M2 makes `modelKey` optional with the type key as default and finds pivots by it. **Fixed.**

### High

**H-1. The boss's proof is a model artifact.** The design's table (A 93%, F 6.5%) comes from a model with no positions. A positional check gives F, the attentive but unprepared hero, 41.5% against a threshold of 15%, so "preparation and attention are both required" holds for attention only. B3 ports the model "calling `inShape`", which forces positions in and will surface this late. Fix: the design shows both tables and says which claim survives; B3 ports the positional check, adds a ranged and a magic fighter (the nova and the sweep treat them oppositely), and names the lever (the share of damage that prayer and the ward cut, not hitpoints). The re-tune itself stays with B3. **Fixed in the documents; numbers left to B3.**

**H-2. The boss's basic attack still rolls dice dragonfire.** `performMonsterRetaliation` increments `breathCount` (`actions.ts` 312) and `rollMonsterHit` makes every third blow dragonfire (`combat.ts` 226); the design keeps both and never says how the boss's basics avoid it. The model assumes they do. Fix: for a `BOSSES` type the engine calls `rollMonsterHit` with `breathCount` 1 and does not increment it (0 would be dragonfire); B4 owns it, `monster-hit` stays frozen. **Fixed.**

**H-3. The death fee makes the death notice lie, and the plan forbade fixing it.** The notice says "You keep your gear and coins" (`adventure.ts` 233); S2 listed `deathNotice` under "must not change". Fix: `deathNotice(paid = 0)`, unchanged at 0, still matching `/Lumbridge/`; `adventure.ts` joins cluster S. **Fixed.**

**H-4. "Camps do not strike together" was not guaranteed.** A start index from home coordinates has three values for up to seven members, and members reach the hero at different times, so slots are not aligned. In a camp of four hill giants shapes overlap, and the reaction rule, stated for one shape, no longer bounds anything. Fix: a camp wind-up gate (one shape per camp, the next at least 1.65 s after the previous resolves; a blocked heavy becomes a basic and waits). Expected damage is unchanged. **Fixed.**

**H-5. Auto-retaliation can walk the hero back into a shape.** A hero that has just stepped out stands idle; the next basic from another monster makes it target and walk to that monster, through the shape it left. That breaks "nothing takes control" and turns dodges into hits. Fix: no auto-retaliation while a wind-up on the hero is live. **Fixed.**

**H-6. The outline would be one pixel wide.** T5 draws the outline as a line loop. WebGL draws lines one pixel wide whatever `linewidth` says, which is unreadable at range and on the Low tier. Fix: a triangle band about 0.15 wide; also no fog (shapes are read up to 25 units away), a polygon offset, vertex spacing no wider than the terrain's, and never a click target. **Fixed.**

**H-7. The moved lair still lets the Slagfall demons into the boss fight.** B3 checked camp circles; members chase to the leash circle (radius + 4). At (-106, 106) Slagfall's leash circle reaches 8.3 units into arena + 6. Fix: the criterion is arena + 6 against every leash circle and every safe zone; (-106, 66) passes both distance checks. **Fixed.**

**H-8. A ranged hero cannot run into the nova's safe disc with one click.** `handleWorldClick` takes any monster on the ray before the ground (`input.ts` 381-383). Clicking near the dragon targets it; a ranged hero is already within 13.5 and does not move. Fix: a click on the current target while already in reach is a ground click (W1). **Fixed.**

**H-9. The pre-scheduled wind-up sound cannot land on the hit.** Below 12.5 FPS the step cap slows rules time against the audio clock (a thump scheduled 1.6 s ahead lands up to a second early at 8 FPS), and wireless headphones add 100 to 300 ms. The G-8 throttle check would fail. Fix: the wind-up plan is the rise only; the impact plays on the `resolve` event. **Fixed.**

**H-10. "Thornwatch Archer" breaks the design's own name rule.** `archer` is on the deny-list (`tests/names.test.ts` 13), so `names-combat` fails. Fix: "Thornwatch Marksman", key `thornwatch_marksman`. **Fixed.**

### Medium

**M-1. Re-path goal.** Comparing the target with the goal cell (2.9 to 11 units away by construction) re-paths every check. Fix: store the target's position at planning, as the hero's `madeAt` does. **Fixed.**

**M-2. Quota starvation.** With a quota of 2 and a fixed loop order, monsters at the end of the list are refused every frame at 30 FPS, stall and give up. Fix: the loop starts one place further round each frame; a test. **Fixed.**

**M-3. A second segment test that disagrees with movement.** `gridSegmentOpen` (cell centres every 0.5) differs from the continuous step on shorelines and bridge edges, and duplicates `segmentWalkable`. Fix: export and reuse `segmentWalkable`. **Fixed.**

**M-4. Monsters stuck on route corners.** Stage 2 found that a smoothed leg can clip a corner and stall the hero, and added `escapeStall`. Monsters would give up the chase after 1.5 s instead. Fix: reuse `escapeStall` at `STALL_SEC`. **Fixed.**

**M-5. Allowlist gaps.** Monsters using `grid.walkable` need `moveWithCollision` to take a walk test (`collision.ts`, not in P4); the stable `id` set at spawn needs `spawns.ts`, which belongs to side cluster M until the merge (not in T5). Fix: P4 gains `collision.ts`; the `id` moves to W1. **Fixed.**

**M-6. Cancel on every exit.** The design cancelled a wind-up on death, leash and phase shift only; target down, beyond 26 and safe also send a monster home. **Fixed.**

**M-7. The monster turns while its shape stays.** `loop.ts` 649-653 turns an attacking monster toward the hero every frame, so a locked cone or lane would no longer match the body. Fix: face the locked direction during a wind-up. **Fixed.**

**M-8. Mark semantics and the "no one-shot" claim.** The design said each mark raises "the next" heavy; the model raises every heavy while marks last, on one shared timer. The technique table claimed no single hit is a one-shot; with one mark a missed nova kills a 70-HP hero from full a quarter of the time, and one-shots are what make fighter B lose (capping them makes B win every fight). Fix: semantics stated as modelled; claim corrected; the choice put to the owner. **Fixed; owner (CALL-4.14).**

**M-9. Boss resets.** Unspecified: whether a reset restores phase I, and that a boss pinned at its arena edge in `chase` would trip the 1.5 s stall test and heal. Fix: reset and respawn restore phase I; no leash and no stall for a boss. **Fixed.**

**M-10. Escape distance of self-centred circles; Scorch Lane in the pass.** See the numbers. In the 5-wide Cinderstep Pass a 3-wide lane along the corridor leaves 0.7-unit strips to click. Fix: full radius in the formula, Rootquake 1,700 ms (also covering a trunk detour in the woods), Scorch Lane 2.4 wide. **Fixed.**

**M-11. Trackpad and touch.** The 700 ms human figure is a mouse figure; on a trackpad four rows lose their margin. Fix: stated in 6.3; trackpad run in G-8. **Fixed; owner (CALL-4.16).**

**M-12. Mute and autoplay.** Mute would not stop voices already scheduled (a rise lasts up to 2.4 s); creating the context before a gesture logs a warning in Chrome; a one-shot resume listener goes deaf after Safari interrupts the context. Fix: master-gain ramp on mute; create on a gesture; listener armed until running. **Fixed.**

**M-13. Flash rate.** One flash per 250 ms on a body allows four a second; the common guideline is three. Fix: 350 ms. **Fixed.**

**M-14. The command layer was half decoration.** `validateCommand` was pure but applying stayed in the engine for all seven commands, so nothing a second player needs was reusable, and prayer checks live in `playerActions.ts`, not `combat.ts` as S2 assumed. The owner asked for commands, so it stays, slimmer: a pure `applyCommand` does check and effect for the five state commands; `move` and `attack` stay engine. **Fixed.**

**M-15. A human check that cannot happen.** "Lure a moss guardian around the ridge end and the castle": guardians leash 13 units from camps over 40 away from both. Fix: checks where obstacles exist inside leash circles today (Dune Nest West by the river, the pass sentries, the bridge goblins) and in the woods after Stage 5. **Fixed.**

### Low

- **L-1. Duplicated or unread data.** `BossDef.hp` duplicated the monster row; `prayerHint` and `AttackDef.cue` had no reader of their own. Cut; the cue is derived from style. **Fixed.**
- **L-2. `ROSTER_SLOTS` in code.** A constant nothing in the game reads, plus a test holding it in step with itself. The slots stay as a table in the design and the README; preparedness is the data shape. Cut. **Fixed.**
- **L-3. `openStart` returned the cell centre for an open cell**, unlike `pathStart`, which keeps the point. **Fixed.**
- **L-4. Grid-only rules.** `returnLeft` and the wander re-draw now say they apply only with a grid, which the step-for-step golden needs. **Fixed.**
- **L-5. Perf wording.** "No allocation after the first search" holds for the grid arrays only; "at most 6 meshes" replaced by one shape per camp plus the boss. **Fixed.**
- **L-6. Reload.** The section 8 sentence on reloading did not parse; now states both reload cases. **Fixed.**
- **L-7. Model label** said a cap of 4,000; the design says 6,000. **Fixed in `model.ts`.**
- **L-8. Thornwatch stats** were called interpolated; hitpoints and defence are deliberately lower. Stated. **Fixed.**
- **L-9. Stage 5.** A camp "at the woods edge" would add a clearing to Stage 5's tree table; the marksmen go outside the `woods` region. **Fixed.**
- **L-10. Dragon name.** "Elvarg" is a RuneScape character and the new phase banners and boss bar would print it. **Owner (CALL-4.15).**
- **L-11. Respawn 120 s** adds little given a reload skips it (7x instead of 13x rarer). Kept; stated.
- **L-12. Order.** T1 waits for P4 though it touches no lane P file; parallel would be faster. Left serial for simplicity.

## Checked and found sound

- Conservation of expected damage for ordinary monsters, including with the camp gate (a basic is one roll per slot, as a heavy is).
- The gate simulation, `monster-ai`, `monster-territory` and `stage2-review-fixes` need no edit: patterns are opt-in, goblins have none, every pattern starts with a basic, routes and gates exist only when the engine passes a grid and a gate.
- The arena leaves no safe shooting spot: the magic boss reaches 23 units from its lair; the 5-second count starts at 18.
- Phase III slot arithmetic (2,640 ms slots; Cinder Fall kept at 1,650 by the 150 ms rule).
- Saves: no new field; existing saves load.
- Tiers: every effect has a row and the telegraph is whole on Low.
- Stage 3 dependencies (names, `content-freeze`, `HP_REGEN_PER_SEC` in `loop.ts`) and Stage 5's (CALL-V15, QV9, `vfx.ts` untouched) match those designs.
- Plan structure: R0 first, tests before implementation, opus verify on every [AGY] task, tiers per the owner's rule, side clusters on files the spine does not touch (after M-5).

## Owner decisions after this critique

Real trade-offs first; the others are confirmations. Each is in design section 13.

1. **CALL-4.6, what dying costs.** Recommend the fee: 10% of carried coins, capped by level, banked coins safe.
2. **CALL-4.4, the dragon as a real boss.** Recommend accept; its numbers will be re-tuned in B3.
3. **CALL-4.5, no regeneration in fights and a food cooldown.** Recommend accept both.
4. **CALL-4.14, can a run of missed warnings kill from full health.** Recommend allow; a single miss never does.
5. **CALL-4.8, two new monsters from existing models.** Recommend ship two.
6. **CALL-4.15, rename the dragon.** Recommend rename its display name now.
7. **CALL-4.16, trackpad players.** Recommend leave the timings, test with a trackpad, and lengthen every warning by 15% if it fails.
8. **CALL-4.7, auto-retaliation** (now never during a warning). Recommend accept.
9. **CALL-4.3, no warned attacks in the start region.** Recommend accept.
10. CALL-4.1, 4.2, 4.9, 4.10, 4.11, 4.12, 4.13: confirmations; recommend accept.
