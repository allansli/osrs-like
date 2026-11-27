# Slice 0 gate (G-6.0): captures for H-0

**H-0 is still open.** These pictures are evidence for the owner's play check. They do not replace it. The owner still has to do the save-recovery check, the Ashmantle reload, the walk through the pass at combat 75 and the look on a real screen (plan G-6.0, design 11.2).

## How the pictures were made

- Tree: `feat/content-systems` at `e805219` (G2 landed). `npm run build`, then `vite preview` of that `dist/` on port 4391. The server was started and stopped by PID in the same command.
- Renderer: headless Chromium on the NVIDIA GPU through `scripts/capture-gpu.mjs`: `ANGLE (Microsoft Corporation, D3D12 (NVIDIA GeForce RTX 4070 Laptop GPU), OpenGL 4.6)`. Resolution 1280x720, quality tier `balanced`.
- Every scene got a fresh browser context, so storage started empty and the game began as a new game. `Math.random` was seeded the same way as Stage 5's `capture.md`. The onboarding panel was hidden, the run waited for `look.ready()`, and the mouse was parked on `#top-left-hud`.
- The run waited 3.5 s after load so the 3 s aggression grace would end. The hero was then placed with `__DEBUG.look.pose`. Skills were set through `__DEBUG.STATE`, with xp taken from the OSRS curve.
- Nothing under `src/` was patched. Monsters ran on the game's own loop and the G2 rule. The gather was started with the game's own click handler.
- **`facts.json` was assembled by hand from earlier runs, and the committed `capture-job.mjs` does not reproduce it.** The job versions that made the pictures and `facts.json` were not kept. The committed job is a later edit of them: the same scene setup and the same reads, but different output. It writes `facts.scenes.{a1_scorpions_new_hero, a2_scorpions_strong_hero, b_three_kettle_passive, c_yew_gatherer}` with `before` and `chatTail` fields, and the pictures `c1-yew-chopping-try<N>.jpg` and `c2-yew-hit-fighting-back.jpg`. `facts.json` instead holds `camps` (the three camp scenes, with `hpBefore` and `chat`), `yewRunPictures` (the one attempt of the run that took `c1-yew-chopping.jpg`, `c2-yew-hit.jpg` and `c3-yew-after-hit.jpg`) and `yewRun10Attempts` (the ten-attempt run, which took no picture that is committed). Treat the committed job as a record of the method, not as the script that produced these files. A rerun of it gives new pictures and a new `facts.json` in its own shape.
- The run behind `yewRunPictures` did not record `moving`. Its `gatheringWhenHit: true` therefore means only "the target was the yew in the frame before the hit". By the position, the hero was still walking to the second yew (see the table), so that field is not evidence of a hit on a hero standing and chopping.

## The pictures

| File | Scene | What the run read (facts.json) |
|---|---|---|
| `a1-scorpions-new-hero.jpg` | **Aggressive camp, low-level hero.** A new hero (combat 3) placed at (48, 33), 6.4 units from the nearest King Scorpion (level 12) of `dune_nest_west`. Picture taken 4 s later | First hit at 1.0 s. HP went from 10 to 2.8 within 4 s. The log shows "King Scorpion attacks!" twice. Auto-retaliation set the hero's target to the scorpion |
| `a2-scorpions-strong-hero.jpg` | **Aggressive camp, strong hero.** The same spot, every combat skill at 99 (combat 126). Picture taken after 10 s | No hit, no attack line, and the hero has no target. The scorpions wander 6 or more units away: at 114 levels above them their sight is `SIGHT_MIN` 3. The badge still reads "Combat Lv. 3" because the HUD badge only refreshes on a UI update. The rule reads `combatLevel(STATE)` live (`getCombatLevel`), and the HP bar shows the 99s |
| `b-three-kettle-passive.jpg` | **Passive camp.** A new hero (combat 3) among the goblins of Three Kettle Camp at (17, 12), 20.8 from Lumbridge's centre, so outside its 14-unit safe zone. Picture taken after 10 s | No hit and no target. HP stayed at 10/10 |
| `c1-yew-chopping.jpg` | **Gatherer, before the hit.** A combat-70 hero (attack, strength, defence and hitpoints 61; woodcutting 35) chopping the Sacred Blossom Yew at (-96, -24) beside the moss guardians (level 45) of `deep_woods_west` | The target panel shows the yew and the woodcutting bar. The tree's crown hides the hero at this camera angle |
| `c2-yew-hit.jpg`, `c3-yew-after-hit.jpg` | **Gatherer, hit.** The first guardian hit, then 2.5 s later | Frame before the hit: target `resource`, hero still walking to the second yew. Frame of the hit: target `null`, so the gather ended (CALL-6.29 (b)). HP 61 to 49. 2.5 s later the target was still `null` and the hero was standing still. The target panel still names the yew |

## What the gatherer run found (for the main session and H-0)

The ten-attempt run is in `facts.json`, under `yewRun10Attempts`. A frame watcher in the page recorded the target, the HP and whether the hero was moving on every frame.

- **No hit landed while the hero stood chopping.** A yew gives one log and then rests for 8.5 s. At the requirement level a swing succeeds half the time (`gatherChance` 0.5, one swing per tick), so a chop lasts about a second. In 10 attempts, every chop ended with "Gathered Sacred Yew Logs." before any guardian hit landed.
- **6 of the 10 first hits landed while the hero was walking to a yew with the tree as its target** (attempts 0, 3, 5, 6, 7, 9). In each of those, the hit cleared the gather target, so the hit always ended the gather.
- 1 first hit (attempt 1) landed on an idle hero between two gathers. Auto-retaliation answered it.
- **Auto-retaliation did not always answer those hits.** In 4 of the 6 (attempts 0, 6, 7, 9), 2.5 s after the hit the hero had no target and was standing idle. In the other 2 (attempts 3 and 5), the hero had a Moss Guardian as its target by then.
- Likely cause, read from the code but not proven by a test: `maybeRetaliate` (`src/engine/actions.ts`) clears the resource target, but `shouldRetaliate` refuses while `walking` is true. `walking` is true because `player.waypoints` still holds the walk to the tree. The hero then finishes the walk with no target.
- G2's tests (`tests/gatherer-hit.test.ts`) cover a gatherer who is standing still. This walking-to-the-tree case is not tested.
- **Open, and it blocks the slice gate.** Plan 0.5, row CALL-6.29 (b), says a hit "ends the gather, so Stage 4's auto-retaliation answers it". In this case the gather ends but nothing answers. The fix lies outside this gate's files (`src/engine/actions.ts`, plus a new test), so it is not made here. The main session must choose one of two paths. The first is a G2 follow-up with a test task before it: when `maybeRetaliate` clears a resource target, it also clears the walk to that target and calls `updateTargetHud`, and a test pins that a hero hit while walking to a tree fights back. The second is to record it as a trait the owner accepts at H-0.
- The UI side: the target panel keeps naming the yew after the gather ends, because `maybeRetaliate` does not call `updateTargetHud`.
- In 3 attempts (2, 4, 8), the log printed "Moss Guardian attacks!" but no hit landed within the 40 s watch.

## Gate status (repair of 2026-11-26)

The slice gate is **not closed**: the walking-gatherer case above is open. The model checks were rerun on this tree after the repair:
- MODEL (`scripts/capped.sh bash docs/superpowers/research/content-model/run.sh`): exit 0. `run.sh` now takes the post-G2 `src/state/monsterAi.ts` as it is (AFTER). It rebuilds Stage 2's rule (BEFORE) in a copy by reversing G2's two edits and its import, and each anchor must match once. `results.txt` ends with `ALL CHECKS PASS`, `check-results.txt` with `EVERY BOUND HOLDS, WITH TODAY'S FORMULA AND WITH THE REBALANCE`, and `aggro-results.txt` with `ALL AGGRESSION CHECKS PASS`. Every number is the same as R0b's: only the heading of section 2 changed. `aggro-check.ts` now also checks that each camp's `keepsSight` in the game equals `aggro.ts`'s `KEEPS_SIGHT`.
- PACE (`scripts/capped.sh bash docs/superpowers/research/content-model/pacing-rerun.sh`): exit 0, six blocks, each ending with `EVERY ASSERTION OF pacing.test.ts HOLDS`.
  - Block 0 is the committed G1 model, unpatched.
  - Block 1 is Stage 3's model, rebuilt by reversing G1's line and import. It is identical, line for line, to R0's block 1.
  - Block 2 is the convention. It is identical to R0's block 2.
  - The block at gap 10 is identical to block 0, which the script checks. The blocks at gaps 5 and 20 differ from gap 10 in 25 and 21 lines.
  - A missing anchor now stops the script (exit 2), and fewer HOLDS lines than blocks fail it (exit 1).
- `second-pass.sh` still patches the pre-G2 anchors and fails the same way. It is not part of the gate and was not changed.

## What these pictures cannot prove

- How it feels in play, the timing on the owner's machine, and frame rate. The FPS figures in the HUD come from a shared machine.
- The save-recovery notice and the Ashmantle reload. Neither was captured: both belong to the owner's H-0 run.
- The pass sentries at combat 75. Not captured.
