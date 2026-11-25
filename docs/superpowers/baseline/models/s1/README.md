# S3b: the pilot in the game, again

Plan task S3b (the S3 follow-ups of 2026-11-25), design section 10 (P-a to P-f), 6.1.3 and 6.1.5. It replaces S3's README and pictures. Captured on the NVIDIA GPU (`scripts/capture-gpu.mjs`, ANGLE over D3D12, RTX 4070 Laptop), 1280x720, balanced tier, seeded `Math.random`, skills at 99, outline on for every pose picture. Tree `4a3b0ad` (S2b's fix on top of S1c's engine, so one `Skeleton` per skinned figure).

The four builds are the S2b goblins, rebuilt for this task with the README's BLEND lines (`GOBLIN_BODY` and `GOBLIN_MATS` named, one Blender process at a time) into `scratch/models-build/s3b/{a3,b3,a1,b1}/monsters.glb`, and judged against `tests/fixtures/model-contract/pending/monsters.json`:

| Build | Body route | Materials |
|---|---|---|
| `a3` | (a) `organic_body` from a stick graph | 3 families (skin, wood, metal) |
| `b3` | (b) primitives fused by a voxel remesh | 3 |
| `a1` | (a) | 1, colours in the paint layer |
| `b1` | (b) | 1 |

"Today" is the shipped goblin of the merge-only `monsters.glb` (M0p's file, HEAD).

**Which neighbours are today's models.** In every picture the goblin archers, every other monster, the hero and the camp's props are still today's rigid, merge-only models. Only the left-hand figure of a goblin row, the raider (`Monster_goblin`), is the new skinned build; in the "today" rows it is today's raider as well. Each sheet carries that line in its footer.

Nothing under `src/`, `public/`, `blender/` or `tests/` is changed in the branch. Every run was in a throw-away worktree of HEAD (`git worktree add --detach`, `cp -al node_modules`, the build's GLB and the pending manifest copied over the live ones, `scripts/capped.sh npm run build`, `vite preview` on port 4191, worktree removed afterwards), with one uncommitted debug patch, `ingame/tools/debug.patch`: `__DEBUG` also exposes `G`, `poseMonsterLimbs`, `spawnMonster`, `disposeObject3D`, `getTerrainHeight`, `THREE` and `GLTFLoader`, and a monster with `__hold` set is posed by the game's own `poseMonsterLimbs` alone (flinch, attack and wind-up forced to their mid-point; the wind-up is `logic.windup` at 85%) and skips the AI step. The poses are therefore the game's code on the skinned bones. The scripts are in `ingame/tools/` (`one.sh` per build, `job.mjs` the capture job, `assemble.py` the sheets, `clips.py` P-d's clips). The raw rows of every build are in `ingame/<build>-rows.json` (`base` is today); `b3-rows-rerun.json` is a second full run of `b3` (see the leak check).

## What each picture shows (`ingame/`)

The raider is the left figure of a row, with two of the camp's rigid archers beside it. Camera at (18.5, 12.5), the open grass just east of Three Kettle Camp (the camp's own props stand in front of the camp centre and hid the row), pitch 0.25, distance 6.5 unless said. The hero is hidden. `camp.jpg` is the game itself at `three_kettle_camp`.

| File | Shows |
|---|---|
| `<b>-poses-noon.jpg` (`base`, `a3`, `b3`, `a1`, `b1`) | Noon: standing, walking, mid-attack (`attackAnim` 0.5), mid-flinch (`flinch` 0.5), Stage 4's wind-up pose. |
| `<b>-dusk.jpg` | Phase 0.7: attack with the camera at yaw 0 and at yaw 2.2 (the raised arm in light and in shadow, design 6.1.3's banded-light row), wind-up at yaw 4.2, attack from above (pitch 0.75). |
| `edge.jpg` | One row per build (today, `a3`, `b3`, `a1`, `b1`): the raider in the attack pose with its centre 60 px inside the right edge, on the right edge, and on the left edge (half off). |
| `<b>-shadow.jpg` (all five) | Raider alone, phase 0.62, pitch 1.0, camera yaw 0.6 and 2.4, distance 5: standing, attack, wind-up, flinch. The ground shadow per pose. |
| `distance-26.jpg`, `distance-8.5.jpg` | Rows: today, `a3`, `b3`, `a1`, `b1`; columns standing and attack. Distance 26 (the raider is about 85 px tall, crops enlarged 2x) and 8.5. |
| `camp.jpg` | The unmodified game at `three_kettle_camp`, 8.5 away, pitch 0.3, noon, monsters wandering (the perf run's frame), all five builds. |
| `close-head-hands.jpg` | P-e. Distance 5.4, pitch 0.2, noon, the raider alone, standing: head crop (top row) and hands crop (bottom row), today then `a3`, `b3`, `a1`, `b1`. |
| `<b>-hero-clips.jpg` (`a3`, `b3`, `a1`, `b1`) | P-d. Top row: the hero's `Walk` at u = 0, 0.125, 0.25, 0.375, 0.5, 0.75, the goblin turned side-on. Bottom row: `Slash` at u = 0, 0.14, 0.28, 0.4, 0.48, 0.7, front. |

## Numbers

Draw calls are per frame to the canvas ("colour") and to render targets ("shadow"), averaged over 1 s, as in M0p; HUD is the `#perf-calls` text. **M0p's reference row for the camp: colour 357, shadow 684, HUD 1,041 calls, 604k triangles.** M0p measured no frame time.

### P-a, the file

COMPARE (`node scripts/models-compare.mjs scratch/models-build/s3b/<b>/monsters.glb public/models/monsters.glb`, the pending manifest used) exits 0 for all four builds: Contract (skin rules included) and Budget pass.

| | Today | `a3` | `b3` | `a1` | `b1` |
|---|---|---|---|---|---|
| Goblin figure triangles / meshes / materials (`figureStats`) | 8,292 / 29 / 10 | 4,960 / 3 / 3 | 4,960 / 3 / 3 | 4,960 / 1 / 1 | 4,960 / 1 / 1 |
| Goblin figure raw bytes | 523,952 | 185,312 | 196,180 | 185,312 | 196,180 |
| Goblin figure Brotli bytes | 92,625 | 103,149 | 104,942 | 104,238 | 104,583 |
| `monsters.glb` Brotli bytes (COMPARE's drift line) | 1,281,976 | 1,401,600 | 1,367,062 | 1,395,620 | 1,358,630 |
| `monsters.glb` raw bytes | 4,848,004 | 4,526,144 | 4,537,012 | 4,523,856 | 4,534,724 |

The pending manifest's file ceiling is 1,415,616 Brotli bytes. The archer figure is 75,388 Brotli bytes in all four builds (today 72,904; the Blender 5.0.1 reorder moves it, S2's amendment).

### P-c, cost

**Controlled** (the five camp goblins held standing in view, then hidden; calls per goblin = difference over 5):

| | colour with / without | shadow with / without | HUD with / without | per goblin: colour, shadow, HUD |
|---|---|---|---|---|
| today | 343 / 198 | 640 / 495 | 983 / 693 | 29.0, 29.0, 58 |
| `a3` | 241 / 226 | 528 / 513 | 769 / 739 | 3.0, 3.0, 6 |
| `b3` | 241 / 226 | 528 / 513 | 769 / 739 | 3.0, 3.0, 6 |
| `a1` | 231 / 226 | 518 / 513 | 749 / 739 | 1.0, 1.0, 2 |
| `b1` | 203 / 198 | 518 / 513 | 721 / 711 | 1.0, 1.0, 2 |

One skinned goblin costs 52 fewer HUD calls a frame with three materials and 56 fewer with one, against "at least 20". (`b1`'s absolute numbers sit 28 colour calls under `a1`'s because the other monsters in view differ run to run; its difference over 5 goblins is the same.)

**Natural camp** (the unmodified game at `three_kettle_camp`, noon, monsters wandering, three 1 s samples after 1.5 s each; goblins in view counted by frustum). The bound is M0p's HUD 1,041 minus 20 per goblin in view:

| | colour | shadow | HUD calls | goblins in view | bound per sample | margin |
|---|---|---|---|---|---|---|
| today | 359, 355, 380 | 683, 676, 670 | 1,031, 1,035, 1,046 | 3, 4, 5 | n/a | n/a |
| `a3` | 256, 284, 283 | 559, 556, 554 | 840, 838, 833 | 5, 3, 5 | 941, 981, 941 | 101, 143, 108 |
| `b3` | 256, 284, 283 | 559, 555, 554 | 841, 838, 833 | 5, 3, 5 | 941, 981, 941 | 100, 143, 108 |
| `a1` | 267, 272, 273 | 543, 548, 546 | 817, 818, 820 | 5, 5, 4 | 941, 941, 961 | 124, 123, 141 |
| `b1` | 267, 271, 259 | 543, 548, 546 | 817, 817, 792 | 5, 5, 5 | 941, 941, 941 | 124, 124, 149 |

Every sample of every build passes the draw-call bound by at least 100 calls. HUD triangles at the camp: today 601k to 607k, builds 580k to 589k.

**Frame time.** The `bench` hook (render only, `gl.finish`, ms per frame, 120 frames) at the natural camp: today 6.64, 6.04, 6.02; `a3` 4.99, 5.35, 5.30; `b3` 4.28, 4.96, 5.49; `a1` 5.45, 5.06, 4.12; `b1` 5.42, 4.07, 3.96. Controlled run (200 frames), five goblins in view / hidden: today 4.72 / 3.17; `a3` 4.22 / 3.34; `b3` 4.14 / 2.72; `a1` 3.50 / 3.01; `b1` 3.53 / 2.76. The same scene without goblins varies 0.6 ms between builds (2.72 to 3.34), so a difference under about 0.6 ms is noise. The builds read 0.5 to 2 ms below today's at the natural camp, never above. This is headless Chromium on the same GPU in a software-timed loop, not the owner's machine, and M0p measured no frame time, so the owner reads it at OM-P.

### P-b, correctness numbers

| Check | today | `a3` | `b3` | `a1` | `b1` |
|---|---|---|---|---|---|
| Skinned goblins at load (of 5) | 0 | 5 | 5 | 5 | 5 |
| Meshes under a goblin / skinned body meshes / outline shells / shells visible at load | 56 / 0 / 26 / 0 | 7 / 3 / 3 / 0 | 7 / 3 / 3 / 0 | 3 / 1 / 1 / 0 | 3 / 1 / 1 / 0 |
| Shells that are `SkinnedMesh` | 0 | 3 | 3 | 1 | 1 |
| **Distinct `Skeleton` objects per goblin / bone textures per goblin** | 0 / 0 | **1 / 1** | **1 / 1** | **1 / 1** | **1 / 1** |
| `renderer.info.memory` before the kill loop: geometries / textures / programs | 2,620 / 27 / 21 | 2,490 / 32 / 24 | 2,490 / 32 / 24 (rerun 2,487) | 2,479 / 32 / 24 | 2,479 / 32 / 24 |
| after 30 kills and respawns of one goblin | same | same | **+1 geometry** (2,491); the rerun and a leak-only run: same | same | same |
| after 30 spawn then `disposeObject3D` cycles of a goblin | same | same | same (2,491) | same | same |
| control: 5 more spawns not disposed, then disposed: textures | 27, 27, 27 | 32, 37, 32 | 32, 37, 32 | 32, 37, 32 | 32, 37, 32 |
| control: geometries | 2,620, 2,770, 2,620 | 2,490, 2,510, 2,490 | 2,491, 2,511, 2,491 | 2,479, 2,489, 2,479 | 2,479, 2,489, 2,479 |

**Bone textures: one per figure.** With S1c's shared skeleton every goblin has one `Skeleton` and one bone texture, whether it has three skinned meshes (`a3`, `b3`) or one. The texture count at load is 32 for all four builds (27 today plus one per goblin for five goblins); S3 measured 42 for `a3` and `b3`. Five undisposed spawns add 5 textures, one per goblin.

How the kills were driven: the loop sets `logic.state = 'dying'` with a 0.1 s timer, waits for `dead`, sets the timer to 0.05 s, waits for the real respawn step, 30 times, in the running game. A death and a respawn only toggle `group.visible`, so equal counts after the kill loop prove little by themselves; the test that can fail is the spawn/dispose loop (30 `spawnMonster('goblin')`, a few rendered frames, `disposeObject3D(rig.group)`), and its control shows the counts move when a goblin is not disposed (+20 geometries and +5 textures for five three-material goblins, +10 and +5 for one-material ones) and return exactly when it is. The game itself never disposes a monster; the disposal path is exercised here only.

**The one extra geometry in `b3`'s first full run.** Before the kill loop `b3` had 2,490 geometries and after it 2,491; the spawn/dispose loop after it started and ended at 2,491. A second full run of `b3` (`b3-rows-rerun.json`) and a run of the leak step alone had equal counts before and after, and the "before" value itself moves between identical runs (2,487 and 2,490 in full runs, 2,428 in the leak-only run), so something outside the figures creates a geometry lazily (the game is not fully deterministic under the seed). `a3`, which has the same skinned goblin code path, shows no change. I did not find which object it is.

**Posed vertices against each mesh's own `boundingSphere`** (`S3.sphere` in `job.mjs`): for each skinned mesh of the raider, every vertex is posed through `SkinnedMesh.getVertexPosition` (the skin applied on the CPU, in the mesh's local space) and its distance to the centre of that mesh's `boundingSphere` is compared with its radius. Poses: standing, walking, attack, wind-up, flinch (the game's `poseMonsterLimbs`) and the hero's `Walk` at six frames and `Slash` at six frames (P-d's mixer), 17 poses per build. The outline shells are included (their sphere is the mesh's plus `thickness * 1.5 + 0.05` = 0.083; the shell shader pushes a vertex out by the thickness, 0.022; the check itself uses the un-inflated posed vertex).

| | vertex-poses outside their sphere (all poses, bodies and shells) | largest distance / radius: attack | wind-up | `Slash` | `Walk` | any pose |
|---|---|---|---|---|---|---|
| `a3` | 0 of 100,912 | 0.656 | 0.657 | 0.695 | 0.697 | 0.697 |
| `b3` | 0 of 108,018 | 0.656 | 0.657 | 0.695 | 0.697 | 0.697 |
| `a1` | 0 of 100,912 | 0.598 | 0.598 | 0.667 | 0.642 | 0.667 |
| `b1` | 0 of 108,018 | 0.598 | 0.598 | 0.668 | 0.642 | 0.668 |

The largest distance never exceeds 0.70 of the radius: the spheres are the rest-pose sphere times 1.5 (`fixCullSpheres`), generous by design.

**Culling sweep**, all four builds (`cull` in `job.mjs`): the raider standing, mid-attack and winding up placed with its centre from 200 px inside the right and left edges to 700 px outside (every 25 px, 74 placements per pose). In no placement of any build is a bone inside the frustum while three culls a skinned mesh of the goblin (`boneVisibleButMeshCulled` is empty for 3 poses x 74 placements x 4 builds). The outline shells are not in the sweep; `edge.jpg` shows them drawn with the figure at the right edge, on it, and half off both edges.

**Facing.** `closeFrontToCamera` is true for the raider and an archer in every build (the left-arm bone projects to the right of the right-arm bone), so the P-e crops are like for like.

### P-d, shared motion on another stance

Built in scratch, not committed (`tools/clips.py`, `blender --background s3b/a3/monsters.blend --python clips.py`): `build_hero.build_all_animations` called with `build_action` replaced by a recorder, which yields the hero's own `sample_walk` (32 frames) and `sample_slash` (24 frames). Converted as design 6.1.5 says and made through `figkit.make_clip` on the goblin's armature (the rig and bone names are the same in all four builds, so the one GLB serves all four): `HeadGroup`, `LeftArmPivot` and `RightArmPivot` get `inverse(torso) * q` per frame (continuous Euler, `XZY`); the torso, elbows, knees and legs keep the authored triples; `Torso`'s own position keys and the follow-the-torso position keys are dropped; the legs' `pos` of `Walk` (the dip) becomes the `Hips` location track, scaled by the goblin's hip height over the hero's (0.6936 / 0.9 = 0.7707); `Slash` has none. In the throw-away worktree a twenty-line `AnimationMixer` (the `clips` step of `job.mjs`) loads that GLB, keeps only `*.quaternion` tracks and `Hips.position` (the exporter also writes a translation and a scale track for every bone; they were dropped so the goblin's joint offsets and bone lengths stay), strips the `goblin_` prefix, and binds by bone name on the raider's group; frames are set by `action.time`. Each clip has 20 tracks: `Walk` 1.333 s, `Slash` 1.0 s.

Result, on all four builds (`<b>-hero-clips.jpg`): both clips play on the skinned goblin with no change under `src/`; the legs alternate and the hips dip in `Walk`; the right arm winds back and strikes with the spear in `Slash`; no frame shows torn or stretched skin, and no vertex leaves its mesh's sphere in any of the twelve clip frames (table above). The goblin's proportions are its own (shorter legs, bigger head) while the timing is the hero's.

### What the pictures show (my reading; art judgement is the owner's)

- Distance 26 (`distance-26.jpg`): in all five builds the raider reads as a green figure with a spear and a round shield and, in the attack pose, an arm raised; the pilot's head carries visible ears; today's raider and the archers read as darker, more uniform green. At 8.5 (`distance-8.5.jpg`) the pilot shows the large head with ears, eyes and tusks, a bone and rust loincloth, and the shield; the one-material builds have a lighter bronze shield and boss than the three-material builds.
- Distance 5.4 (`close-head-hands.jpg`): the pilot's head is larger than today's, with long ears, yellow eyes with dark pupils (S2b) and tusks; today's head at the same crop is a dark, flat shape. The pilot's hands are blocky shapes at the spear shaft and the shield rim; routes (a) and (b) look alike at this crop size.
- Noon and dusk rows, shadow sheets: the outline follows the bent arm in each pose; the wind-up shows the raised arm and the spear; the ground shadow differs between standing, attack, wind-up and flinch at both camera yaws.

## P-a to P-f

Marked by what I measured. P-c's frame time and P-f are the owner's reading (OM-P).

| # | Criterion | Mark | Evidence |
|---|---|---|---|
| P-a | The file: Contract and Budget pass, skin rules included; Brotli bytes of the figure measured for each route and variant | met | COMPARE exit 0 for `a3`, `b3`, `a1`, `b1` against the pending manifest; figure Brotli 103,149 / 104,942 / 104,238 / 104,583 against today's 92,625; file Brotli 1,401,600 / 1,367,062 / 1,395,620 / 1,358,630 against a file ceiling of 1,415,616 |
| P-b | Correctness in the game | met, with limits | 0 of 100,912 (`a3`, `a1`) and 108,018 (`b3`, `b1`) posed vertex checks outside their own mesh's `boundingSphere` in all 17 poses (attack, wind-up, flinch, stand, walk, six `Walk` and six `Slash` frames); outline shells follow the bent arm and the wind-up (`<b>-poses-noon`, `<b>-dusk`); the shadow differs per pose (`<b>-shadow`, all five); no culling gap in the sweep on all four builds, and the figure is drawn at the edge, on it and half off in `edge.jpg`; one skeleton and one bone texture per goblin on all four; geometries, textures and programs equal before and after 30 kills and respawns and after 30 spawn/dispose cycles on `a3`, `a1`, `b1`, and on `b3` in two of three runs (one run showed +1 geometry, not reproduced, source unknown). Limits: the pictures were read by me only; the outline shells are not in the numeric sweep; the shadow is checked by picture |
| P-c | Cost: draw calls at most M0p's minus 20 per skinned goblin in view; frame time not worse | calls met; frame time not worse in this headless run, owner reads it | 52 (three materials) or 56 (one) fewer HUD calls per goblin; every natural-camp sample at least 100 under the bound; render-only ms 0.5 to 2 below today's at the natural camp (the controlled run's differences are partly inside the 0.6 ms noise band); M0p has no frame time |
| P-d | Shared motion on another stance | met | The hero's converted `Walk` and `Slash` play on the skinned goblin through `AnimationMixer`, on all four builds; the clips' joint-offset and bone-length tracks were dropped by design; no vertex outside its sphere in the 12 clip frames |
| P-e | Form at close range: head and hands at 5.4, both routes beside today's goblin | evidence delivered; the judgement is the owner's | `close-head-hands.jpg`, `distance-8.5.jpg`, `distance-26.jpg`; my reading is above |
| P-f | The owner's look | not decided by me | |

## Could not capture, or open

- Frame time on the owner's machine (P-c, P-f): not available here. The numbers above are headless Chromium on the same GPU.
- The numeric P-b checks cover the raider's bodies and shells posed by the game's code and by the mixer; the attack and wind-up are the single mid-point `poseMonsterLimbs` forces, not every phase of the swing. The cull sweep does not include the shells.
- The `b3` +1 geometry: seen once, not reproduced, not attributed.
- The captures are at the open grass beside Three Kettle Camp, not at its centre (props hide the row there); `camp.jpg` and the perf runs are at the camp itself.
- The hero's clips were converted from the `a3` blend and applied to all four builds (same rig, same bone names); the other builds' armatures were not exported separately.
