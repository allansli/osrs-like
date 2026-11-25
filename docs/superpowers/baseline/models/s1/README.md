# S3c: the pilot in the game, last capture before OM-P

Plan task S3c (the S3b follow-ups of 2026-11-25), design section 10 (P-a to P-f), 6.1.3 and 6.1.5. It replaces S3b's README and pictures. Captured on the NVIDIA GPU (`scripts/capture-gpu.mjs`, ANGLE over D3D12, RTX 4070 Laptop), 1280x720, balanced tier, seeded `Math.random`, skills at 99, outline on for every pose picture. Tree `e4f28de` (S2c's fix and S1d's skinned outline normals, S1c's shared skeleton).

The four builds are the S2c goblins, rebuilt for this task with the README's BLEND lines (`GOBLIN_BODY` and `GOBLIN_MATS` named, one Blender process at a time) into `scratch/models-build/s3b/{a3,b3,a1,b1}/monsters.glb`. COMPARE: `a3` and `b3` against `tests/fixtures/model-contract/pending/monsters.json`; `a1` and `b1` (copied to `monsters.one-material.glb`, as the main README says) against `pending/monsters.one-material.json`. In each throw-away worktree the matching manifest was copied over the live one.

| Build | Body route | Materials |
|---|---|---|
| `a3` | (a) `organic_body` from a stick graph | 3 families (skin, wood, metal) |
| `b3` | (b) primitives fused by a voxel remesh | 3 |
| `a1` | (a) | 1, colours in the paint layer |
| `b1` | (b) | 1 |

"Today" (`base`) is the shipped goblin of the merge-only `monsters.glb` (M0p's file, HEAD).

**Which neighbours are today's models.** The goblin archers, every other monster, the hero and the camp's props are still today's rigid, merge-only models. Only the left-hand figure of a goblin row, the raider (`Monster_goblin`), is the new skinned build; in the "today" rows it is today's raider as well. The sheets' captions say the same.

Nothing under `src/`, `public/`, `blender/` or `tests/` is changed in the branch. Every run was in a throw-away worktree of HEAD (`git worktree add --detach`, `cp -al node_modules`, the build's GLB and manifest copied over the live ones, `scripts/capped.sh npm run build`, `vite preview` on port 4191, worktree removed afterwards; no server or worktree is left). Two uncommitted edits exist only in those worktrees, both in `ingame/tools/`: `debug.patch` (`__DEBUG` also exposes `G`, `poseMonsterLimbs`, `spawnMonster`, `disposeObject3D`, `getTerrainHeight`, `THREE`, `GLTFLoader`; a monster with `__hold` set is posed by the game's own `poseMonsterLimbs` alone, flinch, attack and wind-up forced to their mid-point, and skips the AI step) and a `sed` in `one.sh` that adds a `window.__lookDy` look-at offset to `updateCamera` (the camera's minimum distance 3.6 and its 1.85 look height cannot frame a 1.3 tall goblin at 720 px; the job also sets `camState.distance` past the clamp). The scripts: `one.sh` per build, `all.sh`, `build.sh` (the four BLEND lines and COMPARE), `job.mjs` the capture job, `assemble.py` the sheets, `clips.py` P-d's clips, `cmp-<b>.txt` each COMPARE report. The raw rows of every build are `ingame/<build>-rows.json` (`base` is today).

## What each picture shows (`ingame/`)

Unless said, the raider is the left figure of a row, with two of the camp's rigid archers beside it. Camera at (18.5, 12.5), the open grass just east of Three Kettle Camp (the camp's props stand in front of the camp centre and hide the row), pitch 0.25, distance 6.5, noon, hero hidden. `camp.jpg` is the game itself at `three_kettle_camp`.

| File | Shows |
|---|---|
| `a3-body-front.jpg`, `a3-body-side.jpg`, `a1-body-front.jpg`, `a1-body-side.jpg` | **S3c.** Full 1280x720 frames, the raider alone (archers hidden), outline on, standing, camera 3.0 away, front then side-on. For the outline check. |
| `a3-body-attack-side.jpg` | The same, side-on, in the mid-attack pose (the arm and spear thrust forward). |
| `<b>-poses-noon.jpg` (`base`, `a3`, `b3`, `a1`, `b1`) | Noon: standing, walking, mid-attack, mid-flinch, Stage 4's wind-up pose. |
| `<b>-dusk.jpg` | Phase 0.7: attack at camera yaw 0 and 2.2 (the raised arm in light and shadow), wind-up at yaw 4.2, attack from above. |
| `edge.jpg` | One row per build: the raider in the attack pose 60 px inside the right edge, on it, and on the left edge (half off). |
| `<b>-shadow.jpg` (all five) | Raider alone, phase 0.62, pitch 1.0, yaw 0.6 and 2.4: standing, attack, wind-up, flinch. The ground shadow per pose. |
| `distance-26.jpg`, `distance-8.5.jpg` | Rows today, `a3`, `b3`, `a1`, `b1`; columns standing, attack. Distance 26 (the raider is about 85 px tall, crops enlarged 2x) and 8.5. |
| `camp.jpg` | The unmodified game at `three_kettle_camp`, 8.5 away, noon, monsters wandering (the perf run's frame), all five. |
| `close-head-hands.jpg` | P-e. Distance 5.4, the raider alone, standing: head crop (top), hands crop (bottom): today, `a3`, `b3`, `a1`, `b1`. |
| `<b>-hero-clips.jpg` (`a3`, `b3`, `a1`, `b1`) | P-d. Top: the hero's `Walk` at u = 0, 0.125, 0.25, 0.375, 0.5, 0.75, goblin turned side-on. Bottom: `Slash` at u = 0, 0.14, 0.28, 0.4, 0.48, 0.7, front. |

The pictures are JPEG quality 80; the sheets are reduced so the folder stays under 2 MB (1,952,046 bytes with tools and rows); the `*-body-*` frames are full size.

## Numbers

Draw calls are per frame to the canvas ("colour") and to render targets ("shadow"), averaged over 1 s, as in M0p; HUD is the `#perf-calls` text. **M0p's camp reference: colour 357, shadow 684, HUD 1,041 calls, 604k triangles.** M0p measured no frame time.

### P-a, the file

COMPARE exits 0 on all four builds against their manifests: Contract (skin rules included) and Budget pass. Drift names the raider's nodes and meshes and the file's three totals, and no node, mesh or geometry line of another figure (0 such lines in each report).

| | Today | `a3` | `b3` | `a1` | `b1` |
|---|---|---|---|---|---|
| Goblin figure triangles / meshes / materials (`figureStats`) | 8,292 / 29 / 10 | 4,960 / 3 / 3 | 4,960 / 3 / 3 | 4,960 / 1 / 1 | 4,960 / 1 / 1 |
| Goblin figure raw bytes | 523,952 | 200,444 | 219,632 | 200,444 | 219,632 |
| Goblin figure Brotli bytes | 92,625 | 111,215 | 118,372 | 112,678 | 117,106 |
| `monsters.glb` raw bytes | 4,848,004 | 4,541,592 | 4,560,784 | 4,538,988 | 4,558,176 |
| `monsters.glb` Brotli bytes (quality 3) | 1,281,976 | 1,399,122 | 1,418,420 | 1,368,195 | 1,410,213 |
| Materials in the file | | 38 | 38 | 36 | 36 |

The archer figure is 75,388 Brotli bytes in all four builds (today 72,904; the Blender 5.0.1 reorder moves it). The goblin's `Brotli` figure is the S2c cost of closing the planes: 111 to 118 kB against today's 93 kB.

### P-c, cost

**Controlled** (the five camp goblins held standing in view, then hidden; per goblin = difference over 5):

| | colour with / without | shadow with / without | HUD with / without | per goblin: colour, shadow, HUD |
|---|---|---|---|---|
| today | 343 / 198 | 640 / 495 | 983 / 693 | 29.0, 29.0, 58 |
| `a3` | 213.4 / 198.5 | 528 / 513 | 742 / 712 | 3.0, 3.0, 6 |
| `b3` | 213.4 / 198.5 | 528 / 513 | 742 / 711 | 3.0, 3.0, 6.2 |
| `a1` | 233 / 228 | 519 / 514 | 752 / 742 | 1.0, 1.0, 2 |
| `b1` | 231 / 226 | 518 / 513 | 749 / 739 | 1.0, 1.0, 2 |

A skinned goblin costs 52 fewer HUD calls a frame with three materials and 56 fewer with one, against "at least 20".

**Natural camp** (unmodified game at `three_kettle_camp`, noon, monsters wandering, three 1 s samples 1.5 s apart; goblins in view by frustum). The bound is M0p's HUD 1,041 minus 20 per goblin in view:

| | colour | shadow | HUD calls | goblins in view | bound | margin |
|---|---|---|---|---|---|---|
| today | 359, 355, 380 | 683, 676, 670 | 1,031, 1,034, 1,046 | 3, 4, 5 | n/a | n/a |
| `a3` | 258, 251, 247 | 558, 559, 554 | 837, 803, 811 | 4, 3, 5 | 961, 981, 941 | 124, 178, 130 |
| `b3` | 258, 250, 247 | 558, 559, 554 | 837, 797, 811 | 4, 3, 5 | 961, 981, 941 | 124, 184, 130 |
| `a1` | 269, 269, 274 | 543, 547, 540 | 812, 816, 810 | 5, 5, 4 | 941, 941, 961 | 129, 125, 151 |
| `b1` | 267, 271, 273 | 543, 548, 546 | 817, 818, 820 | 5, 5, 4 | 941, 941, 961 | 124, 123, 141 |

Every sample of every build passes by at least 123 calls. HUD triangles at the camp: today 601k to 607k, builds 572k to 586k.

**Frame time** (the `bench` hook: render only, `gl.finish`, ms per frame). Natural camp, 120 frames, three samples: today 6.56, 5.87, 5.97; `a3` 5.95, 4.71, 3.77; `b3` 5.09, 4.21, 4.06; `a1` 4.68, 4.58, 4.44; `b1` 5.03, 5.37, 5.28. Controlled, 200 frames, five goblins in view / hidden: today 4.41 / 2.51; `a3` 3.79 / 2.60; `b3` 3.71 / 3.19; `a1` 3.48 / 3.07; `b1` 3.26 / 2.88. The same scene without goblins varies 0.6 ms between builds, so a difference under about 0.6 ms is noise. No build reads above today's. This is headless Chromium on the same GPU, not the owner's machine; M0p measured no frame time, so the owner reads it at OM-P.

### P-b, correctness numbers

| Check | today | `a3` | `b3` | `a1` | `b1` |
|---|---|---|---|---|---|
| Skinned goblins at load (of 5) | 0 | 5 | 5 | 5 | 5 |
| Meshes under a goblin / skinned bodies / outline shells / shells visible at load | 56 / 0 / 26 / 0 | 7 / 3 / 3 / 0 | 7 / 3 / 3 / 0 | 3 / 1 / 1 / 0 | 3 / 1 / 1 / 0 |
| Shells that are `SkinnedMesh` | 0 | 3 | 3 | 1 | 1 |
| **Distinct `Skeleton`s per goblin / bone textures per goblin** | 0 / 0 | **1 / 1** | **1 / 1** | **1 / 1** | **1 / 1** |
| `renderer.info.memory` before the 30 kills: geometries / textures / programs | 2,627 / 27 / 21 | 2,311 / 32 / 24 | 2,307 / 32 / 24 | 2,284 / 32 / 24 | 2,478 / 32 / 24 |
| after 30 kills and respawns | same | same | same | same | same |
| after 30 spawn then `disposeObject3D` cycles | same | same | same | same | same |
| control: 5 spawns not disposed: geometries / textures | +150 / +0 | +20 / +5 | +20 / +5 | +10 / +5 | +10 / +5 |
| control: after disposing them | back | back | back | back | back |

Bone textures: one per figure on all four builds (32 textures at load = 27 plus one per each of five goblins). How the kills were driven: the loop sets `logic.state = 'dying'` with a 0.1 s timer, waits for `dead`, sets 0.05 s and waits for the real respawn, 30 times, in the running game. A death and respawn only toggle `group.visible`, so equal counts after it prove little by themselves; the test that can fail is the spawn/dispose loop, and its control shows the counts move when a goblin is not disposed and return when it is. The game never disposes a monster; the disposal path is exercised here only. The "before" value itself differs between builds and between runs (S3b saw 2,487 and 2,490 for the same build): something outside the figures creates geometries lazily; all five of these runs had equal counts before and after. S3b's `b3` +1 geometry did not appear in this run (not attributed).

**Posed vertices against each mesh's own `boundingSphere`** (`S3.sphere` in `job.mjs`): every vertex of every skinned mesh of the raider, bodies and outline shells, posed through `SkinnedMesh.getVertexPosition`, distance to that mesh's sphere centre against its radius. 17 poses: standing, walking, attack, wind-up, flinch (the game's `poseMonsterLimbs`) and the hero's `Walk` and `Slash` at six frames each.

| | vertex-poses outside their sphere | largest distance / radius: stand | walk | attack | wind-up | flinch | `Slash` | `Walk` |
|---|---|---|---|---|---|---|---|---|
| `a3` | 0 of 110,806 | 0.680 | 0.677 | 0.656 | 0.657 | 0.681 | 0.695 | 0.697 |
| `b3` | 0 of 123,352 | 0.680 | 0.676 | 0.656 | 0.657 | 0.681 | 0.695 | 0.697 |
| `a1` | 0 of 110,806 | 0.635 | 0.638 | 0.598 | 0.598 | 0.619 | 0.667 | 0.642 |
| `b1` | 0 of 123,352 | 0.636 | 0.627 | 0.598 | 0.598 | 0.619 | 0.668 | 0.642 |

The largest ratio is 0.697: the spheres are the rest-pose sphere times 1.5 (`fixCullSpheres`).

**Culling sweep**, all four builds: the raider standing, mid-attack and winding up placed with its centre from 200 px inside the right and left edges to 700 px outside, every 25 px (74 placements per pose). In no placement of any build is a bone inside the frustum while three culls a skinned body mesh (`boneVisibleButMeshCulled` empty, 3 poses x 74 x 4 builds). The shells are not in the sweep. `edge.jpg` shows them drawn with the figure inside the edge (centre at x = 1219), on it (1279) and half off the left edge (-40), on all four builds.

**Facing.** `closeFrontToCamera` is true for the raider and an archer in every build.

### The outline on hard edges (S1d, the S3c addition)

`a3-body-front/side/attack-side.jpg` and `a1-body-front/side.jpg` are full 1280x720 frames of the raider with the outline on. I looked at each at full size for a gap in the black line along the silhouette and along the overlaps (upper arm, forearm, hand, spear shaft, shield, knees, feet, the loincloth, ears): in these five frames the outline runs unbroken round the body, arms, legs, feet, head and ears; where S3b opened at the upper arm, outer forearm, hand and feet, the line now closes. Where the shell of the arm lies over the body it reads as a thicker black wedge (the front view beside the left forearm and the spear), not a hole. This is my reading by eye of five frames, not a pixel measurement, and there is no automated gap test; `tests/skinned-outline-normals.test.ts` covers the vertex data, not the picture.

### P-d, shared motion on another stance

Built in scratch, not committed (`tools/clips.py`, run on `scratch/models-build/s3b/a3/monsters.blend`): `build_hero.build_all_animations` with `build_action` replaced by a recorder yields the hero's own `sample_walk` (32 frames) and `sample_slash` (24). Converted as design 6.1.5 says and made through `figkit.make_clip` on the goblin's armature (the rig and bone names are the same in all four builds, so the one GLB serves all): `HeadGroup`, `LeftArmPivot`, `RightArmPivot` get `inverse(torso) * q` per frame (continuous `XZY` Euler); the torso, elbows, knees and legs keep their authored triples; `Torso`'s own position keys and the follow-the-torso position keys are dropped; the legs' dip in `Walk` becomes the `Hips` location track scaled by the goblin's hip height over the hero's (0.6936 / 0.9); `Slash` has none. In the throw-away worktree a twenty-line `AnimationMixer` (the `clips` step of `job.mjs`) loads that GLB, keeps only `*.quaternion` tracks and `Hips.position` (the exporter also writes a translation and a scale track per bone; dropped so the goblin's joint offsets and bone lengths stay), strips the `goblin_` prefix and binds by bone name on the raider's group. Each clip has 20 tracks: `Walk` 1.333 s, `Slash` 1.0 s.

Result on all four builds (`<b>-hero-clips.jpg`): both clips play on the skinned goblin with nothing changed under `src/`; legs alternate and the hips dip in `Walk`; the right arm winds back and strikes in `Slash`; no frame shows torn or stretched skin and no vertex leaves its sphere in any of the twelve frames (table above). The goblin's proportions are its own while the timing is the hero's.

### What the pictures show (my reading; art judgement is the owner's)

- Distance 26: in all five builds the raider reads as a figure with a spear and a round shield, an arm raised in attack; the pilot's pale-olive head and ears separate it from today's darker, uniform raider and archers.
- Close (`a3-body-front.jpg`, `close-head-hands.jpg`): the pilot has a large head with long ears, yellow eyes with dark pupils and tusks, a shaded chest and belly in distinct tones, a bone-and-rust loincloth, a bronze-rimmed wooden shield (a lighter, yellower shield in the one-material builds), flat feet. The planes read at this size as separate tones across the chest, upper arms and thighs. The routes (a) and (b) look alike at crop size; `b` is 19,188 raw and 4,428 to 7,157 Brotli bytes larger.
- Noon, dusk and shadow sheets: the outline follows the bent arm in each pose; the wind-up shows the raised arm and spear; the ground shadow differs between standing, attack, wind-up and flinch at both camera yaws.
- In `close-head-hands.jpg` the "today" tile shows the back of today's goblin, not its face (the arm-projection facing check reported front for it; I did not find why the crop shows the back); its crop is therefore not like for like with the pilot's.

## P-a to P-f

Marked by what I measured. P-c's frame time and P-f are the owner's reading (OM-P).

| # | Criterion | Mark | Evidence |
|---|---|---|---|
| P-a | The file: Contract and Budget pass, skin rules included; Brotli bytes of the figure measured per route and variant | met | COMPARE exit 0 on `a3`, `b3` (pending `monsters.json`) and `a1`, `b1` (pending `monsters.one-material.json`); figure Brotli 111,215 / 118,372 / 112,678 / 117,106 against today's 92,625; file Brotli 1,399,122 / 1,418,420 / 1,368,195 / 1,410,213 |
| P-b | Correctness in the game | met, with limits | 0 of 110,806 (`a3`, `a1`) and 123,352 (`b3`, `b1`) posed-vertex checks outside their own sphere in 17 poses; no cull gap in the sweep on all four; the figure is drawn inside, on and half off the edge; one skeleton and one bone texture per goblin on all four; geometries, textures and programs equal before and after 30 kills and 30 spawn/dispose cycles on all four, and the control moves; the outline is unbroken at 1280x720 in the front, side and attack-side frames of `a3` and the front and side of `a1`. Limits: the outline and the shadow are checked by my reading of pictures, no pixel test; the shells are not in the numeric sweep; attack and wind-up are the one mid-point `poseMonsterLimbs` forces, not every phase of the swing; `b3` and `b1` outlines were not captured at full size |
| P-c | Cost: draw calls at most M0p's minus 20 per skinned goblin in view; frame time not worse | calls met; frame time not worse in this headless run, owner reads it | 52 (three materials) or 56 (one) fewer HUD calls per goblin; every natural-camp sample at least 123 under the bound; render-only ms at or below today's in every sample; M0p has no frame time |
| P-d | Shared motion on another stance | met | the hero's converted `Walk` and `Slash` play on the skinned goblin through `AnimationMixer` on all four builds; position and scale tracks dropped by design; no vertex outside its sphere in the 12 clip frames |
| P-e | Form at close range: head and hands at 5.4, both routes beside today's goblin | evidence delivered; the judgement is the owner's | `close-head-hands.jpg`, `distance-8.5.jpg`, `distance-26.jpg`, `a3-body-front.jpg`; my reading is above; today's tile shows its back |
| P-f | The owner's look | not decided by me | |

## Could not capture, or open

- Frame time on the owner's machine (P-c, P-f): headless Chromium on the same GPU only.
- No pixel-level gap test of the outline; full-size frames were captured for `a3` and `a1` only, as the task says; the outline in `b3` and `b1` is seen only in the sheets.
- Captures are on the open grass beside Three Kettle Camp, not at its centre (props hide the row); `camp.jpg` and the perf runs are at the camp itself.
- The hero's clips were converted from the `a3` blend and applied to all four builds (same rig and bone names); the other builds' armatures were not exported separately.
- The `memory` "before" counts move between runs for reasons outside the goblin (S3b); the kill and dispose loops compare within a run.
- The body close-ups use a debug look-at offset and a camera distance below the game's minimum; the game's own camera cannot get this close.
- Today's goblin crop in `close-head-hands.jpg` shows its back.
