# S3d: the pilot in the game with the owner's choices

Plan task S3d ("After OM-P"), design section 10 (P-a to P-f), 6.1.3 and 6.1.5. It replaces S3c's README and pictures (nothing of `b3`, `a1`, `b1`, `a3` or S3c's "today" rows is kept). The owner's OM-P answers: route (a), three families, accept, the `cut` shade on painted skinned figures (S1e) and a greyer goblin-hide tile (E2). S2d made them the builder's only path. Captured on the NVIDIA GPU (`scripts/capture-gpu.mjs`, ANGLE over D3D12, RTX 4070 Laptop), 1280x720, balanced tier, seeded `Math.random`, skills at 99, outline on for every pose picture. Tree `1b2cd64` (S2d's builder, S1e's cut shade, E2's tile at `615bc17`, S1c and S1d).

**The one build** ("S2d pilot") is the plan's plain BLEND line, `env -i ... timeout 600 env BLENDER_PATH=/usr/bin/blender node scripts/run-blender.mjs monsters --out scratch/models-build/s3d` (no `GOBLIN_*` variable), one Blender process, then COMPARE `scratch/models-build/s3d/monsters.glb` against `public/models/monsters.glb` (Contract against `tests/fixtures/model-contract/pending/monsters.json`). In its throw-away worktree the pending manifest was copied over the live one. **"Today"** is the shipped goblin of `public/models/monsters.glb` at HEAD (M0p's merge-only file), in its own throw-away worktree.

**Which neighbours are today's models.** The goblin archers, every other monster, the hero and the camp's props are still today's rigid, merge-only models. Only the left-hand figure of a goblin row, the raider (`Monster_goblin`), is the new skinned build; in the "today" rows it is today's raider as well. The sheets' captions say the same. **The greyer tile (`615bc17`) is in both worktrees**, so it also tints today's archers and today's goblin: "today" here is the shipped file under the greyer tile, not the S3c "today". Today's rows therefore read greyer than M0p's pictures.

Nothing under `src/`, `public/`, `blender/` or `tests/` is changed in the branch (UNTOUCHED prints nothing). Every run was in a throw-away worktree of HEAD (`git worktree add --detach`, `cp -al node_modules`, GLB and manifest copied over the live ones, `scripts/capped.sh npm run build`, `vite preview` on port 4191, `git worktree remove --force` afterwards; no server or worktree is left). Two uncommitted edits exist only in those worktrees: `tools/debug.patch` (`__DEBUG` also exposes `G`, `poseMonsterLimbs`, `spawnMonster`, `disposeObject3D`, `getTerrainHeight`, `THREE`, `GLTFLoader`; a monster with `__hold` set is posed by the game's own `poseMonsterLimbs` alone, flinch, attack and wind-up forced to their mid-point, and skips the AI step) and a `sed` in `tools/one.sh` that adds a `window.__lookDy` look-at offset to `updateCamera` (the body close-ups; the camera's minimum distance 3.6 cannot frame a 1.3 tall goblin, so the job also sets `camState.distance` past the clamp). Scripts in `ingame/tools/`: `build.sh` (BLEND and COMPARE), `one.sh` (per build), `all.sh`, `job.mjs` (the capture job), `job-facing.mjs` (a chase check, below), `assemble.py` (the sheets), `clips.py` (P-d), `stats.mjs` (figure numbers), `cmp-s2d.txt` (COMPARE report). Raw rows: `ingame/s2d-rows.json` and `ingame/base-rows.json`.

## What each picture shows (`ingame/`)

Unless said, the raider is the left figure of a row, with two of the camp's rigid archers beside it. Camera at (18.5, 12.5), open grass just east of Three Kettle Camp (the camp's props hide the row), pitch 0.25, distance 6.5, noon, hero hidden. `camp.jpg` is the unmodified game at `three_kettle_camp`.

| File | Shows |
|---|---|
| `s2d-body-front.jpg`, `s2d-body-side.jpg`, `s2d-body-attack-side.jpg` | Full 1280x720 frames of the body close (raider alone, outline on, camera 3.0 away): front lit by the noon sun from the camera's side, side-on, and side-on in the mid-attack pose. |
| `s2d-body-front-dusk.jpg` | The same front frame at phase 0.7 (dusk). |
| `base-body-front.jpg`, `base-body-side.jpg` | Today's goblin in the same two frames. |
| `<b>-poses-noon.jpg` (`base`, `s2d`) | Noon: standing, walking, mid-attack, mid-flinch, Stage 4's wind-up pose, all through `poseMonsterLimbs`. |
| `<b>-dusk.jpg` | Phase 0.7: attack at camera yaw 0 and 2.2 (the raised arm in light and shadow), wind-up at yaw 4.2, attack from above. |
| `edge.jpg` | Top row today, bottom row the pilot: the raider in the attack pose 60 px inside the right edge, on it, and on the left edge (half off). |
| `<b>-shadow.jpg` | Raider alone, phase 0.62, pitch 1.0, yaw 0.6 and 2.4: standing, attack, wind-up, flinch. The ground shadow per pose. |
| `distance-26.jpg`, `distance-8.5.jpg` | Rows today and pilot, columns standing and attack. Distance 26 (the raider about 85 px tall; crops enlarged 2x) and 8.5. Archers beside it are today's. |
| `camp.jpg` | The game at `three_kettle_camp`, 8.5 away, noon, monsters wandering (the perf run's frame), today and pilot; every goblin on screen is the raider in its build, the archers are today's. |
| `close-head-hands.jpg` | P-e. Distance 5.4, raider alone, standing: head crop (top), hands crop (bottom): today, then the pilot. |
| `s2d-hero-clips.jpg` | P-d. Top: the hero's `Walk` at u = 0, 0.125, 0.25, 0.375, 0.5, 0.75 (goblin side-on). Bottom: `Slash` at u = 0, 0.14, 0.28, 0.4, 0.48, 0.7 (front). |

JPEG quality 80; the folder with tools and rows is 1.8 MB (under 2 MB); the `*-body-*` frames are full size, the sheets are reduced.

## Numbers

Draw calls are per frame to the canvas ("colour") and to render targets ("shadow"), averaged over 1 s, as in M0p; HUD is the `#perf-calls` text. **M0p's camp reference: colour 357, shadow 684, HUD 1,041 calls, 604k triangles.** M0p measured no frame time.

### P-a, the file

COMPARE exits 0: Contract (skin rules included, `{ figures: { Monster_goblin: 'all' } }`) and Budget pass. Drift lists the raider's nodes and the file's totals and no line of another figure.

| | Today | S2d pilot |
|---|---|---|
| Goblin figure triangles / meshes / materials (`figureStats`) | 8,292 / 29 / 10 | 4,360 / 3 / 3 |
| Goblin figure raw bytes | 523,952 | 217,540 |
| Goblin figure Brotli bytes (quality 3) | 92,625 | 113,274 |
| Archer figure Brotli bytes (unchanged figure; Blender 5.0.1 reorder) | 72,904 | 75,388 |
| `monsters.glb` raw bytes | 4,848,004 | 4,558,688 |
| `monsters.glb` Brotli bytes | 1,281,976 | 1,401,411 |
| Materials in the file | 35 | 38 |

The pilot is 20,649 Brotli bytes (22%) larger on the wire than today's goblin and 53% smaller raw.

### P-c, cost

**Controlled** (the five camp goblins held standing in view, then hidden; per goblin = difference over 5):

| | colour with / without | shadow with / without | HUD with / without | per goblin: colour, shadow, HUD |
|---|---|---|---|---|
| today | 343 / 198 | 640 / 495 | 983 / 693 | 29.0, 29.0, 58 |
| pilot | 213 / 198 | 528 / 513 | 741 / 711 | 3.0, 3.0, 6 |

A skinned goblin costs 52 fewer HUD calls a frame, against "at least 20".

**Natural camp** (unmodified game, noon, monsters wandering, three 1 s samples 1.5 s apart; goblins in view by frustum; bound = M0p's HUD 1,041 minus 20 per goblin in view):

| | colour | shadow | HUD calls | goblins in view | bound | margin |
|---|---|---|---|---|---|---|
| today | 359, 355, 380 | 683, 676, 670 | 1,031, 1,035, 1,046 | 3, 4, 5 | n/a | n/a |
| pilot | 258, 252, 247 | 558, 559, 554 | 838, 803, 807 | 4, 3, 5 | 961, 981, 941 | 123, 178, 134 |

HUD triangles at the camp: today 601k to 607k, pilot 568k to 580k.

**Frame time** (the `bench` hook: render only, `gl.finish`, ms per frame). Natural camp, 120 frames, three samples: today 6.72, 6.45, 5.99; pilot 5.27, 4.84, 4.94. Controlled, 200 frames, five goblins in view / hidden: today 4.63 / 2.53; pilot 3.63 / 2.68. The same scene without goblins varied 0.6 ms between builds in S3c, so differences under about 0.6 ms are noise; the pilot is not above today's in any sample. Headless Chromium on the same GPU, not the owner's machine; M0p measured no frame time.

### P-b, correctness numbers

| Check | today | pilot |
|---|---|---|
| Skinned goblins at load (of 5) | 0 | 5 |
| Meshes under a goblin / skinned bodies / outline shells / shells visible at load | 56 / 0 / 26 / 0 | 7 / 3 / 3 / 0 |
| Shells that are `SkinnedMesh` | 0 | 3 |
| Distinct `Skeleton`s per goblin / bone textures per goblin | 0 / 0 | **1 / 1** |
| `renderer.info.memory` before 30 kills: geometries / textures / programs | 2,627 / 27 / 21 | 2,358 / 32 / 24 |
| after 30 kills and respawns | same | same |
| after 30 spawn then `disposeObject3D` cycles | same | same |
| control: 5 spawns not disposed: geometries / textures | +150 / +0 | +20 / +5 |
| control: after disposing them | back | back |

One bone texture per figure (32 textures at load = 27 plus one per each of five goblins). Kills: the loop sets `logic.state = 'dying'` with a 0.1 s timer, waits for `dead`, sets 0.05 s and waits for the real respawn, 30 times, in the running game. A death and respawn only toggle `group.visible`, so equal counts after it prove little by themselves; the test that can fail is the spawn/dispose loop, and its control shows the counts move when a goblin is not disposed and return when it is. The game never disposes a monster; the disposal path is exercised here only. The "before" value differs between builds and runs (something outside the figures creates geometries lazily).

**Posed vertices against each mesh's own `boundingSphere`**: every vertex of every skinned mesh of the raider (bodies and outline shells) posed through `SkinnedMesh.getVertexPosition`, distance to that mesh's sphere centre against its radius, in 17 poses: standing, walking, attack, wind-up, flinch (the game's `poseMonsterLimbs`) and the hero's `Walk` and `Slash` at six frames each. **0 of 124,338 vertex-poses outside their sphere.** Largest distance / radius: standing 0.698, walking 0.699, attack 0.707, wind-up 0.707, flinch 0.693, `Slash` 0.721, `Walk` 0.716 (the spheres are the rest-pose sphere times 1.5, `fixCullSpheres`).

**Culling sweep**: the raider standing, mid-attack and winding up, centre from 200 px inside the right and left edges to 700 px outside, every 25 px (74 placements per pose). In no placement is a bone inside the frustum while a skinned body mesh is culled (`boneVisibleButMeshCulled` empty in all three poses). The shells are not in the sweep. `edge.jpg` shows the figure and its shells drawn inside the edge (centre x = 1219), on it (1279) and half off the left edge (-40).

**Outline.** I looked at `s2d-body-front.jpg`, `s2d-body-side.jpg`, `s2d-body-attack-side.jpg` and `s2d-body-front-dusk.jpg` at full size for gaps in the black line along the silhouette and overlaps (arms, hands, spear, shield, knees, feet, ears, loincloth): the line runs unbroken in all four. By eye, not a pixel measurement; `tests/skinned-outline-normals.test.ts` covers the vertex data.

**Facing.** `closeFrontToCamera` is true for the raider and an archer in every build. A chase check (`tools/job-facing.mjs`: the raider forced to `chase` 3 units ahead of the visible hero) shows the pilot attacking with its face toward the hero and the camera; today's goblin in the same run is seen side-on and I did not read its facing from it. S3c's note that today's raider shows its back in the close crop was my misreading: unflipped, today's archers show their faces and fangs, and flipped by 180 degrees they show their quivers, so today's placement is front-on.

### P-d, shared motion on another stance

Built in scratch, not committed (`tools/clips.py`, run on `scratch/models-build/s3d/monsters.blend`): `build_hero.build_all_animations` with `build_action` replaced by a recorder yields the hero's own `sample_walk` (32 frames) and `sample_slash` (24), converted as design 6.1.5 says and made through `figkit.make_clip` on the goblin's armature: `HeadGroup`, `LeftArmPivot`, `RightArmPivot` get `inverse(torso) * q` per frame (continuous `XZY` Euler); the torso, elbows, knees and legs keep their authored triples; `Torso`'s position keys and the follow-the-torso position keys are dropped; the legs' dip in `Walk` becomes the `Hips` location track scaled by the goblin's hip height over the hero's (0.6936 / 0.9 = 0.7707); `Slash` has none. In the throw-away worktree a twenty-line `AnimationMixer` (the `clips` step of `tools/job.mjs`) loads the exported GLB, keeps only `*.quaternion` tracks and `Hips.position`, strips the `goblin_` prefix and binds by bone name on the raider's group. 20 tracks per clip: `Walk` 1.333 s, `Slash` 1.0 s.

Result (`s2d-hero-clips.jpg`): both clips play on the skinned goblin with nothing changed under `src/`; legs alternate and the hips dip in `Walk`; the right arm winds back and strikes in `Slash`; no frame shows torn or stretched skin and no vertex leaves its sphere in the twelve frames (above). The goblin keeps its own proportions with the hero's timing.

### What the pictures show (my reading; art judgement is the owner's)

- Distance 26 (about 85 px): the pilot's pale grey-olive head, ears and spear read against today's uniform dark-green raider and archers; the spear and round shield show in both standing and attack.
- Close (`s2d-body-front.jpg`, `close-head-hands.jpg`): large head with long ears, yellow eyes with dark pupils, tusks; the chest, belly, upper arms and thighs read as separate planes in the cut shade; bone-and-rust loincloth, bronze-rimmed wooden shield with a boss, hands with thumbs, flat slab feet. The skin is a greyer olive than the lit grass behind it but close to its value in the noon front frame.
- Dusk (`s2d-body-front-dusk.jpg`, `s2d-dusk.jpg`): the lit and shaded halves of the face and body split along the plane edges; the outline holds.
- The ground shadow differs between standing, attack, wind-up and flinch at both yaws (`s2d-shadow.jpg`).

## P-a to P-f

Marked by what I measured. P-c's frame time on the owner's machine and P-f are the owner's reading.

| # | Criterion | Mark | Evidence |
|---|---|---|---|
| P-a | The file: Contract and Budget pass, skin rules included; Brotli bytes measured | met | COMPARE exit 0 against `pending/monsters.json`; figure Brotli 113,274 against today's 92,625; file Brotli 1,401,411 |
| P-b | Correctness in the game | met, with limits | 0 of 124,338 posed-vertex checks outside their own sphere in 17 poses; no cull gap in 3 x 74 placements; drawn inside, on and half off the edge; one skeleton and one bone texture per goblin; geometries, textures and programs equal before and after 30 kills and 30 spawn/dispose cycles, and the control moves; outline unbroken in four full-size frames. Limits: outline and shadow judged by my reading of pictures, no pixel test; the shells are not in the numeric sweep; attack and wind-up are the single mid-point `poseMonsterLimbs` forces, not every phase of the swing |
| P-c | Cost: draw calls at most M0p's minus 20 per skinned goblin in view; frame time not worse | calls met; frame time not worse in this headless run | 52 fewer HUD calls per goblin (controlled); every natural-camp sample at least 123 under the bound; render-only ms below today's in every natural-camp sample (5.27, 4.84, 4.94 against 6.72, 6.45, 5.99) and in the controlled run with goblins (3.63 against 4.63); M0p has no frame time; the owner reads it at OM-P |
| P-d | Shared motion on another stance | met | the hero's converted `Walk` and `Slash` play on the skinned goblin through `AnimationMixer`; position and scale tracks dropped by design; no vertex outside its sphere in the 12 clip frames |
| P-e | Form at close range: head and hands at 5.4 beside today's goblin | evidence delivered; judgement is the owner's | `close-head-hands.jpg`, `distance-8.5.jpg`, `distance-26.jpg`, `s2d-body-front.jpg`; only route (a) remains, route (b) was dropped by the owner |
| P-f | The owner's look | not decided by me | |

## Could not capture, or open

- Frame time on the owner's machine (P-c, P-f): headless Chromium on the same GPU only.
- No pixel-level gap test of the outline.
- Captures are on the open grass beside Three Kettle Camp, not at its centre (props hide the row); `camp.jpg` and the perf runs are at the camp itself.
- The "mid-attack" and "wind-up" pictures are the one mid-point `poseMonsterLimbs` forces under the debug hold; the 17-pose sphere check uses the same poses.
- The `memory` "before" counts move between runs for reasons outside the goblin; the kill and dispose loops compare within a run.
- The body close-ups use a debug look-at offset and a camera distance below the game's minimum; the game's own camera cannot get this close.
- The chase check of facing is one frame per build and shows the pilot facing the hero; today's goblin's facing in that frame is not read.
- "Today" carries the greyer tile too, so it is not the pictures M0p took.
