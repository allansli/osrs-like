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
2. **Rigid parts** from the file's primitives (`add_sphere`, `add_cone_spike`, `add_lathe`, `add_limb_tube`, `add_box`), in world space with no parent. The head (skull, brow, nose, ears) is fused into one form by a voxel remesh at 0.012 and decimated to 1,100 triangles. Irises, pupils, tusks, jaw, mouth, pauldron and spikes, loincloth, spear and shield stay primitives. Each iris carries a dark pupil standing just proud of it, 0.048 wide and 0.056 tall (S2b: nothing on the face under 0.044); no object's name holds `eye`. **The jaw is built to read from the front**: an ellipsoid wider than the skull above it (0.23 against 0.20 half-width) that stands 0.11 in front of the upper lip and reaches 0.06 under the skull, so its top is a shelf under the game's camera; a dark slab between lip and jaw is the mouth line (about 10 px tall at 330 px); the two tusks start on the jaw's front corners at x 0.17, outside the irises' column (x 0.10), and end under the irises' lower edge.
3. **Body last, with what is left of the triangle budget** (5,000 less 40 less the rigid parts and the belt's 96: about 1,970 triangles on route (a) and 1,980 on (b)). Rewritten at S2b. Route (a): `figkit.organic_body(graph, radii, 0.02, ...)`, then **fourteen** smoothing passes (forty at S2 left one smooth sack). The graph narrows each limb between its joints, so shoulder, elbow, hip and knee stand as forms: arm 0.105 at the shoulder, 0.078 at 60% of the upper arm, 0.092 at the elbow, 0.07, 0.056 at the wrist, then two hand nodes (0.084, 0.078); leg 0.118 at the hip, 0.082, 0.098 at the knee, 0.08 at the calf, 0.052 above the ankle. The waist node (0.125 since S2c) is narrower than the pelvis (0.165) and the chest, which since S2c is two wide flat ellipses (0.26 by 0.19 and 0.27 by 0.19), so its front and back are planes: that is the one chest-to-waist break. A radius pair's first number is across the body on an upright edge and the second is across on a level one (the foot), read off the built mesh. Each collar node has the radius pair 0.18 by 0.13 (S2c), and the shoulder line slopes from the neck. The hump is one node standing off the back (radius 0.15 at 0.17 behind the chest line), which the skin modifier makes a block with a face of its own. **A node that lies in another form's surface breaks the skin**: a second hump node down the back gave a voxel mesh with about 140 tunnels (vertices less edges plus faces of -278 where a closed body gives 2), the decimate could not reduce it, and the belt's rays left through the holes; one node gives 2. Each foot is one flat slab (S2c): a heel node under the ankle joint and a toe node 0.185 in front, both at one height and 0.05 tall, 0.062 across at the heel and 0.075 at the toe box. The smoothing takes a vertex group that gives a ball around each hand (radius 0.15) and each foot (0.17) a fifth of the passes' strength, rising to all of it at 1.6 radii, or the ends shrink to stumps. Route (b): closed primitives joined, voxel remesh at 0.02, **one** pass (eight at S2). Its limb tubes have six sides and its torso lathe ten, with a ball at each elbow and knee, a waist section under the ribs, and a hump of six sides and five rings, so the remesh keeps planes to mark. On both routes `_goblin_skin` then cuts the skin flat at the ground (feet reach 0.015 to 0.026 under it, so the soles are planes), decimates, `validate()`s, and **marks hard edges** (faces stay smooth): every edge whose faces meet at more than 32 degrees (`GOBLIN_CREASE`), and, since S2c, every edge between two planes. `_goblin_planes` sorts the faces into planes: from the largest free face, a plane grows across edges under the crease angle to the faces within 40 degrees of that first face's normal (`GOBLIN_PLANE_SPREAD`), and a plane under 0.4% of the skin's area joins the neighbour it faces most nearly (`GOBLIN_PLANE_MIN`). The hard edges therefore close round each plane, which the plane tone of step 6 needs. Before marking, the builder stops if any body edge does not have exactly two faces, or if vertices less edges plus faces is not 2 (a tunnel or a loose piece), so a hole left by the remesh, the ground cut or the decimate cannot pass as a hard edge; all four builds pass. The exporter splits the vertices of a hard edge, which is what makes the planes read in the engine's smooth shading: the goblin's vertices went from 2,571 to 2,968 (a) and 3,177 (b) at S2b, and to 3,259 and 3,628 with S2c's closed planes. The head is not creased. Measured on the built body, from the forearm's axis: 0.086 at the wrist and 0.115 at the hand on route (a), 0.078 and 0.082 on (b). The spear's shaft (radius 0.034, 0.035 built) passes through the hand joint, inside the fist. The builder stops if any body vertex stands in front of the shield's planks.
3b. **The belt is laid on the finished body** (`_goblin_belt`), the same code on both routes: sixteen rays from the body's axis at two heights find the surface, and the band stands 0.02 outside it with a lip turned in above and below (96 triangles). A lathe of fixed radii was buried in route (a)'s belly in the front view and could not be seen. Since S2b the belt is on the paint material, like the loincloth, in all four builds: leather at 30% value is lighter than the shared `mat_wood` can be painted.
4. **Rig**: `figkit.make_rig("Monster_goblin", rigs.BIPED_TABLE, joints, prefix="goblin")`, with the optional `Jaw`, `WeaponPivot` and `OffhandPivot`.
5. **Weights.** Rule 1: the body takes `figkit.auto_weights` against a second rig that holds only the sixteen limb bones and starts `Root` inside the pelvis; a `Root` standing from the ground to the hips would take the inner legs, and `Jaw` and the hand mounts would take skin. Rule 2: `figkit.fold_weights` gives `Root`'s share to `Hips`. Rule 3: every other part gets `figkit.hard_weights` on one bone: head, irises and the mouth's dark slab on `HeadGroup`, jaw and tusks on `Jaw`, spear on `WeaponPivot`, shield on `OffhandPivot` (its normal is made perpendicular to the forearm and it stands 0.15 off the forearm's axis, clear of the fist), pauldron on `LeftArmPivot`, belt and loincloth on `Hips` (never on the legs). Automatic weights left no vertex unweighted on either route; the segment fallback did not run.
6. **Colour before the merge.** Each part carries a `Tint` stored per face corner: its colour (every goblin material is white since S2c). The body's tint goes from olive to the darker olive by hand and foot weight, times its **plane tone** (S2c): `_goblin_plane_tones` takes each region of faces joined by edges that are not hard, and gives it one tone from its area-weighted normal against a direction up and forward, from 8% lighter to 12% darker. The skin's two colours (body, head, jaw) are divided by the mean of the engine's goblin-hide tile, read from `public/textures/creatures/goblin-hide.png` at build time, so the game shows the colour in the table.
7. **Merge**: `figkit.merge_by_family(rig)` gives one skinned mesh per engine family, named `goblin_body`, `goblin_wood`, `goblin_metal`. No mesh name holds `eye`: the engine would draw that whole mesh unlit.
8. **Paint**: `figkit.bake_paint(rig, ao=0.5)` (S2c; 0.35 before) with every other object hidden from the bake, then the baked `Col` (one value a vertex) times `Tint` (one value a face corner) written as a new `Col` on the corner domain, then the armature modifier. The exporter splits a vertex whose corners differ in colour; a tone changes only across a hard edge, which is split already, so the layer adds no vertex (measured, S2c section). The goblin's meshes drop their UV layers (no figure reads GLB UVs, design 6.3), so they export `POSITION`, `NORMAL`, `COLOR_0`, `JOINTS_0` and `WEIGHTS_0`.
9. **Export** through the file's own export call, as before, with one argument added: `export_vertex_color="ACTIVE"`. Blender's default writes a colour layer only when the material's nodes read it, and the three-family builds use the shared `mat_wood` and `mat_bronze`, which do not. No other figure has a colour layer, so the argument changes nothing for them. `main()`'s merge loop is as it was: `merge_parts` on the skinned root finds one mesh per material and joins nothing.

### What the materials had to be

Vertex colour multiplies the material's colour, so it can only darken it. The skin mesh therefore uses a new white material, `mat_skin_goblin_paint`, made inside `build_goblin` (`build_materials` is unchanged), and its olive, bone, rust cloth and yellow irises are paint. The three-family builds put shaft and shield planks on `mat_wood` (the belt too until S2b, which moved it to the paint material) and spear head, boss, rim, collar and pauldron on `mat_bronze`, each tinted down from that material's colour. The one-material builds put everything on `mat_skin_goblin_paint`. Both variants export the same material names, which is why one manifest serves all four. At S2 wood (24% value) and leather (20%) sat under design 5.4's 25%; S2b's colours and what the shared `mat_wood` and `mat_bronze` still stopped are in the S2b section below. **Since S2c the three-family builds use two more white materials of the goblin's own, `mat_wood_goblin_paint` and `mat_bronze_goblin_paint`, made inside `build_goblin`,** so no goblin mesh is on a shared material and the two variants no longer export the same material names: each has its own pending manifest (S2c section).

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

## The pilot's planes, joints and colours (task S2b, 2026-11-25)

From the S3 art read (plan, "S3 follow-ups before OM-P"): the body read as smooth clay in the game and the skin had the lit grass's value. The same four builds, rebuilt with nine changes. Nothing is promoted: `git status --short public/models blender` prints nothing. The pattern above (steps 2, 3, 3b) is rewritten to match; the numbers under "Measured" and "Wire ceilings" above are S2's and are kept as its record.

### The four builds

`timeout 600 env BLENDER_PATH=/usr/bin/blender GOBLIN_BODY=<a|b> GOBLIN_MATS=<3|1> node scripts/run-blender.mjs monsters --out scratch/models-build/s2b/<build>` for `a3`, `b3`, `a1`, `b1`, one Blender process at a time; each exits 0. `node scripts/models-compare.mjs scratch/models-build/s2b/<build>/monsters.glb public/models/monsters.glb` **exits 0 on all four** against the one pending manifest: Contract and Budget pass. Drift names the raider's nodes and meshes and the file's three totals, and no node, mesh or "geometry bytes changed" line of another figure.

### The nine changes

| # | Change | Route (a) | Route (b) | Where |
|---|---|---|---|---|
| 1 | Chosen hard edges; fewer smoothing passes; a smaller body | edges over 32 degrees hard; 14 passes (was 40); body about 1,970 triangles | the same rule; 1 pass (was 8); body about 1,980 | `_goblin_skin`, `GOBLIN_CREASE` |
| 2 | One chest-to-waist break; the hump as its own plane | a waist node of 0.135 between pelvis 0.165 and ribs 0.215; the hump one node standing off the back | a waist section (half-width 0.17) under ribs of 0.25; the hump a ball of six sides and five rings | `_goblin_body_graph`, `_goblin_body_primitives` |
| 3 | Knees, elbows and real feet | limbs narrow between joints; heel and toe nodes in a keep ball, 0.30 by 0.13, cut flat at the ground | a ball at each elbow and knee; the foot ellipsoid 0.30 by 0.13, cut flat | the same |
| 4 | Knees and feet 0.03 to 0.04 further apart | knee x 0.215 to 0.2325, foot x 0.191 to 0.2085: 0.0175 each side, 0.035 between the pair (0.0357 built) | the same joints | `goblin_joints` |
| 5 | Skin lower in value and greyer | all four builds: `0x505C3E`, value 36%, saturation 33% (was `0x62733A`, 45% and 50%); dark tone `0x383F2C`, 25% (was 36%): the gap goes from 9 points to 11 | | `GOBLIN_COLOURS` |
| 6 | Wood and leather to 30 to 35% | leather 30% in all four (the belt moved to the paint material). Wood 33% in `a1` and `b1`; **24% in `a3` and `b3`** | | see "Not met" |
| 7 | Bronze lighter and more saturated, 15 points from rust | `a1`, `b1`: bronze `0x9A6E2A`, value 60%, saturation 73% (was 48% and 59%), rust as at S2 (`0x6E4A2C`, 43%): 17 points. **`a3`, `b3`: bronze unchanged at 48%**, rust lowered to `0x54381F`, 33%: 15 points | | see "Not met" |
| 8 | A pupil on each eye, nothing under 0.044 | a dark pupil on each iris, 0.048 wide and 0.056 tall, 0.049 and 0.057 built | | `build_goblin` |
| 9 | Spear shaft at radius 0.034 | 0.034 at the butt, 0.032 at the head (was 0.028 and 0.026); the collar 0.048 so it still stands over the shaft | | `build_goblin` |

The thigh is 18.9 degrees from the biped reference (18.0 at S2) and the shin 18.0, under the 20 that `make_rig` and COMPARE allow. The pending manifest's two knee translations follow: `goblin_LeftKneePivot` and `goblin_RightKneePivot` to (-/+0.09435, -0.28152, -0.0918); the feet move with the knees, so their translations are unchanged.

### Not met, and open for the main session

1. **Changes 6 and 7 are not met in the three-family builds, `a3` and `b3`,** the variant the art read recommends. Vertex colour multiplies the material's colour and can only darken it. Those builds put the spear shaft and the shield's planks on the shared `mat_wood` (`0x3E2C1C`, 24% value) and the spear head, boss, rim, collar and pauldron on the shared `mat_bronze` (`0x7A5B32`, 48%); `build_materials` belongs to every figure and is outside S2b's file list, and no lighter material of either engine family exists in the file. So wood stops at 24% (asked: 30 to 35%) and bronze at its own 48% and 59% saturation (asked: lighter and more saturated); the 15-point gap is reached there by lowering rust instead, so rim, collar and pauldron are darker in `a3` and `b3` than in `a1` and `b1`. Goblin-own white wood and metal materials would lift both, but COMPARE holds a file's material names as an exact set and one pending manifest serves all four builds, so `a1` and `b1` would then fail on two missing materials. If the owner picks three families at OM-P, S4 can add the two materials (`budget.materials` 38) with the manifest in the same commit, since only one build is left.
2. **The body is about 1,970 to 1,980 triangles, under the plan's "about 2,500 to 3,000".** The plan's figure reads as if the S2 body were the skin family's 4,236 triangles; that number holds the head (1,054) and every painted rigid part. The S2 body was 2,147 triangles. The body takes what the rigid parts leave of 5,000, and the two pupils now come out of it. The total is 4,960 in every build.
3. **The wire size went up, not down.** The split vertices cost more than the body saved: see the table. The goblin's ceilings and the file's Brotli ceiling were raised from the builds (below).
4. `tests/fixtures/model-contract/totals.json`, the cache key and the fixtures S4 moves are as the plan's "S2 amendments" leave them; the family counts S4 copies are now wood 120, iron 508, skin 4,332 (three families) and skin 4,960 (one material), the same on both routes. Wood fell from 216 by the belt's 96.

### Measured

Brotli quality 3; "figure" is `figureStats` of `scripts/models-compare.mjs`. The script that printed these is `scratch/models-build/s2b/stats.mjs` (not committed; scratch is ignored).

| | S2 `a3` | `a3` | `b3` | `a1` | `b1` |
|---|---|---|---|---|---|
| Triangles | 4,960 | 4,960 | 4,960 | 4,960 | 4,960 |
| Meshes / materials | 3 / 3 | 3 / 3 | 3 / 3 | 1 / 1 | 1 / 1 |
| Vertices | 2,571 | 2,968 | 3,177 | 2,968 | 3,177 |
| Figure raw bytes | 164,668 | 185,312 | 196,180 | 185,312 | 196,180 |
| **Figure Brotli bytes** | 100,295 | **103,149** | **104,942** | **104,238** | **104,583** |
| `monsters.glb` Brotli bytes | 1,386,979 | 1,401,600 | 1,367,062 | 1,395,620 | 1,358,630 |
| `monsters.glb` raw bytes | 4,505,504 | 4,526,144 | 4,537,012 | 4,523,856 | 4,534,724 |
| `Monster_goblin_archer` Brotli bytes (ceiling 76,896) | 75,388 | 75,388 | 75,388 | 75,388 | 75,388 |
| Height of the figure's bounds (shipped 1.785) | 1.782 | 1.791 | 1.791 | 1.791 | 1.791 |
| Lowest vertex | | 0.000 | 0.000 | 0.000 | 0.000 |
| Pixels tall at 5.4 / 8.5 / 26 (this renderer) | 329 / 206 / 68 | 335 / 210 / 69 | 335 / 210 / 69 | 335 / 210 / 69 | 335 / 210 / 69 |

The height is 0.3% over the shipped goblin's. A hard-edged figure is 20.8 to 21.2 bytes a triangle on the wire (20.2 at S2): 3 to 5% more than S2's figure.

**Ceilings set from these, by the manifest's margins** (pending manifest): `Monster_goblin` `brotliBytes` 107,041 (the largest build, `b3` at 104,942, plus 2%; was 102,301) and `rawBytes` 198,142 (196,180 plus 1%; was 166,315); the file's `budget.brotliBytes` 1,415,616 (the largest, `a3` at 1,401,600, plus 1%; was 1,400,849, which `a3` exceeds by 751). Triangles 5,000, meshes 4, materials 5, the file's raw ceiling, `budget.materials` 36 and the archer's ceiling are unchanged. Design 9.1's "ordinary monster, as exported" row, reset to 104 kB at S2, would be 108 kB at 21.2 bytes a triangle plus 2%.

### Sheets

In `s1/`, re-rendered from the S2b builds with `--only goblin --worst --against public/models/monsters.glb`, under S2's file names: for `a3` and `b3` the turnaround, silhouette, play-distance, worst-pose and against sheets (left is the shipped goblin); for `a1` and `b1` the turnaround. The S2 sheets are in the history at `f8a140d`.

What they hold, as facts:

- **Route (a)** is planes: the chest front, the flanks, the shoulder blocks, the hump's face and each limb's four sides are separate facets with hard edges between them. Shoulders and fists are square in section: that is the skin modifier's own shape under fourteen passes, an artefact of the route and not a chosen plane. A smaller shoulder node (0.118 to 0.105) was tried and kept; the pad is still square at 210 px. The waist is narrower than ribs and hips in the front view. Feet are flat-soled blocks with the toe forward.
- **Route (b)** keeps rounder forms with facets where its six-sided limbs and the hump's rings turn; chest, belly and thigh muscles are marked by edges. Its feet are flattened ellipsoids.
- On both: the knees stand wider than the hips with open space between the legs; each eye is a yellow iris with a dark pupil; the shaft is visibly thicker in the fist. In `a1` and `b1` the spear head and boss are a brighter bronze and the shaft and planks a lighter brown than in `a3` and `b3` (item 1 above).
- **Worst pose**: no gap and no vertex off the body is visible on either route; spear, shield, belt and loincloth follow their bones.
- A render cannot show how the hard edges take the engine's banded light, or the skin against the lit grass: that is S3b's capture.
- **For S3b: the outline on hard edges.** A hard edge is two vertices at one place with two normals. If the skinned outline shell is pushed along each vertex's own normal (S1b's shader works on `objectNormal`), the shell can open along the body's hard edges. These sheets have no outline, so they cannot show it; S3b's outline captures of the body are the check.

## The pilot's planes in the paint, and its own kit materials (task S2c, 2026-11-25)

From the S3b art read (plan, "S3b follow-ups before OM-P"): in the game the planes did not reach the screen, the hide tile pulled the skin to the grass's hue, and the shared `mat_wood` and `mat_bronze` kept the kit dark. The same four builds, rebuilt. Nothing is promoted: `git status --short public/models blender` prints nothing. Pattern steps 3, 6 and 8 and "What the materials had to be" above are rewritten to match; the numbers of the S2 and S2b sections are kept as their record.

### The four builds, and two manifests

`timeout 600 env BLENDER_PATH=/usr/bin/blender GOBLIN_BODY=<a|b> GOBLIN_MATS=<3|1> node scripts/run-blender.mjs monsters --out scratch/models-build/s2c/<build>` for `a3`, `b3`, `a1`, `b1`, one Blender process at a time; each exits 0. A second run of all four gave byte-identical files.

COMPARE holds a file's material names as an exact set, and the variants now differ by two names, so each has its manifest:

| Builds | Manifest | COMPARE line | Exit |
|---|---|---|---|
| `a3`, `b3` | `tests/fixtures/model-contract/pending/monsters.json` (38 materials) | `node scripts/models-compare.mjs scratch/models-build/s2c/<build>/monsters.glb public/models/monsters.glb` | 0, 0 |
| `a1`, `b1` | `tests/fixtures/model-contract/pending/monsters.one-material.json` (36 materials) | `cp scratch/models-build/s2c/<build>/monsters.glb scratch/models-build/s2c/<build>/monsters.one-material.glb`, then `node scripts/models-compare.mjs scratch/models-build/s2c/<build>/monsters.one-material.glb public/models/monsters.glb` | 0, 0 |

COMPARE picks `pending/<name>.json` by the built file's own name, so the one-material builds are compared under the name `monsters.one-material.glb`; the script is unchanged. Contract and Budget pass on all four. Drift names the raider's nodes and meshes and the file's three totals, and no node, mesh or "geometry bytes changed" line of another figure. The two manifests differ only in `materials`, `budget.materials`, `budget.brotliBytes` and the goblin's `brotliBytes`. S4 promotes the owner's choice and deletes the other; for a one-material choice it renames that manifest to `monsters.json` first.

### The eight changes

| # | Change | What was built | Where |
|---|---|---|---|
| 1 | Plane tone, one tone per region bounded by hard edges, in a colour layer per face corner | See "The planes" below: the hard edges had to be closed first. Tones run from 0.880 to 1.078 (a) and 0.883 to 1.078 (b) | `_goblin_planes`, `_goblin_plane_tones`, `_goblin_body_tint` |
| 2 | Occlusion about 0.5; the ground-facing darkening replaced by (1) | `bake_paint(rig, ao=0.5)`; the body's dark tone now follows hand and foot weight only | `GOBLIN_OCCLUSION`, `_goblin_body_tint` |
| 3 | Route (a): chest as wide flat ellipses, waist about 0.125, collar about 0.18 | chest nodes 0.26 by 0.19 and 0.27 by 0.19 (were round, 0.215 and 0.225); waist 0.125 (was 0.135); each collar node the pair 0.18 by 0.13 (was 0.13 round). See "Open" item 2 for the collar | `_goblin_body_graph` |
| 4 | Goblin-own white wood and metal materials on the three-family builds | `mat_wood_goblin_paint` and `mat_bronze_goblin_paint`; wood `0x543C26` (33%), bronze `0x9A6E2A` (60%) and rust `0x6E4A2C` (43%) are now the same paint in all four builds; `GOBLIN_SHARED_CEILING` is gone | `build_goblin` |
| 5 | The shield's rim bronze | the rim takes the bronze colour (was rust), all four builds | `build_goblin` |
| 6 | Route (a): the foot one flat slab, toe box about 0.075 | heel and toe nodes at one height, 0.05 tall, 0.062 and 0.075 across. Built: the toe box is 0.164 wide and 0.106 high (S2b: 0.149 and 0.119), the sole 0.236 long | `_goblin_body_graph` |
| 7 | The skin paint divided by the hide tile's mean, linear | tile mean 0.7254, 0.8197, 0.2774 (printed by every build). Skin `0x505C3E` is painted as linear 0.111, 0.131, 0.174 and the dark tone `0x383F2C` as 0.055, 0.061, 0.091. Body, head and jaw; tusks, spikes, cloth, belt, irises, pupils and mouth are as they were | `_goblin_hide_mean`, `_goblin_skin_paint` |
| 8 | Hard edges on the head only if the bytes stay under the ceiling | **Not done.** The ceiling was 107,041 Brotli bytes and the body's closed planes alone take the figure to 111,215 to 118,372, so the condition fails before the head is touched | |

### The planes

**The control, on S2b's geometry.** With the corner layer added and nothing else changed, `a3` and `b3` exported 2,968 and 3,177 goblin vertices and 185,312 and 196,180 raw bytes, the same as S2b: the exporter writes the corner-domain layer by splitting at hard edges only, and it costs no vertex.

**But S2b's hard edges did not bound regions.** Edges marked by angle alone are mostly open runs. Faces joined across the edges that are not hard gave 21 regions on route (a) with one holding 96.5% of the skin's area, and 59 on route (b) with one holding 78.6%. A tone per such region would have changed almost nothing.

**So the hard edges are closed first** (pattern step 3): the faces are sorted into planes by their normals, and the edges between planes are marked hard with the creases. Measured on the final builds (each build prints the line):

| | Regions bounded by hard edges | Largest region, share of area | Five largest | Goblin vertices (S2b) | Vertices the colour layer alone splits |
|---|---|---|---|---|---|
| route (a) | 66 on 1,954 faces | 21.7% | 51.4% | 3,259 (2,968) | 0 |
| route (b) | 138 on 1,977 faces | 11.2% | 32.2% | 3,628 (3,177) | 0 |

The last column is the exported vertex count less the count of distinct (position, normal, joints, weights) on the four final files. The closed planes cost 291 vertices on route (a) and 451 on (b), and that is the wire growth below. Route (b) has more and smaller regions because its six-sided limbs and ringed hump leave many short creases, each of which closes a small facet. Other settings were tried on the S2b bodies with S2b's paint, before the loop that joins small planes was fixed (it stopped at the first plane that had grown past the limit), so they are indications only. Goblin Brotli bytes for `a3` and `b3`: 35 degrees with no joining 117,060 and 120,109; 35 degrees with joining 110,835 and 118,938; 45 degrees with joining 109,983 and 115,049.

### Measured

Brotli quality 3; "figure" is `figureStats` of `scripts/models-compare.mjs` (`scratch/models-build/s2c/stats.mjs`, not committed).

| | S2b `a3` | `a3` | `b3` | `a1` | `b1` |
|---|---|---|---|---|---|
| Triangles | 4,960 | 4,960 | 4,960 | 4,960 | 4,960 |
| Meshes / materials | 3 / 3 | 3 / 3 | 3 / 3 | 1 / 1 | 1 / 1 |
| Vertices | 2,968 | 3,259 | 3,628 | 3,259 | 3,628 |
| Figure raw bytes | 185,312 | 200,444 | 219,632 | 200,444 | 219,632 |
| **Figure Brotli bytes** | 103,149 | **111,215** | **118,372** | **112,678** | **117,106** |
| `monsters.glb` Brotli bytes | 1,401,600 | 1,399,122 | 1,418,420 | 1,368,195 | 1,410,213 |
| `monsters.glb` raw bytes | 4,526,144 | 4,541,592 | 4,560,784 | 4,538,988 | 4,558,176 |
| Materials in the file | 36 | 38 | 38 | 36 | 36 |
| `Monster_goblin_archer` Brotli bytes (ceiling 76,896) | 75,388 | 75,388 | 75,388 | 75,388 | 75,388 |
| Height of the figure's bounds (shipped 1.785) | 1.791 | 1.791 | 1.791 | 1.791 | 1.791 |
| Lowest vertex | 0.000 | 0.000 | 0.000 | 0.000 | 0.000 |

The goblin is 8 to 13% larger on the wire than at S2b (22.4 to 23.9 bytes a triangle). Route (b) at 118,372 and 117,106 is over design 9.1's "ordinary monster, as exported" of 115 kB; route (a) is under it. Engine family triangle counts are unchanged (wood 120, iron 508, skin 4,332; one material 4,960), so `pending/monster-families.goblin.json` is unchanged.

**Ceilings set from these, by the manifest's margins** (figure Brotli 2%, raw and file 1%, each manifest from its own two builds):

| | `pending/monsters.json` (`a3`, `b3`) | `pending/monsters.one-material.json` (`a1`, `b1`) | Before |
|---|---|---|---|
| `Monster_goblin` `brotliBytes` | 120,740 (`b3` 118,372) | 119,449 (`b1` 117,106) | 107,041 |
| `Monster_goblin` `rawBytes` | 221,829 (219,632) | 221,829 | 198,142 |
| `budget.brotliBytes` | 1,432,605 (`b3` 1,418,420) | 1,424,316 (`b1` 1,410,213) | 1,415,616 |
| `budget.materials` | 38 | 36 | 36 |

Triangles 5,000, meshes 4, the goblin's materials 5, the file's raw ceiling and the archer's ceiling are unchanged.

### Open for the main session

1. **The wire cost of the planes** is the one thing here the plan did not foresee: it asked for a layer that costs no vertex, which holds, but the regions it tones did not exist until the hard edges were closed, and closing them costs 8 to 13 kB a goblin over S2b. The two numbers that set the cost are `GOBLIN_PLANE_SPREAD` (40 degrees) and `GOBLIN_PLANE_MIN` (0.4%); the only other settings measured are the three under "The planes", on the S2b bodies. `tests/fixtures/model-contract/totals.json` moves at S4 by its rule either way.
2. **"Collar about 0.18" was read as a radius of the collar node.** As a round radius of 0.18 the skin broke (51 edges without exactly two faces; the builder stopped), so it is the pair 0.18 by 0.13. Which way each number of that pair lies on the collar's sideways edge was not measured (the pair's order was measured on the chest and on the foot only); the sheets show the shoulder line it gives. If the art read meant the collar node's place (x 0.15 to 0.18), that is one number in `_goblin_body_graph`.
3. **The sheets show the skin blue grey.** The paint is divided by a yellow-green tile that only the engine multiplies back; `review_render.py` has no tile and is outside S2c's files. The skin's paint reads as about `0x5D6574` there, and the product with the tile's mean is the table's `0x505C3E`. The tile is a texture, so the game's skin varies round that mean; S3c's captures are the check. Tusks, spikes, cloth, belt and eyes on the skin mesh are still multiplied by the tile undivided, as the task says, so in the game they lean yellow green; in the one-material builds that holds for wood and bronze too.
4. **A second pending manifest** is new to the pipeline: `scripts/models-promote.mjs` moves `pending/monsters.json` only, so S4 deletes or renames `pending/monsters.one-material.json` by hand (above).
5. Change 8 (head edges) is open with the wire ceiling, item 1.

### Sheets

In `s1/`, re-rendered from the S2c builds with `--only goblin --worst --against public/models/monsters.glb`, under the same file names: for `a3` and `b3` the turnaround, silhouette, play-distance, worst-pose and against sheets (left is the shipped goblin); for `a1` and `b1` the turnaround. `b3-goblin-silhouette.jpg` is byte-identical to S2b's, since route (b)'s shape did not change. The S2b sheets are in the history at `d443e0b`.

What they hold, as facts:

- **Skin colour**: blue grey in every sheet, for the reason in item 3; it is not the colour in the game.
- **Route (a)**: the chest is a wide plate with a flat front, narrower at the waist; the shoulder line slopes from the neck to the shoulder block; each foot is a low slab with a wider toe. Adjoining planes of chest, flank, back and limbs differ in tone as well as in shading.
- **Route (b)**: the shape is S2b's; its facets carry the tone in smaller pieces.
- **All four**: the shield's rim is bronze. In `a3` and `b3` the spear head, boss and rim are now the same bright bronze, and the shaft and planks the same lighter brown, as in `a1` and `b1`.
- **Worst pose**: no gap and no vertex off the body is visible on either route; spear, shield, belt and loincloth follow their bones.
- A render cannot show the paint under the engine's banded light or the tile: that is S3c's capture.
