# Slice 6: M3b, the king scorpion on the crawler rig, with its library

Built with `BLEND(monsters)` on Blender 5.0.1 from `ebc78ac` plus this task's builder (`flock /tmp/claude-blender.lock timeout 600 env BLENDER_PATH=/usr/bin/blender node scripts/run-blender.mjs monsters --out scratch/models-build/m3b`, exit 0, about 9 s). Nothing is promoted: `git status --short public/models blender` prints nothing. K4 promotes.

## Open for the main session

1. **An engine change outside M3b's file list** (its own commit, for the main session to ratify or drop, as the D3 amendment did): `attachMonsterGltfAnimator` in `src/engine/blenderMonsters.ts`. `monsters.glb` now holds two libraries, and the dragon's already uses the bare names `Idle`, `Walk` and `Death`. Before the change, every non-biped figure received every animation in the file, and `stripClipPrefix` stripped one prefix per clip. A second library would therefore have been bound to the dragon, or the scorpion would have played the dragon's clips. Now:
   - a figure takes only the clips whose every track is on its own bones (`<model key>_`);
   - a clip whose name starts with `<model key>_` plays under the rest of its name.

   The animator keeps its hard-coded `Idle`, `Walk` and `Death`. The new test `tests/monster-libraries.test.ts` covers the change:
   - the dragon's animator holds exactly its five clips (runs now);
   - the scorpion's holds `Idle`, `Walk`, `Strike` and `Death` on its own bones, walks, holds `Strike` at the anticipation, strikes and dies lying within `DYING_SECS` (skipped until the file carries the library).
2. **Clip names in the file**: `scorpion_Idle`, `scorpion_Walk`, `scorpion_Death` and `Strike`. Only the names the dragon already holds carry the prefix (the builder reads them from `_dragon_clip_tables`). The manifest keys clips by name, and the frozen case "a row plays from monsters.glb only clips that the monsters.glb in the tree carries" compares the row's names with the file's. That case passes with the row made live: the bare `Strike` is in the file, and `Idle`, `Walk` and `Death` match the dragon's bare names. For the three prefixed names this is a name match, not proof. `tests/monster-libraries.test.ts` is the real check that the scorpion plays its own clips.
3. **K4 must**:
   - set the live `scorpion` row's `clips` and `anticipation` to `PENDING_SCORPION_CLIPS` and remove the export (`src/data/monsterPoses.ts`), the rule D5 and M4a followed;
   - do the promote follow-through: the monsters `?v=` key and `totals.json` by its rule; `tests/model-vertex-colour.test.ts` (the painted-figures set gains `scorpion`); `tests/fixtures/monster-families.json`, whose `scorpion` entry becomes `{"meshes":3,"triangles":{"glow":288,"plain":912,"skin":3376},"pivots":{"Monster_scorpion":["glow","plain","skin"]},"floor":3}` by the rule of `tests/monster-merge.test.ts`.
4. **The Saltback Stalker** uses `model: 'scorpion'`, so it gets this body and library at K4. In the capture it does, with Stage 4's tint and `modelScale` 1.4. K1's kit rides these bones.
5. **No `Hurt` clip** (N-6 left out). The plan's M3b Change line lists one.

## What was built

`build_scorpion`, today's design kept (design 4.6). `Monster_scorpion` stands at the origin on the crawler rig (`rigs.CRAWLER_TABLE`), with bones `scorpion_<Bone>`. `rigs.py` is unchanged.

- **Parts**: today's prosoma, five carapace plates, a six-segment tail arched over the back to the telson and sting, eight legs and two pincered claws. Every part is hard on one bone:
  - prosoma, eyes and mandibles on `HeadGroup`; plates on `Hips`;
  - tail segment 1 on `TailPivot`, segment 2 on `TailPivot2`, and segments 3 to 6 with the telson and sting on `TailPivot3`. The three bones sit on today's first three tail nodes. Each joint ring sits on the bone of the segment that starts there, centred on that bone's head.
  - each leg's coxa (body wall to leg joint) on `LeftLegPivot` or `RightLegPivot`, so the side pivots carry weight; femur, tibia and tarsus on the leg's own bone `LegL1` to `LegL4` or `LegR1` to `LegR4`, front to back;
  - each claw's upper arm on its arm pivot; forearm, chela and both pincers on its elbow.
- **Rig at today's pivots**: `LeftArmPivot` (−0.28, 0.52, −0.82) and `LeftLegPivot` (−0.22, 0.50, 0) are today's exactly, and the right side mirrors them. Two layout changes keep every reference limb within 20 degrees:
  - **The legs fan out from a compact row of joints on the body's side**, at x ±0.62 and z −0.12, 0.02, 0.16, 0.30. Today they were spread from −0.50 to 0.50 under the body. `LegL1`, the reference child of `LeftLegPivot`, must lie out to the side of it (17 degrees). The leg tips still spread from front to back.
  - **The claw's elbow is set forward of today's bend**, at (±0.50, 0.54, −1.16): 15 degrees from the crawler's reference (forward and a little out). Today's bend went out sideways, about 50 degrees off.
- **Legs** are at least 0.048 across (tarsus tip radius 0.024; design 5.3 wants 0.044). Femurs are 0.116 to 0.100 across.
- **Values** (design 5.4), as the game shows them; the paint is the colour over the scorpion-chitin tile's mean:
  - shell ochre `0x84582A` (37%), plate `0x6A4422` (29%) and ring `0x583A1C` (24%);
  - bone `0xC2B293` (70%) on the pincers, mandibles and tarsi;
  - the sting and the four eyes on the file's `mat_glow_crimson`; no mesh name holds `eye`.

  The first build used shell 44%. In the game at the dunes it melted into the sand, so the shell went one step darker.
- **Meshes**: three, all painted (`all`):
  - `scorpion_body` on `mat_skin_scorpion_paint` (skin family, drawn with the chitin tile);
  - `scorpion_bone` on `mat_bone_scorpion_paint` (plain);
  - `scorpion_sting` on `mat_glow_crimson`.

  The material name substring `skin_scorpion` is kept. The old `mat_skin_scorpion_plate`, `mat_horn`-on-scorpion and `mat_glow_yellow` eyes are gone from the figure.
- **Library** (`_scorpion_clip_tables`), keyed by `build_dragon_library`. It is now parameterised with defaults: prefix, tables, label and clip prefix. Rotation only, plus the measured `Hips` height, on the twelve-a-second grid:

  | Clip | Frames | Length | Anticipation | Motion |
  |---|---|---|---|---|
  | `Idle` | 48 loop | 2.000 s | | claws open and close, tail sway, sting bob |
  | `Walk` | 16 loop | 0.667 s | | alternating tetrapod gait: L1, R2, L3, R4 against R1, L2, R3, L4; each leg ±0.22 rad, the swinging set lifted 0.28 |
  | `Strike` | 20 | 0.833 s | frame 8, 0.333333 s | tail rears and the sting draws back, claws rise and spread; then the tail whips over the head and the sting drives down in front |
  | `Death` | 26 | 1.083 s | | the legs lift 0.85 rad, raised out to the sides (seen only in the front-view strip), the body drops 0.225 onto its plates, rolled; claws sag, tail falls back and sideways |

  Rotation ranges (renderer log), in radians:

  | Clip | Ranges |
  |---|---|
  | `Strike` | `TailPivot3` 0.85, `TailPivot2` 0.35, `TailPivot` 0.20; claws 0.29 and 0.27 |
  | `Walk` | every leg 0.44 |
  | `Death` | legs 0.85, `TailPivot` 0.83, claws 0.43 and 0.30 |
  | `Idle` | 0.02 to 0.11 |

  The side pivots are keyed at rest in every clip. Ground lock per frame:
  - one-shots: lowest point within 0.002;
  - loops: −0.004 to +0.007.

## Measured

Brotli quality 3, with `figureStats` (`scratch/m3a/stats.mjs`). "Packed" is after `packGlb`, which the promote step runs before COMPARE.

| | Shipped | M3b, as exported | M3b, packed |
|---|---|---|---|
| Triangles | 10,488 | 4,576 | 4,576 |
| Meshes / materials | 19 / 6 | 3 / 3 | 3 / 3 |
| Figure raw | 512,976 | 155,824 | 97,168 |
| Figure Brotli | 94,666 | 64,484 | 47,126 |
| Bounds w × h × l | 2.303 × 1.984 × 3.206 | 2.423 × 1.987 × 3.191 | same |

- Height is +0.2% (top 1.98 as today).
- Design 9.1's ordinary class is 5,000 triangles, 4 meshes and 80 kB with N-3. The plan says at most 3 meshes.

**The file, packed**: 2,661,992 raw and 793,276 Brotli bytes. Shipped: 3,054,848 and 812,801. As exported: 3,939,800 and 1,231,401.

**Untouched figures**: hashes of every primitive (attributes, indices, material name) match a build of `ebc78ac` (`scratch/m3b/base.glb`) for the chicken, raider, archer, wizard, ranger, giant, guardian, demon, dragon and Ashmantle. The dragon's five animations hash identical too: channel targets, key times and values. Each still has 22 channels, all on `elvarg_dragon_`.

## Pending manifest and COMPARE

`tests/fixtures/model-contract/pending/monsters.json` is the live manifest with the scorpion's entry replaced whole:

- the four old pivots leave `nodes`, and `Monster_scorpion` stands at the origin;
- 20 bones join `skin.bones`, and `Monster_scorpion` joins `skinnedRoots`;
- eight crawler limbs are added: the table's reference directions in glTF axes;
- `attackClips.Strike` is 0.333333;
- the four clips are added with the bones they move;
- mesh classes `^scorpion_body$`, `^scorpion_bone$` and `^scorpion_sting$`;
- `vertexColor.figures.Monster_scorpion` is `all`.

Ceilings move as follows:

- **Scorpion**: 5,000 triangles, 3 meshes, 5 materials; raw 97,168; Brotli 48,069 (packed build plus 2%).
- **Dark ranger's Brotli**: 49,546 → 50,760. Its primitives are identical; the new buffer order moves its Brotli size, the same case as M3a.
- **File `budget`**: from the packed build by its margins: triangles 64,288, meshes 104, materials 37, raw 2,688,612, Brotli 801,209.

**COMPARE of the packed build** (`node scripts/models-compare.mjs scratch/models-build/m3b-packed/monsters.glb public/models/monsters.glb`) **exits 0**: Contract and Budget pass.

**COMPARE of the as-exported build exits 2**, on Budget only (24 ceilings). Contract passes. Every raw and Brotli ceiling has been a packed number since D5 (see `../s5/README.md`).

## Checks in a throw-away worktree

The worktree is HEAD with this task's files, the packed build over `public/models/monsters.glb`, the pending manifest over the live one, and the staged clips on the live scorpion row. That is what K4 ships. The script is `scratch/m3b/wt.sh`, not committed.

- K4's promote path, read-only: `models-promote.mjs` packs the build and runs COMPARE with `--manifest-dir tests/fixtures/model-contract`. The packed build under that command **exits 0**. `scripts/models-clipcheck.mjs` is hero-only.
- `ONE(tests/monster-motion.test.ts)` with `tests/monster-libraries.test.ts`: **54 passed, 36 skipped, 0 failed**. These ran and passed:
  - `scorpion` in "every bone a row names exists on that model's skeleton and has weight" (19 bones);
  - "a row plays from monsters.glb only clips that the monsters.glb in the tree carries";
  - every dragon and Ashmantle case;
  - both library cases.
- Full `SUITE` there: **5 failures in 4 files**, all K4 follow-through or known red:
  - `model-cache-key` (the monsters key);
  - `model-vertex-colour` (the scorpion is now painted);
  - `monster-merge`: two scorpion cases (the families entry above);
  - `monster-models` "the two variant rows name their kits" (K3, known red).

  `model-contract.test.ts` passes.

## Sheets and capture

**Sheets** come from `SHEETS(scratch/models-build/m3b/monsters.glb, …) --only scorpion --worst --clips --against public/models/monsters.glb`.

- `m3b-scorpion-turnaround`, `-silhouette`, `-play-distance` (581, 364 and 120 px) and `-worst-pose`.
- `m3b-scorpion-against`: the shipped figure on the left.
- `m3b-scorpion-Idle-strip`, `-Walk-strip`, `-Strike-strip` and `-Death-strip`. The renderer plays every clip in the file on the figure; the dragon's strips are left out.
- The worst-pose sheet bends the tail and claws hard, and every part stays at its joint. The renderer has no tile, so the chitin reads smoother than in the game.

**Capture**: `m3b-ingame.jpg` (grid), `m3b-ingame-strike.jpg` and `m3b-ingame-rows.json`.

- **Setup**: NVIDIA GPU (`scripts/capture-gpu.mjs`, ANGLE over D3D12, RTX 4070 Laptop), `vite build` and `vite preview` (port 4196, stopped after) of the throw-away worktree, with the `__DEBUG.G` patch of M3a. Balanced tier, noon, clear, the hero beside the figure, at the west dune nest (44, 42). No page or console error.
- **The grid**, row by row:
  - three-quarter (walking), side, `Strike` at 0.383 s (cocked, claws spread);
  - `Strike` at 0.617 s (the sting down in front), at 8.5, at 26;
  - from behind, and the Saltback Stalker three-quarter (Stage 4's tint, scale 1.792).
- **Every scorpion and stalker in view**: three skinned meshes with vertex colours and `FACET_CUT`, one skeleton, an animator with exactly `Idle`, `Walk`, `Strike` and `Death`. It plays `Idle` and `Walk` as it wanders and `Strike` when `attackAnim` is set. `rig.headGroup`, `leftArmPivot` and `leftLegPivot` are bones. The side and back rows record `null`: the job's lookup found no scorpion within 3 of the framing's position at that moment, while the pictures show one.
- **Not seen in the engine**: the held wind-up (the Saltback Stalker's `tail_lash` is Stage 4's heavy, so it holds `Strike` in a fight) and `Death`. `tests/monster-libraries.test.ts` covers both against the built file: the wind-up holds `Strike` at the anticipation and releases it, and `Death` ends lying within `DYING_SECS`. Both are left for OM-S6.
- **Slice sheet budget**: `s6/` holds 780 kB of its 2 MB, with M3e, K1, K2 and K4 still to add. `m3b-ingame-strike.jpg` is a full-size copy of one grid cell and can go first.

# M3e: the dark wizard and the dark ranger, rebuilt on the biped rig

Built with `BLEND(monsters)` on Blender 5.0.1 from `38cee50` (`flock /tmp/claude-blender.lock timeout 600 env BLENDER_PATH=/usr/bin/blender node scripts/run-blender.mjs monsters --out scratch/models-build/m3e`, exit 0). Nothing is promoted: `git status --short public/models blender` prints nothing. K4 promotes.

## Open for the main session

1. **Culling sphere at the strike (engine, not M3e's files).** In the capture, a script read every skinned mesh's vertices at the pose and checked them against its own `boundingSphere`. Three meshes leave their sphere:

   | Mesh | Pose | Sphere radius | Furthest vertex outside |
   |---|---|---|---|
   | `dark_wizard_glow` (orb and glints) | mid-`Cast` | 0.65 | 0.345 (0.338 in the retake) |
   | `dark_wizard_staff` | mid-`Cast` | 1.71 | 0.059 (0.063) |
   | `dark_ranger_wood` (bow) | mid-`Ranged` | 1.40 | 0.105 |

   Every other mesh stays inside its sphere. At the edge of the screen the orb can be culled while the staff swings. The fix is padding or a per-clip sphere in the loader (`blenderMonsters.ts`). Other figures were not measured.
2. **K4 must** do the same as for the scorpion:
   - set the live `dark_wizard` and `dark_ranger` rows' `clips` and `anticipation` to `PENDING_WIZARD_CLIPS` and `PENDING_RANGER_CLIPS`, and remove both exports;
   - do the promote follow-through:
     - the monsters `?v=` key (`6f7b5dd4` for this packed build);
     - `totals.json` by its rule (the four files together are 1,992,995 Brotli bytes against 1,954,706);
     - `tests/model-vertex-colour.test.ts`: the painted set gains `dark_wizard` and `dark_ranger`;
     - `tests/fixtures/monster-families.json`, using the rule of `tests/monster-merge.test.ts`:
       - `dark_wizard`: `{"meshes":4,"triangles":{"wood":252,"cloth":3284,"glow":192,"skin":632},"pivots":{"Monster_dark_wizard":["cloth","glow","skin","wood"]},"floor":4}`
       - `dark_ranger`: `{"meshes":4,"triangles":{"wood":316,"glow":96,"cloth":250,"leather":3698},"pivots":{"Monster_dark_ranger":["cloth","glow","leather","wood"]},"floor":4}`
3. **The Thornwatch Marksman** (`model: 'dark_ranger'`) gets this body at K4, with Stage 4's tint `0x7fb069` and scale 1.1. The capture's last cell shows it: the tint turns the grey-green ranger a saturated green. K2's kit rides `HeadGroup`, `Torso`, `Hips` and `OffhandPivot`, which all exist.
4. **Value choice against design 5.4.** The plan says the ranger is "clearly lighter" than the wizard. Design 5.4 says the caster is the lightest within a species. Two humans of different factions are not one species, so the plan's rule was followed.
   - By HSV value, the cloak equals the robe: both are 42%, and the tunic is 48%.
   - "Clearly lighter" therefore rests on luminance and on the capture: the cloak is about 39% against the robe's 23%, and in the game the indigo robe reads far darker than the grey-green ranger.
   - The ranger's first colours (cloak 54%, tunic 60%) read almost white in the game at noon and were darkened.

   The owner's call is at OM-S6.
5. **No stride in `review_render.py`.** Its `--worst` pose is a crouch, an arm overhead, a twist and a head turn, and `--clips` plays only `monsters.glb`'s own clips. The biped clips are in `hero.glb`. The stride and strike sheets therefore come from a scratch copy of the renderer that poses bones by hand (`scratch/m3e/pose_render.py`, not committed, `review_render.py` unchanged):
   - **stride**: thighs +0.5 and −0.45 rad, knees bent, arms swung, the hero `Walk`'s range;
   - **strike**: the wizard's arms raised 1.7 rad, `Cast`-like; the ranger's bow arm forward and the other arm drawn, close to `Ranged` but not exact.

   The real clips are seen in the in-game capture (below).
6. **`build_materials` was edited, outside "those two" builders.** M3e removed the five entries only the old wizard and ranger used, as M3d did for the demon's, and the export stayed byte-identical. This is for the main session to ratify or revert.
7. **For the owner, not blocking Accept: the bell sleeve's mouth** is a closed gold disc with the hand pushed through it, not an open bell. Worth opening if the figure is rebuilt for another reason, and then before the recapture.

## What was built

`_build_human` is one builder for both figures, in the demon's form:

1. the kit's rigid parts and cloths;
2. the body (`figkit.organic_body` over `_human_body_graph`, the goblin's graph at a human's joints) from the rest of a 4,400-triangle budget, with planes at the goblins' 30-degree spread;
3. `make_rig` on `rigs.BIPED_TABLE`, bones `<key>_<Bone>`;
4. automatic weights from the sixteen limb bones;
5. every rigid part hard on one bone, and each figure's cloth weighted by rule (`_drape_weights`, which refuses weights that do not sum to 1 on at most four bones);
6. a merge by family into four meshes, then the paint (`_figure_paint`).

The builder stops if either figure goes over its budget or ends more than 5% from its shipped height. Neither figure has a species tile, so `skin` draws plain. Each paint is the colour divided by the mean of its family's tile (cloth, leather or wood), so the game shows the colour in the table. `rigs.py`, `main()` and every other builder are unchanged. The five `build_materials` entries that only the old builders used (`robe`, `robe_trim`, `gold`, `cloth_dark`, `dragonhide`) are removed. With them gone the export is byte-identical.

**Dark wizard** (`Monster_dark_wizard`, joints `wizard_joints()`): a tall, stooped caster.

- **Hat and sleeves**, exaggerated (design 5.2):
  - the hat is a 0.96-wide faceted brim and a crown that bends back and droops at its tip, with a gold band, all on `HeadGroup`;
  - the bell sleeves flare from the elbow to 0.38 across past the wrist, with gold cuffs, hard on the elbow bones. The hands come out of their mouths.
- **Head**:
  - a gaunt skull, brow and long nose, fused with planes;
  - a long faceted grey beard onto the chest;
  - two violet glints under the brow, on the glow material. No mesh name holds `eye`.
- **Collar**: a high collar stands open-fronted behind the head, on `Torso`.
- **Sash**: covers the seam between body and skirt, on `Hips`.
- **Robe skirt**:
  - fourteen faceted columns from the waist (1.06) to a hem at 0.20, with every other column standing out 8% (pleats) and a gold hem band. The hem stops above the ankle, so the boots show.
  - Weighted by rule, the same rule for skirt and hem: all `Hips` at the waist, then toward the hem up to `SKIRT_LEG_SHARE` (0.55) on the thighs, rising as t^1.5 and split between `LeftLegPivot` and `RightLegPivot` by the side the vertex is on.
  - The legs are a full body under the skirt, so knees and feet carry weight.
- **Staff**: a gnarled faceted staff hard on `WeaponPivot`. Its foot is on the ground and it is held out at the right side, x 0.57 to 0.63, outside the skirt's hem. At the top, a three-pronged crook holds a glowing orb (`mat_glow_purple`).
- **Colours**, as the game shows them:
  - robe `0x40346A` (42% value);
  - collar, sash and crown `0x2C2550` (31%);
  - gold `0xB08A3A`;
  - face and hands `0xB5A08A`;
  - beard `0x9C978D`;
  - boots `0x4A3A2E`;
  - staff `0x6E5034`.
- **Meshes**:
  - `dark_wizard_robe` on `mat_robe_dark_wizard_paint` (cloth tile; `robe` is kept in the name);
  - `dark_wizard_face` on `mat_skin_dark_wizard_paint` (plain);
  - `dark_wizard_staff` on `mat_wood_dark_wizard_paint`;
  - `dark_wizard_glow` on `mat_glow_purple`.

**Dark ranger** (`Monster_dark_ranger`, joints `ranger_joints()`): a lean hunter with a slight forward lean.

- **Head**: a faceted skull, a mask over the lower face and two emerald glints, all in the shade of a peaked hood. The hood is open in front and its peak sweeps up and back.
- **Cloak**:
  - a faceted shell behind the figure, from the back of the shoulders (0.40 across) to a wide hem at 0.32 (1.06 across), open in front, so it makes a triangle from the front, the side and behind;
  - weighted by rule from all `Torso` at the shoulders to all `Hips` at the hem.
- **Kit**:
  - leather tassets front and back, on `Hips`;
  - one pauldron, on the bow shoulder (design 5.3: asymmetry in one place);
  - a bracer on the bow arm;
  - a quiver at the right hip with four fletchings, on `Hips`;
  - a recurve bow hard on `OffhandPivot`, held upright out at the left side, 1.46 tall. The string runs behind it, and nothing on the bow is under 0.044 across.
- **Colours**:
  - tunic `0x6F7B4D` (48%);
  - trousers `0x555D3D`;
  - leather `0x5C4733`;
  - cloak and hood `0x5F6B47` (42%);
  - face `0x8A7460`;
  - mask `0x4A443C`;
  - bow `0x8A6440`;
  - string `0xB4A482` and fletching `0xB0A07E`, the lightest paints the wood tile's low blue allows.
- **Meshes**:
  - `dark_ranger_body` on `mat_leather_dark_ranger_paint` (leather tile);
  - `dark_ranger_cloak` on `mat_cloth_dark_ranger_paint`;
  - `dark_ranger_wood` on `mat_wood_dark_ranger_paint`;
  - `dark_ranger_glow` on `mat_glow_emerald`.

**Joints** (three-space; each limb within 20 degrees of the biped reference, which `make_rig` checks):

| | Wizard | Ranger |
|---|---|---|
| `Hips` | (0, 1.00, 0.03) | (0, 0.98, 0.03) |
| `Torso` | (0, 1.22, 0.01) | (0, 1.18, 0) |
| `HeadGroup` | (0, 1.76, −0.10) | (0, 1.72, −0.10) |
| Arm, elbow, hand (right side) | (0.26, 1.62, −0.04), (0.42, 1.32, −0.08), (0.60, 1.05, −0.15) | (0.25, 1.56, −0.04), (0.41, 1.28, −0.09), (0.57, 1.02, −0.16) |
| Leg, knee, foot (right side) | (0.12, 0.96, 0.03), (0.17, 0.52, −0.01), (0.18, 0.10, 0.03) | (0.12, 0.95, 0.03), (0.17, 0.52, −0.03), (0.18, 0.10, 0.03) |
| Mount | `WeaponPivot` at the right hand | `OffhandPivot` at the left hand |

## Measured

Brotli quality 3, with `figureStats` (`scratch/m3a/stats.mjs`). "Packed" is after `packGlb`.

| | Wizard, shipped | Wizard, M3e | Ranger, shipped | Ranger, M3e |
|---|---|---|---|---|
| Triangles | 3,980 | 4,360 | 5,340 | 4,360 |
| Meshes / materials | 18 / 9 | 4 / 4 | 23 / 8 | 4 / 4 |
| Figure raw, as exported / packed | 187,824 | 261,716 / 153,500 | 253,488 | 248,716 / 146,500 |
| Figure Brotli, as exported / packed | 34,202 | 121,443 / 70,282 | 48,574 | 119,283 / 71,184 |
| Height | 2.556 | 2.524 (−1.3%) | 2.220 | 2.188 (−1.4%) |

- Design 9.1's ordinary class with N-3 is 80 kB; both are under it packed.
- As exported, both are over the 115 kB row, as the archer was at M3a.
- The shipped figures were boxes and cones, cheap on the wire; the new ones are skinned and painted.

**The file**:

| | Raw bytes | Brotli bytes |
|---|---|---|
| Packed | 2,514,872 | 870,444 |
| Shipped | 3,054,848 | 812,801 |
| As exported | 3,870,544 | 1,392,458 |

The file holds 71 meshes, against 120 shipped and 104 in M3b's build. Triangles total 63,688.

**Untouched figures**: compared against a build of HEAD before this task (`scratch/models-build/m3e-base`, whose as-exported size equals M3b's), these all match:

- the hashes of every primitive (attributes, indices, material name) for the chicken, raider, archer, scorpion, giant, guardian, demon, dragon and Ashmantle;
- all nine animations, by channel targets, key times and values (`scratch/m3e/anim-hash.txt`).

## Pending manifest and COMPARE

`tests/fixtures/model-contract/pending/monsters.json` is M3b's pending manifest (from HEAD) with the wizard's and the ranger's entries replaced whole:

- the old pivots leave `nodes`, and both roots stand at the origin;
- 34 bones join `skin.bones`, and both roots join `skinnedRoots`;
- each figure gains the biped's eleven reference limbs, prefixed, as the raider's;
- mesh classes `^dark_wizard_(robe|face|staff|glow)$` and `^dark_ranger_(body|cloak|wood|glow)$`;
- `vertexColor.figures` gains both as `all`;
- no clip is added (the biped clips are in `hero.glb`).

Ceilings:

- **Wizard**: 5,000 triangles, 4 meshes, 5 materials; raw 153,500; Brotli 71,688.
- **Ranger**: 5,000 triangles, 4 meshes, 5 materials; raw 146,500; Brotli 72,608.
- **File `budget`**, from the packed build by its margins: triangles 63,688, meshes 71, materials 38, raw 2,540,021, Brotli 879,149.
- No other figure's ceiling moved.

**COMPARE of the packed build** (`node scripts/models-compare.mjs scratch/models-build/m3e-packed/monsters.glb public/models/monsters.glb`) **exits 0**: Contract and Budget pass.

**COMPARE of the as-exported build exits 2**, on Budget only (24 ceilings, every one a packed number). Contract passes.

## Checks

**On the branch:**

| Check | Result |
|---|---|
| `SUITE` | 1 failed, 1,434 passed, 33 skipped. The one failure is `monster-models` "the two variant rows name their kits" (K3, known red) |
| `TYPES` | exit 0, no output |
| `BUILD` | exit 0 |
| `UNTOUCHED` | prints nothing |

**In a throw-away worktree** (`scratch/m3e/wt.sh`). This is what K4 ships: HEAD, the packed build over `public/models/monsters.glb`, the pending manifest over the live one, and the staged scorpion, wizard and ranger clips on their live rows.

- `ONE(tests/monster-motion.test.ts)` with `tests/monster-libraries.test.ts`: **48 passed, 42 skipped, 0 failed**.
  - `dark_wizard` and `dark_ranger` ran and passed in "a clip row names every bone its clips rotate" and in "every bone a row names exists on that model's skeleton and has weight". Knees and feet carry weight on both, the wizard's under the skirt.
  - Both rows leave the old-branch case. Their `codeAttack` numbers are unchanged.
- Full `SUITE` there: **10 failures in 5 files**, all K4 follow-through or known red:
  - `model-cache-key` (monsters key);
  - `model-contract` "the four files together stay within the total ceilings" (`totals.json`);
  - `model-vertex-colour` (both figures are now painted);
  - `monster-merge`: the scorpion, wizard and ranger family cases, six in all (entries above and in M3b's part);
  - `monster-models` "the two variant rows name their kits" (K3).

## Sheets and capture

**Sheets** come from `SHEETS(scratch/models-build/m3e/monsters.glb, …) --only dark_wizard,dark_ranger --worst --against public/models/monsters.glb`. In the against sheets the shipped figure is on the left.

| Sheet | What it shows |
|---|---|
| `m3e-wizard-turnaround`, `m3e-ranger-turnaround` | each figure from three sides |
| `m3e-wizard-against`, `m3e-ranger-against` | the shipped figure on the left, the new one on the right |
| `m3e-wizard-worst-pose`, `m3e-ranger-worst-pose` | the renderer's worst pose. The hat, collar, beard, cloak and hood follow their bones, and no gap opens |
| `m3e-wizard-stride`, `m3e-ranger-stride` | the skirt swings with the forward thigh; its hem lifts at the front and the back leg's boot shows behind it. The cloak hangs behind both legs |
| `m3e-wizard-strike`, `m3e-ranger-strike` | the wizard's arms raised with the staff, and the ranger's bow drawn, under the hand-set poses |
| `m3e-roster-silhouette` | the whole file, unfiltered, at the 26-distance size, from a second run with no `--only`: `SHEETS(scratch/models-build/m3e/monsters.glb, …)`. Left to right: chicken, goblin, goblin archer, scorpion, dark wizard, dark ranger, hill giant, moss guardian, lesser demon, the dragon, Ashmantle |

On the roster sheet the wizard (brim, crown and staff), the ranger (peaked hood, triangle cloak, bow line) and the two goblins (spear and shield; hood and bow, a head shorter) have four different outlines. The silhouette and play-distance sheets are left out of the tree for the slice's bytes; they are in `scratch/m3e/sheets`.

**Capture**: `m3e-ingame.jpg` (a grid, reduced to 960 px; the wizard at 26 and a second walk frame are in `scratch/m3e/cap/`) and `m3e-ingame-rows.json`.

- **Setup**: NVIDIA GPU (`scripts/capture-gpu.mjs`, ANGLE over D3D12, RTX 4070 Laptop), `vite build` and `vite preview` (port 4196, stopped after) of the throw-away worktree, with the `__DEBUG.G` patch. Balanced tier, noon, clear, the hero beside the figure, at the wizards' field (45, −24), the rangers' (76, −52) and Thornwatch (−21, −48). No page or console error.
- **The grid**, row by row. Each cell is labelled by what it shows; the figures face where they like.
  1. Wizard front three-quarter (`Idle`); wizard from the front, its staff out at its side; wizard at the frame's left edge with another wizard behind.
  2. Wizard at `Cast` 0.233 s, the staff swung up level in front; at `Cast` 0.583 s; wizard mid-`Walk` (weight 1.0), the skirt over the stride. The last three are a retake (`scratch/m3e/cap/job2.mjs`), each framed just before the shot.
  3. Ranger from behind: the cloak's triangle; ranger from the front with the bow at its side; ranger at `Ranged` 0.467 s, drawing.
  4. Ranger at `Ranged` 0.817 s; ranger mid-`Walk` (weight 1.0), the cloak over the real stride; the Thornwatch Marksman mid-`Walk`, tinted green.
- **Every wizard and ranger in view**:
  - four skinned meshes, all with vertex colours and `FACET_CUT`, on one skeleton;
  - an animator with the hero library's eleven clips, playing `Idle` and `Walk` as it wanders, and `Cast` or `Ranged` when `attackAnim` is set;
  - `rig.headGroup` is a bone.
- **Not seen in the engine**: `Death`, and a stride seen square from the side.
- **Slice sheet budget**: `s6/` holds 1.38 MB of its 2 MB after M3e (about 590 kB of it M3e's), with K1, K2 and K4 still to add. `m3b-ingame-strike.jpg` (85 kB) can still go first.

# K1: the Saltback Stalker kit on the scorpion

Built with `BLEND(monsters)` on Blender 5.0.1 from `da74139` plus this task's builder (`flock /tmp/claude-blender.lock timeout 600 env BLENDER_PATH=/usr/bin/blender node scripts/run-blender.mjs monsters --out scratch/models-build/k1`, exit 0, about 10 s). Nothing is promoted: `git status --short public/models blender` prints nothing. K4 promotes. The row's `kit` field is K3's.

## Open for the main session

1. **An unfiltered SHEETS run of `monsters.glb` now stops.** `review_render.py`'s `find_roots` takes every parentless object with meshes, so `Kit_saltback_stalker` is a root, and `get_scale` raises `KeyError: no in-game scale for figure 'Kit_saltback_stalker'` (run with `--only Kit_saltback_stalker`, exit 1). Every `--only <figure>` run is unaffected. K4's roster sheet is unfiltered, so before it `review_render.py` should skip `Kit_` roots (or mount them, as `scratch/k1/kit_render.py` does), or `review_scales.json` gains an entry. Neither file is in K1's list.
2. **For K2: the bare names `Hips`, `TailPivot3`, `LeftElbowPivot` and `RightElbowPivot` are taken.** Kit children are named after their bone without the model prefix (the engine matches them after `stripBonePrefix`, and D4 reads them so), and Blender object names are unique in the file. A second kit child named `Hips` would export as `Hips.001` and attach to no bone. The marksman's kit rides `HeadGroup`, `Torso` and `OffhandPivot` without trouble, but a piece on `Hips` (the quiver) collides. Either it goes on `Torso`, or the kit-child naming needs a rule (for example a `<kit>__` prefix that the engine strips), which is a B1 and D4 change.
3. **K4 adds nothing for the kit** beyond promoting the file and the pending manifest. There is no clip, no material, no `monster-families.json` entry and no cache-key change of its own. Checked with a full `SUITE` in a throw-away worktree (`scratch/k1/wt2.sh`), set up as K4 ships it:
   - the packed build over `public/models/monsters.glb`;
   - the pending manifest over the live one;
   - the staged scorpion, wizard and ranger clips on their live rows;
   - the stalker row given `kit: 'saltback_stalker'`.

   Result: **10 failures in 5 files**, exactly M3e's list: `model-cache-key` (monsters key), `model-contract` totals, `model-vertex-colour` (the scorpion is painted), six `monster-merge` cases (scorpion, wizard, ranger) and `monster-models` "the two variant rows name their kits" (the marksman, K2). None is the kit's. In that run the scratch placement test passed, including the check that `PropertyBinding.findNode` finds the bone, not the kit mesh of the same name, for all four names. Clips therefore still bind to the bones.
4. **The sting reads as three points, not two.** Design 5.6 says "a forked double sting". A kit cannot hide the scorpion's own sting, so the two prongs flank it and the tip is a three-point fork (see `k1-stalker-against.jpg`). To make it read as two, one prong would sit coaxial with the base sting, a little fatter so it covers it, and one would splay out: lopsided, and one more build, manifest and sheet cycle. Left as it is, for the owner at OM-S6.
5. **Value: met for the figure (25 points), not met piece against shell (3 points).** The kit's salt shows at 35% under Stage 4's tint and the scorpion's shell at 38%. Under the tint the lightest any kit paint can show is the tint itself, `0x6b6470`, at 41% luma. So 15 points lighter than the scorpion's 38% shell cannot be reached without touching the tint, which is Stage 4's and was not changed. What does separate them is the figure: the stalker's shell at 13% against the scorpion's 38%, with the pale crust 22 points above the stalker's own shell.

## What was built

`build_saltback_stalker_kit`, called in `main()` after `build_scorpion`. `Monster_scorpion` and every other builder are unchanged.

- **`Kit_saltback_stalker`** stands at the origin with an identity transform. It has four children, one per bone, each one rigid mesh named after the scorpion bone it rides on, at an identity transform, with its vertices relative to that bone's joint. `upgradeMonsterRigWithGltf` adds each child under the bone of the same name and keeps the child's transform. Every rest rotation is identity, so the piece lands at joint + vertex. The children:

  | Child (bone) | Mesh | What it is | Material |
  |---|---|---|---|
  | `Hips` | `saltback_stalker_Hips` | salt crystals on the five carapace plates: a tall one on the spine of each plate, leaning back (0.18 to 0.32 tall), and one each side leaning out (0.10 to 0.18) | `mat_bone_scorpion_paint` |
  | `TailPivot3` | `saltback_stalker_TailPivot3` | the fork: two prongs from the telson's sides (base 0.11 across, 0.36 long), splayed 0.5 rad out each side of the scorpion's own sting | `mat_glow_crimson` |
  | `LeftElbowPivot`, `RightElbowPivot` | `saltback_stalker_<Bone>` | the heavier claw: a faceted sleeve over the forearm, a faceted shell over the chela (0.40 by 0.31 by 0.54, larger than the chela it covers) and three crystals on top | `mat_bone_scorpion_paint` |

- **Additive only.** The base figure cannot be hidden by a kit, so each piece goes over the scorpion: the crystals over the plates, the prongs beside the sting, the shells over the claws.
- **Faceted.** Every piece is flat-shaded (`smooth=False`), five-sided crystals and seven-sided shells: chosen planes, in the pilot's manner.
- **Paint.** A corner colour on the scorpion's own white materials, so the kit adds no material: the file stays at 38. Every kit primitive carries `COLOR_0` (the manifest lists `Kit_saltback_stalker` as its own `all` unit). UV layers are dropped. Colours, before Stage 4's tint: salt `0xE4DED0` (crystals) and crust `0xC9C1B0` (flank crystals, sleeves, shells); the prongs `0xFFFFFF` on the glow.
- **Triangles**: 986 of the 1,200 allowed (the builder stops over 1,200). Four meshes, two materials.
- **Names**: no node or mesh name in the file carries a `.001` suffix and no node name is duplicated; the builder stops if a child does not get its bone's name.

## Values

Stage 4's tint `0x6b6470` multiplies every non-glow mesh of the stalker, the kit included (linear multiply, as the engine does). Rec. 601 luma, which is close to the measure of M3b's table (that table gives the shell `0x84582A` 37%):

| | Before the tint | With the tint |
|---|---|---|
| Kit salt `0xE4DED0` | 87% | 35% (`#5f565a`) |
| Kit crust `0xC9C1B0` | 76% | 30% (`#534a4b`) |
| Scorpion shell `0x84582A` | 38% | 13% (`#341d0c`) |
| Scorpion bone `0xC2B293` | 70% | 28% (`#50433d`) |

- The stalker's kit against its own shell: 35% against 13%, 22 points.
- The stalker's shell against the scorpion's: 13% against 38%, 25 points (the tint's work, Stage 4's).
- The kit salt against the scorpion's shell is only 3 points apart (35% against 38%). Against the scorpion the stalker differs by its darker body with pale crust, not by the crust alone. The owner reads it at OM-S6.

## Measured

| | As exported | Packed |
|---|---|---|
| Kit triangles / meshes / materials | 986 / 4 / 2 | same |
| Kit raw bytes | 62,940 | 41,556 |
| Kit Brotli bytes | 14,273 | 12,151 |
| File raw / Brotli | 3,936,988 / 1,419,636 | 2,560,072 / 882,029 |
| File meshes / materials / triangles | 75 / 38 / 64,674 | same |

Design 9.1's row gives the two kits 40 kB together.

**Untouched figures**: against a build of HEAD before this task (`scratch/models-build/k1-base`):
- the primitive hashes of all eleven `Monster_` figures, the scorpion included, are identical;
- all nine animations are identical by channel targets, key times and values (`scratch/k1/anim-hash.txt`).

## Pending manifest and COMPARE

`tests/fixtures/model-contract/pending/monsters.json` is M3e's with:
- `nodes`: `Kit_saltback_stalker` (no parent) and its four children (parent `Kit_saltback_stalker`), all at translation 0 and scale 1;
- `meshClasses`: `^saltback_stalker_(Hips|TailPivot3|LeftElbowPivot|RightElbowPivot)$`;
- `vertexColor.figures.Kit_saltback_stalker`: `all`;
- `figures.Kit_saltback_stalker`: 1,200 triangles, 4 meshes, 2 materials, raw 41,556, Brotli 12,395 (packed plus 2%);
- file `budget` from the packed build by its margins: triangles 64,674, meshes 75, materials 38, raw 2,585,673, Brotli 890,849.

No other figure's ceiling moved. The material set and the clips are unchanged. The kit is not a skinned root.

**COMPARE of the packed build** (`node scripts/models-compare.mjs scratch/models-build/k1-packed/monsters.glb public/models/monsters.glb`) **exits 0**: Contract and Budget pass. **COMPARE of the as-exported build exits 2**, on Budget only (26 ceilings, all packed numbers). Contract passes.

## Checks

**On the branch:**

| Check | Result |
|---|---|
| `SUITE` | 1 failed, 1,434 passed, 33 skipped. The one failure is `monster-models` "the two variant rows name their kits" (K3, known red) |
| `TYPES` | exit 0, no output |
| `BUILD` | exit 0 |
| `UNTOUCHED` | prints nothing |

**In a throw-away worktree** (`scratch/k1/wt.sh`): HEAD with this task's files, the packed build over `public/models/monsters.glb`, the stalker row given `kit: 'saltback_stalker'` (K3's change, there only), and a scratch test (`scratch/k1/kit-engine.test.ts`, not committed). That test loads the file through `GLTFLoader` and `upgradeMonsterRigWithGltf` and checks:
- each of the four pieces is a mesh under the bone of its name;
- its world bounds equal its own bounds moved by that bone's joint, within 1e-4;
- its material has `vertexColors`, and the non-glow pieces carry the tint `6b6470`;
- turning `TailPivot3` moves its piece.

| Run | Result |
|---|---|
| `tests/k1-kit-engine.test.ts`, the placement case | passed |
| `tests/k1-kit-engine.test.ts`, "without the kit field" | failed, as it must there: the row carries the kit in that worktree. It passed in the run without the row change |
| `tests/monster-kits.test.ts` | 6 passed |
| `tests/monster-models.test.ts`, "saltback_stalker: its kit is a Kit_ node whose children name bones of its model" | passed |
| `tests/monster-models.test.ts`, "the two variant rows name their kits" | failed: the marksman's kit is K2's |

World bounds of the pieces at rest (figure space): back crystals y 0.62 to 1.01; the fork y 1.62 to 1.90 and z −0.34 to −0.07, at the sting; the claws from x ±0.27 to ±0.67 and z −1.77 to −1.14.

## Sheets

These come from `scratch/k1/kit_render.py` (not committed). It is `review_render.py`'s renderer with each kit child moved to its bone's rest joint, the way the engine mounts it. `review_render.py` cannot mount a kit.

| Sheet | What it shows |
|---|---|
| `k1-stalker-silhouette.jpg` | black cut-outs at the roster's camera (distance 26, 1080 frame), in pairs, scorpion then stalker: front, three-quarter, side. The scorpion is at its review scale 1.28 and the stalker at 1.792 (1.28 × Stage 4's `modelScale` 1.4). Heights in px: front 120 and 166, three-quarter 129 and 182, side 132 and 187 |
| `k1-stalker-against.jpg` | lit, three-quarter (top row) and side (bottom row): the scorpion, the stalker untinted, the stalker with Stage 4's tint. The renderer has no albedo tile |

**Reading the cut-outs:**
- Front: the crystal crown along the back and the crusted claws widen the top and the claw ends.
- Three-quarter and side: the back is a jagged ridge where the scorpion's is smooth, the claws end in spiked clubs, and the sting has two extra prongs.

`s6/` holds 1.50 MB of its 2 MB after K1 (118 kB of it K1's).

# K2: the Thornwatch Marksman kit on the dark ranger

Built with `BLEND(monsters)` on Blender 5.0.1 from `dda126c` plus this task's builder (`flock /tmp/claude-blender.lock timeout 600 env BLENDER_PATH=/usr/bin/blender node scripts/run-blender.mjs monsters --out scratch/models-build/k2`, exit 0). Nothing is promoted: `git status --short public/models blender` prints nothing. K4 promotes. The row's `kit` field is K3's.

## Open for the main session

1. **Two quivers.** The bare name `Hips` is K1's (item 2 of K1's list), and a kit cannot hide the ranger's own hip quiver. So the bramble quiver rides `Torso` and sits on the back, from the left hip to over the right shoulder, and the marksman shows both quivers. From the front the hip quiver is mostly behind the cloak's edge (`k2-marksman-against.jpg`, top row). This is for the owner at OM-S6, as K1's three-point sting was.
2. **K1's kit code is shared, not copied.** The join, name, joint-offset, paint and budget loop of `build_saltback_stalker_kit` is now `_kit_root(key, parts, j, budget)`, called by both kits. `Kit_saltback_stalker`'s primitive hashes are identical to K1's build (below).
3. **Not checked in a clip.** K2's Accept has no CAPTURE, and none was taken. Two things are worth a look in the K4 capture, while the `Ranged` clip plays:
   - the right hand drawing back near the quiver's mouth over the right shoulder;
   - the longbow's low tip, which is 0.10 above the ground at rest (0.11 at `modelScale` 1.1).
4. **An unfiltered SHEETS run of `monsters.glb` still stops on `Kit_` roots** (K1's item 1). There are now two such roots.
5. **K4 adds nothing for this kit** beyond the file and the pending manifest: no clip, no material, no `monster-families.json` entry and no cache key of its own. Checked with a full `SUITE` in a throw-away worktree (`scratch/k2/wt2.sh`), set up as K4 ships it:
   - the packed build over `public/models/monsters.glb`;
   - the pending manifest moved over the live one;
   - the staged scorpion, wizard and ranger clips on their live rows;
   - both variant rows given their `kit`.

   Result: **9 failures in 4 files**, all K4's promote follow-through from M3e's list: `model-cache-key` (monsters key), `model-contract` totals, `model-vertex-colour`, and six `monster-merge` cases (scorpion, wizard, ranger). Every `monster-models` case passes, "the two variant rows name their kits" included, and so does the scratch placement test.

## What was built

`build_thornwatch_marksman_kit`, called in `main()` after `build_dark_ranger`. `Monster_dark_ranger` and every other builder are unchanged.

`Kit_thornwatch_marksman` stands at the origin with an identity transform. It has three children, one per bone. Each child is one rigid mesh named after the ranger bone it rides on, at an identity transform, with its vertices relative to that bone's joint (`ranger_joints()`; every biped rest rotation is identity).

| Child (bone) | Mesh | What it is |
|---|---|---|
| `HeadGroup` | `thornwatch_marksman_HeadGroup` | the wreath: a bramble ring round the hood, 0.05 higher at the brow than behind, and eleven thorns standing up and out of it, 0.20 and 0.13 long in turn. The head's outline becomes a crown of spikes, 0.65 across against the hood's 0.37 |
| `Torso` | `thornwatch_marksman_Torso` | the quiver: a seven-sided tube 1.17 long, from the left hip to over the right shoulder, standing clear of the cloak. A bramble vine is wound twice round it, five thorns stand on the vine, and five fletchings come out of the mouth, which ends 0.2 above the hood's crown |
| `OffhandPivot` | `thornwatch_marksman_OffhandPivot` | the longbow. It follows the ranger's recurve (`rng_bow`'s points) 0.014 fatter, so the recurve is inside it, and its limbs carry on past each recurve tip, 0.40 higher and 0.26 lower, to a nock on the recurve string's own line. The string runs along that line at radius 0.025 against the recurve string's 0.022, so the old string is inside the new one. 2.09 tall against 1.46 |

- **Additive only.** Every piece goes over the ranger.
- **Faceted.** Every piece is flat-shaded and carries plane tones (`_goblin_tint` with planes), as the ranger's own parts do. The thorns and fletchings are four-sided three-ring spikes, a third of the cost of `add_cone_spike`'s.
- **Paint.** A corner colour on the ranger's own `mat_wood_dark_ranger_paint`, each colour over the wood tile's mean, as `_human_paint` does. The kit adds no material, and the file stays at 38. Every kit primitive carries `COLOR_0` (the manifest lists `Kit_thornwatch_marksman` as its own `all` unit). UV layers are dropped.
- **Triangles**: 1,004 of the 1,200 allowed (the builder stops over 1,200). Three meshes, one material.
- **Names**: no node or mesh name in the file carries a `.001` suffix, and no node name is duplicated.

## Values

Stage 4's tint `0x7fb069` multiplies every non-glow mesh of the marksman, the kit included (linear multiply). Rec. 601 luma, the measure K1 used:

| | Before the tint | With the tint |
|---|---|---|
| Kit bramble `0x9A8A68` (wreath ring, quiver, vine) | 54% | 32% |
| Kit thorns `0xB4A482` (thorns, string) | 65% | 38% |
| Kit longbow `0x6E4C30` | 33% | 18% |
| Ranger cloak `0x5F6B47` | 39% | 23% |
| Ranger tunic `0x6F7B4D` | 45% | 26% |
| Ranger bow `0x8A6440` | 42% | 24% |

- The thorns stand 15 points over the marksman's own cloak, and the bramble 9 points over it. The longbow sits at design 5.4's 18% floor.
- The marksman's cloak against the ranger's is 23% against 39%, 16 points. That is the tint's work, Stage 4's.

## Measured

| | As exported | Packed |
|---|---|---|
| Kit triangles / meshes / materials | 1,004 / 3 / 1 | same |
| Kit raw bytes | 70,440 | 46,284 |
| Kit Brotli bytes | 21,201 | 16,573 |
| File raw / Brotli | 4,010,076 / 1,440,165 | 2,609,100 / 913,665 |
| File meshes / materials / triangles | 78 / 38 / 65,678 | same |

Design 9.1's kit row is 20 kB on the wire; the packed kit is 16.6 kB. The two kits together are 28.7 kB of the 40 kB.

**Untouched figures**: against K1's build (`scratch/models-build/k1`):
- the primitive hashes of all eleven `Monster_` figures and of `Kit_saltback_stalker` are identical (`scratch/k2/stats.mjs`, `scratch/m3a/stats.mjs` extended to `Kit_` roots);
- all nine animations are identical by channel targets, key times and values (`scratch/k2/anim-hash.txt`).

## Pending manifest and COMPARE

`tests/fixtures/model-contract/pending/monsters.json` is K1's with:
- `nodes`: `Kit_thornwatch_marksman` (no parent) and its three children (parent `Kit_thornwatch_marksman`), all at translation 0 and scale 1;
- `meshClasses`: `^thornwatch_marksman_(HeadGroup|Torso|OffhandPivot)$`;
- `vertexColor.figures.Kit_thornwatch_marksman`: `all`;
- `figures.Kit_thornwatch_marksman`: 1,200 triangles, 3 meshes, 1 material, raw 46,284, Brotli 16,905 (packed plus 2%);
- file `budget` from the packed build by its margins: triangles 65,678, meshes 78, materials 38, raw 2,635,191, Brotli 922,802.

No other figure's ceiling moved. The material set and the clips are unchanged.

**COMPARE of the packed build** (`node scripts/models-compare.mjs scratch/models-build/k2-packed/monsters.glb public/models/monsters.glb`) **exits 0**: Contract and Budget pass. **COMPARE of the as-exported build exits 2**, on Budget only (28 ceilings, all packed numbers). Contract passes. The packed build's `?v=` key would be `daf83d2d`.

## Checks

**On the branch:**

| Check | Result |
|---|---|
| `SUITE` | 1 failed, 1,434 passed, 33 skipped. The one failure is `monster-models` "the two variant rows name their kits" (K3, known red) |
| `TYPES` | exit 0, no output |
| `BUILD` | exit 0 |
| `UNTOUCHED` | prints nothing |

**In a throw-away worktree** (`scratch/k2/wt.sh`): HEAD with this task's files, the packed build over `public/models/monsters.glb`, and a scratch test (`scratch/k2/kit-engine.test.ts`, not committed). That test loads the file through `GLTFLoader` and `upgradeMonsterRigWithGltf` with `kit: 'thornwatch_marksman'`, and checks:
- each of the three pieces is a mesh under the bone of its name;
- `getObjectByName` and `PropertyBinding.findNode` find the bone, not the kit mesh of the same name, for all three names, so clips still bind to the bones;
- no rig pivot the loader resolves (`headGroup` and the rest) is a kit mesh;
- each piece's world bounds equal its own bounds moved by that bone's joint, within 1e-4;
- its material has `vertexColors` and carries the tint `7fb069`;
- turning `OffhandPivot` moves the bow;
- without the kit field, no piece is added.

| Run | Result |
|---|---|
| `tests/k2-kit-engine.test.ts` | 2 passed |
| `tests/monster-kits.test.ts` | 6 passed |

World bounds of the pieces at rest (figure space):
- wreath: x ±0.33, y 1.87 to 2.12;
- quiver: x −0.22 to 0.41, y 0.92 to 2.29, z 0.16 to 0.68, behind the cloak;
- longbow: y 0.10 to 2.20.

## Sheets

These come from `scratch/k2/kit_render.py` (not committed). It is K1's `kit_render.py` with each kit child moved to its bone's rest joint, the way the engine mounts it.

| Sheet | What it shows |
|---|---|
| `k2-marksman-silhouette.jpg` | black cut-outs at the roster's camera (distance 26, 1080 frame), in pairs, ranger then marksman: front, three-quarter, side and back. The ranger is at its review scale 1.05 and the marksman at 1.155 (1.05 × Stage 4's `modelScale` 1.1). Heights in px: front 103 and 120, three-quarter 104 and 118, side 102 and 118, back 97 and 111 |
| `k2-marksman-against.jpg` | lit, three-quarter (top row), side (middle row) and from behind (bottom row): the ranger, the marksman untinted, the marksman with Stage 4's tint. The renderer has no albedo tile, so the untinted kit reads lighter than the wood tile shows it in the game |

**Reading the cut-outs:**
- In every view the head is a crown of spikes where the ranger's is a single peaked hood.
- A tall quiver with fletchings stands over the right shoulder, above the head.
- The bow runs from the knee to above the head where the ranger's spans the thigh to the shoulder.

`s6/` holds 1.67 MB of its 2 MB after K2 (108 kB of it K2's).
