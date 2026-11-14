# Content and systems: design

> **Owner note, 2026-11-14 (after this revision was requested):** asked whether dungeons need protection against bad luck, the owner answered: "não, masmorras não precisam dessa proteção contra azar. Chance de drop de item é chance de drop de item." So CALL-6.25 is decided on that point: **no pity counter and no saved luck state, ever.** The drop tables stay as chances. The one Kilnglass that every Underkiln clear gives for certain is ordinary base loot, not a protection mechanism; whether to keep it certain is still the owner's to confirm with the drop chances.

Date: 2026-11-14. Branch: `feat/content-systems`, cut from `main` at `5caa597` (Stages 1 and 2 merged). All line numbers refer to that commit. Stages 3, 4 and 5 are approved and land before this stage; their code is not in this tree, so every task in the plan finds symbols by name and the plan opens with a premise re-check (task R0).

Status: proposal, critiqued (`2026-11-14-content-systems-critique.md`, READY-WITH-FIXES; its fixes are applied below and marked "critique"), and **revised on 2026-11-14 for the owner's answers** to its main decisions. Four answers changed the design: arrows (7.4), a real rebalance of the three styles (7.12), aggressive and passive monsters in place of Stage 2's level rule (7.13), and dungeon rewards as drops with quest rewards paid once (7.3, 7.6). Section 15 quotes each answer and lists what is still open; the review log at the end lists what this revision moved. A decision marked **CALL-6.n** that section 15 does not show as decided is still the lead's proposal.

Inputs read for this document: `docs/superpowers/specs/2026-11-13-world-foundation-design.md` ("the foundation design") and its plan; the approved designs of Stage 3 ("Start and pacing"), Stage 4 ("Combat with weight") and Stage 5 ("Visual pass"), as reference copies; the Stage 3 plan and code as they stand on `origin/feat/start-pacing` at `ffa87cb` (read with `git show`); the Stage 4 combat model on `feat/combat-weight` at `732cb8c`; `docs/audit/2026-11-13-findings.json`; `src/state/*.ts`, `src/data/*.ts`, `src/engine/actions.ts`, `loop.ts`, `session.ts`, `spawns.ts`, `worldBuild.ts`, `input.ts`, `overlay.ts`, `renderer.ts`, `src/ui/stations.ts`, `hud.ts`, `index.html`, `tests/names.test.ts`.

This document covers one stage:

- **Stage 6: Content and systems.** The owner's sentence: "quests with characters and dialogue, new skills that close loops, dungeons, more bosses, an achievement diary."

It is built as a small foundation and eight slices that each ship alone (section 14). The stage lands after Stages 3, 4 and 5 are merged.

**How the numbers were produced.** One set of scripts, `docs/superpowers/research/content-model/`, all run by `run.sh`, with the output committed beside them:

- `content.ts` holds the whole proposal as data: items, nodes, recipes, monsters, drops, camps, people, dungeons, chests, bosses, quests. It also holds, as named constants, the Stage 3 and Stage 4 numbers this tree does not have yet (the tenfold shop price, the gear drop cut, bars in recipes, the two Stage 4 monsters, Ashmantle's arena).
- `model.ts` (`results.txt`) imports the game's real tables and pure functions (`ITEMS`, `unitSellPrice`, `FORGE_RECIPES`, `MONSTER_TYPES`, `RESOURCE_NODES_DEF`, `SPELLS`, `CAMPS`, `PATHS`, `SAFE_ZONES`, `NODE_PLACEMENTS`, `OSRS_XP_TABLE`, `isWalkable`, `getTerrainHeight`, `getEquipmentBonuses`, `serializeState`) through the repository's own esbuild and checks the proposal against them. It ends with `ALL CHECKS PASS` in the committed run and exits non-zero otherwise.
- `check.ts` (`check-results.txt`) runs the three new bosses, and Stage 4's Ashmantle with its own rows, through Stage 4's positional fight model, 2,000 seeded fights per row, each row twice: with today's attack formula and with the rebalance of 7.12. `fight.ts` and `boss.ts` are copies from the Stage 4 branch; the header of `fight.ts` states the three marked differences.
- `aggro.ts` is the aggression rule of 7.13 as the pure function the game will get. `aggro-check.ts` (`aggro-results.txt`) checks it, patches it into a copy of Stage 2's `stepMonster` (nothing under `src/` is edited) and reruns Stage 2's gate simulation before and after.
- `pacing-rerun.sh` (`pacing-results.txt`) takes Stage 3's `tests/pacing.test.ts` and its model from `origin/main` (Stage 3 merged; the first revision read `origin/feat/start-pacing` at `9ccbdae`, whose files are identical), bundles the test unedited with a stand-in for vitest (`vitest-stub.ts`), and runs it against the model as committed and with the new aggression rule. It is the model that is run, not the test suite.

The player's attack arithmetic in both scripts is transcribed by hand from `performPlayerAttack` (`actions.ts` 83-264), as Stage 4's model does. No test suite, type check, build or dev server was run. Section 17 lists what could not be verified.

---

## 1. Intent and why

After Stages 1 to 5 the game has a world that is a place, an earned first kit, fights that ask for answers, and a look. It still has no reason to go anywhere except the next number. Measured on the code as it is:

- **Quests are ten checklists with no one in them.** A quest is a list of predicates over flags (`adventure.ts` 33-36, 57-212) claimed from a window; nobody gives it and nobody is spoken to. Talking to a person prints one chat line and leaves no trace in the state (`loop.ts` 216-220). Stage 3 adds six start-town quests on the same system and names "quest givers, dialogue and talk-to steps" as owed by this stage.
- **Two of the three ways to fight have no craft behind them.** Of 211 pieces of equipment, 19 have a recipe, all melee or bows (`results.txt` section 1). Every rune, every potion, every piece of ranged or magic armour comes from the shop or a drop. 24 non-equipment items have no source or no use: all nine runes, both potions, five foods, feathers, bolts, ashes, and (until Stage 3) all five bars.
- **Steel, black, adamant and dragon gear cannot be made** (Stage 3 finding F14).
- **Between level 45 and 68 there is nothing to fight, and after the dragon there is nothing to do.** Stage 4 fills 34 and 38 and builds one phased boss. Its other five slots are prepared and empty.
- **Nothing remembers what the player did.** There is no count of kills, of things made, of places cleared: so nothing can reward breadth.

Stage 6 is one system, not five features. The spine is a **main quest line** that walks the player through the five regions in level order. Each chapter introduces one person, and that person teaches one system the stage adds: a smithing tier, leatherwork, runebinding, the first dungeon, the pass, the second dungeon, the boss. Side quests and the **diary** then pay the player for touching everything. The two **new skills** exist to give ranged and magic what smithing gives melee. The **dungeons** exist to hold the materials those skills need at the top, and the bosses that guard them.

### What the player does in hour 3, hour 10 and hour 30

Hours are a real player's, taken as about twice the Stage 3 model's (its section 5.5) and extended past dragon gear by `results.txt` section 11. They are information and nothing asserts them.

| | Where the player is | What they are doing | What pulls them forward |
|---|---|---|---|
| **Hour 3** | Attack and Defence in the high 30s, adamant worn, combat about 45. Chapters 1 and 2 done. | Killing hill giants for coin and Tough Hide; smelting steel and adamant for the forge; in the dunes with Qadir Salt-Hand, learning leatherwork. Marrowjaw the Tollmaster is the first boss they can beat. | Chapter 3 points at a door in the dunes: Saltfang Warren. Rune gear is one tier up. The diary's easy tiers are nearly done in two regions. |
| **Hour 10** | Level 58 to 60, rune worn, combat about 72. Chapters 1 to 4 done, the Warren cleared several times. | Binding their own runes with Hesper Moth; farming Mossed Hide and Mire Root from the guardians; brewing prayer vials for the pass. | Chapter 5: the pass, with a vow taken. Dragon gear needs Kilnglass, which only the Underkiln holds. Medium diary tiers pay embers and put a deposit box at a region's shrine. |
| **Hour 30** | About level 72, dragon worn or half forged. Chapters 1 to 6 done. | Running the Underkiln for Kilnglass and Cinder Silk; forging wyrmsteel; fighting Ashmantle for the last chapter. | "Ashfall", the title Wardkeeper, the hard diary tiers (a bank at every shrine), levels 70 to 99 in ten skills. |

### Essence to preserve (CALL-6.1)

Unchanged from the earlier stages: progression by skills on the existing XP curve (`OSRS_XP_TABLE`, `skills.ts` 6-14), click-to-act, the 28-slot backpack, bank, shops, forge, the faceted painted look, and control never taken from the player. Existing saves under `gielinor_hero_save_v1` (version 4) keep loading and lose nothing.

Stage 6 changes no XP value of an existing action, no price, requirement or stat of an existing item, no existing recipe, no existing quest's steps or reward, and no monster stat that exists when it starts. It adds content, two skills and one saved block. And, by the owner's decisions of 2026-11-14, it changes two rules that earlier stages left alone, each in a slice of its own with its own tests and declared test replacements: **three style numbers of the attack formula and the rune counts of two spells** (7.12: ranged and magic stop being twice as fast as melee), and **the aggression rule** (7.13: aggressive and passive monsters, replacing Stage 2's level rule for the whole game). Arrows take nothing back: any bow shoots any arrow (7.4).

---

## 2. Constraints

| # | Constraint | Consequence |
|---|---|---|
| C1 | The XP curve and every existing XP value stay. | New skills are placed on the curve by choosing XP per action; `results.txt` section 4 gives the actions to every unlock. |
| C2 | Stage 3's economy holds: its pacing test (kill counts and their order), the rule that no recipe's output sells for more than 2.5 times its inputs, the gear-drop caps (0.02, bosses 0.05), fishing at most 1.5 times the best rock or tree. | Every new recipe is checked against 2.5 (worst case 2.50). No new monster drops equipment. New material drops add at most 25% to a monster's coins. Dungeon camps are not in `CAMPS`, so the pacing model never sees them (7.6). R0 and every slice gate re-run the pacing test. |
| C3 | No new model. `monsters.glb`, `world.glb`, `hero.glb`, `gear.glb` are as they are; the models pass is a later stage. | Every new monster is a row with Stage 4's `model`, `tint` and `modelScale`. Every person is the existing humanoid rig with a tunic colour (`createMerchantNPC`, `worldBuild.ts` 505-533). Dungeons are built from boxes, the painted tiles and existing `world.glb` nodes. Section 7.5 records the model each one should get. |
| C4 | Names: sharing generic words with other games is fine (owner, 2026-11-14); copying a specific game's characters, quests, maps or look is not. Existing borrowed names stay. The Stage 2 deny-list test stays enforced for new names. | 82 new names, none with a deny-listed token (`results.txt` section 9). Recipes are named after the existing items they make. A person searches each name before merge, as in Stages 2 and 4. |
| C5 | Saves: key `gielinor_hero_save_v1`, `version: 4`. A new saved field is allowed; the save must stay version-compatible. | One optional top-level block, `progress`, absent until used, plus two skill keys. `version` stays 4. Section 9 gives defaults, reader rules, bounds, fixtures and what an older build drops. |
| C6 | Existing tests are frozen. Tests pin: `QUEST_DEFS` at ten ids (`tests/phase3-content.test.ts`), Stage 3's `STARTER_QUESTS` at seven, the ids and names of every content table (`tests/content-freeze.test.ts` on the Stage 3 branch), the serialised default state and a loaded version-4 save (`tests/save-compat-s3.test.ts`), exactly twelve names in `worldMap.ts` (`tests/names.test.ts`). | Story quests, people and dungeons live in their own tables, never in `QUEST_DEFS`, `STARTER_QUESTS` or `POIS`. Every test replacement is declared in 11.3 with its file and assertion: seven additive ones for content, and four that follow the owner's two rule changes. |
| C7 | `src/state` and `src/data` import nothing from the engine or `three`, and no file there may contain the words `document` or `window`, in code, comments or strings (`tests/architecture.test.ts`). | All rules of this stage are pure modules with injected time and randomness. Dialogue text is data under `src/data` and cannot use those two words; a data test checks it. |
| C8 | Vitest runs in `node` with no DOM. | Every automated proof is DOM-free. What needs a screen is a human check. |
| C9 | No new runtime dependency. | Dialogue, quests, dungeons and the diary are plain TypeScript tables and reducers. |
| C10 | One machine, shared (owner's rule): capped test runs, three or four agents at a time, one build at a time. | The plan's lanes are sized for that. |
| C11 | Stage 5 owns the interface language: its components, tokens, no inline handlers if CALL-V13 was taken. | The three new surfaces (dialogue panel, journal, diary) use its panel, tab, button and modal rows and add no `onclick` attribute. |

---

## 3. Goals, non-goals, anti-goals

Goals:

- **G6.1** People can be spoken to. Dialogue is data: trees of nodes with conditions and effects, validated by a test, run by a pure module.
- **G6.2** A main line of seven chapters leads through the five regions, the gated pass and both dungeons to Ashmantle, and six side quests each teach or reward one loop. Quests have stages, givers and a journal.
- **G6.3** The Stage 3 starter chain gets a voice and loses nothing: same ids, same steps, same rewards, same 29 actions.
- **G6.4** Every loop the audit found open is closed or deferred in writing: steel, black, adamant and dragon gear can be forged; ranged and magic armour can be made; every rune and both potions can be made; ashes, bars and feathers have a source and a use.
- **G6.5** Two new skills, Crafting and Runebinding, on the current curve, each with an unlock table, a place to train and an interface. No third skill.
- **G6.6** Dungeons exist as a mechanism where a new dungeon is a table row, and two are built: Saltfang Warren (levels 30 to 48) and the Underkiln (52 to 80).
- **G6.7** Stage 4's five prepared slots are filled: Cinder Adept, Slag Brute, a camp captain, a swarm creature, a dungeon boss, plus a second dungeon boss. Each boss asks a different question, and the proof is a seeded fight table.
- **G6.8** A diary: five regions, three tiers, 75 tasks that touch every system, with rewards that are experience and convenience, never coin income.
- **G6.9** Stage 3's pacing test and economy invariants pass unedited with all of this in place. (The pacing test's support model holds Stage 2's aggression rule in one line; that line follows the rule: 7.13, replacement 9 of 11.3.)
- **G6.10** A version-4 save loads to exactly the state it loads to today, plus two skills at level 1. The new block survives a round trip, rejects hostile values, and is bounded in size.
- **G6.11** Every item owed to Stage 6 by Stages 1, 3 and 4 is fixed or deferred again in writing (section 12).
- **G6.13** The three styles are in one band: from level 20 to 70, with the standard kit of the level, the fastest deals at most 1.4 times the slowest's damage per second (today up to 2.68) at the decade levels and at every level but 28, where it is 1.43 (7.12, CALL-6.24), each keeps a character of its own, nothing is taken from a save, and every fight bound of Stage 4 and of this stage holds with the formula before and after (7.12).
- **G6.14** Monsters are aggressive or passive. An aggressive one attacks any hero it sees; how far it sees shrinks as the hero outlevels it; the pass sentries, bosses and dungeon camps keep their sight. One pure function, and Stage 2's gate and Stage 3's pacing proofs still hold (7.13).
- **G6.12** Every new rule is a pure function under `src/state` with injected randomness and time; every new piece of content is a table; every new player action is a command. Section 8 lists what a second player would break.

Non-goals: new models; voice acting or portraits; branching story with exclusive outcomes; reputation or factions; a party system or any networking; generated dungeon layouts; timed lockouts; a third new skill (farming, agility, thieving and the like); new gather kinds (herb patches); raw fish for salmon, swordfish and anglerfish; pets; an auction or player trade; renaming borrowed names (Stage 8, if the owner decides).

Anti-goals:

- No change to the XP table or the XP of an existing action, and no change to a combat formula beyond the three style numbers of 7.12. Melee's formula, accuracy, the hit chance and every monster's attack are not touched.
- No edit to the price, requirement or stats of an existing item, or to an existing recipe's inputs. (The rune counts of two spells change, in the caster's favour: 7.12.)
- No reward paid once that is not a quest's: a chest, a boss and a dungeon pay the same table every time (7.6).
- No edit to `QUEST_DEFS`, to Stage 3's `STARTER_QUESTS`, or to any existing quest's reward.
- No reward that pays coin faster than open ground does at the same level.
- No quest or dialogue that locks content for good: every choice can be made again, nothing is missable.
- No string from a save ever reaches `innerHTML`.
- No clock in a rule: a rule that needs time takes it as a parameter.

---

## 4. What exists today

### 4.1 Quests

| Fact | Where |
|---|---|
| A quest is `{ id, name, region, lore, rewardText, steps, gp, xp, items, ward?, title? }`. A step is a label and a closure `met(state)`. | `adventure.ts` 33-55 |
| Ten quests, two per region. Every step reads a boolean flag, a shrine or the worn body. | `adventure.ts` 57-212; flags in `quests.ts` 3-32 |
| Flags are set by pure "note" functions called from the engine and the UI: a kill, a gather, a craft, a sale. | `adventure.ts` 469-476; `quests.ts` 96-130; `recipes.ts` 150-152 |
| A quest has no state of its own: it is "complete" when every predicate is true, and "claimed" when its id is in `quests.claimed`. | `adventure.ts` 394-411, 430-450 |
| The tracker shows the first unclaimed quest in table order. | `adventure.ts` 529-550 |
| The Adventure Log is one window that lists every quest card with a claim button. | `stations.ts` 506-546; `index.html` 356 |
| Talking: an object with `action: 'dialogue'` prints its one string to chat. The castle guards and the Wardstone Cairn use it. | `loop.ts` 216-220; `worldBuild.ts` 549-551, 788-790 |
| People are built by `createMerchantNPC(x, z, name, tunicColor)`: the humanoid rig, a hitbox with `userData.action`, a name label. | `worldBuild.ts` 505-533 |
| On load, claimed ids not in the quest table are dropped. | `save.ts` 88-89 |

What Stage 3 adds (read on its branch): `STARTER_QUESTS` (seven entries, a second table with the same shape), `starterView`, a `claimQuest` that reads both tables and opens the chain one quest at a time, a tracker that puts the open starter quest first and discovered regions next, and `createNewGameState()` whose `quests.claimed` is `['arrival']`. A save that never claimed `arrival` never sees the chain. Its pacing test plays the chain as 29 fixed actions and calls `claimQuest` directly.

### 4.2 Skills and loops

Twelve skills (`catalog.ts` 1-14). What each consumes and produces today, and after Stage 3:

| Skill | Consumes | Produces | Feeds |
|---|---|---|---|
| Woodcutting | trees | six kinds of log | Smithing (bows, shafts, shields), Cooking (burning) |
| Mining | rocks | five ores | Smithing |
| Fishing | spots | four raw fish | Cooking |
| Cooking | raw fish; logs (burning gives Cooking XP and ashes) | four foods; ashes | Hitpoints in a fight (Stage 4 gives food a job) |
| Smithing | ore, bars (Stage 3), logs, shafts, feathers | bars; bronze, iron, mithril, rune and gilded melee gear; five bows; shafts; bronze arrows; a wooden shield | Attack, Defence, Ranged |
| Prayer | bones | nothing but its own level | nothing |
| Attack, Strength, Defence, Hitpoints, Ranged, Magic | arrows, runes, food | kills: coins, bones, drops | everything, through coin |

Open loops, from `results.txt` section 1 (24 items today):

| # | Open loop | Kind |
|---|---|---|
| L1 | All nine runes are shop-only. Magic has no skill behind it. | sink with no source |
| L2 | Both potions and five foods (salmon, swordfish, anglerfish, the stew, the brew) are shop-only or drop-only. | sink with no source |
| L3 | Ranged and magic armour (hides, robes): 0 recipes for about 40 pieces. | sink with no source |
| L4 | Steel, black, adamant and dragon melee gear: no recipe (Stage 3 F14). | sink with no source |
| L5 | Ashes are produced by every burned log and used for nothing. | source with no sink |
| L6 | Feathers and bolts are shop-only; every bow, at any level, shoots bronze arrows at 8 GP (`items.ts` 37-50). | sink with no source; a ladder with one rung |
| L7 | Prayer consumes bones and feeds nothing. Bones have one use. | a skill that feeds no other |
| L8 | Bars had no use (audit finding 9). Fixed by Stage 3; gold bars only feed gilded armour. | closed by Stage 3 |

### 4.3 The three styles, measured

`results.txt` section 5: damage per 0.6 s swing with the best ordinary weapon, body and legs wearable at each level (special-set and unique pieces left out), against a monster of that level, by the game's own formulas.

| Level | Melee | Ranged | Magic | Ranged / melee | Magic / melee | Ranged cost per kill | Magic cost per kill, runes bought |
|---|---|---|---|---|---|---|---|
| 20 | 5.9 | 11.1 | 14.4 | 1.9 | 2.5 | 22 GP, 20% of the kill's coins | 40 GP, 37% |
| 30 | 7.8 | 13.0 | 20.9 | 1.7 | 2.7 | 30 GP, 17% | 212 GP, 120% |
| 40 | 10.3 | 18.0 | 21.4 | 1.7 | 2.1 | 26 GP, 11% | 249 GP, 109% |
| 50 | 11.6 | 24.2 | 30.0 | 2.1 | 2.6 | 26 GP, 7% | 1,299 GP, 371% |
| 60 | 15.6 | 27.8 | 35.4 | 1.8 | 2.3 | 32 GP, 6% | 1,582 GP, 285% |
| 70 | 16.6 | 28.8 | 35.9 | 1.7 | 2.2 | 35 GP, 5% | 1,741 GP, 243% |

Reading it. This is the fact behind Stage 4's "ranged and magic kill the boss in half the time". Ranged deals about 1.8 times melee's damage and magic about 2.3 times, at every level from 20 up, in the item tables as they are. Magic pays for it: from level 30 a caster spends more on runes than the kill drops. Ranged pays nothing: one arrow price for every bow, falling from 20% of a kill's coins to 5%. The gear ladders exist as rows (ten bows and crossbows, four hide sets, four robe sets, eight staffs); what is missing is a way to make them, and a formula that does not value a point of ranged or magic gear at twice a point of melee gear (7.12). One correction to this reading, found when the rebalance was modelled: magic "pays for it" only with its dearest spell. A level-70 caster using the level-12 spell deals 1.61 times melee's damage for 12% of the kill's coins (`results.txt` 5b).

### 4.4 Monsters, dungeons, bosses

After Stage 4: twelve ordinary monster types from level 1 to 68 with a hole from 45 to 68, the unphased dragon (95) and Ashmantle (110) behind the pass. Stage 4 prepared: Cinder Adept (52) and Slag Brute (58) with patterns named; a camp captain (about 40), a swarm creature (about 30) and a dungeon boss (about 80) with nothing but a role. It says each of the last three needs a new model and that the dungeon boss must not be a third dragon.

There is no dungeon. The engine assumes one world: `isWalkable` and `moveWithCollision` bound the world at ±118 (`collision.ts` 109, 118), the walk grid is 236 by 236 from -118 (`pathfind.ts` 11-12), `sanitizePose` clamps a saved position to ±118 (`save.ts` 212-213), and monster state is never saved. Stage 4 gives `stepMonster` a grid as a parameter and `moveWithCollision` an optional walk test, with dungeons in mind (its section 7). It does not say that the ±118 clamp goes when a test is given, nor that `stepMonster`'s three movement calls (`monsterAi.ts` 167, 202, 262) pass the test; Stage 6 makes both changes (Z2, critique C2). Stage 4's `respawnSecs` is a field of the `BOSSES` row, keyed by monster type: there is no per-monster "never respawn" option (critique H3). Stage 5 raises the camera's far plane from 360 to 460, makes the sky dome follow the camera and adds a horizon apron out to radius 240 around the origin (Stage 5 design 6.4); a zone must be placed and lit with that in mind (critique C1).

### 4.5 Findings

| # | Finding | Where | Answer |
|---|---|---|---|
| F6.1 | Quests have no people, no stages and no state. | 4.1 | 7.2, 7.3 |
| F6.2 | A step is a closure, so a data test cannot read what a quest asks. | `adventure.ts` 33-36 | New quests use tagged conditions (7.2). Old tables are not touched. |
| F6.3 | Nothing counts what the player does; only "did it once" flags exist. | `quests.ts` 3-32 | A bounded counter table (7.3). |
| F6.4 | Open loops L1 to L7. | 4.2 | 7.4 |
| F6.5 | Ranged and magic deal about twice melee's damage at every level; ranged has no running cost that grows; magic has one that outruns income only for its dearest spell. | 4.3 | 7.12 (the rebalance); 7.4 (arrow grades; runes at their inputs' value) |
| F6.6 | `addChatMessage` writes `innerHTML` (`hud.ts` 64). The corrupt-save notice already passes a key name through it; any quest or dialogue text sent that way would be markup. | `hud.ts` 60-68 | Dialogue and journal text is written with `textContent` only (7.2, section 13). |
| F6.7 | The shop lists every entry of `ITEMS` (`stations.ts` 289). New materials are safe because their types are `resource` and `bar`, which cannot be bought (`inventory.ts` 208-214). A new item of any other type would be on sale the moment it exists. | `stations.ts`, `inventory.ts` | Every new item is `resource`, `bar` or `ammo`; a test pins it (7.4). |
| F6.8 | A new POI, path or basin name changes the count that `tests/names.test.ts` pins at twelve. | `tests/names.test.ts` | Doors and people are not `POIS` rows (7.3, 7.6). |
| F6.9 | Kills are fast: a fighter with every skill at 45 cuts 1,638 hitpoints in 90 s. A dungeon of twenty monsters is under two minutes for the model and three to four for a person. | `results.txt` section 8 | Dungeons are short on purpose; their gate is the boss, not the corridor (7.6). |
| F6.10 | A monster's level is compared with the hero's combat level, which runs ahead of its skills: a hero ready for a level-48 boss is combat 62 and is ignored by everything under that. Under Stage 2's rule a dungeon's rooms would stand and watch. | `monsterAi.ts`, transition T2; `adventure.ts` 252-275 | Stage 2's rule is replaced for the whole game (7.13, the owner's decision): aggressive camps attack at any level, and dungeon camps are aggressive camps that keep their full sight. |

---

## 5. How established games solve each problem

Techniques only. No name, character, quest, map or number is taken from any of them.

| Problem | Technique in established RPGs and MMOs | Fits a single-player, click-to-act browser game? |
|---|---|---|
| Leading a player through a world | **Hub-and-spoke quest lines**: a main line whose chapters each send the player to one spoke (a region), where a local giver has side work. The hub is revisited between chapters. | **Yes.** Five regions around one start town is already a hub and spokes. Chapters are gated by combat level, so the line doubles as the level guide. |
| Talking | **Dialogue trees with flags**: nodes of text, options shown or hidden by conditions on game state, effects that set state. Hubs return to a root node. | **Yes, small.** A tree per person, at most four options, no exclusive branches. Conditions and effects as tagged data (not script) so a test can validate every tree. |
| Quest structure | **Staged quests with a journal**: one integer per quest, each stage a "talk to" or "do", the journal showing the current stage's text. | **Yes.** One number per quest is the whole saved state. |
| Teaching a system | **The trainer quest**: the person who teaches a craft gives a short quest that makes the player do it once and pays the first materials. | **Yes.** It is what Stage 3's starter chain does for the first hour. |
| Skills that matter | **Loops and sinks**: every gathered thing has a use, every used thing has a source, and each combat style has a production skill behind it. Secondary ingredients come from monsters, so mid-level monsters stay worth killing. | **Yes.** Drops as ingredients need no new gather kind and no new model. |
| Ranged cost | **Arrow grades**: a better arrow hits harder with any bow, and is made from the same bars as armour. (The other common form, a better bow refusing a worse arrow, was the first draft's; the owner chose this one: "bows shoot arrows. Good ones and bad ones.") | **Yes.** It takes nothing from an existing ranged character. |
| Who attacks whom | **Aggressive and passive creatures, with a sight radius that shrinks as the player outlevels them** (the common MMO form; the owner named World of Warcraft's feel). | **Yes.** One function of the two levels; camps already carry the aggressive flag. |
| Chasing a specific item | **Drop tables with rare entries**: a boss or its chest rolls each entry every time, beside base loot it always gives. No counter (owner: a drop chance is a drop chance). | **Yes.** Rows and an injected random source. No lockout is needed for it. |
| Self-contained challenge areas | **Instanced dungeons**: a private copy of an area per party, reset on entry, with trash packs, gates and an end boss. | **The instance part is free here**: with one player, every area is already private. What transfers is the shape: reset on entry, gates opened by clearing, a chest at the end. Kept as data so a per-party copy is possible later. |
| Stopping reward farming | **Lockouts**: a boss's chest pays once per day or week. | **No.** A wall clock in a single-player game with local saves is not a boundary and only punishes honest players. The run itself is the gate, and the chest is deliberately poorer than open ground (7.6, CALL-6.5). |
| Bosses | **Mechanics as questions**: each boss tests one thing (position, tempo, preparation), and its phases are the same question asked harder. | **Yes**, and Stage 4 built it: a boss is rows of attacks and phases. Three new bosses, no new rule. |
| Elites | **Named rares / camp captains**: one tougher member with a name and a better drop. | **Yes**, as a one-member camp with a short boss row. |
| Breadth | **Tiered achievement diaries with regional rewards**: per region, tiers of tasks that touch every activity there; each tier pays a lump of experience and a lasting convenience in that region. | **Yes.** It is the cheapest system here (conditions over counters) and the one that makes every other system get used. |
| Death in a dungeon | **Run ends, progress on the boss is lost, no item is lost.** | **Yes**: Stage 4's rule (a little experience, or the vow) applies unchanged. |

---

## 6. Approaches

### 6.1 Dialogue and quest content: where it lives

| | A. Tagged data tables with a pure interpreter (recommended) | B. Closures, as `QuestStep.met` is today | C. A scripting language or a parsed file format |
|---|---|---|---|
| What | Conditions and effects are small tagged objects (`{ skill: ['mining', 10] }`, `{ give: ['coal', 4] }`). One pure module evaluates them. | Each condition and effect is a function in the table. | Dialogue in JSON or a text format, loaded at run time, with expressions. |
| For | A test can walk every tree: every `goto` resolves, every id exists, every give fits a rule, no dead end. Readable in review. Serialisable later for co-op. | No interpreter. | Writers could edit without a build. |
| Against | A fixed vocabulary: a new kind of condition is a code change. | Opaque to tests: a closure cannot be inspected, so "this quest never asks for an item that does not exist" cannot be proven. | A new parsed input (a trust boundary), a parser, and nobody is asking for it. |

Recommendation: **A**. The vocabulary is 14 conditions and 8 effects (7.2). The existing ten quests and the starter chain keep their closures: rewriting them buys nothing and two frozen tests pin them.

### 6.2 Quest state

- **A (recommended): one integer per story quest**, the index of the current stage, in the new saved block; completion goes in the existing `quests.claimed`. Stages are either "talk" (advanced by a dialogue effect) or "do" (advanced when their condition becomes true). Counters, not per-quest tallies, answer "kill 4 of these".
- **B: derive everything from flags, as today.** Cannot express "spoke to", or order.
- **C: a general objective tracker with per-objective progress.** More state, more validation, for the same result as counters.

"Kill 4" against a global counter has one catch: kills made before the quest count. That is accepted and made a rule: a quest never asks again for work already done. It is also what makes existing saves' flags useful.

### 6.3 How many new skills

| Open loop | Smallest closure | New skill? |
|---|---|---|
| L4 steel, black, adamant, dragon | Two new rocks on the existing rock mesh, four bars, twelve recipes | No: Smithing |
| L2 potions | Three recipes, ingredients from drops | No: Cooking ("brewing") |
| L5 ashes | Inputs to brewing and to fire runes | No |
| L6 ammunition | Five recipes from bars | No: Smithing |
| L3 ranged and magic armour | Hides and cloth from drops, sixteen recipes | **Yes: Crafting.** Putting sixteen more recipes on Smithing would make it the skill for all three styles and remove the reason to pick one. |
| L1 runes, L7 bones | Blank stones from a new rock, bound at an altar, with bones and ashes as catalysts | **Yes: Runebinding.** Nothing existing is about magic. |

Two is the fewest that close the loops and leave each style with its own craft: Smithing for melee, Crafting for ranged and robes, Runebinding for magic. A herb skill, a farming skill and a separate fletching skill were considered and cut: each would add a gather kind or split a skill a frozen test pins (`fletch_shortbow` is a Smithing recipe, `tests/phase1.test.ts` 217-221).

### 6.4 How a dungeon exists in this engine

Counted against the code (4.4):

| | A. Offset zone on the same scene and coordinates (recommended) | B. A pocket carved into the overworld | C. A separate `THREE.Scene` | D. Generated layout |
|---|---|---|---|---|
| What | Each dungeon is a square of rooms far outside the world's bound (x from 1000), with its own walk grid. Entering is a teleport. | A walled hollow inside Harrowback Ridge's core, reached by a door. | A second scene; the player, effects and labels are moved between scenes. | Rooms placed by a seeded generator. |
| Walking | The engine already keeps one grid, `G.walkGrid` (`context.ts` 217, built at `renderer.ts` 156, read at six places in `input.ts` and `loop.ts`). Entering a zone swaps it. `buildWalkGrid` gains an origin and a size. Rooms are rectangles; the walk test is "inside a room and not in a shut gate". | None: the same grid and `isWalkable`, plus "hollow" shapes. | As A. | As A, plus the generator. |
| Height | One line: `getTerrainHeight` returns 0 for x of 400 or more. | A pad in the height function, and the terrain golden changes. | A second height function. | As A. |
| Monsters | Stage 4's `stepMonster` with the zone's grid and camps. Unchanged rules. | Unchanged. | As A. | As A. |
| Seeing the overworld from inside | Impossible without work once zones stand at x 1000: after Stage 5 the far plane is 460 and the horizon apron reaches radius 240, and the nearest zone cell, less the camera's 26, is 734 from the apron. The sky dome follows the camera, so the zone hides it. | The overworld is all around; it is a canyon, not a dungeon. | Not drawn. | As A. |
| Room for more | Unlimited: a new dungeon is a row with another origin. | One or two: the ridge core is 22 wide, and a boss arena needs 24. | Unlimited. | Unlimited. |
| Cost | A zone table, a zone mesh builder, the grid swap, the hero's step taking the grid's walk test (`loop.ts` 307; Stage 4 adds that parameter to `moveWithCollision`), a door action. | Smallest. | Largest: `G.scene` is used by every effect, label and mesh builder. | A plus a generator and a way to test "every generated layout is completable". |
| Co-op later | A per-party copy is another origin for the same row. | No. | Yes. | Yes. |

Recommendation: **A**. B is smaller but stops at one dungeon and cannot hold a boss room. C buys isolation that distance and hiding the dome already give. D is a later stage's choice: a generator would produce the same row A reads.

### 6.5 What stops a chest from being farmed

- **A (recommended): nothing but the run.** A dungeon resets on entry; the boss door opens only when the rooms are cleared; the run pays less per second than open ground at that level (44.4 GP/s in the Warren against 78.6 from the best open ground at that level, 89.1 against 178.5 in the Underkiln, with the same overheads, every drop's goods counted on both sides and every rare entry at its chance; `results.txt` section 8). What the chest has that open ground has not is the material and the rare piece: adamantite, Kilnglass, and a chance at a crossbow or a robe. **Decided by the owner on 2026-11-14** (section 15).
- **B: a daily lockout.** Needs a saved wall-clock time, which a player changes by changing the clock, and which makes "play when you have an evening" worse.
- **C: a key consumed on entry.** A real sink, and a second thing to farm before the thing the player wants to do. Kept as a slot: `needs` in the dungeon row can name an item later.

### 6.6 Diary rewards

- **A (recommended): experience as an item, and convenience.** Each tier pays one ember (used from the backpack on a skill the player picks) and, from the medium tier, one lasting regional perk from a list of four kinds. None pays coin income.
- **B: coin and gear.** Moves Stage 3's pacing directly.
- **C: percentage boosts to gathering or drops.** Each is a small permanent change to an economy number the pacing model does not know about.

### 6.7 Ranged and magic ladders

**Decided by the owner on 2026-11-14: not A.** "Let's structure the rebalancing, no problem." The design is B in a much smaller form than the first draft feared: three numbers of the formula instead of sixty item rows (7.12). The options as first written:

- **A (the first draft's recommendation, declined): parity of cost, not of damage.** Leave every damage number. Give ranged a running cost that grows with the bow (ammunition tiers made by Smithing) and let Runebinding bring magic's cost down from "more than the kill pays" to "about what the kill pays". Melee stays the slow, free, sturdy style.
- **B: rebalance the item tables** so the three styles deal the same damage at a level. About sixty rows of an existing table, every one a number existing players own, and Stage 4's boss proofs are tuned against today's numbers.
- **C: per-monster resistances.** A new term in the damage formula, which this stage may not add.
- **D: defer again.**

---

## 7. Design

### 7.1 The shape of the stage

One main line, seven people, and each person owns one system:

| Chapter | Person | Region | Combat | What the chapter makes the player do for the first time |
|---|---|---|---|---|
| (the starter chain, Stage 3) | Bran Tolley | start town | 3 | Everything once. He gives the chain a voice (7.3). |
| 1. The Guttering Wards | Odalys Venn | start town, then the cairn | 3 | Talk, read the journal, walk a road to its end, see the pass and be told not to enter. |
| 2. Iron for the East Lamp | Tamsin Reeve | east plaza | 15 | Mine coal, smelt steel: the forge route for the tiers that had none. |
| 3. Salt on the Wind | Qadir Salt-Hand | dunes | 50 | Hunt for a material, then enter the first dungeon and kill its boss. |
| 4. What the Hollow Keeps | Hesper Moth | woods road | 55 | Bind runes; fight in the deep woods. |
| 5. The Held Pass | Corin Ashby | the cairn, the pass | 60 | Take the Lantern Vow and cross Cinderstep Pass on foot. |
| 6. Under the Ridge | Corin Ashby | volcanic corner | 72 | Clear the second dungeon; bring back Kilnglass for dragon gear. |
| 7. Ashfall | Odalys Venn | Ashmantle's arena | 75 | Kill Ashmantle. |

"Combat" in this document's gates is always the hero's **combat level** (`combatLevel`, `adventure.ts` 252-266), the number a camp compares with a monster's level. It is not a skill level: a melee hero with every fighting skill at 50 and Prayer 43 is combat 62, and a ranged or magic hero with the same levels is 54 (`check-results.txt` prints it for every fighter). The gates are set so that a hero who has just reached one can do what the chapter asks.

The premise, in three sentences, written for this game and built on the names Stages 2 and 4 already gave it: wardlights along the four roads keep the ash of the volcanic corner out of the settled lands, and the Lampwrights who tended them are down to one old woman. The lights are guttering because something behind Harrowback Ridge has woken, and ash-touched creatures have started to appear outside the pass. Each chapter relights one road's ward with what its region makes, and the last one goes to the source.

### 7.2 The dialogue system (G6.1)

**Data** (`src/data/dialogue.ts`, types in `src/state/dialogue.ts`):

```
Cond =  { all: Cond[] } | { any: Cond[] } | { not: Cond }
      | { quest: [storyQuestId, 'none' | 'active' | 'done'] }
      | { stage: [storyQuestId, number] }          // active and exactly at this stage
      | { claimed: questId }                        // any id in quests.claimed, old tables included
      | { starter: [starterQuestId, 'open' | 'ready'] }   // Stage 3's chain: open, or open with every step met
      | { skill: [skillKey, minLevel] } | { combat: minLevel } | { gp: min }
      | { has: [itemId, qty] } | { stat: [statKey, min] }
      | { shrine: regionId } | { flag: questFlagKey }

Effect = { start: storyQuestId } | { advance: storyQuestId } | { finish: storyQuestId }
       | { claimStarter: starterQuestId }           // calls Stage 3's claimQuest, nothing else
       | { give: [itemId, qty] } | { take: [itemId, qty] }
       | { open: 'shop' | 'bank' | 'forge' | 'tasks' | 'bench' | 'altar' }
       | { enter: dungeonId }

Option   = { text: string, when?: Cond, then?: Effect[], goto: nodeId | 'end' }
Node     = { say: string, by?: 'hero', options: Option[] }          // 1 to 4 options
Dialogue = { npc: npcId, greet: { when?: Cond, node: nodeId }[], nodes: Record<nodeId, Node> }
```

Fourteen conditions, eight effects. `greet` is read top to bottom and the first entry whose condition holds is where the person starts, so the same person says different things as the story moves. There is no variable, no expression, no script. A dialogue cannot pay coin or experience on its own: those come only from a quest's `reward`, through `finish`, once.

**Rules** (`src/state/dialogue.ts`, pure):

- `openDialogue(state, npcId)` returns a view `{ npcId, nodeId, speaker, say, options: { index, text }[] }` holding only the options whose `when` holds, and counts the conversation (`talk:<npcId>`).
- `chooseOption(state, npcId, nodeId, index)` trusts nothing it is handed: it checks that the node belongs to that person, evaluates the option's condition again, and **applies every effect to a `cloneState` copy**, then commits the copy to the state with `applyState` only if all of them succeeded (critique M5: one code path, not a rehearsal and a second application that must agree). If a `give` or a quest reward does not fit the backpack, or a `take` cannot be paid, the copy is dropped, nothing changes, and the result says why; the person then says "Make room first." (a fixed line the UI owns). It returns the next view or the end, and a list of events (`questStarted`, `questAdvanced`, `questFinished`, `open`, `enter`) for the engine to turn into a banner, a sound or a station window.
- The module keeps nothing between calls. The interface holds the current node id and passes it back.

**Once only, by construction.** A data test requires that every option with `give`, `take`, `finish` or `claimStarter` also carries a `when` that pins a quest stage or a starter state, and that its effects move that quest on. So the condition is false the next time the option could be shown. No "already given" list is needed.

**The data test** (plan D1) walks every tree and fails on: a `goto` to a missing node; a node no path reaches; a node with no option; more than four options; an option that can never end; an id (item, quest, stat, skill, region, dungeon, person) that is not an own key of its table; a `say` over 280 characters or an option over 80; the words `document` or `window` (C7); a `<` or `&` in any text, and the same scan over every string of `NPCS`, `STORY_QUESTS`, `DIARY` and `DUNGEONS` (names and journal lines reach chat lines, which `addChatMessage` writes as markup: critique M6); a person with no dialogue or a dialogue with no person.

**Interface** (`src/ui/dialogue.ts`): one panel at the bottom centre in Stage 5's panel and button language: the speaker's name, the line, the options as buttons numbered 1 to 4. Keys 1 to 4 choose, Escape closes. It is a `role="dialog"` with focus moved in and returned, as Stage 5's modal rule asks. Every string is written with `textContent`. It adds no inline handler. The game does not pause. The panel closes by itself when the hero is hit, dies, or moves more than 5 units from the person.

**Engine**: a person's hitbox carries `{ type: 'interactive', action: 'talk', npcId }`. The interaction branch of `updatePlayerIntent` (`loop.ts` 207-230) gains one case that calls `openDialogue`; the context menu label is "Talk-to" with the name from the table (`input.ts` 300-304). The existing `'dialogue'` action (castle guards, the cairn's sign) is not touched.

**Where people stand** (`src/data/npcs.ts`, a table of `{ id, name, role, x, z, tunic, hat? }`, built by the existing merchant builder). Checked on the real world (`results.txt` section 6): every one on walkable ground, outside every aggressive camp's leash circle, at least 3.8 from any station.

| Person | Where | In a safe zone | Who they are |
|---|---|---|---|
| **Bran Tolley** | (4, 12), south of the bank | start town | Gatewarden. Counts people in and out; blunt, kind, short sentences. The voice of the first hour. |
| **Odalys Venn** | (-8, -6), west of the store | start town | The last Lampwright. Dry, tired, exact; talks about the lights as if they were patients. Hub of the main line. |
| **Pell Greaves** | (12, -8), by the start-town range | no (passive town) | Cook. Loud, generous, suspicious of anything that is not food. Teaches brewing. |
| **Tamsin Reeve** | (88, -22), by the east forge | east plaza | Master smith. Impatient with talk, patient with metal. Teaches coal and the missing tiers. |
| **Qadir Salt-Hand** | (60, 66), by the dunes store | dunes | Tanner and caravan master. Wastes nothing, bargains over everything. Teaches leatherwork; shows the Warren. |
| **Hesper Moth** | (-52, -10), at Lampwright's Hollow | no (9.5 off Lanternway, outside every camp) | Hermit runebinder. Speaks in half sentences, finishes them a line later. Teaches binding. |
| **Corin Ashby** | (-5, 48), at Wardstone Cairn | no (8.4 off Cinder Stair, 10 outside the nearest camp's leash) | Warden of the cairn. Has watched people go into the pass. Plain, careful. Gates chapters 5 and 6. |

**Size.** About 40 nodes a person, 300 in all, at most 280 characters each: under 90 kB of source before minification. The full text is written in plan task Q5, by Claude, from the voice notes above and the stage tables of 7.3, and read by a person before merge. This document fixes what each conversation must do, not every line. Three sample lines, to fix the register:

- Bran Tolley, to a new character: "Name, and what you carry. Nothing? Then you will fit in. Put your name in the task master's ledger and I will find you a blade."
- Odalys Venn, chapter 1: "A wardlight does not keep monsters out. It keeps the ash from settling. The monsters are what the ash leaves behind."
- Corin Ashby, at the cairn, to a hero below combat 50: "I am not going to tell you not to go in. I am going to tell you that the last three who did were better armed than you."

### 7.3 Quests: stages, state, journal (G6.2, G6.3)

**Table** (`src/data/story.ts`):

```
StoryQuest = {
  id, name, line: 'main' | 'side', giver: npcId, region,
  needs: Cond,                                   // when the giver offers it
  stages: ({ kind: 'talk', at: npcId, journal: string }
         | { kind: 'do', done: Cond, journal: string })[],
  reward: { gp: number, xp: Record<skill, number>, items: { id, qty }[], title?: string }
}
```

**State.** While a quest is active, `progress.story[id]` is the index of its current stage. A `talk` stage moves on when a dialogue option says `advance`. A `do` stage moves on when its condition becomes true; `advanceStory(state)` (pure, `src/state/story.ts`) checks the active quests and returns what moved, and the engine calls it from the existing 10 Hz vitals tick. On `finish` the reward is paid through the same code path as `claimQuest` (coins through Stage 3's `creditGp`, experience unmultiplied, items after the rehearsal), the id leaves `progress.story` and enters the existing `quests.claimed`. The claimed-id filter on load (`save.ts` 88-89) accepts story ids.

**Counters** (`progress.stats`, finding F6.3). A fixed list `STAT_KEYS`, derived from the tables: `kill:<monster type>`, `gather:<node item>`, `craft:<recipe id>`, `talk:<npc id>`, `clear:<dungeon id>`, and `bury`, `vows`, `deaths`: 133 keys with this stage's content. `bump(state, key)` is called inside the pure functions that already mark flags: `registerKill`, `noteGather`, `tryCraft`, `noteBury`, Stage 4's `buyVow` and `applyDeathLoss`, `openDialogue`, and the dungeon's `clear`. A key not in the list is a thrown error (a bug), never a new counter. Counts saturate at 2,147,483,647.

Work done before a quest counts. A hero who has already killed four stalkers finishes that stage on the spot. The journal says so ("already done"). For a save from before this stage every counter starts at 0; where "at least once" is asked, the condition also accepts the old flag (`{ any: [{ flag: 'killedMoss' }, { stat: ['kill:moss_guardian', 1] }] }`).

**The main line.** Each chapter needs the one before it and the combat level of 7.1. A giver asked too early says the level.

| Quest | Stages (T = talk, D = do) | Reward |
|---|---|---|
| `ml_wards` The Guttering Wards. Offered when the starter chain is finished, or at once to a save that never had the chain. | T Odalys. D carry 3 ashes (burn three logs). T Odalys, who takes them. T Corin at Wardstone Cairn. | 300 GP, 300 Prayer XP, a Faint Ember |
| `ml_east` Iron for the East Lamp | T Tamsin. D mine 4 coal. D smelt 2 steel bars. T Tamsin, who takes 2 steel bars. T Odalys. | 1,200 GP, 600 Smithing XP, a Faint Ember |
| `ml_salt` Salt on the Wind | T Qadir. D kill 4 Saltback Stalkers. T Qadir, who opens the Warren (7.6). D kill Matron Saltfang. T Odalys. | 4,000 GP, 2,000 Crafting XP, 8 Adamant Bars, the title Warrenbreaker, a Steady Ember |
| `ml_hollow` What the Hollow Keeps | T Hesper. D bind fire runes 3 times (Runebinding 12). T Hesper. D discover the woods shrine and kill 2 moss guardians. T Odalys. | 6,000 GP, 3,000 Runebinding XP, 50 chaos runes, a Steady Ember |
| `ml_pass` The Held Pass | T Corin. D hold a Lantern Vow once. D discover the shrine behind the pass. T Corin. | 8,000 GP, 5,000 Prayer XP, a Steady Ember |
| `ml_kiln` Under the Ridge | T Corin. D kill 3 Cinder Adepts and 3 Slag Brutes. T Corin, who opens the Underkiln. D open the Underkiln's chest (it opens only when the Kiln Warden is dead). T Odalys, who takes 1 Kilnglass Shard. | 15,000 GP, 10,000 Smithing XP, 2 Wyrmsteel Ingots, the title Kilnbreaker, a Bright Ember |
| `ml_ash` Ashfall | T Odalys. D kill Ashmantle. T Corin. T Odalys. | 30,000 GP, the title Wardkeeper, a Bright Ember |

The seven pay 64,500 GP in all, over about thirty hours. Stage 3 sized the ten existing quests at 57,300 GP, "about one adamant kit"; a level-70 fighter earns 64,500 GP from lesser demons in nine minutes (119 GP/s, `results.txt` section 8). The largest share against its tier is chapter 2: 1,200 GP when a steel kit costs 11,100. Stage 3's pacing model plays none of these, so no assertion of its test reads them; R0 and the slice gate re-run it all the same.

**A quest is a quest: its reward is taken once (owner, 2026-11-14).** "A quest's reward is taken only once, regardless of whether the quest is opening a chest." This is how it holds, and how the two kinds of pay are told apart in data:

- **Quest pay lives in one place**: the `reward` of a `STORY_QUESTS` row, paid by `finishQuest` when the quest's last stage is done. The id then moves to `quests.claimed`, and a claimed quest cannot be started, advanced or finished. Nothing else in the game pays once.
- **Dungeon loot lives in another**: the `loot` of a `DUNGEONS` row (7.6), rolled by `openChest` on every clear. A chest row has no field that can hold a once-only reward; the first draft's "first clear" list is gone, and what it held moved into the two quests above (the adamant bars and the two titles) or into the chest's rare entries (the crossbow and the robes).
- **A quest step can be "open a chest"**: chapter 6 has one. It is a `do` stage whose condition reads the counter `clear:<dungeon>`, which `openChest` bumps. Opening the chest pays the chest's own roll, every time; the quest notices the counter, moves on, and pays its reward at its end, once. Opening the same chest fifty times more pays fifty rolls and no quest reward.
- **A chest that exists only for a quest** (none is built in this stage) would be an object whose one action is the dialogue effect `advance`: it has no loot table, so it cannot pay twice by construction.

The proof (plan Z1, Q5): with chapter 6 at its chest stage, `openChest` three times pays three rolls, advances the quest once, and `finishQuest` pays once and is refused a second time; a data test fails if a dungeon row carries a reward field other than `loot`; and the dialogue data test of 7.2 ("once only, by construction") already fails any option with `give`, `take` or `finish` whose `when` does not pin the quest stage it moves on. (Second pass: the first wording, "no reward reachable by a path that does not end in `finish`", named no test; these three are the test.)

Re-earning, checked path by path. **Reload**: `story` and `claimed` are saved, and the reader drops an active stage whose id is already claimed (section 9), so a reload cannot reopen a paid quest. **Re-entering a dungeon**: a new run rolls the chest again, which is the point; the quest stage was moved once and does not move back. **Reset**: no reset of a quest exists, in the game or in `cheats.ts` on `main`; a new game starts everything anew, as today. **One path is open and accepted**: a Stage 6 save opened by an older build loses `progress` and the story ids in `claimed` (section 9, CALL-6.11); if that build saves, the quests can be done and paid again. Nobody is expected to run an older build.

**Side quests.** Each teaches one loop and pays its first materials.

| Quest | Giver, needs | Stages | Reward |
|---|---|---|---|
| `sq_hides` Nothing Wasted | Qadir, combat 12 | T (he hands over 2 Rough Hide). D stitch Leather Vambraces and Traveler Boots. T. | 3 Chitin Plates, 500 Crafting XP, 300 GP |
| `sq_binding` Blank Stones | Hesper, none | T (she hands over 5 Blank Runestones). D bind air or mind runes 5 times. T. | 20 Blank Runestones, 300 Runebinding XP, 30 fire runes |
| `sq_steel` A Harder Edge | Tamsin, chapter 2 done | T. D forge any blacksteel piece. T. | 4 Blacksteel Bars, 600 Smithing XP |
| `sq_kettle` The Fourth Kettle | Pell, Cooking 30 | T. D brew a Prayer Restore Vial. T. | 3 Sting Glands, 800 Cooking XP, 2 Prayer Restore Vials |
| `sq_vow` A Vow Kept | Odalys, combat 15 | T. D hold a Lantern Vow once. T. | 1,000 GP, 500 Prayer XP |
| `sq_toll` The Tollmaster's Due | Bran, combat 40 | T. D kill Marrowjaw the Tollmaster. T. | 2,500 GP, the title Tollbreaker, a Steady Ember |

**The starter chain gets a voice and nothing else (CALL-6.2).** Stage 3's pacing test plays the chain as 29 fixed actions and calls `claimQuest` directly; a required conversation would be a thirtieth action and would break its first assertion. So:

- `STARTER_QUESTS` is not edited: same seven ids, steps, rewards, texts.
- Bran Tolley's `greet` list reads the chain through the `starter` condition. For the open quest he says its lore in his own words; when its steps are met he offers "It is done.", whose effect is `claimStarter`, which calls the same `claimQuest`. The claim button in the log keeps working. Whichever is used first pays; the other then finds the quest claimed.
- Three kinds of save, and what each sees:

| Save | Bran Tolley | The chain | Paid twice? |
|---|---|---|---|
| From before Stage 3 (never claimed `arrival`) | Greets a veteran: "You were here before I had this post." Offers `sq_toll` at combat 32. | Not shown, as Stage 3 decided. | No: `claimStarter` refuses a chain that is not open. |
| A new game, part-way through the chain | Speaks to the open quest; hands in when ready. | As Stage 3 shows it. | No: one `claimed` list. |
| A new game, chain finished | "Odalys Venn has been asking who is new." | All claimed. | No. |

**The journal** replaces the body of the Adventure Log window (`renderQuests`, `stations.ts` 506-546) with three tabs:

- **Journal**: active story quests first, each with its current stage's text and, for a `do` stage, the counts ("2 of 4"); then quests on offer, each with the giver's name, place and what it needs; then finished ones, collapsed. The main line is marked.
- **Tasks**: what the window shows today, unchanged: the task master's card, the starter chain, the ten quest cards with their claim buttons.
- **Diary**: 7.8.

The tracker line under the health bar keeps Stage 3's order and gains two entries after its first: the open starter quest; **the active main-line quest's stage; the active side quest's stage (the oldest)**; then Stage 3's discovered-region rule. A state with no story progress shows exactly what Stage 3's tracker tests pin.

### 7.4 Skills and loops (G6.4, G6.5)

Every recipe below is in `content.ts` and was checked against the 2.5 rule (`results.txt` section 2; worst case 2.50, and no forging recipe sells for less than its bars). Every new item's type is `resource`, `bar` or `ammo`, so the shop never sells a material (F6.7).

**Smithing: the four missing tiers (L4, Stage 3 F14).** Two new rocks on the existing rock mesh (the builder takes its colour from `oreColor`, `catalog.ts` 490-494):

| Rock | Mining | XP | Where |
|---|---|---|---|
| Coal Seam | 10 | 50 | Three rocks east of the plaza quarry, (106, -6), (108, -12), (104, 0); outside every camp. |
| Adamantite Vein | 40 | 210 | Only in the dungeons: three in Saltfang Warren's lair, one in the Underkiln. |

| Bar | Recipe | Smithing | Then, bars for weapon / legs / body | Forging levels |
|---|---|---|---|---|
| Steel Bar | 1 iron ore + 1 coal | 10 | 2 / 2 / 3 | 10, 12, 14 |
| Blacksteel Bar | 1 steel bar + 1 coal | 15 | 2 / 2 / 3 | 15, 17, 19 |
| Adamant Bar | 1 adamantite ore + 2 coal | 30 | 3 / 3 / 4 | 30, 32, 34 |
| Wyrmsteel Ingot | 1 runite bar + 1 Kilnglass Shard | 60 | 4 / 4 / 5 | 60, 62, 65 |

The outputs are the existing steel longsword, black scimitar, adamant scimitar and dragon scimitar with their platelegs and platebodies. Kilnglass comes only from the Underkiln's chest and boss and from nothing else, and it comes by chance (7.6): one shard is certain every clear and the rest are rolls, 2.2 a clear on average. Dragon gear by the forge needs 13 ingots: 6.4 clears on average, nine players in ten within 8, never more than 13 (`results.txt` 8b; CALL-6.25). The critique's finding that one clear gave the whole kit (M3) is closed by the owner's rule that a dungeon's rewards are drops. The shop still sells all of it at Stage 3's price (380,000 GP for the dragon kit).

**Crafting (new skill; L3).** Hides and cloth are drops, appended to the end of each monster's table so the order of earlier random draws does not change:

| Material | From (chance per kill) | Makes | Crafting | Kills for legs + body |
|---|---|---|---|---|
| Rough Hide | goblins 0.25 | Leather Vambraces, Traveler Boots | 1, 4 | 12 |
| Coarse Cloth | goblin archers 0.18 | Blue Wizard robe skirt and top | 6, 8 | 33 |
| Chitin Plate | king scorpions 0.09, Saltback Stalkers 0.20, Scree Skitters 0.06 | Green hide chaps and body (Ranged 20) | 18, 20 | 30 stalkers or 67 scorpions |
| Hexed Cloth | dark wizards 0.08 | Mystic robe bottom and top (Magic 20) | 20, 22 | 75 |
| Tough Hide | hill giants 0.10; Marrowjaw 3 | Blue hide chaps and body (Ranged 35) | 33, 35 | 60 |
| Cinder Silk | Cinder Adepts 0.10; Underkiln chest | Infinity bottoms and top (Magic 45) | 43, 45 | 60 |
| Mossed Hide | moss guardians 0.09 | Red hide chaps and body (Ranged 50) | 48, 50 | 67 |
| Slagscale Hide | Slag Brutes 0.10 | Black hide chaps and body (Ranged 60) | 58, 60 | 60 |

Three of each material make a piece (one and two for the gloves and boots). Station: a **tanner's bench**, one beside Qadir at (62, 68) and one in the start town at (8, 14), built from the existing `World_crate` and `World_barrel` nodes, with `action: 'bench'`. On the curve (`results.txt` section 4): 70 pieces made to reach Crafting 22, 147 to 35, 331 to 50, 584 to 60. A full hide or robe set at its level is 60 to 75 kills of the monster that fits it, against 19,500 to 187,000 GP at the shop. What the drops add to income at sale value is 10% to 24% of each monster's coins (section 3; chickens excepted, whose five feathers are worth 4 GP against 10); a test holds 25%.

**Runebinding (new skill; L1, L5, L7).** One Blank Runestone per bind, at any altar (the two altars gain a second menu entry, "Bind runes"; praying stays the default click):

| Runes | Per bind | Catalyst | Runebinding | XP |
|---|---|---|---|---|
| Air, Mind | 4 | none | 1 | 14, 15 |
| Water | 4 | none | 5 | 19 |
| Earth | 4 | none | 8 | 23 |
| Fire | 4 | 1 ashes | 12 | 30 |
| Chaos | 3 | 1 big bones | 26 | 55 |
| Law | 1 | 1 big bones | 34 | 80 |
| Death | 1 | 1 big bones | 44 | 100 |
| Blood | 5 | 1 dragon bones | 48 | 140 |

Each level sits about two levels under the Magic level of the first spell that needs the rune (fire bolt 12, ice burst 28, the blood spell 50). Runestone Outcrops (Mining 1, two rocks at (-44, -6) and (-48, -4), beside the woods road near Hesper Moth) give the stones. Bones now have a second use, so a player chooses between Prayer and runes with every bone: the first choice in the game between two skills for one resource. On the curve: 82 binds to reach 12, 321 to 26, 1,247 to 48. What it does to magic's cost, after the rebalance of 7.12 (half the damage, and half the runes for the two big spells): a kill with blood barrage at level 70 costs a caster 1,760 GP in bought runes and 603 GP in bound ones, against 715 GP of coins dropped; bound runes cost 129% of a kill's coins at 50, 99% at 60, 84% at 70. The best spell stays a real price, and the cheaper spells are the way to train: ice burst at 70 costs 15% of the kill in bound runes (`results.txt` 5b). Lesser demons drop the dragon bones the blood spell's runes need.

**Brewing: three Cooking recipes (L2, L5).** No new skill and no new station; they appear in the forge and range window beside the fish.

| Recipe | Inputs | Cooking | XP |
|---|---|---|---|
| Prayer Restore Vial | 1 Sting Gland (scorpions 0.10, stalkers 0.15, Matron Saltfang 3) + 2 ashes | 30 | 110 |
| Super Restore Elixir | 1 Mire Root (moss guardians 0.15) + 2 ashes | 55 | 220 |
| Hearty Stew | 1 cooked shark + 1 Mire Root | 60 | 260 |

Stage 4 gave food a job; this gives the potions a source and ashes two uses. Chickens gain a feather drop (5 at 0.8), so arrows can be made without the shop.

**Arrows: good ones and bad ones (L6, F6.5; CALL-6.8, decided by the owner on 2026-11-14).** The first draft made a better bow need a better arrow. The owner's answer: "Bows shoot arrows. Good ones and bad ones." So:

- **Any bow shoots any arrow, and any crossbow any bolt.** No bow is ever refused the arrows a player carries. `ammoForWeapon` keeps deciding only the kind (arrows for bows, bolts for crossbows, nothing for the three self-drawn bows), as it does today.
- **A better arrow hits harder.** Each grade adds to the max hit of the shot, with any bow:

| Grade | Added to the max hit | Shop price each | Made by (Smithing) | Made cost each, inputs at sale value |
|---|---|---|---|---|
| Bronze Arrow, Bronze Bolts (exist) | 0 | 8, 10 | exists (arrows) | |
| Iron Arrow | +2 | 18 | 1 iron bar + 15 shafts + 15 feathers makes 15 (level 20) | 5.0 |
| Mithril Arrow, Mithril Bolts | +4 | 36 | 1 mithril bar (+ shafts, feathers) makes 15 arrows or 12 bolts (40) | 9.8 |
| Rune Arrow, Rune Bolts | +6 | 60 | 1 runite bar makes 15 arrows or 14 bolts (60) | 35.8, 36.2 |

- **Which arrow is shot**: the best grade in the backpack. A player who wants to save the good ones leaves them in the bank. No setting, no saved field. The grades are one table in `src/data/items.ts`, `AMMO_GRADES` (`{ bronze_arrow: { of: 'bronze_arrow', power: 0 }, iron_arrow: { of: 'bronze_arrow', power: 2 }, ... , rune_bolts: { of: 'bronze_bolts', power: 6 } }`, the content file's `AMMO`): `of` is the id `ammoForWeapon` returns for the weapon, so "arrows" and "bolts" need no new field on any item row, and the two bronze rows stay as they are. `prepareAttack` picks the carried id with the highest power for that kind and returns it with its `power`; the engine passes that power to `playerAttackProfile` (7.12). **Second pass**: `performPlayerAttack` (`actions.ts` on `main`, lines 97-98) removes what a swing spends and only then computes the profile, so a profile that looked for the best arrow itself would shoot the last arrow of a grade at the next grade's power. The power therefore comes from `prepareAttack`'s result, not from a second look at the backpack (plan S3, S4).
- **The player who wants to save rune arrows for a boss** has to bank them before an ordinary fight, or they are shot first. The backpack cannot be reordered and has no quiver slot, so the only no-field rule is "best first". The alternative is the owner's (CALL-6.28): a quiver, the stack the player chose, kept in a new equipment slot.
- **What an existing ranger loses to this rule: nothing.** Bronze is today's arrow and adds 0. The existing quest `maple` still rewards a bow that shoots what the player has, and the frozen shortbow test (`tests/phase1.test.ts` 144-149) passes unedited. What an existing ranger does lose is damage, to the rebalance of 7.12, said there.

What a better arrow buys, at level 70 against a lesser demon (`results.txt` 5b): bronze, max hit 38, 61 GP a kill; iron, 40 (+5%), 131 GP bought or 36 made; mithril, 42 (+10%), 249 bought or 68 made; rune, 44 (+16%), 396 bought or 236 made, against 715 GP of coins. So grades are a way to spend for damage: a smith's iron and mithril arrows are worth shooting at everything, and rune arrows are for a boss. The same six points are worth more to a weak bow (a level-20 archer's max hit goes from 14 to 20 with rune arrows), at 60 GP a shot against monsters that drop about 100: nothing stops it and the price does not repay it.

**Where each style now stands** is 7.12: one band, three characters.

**What stays open, deferred in writing** (`results.txt` section 1, four items): salmon, anglerfish and the golden brew have no source but the shop, and bronze bolts no recipe. Each needs a new fishing spot or a new low-tier recipe and none blocks anything; they go to the list in 14.3.

**Unlock lines.** Stage 3's `unlocksAt(skill, level)` reads the recipe and node tables, so the new skills' unlocks print in chat at each level. Its `forgeHint` is described as finding `smith` and `fletch` recipes; it gains the kind `craft` and names the bench (plan K2), so a newly wearable hide or robe shows its recipe beside the shop price.

### 7.5 The roster (G6.7)

Six monster types, all rows with Stage 4's `model`, `tint`, `modelScale` and `pattern`. None drops equipment: a rare piece of equipment can come only from a dungeon chest (7.6). The meshes are placeholders: the later models pass rebuilds every figure as a skinned mesh and may rebuild any of these.

| Monster | Level | HP | Max hit | Attack | Defence | Style | Mesh, scale | Coins | Other drops |
|---|---|---|---|---|---|---|---|---|---|
| **Cinder Adept** | 52 | 80 | 17 | 49 | 36 | magic | dark wizard, 1.08 | 230 to 550 | big bones; Cinder Silk 0.10; 2 ashes 0.5 |
| **Slag Brute** | 58 | 112 | 19 | 54 | 48 | melee | hill giant, 1.12 | 340 to 770 | big bones; Slagscale Hide 0.10; shark 0.4 |
| **Scree Skitter** | 30 | 20 | 6 | 30 | 14 | melee | scorpion, 0.6 | 20 to 60 (0.6) | bones; Chitin Plate 0.06 |
| **Marrowjaw the Tollmaster** | 40 | 560 | 21 | 52 | 30 | melee | hill giant, 1.3 | 600 to 1,200 | big bones; 3 Tough Hide; 2 lobsters; 1 Runite Bar (1 kill in 8) |
| **Matron Saltfang** | 48 | 960 | 36 | 66 | 42 | melee | scorpion, 2.2 | 300 to 600 | big bones; 3 Sting Glands; 3 Adamant Bars (1 kill in 5) |
| **The Kiln Warden** | 80 | 2,000 | 64 | 110 | 72 | melee | moss guardian, 1.5 | 800 to 1,600 | dragon bones; 1 Kilnglass Shard (1 kill in 2); 1 Wyrmsteel Ingot (1 kill in 10) |

The Adept and the Brute take Stage 4's interpolation between the moss guardian and the lesser demon, with the caster's hitpoints and defence set below the line and the brute's above; their coins sit on the line by coins per hitpoint (moss guardian 4.49, Adept 4.88, Brute 4.96, lesser demon 5.72). The first draft's 275 to 645 paid the Adept 5.75 a hitpoint, a level-68 demon's rate at level 52, and made it the best income from 45 to 59 (critique H1). Patterns are Stage 4's: Adept "basic x3, Hexfall", Brute "basic x2, Overhead Slam, Rootquake", Skitter basics only.

**Overworld camps** (checked on the real world, `results.txt` section 6: every member on walkable ground, every reach circle fully open, clear of every other camp's leash, every safe zone, every path, every node and Ashmantle's arena margin):

| Camp | Where | Members | Why there |
|---|---|---|---|
| `cinder_circle` | South of the start town, east of the ridge, centre (-0.7, 72.7), 5.3 clear of Cinder Stair | 3 Cinder Adepts, aggressive | The ash has come out through the pass. Corin Ashby stands 25 units from its centre, 10 outside its leash. Stage 4 proposed the corner inside the ridge for these two; measured, that corner has no room left beside Ashmantle's arena, the old lair, the terrace and the shrine. |
| `brute_shelf` | Further south, centre (-2, 102) | 2 Slag Brutes, aggressive | Same strip, 1.4 clear of the Adepts' leash and 3 inside the south bound. |
| `tollmaster` | North of the start town, centre (4, -70), arena radius 9 | Marrowjaw alone | Open ground between the castle and the north edge, 7.5 clear of the nearest fishing spot. A one-member camp attacks only a hero who walks into its 5-unit circle; it keeps its sight (7.13), so it attacks at any level. |

**Model needs, recorded for the models pass.** Every one of these ships as a recoloured, rescaled existing mesh, and each is a known compromise:

| Monster | Ships as | Should become |
|---|---|---|
| Cinder Adept | dark wizard, ash-grey robe | a hooded caster with a brazier staff |
| Slag Brute | hill giant, basalt tint | a hunched, plated brute; today it is a recoloured hill dweller |
| Scree Skitter | scorpion at 0.6 | a small, fast body that reads at a glance in a group of eight |
| Marrowjaw | hill giant at 1.3 with war paint | a camp leader: banner pole, shoulder armour, taller than its camp |
| Matron Saltfang | scorpion at 2.2, salt-white | a brood mother: swollen abdomen, egg clusters, a wider stance |
| The Kiln Warden | moss guardian at 1.5, fired-clay tint | a furnace golem with an open, glowing chest; it must not read as the woods creature |
| The seven people | the humanoid rig, tunic colours | faces and silhouettes of their own; Odalys Venn's lantern staff |
| Dungeon rooms | boxes with the painted tiles, existing props | a wall, floor and door kit per dungeon |

Stage 4 wrote that the last three monster slots need a new model. They do; this stage ships them without one because the task allows it and the mechanics do not depend on it, and says so here.

### 7.6 Dungeons (G6.6)

**What a dungeon is.** A row in `DUNGEONS` (`src/data/dungeons.ts`):

```
Dungeon = {
  id, name,
  origin: [x, z], size,                 // a square of 1-unit cells, far outside the world
  door: { x, z },                       // in the overworld
  entry: [x, z],                        // local; the middle of the entry room, which is a safe zone of radius 6
  rooms: Record<roomId, [minX, minZ, maxX, maxZ]>,      // local rectangles: rooms and corridors
  gates: { id, rect, opensWhen: campId[] }[],           // shut cells that open when those camps are dead
  camps: { id, room, aggro, arenaRadius?, members: { type, x, z }[] }[],
  nodes: { type, x, z }[], chest: [x, z],
  loot: { run: { id, qty: [min, max] }[], runGp: [min, max], rare: { id, qty, chance }[] },   // every clear; nothing is paid once
  needs: Cond                           // a combat level, and a story quest done or at the stage that opens the door
}
```

**How it exists in the engine (6.4, option A).**

| Piece | Rule | Reuses |
|---|---|---|
| Space | Zones stand at x of 1000, z of -200 and +200 (critique C1). Stage 5's camera far plane is 460 and its horizon apron reaches radius 240; the nearest zone cell, less the camera's 26, is 734 from the apron (`results.txt` section 7 checks it). Only one zone exists at a time, so their 304 apart does not matter. While in a zone the engine hides the sky dome (it follows the camera) and the apron. Floor height is 0: `getTerrainHeight` returns 0 for x of 400 or more (one line; the terrain golden samples -130 to 130 and does not move). | `terrain.ts` 21; Stage 5's sky module |
| Walking | `zoneWalk(def, openGates)(x, z)`: inside a room rectangle and not inside a shut gate. `buildWalkGrid(walk, origin, originZ, size)` builds the zone's grid; with no arguments it builds today's. On entry the engine sets `G.walkGrid` to it; on leaving, back. The hero's step passes the grid's walk test to `moveWithCollision`, which does not clamp to ±118 when given one. | `pathfind.ts` 3-25; `context.ts` 217; Stage 4's walk-test parameter |
| Paths, clicks | Unchanged code on the swapped grid: A*, smoothing, "You cannot walk there." | `input.ts` 21-39 |
| Monsters | Zone camps are `CampDef` rows built from the dungeon row, with ids prefixed by the dungeon's (`saltfang_warren:nest`, so Stage 4's per-camp wind-up gate never mixes them with an overworld camp), and handed to `stepMonster` with the zone's grid, in place of `CAMPS`. `stepMonster` passes `world.grid.walkable` to its three movement calls (return, chase, wander), and `moveWithCollision` does not clamp when given a test: without both, a zone monster is put back at x 118 on its first step (critique C2). Territory, leashing, routes, wind-ups, the camp wind-up gate and aggression are the same rules as outside. Overworld monsters are not stepped while the hero is in a zone, and zone monsters are not stepped while it is outside. | `monsterAi.ts` 38-47, 125; Stage 4's 6.1 and 6.2 |
| Everything attacks | **No rule is added** (the first draft's CALL-6.18 is deleted). By 7.13 every aggressive camp attacks a hero of any level, and a dungeon contains aggressive camps. `zoneCamps` sets `keepsSight: true` on each, the field the pass sentries carry, so inside a dungeon a monster's sight does not shrink for a strong hero: "of course, in a dungeon everything attacks" (owner, 2026-11-14). | `sightRadius` (7.13); no dungeon branch in `stepMonster` |
| No respawn inside | `createMonsterLogic` gains a per-monster option `respawn: false`: such a monster goes from `dead` nowhere. Zone monsters use it. Stage 4's `respawnSecs` cannot do this: it is keyed by type, and stalkers, marksmen, Adepts and Brutes share their type with overworld camps (critique H3). A zone's resource nodes likewise give one gather a run and do not respawn, so a cleared lair is not an endless safe mine. | one option in `createMonsterLogic` and `stepMonster` |
| Bosses | A `BOSSES` row and a one-member camp with `arenaRadius`. Phases, the phase gate, the arena rule and "no damage from outside arena + 6" are Stage 4's. The lairs' corners lie 19.8 and 22.6 from the boss's home, past arena + 6 (16 and 18): a hero standing in a corner cannot hurt the boss, and the veins and the chest stand inside that distance (`results.txt` section 7). | Stage 4's 6.4 |
| Gates | When a camp's last member dies, `runStep(run, { campDead })` (pure, `src/state/dungeon.ts`) returns the gates that open; the engine rebuilds the zone grid (at most 12,544 cells) and removes the gate mesh. | new, about 60 lines |
| Seeing | A zone mesh built from the row: a floor plane per room with the existing painted tile, walls as flat-shaded boxes along every room edge that is not shared, a gate slab, and existing `world.glb` props by table. While inside, fog is dense and dark, and the sky dome and horizon apron are hidden (Stage 5's dome follows the camera, so distance alone does not remove it). The minimap draws the room rectangles. | `worldBuild.ts` builders; `overlay.ts` 25 |

**The rule set** (pure, `src/state/dungeon.ts`; state is a small `DungeonRun` value the engine holds, as it holds the hero's marks):

| Moment | Rule |
|---|---|
| Enter | `canEnter(state, def)` is `evalCond(state, def.needs)`. Then a new run: every zone monster alive at home, every gate shut, the chest shut. The hero appears at `entry` with the 3-second aggression grace. |
| Inside | The entry room is safe: while in a zone the engine computes `playerSafe` from `zoneSafe(def, x, z)` (within 6 of `entry`) or the grace, in place of the overworld's safe zones. Nothing respawns, monsters or nodes. Teleport spells and shrine travel work and count as leaving. |
| The chest | Opens only when the boss is dead. `openChest(state, def, rand)` pays the row's `loot`: the fixed part, the coins, and each rare entry rolled with `rand` at its chance, after rehearsing the backpack with what was rolled. If it does not fit, the chest stays shut, keeps the roll, and says so: nothing is lost by being full and a full backpack is not a way to roll again. Nothing is paid once (7.3). Then `clears` goes up by one, `clear:<id>` is counted, and `best` keeps the fastest run in whole seconds. |
| Leave | By the door in the entry room, by teleport, by dying, or by closing the page. The run is gone. Nothing of it is saved. |
| Death | Stage 4's rule, unchanged: a small share of experience or the vow; the hero wakes in the start town. |
| Reload | While the hero is in a zone, the autosave writes the dungeon's **door** as its position, not the zone coordinates. A reload therefore puts the hero outside the door with the run gone. No reader rule is needed and an older build loads the same save correctly (section 9). |
| Co-op later | A run is a value, and a zone is a row with an origin. A second party's copy is the same row at another origin with its own run. |

**The two dungeons** (geometry checked in `results.txt` section 7: every cell reachable with the gate open, the boss unreachable with it shut, every member inside its room, no room or corridor under 6 wide).

**Saltfang Warren.** A salt-crusted burrow under the dunes. Door at (106, 74), east of the gold rocks, 19 from the nearest node and outside every camp. Needs combat 50 and chapter 3 at the stage where Qadir opens it. 96 by 96 cells, 2,652 open, 22 monsters.

| Room | Size | Holds |
|---|---|---|
| Entry | 16 by 16 | Safe. The way out. |
| The Nest | 20 by 24 | 8 Scree Skitters: the swarm. Each is trivial; together they are eight blows a round. |
| The Gallery | 20 by 24 | 3 Saltback Stalkers and 2 Thornwatch Marksmen: melee in front, ranged behind. |
| The Brood Hall | 22 by 22, off the Nest | 6 Skitters and 2 Stalkers. |
| The Lair | 28 by 28, behind a gate that opens when all three rooms are dead | Matron Saltfang, arena radius 10; three Adamantite Veins; the chest. |

Chest and boss: the drop tables below. A fighter with every skill at 45 cuts through 1,638 hitpoints: 90 s of model fighting and 164 units of walking, 1.7 minutes in all, three to four for a person, and then the boss. The run pays 44.4 GP a second against 78.6 from moss guardians, the best open ground at that level, goods and every rare entry at its chance counted: 57% (CALL-6.5).

**The Underkiln.** An old kiln-works under Harrowback Ridge. Door at (-52, 46), at the ridge's foot inside the corner, 32 clear of Ashmantle's arena margin. Needs combat 72 and chapter 6 at the stage where Corin opens it. 112 by 112 cells, 3,020 open, 15 monsters.

| Room | Size | Holds |
|---|---|---|
| Entry | 16 by 16 | Safe. |
| The Ash Hall | 24 by 28 | 3 Cinder Adepts and 4 Skitters: casters with a swarm at their feet. |
| The Forge Floor | 24 by 32 | 3 Slag Brutes and an Adept. |
| The Ore Side | 16 by 12, off the Forge Floor, optional | 2 Brutes and an Adept guarding 2 runite rocks and an Adamantite Vein. |
| The Kiln | 32 by 32, behind a gate that opens when the Ash Hall and the Forge Floor are dead | The Kiln Warden, arena radius 12; the chest. |

Chest and boss: the drop tables below. 3,040 hitpoints, 112 s of model fighting with every skill at 70, 2.1 minutes with the walk. 89.1 GP a second against 178.5 from lesser demons, goods and rare entries counted: 50%.

**Drop tables: a dungeon is a dungeon (owner, 2026-11-14).** "A dungeon is a dungeon; sometimes you have to do it N times to drop a specific item." Dungeons stay repeatable with no lockout (CALL-6.5, decided), and what is special about them is a drop with a chance. Every entry is rolled on every clear (chest) or every kill (boss), with the injected random source (`results.txt` 8b):

| Source | Every time | By chance | A specific thing takes |
|---|---|---|---|
| **Saltfang Warren, chest** | 3 to 5 adamantite ore, 1 to 2 Tough Hide, 100 to 300 GP | Rune Crossbow, 5% | 20 clears on average; half of all players within 14, nine in ten within 45 |
| **Matron Saltfang** | big bones, 300 to 600 GP, 3 Sting Glands | 3 Adamant Bars, 20% | 5 kills on average |
| **The Underkiln, chest** | 1 Kilnglass Shard, 1 to 2 Cinder Silk, 500 to 1,000 GP | 3 more Kilnglass, 20%. Bloodbark Body, 4%. Bloodbark Legs, 4% (the robe worn at Magic and Defence 60). | One named robe piece: 25 clears on average, half within 17, nine in ten within 57. Both: 37 on average. |
| **The Kiln Warden** | dragon bones, 800 to 1,600 GP | 1 Kilnglass Shard, 50%. 1 Wyrmsteel Ingot, 10%. | |
| **Marrowjaw** (open ground, back every 180 s) | big bones, 600 to 1,200 GP, 3 Tough Hide, 2 lobsters | 1 Runite Bar, 12.5% | 8 kills on average |

| What the player is after | A clear gives | Clears: on average, half of players, nine in ten, at the very worst |
|---|---|---|
| Kilnglass for one dragon scimitar (4 ingots) | 2.2 on average, 1 for certain | 2.3, 2, 3, 4 |
| Kilnglass for the whole dragon kit (13 ingots) | the same | 6.4, 6, 8, 13 |

Three rules hold the tables in place. **A drop chance is a drop chance** (owner, 2026-11-14): no pity counter, no saved luck, ever. Each chest has ordinary base loot it always gives, as any monster always gives its bones: 3 to 5 adamantite ore in the Warren, one Kilnglass Shard in the Underkiln. That one shard is base loot, not a protection: it is also what makes chapter 6's last step ("Odalys takes 1 Kilnglass Shard") always possible after its chest step, and as a side effect the kit never takes more than 13 clears. Whether it stays certain is the owner's to confirm (CALL-6.25; pure chance with the same mean is computed there). Only the three equipment pieces and the extra shards are pure chance; the three pieces are also in the shop, and none is needed for anything. **Equipment comes only from a chest**, never from a monster's table, at no more than Stage 3's boss cap of 0.05. Stage 3's gear-drop test (`tests/economy-invariants.test.ts`, "every non-boss equipment drop chance is at most 0.02, and the boss's is at most 0.05") reads `MONSTER_TYPES` only, so it passes unedited but does not see a chest: the 0.05 cap on chest equipment is held by this stage's `dungeon-data.test.ts` (plan Z3). **The income bound counts every entry at its chance** (the ratios above).

Dungeons are short (F6.9). That is how fast this game kills, and stretching them with hitpoints would only be waiting. The boss is the content: 89 to 99 seconds for a prepared melee hero, about as long as everything before its door.

The income comparison gives both sides the same fighter and no rests: open ground pays per kill with 1.5 s to reach the next monster or the camp's shared respawn wait, whichever is longer (Stage 3's rule); the dungeon pays its monsters and its chest over the fights plus the walk. To hold it, the two dungeon bosses drop less coin than their level suggests (300 to 600 and 800 to 1,600) and the chests little (100 to 300 and 500 to 1,000). A test holds the ratio of the run's pay to the best open ground's under 0.9; it asserts that dimensionless ratio, never a time. The comparison takes open-ground monsters up to ten levels above the fighter's skills, since a fighter with every skill at 45 is combat 54 and fights level-52 Adepts.

### 7.7 Bosses: three questions (G6.7)

Each is a `BOSSES` row with `ATTACKS` rows, in Stage 4's shapes. No rule is written for any of them. Boss attacks deal sure damage inside the shape and add a mark, as Ashmantle's do.

| | Marrowjaw the Tollmaster | Matron Saltfang | The Kiln Warden | (Ashmantle, Stage 4) |
|---|---|---|---|---|
| Where | open ground, north | Saltfang Warren | the Underkiln | behind the pass |
| The question | **Do you step off the spot?** One shape at a time, long warnings. | **Can you keep up?** Its tempo rises each phase; it is won by ending it. | **Can you hold the band?** Far burns, near burns, a strip 3.4 to 6 units out is safe. | Which prayer, and in then out. |
| Basic | melee, max 21 | melee, max 36 | melee, max 64 | magic, max 72 |
| Back after death | 180 s | with the dungeon | with the dungeon | 120 s |

**Marrowjaw** (560 hitpoints, two phases).

| Phase | Health | Pattern |
|---|---|---|
| I. The Toll | to 50% | basic, basic, **Toll Slam** (circle of 3 at the hero, 1.8 s, power 26), basic |
| II. The Reckoning | to 0 | **Camp Sweep** (circle of 5 around itself, 1.9 s, power 30), Toll Slam, basic, basic |

**Matron Saltfang** (960 hitpoints, three phases, cadence 1.0, 0.9, 0.75).

| Phase | Health | Pattern |
|---|---|---|
| I. Stirring | to 60% | basic, basic, **Sting Arc** (cone 14 long, 50° half-angle, 1.6 s, power 40, melee), basic |
| II. Roused | to 30% | **Brine Spit** x2 (circle of 2.5 at the hero, 1.4 s, power 26, nothing cuts it), Sting Arc, basic, basic |
| III. Frenzy | to 0 | Sting Arc, Brine Spit x2, basic, Sting Arc, basic |

**The Kiln Warden** (2,000 hitpoints, three phases, the last at cadence 0.85).

| Phase | Health | Pattern |
|---|---|---|
| I. Banked | to 60% | basic, basic, **Hammer Arc** (cone 14 long, 60°, 1.8 s, power 56, melee), basic, **Kiln Ring** (ring from 6 to 20, 1.9 s, power 62, nothing cuts it) |
| II. Stoked | to 25% | Kiln Ring, **Core Vent** (circle of 3.4 around itself, 1.6 s, power 58, nothing cuts it), basic, Hammer Arc, basic |
| III. White Heat | to 0 | Kiln Ring, Core Vent, Hammer Arc, basic, Kiln Ring, Core Vent |

A melee hero at 2.9 stands inside the vent and outside the ring; a far hero stands inside the ring and outside the vent. Both must move to the same strip, from opposite sides. Its basics are melee where Ashmantle's are magic, so the two late bosses ask for different prayers.

**The fights, simulated** (`check-results.txt`; Stage 4's positional model, 2,000 seeded fights a row; fighters fixed, only boss rows tuned):

| Boss | Fighter | Bound | Wins and mean length, today's formula | With the rebalance of 7.12 |
|---|---|---|---|---|
| Marrowjaw | Melee 35, adamant, 10 lobsters, moves | at least 85% | 96.3%, 61 s | the same |
| | The same, 300 ms slower | at least 70% | 95.8% | the same |
| | The same, never moves | at most 25% | 0.0% | the same |
| | Melee 22, mithril, 8 trout, moves | at most 35% | 26.5%, 93 s | the same |
| | Ranged 35, moves | at least 85% | 99.9%, 26 s | 99.6%, 45 s (bronze arrows); 99.6%, 41 s (iron) |
| | Magic 35, moves | at least 85% | 100%, 22 s | 99.7%, 42 s |
| Matron Saltfang | Melee 50, rune, Protect from Melee, 16 swordfish, 2 vials | at least 85% | 99.4%, 89 s | the same |
| | The same, 300 ms slower | at least 65% | 81.3% | the same |
| | The same, never moves | at most 5% | 0.0% | the same |
| | The same, no food | (information) | 82.5% | the same |
| | Melee 38, adamant, no prayer, 10 lobsters (combat 46, below the door) | at most 15% | 10.4% | the same |
| | At the door: melee 41, rune, Protect from Melee, 12 lobsters, 1 vial (combat 51) | (information) | 96.3%, 101 s | the same |
| | Ranged 50, prepared | at least 85% | 100%, 45 s | 99.6%, 80 s (bronze arrows); 99.6%, 70 s (mithril) |
| | Magic 50, prepared | at least 85% | 100%, 34 s | 100%, 64 s |
| The Kiln Warden | Melee 70, dragon, Protect from Melee, 20 sharks, 4 vials | at least 85% | 96.7%, 99 s | the same |
| | The same, 300 ms slower | at least 65% | 95.6% | the same |
| | The same, never moves | at most 5% | 0.0% | the same |
| | The same, no prayer | (information) | 56.8% | the same |
| | Melee 55, rune, no prayer, 12 lobsters (combat 65, below the door) | at most 15% | 2.9% | the same |
| | At the door: melee 58, rune, Protect from Melee, 16 sharks, 2 vials (combat 72) | (information) | 77.3%, 157 s | the same |
| | Ranged 70, prepared, moves | at least 85% | 94.3%, 63 s | 87.3%, 116 s (bronze bolts); 89.1%, 102 s (rune bolts) |
| | Magic 70, prepared, moves | at least 85% | 99.3%, 58 s | 98.0%, 114 s |
| | Ranged 70 / Magic 70, never move | at most 5% | 0.0% / 0.0% | 0.0% / 0.0% |

Reading it. Every bound holds. The fighters' combat levels are 43 and 27 (Marrowjaw's melee rows), 62 (Saltfang's prepared melee; 54 for its ranged and magic rows) and 86 (the Warden's; 74 for ranged and magic). The doors are set under the prepared rows and above the under-levelled ones: a hero who has just reached the Warren's door with the prayer wins 96%; one who has just reached the Underkiln's, still in rune, wins three in four, and dragon gear and ten more levels make it sure. Marrowjaw's under-levelled bound is 35% on purpose, not Stage 4's 15%: it is the first boss a player meets, at hour three, and a careful level-22 character who dodges everything winning one fight in four is the right lesson. Saltfang's slower-hand row (81%) is the thinnest; the spit's 1.4 s is the lever if the trackpad check fails. **Every bound holds with the formula as it is today and as 7.12 leaves it, and no boss row was changed for the rebalance.** With today's formula ranged and magic end every fight in half the time, as in Stage 4; with the rebalance the Kiln Warden takes 99, 102 and 114 seconds in the three styles. Against the two earlier bosses ranged and magic are still about a third quicker (41 and 42 s against 61; 70 and 64 against 89): a melee hero loses time walking out of a shape and back, an archer does not, and levels 35 and 50 are where the ranged and magic ladders have just stepped up (7.12). The thinnest row after the rebalance is the Warden's ranged one (87.3% with bronze bolts, 89.1% with rune bolts, against 85%); the Kiln Ring's power is its lever. B1 and B2 are written before arrow grades exist, so their archers shoot bronze, before and after slice 6; B3 is written after it and gives its archer rune bolts. The plan ports these rows as tests with 500 seeds each (B1 to B3) and, because they hold on both sides, they are written once and are not edited when the rebalance slice lands; if a bound misses there, the boss row moves, never the bound.

**Matron Saltfang's question** (critique M4: it is the first boss's, faster). Looked at for this revision and left as it is, as an owner decision with a recommendation (CALL-6.22). A different question inside Stage 4's four shapes was tried in the model: her spit replaced by a ring that burns everything farther than 4.5 units, so that the fight asks the hero to stay on her. It does ask that of an archer or a caster (their rows held at 95 to 100%). It asks nothing of a melee hero, who already stands at 2.9: the melee fight got shorter and easier, and the under-levelled hero won 28 to 43% against a bound of 15%, so her health and max hit would need a new tuning for a change only two styles feel. So it is not cheap. The question that would be hers alone is a brood: eggs or hatchlings that must be dealt with while she is fought. That needs helpers in the boss room, which Stage 4's fight model cannot test and which the models pass (a brood mother with egg clusters, 7.5) is the natural moment for.

### 7.8 The diary (G6.8)

**Shape.** Five regions, three tiers, five tasks a tier: 75 tasks (`src/data/diary.ts`). A task is `{ id, text, done: Cond }` in the vocabulary of 7.2. Nothing about a task is saved: it is done when its condition is true. A tier is complete when its five are done, and its reward is claimed once; only the claimed tier ids are saved (`progress.diary`, at most 15 strings).

**Rewards.**

| Tier | Experience | Lasting perk in that region |
|---|---|---|
| Easy | a Faint Ember (1,000 XP in a skill the player picks) and 500 GP | none |
| Medium | a Steady Ember (7,500 XP) | **A deposit box at the region's shrine**: things can be put into the bank there, not taken out. In the start town, which has a bank: the home teleport costs no runes. |
| Hard | a Bright Ember (40,000 XP) | **A full bank at the region's shrine**: the deposit box becomes a bank. In the start town: the Lantern Vow costs a quarter less. |

**No perk touches aggression (owner, 2026-11-14).** The first draft's middle perk was "peace": a region's aggressive camps stopped attacking first, the four pass sentries included. The owner agreed to remove the reward that stopped the sentries, and with 7.13 the kind goes everywhere: an aggressive monster is aggressive, and a hero who has finished a region's middle tier outlevels its camps by more than ten levels anyway, so their sight is already at arm's length. The main session's suggestion for the volcanic corner was a bank at its shrine; checked against the hard tier, that would have given the volcanic middle tier what every other region gets only at the top, and left its own hard tier with nothing. The deposit box is the same comfort one step down, in every region, and the hard tier completes it. Behind the pass it is what a player with a backpack full of runite and dragon bones wants. The choice of the middle perk is the owner's (CALL-6.26).

An ember is an item (type `resource`, so it cannot be bought; it sells for 1 GP). Because the store's one-click "sell gathered goods" sells every `resource`, the bulk-sell match skips items with `lampXp`, and `buyItem` refuses them by that field as well as by type, so moving one guard never puts a 40,000-XP item on sale for 1 GP (critique H6). Using it opens a list of skills. It is not multiplied by the hidden 10x rate. All fifteen tiers pay 242,500 XP: put into one skill from nothing, that is level 58 (`results.txt` section 4). One hard-tier ember is about 33 minutes of a level-67 fighter's experience in one skill. The 2,500 GP of the five easy tiers is the only coin the diary pays. Perks are read from the claimed list by one pure function, `perks(state)`, at exactly three places: the teleport rune check, the shrine's menu (deposit box or bank), and Stage 4's `vowPrice`. None is in `stepMonster`. Stage 3's pacing model plays a state with no diary, so no perk reaches it.

**What the deposit box and the shrine bank need (second pass).** A little new engine and UI behaviour, no saved field. Today a shrine has one action, `worldmap` (`worldBuild.ts` on `main`, 180-185), and the context menu offers one option per interactive object (`input.ts` 300-305); so the shrine gets a second option, "Deposit" or "Bank", and `loop.ts` dispatches it to the existing bank window. The window gains a deposit-only mode that draws no withdraw buttons. The refusal itself is pure and in one place: `shrineTransfer(state, regionId, action, itemId, mode)` in `src/state/diary.ts` calls today's `deposit` or `withdraw` (`inventory.ts`) and refuses `withdraw` with a reason when `shrineBank(state, regionId)` is `'deposit'`. Bank capacity, stacking and the saved `bank` list are today's: a deposit at a shrine is the same deposit as at the bank, so nothing in the save or in the existing bank tests changes.

**The tasks.** Each row lists a tier's five. Level and place decide the tier: easy is what a visitor does, hard is what a resident has done.

| Region | Easy | Medium | Hard |
|---|---|---|---|
| Start town | Finish the starter chain or Lumbridge Foundations. Kill 10 goblins. Cook 5 fish. Smelt 5 bronze bars. Talk to Odalys Venn. | Finish chapter 1. Stitch Traveler Boots. Bury 25 bones. Complete 5 task-master tasks. Brew a Prayer Restore Vial. | Kill Marrowjaw. Hold a Lantern Vow. Reach Cooking 60. Complete 25 tasks. Carry 100,000 GP. |
| East plaza | Find the shrine. Kill 5 dark wizards. Mine 10 iron ore. Mine 5 coal. Talk to Tamsin Reeve. | Finish chapter 2. Forge a steel platebody. Kill 20 hill giants. Smelt 10 steel bars. Finish A Harder Edge. | Forge an adamant platebody. Kill 15 dark rangers. Reach Smithing 60. Kill 100 hill giants. Forge a rune platebody. |
| Dunes | Find the shrine. Kill 10 king scorpions. Mine 5 gold ore. Sell an item. Talk to Qadir Salt-Hand. | Finish Nothing Wasted. Work a green hide body. Kill 15 Saltback Stalkers. Clear Saltfang Warren. Mine 20 gold ore. | Clear the Warren 5 times. Smelt 10 adamant bars. Reach Crafting 50. Work a blue hide body. Mine 30 adamantite ore. |
| Woods | Find the shrine. Talk to Hesper Moth. Mine 10 Blank Runestones. Bind air runes 5 times. Catch a trout. | Finish Blank Stones. Bind fire runes 10 times. Chop 10 yew logs. Kill 10 Thornwatch Marksmen. Kill 5 moss guardians. | Finish chapter 4. Chop 25 magic logs. Bind blood runes 10 times. Reach Runebinding 50. Kill 50 moss guardians. |
| Volcanic corner | Talk to Corin Ashby. Find the shrine behind the pass. Kill a lesser demon. Mine runite ore. Kill 5 Cinder Adepts. | Finish chapter 5. Kill 10 Slag Brutes. Kill the old crag dragon. Smelt 5 runite bars. Kill 25 lesser demons. | Clear the Underkiln. Kill Ashmantle. Forge a dragon platebody. Finish Ashfall. Clear the Underkiln 5 times. |

Every system of the game appears at least once: each gathering skill, both crafts, brewing, binding, the forge's new tiers, the task master, the vow, the shop, both dungeons, all four bosses, every chapter. A data test checks that (plan Y1): each stat family and each new skill is read by at least one task.

**Interface.** The third tab of the log window: a row of five region buttons, and for the chosen region three tier panels, each with its five tasks ticked or not, counts where a task has one, the reward, and a claim button that is live when all five are done and the ember fits the backpack.

### 7.9 What Stage 6 inherited, resolved here

The full ledger is section 12. The designs that are not obvious:

**Save recovery (four debts: three from the Stage 1 review, one from Stage 3's section 8).** Today a corrupt main save is copied to one backup key if that key is empty, the copy is not guarded, the legacy keys are not tried, and the autosave writes a new game over the main key two seconds later (`save.ts` 176-190, `session.ts` 43-52). The same happens when `applyState` throws on a save that parsed. One mechanism answers all four:

- **Hold.** When `readSave` reports `corrupt`, or `applyState` throws, the session sets a hold flag: `saveGameState` returns without writing while it is set. The broken save stays in the main key, untouched, for as long as the page is open.
- **Ask.** A blocking notice (Stage 5's modal) says the save could not be read and offers: **Start a new game** (keeps a copy first); **Load the older save from this browser**, shown only when a legacy key parses, with its coin and total level so the player can tell what it is; **Copy the save text**, which puts the raw string on the clipboard or in a selectable box.
- **Keep three.** Every button that releases the hold (start a new game, load the older save) first makes sure the raw string is kept (critique H5: when `applyState` threw, `readSave` copied nothing, and when `_corrupt` already held an earlier copy it copied nothing either): if `_corrupt` already holds it (the first time, `readSave` put it there), nothing moves; otherwise `_corrupt_2` goes to `_corrupt_3`, `_corrupt` to `_corrupt_2`, and the raw string to `_corrupt`, each write in its own `try`. If the newest write fails (storage full), the two older copies are removed and it is tried once more; if it still fails, the notice says the copy could not be kept and asks again before anything is overwritten. A raw save over 256 kB is not copied and the notice says so.
- Then the hold is released, and only then. "Copy the save text" does not release it.

`readSave` behaves exactly as its Stage 1 tests pin it (it still copies the raw string to `_corrupt` when that key is empty, and still does not read the legacy keys), plus a `try` around that one write. The rotation and the legacy preview are separate pure functions over `StorageLike`, tested with the in-memory store, and run only when the player chooses. No Stage 1 test changes.

**A boss's respawn timer (Stage 4).** `progress.bossDownUntil[typeKey]` holds the wall-clock time, in milliseconds, at which an overworld boss is back. It is written when Ashmantle or Marrowjaw dies and removed when it returns. On load a value is kept only for a type with a `BOSSES` row and an overworld camp, and is clamped to at most `now + respawnSecs`: a hostile or clock-skewed save can delay a boss by one respawn, never more. Dungeon bosses need none: they return with the run. In a session, an overworld boss's timer is not stepped while the hero is in a dungeon, while the saved one runs on the wall clock; the boss may therefore return a little later than a reload would make it. Accepted (critique L3).

**Food that matters (Stage 3).** Stage 4 did it (cooldown, regeneration rates). This stage adds what was missing around it: potions and the stew can be made, and a boss fight is where they are spent (Saltfang without food: 99% falls to 83%).

**The giants plateau (Stage 3 F12).** After Stage 4's two monsters and this stage's Adept (52), Brute (58), the Warren (30 to 48) and Marrowjaw (40), a fighter has something of its own level at 28, 34, 38, 40, 45, 48, 52, 58 and 68. The pacing test's printed table will show where the model's fighter goes; nothing asserts it.

**Quests that lead the first hour (Stage 3).** Bran Tolley and chapter 1.

### 7.10 New names (CALL-6.9)

All original proposals; 82 names, none with a deny-listed token, all distinct (`results.txt` section 9). A person searches each before merge.

| Kind | Names |
|---|---|
| People | Bran Tolley, Odalys Venn, Pell Greaves, Tamsin Reeve, Qadir Salt-Hand, Hesper Moth, Corin Ashby |
| Skills | Crafting, Runebinding |
| Main line | The Failing Wards (the line): The Guttering Wards, Iron for the East Lamp, Salt on the Wind, What the Hollow Keeps, The Held Pass, Under the Ridge, Ashfall |
| Side quests | Nothing Wasted, Blank Stones, A Harder Edge, The Fourth Kettle, A Vow Kept, The Tollmaster's Due |
| Monsters | Cinder Adept and Slag Brute (Stage 4's), Scree Skitter, Marrowjaw the Tollmaster, Matron Saltfang, The Kiln Warden |
| Dungeons | Saltfang Warren, The Underkiln |
| Attacks and phases | Toll Slam, Camp Sweep, Sting Arc, Brine Spit, Kiln Ring, Core Vent, Hammer Arc; The Toll, The Reckoning, Stirring, Roused, Frenzy, Banked, Stoked, White Heat |
| Titles | Tollbreaker, Warrenbreaker, Kilnbreaker, Wardkeeper |
| Nodes | Coal Seam, Adamantite Vein, Runestone Outcrop |
| Items | Coal, Adamantite Ore, Steel Bar, Blacksteel Bar, Adamant Bar, Kilnglass Shard, Wyrmsteel Ingot, Rough Hide, Coarse Cloth, Chitin Plate, Hexed Cloth, Tough Hide, Cinder Silk, Mossed Hide, Slagscale Hide, Blank Runestone, Sting Gland, Mire Root, Iron Arrow, Mithril Arrow, Rune Arrow, Mithril Bolts, Rune Bolts, Faint Ember, Steady Ember, Bright Ember |

Generic words shared with other games (Coal, Steel Bar, Crafting, Rune Arrow) are in by the owner's rule. Five recipe names repeat the borrowed word of the existing item they make ("Forge Dragon Scimitar", "Sew Wizard Robe Top"); those items keep their names. The name test for this stage is a new file with the same deny-list, over every new table; `tests/names.test.ts` is not edited.

### 7.11 Module boundaries

| Module | Change |
|---|---|
| `src/data/npcs.ts`, `dialogue.ts`, `story.ts`, `diary.ts`, `dungeons.ts` (new) | Tables and types only. |
| `src/data/catalog.ts` | `SKILLS_META` gains `crafting` and `runebinding`. Nothing else. |
| `src/data/extras.ts`, `world.ts`, `recipes.ts`, `placements.ts`, `worldMap.ts`, `attacks.ts` (Stage 4) | 26 items; 6 monster rows and the appended drops; 3 node rows; 49 recipes and `kind` gaining `'craft'` and `'bind'`; 5 node placements; 3 camps; 7 attacks and 3 boss rows. |
| `src/data/items.ts` | `ammoForWeapon` unchanged (it names the kind: the id `bronze_arrow` or `bronze_bolts`). New: the table `AMMO_GRADES` (seven ids, each `{ of, power }`, 7.4) and `bestAmmo(state, of)`. No item row gains a field (second pass: the first wording put a number on the five new rows and, in 14.2, on seven). |
| `src/state/combat.ts`, `src/data/magic.ts`, `src/data/catalog.ts` | The three style constants and an `ammoPower` parameter in `playerAttackProfile`; `prepareAttack` spends the best arrow carried and returns its power; two rows of `RUNE_COSTS`; the `desc` text of the four combat spells, which loses its "Max Hit" figure (7.12). |
| `src/engine/actions.ts` | `performPlayerAttack` passes `prepareAttack`'s arrow power to `playerAttackProfile` (7.4, second pass). |
| `src/data/worldMap.ts` | `CampDef.keepsSight?: boolean`, set on `pass_sentries` and the boss camps (7.13). |
| `src/state/progress.ts` (new) | The `Progress` type, `STAT_KEYS`, `bump`, `normalizeProgress` (the reader), `perks`. |
| `src/state/dialogue.ts`, `story.ts`, `dungeon.ts`, `diary.ts` (new) | `evalCond`, `openDialogue`, `chooseOption`; `advanceStory`, `finishQuest`, `journalView`, `useEmber`; `zoneWalk`, `canEnter`, `runStep`, `openChest`; `diaryView`, `claimTier`. All pure; time and randomness are parameters. |
| `src/state/saveRecovery.ts` (new) | `rotateCorrupt`, `legacyPreview`. |
| `src/state/types.ts`, `gameState.ts`, `save.ts` | `GameState.progress?`; `applyState` and `cloneState` carry it; `serializeState` writes it when it is not empty; `migrateLegacySave` reads it through `normalizeProgress` and accepts story ids as claimed. |
| `src/state/adventure.ts`, `quests.ts`, `recipes.ts` (data), Stage 4's `sustain.ts` | One `bump` call each in `registerKill`, `noteGather`, `noteBury`, `tryCraft`, `buyVow`, `applyDeathLoss`. `QUEST_DEFS`, `STARTER_QUESTS`, `questView`, `claimQuest` are not edited, except the tracker's two new entries. |
| `src/state/pathfind.ts`, `collision.ts`, `terrain.ts`, `monsterAi.ts` | Grid origin and size; no clamp with a walk test; zone floor; in `monsterAi`, beyond what Stage 4 adds: `sightRadius` (exported, pure) in place of the threat-colour test in the acquisition rule (7.13), the walk test in the three movement calls, and the per-monster `respawn` option. |
| `src/state/commands.ts` (Stage 4) | New commands: `talk`, `choose`, `claimTier`, `useEmber`, `enterDungeon`, `leaveDungeon`, `openChest`; all pure appliers. |
| `src/engine/zones.ts` (new) | Zone mesh, enter and leave, the grid swap, fog. |
| `src/engine/worldBuild.ts`, `spawns.ts`, `loop.ts`, `input.ts`, `actions.ts`, `overlay.ts`, `session.ts` | People, benches and doors from tables; zone spawns; the `talk`, `bench`, `altar` menu and `door` cases; which monsters are stepped; the minimap in a zone; the door as saved position; the save hold and notice. |
| `src/ui/dialogue.ts`, `journal.ts` (new), `stations.ts`, `playerActions.ts`, `hud.ts`, `index.html`, `styles.css` | The dialogue panel; the journal and diary tabs; the recipe window filtered by station; the ember's skill list; fourteen skills in the skills tab; the recovery notice. |
| `README.md` | Quests, skills, dungeons, bosses, diary; the monster table. |

`src/state` and `src/data` still import nothing from the engine (the architecture test stays).

### 7.12 The three styles: a rebalance (G6.13; owner, 2026-11-14)

**Decided.** The first draft kept ranged and magic about twice as fast as melee and gave each a price (CALL-6.7). The owner answered: "Let's structure the rebalancing, no problem." So the damage changes, and this section is the structure: the target, the numbers that move, the table before and after, and what it does to everything already proven. The numbers themselves are the owner's to approve (CALL-6.24).

**What was wrong, measured** (`results.txt` 5a, 5b). At every level from 20 up, ranged deals 1.7 to 2.1 times melee's damage per second and magic 2.1 to 2.7 times. The first draft said magic "pays for it". That was true only of its dearest spell: a level-70 caster using the level-12 spell deals 1.6 times melee's damage for 12% of a kill's coins. Two causes, both in the formula of `playerAttackProfile` and not in any one item:

- **Ranged**: a point of ranged bonus adds 0.22 to the max hit, the same as a point of melee strength bonus, but ranged gear carries 2.3 times as many points (188 against 81 in the level-70 kits).
- **Magic**: the spell's own number, the level term and the gear term each add as much as melee's whole max hit.

**The target.** From level 20 to 70, with the standard kit of the level (the best ordinary weapon, body and legs; special sets left out), against a monster of the level:

| Style | Damage per second, as a share of melee's | Its character |
|---|---|---|
| Melee | 1.00 (not touched) | Free to use, the most armour (defence 141 against 113 and 111 at level 70), has to stand next to the monster. |
| Ranged, with the arrow of its level | 0.9 to 1.35 | Pays by the arrow, hits from 13.5 units away so the first blows are free while a monster walks in, less armour. A dearer arrow buys more damage. |
| Magic, with the best spell of its level | 0.95 to 1.4 | Pays the most, in runes. The burst style: its best spell is the fastest thing in the game and heals, and no kill repays it. Cheaper spells are slower than melee. |

and the fastest of the three is never more than 1.4 times the slowest (today: up to 2.68). **Second pass: that holds at the six decade levels, which is where the first table looked; checked at every level from 20 to 70 it fails at one, level 28**, where the fastest is 1.43 times the slowest (1.48 with every slot filled, at 28 and 29): ice burst opens at Magic 28, two levels before the Magic-30 staff and the Attack-30 adamant scimitar (`second-pass-results.txt` A). Everywhere else from 20 to 70 the standard kit stays inside: ranged 1.05 to 1.34 of melee, magic 0.96 to 1.35. From 71 to 99 it holds with room: at most 1.22 with the standard kit, 1.19 with the special sets, where melee becomes the fastest. So the target as the owner reads it is "at most 1.4 at every level from 20 to 70 except the two levels between ice burst and the rune-tier staff"; the band test asserts the decades and a ceiling of 1.45 at every level (plan S1), and CALL-6.24 asks the owner whether the one exception is acceptable. The band is as wide as it is because the three gear ladders step up at different levels (a new spell at 28 and 50, rune at 40, dragon at 60); no formula removes that, and the best fit of three free numbers per style has the same spread (1.24 to 1.29) as the choice below.

**The numbers that change.** Three in the formula, four rune counts, the four combat spells' description strings (below), and nothing in any item row:

| Number | Today | After | Where |
|---|---|---|---|
| Ranged: what a point of ranged bonus adds to the max hit | 0.22 | **0.06** | `playerAttackProfile`, the constant `RANGED_GEAR` |
| Ranged: the base of the max hit | 2 | **3** | the constant `RANGED_BASE`. Without it a level-10 archer, who has one bow and no armour, falls to three quarters of melee. |
| Magic: the whole max hit is multiplied by | 1 | **0.5** | the constant `MAGIC_DAMAGE` |
| Ice burst: runes a cast | 2 water, 2 chaos | **1 water, 1 chaos** | `RUNE_COSTS` in `src/data/magic.ts` |
| Blood barrage: runes a cast | 2 blood, 2 death | **1 blood, 1 death** | the same table |

The formulas after, written out (prayer multipliers where they are today; accuracy, the hit chance, the 0.6 s swing, experience per point of damage and every monster number unchanged):

```
ranged  max hit = max(2, floor((3 + 0.35 x Ranged + 0.06 x ranged bonus + arrow power) x prayer))
magic   max hit = max(3, floor((spell + 0.22 x Magic + 0.18 x magic bonus) x 0.5 x prayer))
melee   max hit = max(2, floor((1.5 + 0.32 x (Strength + style) + 0.22 x strength bonus) x prayer))     unchanged
```

Why these and not sixty item rows: the gap is in how the formula values a style's points, so it is fixed there; every bow, hide, staff, robe and spell keeps its place in its own ladder, and every item keeps its numbers. Why magic also gets cheaper casts: at half the damage a kill takes twice the casts, so without it the two big spells would cost twice what they cost today (blood barrage five times what a kill pays). With one rune of each kind a kill with them costs what it costs today. Wind strike and fire bolt already take one or two cheap runes and cannot be halved: a kill with them costs twice today's, which from level 20 up is 4 to 19% of the kill's coins in bound runes.

**The table** (`results.txt` 5a; damage per second, and "x" is times melee):

| Level | Melee | Ranged today | Magic today | Ranged after, bronze arrows | Ranged after, arrow of its level | Magic after, best spell | Fastest over slowest, today, after |
|---|---|---|---|---|---|---|---|
| 1 | 2.4 | 3.8 (x1.57) | 11.8 (x4.83) | 3.2 (x1.30) | 3.2 (x1.30) | 5.7 (x2.31) | 4.83, 2.31 |
| 10 | 5.5 | 6.0 (x1.09) | 12.5 (x2.27) | 4.8 (x0.86) | 4.8 (x0.86) | 6.0 (x1.09) | 2.27, 1.26 |
| 20 | 9.8 | 18.5 (x1.90) | 24.0 (x2.46) | 10.4 (x1.07) | 10.4 (x1.07), bronze | 12.1 (x1.23) | 2.46, 1.23 |
| 30 | 13.0 | 21.7 (x1.67) | 34.8 (x2.68) | 13.1 (x1.00) | 14.5 (x1.11), iron | 17.1 (x1.31) | 2.68, 1.31 |
| 40 | 17.2 | 30.0 (x1.74) | 35.7 (x2.08) | 17.6 (x1.02) | 19.0 (x1.11), iron | 17.5 (x1.02) | 2.08, 1.11 |
| 50 | 19.3 | 40.3 (x2.09) | 50.0 (x2.59) | 22.0 (x1.14) | 24.9 (x1.29), mithril | 24.7 (x1.28) | 2.59, 1.29 |
| 60 | 26.0 | 46.4 (x1.78) | 59.0 (x2.27) | 25.4 (x0.98) | 28.3 (x1.09), mithril | 29.2 (x1.12) | 2.27, 1.12 |
| 70 | 27.7 | 48.1 (x1.73) | 59.8 (x2.16) | 27.3 (x0.98) | 31.6 (x1.14), rune | 29.6 (x1.07) | 2.16, 1.14 |

At the decades from 20 to 70 after: ranged 1.07 to 1.29 of melee, magic 1.02 to 1.31, the fastest at most 1.31 times the slowest; between the decades, level 28 reaches 1.43 (above). With bronze arrows only (what the band test can assert before arrow grades exist) ranged stays at 0.95 to 1.19 at every level from 20 to 70. Levels 1 and 10 are outside the target and shown for honesty: at level 1 the first staff and robe have no level requirement and are priced as a mithril-tier kit, so a new caster who could afford them (6,400 GP) still hits twice as hard as a new swordsman; at level 10 an archer has one bow and no armour until 20, is slower than melee (0.86) and pays 96% of a scorpion's coins in arrows (156% of a goblin's at level 1, `results.txt` 5b). The second pass recomputed every row of this table independently from `origin/main`'s `playerAttackProfile` and item table and found the same values to two decimals (`second-pass-results.txt` A).

**What a kill costs** (`results.txt` 5b; share of the coins the monster drops; "made" prices an arrow or rune at what its inputs sell for):

| Level | Melee | Ranged today | Ranged after, bronze bought | Ranged after, arrow of its level: bought, made | Magic today, best spell: bought, bound | Magic after, best spell: bought, bound |
|---|---|---|---|---|---|---|
| 20 | 0 | 20% | 36% | bronze: 36% | 37%, 10% | 74%, 19% |
| 30 | 0 | 17% | 28% | iron: 57%, 16% | 120%, 34% | 123%, 35% |
| 40 | 0 | 11% | 19% | iron: 40%, 11% | 109%, 31% | 111%, 32% |
| 50 | 0 | 7% | 14% | mithril: 54%, 15% | 371%, 127% | 376%, 129% |
| 60 | 0 | 6% | 11% | mithril: 43%, 12% | 285%, 98% | 288%, 99% |
| 70 | 0 | 5% | 9% | rune: 55%, 33% | 243%, 83% | 246%, 84% |

Reading it. Melee pays nothing. A ranger pays 9 to 36% with bought bronze arrows, about one and a half times today's share, because a kill takes more arrows; one who smiths the arrow of the level pays 11 to 16% up to mithril and a third of the kill for rune arrows, which are 16% faster than bronze: an arrow for bosses, not for every kill. A caster's best spell costs what it costs today. And a caster now has a real choice at every level (`results.txt` 5b, "every spell"): at 70, fire bolt is 0.81 of melee for 7% of the kill in bound runes, ice burst 0.91 for 15%, blood barrage 1.07 with its healing for 84%. Today the same three are 1.61, 1.85 and 2.16.

**What it does to gear an existing character owns.** Nothing is removed from a save, no item changes a number, a name or a requirement, and nothing a character wears is unequipped. What changes is what the formula makes of it:

- **Every bow and crossbow hits less**: the max hit of the level-20, 40 and 70 kits goes from 25, 41 and 67 to 14, 26 and 44 with the arrow of the level. Ranged armour (hides) adds a quarter of the damage it added; its defence and its accuracy are unchanged.
- **Every staff, robe and combat spell hits half as hard**: 32, 49 and 83 become 16, 24 and 41.
- **Nothing melee changes**: no sword, no armour, no kill time.
- **Training a bow or a staff is slower**, because experience is paid per point of damage (`results.txt` 5e): Ranged experience per hour of fighting falls by 33 to 44% with the arrow of the level (44% at level 20, where the arrow of the level is bronze) and 40 to 45% with bronze arrows; Magic experience by 35 to 38% (less than its damage, because part of a cast's experience is the spell's own). A level-70 archer still earns more per hour (455k with rune arrows) than a swordsman puts into one skill (399k). No experience value is edited.
- **Said plainly in the second pass, because the first list left them out:** Hitpoints experience is 1.5 a point of damage in every style (`actions.ts` on `main`, line 196), so a ranger or caster also trains Hitpoints 34 to 50% slower. Coins per hour from fighting fall by the same share as damage per second for those two styles (kills per hour), before the dearer arrows: a level-70 archer kills 34% slower with rune arrows, a caster with blood barrage 50% slower. A kill takes longer, so a ranger or caster stands under attack longer per kill and eats more food. Blood barrage heals a quarter of the damage it deals (`actions.ts` 186-189), so its healing per cast halves too.
- The four combat spells' descriptions print a "Max Hit" figure (6, 13, 22, 34) that was never the real max hit and would now sit beside half the damage. S2 rewrites those four strings without the figure; no test pins them.
- Ice burst and blood barrage cost half the runes a cast. A stack of runes a character holds lasts as many kills as before with those two spells and half as many with the two small ones.
- Special sets and uniques are in the same formula. With the best of them at levels 80 and 90 ranged ends at 0.89 to 0.93 of melee and magic at 0.84 to 0.85 (today 1.55 to 1.72): the top melee unique out-scales the others (`results.txt` 5c; the second pass, against the dragon rather than the demon, gets 0.90 to 0.94 and 0.84 to 0.87 up to 99). The fastest over the slowest stays at most 1.19 from 71 to 99, so the 1.4 bound holds there too. Stated, not tuned: those items are outside this stage.

**What it does to everything already proven with numbers.**

| Proof | Effect | Evidence |
|---|---|---|
| Stage 3's pacing test (kill counts) | **None.** Its fighter is melee. | The melee column is checked identical in `results.txt` 5a; `playerAttackProfile`'s melee branch is not edited. |
| Stage 3's `combat-profile` and `entry-staff` tests | **Six pinned values change**: declared replacements 10 and 11 of 11.3, with the new values (`results.txt` 5d). | The shortbow at level 1: 5 to 4 (with Sharp Eye 7 to 5). The fire staff: wind strike 10 to 5, fire bolt 17 to 8, with Mystic Might 12 to 6. The starter staff's wind strike: 6 to 3, which is the bronze sword's max hit. |
| Stage 2's gate simulation | **None.** It rolls the sentries' hits on the hero; the hero does not attack. | 7.13 |
| Stage 4's boss rows (Ashmantle, approved; its row is not touched) | **Every threshold holds with both formulas, and with bronze arrows as well as the arrow of the level.** Prepared ranged wins 98.5% (was 98.5%) in 93 s (was 61 s), or 97.5% in 108 s with bronze bolts; prepared magic 99.6% (was 100%) in 93 s (was 47 s); melee 98.9% in 103 s, unchanged. The unprepared level-50 ranged and magic heroes fall from 1.8% and 9.2% to 0.3% and 0.9%. | `check-results.txt`, last block: all sixteen rows, three columns |
| This stage's boss rows | **Every bound holds with both formulas**, with no boss row changed. | 7.7 |
| The dungeon income bound, the 2.5 rule, drops | **None**: they use the melee fighter and sale prices. | `results.txt` 2, 8 |

So the half-the-time kills are gone: against Ashmantle the three styles now take 103, 93 and 93 seconds. A fight test written before the arrow grades exist gives its archer bronze arrows, and keeps doing so afterwards; that column is run too and holds. Because every fight bound holds on both sides of the change, with either arrow, no boss test depends on when the rebalance lands; that is what frees its place in the order of work (14.1).

**In code** (plan slice 6): three named constants in `src/state/combat.ts` read by `playerAttackProfile`; the power of the arrow being shot, handed in by `prepareAttack`; two rows of `RUNE_COSTS`. One test file holds the band: at levels 20 to 70 in steps of 10 it builds the three standard kits from the item table by the stated rule and asserts the two shares and the fastest-over-slowest bound of the table above, and at every level from 20 to 70 it asserts the fastest at most 1.45 times the slowest (the measured worst is 1.43 at level 28) and prints the row. It is written with bronze arrows (ranged 0.95 to 1.19 then, inside its share), and the arrow test of slice 6 asserts the same band with the arrow of the level once grades exist. If a later stage adds gear that breaks the band, that test names the level.

**Where it lands, and who approves it there.** Slice 6, as 14.1 says. The numbers above are the lead's; the owner approves them twice: once with the design (CALL-6.24), and once more just before S1, on the band table that R0's rerun of the model prints against the merged code (plan O-6.6). If that table differs from the one here, nothing is built until the owner has seen it.

### 7.13 Aggressive and passive monsters (G6.14; owner, 2026-11-14)

**Decided.** The owner replaced Stage 2's rule (a camp attacks only a hero whose combat level is not above the monster's) with a simpler one, in their words: "wouldn't it be enough to have aggressive and passive monsters? The aggressive ones attack by default on seeing a player, the passive ones don't. A World of Warcraft feel as well." Confirmed with these details: an aggressive monster attacks on sight whatever the hero's level; a passive one never starts a fight; the sight radius shrinks as the hero outlevels the monster, down to about strike range; the pass sentries are exempt from the shrink; and "of course, in a dungeon everything attacks". This replaces Stage 2's rule for the whole game.

**The rule.** A camp is aggressive or passive: that is the existing `aggressive` field of `CampDef`, and no row changes (the hen yard and Three Kettle Camp stay the two passive camps). An idle member of an aggressive camp acquires a hero who is not down, not safe (a safe zone or the 3-second grace), inside the camp's circle, and within the monster's **sight radius**:

```
sightRadius(base, monsterLevel, heroCombat, keepsSight):
  if keepsSight                      -> base
  over = heroCombat - monsterLevel
  if over <= 0                       -> base
  if over >= SIGHT_GAP               -> min(base, SIGHT_MIN)
  otherwise                          -> base - (base - min(base, SIGHT_MIN)) x over / SIGHT_GAP
```

| Input | What it is |
|---|---|
| `base` | The camp's `aggroRadius`: 9 for melee monsters, 12 for ranged and magic, as today. |
| `monsterLevel`, `heroCombat` | The monster's level and the hero's combat level, the two numbers Stage 2's rule compared. |
| `keepsSight` | **Data on the camp** (`CampDef.keepsSight?: boolean`): the camp never shrinks. Set on `pass_sentries`, on the boss camps `ashmantle` and `tollmaster`, and by `zoneCamps` on every dungeon camp. |
| `SIGHT_MIN` = 3 | About a melee strike (2.9). A hero far above a monster is attacked only from arm's length: by walking into it, or when it wanders up to a hero who is standing still. The same minimum for archers and casters, or a strong hero would still be shot at from 11 units by weak ones. |
| `SIGHT_GAP` = 10 | Combat levels above the monster at which the minimum is reached. A straight line between. |

| Hero's combat level minus the monster's | 0 or less | 1 | 2 | 4 | 5 | 6 | 8 | 10 or more |
|---|---|---|---|---|---|---|---|---|
| A melee camp sees at | 9.0 | 8.4 | 7.8 | 6.6 | 6.0 | 5.4 | 4.2 | 3.0 |
| A ranged or magic camp | 12.0 | 11.1 | 10.2 | 8.4 | 7.5 | 6.6 | 4.8 | 3.0 |
| Sentries, bosses, dungeon camps | 9.0 | 9.0 | 9.0 | 9.0 | 9.0 | 9.0 | 9.0 | 9.0 |

It is a pure function of four values, in `src/state/monsterAi.ts` (with `SIGHT_MIN` and `SIGHT_GAP`; nothing else is exported for it), written first as `docs/superpowers/research/content-model/aggro.ts` and checked there (`aggro-results.txt` 1): never wider than `base`, never under the minimum, never growing with the hero's level, full at or below the monster's level, flat from ten levels above, and constant for a camp that keeps its sight. Everything else about a monster is Stage 2's and Stage 4's: fighting back when hit, the leash, the return home, the safe-zone rule, the grace, routes, wind-ups. The threat colour of a monster's name (`monsterThreatColor`) stays as the label it is; it no longer decides anything.

**Why ten levels.** Combat level runs about ten ahead of a fighter's skills (F6.10), so with a gap of 10 a hero whose skills equal a monster's level is seen only at arm's length, and a hero whose skills are ten under it is seen in full. That keeps open ground close to what Stage 2 made it, where such a hero was ignored outright. It is not the value that moves Stage 3's pacing least: a gap of 5 moves it less and a gap of 20 more (the table below), and no gap makes it move nothing, because Stage 2's rule was a sight of zero from one level above. Ten is the lead's choice between a rule the player can feel and a pace close to the approved one; it is one constant (CALL-6.27).

**Who is newly exposed: a strong hero standing still inside an aggressive camp.** Under Stage 2's rule a hero above a camp's level was never attacked there, whatever it did. Now a monster that wanders within 3 units attacks. Monsters wander up to 4.5 from home, so this is not only "walking into it". The case that matters is measured (`aggro-results.txt` 4): all four yew trees and all three magic trees stand inside the two moss-guardian camps, by Stage 2's design, and at every one of the seven a guardian can wander to within a unit of the tree. No other resource node stands inside an aggressive camp. **Second pass, measured on `main` (`second-pass-results.txt` C): "from time to time" was much too mild.** The engine walks a gatherer to within 3.1 of a tree (`loop.ts`, `stopDist`), so it stands about 3 from it. There, a combat-70 hero is attacked within 5 minutes in 59 to 100% of runs, with a median wait of 0 to 12 seconds once it is attacked, and at 6 to 8 of the 8 sides of every tree. And a gatherer who is hit keeps gathering and does not fight back: on `main` only death or a depleted node ends a gather (`loop.ts`, `actions.ts`), nothing in `performMonsterRetaliation` does, and Stage 4's auto-retaliation (its CALL-4.7) leaves a gathering hero alone by design. So a strong woodcutter who steps away from the keys at a yew loses health until it dies (a guardian deals about 1 to 2 hitpoints a second to a combat-70 hero, against 0.25 of regeneration), and dying costs experience under Stage 4. Under Stage 2's rule this never happened to a hero above combat 45; it always happened to one below. The design's first lever, a smaller wander, **reduces it and does not remove it**: with guardians that never leave home, 1 to 3 of the 8 sides of every tree are still within 3 of a guardian, and a gatherer who arrives on that side is attacked at once. This is the one place where the rule changes an existing player's routine, and it is the owner's call (CALL-6.29).

**Can a strong hero still be pulled into a whole camp?** Not at once. With the hero 10 or more levels above a camp, every member sees it only at 3. Measured (`second-pass-results.txt` B): a melee hero who stands 2 units from the member it fights, for a full minute, is joined by another member in 0 to 69% of fights (the giants and the terrace never), and never by more than one. A hero who stands 7 units off, near the camp's centre, is joined by about one more member a minute (at most two in the four-giant camp). Under Stage 2's rule it was never joined. Fights at that gap last seconds, so in play this is "a second monster now and then", not a chain.

**Is 3 "about strike range"?** For melee monsters, yes: their reach is 2.9 (`MELEE_RANGE`). Archers and casters strike from 11 (`FAR_RANGE`), and they too see a strong hero only at 3: the owner's words, read literally for an archer, would leave its sight near 11 at every level. The lead chose one minimum for all, so that weak archers do not shoot a strong hero from across a camp; a monster that has acquired at 3 then shoots from up to 11 as before. This reading is part of CALL-6.27.

**Dungeons are not a special case any more.** The first draft's CALL-6.18 ("in a dungeon everything attacks whatever your level", a flag `ignoresLevel` and a condition in the acquisition rule) is deleted. A dungeon simply contains aggressive camps, as the open world does, and its camps keep their sight: the same field the sentries carry. There is no dungeon branch in `stepMonster`.

**The pass stays a test of preparation.** The sentries keep their sight, so they attack every hero who enters the pass, at any level. Under Stage 2's rule a hero of combat 69 or more walked through untouched; now a level-80 hero is struck too, and passes (below). The diary perk that made them stop is removed (7.8).

**Stage 2's gate simulation, rerun** (`aggro-results.txt` 3: Stage 2's own `stepMonster` with the rule patched into a copy, 1,000 seeds on each of the three lines):

| Hero | Combat | Before: survives | After: survives | |
|---|---|---|---|---|
| Fresh character, 10 hitpoints, no prayer (the test's) | 3 | 4.4%, 4.3%, 4.3% | 4.4%, 4.3%, 4.3% | identical, blow for blow |
| 40 hitpoints and Protect from Melee (the test's) | 10 | 100% | 100% | identical, blow for blow |
| Every melee skill 70, dragon kit, no prayer | 80 | 100%, never attacked | 100%, 4 attacks a crossing | new: the pass tests it |
| The same with Protect from Melee | 80 | 100%, never attacked | 100%, 4 attacks a crossing | |

The test's three bounds (under 5%, every run, at least one attack per sentry) hold with the same numbers, because both of its heroes are below level 68 and the sentries never shrink. `tests/gate-simulation.test.ts` passes unedited.

**Stage 3's pacing, rerun** (`pacing-results.txt`). Stage 3's `tests/pacing.test.ts` was run unedited from `origin/main` (Stage 3 merged; the first run read its branch, whose files are identical), against its model three times: as committed (it reproduces the table in Stage 3's baseline document to the kill); with one modelling convention changed alone (below; nothing moves); and with the new rule. The model counts how many members of a camp attack at once: the whole pack when the hero is not above the monster's level, otherwise one. Now the pack applies at every level, scaled by how much of the sight radius is left and rounded up (`packAttackers`: 4, 4, 4, 4, 3, 3, 3, 2, 2, 2, 1 for a pack of four at 0 to 10 levels above). It equals Stage 2's count at or below the monster's level and from ten levels above.

Kills from a new game to each complete kit, shop only (route A1), and with bounties and drops (A3):

| | Iron | Steel | Black | Mithril | Adamant | Rune | Dragon |
|---|---|---|---|---|---|---|---|
| A1 before | 132 | 354 | 453 | 540 | 824 | 1,558 | 4,606 |
| **A1 after (gap 10)** | **169** | **434** | **637** | **724** | **1,009** | **1,743** | **4,771** |
| A1, gap 5 | 159 | 401 | 548 | 635 | 920 | 1,654 | 4,691 |
| A1, gap 20 | 169 | 434 | 704 | 943 | 1,247 | 1,981 | 4,976 |
| A3 before | 114 | 186 | 378 | 410 | 448 | 1,087 | 4,583 |
| **A3 after (gap 10)** | **126** | **223** | **482** | **611** | **682** | **1,322** | **4,725** |

Further kills after the level, A1, iron to rune: 93, 242, 297, 312, 391, 742 before; 130, 322, 422, 437, 411, 762 after. **Every assertion of the test holds, before and after, at every gap tried** (in order; at least 25 further kills shop-only; at least 1 with bounties and drops; never more than three tiers behind; the negative control; the 10x rows; the forge routes; purity). Nothing was tuned. What moves is the middle of the game: the fighter stays on scorpions longer (394 kills against 231) because a pack of giants stays dangerous until it is ten levels above them, so the mithril kit comes a third later in kills and the dragon kit 3.6% later. With bounties and drops (A3) the middle moves more: mithril 49% later and adamant 52% later in kills (410 to 611, 448 to 682). In the model's own minutes the move is smaller, because the extra kills are cheap scorpions: A1's mithril kit comes at 69 minutes instead of 64 (8% later) and adamant at 96 instead of 89 (8%); A3's at 60 instead of 51 (18%) and 67 instead of 56 (20%); rune and dragon within 6% (second pass, from `pacing-results.txt`). The count is an upper estimate (it ignores that a hero can pull from a camp's edge). If the owner wants the old pace exactly, the lever is `SIGHT_GAP`, never the test.

Two things about that rerun, said plainly. The model's line that counts attackers is itself Stage 2's rule written into a test support file, so it has to change with the rule: declared replacement 9 of 11.3, one expression. The first revision also counted the pack over camps that do not keep their sight (a second expression); the second pass ran the new rule with and without it and every number of every table is identical, so that edit to a frozen file is dropped (`pacing-rerun.sh` now applies it only in its information block 2). `packAttackers` is a convention of that model, not of the game, so it lives beside the model in `tests/support`, not in `src/state` (plan G1). The rerun used Stage 3's world: Stage 4's two camps and this stage's three are not in that tree (section 17).

**Where it is built.** In this stage's foundation slice (plan G1, G2), after Stage 4 is merged. Stage 4, approved and not built, rewrites how a monster moves in `chase` and `return` (routes), and adds patterns and phases to the same file; this rule touches only the idle branch's acquisition test, which Stage 4 leaves as Stage 2 wrote it. So the order is Stage 4's three changes, then this one, and R0 records the acquisition block's lines on the merged code. One sentence of Stage 4's design is superseded: Ashmantle "attacks a hero of combat level 110 or less". Its camp keeps its sight, so it attacks any hero who comes within its camp circle of 5.

---

## 8. Ready for co-op, without building it (G6.12)

**What this stage gives.**

- **Rules are pure and parameterised.** `evalCond`, `chooseOption`, `advanceStory`, `runStep`, `openChest`, `claimTier`, `useEmber`, `bump`, `perks` take a state and return a result. `openChest` takes `rand`; the boss timer and the run's clock take `now`.
- **Content is tables.** A person, a conversation, a quest, a diary tier, a dungeon and a boss are rows. The only functions written per content kind are the interpreter and the reducers.
- **Actions are commands.** Stage 4's `PlayerCommand` gains `talk`, `choose`, `claimTier`, `useEmber`, `enterDungeon`, `leaveDungeon`, `openChest`. Each has a pure applier on one player's state; the mouse, the keyboard and the windows reach them only through `dispatchCommand`.
- **A dungeon is already an instance in shape**: a row, an origin, a run value. Nothing in it is a singleton by design.

**What a second player would break in this stage's design.** Five things, each with where the single-player assumption sits:

| # | What breaks | Where | What co-op would need |
|---|---|---|---|
| 1 | One current grid. `G.walkGrid` is swapped when the hero enters a zone; two players in different spaces need a grid per player. | `engine/zones.ts`, `context.ts` 217 | The grid looked up by the space a player or monster is in. |
| 2 | "Only the hero's space is stepped." Overworld monsters freeze while the hero is in a dungeon. | `loop.ts`, `updateMonsters` | Step every space that holds a player. |
| 3 | One run per session, reset on entry. A second player walking in would reset the first player's dungeon. | `engine/zones.ts`, `state/dungeon.ts` | A run keyed by party, and a copy of the zone at its own origin. |
| 4 | Credit goes to "the" state: a kill counts for whoever's state `registerKill` is called with, a chest rolls once and pays one backpack, and a camp's sight is measured against one hero's combat level. | `adventure.ts` `registerKill`; `dungeon.ts` `openChest`; `monsterAi.ts` `sightRadius` | A rule for shared credit and shared rolls, and aggression decided per target (already on Stage 4's list; `sightRadius` already takes the level as a parameter). |
| 5 | A boss's return time lives in one player's save. | `progress.bossDownUntil` | World state owned by the host, not by a character. |

Not on the list, because they already hold per player: quest stages, counters, the diary, dialogue (no pause, no world lock), embers.

Stage 4's blockers that are still open after this stage, deferred again to the co-op stage: `StepWorld` carries one target; `STATE`, `player` and `G` are singletons; damage for basic ranged and magic hits is applied from effect closures; the hero's attack formula lives in the engine; the random source is `Math.random` injected by the engine, not a seeded stream per session.

---

## 9. Save format impact and migration (G6.10)

| | Stage 6 |
|---|---|
| Key | `gielinor_hero_save_v1`, unchanged |
| `version` | 4, unchanged |
| New saved values | One optional top-level block, `progress`, written only when it holds something. Two keys in `skills`: `crafting`, `runebinding`. Story quest ids in the existing `quests.claimed`. Three embers, 23 other new items and new recipes' products in the existing `inventory` and `bank`. |
| New persistent keys | `gielinor_hero_save_v1_corrupt_2`, `_corrupt_3` (7.9) |
| Position | While the hero is in a dungeon the saved position is the dungeon's overworld door. Zone coordinates are never written. |
| Migration code | none: an absent `progress` is an empty one |

**The block and its reader** (`normalizeProgress`, pure). The reader walks the game's own tables and asks the save about each known key; it never iterates the save's keys, so a save cannot make it do unbounded work or reach an inherited key.

| Field | Shape | Default | Reader rule | Bound |
|---|---|---|---|---|
| `story` | `{ [questId]: stageIndex }` | `{}` | For each id in `STORY_QUESTS` that is an own key of the saved object: a finite integer from 0 to that quest's last stage, else dropped. Dropped too if the id is in `claimed`. | 13 entries |
| `stats` | `{ [statKey]: count }` | `{}` | For each key in `STAT_KEYS` that is an own key: finite, floored, clamped to 0..2,147,483,647; zero is not kept. | 133 entries |
| `diary` | `string[]` of `region:tier` | `[]` | Ignored unless it is an array of at most 64 entries; then the known tier ids it contains, each once. | 15 entries |
| `dungeons` | `{ [dungeonId]: { clears, best } }` | `{}` | For each id in `DUNGEONS`: `clears` and `best` finite integers, clamped to 0..2,147,483,647. | 2 entries |
| `bossDownUntil` | `{ [typeKey]: epochMs }` | `{}` | Only types with a `BOSSES` row and an overworld camp; finite; dropped if in the past; clamped to `now + respawnSecs x 1000`. `now` is a parameter. | 2 entries |

At every bound the block is 4,977 bytes of JSON (`results.txt` section 10; today's default save is 2,139 bytes). No string in it is free text: every key and every array entry is checked against a table, and none is ever shown as markup.

**What happens to a save, case by case.**

| Save | After Stage 6 |
|---|---|
| Any version-4 save from before this stage | Loads to exactly what it loads to today, plus Crafting and Runebinding at level 1 with 0 XP, and an empty `progress`. Flags it already has (`killedGoblin`, `smeltedBar`, shrines, claimed quests) count toward diary tasks and quest stages that ask "at least once". Counters start at 0. |
| A save from before Stage 3 (never claimed `arrival`) | As above. No starter chain. Chapter 1 is on offer at once. |
| A new game part-way through the chain | As Stage 3 loads it. Bran Tolley speaks to the open quest. |
| A legacy save (`runewilds_save_v2`, `_v3`) | As today, then as the first row. |
| A corrupt main save | The notice of 7.9, with the save held until the player chooses. |
| A save with a hand-edited `progress` | Every field is read by the table above. A stage index out of range, an unknown id, a non-finite count, `__proto__` or `constructor` as a key, a 100,000-entry array and a boss timer in the year 3000 all load to a valid state. Skipping chapters by editing a stage is cheating, not a fault: it must not crash, and does not. |
| A Stage 6 save loaded by the build before it | Loads. That build drops `progress`, the two skills, story ids in `claimed`, and any backpack or bank stack of an item it does not know (`Object.hasOwn(ITEMS, id)`, Stage 1). If it then saves, that progress is gone, and the new build would offer those quests and diary tiers again (critique L7: it needs an old build, so it is cheating, not a fault). Everything it knows is kept. |

**Frozen save tests.** Stage 3's `default-state.golden.json` and `save-v4-loaded.golden.json`, and Stage 2's `tests/fixtures/save-relocation/v4-loaded.json` (compared to a serialised save by `save-relocation.test.ts` 45-49), each gain exactly two entries under `skills`; those are declared replacements (11.3). Its "same top-level keys" test passes unedited, because `progress` is not written when empty. Stage 4's optional `quests.lanternVow` is untouched.

**Fixtures and tests** (plan F1, F2): the round trip of a state with every `progress` field filled; the hostile fixture above; the Stage 1 fixture and Stage 3's geared fixture loading to their goldens plus the two skills; `serializeState` of the default state has no `progress` key; a state saved inside a dungeon reads back at the door; the old reader, simulated by deleting the new keys, loads the rest unchanged; the three-copy rotation, the full-storage path and the 256 kB limit against the in-memory store; a boss timer one hour ahead is clamped to one respawn.

---

## 10. Performance budget

No frame time has been recorded on a real GPU (Stage 5, section 10); counters and counts are binding, milliseconds are estimates.

| Measure | After Stage 5 | After Stage 6 |
|---|---|---|
| Overworld monsters | 42 (after Stage 4) | 48 (three Adepts, two Brutes, Marrowjaw) |
| Monsters stepped per frame | 42 | 48 outside; inside a dungeon only that dungeon's 22 or 15 |
| Zone build | none | On entry: at most 12,544 walk cells, one merged floor mesh and one merged wall mesh per zone (2 draw calls), at most 30 props, the gate, the chest. Disposed on leaving with `disposeObject3D`. Nothing of a zone exists while the hero is outside. |
| Draw calls inside a dungeon | | at most 150, the overworld culled by distance, the dome and apron hidden |
| People | 5 humanoid rigs (three merchants, the task master, the bank clerk) and two guards | 12 rigs and two guards; each is one more animated rig |
| Path searches | Stage 4's quota | unchanged; a zone grid is a sixth of the overworld's |
| `advanceStory` | | 10 times a second, at most 13 quests, one condition each |
| Journal and diary | | computed when the window opens and when a counter it shows changes, never per frame |
| DOM | | one dialogue panel, three tab bodies, the recovery notice |
| JS chunk | Stage 5's chunk | at most 140 kB more: about 60 for dialogue text, 20 for tables, 60 for code. BUILD reports the real number per slice. |
| Models, textures, audio files | | 0 bytes added |
| Save | 2.1 to about 6 kB | at most 5 kB more |

---

## 11. Verification

### 11.1 Headless, in vitest

| Goal | Proof |
|---|---|
| G6.1 | The dialogue data test of 7.2 over every tree. `chooseOption`: an option whose condition is false is refused even when asked for by index; a `give` with a full backpack applies nothing and changes no quest; a `take` without the item applies nothing; an option with a reward cannot be chosen twice; the events returned match the effects. |
| G6.2 | For each of the 13 story quests, a scripted state walks it from offer to reward through `openDialogue`, `chooseOption`, `bump` and `advanceStory` alone, and ends with the reward paid once and the id in `claimed`. Each chapter is refused before the one before it and below its combat level. Work done before a quest finishes its `do` stage at once. Every quest's giver, stage person, item, counter and region exists. |
| G6.3 | `STARTER_QUESTS` deep-equals a fixture taken before the stage. Stage 3's starter and tracker tests and its 29-action pacing assertion pass unedited. For the three kinds of save of 7.3: Bran Tolley's first node is the expected one; `claimStarter` pays exactly what `claimQuest` pays and a second claim by either route is refused. |
| G6.4 | The loop audit as a test: every non-equipment item has a source and a use, except a named list of four (7.4). Every new recipe passes Stage 3's 2.5 rule (its own test, unedited, reads the recipe table). No new item has a type the shop sells except the five kinds of ammunition. No new monster drops equipment. New material drops add at most 25% to each monster's mean coin. |
| G6.5 | The two skills exist in `SKILLS_META`; a recipe of each can be crafted at its level and not below; `unlocksAt` returns each table row at its level; the actions-to-level table of `results.txt` section 4 is reproduced within one action. |
| G6.6 | Dungeon data test: every zone camp is aggressive and keeps its sight (through `stepMonster`, a zone monster acquires a hero 60 levels above it at its full radius); a run's coin per second is under 90% of the best open ground at its level; rooms inside the zone and at least 6 wide; every member inside its room and of a known type; with gates open every cell is reachable from the entry; with gates shut the boss and the chest are not; the boss's arena fits its room; zones are at least 400 from the overworld and from each other; each door is walkable and outside every camp's leash. `runStep` opens a gate only when its camps are dead. `openChest`: refused while the boss lives; pays the fixed part every time and each rare entry exactly when the injected random value is under its chance; over 20,000 seeded opens every rare entry's rate is within a stated tolerance of its chance; with a full backpack pays nothing, stays shut and keeps its roll; no dungeon row has a reward field other than `loot`, and no equipment entry is above 0.05. **Quest pay once**: with chapter 6 at its chest stage, three opens pay three rolls and advance the quest once, `finishQuest` pays once and is refused again (7.3). The expected-clears table of 7.6 is reproduced from the rows within 0.1. A state saved in a zone reads back at the door. `findPath` on a zone grid routes entry to chest only with the gate open. Through `stepMonster` with the zone grid, a monster at x 1000 chases, returns and wanders without leaving the zone; a zone monster with `respawn: false` stays dead while an overworld one of the same type respawns. Stage 2's frozen pathfinding and terrain tests pass unedited. |
| G6.7 | The fight table of 7.7 as a test, 500 seeds a row, the same bounds. Each new boss row is valid by Stage 4's attack-table test. Marrowjaw's arena passes Stage 4's placement criteria on the real grid; the two new overworld camps pass Stage 2's world-data rules. |
| G6.8 | Diary data test: 15 tiers of 5 tasks; every condition valid; every stat family and both new skills read by at least one task. `claimTier`: refused until all five are done, pays once, refused when the ember does not fit. `perks` returns each perk exactly from its tier. A deposit box accepts a deposit and refuses a withdrawal; the hard tier makes it a bank. No perk is read in `stepMonster` (a scan). An ember's experience is not multiplied at 10x and cannot lower a level. |
| G6.9 | Stage 3's `pacing.test.ts` and `economy-invariants.test.ts` pass unedited at the end of every slice (the pacing model's one line: replacement 9). Dungeon camps are not in `CAMPS`. |
| G6.13 | `tests/style-balance.test.ts`: for levels 20 to 70 in steps of 10, the three standard kits built from the item table by 7.12's rule; ranged with bronze arrows within 0.9 to 1.35 of melee's damage per second, magic with its best spell within 0.95 to 1.4, the fastest at most 1.4 times the slowest; at every level from 20 to 70 the fastest at most 1.45 times the slowest; the melee profile of twelve fixed states equals values written out from today's formula (melee did not move). `tests/arrows.test.ts`: the same band with the arrow of the level; each arrow grade adds exactly its power with every bow and crossbow; `canUseStyle` accepts every bow with every arrow and every crossbow with every bolt; the best grade carried is the one spent; ice burst and blood barrage take one rune of each kind. The fight tests B1 to B3 and Stage 4's boss test pass unedited before and after the slice. |
| G6.14 | `tests/aggression.test.ts`: `sightRadius` over a grid of levels and bases (full at or below the monster's level, the minimum from ten above, linear between, never above `base`, never growing with the hero's level, constant with `keepsSight`); through `stepMonster`, the farthest distance at which an idle monster acquires a standing hero equals `sightRadius` within one step, for a melee, a ranged and a magic monster; a passive camp never acquires at any level; `pass_sentries`, `ashmantle`, `tollmaster` and every zone camp carry `keepsSight`, and no other camp of `CAMPS` does. `tests/gate-simulation.test.ts` passes unedited. `tests/pacing.test.ts` passes unedited on the model with replacement 9. |
| G6.10 | Section 9's fixtures and tests. |
| G6.11 | One test per fixed debt: the three-copy rotation; the guarded write; the hold (a pure `shouldAutosave(hold)` and the session's use of it by reading); the boss timer's clamp. |
| G6.12 | The architecture test passes unedited (no engine import, no `document` or `window` under `src/state` and `src/data`). A scan: no new module under `src/state` calls `Math.random`, `Date.now` or `performance.now`. Every new command has a pure applier with a test. |
| Names | The deny-list over every new table's names (a new test file with the same list). |

### 11.2 Needs a person at the running game

- Talk to each of the seven people as a new character and as a late character; read every line once for sense and voice.
- Play chapters 1 and 2 from a new game with the journal and tracker as the only guide. Expected: never unsure where to go next.
- A full backpack at a reward: the person says to make room, nothing is lost, the option is still there.
- Craft a pair of gloves at the bench; bind runes at an altar; brew a vial at the range; the skills tab shows fourteen skills and still fits.
- Enter Saltfang Warren: the overworld is not visible, the rooms read as rooms, the minimap shows them, the gate opens when the third room is dead, the chest pays, the door leads out. Die inside; reload inside; teleport out. Expected in each case: outside, the run gone, nothing else lost.
- Fight each of the three bosses with a mouse and with a trackpad. Judged for: the question of 7.7 is what the fight feels like.
- Walk past the Cinder Adepts on Cinder Stair as a combat-40 character: the road is safe; stepping 6 units off it is not.
- As a strong character, walk through the scorpions and the giants: nothing comes from a distance. Chop a yew among the moss guardians as a combat-70 character: a guardian attacks within seconds, and what follows is what the owner chose in CALL-6.29. As a weak one, the camp comes from a distance. Cross the pass at combat 75: the sentries attack.
- Shoot the same monster with the same bow and each grade of arrow: the better arrow hits harder and the bow is never refused. Cast each spell as a level-50 caster: the dearer spell is visibly the stronger.
- Break the main save by hand (delete its last character) and reload: the notice appears, "Copy the save text" works, nothing is overwritten until a choice is made.
- Perf HUD inside each dungeon and at the two Stage 1 poses, against section 10.

### 11.3 Declared test replacements

Declared here so they are not mistaken for weakening. Each names its file and assertion and is made by the test task named. Items 1 to 7 are additive (critique H4: the first draft declared three of them). Items 8 to 11 are of another kind: the owner replaced a rule (aggression) and asked for a rebalance (the formula), on 2026-11-14, and each of those tests pins the old rule or the old number. Each is replaced by an assertion at least as strict about the new one.

1. `tests/content-freeze.test.ts` (Stage 3): `DECLARED_NEW_ITEMS` and Stage 4's `DECLARED_NEW_MONSTERS` gain exactly the ids of `content.ts` (26 items, 6 monster types). The test has no list for nodes or recipes (it pins them through `content-ids.golden.json`), so D1 adds two constants, `DECLARED_NEW_NODES` and `DECLARED_NEW_RECIPES`, subtracted from the current ids exactly as the item list is, and each later test task appends its slice's ids (3 nodes, 49 recipes in all). The golden is not regenerated. `QUEST_DEFS`, `PRAYERS` and `SPELLS` gain nothing.
2. `tests/fixtures/s3/default-state.golden.json` and `save-v4-loaded.golden.json` (Stage 3): regenerated with `UPDATE_GOLDEN=1` once per new skill (K1, N1); each diff is one added entry under `skills` and nothing else.
3. `tests/fixtures/save-relocation/v4-loaded.json` (Stage 2, read by `save-relocation.test.ts` 45-49): the same one added entry under `saved.skills`, by hand, in K1 and N1.
4. `tests/world-budget.test.ts` (Stage 2, "CAMPS hold N monsters"): from Stage 4's 42 to 48 (D3).
5. `tests/world-data.test.ts` 162 (Stage 2, `expect(memberCount()).toBe(...)`): from Stage 4's 42 to 48 (D3). Its `aggressive().length === CAMPS.length - 2` holds unedited: the three new camps are aggressive.
6. `src/__tests__/blender-hero.test.ts` (as Stage 4 rewrites it: 13 monster type keys, every model key one of the ten meshes): the type-key count from 13 to 19, at the slices that add types (D3: 16, Z3: 18, U0: 19). The model-key assertion holds unedited: every new row uses an existing mesh.
8. `tests/monster-territory.test.ts` (Stage 2), the test "an aggressive camp ignores a player whose combat level is above the monster's" (lines 259-273). Its first half is the old rule itself: fifty steps with a hero one level above a goblin, 2 units away, each `expect(kinds(stepMonster(above, ...))).toEqual([])`, then `expect(st(above)).toBe('idle')`. Replaced (G1) by: at one level above and 2 units the step emits `aggro`; at ten levels above, fifty steps at 3.5 units stay `idle` and a step at 2.9 emits `aggro`. Its second half (equal level emits `aggro`) stays as written, and the test is renamed "an aggressive camp attacks at any level, from a distance that shrinks". Every other test of that file passes unedited: each plays a hero of combat 1 against a goblin (level 2), a goblin archer or a dark wizard, at or below the monster's level, where the radius is the old one (`aggro-results.txt` 2).
9. `tests/support/pacingModel.ts` (Stage 3; the model behind `tests/pacing.test.ts`, which is not edited). One expression and one import (G1): `const attackers = pack > 0 && monsterThreatColor(m.level, combatLevel(state)) !== 'green' ? pack : 1;` (line 141 on `main`) becomes `const attackers = packAttackers(pack, m, combatLevel(state));`, and the import of `monsterThreatColor` (line 17) is replaced by `import { packAttackers } from './packAttackers';`, a new file beside it (G1) that scales the pack by the sight radius left, rounded up, using `sightRadius` from `src/state/monsterAi.ts`. Line 113 (`if (camp.aggressive) largestAggressive[type] = ...`) is not edited: the second pass found that excluding the sentries from the pack changes no number (`pacing-rerun.sh`, design 7.13). No assertion, threshold, route or fighter changes; all eleven tests pass (`pacing-results.txt`).
10. `tests/combat-profile.test.ts` (Stage 3), five expected max hits, each written out from the formula of 7.12 as the originals are from today's (S1): "shortbow on rapid: max hit 5" becomes 4 (`floor(3 + 0.35 + 16 x 0.06)`); "with sharp_eye: max hit 7" becomes 5 (`floor(4.31 x 1.2)`); "fire_staff ... wind_strike: max hit 10" becomes 5 (`floor(10.54 x 0.5)`); "fire_bolt: max hit 17" becomes 8; "wind_strike and mystic_might: max hit 12" becomes 6. Every accuracy, every melee case and every `playerHitChance` and `monsterHitChance` case stays as written.
11. `tests/entry-staff.test.ts` (Stage 3), "Wind Strike with it hits for 6 at Magic 1": `expect(playerAttackProfile(state)).toEqual({ maxHit: 6, accuracy: 21.5 })` becomes `{ maxHit: 3, accuracy: 21.5 }`, and the test's name says 3 (S1). The starter staff then hits as hard as the starter sword.
12. Only if R0 finds another Stage 4 or Stage 5 test that pins the number of skills, commands or interactive actions: that count, named by R0 before any code, and the owner is asked.

Checked and **not** replacements: no test on `main` or on Stage 3's branch pins a spell's rune count or its description (grep for `RUNE_COSTS`, `.runes`, `runeList`, the rune ids and "Max Hit": the hits are shop tests in `src/__tests__/bulk-buy.test.ts` and name lists; `tests/phase1.test.ts` 157 and `tests/stage2-review-fixes.test.ts` 139 read what an attack consumes for the bow and for wind strike, which do not change); `tests/gate-simulation.test.ts` (identical numbers, 7.13); `tests/phase2.test.ts` 226-229 (`monsterThreatColor` keeps its values: it is the label's colour); `tests/world-data.test.ts` (`aggressive().length === CAMPS.length - 2` and "the pass camp is aggressive" hold: no camp changes sides); `tests/phase1.test.ts` 144-149 (a shortbow with bronze arrows fires, without them it does not); `tests/stage2-review-fixes.test.ts` (the grace). Stage 4's tests do not exist yet; its design's sentence that Ashmantle attacks "a hero of combat level 110 or less" is superseded by 7.13, and R0 checks that no Stage 4 test pins it.

Every other existing test stays as it is, including `tests/names.test.ts` (twelve names in `worldMap.ts`), `tests/phase3-content.test.ts` (ten quests), Stage 3's starter, tracker and pacing tests, and Stage 1's save tests.

---

## 12. Ledger: everything owed to Stage 6

| Item | Source | Decision | How |
|---|---|---|---|
| The corrupt-save backup is written only once | Foundation design 9.1 | **Fixed** | 7.9: three rotating copies |
| A corrupt main save does not fall back to the legacy keys | Foundation design 9.1 | **Fixed, as a choice** | 7.9: never silently; offered by name, with what is in it |
| The backup write is unguarded; a failed write loses the raw save at the next autosave | Foundation design 9.1 | **Fixed** | 7.9: guarded writes, and the autosave held until the player chooses |
| `applyState` throws, then the autosave overwrites the save with a new game | Stage 3 design section 8 | **Fixed** | 7.9: the same hold and notice |
| No recipes for steel, black, adamant, dragon (F14) | Stage 3 design section 10 | **Fixed** | 7.4: two rocks, four bars, twelve recipes |
| Food that matters | Stage 3 design 7.2 | **Done by Stage 4**; extended | 7.4: potions and the stew can be made; 7.7 measures food in a fight |
| The giants plateau, level 28 to 45 to 68 (F12) | Stage 3 design section 10 | **Fixed** | 7.5, 7.6: 40, 48, 52, 58, and a dungeon from 30 to 48 |
| Quests that lead the first hour; quest givers, dialogue, talk-to steps for the starter chain | Stage 3 design 7.1 item 9, section 10 | **Fixed** | 7.2, 7.3 |
| Ranged and magic gear ladders as designed curves | Stage 3 section 10, Stage 4 section 11 | **Fixed by a rebalance** (the owner's decision of 2026-11-14, CALL-6.7) | 7.12: three numbers of the formula, no item row, no boss re-tuned; armour and runes made by the two new skills; arrow grades (7.4). |
| Saving a boss's respawn timer | Stage 4 design section 8, CALL-4.12 | **Fixed** | 7.9 |
| The remaining co-op blockers | Stage 4 design section 7 | **Deferred again** to the co-op stage, with this stage's own five added | Section 8 |
| The prepared slots: Cinder Adept, Slag Brute, captain, swarm, dungeon boss | Stage 4 design 6.8 | **Filled**, on existing meshes, with the model each needs recorded | 7.5 |
| Audit finding 1 (a save string reaching `innerHTML`), as a class | Audit; foundation design R1 | **Held** | No free text in the new block; dialogue and journal use `textContent` (section 13) |
| Audit finding 10 (round trip) | Audit | **Extended** to the new block | Section 9 |
| Audit finding 24 (station windows lose scroll and focus on redraw) | Audit; Stage 5 7.4 | **Not reintroduced** | The journal and diary redraw only the tab that changed and keep scroll, as Stage 5's fix does |

Deferred again, in writing:

| Item | To | Reason |
|---|---|---|
| Salmon, anglerfish, the golden brew, bronze bolts: no source but the shop | A later content stage | Each needs a new fishing spot or recipe; none blocks a loop a player meets. |
| New models for six monsters, seven people and the dungeon kit | The models pass | 7.5 lists each. |
| A script policy without `unsafe-inline` for styles | Stage 7, as Stage 5 left it | Not touched here. |

---

## 13. Threat model

### 13.1 What are we working on?

A single-player browser game served as static files: no server, no account, no network call from game code. What this stage adds to the flows:

| Flow | Source | Trust | Sink |
|---|---|---|---|
| Save load, new block | `localStorage` JSON | **Untrusted**: old, truncated, hand-edited, or pasted from another player | `STATE.progress`, then conditions, the journal and diary windows, the boss timer |
| Dialogue, quests, diary, dungeons | `src/data/*.ts` | Trusted content: compiled constants reviewed in git. It can still be **wrong** | The interpreter, the DOM, rewards |
| Dialogue choices | The interface, as `(npcId, nodeId, index)` | The player; and a stale or forged triple from a panel left open | `chooseOption` |
| Save recovery | The raw corrupt string; the legacy keys | Untrusted | Backup keys, the clipboard, a text box |
| Clock | `Date.now()` for the boss timer | The player's machine | `bossDownUntil` |

Trust boundaries: the `localStorage` read, as before; and one that is new in kind, **content against rules**: a table that pays a reward twice or names an item that does not exist is a bug that looks like an exploit. Cheating is not a boundary: the player owns the only copy of the state.

### 13.2 What can go wrong?

| # | Failure | Where |
|---|---|---|
| R1 | A string from the save reaches `innerHTML` (audit finding 1). | Save load |
| R2 | The new block carries non-finite numbers, unknown ids, inherited keys, or a huge array; the reader loops over it, or a later lookup hits `Object.prototype`. | Save load |
| R3 | A boss timer far in the future (hostile, or the clock was wrong when it was written) removes a boss for good. | Save load, clock |
| R4 | A reward is paid twice: a dialogue option stays available, or the log and the person both pay the same starter quest. | Content, rules |
| R5 | A reward is lost: the backpack is full, the quest advances anyway. | Rules |
| R6 | A quest cannot be finished: a stage asks for something that cannot exist, a person stands where the hero cannot reach, a condition can never be true. A main line with a dead stage ends the game's story. | Content |
| R7 | A quest state the tables do not allow (a stage past the end, an active quest that is also claimed) crashes the journal on every load. | Save load |
| R8 | The hero is saved inside a dungeon and loads into empty space at x of 1000, or an older build loads that position. | Save write |
| R9 | The hero is trapped in a dungeon: the gate never opens, the door is unreachable, no teleport runes. | Rules, content |
| R10 | A dungeon or a chest becomes the best income and Stage 3's pacing is void without its test noticing. | Economy |
| R11 | A new drop, recipe or reward breaks the 2.5 rule or the drop caps, or a new item type goes on sale in the shop. | Economy |
| R12 | The hero is killed while reading: a person stands inside a camp's reach, or the panel hides a wind-up. | Dialogue |
| R13 | Dialogue text contains markup, or one of the two words that fail the architecture test for an unrelated reason. | Content |
| R14 | The save hold never releases: the player plays an hour and nothing is saved. | Save recovery |
| R15 | The recovery path destroys what it is meant to protect: rotating copies over the only good one, or a full store. | Save recovery |
| R16 | The zone swap leaves the wrong grid active: the hero walks through dungeon walls, or cannot move in the overworld. | Engine |
| R17 | A new name is taken from a published game. | Content |
| R18 | A counter is bumped under a key that is not in the list and silently grows the save. | Rules |
| R19 | The rebalance breaks a fight or a proof that was tuned on the old numbers, or quietly makes a style useless. | Rules |
| R20 | The new aggression rule kills heroes Stage 2 kept safe: a strong hero standing idle in a camp, or one reading a dialogue. | Rules |
| R21 | A drop table becomes a slot machine with no end, or a full backpack becomes a way to roll a chest again. | Rules, content |

### 13.3 What are we going to do about it?

| Risk | Decision |
|---|---|
| R1 | **Eliminate the surface.** The new block holds no free text: only table ids and numbers. The dialogue panel, journal and diary write every string with `textContent`. A test scans the three new UI modules for `innerHTML`. Titles earned here go through the existing `quests.title`, which the reader already cuts to 40 characters and which is shown as text. |
| R2 | **Mitigate at the boundary** (section 9): the reader iterates tables, never the save; own-key checks; finite, floored, clamped numbers; arrays over 64 entries ignored. Internal code trusts `progress` after that. |
| R3 | **Mitigate**: clamp to one respawn from now on load; drop a past value. |
| R4 | **Mitigate by construction and by test**: every paying option is conditioned on the stage it moves (7.2); both starter routes call one `claimQuest`; the per-quest walk test claims twice and expects one payment. |
| R5 | **Mitigate**: effects are rehearsed on a copy and applied together or not at all. A chest that does not fit stays shut. |
| R6 | **Mitigate**: the data tests (every id exists, every `goto` resolves, every person reachable and outside camps), and the per-quest walk test that finishes each quest with the pure functions alone. **Accept** the rest: a condition that is true in a test and impossible in play (a monster nobody can reach) is caught only by the play check. |
| R7 | **Mitigate at the boundary**: the reader drops a stage out of range and an active quest that is claimed. `journalView` then cannot meet one. |
| R8 | **Eliminate**: zone coordinates are never written; the door is. |
| R9 | **Mitigate**: the door is in the safe entry room and always open; dying leaves; the connectivity test proves the gate's rooms are reachable. **Accept**: a hero with no food in the boss room can still die, which costs what a death costs. |
| R10 | **Mitigate**: a test computes each run's coin per second with the model's fighter and requires it below open ground at that level; dungeon camps are outside `CAMPS`; Stage 3's test runs unedited at every slice gate. |
| R11 | **Mitigate**: Stage 3's invariant test reads the recipe and monster tables, so it covers the additions unedited; one new test pins item types and the 25% bound. |
| R12 | **Mitigate**: the placement test; the panel closes on a hit; the game does not pause, so nothing is hidden in time, and the panel sits at the bottom of the screen, clear of the ground around the hero. |
| R13 | **Mitigate**: the data test rejects `<`, `&`, and the two words. |
| R14 | **Mitigate**: the hold is set only together with the blocking notice, and every button of the notice releases it. A test covers each exit. The save button shows "Not saving" while it is set. |
| R15 | **Mitigate**: the raw string stays in the main key until the player chooses; copies rotate oldest out; each write is guarded; the tests run against a store that throws on write. |
| R16 | **Mitigate**: one function enters and one leaves, each sets grid, monster set and fog together; teleport, death and load all go through "leave". A test drives enter, die, enter, teleport, enter, reload on the pure parts; the engine part is a human check. |
| R17 | **Mitigate**: the deny-list test and a person's search per name. **Accept** the remainder: no test proves originality. |
| R18 | **Mitigate**: `bump` throws on a key outside `STAT_KEYS`; the reader keeps only listed keys. |
| R19 | **Mitigate**: every fight row of Stage 4 and of this stage was run with both formulas and holds (7.7, 7.12); the band is a test over the item table; melee is not edited, so the pacing and income proofs cannot move. **Accept**: what a style feels like after it is a play check. |
| R20 | **Mitigate**: safe zones and the 3-second grace are unchanged; a hero ten levels above a camp is attacked only within 3 units; people stand outside every camp's leash (the placement test); the dialogue panel closes on a hit. **Decide** (second pass): a strong woodcutter at the seven yew and magic trees among the moss guardians is attacked within seconds and, because a gatherer neither stops nor fights back, can die away from the keys (7.13). That is the owner's to settle (CALL-6.29); until then it is not accepted. |
| R21 | **Mitigate**: no counter and no saved luck (the owner's rule); each chest's base loot is certain, so chapter 6's shard step always completes (7.6); pure-chance entries are three shop-sold pieces nobody needs; a chest that does not fit keeps its roll. |

### 13.4 Did we do a good enough job?

By the proofs of 11.1. In particular: for the save, the hostile fixture, the round trip, the old-reader simulation and the goldens; for content, the four data tests (dialogue, story, diary, dungeons) and the walk of every quest; for the economy, Stage 3's two tests unedited plus the run-income test; for the bosses, the fight table. If the per-quest walk cannot be written with the pure functions alone, a rule is hiding in the engine and the design is wrong at that point: the stage stops there.

---

## 14. Slices

### 14.1 Order

Ordered by how much each improves the game for the work it takes. Each ends green, can be shown to the owner, and can be the last one built.

| # | Slice | The owner sees | Rough size | Needs |
|---|---|---|---|---|
| 0 | **Foundation.** Premise re-check; the `progress` block, counters, reader, fixtures; save recovery; the boss timer; **aggressive and passive monsters** (7.13). | The recovery notice on a broken save. Monsters that come at a weak hero from a distance and leave a strong one alone until walked into; the pass that tests everybody. | 10 tasks | Stages 3, 4, 5 merged |
| 1 | **The forge's missing tiers and the roster.** Coal, steel, blacksteel; brewing; feathers; Cinder Adepts, Slag Brutes, Marrowjaw. All data on systems that exist. | New rocks, new forge recipes, three new things to fight, the first boss a mid-level player can beat. | 6 tasks | 0 |
| 2 | **People and the first chapters.** The dialogue system, the seven people, the journal, Bran Tolley's voice for the starter chain, chapters 1 and 2, four side quests, embers. | People to talk to; a story that says where to go. | 11 tasks | 1 |
| 3 | **The first dungeon.** The zone mechanism, Saltfang Warren, its drop table, the swarm, Matron Saltfang, adamant, chapter 3. | A door in the dunes and what is behind it. | 9 tasks | 2 |
| 4 | **Crafting.** The skill, the bench, hides and cloth, sixteen recipes, its side quest. | A third production skill; ranged and magic armour made, not bought. | 5 tasks | 2 |
| 5 | **Runebinding.** The skill, the altar's second use, its side quest, chapters 4 and 5. | Runes made from stone and bone; the road to the pass. | 5 tasks | 2 |
| 6 | **The three styles.** The rebalance (7.12) and the arrow grades (7.4): three numbers, two spells' rune counts, five kinds of arrow and bolt, five recipes. | Melee, ranged and magic within a third of each other; arrows that are good or bad; spells that are cheap or strong. | 5 tasks | 1, 4, 5 |
| 7 | **The Underkiln and the end.** The second dungeon, its drop table, the Kiln Warden, wyrmsteel, chapters 6 and 7. | Dragon gear by the forge, a few runs at a time; an ending. | 5 tasks | 3, 5, 6 |
| 8 | **The diary.** 75 tasks, perks, its tab. | A reason to do everything once, in every region. | 6 tasks | 1 to 7: its tasks read everything else |

The diary is the cheapest system and comes last only because its tasks name content from every other slice; it could ship earlier with fewer tiers, at the price of a second pass over its table. Slices 4 and 5 touch the same data tables at their ends and are built one after the other. If the stage must be cut short, it is cut from the bottom: after slice 3 the game already has people, a main line to chapter 3, a dungeon and two bosses.

**Where the two rule changes sit, and why.**

- **Aggression is in the foundation.** It is a rule under everything: the roster's camps (slice 1), where people may stand (slice 2) and the dungeon's rooms (slice 3) are all checked against it, and the dungeon needs it or its rooms stand and watch (F6.10). It edits the file Stage 4 edits three times, so it goes right after R0 has recorded what Stage 4 left, before anything of this stage builds on the old rule. Its declared replacements (8 and 9) are made once, at the start.
- **The rebalance is slice 6: after both new skills, before the last boss.** Three reasons. It takes damage from ranged and magic, and what the stage gives those styles in return (armour made at a bench, runes bound at an altar, arrows fletched from bars) exists only after slices 4 and 5; landing it earlier would ship a slice that only takes, and a stage cut short after it would leave casters with half the damage and nothing cheaper to cast. It needs no boss re-tuned, because every fight bound holds with the formula before and after (7.7, 7.12): the tests of Marrowjaw, Saltfang and Ashmantle written in earlier slices pass on both sides and are not touched. And putting it before the Underkiln means the hardest fight is tuned and played once, on the final numbers. If the stage is cut before slice 6 the styles stay as unbalanced as they are today and nothing is half-done; the owner has decided it is wanted, so it is not marked cuttable.
- **Arrows ride with the rebalance**, because an arrow's power is a term of the ranged formula and the band is stated with the arrow of the level. They need only slice 1's feathers.

### 14.2 What each system costs and what it adds to the save

| System | Built from | New code, roughly | Adds to the save |
|---|---|---|---|
| Dialogue | 1 pure module, 1 UI module, 1 table | 350 lines + about 300 nodes of text | `talk:` counters |
| Quests and journal | 1 pure module, 1 UI module, 1 table | 300 lines | `story` (one number per active quest); ids in `claimed` |
| Skills and loops | Tables; two station actions; one filter on the recipe window | 150 lines + 49 recipe rows | two skill entries; `craft:` and `gather:` counters |
| Aggression | One pure function and one field on a camp | 30 lines; minus the threat-colour condition | nothing |
| The three styles and arrows | Three constants, one parameter, two table rows, one seven-row grade table, four description strings, one line in `performPlayerAttack` | 40 lines + 5 recipe rows | nothing |
| Roster | Rows on Stage 4's mechanisms | 0 lines of rules | `kill:` counters |
| Dungeons | 1 pure module, 1 engine module, 1 table with its drop tables; four small edits to pure modules | 500 lines | `dungeons` (two numbers each); nothing of a run, no roll, no pity counter |
| Bosses | Rows | 0 lines of rules | `bossDownUntil` for overworld bosses |
| Diary | 1 pure module, 1 tab, 1 table | 250 lines + 75 task rows | `diary` (claimed tiers) |
| Save recovery | 1 pure module, 1 notice | 150 lines | two more backup keys |

### 14.3 Proposed for later stages

- **The models pass**: the fourteen models of 7.5 and a dungeon kit.
- **Co-op**: section 8's five and Stage 4's remaining blockers; parties, shared dungeons, threat.
- **More dungeons, as rows**; then generated layouts, if hand-made ones run out.
- **A lockout or key economy**, only if co-op makes farming a problem.
- **More skills**: a gathering skill for herbs, farming, an agility skill that uses the relief. Each needs a gather kind or a movement rule this stage does not add.
- **The four open sources** of 7.4 (three foods, bronze bolts).
- **A fourth diary tier** and per-boss challenges (no damage taken, a time), which need a few more counters.
- **The top of the style ladders**: with the best special sets at levels 80 and 90, ranged and magic end a little under melee after the rebalance (7.12). A look at those few items belongs with whatever stage next adds gear.
- **Renaming borrowed names** (the owner's Stage 8).

---

## 15. Owner decisions

### 15.1 Decided by the owner on 2026-11-14

Each answer is quoted as given (translated), with what it settled and where the design now carries it.

| # | The owner's words | What it settles | Where |
|---|---|---|---|
| **CALL-6.8** arrows | "Bows shoot arrows. Good ones and bad ones." | Any bow shoots any arrow. A better arrow does more, a worse one less. The first draft's rule that a better bow needs a better arrow is removed: no bow is ever blocked, and an existing ranger loses nothing to this rule. Grades stay as a way to spend for damage. | 7.4 |
| **CALL-6.7** style balance (and **CALL-6.19**, which it replaces) | "Let's structure the rebalancing, no problem." | Ranged and magic do not stay about twice as fast as melee with only a price. A real rebalance, structured so it can be seen and approved. The structure is decided; its numbers are CALL-6.24 below. | 7.12 |
| **CALL-6.18** aggression, replaced | "Wouldn't it be enough to have aggressive and passive monsters? The aggressive ones attack by default on seeing a player, the passive ones don't. A World of Warcraft feel as well." Confirmed with: an aggressive monster attacks on sight whatever the hero's level; a passive one never starts a fight; the sight radius shrinks as the hero outlevels the monster, down to about strike range; the pass sentries are exempt. And: "of course, in a dungeon everything attacks." | Stage 2's rule (a camp attacks only when the monster's level is at least the hero's combat level) is replaced for the whole game. The dungeon exception of the first draft is deleted as a separate rule: dungeons contain aggressive monsters, which keep their sight inside. | 7.13 |
| **CALL-6.6** diary, in part | The owner agreed that the reward which stopped the pass sentries attacking is removed. | No diary reward touches aggression. What the middle tier gives instead is CALL-6.26 below. | 7.8 |
| **CALL-6.5** no lockout, and **CALL-6.20**, which it answers | "A dungeon is a dungeon; sometimes you have to do it N times to drop a specific item. But a quest is a quest: a quest's reward is taken only once, regardless of whether the quest is opening a chest." | Dungeons stay repeatable with no lockout. Their special rewards are drops with a chance. Nothing in a dungeon is paid once; a quest's reward is paid once, also when the quest's step is opening a chest. One Underkiln clear no longer gives the whole dragon kit. The chances themselves are CALL-6.25 below. | 7.3, 7.6 |
| **CALL-6.23** Runebinding and the diary resemble one game's systems | The owner has said the game takes RuneScape, Tibia and Ragnarok as inspirations and that sharing generic names with other games is not a problem. | Both stay, as borrowed techniques with original content: stones bound into runes at an altar and tiered regional task lists are forms many games share; every name, place, person, task, recipe and number here is this game's own (7.10), and the deny-list test keeps a specific game's names out. | 7.4, 7.8 |

### 15.2 Still open

Each is the lead's proposal with a recommendation. The ones with a real trade-off come first, in plain language. CALL-6.24 to 6.27 are the numbers inside the owner's own decisions; the second pass (critique file, "Second pass") added CALL-6.28 and 6.29 and sharpened 6.24, 6.25 and 6.27.

| # | Decision | Options | Recommendation |
|---|---|---|---|
| **CALL-6.29** | **Strong woodcutters at the top trees.** All seven yew and magic trees stand inside the two moss-guardian camps. Today a hero above combat 45 is never attacked there. With the new rule a combat-70 woodcutter is usually attacked within seconds (in 59 to 100% of 5-minute runs, depending on the tree), keeps chopping while it is hit, and does not hit back, so a player who walks away from the keys can die there. Keeping the guardians at home only reduces it: from some sides of every tree a guardian is still within arm's length. | (a) Accept it: the top trees are guarded for everyone, and the player has to deal with the guardian first. (b) A hit stops the chopping, and Stage 4's "fight back when hit" then takes over, so the hero kills the guardian on its own: a small change to Stage 4's approved rule that a gathering hero is never redirected. (c) Move the two camps' guardians away from the trees (camp rows change; standing still is not enough, they have to move; the trees stop being guarded for weak heroes too). | **(b).** It keeps the owner's rule (aggressive monsters attack) and removes the one bad surprise, dying while away from the keys, without moving the world. If (b) is refused, (a), with a line in the log the first time it happens. |
| **CALL-6.24** | **The numbers of the rebalance.** Ranged: a point of ranged gear adds 0.06 to the max hit instead of 0.22, and the base rises from 2 to 3. Magic: every spell hits half as hard, and the two big spells take half the runes. Melee is untouched. After it, at levels 20, 30 ... 70, ranged is 1.07 to 1.29 of melee and magic 1.02 to 1.31 (today 1.7 to 2.1 and 2.1 to 2.7). **One exception between those levels:** at level 28 magic is 1.43 times melee, just over the 1.4 target, because the third spell arrives two levels before the next staff and sword. **What existing archers and casters lose**, all of it: every bow, hide, staff, robe and spell hits less (a level-70 archer's max hit 67 to 44, a caster's 83 to 41); they level Ranged, Magic and Hitpoints 33 to 50% slower and earn coins from fighting about that much slower; they take longer per kill, so they are hit more and eat more; blood barrage heals half as much per cast; a stack of small-spell runes lasts half as many kills. Nothing is taken from a save and no item changes. Against a boss the three styles take about the same time where two of them took half. | Approve; or approve and accept the level-28 exception, or ask for it fixed (a smaller magic cut below Magic 30 is not possible with one constant; it would need the spell's level or the staff's moved, which the stage does not do); or a milder cut (for example magic at 0.6: 1.2 to 1.6 of melee); or keep the rune counts (then the two big spells cost twice today's per kill); or move any of the three numbers: they are constants, and a test says whether the styles still fit. | **Approve as proposed, with the level-28 exception.** It is the smallest change that reaches the band: three numbers and two spells, no item edited, no boss re-tuned, every fight proof still holding. The owner sees the final table once more on the merged code before it is built (plan O-6.6). |
| **CALL-6.27** | **How quickly a monster's sight shrinks.** Proposed: it is at its smallest (3 units, a melee arm's length, for archers and casters too) when the hero is 10 combat levels above the monster. A hero's combat level runs about 10 ahead of its skills, so a camp "of your level" barely notices you and a camp ten levels up sees you in full. A strong hero is never pulled into a whole camp at once; standing still in a camp for a minute, it is joined by one more monster now and then. By Stage 3's model the middle of the game gets slower than it was tuned: in kills, the mithril kit comes 34% later shop-only and 49% later with bounties and drops; in the model's minutes, 8% and 18% later; the dragon kit 4% later. Every check of Stage 3's pacing test still holds. | 10; or 5 (closer to today's pace: mithril 18% later in kills shop-only); or 20 (monsters of your own level come at you from half distance; mithril 75% later, dragon 8% later). | **10.** Between a rule the player can feel and a pace close to the approved one; 5 is closer to that pace and gives less of the rule. It is one number. |
| **CALL-6.25** | **How many runs a specific thing takes, and whether one Kilnglass is certain.** No counter and no saved luck, ever (owner). Proposed: every Underkiln clear gives 1 Kilnglass for certain, as ordinary base loot, and more by chance, 2.2 on average: the whole dragon kit takes 6.4 clears on average, 8 for nine players in ten, 13 at the very worst; one scimitar 2 or 3. The certain shard is also what lets chapter 6's last step (handing Odalys a shard) always follow its chest step. Three pieces of equipment are pure chance: a Rune Crossbow from the Warren's chest (1 in 20) and the two Bloodbark robe pieces from the Underkiln's (1 in 25 each). Bosses add a small prize (a runite bar, adamant bars, an ingot). | As proposed; or **all Kilnglass by chance** with the same average (18% of clears give none: the kit takes 6.5 clears on average, 9 for nine players in ten, 12 for 99 in 100, with no limit; chapter 6 can need a second clear); or a quicker kit (2 certain a clear: 4 clears on average, 7 at worst); or a slower one; or no equipment in chests at all (then only the extra shards are chance). | **As proposed.** One certain shard is base loot like the Warren's ore, not a protection, and it keeps the story step from waiting on luck; everything else is a plain chance. |
| **CALL-6.28** | **Which arrow is shot.** Proposed: the best arrow in the backpack, always. A player who wants to keep rune arrows for a boss has to leave them in the bank before ordinary fights. | As proposed (nothing new to save); or a quiver: the player picks which stack to shoot, kept in a new equipment slot (one more key in the saved equipment, a small UI, and Stage 3's saved-default golden regenerated once). | **As proposed for this stage**, with a line in the log when the hero starts shooting a better grade, so nobody burns rune arrows without noticing. Add the quiver later if players ask for it. |
| **CALL-6.26** | **What the diary's middle tier gives, now that "peace" is gone.** Proposed: a deposit box at that region's shrine (put things into the bank, not take out), which the top tier turns into a full bank. The main session's suggestion, a bank at the volcanic shrine, would have given that region at the middle tier what the others get at the top, and left its own top tier empty. | A deposit box in every region (proposed); or a bank at the volcanic shrine only, with the other regions' middle tier paying only the ember; or no middle perk anywhere. | **The deposit box.** One kind of perk in every region, a real comfort behind the pass, and the top tier still has something to add. |
| **CALL-6.22** | **Matron Saltfang asks the first boss's question, faster** (critique M4). A different one was tried in the model and is not cheap: a "stay close" ring works for archers and casters and does nothing to a melee hero, so it would need a re-tune for a change two styles feel (7.7). The question that would be hers is a brood to deal with, which needs helpers in the room. | Accept for this stage; or re-tune her around the ring; or hold her for a brood mechanic. | **Accept**, and give her the brood with the models pass, which rebuilds her anyway. |
| **CALL-6.21** | **Working drops makes monsters pay more** (critique M1). Turning a monster's hide into armour, or its bones into runes, can add a third to a half to what it pays, though each drop alone adds at most a quarter. | Accept (it is what the two skills are for, and each recipe is capped at 2.5 times its inputs); or lower the material drop chances. | **Accept.** After the rebalance a caster also spends more runes on the small spells, which takes some of it back. |
| **CALL-6.4** | **A dungeon is short and forgets everything when you leave.** Three to four minutes of rooms for a person, then a boss of about a minute and a half. Leaving, dying or reloading ends the run; nothing of a half-finished run is saved. Reloading inside puts the hero at the door outside. | As proposed; or save the run (the first world state in the save; needs rules for every half-state); or make dungeons long by giving monsters several times the health. | **As proposed.** Monsters die fast in this game; a long dungeon would be the same fights with more waiting. The boss is where the time goes. |
| **CALL-6.3** | **Two new skills, not one and not three.** Crafting (hides and cloth into ranged and magic armour) and Runebinding (blank stones into runes, with bones and ashes). Potions go under Cooking. Arrows and the missing metal tiers go under Smithing. | As proposed; or only Crafting (magic keeps buying runes); or a third skill for potions. | **As proposed.** After it, each way of fighting has a craft of its own. A third skill would need herbs to gather, which is a new kind of node and a model. |
| **CALL-6.2** | **The starter chain gets a person, and nothing else changes.** Bran Tolley speaks each of the six first quests and takes them in. Their steps and rewards are Stage 3's, untouched. Existing characters still do not see the chain. | As proposed; or make "talk to Bran" a required step (breaks Stage 3's 29-action proof); or show the chain to existing characters too. | **As proposed.** |
| **CALL-6.10** | **Six new monsters and three bosses ship on recoloured, resized existing models.** Stage 4 said three of them need new models. They do: a boss that is a big white scorpion is a compromise. The models pass replaces them; the list is written down. Also: the first boss is forgiving on purpose (a careful under-levelled player wins about one fight in four). | Ship as proposed; or hold the dungeons until the models exist. | **Ship.** The fights do not depend on the picture, and waiting would hold half the stage. The later models pass rebuilds every figure as a skinned mesh and may rebuild any of these. |
| **CALL-6.11** | **The save gains one block and two skills, and stays version 4.** An older build of the game opening a newer save would ignore the new parts, and lose them if it saved again. | As proposed; or bump the version and refuse to load newer saves in older builds. | **As proposed.** Nobody is expected to run an older build, and it matches what Stages 3 and 4 did. |
| **CALL-6.12** | **A broken save now stops and asks.** Today the game starts a new character and saves over the broken one two seconds later. The proposal shows a notice instead: start anew (keeping up to three copies of broken saves), load an older save if this browser has one, or copy the save's text. Nothing is overwritten until the player picks. | As proposed; or keep today's silent behaviour with more backups. | **As proposed.** It is one screen almost nobody will ever see, and it closes four debts at once. |
| **CALL-6.13** | **Cinder Adepts and Slag Brutes stand outside the ridge, south of the start town**, not inside the volcanic corner as Stage 4 sketched. Measured, the corner is full. Outside, they are the story's "the ash is spreading" and they sit beside Cinder Stair, which stays safe. | As proposed; or shrink something inside the corner to fit them. | **As proposed.** |
| **CALL-6.14** | **Work done before a quest counts.** If a quest asks for four kills and the hero already has them, that step is done. | As proposed; or count only from the moment a quest is taken (a tally per quest in the save). | **As proposed.** Nobody likes killing the same four monsters again because a person asked late. |
| **CALL-6.15** | **Quest coin.** The seven chapters pay 64,500 GP in all and the side quests 3,800, spread over about thirty hours. | As proposed; or pay only items and experience. | **As proposed.** It is nine minutes of late-game income in total, and early it is about a tenth of the kit of its tier. |
| **CALL-6.16** | **Who writes the dialogue.** About 300 short passages. The proposal: written by Claude from the voices and beats of section 7, then read by a person before merge. | As proposed; or the owner writes or rewrites them. | **As proposed**, with the owner free to rewrite any line: they are data. |
| **CALL-6.9** | **The names**: seven people, thirteen quests, six monsters, two dungeons, two skills, 26 items and the rest (7.10). Generic words are shared with other games by the owner's rule. | Accept; or change any. | **Accept**, subject to the name search. |
| **CALL-6.17** | **What is in and what waits** (14.1, 14.3): a foundation and eight slices now; new models, co-op, more dungeons, more skills and a fourth diary tier later. | | Accept. |
| **CALL-6.1** | **The essence list.** | | Accept. |

---

## 16. Risks

| Risk | What we do |
|---|---|
| The stage is too big to finish. | Slices that each ship alone, cut from the bottom (14.1). The gate after every slice is the full standard gate plus Stage 3's two tests. |
| Stages 3, 4 and 5 land differently from their designs: a function renamed, a parameter missing, a camp where this design put a person. | R0 lists every name and re-runs the placement checks on the merged world before any code. Its failure stops the stage, not a task. The two Stage 4 camps (stalkers south-east of Tamarisk Pool, marksmen north of Lanternway) have no coordinates in its design; the Warren's door, Hesper Moth and the runestone rocks are the placements they could collide with. |
| The writing is flat, and a story nobody reads is worse than none. | Voice notes and beats are fixed here; the text is one task with a human read; every line is data and can be rewritten without code. |
| A dungeon made of boxes looks cheap beside Stage 5's world. | Painted tiles, flat shading, existing props, dark fog and Stage 5's light. If the play check says it does not hold, slice 3 ships its rooms smaller and darker, and the models pass gets the kit first. Recorded as CALL-6.10. |
| The hours of section 1 are wrong. | They are estimates from Stage 3's model and say so; nothing is built on a clock. Chapter levels are the gates, and they are data. |
| Stage 3's pacing model picks the new overworld monsters. It chooses the type with the most hitpoints a second from `CAMPS`: the Adept and the Brute are candidates (the Adept's coins were cut for that, critique H1), and Marrowjaw is a 560-hitpoint target it respawns in 8.35 s. | D4 prints the model's choice per tier. If ECON fails or Marrowjaw is chosen, the declared fallback is to keep Marrowjaw's camp out of `CAMPS` (a `BOSS_CAMPS` list the engine spawns, held to the same world-data rules by D3), not to tune the test or the fighter. |
| New drops and recipes move Stage 3's pacing in play even though its test passes (its model fights and shops only). Worked into armour or runes, drops add 25 to 55% to a monster's coins, against 10 to 24% raw (`critique-results.txt` C). | The 25% bound on drops; the printed crafting incomes; Stage 3's own acceptance of crafting as earning (its F15). The play check of slice 1 and slice 4 looks at it. |
| The rebalance feels like a loss to a player who fights with a bow or a staff today. | It is one: said in 7.12 with the numbers. What softens it is in the same stage (made armour, bound runes, cheaper casts of the two big spells, arrows that add damage), and it lands after those. The three constants are data: if the play check of slice 6 says a style is dead, the owner moves one number and the band test says whether the three still fit. |
| The new aggression makes the middle of the game slower than Stage 3 tuned it (the mithril kit 34% later in kills shop-only, 49% with bounties and drops; 8% and 18% in the model's minutes; 7.13). | Every pacing assertion holds. The model's count is an upper estimate. `SIGHT_GAP` is the lever and the table of 7.13 shows it at 5, 10 and 20. |
| A strong woodcutter dies at a yew while away from the keys (second pass, 7.13). | CALL-6.29; plan G2 does not land without the owner's answer. |
| The rebalance's level-28 exception, or a different band on the merged code. | The band test prints every level; O-6.6 shows the owner the merged table before S1. |
| A rare piece that takes 57 clears for one player in ten reads as a grind. | Only three pieces are pure chance, none is needed, all are in the shop. What the story needs is in the base loot (7.6). The chances are data; no counter (owner). |
| The trackpad rows are thin (Saltfang at 81%). | The same answer as Stage 4: test with a trackpad; the spit's warning is the lever. |
| Fourteen skills do not fit the skills tab. | A human check in slice 4; the fallback is a scrolling grid, which Stage 5's panel allows. |
| The far-offset zone shows something unexpected: shadows, the sky, a horizon apron Stage 5 adds. | Slice 3's first engine task is a bare room with the hero in it, looked at before anything else is built. |

---

## 17. What could not be verified

- **Second pass (2026-11-14), what it re-ran and what it could not.** It re-ran `run.sh`, `pacing-rerun.sh` and `critique-check.sh` (all three reproduce their committed outputs byte for byte, the pacing header aside) and added `second-pass.sh`, which reads `origin/main` itself: the style table at every level, chain-pulling and the high trees with main's `stepMonster` patched, and the Kilnglass variants. It confirmed that `content.ts`'s Stage 3 overlay matches `main` (drop cuts, bars in recipes, bow logs, smelting levels, the gear markup) and that Stage 4's model has not moved since `732cb8c`. It did not run the test suite, and Stage 4 and 5 code still does not exist.
- **Nothing was run but the model scripts.** No test suite, type check, build or dev server. Every claim about a frozen test passing is from reading it, with two exceptions that were run as models: Stage 3's pacing test file, unedited, through a stand-in for vitest (`pacing-rerun.sh`), and Stage 2's gate simulation, transcribed (`aggro-check.ts`).
- **The pacing rerun used Stage 3's world.** Stage 4's two camps and this stage's three overworld camps are not in that branch, so what the fighter does with Stalkers, Marksmen, Adepts, Brutes and Marrowjaw under the new rule is still unrun (critique H2 stands; R0 and D4 run it). The model's new count of attackers is one reading of the rule (linear in the sight left, rounded up); the game's real number depends on where a player stands.
- **The aggression rule was run in a patched copy of Stage 2's `stepMonster`**, not in Stage 4's, which does not exist. That the acquisition block survives Stage 4 as Stage 2 wrote it is read from Stage 4's design.
- **The rebalance was measured on kits chosen by a rule** (best ordinary weapon, body and legs) and on the fight model's fixed fighters. Full kits with helmets, boots, rings and capes were looked at once in exploration and are not in the committed output: magic stayed at 1.07 to 1.30 of melee from level 20 to 70, and ranged with bronze arrows came out lower than in the table, 0.86 to 1.00, because melee's rings and amulets add strength. The band test of G6.13 uses the three-piece kit; S1 prints the full-kit figures beside it so the owner sees both. Special sets at 80 and 90 fall just under melee (7.12).
- **Rune and arrow costs are at sale value of the inputs.** A caster cannot buy bones, so "bound" assumes the caster has them: an ice burst kill at level 70 needs about two big bones' worth of chaos runes and a lesser demon drops dragon bones. Binding covers part of a caster's runes, not all, and how much was not modelled.
- **Stage 3's `combat-profile` and `entry-staff` values** were computed from the formula with the item numbers of this tree; the starter staff's magic bonus (4) is read from Stage 3's branch.
- **Whether best-arrow-first is what players want** (against choosing the arrow) is a guess; it costs no saved field and can change (CALL-6.28).
- **The critique re-ran the model and recomputed the economy independently** (`critique-check.ts`); its corrections are in `results.txt`. It ran no test either.
- **Stages 4 and 5 are designs, not code.** Every Stage 4 name this design uses (`BOSSES`, `ATTACKS`, `PATTERNS`, `model`, `tint`, `modelScale`, `arenaRadius`, the grid and walk-test parameters, `respawnSecs`, `commands.ts`, `sustain.ts`, `buyVow`, `applyDeathLoss`, `vowPrice`) is from its design document. Stage 3 is partly built: `economy.ts`, `STARTER_QUESTS`, `starterView`, `shopPrice`, the freeze and compatibility tests exist on its branch; its drop, recipe and fishing changes had not landed there when it was read, so they are overlaid as constants (`content.ts`, `S3`).
- **The pacing test was not run with this content** (it was run with the new aggression rule on Stage 3's world, above). The claim that this stage's content cannot move it rests on reading: dungeon camps are outside `CAMPS`, no new monster drops equipment, the model plays no story quest. The three overworld camps are in `CAMPS`, and the model's fighter may choose Adepts or Brutes in its printed table; its assertions are order and floors and are expected to hold. R0 and every slice gate run it.
- **Marrowjaw is in `CAMPS`, where Stage 3's pacing model can see it.** It is one target of 560 hitpoints and about 900 coins, and that model gives every type an 8.35 s return, not Marrowjaw's 180 s. By reading, its fighter cannot "win" against it until late (the fight is long and the model allows 60% of its hitpoints lost per kill), and by then lesser demons give more hitpoints a second; this was not run. If ECON moves in D4, the lever is Marrowjaw's row (its coins, hitpoints or basic max hit), never the test.
- **The income comparison of 7.6 is a model**: one fighter per dungeon (every skill at 45 and at 70), melee, no rests on either side, a walk estimated from room centres. It was one-sided in the first draft (a rest charged to the dungeon only) and was corrected; the chests and the two bosses' coins were cut to hold it.
- **Combat level against skill level.** Every gate is a combat level and every fighter's is printed. The gates were set from the melee and ranged rows of the fight table; nobody has played them.
- **The fight model is Stage 4's, with its limits**: one boss, no other monster in the room, a hero who dodges by the shortest way, the attack arithmetic transcribed by hand. The Warren's and the Underkiln's lairs hold only the boss, so the model fits; a boss with helpers would not.
- **The gear table of 4.3 picks "the best ordinary piece" by a rule** (highest bonus the level can wear, special sets left out). Another rule gives other kits; the ratios move by a few tenths, not the conclusion.
- **Stage 4's two camps and Stage 5's trees and props are not in this tree.** Placements were checked against the world on `main` only.
- **No look at the running game.** Whether a person at (4, 12) stands in front of something, whether the bench reads as a bench, whether a zone at x of 1000 is clean of the overworld: all human checks.
- **The hours** of section 1 are twice a model's, extended by a second small model; nobody has played thirty hours of this game at 1x.
- **Originality of the names**: checked against the deny-list by script and against memory, not searched.
- **Bundle size** in section 10 is an estimate.

---

## Review log

- 2026-11-14, critique (`2026-11-14-content-systems-critique.md`), applied in one commit: zones at x 1000 with the dome and apron hidden; the walk test in `stepMonster`; per-monster no-respawn; the Adept's coins; the income comparison with goods on both sides; ember guards; `keepCorrupt` on every exit; every declared replacement (11.3); the critique's owner decisions.

- 2026-11-14, **owner decisions** (section 15.1), applied in one commit:
  - **Aggression** (answer 3). New 7.13: aggressive and passive monsters, the `sightRadius` function (minimum 3, reached 10 combat levels above the monster, `keepsSight` as data on the camp for the sentries, bosses and dungeon camps). CALL-6.18, the flag `ignoresLevel` and the dungeon branch are deleted; 7.6's "everything attacks" row says a dungeon holds aggressive camps that keep their sight. The diary's "peace" perk is removed everywhere and replaced by a deposit box (7.8, CALL-6.26); `perks` is read at three places and none is in `stepMonster`. Declared replacements 8 (one test of `tests/monster-territory.test.ts`) and 9 (two expressions of Stage 3's pacing model). Stage 2's gate simulation rerun: identical for the test's two heroes. Stage 3's pacing test rerun: every assertion holds; kit kills 132 / 354 / 453 / 540 / 824 / 1,558 / 4,606 become 169 / 434 / 637 / 724 / 1,009 / 1,743 / 4,771. Built in the foundation slice, after Stage 4's route-following.
  - **Style rebalance** (answer 2). New 7.12 and G6.13: the target band, three formula numbers (ranged gear 0.22 to 0.06, ranged base 2 to 3, magic x0.5), the rune counts of ice burst and blood barrage halved, the before and after tables of damage and cost per level band, what gets weaker for an existing character, and the effect on every earlier proof. CALL-6.7's "parity of cost" and the anti-goal "no formula change" are replaced; 6.7, 4.3 and the ledger follow. `check-results.txt` now runs every boss row, Stage 4's included, with both formulas: all hold, no boss row changed. Declared replacements 10 and 11 (six pinned values of two Stage 3 tests). A slice of its own, the sixth, after both new skills and before the last boss (14.1).
  - **Arrows** (answer 1). 7.4's ammunition block rewritten: any bow, any arrow; grades add 0, 2, 4, 6 to the max hit; the best carried is shot; nothing is refused. The old last slice is merged into the styles slice.
  - **Dungeons and quests** (answer 4). First-clear chest rewards removed; drop tables with rare entries and expected runs for both dungeons and all three bosses (7.6, `results.txt` 8b); Kilnglass by chance with a certain part (6.4 clears for the kit on average, 13 at worst); the rule and proof that a quest's reward is paid once, also for a chest step (7.3); chapter 3 and 6 rewards take what the first-clear lists held; chapter 6 gets a chest step. Income ratios rerun with rare entries counted: 0.57 and 0.50.
  - **The critique's open points** (answer 5). Saltfang: a different question modelled, found not cheap, left as CALL-6.22 with the measurement. Runebinding and the diary: decided to stay as borrowed techniques (CALL-6.23). Crafting and binding raising a kill's worth: CALL-6.21, recommendation unchanged.
  - Section 15 split into decided (with the owner's words) and open; new open decisions CALL-6.24 to 6.27. Sections 11.1, 11.2, 11.3, 12, 13, 14, 16 and 17 follow. The model gained `aggro.ts`, `aggro-check.ts`, `pacing-rerun.sh` and `vitest-stub.ts`; `model.ts` section 5 is the before and after of the rebalance and 8b the drop tables.

- 2026-11-14, **second pass** (critique file, "Second pass"), applied in one commit:
  - **Aggression**: the high-tree case measured on `main` (attacked within seconds; a gatherer neither stops nor fights back) and made the owner's decision CALL-6.29; the "smaller wander" lever shown not to work; chain-pulling measured; "about strike range" for archers stated; pacing numbers given with bounties and in minutes as well as kills; replacement 9 cut to one expression (the `keepsSight` filter changes no number); `packAttackers` moved to `tests/support`; `pacing-rerun.sh` reads `origin/main`.
  - **Rebalance**: the band checked at every level: level 28 is at 1.43, over the 1.4 target, now said in 7.12 and CALL-6.24; 80 to 99 hold. Losses the first list left out (Hitpoints experience, coins per hour, time under attack, blood barrage's healing, levels 1 and 10) added. An owner step before S1 (plan O-6.6).
  - **Arrows**: `AMMO_GRADES` table instead of a field on item rows; the arrow's power comes from `prepareAttack`, because `performPlayerAttack` removes the arrow before it computes the profile; CALL-6.28 for the player who wants to save rune arrows.
  - **Drops and quests**: the certain Kilnglass reframed as base loot (owner: no protection against bad luck), the counter option deleted from CALL-6.25 and pure chance computed beside it; Stage 3's gear-drop test said not to see chests; the quest-once proof made concrete and the re-earn paths listed.
  - **Diary**: what the deposit box needs in the engine, and the pure `shrineTransfer` that refuses withdrawals.

