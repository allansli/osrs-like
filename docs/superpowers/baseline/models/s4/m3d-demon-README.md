# M3d: the lesser demon, rebuilt on the biped rig

Built with `BLEND(monsters)` on Blender 5.0.1 (`build_lesser_demon` in `scripts/blender/build_monsters.py`). It follows the pilot's pattern (`../README.md`): joints first, rigid parts, then the body from `figkit.organic_body`, the rig, the weights, a merge by family and the paint. `Monster_lesser_demon` stands at the file's origin. It is skinned on the biped table with bones `lesser_demon_<Bone>`: the sixteen core bones plus `Jaw`, `WeaponPivot`, `LWing`, `RWing`, `TailPivot` and `TailPivot2`. The seven old pivot names (`HeadGroup`, `LeftArmPivot`, `RightArmPivot`, `LeftLegPivot`, `RightLegPivot`, `LWing`, `RWing`) are now bones. The builder no longer reads `RedDevil-Ex.blend`. That file and its licence note stay under `blender/examples/`, untouched. The fallback of design 4.6 (keep the CC0 body) was not used.

## What it is

- **Stance.** A brute with a forward hunch: the spine leans 8 degrees and the neck 19 degrees, and the hump of the back stands off as its own form. The arms are long, held out and forward, with the fists at mid thigh. The knees are bent, and each foot is a flat hoof slab. Every limb is within 20 degrees of the biped reference: arms 15.6 and 14.9 degrees, legs 17.4 and 18.1, tail 1.4.
- **Horns** (the feature that names it, design 5.2): two six-sided faceted tubes swept out, up and forward from the crown. Their tips are over the shoulders, and they set the figure's height.
- **Wings, centred on the back.** Each roots at x ±0.16 on the middle of the back and has an arm strut, three finger struts, a wrist claw and the dragon's closed membrane between them. Each wing is rigid on its own bone, so it beats as one plate.
- **Tail.** It is part of the body skin and runs back and down along `TailPivot` and `TailPivot2`. It ends in a flat spade on `TailPivot2`.
- **Cleaver.** It is held low and forward in the right fist, outside the body outline: a grip through the fist, a heavy blade, and a glowing edge along the blade's bottom. All of it is hard-weighted to `WeaponPivot`.
- **Head.** A faceted skull, a brow ridge, a short muzzle and swept ears, fused, with hard edges round their planes. The jaw is faceted, on `Jaw`, with two fangs. The eyes are ember slits on the glow, and the mouth glows.
- **Other parts.** Three claws on each fist, on the hand bone, and a short leather loincloth front and back, on `Hips`.
- **Meshes.** Four skinned meshes, one per engine family:
  - `lesser_demon_body`: skin family, the `demon-hide` tile. Body, head, jaw and wing struts.
  - `lesser_demon_membrane`: leather family. Membranes and loincloth.
  - `lesser_demon_horn`: plain family. Horns, claws, fangs, spade and cleaver.
  - `lesser_demon_embers`: `mat_glow_orange`. Eyes, mouth and cleaver edge.
- **Materials.** Three white materials of its own: `mat_skin_lesser_demon_paint`, `mat_wing_lesser_demon_paint` and `mat_horn_lesser_demon_paint`. No mesh name holds `eye`.

## Values (slate and ember)

All of these are paint, as the game shows them. The skin colours are divided by the `demon-hide` tile's linear mean (0.6744, 0.4847, 0.4360) and the membrane and grip by the `leather` tile's (0.9047, 0.5833, 0.3223). The demon has no Stage 4 `tint`.

| Part | Colour | Value |
|---|---|---|
| Hide | 0x58616C slate | 42% |
| Hands, feet, wing struts | 0x3A4049 | 29% |
| Membrane | 0x7E3826 ember red | 49% |
| Horns, claws, fangs, spade | 0xB3A58B | 70% |
| Cleaver blade | 0x4C5057 | 34% |
| Grip, loincloth | 0x5A3E2C | 35% |
| Eyes, mouth, edge | `mat_glow_orange` | |

Plane tones are the goblin's (-0.25, +0.15). The body has 76 planes on 3,041 faces, and the largest holds 22.6% of the area.

## Measured

| | Rebuilt demon | Shipped demon |
|---|---|---|
| Triangles | 5,460 (builder budget 5,500; manifest 7,000) | 10,218 |
| Meshes / materials | 4 / 4 | 9 / 7 |
| Height of the bounds | 2.360 (+0.4%; the builder stops at 5%) | 2.350 |
| Width (wings) / depth (cleaver to tail) | 2.944 / 2.627 | 2.807 / 2.337 |
| Figure raw bytes | 359,064 | 501,836 |
| Figure Brotli bytes, as exported | **155,276** (design 9.1, large: 160 kB) | 161,310 |
| Figure Brotli bytes, packed by `packGlb` (Q1) | **90,620** (design 9.1 with N-3: 110 kB) | 138,602 |
| `monsters.glb` raw / Brotli | 4,813,856 / 1,237,865 | 4,558,688 / 1,401,411 |

The builder's budget was first 5,800 triangles, which gave 162,252 Brotli bytes, over the 160 kB row. It was lowered to 5,500.

Against the D3 build, 262 of 273 primitive and animation-channel hashes are identical, counting attributes, indices and material per primitive, and input, output and target per channel. The 11 that differ are all demon meshes. The dragon, Ashmantle, the goblin, every other figure and all dragon clip channels are byte-identical.

## The pending manifest

The demon's entry is replaced whole:

- the seven old pivot nodes leave `nodes`;
- `Monster_lesser_demon` is at the origin;
- its 22 bones are added to `skin.bones`, and `Monster_lesser_demon` to `skinnedRoots`;
- twelve limbs are added (the goblin's eleven, prefixed, plus `TailPivot` to `TailPivot2` on the table's reference direction);
- `vertexColor` is `all` for the figure;
- four mesh classes are added.

The material set follows the built file. The old demon's `mat_skin_lesser_demon` and `mat_wing` leave it, and the three paint materials join it. That makes 44, so `budget.materials` goes from 43 to 44: this is the one file ceiling the task moved. The figure's ceilings are 7,000 triangles, 4 meshes, 5 materials, raw 362,655 and Brotli 158,382 (the build plus 1% and 2%). COMPARE passes Contract and Budget. Against the shipped file, Drift lists the demon's nodes and meshes, the rebuilt dragon's and Ashmantle's (D2, D3), and the file's three totals: triangles 94,712 to 74,724, raw bytes 4,558,688 to 4,813,856, Brotli bytes 1,401,411 to 1,237,865. That no other figure changed is shown by the hash comparison under "Measured".

## Motion: staged clips

The demon's row in `src/data/monsterPoses.ts` names its 18 bones: the biped clips' thirteen, plus `Jaw`, `LWing`, `RWing`, `TailPivot` and `TailPivot2`. It stays code-posed. The clips (`Idle`, `Walk`, `Slash`, `Death`, anticipation 0.25 as the hero manifest's `Slash`) are staged as `PENDING_DEMON_CLIPS`.

The shipped demon is rigid and has no `Hips` bone, and `attachBipedAnimator` throws on such a figure, so naming the clips on the live row now would break every demon spawn until D5. This is the same reason D2b staged the dragon's clips. **D5's promote commit must set the live `lesser_demon` row's `clips` and `anticipation` to `PENDING_DEMON_CLIPS` and remove the export, as it does for the dragon. That is not yet written in the plan.**

The wing flap of `loop.ts` is gated off for clip rows, and the biped clips do not key `LWing` or `RWing`. The wings therefore stay still relative to the torso once the row plays clips.

## Checks in a throw-away copy

The copy was of this branch's head, with the built `monsters.glb` over the shipped one, the pending manifest over the live one, and the staged clips on the live demon row (what D5 ships).

- `ONE(tests/monster-motion.test.ts)`: 63 passed, 25 skipped. Both `lesser_demon` cases ran and passed: "a clip row names every bone its clips rotate" and "every bone a row names exists on that model's skeleton and has weight". The demon's five old-branch cases are skipped because the row has clips.
- A scratch case, not committed, ran on the same copy:
  - 22 bones after the upgrade;
  - `Walk` turns the left hip 0.300 rad;
  - the held wind-up stands at `Slash` 0.125 = 0.5 × 0.25;
  - the strike turns the right arm 0.560 rad;
  - every bone except `Hips` keeps its rest translation;
  - `Death` ends at 1.083 of 1.083 s inside `DYING_SECS`, with no group topple;
  - `Hips` goes from 1.018 to 0.184.

## Sheets and capture

- `m3d-demon-turnaround.jpg`, `-silhouette.jpg`, `-worst-pose.jpg` and `-against.jpg` (left is the shipped demon) come from `SHEETS(--only lesser_demon --worst --against public/models/monsters.glb)`. `-play-distance.jpg` is halved. The offline render has no tile, so the slate looks bluer there than in the game. In the worst pose (crouch, arm overhead, twist, head turned) no gap and no vertex off the body is visible, and the cleaver, wings, loincloth and claws follow their bones.
- `m3d-demon-ingame.jpg` (numbers in `m3d-demon-ingame-rows.json`) is a CAPTURE at the pass (the demon nearest (-42, 55)), taken on the NVIDIA GPU (`scripts/capture-gpu.mjs`) with `vite preview` of a build of the throw-away copy. The copy had a debug patch that exposes `__DEBUG.G` and `getTerrainHeight`. The settings were balanced, noon and clear. The game's camera pitch was 0.7 to 0.8, because the pass is a narrow ravine and lower cameras sat inside the cliff.
  - Top row: two views between strikes, then play distance 26, then a frame taken during a `Walk` chase that had turned into the next wind-up by the time it was taken (rows: `attack`, `Slash` at 0.083).
  - Bottom row: the `scorch_lane` wind-up holding `Slash` (time 0.086, paused) under its telegraph, the strike (`Slash` 0.35), and `Death` at 0.489 and 0.977 s.
  - The four named meshes have `FACET_CUT` and vertex colours, and the group scale is 1.8.
  - No idle frame was taken. The demon was in `attack` in every view before the fight and stayed there, and the rows hold its state. The job moved the hero 40 and then 70 units away, but the death frames show the hero beside the demon, so those moves did not hold. The cause was not found.

`s4/` was 3,047,080 bytes with these, over the 2 MB a slice may hold. M3d adds 342,530 of them. D5 trims `s4/` (plan, "D3 amendments").
