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
   | `dark_wizard_glow` (orb and glints) | mid-`Cast` | 0.65 | 0.345 |
   | `dark_wizard_staff` | mid-`Cast` | 1.71 | 0.059 |
   | `dark_ranger_wood` (bow) | mid-`Ranged` | 1.40 | 0.105 |

   Every other mesh stays inside its sphere. At the edge of the screen the orb can be culled while the staff swings. The fix is padding or a per-clip sphere in the loader (`blenderMonsters.ts`), which the archer's bow probably needs as well.
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
4. **Value choice against design 5.4.** The plan says the ranger is "clearly lighter" than the wizard. Design 5.4 says the caster is the lightest within a species. Two humans of different factions are not one species, so the plan's rule was followed. The ranger's first colours (cloak 54%, tunic 60%) read almost white in the game at noon and were darkened. Its luminance is still clearly above the wizard's: cloak about 39% against the robe's 23%. The owner's call is at OM-S6.
5. **No stride in `review_render.py`.** Its `--worst` pose is a crouch, an arm overhead, a twist and a head turn, and `--clips` plays only `monsters.glb`'s own clips. The biped clips are in `hero.glb`. The stride and strike sheets therefore come from a scratch copy of the renderer that poses bones by hand (`scratch/m3e/pose_render.py`, not committed, `review_render.py` unchanged):
   - **stride**: thighs +0.5 and −0.45 rad, knees bent, arms swung, the hero `Walk`'s range;
   - **strike**: the wizard's arms raised 1.7 rad, `Cast`-like; the ranger's bow arm forward and the other arm drawn, close to `Ranged` but not exact.

   The real clips are seen in the in-game capture (below).

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

Meshes go from 104 to 71. Triangles total 63,688.

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
| `m3e-roster-silhouette` | the whole file, unfiltered, at the 26-distance size |

On the roster sheet the wizard (brim, crown and staff), the ranger (peaked hood, triangle cloak, bow line) and the two goblins (spear and shield; hood and bow, a head shorter) have four different outlines. The silhouette and play-distance sheets are left out of the tree for the slice's bytes; they are in `scratch/m3e/sheets`.

**Capture**: `m3e-ingame.jpg` (a grid, reduced to 960 px) and `m3e-ingame-rows.json`.

- **Setup**: NVIDIA GPU (`scripts/capture-gpu.mjs`, ANGLE over D3D12, RTX 4070 Laptop), `vite build` and `vite preview` (port 4196, stopped after) of the throw-away worktree, with the `__DEBUG.G` patch. Balanced tier, noon, clear, the hero beside the figure, at the wizards' field (45, −24), the rangers' (76, −52) and Thornwatch (−21, −48). No page or console error.
- **The grid**, row by row:
  1. wizard three-quarter (`Idle`), wizard side, wizard at `Cast` 0.233 s (the staff raised);
  2. wizard at `Cast` 0.550 s, wizard from behind, wizard at 26 (`Walk`);
  3. ranger three-quarter, ranger side, ranger at `Ranged` 0.467 s (drawing);
  4. ranger at `Ranged` 0.817 s, ranger from behind, the Thornwatch Marksman three-quarter (`Walk`).
- **Every wizard and ranger in view**:
  - four skinned meshes, all with vertex colours and `FACET_CUT`, on one skeleton;
  - an animator with the hero library's eleven clips, playing `Idle` and `Walk` as it wanders, and `Cast` or `Ranged` when `attackAnim` is set;
  - `rig.headGroup` is a bone.
- **Not seen in the engine**: `Death`, and a stride seen side-on (the figures were standing for the side frames). The stride sheet stands in for the second.
- **Slice sheet budget**: `s6/` holds 1.36 MB of its 2 MB after M3e (567 kB of it M3e's), with K1, K2 and K4 still to add. `m3b-ingame-strike.jpg` (85 kB) can still go first.
