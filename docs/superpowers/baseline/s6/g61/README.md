# Slice 1 gate (G-6.1): captures for H-1

**H-1 is still open.** These pictures are evidence for the owner's play check and do not replace it. The owner still has to mine coal, smelt and forge a steel and a blacksteel piece, brew a vial, walk Cinder Stair past the Adepts at combat 40, and fight Marrowjaw with a mouse and with a trackpad, all on a real screen (plan G-6.1, design 11.2).

## How the pictures were made

- **Tree:** `feat/content-systems` at `3e86aa7`. This is slice 1 (D1 to B1) plus the MODEL repair below. The pictures and `facts.json` were taken before the G-6.1 repair (`03a79b2`, `2f84d42`), so `c2`, `c3` and `facts.json` still show the "Its bolts are magic." line that `2f84d42` removes for Marrowjaw.
- **Build and server:** BUILD through the capped wrapper, then `node_modules/.bin/vite preview --port 4392 --strictPort` of that `dist/` on the host. The shell line around the job checked that the port was free first, stopped the server by its PID afterwards, and checked that nothing was left listening on 4392. The committed job does not do this.
- **Command:** `CAP_URL=http://localhost:4392/ CAP_OUT=<dir> node scripts/capture-gpu.mjs docs/superpowers/baseline/s6/g61/capture-job.mjs http://localhost:4392/`, exit 0. Every picture and `facts.json` in this folder comes from one run of the committed job, copied unchanged.
  - An earlier run of the same job pointed the Adept close-up's camera away from the camp. Only that camera yaw was changed before this run.
- **Renderer:** headless Chromium on the NVIDIA GPU, `ANGLE (Microsoft Corporation, D3D12 (NVIDIA GeForce RTX 4070 Laptop GPU), OpenGL 4.6)` (`facts.renderer`). 1280x720, quality tier `balanced`.
- **Browser state:** each scene got a fresh browser context, so storage started empty and the game began as a new game. `Math.random` was seeded as in G-6.0. The onboarding panel was hidden, the run waited for `look.ready()`, then waited 3.5 s for the aggression grace, and the mouse was parked on `#top-left-hud`.
- **Hero:** placed with `__DEBUG.look.pose`, with every combat skill at 99 (combat 126) set through `__DEBUG.STATE`.
  - At that level an ordinary camp's sight is `SIGHT_MIN` 3, so the hero can stand among the Adepts and the Brutes.
  - Marrowjaw's camp has `keepsSight` and sees 9 at any level, so he comes.
  - The badge reads "Combat Lv. 3" in `b1`, `b2` and `c1` because it refreshes only on a UI update (same as G-6.0). In `c2` and `c3` it reads "Combat Lv. 126": the fight refreshed it.
- **No patches:** nothing under `src/` was patched, and monsters ran on the game's own loop.
- **The kits on their bones:** to show this, the job sets `window.__THREE_DEVTOOLS__` (an `EventTarget`) before the page loads. Three.js's own devtools hook then announces every `THREE.Scene` to it. The job walks the live scenes for objects named `<kit>_<Bone>`, and it throws if any such object is not on a bone, if no kit child is found, or if any page error or console error is logged.

## What the run read (`facts.json`)

| Scene | Kit children in the live scene | Page or console errors |
|---|---|---|
| `a_cinder_circle` | 12 on 3 figures, each `cinder_adept_HeadGroup`, `_LeftHand`, `_RightHand`, `_WeaponPivot` on the bone of that name | 0 |
| `b_brute_shelf` | 8 on 2 figures, each `slag_brute_Torso`, `_LeftArmPivot`, `_RightArmPivot`, `_WeaponPivot` on the bone of that name | 0 |
| `c_marrowjaw` | 4 on 1 figure: `marrowjaw_HeadGroup`, `_Torso`, `_LeftArmPivot`, `_RightArmPivot` on the bone of that name | 0 |

## The pictures

| File | Scene |
|---|---|
| `a1-cinder-circle-wide.jpg` | The hero at the centre of `cinder_circle` (-0.7, 72.7). Two Adepts are in view, each with the hood, the ember lining and the brazier staff with its flame. HP 99/99. The log shows "Cinder Adept attacks!". When the job read the kits, one Adept stood 2.84 from the hero, which is inside its 3-unit sight; the others stood 4.30 and 9.97 away (`figureAt` in `facts.json`). No hit had landed when the picture was taken |
| `a2-cinder-adept-close.jpg` | An Adept at close range from behind the hero at (0, 70). The kit reads as a fire caster (brazier head, flame in hand), not as the dark wizard. Cinder Stair's road and the dunes are behind it |
| `b1-brute-shelf-wide.jpg` | Both Slag Brutes of `brute_shelf` (-6, 100) and (2, 104), with the hero between them. Slag plates on the shoulders and back, and the cooled-slag maul head. Nothing comes |
| `b2-slag-brute-close.jpg` | A Brute at close range. Two Adepts of `cinder_circle` stand in the background, about 30 units away |
| `c1-marrowjaw-idle.jpg` | Marrowjaw at his camp, the hero 14 units away, outside his sight 9. Bone crown, toll banner pole and shoulder armour. No picture shows him beside a Brute; his `modelScale` is 1.3 against the Brute's 1.12 |
| `c2-marrowjaw-fight-3s.jpg` | The hero placed 5 units from him, 3 s later. He has come. The boss bar reads 560/560 with the phase marks. The phase banner reads "Marrowjaw the Tollmaster: The Toll". A 0 hit splat is on the hero (a miss) |
| `c3-marrowjaw-fight-6s.jpg` | 3 s later, with no new pose. The Toll Slam wind-up ring is under the hero. HP 99/99 at the picture |

## Gate status (runs of 2026-11-26)

Each command ran from the worktree root behind `flock /tmp/claude-capped.lock scripts/capped.sh`. SUITE, TYPES, BUILD and ECON first ran on `2357ed7` (the slice). The G-6.1 repair changed `tests/` and `src/` (`03a79b2`, `2f84d42`), so the whole gate ran again on `2f84d42`:
- **SUITE:** exit 0. 140 files, 1574 passed, 3 skipped.
- **TYPES:** exit 0, no output.
- **BUILD:** exit 0. The JS chunk `dist/assets/index-D6dlyweN.js` is 1,109.07 kB (gzip 314.63 kB), reported only.
- **ECON:** `tests/pacing.test.ts` 11 of 11, `tests/economy-invariants.test.ts` 7 of 7.
- **MODEL:** exit 0, the three files end with their pass lines, and the committed results files did not change.

The runs on `2357ed7`:
- **SUITE** (`npx vitest run`): exit 0. 140 files, 1574 passed, 3 skipped.
- **TYPES** (`npx tsc --noEmit`): exit 0, no output.
- **BUILD** (`npm run build`): exit 0. The JS chunk `dist/assets/index-CbmJbvbe.js` is 1,109.04 kB (gzip 314.62 kB). That is reported only, since the owner retired the hard limit. G-6.0's chunk was 1,104.61 kB.
- **ECON:** `tests/pacing.test.ts` 11 of 11, `tests/economy-invariants.test.ts` 7 of 7.
- **MODEL** (`bash docs/superpowers/research/content-model/run.sh`): exit 0.
  - `results.txt` ends with `ALL CHECKS PASS`.
  - `check-results.txt` ends with `EVERY BOUND HOLDS, WITH TODAY'S FORMULA AND WITH THE REBALANCE`.
  - `aggro-results.txt` ends with `ALL AGGRESSION CHECKS PASS`.
  - This holds after the repair below. Before it, the run on the slice-1 tree failed with 27 checks.

**The MODEL repair (`3e86aa7`, `model.ts` and `results.txt` only).** With slice 1 landed, `model.ts` counted every shipped row twice: once from the game's table and once from the content file. Every row then collided with itself:
- 20 "id is free" checks failed;
- the coal rocks measured 0.0 from themselves;
- each camp sat inside its own leash;
- the tollmaster's nearest passing spot moved to (-18, -84).

The totals drifted as well: 18 open loops became 13, the moss guardian's rate went from 78.6 GP/s to 82.6, and the stat keys went from 134 to 146. What changed:
- **The world before Stage 6.** The live imports are aliased, and this world is derived by id. Node placements are matched by type, and appended drops by id.
- **The "id is free" checks.** Each new id must now be free in the live tables, or be shipped there with the content file's numbers. Drops are not compared until K2 adds the hides.
- **`results.txt`.** It is byte-identical to the committed one except for one added line, which lists the 23 shipped rows. Each of those rows has the content file's numbers.
- **The check was tested to fail.** As a test, the content file was changed in a scratch run: Coal's price to 31, and Marrowjaw to (7, -74). The new checks then failed: "item coal is shipped with ...", "camp tollmaster is shipped with ...", and the spot check. The content file was then restored.
- **Allowlist:** G-6.1 lists no files, so this edit is outside its allowlist. It is the same kind of repair as G-6.0's `6332d5d` and is for the main session to ratify.

**Each task's diff against its file list** (`git diff 4fda76d 2357ed7`):
- **D1:** `tests/content-s6.test.ts` and `tests/names-s6.test.ts` (new), plus the declared edits to:
  - `tests/content-freeze.test.ts`, which only adds ids;
  - `tests/economy-rolls.test.ts` (O-6.1b.1 item 4);
  - `tests/names-combat.test.ts` (item 7);
  - `tests/recipes-bars.test.ts` (item 9);
  - `tests/unlocks.test.ts` (item 10, which picks `rune_crossbow` and asserts that no recipe makes it).
- **D2:** `src/data/extras.ts`, `world.ts` and `placements.ts`. The recipes went into `src/data/recipeTable.ts`, not `recipes.ts`, because the F2 amendment moved `FORGE_RECIPES` there. That follows from the amendment.
- **D3:** `tests/roster-s6.test.ts` (new), plus the declared edits to:
  - the counts in `world-budget` (42 to 48), `world-data` (42 to 48) and `blender-hero` (13 to 16);
  - the counts in `scatter` and `woods-trees` (camps 15 to 18, members 42 to 48, `NODE_PLACEMENTS` 46 to 49, item 1);
  - the `NEW` list in `new-monsters`;
  - `monster-kits` (item 2);
  - `monster-models` (item 3, which only adds drops and rows);
  - `boss-phases` (item 5, `toEqual([BOSS])` becomes `toContain(BOSS)`, and the rest still pins Ashmantle's row);
  - `world-data-combat` (item 6, which adds `tollmaster`; the list is now compared after `.sort()`);
  - `size-refactor-golden` (item 8, brought to its wording by the G-6.1 repair `03a79b2`; see the first item under "Found by this gate").
- **D4:** `src/data/attacks.ts`, `world.ts` and `worldMap.ts`. Its `content.ts` edit (`a61f232`) and the revert of that edit (`be59034`) cancel out. The kits are wired: `kit: 'cinder_adept'`, `'slag_brute'` and `'marrowjaw'` (O-6.1b.6).
- **B1:** `tests/boss-marrowjaw.test.ts` only, once its two commits are combined. The fight model was moved back inside the test file.
- **Frozen tests:** after the repair `03a79b2`, every edit to an existing test file is one of the declared ones. `tests/fixtures/size-refactor-golden.json` changed only as item 8 allows: `plans` regenerated, two telegraph keys added (`toll_slam`, `camp_sweep`), the eleven old telegraph entries and `monsters` byte-identical.

## Found by this gate (for the main session and H-1)

1. **`tests/size-refactor-golden.test.ts` (repaired, `03a79b2`).** As D3 left it, the fixture was not regenerated, `plans` was digested over the eleven original attacks only, and the telegraph count check was dropped, so `toll_slam` and `camp_sweep` were pinned nowhere. Now, as O-6.1b.1 item 8 says:
   - the golden was regenerated once (`GOLDEN_WRITE=1`). `plans` is the digest over every `ATTACKS` row. The telegraphs gain the two new keys, and the eleven old entries and `monsters` are byte-identical;
   - the plans test checks the regenerated digest, and also checks that the plans recomputed with the new attacks removed equal the pre-Stage-6 digest (`0adbc13e...`, a literal in the test);
   - the telegraph test again checks the key count and that every telegraph equals the golden.
2. **"Its bolts are magic." was printed for Marrowjaw** (in `c2` and `c3`, and in `facts.json`, all taken before the fix). `handleBossPhase` in `src/engine/actions.ts` printed the line on phase 0 for every boss. Since `2f84d42` it prints it only when the boss's `style` is `magic`, which is Ashmantle and not Marrowjaw. **Allowlist:** no slice-1 task and not G-6.1 lists `actions.ts`. Like the MODEL repair, this needs the main session to ratify it as an amendment.
3. **`second-pass.sh`** still patches the pre-G2 anchors, as G-6.0 recorded. It is not part of the gate and was not run.

## What these pictures cannot prove

- How the fight feels with a mouse or a trackpad, the timing on the owner's machine, and the frame rate (the HUD's FPS figures come from a shared machine).
- Coal, smelting, forging and brewing: none was captured. They belong to the owner's H-1 run.
- The walk along Cinder Stair at combat 40: not captured. Only the camp is shown, from a combat-126 hero.

**H-1 stays open for the owner.**
