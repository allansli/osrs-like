# Slice 3b gate (G-6.3b): captures for H-3b

**H-3b is still open.** These pictures and traces are evidence for the owner's play check. They do not replace it. The owner still has to do design 11.2's cover item on a real screen: stand behind a cave pillar and a wall corner from a Hurler, behind the castle wall from a dark wizard, across the river from goblin archers, and judge whether they walk round to get a shot and never shoot through. Finding 2 below says why the castle part cannot happen in play as written.

## How the pictures were made

- **Tree:** `feat/content-systems` at `af46da4`, which is slice 3b: L1 (`1071725`) and L2 (`af46da4`) on top of G-6.3a.
- **Build and server:**
  - BUILD ran through the capped wrapper (gate status below).
  - Then `node_modules/.bin/vite preview --port 4397 --strictPort` served that `dist/` on the host. The shell line checked that the port was free first. Afterwards it stopped the server by its PID and checked that nothing was left listening on 4397. The committed job does not do this.
- **Command:** `CAP_URL=http://localhost:4397/ CAP_OUT=<dir> node scripts/capture-gpu.mjs docs/superpowers/baseline/s6/g63b/capture-job.mjs http://localhost:4397/`, exit 0.
  - Every picture, `facts.json` and the four `trace-*.json` come from one run of the committed job (scenes A to D), copied unchanged.
  - Earlier runs shaped the job:
    - Scene B first put the hero in corridor c2 to be acquired. The Hurler never left `idle`, because a hero outside the camp's circle is not acquired (`stepMonster`'s idle branch: `distPlayerToCamp <= camp.radius`). The pull spot moved into the front hall.
    - Scene D first clicked the archer while it had wandered 15.7 from the hero. The hero walked over the bridge and killed it with Ranged 70. The job now waits until the archer is within 13, uses Ranged 1, and stops the hero once the archer is pulled.
    - Scene C was added after B showed the leash case (finding 1), to try a wall corner where the leash allows the walk round.
- **Renderer:** headless Chromium on the NVIDIA GPU, `ANGLE (Microsoft Corporation, D3D12 (NVIDIA GeForce RTX 4070 Laptop GPU), OpenGL 4.6)` (`facts.renderer`). The job throws if it is not the NVIDIA GPU. 1280x720, quality tier `balanced`.
- **Browser state:** each scene got a fresh browser context, so storage started empty and the game began as a new game. `Math.random` was seeded as in G-6.0. The onboarding panel was hidden, the run waited for `look.ready()`, then waited 3.5 s for the aggression grace, and the mouse was parked on `#top-left-hud`.
- **Hero:** set through `__DEBUG.STATE`: every combat skill 70 and hitpoints 99, no gear (scene D: an Oak Shortbow, 500 Bronze Arrows, style `ranged` and Ranged 1).
  - In the cave scenes Protect from Melee is on, clicked on its card in the prayer panel, so that the Lesser Demons' hits do not end a scene.
  - The cave is entered through the overworld door, by its hover label and the game's own mousedown handler (as G-6.3a). Inside, the hero is moved with `__DEBUG.look.pose`.
- **What the job sets beyond the hero, all through the page, never in `src/`:**
  - In scenes B and C, and in D once the archer is pulled, the job clears `player.targetEntity` and `player.waypoints`, as a player who stops would. The hero then stands where it was posed and does not walk to the monster. In B and C it is done twice, 0.7 s apart, in case a hit already in flight sets off the auto-retaliation.
  - A recorder in the page runs on every animation frame. For each watched monster (found by its home, through the rig group's `userData.entity` and three.js's devtools hook) it writes one row: the time, the monster's position, `state`, `attackCooldown` and wind-up, and the hero's position and hitpoints. The rows are the `trace-*.json` files.
  - Monsters ran on the game's own loop and the L2 rule.
- **Checking the traces:** `los-check.ts` rebuilds the game's own walk grids: the overworld's `buildWalkGrid()`, and the cave's `buildWalkGrid(zoneWalk(cave, []), 1000, 600, 96)` as `zones.ts` builds it. For every row it computes `segmentWalkable(grid, monster, hero)`, which is the test of L2's `lineClear`.
  - A shot is a wind-up that starts, or `attackCooldown` jumping up while the monster is in `attack`.
  - A shot counts as through a wall only if the line is blocked both on its row and on the row before, because the step that fired ran between the two.
  - It also counts, from the tables, the cells inside each camp's leash (radius + 4) from which a ranged monster would have a clear line within its reach of the hero's spot.
  - Its output on the committed traces is `los-check.txt`. It was run behind the capped wrapper with the command in its header, and a second run on the committed folder gave the same text.
- **No page or console error** in any scene (`pageErrors` is empty in all four).

## The pictures

| File | Scene | What the run read (`facts.json`, `trace-*.json`, `los-check.txt`) |
|---|---|---|
| `a1-pillar-blocked.jpg` | **A, cave pillar.** The hero at local (66.8, 33.4), 9 from the back hall's Ember Hurler at its home (74, 28). The pillar `[69, 30, 71, 32]` is between them (L1 case 7's spot), and the camera looks past the hero at the Hurler. Taken 1.5 s after the pose | The Hurler behind the pillar's spire. It acquired the hero at 1,364 ms and went to `chase`, not to `attack`, because L2's edit 4 gates the first strike on the line. For 38 rows in reach, the line was blocked and it did not fire. The back hall's Lesser Demon is on the hero (melee, no line needed) |
| `a2-pillar-first-shot.jpg` | Taken when the recorder saw that Hurler's first shot | The Hurler walked round the pillar's side and fired at 2,238 ms from (1071.95, 631.63), 5.44 from the hero, with the line clear. The hero had not moved (1066.8, 633.4). The hellfire orb is in flight |
| `a3-pillar-after.jpg` | 2 s later | The Hurler's second shot was also from the clear side. The hero now fights back (target Ember Hurler, hp 83.47) |
| `b1-corner-blocked.jpg` | **B, wall corner from the front hall.** The front hall's Hurler (home 44, 34) acquired the hero at local (47, 34). The hero was then posed round the corner into the back hall at (57, 30.5), and stopped | The Hurler chased into the c2 corridor. It held fire for 59 rows in reach with the line blocked, and never fired |
| `b2-corner-first-shot.jpg` | End of the 25 s watch (no shot came) | At 1,639 ms the Hurler turned back at local x 52.67, which is its camp's leash (centre 38.67 + radius 10 + 4). It was `idle` at home from 3,242 ms to the end. The hero took no damage (99/99). **Finding 1** |
| `c1-corner-blocked.jpg` | **C, wall corner from the back hall.** The back hall's Hurler (home 74, 28) acquired the hero at local (64, 28). The hero was then posed inside corridor c2 at (51.5, 31.5), behind the back hall's west wall, and stopped | The Hurler walked toward the corridor mouth |
| `c2-corner-first-shot.jpg` | Taken when the recorder saw its first shot | It fired at 1,840 ms from (1062.38, 630.28), 10.95 from the hero, with the line clear. In this run no row was in reach with the line blocked: it came in along a line that was already clear, so this scene shows a clear-line shot at a corner, not a walk round. (An uncommitted trial run held fire for 41 rows, then fired from (1057.72, 630.78).) |
| `d1-river-pulled.jpg` | **D, across the river.** The hero on the east bank at (39.6, 19), the bow drawn, the goblin archer of Three Kettle Camp (home 27, 19) across the river Lum. 2.5 s after the click | The click on "Attack Goblin Archer (Lv-5) [12/12 HP]" pulled the archer (`chase` at 5,486 ms). The hero then stopped and stood on the bank |
| `d2-river-end.jpg` | Taken when the recorder saw the archer's first shot | The archer walked south along the west bank, over the bridge (z about 0 to 2) and north up the east bank. It fired at 12,621 ms from (36.27, 8.54), 10.98 from the hero, with the line clear. That is one of the 7 cells inside its leash that have a clear line within 11 of the hero's spot. The arrow is arriving from the right of the frame. The archer never shot across the water |

**Over all four traces, no ranged shot was fired with the line blocked** (`los-check.txt`: "ranged shots with the line blocked on both rows: 0" for every ranged monster). Every first shot came from a cell with a clear line.

## Findings for the main session

1. **A safe spot round the c2 corner.** A hero standing in the back hall just past corridor c2 (local 57, 30.5) was not shot by the front hall's Hurler (scene B). The hero there is outside the back camp's circle (14.75 from its centre, radius 12) and 9.66 from the back hall's Lesser Demon (sight 9), so nothing else came either.
   - **Cells with a shot exist inside the leash.** `los-check.txt` counts 20 cells inside the front camp's leash (radius 10 + 4) with a clear line within 11 of that spot. All of them lie on the north side of the corridor's line, at local z 32.5 to 37.5 and x 47.5 to 52.5; the nearest to the camp's centre is (47.5, 35.5).
   - **The route does not go to them.** The trace shows the Hurler walking straight along the south side of the corridor (world z 634.1 to 632.0, local x 44.6 to 52.5). That is the shortest way toward the hero, hugging the corner that blocks the line. It turned back at the leash at local x 52.67, 4.6 from the hero, without passing a clear cell.
   - **Probable cause, read from the code and not tested separately:** L2's edit 3 sets the repath goal to melee range of the hero (`entityGoal(..., MELEE_RANGE)`). So a monster without a line heads for the hero itself, not for the nearest cell with a line.
   - **The levers:** the cave row (design 7.6), the leash, or the chase goal in `src/state/monsterAi.ts`, for example a goal that prefers a cell with a line. Whether this is a slice 3b defect is for the main session to decide.
   - Read from the rule and not run: before L2, the same Hurler in the corridor within 11 of the hero would have fired with the wall between.
   - Where the route does pass a clear cell, the walk round happens: scene A at the pillar. In scene C the Hurler came in along a line that was already clear and fired at once (no held-fire rows in the committed trace). An uncommitted trial run of scene C held fire for 41 rows and then fired from the corridor mouth, but that run's trace is not in this folder.
2. **No dark wizard can reach the castle wall.** The only dark wizard camp is `wizards` (centre 45.67, -28.67, radius 11, leash 15). The nearest castle blocker is 20.97 beyond the leash disk, against a reach of 11 (`los-check.txt`, last block).
   - A wizard turns back long before it could see the castle. The river Lum lies between the two as well.
   - So H-3b's "behind the castle wall from a dark wizard" cannot happen in play as written.
   - The cover rule for a magic monster is covered by L1 (cases 1, 6 and 8, `dark_wizard`). Scenes A and C cover a ranged one on a real wall in the game.
   - The owner may want another wall for this check, or to drop it.
3. **The pillar covers from one Hurler only.** The second back-hall Hurler (home 74, 40) has a clear line to scene A's spot. It fired at 1,364 ms from its home. A player who hides behind that pillar is still shot from the other side, and that is what the cover rule should do.
4. **Still open from G-6.3a:** the grass carpet draws inside the cave (visible in `a1` to `c2`).

## Gate status (runs of 2026-11-27 on `af46da4`)

Each command ran from the worktree root behind `flock /tmp/claude-capped.lock scripts/capped.sh`:
- **SUITE** (`npx vitest run`): exit 0. 152 files, 1,776 passed, 3 skipped. G-6.3a's run had 151 files and 1,767 tests; L1 adds 1 file and 9 tests.
- **TYPES** (`npx tsc --noEmit`): exit 0, no output.
- **BUILD** (`npm run build`): exit 0.
  - The JS chunk `dist/assets/index-De485Q3b.js` is 1,196.73 kB (gzip 341.81 kB), and the CSS is 39.82 kB.
  - This is reported only, since the owner retired the hard limit. G-6.3a's chunk was 1,196.61 kB, so slice 3b adds 0.12 kB.
- **ECON:** `tests/pacing.test.ts` passed 11 of 11, and `tests/economy-invariants.test.ts` passed 7 of 7.
- **L2's accept**, in one ONE run: 13 files, 204 tests passed.
  - The files: `tests/line-of-sight.test.ts` (9 of 9), `tests/size-refactor-golden.test.ts` (3 of 3) with L1's fixture, and these, unedited: `monster-territory` (19), `monster-routes` (17), `monster-patterns` (41), `monster-ai` (10), `boss-phases` (33), `stage2-review-fixes` (12), `gate-simulation` (4), `aggression` (11) and `cave` (27, which printed "cave: front 0.867, back 0.734, both in turn 0.690 of 178.5 GP/s").
  - The ECON pair above ran in the same run.
- **MODEL** (`bash docs/superpowers/research/content-model/run.sh`): exit 0.
  - `results.txt` ends with `ALL CHECKS PASS`, `check-results.txt` with `EVERY BOUND HOLDS, WITH TODAY'S FORMULA AND WITH THE REBALANCE`, and `aggro-results.txt` with `ALL AGGRESSION CHECKS PASS`.
  - All three came out byte-identical to the committed files. `aggro-check.ts` steps the game's own `stepMonster`, now with L2.
- **PACE** was not run. `CAMPS` did not change in slice 3b, and the slice gate of 0.2 is SG, ECON and MODEL.

**The slice's diff** (`git diff 08d31f4 af46da4`, where `08d31f4` is the last commit of G-6.3a): `src/state/monsterAi.ts`, `tests/line-of-sight.test.ts` (new), and `tests/fixtures/size-refactor-golden.json`. No other file.
- **L2's diff is exactly the four edits:**
  1. `lineClear` added after `attackRange`, as written in the plan, not exported.
  2. The chase test reads `distToPlayer > attackRange(m) || !lineClear(m, world)`.
  3. `entityGoal`'s fourth argument reads `attackRange(m) > MELEE_RANGE ? MELEE_RANGE : attackRange(m)`.
  4. The first strike on acquisition reads `distToPlayer <= attackRange(m) && lineClear(m, world)`.
  - No import changed (`segmentWalkable` was already imported). `attackRange`, `MELEE_RANGE`, `FAR_RANGE`, `stepWindupAndRecovery`, `patternAttack` and G2's acquisition test are untouched, and so is `pathfind.ts`.
- **The fixture's diff is the one key:** `monsters` goes from `f3c2f70d…e957` to `5e5eb89906dbee5772c106f4fadefa7dff1087d586f021600d920f57e4f283f8`, which is the digest the plan gives for `87f18e7` with L2's edits. `plans` and `telegraphs` are byte-identical. `tests/size-refactor-golden.test.ts` is unedited.
- **The four per-monster digests hold:** `line-of-sight.test.ts` case 8 (goblin, scorpion, dark wizard and hill giant against L1's constants, and Ashmantle never firing on a blocked step) (cases 8a and 8b) passes in the suite and in the ONE run above.

**H-3b stays open for the owner.**

## What these pictures cannot prove

- How it feels in play, the timing on the owner's machine, and frame rate. The HUD read 39 to 48 FPS and 1,044 to 1,117 calls on a shared machine.
- The castle item (finding 2).
- Wall corners other than the two of scenes B and C, and the ranged monsters not captured here (dark rangers, Thornwatch marksmen, Cinder Adepts, Ashmantle, Elvarg). L1 covers each of them on a test wall.
