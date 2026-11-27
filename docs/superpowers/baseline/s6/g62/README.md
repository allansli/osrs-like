# Slice 2 gate (G-6.2): captures for H-2

**H-2 is still open.** These pictures are evidence for the owner's play check. They do not replace it. The owner still has to talk to all seven people as a new and as a late character, play chapters 1 and 2 from a new game with only the journal and the tracker as a guide, and take a reward with a full backpack, all on a real screen (plan G-6.2, design 11.2, first three items).

## How the pictures were made

- **Tree:** `feat/content-systems` at `a81fb1b`, which is slice 2 (Q1 to Q9 and their repairs). The lanes ran one after the other on this branch, so there was nothing to merge.
- **Build and server:** BUILD through the capped wrapper, then `node_modules/.bin/vite preview --port 4393 --strictPort` of that `dist/` on the host. The shell line checked that the port was free first, stopped the server by its PID afterwards, and checked that nothing was left listening on 4393. The committed job does not do this.
- **Command:** `CAP_URL=http://localhost:4393/ CAP_OUT=<dir> node scripts/capture-gpu.mjs docs/superpowers/baseline/s6/g62/capture-job.mjs http://localhost:4393/`, exit 0. Every picture and `facts.json` here comes from that one run of the committed job, copied unchanged.
- **Renderer:** headless Chromium on the NVIDIA GPU, `ANGLE (Microsoft Corporation, D3D12 (NVIDIA GeForce RTX 4070 Laptop GPU), OpenGL 4.6)` (`facts.renderer`). 1280x720, quality tier `balanced`.
- **Browser state:** each scene got a fresh browser context, so storage started empty and the game began as a new game. `Math.random` was seeded as in G-6.0. The onboarding panel was hidden and the run waited for `look.ready()`.
- **Driving the game:**
  - The hero was placed with `__DEBUG.look.pose`, 3 units (Bran) or 2.5 units (Odalys) south of the person, inside the talk radius of 4.
  - The job found the person by the game's own hover label, with one scan of synthetic mousemoves on the canvas, and clicked there with the game's own mousedown handler.
  - Options were chosen with the panel's own keys (`1`), and the log was opened with the HUD's Quests button.
  - Nothing under `src/` was patched.
- **Checks in the job:** the job fails if the panel's line is not the table's line for that node, if any page or console error is logged, or if the panel is still open after an option that ends the conversation. No error was logged in either scene.
- **Scene B's setup:** this scene stands in for a hero who has finished the starter chain. The job wrote the chain's seven ids (`arrival` to `sq_coin`) into `quests.claimed` through `__DEBUG.STATE`. It also set attack, strength, defence and hitpoints to 20 there (combat 23), so that A Vow Kept (combat 15) is on offer. Everything after that went through the game.

## The pictures

| File | Scene | What the run read (`facts.json`) |
|---|---|---|
| `d1-bran-new-game.jpg` | **A new game talks to Bran Tolley** (4, 12). Combat 3, the starter chain at its first open quest | Speaker "Bran Tolley". The line is `ledger_open`, the design's sample line. Its options are "Where is the task master?", "Who are you?" and "I will sign the ledger.", each with its number key. The tracker reads "A Name in the Ledger / Speak with the task master and accept a task" (Stage 3's open starter quest comes first, as designed) |
| `d2-odalys-offer.jpg` | **A hero with the chain done talks to Odalys Venn** (-8, -6), by the altar | `wards_offer`, with four options: "What do you need?", "What are the wards?", "Who are you?", "Not now." The tracker reads "Lumbridge Foundations / Open the Lumbridge Bank". That is the live tracker (the badge has already redrawn to combat 23). With the chain claimed and no story quest active, `adventureTracker` falls through to Stage 3's discovered-region rule, which names the first unclaimed `QUEST_DEFS` quest of a discovered region. That follows design 7.3's order, so it is not a defect. The step "Open the Lumbridge Bank" shows only because the job claimed the chain without setting the flags that playing it sets (`openedBank`). A hero who really played the chain would see that quest's next unmet step |
| `d3-odalys-brief.jpg` | **Key 1 pressed**: "What do you need?" starts `ml_wards` | `wards_brief`, with "Three measures of ashes. I will bring them.", "What are the wards?" and "Give me a moment." |
| `t1-tracker.jpg` | **The tracker line**, after key 1 again ("Three measures of ashes. I will bring them.": `advance`, then the end) | The panel closed. `progress.story` is `{ ml_wards: 1 }`. The tracker reads "The Guttering Wards / Burn logs at a forge until you carry 3 Ashes.", with the meter at 1 of 4. It redrew without help from the job |
| `t2-tracker-in-hud.jpg` | The same moment, the whole screen | The tracker is in its place under the health bars |
| `j1-journal.jpg` | **The Adventure Log**, opened with the Quests button. It opens on the Journal tab | "Active quests": ★ The Guttering Wards, with its stage line. "Quests on offer": ○ A Vow Kept, "Giver: Odalys Venn · Place: Lumbridge Haven", "Needs: Combat level 15". "Completed quests (0)", collapsed. Tasks and Diary are the other two tabs |

## Gate status (runs of 2026-11-27 on `a81fb1b`)

Each command ran from the worktree root behind `flock /tmp/claude-capped.lock scripts/capped.sh`:
- **SUITE** (`npx vitest run`): exit 0. 147 files, 1670 passed, 3 skipped. G-6.1's run had 140 files and 1574 tests.
- **TYPES** (`npx tsc --noEmit`): exit 0, no output.
- **BUILD** (`npm run build`): exit 0. The JS chunk `dist/assets/index-BratBHK0.js` is 1,166.83 kB (gzip 332.64 kB), and the CSS is 39.82 kB. This is reported only, since the owner retired the hard limit. G-6.1's chunk was 1,109.07 kB.
- **ECON:** `tests/pacing.test.ts` passed 11 of 11, and `tests/economy-invariants.test.ts` passed 7 of 7.
- **MODEL** (`bash docs/superpowers/research/content-model/run.sh`): exit 0.
  - `results.txt` ends with `ALL CHECKS PASS`, `check-results.txt` with `EVERY BOUND HOLDS, WITH TODAY'S FORMULA AND WITH THE REBALANCE`, and `aggro-results.txt` with `ALL AGGRESSION CHECKS PASS`.
  - `check-results.txt` and `aggro-results.txt` came out byte-identical to the committed files.
  - `results.txt` changed in one line: the "shipped so far" list gained `ember_faint`, `ember_steady` and `ember_bright` (Q6), each shipped with the content file's numbers. That regenerated file is committed with this gate. The file is outside every task's list, so the plan has a proposed amendment for it (same kind as G-6.1's).
  - **What MODEL does not cover.** Its "shipped so far" check compares shipped items, nodes, recipes, monsters and camps with the content file. It does not compare the shipped people or story quests: those are only counted (7 people, 13 story quests, from the content file). So "MODEL passes" says nothing about them. They are covered by `tests/npc-placement.test.ts`, `tests/story-data.test.ts` and `tests/dialogue-data.test.ts`, which pass in SUITE.

**Each task's diff against its file list** (`git diff 9fff0ce a81fb1b`, where `9fff0ce` is the last commit before Q1):
- **Q1:** `tests/dialogue-rules.test.ts`, `tests/support/dialogueFixture.ts`.
- **Q2:** `src/state/dialogue.ts`, `src/state/progress.ts` (the `talk:` keys, and the story table's stage counts for the reader), `src/data/npcs.ts`, `src/data/dialogue.ts`, `src/data/story.ts`, and the `src/state/story.ts` stub.
- **Q3:** `tests/story-rules.test.ts`.
- **Q4:** `src/state/story.ts`, `src/state/adventure.ts`, `src/state/save.ts`, `src/state/inventory.ts`.
  - In `adventure.ts`, the two story entries of `adventureTracker` were added, and `grantExactXp` and `canHoldRewards` were exported. `QUEST_DEFS`, `STARTER_QUESTS`, `questView`, `starterView` and `claimQuest` are unchanged.
  - In `inventory.ts`, only the two ember guards changed.
- **Q5:** `tests/dialogue-data.test.ts`, `tests/story-data.test.ts`, `tests/npc-placement.test.ts`, `tests/support/satisfy.ts`, plus the declared edit to `tests/content-freeze.test.ts`. That edit only adds the three embers.
- **Q6:** `src/data/npcs.ts`, `story.ts`, `dialogue.ts`, `extras.ts`. The Q6 repair made two test edits: `tests/npc-placement.test.ts` (Q5's own new file) and `tests/content-s6.test.ts` (adds a reward source, and adds `ember_bright` to `LATER_SLICE_CLOSES`). Both are under the Q6 amendment.
- **Q7:** `src/engine/worldBuild.ts`, `loop.ts`, `input.ts` (one `talk` label line), plus `src/state/commands.ts` under the Q7 amendment. `context.ts` was not needed.
- **Q7t:** `tests/dialogue-ui-scan.test.ts`, `tests/commands-s6.test.ts`.
- **Q8, Q9:** `src/ui/dialogue.ts`, `journal.ts`, `stations.ts` (the Tasks tab keeps its scroll), `hud.ts`, `playerActions.ts`, `src/state/commands.ts`, `index.html`, `src/ui/styles.css`. `src/ui/dialogue.ts` and `src/engine/loop.ts` are also under the Q9 repair amendment.
- **Also in the range:** the plan's amendments and the main session's workflow file `docs/superpowers/workflows/stage6-slices-2-3b-b.js`.
- **No other file changed.** The Q6, Q7 and Q9 amendments are still written as **awaiting ratification by the main session**. This gate does not ratify them.
- **Frozen tests:** the only existing test files edited in slice 2 are `tests/content-freeze.test.ts` (ids added, declared) and `tests/content-s6.test.ts` (the Q6 amendment). Every other test file in the diff is new.

## The read of every passage (`src/data/dialogue.ts`, 110 nodes, seven people)

Every passage was read once for sense, for voice and against the rules of Q6. The tests already check length, option count, markup characters, the two forbidden words, reachability and the once-only rule. This read covered what they cannot check.

**Passages to rewrite: none.** The read found no line that breaks Q6's rules or contradicts the game:
- **Voices.** Each person keeps the voice of design 7.2's table:
  - Bran: short and blunt.
  - Odalys: dry and exact, and talks about lamps as patients.
  - Pell: loud and talks in food.
  - Tamsin: curt, and talks about metal.
  - Qadir: bargains.
  - Corin: plain.
  - Hesper: half sentences.
  - The three sample lines of design 7.2 are used word for word (`ledger_open`, `wards_what`, `warn_low`).
- **Interface talk.** Nobody explains the interface or mentions another game.
- **Hesper's broken sentences.** Every passage of hers that ends mid-sentence (`hello`, `sent`, `keep`, `lantern`, `who`, `soon`) leads, apart from options that end the conversation, only to a passage that starts with the missing words (`sent`, `keep`, `when`, `burn`, `later`, `when`).
- **Spoken numbers against the conditions:**
  - Tamsin's and Odalys's "combat fifteen" match `EAST_NEEDS`.
  - Bran's "forty" matches `TOLL_NEEDS`.
  - Pell's "Cooking thirty and combat twenty" matches `KETTLE_NEEDS`.
  - Qadir's "combat fifty" matches his `soon` greet and `ml_salt`'s 50.
  - Corin's fifty and sixty match his greet levels.
  - Bran's "Iron ... wants Attack and Defence five" matches the iron gear's `req` and Stage 3's `sq_coin` text.
- **Spoken rewards against each reward row:**
  - Starter chain: the bronze blade, the cooked fish and a few coins (3 shrimp, 25 GP), the helm, the wooden kiteshield, the hazel staff with runes, and the boots.
  - Chapter 1 pays guild coin and an ember. Chapter 2 pays a guild fee and an ember.
  - Tamsin's four bars and Pell's glands and two vials.
  - Odalys's payment for the vow news is the vow quest's 1,000 GP.
  - Bran gives a purse, an ember and the title Tollbreaker.
- **Directions against coordinates** (north is -z, east is +x):
  - Bran is south of the bank: (4, 12) against (2.2, 4.2). The task master is "behind me, by the bank" at (5.5, 8.5).
  - The forge and range are north-east of the bank, at (10, -4). The store is west of the bank, at (-7, 5).
  - Odalys is "by the altar, north of the store": (-8, -6), with the altar at (-10, -4).
  - The coal seams are east of the east forge: x 104 to 108, against Tamsin at 88.
  - Marrowjaw is "north, past the castle": (7, -73), with the castle at (0, -25).
  - Cinder Stair runs south to the cairn at (-8, 50).
  - Saltwind Track goes south-east, down to the sand, and the Lanternway goes west.
- **Place names.** Cinder Stair, Wardstone Cairn, Cinderstep Pass, Harrowback Ridge, Millrace Road, Saltwind Track, the Lanternway and the Hollow are all in `src/data/worldMap.ts`.
- **The cairn sign.** Corin says "go through prepared or not at all. I painted that". That matches the cairn's `sign`.

For the main session, none of which is a rewrite of the dialogue:
1. **Design 7.3 contradicts itself on `sq_toll`.** The side-quest table and the content file say combat 40, but the save table says Bran "offers `sq_toll` at combat 32". The data and Bran's "forty" follow the content file. The save table's 32 is the line to correct.
2. **Design 7.2's table puts Odalys "west of the store".** At (-8, -6), with the store's merchant at (-7, 5), she is north of it, by the altar. The dialogue and the journal say "north of the store", which matches the world, so the design's cell is the one to correct.
3. **A naming gap for the H-2 check.** Odalys says "Burn three logs at any forge", and the journal says "Burn logs at a forge". The forge window lists the recipe as "Burn Logs (Campfire)", so a new player may look for a campfire. The text describes where the burn really happens (the forge window, at either forge), so no rewrite is proposed. The owner should judge it at H-2.
4. **The refusal line for a missing item.** `src/ui/dialogue.ts` shows "Make room first." for both "Your backpack is full." and "Missing required item.". For a `take` that cannot be paid, "Make room first." does not make sense. No data path reaches it today: every `take` option's `when` also asks for the item, and `chooseOption` checks the `when` again first. It is left as a note, not changed. Every full-backpack path (`give`, `finishQuest` and `claimStarter` through `claimQuest`) returns exactly "Your backpack is full.", so all of them show "Make room first.".
5. **For H-2: the tracker between the chain and chapter 1.** Once the starter chain is claimed, and until Odalys's chapter 1 is accepted, the tracker names Stage 3's next unclaimed region quest (`d2`), not Odalys. Bran's `gate_new` line is what points the hero to her. This follows design 7.3's order. The owner's "never unsure where to go next" check should judge this gap.

## What these pictures cannot prove

- How the conversations read in play, and whether chapters 1 and 2 can be followed from the journal and the tracker alone. The run played two conversations, not the chapters.
- Five of the seven people (Pell, Tamsin, Qadir, Hesper, Corin) and the late-character greetings were not captured.
- A reward with a full backpack was not captured. That case is covered headless by `tests/dialogue-rules.test.ts` and `tests/story-rules.test.ts`, and on screen it belongs to the owner's H-2 run.
- Frame rate and timing on the owner's machine. The HUD's FPS figures come from a shared machine.

**H-2 stays open for the owner.**
