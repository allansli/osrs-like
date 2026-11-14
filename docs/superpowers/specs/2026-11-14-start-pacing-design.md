# Start and pacing: design

Date: 2026-11-14. Branch: `feat/start-pacing`, cut from `main`. All line numbers refer to commit `a8cad85`. Stage 2 (`feat/world-place`) is being built now and will move some of them; every task in the plan finds symbols by name.

Status: proposal. The owner has not reviewed any of it. Every decision marked **CALL** is the lead's proposal and needs the owner's check (collected in section 12). Nothing here has been agreed.

Critiqued on 2026-11-14 (`docs/superpowers/specs/2026-11-14-start-pacing-critique.md`, verdict READY-WITH-FIXES). The fixes the critique was confident in are applied in place. The rest are owner questions Q3.5 to Q3.9 (section 15). An independent re-implementation of the model reproduced the "today" rows of 4.3 within 2 minutes, but not the A1 row (see the note under 4.3).

Inputs read for this document: `docs/superpowers/specs/2026-11-13-world-foundation-design.md` (called "the Stage 1-2 design" below; its sections 6, 9 and 9.1 in full), `docs/superpowers/plans/2026-11-13-world-foundation-plan.md`, `docs/audit/2026-11-13-findings.json` (findings 6 and 9), `src/data/*.ts`, `src/state/*.ts`, `src/engine/actions.ts`, `src/engine/session.ts`, the parts of `src/engine/loop.ts`, `src/engine/runtime.ts`, `src/ui/stations.ts` and `src/ui/playerActions.ts` that touch the economy, the tests that pin economy values, and the Stage 2 branches `feat/world-place`, `wp/A`, `wp/B`, `wp/W` as they stand today.

This document covers one stage:

- **Stage 3: Start and pacing.** "Begin with almost nothing and earn the equipment."

Stage 3 lands after Stage 2 is merged. It depends on Stage 2's camps, aggression and the gated corner, and changes none of them.

**How the numbers were produced.** Every time in this document comes from an expected-value model written as a scratch script for this design. The script is not committed. It imports the real data tables, but its combat and gathering formulas are transcribed by hand from `src/engine/actions.ts`. No test, type check, build or dev server was run for this document. The plan's first tasks move those formulas into `src/state` and commit the model as a test that calls them, so the numbers become a proof instead of a claim (section 9). Section 4.2 lists the model's assumptions.

---

## 1. Intent and why

The owner's sentence for this stage: "Start and pacing: begin with almost nothing and earn the equipment." The first hours should be a designed experience: what the hero starts with, what they can reach first, how long each tier of equipment takes to earn by gathering, smithing, drops and the shop, and what each step unlocks.

Today none of that is designed. Measured with the model (section 4), a new character on the shipped defaults:

- starts with 23 of 28 backpack slots filled, including a full bronze kit, a bow with 50 arrows, and a staff of mithril-grade power with 80 casts (`gameState.ts` 58-81), plus 500 GP (27);
- wears a full **rune** kit after about **17 minutes** and a full **dragon** kit after about **38 minutes** (table 4.3, row T2);
- has earned about 0.8 million GP by then, against 61,245 GP for every melee kit from iron to dragon combined.

Three things cause it, in this order: experience is multiplied by 10 by default (28), monsters drop the next tier's armour on one kill in five (`catalog.ts` 448-473), and the shop sells every one of about 300 items at list price from the first minute (`stations.ts` 289) while income is 16 to 160 times what the whole price list costs. Crafting adds holes of its own: one recipe turns 360 GP of gold ore into a platebody that sells for 5,330 GP.

Stage 3 makes the levels come first and the equipment be earned after them, with the smallest set of changes that the model says is enough.

### Essence to preserve (CALL-3.1)

Unchanged from the Stage 1-2 design: progression by skills on the existing XP curve (`OSRS_XP_TABLE`, `skills.ts` 6-14), click-to-act, the 28-slot backpack, bank, shops, forge, the faceted painted look. Existing saves under `gielinor_hero_save_v1` (version 4) keep loading, and a player who already owns gear or gold keeps it.

Stage 3 changes no combat formula, no item price, no item requirement, no monster stat, no coin drop, no quest reward, no XP value and not the gather success formula. It does change one gathering rule (fishing spots deplete, 7.1 item 4) and five Slayer bounties (7.1 item 8).

---

## 2. Constraints

| # | Constraint | Consequence |
|---|---|---|
| C1 | The XP curve does not change. | The level a tier needs (5, 10, 15, 20, 30, 40, 60) costs the experience it costs today. |
| C2 | Combat feel belongs to Stage 4. The attack tick (0.6 s, `context.ts` 8), the hit and damage formulas (`actions.ts` 95-115, 173-176), hitpoint regeneration (`loop.ts` 109-110), the altar and the cost of dying stay as they are. | With C1 this fixes how fast levels come: at 1x a fresh character reaches the levels for rune in 67 to 85 minutes of model-optimal play, and for dragon in 4.5 to 5.7 hours (4.3, rows T1 and T2). Stage 3 cannot stretch that and does not try to. It makes the gear arrive after the level, not before it. |
| C3 | No new creature models, no Blender work, no new skills, quests or dungeons (Stage 6). | Stage 3 adds no item, monster, quest, recipe id or place. It re-tunes tables and adds rules. A test freezes the id sets (G3.9). |
| C4 | New content must have original names. | Nothing new is named in Stage 3, so there is nothing to check. Bars, the only "new" recipe inputs, already exist as items (`extras.ts` 10-14). |
| C5 | Saves: key `gielinor_hero_save_v1`, `version: 4`. | No format change, no new saved field, no migration (section 8). |
| C6 | Existing tests are frozen (plan rule). Tests pin: every quest's GP (`tests/phase2.test.ts` 59-91), the goblin Slayer bounty of 400 GP (153), rune and arrow buy prices at list (`src/__tests__/bulk-buy.test.ts` 28-35, `tests/shop-gathered.test.ts` 37), `fletch_shortbow` from one oak log (`tests/phase1.test.ts` 217-221), `cook_shrimp` and `fletch_bronze_arrows` inputs (`tests/rule-fixes.test.ts` 42-54). | The design keeps all of them true. No test is replaced. Section 9.3 lists what was checked by reading, because the suite was not run. |
| C7 | Vitest runs in `node` with no DOM. | Every automated proof is DOM-free. What needs a screen is a human check. |
| C8 | Stage 2 edits `actions.ts`, `combat.ts`, `monsterAi.ts`, `session.ts`, `loop.ts` and `README.md`. | Stage 3 starts from `main` after the Stage 2 merge. Its first task re-runs the model on the merged world (plan P0, T1). |
| C9 | Each mechanism is as simple as it can be: data tables and pure functions in `src/state` and `src/data` with tests, thin engine wiring. | One constant for the shop, one function per rule. No stock system, no item quality, no currency. |

---

## 3. Goals, non-goals, anti-goals

Goals:

- **G3.1** A new game starts with a weapon, three meals and 25 GP, at 1x experience. Nothing else.
- **G3.2** Every equipment tier is earned: in the pacing model, at 1x, each tier's kit is first worn inside its window (section 5), by the shop route, by the drop-and-Slayer route and by the smithing route.
- **G3.3** Money cannot be printed by crafting: no recipe's output sells for more than 2.5 times what its inputs sell for (one named exception that a frozen test pins), and fishing earns no more than 1.5 times what mining or woodcutting earns at a comparable level.
- **G3.4** Smithing uses bars (audit finding 9).
- **G3.5** Gold is capped during play, not only on load (Stage 1 review finding). Stack counts keep their load cap; play cannot reach it (7.1 item 6).
- **G3.6** The player is told what each level unlocks.
- **G3.7** A version-4 save loads to exactly the state it loads to today. A player with gear keeps it. The save format does not change.
- **G3.8** The model that produced the numbers is a committed test that calls the game's own formulas.
- **G3.9** No new item, monster, recipe id, quest or name.

Non-goals: ranged and magic gear ladders as designed curves (they are checked for parity only, 4.7), new recipes for steel, black, adamant or dragon gear, a monster between level 28 and 45, tools, food that matters, a cost for dying, shop stock that changes by place, quests that lead the first hour.

Anti-goals:

- No change to the XP table, to XP per action, to any combat formula or to the gather success formula. The one gathering rule that changes is named: fishing spots deplete (7.1 item 4).
- No edit to any item's `price` or `req`. Three hundred hand-set numbers stay as they are.
- No change to coin drops or quest rewards.
- No new saved field.
- No removal of the 10x experience option or of the cheat codes.

---

## 4. The pacing model

### 4.1 What is measured

A **tier** is worn when the hero's weapon, body and legs all require at least that tier's level: bronze 1, iron 5, steel 10, black 15, mithril 20, adamant 30, rune 40, dragon 60 (`catalog.ts` 37-46, 82-124). The **level gate** is the first moment Attack and Defence both reach that level. Times are minutes or hours of play from a new game.

List prices of the three-piece kits (weapon + body + legs, `catalog.ts`): bronze 195, iron 535, steel 1,110, black 1,590, mithril 2,110, adamant 5,000, rune 12,900, dragon 38,000. Total from iron to dragon: 61,245 GP.

### 4.2 Assumptions

- Expected values, no dice. A melee fighter using the controlled style, so each point of damage gives 1.4 Attack, 1.3 Strength, 1.3 Defence and 1.5 Hitpoints experience (`actions.ts` 202-210), times the multiplier (`playerActions.ts` 56).
- Swing every 0.6 s (`context.ts` 8, `loop.ts` 223-224). Player max hit, accuracy and hit chance from `actions.ts` 112-114 and 173-174; average damage of a hit with max hit M is (1 + M(M+1)/2)/(M+1) (176). Monster hit chance and damage from `actions.ts` 298-303 and 316, one attack every 1.65 s (`monsterAi.ts` 45).
- A monster is back 8.35 s after it dies (`monsterAi.ts` 46-47). Time per kill = the larger of (kill time + 1.5 s to reach the next one) and ((8.35 + kill time) / monsters of that type), plus rest. Rest is the time to regenerate, at 0.25 HP/s (`loop.ts` 110), whatever damage the fight cost beyond regeneration and the food the monster drops.
- The fighter always attacks the type that gives the most monster-HP per second among the types it can win against. "Can win" means: expected damage taken in one kill is at most 60% of max HP, and the attackers' combined max hit is below max HP.
- **Stage 2 rules** (Stage 1-2 design 6.4): a camp attacks a player whose combat level is at or below the monster's level. Then every member attacks at once: 3 scorpions, 3 wizards, 2 rangers, 4 giants, 2 guardians, 2 demons. These camp sizes are the design's table; the final camps are not written yet (Stage 2 task W5).
- Gear: only weapon, body and legs are bought. **Purchase rule (pinned after the critique, CALL-3.2):** after every kill, for the weapon, then the body, then the legs, take the highest tier above the one worn that the fighter can wear (the weapon by Attack, body and legs by Defence) and that it either owns or can afford at the shop price, and equip it. Never wait for a higher tier while a better affordable one exists. Each purchase costs 40 s. Kit table: bronze, iron, mithril, adamant, rune and dragon scimitars, the steel longsword and the black scimitar; the plate body and legs of each tier, and the dragon platebody (`dragon_chain`). A dropped kit piece counts as obtained when its expected count reaches 1 (after 1/chance kills). Every other gear drop is sold at 65% (`items.ts` 70-75). Bones and food are not sold. The rule matters. Read as "buy only the highest tier you can wear", the same text gives a fighter that skips iron to black and wears mithril at 37 minutes (critique 1.1).
- Slayer, when used: the fighter takes the task `pickSlayerBand(combatLevel)` gives whenever it has none, and counts the bounty (spread over the task's kills, plus 10 s per task for the walk to the master, `worldBuild.ts` 232) only on kills of the task's monster. It keeps choosing targets by the rule below: a task it cannot win against pays nothing until the fighter can. The per-kill Slayer XP and the bounty XP go to Attack unmultiplied (`adventure.ts` 366-376). Quests: in the "after" rows the two start-town quests pay 1,300 GP, 250 Attack and 250 Hitpoints XP at the first goblin kill and cost 90 s each; "today" rows ignore quests because today's start needs no money. *The A3 rows of 4.3 were produced before this rule was written down; plan M1 re-measures them.*
- Not modelled: ranged and magic (4.7), amulets, rings and capes (4.6), prayers, special attacks, deaths, banking, the walk between regions (30 s per change of monster type is added).
- Gathering: time per item = the larger of (0.6 s / success chance + 1 s to step to the next node) and ((respawn + 0.6 s / success chance) / nodes at the site). A **site** is the largest group of nodes of one type in which each stands within 15 units of another. On `main` (`placements.ts`): copper 2, iron 3, mithril 2, gold 3, runite 2; normal trees 3, oaks 2, willows 2, maples 3, yews 2, magic trees 2; shrimp spots 3, trout 1, lobster 2, shark 2. Success chance is min(0.92, 0.50 + 0.02 x (level - requirement)) (`actions.ts` 425). Fishing spots deplete on 35% of catches (432). Crafting is instant (`playerActions.ts` 408-419).
- "Model-optimal" means a player who never stops, never dies and always knows the best target. A real player is slower. This document assumes about twice as slow and marks that as an assumption, not a measurement.

### 4.3 Time to each tier

Kit worn, model-optimal. "m" is minutes, "h" hours.

| Row | Case | XP | bronze | iron | steel | black | mithril | adamant | rune | dragon |
|---|---|---|---|---|---|---|---|---|---|---|
| T2 | **Today as shipped**, world of `main`, no Slayer | 10x | 0 | 3 m | 4 m | 9 m | 10 m | 12 m | 17 m | 38 m |
| T1 | Today, world of `main`, with Slayer | 10x | 0 | 3 m | 4 m | 9 m | 9 m | 12 m | 18 m | 44 m |
| T4 | Today plus Stage 2 rules, no Slayer | 10x | 0 | 3 m | 6 m | 8 m | 12 m | 13 m | 18 m | 44 m |
| T3 | Today plus Stage 2 rules, with Slayer | 10x | 0 | 3 m | 6 m | 9 m | 12 m | 15 m | 22 m | 60 m |
| T2 | Today, player switches to 1x, no Slayer | 1x | 0 | 5 m | 9 m | 15 m | 21 m | 36 m | 69 m | 4.5 h |
| T4 | Today plus Stage 2 rules, 1x, no Slayer | 1x | 0 | 4 m | 10 m | 16 m | 23 m | 40 m | 73 m | 5.2 h |
| T3 | Today plus Stage 2 rules, 1x, with Slayer | 1x | 0 | 5 m | 13 m | 21 m | 30 m | 54 m | 1.7 h | 7.8 h |
| A1 | **After**, shop only (no drops used, no Slayer) | 1x | 5 m | 21 m | 31 m | 45 m | 53 m | 76 m | 2.1 h | 5.5 h |
| A3 | **After**, shop + drops + Slayer | 1x | 5 m | 13 m | 23 m | 43 m | 54 m | 63 m | 1.8 h | 7.9 h |
| S | **After**, smithing route (level gate of A1 + skilling time of 7.1 item 5; runite also needs a way through Stage 2's pass) | 1x | 2 m | 11 m | - | - | 36 m | - | 2.1 h | - |
| A3 | After, player turns the 10x option on | 10x | 5 m | 13 m | 20 m | 29 m | 29 m | 34 m | 71 m | 86 m |

**Independent check (critique 1.1).** A second implementation of 4.2, written from the code without this script, gives the same "today" rows within 2 minutes. For A1 it gives 5 / 18 / **37** / 49 / 58 / 83 m / 2.3 h / 5.4 h, under the purchase rule now written in 4.2. That is 6 to 19% later from steel on. Steel then misses its window, and the waits after the level at black, mithril and adamant (32, 34, 38 minutes) exceed the 30-minute bound of section 5. No markup from 8 to 12 passes every bound in that implementation. **Row A1 is therefore not reproduced.** The bounds of section 5 are less robust than the spread between two honest implementations, and plan M1 now measures the "after" rows before any data changes (Q3.5).

Level gates in the "after" rows at 1x, for comparison: iron 8 to 9 m, steel 12 to 16 m, black 22 to 27 m, mithril 28 to 37 m, adamant 48 to 62 m, rune 83 m to 1.8 h, dragon 5.4 to 7.9 h. (A3 is slower to level than A1 because the walk to the Slayer master costs fighting time.)

Reading the table:

- Today the kit is worn within two minutes of the level gate at every tier, at either multiplier. Money never binds. The 10x default then compresses the levels themselves to under 40 minutes.
- After the design, at 1x, the kit comes after the level. A player who ignores Slayer waits 13 to 28 minutes from iron to adamant. A Slayer user waits 4 to 7 minutes at iron and steel and 16 to 18 at black and mithril; from adamant on, hill giants pay enough that the level is the limit again. Dragon is level-bound for everyone. (Buying three pieces takes 2 minutes in the model, so 2 is the floor.) The "today" rows also wear the starter's helm, shield, cloak, gloves and boots; the "after" rows wear only weapon, body and legs.
- **Most of the distance between today and after is the experience rate, not the economy.** Switching today's game to 1x already moves rune from 17 to 69 minutes and dragon from 38 minutes to 4.5 hours (rows T2). The price, drop and bounty changes do not lengthen the game: they put the wait between reaching a level and wearing its gear, and they stop the gear from arriving early. Rune and dragon come when the levels come, before and after.
- With 10x turned on after the design, levels come eight times faster but the gear only about twice as fast (dragon at 86 minutes instead of 7.9 hours). The option stays a fast mode without making the gear free.

### 4.4 Where the money comes from

Per kill (`catalog.ts` 443-478, `world.ts` 51-76, `adventure.ts` 25-30):

| Monster (level) | Coins | Gear sold, today | Gear sold, after | Slayer bounty, today | after |
|---|---|---|---|---|---|
| Chicken (1) | 10 | 0 | 0 | - | - |
| Goblin (2) | 22 | 41 | 2 | 67 | 67 |
| Goblin archer (5) | 13 | 5 | 0.2 | - | - |
| Scorpion (12) | 64 | 117 | 6 | 180 | 60 |
| Dark wizard (18) | 107 | 484 | 24 | 240 | 80 |
| Dark ranger (24) | 76 | 104 | 5 | - | - |
| Hill giant (28) | 176 | 522 | 26 | 360 | 120 |
| Moss guardian (45) | 350 | 1,591 | 80 | 800 | 275 |
| Lesser demon (68) | 715 | 4,784 | 239 | 1,375 | 450 |
| The dragon (95) | 2,800 | 18,769 | 2,681 | - | - |

Over the T1 run at 1x (5.7 hours to dragon) the fighter earns 1.1 million GP in coins, 7.2 million from selling dropped gear and 1.8 million in bounties: 10.2 million GP against a price list of 61,245. Dropped gear is 71% of it.

### 4.5 Gathering, smithing and crafting today

Per hour at the requirement level, rising to the right as the level passes it by 21 (model, `catalog.ts` 483-498, `world.ts` 83-93, `placements.ts`):

| Node | Req | Nodes at a site | Items/h | XP/h at 1x | GP/h sold |
|---|---|---|---|---|---|
| Copper rock | 1 | 2 | 1,263-1,397 | 35-39k | 13-14k |
| Iron rock | 10 | 3 | 1,612-1,755 | 93-102k | 44-47k |
| Mithril rock | 25 | 2 | 878-941 | 105-113k | 65-70k |
| Gold rock | 35 | 3 | 1,174-1,248 | 205-218k | 141-150k |
| Runite rock | 50 | 2 | 590-618 | 189-198k | 238-249k |
| Normal tree | 1 | 3 | 1,636-1,911 | 41-48k | 11-13k |
| Oak | 10 | 2 | 935-1,007 | 51-55k | 19-20k |
| Willow | 20 | 2 | 878-941 | 83-89k | 42-45k |
| Maple | 30 | 3 | 1,241-1,325 | 149-159k | 88-94k |
| Yew | 35 | 2 | 742-787 | 130-138k | 91-97k |
| Magic tree | 50 | 2 | 643-676 | 199-210k | 201-211k |
| Shrimp spot | 1 | 3 | 2,323-3,592 | 70-108k | 16-25k (cooked) |
| Trout spot | 12 | 1 | 1,895-2,662 | 129-181k | 55-77k (cooked) (corrected by the critique; the first draft copied the shrimp row) |
| Lobster spot | 28 | 2 | 2,323-3,592 | 314-485k | 195-302k (cooked) |
| Shark spot | 45 | 2 | 2,323-3,592 | 569-880k | 423-654k (cooked) |

Everything except equipment stacks in the backpack (`items.ts` 60-62), so gathering never fills the 28 slots and never needs the bank.

Smithing route (mine, then forge the tier's scimitar, legs and platebody), skilling time only at 1x: bronze under 1 minute, iron 3 minutes, mithril 9 minutes, rune about 66 minutes. That is always less than the time the combat levels take (3, 19 and 67 minutes in row T2 at 1x), so a smith has the kit waiting when the level arrives. Steel, black, adamant and dragon have no recipe.

Crafting for sale, sale value of the output against the sale value of the inputs (`catalog.ts` 416-428, `recipes.ts` 22-29, 96-100):

| Recipe | Inputs sell for | Output sells for | Ratio | GP/h |
|---|---|---|---|---|
| Gilded platebody, 3 gold ore, Smithing 38 | 360 | 5,330 | 14.8 | 2.1 million |
| Gilded platelegs, 2 gold ore, Smithing 35 | 240 | 4,225 | 17.6 | 2.5 million |
| Magic longbow, 1 magic log, level 50 | 312 | 4,160 | 13.3 | 2.7 million |
| Yew bow, 1 yew log, level 35 | 123 | 1,365 | 11.1 | 1.0 million |
| Maple shortbow, 1 maple log, level 25 (maples stand in the start town) | 71 | 585 | 8.2 | 726k |
| Willow longbow, 1 willow log, level 15 | 48 | 292 | 6.1 | 256k |
| Rune platebody, 3 runite ore, Smithing 45 | 1,209 | 3,380 | 2.8 | 665k |
| Mithril platebody, 3 mithril ore | 222 | 552 | 2.5 | - |
| Oak shortbow, 1 oak log, level 5 | 20 | 61 | 3.1 | 57k |

### 4.6 Findings

"Free" means the player gets it without the effort the tier should cost. "Stall" means progress has no good next step.

| # | Finding | Where | Kind |
|---|---|---|---|
| F1 | The start kit fills 23 of 28 slots: full bronze armour, hood, cloak, shield, gloves, boots, a wizard robe set, a bow with 50 arrows, the Staff of Fire with 80 casts, 15 law runes, food, potions, 500 GP. | `gameState.ts` 27, 47-82 | Free |
| F2 | Experience is times 10 by default. Level 40 in Attack, Strength and Defence takes about 15 minutes. | `gameState.ts` 28, `playerActions.ts` 56 | Free |
| F3 | Monsters drop the next tier's gear at 8 to 24% per piece, the dragon at 35%. Selling it is 71% of all income. | `catalog.ts` 448-478, `world.ts` 51-76 | Free |
| F4 | The shop sells every item at list price from the first minute. Income is 160 times the price list, so money never decides anything. | `stations.ts` 289, `inventory.ts` 173-192 | Free |
| F5 | Crafting prints money: gilded armour at 15 to 18 times its inputs, bows at 6 to 13 times, rune smithing at about 3 times. | 4.5 | Free |
| F6 | Fishing spots almost never run out (35% depletion, 2 to 3 s respawn), so fishing yields two to four times the items, experience and gold of any other gathering at the same level. | `actions.ts` 432, `catalog.ts` 495-498 | Free |
| F7 | Bars cannot be used for anything (audit finding 9). | `recipes.ts` 96-100, `catalog.ts` 416-428 | Stall |
| F8 | Gold and stack counts are capped only on load (Stage 1 review). | `save.ts` 34, `inventory.ts` 75 | Robustness |
| F9 | Staying alive costs nothing: 15 HP per minute of regeneration, a free full heal at two altars, and death keeps everything. Food has no job. | `loop.ts` 110, 213-215, `adventure.ts` 228-242 | Free, not changed here (7.2) |
| F10 | Slayer pays two to three times the coins of the kills it asks for (goblin: 67 against 22; hill giant: 360 against 176). A Slayer user never waits for money at any sensible shop price. | `adventure.ts` 25-30 | Free; reduced above the first band (7.1 item 8) |
| F11 | Some of the strongest pieces have no real requirement: Amulet of Fury, Berserker Ring and the Fire Cape need Attack 1 or Defence 1; the Staff of Fire needs Magic 1 and hits for 10 at level 1 where a bronze scimitar hits for 3. | `catalog.ts` 65, 331, 337, 343 | Price-gated after the design (4.7, 7.4) |
| F12 | Hill giants are the best target from combat level 29 until about level 60: 4,262 of 4,614 kills in row A3. The next monsters are level 45 (two attack at once) and 68 (behind the gate). | `catalog.ts` 460-473 | Stall, not fixed here (7.5) |
| F13 | The dragon is back 8.35 s after it dies and drops four pieces at 35% each. | `monsterAi.ts` 46-47, `catalog.ts` 478 | Free; drop rate changed, respawn left to Stage 4 |
| F14 | Steel, black, adamant and dragon gear can only be bought or dropped. | `catalog.ts` 416-428 | Accepted (7.5) |
| F15 | The model measures a player who only fights. Money from gathering and crafting is out of it. After the design, maple bows earn about 181k GP an hour at level 25 (7.1 item 5), against roughly 66k an hour of scorpion coins at combat 28 and 110k to 167k from hill giants at combat 34 to 57 (critique M-1). A player who gathers and crafts affords each kit 2 to 3 times sooner than routes A1 and A3. That is earning and is accepted. The wait after the level is a property of the fighting routes only. | 4.5, 7.1 item 5 | Accepted, printed by the pacing test (plan M1) |
| F16 | "Reset" does not start a new game. `resetGameSave` removes the save and reloads, but `beforeunload` (`runtime.ts` 159) runs `saveGameState`, which writes the old character back (`session.ts` 10-35, 94-101). An existing player cannot reach the new start except from a private window. | `session.ts`, `runtime.ts` | Defect, fixed in 7.1 item 1 (found by the critique) |

### 4.7 Ranged and magic

Not simulated through the tiers. Checked at level 1 against a goblin, damage per swing: bronze scimitar 1.46, bare hands 1.03, oak shortbow 2.30, Staff of Fire with Wind Strike 4.58 (`actions.ts` 103-108). A shot costs an arrow (8 GP in the shop, or about 3 GP fletched, `extras.ts` 5-6, `recipes.ts` 85-93); a cast costs 11 GP of runes (`magic.ts` 21, `extras.ts` 16-17). A goblin pays 22 GP in coins.

So today the free staff makes magic three times as strong as melee from the first minute. After the design the staff is 3,200 GP and each cast still costs about what the kill pays: magic and ranged level faster and earn slower. That is a trade, not a shortcut, and no change is proposed. It is not proven by the model; it is listed in section 14.

---

## 5. The curve Stage 3 commits to

Windows for the first time a tier's kit is worn, at 1x, model-optimal, by any earning route. The pacing test (G3.2) asserts them.

| Tier | Window | Shop only (A1) | Shop + drops + Slayer (A3) | Smithing (S) |
|---|---|---|---|---|
| Bronze | 1 to 8 m | 5 m | 5 m | 2 m |
| Iron | 8 to 25 m | 21 m | 13 m | 11 m |
| Steel | 15 to 35 m | 31 m | 23 m | no recipe |
| Black | 25 to 50 m | 45 m | 43 m | no recipe |
| Mithril | 30 to 60 m | 53 m | 54 m | 36 m |
| Adamant | 50 to 90 m | 76 m | 63 m | no recipe |
| Rune | 1.5 to 2.5 h | 2.1 h | 1.8 h | 2.1 h |
| Dragon | 5 to 9 h | 5.5 h | 7.9 h | no recipe |

The windows alone do not prove the design: today's prices and drops with only the new start and 1x would also sit inside them (5 / 9 / 17 / 28 / 37 / 61 minutes with Slayer). What the economy changes add is the **wait after the level**, so the test asserts that too.

| Minutes between the level gate and the kit, at 1x | iron | steel | black | mithril | adamant |
|---|---|---|---|---|---|
| Shop only (A1) | 13 | 19 | 23 | 26 | 28 |
| Shop + drops + Slayer (A3) | 4 | 7 | 16 | 18 | 1 |
| For contrast: the new start with today's prices, drops and bounties | 1 | 2 | 2 | 2 | 1 |

Asserted: on A1 the wait is between 10 and 30 minutes from iron to adamant; on A3 it is at least 3 minutes at iron and steel and at least 10 at black and mithril. These bounds, like the windows, were chosen after seeing the model's output (section 14).

**Negative control (added after the critique).** The pacing test also runs the contrast row above: new start, 1x, today's prices, drops and bounties. It asserts that this row *fails* the wait assertion. Without that assertion, nothing shows that the test can tell the two economies apart. The absolute windows cannot do it reliably: the contrast row sits inside them with Slayer and misses them without it (critique 1.1).

**Robustness (critique C-1, H-1).** The slack between the A1 row and its bounds is 2 to 6 minutes (iron 21 in 8-25, steel 31 in 15-35, adamant wait 28 in 10-30). That is less than the 3 to 8 minute spread between two implementations of 4.2. The numbers in this section stay as drafted, because they are the owner's (CALL-3.2). Q3.5 asks whether to assert wide wait bounds and only print the clock windows.

For a real player, assume about double: bronze in the first ten minutes, iron inside half an hour, mithril around an hour and a half, rune in an afternoon, dragon in roughly ten to fifteen hours (CALL-3.2).

Why not a longer curve: the levels themselves arrive at 8, 12, 22, 28, 48 and 83 minutes (C1, C2). A kit that costs much more time than its level is skipped for the next one. Why not shorter: that is today.

### What each step unlocks

Stage 2 decides who attacks: a camp leaves the hero alone once the hero's combat level is above the monster's level.

| When (1x, model) | The hero has | It unlocks |
|---|---|---|
| 0 m | Bronze scimitar, 3 cooked shrimp, 25 GP, combat level 3 | The start town is passive (Stage 2): chickens, goblins, goblin archers. Copper rocks, trees, shrimp spots, bank, store, anvil, altar, Slayer master. Two start-town quests pay 1,300 GP together. |
| 1 to 5 m | Mining and Smithing 2 | Bronze platelegs and platebody from 5 copper ore, a wooden shield from 2 logs. Or the same armour from the shop for 1,500 GP. |
| 8 to 13 m | Attack and Defence 5, Mining 10, Smithing 9 | Iron gear. Iron rocks east of the river. Oak trees and the oak shortbow. |
| 15 to 18 m | Combat level 13 | Scorpions stop attacking in packs: the dunes, gold and mithril rocks, the second Slayer band. |
| 12 to 31 m | Attack and Defence 10, then 15 | Steel, then black gear (shop or scorpion drops). |
| 28 to 53 m | Attack and Defence 20, Mining 25, Smithing 24 | Mithril gear. Wizards (combat 19) and rangers (25) stop attacking in packs. Woods teleport at Magic 20 once the shrine is found. |
| 44 to 50 m | Combat level 29 | Hill giants one at a time: the main money and experience until rune. |
| 48 to 76 m | Attack and Defence 30 | Adamant gear. Around here buried bones can bring Prayer to 25 to 30 and the protection prayers that Stage 2's gate asks for (Prayer is not in the model). |
| 1.4 to 2.1 h | Attack and Defence 40, combat 46, Mining 50, Smithing 45 | Rune gear. Moss guardians stop attacking: yew and magic trees in peace. Runite behind the pass. |
| 5 to 8 h | Attack and Defence 60, combat 69 | Dragon gear. The pass sentries stop attacking. |

---

## 6. Approaches

### 6.1 How to make money matter

Measured by ablation on "today plus Stage 2 rules, with Slayer" at 1x, here with the two start-town quests done (they add 3 minutes and 1,300 GP, which is why this baseline is later than row T4): kit-worn minutes for iron / steel / black / mithril / adamant.

| Change applied alone | Result | Reading |
|---|---|---|
| None | 8 / 16 / 27 / 36 / 60 | Baseline. The level gates are 7 / 14 / 25 / 34 / 59. |
| New-game kit only | 9 / 17 / 28 / 37 / 61, and bronze moves from 0 to 5 m | The start alone changes the first five minutes. |
| Gear drops divided by 20 only | 9 / 17 / 28 / 37 / 63 | Income falls from 4.6 to 2.5 million GP and nothing moves. |
| Shop gear prices times 10 only | 8 / 16 / 27 / 36 / 60 | Nothing moves: dropped gear still arrives free and pays for the rest. |
| Drops and prices together | 10 / 22 / 30 / 40 / 63 | Money starts to bind. |
| All three | 13 / 23 / 32 / 42 / 64 | Without Slayer: 21 / 31 / 45 / 53 / 76, row A1. With Slayer the wait is still only 4 to 6 minutes. |
| All three, and five Slayer bounties divided by 3 | 13 / 23 / 43 / 54 / 63 | Row A3. |

No single lever works. Drops and price together are the smallest pair that makes money matter for a player who ignores Slayer; the bounty change is what makes it matter for one who uses it.

For the price side, three options:

| | A. Cut every income | B. Re-price every item | C. One markup on gear at the shop counter (recommended) |
|---|---|---|---|
| What | Divide coin drops, bounties, quest rewards and the sell ratio by 5 to 20. | Edit `price` on about 300 items. | The shop sells equipment at list price times a constant. Everything else about prices stays. |
| Cost | Four tables. Frozen tests pin quest GP, the goblin bounty and sale values (C6). | A 300-line diff nobody can review number by number. | One constant, one function, four call sites. |
| Risk | Breaks the frozen tests; the 200,000 GP cheat becomes 20 times stronger. | Shifts the relative order of items by accident. | The resale spread becomes wide: buy at 10 times list, sell at 0.65 times. |
| Reaches the goals | Yes, against C6. | Yes. | Yes. |

Recommendation: **C**, with the constant at **10** (CALL-3.5), together with the bounty change of 7.1 item 8 (CALL-3.14). Runes, ammunition, food and potions are not marked up: they are consumed, and tests pin their prices.

Markup sensitivity, kit-worn minutes at 1x for iron / steel / black / mithril / adamant:

| Markup | Slayer, bounties as today | Slayer, five bounties divided by 3 (A3) | Shop only, no Slayer (A1) |
|---|---|---|---|
| 1 | 11 / 18 / 29 / 38 / 64 | 11 / 18 / 29 / 38 / 64 | 9 / 15 / 25 / 31 / 50 |
| 6 | 11 / 18 / 29 / 38 / 64 | 11 / 18 / 29 / 39 / 64 | 14 / 21 / 36 / 43 / 59 |
| 8 | 11 / 23 / 29 / 39 / 64 | 11 / 23 / 33 / 47 / 64 | 18 / 22 / 40 / 48 / 67 |
| **10** | 13 / 23 / 32 / 42 / 64 | **13 / 23 / 43 / 54 / 63** | **21 / 31 / 45 / 53 / 76** |
| 12 | 14 / 25 / 35 / 46 / 64 | 14 / 26 / 50 / 59 / 67 | 21 / 38 / 51 / 61 / 87 |

The level gates are about 9 / 16 / 27 / 36 / 62 with Slayer and 8 / 12 / 22 / 28 / 48 without. With today's bounties a Slayer user waits a few minutes at most whatever the markup. At 10 with the reduced bounties both kinds of player wait and both sit inside every window. At 12 a player who ignores Slayer misses the steel and mithril windows.

A fourth option, **D: shop stock by place or by shrine**, was considered and left out. It does not lower income, so it cannot replace C, and with C in place the price already keeps the top items away from a new character (the cheapest strong amulet is 7,200 GP, the Fire Cape 90,000). It is CALL-3.9.

### 6.2 What the hero starts with

| | A. Nothing at all | B. A weapon, three meals, 25 GP (recommended) | C. Today's kit minus the ranged and magic sets |
|---|---|---|---|
| For | The purest reading of "almost nothing". | The first click on a chicken works and feels like a fight (max hit 3, not 2). Everything worn beyond the blade is earned. 25 GP is enough for the quest step "buy an item". | Smallest change. |
| Against | No bronze weapon recipe exists, so the first weapon is 450 GP from the shop: the first ten minutes are punching chickens. | - | Bronze tier is still free. |

Recommendation: **B** (CALL-3.3).

### 6.3 The default experience rate

| | A. Keep 10x default | B. New games start at 1x, the option stays (recommended) | C. Remove the option |
|---|---|---|---|
| Result | Levels for rune in about 15 minutes whatever else is done. The curve of section 5 cannot hold. | Section 5 holds for anyone who does not opt out. Turning 10x on is a visible choice, like the cheat codes. | Section 5 always holds. |
| Against | Fails the stage's intent. | A player can still opt out. | Takes a shipped feature away from existing players. |

Recommendation: **B** (CALL-3.4). Existing saves keep the rate they saved.

### 6.4 Where the model lives

- **A (recommended):** move the hit, gather and drop arithmetic out of `actions.ts` into pure functions in `src/state`, unchanged; commit the model under `tests/support/` and have it call those functions and read the live tables. The pacing test then fails when someone changes a drop rate, a price or a formula so that a window breaks.
- **B:** commit the model with its own copy of the formulas. Cheaper, and proves nothing about the game.
- **C:** keep the model out of the repository and trust this document. The next data edit silently invalidates it.

### 6.5 How established games solve the same problems

Added after the critique, at the owner's request: each pacing and economy choice set against the strategy other RPGs and MMOs use for the same problem. Strategies are borrowed. No name, character, place or item is taken from another game, and nothing new is added.

| Problem | Well-known strategy (where it is used) | What this design does | Judgement |
|---|---|---|---|
| Starting kit | **Core-verb starter kit**: one weapon, a little food, a few coins; the rest comes from the first quests (most MMOs' starting zones, action RPGs' class starter weapon). Some games instead hand out one item per combat style so the player can try each. | One bronze scimitar, three shrimp, 25 GP (7.1 item 1). | Fits the owner's "begin with almost nothing". It gives up style sampling: magic is closed until 3,200 GP (Q3.9). |
| Experience rate | **Base rate with an opt-in boost**: base 1x, with boosts as events or account options (bonus-experience weekends; multiplier servers). | New games at 1x, the 10x button stays (6.3). | Fits, and it is the lever that does most of the work (4.3). The boost should read as an option, not a default (Q3.2). |
| Gear price and resale | **Vendor spread**: shops sell at or above value and buy back at a fraction, typically 25 to 60% (most MMO vendors and general stores). **Price by item level**, so price follows power. | One markup of 10 on equipment, resale unchanged at 65% of list: a 15-to-1 spread (6.1 C). | The markup is a vendor price, a known gold sink. The spread is about four times wider than usual and players will see it on every tooltip ("Shop 52,000 · sell 3,380"). Accepted because it leaves drop resale and every frozen sale test untouched. A **buy-back window** (sell back at the paid price for a few minutes) would soften mistakes, but it needs saved state, so it is not proposed. |
| Drop rates | **Rare drop with a sure alternative**: about one in a hundred, with a vendor or a craft as the guaranteed route. **Bad-luck protection** (a pity timer) where the drop is the only route. | Gear drops near 1%, the shop and the forge are the sure routes (7.1 item 3). | Fits. No pity timer is needed, because a drop is never the only route. |
| Resource depletion | **Per-node depletion with respawn** (ore rocks, harvest nodes). Chance-based depletion for multi-yield nodes (trees in several games). **Moving fishing spots** that relocate on a timer instead of emptying. | Today trees and rocks give one item per click. The design makes fishing the same (7.1 item 4). | Hits its hourly-rate goal, but it turns the one low-click activity into one click per fish (critique H-4). Chance-based depletion with a longer respawn reaches the same rate with a third of the clicks (Q3.7). |
| Gold faucets and sinks | **Balance faucets against recurring sinks**: repair costs, death fees, travel fees, consumables, trade taxes. | Faucets: coins, bounties, quests, sales. Sinks: the shop's equipment price and, slightly, runes and arrows. | Only a one-time sink. Once the kit is owned, gold piles up. Accepted for Stage 3. The recurring sink belongs with the cost of dying in Stage 4 (7.2). |
| Crafting margins | **Crafting is mainly for experience**, margins are small or negative early, and profit comes at high level or from scarce inputs. | A cap: output sells for at most 2.5 times its direct inputs (7.1 item 5). | An invented rule, and a lenient one, but it closes the 15-fold gilded loop and checks every recipe, including future ones. The ratio does not bound absolute income, so the pacing test prints gathering and crafting GP an hour next to combat income (F15). |
| Bounties | **Task bonus on top of normal rewards**, often paid in task points or experience rather than coin (slayer-style task masters, daily bounty boards). | Coin bounties kept, five cut to a third: about +70% on the task's coins (7.1 item 8). | Fits. Paying in points would need a points shop, which is new content (Stage 6). |
| What a level unlocks | **"You can now..." messages on level-up**, and a skill guide listing unlocks per level. | One chat line per level with unlocks, at most three names (7.1 item 7). | Fits; this is the standard strategy. A skill-guide panel would be new UI (Stage 5). |
| Onboarding, first ten minutes | **Guided opening chain**: a short linear sequence of tasks that teaches each core system and hands out the starter kit as rewards (tutorial islands, starting-zone quest chains with breadcrumbs). | The two start-town quests (1,300 GP), the onboarding card and the first chat lines (7.1 item 1). | The pieces exist, but the tracker points the wrong way: after the first quest it sends the player to Varrock's wizard camp, which attacks a new character in a pack, and hides the start-town Cook quest (critique H-2, Q3.6). Advertising the 200k gold cheat in the first chat lines works against the opening (Q3.8). |
| Gear crafted or bought | **Craft, buy or loot**: three routes to the same tier, with crafting the cheap one for those who train it. Player-crafted-only economies exist in multiplayer games, where trade fills the gaps. | Smithing for bronze, iron, mithril, rune; shop for all; rare drops (7.1 item 5, 5). | Fits a single-player game. Crafting-only would leave steel, black, adamant and dragon unreachable (F14). |
| Tiered vendors | **Stock by town or by progress**: each region's shop sells its tier, which makes travel a goal. | Not done: one shop, all items (CALL-3.9). | A good fit for Stage 2's world of places, and it would make "go to the next shrine" a goal. It does not cut income, so it adds to the markup rather than replacing it. Left out for Stage 3 (CALL-3.9); it can be added later without undoing anything here. |
| Diminishing returns | **Grey monsters** give little or no experience once far below the player. | Not used. | Correctly left out: with no monster between level 28 and 45 (F12), it would make the hill-giant plateau worse. |

---

## 7. Design

Eight changes. Each names the finding it answers.

### 7.1 The changes

**1. New game state (F1, F2; CALL-3.3, CALL-3.4).** `createNewGameState()` in `src/state/gameState.ts` returns `createDefaultState()` with: `gp` 25, `xpMultiplier` 1, every equipment slot `null` except `weapon: 'bronze_scimitar'`, and `inventory` `[{ id: 'shrimp', qty: 3 }]`. `createDefaultState()` itself does not change by a byte: it is the base that `migrateLegacySave` overlays a save onto (`save.ts` 32, 35, 65-71, 76) and that most existing tests start from. `session.ts` gains `startNewGame()`, which applies the new-game state to `STATE`; `boot()` calls it only when `loadGameState()` returned `false` (`runtime.ts` 168).

Reset fix (F16, added after the critique): `session.ts` gains a module flag that `resetGameSave` sets before it removes the save keys, and `saveGameState` returns without writing while the flag is set. The `beforeunload` and `visibilitychange` saves during the reload then cannot write the old character back, and the reload reaches `startNewGame()`. This is the only path from an existing profile to the new start.

**2. Shop price for equipment (F4, F11; CALL-3.5).** In `src/data/items.ts`: `GEAR_MARKUP = 10` and `shopPrice(item)`, which returns `item.price * GEAR_MARKUP` for `type: 'equip'` and `item.price` for everything else. `buyItem` (`inventory.ts` 177) and the shop window (`stations.ts` 51, 63, 311, 333, 614) use it. `price`, `SELL_RATIO`, `unitSellPrice` and the rune pack are untouched. Three-piece kits then cost 1,950 (bronze), 5,350, 11,100, 15,900, 21,100, 50,000, 129,000 and 380,000 GP (dragon).

**3. Gear drop rates (F3, F13; CALL-3.6).** Every equipment entry in the nine ordinary monsters' tables is multiplied by 0.05; the dragon's four entries go from 0.35 to 0.05. Coins, bones, food and arrows are unchanged.

| Monster | Entry | Today | After |
|---|---|---|---|
| Goblin | iron platebody, iron platelegs | 0.16 | 0.008 |
| Goblin archer | oak shortbow | 0.08 | 0.004 |
| Scorpion | steel platebody, steel platelegs | 0.22 | 0.011 |
| Dark wizard | mystic top, mystic bottom / mithril scimitar | 0.20 / 0.18 | 0.010 / 0.009 |
| Dark ranger | willow longbow / green d'hide body | 0.16 / 0.08 | 0.008 / 0.004 |
| Hill giant | adamant platebody, platelegs | 0.22 | 0.011 |
| Moss guardian | rune platebody, platelegs / green d'hide body, chaps | 0.22 / 0.24 | 0.011 / 0.012 |
| Lesser demon | dragon platebody, platelegs / dragon scimitar | 0.20 / 0.18 | 0.010 / 0.009 |
| The dragon | four pieces | 0.35 | 0.05 |

A piece that dropped on one kill in five now drops on about one in a hundred. At the model's kill rates that is one piece of each kind about every 8 to 10 minutes of killing that monster: a lucky break, with the shop as the sure route. The drop roll moves to `rollDrops(typeKey, rand)` in a new pure module `src/state/economy.ts`, with the same order of random draws (`actions.ts` 272-288), so it can be tested and the model can read it.

**4. Fishing spots deplete like every other node (F6; CALL-3.7).** The fishing exception at `actions.ts` 432 goes: a catch depletes the spot, as a cut tree or a mined rock does. Respawn times (`catalog.ts` 495-498) become shrimp 6 s, trout 3 s (a trout site has one spot), lobster 7 s, shark 8 s (today 2, 2, 2.5, 3). The success rule moves, unchanged, to `gatherChance(level, req)` in `economy.ts`.

Feel (critique H-4): a depleted node clears the player's target (`actions.ts` 432-438), so this makes fishing one click per fish, as trees and rocks already are. An alternative reaches the same fish per hour with no rule change: keep the 35% depletion chance and set the respawns to shrimp 17 s, trout 8.5 s, lobster 20 s and shark 23 s. That gives 1,510, 862, 878 and 778 fish an hour at the requirement level, by the formula of 4.2 with the depletion chance applied, and about a third of the clicks. It is four numbers in `RESOURCE_NODES_DEF` and no `actions.ts` edit. The owner chooses (Q3.7).

| Spot | Fish/h today | After | XP/h after | GP/h cooked, after | Nearest other gathering |
|---|---|---|---|---|---|
| Shrimp (1) | 2,323-3,592 | 1,500-1,624 | 45-49k | 11k | copper 13-14k |
| Trout (12) | 2,323-3,592 | 857-986 | 58-67k | 25-29k | oak 19-20k, iron 44-47k |
| Lobster (28) | 2,323-3,592 | 878-941 | 119-127k | 74-79k | mithril 65-70k, maple 88-94k |
| Shark (45) | 2,323-3,592 | 783-832 | 192-204k | 142-151k | gold 141-150k, runite 238-249k |

**5. Smithing takes bars; no recipe prints money (F5, F7, audit finding 9; CALL-3.8).** Recipe ids, names, outputs and experience are unchanged. Only inputs and four level requirements change (`catalog.ts` 416-428, `recipes.ts` 22-29, 96-100).

| Recipe | Today | After |
|---|---|---|
| Bronze platelegs / platebody | 2 / 3 copper ore | 2 / 3 bronze bars |
| Iron scimitar / platelegs / platebody | 2 / 2 / 3 iron ore | 2 / 2 / 3 iron bars |
| Mithril scimitar / platelegs / platebody | 2 / 2 / 3 mithril ore | 3 / 3 / 4 mithril bars |
| Rune scimitar / platelegs / platebody | 2 / 2 / 3 runite ore | 4 / 4 / 5 runite bars |
| Gilded platelegs | 2 gold ore, Smithing 35 | 1 rune platelegs + 3 gold bars, Smithing 46 |
| Gilded platebody | 3 gold ore, Smithing 38 | 1 rune platebody + 3 gold bars, Smithing 48 |
| Smelt iron / mithril / runite bar | Smithing 10 / 25 / 50 | Smithing 5 / 20 / 40 (the level of the tier's first forging recipe, so a bar never gates the item it feeds) |
| Willow / maple / yew / magic bow | 1 log each | 3 / 4 / 5 / 6 logs |
| Oak shortbow | 1 oak log | unchanged (pinned by `tests/phase1.test.ts` 217-221) |

The rule behind the numbers, enforced by a test over every recipe: **the output sells for at most 2.5 times what the direct inputs sell for.** After the change the worst cases are bronze arrows at exactly 2.5 (75 against 30; any one-coin change to an arrow, shaft or feather price fails the test, which is intended), cooked shrimp 2.33, cooked trout 2.23, yew and magic bows 2.22; smithing is 1.0 to 1.33 over its bars and at most 2.1 over the ore; gilded is 1.39 and 1.44. The one exception is the oak shortbow at 3.05, worth at most 57,000 GP an hour at level 10; it is named in the test with the reason. Crafting for sale then earns, per hour: willow bows 85k, maple bows 181k, yew bows 203k, magic bows 446k, rune platebodies 399k (today 256k, 726k, 1.0 million, 2.7 million and 665k).

Effect on the smithing route (skilling minutes at 1x, today then after): bronze 0.8 then 0.7, iron 3.1 then 2.5, mithril 8.8 then 7.4, rune 66 then 41. The extra bars cost seconds; the smelting step adds experience, and the runite bar's requirement falls from 50 to 40, which is where rune gains its 25 minutes. The route's pace is otherwise set by the Mining and Smithing levels, which do not change.

**6. Gold cap during play; the stack cap closed by argument (F8, Stage 1 review; CALL-3.11).** `economy.ts` exports `MAX_GP` and `MAX_STACK` (both 2,147,483,647, the values `save.ts` 34 and `inventory.ts` 75 use on load, which then import them) and `creditGp(state, amount)`, which adds and clamps to 0..`MAX_GP`.

| Where | Today | After |
|---|---|---|
| Coin drop, quest reward, Slayer bounty, the gold cheat (`actions.ts` 277, `adventure.ts` 438, 499, `cheats.ts` 45) | `gp +=` | `creditGp`: the purse stops at the cap, the excess is lost. A kill or a claim cannot be refused. |
| Selling (`inventory.ts` 204) | `gp +=` | Refused with "Your coin pouch is full." when the sale would pass the cap. Nothing is removed. |
| Adding to a stack (`inventory.ts` 37) | `qty +=` | Unchanged (critique M-3). |

The stack half needs no play-time rule. A stack the shop sells cannot reach 2,147,483,647 in any real play: the cheapest, arrow shafts at 2 GP, would cost 4.3 billion GP of lifetime spending, over 8,000 hours at the best income in 4.5 (about 500k GP an hour). A stack that is gathered, looted or crafted grows by at most 15 per action, so reaching the cap takes over 140 million actions. The gold cheat could fund it after about 21,000 uses; cheats are not a boundary (11.1). A hostile save is still clamped on load (Stage 1). Refusing stack additions would edit six frozen paths (`canPlace`, `place`, `buyItem`, `buyRunePack`, `withdraw`, `deposit`) to guard a state no play can reach.

Not reachable in normal play, as the review said. It closes the gap between what a save may hold and what play may produce.

**7. The game says what a level unlocks (CALL-3.12).** A new pure module `src/state/unlocks.ts`: `unlocksAt(skill, level)` reads the tables and returns what first becomes usable at exactly that level: equipment whose `req[skill]` equals it, recipes, resource nodes, prayers and spells. `grantXp` (`playerActions.ts` 53-78) prints one chat line per level gained that has unlocks, naming up to three and counting the rest. The onboarding card (`index.html` 50-58) and the two first-run chat lines (`runtime.ts` 175-180) are rewritten to say what the hero has and where the copper, the anvil and the goblins are. The README's feature list is corrected. The examine line (`playerActions.ts` 205, "Value: 5200 GP") becomes "Shop 52,000 GP · sells for 3,380 GP" through `shopPrice` and `unitSellPrice`, so it agrees with the shop (critique L-1). Two onboarding changes wait on the owner: what the quest tracker shows after the first quest (Q3.6), and whether a new game's first chat lines advertise the cheat codes (Q3.8).

**8. Five Slayer bounties (F10; CALL-3.14).** In `SLAYER_BANDS` (`adventure.ts` 25-30) the bounty of every band above the first is divided by 3 and rounded: scorpion 900 to 300, dark wizard 1,200 to 400, hill giant 1,800 to 600, moss guardian 3,200 to 1,100, lesser demon 5,500 to 1,800. The goblin band stays at 400 (a frozen test pins it, and it is the new character's first real money). Counts, bounty experience and per-kill experience are unchanged. Slayer then adds about 70% to the coins of the same kills instead of 200%.

### 7.2 Not changed, with reasons: staying alive (F9; CALL-3.10)

Regeneration, the altar's free heal and death without loss stay. They decide how every fight ends, which is Stage 4's subject ("combat with weight"), and Stage 2's gate simulation is tuned against them (Stage 1-2 design 6.6). The windows of section 5 hold with them as they are; the model includes regeneration. What is lost meanwhile: food stays optional, and gold has no recurring sink. Once a player owns the kit they want, gold only accumulates (6.5, critique M-2). **Dependency on Stage 4:** decide regeneration, the altar and the cost of dying together, give food a job, and make the cost of dying the recurring gold sink.

### 7.3 Not changed: coins and quest rewards

Coin drops stay. Tests pin every quest reward (C6), and with the markup the ten quests together (57,300 GP) are worth about one adamant kit, which is a fair size for them. From adamant on, a Slayer user still affords each kit as the level arrives, because hill giants pay 176 GP a kill in coins alone; closing that would mean cutting coin drops, which this stage does not do.

### 7.4 Not changed: item requirements (F11)

No `req` is edited. The pieces of F11 cost 54,000 (Fury), 48,000 (Berserker Ring) and 90,000 GP (Fire Cape) after the markup, which is adamant-to-rune money: a new character cannot have them, and a rich low-level one has paid for them. The Staff of Fire costs 3,200 GP.

### 7.5 Not changed: content gaps (F12, F14)

A monster band between level 28 and 45, recipes for the tiers that have none, and quests that lead the first hour all need new content. **Dependency on Stage 6.** Until then the giants plateau stands. The pacing test prints the share of kills by monster type, so the plateau stays visible.

### 7.6 Module boundaries

| Module | Change |
|---|---|
| `src/data/items.ts` | `GEAR_MARKUP`, `shopPrice`. |
| `src/data/catalog.ts`, `src/data/world.ts` | Drop chances, fishing respawns, smithing recipe inputs and requirements. |
| `src/data/recipes.ts` | Smelt requirements, bow log counts. |
| `src/state/economy.ts` (new) | `MAX_GP`, `MAX_STACK`, `creditGp`, `rollDrops`, `gatherChance`, `HP_REGEN_PER_SEC`. Imports only `src/data` and types. |
| `src/state/unlocks.ts` (new) | `unlocksAt`. |
| `src/state/combat.ts` | `playerAttackProfile(state)` (max hit and accuracy before a special attack), `playerHitChance(accuracy, monsterDef)`, `monsterHitChance(typeKey, state)`; Stage 2's `rollMonsterHit` calls the last one. All three are today's arithmetic, moved. |
| `src/state/gameState.ts` | `createNewGameState`. |
| `src/state/inventory.ts`, `adventure.ts`, `cheats.ts`, `save.ts` | Gold cap (`creditGp`, the sale refusal); the load clamps read `MAX_GP` and `MAX_STACK`; `buyItem` uses `shopPrice`; five bounties in `SLAYER_BANDS`. |
| `src/state/monsterAi.ts` | The three timing constants are exported for the model. |
| `src/engine/actions.ts` | Calls the moved functions; no formula of its own left for hit chance, drops or gather chance. |
| `src/engine/loop.ts` | Uses `HP_REGEN_PER_SEC` (one line). |
| `src/engine/session.ts`, `runtime.ts` | `startNewGame`, the reset guard (F16), first-run chat lines. |
| `src/ui/stations.ts`, `playerActions.ts` | Shop prices shown and charged through `shopPrice`; unlock chat line; examine line. |
| `index.html`, `README.md` | Onboarding text, feature list. |

Files that Stage 2 also edits: `src/engine/actions.ts`, `src/state/combat.ts`, `src/state/monsterAi.ts`, `src/engine/session.ts`, `src/engine/loop.ts`, `README.md`. Stage 3 touches no world data (`worldMap.ts`, `placements.ts`, `terrain.ts`, `collision.ts`, `pathfind.ts`) and no Stage 2 test.

---

## 8. Save format impact and migration

| | Stage 3 |
|---|---|
| Key | `gielinor_hero_save_v1`, unchanged |
| `version` | 4, unchanged |
| Fields written | unchanged: `serializeState` (`save.ts` 137-166) is not edited |
| New persistent keys | none |
| Migration code | none |
| Reading | `migrateLegacySave` is not edited, and `createDefaultState()`, the base it overlays onto, is not edited |

What happens to a version-4 save, field by field:

| In the save | After Stage 3 |
|---|---|
| `gp`, `skills`, `equipment`, `inventory`, `bank`, `shrines`, `quests`, position, camera | Loaded exactly as today. The new-game state is never applied to a loaded save. |
| `xpMultiplier` 10 or 1 | Kept as saved (`save.ts` 35). A save without the field keeps today's default of 10, because the default state is unchanged. |
| Gear owned or worn | Kept. Its resale value is unchanged (`unitSellPrice` is not edited). |
| Gold owned | Kept. It buys a tenth of the equipment it bought before. |
| Bars, ore and logs in the bank | Kept. Bars become useful. Ore must now be smelted before forging. Logs make a third to a sixth as many bows above oak (3 to 6 logs each). |
| Smithing level 35 to 47 | Gilded armour moves to Smithing 46 and 48 and consumes a rune piece, so a player who could forge it from gold ore at 35 or 38 cannot until 46 or 48. This is the one capability Stage 3 takes back (critique M-4). |
| A Slayer task in progress | Its kill count is kept. If it is one of the five reduced bands, it pays the new bounty when it completes. |
| `xpMultiplier` 10 with today's progress | Levels keep coming ten times faster, but gear now costs ten times as much and rarely drops. For this player gear comes about twice as fast as at 1x, not ten times (4.3, last row). |
| A legacy save (`runewilds_save_v2`, `_v3`) with no inventory or equipment field | Gets today's 23-stack kit, as today. Unchanged on purpose: a returning player is not downgraded. |
| A corrupt main save | As today: backed up, then a new game. The new game is now the new start. |

Rollback: a save written after Stage 3 has the same fields and loads in the build before it.

The one new path is the new game. `startNewGame()` runs only when `loadGameState()` returns `false`: no save, a corrupt save, or `applyState` threw (`session.ts` 37-86). The third case already ends in a fresh character two seconds later when the autosave runs; Stage 3 does not make it worse and does not fix it. It joins the save-flow items the Stage 1-2 design defers to Stage 6 (its section 9.1).

Tests with fixtures (plan tasks P1, N1):

- `tests/fixtures/s3/default-state.golden.json`: `serializeState(createDefaultState(), null, null)` without `savedAt`, captured before any Stage 3 change. Asserts the migration base never moves.
- `tests/fixtures/s3/save-v4-loaded.golden.json`: the Stage 1 fixture `tests/fixtures/save-v4.json` loaded and serialised again, captured before any Stage 3 change. Asserts a real version-4 save loads to the same state after the stage, value for value.
- `tests/fixtures/s3/save-v4-geared.json`: a version-4 save wearing rune, with dragon pieces and 500,000 GP in the bank and backpack, `xpMultiplier` 10. Asserts every piece, the gold and the multiplier survive.
- `tests/fixtures/s3/save-v4-no-multiplier.json`: the same without `xpMultiplier`. Asserts 10.
- `tests/fixtures/s3/save-legacy-bare.json`: `{ "gp": 77 }` under a legacy key. Asserts today's default inventory and equipment.
- `serializeState` of the new-game state has exactly the keys of the default state and `version` 4; it survives `writeSave` then `readSave`.

---

## 9. Verification

### 9.1 Headless, in vitest

| Goal | Proof |
|---|---|
| G3.1 | `createNewGameState()`: weapon `bronze_scimitar`, nine other slots `null`, inventory exactly 3 `shrimp`, `gp` 25, `xpMultiplier` 1, hitpoints 10, only the start shrine known, no quest flag set. `createDefaultState()` equals its golden. |
| G3.2 | `tests/pacing.test.ts` runs the model of `tests/support/pacingModel.ts` against the live tables and the functions of 7.6. For routes A1 and A3 at 1x every tier's kit-worn time is inside its window of section 5, and is never earlier than the level gate. The wait after the level is asserted as section 5 states it: on A1 between 10 and 30 minutes from iron to adamant; on A3 at least 3 minutes at iron and steel and at least 10 at black and mithril. (Without this the test would pass with today's prices and drops.) Negative control: the same wait assertion run on the new start with today's prices, drops and bounties must fail. The bounds are subject to Q3.5. The smithing route's bronze, iron, mithril and rune times are inside theirs. At 10x, from iron to rune, the kit is worn no earlier than 1.5 times the level gate (the fast mode speeds the levels, not the gear). The test prints the full table of 4.3 so a failure shows the numbers. |
| G3.3 | `tests/economy-invariants.test.ts`: for every recipe, sale value of the output is at most 2.5 times the sale value of the direct inputs, with `fletch_shortbow` the only listed exception. For every item, `shopPrice` is at least `unitSellPrice` (no buy-and-sell profit) and equals `price` for runes, ammunition, food and potions. For every fishing spot, modelled GP per hour of cooked fish, at its requirement level and 21 levels above it, is at most 1.5 times the best rock or tree whose requirement is at most 10 levels higher (today trout, lobster and shark reach 2.0 to 2.6 times; after, 0.6). Every non-boss equipment drop chance is at most 0.02. From the new-game state with no gold, bronze platelegs and a platebody can be made from copper rocks that stand in the start region and outside every aggressive camp (no soft lock). |
| G3.4 | Every `smith_*` recipe's inputs are bars or, for gilded, a rune piece and gold bars; a state holding only ore cannot forge; a state with the bars can, and gets the same experience as today. Each smelt requirement is at most the lowest forging requirement of its metal. |
| G3.5 | `creditGp` clamps at `MAX_GP` and at 0 and ignores non-finite amounts. `sellItem` at the cap is refused and removes nothing. `registerKill`, `claimQuest` and the gold cheat at the cap leave `gp` at `MAX_GP`. `save.ts` and `inventory.ts` contain no literal `2147483647`. The stack cap in play is closed by the argument of 7.1 item 6 and has no test. |
| G3.6 | `unlocksAt('attack', 5)` contains the iron scimitar; `('mining', 10)` the iron rock; `('smithing', 9)` the iron platebody recipe; `('prayer', 30)` Protect from Melee; `('magic', 12)` Fire Bolt; a level with nothing returns an empty list; no entry is returned at two different levels of one skill. |
| G3.7 | The fixtures of section 8. |
| G3.8 | Before any data change: `playerAttackProfile`, `playerHitChance`, `monsterHitChance`, `rollDrops` and `gatherChance` return, for a table of cases, the values computed from today's expressions; `rollDrops` consumes random numbers in today's order (checked with a recorded sequence). Stage 2's `tests/monster-hit.test.ts` passes unchanged. A source scan finds no hit-chance, drop-roll or gather-chance arithmetic left in `src/engine/actions.ts`. |
| G3.9 | `tests/content-freeze.test.ts`: the sets of item ids, monster type keys, node keys, recipe ids, quest ids, prayer ids and spell ids equal the lists captured before the stage, and every `name` in those tables is unchanged. |

### 9.2 Needs a human looking at the running game

- Reset from Settings on a profile that has a save: after the reload the hero is a new character, not the old one (F16).
- New game (reset, or a private window): the hero holds one scimitar and three shrimp; the purse shows 25; the experience button reads 1x; the onboarding card and the first chat lines match 7.1 item 7.
- Play the first 30 minutes without cheats and write down the minute at which bronze armour, the iron kit and the steel kit are worn. Expected: bronze inside 16 minutes, iron inside 50 (double the windows). This is the only check of the "twice as slow" assumption.
- The shop shows the marked-up price on the card, on the buy button and in the tooltip; buying charges that amount; the sell price is unchanged; runes and arrows cost what they cost before.
- Fish at the shrimp spots: the spot empties after a catch and returns after about six seconds, with the same depleted look a spot has today.
- Smelt copper, forge bronze platelegs and a platebody, equip them. Try to forge with ore only: refused with the bar named.
- Gain a level in Attack to 5: the chat names the iron scimitar.
- Load a save from before the stage (the owner's own): position, gear, bank, gold, multiplier and quests are as they were.
- Type `gold200k` and `skills10`: both still work.

### 9.3 Checked by reading, because nothing was run

Existing tests that the changes could touch, and why each stays green: `bulk-buy` and `shop-gathered` buy only runes and arrows, which are not marked up; `bulk-sell` asserts through `unitSellPrice`, which is not edited; `phase2` asserts quest GP and the goblin bounty, which are not edited (no test asserts another band's bounty), and smelts bronze (requirement 1, one copper ore, unchanged); `phase1` fletches the oak shortbow from one log (unchanged) and burns a log; `phase3-content` and `rule-fixes` cook shrimp and fletch arrows (unchanged); `cheats`, `phase4-combat`, `save-hardening` and `rule-fixes` start from `createDefaultState()`, which is unchanged; Stage 2's `save-relocation` asserts the saved keys, which are unchanged. No test reads a drop table, a respawn time or a `smith_*` recipe. The plan's gate task confirms all of this by running the suite.

---

## 10. Ledger: items deferred to Stage 3

| Item | Source | Decision | How |
|---|---|---|---|
| Audit finding 9: smelted bars cannot be used for anything, and smelting gold or runite loses money | `docs/audit/2026-11-13-findings.json`, Stage 1-2 design section 9 | **Fixed in Stage 3** | 7.1 item 5. Every forging recipe takes bars. Gold bars feed gilded armour. A runite bar sells for 507 against 403 for the ore, and five of them make a platebody that sells for 3,380. |
| The gp and stack cap is applied only on load | Stage 1-2 design section 9.1 | **Fixed in Stage 3** (gold); **closed by argument** (stacks) | 7.1 item 6. Gold is capped at every gain. A stack cannot reach the cap in play once gold is capped, and the load clamp stays. |
| "Reset" writes the old character back during the reload (F16) | Found by the Stage 3 critique | **Fixed in Stage 3** | 7.1 item 1, reset guard. |
| Audit finding 6 (shop arbitrage), second half: "reprice crafted outputs" | Stage 1-2 design 5.6, CALL-2 | **Closed in Stage 3** | The shop block from Stage 1 stays; the 2.5 rule of G3.3 bounds what crafting can earn from gathered inputs, which the block did not cover. |

Deferred again, in writing:

| Item | To | Reason |
|---|---|---|
| F9: regeneration, free altar heal, death without loss | Stage 4 | 7.2. |
| F12: the level 28 to 45 to 68 gap | Stage 6 | 7.5. Needs a creature type or a new use of an existing model, which is content. |
| F13, second half: the dragon returns in 8.35 s | Stage 4 | Boss phases and boss respawn are designed together there. |
| F14: no recipes for steel, black, adamant, dragon | Stage 6 | New recipes need new inputs (a second ore), which would be new, named content. |
| Ranged and magic gear ladders as designed curves | Stage 4 | They depend on kiting and on what ammunition costs in a fight. Checked for parity only (4.7). |

---

## 11. Threat model

### 11.1 What are we working on?

A single-player browser game served as static files. No server, no account, no network call from game code. The flows Stage 3 touches:

| Flow | Source | Trust | Sink |
|---|---|---|---|
| Save load | `localStorage` JSON | Untrusted (old, hand-edited, passed between players). Validated by Stage 1's `migrateLegacySave`, which Stage 3 does not edit. | `STATE` |
| New game | `createNewGameState()` | Ours | `STATE`, then the autosave |
| Economy tables | `catalog.ts`, `world.ts`, `recipes.ts`, `items.ts` | Trusted: compiled constants reviewed in git | Drops, prices, recipes, the model |
| Shop and bank quantities | Clicks, with a quantity mode from the HUD | The player | `buyItem`, `sellItem`, `deposit`, `withdraw` |
| Random numbers | `Math.random` | Ours | Hit, drop and gather rolls |

Trust boundary: the `localStorage` read, unchanged. Cheating is not a boundary: the player owns the only copy of the state and the game ships cheat codes. Stage 3 adds no parsed input.

### 11.2 What can go wrong?

| # | Failure |
|---|---|
| R1 | The new-game state is applied over a loaded save, or `createDefaultState()` is edited "to match", and an existing player loses gear or gets a different fallback. |
| R2 | An existing player's progress is devalued without notice: shop gear costs ten times more. |
| R3 | A number overflows: gold or a stack passes 2^31 or becomes non-finite during play. |
| R4 | A crafting or trading loop prints money (a recipe added later, or a markup applied to the sell side by mistake). |
| R5 | A soft lock: a new character with 25 GP cannot reach bronze, or a player who sold their weapon cannot afford another. |
| R6 | The formula moves change behaviour: a different hit chance, a different order of random draws, a different drop. |
| R7 | The model drifts from the game, or the windows pass only because the model is wrong. |
| R8 | Stage 2's final world (camp sizes, node counts, the gate) differs from what the model assumed, and the windows fail after the merge. |
| R9 | A cap refuses something the player cannot understand, or silently destroys items. |
| R10 | The level-up unlock line prints a wall of text (Attack 1, Defence 1 and level 70 to 75 each match many items), or prints save-derived text as HTML. |
| R11 | A hostile save sets `gp` or a stack to the cap to probe the new arithmetic. |
| R12 | A name or item taken from another game is added while "fixing" a content gap. |
| R13 | A player resets to try the new start and gets the old character back (F16). |
| R14 | The pacing test fails only at the end of the stage, because the "after" rows were never measured before the data changed (critique C-1). |

### 11.3 What are we going to do about it?

| Risk | Decision |
|---|---|
| R1 | Mitigate: one call site, guarded by the load result; `createDefaultState()` pinned by a golden; five save fixtures (section 8). |
| R2 | Accept, with reason, and disclose (CALL-3.5): owned gear, gold and resale values are untouched; only future shop purchases of equipment change. The README says so. No compensation is paid, because it would be new free gold. |
| R3 | Mitigate gold at the one place it grows: `creditGp` (7.1 item 6). Internal code trusts it and does not re-check. Stacks: accepted, because play cannot reach the cap (7.1 item 6), and a save is clamped on load. |
| R4 | Mitigate: the recipe-ratio test and the `shopPrice >= unitSellPrice` test run over every recipe and item, so a later addition is checked too. |
| R5 | Mitigate: bare hands can fight (`combat.ts`, `weaponClass` returns `unarmed`); bronze armour needs no gold; the no-soft-lock test of G3.3. Accept the remainder: a player can sell everything and must then earn 450 GP for a scimitar, which chickens pay in a few minutes. |
| R6 | Mitigate: the moves are separate commits with value tables and a recorded random sequence written first (G3.8); data changes come after. |
| R7 | Mitigate: the model calls the game's functions and reads its tables (6.4 A). Accept the remainder, stated in 4.2: it is an expected-value model of one play style, and the human check in 9.2 is the only measurement of a real player. |
| R8 | Mitigate: the plan's first task rebases on the merged Stage 2 and the tuning task re-runs the model. The knobs, if a window or a wait bound fails, are `GEAR_MARKUP` between 8 and 12, then the gear drop chances by one common factor; for the fishing bound only, the four fishing respawn times between 2 and 10 s. No formula is touched and no bound is moved. The smithing route and the 2.5 rule have no knob: if they fail, or no value in those ranges works, the stage stops and returns to the owner. |
| R9 | Mitigate: a sale at the cap is refused with a plain message and changes nothing; only gold that arrives without a player action (loot, reward, bounty) is clamped. Stack additions are not refused. |
| R10 | Mitigate: at most three names and a count per line; level 1 prints nothing (nothing is "gained" at level 1). Every name comes from the compiled tables, never from the save. |
| R11 | Already mitigated on load by Stage 1; the play-time caps mean the next gain cannot pass it. A test starts from a state at the cap. |
| R12 | Mitigate: Stage 3 adds no content, and the content-freeze test fails if an id or a name appears. |
| R13 | Mitigate: the reset guard (7.1 item 1) and a human check (9.2). |
| R14 | Mitigate: plan M1 runs the A1 and A3 rows with the design's parameters injected, before any data task, and stops if a bound fails. The purchase and Slayer rules are written in 4.2, so two implementations agree on what to compute. |

### 11.4 Did we do a good enough job?

By the proofs of section 9. In particular: for saves, the two goldens and three fixtures; for the economy, the invariants that run over whole tables instead of over examples; for the curve, the pacing test, which is the same model that produced this document's numbers once it is committed against the real functions. If the pacing test cannot be made to pass on the merged Stage 2 world inside the knob range of R8, the design is wrong at that point and the stage stops there.

---

## 12. CALLs for the owner to check

| # | Proposal | Recommendation | Where |
|---|---|---|---|
| CALL-3.1 | The essence list is the Stage 1-2 one. Stage 3 edits no formula, price, requirement, coin drop, quest reward or XP value. | Accept. | 1 |
| CALL-3.2 | The curve: the windows of section 5 at 1x (bronze by 8 minutes, iron by 25, mithril by 60, rune by 2.5 hours, dragon by 9 hours, model-optimal; about double for a real player), and the wait after each level (10 to 30 minutes without Slayer; 3 to 18 with it, up to mithril). | Accept the curve. The levels themselves allow nothing much slower without changing the XP curve or combat speed. The windows were drawn around the model's output, not set beforehand, and an independent implementation misses one window and three wait bounds (critique C-1). What the test asserts is Q3.5. | 5 |
| CALL-3.3 | A new game starts with a bronze scimitar in hand, 3 cooked shrimp and 25 GP. | Accept. Alternatives: nothing at all (the first ten minutes become punching chickens for 450 GP), or today's melee kit (bronze stays free). | 6.2, 7.1 |
| CALL-3.4 | New games start at 1x experience. The 10x button stays in Settings. Existing saves keep their rate. | Accept. This one decision does most of the work: it moves rune from 17 to about 70 minutes on its own. Without it nothing else in this document holds. | 6.3 |
| CALL-3.5 | The shop sells equipment at 10 times list price. It still buys at 65% of list, so resale is 6.5% of the shop price. Runes, ammunition, food and potions are not marked up. Existing players keep their gear and gold; their gold buys a tenth of the equipment it bought before. What it buys: the gear stops arriving with the level. It does not change when dragon gear arrives, which is level-bound either way. It does delay the middle tiers for a player who only fights: in the critique's model, the shop-only route wears mithril 31 minutes and rune about an hour later than the same route at list price (critique H-6). | Accept at 10, knowing the trade: a tenfold price rise for a wait of 13 to 28 minutes per tier without Slayer and 4 to 18 with it. At 8 the waits are about a third shorter; at 12 two windows are missed. | 6.1, 7.1 |
| CALL-3.6 | Gear drops become rare: about one kill in a hundred per piece instead of one in five; the dragon one in twenty per piece instead of one in three. | Accept. Drops stay a lucky break; selling them stops being 71% of income. | 7.1 |
| CALL-3.7 | Fishing spots empty after each catch and return in 3 to 8 seconds, like trees and rocks. | Accept the rate. How the spot runs out is Q3.7: emptying on every catch means one click per fish; keeping the 35% chance with 17 / 8.5 / 20 / 23 s respawns gives the same rate with a third of the clicks and changes data only. The other alternative is to cut the price of eight fish items by about two thirds, which also makes bought food cheaper. | 7.1 |
| CALL-3.8 | Smithing takes bars (audit finding 9). Mithril and rune pieces take one to two more bars; gilded armour is made from the rune piece plus gold bars at Smithing 46 and 48; bows above oak take 3 to 6 logs. Rule: nothing sells for more than 2.5 times its inputs. Existing players at Smithing 35 to 47 lose gilded armour from gold ore until 46 or 48, and banked logs make fewer bows (section 8). | Accept. | 7.1 |
| CALL-3.9 | The shop keeps selling every item everywhere. No stock by place, level or shrine. | Accept: the price now does that job. Stock by shrine can be added later without undoing anything here. | 6.1 |
| CALL-3.10 | Regeneration, the altar's free heal and death without loss are not changed in Stage 3. | Accept, as a written deferral to Stage 4. | 7.2 |
| CALL-3.11 | Gold is capped in play at 2,147,483,647: loot and rewards stop at the cap; a sale that would pass it is refused. Stacks keep their cap on load only, because play cannot reach it once gold is capped. | Accept. | 7.1 |
| CALL-3.12 | The chat says what a level unlocks; the onboarding card and first messages describe the new start. | Accept. | 7.1 |
| CALL-3.13 | Requirements of the strongest low-requirement items (Fury, Berserker Ring, Fire Cape, Staff of Fire) are left alone; price gates them. | Accept. Adding requirements would change items players already wear. | 7.4 |
| CALL-3.14 | Five Slayer bounties are divided by 3 (scorpion 300, dark wizard 400, hill giant 600, moss guardian 1,100, lesser demon 1,800); the goblin bounty, coin drops and quest rewards are unchanged. | Accept. With today's bounties a Slayer user waits 4 to 6 minutes for any kit whatever the shop charges; with this, 16 to 18 at black and mithril. If refused, the stage still holds for players who ignore Slayer, and the wait bound for the Slayer route drops to 3 minutes. | 7.1, 7.3 |
| CALL-3.15 | What is left out: a monster band between level 28 and 45, recipes for steel, black, adamant and dragon, ranged and magic ladders, food that matters, quests that lead the first hour. | Accept as dependencies on Stages 4 and 6. | 7.5, 10 |
| CALL-3.16 | Stage 3 scope as a whole: eight changes (new-game state, shop markup, drop rates, fishing depletion, bars and the 2.5 rule, caps, unlock messages, five bounties), the model committed as a test, no save format change. | Accept. | 3, 7 |

---

## 13. Risks

| Risk | Likelihood | What happens | Answer |
|---|---|---|---|
| The model is wrong about real players (the factor of two). | Medium | The first hour feels too slow or too fast although the test passes. | The 30-minute play check (9.2). One constant to move. |
| Stage 2's final camps differ from its design table. | Medium | A window fails after the merge. | Plan tasks P0 and T1; knob range in R8. |
| A frozen test fails although reading says it should not. | Low | A change has to be reshaped. | The gate task runs the suite before anything is called done; section 9.3 lists the reasoning to check against. |
| Existing players dislike the price change. | Medium | Complaint, not breakage. | Disclosed in CALL-3.5 and the README; owned gear and gold untouched. |
| The 2.5 rule blocks a recipe Stage 6 wants. | Low | A test fails on purpose. | The rule is one number in one test; the exception list names its reasons. |
| Moving formulas out of `actions.ts` conflicts with late Stage 2 edits. | Medium | Rebase work. | Stage 3 starts only after the Stage 2 merge; the moves are the first code tasks. |
| Fishing feels worse (the spot disappears after every catch, one click per fish). | Medium | Feel, judged by eye. | Q3.7 (b) avoids it; otherwise the human check, with Q3.7 (b) as the fallback. |
| The pacing bounds fail on the real model (critique C-1). | High | The stage stops at M1's dry run. | The owner answers Q3.5 before the data tasks. |

---

## 14. What could not be verified

- No test, type check or build was run. Every statement about a test staying green comes from reading it (9.3).
- The model's numbers come from a script outside the repository, with formulas copied from `actions.ts` at `a8cad85`. They are the script's output as recorded in sections 4 to 6; nobody has reproduced them.
- Stage 2's final world: camp membership and coordinates (task W5), the gate simulation (A7), the two new pond fishing spots, and whether the model's "all camp members attack at once" matches the aggro radius in practice. The model used the camp table of the Stage 1-2 design, section 6.4.
- The "about twice as slow" factor for a real player. It is an assumption.
- The windows of section 5 and the wait bounds were drawn around the model's own output. They record what the design delivers; they were not targets set before the numbers were known. The absolute windows barely tell today's economy from the new one once the rate is 1x; the wait bounds are what does.
- The site rule for gathering (nodes within 15 units) is the model's own; no game rule defines a site. Stage 2 moves the yew and magic trees and the river fishing spots, so the gathering numbers will shift.
- Ranged and magic through the tiers (4.7), and the effect of amulets, rings, capes, prayers and special attacks on the melee times.
- The start-town quests' time cost (90 s each in the model) and the Slayer walk (10 s per task).
- That the depleted look of a fishing spot reads well when it happens on every catch.
- The critique's independent model (a scratch script, not committed) reproduced the "today" rows and the gathering table, but not row A1. It did not implement Slayer, so rows A3 and T1/T3 are checked by nobody. The reset defect (F16) was found by reading; that the browser fires `beforeunload` on `location.reload()` is standard behaviour, not observed here.

---

## 15. Open questions for the owner

Only questions whose answer changes what is built.

- **Q3.1.** CALL-3.5 and CALL-3.14 together: is a tenfold shop price for equipment, with five Slayer bounties cut to a third, acceptable for existing players? The alternative that keeps today's bounties leaves Slayer users with almost no wait for gear.
- **Q3.2.** CALL-3.4: should the 10x button stay where it is in Settings, or move next to the cheat codes so it reads as a fast mode?
- **Q3.3.** CALL-3.3: bronze scimitar in hand (proposed), or truly nothing?
- **Q3.4.** CALL-3.2: is a model-optimal 5 to 8 hours to dragon gear (10 to 15 for a real player) the length you want for the present content? Making it longer needs a slower level curve or slower combat, which this stage may not touch.

Added by the critique (`2026-11-14-start-pacing-critique.md`, section 4). The ones with a real trade-off come first.

- **Q3.5.** CALL-3.2, what the pacing test asserts. The minute windows of section 5 fit one script's output with 2 to 6 minutes of slack, and a second implementation misses one window and three wait bounds. Options: (a) keep the windows and waits as drafted and let plan M1's dry run decide whether they hold; (b) assert only the wait between reaching a level and wearing its gear, on wide bounds (5 to 45 minutes from iron to adamant on the shop-only route; at least 3 minutes at iron to mithril with Slayer), print the minute windows without asserting them, and keep the negative control. **Recommendation: (b).** It still fails today's economy, and it does not break whenever the model's arithmetic moves by a few percent.
- **Q3.7.** CALL-3.7, how a fishing spot runs out. (a) As designed: it empties after every fish, so one click per fish. (b) It keeps today's 35% chance and stays empty longer (shrimp 17 s, trout 8.5 s, lobster 20 s, shark 23 s): the same fish per hour, a third of the clicks, four numbers changed and no rule change. **Recommendation: (b).**
- **Q3.6.** After the first quest, the quest tracker points at the Varrock quest, whose kill step is a wizard camp that will attack a new character in a pack. The start-town Cook quest is not shown until five quests later. Fixing it means replacing one frozen test (`tests/phase3-content.test.ts` 41). **Recommendation:** allow that one replacement, and have the tracker show open quests in already-discovered regions first.
- **Q3.8.** The first chat lines of every game advertise `gold200k` (200,000 GP) and `skills10`. **Recommendation:** do not print that line in a new game; the codes stay in Settings, and returning players still see it.
- **Q3.9.** Magic needs a staff, and the only one a new character can wear costs 3,200 GP after the markup and has no recipe, so a new character cannot cast for roughly the first half hour. Ranged opens with a fletched oak shortbow at Smithing 5 and Woodcutting 10. **Recommendation:** accept it and say so in the README; the essence list does not include the three styles.
