# Model review sheets

Sheets are offline renders of a GLB, built or shipped, made by `scripts/blender/review_render.py` (task V1) so a model can be looked at without the game. They are evidence for the owner, not the acceptance: the owner's look on a real GPU accepts every slice (design 7.3).

## How sheets are made

The renderer imports one GLB into a factory-startup Blender, renders with Cycles on the CPU (24 samples, one sun and one fill, grey world, transparent film), and writes JPEG sheets (quality 88) into the output directory. Cameras face the figure's front (glTF +Z). Figures are laid out by the renderer, one per tile, never by their place in the file. It prints one line per sheet: path, seconds, measured pixel height (from the alpha mask).

Exact command, from the worktree root (plan 0.2, SHEETS), one Blender process at a time:

```
systemd-run --user --scope -q -p MemoryMax=3G -p MemorySwapMax=0 \
  timeout 600 /usr/bin/blender --background --factory-startup --disable-autoexec \
  --python-exit-code 1 --python scripts/blender/review_render.py -- <glb> <out dir> \
  [--only a,b] [--against <other.glb>] [--clips] [--worst] [--engine-palette]
```

or `scripts/capped.sh timeout 600 /usr/bin/blender ...` with the same arguments. Write `<out dir>` under `scratch/` and copy the sheets you keep into `docs/superpowers/baseline/models/<slice>/` (at most 2 MB per slice). The renderer only reads the GLB; it never writes beside it.

| Option | Effect |
|---|---|
| `--only a,b` | Render only these figures (root name or model key) |
| `--clips` | One six-frame strip per clip, with each pivot's or bone's rotation range printed to the log. Every object's active action is cleared before one NLA track is unmuted (critique C2) |
| `--worst` | Worst-pose sheet for a figure with an armature: deep crouch, arm overhead, full twist, head turned |
| `--against <glb>` | The same figure from another file side by side, same camera (before and after) |
| `--engine-palette` | Colours the hero by `extras.part` with the colours `blenderHero.ts` sets, as the engine does. Use it for every hero sheet |

Sheets per figure: turnaround (front three-quarter, side, back three-quarter, 512 px), silhouette (same views, flat black on white), play distance (crops of a 1080-line frame at distances 5.4, 8.5 and 26, in-game scale from `scripts/blender/review_scales.json`, pixel height drawn in the corner), one strip per clip with `--clips`, worst pose with `--worst`, and side by side with `--against`. One roster silhouette sheet holds every figure of the file at its 26-distance size.

## What a render proves and does not (design 7.3)

| Sheet | Content | Proves |
|---|---|---|
| Turnaround | Front three-quarter, side, back three-quarter, 512 px | Form, proportion, joints |
| Silhouette | The same three views in flat black on white | The 85 px read; species told apart on one roster sheet |
| Play distance | Crops of a 1080-line frame at distances 5.4, 8.5 and 26, at in-game scale, with the pixel height printed | What survives at play size |
| Motion | Six frames per clip in a strip (hero), or the pose table's poses (monsters); per clip, the measured rotation range of each bone. Worst-pose sheet per skinned figure | Anticipation, strike, follow-through; how the skin bends, pinches or tears in the worst pose |
| Before and after | The shipped and the built figure side by side, same camera | The change |

**A render can prove**: silhouette, proportion, relative size, pixel size at distance, joint gaps, pose and motion arcs, triangle density.

**A render cannot prove**: colour and material as the game draws them (the engine replaces every material and re-projects UVs), the banded light, the outline, shadows on the world, speed, the blend between clips, how a hit feels. Those need the in-engine capture (task V4), and that capture comes from a software renderer, so **the owner's look on a real GPU is the acceptance of every slice**.

## Honesty check (task V2, 2026-11-15)

Sheets rendered at commit `6a47eb1` on Blender 5.0.1 from the shipped files, into `scratch/v2/` (not committed; V3 commits the baseline):

- `public/models/hero.glb` with `--clips --engine-palette`: exit 0, 22 s wall, 14 sheets, each 2 to 46 kB.
- `public/models/guard.glb`: exit 0, 13 s wall, 4 sheets, each 3 to 35 kB.

| Known fact | Expected | Measured | Result |
|---|---|---|---|
| Hero height, turnaround tile | 410 px within 5% | 409 px | pass |
| Hero heights, play distance 5.4 / 8.5 / 26 | 410 / 260 / 85 px within 5% | 405 / 254 / 82 px (-1.2%, -2.3%, -3.5%) | pass |
| Guard shows its stored pose | T-pose, sword at the sky, no animation (design 4.2) | Arms out and angled down, sword raised over the right shoulder, same pose as the design's earlier renders (`today-people.jpg`) | pass (see note) |
| `Walk` strip | Legs alternate | Frames 2 and 5 lift opposite feet; log: `LeftLegPivot` and `RightLegPivot` 1.10 rad, knees 0.75 rad | pass |
| `Slash` strip | Right arm moves; `RightArmPivot` range 1.84 rad within 0.05 | Right arm swings out in frame 4; log 1.84 rad; the GLB's own track, measured from its quaternions with node, is 1.845 rad | pass |
| `Idle` strip | Every printed range under 0.07 rad | Largest 0.06 rad (`LeftElbowPivot`, `RightElbowPivot`); the GLB's own tracks agree to 0.001 | pass |
| Silhouette sheets | Pure black on white | Hero 99.2% and guard 99.2% of pixels at luma 16 or less or 239 or more; the rest sit on figure edges (anti-aliasing and JPEG ringing). No grey fill, no shading inside the figure | pass |

No mismatch was found, so no follow-up fix of `review_render.py` is needed before V3.

**Note on the guard.** In all three views, both of the guard's gauntlets stand apart from the upper arms, with a visible gap at the elbow, in the colour sheet and the silhouette alike. The renderer cannot cause this: `guard.glb` has no skin, no animation and no node rotation or scale (27 meshes directly under `CastleGuard`), and the renderer moves no node of a figure without clips. The gap is in the shipped geometry; the earlier renders hid it by camera angle. V3's note on `guard.glb` should name it, and the V4 in-engine capture shows whether the game shows it too.

**Note on the `Walk` strip.** The camera faces the figure's front, so the stride reads as feet lifting in turn, not as legs swinging forward and back. A side view of motion would show the arc better; it is not needed to prove the clip plays.

## The pilot figure: goblin raider, rebuilt and skinned (task S2, 2026-11-25)

The goblin raider is the first figure built to design sections 5 and 6.1: one skinned body on the biped rig, bones named `goblin_<Bone>`, root at the file's origin. It is built four ways so the owner can choose at OM-P. Nothing is promoted: `public/models/` and `blender/` are as they were.

### The four builds

| Build | Body route | Materials | BLEND line (plan 0.2) |
|---|---|---|---|
| `a3` | (a) `figkit.organic_body` over a stick graph | three families: skin, wood, metal | `timeout 600 env BLENDER_PATH=/usr/bin/blender GOBLIN_BODY=a GOBLIN_MATS=3 node scripts/run-blender.mjs monsters --out scratch/models-build/s2r3/a3` |
| `b3` | (b) primitives fused by a voxel remesh | three families | the same with `GOBLIN_BODY=b`, `--out .../b3` |
| `a1` | (a) | one material, every colour in the paint layer | `GOBLIN_BODY=a GOBLIN_MATS=1`, `--out .../a1` |
| `b1` | (b) | one material | `GOBLIN_BODY=b GOBLIN_MATS=1`, `--out .../b1` |

Both variables are required and have no default: a monsters build without them stops with exit 1 at `build_goblin` (`goblin: set GOBLIN_BODY to a or b and GOBLIN_MATS to 3 or 1 on the BLEND line; got None and None (no default)`), so every BLEND(monsters) line from here on, S4's included, has to name the route and variant the owner chose at OM-P. Head, gear, palette, rig and weight rules are the same in all four. COMPARE is `node scripts/models-compare.mjs scratch/models-build/s2r3/<build>/monsters.glb public/models/monsters.glb`; one pending manifest (`tests/fixtures/model-contract/pending/monsters.json`) serves all four. **COMPARE exits 1 on all four, so the Blender gate is not met.** Contract fails on one rule, `COLOR_0` on some primitives of the file and not all; Budget fails on three ceilings outside the goblin's entry, which S2 may not raise; Drift lists no mesh of the nine other figures. The lines are under "Open before S3".

### Measured

Brotli quality 3. "Figure" is `figureStats` of `scripts/models-compare.mjs` (the buffer views the figure's meshes and skin read), the number the manifest's ceiling is checked against. Builds of the second repair (2026-11-25, route (a) with hands, the belt laid on the body): the nine other figures are exported as shipped, with their `TEXCOORD_0` and no `COLOR_0`.

| | Shipped goblin | `a3` | `b3` | `a1` | `b1` |
|---|---|---|---|---|---|
| Triangles | 8,292 | 4,960 | 4,960 | 4,960 | 4,960 |
| Meshes (draw calls a pass) | 29 | 3 | 3 | 1 | 1 |
| Materials | 10 | 3 | 3 | 1 | 1 |
| Vertices | | 2,571 | 2,571 | 2,571 | 2,571 |
| Figure raw bytes | 523,952 | 164,668 | 164,668 | 164,668 | 164,668 |
| **Figure Brotli bytes** | 92,625 | **100,295** | **99,929** | **100,126** | **99,110** |
| `monsters.glb` Brotli bytes | 1,281,976 | 1,386,979 | 1,358,880 | 1,385,905 | 1,385,987 |
| `monsters.glb` raw bytes | 4,848,004 | 4,505,504 | 4,505,508 | 4,503,208 | 4,503,208 |
| Height of the figure's bounds | 1.785 | 1.782 | 1.788 | 1.782 | 1.788 |
| Pixels tall at 5.4 / 8.5 / 26 (this renderer) | 323 / 209 / 70 | 329 / 206 / 68 | 330 / 207 / 68 | 329 / 206 / 68 | 330 / 207 / 68 |

The body route moves the figure's wire size by about 1%, and so does the material variant. A painted, skinned 4,960-triangle figure with its weapon and shield is about 100 kB as exported: 20.2 bytes a triangle, 39.0 a vertex.

**The file grows on the wire although the goblin is smaller.** Measured: the file's Brotli size is 76,904 (`b3`) to 105,003 (`a3`) bytes over the shipped file's, while the goblin's own figure number is 6,485 to 7,670 over. The cause of the difference was not isolated. Two things are measured. First, whole-file Brotli at quality 3 swings by tens of thousands of bytes between near-equal files here: `b3` and `b1` differ by 27,107 bytes while their goblins differ by 819. Second, in the shipped file the exporter shares 16 buffer views (32,736 bytes) between the old goblin and other figures, 13 of them with the archer; the rebuilt goblin shares none, so those views are written in the other figures' own range and in a new order. That is why three untouched figures change their figure number with every byte unchanged: the archer from 72,904 to 75,388, the scorpion from 118,070 to 115,991, the moss guardian from 69,156 to 70,050. All 153 meshes of the nine other figures were hashed, shipped against each of the four builds, over every attribute, the indices and the material name: all 153 are identical.

### Wire ceilings, reset from the pilot

The pending manifest's ceiling for `Monster_goblin` is 102,301 Brotli bytes (the largest build, `a3` at 100,295, plus the manifest's 2%), 166,315 raw bytes (164,668 plus 1%), 5,000 triangles, 4 meshes, 5 materials. **Nothing outside the goblin's entry is raised**: S2's file list allows the goblin's entry only, so the file's Brotli ceiling (1,294,796), the goblin archer's (74,363) and the file's material count (35) are the live ones. Every build is over all three, by Budget's own lines:

| Build | `materials`, ceiling 35 | file `brotliBytes`, ceiling 1,294,796 | `Monster_goblin_archer` `brotliBytes`, ceiling 74,363 |
|---|---|---|---|
| `a3` | 36 | 1,386,979 | 75,388 |
| `b3` | 36 | 1,358,880 | 75,388 |
| `a1` | 36 | 1,385,905 | 75,388 |
| `b1` | 36 | 1,385,987 | 75,388 |

The ceilings that would pass all four, by the manifest's own margins (file 1%, figure 2%): materials 36, file Brotli 1,400,849, archer Brotli 76,896. They are open item 3 below.

Design 9.1's "as exported" column was drawn from a probe body; the same column at the pilot's 20.2 bytes a triangle plus 3%:

| Class | Triangles | Design 9.1, as exported | Reset from the pilot |
|---|---|---|---|
| Swarm creature | 1,200 | 30 kB | 25 kB |
| Small | 2,500 | 60 kB | 52 kB |
| Ordinary monster | 5,000 | 115 kB | 104 kB |
| Large | 7,000 | 160 kB | 146 kB |
| Boss | 14,000 | 320 kB | 292 kB |
| Ashmantle | 12,000 | 275 kB | 250 kB |

The "with N-3" column is not reset: the 8-bit step (Q1) has not been run on this figure. The design document is not in S2's file list, so its table is unchanged; these are the values to carry into it.

### The pattern, in order

All of it is in `build_goblin` and its helpers in `scripts/blender/build_monsters.py`.

1. **Joints first.** One table of joint positions (`goblin_joints`) in the bind pose, which is the stance. Each limb is within 20 degrees of the biped reference; `figkit.make_rig` refuses otherwise. The goblin's are 19 degrees of forward lean on the spine and 19 on the neck, 16 and 18 on the arms, 18 on thigh and shin. The hump of the back and the head's thrust are mesh, not joints, so they are free.
2. **Rigid parts** from the file's primitives (`add_sphere`, `add_cone_spike`, `add_lathe`, `add_limb_tube`, `add_box`), in world space with no parent. The head (skull, brow, nose, ears) is fused into one form by a voxel remesh at 0.012 and decimated to 1,100 triangles. Irises, tusks, jaw, mouth, pauldron and spikes, loincloth, spear and shield stay primitives. **The jaw is built to read from the front**: an ellipsoid wider than the skull above it (0.23 against 0.20 half-width) that stands 0.11 in front of the upper lip and reaches 0.06 under the skull, so its top is a shelf under the game's camera; a dark slab between lip and jaw is the mouth line (about 10 px tall at 330 px); the two tusks start on the jaw's front corners at x 0.17, outside the irises' column (x 0.10), and end under the irises' lower edge.
3. **Body last, with what is left of the triangle budget** (5,000 less 40 less the rigid parts and the belt's 96). Route (a): `figkit.organic_body(graph, radii, 0.02, ...)`, then forty smoothing passes, because the skin modifier gives square limbs; the radii are about 15% over the wanted ones to pay for the passes. **A limb's end does not survive forty passes**: a hand node of the wrist's size came out as a tapered stump. So each arm ends in a wrist node (radius 0.062) and two hand nodes (0.10 and 0.09) around the hand joint, and the smoothing takes a vertex group that gives a ball of radius 0.15 around each hand a fifth of the passes' strength, rising to all of it at 0.24. Measured on the built body, from the forearm's axis: 0.089 at the wrist, 0.133 at the hand (route (b): 0.076 and 0.077, its own hand ellipsoid). The spear's shaft (radius 0.028) passes through the hand joint, inside the fist. Route (b): closed primitives joined, voxel remesh at 0.02, eight passes. Both are decimated and `validate()`d.
3b. **The belt is laid on the finished body** (`_goblin_belt`), the same code on both routes: sixteen rays from the body's axis at two heights find the surface, and the band stands 0.02 outside it with a lip turned in above and below (96 triangles). A lathe of fixed radii was buried in route (a)'s belly in the front view and could not be seen.
4. **Rig**: `figkit.make_rig("Monster_goblin", rigs.BIPED_TABLE, joints, prefix="goblin")`, with the optional `Jaw`, `WeaponPivot` and `OffhandPivot`.
5. **Weights.** Rule 1: the body takes `figkit.auto_weights` against a second rig that holds only the sixteen limb bones and starts `Root` inside the pelvis; a `Root` standing from the ground to the hips would take the inner legs, and `Jaw` and the hand mounts would take skin. Rule 2: `figkit.fold_weights` gives `Root`'s share to `Hips`. Rule 3: every other part gets `figkit.hard_weights` on one bone: head, irises and the mouth's dark slab on `HeadGroup`, jaw and tusks on `Jaw`, spear on `WeaponPivot`, shield on `OffhandPivot` (its normal is made perpendicular to the forearm and it stands 0.15 off the forearm's axis, clear of the fist), pauldron on `LeftArmPivot`, belt and loincloth on `Hips` (never on the legs). Automatic weights left no vertex unweighted on either route; the segment fallback did not run.
6. **Colour before the merge.** Each part carries a constant `Tint`: its colour over its material's own colour. The body's tint goes from olive to the darker olive on faces turned to the ground and by hand and foot weight.
7. **Merge**: `figkit.merge_by_family(rig)` gives one skinned mesh per engine family, named `goblin_body`, `goblin_wood`, `goblin_metal`. No mesh name holds `eye`: the engine would draw that whole mesh unlit.
8. **Paint**: `figkit.bake_paint(rig)` with every other object hidden from the bake, then `Col` times `Tint`, then the armature modifier. The goblin's meshes drop their UV layers (no figure reads GLB UVs, design 6.3), so they export `POSITION`, `NORMAL`, `COLOR_0`, `JOINTS_0` and `WEIGHTS_0`.
9. **Export** through the file's own export call, as before, with one argument added: `export_vertex_color="ACTIVE"`. Blender's default writes a colour layer only when the material's nodes read it, and the three-family builds use the shared `mat_wood` and `mat_bronze`, which do not. No other figure has a colour layer, so the argument changes nothing for them. `main()`'s merge loop is as it was: `merge_parts` on the skinned root finds one mesh per material and joins nothing.

### What the materials had to be

Vertex colour multiplies the material's colour, so it can only darken it. The skin mesh therefore uses a new white material, `mat_skin_goblin_paint`, made inside `build_goblin` (`build_materials` is unchanged), and its olive, bone, rust cloth and yellow irises are paint. The three-family builds put shaft, shield planks and belt on `mat_wood` and spear head, boss, rim, collar and pauldron on `mat_bronze`, each tinted down from that material's colour. The one-material builds put everything on `mat_skin_goblin_paint`. Both variants export the same material names, which is why one manifest serves all four. Wood (24% value) and leather (20%) sit under design 5.4's 25% but over its 18% floor: `mat_wood` is shared and its colour is not this task's to change.

### What changed outside the goblin, and why

Repaired on 2026-11-25. The first S2 build wrote a white `COLOR_0` on the nine other figures and exported no `TEXCOORD_0` for them; that broke S2's "every other builder" rule (153 meshes with changed bytes, 3,568 triangles with different albedo UVs in the engine) and is undone.

- **Nothing of the nine other figures changes.** COMPARE's Drift lists no "geometry bytes changed" line and no node of another figure, for all four builds. Their 155 primitives keep `POSITION`, `NORMAL` and `TEXCOORD_0` and carry no `COLOR_0`. The script's diff outside the goblin's section is one argument on the export call (pattern step 9); `build_materials`, the merge loop and every other builder are as they were.
- **The pending manifest** changes: the goblin's five pivots leave `nodes` and are bones of the same names in a new `skin` block (nineteen bones, the skinned root, the limb directions); `Monster_goblin` is at the origin; the goblin's mesh classes are `goblin_body`, `goblin_wood`, `goblin_metal`; the `materials` name list gains `mat_skin_goblin_paint`; and the goblin's figure ceilings. Its `budget` block and every other figure's entry equal the live manifest's. `vertexColor` stays `none`: no value of that field passes a painted goblin beside nine unpainted figures (open item 1).
- **`tests/monster-merge.test.ts`'s goblin fixture is staged, not replaced.** The test reads the shipped file, so a replaced entry would turn the suite red until S4, and the entry differs between the material variants. Both are in `tests/fixtures/model-contract/pending/monster-families.goblin.json` (`three-families`, `one-material`); the body route does not change them. Tried on 2026-11-25: with the `three-families` entry written over the `goblin` entry of `tests/fixtures/monster-families.json`, `tests/monster-merge.test.ts` fails 3 of its 31 cases against the shipped file (goblin triangles per family, goblin pivots' families, and `expected 29 to be less than or equal to 3` meshes); the fixture was restored.

### Open before S3 (for the main session; none of it can be settled inside S2's file list)

**Settled 2026-11-25 by the main session** (plan, "S2 amendments"): item 1 by a per-figure rule in COMPARE; item 3's three manifest ceilings set in the pending manifest; items 2, 4 and 3's `totals.json` moved to S4; item 5 accepted. Builds rebuilt on 7964142 under `scratch/models-build/s2final/`: COMPARE exits 0 on all four (Brotli 1,386,979 `a3`, 1,358,880 `b3`, 1,385,905 `a1`, 1,385,987 `b1`).

1. **`COLOR_0` all or none per file.** `scripts/models-compare.mjs` fails Contract when some primitives of a file carry `COLOR_0` and others do not, whatever the manifest says, and `tests/model-pipeline.test.ts` pins that. A painted goblin beside nine untouched figures is such a file, so COMPARE's Contract fails on every S2 build, on these two lines and no other: `COLOR_0 on 3 of 158 mesh primitives (must be all or none)` (1 of 156 for the one-material builds) and `Manifest requires vertexColor 'none', but COLOR_0 is present on 3 primitives`. The engine does not need the rule: it sets `vertexColors` per mesh from the mesh's own `color` attribute (`blenderMonsters.ts`). The choices: make the rule per figure in compare and its test, with a manifest value for it; or allow the white layer on unpainted figures, which is the first S2 build (commit `44b8c83`, `main()`), with its UV cost.
2. **`tests/model-vertex-colour.test.ts`, "today's GLBs produce no material with vertexColors".** With a build copied over the shipped file it fails on `goblin: expected true to be false`. Any painted goblin fails it, with or without the white layer; the test is frozen (rule 0.3.3) and not on S4's list. S4 needs a declared replacement for that assertion.
3. **Ceilings outside the goblin's entry.** The pending manifest keeps the live ones, and Budget fails on three lines for every build (table under "Wire ceilings"): `Budget ceiling exceeded for 'materials': actual 36 > ceiling 35`, `Budget ceiling exceeded for 'brotliBytes': actual 1386979 > ceiling 1294796` (`a3`; 1358880, 1385905, 1385987 for `b3`, `a1`, `b1`) and `Budget ceiling exceeded for 'brotliBytes' of figure 'Monster_goblin_archer': actual 75388 > ceiling 74363`. A plan amendment that lets S2's pending manifest set `budget.materials` 36, `budget.brotliBytes` 1,400,849 and the archer's `brotliBytes` 76,896 clears all three. Beside them, `tests/fixtures/model-contract/totals.json` allows 3,789,725 Brotli bytes for the five files, 37,523 over the shipped ones, and each build is 76,904 to 105,003 over the shipped `monsters.glb`, so with a build copied over the shipped file `tests/model-contract.test.ts` fails its total. `totals.json` is not in S2's or S4's list.
4. **Staging the monster-merge fixture.** S2's Accept says the goblin fixture is "replaced by this task". It is staged instead, in a file S2's list does not name. S4 needs the copy step: the chosen variant's entry of `pending/monster-families.goblin.json` over the `goblin` entry of `tests/fixtures/monster-families.json`, in the promotion commit, and the staged file deleted.
5. **`mat_skin_goblin_paint` and the export argument.** S2's list reads "the goblin raider's builder only". The material is now made inside the builder. The one argument on `main()`'s export call is outside it and is needed for the paint to reach the file; it cannot move into the builder. Read in Blender 5.0.1's exporter (`io_scene_gltf2/blender/exp/primitive_extract.py`): the argument is one setting for the whole export, and the default mode `MATERIAL` writes a colour layer only for a material whose Base Color is fed by a Color Attribute node. The three-family builds use the shared `mat_wood` and `mat_bronze`, so that route would need two more goblin-only materials (38 against the ceiling of 35) or nodes on materials other figures use. `import rigs` is now inside `build_goblin` and the file's header docstring is as it was before S2, so the argument is the script's only line changed outside the goblin's section.
6. **`tests/model-cache-key.test.ts`** is red against a promoted build until S4 sets the key, as at M0p.

### Sheets

In `s1/`, re-rendered after the second repair with `--only goblin --worst --against public/models/monsters.glb`: for `a3` and `b3` the turnaround, silhouette, play-distance, worst-pose and against sheets (left is the shipped goblin); for `a1` and `b1` the turnaround only, since a render cannot show how one engine material differs from three (that is S3's capture). The renderer does show the paint layer: the importer multiplies `COLOR_0` into the base colour.

What the sheets hold, against design 5.1's three reads, as facts:

- **26 (68 px)**: ears, spear and shield stand outside the body outline on both routes.
- **8.5 (207 px)**: weapon side and shield side are separate from the torso, with a gap under each arm; the irises, the mouth line and the two tusks are four distinct marks.
- **5.4 (330 px)**: route (b) keeps the forms of its primitives (shoulder, upper arm, calf, the hump); route (a) is one smooth sack with no muscle form, which is what a stick graph and forty passes give. On both routes the right arm ends in a hand around the spear's shaft. Route (a)'s is a squared fist, 0.133 from the forearm's axis against 0.089 at the wrist; route (b)'s is a rounded ellipsoid that is no wider than its wrist band by the same measure (0.077 against 0.076). The shield's face lies along the left forearm, 0.15 off its axis, and turns up to the game's camera: no skin vertex is beyond the planks' front face on either route (before this repair 15 were, on both routes, and the fist showed as an olive patch under the boss). The belt is a dark band around the hips above the loincloth, seen in the front, side and back views of both routes. The hands are mittens and the face is rigid, as design 6.1.6 says. On the front view the face holds, from the top: brow, irises with the nose between them, a dark mouth line the width of the face, and under it the jaw, wider than the skull, with a tusk rising from each front corner beside the mouth line and ending under the iris. In the three-quarter and side views the jaw stands in front of the upper lip.
- **Worst pose** (crouch, right arm overhead, torso twisted 0.8, head turned): no gap and no vertex off the body is visible on either route. The spear follows the hand and the shield the forearm; the belt and loincloth stay with the hips. The sheet's crouch only lowers the root, so it does not bend a knee: knees and elbows are first seen bent in S3.
