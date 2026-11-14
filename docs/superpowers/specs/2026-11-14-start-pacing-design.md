# Start and pacing: design

Date: 2026-11-14. Branch: `feat/start-pacing`, cut from `main`. All line numbers refer to commit `a8cad85`. Stage 2 (`feat/world-place`) is being built now and will move some of them; every task in the plan finds symbols by name.

Status: proposal, revised with the owner's decisions of 2026-11-14. Every open question of the first two drafts is now decided (section 15 gives each decision, its date and the owner's words). Decisions marked **CALL** that the owner did not speak to remain the lead's proposals (section 12). Two small new decisions came out of the answers (section 15.2).

Critiqued on 2026-11-14 (`docs/superpowers/specs/2026-11-14-start-pacing-critique.md`, verdict READY-WITH-FIXES). The fixes the critique was confident in were applied in place. Its questions Q3.5 to Q3.9 are answered by the owner, and several answers changed the design:

- The pacing proof is no longer stated in minutes. Milestones are work done by the player (quests, kills, items gathered or forged, gold earned), counted in actions. A time may be shown as an average. It is never asserted (section 5).
- The hero starts with nothing in hand and earns the first kit through six start-town quests (7.1 item 9).
- The 10x experience button and the cheat codes are hidden behind one typed word (7.1 item 10).
- One new entry-level staff opens magic in the first minutes (7.1 item 11).
- Fishing keeps "one click per fish" and gets cues for the empty and returning spot (7.1 item 4).

Inputs read for this document: `docs/superpowers/specs/2026-11-13-world-foundation-design.md` (called "the Stage 1-2 design" below; its sections 6, 9 and 9.1 in full), `docs/superpowers/plans/2026-11-13-world-foundation-plan.md`, `docs/audit/2026-11-13-findings.json` (findings 6 and 9), `src/data/*.ts`, `src/state/*.ts`, `src/engine/actions.ts`, `src/engine/session.ts`, the parts of `src/engine/loop.ts`, `src/engine/runtime.ts`, `src/ui/stations.ts` and `src/ui/playerActions.ts` that touch the economy, the tests that pin economy values, and the Stage 2 branches `feat/world-place`, `wp/A`, `wp/B`, `wp/W` as they stand today.

This document covers one stage:

- **Stage 3: Start and pacing.** "Begin with almost nothing and earn the equipment."

Stage 3 lands after Stage 2 is merged. It depends on Stage 2's camps, aggression and the gated corner, and changes none of them.

**How the numbers were produced.** Two scratch scripts, neither run against the game's own code:

- The "today" rows of 4.3 and the tables of 4.4, 4.5 and 6.1 come from the first author's script. It imported the real data tables and transcribed the combat and gathering formulas by hand from `src/engine/actions.ts`. It is not committed. The critique reproduced its "today" rows within 2 minutes.
- Everything about the game after the design (the task counts of section 5, the "after" rows of 4.3) comes from the critique's independent model, which is committed (`docs/superpowers/research/pacing-model/pace2.py`), extended for this revision to count kills and gold, to start from the starter chain and to follow the Slayer rule of 4.2. The extension is committed beside it (`tasks.py`, `check.py`, `check2.py`, commit `b68e2d2`).
- The second-pass check (critique, "Second pass") wrote a third model in TypeScript that imports the real tables and functions of `src/` (`MONSTER_TYPES`, `ITEMS`, `getEquipmentBonuses`, `combatLevel`, `pickSlayerBand`, `getLevelForXp`) and the camps of `feat/world-place` at `b6f38da`. It reproduced every kill count of rows A1, A3 and C and of table 5.2 exactly, at every markup from 8 to 12.

No test, type check, build or dev server was run for this document. The plan's first tasks move the formulas into `src/state` and commit the model as a test that calls them, so the numbers become a proof instead of a claim (section 9). Section 4.2 lists the model's assumptions.

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

Stage 3 changes no combat formula, no item price, no item requirement, no monster stat, no coin drop, no existing quest's reward, no XP value and not the gather success formula. It does change one gathering rule (fishing spots deplete, 7.1 item 4) and five Slayer bounties (7.1 item 8). By the owner's decision of 2026-11-14 it adds two things: six start-town quests on the existing quest system (7.1 item 9) and one staff (7.1 item 11).

---

## 2. Constraints

| # | Constraint | Consequence |
|---|---|---|
| C1 | The XP curve does not change. | The level a tier needs (5, 10, 15, 20, 30, 40, 60) costs the experience it costs today. |
| C2 | Combat feel belongs to Stage 4. The attack tick (0.6 s, `context.ts` 8), the hit and damage formulas (`actions.ts` 95-115, 173-176), hitpoint regeneration (`loop.ts` 109-110), the altar and the cost of dying stay as they are. | With C1 this fixes how fast levels come: at 1x a fresh character reaches the levels for rune in 67 to 85 minutes of model-optimal play, and for dragon in 4.5 to 5.7 hours (4.3, rows T1 and T2). Stage 3 cannot stretch that and does not try to. It makes the gear arrive after the level, not before it. |
| C3 | No new creature models, no Blender work, no new skills or dungeons (Stage 6). Owner, 2026-11-14: the first kit is earned through start-town quests, and magic gets an entry-level staff. | Stage 3 adds exactly six quests, one quest-table entry that marks a new game, and one item. It adds no monster, node, recipe id, prayer, spell, place or character. The staff reuses the existing staff model with another tint. A test freezes the id sets and names the additions (G3.9). |
| C4 | New content must have original names. Nothing may be named after or modelled on RuneScape or Zelda. | The new names are: the quests "A Name in the Ledger", "First Quarrel", "Stone, Timber, Tide", "Fire and Hammer", "Left in Keeping" and "Fair Coin", and the item "Hazel Staff". The quests name no new character: giving them people and dialogue is Stage 6's system. Quest texts refer to things the game already shows (the task master, the bank, the anvil, the store) without adding a name. |
| C5 | Saves: key `gielinor_hero_save_v1`, `version: 4`. | No format change, no new saved field, no migration (section 8). Starter quests use only flags and values a save already holds, and are recorded in the existing `quests.claimed` list. |
| C6 | Existing tests are frozen (plan rule). Tests pin: every quest's GP (`tests/phase2.test.ts` 59-91), the goblin Slayer bounty of 400 GP (153), rune and arrow buy prices at list (`src/__tests__/bulk-buy.test.ts` 28-35, `tests/shop-gathered.test.ts` 37), `fletch_shortbow` from one oak log (`tests/phase1.test.ts` 217-221), `cook_shrimp` and `fletch_bronze_arrows` inputs (`tests/rule-fixes.test.ts` 42-54), the ten ids of `QUEST_DEFS` and the length of `questView` (`tests/phase3-content.test.ts` 17-21). | The design keeps all of them true. That is why the starter quests live in their own table and not in `QUEST_DEFS`. One assertion is replaced, with the owner's authorisation of 2026-11-14: `tests/phase3-content.test.ts` line 41 (7.1 item 12). Section 9.3 lists what was checked by reading, because the suite was not run. |
| C7 | Vitest runs in `node` with no DOM. | Every automated proof is DOM-free. What needs a screen is a human check. |
| C8 | Stage 2 edits `actions.ts`, `combat.ts`, `monsterAi.ts`, `session.ts`, `loop.ts` and `README.md`. | Stage 3 starts from `main` after the Stage 2 merge. Its first task re-runs the model on the merged world (plan P0, T1). |
| C9 | Each mechanism is as simple as it can be: data tables and pure functions in `src/state` and `src/data` with tests, thin engine wiring. | One constant for the shop, one function per rule. No stock system, no item quality, no currency. |

---

## 3. Goals, non-goals, anti-goals

Goals:

- **G3.1** A new game starts with nothing in hand: no equipment, an empty backpack, no coin, 1x experience.
- **G3.2** Every equipment tier is earned, and the proof is stated in work, not in time. For each tier the pacing model gives the tasks that earn it: quests claimed, kills by monster, items gathered and forged, gold earned and spent. The test asserts those counts and their order (section 5). No test asserts a number of minutes.
- **G3.3** Money cannot be printed by crafting: no recipe's output sells for more than 2.5 times what its inputs sell for (one named exception that a frozen test pins), and fishing earns no more than 1.5 times what mining or woodcutting earns at a comparable level.
- **G3.4** Smithing uses bars (audit finding 9).
- **G3.5** Gold is capped during play, not only on load (Stage 1 review finding). Stack counts keep their load cap; play cannot reach it (7.1 item 6).
- **G3.6** The player is told what each level unlocks, and for a newly wearable piece the shop price and the forge recipe side by side.
- **G3.7** A version-4 save loads to exactly the state it loads to today. A player with gear keeps it. The save format does not change. An existing save is not shown the starter quests.
- **G3.8** The model that produced the numbers is a committed test that calls the game's own formulas. It is a pure function: the same tables give the same counts.
- **G3.9** No new content except the additions the owner asked for: six start-town quests, the entry that marks a new game, and the Hazel Staff. A test names them and fails on any other new id or name.
- **G3.10** The first kit is earned in the start town: six quests, each teaching one loop of the game, each paying one piece. At the end the hero wears a bronze scimitar, platebody and platelegs and has been told how the next tier is earned.
- **G3.11** The 10x experience button and the cheat codes are not visible in the normal interface and not announced in chat. One typed word reveals both.
- **G3.12** A new character can cast spells from the starter chain on.

Non-goals: ranged and magic gear ladders as designed curves (they are checked for parity only, 4.7), new recipes for steel, black, adamant or dragon gear, a monster between level 28 and 45, tools, food that matters, a cost for dying, shop stock that changes by place, quests with characters and dialogue (Stage 6 owns that system; the starter quests use only what the quest system does today).

Anti-goals:

- No change to the XP table, to XP per action, to any combat formula or to the gather success formula. The one gathering rule that changes is named: fishing spots deplete (7.1 item 4).
- No edit to any existing item's `price` or `req`. Three hundred hand-set numbers stay as they are.
- No change to coin drops or to the reward of any of the ten existing quests.
- No new saved field.
- No removal of the 10x experience option or of the cheat codes. They are hidden, not removed (7.1 item 10).
- No assertion on a clock value in any test. Times are printed.

---

## 4. The pacing model

### 4.1 What is measured

A **tier** is worn when the hero's weapon, body and legs all require at least that tier's level: bronze 1, iron 5, steel 10, black 15, mithril 20, adamant 30, rune 40, dragon 60 (`catalog.ts` 37-46, 82-124). The **level gate** is the first moment Attack and Defence both reach that level. Work is counted in kills and other actions from a new game. Where a time is given it is an average, for information.

List prices of the three-piece kits (weapon + body + legs, `catalog.ts`): bronze 195, iron 535, steel 1,110, black 1,590, mithril 2,110, adamant 5,000, rune 12,900, dragon 38,000. Total from iron to dragon: 61,245 GP.

### 4.2 Assumptions

- Expected values, no dice. A melee fighter using the controlled style, so each point of damage gives 1.4 Attack, 1.3 Strength, 1.3 Defence and 1.5 Hitpoints experience (`actions.ts` 202-210), times the multiplier (`playerActions.ts` 56).
- Swing every 0.6 s (`context.ts` 8, `loop.ts` 223-224). Player max hit, accuracy and hit chance from `actions.ts` 112-114 and 173-174; average damage of a hit with max hit M is (1 + M(M+1)/2)/(M+1) (176). Monster hit chance and damage from `actions.ts` 298-303 and 316, one attack every 1.65 s (`monsterAi.ts` 45).
- A monster is back 8.35 s after it dies (`monsterAi.ts` 46-47). Time per kill = the larger of (kill time + 1.5 s to reach the next one) and ((8.35 + kill time) / monsters of that type), plus rest. Rest is the time to regenerate, at 0.25 HP/s (`loop.ts` 110), whatever damage the fight cost beyond regeneration and the food the monster drops.
- The fighter always attacks the type that gives the most monster-HP per second among the types it can win against. "Can win" means: expected damage taken in one kill is at most 60% of max HP, and the attackers' combined max hit is below max HP.
- **Stage 2 rules** (Stage 1-2 design 6.4): a camp attacks a player whose combat level is at or below the monster's level. Then every member attacks at once: 3 scorpions, 3 wizards, 2 rangers, 4 giants, 2 guardians, 2 demons. These camp sizes are the design's table; the final camps are not written yet (Stage 2 task W5). The "after" rows of 4.3 and section 5 used 5 scorpions, 4 guardians and 4 demons as attackers. On `feat/world-place` at `b6f38da` the camps are now aggressive and split: two dune nests of 3 and 2 scorpions, two deep-woods camps of 2 and 2 guardians, 4 pass sentries and 2 terrace demons, 4 giants, 3 wizards, 2 rangers; the start town's hen yard and goblin camp are not aggressive. With "the largest aggressive camp of the type" as the attackers (3 scorpions, 2 guardians, 4 demons) the kill counts are the same, to the kill (second pass).
- Gear: only weapon, body and legs are bought. **Purchase rule (pinned after the critique, CALL-3.2):** after every kill, for the weapon, then the body, then the legs, take the highest tier above the one worn that the fighter can wear (the weapon by Attack, body and legs by Defence) and that it either owns or can afford at the shop price, and equip it. Never wait for a higher tier while a better affordable one exists. Each purchase costs 40 s. Kit table: bronze, iron, mithril, adamant, rune and dragon scimitars, the steel longsword and the black scimitar; the plate body and legs of each tier, and the dragon platebody (`dragon_chain`). A dropped kit piece counts as obtained when its expected count reaches 1 (after 1/chance kills). Every other gear drop is sold at 65% (`items.ts` 70-75). Bones and food are not sold. The rule matters. Read as "buy only the highest tier you can wear", the same text gives a fighter that skips iron to black and wears mithril at 37 minutes (critique 1.1).
- Slayer, when used: the fighter takes the task `pickSlayerBand(combatLevel)` gives whenever it has none, and counts the bounty (paid when the task's last kill lands, plus 10 s per task for the walk to the master, `worldBuild.ts` 232) only on kills of the task's monster. It keeps choosing targets by the rule below: a task it cannot win against pays nothing until the fighter can. The per-kill Slayer XP and the bounty XP go to Attack unmultiplied (`adventure.ts` 366-376).
- **Start, in every "after" row (owner 2026-11-14):** the hero starts with nothing and plays the starter chain of 7.1 item 9 first. The chain is a fixed list of 29 actions: it hands over the bronze scimitar at once, includes one goblin kill, five copper ore, five smelts and two forgings, and ends with the bronze platebody and platelegs worn and 25 GP paid. The chain's first quest makes the hero accept one goblin task, so every route, including "shop only", collects that one bounty of 400 GP after six goblin kills and never asks for another unless the row says "Slayer". The chain is given 90 s per quest of average time; that figure is an assumption and is used only for the printed average. **The helm, shield and boots the chain pays stay in the backpack in the model** (plan M1's chain wears only the scimitar, platebody and platelegs). A player who wears them is a little sturdier: in the second-pass model iron's level comes at kill 35 instead of 38, and on A3 the iron wait falls from 75 to 41 further kills. No bound of 5.3 comes closer than 21 against a floor of 1 (A3, drops doubled), and A1 stays at 78 or more against 25.
- Existing start-town quests: in the "after" rows the two of them (`lumbridge`, `cook`) pay 1,300 GP, 250 Attack and 250 Hitpoints XP at the first kill after the chain and cost 90 s each of average time. The chain has already met four of their six steps. "Today" rows ignore quests because today's start needs no money.
- Not modelled: ranged and magic (4.7), amulets, rings and capes (4.6), prayers, special attacks, deaths, banking, the walk between regions (30 s per change of monster type is added).
- Gathering: time per item = the larger of (0.6 s / success chance + 1 s to step to the next node) and ((respawn + 0.6 s / success chance) / nodes at the site). A **site** is the largest group of nodes of one type in which each stands within 15 units of another. On `main` (`placements.ts`): copper 2, iron 3, mithril 2, gold 3, runite 2; normal trees 3, oaks 2, willows 2, maples 3, yews 2, magic trees 2; shrimp spots 3, trout 1, lobster 2, shark 2. Success chance is min(0.92, 0.50 + 0.02 x (level - requirement)) (`actions.ts` 425). Fishing spots deplete on 35% of catches (432). Crafting is instant (`playerActions.ts` 408-419).
- "Model-optimal" means a player who never stops, never dies and always knows the best target. A real player is slower. This document assumes about twice as slow and marks that as an assumption, not a measurement.

### 4.3 Work and average time to each tier

**Today.** Kit worn, model-optimal, in minutes ("m") and hours ("h"). These rows describe the game as it ships. They are information: nothing in Stage 3 asserts a time (owner, 2026-11-14).

| Row | Case | XP | bronze | iron | steel | black | mithril | adamant | rune | dragon |
|---|---|---|---|---|---|---|---|---|---|---|
| T2 | **Today as shipped**, world of `main`, no Slayer | 10x | 0 | 3 m | 4 m | 9 m | 10 m | 12 m | 17 m | 38 m |
| T1 | Today, world of `main`, with Slayer | 10x | 0 | 3 m | 4 m | 9 m | 9 m | 12 m | 18 m | 44 m |
| T4 | Today plus Stage 2 rules, no Slayer | 10x | 0 | 3 m | 6 m | 8 m | 12 m | 13 m | 18 m | 44 m |
| T3 | Today plus Stage 2 rules, with Slayer | 10x | 0 | 3 m | 6 m | 9 m | 12 m | 15 m | 22 m | 60 m |
| T2 | Today, player switches to 1x, no Slayer | 1x | 0 | 5 m | 9 m | 15 m | 21 m | 36 m | 69 m | 4.5 h |
| T4 | Today plus Stage 2 rules, 1x, no Slayer | 1x | 0 | 4 m | 10 m | 16 m | 23 m | 40 m | 73 m | 5.2 h |
| T3 | Today plus Stage 2 rules, 1x, with Slayer | 1x | 0 | 5 m | 13 m | 21 m | 30 m | 54 m | 1.7 h | 7.8 h |

**After the design.** Counted in kills since the new game, with the average time beside each count as information. "Level" is the kill on which Attack and Defence both reach the tier. "Kit" is the kill after which weapon, body and legs of the tier are all worn. Source: the critique's model extended as described at the top of this document, with the camps of `feat/world-place` as they stand today.

| Row | Case | | bronze | iron | steel | black | mithril | adamant | rune | dragon |
|---|---|---|---|---|---|---|---|---|---|---|
| A1 | **Shop only**, 1x (no drops used, no Slayer after the chain's one task) | level | 0 | 38 | 111 | 155 | 227 | 432 | 815 | 4,605 |
| | | kit | chain | 131 | 353 | 452 | 539 | 823 | 1,557 | 4,605 |
| | | average | 9 m | 23 m | 42 m | 55 m | 64 m | 89 m | 2.4 h | 5.5 h |
| A3 | **Shop, drops and Slayer**, 1x | level | 0 | 38 | 101 | 145 | 217 | 409 | 791 | 4,582 |
| | | kit | chain | 113 | 185 | 377 | 409 | 447 | 1,086 | 4,582 |
| | | average | 9 m | 24 m | 30 m | 48 m | 51 m | 56 m | 1.8 h | 5.4 h |
| C | **Control:** the new start with today's prices, drops and bounties, 1x | level | 0 | 38 | 111 | 155 | 227 | 432 | 815 | 4,605 |
| | | kit | chain | 38 | 111 | 155 | 227 | 432 | 815 | 4,605 |
| A1 | Shop only with the hidden 10x booster on | level | 0 | 4 | 12 | 17 | 24 | 44 | 83 | 462 |
| | | kit | chain | 46 | 134 | 233 | 320 | 558 | 738 | 1,270 |
| | | average | 9 m | 19 m | 30 m | 39 m | 47 m | 67 m | 93 m | 2.6 h |

The same kills by monster on row A1: 111 goblins, then 231 scorpions, then hill giants (11 by the steel kit, 481 by adamant, 1,215 by rune, 4,263 by dragon). That last figure is finding F12.

Reading the tables:

- Today the kit is worn within two minutes of the level at every tier, at either multiplier. Money never binds. The 10x default then compresses the levels themselves to under 40 minutes.
- The kills that reach each level are the same before and after the design (row C against row A1). Stage 3 does not change how fast levels come. It changes what happens next: in row C the kit is complete on the very kill that reaches the level, at every tier. In row A1 the hero fights on for 93 to 391 more kills from iron to adamant before the kit is paid for. With bounties and drops (A3) it is 75 to 232 more kills from iron to mithril. From adamant on, hill giants pay enough that the level is nearly the limit again. Dragon is level-bound for everyone.
- **Most of the distance between today and after is the experience rate, not the economy.** Switching today's game to 1x already moves rune from 17 to 69 minutes and dragon from 38 minutes to 4.5 hours (rows T2). The price, drop and bounty changes do not lengthen the game to dragon. They put work between reaching a level and wearing its gear.
- A fighter who only shops runs one to two tiers behind its level through the middle of the game (5.2). The owner accepted the tenfold price knowing this (critique H-6), on the condition that the game shows the forge recipe beside the shop price when a piece becomes wearable (7.1 item 7).
- With the hidden booster on, levels come about ten times sooner but the gear does not: the kit needs 42 (iron) to 655 (rune) kills beyond the level. The booster stays a fast mode without making the gear free.
- The starter chain adds about 9 minutes of average time before the first free kill. Rows A1 and A3 include it. The first two drafts' A rows did not, so their minutes are not comparable with these.

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
| F17 | After the first quest the tracker points a new character at the Varrock quest, whose kill step is a camp that attacks in a pack, and hides the start-town Cook quest until five quests later (critique H-2). | `adventure.ts` 529-550 | Fixed in 7.1 item 12 (owner 2026-11-14) |
| F18 | Every load prints the cheat codes in chat, and Settings shows them and the 10x button to every player (critique M-6). | `runtime.ts` 180, `index.html` 382, 390-400 | Hidden in 7.1 item 10 (owner 2026-11-14) |
| F19 | Magic needs a staff. The only staff a new character can wear has no recipe and would cost 3,200 GP after the markup (critique M-7). | `combat.ts` 54-57, `catalog.ts` 65 | Fixed in 7.1 item 11 (owner 2026-11-14) |

### 4.7 Ranged and magic

Not simulated through the tiers. Checked at level 1 against a goblin, damage per swing: bronze scimitar 1.46, bare hands 1.03, oak shortbow 2.30, Staff of Fire with Wind Strike 4.58 (`actions.ts` 103-108). A shot costs an arrow (8 GP in the shop, or about 3 GP fletched, `extras.ts` 5-6, `recipes.ts` 85-93); a cast costs 11 GP of runes (`magic.ts` 21, `extras.ts` 16-17). A goblin pays 22 GP in coins.

So today the free staff makes magic three times as strong as melee from the first minute.

After the design (owner 2026-11-14, "let's create an entry-level staff") the fifth starter quest pays a **Hazel Staff** with 30 casts of Wind Strike. Damage per swing at level 1 against a goblin, by the magic branch of `performPlayerAttack` (`actions.ts` 105-108: max hit is the spell's base 6 plus 0.22 per Magic level plus 0.18 per point of magic bonus; accuracy is 1.5 per level plus the bonus plus 16):

| Weapon at level 1 | Max hit | Hit chance | Damage per swing | Cost per swing |
|---|---|---|---|---|
| Bare hands | 2 | 0.78 | 1.03 | 0 |
| Bronze scimitar | 3 | 0.83 | 1.46 | 0 |
| Oak shortbow | 5 | 0.86 | 2.30 | 8 GP bought, about 3 GP fletched |
| **Hazel Staff**, Wind Strike | 6 | 0.82 | 2.58 | 11 GP |
| Staff of Fire, Wind Strike | 10 | 0.90 | 4.58 | 11 GP |

Wind Strike hits for 6 even with no magic bonus, so the staff's own numbers barely matter (a staff with no bonus would do 2.48). What limits magic is the 11 GP a cast, about half of what a goblin pays in coins. The Hazel Staff therefore sits beside the oak shortbow: a faster start that earns less. The Staff of Fire stays the first real upgrade at 3,200 GP. Magic and ranged are still not simulated through the tiers, so this is a level-1 comparison and no more (section 14).

---

## 5. The milestones Stage 3 commits to

**Decided by the owner, 2026-11-14:** milestones, "but not tied to minutes, tied to tasks. We can have an average, but it cannot be the standard." So this section states each tier as work done by the player, the pacing test asserts that work and its order, and time appears only as a printed average.

### 5.1 The milestones, as tasks

Each row is what a new character does to wear the tier's weapon, body and legs. Kills are counted from the new game and include the earlier rows. Source: the extended critique model (4.3), at 1x.

| Tier | To be allowed to wear it | To pay for it at the shop (route A1) | With bounties and drops as well (route A3) | Or to forge it |
|---|---|---|---|---|
| Bronze | Level 1 | **The starter chain:** 6 quests, 29 actions: accept 1 task, win 1 fight, gather 7 items, cook 1, smelt 5, forge 2, wear 3, visit the bank, sell 1, buy 1, claim 6 rewards. No coin spent. | The same chain | The chain is the forge route: 5 copper ore, 5 bronze bars, platelegs and a platebody |
| Iron | Attack and Defence 5: 38 kills (goblins) | 5,350 GP: 131 kills (111 goblins, 20 scorpions), the chain's one goblin bounty and the two start-town quests (1,300 GP) | 113 kills | Mining 10 and Smithing 9: about 49 ore (42 copper, 7 iron), 49 bars, 3 forgings. No coin |
| Steel | Level 10: 111 kills | 11,100 GP: 353 kills (111 goblins, 231 scorpions, 11 hill giants) | 185 kills | No recipe |
| Black | Level 15: 155 kills | 15,900 GP: 452 kills | 377 kills | No recipe |
| Mithril | Level 20: 227 kills | 21,100 GP: 539 kills | 409 kills | Mining 25 and Smithing 24: about 210 ore and bars in all, 10 of them mithril |
| Adamant | Level 30: 432 kills | 50,000 GP: 823 kills | 447 kills | No recipe |
| Rune | Level 40: 815 kills | 129,000 GP: 1,557 kills (1,215 of them hill giants) | 1,086 kills | Mining 50 and Smithing 45: about 980 ore and bars in all, 13 of them runite. Runite stands behind Stage 2's pass |
| Dragon | Level 60: 4,605 kills | 380,000 GP: already earned when the level arrives | 4,582 kills | No recipe |

Notes on reading it:

- The gold in each row is the kit's shop price. The fighter also buys single pieces of later tiers as soon as it can wear and afford them (the purchase rule of 4.2), so what it has spent in total by each kit is more: 5,350, 20,850, 38,150, 53,450, 103,450, 232,450 and 612,450 GP.
- The forge counts are a rough hand calculation of "mine the best rock you can, smelt it, forge the kit". They are shown to give the size of the task. The committed model prints the real lists (plan M1).
- Route A3 is the first Slayer implementation anyone has run against these rules. The critique's model had none. Its counts are shown, and less is asserted on them than on A1 (5.3).

### 5.2 Two quantities the test reads off the milestones

- **Further kills**: kills between the level and the kit. This is the work the economy adds: fighting done for the money alone.
- **Tiers behind**: when a kit is finally complete, how many later tiers the hero's level already allows.

| At 1x | iron | steel | black | mithril | adamant | rune | dragon |
|---|---|---|---|---|---|---|---|
| A1, further kills | 93 | 242 | 297 | 312 | 391 | 742 | 0 |
| A1, tiers behind | 1 | 2 | 2 | 1 | 1 | 0 | 0 |
| A3, further kills | 75 | 84 | 232 | 192 | 38 | 295 | 0 |
| A3, tiers behind | 1 | 1 | 1 | 0 | 0 | 0 | 0 |
| Control (today's prices, drops and bounties), further kills | 0 | 0 | 0 | 0 | 0 | 0 | 0 |
| For information: share of the kit's price earned by the time the level arrives, A1 | 48% | 37% | 44% | 55% | 70% | 79% | 202% |
| The same share in the control | 7 times | 8 times | 10 times | 14 times | 22 times | 29 times | - |

### 5.3 What the pacing test asserts

All of it is counts and order. The model is called as a pure function of the game's tables: no random number, no clock.

1. **The chain earns the bronze kit.** Playing the 29 actions of the starter chain on a new-game state, with the game's own functions, makes each of the six quests claimable in order and ends with a bronze scimitar, platebody and platelegs worn, one kill made and no coin spent on equipment.
2. **Every tier is a step, in order.** On A1 and A3 at 1x: no kit is complete before its level, and each kit from iron to dragon is complete strictly later than the one before. No tier is skipped. (Not asserted at 10x, where two kits can land on the same kill.)
3. **The kit is earned after the level.** On A1 at 1x, from iron to adamant, the kit takes at least **25 further kills**. On A3, from iron to mithril, it takes at least one.
4. **The gear is never out of reach.** On A1 at 1x, from iron to rune, the fighter is never more than **three tiers behind**: each kit is complete before the hero could wear the tier four steps up.
5. **Negative control: today's economy fails.** The new start with today's prices, drops and bounties, with and without Slayer, must fail assertion 3 at every tier from iron to adamant. If the control passes, the test proves nothing and is itself wrong.
6. **The hidden booster speeds levels, not gear.** On A1 at 10x, from steel to rune, the kit still takes at least 25 further kills. Iron is printed and not asserted (6.1 says why).
7. **The forge needs no coin.** For bronze, iron, mithril and rune the forge route's task list ends with the kit made and no gold spent, and each tier's list is longer than the one before.
8. **The table is printed, with average times, and no assertion reads a time.** The model returns counts in one object and average seconds in another. The test file refers to the second only where it prints.

### 5.4 Why these bounds are not circular

The critique found the first proof circular: minute windows drawn around one script's output, with 2 to 6 minutes of slack, less than the 3 to 8 minutes by which two honest implementations of the same text differed (critique C-1, H-1). The new bounds answer that in four ways.

- **The unit.** Two implementations differ mostly in how long things take: rest, respawn, walking, buying. A count of kills does not contain those. Kills to a level follow from the XP table and the monster's hitpoints. Kills to a kit follow from prices and coin drops. Both come straight from data tables. The time model still decides which monster is fought, and that is the remaining way two implementations can disagree.
- **The thresholds are not read off the output.** Assertions 1, 2, 5, 7 and 8 contain no tuned number at all: they are order, equality and zero. Assertion 3 uses a round floor, 25 kills, chosen as "clearly more than nothing". Assertion 4 uses a whole number of tiers.
- **The slack is stated.** Section 6.1 lists what was run across the whole range the tuning task may use (markup 8 to 12, drop chances at half to double) and the closest value to each bound. On A1 at 1x the smallest value is 76 further kills against a floor of 25, and the control gives 0. The fighter is at most 2 tiers behind against a bound of 3. Where the slack was thin (iron with the booster on, 36 against 25), the assertion was not made.
- **The test must be able to fail.** The control (assertion 5) is today's economy, and it fails at every tier, with or without Slayer. Plan M1 runs all of this once before any data task changes, with the design's parameters injected, and stops the stage if an assertion fails then.

What each bound can catch (second pass): route A1 uses no drops and no bounty after the chain's, so its floor of 25 tests the shop price alone; at markup 1 it gives 0 further kills. The drop and bounty changes of 7.1 items 3 and 8 are caught only by A3's floor of 1: with the tenfold price but today's drops and bounties, A3 gives 0 at iron, steel and adamant and fails it.

What is still drawn from the model, said plainly: the floor of 25 and the bound of three tiers were chosen by the lead after seeing these counts. They are deliberately far from the measured values so that a second implementation does not trip them. The owner confirms them in Q3.10. A share of the kit's price (5.2, last rows) would be a more natural bound at 100%, but it was rejected as an assertion: it reaches 99% at rune with markup 8 and passes 100% on the Slayer route at markup 8, inside the tuning range. That is the thin slack the critique objected to, in another unit. It is printed only.

### 5.5 Average times, as information

Never asserted. Model-optimal averages from 4.3, and an assumed factor of about two for a real player.

| | bronze | iron | steel | black | mithril | adamant | rune | dragon |
|---|---|---|---|---|---|---|---|---|
| A1, shop only | 9 m | 23 m | 42 m | 55 m | 64 m | 89 m | 2.4 h | 5.5 h |
| A3, shop, drops and Slayer | 9 m | 24 m | 30 m | 48 m | 51 m | 56 m | 1.8 h | 5.4 h |
| A real player, about double | 10 to 20 m | under an hour | 1 to 1.5 h | 1.5 to 2 h | about 2 h | 2 to 3 h | an afternoon | 10 to 15 h |

The owner accepted "five to eight model-hours to dragon gear" as information (2026-11-14). This model gives 5.4 to 5.5 hours. The first script gave 5.5 without Slayer and 7.9 with it, because it charged the walk to the Slayer master differently. Making the road longer would need a slower level curve or slower combat, which this stage may not touch.

### 5.6 What each step unlocks

Stage 2 decides who attacks: a camp leaves the hero alone once the hero's combat level is above the monster's level.

| When | The hero has | It unlocks |
|---|---|---|
| New game | Nothing in hand, combat level 3 | The start town is passive (Stage 2): chickens, goblins, goblin archers. Copper rocks, trees, shrimp spots, bank, store, anvil, altar, task master. The starter chain. |
| Starter chain done | Bronze scimitar, platebody and platelegs, helm, shield, boots, a Hazel Staff with 30 casts, food, 25 GP, Mining 2, Smithing 3 (five smelts and two forgings give 175 XP at 1x) | Two start-town quests that pay 1,300 GP together, most of their steps already done. Goblins for coin, the first goblin bounty. |
| Attack and Defence 5, Mining 10, Smithing 9 | 38 kills | Iron gear. Iron rocks east of the river. Oak trees and the oak shortbow. |
| Combat level 13 | | Scorpions stop attacking in packs: the dunes, gold and mithril rocks, the second Slayer band. |
| Attack and Defence 10, then 15 | 111, then 155 kills | Steel, then black gear (shop or scorpion drops). |
| Attack and Defence 20, Mining 25, Smithing 24 | 227 kills | Mithril gear. Wizards (combat 19) and rangers (25) stop attacking in packs. Woods teleport at Magic 20 once the shrine is found. |
| Combat level 29 | | Hill giants one at a time: the main money and experience until rune. |
| Attack and Defence 30 | 432 kills | Adamant gear. Around here buried bones can bring Prayer to 25 to 30 and the protection prayers that Stage 2's gate asks for (Prayer is not in the model). |
| Attack and Defence 40, combat 46, Mining 50, Smithing 45 | 815 kills | Rune gear. Moss guardians stop attacking: yew and magic trees in peace. Runite behind the pass. |
| Attack and Defence 60, combat 69 | 4,605 kills | Dragon gear. The pass sentries stop attacking. |

---

## 6. Approaches

### 6.1 How to make money matter

This table and the sensitivity table below are the first script's, in minutes, with the earlier start proposal (a scimitar handed out). They are kept as the record of why the levers were chosen and assert nothing. Measured by ablation on "today plus Stage 2 rules, with Slayer" at 1x, here with the two start-town quests done (they add 3 minutes and 1,300 GP, which is why this baseline is later than row T4): kit-worn minutes for iron / steel / black / mithril / adamant.

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

The level gates are about 9 / 16 / 27 / 36 / 62 with Slayer and 8 / 12 / 22 / 28 / 48 without. With today's bounties a Slayer user waits a few minutes at most whatever the markup. These two tables are in minutes and come from the first script; they are kept as the record of why the levers were chosen, and assert nothing.

The same sweep in work, from the extended critique model (kills beyond the level before the kit is complete, iron / steel / black / mithril / adamant, and the largest number of tiers the fighter falls behind, 5.2):

| Markup | Shop only (A1): further kills | Tiers behind, at most | Shop, drops and Slayer (A3): further kills |
|---|---|---|---|
| 8 | 76 / 196 / 253 / 251 / 274 | 2 | 61 / 84 / 193 / 189 / 51 |
| 9 | 84 / 229 / 275 / 281 / 333 | 2 | 66 / 84 / 212 / 192 / 44 |
| **10** | **93 / 242 / 297 / 312 / 391** | **2** | **75 / 84 / 232 / 192 / 38** |
| 11 | 101 / 254 / 319 / 342 / 450 | 2 | 42 / 84 / 228 / 192 / 41 |
| 12 | 109 / 266 / 340 / 373 / 509 | 2 | 60 / 84 / 245 / 192 / 63 |
| 1, with today's drops and bounties (control) | 0 / 0 / 0 / 0 / 0 | 0 | 0 / 0 / 0 / 0 / 0 |

What was run, and what it showed. Assertions 2 to 6 of section 5.3 were evaluated on: A1 at 1x and at 10x for every markup from 8 to 12 (A1 uses no drops, so the drop knob cannot move it); A3 at 1x for every markup from 8 to 12, each with the gear drop chances at half, at the design's value and at double, which is the whole range the tuning task may use (15 runs); and the control with and without Slayer. Every A1 and A3 run passes every assertion, and both control runs fail assertion 3 at every tier. The closest calls:

| Assertion | Closest value in those runs | Bound |
|---|---|---|
| 3, A1 at 1x, further kills iron to adamant | 76 (iron, markup 8) | at least 25 |
| 3, A3 at 1x, further kills iron to mithril | 25 (iron, drops doubled, any markup) | at least 1 |
| 4, A1 at 1x, tiers behind | 2 | at most 3 |
| 6, A1 at 10x, further kills steel to rune | 99 (steel, markup 8) | at least 25 |
| 6, the same at iron, which is printed and not asserted | 36 at markup 8, 42 at markup 10, 48 at markup 12 | - |
| 2, strict order of the kits, A3 at 1x | never tied in the 15 runs | - |

Two things this sweep did not show, said plainly. On A3 with the booster on, the steel and black kits are completed on the same kill, so strict order does not hold at 10x; assertion 2 is made at 1x only. And at 10x the iron kit needs only 36 to 48 further kills, because the level arrives after four kills while the chain's bounty and the two start-town quests already pay a third of the kit; that is too close to the floor of 25 to assert, so assertion 6 starts at steel.

The markup is therefore no longer a knife-edge choice: 10 stays (owner, 2026-11-14).

A fourth option, **D: shop stock by place or by shrine**, was considered and left out. It does not lower income, so it cannot replace C, and with C in place the price already keeps the top items away from a new character (the cheapest strong amulet is 7,200 GP, the Fire Cape 90,000). It is CALL-3.9.

### 6.2 What the hero starts with

**Decided by the owner, 2026-11-14: "quests to earn it".** The hero starts with nothing in hand and earns the first equipment through quests in the start town.

| | A. Nothing at all, no guidance | B. A weapon, three meals, 25 GP handed out (the earlier proposal) | C. Nothing in hand, and a short quest chain that pays the kit (decided) |
|---|---|---|---|
| For | The purest reading of "almost nothing". | The first click on a chicken works. | The first ten to twenty minutes become the tutorial: each quest teaches one loop and pays one piece. The hero ends with what B handed out, and more, and has done every loop once. |
| Against | No bronze weapon recipe exists, so the first weapon is 450 GP from the shop: the first ten minutes are punching chickens. | The kit is a gift, which is what the stage set out to end. | Six quests are new content (C3). The first weapon arrives one conversation after the start, not at second zero. |

How established games open, and what is borrowed: many RPGs run a short, linear opening chain in a safe starting area. Each step introduces one system (move and talk, fight, gather, craft, store, trade) and its reward is the tool for the next step, so the starting kit is assembled from quest rewards and the last step points at the wider world. Stage 3 borrows that structure: one loop per quest, the reward of each quest useful in the next, a strict order, a safe area, a closing pointer to the next tier. It borrows no content: no name, character, place, item or line of text comes from another game.

The chain itself is 7.1 item 9. It is built only from what the quest system does today (`adventure.ts` 32-55, 418-447): a quest is a list of steps that are true or false for the current state, a reward of coins, experience and items, a card in the Adventure Log with a Claim button, and one line in the tracker under the health bar. There is no dialogue, no quest giver and no branching, and the chain needs none. **Dependency on Stage 6:** characters who give these quests, spoken lines, and any step that cannot be read from the state ("talk to someone who is not the task master").

### 6.3 The default experience rate

**Decided by the owner, 2026-11-14: new games start at 1x, "but the boosters must stay hidden".**

| | A. Keep 10x default | B. New games start at 1x, the button stays in Settings (the earlier proposal) | C. Remove the option | D. New games start at 1x, the option exists but is hidden (decided) |
|---|---|---|---|---|
| Result | Levels for rune in about 15 minutes whatever else is done. | The milestones hold for anyone who does not opt out, but the opt-out sits one click away on a normal screen. | The milestones always hold. | The milestones hold for every player who does not know the word. The owner can still turn the booster on. |
| Against | Fails the stage's intent. | A fast mode shown to everyone reads as the intended way to play. | Takes a shipped feature away. | A player on a touch screen has no way in (accepted, 7.1 item 10). |

The cheat codes get the same treatment ("same as the boosters, keep them hidden"), by the same mechanism. Existing saves keep the rate they saved (section 8).

### 6.4 Where the model lives

- **A (recommended):** move the hit, gather and drop arithmetic out of `actions.ts` into pure functions in `src/state`, unchanged; commit the model under `tests/support/` and have it call those functions and read the live tables. The pacing test then fails when someone changes a drop rate, a price or a formula so that a milestone assertion breaks.
- **B:** commit the model with its own copy of the formulas. Cheaper, and proves nothing about the game.
- **C:** keep the model out of the repository and trust this document. The next data edit silently invalidates it.

### 6.5 How established games solve the same problems

Added after the critique, at the owner's request: each pacing and economy choice set against the strategy other RPGs and MMOs use for the same problem. Strategies are borrowed. No name, character, place or item is taken from another game, and nothing new is added.

| Problem | Well-known strategy (where it is used) | What this design does | Judgement |
|---|---|---|---|
| Starting kit | **Core-verb starter kit**: one weapon, a little food, a few coins; the rest comes from the first quests (most MMOs' starting zones, action RPGs' class starter weapon). Some games instead hand out one item per combat style so the player can try each. | Nothing in hand. Six start-town quests pay a scimitar, food, coin, a helm, a shield, a staff with runes and boots, and have the hero forge the body and legs (7.1 item 9). | Decided by the owner ("quests to earn it"). It keeps "begin with almost nothing" and adds style sampling for magic. Ranged is sampled by fletching, as before. |
| Experience rate | **Base rate with an opt-in boost**: base 1x, with boosts as events or account options (bonus-experience weekends; multiplier servers). | New games at 1x. The 10x option exists but is hidden behind a typed word (6.3, 7.1 item 10). | Decided by the owner. It is the lever that does most of the work (4.3). Hidden, the boost cannot be mistaken for the default. |
| Gear price and resale | **Vendor spread**: shops sell at or above value and buy back at a fraction, typically 25 to 60% (most MMO vendors and general stores). **Price by item level**, so price follows power. | One markup of 10 on equipment, resale unchanged at 65% of list: a 15-to-1 spread (6.1 C). | The markup is a vendor price, a known gold sink. The spread is about four times wider than usual and players will see it on every tooltip ("Shop 52,000 · sell 3,380"). Accepted because it leaves drop resale and every frozen sale test untouched. A **buy-back window** (sell back at the paid price for a few minutes) would soften mistakes, but it needs saved state, so it is not proposed. |
| Drop rates | **Rare drop with a sure alternative**: about one in a hundred, with a vendor or a craft as the guaranteed route. **Bad-luck protection** (a pity timer) where the drop is the only route. | Gear drops near 1%, the shop and the forge are the sure routes (7.1 item 3). | Fits. No pity timer is needed, because a drop is never the only route. |
| Resource depletion | **Per-node depletion with respawn** (ore rocks, harvest nodes). Chance-based depletion for multi-yield nodes (trees in several games). **Moving fishing spots** that relocate on a timer instead of emptying. | Today trees and rocks give one item per click. The design makes fishing the same (7.1 item 4). | Decided by the owner ("fishing is fishing"): the spot empties on every catch. The critique's objection, that this is one click per fish, is answered by making the loop readable: a visible empty spot, a sound when it empties and a sound when it returns. |
| Gold faucets and sinks | **Balance faucets against recurring sinks**: repair costs, death fees, travel fees, consumables, trade taxes. | Faucets: coins, bounties, quests, sales. Sinks: the shop's equipment price and, slightly, runes and arrows. | Only a one-time sink. Once the kit is owned, gold piles up. Accepted for Stage 3. The recurring sink belongs with the cost of dying in Stage 4 (7.2). |
| Crafting margins | **Crafting is mainly for experience**, margins are small or negative early, and profit comes at high level or from scarce inputs. | A cap: output sells for at most 2.5 times its direct inputs (7.1 item 5). | An invented rule, and a lenient one, but it closes the 15-fold gilded loop and checks every recipe, including future ones. The ratio does not bound absolute income, so the pacing test prints gathering and crafting GP an hour next to combat income (F15). |
| Bounties | **Task bonus on top of normal rewards**, often paid in task points or experience rather than coin (slayer-style task masters, daily bounty boards). | Coin bounties kept, five cut to a third: about +70% on the task's coins (7.1 item 8). | Fits. Paying in points would need a points shop, which is new content (Stage 6). |
| What a level unlocks | **"You can now..." messages on level-up**, and a skill guide listing unlocks per level. | One chat line per level with unlocks, at most three names, with the shop price and the forge recipe for equipment (7.1 item 7). | Fits; this is the standard strategy. A skill-guide panel would be new UI (Stage 5). |
| Onboarding, first ten minutes | **Guided opening chain**: a short linear sequence of tasks that teaches each core system and hands out the starter kit as rewards (starting-zone quest chains with breadcrumbs). | The six starter quests, shown first in the tracker; then the two existing start-town quests (1,300 GP), which the chain has mostly completed; the onboarding card and the first chat lines (7.1 items 9 and 12). | Fits, and it is now the standard strategy. The tracker fix (critique H-2) keeps the player in the start town until its quests are done. The cheat line is gone from chat (7.1 item 10). What is still missing is people: the chain has no quest giver and no dialogue (Stage 6). |
| Gear crafted or bought | **Craft, buy or loot**: three routes to the same tier, with crafting the cheap one for those who train it. Player-crafted-only economies exist in multiplayer games, where trade fills the gaps. | Smithing for bronze, iron, mithril, rune; shop for all; rare drops (7.1 item 5, 5). | Fits a single-player game. Crafting-only would leave steel, black, adamant and dragon unreachable (F14). |
| Tiered vendors | **Stock by town or by progress**: each region's shop sells its tier, which makes travel a goal. | Not done: one shop, all items (CALL-3.9). | A good fit for Stage 2's world of places, and it would make "go to the next shrine" a goal. It does not cut income, so it adds to the markup rather than replacing it. Left out for Stage 3 (CALL-3.9); it can be added later without undoing anything here. |
| Diminishing returns | **Grey monsters** give little or no experience once far below the player. | Not used. | Correctly left out: with no monster between level 28 and 45 (F12), it would make the hill-giant plateau worse. |

---

## 7. Design

Twelve changes. Each names the finding or the owner decision it answers. Items 9 to 12 were added by the owner's decisions of 2026-11-14.

### 7.1 The changes

**1. New game state (F1, F2; owner 2026-11-14, "quests to earn it").** `createNewGameState()` in `src/state/gameState.ts` returns `createDefaultState()` with: `gp` 0, `xpMultiplier` 1, every equipment slot `null`, `inventory` `[]`, and `quests.claimed` `['arrival']`. That last value is the entry that opens the starter chain (item 9); it is what tells a new game from an existing save without a new saved field. The hero can fight bare-handed (`weaponClass` returns `unarmed`, `combat.ts`), but the first quest hands over a scimitar within the first minute. `createDefaultState()` itself does not change by a byte: it is the base that `migrateLegacySave` overlays a save onto (`save.ts` 32, 35, 65-71, 76) and that most existing tests start from. `session.ts` gains `startNewGame()`, which applies the new-game state to `STATE`; `boot()` calls it only when `loadGameState()` returned `false` (`runtime.ts` 168).

Reset fix (F16, added after the critique): `session.ts` gains a module flag that `resetGameSave` sets before it removes the save keys, and `saveGameState` returns without writing while the flag is set. The `beforeunload` and `visibilitychange` saves during the reload then cannot write the old character back, and the reload reaches `startNewGame()`. This is the only path from an existing profile to the new start.

Outfit-migration fix (found by the second pass): `loadGameState` (`session.ts` 52-63) runs a one-time migration the first time any save is loaded on a browser profile without the `localStorage` key `gielinor_anime_hero_v1`: it sets the key and empties the slots that hold the old starter outfit, including `feet` when it holds `leather_boots`. It empties the slot and does not return the item. On a fresh profile a new game never sets the key (the first boot has no save, so `loadGameState` returns before the block). A player who plays the chain in one sitting and wears the Traveler Boots of quest 6 (`leather_boots`) loses them on the first reload. Fix: in `loadGameState` the slot-emptying lines and the camera lines of that block run only when the loaded state has not claimed `arrival`; the key is still set. A new-game character never wore that outfit. Existing saves are unaffected, because none has claimed `arrival`.

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

A piece that dropped on one kill in five now drops on about one in a hundred. That is one piece of each kind about every hundred kills of that monster: a lucky break, with the shop as the sure route. The drop roll moves to `rollDrops(typeKey, rand)` in a new pure module `src/state/economy.ts`, with the same order of random draws (`actions.ts` 272-288), so it can be tested and the model can read it.

**4. Fishing spots deplete like every other node (F6; CALL-3.7).** The fishing exception at `actions.ts` 432 goes: a catch depletes the spot, as a cut tree or a mined rock does. Respawn times (`catalog.ts` 495-498) become shrimp 6 s, trout 3 s (a trout site has one spot), lobster 7 s, shark 8 s (today 2, 2, 2.5, 3). The success rule moves, unchanged, to `gatherChance(level, req)` in `economy.ts`.

**Decided by the owner, 2026-11-14 (Q3.7, option a): "fishing is fishing".** The spot empties on every catch. The critique's alternative (keep the 35% chance, lengthen the respawn) is dropped. What is left of its objection is that one click per fish must read well, and today it would not: an empty fishing spot is an empty group (`spawns.ts` 171-173), so the spot simply vanishes, and nothing sounds when it empties or returns. Three cues are added, all in the engine:

- **Empty.** The catch plays a short falling tone (new `SFX.spotEmpty`, `audio.ts`), the bubbling ring disappears, and a still, faint ring stays on the water where the spot was (the fishing branch of `spawnResourceNode` gives the depleted group one flat torus, with no sway). The player sees where the fish will return. The target clears, as it does for a felled tree.
- **Return.** When the timer ends the bubbling ring comes back, as today (`updateWorldTimers`, `loop.ts` 577-587), and a short rising tone plays (new `SFX.spotReturn`) if the hero stands within 14 units. A player waiting at a single spot hears it come back without watching it.
- **Rhythm.** The respawn times are set so that a site can be worked in rotation. A cast and the step to the next spot take about 2.2 s at the requirement level.

| Spot | Respawn | Spots at a site | What the player does | One fish about every |
|---|---|---|---|---|
| Shrimp (1) | 6 s | 3 | Clicks round the three spots; the first is back as the third empties | 2.4 s |
| Trout (12) | 3 s | 1 | Catches, waits for the tone, clicks again | 4.2 s |
| Lobster (28) | 7 s | 2 | Alternates, with about two seconds of waiting per fish | 4.1 s |
| Shark (45) | 8 s | 2 | Alternates, with about two and a half seconds of waiting | 4.6 s |

These seconds describe the feel and are not asserted. What is asserted is the earnings bound of G3.3, a ratio of two rates from the same formula.

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

**7. The game says what a level unlocks, and how to get it (CALL-3.12; owner 2026-11-14, the condition on the markup).** A new pure module `src/state/unlocks.ts`: `unlocksAt(skill, level)` reads the tables and returns what first becomes usable at exactly that level: equipment whose `req[skill]` equals it, recipes, resource nodes, prayers and spells. `grantXp` (`playerActions.ts` 53-78) prints one chat line per level gained that has unlocks, naming up to three and counting the rest.

The owner accepted the tenfold shop price on the critique's condition: when a piece becomes wearable, the game shows the forge recipe beside the shop price. So each piece of equipment named in the line carries both: `Level 5 Attack unlocks: Iron Scimitar (shop 1,400 GP, or forge: 2 Iron Bar at Smithing 5).` A piece with no recipe shows the shop price alone. `forgeHint(itemId)` in `unlocks.ts` finds the `smith` or `fletch` recipe whose output is the item and formats its inputs and requirement; the prices come from `shopPrice`. This is the moment the wait of 5.2 begins, and the line is what tells a fighter that the anvil is the other way.

The onboarding card (`index.html` 50-58) and the first-run chat lines (`runtime.ts` 175-180) are rewritten to say that the hero starts with nothing and that the tracker under the health bar shows the first task. The README's feature list is corrected. The examine line (`playerActions.ts` 205, "Value: 5200 GP") becomes "Shop 52,000 GP · sells for 3,380 GP" through `shopPrice` and `unitSellPrice`, so it agrees with the shop (critique L-1).

**8. Five Slayer bounties (F10; CALL-3.14).** In `SLAYER_BANDS` (`adventure.ts` 25-30) the bounty of every band above the first is divided by 3 and rounded: scorpion 900 to 300, dark wizard 1,200 to 400, hill giant 1,800 to 600, moss guardian 3,200 to 1,100, lesser demon 5,500 to 1,800. The goblin band stays at 400 (a frozen test pins it, and it is the new character's first real money). Counts, bounty experience and per-kill experience are unchanged. Slayer then adds about 70% to the coins of the same kills instead of 200%.

**9. The starter chain: the first kit is earned (G3.10; owner 2026-11-14, "quests to earn it").** Six quests in the start town, in a fixed order, each teaching one loop of the game and paying one piece of the kit. They are the game's first ten to twenty minutes.

| # | Id | Name | What the player does (steps) | What it teaches | Reward |
|---|---|---|---|---|---|
| 0 | `arrival` | Arrival | No steps. Claimed by `createNewGameState()` and by nothing else. | Nothing: it marks a new game. | None |
| 1 | `sq_ledger` | A Name in the Ledger | Speak with the task master in the courtyard and accept a task | Moving, clicking a person, the Adventure Log where every reward is claimed, bounties | Bronze Scimitar |
| 2 | `sq_quarrel` | First Quarrel | Defeat a goblin | Clicking to attack, combat styles, hitpoints | 3 Cooked Shrimp and 25 GP |
| 3 | `sq_gather` | Stone, Timber, Tide | Mine copper ore; chop a tree; net a raw fish | The three gathering skills and where their nodes stand | Bronze Full Helm |
| 4 | `sq_forge` | Fire and Hammer | Cook a fish; smelt a bronze bar; forge a platebody and wear it | Cooking, smelting, forging, equipping. Five bars make the platelegs (2) and the platebody (3), and five smelts give the Smithing level the platebody needs | Wooden Kiteshield |
| 5 | `sq_keeping` | Left in Keeping | Open the bank | The bank, and a backpack that is filling up | Hazel Staff, 30 Air Runes, 30 Mind Runes |
| 6 | `sq_coin` | Fair Coin | Sell an item to a merchant; buy an item from a shop | Selling and buying, which is how the next kit is paid for | Traveler Boots |

At the end the hero wears a bronze scimitar, platebody and platelegs it forged itself, a helm, a shield and boots, and carries a staff with 30 casts, food and coin. That is everything the earlier draft handed out for free (a scimitar, three shrimp, 25 GP) and the first armour besides. The hero has also done every loop once. The last quest's reward text points onward: "Traveler Boots. Next: iron gear needs Attack and Defence 5. Buy it at the store, or mine iron and forge it."

Steps, as the quest system reads them. Every one uses a flag or a value that a save already holds, and every one stays true once it is done:

| Step | True when | Set today by |
|---|---|---|
| Accept a task | `quests.slayer !== null \|\| quests.slayerTasksCompleted > 0` | `assignSlayerTask` (`adventure.ts` 579-594) |
| Defeat a goblin | `quests.killedGoblin` | `registerKill` (`adventure.ts` 467) |
| Mine copper ore | `skills.mining.xp > 0` | `grantXp` on a mined rock (`actions.ts` 429) |
| Chop a tree | `skills.woodcutting.xp > 0` | the same, on a tree |
| Net a raw fish | `quests.caughtFish` | `noteGather` (`quests.ts` 104) |
| Cook a fish | `quests.cookedMeal` | `performCraft` (`recipes.ts` 152) |
| Smelt a bronze bar | `quests.smeltedBar` | `performCraft` through `noteSmelt` |
| Forge a platebody and wear it | `quests.worePlate \|\| plateWorn(state)` | equipping (`playerActions.ts` 194); the same predicate the Plaza Patron quest uses (`adventure.ts` 160) |
| Open the bank | `quests.openedBank` | `openBankModal` (`playerActions.ts` 492) |
| Sell an item | `quests.soldWares` | `noteSale` (`playerActions.ts` 99) |
| Buy an item | `quests.boughtWares` | `notePurchase` (`playerActions.ts` 352, 372) |

How it sits on the existing quest system (`adventure.ts` 32-55, 380-447, 518-550):

- A second table, `STARTER_QUESTS: QuestDef[]`, in `src/state/adventure.ts`, holds the seven entries above with the same shape as `QUEST_DEFS`: `region: 'lumbridge'`, `xp: {}`, the `gp` and `items` of the table. It is a separate table because a frozen test pins `QUEST_DEFS` to exactly ten ids and `questView` to length 10 (C6).
- A starter quest is **open** when the entry before it is claimed and it is not. `arrival` has no entry before it, so play can never open or claim it. A save that never claimed `arrival` therefore has no open starter quest, ever.
- `claimQuest` looks the id up in both tables. For a starter quest it also requires that the quest is open. Rewards go through the same code as today: `canHoldRewards`, coins, items, the `claimed` list.
- `starterView(state)` returns the claimed starter quests and the open one, as `QuestView`s, and an empty list for a state that has not claimed `arrival`. The Adventure Log (`renderQuests`, `stations.ts` 524) lists `starterView` before `questView`. `questView` is not edited.
- The tracker shows the open starter quest before anything else (item 12).
- Nothing is persisted that is not persisted today: claims go into `quests.claimed` (section 8).

Order and safety: the weapon comes before the fight; coin (quest 2) comes before the purchase (quest 6); the hero is told to make five bars before the platebody; the runes come with the staff; nothing needs gold; the start town is passive after Stage 2. The backpack is empty at the start, so no reward can be refused for space.

What the chain does to the two existing start-town quests: by its end the hero has opened the bank, defeated a goblin, cooked a fish and bought an item. Lumbridge Foundations then needs only a burned log, and Cook's Errand only buried bones. They are the tracker's next two lines and pay 1,300 GP together: the first real money, and the first step toward iron.

Borrowed and not borrowed: the structure is the common short opening chain of role-playing games (6.2, 6.5). The quests, their names and their texts are written for this game. The chain introduces no character. Its texts speak of "the task master", "the bank", "the anvil" and "the store", which the game already shows. **Dependency on Stage 6:** quest givers with names, bodies and dialogue; a "talk to" step for anyone but the task master (today a conversation prints one chat line and leaves no trace in the state, `loop.ts` 208-212); branching or optional steps.

Quest texts (the `lore` field):

1. "Nobody here knows you yet. Put your name in the task master's ledger and take the work on offer."
2. "The camp across the green has been raiding the hen yard. Settle one quarrel."
3. "Everything in the haven is dug, cut or caught by somebody. Try all three."
4. "Cook what you caught. Then smelt five bronze bars at the anvil: two make platelegs, three make a platebody."
5. "The bank keeps what you cannot carry. A traveller before you left something in keeping."
6. "Sell what you do not need and buy what you do. That is how the next kit is paid for."

**10. The booster and the cheats are hidden (G3.11, F18; owner 2026-11-14: "the boosters must stay hidden", and for the cheats "same as the boosters, keep them hidden").** One mechanism for both, and it is the one the game already has: words typed on the keyboard during play (`noteCheatKey`, `session.ts` 103-115, fed from `input.ts` 55).

- **Hidden.** In `index.html` the 10x button (`xp-rate-btn`, line 382) leaves the Settings grid and joins the cheat panel (390-400) inside one new block, `<div id="hidden-tools" hidden>`. Nothing is deleted: `applyLoadedStateToHud` (`hud.ts` 406), `toggleXpMultiplier` (`playerActions.ts` 309), `syncSettingsButtons` (`stations.ts` 588) and `boot()` (`runtime.ts` 181) fetch these elements by id, and `el()` throws on a missing one (`hud.ts` 37-43). The chat line that lists the cheat codes on every load (`runtime.ts` 180) is removed. The reply to a wrong code (`session.ts` 142) stops naming the codes. The README stops mentioning the rate switch.
- **Reachable.** Typing the word `backroom` during play shows the block until the page is reloaded and prints "Hidden tools are shown in Settings until you reload." The word is matched by a new function `matchToolsCode` in `src/state/cheats.ts`, beside `matchCheat`, which is not edited (a frozen test pins it). Nothing is stored: no new saved field and no new `localStorage` key.
- **Both in one place.** Once shown, the block holds the 10x button and the cheat buttons exactly as today. The two cheats also still work when their codes are typed directly (`skills10`, `gold200k` and their aliases), as they do today. They were never visible; only their advertisement goes.
- **An existing save with 10x active** keeps its rate (section 8). It sees no button. On load it gets one chat line: "This character earns experience at 10x." To change the rate the player types the word and uses the button. This line is new owner decision Q3.11.
- **Accepted limits.** A device with no keyboard cannot reach the tools. The word is recorded here and in a code comment, not in the game or the README.

**11. An entry-level staff (G3.12, F19; owner 2026-11-14, "let's create an entry-level staff").** One new row in `ITEMS` (`catalog.ts`, beside the other staffs at line 65):

`hazel_staff: { id: 'hazel_staff', name: 'Hazel Staff', type: 'equip', slot: 'weapon', iconKind: 'staff', style: 'magic', tier: 'bronze', mag: 4, atk: 2, str: 1, req: { magic: 1 }, price: 60, color: 0x7c8a4a, trim: 0x8d6b3a }`

| | Hazel Staff | Staff of Fire, for comparison |
|---|---|---|
| Requirement | Magic 1 | Magic 1 |
| Magic bonus | 4 | 24 |
| Wind Strike at Magic 1 | max hit 6, about 2.6 damage a cast against a goblin | max hit 10, about 4.6 |
| List price | 60 GP | 320 GP |
| Shop price (ten times list) | 600 GP | 3,200 GP |
| Sells for | 39 GP | 208 GP |
| How it is obtained | The fifth starter quest pays one with 30 Air and 30 Mind runes. The store sells it like every item | The store |

- **Why these numbers.** Damage follows 4.7: the spell does the work, so the staff sits just above the oak shortbow (2.3 a shot) and well below the Staff of Fire. The price sits between the bronze scimitar (45) and the oak shortbow (95), so a character who sells or loses the staff replaces it for about thirty goblins' coins. No recipe makes it, so the 2.5 rule does not apply, and its shop price is above its sale value like every item's.
- **Pacing.** The model is a melee fighter and does not cast. Thirty casts are about nine goblins. After that each cast costs 11 GP of runes against about 21 GP of goblin coins, so a character who stays with magic levels faster and earns about half as much: the trade 4.7 describes. No milestone moves. This is argued, not measured (section 14).
- **How staffs are modelled and drawn today.** An item is a staff when `style` is `magic` and `iconKind` is `staff` or `wand`. `weaponClass` (`combat.ts`) then allows the magic style, and `canUseStyle` (`combat.ts` 54-64) asks for the runes. The model in the hand is chosen by `gearSilhouette` (`playerGear.ts` 73-96): any `staff` that is not one of three named ids gets the silhouette `staff`. `buildWeaponVisual` (`playerGear.ts` 516-527) clones the node `Gear_staff` from `gear.glb` and recolours its materials from the item's `color` and `trim` (`cloneBlenderGearNode`, `blenderGear.ts` 43-116); the orb glows in `color`. If the model file is missing, the same function builds a staff from primitives with the same two colours (`playerGear.ts` 628-644). The icon comes from `iconKind` (`icons.ts` 92).
- **No new model.** The Hazel Staff reuses the existing staff mesh with another tint: a muted green orb and a dull brass ring, against the Staff of Fire's dark red. No Blender work and no new texture. The Mystic Water Staff and the Trident already share this mesh the same way.
- **The shop** lists every entry of `ITEMS` (`stations.ts` 289), so the staff appears there with no further change, under the Magic filter.

**12. The tracker keeps a new character in the start town (F17; owner 2026-11-14, accepted).** `adventureTracker` (`adventure.ts` 529-550) today shows the first unclaimed quest in table order. It becomes, in this order:

1. the open starter quest, if there is one;
2. the first unclaimed quest of `QUEST_DEFS` whose region the hero has discovered (`state.shrines[quest.region]`), in table order;
3. the first unclaimed quest of `QUEST_DEFS` in table order, as today;
4. "Every quest is claimed".

For a new character that gives: the six starter quests, then Lumbridge Foundations, then Cook's Errand, and only then Varrock. The Adventure Log's own order does not change, apart from the starter quests listed first.

**The one declared test replacement, authorised by the owner on 2026-11-14.** File `tests/phase3-content.test.ts`, case `tracks the earliest open step, then a claim prompt, then the next quest` (lines 30-42). Its last assertion, line 41:

`expect(adventureTracker(state).title).toBe('Varrock Arcane Trial');`

becomes

`expect(adventureTracker(state).title).toBe("Cook's Errand");`

Nothing else in that case or that file changes. The case's first assertions (the tracker starts at "Lumbridge Foundations", "Open the Lumbridge Bank", then the claim prompt) stay true, because its state is the default state, which has no open starter quest.

### 7.2 Not changed, with reasons: staying alive (F9; CALL-3.10)

Regeneration, the altar's free heal and death without loss stay. They decide how every fight ends, which is Stage 4's subject ("combat with weight"), and Stage 2's gate simulation is tuned against them (Stage 1-2 design 6.6). The milestones of section 5 are measured with them as they are; the model includes regeneration. What is lost meanwhile: food stays optional, and gold has no recurring sink. Once a player owns the kit they want, gold only accumulates (6.5, critique M-2). **Dependency on Stage 4:** decide regeneration, the altar and the cost of dying together, give food a job, and make the cost of dying the recurring gold sink.

### 7.3 Not changed: coins and quest rewards

Coin drops stay. Tests pin every quest reward (C6), and with the markup the ten existing quests together (57,300 GP) are worth about one adamant kit, which is a fair size for them. The six starter quests pay 25 GP in all. From adamant on, a Slayer user still affords each kit as the level arrives, because hill giants pay 176 GP a kill in coins alone; closing that would mean cutting coin drops, which this stage does not do.

### 7.4 Not changed: item requirements (F11)

No `req` is edited. The pieces of F11 cost 54,000 (Fury), 48,000 (Berserker Ring) and 90,000 GP (Fire Cape) after the markup, which is adamant-to-rune money: a new character cannot have them, and a rich low-level one has paid for them. The Staff of Fire costs 3,200 GP and is no longer the only way into magic (item 11).

### 7.5 Not changed: content gaps (F12, F14)

A monster band between level 28 and 45 and recipes for the tiers that have none need new content. **Dependency on Stage 6.** Until then the giants plateau stands. The pacing test prints the kills by monster type, so the plateau stays visible. The starter chain is new content the owner asked for; what it leaves to Stage 6 is people and dialogue (6.2).

### 7.6 Module boundaries

| Module | Change |
|---|---|
| `src/data/items.ts` | `GEAR_MARKUP`, `shopPrice`. |
| `src/data/catalog.ts`, `src/data/world.ts` | Drop chances, fishing respawns, smithing recipe inputs and requirements. One new row in `ITEMS`: `hazel_staff`. |
| `src/data/recipes.ts` | Smelt requirements, bow log counts. |
| `src/state/economy.ts` (new) | `MAX_GP`, `MAX_STACK`, `creditGp`, `rollDrops`, `gatherChance`, `HP_REGEN_PER_SEC`. Imports only `src/data` and types. |
| `src/state/unlocks.ts` (new) | `unlocksAt`, `forgeHint`, `unlockLine`. |
| `src/state/combat.ts` | `playerAttackProfile(state)` (max hit and accuracy before a special attack), `playerHitChance(accuracy, monsterDef)`, `monsterHitChance(typeKey, state)`; Stage 2's `rollMonsterHit` calls the last one. All three are today's arithmetic, moved. |
| `src/state/quests.ts` | `STARTER_ARRIVAL = 'arrival'`, the id that marks a new game. No new flag. |
| `src/state/gameState.ts` | `createNewGameState`. |
| `src/state/adventure.ts` | `STARTER_QUESTS`, `starterView`; `claimQuest` and `adventureTracker` read both quest tables; the tracker's order (item 12); five bounties in `SLAYER_BANDS`; `creditGp` in `claimQuest` and `registerKill`. `QUEST_DEFS` and `questView` are not edited. |
| `src/state/cheats.ts` | `TOOLS_CODE`, `matchToolsCode`. `matchCheat` and the two cheat functions are not edited, except `creditGp` in `applyGold200k`. |
| `src/state/inventory.ts`, `save.ts` | Gold cap (the sale refusal); the load clamps read `MAX_GP` and `MAX_STACK`; `buyItem` uses `shopPrice`; one line in `save.ts` so the valid claimed ids include the starter quests. |
| `src/state/monsterAi.ts` | The three timing constants are exported for the model. |
| `src/engine/actions.ts` | Calls the moved functions; no formula of its own left for hit chance, drops or gather chance. The fishing condition and the empty-spot sound. |
| `src/engine/loop.ts` | Uses `HP_REGEN_PER_SEC` (one line). The return sound of a fishing spot. |
| `src/engine/audio.ts`, `spawns.ts` | Two tones; the still ring of an empty fishing spot. |
| `src/engine/session.ts`, `runtime.ts` | `startNewGame`, the reset guard (F16), first-run chat lines, the typed word that reveals the hidden tools, the removed cheat line, the notice for a save that runs at 10x. |
| `src/ui/stations.ts`, `playerActions.ts` | Shop prices shown and charged through `shopPrice`; the Adventure Log lists the starter quests first; unlock chat line; examine line. |
| `index.html`, `README.md` | Onboarding text, the hidden tools block in Settings, feature list. |

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
| Reading | `createDefaultState()`, the base a save is overlaid onto, is not edited. `migrateLegacySave` changes in one line: the set of valid claimed quest ids (`save.ts` 88) becomes the ids of `QUEST_DEFS` and of `STARTER_QUESTS`, so that a starter quest claimed in a new game is still claimed after a reload. For every save that exists today the result is identical, because none holds a starter id; the two goldens of plan P1 pin that. |
| Values that are new | `quests.claimed` may now hold `arrival` and the six starter quest ids. The field, its type and its place in the file are unchanged. |

What happens to a version-4 save, field by field:

| In the save | After Stage 3 |
|---|---|
| `gp`, `skills`, `equipment`, `inventory`, `bank`, `shrines`, `quests`, position, camera | Loaded exactly as today. The new-game state is never applied to a loaded save. |
| **The starter chain** | **Not shown.** A save that exists today has never claimed `arrival`, so no starter quest is open for it: none appears in the Adventure Log or the tracker, none can be claimed, and nothing is paid twice. This was the lead's decision among the three the owner listed (shown, auto-completed, optional): the character already owns gear, six trivial quests would sit on top of its tracker, and auto-completing them on load would change what a save loads to, which G3.7 forbids. A player who wants the new opening uses Reset, which now works (F16). |
| The quest tracker | Shows open quests of places the hero has discovered first (7.1 item 12). A save whose next unclaimed quest lies in an undiscovered place may see a different quest named than before. Nothing is lost or re-opened. |
| `xpMultiplier` 10 or 1 | Kept as saved (`save.ts` 35). A save without the field keeps today's default of 10, because the default state is unchanged. The button that changes it is no longer visible. A save that loads at 10x gets one chat line saying so; to change the rate the player types the word of 7.1 item 10. |
| Gear owned or worn | Kept. Its resale value is unchanged (`unitSellPrice` is not edited). |
| Gold owned | Kept. It buys a tenth of the equipment it bought before. |
| Bars, ore and logs in the bank | Kept. Bars become useful. Ore must now be smelted before forging. Logs make a third to a sixth as many bows above oak (3 to 6 logs each). |
| Smithing level 35 to 47 | Gilded armour moves to Smithing 46 and 48 and consumes a rune piece, so a player who could forge it from gold ore at 35 or 38 cannot until 46 or 48. This is the one capability Stage 3 takes back (critique M-4). |
| A Slayer task in progress | Its kill count is kept. If it is one of the five reduced bands, it pays the new bounty when it completes. |
| `xpMultiplier` 10 with today's progress | Levels keep coming ten times faster, but gear now costs ten times as much and rarely drops. For this player gear comes about twice as fast as at 1x, not ten times (4.3, last row). |
| A legacy save (`runewilds_save_v2`, `_v3`) with no inventory or equipment field | Gets today's 23-stack kit, as today. Unchanged on purpose: a returning player is not downgraded. |
| A corrupt main save | As today: backed up, then a new game. The new game is now the new start, with the starter chain. |
| Cheat codes | Still work when typed. They are no longer listed in chat or shown in Settings. |
| A new-game save loaded for the first time on its profile | The one-time outfit migration of `loadGameState` would empty a worn `leather_boots` slot (the Traveler Boots of quest 6) without returning the boots. It is skipped for a state that has claimed `arrival` (7.1 item 1). |
| A save written by a new game, loaded in the build before Stage 3 | Loads. The old build drops the starter ids from `claimed` as unknown (`save.ts` 88-89) and keeps everything else. |

Rollback: a save written after Stage 3 has the same fields and loads in the build before it; see the last row above for the one difference.

The one new path is the new game. `startNewGame()` runs only when `loadGameState()` returns `false`: no save, a corrupt save, or `applyState` threw (`session.ts` 37-86). The third case already ends in a fresh character two seconds later when the autosave runs; Stage 3 does not make it worse and does not fix it. It joins the save-flow items the Stage 1-2 design defers to Stage 6 (its section 9.1).

Tests with fixtures (plan tasks P1, N1):

- `tests/fixtures/s3/default-state.golden.json`: `serializeState(createDefaultState(), null, null)` without `savedAt`, captured before any Stage 3 change. Asserts the migration base never moves.
- `tests/fixtures/s3/save-v4-loaded.golden.json`: the Stage 1 fixture `tests/fixtures/save-v4.json` loaded and serialised again, captured before any Stage 3 change. Asserts a real version-4 save loads to the same state after the stage, value for value.
- `tests/fixtures/s3/save-v4-geared.json`: a version-4 save wearing rune, with dragon pieces and 500,000 GP in the bank and backpack, `xpMultiplier` 10. Asserts every piece, the gold and the multiplier survive.
- `tests/fixtures/s3/save-v4-no-multiplier.json`: the same without `xpMultiplier`. Asserts 10.
- `tests/fixtures/s3/save-legacy-bare.json`: `{ "gp": 77 }` under a legacy key. Asserts today's default inventory and equipment.
- `serializeState` of the new-game state has exactly the keys of the default state and `version` 4; it survives `writeSave` then `readSave`, with `claimed` equal to `['arrival']`.
- A new-game state part-way through the chain (`claimed` `['arrival', 'sq_ledger', 'sq_quarrel']`) survives `writeSave` then `readSave` with all three ids.
- For the default state, the Stage 1 fixture and the geared fixture: `starterView` is empty, the tracker names a quest of `QUEST_DEFS`, and `claimQuest` refuses every starter id and changes nothing.

---

## 9. Verification

### 9.1 Headless, in vitest

| Goal | Proof |
|---|---|
| G3.1 | `createNewGameState()`: ten equipment slots `null`, inventory empty, bank empty, `gp` 0, `xpMultiplier` 1, hitpoints 10, only the start shrine known, no quest flag set, `claimed` exactly `['arrival']`. `createDefaultState()` equals its golden. |
| G3.2 | `tests/pacing.test.ts` runs the model of `tests/support/pacingModel.ts` against the live tables and the functions of 7.6, and asserts the eight points of 5.3: the chain earns the bronze kit; gate before kit and kits in strict order; at least 25 further kills on A1 from iron to adamant and at least one on A3 from iron to mithril; never more than three tiers behind on A1; the control with today's prices, drops and bounties fails the further-kills assertion at every tier; the same floor holds at 10x from steel to rune; the forge routes need no coin. It prints the milestone table of 5.1 with average times. No assertion reads a time: the model returns times in a separate object that the test only prints, and the gate task greps for it. |
| G3.3 | `tests/economy-invariants.test.ts`: for every recipe, sale value of the output is at most 2.5 times the sale value of the direct inputs, with `fletch_shortbow` the only listed exception. For every item, `shopPrice` is at least `unitSellPrice` (no buy-and-sell profit) and equals `price` for runes, ammunition, food and potions. For every fishing spot, modelled GP per hour of cooked fish, at its requirement level and 21 levels above it, is at most 1.5 times the best rock or tree whose requirement is at most 10 levels higher (today trout, lobster and shark reach 2.0 to 2.6 times; after, 0.6). Every non-boss equipment drop chance is at most 0.02. From the new-game state with no gold, bronze platelegs and a platebody can be made from copper rocks that stand in the start region and outside every aggressive camp (no soft lock). |
| G3.4 | Every `smith_*` recipe's inputs are bars or, for gilded, a rune piece and gold bars; a state holding only ore cannot forge; a state with the bars can, and gets the same experience as today. Each smelt requirement is at most the lowest forging requirement of its metal. |
| G3.5 | `creditGp` clamps at `MAX_GP` and at 0 and ignores non-finite amounts. `sellItem` at the cap is refused and removes nothing. `registerKill`, `claimQuest` and the gold cheat at the cap leave `gp` at `MAX_GP`. `save.ts` and `inventory.ts` contain no literal `2147483647`. The stack cap in play is closed by the argument of 7.1 item 6 and has no test. |
| G3.6 | `unlocksAt('attack', 5)` contains the iron scimitar; `('mining', 10)` the iron rock; `('smithing', 9)` the iron platebody recipe; `('prayer', 30)` Protect from Melee; `('magic', 12)` Fire Bolt; a level with nothing returns an empty list; no entry is returned at two different levels of one skill. The line for the iron scimitar contains its shop price and "forge:" with the Smithing level; the line for the steel longsword, which has no recipe, contains the shop price alone. |
| G3.7 | The fixtures of section 8, including the cases that show an existing save has no open starter quest. |
| G3.8 | Before any data change: `playerAttackProfile`, `playerHitChance`, `monsterHitChance`, `rollDrops` and `gatherChance` return, for a table of cases, the values computed from today's expressions; `rollDrops` consumes random numbers in today's order (checked with a recorded sequence). Stage 2's `tests/monster-hit.test.ts` passes unchanged. A source scan finds no hit-chance, drop-roll or gather-chance arithmetic left in `src/engine/actions.ts`. The model run twice on the same tables returns equal counts. |
| G3.9 | `tests/content-freeze.test.ts`: the sets of monster type keys, node keys, recipe ids, prayer ids, spell ids and the ids of `QUEST_DEFS` equal the lists captured before the stage, and every `name` in those tables is unchanged. The item ids equal the captured list plus exactly `hazel_staff`. `STARTER_QUESTS` has exactly the seven ids of 7.1 item 9, with the names given there. |
| G3.10 | `tests/starter-quests.test.ts`: the table is exactly the seven entries of 7.1 item 9; each step reads the flag or value the design names; each quest is refused before its steps and before the previous quest is claimed, and pays exactly its reward once; `arrival` can never be claimed; at the end the hero wears the bronze scimitar, platebody and platelegs and owns the helm, shield, staff, runes and boots; the step that needs coin comes after the quest that pays coin; every reward fits a backpack that holds the earlier rewards. The existing-save cases of section 8. The whole chain played action by action with the game's own functions is assertion 1 of the pacing test (5.3); it goes green when smithing takes bars. |
| G3.11 | `tests/hidden-tools.test.ts`: `matchToolsCode` accepts the word with or without leading keys and nothing else; `matchCheat` still returns what the frozen test expects; in `index.html` the block `hidden-tools` carries the `hidden` attribute and contains the 10x button, the cheat input and the two cheat buttons, and nothing outside it mentions a cheat code or the 10x rate; `src/engine/runtime.ts` contains neither `skills10` nor `gold200k`. Revealing the block needs a browser (9.2). |
| G3.12 | `hazel_staff` exists with the row of 7.1 item 11; `weaponClass` is `magic`; `gearSilhouette` is `staff`; on a new-game state holding the staff and the runes of the fifth quest, `canUseStyle('magic', …)` is ok, and without runes it names them; `shopPrice` is 600 and `unitSellPrice` 39. |

### 9.2 Needs a human looking at the running game

- Reset from Settings on a profile that has a save: after the reload the hero is a new character, not the old one (F16).
- New game (reset, or a private window): the hero holds nothing; the purse shows 0; Settings shows no experience button and no cheat panel; the chat does not mention a cheat; the tracker shows "A Name in the Ledger"; the onboarding card and the first chat lines match 7.1 item 7.
- Play the starter chain to the end without cheats. Write down every place where the next step was unclear, and what the hero wears and carries at the end. As information only, note how long it took.
- In a private window: start a new game, play the chain in one sitting, wear the Traveler Boots, reload. The boots are still worn (7.1 item 1, outfit-migration fix).
- Keep playing to the iron kit. Write down the kills by monster and whether the kit was bought or forged. As information only, note the time. This is the only check of the model against a real player; nothing is expected in minutes.
- Type `backroom` during play: Settings now shows the experience button and the cheat panel; the button switches the rate; after a reload both are hidden again. Type `gold200k` and `skills10` without revealing anything: both still work.
- Load a save that runs at 10x: one chat line says so; the rate is unchanged; Settings shows no button.
- The shop shows the marked-up price on the card, on the buy button and in the tooltip; buying charges that amount; the sell price is unchanged; runes and arrows cost what they cost before.
- Fish at the three shrimp spots: each spot empties on the catch with a falling tone and leaves a still ring; it returns after about six seconds with a rising tone; working the three in rotation needs no waiting. Fish at a trout spot: the wait reads as a wait, not as a broken click. A catch clears the target (`actions.ts` 432-439), and a click on an empty spot prints "This Net Fishing Spot is depleted. Wait a moment for it to replenish." (`input.ts` 359-360) on every click; with one catch per click that line will be seen far more often than today. Count the clicks for ten shrimp and the "depleted" lines they printed. If the line reads as noise, silencing it for fishing spots is a one-line follow-up (F1 does not do it).
- Equip the Hazel Staff from the fifth quest: it shows as a staff in the hand, tinted unlike the Staff of Fire; Wind Strike casts and uses the runes; with no runes the game says which are missing.
- Smelt copper, forge bronze platelegs and a platebody, equip them. Try to forge with ore only: refused with the bar named.
- Gain a level in Attack to 5: the chat names the iron scimitar with its shop price and its forge recipe.
- Load a save from before the stage (the owner's own): position, gear, bank, gold, multiplier and quests are as they were, and no starter quest appears.

### 9.3 Checked by reading, because nothing was run

Existing tests that the changes could touch, and why each stays green: `bulk-buy` and `shop-gathered` buy only runes and arrows, which are not marked up; `bulk-sell` asserts through `unitSellPrice`, which is not edited; `phase2` asserts quest GP and the goblin bounty, which are not edited (no test asserts another band's bounty), and smelts bronze (requirement 1, one copper ore, unchanged); `phase1` fletches the oak shortbow from one log (unchanged) and burns a log; `phase3-content` and `rule-fixes` cook shrimp and fletch arrows (unchanged); `cheats`, `phase4-combat`, `save-hardening` and `rule-fixes` start from `createDefaultState()`, which is unchanged; Stage 2's `save-relocation` asserts the saved keys, which are unchanged. No test reads a drop table, a respawn time or a `smith_*` recipe.

Added by the owner's decisions:

- `phase3-content` pins `QUEST_DEFS` to ten ids and `questView` to length 10 (17-21). Both stay true because the starter quests are a separate table and `questView` is not edited.
- `phase3-content`, case `tracks the earliest open step, then a claim prompt, then the next quest` (30-42): its first four assertions stay true, because its state is the default state, which has not claimed `arrival`, so no starter quest is open. Its last assertion, line 41, `expect(adventureTracker(state).title).toBe('Varrock Arcane Trial');`, becomes false: the next quest is now "Cook's Errand". That one line is the declared replacement (7.1 item 12).
- `cheats` (55-70) pins what `matchCheat` returns for its aliases and for `hello` and the empty string. `matchCheat` is not edited; the reveal word is matched by a separate function.
- `save-hardening` (130-131) expects an unknown claimed id to be dropped. It still is: only the seven starter ids join the valid set.
- `combat-class` (313-342) walks every item and expects equipment to have a combat class; the Hazel Staff has `style: 'magic'`. Its lists of named items do not need the new id.
- `globals` requires every `onclick` in `index.html` to be a window global. No handler is added or removed; the hidden buttons keep theirs.
- `source-limits` allows no file under `src` above 1,000 lines. The largest files this stage grows are `adventure.ts` (594 lines today, about 110 more for the starter table and its three functions), `loop.ts` (716), `stations.ts` (636) and `catalog.ts` (499). None comes near the limit.
- `architecture` imports every module in node and forbids files under `src/state` and `src/data` to import the engine, the interface or three.js, **or to contain the words `document` or `window` anywhere, comments and strings included**. The new state code (`unlocks.ts`, `economy.ts`, the starter table, `matchToolsCode`) imports only data and state. The quest texts of 7.1 item 9 and the comment on the reveal word were written without either word, and the plan tells the implementer why.

The plan's gate task confirms all of this by running the suite.

---

## 10. Ledger: items deferred to Stage 3

| Item | Source | Decision | How |
|---|---|---|---|
| Audit finding 9: smelted bars cannot be used for anything, and smelting gold or runite loses money | `docs/audit/2026-11-13-findings.json`, Stage 1-2 design section 9 | **Fixed in Stage 3** | 7.1 item 5. Every forging recipe takes bars. Gold bars feed gilded armour. A runite bar sells for 507 against 403 for the ore, and five of them make a platebody that sells for 3,380. |
| The gp and stack cap is applied only on load | Stage 1-2 design section 9.1 | **Fixed in Stage 3** (gold); **closed by argument** (stacks) | 7.1 item 6. Gold is capped at every gain. A stack cannot reach the cap in play once gold is capped, and the load clamp stays. |
| "Reset" writes the old character back during the reload (F16) | Found by the Stage 3 critique | **Fixed in Stage 3** | 7.1 item 1, reset guard. |
| Audit finding 6 (shop arbitrage), second half: "reprice crafted outputs" | Stage 1-2 design 5.6, CALL-2 | **Closed in Stage 3** | The shop block from Stage 1 stays; the 2.5 rule of G3.3 bounds what crafting can earn from gathered inputs, which the block did not cover. |
| The tracker sends a new character to an aggressive camp (F17) | Stage 3 critique H-2 | **Fixed in Stage 3** | 7.1 item 12, with one declared test replacement authorised by the owner. |
| Cheat codes advertised to every player (F18) | Stage 3 critique M-6 | **Fixed in Stage 3** | 7.1 item 10. |
| Magic closed for the first half hour (F19) | Stage 3 critique M-7 | **Fixed in Stage 3** | 7.1 item 11. |

Deferred again, in writing:

| Item | To | Reason |
|---|---|---|
| F9: regeneration, free altar heal, death without loss | Stage 4 | 7.2. |
| F12: the level 28 to 45 to 68 gap | Stage 6 | 7.5. Needs a creature type or a new use of an existing model, which is content. |
| F13, second half: the dragon returns in 8.35 s | Stage 4 | Boss phases and boss respawn are designed together there. |
| F14: no recipes for steel, black, adamant, dragon | Stage 6 | New recipes need new inputs (a second ore), which would be new, named content. |
| Quest givers, dialogue and "talk to" steps for the starter chain | Stage 6 | 6.2, 7.1 item 9. Stage 6 owns quests with characters and dialogue as a system. The chain uses only what the quest system does today. |
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
| Quest claims | A click on Claim in the Adventure Log, with a quest id | The player; the id is checked against the two quest tables | `claimQuest`: coins, experience, items, `quests.claimed` |
| Typed keys | The keyboard during play | The player | The cheat buffer (`noteCheatKey`): two cheats and the reveal of the hidden tools |

Trust boundary: the `localStorage` read, unchanged. Cheating is not a boundary: the player owns the only copy of the state and the game ships cheat codes. Stage 3 adds no parsed input.

### 11.2 What can go wrong?

| # | Failure |
|---|---|
| R1 | The new-game state is applied over a loaded save, or `createDefaultState()` is edited "to match", and an existing player loses gear or gets a different fallback. |
| R2 | An existing player's progress is devalued without notice: shop gear costs ten times more. |
| R3 | A number overflows: gold or a stack passes 2^31 or becomes non-finite during play. |
| R4 | A crafting or trading loop prints money (a recipe added later, or a markup applied to the sell side by mistake). |
| R5 | A soft lock: a new character with no coin cannot reach bronze, or a player who sold their weapon cannot afford another. |
| R6 | The formula moves change behaviour: a different hit chance, a different order of random draws, a different drop. |
| R7 | The model drifts from the game, or the assertions pass only because the model is wrong. |
| R8 | Stage 2's final world (camp sizes, node counts, the gate) differs from what the model assumed, and an assertion of 5.3 fails after the merge. |
| R9 | A cap refuses something the player cannot understand, or silently destroys items. |
| R10 | The level-up unlock line prints a wall of text (Attack 1, Defence 1 and level 70 to 75 each match many items), or prints save-derived text as HTML. |
| R11 | A hostile save sets `gp` or a stack to the cap to probe the new arithmetic. |
| R12 | A name or item taken from another game is added with the new quests or the staff, or more content slips in beside them. |
| R13 | A player resets to try the new start and gets the old character back (F16). |
| R14 | The pacing test fails only at the end of the stage, because the "after" rows were never measured before the data changed (critique C-1). |
| R15 | An existing save is handed the starter rewards, or its tracker fills with six trivial quests, or a save edited to hold `arrival` claims them. |
| R16 | The starter chain soft-locks: a step needs coin, a level or an item the hero cannot have yet, or a reward does not fit the backpack. |
| R17 | A starter quest claimed in a new game is open again after a reload, because its id is filtered out on load. |
| R18 | The hidden tools leak (a chat line, a placeholder, the README) or become unreachable (an element is removed and `el()` throws at boot). |
| R19 | A milestone bound is fitted to the model again, in kills this time. |
| R20 | Old code that assumes every save was made with the old starter kit acts on a new-game save (the one-time outfit migration in `loadGameState` empties a worn `leather_boots`). |

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
| R8 | Mitigate: the plan's first task rebases on the merged Stage 2 and the tuning task re-runs the model. The knobs, if an assertion of 5.3 fails, are `GEAR_MARKUP` between 8 and 12, then the gear drop chances by one common factor; for the fishing bound only, the four fishing respawn times between 2 and 10 s. No formula is touched and no threshold is moved. The forge route, the starter chain and the 2.5 rule have no knob: if they fail, or no value in those ranges works, the stage stops and returns to the owner. |
| R9 | Mitigate: a sale at the cap is refused with a plain message and changes nothing; only gold that arrives without a player action (loot, reward, bounty) is clamped. Stack additions are not refused. |
| R10 | Mitigate: at most three names and a count per line; level 1 prints nothing (nothing is "gained" at level 1). Every name comes from the compiled tables, never from the save. |
| R11 | Already mitigated on load by Stage 1; the play-time caps mean the next gain cannot pass it. A test starts from a state at the cap. |
| R12 | Mitigate: the additions are listed by id and name in this document (C4, 7.1 items 9 and 11) and in the content-freeze test, which fails on any other new id or name. The names were chosen to describe what the player does and to avoid both source games; the owner reads the list before approving (section 15.1). |
| R13 | Mitigate: the reset guard (7.1 item 1) and a human check (9.2). |
| R14 | Mitigate: plan M1 runs the A1 and A3 rows with the design's parameters injected, before any data task, and stops if an assertion fails. The purchase and Slayer rules are written in 4.2, so two implementations agree on what to compute. |
| R15 | Mitigate: the chain is open only to a state that has claimed `arrival`, which only `createNewGameState()` sets; `claimQuest` refuses a starter quest whose predecessor is not claimed. Tests run the default state and two version-4 fixtures. Accept the remainder: a player who edits a save to add `arrival` receives a bronze kit, which is worth less than the gold cheat. |
| R16 | Mitigate: the chain's order is fixed (weapon before the fight, coin before the purchase, five smelts before the platebody, runes with the staff), the start town is passive (Stage 2), every step is something a state at that point can do with no gold, and one test walks the whole chain with the game's own functions. Steps are things that stay true once done, so a step never un-ticks. |
| R17 | Mitigate: the one-line change to the valid id set (section 8) and a round-trip test with a half-finished chain. |
| R18 | Mitigate: the elements stay in the page inside one hidden block; nothing is removed. A test reads `index.html` and `runtime.ts` for leaks. Accept: no access from a touch screen, and the word is recorded in this document and in a code comment only. |
| R20 | Mitigate: the migration is skipped for a state that has claimed `arrival` (7.1 item 1); a human check reloads after wearing the boots (9.2). `loadGameState` has no other branch that reads the kit. |
| R19 | Mitigate: 5.4. The thresholds are round, far from the measured values across the whole tuning range, and the control must fail. The owner confirms them (Q3.10). |

### 11.4 Did we do a good enough job?

By the proofs of section 9. In particular: for saves, the two goldens and three fixtures; for the economy, the invariants that run over whole tables instead of over examples; for the curve, the pacing test, which asserts work and order and must fail on today's economy (5.3, 5.4); for the opening, one test that walks the starter chain with the game's own functions; for the hidden tools, a scan of the page and the boot code. If the pacing test cannot be made to pass on the merged Stage 2 world inside the knob range of R8, the design is wrong at that point and the stage stops there.

---

## 12. CALLs: what is decided and what is still a proposal

"Decided" means the owner answered on 2026-11-14; section 15.1 has the owner's words. "Proposal" means the owner has not spoken to it and the lead's recommendation stands until O-13.

| # | Proposal, as it now stands | Status | Where |
|---|---|---|---|
| CALL-3.1 | The essence list is the Stage 1-2 one. Stage 3 edits no formula, no existing price or requirement, no coin drop, no existing quest's reward and no XP value. | Proposal: accept. | 1 |
| CALL-3.2 | The curve is stated as milestones in tasks (5.1) and proven by the eight assertions of 5.3, in counts and order. No time is asserted; average times are printed (5.5). | **Decided**: milestones tied to tasks, an average may be shown. The two thresholds inside the assertions are Q3.10. | 5 |
| CALL-3.3 | A new game starts with nothing in hand. Six start-town quests pay the first kit. | **Decided**: "quests to earn it". Replaces the earlier proposal of a scimitar, three meals and 25 GP handed out. | 6.2, 7.1 items 1 and 9 |
| CALL-3.4 | New games start at 1x experience. The 10x option exists and is hidden. Existing saves keep their rate. | **Decided**: accepted, "but the boosters must stay hidden". | 6.3, 7.1 item 10 |
| CALL-3.5 | The shop sells equipment at 10 times list price. It still buys at 65% of list. Runes, ammunition, food and potions are not marked up. Existing players keep their gear and gold; their gold buys a tenth of the equipment it bought before. A fighter who only shops runs one to two tiers behind its level in the middle of the game. | **Decided**: accepted, with the critique's condition that the forge recipe is shown beside the shop price when a piece becomes wearable (7.1 item 7). | 6.1, 7.1 |
| CALL-3.6 | Gear drops become rare: about one kill in a hundred per piece instead of one in five; the dragon one in twenty per piece instead of one in three. | Proposal: accept. Drops stay a lucky break; selling them stops being 71% of income. | 7.1 |
| CALL-3.7 | Fishing spots empty after each catch and return in 3 to 8 seconds, with a sound and a visible mark for both moments. | **Decided**: option (a), "fishing is fishing". | 7.1 item 4 |
| CALL-3.8 | Smithing takes bars (audit finding 9). Mithril and rune pieces take one to two more bars; gilded armour is made from the rune piece plus gold bars at Smithing 46 and 48; bows above oak take 3 to 6 logs. Rule: nothing sells for more than 2.5 times its inputs. Existing players at Smithing 35 to 47 lose gilded armour from gold ore until 46 or 48, and banked logs make fewer bows (section 8). | Proposal: accept. | 7.1 |
| CALL-3.9 | The shop keeps selling every item everywhere. No stock by place, level or shrine. | Proposal: accept. The price now does that job. | 6.1 |
| CALL-3.10 | Regeneration, the altar's free heal and death without loss are not changed in Stage 3. | Proposal: accept, as a written deferral to Stage 4. | 7.2 |
| CALL-3.11 | Gold is capped in play at 2,147,483,647: loot and rewards stop at the cap; a sale that would pass it is refused. Stacks keep their cap on load only. | **Decided**: removing the in-play stack cap from the plan is accepted; the gold cap stays. | 7.1 item 6 |
| CALL-3.12 | The chat says what a level unlocks, with shop price and forge recipe for equipment; the onboarding card and first messages describe the new start. | Proposal: accept. The forge recipe in the line is the owner's condition on CALL-3.5. | 7.1 item 7 |
| CALL-3.13 | Requirements of the strongest low-requirement items (Fury, Berserker Ring, Fire Cape, Staff of Fire) are left alone; price gates them. | Proposal: accept. | 7.4 |
| CALL-3.14 | Five Slayer bounties are divided by 3 (scorpion 300, dark wizard 400, hill giant 600, moss guardian 1,100, lesser demon 1,800); the goblin bounty, coin drops and existing quest rewards are unchanged. | **Decided**: accepted, together with CALL-3.5. | 7.1, 7.3 |
| CALL-3.15 | What is left out: a monster band between level 28 and 45, recipes for steel, black, adamant and dragon, ranged and magic ladders, food that matters, quest givers and dialogue. | Proposal: accept as dependencies on Stages 4 and 6. | 7.5, 10 |
| CALL-3.16 | Stage 3 scope as a whole: twelve changes (new-game state, shop markup, drop rates, fishing depletion with cues, bars and the 2.5 rule, caps, unlock messages, five bounties, the starter chain, the hidden tools, the Hazel Staff, the tracker order), the model committed as a test, no save format change. | Proposal: accept. Four of the twelve are the owner's own additions. | 3, 7 |
| CALL-3.17 | The tracker shows quests of discovered places first, and one frozen assertion is replaced. | **Decided**: accepted. | 7.1 item 12 |
| CALL-3.18 | An entry-level staff, the Hazel Staff, paid by the fifth starter quest and sold by the store. | **Decided**: "let's create an entry-level staff". | 7.1 item 11 |
| CALL-3.19 | The cheat codes are hidden the same way as the 10x option. | **Decided**: "same as the boosters, keep them hidden". | 7.1 item 10 |
| CALL-3.20 | An existing save is not shown the starter chain. | Lead's decision, as the owner asked for one ("decide what happens for an existing save"). The owner can overrule it at O-13; the alternative is in section 8. | 8 |

---

## 13. Risks

| Risk | Likelihood | What happens | Answer |
|---|---|---|---|
| The model is wrong about real players. | Medium | The first hour feels too slow or too fast although the test passes. | The play checks of 9.2 record what a person actually did. The test asserts work, so a wrong time model cannot break it; one constant (the markup) moves the feel. |
| Stage 2's final camps differ from its design table. | Medium | An assertion of 5.3 fails after the merge. | Plan tasks P0 and T1; knob range in R8. The counts did not move when the camp sizes were changed from 5 / 3 / 2 / 4 / 4 / 4 to 3 / 3 / 2 / 4 / 2 / 2. |
| A frozen test fails although reading says it should not. | Low | A change has to be reshaped. | The gate task runs the suite before anything is called done; section 9.3 lists the reasoning to check against. |
| Existing players dislike the price change. | Medium | Complaint, not breakage. | Disclosed in CALL-3.5 and the README; owned gear and gold untouched. |
| The 2.5 rule blocks a recipe Stage 6 wants. | Low | A test fails on purpose. | The rule is one number in one test; the exception list names its reasons. |
| Moving formulas out of `actions.ts` conflicts with late Stage 2 edits. | Medium | Rebase work. | Stage 3 starts only after the Stage 2 merge; the moves are the first code tasks. |
| Fishing feels worse (one click per fish). | Medium | Feel, judged by eye and ear. | The owner chose it. The cues of 7.1 item 4 and the human check of 9.2. |
| The pacing assertions fail on the committed model. | Low to medium | The stage stops at M1's dry run. | The bounds are in kills, and 6.1 lists the closest value to each across the tuning range: three times the floor on A1 at 1x, one tier of room, four times the floor at 10x from steel. The committed model is a third implementation and may still differ. The earlier risk, minute windows with a few minutes of slack, is gone with the windows. |
| The starter chain reads as a checklist, not an opening. | Medium | The first twenty minutes work but feel dry: no people, no speech. | Accepted for Stage 3. Stage 6 gives the chain characters and dialogue. |
| A new player never finds the Adventure Log and never claims the first reward. | Medium | The hero stays bare-handed. | The tracker under the health bar shows the step and then "Claim the reward in the Adventure Log"; the onboarding card and the first chat line say the same; the first step is a conversation that opens the log. Human check. |

---

## 14. What could not be verified

- No test, type check or build was run. Every statement about a test staying green comes from reading it (9.3).
- The numbers come from scripts with formulas copied from `actions.ts` at `a8cad85`. The first author's script (the "today" rows, 4.4, 4.5, 6.1) is not committed. The task counts and the "after" rows come from the critique's committed model and its committed extension (`docs/superpowers/research/pacing-model/`, `b68e2d2`). The second pass reproduced every kill count with a TypeScript model that imports the game's tables and functions, but it implements the same text of 4.2, so it checks the arithmetic and the transcription, not the rules themselves. Plan M1 commits the model against the game's functions.
- The Slayer route (A3) was implemented by the lead for this revision, from the rule in 4.2, and a second time by the second pass, from the same text, with identical counts. Both read the same rule, so a misreading shared by both would not show. Less is asserted on A3 than on A1 for that reason. The A3 floor does discriminate: with today's drops and bounties and the tenfold price, the second-pass model gives 0 further kills at iron, steel and adamant.
- The floor of 25 further kills and the bound of three tiers were chosen after seeing the counts (5.4). They are far from the measured values, and the control fails them, but they are the lead's numbers until the owner confirms them (Q3.10).
- The forge route's task counts in 5.1 are a rough hand calculation, not the model. The skilling minutes of the forge route in 4.5 and 7.1 item 5 are the first script's and were not re-measured.
- Average times: the 90 s per starter quest, the 40 s per purchase, the 30 s per change of monster and the walk to the Slayer master are assumptions. So is the factor of about two for a real player. None of them is asserted any more.
- Stage 2's final world: camp membership and coordinates (task W5), the gate simulation (A7), the two new pond fishing spots, and whether the model's "all camp members attack at once" matches the aggro radius in practice. The counts did not move between the camp table of the Stage 1-2 design and the camps on `feat/world-place` today.
- The site rule for gathering (nodes within 15 units) is the model's own; no game rule defines a site. Stage 2 moves the yew and magic trees and the river fishing spots, so the gathering numbers and the fishing rhythm of 7.1 item 4 will shift.
- Ranged and magic through the tiers (4.7), and the effect of amulets, rings, capes, prayers and special attacks on the melee counts. The Hazel Staff is compared at level 1 against one monster and no further. That it does not disturb the milestones is an argument from rune cost, not a measurement.
- How the Hazel Staff looks. That it uses the `Gear_staff` node and takes its two colours was read from `playerGear.ts` and `blenderGear.ts`. The model file was not opened and nothing was rendered. The two colour values are a first choice for a person to judge.
- How the starter chain plays. Its steps were checked against the code that sets each flag, by reading. Whether a new player finds the Adventure Log, whether six quests take ten to twenty minutes, and whether the texts read well were not tested.
- That the names of the six quests and of the staff are free of both source games rests on the lead's knowledge, not on a search.
- The fishing cues (two tones, a still ring) are specified and were not heard or seen. That one click per fish reads well with them is the human check of 9.2.
- The reveal of the hidden tools needs a browser and a keyboard. That typing the word while moving does not misfire, and that nothing else in the interface names the cheats or the rate, was checked by searching the source for the code strings, not by playing.
- The reset defect (F16) was found by reading; that the browser fires `beforeunload` on `location.reload()` is standard behaviour, not observed here.

---

## 15. Owner decisions

### 15.1 Decided on 2026-11-14

The owner's words are translated. Each row says what the decision changed in this document.

| Question | Decision, in the owner's words | What it means here |
|---|---|---|
| Q3.5: what the pacing test asserts | Milestones, "but not tied to minutes, tied to tasks. We can have an average, but it cannot be the standard." | No assertion in minutes anywhere. Milestones are tasks counted in actions (5.1); the test asserts counts and order (5.3); average times are printed (5.5). The test still runs before any data change, and today's economy must fail it. |
| Q3.7: how fishing spots run out | Option (a). The spot empties on every catch: "fishing is fishing". | 7.1 item 4 as first designed, plus cues for the empty and the returning spot. Respawns: shrimp 6 s, trout 3 s, lobster 7 s, shark 8 s. The alternative with a 35% chance is dropped. |
| Q3.1: the tenfold shop price and the bounties cut to a third | Accepted, with the critique's condition. | CALL-3.5 and CALL-3.14 stand. When a piece becomes wearable the unlock line shows the forge recipe beside the shop price (7.1 item 7). |
| Q3.6: the quest tracker | Accepted. | Quests in discovered places come first. One frozen assertion is replaced: `tests/phase3-content.test.ts` line 41 (7.1 item 12). |
| Q3.3: the starting kit | "Quests to earn it." | The hero starts with nothing. Six start-town quests pay the first kit (7.1 item 9). |
| Q3.2 and CALL-3.4: the 10x option | New games at 1x: accepted, "but the boosters must stay hidden". | The button leaves the normal interface and is reached by a typed word (7.1 item 10). |
| Q3.8: the cheat codes | "Same as the boosters, keep them hidden." | Not announced in chat, not visible in Settings, reached the same way (7.1 item 10). |
| Q3.9: magic at the start | "Let's create an entry-level staff." | The Hazel Staff, paid by the fifth starter quest (7.1 item 11). No new model. |
| Q3.4: five to eight model-hours to dragon gear | Accepted, as information and not as an assertion. | Printed in 5.5. Nothing asserts it. |
| CALL-3.11: no stack cap in play | Accepted; the gold cap stays. | 7.1 item 6 as written. |

### 15.2 New decisions that came out of the answers

Kept to two. Everything else in this revision follows from 15.1 or is the lead's to decide.

- **Q3.10. The two numbers inside the task assertions.** The owner chose tasks over minutes. Two of the eight assertions still need a number: "the kit takes at least 25 further kills after the level" (shop-only fighter, iron to adamant) and "the fighter is never more than three tiers behind". The measured values are 93 to 391 further kills and one to two tiers; today's economy gives zero further kills. **Recommendation: accept both.** They are deliberately loose: they exist to catch an economy that has gone wrong in either direction, not to pin the feel. The feel is the printed table and the play check. If the owner would rather have no number at all, assertion 4 can go and assertion 3 can become "at least one further kill"; the control still fails it.
- **Q3.11. What a save that runs at 10x is told.** "The boosters must stay hidden" could be read to forbid any sign of the booster. An existing save keeps its 10x rate, and with the button hidden its player would see experience numbers ten times larger with no explanation and no visible way to change them. **Recommendation: one chat line on load, only for such a save, "This character earns experience at 10x."** It names the state and not the way to change it. The alternative is silence.

For the owner to know, with no decision needed unless they disagree:

- An existing save is not shown the starter chain (CALL-3.20, section 8).
- The word that reveals the hidden tools is `backroom`. It is written in this document and in a code comment, and nowhere in the game or the README.
- The typed cheat codes keep working without the word, as they do today. They were already invisible; only the chat line and the Settings panel advertised them.
- A fighter who never forges and never takes bounties wears each kit one to two tiers after its level allows it (5.2). That is the cost of the tenfold price the owner accepted, and the unlock line is what points such a player at the anvil.
- The chain has no people in it. Stage 6 owns quest givers and dialogue.
