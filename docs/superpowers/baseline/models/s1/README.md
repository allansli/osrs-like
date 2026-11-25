# S3: the pilot in the game

Plan task S3, design section 10 (P-a to P-f), 6.1.3 and 6.1.5. Captured on the NVIDIA GPU (`scripts/capture-gpu.mjs`, ANGLE over D3D12, RTX 4070 Laptop), 1280x720, balanced tier, seeded `Math.random`, skills at 99, outline on for every pose picture. Tree `b2810a2`. The four builds are `scratch/models-build/s2final/{a3,b3,a1,b1}/monsters.glb` with `tests/fixtures/model-contract/pending/monsters.json`:

| Build | Body route | Materials |
|---|---|---|
| `a3` | (a) `organic_body` from a stick graph | 3 families (skin, wood, metal) |
| `b3` | (b) primitives fused by a voxel remesh | 3 |
| `a1` | (a) | 1, colours in the paint layer |
| `b1` | (b) | 1 |

"Today" is the shipped goblin of the merge-only `monsters.glb` (M0p's file, HEAD).

Nothing under `src/`, `public/`, `blender/` or `tests/` is changed in the branch. Every run was in a throw-away worktree of HEAD (`git worktree add --detach`, `cp -al node_modules`, the build's GLB and the pending manifest copied over the live ones, `scripts/capped.sh npm run build`, `vite preview` on port 4191, worktree removed afterwards). The worktrees carry one uncommitted debug patch, `ingame/tools/debug.patch` (51 lines of diff): `__DEBUG` also exposes `G`, `poseMonsterLimbs`, `spawnMonster`, `disposeObject3D`, `getTerrainHeight`, `THREE` and `GLTFLoader`, and a monster with `__hold` set is posed by `poseMonsterLimbs` alone (flinch, attack and wind-up forced to their mid-point) and skips the AI step. The poses are therefore the game's own `poseMonsterLimbs` on the skinned bones, not a copy of it. The scripts that ran are in `ingame/tools/`.

## What each picture shows (`ingame/`)

The pilot raider is the left figure of a row, with two of the camp's rigid archers beside it. Camera 6.5 from the target, pitch 0.25, at (18.5, 12.5), the open grass just east of Three Kettle Camp (the camp's own props stand in front of the camp centre and hid the row). The hero is hidden.

| File | Shows |
|---|---|
| `<b>-poses-noon.jpg` (`base`, `a3`, `b3`, `a1`, `b1`) | Noon: standing, walking, mid-attack (`attackAnim` 0.5), mid-flinch (`flinch` 0.5), Stage 4's wind-up pose (`windup` at 85%). |
| `<b>-dusk.jpg` | Phase 0.7 (the "golden" of M0p's rows): attack with the camera at yaw 0 and at yaw 2.2 (the raised arm in light and in shadow), wind-up at yaw 4.2, attack from above (pitch 0.75). |
| `<b>-edge.jpg` | The raider mid-attack with its centre 60 px inside the right edge, on the right edge, and on the left edge (half off). |
| `a3-shadow.jpg` | Raider alone, phase 0.62, pitch 1.0, two camera yaws, standing, attack, wind-up, flinch: the ground shadow per pose. |
| `close-head-hands.jpg` | P-e. Distance 5.4, pitch 0.2, noon, the raider alone, standing: head crop (top row) and hands crop (bottom row), today then `a3`, `b3`, `a1`, `b1`. |
| `<b>-hero-clips.jpg` (`a3`, `b3`, `a1`, `b1`) | P-d. Top row: the hero's `Walk` at u = 0, 0.125, 0.25, 0.375, 0.5, 0.75, the goblin turned side-on. Bottom row: `Slash` at u = 0, 0.14, 0.28, 0.4, 0.48, 0.7, front. |

## Numbers

All counts are draw calls per frame to the canvas ("colour") and to render targets ("shadow"), averaged over 1 s, as in M0p; HUD is the `#perf-calls` text (calls and triangles). M0p's reference row for the camp: colour 357, shadow 684, HUD 1,041 calls, 604k triangles.

### P-a, the file

COMPARE (`scripts/models-compare.mjs` of each build against `public/models/monsters.glb`, pending manifest used) exits 0 for all four: Contract (skin rules included) and Budget pass.

| | Today | `a3` | `b3` | `a1` | `b1` |
|---|---|---|---|---|---|
| Figure Brotli bytes (S2's measurement, `figureStats`) | 92,625 | 100,295 | 99,929 | 100,126 | 99,110 |
| `monsters.glb` Brotli bytes (COMPARE's drift line) | 1,281,976 | 1,386,979 | 1,358,880 | 1,385,905 | 1,385,987 |

The figure ceiling in the pending manifest is 102,301; the file ceiling 1,400,849. The figure numbers are the README's `figureStats` table of S2 and were not re-computed here.

### P-c, cost, measured two ways

**Controlled** (all monsters held still, the five camp goblins stood in view, then hidden; calls per goblin = difference over 5):

| | colour with / without | shadow with / without | HUD with / without | per goblin: colour, shadow, HUD |
|---|---|---|---|---|
| today | 344 / 199 | 640 / 495 | 984 / 694 | 29.0, 29.0, 58 |
| `a3` | 241 / 226 | 511 / 496 | 752 / 722 | 3.0, 3.0, 6 |
| `b3` | 241 / 226 | 511 / 496 | 752 / 722 | 3.0, 3.0, 6 |
| `a1` | 230 / 225 | 518 / 513 | 748 / 738 | 1.0, 1.0, 2 |
| `b1` | 230 / 225 | 518 / 513 | 748 / 738 | 1.0, 1.0, 2 |

So one skinned goblin costs 52 fewer calls a frame (HUD) with three materials and 56 fewer with one, against "at least 20".

**Natural camp** (the unmodified game at `three_kettle_camp`, 8.5 away, pitch 0.3, noon, monsters wandering; three 1 s samples after 1.5 s each; goblins in view counted by frustum):

| | colour | shadow | HUD calls | goblins in view |
|---|---|---|---|---|
| today | 360, 368, 381 | 687, 688, 670 | 1,043, 1,048, 1,046 | 3, 4, 5 |
| `a3`, `b3` | 280, 243, 284 | 559, 554, 538 | 832, 782, 821 | 4, 3, 4 |
| `a1` | 267, 272, 273 | 543, 548, 546 | 817, 818, 820 | 5, 5, 4 |
| `b1` | 272, 274, 274 | 543, 548, 546 | 817, 820, 820 | 5, 5, 4 |

Against "M0p's HUD minus 20 per goblin in view" (1,041 minus 60 to 100 = 941 to 981): every sample passes, by 121 to 199 calls. On colour calls alone `a3`'s first sample (280 with 4 in view, bound 277) misses by 3: the wandering monsters differ run to run, and the controlled table above is the clean number (26 fewer colour calls per goblin). The sample runs of `a3` and `b3` are identical because the game is deterministic under the seed.

**Frame time.** The `bench` hook (render only, `gl.finish`, ms per frame) at the natural camp: today 6.4, 6.6, 6.9; `a3` 5.6, 5.2, 5.0; `b3` 5.5, 4.7, 5.9; `a1` 5.0, 5.0, 5.0; `b1` 5.3, 5.0, 5.0. In the controlled run (200 frames) with the five goblins in view: today 4.50, `a3` 3.60, `b3` 3.99, `a1` 3.91, `b1` 3.91; with them hidden: 2.85, 3.13, 2.67, 2.78, 2.81. The same scene without goblins varies 0.5 ms between builds, so differences under about 0.5 ms are noise; the builds read about 0.5 to 2 ms below today's, not above it. This is a software-timed render loop in headless Chromium at a 60 frames/s cap, not the owner's machine: M0p did not measure frame time either, so there is no M0p frame time to compare with and the owner reads it at OM-P.

### P-b, correctness numbers

| Check | today | `a3` | `b3` | `a1` | `b1` |
|---|---|---|---|---|---|
| Skinned goblins at load (of 5) | 0 | 5 | 5 | 5 | 5 |
| Meshes under a goblin / skinned body meshes / outline shells / shells visible at load | 56 / 0 / 26 / 0 | 7 / 3 / 3 / 0 | 7 / 3 / 3 / 0 | 3 / 1 / 1 / 0 | 3 / 1 / 1 / 0 |
| Shells that are `SkinnedMesh` | 0 | 3 | 3 | 1 | 1 |
| Distinct `Skeleton` objects per goblin (one bone texture each) | 0 | 3 | 3 | 1 | 1 |
| `renderer.info.memory` before the kill loop: geometries / textures / programs | 2,620 / 27 / 21 | 2,488 / 42 / 24 | 2,486 / 42 / 24 | 2,475 / 32 / 24 | 2,480 / 32 / 24 |
| after 30 kills and respawns of one goblin | same | same | same | same | same |
| after 30 spawn then `disposeObject3D` cycles of a goblin | same | same | same | same | same |
| control: 5 more spawns not disposed, then disposed: textures | 27, 27, 27 | 42, 57, 42 | 42, 57, 42 | 32, 37, 32 | 32, 37, 32 |
| control: geometries | 2,620, 2,770, 2,620 | 2,488, 2,508, 2,488 | 2,486, 2,506, 2,486 | 2,475, 2,485, 2,475 | 2,480, 2,490, 2,480 |

How the kills were driven: the loop sets `logic.state = 'dying'` with a 0.1 s timer, waits for `dead`, sets the timer to 0.05 s, waits for the real `respawned` step, 30 times, in the running game. A death and a respawn only toggle `group.visible` (no mesh is made or freed), so equal counts after the kill loop are expected and prove little by themselves. The test that can fail is the spawn/dispose loop (30 `spawnMonster('goblin')` that load the skinned GLB, render a few frames, then `disposeObject3D(rig.group)`), and its control shows the counts do move when a goblin is not disposed (+20 geometries and +15 textures for five `a3` goblins) and return exactly when it is. The game itself never disposes a monster; the disposal path is exercised here only.

**Bone textures.** Each skinned mesh gets its own `Skeleton` and so its own bone texture, which design 6.1.3 describes as one per figure: three per goblin with three materials, one with one. The memory counter shows it: `a3`/`b3` hold 15 textures more than today for five goblins, `a1`/`b1` five more. Evidence for N-4.

**Culling.** A numeric sweep (`job.cull.mjs`, builds `a3` and `a1`; `b3` and `b1` use the same bones and the same fixed sphere code and were not run): the raider standing, mid-attack and winding up was placed with its centre from 200 px inside the right and left edges to 700 px outside (every 25 px, 74 placements each). In no placement is any bone inside the frustum while three culls every skinned mesh of the goblin. The outline shells were not in this check; in the edge crops they are drawn with the figure.

**Facing.** Today's goblin and the pilot both face the camera with the game's own turn formula (`atan2(dx, dz) + PI`) when placed by it; a numeric check (the left arm pivot projects to the right of the right arm pivot) agrees for the raider and an archer, and in the Blender against-sheet (`a3-goblin-against.jpg`) today's front has the face with tusks and the mace on the shoulder, which is what the close crop shows (its face is dark at this size). So the P-e crop is like for like.

### P-d, shared motion on another stance

Built in scratch, not committed (`ingame/tools/clips.py`, `blender --background s2final/a3/monsters.blend --python clips.py`): `build_hero.build_all_animations` called with `build_action` replaced by a recorder, which yields the hero's own `sample_walk` (32 frames) and `sample_slash` (24 frames). Conversion as design 6.1.5 and made through `figkit.make_clip` on the goblin's armature (a3's blend; the rig is the same in all four builds, so the same GLB was used on all four): `HeadGroup`, `LeftArmPivot` and `RightArmPivot` get `inverse(torso) * q` per frame (continuous Euler); the torso, elbows, knees and legs keep the authored triples; `Torso`'s own position keys and the follow-the-torso position keys are dropped; the legs' `pos` of `Walk` (the dip) becomes the `Hips` location track, scaled by the goblin's hip height over the hero's (0.6936 / 0.9 = 0.7707); `Slash` has none. Exported with the glTF exporter in NLA mode. In the throw-away worktree a twenty-line `AnimationMixer` (in `job.mjs`, the `clips` step) loads that GLB, keeps only `*.quaternion` tracks and `Hips.position` (the exporter also writes a translation and a scale track for every bone; they were dropped, so the goblin's own joint offsets and bone lengths stay), strips the `goblin_` prefix, and binds by bone name on the goblin's rig group; frames are set by `action.time`. Each clip has 20 tracks (19 rotations and `Hips.position`; `Slash`'s is the rest value): `Walk` 1.333 s, `Slash` 1.0 s.

Result, on all four builds (`<b>-hero-clips.jpg`): both clips play on the skinned goblin without code in `src/`; the legs alternate and the hips dip in `Walk`; the right arm winds back and strikes with the spear in `Slash`; no frame shows torn or stretched skin. The goblin's proportions are its own (shorter legs, bigger head) while the hero's timing is the hero's.

## P-a to P-f

Marked by what I measured. P-c's frame time and P-f are the owner's reading (OM-P).

| # | Criterion | Mark | Evidence |
|---|---|---|---|
| P-a | The file: Contract and Budget pass, skin rules included; Brotli bytes of the figure measured for each route and variant | met | COMPARE exit 0 for `a3`, `b3`, `a1`, `b1` against the pending manifest; figure Brotli 100,295 / 99,929 / 100,126 / 99,110 against today's 92,625 and a ceiling of 102,301 (S2's numbers; not re-computed here) |
| P-b | Correctness in the game | met, with two limits | Five poses at noon, four dusk views and twelve clip frames per build show no vertex off its body and the outline following the bent arm and the wind-up (pictures: `<b>-poses-noon`, `<b>-dusk`, `<b>-hero-clips`); the shadow differs per pose (`a3-shadow.jpg`; `a1` was captured the same way but only `a3`'s sheet is committed); no culling gap in the numeric sweep of `a3` and `a1`; geometries, textures and programs equal before and after 30 kills and respawns and after 30 spawn/dispose cycles, with a control that moves. Limits: I looked at the pictures, nobody else has; the outline shells are not in the numeric cull check |
| P-c | Cost: draw calls at most M0p's minus 20 per skinned goblin in view; frame time not worse | calls met; frame time not worse in this headless run, owner reads it | 52 (three materials) or 56 (one) fewer HUD calls per goblin; every natural-camp sample at least 121 under the bound; render-only ms 0.5 to 2 below today's (the controlled run's 0.5 to 0.9 is near the 0.5 ms noise band) |
| P-d | Shared motion on another stance | met | The hero's converted `Walk` and `Slash` play on the skinned goblin through `AnimationMixer`, on all four builds; the clips' joint-offset and bone-length tracks were dropped by design |
| P-e | Form at close range: head and hands at 5.4, both routes beside today's goblin | evidence delivered; the judgement is the owner's | `close-head-hands.jpg`. What is visible: the pilot's head is larger, with long ears, yellow eyes and tusks, and reads clearly at 5.4; today's head and face are dark and flat at the same distance; the pilot's hands are blocky shapes at the spear shaft and the shield; `a` and `b` look alike at this crop size. Whether that is better is the owner's call |
| P-f | The owner's look | not decided by me | |

## Could not capture, or open

- Frame time on the owner's machine (P-c, P-f): not available in this environment; the numbers above are headless on the same GPU.
- A numeric P-b check that each outline shell is culled with its mesh was not made.
- `b3` and `b1` were not run through the cull sweep (same rig and sphere code as `a3` and `a1`); `a1` and `b1`, `b3` shadow sheets are not committed.
