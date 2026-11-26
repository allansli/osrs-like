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
