# Combat with weight: design

> **Approved by the owner on 2026-11-14**, design and plan, after the critique and the second-pass check. The owner answered each open decision of section 13:
> - CALL-4.18 (the boss's unwarned bolt): "ok" to the recommendation. The fight opens with a 2-second roar, a banner and the line that its bolts are magic; the bolt's damage stays.
> - CALL-4.17 (dying): "ok" to the recommendation. 3% of the current level's span from every fighting skill; (a) 10x characters keep the same rule; (b) a loss under a quarter of what the vow can guard costs nothing and leaves the vow; (c) a vow carried across levels is accepted; (d) a skill at 99 loses nothing.
> - CALL-4.9 (names): the owner said it is not a problem to share names with other games ("não tem problemas termos os mesmos nomes de outros games"). **The names stay as written**: Ashmantle the Slag Wyrm, phase III "Fury", Saltback Stalker and the rest. The renames the second pass recommended are NOT applied; where this note and section 13 differ, this note wins. `tests/names.test.ts` and its deny-list are unchanged.
> - CALL-4.19 (regeneration 0.25 in combat, 1.0 out): "ok".
> - CALL-4.14, 4.16, 4.7, 4.3, 4.2, 4.1, 4.10 to 4.13: "ok" as recommended.
> - The rule the second pass added (the boss takes no damage from a hero farther than arena radius + 6 from its home) was shown to the owner and not vetoed.
> Code starts after Stage 3 is merged; task R0 re-checks the premises first.

Date: 2026-11-14. Branch: `feat/combat-weight`, cut from `feat/world-place` at `54736ba`. All line numbers refer to that commit. Stage 2 is still receiving review fixes (`2b5086a` and `74f7ea4` were read with `git show`, not merged) and Stage 3 is not in this tree, so every task in the plan finds symbols by name.

Status: proposal, partly decided. On 2026-11-14 the owner answered four decisions: what dying costs (CALL-4.6), the dragon (CALL-4.4), regeneration (CALL-4.5) and the two new monsters (CALL-4.8). Three of the answers changed the design, and this revision applies them (section 13.1 quotes each; the review log lists what moved). Every other decision marked **CALL-4.n** is still the lead's proposal and needs the owner's check (section 13.2).

An independent critique (`2026-11-14-combat-weight-critique.md`, verdict READY-WITH-FIXES) was applied to this document on 2026-11-14. Its changes are listed in the review log at the end. The numbers in sections 6.3, 6.4 and 6.6 are from the models as they stand after the owner's decisions.

Inputs read for this document: `docs/superpowers/specs/2026-11-13-world-foundation-design.md` (called "the foundation design" below) and its plan; the approved Stage 3 design ("Start and pacing") and the approved Stage 5 design ("Visual pass"); `docs/audit/2026-11-13-findings.json` (finding 14); `docs/superpowers/baseline/stage2-review-findings.json` (13 confirmed findings); `src/state/combat.ts`, `monsterAi.ts`, `pathfind.ts`, `collision.ts`, `adventure.ts`; `src/engine/actions.ts`, `loop.ts`, `audio.ts`, `vfx.ts`, `monsterMeshes.ts`, `blenderMonsters.ts`, `spawns.ts`, `context.ts`, `renderer.ts`, `input.ts`; `src/ui/playerActions.ts`; `src/data/catalog.ts`, `world.ts`, `worldMap.ts`; `index.html` (the tab bar); the tests that pin combat (`monster-ai`, `monster-territory`, `monster-hit`, `gate-simulation`, `phase4-combat`, `stage2-review-fixes`).

This document covers one stage:

- **Stage 4: Combat with weight.** "Attacks with a visual warning, bosses with phases, reaction to hits, sound."

**Merge order this design assumes.** Stage 2, then Stage 3, then Stage 4, then Stage 5. Stage 3 moves the hit and drop arithmetic into `src/state` (`playerAttackProfile`, `playerHitChance`, `monsterHitChance`, `rollDrops`, `HP_REGEN_PER_SEC`, `creditGp`). Stage 4 builds on those names. Plan task R0 re-checks every premise after Stage 3 lands and before any code.

**How the numbers were produced.** Seeded scripts in `docs/superpowers/research/combat-model/`, all run by `run.sh`, each with its output committed beside it:

- `model.ts` (`results.txt`): the timing rule, ordinary monsters, the share of wind-ups cleared, path cost.
- `fight.ts`, printed by `check.ts` (`check-results.txt`): the boss fight with positions. It began as the critique's check, which gave the hero a position; it now also has regeneration, ranged and magic heroes and the boss as data (`boss.ts`, one table that `model.ts` reads too). The first draft's position-free boss model is cut.
- `decisions.ts` (`decisions-results.txt`): what a death costs and what the blessing costs, the Stage 2 gate with regeneration, and the new boss's arena.

They import the game's real tables and pure functions (`MONSTER_TYPES`, `CAMPS`, `ITEMS`, `OSRS_XP_TABLE`, `getEquipmentBonuses`, `rollMonsterHit`, `resolveDragonfire`, `combatLevel`, `stepMonster`, `buildWalkGrid`, `findPath`) through the repository's own esbuild. The player's attack arithmetic is transcribed by hand from `performPlayerAttack` (`actions.ts` 104-121, 179-182), for melee, ranged and magic, because that function is engine code. No test, type check, build or dev server was run. Section 15 lists what could not be verified.

---

## 1. Intent and why

A fight today is a damage race the player watches. The player clicks a monster once; both sides roll dice on a timer (the hero every 0.6 s, `context.ts` 9; the monster every 1.65 s, `monsterAi.ts` 54) until one side is empty. Nothing the monster does can be answered. Four facts make it weightless:

1. **No attack can be seen coming.** A monster's blow is rolled and applied in the same call (`performMonsterRetaliation`, `actions.ts` 310-359). The only answer is a prayer chosen before the fight.
2. **Staying alive is free.** Food is instant with no cooldown (`handleInventoryClick`, `playerActions.ts` 153-162), hitpoints regenerate at 15 per minute even in mid-fight (`loop.ts` 114-116), the altar heals for nothing (`loop.ts` 216-223) and dying costs nothing (`deathNotice`, `adventure.ts` 230-235). The Stage 3 design found this (its F9) and left it here.
3. **The boss is a bigger monster.** The dragon has 260 hitpoints. A hero in dragon gear deals 28 damage a second (model), so the fight lasts 9 seconds. Its one special, dragonfire, is a dice roll on every third attack (`combat.ts` 226). It is back 8.35 s after it dies. (The owner has since decided that this dragon stays as it is; the game has no boss fight with mechanics, and 6.4 adds one beside it.)
4. **A hit has no body.** Monsters flinch (`monsterMeshes.ts` 800-809) and the camera shakes a little (`actions.ts` 203-205). `flashTimer` is set and never read. The hero does not react at all. Sounds are single tones with no relation to time (`audio.ts` 66-85).

And one thing is owed: monsters walk in a straight line (`monsterAi.ts` 166-169, 200-204), which the owner has decided must end before Stage 5 plants about 150 blocking tree trunks.

### What a fight should feel like

The player's hands are a mouse. Every answer the game asks for must be **one click on a large target, with time to make it**: move out of a marked area, switch a prayer, eat, change target, change style. So the design is "read, then click", never "react in a tenth of a second":

- The monster's ordinary blows stay as they are: a dice roll, answered by gear, level and prayer.
- Every few blows, a monster with a pattern winds up a **heavy attack**: a shape appears on the ground and fills. Standing in it when it fills costs a blow worth two. One click moves the hero out, and the monster is then open for as long as its recovery lasts.
- A boss is a sequence of such shapes in three phases, each phase asking for a different answer, with a pause and a roar between them. The game gets one: a new dragon boss. The dragon that exists today stays exactly as it is (the owner's decision, 6.4).
- Every hit, given or taken, has a sound that lands on the hit, a flash, a lurch and a number, and none of them takes the mouse away.

### Essence to preserve (CALL-4.1)

The foundation design's list stands: skill progression on the existing XP curve; click-to-act; 28-slot backpack, bank, shops, forge; the faceted painted look; existing saves keep loading. Added for this stage: **no answer needs a key press or a held button; a mouse alone is enough**, and nothing ever takes control of the hero away from the player.

---

## 2. Constraints

| # | Constraint | Consequence |
|---|---|---|
| C1 | Click-to-act. The backpack and the prayer list are different tabs of one panel (`index.html` 178-184), so "switch a prayer" can be two clicks. | Wind-ups are budgeted for the slowest answer (section 6.3). No rule depends on an answer faster than 1.1 s. |
| C2 | The XP curve, drop tables, prices and bounties belong to Stage 3 (approved). | Ordinary monsters keep their expected damage against a player who does nothing (6.2). New monsters take their coin range from Stage 3's own curve and drop no equipment (6.8). The new boss drops no equipment and its reward table is marked Stage 3-tuned (6.4). Every dependency is listed in 6.10. |
| C3 | Existing tests are frozen (foundation plan 0.3 rule 3). They pin: first attack immediate, then every 1.65 s, for a goblin (`monster-ai.test.ts` 80, `monster-territory.test.ts` 403); `rollMonsterHit` draw order and dragonfire on `breathCount % 3` (`monster-hit.test.ts`); the death notice names Lumbridge and `applyRespawn` restores hitpoints and prayer (`phase4-combat.test.ts` 13-29); the gate simulation (`gate-simulation.test.ts`). | Patterns are opt-in per monster type, and goblins and chickens have none. `rollMonsterHit` and `applyRespawn` are not edited. The existing dragon, which the dragonfire test pins, has none either. Every ordinary monster's pattern starts with a basic attack, so the gate is untouched. Declared replacements are in 9.3. |
| C4 | Vitest runs in `node` with no DOM (foundation design C4). | Every rule is a pure function with injected time and randomness. Shapes, timings, sound cues and reaction curves are data that tests read. What needs eyes or ears is a human check. |
| C5 | No new runtime dependency. Sound is synthesised; no audio file. | `CREDITS.md` does not change. Bytes added: code only. |
| C6 | Stage 5 restyles effects "in shape and colour only; Stage 4 timing wins" and maps every visual feature to a tier (its CALL-V15, tier table). | Every timing lives in two data files (6.11). Every Stage 4 effect has a tier row (section 10). |
| C7 | Dungeons and co-op come later and are not built here. | Rules read the world, the target and the clock from parameters. Patterns, shapes and phases are tables. Section 7 says what still blocks them. |
| C8 | Blender 5.0.1 is installed, so a new model is possible. Each one adds bytes to a 3.76 MB download, a build step and a look to keep consistent. | Stage 4 ships no new model (6.8). |
| C9 | The stage is done only when tests, type check and build pass with no test weakened or removed, every goal has a proof, and every owed item is fixed or deferred in writing. | Sections 9 and 11. |

---

## 3. Goals, non-goals, anti-goals

Goals:

- **G4.1** Every monster chases and returns home along routes from the Stage 2 walk grid. A returning monster always gets home, in bounded time.
- **G4.2** Heavy attacks are telegraphed: a wind-up, a shape on the ground, a resolve, a recovery. All of it is data.
- **G4.3** Every wind-up leaves a click-to-act player enough time, by a stated rule that a test enforces on every row.
- **G4.4** A new boss has three phases, each with its own pattern and a clear transition, and cannot be skipped or burst through. The existing dragon is unchanged.
- **G4.5** A prepared player who reads the fight wins it; an unprepared one, or one who ignores the ground, loses. Proven by a seeded simulation.
- **G4.6** Hits have weight on both sides (flash, flinch, lurch, hit stop, number, camera) and never take control away.
- **G4.7** Sound carries timing: the wind-up cue ends on the hit, and phase changes and low health are audible. Mute and autoplay rules are respected.
- **G4.8** Staying alive is bounded: food has a cooldown; hitpoints regenerate all the time, faster out of combat; and dying costs a small share of experience, never a level, unless a blessing bought with gold is held.
- **G4.9** The roster gap is planned as named slots with level, role, pattern and camp (a table in this design and the README), and a new monster is rows only. Two slots are filled by reusing models, and the new boss reuses the dragon's.
- **G4.10** Combat rules are pure, table-driven and command-driven enough that a dungeon instance or a second player reuses them (section 7).
- **G4.11** Everything owed to this stage is resolved or deferred in writing (section 11).
- **G4.12** The performance budget of section 8 holds, and every effect has a tier row.

Non-goals: new models; a dodge roll, block or parry button; player skills with cooldowns beyond today's special attack; line-of-sight; ground loot; status effects beyond the boss's one mark; damage types beyond the styles that exist; difficulty settings; touch controls (Stage 7); restyling effects or the HUD (Stage 5); quests, dialogue, dungeons, bosses beyond the one of 6.4 (Stage 6); any change to the existing dragon; any change to the XP curve, prices, drops of existing monsters or bounties.

Anti-goals:

- No twitch. Nothing in the game requires an answer in under 1.1 s.
- No stun, root, knock-down or forced movement of the hero. Knock-back is drawn, never simulated.
- No behaviour written per monster in code. A new monster or boss is rows in tables.
- No audio files, no music system.
- No entity-component system, event bus or behaviour-tree library.

---

## 4. How established games solve each problem

Techniques are borrowed. No name, character, encounter or look is.

| Problem | Technique in established games | Fits a click-to-act browser game? | Used here |
|---|---|---|---|
| Showing an attack before it lands | **Ground markers with a fill** (MMOs such as Final Fantasy XIV and Guild Wars 2; top-down action RPGs such as Diablo and Path of Exile): the area that will be hit is drawn on the floor and fills over the cast time. | Yes. The information is on the ground, where the player already clicks to move. It needs no animation budget and reads from a high camera. | Yes: the core of 6.2. |
| | **Animation tells** (Souls-likes, Monster Hunter): the body announces the attack; the player learns each silhouette. | Partly. It needs many authored animations per creature and a close camera. This game's monsters have five pivots and no authored clips. | Only as support: a held wind-up pose (6.5). |
| Answering an attack | **Dodge roll with invulnerable frames** (action RPGs). | No. It needs a dedicated button and a 200 to 400 ms answer. | No. |
| | **Move out of the area** (MMOs: "do not stand in the fire"). | Yes. One click on open ground, the largest target on screen. | Yes. |
| | **Protection switching** (tick-based MMOs: the attack style is announced, the matching protection prayer cuts it). | Yes, the game already has the three protection prayers (`combat.ts` 110-119). It is slower here because the prayer list is a tab away. | Yes, as a slower answer with a longer window (6.3), and the reason no single prayer covers the boss (6.4). |
| Making the attack cost the monster something | **Wind-up, active, recovery** (fighting games' frame data; every action game): a committed attack leaves the attacker open afterwards. | Yes. In a click game the opening is felt as "I dodged and got free hits". | Yes: recovery is in the timing table. |
| Boss structure | **Phases at health thresholds, with a gate** (MMO raid bosses; Hades; Zelda-like bosses use rounds): each phase adds or swaps mechanics; health cannot pass the threshold in one hit; a short invulnerable transition marks the change. | Yes. Thresholds and patterns are a table. The gate matters here because a hero swings every 0.6 s. | Yes: 6.4. |
| | **Enrage timer** (MMOs): the boss kills everyone after N minutes. | Poorly. It punishes slow players on slow devices by the clock. | No. The last phase is faster instead. |
| Punishing a player who ignores mechanics | **Stacking vulnerability** (MMOs: each avoidable hit taken makes the next one worse). | Yes. It separates "stood in everything" from "missed one". A single miss from a clean state never kills a hero with 60 or more hitpoints from full; two or more misses inside the mark's 12 s can (6.4, CALL-4.14). | Yes, boss only: the mark (6.4). |
| Sustain | **Shared cooldown on healing items** (most RPGs), **regeneration that is slow in a fight and fast at rest** (most MMOs), **limited charges** (Souls flask). | Cooldown and two-rate regeneration fit as they are. Limited charges already exist: 28 slots. | Yes: 6.6 (the owner chose regeneration that never stops and is amplified out of combat). |
| Death | **Experience loss bounded inside the level** (Ragnarok Online), **a blessing bought in advance that a death uses up** (Tibia), **corpse run or grave** (older MMOs), **durability and repair** (WoW), **a fee** (many), **nothing** (modern action games with checkpoints). | Experience loss is one pure function on fields already saved, and the blessing is one flag. A grave needs ground items, which do not exist. Repair needs durability on every item. | Decided by the owner (6.6): experience loss, with a blessing. |
| Monsters and obstacles | **Grid A\* with staggered, budgeted re-paths and a straight-line shortcut** (RTS games, tile MMOs); **flow fields** (crowds of hundreds). | A\* on the existing grid fits 36 to 50 monsters. Flow fields pay off above a few hundred. | Yes: 6.1. |
| Monster that cannot get back | **Evade and reset** (WoW: a mob that cannot path resets and warps home). | Yes, and Stage 2 already does it as a patch. | Yes, as a bounded rule (6.1). |
| Weight of a hit | **Hit stop** (fighting games, Monster Hunter, Hades: both bodies freeze for a few frames), **hit flash**, **camera kick**, **damage numbers**, **knock-back**. | Hit stop on the two bodies only, a few frames, fits. Freezing the whole game or pushing the hero does not: the player must be able to click at all times. | Yes, drawn only: 6.5. |
| Sound and timing | **Cue that resolves on the hit** (rhythm of a wind-up sound whose pitch arrives with the blow; MMO cast sounds), **distinct cue per attack class**, **low-health heartbeat**. | Yes. The Web Audio clock is sample-accurate, so a cue can be scheduled to end exactly at the resolve. | Yes: 6.7. |

---

## 5. Approaches

### 5.1 How a heavy attack is decided

| | A. Rolled on the wind-up, drawn after | B. Decided by position at the resolve, in the rules module (recommended) | C. Real projectiles and hit volumes in the engine |
|---|---|---|---|
| What | Keep today's roll; play a warning first. | The rules module locks a shape at wind-up and, at the resolve, tests the target's position against it. | Meshes collide in the scene. |
| For | Smallest. | Pure, testable, the player's click is what decides. | Looks physical. |
| Against | The warning means nothing: moving does not help. | New geometry code (four shapes, about 60 lines). | Rules live in rendering again, untestable, frame-rate dependent. Undoes Stage 1. |

Recommendation: **B**.

### 5.2 Where patterns live

- **A (recommended): tables.** `src/data/attacks.ts` holds attack rows, patterns (lists of attack ids) and boss phases. `stepMonster` reads them. A new monster is a row.
- **B: a function per monster.** Faster to write for one boss, and every later monster, dungeon and co-op rule pays for it.
- **C: a scripting or behaviour-tree layer.** Speculative: every pattern in this design is a cycle of attack ids.

### 5.3 How monsters route

| | A. A\* per monster on the Stage 2 grid, budgeted (recommended) | B. One flow field per chased player | C. Steering around obstacles |
|---|---|---|---|
| For | Reuses `findPath`, `nearestOpenCell`, `entityGoal`, `shouldRepath`, `segmentWalkable` and Stage 2's `escapeStall`. Measured: mean 120 expanded cells per call around the camps. Also solves the way home. | Constant cost per monster. | No path state. |
| Against | Needs a quota, a cap and scratch memory (6.1). | A 55,696-cell fill per player move; does nothing for the way home; pays off only with hundreds of chasers. | Gets stuck in concave shapes, which is the defect class to close. |

Recommendation: **A**.

### 5.4 Hit stop

- **A (recommended): freeze the two bodies' pose time** for 40 to 110 ms. The rules clock, the hero's movement and the pointer never stop.
- **B: scale the whole frame's time.** The classic form. Here it would also stretch wind-ups against their sound cues and delay the player's click. Rejected.

### 5.5 Sound

- **A (recommended): synthesis in code, scheduled on the audio clock.** Today's `tone()` grows a start offset, a noise source and a master limiter. No bytes to download, no licence.
- **B: recorded samples.** Better timbre. Each file needs a redistribution licence in `CREDITS.md` and costs 10 to 60 kB. Not needed for cues whose job is timing.

---

## 6. Design

### 6.1 Monsters on routes (G4.1)

**Rule.** In `chase` and in `return`, a monster walks a route from the walk grid. The straight line is only a shortcut when it is open.

`StepWorld` (`monsterAi.ts` 38-47) gains two optional fields, as Stage 2 added its own: `grid?: WalkGrid` and `pathBudget?: { left: number }`. Without a grid the monster moves exactly as today: no route, no `returnLeft`, no wander re-draw, so every frozen test that builds its own world keeps passing. `MonsterLogic` gains `path: [number, number][]`, `pathGoalX`, `pathGoalZ` (the **target's position when the route was planned**, as the hero's `madeAt` is, not the goal cell: the goal cell is up to 2.9 or 11 units from the target, so comparing against it would ask for a new route on every check), `repathIn` and `returnLeft`.

Which camps this changes today (critique, measured on the real grid): only three leash circles contain blocked cells, Three Kettle Camp (219, the river), Dune Nest West (102, the river) and the pass sentries (653, the corridor walls). Every other camp's leash circle is open ground, so before Stage 5 plants trunks the visible change is limited to those three; Stage 5's woods trees are the main reason for the rule.

| Situation | Rule |
|---|---|
| Chase, the straight segment to the target is open | Walk straight, as today. No search. The segment is tested with Stage 2's `segmentWalkable` (exported, 0.25-unit steps through `grid.walkable`), the same test path smoothing uses, so it agrees with the step that moves the monster. A cell-centre test would disagree on shorelines and the bridge edges, where a walkable point sits in a blocked cell. It is re-tested when `repathIn` runs out, not every frame. |
| Chase, the segment is blocked | Follow `path`. Ask for a new one when there is none, when the last waypoint is reached, or when the target is more than 2 units from the path's goal (`shouldRepath`, `pathfind.ts` 309-316, reused). |
| Re-path rate | At most one request per monster every 0.5 s (`repathIn`). The first value is spread over 0 to 0.5 s from the monster's home coordinates, so a camp that aggroes together does not search on the same frame. |
| Frame quota | `pathBudget.left` starts at 2 each frame. A monster that needs a search when the quota is spent keeps its current path, or its straight step through `moveWithCollision`, and asks again next frame. The engine starts each frame's monster loop one place further round the list, so a refused monster is not refused again by the same monsters ahead of it (without this, at 30 FPS the last monsters in the list starve, stall and give up). |
| Search cap | `findPath` takes an optional `maxExpanded`. Monsters pass 6,000 (the measured worst case around every camp is 3,686). Past the cap the search returns `null`. The player's own searches pass no cap. |
| Goal | The nearest open cell within the monster's attack range of the target (`entityGoal`, reused). The start is the monster's own position when its cell is open, or the nearest open cell centre if a wall face or shoreline put it on a blocked cell (the rule of `pathStart` in `input.ts`, moved into a shared `openStart`). |
| No route in chase | The search returned `null`, or the route is longer than 52 units (twice the 26-unit drop distance). The monster gives up: T5, `return`. |
| Stuck on a route | A monster that has not moved for Stage 2's `STALL_SEC` (0.3 s) while following a route takes an escape cell with Stage 2's `escapeStall`, as the hero does since review fix 1. The existing stall test (1.5 s under 0.2 units) stays as the last backstop. |
| Entering `return` | One search home, exempt from the quota (it happens once per fight; when a whole camp turns home on one frame, that frame makes one search per member, at most 7, each under the cap). `returnLeft` is set to route length / 5.2 + 3 s, or to 3 s when there is no route. Only with a grid. |
| Getting home | Within 1.0 of home: T6 as today (full hitpoints, `breathCount` 0, `reset`). |
| **Cannot get home** | When `returnLeft` runs out the monster is put home with the same arrival effects. This is the Stage 2 patch (`monsterAi.ts` 154-160) promoted to a rule with a clock: `return` ends by construction, in at most route time + 3 s. |
| Leash | Unchanged: T5 fires when the monster is farther than camp radius + 4 from the camp centre. It is measured in a straight line while the monster walks a route, so a detour that leaves the circle ends the chase. That is intended: a camp does not follow a player around a ridge. A boss has no leash and no stall test; the arena rule of 6.4 replaces both. |
| Immunity and heal | Unchanged: no damage and no acquisition in `return`; full heal on arrival. |
| Wander | Still a straight walk at 1.8. With a grid, a wander point on a blocked cell is re-drawn (up to three times, else the monster stays). Wander is inside the camp, which Stage 5 keeps free of trunks. |
| Movement | Each step still goes through collision. `moveWithCollision` gains an optional walk test (default `isWalkable`), and `monsterAi` passes `world.grid.walkable` when a grid is given, so a dungeon passes its own grid (section 7). |

**Closing the defect class.** Three proofs: a data test that every camp member's home cell is open and that a route exists from every open cell within leash + 11 of the camp to that home (the model found 0 closed homes and 0 missing routes in 1,013 searches); a property test that from 200 seeded points per camp, `return` reaches `idle` within the bound, including with a grid in which the home has been walled in; and the frozen Stage 2 test of the goblin across the river, which must still pass.

**Cost.** Measured on the real grid: a search costs 0.46 to 0.92 ms **as written today** (three runs of the model on a shared machine), nearly all of it allocating and filling four 55,696-cell arrays per call (`pathfind.ts` 136-142), about 1.1 MB of garbage per search. The plan replaces them with scratch arrays kept per grid size and cleared by a generation stamp, so cost follows expanded cells (mean 120). The scratch change is required, not optional: with today's code a quota of 2 can cost up to about 1.9 ms a frame and over 100 MB of garbage a second. The heap and the returned waypoints still allocate per search; they are small.

| Load | Requests | Served |
|---|---|---|
| One camp of 4 chasing | 8 per second | all, same frame |
| Every monster chasing at once (36 to 50) | 72 to 100 per second | 120 per second at 60 FPS; at 30 FPS the quota gives 60, so re-path intervals stretch to about 0.8 s. Monsters keep walking their old route meanwhile. |

### 6.2 Telegraphed attacks (G4.2)

**Attack row** (`src/data/attacks.ts`):

```
AttackDef = {
  id, name,
  shape:  { type: 'circle', anchor: 'target' | 'self', radius }
        | { type: 'cone', length, halfAngleDeg }
        | { type: 'line', length, halfWidth }
        | { type: 'ring', inner, outer },
  windupMs, slots,            // recovery = slots x cadence - windupMs
  style: 'own' | 'melee' | 'ranged' | 'magic' | 'fire' | 'pure',
  power?: number,             // bosses only: sure damage when inside
  reach: number               // farthest the target stands when the shape locks
}
// The sound cue is derived, not stored: fire for style 'fire'; the attack's own style when it is
// melee, ranged or magic; otherwise ('own', 'pure') the monster's style (melee low, ranged mid, magic high).
PATTERNS: Record<string, string[]>   // attack ids, cycled; 'basic' is today's attack
```

`MonsterDef` gains `pattern?: string`. A type without one behaves exactly as today.

**Life of a heavy attack**, all inside `stepMonster`:

1. **Wind-up.** When the pattern's next entry is a heavy attack and the monster's slot comes up, the shape is **locked**: origin (the target's position, or the monster's) and direction (monster to target) are stored on the monster. The event `windup` carries the attack id, origin, direction and duration. The monster stands still and its mesh faces the locked direction, not the moving hero (today the engine turns every attacking monster toward the hero each frame, `loop.ts` 649-653, which would show a cone or lane that no longer matches the body).
2. **Resolve.** After `windupMs` of rules time, the rules test the target's position against the locked shape (`inShape`, `src/state/telegraph.ts`). The event `resolve` carries `hit: boolean`. The engine applies damage only on a hit.
3. **Recovery.** The monster stands until the attack's slot time has passed since the wind-up began. Slot time is `slots x cadence`, and never less than `windupMs + 150`: a monster has one wind-up at a time, and a faster cadence (the boss's last phase) cannot squeeze a wind-up. It can be hit throughout. Then the pattern moves on.
4. **Cancel.** If the monster leaves `attack` for any reason during the wind-up (it dies, or any T5 cause sends it home: leash, target beyond 26, target down, target safe in an aggressive camp) or enters a phase shift, the event `cancel` removes the shape and nothing is dealt.

A locked shape does not follow the player. The monster commits, which is what makes the answer possible and the recovery deserved. Leaving the monster's attack range during a wind-up does not cancel it.

**Damage of a heavy attack on an ordinary monster: the conservation rule.** It takes `slots` slots of the 1.65 s cadence and deals `slots` times one ordinary roll (same hit chance, same damage roll, same mitigation). A player who never reacts therefore takes the same expected damage per second as today, with larger single blows. A player who steps out avoids it entirely. Measured (10,000 s each, a level-30 fighter in adamant):

| Monster | Today, damage/s | With pattern, standing | Stepping out of every heavy | Share a click avoids |
|---|---|---|---|---|
| King Scorpion | 0.237 | 0.229 | 0.137 | 40% |
| Dark Wizard | 0.406 | 0.406 | 0.237 | 42% |
| Dark Ranger | 0.670 | 0.661 | 0.407 | 38% |
| Hill Giant | 0.705 | 0.709 | 0.428 | 40% |
| Moss Guardian | 1.380 | 1.428 | 0.846 | 41% |
| Lesser Demon | 2.623 | 2.681 | 1.624 | 39% |

This is why Stage 3's pacing numbers survive: its model fights a player who never stops (its 4.2), and that player's expected damage is unchanged. A player who dodges is up to 40% sturdier, which is the reward.

**Patterns of ordinary monsters.** Every pattern is three basics and one heavy, so the first three blows of any fight are today's. The names are new and original (6.9).

| Monster | Heavy attack | Shape | The answer it teaches |
|---|---|---|---|
| Plump Chicken, Goblin Raider, Goblin Archer | none | | The start region has no telegraphs (CALL-4.3). |
| Elvarg the Crag Dragon | none | | Unchanged, by the owner's decision: it keeps its rolled dragonfire (6.4). |
| King Scorpion | Tail Lash | cone, length 4.5, half-angle 40° | Step to the side. |
| Dark Wizard | Hexfall | circle, radius 2.5, at the target | Step off the spot. |
| Dark Ranger | Pinning Volley | circle, radius 2.5, at the target | Same, from range. |
| Hill Giant | Overhead Slam | circle, radius 3, at the target | Same, bigger. |
| Moss Guardian | Rootquake | circle, radius 4.5, around the monster | Back away. |
| Lesser Demon | Scorch Lane | line, length 12, width 2.4, toward the target | Step across, not back. Width 2.4, not 3: in Cinderstep Pass (5 wide) a 3-wide lane along the corridor leaves safe strips 0.7 wide to click; 2.4 leaves 1.0. |

**Camps do not strike together.** A camp aggroes together, so without a rule its heavies overlap. A start index taken from home coordinates (the first draft) does not prevent it: three values for up to seven members collide, and members reach the hero at different moments anyway, so their slots are not aligned. The rule instead is a **camp wind-up gate**: a camp may start a wind-up only when no member is winding up and at least one cadence (1.65 s) has passed since the previous one resolved. A member whose heavy comes up while the gate is shut makes a basic attack instead and keeps the heavy for its next slot. Expected damage is unchanged (a basic is one roll per slot, as the heavy is), the reaction rule of 6.3, which is stated for one shape, holds inside every camp, and the hero has at least 1.65 s between two shapes from one camp. The gate is a small `Record<campId, seconds>` the engine owns and passes in `StepWorld` (`windupGate?`), ticked down once per frame by a pure `tickWindupGates`; without it (every frozen test) monsters are not gated. Every pattern still starts with a basic, so the first blow of any fight is today's.

Shapes from two different camps can still overlap when a player pulls both. That is the player's choice and is accepted; the boss arena is placed so that no camp can join it (6.4).

The pass sentries are lesser demons. A runner is in a sentry's reach for under a second (closing at 16.7 units/s, opening at 6.3), so each sentry gets one blow, which is a basic, and the gate simulation is unchanged. Plan task T3 asserts it.

### 6.3 The timing table and the reaction window (G4.3)

**The rule.** For every attack row:

```
windupMs >= 700 (human) + 160 (device) + 90 (hero's acceleration)
            + escapeDistance / 11.5 * 1000  + 200 (margin)
```

- **Human, 700 ms**: about 250 ms to see the shape, 150 ms to decide, 300 ms to move the pointer to open ground and click. It is a slow figure for a mouse (the model's attentive player has a median of 550 ms) and a typical one for a trackpad (6.3, below the table).
- **Device, 160 ms**: two frames at 12.5 FPS. Below 12.5 FPS the loop caps the step at 0.08 s (`loop.ts` 786), so rules time runs slower than the wall clock and every window grows in real milliseconds. A slow device can only lengthen the window, never shorten it below this figure.
- **Acceleration, 90 ms**: the hero reaches running speed with rate 16 (`loop.ts` 312).
- **Escape distance**: the worst distance from inside the shape to its edge, for a target within `reach`, plus 0.3 for the hero's body. Computed by `escapeDistance` from the row itself. For a circle around the monster the worst case is the full radius: the hero can stand against the monster's body (the first draft assumed at least 1 unit and understated Rootquake and Tail Sweep by 1 unit, about 90 ms). For a ring it is the run inward from the farthest standing distance; for a cone it is the shorter of the step across the nearer edge and the run out of the far end, at the worst distance.
- **Open ground.** The rule is stated for open ground and one shape at a time. The camp wind-up gate (6.2) makes "one shape" true inside a camp. Walls are checked shape by shape: every circle and cone can be left in more than one direction, and the one lane that can run along a corridor (Scorch Lane in Cinderstep Pass) is narrowed so both sides stay open. Stage 5's trunks add a detour of up to about 1.4 units around one trunk; Rootquake, the one heavy of a woods monster, gets 100 ms more wind-up for it (1,700 ms).
- **Prayer answers** are slower (a key or tab click, then a small target). Nothing in this design can be answered only by a prayer switch inside a wind-up: a prayer is chosen for a phase, and announced by the phase change, which gives 2 s (6.4).

| Attack | Shape | Escape (units) | Minimum (ms) | **Wind-up (ms)** | Margin (ms) | Active | Slots | **Recovery (ms)** |
|---|---|---|---|---|---|---|---|---|
| basic | none | | | 0 | | instant | 1 | 1650 (the cadence) |
| Tail Lash | cone 4.5 x 40° | 2.05 | 1128 | **1600** | 472 | instant | 2 | **1700** |
| Hexfall | circle 2.5, target | 2.80 | 1193 | **1600** | 407 | instant | 2 | **1700** |
| Pinning Volley | circle 2.5, target | 2.80 | 1193 | **1600** | 407 | instant | 2 | **1700** |
| Overhead Slam | circle 3, target | 3.30 | 1237 | **1600** | 363 | instant | 2 | **1700** |
| Rootquake | circle 4.5, self | 4.80 | 1367 | **1700** | 333 | instant | 2 | **1600** |
| Scorch Lane | line 12 x 2.4 | 1.50 | 1080 | **1600** | 520 | instant | 2 | **1700** |
| Ember Cone (boss) | cone 16 x 45° | 6.91 | 1551 | **1800** | 249 | instant | 2 | **1500** |
| Tail Sweep (boss) | circle 5, self | 5.30 | 1411 | **1700** | 289 | instant | 2 | **1600** |
| Slag Rain (boss) | circle 2.5, target | 2.80 | 1193 | **1500** | 307 | instant | 1 | **150** (a volley) |
| Ashen Nova (boss) | ring 8 to 20 | 5.80 | 1454 | **2000** | 546 | instant | 2 | **1300** |
| Slagburst (boss) | circle 8, self | 8.30 | 1672 | **2000** | 328 | instant | 2 | **1300** |

"Minimum" excludes the 200 ms margin; "Margin" is wind-up minus minimum. "Active" is one rules step: the shape is tested once, at the resolve. The drawn impact lingers 150 ms and deals nothing. The player's own attacks keep today's timing: one action every 0.6 s, no wind-up.

Share of wind-ups an attentive player clears (model; human time log-normal, median 550 ms; 5% of shapes not noticed at all):

| | Fast device | 160 ms slower device | 300 ms slower player |
|---|---|---|---|
| Ordinary heavies | 93 to 95% | 89 to 94% | 79 to 91% |
| Boss heavies | 92 to 95% | 84 to 94% | 67 to 92% |

**How honest is 1.6 s?** For an attentive player with a mouse on a device at 12.5 FPS or better: yes, every row keeps at least 249 ms beyond the minimum (the rule asks for 200). Below 12.5 FPS the step cap stretches every window in real time, so a slow device never loses time. Two cases are tighter than the rule admits:

- **A trackpad.** Pointing on a trackpad takes roughly 1.5 to 2 times as long as with a mouse, about 150 to 300 ms more on a target of this size. At +300 ms the margins of Overhead Slam (63 ms), Rootquake (33 ms), Slagburst (28 ms) and Slag Rain (7 ms) are nearly gone, Tail Sweep is 11 ms short and Ember Cone 51 ms short, and the share cleared falls to the right-hand column. (Ember Cone's worst case is a hero 9 to 10 units from the boss, where no fighter stands: at melee reach the step is 2.4 units, and at 11 units it is 5.3.) The rule's figure of 700 ms is therefore a mouse figure. G-8 includes a trackpad run; CALL-4.16 decides what follows.
- **Touch (Stage 7).** A tap needs no pointer travel, so the reaction itself is not slower than a mouse, but a finger hides the ground under it and a tap may be needed to dismiss something first. Stage 7 measures it and sets the scale; nothing here assumes it.

One knob is left on purpose: `TELEGRAPH_TIME_SCALE` (1.0) multiplies every wind-up. Stage 7's touch controls, or an accessibility setting, can raise it without touching a row.

### 6.4 Two dragons: the existing one stays, a new boss has the phases (G4.4, G4.5)

**Decided by the owner, 2026-11-14 (CALL-4.4):** "A dragon is a dragon; bring the base of the essence. That does not stop us from having a dragon boss with mechanics." The first draft rebuilt the existing dragon into a three-phase fight. That is withdrawn. The existing dragon stays what it is, and the phased fight belongs to a separate, new boss.

#### The existing dragon is not touched

| | Today | After Stage 4 |
|---|---|---|
| Name, level, model | Elvarg the Crag Dragon, 95, its own mesh | the same |
| Hitpoints | 260 | **260** |
| Attack | magic, max hit 32; every third attack is dragonfire, rolled (`rollMonsterHit`, `combat.ts` 226) | **the same**: no pattern, no telegraphed attack |
| Place | lair at (-102, 100) | **the same** |
| Drops, quest flag, title | `catalog.ts` 478; `killedElvarg`; "Dragon Slayer" | **the same** (`catalog.ts` is not edited) |
| Back after death | 8.35 s | **the same** |

**It gets no telegraphed heavy attack.** The owner allowed one "only if that keeps its average damage as today". It does not, cheaply: the dragon's special is already a dice roll counted on `breathCount`, which a frozen test pins; a heavy that takes two slots and one count would shift which blows are dragonfire, so the average moves unless the counting rule is edited too. And its fight lasts about 9 s for a geared hero, five or six blows, so a three-and-one pattern would show one shape at most. It keeps its dice, like the chickens and goblins keep theirs.

What reaches it are only the rules every monster shares: it walks routes (6.1; today its leash circle holds no blocked cell, so nothing visible changes), a hit on it flashes and sounds like any other (6.5, 6.7), and the hero fighting it eats and regenerates by 6.6. Its average damage is exactly today's. Plan task M1 freezes its row, camp and drops in a golden so no later task can drift it.

Stage 3's finding F13 (the dragon as income, back in 8.35 s) is therefore **not** closed here: the owner's decision keeps the respawn. Stage 3 already cut its gear drops; the item goes back to the ledger as declined (section 11).

#### The new boss: Ashmantle the Slag Wyrm

A second dragon, older and ash-grey, in the far south-west of the volcanic corner. The name is an original proposal (6.9, CALL-4.18) and holds no deny-listed token (`dragon` itself is on the list, so it is a "wyrm").

**Its row** (`MONSTER_TYPES.ashmantle`, added through the world override; `catalog.ts` is not edited):

| Level | HP | Basic attack | Attack | Defence | Model | Camp |
|---|---|---|---|---|---|---|
| 110 | **1,400** | magic, max hit **72** | 120 | 78 | `model: 'elvarg_dragon'`, ash-grey `tint`, `modelScale` 1.2 (the mechanism of 6.8) | `ashmantle`, one member at (-102, 54), aggressive: it attacks a hero of combat level 110 or less who comes within 5 of its home (Stage 2's rule needs the hero inside the camp circle, `monsterAi.ts` 228-231, and a one-member camp's circle has radius 5, `makeCamp`, `worldMap.ts` 155-169; the aggression radius of 12 is the outer bound) |

**Boss row** (`BOSSES` in `src/data/attacks.ts`), keyed by monster type:

```
BossDef = {
  respawnSecs, arenaRadius,
  title?: string,                 // set on the hero's quest record at each kill
  mark: { step, max, secs },
  phases: [{ name, untilHpFrac, pattern, cadenceMult, shiftMs }]
}
```

Hitpoints and drops are in the monster row, the one source `createMonsterLogic`, labels and the target HUD already read. The existing dragon has no `BOSSES` row.

| | Existing dragon | Ashmantle |
|---|---|---|
| Hitpoints | 260 | 1,400 |
| Back after death | 8.35 s | 120 s |
| Area | camp circle, radius 5, leash 9 | arena, radius 12 |
| Special | dragonfire, rolled on every third attack | five telegraphed attacks in three phases; no dice dragonfire |
| Fight for a geared melee hero | about 9 s | about 100 s |

**Phase table.**

| Phase | Health | Cadence | Pattern, in order | What it asks |
|---|---|---|---|---|
| **I. Grounded** | 100% to 66% | 1.65 s | basic, basic, **Ember Cone**, basic, **Tail Sweep** | Pray against magic for the basics. Step out of the cone. A melee hero backs off from the sweep, then returns. |
| transition | at 66% | | 2.0 s: the wyrm is untouchable, roars, a ring of light runs out, the banner names the boss and the phase | Time to eat and to choose a prayer. |
| **II. Rain of Slag** | 66% to 33% | 1.65 s | **Slag Rain** x3, **Tail Sweep**, basic, **Ember Cone**, basic | Keep moving: three circles fall where the hero stood, 1.65 s apart. |
| transition | at 33% | | 2.0 s, as above | |
| **III. Fury** | 33% to 0 | 1.32 s (x0.8) | **Ashen Nova**, **Slagburst**, basic, **Ember Cone**, basic, **Slag Rain** x2 | In, then out. The nova burns everything from 8 units out: run **in**. The burst then covers the 8-unit disc the nova left safe: run **out**. |

Phases II and III **open with their signature attack**. A hero who kills fast still meets it: the first draft opened every phase with a basic, and a magic hero, who deals about twice a melee hero's damage in today's item tables, ended each phase before its mechanic came round (a magic hero who never moved won 78% of first-draft fights). Phase I opens with basics, as every ordinary pattern does.

In phase III the cadence shortens slots, never wind-ups: Ashen Nova's and Slagburst's slots are 2,640 ms (recovery 640), Ember Cone's 2,640 (recovery 840), and Slag Rain keeps 1,650 by the slot rule of 6.2 (recovery 150). The model applies the same rule.

**What changed in the shapes, and why** (the critique's finding, and the owner's instruction to fix the patterns and not only the hitpoints):

| First draft | Now | Why |
|---|---|---|
| Ashen Nova: ring 4 to 14 | **ring 8 to 20**, always followed by **Slagburst**, a circle of radius 8 around the boss | A melee hero at reach stood inside the old safe disc and never moved; a ranged hero at 11 to 13.5 left the old ring by a step backwards. Now the far hero must run in (3.3 to 5.8 units; 20 is past the distance at which leaving starts to reset the fight), and the pair leaves no standing distance safe: whoever was safe from the nova stands in the burst (a melee hero runs 5.4 units out). |
| Ember Cone: 12 long, 32° half-angle | **16 long, 45°** | The old cone did not reach a hero at 13.5 and was left by a 1.3-unit step back from 11. Now it reaches every fighter; the step is 2.4 units at melee reach and 2.8 to 5.3 for a far hero. A cone cannot ask more of a hero standing against the boss: the edge is never farther than the hero's own distance. The melee hero's long runs are the sweep and the burst. |
| Cinder Fall: fire, cut to 25% by a ward | **Slag Rain: nothing cuts it** | A warded hero who never moved took a quarter of each cinder and out-ate it. Molten rock is not flame: like the nova, it must be dodged. |
| Tail Sweep in phase III | **Slagburst** (radius 8) takes its place there | The second half of the pair. |

**Boss attacks deal sure damage.** Inside the shape at the resolve: `power x (0.75 to 1.0)`, then the style's mitigation. No hit roll: on a boss, position alone decides.

| Attack | Power | Style | Cut by |
|---|---|---|---|
| basic | a rolled hit as for any monster (`rollMonsterHit`), max 72 | magic | Protect from Magic (to 20%: at most 14), Defence |
| Ember Cone | 50 | fire | a warding shield, the quest's ward or Protect from Magic (to 25%: `resolveDragonfire`, unchanged) |
| Slag Rain | 30 each | pure | nothing. It must be dodged. |
| Tail Sweep | 46 | melee | Protect from Melee (to 20%), which means dropping Protect from Magic |
| Slagburst | 52 | melee | the same |
| Ashen Nova | 60 | pure | nothing. It must be dodged. |

No single prayer covers the fight, and the ward that existing players already own still does its job against fire.

**The basic attack is the preparation check.** `rollMonsterHit` breathes dragonfire only for the literal key `elvarg_dragon` (`combat.ts` 226), so the new boss's basics are plain magic hits with no engine rule (the first draft needed the engine to pass a fixed `breathCount`; that is gone). Their max hit is 72: with Protect from Magic that is 14, a nuisance; without it, a level-50 hero can lose most of its hitpoints to one bolt. This is what separates the prepared from the unprepared: with the existing dragon's max hit of 32 instead, an attentive level-50 hero wins 22% in melee, 59% with a crossbow and 90% with magic (`check-results.txt`, section 7). The pass that leads here is tuned for a hero with Protect from Melee and 40 hitpoints (the Stage 2 gate), so most heroes who arrive know the protection prayers. The bolt has no warning shape, and against an unprepared hero it can be most of a health bar: that is put to the owner as part of CALL-4.18.

**The bolt against the stage's promise (second pass).** The stage promises "attacks with a visual warning". The bolt is the one attack in the fight with none, and it is the one that decides who loses. Lowering it does not help much: a sweep of its max hit with the committed model (1,000 seeds; A, R and M stay at 98 to 100% throughout) gives the unprepared magic hero FM 89% at 32, 55% at 52, 35% at 56, 24% at 60, 18% at 64 and 9% at 72, so FM's bound of 15% needs a max hit of about 68 or more, which still kills a 50-hitpoint hero from full in one bolt. A per-bolt warning would break the design's own rules (the answer would be a prayer switch inside a 1.65 s window, 6.3). What fits the rules is a warning for the fight, not for each bolt: on first aggro the boss opens with the same 2.0 s untouchable roar as a phase change, the banner names it and a chat line says "Its bolts are magic." That is the 2 s the design already gives for choosing a prayer (6.3), it deals nothing, and no proof row moves, because the unprepared fighters have Prayer 20 and Protect from Magic needs 25. A level-50 hero who heeds it and has the prayer is a different fighter, measured with `fight.ts` (1,000 seeds, no ward, Protect from Magic on, no potions, the F, FR and FM kits and food): with Prayer 25 melee wins 3%, ranged 24%, magic 91%; with Prayer 43, 12%, 84% and 94%. So the warning turns the bolt from a trap into the check it is meant to be, and a praying level-50 caster then wins easily; that is the style gap of section 11 (magic deals about twice melee's damage), not the warning's doing. Offered to the owner in CALL-4.18. The boss is also aggressive, can one-shot an unprepared hero, and a death now costs experience: the three together are what a player who wanders in pays.

**The mark.** Each heavy boss attack that lands adds a mark, up to four, and sets the marks' shared timer to 12 s; when the timer runs out all marks go. While marks last, **every** heavy hit is raised by 25% per mark. A player who misses one shape pays once. A player who stands in everything loses: 0.0% of 2,000 fights won in melee and with a crossbow, 0.1% with magic. Marks show as a small counter by the hitpoint bar and as a tint on the hero. The rule is pure: `addMark`, `tickMarks` and `markMultiplier` in `src/state/combat.ts` work on a small `{ count, left }` value with time as a parameter; the engine only holds that value for the hero.

**What the mark does to single hits.** Unmarked, no boss heavy can kill a hero with 60 or more hitpoints from full (the largest, Ashen Nova, deals at most 59). With one mark a missed nova deals 56 to 74, which can kill a 70-hitpoint hero from full; with two marks, usually. This is how "stood in everything" loses: capping any single heavy at 45% of maximum hitpoints lets a melee hero who never moves win 82% and ranged and magic heroes who never move win every fight, because food then out-heals the boss (`check-results.txt`, section 6). Whether repeated misses may kill from full health is the owner's call (CALL-4.14).

**Phase gate.** `onPlayerHit` clamps a boss's hitpoints at the current phase's threshold: damage past it is lost. Then the boss is in `shift` for `shiftMs`: it takes no damage (`applied: false`, with a reason the engine shows as "untouchable", not "lost interest"), cancels any wind-up, emits `phase`, and resumes with the new pattern from its first entry one second after the shift ends. A reset (arrival home after `return`) and a respawn put the boss back in phase I at its first pattern entry with full hitpoints and no shift.

**Arena.** The boss does not chase beyond `arenaRadius`. It returns home and heals only when the target has been farther than `arenaRadius + 6` for 5 s (a counter on the monster's logic, reset whenever the target is back inside), is beyond the 26-unit drop distance, goes down, or enters a safe zone. The camp leash and the stall test do not apply to a boss: pinned at its arena edge in `chase` it would otherwise "stall" and reset after 1.5 s. So stepping out of a shape never resets the fight (the nova's answer is inward, the cone's far end is 16 units out).

**No shooting from outside (second-pass fix).** The boss's reach is 11 (`FAR_RANGE`, `monsterAi.ts` 51) and a ranged or magic hero's is 13.5 (the stop distance in `input.ts`). Pinned at its arena edge, 12 from home, the boss cannot answer a hero standing 23 to 25.5 units from its home, and that hero can hit it. The first critique and the first revision said "there is no spot from which the hero can shoot without being answered"; that is false. The 5-s count does not close it either: a hero who shoots for 4.9 s and then steps back inside 18 resets the count, and can repeat, skipping the bolt and most shapes, which would also let an unprepared ranged or magic hero win. Rule: **while the target is farther than `arenaRadius + 6` from the boss's home, the boss takes no damage** (`applied: false`, reason `arena`, shown as "out of the arena", the same path as the shift's "untouchable"). It is pure: `stepMonster` already measures that distance for the 5-s count (`outsideFor > 0`), and `onPlayerHit` reads it. No fighter of 6.4 stands that far, so no proof row moves; B1 tests the rule. The side effect, stated so the owner can veto the rule: the boss follows a far hero to within 11 up to its edge, so a hero 18 to 23 units from home is still hit while its own hits do nothing, for at most the 5 s before the boss resets. Before this rule the same hero could hit back for those 5 s, and then the fight reset anyway. This rule is the second pass's addition, not the lead's.

**Where the arena goes: (-102, 54).** The criterion is the critique's, extended because the existing dragon is now one of the neighbours and because the ridge's foot is walkable but steep:

- the circle of arena radius + 6 clear of every other camp's **leash** circle (radius + 4) and of every safe zone;
- the arena itself beyond every other camp's attack reach (leash plus 2.9 for melee monsters, plus 11 for the dragon and other casters) and outside every aggression circle;
- every arena cell open, and the arena inside the world's bound;
- no path and no point-of-interest pad inside arena + 6; no resource node inside the arena or within 2 of it (a gatherer there is far outside the boss's aggression circle, which is its camp circle of radius 5, and outside the arena it fights in);
- the ground inside the arena no steeper than 0.8 per unit: the shapes are flat meshes on it. The existing dragon's lair is 0.34 at its steepest.

`decisions.ts` checks all of it on the real grid, tables and height function (`decisions-results.txt`, section 3):

| Spot | Result | Smallest gaps |
|---|---|---|
| (-106, 106), first draft | fails | 19.8 inside the existing dragon's leash circle; on the Slagfall Terrace pad |
| (-106, 66), the critique's | passes, barely | leash 7.2 (the existing dragon's), the dragon's reach 2.2, safe zone 4.1, as the critique found; the runite rock at (-92, 68) is 0.1 beyond arena + 2; 6 units of the margin lie past the world's bound |
| (-100, 50), this revision's first pick | fails on slope | every distance passes, but its southern strip is the ridge's foot: the ground rises 9.4 and is 2.64 per unit at its steepest |
| **(-102, 54), chosen** | **passes all** | leash circles 17.2 (Slagfall Terrace); other camps' attack reach 14.0; aggression circles 22.0; safe zone 2.9; resource node 3.2 beyond arena + 2; path 18.8; all 448 arena cells and all 998 margin cells open; ground rises 3.8 across the arena, 0.52 per unit at its steepest |

Sixteen spots on a 2-unit lattice pass; this one has the widest smallest gap. Two units of its margin (not of the arena) lie past the world's western bound. The walk is 54 units from the pass's west mouth and 47 on to the existing lair. The nearest runite rock is 17.2 from the boss's home, far outside its aggression circle (radius 5): a miner is not attacked. The spot was not looked at in the running game, and not checked against Stage 5's set dressing; B3 re-runs the check as a test. Second pass, with `isWalkable` and `getTerrainHeight` sampled every 0.5 (not the grid): every arena point is walkable; the only blocked points within arena + 6 are the 70 west of the world's bound (x < -118); the nearest ridge or water is 19.0 from home; rise 3.8, steepest 0.52 per unit, as above. One thing to watch in B3 and G-8: the arena's west edge is 4 units from the bound, so a hero west of a boss pulled to that edge cannot leave Tail Sweep (5) or Slagburst (8) straight outward and must step round; the model assumes open ground in every direction.

**Running in with one click.** A click picks any monster on the ray before the ground (`handleWorldClick`, `input.ts` 381-383), so a ranged hero who clicks near the boss to run in from the nova targets the boss, is already within its 13.5 stop distance, and does not move. Rule: a click on the monster the hero already targets, while the hero is already within stop distance of it, is treated as a ground click at the ray's ground point. Re-clicking the current target does nothing useful today, so nothing is lost. Clicking beside some other monster in a crowd still targets it; the human check covers it and the context menu's "Walk here" remains.

**What the boss inherits from the dragon's code branches.** The game keys a few things on the literal type `elvarg_dragon`. With `model: 'elvarg_dragon'` the plan (M2, M3) moves the cosmetic ones to the model key and leaves the rules alone:

| Branch | Where | For the new boss |
|---|---|---|
| Mesh builder, limb pose, albedo, GLB node | `monsterMeshes.ts` 787, 816; `textures.ts` 62; `blenderMonsters.ts` | Yes, through the model key, with tint and scale. |
| Minimap dot size and colour, label height | `overlay.ts` 117-118, 243 | Yes, through the model key; the label height is multiplied by `modelScale`. |
| Dice dragonfire and its two chat lines | `combat.ts` 226; `actions.ts` 322, 337 | **No.** They stay the existing dragon's. |
| Quest flag `killedElvarg` | `adventure.ts` 475 | **No.** The quest is the existing dragon's. |
| Rare-loot beam (`isBossLoot`) | `adventure.ts` 285 | Yes: true for the existing dragon as today and for any type with a `BOSSES` row. |
| Basic-attack projectile | `actions.ts` 342-358 | The generic magic projectile, as any magic monster. |

**Rewards, and why a player seeks it.** Stage 3 owns the economy, so the table below is a ceiling and is **Stage 3-tuned**: plan task R0 runs Stage 3's pacing test with this row in place, and if an assertion moves, these numbers are the lever.

| | Ashmantle | For comparison |
|---|---|---|
| Coins | 1,500 to 3,000, always | the existing dragon: 1,800 to 3,800 |
| Items | dragon bones and a shark, always. **No equipment.** | the existing dragon: four armour pieces at 35% today (Stage 3 reduces them) |
| Title | "Ashbreaker" (`BossDef.title`, written to the existing saved `quests.title` at each kill) | the quest's "Dragon Slayer" |
| Coins per second for fighter A | about 10 (one kill per 103 s of fight plus 120 s) | about 150 from lesser demons (an estimate: 954 coins a kill, a kill about every 6 s) |

It is deliberately not an income route: a hero strong enough to kill it earns fifteen times as much from demons, so no pacing number can move through it. Stage 3's model fighter has no prayers and must expect to lose at most 60% of its hitpoints in a kill (its 4.2); against a max hit of 72 over 100 s it can never "win", so it never picks the boss. The reason to seek it is the fight, the one in the game with phases, and a title that shows on the HUD. A material reward (a unique item) would be Stage 3's or Stage 6's to price; it is offered to the owner in CALL-4.18.

**The fight, simulated.** One model, the critique's positional check, extended (`fight.ts`, printed by `check.ts`; data in `boss.ts`). 2,000 seeded fights per row. The hero has a position; each shape is tested where the hero actually is; the hero attacks until it reacts, clicks the boss again after a dodge and walks back if out of reach. Food cooldown 1.8 s; eating delays the next swing by one tick; hitpoints regenerate at 0.25 HP/s throughout (6.6). Melee heroes stand at 2.9; ranged and magic heroes stand at 11 (the boss's own reach) and attack from anywhere within 13.5. The fighters are fixed; tuning touched only the boss. The first draft's position-free model is cut: the critique showed it hides the geometry that decides who wins.

| Fighter | Wins | Threshold | Mean length (wins) | Heavies dodged |
|---|---|---|---|---|
| A. Melee, prepared, reads the fight: level 70, dragon kit with a warding shield, Protect from Magic, 20 sharks, 4 prayer potions | **98.9%** | at least 85% | 103 s | 93% |
| B. The same hero, never moves | **0.0%** | at most 5% | | 0% |
| C. The same hero, 300 ms slower on every answer (about a trackpad) | **96.8%** | at least 65% | 104 s | 88% |
| C2. The same, 500 ms slower | 77.9% | | 103 s | 75% |
| D. The same hero, no food | 72.1% | | 101 s | 93% |
| E. Melee, level 60, dragon kit, 16 sharks | 94.5% | | 113 s | 93% |
| F. Melee, level 50, rune kit, no ward, no protection prayer, 10 lobsters | **0.1%** | at most 15% | | 94% |
| G. The same, never moves | **0.0%** | at most 5% | | 0% |
| R. Ranged, prepared: level 70, crossbow, hide armour, the quest's ward, Protect from Magic, 20 sharks | **98.5%** | at least 85% | 61 s | 92% |
| R, 300 ms slower | 96.7% | | 62 s | 86% |
| R, never moves | **0.0%** | at most 5% | | 12% |
| M. Magic, prepared: level 70, sceptre, robes, a warding tome, Protect from Magic, the life-stealing spell | **100.0%** | at least 85% | 47 s | 89% |
| M, 300 ms slower | 99.3% | | 48 s | 83% |
| M, never moves | **0.1%** | at most 5% | | 14% |
| FR. Ranged, level 50, unprepared (no ward, no prayer, 10 lobsters) | **1.8%** | at most 15% | | 94% |
| FM. Magic, level 50, unprepared | **9.2%** | at most 15% | | 93% |

Reading it. Every proof row holds, with room: a prepared hero who moves wins nearly always, in any of the three styles; the same hero who never moves loses; an attentive but unprepared level-50 hero loses, in any style. ("Dodged" for a hero who never moves counts shapes that did not reach where it stood, such as the sweep at 11 units.) Food has a job again: without it the prepared melee hero drops from 99% to 72%. The thinnest row is FM at 9.2% against 15%: the life-stealing spell is the strongest sustain in the game, and the unwarned bolt is what beats it.

**The first draft measured the same way**, for the record (`check-results.txt`, sections 1 and 2): with regeneration in the fight its unprepared melee hero rose from 44% to 56%, a ranged hero who never moved won 30%, a magic hero who never moved 78%, and the unprepared ranged and magic heroes 91% and 97%. The critique's 41.5% was the smallest of its problems.

**What follows for the plan.** B3 ports `fight.ts` as the test, with these rows and thresholds, 500 seeds each. The swing arithmetic is transcribed from `actions.ts` for the three styles; after Stage 3 it becomes that stage's functions. If a threshold misses in B3, the boss's numbers move, never a threshold (12.4).

### 6.5 Hit reaction (G4.6)

All of it is drawn by the engine from events. None of it writes a rules position, pauses the rules clock or blocks input. Numbers live in `src/data/feel.ts`.

| Reaction | Today | Design | On the hero | On a monster |
|---|---|---|---|---|
| **Hit stop** | none | Pose time of attacker and victim freezes. | 0 ms on basic hits taken, 80 ms on a heavy | 40 ms on a hit, 70 ms on a max hit or special, 110 ms on the killing blow |
| **Flash** | `flashTimer` set, never read | The body's materials lerp to a light colour and back. Materials are collected once at spawn. Peak under 70% white, never more than one flash per 350 ms on one body (photosensitivity: the common guideline is at most three flashes in any second; one per 250 ms allows four). | 90 ms, on any damage | 90 ms |
| **Flinch** | monsters only (`poseMonsterLimbs`) | Kept for monsters, 260 ms. Added for the hero: an additive lean of the torso away from the blow. It never interrupts a walk or a swing. | 180 ms | 260 ms |
| **Knock-back** | none | The mesh is offset away from the blow and springs back. The rules position does not move. | 0.25 units on a heavy, 150 ms | 0.18 units, 0.35 on a max hit or special, 150 ms |
| **Damage numbers** | DOM splats: miss, hit, max hit, heal | Two kinds added: `heavy` (a telegraphed hit taken) and `blocked` (cut by a prayer or ward, shown smaller). Size steps with damage / max hit. Restyling is Stage 5's. | | |
| **Camera** | random jitter up to 0.12 on big hits dealt | A directed kick along the blow that springs back in 140 ms, plus today's jitter. Capped at 0.18 units. A heavy hit taken kicks; a boss phase change rumbles for 600 ms. Off when the browser asks for reduced motion (the rule Stage 5 states in its 6.8). | | |
| **Wind-up pose** | none | While a monster winds up it holds a raised pose (arms, head or wings by rig), driven by wind-up progress. The shape on the ground stays the source of truth. | | |
| **Low health** | none | Under 25% hitpoints: a red vignette at the screen edge (CSS, steady, no pulse under reduced motion) and the heartbeat of 6.7. | | |
| **Lantern Vow** | none | While a vow is held (6.6): a small lantern mark beside the hitpoint bar, with a tooltip. Steady, no animation. | | |

**Audit finding 14** is fixed here: the special-attack spin stops accumulating a per-frame increment. The hero's facing is kept as `baseYaw`, and the drawn rotation is `baseYaw` plus an offset computed from `spinAnim` alone, so the spin is the same at 30, 60 and 144 Hz.

**The telegraph on the ground.** One flat mesh per live shape, built from the attack row: an outline at full size from the first frame, and a fill that grows from the origin to the outline as wind-up progress goes from 0 to 1, so the moment of impact can be read from the picture alone. The outline is a band of triangles about 0.15 units wide, not a `LineLoop`: WebGL draws lines one pixel wide whatever `linewidth` says, which is unreadable at a distance and on the Low tier's reduced pixel ratio. Both meshes are unlit, take no fog (a ranged hero reads shapes up to 25 units away), use a polygon offset and a 0.06 height offset with no depth write, and have vertices no farther apart than the terrain's own (about 1.5 units) so the ground cannot poke through on a slope. They are never added to the click targets, so a click on a shape is a click on the ground. It never relies on colour alone: the outline is a shape, the fill is motion, and the cue is a sound.

### 6.6 Staying alive (G4.8)

The four items Stage 3 left here. Two were decided by the owner on 2026-11-14 and changed the first draft.

| Item | Today | Design | Status |
|---|---|---|---|
| **Food** | Instant, no limit | A 1.8 s cooldown on food and a separate 1.8 s on potions. Eating delays the next swing by one 0.6 s tick. The cooldown shows on the backpack slots. | Kept from the first draft, with numbers below. |
| **Regeneration** | 0.25 HP/s always | **Always on: 0.25 HP/s in combat, 1.0 HP/s out of combat.** | Decided by the owner (CALL-4.5). The first draft's pause in fights is withdrawn. The two rates are the lead's (CALL-4.19). |
| **Altar** | Free full heal and prayer | **Kept as it is**, and it is where the Lantern Vow is taken. | It stands in a safe zone in town; walking there is its cost. |
| **Death** | Nothing lost | **A small share of experience, never a level, no item, no coin; a blessing bought with gold cancels it and is spent by the death.** | Decided by the owner (CALL-4.6). The numbers are the lead's (CALL-4.17). |

#### Regeneration: always, faster out of combat

**Decided by the owner, 2026-11-14 (CALL-4.5):** "Regeneration is frequent, amplified out of battle."

- **In combat** means: fewer than `COMBAT_REST_SECS` = 6 s have passed since the hero last **made an attack or was attacked**. Every attempt counts, not only damage: a swing that misses, a monster's blow that misses or is fully absorbed, a heavy attack that resolves on the hero or that the hero dodged, and a wind-up aimed at the hero while it lasts. Otherwise a hero being missed, or standing out of a shape, would get the resting rate in the middle of a fight. Monster blows come every 1.65 s and the longest wind-up is 2.0 s, so the timer cannot lapse inside a fight; it lapses 6 s after the last exchange.
- **In combat: `HP_REGEN_PER_SEC`, 0.25 HP/s.** This is today's rate and Stage 3's constant, unchanged, so every fight in the game regenerates exactly as it does today.
- **Out of combat: `HP_REGEN_RESTING_PER_SEC`, 1.0 HP/s**, four times that. From 1 hitpoint to full: 29 s instead of 116 s at 30 hitpoints, 69 s instead of 276 s at 70, 98 s instead of 392 s at 99.
- One pure function, `regenRate(sinceCombatSecs)`, in `src/state/sustain.ts`; the engine keeps the timer and resets it on the events above. Nothing is saved: after a load the hero is out of combat.

What the decision does to the numbers it touches:

| Number | Before | With regeneration always on | Holds? |
|---|---|---|---|
| Stage 2 gate, fresh character (must die in at least 95% of runs) | The frozen test has no regeneration at all: 4.3 to 4.4% survive on the three lines | With 0.25 HP/s during the run (what the running game does, today and after): 4.4 to 4.5% survive. With 1.0 HP/s, if the resting rate ever applied in the pass: 4.8% | Yes. The frozen test is not edited and has no regeneration, so this stage cannot move it. The thin look of 4.5% is an artefact of seeds 1 to 1000 (second pass, `decisions-results.txt` section 2): over seeds 1 to 10,000 the fresh runner survives 3.33% pooled with no regeneration and 3.66% at 0.25 HP/s; the worst block of 1,000 on one line is 4.4% and 4.8%. And the decision changes nothing against today's game: with the 6-s combat timer the runs equal the 0.25 HP/s runs seed for seed, because the longest gap between two blows in any crossing is 0.97 s, and a survivor's crossing lasts at most 5.4 s after the first blow. The in-combat rate must stay 0.25. S1 asserts the seed-for-seed equality and the pooled rate. |
| Stage 2 gate, 40 hitpoints with Protect from Melee (must always pass) | 100% | 100% at every rate | Yes |
| Ordinary monsters cost the same on average (6.2, CALL-4.10) | Conservation rule within 5% | Unchanged: the in-combat rate is today's, so damage per kill is exactly what the conservation table measured | Yes |
| Boss proof (6.4) | First draft, no regeneration | New boss with 0.25 HP/s: A 98.9%, C 96.8%, B 0.0%, F 0.1%. Without it: A 98.3%, C 95.5%, F 0.1%. Regeneration is worth about one shark in a 100 s fight; it matters most to a hero with no food (D: 51% without, 72% with) | Yes. On the first draft's fight it moved the unprepared hero from 44% to 56%, one more reason that fight was re-tuned (6.4). |
| Rest between fights | 0.25 HP/s | 1.0 HP/s: a quarter of the waiting | Stage 3's concern, see 6.10 |

`decisions-results.txt` (section 2) and `check-results.txt` (sections 2 to 4) hold the runs.

#### Food cooldown: kept

The owner's answer leaves the cooldown standing unless the new regeneration makes it pointless. It does not: in combat a hero regenerates 0.25 HP/s, and a shark every 1.8 s is 13.3 HP/s, fifty times that, at the cost of a third of the hero's attacks. Regeneration did not change in fights at all, so nothing about food changed.

What the numbers also say, plainly: the cooldown is **not** what the boss proof rests on. With no cooldown at all a hero who never moves still loses every fight (0.0%, 0.0% and 0.1% for melee, ranged and magic; `check-results.txt`, section 5), because marked blows kill in one hit and no meal answers that. The cooldown's job is smaller and still real: it makes eating a decision with a price (a swing lost, and no second meal for 1.8 s), which is what gives food a measurable job in a long fight (fighter D against A: 72% against 99%) without letting a full backpack be poured in during one volley. It stays.

#### The cost of dying: experience, with a blessing

**Decided by the owner, 2026-11-14 (CALL-4.6):** the Ragnarok approach, plus the possibility of a Tibia-style blessing. The coin fee, the grave and the repair options of the first draft are withdrawn.

**The three approaches the owner compared.** The owner's answer names Ragnarok and Tibia; the third game is assumed here to be RuneScape, the one this game descends from. Techniques only: no number is quoted from memory except Ragnarok's 1%, which the owner's brief gives.

| Game | Technique | Fits here? |
|---|---|---|
| RuneScape (old school) | Items are at stake: the most valuable few are kept, the rest wait at the place of death and are reclaimed against time or a fee. | No. It needs items on the ground or a grave, which do not exist (a Stage 2 non-goal), and it can lose a player's gear for good. |
| Tibia | Experience and skill progress are lost, and carried items can be; blessings bought in advance with gold reduce the loss and are used up by the death. | Half. The item loss does not fit, for the same reason. **The blessing does**: a recurring gold sink the player chooses, with no new system. |
| Ragnarok Online | A small share of experience is lost, 1% of the current level's span, and never a level. No item, no coin. | **Yes.** One pure function on fields that are already saved; nothing can be lost for good. |

Borrowed: the two techniques. Nothing else: the blessing's name, text and place are this game's own (6.9).

**The rule.**

- On death, **each fighting skill** (Attack, Strength, Defence, Hitpoints, Ranged, Magic) loses `min(floor(xp - OSRS_XP_TABLE[L]), floor(DEATH_XP_SHARE x span(L)))`, where L is its level and the span of level L is `OSRS_XP_TABLE[L + 1] - OSRS_XP_TABLE[L]`. Both terms are floored, so the loss is a whole number even for a save holding fractional experience, and never takes the skill below `OSRS_XP_TABLE[L]`.
- **A skill at level 99 loses nothing** (second-pass change). There is no level 100 and experience is not capped (`getLevelForXp`, `skills.ts` 16-22; `grantXp`), so experience past 99 buys nothing: it shows only in the skill's tooltip and the total. The first revision charged such a skill 3% of the span of 98 to 99, 36,864 points, which made one unprotected death at all-99 "about 230 kills" and the vow 147,460 coins, for experience that does nothing. A skill at 99 is now outside the loss and outside the vow's price. This is the lead's proposal, not settled: it also means a maxed hero has no death cost and no gold sink, which is where gold piles up (CALL-4.17 d).
- **Never a level.** The loss cannot go below the level's first point of experience, so no level, no maximum hitpoints and no equipment requirement ever changes. A hero who has just levelled loses next to nothing in that skill.
- **No loss below combat level 15**, so the first hours do not punish. (Chickens and goblins are also the two camps that never attack first.)
- **No item and no coin is lost**, in the backpack or the bank.
- `DEATH_XP_SHARE` is **3%** (recommended; the table below shows 1%, 3% and 5%; CALL-4.17).

**Why every fighting skill pays, and not only the one in use.** "The skill in use at death" can be dodged: a hero about to die switches to a style it never trained and loses nothing. It is also unclear for the controlled style, which trains three skills at once. With every fighting skill paying its own share, there is nothing to switch to, and an untrained skill pays next to nothing by itself (3% of level 1's span is 2 points). Prayer is left out: it is trained by burying bones, which are items, and the rule is that death takes no item. Gathering and crafting skills are left out: a death in a fight has nothing to do with them.

**What a death costs.** A melee hero in the controlled style (Stage 3's fighter), Attack, Strength and Defence equal, halfway through each level, at the normal experience rate, fighting the monster Stage 3's model fights at that level. "Kills to earn it back" is kills of that monster until the slowest skill has re-earned its loss. Coins per kill are Stage 3's figures after its changes (coins plus dropped gear sold, no bounty). From `decisions.ts` on the game's real experience table (`decisions-results.txt`, section 1):

| Attack, Strength, Defence | Combat level | Monster | Kills for one level | Experience lost at 3%, all skills | Kills to earn it back at 1% / **3%** / 5% | Lantern Vow at 3% | The vow, in kills of coin |
|---|---|---|---|---|---|---|---|
| 12 | 14 | King Scorpion | 9 | 0 | 0 / **0** / 0 | not offered | |
| 20 | 23 | Hill Giant | 9 | 68 | 0.1 / **0.3** / 0.5 | 250 coins (the floor) | 1.2 |
| 30 | 34 | Hill Giant | 24 | 180 | 0.2 / **0.7** / 1.2 | 250 coins | 1.2 |
| 40 | 46 | Hill Giant | 63 | 484 | 0.6 / **1.9** / 3.2 | 488 coins | 2.4 |
| 50 | 57 | Hill Giant | 170 | 1,305 | 1.7 / **5.1** / 8.5 | 1,309 coins | 6.5 |
| 60 | 69 | Moss Guardian | 282 | 3,513 | 2.8 / **8.4** / 14.1 | 3,517 coins | 8.2 |
| 70 | 80 | Lesser Demon | 473 | 9,456 | 4.7 / **14.2** / 23.6 | 9,460 coins | 9.9 |
| 80 | 92 | Lesser Demon | 1,272 | 25,454 | 12.7 / **38.2** / 63.6 | 25,458 coins | 26.7 |
| 90 | 103 | Lesser Demon | 3,425 | 68,514 | 34.2 / **102.7** / 171.2 | 68,518 coins | 71.8 |
| 99 | 113 | Lesser Demon | 7,562 | 0 (a skill at 99 loses nothing) | 0 / **0** / 0 | 250 coins (the floor; it guards 4 points of untrained Ranged and Magic) | 0.3 |

Reading it:

- Because each level's span is about 10% larger than the one before, a fixed share is nearly free in the middle of the game and real at the top. At 3%, a death at level 30 costs under one kill; at level 70 it costs 14 kills (a few minutes); at level 90 it costs about 100 kills. The first hours are protected twice: by the level-15 floor and by the curve.
- Ragnarok's 1% is very light here until the 80s. 5% makes a death at level 90 about 170 kills. 3% is the recommendation: felt from level 60, never a session's work.
- A hybrid hero, with Ranged or Magic trained as well, loses the same share in those skills too and earns them back by fighting in those styles. A hero who trains one melee skill at a time (the accurate, aggressive or defensive style) re-earns the three in turn: for equal levels, about three times the table's kills.
- **Saves at the 10x rate** lose the same experience and earn it back ten times faster: divide the kills by ten (level 70: 1.4 kills). For them a death is close to free, and the vow, whose price does not shrink, is not worth buying. This is not only the hidden fast mode: 10x is today's default and the button is visible today, and Stage 3 keeps every existing save at the rate it saved, including a save without the field (Stage 3 design section 8). So most characters that exist when Stage 4 ships are likely to run at 10x, and for them the gold sink barely bites. Scaling the share by the rate (30% of the span at 10x, still never a level) would make the work equal; it is offered in CALL-4.17, not adopted.
- **A pure mage, or any skill with no progress in its level, pays almost nothing in that skill**: the loss is bounded by the experience inside the level, so a skill that is never trained sinks at most to its level's floor and stops there, and no level or requirement ever moves. A pure mage still pays in Defence and Hitpoints, which every style trains. It can be annoying (Strength progress lost by a hero who no longer fights in melee) but never takes anything the hero relies on.
- The earn-back figures assume a hero halfway through each level. A hero in the first 3% of a level loses less (the bound); the price of the vow does not shrink with it.

**The blessing: the Lantern Vow** (an original name, 6.9).

| | Design |
|---|---|
| Where | Either altar. A click on the altar prays as today (free heal, unchanged). The altar's right-click menu gains "Take the Lantern Vow (N coins)". The engine has the menu today but not the entry: an interactive object offers one "Use <name>" entry that walks the hero there and acts on arrival by the object's `action` (`onGameContextMenu`, `input.ts` 297-315; the arrival branch, `loop.ts` 200-223). The vow entry walks the same way, carries a `vow` intent on the hero's target, and on arrival calls `buyVow` with the price recomputed then; it never buys from a distance. After a prayer, a hero who is eligible and holds no vow reads one chat line naming the price and the menu. |
| What it does | **Cancels the whole loss of the next death.** No partial cover: one clear rule, and a notice that needs one sentence. |
| How many deaths | **One.** The death spends it. A hero holds one vow at a time, so several deaths cannot be stockpiled. One vow can be carried across levels: bought at level 40 for 488 coins and spent at level 70, it covers a 9,456-point loss once. That one-time saving is accepted (keeping it exact would need the guarded amount in the save). |
| Price | **One coin for each point of experience it can guard**: the sum, over the six fighting skills below 99, of `floor(DEATH_XP_SHARE x span(L))`, and at least 250 coins. This is the most a death can take at the hero's levels, not what a death would take now: a skill just past a level-up, or one never trained, is charged in full. That is deliberate (otherwise a vow bought right after a level-up would cost the floor and cover a full loss later) and is why the wording is "can guard". It is a function of the hero's levels, so it grows with the hero, where equipment prices stop at the dragon kit. |
| Who can take it | A hero of combat level 15 or more who holds none and has the coins. Below 15 the altar says the hero risks nothing yet. |
| When it is spent | Only by a death that would have cost experience. A death below combat 15, or with nothing to lose, leaves it in place. A death that would have cost 1 point (every skill just past a level-up) spends a vow bought for thousands; whether a small loss should be waived and the vow kept is in CALL-4.17. |
| How the player sees it | A small lantern mark beside the hitpoint bar while the vow is held, with a tooltip; the altar's chat line when it is taken; the death notice when it is spent. |

**The gold sink, in numbers.** Stage 3 left "no recurring gold sink" to this stage (its 7.2). This is the sink. It is opt-in, paid in advance, and it scales:

- Compare the last two columns. From level 70 the vow costs about two thirds of the work the death would cost (9.9 kills of coin against 14.2 kills of experience). At level 60 the two are equal. Below that the vow costs more than the death, which is nearly free there anyway. So the sink starts to bite where gold starts to pile up: Stage 3's dragon kit is paid for by level 60. A player with coins to spare buys the vow; a player still saving for a kit weighs it. That is the choice the owner's answer describes.
- Against income: one vow is 5.3% of the coins a hero earns while gaining one level at 30, 3.8% at 40 and 50, 2.9% at 60, and 2.1% from 70 to 90. At all-99 there is nothing at stake and the vow is only its 250-coin floor. A hero who dies twice a level and always renews puts 4 to 8% of its coin into the altar from level 40 until its fighting skills reach 99. Under "nothing at 99" (CALL-4.17 d) the sink then stops, which is where gold piles up most; keeping the 98-to-99 span would keep it running for maxed heroes, at the price of charging them for experience that buys nothing. At the 10x rate the sink barely bites at any level (CALL-4.17 a).
- It cannot be made much larger by price alone: at 2 coins per point the vow costs more work than it saves at every level (1.4 times at level 70) and stops being bought. A larger sink needs a larger share (5% makes every figure above two thirds larger). The share, the price and the cover are the owner's (CALL-4.17).
- How large the sink is in play depends on how often players die, which no model here knows (section 15).
- Stage 3's pacing model has no deaths, so no kill count of its test can move.

**One new saved value.** A vow must survive a reload, or closing the page would either lose paid coins or, kept only in memory, never be lost at all. It is one optional flag, `quests.lanternVow`, beside the existing `quests.dragonfireWard`:

| | |
|---|---|
| Type and default | `lanternVow?: true` on `QuestFlags`. **Absent means not held.** `defaultQuests()` does not set it, so the serialised default state is byte for byte what it is today. |
| Why absent, not `false` | Stage 3 freezes two goldens of the serialised state (`default-state.golden.json`, `save-v4-loaded.golden.json`) and asserts the top-level keys. A new `false` in every save would force a fifth and sixth declared replacement. An absent key changes neither. |
| Writing | `serializeState` is not edited: it already writes the whole `quests` object, and `JSON.stringify` omits an absent key. `version` stays 4; the key `gielinor_hero_save_v1` is unchanged. |
| Reading | `normalizeQuests` gains one line: `if (data.lanternVow === true) quests.lanternVow = true`. Any other value (`false`, `1`, `"true"`, `null`, an object) is ignored. It is not added to the boolean `flags` list, which would turn a saved `false` into a present key. |
| Existing saves | Have no such key: they load exactly as today, with no vow. |
| Rollback | A save holding a vow, loaded in the build before Stage 4, loads; the old reader drops the unknown key, so the vow is lost. Accepted. |
| Tests | In `tests/sustain.test.ts` (new): a state with the vow survives `writeSave` then `readSave`; the default state serialises with no `lanternVow` key and equals today's serialisation; the Stage 1 fixture `tests/fixtures/save-v4.json` loads with no vow; each of `false`, `1`, `"true"`, `null` and `{}` loads as not held; a state that took and then spent a vow serialises with no key (the flag is deleted, not set to `undefined` or `false`). Unedited and still passing (second pass, read against the code and Stage 3's plan): Stage 3's two goldens and its "same keys as the default golden" test (P1); Stage 3's `no new saved field` test in `tests/starter-quests.test.ts`, which compares the keys of `defaultQuests()` with the golden's `quests` (K1), true because `defaultQuests` is not edited; Stage 2's `tests/save-relocation.test.ts` golden (`fixtures/save-relocation/v4-loaded.json`) and its top-level `SAVE_KEYS`. Stage 3's plan rule 0.3.11 ("`QuestFlags` and `normalizeQuests` gain nothing") binds Stage 3's own tasks and its gate (G-5 step 7 diffs `types.ts` against `main` before Stage 4 exists); Stage 4 changes both files after that gate, which is a change of that rule's scope, not a breach, and is stated here so R0 does not mistake it for one. |

**How a field could be avoided, and why it is not.** The vow could be an item in the backpack: items are already saved and validated. It was rejected: an item has one fixed price and can be sold back, where the vow's price follows the hero's levels; the shop lists every item, where the vow belongs to the altar; it would take one of 28 slots or sit in the bank doing nothing; and a new item id is itself a declared edit of Stage 3's `content-freeze`. One optional flag is smaller.

**The death notice tells the truth in every case.** `deathNotice(outcome?)`; the title is always today's. Gear and coins are kept in every case, so today's sentence stays true and stays first.

| Case | Body |
|---|---|
| No argument; combat level below 15; or no fighting skill had any experience inside its level | Today's text, unchanged: "You keep your gear and coins. You will wake in Lumbridge Haven." Nothing was lost, and a held vow is not spent. |
| A vow was held and there was something to lose | "You keep your gear and coins. Your Lantern Vow held: no experience was lost, and the vow is spent. You will wake in Lumbridge Haven." |
| No vow, experience lost | "You keep your gear and coins. You lost N experience across your fighting skills; no level was lost. A Lantern Vow, taken at an altar, would have kept it. You will wake in Lumbridge Haven." N is the true total. |

The frozen test calls `deathNotice()` and asks for "dead" in the title and "Lumbridge" in the body: both hold in every case.

**The functions**, all pure, in `src/state/sustain.ts`: `deathLoss(state)` returns the loss per skill (zero below combat 15); `applyDeathLoss(state)` returns the outcome (`none`, `vow` or `lost` with the amounts) and either spends the vow or subtracts the experience, and it asserts that no level changed; `vowPrice(state)`; `buyVow(state)` checks level, holding and coins and pays through Stage 3's `creditGp`. `applyRespawn` is not edited. `handlePlayerDeath` calls `applyDeathLoss` once (it already guards re-entry, `actions.ts` 362) and keeps the outcome until the respawn: `finishRespawn` prints the notice again in chat (`actions.ts` 392, `deathNotice()` with no argument today), and without the stored outcome that line would say nothing was lost right after a loss. Dying on purpose as a way home costs exactly the loss or the vow, so the vow adds no cheaper teleport; below combat 15 a death was and stays free, as today. Closing the page in the two seconds between a death and the next autosave avoids the loss; that is accepted, as cheating is not a boundary here (12.1).

**Auto-retaliation (owed by Stage 2, CALL-4.7).** When a monster's attack lands and the hero has no target, no walk in progress and no key held, the hero targets that monster. A hero who is gathering, walking or already fighting is never redirected. **Never while any monster fighting the hero has a live wind-up**: a hero who has just stepped out of a shape stands idle, and without this guard the next basic from another monster would walk it straight back into the shape. No setting. Without it, an aggressive camp beats on a hero who stands and takes it, which reads as a bug.

### 6.7 Sound (G4.7)

**Today** (`audio.ts`): one `tone(freq, type, duration, vol, slideTo)` that starts an oscillator now; sequences use `setTimeout` (lines 71-84), which drifts with frame load; every tone connects straight to the output, so several at once clip; the `catch` is empty; the context is created on the first sound and `resume()` is called blindly (line 37). Mute is `STATE.audioEnabled`, checked in `tone` (line 48).

**Design.**

- **A cue is data.** `src/state/soundPlan.ts` (pure) turns an event into a list of voices: `{ at, kind: 'tone' | 'noise', freq, slideTo, type, dur, vol }` with `at` in seconds from now. Tests read the plan. `audio.ts` only plays plans.
- **Scheduled on the audio clock.** `tone` takes a start offset and uses `ctx.currentTime + at`, which removes the `setTimeout` drift inside a cue. The wind-up cue is the rising part only, planned to end at `windupMs`; the impact (thump, bell, roar) is played on the `resolve` event, in the same frame as the drawn impact. Pre-scheduling the impact would not land on the hit: below 12.5 FPS the step cap makes rules time run slower than the audio clock, so a pre-scheduled thump would come early by up to a second at 8 FPS, and wireless headphones add 100 to 300 ms of output delay that no schedule can see. At normal frame rates the rise ends within a frame of the impact.
- **Noise.** One cached one-second white-noise buffer through a band-pass filter gives impacts and fire a body that oscillators cannot.
- **A master chain.** Every voice goes through one gain and one `DynamicsCompressor` used as a limiter. At most 12 voices sound at once; a new one past that is dropped, except a wind-up or impact cue, which may take the count to 16 (the camp gate of 6.2 allows one wind-up per camp).
- **Mute** stays one check in one place, and also stops the heartbeat. Muting also ramps the master gain to 0 within 20 ms, so voices already scheduled (a wind-up rise lasts up to 2.0 s) fall silent at once.
- **Autoplay.** The context is **created**, not only resumed, inside the first pointer, key or touch event: Chrome logs a warning when a context is created before a gesture. The listener stays armed while the context is not `running`, because Safari can suspend or interrupt a running context later (a call, a tab switch). While it is not running, cues are dropped, not queued, so nothing stale plays on the first click. When the tab is hidden the loop stops, and the heartbeat with it.
- **The empty `catch` goes.** A failure to create the context is logged once and sound stays off.

| Cue | When | Sound, in words | Carries |
|---|---|---|---|
| Wind-up, `low` | melee heavies | A square tone rising a fifth over the wind-up; a noise thump on the resolve event | When to be gone |
| Wind-up, `mid` | ranged heavies | A triangle tone rising, three ticks in the last 450 ms | The same, and "ranged" |
| Wind-up, `high` | magic heavies | A sine with vibrato rising an octave, a bell at the resolve | The same, and "magic" |
| Wind-up, `fire` | boss fire | Filtered noise swelling, a roar at the resolve | The same, and "fire" |
| Impact dealt | the hero's hit | Today's `hit`, plus a short noise click; pitch falls with damage / max hit | How hard |
| Heavy taken | a telegraphed hit lands on the hero | A low thump and a falling tone | "That was avoidable" |
| Dodged | a resolve that misses | A soft whoosh | "That worked" |
| Phase change | boss `phase` | A low drum, then three falling notes, 1.2 s | Something new is coming |
| Boss down | boss `died` | A rising chord, 1.5 s | |
| Low health | hitpoints under 25% | Two soft thumps every 1.2 s, quieter than everything else | Eat |
| Food ready | the cooldown ends while hitpoints are under 50% | One short blip | You can eat again |

Every cue has a picture that says the same thing: sound is never the only carrier.

### 6.8 The roster: prepared slots (G4.9)

The Stage 3 model found no monster between level 28 and 45 (its F12: 4,262 of 4,614 kills are hill giants), and a second hole from 45 to 68. The roster of slots is the table below, kept in this design and copied to the README's monster table (W4). It is not a code module: a `ROSTER_SLOTS` constant that nothing in the game reads would only add a file and a test that hold a document in step with itself (cut by the critique). What makes a slot "prepared" in code is the data shape: a new monster is a `MONSTER_TYPES` row with `pattern`, `model`, `tint` and `modelScale`, a camp row and, for a captain or a boss, a `BOSSES` row. No function is written for it.

**Reusing a model** needs two small changes: `MonsterDef` gains `model?: string` (the mesh builder, the `Monster_<key>` node lookup, the albedo and the limb poses read it instead of the type key; `createMonsterMesh` 776-791, `upgradeMonsterRigWithGltf` 76-78, `poseMonsterLimbs` 813-843), `tint?: number`, multiplied into the material colour, because the GLB's own colours override `bodyColor` (`blenderMonsters.ts` 104); and `modelScale?: number`, multiplied into the rig group's scale after the builder runs. The last is needed because size is not uniform today: most builders scale the group by `def.scale` (`monsterMeshes.ts` 140, 312, 386, 443), the scorpion's is fixed at 1.28 (line 245), and the GLB upgrade resets the clone to 1 and keeps the group (`blenderMonsters.ts` 84, 143-151). The hitbox is a child of the group, so it grows with it. The "scale" figures in the table below are `modelScale` relative to the reused monster.

| Slot | Level | Role | Pattern | Model | Camp (proposal) | Status |
|---|---|---|---|---|---|---|
| **Saltback Stalker** | 34 | Melee skirmisher | basic x3, Tail Lash | scorpion, 1.4 times its size, dark tint | Dunes, south-east of Tamarisk Pool; 3 members | **Ship now** (CALL-4.8) |
| **Thornwatch Marksman** | 38 | Ranged, holds ground | basic x3, Pinning Volley | dark ranger, 1.1 times its size, green tint | North of Lanternway, outside the `woods` region (inside it, Stage 5's tree table would have to clear a third camp); 2 members | **Ship now** (CALL-4.8) |
| Cinder Adept | 52 | Caster | basic x3, Hexfall | dark wizard, tint | Outside Cinderstep Pass | Prepared |
| Slag Brute | 58 | Heavy melee | basic x2, Overhead Slam, Rootquake | hill giant, tint | Inside the ridge, off Cinder Stair | Prepared |
| **Ashmantle the Slag Wyrm** | 110 | Boss, three phases | a `BOSSES` row (6.4) | the dragon, 1.2 times its size, ash-grey tint | South-west volcanic corner, (-102, 54); 1 member | **Ship now** (owner's decision, CALL-4.4) |
| Camp captain (unnamed) | 40 | Elite: one per camp, more hitpoints, a two-phase row in `BOSSES` | to be designed | **new model** | A giant or guardian camp | Prepared |
| Swarm creature (unnamed) | 30 | Many weak bodies, no heavy | basic only | **new model** | Dungeon | Prepared |
| Dungeon boss (unnamed) | 80 | Boss, three phases | a `BOSSES` row | **new model** | Dungeon | Prepared |

Why these two ship (accepted by the owner, CALL-4.8): they close the hole the pacing model measured, they cost no model and no bytes, and each reuses a pattern the player has already met. Why the rest wait: the 52 and 58 slots sit behind the pass where four sentries already stand, and their drops would be Stage 3's rune-to-dragon economy; the last three need a silhouette no existing model has (a captain must read as a leader at a glance; a swarm needs a small fast body; a dungeon boss must not be a third dragon: the owner asked for a dragon boss with mechanics, 6.4 builds it from the dragon's own mesh, and that reuse is now spent). A new model is justified only when the silhouette carries the role, and each costs a Blender build, roughly 100 to 300 kB and a credit line. None is spent in Stage 4.

**Stats of the two shipped monsters**, interpolated by level between the hill giant (28) and the moss guardian (45), `catalog.ts` 460-468; the marksman's hitpoints and defence are set below the line (54 and 26 against 66 and 31) because it fights from range:

| | Level | HP | Max hit | Attack | Defence | Style | Drops |
|---|---|---|---|---|---|---|---|
| Saltback Stalker | 34 | 58 | 12 | 32 | 28 | melee | big bones; 140 to 340 coins (95%); lobster (40%) |
| Thornwatch Marksman | 38 | 54 | 13 | 36 | 26 | ranged | big bones; 160 to 400 coins (95%); bronze arrows; swordfish (30%) |

No equipment drops, no bounty band, no quest step: those are Stage 3's and Stage 6's. The coin ranges sit on the line between the giant's and the guardian's. See 6.10 for what this does to Stage 3's test.

### 6.9 New names (CALL-4.9)

All original proposals. None contains a token from the Stage 2 deny-list (`tests/names.test.ts`); a test enforces that, and a person searches each before merge, as in Stage 2. The first draft's "Thornwatch Archer" contained the deny-listed token `archer` and is now "Thornwatch Marksman".

| Kind | Names |
|---|---|
| Attacks | Tail Lash, Hexfall, Pinning Volley, Overhead Slam, Rootquake, Scorch Lane, Ember Cone, Tail Sweep, Slag Rain, Ashen Nova, Slagburst |
| Boss | Ashmantle the Slag Wyrm (key `ashmantle`); its title, Ashbreaker |
| Boss phases | Grounded, Rain of Slag, Fury |
| Blessing | Lantern Vow |
| Monsters shipped | Saltback Stalker, Thornwatch Marksman |
| Monsters prepared | Cinder Adept, Slag Brute |

The special attack named after another game's hero keeps its name, and so does the existing dragon: renaming existing content is the foundation design's open question Q2 and the owner's Stage 8, only if the owner decides. The critique's CALL-4.15 (rename the dragon, because new banners would print its borrowed name) is settled by the owner's decision on the dragon: the phase banners and the boss bar belong to the new boss and show its name, and no new line prints "Elvarg". The boss is a "wyrm" because `dragon` is itself on the deny-list. The blessing borrows a technique, not a name: nothing here is called after, or modelled on, a blessing, shrine or boss of RuneScape, Tibia, Ragnarok or Zelda.

Second pass, from recall only (to be confirmed by the search of O-4.7): no new name hits the deny-list (checked by script against the 81 tokens of `tests/names.test.ts`), and none is known to be a name in those four games, with three single generic words that are: **"Wyrm"** is a monster in Old School RuneScape and a creature in Tibia, and the boss is "the Slag Wyrm" in a game that descends from RuneScape; **"Fury"**, the name of phase III, is a Tibia creature; **"Stalker"** is a Ragnarok Online class. Recommendation in CALL-4.9: rename the phase (for example "Last Embers") and the boss's epithet (for example "Ashmantle the Slagborn"), keep "Saltback Stalker", whose words are ordinary English and whose whole is original.

### 6.10 Dependencies on Stage 3 and Stage 5

Nothing here re-tunes an economy number. These are the places where Stage 4 leans on Stage 3 or changes one of its inputs:

| Stage 3 item | Stage 4 effect | Handling |
|---|---|---|
| Pacing test (its 5.3): kill counts on routes A1 and A3 | Ordinary monsters: unchanged expected damage (6.2), and regeneration in a fight is today's rate, so damage per kill is exactly today's. Two new monsters at 34 and 38 may replace part of the giant plateau in the printed table. | R0 and the gate re-run the pacing test. Its assertions are order and loose floors and are expected to hold. If one fails because of the two monsters, the task stops and reports: the owner has decided they ship, so the answer is a change to their rows (coins, hitpoints) agreed with Stage 3, not leaving them out. |
| Its model's rest between fights (its 4.2: rest at 0.25 HP/s) | Out of combat the hero now regenerates at 1.0 HP/s. Stage 4 does **not** change `HP_REGEN_PER_SEC`: it stays 0.25 and is the in-combat rate; the resting rate is a new constant. So Stage 3's model, as written, does not move. It is then pessimistic about rest. | Measured with a copy of Stage 3's committed model (`pace2.py`, `tasks.py`) with only the rest rate changed to 1.0: levels arrive 2 to 4 kills earlier (iron's at kill 35, not 38); route A1's further kills are 95, 243, 297, 312, 392 (floor 25); on route A3 the iron kit is complete at kill 76, not 113 (41 further kills, floor 1); order holds. Every assertion that reads a kill count holds on every route that model prints (A1, A3, both controls, markups 8 and 12, and 10x, where the further kills from steel to rune are 122 to 595 against a floor of 25). R0 re-runs the real test; whether its model's rest follows the new rate is Stage 3's to decide. Fallback if an assertion ever moves: lower the resting rate toward 0.25, where the game is today's. |
| "Can win" in its model (its 4.2): the attackers' combined max hit is below max hitpoints | A heavy is worth two blows, so a camp's worst single moment rises from N to N + 1 max hits: the camp wind-up gate (6.2) allows one heavy per camp at a time. | Stated here. The pacing test's assertions do not read it; the printed table may show a camp taken on slightly later. |
| The dragon in its model | **None.** The existing dragon is not edited. | |
| The new boss in its model | A new type its fighter could choose. It never does: the model's fighter has no prayers and must expect to lose at most 60% of its hitpoints in one kill, and the boss's basic max hit is 72 over a 100 s fight. | R0 runs the pacing test with the boss's row and camp in place. If an assertion moves, the boss's reward table (6.4, Stage 3-tuned) is the lever. |
| `content-freeze` test (its G3.9): the set of monster type keys, and every name | Three keys are added. No existing name changes. | A declared replacement (9.3): the list gains exactly `saltback_stalker`, `thornwatch_marksman` and `ashmantle`. |
| Its two save goldens and "same top-level keys" (its section 8) | One optional flag, `quests.lanternVow`, absent by default. | Neither golden changes and no top-level key is added (6.6). Both tests must pass unedited. |
| `HP_REGEN_PER_SEC`, `creditGp`, `monsterHitChance`, `playerAttackProfile` | Used, not changed. | R0 confirms the names. |
| The dragon as income (its F13): 35% gear drops, back in 8.35 s | **Not changed**, by the owner's decision on the dragon. Stage 3 already cut the drop rate. | Returned to the ledger as declined (section 11). The new boss is no income route: about 10 coins a second against about 150 from demons (6.4). |
| "No recurring gold sink" (its 7.2, 6.5) | The Lantern Vow (6.6): one coin per point of experience guarded, 2 to 5% of a level's coin per vow. | Closed here. Its pacing model has no deaths, so no count moves. |
| Ranged and magic ladders (its section 10) | Not designed here. The boss fight shows the gap: prepared ranged and magic heroes finish in 61 s and 47 s against 103 s for melee, because their damage in today's item tables is about twice a melee hero's. | Deferred again (section 11). |

Stage 5: effects are built from primitives Stage 5 may reshape; every timing, size and count is in `attacks.ts` and `feel.ts`, which Stage 5 does not touch. Stage 5's task TR2 (trunks) depends on 6.1.

### 6.11 Module boundaries

| Module | Change |
|---|---|
| `src/data/attacks.ts` (new) | `AttackDef`, `ATTACKS`, `PATTERNS`, `BossDef`, `BOSSES`, `TELEGRAPH_TIME_SCALE`, `CADENCE_SECS`, `CAMP_WINDUP_GAP_SECS`. Types and constants only. |
| `src/data/feel.ts` (new) | Hit stop, flash, flinch, knock-back, camera and vignette numbers; the tier table of section 10 as data (read through today's `currentQuality`, `renderer.ts` 13). |
| `src/data/world.ts` | `MonsterDef` gains `pattern`, `model`, `tint`, `modelScale`; three new rows (two monsters, the boss). `catalog.ts` is not edited, so the existing dragon's row is untouched. |
| `src/data/worldMap.ts` | Three camps (two monsters, the boss's arena at (-102, 54)); `CampDef` gains `arenaRadius?`. The existing dragon's camp is not edited. |
| `src/state/telegraph.ts` (new) | `inShape`, `escapeDistance`, `minWindupMs`, `shapeOutline` (the polygon the engine draws). |
| `src/state/pathfind.ts` | Scratch arrays; `maxExpanded`; `openStart`; `segmentWalkable` exported. |
| `src/state/collision.ts` | `moveWithCollision` takes an optional walk test. |
| `src/state/monsterAi.ts` | Routes (6.1); patterns, wind-up, resolve, cancel, the camp wind-up gate and `tickWindupGates` (6.2); phases, gate, shift, arena (6.4); boss respawn time. New events `windup`, `resolve`, `cancel`, `phase`. |
| `src/state/combat.ts` | `rollMonsterAttack(typeKey, attack, state, marks, rand)` for heavies; the mark rule (`addMark`, `tickMarks`, `markMultiplier`). `rollMonsterHit` is not edited. |
| `src/state/sustain.ts` (new) | `canEat`, `eat`, `drink`, `regenRate(sinceCombatSecs)` and the two rates, `deathLoss`, `applyDeathLoss`, `vowPrice`, `buyVow`, `shouldRetaliate`. Time is a parameter. |
| `src/state/adventure.ts` | `deathNotice(outcome?)`; `isBossLoot` is also true for a type with a `BOSSES` row; `registerKill` writes a boss's `title`. |
| `src/state/quests.ts`, `src/state/types.ts` | `QuestFlags.lanternVow?: true`; one reader line in `normalizeQuests` (6.6). `save.ts` is not edited. |
| `src/state/commands.ts` (new) | The `PlayerCommand` union and the pure `applyCommand` for the five commands that only change game state (section 7). |
| `src/state/soundPlan.ts` (new) | Event to voices (6.7). |
| `src/engine/telegraphs.ts` (new) | Shape meshes: create, fill, dispose. |
| `src/engine/reactions.ts` (new) | Hit stop, flash, flinch, knock-back, camera kick, low-health vignette. |
| `src/engine/audio.ts` | Clock scheduling, noise, master chain, voice cap, `play(plan)`, resume listener. |
| `src/engine/actions.ts`, `loop.ts`, `input.ts`, `spawns.ts`, `monsterMeshes.ts`, `blenderMonsters.ts`, `context.ts` | Wiring: events to effects; the frame's path budget, rotation, wind-up gates and grid passed to `stepMonster`; commands dispatched; a click on the current target while already in reach acts as a ground click (6.4, run in); `model`, `tint` and `modelScale`; the altar's menu entry for the vow; the combat timer for regeneration; the spin fix. `overlay.ts` reads the model key for the dragon-sized minimap dot and label. |
| `src/ui/playerActions.ts`, `hud.ts`, `styles.css`, `index.html` | Combat actions go through commands; cooldown on food slots; boss bar with phase pips and marks; the lantern mark of a held vow; two splat kinds; the vignette element. |
| `README.md` | The combat section and the monster table. |

`src/state` and `src/data` still import nothing from the engine (the architecture test stays).

---

## 7. Ready for dungeons and co-op, without building either (G4.10)

**What the design gives.**

- **Rules are pure and parameterised.** `stepMonster(m, world)` takes the grid, the camps, the target, the clock step and the random source as arguments. `rollMonsterAttack`, `inShape`, `eat`, `deathLoss` take state and return results.
- **Content is tables.** A dungeon boss is a `BOSSES` row, some `ATTACKS` rows and a `PATTERNS` list. No function is written for it.
- **Player actions are explicit commands.** `PlayerCommand = { kind: 'attack', targetId } | { kind: 'move', x, z } | { kind: 'eat', slot } | { kind: 'drink', slot } | { kind: 'prayer', id } | { kind: 'style', style } | { kind: 'special' }`. Five of the seven only change game state (`eat`, `drink`, `prayer`, `style`, `special`); for them `applyCommand(state, cmd, clocks, now)` is pure and does the whole job, checks and effect, returning `{ ok, reason, restored? }`. A second player's command runs through the same function on that player's state. `move` and `attack` set the hero's route and target, which are engine state; for them the engine checks and applies. One engine function, `dispatchCommand`, is the only place the mouse, the keyboard and the HUD reach combat state from. Monsters get a stable `id` at spawn so a command can name one. (The first draft had a pure `validateCommand` and an engine-side apply for all seven, so nothing a second player needs was actually pure; the critique merged validate and apply for the five.)

**How a dungeon instance reuses it.** An instance is a walk grid, a camp table and a monster list. `buildWalkGrid(walkable)` already takes the walk test as a parameter (`pathfind.ts` 10); with 6.1, monsters move by `world.grid.walkable`. The loop would call `stepMonster` with the instance's grid and camps. Shapes, phases, sound and reactions do not know which world they are in.

**How a second player reuses it.** A second player is a second source of `PlayerCommand`s and a second target. Shapes are tested against a position, so the resolve can be asked once per player. The mark, cooldowns, the vow and the death loss are per state.

**What in today's code blocks that, and what this stage does about each.**

| Blocker | Where | In Stage 4 |
|---|---|---|
| One player in the rules: `StepWorld` carries one `playerX`, `playerZ`, `playerCombat`, `playerSafe` | `monsterAi.ts` 38-47 | Not changed. New code reads the target only through those four fields, so replacing them with a chosen target later is one edit. Target choice (threat) is a co-op design of its own. |
| Singletons: `STATE`, `player`, `G` | `gameState.ts` 89, `context.ts` 43, 218 | Not changed. Every new rule takes state as a parameter and never imports `STATE`. |
| Random numbers taken from `Math.random` inside engine code | `actions.ts` 181-182, 290-292, 427; `loop.ts` 580 | The engine remains the one that injects it. New rules take `rand`. A seeded source per session is a co-op need, deferred. |
| Damage applied from projectile `onImpact` closures, so the effects list owns rule timing | `actions.ts` 251-255, 337-355 | Telegraphed damage is resolved by the rules clock, never by an effect. Basic ranged and magic hits keep their closures. Deferred, with this note, to the co-op stage. |
| The player's attack formulas live in the engine | `actions.ts` 83-264 | Stage 3 moves hit chance and the attack profile out. What remains (the special, XP by style, heals) stays. Deferred to the co-op stage. |
| Movement checks the global world | `moveWithCollision` reads `isWalkable` (`collision.ts` 97-105) | Monsters use the injected grid (6.1). The hero's own step is unchanged. |
| Per-monster code keyed on the type name | `createMonsterMesh`, `poseMonsterLimbs`, `performMonsterRetaliation` 342-358, `rollMonsterHit` 226 | `model` separates look from type. Projectile choice per type stays a `switch`; it is cosmetic. Dragonfire stays a dice rule of the existing dragon alone, keyed on its type as today (the owner's decision); the new boss uses patterns and has no rule of its own in code. |
| UI handlers mutate state directly | `playerActions.ts` 132-275 | The seven combat commands go through `dispatchCommand`. Shops, bank and forge do not; they are not combat. |
| Monster state is not saved; the world is rebuilt on load | foundation design section 7 | Unchanged. An instance would need its own lifetime rule. |

---

## 8. Save format impact and performance budget

**Saves.** Key `gielinor_hero_save_v1` and `version` 4 are unchanged, and `serializeState` is not edited. One new saved value: the optional flag `quests.lanternVow`, written only while a vow is held and absent otherwise (6.6 gives its default, reader rule and tests). Existing saves have no such key and load exactly as today. Cooldowns, marks, phases, the combat timer and monster state live for the session, as monster state does today. A death changes skill experience and a vow changes `gp`; both are already saved. A save written after Stage 4 loads in the build before it; a held vow is dropped by the old reader.

Accepted limits, because monster state is not saved. Reloading the page brings a dead boss back at once, skipping the 120 s; the fight (about 100 s in melee, 47 to 61 s with magic or a crossbow) stays the gate. Reloading in the middle of a fight puts the boss back at full health in phase I and the hero where the last autosave left it, with the food it had eaten gone: a loss for the player, not a way around the fight. Saving a boss timer would be the first world state in the save; that belongs with Stage 6's save changes.

**Budget.** No frame time has ever been recorded on a real GPU (Stage 5, section 10). Counters and counts are binding; milliseconds are estimates except where marked measured.

| Measure | After Stage 2 | After Stage 4 |
|---|---|---|
| Monsters | 36 | 42 (five in two new camps, and the boss) |
| Path searches per frame, monsters | 0 | at most 2 |
| Cost of one search | 0.5 to 0.7 ms (measured, allocation-bound) | follows expanded cells; mean 120, cap 6,000 |
| Allocation per search | four 55,696-cell arrays | none after the first |
| Straight-segment tests | none | at most one per chasing monster per 0.5 s, about 52 array reads each |
| Live telegraph meshes | 0 | one shape per camp in the fight (the camp gate) and one for the boss, which has one wind-up at a time; two meshes per shape (band outline, fill), 1 draw call each, under 400 triangles each |
| Draw calls added in a fight | | at most 8 |
| Sound voices | unbounded | at most 12 |
| DOM nodes added | | boss bar (1 block), vignette (1), lantern mark (1), cooldown overlays (up to 28 small) |
| JS bundle | 946.86 kB at the Stage 2 gate | at most 30 kB more |
| Audio or model files added | | 0 bytes |
| Per-frame allocations in new code | | none in the monster step; effects reuse scratch vectors |

---

## 9. Verification

### 9.1 Headless, in vitest

| Goal | Proof |
|---|---|
| G4.1 | `tests/monster-routes.test.ts`: a monster reaches a player behind a wall that a straight walk cannot pass; it walks straight when the segment is open and makes no search then; it re-paths at most every 0.5 s; a spent budget makes no search and still moves; a search past `maxExpanded` returns `null` and leads to `return`; a route longer than 52 leads to `return`; from 200 seeded points per camp, `return` reaches `idle` at full hitpoints within route time + 3 s; with the home walled in on a test grid it is put home when the clock runs out; a monster held on a corner of a route takes an escape cell within `STALL_SEC`; with the quota at 1 and three monsters asking every frame, each is served within three frames (rotation); `pathGoal` is the target's position at planning, so a monster chasing a standing target asks for no new route; without a grid, movement equals today's step for step (no route, no `returnLeft`, no wander re-draw). `tests/pathfind-budget.test.ts`: a second search allocates no new typed array; results equal the first implementation's on 200 seeded pairs; expanded cells around every camp stay under the cap. `tests/world-data-combat.test.ts`: every home cell is open; a route exists to every home from every open cell within leash + 11. |
| G4.2 | `tests/telegraph.test.ts`: `inShape` for each of the four shapes at the edge, inside and outside, and after rotation; `shapeOutline` is closed and contains exactly the points `inShape` accepts on a sample grid. `tests/monster-patterns.test.ts`: a patterned monster emits basic, basic, basic, `windup`; nothing is dealt during the wind-up; `resolve` comes `windupMs` later with `hit` true for a target that stayed and false for one that left; the next attack comes `slots x 1.65` s after the wind-up began; death, every T5 cause (leash, target beyond 26, target down, target safe in an aggressive camp) and phase shift during a wind-up emit `cancel` and no `resolve`; with a shared gate, two members of a camp never wind up at once and the second waits at least 1.65 s after the first resolves, playing basics meanwhile, and its expected damage over 10,000 s is unchanged within 5%; a type without a pattern emits exactly today's events (the frozen cadence tests are the control). |
| G4.3 | `tests/attack-data.test.ts`: every row satisfies `windupMs >= minWindupMs(row) + 200`; every recovery is at least 150 ms, checked for every boss phase at that phase's cadence; every ordinary pattern (`PATTERNS`) and every boss's first phase starts with `basic`, and every pattern names existing attacks; no wind-up is under 1,100 ms; the conservation rule holds in expectation for every ordinary pattern (seeded, within 5%); every monster's `pattern` exists. |
| G4.4 | `tests/boss-phases.test.ts`: hitpoints cannot pass a threshold in one hit; overflow is lost; the boss takes no damage during `shiftMs` and says why; `phase` is emitted once per threshold; the pattern restarts at its first entry; phase III uses the faster cadence; the boss is back after 120 s and other monsters, the existing dragon among them, after 7.5 s; stepping to the arena edge does not send it home, and 5 s beyond `arenaRadius + 6` does; while the target is beyond `arenaRadius + 6` the boss takes no damage (reason `arena`), so a hero at 23 to 25.5 from home cannot shoot a boss pinned at its edge, and stepping in and out gains nothing; the existing dragon has no `BOSSES` row and no pattern, and `rollMonsterHit` gives it dragonfire on every third attack and never gives it to the new boss. |
| G4.5 | `tests/boss-fight.test.ts`: the positional model of section 6.4 (`fight.ts` ported, calling `inShape`, with hitpoints regenerating at the in-combat rate) as a test against the live tables, 500 seeds per fighter: A wins at least 85%; C at least 65%; B and G at most 5%; F at most 15%; the prepared ranged and magic fighters win at least 85% and, when they never move, at most 5%; the unprepared level-50 ranged and magic fighters win at most 15%. It prints the table. `tests/gate-simulation.test.ts` passes unchanged. |
| G4.6 | `tests/feel-data.test.ts`: every hit stop is at most 120 ms; flash peak under 0.7 and at least 350 ms apart; knock-back offsets return to 0; `spinOffset(spinAnim)` is a function of `spinAnim` alone and equal at steps of 1/30, 1/60 and 1/144 (finding 14). A text scan: `reactions.ts` and `telegraphs.ts` do not write `logic.x`, `logic.z` or `player.pos`. |
| G4.7 | `tests/sound-plan.test.ts`: for every attack, the wind-up plan ends at `windupMs / 1000` within 1 ms and has no voice after it; every cue of 6.7 has a plan, the impacts being separate plans; no voice is louder than 0.2; every plan fits 12 voices. A text scan: `audio.ts` contains no `setTimeout`, one check of `audioEnabled`, and creates its context only inside the gesture listener. |
| G4.8 | `tests/sustain.test.ts`: a second meal inside 1.8 s is refused and consumes nothing; potions have their own clock. **Regeneration:** `regenRate` is Stage 3's constant (0.25) within 6 s of combat and 1.0 after, and is never 0; the gate crossing, rebuilt from `CAMPS` with the frozen test's generator and seeds and hitpoints regenerating by `regenRate` of a combat timer, gives the same outcome seed for seed as at a constant 0.25 HP/s, kills a fresh runner in at least 95% of seeds 1 to 1,000 on each line and in at least 95% of seeds 1 to 10,000 pooled over the three lines (3.66% survive), never kills the prepared one, and no gap between two blows in a crossing reaches 6 s. **Death:** `deathLoss` is zero at combat 14 and positive at 15; for every fighting skill at every level from 1 to 99 and at 0%, 1%, 50% and 100% of the level, the loss is finite, never negative, at most the experience inside the level and at most the share of the span, and `getLevelForXp` after it equals the level before, also for fractional experience; a skill at 99 loses nothing and adds nothing to the vow's price; no other skill, no item and no coin changes; `applyDeathLoss` with a vow subtracts nothing and clears the vow, and with nothing to lose leaves the vow; calling it twice loses twice (the caller guards re-entry). **Vow:** `vowPrice` equals the summed share of spans and is at least 250; `buyVow` refuses below combat 15, when one is held and when coins are short, changes nothing when it refuses, and never leaves `gp` negative or non-finite. **Save:** the cases of 6.6. **Notice:** `deathNotice()` and the `none` outcome deep-equal today's notice; the `vow` and `lost` outcomes say what happened, name the true total, never say a level was lost, and still contain "Lumbridge" and "You keep your gear and coins". `shouldRetaliate` is true only for an idle hero and false while any wind-up on the hero is live. `phase4-combat.test.ts` passes unchanged. |
| G4.9 | `tests/new-monsters.test.ts`: each of the two new monsters has a camp and a pattern, and its stats lie between the giant's and the guardian's; the boss has a camp of one, the dragon's model key, a tint and a scale; every `model` names an existing monster model; none of the three drops equipment; **the existing dragon's row, drops and camp equal a golden captured before any change** (name, level, 260 hitpoints, max hit 32, drops, camp of one at (-102, 100), no `pattern`, no `model`). `tests/names-combat.test.ts`: the deny-list over every new name, the boss's, its title's and the blessing's included. `tests/world-data-combat.test.ts`: the arena criterion of 6.4 for the boss's camp. |
| G4.10 | `tests/commands.test.ts`: `applyCommand` for each of the five state commands, accepted (with its effect) and refused (state unchanged); a meal refused by the cooldown consumes nothing. `tests/architecture.test.ts` passes unchanged. A text scan: no new file under `src/state` mentions `STATE`, `Math.random`, `Date.now` or `performance`. |
| G4.12 | `tests/feel-data.test.ts`: every effect of section 10 has a value for each of the four tiers, and the telegraph's outline and fill are on in all four. |

### 9.2 Needs a human looking at and listening to the running game

- **The telegraph reads.** At each of the four tiers, on grass, sand, the dark volcanic ground and a slope: the shape is visible, its edge is clear, the fill shows how long is left. Checked at noon and at night. A screenshot of each shape on each ground.
- **A fight with a hill giant** as a level-30 hero: the slam comes on the fourth attack, one click gets the hero out, the giant stands open afterwards. Then stand in it once: the number is bigger, the hero lurches, the sound is different.
- **The boss**, with a hero raised by the existing cheat and geared as fighter A: each phase is announced by the pause, the roar and the banner, which shows the boss's name; "in, then out" reads from the two shapes of phase III; leaving the cone does not reset the fight; standing still kills. Then with a crossbow and with magic. Then as fighter F: lost, and it is clear from the screen that the unwarned bolt did it.
- **The existing dragon**, as today's player would fight it: nothing about the fight has changed but the flash and the sounds; it is back after 8 s.
- **Dying.** Below combat 15: today's notice. Above it without a vow: the notice names the experience lost, the skills panel shows it, no level fell. With a vow: the lantern mark is on the HUD before, gone after, and the notice says so. Take a vow at the altar's menu; reload the page: the mark is still there.
- **Regeneration.** Standing still after a fight, the bar starts climbing faster 6 s after the last blow; being missed by a monster does not start it.
- **Sound.** The wind-up cue ends on the hit, by ear, at 60 FPS and with the tab throttled to a low frame rate. Three cue families can be told apart with eyes closed. Nothing clips when a camp of four attacks. Mute silences everything, including the heartbeat. A fresh page load makes no sound and logs no warning before the first click.
- **Control is never lost.** During hit stop, flinch and knock-back the hero still answers a click on the same frame.
- **Reduced motion** (browser setting on): no camera kick, no rumble, steady vignette.
- **Routes.** Where obstacles exist inside a leash circle today (6.1): pull a Dune Nest West scorpion toward the river and stand across a bend, and attack a pass sentry from just outside the corridor mouth: each walks round, not into the wall. Hit a goblin, cross the bridge and leave: it walks back over the bridge. After Stage 5, a moss guardian among the trunks. (The first draft's "around the ridge end and the castle" cannot happen: a moss guardian leashes 13 units from its camp, and both are over 40 away.)
- **Clicks under pressure.** With a mouse and with a trackpad: dodge each ordinary heavy ten times; a ranged hero runs in from the nova with one click near the boss; in a camp of four, step out of a shape by clicking beside another monster.
- **Perf HUD** at Cinderstep Pass with four sentries chasing, and in the boss fight in phase II, against section 8.
- **Slow device.** With the browser's CPU throttle at 6x: the wind-ups are still answerable, and the impact sound comes with the drawn impact.

### 9.3 Declared test replacements

So they are not mistaken for weakening. Every other existing test stays as it is.

Four, all made once, in plan task M3, with the final counts: the two monsters (accepted by the owner, CALL-4.8) and the new boss (CALL-4.4) arrive together. The existing dragon's name is not among them (CALL-4.15 is settled: not renamed). Read at `54736ba` and on `feat/world-place` at `78e4564`.

1. Stage 3's `tests/content-freeze.test.ts`: one constant beside Stage 3's own `DECLARED_NEW_ITEMS`, `DECLARED_NEW_MONSTERS = ['saltback_stalker', 'thornwatch_marksman', 'ashmantle']`, with a comment naming the owner's decisions of 2026-11-14 (CALL-4.4, CALL-4.8), and the `MONSTER_TYPES` cases ("no id was added or removed", "no name changed") compare the live table **minus the declared keys** with the golden, exactly as the `ITEMS` case does. `tests/fixtures/s3/content-ids.golden.json` is not regenerated. No captured name changes. No item, quest, prayer or spell id is added.
2. Stage 2's `tests/world-data.test.ts`, `expect(memberCount()).toBe(36)` (line 162): 36 becomes 42. Every other assertion of that file must pass for the three new camps without an edit, among them `aggressive().length` equal to `CAMPS.length - 2` (so all three new camps are aggressive) and `POIS` of length 7 (so the arena adds no point of interest).
3. Stage 2's `tests/world-budget.test.ts`, "CAMPS hold 36 monsters" (line 27 at `54736ba`, line 41 on `feat/world-place`): 36 becomes 42.
4. `src/__tests__/blender-hero.test.ts`, "monsters.glb exports all 10 monster species" (lines 133-157): it asserts `Object.keys(MONSTER_TYPES).length` is 10 and finds `Monster_${typeKey}` for every key, which no reused-model monster can satisfy. The edit keeps its intent, every monster renders from `monsters.glb`: it iterates the distinct model keys (`def.model ?? typeKey`, still exactly 10, each node present, each upgrade succeeding), asserts there are 13 type keys, and adds that every type's model key is one of the 10. The upgrade still accepts the test's `MonsterEntityLike` without a `modelKey` (it is optional and defaults to the type key).

Not replacements, noted so they are not taken for one: Stage 3's two save goldens, its "same top-level keys" assertion and its `no new saved field` test pass unedited, and so do Stage 2's `save-relocation` golden and `SAVE_KEYS` (6.6); `tests/monster-hit.test.ts` and `tests/phase2.test.ts` (`isBossLoot('elvarg_dragon')`) pass unedited; `tests/names.test.ts` pins twelve place names and is not touched, because the arena adds none.

Also not a replacement: Stage 2's `tests/stage2-review-fixes.test.ts`, "a three_kettle goblin stuck on the east bank snaps home after a stall": it stays and must pass without a grid. With the real grid the same goblin now walks home over the bridge; that is a new test, not an edit.

---

## 10. Tier rows for Stage 5

Stage 5's tier table says "a feature not in this table does not exist". These are Stage 4's rows, by internal tier id. Timings and sizes never vary by tier: a tier changes only how much decoration is drawn.

| Feature | performance (Low) | balanced (Medium) | high (High) | ultra (Ultra) |
|---|---|---|---|---|
| Telegraph outline and growing fill | yes | yes | yes | yes |
| Telegraph edge sparks | 0 | 0 | 8 | 16 |
| Telegraph impact burst (particles) | 0 | 6 | 12 | 12 |
| Wind-up pose | yes | yes | yes | yes |
| Hit stop | yes | yes | yes | yes |
| Hit flash | yes | yes | yes | yes |
| Flinch and knock-back | yes | yes | yes | yes |
| Damage numbers | yes | yes | yes | yes |
| Camera kick and rumble | yes | yes | yes | yes (all off under reduced motion) |
| Phase-change ring | 1 ring | 1 ring | 2 rings | 2 rings and a burst |
| Boss bar, marks, low-health vignette, lantern mark of a held vow | yes | yes | yes | yes |
| Sound | all tiers alike | | | |

Why the telegraph is whole on Low: it is game information, as Stage 5 ruled for the blocking trunks. On Low it is two unlit draws with no particles.

What Stage 5 may restyle: the telegraph's colours and edge treatment, particle shapes, splat styling, the boss bar. What it may not touch: `attacks.ts`, `feel.ts`, and the fill's meaning (fill reaches the outline at the resolve).

---

## 11. Ledger: everything owed to Stage 4

| Item | Source | Decision | How |
|---|---|---|---|
| Monster chase and return on the walk grid | Stage 5 QV9, owner 2026-11-14 | **Done here** | 6.1 |
| A returning monster that cannot get home | Stage 2 review, finding 1 | **Closed as a class** | 6.1: bounded `return` |
| Food has no job (Stage 3 F9) | Stage 3 design 7.2 | **Done here** | 6.6 |
| Regeneration | Stage 3 design 7.2 | **Done here**, decided by the owner (CALL-4.5): always on, faster out of combat | 6.6 |
| The altar's free heal | Stage 3 design 7.2 | **Kept, with reason** | 6.6 |
| Death without loss; a recurring gold sink | Stage 3 design 7.2, 6.5 | **Done here**, decided by the owner (CALL-4.6): experience loss, and the Lantern Vow as the sink | 6.6 |
| The dragon is back in 8.35 s (Stage 3 F13) | Stage 3 design section 10 | **Declined by the owner's decision** (CALL-4.4): the existing dragon keeps its respawn. Stage 3's cut to its drops is what limits it as income. | 6.4, 6.10 |
| Audit finding 14: the special-attack spin depends on frame rate | foundation design section 9 | **Fixed here** | 6.5 |
| Player auto-retaliation | foundation design 6.5 | **Done here**, CALL-4.7 | 6.6 |
| Safespotting within one leash cycle | foundation design 6.5 | **Accepted, closed** | With routes a monster reaches a player behind an obstacle, which was the real complaint. What remains is "a ranged hero can land a few shots before a monster arrives, and a weak monster can die on the way". That is what ranged weapons are for. Line-of-sight stays a non-goal. |
| Ranged and magic gear ladders as designed curves | Stage 3 design section 10 | **Deferred to Stage 6** | They need new gear rows and prices, which are content and economy. Stage 4 supplies the two facts they were waiting for: what kiting is worth (monsters now reach the hero around obstacles; heavies are dodged the same at any range) and that ammunition is spent per swing as today. |
| Monster band between level 28 and 45 (Stage 3 F12, deferred there to Stage 6) | Stage 3 design 7.5; owner's request for prepared slots | **Two slots filled, five prepared**, accepted by the owner (CALL-4.8) | 6.8 |

---

## 12. Threat model

### 12.1 What are we working on?

The same single-player static site. No server, no account, no network call. This stage adds no parsed input and one stored value, the optional flag `quests.lanternVow`, read by one strict line (6.6).

| Flow | Source | Trust | Sink |
|---|---|---|---|
| Attack, pattern, boss, feel and monster tables | compiled TypeScript constants | Trusted, reviewed in git | Rules, effects, sound, chat lines |
| Pointer and keyboard | the player | The player | Commands |
| Save | `localStorage` | Untrusted, validated by Stage 1's rules | Skill experience, which the death loss reads and writes; `gp`, which the vow's price is paid from; `quests.lanternVow`, accepted only when it is exactly `true` |
| Frame time | `requestAnimationFrame` | The device; can be very slow or paused | Every timer |
| Audio output | Web Audio | The browser's policy | The player's ears |

Trust boundaries are unchanged: the `localStorage` read, and the device's clock and policies. Cheating is not a boundary.

### 12.2 What can go wrong?

| # | Failure |
|---|---|
| S1 | A wind-up is unfair on a slow device or for a slow player: the shape cannot be left in time. |
| S2 | A monster in `return` never arrives, or a boss in `shift` never leaves it: an untouchable monster for good. |
| S3 | Path searches stall the frame: many monsters, a long detour, or a search that never ends. |
| S4 | A telegraph mesh or sound voice is never released: memory or voices grow through a long session. |
| S5 | A wind-up is cancelled in the rules and still drawn, or drawn and never resolved: the ground lies. |
| S6 | The boss resets when the player dodges, or can be killed from where it cannot answer. |
| S7 | A phase is skipped by burst damage, or the gate leaves the boss at a threshold with no way to pass it. |
| S8 | Flash, shake or vignette pulses harm a photosensitive player, or motion sickens. |
| S9 | Sound plays before a gesture (browser warning), ignores mute, clips, or keeps beating in a hidden tab. |
| S10 | The death loss drops a level, goes negative or non-finite, or is taken twice for one death; a vow is spent without saving anything, bought twice, or bought with coins the hero does not have. |
| S11 | Food cooldown or the swing delay can be dodged by another path (drag, right-click menu, the bank). |
| S12 | A tab left in the background returns with one huge time step. |
| S13 | Aggression or auto-retaliation traps the player: pulled into a fight on load, or unable to walk away. |
| S14 | Stage 3's pacing or the Stage 2 gate silently changes. |
| S15 | An attack or monster name reaches chat through `innerHTML`. |
| S16 | A new name or pattern is too close to an existing game's. |
| S17 | A table row is wrong: a pattern names a missing attack, a boss has no last phase, a camp sits on a safe zone. |
| S18 | A hand-edited save holds a vow that was never paid for, or a `lanternVow` of the wrong type. |
| S19 | A later change drifts the existing dragon (its hitpoints, damage, place, drops or respawn), against the owner's decision. |

### 12.3 What are we going to do about it?

| Risk | Decision |
|---|---|
| S1 | Mitigate: the rule of 6.3 enforced on every row by a test; the step cap makes slow frames lengthen windows; one global scale knob. Accept: a player slower than the model's slow player dodges less and relies on food and level, as today. |
| S2 | Mitigate: `returnLeft` and `shiftMs` are clocks that only count down; tests for both, including a walled-in home. |
| S3 | Mitigate: quota of 2, cap of 6,000, closed set, scratch memory, a test on each. |
| S4 | Mitigate: shapes are disposed on `resolve` and `cancel` and on monster death through Stage 1's `disposeObject3D`; at most 12 voices, each stopped by the audio clock. The Stage 1 leak check is repeated in the human gate. |
| S5 | Mitigate: the engine draws only from `windup`, `resolve` and `cancel` events; a test that every `windup` is followed by exactly one of the other two. |
| S6 | Mitigate: the arena rule of 6.4, with tests. Accept: a ranged hero inside the arena fights from range; the cone, the slag rain and the nova reach it. |
| S7 | Mitigate: the gate clamps; the threshold is passed by the first hit after the shift; the last phase's threshold is 0; tests. |
| S8 | Mitigate: flash peak and rate capped by a test; no full-screen flash anywhere; camera effects off and vignette steady under reduced motion. |
| S9 | Mitigate: create and resume on a gesture, the listener armed until running, drop while not running, one mute check plus a master-gain ramp, limiter, heartbeat stopped on mute and on hidden. Human check on a fresh load. |
| S10 | Mitigate: one pure `applyDeathLoss`, integer amounts, bounded by the experience inside the level, with an assertion that no level changed; called once from `handlePlayerDeath`, which already guards re-entry (`actions.ts` 362). `buyVow` pays through `creditGp` and refuses first. Tests over every level from 1 to 99, at level 99, and with a vow. |
| S11 | Mitigate: every way to eat or drink goes through the `eat` and `drink` commands; a text scan finds no other write of `hp` from an item. |
| S12 | Already mitigated: the step is capped at 0.08 s (`loop.ts` 786), so a returning tab advances one small step. |
| S13 | Mitigate: Stage 2's safe zones and grace are untouched; retaliation only targets, never moves a hero who has a walk in progress, and never fires while a wind-up on the hero is live; any click replaces the target. |
| S14 | Mitigate: both tests run in the gate; patterns start with a basic; conservation is tested. |
| S15 | Accept, with reason: names are compiled constants, the same trust as every monster name printed today. No save-derived string is added to any HTML. |
| S16 | Mitigate: the deny-list test and a human search per name. Shapes on the ground, phases and wind-ups are genre conventions, not a game's property. Accept the remainder: no test proves originality. |
| S17 | Mitigate: `attack-data`, `new-monsters` and `world-data-combat` tests are the boundary check for compiled data. |
| S18 | Mitigate the type: only the exact value `true` is read. Accept the rest: a player who edits the save can already set any level or coin count; cheating is not a boundary. |
| S19 | Mitigate: `catalog.ts` and the dragon's camp are in no task's allowlist; a golden of its row, drops and camp (plan M1); the frozen `monster-hit` test pins its dragonfire. |

### 12.4 Did we do a good enough job?

By the proofs of 9.1 and the checks of 9.2. In particular: the timing rule test for S1, the two clock tests for S2, the boss simulation and the unchanged gate simulation for S14 and G4.5. If the boss simulation cannot be made to pass with the thresholds stated, the fight's numbers are wrong and the stage stops there for a re-tune by the lead, not for a weaker test.

---

## 13. CALLs: what the owner decided and what is still open

In plain words.

### 13.1 Decided by the owner on 2026-11-14

| # | Decision | The owner's words (translated) | What it means here |
|---|---|---|---|
| **CALL-4.6** | **What dying costs.** | The Ragnarok approach, plus the possibility of a Tibia-style blessing. | On death the hero loses a small share of experience, never a level, and no item or coin. A blessing bought with gold cancels the loss and is used up by the death. The fee, the grave and the repair options are withdrawn (6.6). The numbers are CALL-4.17. |
| **CALL-4.4** | **The dragon.** | "A dragon is a dragon; bring the base of the essence. That does not stop us from having a dragon boss with mechanics." | The existing dragon stays exactly as it is: hitpoints, behaviour, place, drops, respawn. The three-phase fight is a separate, new dragon boss with its own arena (6.4). Its numbers are CALL-4.18. |
| **CALL-4.5** | **Regeneration.** | "Regeneration is frequent, amplified out of battle." | Hitpoints regenerate all the time, in fights too, and faster out of combat. The pause in fights is withdrawn. The food cooldown stays (6.6). The two rates are CALL-4.19. |
| **CALL-4.8** | **Two new monsters now.** | Accepted. | Saltback Stalker (34) and Thornwatch Marksman (38) ship, built from existing models (6.8). |
| **CALL-4.15** | Rename the existing dragon? (raised by the critique) | Settled by the answer on the dragon. | Not renamed. The new banners and the boss bar show the new boss's name. Renaming borrowed names is Stage 8, only if the owner decides. |

### 13.2 Still open

The ones with a real trade-off come first. The first three are new: the owner's answers created them.

| # | Decision | Options | Recommendation |
|---|---|---|---|
| **CALL-4.17** | **The numbers of dying.** How much experience a death takes, which skills pay, and what the blessing (the Lantern Vow) costs and covers. | Share of the level's span: 1% (Ragnarok's), **3%**, or 5%. Skills: **every fighting skill**, or only the one in use. Vow: **cancels the whole loss of one death**, or half of it, or covers several deaths. Price: **one coin per point of experience guarded**, or more, or less. | **3%, every fighting skill, one death fully covered, one coin per point.** Section 6.6 has the table: at 3% a death costs under one kill of work at level 30, about 14 kills at level 70 and about 100 at level 90. 1% is close to free until the 80s, so nobody would buy the vow and gold would have no sink. 5% is two thirds heavier everywhere. The trade-off is real near the top: at level 90 one unprotected death at 3% is about 100 kills, and the vow about 68,500 coins. A skill at 99 now loses nothing (experience past 99 buys nothing; second pass). Three sub-choices the second pass found: **(a) 10x saves.** For them a death is a tenth of the work and the vow is not worth its price, and most existing characters are probably at 10x (today's default, kept by Stage 3). Options: accept (recommended: simplest, and the hidden fast mode is meant to be easy), or scale the share by the rate (equal work for everyone, still never a level). **(b) A vow spent on a trivial loss.** A death just after level-ups can cost 1 point and still spend a vow bought for thousands. Recommended: a death whose loss is under a quarter of what the vow can guard costs nothing and leaves the vow in place (one comparison in `applyDeathLoss`, one more notice case); or accept as written. **(c) A vow carried across levels** covers a larger loss than it was priced for, once. Recommended: accept. **(d) Level 99.** Experience past 99 buys nothing (no level 100; it shows only in tooltips and the total). Nothing lost at 99 (proposed) means a maxed hero has no death cost and no sink; keeping the span of 98 to 99 keeps both (about 230 kills of work and a 147,460-coin vow at all-99) but for experience with no use. Recommended: nothing at 99, and look for a maxed hero's sink elsewhere (Stage 6). |
| **CALL-4.18** | **The new boss.** Its name (Ashmantle the Slag Wyrm), its place (the south-west of the volcanic corner), what it gives, and one hard edge: its ordinary bolt has no warning and hits an unprepared hero for up to 72, in a stage whose promise is "attacks with a visual warning". | Accept; or **open the fight with a warning** (on first aggro a 2.0 s untouchable roar, as at a phase change, with a banner and the chat line "Its bolts are magic"; no proof row moves); or lower the bolt (it cannot go far: the unprepared magic hero wins 18% at 64 against a bound of 15%, 35% at 56, 89% at the existing dragon's 32, and any value that keeps the bound still kills a 50-hitpoint hero in one bolt); or give it a material reward (a unique item, priced by Stage 3 or Stage 6). | **Accept, with the opening warning.** The bolt stays what makes preparation necessary (with Protect from Magic it is 14), and the roar makes the stage's promise true for the fight: the player is told, before any bolt, what kind of attack it is and has 2 s to answer. It gives coins below the existing dragon's, bones, a shark and the title "Ashbreaker", and no equipment, so the economy cannot move through it. The cost that remains: an aggressive boss that can kill an unprepared hero in one bolt, now with an experience loss on death. The cost of the warning: a level-50 caster who heeds it and prays wins 91 to 94% (ranged 24 to 84%, melee 3 to 12%), so the boss is not a level-110 challenge for magic; that gap is the deferred ladder question. |
| **CALL-4.19** | **The two regeneration rates.** | **0.25 hitpoints a second in combat (today's rate) and 1.0 out of combat, which starts 6 s after the last blow given or received**; or a larger or smaller resting rate; or a faster rate in fights too. | **As stated.** Keeping today's rate in fights is what keeps the Stage 2 gate, ordinary fights and Stage 3's numbers exactly where they are today: with the 6-s timer the gate runs equal today's seed for seed (3.66% survive over 10,000 seeds). A faster rate in fights would move the gate (4.8% survive on seeds 1 to 1,000 at 1.0 HP/s) and is not recommended. The resting rate only shortens waiting: 69 s instead of 276 s to refill 70 hitpoints. |
| **CALL-4.14** | **Can a few missed warnings in a row kill from full health?** Each warned boss attack that hits makes the next ones hurt more for 12 s. With two or three misses close together, one more can take a full-health hero in a single blow. | Allow it (a player who ignores the ground loses quickly); or cap any single boss blow at about half the hero's health. | **Allow it.** One miss from a clean state never kills a hero who meets the boss's level; only a run of misses does. With the cap, a melee hero who never moves wins 82% of fights and ranged and magic heroes who never move win all of them. |
| **CALL-4.16** | **Warnings for trackpad players.** Warnings last 1.5 to 2.0 s; that suits a mouse, and is just enough on a trackpad. | Leave as is and test with a trackpad before release; or make every warning about 15% longer for everyone; or add a "longer warnings" option (a new saved setting). | **Leave and test.** In the model a prepared hero 300 ms slower on every answer still wins 97% of boss fights. If the trackpad check fails, lengthen every warning by 15% rather than add an option. |
| **CALL-4.7** | **The hero fights back on its own when attacked while idle.** Never while walking, gathering or fighting something else, and never while a warned attack is about to land on it. No setting. | Accept; or leave as today (stands and takes it); or add an on/off setting. | **Accept**, without a setting. |
| **CALL-4.3** | **The start region has no warned attacks.** Chickens and goblins fight as today; the first shape is met at the scorpions or the wizards. | Accept; or give goblins a gentle one as a tutorial. | **Accept.** A frozen test pins goblin timing, and Stage 3 owns the first hour. |
| **CALL-4.9** | **The new names**: eleven attacks, three phases, two monsters and two prepared ones, the boss (Ashmantle the Slag Wyrm), its title (Ashbreaker) and the blessing (Lantern Vow). Three words in them are also names in the four games (6.9): "Wyrm" (RuneScape, Tibia), "Fury" (Tibia), "Stalker" (Ragnarok). | Accept all; or rename the two closest. | **Rename phase III "Fury" (for example "Last Embers") and the boss's epithet (for example "Ashmantle the Slagborn")**; keep "Saltback Stalker". Then accept, subject to the name search. |
| **CALL-4.2** | **No new buttons.** No dodge, block or parry key. The answers are the clicks the game already has. | Accept; or add a dodge key. | **Accept.** A dodge key is a different game and breaks touch later. |
| **CALL-4.1** | **The essence list**, plus: a mouse alone is enough, and control is never taken from the player (no stun, no push). | | Accept. |
| **CALL-4.10** | **Ordinary monsters hit as hard as today on average.** A heavy blow is worth two normal ones and replaces two; stepping out avoids it. | Accept; or make heavies extra damage on top (harder game, re-tunes Stage 3). | **Accept.** |
| **CALL-4.11** | **Sound is synthesised, no audio files.** | Accept; or commission or license samples later. | **Accept** for this stage. |
| **CALL-4.12** | **What is deferred again**: ranged and magic gear ladders (Stage 6); saving a boss's respawn timer (Stage 6); the rest of the co-op blockers in section 7. | | Accept. |
| **CALL-4.13** | **No new model in this stage.** Three prepared slots wait for one. | | Accept. |

---

## 14. Risks

| # | Risk | Likelihood | Effect | Answer |
|---|---|---|---|---|
| X1 | The shapes do not read on some ground or tier. | Medium | The core mechanic fails by eye. | The human check is per ground and per tier and comes before the boss work; outline plus fill plus sound. |
| X2 | The model's player is not a real player: real people dodge worse, or better; and the first draft's two models of the same fight disagreed (its unprepared hero won 6% in one and 41% in the other). | High | The boss is too hard or too easy, or preparation does not matter. | Every number is a table row. The boss is now tuned against the positional model with melee, ranged and magic fighters, and B3 re-runs it as a test; the play check tunes powers and wind-ups inside the timing rule; the simulation thresholds are loose on purpose. |
| X3 | Stage 3 lands with different names or formulas than its design. | Medium | Tasks point at missing symbols. | R0 re-checks before any code and edits the plan, not the code. |
| X4 | `monsterAi.ts` takes three changes in a row (routes, patterns, phases) and grows hard to read. | Medium | Regressions in Stage 2 behaviour. | The frozen Stage 2 tests run after each; the three changes are serial and each has its own tests first. The file stays under the 1,000-line limit; if it passes 600 the pattern code moves to its own module in the same task. |
| X5 | Faster rest or the new monsters move Stage 3's pacing test. | Low | A red test at the gate. | Measured with a copy of its model: counts move by a few kills and every assertion holds (6.10). The stated fallbacks. |
| X6 | Web Audio behaves differently across browsers (suspended contexts, compressor defaults). | Medium | Silence or harsh sound on one browser. | Human check on two browsers; failure degrades to silence, never to an error. |
| X7 | The grid and the continuous walk test disagree at an edge and a monster stalls. | Medium | A monster gives up a chase early. | The stall backstop sends it home in bounded time; the same disagreement was handled for the hero in Stage 2's review fixes. |
| X8 | Stage 5 rewrites `vfx.ts` and `styles.css` while Stage 4's effects are new there. | Medium | Merge work. | New effects live in new files (`telegraphs.ts`, `reactions.ts`); `vfx.ts` gains nothing. |
| X9 | A 1,400-hitpoint boss feels long in melee at 0.6 s per swing, and short with magic (47 s). | Medium | Boredom for one style, a fight that is over early for another. | Three phases of about 35 s each in melee, with a pause between; phases II and III open with their signature attack, so even a fast kill meets every mechanic. The gap between styles is the ladder question, deferred (section 11). |
| X10 | The experience loss surprises an existing player. | Medium | Complaints. | The death notice says exactly what was lost, that no level fell and how the vow prevents it; nothing below combat 15; nothing can be lost for good. |
| X11 | The boss's unwarned bolt (max 72) kills an unprepared hero in one or two hits, and the player does not see why. | Medium | The one unfair-feeling death in a design built on warnings. | The human check asks for exactly this (9.2). The chat line on arrival and the death notice can name the prayer; the alternative and its cost are in CALL-4.18. |
| X12 | Nobody buys the vow (the loss is too light), or everybody resents the loss (too heavy). | Medium | No sink, or a punished player. | Share, price and cover are three constants and one owner decision (CALL-4.17), with the cost table of 6.6. |

---

## 15. What could not be verified

- **Anything that needs the running game.** Whether a shape reads, whether a hit feels heavy, whether a cue lands on the beat by ear, whether the fight is fun. No dev server, build or test was run.
- **The player's attack arithmetic in the model** is transcribed by hand from `actions.ts`, for melee, ranged and magic. After Stage 3 it becomes a function the boss test calls. Arrow and rune costs, projectile travel time and special attacks are not modelled.
- **The model's player.** Reaction time (log-normal, median 550 ms), a 5% chance of not noticing, a fixed eating rule, and always taking the shortest way out of a shape are assumptions. The boss stands still at its home in the model; in the game it walks to keep a far hero within 11 units, so shapes centred on it move with it between attacks.
- **How often players die.** The cost of one death and the price of one vow are computed; the size of the gold sink in play is that times a death rate nobody has measured.
- **The death table's hero** is Stage 3's melee fighter with equal levels, halfway through each level. Other builds pay and re-earn differently (6.6 says how).
- **Stage 3's pacing test with the faster rest.** Checked only with a copy of the critique's Python model from Stage 3's worktree, changed in one constant. Stage 3's TypeScript test does not exist in this tree.
- **Search cost after the scratch-array change** is an estimate. The 0.5 to 0.7 ms figure is today's code on this machine under load from other agents.
- **The arena's position** passes every test `decisions.ts` runs on the Stage 2 grid, tables and height function (6.4). The slope limit of 0.8 per unit is a judgement, set between the existing lair (0.34) and the ridge's foot (over 2.5); whether shapes read on a 0.52 slope is for CP-4 and G-8. The spot was not checked by eye, nor against Stage 5's trees and set dressing, nor against any Stage 3 placement. B3 re-runs it as a test after both stages' data are in.
- **Stage 3's code.** Its design was read; its branch is not in this tree. Names used here (`creditGp`, `HP_REGEN_PER_SEC`, `monsterHitChance`, `playerAttackProfile`, `content-freeze`) come from that design.
- **Whether Stage 2's `world-data` test pins the lair's coordinates or the monster count.** Answered by the critique: it pins the count (line 162), not the lair; `world-budget` and `blender-hero` also pin monsters (9.3).
- **Stage 2's last two review fixes** (`2b5086a`, `74f7ea4`) were read as diffs. They add `entityAim`, `walkSpent`, `stallTime` and `escapeStall` to `pathfind.ts` for the hero's walk; nothing here contradicts them, and the plan names functions, not lines.
- **That the new names are unused elsewhere.** Only a person's search can say.
- **Web Audio scheduling accuracy and the compressor's sound** on real browsers.
- **Whether the boss model is right.** The position-free model is cut and the positional one is what the proof rests on. It has not met a real player. Its thresholds hold with room at 2,000 seeds on today's formulas; B3 re-runs it at 500 seeds on Stage 3's functions.
- **That 3% feels right.** The table says what a death costs in kills. Whether that is "small" is the owner's judgement and a play check's.

---

## Review log

- 2026-11-14, critique (`2026-11-14-combat-weight-critique.md`), applied in one commit: camp wind-up gate in place of the start-index stagger (6.2); cancel on every T5 cause; mesh faces the locked direction; Scorch Lane 2.4 wide; Rootquake 1,700 ms; escape distance of a self-centred circle is the full radius (6.3; model rerun, tables updated); trackpad and touch honesty (6.3); boss basics without dice dragonfire, reset restores phase I, no stall or leash for a boss, mark semantics and one-shot statement, lair placement against leash circles, run-in click rule, positional check and its numbers (6.4); band outline, no fog, polygon offset, flash spacing 350 ms (6.5); `deathNotice(paid)` and the retaliation guard (6.6); impact on the resolve event, mute ramp, context created on a gesture (6.7); roster table kept in docs, not code; Thornwatch Archer renamed Thornwatch Marksman (6.8, 6.9); `applyCommand` pure for five commands (7); route goal, rotation, `segmentWalkable` and `escapeStall` reuse, grid-only `returnLeft` and wander re-draw, `moveWithCollision` walk test (6.1); declared replacements 2 to 4 made exact (9.3); new owner calls CALL-4.14 to CALL-4.16.
- 2026-11-14, owner decisions (CALL-4.6, 4.4, 4.5, 4.8), applied in one commit. **Death:** the coin fee, grave and repair options are gone everywhere; a death takes 3% of the level's span from each fighting skill, bounded by the experience inside the level, nothing below combat 15, no item or coin; the Lantern Vow, taken at an altar for one coin per point guarded, cancels one death's loss; one optional saved flag, `quests.lanternVow`, absent by default so that Stage 3's goldens do not move; the death notice by case; a table of what a death costs per level band and a comparison of the three games' techniques (6.6); new CALL-4.17. **Dragon:** the existing dragon is untouched (260 hitpoints, rolled dragonfire, its lair, drops and 8.35 s) and gets no pattern; the three-phase fight is a new boss, Ashmantle the Slag Wyrm, key `ashmantle`, built from the dragon's mesh with a tint and a scale, at (-102, 54), chosen by a criterion that now also counts the existing dragon's camp as a neighbour, keeps resource nodes clear of the arena and limits the ground's slope (the critique's (-106, 66) passes barely and hangs over the world's bound; a first pick at (-100, 50) sat on the ridge's foot); no engine `breathCount` rule (6.4); F13's respawn item is declined (11); CALL-4.15 settled, not renamed (6.9); new CALL-4.18. **Boss re-tune** against the positional model: hitpoints 1,200 to 1,400; basic max hit 32 to 72; Ember Cone 12 x 32 degrees to 16 x 45; Ashen Nova ring 4 to 14 at 2,400 ms to ring 8 to 20 at 2,000 ms, always followed by the new Slagburst (radius 8); Cinder Fall (fire) became Slag Rain (nothing cuts it); phases II and III open with their signature attack; ranged and magic fighters and unprepared level-50 ranged and magic fighters added; every proof row holds (6.4, 6.3 table). **Regeneration:** always on, 0.25 HP/s in combat (today's, Stage 3's constant untouched) and 1.0 HP/s out of combat, with "in combat" defined by a 6 s timer that any attack attempt resets; the gate, the boss proof and the ordinary-monster claim re-run; food cooldown kept, with the finding that the boss proof does not rest on it (6.6); Stage 3's model checked with the faster rest (6.10); new CALL-4.19. **Monsters:** accepted; counts are now 42 monsters, 13 type keys and 10 model keys, and the four declared replacements carry those (9.3). **Models:** `boss.ts` (one boss table), `fight.ts` (the positional fight, with a corrected step out of a cone), `decisions.ts`; the position-free boss model is cut from `model.ts`. Sections 13 to 15 rewritten to match.
- 2026-11-14, second-pass check (critique file, "Second pass"). **Arena:** a hero 23 to 25.5 units from the boss's home out-ranged a boss pinned at its edge (reach 11 against 13.5), and stepping back inside reset the 5-s count; now the boss takes no damage while the target is beyond `arenaRadius + 6` (6.4, 9.1). The aggression circle is the one-member camp's radius 5, not 12 (6.4). Arena re-checked with `isWalkable` and `getTerrainHeight`; west-bound note for B3 and G-8. **Death:** a skill at 99 loses nothing and is not priced into the vow (the 99 row of the table changed: `decisions.ts` rerun); both terms of the loss floored; the vow's price is what it "can" guard; 10x saves, a pure mage, a vow carried across levels, a vow spent on a trivial loss and dying as a way home stated (6.6); `finishRespawn` prints the stored outcome; the altar entry walks there and buys on arrival; the save section names every golden and key test that stays unedited and Stage 3's rule 0.3.11's scope. **Gate:** ten blocks of 1,000 seeds added to `decisions.ts`: 3.66% pooled with regeneration, worst block 4.8%; the timer equals 0.25 HP/s seed for seed (6.6, 9.1, CALL-4.19). **Bolt:** max-hit sweep and the opening-warning alternative (6.4, CALL-4.18). **Names:** "Wyrm", "Fury", "Stalker" flagged (6.9, CALL-4.9). **9.3:** the `content-freeze` replacement is a `DECLARED_NEW_MONSTERS` constant, not a regenerated golden.
