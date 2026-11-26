# Slice 2: the hero

## H3b: two Accept items that are open (2026-11-25)

Plan task H3b lists `ONE(tests/gear-mount.test.ts)` green against the built file and CAPTURE(hero) in its Accept. Neither has been met on `feat/models-pass-hero`. Both need H5b, and H5b is not on this branch or any other: no branch's `src/engine/blenderHero.ts` calls `cloneFigure` or `hasSkin`.

**`gear-mount` against the built file: 7 of 7 fail.** The run used `scratch/models-build/hero.glb` (296,028 bytes, H3b's build at `41a22c2`). The test was copied unchanged to scratch, with only the `hero.glb` path pointed at the build, and run with `scripts/capped.sh npx vitest run`. Every case throws:

```
TypeError: Cannot read properties of null (reading 'center')
 ❯ src/engine/materials.ts:199:66   (skinnedMesh.boundingSphere is null)
 ❯ addCartoonOutline src/engine/materials.ts:187:10
 ❯ upgradeHumanoidRigWithGltf src/engine/blenderHero.ts:322:3
```

Today's hero loader takes the rigid path for every file. On a skinned file it gives a `SkinnedMesh` that has no bounding sphere to `addCartoonOutline`, so the test stops before it measures any mount. This is the loader H5b writes (`cloneFigure` when the file has a skin, and the mount offsets moved by the joint move, design 6.1.3 and 6.1.4). The H3b build is not the cause. Against the shipped `public/models/hero.glb`, the same test passes 7 of 7.

Supporting evidence, which does not replace the mount test: the pending manifest `tests/fixtures/model-contract/pending/hero.json` pins the Hands, Boots and Head centres (by `extras.part`) at the shipped values. H3b's commit `6cd0164` reports two things about the built file: the Head's bounds centre moves 0.0018 with the face planes, and the builder stops above 0.005. It also reports that the hands were scaled about their own centres.

**CAPTURE(hero): not taken.** An in-engine capture of the built hero goes through the same `upgradeHumanoidRigWithGltf`, so it fails in the same place until H5b lands. The only sheets in this directory are Blender sheets (`h3b-*.jpg`).

**For the main session:** either amend H3b's Accept so that both items run after H5b (with H5b and H5 applied, in a throw-away worktree of the built file), or run them there once H5b exists. This note records the gap; it does not decide it.

## H3b repair: the hands' paint (2026-11-25)

The source's hand faces point into the hand: 180 of 180 faces of the shipped `Hand_L`/`Hand_R`, and 354 of 360 `Hands` faces of the H3b build, cast a ray along their normal that hits the back of the hand's own far wall within 0.1. `bake_paint`'s Cycles AO therefore read every hand vertex as fully occluded, and all 1,080 hand corners exported between 0.57 and 0.62: one dark value with no form. `grow_hands` in `scripts/blender/build_hero.py` now turns the hand faces outward (`bmesh.ops.recalc_face_normals`) before `paint()`.

On the rebuilt file, no `Hands` face's normal ray hits the back of a wall; 66 of 360 hit the front of another surface within 0.1 (the fingers and the gaps between them). The hand corners now run from 0.60 to 0.94 (mean of the three channels; median 0.84, tenth percentile 0.70), so the occlusion sits in the creases only. COMPARE: Contract and Budget pass; file 296,028 bytes, as before. The sheets `h3b-hero-{turnaround,play-distance,against,paint-turnaround,paint-play-distance}.jpg` are re-rendered from this build; the silhouette and worst-pose sheets came out byte-identical. The plate-set sheets are not re-rendered: the gloves cover the hands there.

The two open Accept items above (`gear-mount` against the built file, CAPTURE(hero)) are unchanged by this repair: both still wait on H5b's skinned loader or a main-session amendment that moves them after H5b.

## H3c: the hero keeps its character (2026-11-25)

From the main session's read of the H3b sheets (plan, "Lanes 1", H3c): the hair had become a smooth cap, the eyes blank white and the face a pale mannequin. `scripts/blender/build_hero.py` only; nothing is promoted (`git status --short public/models blender` prints nothing). The pending manifest `tests/fixtures/model-contract/pending/hero.json` is **not edited**: no node, mesh, material, bone, clip or `extras` key changed, and the build is under every H3b ceiling.

### The build

`flock /tmp/claude-blender.lock timeout 600 env BLENDER_PATH=/usr/bin/blender node scripts/run-blender.mjs hero --out scratch/models-build` exits 0. `node scripts/models-compare.mjs scratch/models-build/hero.glb public/models/hero.glb` exits 0: Contract and Budget pass against the pending manifest. `node scripts/models-clipcheck.mjs` on the built and shipped files passes (the clips are untouched).

| | H3b (664d38a) | H3c | Ceiling (H3b's, unchanged) |
|---|---|---|---|
| Triangles | 5,324 | 5,216 | 6,000 |
| Meshes / materials | 11 / 11 | 11 / 11 | 11 / 11 |
| Exported vertices | 3,623 | 3,569 | |
| File raw bytes | 296,028 | 292,568 | 298,989 |
| File Brotli bytes | 155,150 | 151,418 | 156,663 |
| Figure raw / Brotli bytes | 221,364 / 128,192 | 217,908 / 124,808 | 223,578 / 130,677 |
| `Hair` vertices / triangles | 713 / 560 | 513 / 388 | |
| `Head` | 760 / 922 | 874 / 958 | |
| `Eyes` | 50 / 64 | 82 / 92 | |

The Head's bounds centre moved 0.0018 from the source's (face edits and ears together; the builder stops above 0.005).

### What changed

| # | Plan item | What was built | Where |
|---|---|---|---|
| 1 | Hair: a carved mass of a few large swept spikes in today's silhouette | No voxel remesh and no decimate (they made the cap). A flat-faced cap (an 80-face icosphere scaled over the skull, sunk into the head below the hairline) and **14 spikes**, each a closed flat-faced blade of diamond section on a curve, placed by hand in the `SPIKES` table: a fringe of three with the long one between the eyes, two wings a side over and behind the ear (the right pair wider, as today), two across the crown ending in a cowlick, two down the back of the skull, three down the nape. 49 planes on 262 faces, tones 0.781 to 1.148 before the divide by the lightest | `_spike`, `SPIKES`, `build_hair` |
| 2 | Today's silhouette | The builder reads the shipped hair's bounds from the source mesh and stops if the new hair leaves them by more than 0.004. Built: x -0.152 to 0.162 (shipped -0.158 to 0.170), front to back -0.080 to 0.166 (-0.086 to 0.164), height 1.556 to 1.843 (1.543 to 1.850) | `build_hair`, `HAIR_BOUNDS_SLACK` |
| 3 | No strand thinner than 0.044 | `_spike` stops if a spike is under 0.044 wide before its last third. Widths are 0.070 to 0.090 at the root and 0.045 to 0.058 at two thirds; the last third tapers to a point | `STRAND_MIN` |
| 4 | The scalp does not show | The builder casts a ray out from every Head vertex 0.03 or more above the hairline and stops if one misses the hair. The hairline is over the brow at the front (1.748), above the ear at the side (1.728) and at the nape behind it (1.60) | `build_hair` |
| 5 | Irises in today's blue with a dark pupil, on the rigid `Eyes` mesh | Two flat fans a side on the source's eye surface: an iris of 8 sides, 0.036 by 0.044 and 0.002 proud, and a pupil of 6 sides, 0.014 by 0.020 and 0.004 proud. A fan point past the eye's edge is moved onto it, so the lids cut the iris. One mesh, one material (`Mat_Eyes`), 92 triangles. The colours are the `Eyes`' `COLOR_0` whole, read back from the built file: white 0.815, 0.847, 0.888 (`0xE9EDF2`), iris 0.016, 0.202, 0.658 (`0x227CD4`, the shipped `Mat_Eyes` colour), pupil 0.004, 0.008, 0.014 (`0x0E1620`), linear | `build_eyes`, `paint` |
| 6 | The brow clear of the eyes | H3b's brow shelf (centre 1.731, reach 0.020) pushed the head's surface forward over the eyes' upper edge at 1.717, and the eyes showed as slits. The shelf is now centred at 1.737 with reach 0.018 | `carve_face` |
| 7 | The face's skin warmer | The paint of `Head` and `Hands` (both are the engine's one skin colour) is a value v shaded as (v^0.70, v, v^1.25) times (1.0, 0.90, 0.80): a plane turned from the light goes to a warm brown and not to grey. Built means, read back from the file: Head 0.792, 0.640, 0.516; Hands 0.853, 0.740, 0.651 | `SKIN_WARM`, `SKIN_SHADE`, `paint` |
| 8 | Plane tones on cheek, brow, nose and jaw | A cheekbone under each eye (0.006 out) and a hollow below it (0.005 in), by moving Head vertices; the Head's planes hold faces within 26 degrees (40 on the hair, the pilot's value): 31 planes on 500 faces, largest 8.1% of the area, tones 0.754 to 1.141 | `carve_face`, `HEAD_SPREAD` |
| 9 | Ears that read at 8.5 | A flat-faced wedge a side on the `Head` mesh, 0.044 front to back and 0.058 tall, standing 0.015 outside the head's half-width at the back with a sunk bowl; 12 faces each, on the author's `head` group. Both rims are at one distance from the Head's bounds centre, so that centre does not move in x | `build_ears`, `EAR_REACH`, `EAR_SIZE` |

### Open for the main session

1. **The game shows the iris only after an engine change.** `src/engine/blenderHero.ts` gives part `eye` a white `MeshBasicMaterial` with no `vertexColors`, so the built hero's eyes are plain white in the game until the eye material is given `vertexColors: true` (H5b's loader is the place; one argument). With it, the material's white times `COLOR_0` is the colours of row 5.
2. **Today's hero has white eyes in the game too.** The shipped `Eyes` mesh is part `eye` and takes the same white material; the blue in `h3b-hero-against.jpg` is the shipped file's own `Mat_Eyes`, which the engine replaces. The `--against` side of a sheet is drawn with the file's materials, not the engine palette (`review_render.py` is not in this task's files).
3. **The iris is 0.036 by 0.044 and the pupil 0.014 by 0.020**, in an eye 0.050 by 0.047: the pupil is under design 5.3's 0.044. It is paint inside a form, not a part of the silhouette.
4. **The ears stand 0.015 off the head** (`EAR_REACH`; the first build used 0.024 and 0.046 by 0.066). In the plate sheets no ear shows outside the helm. Every ear face looks away from the ear's own middle (the builder turns them and prints the count), and on the exported file no `Eyes` face looks back.
5. **The skin's warmth is in the paint, under the engine's `0xF5D8C2`.** The paint can only darken: green is multiplied by 0.90 and blue by 0.80, before the shade's exponents. No sheet shows the engine's skin tile; `SKIN_WARM` is the one number to change after CAPTURE(hero).
6. **A spike is 0.044 or more across, but 0.022 to 0.036 thick.** Row 3 checks the width only; edge-on a blade is under design 5.3's 0.044. The blades lie against the cap, so only the free tips are seen edge-on.
7. **The hair is rigid on the head bone and reaches 1.556** (the shipped hair 1.543). `h3c-hero-worst-pose.jpg` is too small to show whether a nape spike meets the collar with the head turned; the reach is inside the shipped hair's, which is rigid on the head too.
8. `tests/hero-model.test.ts`, copied to scratch with only the file path pointed at the build: 16 of 25 pass, the same cases as at H3b (all of "hero skin" and "hero meshes"; the 9 that fail are the clip cases H4 and H5 own).
9. `gear-mount` against the built file and CAPTURE(hero) are still H5b's (plan, "Lanes 1").

### Sheets

All from the H3c build (sha256 `e252f59f...68ea1ef`). **A sheet shows the paint only where it says so**: the plain `--engine-palette` sheets do not draw `COLOR_0`, so their eyes are white and their skin is unpainted.

| Sheet | Made by | Shows |
|---|---|---|
| `h3c-hero-turnaround.jpg`, `-silhouette`, `-play-distance`, `-worst-pose`, `-against` | SHEETS with `--only hero --engine-palette --worst --against public/models/hero.glb` | Form only. `-against`: left is the shipped hero |
| `h3c-hero-paint-turnaround.jpg`, `-paint-play-distance`, `-paint-against` | the same renderer with the palette times `COLOR_0` (scratch wrapper, as at H3b) | The paint: irises, warm skin, plane tones. `-paint-against`: left is the shipped hero |
| `h3c-hero-head-close.jpg` | scratch close views, palette times `COLOR_0`: front, three-quarter, side, back, from above, and the head at the play distance (51 px, enlarged) | Top row the shipped hero, middle row H3c, bottom row H3c with `Hair` hidden (face planes, ears) |
| `h3c-hero-plate-rest.jpg`, `-plate-worst` | the same renderer with today's plate set mounted, `Hair`, `TorsoCoat` and `InnerCollar` hidden as the engine does | No ear, hand or limb outside the armour |

Heights measured by the renderer: turnaround 414 px in a 512 tile; play distance 396, 249 and 82 px. The `h3b-*` sheets are kept as H3b's record.

## H4: the biped library (2026-11-25)

`scripts/blender/build_hero.py` and the pending manifest `tests/fixtures/model-contract/pending/hero.json` only; nothing is promoted (`git status --short public/models blender` prints nothing). N-6 is "no", so there is no `Hurt`: eleven clips, eleven strips.

### The build

`flock /tmp/claude-blender.lock timeout 600 env BLENDER_PATH=/usr/bin/blender node scripts/run-blender.mjs hero --out scratch/models-build` exits 0 (sha256 `3d8f9933...4d429d`). COMPARE exits 0: Contract and Budget pass against the pending manifest.

| | H3c | H4 | Pending ceiling |
|---|---|---|---|
| File raw bytes | 292,568 | 331,656 | 334,973 (was 298,989) |
| File Brotli bytes | 151,418 | 164,895 | 166,544 (was 156,663) |
| Figure raw / Brotli (geometry, unchanged) | 217,908 / 124,808 | 217,908 / 124,808 | 223,578 / 130,677 |

**The file ceilings were raised**, to the build plus 1% (the manifest's own margin): the clips add 39,088 raw and 13,477 Brotli bytes (a `Hips` position track and two `Foot` tracks on every clip, and `Death`). The geometry is unchanged. H7's wire limit is 200,000 (150,000 with N-3, which packs geometry, not clips); 164,895 is today's unpacked size.

### What changed

| Item | What was built |
|---|---|
| Pose tables | `pose_table`: each clip is a few named poses on even frames (12 a second at 24), each with the ease of the move into it (`io`, `in` for a strike or a fall, `out` for an impact or a landing, `lin`, or `cr`, a Catmull-Rom curve through the neighbours, for the loops). Euler numbers are interpolated per frame, then turned into quaternions, so `SpinSlash`'s two turns survive. `build_action` keeps H3a's chain conversion and frame count, so every clip keeps its length |
| Feet on the ground | `build_action` measures the posed body per frame and sets the `Hips` height so its lowest point is at the ground (every vertex follows `Hips`; none is on `Root`), and keys each `Foot` level with the ground. Walk's heights are smoothed round the cycle and may let a foot 1 cm into the ground. Logged per clip: every clip's lowest point is 0.000 except Walk (-0.010 to +0.015). The authored dips of today's clips are gone; the bend of the knees sets the height |
| Torso pitch sign | The shipped clips lean the torso **back** where their author meant forward: +x on an upright bone tips it toward +z, and the hero faces -z (eyes at z -0.13 to -0.09). Measured on `public/models/hero.glb`, the torso top moves back 0.24 in `Lunge` while it moves forward, back 0.24 at `Chop`'s strike and 0.14 at `Slash`'s. H4 writes a forward lean as negative x: `Slash`, `Chop`, `Mine` and `SpinSlash` have their torso pitch and the head's counter-pitch turned round; `Walk` leans 0.03 forward (today 0.06 back); `Fish` leans to the water and looks down. **This changes the kept attack clips on purpose**; the arm numbers and beat timing are today's |
| Idle | Two breaths a loop, the weight from one leg to the other (a knee gives 0.09), a look to the right of 0.11. Head range 0.15 rad (today 0.03) |
| Walk | Keys every 4 frames: passing, reach, contact, taking the weight. The swing knee folds 0.85 at the passing and the leg lands straight; the torso turns the trailing shoulder forward by 0.07 (range 0.14, today 0.04); the head turns back by half of it and stays level; elbows swing with the arms. Today's phase and stride (0.48 to 0.55) |
| Slash | Today's arm numbers at the beats; the elbow cocks to 1.00 in the wind-up and opens to 0.20 on the strike (range 0.80, today 0.05); a 2-frame overshoot is the impact |
| Lunge | Re-made: draw back (arm -0.35, elbow 1.10, torso coiled back), then a thrust of hips pitch -0.10 and torso pitch -0.27 into a bent front knee, arm 1.36 and elbow straight. Torso range 0.58 (today 0.24) |
| Ranged | Today's draw; the string hand snaps back on the release at frame 20 and the bow arm kicks |
| Cast | The torso leads: it gathers back 0.10 at frame 6, reaches forward -0.20 at frame 10, before the arms arrive at 1.50 at frame 14; two pulses. Torso range 0.35 (today 0.12) |
| Chop, Mine | Today's arm swing; elbows fold on the raise (1.10) and open on the strike (0.25); knees give on the impact |
| Fish | The rod hand twitches up, drops, waits, tugs: arm range 0.38 (today 0.10); elbows and knees move |
| SpinSlash | A coil (torso yaw -0.45, frame 4), then the two turns at one speed (`in`, `lin`, `out` matched), a settle. The head trails by 0.32 at most and ends square to the chest; today it ended 1.9 rad behind it (0.85 of the torso's yaw) |
| Death | 27 frames, 1.083 s (1.1 is between frames 26 and 27). Recoil (head and chest snap back), the knees buckle (1.1), the body tips back on `Hips` (1.57 at frame 22), a small bounce, lying on its back with one knee up, arms out, head turned; the last pose (frame 26) is the lying one. The feet are kept level with the hips, so the lying toes point up |
| Elbows and knees | Every clip now moves both |

### Beats of each attack strip (frames at 24 a second)

| Clip | Anticipation (manifest `skin.attackClips`) | Strike | Follow-through / settle |
|---|---|---|---|
| Slash | 6 (0.25 s) | 6 to 10, impact 12 | 16, settle 24 |
| Lunge | 8 (0.333 s) | 8 to 12, extend 14 | recover 24 |
| Ranged | 14 (0.583 s, full draw) | release 18 to 20 | recover 30 |
| Cast | 6 (0.25 s, gather) | lead 10, cast 14 | pulses 18 and 22, recover 28 |
| Chop | 12 (0.5 s) | 12 to 16, impact 18 | recover 26 |
| Mine | 10 (0.417 s) | 10 to 14, impact 16 | recover 24 |
| SpinSlash | 4 (0.167 s, coil) | 8 to 18 (the turns) | 22, settle 24 |

The six-frame front strips (`h4-hero-<clip>-strip.jpg`, SHEETS `--only hero --engine-palette --clips`) are evenly spaced and can miss a two-frame strike, so each clip also has a side strip at its keys with the frame drawn in (`h4-hero-<clip>-side.jpg`, scratch wrapper over `review_render.py`). The glTF importer starts every NLA strip at frame 1; the side strips add the strip's start, `review_render.py`'s `--clips` strips do not (it reads `action.frame_range`), so its tiles are one frame early. That renderer is not in this task's files.

### Checks

- `tests/hero-model.test.ts`, copied to `scratch/h4/t/` with only the file path pointed at the build: **23 of 25 pass**, every motion, skin and mesh case. The two frozen samples fail in the hero loader (`addCartoonOutline`: `skinnedMesh.boundingSphere` is null, `materials.ts:199`), as at H3b and H3c: the loader is H5b's.
- The two samples measured on the built clips with three's `AnimationMixer` on the file's own scene (supporting evidence, not the test): 0.2 s into `Walk`, `LeftLegPivot` x is 0.350 (> 0.01); 0.15 s into `Slash` at time scale 1.2, `RightArmPivot` x is -0.435 (> 0.05 in size).
- Clip lengths from three: Cast 1.1250, Chop 1.0417, Death 1.0833, Fish 1.4583, Idle 1.9583, Lunge 0.9583, Mine 0.9583, Ranged 1.2083, Slash 0.9583, SpinSlash 0.9583, Walk 1.2917. These are the shipped lengths, plus Death.
- `node scripts/models-clipcheck.mjs` exits 1 on every clip. This is expected: H3a's check asserts the clips are unchanged, and H4 changes them. Its report is in `scratch/h4/clipcheck.txt`.

### Open for the main session

1. **The frozen samples have no home in the manifest.** A manifest clip entry takes only `moves` (`models-compare.mjs` refuses other keys), and `models-compare.mjs` is not in H4's files. They stay in `hero-model.test.ts` and `blender-hero.test.ts`.
2. **CAPTURE(hero), walking, striking and falling: not taken.** It goes through `upgradeHumanoidRigWithGltf`, which fails on the skinned file until H5b (plan, "Lanes 1"). The same applies to `Death`'s clamp and to `HeroClipName` gaining `Death`.
3. **`manifest.clips` lists each clip's moving nodes as built**, now with `Hips`, `LeftFoot` and `RightFoot` in every clip and `Death` added. `skin.sharedClips` includes `Death`.
4. **The torso sign change** (above) is a judgement on the kept attack clips. Reverting it is one sign per clip in `build_all_animations`.
5. `s2/` holds 2.6 MB of sheets after H4. H7's "sheets at most 2 MB" will need a cut.

## H7: the hero promoted (2026-11-26)

`hero.glb` and `blender/hero.blend` are the H3c build with H4's clips, packed by the promote step (Q1, 8-bit normals, weights and colour). Promote key `?v=c56c4135` (SHA-256 `c56c41358592f25e029679181fb0b475fe24667a525c3b11223a4d40e8503588`).

| | Shipped before | Promoted |
|---|---|---|
| `hero.glb` raw bytes | 216,844 | 246,604 |
| `hero.glb` Brotli bytes (the wire size; ceiling 200,000, 150,000 with N-3) | 137,913 | 120,678 |
| Triangles | 5,304 | 5,216 |
| Meshes, materials | 18, 18 | 11, 11 |
| Figure `HeroRoot` Brotli / raw bytes | | 81,167 / 132,252 |
| Clips | 10 | 11 (`Death`) |

Ceilings of the live manifest are the packed values plus 2%: file raw 251,537 and Brotli 123,092, triangles 5,321; `HeroRoot` raw 134,898, Brotli 82,791, triangles 5,321. `totals.json` is the five shipped files plus 1% (raw 11,735,057, Brotli 3,892,947), as at the monsters promotion. `tests/model-contract.test.ts`'s hero case now reads the pivots from `skin.bones`, the centres `Boots`, `Hands`, `Head` and eleven clips; `tests/model-vertex-colour.test.ts`'s first case expects the painted hero's materials to have `vertexColors` true; `tests/model-cache-key.test.ts` drops the hero from `LEGACY`.

Sheets (SHEETS `--only hero --engine-palette --against` the old file): `h7-hero-against.jpg` (left old, right new), turnaround, silhouette, play distance, worst pose. In-engine captures on the GPU (`h7-capture.json`: NVIDIA RTX 4070, 17 skinned meshes, 16 bones, no page error): `h7-game-idle-close`, `idle-play`, `walk`, `slash-bare` (0.33 s into `Slash`), `plate-idle` and `plate-slash` (rune plate set, helm, shield, bronze scimitar, 109 meshes), `death-900ms` and `death-1700ms` (lying on the last pose), `merchant` (Shopkeeper Bob beside the hero). The game camera is behind the hero in the walk, strike and plate frames, so the face is read in the sheets, not in these.
