# Slice 7: M3c, the hill giant and the moss guardian re-rigged on the biped rig

Built with `BLEND(monsters)` on Blender 5.0.1 from `2491214` plus this task's builder (`flock /tmp/claude-blender.lock timeout 600 env BLENDER_PATH=/usr/bin/blender node scripts/run-blender.mjs monsters --out scratch/models-build/m3c`, exit 0, about 9 s). Nothing is promoted: `git status --short public/models blender` prints nothing. M4c promotes.

## Open for the main session

1. **M4c must**:
   - set the live `hill_giant` and `moss_guardian` rows' `clips` and `anticipation` to `PENDING_GIANT_CLIPS` (`Slash`, 0.25) and `PENDING_GUARDIAN_CLIPS` (`Chop`, 0.5), and remove both exports (`src/data/monsterPoses.ts`), the rule of D5, M4a and K4;
   - move `pending/monsters.json` over the live manifest;
   - do the promote follow-through. A full `SUITE` in a throw-away worktree set up as M4c ships it fails **6 tests in 3 files**, all of them follow-through:
     - `model-cache-key`: the monsters `?v=` key, `11081170` for this packed build;
     - `model-vertex-colour`: the painted set gains `hill_giant` and `moss_guardian`;
     - `monster-merge`: four giant and guardian cases. Their `tests/fixtures/monster-families.json` entries become, by the rule of `tests/monster-merge.test.ts`:
       - `hill_giant`: `{"meshes":4,"triangles":{"leather":356,"wood":96,"plain":1032,"skin":4074},"pivots":{"Monster_hill_giant":["leather","plain","skin","wood"]},"floor":4}`
       - `moss_guardian`: `{"meshes":4,"triangles":{"stone":560,"grass":416,"glow":96,"bark":1222},"pivots":{"Monster_moss_guardian":["bark","glow","grass","stone"]},"floor":4}`

   `model-contract` passes there, the totals case included. `monster-models` passes: K3 closed "the two variant rows name their kits".
2. **Culling sphere at the strike** (engine, outside M3c's files; M3e's open item 1, measured here too): mid-`Slash`, the vertices of `hill_giant_club` reach 1.48 outside its 0.725 bounding sphere, because the club swings out with the arm. At the edge of the screen the club can be culled mid-swing. The guardian's four meshes stay inside their spheres mid-`Chop`.
3. **No arm-swing scale.** The plan says the giant's row "may scale the arm swing". No engine code reads such a field, and no engine file is in M3c's list, so none is added. The arms clear the belly through the bind stance instead: upper arm 32 degrees out and forearm 20, each within the 20-degree bound. In the capture, `Slash` and `Walk` keep the arms out of the belly.
4. **Attack clips**:
   - the giant swings its club with `Slash`, as the goblin and the demon do;
   - the guardian brings the boulder fist down with `Chop`, an overhead blow that suits Stage 4's `rootquake` heavy.

   Both are a call for OM-S7. Any other biped clip is a one-word change in `PENDING_*`.
5. **One glow.** "The core kept as the one glow" is read as: the heart core is the only emissive part. The guardian's eyes become dark sockets on the stone, and the mushroom caps become pale stone; both glowed before.
6. **Material names.** The figure key is kept out of the guardian's material names (`mat_bark_guardian_paint`, `mat_stone_guardian_paint`, `mat_moss_guardian_paint`). The engine and `figkit` test `moss` before `stone`, so `mat_stone_moss_guardian_paint` would draw the stone with the grass tile. The giant's skin keeps the substring `skin_hill_giant` (`mat_skin_hill_giant_paint`).

## What was built

**Hill giant** (`build_hill_giant`, `Monster_hill_giant` at the origin, bones `hill_giant_<Bone>`). It is built through `_build_human`, the wizard's and ranger's builder, which is unchanged:

1. rigid parts and cloth first;
2. the body from the rest of a 5,600-triangle budget;
3. automatic weights from the sixteen limb bones, with Root folded into Hips;
4. rigid parts hard on one bone;
5. merge by family, then paint.

Parts and their weights:

- **Body**: today's torso, arms, fists, legs and bare feet fused into one skin (`GIANT_RADII`): a barrel chest (0.50 by 0.32), deltoids 0.20, fists 0.175 behind a 0.088 wrist. The stacked balls are gone.
- **Head**: skull, brow, nose, chin and ears fused (voxel 0.014, 700 triangles, planes), on `HeadGroup`. Two small dark voids under the brow sit on the bone material; no mesh name holds `eye`.
- **Beard**: a faceted mass and three braids with bone beads, on `HeadGroup`.
- **Pelt skirt**: a jagged hem, draped by the wizard's skirt rule (Hips to the thighs, up to 0.55 at the hem).
- **Fur strap**: from the left shoulder round the right hip, draped from all `Torso` over the chest to all `Hips` at the belt. A strap rigid on `Torso` stood off the hips in the worst pose.
- **Skull buckle**: the horned skull with dark sockets, on `Hips`.
- **Armbands**: bone on the right upper arm, fur on the left.
- **Club**: hard on `WeaponPivot`, carried hanging at the right side outside the leg, with two iron straps and six stone spikes.

Paint (as the game shows it):

| Part | Colour | Value |
|---|---|---|
| skin | `0xA8805E` | 66% |
| fists and feet | `0x86644A` | 53% |
| shin wraps | `0x6A4A30` | |
| pelt | `0x6E4E32` | 43% |
| beard | `0x5A3E28` | |
| bone | `0xBCAC8C` | 74% |
| iron | `0x6C6E72` | |
| spikes | `0x8C877C` | |
| club | `0x6E5034` | |

Each colour is divided by the mean of the tile that draws it: giant-fur for the skin, leather for the fur, wood for the club. The bone material is plain.

Meshes:

| Mesh | Material | Family |
|---|---|---|
| `hill_giant_body` | `mat_skin_hill_giant_paint` | skin, giant-fur tile |
| `hill_giant_fur` | `mat_fur_hill_giant_paint` | leather |
| `hill_giant_club` | `mat_wood_hill_giant_paint` | wood |
| `hill_giant_bone` | `mat_bone_hill_giant_paint` | plain |

**Moss guardian** (`build_moss_guardian`, `Monster_moss_guardian`, bones `moss_guardian_<Bone>`). It is built as the scorpion is: every block hard on one bone, with no fused body (design 4.6: stone does not bend).

| Bone | Blocks |
|---|---|
| `Hips` | bark lower trunk |
| `Torso` | bark chest, five stone slabs, the core |
| `HeadGroup` | bark mask, moss crown, dark sockets, antlers and leaf clusters |
| arm bones | stone pauldron with a moss cushion and the bark upper arm; two pale mushrooms on the left pauldron |
| elbows | stone cap and bark forearm |
| left hand | bark fist and three claws |
| right hand | the boulder gauntlet with its moss (the one asymmetry) |
| leg bones | bark thigh |
| knees | stone cap and bark shin |
| feet | stone block and three root claws |

The tubes are thickened to at least 0.044 across (design 5.3): antler tips 0.048, tines 0.046, mushroom stems 0.044. The cones (claws, root claws, and on the giant the buckle horns and club spikes) taper to a point, as the demon's claws do.

Paint:

| Part | Colour | Value |
|---|---|---|
| bark | `0x5E4A36` | 37% |
| lower bark | `0x4E3E2E` | 31% |
| antlers | `0x75603F` | 46% |
| stone | `0x9A978E` | 60%, 23 points over the bark |
| darker stone | `0x86837A` | 53% |
| moss | `0x5F7F38` | 50% |
| caps | `0xB4A688` | |
| sockets | `0x221E1A` | |

Each colour is divided by the mean of its tile: bark, stone, or grass for the moss. Meshes: `moss_guardian_bark`, `moss_guardian_stone`, `moss_guardian_moss`, and `moss_guardian_core` (the file's `mat_glow_emerald`).

**Joints** (three-space, each limb within 20 degrees of the biped reference, which `make_rig` checks):

| | Giant | Guardian |
|---|---|---|
| `Hips`, `Torso` | (0, 0.86, 0.02), (0, 1.14, 0) | (0, 0.84, 0.02), (0, 1.06, 0) |
| `HeadGroup` | (0, 2.02, −0.05); today (0, 2.02, 0) | (0, 1.62, −0.18); today (0.02, 1.62, −0.18) |
| Arm, elbow, hand (right) | (0.58, 1.58, −0.02), (0.845, 1.156, −0.08), (0.995, 0.743, −0.16); today's arm (0.58, 1.58, 0) | (0.60, 1.39, 0), (0.763, 1.025, −0.05), (0.913, 0.654, −0.14); today's arms −0.62 and 0.58 at 1.40 and 1.38 |
| Leg, knee, foot (right) | (0.22, 0.78, 0.02), (0.27, 0.42, −0.04), (0.28, 0.10, 0.02); today (0.22, 0.78, 0) | (0.25, 0.78, 0), (0.30, 0.42, −0.03), (0.30, 0.09, 0.02); today −0.24 and 0.26 at 0.78 |
| Mount | `WeaponPivot` at the right hand | none |

Every pivot of today's is within 0.05 of its bone's joint. The giant's `HeadGroup` sits on that bound: z is −0.05 (COMPARE's Drift prints −0.0500000007). The guardian's joints are made symmetric, and its arm joints moved up to 0.022 to do so (the feat commit says 0.02).

## Measured

Brotli quality 3, with `figureStats` (`scratch/m3a/stats.mjs`). "Packed" is after `packGlb`.

| | Giant, shipped | Giant, M3c | Guardian, shipped | Guardian, M3c |
|---|---|---|---|---|
| Triangles | 7,288 | 5,558 | 6,968 | 2,294 |
| Meshes / materials | 20 / 9 | 4 / 4 | 20 / 6 | 4 / 4 |
| Figure raw, as exported / packed | 356,808 | 341,132 / 199,580 | 333,552 | 250,556 / 141,740 |
| Figure Brotli, as exported / packed | 63,486 | 156,726 / 92,886 | 59,083 | 54,886 / 34,935 |
| W × H × D | 1.754 × 2.360 × 1.739 | 2.491 × 2.360 × 0.931 | 1.750 × 2.489 × 0.870 | 2.240 × 2.500 × 0.879 |

- Heights: the giant's is equal to the shipped one's, and the guardian's is +0.4%.
- Design 9.1's large class is 7,000 triangles, 4 meshes, 5 materials, 160 kB as exported and 110 kB with N-3. Both figures are within it, as exported and packed.
- The guardian is all blocks, so it needs few triangles. Its budget is not filled.

**The file**:

| | Raw bytes | Brotli bytes |
|---|---|---|
| Packed | 2,248,648 | 920,877 |
| Shipped | 2,609,100 | 913,665 |
| As exported | 3,690,812 | 1,511,447 |

The file holds 46 meshes (78 shipped).

**Untouched figures**: against a build of `2491214` (`scratch/models-build/m3c-base`), these all match:

- the hash of every primitive (attributes, indices, material name) of the chicken, raider, archer, scorpion, wizard, ranger, demon, dragon and Ashmantle;
- both kits' primitives (`Kit_saltback_stalker` 986 triangles, `Kit_thornwatch_marksman` 1,004);
- all nine animations, by channel targets, key times and values (`ANIMATIONS IDENTICAL`).

## Pending manifest and COMPARE

`tests/fixtures/model-contract/pending/monsters.json` is the live manifest (K4's) with both entries replaced whole:

- the old pivots leave `nodes`, and both roots stand at the origin;
- 33 bones join `skin.bones` (the giant's 17 with `WeaponPivot`, the guardian's 16), and both roots join `skinnedRoots`;
- each figure gains the biped's eleven reference limbs, prefixed;
- mesh classes `^hill_giant_(body|fur|club|bone)$` and `^moss_guardian_(bark|stone|moss|core)$`;
- the material list loses the shared materials only these two used and gains the seven `_paint` materials;
- `vertexColor.figures` gains both as `all`;
- no clip is added.

Ceilings:

- **Giant**: 7,000 triangles, 4 meshes, 5 materials; raw 199,580; Brotli 94,744.
- **Guardian**: 7,000 triangles, 4 meshes, 5 materials; raw 141,740; Brotli 35,634.
- **File `budget`**, from the packed build by its margins: triangles 59,274, meshes 46, materials 34, raw 2,271,135, Brotli 930,086.
- No other figure's ceiling moved.

**COMPARE of the packed build** (`node scripts/models-compare.mjs scratch/models-build/m3c-packed/monsters.glb public/models/monsters.glb`) **exits 0**: Contract and Budget pass.

**COMPARE of the as-exported build exits 2**, on Budget only (every raw and Brotli ceiling has been a packed number since D5). Contract passes.

## Checks

**On the branch, at the feat commit:**

| Check | Result |
|---|---|
| `SUITE` | 126 files passed; 1,428 tests passed, 42 skipped, 0 failed |
| `TYPES` | exit 0, no output |
| `BUILD` | exit 0 |
| `UNTOUCHED` | prints nothing |

**In a throw-away worktree** (`scratch/m3c/wt.sh`): HEAD, the packed build over `public/models/monsters.glb`, the pending manifest over the live one, and the staged clips on the two live rows.

- `ONE(tests/monster-motion.test.ts)` with `tests/monster-libraries.test.ts`: **42 passed, 48 skipped, 0 failed**.
  - `hill_giant` and `moss_guardian` ran and passed in "a clip row names every bone its clips rotate" and in "every bone a row names exists on that model's skeleton and has weight".
  - Their old-branch cases are skipped, as for every row with clips.
- Full `SUITE` there: 6 failures, all M4c follow-through (open item 1).

## Sheets and capture

**Sheets** come from `SHEETS(scratch/models-build/m3c/monsters.glb, …) --only hill_giant,moss_guardian --worst --against public/models/monsters.glb`. In the against sheets the shipped figure is on the left. The renderer has no albedo tile, so the paint (colour over the tile's mean) shows pinker and greyer than in the game.

| Sheet | What it shows |
|---|---|
| `m3c-giant-turnaround`, `m3c-guardian-turnaround` | three sides |
| `m3c-giant-against`, `m3c-guardian-against` | shipped figure left, new figure right |
| `m3c-giant-worst-pose`, `m3c-guardian-worst-pose` | the renderer's worst pose. The giant's skin bends at shoulder, elbow, hip and knee without tearing, and the strap follows the twist. The guardian's blocks stay on their joints under the stone caps |
| `m3c-giant-silhouette`, `m3c-guardian-silhouette`, `m3c-giant-play-distance`, `m3c-guardian-play-distance` | the black cut-outs, and crops at 5.4, 8.5 and 26. Measured heights: the giant 809, 504 and 162 px; the guardian 968, 592 and 188 px |
| `m3c-roster-silhouette` | the eleven bodies at the 26-distance size (`--only` the eleven, as at K4). Left to right: chicken, raider, archer, scorpion, wizard, ranger, giant (club hanging at the side, wide fists), guardian (antlers, gauntlet block), demon, dragon, Ashmantle. Every outline is different |

**Capture**: `m3c-ingame.jpg` (a labelled grid at 960 px) and `m3c-ingame-rows.json`.

- **Setup**: NVIDIA GPU (`scripts/capture-gpu.mjs`, ANGLE over D3D12, RTX 4070 Laptop), `vite build` and `vite preview` (port 4196, stopped after) of the throw-away worktree, with the `__DEBUG.G` patch. Balanced tier, clear weather, noon unless a cell says dusk.
- **Locations**: the giants' hill (around 78, 18) and the guardians' wood (around −75, −56). No page or console error.
- **Trees hidden in the guardian cells**: the guardians stand in a wood, so world meshes whose bounding sphere crosses the line from the camera to the figure were hidden for each guardian shot (0 to 5 a shot) and shown again after. They are trees and canopies, never the figure.
- **The grid**:
  1. giant walking; `Slash` at 0.183 s; `Slash` at 0.450 s (the club swung out; a second giant stands near the camera);
  2. giant mid-`Walk` from the front (face, braids, buckle); giant `Idle`; three giants at 26;
  3. guardian `Idle`; `Chop` at 0.350 s; `Chop` at 0.767 s;
  4. guardian mid-`Walk`; from behind; after sunset (phase 0.80, labelled "dusk"), where the core is the one light on the figure.
- **Every giant and guardian in view**:
  - four skinned meshes, all with vertex colours and `FACET_CUT`, on one skeleton;
  - an animator with the hero library's eleven clips, playing `Idle` and `Walk` as it wanders and `Slash` or `Chop` when `attackAnim` is set;
  - `rig.headGroup` is a bone;
  - scale 1.55 for the giant and 1.72 for the guardian, Stage 4's.
- **The guardian's value, as the game draws it.** The frame is rendered once, then once per mesh with that mesh hidden, in one task, so no time passes and the figure casts no shadow. The mesh's pixels are those that change, and the table gives their Rec. 709 luma:

  | | Bark | Stone | Moss | Gap, stone over bark |
  |---|---|---|---|---|
  | Noon, mean (median) | 31.8 (30.8) | 59.2 (56.9) | 63.7 | **27.4** (26.1) |
  | After sunset (phase 0.80, between the 0.77 key and night at 0.82), mean | 9.3 | 26.4 | 21.6 | 17.1 |

  The 20-point gap holds at noon. After sunset everything darkens, and the gap is 17.
- **Not seen in the engine**: `Death`, and a held wind-up (Stage 4's `overhead_slam` and `rootquake`). `monster-motion`'s generic cases cover both through the hero library's clips.
- **Slice sheet budget**: `s7/` holds about 830 kB of its 2 MB, with M4c still to add. The scripts are `scratch/m3c/` (`bs.sh`, `sh.sh`, `wt.sh`, `make_pending.py`, `cap/job.mjs`), not committed.
