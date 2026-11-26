# D2b: the dragon library (motion strips and in-engine capture)

Built at `49c5880` (`BLEND(monsters)`, Blender 5.0.1). Five clips on the dragon's armature, 24 fps, keys on the twelve-a-second grid, rotation only on the 21 weighted bones plus one position track on `Hips` (its height measured per frame so the lowest point of the body stays on the ground; Root carries no track):

| Clip | Frames | Length | Keys | Hips height |
|---|---|---|---|---|
| `Idle` (loop) | 49 | 2.000 s | rest 0, breathe in 12, full 24, breathe out 36, rest 48 | +0.002 to +0.016 |
| `Walk` (loop) | 17 | 0.667 s | reach 0, pass 4, reach other 8, pass other 12 | +0.039 to +0.072 |
| `Bite` | 21 | 0.833 s | rest 0, rear 8, strike 12, snap 14, settle 20 | 0 to +0.024 |
| `WingBuffet` | 25 | 1.000 s | rest 0, raise 8, beat 12, follow 16, settle 24 | 0 to +0.031 |
| `Death` (last pose held) | 27 | 1.083 s | rest 0, recoil 6, buckle 12, fall 20, bounce 24, still 26 | -0.268 to +0.014 |

`Bite` and `WingBuffet` share the anticipation key, frame 8 = 0.333333 s (`skin.attackClips` in the pending manifest, `anticipation` in `PENDING_DRAGON_CLIPS`).

## The row is staged until D5

The shipped `public/models/monsters.glb` has no animations. Naming the clips on the live `elvarg_dragon` row before D5 gives the dragon (and Ashmantle, which shares the row) an animator with no clips: `holdOneShot: no clip Bite` on Ashmantle's wind-up, `monster animator has no clip Death` on every death. So the live row stays code-posed (its `bones` are named; nothing reads them without clips), and the clips and anticipation are staged as `PENDING_DRAGON_CLIPS` in `src/data/monsterPoses.ts`, the way a pending manifest is (plan 0.3.5). **D5's promote commit** sets the live row's `clips` and `anticipation` to `PENDING_DRAGON_CLIPS` in the same commit as the GLB (the constant stays as the tests' reference). `tests/monster-motion.test.ts` guards both sides: a row plays from `monsters.glb` only clips the file in the tree carries, the dragon winds up, strikes and dies on whatever file is in the tree, and the built-file cases install the staged row for their own run. The captures below were taken with the clips on the row in the throw-away worktree, which is what D5 ships.

Sheets:
- `d2b-dragon-<Clip>-strip.jpg`: `SHEETS(--only elvarg_dragon --clips --worst)`, six frames from the front.
- `d2b-dragon-clips-side.jpg`, `d2b-dragon-clips-threeq.jpg`: seven frames per clip from the side and from three-quarter, rows top to bottom `WingBuffet`, `Walk`, `Idle`, `Death`, `Bite` (a scratch workbench render of the same GLB; it is not a project script).
- `d2b-dragon-walk.jpg`, `-windup.jpg`, `-bite.jpg`, `-wingbuffet.jpg`, `-death.jpg`: in-engine capture (NVIDIA GPU, `scripts/capture-gpu.mjs`, `vite preview` of a build in a throw-away worktree with the built `monsters.glb` and the pending manifest, plus the uncommitted debug patch of M1b: `__DEBUG` exposes `G`, `THREE`, `poseMonsterLimbs`, `poseMonsterDying`, `getTerrainHeight`, and a monster with `__tick` is driven by the job). The dragon is at its lair (-102, 100) with the hero for scale; every other monster is hidden. Numbers in `d2b-dragon-ingame-rows.json`.

What the capture shows:
- Walk at 5.2 u/s (chase speed): time scale 1.257 = 0.85 + 0.9 * 5.2 / 11.5 (leg ratio 1). The clip steps about 1.0 per stance, 3.0 u/s at time scale 1: at chase speed the feet cover about 73% of the ground moved (some slide), at wander speed (1.8 u/s, time scale 0.99) about 165%. One clip and the engine's affine time scale cannot match both; the stride is set between them.
- Wind-up, driven by the job (1.6 s), taken before the D2b amendments: `poseMonsterLimbs` held the row's `attack` clip (`Bite`), so the dragon winds up on `Bite`'s anticipation (neck reared, jaw open, wings lifted); held time at the end 0.333333 s. The job then sets `attackAnim = 1` by hand, and the bite plays on from there.
- Wind-up in a real fight, redone after the D2b amendments (`d2b-ashmantle-windup.jpg`, numbers in `d2b-ashmantle-windup-rows.json`; the first capture, which held `Bite`, is in history at `1820d7a`): the row names `clips.windup: 'WingBuffet'`, and `poseMonsterLimbs` holds, releases and cancels `clips.windup ?? clips.attack` while `logic.windup` is set. `elvarg_dragon` has no attack pattern, so only Ashmantle, which shares this row through its model key, winds up in the game. Throw-away worktree of `5b269dc` with the built `monsters.glb`, the pending manifest, the staged clips on the live row (what D5 ships) and the debug hooks (`__DEBUG.G`, `getTerrainHeight`); the hero standing in Ashmantle's arena, Ashmantle on the game's own monster update, kept on the shipped dragon body because `body` is set only at D5; Stage 4's telegraph is on the ground. Top row `ember_cone` (1.8 s): `WingBuffet` held (paused, weight 1), scrubbed 0.034, 0.127, 0.216, 0.306 s as the wind-up runs out (wings raised to the beat's anticipation); on the strike (`attackAnim` 0.2) it runs on, 0.583 then 0.883 s, then ends; `Bite` stays stopped through all of it. Bottom row `tail_sweep` (1.7 s): held 0.033 to 0.333 s (the full anticipation at `left` 0), runs on 0.667 then 0.983 s. The last frame of each row is Ashmantle's next plain attack (no wind-up): `Bite` plays (0.017 s, then 0.133 s), `WingBuffet` does not. A heavy that misses (`attackAnim` not set, the held clip faded by `cancelHeld`) was not seen; `tests/monster-motion.test.ts` covers the cancel on the row's held clip.
- Death plays inside `DYING_SECS` and ends lying, legs splayed, with no group topple.
