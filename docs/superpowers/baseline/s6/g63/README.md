# Slice 3 gate (G-6.3): captures for H-3

**H-3 is still open.** These pictures are evidence for the owner's play check. They do not replace it. The owner still has to talk to Qadir Salt-Hand and Odalys Venn through chapter 3, and do design 11.2's dungeon item on a real screen: enter; the rooms, the minimap, the gate, the chest, the way out; die inside; reload inside; teleport out; fight Matron Saltfang with a mouse and with a trackpad; and read the perf HUD inside (plan G-6.3).

## How the pictures were made

- **Tree:** `feat/content-systems` at `ba82817`, which is slice 3: Z1 to Z7, B2 and their repairs.
- **Build and server:**
  - BUILD ran through the capped wrapper.
  - Then `node_modules/.bin/vite preview --port 4394 --strictPort` served that `dist/` on the host.
  - The shell line checked that the port was free first. Afterwards it stopped the server by its PID and checked that nothing was left listening on 4394. The committed job does not do this.
- **Command:** `CAP_URL=http://localhost:4394/ CAP_OUT=<dir> node scripts/capture-gpu.mjs docs/superpowers/baseline/s6/g63/capture-job.mjs http://localhost:4394/`, exit 0.
  - Every picture and `facts.json` here comes from one run of the committed job, copied unchanged.
  - Earlier runs of the job failed on its own body check. It first looked for bones named `saltfang_`, then for a node named `Monster_saltfang`. Neither exists in the live scene: the loader strips the bone prefix and moves the clone's children into the rig group. The check now reads the skinned meshes of the figure that stands in the lair.
  - Shot `c2` was added after one run showed that the Matron does not engage a hero 6 from her (finding 2 below).
- **Renderer:** headless Chromium on the NVIDIA GPU, `ANGLE (Microsoft Corporation, D3D12 (NVIDIA GeForce RTX 4070 Laptop GPU), OpenGL 4.6)` (`facts.renderer`). 1280x720, quality tier `balanced`.
- **Browser state:** each scene got a fresh browser context, so storage started empty and the game began as a new game. `Math.random` was seeded as in G-6.0. The onboarding panel was hidden, the run waited for `look.ready()`, then waited 3.5 s for the aggression grace, and the mouse was parked on `#top-left-hud`.
- **Hero:** set up through `__DEBUG.STATE` so that it may use the door:
  - every combat skill is 70 (combat 89);
  - `ml_wards` and `ml_east` are claimed;
  - `progress.story` is `{ ml_salt: 3 }`, which is Qadir's stage, where the door is open.
  - The hero has no gear. The badge reads "Combat Lv. 3" until a fight refreshes it, as in G-6.0 and G-6.1.
- **The door is used as in play:**
  - The job placed the hero 3.5 south of the door at (106, 74).
  - It found the door by the game's own hover label ("Interact with Saltfang Warren", `facts.*.door`) and clicked it through the game's own mousedown handler.
  - The hero walked to the door, the `enterDungeon` command checked the needs, and the zone was built.
  - Inside the zone, the hero was moved with `__DEBUG.look.pose`. The lair was reached that way too, past the shut gate.
  - Nothing under `src/` was patched, and monsters ran on the game's own loop.
- **The Matron's body:** the job reads the live scene through three.js's devtools hook, as G-6.1 did. In the lair, the figure is drawn by the skinned meshes `saltfang_body` (2,992 triangles), `saltfang_shell` (4,370) and `saltfang_sting` (480). Each is on a 20-bone skeleton, at scale 2.82. These are `Monster_saltfang`'s meshes in `monsters.glb` (MB1). The scorpion's own meshes are `scorpion_*`. The job throws if any page or console error is logged, if the door does not let the hero in, or if a skinned mesh in the lair is not a `saltfang_` mesh.

## The pictures

| File | Scene | What the run read (`facts.json`) |
|---|---|---|
| `a1-door-overworld.jpg` | The Warren's door: the sandstone arch at (106, 74) in the dunes. The hero stands 3.5 south of it | HP 70/70. No error |
| `a2-entry-room.jpg` | The entry room, as the game leaves the camera after the door | The hero is at (1012, -168), which is the row's `entry` (12, 32). The log line is the door's prompt: "Saltfang Warren: needs Combat 50, Salt on the Wind (stage 3) or Salt on the Wind (stage 4) or Salt on the Wind (done)." |
| `a3-entry-room-high.jpg` | The same room from high up (camera distance 22, pitch 0.95). The rooms, the corridors, the walls and the black around them are visible | Overworld grass and weather are drawn over the floor and over the dark outside the rooms (finding 1) |
| `a4-minimap-entry.jpg` | The minimap in the entry room | The rooms near the hero are drawn as rectangles, the shut gate as an orange bar, and the zone's monsters as dots. The lair and the brood are past the frame's edge at this zoom |
| `b1-nest-from-corridor.jpg` | The nest, seen from corridor `c1` (local 23, 32), looking east | Skitters are in view. HP 70/70 |
| `b2-nest-fight.jpg` | The hero stands in the nest (local 30, 32), 3 s later | The skitters came, as a camp that keeps its sight should. "Defeated Scree Skitter (Lv-30). Looted Bones. Looted 53 GP". HP 63.5/70 |
| `c1-matron-idle.jpg` | The lair, with the hero 13 north of the Matron, just inside the shut gate. She is idle | She is drawn on her own body: the white salt-crusted carapace, the egg sacs, the forked violet sting. The gate slab is in the foreground |
| `c2-matron-6-away-3s.jpg` | The hero 6 north of her, 3 s later | **She has not come.** No target, no boss bar, HP 70/70 (finding 2) |
| `c3-matron-fight-3s.jpg` | The hero 4 north of her, 3 s later | She attacks. Boss bar "Matron Saltfang · Marks: 0 · 950 / 960". HP 45.5/70 |
| `c4-matron-fight-6s.jpg` | 3 s after `c3`, with no new pose | "Marks: 1", 903/960. HP 15.3/70. The hero is unarmed, so this is not a balance reading. `look.bench(120)` after this shot: 7.52 ms a frame |

## Gate status (runs of 2026-11-27 on `ba82817`)

Each command ran from the worktree root behind `flock /tmp/claude-capped.lock scripts/capped.sh`:
- **SUITE** (`npx vitest run`): exit 0. 150 files, 1735 passed, 3 skipped. G-6.2's run had 147 files and 1670 tests.
- **TYPES** (`npx tsc --noEmit`): exit 0, no output.
- **BUILD** (`npm run build`): exit 0.
  - The JS chunk `dist/assets/index-CV20EYk1.js` is 1,190.03 kB (gzip 339.98 kB), and the CSS is 39.82 kB.
  - This is reported only, since the owner retired the hard limit. G-6.2's chunk was 1,166.83 kB.
- **ECON:** `tests/pacing.test.ts` passed 11 of 11, and `tests/economy-invariants.test.ts` passed 7 of 7.
- **MODEL** (`bash docs/superpowers/research/content-model/run.sh`): exit 0.
  - `results.txt` ends with `ALL CHECKS PASS`, `check-results.txt` with `EVERY BOUND HOLDS, WITH TODAY'S FORMULA AND WITH THE REBALANCE`, and `aggro-results.txt` with `ALL AGGRESSION CHECKS PASS`.
  - `check-results.txt` and `aggro-results.txt` came out byte-identical to the committed files.
  - `results.txt` changed in one line: the "shipped so far" list gained the nine ids of slice 3. Those are `adamantite_ore`, `adamant_bar`, `adamantite_rock`, `scree_skitter`, `saltfang`, `smelt_adamant` and the three adamant forging recipes. Each was shipped with the content file's numbers; drops are exempt until K2.
  - That regenerated file is committed with this gate, under a proposed amendment in the plan (the same kind as G-6.1's and G-6.2's).

**Each task's diff against its file list** (`git diff c8b826f ba82817`, where `c8b826f` is the last commit of G-6.2):
- **Z1:** `tests/zone-rules.test.ts`, `tests/support/dungeonFixture.ts`. The file `tests/support/dungeonRows.ts` was added by the first commit and folded back into the fixture by the repair, so it is not in the tree.
- **Z2:** `src/state/dungeon.ts`, `pathfind.ts`, `collision.ts`, `terrain.ts`, `monsterAi.ts`, `progress.ts`, `src/data/dungeons.ts`. `worldMap.ts` was not needed.
- **Z3:**
  - `tests/dungeon-data.test.ts` and `tests/support/income.ts` (new).
  - The declared edits: `tests/content-freeze.test.ts` (ids only), `src/__tests__/blender-hero.test.ts` (16 to 18), and `tests/new-monsters.test.ts` (`NEW` gains the two types).
  - The edits declared by O-6.1b.1 for Z3: `tests/monster-kits.test.ts` (item 2), `tests/monster-models.test.ts` (item 3, two rows), `tests/fixtures/size-refactor-golden.json` (item 8), and `tests/recipes-bars.test.ts` (item 9, three rows).
  - `tests/content-s6.test.ts` was not edited.
- **Z4:** `src/data/dungeons.ts`, `world.ts`, `extras.ts`, `attacks.ts`, and `src/data/recipeTable.ts`. `recipeTable.ts` is the file that holds `FORGE_RECIPES` since the F2 amendment, so it is the file R0's rule names in place of `recipes.ts`. Under the ratified Z4 amendment there are also `tests/support/starterChain.ts`, `tests/support/pacingModel.ts`, `content.ts` line 251 and design 7.7. `CAMPS` is unchanged.
- **Z5:** `src/data/story.ts`, `src/data/dialogue.ts`.
- **Z6:** `src/engine/zones.ts`, `context.ts`, `loop.ts`, `input.ts`, `overlay.ts`, `actions.ts`, `sky.ts`. Under the Z6 repair amendment there are also `src/data/dungeons.ts` (the `props` type), `src/engine/worldMesh.ts` (one line) and `src/engine/runtime.ts`.
- **Z7:** `src/engine/zones.ts`, `spawns.ts`, `loop.ts`, `worldBuild.ts`, `session.ts`, `actions.ts`, `src/state/commands.ts`. Neither `stepMonster` nor the overworld spawns were edited.
- **B2:** `tests/boss-saltfang.test.ts`. No boss row changed.
- **Also in the range:** the plan's amendments, and the main session's workflow files `docs/superpowers/workflows/stage6-slices-3-3b.js` and `stage6-slices-3-3b-b.js`.
- **No other file changed.** The **Z5 and Z6 repair amendments are still written as awaiting ratification by the main session**. This gate does not ratify them.
- **Frozen tests:** I read every existing test file edited in slice 3 line by line. Each edit only adds ids, rows or keys, raises a count to the declared number, or is the declared Z4 filter. No assertion was removed or loosened.
  - The `plans` digest of the size-refactor golden was regenerated once. Its existing `telegraphs` entries are byte-identical, and two keys were added. SUITE passes the item-8 check on it.

## The read of every passage Z5 added or changed

Z5 added or changed 11 Qadir nodes, 5 Odalys nodes, 1 Tamsin node and 2 Hesper nodes, plus the five journal lines of `ml_salt`. Each was read once for sense, for voice and against the rules of Q6. The tests already check length, option count, markup characters, the forbidden words, reachability and the once-only rule.

**Passages to rewrite: none.**
- **Voices.**
  - Qadir bargains and counts: "I count the way I weigh, to the grain", "Not a coin less", "I will not say that twice".
  - Odalys is dry and exact, and talks about lamps as patients: "burning its own wick", "white at the edge", "I can do that much arithmetic".
  - Tamsin is curt and talks about metal.
  - Hesper speaks in half sentences. `salt_lit` ends at "very nearly", and its option leads to `nearly`, which starts with "sorted." That is the broken-sentence rule G-6.2 checked.
  - Nobody explains the interface or mentions another game.
- **The story against the data:**
  - Qadir sends the hero to "four" stalkers. That matches stage 1, `kill:saltback_stalker` 4.
  - The stalkers are "on the shore in the far south-east". The `saltback_shore` camp is at (103 to 109, 104 to 109).
  - Qadir is "in the dunes, past the end of Saltwind Track". He stands at (60, 66), and the track ends at (68, 55).
  - The door is "east of the gold veins in the dunes". The door is at (106, 74).
  - The Warren has "three halls before hers", and the gate opens when "all three halls are quiet". The gate's `opensWhen` is `nest`, `gallery` and `brood`.
  - The halls hold "Skitters ... Stalkers, with marksmen standing behind". The nest holds 8 skitters. The gallery holds 3 stalkers with 2 Thornwatch Marksmen at its far side. The brood holds 6 skitters and 2 stalkers.
  - "What dies in there stays dead until you leave" matches `respawn: false`. "Only the first room is safe" matches `zoneSafe`, within 6 of the entry.
  - "She sweeps the sting in an arc and she spits brine a long way, and she shows you each before it lands" matches `sting_arc` and `brine_spit`, each with its wind-up.
  - "The chest is yours each time she dies" matches the chest, which is armed by the boss's death and rolled on every clear.
  - "She will breed back ... Kill her again whenever you want" matches a new run on each entry.
- **Spoken rewards against the row:**
  - Odalys pays "the guild fee" (4,000 GP), "eight bars of adamant, which Qadir sent up" (8 `adamant_bar`), "an ember, steadier than the last" (`ember_steady`), and "Warrenbreaker".
  - Qadir's "the coin is the Lampwright's to pay ... my share is metal off the caravan" agrees with that.
  - The 2,000 Crafting XP of design 7.3 is not spoken and not paid. See the known gap below.
- **Order:**
  - Hesper says "She always sent them here fourth". `ml_hollow` is chapter 4.
  - Odalys's `salt_idle` names the Lanternway, west, and Hesper. Hesper is at (-52, -10).
  - The greet lists reach each node only at its stage: Qadir 0 to 4, Odalys at 4. Every `start`, `advance` and `finish` option pins its stage in `when`.

**Known gap, reported as Z5's amendment asks:** a player who finishes chapter 3 on this slice gets everything in design 7.3's reward except the 2,000 Crafting XP (`ml_salt.reward.xp` is `{}`). The skill arrives with K2. K2 is meant to close this, and G-6.4 checks it is closed, but only once the main session ratifies the Z5 repair amendment, which is still unratified.

## Findings for the main session (none is fixed here: each is outside this gate's files)

1. **The overworld's grass and weather draw inside the zone.** This fails Z6's own [HUMAN] check ("the overworld, the sky, the apron and any cloud are not visible").
   - In `a2`, `a3`, `b1`, `b2` and `c1` to `c4`, the grass carpet covers the dungeon floor and the black outside the rooms. The falling streaks and motes of the weather are also drawn.
   - The carpet follows the hero (`updateCarpet(heroX, heroZ, tier)`, `src/engine/flora.ts`). The particles follow the camera (`updateParticles`, `src/engine/particles.ts`). `enterZone` hides the sky and the clouds only.
   - The fix is an engine repair of Z6 that hides the carpet, the flora and the particles while `G.zone` is set and restores them in `leaveZone`. `flora.ts` and `particles.ts` are not in Z6's list, so it needs an amendment.
2. **Matron Saltfang engages only a hero within 5 of her, not her `aggro` 12.**
   - `zoneCamps` (`src/state/dungeon.ts`) gives each zone camp the radius `ceil(spread of its members + 4.5)`. For the lair, a camp of one, that is 5.
   - `stepMonster` acquires a hero only when the hero is inside that circle, as well as within the sight radius. `c2` shows the hero 6 from her, untouched, after 3 s. `c3` shows the hero 4 from her, fought.
   - The halls' camps have a wide spread, so the effect there is small. In the lair, `aggro: 12` and design 7.6's "everything attacks" are moot.
   - No test pins a zone camp's radius. Z1's acquisition case uses the fixture's hall camp, whose members are spread out, with the hero placed toward the camp's middle.
   - The smallest repair is in `zoneCamps`: the radius is at least `aggro`, or at least `arenaRadius` for a boss camp. That is a Z2 file, and it would need a Z1-style test case. B2's fight model does not read the camp, so no bound moves. Slice 3a's caves use the same function, and C1's cave acquisition cases (8.9 and 11.9 from a member) would also depend on this circle.
3. **The door's prompt.** Clicking the door prints its needs line every time it is used from outside, even when the hero meets them, before the hero enters (`loop.ts`, the `door` branch).
   - The line reads "needs Combat 50, Salt on the Wind (stage 3) or Salt on the Wind (stage 4) or Salt on the Wind (done)". The stage numbers count from 0, and the player never sees them anywhere else.
   - This is for the owner to judge at H-3. It is not a defect against a test.
4. **The two repair amendments of slice 3 (Z5, Z6) await ratification.** Finding 1 also bears on the Z6 one.

## What these pictures cannot prove

- That chapter 3 can be played through, with Qadir's and Odalys's conversations in play.
- The gate opening, the chest, the way out, a death inside, a reload inside, and a teleport out. None of these was captured. Headless, they are covered by `tests/zone-rules.test.ts` and by Z7's verification.
- Whether the Matron's fight is fair with a mouse and with a trackpad. The hero in these pictures was unarmed and only stood there.
- Frame rate on the owner's machine. The HUD and `bench` figures come from a shared machine.

**H-3 stays open for the owner.**
