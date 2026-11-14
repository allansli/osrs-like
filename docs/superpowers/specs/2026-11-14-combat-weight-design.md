# Combat with weight: design

Date: 2026-11-14. Branch: `feat/combat-weight`, cut from `feat/world-place` at `54736ba`. All line numbers refer to that commit. Stage 2 is still receiving review fixes (`2b5086a` and `74f7ea4` were read with `git show`, not merged) and Stage 3 is not in this tree, so every task in the plan finds symbols by name.

Status: proposal. The owner has not reviewed any of it. Every decision marked **CALL-4.n** is the lead's proposal and needs the owner's check (section 13). Nothing here has been agreed.

Inputs read for this document: `docs/superpowers/specs/2026-11-13-world-foundation-design.md` (called "the foundation design" below) and its plan; the approved Stage 3 design ("Start and pacing") and the approved Stage 5 design ("Visual pass"); `docs/audit/2026-11-13-findings.json` (finding 14); `docs/superpowers/baseline/stage2-review-findings.json` (13 confirmed findings); `src/state/combat.ts`, `monsterAi.ts`, `pathfind.ts`, `collision.ts`, `adventure.ts`; `src/engine/actions.ts`, `loop.ts`, `audio.ts`, `vfx.ts`, `monsterMeshes.ts`, `blenderMonsters.ts`, `spawns.ts`, `context.ts`, `renderer.ts`, `input.ts`; `src/ui/playerActions.ts`; `src/data/catalog.ts`, `world.ts`, `worldMap.ts`; `index.html` (the tab bar); the tests that pin combat (`monster-ai`, `monster-territory`, `monster-hit`, `gate-simulation`, `phase4-combat`, `stage2-review-fixes`).

This document covers one stage:

- **Stage 4: Combat with weight.** "Attacks with a visual warning, bosses with phases, reaction to hits, sound."

**Merge order this design assumes.** Stage 2, then Stage 3, then Stage 4, then Stage 5. Stage 3 moves the hit and drop arithmetic into `src/state` (`playerAttackProfile`, `playerHitChance`, `monsterHitChance`, `rollDrops`, `HP_REGEN_PER_SEC`, `creditGp`). Stage 4 builds on those names. Plan task R0 re-checks every premise after Stage 3 lands and before any code.

**How the numbers were produced.** One seeded script, `docs/superpowers/research/combat-model/model.ts`, run by `run.sh` beside it; its output is committed as `results.txt`. It imports the game's real tables and pure functions (`MONSTER_TYPES`, `CAMPS`, `ITEMS`, `getEquipmentBonuses`, `rollMonsterHit`, `resolveDragonfire`, `combatLevel`, `buildWalkGrid`, `findPath`) through the repository's own esbuild. The player's swing arithmetic is transcribed by hand from `performPlayerAttack` (`actions.ts` 104-121, 179-182), because that function is engine code. No test, type check, build or dev server was run. Section 15 lists what could not be verified.

---

## 1. Intent and why

A fight today is a damage race the player watches. The player clicks a monster once; both sides roll dice on a timer (the hero every 0.6 s, `context.ts` 9; the monster every 1.65 s, `monsterAi.ts` 54) until one side is empty. Nothing the monster does can be answered. Four facts make it weightless:

1. **No attack can be seen coming.** A monster's blow is rolled and applied in the same call (`performMonsterRetaliation`, `actions.ts` 310-359). The only answer is a prayer chosen before the fight.
2. **Staying alive is free.** Food is instant with no cooldown (`handleInventoryClick`, `playerActions.ts` 153-162), hitpoints regenerate at 15 per minute even in mid-fight (`loop.ts` 114-116), the altar heals for nothing (`loop.ts` 216-223) and dying costs nothing (`deathNotice`, `adventure.ts` 230-235). The Stage 3 design found this (its F9) and left it here.
3. **The boss is a bigger monster.** The dragon has 260 hitpoints. A hero in dragon gear deals 28 damage a second (model), so the fight lasts 9 seconds. Its one special, dragonfire, is a dice roll on every third attack (`combat.ts` 226). It is back 8.35 s after it dies.
4. **A hit has no body.** Monsters flinch (`monsterMeshes.ts` 800-809) and the camera shakes a little (`actions.ts` 203-205). `flashTimer` is set and never read. The hero does not react at all. Sounds are single tones with no relation to time (`audio.ts` 66-85).

And one thing is owed: monsters walk in a straight line (`monsterAi.ts` 166-169, 200-204), which the owner has decided must end before Stage 5 plants about 150 blocking tree trunks.

### What a fight should feel like

The player's hands are a mouse. Every answer the game asks for must be **one click on a large target, with time to make it**: move out of a marked area, switch a prayer, eat, change target, change style. So the design is "read, then click", never "react in a tenth of a second":

- The monster's ordinary blows stay as they are: a dice roll, answered by gear, level and prayer.
- Every few blows, a monster with a pattern winds up a **heavy attack**: a shape appears on the ground and fills. Standing in it when it fills costs a blow worth two. One click moves the hero out, and the monster is then open for as long as its recovery lasts.
- The boss is a sequence of such shapes in three phases, each phase asking for a different answer, with a pause and a roar between them.
- Every hit, given or taken, has a sound that lands on the hit, a flash, a lurch and a number, and none of them takes the mouse away.

### Essence to preserve (CALL-4.1)

The foundation design's list stands: skill progression on the existing XP curve; click-to-act; 28-slot backpack, bank, shops, forge; the faceted painted look; existing saves keep loading. Added for this stage: **no answer needs a key press or a held button; a mouse alone is enough**, and nothing ever takes control of the hero away from the player.

---

## 2. Constraints

| # | Constraint | Consequence |
|---|---|---|
| C1 | Click-to-act. The backpack and the prayer list are different tabs of one panel (`index.html` 178-184), so "switch a prayer" can be two clicks. | Wind-ups are budgeted for the slowest answer (section 6.3). No rule depends on an answer faster than 1.1 s. |
| C2 | The XP curve, drop tables, prices and bounties belong to Stage 3 (approved). | Ordinary monsters keep their expected damage against a player who does nothing (6.2). New monsters take their coin range from Stage 3's own curve and drop no equipment (6.8). Every dependency is listed in 6.10. |
| C3 | Existing tests are frozen (foundation plan 0.3 rule 3). They pin: first attack immediate, then every 1.65 s, for a goblin (`monster-ai.test.ts` 80, `monster-territory.test.ts` 403); `rollMonsterHit` draw order and dragonfire on `breathCount % 3` (`monster-hit.test.ts`); the death notice names Lumbridge and `applyRespawn` restores hitpoints and prayer (`phase4-combat.test.ts` 13-29); the gate simulation (`gate-simulation.test.ts`). | Patterns are opt-in per monster type, and goblins and chickens have none. `rollMonsterHit` and `applyRespawn` are not edited. Every pattern starts with a basic attack, so the gate is untouched. Declared replacements are in 9.3. |
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
- **G4.4** The boss has three phases, each with its own pattern and a clear transition, and cannot be skipped or burst through.
- **G4.5** A prepared player who reads the fight wins it; an unprepared one, or one who ignores the ground, loses. Proven by a seeded simulation.
- **G4.6** Hits have weight on both sides (flash, flinch, lurch, hit stop, number, camera) and never take control away.
- **G4.7** Sound carries timing: the wind-up cue ends on the hit, and phase changes and low health are audible. Mute and autoplay rules are respected.
- **G4.8** Staying alive is bounded: food has a cooldown, regeneration stops in a fight, and dying has a cost the owner has chosen.
- **G4.9** The roster gap is data: named slots with level, role, pattern and camp. Two are filled by reusing models.
- **G4.10** Combat rules are pure, table-driven and command-driven enough that a dungeon instance or a second player reuses them (section 7).
- **G4.11** Everything owed to this stage is resolved or deferred in writing (section 11).
- **G4.12** The performance budget of section 8 holds, and every effect has a tier row.

Non-goals: new models; a dodge roll, block or parry button; player skills with cooldowns beyond today's special attack; line-of-sight; ground loot; status effects beyond the boss's one mark; damage types beyond the styles that exist; difficulty settings; touch controls (Stage 7); restyling effects or the HUD (Stage 5); quests, dialogue, dungeons, more bosses (Stage 6); any change to the XP curve, prices, drops of existing monsters or bounties.

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
| Punishing a player who ignores mechanics | **Stacking vulnerability** (MMOs: each avoidable hit taken makes the next one worse). | Yes. It separates "stood in everything" from "missed one" without making any single hit a one-shot. | Yes, boss only: the mark (6.4). |
| Sustain | **Shared cooldown on healing items** (most RPGs), **out-of-combat regeneration** (most MMOs), **limited charges** (Souls flask). | Cooldown and out-of-combat regeneration fit as they are. Limited charges already exist: 28 slots. | Yes: 6.6. |
| Death | **Corpse run or grave** (older MMOs), **durability and repair** (WoW), **a fee** (many), **nothing** (modern action games with checkpoints). | A fee is one pure function and no new system. A grave needs ground items, which do not exist. Repair needs durability on every item and a save change. | Owner decision (6.6, CALL-4.6). |
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
| For | Reuses `findPath`, `nearestOpenCell`, `shouldRepath`. Measured: mean 120 expanded cells per call around the camps. Also solves the way home. | Constant cost per monster. | No path state. |
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

`StepWorld` (`monsterAi.ts` 38-47) gains two optional fields, as Stage 2 added its own: `grid?: WalkGrid` and `pathBudget?: { left: number }`. Without a grid the monster moves as today, so every frozen test that builds its own world keeps passing. `MonsterLogic` gains `path: [number, number][]`, `pathGoalX`, `pathGoalZ`, `repathIn` and `returnLeft`.

| Situation | Rule |
|---|---|
| Chase, the straight segment to the target is open on the grid | Walk straight, as today. No search. The segment is tested on grid cells (array reads every 0.5 units), not with `isWalkable`. It is re-tested when `repathIn` runs out, not every frame. |
| Chase, the segment is blocked | Follow `path`. Ask for a new one when there is none, when the last waypoint is reached, or when the target is more than 2 units from the path's goal (`shouldRepath`, `pathfind.ts` 309-316, reused). |
| Re-path rate | At most one request per monster every 0.5 s (`repathIn`). The first value is spread over 0 to 0.5 s from the monster's home coordinates, so a camp that aggroes together does not search on the same frame. |
| Frame quota | `pathBudget.left` starts at 2 each frame. A monster that needs a search when the quota is spent keeps its current path, or its straight step through `moveWithCollision`, and asks again next frame. |
| Search cap | `findPath` takes an optional `maxExpanded`. Monsters pass 6,000 (the measured worst case around every camp is 3,686). Past the cap the search returns `null`. The player's own searches pass no cap. |
| Goal | The nearest open cell within the monster's attack range of the target (`entityGoal`, reused). The start is the monster's cell, or the nearest open cell if a wall face or shoreline put its centre on a blocked cell (the rule `findWalkPath` gave ground clicks, moved into a shared `openStart`). |
| No route in chase | The search returned `null`, or the route is longer than 52 units (twice the 26-unit drop distance). The monster gives up: T5, `return`. The existing stall test (1.5 s under 0.2 units) stays as the backstop for anything the grid and the continuous walk test disagree on. |
| Entering `return` | One search home, exempt from the quota (it happens once per fight). `returnLeft` is set to route length / 5.2 + 3 s, or to 3 s when there is no route. |
| Getting home | Within 1.0 of home: T6 as today (full hitpoints, `breathCount` 0, `reset`). |
| **Cannot get home** | When `returnLeft` runs out the monster is put home with the same arrival effects. This is the Stage 2 patch (`monsterAi.ts` 154-160) promoted to a rule with a clock: `return` ends by construction, in at most route time + 3 s. |
| Leash | Unchanged: T5 fires when the monster is farther than camp radius + 4 from the camp centre. It is measured in a straight line while the monster walks a route, so a detour that leaves the circle ends the chase. That is intended: a camp does not follow a player around a ridge. |
| Immunity and heal | Unchanged: no damage and no acquisition in `return`; full heal on arrival. |
| Wander | Still a straight walk at 1.8. A wander point on a blocked cell is re-drawn (up to three times, else the monster stays). Wander is inside the camp, which Stage 5 keeps free of trunks. |
| Movement | Each step still goes through collision. `monsterAi` moves through `world.grid.walkable` when a grid is given, instead of the global `isWalkable`, so a dungeon passes its own grid (section 7). |

**Closing the defect class.** Three proofs: a data test that every camp member's home cell is open and that a route exists from every open cell within leash + 11 of the camp to that home (the model found 0 closed homes and 0 missing routes in 1,013 searches); a property test that from 200 seeded points per camp, `return` reaches `idle` within the bound, including with a grid in which the home has been walled in; and the frozen Stage 2 test of the goblin across the river, which must still pass.

**Cost.** Measured on the real grid: a search costs about 0.5 to 0.7 ms **as written today**, nearly all of it allocating and filling four 55,696-cell arrays per call (`pathfind.ts` 136-142). The plan replaces them with scratch arrays kept per grid size and cleared by a generation stamp, so cost follows expanded cells (mean 120). With a quota of 2 the worst frame is under 1.4 ms even before that change.

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
  reach: number,              // farthest the target stands when the shape locks
  cue: 'low' | 'mid' | 'high' | 'fire'
}
PATTERNS: Record<string, string[]>   // attack ids, cycled; 'basic' is today's attack
```

`MonsterDef` gains `pattern?: string`. A type without one behaves exactly as today.

**Life of a heavy attack**, all inside `stepMonster`:

1. **Wind-up.** When the pattern's next entry is a heavy attack and the monster's slot comes up, the shape is **locked**: origin (the target's position, or the monster's) and direction (monster to target) are stored on the monster. The event `windup` carries the attack id, origin, direction and duration. The monster stands still.
2. **Resolve.** After `windupMs` of rules time, the rules test the target's position against the locked shape (`inShape`, `src/state/telegraph.ts`). The event `resolve` carries `hit: boolean`. The engine applies damage only on a hit.
3. **Recovery.** The monster stands until the attack's slot time has passed since the wind-up began. Slot time is `slots x cadence`, and never less than `windupMs + 150`: a monster has one wind-up at a time, and a faster cadence (the boss's last phase) cannot squeeze a wind-up. It can be hit throughout. Then the pattern moves on.
4. **Cancel.** If the monster dies, leashes or enters a phase shift during the wind-up, the event `cancel` removes the shape and nothing is dealt.

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
| King Scorpion | Tail Lash | cone, length 4.5, half-angle 40° | Step to the side. |
| Dark Wizard | Hexfall | circle, radius 2.5, at the target | Step off the spot. |
| Dark Ranger | Pinning Volley | circle, radius 2.5, at the target | Same, from range. |
| Hill Giant | Overhead Slam | circle, radius 3, at the target | Same, bigger. |
| Moss Guardian | Rootquake | circle, radius 4.5, around the monster | Back away. |
| Lesser Demon | Scorch Lane | line, length 12, width 3, toward the target | Step across, not back. |

**Camps do not strike together.** A camp aggroes as one, so without a rule its heavies would land on the same slot. Each monster starts its pattern at an index taken from its home coordinates, among the leading basics only (0, 1 or 2 for these patterns). The first blow is still a basic, and neighbours' heavies fall one slot apart.

The pass sentries are lesser demons. A runner is in a sentry's reach for about half a second (foundation design 6.6), sees only the first, basic blow, and the gate simulation is unchanged. Plan task T3 asserts it.

### 6.3 The timing table and the reaction window (G4.3)

**The rule.** For every attack row:

```
windupMs >= 700 (human) + 160 (device) + 90 (hero's acceleration)
            + escapeDistance / 11.5 * 1000  + 200 (margin)
```

- **Human, 700 ms**: about 250 ms to see the shape, 150 ms to decide, 300 ms to move the pointer to open ground and click. It is a deliberately slow figure: the model's attentive player has a median of 550 ms.
- **Device, 160 ms**: two frames at 12.5 FPS. Below 12.5 FPS the loop caps the step at 0.08 s (`loop.ts` 786), so rules time runs slower than the wall clock and every window grows in real milliseconds. A slow device can only lengthen the window, never shorten it below this figure.
- **Acceleration, 90 ms**: the hero reaches running speed with rate 16 (`loop.ts` 312).
- **Escape distance**: the worst distance from inside the shape to its edge, for a target within `reach`, plus 0.3 for the hero's body. Computed by `escapeDistance` from the row itself.
- **Prayer answers** are slower (a key or tab click, then a small target). Nothing in this design can be answered only by a prayer switch inside a wind-up: a prayer is chosen for a phase, and announced by the phase change, which gives 2 s (6.4).

| Attack | Shape | Escape (units) | Minimum (ms) | **Wind-up (ms)** | Margin (ms) | Active | Slots | **Recovery (ms)** |
|---|---|---|---|---|---|---|---|---|
| basic | none | | | 0 | | instant | 1 | 1650 (the cadence) |
| Tail Lash | cone 4.5 x 40° | 2.05 | 1128 | **1600** | 472 | instant | 2 | **1700** |
| Hexfall | circle 2.5, target | 2.80 | 1193 | **1600** | 407 | instant | 2 | **1700** |
| Pinning Volley | circle 2.5, target | 2.80 | 1193 | **1600** | 407 | instant | 2 | **1700** |
| Overhead Slam | circle 3, target | 3.30 | 1237 | **1600** | 363 | instant | 2 | **1700** |
| Rootquake | circle 4.5, self | 3.80 | 1280 | **1600** | 320 | instant | 2 | **1700** |
| Scorch Lane | line 12 x 3 | 1.80 | 1107 | **1600** | 493 | instant | 2 | **1700** |
| Ember Cone (boss) | cone 12 x 32° | 4.45 | 1337 | **1800** | 463 | instant | 2 | **1500** |
| Tail Sweep (boss) | circle 5, self | 4.30 | 1324 | **1700** | 376 | instant | 2 | **1600** |
| Cinder Fall (boss) | circle 2.5, target | 2.80 | 1193 | **1500** | 307 | instant | 1 | **150** (a volley of three) |
| Ashen Nova (boss) | ring 4 to 14 | 9.80 | 1802 | **2400** | 598 | instant | 2 | **900** |

"Minimum" excludes the 200 ms margin; "Margin" is wind-up minus minimum. "Active" is one rules step: the shape is tested once, at the resolve. The drawn impact lingers 150 ms and deals nothing. The player's own attacks keep today's timing: one action every 0.6 s, no wind-up.

Share of wind-ups an attentive player clears (model; human time log-normal, median 550 ms; 5% of shapes not noticed at all):

| | Fast device | 160 ms slower device | 300 ms slower player |
|---|---|---|---|
| Ordinary heavies | 93 to 95% | 89 to 93% | 77 to 90% |
| Boss heavies | 93 to 95% | 88 to 94% | 76 to 93% |

One knob is left on purpose: `TELEGRAPH_TIME_SCALE` (1.0) multiplies every wind-up. Stage 7's touch controls, or an accessibility setting, can raise it without touching a row.

### 6.4 The boss in phases (G4.4, G4.5)

The existing dragon is the one boss. It keeps its name, model, level, drops and place in the quest line. What changes is the fight (CALL-4.4).

**Boss row** (`BOSSES` in `src/data/attacks.ts`), keyed by monster type:

```
BossDef = {
  hp, respawnSecs, arenaRadius,
  mark: { step, max, secs },
  phases: [{ name, untilHpFrac, pattern, cadenceMult, shiftMs, prayerHint }]
}
```

| | Today | Proposed |
|---|---|---|
| Hitpoints | 260 (9 s for a geared hero) | **1,200** |
| Back after death | 8.35 s | **120 s** |
| Arena | camp circle, radius 5 | radius 12 around the lair |
| Special | dragonfire, rolled on every third attack | four telegraphed attacks |

**Phase table.**

| Phase | Health | Cadence | Pattern, in order | What it asks |
|---|---|---|---|---|
| **I. Grounded** | 100% to 66% | 1.65 s | basic, basic, **Ember Cone**, basic, **Tail Sweep** | Pray against magic for the basics. Step out of the cone. Back off from the sweep, then return. |
| transition | at 66% | | 2.0 s: the dragon is untouchable, roars, a ring of light runs out, the banner names the phase | Time to eat and to choose a prayer. |
| **II. Cinders** | 66% to 33% | 1.65 s | basic, **Cinder Fall** x3, **Tail Sweep**, basic, **Ember Cone** | Keep moving: three circles fall where the hero stood, 1.65 s apart. |
| transition | at 33% | | 2.0 s, as above | |
| **III. Fury** | 33% to 0 | 1.32 s (x0.8) | basic, **Ember Cone**, **Ashen Nova**, basic, **Tail Sweep**, **Cinder Fall** x2 | The nova covers the arena except near the dragon: run **in**. Then the sweep: run **out**. |

In phase III the cadence shortens slots, never wind-ups: Ember Cone's slot is 2,640 ms (recovery 840), Tail Sweep's 2,640 (940), Ashen Nova's 2,640 (240), and Cinder Fall keeps 1,650 by the slot rule of 6.2 (recovery 150). The model applies the same rule.

**Boss attacks deal sure damage.** Inside the shape at the resolve: `power x (0.75 to 1.0)`, then the style's mitigation. No hit roll: on a boss, position alone decides.

| Attack | Power | Style | Cut by |
|---|---|---|---|
| basic | today's roll, max 32 | magic | Protect from Magic (to 20%), Defence |
| Ember Cone | 50 | fire | a warding shield, the quest's ward or Protect from Magic (to 25%: `resolveDragonfire`, unchanged) |
| Cinder Fall | 30 each | fire | the same |
| Tail Sweep | 46 | melee | Protect from Melee (to 20%), which means dropping Protect from Magic |
| Ashen Nova | 60 | pure | nothing. It must be dodged. |

No single prayer covers the fight, and the ward that existing players already own still does its job against fire.

**The mark.** Each heavy boss attack that lands leaves a mark for 12 s. Each mark adds 25% to the next heavy hit, up to four. A player who misses one shape pays once. A player who stands in everything is dead in about 26 s. Marks show as a small counter by the hitpoint bar and as a tint on the hero. The rule is pure: `addMark`, `tickMarks` and `markMultiplier` in `src/state/combat.ts` work on a small `{ count, left }` value with time as a parameter; the engine only holds that value for the hero.

**Phase gate.** `onPlayerHit` clamps a boss's hitpoints at the current phase's threshold: damage past it is lost. Then the boss is in `shift` for `shiftMs`: it takes no damage (`applied: false`, with a reason the engine shows as "untouchable", not "lost interest"), cancels any wind-up, emits `phase`, and resumes with the new pattern from its first entry one second after the shift ends.

**Arena.** The boss does not chase beyond `arenaRadius`. It returns home and heals only when the target has been farther than `arenaRadius + 6` for 5 s (a counter on the monster's logic, reset whenever the target is back inside), is beyond the 26-unit drop distance, goes down, or enters a safe zone. So stepping out of a shape never resets the fight (the cone is 12 long, the nova's safe disc is at the centre), and standing outside to shoot costs the fight. The lair moves from (-102, 100) to about (-106, 106): at today's position any arena over radius 9 overlaps the Slagfall Terrace camp (model). The final coordinates are whatever passes the world-data test, as in Stage 2.

**The fight, simulated** (2,000 seeded fights per row; food cooldown 1.8 s; eating delays the next swing by one tick; no regeneration in the fight):

| Fighter | Combat level | Wins | Mean length | Food eaten | Heavies dodged |
|---|---|---|---|---|---|
| A. Prepared and reading the fight: level 70, dragon kit with a warding shield, Protect from Magic, 20 sharks, 4 prayer potions | 86 | **93%** | 110 s | 1.4 | 94% |
| B. The same hero, never moves | 86 | **0%** | dead at 26 s | 3.4 | 0% |
| C. The same hero, 300 ms slower on every answer | 86 | **80%** | 93 s | 2.6 | 83% |
| D. The same hero, no food | 86 | 75% | 103 s | 0 | 94% |
| E. Level 60, dragon kit, 16 sharks | 74 | 81% | 116 s | 1.4 | 94% |
| F. Level 50, rune kit, no ward, no protection prayer, 10 lobsters | 60 | **6.5%** | 111 s | 7.4 | 94% |
| G. The same, never moves | 60 | **0%** | dead at 9 s | 2.1 | 0% |

Reading it: preparation (level, ward, prayer) and attention (moving) are both required, and neither alone is enough. F reads the fight perfectly and loses because the basics and the fire go through. B is fully prepared and loses because it ignores the ground. Food is the margin for mistakes, not a way to out-heal the fight (D). The acceptance thresholds in the plan are looser than these numbers: A at least 85%, C at least 65%, B and G at most 5%, F at most 15%.

### 6.5 Hit reaction (G4.6)

All of it is drawn by the engine from events. None of it writes a rules position, pauses the rules clock or blocks input. Numbers live in `src/data/feel.ts`.

| Reaction | Today | Design | On the hero | On a monster |
|---|---|---|---|---|
| **Hit stop** | none | Pose time of attacker and victim freezes. | 0 ms on basic hits taken, 80 ms on a heavy | 40 ms on a hit, 70 ms on a max hit or special, 110 ms on the killing blow |
| **Flash** | `flashTimer` set, never read | The body's materials lerp to a light colour and back. Materials are collected once at spawn. Peak under 70% white, never more than one flash per 250 ms on one body (photosensitivity). | 90 ms, on any damage | 90 ms |
| **Flinch** | monsters only (`poseMonsterLimbs`) | Kept for monsters, 260 ms. Added for the hero: an additive lean of the torso away from the blow. It never interrupts a walk or a swing. | 180 ms | 260 ms |
| **Knock-back** | none | The mesh is offset away from the blow and springs back. The rules position does not move. | 0.25 units on a heavy, 150 ms | 0.18 units, 0.35 on a max hit or special, 150 ms |
| **Damage numbers** | DOM splats: miss, hit, max hit, heal | Two kinds added: `heavy` (a telegraphed hit taken) and `blocked` (cut by a prayer or ward, shown smaller). Size steps with damage / max hit. Restyling is Stage 5's. | | |
| **Camera** | random jitter up to 0.12 on big hits dealt | A directed kick along the blow that springs back in 140 ms, plus today's jitter. Capped at 0.18 units. A heavy hit taken kicks; a boss phase change rumbles for 600 ms. Off when the browser asks for reduced motion (the rule Stage 5 states in its 6.8). | | |
| **Wind-up pose** | none | While a monster winds up it holds a raised pose (arms, head or wings by rig), driven by wind-up progress. The shape on the ground stays the source of truth. | | |
| **Low health** | none | Under 25% hitpoints: a red vignette at the screen edge (CSS, steady, no pulse under reduced motion) and the heartbeat of 6.7. | | |

**Audit finding 14** is fixed here: the special-attack spin stops accumulating a per-frame increment. The hero's facing is kept as `baseYaw`, and the drawn rotation is `baseYaw` plus an offset computed from `spinAnim` alone, so the spin is the same at 30, 60 and 144 Hz.

**The telegraph on the ground.** One flat mesh per live shape, built from the attack row: an outline at full size from the first frame, and a fill that grows from the origin to the outline as wind-up progress goes from 0 to 1, so the moment of impact can be read from the picture alone. It is unlit, drawn over the terrain with a small height offset and no depth write, and follows the ground height at its vertices so it lies on a slope. It never relies on colour alone: the outline is a shape, the fill is motion, and the cue is a sound.

### 6.6 Staying alive (G4.8)

The four items Stage 3 left here, decided together as it asked.

| Item | Today | Design | Why |
|---|---|---|---|
| **Food** | Instant, no limit | A 1.8 s cooldown on food and a separate 1.8 s on potions. Eating delays the next swing by one 0.6 s tick. The cooldown shows on the backpack slots. | Healing is now a rate, not a button to hammer: a shark every 1.8 s is 13 HP/s at the cost of a third of the hero's damage. Food finally has a job: it is the margin for a missed shape (6.4, fighter D against A). |
| **Regeneration** | 0.25 HP/s always | 0.25 HP/s only when 6 s have passed since the hero last dealt or took damage (CALL-4.5). | Regeneration is rest between fights, which is what Stage 3's model uses it for. In a fight it made food optional. |
| **Altar** | Free full heal and prayer | **Kept as it is.** | It stands in a safe zone in town; walking there is its cost. With regeneration paused in fights it is the reason to go back to town, which is where the bank and the shop are. |
| **Death** | Nothing lost | Owner decision, CALL-4.6. | See below. |

**The cost of dying (CALL-4.6).** This changes what existing players risk, so it is the owner's to choose.

| Option | What happens | Gold sink | Cost to build | Risk to existing players |
|---|---|---|---|---|
| A. Nothing (today) | Wake in town with everything. | None. Stage 3's finding stands: gold only accumulates. | None | None |
| **B. A recovery fee (recommended)** | Wake in town with every item. Pay 10% of the coins carried, at most 100 coins per combat level, nothing below combat level 15. Coins in the bank are safe. | Recurring, scales with level, capped. | One pure function and one chat line. No save change. | A level-60 hero carrying 60,000 coins loses 6,000 (about 34 hill giant kills of coin). Banking before a boss avoids it, which gives the bank a job. |
| C. A grave | Unprotected items stay where the hero fell for some minutes. | None unless a fee is added. | Ground items, which do not exist (a Stage 2 non-goal); a saved grave. | High: items can be lost for good. |
| D. Repair | Gear wears with deaths and is repaired for coins. | Recurring. | Durability on every item, a save format change, a repair counter. | Medium, and a new system to explain. |

Recommendation: **B**. The death notice gains one sentence saying what was paid; its title and "Lumbridge" stay, so the frozen test passes. The fee is taken by a new `applyDeathCost(state)`; `applyRespawn` is not edited. The fee is subtracted with Stage 3's `creditGp`, so it cannot go negative or non-finite.

**Auto-retaliation (owed by Stage 2, CALL-4.7).** When a monster's attack lands and the hero has no target, no walk in progress and no key held, the hero targets that monster. A hero who is gathering, walking or already fighting is never redirected. No setting. Without it, an aggressive camp beats on a hero who stands and takes it, which reads as a bug.

### 6.7 Sound (G4.7)

**Today** (`audio.ts`): one `tone(freq, type, duration, vol, slideTo)` that starts an oscillator now; sequences use `setTimeout` (lines 71-84), which drifts with frame load; every tone connects straight to the output, so several at once clip; the `catch` is empty; the context is created on the first sound and `resume()` is called blindly (line 37). Mute is `STATE.audioEnabled`, checked in `tone` (line 48).

**Design.**

- **A cue is data.** `src/state/soundPlan.ts` (pure) turns an event into a list of voices: `{ at, kind: 'tone' | 'noise', freq, slideTo, type, dur, vol }` with `at` in seconds from now. Tests read the plan. `audio.ts` only plays plans.
- **Scheduled on the audio clock.** `tone` takes a start offset and uses `ctx.currentTime + at`. A wind-up cue is planned with the attack's `windupMs`, so its last voice starts exactly at the resolve whatever the frame rate does in between.
- **Noise.** One cached one-second white-noise buffer through a band-pass filter gives impacts and fire a body that oscillators cannot.
- **A master chain.** Every voice goes through one gain and one `DynamicsCompressor` used as a limiter. At most 12 voices sound at once; a new one past that is dropped unless it is a wind-up cue.
- **Mute** stays one check in one place, and also stops the heartbeat.
- **Autoplay.** The context is resumed on the first pointer or key event (one listener). While it is suspended, cues are dropped, not queued, so nothing stale plays on the first click. When the tab is hidden the heartbeat stops.
- **The empty `catch` goes.** A failure to create the context is logged once and sound stays off.

| Cue | When | Sound, in words | Carries |
|---|---|---|---|
| Wind-up, `low` | melee heavies | A square tone rising a fifth over the wind-up, then a noise thump at the resolve | When to be gone |
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

The Stage 3 model found no monster between level 28 and 45 (its F12: 4,262 of 4,614 kills are hill giants), and a second hole from 45 to 68. The roster is a table, `ROSTER_SLOTS` in `src/data/roster.ts`: one row per slot with `level`, `role`, `pattern`, `model` (an existing model key or `null`), `camp`, `status: 'shipped' | 'prepared'`. A shipped slot also has a `MONSTER_TYPES` row and a camp. A prepared slot has neither and spawns nothing. A test holds the two in step.

**Reusing a model** needs two small changes: `MonsterDef` gains `model?: string` (the mesh builder, the `Monster_<key>` node lookup, the albedo and the limb poses read it instead of the type key; `createMonsterMesh` 776-791, `upgradeMonsterRigWithGltf` 76-78, `poseMonsterLimbs` 813-843), `tint?: number`, multiplied into the material colour, because the GLB's own colours override `bodyColor` (`blenderMonsters.ts` 104); and `modelScale?: number`, multiplied into the rig group's scale after the builder runs. The last is needed because size is not uniform today: most builders scale the group by `def.scale` (`monsterMeshes.ts` 140, 312, 386, 443), the scorpion's is fixed at 1.28 (line 245), and the GLB upgrade resets the clone to 1 and keeps the group (`blenderMonsters.ts` 84, 143-151). The hitbox is a child of the group, so it grows with it. The "scale" figures in the table below are `modelScale` relative to the reused monster.

| Slot | Level | Role | Pattern | Model | Camp (proposal) | Status |
|---|---|---|---|---|---|---|
| **Saltback Stalker** | 34 | Melee skirmisher | basic x3, Tail Lash | scorpion, 1.4 times its size, dark tint | Dunes, south-east of Tamarisk Pool; 3 members | **Ship now** (CALL-4.8) |
| **Thornwatch Archer** | 38 | Ranged, holds ground | basic x3, Pinning Volley | dark ranger, 1.1 times its size, green tint | Woods edge, north of Lanternway; 2 members | **Ship now** (CALL-4.8) |
| Cinder Adept | 52 | Caster | basic x3, Hexfall | dark wizard, tint | Outside Cinderstep Pass | Prepared |
| Slag Brute | 58 | Heavy melee | basic x2, Overhead Slam, Rootquake | hill giant, tint | Inside the ridge, off Cinder Stair | Prepared |
| Camp captain (unnamed) | 40 | Elite: one per camp, more hitpoints, a two-phase row in `BOSSES` | to be designed | **new model** | A giant or guardian camp | Prepared |
| Swarm creature (unnamed) | 30 | Many weak bodies, no heavy | basic only | **new model** | Dungeon | Prepared |
| Dungeon boss (unnamed) | 80 | Boss, three phases | a `BOSSES` row | **new model** | Dungeon | Prepared |

Why these two ship: they close the hole the pacing model measured, they cost no model and no bytes, and each reuses a pattern the player has already met. Why the rest wait: the 52 and 58 slots sit behind the pass where four sentries already stand, and their drops would be Stage 3's rune-to-dragon economy; the last three need a silhouette no existing model has (a captain must read as a leader at a glance; a swarm needs a small fast body; a second boss must not be a recoloured dragon). A new model is justified only when the silhouette carries the role, and each costs a Blender build, roughly 100 to 300 kB and a credit line. None is spent in Stage 4.

**Stats of the two shipped monsters**, interpolated by level between the hill giant (28) and the moss guardian (45), `catalog.ts` 460-468:

| | Level | HP | Max hit | Attack | Defence | Style | Drops |
|---|---|---|---|---|---|---|---|
| Saltback Stalker | 34 | 58 | 12 | 32 | 28 | melee | big bones; 140 to 340 coins (95%); lobster (40%) |
| Thornwatch Archer | 38 | 54 | 13 | 36 | 26 | ranged | big bones; 160 to 400 coins (95%); bronze arrows; swordfish (30%) |

No equipment drops, no bounty band, no quest step: those are Stage 3's and Stage 6's. The coin ranges sit on the line between the giant's and the guardian's. See 6.10 for what this does to Stage 3's test.

### 6.9 New names (CALL-4.9)

All original proposals. None contains a token from the Stage 2 deny-list (`tests/names.test.ts`); a test enforces that, and a person searches each before merge, as in Stage 2.

| Kind | Names |
|---|---|
| Attacks | Tail Lash, Hexfall, Pinning Volley, Overhead Slam, Rootquake, Scorch Lane, Ember Cone, Tail Sweep, Cinder Fall, Ashen Nova |
| Boss phases | Grounded, Cinders, Fury |
| Monsters shipped | Saltback Stalker, Thornwatch Archer |
| Monsters prepared | Cinder Adept, Slag Brute |

The existing dragon, its "Dragonfire" chat line and the special attack named after another game's hero keep their names: renaming existing content is the foundation design's open question Q2, not this stage's.

### 6.10 Dependencies on Stage 3 and Stage 5

Nothing here re-tunes an economy number. These are the places where Stage 4 leans on Stage 3 or changes one of its inputs:

| Stage 3 item | Stage 4 effect | Handling |
|---|---|---|
| Pacing test (its 5.3): kill counts on routes A1 and A3 | Ordinary monsters: unchanged expected damage (6.2). Regeneration paused in fights raises damage per kill slightly (a hill giant fight of about 8 s loses 2 HP of regeneration). Two new monsters at 34 and 38 may replace part of the giant plateau in the printed table. | R0 and the gate re-run the pacing test. Its assertions are order and loose floors and are expected to hold. If one fails, the fallback is stated in the plan: pause regeneration only inside a boss arena, then, if needed, leave the two monsters as prepared slots. |
| "Can win" in its model (its 4.2): the attackers' combined max hit is below max hitpoints | A heavy is worth two blows, so a camp's worst single moment rises from N to N + 1 max hits (N + 2 in a camp of four or more, where two members share a start index). | Stated here. The pacing test's assertions do not read it; the printed table may show a camp taken on slightly later. |
| The dragon in its model | The fighter may choose the dragon as a target; 1,200 hitpoints and 120 s change that choice. | The pacing test is re-run in R0 with the override in place (plan R0, M3). |
| `content-freeze` test (its G3.9): the set of monster type keys | Two keys are added. | A declared replacement (9.3): the list gains exactly these two keys. |
| `HP_REGEN_PER_SEC`, `creditGp`, `monsterHitChance`, `playerAttackProfile` | Used, not changed. | R0 confirms the names. |
| The dragon as income (its F13): 35% gear drops, back in 8.35 s | 1,200 hitpoints and 120 s make a kill about ten times rarer. Stage 3 already cut the drop rate. | Stated here; no drop is edited. |
| Ranged and magic ladders (its section 10) | Not designed here. | Deferred again (section 11). |

Stage 5: effects are built from primitives Stage 5 may reshape; every timing, size and count is in `attacks.ts` and `feel.ts`, which Stage 5 does not touch. Stage 5's task TR2 (trunks) depends on 6.1.

### 6.11 Module boundaries

| Module | Change |
|---|---|
| `src/data/attacks.ts` (new) | `AttackDef`, `ATTACKS`, `PATTERNS`, `BossDef`, `BOSSES`, `TELEGRAPH_TIME_SCALE`, `CADENCE_SECS`. Types and constants only. |
| `src/data/feel.ts` (new) | Hit stop, flash, flinch, knock-back, camera and vignette numbers; the tier table of section 10 as data. |
| `src/data/roster.ts` (new) | `ROSTER_SLOTS`. |
| `src/data/world.ts` | `MonsterDef` gains `pattern`, `model`, `tint`, `modelScale`; two new rows. `catalog.ts` is not edited. |
| `src/data/worldMap.ts` | Two camps; the lair moves; `CampDef` gains `arenaRadius?`. |
| `src/state/telegraph.ts` (new) | `inShape`, `escapeDistance`, `minWindupMs`, `shapeOutline` (the polygon the engine draws). |
| `src/state/pathfind.ts` | Scratch arrays; `maxExpanded`; `openStart`; `gridSegmentOpen`. |
| `src/state/monsterAi.ts` | Routes (6.1); patterns, wind-up, resolve, cancel (6.2); phases, gate, shift, arena (6.4); boss respawn time. New events `windup`, `resolve`, `cancel`, `phase`. |
| `src/state/combat.ts` | `rollMonsterAttack(typeKey, attack, state, marks, rand)` for heavies; the mark rule (`addMark`, `tickMarks`, `markMultiplier`). `rollMonsterHit` is not edited. |
| `src/state/sustain.ts` (new) | `canEat`, `eat`, `drink`, `regenRate(state, sinceCombat)`, `deathCost`, `applyDeathCost`, `shouldRetaliate`. Time is a parameter. |
| `src/state/commands.ts` (new) | The `PlayerCommand` union and `validateCommand` (section 7). |
| `src/state/soundPlan.ts` (new) | Event to voices (6.7). |
| `src/engine/telegraphs.ts` (new) | Shape meshes: create, fill, dispose. |
| `src/engine/reactions.ts` (new) | Hit stop, flash, flinch, knock-back, camera kick, low-health vignette. |
| `src/engine/audio.ts` | Clock scheduling, noise, master chain, voice cap, `play(plan)`, resume listener. |
| `src/engine/actions.ts`, `loop.ts`, `input.ts`, `spawns.ts`, `monsterMeshes.ts`, `blenderMonsters.ts`, `context.ts` | Wiring: events to effects; the frame's path budget and grid passed to `stepMonster`; commands dispatched; `model` and `tint`; the spin fix. |
| `src/ui/playerActions.ts`, `hud.ts`, `styles.css`, `index.html` | Combat actions go through commands; cooldown on food slots; boss bar with phase pips and marks; two splat kinds; the vignette element. |
| `README.md` | The combat section and the monster table. |

`src/state` and `src/data` still import nothing from the engine (the architecture test stays).

---

## 7. Ready for dungeons and co-op, without building either (G4.10)

**What the design gives.**

- **Rules are pure and parameterised.** `stepMonster(m, world)` takes the grid, the camps, the target, the clock step and the random source as arguments. `rollMonsterAttack`, `inShape`, `eat`, `deathCost` take state and return results.
- **Content is tables.** A dungeon boss is a `BOSSES` row, some `ATTACKS` rows and a `PATTERNS` list. No function is written for it.
- **Player actions are explicit commands.** `PlayerCommand = { kind: 'attack', targetId } | { kind: 'move', x, z } | { kind: 'eat', slot } | { kind: 'drink', slot } | { kind: 'prayer', id } | { kind: 'style', style } | { kind: 'special' }`. `validateCommand(state, cmd, now)` is pure. One engine function, `dispatchCommand`, is the only place the mouse, the keyboard and the HUD reach combat state from. Monsters get a stable `id` at spawn so a command can name one.

**How a dungeon instance reuses it.** An instance is a walk grid, a camp table and a monster list. `buildWalkGrid(walkable)` already takes the walk test as a parameter (`pathfind.ts` 10); with 6.1, monsters move by `world.grid.walkable`. The loop would call `stepMonster` with the instance's grid and camps. Shapes, phases, sound and reactions do not know which world they are in.

**How a second player reuses it.** A second player is a second source of `PlayerCommand`s and a second target. Shapes are tested against a position, so the resolve can be asked once per player. The mark, cooldowns and death cost are per state.

**What in today's code blocks that, and what this stage does about each.**

| Blocker | Where | In Stage 4 |
|---|---|---|
| One player in the rules: `StepWorld` carries one `playerX`, `playerZ`, `playerCombat`, `playerSafe` | `monsterAi.ts` 38-47 | Not changed. New code reads the target only through those four fields, so replacing them with a chosen target later is one edit. Target choice (threat) is a co-op design of its own. |
| Singletons: `STATE`, `player`, `G` | `gameState.ts` 89, `context.ts` 43, 218 | Not changed. Every new rule takes state as a parameter and never imports `STATE`. |
| Random numbers taken from `Math.random` inside engine code | `actions.ts` 181-182, 290-292, 427; `loop.ts` 580 | The engine remains the one that injects it. New rules take `rand`. A seeded source per session is a co-op need, deferred. |
| Damage applied from projectile `onImpact` closures, so the effects list owns rule timing | `actions.ts` 251-255, 337-355 | Telegraphed damage is resolved by the rules clock, never by an effect. Basic ranged and magic hits keep their closures. Deferred, with this note, to the co-op stage. |
| The player's attack formulas live in the engine | `actions.ts` 83-264 | Stage 3 moves hit chance and the attack profile out. What remains (the special, XP by style, heals) stays. Deferred to the co-op stage. |
| Movement checks the global world | `moveWithCollision` reads `isWalkable` (`collision.ts` 97-105) | Monsters use the injected grid (6.1). The hero's own step is unchanged. |
| Per-monster code keyed on the type name | `createMonsterMesh`, `poseMonsterLimbs`, `performMonsterRetaliation` 342-358, `rollMonsterHit` 226 | `model` separates look from type. Projectile choice per type stays a `switch`; it is cosmetic. Dragonfire as a rule leaves the dice for the boss, which now uses patterns. |
| UI handlers mutate state directly | `playerActions.ts` 132-275 | The seven combat commands go through `dispatchCommand`. Shops, bank and forge do not; they are not combat. |
| Monster state is not saved; the world is rebuilt on load | foundation design section 7 | Unchanged. An instance would need its own lifetime rule. |

---

## 8. Save format impact and performance budget

**Saves.** Key `gielinor_hero_save_v1`, `version` 4, fields written: all unchanged. No new saved field: cooldowns, marks, phases and monster state live for the session, as monster state does today. The recovery fee changes `gp`, which is already saved. A save written after Stage 4 loads in the build before it.

Accepted limit: because monster state is not saved, reloading the page brings a dead boss back at once, skipping the 120 s. The load takes longer than a fight's worth of food is worth, and the fight itself is the gate. Saving a boss timer would be the first world state in the save; that belongs with Stage 6's save changes.

**Budget.** No frame time has ever been recorded on a real GPU (Stage 5, section 10). Counters and counts are binding; milliseconds are estimates except where marked measured.

| Measure | After Stage 2 | After Stage 4 |
|---|---|---|
| Monsters | 36 | 41 |
| Path searches per frame, monsters | 0 | at most 2 |
| Cost of one search | 0.5 to 0.7 ms (measured, allocation-bound) | follows expanded cells; mean 120, cap 6,000 |
| Allocation per search | four 55,696-cell arrays | none after the first |
| Straight-segment tests | none | at most one per chasing monster per 0.5 s, about 52 array reads each |
| Live telegraph meshes | 0 | at most 6 (the boss's three circles and one more, plus two camps); 1 draw call each, under 200 triangles each |
| Draw calls added in a fight | | at most 8 |
| Sound voices | unbounded | at most 12 |
| DOM nodes added | | boss bar (1 block), vignette (1), cooldown overlays (up to 28 small) |
| JS bundle | 946.86 kB at the Stage 2 gate | at most 30 kB more |
| Audio or model files added | | 0 bytes |
| Per-frame allocations in new code | | none in the monster step; effects reuse scratch vectors |

---

## 9. Verification

### 9.1 Headless, in vitest

| Goal | Proof |
|---|---|
| G4.1 | `tests/monster-routes.test.ts`: a monster reaches a player behind a wall that a straight walk cannot pass; it walks straight when the segment is open and makes no search then; it re-paths at most every 0.5 s; a spent budget makes no search and still moves; a search past `maxExpanded` returns `null` and leads to `return`; a route longer than 52 leads to `return`; from 200 seeded points per camp, `return` reaches `idle` at full hitpoints within route time + 3 s; with the home walled in on a test grid it is put home when the clock runs out; without a grid, movement equals today's step for step. `tests/pathfind-budget.test.ts`: a second search allocates no new typed array; results equal the first implementation's on 200 seeded pairs; expanded cells around every camp stay under the cap. `tests/world-data-combat.test.ts`: every home cell is open; a route exists to every home from every open cell within leash + 11. |
| G4.2 | `tests/telegraph.test.ts`: `inShape` for each of the four shapes at the edge, inside and outside, and after rotation; `shapeOutline` is closed and contains exactly the points `inShape` accepts on a sample grid. `tests/monster-patterns.test.ts`: a patterned monster emits basic, basic, basic, `windup`; nothing is dealt during the wind-up; `resolve` comes `windupMs` later with `hit` true for a target that stayed and false for one that left; the next attack comes `slots x 1.65` s after the wind-up began; death, leash and phase shift during a wind-up emit `cancel` and no `resolve`; a type without a pattern emits exactly today's events (the frozen cadence tests are the control). |
| G4.3 | `tests/attack-data.test.ts`: every row satisfies `windupMs >= minWindupMs(row) + 200`; every recovery is at least 150 ms, checked for every boss phase at that phase's cadence; every pattern starts with `basic` and names existing attacks; no wind-up is under 1,100 ms; the conservation rule holds in expectation for every ordinary pattern (seeded, within 5%); every monster's `pattern` exists. |
| G4.4 | `tests/boss-phases.test.ts`: hitpoints cannot pass a threshold in one hit; overflow is lost; the boss takes no damage during `shiftMs` and says why; `phase` is emitted once per threshold; the pattern restarts at its first entry; phase III uses the faster cadence; the boss is back after 120 s and other monsters after 7.5 s; stepping to the arena edge does not send it home, and 5 s beyond `arenaRadius + 6` does. |
| G4.5 | `tests/boss-fight.test.ts`: the model of section 6.4 as a test against the live tables, 500 seeds per fighter: A wins at least 85%; C at least 65%; B and G at most 5%; F at most 15%. It prints the table. `tests/gate-simulation.test.ts` passes unchanged. |
| G4.6 | `tests/feel-data.test.ts`: every hit stop is at most 120 ms; flash peak under 0.7 and at least 250 ms apart; knock-back offsets return to 0; `spinOffset(spinAnim)` is a function of `spinAnim` alone and equal at steps of 1/30, 1/60 and 1/144 (finding 14). A text scan: `reactions.ts` and `telegraphs.ts` do not write `logic.x`, `logic.z` or `player.pos`. |
| G4.7 | `tests/sound-plan.test.ts`: for every attack, the wind-up plan's last voice starts at `windupMs / 1000` within 1 ms; every cue of 6.7 has a plan; no voice is louder than 0.2; every plan fits 12 voices. A text scan: `audio.ts` contains no `setTimeout`, and one check of `audioEnabled`. |
| G4.8 | `tests/sustain.test.ts`: a second meal inside 1.8 s is refused and consumes nothing; potions have their own clock; `regenRate` is 0 within 6 s of combat and Stage 3's constant after; `deathCost` for the chosen option at combat 14, 15 and 60, with 0 coins, and with coins at the cap; `applyDeathCost` never leaves `gp` negative or non-finite; `shouldRetaliate` is true only for an idle hero. `phase4-combat.test.ts` passes unchanged. |
| G4.9 | `tests/roster.test.ts`: every shipped slot has a monster row, a camp and a pattern; every prepared slot has none; every `model` names an existing builder; the two new monsters' stats lie between the giant's and the guardian's; neither drops equipment. `tests/names-combat.test.ts`: the deny-list over every new name. |
| G4.10 | `tests/commands.test.ts`: `validateCommand` for each of the seven kinds, accepted and refused. `tests/architecture.test.ts` passes unchanged. A text scan: no new file under `src/state` mentions `STATE`, `Math.random`, `Date.now` or `performance`. |
| G4.12 | `tests/feel-data.test.ts`: every effect of section 10 has a value for each of the four tiers, and the telegraph's outline and fill are on in all four. |

### 9.2 Needs a human looking at and listening to the running game

- **The telegraph reads.** At each of the four tiers, on grass, sand, the dark volcanic ground and a slope: the shape is visible, its edge is clear, the fill shows how long is left. Checked at noon and at night. A screenshot of each shape on each ground.
- **A fight with a hill giant** as a level-30 hero: the slam comes on the fourth attack, one click gets the hero out, the giant stands open afterwards. Then stand in it once: the number is bigger, the hero lurches, the sound is different.
- **The boss**, with a hero raised by the existing cheat and geared as fighter A: each phase is announced by the pause, the roar and the banner; the nova's safe disc is obvious; leaving the cone does not reset the fight; standing still kills. Then as fighter F: lost.
- **Sound.** The wind-up cue ends on the hit, by ear, at 60 FPS and with the tab throttled to a low frame rate. Three cue families can be told apart with eyes closed. Nothing clips when a camp of four attacks. Mute silences everything, including the heartbeat. A fresh page load makes no sound and logs no warning before the first click.
- **Control is never lost.** During hit stop, flinch and knock-back the hero still answers a click on the same frame.
- **Reduced motion** (browser setting on): no camera kick, no rumble, steady vignette.
- **Routes.** Lure a moss guardian around the ridge end and around the castle: it walks around. Lure a goblin over the bridge and leave: it walks back over the bridge.
- **Perf HUD** at Cinderstep Pass with four sentries chasing, and in the boss fight in phase II, against section 8.
- **Slow device.** With the browser's CPU throttle at 6x: the wind-ups are still answerable.

### 9.3 Declared test replacements

So they are not mistaken for weakening. Every other existing test stays as it is.

1. Stage 3's `tests/content-freeze.test.ts`: the captured list of monster type keys gains `saltback_stalker` and `thornwatch_archer`, and nothing else. Only if CALL-4.8 is accepted.
2. Stage 2's `tests/world-data.test.ts`, if it pins the dragon camp's coordinates or the monster count: the count becomes 41 and the lair's coordinates the tuned ones. R0 reads the test and names the exact lines, or records that none are needed.
Not a replacement, noted so it is not taken for one: Stage 2's `tests/stage2-review-fixes.test.ts`, "a three_kettle goblin stuck on the east bank snaps home after a stall": it stays and must pass without a grid. With the real grid the same goblin now walks home over the bridge; that is a new test, not an edit.

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
| Boss bar, marks, low-health vignette | yes | yes | yes | yes |
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
| Regeneration | Stage 3 design 7.2 | **Done here**, CALL-4.5 | 6.6 |
| The altar's free heal | Stage 3 design 7.2 | **Kept, with reason** | 6.6 |
| Death without loss; a recurring gold sink | Stage 3 design 7.2, 6.5 | **Owner decision**, CALL-4.6 | 6.6 |
| The dragon is back in 8.35 s (Stage 3 F13) | Stage 3 design section 10 | **Done here** | 6.4: 120 s |
| Audit finding 14: the special-attack spin depends on frame rate | foundation design section 9 | **Fixed here** | 6.5 |
| Player auto-retaliation | foundation design 6.5 | **Done here**, CALL-4.7 | 6.6 |
| Safespotting within one leash cycle | foundation design 6.5 | **Accepted, closed** | With routes a monster reaches a player behind an obstacle, which was the real complaint. What remains is "a ranged hero can land a few shots before a monster arrives, and a weak monster can die on the way". That is what ranged weapons are for. Line-of-sight stays a non-goal. |
| Ranged and magic gear ladders as designed curves | Stage 3 design section 10 | **Deferred to Stage 6** | They need new gear rows and prices, which are content and economy. Stage 4 supplies the two facts they were waiting for: what kiting is worth (monsters now reach the hero around obstacles; heavies are dodged the same at any range) and that ammunition is spent per swing as today. |
| Monster band between level 28 and 45 (Stage 3 F12, deferred there to Stage 6) | Stage 3 design 7.5; owner's request for prepared slots | **Two slots filled, five prepared**, CALL-4.8 | 6.8 |

---

## 12. Threat model

### 12.1 What are we working on?

The same single-player static site. No server, no account, no network call. This stage adds no parsed input and no stored field.

| Flow | Source | Trust | Sink |
|---|---|---|---|
| Attack, pattern, boss, feel and roster tables | compiled TypeScript constants | Trusted, reviewed in git | Rules, effects, sound, chat lines |
| Pointer and keyboard | the player | The player | Commands |
| Save | `localStorage` | Untrusted, validated by Stage 1's rules | `gp`, which the death fee reads |
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
| S10 | The death fee produces a negative, fractional or non-finite `gp`, or charges twice for one death. |
| S11 | Food cooldown or the swing delay can be dodged by another path (drag, right-click menu, the bank). |
| S12 | A tab left in the background returns with one huge time step. |
| S13 | Aggression or auto-retaliation traps the player: pulled into a fight on load, or unable to walk away. |
| S14 | Stage 3's pacing or the Stage 2 gate silently changes. |
| S15 | An attack or monster name reaches chat through `innerHTML`. |
| S16 | A new name or pattern is too close to an existing game's. |
| S17 | A table row is wrong: a pattern names a missing attack, a boss has no last phase, a camp sits on a safe zone. |

### 12.3 What are we going to do about it?

| Risk | Decision |
|---|---|
| S1 | Mitigate: the rule of 6.3 enforced on every row by a test; the step cap makes slow frames lengthen windows; one global scale knob. Accept: a player slower than the model's slow player dodges less and relies on food and level, as today. |
| S2 | Mitigate: `returnLeft` and `shiftMs` are clocks that only count down; tests for both, including a walled-in home. |
| S3 | Mitigate: quota of 2, cap of 6,000, closed set, scratch memory, a test on each. |
| S4 | Mitigate: shapes are disposed on `resolve` and `cancel` and on monster death through Stage 1's `disposeObject3D`; at most 12 voices, each stopped by the audio clock. The Stage 1 leak check is repeated in the human gate. |
| S5 | Mitigate: the engine draws only from `windup`, `resolve` and `cancel` events; a test that every `windup` is followed by exactly one of the other two. |
| S6 | Mitigate: the arena rule of 6.4, with tests. Accept: a ranged hero inside the arena fights from range; the nova and the cinders reach it. |
| S7 | Mitigate: the gate clamps; the threshold is passed by the first hit after the shift; the last phase's threshold is 0; tests. |
| S8 | Mitigate: flash peak and rate capped by a test; no full-screen flash anywhere; camera effects off and vignette steady under reduced motion. |
| S9 | Mitigate: resume on first gesture, drop while suspended, one mute check, limiter, heartbeat stopped on mute and on hidden. Human check on a fresh load. |
| S10 | Mitigate: one pure `applyDeathCost`, integer floor, through `creditGp`; called once from `handlePlayerDeath`, which already guards re-entry (`actions.ts` 362). Tests at 0 and at the cap. |
| S11 | Mitigate: every way to eat or drink goes through the `eat` and `drink` commands; a text scan finds no other write of `hp` from an item. |
| S12 | Already mitigated: the step is capped at 0.08 s (`loop.ts` 786), so a returning tab advances one small step. |
| S13 | Mitigate: Stage 2's safe zones and grace are untouched; retaliation only targets, never moves a hero who has a walk in progress; any click replaces the target. |
| S14 | Mitigate: both tests run in the gate; patterns start with a basic; conservation is tested. |
| S15 | Accept, with reason: names are compiled constants, the same trust as every monster name printed today. No save-derived string is added to any HTML. |
| S16 | Mitigate: the deny-list test and a human search per name. Shapes on the ground, phases and wind-ups are genre conventions, not a game's property. Accept the remainder: no test proves originality. |
| S17 | Mitigate: `attack-data`, `roster` and `world-data-combat` tests are the boundary check for compiled data. |

### 12.4 Did we do a good enough job?

By the proofs of 9.1 and the checks of 9.2. In particular: the timing rule test for S1, the two clock tests for S2, the boss simulation and the unchanged gate simulation for S14 and G4.5. If the boss simulation cannot be made to pass with the thresholds stated, the fight's numbers are wrong and the stage stops there for a re-tune by the lead, not for a weaker test.

---

## 13. CALLs for the owner to check

In plain words. The ones with a real trade-off come first.

| # | Decision | Options | Recommendation |
|---|---|---|---|
| **CALL-4.6** | **What dying costs.** Today nothing. | A: nothing. B: a fee, 10% of the coins you carry, capped by level, nothing for beginners, banked coins safe. C: a grave holding your items. D: gear repair. | **B.** It is the gold sink Stage 3 asked for, costs one function, and loses no item. It does change what existing players risk: a rich hero who dies with coins in the backpack pays. |
| **CALL-4.4** | **The dragon becomes a real boss fight.** Hitpoints 260 to 1,200, three phases, back after 2 minutes instead of 8 seconds. A geared hero's fight goes from 9 seconds to under 2 minutes, and a hero who stands still dies. | Accept; or keep 260 and add only the shapes (the fight then ends before phase II is seen). | **Accept.** Players who farm the dragon today will find it about ten times slower. |
| **CALL-4.5** | **Hitpoints stop regenerating during a fight** (they resume 6 s after the last blow), and **food gets a 1.8 s cooldown**. | Accept both; or only the cooldown; or neither. | **Accept both.** Without them food stays pointless and no fight can be lost by a stocked player. Stage 3's pacing test is re-run; the fallback if it moves is in the plan. |
| **CALL-4.8** | **Two new monsters now**, made from existing models with a new size and colour: Saltback Stalker (34) and Thornwatch Archer (38). Five more slots stay prepared and empty. | Ship two; ship none (all seven prepared); ship four (adds 52 and 58). | **Ship two.** They fill the hole the pacing model measured and cost no download. They change the kill mix Stage 3 printed, and they are recoloured creatures, which some players notice. |
| **CALL-4.3** | **The start region has no telegraphed attacks.** Chickens and goblins fight as today; the first shape is met at the scorpions or the wizards. | Accept; or give goblins a gentle one as a tutorial. | **Accept.** A frozen test pins goblin timing, and Stage 3 owns the first hour. |
| **CALL-4.7** | **The hero fights back on its own when attacked while idle.** Never while walking, gathering or fighting something else. No setting. | Accept; or leave as today (stands and takes it); or add an on/off setting. | **Accept**, without a setting. |
| **CALL-4.2** | **No new buttons.** No dodge, block or parry key. The answers are the clicks the game already has. | Accept; or add a dodge key. | **Accept.** A dodge key is a different game and breaks touch later. |
| **CALL-4.1** | **The essence list**, plus: a mouse alone is enough, and control is never taken from the player (no stun, no push). | | Accept. |
| **CALL-4.9** | **The new names**: ten attacks, three phases, four monsters. | | Accept, subject to the name search. |
| **CALL-4.10** | **Ordinary monsters hit as hard as today on average.** A heavy blow is worth two normal ones and replaces two; stepping out avoids it. | Accept; or make heavies extra damage on top (harder game, re-tunes Stage 3). | **Accept.** |
| **CALL-4.11** | **Sound is synthesised, no audio files.** | Accept; or commission or license samples later. | **Accept** for this stage. |
| **CALL-4.12** | **What is deferred again**: ranged and magic gear ladders (Stage 6); saving a boss's respawn timer (Stage 6); the rest of the co-op blockers in section 7. | | Accept. |
| **CALL-4.13** | **No new model in this stage.** Three prepared slots wait for one. | | Accept. |

---

## 14. Risks

| # | Risk | Likelihood | Effect | Answer |
|---|---|---|---|---|
| X1 | The shapes do not read on some ground or tier. | Medium | The core mechanic fails by eye. | The human check is per ground and per tier and comes before the boss work; outline plus fill plus sound. |
| X2 | The model's player is not a real player: real people dodge worse, or better. | High | The boss is too hard or too easy. | Every number is a table row. The play check tunes powers and wind-ups inside the timing rule; the simulation thresholds are loose on purpose. |
| X3 | Stage 3 lands with different names or formulas than its design. | Medium | Tasks point at missing symbols. | R0 re-checks before any code and edits the plan, not the code. |
| X4 | `monsterAi.ts` takes three changes in a row (routes, patterns, phases) and grows hard to read. | Medium | Regressions in Stage 2 behaviour. | The frozen Stage 2 tests run after each; the three changes are serial and each has its own tests first. The file stays under the 1,000-line limit; if it passes 600 the pattern code moves to its own module in the same task. |
| X5 | Pausing regeneration or adding monsters moves Stage 3's pacing test. | Low | A red test at the gate. | The stated fallbacks (6.10). |
| X6 | Web Audio behaves differently across browsers (suspended contexts, compressor defaults). | Medium | Silence or harsh sound on one browser. | Human check on two browsers; failure degrades to silence, never to an error. |
| X7 | The grid and the continuous walk test disagree at an edge and a monster stalls. | Medium | A monster gives up a chase early. | The stall backstop sends it home in bounded time; the same disagreement was handled for the hero in Stage 2's review fixes. |
| X8 | Stage 5 rewrites `vfx.ts` and `styles.css` while Stage 4's effects are new there. | Medium | Merge work. | New effects live in new files (`telegraphs.ts`, `reactions.ts`); `vfx.ts` gains nothing. |
| X9 | A 1,200-hitpoint boss feels long at 0.6 s per swing. | Medium | Boredom, not difficulty. | Three phases of about 35 s each with a pause between; the play check can lower hitpoints, since the gate keeps every phase visible at any value. |
| X10 | The fee surprises an existing player. | Medium | Complaints. | The death notice says what was paid and that banked coins are safe; nothing below combat 15. |

---

## 15. What could not be verified

- **Anything that needs the running game.** Whether a shape reads, whether a hit feels heavy, whether a cue lands on the beat by ear, whether the fight is fun. No dev server, build or test was run.
- **The player's swing arithmetic in the model** is transcribed by hand from `actions.ts`. After Stage 3 it becomes a function the boss test calls.
- **The model's player.** Reaction time (log-normal, median 550 ms), a 5% chance of not noticing, a fixed eating rule and a fixed cost for stepping out are assumptions.
- **Search cost after the scratch-array change** is an estimate. The 0.5 to 0.7 ms figure is today's code on this machine under load from other agents.
- **The lair's new position.** Walkable cells were counted within 16 units of today's lair only; the strip between z = 116 and the bound was not sampled. The task tunes it against the test.
- **Stage 3's code.** Its design was read; its branch is not in this tree. Names used here (`creditGp`, `HP_REGEN_PER_SEC`, `monsterHitChance`, `playerAttackProfile`, `content-freeze`) come from that design.
- **Whether Stage 2's `world-data` test pins the lair's coordinates or the monster count.** R0 reads it.
- **Stage 2's last two review fixes** (`2b5086a`, `74f7ea4`) were read as diffs. They add `entityAim`, `walkSpent`, `stallTime` and `escapeStall` to `pathfind.ts` for the hero's walk; nothing here contradicts them, and the plan names functions, not lines.
- **That the new names are unused elsewhere.** Only a person's search can say.
- **Web Audio scheduling accuracy and the compressor's sound** on real browsers.
