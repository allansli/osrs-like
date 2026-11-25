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
| `a3` | (a) `figkit.organic_body` over a stick graph | three families: skin, wood, metal | `timeout 600 env BLENDER_PATH=/usr/bin/blender GOBLIN_BODY=a GOBLIN_MATS=3 node scripts/run-blender.mjs monsters --out scratch/models-build/s2/a3` |
| `b3` | (b) primitives fused by a voxel remesh | three families | the same with `GOBLIN_BODY=b`, `--out .../b3` |
| `a1` | (a) | one material, every colour in the paint layer | `GOBLIN_BODY=a GOBLIN_MATS=1`, `--out .../a1` |
| `b1` | (b) | one material | `GOBLIN_BODY=b GOBLIN_MATS=1`, `--out .../b1` |

With neither variable set the build is `a3`. Head, gear, palette, rig and weight rules are the same in all four. COMPARE is `node scripts/models-compare.mjs scratch/models-build/s2/<build>/monsters.glb public/models/monsters.glb`; one pending manifest (`tests/fixtures/model-contract/pending/monsters.json`) passes all four, Contract and Budget, exit 0.

### Measured

Brotli quality 3. "Figure" is `figureStats` of `scripts/models-compare.mjs` (the buffer views the figure's meshes and skin read), the number the manifest's ceiling is checked against.

| | Shipped goblin | `a3` | `b3` | `a1` | `b1` |
|---|---|---|---|---|---|
| Triangles | 8,292 | 4,960 | 4,960 | 4,960 | 4,960 |
| Meshes (draw calls a pass) | 29 | 3 | 3 | 1 | 1 |
| Materials | 10 | 3 | 3 | 1 | 1 |
| Vertices | | 2,555 | 2,555 | 2,555 | 2,555 |
| Figure raw bytes | 523,952 | 163,836 | 163,836 | 163,836 | 163,836 |
| **Figure Brotli bytes** | 92,625 | **101,225** | **100,335** | **101,172** | **100,197** |
| `monsters.glb` Brotli bytes | 1,281,976 | 1,062,902 | 1,062,065 | 1,057,299 | 1,056,730 |
| `monsters.glb` raw bytes | 4,848,004 | 2,350,288 | 2,350,292 | 2,348,000 | 2,348,000 |
| Height of the figure's bounds | 1.785 | 1.781 | 1.788 | 1.781 | 1.788 |
| Pixels tall at 5.4 / 8.5 / 26 (this renderer) | 323 / 209 / 70 | 330 / 206 / 68 | 330 / 207 / 68 | 330 / 206 / 68 | 330 / 207 / 68 |

The body route moves the wire size by under 1%, and so does the material variant. A painted, skinned 4,960-triangle figure with its weapon and shield is about 101 kB as exported: 20.4 bytes a triangle, 39.6 a vertex.

### Wire ceilings, reset from the pilot

The pending manifest's ceiling for `Monster_goblin` is 103,250 Brotli bytes (the largest build plus the manifest's 2%), 5,000 triangles, 4 meshes, 5 materials. Design 9.1's "as exported" column was drawn from a probe body; the same column at the pilot's 20.4 bytes a triangle plus 3%:

| Class | Triangles | Design 9.1, as exported | Reset from the pilot |
|---|---|---|---|
| Swarm creature | 1,200 | 30 kB | 26 kB |
| Small | 2,500 | 60 kB | 53 kB |
| Ordinary monster | 5,000 | 115 kB | 105 kB |
| Large | 7,000 | 160 kB | 147 kB |
| Boss | 14,000 | 320 kB | 294 kB |
| Ashmantle | 12,000 | 275 kB | 252 kB |

The "with N-3" column is not reset: the 8-bit step (Q1) has not been run on this figure. The design document is not in S2's file list, so its table is unchanged; these are the values to carry into it.

### The pattern, in order

All of it is in `build_goblin` and its helpers in `scripts/blender/build_monsters.py`.

1. **Joints first.** One table of joint positions (`goblin_joints`) in the bind pose, which is the stance. Each limb is within 20 degrees of the biped reference; `figkit.make_rig` refuses otherwise. The goblin's are 19 degrees of forward lean on the spine and 19 on the neck, 16 and 18 on the arms, 18 on thigh and shin. The hump of the back and the head's thrust are mesh, not joints, so they are free.
2. **Rigid parts** from the file's primitives (`add_sphere`, `add_cone_spike`, `add_lathe`, `add_limb_tube`, `add_box`), in world space with no parent. The head (skull, brow, nose, ears) is fused into one form by a voxel remesh at 0.012 and decimated to 1,100 triangles. Irises, tusks, jaw, pauldron and spikes, belt, loincloth, spear and shield stay primitives.
3. **Body last, with what is left of the triangle budget** (5,000 less 40 less the rigid parts). Route (a): `figkit.organic_body(graph, radii, 0.02, ...)`, then forty smoothing passes, because the skin modifier gives square limbs; the radii are about 15% over the wanted ones to pay for the passes. Route (b): closed primitives joined, voxel remesh at 0.02, eight passes. Both are decimated and `validate()`d.
4. **Rig**: `figkit.make_rig("Monster_goblin", rigs.BIPED_TABLE, joints, prefix="goblin")`, with the optional `Jaw`, `WeaponPivot` and `OffhandPivot`.
5. **Weights.** Rule 1: the body takes `figkit.auto_weights` against a second rig that holds only the sixteen limb bones and starts `Root` inside the pelvis; a `Root` standing from the ground to the hips would take the inner legs, and `Jaw` and the hand mounts would take skin. Rule 2: `figkit.fold_weights` gives `Root`'s share to `Hips`. Rule 3: every other part gets `figkit.hard_weights` on one bone: head and irises on `HeadGroup`, jaw and tusks on `Jaw`, spear on `WeaponPivot`, shield on `OffhandPivot`, pauldron on `LeftArmPivot`, belt and loincloth on `Hips` (never on the legs). Automatic weights left no vertex unweighted on either route; the segment fallback did not run.
6. **Colour before the merge.** Each part carries a constant `Tint`: its colour over its material's own colour. The body's tint goes from olive to the darker olive on faces turned to the ground and by hand and foot weight.
7. **Merge**: `figkit.merge_by_family(rig)` gives one skinned mesh per engine family, named `goblin_body`, `goblin_wood`, `goblin_metal`. No mesh name holds `eye`: the engine would draw that whole mesh unlit.
8. **Paint**: `figkit.bake_paint(rig)` with every other object hidden from the bake, then `Col` times `Tint`, then the armature modifier.
9. **Export** through `figkit.export_glb`.

### What the materials had to be

Vertex colour multiplies the material's colour, so it can only darken it. The skin mesh therefore uses a new white material, `mat_skin_goblin_paint`, and its olive, bone, rust cloth and yellow irises are paint. The three-family builds put shaft, shield planks and belt on `mat_wood` and spear head, boss, rim, collar and pauldron on `mat_bronze`, each tinted down from that material's colour. The one-material builds put everything on `mat_skin_goblin_paint`. Both variants export the same material names, which is why one manifest serves all four. Wood (24% value) and leather (20%) sit under design 5.4's 25% but over its 18% floor: `mat_wood` is shared and its colour is not this task's to change.

### What changed outside the goblin, and why

- **Every figure in the file now carries `COLOR_0`, and none carries `TEXCOORD_0`.** The manifest rule is "all or none" for `COLOR_0`, so the nine figures not painted yet carry white, which multiplies to no change. Keeping their `TEXCOORD_0` beside it was measured: 1,358,467 Brotli and 5,474,204 raw bytes, over the five-file total ceilings of `totals.json` (37,523 Brotli bytes of room), so the file could never be promoted. Exporting no UVs (design 6.3: no figure reads them) gives the numbers in the table. For all 153 meshes of the other nine figures, every triangle keeps the same position and normal at every corner as the shipped file (checked by hash); only vertex sharing changes, because the shipped UVs split every vertex per face. Compare's Drift lists each of them as "geometry bytes changed". No other builder's code changed.
- **The nine rigid figures do not get exactly the same albedo UVs in the engine, and S3 must look at it.** The engine projects UVs per vertex and then closes tile wraps per triangle (`assignProjectedUvs`, `stitchUvWraps` in `textures.ts`). With shared vertices a shift that closes one triangle can open its neighbour. Measured by upgrading each figure from the shipped file and from build `a3` through `upgradeMonsterRigWithGltf` in a throw-away worktree: of 62,334 triangles that carry an albedo map on the nine figures, 3,568 (5.7%) get different UVs, each by whole tiles (chicken 217, archer 690, scorpion 127, wizard 5, ranger 295, giant 251, guardian 143, demon 125, dragon 1,715). Triangles left with a wrap (an edge under 0.3 m spanning over half a tile), shipped against built: archer 397 against 876 of 5,384, scorpion 47 against 153 of 6,744, chicken 166 against 218 of 2,704, dragon 3,614 against 4,014 of 25,182. The rebuilt goblin has 51 to 74 of 4,960 across the four builds; the shipped goblin has 266 of 6,820. Whether the extra wraps show is a question for S3's capture of the archers beside the pilot. If they do, the choices are: fix the stitch for shared vertices in the engine (every skinned figure has them), or pass `export_texcoords=True` in `main()` and raise the total ceilings (the measured cost is above). The measuring scripts are kept, uncommitted, in `scratch/models-build/s2/` (`stats.mjs`, `fam.mjs`, `manifest.mjs`, `bbox.mjs`).
- **The pending manifest** changes more than the goblin's entry: `vertexColor` is `all`, `materials` gains `mat_skin_goblin_paint` (budget 35 to 36), and a `skin` block holds the nineteen bones, the skinned root and the limb directions. The goblin's five pivots leave `nodes` and are bones of the same names.
- **`tests/monster-merge.test.ts`'s goblin fixture is staged, not replaced.** The test reads the shipped file, so a replaced entry would turn the suite red until S4, and the entry differs between the material variants. Both are in `tests/fixtures/model-contract/pending/monster-families.goblin.json`; S4 copies the chosen one over the `goblin` entry of `tests/fixtures/monster-families.json` with the promotion. With each build copied over the shipped file in a throw-away worktree, with the pending manifest and its entry, `monster-merge`, `model-contract` and `skinned-figure` pass.
- **Two tests go red at S4, by design of the file, not of a build**: `tests/model-cache-key.test.ts` until the key is set, and `tests/model-vertex-colour.test.ts` "today's GLBs produce no material with vertexColors", which asserts that the shipped monsters carry no vertex colour. Any painted monsters file fails it; it needs a declared replacement before S4.

### Sheets

In `s1/`, rendered with `--only goblin --worst --against public/models/monsters.glb`: for `a3` and `b3` the turnaround, silhouette, play-distance, worst-pose and against sheets (left is the shipped goblin); for `a1` and `b1` the turnaround only, since a render cannot show how one engine material differs from three (that is S3's capture). The renderer does show the paint layer: the importer multiplies `COLOR_0` into the base colour.

What the sheets hold, against design 5.1's three reads, as facts:

- **26 (68 px)**: ears, spear and shield stand outside the body outline on both routes.
- **8.5 (206 px)**: weapon side and shield side are separate from the torso, with a gap under each arm; the tusks and irises are still distinct marks.
- **5.4 (330 px)**: route (b) keeps the forms of its primitives (shoulder, upper arm, calf, the hump); route (a) is one smooth sack with no muscle form, which is what a stick graph and forty passes give. The hands are mittens and the face is rigid, as design 6.1.6 says.
- **Worst pose** (crouch, right arm overhead, torso twisted 0.8, head turned): no gap and no vertex off the body is visible on either route. The spear follows the hand and the shield the forearm; the belt and loincloth stay with the hips. The sheet's crouch only lowers the root, so it does not bend a knee: knees and elbows are first seen bent in S3.
