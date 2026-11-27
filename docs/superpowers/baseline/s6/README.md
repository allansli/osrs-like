# Slice 0 gate (G-6.0): captures for H-0

**H-0 is still open.** These pictures are evidence for the owner's play check. They do not replace it. The owner still has to do the save-recovery check, the Ashmantle reload, the walk through the pass at combat 75 and the look on a real screen (plan G-6.0, design 11.2).

## How the pictures were made

- Tree: `feat/content-systems` at `222bd42` (G2 landed, plus the main session's walking-gatherer fix `5206907` and its test `0a665b7`). BUILD (`npm run build` through the capped wrapper), then `npx vite preview --port 4391 --strictPort` of that `dist/` on the host. The server was started and stopped by PID around the one run.
- Command: `CAP_URL=http://localhost:4391/ CAP_OUT=<dir> node scripts/capture-gpu.mjs docs/superpowers/baseline/s6/capture-job.mjs http://localhost:4391/`, exit 0. **Every picture and `facts.json` in this folder come from that one run of the committed `capture-job.mjs`**, copied unchanged from `<dir>`. A rerun gives new pictures and numbers in the same shape; the seeded `Math.random` does not make the frame timing repeat.
- Renderer: headless Chromium on the NVIDIA GPU: `ANGLE (Microsoft Corporation, D3D12 (NVIDIA GeForce RTX 4070 Laptop GPU), OpenGL 4.6)` (`facts.renderer`). Resolution 1280x720, quality tier `balanced`.
- Every scene and every gatherer attempt got a fresh browser context, so storage started empty and the game began as a new game. `Math.random` was seeded the same way as Stage 5's `capture.md` (shifted per gatherer attempt). The onboarding panel was hidden, the run waited for `look.ready()`, and the mouse was parked on `#top-left-hud`.
- The run waited 3.5 s after load so the 3 s aggression grace would end. The hero was then placed with `__DEBUG.look.pose`. Skills were set through `__DEBUG.STATE`, with xp taken from the OSRS curve.
- Nothing under `src/` was patched. Monsters ran on the game's own loop and the G2 rule. Gathers were started with the game's own click handler (synthetic canvas events on a yew found by the hover label).
- The FPS figure in the HUD of some pictures reads 0 (7366 ms): a headless frame stall around the capture, not the game's frame rate.

## The pictures

| File | Scene | What the run read (`facts.json`, `scenes.*`) |
|---|---|---|
| `a1-scorpions-new-hero.jpg` | **Aggressive camp, low-level hero.** A new hero (combat 3) placed at (48, 33), 6.4 units from the nearest King Scorpion (level 12) of `dune_nest_west`. Picture after 4 s | First hit at 1.25 s (HP 10 to 9.05). HP 6.75 after 4 s. The log shows "King Scorpion attacks!" twice. Auto-retaliation set the hero's target to the scorpion |
| `a2-scorpions-strong-hero.jpg` | **Aggressive camp, strong hero.** The same spot, every combat skill at 99. Picture after 10 s | No hit, no attack line, no target, HP 99/99. At 114 levels above the scorpions (combat 126) their sight is `SIGHT_MIN` 3, so none comes from where they stand. The badge still reads "Combat Lv. 3" (`combat` in facts) because it refreshes only on a UI update; the rule reads `combatLevel(STATE)` live |
| `b-three-kettle-passive.jpg` | **Passive camp.** A new hero (combat 3) among the goblins of Three Kettle Camp at (17, 12), 20.8 from Lumbridge's centre, outside its 14-unit safe zone. Picture after 10 s | No hit, no target, HP 10/10 |
| `c1-yew-walking.jpg` | **Gatherer, before the hit.** A combat-70 hero (attack, strength, defence, hitpoints 61; woodcutting 35) among the moss guardians (level 45) of `deep_woods_west`. It has chopped one log and walks to the next yew, the yew as its target | Target panel: Sacred Blossom Yew, Woodcutting. HP 61/61 |
| `c2-yew-hit.jpg` | **Gatherer, hit on the way to the tree.** Taken just after the first guardian hit | Attempt 1. Frame before the hit: target `resource`, `moving: true`. Frame of the hit: HP 61 to 52, target `monster` (Moss Guardian): the gather ended and auto-retaliation answered in the same frame (CALL-6.29 (b)). Target panel: Moss Guardian 78/78 |
| `c3-yew-fighting-back.jpg` | **Gatherer, 2.5 s after the hit** | `after2_5s`: target Moss Guardian, `moving: false`, position unchanged since the hit frame (-96.77, -23.86): the walk to the tree ended. Target panel: Moss Guardian 65/78, so the hero's hits are landing. HP 49.7 |

`scenes.c_yew_gatherer.attempts` holds both attempts of the run. In attempt 0 the log printed "Moss Guardian attacks!" but no hit landed within the 40 s watch (as in 3 of the 10 attempts of the first, pre-fix run). The run stops at the first attempt whose first hit lands on a hero walking to a yew; `pictures` names it.

## The walking-gatherer case (found by the first run, fixed by the main session)

The first attempt of this gate (`45ae05a`) found that a hero hit while walking to a yew lost the gather but did not fight back: `maybeRetaliate` (`src/engine/actions.ts`) cleared the resource target, but `shouldRetaliate` refused while the walk to the tree was still in `player.waypoints`. In 4 of 6 such hits the hero then stood idle. The main session fixed it in `5206907` (a hit that clears a resource target also clears the walk) with the test `0a665b7` (`tests/gatherer-hit.test.ts`: a hero walking to a tree, hit once, stops and fights back; a hero walking with no resource target keeps walking). The run above is the game after that fix: c2 and c3 show the case answered.

Still open for the owner, not a defect of CALL-6.29 (b): no hit landed on a hero standing at a yew in either run, because a chop at the requirement level lasts about a second.

## Gate status (rerun of 2026-11-26 on `222bd42` plus this folder)

The slice gate's agent part holds. Each command ran from the worktree root behind `flock /tmp/claude-capped.lock scripts/capped.sh`:
- SUITE (`npx vitest run`): exit 0, 136 files, 1509 passed, 3 skipped.
- TYPES (`npx tsc --noEmit`): exit 0, no output.
- BUILD (`npm run build`): exit 0. JS chunk `dist/assets/index-CqIOVNL9.js` 1,104.61 kB (gzip 313.67 kB), reported only: the owner retired the hard limit.
- ECON: `tests/pacing.test.ts` 11 of 11, `tests/economy-invariants.test.ts` 7 of 7.
- `tests/gatherer-hit.test.ts`: 6 of 6.
- MODEL (`bash docs/superpowers/research/content-model/run.sh`): exit 0. `results.txt` ends with `ALL CHECKS PASS`, `check-results.txt` with `EVERY BOUND HOLDS, WITH TODAY'S FORMULA AND WITH THE REBALANCE`, `aggro-results.txt` with `ALL AGGRESSION CHECKS PASS`. The result files are byte-identical to the committed ones (no diff). `run.sh` takes the post-G2 `src/state/monsterAi.ts` as AFTER and rebuilds Stage 2's rule (BEFORE) in a copy by reversing G2's two edits and its import (`6332d5d`).
- PACE (`bash docs/superpowers/research/content-model/pacing-rerun.sh`): exit 0, six blocks, each ending with `EVERY ASSERTION OF pacing.test.ts HOLDS`; `pacing-results.txt` byte-identical to the committed one. Block 0 is the committed G1 model; block 1 is Stage 3's model (identical to R0's block 1); block 2 the convention (identical to R0's block 2); gap 10 is identical to block 0, gaps 5 and 20 differ from it.
- `second-pass.sh` still patches the pre-G2 anchors and fails; it is not part of the gate and was not changed.

The two reading checks of G-6.0 hold:
- **No clock and no `Math.random` in the new `src/state` modules.** Stage 6 added `progress.ts` (F2) and `saveRecovery.ts` (F4) under `src/state`. `grep -nE "Date\.now|performance\.now|new Date|Math\.random|setTimeout|setInterval|requestAnimationFrame" src/state/progress.ts src/state/saveRecovery.ts` prints nothing (exit 1). The other files `c84cd12..HEAD` adds under `src/state` (`dayCycle.ts`, `scatter.ts`, `shadowFit.ts`, `waterGrid.ts`, `weather.ts`) are Stage 5's look modules.
- **The default state serialises to Stage 3's golden.** `tests/fixtures/s3/default-state.golden.json` has not changed since Stage 3 (`git diff c84cd12 HEAD -- tests/fixtures/s3/` is empty), and `tests/save-compat-s3.test.ts` passes 6 of 6, among them "the default state serialises to its golden". That test compares the parsed output with `toEqual`, `savedAt` removed, so it pins the content, not the bytes.

**H-0 stays open for the owner.**

## What these pictures cannot prove

- How it feels in play, the timing on the owner's machine, and frame rate. The FPS figures in the HUD come from a shared machine.
- The save-recovery notice and the Ashmantle reload. Neither was captured: both belong to the owner's H-0 run.
- The pass sentries at combat 75. Not captured.
