# Slice 0 gate (G-6.0): captures for H-0

**H-0 is still open.** These pictures are evidence for the owner's play check. They do not replace it. The owner still has to do the save-recovery check, the Ashmantle reload, the walk through the pass at combat 75 and the look on a real screen (plan G-6.0, design 11.2).

## How the pictures were made

- Tree: `feat/content-systems` at `e805219` (G2 landed). `npm run build`, then `vite preview` of that `dist/` on port 4391. The server was started and stopped by PID in the same command.
- Renderer: headless Chromium on the NVIDIA GPU through `scripts/capture-gpu.mjs`: `ANGLE (Microsoft Corporation, D3D12 (NVIDIA GeForce RTX 4070 Laptop GPU), OpenGL 4.6)`. Resolution 1280x720, quality tier `balanced`.
- Every scene got a fresh browser context, so storage started empty and the game began as a new game. `Math.random` was seeded the same way as Stage 5's `capture.md`. The onboarding panel was hidden, the run waited for `look.ready()`, and the mouse was parked on `#top-left-hud`.
- The run waited 3.5 s after load so the 3 s aggression grace would end. The hero was then placed with `__DEBUG.look.pose`. Skills were set through `__DEBUG.STATE`, with xp taken from the OSRS curve.
- Nothing under `src/` was patched. Monsters ran on the game's own loop and the G2 rule. The gather was started with the game's own click handler.
- The job is `capture-job.mjs`, and the numbers read during the run are in `facts.json`. In the job file, the yew scene is the last version: the ten-attempt run. The pictures `c1` to `c3` come from the run before it, which used the same scene setup except that it did not record `moving`.

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
- G2's tests cover a gatherer who is standing still. This walking-to-the-tree case is not tested. **It is reported, not fixed, here.** The main session decides whether it is a G2 follow-up or a known trait for the owner to judge at H-0.
- The UI side: the target panel keeps naming the yew after the gather ends, because `maybeRetaliate` does not call `updateTargetHud`.
- In 3 attempts (2, 4, 8), the log printed "Moss Guardian attacks!" but no hit landed within the 40 s watch.

## What these pictures cannot prove

- How it feels in play, the timing on the owner's machine, and frame rate. The FPS figures in the HUD come from a shared machine.
- The save-recovery notice and the Ashmantle reload. Neither was captured: both belong to the owner's H-0 run.
- The pass sentries at combat 75. Not captured.
